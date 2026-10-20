import {escapeHtml as esc,formatClock} from '../format.js';
import {REST_NUDGE} from './rest.js';
/** The timer sheet reads the same clock as the card and header. Named clock
 * commands retain notification/announcement policy outside presentation.
 * @param {{window:Window & typeof globalThis,clock:ReturnType<typeof import('./rest.js').createRestClock>,shell:Pick<ReturnType<typeof import('../shell.js').createShell>,'openModal'|'closeModal'|'activeModal'>,motion:Pick<ReturnType<typeof import('../../platform/motion.js').createMotion>,'reducedMotion'>,readDefaultSeconds:()=>number,commands:{start:()=>void,length:(seconds:number)=>void,nudge:(seconds:number)=>void,hold:()=>void,reset:()=>void,stop:()=>void},copy:{t:(key:string,values?:Record<string,unknown>)=>string}}} options */
export function createRestSheet({window,clock,shell,motion,readDefaultSeconds,commands,copy:{t}}){
  const document=window.document;
  /** @type {AbortController|null} */let abort=null;
  let openingFrame=0,disposed=false;
  const sheet=()=>document.querySelector(/** @type {'div'} */('#restSheet'));
  const plan=()=>clock.plan(readDefaultSeconds());
  function ensureHold(){
    const row=document.querySelector('#restSheet .restsheet__controls');if(!row)return null;
    let hold=document.querySelector(/** @type {'button'} */('#restHold'));
    if(!hold){hold=document.createElement('button');hold.type='button';hold.id='restHold';hold.className='restctl';
      const label=document.createElement('span');label.className='restctl__label';hold.append(label);row.prepend(hold);}
    return hold;
  }
  function render(){
    const host=document.querySelector('#restPresets');if(!host)return;
    const seconds=new Set([60,90,180,300]),defaultSeconds=readDefaultSeconds();if(defaultSeconds>0)seconds.add(defaultSeconds);
    host.innerHTML=[...seconds].sort((a,b)=>a-b).map(value=>`<button type="button" class="restpreset" data-restpreset="${value}" aria-pressed="false" aria-label="${esc(t('rest.sheet.preset_aria',{time:formatClock(value)}))}">${esc(formatClock(value))}</button>`).join('');
  }
  function paint(){
    const host=sheet();if(disposed||!host||host.hidden)return;
    host.classList.toggle('is-idle',!clock.end);
    for(const button of document.querySelectorAll(/** @type {'button'} */('#restPresets [data-restpreset]'))){
      const on=Number(button.dataset.restpreset)===plan();button.classList.toggle('is-active',on);button.setAttribute('aria-pressed',on?'true':'false');
    }
    const hold=ensureHold();if(hold){hold.disabled=!clock.end;const label=hold.querySelector('.restctl__label'),text=t(clock.paused!=null?'rest.inline.resume':'rest.inline.pause');if(label&&label.textContent!==text)label.textContent=text;}
    for(const id of ['restReset','restStop']){const button=document.querySelector(/** @type {'button'} */('#'+id));if(button)button.disabled=!clock.end;}
  }
  function close(){
    if(openingFrame)window.cancelAnimationFrame(openingFrame);openingFrame=0;
    const host=sheet();if(!host||host.hidden&&shell.activeModal?.el!==host)return Promise.resolve(false);
    return shell.closeModal(host);
  }
  function mount(){
    if(abort||disposed)return;abort=new window.AbortController();const signal=abort.signal;
    /** @param {string} selector @param {()=>unknown} command */
    const click=(selector,command)=>document.querySelector(selector)?.addEventListener('click',()=>command(),{signal});
    click('#restBar',open);click('#woRest',()=>clock.end?open():commands.start());
    click('#restSheetClose',close);click('#restSheetScrim',close);
    click('#restMinus',()=>commands.nudge(-REST_NUDGE));click('#restPlus',()=>commands.nudge(REST_NUDGE));
    click('#restReset',commands.reset);click('#restStop',()=>{commands.stop();void close();});
    sheet()?.addEventListener('click',event=>{
      const target=event.target instanceof window.Element?event.target:null;
      const preset=target?.closest(/** @type {'button'} */('[data-restpreset]'));
      if(preset)commands.length(Number(preset.dataset.restpreset));
      else if(target?.closest('#restHold'))commands.hold();
    },{signal});
  }
  function open(){
    if(disposed)return;mount();const host=sheet(),scrim=document.querySelector(/** @type {'div'} */('#restSheetScrim'));if(!host)return;
    const returnFocus=document.activeElement;ensureHold();render();document.body.classList.add('is-sheet-open');
    shell.openModal(host,{initialFocus:[...document.querySelectorAll(/** @type {'button'} */('#restPresets .restpreset'))].find(button=>Number(button.dataset.restpreset)===plan())||document.querySelector(/** @type {'button'} */('#restMinus')),
      returnFocus,onEscape:close,scrim,delayHide:motion.reducedMotion()?0:280});
    paint();if(openingFrame)window.cancelAnimationFrame(openingFrame);
    openingFrame=window.requestAnimationFrame(()=>{openingFrame=0;if(disposed)return;host.classList.add('is-open');scrim?.classList.add('is-open');});
  }
  function dispose(){disposed=true;abort?.abort();abort=null;void close();}
  return {mount,open,close,paint,dispose};
}
