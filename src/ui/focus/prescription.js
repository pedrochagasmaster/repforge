import {effortForRir} from './effort.js';
/** @typedef {{adaptive:boolean,rirMin:number|null,rirMax:number|null}|null} SlotFacts
 * @typedef {{strategy?:{id?:string,params?:Record<string,unknown>}}|null|undefined} Progression
 * @typedef {{sets:number,metrics:readonly {metric:import('../../training/metrics.js').MetricDefinition,target:import('../metrics.js').Target}[]}} PrescriptionFacts
 */
/** Localized authored-prescription labels. The query owner supplies the cycle,
 * set metrics, progression and RIR envelope; no training rule lives here.
 * @param {{metrics:ReturnType<typeof import('../metrics.js').createMetricDisplay>,copy:{t:(key:string,values?:Record<string,unknown>)=>string},format:{number:(value:unknown)=>string}}} options */
export function createPrescriptionPresentation({metrics,copy:{t},format}){
  /** @param {PrescriptionFacts} facts */
  function summary({sets,metrics:targets}){
    const parts=targets.map(({metric,target})=>metrics.canonicalTargetText(metric,target)).filter(Boolean);
    const setLabel=sets===1?t('history.sets.one',{n:1}):t('entry.catalogue.sets_exact',{n:Number(sets)||0});
    return parts.length?`${setLabel} · ${parts.join(' · ')}`:setLabel;
  }
  /** @param {{effortMode:boolean,rirHigh:unknown,facts:SlotFacts,progression:Progression}} input */
  function targetEffort({effortMode,rirHigh,facts,progression}){
    if(effortMode)return t('effort.'+effortForRir(Number(rirHigh)));
    if(facts)return facts.rirMin==null?'—':facts.rirMin===facts.rirMax?format.number(facts.rirMin):`${format.number(facts.rirMin)}–${format.number(facts.rirMax)}`;
    const p=progression?.strategy?.params||{};
    const low=p.targetRirMin!=null?p.targetRirMin:p.anchorTargetRirMin!=null?p.anchorTargetRirMin:0;
    const high=p.targetRirMax!=null?p.targetRirMax:p.anchorTargetRirMax!=null?p.anchorTargetRirMax:rirHigh;
    return `${format.number(low)}–${format.number(high)}`;
  }
  /** @param {{exercise:{sets:number,min:number,max:number,hasRepTarget?:boolean},facts:SlotFacts,progression:Progression,prescription:PrescriptionFacts,rirHigh:unknown}} input */
  function exerciseMeta({exercise:ex,facts,progression,prescription,rirHigh}){
    if(ex.hasRepTarget===false)return summary(prescription);
    if(facts){
      const name=t(facts.adaptive?'program.progression.adaptive':'program.progression.strategy.manual');
      const line=facts.rirMin==null?t('focus.exmeta.manual',{sets:Number(ex.sets)||1,min:ex.min,max:ex.max})
        :t('focus.exmeta.range',{sets:Number(ex.sets)||1,min:ex.min,max:ex.max,rmin:format.number(facts.rirMin),rmax:format.number(facts.rirMax)});
      return `${line} · ${name}`;
    }
    const id=progression?.strategy?.id||'range',p=progression?.strategy?.params||{};
    const sets=Number(p.workingSets)||Number(ex.sets)||1;
    const rmin=format.number(p.targetRirMin!=null?p.targetRirMin:0),rmax=format.number(p.targetRirMax!=null?p.targetRirMax:rirHigh);
    /** @type {Record<string,string>} */
    const names={range:t('program.progression.strategy.range'),rep_goal:t('program.progression.strategy.rep_goal'),
      effort_target:t('program.progression.strategy.effort_target'),anchor_backoff:t('program.progression.strategy.anchor_backoff'),manual:t('program.progression.strategy.manual')};
    const name=names[id]||t('program.progression.strategy.unsupported');
    let line;
    if(id==='rep_goal')line=t('focus.exmeta.goal',{sets,goal:p.repGoal,rmin,rmax});
    else if(id==='effort_target')line=t('focus.exmeta.effort',{sets,reps:p.targetReps,rmin,rmax});
    else if(id==='anchor_backoff')line=t('focus.exmeta.anchor',{amin:p.anchorRepMin,amax:p.anchorRepMax,n:p.backoffSets,bmin:p.backoffRepMin,bmax:p.backoffRepMax});
    else if(id==='manual'||!names[id])line=t('focus.exmeta.manual',{sets:Number(ex.sets)||1,min:ex.min,max:ex.max});
    else line=t('focus.exmeta.range',{sets,min:p.repMin!=null?p.repMin:ex.min,max:p.repMax!=null?p.repMax:ex.max,rmin,rmax});
    return `${line} · ${name}`;
  }
  return {summary,targetEffort,exerciseMeta};
}
