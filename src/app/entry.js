export {createEntryActivation} from './entry/activation.js';
export {createEntrySetup} from './entry/setup.js';
export {createEntryReviewSession} from './entry/review-session.js';
export {createEntryQuestionFlow} from './entry/questions.js';
export {createEntryAnswerCommands} from './entry/answers.js';
export {createEntryGeneration} from './entry/generation.js';
import {parseFreeformProgramReply,assembleFreeformProgramDocument,parseSetsInput,parseRepsInput} from '../interchange/freeform.js';
/** Entry's private tab session. Pasted source/replies never enter a training
 * proposal, telemetry or backup. Read models are snapshots; named commands
 * own every mutation and the six flow exits call reset(). */
export const FREEFORM_MAX_CHARS=12000;
const SESSION_KEY='repforge_freeform_session_v1',SOURCE_KEY='repforge_import_source_v1';
const PROVIDERS=['chatgpt','claude'];
/** @typedef {import('../interchange/freeform.js').GapResult} GapResult */
/** @param {{tabStorage:()=>Pick<Storage,'getItem'|'setItem'|'removeItem'>}} options */
export function createEntryImportSession({tabStorage}){
  let source='',reply='',stage=1,invalidated=false;
  /** @type {string|null} */ let lastProvider=null;
  /** @type {string|null} */ let status=null;
  /** @type {string|null} */ let failReason=null;
  /** @type {GapResult|null} */ let gapResult=null;
  /** @type {Record<string,string>} */ let answers={};
  /** @type {Set<string>} */ let errors=new Set(),copied=new Set();
  let epoch=0;
  function read(){return Object.freeze({source,reply,stage,lastProvider,invalidated,status,failReason,gapResult,
    gapAnswers:Object.freeze({...answers}),gapErrors:Object.freeze([...errors]),copiedApps:Object.freeze([...copied]),epoch})}
  function load(){try{
    const raw=tabStorage().getItem(SESSION_KEY);if(!raw)return false;
    /** @type {unknown} */ const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return false;
    const data=/** @type {Record<string,unknown>} */(parsed);
    if(typeof data.source==='string')source=data.source;
    if(typeof data.reply==='string')reply=data.reply;
    if(typeof data.stage==='number'&&Number.isInteger(data.stage)&&data.stage>=1&&data.stage<=3)stage=data.stage;
    if(typeof data.lastProvider==='string')lastProvider=data.lastProvider;
    copied=new Set(Array.isArray(data.copiedApps)?data.copiedApps.filter((/** @type {unknown} */ app)=>typeof app==='string'&&PROVIDERS.includes(app)):[]);
    return true;
  }catch{return false}}
  function clearStored(){try{tabStorage().removeItem(SESSION_KEY)}catch{}}
  function save(){try{
    if(!source&&!reply&&stage===1){clearStored();return}
    tabStorage().setItem(SESSION_KEY,JSON.stringify({source:source||'',reply:reply||'',stage:stage||1,lastProvider:lastProvider||null,copiedApps:[...copied]}));
  }catch{}}
  function reset(){epoch++;source='';reply='';stage=1;lastProvider=null;gapResult=null;answers={};errors.clear();status=null;failReason=null;invalidated=false;copied.clear();clearStored()}
  /** @param {string} value */
  function setSource(value){source=String(value).slice(0,FREEFORM_MAX_CHARS);copied.clear();save()}
  /** @param {string} value */
  function setReply(value){reply=String(value);status=null;failReason=null;save()}
  function continueSource(){if(!source.trim())return false;stage=2;save();return true}
  function editSource(){const discarded=reply.trim().length>0;if(discarded){reply='';invalidated=true}stage=1;save();return discarded}
  /** @param {string} provider */
  function markOpened(provider){stage=3;lastProvider=provider;save()}
  /** @param {string} provider */
  function markCopied(provider){if(PROVIDERS.includes(provider))copied.add(provider);save()}
  function copyCompleted(){PROVIDERS.forEach(provider=>copied.add(provider));markOpened('copy')}
  function tryAnother(){stage=2;status=null;save()}
  /** @param {string} reason */
  function fail(reason){status='unreadable';failReason=reason||'no_json'}
  /** Freeze the owned JSON graph once, so reads need no repeated deep copy.
   * @param {unknown} value */
  function freezeGapFacts(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeGapFacts);Object.freeze(value)}}
  /** @param {GapResult} result */
  function setGaps(result){gapResult=typeof structuredClone==='function'?structuredClone(result):JSON.parse(JSON.stringify(result));freezeGapFacts(gapResult);answers={};errors.clear()}
  function clearGaps(){gapResult=null;errors.clear()}
  /** @param {string} key @param {string} value */
  function setGapAnswer(key,value){answers={...answers,[key]:value};errors.delete(key)}
  /** @param {{parseSets:(value:unknown)=>number|null,parseReps:(value:unknown)=>{min:number,max:number}|null}} rules */
  function validateGaps({parseSets,parseReps}){errors.clear();for(const gap of gapResult?.gaps||[]){
    if((gap.field==='sets'?parseSets:parseReps)(answers[gap.key])===null)errors.add(gap.key)}return errors.size===0}
  /** @param {string} sourceType */
  function stageImportSource(sourceType){try{tabStorage().setItem(SOURCE_KEY,sourceType==='freeform'?'freeform':'file')}catch{}}
  function importSource(){try{return tabStorage().getItem(SOURCE_KEY)==='freeform'?'freeform':'file'}catch{return 'file'}}
  function clearImportSource(){try{tabStorage().removeItem(SOURCE_KEY)}catch{}}
  return Object.freeze({read,load,save,clearStored,reset,setSource,setReply,continueSource,editSource,markOpened,markCopied,copyCompleted,tryAnother,fail,setGaps,clearGaps,setGapAnswer,validateGaps,stageImportSource,importSource,clearImportSource});
}

/** @typedef {import('../interchange/freeform.js').ParsedProgram} ParsedProgram
 * @typedef {{kind:'empty'|'unreadable'|'gaps'|'invalid'|'none',gapCount:number}|{kind:'complete',gapCount:0,source:ParsedProgram,originalText:string}} ImportOutcome
 */
/** Freeform uses the ordinary file parser and review path. This owner decides
 * completeness/gaps and clears private text exactly when handing off a review.
 * UI commands never supply training snapshots or bypass review/activation.
 * @param {{session:ReturnType<typeof createEntryImportSession>,parseSource:(text:string)=>ParsedProgram|null,sourceName:()=>string}} options
 */
export function createEntryImportCommands({session,parseSource,sourceName}){
 /** @param {ParsedProgram} source @returns {ImportOutcome} */
 function complete(source){return{kind:'complete',gapCount:0,source,originalText:session.read().source}}
 /** @returns {ImportOutcome} */
 function review(){
  const reply=session.read().reply.trim();if(!reply)return{kind:'empty',gapCount:0};
  const parsed=parseFreeformProgramReply(reply,parseSource);
  if(!parsed||parsed.status==='unreadable'){session.fail(parsed?.reason||'no_json');return{kind:'unreadable',gapCount:0}}
  if(parsed.status==='gaps'){session.setGaps(parsed);return{kind:'gaps',gapCount:parsed.gaps.length}}
  if(!parsed.exercises.length){session.fail('invalid_rows');return{kind:'unreadable',gapCount:0}}
  return complete(parsed);
 }
 /** @returns {ImportOutcome} */
 function submitGaps(){
  const model=session.read();if(!model.gapResult)return{kind:'none',gapCount:0};
  if(!session.validateGaps({parseSets:parseSetsInput,parseReps:parseRepsInput}))return{kind:'invalid',gapCount:model.gapResult.gaps.length};
  const document=assembleFreeformProgramDocument(model.gapResult,model.gapAnswers,sourceName());
  const parsed=document?parseSource(document):null;
  if(!parsed?.exercises.length){session.fail('assemble_failed');session.clearGaps();return{kind:'unreadable',gapCount:0}}
  return complete({...parsed,notImported:model.gapResult.notImported||[]});
 }
 return Object.freeze({review,submitGaps,reviewOpened:session.reset});
}
