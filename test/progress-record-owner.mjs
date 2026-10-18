/** Fixed chronology/convention/metric oracles for the actual moved policies. */
import assert from 'node:assert/strict';
import {derivePersonalRecords} from '../src/training/progress.js';
import {buildLiftSessionSummaries} from '../src/app/progress-read-models.js';
const row=(session,date,load,reps,extra={})=>({session,date,created:'2026-10-01T12:00:00.000Z',liftKey:'library:fixed',exerciseName:'Saved lift',load,reps,rir:1,strengthComparable:true,strengthConvention:'load',...extra});
const source=[row('c','2026-10-04',55,8),row(2,'2026-10-02',50,9),row('a','2026-10-01',50,8),row('warmup','2026-10-05',999,8,{warmup:true}),row('unknown','2026-10-05',999,8,{strengthComparable:false}),row('side','2026-10-06',20,8,{strengthConvention:'per-side:m2',perSideLoad:true,loadMultiplier:2})];
const before=JSON.stringify(source),events=derivePersonalRecords(source);
assert.deepEqual(events.map(({kind,session,load})=>({kind,session,load})),[
 {kind:'load',session:'a',load:50},{kind:'e1rm',session:'a',load:50},{kind:'reps',session:2,load:50},{kind:'e1rm',session:2,load:50},{kind:'load',session:'c',load:55},{kind:'e1rm',session:'c',load:55},{kind:'load',session:'side',load:20},{kind:'e1rm',session:'side',load:20},
]);
assert.equal(events[2].deltaReps,1);assert.equal(events[4].deltaLoad,5);assert.equal(events.at(-1).loadMultiplier,2,'logged convention retains physical context');
assert.equal(JSON.stringify(source),before,'PR projection does not reorder or mutate saved rows');
const summary=buildLiftSessionSummaries([row(7,'2026-10-02','40','8'),row(7,'2026-10-02',45,7,{rir:2}),row(7,'2026-10-02',999,8,{warmup:true})]);
assert.equal(summary.length,1);assert.deepEqual({session:summary[0].session,top:summary[0].top,topReps:summary[0].topReps,reps:summary[0].reps,volume:summary[0].volume,rir:summary[0].rir,sets:summary[0].sets,e1rm:summary[0].e1rm},{session:7,top:45,topReps:7,reps:15,volume:635,rir:1.5,sets:2,e1rm:55.5});
console.log('PASS native PR/detail summaries: literal chronology, numeric identity, convention separation and totals');
