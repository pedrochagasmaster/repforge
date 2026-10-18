import { escapeHtml as esc, verdictMarkHtml } from "../format.js";
import { createSummaryMarkup } from "../session-summary.js";

/** Paints a readonly Today model. All training derivation happens before render;
 * this view has no storage or command access and binds no application actions.
 */
export function createTodayView({ document, copy, format, motion = null }) {
const {t,tOne,countText,tp}=copy;
const summary=createSummaryMarkup({copy,format});
const $=selector=>document.querySelector(selector);
const TODAY_TALLY_ORDER=["up","hold","recover","stalled","down","new","manual"];
const TODAY_TALLY_KEYS={
  up:["today.tally.up.one","today.tally.up.other"],
  hold:["today.tally.hold.one","today.tally.hold.other"],
  recover:["today.tally.recover.one","today.tally.recover.other"],
  stalled:["today.tally.stalled.one","today.tally.stalled.other"],
  down:["today.tally.down.one","today.tally.down.other"],
  new:["today.tally.new.one","today.tally.new.other"],
  manual:["today.tally.manual.one","today.tally.manual.other"]};
function todayTallyHtml(model){
  const counts={};for(const row of model)counts[row.glyph]=(counts[row.glyph]||0)+1;
  const items=TODAY_TALLY_ORDER.filter(g=>counts[g]).map(g=>
    `<li class="today-tally__i">${verdictMarkHtml(g)}<span>${esc(t(TODAY_TALLY_KEYS[g][counts[g]===1?0:1],{n:counts[g]}))}</span></li>`);
  return items.length?`<ul class="today-tally">${items.join("")}</ul>`:""}
function todayRxRowHtml(row,index){
  const{glyph}=row,verdictId=`rxv${index}`,hasVerdict=!!row.verdictLabel&&glyph!=="manual";
  return `<button type="button" class="rxrow${glyph==="manual"?" is-manual":""}" data-exopen="${esc(row.exerciseId)}" aria-label="${esc(t("log.open_exercise_aria",{name:row.name}))}"${hasVerdict?` aria-describedby="${verdictId}"`:""}>`+
    `<span class="rxrow__mark">${verdictMarkHtml(glyph)}</span>`+
    `<span class="rxrow__name">${esc(row.name)}<span class="rxrow__sub">${esc(row.sub)}</span></span>`+
    `<span class="rxrow__load"${row.load!=null?` data-parity-target="${esc(row.exerciseId)}"`:""}>${row.load!=null?esc(format.load(row.load)):"\u2013"}</span>`+
    `<span class="rxrow__target">${esc(row.target).replace(/\u00d7/g,`<span class="rxrow__op">\u00d7</span>`)}</span>`+
    (hasVerdict?`<span class="visually-hidden" id="${verdictId}">${esc(row.verdictLabel)}</span>`:"")+`</button>`}
function todayRxHtml(model,sets){
  if(!model.length)return"";
  return todayTallyHtml(model)+
    `<div class="today-rx__head"><h3 class="today-rx__title">${esc(t("today.rx.title"))}</h3>`+
    `<span class="today-rx__meta">${esc(t("today.rx.meta",{exercises:countText("exercises",model.length),sets:countText("sets",sets)}))}</span></div>`+
    `<div class="today-rx" id="todayExList"><div class="today-rx__grid">`+
    `<div class="today-rx__cols" aria-hidden="true"><span></span><span>${esc(t("stats.exercise"))}</span><span>${esc(format.unit())}</span><span>${esc(t("ledger.col.target"))}</span></div>`+
    model.map((row,index)=>todayRxRowHtml(row,index)).join("")+`</div></div>`}
function todayDoneHtml(recap){
  const{liftGroups,showBaseline}=recap,s={showBaseline,session:recap.session};
  const cell=(n,cap)=>`<div class="statrow__cell"><div class="statrow__val">${esc(n)}</div><div class="statrow__cap">${esc(cap)}</div></div>`;
  return `<div class="today-done">`+
    `<div class="today-session__name today-session__name--day today-done__name"><span class="today-done__check" aria-hidden="true"></span>`+
    `${esc(recap.days.join(" \u00b7 ")||t("today.done_title"))}</div>`+
    `<div class="statrow sum-stats">${cell(format.number(recap.sets),tp(recap.sets,"set"))}${cell(format.compact(recap.volumeDisplay),t("summary.stat.moved",{unit:format.unit()}))}`+
    `${cell(format.number(recap.lifts),tp(recap.lifts,"lift"))}</div>`+
    (recap.prs?`<p class="today-done__pr">${esc(recap.prs===1?t("today.done_pr_one"):t("today.done_prs",{n:recap.prs}))}</p>`:"")+
    `<p class="today-done__note">${esc(t("today.done_note"))}</p>`+
    (liftGroups.length?`<h3 class="sum-sec today-done__head">${esc(t("summary.outcome_head"))}</h3><div class="sum-grps today-done__lifts">`+
      liftGroups.map(lift=>summary.groupHtml(lift,s,{compact:true})).join("")+`</div>`:"")+`</div>`}
function resumeHost(){
  let host=$("#todayResume");if(host)return host;
  const before=$("#todaySessionLabel");if(!before?.parentNode)return null;
  host=document.createElement("div");host.id="todayResume";host.className="today-resume";
  before.parentNode.insertBefore(host,before);return host
}
function renderResume(resume){
  const host=resumeHost();if(!host)return;
  if(!resume){host.innerHTML="";host.removeAttribute("style");return}
  const where=resume.position?t("focus.head.day_ex",{day:resume.label,n:resume.position.index,m:resume.position.total}):resume.label;
  const html=`<div class="today-resume__band" role="status"><span class="today-resume__title">${esc(t("today.resume.title"))}</span>`+
    `<span class="today-resume__where">${esc(where)}</span></div>`;
  if(host.firstElementChild){if(host.innerHTML!==html)host.innerHTML=html;return}
  const draw=()=>{host.innerHTML=html};
  if(motion?.animateDisclosure)motion.animateDisclosure(host,true,draw);else draw()
}
function renderNoProgram(){
  for(const sel of["#todayProgram","#todaySessionLabel","#todaySession","#startWorkout","#chooseAnotherDay",
    "#reviewTodaySession","#logAnotherSession","#todayWeekLabel","#todayWeek",
    "#todayUpNextLabel","#todayUpNext","#todayLast"]){
    const el=$(sel);if(el)el.classList.add("hidden")}
  const session=$("#todaySession");if(session)session.innerHTML="";
  renderResume(null);
  $("#todayNoProgram")?.classList.remove("hidden")
}
function render(model){
  const date=$("#todayDate");if(date)date.textContent=model.dateLabel;
  if(!model.hasProgram){renderNoProgram();return}
  $("#todayNoProgram")?.classList.add("hidden");
  for(const sel of["#todaySessionLabel","#todaySession","#todayWeekLabel","#todayWeek","#todayUpNextLabel","#todayUpNext","#todayLast"])
    $(sel)?.classList.remove("hidden");
  const program=model.program,progEl=$("#todayProgram");
  if(progEl){
    if(program.visible){
      progEl.classList.remove("hidden");
      const segs=program.total||6,cur=program.current||0;
      progEl.innerHTML=`<div class="today-prog__name">${esc(program.name||t("untitled_program"))}</div>`+
        (program.weekCopy?`<div class="today-prog__week">${esc(program.weekCopy)}</div>`:"")+
        (program.deload?`<div class="today-prog__deload">${esc(t("today.deload_week"))}</div>`:"")+
        `<div class="segbar" data-progress-dimension="block" data-progress-scope="active-program-week">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<Math.min(cur,segs)?" is-done":""}${i===Math.min(cur,segs)-1?" is-current":""}"></span>`).join("")}</div>`;
    }else{progEl.classList.add("hidden");progEl.innerHTML=""}
  }
  const recap=model.recap,label=$("#todaySessionLabel");
  if(label){const key=recap?"today.done_label":"today.session_label";label.setAttribute("data-i18n",key);label.textContent=t(key)}
  const session=$("#todaySession");
  if(session)session.innerHTML=recap?todayDoneHtml(recap):`<div class="today-session__name today-session__name--day">${esc(model.dayLabel)}</div>`+todayRxHtml(model.prescriptionRows,model.plannedSets);
  for(const[sel,shown]of[["#startWorkout",!recap],["#chooseAnotherDay",!recap&&model.canPickDay],["#reviewTodaySession",!!recap],["#logAnotherSession",!!recap]])
    $(sel)?.classList.toggle("hidden",!shown);
  const review=$("#reviewTodaySession");
  if(review){review.classList.toggle("btn--cta",!!recap);review.classList.toggle("btn--steel",!recap)}
  const cta=$("#startWorkout")?.querySelector("span");
  if(cta){const key=model.inProgress?"today.continue":"today.start";cta.setAttribute("data-i18n",key);cta.textContent=t(key)}
  renderResume(model.resume);
  const week=$("#todayWeek");
  if(week){
    const cells=model.week.cells.map(cell=>{
      const mark=cell.done?`<span class="week-letters__check">✓</span>`:`<span class="week-letters__dot${cell.today?" is-today":""}"></span>`;
      return `<div><div class="week-letters__d">${esc(cell.label)}</div><div class="week-letters__m">${mark}</div></div>`
    }).join("");
    week.innerHTML=`<div class="ov-week-line">${esc(t("today.sessions_done",{done:model.week.completedDays,planned:model.week.plannedDays}))}</div>`+
      (recap?"":`<div class="week-letters" data-progress-dimension="week" data-progress-scope="current-week-trained-days">${cells}</div>`)
  }
  const up=$("#todayUpNext"),next=model.next;
  if(up)up.innerHTML=next?`<button type="button" class="listrow" id="upNextBtn"><div class="listrow__main"><div class="listrow__title">${esc(next.label)}</div>`+
    `<div class="listrow__sub">${esc(tOne("today.exercise_count",next.exercises))}</div></div><span class="chevron" aria-hidden="true"></span></button>`:
    `<p class="lede">${esc(t("today.no_up_next"))}</p>`;
  const last=$("#todayLast"),n=model.lastTrainingDays;
  if(last)last.innerHTML=recap||n==null?"":`<span class="today-footer__icon" aria-hidden="true">⏱</span>${esc(n===0?t("today.last_trained_today"):n===1?t("today.last_trained_one"):t("today.last_trained",{n}))}`;
  const context=$("#logContext");if(context){context.textContent=model.logContext;context.classList.add("hidden")}
  if(!model.workoutActive){const title=$("#woDayTitle");if(title){title.removeAttribute("aria-label");title.textContent=model.dayLabel}}
}
return Object.freeze({render});
}
