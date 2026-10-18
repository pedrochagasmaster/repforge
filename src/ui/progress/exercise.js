import {escapeHtml as esc} from "../format.js";
import {createExerciseChart} from "./exercise-chart.js";
import {createExerciseTrend} from "./exercise-trend.js";
/** Exercise detail owns its route selection and all charts. Queries return
 * readonly display facts; the controller never retains an application snapshot. */
/** @param {import("./exercise-contracts.js").ExerciseOptions} options */
export function createExerciseController({window,copy,format,queries,shell,motion,onRender,onSettings,onSeePrs,onGlossary,onWhy,onChartPresentation}){
const document=window.document,CSS=window.CSS,{t}=copy;
const {number:fmt,load:fmtLoad,displayLoad:toDisplay,unit:unitLabel,date:shortDate}=format;
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>/** @type {HTMLElement[]} */([...document.querySelectorAll(selector)]);
const {routePushBegin,routeViewEl,routeHeading,focusRoute}=shell;
const chart=createExerciseChart({window,copy,format,queries,motion,focus:focusRoute});
const trend=createExerciseTrend({window,copy,format,onPresentation:onChartPresentation});
/** @type {import("./exercise-contracts.js").ExerciseSelection|null} */let exView=null;
function currentViewId(){return $$(".view").find(v=>v.classList.contains("active"))?.id||"log"}
/** @param {string} key @param {string} [from] */
function openExerciseView(key,from){if(!key)return;
  exView={...queries.open(key),openKey:key,from:from||currentViewId()};
  chart.reset();
  const settle=routePushBegin("in",{pushed:$("#exercise"),under:routeViewEl(exView.from)});
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="exercise"));
  document.body.classList.add("is-exercise");document.body.classList.remove("is-settings","is-onboarding","is-workout");
  window.scrollTo({top:0});renderExerciseView();
  focusRoute(routeHeading("exercise")||$("#exercise .exview-head__title"));
  settle?.()}
function closeExerciseView(){const back=exView?.from||"log",openKey=exView?.openKey;exView=null;chart.reset();
  const settle=routePushBegin("out",{pushed:$("#exercise"),under:routeViewEl(back)});
  document.body.classList.remove("is-exercise");
  if(back==="settings"){onSettings();settle?.();return}
  $$("nav button").forEach(x=>{const on=x.dataset.view===back;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===back));
  window.scrollTo({top:0});onRender();
  // Back puts focus on the row that opened the page (found again by its key: the render replaced it).
  const sel=openKey?[`data-exopen`,`data-ovkey`,`data-action-lift`].map(a=>`#${back} [${a}="${CSS.escape(openKey)}"]`).join(","):null;
  // Ending a push in that is still arriving clears the inert page beneath first.
  settle?.();
  focusRoute((sel&&$(sel))||routeHeading(back))}


function renderExerciseView(){const el=$("#exDetail");if(!el||!exView)return;
  const key=exView.key,model=queries.detail(key,exView.exercise);
  const {name,recommendation:rec,art,topLoad,bestE,prCount,sessions,loadPr,e1Pr,summaries:sums}=model;
  const backKey=exView.from==="stats"?"nav.stats":exView.from==="program"?"nav.program":exView.from==="history"?"nav.history":"nav.log";
  const back=$("#exBack");if(back)back.textContent=`‹ ${t(backKey)}`;
  // Reached from Progress, the page is the lift's chart: the step series, the
  // scope and metric toggles, a plot that snaps to a session, and its table.
  $("#exercise")?.classList.toggle("exview--chart",exView.from==="stats");
  if(exView.from==="stats"){
    if(back)back.innerHTML=`<span class="chevron" aria-hidden="true"></span>${esc(t(backKey))}`;
    return chart.render(el,{key,name,identity:exView})}

  /* Unlike a list thumbnail this drawing is the only place the lifter can see
     how the movement is set up, so it gets a describing alt and no lazy hint —
     it is above the fold. Movements without licensed artwork render nothing at
     all; a placeholder tile would only promise something that never arrives. */
  const artSrc=art?.src,artBg=art?.bg;
  const artHtml=artSrc?`<div class="exdet-art"`+
    (artBg?` style="--exercise-art-bg:${esc(artBg)}"`:"")+`><div class="exdet-art__figure">`+
    `<img class="exdet-art__img" src="${esc(artSrc)}" alt="${esc(t("preview.art_alt",{name}))}" `+
    `decoding="async" width="768" height="768"></div></div>`:"";

  const recHtml=rec?`<div class="recblock is-${rec.status}"><div class="recblock__row"><div><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
    `<div class="recblock__head">${esc(rec.cue)}</div>`+
    `<p class="recblock__body">${esc(rec.text)}</p></div>`+
    `<button type="button" class="link-accent" data-term="RIR">${esc(t("exercise.understand"))}</button>`+
    (rec.status!=="new"?`<button type="button" class="text-link recblock__why" data-why="${esc(model.slotId)}" aria-label="${esc(t("why.open_aria",{name}))}">${esc(t("why.open"))}</button>`:"")+
    `</div></div>`:"";

  const lcFirst=/** @param {string} s */ s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
  const tiles=[
    {label:lcFirst(t("stats.metric.sessions")),val:sessions.length},
    {label:t("exercise.top_load"),val:topLoad?`${fmtLoad(topLoad)} ${unitLabel()}`:"—"},
    {label:lcFirst(t("stats.metric.best_e1rm")),val:bestE?`${fmt(Math.round(toDisplay(bestE)))} ${unitLabel()}`:"—"},
    {label:t("stats.metric.prs"),val:prCount},
  ];
  const historyHtml=sessions.length?model.recent.map(s=>{
    const best=s.best,cmp=s.comparison;
    const note=s.note?`<p class="exsess__note">${esc(s.note)}</p>`:"";
    return `<div class="exsess"><div class="exsess__head"><span class="exsess__date">${esc(shortDate(s.date||""))}</span>`+
      (best?`<span class="exsess__set">${fmtLoad(Number(best.load))} × ${best.reps}</span><span class="exsess__day">RIR ${fmt(Number(best.rir))}</span>`:"")+
      (cmp&&cmp.status!=="not_comparable"?`<span class="exsess__delta">${esc(cmp.label)}</span>`:"")+`</div>${note}</div>`}).join("")
    :`<div class="empty">${esc(t("exercise.empty.no_sets"))}</div>`;

  el.innerHTML=`<p class="exdet__muscle">${esc(model.muscle)}</p><h2 class="exdet__name">${esc(name)}</h2>`+
    `<p class="exdet__meta">${model.prescription?`${esc(model.prescription.day)} · ${esc(model.prescription.text)}${model.prescription.hasRepTarget?` · RIR 0–${fmt(model.prescription.rirHigh)}`:""}`:esc(t("exercise.not_in_program"))}</p>`+
    artHtml+
    recHtml+
    `<div class="statrow statrow--4 exdet__stats">${tiles.map(tile=>`<div class="statrow__cell"><div class="statrow__val">${tile.val}</div><div class="statrow__cap">${tile.label}</div></div>`).join("")}</div>`+
    `<p class="section-label section-label--row"><span>${esc(t("exercise.progression"))}</span><span class="range-static">${esc(t("exercise.range_12w"))}</span></p>`+
    `<p class="lede">${esc(t("stats.e1rm_caption"))}</p>`+
    `<div class="chart-wrap"><canvas id="exChart" height="240" aria-label="${esc(t("exercise.chart_aria",{name}))}"></canvas></div>`+
    `<p class="section-label">${esc(t("exercise.records"))}</p>`+
    (loadPr?`<div class="listrow listrow--static"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.load"))}</div><div class="listrow__sub">${fmtLoad(loadPr.load)} ${unitLabel()} × ${loadPr.reps}</div></div><span class="listrow__meta">${esc(shortDate(loadPr.date))}</span></div>`:"")+
    (e1Pr?`<div class="listrow listrow--static"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.e1rm"))}</div><div class="listrow__sub">${fmt(Math.round(toDisplay(e1Pr.e1rm)))} ${unitLabel()}</div></div><span class="listrow__meta">${esc(shortDate(e1Pr.date))}</span></div>`:"")+
    `<button type="button" class="link-row-cta" id="exSeePrs"><span>${esc(t("exercise.see_all_prs"))}</span><span class="chevron" aria-hidden="true"></span></button>`+
    `<p class="section-label">${esc(t("exercise.recent_sessions"))}</p><div class="exsessions">${historyHtml}</div>`;
  trend.draw(sums,"#exChart");
  $$("#exDetail [data-term]").forEach(b=>b.onclick=e=>{e.stopPropagation();onGlossary(/** @type {string} */(b.dataset.term),b)});
  $$("#exDetail [data-why]").forEach(b=>b.onclick=e=>{e.stopPropagation();onWhy(/** @type {string} */(model.slotId),b)});
  const see=$("#exSeePrs");if(see)see.onclick=()=>{closeExerciseView();onSeePrs()}}

function reset(){exView=null;chart.reset();document.body.classList.remove("is-exercise")}
function redraw(){if($("#exercise")?.classList.contains("active")&&exView){if(exView.from==="stats")renderExerciseView();else trend.draw(queries.detail(exView.key,exView.exercise).summaries,"#exChart")}}
return Object.freeze({open:openExerciseView,close:closeExerciseView,render:renderExerciseView,redraw,reset,dispose:reset,
  active:()=>!!exView,palette:trend.palette,labelDecimals:trend.labelDecimals});
}
