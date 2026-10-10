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
  const est = def.provenance?.estimatedSessionSeconds || {};
  return def.days.map((d) => ({
    name: d.name, kind: d.kind, minutes: Math.round((est[d.name] || 0) / 60),
    slots: (d.slots || []).map((s) => ({
      id: s.exerciseId, purpose: s.purposeId,
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
  const confirmedSlots = [];
  g.value.days.forEach((d, i) => d.slots.forEach((s, j) => { if (confirmed[s.exerciseId]) confirmedSlots.push({ day: i, slot: j, id: s.exerciseId }); }));
  return { ok: true, days, offers, confirmedSlots, ms: Date.now() - t0, cycles: r.value.cycles, deload: r.value.deloadCycles };
}

self.onmessage = async (event) => {
  const { id, type, answers, preset } = event.data;
  await ready;
  if (type === "groups") return self.postMessage({ id, groups: groupsFor(preset) });
  if (type === "generate") {
    try { self.postMessage({ id, result: generate(answers) }); }
    catch (error) { self.postMessage({ id, result: { ok: false, conflicts: [{ code: "error", message: String(error) }] } }); }
  }
};
