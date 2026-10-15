// The requests behind test/fixtures/program-compiler-corpus.json, shared by the
// Node digest check (program-compiler-search.mjs) and the worker equivalence
// check (program-engine-worker.mjs). Each case is { key, request, seed }; the
// key is the fixture's digest key.
export function corpusCases({ Adapter, Catalog }) {
  const allEquipment = Object.keys(Catalog.uuidIndex).filter((id) => Catalog.uuidIndex[id]?.type === "equipment").sort();
  const exerciseId = (name) => Catalog.exercises.find((entry) => entry.name === name).id;
  const requestFor = (answers) => {
    const mapped = Adapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
      environment: { kind: "limited_home" }, ...answers,
    }, Catalog);
    if (!mapped.ok) throw new Error(`corpus answers do not map: ${JSON.stringify(mapped.conflicts)}`);
    return mapped.value;
  };
  // Byte-identical regeneration across goals, experience, day counts, gym
  // templates, session lengths, muscle and exercise answers, and seeds.
  const variants = {
    plain: {},
    focus: { primaryMuscles: ["side_delts", "back"], deEmphasizedMuscles: ["calves"] },
    avoid: { ignoredMuscles: ["glutes"], exerciseConstraints: [{ exerciseId: exerciseId("Pec deck fly"), reason: "dislike" }] },
    prefer: { mustHaveExercises: [exerciseId("Leg extension")] },
    competent: { competencyAnswers: Object.fromEntries(["pullups10", "pullups5", "pushups15", "inclineBarbell10",
      "overheadPress10", "bodyweightDips10", "benchPress10"].map((key) => [key, true])) },
  };
  const items = [];
  for (const goal of ["muscle_growth", "balanced", "strength"]) {
    for (const days of [2, 3, 4, 5, 6]) {
      for (const environment of ["limited_home", "full_home", "basic_gym", "commercial_gym", "everything"]) {
        for (const minutes of [40, 90]) {
          items.push({ goal, experience: "6_to_24m", days, environment, minutes, variant: "plain", seed: days % 2 ? "1" : "corpus-b" });
        }
      }
    }
  }
  for (const variant of Object.keys(variants)) {
    for (const experience of ["first", "over_24m"]) {
      for (const environment of ["limited_home", "basic_gym", "commercial_gym"]) {
        items.push({ goal: experience === "first" ? "muscle_growth" : "strength", experience, days: experience === "first" ? 3 : 5,
          environment, minutes: 60, variant, seed: "variant" });
      }
    }
  }
  return items.map((item) => {
    const request = requestFor({
      desiredResult: item.goal, structuredExperience: item.experience, daysPerWeek: item.days, sessionMinutes: item.minutes,
      environment: { kind: item.environment === "everything" ? "commercial_gym" : item.environment }, ...variants[item.variant],
    });
    return {
      key: [item.goal, item.experience, item.days, item.environment, item.minutes, item.variant, item.seed].join("|"),
      request: item.environment === "everything" ? { ...request, gymProfile: { equipmentIds: allEquipment } } : request,
      seed: item.seed,
    };
  });
}
