#!/usr/bin/env node
/* Integrity gate for the raw Plan 067 catalog and its generated search index. */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {nativeSourceAssets} from '../scripts/native-source-assets.mjs';
import {assembleRelease} from '../scripts/release-assembly.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const {EXERCISE_LIBRARY,LEGACY_LIBRARY_IDS}=await import('../exercises.js');
const source = JSON.parse(readFileSync(join(ROOT, "plans/067/data/app_file.json"), "utf8"));
const catalogAsset = JSON.parse(readFileSync(join(ROOT, "assets/exercise-catalog.json"), "utf8"));
const curation = JSON.parse(readFileSync(join(ROOT, "tools/exercise-catalog-curation.json"), "utf8"));
const draftNames = JSON.parse(readFileSync(join(ROOT, "tools/exercise-names-pt-draft.json"), "utf8"));
const mediaBg = JSON.parse(readFileSync(join(ROOT, "tools/exercise-media-bg.json"), "utf8"));
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
  const expectedMedia = reviewed?.mediaId ? `assets/exercises/${reviewed.mediaId}.webp` : null;
  const expectedBg = reviewed?.mediaId ? mediaBg[reviewed.mediaId] : null;
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

const mediaRows = EXERCISE_LIBRARY.filter(exercise => exercise.media);
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
assert(mediaRows.length === 20 && Object.keys(curation.entries).filter(id => curation.entries[id].mediaId).length === 20,
  "only 20 explicit exact-movement UUID mappings carry licensed artwork", `${mediaRows.length} mapped`);
assert(invalidMediaMappings.length === 0, "each artwork path is backed by its reviewed UUID/name/background mapping",
  invalidMediaMappings.map(exercise => exercise.id).join(", "));
assert(EXERCISE_LIBRARY.filter(exercise => !exercise.media && exercise.mediaBg == null).length === 1325,
  "the other 1,325 source movements retain the empty media tile");
assert(mediaFiles.length === 96 && unreferencedFiles.length === 76,
  "all 96 licensed files stay closed and 76 unmatched files remain unreferenced",
  `${mediaFiles.length} files; ${unreferencedFiles.length} unreferenced`);
assert(isDeepStrictEqual(mediaFileIds, licensedMediaIds),
  "the existing sampled-media allowlist still defines the complete licensed file set");
assert(EXERCISE_LIBRARY.every(exercise => exercise.media || exercise.mediaBg == null),
  "unmapped movements carry no fallback image or field color");

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
  const native=nativeSourceAssets(ROOT);
  const runtime=[
    'src/training/identity.js','src/training/generation/internal/candidates.js','src/training/generation/internal/layout.js',
    'src/platform/motion.js','src/training/progress.js','exercises.js','src/training/generation.js',
    'src/training/authoring.js','src/training/workout.js','src/training/generation/internal/transition.js',
    'src/platform/program-executor.js','src/platform/program-worker.js','src/platform/install.js',
    'src/persistence/durable.js','src/platform/catalog.js','src/bootstrap.js','app.js',
  ];
  const missingNative=runtime.filter(file=>file.startsWith('src/')&&!native.includes(file));
  const missingCache=native.filter(file=>!sw.includes(JSON.stringify('./'+file)));
  const appEntry=index.match(/<link\b[^>]*\brel="taurifer-entry"[^>]*\bhref="(app\.js\?v=\d+)"/i)?.[1];
  const bootstrapEntry=index.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="(src\/bootstrap\.js)"/i)?.[1];
  const app=readFileSync(join(ROOT,'app.js'),'utf8');
  assert(cacheRevision > expectedBaseRevision,
    `service-worker cache advances beyond repforge-v${expectedBaseRevision}`,
    `got ${cacheRevision}`);
  assert(!!appEntry&&!!bootstrapEntry&&!/<script\b[^>]*\bsrc="app\.js/.test(index)&&missingNative.length===0,
    'the HTML app entry is native ESM and the complete successor runtime has discoverable native paths',missingNative.join(', '));
  assert(missingCache.length===0,
    'every native browser/Worker dependency is precached for raw-source offline launch',missingCache.join(', '));
  assert(!/<script\b[^>]*\bsrc="exercises\.js(?:[?"])/.test(index)&&
    /import[^;]*from ['"]\.\/exercises\.js['"]/.test(app)&&
    /import[^;]*from ['"]\.\/src\/platform\/catalog\.js['"]/.test(app),
    'ESM imports give consumers synchronous index access and the explicit lazy catalog owner without classic-script ordering');
  assert(sw.includes('"./assets/exercise-catalog.json?v=067"'),
    'the pinned lazy detail asset remains available to the source offline shell');
  assert(sw.includes('"./src/platform/catalog.js"'),
    'the actual native catalog owner is available to the source offline shell');

  // Exercise the real release assembler on the actual graph. Isolated staging
  // avoids mutating dist/ or racing another release/build gate.
  const staged=mkdtempSync(join(tmpdir(),'taurifer-catalog-release-'));
  try {
    const htmlRuntime=[...index.matchAll(/<(?:script\b[^>]*\bsrc|link\b[^>]*\brel="(?:stylesheet|taurifer-entry)"[^>]*\bhref)="([^"]+)"/g)]
      .map(([,url])=>new URL(url,'https://catalog.test/').pathname.slice(1));
    const files=new Set([...native,...runtime,...htmlRuntime,'index.html','manifest.webmanifest','i18n.js','assets/exercise-catalog.json',
      ...mediaFiles.map(file=>'assets/exercises/'+file)]);
    for(const file of files){mkdirSync(dirname(join(staged,file)),{recursive:true});copyFileSync(join(ROOT,file),join(staged,file))}
    const manifest=assembleRelease(staged),base=`releases/${manifest.id}/`;
    const required=new Map(manifest.required.map(asset=>[asset.url,asset]));
    const pinned=file=>{
      const asset=required.get(base+file);
      return !!asset&&asset.sha256===createHash('sha256').update(readFileSync(join(ROOT,file))).digest('hex')&&
        readFileSync(join(staged,asset.url)).equals(readFileSync(join(ROOT,file)));
    };
    assert(/^[a-f0-9]{24}$/.test(manifest.id)&&runtime.every(pinned),
      'the complete native successor runtime has immutable required release paths with exact source-byte hashes');
    const published=readFileSync(join(staged,'index.html'),'utf8');
    const validPublished = (html, inventory = required) =>
      html.includes(`rel="taurifer-entry" href="${base}${appEntry}"`) &&
      html.includes(`type="module" src="${base}${bootstrapEntry}"`) &&
      htmlRuntime.every(file => {
        const asset = inventory.get(base + file);
        return !!asset && asset.sha256 === createHash('sha256').update(readFileSync(join(ROOT,file))).digest('hex') &&
          readFileSync(join(staged,asset.url)).equals(readFileSync(join(ROOT,file)));
      });
    assert(validPublished(published),
      'each exact HTML runtime URL resolves inside its required immutable release with source-byte hashes');
    assert(!validPublished(published.replace('rel="taurifer-entry"', 'rel="invalid-entry"')) &&
      !validPublished(published.replace(`href="${base}${appEntry}"`, `href="${appEntry}"`)) &&
      !validPublished(published.replace('type="module" src=', 'type="text/javascript" src=')),
      'entry marker, release-relative href and deferred module bootstrap corruptions are rejected');
    const missingBootstrap = new Map(required); missingBootstrap.delete(base + 'src/bootstrap.js');
    const wrongEntryHash = new Map(required); wrongEntryHash.set(base + 'app.js', {...required.get(base + 'app.js'), sha256: '0'.repeat(64)});
    assert(!validPublished(published, missingBootstrap) && !validPublished(published, wrongEntryHash),
      'a missing required bootstrap and a corrupted entry byte hash are rejected');
    assert(pinned('src/training/generation.js')&&pinned('src/training/generation/internal/compiler.js'),
      'the actual compiler entry and implementation remain required offline assets');
    assert(pinned('src/training/authoring.js')&&pinned('src/training/authoring/internal/entry.js')&&pinned('src/training/authoring/internal/adapter.js'),
      'the native program-entry owner and adapter remain required offline assets');
    assert(pinned('src/platform/install.js'),'the actual install policy remains a required offline asset');
    assert(pinned('src/platform/catalog.js')&&pinned('exercises.js')&&pinned('assets/exercise-catalog.json'),
      'catalog owner, synchronous UUID index and complete source bytes are required in the same release');
    const catalogAsset=new URL('../../assets/exercise-catalog.json?v=067',`https://catalog.test/${base}src/platform/catalog.js`);
    const exerciseModule=new URL('./exercises.js',`https://catalog.test/${base}${appEntry}`);
    assert(required.has(catalogAsset.pathname.slice(1))&&required.has(exerciseModule.pathname.slice(1)),
      'native relative catalog/data URLs resolve to the same immutable offline release');
    const worker=readFileSync(join(staged,'sw.js'),'utf8');
    assert(/registration\.scope/.test(sw)&&/SCOPE_PATH/.test(sw)&&/registration\.scope/.test(worker),
      'source and assembled service-worker shell matching remain relative to production scope');
  } finally {rmSync(staged,{recursive:true,force:true})}

}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
