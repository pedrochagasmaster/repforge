(function (root) {
  function ymdToUTC(ymd) {
    const [y, m, d] = String(ymd).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function daysBetween(aYmd, bYmd) {
    return Math.round((ymdToUTC(bYmd) - ymdToUTC(aYmd)) / 86400000);
  }

  function lastDateForDay(log, dayLabel) {
    let best = null;
    for (const r of log || []) {
      if (r.day !== dayLabel || !r.date) continue;
      if (!best || String(r.date) > String(best)) best = r.date;
    }
    return best;
  }

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

  function hasLoggedOn(log, ymd) {
    return (log || []).some(r => r.date === ymd);
  }

  function usualHour(log) {
    const seen = new Set();
    const hours = [];
    for (const r of log || []) {
      if (!r.session || seen.has(r.session)) continue;
      seen.add(r.session);
      const t = Date.parse(r.created);
      if (!Number.isFinite(t)) continue;
      hours.push(new Date(t).getHours());
    }
    if (hours.length < 2) return null;
    hours.sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    return hours.length % 2 ? hours[mid] : Math.round((hours[mid - 1] + hours[mid]) / 2);
  }

  const api = { mostOverdueDay, usualHour, hasLoggedOn, daysBetween, lastDateForDay };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSchedule = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
