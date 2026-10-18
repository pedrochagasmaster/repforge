import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSessionSummary,sessionPRs,sessionMuscleWork,sessionOutcomeGroups} from '../src/training/progress.js';
const row=(overrides={})=>({liftKey:'lift:a',name:'Squat',load:100,reps:5,e1rm:100*(1+5/30),tonnage:500,warmup:false,strengthComparable:true,strengthConvention:'load',set:1,date:'2026-10-18',session:'new',muscle:{load:100,reps:5,rir:2,primary:['Quads'],secondary:['Glutes']},...overrides});
const past=row({load:90,e1rm:90*(1+5/30),session:'old'});
assert.equal(sessionPRs([row()],[]).length,0,'first observation is baseline');
assert.deepEqual(sessionPRs([row()],[past]),[{kind:'load',load:100,reps:5,delta:10,name:'Squat',liftKey:'lift:a'}]);
assert.equal(sessionPRs([row({reps:6,e1rm:120})],[row()])[0].kind,'reps');
assert.equal(sessionPRs([row({load:90,reps:15,e1rm:135})],[row()])[0].kind,'e1rm');
assert.equal(sessionPRs([row({strengthComparable:false})],[past]).length,0,'unknown per-side mode excluded');
assert.equal(sessionPRs([row({strengthConvention:'per-side:m2'})],[past]).length,0,'conventions never cross');
assert.deepEqual(sessionMuscleWork([row(),row({warmup:true}),row({muscle:{load:0,reps:5,rir:1,primary:['Chest'],secondary:[]}})],2),[{name:'Quads',sets:1,direct:1},{name:'Glutes',sets:.5,direct:0}]);
const context={now:10*60_000,hardRir:2,week:{completedDays:2,plannedDays:3},meso:{current:2,total:6,isComplete:false},next:{day:'B',exercises:4},
 evidence:[{exerciseId:'lift:a',scope:'current-block',evidenceState:'insufficient',evidenceCount:1,reason:'single-observation'}],lifts:{'lift:a':{exerciseId:'slot:a',name:'Current name',next:{glyph:'repeat',line:'100 × 5'}}}};
const input={session:'new',date:'2026-10-18',day:'A',startedAt:60_000,rows:[row()],previousRows:[past]};
const before=JSON.stringify({input,context});
const summary=buildSessionSummary(input,context);
// Hand-calculated complete result: ten more kg, one direct set and half an
// assisting set, nine elapsed minutes. No expected output uses the owner.
assert.deepEqual(summary,JSON.parse(readFileSync(new URL('./fixtures/session-summary-v1.json',import.meta.url),'utf8')));
assert.deepEqual(sessionMuscleWork([row({muscle:{load:100,reps:5,rir:3,primary:['Quads'],secondary:[]}})],2),[],'above-ceiling RIR earns no hard-set credit');
assert.equal(buildSessionSummary({...input,rows:[row({tonnage:null})]},context).volume,0,'unknown tonnage contributes nothing');
assert.equal(summary.minutes,9);assert.equal(summary.showBaseline,true);assert.equal(summary.volume,500);
assert.equal(summary.lifts,1);assert.deepEqual(summary.week,{done:2,planned:3});
assert.equal(summary.liftGroups[0].name,'Squat','performed label retained');
assert.equal(summary.liftGroups[0].exerciseId,'slot:a');
assert.deepEqual(summary.liftGroups[0].next,{glyph:'repeat',line:'100 × 5'});
assert.equal(buildSessionSummary({...input,startedAt:context.now-481*60_000},context).minutes,null,'overnight draft has no duration');
assert.equal(buildSessionSummary({...input,startedAt:null},context).minutes,null);
const insufficient=structuredClone(context);insufficient.evidence[0].reason='incomparable';
assert.equal(sessionOutcomeGroups(input.rows,insufficient).showBaseline,false,'prior insufficient evidence is not baseline');
const observed=structuredClone(context);observed.evidence[0]={exerciseId:'lift:a',scope:'current-block',evidenceState:'sufficient',evidenceCount:2,reason:null,outcome:'maintained'};
assert.deepEqual(buildSessionSummary(input,observed).outcomes,[{exerciseId:'lift:a',outcome:'maintained',name:'Squat'}]);
const unknownOutcome=structuredClone(context);unknownOutcome.evidence[0]={exerciseId:'lift:a',scope:'current-block',evidenceState:'sufficient',evidenceCount:2,reason:null,outcome:'invented'};
assert.equal(sessionOutcomeGroups(input.rows,unknownOutcome).evidence[0].kind,'insufficient','unrecognized outcome never acquires authority');
assert.equal(JSON.stringify({input,context}),before,'pure projection does not mutate captured facts');
console.log('PASS pure session summary records, conventions, raw muscle credit, evidence, duration and immutable inputs');
