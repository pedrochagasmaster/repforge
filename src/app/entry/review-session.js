import {review as reviewRules} from '../../training/authoring.js';
/** @typedef {ReturnType<ReturnType<typeof import('../../training/authoring.js').createEntryRules>['createState']>} Draft
 * @typedef {NonNullable<Draft['result']>} Candidate
 * @typedef {Parameters<typeof reviewRules.replay>[2]} ReviewContext
 * @typedef {{draftId:string,answers:string|undefined,baseline:Candidate,edits:Record<string,unknown>[]}} ReviewState
 */
/** @template T @typedef {T extends (...args:never[])=>unknown?T:T extends object?{readonly [K in keyof T]:DeepReadonly<T[K]>}:T} DeepReadonly */
const KEY='repforge_entry_review_v1';
/** Baseline and replay log are application data; tab/reorder and sheets belong
 * to presentation. Reading this owner never generates, writes or mounts UI.
 * @param {{storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>}} options */
export function createEntryReviewSession({storage}){
 /** @type {ReviewState|null} */ let owned=null;
 /** @template T @param {T} value @returns {T} */
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 /** @param {unknown} value */
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}}
 /** @returns {Record<string,unknown>|null} */
 function readLog(){try{/** @type {unknown} */const value=JSON.parse(storage.getItem(KEY)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?/** @type {Record<string,unknown>} */(value):null}catch{return null}}
 /** @param {ReviewState} value @param {boolean} shared */
 function save(value,shared){if(shared)return;try{if(value.edits.length)storage.setItem(KEY,JSON.stringify({draftId:value.draftId,fingerprint:value.baseline.fingerprint,edits:value.edits}));else storage.removeItem(KEY)}catch{}}
 /** @returns {DeepReadonly<ReviewState>|null} */
 function read(){return owned}
 /** @param {Draft|null} draft @returns {DeepReadonly<ReviewState>|null} */
 function current(draft){return owned&&draft?.draftId===owned.draftId&&draft.result?.answersFingerprint===owned.answers?owned:null}
 function clear(){owned=null;try{storage.removeItem(KEY)}catch{}}
 /** @param {Draft} draft @param {Candidate} baseline @param {ReviewContext} context */
 function adopt(draft,baseline,context){
  const definition=baseline.preview?.programDefinition,stored=draft.result?.preview?.programDefinition;
  if(!definition||!stored)return null;
  const shared=draft.route==='shared',saved=shared?null:readLog();
  /** @type {Record<string,unknown>[]} */ let edits=[];
  if(saved?.draftId===draft.draftId&&saved?.fingerprint===baseline.fingerprint&&Array.isArray(saved?.edits)){
   const replayed=reviewRules.replay(definition,saved.edits,context);
   if(replayed.ok&&JSON.stringify(replayed.definition)===JSON.stringify(stored))edits=clone(saved.edits);
  }
  owned={draftId:draft.draftId,answers:draft.result?.answersFingerprint,baseline:clone(baseline),edits};
  freeze(owned);save(owned,shared);return read();
 }
 /** Only the acknowledged commit's original session may advance its edit log.
  * @param {DeepReadonly<ReviewState>} expected @param {Draft} draft @param {Record<string,unknown>[]} edits */
 function committed(expected,draft,edits){
  if(owned!==expected||draft.draftId!==owned.draftId)return false;
  owned={...owned,answers:draft.result?.answersFingerprint,edits:clone(edits)};
  freeze(owned);save(owned,draft.route==='shared');return true;
 }
 return Object.freeze({read,current,adopt,committed,clear});
}
