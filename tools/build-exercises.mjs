#!/usr/bin/env node
/* Generates exercises.js — the exercise library Taurifer ships — from the
   reviewed allowlist in exercise-curation.json plus the upstream dataset.

   Nothing here runs in the browser or at install time. The generated file is
   committed, exactly like i18n.js; this script exists so the mapping from the
   upstream vocabulary to Taurifer's stays reviewable and re-runnable when the
   dataset moves.

   Usage:
     node tools/build-exercises.mjs --src /path/to/exercises-dataset
     node tools/build-exercises.mjs --src ... --report   # translation gaps only

   Source dataset: https://github.com/hasaneyldrm/exercises-dataset (MIT for the
   data). Its images/ and videos/ are NOT MIT — they belong to Gym visual and
   are licensed to that repository alone, so nothing here reads or ships media. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanName, translate, residualEnglish, musclesFrom, equipmentFrom,
  beginnerFriendly, PATTERN_MUSCLES
} from "./exercise-vocabulary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/* ---------- helpers ---------------------------------------------------- */
const arg = name => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const has = name => process.argv.includes(name);

/* The only exercises allowed to show artwork. Ninety-six illustrations are
   licensed for this app; the remaining 1,188 movements — built-in or custom —
   render a deliberately empty tile. The upstream dataset's own stills and GIFs
   are not an option: they are Gym visual's, licensed to that repository alone
   (NOTICE.md), so growing the library did not and cannot grow this list. Keyed by stable library id, never by
   display name, locale or filename slug, and validated against the files on
   disk so a regeneration cannot silently ship a broken image request. */
const MEDIA_DIR = "assets/exercises";
const MEDIA_IDS = [
  "ab_cb", "ab_mc", "abc_mc", "abdb_bw", "ablr_bw", "abr_bw", "abrt_bw", "ad_mc",
  "arn_db", "be_mc", "cd_bw", "cf_db", "chn_bw", "ci_cb", "ci_mc", "cu_bb",
  "cu_cb", "cu_db", "cu_ez", "cu_mc", "cuh_db", "cup_bb", "cv_mc", "cvl_mc",
  "cvs_mc", "cx_cb", "dl_bb", "dl_cb", "dlt_bb", "fp_cb", "ghr_bw", "hg_bb",
  "hg_db", "hg_mc", "hg_sm", "hr_mc", "ht_bb", "ht_mc", "hx_bw", "ilc_bw",
  "ip_bb", "ip_db", "ip_mc", "ip_sm", "lc_mc", "lcl_mc", "le_mc", "lg_bb",
  "lg_db", "lp1_mc", "lph_mc", "lr_db", "lr_mc", "pd_bw", "pd_mc", "pl_cb",
  "pl_mc", "pr_bb", "pr_db", "pr_mc", "pr_sm", "pu_bw", "pup_bw", "pupn_bw",
  "pupw_wt", "pv_db", "rd_db", "rd_mc", "rw1_db", "rw_bb", "rw_cb", "rw_db",
  "rw_mc", "sh_bb", "sh_db", "sp_bb", "sp_db", "sp_mc", "sps_db", "sq_bb",
  "sq_db", "sq_lp", "sq_sm", "sqf_bb", "sqk_mc", "ss_bw", "ss_db", "su_db",
  "tb_mc", "tr_cb", "tr_mc", "trd_bw", "tro_cb", "trr_cb", "trs_db", "wc_bb"
];

/* The generator picks the first candidate in a slot's pool, so the pool's order
   decides what a generated program actually contains. These are the movements
   Taurifer programmed before the library existed — the obvious pick for their
   slot — and they stay the obvious pick now that 1,283 movements compete for it.
   Without a rank the pool sorts by id and a beginner's chest slot fills with
   an assisted kneeling dip instead of the chest press machine. */
const STAPLE_IDS = new Set([
  "sq_bb", "sq_sm", "sq_lp", "sq_db", "hg_bb", "hg_sm", "hg_mc", "pr_bb", "pr_db",
  "pr_mc", "ip_db", "ip_mc", "ip_bb", "sp_bb", "sp_mc", "sp_db", "rw_bb", "rw_mc",
  "rw_cb", "pd_mc", "pd_bw", "pl_cb", "pl_mc", "lr_db", "lr_mc", "dl_cb", "rd_mc",
  "rd_db", "ci_mc", "ci_cb", "cu_mc", "cu_db", "cu_cb", "tr_cb", "tr_mc", "lc_mc",
  "le_mc", "cv_mc", "ad_mc", "ab_mc", "lcl_mc", "cvs_mc", "sh_db", "abc_mc", "wc_db"
]);

/* ---------- build ------------------------------------------------------ */

const curation = JSON.parse(readFileSync(join(HERE, "exercise-curation.json"), "utf8"));
const srcRoot = arg("--src");
const dataset = new Map();
if (srcRoot) {
  const rows = JSON.parse(readFileSync(join(resolve(srcRoot), "data", "exercises.json"), "utf8"));
  for (const row of rows) dataset.set(`exdb:${row.id}`, row);
}

const mediaSet = new Set(MEDIA_IDS);
const problems = [];
const gaps = [];
for (const id of MEDIA_IDS)
  if (!existsSync(join(ROOT, MEDIA_DIR, `${id}.webp`)))
    problems.push(`media file missing for ${id}: ${MEDIA_DIR}/${id}.webp`);

/* The paper colour each illustration is drawn on, sampled from the file by
   tools/sample-media-bg.mjs. The exercise detail page lays the artwork on a
   field of this colour so the opaque square dissolves instead of reading as a
   pasted tile; the shipped set spans #E3D4BE to #F4EDE1, so it cannot be one
   constant. Read, never re-derived: Node has no image decoder and the app has
   no dependencies, so re-sampling is a deliberate step. */
const mediaBg = JSON.parse(readFileSync(join(HERE, "exercise-media-bg.json"), "utf8"));
for (const id of MEDIA_IDS) {
  if (!(id in mediaBg))
    problems.push(`no sampled background for ${id} — run: node tools/sample-media-bg.mjs`);
  else if (!/^#[0-9a-f]{6}$/.test(mediaBg[id]))
    problems.push(`background for ${id} is not a #rrggbb colour: ${mediaBg[id]}`);
}
for (const id of Object.keys(mediaBg))
  if (!mediaSet.has(id)) problems.push(`sampled background for ${id}, which carries no artwork`);
const entries = [];
const ids = new Set();

for (const item of curation) {
  if (ids.has(item.id)) { problems.push(`duplicate id ${item.id}`); continue; }
  ids.add(item.id);

  let name, equipment, primary, secondary, notes = item.notes || "";
  if (item.src) {
    const row = dataset.get(item.src);
    if (!row) {
      problems.push(`${item.id}: ${item.src} not in dataset (pass --src to rebuild)`);
      continue;
    }
    name = item.name || cleanName(row.name);
    equipment = equipmentFrom(row);
    if (!equipment) { problems.push(`${item.id}: unmapped equipment "${row.equipment}"`); continue; }
    const m = musclesFrom(row, name);
    for (const u of m.unknowns) problems.push(`${item.id}: unmapped muscle "${u}"`);
    const byPattern = PATTERN_MUSCLES[(item.patterns || [])[0]];
    if (!byPattern && !item.primary) {
      problems.push(`${item.id}: pattern "${(item.patterns || [])[0]}" has no muscle mapping`);
      continue;
    }
    primary = item.primary || byPattern[0];
    if (item.secondary != null) secondary = item.secondary;
    else {
      const allowed = byPattern[1];
      const primaryTokens = primary.split(",");
      // Upstream's own primary is a real muscle worked even when the pattern
      // disagrees about which one leads — a squat it calls glute-primary still
      // trains glutes. Demote it rather than lose it.
      const pool = [...m.primary.split(","), ...m.secondary.split(",")];
      const kept = [];
      for (const x of pool)
        if (x && allowed.includes(x) && !primaryTokens.includes(x) && !kept.includes(x)) kept.push(x);
      secondary = kept.slice(0, 3).join(",");
    }
  } else {
    // Native entry: carries no upstream row, so the curation file is the whole
    // record. These exist to keep movements Taurifer already shipped.
    name = item.name;
    equipment = item.equipment;
    primary = item.primary;
    secondary = item.secondary || "";
    if (!name || !equipment || !primary) { problems.push(`${item.id}: incomplete native entry`); continue; }
  }
  if (!primary) { problems.push(`${item.id}: no primary muscle`); continue; }

  const namePt = item.namePt || translate(name);
  const residual = item.namePt ? [] : residualEnglish(name);
  if (residual.length) gaps.push(`${item.id}  ${name}\n     → ${namePt}   [${residual.join(", ")}]`);

  const entry = {
    id: item.id,
    name,
    namePt,
    equipment,
    primary,
    secondary,
    patterns: item.patterns || [],
    rank: item.rank !== undefined ? item.rank : (STAPLE_IDS.has(item.id) ? 0 : 50),
    media: mediaSet.has(item.id) ? `${MEDIA_DIR}/${item.id}.webp` : null,
    mediaBg: mediaSet.has(item.id) ? mediaBg[item.id] : null,
    beginnerFriendly: item.beginnerFriendly !== undefined
      ? item.beginnerFriendly
      : beginnerFriendly(equipment, name)
  };
  if (notes) entry.notes = notes;
  if (item.src) entry.src = item.src;
  entries.push(entry);
}

if (has("--report")) {
  console.log(`${gaps.length} of ${entries.length} names have untranslated words:\n`);
  for (const g of gaps) console.log("  " + g);
  if (problems.length) {
    console.log(`\n${problems.length} problems:`);
    for (const p of problems) console.log("  " + p);
  }
  process.exit(0);
}

if (problems.length) {
  console.error(`${problems.length} problems — nothing written:`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

for (const id of MEDIA_IDS)
  if (!entries.some(e => e.id === id)) problems.push(`media maps ${id}, which is not in the library`);
if (problems.length) {
  console.error(`${problems.length} problems — nothing written:`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

const line = e => {
  const parts = [
    `id:${JSON.stringify(e.id)}`,
    `name:${JSON.stringify(e.name)}`,
    `namePt:${JSON.stringify(e.namePt)}`,
    `equipment:${JSON.stringify(e.equipment)}`,
    `primary:${JSON.stringify(e.primary)}`,
    `secondary:${JSON.stringify(e.secondary)}`,
    `patterns:${JSON.stringify(e.patterns)}`,
    `rank:${e.rank}`,
    `beginnerFriendly:${e.beginnerFriendly}`
  ];
  if (e.media) parts.push(`media:${JSON.stringify(e.media)}`);
  if (e.mediaBg) parts.push(`mediaBg:${JSON.stringify(e.mediaBg)}`);
  if (e.notes) parts.push(`notes:${JSON.stringify(e.notes)}`);
  if (e.src) parts.push(`src:${JSON.stringify(e.src)}`);
  return "  {" + parts.join(",") + "}";
};

const out = `/* Taurifer exercise library — GENERATED by tools/build-exercises.mjs.
   Do not edit by hand: edit tools/exercise-curation.json and regenerate.

   Movement data derives from https://github.com/hasaneyldrm/exercises-dataset
   (MIT). That project's exercise media is licensed separately and is not used
   here. See NOTICE.md.

   ${entries.length} movements. Equipment, muscle tokens and movement patterns are
   Taurifer's own vocabulary — the audit groups hard sets by the exact muscle
   strings below, so they are a contract, not free text. */
(function(){
"use strict";
const EXERCISE_LIBRARY = [
${entries.map(line).join(",\n")}
];

/* Ids that used to name a movement Taurifer now stores under a single entry.
   Programs generated before the merge still carry them in libraryId. */
const LEGACY_LIBRARY_IDS = {dl_mc:"lr_mc",dl_db:"lr_db",ar_mc:"cu_mc",ar_db:"cu_db"};

/* Scoped so these names stay out of the global script scope app.js shares with
   every other classic script — only the namespace below is exported. */
if (typeof window !== "undefined") {
  window.RepForgeExercises = {library: EXERCISE_LIBRARY, legacyIds: LEGACY_LIBRARY_IDS};
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS};
}
})();
`;

writeFileSync(join(ROOT, "exercises.js"), out);
console.log(`exercises.js — ${entries.length} movements` +
  (gaps.length ? `, ${gaps.length} names still holding English words (run --report)` : ""));
