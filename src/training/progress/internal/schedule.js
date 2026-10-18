/** @typedef {{day?:string,date?:string,session?:string,created?:string}} ScheduleRow */
/** @param {unknown} ymd */
function ymdToUTC(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** @param {unknown} aYmd @param {unknown} bYmd */
function daysBetween(aYmd, bYmd) {
  return Math.round((ymdToUTC(bYmd) - ymdToUTC(aYmd)) / 86400000);
}

/** @param {ScheduleRow[]|null|undefined} log @param {string} dayLabel */
function lastDateForDay(log, dayLabel) {
  let best = null;
  for (const r of log || []) {
    if (r.day !== dayLabel || !r.date) continue;
    if (!best || String(r.date) > String(best)) best = r.date;
  }
  return best;
}

/** @param {ScheduleRow[]|null|undefined} log @param {string[]|null|undefined} programDays @param {string} todayYmd */
function mostOverdueDay(log, programDays, todayYmd) {
  const days = Array.isArray(programDays) ? programDays : [];
  if (!days.length || !Array.isArray(log) || !log.length || !todayYmd) return null;

  let best = null;
  for (const day of days) {
    const lastDate = lastDateForDay(log, day);
    const daysSince = lastDate == null ? Number.POSITIVE_INFINITY : daysBetween(lastDate, todayYmd);
    const cand = { day, lastDate, daysSince: lastDate == null ? null : daysSince };
    if (!best) { best = cand; continue; }
    const a = best.daysSince == null ? Number.POSITIVE_INFINITY : best.daysSince;
    const b = cand.daysSince == null ? Number.POSITIVE_INFINITY : cand.daysSince;
    if (b > a) best = cand;
    // tie → keep earlier program order (first wins)
  }
  return best;
}

/** @param {ScheduleRow[]|null|undefined} log @param {string} ymd */
function hasLoggedOn(log, ymd) {
  return (log || []).some(r => r.date === ymd);
}

/** @param {ScheduleRow[]|null|undefined} log */
function usualHour(log) {
  const seen = new Set();
  const hours = [];
  for (const r of log || []) {
    if (!r.session || seen.has(r.session)) continue;
    seen.add(r.session);
    const t = Date.parse(r.created??"");
    if (!Number.isFinite(t)) continue;
    hours.push(new Date(t).getHours());
  }
  if (hours.length < 2) return null;
  hours.sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 ? hours[mid] : Math.round((hours[mid - 1] + hours[mid]) / 2);
}

const api = { mostOverdueDay, usualHour, hasLoggedOn, daysBetween, lastDateForDay };

export { mostOverdueDay, usualHour, hasLoggedOn, daysBetween, lastDateForDay };
export default api;
