import {escapeHtml as esc} from '../format.js';
import {parseDecimalInput} from '../../training/metrics.js';
import {FIELD_SEMANTICS} from './select.js';
import {EFFORT_STEPS} from './effort.js';
import {renderFocusShelf,renderFocusPads} from './view.js';
/** @typedef {import('../../training/workout-contracts.js').DraftSet} DraftSet
 * @typedef {import('../../training/metrics.js').MetricDefinition} MetricDefinition
 * @typedef {{kgVal:unknown,repsVal:unknown,rirVal:unknown,effortVal:string}} Values
 * @typedef {{field:string,editing:boolean}} ShelfSelection
 * @typedef {Partial<import('../../training/workout-contracts.js').Touched>} Touched
 * @typedef {{metric:{id:string}|null,value:string}|null} Carry
 * @typedef {{exerciseId:string,ordinal:number,ui:ShelfSelection,values:Values,effortMode:boolean,peek:boolean,editing:boolean,metrics:readonly MetricDefinition[],loadStep:string}} PadsFacts
 */
/** Field and pad presentation over already-selected acknowledged set facts.
 * Pending raw input belongs to Focus state; canonical values stay in DraftV2.
 * @param {{focus:ReturnType<typeof import('./state.js').createFocusState>,metrics:ReturnType<typeof import('../workout/metrics.js').createMetricDisplay>,effort:ReturnType<typeof import('./effort.js').createEffortPresentation>,rest:ReturnType<typeof import('./rest-view.js').createRestPresentation>,copy:{t:(key:string,values?:Record<string,unknown>)=>string,plural:(count:number,word:string)=>string},format:{number:(value:unknown)=>string,unit:()=>string}}} options */
export function createShelfPresentation({focus,metrics,effort,rest,copy:{t,plural},format}){
  const effortLabel=(/** @type {string} */ value)=>t('effort.'+value);
  const text=(/** @type {unknown} */ raw)=>{const value=parseDecimalInput(raw);return Number.isFinite(value)?format.number(value):String(raw??'')};
  /** @param {string} exerciseId @param {number} ordinal @param {MetricDefinition} metric @param {DraftSet} set @param {Carry} carry @param {ShelfSelection} ui @param {Touched} touched @returns {import('./view.js').FieldModel} */
  function metricField(exerciseId,ordinal,metric,set,carry,ui,touched){
    const key=`${exerciseId}_${ordinal}`,id=`metric_${metric.id}`,inputKey=`${key}_${id}`;
    const pending=focus.pending.get(inputKey)?.value,carried=carry?.metric?.id===metric.id?carry.value:null;
    const raw=carried??pending??set.edited.metrics?.[metric.id]??'';
    const target=/** @type {import('../workout/metrics.js').Target} */(set.programmed.targets?.[metric.semantic]);
    const shown=raw!==''?text(metrics.text(raw,metric)):metrics.targetText(target);
    const unit=metrics.displayUnit(metric),label=`${metrics.label(metric)}${unit?`, ${unit}`:''}`;
    return {key,id,metricId:metric.id,selected:ui.field===id,editing:ui.editing,
      soft:!touched.metrics?.[metric.id]&&!focus.pending.has(inputKey),label,ariaLabel:`${label}, ${t('focus.set_label',{n:ordinal})}`,
      shown,raw:metrics.text(raw,metric),placeholder:metrics.targetText(target),
      inputMode:metric.semantic==='reps'||metric.semantic==='repsPerSide'?'numeric':'decimal'};
  }
  /** @param {string} exerciseId @param {number} ordinal @param {string} id @param {Values} values @param {ShelfSelection} ui @param {Touched} touched @param {boolean} effortMode @returns {import('./view.js').FieldModel} */
  function field(exerciseId,ordinal,id,values,ui,touched,effortMode){
    const key=`${exerciseId}_${ordinal}`,isEffort=id==='rir'&&effortMode;
    const label=id==='load'?t('focus.shelf.field_load',{unit:format.unit()}):id==='reps'?t('stats.table.reps'):isEffort?t('log.effort'):t('stats.table.rir');
    const raw=id==='load'?values.kgVal:id==='reps'?values.repsVal:values.rirVal;
    const shown=isEffort?effortLabel(values.effortVal):id==='reps'?String(values.repsVal??''):text(raw);
    return {key,id,selected:ui.field===id,editing:ui.editing,soft:!(id==='load'?touched.load:id==='reps'?touched.reps:touched.effort),
      label,ariaLabel:`${label}, ${t('focus.set_label',{n:ordinal})}`,raw,shown,effort:isEffort,effortValue:values.effortVal,
      effortPopupHtml:isEffort?effort.html(key,values.effortVal):'',inputMode:id==='reps'?'numeric':'decimal'};
  }
  /** @param {PadsFacts} facts @returns {import('./view.js').ShelfModel} */
  function pads({exerciseId,ordinal,ui,values,effortMode,peek,editing,metrics:definitions,loadStep}){
    const showRest=rest.padsOn(editing);if(showRest)return rest.selectPads(peek);
    const key=`${exerciseId}_${ordinal}`,id=ui.field;
    if(id==='rir'&&effortMode){
      const at=Math.max(0,EFFORT_STEPS.indexOf(values.effortVal));
      return {rest:showRest,pads:[-1,1].map(direction=>{const next=EFFORT_STEPS[at+direction],word=effortLabel(next||values.effortVal);
        return {direction,text:t('focus.shelf.pad_effort',{sign:direction>0?'+':'−',effort:word}),attributes:` data-effstep="${esc(key)}"`,disabled:!next};})};
    }
    const metricId=id.startsWith('metric_')?id.slice(7):null,metric=metricId?definitions.find(item=>item.id===metricId):null;
    if(metric){
      const reps=metric.semantic==='reps'||metric.semantic==='repsPerSide';
      const load=['loadKg','assistanceKg','loadPerSideKg','persistentLoadPerSideKg'].includes(metric.semantic);
      const unit=metrics.displayUnit(metric),step=load?loadStep:'1';
      return {rest:showRest,pads:[-1,1].map(direction=>({direction,attributes:' data-step="'+key+'_metric_'+metric.id+'"',
        text:reps?t('focus.shelf.pad_reps',{sign:direction>0?'+':'−'}):load?t('focus.shelf.pad_load',{sign:direction>0?'+':'−',step,unit}):(direction>0?'+':'−')+'1'+(unit?' '+unit:'')}))};
    }
    return {rest:showRest,pads:[-1,1].map(direction=>({direction,attributes:` data-step="${esc(key)}_${id}"`,
      text:id==='load'?t('focus.shelf.pad_load',{sign:direction>0?'+':'−',step:loadStep,unit:format.unit()}):id==='reps'?t('focus.shelf.pad_reps',{sign:direction>0?'+':'−'}):t('focus.shelf.pad_rir',{sign:direction>0?'+':'−'})}))};
  }
  /** @param {PadsFacts} facts */
  const padsHtml=facts=>renderFocusPads({...pads(facts),peek:facts.peek});
  /** @param {{exerciseId:string,selection:ReturnType<typeof focus.selectExercise>,allDone:boolean,hasNext:boolean,peek:boolean,exerciseCount:number,beats:boolean,effortMode:boolean,values:Values|null,touched:Touched,set:DraftSet|null,carry:Carry,metrics:readonly MetricDefinition[],loadStep:string}} facts */
  function render({exerciseId,selection,allDone,hasNext,peek,exerciseCount,beats,effortMode,values,touched,set,carry,metrics:definitions,loadStep}){
    const n=selection.active;
    if(!n){
      const done=selection.done.length,title=allDone?t('focus.wo_done_title'):t('focus.ex_done_title');
      const subtitle=allDone?t('focus.wo_done_sub',{n:exerciseCount,lifts:plural(exerciseCount,'lift')}):t('focus.ex_done_sets',{n:done,sets:plural(done,'logged set')});
      const finish=allDone||!hasNext;
      return renderFocusShelf({peek,completion:{title,subtitle,finish,rise:selection.fresh&&beats,actionLabel:t(finish?'log.finish':'focus.next_ex')}});
    }
    if(!values)throw new Error('Active shelf requires its selected field values');
    const key=`${exerciseId}_${n}`,ui=focus.shelfFor(key,definitions[0]?'metric_'+definitions[0].id:'reps');
    const editing=!!focus.edit&&focus.edit.exId===exerciseId;
    const label=editing?t('log.save_set_aria',{n}):t('focus.shelf.log_set',{n});
    const column=(/** @type {MetricDefinition} */ metric)=>FIELD_SEMANTICS.load.includes(metric.semantic)?0:FIELD_SEMANTICS.reps.includes(metric.semantic)?1:2;
    if(definitions.length&&!set)throw new Error('Metric shelf requires its acknowledged DraftV2 set');
    const fields=definitions.length&&set?[...definitions].sort((a,b)=>column(a)-column(b)).map(metric=>metricField(exerciseId,n,metric,set,carry,ui,touched)).concat(field(exerciseId,n,'rir',values,ui,touched,effortMode))
      :['load','reps','rir'].map(id=>field(exerciseId,n,id,values,ui,touched,effortMode));
    return renderFocusShelf({key,label,editing,peek,fields,...pads({exerciseId,ordinal:n,ui,values,effortMode,peek,editing,metrics:definitions,loadStep})});
  }
  return {render,padsHtml,text};
}
