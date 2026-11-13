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
  const EVIDENCE_SCOPES = Object.freeze(["current-block", "all-history"]);

  // Recommendation verb for a sufficient observed outcome. This is the
  // vocabulary separation (G-24), not progression math: the engine still owns
  // whether an outcome happened at all.
  const OUTCOME_TO_RECOMMENDATION = Object.freeze({
    improved: "progress",
    maintained: "repeat",
    declined: "review",
  });

  const DEFAULT_INSUFFICIENT_REASON = "untested";

  const DAY_MS = 86400000;

  // Canonical evidence record shared by the producer, lifecycle model, and
  // renderers. `scope` is nullable only for old in-memory callers; production
  // records always carry it so an all-history record cannot leak into a
  // current-block surface. A sufficient record is deliberately strict: it is
  // an assertion that the authoritative comparison produced an outcome, not a
  // count-based presentation guess.
  function normalizeEvidenceRecord(record, defaultScope = null) {
    if (!record || !EVIDENCE_STATES.includes(record.evidenceState)) return null;
    const exerciseId = String(record.exerciseId ?? "");
    if (!exerciseId) return null;
    const scope = EVIDENCE_SCOPES.includes(record.scope)
      ? record.scope
      : EVIDENCE_SCOPES.includes(defaultScope) ? defaultScope : null;
    const evidenceCount = Number.isInteger(record.evidenceCount) && record.evidenceCount >= 0
      ? record.evidenceCount : 0;
    const normalized = {
      exerciseId,
      scope,
      evidenceState: record.evidenceState,
      evidenceCount,
      reason: record.evidenceState === "insufficient"
        ? String(record.reason ?? "").trim() || DEFAULT_INSUFFICIENT_REASON
        : null,
    };
    if (record.evidenceState === "sufficient") {
      if (evidenceCount < 2 || !OUTCOMES.includes(record.outcome)) return null;
      const expectedRecommendation = OUTCOME_TO_RECOMMENDATION[record.outcome];
      if (record.recommendation !== undefined && record.recommendation !== expectedRecommendation) return null;
      normalized.outcome = record.outcome;
      normalized.recommendation = expectedRecommendation;
    }
    if (Array.isArray(record.reasonCodes)) {
      normalized.reasonCodes = record.reasonCodes.filter((code) => typeof code === "string").slice();
    }
    return normalized;
  }

  function normalizeEvidenceRecords(records, { scope = null } = {}) {
    if (!Array.isArray(records)) return [];
    return records.flatMap((record) => {
      const normalized = normalizeEvidenceRecord(record, scope);
      return normalized ? [normalized] : [];
    });
  }

  function isoDate(value) {
    return String(value == null ? "" : value).slice(0, 10);
  }

  // Workout date is the domain chronology. `created` is optional metadata
  // useful for ordering sessions recorded on the same workout date, but it
  // must never move a later dated workout before an earlier one. When only
  // one same-day session has creation metadata, fall back to the stable
  // session identity instead of treating a missing timestamp as earliest.
  function compareChronology(a, b) {
    const dateOrder = isoDate(a?.date).localeCompare(isoDate(b?.date));
    if (dateOrder) return dateOrder;
    const aCreated = a?.created == null ? "" : String(a.created).trim();
    const bCreated = b?.created == null ? "" : String(b.created).trim();
    if (aCreated && bCreated) {
      const createdOrder = aCreated.localeCompare(bCreated);
      if (createdOrder) return createdOrder;
    }
    const aSession = String(a?.sessionKey ?? a?.session ?? a?.id ?? "");
    const bSession = String(b?.sessionKey ?? b?.session ?? b?.id ?? "");
    const sessionOrder = aSession.localeCompare(bSession);
    if (sessionOrder) return sessionOrder;
    const aSet = Number.isFinite(Number(a?.set)) ? Number(a.set) : 0;
    const bSet = Number.isFinite(Number(b?.set)) ? Number(b.set) : 0;
    return aSet - bSet;
  }

  function dateAtNoon(value) {
    return new Date(`${isoDate(value)}T12:00:00`);
  }

  // Canonical numbered-day distance between two ISO dates: whole calendar
  // days from `from` to `to` (negative when `to` is earlier), NaN when either
  // is not a valid YYYY-MM-DD. Both dates are placed on UTC midnight, so the
  // difference is an exact multiple of DAY_MS; elapsed local milliseconds
  // would lose an hour across a spring DST change and floor to one day short.
  function calendarDayDistance(from, to) {
    const parse = (value) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate(value));
      if (!m) return NaN;
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      const t = Date.UTC(y, mo - 1, d);
      const check = new Date(t);
      return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? t : NaN;
    };
    return Math.round((parse(to) - parse(from)) / DAY_MS);
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
    return row && row.work !== false && row.warmup !== true && Number(row.load) > 0 && Number(row.reps) > 0;
  }

  function isHardWorkingRow(row, hardRir = 4) {
    const rir = Number(row?.rir);
    return isWorkingRow(row) && Number.isFinite(rir) && rir <= Number(hardRir);
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

  function belongsToBlock(row, meta) {
    const blockId = String(meta?.blockId ?? "").trim();
    if (!blockId) return true;
    // A modern active block must have provenance on every row. Missing blockId
    // is legacy data, not evidence for the current block.
    return String(row?.blockId ?? "").trim() === blockId;
  }

  function scopedRows(log, start, end, meta) {
    return rowsInRange(log, start, end).filter((row) => belongsToBlock(row, meta));
  }

  function countSessions(rows) {
    return new Set(rows.filter(isWorkingRow).map((r) => r.session ?? r.date)).size;
  }

  function countWorkingSets(rows) {
    return rows.filter(isWorkingRow).length;
  }

  function completedHardRows(log, start, end, hardRir, meta) {
    return scopedRows(log, start, end, meta).filter((row) => isHardWorkingRow(row, hardRir));
  }

  function elapsedWeekOf(started, now, weeks) {
    if (!started) return null;
    const days = calendarDayDistance(started, now);
    if (Number.isNaN(days)) return null;
    return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weeks);
  }

  function weekPrescription(meta, weekIndex0) {
    const list = Array.isArray(meta?.weekPrescriptions) ? meta.weekPrescriptions : [];
    const numbered = list.some((item) => Number.isInteger(item?.week));
    const entry = numbered
      ? list.find((item) => item?.week === weekIndex0 + 1)
      : list[weekIndex0];
    if (!entry || typeof entry !== "object") return null;
    return entry;
  }

  function validPlannedVolumeHistory(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1 ||
        !Number.isInteger(value.throughWeek) || value.throughWeek < 0 || value.throughWeek > 52 ||
        !Number.isFinite(value.plannedSessions) || value.plannedSessions < 0 ||
        !Number.isFinite(value.plannedWorkingSets) || value.plannedWorkingSets < 0 ||
        !value.muscles || typeof value.muscles !== "object" || Array.isArray(value.muscles)) return false;
    return ["direct", "secondary"].every((kind) => {
      const map = value.muscles[kind];
      return map && typeof map === "object" && !Array.isArray(map) &&
        Object.entries(map).every(([name, amount]) => name && Number.isFinite(amount) && amount >= 0);
    });
  }

  function evidenceBounds(scope, meta) {
    const started = isoDate(meta?.started) || null;
    if (scope !== "current-block" || !started) return { start: null, end: null };
    const weeks = Math.max(1, Number(meta?.mesocycleLengthWeeks) || 6);
    return { start: started, end: addDays(started, weeks * 7 - 1) };
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
    const days = calendarDayDistance(norm.started, today);
    if (days >= norm.weeks * 7) {
      return { week: norm.weeks, start: null, end: null, plannedSessions: 0, completedSessions: 0,
        plannedWorkingSets: 0, completedWorkingSets: 0, status: "complete", outcome: undefined };
    }
    const elapsedWeek = Math.floor(days / 7) + 1;
    const start = addDays(norm.started, (elapsedWeek - 1) * 7);
    const end = addDays(start, 6);
    const rows = scopedRows(log, start, end, meta);
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
    const scope = EVIDENCE_SCOPES.includes(meta?.evidenceScope) ? meta.evidenceScope : "current-block";
    const facts = normalizeEvidenceRecords(progressionFacts, { scope })
      .filter((fact) => fact.scope === scope);
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
  /** Calendar-week facts. Outcomes, stalls and fatigue remain the caller's
   * authoritative calculations, explicitly bound to this week. */
  function buildWeekReview(log, sessionEvents, program, meta, week) {
    const start = weekStartOf(week), end = addDays(start,6);
    const rows = rowsInRange(log,start,end);
    const sessions = new Set(rows.map(row => String(row.session ?? "")).filter(Boolean));
    const authored=meta?.trainingDays || meta?.programDefinition?.days?.filter(day=>day.kind==="training").map(day=>day.name);
    const hasTarget=meta?.completedWeek===false || !meta?.started || isoDate(meta.started)<=start;
    const programExisted=hasTarget || sessions.size>0;
    const days=[...new Set(authored || normalizeProgram(program,meta).exercises.map(exercise=>exercise.day).filter(Boolean))];
    const completedDays = new Set(rows.map(row => row.day));
    const skips = [], pain = [];
    for (const id of sessions) {
      const events = sessionEvents?.[id];
      if (events?.v !== 1) continue;
      for (const event of events.skips || []) skips.push({...event});
      for (const event of events.pain || []) pain.push({...event});
    }
    const facts = meta?.weekFacts?.start === start && meta?.weekFacts?.end === end ? meta.weekFacts : {};
    return {start,end,programExisted,completedSessions:sessions.size,plannedSessions:hasTarget?days.length:null,
      missedDays:!hasTarget || meta?.completedWeek===false?[]:days.filter(day => !completedDays.has(day)),
      outcomes:(facts.outcomes || []).filter(fact => OUTCOMES.includes(fact.outcome)).map(fact => ({...fact})),
      stalled:[...(facts.stalled || [])],fatigue:[...(facts.fatigue || [])],skips,pain,
      trimUsed:skips.some(event => event.reason === "trim")};
  }

  /** Completed-week observations use movement AND slot identity. A replacement
   * in the same slot cannot inherit the original movement's pattern. */
  function detectPatterns(log, sessionEvents, program, meta, week) {
    const end = weekStartOf(week), start = addDays(end, -14);
    const rows = (log || []).filter(row => isoDate(row.date) >= start && isoDate(row.date) < end &&
      (!meta?.blockId || row.blockId === meta.blockId));
    const sessions = new Map();
    for (const row of rows) if (row.session) {
      if (!sessions.has(row.session)) sessions.set(row.session, {date:isoDate(row.date),day:row.day,rows:[]});
      sessions.get(row.session).rows.push(row);
    }
    const exercises = Array.isArray(program) ? program : program?.exercises || [];
    const targets = Array.isArray(meta?.observationTargets) ? meta.observationTargets : exercises.map(exercise => ({
      slotId:exercise.slotId || exercise.id,exerciseId:exercise.libraryId || exercise.movementId || exercise.id,day:exercise.day,
    }));
    const groups = new Map(), days = new Map();
    const observe = (pattern, event, session) => {
      const exercise = targets.find(target => target.slotId === event.slotId && target.exerciseId === event.exerciseId);
      if (!exercise) return;
      const key = `${pattern}:${event.slotId}:${event.exerciseId}`;
      if (!groups.has(key)) groups.set(key, {pattern,slotId:event.slotId,exerciseId:event.exerciseId,name:event.name,day:exercise.day,sessions:new Set()});
      groups.get(key).sessions.add(session);
    };
    for (const [id, session] of sessions) {
      const events = sessionEvents?.[id];
      if (!days.has(session.day)) days.set(session.day, []);
      const daySlots = new Set(exercises.filter(exercise => exercise.day === session.day).map(exercise => exercise.slotId || exercise.id));
      days.get(session.day).push({id,...session,trim:events?.skips?.some(event => event.reason === "trim"),
        flagged:new Set((meta?.fatigueSessions?.[id] || []).filter(slotId => daySlots.has(slotId))).size >= 2});
      for (const event of events?.skips || []) if (event.reason !== "trim") observe("recurring_skip",event,id);
      for (const event of events?.pain || []) observe("recurring_pain",event,id);
    }
    const patterns = [...groups.values()].filter(group => group.sessions.size >= 2)
      .map(({sessions,...pattern}) => ({...pattern,count:sessions.size}));
    for (const [day, entries] of days) {
      const last = entries.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(-3);
      if (last.filter(entry => entry.flagged).length >= 2 || entries.filter(entry => entry.trim).length >= 2) {
        const exercise = exercises.find(ex => ex.day === day);
        if (exercise) patterns.push({pattern:"recurring_fatigue",day,slotId:exercise.slotId || exercise.id,
          exerciseId:exercise.libraryId || exercise.movementId || exercise.id});
      }
    }
    // The caller supplies the existing stall owner's result, bounded to these
    // completed weeks, rather than introducing another performance rule.
    for (const stalled of meta?.hardStalls || []) {
      const exercise = exercises.find(ex => (ex.slotId || ex.id) === stalled.slotId &&
        (ex.libraryId || ex.movementId || ex.id) === stalled.exerciseId);
      if (exercise) patterns.push({pattern:"stall_hard",...stalled,day:exercise.day});
    }
    const order = ["recurring_pain","recurring_skip","recurring_fatigue","stall_hard"];
    return patterns.sort((a,b) => order.indexOf(a.pattern)-order.indexOf(b.pattern) || a.slotId.localeCompare(b.slotId));
  }

  function buildReviewCheckpoint(program, meta, log, now) {
    const norm = normalizeProgram(program, meta);
    const today = isoDate(now);
    const facts = normalizeEvidenceRecords(meta?.evidenceRecords, { scope: "current-block" })
      .filter((fact) => fact.scope === "current-block");
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
    const days = calendarDayDistance(norm.started, today);
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
    return { ...base, lifecycle: "block-complete", end, structuralActions: [...new Set(actions)] };
  }

  // EvidenceSeries — strength evidence for one exercise under one scope.
  // Points are per-session representative numeric load values. Capacity/e1RM
  // facts stay in the progression layer and are never display-load inputs. 0/1 compatible points are insufficient
  // baseline-building; presentation stays empty/snapshot/comparison/trend.
  // The outcome is never computed here — it arrives through meta.evidenceRecords.
  function buildStrengthEvidence(scope, exerciseId, log, meta) {
    const bounds = evidenceBounds(scope, meta);
    const useBlock = scope === "current-block" && bounds.start;
    const matches = (row) => {
      const rowId = String(row.exerciseId ?? row.exercise ?? row.name ?? "");
      return rowId === String(exerciseId);
    };
    const candidates = scopedRows(log, useBlock ? bounds.start : null, useBlock ? bounds.end : null, useBlock ? meta : null)
      .filter((row) => row && matches(row) && row.strengthComparable !== false);
    const conventionKey = (row) => row?.strengthConvention == null ? null : String(row.strengthConvention);
    const latestCompatible = candidates.slice().sort(compareChronology).at(-1);
    const comparisonConvention = latestCompatible ? conventionKey(latestCompatible) : null;
    const bySession = new Map();
    let excludedHardRows = 0;
    let missingEffortRows = 0;
    const sessionKeyFor = (row) => `${String(row.session ?? row.date)}\u0000${String(row.blockId ?? "")}`;
    for (const row of candidates) {
      if (conventionKey(row) !== comparisonConvention) continue;
      if (!isWorkingRow(row)) {
        if (Number(row.load) > 0) excludedHardRows++;
        continue;
      }
      const key = sessionKeyFor(row);
      // Strength's visible value is a load. Capacity/e1RM facts belong to the
      // progression engine and must never be sent through the load formatter.
      const value = Number(row.load);
      if (row.rir == null || row.rir === "" || !Number.isFinite(Number(row.rir))) missingEffortRows++;
      const prev = bySession.get(key);
      if (!prev) bySession.set(key, { session: String(row.session ?? row.date), sessionKey: key,
        date: isoDate(row.date), created: row.created ?? null, value, reps: Number(row.reps),
        strengthConvention: comparisonConvention });
      else if (value > prev.value || (value === prev.value && Number(row.reps) > prev.reps)) {
        prev.date = isoDate(row.date);
        prev.created = row.created ?? prev.created;
        prev.value = value;
        prev.reps = Number(row.reps);
      }
    }
    const points = [...bySession.values()].sort(compareChronology);
    const count = points.length;
    const evidenceScope = useBlock ? "current-block" : String(scope);
    const fact = normalizeEvidenceRecords(meta?.evidenceRecords)
      .find((record) => record.exerciseId === String(exerciseId) &&
        (record.scope === null || record.scope === evidenceScope));
    const series = {
      scope: evidenceScope,
      exerciseId: String(exerciseId),
      comparisonConvention,
      points,
      evidenceCount: count,
      presentation: count === 0 ? "empty" : count === 1 ? "snapshot" : count === 2 ? "comparison" : "trend",
      // A point count describes presentation shape, not evidence validity.
      // Only the producer's authoritative comparable-exposure fact can make a
      // series sufficient; otherwise it remains neutral baseline-building.
      evidenceState: fact?.evidenceState ?? "insufficient",
      reason: fact?.reason ?? (count === 0 ? (excludedHardRows > 0 ? "missing-effort" : "untested") :
        count === 1 ? "single-observation" : missingEffortRows > 0 ? "missing-effort" : "untested"),
      outcome: undefined,
      latest: count ? { ...points.at(-1) } : null,
      comparison: count === 2 ? {
        from: points[0].value,
        to: points[1].value,
        absolute: points[1].value - points[0].value,
        percentage: points[0].value === 0 ? null : (points[1].value - points[0].value) / points[0].value * 100,
      } : null,
    };
    if (series.evidenceState === "sufficient" && fact && OUTCOMES.includes(fact.outcome)) series.outcome = fact.outcome;
    if (series.evidenceState === "sufficient") series.reason = null;
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
      const days = calendarDayDistance(norm.started, today);
      const beyondBlock = days >= norm.weeks * 7;
      const weekIndex = Math.min(Math.max(0, Math.floor(days / 7)), norm.weeks - 1);
      const start = addDays(norm.started, weekIndex * 7);
      const end = addDays(start, 6);
      const rows = scopedRows(log, start, end, meta);
      const completedRows = completedHardRows(log, start, end, meta?.hardRir, meta);
      const rx = weekPrescription(meta, weekIndex);
      return {
        scope,
        period: { start, end, elapsedNumberedWeeks: 1, plannedSessions: rx?.plannedSessions ?? norm.plannedSessionsPerWeek,
          plannedWorkingSets: rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek,
          weekNumber: weekIndex + 1, periodStatus: beyondBlock ? "complete" : "in-progress" },
        start, end,
        completedSessions: countSessions(rows),
        completedWorkingSets: completedRows.length,
        completedRows,
        plannedSessions: rx?.plannedSessions ?? norm.plannedSessionsPerWeek,
        plannedWorkingSets: rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek,
        periodStatus: beyondBlock ? "complete" : "in-progress",
        evidenceState: completedRows.length > 0 ? "sufficient" : "insufficient",
        reason: completedRows.length > 0 ? null : "untested",
      };
    }
    // block-to-date
    if (!norm.started || !today) {
      return { scope, period: { start: null, end: null, elapsedNumberedWeeks: 0, plannedSessions: 0, plannedWorkingSets: 0, periodStatus: "not-started" },
        start: null, end: null, completedSessions: 0, completedWorkingSets: 0, completedRows: [], plannedSessions: 0, plannedWorkingSets: 0,
        periodStatus: "not-started", evidenceState: "insufficient", reason: "not-started" };
    }
    const days = calendarDayDistance(norm.started, today);
    if (days < 0) {
      return { scope, period: { start: norm.started, end: null, elapsedNumberedWeeks: 0, plannedSessions: 0, plannedWorkingSets: 0, periodStatus: "not-started" },
        start: norm.started, end: null, completedSessions: 0, completedWorkingSets: 0, completedRows: [], plannedSessions: 0, plannedWorkingSets: 0,
        periodStatus: "not-started", evidenceState: "insufficient", reason: "not-started" };
    }
    const complete = days >= norm.weeks * 7;
    const elapsed = Math.min(Math.floor(days / 7) + 1, norm.weeks);
    const start = norm.started;
    const end = complete ? addDays(norm.started, norm.weeks * 7 - 1) : today;
    const rows = scopedRows(log, start, end, meta);
    let plannedWorkingSets = 0, plannedSessions = 0;
    const history = validPlannedVolumeHistory(meta?.plannedVolumeHistory) &&
      meta.plannedVolumeHistory.throughWeek <= elapsed ? meta.plannedVolumeHistory : null;
    const historyWeeks = history?.throughWeek || 0;
    if (history) {
      plannedWorkingSets = history.plannedWorkingSets;
      plannedSessions = history.plannedSessions;
    }
    for (let i = historyWeeks; i < elapsed; i++) {
      const rx = weekPrescription(meta, i);
      plannedWorkingSets += rx?.plannedWorkingSets ?? norm.plannedWorkingSetsPerWeek;
      plannedSessions += rx?.plannedSessions ?? norm.plannedSessionsPerWeek;
    }
    const completedRows = completedHardRows(log, start, end, meta?.hardRir, meta);
    const completed = completedRows.length;
    return {
      scope,
      period: { start, end, elapsedNumberedWeeks: elapsed, plannedSessions, plannedWorkingSets,
        periodStatus: complete ? "complete" : "in-progress" },
      start, end,
      completedSessions: countSessions(rows),
      completedWorkingSets: completed,
      completedRows,
      plannedSessions,
      plannedWorkingSets,
      periodStatus: complete ? "complete" : "in-progress",
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
    const bounds = evidenceBounds(scope, meta);
    const useBlock = scope === "current-block" && bounds.start;
    const byKey = new Map();
    for (const row of scopedRows(log, useBlock ? bounds.start : null, useBlock ? bounds.end : null, useBlock ? meta : null)) {
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
        const skey = `${String(row.session ?? row.date)}\u0000${String(row.blockId ?? "")}`;
        const value = Number(row.load);
        const prev = bySession.get(skey);
        if (!prev) bySession.set(skey, {
          date: isoDate(row.date), created: row.created ?? null, value,
          session: String(row.session ?? row.date), sessionKey: skey,
        });
        else {
          if (value > prev.value) prev.value = value;
          if (!prev.created && row.created) prev.created = row.created;
          if (!prev.date && row.date) prev.date = isoDate(row.date);
        }
      }
      const sessions = [...bySession.values()].sort(compareChronology);
      let best = null;
      for (const s of sessions) {
        if (best == null) { best = s; continue; }
        if (s.value > best.value) {
          entries.push({ exerciseId: key, date: s.date, created: s.created, session: s.session,
            sessionKey: s.sessionKey, value: s.value, priorValue: best.value, kind: "load" });
          best = s;
        }
      }
    }
    return entries.sort((a, b) => compareChronology(a, b) || a.exerciseId.localeCompare(b.exerciseId));
  }

  const PROFILE_VERSION = "profile@084.2";
  const PROFILE_WEIGHTS = Object.freeze({ date: 0.75, transition: 8, dateCap: 64, transitions: 4 });

  /** Pure projection of acknowledged rows. `lifts` supplies current performed-capacity descriptors
   * {exerciseId, metricType, metricIds, metricDefinitions, loadingModel, context, name}.
   * Historical descriptors come only from captured rows, never today's prescription or a draft.
   * Archived identities remain in `lifts`; only active identities contribute to fill. */
  function buildSavedProfile({ log = [], lifts = [], now } = {}) {
    const Engine = root?.RepForgeProgression || (typeof require === "function" ? require("./progression-engine.js") : null);
    const Calibration = root?.RepForgeEffortCalibration || (typeof require === "function" ? require("./effort-calibration.js") : null);
    const Draft = root?.RepForgeWorkoutDraft || (typeof require === "function" ? require("./workout-draft.js") : null);
    const validDate = date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
    const Quality = root?.RepForgeCalibrationGauge || (typeof require === "function" ? require("./calibration-gauge.js") : null);
    const entries = new Map();
    for (const [index, lift] of lifts.entries()) {
      const key = Engine.savedLiftIdentity(lift) || `unsupported:${index}`;
      if (!entries.has(key)) entries.set(key, { key, descriptor: lift, active: true, rows: [] });
    }
    let unsupportedRows = 0;
    const seen = new Set();
    for (const row of log.filter(row => row && validDate(row.date) && row.date <= now)
      .slice().sort(compareChronology)) {
      if (row.warmup || row.origin === "ramp" || row.work === false) continue;
      const descriptor = { exerciseId: row.performedLibraryId || row.performedMovementId,
        metricType: row.metricType, metricIds: row.metricIds, metricDefinitions: row.metricDefinitions,
        loadingModel: row.loadingModel || { bodyweightCoefficient: row.loadingContext?.bodyweightCoefficient },
        context: row.loadingContext && { ...row.loadingContext, equipmentId: row.equipmentId,
          loadingConvention: row.loadingConvention }, name: row.performedName || row.name };
      const key = Engine.savedLiftIdentity(descriptor);
      if (!key || !row.session || !row.loadingConvention) { unsupportedRows++; continue; }
      const rowKey = JSON.stringify([key, row.session, row.exerciseId, row.setIndex]);
      if (seen.has(rowKey)) continue;
      seen.add(rowKey);
      if (!entries.has(key)) entries.set(key, { key, descriptor, active: false, rows: [] });
      entries.get(key).rows.push({ ...row, exerciseId: descriptor.exerciseId, completed: true });
    }
    const projected = [];
    for (const entry of entries.values()) {
      const sessions = new Map();
      for (const row of entry.rows) {
        if (!sessions.has(row.session)) sessions.set(row.session, { sessionId: row.session, date: row.date, completed: true, sets: [] });
        sessions.get(row.session).sets.push(row);
      }
      const history = [...sessions.values()];
      // Each original boundary uses its own captured context, including bodyweight. No historical target is needed.
      const prefix = [], depth = new Map(), transitions = [], checks = [], dates = new Map();
      let depthSteps = 0;
      let historicalSolid = false, anchor = null, understoodStage = null;
      const add = (stage, date) => transitions.push({ stage, date });
      const calibrationFor = (read, today) => Calibration.estimate(Calibration.checkErrors({ today,
        sessions: read.sessions.map(session => ({ date: session.date, checks: session.sets
          .filter(set => set.effortSource === "failure" && Draft.validCalibration(set.calibration))
          .map(set => ({ predictedReps: set.calibration.predictedReps, reps: set.reps })) })) }));
      for (const session of history) {
        prefix.push(session);
        const captured = session.sets[0];
        const descriptor = { ...entry.descriptor, context: { ...captured.loadingContext,
          equipmentId: captured.equipmentId, loadingConvention: captured.loadingConvention } };
        const initial = Engine.readSavedLift(descriptor, prefix, { now: session.date });
        if (!initial.available) continue;
        const calibration = calibrationFor(initial, session.date);
        const read = Engine.readSavedLift(descriptor, prefix, { now: session.date, calibration });
        const saved = read.sessions.find(item => item.sessionId === session.sessionId);
        for (const set of saved?.sets || []) {
          if (!anchor) anchor = { date: session.date, load: set.displayLoadKg, opening: set.startingLoad?.openingKg ?? null };
          const q = Quality.rowQuality(set);
          if (q > 0) {
            const date = dates.get(session.date) || { rows: 0, weight: 0 };
            dates.set(session.date, { rows: date.rows + 1, weight: date.weight + q });
          }
          if (set.effortSource === "failure" && Draft.validCalibration(set.calibration))
            checks.push({ date: session.date, sessionId: session.sessionId,
              guess: set.calibration.predictedReps, reps: set.reps });
        }
        const dateEvidence = dates.get(session.date);
        if (dateEvidence?.rows >= 2) {
          const step = Math.min(1, dateEvidence.weight / 2);
          depthSteps += step - (depth.get(session.date) || 0);
          depth.set(session.date, step);
        }
        const standing = read.standing;
        if (depth.size && !standing?.unavailable && ["learning", "solid"].includes(standing?.word) && transitions.length === 0)
          add("learning", session.date);
        if (standing?.word === "solid" && !standing.unavailable) historicalSolid = true;
        if (transitions.length === 1 && historicalSolid) add("solid", session.date);
        if (transitions.length === 2 && (checks.length || depthSteps >= 32))
          add(checks.length ? "checked" : "long_record", session.date);
        const understood = calibration.n >= Calibration.ESTIMATOR.minChecks && calibration.spread <= Calibration.ESTIMATOR.calibratedSpread &&
          ["calibrated", "under", "over"].includes(calibration.state);
        if (understood && !understoodStage) understoodStage = calibration.state === "calibrated" ? "calibrated" : "bias_understood";
        if (transitions.length === 3 && (understoodStage || depthSteps >= PROFILE_WEIGHTS.dateCap))
          add(understoodStage || "established", session.date);
      }
      const initial = Engine.readSavedLift(entry.descriptor, history, { now });
      const calibration = calibrationFor(initial, now);
      const current = Engine.readSavedLift(entry.descriptor, history, { now, calibration });
      const stageUnits = transitions.length * PROFILE_WEIGHTS.transition;
      const dateUnits = Math.min(PROFILE_WEIGHTS.dateCap, depthSteps) * PROFILE_WEIGHTS.date;
      projected.push({ key: entry.key, name: entry.descriptor.name || entry.descriptor.exerciseId,
        active: entry.active, stage: transitions.length === 4 && understoodStage ? understoodStage
          : transitions.length === 3 && checks.length ? "checked" : transitions.at(-1)?.stage || "first", transitions,
        anchor, depthDates: [...depth.keys()].sort(), depthSteps, checks, stageUnits, dateUnits, units: stageUnits + dateUnits,
        current: { available: current.available, reasons: current.reasons, standing: current.standing, calibration } });
    }
    const active = projected.filter(lift => lift.active);
    const budgetPerLift = PROFILE_WEIGHTS.date * PROFILE_WEIGHTS.dateCap + PROFILE_WEIGHTS.transition * PROFILE_WEIGHTS.transitions;
    const budget = active.length * budgetPerLift, units = active.reduce((sum, lift) => sum + lift.units, 0);
    return { version: PROFILE_VERSION, standingVersion: Engine.STANDING_VERSION, calibrationVersion: Calibration.CALIBRATION_VERSION,
      lifts: projected, scope: active.map(lift => lift.key).sort(), unsupportedRows, units, budget, fill: budget ? units / budget : 0 };
  }

  const FINDINGS_VERSION = "findings@081.1";
  const FINDING_IDS = Object.freeze(["weights_found", "first_target", "first_check", "effort_read",
    "first_solid", "first_trend", "month_one"]);

  // `standings(rows, asOf)` replays the authoritative engine on exactly this
  // prefix. Each reading has key/name, recommendation, standing, calibration,
  // weekly pairs and an observed `improved` fact. Keeping the adapter at
  // the caller preserves the model's pure boundary and the engine's sole
  // ownership of comparability, standing and effort thresholds.
  function buildFindings(log, program, meta, now, standings = () => []) {
    const today = isoDate(now);
    const keyOf = (row) => String(row.performedLibraryId || row.performedMovementId ||
      row.sourceLibraryId || row.performedName || row.name || "");
    const nameOf = (row) => String(row.performedName || row.name || keyOf(row));
    const working = (row) => row && row.warmup !== true && row.origin !== "ramp" && row.work !== false;
    const rows = (log || []).filter((row) => working(row) &&
      Number.isFinite(calendarDayDistance(row.date, today)) && isoDate(row.date) <= today).slice().sort(compareChronology);
    const lifts = [...new Map((program || []).map((ex) => [String(ex.libraryId || ex.name || ""), ex])).entries()]
      .filter(([key]) => key).map(([key, ex]) => ({ key, name: ex.name || key }));
    const released = new Map();
    const release = (id, date, data = {}) => {
      if (!released.has(id)) released.set(id, { id, date: isoDate(date), ...data });
    };
    const sessions = new Map();
    for (const row of rows) {
      const id = String(row.session || row.date);
      if (!sessions.has(id)) sessions.set(id, []);
      sessions.get(id).push(row);
    }
    const prefix = [], seenKeys = new Set(), checkCounts = new Map();
    const read = (history, date, request) => standings(history.slice(), date, request) || [];
    const hasAnchor = (fact) => fact.recommendation?.historyAnchor?.source === "history";
    const weights = (history, facts) => new Set([
      ...history.filter((row) => row.startingLoad).map(keyOf),
      ...facts.filter(hasAnchor).map((fact) => fact.key),
    ]);
    for (const session of sessions.values()) {
      const date = isoDate(session[0].date);
      prefix.push(...session);
      for (const row of session) {
        seenKeys.add(keyOf(row));
        if (row.effortSource === "failure" && row.calibration) checkCounts.set(keyOf(row), (checkCounts.get(keyOf(row)) || 0) + 1);
      }
      // Released facts never need their historical engine work repeated. Checks
      // cannot produce a reading until three exist; the current and month reads
      // below still refresh every lift at their exact as-of date.
      const checkingWeights = !released.has("weights_found") && (prefix.some((row) => row.startingLoad) ||
        lifts.length > 0 && lifts.every((lift) => seenKeys.has(lift.key)));
      const recommendation = checkingWeights || ["first_target", "first_solid"].some((id) => !released.has(id));
      const weeks = !released.has("first_trend") && weekStartOf(prefix[0].date) !== weekStartOf(date);
      const calibrationKeys = !released.has("effort_read") ? [...checkCounts].filter(([, n]) => n >= 3).map(([key]) => key) : [];
      const calibration = calibrationKeys.length > 0;
      const after = recommendation || weeks || calibration ? read(prefix, date, {
        recommendation, weeks, calibration,
        keys: checkingWeights ? null : [...new Set([...session.map(keyOf), ...calibrationKeys])],
      }) : [];
      // This saved session can support the next target immediately. Replay
      // only this prefix so no later session can supply its reason or values.
      const target = after.find((fact) => hasAnchor(fact) && fact.recommendation?.reasonCodes?.includes("history_anchor") &&
        fact.recommendation.status === "recommended");
      if (target) {
        const rec = target.recommendation;
        const anchor = prefix.find((row) => String(row.session) === String(rec.historyAnchor.sessionId) && keyOf(row) === target.key);
        const reps = rec.targets?.reps ?? rec.targets?.repsPerSide;
        const load = rec.targets?.[rec.displayLoadSemantic];
        if (anchor && (Number.isFinite(load) || rec.loadingAssumptions?.loadingConvention === "bodyweight") && Number.isFinite(reps)) release("first_target", date,
          { key: target.key, lift: target.name, load: load ?? null, loadingConvention: rec.loadingAssumptions?.loadingConvention, reps, becauseDate: isoDate(anchor.date) });
      }
      const openings = new Set(prefix.filter((row) => row.startingLoad).map(keyOf));
      const anchors = weights(prefix, after);
      if (openings.size || (lifts.length && lifts.every((lift) => anchors.has(lift.key)))) {
        release("weights_found", date, { n: anchors.size });
      }
      const check = session.find((row) => row.effortSource === "failure" && row.calibration &&
        Number.isInteger(row.calibration.predictedReps) && Number(row.reps) > 0);
      if (check) release("first_check", date, { key: keyOf(check), lift: nameOf(check), g: check.calibration.predictedReps, d: Number(check.reps) });
      for (const fact of after) {
        if (["under", "over", "calibrated"].includes(fact.calibration?.state)) release("effort_read", date,
          { key: fact.key, lift: fact.name, state: fact.calibration.state });
        if (fact.standing?.word === "solid") release("first_solid", date,
          { key: fact.key, lift: fact.name, sets: fact.standing.evidence.sets, sessions: fact.standing.evidence.sessions });
        const pair = (fact.weeks || []).slice().sort((a, b) => a.date.localeCompare(b.date))[0];
        if (pair) release("first_trend", pair.date,
          { key: fact.key, lift: fact.name, cap1: pair.before, cap2: pair.after,
            record: (fact.records || []).find((record) => record.date <= pair.date) || null });
      }
    }
    const monthDate = rows.length ? addDays(rows[0].date, 28) : null;
    if (monthDate && monthDate <= today) {
      const monthRows = rows.filter((row) => isoDate(row.date) <= monthDate);
      const facts = read(monthRows, monthDate, { recommendation: true, calibration: true, weeks: false });
      release("month_one", monthDate, { sessions: new Set(monthRows.map((row) => row.session || row.date)).size,
        improved: new Set(facts.filter((fact) => fact.improved).map((fact) => fact.key)).size,
        solid: new Set(facts.filter((fact) => fact.standing?.word === "solid").map((fact) => fact.key)).size });
    }
    const current = read(rows, today, { recommendation: true, calibration: true, weeks: false });
    const lift = current[0] || { key: lifts[0]?.key || "", name: lifts[0]?.name || "" };
    const pending = FINDING_IDS.find((id) => !released.has(id));
    let need = null;
    if (pending) {
      need = { lift: lift.name, key: lift.key };
      if (pending === "weights_found") need.m = lifts.filter((ex) => !weights(rows, current).has(ex.key)).length;
      if (pending === "effort_read") {
        const closest = current.slice().sort((a, b) => (b.calibration?.n || 0) - (a.calibration?.n || 0))[0] || lift;
        need = { key: closest.key, lift: closest.name, k: Math.max(0, 3 - (closest.calibration?.n || 0)),
          reason: (closest.calibration?.n || 0) >= 3 ? "agreement" : "checks" };
      }
      if (pending === "first_solid") {
        const closest = current.slice().sort((a, b) => (b.standing?.evidence?.sets || 0) - (a.standing?.evidence?.sets || 0))[0] || lift;
        need = { key: closest.key, lift: closest.name, m: Math.max(0, Math.ceil((6 - (closest.standing?.evidence?.sets || 0)) / (closest.nextSetQuality || 0.5))),
          reason: closest.standing?.reasons?.includes("disagreement") || closest.standing?.reasons?.includes("inconsistent_checks")
            ? "agreement" : (closest.standing?.evidence?.sessions || 0) < 2 ? "sessions" : "sets" };
      }
      if (pending === "first_target" && current.length && current.every((fact) => fact.targetEligible === false || fact.recommendation?.reasonCodes?.includes("manual_prescription"))) need = null;
      if (pending === "month_one") need.d = monthDate ? calendarDayDistance(today, monthDate) : 28;
    }
    return { version: FINDINGS_VERSION,
      released: [...released.values()].sort((a, b) => b.date.localeCompare(a.date) || FINDING_IDS.indexOf(a.id) - FINDING_IDS.indexOf(b.id)),
      next: pending ? { id: pending, need } : null };
  }

  const api = {
    PROFILE_VERSION,
    PROFILE_WEIGHTS,
    buildSavedProfile,
    FINDINGS_VERSION,
    buildFindings,
    MODEL_VERSION,
    OUTCOMES,
    RECOMMENDATIONS,
    EVIDENCE_STATES,
    EVIDENCE_SCOPES,
    OUTCOME_TO_RECOMMENDATION,
    normalizeEvidenceRecord,
    normalizeEvidenceRecords,
    compareChronology,
    calendarDayDistance,
    buildWeekStatus,
    buildProgramActionQueue,
    buildReviewCheckpoint,
    buildWeekReview,
    detectPatterns,
    buildStrengthEvidence,
    buildVolumeEvidence,
    buildPREvidence,
  };
  Object.freeze(api);

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgressModel = api;
})(typeof self !== "undefined" ? self : this);
