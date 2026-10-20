const BEAT_CLASSES=['motion-rise','motion-value-up','motion-value-down','motion-value-fade'];
/** Focus decoration owns its outgoing layers, timers and animation listeners.
 * Native Motion remains the authority for capability and animation execution.
 * @param {{window:Window,motion:ReturnType<typeof import('../../platform/motion.js').createMotion>}} options */
export function createFocusEffects({window,motion}){
  const document=window.document;
  /** @type {Set<()=>void>} */ const cleanups=new Set();
  const enabled=()=>motion.available()&&!motion.reducedMotion()?motion:null;
  const beatsOn=()=>!motion.reducedMotion();
  /** @param {HTMLElement} element @param {string} className */
  function settle(element,className){
    const end=()=>{element.classList.remove(className);element.removeEventListener('animationend',end);element.removeEventListener('animationcancel',end);cleanups.delete(end)};
    element.addEventListener('animationend',end,{once:true});element.addEventListener('animationcancel',end,{once:true});cleanups.add(end);
  }
  /** @param {HTMLElement|null} element @param {string} className */
  function playBeat(element,className){
    if(!element||!beatsOn())return;
    element.classList.remove(...BEAT_CLASSES);void element.offsetWidth;element.classList.add(className);settle(element,className);
  }
  /** @param {HTMLElement} root */
  function settleBeats(root){root.querySelectorAll(/** @type {'div'} */('.motion-rise')).forEach(element=>settle(element,'motion-rise'));}
  /** @param {HTMLElement|null} host @param {{left:number,top:number,width:number,height:number}|null} from @param {string} kind */
  function travelOutline(host,from,kind){
    const layer=enabled();if(!layer||!host||!from)return false;
    const ring=document.createElement('span');ring.className=`${kind}__ring`;ring.setAttribute('aria-hidden','true');
    host.classList.add('is-ring-travel');host.append(ring);
    const done=()=>{ring.remove();host.classList.remove('is-ring-travel');cleanups.delete(done)};cleanups.add(done);
    layer.animateIndicator(ring,from).then(done,done);return true;
  }
  /** @param {HTMLElement} host */
  function liveHtml(host){
    if(!host.querySelector('.motion-fade-out'))return host.innerHTML;
    const copy=/** @type {HTMLElement} */(host.cloneNode(true));
    copy.querySelectorAll('.motion-fade-out').forEach(element=>element.remove());
    copy.querySelectorAll('.motion-fade-in').forEach(element=>element.classList.remove('motion-fade-in'));return copy.innerHTML;
  }
  /** @param {HTMLElement} host @param {string} outgoingHtml @param {string} outgoingClass */
  function crossfadeIn(host,outgoingHtml,outgoingClass){
    if(!outgoingHtml||!enabled())return;
    host.querySelectorAll(':scope > .motion-fade-out').forEach(element=>element.remove());
    const outgoing=document.createElement('div');outgoing.className=`${outgoingClass} motion-fade-out`;
    outgoing.setAttribute('aria-hidden','true');outgoing.inert=true;outgoing.innerHTML=outgoingHtml;
    outgoing.querySelectorAll('*').forEach(element=>{for(const name of element.getAttributeNames())if(name.startsWith('data-'))element.removeAttribute(name)});
    const children=Array.from(host.children);children.forEach(child=>child.classList.add('motion-fade-in'));host.prepend(outgoing);
    let over=false;
    const end=()=>{if(over)return;over=true;window.clearTimeout(timer);outgoing.remove();children.forEach(child=>child.classList.remove('motion-fade-in'));
      outgoing.removeEventListener('animationend',end);outgoing.removeEventListener('animationcancel',end);cleanups.delete(end)};
    outgoing.addEventListener('animationend',end,{once:true});outgoing.addEventListener('animationcancel',end,{once:true});
    const timer=window.setTimeout(end,320);cleanups.add(end);
  }
  function dispose(){for(const clear of [...cleanups])clear();cleanups.clear();}
  return {enabled,beatsOn,playBeat,settleBeats,travelOutline,liveHtml,crossfadeIn,dispose};
}
