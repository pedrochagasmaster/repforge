#!/usr/bin/env node
// Independent acceptance at the real compiler/allocation/estimator boundary.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../program-compiler.js'), P = require('../engine-policy.js');
const A = require('../program-entry-adapter.js'), K = require('../assets/exercise-catalog.json');
const D = require('../programlab/domain.js');
require('../generation-identity.js').prepareCatalog(K);
const request = A.programRequestFromAnswers({ desiredResult: 'muscle_growth', structuredExperience: '6_to_24m', daysPerWeek: 3,
  sessionMinutes: 90, environment: { kind: 'commercial_gym' } }, K).value;
const defaults = P.getDefaultEnginePolicy();
const generate = policy => { const result = C.generateProgram(request, K, { enginePolicy: policy, diagnostics: 'allocation-lineage@1' }); assert.equal(result.ok, true); return result; };
const baseline = generate(defaults), slower = structuredClone(defaults);
slower.timeModel.secondsPerSet = 31;
const assumptions = generate(slower);
const prescriptions = result => result.value.days.map(day => day.slots.map(slot => ({ exerciseId: slot.exerciseId, role: slot.role,
  cycles: slot.prescriptionsByCycle.map(cycle => ({ cycleIndex: cycle.cycleIndex, sets: cycle.sets.map(({ provenance, ...set }) => set) })) })));
assert.deepEqual(prescriptions(assumptions), prescriptions(baseline), 'small time assumption change retains every realized prescription');
const domain = D.create({ estimateDaySeconds: (day, cycle, enginePolicy) => C.estimateDaySeconds(day, cycle, K, { enginePolicy }) });
const baseMetrics = domain.metrics(baseline, defaults, defaults), slowMetrics = domain.metrics(assumptions, slower, defaults);
assert.equal(slowMetrics.cycles[0].duration.common.totalSeconds, baseMetrics.cycles[0].duration.common.totalSeconds, 'common reference ignores the changed own time assumption');
assert(slowMetrics.cycles[0].duration.own.totalSeconds > baseMetrics.cycles[0].duration.own.totalSeconds);
const low = structuredClone(defaults);
for (const key in low.volume.setsByType) low.volume.setsByType[key] = 2;
const changed = generate(low), changedMetrics = domain.metrics(changed, low, defaults);
assert(changedMetrics.cycles[0].workingSets < baseMetrics.cycles[0].workingSets);
assert(changedMetrics.cycles[0].duration.common.totalSeconds < baseMetrics.cycles[0].duration.common.totalSeconds, 'common model sees the actual changed work');
const prior = new Map(baseline.diagnostics.slots.map(slot => [slot.lineage, slot]));
assert(changed.diagnostics.slots.some(slot => prior.has(slot.lineage) && prior.get(slot.lineage).finalDayId !== slot.finalDayId), 'set override reaches native spillover before materialization on a three-day split');
const restPolicy = structuredClone(defaults); restPolicy.prescription.restSeconds.compound = 45; restPolicy.prescription.restSeconds.accessory = 30;
const rested = generate(restPolicy), explicit = rested.value.days[0];
for (const slot of explicit.slots) for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
  assert.equal(set.restSeconds, slot.role.endsWith('Accessory') ? 30 : 45);
}
const reference = structuredClone(defaults); reference.timeModel.upperRestSeconds = 900; reference.timeModel.lowerRestSeconds = 900; reference.timeModel.isolationRestSeconds = 900;
assert.equal(C.estimateDaySeconds(explicit, 1, K, { enginePolicy: reference }), C.estimateDaySeconds(explicit, 1, K, { enginePolicy: defaults }), 'common-model fallback rest never replaces explicit saved rest');
console.log('PL-07/08: native assumptions-only and changed-work cases; own/common estimates, explicit saved rest and pre-materialization three-day spillover passed.');
