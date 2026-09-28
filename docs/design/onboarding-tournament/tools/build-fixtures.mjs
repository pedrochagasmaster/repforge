#!/usr/bin/env node
/**
 * Builds data/fixtures.js for the onboarding design tournament harness.
 *
 * Everything here is derived from the vendored PR #256 modules (see
 * vendor/README.md for the SHA): the i18n subset comes from the two catalogs at
 * that commit, the shared setup fragments are encoded by the real codec, and
 * the example programs are compiled by the real compiler at harness runtime
 * (this file only pins the answer sets every candidate must use).
 *
 * Run: node docs/design/onboarding-tournament/tools/build-fixtures.mjs <path-to-pr256-checkout>
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2];
if (!root) { console.error("usage: build-fixtures.mjs <pr256-checkout>"); process.exit(1); }
const require = createRequire(import.meta.url);
const SharedSetup = require(join(root, "shared-setup.js"));
const { EXERCISE_LIBRARY } = require(join(root, "exercises.js"));

const en = JSON.parse(readFileSync(join(root, "i18n-en.json"), "utf8"));
const pt = JSON.parse(readFileSync(join(root, "i18n-pt.json"), "utf8"));
function flat(d, p = "") { const out = {}; for (const [k, v] of Object.entries(d)) { if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, p + k + ".")); else out[p + k] = v; } return out; }
const fe = flat(en), fp = flat(pt);
// Round 2 (H-5, H-15): "privacy." for the shared Privacy stub and "muscle."
// for localizing every muscle token on the Today session line.
const PREFIXES = ["entry.", "setup.", "landing.", "import.", "program.day.", "program.progression.strategy.", "program.default.day", "plural.", "today.", "untitled_program", "privacy.", "muscle.", "nav.", "program.no_program", "program.empty.", "onb.cancel", "onb.back", "onb.next", "toast.freeform", "toast.import"];
const i18n = { en: {}, pt: {} };
for (const k of Object.keys(fe)) if (PREFIXES.some((p) => k.startsWith(p))) { i18n.en[k] = fe[k]; i18n.pt[k] = fp[k]; }

/* Shared setup fragments, encoded by the production codec (Node gzip stand-in
   for CompressionStream: identical bytes, since both are RFC 1952 gzip). */
const ids = EXERCISE_LIBRARY.map((e) => e.id);
const byId = Object.fromEntries(EXERCISE_LIBRARY.map((e) => [e.id, e]));
function exercise(day, order, id, sets = 3, min = 6, max = 10) {
  const e = byId[id];
  return { day, order, name: e.name, libraryId: id, sets, min, max, primary: e.primary, secondary: e.secondary, notes: "" };
}
const coachProgram = (lang) => ({
  kind: "taurifer-shared-setup", version: 1,
  program: {
    meta: { name: lang === "pt" ? "Programa do treinador" : "Coach program", goal: "strength_hypertrophy", experience: "intermediate", daysPerWeek: 3, splitType: "full_body", equipment: ["barbells", "dumbbells", "cables", "machines"], priorityMuscles: ["Chest", "Quads"], sessionLength: "normal", mesocycleLengthWeeks: 6 },
    exercises: [
      exercise("Day 1", 1, "sq_bb", 3, 5, 8), exercise("Day 1", 2, "pr_bb", 3, 5, 8), exercise("Day 1", 3, "rw_bb", 3, 8, 12), exercise("Day 1", 4, "cu_bb", 2, 8, 12),
      exercise("Day 2", 1, "sq_lp", 3, 8, 12), exercise("Day 2", 2, "pr_mc", 3, 8, 12), exercise("Day 2", 3, "pd_bw", 3, 6, 10), exercise("Day 2", 4, "trd_as", 2, 8, 12),
      exercise("Day 3", 1, "rw_mc", 3, 8, 12), exercise("Day 3", 2, "pr_db", 3, 8, 12), exercise("Day 3", 3, "sq_bb", 3, 6, 10), exercise("Day 3", 4, "cu_bb", 2, 10, 15),
    ],
    customExercises: [],
  },
  settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang, rirMode: "numeric" },
});
function gzipBase64Url(text) {
  const bytes = gzipSync(Buffer.from(text, "utf8"));
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const sharedFragments = {};
for (const lang of ["en", "pt"]) {
  const payload = coachProgram(lang);
  const checked = SharedSetup.validate(payload, { builtInIds: ids });
  if (!checked.ok) throw new Error(`shared payload invalid: ${JSON.stringify(checked.issues || checked.code)}`);
  // Canonical v1 envelope: JSON + gzip + base64url. The codec's encode() is
  // async in the browser; Node's gzip yields the same envelope shape and the
  // harness decodes it through the real RepForgeSharedSetup.decode().
  sharedFragments[lang] = "v1." + gzipBase64Url(JSON.stringify(payload));
  sharedFragments[lang + "Payload"] = payload;
}
sharedFragments.invalid = "v1.not+base64";

/* Import file fixture (Taurifer program file with one likely, one exact, one
   unmatched row) and the free-form reply fixtures used by scenario 9. */
const importFile = (lang) => ({
  meta: { name: lang === "pt" ? "Treino do Rafael" : "Rafael's program" },
  exercises: [
    { id: "r1", day: lang === "pt" ? "Dia 1" : "Day 1", name: lang === "pt" ? "Supino reto com barra" : "Flat barbell bench press", sets: 3, repLow: 6, repHigh: 10, muscles: ["Chest"] },
    { id: "r2", day: lang === "pt" ? "Dia 1" : "Day 1", name: lang === "pt" ? "Agachamento livre com barra" : "Barbell back squat", sets: 3, repLow: 5, repHigh: 8, muscles: ["Quads"] },
    { id: "r3", day: lang === "pt" ? "Dia 1" : "Day 1", name: lang === "pt" ? "Remada curvada" : "Bent-over row", sets: 3, repLow: 8, repHigh: 12, muscles: ["Lats"] },
    { id: "r4", day: lang === "pt" ? "Dia 2" : "Day 2", name: lang === "pt" ? "Leg press 45° pés altos" : "Leg press 45° feet high", sets: 3, repLow: 10, repHigh: 15, muscles: ["Quads"] },
    { id: "r5", day: lang === "pt" ? "Dia 2" : "Day 2", name: "Zerbulator 9000", sets: 3, repLow: 10, repHigh: 15, muscles: ["Other"] },
    { id: "r6", day: lang === "pt" ? "Dia 2" : "Day 2", name: lang === "pt" ? "Elevação lateral com halteres" : "Dumbbell lateral raise", sets: 3, repLow: 12, repHigh: 15, muscles: ["Side delts"] },
  ],
});
const freeform = {
  pasted: {
    en: "Push A\nBench press 4x6-8\nOverhead press 3x8-10\nCable flyes 3 sets\n\nPull A\nBarbell row 4x6-10\nLat pulldown 10-12\nFace pulls 3x15",
    pt: "Empurrar A\nSupino reto 4x6-8\nDesenvolvimento militar 3x8-10\nCrucifixo no cabo 3 séries\n\nPuxar A\nRemada curvada 4x6-10\nPuxada alta 10-12\nFace pull 3x15",
  },
  replyGaps: {
    en: JSON.stringify({ version: 3, meta: { name: "Push Pull" }, exercises: [
      { day: "Push A", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
      { day: "Push A", order: 2, name: "Overhead press", sets: 3, min: 8, max: 10 },
      { day: "Push A", order: 3, name: "Cable flyes", sets: 3 },
      { day: "Pull A", order: 1, name: "Barbell row", sets: 4, min: 6, max: 10 },
      { day: "Pull A", order: 2, name: "Lat pulldown", min: 10, max: 12 },
      { day: "Pull A", order: 3, name: "Face pulls", sets: 3, min: 15, max: 15 } ],
      missing: [ { day: "Push A", order: 3, field: "reps" }, { day: "Pull A", order: 2, field: "sets" } ],
      notImported: ["rest_times", "rir_rpe"] }, null, 0),
    pt: JSON.stringify({ version: 3, meta: { name: "Empurrar e puxar" }, exercises: [
      { day: "Empurrar A", order: 1, name: "Supino reto", sets: 4, min: 6, max: 8 },
      { day: "Empurrar A", order: 2, name: "Desenvolvimento militar", sets: 3, min: 8, max: 10 },
      { day: "Empurrar A", order: 3, name: "Crucifixo no cabo", sets: 3 },
      { day: "Puxar A", order: 1, name: "Remada curvada", sets: 4, min: 6, max: 10 },
      { day: "Puxar A", order: 2, name: "Puxada alta", min: 10, max: 12 },
      { day: "Puxar A", order: 3, name: "Face pull", sets: 3, min: 15, max: 15 } ],
      missing: [ { day: "Empurrar A", order: 3, field: "reps" }, { day: "Puxar A", order: 2, field: "sets" } ],
      notImported: ["rest_times", "rir_rpe"] }, null, 0),
  },
  replyUnreadable: { en: "Sorry, I could not parse this workout format. Could you paste it again?", pt: "Desculpe, não consegui entender este formato de treino. Pode colar de novo?" },
};

/* Example users. All candidates share the same answers, so the compiled
   programs and the recommendation explanations are identical across them. */
const users = {
  rafael: {
    label: "Rafael · 28 · recreational lifter, São Paulo, commercial gym",
    answers: { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120, environmentKind: "commercial_gym" },
    correction: { environmentKind: "limited_home", equipmentAdd: ["dumbbell", "band"], capabilitiesAdd: ["safe_pull"] },
    pain: { exerciseId: "pr_bb", reason: "pain", primaryMuscles: ["chest"] },
  },
  custom: {
    label: "Custom route answers (balanced, 4 days)",
    answers: { desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 4, sessionMinutes: 60, preferredRestSeconds: null, environmentKind: "commercial_gym", mustHaveExercises: ["pr_bb"], exerciseConstraints: [{ exerciseId: "cu_bb", reason: "dislike" }], deEmphasizedMuscles: ["calves"], primaryMuscles: ["chest"] },
  },
  browse: { label: "Browse context", answers: { daysPerWeek: 4, sessionMinutes: 60, environmentKind: "commercial_gym" } },
  existing: { label: "Existing active program on the device", program: { name: "Full body A/B", daysPerWeek: 2, exercises: [exercise("Day 1", 1, "sq_bb"), exercise("Day 1", 2, "pr_bb"), exercise("Day 1", 3, "rw_bb"), exercise("Day 2", 1, "sq_lp"), exercise("Day 2", 2, "pr_mc"), exercise("Day 2", 3, "pd_bw")], sessions: 7 } },
};

const out = `/* GENERATED by tools/build-fixtures.mjs from the PR #256 head. Do not hand-edit. */
window.__tournamentFixtures = ${JSON.stringify({ i18n, sharedFragments, importFile: { en: importFile("en"), pt: importFile("pt") }, freeform, users }, null, 1)};
`;
writeFileSync(join(here, "..", "data", "fixtures.js"), out);
console.log("wrote data/fixtures.js", out.length, "bytes;", Object.keys(i18n.en).length, "i18n keys");
