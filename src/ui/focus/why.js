import { escapeHtml as esc } from "../format.js";
function calcHtml(calc) {
  return calc.map(c=>c.group?`<p class="whycalc__group">${esc(c.group)}</p>`
    :c.text?`<p class="whycalc__text">${c.k?`<span class="whycalc__k">${esc(c.k)}</span> `:""}${esc(c.v)}</p>`
    :`<div class="whycalc__row${c.sum?" whycalc__row--sum":""}"><span class="whycalc__k">${esc(c.k)}</span>`+
      `<span class="whycalc__v">${esc(c.v)}${c.rir?`<em>${esc(c.rir)}</em>`:""}</span>`+
      `${c.sub?`<small class="whycalc__sub">${esc(c.sub)}</small>`:""}</div>`).join("");
}
/** Why presentation owns no recommendation math, workout state or durable IO. */
export function createWhySheet({document,shell,motion=null,commands}) {
  const $=selector=>document.querySelector(selector);
  let labels=null;
  const reduced=()=>motion?.reducedMotion?.()??document.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function disclose(button,panel,on) {
    button.setAttribute("aria-expanded",on?"true":"false");
    if(panel.id)button.setAttribute("aria-controls",panel.id);
    panel.setAttribute("aria-hidden",on?"false":"true");
    const chev=button.querySelector(".chevron");if(chev)chev.classList.toggle("is-up",on);
    const show=()=>panel.classList.toggle("is-open",on);
    if(motion)motion.animateDisclosure(panel,on,show);else show();
  }
  function render(model) {
    labels=model.labels;
    const target=$("#whyTarget");if(target){target.innerHTML=model.target?`${model.markHtml}<span>${esc(model.target)}</span>`:"";target.classList.toggle("hidden",!model.target);}
    const decision=$("#whyDecision");if(decision)decision.textContent=model.decision;
    const body=$("#whyBody");
    if(body) {
      body.innerHTML=model.blocks.map(b=>`<div class="whysheet__block" data-lead="${esc(b.leadKey)}">${b.label?`<p class="whysheet__lab">${esc(b.label)}</p>`:""}`+
        `${b.lead?`<b class="whysheet__lead">${esc(b.lead)}</b>`:""}<p class="whysheet__text">${esc(b.text)}</p></div>`).join("")+
        (model.calc.length?`<button type="button" class="whysheet__disc" data-why-calc aria-expanded="false" aria-controls="whyCalc"><span>${esc(labels.calc)}</span><span class="chevron is-down" aria-hidden="true"></span></button>`+
          `<div class="whycalc" id="whyCalc" aria-hidden="true">${calcHtml(model.calc)}</div>`:"");
      const disc=body.querySelector("[data-why-calc]"),panel=body.querySelector("#whyCalc");
      if(disc&&panel)disc.onclick=()=>{
        const open=disc.getAttribute("aria-expanded")!=="true";disclose(disc,panel,open);
        disc.querySelector("span").textContent=open?labels.calcHide:labels.calc;
        const chev=disc.querySelector(".chevron");if(chev)chev.classList.toggle("is-down",!open);
      };
    }
    const evidence=$("#whyEvidence");if(evidence){evidence.textContent=model.evidence;evidence.classList.toggle("hidden",!model.evidence);}
  }
  function open({model,opener,surface="focus"}) {
    const sheet=$("#whySheet"),scrim=$("#whyScrim");if(!sheet)return;
    commands.recommendationExplained({surface});render(model);
    const ok=$("#whyOk");if(ok)ok.onclick=close;
    document.body.classList.add("is-sheet-open");
    shell.openModal(sheet,{initialFocus:$("#whyClose"),returnFocus:opener,onEscape:close,scrim,delayHide:reduced()?0:280});
    document.defaultView.requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open");});
  }
  function close() {
    const sheet=$("#whySheet");if(!sheet)return Promise.resolve(false);
    if(sheet.hidden&&shell.activeModal?.el!==sheet)return Promise.resolve(false);
    return shell.closeModal(sheet);
  }
  return Object.freeze({open,close,render});
}
