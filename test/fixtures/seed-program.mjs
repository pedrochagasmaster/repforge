/**
 * A ready-to-log program for browser suites.
 *
 * A device that has not been through onboarding holds no program at all, so a
 * suite that boots a fresh app and then logs, picks days, or opens the workout
 * has to install one first. This is that program: three days of six machine
 * movements, the shape the suites were written against, seeded explicitly
 * instead of harvested from a bundled default that no longer exists.
 *
 * It is a fixture, not a product surface — nothing in the app mints it.
 */

/**
 * One slot carries alternates on purpose, and carries two kinds: "Leg press" is
 * a library movement, "Pendulum squat" is not. A picker that only kept the ones
 * it could match against the library would quietly drop the second, so the
 * substitution walk needs both present to notice.
 */
const ALTERNATES = { "Hack squat": ["Leg press", "Pendulum squat"] };

const ROWS = [
  ["Day 1", 1, "Hack squat", "Quads", "Glutes,Adductors"],
  ["Day 1", 2, "Seated leg curl", "Hamstrings", ""],
  ["Day 1", 3, "Incline chest press", "Chest", "Front delts,Triceps"],
  ["Day 1", 4, "Chest supported row", "Mid/upper back", "Lats,Rear delts,Biceps"],
  ["Day 1", 5, "Machine lateral raise", "Side delts", ""],
  ["Day 1", 6, "Hip adduction machine", "Adductors", ""],
  ["Day 2", 1, "Leg press", "Quads", "Glutes,Adductors"],
  ["Day 2", 2, "Romanian deadlift", "Hamstrings,Glutes", "Spinal erectors"],
  ["Day 2", 3, "Machine shoulder press", "Front delts", "Side delts,Triceps"],
  ["Day 2", 4, "Neutral grip pulldown", "Lats", "Mid/upper back,Biceps"],
  ["Day 2", 5, "Pec deck", "Chest", ""],
  ["Day 2", 6, "Machine preacher curl", "Biceps", ""],
  ["Day 3", 1, "Leg extension", "Quads", ""],
  ["Day 3", 2, "Lying leg curl", "Hamstrings", ""],
  ["Day 3", 3, "Machine chest dip", "Chest", "Front delts,Triceps"],
  ["Day 3", 4, "Plate loaded high row", "Lats,Mid/upper back", "Rear delts,Biceps"],
  ["Day 3", 5, "Reverse pec deck", "Rear delts", "Mid/upper back"],
  ["Day 3", 6, "Cable pressdown", "Triceps", ""],
];

/** The program rows. Stable ids, so a suite can address one across a reload. */
export function seedProgram() {
  return ROWS.map(([day, order, name, primary, secondary], i) => {
    const row = {
      id: `seed-ex-${i + 1}`,
      day,
      order,
      name,
      sets: 2,
      min: 4,
      max: 8,
      primary,
      secondary,
    };
    if (ALTERNATES[name]) row.alternates = ALTERNATES[name].slice();
    return row;
  });
}

/** Its metadata: onboarded, so the app treats it as the lifter's own program. */
export function seedProgramMeta(overrides = {}) {
  return {
    id: "seed-program",
    name: "Seed program",
    started: null,
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    goal: null,
    experience: null,
    daysPerWeek: 3,
    splitType: "full_body",
    equipment: [],
    priorityMuscles: [],
    sessionLength: null,
    mesocycleLengthWeeks: 6,
    mesocycleStatus: "active",
    completedAt: null,
    onboarded: true,
    progressionRelations: [],
    progressionModifiers: [],
    progressionIncompatibilities: [],
    programStructure: null,
    entrySource: null,
    ...overrides,
  };
}

/**
 * Write the program into both replicas over whatever the page currently holds,
 * then reload onto it. `waitFor` is the suite's own post-reload boot wait.
 */
export async function installSeedProgram(page, { key = "repforge_v1", waitFor } = {}) {
  const base = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), key);
  const blob = {
    ...base,
    program: seedProgram(),
    programMeta: seedProgramMeta(),
    log: Array.isArray(base.log) ? base.log : [],
  };
  await page.evaluate(
    async ({ k, state }) => {
      localStorage.setItem(k, JSON.stringify(state));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(state, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: key, state: blob }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  if (waitFor) await waitFor(page);
  return blob;
}
