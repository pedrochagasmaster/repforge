/**
 * Frozen shared-setup v1 fixtures and public interface constants.
 *
 * Keep this file independent of app.js so both Node and browser suites can use
 * the same payload vocabulary.
 */
export const KIND = "taurifer-shared-setup";
export const VERSION = 1;
export const MAX_ENCODED_CHARS = 3072;
export const MAX_COMPRESSED_BYTES = 2301;
export const MAX_DECOMPRESSED_BYTES = 65536;

export const REQUIRED_API = Object.freeze([
  "KIND",
  "VERSION",
  "MAX_ENCODED_CHARS",
  "MAX_COMPRESSED_BYTES",
  "MAX_DECOMPRESSED_BYTES",
  "canonicalize",
  "validate",
  "encode",
  "decode",
  "readSetupFragment",
  "removeSetupFragment",
  "handoffCookiePath",
  "readHandoffCookie",
  "writeHandoffCookie",
  "clearHandoffCookie",
]);

export const BUILT_IN_IDS = new Set([
  "ab_mc", "cu_db", "cv_mc", "dl_bb", "hg_mc", "ht_bb", "lc_mc", "le_mc",
  "lg_db", "lp1_mc", "lr_mc", "pd_mc", "pr_db", "pr_mc", "pu_bw", "rd_mc",
  "rw_cb", "rw_mc", "sp_mc", "sq_bb", "sq_lp", "tb_mc", "tr_cb", "wc_bb",
]);

export const CURRENT_SETTINGS_DEFAULTS = Object.freeze({
  jumpPct: 2.5,
  minJump: 2.5,
  rirHigh: 2,
  hardRir: 4,
  restSec: 120,
  lastExport: "",
  unit: "kg",
  lang: null,
  rirMode: "numeric",
  voiceInputEnabled: false,
  notify: Object.freeze({
    enabled: false,
    timer: true,
    session: true,
    unfinished: true,
    missed: true,
  }),
});

export const PROGRAM_EXPORT_VERSION = 3;
export const PROGRAM_EXPORT_KEYS = Object.freeze([
  "version",
  "meta",
  "exercises",
  "customExercises",
]);

const ids = [...BUILT_IN_IDS];
const exercise = (day, order, libraryId) => ({
  day,
  order,
  libraryId,
  sets: order % 3 === 0 ? 4 : 3,
  min: order % 2 === 0 ? 8 : 6,
  max: order % 2 === 0 ? 12 : 10,
  notes: order === 1 ? "Controlled eccentric" : "",
  alternates: [],
  progressionType: "double_progression",
  targetRirStart: 3,
  targetRirEnd: 1,
  minSets: 2,
  maxSets: 5,
  priority: order === 1 ? "high" : "normal",
});

export const MINIMAL_PAYLOAD = Object.freeze({
  kind: KIND,
  version: VERSION,
  program: {
    meta: {
      name: "Coach program",
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 1,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: ["Chest"],
      sessionLength: "normal",
      mesocycleLengthWeeks: 6,
    },
    exercises: [exercise("Day 1", 1, "pr_mc")],
    customExercises: [],
  },
  settings: {
    jumpPct: 2.5,
    minJump: 2.5,
    rirHigh: 2,
    hardRir: 4,
    restSec: 120,
    unit: "kg",
    lang: "en",
    rirMode: "numeric",
  },
});

export const REPRESENTATIVE_PAYLOAD = Object.freeze({
  kind: KIND,
  version: VERSION,
  program: {
    meta: {
      name: "Força compartilhada",
      goal: "strength_hypertrophy",
      experience: "advanced",
      daysPerWeek: 4,
      splitType: "upper_lower",
      equipment: ["machines", "cables", "dumbbells", "barbells"],
      priorityMuscles: ["Chest", "Back", "Quads"],
      sessionLength: "long",
      mesocycleLengthWeeks: 8,
    },
    exercises: [
      ...ids.slice(0, 6).map((id, index) => exercise("Day 1", index + 1, id)),
      ...ids.slice(6, 12).map((id, index) => exercise("Day 2", index + 1, id)),
      ...ids.slice(12, 18).map((id, index) => exercise("Day 3", index + 1, id)),
      ...ids.slice(18, 23).map((id, index) => exercise("Day 4", index + 1, id)),
      {
        ...exercise("Day 4", 6, "custom:coach-row"),
        displayName: "Remada do treinador",
        notes: "Pause at peak contraction",
      },
    ],
    customExercises: [{
      id: "custom:coach-row",
      name: "Coach cable row",
      namePt: "Remada do treinador",
      equipment: ["cable"],
      primary: "Mid/upper back",
      secondary: "Biceps",
      notes: "Neutral handle",
    }],
  },
  settings: {
    jumpPct: 3.5,
    minJump: 1.25,
    rirHigh: 3,
    hardRir: 5,
    restSec: 165,
    unit: "kg",
    lang: "pt",
    rirMode: "effort",
  },
});

export const INVALID_DECODE_INPUTS = Object.freeze({
  missing: null,
  "unsupported-version": "v2.e30",
  "encoded-too-large": `v1.${"a".repeat(MAX_ENCODED_CHARS)}`,
  "invalid-base64": "v1.not+base64",
  "invalid-gzip": "v1.e30",
});

export const INVALID_PAYLOADS = Object.freeze({
  "invalid-schema": {
    ...MINIMAL_PAYLOAD,
    settings: { ...MINIMAL_PAYLOAD.settings, lang: "fr" },
  },
  "invalid-json": "{not json",
  "invalid-utf8": new Uint8Array([0xc3, 0x28]),
  "decompressed-too-large": "x".repeat(MAX_DECOMPRESSED_BYTES + 1),
});

export function cloneFixture(value = MINIMAL_PAYLOAD) {
  return structuredClone(value);
}
