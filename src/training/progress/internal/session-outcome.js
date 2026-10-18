import { estimateOneRepMax } from '../../metrics.js';
/** One authority for the shipped paired-session outcome. Saved projected values
 * retain numeric-string coercion; clocks, scope selection and copy live outside.
 * @typedef {{session?:string|number,date?:string,load?:number|string|null,reps?:number|string|null,rir?:number|string|null,warmup?:boolean,strengthComparable?:boolean,strengthConvention?:string|null}} OutcomeRow
 * @typedef {{topLoad:number,topLoadReps:number,totalReps:number,totalVolume:number,bestE1rm:number,avgRir:number,workingSets:number}} SessionMetrics
 * @typedef {'not_comparable'|'new'|'improved'|'flat'|'regressed'|'changed_load'} OutcomeStatus
 * @typedef {{status:OutcomeStatus,metrics:null|{current:SessionMetrics,previous:SessionMetrics,deltas:{loadDelta:number,repsDelta:number,volumeDelta:number,e1rmDelta:number,avgRirDelta:number}}}} SessionOutcome
 */
const DELTA_THRESHOLDS = Object.freeze({ e1rmPct: .01, volumePct: .025, rir: .75 });
/** @template {OutcomeRow} T @param {readonly T[]|null|undefined} rows */
export function workingRows(rows) {
    return (rows || []).filter(row => !row.warmup && Number(row.load) > 0 && Number(row.reps) > 0);
}
/** @param {readonly OutcomeRow[]|null|undefined} rows @returns {SessionMetrics|null} */
function exerciseSessionMetrics(rows) {
    const work = workingRows(rows);
    if (!work.length)
        return null;
    let topLoad = 0, topLoadReps = 0, totalReps = 0, totalVolume = 0, bestE1rm = 0;
    const rirs = [];
    for (const row of work) {
        const load = Number(row.load), reps = Number(row.reps);
        totalReps += reps;
        totalVolume += load * reps;
        rirs.push(Number(row.rir));
        const value = estimateOneRepMax(load, reps);
        if (value > bestE1rm)
            bestE1rm = value;
        if (load > topLoad || (load === topLoad && reps > topLoadReps)) {
            topLoad = load;
            topLoadReps = reps;
        }
    }
    return { topLoad, topLoadReps, totalReps, totalVolume, bestE1rm, avgRir: rirs.length ? rirs.reduce((sum, value) => sum + Number(value || 0), 0) / rirs.length : 0, workingSets: work.length };
}
/** @returns {SessionOutcome} */
export function noComparableSessionOutcome() {
    return { status: 'not_comparable', metrics: null };
}
/** At the same load, total reps decide. For a higher load, e1RM decides within
 * the existing 1% band. A lower load only improves on more strength or volume
 * at similar effort; otherwise it remains changed_load, never a false decline.
 * @param {readonly OutcomeRow[]|null|undefined} previousRows @param {readonly OutcomeRow[]|null|undefined} currentRows @returns {SessionOutcome}
 */
export function buildSessionDelta(previousRows, currentRows) {
    const previous = exerciseSessionMetrics(previousRows), current = exerciseSessionMetrics(currentRows), threshold = DELTA_THRESHOLDS;
    if (!previous || !current)
        return noComparableSessionOutcome();
    const loadDelta = current.topLoad - previous.topLoad, repsDelta = current.totalReps - previous.totalReps, volumeDelta = current.totalVolume - previous.totalVolume, e1rmDelta = current.bestE1rm - previous.bestE1rm, avgRirDelta = current.avgRir - previous.avgRir, deltas = { loadDelta, repsDelta, volumeDelta, e1rmDelta, avgRirDelta };
    const band = previous.bestE1rm * threshold.e1rmPct;
    /** @type {OutcomeStatus} */
    let status;
    if (Math.abs(loadDelta) < .01)
        status = repsDelta > 0 ? 'improved' : repsDelta < 0 ? 'regressed' : 'flat';
    else if (loadDelta > 0)
        status = e1rmDelta > band ? 'improved' : e1rmDelta < -band ? 'regressed' : 'flat';
    else
        status = e1rmDelta > band || (volumeDelta > previous.totalVolume * threshold.volumePct && avgRirDelta <= threshold.rir) ? 'improved' : 'changed_load';
    return { status, metrics: { current, previous, deltas } };
}
/** Validate the selected saved sessions and convention before using the same
 * arithmetic as every other outcome reader. Scope/previous-point selection is
 * intentionally the evidence model's job.
 * @param {readonly OutcomeRow[]|null|undefined} currentRows @param {readonly OutcomeRow[]|null|undefined} previousRows @param {string|null} [expectedConvention] @returns {SessionOutcome}
 */
export function compareProjectedSessionOutcome(currentRows, previousRows, expectedConvention = null) {
    const current = (Array.isArray(currentRows) ? /** @type {readonly OutcomeRow[]} */ (currentRows) : []).filter(row => !row.warmup && Number(row.load) > 0 && Number(row.reps) > 0);
    if (!current.length || current.some(row => row.strengthComparable === false))
        return noComparableSessionOutcome();
    const currentSessions = new Set(current.map(row => String(row.session ?? row.date ?? ''))), conventions = new Set(current.map(row => row.strengthConvention || 'load'));
    if (currentSessions.size !== 1 || currentSessions.has('') || conventions.size !== 1)
        return noComparableSessionOutcome();
    const convention = conventions.values().next().value;
    if (expectedConvention != null && convention !== expectedConvention)
        return noComparableSessionOutcome();
    const previous = (Array.isArray(previousRows) ? /** @type {readonly OutcomeRow[]} */ (previousRows) : []).filter(row => !row.warmup && Number(row.load) > 0 && Number(row.reps) > 0 && row.strengthComparable !== false && (row.strengthConvention || 'load') === convention);
    if (!previous.length)
        return { status: 'new', metrics: null };
    const previousSessions = new Set(previous.map(row => String(row.session ?? row.date ?? '')));
    if (previousSessions.size !== 1 || previousSessions.has('') || previousSessions.has(/** @type {string} */ (currentSessions.values().next().value)))
        return noComparableSessionOutcome();
    return buildSessionDelta(previous, current);
}
