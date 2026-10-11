/* The real Plan 067 engine in a worker. programRequestFromAnswers builds the
   request; the few inputs the adapter does not take yet (the two new gym presets,
   Plan 068's equipment groups, block length and rep pattern, deload, movement
   confirmations) are applied here, prototype-only, exactly as Plan 068 and the
   README describe them. */
const ROOT = "../../../../";
importScripts(ROOT + "exercise-metrics.js", ROOT + "program-compiler.js", ROOT + "program-entry-adapter.js");
const C = self.RepForgeProgramCompiler;
const A = self.RepForgeProgramEntryAdapter;

let catalog = null;
const ready = fetch(ROOT + "assets/exercise-catalog.json").then((r) => r.json()).then((json) => { catalog = json; prepare(); });

const PRESET = {
  everything: { kind: "commercial_gym", flag: null },
  commercial: { kind: "commercial_gym", flag: "commercialGym" },
  warehouse: { kind: "commercial_gym", flag: "warehouseGym" },
  local: { kind: "basic_gym", flag: "localGym" },
  garage: { kind: "full_home", flag: "garageGym" },
  home: { kind: "limited_home", flag: "homeGym" },
};
// Plan 068 slice A groups, matched to catalog equipment by name, then used by UUID.
const GROUPS = {
  barbell: /^(barbell|weight plates?|bumper plates?)$/i,
  rack: /^(power rack|squat stands?)$/i,
  bench: /^(adjustable bench|flat bench)$/i,
  dumbbells: /^dumbbells?$/i,
  kettlebells: /^kettlebells?$/i,
  pullup_bar: /pull-up bar/i,
  dip_bars: /^dip bars?$/i,
  cable: /^(pin-loaded single cable machine|pin-loaded cable crossover|cuff cable attachments?|v-bar row grip attachment)$/i,
  smith: /^smith machine$/i,
  ez_bar: /^ez bar$/i,
  leg_press: /^(45° leg press|pin-loaded leg press|hack squat)$/i,
  bands: /(resistance bands?|band anchor)/i,
  suspension: /(suspension trainer|gymnastics rings?)/i,
};
const PURPOSE_JOB = {
  vertical_pull: ["vertical pull", "puxada vertical"], horizontal_pull: ["horizontal pull", "remada"],
  horizontal_push: ["horizontal press", "empurrar na horizontal"], vertical_push: ["overhead press", "desenvolvimento"],
  squat: ["squat", "agachamento"], hinge: ["hip hinge", "dobradiça de quadril"], knee: ["knee extension", "extensão de joelho"],
};
let equipment = [], members = {}, gated = {}, names = {};
let state = null; // { def: recommended definition, working: edited copy, undo: [snapshots] }
const clone = (x) => JSON.parse(JSON.stringify(x));
// Ids for lifter-made slots and sets are counted from each generation, so replaying
// the same edits after a reload reproduces the same identities.
let pid = 0;
const nextId = (kind) => `${kind}-p${(++pid).toString(36)}`;

function prepare() {
  const idx = catalog.uuidIndex;
  equipment = Object.keys(idx).filter((id) => idx[id].type === "equipment").sort();
  for (const [group, re] of Object.entries(GROUPS)) members[group] = equipment.filter((id) => re.test(idx[id].name));
  for (const e of catalog.exercises) if (Array.isArray(e.preconditions) && e.preconditions.length) gated[e.id] = e.preconditions;
  for (const id of Object.keys(idx)) if (idx[id].type === "featureMuscleGroup") names[id] = idx[id].name;
}

function presetIds(preset) {
  const p = PRESET[preset] || PRESET.commercial;
  const idx = catalog.uuidIndex;
  return p.flag ? equipment.filter((id) => idx[id][p.flag] === 1) : equipment.slice();
}
function groupsFor(preset) {
  const ids = new Set(presetIds(preset));
  return Object.fromEntries(Object.keys(GROUPS).map((g) => [g, members[g].some((id) => ids.has(id))]));
}

function request(a) {
  const base = A.programRequestFromAnswers({
    desiredResult: a.goal, structuredExperience: a.experience, daysPerWeek: a.days,
    environment: { kind: (PRESET[a.gym] || PRESET.commercial).kind }, sessionMinutes: a.minutes,
    competencyAnswers: a.competency || {}, primaryMuscles: a.emphasis || [], deEmphasizedMuscles: a.deemphasis || [],
  }, catalog);
  if (!base.ok) return base;
  const req = base.value;
  const ids = new Set(presetIds(a.gym));
  for (const g of a.equipAdd || []) for (const id of members[g] || []) ids.add(id);
  for (const g of a.equipRemove || []) for (const id of members[g] || []) ids.delete(id);
  req.gymProfile = { equipmentIds: [...ids].sort() };
  req.cycles = a.weeks || 7;
  req.periodization = a.pattern || "static";
  req.deloadCycles = a.deload === false ? [] : [req.cycles];
  req.movementConfirmations = a.confirmations || {};
  return { ok: true, value: req };
}

function summarize(def) {
  return def.days.map((d) => ({
    id: d.id, name: d.name, kind: d.kind, minutes: Math.round(C.estimateDaySeconds(d, 1) / 60),
    slots: (d.slots || []).map((s) => ({
      slotId: s.id, id: s.exerciseId, purpose: s.purposeId, role: s.role, alternates: s.alternates || [],
      rest: s.prescriptionsByCycle[0].sets[0]?.restSeconds || 0,
      sets: s.prescriptionsByCycle[0].sets.map((x) => {
        const t = x.targets.reps || x.targets.repsPerSide || x.targets.durationSeconds || {};
        return { min: t.min, max: t.max, side: !!x.targets.repsPerSide, secs: !!x.targets.durationSeconds, rir: x.rir };
      }),
      deloadSets: s.prescriptionsByCycle[s.prescriptionsByCycle.length - 1].sets.length,
      muscles: (s.musclePurposeIds || []).map((id) => names[id]).filter(Boolean),
    })),
  }));
}

function jobName(purposeId) {
  const key = Object.keys(PURPOSE_JOB).find((k) => purposeId.includes(k));
  return key ? PURPOSE_JOB[key] : [purposeId.replace(/_/g, " "), purposeId.replace(/_/g, " ")];
}

function generate(a) {
  const r = request(a);
  if (!r.ok) return { ok: false, conflicts: r.conflicts.map((c) => ({ code: c.code })) };
  const t0 = Date.now();
  const g = C.generateProgram(r.value, catalog, 1);
  if (!g.ok) {
    return { ok: false, conflicts: (g.conflicts || []).map((c) => ({ code: c.code, job: c.purposeId ? jobName(c.purposeId) : null })) };
  }
  const days = summarize(g.value);
  // Plan 068 slice C offers: confirm every gated movement once, keep each slot
  // that changed to a gated movement, then verify that movement alone, same seed.
  const offers = [];
  const confirmed = r.value.movementConfirmations;
  const all = { ...gated, ...confirmed };
  const wide = C.generateProgram({ ...r.value, movementConfirmations: all }, catalog, 1);
  if (wide.ok) {
    wide.value.days.forEach((d, i) => d.slots.forEach((s, j) => {
      const cur = g.value.days[i].slots[j];
      if (!cur || cur.exerciseId === s.exerciseId || !gated[s.exerciseId] || confirmed[s.exerciseId]) return;
      const one = C.generateProgram({ ...r.value, movementConfirmations: { ...confirmed, [s.exerciseId]: gated[s.exerciseId] } }, catalog, 1);
      if (one.ok && one.value.days[i].slots[j].exerciseId === s.exerciseId) {
        offers.push({ day: i, slot: j, from: cur.exerciseId, to: s.exerciseId, prerequisites: gated[s.exerciseId] });
      }
    }));
  }
  state = { def: g.value, working: clone(g.value), undo: [] };
  pid = 0;
  const confirmedSlots = [];
  g.value.days.forEach((d, i) => d.slots.forEach((s, j) => { if (confirmed[s.exerciseId]) confirmedSlots.push({ day: i, slot: j, id: s.exerciseId }); }));
  return { ok: true, days, offers, confirmedSlots, ms: Date.now() - t0, cycles: r.value.cycles, deload: r.value.deloadCycles };
}

// ---------- editing the recommended definition ----------
function slotOf(def, slotId) {
  for (const [di, d] of def.days.entries()) { const i = (d.slots || []).findIndex((s) => s.id === slotId); if (i >= 0) return { day: d, di, i, slot: d.slots[i] }; }
  return null;
}
const isDeload = (cycle) => cycle.sets.some((x) => x.provenance?.deload);
function newSet(from, cycleIndex, setIndex) {
  const s = clone(from); s.id = nextId("set"); s.cycleIndex = cycleIndex; s.setIndex = setIndex;
  s.provenance = { ...(s.provenance || {}), source: "lifter_edit" }; return s;
}
function setCount(slot, n) {
  n = Math.max(1, Math.min(8, n));
  for (const c of slot.prescriptionsByCycle) {
    const want = isDeload(c) ? Math.max(1, n - 1) : n;
    while (c.sets.length > want) c.sets.pop();
    while (c.sets.length < want) c.sets.push(newSet(c.sets[c.sets.length - 1], c.cycleIndex, c.sets.length + 1));
  }
}
function shiftReps(slot, dMin, dMax) {
  for (const c of slot.prescriptionsByCycle) for (const x of c.sets) {
    const key = x.targets.reps ? "reps" : x.targets.repsPerSide ? "repsPerSide" : null;
    if (!key) continue;
    const t = x.targets[key];
    t.min = Math.max(1, t.min + dMin); t.max = Math.max(t.min, t.max + dMax);
  }
}
function setRir(slot, setIndex, rir) {
  for (const c of slot.prescriptionsByCycle) {
    const x = c.sets[setIndex]; if (!x) continue;
    x.rir = Math.max(0, Math.min(4, isDeload(c) ? rir + 2 : rir));
  }
}
function setRest(slot, sec) { for (const c of slot.prescriptionsByCycle) for (const x of c.sets) x.restSeconds = sec; }
// The source catalog's own metric composition, through the same domain module the compiler uses.
function metricsFor(exerciseId) {
  const ex = catalog.exercises.find((e) => e.id === exerciseId);
  const ids = Array.isArray(ex?.exerciseMetrics) ? ex.exerciseMetrics : [];
  const d = self.RepForgeExerciseMetrics.definitionsForIds(ids);
  return d.ok ? { metricIds: [...ids], metricDefinitions: d.value } : null;
}
function swap(slot, exerciseId, sub) {
  slot.exerciseId = exerciseId;
  slot.sourceExerciseIds = [exerciseId];
  const m = metricsFor(exerciseId);
  if (m) { slot.metricIds = m.metricIds; slot.metricDefinitions = m.metricDefinitions; }
  if (sub) slot.executionMode = sub.executionMode;
  slot.alternates = (slot.alternates || []).filter((id) => id !== exerciseId);
  if (!slot.alternates.length) delete slot.alternates;
  const ex = catalog.exercises.find((e) => e.id === exerciseId);
  // Fields the compiler derives from the source catalog, copied as it does.
  if (ex) {
    slot.metricOrigin = "source_catalog";
    slot.lateralityIds = Array.isArray(ex.laterality) ? [...ex.laterality] : [];
    slot.loadingModel = { bodyweightCoefficient: Number.isFinite(ex.bodyweight) ? ex.bodyweight : null, assistanceDirection: "subtract" };
  }
  if (ex) slot.musclePurposeIds = [...new Set([...(ex.primaryFeatureMuscle || []), ...(ex.secondaryFeatureMuscle || [])])].filter((id) => names[id]).slice(0, 4);
  // A per-side movement keeps the slot's ranges on the metric it records.
  const perSide = (slot.metricDefinitions || []).some((m) => m.semantic === "repsPerSide");
  for (const c of slot.prescriptionsByCycle) for (const x of c.sets) {
    const t = x.targets.reps || x.targets.repsPerSide;
    if (t) x.targets = perSide ? { repsPerSide: t } : { reps: t };
  }
}
function addSlot(day, exerciseId) {
  const tmpl = state.working.days.flatMap((d) => d.slots || []).find((s) => (s.role || "").endsWith("Accessory")) || state.working.days.flatMap((d) => d.slots || [])[0];
  const slot = clone(tmpl);
  slot.id = nextId("slot");
  slot.purposeId = `${day.name.toLowerCase().replace(/\s+/g, "_")}_lifter_added`;
  slot.role = "manual";
  delete slot.alternates;
  for (const c of slot.prescriptionsByCycle) for (const x of c.sets) x.id = nextId("set");
  const subs = C.findSubstitutions(state.working, tmpl.id, {}, catalog);
  swap(slot, exerciseId, subs.find((x) => x.exerciseId === exerciseId) || null);
  setCount(slot, 3);
  slot.order = (day.slots || []).length + 1;
  day.slots.push(slot);
}
function renumber(day) { (day.slots || []).forEach((s, i) => { s.order = i + 1; }); }

// What the lifter changed against the recommendation: slot content, the day a
// slot sits on, removed and added slots, renamed days and reordered days.
function changes() {
  const before = {}, out = {};
  const content = (d, s) => JSON.stringify([d.id, s.exerciseId, s.prescriptionsByCycle, s.alternates || []]);
  for (const d of state.def.days) for (const s of d.slots || []) before[s.id] = content(d, s);
  let n = 0;
  for (const d of state.working.days) for (const s of d.slots || []) {
    if (!before[s.id]) { out[s.id] = "added"; n++; }
    else if (before[s.id] !== content(d, s)) { out[s.id] = "edited"; n++; }
  }
  const ids = new Set(state.working.days.flatMap((d) => (d.slots || []).map((s) => s.id)));
  const removed = Object.keys(before).filter((id) => !ids.has(id)).length;
  const renamed = state.working.days.filter((d, i) => d.name !== state.def.days[i]?.name).length;
  const reordered = state.working.days.filter((d, i) => {
    const was = (state.def.days[i].slots || []).map((s) => s.id).filter((id) => (d.slots || []).some((x) => x.id === id));
    const now = (d.slots || []).map((s) => s.id).filter((id) => was.includes(id));
    return was.join() !== now.join();
  }).length;
  return { slots: out, count: n + removed + renamed + reordered, removed };
}
// Movements a lifter can add or pick from search: catalog exercises that record reps.
function searchable() {
  return catalog.exercises.filter((e) => {
    const m = metricsFor(e.id);
    return m && m.metricDefinitions.some((d) => d.semantic === "reps" || d.semantic === "repsPerSide");
  }).map((e) => e.id);
}
function snapshot() {
  const v = C.validateProgramDefinition(state.working, catalog);
  return { days: summarize(state.working), changes: changes(), valid: v.ok, issues: (v.issues || []).slice(0, 3), canUndo: state.undo.length > 0,
    confirmed: Object.keys(state.working.request.movementConfirmations || {}) };
}
function edit(op) {
  const w = state.working;
  state.undo.push(clone(w));
  if (state.undo.length > 40) state.undo.shift();
  const at = op.slotId ? slotOf(w, op.slotId) : null;
  switch (op.op) {
    case "sets": setCount(at.slot, op.n); break;
    case "reps": shiftReps(at.slot, op.dMin, op.dMax); break;
    case "rir": setRir(at.slot, op.set, op.rir); break;
    case "rest": setRest(at.slot, op.sec); break;
    case "swap": { const sub = C.findSubstitutions(w, op.slotId, {}, catalog).find((x) => x.exerciseId === op.exerciseId); swap(at.slot, op.exerciseId, sub || null); if (op.confirm) { w.request.movementConfirmations = { ...w.request.movementConfirmations, [op.exerciseId]: op.confirm }; } break; }
    case "alt-add": { const list = at.slot.alternates || []; if (list.length < (C.MAX_SLOT_ALTERNATES || 5) && !list.includes(op.exerciseId) && op.exerciseId !== at.slot.exerciseId) at.slot.alternates = [...list, op.exerciseId]; break; }
    case "alt-move": { const list = at.slot.alternates || []; const i = list.indexOf(op.exerciseId), j = i + op.dir; if (i >= 0 && j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; } break; }
    case "alt-remove": { at.slot.alternates = (at.slot.alternates || []).filter((id) => id !== op.exerciseId); if (!at.slot.alternates.length) delete at.slot.alternates; break; }
    case "remove": at.day.slots.splice(at.i, 1); renumber(at.day); break;
    case "move": { const [s] = at.day.slots.splice(at.i, 1); const to = w.days[op.toDay]; to.slots.splice(op.index ?? to.slots.length, 0, s); renumber(at.day); renumber(to); break; }
    case "reorder": { const d = w.days[op.day]; const [s] = d.slots.splice(op.from, 1); d.slots.splice(op.to, 0, s); renumber(d); break; }
    case "add": addSlot(w.days[op.day], op.exerciseId); break;
    case "rename-day": w.days[op.day].name = op.name; break;
    default: state.undo.pop();
  }
  return snapshot();
}
function substitutions(slotId) {
  const at = slotOf(state.working, slotId);
  if (!at) return [];
  if (at.slot.role === "manual") {
    const near = state.working.days.flatMap((d) => d.slots || []).find((s) => s.role !== "manual" && (s.musclePurposeIds || []).some((m) => (at.slot.musclePurposeIds || []).includes(m)));
    return near ? C.findSubstitutions(state.working, near.id, {}, catalog).map((x) => x.exerciseId).filter((id) => id !== at.slot.exerciseId).slice(0, 12) : [];
  }
  return C.findSubstitutions(state.working, slotId, {}, catalog).map((x) => x.exerciseId).slice(0, 12);
}

self.onmessage = async (event) => {
  const { id, type, answers, preset } = event.data;
  await ready;
  if (type === "groups") return self.postMessage({ id, groups: groupsFor(preset) });
  if (type === "edit") return self.postMessage({ id, result: edit(event.data.edit) });
  if (type === "undo") { if (state.undo.length) state.working = state.undo.pop(); return self.postMessage({ id, result: snapshot() }); }
  if (type === "restore") { state.undo.push(clone(state.working)); state.working = clone(state.def); return self.postMessage({ id, result: snapshot() }); }
  if (type === "searchable") return self.postMessage({ id, ids: searchable() });
  if (type === "subs") return self.postMessage({ id, ids: substitutions(event.data.slotId) });
  if (type === "generate") {
    try { self.postMessage({ id, result: generate(answers) }); }
    catch (error) { self.postMessage({ id, result: { ok: false, conflicts: [{ code: "error", message: String(error) }] } }); }
  }
};
