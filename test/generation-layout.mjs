import assert from 'node:assert/strict';
import {layout} from '../src/training/generation.js';
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
assert.equal(layout.generate({...hypertrophyRequest,timeCeilingMinutes:40},selector()).status,'ok','hypertrophy40 enters the recovered layout domain');
assert.equal(layout.generate({...hypertrophyRequest,goal:'strength',timeCeilingMinutes:40},selector()).status,'ok','strength40 enters the recovered layout domain');
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
for (const change of [{split:'upper_lower'},{daysPerWeek:4},{timeCeilingMinutes:30},{experience:'none'},{cycles:8},{deloadCycles:[7]}]) {
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

// Strength option60 reserves 60% of each 75-minute regional budget for compounds.
const strengthRequest={...request,goal:'strength'};
const strengthChoices=selector();const strengthLayout=layout.generate(strengthRequest,strengthChoices);
assert.equal(strengthLayout.status,'ok','strength60 enters only the recovered Static profile');
assert.equal(strengthLayout.budgetMinutes,50);
assert.deepEqual(strengthLayout.allocations.upper.compound,[4,3,0,0]);
assert.deepEqual(strengthLayout.allocations.upper.isolation,[4,3,0,0]);
assert.deepEqual(strengthLayout.allocations.lower.compound,[4,3,0,0]);
assert.deepEqual(strengthLayout.allocations.lower.isolation,[3,3,0,0]);
const strengthLowerTies=[[3,3,0,0],[4,2,0,0]];
assert.deepEqual(strengthLowerTies.map(a=>allocationSeconds(a,90,90)),[1440,1440]);
assert.deepEqual(strengthLowerTies.map(a=>Math.abs(1500-allocationSeconds(a,90,90))),[60,60]);
const strengthTemplates=strengthLayout.days.flatMap(day=>day.templates);
assert.deepEqual(['squat','hipHinge'].map(pattern=>strengthTemplates.filter(t=>t.type!=='accessory'&&t.exercise.patterns.includes(pattern)).map(t=>t.numSets)),[[3,3],[3,3]]);
assert.equal(strengthTemplates.length,15,'conditional distinct-success synthetic selector, not a universal count');
assert.equal(strengthTemplates.reduce((n,t)=>n+t.numSets,0),45);
// Exhaustion exposes the complete source default order without inventing a successful exercise.
const strengthDefaults=[['sideDelts','biceps','triceps','chest','rearDelts','lats','calves','hamstrings','quads'],
 ['upperTraps','upperBack','forearms','neck','abs','glutes','abductors','obliques'],['frontDelts','adductors','lowerBack']];
const strengthExhausted=selector({fail:spec=>spec.type==='accessory'});
assert.equal(layout.generate(strengthRequest,strengthExhausted).status,'insufficient');
const sourceWalk=[strengthDefaults[0],strengthDefaults[1],strengthDefaults[0],strengthDefaults[2],strengthDefaults[1]].flat();
assert.deepEqual(strengthExhausted.calls.filter(c=>c.type==='accessory').map(c=>c.muscle),
 [...sourceWalk.filter(m=>upper.has(m)),...sourceWalk.filter(m=>!upper.has(m))]);
for(const change of [{timeCeilingMinutes:30},{experience:'none'},{cycles:8},{deloadCycles:[7]}])
 assert.equal(layout.generate({...strengthRequest,...change},selector()).status,'unsupported');

// Route synthetic accessories to Full so source A/B/C ordering and repeated
// non-priority muscles are observed together through the public layout API.
function strengthFinalOrder(priorities,allowed){
 const choices=selector({priorities,depriorities:['calves','hamstrings','quads'],
  fail:spec=>spec.type==='accessory'&&!allowed.includes(spec.muscle)});
 const select=choices.choose;
 choices.choose=(spec,selected)=>{
  const exercise=select(spec,selected);
  return exercise&&spec.type==='accessory'?{...exercise,effectiveRegion:'fullBody'}:exercise;
 };
 const generated=layout.generate(strengthRequest,choices);
 assert.equal(generated.status,'ok');
 const accessories=generated.days.flatMap(day=>day.templates).filter(t=>t.type==='accessory');
 assert.equal(accessories.length,7,'conditional successful synthetic choices are conserved');
 assert.equal(new Set(accessories.map(t=>t.exercise.id)).size,7,'repeated muscles retain distinct exercises');
 return generated.days.map(day=>day.templates.filter(t=>t.type==='accessory').map(t=>t.accessoryMuscle));
}
function assertStrengthCategories(days,priorities=[]){
 for(const muscles of days){
  const nonpriority=muscles.filter(m=>!priorities.includes(m));
  const categories=nonpriority.map(m=>strengthDefaults.findIndex(group=>group.includes(m)));
  assert.deepEqual(categories,[...categories].sort((a,b)=>a-b),'non-priority source A must finish before B, which must finish before C');
  const firstB=muscles.findIndex(m=>!priorities.includes(m)&&strengthDefaults[1].includes(m));
  if(firstB>=0)assert(muscles.every((m,index)=>!priorities.includes(m)||index<firstB),'priority/A round-robin must finish before source B');
 }
}
const absOrder=strengthFinalOrder([],['chest','forearms','frontDelts','abs','glutes','abductors']);
assert(absOrder.some(day=>day.includes('abs')&&day.filter(m=>m==='chest').length===2),'fixture observes abs beside repeated non-priority A');
assertStrengthCategories(absOrder);
const gluteOrder=strengthFinalOrder([],['chest','forearms','frontDelts','glutes','adductors','lowerBack']);
assert(gluteOrder.some(day=>day.includes('glutes')&&day.includes('frontDelts')),'fixture observes glutes beside source C');
assertStrengthCategories(gluteOrder);
const priorityOrder=strengthFinalOrder(['neck'],['neck','chest','abs','glutes','abductors']);
assert(priorityOrder.some(day=>day.includes('abs')&&day.filter(m=>m==='neck').length>1),'fixture observes B beside repeated priority entries');
assertStrengthCategories(priorityOrder,['neck']);

for(const experience of ['beginner','intermediate']){
 const xpRequest={...request,experience};assert.deepEqual(layout.generate(xpRequest,selector()),result,'controlled experience preserves layout');
 for(const patch of [{timeCeilingMinutes:40},{goal:'hypertrophy'},{periodization:'linear'},{periodization:'reverse_linear'},{periodization:'undulating'}])
  assert.equal(layout.generate({...xpRequest,...patch},selector()).status,'ok');
}
