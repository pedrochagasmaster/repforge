import {createGenerationRules} from '../src/training/generation.js';
import {createEntryAdapter} from '../src/training/authoring.js';
import {readFileSync} from 'node:fs';
const {compiler:Compiler,identity}=createGenerationRules();
const Adapter=createEntryAdapter({compiler:Compiler});
const Catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url)));
identity.prepareCatalog(Catalog);
// Archive faults need direct structural validation, independent of today's
// catalog and current request eligibility. This proof shares compiler-search.
import assert from 'node:assert/strict';


    const mapped=Adapter.programRequestFromAnswers({desiredResult:'muscle_growth',structuredExperience:'over_24m',daysPerWeek:4,sessionMinutes:60,environment:{kind:'commercial_gym'}},Catalog);
  const generated=Compiler.generateProgram(mapped.value,Catalog);
  assert.equal(generated.ok,true);
  assert.deepEqual(Compiler.validateProgramDefinitionStructure(generated.value),{ok:true,issues:[]});
  const historical=structuredClone(generated.value);
  historical.generatorVersion='historical-build';
  historical.request.split='retired_split'; historical.provenance.split='retired_split';
  historical.request.gymProfile.equipmentIds=['historical:equipment'];
  historical.request.gymProfile.equipmentLoadsKg={'historical:equipment':[0,10]};
  historical.request.excludedExerciseIds=['historical:excluded'];
  historical.request.emphasisMuscleIds=['historical:muscle'];
  historical.request.movementConfirmations={'historical:exercise':['historical:prerequisite']};
  historical.request.executionContexts={'historical:exercise':'unilateral'};
  for(const slot of historical.days.flatMap(d=>d.slots)) {
    slot.exerciseId='historical:'+slot.exerciseId;
    slot.sourceExerciseIds=[slot.exerciseId];
    slot.musclePurposeIds=['historical:muscle'];
    slot.movementPatternIds=['historical:pattern'];
    slot.exerciseTypeId='historical:type'; slot.lateralityIds=['historical:laterality'];
    slot.alternates=['historical:alternate'];
  }
  const original=JSON.stringify(historical);
  assert.deepEqual(Compiler.validateProgramDefinitionStructure(historical),{ok:true,issues:[]},'unknown historical catalog identities and split remain structurally readable');
  assert.equal(JSON.stringify(historical),original,'archive validation never rewrites authored structure');
  assert.equal(Compiler.validateProgramDefinition(historical,Catalog).ok,false,'current catalog validation remains strict');
  assert.equal(Compiler.validateProgramDefinition(historical).ok,false,'existing no-catalog behavior is unchanged');
  const first=p=>p.days.flatMap(d=>d.slots)[0];
  const set=p=>first(p).prescriptionsByCycle[0].sets[0];
  for(const mutate of [
    p=>{p.schemaVersion=99;}, p=>{p.request.executionContexts['historical:exercise']='sideways';},
    p=>{p.request.movementConfirmations['historical:exercise']=[{}];},
    p=>{p.request.gymProfile.equipmentIds=[{}];},
    p=>{first(p).musclePurposeIds=[{}];},p=>{first(p).movementPatternIds=[3];},
    p=>{first(p).lateralityIds=[null];},p=>{first(p).exerciseTypeId={};},
    p=>{first(p).metricDefinitions[0].unit='invented';},p=>{set(p).rir=7;},
    p=>{set(p).targets={invented:{min:1,max:2}};},p=>{set(p).actuals={};},
    p=>{p.days[1].id=p.days[0].id;},p=>{set(p).setIndex=0;},
    p=>{p.request.split=42;},p=>{p.provenance.split='';},
    p=>{Object.defineProperty(p.request,'split',{get(){throw new Error('must not invoke accessors');},enumerable:true});},
  ]) {
    const broken=structuredClone(historical);mutate(broken);
    assert.equal(Compiler.validateProgramDefinitionStructure(broken).ok,false);
  }
  const v1=structuredClone(historical);v1.schemaVersion=1;
  for(const slot of v1.days.flatMap(d=>d.slots))for(const cycle of slot.prescriptionsByCycle)for(const set of cycle.sets){set.metricIds=[...slot.metricIds];set.metricDefinitions=structuredClone(slot.metricDefinitions);}
  assert.equal(Compiler.validateProgramDefinitionStructure(v1).ok,true,'supported authored v1 metric composition remains readable');
  assert.equal(Compiler.validateProgramDefinitionStructure(null).ok,false);
  console.log('archive structure accepts supported historical identities without catalog claims and rejects malformed definitions; current validation unchanged');
