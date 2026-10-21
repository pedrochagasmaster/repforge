/** Bounded free-form handoff grammar. This never sees tab storage or training
 * state; incomplete documents remain gap facts until numbers are supplied. */
import {boundedImportJson,importUtf8Bytes,PROGRAM_MAX_BYTES as IMPORT_MAX_BYTES,PROGRAM_MAX_NODES as IMPORT_MAX_NODES} from './json.js';
import * as unsupportedGrammar from './unsupported-grammar.js';
/** @typedef {Record<string,unknown>} JsonRecord
 * @typedef {Readonly<{day:string,name:string,order:number,sets?:number,min?:number,max?:number,libraryId?:string}>} GapExercise
 * @typedef {Readonly<{key:string,rowIndex:number,day:string,order:number,name:string,field:string}>} Gap
 * @typedef {Readonly<{status:'gaps',envelope:Readonly<JsonRecord>,exercises:readonly GapExercise[],gaps:readonly Gap[],notImported:readonly string[]}>} GapResult
 * @typedef {{exercises:unknown[],[key:string]:unknown}} ParsedProgram
 * @typedef {ParsedProgram & {status:'complete',notImported:string[]}} CompleteProgram
 */
/** @param {unknown} value @returns {value is JsonRecord} */
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const FREEFORM_JSON_CANDIDATES=8;
const FREEFORM_NOT_IMPORTED_KEYS={rest_times:1,rir_rpe:1,tempo:1,supersets:1,warmups:1,cardio:1,progression_rules:1,deload:1,other_notes:1};
/** Each candidate is whole: a fence body, or a root that never closes, is kept
   as one candidate so its nested pieces can never import on their own. A
   backslash pasted just before a root stays in it, so the illegal escape fails
   to parse.
   @param {string} text */
function freeformJsonCandidates(text){
  /** @type {string[]} */ const out=[];
  /** @type {[number,number][]} */ const fences=[];
  const fence=/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi;
  for(let match;out.length<FREEFORM_JSON_CANDIDATES&&(match=fence.exec(text))!==null;){
    fences.push([match.index,fence.lastIndex]);
    const body=match[1].trim();
    if(body)out.push(body)}
  /** @type {Record<string,string>} */ const closers={"{":"}","[":"]"};
  for(let i=0;i<text.length&&out.length<FREEFORM_JSON_CANDIDATES;i++){
    const inFence=fences.find(([start,end])=>i>=start&&i<end);
    if(inFence){i=inFence[1]-1;continue}
    const open=text[i],close=closers[open];
    if(!close)continue;
    const start=text[i-1]==="\\"?i-1:i;
    let depth=0,inString=false,escaped=false,closed=false;
    for(let j=i;j<text.length;j++){
      const ch=text[j];
      if(inString){
        if(escaped)escaped=false;
        else if(ch==="\\")escaped=true;
        else if(ch==='"')inString=false;
        continue}
      if(ch==='"'){inString=true;continue}
      if(ch===open)depth++;
      else if(ch===close&&--depth===0){out.push(text.slice(start,j+1));i=j;closed=true;break}}
    if(!closed){out.push(text.slice(start));break}}
  return out}
/** @param {unknown} obj */
function extractNotImported(obj){
  if(!isRecord(obj))return[];
  const raw=Array.isArray(obj.notImported)?obj.notImported:[];
  const grammar=unsupportedGrammar;
  return grammar?.recognizedForDisplay
    ?grammar.recognizedForDisplay(raw,Object.keys(FREEFORM_NOT_IMPORTED_KEYS))
    :[]}

/** @param {unknown} str */
export function parseRepsInput(str){
  if(typeof str!=="string"&&typeof str!=="number")return null;
  const s=String(str).trim();
  const mRange=s.match(/^(\d+)\s*(?:[-–—/]|to)\s*(\d+)$/i);
  if(mRange){
    const min=parseInt(mRange[1],10),max=parseInt(mRange[2],10);
    if(min>=1&&min<=1000&&max>=min&&max<=1000)return{min,max};
    return null}
  const mSingle=s.match(/^(\d+)$/);
  if(mSingle){
    const val=parseInt(mSingle[1],10);
    if(val>=1&&val<=1000)return{min:val,max:val}}
  return null}

/** @param {unknown} str */
export function parseSetsInput(str){
  if(typeof str!=="string"&&typeof str!=="number")return null;
  const s=String(str).trim();
  if(!/^\d+$/.test(s))return null;
  const n=parseInt(s,10);
  return(n>=1&&n<=100)?n:null}

/* Gaps are keyed by row position, never by (day, order): a reply that numbers
   some rows and omits others collides on that pair, and two rows sharing a key
   means one entered number silently lands on a second exercise. */
/** @param {unknown} candidate @returns {GapResult|null} */
export function readFreeformGapEnvelope(candidate){
  /** @type {unknown} */ let raw=null;
  if(typeof candidate==="string"){
    const trimmed=candidate.trim();
    if(!trimmed.startsWith("{")&&!trimmed.startsWith("["))return null;
    raw=boundedImportJson(trimmed);
  }else if(candidate&&typeof candidate==="object"){
    raw=candidate;
  }
  if(!isRecord(raw))return null;
  const exercises=Array.isArray(raw.exercises)?raw.exercises:(Array.isArray(raw.program)?raw.program:null);
  if(!Array.isArray(exercises)||!exercises.length||exercises.length>IMPORT_MAX_NODES)return null;

  const normalized=[];
  /** @type {Map<string,number>} */ const orders=new Map();
  for(let i=0;i<exercises.length;i++){
    const row=exercises[i];
    if(!isRecord(row))return null;
    const day=typeof row.day==="string"?row.day.trim():"";
    const name=typeof row.name==="string"?row.name.trim():"";
    if(!day||!name)return null;

    let order=row.order;
    if(order===undefined||order===null){
      const next=(orders.get(day)||0)+1;
      orders.set(day,next);
      order=next;
    }else if(typeof order!=="number"||!Number.isInteger(order)||order<1||order>1000){
      return null;
    }

    if(typeof order!=="number")return null;
    let sets=row.sets;
    let setsValid=typeof sets==="number"&&Number.isInteger(sets)&&sets>=1&&sets<=100;
    if(sets!==undefined&&sets!==null&&!setsValid)return null;

    let min=row.min??row.repLow;
    let max=row.max??row.repHigh;
    let minValid=typeof min==="number"&&Number.isInteger(min)&&min>=1&&min<=1000;
    let maxValid=typeof max==="number"&&Number.isInteger(max)&&max>=1&&max<=1000&&(!minValid||typeof min==="number"&&max>=min);
    let repsValid=minValid&&maxValid;
    if((min!==undefined&&min!==null&&!minValid)||(max!==undefined&&max!==null&&!maxValid))return null;

    normalized.push({
      day,
      name,
      order,
      sets:setsValid&&typeof sets==="number"?sets:undefined,
      min:repsValid&&typeof min==="number"?min:undefined,
      max:repsValid&&typeof max==="number"?max:undefined,
      libraryId:typeof row.libraryId==="string"?row.libraryId:undefined,
    });
  }

  const missingSidecar=Array.isArray(raw.missing)?raw.missing:[];
  const gaps=[];
  for(let i=0;i<normalized.length;i++){
    const r=normalized[i];
    const sidecarSets=missingSidecar.some(m=>isRecord(m)&&m.day===r.day&&m.order===r.order&&m.field==="sets");
    const sidecarReps=missingSidecar.some(m=>isRecord(m)&&m.day===r.day&&m.order===r.order&&m.field==="reps");

    if(r.sets===undefined||sidecarSets){
      gaps.push({
        key:`${i}::sets`,
        rowIndex:i,
        day:r.day,
        order:r.order,
        name:r.name,
        field:"sets",
      });
    }
    if(r.min===undefined||r.max===undefined||sidecarReps){
      gaps.push({
        key:`${i}::reps`,
        rowIndex:i,
        day:r.day,
        order:r.order,
        name:r.name,
        field:"reps",
      });
    }
  }

  if(!gaps.length)return null;

  return{
    status:"gaps",
    envelope:raw,
    exercises:normalized,
    gaps,
    notImported:extractNotImported(raw),
  };
}

/** @param {GapResult|null} gapResult @param {Readonly<Record<string,string>>} gapAnswers @param {string} sourceName */
export function assembleFreeformProgramDocument(gapResult,gapAnswers,sourceName){
  if(!gapResult||!gapResult.exercises||!gapAnswers)return null;
  const rows=[],orders=new Map();
  for(let i=0;i<gapResult.exercises.length;i++){
    const row=gapResult.exercises[i];
    const copy={...row};
    // Order is the row's position within its day. Deriving it here rather than
    // trusting the reply keeps a partly numbered envelope from producing two
    // rows that claim the same slot.
    const nextOrder=(orders.get(copy.day)||0)+1;
    orders.set(copy.day,nextOrder);
    copy.order=nextOrder;
    if(copy.sets===undefined){
      const val=gapAnswers[`${i}::sets`];
      const parsedSets=parseSetsInput(val);
      if(parsedSets===null)return null;
      copy.sets=parsedSets;
    }
    if(copy.min===undefined||copy.max===undefined){
      const val=gapAnswers[`${i}::reps`];
      const parsedReps=parseRepsInput(val);
      if(parsedReps===null)return null;
      copy.min=parsedReps.min;
      copy.max=parsedReps.max;
    }
    rows.push(copy);
  }
  return JSON.stringify({
    version:3,
    meta:gapResult.envelope?.meta||{name:sourceName},
    exercises:rows,
  });
}

/* A reply is read as a program the same way a file is:
   1. Fast path: The JSON the prompt asked for, or plain-text export parser.
   2. Gap path: Structured envelope with missing sidecars or absent numeric fields.
   Nothing incomplete reaches parseProgramSource or the program model. */
/** @param {unknown} text @param {(source:string)=>ParsedProgram|null} parseProgramSource @returns {CompleteProgram|GapResult|{status:'unreadable',reason:string}|null} */
export function parseFreeformProgramReply(text,parseProgramSource){
  const raw=String(text||"");
  if(!raw.trim()||importUtf8Bytes(raw)>IMPORT_MAX_BYTES)return null;
  const candidates=freeformJsonCandidates(raw);

  for(const candidate of candidates){
    const parsed=parseProgramSource(candidate);
    if(parsed?.exercises?.length){
      /** @type {string[]} */ let notImported=[];
      try{notImported=extractNotImported(boundedImportJson(candidate.trim()))}catch{}
      return Object.assign(parsed,{status:/** @type {'complete'} */("complete"),notImported});
    }
  }
  const direct=parseProgramSource(raw);
  if(direct?.exercises?.length){
    /** @type {string[]} */ let notImported=[];
    try{notImported=extractNotImported(boundedImportJson(raw.trim()))}catch{}
    return Object.assign(direct,{status:/** @type {'complete'} */("complete"),notImported});
  }

  for(const candidate of candidates){
    const gapResult=readFreeformGapEnvelope(candidate);
    if(gapResult)return gapResult;
  }
  const directGap=readFreeformGapEnvelope(raw);
  if(directGap)return directGap;

  // A syntax error is not an invalid exercise. Keep them separate so a pasted
  // Markdown-escaped bracket (e.g. \\[) asks for a clean copy, not invented sets.
  // Diagnosis only: parsing here never accepts anything, and nothing is repaired.
  /** @param {string} value */
  const syntaxBroken=value=>{try{JSON.parse(value);return false}catch{return true}};
  const reason=candidates.some(syntaxBroken)?"invalid_json"
    :candidates.length?"invalid_rows"
    :/^\s*```/.test(raw)?"invalid_json":"no_json";
  return{status:"unreadable",reason};}

