/**
 * Arbitraries for valid shared-setup payloads (programs, custom exercises,
 * settings) plus privacy-polluted variants of them.
 *
 * Validity rules mirror the strict v1 schema enforced by shared-setup.js:
 * generated payloads must pass `validate` so the properties can assert on
 * encode/decode behaviour rather than on rejection paths.
 */
import fc from "fast-check";
import { intIn, smallCount } from "./numbers.mjs";

export const BUILT_IN_IDS = Object.freeze([
  "ab_mc", "cu_db", "cv_mc", "dl_bb", "hg_mc", "ht_bb", "lc_mc", "le_mc",
  "lg_db", "lp1_mc", "lr_mc", "pd_mc", "pr_db", "pr_mc", "pu_bw", "rd_mc",
  "rw_cb", "rw_mc", "sp_mc", "sq_bb", "sq_lp", "tb_mc", "tr_cb", "wc_bb",
]);

const GOALS = ["hypertrophy", "strength_hypertrophy", "beginner_consistency"];
const EXPERIENCES = ["beginner", "intermediate", "advanced"];
const SPLITS = ["full_body", "machine_only", "ppl", "upper_lower", "bro"];
const SESSION_LENGTHS = ["short", "normal", "long"];
const EQUIPMENT = ["machines", "cables", "dumbbells", "barbells", "bodyweight"];
const UNITS = ["kg", "lb"];
const LANGS = ["en", "pt"];
const RIR_MODES = ["numeric", "effort"];

/** Optional enum slot: value, explicit null, or key absent (undefined). */
function optionalEnum(values) {
  return fc.oneof(
    { weight: 3, arbitrary: fc.constantFrom(...values) },
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 2, arbitrary: fc.constant(undefined) },
  );
}

/**
 * Unicode-rich text. Code points exclude lone surrogates because well-formed
 * JSON round trips replace them, which would break exactness properties for
 * reasons unrelated to Taurifer's own contracts.
 */
export function text(maxLength = 24) {
  const codePoint = fc.oneof(
    { weight: 5, arbitrary: fc.integer({ min: 0x20, max: 0x7e }) },
    { weight: 2, arbitrary: fc.integer({ min: 0xa1, max: 0x2027 }).filter((cp) => cp < 0xd800 || cp > 0xdfff) },
    { weight: 1, arbitrary: fc.constantFrom(0x4e16, 0x5f3a, 0x2026, 0x2014, 0x1f3cb, 0x27bf, 0x00e7, 0x00e3) },
  );
  return fc.array(codePoint, { minLength: 0, maxLength })
    .map((cps) => String.fromCodePoint(...cps));
}

/** Names that survive trim + length limits; sometimes padded to exercise trimming. */
export function nameText(maxLength = 40) {
  return fc.oneof(
    { weight: 7, arbitrary: text(Math.min(maxLength, 24)).filter((s) => s.trim().length > 0 && [...s.trim()].length <= maxLength) },
    { weight: 1, arbitrary: text(Math.max(1, Math.floor(maxLength / 3))).map((s) => `  ${s}`).filter((s) => [...s.trim()].length > 0) },
    { weight: 1, arbitrary: fc.constantFrom("A", "Leg day", "Dia de perna", "Back & Biceps") },
  );
}

function equipmentList() {
  return fc
    .array(fc.constantFrom(...EQUIPMENT), { minLength: 1, maxLength: 5 })
    .map((list) => [...new Set(list)].slice(0, 5));
}

function metaArbitrary(dayCount) {
  return fc.record({
    name: nameText(60),
    goal: optionalEnum(GOALS),
    experience: optionalEnum(EXPERIENCES),
    daysPerWeek: fc.constant(dayCount),
    splitType: optionalEnum(SPLITS),
    equipment: equipmentList(),
    priorityMuscles: fc
      .array(nameText(30), { maxLength: 4 })
      .map((list) => [...new Set(list.map((value) => value.trim()))]),
    sessionLength: optionalEnum(SESSION_LENGTHS),
    mesocycleLengthWeeks: intIn(1, 52),
  });
}

function exerciseArbitrary(dayLabel, order, libraryId) {
  return fc
    .record({
      day: fc.constant(dayLabel),
      order: fc.constant(order),
      libraryId: fc.constant(libraryId),
      sets: smallCount(12),
      min: intIn(1, 20),
      max: intIn(21, 200),
      displayName: fc.oneof({ weight: 3, arbitrary: nameText(60) }, { weight: 2, arbitrary: fc.constant(undefined) }),
      notes: fc.oneof(
        { weight: 3, arbitrary: text(120) },
        { weight: 1, arbitrary: fc.constant("") },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
      alternates: fc.oneof(
        { weight: 2, arbitrary: fc.array(fc.constantFrom(...BUILT_IN_IDS), { maxLength: 3 }).map((list) => [...new Set(list)]) },
        { weight: 1, arbitrary: fc.constant([]) },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
      progressionType: fc.oneof(
        { weight: 3, arbitrary: fc.constant("double_progression") },
        { weight: 1, arbitrary: nameText(40) },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
      targetRirStart: fc.oneof(
        { weight: 3, arbitrary: fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }) },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
      targetRirEnd: fc.oneof(
        { weight: 3, arbitrary: fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }) },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
      minSets: fc.oneof({ weight: 3, arbitrary: smallCount(8) }, { weight: 1, arbitrary: fc.constant(undefined) }),
      maxSets: fc.oneof({ weight: 3, arbitrary: smallCount(12) }, { weight: 1, arbitrary: fc.constant(undefined) }),
      priority: fc.oneof(
        { weight: 2, arbitrary: fc.constantFrom("high", "normal", "low") },
        { weight: 1, arbitrary: fc.constant(undefined) },
      ),
    })
    .map((entry) => {
      if (entry.minSets !== undefined && entry.maxSets !== undefined && entry.maxSets < entry.minSets) {
        entry.maxSets = entry.minSets;
      }
      if (entry.minSets !== undefined && entry.sets < entry.minSets) entry.sets = entry.minSets;
      if (entry.maxSets !== undefined && entry.sets > entry.maxSets) entry.sets = entry.maxSets;
      return entry;
    });
}

function customId(index) {
  return `custom:gen-${index}`;
}

function customArbitrary(index) {
  return fc.record({
    id: fc.constant(customId(index)),
    name: nameText(80),
    namePt: fc.oneof({ weight: 2, arbitrary: nameText(80) }, { weight: 1, arbitrary: fc.constant(undefined) }),
    equipment: fc
      .array(fc.constantFrom("machine", "cable", "dumbbell", "barbell", "band", "bodyweight"), {
        minLength: 1,
        maxLength: 3,
      })
      .map((list) => [...new Set(list)]),
    primary: fc.oneof({ weight: 2, arbitrary: nameText(60) }, { weight: 1, arbitrary: fc.constant(undefined) }),
    secondary: fc.oneof({ weight: 2, arbitrary: nameText(60) }, { weight: 1, arbitrary: fc.constant(undefined) }),
    notes: fc.oneof({ weight: 2, arbitrary: text(100) }, { weight: 1, arbitrary: fc.constant(undefined) }),
  });
}

function settingsArbitrary() {
  return fc.record({
    jumpPct: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    minJump: fc.oneof(
      { weight: 4, arbitrary: fc.double({ min: 0.01, max: 50, noNaN: true, noDefaultInfinity: true }) },
      { weight: 1, arbitrary: fc.constantFrom(0.01, 1.25, 2.5, 1000) },
    ),
    rirHigh: fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
    hardRir: fc.double({ min: 0, max: 10, noNaN: true, noDefaultInfinity: true }),
    restSec: intIn(0, 600),
    unit: fc.constantFrom(...UNITS),
    lang: fc.constantFrom(...LANGS),
    rirMode: fc.constantFrom(...RIR_MODES),
  });
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) {
      if (value[key] !== undefined) out[key] = stripUndefined(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * A fully valid payload. Days are labelled Day 1..N with N in 1..7; exercises
 * are distributed over those days with unique per-day orders; every
 * libraryId either resolves to a built-in or to a carried custom definition.
 */
export function payloadArbitrary() {
  return fc
    .record({
      dayCount: intIn(1, 7),
      exercisesPerDay: smallCount(4),
      customCount: fc.integer({ min: 0, max: 3 }),
      settings: settingsArbitrary(),
      useCustomRefs: fc.boolean(),
    })
    .chain(({ dayCount, exercisesPerDay, customCount, settings, useCustomRefs }) => {
      const days = Array.from({ length: dayCount }, (_, index) => `Day ${index + 1}`);
      return fc
        .tuple(
          metaArbitrary(dayCount),
          fc.array(
            fc.record({ dayIndex: intIn(0, dayCount - 1), order: intIn(1, 30) }),
            {
              minLength: dayCount,
              maxLength: Math.max(dayCount, Math.min(exercisesPerDay * dayCount, 24)),
            },
          ).map((slots) => {
            // The first dayCount slots anchor one exercise per distinct day so
            // the generated program always satisfies
            // daysPerWeek === count(distinct days).
            const usedOrders = new Map();
            const positions = [];
            slots.forEach((slot, index) => {
              const anchored = index < days.length;
              const dayLabel = anchored ? days[index] : days[slot.dayIndex];
              let seen = usedOrders.get(dayLabel);
              if (!seen) usedOrders.set(dayLabel, (seen = new Set()));
              let order = anchored ? 1 : slot.order;
              while (seen.has(order)) order += 1;
              seen.add(order);
              positions.push({ dayLabel, order });
            });
            return positions;
          }),
          fc.tuple(...Array.from({ length: customCount }, (_, index) => customArbitrary(index))),
        )
        .chain(([meta, positions, customDefs]) => {
          const customIds = customDefs.map((entry) => entry.id);
          const exercises = positions.map(({ dayLabel, order }, index) => {
            const libraryId =
              useCustomRefs && customIds.length > 0 && index % 3 === 2
                ? customIds[index % customIds.length]
                : BUILT_IN_IDS[index % BUILT_IN_IDS.length];
            return exerciseArbitrary(dayLabel, order, libraryId);
          });
          return fc.tuple(...exercises).map((entries) =>
            stripUndefined({
              kind: "taurifer-shared-setup",
              version: 1,
              program: { meta, exercises: entries, customExercises: customDefs },
              settings,
            }),
          );
        });
    });
}

const POLLUTION_SITES = [
  ["$", ["log", "programHistory", "ui", "_storageRevision", "_storageFollowUp", "_storageDraftTransaction", "devicePrefs"]],
  ["settings", ["lastExport", "voiceInputEnabled", "notify", "theme"]],
  ["meta", ["id", "started", "created", "updated", "mesocycleStatus", "completedAt", "onboarded", "blockPromptDismissedId", "coachNotes"]],
  ["exercise", ["id", "movementId", "performedLastLoad", "history"]],
  ["custom", ["archived", "created", "patterns", "beginnerFriendly", "custom"]],
];

/**
 * A valid payload polluted at 1–3 sites with history/UI/storage-shaped junk.
 * Each injection carries a unique sentinel that must never reach the picked
 * proposal (INV-013: setup links never carry history).
 */
export function pollutedPayloadArbitrary() {
  return fc
    .record({
      base: payloadArbitrary(),
      siteIndices: fc.uniqueArray(fc.nat(POLLUTION_SITES.length - 1), { minLength: 1, maxLength: 3 }),
      sentinelSeed: fc.integer({ min: 1, max: 0xffffffff }),
    })
    .map(({ base, siteIndices, sentinelSeed }) => {
      const sentinels = [];
      const target = structuredClone(base);
      siteIndices.forEach((siteIndex, nth) => {
        const [site, keys] = POLLUTION_SITES[siteIndex];
        const sentinel = `rf-leak-${sentinelSeed}-${nth}`;
        sentinels.push(sentinel);
        const key = keys[(siteIndex + nth) % keys.length];
        if (site === "$") {
          target[key] = { marker: sentinel };
        } else if (site === "settings") {
          target.settings[key] = sentinel;
        } else if (site === "meta") {
          target.program.meta[key] = sentinel;
        } else if (site === "exercise") {
          const index = nth % target.program.exercises.length;
          target.program.exercises[index][key] = sentinel;
        } else if (site === "custom") {
          if (target.program.customExercises.length === 0) {
            target.program.customExercises.push({
              id: "custom:pollution-carrier",
              name: "Pollution carrier",
              equipment: ["machine"],
            });
            const carrier = structuredClone(target.program.exercises[0]);
            delete carrier.id;
            delete carrier.movementId;
            target.program.exercises.push({
              ...carrier,
              day: target.program.exercises[0].day,
              order: 900 + nth,
              libraryId: "custom:pollution-carrier",
            });
          }
          const index = nth % target.program.customExercises.length;
          target.program.customExercises[index][key] = sentinel;
        }
      });
      return { payload: target, sentinels };
    });
}
