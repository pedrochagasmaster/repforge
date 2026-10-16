import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { create } = require('../generation-candidates.js');
const source = JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json', import.meta.url)));
const HP = '19e5c6f170d880d69589ce8bd1fde648';
const LAT = '2945c6f170d880eb931efa3238d46d68';
const CHEST = '2545c6f170d8805f823bcfb076a74397';
const LATS = '2545c6f170d88060a50ec9b41a066a5d';
const primary = '2dc5c6f170d88157bb0bd7609d767bc6';
const secondary = '2dc5c6f170d8814c8fcaf2e322abde4d';
const accessory = '2dc5c6f170d881faa946ee13702e7ea7';
function row(id, tier = 1, extra = {}) {
  return { ...source.exercises[0], id, movementPattern: [HP], preconditions: [], resistanceEquipmentGroupIds: [], supportEquipmentGroupIds: [], emphasizedAgonist: [], deemphasizedAgonist: [], exclusionGroupings: [], exerciseClassificationStrength: [primary, secondary, accessory], exerciseClassificationHypertrophy: [primary, secondary, accessory], strengthPrimaryCompoundRecommendationLevel: tier, hypertrophySecondaryCompoundRecommendationLevel: tier, hypertrophyAccessoryRecommendationLevel: tier, ...extra };
}
const request = (extra = {}) => ({ goal: 'hybrid', experience: 'advanced', gymProfile: { equipmentIds: [] }, competencyAnswers: {}, emphasisMuscleIds: [], deprioritizedMuscleIds: [], preferredExerciseIds: [], ...extra });
const selector = (rows, req = request(), hard = () => true) => create({ ...source, exercises: rows }, req, hard);
const spec = { type: 'primary', pattern: 'horizontalPush', isFirstOfType: true };
assert.throws(() => create(source, request()), /hardAllowed/);
assert.equal(selector([]).choose(spec, []), null);
assert.equal(selector([row('b'), row('a')]).choose(spec, []).id, 'a');
assert.equal(selector([row('a', 1), row('b', 2)], request({ preferredExerciseIds: ['b'] })).choose(spec, []).id, 'a');
assert.equal(selector([row('a'), row('b')], request({ preferredExerciseIds: ['b'] })).choose(spec, []).id, 'b');
assert.equal(selector([row('a')], request(), () => false).choose(spec, []), null);
// Hypertrophy60 is a separate source-backed slice. Synthetic tier/classification
// counterexamples distinguish selection from changing only the final doses.
const hRequest=request({goal:'hypertrophy'});
const hTierRows=[row('a',1,{hypertrophyPrimaryCompoundRecommendationLevel:3}),
 row('b',3,{hypertrophyPrimaryCompoundRecommendationLevel:1})];
let hTierSelector;
assert.doesNotThrow(()=>{hTierSelector=selector(hTierRows,hRequest);},'hypertrophy must enter the recovered candidate domain');
assert.equal(selector(hTierRows).choose(spec,[]).id,'a','both primary keeps its strength tier');
assert.equal(hTierSelector.choose(spec,[]).id,'b','hypertrophy primary uses its own recommendation tier');
const hClassRows=[row('a',0,{exerciseClassificationHypertrophy:[secondary,accessory],hypertrophyPrimaryCompoundRecommendationLevel:0}),
 row('b',2,{exerciseClassificationStrength:[secondary,accessory],hypertrophyPrimaryCompoundRecommendationLevel:2})];
assert.equal(selector(hClassRows).choose(spec,[]).id,'a');
assert.equal(selector(hClassRows,hRequest).choose(spec,[]).id,'b','hypertrophy primary uses hypertrophy classification, independently of strength classification');
assert.equal(selector([row('a',0,{hypertrophyPrimaryCompoundRecommendationLevel:null})],hRequest).choose(spec,[]),null,
 'a null hypertrophy tier cannot borrow an available strength tier');
const hSecondaryRows=[row('a',0,{strengthSecondaryCompoundRecommendationLevel:0,hypertrophySecondaryCompoundRecommendationLevel:3}),
 row('b',3,{strengthSecondaryCompoundRecommendationLevel:3,hypertrophySecondaryCompoundRecommendationLevel:1})];
assert.equal(selector(hSecondaryRows,hRequest).choose({...spec,type:'secondary'},[]).id,'b','secondary keeps hypertrophy tier');
const hChestPattern='19e5c6f170d8805c9eace37a0d0113f1';
const hAccessoryRows=hSecondaryRows.map(raw=>({...raw,movementPattern:[hChestPattern],
 strengthAccessoryRecommendationLevel:raw.strengthSecondaryCompoundRecommendationLevel,
 hypertrophyAccessoryRecommendationLevel:raw.hypertrophySecondaryCompoundRecommendationLevel}));
assert.equal(selector(hAccessoryRows,hRequest).choose({type:'accessory',muscle:'chest'},[]).id,'b','accessories keep hypertrophy tier');
const hAdjustedRows=[row('a',0,{hypertrophyPrimaryCompoundRecommendationLevel:2}),
 row('b',3,{hypertrophyPrimaryCompoundRecommendationLevel:2,emphasizedAgonist:[CHEST,LATS]})];
assert.equal(selector(hAdjustedRows,request({goal:'hypertrophy',emphasisMuscleIds:[CHEST,LATS]})).choose(spec,[]).id,'b',
 'the primary goal tier changes without losing the boolean source priority adjustment');
assert.throws(() => selector([], request({ goal: 'unknown' })), /Unsupported/);
assert.throws(() => selector([], request({ gymProfile: { equipmentIds: [], equipmentConfigById: { x: {} } } })), /Unsupported/);
assert.throws(() => selector([]).choose({ type: 'primary', pattern: 'horizontalPush' }, []), /specification/);
assert.throws(() => selector([]).choose({ type: 'accessory', muscle: 'unknown' }, []), /specification/);
const muscleLookup = selector([]);
const muscleNames = ['triceps','glutes','forearms','sideDelts','quads','lowerBack','abductors','adductors','rearDelts','upperBack','neck','lats','hamstrings','upperTraps','abs','biceps','calves','chest','frontDelts','serratus','tibs','obliques'];
assert.equal(muscleLookup.muscleId('chest'), CHEST);
assert.equal(muscleLookup.muscleId('tibs'), '27a5c6f170d880a5baa9c716b240d0f6');
assert.equal(muscleLookup.muscleId('Chest'), undefined);
assert.equal(muscleLookup.muscleId('toString'), undefined);
const muscleIds = muscleNames.map(name => muscleLookup.muscleId(name));
assert.equal(new Set(muscleIds).size, 22);
assert.ok(muscleIds.every(id => source.uuidIndex[id]?.type === 'featureMuscleGroup'));
const identity = selector([row('a')]);
const chosen = identity.choose(spec, []);
assert.equal(identity.choose(spec, [{ exercise: chosen, type: 'primary' }]), null);
assert.equal(chosen.raw.id, 'a');
assert.equal(chosen, identity.choose(spec, []));
// Second score group at overlap0 beats first at overlap1, but third cannot escape a nonempty first batch.
const prior = { exercise: { id: 'prior', exclusionGroupings: ['x'], raw: { resistanceEquipmentGroupIds: [] } }, type: 'primary' };
assert.equal(selector([row('a', 1, { exclusionGroupings: ['x'] }), row('b', 2)]).choose(spec, [prior]).id, 'b');
assert.equal(selector([row('a', 1, { exclusionGroupings: ['x'] }), row('b', 2, { exclusionGroupings: ['x'] }), row('c', 3)]).choose(spec, [prior]).id, 'a');
// Repeated identities leave their score bucket in place for batches of two.
// Catalog-controlled tiers and repeated-only buckets cannot be injected through the UI.
const VP = '19e5c6f170d8805a8a1cf72d5e7a401f';
const bucketRows = [row('a', 1, { exclusionGroupings: ['x'] }),
  row('b', 2, { movementPattern: [HP, VP], exclusionGroupings: ['x'] }), row('c', 3)];
const bucketSelector = selector(bucketRows);
const repeatedBucket = bucketSelector.choose({ ...spec, pattern: 'verticalPush' }, []);
assert.equal(repeatedBucket.id, 'b');
assert.equal(bucketSelector.choose(spec, [{ type: 'primary', exercise: repeatedBucket }]).id, 'a',
  'an emptied middle score bucket cannot merge score three into the first batch');
const bucketChest = '19e5c6f170d8805c9eace37a0d0113f1';
const accessoryBuckets = selector(bucketRows.map(raw => ({ ...raw, movementPattern: [bucketChest, ...raw.movementPattern] })));
const repeatedAccessoryBucket = accessoryBuckets.choose({ ...spec, pattern: 'verticalPush' }, []);
assert.equal(accessoryBuckets.choose({ type: 'accessory', muscle: 'chest' },
  [{ type: 'primary', exercise: repeatedAccessoryBucket }]).id, 'a',
  'accessories retain the same emptied bucket position');
// Compound adjustments are boolean, not the number of matching muscles.
const adjusted = selector([row('a', 2), row('b', 2, { emphasizedAgonist: [CHEST, LATS] })], request({ emphasisMuscleIds: [LATS, CHEST] }));
assert.equal(adjusted.choose(spec, []).id, 'b');
assert.deepEqual(adjusted.priorities, ['chest', 'lats']);
assert.throws(() => selector([], request({ emphasisMuscleIds: [CHEST], deprioritizedMuscleIds: [CHEST] })), /contradict/);
assert.equal(selector([row('a', 1, { deemphasizedAgonist: [CHEST] }), row('b', 1)], request({ emphasisMuscleIds: [CHEST] })).choose(spec, []).id, 'b');
assert.equal(selector([row('a', 1, { deemphasizedAgonist: [CHEST] }), row('b', 1)], request({ emphasisMuscleIds: [CHEST] })).choose({ ...spec, isFirstOfType: false }, []).id, 'a');
// Positive equipment fallback counts remain numeric: two overlaps beat three.
const bar = '19e5c6f170d8801cac93cf6853bd86b8', smith = '19e5c6f170d880d29affc687810a9a8a';
const overlapHistory = [[bar, smith], [bar, smith], [bar]].map((ids, i) => ({ type: 'primary', exercise: {
  id: `priorEquipment${i}`, exclusionGroupings: ['x'], raw: { resistanceEquipmentGroupIds: ids },
} }));
assert.equal(selector([
  row('a', 1, { exclusionGroupings: ['x'], resistanceEquipmentGroupIds: [bar] }),
  row('b', 1, { exclusionGroupings: ['x'], resistanceEquipmentGroupIds: [smith] }),
], request({ gymProfile: { equipmentIds: [bar, smith, '1a45c6f170d880629cdcc99a2ff615cf'] }, preferredExerciseIds: ['a'] })).choose(spec, overlapHistory).id, 'b');
const chestPattern = '19e5c6f170d8805c9eace37a0d0113f1';
assert.equal(selector([
  row('a', 1, { movementPattern: [chestPattern] }),
  row('b', 1.5, { movementPattern: [chestPattern], emphasizedAgonist: [CHEST] }),
], request({ emphasisMuscleIds: [CHEST] })).choose({ type: 'accessory', muscle: 'chest' }, []).id, 'a');
// Accessory tier is pure; lats alternate single-joint then multi-joint from incremental selected.
const single = row('a', 2, { movementPattern: [LAT], exerciseType: '2095c6f170d880798c80daebcf85afd5', emphasizedAgonist: [LATS] });
const multi = row('b', 1, { movementPattern: [LAT], exerciseType: '2095c6f170d880cfaa50c22ebaf14a9d' });
const accessories = selector([single, multi], request({ emphasisMuscleIds: [LATS] }));
const first = accessories.choose({ type: 'accessory', muscle: 'lats' }, []);
assert.equal(first.id, 'a');
assert.equal(accessories.choose({ type: 'accessory', muscle: 'lats' }, [{ exercise: first, type: 'accessory', accessoryMuscle: 'lats' }]).id, 'b');
// Source gated IDs cannot use empty preconditions as a shortcut.
const gated = row('2925c6f170d88037b3d9c22ff48a9988');
assert.equal(selector([gated]).choose(spec, []), null);
assert.equal(selector([gated], request({ competencyAnswers: { pullups10: true } })).choose(spec, []).id, gated.id);
assert.equal(selector([gated], request({ competencyAnswers: { pullups10: false } })).choose(spec, []), null);
assert.equal(selector([row('unknown', 1, { preconditions: ['2bd5c6f170d880548d80f2a68e8b511c'] })], request({ movementConfirmations: { unknown: ['2bd5c6f170d880548d80f2a68e8b511c'] } })).choose(spec, []), null);


// Independent ternary-history boundaries exercise every accessory alternation branch.
const variantFields = {
  forearms: [
    { movementPattern: ['31f5c6f170d880c2a8c6d9f12cb4f55a'] },
    { movementPattern: ['31f5c6f170d88047b8f4e5db006555e2'] },
    { movementPattern: ['19f5c6f170d880e8a7dae21508321c52'] },
  ],
  neck: [
    { movementPattern: ['31f5c6f170d88011a56de8ead2c09e21'] },
    { movementPattern: ['31f5c6f170d88074af04d3c9bda82e04'] },
    { movementPattern: ['2945c6f170d88030ab99cfe4dc50a036'] },
  ],
  lats: [
    { movementPattern: [LAT], exerciseType: '2095c6f170d880798c80daebcf85afd5' },
    { movementPattern: [LAT], exerciseType: '2095c6f170d880cfaa50c22ebaf14a9d' },
    { movementPattern: [LAT], exerciseType: '2495c6f170d8804a9298e4daeded2415' },
  ],
  quads: [
    { movementPattern: ['19f5c6f170d8801ba857e819c22df603'], primaryJointAction: ['1925c6f170d8803e8da0f45646461d58'] },
    { movementPattern: ['19f5c6f170d880c58cfce21635c82043'], primaryJointAction: [] },
    { movementPattern: ['19f5c6f170d8801ba857e819c22df603'], primaryJointAction: [] },
  ],
  hamstrings: [
    { movementPattern: ['19f5c6f170d880fcad8cf755a5ab9136'], primaryJointAction: ['1925c6f170d880f79e40cda997e51df6'] },
    { movementPattern: ['19f5c6f170d880fcad8cf755a5ab9136'], primaryJointAction: ['1925c6f170d88062bfccfcc57a7aa559'] },
    { movementPattern: ['19f5c6f170d880fcad8cf755a5ab9136'], primaryJointAction: [] },
  ],
};
const patternNames = {
  '31f5c6f170d880c2a8c6d9f12cb4f55a': 'anteriorForearmAccessory', '31f5c6f170d88047b8f4e5db006555e2': 'posteriorForearmAccessory',
  '19f5c6f170d880e8a7dae21508321c52': 'forearmAccessories', '31f5c6f170d88011a56de8ead2c09e21': 'neckFlexorAccessory',
  '31f5c6f170d88074af04d3c9bda82e04': 'neckExtensorAccessory', '2945c6f170d88030ab99cfe4dc50a036': 'neckAccessory',
  [LAT]: 'latAccessory', '19f5c6f170d8801ba857e819c22df603': 'quadAccessory',
  '19f5c6f170d880c58cfce21635c82043': 'lungeOrSplitSquatOrStepUpOrSingleLegSquat', '19f5c6f170d880fcad8cf755a5ab9136': 'hamstringAccessory',
};
let boundaries = 0;
for (const [muscle, fields] of Object.entries(variantFields)) {
  const alternator = selector(fields.map((value, i) => row(String(i), 1, value)));
  for (let length = 0; length <= 4; length++) {
    for (let encoded = 0; encoded < 3 ** length; encoded++) {
      let value = encoded;
      const variants = Array.from({ length }, () => { const result = value % 3; value = Math.floor(value / 3); return result; });
      const history = variants.map((v, i) => ({ type: 'accessory', accessoryMuscle: muscle, exercise: {
        id: `history${i}`, raw: { resistanceEquipmentGroupIds: [] }, patterns: fields[v].movementPattern.map((id) => patternNames[id]),
        exerciseType: v === 0 ? 'singleJoint' : v === 1 ? 'multiJoint' : 'core',
        primaryJointActions: (fields[v].primaryJointAction || []).map((id) => id === '1925c6f170d880f79e40cda997e51df6' ? 'kneeFlexion' : id === '1925c6f170d8803e8da0f45646461d58' ? 'kneeExtension' : 'hipExtension'), exclusionGroupings: [],
      } }));
      const wantTrue = muscle === 'forearms' ? !length || variants.at(-1) !== 0
        : muscle === 'neck' ? !!length && variants.at(-1) === 1
        : muscle === 'lats' ? length === 0 || length === 2
        : muscle === 'quads' ? length === 0 || length === 2 || length === 4
        : !(length >= 2 && variants.slice(-2).every((v) => v === 0));
      assert.equal(alternator.choose({ type: 'accessory', muscle }, history)?.id, wantTrue ? '0' : '1', `${muscle}/${variants}`);
      boundaries++;
    }
  }
}
// Real pinned catalogue smoke: no synthetic count target, no capability inferred by defaults.
const allEquipment = Object.entries(source.uuidIndex).filter(([, value]) => value.type === 'equipment').map(([id]) => id);
const real = create(source, request({ gymProfile: { equipmentIds: allEquipment }, competencyAnswers: { pullups10: true, pullups5: true, pushups15: true, inclineBarbell10: true, overheadPress10: true, bodyweightDips10: true, benchPress10: true } }), () => true);
const realSelected = [];
for (const pattern of ['horizontalPush', 'verticalPush', 'horizontalPull', 'verticalPull', 'squat', 'hipHinge']) {
  const exercise = real.choose({ type: 'primary', pattern, isFirstOfType: true }, realSelected);
  assert.ok(exercise && exercise.patterns.includes(pattern));
  realSelected.push({ exercise, type: 'primary' });
}
assert.equal(new Set(realSelected.map(({ exercise }) => exercise.id)).size, 6);
console.log(`generation-candidates: ranking/eligibility/identity cases, ${boundaries} alternation boundaries and pinned catalogue smoke passed`);

// Strength has source-owned classification and recommendation fields for all roles.
const strengthRequest=request({goal:'strength'});
for(const [kind,descriptor,field] of [['primary',primary,'PrimaryCompound'],['secondary',secondary,'SecondaryCompound'],['accessory',accessory,'Accessory']]){
 const strengthSpec=kind==='accessory'?{type:kind,muscle:'chest'}:{...spec,type:kind};
 const rows=[row('a',1,{['strength'+field+'RecommendationLevel']:3,['hypertrophy'+field+'RecommendationLevel']:1}),
  row('b',3,{['strength'+field+'RecommendationLevel']:1,['hypertrophy'+field+'RecommendationLevel']:3})];
 if(kind==='accessory')for(const raw of rows)raw.movementPattern=['19e5c6f170d8805c9eace37a0d0113f1'];
 assert.equal(selector(rows,strengthRequest).choose(strengthSpec,[]).id,'b',`${kind} uses the strength recommendation field`);
 const classificationRows=rows.map((raw,index)=>({...raw,exerciseClassificationStrength:index?[primary,secondary,accessory].filter(d=>d!==descriptor):[descriptor],exerciseClassificationHypertrophy:index?[descriptor]:[]}));
 assert.equal(selector(classificationRows,strengthRequest).choose(strengthSpec,[]).id,'a',`${kind} uses strength classification rather than hypertrophy`);
 assert.equal(selector([{...rows[0],['strength'+field+'RecommendationLevel']:null}],strengthRequest).choose(strengthSpec,[]),null,`${kind} cannot borrow a nonnull hypertrophy tier`);
}

for(const experience of ['beginner','intermediate']){
 const xpRequest=request({experience,split:'upper_lower_full',daysPerWeek:3,timeCeilingMinutes:60,periodization:'static',cycles:7,deloadCycles:[]});
 assert.equal(selector([row('a')],xpRequest).choose(spec,[]).id,'a','controlled experience reaches same candidate pool');
 for(const patch of [{timeCeilingMinutes:40},{goal:'hypertrophy'},{periodization:'linear'},{periodization:'reverse_linear'},{periodization:'undulating'}])
  assert.equal(selector([row('a')],{...xpRequest,...patch}).choose(spec,[]).id,'a','layout duration and period choices do not gate candidate eligibility');
}

// The source capability pool and the product's explicit-no boundary compose at
// the real compiler entry point. Capturing the layout seam avoids constructing
// an unrelated complete program for four eligibility cases.
{
 const Compiler=require('../program-compiler.js');
 const actualLayout=require('../generation-layout.js');
 const compilerText=readFileSync(new URL('../program-compiler.js',import.meta.url),'utf8');
 const bench=source.exercises.find(exercise=>exercise.id==='19f5c6f170d8808bb424e98de4472a7e');
 const unknownHandler=source.exercises.find(exercise=>exercise.id==='24b5c6f170d88089aa60dc0fdfa4478a');
 const base={goal:'hybrid',experience:'advanced',daysPerWeek:4,split:'auto',timeCeilingMinutes:60,periodization:'static',cycles:7,deloadCycles:[],gymProfile:{equipmentIds:allEquipment},competencyAnswers:{},emphasisMuscleIds:[],deprioritizedMuscleIds:[],movementConfirmations:{}};
 let captured;
 const previousLayout=globalThis.RepForgeGenerationLayout,previousCompiler=globalThis.RepForgeProgramCompiler;
 let capturingCompiler;
 try{
  globalThis.RepForgeGenerationLayout={...actualLayout,generate:(_request,candidates)=>{
   captured=candidates.eligibleExerciseIds;return {status:'insufficient',issues:[{code:'controlled_layout_stop'}]};
  }};
  const module={exports:{}};new Function('module','exports','require',compilerText)(module,module.exports,createRequire(new URL('../program-compiler.js',import.meta.url)));capturingCompiler=module.exports;
 }finally{globalThis.RepForgeGenerationLayout=previousLayout;globalThis.RepForgeProgramCompiler=previousCompiler;}
 function eligible(change){
  captured=null;capturingCompiler.generateProgram({...base,...change},source);
  assert(Array.isArray(captured),'valid request reaches the actual source candidate pool');return captured;
 }
 assert(!eligible({}).includes(bench.id),'missing capability is not affirmative');
 assert(eligible({movementConfirmations:{[bench.id]:bench.preconditions}}).includes(bench.id),'individual confirmation unlocks only its known source assessment');
 assert(!eligible({competencyAnswers:{benchPress10:false},movementConfirmations:{[bench.id]:bench.preconditions}}).includes(bench.id),'explicit no remains a product veto after individual confirmation');
 assert(!eligible({competencyAnswers:{benchPress10:true},movementConfirmations:{[unknownHandler.id]:unknownHandler.preconditions}}).includes(unknownHandler.id),'confirmation cannot invent a missing source handler');
 const confirmedAnswers=Object.fromEntries(['pullups10','pullups5','pushups15','inclineBarbell10','overheadPress10','bodyweightDips10','benchPress10'].map(key=>[key,true]));
 const result=Compiler.generateProgram({...base,goal:'strength',competencyAnswers:confirmedAnswers},source);
 assert.equal(result.ok,true,JSON.stringify(result.conflicts));
 const rejectedRow='3895c6f170d8804f9e7edf37ac311801';
 const horizontalPull='19e5c6f170d88009ba40c03d2f6271df';
 const target=result.value.days.flatMap(day=>day.slots).find(slot=>slot.role==='strengthPrimaryCompound'&&slot.movementPatternIds.includes(horizontalPull));
 assert(target,'fixture contains the real primary pulling slot');
 const replacements=Compiler.findSubstitutions(result.value,target.id,{},source);
 assert(replacements.length,'fixture has actual substitution alternatives');
 assert(!replacements.some(candidate=>candidate.exerciseId===rejectedRow),'a finite primary tier does not admit the real Secondary-only D.Y. row');
 for(const replacement of replacements){
  const raw=source.exercises.find(exercise=>exercise.id===replacement.exerciseId);
  assert(raw.exerciseClassificationStrength.includes(primary),'every primary replacement keeps its source classification');
 }
 console.log('generation-candidates: real compiler confirmation vetoes and source-role substitution classification PASS');
}
