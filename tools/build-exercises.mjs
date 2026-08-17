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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/* ---------- Taurifer's vocabularies ----------------------------------- */

/* Equipment the onboarding wizard can filter on. "smith" implies "machine"
   so a machines-only lifter still gets Smith work. */
const EQUIPMENT = {
  "barbell": ["barbell"],
  "olympic barbell": ["barbell"],
  "ez barbell": ["barbell"],
  "trap bar": ["barbell"],
  "dumbbell": ["dumbbell"],
  "kettlebell": ["dumbbell"],
  "cable": ["cable"],
  "leverage machine": ["machine"],
  "sled machine": ["machine"],
  "assisted": ["machine"],
  "smith machine": ["smith", "machine"],
  "body weight": ["bodyweight"],
  "weighted": ["bodyweight"],
  "band": ["bodyweight"],
  "resistance band": ["bodyweight"]
};

/* Upstream muscle names → the tokens Taurifer's volume audit groups by. The
   upstream vocabulary carries synonyms (quads/quadriceps, traps/trapezius,
   lats/latissimus dorsi) that have to collapse, or the audit splits one muscle
   across two rows. Anything mapping to null is dropped as noise rather than
   invented into a token. */
const MUSCLES = {
  "pectorals": "Chest", "chest": "Chest", "upper chest": "Chest",
  "biceps": "Biceps", "brachialis": "Biceps",
  "triceps": "Triceps",
  "lats": "Lats", "latissimus dorsi": "Lats",
  "upper back": "Mid/upper back", "rhomboids": "Mid/upper back", "back": "Mid/upper back",
  "traps": "Traps", "trapezius": "Traps",
  "quads": "Quads", "quadriceps": "Quads",
  "hamstrings": "Hamstrings",
  "glutes": "Glutes",
  "calves": "Calves", "soleus": "Calves",
  "adductors": "Adductors", "inner thighs": "Adductors", "groin": "Adductors",
  "abductors": "Abductors",
  "abs": "Abs", "abdominals": "Abs", "core": "Abs", "lower abs": "Abs",
  "obliques": "Obliques",
  "spine": "Spinal erectors", "lower back": "Spinal erectors",
  "forearms": "Forearms", "wrist flexors": "Forearms", "wrist extensors": "Forearms",
  "grip muscles": "Forearms", "hands": "Forearms", "wrists": "Forearms",
  "rear deltoids": "Rear delts",
  // Undifferentiated in the source; split by movement below.
  "delts": null, "deltoids": null, "shoulders": null,
  // Not modelled by Taurifer — dropping beats inventing a token the audit
  // would then have to render.
  "hip flexors": null, "serratus anterior": null, "rotator cuff": null,
  "levator scapulae": null, "cardiovascular system": null, "ankles": null,
  "ankle stabilizers": null, "feet": null, "shins": null,
  "sternocleidomastoid": null
};

/* The source tags every shoulder movement "delts" without saying which head,
   but hard-set volume per head is exactly what a hypertrophy audit is for.
   Resolved from the movement name; first match wins. */
const DELT_HEAD = [
  [/rear|reverse fly|reverse pec|rear delt|bent.over lateral|incline rear/i, "Rear delts"],
  [/lateral raise|side raise|upright row|lateral to front/i, "Side delts"],
  [/front raise|forward raise|shoulder raise/i, "Front delts"],
  [/press|push press|jerk|thruster|arnold/i, "Front delts"]
];

/* Movement-name repairs. The upstream names are lowercase, carry a few
   mojibake artifacts and typos, and tag some rows with the model's sex. */
const NAME_FIXES = [
  [/в°/g, "°"],
  [/\s*\((?:male|female)\)\s*/gi, " "],
  [/\s*v\.\s*\d+\s*$/i, ""],
  [/\brevers\b/gi, "reverse"],
  [/\bpeacher\b/gi, "preacher"],
  [/\bsitted\b/gi, "seated"],
  [/\bcalves\b(?=\s+(?:raise|press))/gi, "calf"],
  [/\bdumbbells\b/gi, "dumbbell"],
  [/\bstanding leg calf raise\b/gi, "standing calf raise"],
  [/_shoulder\b/gi, ""],
  // "Lever" and "Sled" are the source's words for plate-loaded and sled-based
  // machines; lifters read them as machines.
  [/^lever\s+/i, "machine "],
  [/^sled\s+/i, "machine "],
  [/^smith\s+(?!machine)/i, "smith machine "],
  [/^ez[-\s]?bar(bell)?\s+/i, "EZ-bar "],
  [/\barnold\b/g, "Arnold"],
  [/\s{2,}/g, " "]
];

/* The pattern a movement was curated into is the authority on what it trains.
   The upstream target field disagrees often enough to matter — it calls every
   squat and Romanian deadlift a glute exercise — and its secondary lists run
   to noise (front delts on a calf raise). So primary comes from the pattern,
   and upstream secondaries are kept only where they are plausible for it. */
const PATTERN_MUSCLES = {
  squat: ["Quads", ["Glutes", "Adductors", "Hamstrings", "Spinal erectors", "Calves"]],
  hinge: ["Hamstrings,Glutes", ["Spinal erectors", "Quads", "Traps", "Forearms"]],
  leg_extension: ["Quads", []],
  leg_curl: ["Hamstrings", ["Glutes", "Calves"]],
  calves: ["Calves", []],
  press: ["Chest", ["Front delts", "Triceps"]],
  incline_press: ["Chest", ["Front delts", "Triceps"]],
  chest_iso: ["Chest", ["Front delts"]],
  shoulder_press: ["Front delts", ["Side delts", "Triceps", "Mid/upper back"]],
  lateral_raise: ["Side delts", ["Front delts", "Traps"]],
  delts: ["Side delts", ["Front delts", "Traps", "Rear delts"]],
  rear_delt: ["Rear delts", ["Mid/upper back", "Traps", "Biceps"]],
  row: ["Mid/upper back", ["Lats", "Rear delts", "Biceps", "Forearms", "Traps"]],
  pulldown: ["Lats", ["Mid/upper back", "Biceps", "Rear delts", "Forearms"]],
  pull: ["Lats", ["Mid/upper back", "Chest", "Triceps"]],
  traps: ["Traps", ["Mid/upper back", "Forearms"]],
  curl: ["Biceps", ["Forearms"]],
  arms: ["Biceps", ["Forearms"]],
  triceps: ["Triceps", ["Chest", "Front delts"]],
  adduction: ["Adductors", ["Glutes"]],
  abduction: ["Abductors", ["Glutes"]],
  abs: ["Abs", ["Obliques", "Spinal erectors"]],
  forearms: ["Forearms", []]
};

/* Portuguese. Exercise names are compositional in both languages, but they
   compose in opposite orders: English stacks qualifiers in front of the
   movement ("dumbbell seated shoulder press"), Portuguese trails them behind
   it ("desenvolvimento sentado com halteres"). So each phrase carries a role,
   matches are collected longest-first, and the name is reassembled in
   Portuguese order — core, qualifiers, equipment, grip. Whatever the table
   misses gets a namePt override in the curation file; --report lists those. */
const CORE = "core", QUAL = "qual", EQUIP = "equip", GRIP = "grip";
const PT_CORES = [
  ["romanian deadlift", "levantamento terra romeno"],
  ["straight leg deadlift", "levantamento terra pernas retas"],
  ["stiff leg deadlift", "levantamento terra pernas semirrígidas"],
  ["single leg deadlift", "levantamento terra unilateral"],
  ["sumo deadlift", "levantamento terra sumô"],
  ["deadlift", "levantamento terra"],
  ["close-grip bench press", "supino fechado"],
  ["close grip bench press", "supino fechado"],
  ["guillotine bench press", "supino guilhotina"],
  ["bench press", "supino"],
  ["incline press", "supino inclinado"],
  ["decline press", "supino declinado"],
  ["chest press", "supino máquina"],
  ["inner chest press", "supino máquina pegada fechada"],
  ["overhead press", "desenvolvimento"],
  ["military press", "desenvolvimento militar"],
  ["shoulder press", "desenvolvimento"],
  ["arnold press", "desenvolvimento Arnold"],
  ["push press", "desenvolvimento com impulso"],
  ["close-grip press", "supino fechado"],
  ["push-up", "flexão de braço"],
  ["push up", "flexão de braço"],
  ["diamond push-up", "flexão diamante"],
  ["handstand push-up", "flexão parada de mão"],
  ["chest dip", "mergulho nas paralelas"],
  ["triceps dip", "mergulho de tríceps"],
  ["overhand triceps dip", "mergulho de tríceps pronado"],
  ["seated dip", "mergulho sentado"],
  ["bench dip", "mergulho no banco"],
  ["dip", "mergulho"],
  ["pec deck", "peck deck"],
  ["crossover", "crossover"],
  ["cross-over", "crossover"],
  ["reverse fly", "crucifixo inverso"],
  ["rear delt fly", "crucifixo inverso"],
  ["rear delt raise", "elevação posterior"],
  ["rear lateral raise", "elevação posterior"],
  ["rear delt row", "remada alta posterior"],
  ["fly", "crucifixo"],
  ["pullover", "pullover"],
  ["lat pulldown", "puxada frontal"],
  ["lateral pulldown", "puxada frontal"],
  ["front pulldown", "puxada frontal"],
  ["underhand pulldown", "puxada supinada"],
  ["straight arm pulldown", "pulldown com braços estendidos"],
  ["pulldown", "puxada"],
  ["pull-up", "barra fixa"],
  ["pull up", "barra fixa"],
  ["chin-up", "barra fixa supinada"],
  ["chin up", "barra fixa supinada"],
  ["scapular pull-up", "barra fixa escapular"],
  ["inverted row", "remada invertida"],
  ["suspended row", "remada suspensa"],
  ["upright row", "remada alta"],
  ["bent over row", "remada curvada"],
  ["bent-over row", "remada curvada"],
  ["pendlay row", "remada Pendlay"],
  ["seated row", "remada sentada"],
  ["high row", "remada alta"],
  ["t-bar row", "remada cavalinho"],
  ["t bar row", "remada cavalinho"],
  ["row", "remada"],
  ["shrug", "encolhimento"],
  ["gripless shrug", "encolhimento sem pegada"],
  ["preacher curl", "rosca scott"],
  ["hammer curl", "rosca martelo"],
  ["concentration curl", "rosca concentrada"],
  ["spider curl", "rosca spider"],
  ["drag curl", "rosca drag"],
  ["zottman curl", "rosca Zottman"],
  ["reverse curl", "rosca inversa"],
  ["reverse wrist curl", "rosca de punho inversa"],
  ["wrist curl", "rosca de punho"],
  ["finger curls", "rosca de dedos"],
  ["biceps curl", "rosca direta"],
  ["bicep curl", "rosca direta"],
  ["curl", "rosca"],
  ["skull crusher", "tríceps testa"],
  ["skullcrusher", "tríceps testa"],
  ["lying triceps extension", "tríceps testa"],
  ["overhead triceps extension", "tríceps francês"],
  ["triceps extension", "extensão de tríceps"],
  ["tricep extension", "extensão de tríceps"],
  ["triceps pushdown", "tríceps na polia"],
  ["pushdown", "tríceps na polia"],
  ["pressdown", "tríceps na polia"],
  ["kickback", "tríceps coice"],
  ["lateral raise", "elevação lateral"],
  ["full can lateral raise", "elevação lateral full can"],
  ["front raise", "elevação frontal"],
  ["back squat", "agachamento livre"],
  ["front squat", "agachamento frontal"],
  ["high bar squat", "agachamento barra alta"],
  ["low bar squat", "agachamento barra baixa"],
  ["hack squat", "agachamento hack"],
  ["goblet squat", "agachamento goblet"],
  ["split squat", "agachamento búlgaro"],
  ["split squats", "agachamento búlgaro"],
  ["sissy squat", "agachamento sissy"],
  ["zercher squat", "agachamento Zercher"],
  ["chair squat", "agachamento na cadeira"],
  ["full squat", "agachamento completo"],
  ["squat", "agachamento"],
  ["one leg press", "leg press unilateral"],
  ["leg press", "leg press"],
  ["leg extension", "cadeira extensora"],
  ["seated leg curl", "cadeira flexora"],
  ["lying leg curl", "mesa flexora"],
  ["lying two-one leg curl", "mesa flexora excêntrica"],
  ["kneeling leg curl", "flexora ajoelhado"],
  ["inverse leg curl", "flexora nórdica"],
  ["glute-ham raise", "elevação glúteo-femoral"],
  ["lying femoral", "mesa flexora"],
  ["leg curl", "flexora"],
  ["good morning", "bom dia"],
  ["glute bridge", "elevação pélvica"],
  ["hip extension", "extensão de quadril"],
  ["hip adduction", "cadeira adutora"],
  ["hip abduction", "cadeira abdutora"],
  ["hip thrust", "elevação pélvica"],
  ["reverse hyperextension", "hiperextensão inversa"],
  ["hyperextension", "hiperextensão"],
  ["back extension", "extensão lombar"],
  ["rack pull", "rack pull"],
  ["pull through", "pull through"],
  ["swing", "swing"],
  ["lunge", "afundo"],
  ["step-up", "subida no banco"],
  ["step up", "subida no banco"],
  ["calf raise", "elevação de panturrilha"],
  ["calf press", "panturrilha no leg press"],
  ["donkey calf raise", "panturrilha burrinho"],
  ["reverse calf raises", "elevação de ponta de pé"],
  ["toe raise", "elevação de ponta de pé"],
  ["reverse crunch", "abdominal invertido"],
  ["crunch", "abdominal"],
  ["leg raise crunch", "abdominal com elevação de pernas"],
  ["sit-up", "abdominal completo"],
  ["russian twist", "abdominal russo"],
  ["leg-hip raise", "elevação de pernas e quadril"],
  ["leg hip raise", "elevação de pernas e quadril"],
  ["leg raise", "elevação de pernas"],
  ["knee raise", "elevação de joelhos"],
  ["side bend", "flexão lateral de tronco"],
  ["dead bug", "dead bug"],
  ["front plank", "prancha frontal"],
  ["plank", "prancha"],
  ["twist", "rotação de tronco"],
  ["gripper hands", "aparelho de pegada"]
];

/* Position, laterality and variation. These trail the movement in Portuguese. */
const PT_QUALS = [
  ["one arm", "unilateral"],
  ["single arm", "unilateral"],
  ["single leg", "unilateral"],
  ["single-leg", "unilateral"],
  ["one leg", "unilateral"],
  ["one hand", "unilateral"],
  ["unilateral", "unilateral"],
  ["alternate", "alternado"],
  ["alternating", "alternado"],
  ["standing", "em pé"],
  ["seated", "sentado"],
  ["lying", "deitado"],
  ["kneeling", "ajoelhado"],
  ["incline", "inclinado"],
  ["decline", "declinado"],
  ["prone", "de bruços"],
  ["supine", "em supino"],
  ["hanging", "na barra"],
  ["bent knee", "joelhos flexionados"],
  ["knees bent", "joelhos flexionados"],
  ["bent over", "curvado"],
  ["bent-over", "curvado"],
  ["overhead", "acima da cabeça"],
  ["cross body", "cruzado"],
  ["straight", "pernas retas"],
  ["oblique", "oblíquo"],
  ["reverse", "inverso"],
  ["horizontal", "horizontal"],
  ["vertical", "vertical"],
  ["floor", "no chão"],
  ["bench", "no banco"],
  ["bench support", "apoiado no banco"],
  ["on floor", "no chão"],
  ["inner", "interno"],
  ["front", "frontal"],
  ["side", "lateral"],
  ["rear", "posterior"],
  ["low", "baixo"],
  ["middle", "médio"],
  ["high", "alto"],
  ["wide", "aberto"],
  ["narrow", "fechado"],
  ["hack", "no hack"],
  ["45 degrees", "45°"],
  ["45°", "45°"]
];

/* Equipment lands just before grip in Portuguese naming. */
const PT_EQUIP = [
  ["ez barbell", "com barra W"],
  ["ez bar", "com barra W"],
  ["ez-bar", "com barra W"],
  ["olympic barbell", "com barra olímpica"],
  ["trap bar", "com barra hexagonal"],
  ["barbell", "com barra"],
  ["dumbbell", "com halteres"],
  ["kettlebell", "com kettlebell"],
  ["cable", "na polia"],
  ["smith machine", "no Smith"],
  ["smith", "no Smith"],
  ["lever", "na máquina"],
  ["machine", "na máquina"],
  ["sled", "no leg press"],
  ["assisted", "assistido"],
  ["weighted", "com carga"],
  ["bodyweight", "peso corporal"],
  ["body weight", "peso corporal"],
  ["landmine", "no landmine"],
  ["suspended", "no suspensório"]
];

/* Grip and attachment qualifiers close the Portuguese name. */
const PT_GRIP = [
  ["with rope attachment", "com corda"],
  ["rope attachment", "com corda"],
  ["with rope", "com corda"],
  ["rope", "com corda"],
  ["v-bar", "com barra V"],
  ["v bar", "com barra V"],
  ["pro lat bar", "com barra de puxada"],
  ["close-grip", "pegada fechada"],
  ["close grip", "pegada fechada"],
  ["narrow grip", "pegada fechada"],
  ["narrow parallel grip", "pegada neutra fechada"],
  ["wide-grip", "pegada aberta"],
  ["wide grip", "pegada aberta"],
  ["wide hand", "pegada aberta"],
  ["reverse grip", "pegada supinada"],
  ["reverse-grip", "pegada supinada"],
  ["underhand", "pegada supinada"],
  ["neutral grip", "pegada neutra"],
  ["neutral-grip", "pegada neutra"],
  ["parallel grip", "pegada neutra"],
  ["hammer grip", "pegada neutra"],
  ["palm up", "palmas para cima"],
  ["palms up", "palmas para cima"]
];

const PT_TABLE = [
  ...PT_CORES.map(([en, pt]) => [en, pt, CORE]),
  ...PT_QUALS.map(([en, pt]) => [en, pt, QUAL]),
  ...PT_EQUIP.map(([en, pt]) => [en, pt, EQUIP]),
  ...PT_GRIP.map(([en, pt]) => [en, pt, GRIP])
].sort((a, b) => b[0].length - a[0].length);

/* ---------- helpers ---------------------------------------------------- */

const arg = name => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const has = name => process.argv.includes(name);

function cleanName(raw) {
  let s = String(raw || "");
  for (const [re, to] of NAME_FIXES) s = s.replace(re, to);
  s = s.trim().replace(/\s*\(\s*\)\s*/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Matches are consumed off a working copy so a phrase is never translated
   twice, then emitted in Portuguese order rather than the English one. */
function translateParts(english) {
  let work = " " + english.toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim() + " ";
  const found = {[CORE]: [], [QUAL]: [], [EQUIP]: [], [GRIP]: []};
  for (const [en, pt, role] of PT_TABLE) {
    const needle = " " + en + " ";
    if (!work.includes(needle)) continue;
    // A core is the head of the name: only the first one counts.
    const slot = role === CORE && found[CORE].length ? QUAL : role;
    while (work.includes(needle)) work = work.replace(needle, " ");
    if (!found[slot].includes(pt)) found[slot].push(pt);
  }
  const leftover = work.trim().split(/\s+/).filter(Boolean);
  return {found, leftover};
}

function translate(english) {
  const {found} = translateParts(english);
  // "Chest press machine" already says machine in its core; appending the
  // equipment again gives "supino máquina na máquina".
  const core = found[CORE].join(" ");
  const equip = found[EQUIP].filter(pt => {
    const head = pt.replace(/^(com|na|no)\s+/, "");
    return !core.includes(head);
  });
  const words = [...found[CORE], ...found[QUAL], ...equip, ...found[GRIP]];
  const s = words.join(" ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* English the table did not account for. Drives --report so every namePt
   override in the curation file is there for a reason. */
function residualEnglish(english) {
  const {found, leftover} = translateParts(english);
  const skip = new Set(["with", "the", "on", "to", "and", "of", "a", "in", "for", "at", "v"]);
  const words = leftover.filter(w => !skip.has(w) && /^[a-z°-]+$/.test(w) && w.length > 1);
  if (!found[CORE].length) words.unshift("<no core match>");
  return words;
}

function musclesFrom(row, name) {
  const seen = [];
  const push = token => { if (token && !seen.includes(token)) seen.push(token); };
  const resolve = raw => {
    const key = String(raw || "").trim().toLowerCase();
    if (!(key in MUSCLES)) return { unknown: key };
    const mapped = MUSCLES[key];
    if (mapped) return { token: mapped };
    // Undifferentiated shoulder tag — read the head off the movement.
    for (const [re, head] of DELT_HEAD) if (re.test(name)) return { token: head };
    return { token: "Front delts" };
  };

  const unknowns = [];
  const primary = resolve(row.target);
  if (primary.unknown) unknowns.push(primary.unknown); else push(primary.token);
  const primaryTokens = [...seen];

  const secondary = [];
  for (const raw of [row.muscle_group, ...(row.secondary_muscles || [])]) {
    const r = resolve(raw);
    if (r.unknown) { unknowns.push(r.unknown); continue; }
    if (primaryTokens.includes(r.token) || secondary.includes(r.token)) continue;
    secondary.push(r.token);
  }
  return { primary: primaryTokens.join(","), secondary: secondary.slice(0, 4).join(","), unknowns };
}

function equipmentFrom(row) {
  const eq = EQUIPMENT[String(row.equipment || "").toLowerCase()];
  return eq ? [...eq] : null;
}

/* The only exercises allowed to show artwork. Ninety-six illustrations are
   licensed for this app; the remaining 174 movements — built-in or custom —
   render a deliberately empty tile. Keyed by stable library id, never by
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
   slot — and they stay the obvious pick now that 267 movements compete for it.
   Without a rank the pool sorts by id and a beginner's chest slot fills with
   an assisted kneeling dip instead of the chest press machine. */
const STAPLE_IDS = new Set([
  "sq_bb", "sq_sm", "sq_lp", "sq_db", "hg_bb", "hg_sm", "hg_mc", "pr_bb", "pr_db",
  "pr_mc", "ip_db", "ip_mc", "ip_bb", "sp_bb", "sp_mc", "sp_db", "rw_bb", "rw_mc",
  "rw_cb", "pd_mc", "pd_bw", "pl_cb", "pl_mc", "lr_db", "lr_mc", "dl_cb", "rd_mc",
  "rd_db", "ci_mc", "ci_cb", "cu_mc", "cu_db", "cu_cb", "tr_cb", "tr_mc", "lc_mc",
  "le_mc", "cv_mc", "ad_mc", "ab_mc", "lcl_mc", "cvs_mc", "sh_db", "abc_mc", "wc_db"
]);

/* Free-weight barbell compounds ask more of a novice than a pinned machine
   path does; the wizard uses this to bias beginner programs. */
function beginnerFriendly(equipment, name) {
  if (/barbell|olympic|trap bar/.test(name) && !/preacher|wrist|shrug|curl/i.test(name)) return false;
  if (equipment.includes("machine") || equipment.includes("cable") || equipment.includes("smith")) return true;
  if (/muscle up|planche|pistol|handstand|one arm|single arm|sissy/i.test(name)) return false;
  return true;
}

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
