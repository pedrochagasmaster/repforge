import { escapeHtml as esc, verdictMarkHtml, formatSetsLine } from "./format.js";

/** Canonical completion facts in; markup out. No stores, commands or browser IO.
 * copy owns t/tp/tOne; format owns number/compact/load/unit/date presentation.
 */
export function createSummaryMarkup({ copy, format }) {
const {t,tp,tOne}=copy;
const EVIDENCE_OUTCOME_KEYS={improved:"stats.outcome.improved",maintained:"stats.outcome.maintained",declined:"stats.outcome.declined"};
const SUMMARY_MUSCLES_SHOWN=6;
/** One PR line: a record mark and how far past the best it went. The sentence names the kind. */
function sessionPRHtml(p){
  const unit=format.unit(),over=p.kind==="load"?t("summary.pr.over_load",{n:format.load(p.delta),unit})
    :p.kind==="reps"?t("summary.pr.over_reps",{n:format.number(p.delta),reps:tp(p.delta,"rep")})
    :t("summary.pr.over_e1rm",{n:format.load(p.delta),unit});
  return `<p class="sum-pr"><span class="verdictmark verdictmark--record"><span class="verdictmark__glyph" aria-hidden="true"></span>${esc(t("summary.pr.label"))}</span>`+
    `<span class="sum-pr__over">${esc(over)}</span></p>`}
/** The lift's outcome word. Only a canonical outcome carries the .sum-outcome role. */
function summaryWordHtml(lift,session,{mark=true}={}){
  const st=lift.state,parity=lift.exerciseId?` data-parity-outcome="${esc(lift.exerciseId)}" data-parity-session="${esc(session)}"`:"";
  if(st.kind==="outcome"){
    const variant={improved:"up",maintained:"maintained",declined:"down"}[st.outcome];
    // Today's finished day says the word alone: its glyph rides the next target below (OG-6 `today/done`).
    if(!mark)return `<span class="sum-outcome" data-exercise-id="${esc(lift.liftKey)}" data-outcome="${esc(st.outcome)}"${parity}>${esc(t(EVIDENCE_OUTCOME_KEYS[st.outcome]))}</span>`;
    return `<span class="sum-outcome verdictmark verdictmark--${variant}" data-exercise-id="${esc(lift.liftKey)}" data-outcome="${esc(st.outcome)}"${parity}>`+
      `<span class="verdictmark__glyph" aria-hidden="true"></span>${esc(t(EVIDENCE_OUTCOME_KEYS[st.outcome]))}</span>`}
  if(st.kind==="baseline")return `<span class="sum-word">${esc(t("stats.outcome_short.single_observation"))}</span>`;
  if(st.reason==="missing-effort")return `<span class="sum-word">${esc(t("stats.outcome_short.missing_effort"))}</span>`;
  const key=st.reason==="changed-load"?"delta.changed_load.label":"delta.not_comparable.label";
  return `<span class="sum-word"${parity}>${esc(t(key))}</span>`}
/** `compact` is Today's finished day: the name and its word, then the next target, without the sets or the record line. */
function summaryGroupHtml(lift,s,{compact=false}={}){
  const session=compact?lift.session??s.session:s.session;
  return `<div class="sum-grp"><div class="sum-grp__h"><span class="sum-grp__n">${esc(lift.displayName??lift.name)}</span>${s.showBaseline?"":summaryWordHtml(lift,session,{mark:!compact})}</div>`+
    (compact?"":`<p class="sum-grp__sets">${esc(formatSetsLine(lift.sets,format,true))}</p>`)+
    (lift.pr&&!compact?sessionPRHtml(lift.pr):"")+
    (lift.next?`<p class="sum-grp__next"${lift.exerciseId?` data-parity-target="${esc(lift.exerciseId)}"`:""}>${verdictMarkHtml(lift.next.glyph)}`+
      `<span>${esc(t("summary.next_target",{target:lift.next.line}))}</span></p>`:"")+`</div>`}

function sessionSummaryHtml(s){
  const unit=format.unit(),out=[];
  out.push(`<p class="sum-eyebrow">${esc(t("summary.eyebrow"))}</p>`);
  out.push(`<h2 class="sum-hero" id="sumTitle" tabindex="-1">${esc(s.dayLabel)}</h2>`);
  out.push(`<p class="sum-sub">${esc(s.meso.current!=null?t("summary.saved_week",{date:format.date(s.date),n:s.meso.current}):format.date(s.date))}</p>`);
  // What the work itself was: sets, load moved, lifts touched, plus the clock when it measured this session.
  const cell=(n,cap,k)=>`<div class="statrow__cell"><div class="statrow__val" data-ramp="${esc(n)}"`+
    `${k?' data-kfmt="1"':""}>${esc(k?format.compact(n):format.number(n))}</div>`+
    `<div class="statrow__cap">${esc(cap)}</div></div>`;
  const cells=[cell(s.sets,tp(s.sets,"logged set")),
    cell(s.volumeDisplay,t("summary.stat.moved",{unit}),true),
    cell(s.lifts,tp(s.lifts,"lift"))];
  if(s.minutes!=null)cells.push(cell(s.minutes,tp(s.minutes,"minute")));
  out.push(`<div class="statrow${cells.length>3?" statrow--4":""} sum-stats">${cells.join("")}</div>`);
  // A session whose lifts have no past says so, instead of grading itself against nothing.
  if(s.showBaseline===true)out.push(`<p class="sum-baseline">${esc(t("summary.baseline"))}</p>`);
  if(s.liftGroups.length)
    out.push(`<h3 class="sum-sec">${esc(t("summary.outcome_head"))}</h3><div class="sum-grps">${s.liftGroups.map(lift=>summaryGroupHtml(lift,s)).join("")}</div>`);
  if(s.muscles.length){
    const shown=s.muscles.slice(0,SUMMARY_MUSCLES_SHOWN),rest=s.muscles.slice(SUMMARY_MUSCLES_SHOWN);
    out.push(`<h3 class="sum-sec">${esc(t("summary.muscles.title"))}</h3>`+
      `<p class="sum-muscles__note">${esc(t("summary.muscles.note"))}</p>`+
      `<div class="volume sum-muscles">`+
      [...shown.map(m=>[m,false]),...rest.map(m=>[m,true])].map(([m,extra])=>
        `<div class="vrow${extra?" hidden":""}"${extra?" data-muscle-extra":""}><span class="vrow__name">${esc(m.label??m.name)}</span>`+
        `<span class="vrow__num"><b>${format.number(m.sets)}</b> ${esc(tp(m.sets,"set"))}</span></div>`).join("")+`</div>`+
      (rest.length?`<button type="button" class="sum-muscles__more" id="sumMuscles" aria-expanded="false" data-total="${s.muscles.length}">${esc(t("summary.muscles_all",{n:s.muscles.length}))}</button>`:""))}
  // Where the session leaves the week, and what comes next.
  if(s.week.planned||s.next){
    const segs=Math.max(s.week.planned,s.week.done,1),done=Math.min(s.week.done,segs);
    out.push(`<div class="sum-split">`+
      (s.week.planned?`<div class="sum-split__cell"><p class="sum-split__k">${esc(t("summary.week.title"))}</p>`+
        `<p class="sum-week">${esc(t("today.sessions_done",{done:s.week.done,planned:s.week.planned}))}</p>`+
        `<div class="segbar sum-segbar" data-progress-dimension="week" data-progress-scope="completed-session-week" aria-hidden="true">`+
        Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<done?" is-done":""}"></span>`).join("")+`</div></div>`:"")+
      (s.next?`<div class="sum-next sum-split__cell"><p class="sum-split__k sum-next__lab">${esc(t("summary.next"))}</p>`+
        `<p class="sum-next__day">${esc(s.next.label)}</p>`+
        `<p class="sum-next__meta">${esc(tOne("today.exercise_count",s.next.exercises))}</p></div>`:"")+`</div>`)}
  // The detour beside the door, both pinned: the report scrolls under them.
  out.push(`<div class="sum-actions"><button type="button" class="btn btn--steel" id="sumSee">${esc(t("summary.see_session"))}</button>`+
    `<button type="button" class="btn btn--cta btn--noarrow" id="sumDone">${esc(t("summary.done"))}</button></div>`);
  return out.join("")}

return Object.freeze({html:sessionSummaryHtml,groupHtml:summaryGroupHtml});
}

