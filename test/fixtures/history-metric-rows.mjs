/**
 * Saved-session log rows in the shape the app writes from a DraftV2 metric set.
 *
 * A finished workout commits one row per completed set carrying the source
 * metric composition ("source_metrics@1"), the metric ids and definitions of the
 * programmed slot, the performed values, and the loading context the set was
 * logged under. Suites that seed history (History, Today's recap, the session
 * summary, Progress) write these rows directly instead of driving a workout per
 * past session; the shape mirrors what `saveWorkout` commits for a Weight+Reps
 * movement with no bodyweight and no equipment recorded.
 *
 * Only Weight+Reps slots are supported: other metric compositions have their own
 * loading conventions and must be logged through the app.
 */

const LOAD = "loadKg";
const REPS = "reps";

/** The ProgramDefinition slot behind a program row. */
export function definitionSlot(programMeta, programRow) {
  const id = String(programRow?.slotId || programRow?.id || "");
  for (const day of programMeta?.programDefinition?.days || []) {
    for (const slot of day.slots || []) if (slot.id === id) return slot;
  }
  throw new Error(`no ProgramDefinition slot for program row ${id}`);
}

/** True when the slot is a Weight+Reps movement this helper can log. */
export function isWeightRepsSlot(slot) {
  const semantics = (slot?.metricDefinitions || []).map((metric) => metric.semantic);
  return semantics.length === 2 && semantics.includes(LOAD) && semantics.includes(REPS);
}

/**
 * One committed set. `set` is the 1-based ordinal shown to the lifter.
 * `extra` overrides plain row fields (performedName, blockId, rirMeasured…).
 */
export function metricLogRow(programMeta, programRow, { session, date, day, set, load, reps, rir = 1, notes = "", created, extra = {} }) {
  const slot = definitionSlot(programMeta, programRow);
  if (!isWeightRepsSlot(slot)) throw new Error(`slot ${slot.id} is not a Weight+Reps movement`);
  const definitions = structuredClone(slot.metricDefinitions);
  const coefficient = slot.loadingModel?.bodyweightCoefficient ?? null;
  return {
    session, date, day: day ?? programRow.day, name: programRow.name, exerciseId: programRow.id,
    set, setIndex: set - 1, load, reps, rir, notes,
    created: created ?? `${date}T12:00:00.000Z`,
    primary: programRow.primary, secondary: programRow.secondary,
    performedName: programRow.name, performedPrimary: programRow.primary, performedSecondary: programRow.secondary,
    metricIds: [...slot.metricIds],
    metricDefinitions: definitions,
    metricOrigin: slot.metricOrigin || "source_catalog",
    sourceLibraryId: slot.exerciseId,
    metricValues: definitions.map((metric) => ({
      metricId: metric.id, value: metric.semantic === LOAD ? load : reps, unit: metric.unit,
    })),
    equipmentId: null,
    loadingConvention: "external",
    ...(slot.loadingModel ? { loadingModel: structuredClone(slot.loadingModel) } : {}),
    loadingContext: {
      bodyweightContributionEnabled: false, externalLoadMultiplier: 1, bodyweightCoefficient: coefficient,
      loadingConvention: "external", bodyweightKg: null,
    },
    metricType: "source_metrics@1",
    restSeconds: null,
    performedLibraryId: slot.exerciseId,
    // A program activated as a block stamps its block on every committed row.
    ...(programMeta.blockId ? { blockId: programMeta.blockId } : {}),
    ...extra,
  };
}

/** A copy of a metric row with a different load and/or reps, both representations kept equal. */
export function withValues(row, { load = row.load, reps = row.reps } = {}) {
  const next = structuredClone(row);
  next.load = load;
  next.reps = reps;
  for (const value of next.metricValues) {
    const metric = next.metricDefinitions.find((definition) => definition.id === value.metricId);
    if (metric?.semantic === LOAD) value.value = load;
    if (metric?.semantic === REPS) value.value = reps;
  }
  return next;
}

/**
 * Generate and activate a real program through the production Generate path:
 * four days of muscle growth in a commercial gym, deterministic seed. Unlike the
 * seed program (manual Build prescriptions), its slots carry RIR targets, so the
 * adaptive engine recommends a next load once comparable history exists.
 * Returns the persisted state after activation.
 */
export async function installGeneratedProgram(page, { name = "Generated program", seed = "history-fixture" } = {}) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.() &&
    typeof window.__repforgeFinalizeProgramSetup === "function", undefined, { timeout: 15000 });
  return page.evaluate(async ({ name, seed }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalog, seed);
    if (!generated.ok) throw new Error(`generation failed: ${JSON.stringify(generated.conflicts || generated)}`);
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value, name, answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: seed },
    });
    await window.__repforgeStorage.flush();
    return JSON.parse(localStorage.getItem("repforge_v1"));
  }, { name, seed });
}
