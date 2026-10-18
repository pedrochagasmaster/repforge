import {escapeHtml as esc} from "../format.js";
/** The lift chart owns only scope, metric, point and drawing lifetimes. Training
 * points are readonly query results. No workout/history bytes enter its state. */
/** @param {import("./exercise-contracts.js").ChartOptions} options */
export function createExerciseChart({window,copy,format,queries,motion,focus}){
const document=window.document,CSS=window.CSS,{t}=copy;
const {number:fmt,load:fmtLoad,displayLoad:toDisplay,unit:unitLabel,date:shortDate}=format;
/** @param {string} selector */
const $=selector=>/** @type {HTMLElement|null} */(document.querySelector(selector));
/** @param {string} selector */
const $$=selector=>/** @type {HTMLElement[]} */([...document.querySelectorAll(selector)]);
/** @param {string} scope */
const strengthProjection=scope=>queries.projection(scope);
/** @type {{scope:string,metric:string,pt:number|null}} */let chartView={scope:"current-block",metric:"top",pt:null};
/** @type {import("./exercise-contracts.js").ChartLive|null} */let chartLive=null;
/** @type {object|null} */let view=null;
/** @type {{el:HTMLElement,input:import("./exercise-contracts.js").ChartInput}|null} */let current=null;
let disposed=false;
const activeMotion=()=>motion?.available()&&!motion.reducedMotion()?motion:null;
const beatsOn=()=>!!activeMotion(),focusRoute=focus;
/** @type {Set<()=>void>} */const cleanups=new Set();
/** @type {(()=>void)|null} */let clearPointer=null;
function repaint(){if(current)render(current.el,current.input)}
const CHART_W=328,CHART_H=190;
const CHART_PAD={padL:42,padR:12,padT:20,padB:24};
/** @param {string} key @returns {import("./exercise-contracts.js").ChartModel} */
function chartModel(key){
  const{scope,metric}=chartView;
  const projection=strengthProjection(scope);
  const current=scope==="all-history"?new Set((strengthProjection("current-block").series.get(key)?.points||[]).map(point=>point.sessionKey)):null;
  const pts=projection.sessions.filter(x=>x.liftKey===key).map(x=>({date:x.date,top:x.top,reps:x.topReps,e1rm:x.e1rm,
    perSideLoad:x.perSideLoad===true,perSideReps:x.perSideReps===true,sessionKey:x.sessionKey,block:current?current.has(x.sessionKey):true}));
  const value=/** @param {import("./exercise-contracts.js").ChartPoint} p */ p=>metric==="top"?toDisplay(p.top):Math.round(toDisplay(p.e1rm)*10)/10;
  const vals=pts.map(value);
  const sel=chartView.pt==null||chartView.pt>=pts.length?pts.length-1:chartView.pt;
  return{pts,vals,sel,metric,scope,value}}
/** @param {number} v @param {string} metric */
const chartNum=(v,metric)=>metric==="top"?fmt(v):fmt(Math.round(v*10)/10);
/** Where the axis runs and where each session sits on it. */
/** @param {import("./exercise-contracts.js").ChartModel} model */
function chartGeometry(model){
  const{pts,vals}=model,{padL,padR,padT,padB}=CHART_PAD,W=CHART_W,H=CHART_H;
  let lo=Math.min(...vals),hi=Math.max(...vals);
  const step=hi-lo>12?5:2.5;
  lo=Math.floor((lo-step*.6)/step)*step;hi=Math.ceil((hi+step*.6)/step)*step;
  const x=/** @param {number} i */ i=>padL+(pts.length===1?(W-padL-padR)/2:i*(W-padL-padR)/(pts.length-1));
  const y=/** @param {number} v */ v=>padT+(1-(v-lo)/(hi-lo))*(H-padT-padB);
  return{lo,hi,step,x,y}}
/** One entry per session: where it is drawn and how it reads. The plot is drawn from these, so
 *  a frame of the scope change (C2) is the same drawing with moved coordinates and some fades. */
/** @param {import("./exercise-contracts.js").ChartModel} model @param {import("./exercise-contracts.js").Geometry} geo @returns {import("./exercise-contracts.js").ChartItem[]} */
function chartItems(model,geo){
  return model.pts.map((z,i)=>({i,key:z.sessionKey,x:geo.x(i),y:geo.y(model.vals[i]),
    tick:model.metric==="top"&&i>0&&z.top>model.pts[i-1].top,old:!z.block,sel:i===model.sel,alpha:1}))}
/** The axes: grid, tick labels, the block rule and the two end dates. They belong to the scope and metric. */
/** @param {import("./exercise-contracts.js").ChartModel} model @param {import("./exercise-contracts.js").Geometry} geo */
function chartAxesSvg(model,geo){
  const{pts}=model,{padL,padR,padT,padB}=CHART_PAD,W=CHART_W,H=CHART_H,{lo,hi,step,x,y}=geo;
  let g="";const ticks=[];
  for(let v=lo;v<=hi+1e-6&&ticks.length<40;v+=step)ticks.push(v);
  const every=ticks.length>5?2:1;
  ticks.forEach((v,i)=>{
    g+=`<line x1="${padL}" x2="${W-padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="ch-grid"/>`;
    if(i%every===0)g+=`<text x="${padL-6}" y="${(y(v)+3.5).toFixed(1)}" class="ch-ax" text-anchor="end">${esc(fmt(v))}</text>`});
  const first=pts.findIndex(z=>z.block);
  if(first>0){const bx=(x(first-1)+x(first))/2;
    g+=`<line x1="${bx.toFixed(1)}" x2="${bx.toFixed(1)}" y1="${padT-12}" y2="${H-padB}" class="ch-block"/>`;
    g+=`<text x="${(bx+4).toFixed(1)}" y="${padT-4}" class="ch-ax ch-ax--l">${esc(t("stats.scope.current_block"))}</text>`}
  g+=`<text x="${padL}" y="${H-6}" class="ch-ax">${esc(shortDate(pts[0].date))}</text>`+
    `<text x="${W-padR}" y="${H-6}" class="ch-ax" text-anchor="end">${esc(shortDate(pts[pts.length-1].date))}</text>`;
  return g}
/** The series: the cursor, then the line with its ticks and points. `reveal` is the index of the first
 *  item the clip wipe (C1) covers, 0 for the whole line; the line before it is drawn at rest. An item
 *  with an `alpha` below 1 is entering or leaving (C2) and its stretch of the line fades with it. */
/** @param {import("./exercise-contracts.js").ChartItem[]} items @param {string} metric @param {{reveal?:number|null}} options */
function chartSeriesSvg(items,metric,{reveal=null}={}){
  const{padT,padB}=CHART_PAD,H=CHART_H,n=items.length,sel=items.find(it=>it.sel);
  const stepPath=/** @param {import("./exercise-contracts.js").ChartItem[]} list */ list=>list.map((q,i)=>metric==="top"
    ?(i?`H${q.x.toFixed(1)} V${q.y.toFixed(1)}`:`M${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
    :`${i?"L":"M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
  const lines=/** @param {number} from @param {number} to */ (from,to)=>{
    const list=items.slice(from,to);
    /** @type {{faded:boolean,from:number,to:number,alpha:number}[]} */const runs=[];
    list.forEach((q,i)=>{const faded=q.alpha<1,last=runs.at(-1);
      if(last&&last.faded===faded){last.to=i}else runs.push({faded,from:i,to:i,alpha:q.alpha})});
    return runs.map(r=>{
      const part=r.faded?list.slice(Math.max(0,r.from-1),Math.min(list.length,r.to+2)):list.slice(r.from,r.to+1);
      return `<path d="${stepPath(part)}" class="ch-line"${r.faded?` opacity="${r.alpha.toFixed(2)}"`:""}/>`}).join("")};
  const points=/** @param {number} from @param {number} to */ (from,to)=>items.slice(from,to).map(z=>{
    const fade=z.alpha<1?` opacity="${z.alpha.toFixed(2)}"`:"";
    return (z.tick?`<path d="M${(z.x-4).toFixed(1)} ${(H-padB-6).toFixed(1)} l4 -6 l4 6 z" class="ex-tick"${fade}/>`:"")+
      `<circle cx="${z.x.toFixed(1)}" cy="${z.y.toFixed(1)}" r="${z.sel?5:3}" class="ex-pt${z.sel?" ex-pt--sel":z.old?" ex-pt--old":""}"${z.i==null?"":` data-i="${z.i}"`}${fade}/>`}).join("");
  const trace=/** @param {string} cls @param {number} lineFrom @param {number} lineTo @param {number} pointFrom @param {number} pointTo */ (cls,lineFrom,lineTo,pointFrom,pointTo)=>`<g class="ch-trace${cls}">${lines(lineFrom,lineTo)}${points(pointFrom,pointTo)}</g>`;
  // The cursor sits under the series and its points, never across a dot.
  let g=sel?`<line x1="${sel.x.toFixed(1)}" x2="${sel.x.toFixed(1)}" y1="${padT-6}" y2="${H-padB}" class="ex-cursor"/>`:"";
  if(reveal==null)g+=trace("",0,n,0,n);
  else if(reveal<=0)g+=trace(" motion-clip-reveal",0,n,0,n);
  else g+=trace("",0,reveal,0,reveal)+trace(" motion-clip-reveal",reveal-1,n,reveal,n);
  return g}
/** @param {import("./exercise-contracts.js").ChartModel} model @param {{reveal?:number|null}} options */
function chartSvg(model,{reveal=null}={}){
  const geo=chartGeometry(model),items=chartItems(model,geo);
  const xs=model.pts.map((_,i)=>geo.x(i));
  return{svg:`<svg class="exchart__svg" viewBox="0 0 ${CHART_W} ${CHART_H}" aria-hidden="true">`+
    `<g class="ch-axes">${chartAxesSvg(model,geo)}</g><g class="ch-series">${chartSeriesSvg(items,model.metric,{reveal})}</g></svg>`,
    xs,geo,items}}
/** @param {import("./exercise-contracts.js").ChartModel} model */
function chartReadout(model){
  const p=model.pts[model.sel],loadCue=model.pts.every(point=>point.perSideLoad)?` · ${t("focus.metric.load_per_side_kg")}`:"",
    repsCue=model.pts.every(point=>point.perSideReps)?` · ${t("focus.metric.reps_per_side")}`:"",
    label=(model.metric==="top"?t("stats.metric.top_load"):t("stats.metric.best_e1rm"))+loadCue;
  return t("exercise.chart.readout",{date:esc(shortDate(p.date)),metric:esc(label),unit:esc(unitLabel()),
    value:`<b class="exchart__mono">${esc(chartNum(model.value(p),model.metric))}</b>`,
    set:`<b class="exchart__mono">${esc(fmtLoad(p.top))} × ${esc(p.reps)}${esc(repsCue)}</b>`})}
/** @param {import("./exercise-contracts.js").ChartModel} model @param {number} i */
function chartRowHtml(model,i){
  const p=model.pts[i],prev=model.pts[i-1],v=model.value(p),pv=prev?model.value(prev):null;
  const delta=pv==null?"–":Math.abs(v-pv)<.05?"0":`${v>pv?"+":"−"}${chartNum(Math.abs(v-pv),model.metric)}`;
  const loadCue=model.pts.every(point=>point.perSideLoad)?` · ${t("focus.metric.load_per_side_kg")}`:"",
    repsCue=model.pts.every(point=>point.perSideReps)?` · ${t("focus.metric.reps_per_side")}`:"";
  return `<button type="button" class="exrow${i===model.sel?" is-sel":""}${p.block?"":" is-old"}" data-pt="${i}" aria-pressed="${i===model.sel}">`+
    `<span>${esc(shortDate(p.date))}</span><span class="exchart__mono">${esc(fmtLoad(p.top))} × ${esc(p.reps)}${esc(loadCue+repsCue)}</span>`+
    `<span class="exchart__mono">${esc(fmt(Math.round(toDisplay(p.e1rm)*10)/10))}${esc(loadCue)}</span><span class="exchart__mono exchart__soft">${esc(delta)}</span></button>`}
/** @param {HTMLElement} el @param {import("./exercise-contracts.js").ChartInput} input */
function render(el,input){
  if(disposed)return;
  clearPointer?.();clearPointer=null;
  current={el,input};view=input.identity;
  const {key,name}=input;
  const model=chartModel(key),{metric,scope}=chartView;
  const head=`<h2 class="exdet__name exchart__title">${esc(name)}</h2>`;
  const prev=chartLive&&chartLive.view===view&&chartLive.key===key?chartLive:null;
  if(!model.pts.length){
    chartLive=null;
    el.innerHTML=head+chartTogglesHtml(scope,metric)+`<div class="empty">${esc(t("exercise.empty.no_sets"))}</div>`;
    bindChartToggles();return}
  // What this render hands to the motion is decided before the page is rewritten.
  const intent=beatsOn()?chartMotionIntent(prev,model):null;
  const ghost=intent&&(intent.kind==="metric"||intent.kind==="scope")?chartGhost(el.querySelector("svg.exchart__svg"),intent.kind):null;
  const plot=chartSvg(model,{reveal:intent?.kind==="open"?0:intent?.kind==="extend"?intent.from:null});
  const live=chartLive={key,view:view,model,scope,metric,geo:plot.geo,items:plot.items,
    keys:model.pts.map(p=>p.sessionKey),drawn:new Map(plot.items.map(it=>[it.key,[it.x,it.y]]))};
  const vals=model.vals,change=vals[vals.length-1]-vals[0];
  const cue=model.pts.every(point=>point.perSideLoad)?` · ${t("focus.metric.load_per_side_kg")}`:"";
  const repsCue=model.pts.every(point=>point.perSideReps)?` · ${t("focus.metric.reps_per_side")}`:"";
  const figs=[[chartNum(Math.max(...vals),metric),`${t(metric==="top"?"exercise.chart.fig.top":"exercise.chart.fig.e1rm",{unit:unitLabel()})}${cue}`],
    [`${change<0?"−":"+"}${chartNum(Math.abs(change),metric)}`,`${t("exercise.chart.fig.change",{unit:unitLabel()})}${cue}`],
    [String(vals.length),t(vals.length===1?"plural.session.one":"plural.session.other")]];
  const metricLabel=`${metric==="top"?t("stats.metric.top_load"):t("stats.metric.best_e1rm")}${cue}`;
  el.innerHTML=head+chartTogglesHtml(scope,metric)+
    `<div class="exchart__figs">${figs.map(([v,l])=>`<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`+
    `<div class="exchart__plot" role="img" aria-label="${esc(t("exercise.chart.aria",{metric:metricLabel,name}))}" data-xs="${plot.xs.map(v=>v.toFixed(1)).join(",")}" data-w="${CHART_W}">${plot.svg}</div>`+
    `<p class="exchart__readout" aria-live="polite">${chartReadout(model)}</p>`+
    `<div class="exchart__cols"><span>${esc(t("stats.table.date"))}</span><span>${esc(t("ledger.col.top_set"))}${esc(cue+repsCue)}</span><span>${esc(t("stats.table.e1rm"))}${esc(cue)}</span><span>${esc(t("exercise.chart.col.delta"))}</span></div>`+
    model.pts.map((_,i)=>i).reverse().map(i=>chartRowHtml(model,i)).join("");
  bindChartToggles();
  const surface=/** @type {HTMLElement} */($("#exDetail .exchart__plot"));
  const pick=/** @param {PointerEvent} e */ e=>{const r=surface.getBoundingClientRect();if(!r.width)return;
    const at=(e.clientX-r.left)/r.width*CHART_W,xs=plot.xs;let best=0;
    xs.forEach((v,i)=>{if(Math.abs(v-at)<Math.abs(xs[best]-at))best=i});
    selectChartPoint(best)};
  const down=/** @param {PointerEvent} e */ e=>{pick(e);try{surface.setPointerCapture(e.pointerId)}catch{}};
  const move=/** @param {PointerEvent} e */ e=>{if(e.buttons)pick(e)};
  surface.addEventListener("pointerdown",down);surface.addEventListener("pointermove",move);
  clearPointer=()=>{surface.removeEventListener("pointerdown",down);surface.removeEventListener("pointermove",move)};
  $$("#exDetail .exrow").forEach(b=>b.onclick=()=>selectChartPoint(Number(b.dataset.pt)));
  if(intent)chartMotionPlay(el,surface,intent,prev,live,ghost)}

/* ---- Progress chart motion (Plan 064 rule 11: owner picks C1, C2 and D4) ----
   The table, the readout and the figures are the accessible alternative and are
   written at once, whatever the plot is doing. Everything drawn here is the end
   state first: the page is rendered at rest, then the plot is carried from where
   it was. Under reduced motion (or without the runtime) none of it runs and the
   rest drawing is all there is. */
/** What a render of the chart should play, if anything. A render of the same chart as before
 *  (a language or unit change, a repaint) plays nothing. */
/** @param {import("./exercise-contracts.js").ChartLive|null} prev @param {import("./exercise-contracts.js").ChartModel} model @returns {import("./exercise-contracts.js").Intent|null} */
function chartMotionIntent(prev,model){
  if(!prev)return{kind:"open"};
  // Two different quantities on two different axes: they crossfade, they never travel.
  if(prev.metric!==model.metric)return{kind:"metric"};
  if(prev.scope!==model.scope)return{kind:"scope"};
  const was=prev.keys,now=model.pts.map(p=>p.sessionKey);
  if(now.length>was.length&&was.every((k,i)=>now[i]===k))return{kind:"extend",from:was.length};
  return null}
/** Run one stylesheet beat once and put the element back at rest. The timer is only for an element
 *  that never animated (a hidden page), so nothing is left on the plot. */
/** @param {Element|null} el @param {string} cls @param {boolean} remove */
function settleBeat(el,cls,remove=false){
  if(!el)return;
  let over=false,timer=0;
  const clear=()=>{clearTimeout(timer);el.removeEventListener("animationend",end);el.removeEventListener("animationcancel",end);if(remove)el.remove();else el.classList.remove(cls);cleanups.delete(clear)};
  const end=/** @param {Event} [e] */ e=>{if(over||(e&&e.target!==el))return;over=true;clear();if(remove)el.remove();else el.classList.remove(cls)};
  cleanups.add(clear);timer=setTimeout(end,700);
  el.addEventListener("animationend",end);el.addEventListener("animationcancel",end)}
/** The drawing as it stood, kept to fade out over the new one. It is not `.exchart__svg`, and for a
 *  scope change it keeps only the axes, so a selector for the live plot finds one copy of anything. */
/** @param {SVGElement|null} svg @param {string} kind */
function chartGhost(svg,kind){
  if(!svg)return null;
  const ghost=/** @type {SVGElement} */(svg.cloneNode(true));
  ghost.setAttribute("class","exchart__ghost");ghost.setAttribute("aria-hidden","true");
  if(kind==="scope")ghost.querySelector(".ch-series")?.remove();
  ghost.querySelectorAll(".motion-clip-reveal,.motion-fade-in").forEach(n=>n.classList.remove("motion-clip-reveal","motion-fade-in"));
  ghost.querySelectorAll("[data-i]").forEach(n=>n.removeAttribute("data-i"));
  return ghost}
/** @param {HTMLElement} el @param {HTMLElement} host @param {import("./exercise-contracts.js").Intent} intent @param {import("./exercise-contracts.js").ChartLive|null} prev @param {import("./exercise-contracts.js").ChartLive} live @param {SVGElement|null} ghost */
function chartMotionPlay(el,host,intent,prev,live,ghost){
  const svg=/** @type {SVGElement|null} */(host.querySelector("svg.exchart__svg"));
  if(!svg)return;
  if(intent.kind==="open"||intent.kind==="extend"){
    // C1: the line wipes in on open; on extension only the stretch to the new session does.
    settleBeat(svg.querySelector(".ch-trace.motion-clip-reveal"),"motion-clip-reveal");return}
  if(intent.kind==="metric"){
    // The old drawing fades out over the new one, which fades in; no point travels.
    if(!ghost)return;
    ghost.classList.add("motion-fade-out");host.append(ghost);
    svg.classList.add("motion-fade-in");
    settleBeat(svg,"motion-fade-in");settleBeat(ghost,"motion-fade-out",true);return}
  if(intent.kind==="scope")chartScopeTravel(el,host,svg,prev,live,ghost)}
/** C2: the sessions both scopes have travel to their new coordinates; the ones only one scope has
 *  fade in or out; the axes, which belong to the scope, crossfade. The path is rebuilt on every frame
 *  from the interpolated points (`animateCoordinates`), so the step stays a step all the way. */
/** @param {HTMLElement} el @param {HTMLElement} host @param {SVGElement} svg @param {import("./exercise-contracts.js").ChartLive|null} prev @param {import("./exercise-contracts.js").ChartLive} live @param {SVGElement|null} ghost */
function chartScopeTravel(el,host,svg,prev,live,ghost){
  if(ghost){
    const axes=svg.querySelector(".ch-axes");
    ghost.classList.add("motion-fade-out");host.append(ghost);settleBeat(ghost,"motion-fade-out",true);
    if(axes){axes.classList.add("motion-fade-in");settleBeat(axes,"motion-fade-in")}}
  const m=activeMotion();
  if(!m||!prev)return;
  const was=prev.keys,now=live.keys,known=new Set(was);
  const shared=now.filter(k=>known.has(k));
  // One scope sits inside the other: the block inside all history.
  if(!shared.length||shared.length!==Math.min(was.length,now.length))return;
  const from=[],to=[];
  for(const k of shared){
    const a=prev.drawn.get(k),b=live.drawn.get(k);
    if(!a||!b)return;
    from.push(a[0],a[1]);to.push(b[0],b[1])}
  const rest=new Map(live.drawn),entering=now.length>=was.length;
  const base=entering?live.items:prev.items,current=new Map(live.items.map(it=>[it.key,it]));
  const index=new Map(shared.map((k,i)=>[k,i]));
  const series=/** @type {SVGElement} */(svg.querySelector(".ch-series"));
  m.animateCoordinates(el,from,to,(vals,progress)=>{
    if(chartLive!==live||!series.isConnected)return;
    const items=base.map(it=>{
      const at=index.get(it.key),own=/** @type {import("./exercise-contracts.js").ChartItem} */(current.get(it.key));
      if(at!=null){
        const x=vals[2*at],y=vals[2*at+1];live.drawn.set(it.key,[x,y]);
        return{...own,x,y,sel:own.i===live.model.sel,alpha:1}}
      const place=entering?[it.x,it.y]:(prev.drawn.get(it.key)||[it.x,it.y]);
      return{...it,i:entering?it.i:null,x:place[0],y:place[1],sel:false,alpha:entering?progress:1-progress}});
    series.innerHTML=chartSeriesSvg(items,live.metric)
  }).then(arrived=>{
    if(!arrived||chartLive!==live||!series.isConnected)return;
    live.drawn=rest;
    series.innerHTML=chartSeriesSvg(chartItems(live.model,live.geo),live.metric)})}
/** @param {string} scope @param {string} metric */
function chartTogglesHtml(scope,metric){
  const seg=/** @param {string} attr @param {string} label @param {[string,string,boolean][]} options */ (attr,label,options)=>`<div class="segpill" role="group" aria-label="${esc(label)}">`+
    options.map(([value,text,on])=>`<button type="button" ${attr}="${value}" aria-pressed="${on}">${esc(text)}</button>`).join("")+`</div>`;
  return `<div class="exchart__toggles">`+
    seg("data-scope",t("stats.scope_aria"),[["current-block",t("stats.scope.current_block"),scope==="current-block"],["all-history",t("stats.scope.all_history"),scope==="all-history"]])+
    seg("data-metric",t("stats.metric.top_load"),[["top",t("stats.metric.top_load"),metric==="top"],["e1rm",t("stats.metric.best_e1rm"),metric==="e1rm"]])+`</div>`}
function bindChartToggles(){
  // The page is rebuilt for every choice, so the pressed toggle is a new node: focus goes back to its equivalent by key (R7 J-10).
  const keep=/** @param {string} attr @param {string} value */ (attr,value)=>{const el=$(`#exDetail [${attr}="${CSS.escape(value)}"]`);if(el)focusRoute(el)};
  $$("#exDetail [data-scope]").forEach(b=>b.onclick=()=>{if(disposed)return;const value=/** @type {string} */(b.dataset.scope);chartView.scope=value;chartView.pt=null;repaint();keep("data-scope",value)});
  $$("#exDetail [data-metric]").forEach(b=>b.onclick=()=>{if(disposed)return;const value=/** @type {string} */(b.dataset.metric);chartView.metric=value;repaint();keep("data-metric",value)})}
/** Moves the selection in place, so the plot, the readout and the table agree and nothing loses focus. */
/** @param {number} i */
function selectChartPoint(i){
  if(!chartLive)return;
  const model=chartLive.model;if(i<0||i>=model.pts.length)return;
  const was=model.sel;
  chartView.pt=i;model.sel=i;
  const plot=$("#exDetail .exchart__plot"),readout=$("#exDetail .exchart__readout");
  if(plot&&i!==was)moveChartMarker(plot,model,was,i);
  if(readout)readout.innerHTML=chartReadout(model);
  $$("#exDetail .exrow").forEach(b=>{const on=Number(b.dataset.pt)===i;b.classList.toggle("is-sel",on);b.setAttribute("aria-pressed",on?"true":"false")})}
/** D4: the marker snaps to the session and, when the layer can animate, travels there. The selection
 *  itself (the points, the cursor, the readout, the table) changes in the same call; the travelling
 *  marker is a separate pair of elements over the plot, so scrubbing never waits for it and a
 *  second snap mid-flight starts from where the marker is on screen. */
/** @type {WeakMap<HTMLElement,{dot:HTMLSpanElement,line:HTMLSpanElement,token?:object}>} */
const chartMarkers=new WeakMap();
/** @param {HTMLElement} plot @param {import("./exercise-contracts.js").ChartModel} model @param {number} from @param {number} to */
function moveChartMarker(plot,model,from,to){
  const svg=plot.querySelector(".exchart__svg");if(!svg)return;
  const dot=/** @param {number} n */ n=>svg.querySelector(`.ex-pt[data-i="${n}"]`),cursor=svg.querySelector(".ex-cursor");
  const m=activeMotion(),before=m&&dot(from)?/** @type {Element} */(dot(from)).getBoundingClientRect():null;
  const cursorBox=()=>{const r=/** @type {Element} */(cursor).getBoundingClientRect();return{left:r.left-.5,top:r.top,width:1,height:r.height}};
  const cursorBefore=m&&cursor?cursorBox():null;
  /** @type {NodeListOf<SVGCircleElement>} */(svg.querySelectorAll("circle.ex-pt[data-i]")).forEach(c=>{
    const n=Number(c.dataset.i),on=n===to;
    c.setAttribute("r",on?"5":"3");c.classList.toggle("ex-pt--sel",on);
    c.classList.toggle("ex-pt--old",!on&&!model.pts[n]?.block)});
  const target=dot(to);
  if(cursor&&target){const x=/** @type {string} */(target.getAttribute("cx"));cursor.setAttribute("x1",x);cursor.setAttribute("x2",x)}
  if(!m||!before||!cursorBefore||!target||!cursor)return;
  const box=plot.getBoundingClientRect();
  let pair=chartMarkers.get(plot);
  if(!pair){
    pair={dot:document.createElement("span"),line:document.createElement("span")};
    pair.dot.className="exchart__marker";pair.line.className="exchart__scrub";
    for(const n of [pair.line,pair.dot]){n.setAttribute("aria-hidden","true");plot.append(n)}
    chartMarkers.set(plot,pair);plot.classList.add("is-marker-travel")}
  const place=/** @param {HTMLElement} node @param {{left:number,top:number,width:number,height:number}} r */ (node,r)=>{node.style.left=`${r.left-box.left}px`;node.style.top=`${r.top-box.top}px`;
    node.style.width=`${r.width}px`;node.style.height=`${r.height}px`};
  const toDot=target.getBoundingClientRect(),toLine=cursorBox();
  place(pair.dot,toDot);place(pair.line,toLine);
  const token=pair.token={};
  const done=()=>{
    if(pair.token!==token)return;
    pair.dot.remove();pair.line.remove();chartMarkers.delete(plot);plot.classList.remove("is-marker-travel")};
  Promise.all([m.animateIndicator(pair.line,cursorBefore),m.animateIndicator(pair.dot,before)]).then(done,done)}

function reset(){clearPointer?.();clearPointer=null;chartLive=null;view=null;current=null;chartView={scope:"current-block",metric:"top",pt:null};for(const clear of [...cleanups])clear()}
function dispose(){if(disposed)return;disposed=true;reset();
  $$("#exDetail [data-scope],#exDetail [data-metric],#exDetail .exrow").forEach(button=>button.onclick=null)}
return Object.freeze({render,reset,dispose,state:()=>Object.freeze({...chartView})});
}
