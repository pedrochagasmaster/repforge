import {escapeHtml as esc} from '../format.js';
export {effortForRir} from '../../training/metrics.js';
export const EFFORT_STEPS=Object.freeze(['easy','hard','max']);
/** The effort word, its accessible stepped value, and the short-lived explainer.
 * Owns animation timers, never a draft value; the caller acknowledges edits via
 * the named workout command. Construction installs no listeners or timers.
 * @param {{window:Window,focus:Pick<ReturnType<typeof import('./state.js').createFocusState>,'valueBeat'>,copy:{t:(key:string,values?:Record<string,unknown>)=>string},motion:{playBeat:(element:HTMLElement,className:string)=>void}}} options */
export function createEffortPresentation({window,focus,copy:{t},motion}){
  const document=window.document;
  const label=(/** @type {string} */ effort)=>t('effort.'+effort);
  const hint=(/** @type {string|undefined} */ effort)=>t('effort.hint.'+effort);
  /** @type {Map<HTMLElement,{bump?:number,close?:number}>} */ const timers=new Map();
  /** @param {HTMLElement} element */
  function timing(element){let record=timers.get(element);if(!record){record={};timers.set(element,record)}return record;}
  /** @param {HTMLElement|null} value @param {number} direction */
  function valueMove(value,direction){
    if(!value||!direction||focus.valueBeat==='off')return;
    motion.playBeat(value,focus.valueBeat==='fade'?'motion-value-fade':direction>0?'motion-value-up':'motion-value-down');
  }
  /** @param {HTMLElement|null} pop @param {string|undefined} effort @param {{bump?:boolean}} [options] */
  function fill(pop,effort,{bump=false}={}){
    if(!pop)return;
    const text=pop.querySelector('.effortpop__hint');if(text)text.textContent=hint(effort);
    if(!bump)return;
    const record=timing(pop);window.clearTimeout(record.bump);pop.classList.remove('is-bump');void pop.offsetWidth;
    pop.classList.add('is-bump');record.bump=window.setTimeout(()=>{pop.classList.remove('is-bump');record.bump=undefined;if(record.close==null)timers.delete(pop)},420);
  }
  /** @param {string} key @param {string} effort @param {number} [direction] */
  function pick(key,effort,direction=0){
    document.querySelectorAll(/** @type {'button'} */(`[data-effspin="${key}"]`)).forEach(element=>{
      element.dataset.e=effort;
      const word=element.querySelector(/** @type {'span'} */('.shelf__val')),moved=!!word&&word.textContent!==label(effort);
      (word||element).textContent=label(effort);if(moved)valueMove(word,direction);
      const row=element.closest('.exercise')?.querySelector('.ledgerline--open [data-lv="rir"]');
      if(row){row.textContent=label(effort);row.classList.remove('is-soft')}
      element.closest('.shelf__field')?.classList.remove('is-untouched');
      document.querySelectorAll(/** @type {'button'} */(`[data-effstep="${key}"]`)).forEach(button=>{
        const direction=Number(button.dataset.dir),next=EFFORT_STEPS[Math.max(0,EFFORT_STEPS.indexOf(effort))+direction];
        button.textContent=t('focus.shelf.pad_effort',{sign:direction>0?'+':'−',effort:label(next||effort)});button.disabled=!next;
      });
      if(element.getAttribute('role')==='spinbutton'){
        element.setAttribute('aria-valuenow',String(EFFORT_STEPS.indexOf(effort)+1));element.setAttribute('aria-valuetext',label(effort));
      }
      const pop=element.closest('.shelf__field')?.querySelector(/** @type {'div'} */('.effortpop'))||null;
      fill(pop,effort,{bump:!!pop?.classList.contains('is-open')});
    });
  }
  /** @param {string} key @param {string} effort */
  const html=(key,effort)=>`<div class="effortpop" id="effpop_${esc(key)}" data-effpop="${esc(key)}" role="tooltip">`+
    `<span class="effortpop__hint">${esc(hint(effort))}</span><span class="effortpop__arrow" aria-hidden="true"></span></div>`;
  /** @param {{except?:HTMLElement|null}} [options] */
  function close({except=null}={}){
    document.querySelectorAll(/** @type {'div'} */('.effortpop.is-open')).forEach(pop=>{
      if(pop===except)return;
      pop.classList.remove('is-open');pop.classList.add('is-closing');
      const record=timing(pop);window.clearTimeout(record.close);record.close=window.setTimeout(()=>{pop.classList.remove('is-closing');record.close=undefined;if(record.bump==null)timers.delete(pop)},240);
      const spin=document.querySelector(/** @type {'button'} */(`[data-effspin="${pop.dataset.effpop}"]`));
      spin?.classList.remove('is-open');spin?.closest('.shelf__field')?.classList.remove('is-active');
    });
  }
  /** @param {string} key */
  function open(key){
    const spin=document.querySelector(/** @type {'button'} */(`[data-effspin="${key}"]`)),pop=document.querySelector(/** @type {'div'} */(`[data-effpop="${key}"]`));
    if(!spin||!pop)return;
    close({except:pop});spin.closest('.shelf__field')?.classList.add('is-active');fill(pop,spin.dataset.e);
    const record=timers.get(pop);window.clearTimeout(record?.close);if(record){record.close=undefined;if(record.bump==null)timers.delete(pop)}
    pop.classList.remove('is-closing');pop.classList.add('is-open');spin.classList.add('is-open');
  }
  /** @param {string} key */
  function toggle(key){const pop=document.querySelector(`[data-effpop="${key}"]`);if(pop?.classList.contains('is-open'))close();else open(key);}
  function dispose(){
    for(const record of timers.values()){window.clearTimeout(record.bump);window.clearTimeout(record.close)}timers.clear();
    document.querySelectorAll('.effortpop').forEach(pop=>pop.classList.remove('is-open','is-bump','is-closing'));
    document.querySelectorAll('[data-effspin]').forEach(spin=>{spin.classList.remove('is-open');spin.closest('.shelf__field')?.classList.remove('is-active')});
  }
  return {pick,valueMove,html,open,close,toggle,dispose};
}
