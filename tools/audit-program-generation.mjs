#!/usr/bin/env node
// Read-only audit of the real compiler; artifacts are not runtime assets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(path.join(root, 'program-compiler.js'));
const P = require(path.join(root, 'progression-engine.js'));
const E = require(path.join(root, 'program-entry.js'));
const A = require(path.join(root, 'program-entry-adapter.js'));
const {EXERCISE_LIBRARY: library} = require(path.join(root, 'exercises.js'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/program-family-contract-v1.json')));
const out = path.resolve(root, process.argv[2] || 'docs/audits/program-generation-2026-10-03');
const clone = x => structuredClone(x);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const intersect = (a,b) => a.some(x => b.includes(x));
const hash = x => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const sum = xs => xs.reduce((a,b) => a+b, 0);
const unique = xs => [...new Set(xs)];
const slots = r => r.days.flatMap(d => d.slots);
const tally = xs => Object.fromEntries(unique(xs).sort().map(x => [x, xs.filter(v => v === x).length]));
const stats = xs => {
  const s = [...xs].sort((a,b) => a-b);
  const q = p => s[Math.min(s.length-1, Math.floor((s.length-1)*p))] ?? null;
  return {min:q(0), median:q(.5), p95:q(.95), max:q(1), mean:xs.length ? sum(xs)/xs.length : null};
};
const gym = ['barbell','dumbbell','machine','cable','smith'];
const increments = {barbell:2.5,dumbbell:2,machine:5,cable:5,smith:2.5};
const base = (familyId,frequency,extra={}) => ({schemaVersion:2,familyId,frequency,
  sessionMinutes:90,preferredRestSeconds:null,equipment:familyId==='home'?[]:gym,
  environment:familyId==='home'?[]:['safe_pull','training_support'],
  loadIncrements:familyId==='home'?{}:increments,primaryMuscles:[],deEmphasizedMuscles:[],
  ignoredMuscles:[],priorityMovements:[],preferences:[],dislikes:[],history:[],
  profile:'standard',recentConsistency:'consistent',reentryEnabled:false,weekNumber:1,...extra});

// Freeze methodology before collecting outputs. All probabilities are assumptions.
const prior = {
  family:[['growth',.4],['balanced',.3],['strength',.15],['home',.15]],
  frequency:[[2,.15],[3,.35],[4,.3],[5,.12],[6,.08]],
  minutes:[[30,.05],[45,.25],[60,.4],[75,.15],[90,.15]],
  profile:[['standard',.65],['foundation',.35]],
  consistency:[['consistent',.75],['interrupted',.15],['returning',.1]],
  gymEquipment:[['full_gym',.85],['machines_only',.15]],
  homeEquipment:[['bodyweight_only',.6],['dumbbells',.25],['bands',.15]],
  preference:[['none',.8],['chest_priority',.2]],
};
const probes = [], programs = [];
function probe(id,input,expected,category,extra={}) {
  let result, error=null; const start=performance.now();
  try { result=C.compile(input,library); } catch(e) { error=`${e.name}: ${e.message}`; }
  const record={id,category,input:clone(input),expected,actual:error?'throw':result.kind,
    pass:!error && (Array.isArray(expected)?expected.includes(result.kind):result.kind===expected),
    elapsedMs:performance.now()-start,result:result?.kind==='compiled'?{
      kind:result.kind,blueprintId:result.blueprintId,outputHash:hash(result),
      directIndirectExposure:result.directIndirectExposure,limitations:result.limitations,reductions:result.reductions,
    }:result||null,error,...extra};
  probes.push(record); return result;
}
function minimum(id,context) {
  for(const m of [30,45,60,75,90]) {
    const input={...context,sessionMinutes:m};
    const result=probe(`${id}-m${m}`,input,['conflict','compiled'],'time_boundary_search');
    if(result?.kind==='compiled') {
      return {input,result,minimumMinutes:m};
    }
    assert.equal(result?.kind,'conflict',`${id}: valid time search must return typed conflicts`);
  }
  throw new Error(`${id}: no feasible result; do not silently relax constraints`);
}

// Independent numeric bounds are frozen from the documented class contract.
const bounds={heavy_3_6:{sets:[2,3],reps:[3,6],rest:[120,240],rir:[2,3]},
  compound_4_8:{sets:[2,3],reps:[4,8],rest:[90,180],rir:[1,3]},
  compound_8_12:{sets:[2,3],reps:[8,12],rest:[90,180],rir:[1,3]},
  isolation_8_15:{sets:[1,3],reps:[8,15],rest:[60,120],rir:[1,3]}};

function evaluate(input,r,{repeat=true}={}) {
  const dimensions={}, findings=[], advisories=[];
  const check=(dimension,ok,detail,slotId=null) => {
    dimensions[dimension] ||= {checks:0,failures:[]}; dimensions[dimension].checks++;
    if(!ok) { const f={dimension,detail,...(slotId?{slotId}:{})};
      dimensions[dimension].failures.push(f); findings.push(f); }
  };
  const normalized=C.validateContext(input).value;
  const blueprint=C.BLUEPRINTS.find(b=>b.id===r.blueprintId);
  const authored=contract.blueprints.find(b=>b.blueprintId===r.blueprintId);
  const ss=slots(r), allIds=ss.map(s=>s.slotId), dayIds=r.days.map(d=>d.dayId);
  check('structure',r.kind==='compiled' && r.familyId===input.familyId && r.frequency===input.frequency && r.days.length===input.frequency,'Requested family/frequency preserved');
  check('structure',same(authored?.dayLabels,r.days.map(d=>d.label)),'Day labels match independent owner-approved contract');
  check('identity',unique(allIds).length===allIds.length && unique(dayIds).length===dayIds.length,'Unique slot and day identities');
  check('projection',r.program.length===ss.length,'Every resolved slot exported exactly once');
  check('provenance',r.provenance.blueprintId===blueprint.id && same(r.provenance,r.programStructure.provenance),'Pinned provenance survives export');
  if(repeat) {
    const before=JSON.stringify(input), catalogBefore=hash(library);
    const again=C.compile(input,library), reordered=C.compile(clone(input),[...library].reverse());
    check('determinism',same(r,again),'Identical inputs produce identical full output');
    check('determinism',same(r,reordered),'Catalogue permutation preserves full output');
    check('non_mutation',before===JSON.stringify(input) && catalogBefore===hash(library),'Compiler does not mutate context or catalogue');
  }
  const direct={},indirect={},patterns={};
  for(let di=0;di<r.days.length;di++) {
    const d=r.days[di];
    for(let si=0;si<blueprint.days[di].slots.length;si++) {
      const raw=blueprint.days[di].slots[si], c={...C.SLOT_TEMPLATES[raw.template],...raw};
      if(c.status==='protected' || (c.priorityBehavior==='protect_when_capable' && ss.some(s=>s.templateId===raw.template)))
        check('protected_coverage',d.slots.some(s=>s.slotId===`${d.dayId}_s${si+1}`),'Authored protected slot remains present',`${d.dayId}_s${si+1}`);
    }
    const estimate=C.estimateDaySeconds(d);
    check('time_ceiling',estimate<=input.sessionMinutes*60,'Compiler estimate within ceiling',d.dayId);
    for(const s of d.slots) {
      const e=s.exercise,p=s.prescription,c=s.contract,b=bounds[p.classId],id=s.slotId;
      check('identity',s.dayId===d.dayId,'Slot refers to containing day',id);
      check('equipment',normalized.equipment.includes(e.equipment),'Uses owned equipment',id);
      check('environment',e.environmentRequirements.every(x=>normalized.environment.includes(x)),'Required environment is available',id);
      const capabilities=[...normalized.environment,...(normalized.equipment.some(x=>x!=='bodyweight')?['external_resistance']:[])];
      check('environment',c.requiredCapabilities.every(x=>capabilities.includes(x)),'Required slot capabilities available',id);
      check('slot_intent',intersect(e.patterns,c.patterns) && intersect([...e.primaryMuscles,...e.secondaryMuscles],[...c.primaryMuscles,...c.secondaryMuscles]),'Movement and muscle intent compatible',id);
      check('slot_intent',Object.entries(c.requiredCharacteristics).every(([k,v])=>v.includes(e[k])),'Required characteristics hold',id);
      if(!intersect(e.primaryMuscles,c.primaryMuscles)) advisories.push({code:'primary_intent_only_secondary',detail:`${id} (${s.templateId}) intends ${c.primaryMuscles.join('/')} but ${e.name} primarily targets ${e.primaryMuscles.join('/')}. Compatibility comes through secondary muscle intent.`});
      check('prescription_bounds',!!b && p.sets>=b.sets[0] && p.sets<=b.sets[1],`Sets ${p.sets} within documented ${b?.sets.join('–')} bounds`,id);
      check('prescription_bounds',!!b && p.repMin===b.reps[0] && p.repMax===b.reps[1] && p.repMin>=e.practicalRepRange[0] && p.repMax<=e.practicalRepRange[1],'Rep range is class- and exercise-compatible',id);
      const rir=p.efficient && p.classId!=='heavy_3_6'?[0,2]:b.rir;
      check('prescription_bounds',p.targetRirMin>=rir[0] && p.targetRirMax<=rir[1] && p.targetRirMin<=p.targetRirMax,'RIR within authored range',id);
      check('rest_bounds',p.restSeconds>=b.rest[0] && p.restSeconds<=b.rest[1],'Rest respects class floor and ceiling',id);
      check('progression_validity',P.validatePrescription(p.progression).ok,'Real progression consumer accepts envelope',id);
      check('preferences',!normalized.dislikes.includes(e.id) && !intersect(e.primaryMuscles,normalized.ignoredMuscles),'Dislikes and ignored direct muscle work excluded',id);
      check('loading',!['bodyweight','ordinal'].includes(e.loading) || e.loadIncrement===null,'No invented kilogram increment for bodyweight/bands',id);
      if(input.profile==='foundation') {
        check('foundation',p.progression.strategy.id==='range' && s.status!=='optional','Foundation uses range without optional complexity',id);
        if(p.targetRirMin<Math.min(2,rir[1])) advisories.push({code:'foundation_effort_after_reduction',detail:`${id}: time reduction lowers Foundation RIR floor to ${p.targetRirMin}; conservative initialization selected ${Math.min(2,rir[1])}. This remains inside the authored efficient RIR band.`});
      }
      const projected=r.program.filter(x=>x.slotId===id);
      check('projection',projected.length===1 && projected[0].dayId===d.dayId && projected[0].libraryId===e.id && projected[0].sets===p.sets,`Exported sets/identity match resolved slot (resolved ${p.sets}, exported ${projected[0]?.sets})`,id);
      for(const m of e.primaryMuscles) direct[m]=(direct[m]||0)+p.sets;
      for(const m of e.secondaryMuscles) indirect[m]=(indirect[m]||0)+p.sets;
      for(const m of e.patterns) patterns[m]=(patterns[m]||0)+p.sets;
    }
  }
  const sorted=x=>Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)));
  check('exposure_accounting',same(sorted(direct),sorted(r.directIndirectExposure.direct)) && same(sorted(indirect),sorted(r.directIndirectExposure.indirect)),'Exposure independently recomputed from resolved slots');
  const exportExposure={};
  for(const e of r.program) for(const m of e.primary.split(',').filter(Boolean)) exportExposure[m]=(exportExposure[m]||0)+e.sets;
  check('exposure_accounting',same(sorted(exportExposure),sorted(direct)),'Exposure matches exported program set counts');
  for(const relation of r.relations) {
    const heavy=ss.find(s=>s.slotId===relation.heavySlotId),volume=ss.find(s=>s.slotId===relation.volumeSlotId);
    check('relations',!!heavy && !!volume,'Relation endpoints exist');
    if(relation.state==='attached') check('relations',heavy?.exercise.id===volume?.exercise.id && heavy?.prescription.progression.strategy.id==='anchor_backoff' && volume?.prescription.progression.strategy.id==='rep_goal','Attached relation has exact movement and compatible strategies');
  }
  if(input.profile==='foundation') check('foundation',r.relations.length===0,'Foundation has no paired relations');
  check('reentry',r.weeks.length===6,'Six-week schedule exported');
  const normalFrom=!input.reentryEnabled||input.recentConsistency==='consistent'?1:input.recentConsistency==='interrupted'?2:3;
  for(const w of r.weeks) {
    check('reentry',same(w.days.map(d=>d.dayId),dayIds),'Week preserves day identities');
    const targets=w.days.flatMap(d=>d.slots);
    check('reentry',same(targets.map(t=>t.slotId),allIds),'Week preserves slot identities');
    for(const t of targets) {
      const s=ss.find(s=>s.slotId===t.slotId);
      check('reentry',!!s && Number.isInteger(t.sets) && t.sets>=0 && t.sets<=s.prescription.sets && (w.week<normalFrom || t.sets===s.prescription.sets),'Re-entry only reduces sets and returns to normal on time',t.slotId);
    }
    const projected=C.projectProgramForWeek(r.program,r.programStructure,w.week);
    check('week_projection',projected.every(e=>targets.some(t=>t.slotId===e.slotId && t.sets===e.sets)) && projected.length===targets.filter(t=>t.sets>0).length,'Projected weekly program matches week prescription');
  }
  const dayMetrics=r.days.map(d=>{
    const counts=tally(d.slots.map(s=>s.exercise.id));
    const exported=d.slots.map(s=>({...s,prescription:{...s.prescription,sets:r.program.find(e=>e.slotId===s.slotId)?.sets||s.prescription.sets}}));
    return {dayId:d.dayId,label:d.label,slots:d.slots.length,sets:sum(d.slots.map(s=>s.prescription.sets)),
      exportedSets:sum(r.program.filter(e=>e.dayId===d.dayId).map(e=>e.sets)),
      estimateMinutes:C.estimateDaySeconds(d)/60,exportEstimateMinutes:C.estimateDaySeconds({...d,slots:exported})/60,
      duplicates:Object.entries(counts).filter(([,n])=>n>1),
      systemicSlots:d.slots.filter(s=>s.exercise.fatigueDemand==='higher_systemic').length,
      stations:unique(d.slots.map(s=>s.exercise.equipment)).length};
  });
  check('time_ceiling',dayMetrics.every(d=>d.exportEstimateMinutes<=input.sessionMinutes),'Same time model applied to exported set counts stays within ceiling');
  const totals={chest:direct.chest||0,pull:(direct.back||0)+(direct.lats||0),quads:direct.quads||0,
    posterior:(direct.hamstrings||0)+(direct.glutes||0)};
  if(dayMetrics.some(d=>d.duplicates.length)) advisories.push({code:'duplicate_exercise_within_day',detail:'One exercise fills multiple jobs in the same session; inspect redundant work and slot intent.',days:dayMetrics.filter(d=>d.duplicates.length).map(d=>({dayId:d.dayId,duplicates:d.duplicates}))});
  const missing=Object.entries(totals).filter(([,n])=>n===0).map(([m])=>m);
  if(missing.length) advisories.push({code:'major_region_without_direct_work',detail:`No direct work for: ${missing.join(', ')}. Secondary exposure is listed separately; home pulling limitations may be expected.`});
  const high=Object.entries(direct).filter(([,n])=>n>20);
  if(high.length) advisories.push({code:'high_direct_exposure',detail:`Review direct sets above 20: ${high.map(([m,n])=>`${m} ${n}`).join(', ')}. The threshold is a review heuristic, not an approved maximum.`});
  if(dayMetrics.some(d=>d.systemicSlots>=3)) advisories.push({code:'systemic_work_cluster',detail:'At least three higher-systemic-demand exercises in one session; review recoverability.'});
  if(dayMetrics.some(d=>input.sessionMinutes-d.exportEstimateMinutes<2)) advisories.push({code:'little_time_slack',detail:'Less than two minutes of slack on at least one day; real setup/queues may exceed the model.'});
  if(input.familyId==='home' && !normalized.environment.includes('safe_pull')) advisories.push({code:'home_pull_limitation',detail:'Safe pulling unavailable; full pulling coverage is not promised.'});
  const selected=unique(ss.map(s=>s.exercise.id));
  const unmatched=normalized.preferences.filter(id=>!selected.includes(id));
  if(unmatched.length) advisories.push({code:'unmatched_exercise_preference',detail:`Preferred exercises not selected: ${unmatched.join(', ')}. Preferences rank compatible candidates; they are not guaranteed inclusions.`});
  const primaryUnserved=normalized.primaryMuscles.filter(m=>!(direct[m]>0));
  if(primaryUnserved.length) advisories.push({code:'unserved_priority',detail:`No direct exposure for requested priority: ${primaryUnserved.join(', ')}`});
  return {verdict:findings.length?'contract_fail':advisories.length?'review':'pass',dimensions,findings,advisories,
    metrics:{weeklySets:sum(ss.map(s=>s.prescription.sets)),exportedWeeklySets:sum(r.program.map(e=>e.sets)),
      dayMetrics,direct,indirect,patterns,selectedExerciseIds:selected,
      strategies:tally(ss.map(s=>s.prescription.progression.strategy.id)),
      preferredSelected:normalized.preferences.filter(id=>selected.includes(id)),unmatchedPreferences:unmatched,
      primaryUnserved,limitations:r.limitations,reductions:r.reductions,
      timeUtilization:Math.max(...dayMetrics.map(d=>d.exportEstimateMinutes/input.sessionMinutes))}};
}

// Actual evaluator falsification: isolated corruptions must fail the owning dimension.
const witnessInput=base('growth',3),witness=C.compile(witnessInput,library);
const falsifications=[
  ['equipment',r=>r.days[0].slots[0].exercise.equipment='unowned'],
  ['identity',r=>r.days[0].slots[1].slotId=r.days[0].slots[0].slotId],
  ['time_ceiling',r=>r.days[0].slots[0].prescription.restSeconds=99999],
  ['progression_validity',r=>r.days[0].slots[0].prescription.progression.strategy.version=99],
  ['exposure_accounting',r=>r.directIndirectExposure.direct.chest=999],
  ['protected_coverage',r=>r.days[0].slots.shift()],
];
const checkerEvidence=falsifications.map(([dimension,mutate])=>{
  const bad=clone(witness);mutate(bad);const evaluation=evaluate(witnessInput,bad,{repeat:false});
  assert(evaluation.dimensions[dimension]?.failures.length,`Evaluator must detect ${dimension}`);
  return {dimension,rejected:true};
});
assert.equal(evaluate(witnessInput,witness).findings.length,0,'Unmodified witness passes contract checks');

function add(id,cohort,track,input,result,extra={}) {
  assert.equal(result.kind,'compiled',`${id} must be an actual generated program`);
  const answers={desiredResult:{growth:'muscle_growth',balanced:'balanced',strength:'strength',home:'muscle_growth'}[input.familyId],
    daysPerWeek:input.frequency,sessionMinutes:input.sessionMinutes,preferredRestSeconds:input.preferredRestSeconds,
    structuredExperience:input.profile==='foundation'?'first':'6_to_24m',
    recentConsistency:{consistent:'most',interrupted:'about_half',returning:'few'}[input.recentConsistency],
    environment:{kind:input.familyId==='home'?'limited_home':'commercial_gym',equipment:input.equipment,capabilities:input.environment},
    primaryMuscles:input.primaryMuscles||[],deEmphasizedMuscles:input.deEmphasizedMuscles||[],ignoredMuscles:input.ignoredMuscles||[],
    priorityMovements:input.priorityMovements||[],mustHaveExercises:input.preferences||[],
    exerciseConstraints:(input.dislikes||[]).map(exerciseId=>({exerciseId,reason:'dislike'}))};
  const state=E.setAnswers(E.selectRoute(E.createState({draftId:'audit',now:'2026-10-03T00:00:00.000Z',versions:A.currentVersions(C)}),'custom'),answers);
  const mapped=A.answersToCompilerContext(state.answers,{familyId:input.familyId,frequency:input.frequency,history:input.history||[]});
  assert(mapped.ok && same(C.compile(mapped.value,library),result),`${id}: accepted UI answers must reproduce the exact program`);
  const timings=[];
  for(let i=0;i<3;i++){const start=performance.now();C.compile(input,library);timings.push(performance.now()-start);}
  programs.push({id,cohort,track,input,result,evaluation:evaluate(input,result),latencyMs:stats(timings),answers,
    userChoiceProof:{entryAnswersAccepted:true,productionAdapterRoundTrip:true},...extra});
}

const ranked=[];
for(const [f,pf] of prior.family) for(const [d,pd] of prior.frequency)
for(const [m,pm] of prior.minutes) for(const [profile,pp] of prior.profile)
for(const [consistency,pc] of prior.consistency)
for(const [equipment,pe] of (f==='home'?prior.homeEquipment:prior.gymEquipment))
for(const [preference,pv] of prior.preference) {
  const answers={desiredResult:{growth:'muscle_growth',balanced:'balanced',strength:'strength',home:'muscle_growth'}[f],
    daysPerWeek:d,sessionMinutes:m,structuredExperience:profile==='foundation'?'first':'6_to_24m',
    recentConsistency:{consistent:'most',interrupted:'about_half',returning:'few'}[consistency],
    environment:{kind:f==='home'?'limited_home':'commercial_gym',
      equipment:equipment==='full_gym'?gym:equipment==='machines_only'?['machine']:equipment==='dumbbells'?['dumbbell']:equipment==='bands'?['band']:[],
      capabilities:f==='home'?[]:['safe_pull','training_support']},
    primaryMuscles:preference==='chest_priority'?['chest']:[]};
  const mapped=A.answersToCompilerContext(answers,{familyId:f,frequency:d});
  assert(mapped.ok);ranked.push({input:mapped.value,answers,priorMass:pf*pd*pm*pp*pc*pe*pv,equipment,preference});
}
assert(Math.abs(sum(ranked.map(x=>x.priorMass))-1)<1e-9);
ranked.sort((a,b)=>b.priorMass-a.priorMass || JSON.stringify(a.input).localeCompare(JSON.stringify(b.input)));
let rank=0;
for(const x of ranked) {
  rank++;const r=probe(`R-rank-${rank}`,x.input,['compiled','conflict'],'representative_ranked_input',{priorMass:x.priorMass,rank});
  if(r?.kind==='compiled') add(`R${String(programs.length+1).padStart(3,'0')}`,'representative',x.equipment,x.input,r,{assumedPriorMass:x.priorMass,rank,answers:x.answers});
  if(programs.length===100) break;
}
assert.equal(programs.length,100);

let sn=0;
for(const family of C.FAMILY_IDS) for(const frequency of C.FREQUENCIES) {
  for(const track of ['minimum_time_long_rest','foundation_under_time_pressure','sparse_equipment','preferences_and_exclusions','returning_with_priorities']) {
    const id=`S${String(++sn).padStart(3,'0')}`;
    let input,result,extra={};
    if(track==='minimum_time_long_rest' || track==='foundation_under_time_pressure') {
      const found=minimum(id,base(family,frequency,{preferredRestSeconds:180,
        profile:track==='foundation_under_time_pressure'?'foundation':'standard'}));
      ({input,result}=found);extra.minimumMinutes=found.minimumMinutes;
      extra.uiReachableBudget=true;
    } else {
      if(track==='sparse_equipment') input=base(family,frequency,{equipment:family==='home'?frequency%2?['band']:['dumbbell']:family==='growth'?['machine']:['barbell','machine'],
        environment:family==='home'?['safe_pull']:['safe_pull','training_support'],sessionMinutes:90});
      if(track==='preferences_and_exclusions') {
        const rich=base(family,frequency,{equipment:family==='home'?['dumbbell','band']:gym,environment:['safe_pull','training_support'],sessionMinutes:90});
        const baseline=C.compile(rich,library);assert.equal(baseline.kind,'compiled');
        const banned=unique(slots(baseline).map(s=>s.exercise.id)).slice(0,2);
        input={...rich,dislikes:banned,preferences:['ip_db','rw_db','cu_cb'],history:[{libraryId:'sq_sm'},{libraryId:'pd_bw'}],ignoredMuscles:['biceps','triceps']};
      }
      if(track==='returning_with_priorities') input=base(family,frequency,{equipment:family==='home'?['dumbbell','band']:gym,
        environment:['safe_pull','training_support'],sessionMinutes:90,preferredRestSeconds:180,
        primaryMuscles:['chest','quads'],deEmphasizedMuscles:['calves','biceps'],ignoredMuscles:['triceps'],
        priorityMovements:['press','row'],recentConsistency:'returning',reentryEnabled:true,weekNumber:1});
      result=probe(`${id}-initial`,input,'compiled',track);
      assert.equal(result?.kind,'compiled',`${id} ${family} ${frequency} ${track}: retain failure rather than replace scenario`);
      extra.uiReachableBudget=true;
    }
    add(id,'stress',track,input,result,extra);
  }
}
assert.equal(programs.length,200);

// Differential probes isolate one variable at a time on every authored sibling.
const differentials=[];
for(const family of C.FAMILY_IDS) for(const frequency of C.FREQUENCIES) {
  const input=base(family,frequency,{sessionMinutes:90}),r=C.compile(input,library);
  const rs=C.compile({...input,preferredRestSeconds:180},library);
  const fs=C.compile({...input,profile:'foundation'},library);
  const re=C.compile({...input,recentConsistency:'returning',reentryEnabled:true},library);
  const rr=C.compile({...input,primaryMuscles:['chest']},library);
  const longer=C.compile({...input,sessionMinutes:75},library);
  const restMonotone=slots(rs).every(s=>s.prescription.restSeconds>=slots(r).find(x=>x.slotId===s.slotId)?.prescription.restSeconds);
  const noTimeFill=same(r.days,longer.days);
  const reentryOnlySets=same(r.days,re.days) && same(r.relations,re.relations);
  const foundationSimplifies=slots(fs).every(s=>s.prescription.progression.strategy.id==='range') && fs.relations.length===0;
  const priorityDelta=(rr.directIndirectExposure.direct.chest||0)-(r.directIndirectExposure.direct.chest||0);
  differentials.push({family,frequency,restMonotone,noTimeFill,reentryOnlySets,foundationSimplifies,priorityChestDirectSetDelta:priorityDelta,
    homePullWithCapability:family==='home'?C.compile({...input,environment:['safe_pull']},library).directIndirectExposure.direct:null});
}

// Additional probes only combine supported user choices. No malformed inputs.
for(const family of C.FAMILY_IDS) for(const frequency of C.FREQUENCIES)
for(const [name,patch] of [
  ['tight_long_rest',{sessionMinutes:30,preferredRestSeconds:180}],
  ['ignored_required_quads',{ignoredMuscles:['quads']}],
  ['ignored_required_chest',{ignoredMuscles:['chest']}],
  ['no_pulling_equipment',{equipment:[],environment:[]}],
]) probe(`E-${family}-${frequency}-${name}`,{...base(family,frequency),...patch},['compiled','conflict'],'user_choice_edge');

function aggregate(ps) {
  const ss=ps.flatMap(p=>slots(p.result)), ids=ss.map(s=>s.exercise.id), counts=tally(ids);
  const signatures=ps.map(p=>hash(p.result.program.map(e=>({day:e.dayId,slot:e.slotId,exercise:e.libraryId,sets:e.sets,reps:[e.min,e.max],rir:[e.targetRirStart,e.targetRirEnd],progression:e.progression}))));
  const sequences=ps.map(p=>hash(p.result.days.map(d=>d.slots.map(s=>s.exercise.id))));
  const completePlans=ps.map(p=>hash({program:p.result.program,weeks:p.result.weeks,relations:p.result.relations}));
  const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const entropy=-sum(Object.values(counts).map(n=>n/ids.length*Math.log2(n/ids.length)));
  const dimensions=unique(ps.flatMap(p=>Object.keys(p.evaluation.dimensions)));
  const group=tally(signatures);
  return {programs:ps.length,verdicts:tally(ps.map(p=>p.evaluation.verdict)),families:tally(ps.map(p=>p.input.familyId)),
    frequencies:tally(ps.map(p=>p.input.frequency)),profiles:tally(ps.map(p=>p.input.profile)),
    consistency:tally(ps.map(p=>p.input.recentConsistency)),tracks:tally(ps.map(p=>p.track)),
    blueprintCoverage:unique(ps.map(p=>p.result.blueprintId)).length,blueprints:tally(ps.map(p=>p.result.blueprintId)),
    exactPrescriptionSignatures:unique(signatures).length,exerciseSequenceSignatures:unique(sequences).length,
    completePlanSignatures:unique(completePlans).length,
    largestPrescriptionDuplicateCluster:Math.max(...Object.values(group)),
    uniqueExercises:unique(ids).length,catalogueSize:library.length,catalogueCoverage:unique(ids).length/library.length,
    unusedCatalogueIds:library.filter(e=>!counts[e.id]).map(e=>e.id),
    topExercises:top.slice(0,15).map(([id,count])=>({id,name:library.find(e=>e.id===id)?.name,count,share:count/ids.length})),
    topTenExerciseShare:sum(top.slice(0,10).map(([,n])=>n))/ids.length,
    exerciseEntropyBits:entropy,effectiveExerciseCount:2**entropy,
    weeklySets:stats(ps.map(p=>p.evaluation.metrics.weeklySets)),exportedWeeklySets:stats(ps.map(p=>p.evaluation.metrics.exportedWeeklySets)),
    maxSessionMinutes:stats(ps.map(p=>Math.max(...p.evaluation.metrics.dayMetrics.map(d=>d.exportEstimateMinutes)))),
    compileLatencyMs:stats(ps.map(p=>p.latencyMs.median)),
    dimensions:Object.fromEntries(dimensions.map(d=>[d,{programsChecked:ps.filter(p=>p.evaluation.dimensions[d]).length,
      programsFailed:ps.filter(p=>p.evaluation.dimensions[d]?.failures.length).length,
      checks:sum(ps.map(p=>p.evaluation.dimensions[d]?.checks||0)),
      failures:sum(ps.map(p=>p.evaluation.dimensions[d]?.failures.length||0))}])),
    advisoryCounts:tally(ps.flatMap(p=>unique(p.evaluation.advisories.map(a=>a.code)))),
    limitations:tally(ps.flatMap(p=>unique(p.result.limitations.map(a=>a.code)))),
    reductions:tally(ps.flatMap(p=>p.result.reductions.map(a=>a.step))),
    strategies:tally(ss.map(s=>s.prescription.progression.strategy.id)),
    muscleDirect:Object.fromEntries(C.MUSCLE_IDS.map(m=>[m,{...stats(ps.map(p=>p.evaluation.metrics.direct[m]||0)),
      programsWithZeroDirect:ps.filter(p=>!p.evaluation.metrics.direct[m]).length}])),
    movementExposure:Object.fromEntries(C.MOVEMENT_PATTERN_IDS.map(m=>[m,stats(ps.map(p=>p.evaluation.metrics.patterns[m]||0))])),
    programsWithReduction:ps.filter(p=>p.result.reductions.length).length,
    programsWithLimitations:ps.filter(p=>p.result.limitations.length).length,
    byFamilyFrequency:Object.fromEntries(C.FAMILY_IDS.flatMap(f=>C.FREQUENCIES.map(n=>{
      const matched=ps.filter(p=>p.input.familyId===f&&p.input.frequency===n);
      return [`${f}_${n}`,{programs:matched.length,weeklySets:stats(matched.map(p=>p.evaluation.metrics.weeklySets)),
        contractFailures:matched.filter(p=>p.evaluation.findings.length).length}];
    }))),
    programsWithExportSetMismatch:ps.filter(p=>p.evaluation.metrics.weeklySets!==p.evaluation.metrics.exportedWeeklySets).map(p=>p.id)};
}
const sourceFiles=['program-compiler.js','progression-engine.js','program-entry-adapter.js','program-entry.js','exercises.js',
  'test/fixtures/program-family-contract-v1.json','tools/audit-program-generation.mjs'];
const gitDir=fs.statSync(path.join(root,'.git')).isDirectory()?path.join(root,'.git'):
  path.resolve(root,fs.readFileSync(path.join(root,'.git'),'utf8').trim().replace(/^gitdir: /,''));
const head=fs.readFileSync(path.join(gitDir,'HEAD'),'utf8').trim();
const ref=head.startsWith('ref: ')?head.slice(5):null;
const sha=ref ? fs.existsSync(path.join(gitDir,ref))?fs.readFileSync(path.join(gitDir,ref),'utf8').trim():
  fs.readFileSync(path.join(gitDir,'packed-refs'),'utf8').split('\n').find(line=>line.endsWith(' '+ref))?.split(' ')[0]:head;
assert.match(sha,/^[a-f0-9]{40}$/);
const source={sha,
  capturedAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,
  fileHashes:Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f),'utf8'))])),
  versions:C.VERSIONS};
const report={source,methodology:{prior,rankedScenarioCount:ranked.length,rankedInputsAttempted:rank,
  selectedPriorMass:sum(programs.filter(p=>p.cohort==='representative').map(p=>p.assumedPriorMass)),
  priorWarning:'Hypothetical independent-factor prior, conditioned on successful compilation; not observed usage. No forced deduplication.',
  stressTracks:'20 blueprints × 5 tracks; 40 searches over supported 30/45/60/75/90-minute choices retain all rejected contexts. No malformed-input tests. No failed program is replaced.',
  timing:'Three warm in-process compilations per program; sample median. Not a browser/end-to-end or hardware benchmark.',
  heuristics:{highDirectSets:20,lowTimeSlackMinutes:2,systemicSlotsPerDay:3},
  oracleLimitations:'Numeric bounds and day labels independent; slot constraints, time and weeks partially use compiler metadata. No training-outcome proof.'},
  checkerEvidence,differentials,cohorts:{representative:aggregate(programs.slice(0,100)),stress:aggregate(programs.slice(100)),all:aggregate(programs)},
  probes:{total:probes.length,byCategory:tally(probes.map(p=>p.category)),outcomes:tally(probes.map(p=>p.actual)),
    failedExpectations:probes.filter(p=>!p.pass).map(p=>({id:p.id,expected:p.expected,actual:p.actual,error:p.error})),
    rankedRejected:probes.filter(p=>p.category==='representative_ranked_input'&&p.actual!=='compiled')},
  artifactHashes:{semanticPrograms:hash(programs.map(p=>({id:p.id,input:p.input,result:p.result}))),programs:hash(programs),probes:hash(probes)}};
fs.mkdirSync(out,{recursive:true});
const write=(name,content)=>fs.writeFileSync(path.join(out,name),content);
write('summary.json',JSON.stringify(report,null,2)+'\n');
write('programs.json',JSON.stringify({source,programs})+'\n');
write('probes.json',JSON.stringify({source,probes})+'\n');
const csvRow=xs=>xs.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',');
write('evaluations.csv',[
  csvRow(['id','cohort','track','family','frequency','profile','minutes','verdict','contract_findings','advisories','resolved_weekly_sets','exported_weekly_sets','max_export_minutes','compile_median_ms','failed_dimensions','advisory_codes']),
  ...programs.map(p=>csvRow([p.id,p.cohort,p.track,p.input.familyId,p.input.frequency,p.input.profile,p.input.sessionMinutes,
    p.evaluation.verdict,p.evaluation.findings.length,p.evaluation.advisories.length,p.evaluation.metrics.weeklySets,p.evaluation.metrics.exportedWeeklySets,
    Math.max(...p.evaluation.metrics.dayMetrics.map(d=>d.exportEstimateMinutes)),p.latencyMs.median,
    unique(p.evaluation.findings.map(f=>f.dimension)).join(';'),p.evaluation.advisories.map(a=>a.code).join(';')]))].join('\n')+'\n');
write('exercises.csv',[
  csvRow(['program','cohort','day','slot','exercise_id','exercise','role','status','resolved_sets','exported_sets','rep_min','rep_max','rir_min','rir_max','rest_seconds','strategy','equipment','loading']),
  ...programs.flatMap(p=>slots(p.result).map(s=>csvRow([p.id,p.cohort,s.dayId,s.slotId,s.exercise.id,s.exercise.name,s.role,s.status,s.prescription.sets,
    p.result.program.find(e=>e.slotId===s.slotId)?.sets,s.prescription.repMin,s.prescription.repMax,s.prescription.targetRirMin,s.prescription.targetRirMax,
    s.prescription.restSeconds,s.prescription.progression.strategy.id,s.exercise.equipment,s.exercise.loading])))].join('\n')+'\n');
write('individual-evaluations.md',programs.map(p=>{
  const e=p.evaluation,m=e.metrics;
  return `## ${p.id}: ${p.input.familyId} / ${p.input.frequency} days / ${p.track}\n\n`+
    `Verdict: **${e.verdict}**. Profile ${p.input.profile}; ceiling ${p.input.sessionMinutes} min; resolved/exported weekly sets ${m.weeklySets}/${m.exportedWeeklySets}; `+
    `max exported estimate ${Math.max(...m.dayMetrics.map(d=>d.exportEstimateMinutes)).toFixed(1)} min.\n\n`+
    `Dimensions: ${Object.entries(e.dimensions).map(([d,v])=>`${d} ${v.failures.length?'FAIL':'PASS'} (${v.checks})`).join('; ')}.\n\n`+
    (e.findings.length?`Contract findings:\n\n${e.findings.map(f=>`- ${f.dimension}: ${f.detail}${f.slotId?` [${f.slotId}]`:''}`).join('\n')}\n\n`:'')+
    (e.advisories.length?`Training-quality review:\n\n${e.advisories.map(a=>`- ${a.code}: ${a.detail}`).join('\n')}\n\n`:'Training-quality heuristics raised no review flags.\n\n')+
    `Direct sets: ${JSON.stringify(m.direct)}. Indirect sets: ${JSON.stringify(m.indirect)}.\n\n`+
    `Limitations: ${JSON.stringify(p.result.limitations)}. Reductions: ${JSON.stringify(p.result.reductions)}.\n\n`+
    p.result.days.map(d=>`### ${d.label}\n\n| Slot | Exercise | Resolved / exported sets | Reps | RIR | Rest | Strategy |\n|---|---|---:|---|---|---:|---|\n`+
      d.slots.map(s=>`| ${s.slotId} | ${s.exercise.name} | ${s.prescription.sets} / ${p.result.program.find(x=>x.slotId===s.slotId)?.sets} | ${s.prescription.repMin}–${s.prescription.repMax} | ${s.prescription.targetRirMin}–${s.prescription.targetRirMax} | ${s.prescription.restSeconds}s | ${s.prescription.progression.strategy.id} |`).join('\n')).join('\n\n');
}).join('\n\n'));

const view=programs.map(p=>({id:p.id,cohort:p.cohort,track:p.track,input:p.input,evaluation:p.evaluation,
  result:{days:p.result.days.map(d=>({dayId:d.dayId,label:d.label,slots:d.slots.map(s=>({slotId:s.slotId,exercise:{name:s.exercise.name},prescription:s.prescription}))})),
    program:p.result.program.map(e=>({slotId:e.slotId,sets:e.sets})),weeks:p.result.weeks}}));
// Offline file, no external dependencies, no application data or network calls.
const safeJSON=JSON.stringify({report,programs:view}).replaceAll('<','\\u003c');
write('explorer.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Program generation audit — 200 programs</title><style>
body{font:15px system-ui;margin:0;color:#17232b;background:#f5f7f8}header,main{padding:24px;max-width:1400px;margin:auto}h1{font-size:28px}p{line-height:1.5}.cards{display:flex;gap:12px;flex-wrap:wrap}.card{background:white;border:1px solid #ccd5da;border-radius:9px;padding:16px;min-width:180px}.card b{display:block;font-size:27px}label{display:inline-block;margin:10px 16px 10px 0}select,input{padding:9px;font:inherit;border:1px solid #8899a3;border-radius:5px}table{border-collapse:collapse;width:100%;background:white;font-size:13px}th,td{text-align:left;padding:9px;border-bottom:1px solid #dce2e5}th{background:#e8edf0}button{font:inherit;cursor:pointer;color:#075b8e;border:0;background:none;text-decoration:underline}tr:hover{background:#edf6fb}.scroll{overflow:auto}.fail{color:#ae2525}.review{color:#845700}.pass{color:#246140}dialog{width:min(1100px,90vw);max-height:85vh;border:1px solid #789;padding:24px;border-radius:10px}pre{white-space:pre-wrap;font-size:12px;max-height:350px;overflow:auto}summary{cursor:pointer;padding:12px 0}.muted{color:#52636e}dialog::backdrop{background:#14232c99}li{margin:8px 0}
</style><header><h1>Program generation audit</h1><p>100 representative programs and 100 stress programs. Representative likelihood uses an explicit assumed prior; no observed usage data. Click a program to inspect every exercise, evaluation, and input.</p><div class="cards" id="cards"></div></header><main>
<label>Set <select id="cohort"><option value="">Both</option><option>representative</option><option>stress</option></select></label>
<label>Family <select id="family"><option value="">All</option><option>growth</option><option>balanced</option><option>strength</option><option>home</option></select></label>
<label>Verdict <select id="verdict"><option value="">All</option><option>contract_fail</option><option>review</option><option>pass</option></select></label>
<label>Search <input id="search" placeholder="ID, track, exercise, finding"></label><p id="count"></p>
<div class="scroll"><table><thead><tr><th>Program</th><th>Track</th><th>Family</th><th>Days</th><th>Profile</th><th>Ceiling</th><th>Sets resolved/exported</th><th>Max time</th><th>Verdict</th><th>Findings/reviews</th></tr></thead><tbody id="rows"></tbody></table></div>
<details><summary>Set-level evaluations and methodology</summary><pre id="summary"></pre></details>
</main><dialog id="detail"><button id="close">Close</button><div id="content"></div></dialog>
<script type="application/json" id="data">${safeJSON}</script><script>
const data=JSON.parse(document.getElementById('data').textContent),ps=data.programs;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
el('cards').innerHTML=[['Programs',ps.length],['Contract failures',ps.filter(p=>p.evaluation.verdict==='contract_fail').length],['Blueprints covered',data.report.cohorts.all.blueprintCoverage],['Unique exercises',data.report.cohorts.all.uniqueExercises]].map(([k,v])=>'<div class="card"><b>'+v+'</b>'+k+'</div>').join('');
el('summary').textContent=JSON.stringify(data.report,null,2);
function render(){const selected=ps.filter(p=>(!el('cohort').value||p.cohort===el('cohort').value)&&(!el('family').value||p.input.familyId===el('family').value)&&(!el('verdict').value||p.evaluation.verdict===el('verdict').value)&&JSON.stringify(p).toLowerCase().includes(el('search').value.toLowerCase()));el('count').textContent=selected.length+' programs shown';el('rows').innerHTML=selected.map(p=>{const m=p.evaluation.metrics;return '<tr><td><button data-id="'+p.id+'">'+p.id+'</button></td><td>'+esc(p.track)+'</td><td>'+p.input.familyId+'</td><td>'+p.input.frequency+'</td><td>'+p.input.profile+'</td><td>'+p.input.sessionMinutes+'m</td><td>'+m.weeklySets+'/'+m.exportedWeeklySets+'</td><td>'+Math.max(...m.dayMetrics.map(d=>d.exportEstimateMinutes)).toFixed(1)+'m</td><td class="'+(p.evaluation.verdict==='contract_fail'?'fail':p.evaluation.verdict)+'">'+p.evaluation.verdict+'</td><td>'+p.evaluation.findings.length+'/'+p.evaluation.advisories.length+'</td></tr>'}).join('')}
function show(id){const p=ps.find(p=>p.id===id),e=p.evaluation;el('content').innerHTML='<h2>'+p.id+' · '+p.input.familyId+' · '+p.input.frequency+' days</h2><p>'+esc(p.track)+' — '+esc(e.verdict)+'</p><h3>Contract findings</h3>'+(e.findings.length?'<ul>'+e.findings.map(f=>'<li>'+esc(f.dimension+': '+f.detail+' '+(f.slotId||''))+'</li>').join('')+'</ul>':'<p>No contract failures detected.</p>')+'<h3>Training-quality review</h3><ul>'+e.advisories.map(a=>'<li>'+esc(a.code+': '+a.detail)+'</li>').join('')+'</ul>'+p.result.days.map(d=>'<h3>'+esc(d.label)+'</h3><div class="scroll"><table><tr><th>Exercise</th><th>Sets resolved/exported</th><th>Reps</th><th>RIR</th><th>Rest</th><th>Strategy</th></tr>'+d.slots.map(s=>'<tr><td>'+esc(s.exercise.name)+'</td><td>'+s.prescription.sets+'/'+p.result.program.find(x=>x.slotId===s.slotId).sets+'</td><td>'+s.prescription.repMin+'–'+s.prescription.repMax+'</td><td>'+s.prescription.targetRirMin+'–'+s.prescription.targetRirMax+'</td><td>'+s.prescription.restSeconds+'s</td><td>'+esc(s.prescription.progression.strategy.id)+'</td></tr>').join('')+'</table></div>').join('')+'<details><summary>All dimension results, exposure and weeks</summary><pre>'+esc(JSON.stringify({evaluation:e,weeks:p.result.weeks},null,2))+'</pre></details><details><summary>Exact input</summary><pre>'+esc(JSON.stringify(p.input,null,2))+'</pre></details>';el('detail').showModal()}
['cohort','family','verdict','search'].forEach(id=>el(id).addEventListener('input',render));el('rows').addEventListener('click',event=>{const b=event.target.closest('[data-id]');if(b)show(b.dataset.id)});el('close').onclick=()=>el('detail').close();render();
</script></html>`);
console.log(JSON.stringify({out,programs:programs.length,cohorts:Object.fromEntries(Object.entries(report.cohorts).map(([k,v])=>[k,{verdicts:v.verdicts,uniqueExercises:v.uniqueExercises,blueprints:v.blueprintCoverage,failedDimensions:Object.fromEntries(Object.entries(v.dimensions).filter(([,x])=>x.programsFailed))}])),probes:report.probes.total,failedProbeExpectations:report.probes.failedExpectations},null,2));
