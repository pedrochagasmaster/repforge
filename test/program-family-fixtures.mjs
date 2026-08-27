import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixtureUrl = new URL("./fixtures/program-families-v1.json", import.meta.url);
const source = readFileSync(fixtureUrl, "utf8");
const fixture = JSON.parse(source);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function dayId(blueprint, dayIndex) {
  return `${blueprint.id.replace(/_v1$/, "")}_d${dayIndex + 1}`;
}

function slotId(blueprint, dayIndex, slotIndex) {
  return `${dayId(blueprint, dayIndex)}_s${slotIndex + 1}`;
}

function validate(input) {
  assert.equal(input.schemaVersion, 1);
  assert.equal(input.contractStatus, "proposed_owner_review_required");
  assert.equal(input.defaultBlockWeeks, 6);
  assert.equal(input.dayIdDerivation, "<blueprint id without _v1>_d<one-based day index>");
  assert.equal(input.slotIdDerivation, "<day id>_s<one-based slot index>");

  const familyIds = input.families.map((family) => family.id);
  assert.deepEqual(familyIds, ["growth", "balanced", "strength", "home"]);
  assert.equal(new Set(familyIds).size, familyIds.length);
  assert(input.families.every((family) => family.version === 1));
  assert(input.families.every((family) => family.browse === false));
  assert(input.families.every((family) => family.sessionMinuteFit.includes(30)));
  assert.deepEqual(input.families.find((family) => family.id === "home").equipmentFit, ["limited_home"]);

  const blueprints = new Map(input.blueprints.map((blueprint) => [blueprint.id, blueprint]));
  assert.equal(blueprints.size, 20);

  const allDayIds = new Set();
  const allSlotIds = new Set();
  const allowedStrategies = new Set(input.engineContract.strategies);
  const allowedRoles = new Set(["primary", "volume_counterpart", "compound_assistance", "isolation_assistance"]);

  for (const family of input.families) {
    const references = { ...family.blueprints, ...family.generatedRecipes };
    assert.deepEqual(Object.keys(references).sort(), ["2", "3", "4", "5", "6"]);
    for (const frequency of [2, 3, 4, 5, 6]) {
      const blueprint = blueprints.get(references[frequency]);
      assert(blueprint, `${family.id} ${frequency}-day reference exists`);
      assert.equal(blueprint.familyId, family.id);
      assert.equal(blueprint.days.length, frequency);
      assert.equal(blueprint.kind, frequency === 3 || frequency === 5 ? "sibling" : "recipe");
    }

    const three = blueprints.get(family.blueprints[3]);
    const five = blueprints.get(family.blueprints[5]);
    assert.notDeepEqual(three.days, five.days.slice(0, 3), `${family.id} siblings are not prefix copies`);
    assert.notEqual(JSON.stringify(three.days).repeat(2), JSON.stringify(five.days), `${family.id} siblings are not repetitions`);
  }

  for (const blueprint of input.blueprints) {
    assert.match(blueprint.id, /^(growth|balanced|strength|home)_[2-6]_v1$/);
    blueprint.days.forEach((day, dayIndex) => {
      assert(Array.isArray(day) && day.length > 0);
      const resolvedDayId = dayId(blueprint, dayIndex);
      assert(!allDayIds.has(resolvedDayId));
      allDayIds.add(resolvedDayId);
      day.forEach((templateId, slotIndex) => {
        const contract = input.slotContracts[templateId];
        assert(contract, `${blueprint.id} references ${templateId}`);
        assert(allowedRoles.has(contract.role));
        assert(allowedStrategies.has(contract.strategy), `${templateId} uses allowed proposed strategy`);
        const prescriptionKey = `${contract.role}|${contract.strategy}`;
        assert(input.rules.prescriptions.byRoleAndStrategy[prescriptionKey], `${templateId} resolves ${prescriptionKey}`);
        assert.equal(contract.requiresLibraryId, true, `${templateId} requires exercise-library provenance`);
        assert(contract.patterns.length > 0);
        assert(contract.muscles.length > 0);
        assert(contract.substitutionClass.length > 0);
        const resolvedSlotId = slotId(blueprint, dayIndex, slotIndex);
        assert(!allSlotIds.has(resolvedSlotId));
        allSlotIds.add(resolvedSlotId);
      });
    });
  }

  const relationIds = new Set();
  for (const [blueprintId, relations] of Object.entries(input.pairedRelations)) {
    const blueprint = blueprints.get(blueprintId);
    assert(blueprint);
    for (const relation of relations) {
      assert.equal(relation.version, 1);
      assert(!relationIds.has(relation.id));
      relationIds.add(relation.id);
      const [heavyDay, heavySlot] = relation.heavy;
      const [volumeDay, volumeSlot] = relation.volume;
      const heavy = input.slotContracts[blueprint.days[heavyDay]?.[heavySlot]];
      const volume = input.slotContracts[blueprint.days[volumeDay]?.[volumeSlot]];
      assert(heavy && volume, `${relation.id} resolves both members`);
      assert.equal(heavy.role, "primary");
      assert.equal(heavy.strategy, "anchor_backoff@1");
      assert.equal(volume.role, "volume_counterpart");
      assert.equal(volume.strategy, "range@1");
      assert(heavy.patterns.some((pattern) => volume.patterns.includes(pattern)), `${relation.id} shares a movement pattern`);
      assert.notEqual(slotId(blueprint, heavyDay, heavySlot), slotId(blueprint, volumeDay, volumeSlot));
    }
  }

  assert.equal(input.engineContract.status, "proposed_unmerged");
  assert.deepEqual(input.engineContract.relations, ["paired_exposure@1"]);
  assert.deepEqual(input.engineContract.modifiers, ["reentry@1"]);

  const allocation = input.rules.allocation;
  assert.deepEqual(allocation.minuteBands, [30, 45, 60, 75, 90]);
  assert.deepEqual(allocation.frequencyBands, [2, 3, 4, 5, 6]);
  assert.deepEqual(Object.keys(allocation.sessionCaps).sort(), ["established", "new", "some"]);
  assert.deepEqual(Object.keys(allocation.weeklyCaps).sort(), ["established", "new", "some"]);
  for (const values of Object.values(allocation.sessionCaps)) assert.equal(values.length, 5);
  for (const values of Object.values(allocation.weeklyCaps)) assert.equal(values.length, 5);

  assert.equal(input.rules.prescriptions.version, 1);
  for (const prescription of Object.values(input.rules.prescriptions.byRoleAndStrategy)) {
    assert(Object.values(prescription.setsByMaturity).every((sets) => Number.isInteger(sets) && sets > 0));
    const repBounds = prescription.repRange || prescription.perSetRange;
    assert(repBounds[0] > 0 && repBounds[1] >= repBounds[0]);
    assert(prescription.targetRirRange[0] >= 0 && prescription.targetRirRange[1] >= prescription.targetRirRange[0]);
  }

  const time = input.rules.time;
  assert.equal(time.version, 1);
  assert(time.workingSetSeconds > 0);
  assert(time.buffer.minimumSeconds > 0);
  assert(time.buffer.subtotalPercent > 0);

  assert.equal(input.rules.profiles.simple_start.maxSetsPerSlot, 2);
  assert.equal(input.rules.profiles.simple_start.maxSlotsPerDay, 5);
  assert.deepEqual(input.rules.profiles.simple_start.strategies, ["range@1"]);
  assert.equal(input.rules.profiles.reentry.interrupted.normalFromWeek, 2);
  assert.equal(input.rules.profiles.reentry.returning.normalFromWeek, 3);

  const sixWeek = input.syntheticExamples.find((example) => example.weeks === 6);
  const fiftyTwoWeek = input.syntheticExamples.find((example) => example.weeks === 52);
  assert(sixWeek.expectedSameStructureEveryWeek);
  assert.equal(sixWeek.scheduledDeload, false);
  assert.equal(fiftyTwoWeek.expectedCompleteBlocks, Math.floor(52 / input.defaultBlockWeeks));
  assert.equal(fiftyTwoWeek.expectedTrailingWeeks, 52 % input.defaultBlockWeeks);
  assert(fiftyTwoWeek.expectedSameStructureWithinEachPinnedBlock);
  assert.equal(fiftyTwoWeek.scheduledDeload, false);

  assert(!/(deloadWeek|weekRotation|randomSeed|volumeTolerance|entitlement)/i.test(source));
  assert(!/(nippard|powerbuilding|boostcamp)/i.test(source));

  return {
    families: input.families.length,
    blueprints: blueprints.size,
    days: allDayIds.size,
    slots: allSlotIds.size,
    relations: relationIds.size
  };
}

deepFreeze(fixture);
const first = validate(fixture);
const second = validate(fixture);
assert.deepEqual(second, first);
console.log(`PASS program-family fixtures: ${JSON.stringify(first)}`);
