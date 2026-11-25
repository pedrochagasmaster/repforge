#!/usr/bin/env node
/* Integrity gate for the raw Plan 067 catalog and its generated search index. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = join(__dirname, "..");
const { EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = require(join(ROOT, "exercises.js"));
const source = JSON.parse(readFileSync(join(ROOT, "plans/067/data/app_file.json"), "utf8"));
const catalogAsset = JSON.parse(readFileSync(join(ROOT, "assets/exercise-catalog.json"), "utf8"));
const curation = JSON.parse(readFileSync(join(ROOT, "tools/exercise-catalog-curation.json"), "utf8"));
const draftNames = JSON.parse(readFileSync(join(ROOT, "tools/exercise-names-pt-draft.json"), "utf8"));
const mediaBg = JSON.parse(readFileSync(join(ROOT, "tools/exercise-media-bg.json"), "utf8"));
// A vendored animation replaces an illustration: `media` is then its still.
const animations = JSON.parse(readFileSync(join(ROOT, "tools/exercise-gifs.json"), "utf8")).entries;
const stillOf = id => (animations[id] ? `assets/exercise-stills/${animations[id].datasetId}.webp` : null);
const sourceById = new Map(source.exercises.map(exercise => [exercise.id, exercise]));
const indexById = new Map(EXERCISE_LIBRARY.map(exercise => [exercise.id, exercise]));
const normalizedUnique = values => {
  const seen = new Set();
  return values.filter(value => {
    const key = String(value).normalize("NFKC").trim().toLocaleLowerCase("en");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

let passed = 0, failed = 0;
function assert(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

console.log(`exercise catalog — ${EXERCISE_LIBRARY.length} UUID records`);
assert(isDeepStrictEqual(catalogAsset, source),
  "lazy detail asset preserves every committed raw source value");
assert(source.exercises.length === 1345, "raw corpus contains exactly 1,345 exercises");
assert(Object.keys(source.uuidIndex).length === 5301, "raw corpus contains exactly 5,301 UUID objects");
assert(new Set(Object.values(source.uuidIndex).map(value => value.type)).size === 22,
  "raw corpus retains all 22 UUID object types");
assert(EXERCISE_LIBRARY.length === 1345 && indexById.size === 1345,
  "search index covers every exercise UUID exactly once");
assert(Object.keys(LEGACY_LIBRARY_IDS).length === 0,
  "no historical short ID is silently repointed to a new exercise");

const roleFields = [
  "strengthPrimaryCompoundRecommendationLevel",
  "strengthSecondaryCompoundRecommendationLevel",
  "strengthAccessoryRecommendationLevel",
  "hypertrophyPrimaryCompoundRecommendationLevel",
  "hypertrophySecondaryCompoundRecommendationLevel",
  "hypertrophyAccessoryRecommendationLevel",
];
const roleAssignments = source.exercises.reduce((total, exercise) =>
  total + roleFields.filter(field => exercise[field] !== null).length, 0);
assert(roleAssignments === 3057, "all 3,057 non-null role-tier assignments remain in the raw source");
assert(EXERCISE_LIBRARY.every(index => roleFields.every(field => !Object.hasOwn(index, field))),
  "raw role-tier fields are not duplicated into the compact search index");

const metricIds = new Set(source.exercises.flatMap(exercise => exercise.exerciseMetrics));
const metricless = source.exercises.filter(exercise => exercise.exerciseMetrics.length === 0);
assert(metricIds.size === 11, "the catalog retains all 11 metric identities");
assert(metricless.length === 3, "the three metricless movements remain available for manual configuration");
assert(source.exercises.every(exercise => exercise.exerciseMetrics.every(id =>
  source.uuidIndex[id]?.type === "exerciseMetric")),
"every exercise metric reference resolves to an exerciseMetric UUID object");

const dangling = [];
for (const exercise of source.exercises) {
  if (source.uuidIndex[exercise.id]?.type !== "exercise") dangling.push(`${exercise.id}: exercise UUID entry`);
  for (const value of Object.values(exercise)) {
    for (const id of Array.isArray(value) ? value : [value])
      if (typeof id === "string" && /^[0-9a-f]{32}$/.test(id) && !source.uuidIndex[id])
        dangling.push(`${exercise.id}: ${id}`);
  }
}
assert(dangling.length === 0, "exercise UUID references resolve without changing their IDs", dangling.slice(0, 8).join(" | "));

const wrongIndexRows = EXERCISE_LIBRARY.filter(index => {
  const raw = sourceById.get(index.id);
  if (!raw || index.name !== raw.name || index.searchBoostValue !== raw.searchBoostValue) return true;
  const reviewed = curation.entries[index.id];
  // A reviewed name wins; otherwise the owner-review draft supplies Portuguese.
  const named = reviewed || draftNames.entries[index.id] || null;
  const expectedNamePt = named?.namePt || raw.name;
  const expectedAliases = normalizedUnique([
    ...(named?.aliases || []),
    ...raw.alternativeName.map(id => source.uuidIndex[id]?.name),
  ]);
  const expectedMedia = stillOf(index.id) || (reviewed?.mediaId ? `assets/exercises/${reviewed.mediaId}.webp` : null);
  const expectedBg = stillOf(index.id) ? "#ffffff" : reviewed?.mediaId ? mediaBg[reviewed.mediaId] : null;
  return index.namePt !== expectedNamePt || !isDeepStrictEqual(index.aliases, expectedAliases) ||
    index.media !== expectedMedia || index.mediaBg !== expectedBg ||
    !isDeepStrictEqual(Object.keys(index).sort(), [
      "aliases", "id", "media", "mediaBg", "name", "namePt",
      ...(Object.hasOwn(raw, "searchBoostValue") ? ["searchBoostValue"] : []),
    ]);
});
assert(wrongIndexRows.length === 0, "compact index identities and search/display fields match their source IDs",
  wrongIndexRows.slice(0, 6).map(row => row.id).join(", "));
assert(EXERCISE_LIBRARY.every(index => Array.isArray(index.aliases)),
  "canonical names, source alternatives, and reviewed Portuguese terms are searchable");
assert(Object.entries(curation.entries).every(([id, reviewed]) => {
  const index = indexById.get(id);
  return index && index.namePt === reviewed.namePt && reviewed.aliases.every(alias => index.aliases.includes(alias));
}), "reviewed Portuguese display aliases attach only to their authored UUIDs");
assert(EXERCISE_LIBRARY.every(index => !Object.hasOwn(index, "compiler") && !Object.hasOwn(index, "patterns") && !Object.hasOwn(index, "equipment")),
  "the compact index carries no duplicated or name-inferred ontology data");

const animatedRows = EXERCISE_LIBRARY.filter(exercise => stillOf(exercise.id));
const mediaRows = EXERCISE_LIBRARY.filter(exercise => exercise.media && !stillOf(exercise.id));
const mediaFiles = readdirSync(join(ROOT, "assets/exercises")).filter(file => file.endsWith(".webp"));
const mediaFileIds = mediaFiles.map(file => file.replace(/\.webp$/, "")).sort();
const licensedMediaIds = Object.keys(mediaBg).sort();
const mappedPaths = new Set(mediaRows.map(exercise => exercise.media));
const unreferencedFiles = mediaFiles.filter(file => !mappedPaths.has(`assets/exercises/${file}`));
const invalidMediaMappings = mediaRows.filter(exercise => {
  const mapping = curation.entries[exercise.id];
  return !mapping?.mediaId || mapping.sourceName !== sourceById.get(exercise.id)?.name ||
    exercise.media !== `assets/exercises/${mapping.mediaId}.webp` ||
    exercise.mediaBg !== mediaBg[mapping.mediaId] || !/^#[0-9a-f]{6}$/.test(String(exercise.mediaBg)) ||
    !existsSync(join(ROOT, exercise.media));
});
assert(mediaRows.length === 8 && Object.keys(curation.entries).filter(id => curation.entries[id].mediaId).length === 20,
  "20 exact-movement UUID mappings carry a licensed illustration; 8 show it, 12 show their animation instead", `${mediaRows.length} shown`);
assert(animatedRows.length === 61 && animatedRows.every(exercise =>
  exercise.media === stillOf(exercise.id) && exercise.mediaBg === "#ffffff" && existsSync(join(ROOT, exercise.media))),
  "61 movements show the first frame of their animation on its white ground", `${animatedRows.length} animated`);
assert(invalidMediaMappings.length === 0, "each artwork path is backed by its reviewed UUID/name/background mapping",
  invalidMediaMappings.map(exercise => exercise.id).join(", "));
assert(EXERCISE_LIBRARY.filter(exercise => !exercise.media && exercise.mediaBg == null).length === 1276,
  "the other 1,276 source movements retain the empty media tile");
assert(mediaFiles.length === 96 && unreferencedFiles.length === 88,
  "all 96 licensed files stay closed and 88 unmatched or replaced files remain unreferenced",
  `${mediaFiles.length} files; ${unreferencedFiles.length} unreferenced`);
assert(isDeepStrictEqual(mediaFileIds, licensedMediaIds),
  "the existing sampled-media allowlist still defines the complete licensed file set");
assert(EXERCISE_LIBRARY.every(exercise => exercise.media || exercise.mediaBg == null),
  "unmapped movements carry no fallback image or field color");

{
  // Vendored Gym visual animations: exact-name matches only, pinned by hash, credited in the product.
  const { checkVendoredGifs, ATTRIBUTION } = await import("../tools/vendor-exercise-gifs.mjs");
  const gifProblems = checkVendoredGifs();
  assert(gifProblems.length === 0, "vendored exercise animations match their exact-name manifest",
    gifProblems.slice(0, 6).join(" | "));
  const gifManifest = existsSync(join(ROOT, "tools/exercise-gifs.json"))
    ? JSON.parse(readFileSync(join(ROOT, "tools/exercise-gifs.json"), "utf8")) : { entries: {} };
  assert(Object.keys(gifManifest.entries).length === 61,
    "61 catalog movements carry a vendored animation", `${Object.keys(gifManifest.entries).length} mapped`);
  assert(EXERCISE_LIBRARY.every(exercise => !/exercise-gifs|gymvisual|\.gif/i.test(JSON.stringify(exercise))),
    "the search index names only stills; the app derives each animation's path from its still");
  const worker = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert(Object.values(gifManifest.entries).every(entry => worker.includes(`"./assets/exercise-stills/${entry.datasetId}.webp"`)) &&
    !/exercise-gifs/.test(worker),
    "every still is precached so lists work offline; the animations are fetched on demand");
  const app = readFileSync(join(ROOT, "app.js"), "utf8");
  assert(/const EXERCISE_STILL=\/\^assets\\\/exercise-stills\\\/\(\\d\{4\}\)\\\.webp\$\//.test(app) &&
    app.includes("`assets/exercise-gifs/${m[1]}.gif`") && /function playExerciseAnimations\(root\)\{[^}]*?if\(reducedMotion\(\)\|\|/.test(app),
    "the app plays an animation from its still's dataset id, and not under reduced motion");
  const shell = readFileSync(join(ROOT, "index.html"), "utf8");
  const creditRow = shell.match(/id="settingsMediaCredit"[\s\S]*?<\/div>/)?.[0] || "";
  assert(creditRow.includes(ATTRIBUTION) && creditRow.includes('data-i18n="settings.media_credit"'),
    "Settings credits the animations with the Gym visual attribution verbatim");
  assert(["en", "pt"].every(locale =>
    typeof JSON.parse(readFileSync(join(ROOT, `i18n-${locale}.json`), "utf8"))["settings.media_credit"] === "string"),
    "the credit label is translated in both locales");
  const notice = readFileSync(join(ROOT, "NOTICE.md"), "utf8");
  assert(notice.includes(ATTRIBUTION) && notice.includes("assets/exercise-gifs/"),
    "NOTICE.md records the animations and their attribution");
}

const buildCheck = spawnSync(process.execPath, [join(ROOT, "tools/build-exercises.mjs"), "--check"], {
  cwd: ROOT, encoding: "utf8",
});
assert(buildCheck.status === 0, "generated index and detail asset match their committed inputs",
  buildCheck.stderr || buildCheck.stdout);

{
  const index = readFileSync(join(ROOT, "index.html"), "utf8");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const expectedBaseRevision = 395;
  const cacheRevision = Number(sw.match(/const CACHE = "repforge-v(\d+)"/)?.[1] || 0);
  const transitionAssets = [
    "generation-identity.js",
    "generation-candidates.js",
    "generation-layout.js",
    "motion-layer.js",
    "progress-model.js",
    "progression-engine.js",
    "install-transfer-contract.js",
    "warmup-suggestions.js",
    "exercises.js",
    "program-compiler.js",
    "program-editor.js",
    "program-review.js",
    "program-entry.js",
    "program-entry-adapter.js",
    "shared-setup.js",
    "starting-loads.js",
    "workout-draft.js",
    "effort-calibration.js",
    "calibration-gauge.js",
    "program-transition.js",
    "program-engine.js",
    "engine-policy.js",
    "install-policy.js",
    "guide-registry.js",
    "rest-timer.js",
    "durable-state.js",
    "history-ui.js",
    "share-cards.js",
    "exercise-catalog.js",
    "app.js",
  ];
  const revisionFor = file => index.match(new RegExp(`src="${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=(\\d+)"`))?.[1] || "";
  const missingRevision = transitionAssets.filter(file => !revisionFor(file));
  const missingCache = transitionAssets.filter(file => !sw.includes(`"./${file}?v=${revisionFor(file)}"`));
  assert(cacheRevision > expectedBaseRevision,
    `service-worker cache advances beyond repforge-v${expectedBaseRevision}`,
    `got ${cacheRevision}`);
  assert(missingRevision.length === 0,
    "version-coupled runtime scripts have numeric revisions in index.html",
    missingRevision.join(", "));
  assert(missingCache.length === 0,
    "each exact index.html runtime URL is precached for offline launch",
    missingCache.join(", "));
  assert(index.indexOf(`src="exercises.js?v=${revisionFor("exercises.js")}"`) < index.indexOf(`src="exercise-catalog.js?v=${revisionFor("exercise-catalog.js")}"`) &&
    index.indexOf(`src="exercise-catalog.js?v=${revisionFor("exercise-catalog.js")}"`) < index.indexOf(`src="app.js?v=${revisionFor("app.js")}"`),
  "synchronous index and lazy catalog API load before application consumers");
  assert(sw.includes('"./assets/exercise-catalog.json?v=067"'),
    "the lazy detail asset is available to the offline shell");
  assert(sw.includes(`"./exercise-catalog.js?v=${revisionFor("exercise-catalog.js")}"`),
    "the exact versioned catalog runtime is available to the offline shell");
  assert(sw.includes('"./program-compiler.js"'), "the existing compiler remains in the offline shell during migration");
  assert(sw.includes('"./program-entry.js"') && sw.includes('"./program-entry-adapter.js"'),
    "program-entry modules remain in the offline shell during migration");
  assert(sw.includes('"./install-policy.js"'), "the install policy remains in the offline shell");
  assert(/registration\.scope/.test(sw) && /SCOPE_PATH/.test(sw),
    "service-worker shell matching is relative to its production scope");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
