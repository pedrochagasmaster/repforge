/** @typedef {import('./editor-contracts.js').EditorDocument} EditorDocument
 * @typedef {import('./editor-contracts.js').EditorRow} EditorRow
 * @typedef {import('./editor-contracts.js').ProgramSlot} ProgramSlot
 * @typedef {import('./editor-contracts.js').MetricDefinition} MetricDefinition
 * @typedef {import('./editor-contracts.js').TargetEdit} TargetEdit
 * @typedef {import('../../model/internal/contracts.js').LibraryEntry & {sets?:number,min?:number,max?:number}} LibraryEntry
 */
/** Speculative program editor documents. Mutations touch only the caller's cloned
 * document; installed/setup application commands own validation and publication. */
import {MAX_SLOT_ALTERNATES} from '../../generation.js';
import {cloneSnapshot as clone,canonicalize} from '../../model.js';
import {definitionFor,definitionSlot,slotAdaptive,repRange,slotSets,setSlotRir} from './suggestion.js';
/** @param {unknown} value */
const canonical=value=>JSON.stringify(canonicalize(value));
const REP_TARGET_SEMANTICS = new Set(['reps','repsPerSide']);
/** @param {unknown} value */
const number=value=>{const n=Number(value);return Number.isFinite(n)?n:0};
/** @param {unknown} value @param {number} fallback */
const positiveInt=(value,fallback)=>{const n=Math.round(number(value));return n>0?n:fallback};
export const PROGRAM_EDITOR_INTENTS = Object.freeze([
    "program_name", "day_name", "day_add", "exercise_field", "prescription",
    "exercise_add", "exercise_remove", "day_remove", "exercise_replace",
    "exercise_move", "slot_alternates", "metric_target", "metric_composition",
    "prescription_field", "load_step", "suggest_loads", "suggest_loads_rir", "execution_mode",
    "day_move", "save_draft", "apply", "apply_discard_workout",
  ]);

/** @param {{nextId:()=>string}} options */
export function createEditorDocumentRules({nextId:uid}) {
  /** @param {Partial<EditorDocument>} document */
  function metaDays(document) {
    const entries = document?.programMeta?.programStructure?.days;
    return Array.isArray(entries) ? entries : [];
  }
  /** @param {Partial<EditorDocument>} document */
  function labels(document) {
    const out = [], seen = new Set();
    for (const entry of metaDays(document)) {
      const label = String(entry?.label || entry?.dayId || "").trim();
      if (label && !seen.has(label)) { seen.add(label); out.push(label); }
    }
    for (const exercise of Array.isArray(document?.program) ? document.program : []) {
      const label = String(exercise?.day || "").trim();
      if (label && !seen.has(label)) { seen.add(label); out.push(label); }
    }
    return out;
  }
  /* Rest days live only in the definition. A day name is unique across every
     day, training and rest (#451), so the editor checks these too. */
  /** @param {Partial<EditorDocument>} document */
  function restDayNames(document) {
    return (definitionFor(/** @type {EditorDocument} */ (document))?.days || []).filter(day => day?.kind === "rest")
      .map(day => String(day?.name || "").trim()).filter(Boolean);
  }
  /** @template {Partial<EditorDocument>} T @param {T} document @param {string} day @returns {NonNullable<T['program']>} */
  function exercisesFor(document, day) {
    return /** @type {NonNullable<T['program']>} */ ((Array.isArray(document?.program) ? document.program : [])
      .filter(exercise => exercise?.day === day)
      .sort((a, b) => number(a.order) - number(b.order) || String(a.name || "").localeCompare(String(b.name || ""))));
  }
  /** @param {EditorDocument} document */
  function normalizeOrders(document) {
    const rows = Array.isArray(document.program) ? document.program : [];
    for (const day of labels(document)) exercisesFor({ program: rows }, day).forEach((exercise, index) => { exercise.order = index + 1; });
    return document;
  }
  /** @param {Partial<EditorDocument>} document @param {string} label */
  function structureFor(document, label) {
    return metaDays(document).find(entry => String(entry?.label || entry?.dayId || "") === label) || null;
  }
  /** @param {ProgramSlot|null|undefined} slot @param {number} cycleIndex */
  function definitionCycle(slot, cycleIndex) {
    return (slot?.prescriptionsByCycle || []).find(cycle => cycle?.cycleIndex === cycleIndex) || null;
  }
  /** @param {EditorDocument} document @param {string} slotId @param {number} cycleIndex @param {number} setIndex */
  function definitionSet(document, slotId, cycleIndex, setIndex) {
    const cycle = definitionCycle(definitionSlot(document, slotId), cycleIndex);
    return (cycle?.sets || []).find(set => set?.setIndex === setIndex) || null;
  }
  /** @param {EditorDocument} document @param {EditorRow} exercise @param {number} cycleIndex */
  function setCountFor(document, exercise, cycleIndex) {
    const slot = definitionSlot(document, exercise?.slotId || exercise?.id || '');
    const cycle = definitionCycle(slot, cycleIndex);
    return Array.isArray(cycle?.sets) ? cycle.sets.length : positiveInt(exercise?.sets, 1);
  }
  /** @param {ProgramSlot|null|undefined} slot */
  function editableMetricComposition(slot) {
    return !!slot && (slot.metricOrigin === "user_defined" || !slot.metricIds?.length);
  }
  /** @param {EditorDocument} document @param {EditorRow} exercise @param {string[]} metricIds @param {MetricDefinition[]} definitions @param {{preserveProvenance?:boolean,filterTargets?:boolean,projectRow?:boolean}} [options] */
  function replaceMetricComposition(document, exercise, metricIds, definitions, {preserveProvenance=true,filterTargets=true,projectRow=true}={}) {
    const slotId = exercise?.slotId || exercise?.id || '';
    const slot = definitionSlot(document, slotId);
    if (!slot || !editableMetricComposition(slot)) return false;
    const keepSemantics = new Set(definitions.map(definition => definition.semantic));
    slot.metricIds = clone(metricIds);
    slot.metricDefinitions = clone(definitions);
    slot.metricOrigin = String(slot.exerciseId || exercise.libraryId || "").startsWith("custom:") || metricIds.length
      ? "user_defined" : "source_catalog";
    // Schema v2: a set derives its metric composition from its slot rather
    // than storing it again, so only the slot above is rewritten here.
    for (const cycle of slot.prescriptionsByCycle || []) for (const set of cycle.sets || []) {
      if(filterTargets)set.targets = Object.fromEntries(Object.entries(set.targets || {}).filter(([semantic]) => keepSemantics.has(semantic)));
      set.status = metricIds.length ? "manual" : "configuration_required";
      set.provenance = { ...(preserveProvenance ? set.provenance : {}), source: "manual", policyVersion: "manual@1" };
    }
    const custom = (document.customExercises || []).find(entry => entry?.id === slot.exerciseId);
    if (custom) {
      custom.metricIds = clone(metricIds);
      custom.metricDefinitions = clone(definitions);
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row && projectRow) {
      row.metricIds = clone(metricIds);
      row.metricDefinitions = clone(definitions);
      row.metricOrigin = slot.metricOrigin;
      row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    }
    return true;
  }
  /** @param {EditorDocument} document @param {string} slotId @param {number} cycleIndex @param {number} setIndex @param {string} semantic @param {TargetEdit} after @param {{preserveProvenance?:boolean,projectRow?:boolean}} [options] */
  function replaceMetricTarget(document, slotId, cycleIndex, setIndex, semantic, after, {preserveProvenance=true,projectRow=true}={}) {
    const set = definitionSet(document, slotId, cycleIndex, setIndex);
    if (!set) return false;
    const keepsAdaptive=set.status === "ready" && REP_TARGET_SEMANTICS.has(semantic);
    if(keepsAdaptive&&!(after.present&&repRange(after.value)))return false;
    const targets = { ...(set.targets || {}) };
    if (after.present) targets[semantic] = clone(after.value);
    else delete targets[semantic];
    set.targets = targets;
    // Plan 069 D3: the rep range is an input of the suggestion, so editing it
    // keeps an adaptive set adaptive. Any other target is the lifter's own.
    if (!keepsAdaptive) {
      set.status = "manual";
      set.provenance = { ...(preserveProvenance ? set.provenance : {}), source: "manual", policyVersion: "manual@1" };
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    const slot = definitionSlot(document, slotId);
    if (projectRow && row && slot) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    return true;
  }

  /** Prepare metric receipts from the captured slot, without changing the input.
   * @template {EditorDocument} T
   * @param {T} input
   * @param {{slotId:string,cycleIndex:number,setIndex:number,metricId:string,semantic:string,after:TargetEdit}} request */
  function editMetricTarget(input,{slotId,cycleIndex,setIndex,metricId,semantic,after}) {
    const slot=definitionSlot(input,slotId),set=definitionSet(input,slotId,cycleIndex,setIndex);
    if(!slot||!set||!slot.metricDefinitions?.some(metric=>metric.id===metricId&&metric.semantic===semantic))return {ok:false};
    /** @type {TargetEdit} */
    const before=Object.hasOwn(set.targets||{},semantic)?{present:true,value:clone(set.targets[semantic])}:{present:false,value:null};
    const next=clone(input);
    if(!replaceMetricTarget(next,slotId,cycleIndex,setIndex,semantic,after))return {ok:false};
    if(canonical(before)===canonical(after))return {ok:true,unchanged:true};
    return {ok:true,document:next,edit:{kind:"metric_target",slotId,cycleIndex,setIndex,metricId,semantic,
      metricIds:clone(slot.metricIds||[]),metricDefinitions:clone(slot.metricDefinitions||[]),before,after:clone(after)}};
  }
  /** Composition identity validation belongs to the supplied metric/catalog owner.
   * Canonical replay additionally seeds missing ranges and consumes pending opt-in.
   * @template {EditorDocument} T
   * @param {T} input
   * @param {{slotId:string,metricIds:string[],metricDefinitions:MetricDefinition[]}} request */
  function editMetricComposition(input,{slotId,metricIds,metricDefinitions}) {
    const slot=definitionSlot(input,slotId);
    if(!slot||!editableMetricComposition(slot))return {ok:false};
    const beforeMetricIds=clone(slot.metricIds||[]),beforeMetricDefinitions=clone(slot.metricDefinitions||[]);
    if(canonical(beforeMetricIds)===canonical(metricIds)&&canonical(beforeMetricDefinitions)===canonical(metricDefinitions))return {ok:true,unchanged:true};
    const next=clone(input),row=next.program.find(item=>(item.slotId||item.id)===slotId);
    if(!row||!replaceMetricComposition(next,row,metricIds,metricDefinitions))return {ok:false};
    return {ok:true,document:next,edit:{kind:"metric_composition",slotId,beforeMetricIds,beforeMetricDefinitions,
      metricIds:clone(metricIds),metricDefinitions:clone(metricDefinitions)}};
  }
  /** @template {EditorDocument} T
   * @param {T} input @param {{slotId:string,after:number|null}} request */
  function editSuggestLoadsRir(input,{slotId,after}) {
    const slot=definitionSlot(input,slotId);
    if(!slot)return {ok:false};
    const before=slotSets(slot).map(set=>set.rir??null),next=clone(input);
    if(!setSlotRir(next,slotId,after))return {ok:false};
    if(before.every(value=>Object.is(value,after)))return {ok:true,unchanged:true};
    return {ok:true,document:next,edit:{kind:"suggest_loads_rir",slotId,before,after}};
  }

  /** Apply to an owned document only after all policy and replay checks pass.
   * @param {EditorDocument} document
   * @param {Extract<import('./editor-contracts.js').InstalledIntent,{kind:'prescription_field'}>} edit
   * Speculative edits retain captured provenance annotations; canonical replay
   * replaces manual provenance, as it did before sharing this policy.
   * @param {{preserveProvenance?:boolean}} [options] */
  function applyPrescriptionField(document, edit, {preserveProvenance=false}={}) {
    const {slotId,cycleIndex,setIndex,field,before,after}=edit;
    const slot=definitionSlot(document,slotId);
    const set=definitionSet(document,slotId,cycleIndex,setIndex);
    if(!slot||!set||(field!=="rir"&&field!=="restSeconds"))return false;
    const current=set[field]??null;
    if(current!==before&&current!==after)return false;
    if(after!==null&&(typeof after!=="number"||!Number.isFinite(after)||after<0||
      (field==="rir"?after>6:!Number.isSafeInteger(after)||after>86400)))return false;
    const keepsAdaptive=field==="rir"&&set.status==="ready";
    if(keepsAdaptive&&after===null)return false;
    set[field]=after;
    if(!keepsAdaptive){
      set.status="manual";
      set.provenance={...(preserveProvenance?set.provenance:{}),source:"manual",policyVersion:"manual@1"};
    }
    const row=(document.program||[]).find(candidate=>(candidate.slotId||candidate.id)===slotId);
    if(row)row.prescriptionsByCycle=clone(slot.prescriptionsByCycle||[]);
    return true;
  }
  /** Prepare a speculative receipt without changing the acknowledged input.
   * @template {EditorDocument} T
   * @param {T} input
   * @param {{slotId:string,cycleIndex:number,setIndex:number,field:string,after:number|null}} request */
  function editPrescriptionField(input,{slotId,cycleIndex,setIndex,field,after}) {
    if(field!=="rir"&&field!=="restSeconds")return {ok:false};
    const set=definitionSet(input,slotId,cycleIndex,setIndex);
    if(!set)return {ok:false};
    const before=set[field]??null;
    const edit=/** @type {const} */({kind:"prescription_field",slotId,cycleIndex,setIndex,field,before,after});
    const next=clone(input);
    if(!applyPrescriptionField(next,edit,{preserveProvenance:true}))return {ok:false};
    if(Object.is(before,after))return {ok:true,unchanged:true};
    return {ok:true,document:next,edit};
  }

  /** @param {ProgramSlot|null|undefined} slot */
  function slotLoadMetric(slot) {
    return (slot?.metricDefinitions || []).find(metric =>
      ["loadKg", "assistanceKg", "loadPerSideKg", "persistentLoadPerSideKg"].includes(metric.semantic)) || null;
  }
  /** Movement-wide overrides intentionally replay without a before-value guard.
   * Canonical replay also supports a movement not present in the current slots.
   * @param {EditorDocument} document
   * @param {Extract<import('./editor-contracts.js').InstalledIntent,{kind:'load_step'}>} edit */
  function applyLoadStep(document, edit) {
    const exerciseId=String(edit.exerciseId||""),after=edit.after;
    if(!exerciseId||(after!==null&&!(Number.isFinite(after)&&after>0&&after<=100)))return false;
    document.programMeta=document.programMeta||{};
    const byExerciseId={...(document.programMeta.loadingConfiguration?.byExerciseId||{})};
    if(after===null)delete byExerciseId[exerciseId];else byExerciseId[exerciseId]={loadStepKg:after};
    document.programMeta.loadingConfiguration={...(document.programMeta.loadingConfiguration||{}),byExerciseId};
    return true;
  }
  /** @template {EditorDocument} T
   * @param {T} input @param {{slotId:string,after:number|null}} request */
  function editLoadStep(input,{slotId,after}) {
    const slot=definitionSlot(input,slotId);
    if(!slot||!slotLoadMetric(slot))return {ok:false};
    const before=input.programMeta?.loadingConfiguration?.byExerciseId?.[slot.exerciseId]?.loadStepKg??null;
    const edit=/** @type {const} */({kind:"load_step",exerciseId:slot.exerciseId,before,after});
    const next=clone(input);
    if(!applyLoadStep(next,edit))return {ok:false};
    if(Object.is(before,after))return {ok:true,unchanged:true};
    return {ok:true,document:next,edit};
  }
  /** Canonical callers separately enforce catalog eligibility before applying.
   * @param {EditorDocument} document
   * @param {Extract<import('./editor-contracts.js').InstalledIntent,{kind:'execution_mode'}>} edit */
  function applyExecutionMode(document,edit) {
    const slot=definitionSlot(document,edit.slotId);
    if(!slot||(edit.after!=="bilateral"&&edit.after!=="unilateral"))return false;
    const current=slot.executionMode==="bilateral"||slot.executionMode==="unilateral"?slot.executionMode:null;
    if(current!==(edit.before??null)&&current!==edit.after)return false;
    slot.executionMode=edit.after;
    return true;
  }
  /** @template {EditorDocument} T
   * @param {T} input @param {{slotId:string,after:string}} request */
  function editExecutionMode(input,{slotId,after}) {
    const slot=definitionSlot(input,slotId);
    if(!slot)return {ok:false};
    const before=slot.executionMode==="bilateral"||slot.executionMode==="unilateral"?slot.executionMode:null;
    const edit=/** @type {const} */({kind:"execution_mode",slotId,before,after});
    const next=clone(input);
    if(!applyExecutionMode(next,edit))return {ok:false};
    if(before===after)return {ok:true,unchanged:true};
    return {ok:true,document:next,edit};
  }

  /** @template {EditorDocument} T @param {T} input @param {string} value */
  function editProgramName(input,value) {
    const before=input.programMeta?.name||"",after=String(value||"").trim();
    if(before===after)return {ok:true,unchanged:true};
    const next=clone(input);next.programMeta={...(next.programMeta||{}),name:after};
    return {ok:true,document:next,edit:{kind:"program_name",before,after}};
  }
  /** @template {EditorDocument} T @param {T} input @param {string} id */
  function editRemoveExercise(input,id) {
    const exercise=input.program?.find(item=>item.id===id);
    if(!exercise)return {ok:false};
    const next=clone(input);next.program=next.program.filter(item=>item.id!==id);normalizeOrders(next);
    return {ok:true,document:next,edit:{kind:"exercise_remove",targetId:id,sourceDay:exercise.day}};
  }
  /** Attach a picker-owned custom definition only to the speculative copy.
   * Canonical replay still owns custom-definition conflict and catalog checks.
   * @template {EditorDocument} T @param {T} input
   * @param {{id:string,entry:LibraryEntry,customExercise?:LibraryEntry|null}} request */
  function editReplaceExercise(input,{id,entry,customExercise=null}) {
    const current=input.program?.find(item=>item.id===id);
    if(!current||!entry||(customExercise&&customExercise.id!==entry.id))return {ok:false};
    const next=clone(input);
    if(customExercise&&!next.customExercises?.some(item=>item.id===customExercise.id))
      next.customExercises=(next.customExercises||[]).concat(clone(customExercise));
    if(!replaceExercise(next,id,entry))return {ok:false};
    return {ok:true,document:next,edit:{kind:"exercise_replace",targetId:id,beforeLibraryId:current.libraryId,
      afterLibraryId:entry.id,exercise:clone(next.program.find(item=>item.id===id)),...(customExercise?{customExercise:clone(customExercise)}:{})}};
  }
  /** Shared list policy; canonical replay additionally resolves catalog identity.
   * @param {EditorDocument} document
   * @param {Extract<import('./editor-contracts.js').InstalledIntent,{kind:'slot_alternates'}>} edit */
  function applyAlternates(document,edit) {
    const slot=definitionSlot(document,edit.slotId);
    if(!slot||!Array.isArray(edit.before)||!Array.isArray(edit.after))return false;
    const current=slot.alternates||[],after=edit.after;
    if(canonical(current)!==canonical(edit.before)&&canonical(current)!==canonical(after))return false;
    if(after.length>MAX_SLOT_ALTERNATES||new Set(after).size!==after.length||
      after.some(id=>typeof id!=="string"||!id||id===slot.exerciseId))return false;
    if(after.length)slot.alternates=clone(after);else delete slot.alternates;
    return true;
  }
  /** @template {EditorDocument} T @param {T} input @param {{id:string,after:string[]}} request */
  function editAlternates(input,{id,after}) {
    const row=input.program?.find(item=>item.id===id),slotId=row?.slotId||row?.id||"";
    const slot=definitionSlot(input,slotId);
    if(!slot)return {ok:false};
    const before=clone(slot.alternates||[]),edit=/** @type {const} */({kind:"slot_alternates",targetId:id,slotId,before,after:clone(after)});
    const next=clone(input);
    if(!applyAlternates(next,edit))return {ok:false};
    if(canonical(before)===canonical(after))return {ok:true,unchanged:true};
    return {ok:true,document:next,edit};
  }

  /** @param {EditorDocument} document */
  function ensureStructure(document) {
    if (!document.programMeta || typeof document.programMeta !== "object") document.programMeta = {};
    const current = metaDays(document);
    if (!current.length) {
      document.programMeta.programStructure = {
        ...(document.programMeta.programStructure || {}),
        days: labels(document).map((label, index) => ({ dayId: `manual_d${index + 1}`, label, order: index + 1 })),
      };
    }
    return document;
  }
  /** @param {EditorDocument} document @param {string} oldLabel @param {string} nextLabel */
  function setDayLabel(document, oldLabel, nextLabel) {
    const value = String(nextLabel || "").trim();
    if (!value || value === oldLabel || labels(document).includes(value) || restDayNames(document).includes(value)) return false;
    for (const exercise of document.program || []) if (exercise.day === oldLabel) exercise.day = value;
    const structure = metaDays(document);
    const entry = structure.find(item => String(item?.label || item?.dayId || "") === oldLabel);
    if (entry) {
      entry.label = value;
      entry.nameOverride = value;
    } else {
      document.programMeta.programStructure = {
        ...(document.programMeta.programStructure || {}),
        days: structure.concat({ dayId: `manual_d${structure.length + 1}`, label: value, order: structure.length + 1 }),
      };
    }
    normalizeOrders(document);
    return true;
  }
  /** @param {EditorDocument} document */
  function appendDay(document) {
    const current = labels(document), taken = new Set([...current, ...restDayNames(document)]);
    let n = current.length + 1, label = `Day ${n}`;
    while (taken.has(label)) label = `Day ${++n}`;
    const structure = metaDays(document).slice();
    structure.push({ dayId: `manual_d${structure.length + 1}`, label, order: structure.length + 1 });
    document.programMeta.programStructure = { ...(document.programMeta.programStructure || {}), days: structure };
    return label;
  }
  /* Plan 074 S2: the training days' order is programStructure's order. A move
     reorders that list; the host puts the definition's days in the same order. */
  /** @param {EditorDocument} document @param {string} day @param {number} toIndex */
  function moveDayInDocument(document, day, toIndex) {
    const structure = metaDays(document).slice();
    const from = structure.findIndex(entry => String(entry?.label || entry?.dayId || "") === day);
    if (from < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= structure.length || toIndex === from) return null;
    const before = structure.map(entry => String(entry?.label || entry?.dayId || ""));
    const [moved] = structure.splice(from, 1);
    structure.splice(toIndex, 0, moved);
    document.programMeta.programStructure = {
      ...(document.programMeta.programStructure || {}),
      days: structure.map((entry, index) => ({ ...entry, order: index + 1 })),
    };
    return { before, after: structure.map(entry => String(entry?.label || entry?.dayId || "")), fromIndex: from, toIndex };
  }
  /** @param {EditorDocument} document @param {string} day */
  function removeDayFromDocument(document, day) {
    document.program = (document.program || []).filter(exercise => exercise.day !== day);
    const structure = metaDays(document).filter(entry => String(entry?.label || entry?.dayId || "") !== day);
    document.programMeta.programStructure = structure.length
      ? { ...(document.programMeta.programStructure || {}), days: structure }
      : null;
    normalizeOrders(document);
  }
  /** @param {EditorRow} exercise @param {string} field @param {unknown} value */
  function fieldValue(exercise, field, value) {
    if (field === "sets") return Math.max(1, Math.min(100, positiveInt(value, positiveInt(exercise.sets, 1))));
    if (field === "min") return positiveInt(value, positiveInt(exercise.min, 1));
    if (field === "max") return positiveInt(value, positiveInt(exercise.max, 1));
    return String(value ?? "").trim();
  }
  /** @param {LibraryEntry} entry @param {string} day @param {number} order */
  function entryFields(entry, day, order) {
    return {
      id: uid(), day, order, name: String(entry?.name || entry?.namePt || "Exercise"),
      sets: positiveInt(entry?.sets, 3), min: positiveInt(entry?.min, 6), max: positiveInt(entry?.max, 10),
      primary: String(entry?.primary || ""), secondary: String(entry?.secondary || ""), notes: String(entry?.notes || ""),
      ...(entry?.id ? { libraryId: String(entry.id), movementId: `library:${String(entry.id)}` } : {}),
    };
  }
  /** @param {EditorDocument} document @param {string} day @param {LibraryEntry} entry */
  function addExercise(document, day, entry) {
    const list = exercisesFor(document, day), exercise = entryFields(entry, day, list.length + 1);
    document.program = (document.program || []).concat(exercise);
    return exercise;
  }
  /** @param {EditorDocument} document @param {string} id @param {LibraryEntry} entry */
  function replaceExercise(document, id, entry) {
    const exercise = (document.program || []).find(item => item.id === id);
    if (!exercise || !entry) return false;
    const old = { id: exercise.id, day: exercise.day||'', order: exercise.order||1, notes: exercise.notes };
    const replacement = entryFields(entry, old.day, old.order);
    // A replacement repoints the slot's movement identity but keeps its
    // authored prescription and notes. Leaving the old movementId behind
    // would make a paired-exposure relation look valid after a swap.
    delete exercise.libraryId; delete exercise.movementId; delete exercise.displayName;
    Object.assign(exercise, {
      name: replacement.name, primary: replacement.primary, secondary: replacement.secondary,
      ...(replacement.libraryId ? { libraryId: replacement.libraryId, movementId: replacement.movementId } : {}),
      notes: old.notes,
    });
    return true;
  }
  /** @param {EditorDocument} document @param {string} id @param {string} toDay @param {number} toIndex */
  function reorder(document, id, toDay, toIndex) {
    const rows = document.program || [], exercise = rows.find(item => item.id === id);
    if (!exercise || !labels(document).includes(toDay)) return false;
    const sourceDay = exercise.day||'', source = exercisesFor(document, sourceDay), sourceIndex = source.findIndex(item => item.id === id);
    if (sourceIndex < 0) return false;
    const destination = exercisesFor(document, toDay).filter(item => item.id !== id);
    const at = Math.max(0, Math.min(Number.isInteger(toIndex) ? toIndex : destination.length, destination.length));
    exercise.day = toDay;
    destination.splice(at, 0, exercise);
    for (const item of rows) if (item.id !== id && item.day === sourceDay && !destination.includes(item)) item.order = 0;
    destination.forEach((item, index) => { item.day = toDay; item.order = index + 1; });
    normalizeOrders(document);
    return sourceDay !== toDay || sourceIndex !== at;
  }

  /** @param {EditorDocument} document */
  function validation(document) {
    const issues = [];
    for (const day of labels(document)) {
      const list = exercisesFor(document, day);
      if (!list.length) issues.push(`day_empty:${day}`);
      for (const exercise of list) {
        if (!exercise.id) issues.push("exercise_invalid:id");
        if (!String(exercise.name || "").trim()) issues.push(`exercise_invalid:${exercise.id}:name`);
        const sets = number(exercise.sets), min = number(exercise.min), max = number(exercise.max);
        // A metric composition without repetitions (duration, distance, or a
        // custom movement not yet configured) carries no rep range to check.
        const reps = exercise.hasRepTarget !== false;
        if (!(sets > 0) || reps && (!(min > 0) || !(max >= min))) issues.push(`exercise_invalid:${exercise.id}:prescription`);
      }
    }
    return issues;
  }


  /** @template {EditorDocument} T
   * @param {T} input @param {{id:string,field:string,value:unknown,cycleIndex:number}} request */
  function editExerciseField(input,{id,field,value,cycleIndex}){
      const next = clone(input), exercise = next.program?.find(item => item.id === id);
      if (!exercise) return {ok:false};
      if(field!=='sets'&&field!=='min'&&field!=='max'&&field!=='name'&&field!=='primary'&&field!=='secondary'&&field!=='notes')return{ok:false};
      const requestedIndex = Number(cycleIndex);
      const activeCycle = Number.isInteger(requestedIndex) && requestedIndex > 0 ? requestedIndex : 1;
      const slot = field === "sets" ? definitionSlot(next, exercise.slotId || exercise.id || '') : null;
      const cycle = slot ? definitionCycle(slot, activeCycle) : null;
      const previous = field === "sets" && cycle ? cycle.sets.length : exercise[field];
      const normalized = fieldValue(exercise, field, value);
      if (Object.is(previous, normalized)) return {ok:true,unchanged:true};
      if (field === "sets" && cycle && slot && typeof normalized==='number') {
        const beforeSetIds = cycle.sets.map(set => set.id);
        /** @type {import('./editor-contracts.js').ProgramSet[]} */
        const addedSets=[];
        /** @type {string[]} */
        const removedSetIds=[];
        // A set added to an adaptive slot joins it (Plan 069 D3): the opt-in
        // covers every set, so the new one takes the slot's RIR and status.
        const adaptive = slotAdaptive(slot);
        while (cycle.sets.length < normalized) {
          const source = cycle.sets.at(-1);
          if (!source) return {ok:false};
          /** @type {import('./editor-contracts.js').ProgramSet} */
          const added = adaptive
            ? { ...clone(source), id: uid(), cycleIndex:activeCycle, setIndex: cycle.sets.length + 1 }
            : { ...clone(source), id: uid(), cycleIndex:activeCycle, setIndex: cycle.sets.length + 1,
              rir: null, status: slot.metricIds?.length ? "manual" : "configuration_required",
              provenance: { source: "manual", policyVersion: "manual@1" } };
          cycle.sets.push(added);
          addedSets.push(clone(added));
        }
        while (cycle.sets.length > normalized) removedSetIds.push(cycle.sets.pop()?.id||'');
        cycle.sets.forEach((set, index) => { set.setIndex = index + 1; });
        exercise.sets = normalized;
        exercise.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
        return {ok:true,document:next,edit:{ kind: "prescription", targetId: id, field: "sets", before: previous, after: normalized,
          cycleIndex:activeCycle, beforeSetIds, addedSets, removedSetIds }};
      }
      if(field==='sets'||field==='min'||field==='max'){
        const n=number(normalized);
        if(field==='min'&&n>number(exercise.max))exercise.max=n;
        if(field==='max'&&n<number(exercise.min))exercise.min=n;
        exercise[field]=n;
      }else exercise[field]=String(normalized);
      // Linked movements keep their stable library identity while allowing a
      // program-specific display alias. The persisted model resolves `name`
      // from `displayName`, so carry the alias explicitly in the complete
      // document sent to the host.
      if (field === "name" && exercise.libraryId) {
        if (normalized) exercise.displayName = String(normalized);
        else delete exercise.displayName;
      }
      return {ok:true,document:next,edit:{ kind: field === "sets" || field === "min" || field === "max" ? "prescription" : "exercise_field", targetId: id, field, before: previous, after: normalized }};

  }

return Object.freeze({editProgramName,editRemoveExercise,editReplaceExercise,editAlternates,applyAlternates,editMetricTarget,editMetricComposition,editSuggestLoadsRir,slotLoadMetric,editLoadStep,applyLoadStep,editExecutionMode,applyExecutionMode,editPrescriptionField,applyPrescriptionField,editExerciseField,metaDays,labels,exercisesFor,normalizeOrders,structureFor,definitionCycle,definitionSet,setCountFor,editableMetricComposition,replaceMetricComposition,replaceMetricTarget,ensureStructure,setDayLabel,appendDay,removeDayFromDocument,moveDayInDocument,restDayNames,fieldValue,entryFields,addExercise,replaceExercise,reorder,validation});
}

/** The definition's days with its training days in `after`'s order, each in a position a training day
    already holds; rest days stay put and every day is renumbered. Null unless `after` names each
    training day exactly once.
    @param {import('./editor-contracts.js').ProgramDefinition|null|undefined} definition @param {unknown} after */
export function reorderTrainingDays(definition, after) {
  const days = Array.isArray(definition?.days) ? definition.days : [];
  const training = days.filter(day => day?.kind === "training");
  if (!Array.isArray(after) || after.length !== training.length) return null;
  const wanted = after.map(String), byName = new Map(training.map(day => [String(day.name), day]));
  if (byName.size !== training.length || new Set(wanted).size !== wanted.length || wanted.some(name => !byName.has(name))) return null;
  let next = 0;
  return days.map(day => (day?.kind === "training" ? byName.get(wanted[next++]) || day : day)).map((day, index) => ({ ...day, order: index + 1 }));
}
/** Why a day_move made against `edit.before` cannot apply over the training days now named `current`.
    @param {unknown} current @param {{before?:unknown,after?:unknown}|null|undefined} edit */
export function dayOrderConflict(current, edit) {
  const now = (Array.isArray(current) ? current : []).map(String);
  const before = Array.isArray(edit?.before) ? edit.before.map(String) : null, after = Array.isArray(edit?.after) ? edit.after.map(String) : null;
  if (!before || !after || JSON.stringify(before) !== JSON.stringify(now)) return "day_order_changed";
  if (after.length !== now.length || new Set(after).size !== after.length || after.some(name => !now.includes(name))) return "invalid_day_order";
  return null;
}
