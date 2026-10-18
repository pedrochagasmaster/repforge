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
