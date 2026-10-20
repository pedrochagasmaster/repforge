import {escapeHtml as esc,formatTable} from "../format.js";

/** Evidence views consume canonical series/period/event models. Disclosure state
 * belongs here; selected scopes belong to the Progress controller. No training
 * decisions, storage or program identity allocation are reachable from render.
 */
/** @param {import("./contracts.js").EvidenceOptions} options */
export function createEvidenceViews({document,copy,format,presentation,onStrengthScope,onVolumeScope,onPrFilter}){
  const {t}=copy,CSS=/** @type {Window & typeof globalThis} */(document.defaultView).CSS;
  /** @param {string} selector */
  const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
  /** @type {string|null} */
  let volumeDrillMuscle=null;
  let disposed=false;
  /** @param {Record<string,unknown>[]} rows */
  const table=rows=>formatTable(rows,t("stats.table.no_data"));
  /** @param {import("./contracts.js").StrengthRow} row */
  function strengthDetail(row){
    if(!row.sessions.length)return `<p class="lede">${esc(t("stats.evidence.reason.untested"))}</p>`;
    const series=row.series,unit=format.unit();
    const reason=series&&!series.outcome&&series.reason?`<p class="lede">${esc(t(`stats.evidence.reason.${series.reason}`))}</p>`:"";
    const range=row.sessions.length>1?`<p class="lede">${esc(t("stats.evidence.range",{start:row.sessions[0].longDate,end:/** @type {import("./contracts.js").StrengthHistorySession} */(row.sessions.at(-1)).longDate}))}</p>`:"";
    const top=series?.perSideLoad?t("focus.metric.load_per_side_kg"):t("stats.table.top"),
      reps=series?.perSideReps?t("focus.metric.reps_per_side"):t("stats.table.reps"),
      e1rm=series?.perSideLoad?`${t("stats.table.e1rm_unit",{unit})} · ${t("focus.metric.load_per_side_kg")}`:t("stats.table.e1rm_unit",{unit});
    return reason+range+table(row.sessions.map(session=>({[t("stats.table.date")]:session.shortDate,
      [top]:format.load(session.top),[reps]:session.topReps,[e1rm]:format.number(Math.round(session.e1rmDisplay)),[t("stats.table.rir")]:format.number(session.rir)})))
      .replace("<table>",'<table class="evtable">');
  }
  /** @param {Readonly<{scope:string,rows:readonly import("./contracts.js").StrengthRow[]}>} model */
  function renderStrength(model){
    if(disposed)return;
    const host=$("#strengthDash");if(!host)return;
    /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#strengthScopeSeg button")).forEach(button=>{
      const selected=/** @type {string} */(button.dataset.scope)===model.scope;button.classList.toggle("active",selected);button.setAttribute("aria-pressed",selected?"true":"false");
      button.onclick=()=>!disposed&&onStrengthScope(/** @type {string} */(button.dataset.scope));
    });
    if(!model.rows.length){host.innerHTML=`<div class="empty">${esc(t("stats.empty.no_lifts"))}</div>`;return}
    host.innerHTML=model.rows.map(row=>{
      const panel=`<div class="evrow__detail" data-evdetail="${esc(row.key)}" hidden>${strengthDetail(row)}</div>`;
      if(row.series.presentation==="empty")return `<button type="button" class="evrow" data-evkey="${esc(row.key)}" aria-expanded="false">`+
        `<div class="listrow__main"><div class="listrow__title">${esc(row.name)}</div><div class="listrow__sub">${esc(t("stats.evidence.empty"))}${esc(` · ${t("stats.evidence.baseline")}`)}</div></div>`+
        `<span class="evrow__val" aria-hidden="true"></span><span class="chevron" aria-hidden="true"></span></button>${panel}`;
      const word=presentation.outcomeWord(row),comparison=row.series.comparison;
      const change=comparison?.absolute?t("stats.evidence.change",{absolute:`${comparison.absolute>0?"+":""}${format.number(format.displayLoad(comparison.absolute))} ${format.unit()}`,
        percentage:`${(comparison.percentage||0)>0?"+":""}${format.number(comparison.percentage)}`}):"";
      return `<button type="button" class="evrow evrow--d" data-evkey="${esc(row.key)}" aria-expanded="false"><b class="evrow__name">${esc(row.name)}</b>`+
        `<span class="evrow__fig"><span class="evrow__val">${esc(presentation.figure(row.series))}</span><span class="chevron is-down" aria-hidden="true"></span></span>`+
        `<span class="evrow__out${word.soft?" is-soft":""}">${word.html}${change?esc(` · ${change}`):""}</span>`+
        `<span class="evrow__kind">${esc(presentation.kindText(row.series))}</span><span class="evrow__spark">${presentation.sparkline(row.series.points.map(point=>point.value))}</span></button>${panel}`;
    }).join("");
    /** @type {NodeListOf<HTMLElement>} */(host.querySelectorAll("[data-evkey]")).forEach(button=>button.onclick=()=>{if(disposed)return;
      const detail=/** @type {HTMLElement|null} */(host.querySelector(`[data-evdetail="${CSS.escape(/** @type {string} */(button.dataset.evkey))}"]`));if(!detail)return;
      const open=detail.hidden;detail.hidden=!open;button.setAttribute("aria-expanded",open?"true":"false");button.classList.toggle("is-open",open);
      const chevron=button.querySelector(".chevron.is-down,.chevron.is-up");if(chevron){chevron.classList.toggle("is-down",!open);chevron.classList.toggle("is-up",open)}
    });
  }
  /** @param {Readonly<import("./contracts.js").VolumeModel>} model */
  function renderVolume(model){
    if(disposed)return;
    const host=$("#volumeDash");if(!host)return;
    /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#volumeScopeSeg button")).forEach(button=>{
      const selected=/** @type {string} */(button.dataset.vscope)===model.scope;button.classList.toggle("active",selected);button.setAttribute("aria-pressed",selected?"true":"false");button.onclick=()=>!disposed&&onVolumeScope(/** @type {string} */(button.dataset.vscope));
    });
    const period=$("#volumePeriod");if(period)period.textContent=model.periodLabel;
    if(!model.rows.length){host.innerHTML=`<div class="empty">${esc(t("stats.empty.no_hard_sets",{n:7}))}</div>`;return}
    const dimension=model.scope==="this-week"?"week":"block",scope=model.scope==="this-week"?"current-week-muscle-sets":"block-to-date-muscle-sets";
    host.innerHTML=`<div class="evrows">`+model.rows.map(row=>{
      const caption=row.planned?(!row.inProgress&&row.done<row.planned?t("stats.volume.partial_period"):row.inProgress?t("stats.volume.in_progress",{done:format.number(row.done),planned:format.number(row.planned)}):""):"";
      const detail=row.details.length?table(row.details.map(item=>({[t("stats.table.date")]:item.dateLabel,[t("stats.table.exercise")]:item.name,[t("stats.table.sets")]:format.number(item.sets)}))):`<p class="lede">${esc(t("stats.evidence.reason.untested"))}</p>`;
      return `<button type="button" class="vrow evrow" data-volume-muscle="${esc(row.muscle)}" aria-expanded="false"><span class="vrow__name">${esc(row.label)}</span>`+
        `<span class="vrow__bar" data-progress-dimension="${dimension}" data-progress-scope="${scope}" aria-hidden="true"><span class="vrow__fill${row.done>=row.planned&&row.planned?" is-on":""}" style="width:${row.planned?Math.min(100,Math.round(row.done/row.planned*100)):0}%"></span></span>`+
        `<span class="vrow__num">${format.number(row.done)} / ${format.number(row.planned)}</span><span class="vrow__status">${esc(caption)}</span><span class="chevron" aria-hidden="true"></span></button>`+
        `<div class="evrow__detail" data-volume-detail="${esc(row.muscle)}" hidden>${detail}</div>`;
    }).join("")+`</div>`;
    /** @type {NodeListOf<HTMLElement>} */(host.querySelectorAll("[data-volume-muscle]")).forEach(button=>button.onclick=()=>{if(disposed)return;
      const detail=/** @type {HTMLElement|null} */(host.querySelector(`[data-volume-detail="${CSS.escape(/** @type {string} */(button.dataset.volumeMuscle))}"]`)),open=detail?.hidden;
      if(detail)detail.hidden=!open;button.setAttribute("aria-expanded",open?"true":"false");volumeDrillMuscle=open?/** @type {string} */(button.dataset.volumeMuscle):null;
    });
    if(volumeDrillMuscle)/** @type {HTMLElement|null} */(host.querySelector(`[data-volume-muscle="${CSS.escape(volumeDrillMuscle)}"]`))?.click();
  }
  /** @param {Readonly<import("./contracts.js").PrModel>} model */
  function renderPrs(model){
    if(disposed)return;
    const host=$("#prTimeline");if(!host)return;
    /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#prFilterSeg button")).forEach(button=>{
      const selected=/** @type {string} */(button.dataset.prf)===model.filter;button.classList.toggle("active",selected);button.setAttribute("aria-pressed",selected?"true":"false");button.onclick=()=>!disposed&&onPrFilter(/** @type {string} */(button.dataset.prf));
    });
    if(!model.events.length){host.innerHTML=`<div class="empty">${esc(t("stats.empty.no_pr_filter"))}</div>`;return}
    /** @param {string|undefined} iso */
    const date=iso=>{const parts=String(iso||"").split("-");return parts.length===3?`${t("month."+(+parts[1]-1))} ${+parts[2]}`:String(iso||"")};
    /** @param {string} kind */
    const kindLabel=kind=>kind==="load"?t("stats.pr.load"):kind==="reps"?t("stats.pr.reps"):t("stats.pr.e1rm");
    /** @param {import("./contracts.js").PrModel["events"][number]} event */
    const delta=event=>event.kind==="load"?(event.deltaLoad!=null?`+${format.load(event.deltaLoad)}${format.unit()}`:""):
      event.kind==="reps"?(event.deltaReps!=null?`+${event.deltaReps}`:""):(event.deltaE1rm!=null?`+${format.number(Math.round(format.displayLoad(event.deltaE1rm)))}${format.unit()}`:"");
    host.innerHTML=model.events.map((event,index)=>{
      const variant=event.kind==="load"?"pr-kind--load":event.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm",change=delta(event);
      return `<button type="button" class="prtl__row" data-prrow="${index}" aria-expanded="false"><span class="prtl__date">${esc(date(event.date))}</span><span class="prtl__ex">${esc(event.name)}</span>`+
        `<span class="pr-kind ${variant}">${esc(kindLabel(event.kind))}</span><span class="prtl__set">${esc(format.load(event.load))}${format.unit()} × ${esc(event.reps)}</span>`+
        (change?`<span class="prtl__delta">${esc(change)}</span>`:"")+`<span class="chevron" aria-hidden="true"></span></button>`+
        `<div class="evrow__detail" data-prdetail="${index}" hidden><p class="lede">${esc(event.dateLabel)}</p>`+
        `<p class="lede">${esc(`${kindLabel(event.kind)} · ${format.load(event.load)}${format.unit()} × ${event.reps}`)}${change?` · ${esc(change)}`:""}</p></div>`;
    }).join("");
    /** @type {NodeListOf<HTMLElement>} */(host.querySelectorAll("[data-prrow]")).forEach(button=>button.onclick=()=>{if(disposed)return;
      const detail=/** @type {HTMLElement|null} */(host.querySelector(`[data-prdetail="${button.dataset.prrow}"]`));if(!detail)return;const open=detail.hidden;detail.hidden=!open;button.setAttribute("aria-expanded",open?"true":"false");
    });
  }
  return Object.freeze({renderStrength,renderVolume,renderPrs,dispose(){disposed=true;volumeDrillMuscle=null;
    /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll("#strengthScopeSeg button,#volumeScopeSeg button,#prFilterSeg button,#strengthDash [data-evkey],#volumeDash [data-volume-muscle],#prTimeline [data-prrow]")).forEach(button=>button.onclick=null)}});
}
