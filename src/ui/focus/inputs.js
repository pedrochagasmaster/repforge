import {parseDecimalInput,POUNDS_PER_KG} from '../../training/metrics.js';
import {formatNumberPlain} from '../format.js';
import {selectDraftTarget} from './select.js';
import {EFFORT_STEPS} from './effort.js';
/** Actual input-to-command binding. Pending tokens survive a rebuild, and an
 * acknowledgement finds the current control by stable identity. Disposal stops
 * UI effects while letting an already-issued durable command settle normally.
 * @param {{window:Window,focus:ReturnType<typeof import('./state.js').createFocusState>,read:()=>{draft:import('../../training/workout-contracts.js').Draft|null,unit:string,minJump:unknown},commands:Pick<ReturnType<typeof import('../../app/workout.js').createFocusWorkoutCommands>,'editField'>,shelf:ReturnType<typeof import('./shelf.js').createShelfPresentation>,effort:ReturnType<typeof import('./effort.js').createEffortPresentation>,controls:ReturnType<typeof import('./control-focus.js').createControlFocus>,onAcknowledged:(field:Element|null)=>Promise<unknown>}} options */
export function createFocusInputs({window,focus,read,commands,shelf,effort,controls,onAcknowledged}){
  const document=window.document;
  let lifetime=0;
  /** @type {Array<()=>void>} */ let unbind=[];
  /** @param {string} selector */
  const live=selector=>Array.from(document.querySelectorAll(/** @type {'input'} */(`#workout ${selector}`))).filter(element=>!element.closest('.is-peek'));
  /** @param {HTMLInputElement} input */
  const definitions=input=>{const draft=read().draft,target=selectDraftTarget(draft,input.dataset.k);return target?draft?.exercises[target.exerciseInstanceId]?.sets[target.setId]?.programmed.metrics||[]:[]};
  /** @param {HTMLInputElement} input */
  async function editInput(input){
    const version=lifetime,target=selectDraftTarget(read().draft,input.dataset.k);
    const direction=focus.padTap.get(input)||0;focus.padTap.delete(input);
    if(!target?.field)return;
    input.closest('.shelf__field')?.classList.remove('is-suggested');
    const key=input.dataset.k;if(!key)return;
    const token=focus.holdPendingField(key,input.value);
    let result;
    try{result=await commands.editField({target,rawValue:input.value})}finally{focus.releasePendingField(key,token)}
    if(result.status!=='applied'||version!==lifetime)return;
    const current=controls.input(key);if(!current)return;
    shelf.syncInput(current,{definitions:definitions(current),direction});
    await onAcknowledged(current.closest('.shelf__field'));
  }
  /** @param {HTMLElement} button */
  async function step(button){
    if(!button.dataset.step)return;
    const input=document.querySelector(/** @type {'input'} */(`[data-k="${button.dataset.step}"]`));if(!input)return;
    const key=button.dataset.step||'',direction=Number(button.dataset.dir)||0,{draft,unit,minJump}=read();
    const target=selectDraftTarget(draft,key);
    if(target?.metricId){
      const metric=draft?.exercises[target.exerciseInstanceId]?.sets[target.setId]?.programmed.metrics?.find(item=>item.id===target.metricId);
      const current=parseDecimalInput(input.value)||0,load=['loadKg','assistanceKg','loadPerSideKg','persistentLoadPerSideKg'].includes(metric?.semantic||'');
      const kg=parseDecimalInput(minJump)||2.5,display=unit==='lb'?kg*POUNDS_PER_KG:kg;
      const increment=load?(Math.round(display*10)/10||1):1;
      input.value=formatNumberPlain(Math.max(0,Math.round((current+increment*direction)*10)/10));
    }else if(/_reps$|_rir$/.test(key)){
      input.value=formatNumberPlain(Math.max(0,(parseDecimalInput(input.value)||0)+direction));
    }else{
      const increment=parseDecimalInput(minJump)||2.5,parsed=parseDecimalInput(input.value||0);
      const displayed=Number.isFinite(parsed)?parsed:0,current=unit==='lb'?displayed/POUNDS_PER_KG:displayed;
      const next=Math.max(0,Math.round((current+increment*direction)/increment)*increment);
      input.value=formatNumberPlain(unit==='lb'?next*POUNDS_PER_KG:next);
    }
    focus.padTap.set(input,direction);await editInput(input);
  }
  /** @param {string|undefined} key @param {number} direction */
  async function stepEffort(key,direction){
    const element=document.querySelector(/** @type {'button'} */(`[data-effspin="${key}"]`));if(!element||!key)return;
    const current=element.dataset.e||'',index=Math.max(0,EFFORT_STEPS.indexOf(current));
    const next=EFFORT_STEPS[Math.min(EFFORT_STEPS.length-1,Math.max(0,index+direction))];if(next===current)return;
    const version=lifetime,target=selectDraftTarget(read().draft,key);if(!target)return;
    effort.pick(key,next,direction);
    const pendingKey=`${key}_effort`,token=focus.holdPendingField(pendingKey,next);
    let result;
    try{result=await commands.editField({target:{...target,field:'effort',metricId:null},rawValue:next})}
    finally{focus.releasePendingField(pendingKey,token)}
    if(result.status!=='applied'||version!==lifetime)return;
    await onAcknowledged(controls.effortField(key));
  }
  function clearBindings(){for(const clear of unbind)clear();unbind=[];}
  function bind(){
    clearBindings();
    for(const input of live('input')){
      const change=()=>editInput(input),select=()=>input.select();input.oninput=change;input.onfocus=select;
      unbind.push(()=>{if(input.oninput===change)input.oninput=null;if(input.onfocus===select)input.onfocus=null});
    }
    for(const button of live('.stepbtn')){
      const click=()=>step(button);button.onclick=click;unbind.push(()=>{if(button.onclick===click)button.onclick=null});
    }
    for(const button of live('[data-effstep]')){
      const click=()=>stepEffort(button.dataset.effstep,Number(button.dataset.dir)||0);button.onclick=click;
      unbind.push(()=>{if(button.onclick===click)button.onclick=null});
    }
    for(const element of live('[data-effspin]')){
      const keydown=element.onkeydown=event=>{
        if(event.key==='Escape'){effort.close();return}
        const step=event.key==='ArrowUp'||event.key==='ArrowRight'?1:event.key==='ArrowDown'||event.key==='ArrowLeft'?-1:0;
        const jump=event.key==='Home'?-EFFORT_STEPS.length:event.key==='End'?EFFORT_STEPS.length:null;
        if(!step&&jump==null)return;
        event.preventDefault();void stepEffort(element.dataset.effspin,jump??step);
      };unbind.push(()=>{if(element.onkeydown===keydown)element.onkeydown=null});
    }
  }
  function dispose(){lifetime++;clearBindings();}
  return {bind,dispose};
}
