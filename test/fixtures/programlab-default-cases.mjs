import { corpusCases } from './program-compiler-corpus-cases.mjs';

// Default-preservation cases extend the production corpus with every supported
// split and the cycle/experience boundaries absent from its ordinary sample.
export function programLabDefaultCases({ Adapter, Catalog, Layout }) {
  const cases = corpusCases({ Adapter, Catalog });
  const equipmentIds = Object.keys(Catalog.uuidIndex)
    .filter(id => Catalog.uuidIndex[id]?.type === 'equipment').sort();
  const competencyAnswers = Object.fromEntries(['pullups10', 'pullups5', 'pushups15',
    'inclineBarbell10', 'overheadPress10', 'bodyweightDips10', 'benchPress10']
    .map(key => [key, true]));
  for (const split of Layout.SPLITS) for (const daysPerWeek of split.daysPerWeek) {
    const mapped = Adapter.programRequestFromAnswers({ desiredResult: 'balanced',
      structuredExperience: 'over_24m', daysPerWeek, sessionMinutes: 60,
      environment: { kind: 'commercial_gym' } }, Catalog);
    if (!mapped.ok) throw new Error(JSON.stringify(mapped));
    cases.push({ key: `split/${split.id}/${daysPerWeek}`, request: { ...mapped.value,
      split: split.id, gymProfile: { equipmentIds }, competencyAnswers } });
  }
  const anchor = cases.find(item => item.key === 'split/upper_lower_upper_lower/4').request;
  for (const experience of ['beginner', 'intermediate', 'advanced']) {
    for (const periodization of ['static', 'linear', 'reverse_linear', 'undulating']) {
      for (const deload of [0, 1, 8]) cases.push({
        key: `prescriptions/${experience}/${periodization}/${deload}`,
        request: { ...anchor, experience, periodization, cycles: deload ? 8 : 7,
          deloadCycles: deload ? [deload] : [] },
      });
    }
  }
  return cases;
}
