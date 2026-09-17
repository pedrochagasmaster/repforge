(function (root) {
  "use strict";

  // Plan 056 — pure Progress evidence/view-model boundary.
  //
  // Every function takes an acknowledged snapshot as input (the app adapter in
  // app.js passes program/meta/log/now; nothing here reads globals, the DOM,
  // storage, or the network) and returns plain data: codes, values, scopes,
  // counts, and destination IDs. No localized strings and no HTML leave this
  // module. Progression and transition mathematics are NOT reimplemented:
  // observed outcomes and recommendations arrive as caller-provided facts
  // (engine/authoritative), and structural proposals stay in
  // RepForgeProgramTransition.
  //
  // Week arithmetic mirrors the app's Monday-based weekStart/weekRange so a
  // label's denominator is always the same period the log is filtered by.

  const MODEL_VERSION = 1;

  const OUTCOMES = Object.freeze(["improved", "maintained", "declined"]);
  const RECOMMENDATIONS = Object.freeze(["progress", "repeat", "review"]);
  const EVIDENCE_STATES = Object.freeze(["insufficient", "sufficient"]);

  // Recommendation verb for a sufficient observed outcome. This is the
  // vocabulary separation (G-24), not progression math: the engine still owns
  // whether an outcome happened at all.
  const OUTCOME_TO_RECOMMENDATION = Object.freeze({
    improved: "progress",
    maintained: "repeat",
    declined: "review",
  });

  const DAY_MS = 86400000;

  function isoDate(value) {
    return String(value == null ? "" : value).slice(0, 10);
  }

  function dateAtNoon(value) {
    return new Date(`${isoDate(value)}T12:00:00`);
  }

  function shiftIso(date, days) {
    const d = dateAtNoon(date);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function weekStartOf(date) {
    const d = dateAtNoon(date);
    const dow = d.getDay(), diff = dow === 0 ? 6 : dow - 1;
    d.setDate(d.getDate() - diff);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDays(date, n) {
    return shiftIso(date, n);
  }

  // Program input: either the app's row array ([{id, day, sets, ...}]) or the
  // model's fixture shape ({days:[...], exercises:[{id, day,
  // plannedWorkingSetsPerWeek, slot, pattern}]}). Both normalize to the same
  // planned denominators.
  function normalizeProgram(program, meta) {
  const weeks = Math.max(1, Number(meta?.mesocycleLengthWeeks ?? program?.mesocycleLengthWeeks) || 6);
  // An explicit meta.started of null means "no block" and must not fall
  // through to the program's own start date.
  const started = isoDate(meta && meta.started !== undefined ? meta.started : program?.started) || null;
    const days = new Set();
    const exercises = [];
    let plannedWorkingSetsPerWeek = 0;
    const rows = Array.isArray(program) ? program : Array.isArray(program?.exercises) ? program.exercises : [];
    for (const row of rows || []) {
      if (!row) continue;
      const day = String(row.day ?? "");
      if (day) days.add(day);
      const sets = Number(row.plannedWorkingSetsPerWeek ?? row.sets);
      if (Number.isFinite(sets) && sets > 0) plannedWorkingSetsPerWeek += sets;
      exercises.push({
        id: String(row.id ?? row.name ?? ""),
        day,
        slot: row.slot ?? null,
        pattern: row.pattern ?? null,
        plannedWorkingSets: Number.isFinite(sets) && sets > 0 ? sets : 0,
      });
    }
    return {
      weeks,
      started,
      dayCount: days.size || 0,
      exercises,
      plannedSessionsPerWeek: days.size || 0,
      plannedWorkingSetsPerWeek,
    };
  }

  function isWorkingRow(row) {
    return row && row.work !== false && Number(row.load) > 0 && Number(row.reps) > 0;
  }

  function rowsInRange(log, start, end) {
    const out = [];
    for (const row of log || []) {
      if (!row) continue;
      const date = isoDate(row.date);
      if (!date) continue;
      if (start && date < start) continue;
      if (end && date > end) continue;
      out.push(row);
    }
    return out;
  }

  function countSessions(rows) {
    return new Set(rows.filter(isWorkingRow).map((r) => r.session ?? r.date)).size;
  }

  function countWorkingSets(rows) {
    return rows.filter(isWorkingRow).length;
  }

  function elapsedWeekOf(started, now, weeks) {
    if (!started) return null;
    const days = Math.floor((dateAtNoon(now) - dateAtNoon(started)) / DAY_MS);
    if (Number.isNaN(days)) return null;
    return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weeks);
  }

  function weekPrescription(meta, weekIndex0) {
    const list = Array.isArray(meta?.weekPrescriptions) ? meta.weekPrescriptions : [];
    const entry = list[weekIndex0];
    if (!entry || typeof entry !== "object") return null;
    return entry;
  }

  // WeekStatus — the current program week: position, plan/completed
  // quantities, and a neutral status. No outcome inference: a partial week is
  // never a verdict.
  function buildWeekStatus(program, meta, log, now) {
    const norm = normalizeProgram(program, meta);
    const today = isoDate(now);
    if (!norm.started || !today) {
      return { week: null, start: null, end: null, plannedSessions: norm.plannedSessionsPerWeek,
        completedSessions: 0, plannedWorkingSets: norm.plannedWorkingSetsPerWeek, completedWorkingSets: 0,
        status: "not-started", outcome: undefined };
    }
    const days = Math.floor((dateAtNoon(today) - dateAtNoon(norm.started)) / DAY_MS);
    if (days >= norm.weeks * 7) {
      return { week: norm.weeks, start: null, end: null, plannedSessions: 0, completedSessions: 0,
        plannedWorkingSets: 0, completedWorkingSets: 0, status: "complete", outcome: undefined };
    }
    const elapsedWeek = Math.floor(days / 7) + 1;
    const start = addDays(norm.started, (elapsedWeek - 1) * 7);
    const end = addDays(start, 6);
    const rows = rowsInRange(log, start, end);
    const rx = weekPrescription(meta, elapsedWeek - 1);
    return {
      week: elapsedWeek,
      start,
      end,
      plannedSessions: rx?.plannedSessions ?? norm.plannedSessionsPerWeek,
      completedSessions: countSessions(rows),
      plannedWorkingSets: rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek,
      completedWorkingSets: countWorkingSets(rows),
      status: "in-progress",
      outcome: undefined,
    };
  }

  // ActionItem[] — program-wide actions backed by sufficient evidence only.
  // Facts come from the authoritative progression layer; zero or insufficient
  // evidence produces an empty queue, never "attention".
  function buildProgramActionQueue(program, meta, log, progressionFacts) {
    const facts = Array.isArray(progressionFacts) ? progressionFacts : [];
    const items = [];
    const seen = new Set();
    for (const fact of facts) {
      if (!fact || fact.evidenceState !== "sufficient") continue;
      if (!OUTCOMES.includes(fact.outcome)) continue;
      const id = String(fact.exerciseId ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id: `action:${id}`,
        destinationId: id,
        recommendation: RECOMMENDATIONS.includes(fact.recommendation) ? fact.recommendation : OUTCOME_TO_RECOMMENDATION[fact.outcome],
        rationaleCodes: Array.isArray(fact.reasonCodes) ? fact.reasonCodes.slice() : [],
        evidenceCount: Number.isFinite(fact.evidenceCount) ? fact.evidenceCount : null,
      });
    }
    return items;
  }

  // Checkpoint — the Review lifecycle state. While the block is active the
  // checkpoint is read-only: structuralActions is empty, always. Structural
  // kinds appear only at a completed boundary; performance-derived kinds
  // require sufficient observed outcomes, and recovery eligibility is passed
  // through from the approved policy (never recomputed here).
  function buildReviewCheckpoint(program, meta, log, now) {
    const norm = normalizeProgram(program, meta);
    const today = isoDate(now);
    const facts = Array.isArray(meta?.observedOutcomes) ? meta.observedOutcomes : [];
    const sufficient = facts.filter((f) => f && f.evidenceState === "sufficient" && OUTCOMES.includes(f.outcome));
    const base = {
      start: norm.started,
      totalWeeks: norm.weeks,
      elapsedWeek: elapsedWeekOf(norm.started, today, norm.weeks),
      observedOutcomes: sufficient.map((f) => ({ exerciseId: String(f.exerciseId ?? ""), outcome: f.outcome })),
      hasSufficientEvidence: sufficient.length > 0,
    };
    if (!norm.started) return { ...base, lifecycle: "no-block", end: null, structuralActions: [] };
    const end = addDays(norm.started, norm.weeks * 7 - 1);
    const days = Math.floor((dateAtNoon(today) - dateAtNoon(norm.started)) / DAY_MS);
    const isComplete = meta?.mesocycleStatus === "completed" || (Number.isFinite(days) && days >= norm.weeks * 7);
    if (!isComplete) return { ...base, lifecycle: "active-block", end, structuralActions: [] };
    // "repeat" is the neutral continue path: always available at a completed
    // boundary, never performance-derived. progress/review are gated on
    // sufficient observed outcomes.
    const actions = ["repeat", "schedule-repair", "reduce-volume", "guided-edit"];
    if (sufficient.some((f) => f.outcome === "improved")) actions.unshift("progress");
    if (sufficient.some((f) => f.outcome === "maintained")) actions.unshift("repeat");
    if (sufficient.some((f) => f.outcome === "declined")) actions.unshift("review");
    if (meta?.recoveryEligible === true) actions.unshift("recovery-week");
    return { ...base, lifecycle: "block-complete", end, structuralActions: actions };
  }

  // EvidenceSeries — strength evidence for one exercise under one scope.
  // Points are per-session representative values (caller-provided capacity or
  // the session's top load). 0/1 compatible points are insufficient
  // baseline-building; presentation stays empty/snapshot/comparison/trend.
  // The outcome is never computed here — it arrives through meta.facts.
  function buildStrengthEvidence(scope, exerciseId, log, meta) {
    const started = isoDate(meta?.started) || null;
    const useBlock = scope === "current-block" && started;
    const matches = (row) => {
      const rowId = String(row.exerciseId ?? row.exercise ?? row.name ?? "");
      return rowId === String(exerciseId);
    };
    const bySession = new Map();
    let excludedHardRows = 0;
    for (const row of rowsInRange(log, useBlock ? started : null, null)) {
      if (!row || !matches(row)) continue;
      if (!isWorkingRow(row)) {
        if (Number(row.load) > 0) excludedHardRows++;
        continue;
      }
      const key = String(row.session ?? row.date);
      const value = Number.isFinite(row.capacity) ? row.capacity : Number(row.load);
      const prev = bySession.get(key);
      if (!prev) bySession.set(key, { session: key, date: isoDate(row.date), value });
      else if (value > prev.value) prev.value = value;
    }
    const points = [...bySession.values()].sort((a, b) =>
      a.date === b.date ? String(a.session).localeCompare(String(b.session)) : a.date.localeCompare(b.date));
    const count = points.length;
    const fact = meta?.facts?.[String(exerciseId)];
    const series = {
      scope: useBlock ? "current-block" : String(scope),
      exerciseId: String(exerciseId),
      points,
      evidenceCount: count,
      presentation: count === 0 ? "empty" : count === 1 ? "snapshot" : count === 2 ? "comparison" : "trend",
      evidenceState: count >= 2 ? "sufficient" : "insufficient",
      reason: count === 0 ? (excludedHardRows > 0 ? "missing-effort" : "untested") : count === 1 ? "single-observation" : null,
      outcome: undefined,
    };
    if (series.evidenceState === "sufficient" && fact && OUTCOMES.includes(fact.outcome)) series.outcome = fact.outcome;
    return series;
  }

  // VolumeComparison — completed hard sets against the matching plan period.
  // "this-week" uses the program-week boundary; "block-to-date" sums the
  // canonical weekly prescriptions for the elapsed numbered block weeks,
  // capped at the block length, honoring applied weekPrescription overrides.
  // A fixed 28-day window is never a substitute.
  function buildVolumeEvidence(scope, program, meta, log, now) {
    const norm = normalizeProgram(program, meta);
    const today = isoDate(now);
    if (scope === "this-week") {
      if (!norm.started || !today) {
        return { scope, period: { start: null, end: null, elapsedNumberedWeeks: 0, plannedSessions: 0, plannedWorkingSets: 0, periodStatus: "not-started" },
          start: null, end: null, completedSessions: 0, completedWorkingSets: 0, plannedSessions: 0, plannedWorkingSets: 0,
          periodStatus: "not-started", evidenceState: "insufficient", reason: "not-started" };
      }
      const days = Math.floor((dateAtNoon(today) - dateAtNoon(norm.started)) / DAY_MS);
      const start = weekStartOf(days >= 0 ? today : norm.started);
      const end = addDays(start, 6);
      const rows = rowsInRange(log, start, end);
      const rx = weekPrescription(meta, 0);
      return {
        scope,
        period: { start, end, elapsedNumberedWeeks: 1, plannedSessions: rx?.plannedSessions ?? norm.plannedSessionsPerWeek,
          plannedWorkingSets: rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek, periodStatus: "in-progress" },
        start, end,
        completedSessions: countSessions(rows),
        completedWorkingSets: countWorkingSets(rows),
        plannedSessions: rx?.plannedSessions ?? norm.plannedSessionsPerWeek,
        plannedWorkingSets: rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek,
        periodStatus: "in-progress",
        evidenceState: countWorkingSets(rows) > 0 ? "sufficient" : "insufficient",
        reason: countWorkingSets(rows) > 0 ? null : "untested",
      };
    }
    // block-to-date
    if (!norm.started || !today) {
      return { scope, period: { start: null, end: null, elapsedNumberedWeeks: 0, plannedSessions: 0, plannedWorkingSets: 0, periodStatus: "not-started" },
        start: null, end: null, completedSessions: 0, completedWorkingSets: 0, plannedSessions: 0, plannedWorkingSets: 0,
        periodStatus: "not-started", evidenceState: "insufficient", reason: "not-started" };
    }
    const days = Math.floor((dateAtNoon(today) - dateAtNoon(norm.started)) / DAY_MS);
    if (days < 0) {
      return { scope, period: { start: norm.started, end: null, elapsedNumberedWeeks: 0, plannedSessions: 0, plannedWorkingSets: 0, periodStatus: "not-started" },
        start: norm.started, end: null, completedSessions: 0, completedWorkingSets: 0, plannedSessions: 0, plannedWorkingSets: 0,
        periodStatus: "not-started", evidenceState: "insufficient", reason: "not-started" };
    }
    const elapsed = Math.min(Math.floor(days / 7) + 1, norm.weeks);
    const start = norm.started;
    const end = today;
    const rows = rowsInRange(log, start, end);
    let plannedWorkingSets = 0, plannedSessions = 0;
    for (let i = 0; i < elapsed; i++) {
      const rx = weekPrescription(meta, i);
      plannedWorkingSets += rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek;
      plannedSessions += rx?.plannedSessions ?? norm.plannedSessionsPerWeek;
    }
    const completed = countWorkingSets(rows);
    return {
      scope,
      period: { start, end, elapsedNumberedWeeks: elapsed, plannedSessions, plannedWorkingSets, periodStatus: "in-progress" },
      start, end,
      completedSessions: countSessions(rows),
      completedWorkingSets: completed,
      plannedSessions,
      plannedWorkingSets,
      periodStatus: "in-progress",
      evidenceState: completed > 0 ? "sufficient" : "insufficient",
      reason: completed > 0 ? null : "untested",
    };
  }

  // PREntry[] — load-top personal records inside a scope. A session's top
  // load strictly above every earlier in-scope session's top load is one PR
  // entry. (e1RM/PR detection that needs engine math stays in app.js; this
  // covers the presentation-level load record with locale dates applied by
  // the renderer, not here.)
  function buildPREvidence(scope, log, meta) {
    const started = isoDate(meta?.started) || null;
    const useBlock = scope === "current-block" && started;
    const byKey = new Map();
    for (const row of rowsInRange(log, useBlock ? started : null, null)) {
      if (!isWorkingRow(row)) continue;
      const key = String(row.exerciseId ?? row.exercise ?? row.name ?? "");
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(row);
    }
    const entries = [];
    for (const [key, rows] of byKey) {
      const bySession = new Map();
      for (const row of rows) {
        const skey = String(row.session ?? row.date);
        const value = Number(row.load);
        const prev = bySession.get(skey);
        if (!prev) bySession.set(skey, { date: isoDate(row.date), value, session: skey });
        else if (value > prev.value) { prev.value = value; prev.date = isoDate(row.date); }
      }
      const sessions = [...bySession.values()].sort((a, b) =>
        a.date === b.date ? a.session.localeCompare(b.session) : a.date.localeCompare(b.date));
      let best = null;
      for (const s of sessions) {
        if (best == null) { best = s; continue; }
        if (s.value > best.value) {
          entries.push({ exerciseId: key, date: s.date, value: s.value, priorValue: best.value, kind: "load" });
          best = s;
        }
      }
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date) || a.exerciseId.localeCompare(b.exerciseId));
  }

  const api = {
    MODEL_VERSION,
    OUTCOMES,
    RECOMMENDATIONS,
    EVIDENCE_STATES,
    OUTCOME_TO_RECOMMENDATION,
    buildWeekStatus,
    buildProgramActionQueue,
    buildReviewCheckpoint,
    buildStrengthEvidence,
    buildVolumeEvidence,
    buildPREvidence,
  };
  Object.freeze(api);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgressModel = api;
})(typeof self !== "undefined" ? self : this);
