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
const check = (i,guess=8) => session(i).map((r,j) => j===3 ? {...r,effortSource:'failure',rir:0,calibration:{v:1,predictedReps:guess,predictionEdited:true,prefillBasis:"reps"}} : r);

test('versioned projection starts empty and does not invent anchors from a program', () => {
  const out=build([]); assert.equal(out.version,'profile@084.2');
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
test('date eligibility uses the standing row-quality weights, including older unknown provenance', () => {
  for(const source of ['effort','rir','reps_left','reps_left_3plus','reps_left_5plus']) assert.equal(first(session(0,{effortSource:source})).depthDates.length,1);
  for(const source of [undefined,null]) assert.equal(first(session(0,{effortSource:source})).depthDates.length,1);
  for(const source of ['prefilled','unsure','failure','unknown']) assert.equal(first(session(0,{effortSource:source})).depthDates.length,0);
  for(const source of [undefined,null,'effort','reps_left_3plus','reps_left_5plus']){
    assert.equal(first(session(0,{effortSource:source},2)).depthDates.length,1);
    assert.equal(first(session(0,{effortSource:source},2)).depthSteps,0.5);
    assert.equal(first(session(0,{effortSource:source},4)).depthDates.length,1);
  }
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

test('all shipped standing fixtures retain selection and standing after sharing the reader', () => {
  const frozen=require('./fixtures/engine-standing.json');
  for(const {name,input} of cases) {
    const {standing,...selection}=Engine.recommendSets(...structuredClone(input))[0];
    assert.deepEqual(selection,frozen.cases[name],name);
    if(!['configuration-required','invalid','live-only','warmup'].includes(name)) {
      const [ps,hs,,,settings]=structuredClone(input);
      const actual=Engine.readSavedLift({...ps[0],context:input[3].bySlotId?.[ps[0].slotId]},hs,settings);
      if(actual.available && standing.word!=='first') assert.deepEqual(actual.standing,standing,name);
    }
  }
});
test('a later test updates the explanation without another transition', () => {
  const out=first([...history(32),...check(40)]);
  assert.equal(out.stage,'checked'); assert.equal(out.transitions.length,3);
  assert.equal(out.transitions[2].stage,'long_record');
});
test('malformed calibration is not a check, even when a failure row has valid metrics', () => {
  const rows=[...history(2),...check(3)].map(r=>r.calibration?{...r,calibration:{predictedReps:8}}:r);
  assert.equal(first(rows).checks.length,0); assert.equal(first(rows).stage,'solid');
});
test('history replay uses the context at the boundary and preserves early Solid beyond thirty sets', () => {
  const rows=history(70); assert.equal(first(rows).transitions[1].date,date(1));
  const broken=[...history(4),...session(80)];
  assert.equal(first(broken).transitions[1].date,date(1));
  assert.equal(first(broken).current.standing.word,'learning');
});
test('scope has no four-lift cap and no-program has no ring budget', () => {
  const lifts=Array.from({length:8},(_,i)=>({...lift,exerciseId:'lift-'+i}));
  assert.equal(build([],lifts).budget,640);
  const archived=build(history(2),[]);assert.equal(archived.budget,0);assert.equal(archived.fill,0);
  assert.equal(archived.lifts[0].active,false);
});
test('opening-load provenance is descriptive and never grants a date or stage', () => {
  const row=session(0,{effortSource:'prefilled',startingLoad:{v:1,openingKg:40}});
  const out=first(row);assert.equal(out.units,0);assert.equal(out.anchor.opening,40);
  assert.equal(first([...row,...session(1)]).stage,'learning');
});
test('bodyweight and per-side observations use their saved metric semantics', () => {
  const Metrics=require('../exercise-metrics.js');
  const defs=semantics=>semantics.map(s=>Metrics.DEFINITIONS.find(d=>d.semantic===s));
  const bwDefs=defs(['reps']);
  const bw={...lift,metricIds:bwDefs.map(m=>m.id),metricDefinitions:bwDefs,loadingModel:{bodyweightCoefficient:1},
    context:{equipmentId:'rack-a',loadingConvention:'bodyweight',externalLoadMultiplier:0,bodyweightContributionEnabled:true,bodyweightKg:80,bodyweightCoefficient:1}};
  const adapt=(r,l)=>({...r,metricIds:l.metricIds,metricDefinitions:l.metricDefinitions,loadingModel:l.loadingModel,
    loadingConvention:l.context.loadingConvention,loadingContext:l.context,
    metricValues:l.metricDefinitions.map(m=>({metricId:m.id,value:m.semantic.startsWith('reps')?8:m.semantic==='loadPerSideKg'?20:100,unit:m.unit}))});
  assert.equal(build(history(2).map(r=>adapt(r,bw)),[bw]).lifts[0].stage,'solid');
  const sideDefs=defs(['repsPerSide','loadPerSideKg']);
  const side={...lift,metricIds:sideDefs.map(m=>m.id),metricDefinitions:sideDefs,
    context:{...context,executionMode:'unilateral',loadingConvention:'per_side',externalLoadMultiplier:1,bodyweightCoefficient:0}};
  const rows=history(2).map(r=>adapt(r,side));
  assert.equal(build(rows,[side]).lifts[0].stage,'solid');
  const other={...side,context:{...side.context,executionMode:'bilateral',externalLoadMultiplier:2}};
  const out=build(rows,[other]);assert.equal(out.lifts.find(l=>l.active).units,0);
  const externalDefs=defs(['loadKg','repsPerSide']);
  const external={...lift,metricIds:externalDefs.map(m=>m.id),metricDefinitions:externalDefs,context:{...context,executionMode:'unilateral'}};
  const raw=history(2).map(r=>({...adapt(r,external),exerciseId:prescription.exerciseId,completed:true}));
  const read=Engine.readSavedLift({...external,context:{...external.context,executionMode:'bilateral'}},[{sessionId:'s',completed:true,date:date(1),sets:raw}],{now:date(1)});
  assert.equal(read.sessions.length,0);assert.equal(read.standing.word,'first');
});
test('checks on different equipment cannot combine into an agreeing calibration', () => {
  const other=check(19).map(r=>({...r,equipmentId:'rack-b'}));
  const out=first([...history(2),...check(5),...other,...check(33)]);
  assert.equal(out.stage,'checked');assert.equal(out.checks.length,2);
});
test('a calibrated pattern acquired before Solid can satisfy the later stage after a break', () => {
  const early=[...check(0),...check(14),...check(28)].map(r=>r.effortSource==='failure'?r:{...r,effortSource:'effort'});
  assert.equal(first(early).stage,'learning');
  const later=[100,101,102,103].flatMap(i=>session(i));
  const out=first([...early,...later]);
  assert.equal(out.stage,'calibrated'); assert.equal(out.transitions.length,4);
  assert.equal(out.current.calibration.n,0);
});

test('identity ignores execution metadata for metrics that do not distinguish sides', () => {
  assert.equal(Engine.savedLiftIdentity(lift),Engine.savedLiftIdentity({...lift,context:{...context,executionMode:'bilateral'}}));
});

test('the catalog lifter has explicit saved effort and Learning wherever its comparable history anchors', async () => {
  const {DIRECTION_D_CANONICAL_DATA:data}=await import('../tools/ui-screens/direction-d-canonical-fixture.generated.mjs');
  const row=data.log[0];
  const descriptor={exerciseId:row.performedLibraryId,metricType:row.metricType,
    metricIds:row.metricIds,metricDefinitions:row.metricDefinitions,loadingModel:row.loadingModel,
    context:{...row.loadingContext,equipmentId:row.equipmentId,loadingConvention:row.loadingConvention}};
  const log=data.log.filter(item=>item.session===row.session&&item.performedLibraryId===row.performedLibraryId);
  const history=[{sessionId:row.session,date:row.date,completed:true,
    sets:log.map(item=>({...item,exerciseId:item.performedLibraryId,completed:true}))}];
  const read=Engine.readSavedLift(descriptor,history,{now:row.date});
  assert.ok(read.sessions.length>0);
  assert.equal(read.standing.word,'learning');
  const projection=build(log,[descriptor],row.date).lifts[0];
  assert.equal(projection.depthDates.length,1);
  assert.equal(projection.stage,'learning');
  // Older rows retain unknown provenance and use the standing producer's half weight.
  const unknown=log.map(({effortSource,...item})=>item);
  const older=build(unknown,[descriptor],row.date).lifts[0];
  assert.equal(older.depthDates.length,1);
  assert.equal(older.stage,'learning');
});

function engineHistory(log) {
  return [...new Set(log.map(row=>row.session))].map(sessionId=>({sessionId,completed:true,
    date:log.find(row=>row.session===sessionId).date,
    sets:log.filter(row=>row.session===sessionId).map(row=>({...row,exerciseId:row.performedLibraryId,completed:true}))}));
}

test('older numeric RIR history earns dates and the same Learning/Solid standing as the engine', () => {
  for(const n of [1,2,4]){
    const rows=history(n).map(({effortSource,...row})=>row),now=date(n-1);
    const input=[[prescription],engineHistory(rows),[],{bySlotId:{[prescription.slotId]:context}},{now}];
    const recommendation=Engine.recommendSets(...input)[0];
    assert.equal(recommendation.historyAnchor.source,'history');
    const profile=build(rows,[lift],now).lifts[0];
    assert.equal(profile.depthDates.length,n);
    assert.equal(profile.stage,recommendation.standing.word);
    assert.equal(profile.current.standing.evidence.sets,recommendation.standing.evidence.sets);
    assert.equal(profile.current.standing.evidence.sessions,recommendation.standing.evidence.sessions);
  }
});

test('profile transitions never outrank the engine at their saved historical boundary', () => {
  const rank={first:0,learning:1,solid:2};
  for(const source of [undefined,null,'rir','reps_left','effort','reps_left_3plus','reps_left_5plus','prefilled','unsure','failure'])
    for(const count of [1,2,3,4,6]){
      const rows=Array.from({length:4},(_,i)=>session(i,{effortSource:source},count)).flat();
      const profile=build(rows,[lift],date(3)).lifts[0];
      for(const transition of profile.transitions.filter(item=>item.stage==='learning'||item.stage==='solid')){
        const boundary=rows.filter(row=>row.date<=transition.date);
        const engine=Engine.readSavedLift(lift,engineHistory(boundary),{now:transition.date});
        assert.ok(rank[transition.stage]<=rank[engine.standing.word],JSON.stringify({source,count,transition,engine:engine.standing}));
      }
      const saved=engineHistory(rows);
      const supported=saved.map((session,index)=>Engine.readSavedLift(lift,saved.slice(0,index+1),{now:session.date}));
      const ceiling=Math.max(0,...supported.map(read=>rank[read.standing?.word]??0));
      const attained=profile.stage==='first'?0:profile.stage==='learning'?1:2;
      assert.ok(attained<=ceiling,JSON.stringify({source,count,stage:profile.stage,ceiling}));
      if(source===undefined&&count===4)assert.equal(profile.stage,'solid');
    }
});

test('date credit preserves standing row quality and caps each calendar date at one step', () => {
  for(const source of [undefined,null,'effort','reps_left_3plus','reps_left_5plus']){
    for(const count of [2,3,4,6]){
      const out=first(session(0,{effortSource:source},count));
      assert.equal(out.depthSteps,Math.min(1,count*0.5/2));
      assert.equal(out.dateUnits,0.75*Math.min(1,count*0.5/2));
    }
  }
  assert.equal(first(session(0,{},2)).depthSteps,1);
  assert.equal(first([...session(0,{effortSource:undefined},2),...session(0,{session:'second',effortSource:undefined},2)]).depthSteps,1);
  assert.equal(first([...session(0,{effortSource:undefined},2),...session(0,{effortSource:undefined},2)]).depthSteps,0.5);
});
