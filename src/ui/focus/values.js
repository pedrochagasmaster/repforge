import {FIELD_SEMANTICS} from './select.js';
import {parseDecimalInput} from '../../training/metrics.js';
import {effortForRir} from './effort.js';
/** @typedef {import('../../training/workout-contracts.js').Draft} Draft
 * @typedef {import('../../app/workout-model.js').Exercise} Exercise
 * @typedef {import('../../app/workout-model.js').LogRow} LogRow
 * @typedef {import('../../app/workout-model.js').FlatDraft} FlatDraft
 * @typedef {import('../../app/workout-model.js').WorkoutCapture} WorkoutCapture
 * @typedef {import('../../app/workout-model.js').WorkoutRecommendation} Recommendation
 */
/** Pending UI text overlays the acknowledged aggregate for display only. The
 * native training owner decides carry and the captured query supplies targets.
 * @param {{focus:ReturnType<typeof import('./state.js').createFocusState>,training:Pick<ReturnType<typeof import('../../training/workout.js').createWorkoutRules>,'manualLoadCarry'>,format:ReturnType<typeof import('./format.js').createFocusFormat>,copy:{t:(key:string)=>string}}} options */
export function createFocusValues({focus,training,format,copy:{t}}){
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal */
  function set(draft,exerciseId,ordinal){const ex=draft?.exercises[exerciseId],id=ex?.setOrder.find(id=>ex.sets[id].ordinal===ordinal);return ex&&id?ex.sets[id]:null;}
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal */
  function definitions(draft,exerciseId,ordinal){const metrics=set(draft,exerciseId,ordinal)?.programmed.metrics;return Array.isArray(metrics)?metrics:[];}
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal @param {string} field */
  function metricPending(draft,exerciseId,ordinal,field){
    const semantics=FIELD_SEMANTICS[/** @type {'load'|'reps'} */(field)];
    const metric=definitions(draft,exerciseId,ordinal).find(item=>semantics?.includes(item.semantic));
    return metric?focus.pending.get(`${exerciseId}_${ordinal}_metric_${metric.id}`)?.value:undefined;
  }
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal */
  function pendingLoad(draft,exerciseId,ordinal){
    const metric=definitions(draft,exerciseId,ordinal).find(item=>FIELD_SEMANTICS.load.includes(item.semantic));
    return focus.pending.has(metric?`${exerciseId}_${ordinal}_metric_${metric.id}`:`${exerciseId}_${ordinal}_load`);
  }
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal @param {Recommendation} recommendation */
  function carry(draft,exerciseId,ordinal,recommendation){return draft?training.manualLoadCarry(draft,exerciseId,ordinal,{status:recommendation.status,pendingLoad:pendingLoad(draft,exerciseId,ordinal)}):null;}
  /** @param {{draft:Draft|null,flat:FlatDraft,query:WorkoutCapture,exercise:Exercise,ordinal:number,recommendation:Recommendation,previous:LogRow[]}} facts */
  function fields({draft,flat,query,exercise:ex,ordinal:n,recommendation:r,previous}){
    const pending=(/** @type {string} */ field)=>focus.pending.get(`${ex.id}_${n}_${field}`)?.value??metricPending(draft,ex.id,n,field);
    const old=previous.find(row=>row.set===n),draftKg=pending('load')??flat[`${ex.id}_${n}_load`];
    const suggestion=query.setSuggestion(ex,n,r,flat,old);
    const carried=carry(draft,ex.id,n,r),load=carried?String(flat[`${ex.id}_${carried.ordinal}_load`]??carried.value):null;
    const kgVal=load!=null?load:draftKg!=null?draftKg:suggestion.load!=null?format.plainLoad(suggestion.load)
      :r.status==='manual'||r.status==='configuration_required'?'':old&&old.load!=null?format.plainLoad(old.load):'';
    const repsVal=pending('reps')??flat[`${ex.id}_${n}_reps`]??(suggestion.reps!=null?suggestion.reps:r.status==='manual'?'':old&&old.reps!=null?old.reps:ex.min);
    const key=`${ex.id}_${n}`,isW=set(draft,ex.id,n)?.role==='warmup';
    // The flat projection is produced from validated DraftV2, whose edit text is string/null.
    const effortVal=/** @type {string} */(pending('effort')||flat[`${key}_effort`]||(old&&old.rir!=null?effortForRir(old.rir):'hard'));
    const rirVal=pending('rir')??flat[`${key}_rir`]??(old&&old.rir!=null?format.plain(old.rir):1);
    return {key,isW,kgVal,repsVal,rirVal,effortVal};
  }
  /** @param {Parameters<typeof fields>[0]} facts @param {boolean} effortMode */
  function row(facts,effortMode){
    const values=fields(facts),number=parseDecimalInput(values.kgVal),rir=parseDecimalInput(values.rirVal);
    return {load:Number.isFinite(number)?format.number(number):String(values.kgVal??''),reps:String(values.repsVal),
      eff:effortMode?t('effort.'+values.effortVal):Number.isFinite(rir)?format.number(rir):String(values.rirVal??'')};
  }
  /** @param {Draft|null} draft @param {string} exerciseId @param {number} ordinal */
  function touched(draft,exerciseId,ordinal){
    const item=set(draft,exerciseId,ordinal);if(!draft?.exercises[exerciseId])return {};
    const value={...item?.touched};
    const held=(/** @type {string} */ field)=>focus.pending.has(`${exerciseId}_${ordinal}_${field}`);
    if(held('load'))value.load=true;if(held('reps'))value.reps=true;if(held('rir')||held('effort'))value.effort=true;
    return value;
  }
  return {set,definitions,pendingLoad,carry,fields,row,touched};
}
