/** Presentation-only formatting. Storage values never pass through these functions. */
/** @param {unknown} v */
export const escapeHtml=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
/** @param {unknown} v */
export const formatNumberPlain=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";

/** @param {unknown} value */
export function formatNumber(value, language = "en") {
  const text = formatNumberPlain(value);
  return language === "pt" ? text.replace(".", ",") : text;
}
/** @param {unknown} seconds */
export function formatClock(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Shared recommendation mark used by Today, Focus, Why and completion. @param {string} glyph */
export function verdictMarkHtml(glyph) {
  if (!["up", "down", "hold", "recover"].includes(glyph)) return "";
  return `<span class="verdictmark verdictmark--${glyph}"><span class="verdictmark__glyph" aria-hidden="true"></span></span>`;
}

/** Display grouping only; this does not round or rewrite stored loads.
 * @param {ReadonlyArray<{load:number,reps:number}>} sets
 * @param {{load:(value:number)=>string,unit:()=>string}} format
 */
export function formatSetsLine(sets, { load, unit }, withUnit = false) {
  const rows = sets.filter(row => +row.reps > 0);
  if (!rows.length) return "";
  const same = rows.every(row => Math.abs(+row.load - +rows[0].load) <= 1e-6);
  return same
    ? `${load(rows[0].load)}${withUnit ? ` ${unit()}` : ""} × ${rows.map(row => row.reps).join(", ")}`
    : rows.map(row => `${load(row.load)} × ${row.reps}`).join(", ");
}

/** @param {Record<string,unknown>[]} rows @param {string} emptyLabel */
export function formatTable(rows, emptyLabel) {
  if (!rows.length) return `<div class="empty">${escapeHtml(emptyLabel)}</div>`;
  const headings=Object.keys(rows[0]);
  return `<table><thead><tr>${headings.map(key=>`<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>`+
    rows.map(row=>`<tr>${headings.map(key=>`<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("")+`</tbody></table>`;
}

/** @typedef {{current:number|null,total:number,isFinalWeek:boolean,isComplete:boolean}} ProgramCycle
 * @typedef {(key:string,values?:Record<string,unknown>)=>string} Copy */
/** Shared program-context copy used by Today and Focus. @param {unknown} name @param {ProgramCycle} cycle @param {Copy} t */
export function formatProgramContext(name,cycle,t){
  const label=name||t('untitled_program');
  if(cycle.isComplete)return t('log.context.program_complete',{name:label});
  if(cycle.isFinalWeek)return t('log.context.program_week_ready',{name:label,n:cycle.current,total:cycle.total});
  if(cycle.current!=null)return t('log.context.program_week',{name:label,n:cycle.current,total:cycle.total});
  return String(label);
}
/** @param {ProgramCycle} cycle @param {boolean} deload @param {Copy} t */
export function formatCycleLabel(cycle,deload,t){
  return deload?t('today.deload_week'):cycle.isComplete?t('meso.complete'):cycle.current!=null?t('today.week_short',{n:cycle.current}):'';
}

/** Numeric load grouping for display; never rounds a stored value.
 * @param {number|null|undefined} a @param {number|null|undefined} b */
export const sameLoad=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<=1e-6;
/** @param {{status:string,reason?:string}} recommendation */
export function recommendationVerdict(recommendation){
  if(['configuration_required','manual','new'].includes(recommendation.status))return recommendation.status;
  if(recommendation.status==='add'||recommendation.status==='add2')return 'up';
  if(recommendation.status==='reduce')return recommendation.reason==='stalled'?'stalled':'down';
  return recommendation.reason==='recover'?'recover':'hold';
}
/** @param {unknown} date @param {(key:string)=>string} t @param {string} language */
export function formatShortDate(date,t,language){
  const parts=String(date||'').split('-');if(parts.length!==3)return String(date||'');
  const day=Number(parts[2]),month=t('month_short.'+(Number(parts[1])-1));
  return language==='pt'?`${day} ${month}`:`${month} ${day}`;
}

/** Locale list formatting shared by Why and entry conflict copy.
 * @param {unknown[]} items @param {string} language */
export function formatList(items,language){const values=items.map(String);try{return new Intl.ListFormat(language==='pt'?'pt-BR':'en-GB',{style:'long',type:'conjunction'}).format(values);}catch{return values.join(', ');}}
