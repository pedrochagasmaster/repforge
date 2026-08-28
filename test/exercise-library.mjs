#!/usr/bin/env node
/* Integrity gate for the generated exercise library.

   The library is data the rest of the app trusts blindly: the volume audit
   groups hard sets by exact muscle string, saved programs point at library ids
   forever, and the program generator can only fill a day if every slot it asks
   for has candidates. Each of those is a way for a regenerated exercises.js to
   break the app quietly, so each gets a check here. */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = join(__dirname, "..");
const { EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = require(join(ROOT, "exercises.js"));

let passed = 0, failed = 0;
function assert(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

/* The exact strings the volume audit groups by. Adding one is a product
   decision — it shows up as a new row in the audit and needs muscle.<token>
   copy in both locales — so it is spelled out here rather than derived. */
const MUSCLES = new Set([
  "Chest", "Lats", "Mid/upper back", "Traps", "Front delts", "Side delts", "Rear delts",
  "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Adductors",
  "Abductors", "Calves", "Spinal erectors", "Abs", "Obliques"
]);
const EQUIPMENT = new Set(["barbell", "dumbbell", "cable", "machine", "smith", "bodyweight"]);

/* Every slot the program generator can ask a day for. A slot with no
   candidates makes generateProgramFromOnboarding silently skip an exercise. */
const GENERATOR_SLOTS = [
  "squat", "hinge", "press", "incline_press", "shoulder_press", "row", "pulldown",
  "pull", "delts", "lateral_raise", "rear_delt", "chest_iso", "arms", "curl",
  "triceps", "leg_curl", "leg_extension", "calves", "adduction"
];

/* Library ids that shipped before the picker existed. Saved programs carry
   them in libraryId, so each must still resolve — directly or through the
   legacy alias table. Losing one silently unlinks somebody's program. */
const SHIPPED_IDS = [
  "sq_bb", "sq_sm", "sq_lp", "sq_db", "hg_bb", "hg_sm", "hg_mc", "pr_bb", "pr_db",
  "pr_mc", "ip_db", "ip_mc", "ip_bb", "sp_bb", "sp_mc", "sp_db", "rw_bb", "rw_mc",
  "rw_cb", "pd_mc", "pd_bw", "pl_cb", "pl_mc", "dl_mc", "dl_db", "dl_cb", "lr_db",
  "lr_mc", "rd_mc", "rd_db", "ci_mc", "ci_cb", "ar_mc", "ar_db", "cu_mc", "cu_db",
  "cu_cb", "tr_cb", "tr_mc", "lc_mc", "le_mc", "cv_mc", "ad_mc"
];

console.log(`exercise library — ${EXERCISE_LIBRARY.length} movements`);

assert(EXERCISE_LIBRARY.length >= 200, "library is a real library, not a stub",
  `${EXERCISE_LIBRARY.length} entries`);

{
  const seen = new Map();
  const dupes = [];
  for (const e of EXERCISE_LIBRARY) {
    if (seen.has(e.id)) dupes.push(e.id);
    seen.set(e.id, e);
  }
  assert(dupes.length === 0, "ids are unique", dupes.join(", "));
}

{
  const bad = EXERCISE_LIBRARY.filter(e =>
    !e.id || !e.name || !e.namePt || !e.primary ||
    !Array.isArray(e.equipment) || !e.equipment.length ||
    !Array.isArray(e.patterns) || typeof e.beginnerFriendly !== "boolean");
  assert(bad.length === 0, "every entry carries the required fields",
    bad.map(e => e.id).join(", "));
}

{
  const bad = [];
  for (const e of EXERCISE_LIBRARY)
    for (const token of `${e.primary},${e.secondary || ""}`.split(",").filter(Boolean))
      if (!MUSCLES.has(token)) bad.push(`${e.id}: "${token}"`);
  assert(bad.length === 0, "muscle tokens stay inside the audited vocabulary",
    bad.slice(0, 8).join(" | "));
}

{
  const bad = [];
  for (const e of EXERCISE_LIBRARY)
    for (const eq of e.equipment) if (!EQUIPMENT.has(eq)) bad.push(`${e.id}: "${eq}"`);
  assert(bad.length === 0, "equipment stays inside the wizard's vocabulary",
    bad.slice(0, 8).join(" | "));
}

{
  const bad = EXERCISE_LIBRARY.filter(e =>
    e.primary.split(",").some(p => (e.secondary || "").split(",").includes(p)));
  assert(bad.length === 0, "no muscle is both primary and secondary",
    bad.map(e => e.id).join(", "));
}

{
  const thin = GENERATOR_SLOTS.filter(slot =>
    !EXERCISE_LIBRARY.some(e => e.patterns.includes(slot)));
  assert(thin.length === 0, "every generator slot has candidates", thin.join(", "));
}

{
  // A machines-only lifter is the tightest equipment filter the wizard offers;
  // every slot it can ask for has to survive it.
  const thin = GENERATOR_SLOTS.filter(slot =>
    !EXERCISE_LIBRARY.some(e => e.patterns.includes(slot) && e.equipment.includes("machine")));
  assert(thin.length === 0, "machines-only lifters can fill every slot", thin.join(", "));
}

{
  const ids = new Set(EXERCISE_LIBRARY.map(e => e.id));
  const lost = SHIPPED_IDS.filter(id => !ids.has(id) && !LEGACY_LIBRARY_IDS[id]);
  assert(lost.length === 0, "ids from before the picker still resolve", lost.join(", "));
}

{
  const ids = new Set(EXERCISE_LIBRARY.map(e => e.id));
  const dangling = Object.entries(LEGACY_LIBRARY_IDS).filter(([from, to]) => ids.has(from) || !ids.has(to));
  assert(dangling.length === 0, "legacy aliases point at live entries, not live ids",
    dangling.map(([f, t]) => `${f}→${t}`).join(", "));
}

{
  // Same movement listed twice under different ids is a picker full of
  // near-duplicates; the merge into LEGACY_LIBRARY_IDS exists to prevent it.
  const byName = new Map();
  for (const e of EXERCISE_LIBRARY) {
    const key = e.name.toLowerCase();
    byName.set(key, (byName.get(key) || []).concat(e.id));
  }
  const dupes = [...byName].filter(([, ids]) => ids.length > 1);
  assert(dupes.length === 0, "no two entries share a display name",
    dupes.map(([n, ids]) => `${n} (${ids.join(",")})`).join(" | "));
}

{
  const untranslated = EXERCISE_LIBRARY.filter(e => e.namePt === e.name && !/^(leg press|pullover|crossover|dead bug|rack pull|pull through|swing)/i.test(e.name));
  assert(untranslated.length === 0, "Portuguese names are actually Portuguese",
    untranslated.map(e => e.id).join(", "));
}

{
  // Every muscle token needs display copy in both locales or the audit renders
  // a raw identifier at people.
  const en = JSON.parse(readFileSync(join(ROOT, "i18n-en.json"), "utf8"));
  const pt = JSON.parse(readFileSync(join(ROOT, "i18n-pt.json"), "utf8"));
  const missing = [];
  for (const token of MUSCLES) {
    if (!(`muscle.${token}` in en)) missing.push(`en muscle.${token}`);
    if (!(`muscle.${token}` in pt)) missing.push(`pt muscle.${token}`);
  }
  assert(missing.length === 0, "every muscle token has copy in both locales",
    missing.join(", "));
}

{
  // The media in the upstream repository is not ours to ship; nothing in the
  // library may reference it.
  const raw = readFileSync(join(ROOT, "exercises.js"), "utf8");
  assert(!/images\/|videos\/|\.gif|gymvisual/i.test(raw),
    "library ships no upstream media references");
}

/* ---- artwork ----
   Exactly 96 illustrations are licensed. More than that means something was
   invented; fewer means a mapping was lost. Every mapped path must exist, or
   the app issues a request for a file that is not there. */
{
  const mapped = EXERCISE_LIBRARY.filter(e => e.media);
  assert(mapped.length === 96, "exactly 96 exercises carry artwork", `${mapped.length} mapped`);

  const missing = mapped.filter(e => !existsSync(join(ROOT, e.media)));
  assert(missing.length === 0, "every mapped illustration exists on disk",
    missing.map(e => `${e.id} → ${e.media}`).join(", "));

  const stray = mapped.filter(e => e.media !== `assets/exercises/${e.id}.webp`);
  assert(stray.length === 0, "artwork is keyed by library id, not by name or slug",
    stray.map(e => `${e.id} → ${e.media}`).join(", "));

  const files = readdirSync(join(ROOT, "assets", "exercises")).filter(f => f.endsWith(".webp"));
  assert(files.length === 96, "no unreferenced artwork ships", `${files.length} files`);
  const unmapped = files.filter(f => !mapped.some(e => e.media.endsWith(`/${f}`)));
  assert(unmapped.length === 0, "every shipped file is mapped to a library id", unmapped.join(", "));

  // Everything else must render the empty tile — which means carrying no media
  // path at all, so no request is ever issued for it.
  const bogus = EXERCISE_LIBRARY.filter(e => e.media !== undefined && e.media !== null && !mapped.includes(e));
  assert(bogus.length === 0, "unmapped exercises carry no media path", bogus.map(e => e.id).join(", "));

  /* The detail page lays each illustration on a field of its own paper colour,
     so a missing or malformed value puts the artwork back on a mismatched
     rectangle. That the colour is the *right* one is checked against the pixels
     themselves in test/simulation.mjs, which has a decoder. */
  const badBg = mapped.filter(e => !/^#[0-9a-f]{6}$/.test(String(e.mediaBg)));
  assert(badBg.length === 0, "every illustration carries a #rrggbb field colour",
    badBg.map(e => `${e.id} → ${e.mediaBg}`).join(", "));

  const strayBg = EXERCISE_LIBRARY.filter(e => !e.media && e.mediaBg != null);
  assert(strayBg.length === 0, "exercises without artwork carry no field colour",
    strayBg.map(e => e.id).join(", "));

  const sampled = JSON.parse(readFileSync(join(ROOT, "tools", "exercise-media-bg.json"), "utf8"));
  const drifted = mapped.filter(e => sampled[e.id] !== e.mediaBg);
  assert(drifted.length === 0 && Object.keys(sampled).length === mapped.length,
    "generated field colours match tools/exercise-media-bg.json",
    drifted.map(e => `${e.id}: ${e.mediaBg} vs ${sampled[e.id]}`).join(", ") ||
      `${Object.keys(sampled).length} sampled vs ${mapped.length} mapped`);
}

{
  // Offline: the shell has to carry the artwork, or an installed app shows
  // empty tiles for the 96 the moment it loses connectivity.
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const mapped = EXERCISE_LIBRARY.filter(e => e.media);
  const uncached = mapped.filter(e => !sw.includes(`./${e.media}`));
  assert(uncached.length === 0, "every illustration is precached by the service worker",
    uncached.map(e => e.id).join(", "));
}

{
  // A navigation is network-first, but an older worker can still answer its
  // unversioned script requests from an older cache. The two files that define
  // the shared envelope must carry the current cache revision in index.html so
  // the first v2 link bypasses a v1-only worker, and the new worker must precache
  // those exact URLs for the next offline launch.
  const index = readFileSync(join(ROOT, "index.html"), "utf8");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const revision = sw.match(/const CACHE = "repforge-v(\d+)"/)?.[1] || "";
  const transitionAssets = ["shared-setup.js", "app.js"];
  const missingRevision = transitionAssets.filter(file => !index.includes(`src="${file}?v=${revision}"`));
  const missingCache = transitionAssets.filter(file => !sw.includes(`"./${file}?v=${revision}"`));
  assert(!!revision && missingRevision.length === 0,
    "shared envelope scripts use the current cache revision in index.html",
    missingRevision.join(", "));
  assert(missingCache.length === 0,
    "revisioned shared envelope scripts are precached for offline launch",
    missingCache.join(", "));
  assert(index.includes('src="program-compiler.js"') && sw.includes('"./program-compiler.js"'),
    "the program compiler is loaded and precached");
  assert(/SHELL = new Set\([^\n]+"\/program-compiler\.js"/.test(sw),
    "the program compiler is part of the offline shell");
  assert(/registration\.scope/.test(sw) && /SCOPE_PATH/.test(sw),
    "service-worker shell matching is relative to its production scope");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
