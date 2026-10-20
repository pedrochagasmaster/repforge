import {cloneSnapshot,boundedImportJson,importUtf8Bytes,PROGRAM_MAX_BYTES} from './json.js';
export {boundedImportJson,importUtf8Bytes,PROGRAM_MAX_BYTES,PROGRAM_MAX_NODES,IMPORT_MAX_DEPTH} from './json.js';
export const PROGRAM_FILE_KIND='taurifer-program',PROGRAM_FILE_VERSION=4;
/** @param {unknown} s */
export const fileSlug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
/** @typedef {{days?:Array<{slots?:Array<{exerciseId?:unknown,alternates?:unknown}>}>,[key:string]:unknown}} ProgramDefinition
 * @typedef {{id:string,[key:string]:unknown}} CustomDefinition */
/** @param {ProgramDefinition|null|undefined} definition @returns {string[]} */
export function definitionMovementIds(definition){
  return(definition?.days||[]).flatMap(day=>(day?.slots||[]).flatMap(slot=>
    [slot?.exerciseId,...(Array.isArray(slot?.alternates)?slot.alternates:[])])).filter((/** @type {unknown} */ id)=>typeof id==='string'&&Boolean(id));
}
/** Source definition plus only referenced custom definitions, including alternates.
 * Installation, lifecycle, workouts, profile and settings belong to other formats. */
/** @param {{definition?:ProgramDefinition|null,name?:string,customExercises?:CustomDefinition[],date?:string}} input */
export function programFile({definition,name,customExercises=[],date}){
  if(!definition)return null;
  const referenced=new Set(definitionMovementIds(definition).filter(id=>id.startsWith('custom:')));
  const payload={kind:PROGRAM_FILE_KIND,version:PROGRAM_FILE_VERSION,name:name||'',definition:cloneSnapshot(definition),
    customExercises:customExercises.filter(entry=>referenced.has(entry.id)).map(cloneSnapshot)};
  const slug=fileSlug(name);
  return{text:JSON.stringify(payload),name:`taurifer_program_${slug?`${slug}_`:''}${date}.json`};
}
/** Canonical parsing uses the same authoring/domain projection as activation.
 * This boundary does not match UUIDs by name or mutate the current library. */
/** @param {{version?:unknown,customExercises?:unknown,definition?:unknown,name?:unknown}} parsed
 * @param {{validImportedCustomExercise:(value:unknown)=>boolean,normalizeCustomExercises:(value:unknown[])=>CustomDefinition[],canonicalProgramDefinition:(value:unknown,customs:CustomDefinition[])=>ProgramDefinition|null,flatProgramFromDefinition:(definition:ProgramDefinition,customs:CustomDefinition[],cycle:number)=>unknown[]}} rules */
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
/** @param {unknown} input */
export function parseProgramImport(input){
  const parsed=/** @type {{customExercises?:unknown,meta?:unknown,programMeta?:unknown,exercises?:unknown,program?:unknown}|null|undefined} */(input);
  const custom=Array.isArray(parsed?.customExercises)?parsed.customExercises:[];
  if(Array.isArray(input))return{exercises:input,meta:null,customExercises:[]};
  const meta=parsed?.meta??parsed?.programMeta??null;
  if(Array.isArray(parsed?.exercises))return{exercises:parsed.exercises,meta,customExercises:custom};
  if(Array.isArray(parsed?.program))return{exercises:parsed.program,meta,customExercises:custom};
  return null;
}

export * as unsupportedGrammar from './unsupported-grammar.js';

/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} ProgramModel
 * @typedef {import('../training/model.js').ExerciseInput} ImportedRow
 * @typedef {{exercises:ImportedRow[],customExercises:unknown[],meta:unknown,format:'json'|'text',legacy?:boolean,definition?:import('../training/model.js').ProgramDefinition}} ProgramSource
 * @typedef {Record<string,unknown>&{day:string,name:string,sets:number,order?:number,min?:number,max?:number,repLow?:number,repHigh?:number}} LegacyRow
 */
export const PROGRAM_TEXT_DATA_MARKER='TAURIFER-DATA';
/** Parse only released program formats. Freeform assistant replies reuse this
 * exact validator after extracting their envelope; matching belongs to review.
 * @param {{model:ProgramModel,rules:Pick<ReturnType<typeof import('../training/authoring.js').createEntryRules>,'normalizeMuscleAttribution'>,locale:()=>string}} bindings */
export function createProgramSource({model,rules,locale}){
 /** @param {unknown} value @returns {value is Record<string,unknown>} */
 const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 /** @param {unknown} value @returns {value is string} */
 const text=value=>typeof value==='string'&&value.trim().length>0;
 /** @param {unknown} value @param {number} min @param {number} max @returns {value is number} */
 const integer=(value,min,max)=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;
 /** @param {Record<string,unknown>} row @param {boolean} [canonical] */
 function muscles(row,canonical=false){
  for(const key of ['primary','secondary']){
   if(!Object.prototype.hasOwnProperty.call(row,key))continue;
   const checked=rules.normalizeMuscleAttribution(row[key]);
   if(!checked.ok||(canonical&&checked.value!==row[key]))return false;
  }
  return true;
 }
 /** @param {unknown} value */
 function validCustom(value){return record(value)&&muscles(value)}
 /** The optional legacy aliases must themselves be valid. A well-formed
  * repLow cannot conceal a malformed canonical min.
  * @param {unknown} value @returns {value is LegacyRow} */
 function validRaw(value){
  if(!record(value))return false;
  for(const key of ['min','max','repLow','repHigh'])if(Object.prototype.hasOwnProperty.call(value,key)&&!integer(value[key],1,1000))return false;
  const min=integer(value.min,1,1000)?value.min:value.repLow,max=integer(value.max,1,1000)?value.max:value.repHigh;
  return text(value.day)&&text(value.name)&&integer(value.sets,1,100)&&integer(min,1,1000)&&integer(max,min,1000)&&
   (value.order===undefined||integer(value.order,1,1000))&&(value.libraryId===undefined||text(value.libraryId))&&muscles(value);
 }
 /** @param {LegacyRow[]} rows @returns {ImportedRow[]|null} */
 function normalizeRows(rows){
  /** @type {Map<string,number>} */const orders=new Map();
  /** @type {ImportedRow[]} */const normalized=[];
  for(const row of rows){
   const out={...row};
   if(out.order===undefined){const next=(orders.get(out.day)||0)+1;orders.set(out.day,next);out.order=next}
   if(out.min===undefined&&integer(out.repLow,1,1000))out.min=out.repLow;
   if(out.max===undefined&&integer(out.repHigh,1,1000))out.max=out.repHigh;
   for(const key of ['primary','secondary'])if(Object.prototype.hasOwnProperty.call(out,key)){const checked=rules.normalizeMuscleAttribution(out[key]);if(!checked.ok)return null;out[key]=checked.value}
   if(!integer(out.order,1,1000)||!integer(out.min,1,1000)||!integer(out.max,out.min,1000)||!muscles(out,true))return null;
   normalized.push(out);
  }
  return normalized;
 }
 /** @param {string} label */
 function restoreCase(label){
  if(label!==label.toLocaleUpperCase(locale())||!/[a-z]/i.test(label))return label;
  return label.toLocaleLowerCase(locale()).replace(/(^|\s)(\p{L})/gu,(_,space,letter)=>space+letter.toLocaleUpperCase(locale()));
 }
 /** @param {string} label */
 function stripTitle(label){return label.replace(/\s*(?:\(\s*|,\s*)\d+\s*(?:days?\s*\/\s*week|days?\s+per\s+week|dias?\s*\/\s*semana|dias?\s+por\s+semana)\s*\)?\s*$/iu,'').trim()}
 /** @param {string} value @returns {ProgramSource|null} */
 function parseText(value){
  const lines=value.split(/\r?\n/),dataIndex=lines.findIndex(line=>line.trim()===PROGRAM_TEXT_DATA_MARKER);
  /** @type {Record<string,unknown>|null} */let data=null;
  if(dataIndex>=0){try{/** @type {unknown} */const parsed=JSON.parse(lines[dataIndex+1]||'');if(record(parsed)&&parsed.version===1)data=parsed}catch{}}
  const content=dataIndex<0?lines:lines.filter((_,index)=>index!==dataIndex&&index!==dataIndex+1);
  /** @type {{day:string,rows:ImportedRow[]}[]} */const days=[];
  /** @type {{day:string,rows:ImportedRow[]}|null} */let current=null;
  let title='';
  const pattern=/^\s*(\d+)\.\s*(.+?)(?:\s*[—-]\s*|\s*:\s*)(\d+)\s*[×x]\s*(\d+)(?:\s*(?:[–-]|to|a)\s*(\d+))?\s*$/iu;
  for(const raw of content){
   const line=raw.trim();if(!line)continue;
   const match=line.match(pattern);
   if(match){
    if(!current){current={day:`Day ${days.length+1}`,rows:[]};days.push(current)}
    const legacy=match[2].trim().match(/^(.*)\s+\[(range|manual|rep_goal|anchor_backoff)@(\d+)\]$/iu);
    const row={name:(legacy?.[1]||match[2]).trim(),sets:+match[3],min:+match[4],max:match[5]?+match[5]:+match[4]};
    current.rows.push(legacy?.[2].toLowerCase()==='range'&&legacy[3]==='1'?{...row,progression:{schemaVersion:1,strategy:{id:'range',version:1,params:{workingSets:row.sets,repMin:row.min,repMax:row.max}},modifiers:[]}}:row);
    continue;
   }
   if(!title&&!days.length){title=restoreCase(stripTitle(line));continue}
   const label=line.split(/\s*[—-]\s+|\s*:\s+/)[0].trim();if(!label)continue;
   current={day:restoreCase(label),rows:[]};days.push(current);
  }
  const carried=Array.isArray(data?.exercises)?data.exercises.filter(record):[];
  /** @type {ImportedRow[]} */const exercises=[];
  for(const day of days)day.rows.forEach((row,index)=>{
   const saved=carried.find(item=>item.day===day.day&&item.order===index+1);
   // The appendix preserves authored progression and identity. No executable
   // strategy is guessed from an unsupported legacy display marker.
   exercises.push({...row,day:day.day,order:index+1,
    ...(saved?.id?{id:String(saved.id)}:{}),...(saved?.movementId?{movementId:String(saved.movementId)}:{}),
    ...(saved?.progression?{progression:saved.progression}:{}),...(saved?.progressionIncompatibility?{progressionIncompatibility:saved.progressionIncompatibility}:{})});
  });
  if(!exercises.length)return null;
  /** @type {Record<string,unknown>|null} */const meta=title?{name:title}:null;
  if(meta&&data){if(Array.isArray(data.relations))meta.progressionRelations=data.relations;if(Array.isArray(data.modifiers))meta.progressionModifiers=data.modifiers;if(Array.isArray(data.incompatibilities))meta.progressionIncompatibilities=data.incompatibilities}
  return{exercises,meta,customExercises:[],format:'text'};
 }
 /** @param {unknown} value @param {string} [_fileName] @returns {ProgramSource|null} */
 function parse(value,_fileName=''){
  const source=String(value||'').trim();
  if(source.startsWith('{')||source.startsWith('[')){
   const parsed=boundedImportJson(source);if(parsed===null)return null;
   if(record(parsed)&&parsed.kind===PROGRAM_FILE_KIND){
    if(parsed.version!==PROGRAM_FILE_VERSION)return null;
    const customs=Array.isArray(parsed.customExercises)?parsed.customExercises:[];
    if(!customs.every(validCustom))return null;
    const normalized=model.normalizeCustomExercises(customs),definition=model.canonicalProgramDefinition(parsed.definition,normalized);
    if(!definition)return null;
    return{exercises:model.flatProgramFromDefinition(definition,normalized,1),customExercises:normalized,meta:{name:String(parsed.name||'').slice(0,80)},definition,format:'json',legacy:false};
   }
   const imported=parseProgramImport(parsed);
   if(!imported?.exercises.length||!imported.exercises.every(validRaw)||!imported.customExercises.every(validCustom))return null;
   const exercises=normalizeRows(imported.exercises);if(!exercises)return null;
   return{exercises,customExercises:imported.customExercises,meta:imported.meta,format:'json',legacy:!record(parsed)||parsed.version===undefined};
  }
  if(importUtf8Bytes(source)>PROGRAM_MAX_BYTES)return null;
  return parseText(source);
 }
 return Object.freeze({parse,validCustom});
}
