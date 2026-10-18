import { cloneSnapshot as clone } from "../../model/internal/values.js";
const REP_TARGET_SEMANTICS = new Set(["reps", "repsPerSide"]);
const ADAPTIVE_POLICY_VERSION = "manual-adaptive@1";
const EXECUTION_MODES = new Set(["bilateral", "unilateral"]);
function definitionFor(document) {
  const value = document?.programMeta?.programDefinition;
  return value && Array.isArray(value.days) ? value : null;
}
function definitionSlot(document, slotId) {
  const definition = definitionFor(document);
  for (const day of definition?.days || []) {
    const slot = (day.slots || []).find(candidate => candidate?.id === slotId);
    if (slot) return slot;
  }
  return null;
}
function slotSets(slot) {
  return (slot?.prescriptionsByCycle || []).flatMap(cycle => cycle?.sets || []);
}
function slotAdaptive(slot) {
  const sets = slotSets(slot);
  return sets.length > 0 && sets.every(set => set.status === "ready");
}
function pendingSuggestLoads(document) {
  const list = document?.programMeta?.suggestLoadsPending;
  return Array.isArray(list) ? list.filter(id => typeof id === "string" && id) : [];
}
function setPendingSuggestLoads(document, list) {
  document.programMeta = document.programMeta || {};
  const unique = [...new Set(list)];
  if (unique.length) document.programMeta.suggestLoadsPending = unique;
  else delete document.programMeta.suggestLoadsPending;
}
function slotRepSemantic(slot) {
  return (slot?.metricDefinitions || []).find(definition => REP_TARGET_SEMANTICS.has(definition.semantic))?.semantic || null;
}
function repRange(target) {
  const range = Number.isSafeInteger(target) ? { min: target, max: target }
    : target && typeof target === "object" ? { min: target.min, max: target.max } : null;
  return range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) &&
    range.min >= 1 && range.max >= range.min && range.max <= 30 ? range : null;
}
function validRir(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 6;
}
function uniformRir(slot) {
  const values = slotSets(slot).map(set => set.rir);
  return values.length && values.every(value => validRir(value) && value === values[0]) ? values[0] : null;
}
function executionModeRequired(slot, policy) {
  return !!policy?.executionModeQuestion?.(slot) && !EXECUTION_MODES.has(slot?.executionMode);
}
/**
 * The first input a pending slot still needs, or null when it can be
 * confirmed. The opt-in asks for one RIR for the slot: sets that disagree
 * leave its field empty, so they need the lifter's answer too.
 */
function suggestLoadsIssue(slot, policy) {
  if (!slot || policy?.eligibility?.(slot) !== "eligible") return "eligibility";
  const semantic = slotRepSemantic(slot), sets = slotSets(slot);
  if (!semantic || !sets.length || sets.some(set => !repRange(set.targets?.[semantic]))) return "range";
  if (uniformRir(slot) == null) return "rir";
  if (executionModeRequired(slot, policy)) return "execution_mode";
  return null;
}
function suggestLoadsIssues(document, policy) {
  return pendingSuggestLoads(document).flatMap(slotId => {
    const slot = definitionSlot(document, slotId);
    const field = slot ? suggestLoadsIssue(slot, policy) : null;
    return field ? [{ slotId, field }] : [];
  });
}
/** Confirms every pending opt-in, or refuses the whole document. */
function confirmSuggestLoads(input, policy) {
  const document = clone(input);
  const issues = suggestLoadsIssues(document, policy);
  if (issues.length) return { ok: false, issues };
  const confirmed = [];
  for (const slotId of pendingSuggestLoads(document)) {
    const slot = definitionSlot(document, slotId);
    if (!slot) continue;
    for (const set of slotSets(slot)) {
      set.status = "ready";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: ADAPTIVE_POLICY_VERSION };
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    confirmed.push(slotId);
  }
  if (document.programMeta) setPendingSuggestLoads(document, []);
  return { ok: true, document, confirmed };
}
function setSuggestLoads(document, slotId, on) {
  const slot = definitionSlot(document, slotId);
  if (!slot) return false;
  const pending = pendingSuggestLoads(document).filter(id => id !== slotId);
  if (on) {
    if (!slotAdaptive(slot)) pending.push(slotId);
  } else {
    // Off restores manual and keeps every value the lifter typed.
    for (const set of slotSets(slot)) {
      set.status = "manual";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
  }
  setPendingSuggestLoads(document, pending);
  return true;
}
function setSlotRir(document, slotId, rir) {
  const slot = definitionSlot(document, slotId);
  if (!slot) return false;
  for (const set of slotSets(slot)) set.rir = rir;
  const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
  if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
  return true;
}

export { definitionFor,definitionSlot,slotSets,slotAdaptive,pendingSuggestLoads,setPendingSuggestLoads,slotRepSemantic,repRange,validRir,uniformRir,executionModeRequired,suggestLoadsIssue,suggestLoadsIssues,confirmSuggestLoads,setSuggestLoads,setSlotRir };
export default Object.freeze({confirm:confirmSuggestLoads,issues:suggestLoadsIssues,set:setSuggestLoads,setRir:setSlotRir,
  definitionFor,definitionSlot,slotSets,slotAdaptive,pendingSuggestLoads,setPendingSuggestLoads,slotRepSemantic,repRange,validRir,uniformRir,executionModeRequired,suggestLoadsIssue,suggestLoadsIssues,confirmSuggestLoads,setSuggestLoads,setSlotRir});
