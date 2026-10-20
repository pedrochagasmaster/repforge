import {sameLoad,recommendationVerdict,formatShortDate,verdictMarkHtml,formatList} from '../format.js';
import {effortForRir} from './effort.js';
import {FIELD_SEMANTICS} from './select.js';
/** @typedef {import('../../app/workout-model.js').Exercise} Exercise
 * @typedef {import('../../app/workout-model.js').WorkoutRecommendation} Recommendation
 * @typedef {import('../../app/workout-model.js').LogRow} LogRow
 * @typedef {{label?:string,text:string,readonly kind:string}} ExplanationRow
 */
/** Why formats only facts returned by the actual canonical recommendation.
 * Scalar-capacity triggers and old range-engine arithmetic have no second home.
 * @param {{presentation:ReturnType<typeof import('./presentation.js').createFocusPresentation>,copy:{t:(key:string,values?:Record<string,unknown>)=>string,language:()=>string}}} options */
export function createWhyPresentation({presentation,copy:{t,language}}){
  const format=presentation.format,unit=format.unit,load=format.load,number=format.number;
  const date=(/** @type {unknown} */ value)=>formatShortDate(value,t,language());
  const effortLabel=(/** @type {LogRow['rir']} */ rir)=>t('effort.'+effortForRir(rir));
  /** @param {unknown[]} items */
  function list(items){return formatList(items,language());}
  /** @param {string} kind @param {{label?:string,text:string}} value @returns {ExplanationRow} */
  const row=(kind,value)=>Object.defineProperty({...value,kind},'kind',{value:kind,enumerable:false,configurable:false,writable:false});
  /** @param {Recommendation} rec @param {number} [ordinal] */
  function engineRows(rec,ordinal=1){
    /** @type {ExplanationRow[]} */const rows=[];
    const item=rec.targetSets.find(entry=>entry.prescription.setIndex===ordinal)||rec.targetSets[0],result=item?.result;
    if(!result||item.status!=='recommended')return rows;
    const definitions=('metricDefinitions' in rec?rec.metricDefinitions:[])||[];
    const loadMetric=definitions.find(metric=>FIELD_SEMANTICS.load.includes(metric.semantic)),repsMetric=definitions.find(metric=>FIELD_SEMANTICS.reps.includes(metric.semantic));
    const anchor=result.historyAnchor,assumptions=result.loadingAssumptions;
    const capacity=anchor?.capacityKg,cap=typeof capacity==='number'&&Number.isFinite(capacity)?load(Math.round(capacity*2)/2):null;
    if(anchor?.source==='current_session')rows.push(row('anchor',{text:t('why.engine.anchor_session',{set:(anchor.setIndex??0)+1,load:load(anchor.displayLoadKg),cap,unit:unit()})}));
    else if(cap)rows.push(row('anchor',{text:t(['loadPerSideKg','persistentLoadPerSideKg'].includes(loadMetric?.semantic||'')?'why.engine.anchor_history_per_side':'why.engine.anchor_history',
      {n:anchor?.sessionIds.length||1,load:load(anchor?.displayLoadKg),cap,unit:unit()})}));
    const projected=result.fatigue?.projectedCapacityKg;
    if(ordinal>1&&typeof projected==='number'&&Number.isFinite(projected)&&typeof capacity==='number'&&Number.isFinite(capacity)&&Math.abs(projected-capacity)>0.25)
      rows.push(row('fatigue',{text:t('why.engine.fatigue',{cap:load(Math.round(projected*2)/2),unit:unit()})}));
    const targetLoad=loadMetric?result.targets[loadMetric.semantic]:null,reps=repsMetric?result.targets[repsMetric.semantic]:null,rir=item.prescription.rir;
    if(targetLoad!=null&&reps!=null)rows.push(row('target',{text:t(rir!=null?'why.engine.target':'why.engine.target_norir',{rir:number(rir),reps,load:load(targetLoad),unit:unit()})}));
    const loads=(assumptions?.availableLoadsKg||[]).slice().sort((a,b)=>a-b),steps=loads.slice(1).map((value,index)=>Math.round((value-loads[index])*1000)/1000).filter(step=>step>0);
    if(steps.length)rows.push(row('step',{text:t('why.engine.step',{step:load(Math.min(...steps)),unit:unit()})}));
    if(assumptions?.bodyweightContributionEnabled&&assumptions.bodyweightContributionKg>0){
      if(loadMetric&&['loadPerSideKg','persistentLoadPerSideKg'].includes(loadMetric.semantic))rows.push(row('per_side_bodyweight',{text:t('why.engine.per_side_bodyweight',
        {load:load(result.targets[loadMetric.semantic]),unit:unit(),multiplier:assumptions.externalLoadMultiplier,bw:load(assumptions.bodyweightContributionKg)})}));
      else rows.push(row('bodyweight',{text:t('why.engine.bodyweight',{bw:load(assumptions.bodyweightContributionKg),unit:unit()})}));
    }
    return rows;
  }
  /** @param {LogRow[]} previous @param {boolean} effortMode */
  function performed(previous,effortMode){
    const rows=previous.filter(item=>Number(item.load)>0&&Number(item.reps)>0);
    /** @type {{load:LogRow['load'],sets:LogRow[]}[]} */const runs=[];
    for(const item of rows){const run=runs.at(-1);if(run&&sameLoad(Number(run.load),Number(item.load)))run.sets.push(item);else runs.push({load:item.load,sets:[item]});}
    return runs.map(run=>effortMode?t('why.performed_effort',{reps:list(run.sets.map(item=>item.reps)),load:load(run.load),unit:unit(),efforts:list(run.sets.map(item=>effortLabel(item.rir)))}):
      t('why.performed',{reps:list(run.sets.map(item=>item.reps)),load:load(run.load),unit:unit(),rirs:list(run.sets.map(item=>item.rir==null||item.rir===''?t('why.effort.missing'):number(item.rir)))})).join(' ');
  }
  /** Shared with the exercise detail card. @param {Recommendation} rec */
  function cueLoad(rec){const verdict=recommendationVerdict(rec),move=verdict==='up'||verdict==='down'?verdict:'hold';return t('focus.cue.'+move,{load:load(rec.load),unit:unit()});}
  /** @param {Parameters<typeof presentation.capture>[0]} context */
  function capture(context){
    const {query,committed,effortMode}=context,view=presentation.capture(context);
    /** @param {Exercise} ex @param {Recommendation} rec @param {'focus'|'exercise'} surface */
    function headline(ex,rec,surface){
      let n=0;if(surface!=='exercise')for(let ordinal=1;ordinal<=ex.sets&&!n;ordinal++)if(!committed.has(`${ex.id}_${ordinal}`))n=ordinal;
      if(n){
        const cue=view.cue(ex,n,rec,false),suggestion=cue.kind==='now'?query.setSuggestion(ex,n,rec):null;
        if(suggestion&&suggestion.src!=='base')return {target:`${t('focus.cue.'+cue.move,{load:cue.loadText,unit:unit()})}, ${t('focus.cue.reps',{reps:cue.reps})}`,glyph:cue.move,inSession:true,set:{n,load:suggestion.load,reps:cue.reps}};
      }
      const glyph=recommendationVerdict(rec);
      const reps=rec.load!=null?query.setSuggestion(ex,1,rec).reps??ex.min:null;
      return{target:rec.load!=null?`${cueLoad(rec)}, ${t('focus.cue.reps',{reps})}`:'',glyph,inSession:false};
    }
    /** Actual read-only progression diagnostic shares the same engine rows.
     * @param {Exercise|null} ex */
    function explain(ex){if(!ex)return [];const rec=query.recommendation(ex);return rec.status==='manual'||rec.status==='new'?[]:engineRows(rec);}
    /** @param {Exercise} ex @param {'focus'|'exercise'} [surface] @returns {import('./why.js').WhyModel} */
    function model(ex,surface='focus'){
      const rec=query.recommendation(ex),head=headline(ex,rec,surface),label='labelKey' in rec&&rec.labelKey?t(rec.labelKey):'';
      /** @type {import('./why.js').WhyModel['blocks'][number][]} */const blocks=[];
      /** @type {import('./why.js').CalculationRow[]} */const calc=[];
      /** @type {import('./why.js').WhyModel} */const result={target:head.target,decision:head.inSession&&label?t('why.decision_before',{label}):label,glyph:head.glyph,
        markHtml:verdictMarkHtml(head.glyph),labels:{calc:t('why.calc'),calcHide:t('why.calc_hide')},blocks,calc,evidence:''};
      /** @param {string} leadKey @param {string} lead @param {string|undefined} text */
      const block=(leadKey,lead,text)=>{if(text)blocks.push({leadKey,lead,text});};
      if(rec.status==='manual'){block('manual','',t('why.manual'));return result;}
      if(rec.status==='configuration_required'&&'reasonCodes' in rec){
        if((rec.reasonCodes||[]).includes('execution_context_required')){block('setup','',t('why.setup.execution_mode'));return result;}
        if((rec.reasonCodes||[]).includes('per_side_convention_required')){
          const mode=query.canonicalPrescriptionSlot(ex)?.slot.executionMode;
          if(mode==='bilateral'||mode==='unilateral')block('setup','',t('why.setup.per_side',{mode:t('why.setup.mode.'+mode)}));return result;
        }
      }
      const n=head.inSession&&head.set?head.set.n:1,rows=engineRows(rec,n),take=(/** @type {string} */ kind)=>rows.find(item=>item.kind===kind);
      const previous=query.last(ex).filter(item=>Number(item.load)>0);
      block('engine-anchor',t('why.lead.engine_anchor'),[performed(previous,effortMode),take('anchor')?.text,take('fatigue')?.text].filter(Boolean).join(' '));
      block('engine-target',t(n>1?'why.lead.set2':'why.lead.engine_target',{n}),take('target')?.text);
      block('engine-assumptions',t('why.lead.engine_assumptions'),[take('step')?.text,take('per_side_bodyweight')?.text,take('bodyweight')?.text].filter(Boolean).join(' '));
      if(previous.length){
        calc.push({group:t('why.calc.last',{date:date(previous[0].date)})});
        previous.forEach((item,index)=>calc.push({k:t('why.calc.set',{n:index+1}),v:`${load(item.load)} × ${item.reps}`,rir:effortMode?effortLabel(item.rir):'@'+number(item.rir)}));
        result.evidence=t('why.evidence',{n:1,date:date(previous[0].date)});
      }
      return result;
    }
    /** Shared summary target uses the same canonical first-set suggestion.
     * @param {Exercise} ex @param {Recommendation} rec */
    function targetLine(ex,rec){if(rec.load==null)return '';const suggestion=query.setSuggestion(ex,1,rec);return `${load(rec.load)} ${unit()} × ${suggestion.reps??ex.min}`;}
    return {model,targetLine,explain};
  }
  return {capture,cueLoad};
}
