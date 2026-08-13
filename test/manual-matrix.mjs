#!/usr/bin/env node
/**
 * Deterministic six-cell reset/fixture helper for the Plan 041 manual gate.
 *
 *   node test/manual-matrix.mjs --self-test
 *   node test/manual-matrix.mjs --emit-fixtures /tmp/repforge-launch-041
 *   node test/manual-matrix.mjs --prepare C1 --fixture clean --permission unsupported --headed
 *
 * Dates are offsets from the recorded test date (REPFORGE_TEST_DATE or today).
 * IDs come from the fixed seed. Permission modes are applied through a
 * Playwright init-script / CDP seam; pending resolution controls live on
 * window.__repforgeNotifyHarness and are never part of app rendering.
 */
import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = "repforge-launch-041";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";
const DEFAULT_ORIGIN = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";

const FIXTURE_NAMES = [
  "clean",
  "populated",
  "block-review",
  "local-newer",
  "idb-newer",
  "legacy-divergent",
  "large-history",
  "coaching",
];

const PERMISSIONS = ["native", "unsupported", "default", "denied", "granted", "revoked", "pending"];

const CELLS = {
  C1: {
    id: "C1",
    viewport: { width: 320, height: 568 },
    locale: "en",
    unit: "kg",
    platform: "desktop-chromium",
    headed: true,
    notes: "Desktop Chromium responsive mode; keyboard and 200% browser zoom; notification adapter covers unsupported/default/pending races",
  },
  C2: {
    id: "C2",
    viewport: { width: 390, height: 844 },
    locale: "en",
    unit: "kg",
    platform: "ios-safari",
    headed: false,
    notes: "Physical iOS Safari; real pinch and VoiceOver; native notification prompt where supported",
  },
  C3: {
    id: "C3",
    viewport: { width: 430, height: 932 },
    locale: "en",
    unit: "kg",
    platform: "android-chrome",
    headed: false,
    notes: "Physical Android Chrome; real pinch and TalkBack; native grant then site-settings revocation",
  },
  C4: {
    id: "C4",
    viewport: { width: 320, height: 568 },
    locale: "pt",
    unit: "lb",
    platform: "desktop-chromium",
    headed: true,
    notes: "Desktop Chromium responsive mode; keyboard and 200% browser zoom; notification adapter covers denied/granted/revoked",
  },
  C5: {
    id: "C5",
    viewport: { width: 390, height: 844 },
    locale: "pt",
    unit: "lb",
    platform: "ios-safari",
    headed: false,
    notes: "Physical iOS Safari; real pinch and VoiceOver; native denial/grant or the truthful unsupported state",
  },
  C6: {
    id: "C6",
    viewport: { width: 430, height: 932 },
    locale: "pt",
    unit: "lb",
    platform: "android-chrome",
    headed: false,
    notes: "Physical Android Chrome; real pinch and TalkBack; native grant then site-settings revocation",
  },
};

const EXPECTED = {
  clean: { sessions: 0, rows: 0, sessionsLocal: 0, sessionsIdb: 0, rowsLocal: 0, rowsIdb: 0 },
  populated: { sessions: 12, rows: 48, sessionsLocal: 12, sessionsIdb: 12, rowsLocal: 48, rowsIdb: 48 },
  "block-review": { sessions: 18, rows: 72, sessionsLocal: 18, sessionsIdb: 18, rowsLocal: 72, rowsIdb: 72 },
  "local-newer": { sessions: 4, rows: 16, sessionsLocal: 4, sessionsIdb: 3, rowsLocal: 16, rowsIdb: 12 },
  "idb-newer": { sessions: 5, rows: 20, sessionsLocal: 3, sessionsIdb: 5, rowsLocal: 12, rowsIdb: 20 },
  "legacy-divergent": { sessions: 1, rows: 4, sessionsLocal: 1, sessionsIdb: 1, rowsLocal: 4, rowsIdb: 4 },
  "large-history": { sessions: 120, rows: 480, sessionsLocal: 120, sessionsIdb: 120, rowsLocal: 480, rowsIdb: 480 },
  coaching: { sessions: 4, rows: 18, sessionsLocal: 4, sessionsIdb: 4, rowsLocal: 18, rowsIdb: 18 },
};

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idFrom(rng, prefix) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = prefix;
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
}

const IDS = (() => {
  const rng = mulberry32(hash32(SEED));
  const specs = [
    { day: "Day 1", order: 1, name: "Hack squat", sets: 2, min: 4, max: 8, primary: "Quads", secondary: "Glutes" },
    { day: "Day 1", order: 2, name: "Seated leg curl", sets: 2, min: 4, max: 8, primary: "Hamstrings", secondary: "" },
    { day: "Day 2", order: 1, name: "Chest press", sets: 2, min: 4, max: 8, primary: "Chest", secondary: "Triceps" },
    { day: "Day 2", order: 2, name: "Machine row", sets: 2, min: 4, max: 8, primary: "Mid/upper back", secondary: "Lats" },
    { day: "Day 3", order: 1, name: "Shoulder press", sets: 2, min: 4, max: 8, primary: "Front delts", secondary: "Triceps" },
    { day: "Day 3", order: 2, name: "Lat pulldown", sets: 2, min: 4, max: 8, primary: "Lats", secondary: "Biceps" },
  ];
  return {
    program: idFrom(rng, "prog_"),
    programB: idFrom(rng, "prog_"),
    exercises: specs.map((spec) => ({ ...spec, id: idFrom(rng, "ex_") })),
    dupPress: { day: "Day 3", order: 3, name: "Chest press", sets: 2, min: 4, max: 8, primary: "Chest", secondary: "Triceps", id: idFrom(rng, "ex_") },
  };
})();

function recordedTestDate() {
  const raw = process.env.REPFORGE_TEST_DATE;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function settings({ lang = "en", unit = "kg" } = {}) {
  return {
    jumpPct: 2.5,
    minJump: 2.5,
    rirHigh: 2,
    hardRir: 4,
    restSec: 120,
    lastExport: "",
    unit,
    lang,
    rirMode: "numeric",
    voiceInputEnabled: false,
    notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
  };
}

function programMeta({ id, name, started, onboarded = true, weeks = 6 }) {
  return {
    id,
    name,
    started,
    created: `${started}T12:00:00.000Z`,
    updated: `${started}T12:00:00.000Z`,
    onboarded,
    mesocycleStatus: "active",
    mesocycleLengthWeeks: weeks,
    goal: "hypertrophy",
    experience: "intermediate",
    daysPerWeek: 3,
    splitType: "full_body",
    equipment: ["machines", "cables", "dumbbells", "barbells", "bodyweight"],
    priorityMuscles: [],
    sessionLength: "45",
    completedAt: null,
    blockPromptDismissedId: null,
  };
}

function row({ session, date, day, ex, set, load, reps, rir = 1 }) {
  return {
    session,
    date,
    day,
    name: ex.name,
    exerciseId: ex.id,
    set,
    load,
    reps,
    rir,
    notes: "",
    created: `${date}T12:${String(ex.order).padStart(2, "0")}:${String(set).padStart(2, "0")}.000Z`,
    primary: ex.primary,
    secondary: ex.secondary,
  };
}

function sessionRows({ date, day, exercises, load, reps = 8, tag }) {
  const session = `${date}_${day}_${tag}`;
  const rows = [];
  for (const ex of exercises) {
    for (let n = 1; n <= ex.sets; n++) {
      rows.push(row({ session, date, day, ex, set: n, load: load + (n - 1) * 2.5, reps }));
    }
  }
  return rows;
}

function byDay(list = IDS.exercises) {
  const m = new Map();
  for (const ex of list) {
    if (!m.has(ex.day)) m.set(ex.day, []);
    m.get(ex.day).push(ex);
  }
  return m;
}

function snapshot({ log, revision, name, started, lang, unit, extraProgram = [], stripRevision = false }) {
  const program = [...IDS.exercises, ...extraProgram];
  const state = {
    settings: settings({ lang, unit }),
    programMeta: programMeta({ id: IDS.program, name: name || "Launch block", started }),
    program,
    log,
    programHistory: [],
  };
  if (!stripRevision) state._storageRevision = revision;
  return state;
}

function countsOf(log) {
  const rows = Array.isArray(log) ? log.length : 0;
  const sessions = new Set((log || []).map((r) => r && r.session).filter(Boolean)).size;
  return { sessions, rows };
}

function buildHistory(testDate, { weeks, loadBase = 60, tag }) {
  const days = ["Day 1", "Day 2", "Day 3"];
  const grouped = byDay();
  const log = [];
  const start = addDays(testDate, -(weeks * 7 - 1));
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < days.length; d++) {
      const date = addDays(start, w * 7 + d);
      const day = days[d];
      log.push(
        ...sessionRows({
          date,
          day,
          exercises: grouped.get(day),
          load: loadBase + w * 2.5,
          tag: `${tag}_w${w}`,
        })
      );
    }
  }
  return log;
}

function buildFixtures(testDate, { lang = "en", unit = "kg" } = {}) {
  const startedPop = addDays(testDate, -27);
  const populatedLog = buildHistory(testDate, { weeks: 4, tag: "pop" });
  const blockLog = buildHistory(testDate, { weeks: 6, tag: "blk" });
  const localNewerBase = buildHistory(addDays(testDate, -7), { weeks: 1, tag: "ln" });
  const localNewerExtra = sessionRows({
    date: testDate,
    day: "Day 1",
    exercises: byDay().get("Day 1"),
    load: 80,
    tag: "ln_new",
  });
  const idbNewerBase = buildHistory(addDays(testDate, -7), { weeks: 1, tag: "in" });
  const idbNewerExtra = [
    ...sessionRows({ date: addDays(testDate, -3), day: "Day 2", exercises: byDay().get("Day 2"), load: 75, tag: "in_x1" }),
    ...sessionRows({ date: testDate, day: "Day 3", exercises: byDay().get("Day 3"), load: 85, tag: "in_x2" }),
  ];
  const legacyA = sessionRows({
    date: addDays(testDate, -2),
    day: "Day 1",
    exercises: byDay().get("Day 1"),
    load: 50,
    tag: "leg_a",
  });
  const legacyB = sessionRows({
    date: addDays(testDate, -1),
    day: "Day 2",
    exercises: byDay().get("Day 2"),
    load: 90,
    tag: "leg_b",
  });
  const largeLog = buildHistory(testDate, { weeks: 40, tag: "lg" });

  const [squat, curl, press, rowEx, shoulder] = IDS.exercises;
  const coachingLog = [
    ...sessionRows({ date: addDays(testDate, -7), day: "Day 1", exercises: [squat, curl, press], load: 60, tag: "coach_prev" }),
    ...sessionRows({ date: testDate, day: "Day 1", exercises: [squat], load: 65, tag: "coach_now" }),
    ...sessionRows({ date: testDate, day: "Day 1", exercises: [curl], load: 60, tag: "coach_now" }),
    ...sessionRows({ date: testDate, day: "Day 1", exercises: [press], load: 55, tag: "coach_now" }),
    ...sessionRows({ date: testDate, day: "Day 2", exercises: [rowEx, IDS.dupPress], load: 40, tag: "coach_one" }),
    ...sessionRows({ date: addDays(testDate, -35), day: "Day 3", exercises: [shoulder], load: 35, tag: "coach_stale" }),
  ];
  // Day 1 current-week rows share one session id via tag coach_now.
  const coachingNow = coachingLog.filter((r) => r.session.endsWith("coach_now"));
  for (const r of coachingNow) r.session = `${testDate}_Day 1_coach_now`;

  const opt = { lang, unit };
  const populated = snapshot({ log: populatedLog, revision: 4, started: startedPop, name: "Launch block", ...opt });
  const blockReview = snapshot({
    log: blockLog,
    revision: 6,
    started: addDays(testDate, -42),
    name: "Block due",
    ...opt,
  });
  const localSnap = snapshot({
    log: [...localNewerBase, ...localNewerExtra],
    revision: 2,
    started: addDays(testDate, -10),
    name: "Local newer",
    ...opt,
  });
  const localPeer = snapshot({
    log: localNewerBase,
    revision: 1,
    started: addDays(testDate, -10),
    name: "Local newer",
    ...opt,
  });
  const idbPeer = snapshot({
    log: idbNewerBase,
    revision: 2,
    started: addDays(testDate, -10),
    name: "IDB newer",
    ...opt,
  });
  const idbSnap = snapshot({
    log: [...idbNewerBase, ...idbNewerExtra],
    revision: 3,
    started: addDays(testDate, -10),
    name: "IDB newer",
    ...opt,
  });
  const legacyLocal = snapshot({
    log: legacyA,
    revision: 0,
    started: addDays(testDate, -14),
    name: "Copy A",
    stripRevision: true,
    ...opt,
  });
  const legacyIdb = snapshot({
    log: legacyB,
    revision: 0,
    started: addDays(testDate, -14),
    name: "Copy B",
    stripRevision: true,
    ...opt,
  });
  legacyIdb.programMeta.id = IDS.programB;
  const large = snapshot({
    log: largeLog,
    revision: 8,
    started: addDays(testDate, -280),
    name: "Large history",
    ...opt,
  });
  const coaching = snapshot({
    log: coachingLog,
    revision: 5,
    started: addDays(testDate, -40),
    name: "Coaching week",
    extraProgram: [IDS.dupPress],
    ...opt,
  });

  return {
    clean: { name: "clean", local: null, idb: null, draft: null, backup: { settings: settings(opt), program: [], log: [], programHistory: [] } },
    populated: { name: "populated", local: populated, idb: populated, draft: null, backup: stripMeta(populated) },
    "block-review": { name: "block-review", local: blockReview, idb: blockReview, draft: null, backup: stripMeta(blockReview) },
    "local-newer": { name: "local-newer", local: localSnap, idb: localPeer, draft: null, backup: stripMeta(localSnap) },
    "idb-newer": { name: "idb-newer", local: idbPeer, idb: idbSnap, draft: null, backup: stripMeta(idbSnap) },
    "legacy-divergent": { name: "legacy-divergent", local: legacyLocal, idb: legacyIdb, draft: null, backup: stripMeta(legacyLocal) },
    "large-history": { name: "large-history", local: large, idb: large, draft: null, backup: stripMeta(large) },
    coaching: { name: "coaching", local: coaching, idb: coaching, draft: null, backup: stripMeta(coaching) },
  };
}

function stripMeta(state) {
  if (!state || typeof state !== "object") return state;
  const o = JSON.parse(JSON.stringify(state));
  delete o._storageRevision;
  delete o._storageFollowUp;
  return o;
}

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function fixtureHash(fx) {
  return sha256({ local: fx.local, idb: fx.idb, draft: fx.draft });
}

function fixtureCounts(fx) {
  const local = countsOf(fx.local?.log);
  const idb = countsOf(fx.idb?.log);
  return {
    sessions: Math.max(local.sessions, idb.sessions),
    rows: Math.max(local.rows, idb.rows),
    sessionsLocal: local.sessions,
    sessionsIdb: idb.sessions,
    rowsLocal: local.rows,
    rowsIdb: idb.rows,
  };
}

function validateFixtureSchema(fx) {
  const errors = [];
  if (!FIXTURE_NAMES.includes(fx.name)) errors.push(`unknown name ${fx.name}`);
  if (fx.name === "clean") {
    if (fx.local != null || fx.idb != null) errors.push("clean must have empty replicas");
    return errors;
  }
  for (const side of ["local", "idb"]) {
    const snap = fx[side];
    if (!snap || typeof snap !== "object") {
      errors.push(`${side} missing`);
      continue;
    }
    if (!Array.isArray(snap.program) || !Array.isArray(snap.log)) errors.push(`${side} lacks program/log arrays`);
    if (!snap.settings || !snap.programMeta) errors.push(`${side} lacks settings/programMeta`);
    if (fx.name === "legacy-divergent") {
      if (Object.prototype.hasOwnProperty.call(snap, "_storageRevision")) errors.push(`${side} must be revisionless`);
    } else if (!Number.isInteger(snap._storageRevision) || snap._storageRevision < 0) {
      errors.push(`${side} needs non-negative _storageRevision`);
    }
  }
  return errors;
}

function usage() {
  return `Usage:
  node test/manual-matrix.mjs --self-test
  node test/manual-matrix.mjs --emit-fixtures /tmp/repforge-launch-041
  node test/manual-matrix.mjs --prepare C1 --fixture clean --permission unsupported --headed`;
}

function parseArgs(argv) {
  const out = {
    selfTest: false,
    emit: null,
    prepare: null,
    fixture: null,
    permission: "native",
    headed: false,
    locale: null,
    unit: null,
    width: null,
    height: null,
    origin: DEFAULT_ORIGIN,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`Missing value for ${a}`);
      return v;
    };
    if (a === "--self-test") out.selfTest = true;
    else if (a === "--emit-fixtures") out.emit = next();
    else if (a === "--prepare") out.prepare = next();
    else if (a === "--fixture") out.fixture = next();
    else if (a === "--permission") out.permission = next();
    else if (a === "--headed") out.headed = true;
    else if (a === "--locale") out.locale = next();
    else if (a === "--unit") out.unit = next();
    else if (a === "--width") out.width = +next();
    else if (a === "--height") out.height = +next();
    else if (a === "--origin") out.origin = next();
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function seedSnippet(fx) {
  return `/* RepForge ${fx.name} seed — paste at the exact origin in Web Inspector / remote debugging.
   Record hash ${fixtureHash(fx)} in the evidence ledger before testing. */
(async () => {
  const KEY = ${JSON.stringify(KEY)};
  const DRAFT = ${JSON.stringify(DRAFT)};
  const DB = ${JSON.stringify(DB)};
  const STORE = ${JSON.stringify(STORE)};
  const local = ${JSON.stringify(fx.local)};
  const idb = ${JSON.stringify(fx.idb)};
  const draft = ${JSON.stringify(fx.draft)};
  localStorage.removeItem(DRAFT);
  if (draft != null) localStorage.setItem(DRAFT, JSON.stringify(draft));
  if (local == null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(local));
  await new Promise((res) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
  if (idb != null) {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(idb, KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }
  location.reload();
})();
`;
}

function runSelfTest() {
  const results = { passed: 0, failed: 0 };
  const assert = (cond, name, detail) => {
    if (cond) {
      results.passed++;
      console.log(`  ✓ ${name}`);
    } else {
      results.failed++;
      console.log(`  ✗ ${name}`);
      if (detail) console.log(`    ${detail}`);
    }
  };

  console.log("\nManual matrix self-test");
  assert(SEED === "repforge-launch-041", "fixed seed is repforge-launch-041", SEED);
  const ids = Object.keys(CELLS);
  assert(ids.length === 6 && ids.join(",") === "C1,C2,C3,C4,C5,C6", "six cells C1–C6", ids.join(","));
  assert(CELLS.C1.viewport.width === 320 && CELLS.C1.viewport.height === 568 && CELLS.C1.locale === "en" && CELLS.C1.unit === "kg", "C1 is 320×568 / en / kg");
  assert(CELLS.C2.viewport.width === 390 && CELLS.C2.platform === "ios-safari", "C2 is 390×844 iOS Safari");
  assert(CELLS.C3.viewport.width === 430 && CELLS.C3.platform === "android-chrome", "C3 is 430×932 Android Chrome");
  assert(CELLS.C4.locale === "pt" && CELLS.C4.unit === "lb" && CELLS.C4.viewport.width === 320, "C4 is 320×568 / pt / lb");
  assert(CELLS.C5.locale === "pt" && CELLS.C5.platform === "ios-safari", "C5 is 390×844 / pt / lb iOS");
  assert(CELLS.C6.locale === "pt" && CELLS.C6.platform === "android-chrome", "C6 is 430×932 / pt / lb Android");
  assert(CELLS.C1.headed && CELLS.C4.headed && !CELLS.C2.headed && !CELLS.C3.headed, "only C1/C4 are headed desktop cells");

  const testDate = "2026-08-13";
  const a = buildFixtures(testDate);
  const b = buildFixtures(testDate);
  assert(FIXTURE_NAMES.every((n) => a[n]), "all eight fixtures exist", FIXTURE_NAMES.filter((n) => !a[n]).join(","));

  for (const name of FIXTURE_NAMES) {
    const fx = a[name];
    const schemaErrs = validateFixtureSchema(fx);
    assert(schemaErrs.length === 0, `${name} schema`, schemaErrs.join("; "));
    const got = fixtureCounts(fx);
    const exp = EXPECTED[name];
    assert(
      got.sessions === exp.sessions &&
        got.rows === exp.rows &&
        got.sessionsLocal === exp.sessionsLocal &&
        got.sessionsIdb === exp.sessionsIdb &&
        got.rowsLocal === exp.rowsLocal &&
        got.rowsIdb === exp.rowsIdb,
      `${name} row/session counts`,
      `got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`
    );
    const ha = fixtureHash(fx);
    const hb = fixtureHash(b[name]);
    assert(ha === hb && /^[0-9a-f]{64}$/.test(ha), `${name} hash stable`, `${ha} vs ${hb}`);
    console.log(`    hash ${name}=${ha}`);
  }

  assert(a["local-newer"].local._storageRevision > a["local-newer"].idb._storageRevision, "local-newer local revision wins");
  assert(a["idb-newer"].idb._storageRevision > a["idb-newer"].local._storageRevision, "idb-newer idb revision wins");
  assert(
    a["legacy-divergent"].local.programMeta.name !== a["legacy-divergent"].idb.programMeta.name,
    "legacy-divergent copies disagree"
  );
  assert(
    a.coaching.local.program.filter((ex) => ex.name === "Chest press").length === 2,
    "coaching fixture has duplicate display names on distinct IDs"
  );
  assert(!JSON.stringify(a.populated.backup).includes("_storageRevision"), "full-backup JSON omits storage revision");

  const otherDate = buildFixtures("2026-01-01");
  assert(
    fixtureHash(otherDate.populated) !== fixtureHash(a.populated),
    "hashes depend on recorded test date offsets"
  );

  console.log(`\nmanual-matrix self-test: ${results.passed} passed, ${results.failed} failed`);
  return results.failed === 0 ? 0 : 1;
}

function emitFixtures(dir) {
  const testDate = recordedTestDate();
  const outDir = resolve(dir);
  mkdirSync(outDir, { recursive: true });
  const fixtures = buildFixtures(testDate);
  const manifest = {
    seed: SEED,
    testDate,
    originNote: "Physical cells require REPFORGE_RC_ORIGIN serving this commit; desktop cells use http://127.0.0.1:8000",
    cells: CELLS,
    fixtures: {},
  };
  for (const name of FIXTURE_NAMES) {
    const fx = fixtures[name];
    const hash = fixtureHash(fx);
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(fx.backup, null, 2));
    writeFileSync(join(outDir, `${name}.seed.js`), seedSnippet(fx));
    if (fx.local && fx.idb && stableStringify(fx.local) !== stableStringify(fx.idb)) {
      writeFileSync(join(outDir, `${name}.local.json`), JSON.stringify(fx.local, null, 2));
      writeFileSync(join(outDir, `${name}.idb.json`), JSON.stringify(fx.idb, null, 2));
    }
    const counts = fixtureCounts(fx);
    manifest.fixtures[name] = { hash, ...counts };
    console.log(`  wrote ${name} hash=${hash} sessions=${counts.sessions} rows=${counts.rows}`);
  }
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nEmitted fixtures to ${outDir} (testDate=${testDate}, seed=${SEED})`);
  return 0;
}

async function storeHash(page, side) {
  return page.evaluate(
    async ({ key, dbName, storeName, side }) => {
      if (side === "draft") {
        return { present: localStorage.getItem("repforge_draft_v1") != null, raw: localStorage.getItem("repforge_draft_v1") };
      }
      if (side === "local") {
        const raw = localStorage.getItem(key);
        return { present: raw != null, raw };
      }
      const val = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(storeName, "readonly");
          const g = tx.objectStore(storeName).get(key);
          g.onsuccess = () => {
            db.close();
            res(g.result === undefined ? null : g.result);
          };
          g.onerror = () => {
            db.close();
            rej(g.error);
          };
        };
        r.onerror = () => rej(r.error);
      });
      return { present: val != null, raw: val == null ? null : typeof val === "string" ? val : JSON.stringify(val) };
    },
    { key: KEY, dbName: DB, storeName: STORE, side }
  );
}

function digestStore(info) {
  if (!info?.present) return "absent";
  return sha256(info.raw || "");
}

async function wipeOrigin(page, context) {
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await context.clearPermissions();
}

function permissionInitScript(mode) {
  if (mode === "unsupported") {
    return () => {
      try {
        delete window.Notification;
      } catch {
        /* ignore */
      }
      Object.defineProperty(window, "Notification", { configurable: true, get() { return undefined; } });
    };
  }
  if (mode === "pending") {
    return () => {
      const Orig = window.Notification;
      let resolveReq = null;
      const deferred = new Promise((res) => {
        resolveReq = res;
      });
      window.__repforgeNotifyHarness = {
        mode: "pending",
        resolve(value) {
          resolveReq(value);
        },
      };
      const Wrapped = function NotificationShim(...args) {
        return new Orig(...args);
      };
      Wrapped.permission = "default";
      Wrapped.requestPermission = () =>
        deferred.then((v) => {
          Wrapped.permission = v;
          return v;
        });
      window.Notification = Wrapped;
    };
  }
  return null;
}

async function applyCdpPermission(context, page, origin, mode) {
  if (mode === "native" || mode === "unsupported" || mode === "pending") return;
  const cdp = await context.newCDPSession(page);
  const setting = mode === "granted" ? "granted" : mode === "default" ? "prompt" : "denied";
  if (mode === "revoked") {
    await cdp.send("Browser.setPermission", {
      permission: { name: "notifications" },
      setting: "granted",
      origin,
    });
  }
  await cdp.send("Browser.setPermission", {
    permission: { name: "notifications" },
    setting: mode === "revoked" ? "denied" : setting,
    origin,
  });
}

async function seedStores(page, fx) {
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, local, idb, draft }) => {
      if (draft == null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(draft));
      if (local == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(local));
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = req.onerror = req.onblocked = () => res();
      });
      if (idb != null) {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open(dbName, 1);
          r.onupgradeneeded = () => r.result.createObjectStore(storeName);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        await new Promise((res, rej) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(idb, key);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      }
    },
    { key: KEY, draftKey: DRAFT, dbName: DB, storeName: STORE, local: fx.local, idb: fx.idb, draft: fx.draft }
  );
}

async function runPrepare(args) {
  const cell = CELLS[args.prepare];
  if (!cell) throw new Error(`Unknown cell ${args.prepare}; expected C1..C6`);
  if (!args.fixture || !FIXTURE_NAMES.includes(args.fixture)) {
    throw new Error(`--fixture must be one of ${FIXTURE_NAMES.join(", ")}`);
  }
  if (!PERMISSIONS.includes(args.permission)) {
    throw new Error(`--permission must be one of ${PERMISSIONS.join(", ")}`);
  }
  if (args.locale && args.locale !== cell.locale) {
    throw new Error(`locale mismatch: cell ${cell.id} is ${cell.locale}, got ${args.locale}`);
  }
  if (args.unit && args.unit !== cell.unit) {
    throw new Error(`unit mismatch: cell ${cell.id} is ${cell.unit}, got ${args.unit}`);
  }
  if (args.width && args.width !== cell.viewport.width) {
    throw new Error(`viewport width mismatch: cell ${cell.id} is ${cell.viewport.width}, got ${args.width}`);
  }
  if (args.height && args.height !== cell.viewport.height) {
    throw new Error(`viewport height mismatch: cell ${cell.id} is ${cell.viewport.height}, got ${args.height}`);
  }
  if (args.headed && !cell.headed) {
    throw new Error(`${cell.id} is a physical-device cell; do not open headed Chromium. Reset the exact HTTPS origin on device, then import the emitted fixture.`);
  }

  const testDate = recordedTestDate();
  const fixtures = buildFixtures(testDate, { lang: cell.locale, unit: cell.unit });
  const fx = fixtures[args.fixture];
  const hash = fixtureHash(fx);
  const origin = new URL(args.origin).origin;

  console.log(`\nPrepare ${cell.id}`);
  console.log(`  viewport=${cell.viewport.width}x${cell.viewport.height} locale=${cell.locale} unit=${cell.unit}`);
  console.log(`  platform=${cell.platform}`);
  console.log(`  fixture=${fx.name} hash=${hash}`);
  console.log(`  permission=${args.permission}`);
  console.log(`  origin=${origin}`);
  console.log(`  notes=${cell.notes}`);

  if (!cell.headed) {
    console.log(`\nPhysical reset:`);
    if (cell.platform === "ios-safari") {
      console.log("  iOS: Safari Website Data → remove the exact release-candidate origin, then import the emitted full-backup or run the .seed.js snippet via Web Inspector.");
    } else {
      console.log("  Android: Chrome Site settings → the exact origin → Clear & reset, then import the emitted full-backup or run the .seed.js snippet via remote debugging.");
    }
    console.log(`  Record fixture hash ${hash} in the evidence ledger before testing.`);
    if (!process.env.REPFORGE_RC_ORIGIN) {
      console.log("  STOP reminder: set REPFORGE_RC_ORIGIN to a branch-addressable HTTPS origin serving this commit before C2/C3/C5/C6.");
    }
    return 0;
  }

  const { launchChromium } = await import("./browser.mjs");
  const browser = await launchChromium({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: cell.viewport,
    locale: cell.locale === "pt" ? "pt-BR" : "en-US",
    serviceWorkers: "allow",
  });
  const init = permissionInitScript(args.permission);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });

  const before = {
    local: digestStore(await storeHash(page, "local")),
    idb: digestStore(await storeHash(page, "idb")),
    draft: digestStore(await storeHash(page, "draft")),
  };
  await wipeOrigin(page, context);
  await seedStores(page, fx);
  await applyCdpPermission(context, page, origin, args.permission);
  const after = {
    local: digestStore(await storeHash(page, "local")),
    idb: digestStore(await storeHash(page, "idb")),
    draft: digestStore(await storeHash(page, "draft")),
  };
  console.log(`  before local=${before.local} idb=${before.idb} draft=${before.draft}`);
  console.log(`  after  local=${after.local} idb=${after.idb} draft=${after.draft}`);
  console.log(`  fixture hash=${hash}`);
  if (args.permission === "pending") {
    console.log("  pending: resolve via window.__repforgeNotifyHarness.resolve('granted'|'denied'|'default') — test-only, not app UI.");
  }

  if (args.headed) {
    await page.reload({ waitUntil: "domcontentloaded" });
    console.log("  Headed cell ready. Close the browser window to finish.");
    await new Promise((resolve) => browser.on("disconnected", resolve));
    return 0;
  }
  await browser.close();
  return 0;
}

const args = parseArgs(process.argv);
if (args.help || (!args.selfTest && !args.emit && !args.prepare)) {
  console.log(usage());
  process.exit(args.help ? 0 : 1);
}

let code = 0;
try {
  if (args.selfTest) code = runSelfTest();
  else if (args.emit) code = emitFixtures(args.emit);
  else code = await runPrepare(args);
} catch (err) {
  console.error(err.message || err);
  code = 1;
}
process.exit(code);
