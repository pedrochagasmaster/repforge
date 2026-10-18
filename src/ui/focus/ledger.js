import {escapeHtml as esc} from '../format.js';
import {effortForRir} from './effort.js';
import {renderFocusLedgerToggle,renderFocusLedgerRows,renderFocusLedger} from './view.js';
/** @typedef {{load?:unknown,reps?:unknown,rir?:unknown,metricDefinitions?:readonly {semantic:string}[]}} PreviousSet
 * @typedef {{ordinal:number,done:boolean,warmup:boolean,load:string,reps:string,effort:string,touched:Partial<import('../../training/workout-contracts.js').Touched>,previous:PreviousSet|null,projection:{load:number|null,reps:number|null}|null}} LedgerFacts
 */
/** Ledger layout and localized readback. All history/training projections and
 * field values are supplied facts, never computed through root callbacks.
 * @param {{copy:{t:(key:string,values?:Record<string,unknown>)=>string,plural:(count:number,word:string)=>string,term:(name:string)=>string},format:{number:(value:unknown)=>string,load:(value:unknown)=>string,unit:()=>string}}} options */
export function createLedgerPresentation({copy:{t,plural,term},format}){
  const effortLabel=(/** @type {string} */ value)=>t('effort.'+value);
  /** @param {PreviousSet|null} row @param {{load:number|null,reps:number|null}|null} projection @param {boolean} effortMode */
  function previousLine(row,projection,effortMode){
    if(!row||!projection)return '';
    const definitions=Array.isArray(row.metricDefinitions)?row.metricDefinitions:[];
    const hasSideLoad=definitions.some(metric=>['loadPerSideKg','persistentLoadPerSideKg'].includes(metric?.semantic));
    const hasSideReps=definitions.some(metric=>metric?.semantic==='repsPerSide');
    const hasTotalLoad=definitions.some(metric=>metric?.semantic==='loadKg');
    const family=hasSideLoad&&hasSideReps?'both_per_side':hasSideLoad?'per_side_load'
      :hasSideReps&&hasTotalLoad?'total_load_reps_per_side':hasSideReps?'bodyweight_reps_per_side':null;
    if(family){
      const ending=row.rir==null||row.rir===''?'norir':effortMode?'effort':'rir';
      return t(`focus.prev_line.${family}.${ending}`,{load:format.load(projection.load),unit:format.unit(),reps:projection.reps,
        rir:format.number(row.rir),effort:effortLabel(effortForRir(Number(row.rir)))});
    }
    const load=format.load(projection.load??row.load),reps=projection.reps??row.reps;
    if(row.rir==null||row.rir==='')return t('focus.prev_line_norir',{load,reps});
    return effortMode?t('focus.prev_line_effort',{load,reps,effort:effortLabel(effortForRir(Number(row.rir)))})
      :t('focus.prev_line',{load,reps,rir:format.number(row.rir)});
  }
  /** @param {string} exerciseId @param {ReturnType<ReturnType<typeof import('./state.js').createFocusState>['selectExercise']>} selection @param {boolean} peek */
  function toggle(exerciseId,selection,peek){
    const count=selection.loggedCount;if(!count||selection.active===0)return '';
    const open=selection.expanded;
    return renderFocusLedgerToggle({count,open,fresh:!open&&selection.fresh,peek,exerciseId,
      labelTemplate:t('focus.ex_done_sets',{n:'\u0000',sets:'\u0001'}),setsWord:plural(count,'logged set')});
  }
  /** @param {{exerciseId:string,selection:ReturnType<ReturnType<typeof import('./state.js').createFocusState>['selectExercise']>,facts:readonly LedgerFacts[],effortMode:boolean,peek:boolean,targetEffort:string}} model */
  function rows({exerciseId,selection,facts,effortMode,peek,targetEffort}){
    const rows=facts.map(fact=>{
      const n=fact.ordinal,done=fact.done&&n!==selection.editing,open=n===selection.active;
      const soft=(/** @type {'load'|'reps'|'rir'} */ field)=>!done&&!(field==='rir'?fact.touched.effort:fact.touched[field]);
      const indexHtml=done?'<span class="fx-check" aria-hidden="true"></span>':!peek&&fact.warmup?`<span aria-hidden="true">${esc(t('ledger.set.warmup'))}</span><span class="visually-hidden">${esc(t('ex.actions.role_warmup'))}</span>`:String(n);
      return {ordinal:n,done,open,fresh:n===selection.freshOrdinal,editing:n===selection.editing,indexHtml,load:fact.load,reps:fact.reps,
        rir:open||done?fact.effort:targetEffort,softLoad:open||done?soft('load'):true,softReps:open||done?soft('reps'):true,softRir:open||done?soft('rir'):true,
        previousLine:previousLine(fact.previous,fact.projection,effortMode),editLabel:t('focus.edit_set_aria',{n})};
    });
    return renderFocusLedgerRows({rows,peek,exerciseId});
  }
  /** @param {Parameters<typeof rows>[0]} model */
  function render(model){
    const {exerciseId,selection,effortMode,peek}=model;
    return renderFocusLedger({exerciseId,headers:{set:t('log.set'),load:format.unit(),reps:t('log.reps'),
      effortHtml:effortMode?(peek?esc(t('log.effort')):term('Effort')):(peek?'RIR':term('RIR'))},
      toggleHtml:toggle(exerciseId,selection,peek),rowsHtml:rows(model)});
  }
  return {render,rows,previousLine};
}
