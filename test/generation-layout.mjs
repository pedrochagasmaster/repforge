import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const layout = require('../generation-layout.js');
const request = { goal: 'hybrid', split: 'upper_lower_full', daysPerWeek: 3, timeCeilingMinutes: 60, experience: 'advanced', periodization: 'static', cycles: 7, deloadCycles: [] };
const upper = new Set(['sideDelts','biceps','triceps','chest','rearDelts','lats','upperTraps','upperBack','forearms','neck','frontDelts','serratus']);
function selector(options = {}) {
  const calls = []; let serial = 0;
  return { priorities: options.priorities || [], depriorities: options.depriorities || [], calls,
    choose(spec, selected) {
      calls.push({ ...spec, selected: selected.slice() });
      if (options.fail?.(spec)) return null;
      const region = spec.muscle ? (upper.has(spec.muscle) ? 'upperBody' : 'lowerBody') : ['squat','hipHinge'].includes(spec.pattern) ? 'lowerBody' : 'upperBody';
      return { id: String(serial++), patterns: spec.pattern ? [spec.pattern === 'hipHinge' && options.alias ? 'hinge' : spec.pattern] : [], region, effectiveRegion: region, exerciseType: 'core', primaryJointActions: [], exclusionGroupings: [], raw: {} };
    } };
}
const chosen = selector(); const result = layout.generate(request, chosen);
assert.equal(result.status, 'ok'); assert.deepEqual(result.days.map(d => d.name), ['Upper','Lower','Full']);
const templates = result.days.flatMap(d => d.templates);
assert.equal(templates.length, 18); assert.equal(templates.reduce((n,t) => n+t.numSets, 0), 45);
assert.equal(result.budgetMinutes, 50); assert.deepEqual(result.weeklySlots, [0,null,1,null,2,null,null]);
assert.deepEqual(result.allocations.upper.compound, [4,3,0,0]); assert.deepEqual(result.allocations.lower.compound, [3,3,0,0]);
assert.deepEqual(result.allocations.upper.isolation, [4,3,0,0]); assert.deepEqual(result.allocations.lower.isolation, [6,2,0,0]);
assert.deepEqual(chosen.calls.map(c => c.selected.length), Array.from({length:18},(_,i)=>i));
assert.deepEqual(chosen.calls.slice(0,8).map(c=>[c.type,c.pattern,c.isFirstOfType]), [
 ['primary','horizontalPush',true],['primary','verticalPush',true],['primary','horizontalPull',true],['primary','verticalPull',true],['primary','squat',true],['secondary','squat',true],['primary','hipHinge',true],['secondary','hipHinge',true] ]);
assert.deepEqual(chosen.calls.slice(8).map(c=>c.muscle), ['sideDelts','biceps','triceps','chest','calves','hamstrings','quads','abs','abductors','obliques']);
assert.equal(layout.generate({...request, basics: {sex:'female'}}, selector()).status,'ok');
assert.deepEqual(layout.generate(request, selector({alias:true})).days.map(d=>d.templates.map(t=>[t.type,t.numSets])),result.days.map(d=>d.templates.map(t=>[t.type,t.numSets])));
// Hypertrophy is initially restricted to option60. Allocation/default lists
// match both; candidate selection and dose differences are proved separately.
const hypertrophyRequest={...request,goal:'hypertrophy'};
const hypertrophySelector=selector();
const hypertrophyLayout=layout.generate(hypertrophyRequest,hypertrophySelector);
assert.equal(hypertrophyLayout.status,'ok','hypertrophy60 must enter the recovered layout domain');
assert.equal(hypertrophyLayout.budgetMinutes,50);
assert.deepEqual(hypertrophyLayout.allocations,result.allocations);
assert.deepEqual(hypertrophyLayout.weeklySlots,result.weeklySlots);
assert.deepEqual(hypertrophyLayout.days.map(day=>day.templates.map(t=>[t.type,t.numSets,t.accessoryMuscle])),
 result.days.map(day=>day.templates.map(t=>[t.type,t.numSets,t.accessoryMuscle])),
 'distinct successful synthetic selections preserve both allocation and male/default muscle sequence');
assert.deepEqual(hypertrophySelector.calls.map(c=>c.selected.length),chosen.calls.map(c=>c.selected.length));
assert.equal(layout.generate({...hypertrophyRequest,timeCeilingMinutes:40},selector()).status,'unsupported','hypertrophy40 is not part of this slice');
assert.equal(layout.generate({...hypertrophyRequest,goal:'strength'},selector()).status,'unsupported','strength remains outside this slice');
const hEmpty=layout.generate(hypertrophyRequest,selector({fail:()=>true}));
assert.equal(hEmpty.status,'insufficient');assert.equal(hEmpty.days.flatMap(day=>day.templates).length,0);
// Option40 adds two ordered-tie discriminants to the retained option60 proof.
// Counts below apply only to this synthetic selector's distinct successful choices.
const request40 = {...request,timeCeilingMinutes:40};
const selected40 = selector();
const result40 = layout.generate(request40,selected40);
assert.equal(result40.status,'ok','option40 must enter the recovered layout domain');
assert.equal(result40.budgetMinutes,30,'option40 resolves budget30, never literal40');
assert.deepEqual(result40.weeklySlots,result.weeklySlots);
assert.deepEqual(result40.days.map(d=>d.name),['Upper','Lower','Full']);
const allocationSeconds=(a,between,fixed)=>[...Array(a[0]).fill(a[1]),...Array(a[2]).fill(a[3])]
 .reduce((n,sets)=>n+120+fixed+30*sets+between*Math.max(0,sets-1),0);
const compoundTies=[[2,3,0,0],[3,2,0,0]];
assert.deepEqual(compoundTies.map(a=>allocationSeconds(a,120,180)),[21*60,24*60]);
assert.deepEqual(compoundTies.map(a=>Math.abs(22.5*60-allocationSeconds(a,120,180))),[90,90]);
assert.deepEqual(result40.allocations.upper.compound,compoundTies[1],'compound keeps the later equal-score allocation');
const isolationTies=[[3,2,0,0],[3,3,0,0],[4,2,0,0]];
assert.deepEqual(isolationTies.map(a=>allocationSeconds(a,90,90)),[18*60,24*60,24*60]);
assert.deepEqual(isolationTies.map(a=>Math.abs(21*60-allocationSeconds(a,90,90))),[180,180,180]);
assert.deepEqual(result40.allocations.upper.isolation,isolationTies[0],'isolation keeps the first equal-score allocation');
assert.deepEqual(result40.allocations.lower.compound,[2,3,0,0]);
assert.deepEqual(result40.allocations.lower.isolation,[3,2,0,0]);
const templates40=result40.days.flatMap(d=>d.templates);
const patterns40=['horizontalPush','verticalPush','horizontalPull','verticalPull','squat','hipHinge'];
assert.deepEqual(patterns40.map(pattern=>templates40.filter(t=>t.type!=='accessory'&&t.exercise.patterns.includes(pattern)).map(t=>t.numSets)),
 [[2],[1],[2],[1],[3],[3]],'pattern split preserves the newly reached one-set vectors');
assert.equal(templates40.length,12);assert.equal(templates40.reduce((n,t)=>n+t.numSets,0),24);
assert.deepEqual(selected40.calls.map(c=>c.selected.length),Array.from({length:12},(_,i)=>i),'each choice sees prior successful choices');
const missing40=layout.generate(request40,selector({fail:s=>s.type==='primary'&&s.pattern==='horizontalPush'}));
assert.equal(missing40.status,'insufficient');
assert.equal(missing40.days.flatMap(d=>d.templates).length,11);
assert.equal(missing40.days.flatMap(d=>d.templates).reduce((n,t)=>n+t.numSets,0),22,'missing two-set primary is never padded');
const exhausted40=layout.generate(request40,selector({fail:()=>true}));
assert.equal(exhausted40.status,'insufficient');
assert.equal(exhausted40.days.flatMap(d=>d.templates).length,0,'empty pools fabricate no templates');
const noAccessories40=layout.generate(request40,selector({fail:s=>s.type==='accessory'}));
assert.equal(noAccessories40.status,'insufficient');
assert.equal(noAccessories40.days.flatMap(d=>d.templates).length,6);
assert.equal(noAccessories40.days.flatMap(d=>d.templates).reduce((n,t)=>n+t.numSets,0),12);
for (const change of [{goal:'strength'},{split:'upper_lower'},{daysPerWeek:4},{timeCeilingMinutes:20},{timeCeilingMinutes:90},{timeCeilingMinutes:120},{timeCeilingMinutes:150},{experience:'beginner'},{cycles:8},{deloadCycles:[7]}]) {
 assert.equal(layout.generate({...request,...change},selector()).status,'unsupported');
}
for(const periodization of ['linear','reverse_linear','undulating']) {
 const periodized = layout.generate({...request,periodization},selector());
 assert.deepEqual(periodized.days.map(d=>d.templates.map(t=>[t.type,t.numSets,t.exercise.patterns])), result.days.map(d=>d.templates.map(t=>[t.type,t.numSets,t.exercise.patterns])), 'normal periodization preserves source assembly');
}
const failed = layout.generate(request,selector({fail:s=>s.type==='primary'&&s.pattern==='horizontalPush'}));
assert.equal(failed.status,'insufficient'); assert.equal(failed.days.flatMap(d=>d.templates).length,17); assert.equal(failed.days.flatMap(d=>d.templates).reduce((n,t)=>n+t.numSets,0),42);
const empty=layout.generate(request,selector({fail:()=>true})); assert.equal(empty.status,'insufficient'); assert.equal(empty.days.flatMap(d=>d.templates).length,0);
const emphasis=selector({priorities:['frontDelts'],depriorities:['sideDelts']});
assert.equal(layout.generate(request,emphasis).status,'ok'); assert.equal(emphasis.calls[8].muscle,'frontDelts'); assert.ok(emphasis.calls.slice(8).every(c=>c.muscle!=='sideDelts'));
const repeating = selector({priorities:['frontDelts'],depriorities:[...upper].filter(m=>m!=='frontDelts')});
const originalChoose = repeating.choose; const muscleExercises = new Map();
repeating.choose = (spec, selected) => {
 const e = originalChoose(spec, selected);
 if (!spec.muscle) return e;
 if (!muscleExercises.has(spec.muscle)) muscleExercises.set(spec.muscle,e);
 return muscleExercises.get(spec.muscle);
};
const duplicateShortage = layout.generate(request,repeating);
assert.equal(duplicateShortage.status,'insufficient');
assert.ok(duplicateShortage.days.flatMap(d=>d.templates).length<18);
const removed=selector({depriorities:[...upper]}); assert.equal(layout.generate(request,removed).status,'insufficient');
assert.equal(layout.generate(request,selector({priorities:['biceps'],depriorities:['biceps']})).status,'unsupported');
assert.ok(result.estimatedSessionSeconds.every(n=>Number.isFinite(n)&&n>0));
for(let seed=0;seed<30;seed++) {
 const s=selector({fail:c=>c.type==='primary'&&((seed>>(['horizontalPush','verticalPush','horizontalPull','verticalPull','squat','hipHinge'].indexOf(c.pattern)))&1)});
 const value=layout.generate(request,s); const actual=value.days.flatMap(d=>d.templates);
 assert.equal(actual.length,s.calls.filter(c=>!(c.type==='primary'&&((seed>>(['horizontalPush','verticalPush','horizontalPull','verticalPull','squat','hipHinge'].indexOf(c.pattern)))&1))).length);
 assert.equal(new Set(actual.map(t=>t.exercise.id)).size,actual.length);
}
console.log('generation-layout: allocation, lazy selection, null/insufficiency, domains, ordering and 30 failure masks PASS');
