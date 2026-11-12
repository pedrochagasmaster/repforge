// Algorithm boundaries need historical replay, identity permutations and exact arithmetic.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { cases } from './fixtures/engine-standing.mjs';
const require = createRequire(import.meta.url);
const Model = require('../progress-model.js');
const Engine = require('../progression-engine.js');
const Calibration = require('../effort-calibration.js');
const [prescriptions,,,contexts] = structuredClone(cases.find(c => c.name === 'four-sessions').input);
const prescription = prescriptions[0];
const context = contexts.bySlotId[prescription.slotId];
const lift = { ...prescription, context, name: 'Leg press' };
const date = i => new Date(Date.parse('2026-01-01') + i * 864e5).toISOString().slice(0,10);
function session(i, extra = {}, count = 4) {
  return Array.from({length:count}, (_,j) => ({
    ...structuredClone(cases.find(c => c.name === 'four-sessions').input[1][0].sets[j%3]),
    metricType: 'source_metrics@1', metricDefinitions: prescription.metricDefinitions,
    loadingModel: prescription.loadingModel, performedLibraryId: prescription.exerciseId,
    exerciseId: 'slot-a', session: 's'+i, date: date(i), created: date(i)+'T10:00:00Z',
    setIndex: j, ...extra,
  }));
}
const history = n => Array.from({length:n}, (_,i) => session(i)).flat();
const build = (log, lifts=[lift], now='2026-12-31') => Model.buildSavedProfile({log,lifts,now});
const first = log => build(log).lifts.find(l => l.active);
const check = (i,guess=8) => session(i).map((r,j) => j===3 ? {...r,effortSource:'failure',rir:0,calibration:{predictedReps:guess}} : r);

test('versioned projection starts empty and does not invent anchors from a program', () => {
  const out=build([]); assert.equal(out.version,'profile@084.1');
  assert.equal(out.units,0); assert.equal(out.budget,80); assert.equal(out.fill,0);
  assert.equal(out.lifts[0].stage,'first');
  assert.deepEqual(Model.PROFILE_WEIGHTS,{date:0.75,transition:8,dateCap:64,transitions:4});
});
test('Learning, Solid and date arithmetic use the actual historical standing boundary', () => {
  assert.equal(first(session(0)).stage,'learning'); assert.equal(first(session(0)).units,8.75);
  const out=first(history(2)); assert.equal(out.stage,'solid'); assert.equal(out.units,17.5);
  assert.deepEqual(out.transitions.map(t=>[t.stage,t.date]),[['learning',date(0)],['solid',date(1)]]);
});
test('saved test adds eight stage units, independent of its error', () => {
  const before=first(history(2)); const after=first([...history(2),...check(2,3)]);
  assert.equal(after.stage,'checked'); assert.equal(after.stageUnits-before.stageUnits,8);
  assert.equal(after.units-before.units,8.75);
});
test('agreeing checks use the shipped estimator, and survive expiry', () => {
  const rows=[...check(0,8),...check(14,7),...check(28,8)];
  const out=first(rows); assert.equal(out.stage,'calibrated');
  assert.equal(out.transitions.length,4); assert.equal(out.checks.length,3);
  assert.equal(out.current.calibration.n,0); assert.equal(out.current.standing.word,'learning');
  assert.equal(out.transitions[3].date,date(28));
});
test('consistent bias needs the same spread bound in both directions', () => {
  for(const guess of [4,12]) assert.equal(first([...check(0,guess),...check(14,guess),...check(28,guess)]).stage,'bias_understood');
  const rows=[...check(0,8),...check(14,13),...check(28,13)];
  assert.equal(Calibration.estimate([0,5,5]).state,'over');
  assert.equal(first(rows).transitions.length,3);
});
test('history thresholds have equal eight-unit transitions and reach the full eighty', () => {
  assert.equal(first(history(31)).transitions.length,2);
  assert.equal(first(history(32)).stage,'long_record');
  assert.equal(first(history(32)).stageUnits-first(history(31)).stageUnits,8);
  assert.equal(first(history(63)).transitions.length,3);
  const out=first(history(64)); assert.equal(out.stage,'established'); assert.equal(out.units,80);
  assert.equal(out.stageUnits-first(history(63)).stageUnits,8);
  assert.equal(out.current.calibration.n,0); assert.equal(first(history(70)).units,80);
});
test('test and history routes occupy the same transition, including tests acquired earlier', () => {
  const rows=history(64); rows.push(...check(70));
  assert.equal(first(rows).transitions.length,4); assert.equal(first(rows).stageUnits,32);
  assert.equal(first([...check(0),...history(4)]).transitions.length,3);
});
test('one date needs two distinct ordinary rows; failures and repeated imports cannot replace them', () => {
  assert.equal(first(session(0,{},1)).depthDates.length,0);
  assert.equal(first([...session(0,{},1),...session(0,{},1)]).depthDates.length,0);
  assert.equal(first([...session(0,{},1),...check(0).slice(-1)]).depthDates.length,0);
  assert.equal(first([...session(0),...session(0),...session(0,{session:'other'})]).depthDates.length,1);
});
test('word and numeric choices count equally; absent, prefilled and unsure provenance never become explicit', () => {
  for(const source of ['effort','rir','reps_left','reps_left_3plus','reps_left_5plus']) assert.equal(first(session(0,{effortSource:source})).depthDates.length,1);
  for(const source of [undefined,null,'prefilled','unsure','failure','unknown']) assert.equal(first(session(0,{effortSource:source})).depthDates.length,0);
});
test('warmups, ramps, invalid effort, invalid metrics and future/undated rows add no depth', () => {
  for(const extra of [{warmup:true},{origin:'ramp'},{work:false},{rir:null},{rir:NaN},{metricValues:[]},{date:'invalid'},{date:'2027-01-01'}])
    assert.equal(first(session(0,extra)).depthDates.length,0,JSON.stringify(extra));
});
test('duplicate slots and aliases share evidence; equipment and metric semantics do not', () => {
  const alias={...lift,id:'other',slotId:'other',name:'My machine'};
  assert.equal(build(history(2),[lift,alias]).budget,80);
  const machine={...alias,context:{...context,equipmentId:'rack-b'}};
  const out=build(history(2),[lift,machine]); assert.equal(out.budget,160);
  assert.equal(out.lifts.filter(l=>l.active&&l.units===0).length,1);
  assert.notEqual(Engine.savedLiftIdentity(lift),Engine.savedLiftIdentity({...lift,context:{...context,externalLoadMultiplier:2}}));
});
test('performed movement wins over template identity and display names', () => {
  const rows=history(2).map(r=>({...r,exerciseId:'another-slot',sourceLibraryId:'other',name:'Alias',performedName:'Alias'}));
  assert.equal(first(rows).stage,'solid');
  assert.equal(first(rows.map(r=>({...r,performedLibraryId:'other'}))).units,0);
});
test('scope retains evidence across programs and archives lifts outside the denominator', () => {
  const rows=history(2); const old=build(rows); const replacement={...lift,exerciseId:'new'};
  const out=build(rows,[lift,replacement]); assert.equal(out.units,old.units); assert.equal(out.budget,160);
  const archived=build(rows,[replacement]); assert.equal(archived.units,0); assert.equal(archived.budget,80);
  assert.equal(archived.lifts.find(l=>!l.active).units,old.units);
  assert.equal(build(rows,[{...lift,slotId:'new-program'}]).units,old.units);
});
test('rest never decays attained evidence; edits, deletion and backup replacement rederive it', () => {
  const rows=history(4),copy=structuredClone(rows);
  assert.equal(build(rows,[lift],date(4)).units,build(rows,[lift],'2029-01-01').units);
  assert.equal(first(rows.filter(r=>r.session!=='s0')).depthDates.length,3);
  assert.equal(first(rows.map(r=>({...r,effortSource:'prefilled'}))).units,0);
  assert.equal(build([]).units,0); assert.deepEqual(rows,copy);
  assert.deepEqual(build(JSON.parse(JSON.stringify(rows))),build(rows));
});
test('unsupported legacy context stays unavailable, without inferred prescriptions', () => {
  for(const extra of [{loadingContext:null},{metricDefinitions:undefined},{performedLibraryId:null},{loadingConvention:undefined}])
    assert.equal(first(history(4).map(r=>({...r,...extra}))).units,0);
  const out=build(history(2).map(r=>({...r,loadingContext:null})));
  assert.equal(out.unsupportedRows,8);
});
test('saved evidence reader agrees with shipped standing without any historical prescription target', () => {
  const input=structuredClone(cases.find(c=>c.name==='four-sessions').input);
  const read=Engine.readSavedLift(lift,input[1],{now:input[4].now});
  assert.deepEqual(read.standing,Engine.recommendSets(...input)[0].standing);
  assert.equal(read.sessions.length,4);
  assert.deepEqual(Engine.recommendSets(...input),Engine.recommendSets(...structuredClone(input)));
});
