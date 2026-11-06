/* Calibration evidence (Plan 077, OD-20): one user-level 0–100 number that says how much recent evidence Taurifer has
   about the lifter's effort estimates, never how accurate they are. Pure: no DOM, no storage. The app hands it the
   log's working sets as observations, the max sets as checks, and the suggestion replay (H) as hits.

   G = floor(100 × (0.55·T + 0.15·A + 0.12·H + 0.08·W + 0.05·S + 0.05·R)). Every item weighs 0.5^(age / 90 days) times
   its row quality, so the gauge only fades without new evidence; it never resets. */
(function (root) {
  "use strict";

  const VERSION = "gauge@077.1";
  const WEIGHTS = Object.freeze({ T: 0.55, A: 0.15, H: 0.12, W: 0.08, S: 0.05, R: 0.05 });
  const HALF_LIFE_DAYS = 90;
  /** How much weighted evidence a supporting component needs before its agreement rate counts in full. */
  const TARGETS = Object.freeze({ A: 20, H: 20, W: 8, S: 12, R: 24 });
  /** At most two weighted checks count per exercise; K is capped at four exercises. */
  const CHECKS_PER_KEY = 2, MAX_KEYS = 4;
  const RIR_CREDIT = 5;
  const PAIR_RANGE = Object.freeze([0.85, 1.03]);
  const WEEK_DRIFT = 0.05, WEEK_GAP = 2;
  const REPLAY_SETS = 30;

  const DAY_MS = 86400000;
  const dayNumber = (value) => {
    const time = Date.parse(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
  };
  /* ISO weeks start on Monday; day 0 (1970-01-01) was a Thursday. */
  const weekOf = (day) => Math.floor((day + 3) / 7);
  /** An item's weight from its age: a 90-day-old item counts half. Undated or future items count in full. */
  function decay(date, now) {
    const at = dayNumber(date), today = dayNumber(now);
    if (at == null || today == null) return at == null ? 0 : 1;
    return 0.5 ** (Math.max(0, today - at) / HALF_LIFE_DAYS);
  }

  /** A row's quality as evidence: a number (RIR or reps left) 1; a word, "3+" or an unknown source ½; a prefilled
   *  value, "Not sure", a max set (it feeds T only) and a warm-up 0. */
  function rowQuality(row) {
    if (!row || row.warmup) return 0;
    switch (row.effortSource) {
      case "rir": case "reps_left": return 1;
      case "effort": case "reps_left_3plus": case undefined: case null: return 0.5;
      default: return 0;
    }
  }

  /** T: weighted max sets per exercise, at most two each, over 2·K. */
  function maxSetComponent(checks, { now, eligibleKeys = 1 } = {}) {
    const K = Math.min(MAX_KEYS, Math.max(1, Math.floor(Number(eligibleKeys) || 0)));
    const byKey = new Map();
    for (const check of Array.isArray(checks) ? checks : []) {
      if (!check || check.key == null) continue;
      byKey.set(check.key, (byKey.get(check.key) || 0) + decay(check.date, now));
    }
    let sum = 0;
    for (const weight of byKey.values()) sum += Math.min(CHECKS_PER_KEY, weight);
    return Math.min(1, sum / (CHECKS_PER_KEY * K));
  }

  /** A supporting component: its weighted agreement rate times how much of its target the weighted evidence meets. */
  function supporting(items, target, now) {
    let total = 0, agreed = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const w = decay(item.date, now) * (Number.isFinite(item.q) ? item.q : 1);
      if (!(w > 0)) continue;
      total += w;
      if (item.agree) agreed += w;
    }
    return total > 0 ? (agreed / total) * Math.min(1, total / target) : 0;
  }

  const countable = (obs) => obs && obs.q > 0 && Number.isFinite(obs.load) && obs.load > 0 &&
    Number.isFinite(obs.reps) && obs.reps > 0 && Number.isFinite(obs.rir) && obs.rir >= 0;
  const groupBy = (items, keyOf) => {
    const out = new Map();
    for (const item of items) { const k = keyOf(item); if (!out.has(k)) out.set(k, []); out.get(k).push(item); }
    return out;
  };
  const capacityOf = (capacity, obs) => capacity(obs.load, obs.reps, Math.min(RIR_CREDIT, obs.rir));

  /** A: consecutive working sets of one exercise in one workout, both with countable effort. They agree when the
   *  second capacity is 85–103 % of the first: a plausible fatigue drop, or a small rise. */
  function pairsFrom(observations, capacity) {
    const out = [];
    for (const sets of groupBy((observations || []).filter(Boolean), (obs) => `${obs.key}\u0000${obs.session}`).values()) {
      sets.sort((a, b) => a.set - b.set);
      for (let i = 1; i < sets.length; i++) {
        const a = sets[i - 1], b = sets[i];
        if (!countable(a) || !countable(b)) continue;
        const ratio = capacityOf(capacity, b) / capacityOf(capacity, a);
        out.push({ date: b.date, q: Math.min(a.q, b.q), agree: ratio >= PAIR_RANGE[0] && ratio <= PAIR_RANGE[1] });
      }
    }
    return out;
  }

  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  /** W: per exercise and ISO week, the median first-set capacity of that week's workouts. Estimates no more than two
   *  weeks apart agree when they differ by at most ±5 %. */
  function weeksFrom(observations, capacity) {
    const out = [];
    for (const rows of groupBy((observations || []).filter(Boolean), (obs) => obs.key).values()) {
      const firsts = new Map();
      for (const session of groupBy(rows, (obs) => obs.session).values()) {
        const first = session.filter(countable).sort((a, b) => a.set - b.set)[0];
        const day = first ? dayNumber(first.date) : null;
        if (day == null) continue;
        const week = weekOf(day);
        if (!firsts.has(week)) firsts.set(week, { caps: [], q: [], date: first.date });
        const entry = firsts.get(week);
        entry.caps.push(capacityOf(capacity, first)); entry.q.push(first.q);
        if (first.date > entry.date) entry.date = first.date;
      }
      const weeks = [...firsts.entries()].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < weeks.length; i++) {
        const [w0, a] = weeks[i - 1], [w1, b] = weeks[i];
        if (w1 - w0 > WEEK_GAP) continue;
        const before = median(a.caps), after = median(b.caps);
        out.push({ date: b.date, q: Math.min(Math.min(...a.q), Math.min(...b.q)),
          agree: Math.abs(after / before - 1) <= WEEK_DRIFT + 1e-12 });
      }
    }
    return out;
  }

  /** S: an answered "Was the last rep slow?" agrees when yes goes with a logged RIR of 1 or less, or no with 2 or more. */
  function tapsFrom(observations) {
    const out = [];
    for (const obs of observations || []) {
      if (!obs || typeof obs.lastRepSlow !== "boolean" || !(obs.q > 0) || !Number.isFinite(obs.rir)) continue;
      out.push({ date: obs.date, q: obs.q, agree: obs.lastRepSlow ? obs.rir <= 1 : obs.rir >= 2 });
    }
    return out;
  }

  /** R: for each exercise in the active program, its weighted countable working sets over 24; the mean of those. */
  function historyComponent(observations, programKeys, now) {
    const keys = [...new Set(programKeys || [])];
    if (!keys.length) return 0;
    const sums = new Map(keys.map((key) => [key, 0]));
    for (const obs of observations || []) {
      if (!obs || !sums.has(obs.key) || !(obs.q > 0)) continue;
      sums.set(obs.key, sums.get(obs.key) + decay(obs.date, now) * obs.q);
    }
    let total = 0;
    for (const sum of sums.values()) total += Math.min(1, sum / TARGETS.R);
    return total / keys.length;
  }

  /** H: replay the engine on the history before each of an exercise's recent workouts (the sessions that hold its
   *  last 30 sets) and compare each set done at the suggested load with the suggestion: it agrees when its reps plus
   *  RIR land within one of the suggested reps plus RIR. `suggest(priorSessions, session, key)` returns
   *  `[{setIndex, load, reps, rir}]`; nothing new is stored. */
  function hitsFrom(sessionsByKey, suggest) {
    const out = [];
    for (const key of Object.keys(sessionsByKey || {}).sort()) {
      const sessions = (sessionsByKey[key] || []).filter((session) => session && Array.isArray(session.sets));
      let start = sessions.length, sets = 0;
      while (start > 0 && sets + sessions[start - 1].sets.length <= REPLAY_SETS) sets += sessions[--start].sets.length;
      for (let i = start; i < sessions.length; i++) {
        const session = sessions[i], predicted = suggest(sessions.slice(0, i), session, key) || [];
        const byIndex = new Map(predicted.filter(Boolean).map((item) => [item.setIndex, item]));
        for (const set of session.sets) {
          const target = byIndex.get(set.setIndex);
          if (!target || !(set.q > 0) || !Number.isFinite(set.reps) || !Number.isFinite(set.rir)) continue;
          if (!Number.isFinite(target.load) || !Number.isFinite(target.reps) || !Number.isFinite(target.rir)) continue;
          if (Math.abs(set.load - target.load) > 0.01) continue;
          out.push({ key, date: session.date, q: set.q,
            agree: Math.abs(set.reps + Math.min(RIR_CREDIT, set.rir) - (target.reps + target.rir)) <= 1 });
        }
      }
    }
    return out;
  }

  /** The gauge from its six components. Without recent slow-tap answers (or with the tap off), S's weight is shared
   *  among A, H, W and R in proportion, so skipping the optional tap never costs anything. */
  function combine({ T = 0, A = 0, H = 0, W = 0, S = 0, R = 0, taps = false } = {}) {
    const clamp = (v) => Math.min(1, Math.max(0, Number(v) || 0));
    let support;
    if (taps) support = WEIGHTS.A * clamp(A) + WEIGHTS.H * clamp(H) + WEIGHTS.W * clamp(W) + WEIGHTS.S * clamp(S) + WEIGHTS.R * clamp(R);
    else {
      const base = WEIGHTS.A + WEIGHTS.H + WEIGHTS.W + WEIGHTS.R, scale = (base + WEIGHTS.S) / base;
      support = scale * (WEIGHTS.A * clamp(A) + WEIGHTS.H * clamp(H) + WEIGHTS.W * clamp(W) + WEIGHTS.R * clamp(R));
    }
    return Math.floor(100 * (WEIGHTS.T * clamp(T) + support) + 1e-9);
  }

  /** The gauge and what feeds it. `checks` are `{key, date}` max sets; `observations` the working sets as
   *  `{key, session, date, set, load, reps, rir, q, lastRepSlow?}`; `hits` the H replay; `capacity(load, reps, rir)`
   *  the capacity estimate. Counts are the weighted evidence behind each component, for the breakdown. */
  function compute({ now, checks = [], observations = [], hits = [], programKeys = [], eligibleKeys = 1,
    capacity, slowTapOn = true } = {}) {
    const pairs = pairsFrom(observations, capacity), weeks = weeksFrom(observations, capacity), taps = tapsFrom(observations);
    const recentTaps = slowTapOn && taps.some((tap) => decay(tap.date, now) >= 0.5);
    const components = {
      T: maxSetComponent(checks, { now, eligibleKeys }),
      A: supporting(pairs, TARGETS.A, now),
      H: supporting(hits, TARGETS.H, now),
      W: supporting(weeks, TARGETS.W, now),
      S: recentTaps ? supporting(taps, TARGETS.S, now) : 0,
      R: historyComponent(observations, programKeys, now),
    };
    const tally = (items) => ({ agree: items.filter((item) => item.agree).length, total: items.length });
    const perKey = new Map();
    for (const check of checks || []) perKey.set(check.key, Math.min(CHECKS_PER_KEY, (perKey.get(check.key) || 0) + 1));
    const keys = new Set((checks || []).map((check) => check.key));
    const sessions = new Set((observations || []).filter((obs) => obs && obs.q > 0).map((obs) => obs.session));
    return {
      version: VERSION,
      percent: combine({ ...components, taps: recentTaps }),
      components,
      taps: recentTaps,
      // Plain counts for the breakdown: the max sets that count (two per exercise) out of 2·K, and agreed of total.
      counts: { checks: (checks || []).length, checkKeys: keys.size, counted: [...perKey.values()].reduce((a, b) => a + b, 0),
        needed: CHECKS_PER_KEY * Math.min(MAX_KEYS, Math.max(1, eligibleKeys | 0)),
        pairs: tally(pairs), hits: tally(hits), weeks: tally(weeks), taps: tally(taps), sessions: sessions.size },
    };
  }

  const api = Object.freeze({ VERSION, WEIGHTS, TARGETS, HALF_LIFE_DAYS, REPLAY_SETS, decay, rowQuality, maxSetComponent,
    supporting, pairsFrom, weeksFrom, tapsFrom, historyComponent, hitsFrom, combine, compute });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeCalibrationGauge = api;
})(typeof window !== "undefined" ? window : globalThis);
