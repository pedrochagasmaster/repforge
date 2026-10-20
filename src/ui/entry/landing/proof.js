import {LANDING_SCENES,LANDING_SPOTS,LANDING_READ} from './artwork.js';
/** @typedef {{phone:HTMLDivElement,glass:HTMLDivElement,lens:HTMLSpanElement,imgs:Record<string,HTMLImageElement>,rail:HTMLButtonElement[],nodes:HTMLElement[],current:number,tick:()=>void}} Pin
 * @typedef {{io:IntersectionObserver|null,armed:boolean}} Reveal
 */
/** One mounted landing owns every observer, listener, timeout and animation
 * frame. The page's returning/shared marks are readonly lifetime inputs.
 * @param {{window:Window & typeof globalThis,root:HTMLElement,motion:{reducedMotion:()=>boolean}|null,
 * copy:{t:(key:string,vars?:Record<string,unknown>)=>string,language:()=>string,number:(value:unknown)=>string},state:{returning:boolean,shared:boolean}}} options */
export function createLandingProofController({window,root,motion,copy,state:mode}){
  const document=window.document,{t,language:landingLang,number:landingNum}=copy;
  const getComputedStyle=window.getComputedStyle.bind(window),requestAnimationFrame=window.requestAnimationFrame.bind(window),cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
  const setTimeout=window.setTimeout.bind(window),clearTimeout=window.clearTimeout.bind(window),IntersectionObserver=window.IntersectionObserver;
  /** @type {{offs:(()=>void)[],obs:IntersectionObserver[],timers:Set<number>,frames:Set<number>,nodes:(()=>void)[]}} */
  const reg={offs:[],obs:[],timers:new Set(),frames:new Set(),nodes:[]};
  let mounted=false,disposed=false;
  /** @param {number} x @param {number} lo @param {number} hi */
  const clamp=(x,lo,hi)=>x<lo?lo:x>hi?hi:x;
  /** @param {EventTarget} target @param {string} type @param {EventListener} fn @param {AddEventListenerOptions} [opts] */
  const on=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);reg.offs.push(()=>target.removeEventListener(type,fn,opts))};
  /** @param {()=>void} fn @param {number} ms */
  const later=(fn,ms)=>{const id=setTimeout(()=>{reg.timers.delete(id);if(!disposed)fn()},ms);reg.timers.add(id);return id};
  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)")||null;
  const reduced=()=>motion?.reducedMotion()??!!motionQuery?.matches;
  const track=/** @type {HTMLElement|null} */(root.querySelector("#firstRunProofTrack")),stage=/** @type {HTMLElement|null} */(root.querySelector("#firstRunProofStage")),list=/** @type {HTMLElement|null} */(root.querySelector("#firstRunProofSteps"));
  const steps=[.../** @type {NodeListOf<HTMLElement>} */(root.querySelectorAll("[data-landing-step]"))];
  /** @type {Set<()=>void>} */const ticks=new Set();
  /** @type {Pin|null} */let pin=null;
  /** @type {(()=>void)[]} */let pinOffs=[];
  let tickPending=false;
  /** @type {number|null} */let seq=null;
  const requestTick=()=>{
    if(disposed||tickPending)return;tickPending=true;
    const id=requestAnimationFrame(()=>{reg.frames.delete(id);tickPending=false;if(!disposed)ticks.forEach(fn=>fn())});
    reg.frames.add(id)};
  /* ---- pinned stage ---- */
  const shouldPin=()=>{
    if(!track||!stage||!list||!steps.length||reduced()||mode.returning)return false;
    const font=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
    return root.clientHeight>=600&&font<=20};
  function unpin(){
    if(!pin)return;
    if(seq){clearTimeout(seq);reg.timers.delete(seq);seq=null}
    ticks.delete(pin.tick);
    pinOffs.forEach(off=>off());pinOffs=[];
    pin.nodes.forEach(node=>node.remove());
    track?.classList.remove("is-pinned","is-ready");track?.style.removeProperty("--firstrun-steps");
    steps.forEach(step=>{step.classList.remove("is-current");step.removeAttribute("aria-current")});
    pin=null}
  /** @param {string} name */
  function lensTo(name){
    if(!pin)return;
    const read=LANDING_READ[name];if(!read)return;
    const spot=LANDING_SPOTS[read.scene]?.[name];if(!spot)return;
    const img=pin.imgs[read.scene],phone=pin.phone,glass=pin.glass,lens=pin.lens;
    const pw=phone.clientWidth,gw=glass.clientWidth,gh=glass.clientHeight,gx=glass.offsetLeft,gy=glass.offsetTop;
    if(!pw||!gw||!gh)return;
    const tw=spot[2]/100*gw,th=spot[3]/100*gh;
    const m=Math.min(read.m,(pw-16-2*read.pad)/tw);
    let lw=tw*m+2*read.pad,lh=th*m+2*read.pad;
    if(read.shape==="round")lw=lh=Math.max(lw,lh);
    const cx=clamp(gx+spot[0]/100*gw,lw/2+8,pw-lw/2-8),cy=gy+spot[1]/100*gh;
    lens.style.setProperty("--firstrun-lens-w",`${lw}px`);lens.style.setProperty("--firstrun-lens-h",`${lh}px`);
    lens.style.setProperty("--firstrun-lens-radius",read.shape==="round"?"50%":read.shape==="pill"?`${Math.min(lh/2,22)}px`:`${read.r?read.r*gw/390*m:14}px`);
    lens.style.left=`${cx}px`;lens.style.top=`${cy}px`;
    lens.style.backgroundImage=`url("${img.currentSrc||img.src}")`;
    lens.style.backgroundSize=`${gw*m}px ${gh*m}px`;
    lens.style.backgroundPosition=`${lw/2-spot[0]/100*gw*m}px ${lh/2-spot[1]/100*gh*m}px`;
    lens.dataset.read=name;lens.classList.add("is-on")}
  /** @param {number} index */
  function frame(index){
    if(!pin)return;const currentPin=pin;
    const step=steps[index],reads=(step.dataset.read||"").split(" ").filter(Boolean);
    LANDING_SCENES.forEach(scene=>{
      const shown=scene===step.dataset.scene;
      currentPin.imgs[scene].classList.toggle("is-on",shown);
      currentPin.imgs[scene].setAttribute("aria-hidden",shown?"false":"true")});
    if(seq){clearTimeout(seq);reg.timers.delete(seq);seq=null}
    pin.phone.classList.toggle("is-reading",reads.length>0);
    if(!reads.length){pin.lens.classList.remove("is-on");delete pin.lens.dataset.read;return}
    lensTo(reads[0]);
    if(reads.length>1)seq=later(()=>{seq=null;if(pin)lensTo(reads[reads.length-1])},1500)}
  /** @param {number} index @param {boolean} [force] */
  function setStep(index,force=false){
    if(!pin||(index===pin.current&&!force))return;
    pin.current=index;
    steps.forEach((step,j)=>{
      step.classList.toggle("is-current",j===index);
      if(j===index)step.setAttribute("aria-current","step");else step.removeAttribute("aria-current")});
    pin.rail.forEach((button,j)=>{
      button.classList.toggle("is-done",j<index);
      if(j===index)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current")});
    frame(index)}
  function pinStage(){
    if(pin||!track||!stage||!list)return;
    const lang=landingLang();
    const loaded=()=>{if(pin)setStep(pin.current,true)};
    /** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} cls @param {Record<string,string>} [attrs] */
    const element=(tag,cls,attrs={})=>{const node=document.createElement(tag);if(cls)node.className=cls;for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);return node};
    const phone=element("div","firstrun-proof__phone"),glass=element("div","firstrun-proof__glass");
    const screen=element("div","firstrun-proof__screen");
    /** @type {Record<string,HTMLImageElement>} */const imgs={};
    LANDING_SCENES.forEach(scene=>{
      const source=steps.map(step=>/** @type {HTMLImageElement|null} */(step.querySelector("img[data-landing-crop]"))).find(node=>node?.src.includes(`wt-${scene}-`));
      const img=element("img","",{width:"780",height:"1688",decoding:"async",loading:"lazy",
        src:`assets/brand/wt-${scene}-${lang}-dark.webp`,alt:source?.alt||""});
      imgs[scene]=img;screen.append(img);
      img.addEventListener("load",loaded);pinOffs.push(()=>img.removeEventListener("load",loaded))});
    glass.append(screen);
    const lens=element("span","firstrun-proof__lens",{"aria-hidden":"true"});
    phone.append(glass,lens);
    const railNav=element("div","firstrun-proof__rail",{role:"group","aria-label":t("landing.demo.steps_aria")});
    const rail=steps.map((step,j)=>{
      const button=element("button","",{type:"button","data-go":String(j),
        "aria-label":t("landing.demo.step_aria",{n:landingNum(j+1),total:landingNum(steps.length)})});
      const go=()=>{
        const span=track.offsetHeight-stage.offsetHeight;
        const top=track.getBoundingClientRect().top-root.getBoundingClientRect().top+root.scrollTop+span*(j+.5)/steps.length;
        root.scrollTo({top,behavior:reduced()?"auto":"smooth"})};
      button.addEventListener("click",go);pinOffs.push(()=>button.removeEventListener("click",go));
      railNav.append(button);return button});
    stage.insertBefore(phone,list);stage.insertBefore(railNav,list);
    track.classList.add("is-pinned");track.style.setProperty("--firstrun-steps",String(steps.length));
    const tick=()=>{
      if(!pin)return;
      const span=track.offsetHeight-stage.offsetHeight;if(span<=0)return;
      if(!shouldPin()){layout();return}
      const progress=clamp((root.getBoundingClientRect().top-track.getBoundingClientRect().top)/span,0,1);
      setStep(Math.min(steps.length-1,Math.floor(progress*steps.length*.999+.0001)))};
    pin={phone,glass,lens,imgs,rail,nodes:[phone,railNav],current:-1,tick};
    ticks.add(tick);
    setStep(0);
    /* the steps fade only once the first state is painted, so none flashes on entry */
    const id=requestAnimationFrame(()=>{reg.frames.delete(id);if(pin)track.classList.add("is-ready")});
    reg.frames.add(id)}
  /* ---- the stepped reveal (O1) ----
     When the proof is the static cards (motion is welcome but the stage cannot
     pin), each card arrives with `.motion-step` > `.is-in` as it scrolls into
     view. The class that hides a step is `.motion-steps-ready` on the list and
     is added here, after the first observation, so without JavaScript every step
     is simply shown, a card already in view is never hidden and shown again, and
     the pinned stage (which has its own crossfade) and reduced motion never get
     it. Nothing about the stage or its steps changes: this only adds and removes
     classes, and dispose() takes them all off. */
  /** @type {Reveal|null} */let reveal=null;
  function stopReveal(){
    if(!reveal)return;
    reveal.io?.disconnect();const k=reveal.io?reg.obs.indexOf(reveal.io):-1;if(k>=0)reg.obs.splice(k,1);
    list?.classList.remove("motion-steps-ready");
    steps.forEach(step=>step.classList.remove("motion-step","is-in"));reveal=null}
  function syncReveal(){
    const want=!!list&&steps.length>0&&!pin&&!reduced()&&!mode.returning&&typeof IntersectionObserver!=="undefined";
    if(!want){stopReveal();return}
    if(reveal)return;
    /** @type {Reveal} */const state={io:null,armed:false};
    state.io=new IntersectionObserver(entries=>{
      if(reveal!==state)return;
      for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add("is-in");state.io?.unobserve(entry.target)}
      if(!state.armed){state.armed=true;list?.classList.add("motion-steps-ready")}},{root,threshold:.15});
    reveal=state;reg.obs.push(state.io);
    steps.forEach(step=>{step.classList.add("motion-step");state.io?.observe(step)})}
  function layout(){
    if(disposed)return;
    if(shouldPin()){if(pin)setStep(pin.current,true);else pinStage()}else unpin();
    syncReveal();
    requestTick()}
  /* ---- the persistent Build control ---- */
  function mountDock(){
    const dock=/** @type {HTMLElement|null} */(root.querySelector("#firstRunDock")),hero=root.querySelector("#firstRunCreate"),close=root.querySelector("#firstRunCreateClose");
    if(!dock||!hero||!close||mode.shared||typeof IntersectionObserver==="undefined")return;
    let gone=false,closing=false;
    const paint=()=>dock.classList.toggle("is-on",gone&&!closing);
    /** @param {Element} node @param {IntersectionObserverCallback} fn */
    const watch=(node,fn)=>{const io=new IntersectionObserver((entries,observer)=>{if(!disposed)fn(entries,observer)},{root});reg.obs.push(io);io.observe(node)};
    watch(hero,entries=>{const e=entries[entries.length-1];gone=!e.isIntersecting&&e.boundingClientRect.bottom<(e.rootBounds?e.rootBounds.top:0)+1;paint()});
    watch(close,entries=>{const e=entries[entries.length-1];closing=e.isIntersecting||e.boundingClientRect.top<(e.rootBounds?e.rootBounds.top:0);paint()});
    /* the first painted ground beneath the control's resting place decides its ink */
    /** @param {number} x @param {number} y */
    const luminance=(x,y)=>{
      for(const hit of document.elementsFromPoint(x,y)){
        if(dock.contains(hit))continue;
        for(let node=/** @type {Element|null} */(hit);node&&node!==document.documentElement;node=node.parentElement){
          const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(node).backgroundColor);
          if(m&&(m[4]===undefined||+m[4]>.5))return(.2126*Number(m[1])+.7152*Number(m[2])+.0722*Number(m[3]))/255}}
      return 1};
    ticks.add(()=>{
      const box=dock.getBoundingClientRect();
      const y=box.height?window.innerHeight-parseFloat(getComputedStyle(dock).bottom)-box.height/2:window.innerHeight-60;
      dock.dataset.ground=luminance(window.innerWidth/2,y)<.4?"dark":"light"});
    reg.nodes.push(()=>{dock.classList.remove("is-on");delete dock.dataset.ground})}
  /* ---- in-page controls ---- */
  function mountControls(){
    const hand=root.querySelector("#firstRunHandBtn"),body=root.querySelector("#firstRunHand");
    if(hand&&body){
      on(hand,"click",()=>{const open=hand.getAttribute("aria-expanded")!=="true";hand.setAttribute("aria-expanded",String(open));body.toggleAttribute("hidden",!open)});
      reg.nodes.push(()=>{hand.setAttribute("aria-expanded","false");body.setAttribute("hidden","")})}
    const link=root.querySelector("#firstRunFooterPrivacy"),data=root.querySelector("#firstRunData");
    if(link&&data)on(link,"click",event=>{
      event.preventDefault();
      data.scrollIntoView({block:"start",behavior:reduced()?"auto":"smooth"});
      try{/** @type {HTMLElement} */(data).focus({preventScroll:true})}catch{}})}
  /* ---- lifecycle ---- */
  function mount(){
    if(mounted||disposed)return;mounted=true;
    mountControls();mountDock();
    on(root,"scroll",requestTick,{passive:true});
    on(window,"resize",layout);
    if(typeof motionQuery?.addEventListener==="function")on(motionQuery,"change",layout);
    layout()}
  function dispose(){
    if(disposed)return;disposed=true;mounted=false;
    unpin();stopReveal();
    reg.offs.forEach(off=>off());reg.offs.length=0;
    reg.obs.forEach(io=>io.disconnect());reg.obs.length=0;
    reg.timers.forEach(clearTimeout);reg.timers.clear();
    reg.frames.forEach(cancelAnimationFrame);reg.frames.clear();
    reg.nodes.forEach(fn=>fn());reg.nodes.length=0;
    ticks.clear();tickPending=false}
  const live=()=>({listeners:reg.offs.length+pinOffs.length,observers:reg.obs.length,timers:reg.timers.size,frames:reg.frames.size,
    pinned:!!pin,step:pin?pin.current:null,ticks:ticks.size});
  return{mount,dispose,live}}
