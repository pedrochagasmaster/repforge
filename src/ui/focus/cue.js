import {escapeHtml as esc,verdictMarkHtml} from '../format.js';
/** @typedef {ReturnType<import('../../app/workout-model.js').WorkoutCapture['setSuggestion']>} Suggestion
 * @typedef {{kind:string,move:string,headHtml:string,sub:string,loadText?:string,reps?:Suggestion['reps'],parity?:string}} Cue
 * @typedef {{exerciseId:string,status:string,peek:boolean,name:string,hasNote:boolean}} CueContext
 * @typedef {{exerciseId:string,ordinal:number,total:number,min:number,max:number,status:string,editing:boolean,suggestion:Pick<Suggestion,'load'|'reps'|'src'>,move:string}} CueFacts
 */
/** Presentation receives the engine's suggestion and already-selected movement.
 * It never queries a draft/history, calculates a training target or writes state.
 * @param {{copy:{t:(key:string,values?:Record<string,unknown>)=>string},format:{load:(value:unknown)=>string,unit:()=>string},rest:ReturnType<typeof import('./rest-view.js').createRestPresentation>}} options */
export function createCuePresentation({copy:{t},format,rest}){
  /** @param {CueFacts} facts @returns {Cue} */
  function cue({exerciseId,ordinal,total,min,max,status,editing,suggestion,move}){
    if(editing)return {kind:'edit',move:'',headHtml:esc(t('focus.cue.editing_set',{n:ordinal,total})),sub:''};
    if(status==='manual')return {kind:'manual',move:'',headHtml:esc(t('focus.cue.your_targets')),sub:t('focus.cue.range_reps',{reps:`${min}–${max}`})};
    if(status==='configuration_required')return {kind:'setup',move:'',headHtml:esc(t('focus.cue.needs_setup')),sub:t('focus.cue.range_reps',{reps:`${min}–${max}`})};
    if(suggestion.load==null)return {kind:'start',move:'',headHtml:esc(t('focus.cue.pick_load',{min,max})),sub:''};
    const reps=suggestion.reps!=null?suggestion.reps:min;
    const sentence=t(`focus.cue.${move}`,{load:'\u0000',unit:format.unit()});
    const loadText=format.load(suggestion.load);
    const parity=suggestion.src==='base'?` data-parity-target="${esc(exerciseId)}"`:'';
    return {kind:'now',move,loadText,reps,parity,
      headHtml:esc(sentence).replace('\u0000',`<b class="fx-cue__load"${parity}>${esc(loadText)}</b>`),
      sub:t('focus.cue.reps',{reps})};
  }
  /** @param {CueContext} context @param {string} label @param {string} cls */
  function why({exerciseId,status,peek,name,hasNote},label,cls){
    if(!(status!=='new'||hasNote))return '';
    return `<button type="button" class="text-link focus-ex__why ${cls}"${peek?' tabindex="-1"'
      :` data-why="${esc(exerciseId)}" aria-label="${esc(t('why.open_aria',{name}))}"`}>${esc(label)}</button>`;
  }
  /** @param {Cue} cue @param {CueContext} context */
  function block(cue,context){
    const mark=`<span class="fx-cue__mark" aria-hidden="true">${verdictMarkHtml(cue.move)}</span>`;
    const link=why(context,t('why.open'),'fx-cue__why');
    const cancel=cue.kind==='edit'?`<button type="button" class="text-link fx-cue__cancel"${context.peek?' tabindex="-1"':' data-fcancel'}>${esc(t('focus.cancel_edit'))}</button>`:'';
    return `<div class="fx-cue is-${cue.kind}">${mark}<p class="fx-cue__l1">${cue.headHtml}</p>`+
      (cue.sub?`<p class="fx-cue__l2">${esc(cue.sub)}</p>`:'')+link+cancel+'</div>';
  }
  /** @param {number} ordinal @param {Cue} cue @param {CueContext} context */
  function next(ordinal,cue,context){
    let line;
    if(cue.kind==='now'){
      const vars={n:ordinal,load:'\u0000',reps:'\u0001',unit:format.unit()};
      const sentence=cue.move==='up'?t('rest.inline.next_up',vars):cue.move==='down'?t('rest.inline.next_down',vars):t('rest.inline.next',vars);
      line=esc(sentence).replace('\u0000',`<b class="restinline__val"${cue.parity}>${esc(cue.loadText)}</b>`)
        .replace('\u0001',`<b class="restinline__val">${esc(String(cue.reps))}</b>`);
    }else line=cue.headHtml+(cue.sub?` · ${esc(cue.sub)}`:'');
    return `<div class="restinline__nextrow"><p class="restinline__next">${line}</p>`+
      why(context,t('why.short'),'restinline__why')+'</div>';
  }
  /** @param {number} ordinal @param {Cue} cue @param {string} mode @param {CueContext} context */
  function slotInner(ordinal,cue,mode,context){
    if(mode==='running')return rest.clockHtml()+next(ordinal,cue,context);
    if(mode==='done')return rest.doneHtml()+block(cue,context);
    return block(cue,context);
  }
  return {cue,slotInner};
}
