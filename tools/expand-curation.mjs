#!/usr/bin/env node
/* Expands tools/exercise-curation.json to the whole upstream dataset.

   The curation file started as a hand-reviewed subset: 266 upstream rows plus
   4 native entries. This walks the rest of the dataset and appends a record for
   every row Taurifer can actually represent, so the picker and the full library
   carry the corpus rather than a slice of it. Existing records are never
   touched, reordered or repointed — a library id in somebody's saved program
   has to keep meaning the same movement forever.

   Usage:
     node tools/expand-curation.mjs --src /path/to/exercises-dataset
     node tools/expand-curation.mjs --src ... --dry            # report only
     node tools/expand-curation.mjs --src ... --with-patterns  # see below

   Then regenerate the library:
     node tools/build-exercises.mjs --src /path/to/exercises-dataset

   Source dataset: https://github.com/hasaneyldrm/exercises-dataset (MIT for the
   data). Its images/ and videos/ are NOT MIT — they belong to Gym visual and
   are licensed to that repository alone, so nothing here reads or ships media.

   ## What an appended record looks like, and why

   Appended records carry `patterns: []` and spell out `primary`/`secondary`
   themselves. That is deliberate, and it is the one place this script declines
   to be clever:

   `patterns` is not a description of a movement — it is the pool the onboarding
   wizard draws a program from, and the first pattern is what overrides the
   upstream `target` field. Machine-classifying a thousand rows into those pools
   would put "assisted lying glutes stretch" in somebody's hinge slot, and
   because `rotateCatalog` in app.js rotates a slot's pool by day-type
   occurrence modulo its length, growing a pool silently changes which exercise
   an existing set of onboarding answers generates. So the reviewed 270 stay the
   programming set, and everything appended here is catalogue: searchable,
   filterable by muscle and equipment, and addable to any day by hand — just not
   auto-programmed.

   `--with-patterns` reverses that: it runs the classifier in PATTERN_RULES
   below and writes the pattern it finds. Use it only with the consequence
   above in hand, and re-run the browser suites after.

   ## What gets left out

   Two kinds of row cannot be appended, and both are written to
   exercise-curation-excluded.json with a reason rather than dropped silently:

   - **No Taurifer muscle at all.** A row whose upstream target is a muscle
     Taurifer does not model — "cardiovascular system" on a burpee, "serratus
     anterior" on a scapular push-up — is rescued by promoting the first
     modelled muscle further down its own list, because that is a real muscle
     rather than an invented token. Only a row where nothing maps is dropped.
   - **The same movement twice.** The upstream set carries one movement under
     several names — "v. 2" variants, "(male)"/"(female)" pairs, camera-angle
     "(back pov)" splits, and word-order spellings like "chest press machine"
     against "machine chest press". NAME_FIXES collapses the first three;
     nameKey below collapses the fourth. test/exercise-library.mjs holds the
     line that no two entries share a display name, because a picker full of
     identical rows is worse than a smaller picker. Reviewed records win
     outright, and among the rest the lowest upstream id wins. */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanName, musclesFrom, equipmentFrom, PATTERN_MUSCLES } from "./exercise-vocabulary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const arg = name => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const has = name => process.argv.includes(name);

/* Appended movements sort behind every reviewed one. catalogForSlot and
   renderLibraryBrowse both sort on rank before name, so this keeps the
   staples leading their slot and the reviewed library leading the browse. */
const APPENDED_RANK = 90;

/* Only read under --with-patterns. First match wins, and the pattern it names
   has to exist in PATTERN_MUSCLES or the build will refuse the record. Ordered
   most specific first: "incline bench press" must reach incline_press before
   the bare /press/ rule sees it. */
const PATTERN_RULES = [
  [/\b(back|front|hack|goblet|split|sissy|zercher|jefferson|box|pistol|cossack|curtsey|sumo)?\s*squat\b/i, "squat"],
  [/\bleg press\b/i, "squat"],
  [/\blunge|step-?up\b/i, "squat"],
  [/\b(romanian|stiff.leg|straight.leg|sumo|trap bar|single leg)?\s*deadlift\b/i, "hinge"],
  [/\bgood morning|hip thrust|glute bridge|hip extension|rack pull|pull through|swing|clean|snatch\b/i, "hinge"],
  [/\bleg extension\b/i, "leg_extension"],
  [/\bleg curl|glute-?ham raise|lying femoral\b/i, "leg_curl"],
  [/\bcalf raise|calf press|calves\b/i, "calves"],
  [/\bincline\b.*\b(press|push-?up)\b/i, "incline_press"],
  [/\b(bench|chest|floor|pin|decline|close.grip|guillotine)\s*press\b|\bpush-?up\b|\bdip\b/i, "press"],
  [/\b(fly|flyes|pec deck|crossover|cross-over|pullover|squeeze)\b/i, "chest_iso"],
  [/\b(shoulder|overhead|military|push|arnold|bradford|scott|cuban|z|landmine)\s*press\b|\bthruster|jerk\b/i, "shoulder_press"],
  [/\blateral raise|side raise\b/i, "lateral_raise"],
  [/\brear (delt|deltoid)|reverse fly|reverse pec|face pull\b/i, "rear_delt"],
  [/\bfront raise|y-?raise|t-?raise|upright row\b/i, "delts"],
  [/\bpulldown|pull-?down\b/i, "pulldown"],
  [/\bpull-?up|chin-?up|muscle up\b/i, "pull"],
  [/\brow\b/i, "row"],
  [/\bshrug\b/i, "traps"],
  [/\bwrist curl|wrist extension|finger curl|gripper|forearm\b/i, "forearms"],
  [/\bcurl\b/i, "curl"],
  [/\b(triceps|tricep)\b|\bpushdown|pressdown|kickback|skull ?crusher\b/i, "triceps"],
  [/\bhip adduction|adductor\b/i, "adduction"],
  [/\bhip abduction|abductor\b/i, "abduction"],
  [/\bcrunch|sit-?up|plank|leg raise|knee raise|russian twist|rollerout|side bend|v-?up|dead bug|hollow\b/i, "abs"]
];

function patternFor(name) {
  for (const [re, pattern] of PATTERN_RULES)
    if (re.test(name) && PATTERN_MUSCLES[pattern]) return pattern;
  return null;
}

/* ---------- build ------------------------------------------------------ */

const srcRoot = arg("--src");
if (!srcRoot) {
  console.error("usage: node tools/expand-curation.mjs --src /path/to/exercises-dataset");
  process.exit(2);
}
const withPatterns = has("--with-patterns");

const curationPath = join(HERE, "exercise-curation.json");
const overridesPath = join(HERE, "exercise-name-overrides.json");
const excludedPath = join(HERE, "exercise-curation-excluded.json");
const curation = JSON.parse(readFileSync(curationPath, "utf8"));
/* Hand-written Portuguese for the appended movements the phrase tables compose
   onto a name another movement already has. Reviewed movements are not in here
   and must not be: their names are what the app ships. */
const overrides = JSON.parse(readFileSync(overridesPath, "utf8")).namePt || {};
const rows = JSON.parse(readFileSync(join(resolve(srcRoot), "data", "exercises.json"), "utf8"));

const takenIds = new Set(curation.map(r => r.id));
const takenSrc = new Set(curation.filter(r => r.src).map(r => r.src));
const byId = new Map(rows.map(r => [r.id, r]));

/* Two spellings of one movement. The upstream set names the same machine
   press four ways — "chest press machine", "machine chest press",
   "push up on bosu ball", "push-up (bosu ball)" — and comparing display names
   catches none of them. Comparing the bag of meaningful words does: same
   words in any order, hyphenated or not, is the same movement. Ordering and
   filler words are all that differ, and neither is a movement. */
const FILLER = new Set(["on", "in", "with", "the", "a", "an", "to", "of", "at", "off", "from"]);
const nameKey = name => String(name).toLowerCase()
  .replace(/[()]/g, " ").replace(/[-/]/g, " ").replace(/[^a-z0-9°\s]/g, "")
  .split(/\s+/).filter(w => w && !FILLER.has(w)).sort().join(" ");

/* Display names already spoken for. Reviewed records win outright — they are
   what the app ships today — and among the rest the lowest upstream id wins,
   which is stable across dataset updates in a way "first seen" is not. */
const takenNames = new Set();
const takenKeys = new Set();
for (const record of curation) {
  const row = record.src ? byId.get(record.src.replace(/^exdb:/, "")) : null;
  const name = record.name || (row ? cleanName(row.name) : null);
  if (!name) continue;
  takenNames.add(name.toLowerCase());
  takenKeys.add(nameKey(name));
}

/* Overrides are re-applied to records this script appended on an earlier run,
   not only to new ones — otherwise adding a translation would mean rebuilding
   the whole curation file from scratch to see it. Reviewed records are left
   alone: they carry their own namePt, by hand, and this file is not the place
   to move it. */
let resynced = 0;
for (const record of curation) {
  if (!record._auto || !overrides[record.id]) continue;
  if (record.namePt === overrides[record.id]) continue;
  record.namePt = overrides[record.id];
  resynced++;
}

const appended = [];
const excluded = [];
const promoted = [];
const remaining = rows
  .filter(r => !takenSrc.has(`exdb:${r.id}`))
  .sort((a, b) => a.id.localeCompare(b.id));

for (const row of remaining) {
  const src = `exdb:${row.id}`;
  const name = cleanName(row.name);

  const equipment = equipmentFrom(row);
  if (!equipment) {
    excluded.push({ src, name, reason: "unmapped equipment", detail: row.equipment });
    continue;
  }

  const muscles = musclesFrom(row, name);
  let { primary, secondary } = muscles;
  if (!primary) {
    /* The upstream target is a muscle Taurifer does not model — "cardiovascular
       system" on a burpee, "serratus anterior" on a scapular push-up. The row
       still names muscles Taurifer does model, further down its own list, so
       promote the first of those rather than drop a real movement. This is not
       the same as inventing a token: every value here is already one of the
       nineteen the audit groups by. Where nothing at all maps, the row is
       genuinely unrepresentable and gets excluded. */
    const pool = String(secondary || "").split(",").filter(Boolean);
    if (!pool.length) {
      excluded.push({ src, name, reason: "no Taurifer muscle token", detail: row.target });
      continue;
    }
    primary = pool[0];
    secondary = pool.slice(1).join(",");
    promoted.push({ src, name, target: row.target, primary });
  }

  const key = name.toLowerCase();
  if (takenNames.has(key)) {
    excluded.push({ src, name, reason: "duplicate display name" });
    continue;
  }
  const words = nameKey(name);
  if (takenKeys.has(words)) {
    excluded.push({ src, name, reason: "same movement, words reordered", detail: words });
    continue;
  }
  takenNames.add(key);
  takenKeys.add(words);

  /* Stable, collision-proof, and never repointed: the reviewed ids are all
     lowercase mnemonics, so the "x" prefix cannot collide with one, and the
     upstream id it carries is the dataset's own stable key. */
  const id = `x${row.id}`;
  if (takenIds.has(id)) {
    excluded.push({ src, name, reason: "library id already taken", detail: id });
    continue;
  }
  takenIds.add(id);

  const pattern = withPatterns ? patternFor(name) : null;
  const record = { id, src, patterns: pattern ? [pattern] : [], _srcName: row.name, _auto: true };
  if (!pattern) {
    /* No pattern to read a primary muscle off, so the record carries the
       upstream mapping itself. Spelled out rather than left to the build,
       because the build reads primary from patterns[0] and there is none. */
    record.primary = primary;
    record.secondary = secondary;
  }
  if (overrides[id]) record.namePt = overrides[id];
  record.rank = APPENDED_RANK;
  appended.push(record);
}

const strayOverrides = Object.keys(overrides).filter(id =>
  !appended.some(r => r.id === id) && !curation.some(r => r._auto && r.id === id));
if (strayOverrides.length)
  console.error(`warning: exercise-name-overrides.json names ${strayOverrides.length} id(s) ` +
    `no appended record carries: ${strayOverrides.join(", ")}`);

const byReason = {};
for (const e of excluded) byReason[e.reason] = (byReason[e.reason] || 0) + 1;

console.log(`upstream rows          ${rows.length}`);
console.log(`already reviewed       ${takenSrc.size}`);
console.log(`appended               ${appended.length}`);
console.log(`excluded               ${excluded.length}`);
for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1]))
  console.log(`  ${reason.padEnd(28)} ${n}`);
console.log(`library total          ${curation.length + appended.length}`);
if (resynced) console.log(`  (${resynced} earlier record(s) picked up a changed Portuguese override)`);
if (promoted.length)
  console.log(`  (${promoted.length} took their primary muscle from a secondary, ` +
    `because the upstream target is one Taurifer does not model)`);

if (has("--dry")) process.exit(0);

writeFileSync(curationPath, JSON.stringify(curation.concat(appended), null, 1) + "\n");
writeFileSync(excludedPath, JSON.stringify({
  _comment: "Upstream rows tools/expand-curation.mjs could not append, and why. " +
    "Regenerated by that script; see its header for what each reason means.",
  counts: byReason,
  rows: excluded,
  promotedPrimary: promoted
}, null, 1) + "\n");
console.log(`\nwrote tools/exercise-curation.json and tools/exercise-curation-excluded.json`);
