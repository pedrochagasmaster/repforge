/**
 * Current-format (v4) setup links for the entry suites (install-modes,
 * entry-landing).
 *
 * The link carries a real generated ProgramDefinition, encoded in the page by
 * the production codec with the same codec options the app uses, so a
 * receiving landing reads exactly what a coach's Share sheet would produce.
 */
export const SETUP_SETTINGS = Object.freeze({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", rirMode: "numeric",
});

async function waitForCodec(page) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.()?.exercises?.length
    && !!window.RepForgeSharedSetup && !!window.RepForgeProgramCompiler, undefined, { timeout: 20000 });
}

/**
 * Encode a program as a `v4.` setup fragment value.
 *
 * Without `definition` the program is an unedited generated one (it travels as
 * its request and seed). A supplied `definition` (for example a Build program)
 * travels in full. `custom` ({ id, name, notes }) replaces the first training
 * slot with a custom movement the payload carries and puts `notes` on that
 * slot, so a suite can trace payload-only strings through storage; the
 * program then travels in full, so give it a definition small enough to fit.
 */
export async function encodeSetupLink(page, { name = "Coach block", language = "en", daysPerWeek = 3, definition = null, custom = null } = {}) {
  await waitForCodec(page);
  return page.evaluate(async ({ name, language, daysPerWeek, definition: supplied, custom, settings }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const Compiler = window.RepForgeProgramCompiler;
    let definition = supplied;
    if (!definition) {
      const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek, sessionMinutes: 60,
        environment: { kind: "commercial_gym" },
      }, catalog);
      if (!mapped?.ok) return { ok: false, code: "request-unmapped" };
      const generated = Compiler.generateProgram(mapped.value, catalog, "entry-setup-link");
      if (!generated?.ok) return { ok: false, code: "generation-failed" };
      definition = generated.value;
    }
    const program = { name, definition };
    if (custom) {
      const slot = definition.days.find((day) => day.kind === "training").slots[0];
      slot.exerciseId = custom.id;
      slot.sourceExerciseIds = [custom.id];
      slot.metricOrigin = "user_defined";
      slot.role = "manual";
      if (custom.notes) slot.setupNotes = custom.notes;
      for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) set.status = "manual";
      program.customExercises = [{
        id: custom.id, name: custom.name, namePt: custom.name, equipment: [], primary: "", secondary: "", notes: "",
        metricIds: structuredClone(slot.metricIds), metricDefinitions: structuredClone(slot.metricDefinitions),
      }];
    }
    const api = window.RepForgeSharedSetup;
    return api.encode({
      kind: api.KIND, version: api.VERSION, program, settings: { ...settings, lang: language }, language,
    }, {
      builtInIds: new Set(catalog.exercises.map((exercise) => exercise.id)),
      catalogSnapshot: catalog,
      validateProgramDefinition: Compiler.validateProgramDefinition,
      generateProgram: Compiler.generateProgram,
      generatorVersion: Compiler.GENERATOR_VERSION,
    });
  }, { name, language, daysPerWeek, definition, custom, settings: SETUP_SETTINGS });
}

/** Encode an already-built payload (for example the app's own Share build). */
export async function encodeSetupPayload(page, payload) {
  await waitForCodec(page);
  return page.evaluate(async (payload) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const Compiler = window.RepForgeProgramCompiler;
    return window.RepForgeSharedSetup.encode(payload, {
      builtInIds: new Set(catalog.exercises.map((exercise) => exercise.id)),
      catalogSnapshot: catalog,
      validateProgramDefinition: Compiler.validateProgramDefinition,
      generateProgram: Compiler.generateProgram,
      generatorVersion: Compiler.GENERATOR_VERSION,
    });
  }, payload);
}

/** Decode a `v4.` value with the same codec options. */
export async function decodeSetupLink(page, value) {
  await waitForCodec(page);
  return page.evaluate(async (value) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const Compiler = window.RepForgeProgramCompiler;
    return window.RepForgeSharedSetup.decode(value, {
      builtInIds: new Set(catalog.exercises.map((exercise) => exercise.id)),
      catalogSnapshot: catalog,
      validateProgramDefinition: Compiler.validateProgramDefinition,
      generateProgram: Compiler.generateProgram,
      generatorVersion: Compiler.GENERATOR_VERSION,
    });
  }, value);
}
