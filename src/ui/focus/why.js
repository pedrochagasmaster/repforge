/** @typedef {{group?:string,text?:boolean,k?:string,v?:unknown,rir?:unknown,sub?:unknown,sum?:boolean}} CalculationRow */
/** @typedef {{target:string,glyph?:string,markHtml:string,decision:string,blocks:readonly {leadKey:string,label?:string,lead?:string,text:string}[],calc:readonly CalculationRow[],evidence:string,labels:{calc:string,calcHide:string}}} WhyModel */
/** @typedef {{reducedMotion?:()=>boolean,animateDisclosure:(panel:HTMLElement,on:boolean,apply:()=>void)=>unknown}} DisclosureMotion */
/** @typedef {{initialFocus:HTMLElement|null,returnFocus:HTMLElement|null,onEscape:()=>Promise<unknown>,scrim:HTMLElement|null,delayHide:number}} WhyModalOptions */
/** @typedef {{openModal:(sheet:HTMLElement,options:WhyModalOptions)=>unknown,closeModal:(sheet:HTMLElement)=>Promise<unknown>,activeModal:{el:Element}|null}} WhyShell */
import { escapeHtml as esc } from "../format.js";
/** @param {readonly CalculationRow[]} calc */
function calcHtml(calc) {
  return calc.map(c=>c.group?`<p class="whycalc__group">${esc(c.group)}</p>`
    :c.text?`<p class="whycalc__text">${c.k?`<span class="whycalc__k">${esc(c.k)}</span> `:""}${esc(c.v)}</p>`
    :`<div class="whycalc__row${c.sum?" whycalc__row--sum":""}"><span class="whycalc__k">${esc(c.k)}</span>`+
      `<span class="whycalc__v">${esc(c.v)}${c.rir?`<em>${esc(c.rir)}</em>`:""}</span>`+
      `${c.sub?`<small class="whycalc__sub">${esc(c.sub)}</small>`:""}</div>`).join("");
}
/** Why presentation owns no recommendation math, workout state or durable IO. */
/** @param {{document:Document,shell:WhyShell,motion?:DisclosureMotion|null,commands:{recommendationExplained:(payload:{surface:"focus"|"exercise"})=>unknown}}} options */
export function createWhySheet({document,shell,motion=null,commands}) {
  let disposed=false,openingFrame=0;
  /** @type {AbortController|null} */let mounted=null;
  /** @type {AbortController|null} */let rendered=null;
  /** @param {string} selector */
  const $=selector=>/** @type {HTMLElement|null} */ (document.querySelector(selector));
  const host=document.defaultView;if(!host)throw new TypeError("Why sheet requires a browser document");
  const view=host;
  const reduced=()=>motion?.reducedMotion?.()??view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** @param {HTMLElement} button @param {HTMLElement} panel @param {boolean} on */
  function disclose(button,panel,on) {
    button.setAttribute("aria-expanded",on?"true":"false");
    if(panel.id)button.setAttribute("aria-controls",panel.id);
    panel.setAttribute("aria-hidden",on?"false":"true");
    const chev=button.querySelector(".chevron");if(chev)chev.classList.toggle("is-up",on);
    const show=()=>panel.classList.toggle("is-open",on);
    if(motion)motion.animateDisclosure(panel,on,show);else show();
  }
  /** @param {WhyModel} model */
  function render(model) {
    if(disposed)return;rendered?.abort();rendered=new view.AbortController();
    const signal=rendered.signal,labels=model.labels;
    const target=$("#whyTarget");if(target){target.innerHTML=model.target?`${model.markHtml}<span>${esc(model.target)}</span>`:"";target.classList.toggle("hidden",!model.target);}
    const decision=$("#whyDecision");if(decision)decision.textContent=model.decision;
    const body=$("#whyBody");
    if(body) {
      body.innerHTML=model.blocks.map(b=>`<div class="whysheet__block" data-lead="${esc(b.leadKey)}">${b.label?`<p class="whysheet__lab">${esc(b.label)}</p>`:""}`+
        `${b.lead?`<b class="whysheet__lead">${esc(b.lead)}</b>`:""}<p class="whysheet__text">${esc(b.text)}</p></div>`).join("")+
        (model.calc.length?`<button type="button" class="whysheet__disc" data-why-calc aria-expanded="false" aria-controls="whyCalc"><span>${esc(labels.calc)}</span><span class="chevron is-down" aria-hidden="true"></span></button>`+
          `<div class="whycalc" id="whyCalc" aria-hidden="true">${calcHtml(model.calc)}</div>`:"");
      const disc=/** @type {HTMLElement|null} */ (body.querySelector("[data-why-calc]")),panel=/** @type {HTMLElement|null} */ (body.querySelector("#whyCalc"));
      if(disc&&panel)disc.addEventListener('click',()=>{
        const open=disc.getAttribute("aria-expanded")!=="true";disclose(disc,panel,open);
        const label=disc.querySelector("span");if(label)label.textContent=open?labels.calcHide:labels.calc;
        const chev=disc.querySelector(".chevron");if(chev)chev.classList.toggle("is-down",!open);
      },{signal});
    }
    const evidence=$("#whyEvidence");if(evidence){evidence.textContent=model.evidence;evidence.classList.toggle("hidden",!model.evidence);}
  }
  /** @param {{model:WhyModel,opener:HTMLElement|null,surface?:"focus"|"exercise"}} input */
  function open({model,opener,surface="focus"}) {
    if(disposed)return;mount();const sheet=$("#whySheet"),scrim=$("#whyScrim");if(!sheet)return;
    commands.recommendationExplained({surface});render(model);
    document.body.classList.add("is-sheet-open");
    shell.openModal(sheet,{initialFocus:$("#whyClose"),returnFocus:opener,onEscape:close,scrim,delayHide:reduced()?0:280});
    if(openingFrame)view.cancelAnimationFrame(openingFrame);
    openingFrame=view.requestAnimationFrame(()=>{openingFrame=0;if(disposed)return;sheet.classList.add("is-open");scrim?.classList.add("is-open");});
  }
  function close() {
    if(openingFrame)view.cancelAnimationFrame(openingFrame);openingFrame=0;
    const sheet=$("#whySheet");if(!sheet)return Promise.resolve(false);
    if(sheet.hidden&&shell.activeModal?.el!==sheet)return Promise.resolve(false);
    return shell.closeModal(sheet);
  }
  function mount(){
    if(mounted||disposed)return;mounted=new view.AbortController();
    for(const selector of ['#whyClose','#whyScrim','#whyOk'])$(selector)?.addEventListener('click',close,{signal:mounted.signal});
  }
  function dispose(){disposed=true;mounted?.abort();rendered?.abort();mounted=null;rendered=null;void close();}
  return Object.freeze({open,close,render,dispose});
}
