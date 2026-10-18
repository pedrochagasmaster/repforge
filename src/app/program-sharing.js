import {copySnapshot} from './session.js';
import {programFile} from '../interchange/program-file.js';
import {programTextFile} from '../interchange/program-text.js';
import {programDayMuscles} from './read-models.js';
/** @typedef {ReturnType<typeof import('../training/model.js').createProgramModel>} Model
 * @typedef {ReturnType<typeof import('../interchange/setup-link.js').createSetupLinkCodec>} Codec
 * @typedef {NonNullable<ReturnType<Model['canonicalProgramDefinition']>>} Definition
 * @typedef {import('../interchange/program-text.js').Meta & {id?:string,blockId?:string,programDefinition?:Definition}} Meta
 * @typedef {{program:import('../training/model/internal/contracts.js').ExerciseInput[],programMeta?:Meta,customExercises:import('../training/model/internal/contracts.js').LibraryEntry[],settings:{jumpPct:number,minJump:number,rirHigh:number,hardRir:number,restSec:number,unit:string,lang?:string,rirMode:string}}} SharingSnapshot
 * @typedef {{program_kind:string,form:string,size_vs_limit:string}} ShareOutcome
 * @typedef {{status:"ready",url:string,outcome:ShareOutcome}|{status:"error",code:string,fileFallback?:boolean,outcome?:ShareOutcome}} LinkResult
 */
/** Each outbound value captures one published snapshot. Encoding never writes
 * installed state or persists UI preferences/identity into a program payload.
 * @param {{read:()=>SharingSnapshot,model:Model,codec:Codec,codecOptions:import('../interchange/setup-link.js').Options,date:()=>string,language:()=>string,locale:()=>string,location:{hostname:string,href:string},format:{t:(key:string,vars?:Record<string,unknown>)=>string,muscleLabel:(name:string)=>string,exerciseName:(row:import('../interchange/program-text.js').Row)=>string}}} options */
export function createProgramSharing({read,model,codec,codecOptions,date,language,locale,location,format}){
  function buildValidation(){
    const snapshot=copySnapshot(read()),definition=snapshot.programMeta?.programDefinition;
    if(!definition)throw new TypeError('Shared setup needs a program definition');
    const referenced=new Set(model.definitionMovementIds(definition).filter(model.isCustomLibraryId));
    const customs=model.compilerCustomDefinitions(snapshot.customExercises.filter(entry=>referenced.has(entry.id)));
    const source=snapshot.settings;
    const settings={jumpPct:source.jumpPct,minJump:source.minJump,rirHigh:source.rirHigh,hardRir:source.hardRir,
      restSec:source.restSec,unit:source.unit,lang:source.lang||language()||'en',rirMode:source.rirMode};
    return{payload:{kind:codec.KIND,version:codec.VERSION,program:{name:snapshot.programMeta?.name||format.t('untitled_program'),
      definition:copySnapshot(definition),...(customs.length?{customExercises:customs}:{})},settings,language:settings.lang},diagnostics:{}};
  }
  function buildPayload(){return buildValidation().payload}
  function file(){const snapshot=copySnapshot(read());return programFile({definition:snapshot.programMeta?.programDefinition,name:snapshot.programMeta?.name,customExercises:snapshot.customExercises,date:date()})}
  function text(){
    const snapshot=copySnapshot(read()),meta=snapshot.programMeta;
    const program=model.makeProgram(snapshot.program,model.snapshotLookup(snapshot.customExercises),meta),rows=program.toJSON();
    const week=model.mesocycleLifecycle(meta).current;
    const scheduledRows=meta?.programDefinition&&week!=null?model.flatProgramFromDefinition(meta.programDefinition,snapshot.customExercises,week)||rows:rows;
    const days=program.days().map(name=>({name,rows:program.forDay(name).map(row=>row.toJSON()),muscles:programDayMuscles(scheduledRows,name).map(format.muscleLabel)}));
    return programTextFile({name:meta?.name,meta,rows,days,model,date:date(),locale:locale(),format});
  }
  /** @param {import('../interchange/setup-link.js').Definition} definition @param {unknown} encoded @returns {ShareOutcome} */
  function outcome(definition,encoded){
    const transport=encoded&&typeof encoded==='object'?encoded:{};
    const generated=definition.provenance?.source!=='manual'&&typeof definition.request?.goal==='string';
    const form='form' in transport&&transport.form==='recipe'?'recipe':'full';
    const program_kind=definition.provenance?.source==='manual'?'manual':generated?(form==='recipe'?'generated':'generated_edited'):'other';
    const chars=Number('encodedChars' in transport?transport.encodedChars:undefined),ratio=Number.isFinite(chars)?chars/codec.MAX_ENCODED_CHARS:Infinity;
    return{program_kind,form,size_vs_limit:ratio<=.5?'under_half':ratio<=1?'under_limit':ratio<=2?'over_limit':ratio<=4?'over_2x':'over_4x'};
  }
  /** @returns {Promise<LinkResult>} */
  async function link(){
    let built;try{built=buildValidation()}catch{return{status:'error',code:'invalid-program'};}
    const checked=codec.validate(built.payload,codecOptions);if(!checked.ok)return{status:'error',code:checked.code};
    let encoded;try{encoded=await codec.encode(checked.value,codecOptions)}catch{return{status:'error',code:'compression-unavailable'};}
    const facts=outcome(checked.value.program.definition,encoded);
    if(!encoded.ok)return{status:'error',code:encoded.code||'invalid-program',fileFallback:encoded.code==='encoded-too-large',outcome:facts};
    const local=/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(location.hostname);
    const url=new URL('index.html',local?location.href:'https://pedrochagasmaster.github.io/repforge/index.html');url.search='';url.hash=`setup=${encoded.value}`;
    return{status:'ready',url:url.href,outcome:facts};
  }
  return Object.freeze({buildValidation,buildPayload,file,text,link});
}
