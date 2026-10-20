import Identity, { sha256Text } from "../training/identity.js";
export const CATALOG_URL = new URL("../../assets/exercise-catalog.json?v=067", import.meta.url).href;
/** @typedef {Record<string,unknown> & {id:string,exerciseMetrics?:string[],resistanceEquipmentGroupIds?:string[],supportEquipmentGroupIds?:string[]}} CatalogExercise
 * @typedef {Record<string,unknown> & {type:string,equipment?:string[],pluralOf?:string|null}} CatalogObject
 * @typedef {{exercises:CatalogExercise[],uuidIndex:Record<string,CatalogObject>,generatedAt:string}} CatalogSnapshot
 * @typedef {{id:string,name:string,namePt?:string,aliases?:string[],[key:string]:unknown}} LibraryExercise
 * @typedef {{kind:'matched',by:'canonical'|'alias',exercise:LibraryExercise}|{kind:'ambiguous',by:'canonical'|'alias',exercises:LibraryExercise[]}|{kind:'not-found',by:null,exercises:[]}} NameResolution
 * @typedef {{library?:LibraryExercise[],catalogSha256?:string}} LibrarySource
 * @typedef {(url:string)=>Promise<{ok:boolean,text:()=>Promise<string>}>} CatalogFetch
 */
/** One catalog lifetime per app/worker; failed loads retry, verified snapshots freeze.
 * @param {{identity?:{prepareCatalog:(catalog:CatalogSnapshot)=>unknown},librarySource?:LibrarySource,catalogSha256?:string,fetcher?:CatalogFetch|null,assetUrl?:string}} options */
export function createCatalog({identity=Identity,librarySource={library:[]},catalogSha256=librarySource.catalogSha256,fetcher=(url)=>globalThis.fetch(url),assetUrl=CATALOG_URL}={}) {


/** @type {Promise<CatalogSnapshot>|null} */
let loadPromise = null;
/** @type {CatalogSnapshot|null} */
let rawCatalog = null;
/** @type {Map<string,CatalogExercise>|null} */
let exerciseById = null;

function library() { return Array.isArray(librarySource.library) ? librarySource.library : []; }

function requireSnapshot() {
  if (!rawCatalog) throw new Error("Await RepForgeExerciseCatalog.load() before reading catalog details");
  return rawCatalog;
}

/** @param {unknown} value @returns {value is Record<string,unknown>} */
function record(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
/** @param {unknown} value @returns {value is string[]} */
function strings(value){return Array.isArray(value)&&value.every(item=>typeof item==='string')}
/** The release pin validates bytes; this guard establishes the fields this
 * public reader actually consumes. Unknown catalog fields remain untouched.
 * @param {unknown} value @returns {value is CatalogSnapshot} */
function validCatalog(value) {
  if(!record(value)||!Array.isArray(value.exercises)||!record(value.uuidIndex)||typeof value.generatedAt!=='string')return false;
  if(!value.exercises.every(exercise=>record(exercise)&&typeof exercise.id==='string'&&
    ['exerciseMetrics','resistanceEquipmentGroupIds','supportEquipmentGroupIds'].every(key=>exercise[key]===undefined||strings(exercise[key]))))return false;
  return Object.values(value.uuidIndex).every(object=>record(object)&&typeof object.type==='string'&&
    (object.equipment===undefined||strings(object.equipment))&&
    (object.pluralOf==null||typeof object.pluralOf==='string'));
}

function expectedCatalogSha256() { return catalogSha256; }
/** @param {string} text */
async function sha256(text) { return sha256Text(text); }

/** @returns {Promise<CatalogSnapshot>} */
function load() {
  if (!loadPromise) {
    const attempt = Promise.resolve().then(() => {
      if (typeof fetcher !== "function") throw new Error("Fetch is unavailable for the local exercise catalog");
      return fetcher(assetUrl);
    }).then(response => {
      if (!response || response.ok !== true) throw new Error("The local exercise catalog could not be loaded");
      if (typeof response.text !== "function") throw new Error("The local exercise catalog response has no text body");
      return response.text();
    }).then(async sourceText => {
      if (typeof sourceText !== "string") throw new Error("The local exercise catalog has an invalid body");
      const expected = expectedCatalogSha256();
      if (!/^[0-9a-f]{64}$/.test(String(expected || "")))
        throw new Error("The local exercise catalog has no release integrity pin");
      if (await sha256(sourceText) !== expected)
        throw new Error("The local exercise catalog failed its release integrity check");
      /** @type {unknown} */let value;
      try { value = JSON.parse(sourceText); }
      catch { throw new Error("The local exercise catalog is not valid JSON"); }
      if (!validCatalog(value)) throw new Error("The local exercise catalog has an invalid shape");
            if (!identity) throw new Error("The catalog identity module is unavailable");
      identity.prepareCatalog(value);
      rawCatalog = value;
      exerciseById = new Map(value.exercises.map(exercise => [exercise.id, exercise]));
      return value;
    });
    const retryable = attempt.catch(error => {
      if (loadPromise === retryable) loadPromise = null;
      throw error;
    });
    loadPromise = retryable;
  }
  return loadPromise;
}

function snapshot() {
  return requireSnapshot();
}

/** @param {unknown} id */
function getExercise(id) {
  requireSnapshot();
  if (typeof id !== "string") return null;
  return /** @type {Map<string,CatalogExercise>} */(exerciseById).get(id) || null;
}

/** @param {unknown} id */
function getObject(id) {
  const data = requireSnapshot();
  if (typeof id !== "string") return null;
  return Object.hasOwn(data.uuidIndex, id) ? data.uuidIndex[id] : null;
}

function listExercises() {
  return library();
}

/** @param {string|Iterable<unknown>|null|undefined} ids @returns {Set<string>} */
function equipmentClosure(ids) {
  const data = requireSnapshot();
  const queue = typeof ids === "string" ? [ids] :
    ids && typeof ids[Symbol.iterator] === "function" ? [...ids] : [];
  /** @type {Set<string>} */const closed = new Set();

  for (const id of queue) {
    let current = id;
    /** @type {Set<string>} */const chain = new Set();
    while (typeof current === "string" && !chain.has(current)) {
      chain.add(current);
      const equipment = Object.hasOwn(data.uuidIndex, current) ? data.uuidIndex[current] : null;
      if (!equipment || equipment.type !== "equipment") break;
      closed.add(current);
      current = equipment.pluralOf;
    }
  }
  return closed;
}

/** @param {string} requirementId @param {ReadonlySet<string>} availableEquipment @param {Record<string,CatalogObject>} index */
function requirementSatisfied(requirementId, availableEquipment, index) {
  const requirement = Object.hasOwn(index, requirementId) ? index[requirementId] : null;
  if (!requirement) return false;
  if (requirement.type === "equipment") return availableEquipment.has(requirementId);
  if (requirement.type === "resistanceEquipmentGroup" || requirement.type === "supportEquipmentGroup") {
    return Array.isArray(requirement.equipment) && requirement.equipment.length > 0 &&
      requirement.equipment.every(id => availableEquipment.has(id));
  }
  return false;
}

/** @param {unknown} requirements @param {ReadonlySet<string>} availableEquipment @param {Record<string,CatalogObject>} index */
function alternativesSatisfied(requirements, availableEquipment, index) {
  if (!Array.isArray(requirements)) return false;
  if (requirements.length === 0) return true;
  return requirements.some(id => requirementSatisfied(id, availableEquipment, index));
}

/** @param {string|CatalogExercise|null|undefined} exercise @param {string|Iterable<unknown>|null|undefined} ids */
function isAvailable(exercise, ids) {
  const data = requireSnapshot();
  const record = typeof exercise === "string" ? getExercise(exercise) : exercise;
  if (!record || typeof record !== "object") return false;
  const availableEquipment = equipmentClosure(ids);
  return alternativesSatisfied(record.resistanceEquipmentGroupIds, availableEquipment, data.uuidIndex) &&
    alternativesSatisfied(record.supportEquipmentGroupIds, availableEquipment, data.uuidIndex);
}

/** @param {unknown} id @returns {Array<CatalogObject & {type:"exerciseMetric"}>|null} */
function metricsFor(id) {
  const exercise = getExercise(id);
  if (!exercise) return null;
  if (!Array.isArray(exercise.exerciseMetrics)) return null;
  const data = requireSnapshot();
  const metrics = exercise.exerciseMetrics.map(metricId =>
    Object.hasOwn(data.uuidIndex, metricId) ? data.uuidIndex[metricId] : null);
  if (metrics.some(metric => !metric || metric.type !== "exerciseMetric")) return null;
  return /** @type {Array<CatalogObject & {type:"exerciseMetric"}>} */(metrics);
}

/** @param {unknown} value */
function normalizeName(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("en") : "";
}

/** @param {unknown} name @returns {NameResolution} */
function resolveName(name) {
  const query = normalizeName(name);
  if (!query) return { kind: "not-found", by: null, exercises: [] };
  const entries = library();
  const canonical = entries.filter(exercise => normalizeName(exercise.name) === query);
  if (canonical.length === 1) return { kind: "matched", by: "canonical", exercise: canonical[0] };
  if (canonical.length > 1) return { kind: "ambiguous", by: "canonical", exercises: canonical };

  const aliases = entries.filter(exercise =>
    [exercise.namePt, ...(exercise.aliases || [])]
      .some(alias => normalizeName(alias) === query));
  if (aliases.length === 1) return { kind: "matched", by: "alias", exercise: aliases[0] };
  if (aliases.length > 1) return { kind: "ambiguous", by: "alias", exercises: aliases };
  return { kind: "not-found", by: null, exercises: [] };
}

/** @param {unknown} query */
function search(query) {
  const needle = normalizeName(query);
  if (!needle) return [];
  return library().filter(exercise =>
    [exercise.name, exercise.namePt, ...(exercise.aliases || [])]
      .some(term => normalizeName(term).includes(needle)));
}

const api = {
  load,
  snapshot,
  getExercise,
  getObject,
  listExercises,
  equipmentClosure,
  isAvailable,
  metricsFor,
  resolveName,
  search,
};

return Object.freeze(api);
}
