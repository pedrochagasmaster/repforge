// Findings consume the same engine, calibration and week evidence as the profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Model = require('../progress-model.js');
const Engine = require('../progression-engine.js');
const Gauge = require('../calibration-gauge.js');
const Calibration = require('../effort-calibration.js');
import { cases } from './fixtures/engine-standing.mjs';
const [prescriptions,,,context] = structuredClone(cases.find(c => c.name === 'four-sessions').input);
const program = [{id:'slot-a',libraryId:'exercise-a',name:'Leg press',day:'A'}];
const keyOf = row => row.performedLibraryId || row.performedMovementId || row.sourceLibraryId || row.name;
const key = 'exercise-a';
const session = (id,date,{checks=false,loads=[100,95,90,85],extra={}}={}) => loads.map((load,i) => ({
  ...structuredClone(cases.find(c=>c.name==='four-sessions').input[1][0].sets[i%3]),
  metricValues:[{metricId:prescriptions[0].metricIds[0],value:load,unit:'kg'}, {metricId:prescriptions[0].metricIds[1],value:8,unit:'reps'}],
  session:id,date,created:`${date}T10:00:00Z`,setIndex:i,set:i+1,load,reps:8,
  performedLibraryId:key,exerciseId:'slot-a',name:'Leg press',...(checks&&i===loads.length-1?{effortSource:'failure',rir:0,calibration:{predictedReps:8}}:{}),...extra
}));
// Authoritative readings, not a second set of thresholds in a fake model.
function readings(log,now) {
  const rows=log.filter(r=>keyOf(r)===key && !r.warmup && r.origin!=='ramp');
  const groups=new Map();
  for(const row of rows){if(!groups.has(row.session))groups.set(row.session,{sessionId:row.session,date:row.date,completed:true,sets:[]});groups.get(row.session).sets.push({...row,exerciseId:key});}
  const history=[...groups.values()];
  const calibration=Calibration.estimate(Calibration.checkErrors({today:now,sessions:history.map(s=>({date:s.date,checks:s.sets.filter(r=>r.calibration).map(r=>({predictedReps:r.calibration.predictedReps,reps:r.reps}))}))}));
  const recommendation=Engine.recommendSets(prescriptions,history,[],context,{now,calibration})[0];
  const observations=rows.map(r=>({key,session:r.session,date:r.date,set:r.setIndex,load:r.load,reps:r.reps,rir:r.rir,q:Gauge.rowQuality(r)}));
  return [{key,slotId:'slot-a',name:'Leg press',recommendation,standing:recommendation.standing,nextSetQuality:Gauge.rowQuality(rows.findLast(r=>r.effortSource!=='failure')||{effortSource:'rir'}),calibration,weeks:Gauge.weeksFrom(observations,(load,reps,rir)=>load*(1+(reps+rir)/30)),improved:false}];
}
const build=(log,now='2026-11-09',p=program,read=readings)=>Model.buildFindings(log,p,{},now,read);
const found=(result,id)=>result.released.find(f=>f.id===id);
let checks=0;
function proof(name,fn){fn();checks++;console.log(`PASS ${name}`);}
proof('findings have a version and no empty-history release',()=>{
  assert.equal(Model.FINDINGS_VERSION,'findings@081.1');
  const out=build([]);assert.deepEqual(out.released,[]);assert.equal(out.next.id,'weights_found');assert.equal(out.next.need.m,1);
});
const one=session('one','2026-10-01',{extra:{startingLoad:{v:1,openingKg:40}}});
const two=session('two','2026-10-08');
const three=session('three','2026-10-15');
proof('starting-load provenance releases weights on the first session',()=>{
  assert.equal(found(build(one),'weights_found').date,'2026-10-01');
  assert.equal(found(build(one),'weights_found').n,1);
});
proof('all program lifts anchored also releases weights without session zero',()=>{
  assert.ok(found(build(session('one','2026-10-01')),'weights_found'));
  const p=[...program,{id:'b',libraryId:'other',name:'Curl'}];
  assert.equal(build(session('one','2026-10-01'),undefined,p).next.need.m,1);
});
proof('first target releases as soon as a saved session supports a history anchor',()=>{
  assert.equal(found(build(one),'first_target').date,'2026-10-01');
  const f=found(build([...two,...one]),'first_target');
  assert.equal(f.date,'2026-10-01');assert.equal(f.becauseDate,'2026-10-01');
  const rec=readings(one,'2026-10-01')[0].recommendation;
  assert.equal(f.load,rec.targets.loadKg);assert.equal(f.reps,rec.targets.reps);
});
proof('a test set releases once and keeps performed movement identity',()=>{
  const test=session('check','2026-10-10',{checks:true,extra:{sourceLibraryId:'original',performedLibraryId:'replacement',performedName:'Cable curl'}});
  const f=found(build(test),'first_check');assert.equal(f.key,'replacement');assert.equal(f.lift,'Cable curl');assert.equal(f.g,8);assert.equal(f.d,8);
});
proof('ramps and warm-ups never release any finding, even if they carry provenance or a check',()=>{
  for(const extra of [{warmup:true},{origin:'ramp'}]) {
    const log=session('ramp','2026-10-01',{checks:true,extra:{...extra,startingLoad:{v:1,openingKg:40}}});
    assert.deepEqual(build(log).released,[]);
  }
});
proof('three comparable checks are required for the effort reading',()=>{
  const log=['01','08','15'].flatMap((d,i)=>session('check'+i,`2026-10-${d}`,{checks:true}));
  assert.equal(found(build(log.slice(0,8)),'effort_read'),undefined);
  assert.equal(build(log.slice(0,8)).next.id,'effort_read');
  assert.equal(build(log.slice(0,8)).next.need.k,1);
  const f=found(build(log),'effort_read');assert.equal(f.date,'2026-10-15');assert.equal(f.state,'calibrated');
});
proof('biased and inconsistent checks keep the estimator rules',()=>{
  for(const [guess,state] of [[4,'under'],[12,'over']]){
    const log=['01','08','15'].flatMap((d,i)=>session('c'+i,`2026-10-${d}`,{checks:true}));
    for(const row of log)if(row.calibration)row.calibration.predictedReps=guess;
    assert.equal(found(build(log),'effort_read').state,state);
  }
  const log=['01','08','15'].flatMap((d,i)=>session('c'+i,`2026-10-${d}`,{checks:true}));
  log.filter(r=>r.calibration).forEach((r,i)=>r.calibration.predictedReps=[3,13,8][i]);
  assert.equal(found(build(log),'effort_read'),undefined);
  assert.equal(build(log).next.need.reason,'agreement');
});
proof('solid uses the engine weighted sets and agreement, released at the first sufficient session',()=>{
  assert.equal(found(build(one),'first_solid'),undefined);
  const f=found(build([...three,...two,...one]),'first_solid');assert.equal(f.date,'2026-10-08');assert.equal(f.sessions,2);
  assert.equal(f.sets,readings([...one,...two],'2026-10-08')[0].standing.evidence.sets);
  const words=[...one,...two].map(r=>({...r,effortSource:'effort'}));
  assert.equal(found(build(words),'first_solid'),undefined);
});
proof('solid distance reaches the exact weighted boundary for words and numeric entries',()=>{
  for(const source of ['effort','rir']) {
    const log=['01','08','15'].flatMap((d,i)=>session('quality'+i,`2026-10-${d}`,{checks:true,loads:[100,95,90],extra:{effortSource:source}}));
    // Keep the last set a genuine test, independently of the working entry mode.
    for(const row of log.filter(r=>r.calibration)){row.effortSource='failure';row.rir=0;}
    const before=build(log,'2026-10-15');
    assert.equal(before.next.id,'first_solid');
    const n=before.next.need.m;
    const more=count=>session('quality2','2026-10-15',{loads:Array(count).fill(100),extra:{effortSource:source}}).map((r,i)=>({...r,setIndex:i+3,set:i+4}));
    assert.equal(found(build([...log,...more(n-1)],'2026-10-15'),'first_solid'),undefined);
    assert.ok(found(build([...log,...more(n)],'2026-10-15'),'first_solid'),`${source}: ${n} promised sets must suffice`);
  }
});
proof('a disagreement cannot be relabelled solid just because there are six sets',()=>{
  const log=['01','08'].flatMap((d,i)=>session('bad'+i,`2026-10-${d}`,{loads:[100,130,170,220]}));
  assert.equal(found(build(log),'first_solid'),undefined);
});
proof('first trend reads the canonical W pair and its two capacities',()=>{
  assert.equal(found(build(one),'first_trend'),undefined);
  const f=found(build([...one,...two]),'first_trend');assert.equal(f.date,'2026-10-08');
  assert.ok(Math.abs(f.cap1-100*(1+10/30))<1e-10);assert.equal(f.cap1,f.cap2);
  assert.equal(found(build([...one,...session('late','2026-10-22')]),'first_trend'),undefined);
  assert.ok(found(build([...one,...session('gap','2026-10-15')]),'first_trend'),'W allows a two-week gap');
});
proof('month one is the calendar boundary with evidence frozen at that date',()=>{
  const log=[...one,...two,...three,...session('later','2026-11-05')];
  assert.equal(found(build(log,'2026-10-28'),'month_one'),undefined);
  const f=found(build(log,'2026-11-09'),'month_one');assert.equal(f.date,'2026-10-29');assert.equal(f.sessions,3);assert.equal(f.solid,1);
});
proof('no optional test sets still releases five findings',()=>{
  const result=build([...one,...two,...three]);
  assert.equal(result.released.length,5);assert.equal(result.next.id,'first_check');
  assert.ok(result.released.every(f=>!['first_check','effort_read'].includes(f.id)));
});
proof('history edits and deletions rederive release dates, details and needs without persistence',()=>{
  const log=[...one,...two,...three],before=structuredClone(log);
  assert.equal(found(build(log),'first_target').date,'2026-10-01');
  const edited=log.filter(r=>r.session!=='one');assert.equal(found(build(edited),'first_target').date,'2026-10-08');
  assert.equal(found(build([]),'first_target'),undefined);assert.deepEqual(log,before);
});
proof('future rows cannot release findings and output is newest first',()=>{
  const result=build([...one,...two,...three],'2026-10-07');assert.equal(result.released.length,2);
  const dates=build([...one,...two,...three]).released.map(f=>f.date);assert.deepEqual(dates,[...dates].sort().reverse());
});
proof('a swapped lift cannot anchor or calibrate the template movement',()=>{
  const swapped=[...one,...two,...three].map(({startingLoad,...r})=>({...r,sourceLibraryId:key,performedLibraryId:'replacement'}));
  const result=build(swapped);assert.equal(found(result,'first_target'),undefined);assert.equal(found(result,'first_solid'),undefined);
  assert.equal(result.next.need.m,1);
});
proof('needs include named lifts and exact remaining calendar days',()=>{
  const out=build(one.map(row=>({...row,rir:null})),'2026-10-01');assert.equal(out.next.id,'first_target');assert.equal(out.next.need.lift,'Leg press');
  const log=['01','08','15'].flatMap((day,i)=>session('check'+i,`2026-10-${day}`,{checks:true}));
  const next=build(log,'2026-10-20').next;
  assert.equal(next.id,'month_one');assert.equal(next.need.d,9);
});
proof('manual prescriptions never promise an adaptive target after another session',()=>{
  const read=(rows,now)=>readings(rows,now).map(f=>({...f,recommendation:{status:'manual'},standing:null}));
  const out=build(one,'2026-10-01',program,read);
  assert.equal(out.next.id,'first_target');assert.equal(out.next.need,null);
});
proof('the first trend includes only a record already observed on its release date',()=>{
  const read=(rows,now)=>readings(rows,now).map(f=>({...f,records:[{date:'2026-10-08',load:105,reps:8},{date:'2026-11-05',load:110,reps:8}]}));
  const result=build([...one,...two],undefined,program,read);
  assert.equal(found(result,'first_trend').record.load,105);
});
proof('a performed movement can anchor its target after being trained in another slot',()=>{
  const swapped=one.map(row=>({...row,exerciseId:'another-slot',sourceLibraryId:'template-movement',performedLibraryId:key}));
  const result=build(swapped);
  assert.equal(found(result,'first_target').key,key);
  assert.equal(found(result,'first_target').date,'2026-10-01');
});
proof('a bodyweight-only history anchor also releases the first target',()=>{
  const p=structuredClone(prescriptions[0]),rep=p.metricDefinitions[1];
  p.metricIds=[rep.id];p.metricDefinitions=[rep];p.loadingModel={bodyweightCoefficient:1};
  const ctx={equipmentId:'rack-a',loadingConvention:'bodyweight',bodyweightCoefficient:1,externalLoadMultiplier:0,bodyweightKg:80,bodyweightContributionEnabled:true};
  const read=(log,now)=>{
    const groups=new Map();
    for(const row of log){
      if(!groups.has(row.session))groups.set(row.session,{sessionId:row.session,date:row.date,completed:true,sets:[]});
      groups.get(row.session).sets.push({...row,exerciseId:key,metricIds:[rep.id],metricValues:[{metricId:rep.id,value:row.reps,unit:'reps'}],loadingConvention:'bodyweight',loadingContext:ctx});
    }
    const recommendation=Engine.recommendSets([p],[...groups.values()],[],{bySlotId:{[p.slotId]:ctx}},{now})[0];
    return [{key,name:'Pull-up',recommendation,standing:recommendation.standing}];
  };
  const log=[...one,...two].map(row=>({...row,load:0}));
  assert.equal(read(one,'2026-10-08')[0].recommendation.status,'recommended');
  const f=found(build(log,undefined,program,read),'first_target');
  assert.equal(f.date,'2026-10-01');assert.equal(f.load,null);assert.equal(f.loadingConvention,'bodyweight');
});
proof('the month starts with a timed working session too',()=>{
  const metric=require('../exercise-metrics.js').DEFINITIONS.find(m=>m.semantic==='durationSeconds');
  const log=[{session:'hold',date:'2026-10-01',metricType:'source_metrics@1',metricIds:[metric.id],metricDefinitions:[metric],metricValues:[{metricId:metric.id,value:30,unit:metric.unit}]}];
  const f=found(build(log,'2026-10-29',program,()=>[]),'month_one');
  assert.equal(f.date,'2026-10-29');assert.equal(f.sessions,1);assert.equal(f.improved,0);assert.equal(f.solid,0);
});
console.log(`PASS findings: ${checks} rule, chronology, identity and need proofs`);
