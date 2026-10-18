import {cloneSnapshot} from './json.js';
export {boundedImportJson,importUtf8Bytes,PROGRAM_MAX_BYTES,PROGRAM_MAX_NODES} from './json.js';
export const PROGRAM_FILE_KIND='taurifer-program',PROGRAM_FILE_VERSION=4;
export const fileSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
export function definitionMovementIds(definition){
  return(definition?.days||[]).flatMap(day=>(day?.slots||[]).flatMap(slot=>
    [slot?.exerciseId,...(Array.isArray(slot?.alternates)?slot.alternates:[])])).filter(id=>typeof id==='string'&&id);
}
/** Source definition plus only referenced custom definitions, including alternates.
 * Installation, lifecycle, workouts, profile and settings belong to other formats. */
export function programFile({definition,name,customExercises,date}){
  if(!definition)return null;
  const referenced=new Set(definitionMovementIds(definition).filter(id=>id.startsWith('custom:')));
  const payload={kind:PROGRAM_FILE_KIND,version:PROGRAM_FILE_VERSION,name:name||'',definition:cloneSnapshot(definition),
    customExercises:customExercises.filter(entry=>referenced.has(entry.id)).map(cloneSnapshot)};
  const slug=fileSlug(name);
  return{text:JSON.stringify(payload),name:`taurifer_program_${slug?`${slug}_`:''}${date}.json`};
}
/** Canonical parsing uses the same authoring/domain projection as activation.
 * This boundary does not match UUIDs by name or mutate the current library. */
export function parseCanonicalProgramFile(parsed,{validImportedCustomExercise,normalizeCustomExercises,canonicalProgramDefinition,flatProgramFromDefinition}){
  if(parsed.version!==PROGRAM_FILE_VERSION)return null;
  const customs=Array.isArray(parsed.customExercises)?parsed.customExercises:[];
  if(!customs.every(validImportedCustomExercise))return null;
  const normalizedCustoms=normalizeCustomExercises(customs);
  const definition=canonicalProgramDefinition(parsed.definition,normalizedCustoms);
  if(!definition)return null;
  return{format:'json',legacy:false,exercises:flatProgramFromDefinition(definition,normalizedCustoms,1),
    customExercises:normalizedCustoms,meta:{name:String(parsed.name||'').slice(0,80)},definition};
}
/** Historical program-only/backup shape recognition; validation follows in the
 * authoring import pipeline. A whole backup must use the distinct backup door. */
export function parseProgramImport(parsed){
  const custom=Array.isArray(parsed?.customExercises)?parsed.customExercises:[];
  if(Array.isArray(parsed))return{exercises:parsed,meta:null,customExercises:[]};
  const meta=parsed?.meta??parsed?.programMeta??null;
  if(Array.isArray(parsed?.exercises))return{exercises:parsed.exercises,meta,customExercises:custom};
  if(Array.isArray(parsed?.program))return{exercises:parsed.program,meta,customExercises:custom};
  return null;
}

export * as unsupportedGrammar from './unsupported-grammar.js';
