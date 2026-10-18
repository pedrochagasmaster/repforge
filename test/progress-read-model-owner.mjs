/** Application joins must honor the training-selected pair and convention.
 * Fixed authored inputs and literal outcomes are independent of the join code. */
import assert from 'node:assert/strict';
import {buildStrengthEvidenceRecords,buildStrengthProjection} from '../src/app/progress-read-models.js';
const key='library:fixed',scope='current-block';
const rows=[['older','2026-09-20',35,'old',44.333333333333336],['first','2026-10-02',40,'current',50.666666666666664],['second','2026-10-04',45,'current',57]].map(([session,date,load,blockId,e1rm])=>({
 exerciseId:key,session,sessionKey:session+'\u0000'+blockId,date,blockId,name:'Fixed lift',day:'Day 1',
 load,reps:8,rir:1,work:true,strengthComparable:true,strengthConvention:'load',tonnage:load*8,e1rm,
}));
const facts={scope,meta:{started:'2026-10-01',mesocycleLengthWeeks:6,blockId:'current'},program:[{key,name:'Fixed lift',signal:'Hold'}],rows,recordKeys:[key]};
let comparisons=0;
const records=buildStrengthEvidenceRecords(facts,(current,previous,convention)=>{
 comparisons++;assert.equal(convention,'load');assert.deepEqual(current.map(row=>row.session),['second']);assert.deepEqual(previous.map(row=>row.session),['first']);return{status:'improved'};
});
assert.equal(comparisons,1,'join asks the authoritative policy once for the selected pair');
assert.deepEqual(records.map(({exerciseId,evidenceState,evidenceCount,outcome})=>({exerciseId,evidenceState,evidenceCount,outcome})),[{exerciseId:key,evidenceState:'sufficient',evidenceCount:2,outcome:'improved'}]);
const projection=buildStrengthProjection({...facts,records,prEvents:[{liftKey:key,session:'older',date:'2026-09-20',blockId:'old'},{liftKey:key,session:'second',date:'2026-10-04',blockId:'current'}]});
assert.deepEqual(projection.sessions.map(({session,top,volume})=>({session,top,volume})),[{session:'first',top:40,volume:320},{session:'second',top:45,volume:360}]);
assert.deepEqual(projection.dashboard.map(({latestLoad,latestReps,best,prs})=>({latestLoad,latestReps,best,prs})),[{latestLoad:45,latestReps:8,best:57,prs:1}]);
const missingEffort=buildStrengthEvidenceRecords({...facts,rows:rows.map(row=>row.session==='second'?{...row,rir:null}:row)},()=>{throw new Error('missing effort must not call outcome policy')});
assert.equal(missingEffort[0].evidenceState,'insufficient');assert.equal(missingEffort[0].reason,'missing-effort');assert.equal(missingEffort[0].outcome,undefined);
assert.equal(rows[0].session,'older');assert.equal(rows[2].load,45,'source facts unchanged');
console.log('PASS native Progress join: fixed selected pair, scoped PR/session projection, missing-effort refusal');
