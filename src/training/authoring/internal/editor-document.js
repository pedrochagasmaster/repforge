/** @typedef {import('./editor-contracts.js').EditorDocument} EditorDocument
 * @typedef {import('./editor-contracts.js').EditorRow} EditorRow
 * @typedef {import('./editor-contracts.js').ProgramSlot} ProgramSlot
 * @typedef {import('./editor-contracts.js').MetricDefinition} MetricDefinition
 * @typedef {import('./editor-contracts.js').TargetEdit} TargetEdit
 * @typedef {import('../../model/internal/contracts.js').LibraryEntry & {sets?:number,min?:number,max?:number}} LibraryEntry
 */
/** Speculative program editor documents. Mutations touch only the caller's cloned
 * document; installed/setup application commands own validation and publication. */
import {cloneSnapshot as clone} from '../../model.js';
import {definitionFor,definitionSlot,slotAdaptive} from './suggestion.js';
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
    "save_draft", "apply", "apply_discard_workout",
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
  /** @param {EditorDocument} document @param {EditorRow} exercise @param {string[]} metricIds @param {MetricDefinition[]} definitions */
  function replaceMetricComposition(document, exercise, metricIds, definitions) {
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
      set.targets = Object.fromEntries(Object.entries(set.targets || {}).filter(([semantic]) => keepSemantics.has(semantic)));
      set.status = metricIds.length ? "manual" : "configuration_required";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    }
    const custom = (document.customExercises || []).find(entry => entry?.id === slot.exerciseId);
    if (custom) {
      custom.metricIds = clone(metricIds);
      custom.metricDefinitions = clone(definitions);
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row) {
      row.metricIds = clone(metricIds);
      row.metricDefinitions = clone(definitions);
      row.metricOrigin = slot.metricOrigin;
      row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    }
    return true;
  }
  /** @param {EditorDocument} document @param {string} slotId @param {number} cycleIndex @param {number} setIndex @param {string} semantic @param {TargetEdit} after */
  function replaceMetricTarget(document, slotId, cycleIndex, setIndex, semantic, after) {
    const set = definitionSet(document, slotId, cycleIndex, setIndex);
    if (!set) return false;
    const targets = { ...(set.targets || {}) };
    if (after.present) targets[semantic] = clone(after.value);
    else delete targets[semantic];
    set.targets = targets;
    // Plan 069 D3: the rep range is an input of the suggestion, so editing it
    // keeps an adaptive set adaptive. Any other target is the lifter's own.
    if (!(set.status === "ready" && REP_TARGET_SEMANTICS.has(semantic))) {
      set.status = "manual";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    const slot = definitionSlot(document, slotId);
    if (row && slot) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    return true;
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
    if (!value || value === oldLabel || labels(document).includes(value)) return false;
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
    const current = labels(document);
    let n = current.length + 1, label = `Day ${n}`;
    while (current.includes(label)) label = `Day ${++n}`;
    const structure = metaDays(document).slice();
    structure.push({ dayId: `manual_d${structure.length + 1}`, label, order: structure.length + 1 });
    document.programMeta.programStructure = { ...(document.programMeta.programStructure || {}), days: structure };
    return label;
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

return Object.freeze({slotLoadMetric,editLoadStep,applyLoadStep,editExecutionMode,applyExecutionMode,editPrescriptionField,applyPrescriptionField,editExerciseField,metaDays,labels,exercisesFor,normalizeOrders,structureFor,definitionCycle,definitionSet,setCountFor,editableMetricComposition,replaceMetricComposition,replaceMetricTarget,ensureStructure,setDayLabel,appendDay,removeDayFromDocument,fieldValue,entryFields,addExercise,replaceExercise,reorder,validation});
}
