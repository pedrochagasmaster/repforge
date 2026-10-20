/** Fixed arithmetic/status oracles for the production paired-session policy. */
import assert from 'node:assert/strict';
import {buildSessionDelta,compareProjectedSessionOutcome} from '../src/training/progress.js';
import {compareProgressStrengthSession} from '../src/app/progress-read-models.js';
const row=(session,load,reps,extra={})=>({session,load,reps,rir:1,strengthComparable:true,strengthConvention:'load',...extra});
for(const [previous,current,status] of [
 [row('p',45,10),row('c',45,8),'regressed'],[row('p',40,8),row('c',40,8),'flat'],
 [row('p',40,8),row('c',42.5,6),'flat'],[row('p',40,8),row('c',45,8),'improved'],
 [row('p',45,8),row('c',40,8),'changed_load'],[row('p',45,8),row('c',40,15),'improved']]){
 assert.equal(buildSessionDelta([previous],[current]).status,status);
 assert.equal(compareProjectedSessionOutcome([current],[previous],'load').status,status);
}
assert.equal(buildSessionDelta([row('p',40,8)],[row('c',99,10,{warmup:true}),row('c',40,8)]).metrics.current.totalVolume,320);
assert.equal(compareProjectedSessionOutcome([row('c',40,8)],[],'load').status,'new');
assert.equal(compareProjectedSessionOutcome([row('c',40,8)], [row('c',35,8)],'load').status,'not_comparable');
assert.equal(compareProjectedSessionOutcome([row('c',40,8),row('c',40,8,{strengthConvention:'bodyweight'})],[row('p',35,8)],'load').status,'not_comparable');
assert.equal(compareProjectedSessionOutcome([row('c',40,8)],[row('p',35,8),row('other',35,8)],'load').status,'not_comparable');
const key='library:fixed',rows=[row('old',35,8,{date:'2026-09-20',blockId:'old'}),row('p',45,10,{date:'2026-10-02',blockId:'current'}),row('c',45,8,{date:'2026-10-04',blockId:'current'})].map(row=>({...row,exerciseId:key,sessionKey:row.session+'\u0000'+row.blockId,work:true,name:'Fixed',tonnage:0,e1rm:0}));
const facts={key,currentRows:[{key,session:'c'}],reader:{scope:'current-block',convention:'load',session:'c',rows},meta:{started:'2026-10-01',blockId:'current'}};
const copy={t:key=>key};
assert.equal(compareProgressStrengthSession(facts,copy).status,'regressed','Progress compares latest in-scope pair, not older lower load');
assert.equal(compareProgressStrengthSession({...facts,reader:{...facts.reader,session:'old'}},copy).status,'not_comparable','current-block reader refuses out-of-scope identity');
assert.equal(compareProgressStrengthSession({...facts,reader:{...facts.reader,convention:'bodyweight'}},copy).status,'not_comparable','reader cannot select another convention');
assert.equal(compareProgressStrengthSession({...facts,currentRows:[{key:'other',session:'c'}]},copy).status,'not_comparable','row identity cannot impersonate selected lift');
console.log('PASS native session outcome thresholds, scope, convention and identity refusals');
