import {escapeHtml as esc} from "../format.js";
import {isSourceMetricRow,historyMetricRecords,historyHasLoadAndReps,historyHasStrengthMetrics,historyHasRir} from "./fields.js";
/** Pure read/edit markup over canonical facts and volatile field values. */
export function createHistoryMarkup({copy,format}){
const {t}=copy;
const {load:fmtLoad,loadPlain:fmtLoadPlain,number:fmt,unit:unitLabel,metricLabel:metricLabelDep,metricText:metricDisplayValue,metricUnit:metricDisplayUnit}=format;
const isWork=row=>!row.warmup;
const EDROW_RM_GLYPH={remove:"×",undo:"↺"};
const integer=value=>{const number=Math.round(Number(value)||0);try{return number.toLocaleString(format.locale())}catch{return String(number)}};
const shortDate=iso=>{const date=new Date(`${iso}T12:00:00`);return Number.isNaN(+date)?String(iso||""):`${date.getDate()} ${t("month_short."+date.getMonth())}`};
    const historyMetricLabel=metric=>typeof metricLabelDep==="function"?metricLabelDep(metric):String(metric?.sourceName||metric?.semantic||"");
    const historyMetricUnit=metric=>typeof metricDisplayUnit==="function"?metricDisplayUnit(metric)
      :metric?.unit==="kg"?unitLabel():metric?.unit==="metres"?"m":metric?.unit==="seconds"?"s":String(metric?.unit||"");
    const historyMetricText=(value,metric)=>typeof metricDisplayValue==="function"
      ?metricDisplayValue(value,metric):String(value??"");
    function historyMetricCell(row,record){
      const id=record.definition.id,label=historyMetricLabel(record.definition),unit=historyMetricUnit(record.definition),shown=historyMetricText(record.value,record.definition);
      return`<span class="fx-col history-metric" data-history-metric-id="${esc(id)}" data-metric-value="${esc(record.value)}" data-metric-unit="${esc(record.unit||record.definition.unit||"")}" aria-label="${esc(`${label}: ${shown}${unit?` ${unit}`:""}`)}">`+
        `<span class="history-metric__value">${esc(shown||"–")}</span><span class="history-metric__unit">${esc(unit)}</span></span>`}
    function historyMetricHeader(records){
      return(records||[]).map(record=>{
        const unit=historyMetricUnit(record.definition),label=historyMetricLabel(record.definition);
        return`<span class="fx-col">${esc(label)}${unit?` (${esc(unit)})`:""}</span>`}).join("")}
    function historyMetricSummary(row){
      const records=historyMetricRecords(row);
      if(records===null)return"";
      return records.map(record=>{
        const label=historyMetricLabel(record.definition),unit=historyMetricUnit(record.definition),shown=historyMetricText(record.value,record.definition);
        return`${label}: ${shown}${unit?` ${unit}`:""}`}).join(" · ")}
function historySetsLine(rows){
  const work=rows.filter(r=>isSourceMetricRow(r)?isWork(r):isWork(r)&&+r.load>0&&+r.reps>0)
    .sort((a,b)=>Number(a.set)-Number(b.set));
  if(!work.length)return"";
  if(work.some(row=>isSourceMetricRow(row)&&!historyHasLoadAndReps(row)))
    return work.map(row=>`${row.set}: ${isSourceMetricRow(row)?historyMetricSummary(row):`${fmtLoad(row.load)} × ${row.reps}`}`).join("; ");
  const same=work.every(r=>+r.load===+work[0].load);
  return same?`${fmtLoad(work[0].load)} × ${work.map(r=>r.reps).join(", ")}`
    :work.map(r=>`${fmtLoad(r.load)} × ${r.reps}`).join(", ")}
function historyOutcomeMark(group,sid){
  const cmp=group.outcome;
  if(!cmp)return"";
  const kind={improved:" verdictmark--up",flat:" verdictmark--maintained",regressed:" verdictmark--down"}[cmp.status];
  const exerciseId=group.rows[0]?.exerciseId;
  const parity=exerciseId?` data-parity-outcome="${esc(exerciseId)}" data-parity-session="${esc(sid)}"`:"";
  return`<span class="verdictmark${kind||" is-insufficient"}"${parity}>`+
    (kind?`<span class="verdictmark__glyph" aria-hidden="true"></span>`:"")+`${esc(cmp.label)}</span>`}
function historyReadingView({record:s,groups,setCount,volumeDisplay,hasStrengthProjection,prCount}){
  const sid=String(s.session);
  const lifts=groups.map(g=>{
    const exerciseId=g.rows[0].performedLibraryId||g.rows[0].performedMovementId||g.rows[0].exerciseId||g.key;
    const pred=g.previous;
    const before=pred.length?t("history.before",{date:shortDate(pred[0].date),sets:historySetsLine(pred)}):"";
    const record=g.record
      ?`<span class="verdictmark verdictmark--record"><span class="verdictmark__glyph" aria-hidden="true"></span>${esc(t("history.pr"))}</span>`:"";
    const metricRows=isSourceMetricRow(g.rows[0]),records=metricRows?historyMetricRecords(g.rows[0])||[]:[];
    const showRir=metricRows?(historyHasStrengthMetrics(g.rows[0])||historyHasRir(g.rows)):true;
    const count=metricRows?records.length+(showRir?1:0):3;
    const headers=metricRows?historyMetricHeader(records)+(showRir?`<span class="fx-col">${esc(t("glossary.term.RIR"))}</span>`:""):
      `<span class="fx-col">${esc(unitLabel())}</span><span class="fx-col">${esc(t("log.reps"))}</span><span class="fx-col">${esc(t("glossary.term.RIR"))}</span>`;
    const setRows=g.rows.map(row=>{
      const cells=metricRows?(historyMetricRecords(row)||[]).map(record=>historyMetricCell(row,record)).join("")+
        (showRir?`<span class="fx-col">${row.rir==null||row.rir===""?"–":esc(fmt(row.rir))}</span>`:""):
        `<span class="fx-col">${esc(fmtLoad(row.load))}</span><span class="fx-col">${esc(row.reps==null||row.reps===""?"–":row.reps)}</span>`+
        `<span class="fx-col">${esc(row.rir==null||row.rir===""?"–":fmt(row.rir))}</span>`;
      return`<div class="ledgerline"><span class="ledgerline__idx">${esc(row.warmup?"W"+row.set:row.set)}</span>`+
        `<span class="ledgerline__vals history-metric-grid" style="--history-metric-count:${count}">${cells}</span></div>`}).join("");
    const groupHeader=`<div class="ledgerline__head histpage__cols"><span>${esc(t("log.set"))}</span>`+
      `<span class="ledgerline__vals history-metric-grid" style="--history-metric-count:${count}">${headers}</span></div>`;
    return`<section class="histlift" data-lift="${esc(g.key)}" data-history-exercise-id="${esc(exerciseId)}"><div class="histlift__head"><h3 class="histlift__name">${esc(g.name)}</h3>`+
      `<span class="histlift__tags">${record}${historyOutcomeMark(g,sid)}</span></div>`+
      (before?`<p class="histlift__before">${esc(before)}</p>`:"")+groupHeader+`<div class="histlift__sets">${setRows}</div></section>`}).join("");
  const total=(value,label)=>`<div><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  const totals=total(integer(setCount),setCount===1?t("plural.set.one"):t("plural.set.other"))+
    (hasStrengthProjection?total(integer(volumeDisplay),t("summary.stat.moved",{unit:unitLabel()}))+
      total(integer(prCount),t("stats.metric.prs")):"");
  return`<article class="session session--read histpage" data-reading="${esc(sid)}" data-sess="${esc(sid)}">`+
    `<div class="histpage__totals">${totals}</div>`+
    lifts+
    `<div class="histpage__actions"><button type="button" class="btn btn--steel" data-history-edit="${esc(sid)}"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("history.session.edit"))}</button>`+
    `<button type="button" class="session__del" data-del="${esc(sid)}">${esc(t("history.session.delete"))}</button></div></article>`}
function sessionEditor({record:s,sets,selection,groups}){
  const removed=new Set((selection.removedRowIndices||[]).map(Number));
  const lifts=groups.map(g=>{
    const first=g.rows[0].r,name=g.name,metricRows=isSourceMetricRow(first),records=metricRows?historyMetricRecords(first)||[]:[],
      showRir=metricRows?(historyHasStrengthMetrics(first)||historyHasRir(g.rows.map(item=>item.r))):true,count=metricRows?records.length+(showRir?1:0):3,
      exerciseId=first.performedLibraryId||first.performedMovementId||first.exerciseId||g.key,
      headerValues=metricRows?historyMetricHeader(records)+(showRir?`<span class="fx-col">${esc(t("glossary.term.RIR"))}</span>`:""):
        `<span class="fx-col">${esc(unitLabel())}</span><span class="fx-col">${esc(t("log.reps"))}</span><span class="fx-col">${esc(t("glossary.term.RIR"))}</span>`,
      header=`<div class="ledgerline__head histedit__cols"><span>${esc(t("log.set"))}</span>`+
        `<span class="ledgerline__vals edrow__vals${metricRows?" history-metric-grid":""}"${metricRows?` style="--history-metric-count:${count}"`:""}>${headerValues}</span><span></span></div>`;
    const rows=g.rows.map(({r,i})=>{
      const isRemoved=removed.has(i),disabled=isRemoved?" disabled":"",label=t(isRemoved?"history.edit.undo_remove":"history.edit.remove_set"),
        mark=r.warmup?"W"+r.set:r.set,aria=`${esc(g.name)} ${esc(t("log.set").toLowerCase())} ${esc(mark)}`;
      let fields="";
      if(metricRows){
        fields=(historyMetricRecords(r)||[]).map(record=>{
          const metric=record.definition,metricLabel=historyMetricLabel(metric),unit=historyMetricUnit(metric),numeric=metric.semantic==="reps"||metric.semantic==="repsPerSide",
            value=historyMetricText(record.value,metric),fieldLabel=`${aria} ${esc(metricLabel)}${unit?` (${esc(unit)})`:""}`;
          return`<input class="edrow__in" data-ek="metric|${i}|${esc(metric.id)}" type="text" inputmode="${numeric?"numeric":"decimal"}" enterkeyhint="next" value="${esc(value)}" aria-label="${fieldLabel}"${disabled}>`}).join("")+
          (showRir?`<input class="edrow__in" data-ek="rir|${i}" type="text" inputmode="decimal" enterkeyhint="done" value="${r.rir==null?"":esc(fmt(r.rir))}" aria-label="${aria} ${esc(t("glossary.term.RIR"))}"${disabled}>`:"")
      }else fields=`<input class="edrow__in" data-ek="load|${i}" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(fmtLoadPlain(r.load))}" aria-label="${aria} ${unitLabel()}"${disabled}>`+
        `<input class="edrow__in" data-ek="reps|${i}" type="text" inputmode="numeric" enterkeyhint="next" value="${esc(r.reps)}" aria-label="${aria} ${esc(t("log.reps"))}"${disabled}>`+
        `<input class="edrow__in" data-ek="rir|${i}" type="text" inputmode="decimal" enterkeyhint="done" value="${esc(fmt(r.rir))}" aria-label="${aria} ${esc(t("glossary.term.RIR"))}"${disabled}>`;
      return`<div class="ledgerline edrow${isRemoved?" is-removed":""}" data-edidx="${i}"><span class="ledgerline__idx">${esc(mark)}</span>`+
        `<span class="ledgerline__vals edrow__vals${metricRows?" history-metric-grid":""}"${metricRows?` style="--history-metric-count:${count}"`:""}>${fields}</span>`+
        `<button type="button" class="edrow__rm${isRemoved?" is-undo":""}" data-edrm="${i}" aria-label="${esc(label)}" title="${esc(label)}"><span class="edrow__rm-glyph" aria-hidden="true">${isRemoved?EDROW_RM_GLYPH.undo:EDROW_RM_GLYPH.remove}</span></button></div>`}).join("");
    return`<section class="histlift histedit__lift" data-lift="${esc(g.key)}" data-history-exercise-id="${esc(exerciseId)}"><div class="histlift__head"><h3 class="histlift__name edgroup__name">${esc(name)}</h3></div>${header}${rows}</section>`}).join("");
  return`<div class="session session--edit histedit" data-editing="${esc(s.session)}" data-history-state="editing">`+
    `<p class="histedit__eyebrow" data-history-editing-heading tabindex="-1">${esc(t("history.editing_title"))}</p>`+
    `<h2 class="page-title histpage__title">${esc(s.dayLabel)}</h2>`+
    `<p class="histpage__lede" data-history-editing-status role="status" aria-live="polite">${esc(t("history.editing_status"))}</p>`+
    `<div class="histedit__date"><label class="sheetfield"><span class="sheetfield__cap">${esc(t("stats.table.date"))}</span>`+
    `<input class="sheetfield__input" data-ed="date" type="date" value="${esc(sets[0]?.date||s.date)}"></label></div>`+
    lifts+
    `<div class="edrisk"><button type="button" class="session__del" data-del="${esc(s.session)}">${esc(t("history.session.delete"))}</button></div>`+
    `<div class="histedit__bar workshelf"><button type="button" class="btn btn--steel" data-edcancel="1">${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--cta btn--noarrow" data-edsave="${esc(s.session)}">${esc(t("history.edit.save"))}</button></div></div>`;
}

return Object.freeze({readSession:historyReadingView,editSession:sessionEditor,metricSummary:historyMetricSummary,setsLine:historySetsLine});
}
