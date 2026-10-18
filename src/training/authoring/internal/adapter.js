/** Bind setup answer mapping to one explicit compiler; each operation supplies its checked catalog. */
export function createEntryAdapter({compiler: boundCompiler}) {

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function compilerApi(injected) {
    const compiler = injected || boundCompiler;
    if (!compiler || typeof compiler.generateProgram !== "function" ||
      typeof compiler.validateProgramDefinition !== "function") {
      throw new TypeError("Canonical program compiler unavailable");
    }
    return compiler;
  }

  function rawCatalogSnapshot(injected) {
    const catalog = injected || null;
    if (!isPlainObject(catalog) || !Array.isArray(catalog.exercises) || !catalog.exercises.length ||
      !isPlainObject(catalog.uuidIndex) || !Object.keys(catalog.uuidIndex).length ||
      typeof catalog.generatedAt !== "string" || !catalog.generatedAt) {
      throw new TypeError("A checked raw catalog snapshot is required");
    }
    return catalog;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function fingerprint(value) {
    const text = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `pe-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function currentVersions(Compiler) {
    return {
      compiler: String(Compiler.GENERATOR_VERSION ?? "manual@1"),
      family: "retired",
      blueprint: String(Compiler.PROGRAM_SCHEMA_VERSION ?? 1),
      catalogue: "raw-uuid@1",
      rules: "source-metrics@1",
      context: "program-definition@1",
      progression: String(Compiler.GENERATOR_VERSION ?? "manual@1"),
      recentConsistency: "retired",
      simpleStart: "retired",
    };
  }

  function buildEmptyProgram(answers, Compiler, catalog) {
    const name = typeof answers?.programName === "string" ? answers.programName.trim() : "";
    const daysPerWeek = answers?.daysPerWeek;
    if (!name || name.length > 80 || !Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) {
      return { ok: false, code: "build_setup_incomplete", conflicts: [] };
    }
    const cycles = Number.isInteger(answers.cycles) ? answers.cycles : 7;
    if (cycles < 1 || cycles > 12) return { ok: false, code: "build_setup_incomplete", conflicts: [] };
    const days = Array.from({ length: 7 }, (_, index) => ({
      id: `manual-day-${index + 1}`,
      name: `Day ${index + 1}`,
      kind: index < daysPerWeek ? "training" : "rest",
      order: index + 1,
      slots: [],
    }));
    const programDefinition = {
      schemaVersion: 2,
      generatorVersion: "manual@1",
      request: {},
      days,
      cycles,
      deloadCycles: [],
      provenance: { source: "manual", policyVersion: "manual@1" },
    };
    const checked = Compiler.validateProgramDefinition(programDefinition, catalog);
    if (!checked.ok) return { ok: false, code: "build_definition_invalid", conflicts: checked.issues };
    const previewDays = days.slice(0, daysPerWeek).map((day) => ({
      dayId: day.id,
      label: day.name,
      order: day.order,
      exercises: [],
    }));
    const programStructure = {
      schemaVersion: 1,
      days: previewDays.map(({ dayId, label, order }) => ({ dayId, label, order })),
      provenance: { source: "manual" },
    };
    const preview = {
      source: "manual_build",
      frequency: daysPerWeek,
      program: [],
      programDefinition,
      programStructure,
      days: previewDays,
      customExercises: [],
      primaryMuscles: [],
    };
    return {
      ok: true,
      fingerprint: fingerprint({ name, programDefinition }),
      name,
      program: [],
      programDefinition,
      programStructure,
      preview,
    };
  }

  function foldName(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/\s+/g, " ");
  }

  function exerciseIdentity(row) {
    return row && row.libraryId ? `lib:${row.libraryId}` : `name:${foldName(row && row.name)}`;
  }

  function identityDiff(before, after) {
    const rows = (value) => (Array.isArray(value && value.program) ? value.program : Array.isArray(value) ? value : []);
    const tally = (list) => {
      const counts = new Map();
      for (const row of list) {
        const key = exerciseIdentity(row);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return counts;
    };
    const was = tally(rows(before)), now = tally(rows(after));
    let added = 0, removed = 0;
    for (const [key, count] of now) added += Math.max(0, count - (was.get(key) || 0));
    for (const [key, count] of was) removed += Math.max(0, count - (now.get(key) || 0));
    const total = rows(after).length;
    return { added, removed, n: Math.min(total, Math.max(added, removed)), total };
  }

  // ---- Generate answers -> canonical generator request ---------------------
  const GOALS = Object.freeze({ muscle_growth: "hypertrophy", balanced: "hybrid", strength: "strength" });
  const EXPERIENCE = Object.freeze({ first: "beginner", under_6m: "beginner", "6_to_24m": "intermediate", over_24m: "advanced" });
  // The source catalog flags each equipment item for its gym templates.
  // Everything takes every equipment object; a stored Other keeps Local's flag.
  const GYM_FLAGS = Object.freeze({
    everything: "*", commercial_gym: "commercialGym", warehouse_gym: "warehouseGym", basic_gym: "localGym",
    full_home: "garageGym", limited_home: "homeGym", other: "localGym",
  });
  // Onboarding B's equipment groups (Plan 072, Plan 068 slice A). Members are
  // catalog identity, never names, and both halves of a plural/singular pair
  // are listed because the compiler closes only from plural to singular.
  const EQUIPMENT_GROUPS = Object.freeze({
    // Barbell, Weight plate, Weight plates, Bumper plate, Bumper plates
    barbell: Object.freeze([
      "19e5c6f170d8801cac93cf6853bd86b8",
      "1a45c6f170d880629cdcc99a2ff615cf",
      "25a5c6f170d880c1a55ac08cf52671ab",
      "25d5c6f170d880eba241c26f8f426024",
      "25a5c6f170d8805b8c95e7e5b4e8a989",
    ]),
    // Power rack, Squat stand
    rack: Object.freeze([
      "19e5c6f170d880119a7ec9fe338f8fea",
      "2625c6f170d880788ea1cb74ceda4648",
    ]),
    // Adjustable bench, Flat bench
    bench: Object.freeze([
      "1a05c6f170d880d8a7efe4721e964f2d",
      "19e5c6f170d8802b9d8ed6e425798f6b",
    ]),
    // Dumbbell, Dumbbells
    dumbbells: Object.freeze([
      "25a5c6f170d880589ffdf4f627a75b44",
      "19e5c6f170d8808593d8ecf408c4f749",
    ]),
    // Kettlebell, Kettlebells
    kettlebells: Object.freeze([
      "19e5c6f170d880e791c3da3a74828f0e",
      "25a5c6f170d880478d81c880d6ee06a0",
    ]),
    // Straight pull-up bar, Multi-grip pull-up bar
    pullup_bar: Object.freeze([
      "19e5c6f170d88018a872fe18a35ae8aa",
      "25e5c6f170d8808e8276fa6902887bff",
    ]),
    // Dip bars
    dip_bars: Object.freeze([
      "19e5c6f170d88050bdbefcbb91c01f16",
    ]),
    // Pin-loaded single cable machine, Pin-loaded cable crossover, Cuff cable attachment, Cuff cable attachments, V-bar row grip attachment
    cable: Object.freeze([
      "19e5c6f170d880d28b46e9ccddcfba1a",
      "25a5c6f170d8805cb60bd3ee71311ad1",
      "25c5c6f170d88024ac71dfa51cae3bc0",
      "2b25c6f170d880edbbdadcfb8841bfd1",
      "25d5c6f170d880a286ead7979054a9c0",
    ]),
    // Smith machine
    smith: Object.freeze([
      "19e5c6f170d880d29affc687810a9a8a",
    ]),
    // EZ bar
    ez_bar: Object.freeze([
      "19e5c6f170d88074bf1af2264ccaf192",
    ]),
    // 45° leg press, Pin-loaded leg press, Hack squat
    leg_press: Object.freeze([
      "19e5c6f170d880038662ee8145175f92",
      "25c5c6f170d880b0a509d9d5c13748d0",
      "19e5c6f170d880d3914cc4c2631393cd",
    ]),
    // Long resistance band, Long resistance bands, Short resistance band, Anchor point for resistance band
    bands: Object.freeze([
      "19e5c6f170d880d5bf4ae225c061f55d",
      "25b5c6f170d880619592ca5ba65fc1b3",
      "25a5c6f170d880c2be66d2f10537c1c1",
      "2605c6f170d8804bb8e0ca7c86ed38d9",
    ]),
    // Suspension trainer, Anchor point for suspension trainer, Gymnastics Ring, Gymnastics Rings
    suspension: Object.freeze([
      "19f5c6f170d880eea412c7ca7d833844",
      "2605c6f170d880cf825feab5ae68d7a4",
      "27d5c6f170d880138553d4c610c9ddc8",
      "19e5c6f170d880ee9089e447b5f8f9e6",
    ]),
  });
  const PERIODIZATIONS = Object.freeze(["static", "linear", "reverse_linear", "undulating"]);
  const MUSCLE_IDS = Object.freeze({
    chest: "2545c6f170d8805f823bcfb076a74397",
    back: "2545c6f170d880da9b28f1e024be796b",
    quads: "2545c6f170d88084b35affb3c3375aa6",
    hamstrings: "2545c6f170d88002b193de9106604e79",
    glutes: "2545c6f170d8804bb1fbdfc4471debe5",
    side_delts: "2545c6f170d880088132c5739103e625",
    rear_delts: "2545c6f170d880a9899eec0e496c8cba",
    front_delts: "2545c6f170d8809a8fa7e24a77c25416",
    biceps: "2545c6f170d880349546e5d8f6df2e2a",
    triceps: "2545c6f170d88017a44bcd5bc21b8d98",
    calves: "2545c6f170d880bbb34fc724d677176f",
    lats: "2545c6f170d88060a50ec9b41a066a5d",
    forearms: "2545c6f170d88024b49fcea90e7d1ed9",
    lower_back: "2545c6f170d880768fc0ec766d080c01",
    abductors: "2545c6f170d8803d89bcf1ee5a11b23b",
    adductors: "2545c6f170d880a0ad32cd4e83834959",
    neck: "2545c6f170d88021b648feb29a2427c2",
    upper_traps: "2545c6f170d880af953ace5a631c8cd2",
    abs: "2545c6f170d8806aab76c6830449a3ff",
    serratus: "27a5c6f170d880c39b2df5e861495666",
    tibs: "27a5c6f170d880a5baa9c716b240d0f6",
    obliques: "2545c6f170d8809da3f3cd80f2f14a4d",
  });
  const COMPETENCY_KEYS = Object.freeze([
    "pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10",
  ]);
  const TIME_CEILINGS = Object.freeze([20, 40, 60, 90, 120, 150]);

  // Explicit split choices are the generator's authored splits for this day count.
  function splitChoices(answers, Compiler, catalog) {
    const days = answers?.daysPerWeek;
    if (!Number.isInteger(days)) return { choices: [] };
    const mapped = programRequestFromAnswers({ ...answers, splitPreference: "auto" }, catalog);
    if (!mapped.ok) return { choices: [] };
    const canonical = Compiler.canonicalizeRequest(mapped.value, catalog);
    if (!canonical.ok) return { choices: [] };
    const available = Compiler.availableSplits(mapped.value);
    return { choices: Object.entries(Compiler.SPLITS)
      .filter(([id, split]) => split.compatibleDays.includes(days) && available.includes(id))
      .map(([id]) => ({ id, default: id === canonical.value.split, frequency: days })) };
  }

  function compatibleSplit(preference, request) {
    const Compiler = compilerApi();
    if (preference === undefined || preference === "auto") return "auto";
    const split = Compiler.SPLITS[preference];
    const available = Compiler.availableSplits({ ...request, split: preference });
    return split && split.compatibleDays.includes(request.daysPerWeek) && available.includes(preference) ? preference : null;
  }

  function programRequestFromAnswers(answers, catalog) {
    const conflicts = [];
    const conflict = (code) => conflicts.push({ field: code.replace(/_(required|unsupported)$/, ""), code });
    const source = isPlainObject(answers) ? answers : {};
    if (!catalog || !isPlainObject(catalog.uuidIndex)) return { ok: false, conflicts: [{ field: "catalog", code: "catalog_unavailable" }] };
    const index = catalog.uuidIndex;
    const goal = GOALS[source.desiredResult];
    if (!goal) conflict("goal_required");
    const experience = EXPERIENCE[source.structuredExperience];
    if (!experience) conflict("experience_required");
    const days = source.daysPerWeek;
    if (!Number.isInteger(days) || days < 2 || days > 6) conflict("days_unsupported");
    const flag = GYM_FLAGS[source.environment?.kind];
    if (!flag) conflict("environment_required");
    if (conflicts.length) return { ok: false, conflicts };
    const minutes = Number.isFinite(source.sessionMinutes) ? source.sessionMinutes : 60;
    const ceiling = [...TIME_CEILINGS].reverse().find((value) => value <= minutes) ?? TIME_CEILINGS[0];
    const ids = (type, predicate) => Object.keys(index).filter((id) => index[id]?.type === type && predicate(index[id])).sort();
    const muscleIds = (tokens) => (Array.isArray(tokens) ? tokens : []).map((token) =>
      MUSCLE_IDS[token]).filter((id) => index[id]?.type === "featureMuscleGroup");
    const exerciseIds = (values) => (Array.isArray(values) ? values : [])
      .filter((id) => typeof id === "string" && index[id]?.type === "exercise");
    const answersIn = isPlainObject(source.competencyAnswers) ? source.competencyAnswers : {};
    if (source.block?.cycles !== undefined && source.block.cycles !== 7) {
      return { ok: false, conflicts: [{ field: "block", code: "block_cycles_unsupported" }] };
    }
    const block = {
      cycles: 7,
      periodization: PERIODIZATIONS.includes(source.block?.periodization) ? source.block.periodization : "static",
    };
    const request = {
      goal,
      experience,
      daysPerWeek: days,
      timeCeilingMinutes: ceiling,
      gymProfile: { equipmentIds: gymEquipment(ids("equipment", (entry) => flag === "*" || entry[flag] === 1), source.environment.adjust) },
      competencyAnswers: competencies(answersIn),
      movementConfirmations: confirmations(source.movementConfirmations, catalog),
      emphasisMuscleIds: muscleIds(source.primaryMuscles),
      deprioritizedMuscleIds: muscleIds(source.deEmphasizedMuscles),
      excludedExerciseIds: exerciseIds((source.exerciseConstraints || []).map((item) => item?.exerciseId)),
      excludedMuscleIds: muscleIds(source.ignoredMuscles),
      preferredExerciseIds: exerciseIds(source.mustHaveExercises),
      split: "auto",
      periodization: block.periodization,
      cycles: block.cycles + (source.deload === true ? 1 : 0),
      deloadCycles: source.deload === true ? [block.cycles + 1] : [],
    };
    request.split = compatibleSplit(source.splitPreference, request);
    if (request.split === null) {
      return { ok: false, conflicts: [{ field: "split", code: "split_unsupported" }] };
    }
    return { ok: true, value: request };
  }

  // Ten strict pull-ups is also five (owner decision on #340). Resolved here,
  // in the answers, so a recipe link carries both explicitly and the
  // generator's own rules do not change.
  function competencies(answersIn) {
    const out = Object.fromEntries(COMPETENCY_KEYS.map((key) =>
      [key, typeof answersIn[key] === "boolean" ? answersIn[key] : null]));
    if (out.pullups10 === true) out.pullups5 = true;
    return out;
  }

  // The groups B's equipment step starts ticked: any member in the preset.
  function presetEquipmentGroups(kind, catalog) {
    const flag = GYM_FLAGS[kind];
    const index = catalog && isPlainObject(catalog.uuidIndex) ? catalog.uuidIndex : null;
    if (!flag || !index) return [];
    const inPreset = (id) => index[id]?.type === "equipment" && (flag === "*" || index[id][flag] === 1);
    return Object.keys(EQUIPMENT_GROUPS).filter((token) => EQUIPMENT_GROUPS[token].some(inPreset));
  }

  // (preset ∪ added groups) − removed groups. No adjustment is the preset.
  function gymEquipment(preset, adjust) {
    const members = (tokens) => (Array.isArray(tokens) ? tokens : [])
      .flatMap((token) => (Object.prototype.hasOwnProperty.call(EQUIPMENT_GROUPS, token) ? EQUIPMENT_GROUPS[token] : []));
    const removed = new Set(members(adjust?.remove));
    return [...new Set([...preset, ...members(adjust?.add)])].filter((id) => !removed.has(id)).sort();
  }

  // A confirmation names a current catalog exercise and only prerequisites it
  // actually has; anything else is dropped rather than sent to the compiler.
  function confirmations(value, catalog) {
    if (!isPlainObject(value) || !Object.keys(value).length) return {};
    const exercises = new Map((Array.isArray(catalog.exercises) ? catalog.exercises : []).map((exercise) => [exercise.id, exercise]));
    const output = {};
    for (const exerciseId of Object.keys(value).sort()) {
      const exercise = exercises.get(exerciseId);
      const own = new Set(Array.isArray(exercise?.preconditions) ? exercise.preconditions : []);
      const listed = Array.isArray(value[exerciseId]) ? value[exerciseId] : [];
      if (listed.length && listed.every((id) => own.has(id))) output[exerciseId] = [...new Set(listed)].sort();
    }
    return output;
  }

  // The compiler predicts which slots a confirmation would change; collision
  // avoidance and time fit can still stop it landing. An offer is kept only
  // when confirming it alone puts that movement in that
  // slot, and it names the other slots that confirmation also moves.
  async function verifyConfirmationOffers({ generate, request, result, signal } = {}) {
    if (!result?.ok || !Array.isArray(result.confirmationOffers)) return [];
    const before = result.value.days.flatMap((day, dayIndex) => day.slots.map((slot, slotIndex) =>
      ({ id: slot.id, exerciseId: slot.exerciseId, dayIndex, slotIndex })));
    const verified = await Promise.all(result.confirmationOffers.map(async (offer) => {
      const confirmed = await generate({
        ...request,
        movementConfirmations: { ...(request.movementConfirmations || {}), [offer.offeredExerciseId]: [...offer.prerequisiteIds] },
      }, { signal });
      if (!confirmed?.ok) return null;
      const target = before.find((slot) => slot.id === offer.slotId);
      const after = (slot) => confirmed.value.days[slot.dayIndex]?.slots[slot.slotIndex]?.exerciseId;
      if (!target || after(target) !== offer.offeredExerciseId) return null;
      const alsoChangedSlotIds = before.filter((slot) => slot.id !== offer.slotId && after(slot) !== slot.exerciseId)
        .map((slot) => slot.id);
      return { ...offer, prerequisiteIds: [...offer.prerequisiteIds], alsoChangedSlotIds };
    }));
    return verified.filter(Boolean);
  }

  function createProductionServices(options) {
    const opts = isPlainObject(options) ? options : {};
    const Compiler = compilerApi(opts.Compiler);
    const catalog = rawCatalogSnapshot(opts.catalog);
    const versions = currentVersions(Compiler);
    return Object.freeze({
      version: versions.compiler,
      currentVersions: () => ({ ...versions }),
      generateProgram: ({ request } = {}) => Compiler.generateProgram(request, catalog),
      buildEmptyProgram: (answers) => buildEmptyProgram(answers, Compiler, catalog),
      splitChoices: (answers) => splitChoices(answers, Compiler, catalog),
      fingerprint,
      identityDiff,
    });
  }

  const api = Object.freeze({
    createProductionServices,
    programRequestFromAnswers,
    EQUIPMENT_GROUPS,
    presetEquipmentGroups,
    verifyConfirmationOffers,
    currentVersions: (Compiler) => currentVersions(compilerApi(Compiler)),
    fingerprint,
    identityDiff,
    buildEmptyProgram: (answers, options) => {
      const opts = isPlainObject(options) ? options : {};
      return buildEmptyProgram(answers, compilerApi(opts.Compiler), rawCatalogSnapshot(opts.catalog));
    },
  });

  return api;
}
