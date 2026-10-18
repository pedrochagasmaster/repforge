// Fixture composition root. Import public production owners directly; never
// evaluate app.js, imitate the DOM, install browser globals or suppress boot.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createCatalog} from '../src/platform/catalog.js';
import {createGenerationRules} from '../src/training/generation.js';
import {createProgramModel} from '../src/training/model.js';
import {createEntryRules, createEntryAdapter} from '../src/training/authoring.js';
import {createWorkoutRules} from '../src/training/workout.js';
import metrics from '../src/training/metrics.js';
import {progression} from '../src/training/progress.js';
import {createSnapshotPolicy} from '../src/persistence/snapshot.js';
import {createDurableStore} from '../src/persistence/durable.js';
import {createTelemetry} from '../src/platform/telemetry.js';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);

export class MemoryStorage {
  #values=new Map();
  get length(){return this.#values.size;}
  key(index){return [...this.#values.keys()][index]??null;}
  getItem(key){return this.#values.get(String(key))??null;}
  setItem(key,value){this.#values.set(String(key),String(value));}
  removeItem(key){this.#values.delete(String(key));}
  clear(){this.#values.clear();}
}

// Only the platform boundary is in memory. All validation, serialization,
// mirror classification and reads/writes run through createDurableStore.
function memoryPlatform(localStorage) {
  const idbValues=new Map();
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  return {
    localStorage,
    navigator:{locks:{request:async(name,operation)=>operation()}},
    indexedDB:{open(){
      const request={};
      queueMicrotask(()=>{
        request.result={
          objectStoreNames:{contains:()=>true},createObjectStore(){},close(){},
          transaction(){
            const transaction={objectStore(){return {
              get(key){const result={};queueMicrotask(()=>{result.result=clone(idbValues.get(key));result.onsuccess?.();});return result;},
              put(value,key){idbValues.set(key,clone(value));queueMicrotask(()=>transaction.oncomplete?.());},
              delete(key){idbValues.delete(key);queueMicrotask(()=>transaction.oncomplete?.());},
            };}};
            return transaction;
          },
        };
        request.onupgradeneeded?.();request.onsuccess?.();
      });
      return request;
    }},
  };
}

/** Explicit fixture composition root. Every call has its own storage and
 * domain lifetimes; consumers destructure concrete public capabilities. */
export async function createFixtureRuntime() {
  const {EXERCISE_LIBRARY,LEGACY_LIBRARY_IDS,EXERCISE_CATALOG_SHA256}=require('../exercises.js');
  const librarySource={library:EXERCISE_LIBRARY,legacyIds:LEGACY_LIBRARY_IDS,catalogSha256:EXERCISE_CATALOG_SHA256};
  const generation=createGenerationRules();
  const catalogLoader=createCatalog({identity:generation.identity,librarySource,
    fetcher:async()=>({ok:true,text:async()=>readFileSync(join(ROOT,'assets/exercise-catalog.json'),'utf8')})});
  const catalogSnapshot=await catalogLoader.load();
  const Compiler=generation.compiler;
  const Adapter=createEntryAdapter({compiler:Compiler});
  const entry=createEntryRules(catalogSnapshot),WorkoutDraft=createWorkoutRules(catalogSnapshot);
  const now=()=> '2026-10-18T00:00:00.000Z';
  let generatedId=0;
  const nextId=()=>`fixture-generated-${++generatedId}`;
  const model=createProgramModel({catalog:catalogSnapshot,librarySource,nextId,now,language:'en',defaultExerciseName:'program.default.exercise'});
  // Use the existing language module's public normalization contract. No DOM
  // methods are invoked; fixture settings explicitly choose their language.
  const language=require('../i18n.js');
  const snapshotPolicy=createSnapshotPolicy({entry,metrics,workout:WorkoutDraft,compiler:Compiler,catalog:catalogSnapshot,model,
    transition:generation.transition,now,nextId,language:{normalizeLang:language.normalizeLang,detectLang:()=> 'en'},progression,
    digest:raw=>createHash('sha256').update(raw).digest('hex')});
  const localStorage=new MemoryStorage();
  const durable=createDurableStore({snapshotPolicy,workout:WorkoutDraft,platform:memoryPlatform(localStorage)});
  const available={
    normalizeLoaded:snapshotPolicy.normalizeLoaded,
    manualProgramDefinitionFromRows:model.manualProgramDefinitionFromRows,
    durableProgramRows:model.durableProgramRows,
    canonicalProgramDefinition:model.canonicalProgramDefinition,
    rawMetricDefinitions:model.rawMetricDefinitions,
    storageIO:durable.storageIO,readLocalStatus:durable.readLocalStatus,
    readIdbStatus:durable.readIdbStatus,chooseSnapshot:durable.chooseSnapshot,
  };
  return {...available,
    Compiler,Adapter,WorkoutDraft,Telemetry:createTelemetry(),catalogSnapshot,ROOT,localStorage,MemoryStorage};
}

/** Historical fixtures are saved-data evidence, not current generator goldens.
 * Check them through current public validators and both real replica writers;
 * never feed their obsolete request into generation to recapture new data. */
export async function verifyHistoricalState(state,{obsoleteGeneration=false}={}) {
  const {deepStrictEqual,ok}=await import('node:assert/strict');
  const api=await createFixtureRuntime();
  const definition=state.programMeta?.programDefinition;
  ok(definition,'historical fixture has a canonical definition');
  const canonical=api.canonicalProgramDefinition(definition,state.customExercises||[]);
  ok(canonical,'current public compiler accepts historical authored structure');
  deepStrictEqual(canonical,definition,'historical definition identity is unchanged');
  if(obsoleteGeneration){
    const result=api.Compiler.generateProgram(definition.request,api.catalogSnapshot);
    ok(!result.ok&&result.conflicts.some(conflict=>conflict.code==='unsupported_generation_domain'||conflict.code==='unknown_request_field'&&conflict.field==='seed'),
      'historical generator request remains explicitly outside current generation eligibility');
  }
  const normalized=api.normalizeLoaded(state);
  for(const field of ['program','programMeta','log','customExercises','programHistory'])if(Object.hasOwn(state,field))
    deepStrictEqual(normalized[field],state[field],`historical ${field} retains its complete saved meaning`);
  deepStrictEqual(api.normalizeLoaded(normalized),normalized,'current normalization is idempotent');
  ok(await api.storageIO.writeLocal(normalized),'real local writer accepts fixture');
  await api.storageIO.writeIdb(normalized);
  const local=api.readLocalStatus(),idb=await api.readIdbStatus();
  deepStrictEqual([local.status,idb.status],['valid','valid']);
  const selected=api.chooseSnapshot(local,idb);
  deepStrictEqual(selected.kind,'chosen');
  deepStrictEqual(api.normalizeLoaded(selected.snapshot),normalized,'real mirror round trip retains every normalized field');
  return normalized;
}
