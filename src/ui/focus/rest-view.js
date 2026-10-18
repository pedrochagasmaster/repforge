import {escapeHtml as esc,formatClock} from '../format.js';
import {renderFocusPadsInner} from './view.js';
/** Readonly presentation of the existing Focus clock. No timer or saved state.
 * @param {{window:Window,clock:ReturnType<typeof import('./rest.js').createRestClock>,readDefaultSeconds:()=>number,copy:{t:(key:string,values?:Record<string,unknown>)=>string}}} options
 */
export function createRestPresentation({window,clock,readDefaultSeconds,copy:{t}}){
  const leftMs=()=>clock.left(readDefaultSeconds());
  const leftSeconds=()=>Math.round(leftMs()/1000);
  const plan=()=>clock.plan(readDefaultSeconds());
  const mode=()=>!clock.end?'none':leftSeconds()>0?'running':'done';
  const fraction=()=>Math.max(0,Math.min(1,leftMs()/1000/Math.max(1,plan())));
  const overSeconds=()=>Math.min(60*60,Math.max(0,-leftSeconds()));
  const padsFit=()=>!(Number.parseFloat(window.getComputedStyle(window.document.documentElement).fontSize)>16.1);
  /** @param {boolean} editing */
  const slotMode=editing=>editing?'none':mode();
  /** @param {boolean} editing */
  const padsOn=editing=>!editing&&!clock.padsBack&&padsFit()&&mode()==='running';
  function clockHtml(){
    return `<div class="restinline" role="timer"><div class="restinline__row">`+
      `<span class="restinline__label">${esc(t("rest.inline.label"))}</span>`+
      `<b class="restinline__clock" data-rest-clock>${esc(formatClock(Math.max(0,leftSeconds())))}</b>`+
      `<span class="restinline__of" data-rest-of>${esc(t("rest.inline.of",{t:formatClock(plan())}))}</span></div>`+
      `<div class="restinline__bar" aria-hidden="true"><i class="restinline__fill" data-rest-fill style="transform:scaleX(${fraction().toFixed(4)})"></i></div></div>`;
  }
  /** @param {number} over */
  const doneText=over=>over>0?t('rest.inline.done_over',{time:formatClock(over)}):t('rest.inline.done');
  function doneHtml(){
    return `<div class="restinline restinline--done" role="timer"><p class="restinline__done"><span class="restinline__mk" aria-hidden="true"></span>`+
      `<span data-rest-done>${esc(doneText(overSeconds()))}</span></p></div>`;
  }
  /** @param {boolean} peek @returns {import('./view.js').ShelfModel} */
  function selectPads(peek){
    const held=clock.paused!=null;
    return {peek,rest:true,restLabel:t('rest.inline.label'),pads:[
      {action:'minus',className:'restpad--adjust',text:t('rest.sheet.minus'),ariaLabel:t('rest.sheet.minus_aria')},
      {action:'pause',className:'restpad--toggle',text:t(held?'rest.inline.resume':'rest.inline.pause')},
      {action:'plus',className:'restpad--adjust',text:t('rest.sheet.plus'),ariaLabel:t('rest.sheet.plus_aria')},
      {action:'skip',className:'restpad--skip',text:t('log.skip')}]};
  }
  /** @param {boolean} peek */
  const padsHtml=peek=>renderFocusPadsInner(selectPads(peek));
  /** Paint live clock text without replacing controls or their keyboard focus.
   * @param {HTMLElement} card */
  function syncNumbers(card){
    const clockNode=card.querySelector('[data-rest-clock]');
    if(clockNode){
      const left=formatClock(Math.max(0,leftSeconds()));if(clockNode.textContent!==left)clockNode.textContent=left;
      const of=card.querySelector('[data-rest-of]'),text=t('rest.inline.of',{t:formatClock(plan())});
      if(of&&of.textContent!==text)of.textContent=text;
      const fill=card.querySelector(/** @type {'div'} */('[data-rest-fill]'));
      if(fill)fill.style.transform=`scaleX(${fraction().toFixed(4)})`;
    }
    const done=card.querySelector('[data-rest-done]');
    if(done){const text=doneText(overSeconds());if(done.textContent!==text)done.textContent=text;}
    const pause=card.querySelector('[data-rest-act="pause"]');
    if(pause){const label=t(clock.paused!=null?'rest.inline.resume':'rest.inline.pause');if(pause.textContent!==label)pause.textContent=label;}
  }
  /** The header and floating bar read this same clock, including while idle.
   * @param {boolean} active @param {boolean} enabled */
  function chrome(active,enabled){
    const chip=window.document.querySelector(/** @type {'button'} */('#woRest'));
    if(chip){
      chip.classList.toggle('hidden',!(active&&enabled));chip.classList.toggle('is-running',!!clock.end);chip.disabled=false;
      if(!clock.end){chip.classList.remove('is-done','is-over','is-paused');chip.setAttribute('aria-label',t('focus.rest.start_aria'));}
    }
    window.document.querySelector('#restBar')?.classList.toggle('is-shadowed',active);
  }
  return {chrome,syncNumbers,mode,fraction,overSeconds,slotMode,padsFit,padsOn,clockHtml,doneText,doneHtml,selectPads,padsHtml};
}
