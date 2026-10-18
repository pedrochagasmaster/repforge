import {compareChronology} from '../../training/progress.js';
import {renderFocusCard,renderFocusDeck} from './view.js';
import {createMetricDisplay} from '../metrics.js';
import {createFocusFormat} from './format.js';
import {createFocusValues} from './values.js';
import {createEffortPresentation} from './effort.js';
import {createRestPresentation} from './rest-view.js';
import {createCuePresentation} from './cue.js';
import {createLedgerPresentation} from './ledger.js';
import {createShelfPresentation} from './shelf.js';
import {createPrescriptionPresentation} from './prescription.js';
/** Feature composition: concrete Focus owners share one display context, one
 * pending-input state and the existing rest clock. No global registration or IO.
 * @param {{window:Window,focus:ReturnType<typeof import('./state.js').createFocusState>,clock:ReturnType<typeof import('./rest.js').createRestClock>,training:Parameters<typeof createFocusValues>[0]['training'],readSettings:()=>{unit?:string,minJump?:unknown},readDefaultRest:()=>number,labels:ReturnType<typeof import('../exercise-labels.js').createExerciseLabels>,copy:{t:(key:string,values?:Record<string,unknown>)=>string,plural:(count:number,word:string)=>string,language:()=>string,term:(name:string)=>string},motion:Parameters<typeof createEffortPresentation>[0]['motion']}} options */
export function createFocusPresentation({window,focus,clock,training,readSettings,readDefaultRest,labels,copy,motion}){
  const format=createFocusFormat({readSettings,copy});
  const metrics=createMetricDisplay({readSettings,copy});
  const values=createFocusValues({focus,training,format,copy});
  const effort=createEffortPresentation({window,focus,copy,motion});
  const rest=createRestPresentation({window,clock,readDefaultSeconds:readDefaultRest,copy});
  const cue=createCuePresentation({copy,format,rest});
  const ledger=createLedgerPresentation({copy,format});
  const prescription=createPrescriptionPresentation({metrics,copy,format});
  const shelf=createShelfPresentation({focus,metrics,effort,rest,copy,format});
  /** Capture one readonly application/query projection for a frame. The only
   * mutable data consulted below is this feature's own transient Focus state.
   * @param {{draft:import('../../training/workout-contracts.js').Draft|null,flat:import('./values.js').FlatDraft,query:import('../../app/workout-model.js').WorkoutCapture,committed:ReadonlySet<string>,log:readonly import('../../app/workout-model.js').LogRow[],list:readonly import('../../app/workout-model.js').Exercise[],effortMode:boolean,rirHigh:unknown,beats:boolean}} context */
  function capture(context){
    const {draft,flat,query,committed,log,list,effortMode,rirHigh,beats}=context;
    /** @typedef {import('../../app/workout-model.js').Exercise} Exercise
     * @typedef {import('../../app/workout-model.js').WorkoutRecommendation} Recommendation
     * @typedef {import('../../app/workout-model.js').LogRow} LogRow
     * @typedef {{peek?:boolean,hasNext:boolean,allDone:boolean,nextName?:string}} CardOptions */
    /** @param {Exercise} exercise @param {number} ordinal @param {Recommendation} recommendation @param {LogRow[]} previous */
    const fieldFacts=(exercise,ordinal,recommendation,previous)=>({draft,flat,query,exercise,ordinal,recommendation,previous});
    /** @param {Exercise} ex */
    function meta(ex){return prescription.exerciseMeta({exercise:ex,facts:query.canonicalSlotFacts(ex),progression:query.progressionForExercise(ex),prescription:query.prescriptionFacts(ex),rirHigh});}
    /** @param {Exercise} ex */
    function targetEffort(ex){return prescription.targetEffort({effortMode,rirHigh,facts:query.canonicalSlotFacts(ex),progression:query.progressionForExercise(ex)});}
    /** @param {Exercise} ex */
    function sessionNote(ex){
      const recommendation=query.recommendation(ex);if(recommendation.status==='manual')return '';
      const done=new Set(flat.__done||[]),warm=new Set(flat.__warm||[]),changed=new Set(flat.__touched||[]);
      for(let n=1;n<=ex.sets;n++){
        const key=`${ex.id}_${n}`;if(done.has(key)||warm.has(key)||changed.has(key))continue;
        const suggestion=query.setSuggestion(ex,n,recommendation);
        const common={set:n,load:format.load(suggestion.load),unit:format.unit(),reps:suggestion.reps};
        if(suggestion.src==='session-up')return copy.t('log.insession.up',common);
        if(suggestion.src==='session-down')return copy.t('log.insession.down',common);
        if(suggestion.src==='session-hold')return copy.t('log.insession.hold',common);
        if(recommendation.status==='add'&&suggestion.load!=null&&Number(suggestion.reps)>Number(ex.min))
          return copy.t('log.insession.reentry',common);
      }
      return '';
    }
    /** @param {Exercise} ex @param {number} n @param {Recommendation} recommendation @param {boolean} editing */
    function cueFor(ex,n,recommendation,editing){
      const suggestion=editing?{load:null,reps:null,src:'manual'}:query.setSuggestion(ex,n,recommendation);
      const move=suggestion.src==='session-up'?'up':suggestion.src==='session-down'?'down':suggestion.src==='session-hold'?'hold':recommendation.status==='add'?'up':recommendation.status==='reduce'?'down':'hold';
      return cue.cue({exerciseId:ex.id,ordinal:n,total:ex.sets,min:ex.min,max:ex.max,status:recommendation.status,editing,suggestion,move});
    }
    /** @param {Exercise} ex @param {number} n @param {Recommendation} recommendation @param {import('./cue.js').Cue} selectedCue @param {string} mode @param {{peek:boolean,name:string}} options */
    function slotInner(ex,n,recommendation,selectedCue,mode,{peek,name}){
      return cue.slotInner(n,selectedCue,mode,{exerciseId:ex.id,status:recommendation.status,peek,name,
        hasNote:recommendation.status==='new'&&!!sessionNote(ex)});
    }
    /** @param {Exercise} ex @param {number} n @param {Recommendation} recommendation @param {import('./cue.js').Cue} selectedCue @param {{peek:boolean,name:string,editing:boolean}} options */
    function slotHtml(ex,n,recommendation,selectedCue,options){const mode=rest.slotMode(options.editing);return `<div class="fx-slot" data-rest="${mode}">${slotInner(ex,n,recommendation,selectedCue,mode,options)}</div>`;}
    /** @param {Exercise} ex @param {Recommendation} recommendation @param {LogRow[]} previous @param {{peek?:boolean,effortMode:boolean}} options */
    function ledgerModel(ex,recommendation,previous,{peek=false,effortMode}){
      const selection=focus.selectExercise(ex,committed,{peek});
      return {exerciseId:ex.id,selection,effortMode,peek,targetEffort:targetEffort(ex),facts:selection.visible.map(n=>{
        const done=committed.has(`${ex.id}_${n}`)&&n!==selection.editing,open=n===selection.active;
        const shown=values.row(fieldFacts(ex,n,recommendation,previous),effortMode),old=previous.find(row=>row.set===n)||null;
        return {ordinal:n,done,warmup:values.set(draft,ex.id,n)?.role==='warmup',load:shown.load,reps:shown.reps,effort:shown.eff,
          touched:open||done?values.touched(draft,ex.id,n):{},previous:old,projection:old?query.readLogRow(old):null};
      })};
    }
    /** @param {Exercise} ex @param {Recommendation} recommendation @param {LogRow[]} previous @param {{peek?:boolean,effortMode:boolean}} options */
    const ledgerHtml=(ex,recommendation,previous,options)=>ledger.render(ledgerModel(ex,recommendation,previous,options));
    /** @param {Exercise} ex @param {Recommendation} recommendation @param {LogRow[]} previous @param {{peek?:boolean,effortMode:boolean}} options */
    const ledgerRows=(ex,recommendation,previous,options)=>ledger.rows(ledgerModel(ex,recommendation,previous,options));
    /** @param {Exercise} ex @param {Recommendation} recommendation @param {LogRow[]} previous @param {CardOptions} options */
    function shelfHtml(ex,recommendation,previous,{allDone,hasNext,peek=false}){
      const selection=focus.selectExercise(ex,committed,{peek}),n=selection.active;
      return shelf.render({exerciseId:ex.id,selection,allDone,hasNext,peek,exerciseCount:list.length,beats,effortMode,
        values:n?values.fields(fieldFacts(ex,n,recommendation,previous)):null,touched:n?values.touched(draft,ex.id,n):{},
        set:n?values.set(draft,ex.id,n):null,carry:n?values.carry(draft,ex.id,n,recommendation):null,
        metrics:n?values.definitions(draft,ex.id,n):[],loadStep:format.loadStep()});
    }
    /** The same selected pad facts used by the complete shelf, without a draft
     * mutation or an intermediate detached shelf render.
     * @param {Exercise} ex @param {number} ordinal @param {Recommendation} recommendation @param {LogRow[]} previous */
    function padsHtml(ex,ordinal,recommendation,previous){
      const definitions=values.definitions(draft,ex.id,ordinal),key=`${ex.id}_${ordinal}`;
      return shelf.padsHtml({exerciseId:ex.id,ordinal,ui:focus.shelfFor(key,definitions[0]?'metric_'+definitions[0].id:'reps'),
        values:values.fields(fieldFacts(ex,ordinal,recommendation,previous)),effortMode,peek:false,
        editing:focus.edit?.exId===ex.id,metrics:definitions,loadStep:format.loadStep()});
    }
    /** @param {Exercise} ex */
    function lastNote(ex){const match=query.matchLift(ex),rows=log.filter(row=>match(row)&&String(row.exNote||'').trim());return rows.length?String(rows.sort(compareChronology).at(-1)?.exNote).trim():'';}
    /** @param {Exercise} ex @param {Recommendation} recommendation @param {LogRow[]} previous @param {CardOptions} options */
    function card(ex,recommendation,previous,{peek=false,hasNext=true,allDone=false,nextName=''}){
      const n=focus.selectExercise(ex,committed,{peek}).active,name=labels.exercise(ex);
      const editing=!!focus.edit&&focus.edit.exId===ex.id&&!!n,selectedCue=n?cueFor(ex,n,recommendation,editing):null;
      return renderFocusCard({exerciseId:ex.id,status:recommendation.status,peek,name,meta:meta(ex),note:flat.__exnotes?.[ex.id]??lastNote(ex),
        slotHtml:selectedCue?slotHtml(ex,n,recommendation,selectedCue,{peek,name,editing}):'',ledgerHtml:ledgerHtml(ex,recommendation,previous,{effortMode,peek}),
        shelfHtml:shelfHtml(ex,recommendation,previous,{allDone,hasNext,peek}),nextName:hasNext?nextName:'',nextTemplate:copy.t('focus.next_row',{name:'\u0000'})});
    }
    /** @param {Exercise} current @param {Recommendation} recommendation @param {LogRow[]} previous @param {number} at */
    function deck(current,recommendation,previous,at){
      const allDone=list.every(ex=>{for(let n=1;n<=ex.sets;n++)if(!committed.has(`${ex.id}_${n}`))return false;return true});
      const nameAt=(/** @type {number} */ index)=>list[index]?labels.exercise(query.sessionExercise(list[index])):'';
      const peek=(/** @type {number} */ index)=>{const base=list[index];if(!base)return '';const ex=query.sessionExercise(base);return card(ex,query.recommendation(ex),query.last(ex),{peek:true,hasNext:index<list.length-1,allDone,nextName:nameAt(index+1)})};
      return renderFocusDeck({label:copy.t('focus.deck_aria'),previousHtml:peek(at-1),currentHtml:card(current,recommendation,previous,{hasNext:at<list.length-1,allDone,nextName:nameAt(at+1)}),nextHtml:peek(at+1)});
    }
    return {meta,targetEffort,sessionNote,padsHtml,exerciseName:labels.exercise,cue:cueFor,slotInner,slotHtml,ledgerModel,ledgerHtml,ledgerRows,shelfHtml,card,deck};
  }
  return {format,metrics,values,effort,rest,cue,ledger,prescription,shelf,capture,dispose:effort.dispose};
}
