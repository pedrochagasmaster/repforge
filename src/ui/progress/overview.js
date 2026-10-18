import {escapeHtml as esc} from "../format.js";

/** Readonly overview presentation. Engine comparisons and recommendations enter
 * as facts; only explicit row/intro presses dispatch navigation actions.
 */
/** @param {import("./contracts.js").OverviewOptions} options */
export function createProgressOverview({document,copy,format,onOpenExercise,onGoToday}){
const {t}=copy;
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {readonly number[]} values */
function sparklineSvg(values,w=60,h=22){
  const nums=values.map(Number).filter(Number.isFinite);
  if(!nums.length)return"";
  const min=Math.min(...nums),span=Math.max(...nums)-min||1;
  const pts=nums.length===1?[[w/2,h/2]]:nums.map((v,i)=>[2+i*(w-4)/(nums.length-1),h-3-(v-min)/span*(h-6)]);
  const line=pts.length>1?`<path class="spark__line" d="${pts.map((q,i)=>`${i?"L":"M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ")}"/>`:"";
  const last=/** @type {number[]} */(pts.at(-1));
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${line}<circle class="spark__dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="${pts.length>1?2.4:3}"/></svg>`}
/** @type {Readonly<Record<string,string>>} */
const STRENGTH_KIND_KEYS={snapshot:"stats.evidence.snapshot",comparison:"stats.evidence.comparison",trend:"stats.evidence.trend"};
/** "Tendência, 4 sessões": the evidence kind and how many sessions back it. */
/** @param {import("./contracts.js").StrengthSeries} series */
function strengthKindText(series){
  if(series.presentation==="empty"||!STRENGTH_KIND_KEYS[series.presentation])return t("stats.evidence.empty");
  const n=series.evidenceCount;
  return t(n===1?"stats.overview.evidence.one":"stats.overview.evidence.other",{kind:t(STRENGTH_KIND_KEYS[series.presentation]),n})}
/** `a→b kg`: the scope's first and latest top load, both the model's points. */
/** @param {import("./contracts.js").StrengthSeries} series */
function strengthFigure(series){
  const pts=series.points;if(!pts.length)return"—";
  const last=format.load(/** @type {{value:number}} */(pts.at(-1)).value);
  const cue=series.perSideLoad?` · ${t("focus.metric.load_per_side_kg")}`:"";
  return`${pts.length>1?`${format.load(pts[0].value)}→${last} `:`${last} `}${format.unit()}${cue}`}
/** @param {Pick<import("./contracts.js").StrengthRow,"series"|"latest"|"comparison"|"slotId">} row */
function strengthOutcomeWord({series,latest,comparison:cmp,slotId}){
  if(!latest)return{html:esc(t("stats.evidence.baseline")),soft:true,status:""};
  const parity=slotId?` data-parity-outcome="${esc(slotId)}" data-parity-session="${esc(latest.session)}"`+
    ` data-parity-reader="progress-strength" data-parity-scope="${esc(series.scope)}"`+
    ` data-parity-convention="${esc(series.comparisonConvention||"load")}"`:"";
  /** @param {string} label */
  const word=label=>`<span class="evword"${parity}>${esc(label)}</span>`;
  if(series.outcome&&cmp)return{html:word(cmp.label),soft:false,status:series.outcome};
  const reason=series.reason;
  if(reason==="single-observation")return{html:esc(t("stats.outcome_short.single_observation")),soft:true,status:""};
  if(reason==="missing-effort")return{html:esc(t("stats.outcome_short.missing_effort")),soft:true,status:""};
  if((reason==="changed-load"||reason==="incompatible-exposure")&&cmp)return{html:word(cmp.label),soft:true,status:""};
  return{html:esc(t("stats.evidence.baseline")),soft:true,status:""}}
/** @param {boolean} hasLog */
function renderIntro(hasLog){
  const intro=$("#statsIntro");if(!intro)return;
  intro.classList.toggle("hidden",hasLog);
  intro.innerHTML=hasLog?"":`<p class="emptystate__title">${esc(t("stats.empty.title"))}</p>`+
    `<p class="emptystate__body">${esc(t("stats.empty.body"))}</p>`+
    `<button type="button" class="btn btn--cta" id="statsIntroGo">${esc(t("stats.empty.cta"))}</button>`;
  const go=$("#statsIntroGo");if(go)go.onclick=()=>onGoToday();
  for(const selector of["#thisWeek","#attention","#overviewStrength"])$(selector)?.classList.toggle("hidden",!hasLog);
}
/** @param {Readonly<import("./contracts.js").WeekModel>} model */
function renderWeek(model){
  const element=$("#thisWeek");if(!element)return;
  const weekLine=model.status==="in-progress"&&model.week?t("stats.overview.week",{n:model.week,total:model.totalWeeks}):t("stats.this_week.in_progress");
  /** @param {string} metric @param {number} done @param {number} planned @param {string} caption */
  const cell=(metric,done,planned,caption)=>`<div class="ovtotal" data-week-metric="${metric}"><b class="ovtotal__val"><span class="ovtotal__n">${done}</span>`+
    `${planned>0?`<i class="ovtotal__of">/${planned}</i>`:""}</b><span class="ovtotal__cap">${esc(caption)}</span></div>`;
  element.innerHTML=`<div class="ovtotals${model.baselineCount>0?" ovtotals--3":""}">`+
    cell("sessions",model.completedSessions,model.plannedSessions,t("stats.this_week.sessions"))+
    cell("sets",model.completedWorkingSets,model.plannedWorkingSets,t("stats.this_week.working_sets"))+
    (model.baselineCount>0?cell("baseline",model.baselineCount,0,t("stats.this_week.baseline")):"")+`</div>`+
    `<p class="ovweekline">${esc(weekLine)}</p>`;
}
/** @param {readonly Omit<import("./contracts.js").StrengthRow,"sessions">[]} rows */
function renderStrength(rows){
  const element=$("#overviewStrength");if(!element)return;
  if(!rows.length){element.innerHTML="";return}
  element.innerHTML=`<div class="ovsec"><h3 class="ovsec__title">${esc(t("stats.overview.strength"))}</h3><span class="ovsec__meta">${esc(t("stats.metric.top_load"))}</span></div>`+
    rows.map(row=>{
      const word=strengthOutcomeWord(row);
      const body=`<span class="strrow__main"><b class="strrow__name">${esc(row.name)}</b>`+
        `<span class="strrow__sub${word.soft?" is-soft":""}">${word.html}${row.dateLabel?esc(` · ${row.dateLabel}`):""}</span></span>`+
        `${sparklineSvg(row.series.points.map(point=>point.value))}<span class="strrow__fig">${esc(strengthFigure(row.series))}</span>`;
      return row.series.evidenceCount>1?`<button type="button" class="strrow" data-ovkey="${esc(row.key)}">${body}</button>`:
        `<div class="strrow strrow--snap" data-ovkey="${esc(row.key)}">${body}</div>`;
    }).join("");
  /** @type {NodeListOf<HTMLElement>} */(element.querySelectorAll("button[data-ovkey]")).forEach(button=>button.onclick=()=>onOpenExercise(/** @type {string} */(button.dataset.ovkey)));
}
/** @param {readonly import("./contracts.js").AttentionRow[]} rows */
function renderAttention(rows){
  const element=$("#attention");if(!element)return;
  element.innerHTML=`<div class="ovsec"><h3 class="ovsec__title">${esc(t("stats.overview.attention",{n:rows.length}))}</h3></div>`+
    (rows.length?rows.map(row=>{
      const figure=row.target!=null
        ?(row.last!=null&&Math.abs(row.last-row.target)>1e-6?`${format.load(row.last)}→${format.load(row.target)} ${format.unit()}`:`${format.load(row.target)} ${format.unit()}`)
        :row.last!=null?`${format.load(row.last)} ${format.unit()}`:"";
      const parity=row.target!=null&&row.exerciseId?` data-parity-target="${esc(row.exerciseId)}"`:"";
      const verdict=row.label?`<span class="attnrow__label">${esc(row.label)}</span><span class="attnrow__reason">${esc(row.reason)}</span>`:
        `<span class="attnrow__reason">${esc(row.lead)}</span>`;
      return `<button type="button" class="attn__chip attnrow" data-action-lift="${esc(row.destinationId)}" data-attn="${esc(row.id)}" data-attngo="${esc(row.group)}">`+
        `<span class="attnrow__mark"><span class="verdictmark verdictmark--${row.move}"><span class="verdictmark__glyph" aria-hidden="true"></span></span></span>`+
        `<b class="attnrow__name">${esc(row.name)}</b>`+
        `<span class="attnrow__fig"><span${parity}>${esc(figure)}</span><span class="chevron" aria-hidden="true"></span></span>`+
        `<span class="attnrow__verdict">${verdict}</span>`+
        `<small class="attnrow__evidence">${esc(row.series?strengthKindText(row.series):"")}</small></button>`;
    }).join(""):`<p class="ovnone">${esc(t("stats.needs_action.none"))}</p>`);
  /** @type {NodeListOf<HTMLElement>} */(element.querySelectorAll("[data-action-lift]")).forEach(button=>button.onclick=()=>onOpenExercise(/** @type {string} */(button.dataset.actionLift)));
}
return Object.freeze({renderIntro,renderWeek,renderStrength,renderAttention,sparkline:sparklineSvg,kindText:strengthKindText,figure:strengthFigure,outcomeWord:strengthOutcomeWord});
}
