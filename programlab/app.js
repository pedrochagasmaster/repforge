/* Program Lab DOM owner. All validation, policy transformations, planning,
   execution, comparison and storage belong to the injected shared services.
   See RepForgeProgramLabUI.connect below for the single integration seam. */
(function attachProgramLabUI(root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => structuredClone(value);
  const json = value => JSON.stringify(value, null, 2);
  const text = (tag, value, className) => {
    const element = document.createElement(tag);
    element.textContent = String(value ?? '');
    if (className) element.className = className;
    return element;
  };
  const option = (value, label) => Object.assign(document.createElement('option'), { value, textContent: label });
  const at = (value, path) => path.split('.').reduce((entry, key) => entry?.[key], value);
  function assign(value, path, next) {
    const keys = path.split('.');
    if (keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Unsupported field path');
    const last = keys.pop();
    const parent = keys.reduce((entry, key) => entry[key], value);
    parent[last] = next;
  }
  let services, definitions, draft, selectedScenario = 0, run = null, active = false;
  let savedIdentity = null, plan = null, validationToken = 0, runToken = 0, viewToken = 0, selectedView = null, dirty = false;
  const policyInputs = new Map();
  const scenarioInputs = new Map();
  const pendingScenarioEdits = new Set();
  const buttons = ['save', 'export', 'fixture', 'applyPreset', 'preset', 'updateScenario', 'duplicateScenario', 'moveUp', 'moveDown', 'removeScenario', 'applyCanonical', 'resetPolicy'];

  function errorMessage(error) { return String(error?.message || error); }
  function showError(error) {
    $('fatalError').hidden = false;
    $('fatalError').textContent = errorMessage(error);
  }
  function guard(action) {
    return async event => {
      try { await action(event); }
      catch (error) { showError(error); }
    };
  }
  function markDirty() {
    dirty = true;
    $('persistenceStatus').textContent = 'Unsaved changes';
    $('inputsChanged').hidden = !run;
    validate();
  }
  function setBusy(value) {
    active = value;
    for (const id of buttons) $(id).disabled = value;
    $('cancel').disabled = !value;
    $('run').disabled = value || !plan;
    $('load').disabled = value || !$('savedExperiments').value;
    $('importFiles').disabled = value;
    document.querySelectorAll('[data-mode], #scenarioControls input, #scenarioControls select, #scenarioControls textarea, #policyControls input, #policyControls select, #bulkActions button, #sweepControls input, #sweepControls select').forEach(control => { control.disabled = value; });
    $('experimentName').disabled = value;
    $('experimentNotes').disabled = value;
    $('seed').disabled = value;
    $('scenarioName').disabled = value;
    $('canonicalRequest').disabled = value;
  }
  function readConfiguration() {
    if (pendingScenarioEdits.size) throw new Error('Apply or replace the pending scenario edits before saving, exporting or running.');
    const configuration = clone(draft);
    configuration.name = $('experimentName').value;
    configuration.notes = $('experimentNotes').value;
    if (configuration.mode === 'single') configuration.scenarios = [configuration.scenarios[selectedScenario]];
    if (configuration.mode === 'sweep') {
      const raw = $('sweepValues').value.split(',').map(value => value.trim());
      if (!raw.length || raw.some(value => !value)) throw new Error('Enter explicit numeric sweep values separated by commas.');
      const values = raw.map(Number);
      if (values.some(value => !Number.isFinite(value))) throw new Error('Sweep values must be finite numbers.');
      configuration.sweep = { path: $('sweepPath').value, values };
    } else configuration.sweep = null;
    return configuration;
  }
  function presentIssues(issues) {
    $('validation').replaceChildren();
    for (const { input, message } of policyInputs.values()) {
      input.removeAttribute('aria-invalid');
      message.textContent = '';
    }
    for (const issue of issues) {
      const path = issue.path || issue.field || '';
      const label = issue.message || issue.code || String(issue);
      $('validation').append(text('p', `${path ? `${path}: ` : ''}${label}`));
      const field = policyInputs.get(path.replace(/^candidatePolicy\./, ''));
      if (field) {
        field.input.setAttribute('aria-invalid', 'true');
        field.message.textContent = label;
      }
    }
  }
  async function validate() {
    if (!services || active) return;
    const token = ++validationToken;
    plan = null;
    $('run').disabled = true;
    try {
      const configuration = readConfiguration();
      const validation = await services.validate(configuration);
      if (token !== validationToken) return;
      presentIssues(validation.issues || []);
      if (!validation.ok) { $('planSummary').textContent = 'Resolve input errors before running.'; return; }
      const planned = await services.plan(configuration);
      if (token !== validationToken) return;
      plan = planned;
      $('planSummary').textContent = `${planned.caseCount} scenario/seed pairs · ${planned.cellCount} compiler cells · ${planned.baselineReuse || 0} baseline reuses`;
      $('run').disabled = false;
    } catch (error) {
      if (token !== validationToken) return;
      presentIssues([{ message: errorMessage(error) }]);
      $('planSummary').textContent = 'Unable to plan this draft.';
    }
  }

  function createInput(field, value, onChange) {
    let input;
    const choices = field.values || field.options;
    if (choices) {
      input = document.createElement('select');
      for (const choice of choices) {
        const item = typeof choice === 'object' ? choice : { value: choice, label: String(choice) };
        input.append(option(String(item.value), item.label));
      }
      input.value = String(value);
    } else if (field.type === 'boolean' || typeof value === 'boolean') {
      input = Object.assign(document.createElement('input'), { type: 'checkbox', checked: value });
    } else {
      input = Object.assign(document.createElement('input'), { type: field.type === 'string' ? 'text' : 'number', value: value ?? '' });
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (input.type === 'number') input.step = String(field.step ?? 1);
    }
    input.addEventListener('change', () => {
      let next;
      if (input.type === 'checkbox') next = input.checked;
      else if (field.type === 'string' || typeof value === 'string') next = input.value;
      else next = input.value === '' ? null : Number(input.value);
      onChange(next);
    });
    return input;
  }
  function renderPolicy() {
    policyInputs.clear();
    $('policyControls').replaceChildren();
    $('sweepPath').replaceChildren();
    const groups = new Map();
    for (const field of definitions.policyFields) {
      const groupName = field.group || 'Policy';
      if (!groups.has(groupName)) {
        const details = document.createElement('details');
        details.open = groups.size < 2;
        details.append(text('summary', groupName));
        groups.set(groupName, details);
        $('policyControls').append(details);
      }
      const row = text('div', '', 'policy-row');
      const index = policyInputs.size;
      const id = `policy-${index}`;
      const label = text('label', field.label || field.path);
      label.htmlFor = id;
      const values = text('div', '', 'policy-values');
      values.append(text('span', at(definitions.defaultPolicy, field.path), 'baseline'));
      const input = createInput(field, at(draft.candidatePolicy, field.path), next => {
        assign(draft.candidatePolicy, field.path, next);
        markDirty();
      });
      input.id = id;
      input.dataset.policyPath = field.path;
      const reset = text('button', 'Reset');
      reset.type = 'button';
      reset.setAttribute('aria-label', `Reset ${field.label || field.path} to baseline`);
      reset.addEventListener('click', () => {
        assign(draft.candidatePolicy, field.path, clone(at(definitions.defaultPolicy, field.path)));
        renderPolicy();
        markDirty();
        policyInputs.get(field.path)?.input.focus();
      });
      values.append(input, reset);
      const hint = text('p', [field.unit, field.description, ...(field.dependencies || [])].filter(Boolean).join(' · '), 'hint');
      hint.id = `${id}-hint`;
      const message = text('p', '', 'field-error');
      message.id = `${id}-error`;
      input.setAttribute('aria-describedby', `${hint.id} ${message.id}`);
      row.append(label, values, hint, text('p', field.path, 'policy-path'), message);
      groups.get(groupName).append(row);
      policyInputs.set(field.path, { input, message });
      if (field.sweepable !== false && typeof at(definitions.defaultPolicy, field.path) === 'number') $('sweepPath').append(option(field.path, `${field.label || field.path} (${field.path})`));
    }
    if (draft.sweep) { $('sweepPath').value = draft.sweep.path; $('sweepValues').value = draft.sweep.values.join(', '); }
  }
  function renderScenarios() {
    $('caseList').replaceChildren(...draft.scenarios.map((scenario, index) => option(String(index), `${index + 1}. ${scenario.name || scenario.key}`)));
    $('caseList').value = String(selectedScenario);
    const scenario = draft.scenarios[selectedScenario];
    $('scenarioName').value = scenario.name || scenario.key;
    $('seed').value = scenario.seed;
    $('seed').readOnly = definitions.seedMode !== 'explicit';
    $('seed').setAttribute('aria-label', definitions.seedMode === 'explicit' ? 'Execution seed' : 'Canonical generation identity');
    $('canonicalRequest').value = json(scenario.request);
    $('normalizedRequest').textContent = json(scenario.request);
    $('scenarioControls').replaceChildren();
    scenarioInputs.clear();
    if (scenario.inputMode === 'canonical' || !scenario.answers) {
      $('scenarioControls').append(text('p', 'Canonical input · use the advanced request editor to change this scenario.', 'hint'));
      return;
    }
    for (const [index, field] of (definitions.scenarioFields || []).entries()) {
      const label = text('label', field.label || field.path);
      const input = createInput(field, at(scenario.answers, field.path), next => {
        const current = draft.scenarios[selectedScenario];
        assign(current.answers, field.path, next);
        pendingScenarioEdits.add(current.key);
        $('run').disabled = true;
        plan = null;
        $('planSummary').textContent = 'Apply scenario edits to validate the mapped request.';
        dirty = true;
        $('persistenceStatus').textContent = 'Unapplied scenario changes';
      });
      input.id = `scenario-${index}`;
      label.htmlFor = input.id;
      label.append(input);
      $('scenarioControls').append(label);
      scenarioInputs.set(field.path, input);
    }
  }
  function renderDraft(configuration) {
    draft = clone(configuration);
    pendingScenarioEdits.clear();
    selectedScenario = Math.min(selectedScenario, draft.scenarios.length - 1);
    $('experimentName').value = draft.name;
    $('experimentNotes').value = draft.notes || '';
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === draft.mode)));
    $('sweepControls').hidden = draft.mode !== 'sweep';
    renderScenarios();
    renderPolicy();
    validate();
  }

  function metrics(container, rows) {
    if (!rows?.length) return;
    const grid = text('div', '', 'metrics');
    for (const row of rows) {
      const metric = text('div', '', 'metric');
      metric.append(text('strong', row.value === null ? 'Unavailable' : row.value), text('span', row.label));
      if (row.detail) metric.append(text('p', row.detail, 'hint'));
      grid.append(metric);
    }
    container.append(grid);
  }
  function renderProgram(container, cell, cycle, changedLineages = []) {
    container.replaceChildren();
    if (!cell) { container.append(text('p', 'Not executed', 'hint')); return; }
    const result = cell.result;
    if (!result?.ok) {
      container.append(text('p', cell.outcome || (result ? 'Domain conflict' : 'Execution error'), 'field-error'), text('pre', json(result || cell.error)));
      return;
    }
    metrics(container, cell.metricRows);
    const program = result.value;
    for (const day of program.days || []) {
      const dayNode = text('section', '', 'day');
      dayNode.append(text('h3', `${day.name}${day.kind === 'rest' ? ' · rest' : ''}`));
      for (const slot of day.slots || []) {
        const slotNode = text('div', '', `slot${changedLineages.includes(slot.id) ? ' changed' : ''}`);
        const name = cell.exerciseLabels?.[slot.exerciseId] || (!cell.archived && definitions.exerciseLabels?.[slot.exerciseId]) || slot.exerciseId;
        slotNode.append(text('p', name), text('p', `${slot.role || ''} · ${slot.executionMode || 'unspecified execution'}`, 'hint'));
        const list = text('ol', '', 'sets');
        const sets = slot.prescriptionsByCycle?.find(item => item.cycleIndex === cycle)?.sets || [];
        for (const [index, set] of sets.entries()) {
          const targets = Object.entries(set.targets || {}).map(([key, target]) => `${key} ${typeof target === 'object' ? `${target.min ?? '?'}–${target.max ?? '?'}` : target}`).join(' · ');
          list.append(text('li', `${index + 1}. ${targets || 'Manual targets'} · RIR ${set.rir ?? 'unspecified'} · rest ${set.restSeconds === null ? 'unspecified' : `${set.restSeconds}s`}${set.status === 'manual' ? ' · manual' : ''}`));
        }
        slotNode.append(list);
        dayNode.append(slotNode);
      }
      container.append(dayNode);
    }
  }
  async function renderResult() {
    if (!run) return;
    const token = ++viewToken;
    const view = await services.inspect(run, { comparisonKey: $('resultCase').value || null, cycleIndex: Number($('cycle').value || 1) });
    if (token !== viewToken) return;
    selectedView = view;
    const previous = $('resultCase').value;
    $('resultCase').replaceChildren(...view.comparisons.map(item => option(item.key, item.label)));
    if (view.comparisons.some(item => item.key === previous)) $('resultCase').value = previous;
    $('resultCase').disabled = !view.comparisons.length;
    const cycle = Number($('cycle').value || 1);
    $('cycle').replaceChildren(...view.cycles.map(item => option(String(item.index), `Cycle ${item.index}${item.deload ? ' · deload' : ' · ordinary'}`)));
    $('cycle').value = String(view.cycles.some(item => item.index === cycle) ? cycle : view.cycles[0]?.index || 1);
    $('cycle').disabled = !view.cycles.length;
    $('cycleStatus').textContent = view.cycleLabel || '';
    $('resultSnapshot').textContent = `Run ${run.runId} · ${run.status} · snapshot ${run.revision ?? run.configuration?.revision ?? 'embedded'}`;
    $('aggregateSummary').replaceChildren();
    metrics($('aggregateSummary'), view.aggregateRows);
    $('comparisonSummary').replaceChildren();
    metrics($('comparisonSummary'), view.metricRows);
    if (view.notice) $('comparisonSummary').append(text('p', view.notice, 'badge'));
    renderProgram($('baselineProgram'), view.baseline, Number($('cycle').value), view.baselineChangedSlotIds);
    renderProgram($('candidateProgram'), view.candidate, Number($('cycle').value), view.candidateChangedSlotIds);
    $('semanticChanges').replaceChildren();
    for (const change of view.changes || []) $('semanticChanges').append(text('p', typeof change === 'string' ? change : json(change), 'hint'));
    if (!view.changes?.length) $('semanticChanges').append(text('p', 'No semantic prescription changes in this comparison.', 'hint'));
    $('diagnostics').textContent = json(view.diagnostics || { baseline: view.baseline?.result?.diagnostics, candidate: view.candidate?.result?.diagnostics });
    $('rawResult').textContent = '';
    renderRaw();
  }
  function renderRaw() {
    if (!$('rawDetails').open || !run || !selectedView) return;
    $('rawResult').textContent = json({ runId: run.runId, revision: run.revision, status: run.status,
      configuration: run.configuration, baseline: selectedView.baseline, candidate: selectedView.candidate,
      changes: selectedView.changes });
  }
  function clearResult() {
    selectedView = null;
    for (const id of ['baselineProgram', 'candidateProgram', 'aggregateSummary', 'comparisonSummary', 'semanticChanges', 'diagnostics', 'rawResult']) $(id).replaceChildren();
    $('resultSnapshot').textContent = 'This configuration has no saved execution snapshot.';
    $('resultCase').replaceChildren(option('', 'No results yet'));
    $('resultCase').disabled = true;
    $('cycle').disabled = true;
    $('cycleStatus').textContent = '';
  }
  async function refreshSaved() {
    const selected = $('savedExperiments').value;
    const items = await services.list();
    $('savedExperiments').replaceChildren(option('', 'Choose an experiment'), ...items.map(item => option(item.id, item.name)));
    if (items.some(item => item.id === selected)) $('savedExperiments').value = selected;
    $('load').disabled = active || !$('savedExperiments').value;
  }
  async function save() {
    const record = await services.save(readConfiguration(), run);
    savedIdentity = record;
    dirty = false;
    $('persistenceStatus').textContent = `Saved · revision ${record.revision}`;
    await refreshSaved();
    if (record.id) $('savedExperiments').value = record.id;
    $('load').disabled = false;
  }
  async function execute(allowUnsaved = false) {
    const configuration = readConfiguration();
    const validated = await services.validate(configuration);
    if (!validated.ok) { presentIssues(validated.issues); return; }
    ++validationToken;
    const token = ++runToken;
    $('fatalError').hidden = true;
    $('runUnsaved').hidden = true;
    $('inputsChanged').hidden = true;
    $('runStatus').textContent = 'validating';
    setBusy(true);
    try {
      const result = await services.run(configuration, {
        allowUnsaved,
        onProgress: update => {
          if (token !== runToken) return;
          $('runStatus').textContent = `${update.status} · ${update.completed}/${update.total} cells${update.caseName ? ` · ${update.caseName}` : ''}`;
          $('progress').max = Math.max(1, update.total);
          $('progress').value = update.completed;
        },
      });
      if (token !== runToken) return;
      run = result;
      $('runStatus').textContent = `${result.status} · ${result.completed}/${result.total} cells`;
      $('persistenceStatus').textContent = result.persisted === false ? 'Unsaved run · export remains available' : 'Saved run snapshot';
      dirty = false;
      await renderResult();
      await refreshSaved();
    } catch (error) {
      if (token !== runToken) return;
      showError(error);
      $('runStatus').textContent = 'failed';
      if (error.code === 'persistence_failed') $('runUnsaved').hidden = false;
    } finally {
      if (token === runToken) { setBusy(false); await validate(); }
    }
  }
  function wire() {
    $('experimentName').addEventListener('input', markDirty);
    $('experimentNotes').addEventListener('input', markDirty);
    $('scenarioName').addEventListener('change', () => { draft.scenarios[selectedScenario].name = $('scenarioName').value; renderScenarios(); markDirty(); });
    $('seed').addEventListener('change', guard(async () => {
      draft.scenarios[selectedScenario] = await services.normalizeScenario({ ...draft.scenarios[selectedScenario], seed: $('seed').value });
      renderScenarios(); markDirty();
    }));
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      draft.mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.mode === draft.mode)));
      $('sweepControls').hidden = draft.mode !== 'sweep';
      markDirty();
    }));
    $('fixture').addEventListener('change', guard(async () => {
      const fixture = await services.fixture($('fixture').value);
      const scenarios = Array.isArray(fixture) ? fixture : [fixture];
      draft.scenarios = draft.mode === 'single' ? [scenarios[0]] : scenarios;
      pendingScenarioEdits.clear(); selectedScenario = 0; renderScenarios(); markDirty();
    }));
    $('caseList').addEventListener('change', () => { selectedScenario = Number($('caseList').value); renderScenarios(); validate(); });
    $('updateScenario').addEventListener('click', guard(async () => {
      draft.scenarios[selectedScenario] = await services.normalizeScenario({ ...draft.scenarios[selectedScenario], inputMode: 'answers' });
      pendingScenarioEdits.delete(draft.scenarios[selectedScenario].key);
      renderScenarios(); markDirty();
    }));
    $('applyCanonical').addEventListener('click', guard(async () => {
      draft.scenarios[selectedScenario] = await services.normalizeScenario({ ...draft.scenarios[selectedScenario], request: JSON.parse($('canonicalRequest').value), inputMode: 'canonical' });
      pendingScenarioEdits.delete(draft.scenarios[selectedScenario].key);
      renderScenarios(); markDirty();
    }));
    $('duplicateScenario').addEventListener('click', guard(async () => {
      const duplicate = await services.duplicateScenario(draft.scenarios[selectedScenario]);
      draft.scenarios.splice(selectedScenario + 1, 0, duplicate); selectedScenario++; renderScenarios(); markDirty();
    }));
    for (const [id, delta] of [['moveUp', -1], ['moveDown', 1]]) $(id).addEventListener('click', () => {
      const target = selectedScenario + delta;
      if (target < 0 || target >= draft.scenarios.length) return;
      [draft.scenarios[target], draft.scenarios[selectedScenario]] = [draft.scenarios[selectedScenario], draft.scenarios[target]];
      selectedScenario = target; renderScenarios(); markDirty();
    });
    $('removeScenario').addEventListener('click', () => {
      if (draft.scenarios.length < 2) return;
      draft.scenarios.splice(selectedScenario, 1); selectedScenario = Math.min(selectedScenario, draft.scenarios.length - 1); renderScenarios(); markDirty();
    });
    $('applyPreset').addEventListener('click', guard(async () => {
      const preset = definitions.presets.find(item => item.id === $('preset').value);
      draft.candidatePolicy = await services.applyPreset(preset.id, draft.candidatePolicy);
      $('presetDescription').textContent = preset.description;
      renderPolicy(); markDirty();
    }));
    for (const operation of definitions.bulkEdits || []) {
      const description = text('p', `${operation.description} Fields: ${operation.paths.join(', ')}`, 'hint');
      const button = text('button', operation.label);
      button.addEventListener('click', guard(async () => {
        draft.candidatePolicy = await services.bulkEdit(operation.id, draft.candidatePolicy); renderPolicy(); markDirty();
      }));
      $('bulkActions').append(description, button);
    }
    $('resetPolicy').addEventListener('click', () => { draft.candidatePolicy = clone(definitions.defaultPolicy); renderPolicy(); markDirty(); });
    $('sweepPath').addEventListener('change', markDirty);
    $('sweepValues').addEventListener('input', markDirty);
    $('run').addEventListener('click', guard(() => execute()));
    $('runUnsaved').addEventListener('click', guard(() => execute(true)));
    $('cancel').addEventListener('click', guard(async () => { $('cancel').disabled = true; $('runStatus').textContent = 'Canceling active worker…'; await services.cancel(); }));
    $('save').addEventListener('click', guard(save));
    $('savedExperiments').addEventListener('change', () => { $('load').disabled = active || !$('savedExperiments').value; });
    $('load').addEventListener('click', guard(async () => {
      const record = await services.load($('savedExperiments').value);
      savedIdentity = record; run = record.run || null; runToken++; renderDraft(record.configuration);
      dirty = false; $('inputsChanged').hidden = true; $('persistenceStatus').textContent = `Saved · revision ${record.revision}`;
      if (run) await renderResult(); else clearResult();
    }));
    $('export').addEventListener('click', guard(async () => {
      const parts = await services.exportArchive(readConfiguration(), run);
      for (const part of parts) {
        const blob = part.blob || new Blob([part.text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), { href: url, download: part.name });
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      $('persistenceStatus').textContent = `Exported ${parts.length} archive part${parts.length === 1 ? '' : 's'}`;
    }));
    $('importFiles').addEventListener('change', guard(async () => {
      const files = [...$('importFiles').files];
      if (!files.length) return;
      try {
        const record = await services.importArchive(files);
        run = record.run || null; runToken++; renderDraft(record.configuration); dirty = false;
        $('inputsChanged').hidden = true; $('persistenceStatus').textContent = record.archived ? 'Imported archived result · exact replay unavailable on this build' : 'Imported experiment';
        if (run) await renderResult(); else clearResult();
        await refreshSaved();
      } finally { $('importFiles').value = ''; }
    }));
    $('rawDetails').addEventListener('toggle', renderRaw);
    $('resultCase').addEventListener('change', guard(renderResult));
    $('cycle').addEventListener('change', guard(renderResult));
  }

  /** The UI adapter contract deliberately contains no engine/persistence logic.
   * initialize() -> { manifest, defaultPolicy, policyFields[], presets[], fixtures[],
   *   scenarioFields[], configuration, exerciseLabels? }
   * validate(config) -> {ok,issues:[{path,code,message}]}; plan(config) ->
   *   {caseCount,cellCount,baselineReuse}; fixture(id) -> scenario | scenario[];
   * normalizeScenario(scenario), duplicateScenario(scenario), applyPreset(id,policy),
   * bulkEdit(operation,policy) -> detached validated data.
   * run(config,{allowUnsaved,onProgress}) -> frozen run; cancel() terminates worker.
   * inspect(run,{comparisonKey,cycleIndex}) -> {comparisons:[{key,label}],
   *   cycles:[{index,deload}], baseline:{result,metricRows?,exerciseLabels?},
   *   candidate:{result,metricRows?,exerciseLabels?}, changes[], metricRows?,
   *   aggregateRows?, diagnostics?, notice?, cycleLabel?, *ChangedSlotIds?}.
   * list() -> [{id,name}]; save(config,run) -> {id,revision}; load(id) ->
   *   {configuration,run,revision}; exportArchive(config,run) -> [{name,blob|text}];
   * importArchive(File[]) -> {configuration,run,archived?}. Import validates off-thread.
   */
  async function connect(injected) {
    if (services) throw new Error('Program Lab is already connected');
    services = injected;
    try {
      definitions = await services.initialize();
      $('fatalError').hidden = true;
      const manifest = definitions.manifest;
      $('buildIdentity').textContent = `Generator ${manifest.generatorVersion} · ${String(manifest.sourceCommit || 'uncommitted').slice(0, 12)}${manifest.dirty ? ' · modified build' : ''} · catalog ${String(manifest.catalogSha256).slice(0, 12)}`;
      $('buildManifest').textContent = json(manifest);
      $('baselineBadge').textContent = `Bundled default · generator ${manifest.generatorVersion} · ${String(manifest.runtimeFingerprint).slice(0, 12)}`;
      $('fixture').replaceChildren(...definitions.fixtures.map(item => option(item.id, item.label || item.name || item.id)));
      $('preset').replaceChildren(...definitions.presets.map(item => option(item.id, item.label || item.name || item.id)));
      wire(); renderDraft(definitions.configuration); setBusy(false);
      await refreshSaved(); await validate();
      $('runStatus').textContent = 'Ready';
      document.documentElement.dataset.labReady = 'true';
    } catch (error) { services = null; showError(error); $('runStatus').textContent = 'Initialization failed'; throw error; }
  }
  root.RepForgeProgramLabUI = Object.freeze({ connect });
  if (root.RepForgeProgramLabServices) connect(root.RepForgeProgramLabServices).catch(() => {});
  else {
    $('planSummary').textContent = 'Build incomplete';
    $('runStatus').textContent = 'Shared lab services are not assembled';
    showError('This source checkout is missing the lab integration services. Build the complete standalone artifact; generation is unavailable until the shared policy, domain and store modules are connected.');
  }
})(globalThis);
