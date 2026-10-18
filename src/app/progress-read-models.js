import { estimateOneRepMax } from "../training/metrics.js";
import { cloneSnapshot as structuredCloneFacts } from "../training/model.js";
import { compareProjectedSessionOutcome as compareSessions, evidence as progressEvidence } from "../training/progress.js";
/** Scope/point selection belongs to training. This application projection joins
 * those points with logged conventions and the authoritative session outcome.
 * No storage, browser, clock or presentation formatting is reachable here. */
/** @param {import("./progress-contracts.js").ProgressFacts} facts */
export function buildStrengthEvidenceRecords({ scope, meta, rows, program, recordKeys }) {
    const Model = progressEvidence;
    const programKeys = new Set(program.map(ex => ex.key));
    // Preserve the source producer's key selection until a deliberate evidence-policy correction.
    const keys = new Set([...programKeys, ...recordKeys]);
    /** @type {Readonly<Record<string,string>>} */
    const outcomeByStatus = { improved: "improved", flat: "maintained", regressed: "declined" };
    /** @type {import("./progress-contracts.js").EvidenceRecord[]} */
    const records = [];
    const hasEffort = /** @param {import("./progress-contracts.js").StrengthRow} row */ /** @param {import("./progress-contracts.js").StrengthRow} row */ /** @param {import("./progress-contracts.js").StrengthRow} row */ /** @param {import("./progress-contracts.js").StrengthRow} row */ row => row?.rir != null && Number.isFinite(Number(row.rir));
    for (const key of keys) {
        const series = Model.buildStrengthEvidence(scope, key, rows, meta);
        if (!programKeys.has(key) && series.evidenceCount === 0)
            continue;
        // The model owns scope and chronological point selection. The producer
        // then asks the authoritative paired-exposure comparison for the final
        // outcome; a count alone can never produce a sufficient record.
        const convention = series.comparisonConvention ?? "load";
        const pointRows = new Map(series.points.map(point => [point.sessionKey,
            rows.filter(row => row.exerciseId === key && row.sessionKey === point.sessionKey && row.strengthComparable !== false &&
                (row.strengthConvention ?? "load") === (convention ?? "load"))]));
        const latestPoint = series.points.at(-1), previousPoint = series.points.at(-2);
        const latestRows = latestPoint ? pointRows.get(latestPoint.sessionKey) || [] : [];
        const previousRows = previousPoint ? pointRows.get(previousPoint.sessionKey) || [] : [];
        /** @type {"insufficient"|"sufficient"} */
        let evidenceState = "insufficient";
        /** @type {string|null} */
        let reason = series.reason || "untested";
        let outcome;
        if (series.evidenceCount >= 2) {
            const comparableEffort = [...previousRows, ...latestRows].every(hasEffort);
            if (!comparableEffort)
                reason = "missing-effort";
            else {
                const delta = compareSessions(latestRows, previousRows, convention);
                outcome = outcomeByStatus[delta.status];
                if (outcome) {
                    evidenceState = "sufficient";
                    reason = null;
                }
                else
                    reason = delta.status === "changed_load" ? "changed-load" : "incompatible-exposure";
            }
        }
        else if (series.evidenceCount === 1) {
            reason = latestRows.some(row => !hasEffort(row)) ? "missing-effort" : "single-observation";
        }
        /** @type {import("./progress-contracts.js").EvidenceRecord} */
        const record = { exerciseId: key, scope: series.scope, evidenceState,
            evidenceCount: series.evidenceCount, reason };
        if (outcome)
            record.outcome = outcome;
        records.push(record);
    }
    return Model.normalizeEvidenceRecords(records);
}
/** @param {import("./progress-contracts.js").ProjectionFacts} facts */
export function buildStrengthProjection({ scope, meta, records, rows, program, prEvents }) {
    const Model = progressEvidence, keys = new Set(program.map(ex => ex.key)), dashboard = [];
    for (const row of rows)
        keys.add(row.exerciseId);
    /** @type {Map<string,import("./progress-contracts.js").StrengthSeries>} */
    const series = new Map();
    for (const key of keys) {
        const base = Model.buildStrengthEvidence(scope, key, rows, { ...meta, evidenceRecords: records });
        if (!program.some(ex => ex.key === key) && base.evidenceCount === 0)
            continue;
        const pointKeys = new Set(base.points.map(point => point.sessionKey));
        const convention = base.comparisonConvention ?? "load";
        const liftRows = rows.filter(row => row.exerciseId === key && pointKeys.has(row.sessionKey) && row.strengthComparable !== false &&
            (row.strengthConvention ?? "load") === (convention ?? "load"));
        const current = { ...base, perSideLoad: liftRows.length > 0 && liftRows.every(row => row.perSideLoad === true),
            perSideReps: liftRows.length > 0 && liftRows.every(row => row.perSideReps === true) };
        const liftSessions = current.points.map(point => {
            const source = liftRows.filter(row => row.sessionKey === point.sessionKey);
            const topRow = source.slice().sort((a, b) => b.load - a.load || b.reps - a.reps)[0] || point;
            const top = Number(topRow.load), topReps = Number(topRow.reps), volume = source.reduce((n, row) => n + (typeof row.tonnage === "number" && Number.isFinite(row.tonnage) ? row.tonnage : 0), 0);
            return { session: point.session, date: point.date, day: source[0]?.day || "", liftKey: key,
                name: source[0]?.name || program.find(ex => ex.key === key)?.name || key, top, topReps, reps: source.reduce((n, row) => n + row.reps, 0),
                rir: average(source.map(row => row.rir).filter(isFiniteNumber)), sets: source.length, volume,
                perSideReps: source.length > 0 && source.every(row => row.perSideReps === true),
                e1rm: Math.max(...source.map(row => row.e1rm)), sessionKey: point.sessionKey };
        });
        const latest = liftSessions.at(-1);
        if (latest) {
            const first = liftSessions[0], best = Math.max(...liftSessions.map(session => session.e1rm));
            const scopedPrs = prEvents.filter(event => event.liftKey === key &&
                pointKeys.has(strengthSessionKey(event)));
            const rec = program.find(ex => ex.key === key) || { signal: "—" };
            // Dashboard facts stay numeric. Composition decorates the retained read-only hook.
            dashboard.push({ key, exercise: latest.name, latestLoad: latest.top, latestReps: latest.topReps,
                best, blockDelta: latest.e1rm - first.e1rm,
                prs: scopedPrs.length, lastTrained: latest.date, signal: rec.signal });
        }
        series.set(key, current);
    }
    const sessions = [...series].flatMap(([key, current]) => {
        const pointKeys = new Set(current.points.map(point => point.sessionKey));
        const convention = current.comparisonConvention ?? "load";
        const matching = rows.filter(row => row.exerciseId === key && pointKeys.has(row.sessionKey) && row.strengthComparable !== false &&
            (row.strengthConvention ?? "load") === (convention ?? "load"));
        return current.points.map(point => {
            const source = matching.filter(row => row.sessionKey === point.sessionKey);
            const top = source.slice().sort((a, b) => b.load - a.load || b.reps - a.reps)[0] || point;
            return { session: point.session, date: point.date, day: source[0]?.day || "", liftKey: key,
                name: source[0]?.name || program.find(ex => ex.key === key)?.name || key, top: top.load, topReps: top.reps,
                reps: source.reduce((n, row) => n + row.reps, 0), rir: average(source.map(row => row.rir).filter(isFiniteNumber)), sets: source.length,
                volume: source.reduce((n, row) => n + (typeof row.tonnage === "number" && Number.isFinite(row.tonnage) ? row.tonnage : 0), 0),
                perSideLoad: source.length > 0 && source.every(row => row.perSideLoad === true),
                perSideReps: source.length > 0 && source.every(row => row.perSideReps === true),
                e1rm: Math.max(...source.map(row => row.e1rm)), sessionKey: point.sessionKey };
        });
    });
    return { keys: new Set(series.keys()), dashboard, sessions, records, series };
}
/** @param {{session?:string|number,date?:string,blockId?:string|null}} row */
export function strengthSessionKey(row) {
    return `${String(row?.session ?? row?.date)}\u0000${String(row?.blockId ?? "")}`;
}
/** @param {number[]} values */
function average(values) {
    return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}
/** @param {number|null} value @returns {value is number} */
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
/** Copy is applied after the single pure outcome policy has finished.
 * @param {import('../training/progress/internal/session-outcome.js').SessionOutcome} outcome
 * @param {{t:(key:string)=>string}} copy
 */
export function presentSessionOutcome(outcome, copy) {
    return { status: outcome.status, label: copy.t(`delta.${outcome.status}.label`), text: copy.t(`delta.${outcome.status}.text`), metrics: outcome.metrics };
}
/** A Progress reader must identify exactly one point inside the requested
 * scope and logged convention. The previous point comes from the same native
 * evidence series; a supplied current session cannot choose its own baseline.
 * @param {import('./progress-contracts.js').ProgressComparisonFacts} facts
 * @param {{t:(key:string)=>string}} copy
 */
export function compareProgressStrengthSession({ key, currentRows, reader, meta }, copy) {
    const absent = () => presentSessionOutcome({ status: 'not_comparable', metrics: null }, copy);
    const { scope, convention, session, rows } = reader || {};
    if (typeof scope !== 'string' || !progressEvidence.EVIDENCE_SCOPES.includes(scope) || typeof convention !== 'string' || !convention || !session || !Array.isArray(rows) || !Array.isArray(currentRows) || !currentRows.length)
        return absent();
    if (!currentRows.some(row => row.key === key && String(row.session ?? '') === String(session)))
        return absent();
    const series = progressEvidence.buildStrengthEvidence(scope, key, rows, meta);
    if (series.comparisonConvention !== convention)
        return absent();
    const matches = series.points.map((point, index) => ({ point, index })).filter(({ point }) => String(point.session) === String(session));
    if (matches.length !== 1)
        return absent();
    const { point, index } = matches[0];
    if (index === 0)
        return presentSessionOutcome({ status: 'new', metrics: null }, copy);
    const previousPoint = series.points[index - 1];
    /** @param {{sessionKey:string}} selected */
    const forPoint = selected => rows.filter(row => row.exerciseId === key && row.sessionKey === selected.sessionKey && row.strengthComparable !== false && (row.strengthConvention || 'load') === convention);
    return presentSessionOutcome(compareSessions(forPoint(point), forPoint(previousPoint), convention), copy);
}
/** Immutable performed attribution wins over template snapshots and legacy name
 * fallback. Shared by the remaining source readers during composition cutover.
 * @param {import('./progress-contracts.js').MuscleRow} row
 * @param {readonly import('./progress-contracts.js').ProgramRow[]} program
 */
export function loggedMuscleAttribution(row, program) {
    if (row.performedPrimary != null || row.performedSecondary != null)
        return { primary: row.performedPrimary || '', secondary: row.performedSecondary || '' };
    if (row.primary != null || row.secondary != null)
        return { primary: row.primary || '', secondary: row.secondary || '' };
    const exercise = program.find(item => item.name === row.name);
    return exercise ? { primary: exercise.primary, secondary: exercise.secondary } : { primary: '', secondary: '' };
}
/** @param {number} planned @param {number} completed */
export function overviewBarPct(planned, completed) {
    return planned > 0 ? Math.min(100, Math.round(completed / planned * 100)) : 0;
}
/** @param {number} planned @param {number} completed */
export function volumeStatusKey(planned, completed) {
    if (!planned)
        return completed > 0 ? 'high' : 'on-target';
    const ratio = completed / planned;
    return ratio < .6 ? 'below' : ratio <= 1.3 ? 'on-target' : 'high';
}
/** @param {import('./progress-contracts.js').Recommendation|null|undefined} recommendation */
export function attentionVerdict(recommendation) {
    if (!recommendation || recommendation.status === 'manual' || recommendation.status === 'new')
        return 'hold';
    if (recommendation.status === 'add' || recommendation.status === 'add2')
        return 'up';
    if (recommendation.status === 'reduce')
        return recommendation.stalled ? 'recover' : 'down';
    return recommendation.reason === 'recover' ? 'recover' : 'hold';
}
/** Completed muscle work is shared by Progress and the block-review reader.
 * Performed attribution and released half-set weighting have one owner.
 * @param {readonly import('./progress-contracts.js').MuscleRow[]|null|undefined} rows
 * @param {readonly import('./progress-contracts.js').ProgramRow[]} program
 * @param {Pick<import('./progress-contracts.js').TrainingModel,'normalizeMuscleAttribution'>} training
 * @returns {import('./progress-contracts.js').MuscleMap}
 */
export function completedMuscleWork(rows, program, training) {
    /** @type {import("./progress-contracts.js").MuscleMap} */
    const result = new Map();
    for (const row of rows || []) {
        const attribution = loggedMuscleAttribution(row, program);
        for (const name of training.normalizeMuscleAttribution(attribution.primary).split(',').filter(Boolean)) {
            const value = result.get(name) || { d: 0, p: 0 };
            value.d += 1;
            result.set(name, value);
        }
        for (const name of training.normalizeMuscleAttribution(attribution.secondary).split(',').filter(Boolean)) {
            const value = result.get(name) || { d: 0, p: 0 };
            value.p += .5;
            result.set(name, value);
        }
    }
    return result;
}
/** The rolling/block-review reader's released numeric predicate. Scoped
 * evidence uses the training evidence selector before completedMuscleWork.
 * @param {readonly import('./progress-contracts.js').MuscleWorkRow[]} rows
 * @param {readonly import('./progress-contracts.js').ProgramRow[]} program
 * @param {{start?:string|null,end?:string|null,hardRir:number}} bounds
 * @param {Pick<import('./progress-contracts.js').TrainingModel,'normalizeMuscleAttribution'>} training
 */
export function hardMuscleWork(rows, program, { start, end, hardRir }, training) {
    return completedMuscleWork(rows.filter(row => !(start && String(row.date) < start) && !(end && String(row.date) > end) && Number(row.load) > 0 && Number(row.reps) > 0 && Number(row.rir) <= hardRir && !row.warmup), program, training);
}
/** Formatting and the existing pure program model are concrete collaborators.
 * Every operation receives captured facts; this factory retains no snapshot,
 * selected scope, clock, recommendation cache or browser capability.
 * @param {import('./progress-contracts.js').ReadModelOptions} options
 */
export function createProgressReadModels({ training, copy, format }) {
    const { t } = copy;
    /** @param {unknown} value */
    const muscles = value => training.normalizeMuscleAttribution(value).split(',').filter(Boolean);
    /** @param {import('./progress-contracts.js').MuscleMap} map @param {string} name */
    const effective = (map, name) => {
        const value = map.get(name);
        return value ? value.d + value.p : 0;
    };
    /** @param {import('./progress-contracts.js').MuscleMap} map @param {string} name @param {number} direct @param {number} secondary */
    function add(map, name, direct, secondary) {
        const value = map.get(name) || { d: 0, p: 0 };
        value.d += direct;
        value.p += secondary;
        map.set(name, value);
    }
    /** @param {readonly import('./progress-contracts.js').VolumeRow[]|null|undefined} rows @param {readonly import('./progress-contracts.js').ProgramRow[]} program */
    const completedMap = (rows, program) => completedMuscleWork(rows, program, training);
    /** @param {readonly import('./progress-contracts.js').VolumeRow[]} rows @param {readonly import('./progress-contracts.js').ProgramRow[]} program @param {{start?:string|null,end?:string|null,hardRir:number}} bounds */
    const hardSets = (rows, program, bounds) => hardMuscleWork(rows, program, bounds, training);
    /** @param {import('./progress-contracts.js').ReadFacts} facts */
    function weekPrescriptions({ snapshot, recoveryRecord }) {
        const meta = snapshot.programMeta, weeks = Math.max(1, Number(meta.mesocycleLengthWeeks) || 6), definition = meta.programDefinition;
        if (definition && Array.isArray(definition.days)) {
            const cycles = Number.isInteger(definition.cycles) && definition.cycles > 0 ? definition.cycles : 1;
            const customs = Array.isArray(snapshot.customExercises) ? snapshot.customExercises : [];
            return Array.from({ length: weeks }, (_, index) => {
                const rows = training.flatProgramFromDefinition(definition, customs, Math.min(cycles, index + 1));
                return training.prescriptionForReceipt(training.plannedPrescriptionForProgram(rows, index + 1, null), rows);
            });
        }
        const receipts = Array.isArray(meta.programStructure?.weekPrescriptions) ? meta.programStructure.weekPrescriptions : [], numbered = receipts.some(entry => Number.isInteger(entry?.week));
        return Array.from({ length: weeks }, (_, index) => {
            const receipt = (numbered ? receipts.find(entry => entry?.week === index + 1) : receipts[index]) || training.plannedPrescriptionForProgram(snapshot.program, index + 1, null);
            return training.prescriptionForReceipt(index === 0 ? training.recoveryReceiptForWeek(receipt, recoveryRecord) : receipt, snapshot.program);
        });
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts */
    function evidenceMeta(facts) {
        const { snapshot, blockId } = facts, meta = snapshot.programMeta;
        return {
            started: meta.started || null, mesocycleLengthWeeks: meta.mesocycleLengthWeeks || 6, hardRir: Number(snapshot.settings.hardRir), blockId,
            weekPrescriptions: weekPrescriptions(facts), plannedVolumeHistory: training.isValidPlannedVolumeHistory(meta.plannedVolumeHistory) ? structuredCloneFacts(meta.plannedVolumeHistory) : null
        };
    }
    /** @param {ReturnType<typeof progressEvidence.buildVolumeEvidence>} evidence @param {import('./progress-contracts.js').ReadFacts} facts @param {ReturnType<typeof weekPrescriptions>} prescriptions */
    function plannedMap(evidence, facts, prescriptions) {
        const meta = facts.snapshot.programMeta;
        /** @type {import("./progress-contracts.js").MuscleMap} */
        const map = new Map();
        const week = evidence.period.weekNumber || training.mesocycleLifecycle({ ...meta, started: meta.started || undefined }, facts.today).elapsedWeek || 1, elapsed = evidence.period.elapsedNumberedWeeks || 0;
        const history = training.isValidPlannedVolumeHistory(meta.plannedVolumeHistory) && meta.plannedVolumeHistory.throughWeek <= elapsed ? meta.plannedVolumeHistory : null;
        if (evidence.scope === 'block-to-date' && history) {
            for (const [name, value] of Object.entries(history.muscles.direct || {}))
                add(map, name, value, 0);
            for (const [name, value] of Object.entries(history.muscles.secondary || {}))
                add(map, name, 0, value);
        }
        const start = evidence.scope === 'block-to-date' && history ? history.throughWeek : 0;
        const selected = evidence.scope === 'block-to-date' ? prescriptions.slice(start, elapsed) : [prescriptions[Math.min(Math.max(week - 1, 0), prescriptions.length - 1)]];
        for (const receipt of selected)
            for (const [name, value] of Object.entries(receipt?.musclesByName || {}))
                add(map, name, value.d, value.p);
        return map;
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts @param {import('./progress-contracts.js').EvidenceRecord[]} records */
    function week(facts, records) {
        const meta = evidenceMeta(facts), status = progressEvidence.buildWeekStatus(facts.programRows, meta, facts.log, facts.today);
        return { ...status, totalWeeks: meta.mesocycleLengthWeeks, baselineCount: records.filter(record => record.evidenceState === 'insufficient').length };
    }
    /** @param {string} key @param {import('./progress-contracts.js').StrengthSeries|undefined} series @param {Omit<import('./progress-contracts.js').StrengthRow,"e1rm">[]} rows */
    function sessionDelta(key, series, rows) {
        const points = series?.points || [];
        if (points.length < 2)
            return null;
        const convention = series?.comparisonConvention || 'load', matched = rows.filter(row => row.exerciseId === key && row.strengthComparable !== false && (row.strengthConvention || 'load') === convention);
        const previous = matched.filter(row => row.sessionKey === points[points.length - 2].sessionKey), current = matched.filter(row => row.sessionKey === points[points.length - 1].sessionKey);
        return presentSessionOutcome(compareSessions(current, previous, convention), copy);
    }
    /** @param {import('./progress-contracts.js').StrengthFacts} facts */
    function strength({ scope, projection, program, rows }) {
        const keys = new Set(projection.keys);
        for (const exercise of program)
            keys.add(exercise.key);
        /** @param {string} key */
        const name = key => format.exercise(projection.dashboard.find(row => row.key === key)?.exercise || program.find(ex => ex.key === key)?.name || key, key);
        return { scope, rows: [...keys].sort((a, b) => name(a).localeCompare(name(b), format.locale())).map(key => {
                const series = /** @type {import("./progress-contracts.js").StrengthSeries} */ (projection.series.get(key)), sessions = projection.sessions.filter(session => session.liftKey === key), latest = sessions.at(-1);
                return { key, name: name(key), series, latest, comparison: latest ? sessionDelta(key, series, rows) : null, slotId: program.find(ex => ex.key === key)?.id,
                    sessions: sessions.map(session => ({ ...session, shortDate: format.shortDate(session.date), longDate: format.longDate(session.date), e1rmDisplay: format.displayLoad(session.e1rm) })) };
            }) };
    }
    /** @param {Omit<import('./progress-contracts.js').StrengthFacts,'scope'>} facts */
    function overviewStrength({ projection, program, rows }) {
        const order = program.map(ex => ex.key), keys = [...projection.series.keys()].filter(key => (projection.series.get(key)?.evidenceCount || 0) > 0).sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
        });
        return keys.map(key => {
            const series = /** @type {import("./progress-contracts.js").StrengthSeries} */ (projection.series.get(key)), latest = projection.sessions.filter(session => session.liftKey === key).at(-1);
            return { key, name: format.exercise(projection.dashboard.find(row => row.key === key)?.exercise || program.find(ex => ex.key === key)?.name || key, key), series, latest, comparison: latest ? sessionDelta(key, series, rows) : null, slotId: program.find(ex => ex.key === key)?.id, dateLabel: latest ? format.shortDate(latest.date) : null };
        });
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts */
    function overviewVolume(facts) {
        const meta = evidenceMeta(facts), evidence = progressEvidence.buildVolumeEvidence('this-week', facts.programRows, meta, facts.log, facts.today), planned = plannedMap(evidence, facts, meta.weekPrescriptions), completed = completedMap(evidence.completedRows, facts.snapshot.program);
        const names = new Set([...planned.keys(), ...completed.keys()]);
        return [...names].map(muscle => {
            const plannedValue = effective(planned, muscle), completedValue = effective(completed, muscle), evidenceState = completedValue > 0 ? 'sufficient' : 'insufficient', inProgress = evidence.periodStatus !== 'complete';
            const statusKey = evidenceState === 'insufficient' ? 'baseline' : inProgress && plannedValue > 0 ? 'in-progress' : volumeStatusKey(plannedValue, completedValue);
            const status = statusKey === 'baseline' ? t('stats.evidence.baseline') : statusKey === 'in-progress' ? t('stats.volume.in_progress', { done: format.number(completedValue), planned: format.number(plannedValue) }) : statusKey === 'high' ? t('status.high') : statusKey === 'below' ? t('stats.volume_below') : t('stats.volume_on_target');
            return { muscle, planned: plannedValue, completed7: completedValue, status, statusKey, evidenceState, pct: overviewBarPct(plannedValue, completedValue) };
        }).sort((a, b) => {
            const da = Math.max(a.planned - a.completed7, 0), db = Math.max(b.planned - b.completed7, 0);
            if (db !== da)
                return db - da;
            const ra = a.planned > 0 ? a.completed7 / a.planned : Infinity, rb = b.planned > 0 ? b.completed7 / b.planned : Infinity;
            if (ra !== rb)
                return ra - rb;
            return format.muscle(a.muscle).localeCompare(format.muscle(b.muscle), format.locale());
        });
    }
    /** @param {string} muscle @param {import('./progress-contracts.js').VolumeRow[]|null|undefined} rows @param {import('./progress-contracts.js').ReadFacts} facts */
    function volumeDetails(muscle, rows, facts) {
        /** @type {Map<string,{session?:string|number,date?:string,created?:string|null,name:string,sets:number}>} */
        const groups = new Map();
        for (const row of rows || []) {
            const attribution = loggedMuscleAttribution(row, facts.snapshot.program);
            let weight = 0;
            if (muscles(attribution.primary).includes(muscle))
                weight = 1;
            else if (muscles(attribution.secondary).includes(muscle))
                weight = .5;
            if (!weight)
                continue;
            const key = `${row.session}|${row.liftKey}`, current = groups.get(key) || { session: row.session, date: row.date, created: row.created, name: row.displayName, sets: 0 };
            if (!current.date && row.date)
                current.date = row.date;
            if (!current.created && row.created)
                current.created = row.created;
            current.sets += weight;
            groups.set(key, current);
        }
        return [...groups.values()].sort((a, b) => progressEvidence.compareChronology(b, a)).map(row => ({ ...row, dateLabel: format.shortDate(row.date || '') }));
    }
    /** @param {string} scope @param {import('./progress-contracts.js').ReadFacts} facts */
    function volume(scope, facts) {
        const meta = evidenceMeta(facts), evidence = progressEvidence.buildVolumeEvidence(scope === 'this-week' ? 'this-week' : 'block-to-date', facts.programRows, meta, facts.log, facts.today), planned = plannedMap(evidence, facts, meta.weekPrescriptions), completed = completedMap(evidence.completedRows, facts.snapshot.program), names = new Set([...planned.keys(), ...completed.keys()]);
        const inProgress = evidence.periodStatus !== 'complete' && evidence.period.end && String(evidence.period.end) >= facts.today;
        return { scope, periodLabel: evidence.period.start ? t('stats.volume.period_text', { start: format.longDate(evidence.period.start), end: format.longDate(evidence.period.end || facts.today) }) : t('stats.volume.no_period'), rows: [...names].sort((a, b) => format.muscle(a).localeCompare(format.muscle(b), format.locale())).map(muscle => ({ muscle, label: format.muscle(muscle), planned: effective(planned, muscle), done: effective(completed, muscle), inProgress, details: volumeDetails(muscle, evidence.completedRows, facts) })) };
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts @param {import('./progress-contracts.js').EvidenceRecord[]} records @returns {import('./progress-contracts.js').AttentionGroup[]} */
    function attentionGroups(facts, records) {
        const items = progressEvidence.buildProgramActionQueue(facts.programRows, evidenceMeta(facts), facts.log, records);
        /** @type {Map<string,import('./progress-contracts.js').AttentionGroup['items']>} */
        const groups = new Map();
        for (const item of items) {
            const key = item.recommendation, exercise = facts.program.find(ex => ex.key === item.destinationId);
            const entries = groups.get(key) || [];
            entries.push({ ex: exercise || { id: item.destinationId, key: item.destinationId, name: item.destinationId, displayName: item.destinationId }, why: t(`stats.recommendation.${key}`), item });
            groups.set(key, entries);
        }
        return [...groups].map(([key, items]) => ({ key, cls: key, lead: t(`stats.recommendation.${key}`), items }));
    }
    /** @param {{groups:import('./progress-contracts.js').AttentionGroup[],projection:import('./progress-contracts.js').Projection,program:readonly import('./progress-contracts.js').DisplayLift[],recommendations:ReadonlyMap<string,import('./progress-contracts.js').Recommendation>}} facts */
    function attention({ groups, projection, program, recommendations }) {
        const rows = groups.flatMap(group => group.items.map(entry => ({ entry, group, slot: program.find(ex => ex.key === entry.item.destinationId), rec: recommendations.get(entry.item.destinationId) }))).filter(row => {
            const move = attentionVerdict(row.rec);
            return move === 'up' || move === 'down';
        });
        return rows.map(({ entry: { ex, item }, group, slot, rec }) => ({ destinationId: item.destinationId, id: ex.id, group: group.key, name: ex.displayName, move: attentionVerdict(rec), last: projection.series.get(item.destinationId)?.latest?.value, target: rec?.load != null ? rec.load : null, exerciseId: slot?.id, label: rec?.label, reason: rec?.text, lead: group.lead, series: projection.series.get(item.destinationId) }));
    }
    /** @param {readonly import('./progress-contracts.js').DetailedPrEvent[]} source @param {readonly import('./progress-contracts.js').DisplayLift[]} program @param {string} filter */
    function prTimeline(source, program, filter) {
        let events = [...source];
        if (filter === 'load' || filter === 'reps' || filter === 'e1rm')
            events = events.filter(event => event.kind === filter);
        else if (filter === 'program') {
            const keys = new Set(program.map(ex => ex.key));
            events = events.filter(event => keys.has(event.liftKey));
        }
        return events.sort((a, b) => progressEvidence.compareChronology(b, a));
    }
    /** @param {readonly import('./progress-contracts.js').DetailedPrEvent[]} source @param {readonly import('./progress-contracts.js').DisplayLift[]} program @param {string} filter */
    function prs(source, program, filter) {
        return { filter, events: prTimeline(source, program, filter).map(event => ({ ...event, name: format.exercise(event.exerciseName, event.liftKey), dateLabel: format.longDate(event.date || '') })) };
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts @param {{planned:import('./progress-contracts.js').MuscleMap,cutoff7:string,cutoff28:string}} periods */
    function rollingVolume(facts, { planned, cutoff7, cutoff28 }) {
        const hardRir = Number(facts.snapshot.settings.hardRir), c7 = hardSets(facts.log, facts.snapshot.program, { start: cutoff7, hardRir }), c28 = hardSets(facts.log, facts.snapshot.program, { start: cutoff28, hardRir }), names = new Set([...planned.keys(), ...c7.keys(), ...c28.keys()]);
        return [...names].sort((a, b) => format.muscle(a).localeCompare(format.muscle(b), format.locale())).map(muscle => {
            const p = effective(planned, muscle), completed7 = effective(c7, muscle), completed28 = effective(c28, muscle), ratio = p ? completed7 / p : 0;
            const status = !p ? (completed7 > 0 ? t('status.high') : t('status.on_target')) : ratio < .6 ? t('status.low') : ratio <= 1.3 ? t('status.on_target') : t('status.high');
            return { muscle, planned: p, completed7, completed28, status };
        });
    }
    /** @param {{facts:import('./progress-contracts.js').ReadFacts,strengthFacts:import('./progress-contracts.js').StrengthFacts,records:import('./progress-contracts.js').EvidenceRecord[],groups:import('./progress-contracts.js').AttentionGroup[],recommendations:ReadonlyMap<string,import('./progress-contracts.js').Recommendation>}} input */
    function overview({ facts, strengthFacts, records, groups, recommendations }) {
        return { hasLog: facts.log.some(row => !row.warmup), week: week(facts, records), strength: overviewStrength(strengthFacts), attention: attention({ groups, projection: strengthFacts.projection, program: facts.program, recommendations }) };
    }
    /** @param {import('./progress-contracts.js').ReadFacts} facts @param {import('./progress-contracts.js').EvidenceRecord[]} records */
    function review(facts, records) {
        const meta = facts.snapshot.programMeta;
        if (!meta.started)
            return Object.freeze({ started: false });
        const checkpoint = progressEvidence.buildReviewCheckpoint(facts.programRows, { started: meta.started, mesocycleLengthWeeks: meta.mesocycleLengthWeeks || 6, mesocycleStatus: meta.mesocycleStatus, evidenceRecords: records, recoveryEligible: true }, facts.log, facts.today);
        const volume = progressEvidence.buildVolumeEvidence('block-to-date', facts.programRows, evidenceMeta(facts), facts.log, facts.today);
        return Object.freeze({ started: true, checkpoint, volume, life: training.mesocycleLifecycle({ ...meta, started: meta.started || undefined }, facts.today), periodStart: format.longDate(volume.period.start || meta.started || ''), periodEnd: format.longDate(volume.period.end || facts.today), outcomes: checkpoint.observedOutcomes.map(outcome => ({ ...outcome, name: format.exercise(facts.program.find(ex => ex.key === outcome.exerciseId)?.name || outcome.exerciseId, outcome.exerciseId) })) });
    }
    return Object.freeze({ weekPrescriptions, evidenceMeta, week, strength, overviewStrength, overviewVolume, volume, completedMap, hardSets, attentionGroups, attention, prTimeline, prs, rollingVolume, overview, review });
}
/** Canonical read rows are grouped for the plain detail trend. This preserves
 * its released load×reps totals; physical-tonnage reports use their own facts.
 * @param {readonly (import('../training/progress/internal/personal-records.js').RecordRow & {day?:string})[]} rows
 */
export function buildLiftSessionSummaries(rows) {
    /** @type {Map<string,{session?:string|number,date?:string,created?:string|null,day?:string,liftKey:string,name:string,loads:number[],reps:number[],rirs:number[],sets:number,perSideLoad?:boolean,convention:string}>} */
    const groups = new Map();
    for (const row of rows) {
        if (row.warmup || !row.strengthComparable || !(Number(row.load) > 0 && Number(row.reps) > 0))
            continue;
        const convention = row.strengthConvention || 'load', key = `${row.session}|${row.liftKey}|${convention}`;
        let group = groups.get(key);
        if (!group) {
            group = { session: row.session, date: row.date, created: row.created, day: row.day, liftKey: row.liftKey, name: row.exerciseName, loads: [], reps: [], rirs: [], sets: 0, perSideLoad: row.perSideLoad, convention };
            groups.set(key, group);
        }
        if (!group.date && row.date)
            group.date = row.date;
        if (!group.created && row.created)
            group.created = row.created;
        group.loads.push(Number(row.load));
        group.reps.push(Number(row.reps));
        group.rirs.push(Number(row.rir));
        group.sets++;
    }
    return [...groups.values()].map(group => {
        let top = 0, topReps = 0, volume = 0, best = 0;
        group.loads.forEach((load, index) => {
            const reps = group.reps[index];
            volume += load * reps;
            const value = estimateOneRepMax(load, reps);
            if (value > best)
                best = value;
            if (load > top) {
                top = load;
                topReps = reps;
            }
        });
        return { session: group.session, date: group.date, created: group.created, day: group.day, liftKey: group.liftKey, name: group.name, top, topReps, reps: group.reps.reduce((sum, value) => sum + Number(value || 0), 0), rir: average(group.rirs), sets: group.sets, volume, e1rm: best, perSideLoad: group.perSideLoad, convention: group.convention };
    }).sort(progressEvidence.compareChronology);
}
