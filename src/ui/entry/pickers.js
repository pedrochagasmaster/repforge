/** Numeric picker presentation; values reach application policy only through onChange.
 * This instance owns listeners and delayed scroll settlement across entry renders. */
export const ENTRY_WHEEL_ROW=44;
/** @typedef {(index:number,options?:{scroll?:boolean})=>void} SetIndex */
/** @param {{window:Window & typeof globalThis,format:{decimal:(value:number,digits:number)=>string,weight:(value:number,unit:string)=>string}}} options */
export function createEntryPickers({window,format}) {
  /** @type {Map<HTMLElement,()=>void>} */
  const mounts=new Map();
  /** @param {HTMLElement} element */
  function lifetime(element) {
    mounts.get(element)?.();
    const controller=new window.AbortController();
    let timer=0;
    /** @param {()=>void} callback @param {number} delay */
    const later=(callback,delay)=>{
      window.clearTimeout(timer);
      timer=window.setTimeout(()=>{if(element.isConnected)callback();},delay);
    };
    const dispose=()=>{controller.abort();window.clearTimeout(timer);mounts.delete(element);};
    mounts.set(element,dispose);
    return {signal:controller.signal,later,dispose};
  }
  /** @param {HTMLElement|null} element @param {(value:number)=>void} onChange
   * @param {(value:{index:number,set:SetIndex})=>void} [onType] */
  function wheel(element,onChange,onType) {
    if(!element)return;
    const items=/** @type {NodeListOf<HTMLElement>} */(element.querySelectorAll('.entry-wheel__item'));
    const count=items.length;
    if(!count)return;
    const life=lifetime(element),options={signal:life.signal};
    /** @type {SetIndex} */
    const set=(index,{scroll=true}={})=>{
      const next=Math.max(0,Math.min(count-1,index));
      if(scroll)element.scrollTop=next*ENTRY_WHEEL_ROW;
      items.forEach((item,i)=>item.classList.toggle('is-current',i===next));
      if(Number(element.dataset.index)===next)return;
      element.dataset.index=String(next);
      element.setAttribute('aria-valuenow',String(next));
      element.setAttribute('aria-valuetext',items[next].textContent||'');
      onChange(next);
    };
    element.scrollTop=Number(element.dataset.index)*ENTRY_WHEEL_ROW;
    items.forEach((item,i)=>item.classList.toggle('is-current',i===Number(element.dataset.index)));
    element.addEventListener('scroll',()=>life.later(()=>set(Math.round(element.scrollTop/ENTRY_WHEEL_ROW),{scroll:false}),90),{...options,passive:true});
    element.addEventListener('keydown',event=>{
      const current=Number(element.dataset.index);
      /** @type {Record<string,number>} */
      const targets={ArrowUp:current-1,ArrowDown:current+1,PageUp:current-5,PageDown:current+5,Home:0,End:count-1};
      const target=targets[event.key];
      if(target===undefined)return;
      event.preventDefault();set(target);
    },options);
    element.addEventListener('click',event=>{
      if(!(event.target instanceof window.Element&&event.target.closest('.entry-wheel__item')))
        onType?.({index:Number(element.dataset.index),set});
    },options);
    items.forEach((item,i)=>item.addEventListener('click',()=>{
      if(i===Number(element.dataset.index)&&onType)onType({index:i,set});else set(i);
    },options));
    return life.dispose;
  }
  /** @param {HTMLElement|null} element @param {(value:number)=>void} onChange
   * @param {(value:{index:number,value:number,set:SetIndex})=>void} [onType] */
  function ruler(element,onChange,onType) {
    if(!element)return;
    const min=Number(element.dataset.min),step=Number(element.dataset.step),steps=Number(element.dataset.steps),unit=element.dataset.unit||'';
    const track=/** @type {HTMLElement|null} */(element.querySelector('.entry-ruler__track'));
    const readout=element.parentElement?.querySelector('.entry-ruler__value b');
    if(track)track.style.margin=`0 ${element.clientWidth/2}px`;
    /** @param {number} index */
    const valueAt=index=>Math.round((min+index*step)*10)/10;
    let index=Math.round((Number(element.getAttribute('aria-valuenow'))-min)/step);
    element.scrollLeft=index*8;
    /** @param {number} next */
    const show=next=>{
      const value=valueAt(next);
      if(readout)readout.textContent=format.decimal(value,1);
      element.setAttribute('aria-valuenow',value.toFixed(1));
      element.setAttribute('aria-valuetext',format.weight(value,unit));
    };
    /** @type {SetIndex} */
    const set=(next,{scroll=true}={})=>{
      next=Math.max(0,Math.min(steps,next));
      if(scroll)element.scrollLeft=next*8;
      show(next);
      if(next===index)return;
      index=next;onChange(valueAt(next));
    };
    const life=lifetime(element),options={signal:life.signal};
    element.addEventListener('scroll',()=>{
      show(Math.max(0,Math.min(steps,Math.round(element.scrollLeft/8))));
      life.later(()=>set(Math.round(element.scrollLeft/8),{scroll:false}),110);
    },{...options,passive:true});
    element.addEventListener('keydown',event=>{
      /** @type {Record<string,number>} */
      const targets={ArrowLeft:index-1,ArrowDown:index-1,ArrowRight:index+1,ArrowUp:index+1,PageDown:index-10,PageUp:index+10,Home:0,End:steps};
      const target=targets[event.key];
      if(target===undefined)return;
      event.preventDefault();set(target);
    },options);
    element.parentElement?.querySelector('#entryWeightType')?.addEventListener('click',()=>onType?.({index,value:valueAt(index),set}),options);
    return life.dispose;
  }
  function dispose(){for(const stop of [...mounts.values()])stop();}
  return Object.freeze({wheel,ruler,dispose});
}
