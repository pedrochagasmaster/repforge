import { estimateOneRepMax } from '../../metrics.js';
import evidence from './evidence.js';
/** Canonically read strength and immutable saved attribution. Dates/session IDs
 * retain their released optional/numeric forms; this policy never rewrites logs.
 * @typedef {{liftKey:string,date?:string,created?:string|null,session?:string|number,blockId?:string|null,load?:number|string|null,reps?:number|string|null,rir?:number|string|null,warmup?:boolean,strengthComparable?:boolean,strengthConvention?:string|null,exerciseName:string,exerciseId?:string,loadMultiplier?:number|null,perSideLoad?:boolean}} RecordRow
 */
/** @param {readonly RecordRow[]} source */
export function derivePersonalRecords(source) {
    const rows = source.filter(row => !row.warmup && row.strengthComparable && Number(row.load) > 0 && Number(row.reps) > 0).slice().sort(evidence.compareChronology);
    /** @type {Map<string,{load:number,repsAtMax:number,e1rm:number}>} */
    const best = new Map();
    const events = [];
    for (const row of rows) {
        const key = `${row.liftKey}\u0000${row.strengthConvention || 'load'}`, load = Number(row.load), reps = Number(row.reps), estimate = estimateOneRepMax(load, reps), current = best.get(key) || { load: 0, repsAtMax: 0, e1rm: 0 };
        const event = { liftKey: row.liftKey, date: row.date, session: row.session, blockId: row.blockId ?? null, load, reps, rir: row.rir, exerciseName: row.exerciseName, exerciseId: row.exerciseId, strengthConvention: row.strengthConvention, loadMultiplier: row.loadMultiplier, perSideLoad: row.perSideLoad };
        if (load > current.load) {
            events.push({ kind: 'load', ...event, deltaLoad: current.load > 0 ? load - current.load : undefined });
            current.load = load;
            current.repsAtMax = reps;
        }
        else if (load === current.load && reps > current.repsAtMax) {
            events.push({ kind: 'reps', ...event, deltaReps: reps - current.repsAtMax });
            current.repsAtMax = reps;
        }
        if (estimate > current.e1rm) {
            events.push({ kind: 'e1rm', ...event, deltaE1rm: current.e1rm > 0 ? estimate - current.e1rm : undefined });
            current.e1rm = estimate;
        }
        best.set(key, current);
    }
    return events;
}
