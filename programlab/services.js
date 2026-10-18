/* UI adapter for the real shared engine, lab domain and lab-only store.
   No generation, identity, metric, archive or database implementation lives here. */
(function attachProgramLabServices(root) {
  'use strict';
  const copy = value => structuredClone(value);
  const tr = (en, pt) => ({ en, pt });
  const L = () => root.RepForgeProgramLabI18n;
  const t = (key, values) => L().t(key, values);
  const issue = (code, message) => Object.assign(new Error(message), { code });
  let Policy, Compiler, Adapter, Engine, D, db, domain, runner, catalog, manifest, metadata, corpus;
  let storageError = null, activeArchive = null, archivedMetricsDomain, planCache = null;
  const metricsCache = new WeakMap();
  const build = () => ({ runtimeFingerprint: manifest.runtimeFingerprint, catalogSha256: manifest.catalogSha256, diagnostics: manifest.diagnosticsVersion });
  const presetIds = ['bundled_default', 'two_sets_low_rir@1', 'two_sets_zero_rir@1'];
  const fingerprint = value => D.digest(value);
  const hashBytes = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  function fieldGroup(path) {
    const first = path.split('.')[0];
    return { volume: tr('Volume', 'Volume'), allocation: tr('Allocation', 'Distribuição'),
      prescription: path.includes('Rir') || path.includes('rir') ? 'RIR' : path.includes('restSeconds') ? tr('Rest', 'Descanso') : tr('Reps', 'Repetições'),
      periodization: tr('Periodization', 'Periodização'), deload: 'Deload', timeModel: tr('Time model', 'Modelo de duração') }[first] || first;
  }
  async function getJSON(name) {
    const response = await fetch(new URL(name, document.baseURI), { cache: 'no-store' });
    if (!response.ok) throw issue('artifact_incomplete', t('The standalone artifact is incomplete: {file}', { file: name }));
    return response.json();
  }
  async function verifyManifest(value) {
    if (value.kind !== 'taurifer-programlab-build' || value.schemaVersion !== 1
      || value.generatorVersion !== Compiler.GENERATOR_VERSION || value.catalogSha256 !== root.RepForgeExercises.catalogSha256
      || value.diagnosticsVersion !== 'allocation-lineage@1') throw issue('build_mismatch', t('The source manifest does not match the loaded engine. Rebuild the standalone artifact.'));
    for (const name of Object.keys(value.files)) {
      if (/^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i.test(name)) throw issue('build_mismatch', 'Unsafe manifest source path');
      if (!/\.(?:js|mjs|json)$/.test(name)) continue;
      const response = await fetch(new URL(name, document.baseURI), { cache: 'no-store' });
      if (!response.ok || await hashBytes(await response.arrayBuffer()) !== value.files[name].sha256) throw issue('build_mismatch', t('Packaged source hash mismatch: {file}', { file: name }));
    }
  }
  function normalizeScenario(source) {
    const scenario = copy(source);
    // Current domain scenarios use id. Historical observational seed metadata
    // is retained only by the archive owner, never sent to the current compiler.
    delete scenario.key;
    delete scenario.seed;
    if (!scenario.id) throw issue('invalid_scenario', t('A scenario ID is required.'));
    let checked;
    if (scenario.inputMode === 'answers') {
      checked = Adapter.programRequestFromAnswers(scenario.answers, catalog);
      if (!checked.ok) throw Object.assign(issue('invalid_scenario', t('Review the scenario answers.')), { issues: checked.issues || checked.conflicts });
      scenario.request = checked.value;
    }
    checked = Compiler.normalizeProgramRequest(scenario.request, catalog);
    if (!checked.ok) throw Object.assign(issue('invalid_scenario', t('Review the canonical request.')), { issues: checked.issues });
    scenario.request = checked.value;
    return D.snapshot(scenario);
  }
  function answers(overrides = {}) {
    return {
      desiredResult: 'muscle_growth', structuredExperience: '6_to_24m', daysPerWeek: 4, sessionMinutes: 150,
      environment: { kind: 'commercial_gym' }, splitPreference: 'auto', block: { cycles: 7, periodization: 'static' }, deload: false,
      competencyAnswers: Object.fromEntries(['pullups10', 'pullups5', 'pushups15', 'inclineBarbell10', 'overheadPress10', 'bodyweightDips10', 'benchPress10'].map(key => [key, true])),
      ...overrides,
    };
  }
  function fromAnswers(id, name, value, allEquipment = false) {
    const mapped = Adapter.programRequestFromAnswers(value, catalog);
    if (!mapped.ok) throw Object.assign(issue('fixture_invalid', 'Bundled fixture is invalid'), { issues: mapped.conflicts });
    if (allEquipment) {
      mapped.value.gymProfile.equipmentIds = Object.keys(catalog.uuidIndex).filter(id => catalog.uuidIndex[id]?.type === 'equipment').sort();
      // Explicit canonical override is visible: the ordinary answer adapter has
      // gym presets, while this fixture deliberately includes all catalog gear.
      return normalizeScenario({ id, name, inputMode: 'canonical', request: mapped.value });
    }
    return normalizeScenario({ id, name, inputMode: 'answers', answers: value, request: mapped.value });
  }
  function fixture(id) {
    const make = {
      'anchor-4day': () => fromAnswers(id, '073.4 · four days · all equipment', answers(), true),
      'anchor-beginner': () => fromAnswers(id, '073.4 · beginner · all equipment', answers({ structuredExperience: 'first' }), true),
      'anchor-deload': () => fromAnswers(id, '073.4 · eight cycles with final deload', answers({ deload: true }), true),
      'anchor-focus': () => fromAnswers(id, '073.4 · side delts/back priority', answers({ primaryMuscles: ['side_delts', 'back'], deEmphasizedMuscles: ['calves'] }), true),
      'budget-40': () => fromAnswers(id, '073.4 · 40-minute allocation', answers({ sessionMinutes: 40 })),
      'restricted-home': () => fromAnswers(id, '073.4 · limited home equipment', answers({ environment: { kind: 'limited_home' }, sessionMinutes: 60 })),
      'three-day': () => fromAnswers(id, '073.4 · three-day distribution', answers({ daysPerWeek: 3 })),
      'production-answers': () => fromAnswers(id, '073.4 · editable production answers', answers()),
      'compiler-corpus': () => corpus.map(item => normalizeScenario({ id: item.key, name: item.key, inputMode: 'canonical', request: item.request })),
    };
    if (!make[id]) throw issue('unknown_fixture', t('Unknown bundled scenario.'));
    return D.snapshot(make[id]());
  }
  function transformed(id, source) {
    if (!presetIds.includes(id)) throw issue('unknown_preset', t('Unknown policy preset.'));
    const policy = id === 'bundled_default' ? Policy.getDefaultEnginePolicy() : copy(source || Policy.getDefaultEnginePolicy());
    if (id !== 'bundled_default') {
      for (const key of Object.keys(policy.volume.setsByType)) policy.volume.setsByType[key] = 2;
      for (const key of metadata.repClasses) policy.prescription.baseRirByClass[key] = id === 'two_sets_zero_rir@1' || key === 'assistance' ? 0 : 1;
      if (id === 'two_sets_zero_rir@1') for (const entries of Object.values(policy.prescription.rirAdjustmentsBySetCount)) entries.fill(0);
    }
    const checked = Policy.normalizeEnginePolicy(policy);
    if (!checked.ok) throw Object.assign(issue('invalid_engine_policy', t('Preset validation failed.')), { issues: checked.issues });
    return checked.value;
  }
  function configuration() {
    const baselinePolicy = Policy.getDefaultEnginePolicy();
    return { experimentId: crypto.randomUUID(), revision: 1, name: t('Untitled experiment'), notes: '', mode: 'single', scenarios: [fixture('anchor-4day')], baselinePolicy,
      candidatePolicy: Policy.getDefaultEnginePolicy(), referenceTimePolicy: baselinePolicy, sweep: null };
  }
  function makePlan(configuration) {
    // The v0 baseline is fixed to this build. An archived result stays viewable,
    // while a new execution must explicitly use this build's bundled baseline.
    if (fingerprint(configuration.baselinePolicy) !== fingerprint(Policy.getDefaultEnginePolicy())) throw issue('baseline_mismatch', t('This archived baseline belongs to another build. Create a new experiment to run with this build.'));
    const key = D.digest({ configuration, build: build() });
    if (planCache?.key === key) return planCache.value;
    const value = domain.plan(configuration, build());
    planCache = { key, value }; // Immutable input plans only; every run executes fresh cells.
    return value;
  }
  async function revisionPlan(configuration) {
    let plan = makePlan(configuration);
    if (!db) return plan;
    const resolved = await db.resolveRevision(plan.experiment);
    plan = makePlan(resolved);
    return plan;
  }
  const percent = share => share?.fraction === null || !share ? '—' : `${(share.fraction * 100).toFixed(1)}% (${share.numerator}/${share.denominator})`;
  const minutes = seconds => !Number.isFinite(seconds) ? '—' : `${(seconds / 60).toFixed(1)} min`;
  function metricRows(metrics, cycleIndex) {
    const cycle = metrics?.cycles.find(item => item.cycleIndex === cycleIndex);
    if (!cycle) return [];
    return [
      { label: tr('Allocation max-day estimate (before prescriptions)', 'Estimativa do maior dia na distribuição (antes das prescrições)'), value: metrics.fittingEstimate ? minutes(Math.max(...Object.values(metrics.fittingEstimate))) : null },
      { label: tr('Actual working sets', 'Séries efetivamente prescritas'), value: cycle.workingSets },
      { label: tr('Two-set occurrences', 'Ocorrências com duas séries'), value: percent(cycle.twoSetShare) },
      { label: tr('RIR 0 / numeric sets', 'RIR 0 / séries com RIR numérico'), value: percent(cycle.rir.zero) },
      { label: tr('RIR 0–1 / numeric sets', 'RIR 0–1 / séries com RIR numérico'), value: percent(cycle.rir.low) },
      { label: tr('Unspecified RIR sets', 'Séries sem RIR especificado'), value: cycle.rir.unspecified },
      { label: tr('Own-policy max-day estimate', 'Estimativa do maior dia no modelo da própria política'), value: minutes(cycle.duration.own?.maxDaySeconds) },
      { label: tr('Common-model max-day estimate', 'Estimativa do maior dia no modelo comum'), value: minutes(cycle.duration.common?.maxDaySeconds) },
      { label: tr('Own-policy cycle-total estimate', 'Estimativa do ciclo total no modelo da própria política'), value: minutes(cycle.duration.own?.totalSeconds) },
      { label: tr('Common-model cycle-total estimate', 'Estimativa do ciclo total no modelo comum'), value: minutes(cycle.duration.common?.totalSeconds) },
      { label: tr('Cycles above requested ceiling: days', 'Dias acima do limite solicitado neste ciclo'), value: cycle.aboveRequestedMinutes.length },
    ];
  }
  function recordMetrics(run, record) {
    if (!record) return null;
    if (metricsCache.has(record)) return metricsCache.get(record);
    const cell = run.plan.cells.find(item => item.cellKey === record.cellKey);
    const result = (run.archived ? archivedMetricsDomain : domain).metrics(record.result, cell.policy, run.plan.experiment.referenceTimePolicy);
    metricsCache.set(record, result);
    return result;
  }
  function inspect(run, selection) {
    const { plan, records } = run;
    const byKey = new Map(records.map(record => [record.cellKey, record]));
    const scenarios = new Map(plan.experiment.scenarios.map(item => [item.id, item]));
    const comparisons = plan.comparisons.map((item, index) => ({ key: String(index), label: `${scenarios.get(item.scenarioId).name}${item.value === null ? '' : ` · ${plan.experiment.sweep.path}=${item.value}`}` }));
    const selectedIndex = Number(selection.comparisonKey);
    const selected = plan.comparisons[Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < plan.comparisons.length ? selectedIndex : 0];
    const baseline = byKey.get(selected.baselineKey), candidate = byKey.get(selected.candidateKey);
    const baselineMetrics = recordMetrics(run, baseline), candidateMetrics = recordMetrics(run, candidate);
    const comparison = baseline && candidate ? domain.compare(baseline, candidate) : null;
    const cycles = baseline?.result?.value?.cycles || candidate?.result?.value?.cycles || selected && plan.cells.find(item => item.cellKey === selected.baselineKey).request.cycles || 1;
    const deload = baseline?.result?.value?.deloadCycles || candidate?.result?.value?.deloadCycles || plan.cells.find(item => item.cellKey === selected.baselineKey).request.deloadCycles || [];
    const cycleIndex = Math.min(selection.cycleIndex || 1, cycles);
    const rowMap = new Map();
    for (const entry of plan.comparisons) {
      if (!rowMap.has(entry.value)) rowMap.set(entry.value, { value: entry.value, cases: [] });
      const a = byKey.get(entry.baselineKey), b = byKey.get(entry.candidateKey);
      if (!a || !b) continue;
      rowMap.get(entry.value).cases.push({ id: entry.scenarioId, baseline: a, candidate: b,
        baselineMetrics: recordMetrics(run, a), candidateMetrics: recordMetrics(run, b) });
    }
    const aggregates = domain.aggregate([...rowMap.values()], { cycleIndex, commonPopulation: plan.experiment.mode === 'sweep' });
    const aggregateRows = aggregates.flatMap(row => [
      { label: `${row.value === null ? t('Selected cohort') : `${plan.experiment.sweep.path}=${row.value}`} · ${t('comparable pairs')}`, value: `${row.comparablePairs}/${plan.caseCount}`, detail: `${t('Included cases')}: ${row.includedCaseIds.join(', ') || '—'}` },
      { label: tr('Pooled two-set share', 'Proporção agrupada com duas séries'), value: percent(row.pooledTwoSetShare) },
      { label: tr('Pooled RIR-0 share', 'Proporção agrupada com RIR 0'), value: percent(row.pooledRirZeroShare) },
      { label: tr('Mean paired common max-day delta (min)', 'Variação média pareada do maior dia no modelo comum (min)'), value: row.durationMeanPairedMaxDayMinutesDelta?.mean.toFixed(2) ?? null,
        detail: `${t('Outcomes')}: ${JSON.stringify(row.outcomes)} · ${t('Excluded cases')}: ${row.excluded.map(item => item.id).join(', ') || '—'}` },
    ]);
    const unchanged = comparison && !comparison.changes.length;
    const selectedBaseline = baselineMetrics?.cycles.find(item => item.cycleIndex === cycleIndex);
    const selectedCandidate = candidateMetrics?.cycles.find(item => item.cycleIndex === cycleIndex);
    const countShare = (count, denominator) => denominator === undefined ? '—' : percent({ numerator: count, denominator, fraction: denominator ? count / denominator : null });
    const rirKeys = [...new Set([...Object.keys(selectedBaseline?.rir.counts || {}), ...Object.keys(selectedCandidate?.rir.counts || {})])].sort((a, b) => Number(a) - Number(b));
    const setKeys = [...new Set([...Object.keys(selectedBaseline?.setCountHistogram || {}), ...Object.keys(selectedCandidate?.setCountHistogram || {})])].sort((a, b) => Number(a) - Number(b));

    return {
      comparisons, cycles: Array.from({ length: cycles }, (_, index) => ({ index: index + 1, deload: deload.includes(index + 1) })),
      baseline: baseline ? { ...baseline, archived: !!run.archived, metricRows: metricRows(baselineMetrics, cycleIndex) } : null,
      candidate: candidate ? { ...candidate, archived: !!run.archived, metricRows: metricRows(candidateMetrics, cycleIndex) } : null,
      changes: comparison?.changes || [], aggregateRows,
      metricDetails: { metricsVersion: D.METRICS_VERSION, selectedCycle: cycleIndex, baseline: selectedBaseline || null, candidate: selectedCandidate || null,
        attributedMuscleCountsOverlap: true, durationNote: tr('Allocation estimates precede final prescriptions; own/common estimates evaluate the selected realized cycle.', 'As estimativas de distribuição precedem as prescrições finais; os modelos próprio e comum avaliam o ciclo selecionado realizado.') },
      distributionTable: { caption: tr('Actual RIR distribution · numeric-set denominator', 'Distribuição real de RIR · denominador de séries com RIR numérico'), columns: ['RIR', tr('Baseline', 'Referência'), tr('Candidate', 'Candidata')],
        rows: [...rirKeys.map(key => [key, countShare(selectedBaseline?.rir.counts[key] || 0, selectedBaseline?.rir.zero.denominator), countShare(selectedCandidate?.rir.counts[key] || 0, selectedCandidate?.rir.zero.denominator)]), [t('Unspecified RIR'), selectedBaseline?.rir.unspecified ?? null, selectedCandidate?.rir.unspecified ?? null]] },
      setCountTable: { caption: tr('Sets per retained exercise occurrence · selected cycle', 'Séries por ocorrência de exercício mantida · ciclo selecionado'), columns: [tr('Sets', 'Séries'), tr('Baseline', 'Referência'), tr('Candidate', 'Candidata')],
        rows: setKeys.map(key => [key, countShare(selectedBaseline?.setCountHistogram[key] || 0, selectedBaseline?.twoSetShare.denominator), countShare(selectedCandidate?.setCountHistogram[key] || 0, selectedCandidate?.twoSetShare.denominator)]) },
      aggregateStrataTable: aggregates.some(row => row.mixedStrata) ? {
        caption: tr('Ordinary and deload strata · mixed totals are unavailable', 'Grupos normais e de deload · totais mistos indisponíveis'),
        columns: [tr('Value', 'Valor'), tr('Stratum', 'Grupo'), tr('Comparable cases', 'Casos comparáveis'), tr('Pooled two-set share', 'Proporção agrupada de duas séries'), tr('Pooled RIR-0 share', 'Proporção agrupada de RIR 0'), tr('Mean common max-day delta (min)', 'Variação média do maior dia no modelo comum (min)')],
        rows: aggregates.flatMap(row => Object.entries(row.strata).map(([stratum, data]) => [row.value ?? '—', t(stratum), data.comparablePairs, percent(data.pooledTwoSetShare), percent(data.pooledRirZeroShare), data.durationMeanPairedMaxDayMinutesDelta?.mean.toFixed(2) ?? null])),
      } : null,
      aggregateTable: plan.experiment.mode === 'sweep' ? {
        caption: tr('Sweep · shared successful population · selected cycle', 'Varredura · população comum com sucesso · ciclo selecionado'),
        columns: [tr('Value', 'Valor'), tr('Comparable / planned', 'Comparáveis / planejados'), tr('Outcomes', 'Resultados'), tr('Pooled two-set share', 'Proporção agrupada de duas séries'), tr('Pooled RIR-0 share', 'Proporção agrupada de RIR 0'), tr('Common max-day delta (min): mean [range]', 'Variação do maior dia no modelo comum (min): média [intervalo]'), tr('Mean working-set change', 'Variação média de séries')],
        rows: aggregates.map(row => [row.value, `${row.comparablePairs}/${plan.caseCount}`, JSON.stringify(row.outcomes), percent(row.pooledTwoSetShare), percent(row.pooledRirZeroShare), row.durationMeanPairedMaxDayMinutesDelta ? `${row.durationMeanPairedMaxDayMinutesDelta.mean.toFixed(2)} [${row.durationMeanPairedMaxDayMinutesDelta.min.toFixed(2)}, ${row.durationMeanPairedMaxDayMinutesDelta.max.toFixed(2)}]` : null, row.meanWorkingSetDelta]),
      } : null,
      metricRows: comparison ? [{ label: tr('Baseline outcome', 'Resultado da referência'), value: t(comparison.baselineOutcome) }, { label: tr('Candidate outcome', 'Resultado da candidata'), value: t(comparison.candidateOutcome) }, { label: tr('Semantic changes (all cycles)', 'Alterações semânticas (todos os ciclos)'), value: comparison.changes.length } ] : [],
      notice: run.archived ? t('Archived result: exact replay and original-build duration estimates are unavailable on this build.') : unchanged && fingerprint(plan.experiment.baselinePolicy.timeModel) !== fingerprint(plan.experiment.candidatePolicy.timeModel) ? t('Prescriptions unchanged; duration model changed.') : null,
      diagnostics: { baseline: baseline?.result?.diagnostics || null, candidate: candidate?.result?.diagnostics || null,
        fittingEstimate: { baseline: baselineMetrics?.fittingEstimate || null, candidate: candidateMetrics?.fittingEstimate || null },
        provenanceChanges: comparison?.provenanceChanges || [], aggregation: aggregates },
    };
  }
  async function initialize() {
    Policy = root.RepForgeEnginePolicy; Compiler = root.RepForgeProgramCompiler; Adapter = root.RepForgeProgramEntryAdapter;
    Engine = root.RepForgeProgramEngine; D = root.ProgramLabDomain;
    if (!Policy || !Compiler || !Adapter || !Engine || !D || !root.ProgramLabStore || !root.ProgramLabArchiveWorker) throw issue('artifact_incomplete', t('Shared lab modules are unavailable. Assemble the complete standalone artifact.'));
    manifest = await getJSON('programlab/build-manifest.json');
    await verifyManifest(manifest);
    await root.RepForgeExerciseCatalog.load(); catalog = root.RepForgeExerciseCatalog.snapshot();
    metadata = Policy.getEnginePolicyMetadata();
    const factory = await import(new URL('programlab/corpus-cases.mjs', document.baseURI).href);
    corpus = factory.corpusCases({ Adapter, Catalog: catalog });
    domain = D.create({ normalizePolicy: Policy.normalizeEnginePolicy, normalizeRequest: request => Compiler.normalizeProgramRequest(request, catalog),
      estimateDaySeconds: (day, cycle, enginePolicy) => Compiler.estimateDaySeconds(day, cycle, catalog, { enginePolicy }),
      sweepPaths: metadata.fields.map(field => field.path) });
    archivedMetricsDomain = D.create({ estimateDaySeconds: () => NaN });
    try { db = await root.ProgramLabStore.open(); await db.recoverInterrupted(); } catch (error) { storageError = error; db = null; }
    runner = D.createRunner({ store: db, createExecutor: () => Engine.create({ compiler: Compiler, catalog: () => catalog, allowMainThreadFallback: false,
      worker: { url: new URL(manifest.worker.url, document.baseURI).href, scripts: manifest.worker.scripts.map(name => new URL(name, document.baseURI).href), catalogSha256: manifest.catalogSha256 } }) });
    return {
      manifest, defaultPolicy: Policy.getDefaultEnginePolicy(), configuration: configuration(), seedMode: 'canonical',
      exerciseLabels: Object.fromEntries(catalog.exercises.map(item => [item.id, item.name])),
      policyFields: metadata.fields.map(field => ({ ...field, group: fieldGroup(field.path), step: field.integer ? 1 : 'any',
        description: `${field.dependency || ''}${field.nullable ? ' Leave blank to preserve recovered rest.' : ''}`, label: `${field.label} · ${field.path.split('.').slice(0, -1).join(' / ')}` })),
      scenarioFields: [
        { path: 'desiredResult', label: tr('Goal', 'Objetivo'), type: 'string', values: [{ value: 'muscle_growth', label: tr('Hypertrophy', 'Hipertrofia') }, { value: 'strength', label: tr('Strength', 'Força') }, { value: 'balanced', label: tr('Hybrid', 'Híbrido') }] },
        { path: 'structuredExperience', label: tr('Experience', 'Experiência'), type: 'string', values: [{ value: 'first', label: tr('Beginner', 'Iniciante') }, { value: '6_to_24m', label: tr('Intermediate', 'Intermediário') }, { value: 'over_24m', label: tr('Advanced', 'Avançado') }] },
        { path: 'daysPerWeek', label: tr('Training days per week', 'Dias de treino por semana'), values: [2, 3, 4, 5, 6] },
        { path: 'sessionMinutes', label: tr('Session ceiling (minutes)', 'Limite da sessão (minutos)'), values: Compiler.TIME_CEILINGS },
        { path: 'environment.kind', label: tr('Equipment preset', 'Predefinição de equipamento'), type: 'string', values: ['limited_home', 'full_home', 'basic_gym', 'commercial_gym'] },
        { path: 'splitPreference', label: tr('Split preference', 'Preferência de divisão'), type: 'string', values: ['auto', ...Object.keys(Compiler.SPLITS)] },
        { path: 'block.periodization', label: tr('Periodization', 'Periodização'), type: 'string', values: Compiler.PERIODIZATIONS },
        { path: 'deload', label: tr('Final deload cycle', 'Ciclo final de deload'), type: 'boolean' },
        ...Object.keys(answers().competencyAnswers).map(path => ({ path: `competencyAnswers.${path}`, label: path, type: 'boolean' })),
      ],
      fixtures: ['anchor-4day', 'anchor-beginner', 'anchor-deload', 'anchor-focus', 'budget-40', 'restricted-home', 'three-day', 'production-answers', 'compiler-corpus'].map(id => ({ id, label: id === 'compiler-corpus' ? tr('Current compiler corpus · 180 cases', 'Corpus atual do compilador · 180 casos') : fixture(id).name })),
      presets: [
        { id: 'bundled_default', label: tr('Bundled production default', 'Padrão de produção incluído'), description: tr('Restore the exact bundled policy.', 'Restaura a política incluída, sem alterações.') },
        { id: 'two_sets_low_rir@1', label: tr('Two sets · low RIR', 'Duas séries · RIR baixo'), description: tr('Three role overrides: two sets. Compound RIR base: one; assistance: zero. Recovered ordinal, allocation and deload rules still apply.', 'Três substituições por função: duas séries. RIR base dos compostos: um; dos acessórios: zero. As regras recuperadas de ordem, distribuição e deload continuam valendo.') },
        { id: 'two_sets_zero_rir@1', label: tr('Two sets · zero ordinary RIR', 'Duas séries · RIR normal zero'), description: tr('Two-set overrides; every role RIR base and ordinal adjustment becomes zero. Beginner and deload modifiers still apply.', 'Substitui as contagens por duas séries; todas as bases e ajustes de RIR passam a zero. Os modificadores de iniciante e deload continuam valendo.') },
      ],
      bulkEdits: [
        { id: 'base_sets_two', label: tr('All role overrides to two', 'Todas as funções com duas séries'), description: tr('Changes only the three role-count overrides.', 'Altera apenas as três substituições de contagem por função.'), paths: metadata.fields.filter(field => field.path.startsWith('volume.setsByType.')).map(field => field.path) },
        { id: 'base_rir_zero', label: tr('All RIR bases to zero', 'Todas as bases de RIR em zero'), description: tr('Changes every role base; ordinal and modifier rules stay visible.', 'Altera a base de cada função; as regras de ordem e modificadores continuam visíveis.'), paths: metadata.fields.filter(field => field.path.startsWith('prescription.baseRirByClass.')).map(field => field.path) },
      ],
    };
  }
  async function run(configuration, options) {
    const planned = await revisionPlan(configuration);
    const result = await runner.run(planned, { ...options, onProgress: state => {
      const next = planned.cells[Math.min(state.completed, planned.cells.length - 1)];
      const comparison = planned.comparisons.find(item => item.baselineKey === next.cellKey || item.candidateKey === next.cellKey);
      const scenario = planned.experiment.scenarios.find(item => item.id === comparison.scenarioId);
      options.onProgress?.({ status: state.status, completed: state.completed, total: state.total, caseName: scenario.name });
    } });
    return result;
  }
  async function save(configuration) {
    if (!db) throw issue('persistence_failed', storageError?.message || t('Lab storage is unavailable.'));
    const planned = await revisionPlan(configuration);
    await db.saveExperiment(planned.experiment);
    return { id: planned.experiment.experimentId, revision: planned.experiment.revision };
  }
  async function list() {
    if (!db) return [];
    const revisions = await db.listExperiments();
    const latest = new Map();
    for (const revision of revisions) if (!latest.has(revision.experimentId) || latest.get(revision.experimentId).revision < revision.revision) latest.set(revision.experimentId, revision);
    return [...latest.values()].map(item => ({ id: item.experimentId, name: item.name }));
  }
  async function load(id) {
    if (!db) throw issue('persistence_failed', t('Lab storage is unavailable.'));
    const experiment = await db.loadExperiment(id);
    if (!experiment) throw issue('not_found', t('Saved experiment not found.'));
    let run = null;
    if (db.listRuns) {
      const runs = await db.listRuns(id, experiment.revision);
      if (runs.length) run = await db.loadRun(runs[0].runId);
    }
    return { configuration: experiment, revision: experiment.revision, run };
  }
  async function archiveOperation(action) {
    if (activeArchive) throw issue('archive_active', t('An archive operation is already active.'));
    const client = root.ProgramLabArchiveWorker.createClient({ workerURL: new URL(manifest.archiveWorker.url, document.baseURI).href });
    activeArchive = client;
    try { return await action(client); }
    finally { client.dispose(); if (activeArchive === client) activeArchive = null; }
  }
  root.RepForgeProgramLabServices = Object.freeze({ initialize, fixture, normalizeScenario,
    scenarioIdentity: (scenario, { archived = false } = {}) => archived ? D.digest(scenario.request) : Compiler.generationIdentity(scenario.request, catalog),
    adoptCurrentBuild: (configuration, run) => {
      const candidate = Policy.normalizeEnginePolicy(configuration.candidatePolicy);
      if (!candidate.ok) throw Object.assign(issue('invalid_engine_policy', t('Review the candidate policy for this build.')), { issues: candidate.issues });
      return { ...copy(configuration), experimentId: crypto.randomUUID(), revision: 1, baselinePolicy: Policy.getDefaultEnginePolicy(), referenceTimePolicy: Policy.getDefaultEnginePolicy(), candidatePolicy: candidate.value,
        provenance: { ...configuration.provenance, parentExperimentId: configuration.experimentId, parentRevision: configuration.revision, sourceBuild: run.plan.build },
        scenarios: configuration.scenarios.map(scenario => { const request = copy(scenario.request); delete request.seed; return normalizeScenario({ ...scenario, request, inputMode: 'canonical' }); }) };
    },
    duplicateScenario: scenario => normalizeScenario({ ...scenario, id: crypto.randomUUID(), name: `${scenario.name} · ${t('copy')}` }),
    applyPreset: id => transformed(id, id === 'bundled_default' ? undefined : Policy.getDefaultEnginePolicy()),
    bulkEdit: (operation, source) => {
      const policy = copy(source);
      if (operation === 'base_sets_two') for (const key of Object.keys(policy.volume.setsByType)) policy.volume.setsByType[key] = 2;
      else if (operation === 'base_rir_zero') for (const key of metadata.repClasses) policy.prescription.baseRirByClass[key] = 0;
      else throw issue('unknown_bulk_edit', 'Unknown bulk operation');
      return policy;
    },
    validate: configuration => { try { makePlan(configuration); return { ok: true, issues: [] }; } catch (error) { return { ok: false, issues: error.issues?.length ? error.issues : [{ path: '', code: error.code, message: error.message }] }; } },
    listRuns: id => db ? db.listRuns(id) : [],
    loadRun: async id => {
      const run = await db?.loadRun(id);
      if (!run) throw issue('not_found', t('Saved run not found.'));
      return { configuration: run.plan.experiment, revision: run.plan.experiment.revision, run };
    },
    plan: configuration => makePlan(configuration), run, cancel: async () => { activeArchive?.dispose(); activeArchive = null; await runner.cancel(); }, inspect, save, list, load,
    exportArchive: async (configuration, run) => {
      const experiment = run ? run.plan.experiment : (await revisionPlan(configuration)).experiment;
      return archiveOperation(client => client.exportArchive(experiment, run, build()));
    },
    importArchive: async files => {
      if (!db) throw issue('persistence_failed', t('Lab storage is unavailable.'));
      const validated = await archiveOperation(client => client.importArchive(files, build()));
      const imported = await db.importArchive(validated);
      return { configuration: imported.experiment, run: imported.run, archived: imported.archived };
    },
  });
})(globalThis);
