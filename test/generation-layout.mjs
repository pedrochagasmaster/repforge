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
for (const change of [{goal:'strength'},{split:'upper_lower'},{daysPerWeek:4},{timeCeilingMinutes:40},{experience:'beginner'},{periodization:'linear'},{cycles:8},{deloadCycles:[7]}]) {
 assert.equal(layout.generate({...request,...change},selector()).status,'unsupported');
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
