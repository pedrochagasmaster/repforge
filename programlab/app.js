/* Program Lab DOM owner. All validation, policy transformations, planning,
   execution, comparison and storage belong to the injected shared services.
   See RepForgeProgramLabUI.connect below for the single integration seam. */
/* The lab follows the device's appearance (it is its own origin and cannot read the app's setting); data-theme mirrors
   it, as the app's root carries its theme, so the catalog can read the rendered theme. */
(function mirrorProgramLabTheme(root) {
  const doc = root.document, query = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  if (!doc || !query) return;
  const apply = () => { doc.documentElement.dataset.theme = query.matches ? 'dark' : 'light'; };
  apply();
  if (typeof query.addEventListener === 'function') query.addEventListener('change', apply);
})(typeof window !== 'undefined' ? window : globalThis);

(function attachProgramLabUI(root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const L = root.RepForgeProgramLabI18n;
  const _ = (key, values) => L.t(key, values);
  const say = (id, key, values) => L.bind($(id), key, values);
  const labelText = value => typeof value === 'object' && value ? value[L.locale()] || value.en || '' : _(String(value ?? ''));
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
  let savedIdentity = null, plan = null, validationToken = 0, runToken = 0, viewToken = 0, selectedView = null, selectedRun = null, analysisController = null, dirty = false;
  const policyInputs = new Map();
  const scenarioInputs = new Map();
  const pendingScenarioEdits = new Set(), canonicalDrafts = new Map();
  const extraInputs = new Map([['canonicalRequest', { input: $('canonicalRequest'), message: $('canonicalError') }]]);
  const buttons = ['save', 'export', 'exportConfiguration', 'runWithBuild', 'fixture', 'applyPreset', 'preset', 'updateScenario', 'duplicateScenario', 'moveUp', 'moveDown', 'removeScenario', 'applyCanonical', 'resetPolicy'];

  function errorMessage(error) { return labelText(String(error?.message || error)); }
  function showError(error) {
    $('fatalError').hidden = false;
    say('fatalError', error?.messageKey || String(error?.message || error));
  }
  function guard(action) {
    return async event => {
      if (services) $('fatalError').hidden = true;
      try { await action(event); }
      catch (error) { if (Array.isArray(error.issues)) presentIssues(error.issues); showError(error); }
    };
  }
  function markDirty() {
    dirty = true;
    say('persistenceStatus', 'Unsaved changes');
    $('inputsChanged').hidden = !run;
    validate();
  }
  function setBusy(value) {
    active = value;
    for (const id of buttons) $(id).disabled = value;
    $('cancel').disabled = !value;
    $('export').disabled = value || !run;
    $('run').disabled = value || !plan;
    $('load').disabled = value || !$('savedExperiments').value;
    $('loadRun').disabled = value || !$('savedRuns').value;
    $('savedRuns').disabled = value;
    $('savedExperiments').disabled = value;
    $('caseList').disabled = value;
    $('resultCase').disabled = value || !run;
    $('cycle').disabled = value || !run;
    $('importFiles').disabled = value;
    $('language').disabled = value;
    document.querySelector('.workbench-grid').setAttribute('aria-busy', String(value));
    document.querySelectorAll('[data-mode], #scenarioControls input, #scenarioControls select, #scenarioControls textarea, #policyControls input, #policyControls select, #bulkActions button, #sweepControls input, #sweepControls select').forEach(control => { control.disabled = value; });
    $('experimentName').disabled = value;
    $('experimentNotes').disabled = value;
    $('seed').disabled = value;
    $('scenarioName').disabled = value;
    $('canonicalRequest').disabled = value;
    const scenario = draft?.scenarios[selectedScenario];
    $('updateScenario').disabled = value || scenario?.inputMode !== 'answers' || canonicalDrafts.has(scenario?.id);
  }
  function readConfiguration() {
    if (pendingScenarioEdits.size) throw new Error(_('Apply or replace the pending scenario edits before saving, exporting or running.'));
    const configuration = clone(draft);
    configuration.name = $('experimentName').value;
    configuration.notes = $('experimentNotes').value;
    if (configuration.mode === 'single') configuration.scenarios = [configuration.scenarios[selectedScenario]];
    if (configuration.mode === 'sweep') {
      const raw = $('sweepValues').value.split(',').map(value => value.trim());
      if (!raw.length || raw.some(value => !value)) throw new Error(_('Enter explicit numeric sweep values separated by commas.'));
      const values = raw.map(Number);
      if (values.some(value => !Number.isFinite(value))) throw new Error(_('Sweep values must be finite numbers.'));
      configuration.sweep = { path: $('sweepPath').value, values };
    } else configuration.sweep = null;
    return configuration;
  }
  function presentIssues(issues) {
    $('validation').replaceChildren();
    for (const { input, message } of [...policyInputs.values(), ...scenarioInputs.values(), ...extraInputs.values()]) {
      input.removeAttribute('aria-invalid');
      message.textContent = '';
    }
    for (const issue of issues) {
      const path = issue.path || issue.field || '';
      const label = issue.message || issue.code || String(issue);
      $('validation').append(text('p', `${path ? `${path}: ` : ''}${label}`));
      const scenarioPath = path.replace(/^scenarios(?:\.\d+|\[\d+\])\./, '').replace(/^(answers|request)\./, '');
      const field = policyInputs.get(path.replace(/^candidatePolicy\./, '')) || scenarioInputs.get(scenarioPath) || extraInputs.get(path);
      if (field) {
        field.input.setAttribute('aria-invalid', 'true');
        const group = field.input.closest('details'); if (group) group.open = true;
        field.message.textContent = label;
      }
    }
  }
  async function validate() {
    if (!services || active) return;
    const token = ++validationToken;
    plan = null;
    if (run?.archived && run.plan.experiment.experimentId === draft.experimentId) {
      $('run').disabled = true; presentIssues([{ message: _('Archived results are read-only. Use Run with this build to create a new attempt.') }]);
      say('planSummary', 'Archived build · exact replay unavailable here'); return;
    }
    $('run').disabled = true;
    try {
      const configuration = readConfiguration();
      const validation = await services.validate(configuration);
      if (token !== validationToken) return;
      presentIssues(validation.issues || []);
      if (!validation.ok) { say('planSummary', 'Resolve input errors before running.'); return; }
      const planned = await services.plan(configuration);
      if (token !== validationToken) return;
      plan = planned;
      say('planSummary', '{cases} scenarios · {cells} distinct compiler cells · {reuse} identical-cell reuses', { cases: planned.caseCount, cells: planned.cellCount, reuse: planned.baselineReuse || 0 });
      $('sweepPlan').hidden = configuration.mode !== 'sweep';
      if (configuration.mode === 'sweep') say('sweepPlan', '{path}: {values} · reuse requires identical computation keys.', { path: planned.experiment.sweep.path, values: planned.experiment.sweep.values.join(', ') });
      $('run').disabled = false;
    } catch (error) {
      if (token !== validationToken) return;
      presentIssues([{ message: errorMessage(error) }]);
      say('planSummary', 'Unable to plan this draft.');
    }
  }

  function createInput(field, value, onChange) {
    let input;
    const choices = field.values || field.options;
    if (choices) {
      input = document.createElement('select');
      for (const choice of choices) {
        const item = typeof choice === 'object' ? choice : { value: choice, label: String(choice) };
        input.append(option(String(item.value), labelText(item.label)));
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
      const groupName = labelText(field.group || 'Policy');
      if (!groups.has(groupName)) {
        const details = document.createElement('details');
        details.open = groups.size < 2;
        details.append(text('summary', labelText(groupName)));
        groups.set(groupName, details);
        $('policyControls').append(details);
      }
      const row = text('div', '', 'policy-row');
      const index = policyInputs.size;
      const id = `policy-${index}`;
      const label = text('label', labelText(field.label || field.path));
      label.htmlFor = id;
      const values = text('div', '', 'policy-values');
      const baselineValue = at(draft.baselinePolicy, field.path) === null ? _('Recovered default') : at(draft.baselinePolicy, field.path);
      const baseline = text('span', baselineValue, 'baseline');
      baseline.setAttribute('aria-label', _('Baseline: {value}', { value: baselineValue }));
      values.append(baseline);
      const input = createInput(field, at(draft.candidatePolicy, field.path), next => {
        assign(draft.candidatePolicy, field.path, next);
        markDirty();
      });
      input.id = id;
      input.dataset.policyPath = field.path;
      input.setAttribute('aria-label', `${labelText(field.label || field.path)} (${field.path})`);
      const reset = text('button', _('Reset'));
      reset.type = 'button';
      reset.setAttribute('aria-label', _('Reset {field} to baseline', { field: labelText(field.label || field.path) }));
      reset.addEventListener('click', () => {
        assign(draft.candidatePolicy, field.path, clone(at(draft.baselinePolicy, field.path)));
        renderPolicy();
        markDirty();
        policyInputs.get(field.path)?.input.focus();
      });
      values.append(input, reset);
      const hint = text('p', [field.unit, field.description, ...(field.dependencies || [])].filter(Boolean).map(labelText).join(' · '), 'hint');
      hint.id = `${id}-hint`;
      const message = text('p', '', 'field-error');
      message.id = `${id}-error`;
      input.setAttribute('aria-describedby', `${hint.id} ${message.id}`);
      row.append(label, values, hint, text('p', field.path, 'policy-path'), message);
      groups.get(groupName).append(row);
      policyInputs.set(field.path, { input, message });
      if (field.sweepable !== false && (typeof at(definitions.defaultPolicy, field.path) === 'number' || field.nullable)) $('sweepPath').append(option(field.path, `${labelText(field.label || field.path)} (${field.path})`));
    }
    if (draft.sweep) { $('sweepPath').value = draft.sweep.path; $('sweepValues').value = draft.sweep.values.join(', '); }
  }
  function renderScenarios() {
    $('caseList').replaceChildren(...draft.scenarios.map((scenario, index) => option(String(index), `${index + 1}. ${scenario.name || scenario.id}`)));
    $('caseList').value = String(selectedScenario);
    const scenario = draft.scenarios[selectedScenario];
    $('scenarioName').value = scenario.name || scenario.id;
    const archived = !!run?.archived && run.plan.experiment.experimentId === draft.experimentId;
    $('seed').value = services.scenarioIdentity(scenario, { archived });
    $('seed').readOnly = true;
    say('seedLabel', archived ? 'Archived input fingerprint (read-only)' : 'Canonical generation identity');
    $('seed').setAttribute('aria-label', _('Canonical generation identity'));
    $('canonicalRequest').value = canonicalDrafts.get(scenario.id) ?? json(scenario.request);
    $('updateScenario').disabled = active || scenario.inputMode !== 'answers' || canonicalDrafts.has(scenario.id);
    $('normalizedRequest').textContent = json(scenario.request);
    $('scenarioControls').replaceChildren();
    scenarioInputs.clear();
    if (scenario.inputMode === 'canonical' || !scenario.answers) {
      $('scenarioControls').append(text('p', _('Canonical input · use the advanced request editor to change this scenario.'), 'hint'));
      return;
    }
    for (const [index, field] of (definitions.scenarioFields || []).entries()) {
      const label = text('label', labelText(field.label || field.path));
      const input = createInput(field, at(scenario.answers, field.path), next => {
        const current = draft.scenarios[selectedScenario];
        assign(current.answers, field.path, next);
        pendingScenarioEdits.add(current.id);
        $('run').disabled = true;
        plan = null;
        say('planSummary', 'Apply scenario edits to validate the mapped request.');
        dirty = true;
        say('persistenceStatus', 'Unapplied scenario changes');
      });
      input.id = `scenario-${index}`;
      label.htmlFor = input.id;
      input.dataset.scenarioPath = field.path;
      label.append(input);
      const hint = text('p', labelText(field.description || ''), 'hint');
      hint.id = `${input.id}-hint`;
      const message = text('p', '', 'field-error');
      message.id = `${input.id}-error`;
      input.setAttribute('aria-describedby', `${hint.id} ${message.id}`);
      $('scenarioControls').append(label, hint, message);
      scenarioInputs.set(field.path, { input, message });
    }
  }
  function renderDraft(configuration) {
    draft = clone(configuration);
    pendingScenarioEdits.clear(); canonicalDrafts.clear();
    selectedScenario = Math.min(selectedScenario, draft.scenarios.length - 1);
    $('experimentName').value = draft.name;
    $('experimentNotes').value = draft.notes || '';
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === draft.mode)));
    $('sweepControls').hidden = draft.mode !== 'sweep';
    const archived = !!run?.archived && run.plan.experiment.experimentId === draft.experimentId;
    if (archived) say('baselineBadge', 'Archived baseline · runtime {fingerprint}', { fingerprint: run.plan.build.runtimeFingerprint.slice(0, 12) });
    else say('baselineBadge', 'Bundled default · generator {version} · {fingerprint}', { version: definitions.manifest.generatorVersion, fingerprint: definitions.manifest.runtimeFingerprint.slice(0, 12) });
    renderScenarios();
    renderPolicy();
    validate();
  }

  function metrics(container, rows) {
    if (!rows?.length) return;
    const grid = text('div', '', 'metrics');
    for (const row of rows) {
      const metric = text('div', '', 'metric');
      metric.append(text('strong', row.value === null ? _('Unavailable') : row.value), text('span', labelText(row.label)));
      if (row.detail) metric.append(text('p', labelText(row.detail), 'hint'));
      grid.append(metric);
    }
    container.append(grid);
  }
  function renderTable(container, data) {
    const table = text('table', '', 'result-table');
    table.append(text('caption', labelText(data.caption)));
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const column of data.columns) { const cell = text('th', labelText(column)); cell.scope = 'col'; header.append(cell); }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const row of data.rows) {
      const tr = document.createElement('tr');
      for (const [index, value] of row.entries()) { const cell = text('td', value ?? _('Unavailable')); cell.dataset.label = labelText(data.columns[index]); tr.append(cell); }
      body.append(tr);
    }
    table.append(body); container.append(table);
  }
  function renderProgram(container, cell, cycle, markers = {}) {
    container.replaceChildren();
    if (!cell) { container.append(text('p', _('Not executed'), 'hint')); return; }
    const result = cell.result;
    if (!result?.ok) {
      container.append(text('p', labelText(cell.outcome || (result ? 'Domain conflict' : 'Execution error')), 'field-error'), text('pre', json(result || cell.error)));
      return;
    }
    metrics(container, cell.metricRows);
    const program = result.value;
    for (const day of program.days || []) {
      const dayNode = text('section', '', 'day');
      dayNode.append(text('h3', `${day.name}${day.kind === 'rest' ? ` · ${_('rest')}` : ''}`));
      for (const slot of day.slots || []) {
        const marker = Object.hasOwn(markers, slot.id) ? markers[slot.id] : null;
        const slotNode = text('div', '', `slot${marker ? ' changed' : ''}`);
        if (marker) slotNode.append(text('p', marker, 'badge'));
        const name = cell.exerciseLabels?.[slot.exerciseId] || slot.displayName || (!cell.archived && definitions.exerciseLabels?.[slot.exerciseId]) || slot.exerciseId;
        slotNode.append(text('p', name), text('p', `${labelText(slot.role || '')} · ${labelText(slot.executionMode || 'unspecified execution')}`, 'hint'));
        const list = text('ol', '', 'sets');
        const sets = slot.prescriptionsByCycle?.find(item => item.cycleIndex === cycle)?.sets || [];
        for (const [index, set] of sets.entries()) {
          const targets = Object.entries(set.targets || {}).map(([key, target]) => `${labelText(key)} ${typeof target === 'object' ? `${target.min ?? '?'}–${target.max ?? '?'}` : target}`).join(' · ');
          list.append(text('li', _('{ordinal}. {targets} · RIR {rir} · rest {rest}{manual}', { ordinal: index + 1, targets: targets || _('Manual targets'), rir: set.rir ?? _('unspecified'), rest: set.restSeconds === null ? _('unspecified') : `${set.restSeconds}s`, manual: set.status === 'manual' ? ` · ${_('manual')}` : '' })));
        }
        slotNode.append(list);
        dayNode.append(slotNode);
      }
      container.append(dayNode);
    }
  }
  async function renderResult() {
    if (!run) return;
    const sourceRun = run, token = ++viewToken;
    analysisController?.abort();
    const controller = new AbortController(); analysisController = controller;
    say('analysisStatus', 'Preparing result metrics…');
    try {
      const view = await services.inspect(sourceRun, {
        comparisonKey: $('resultCase').value || null, cycleIndex: Number($('cycle').value || 1), signal: controller.signal,
        onProgress: update => { if (token === viewToken) say('analysisStatus', 'Preparing cohort metrics · {completed}/{total} cells', update); },
      });
      if (!view || token !== viewToken) return;
      selectedView = view; selectedRun = sourceRun;
      $('archiveActions').hidden = !sourceRun.archived;
      say('baselineHeading', sourceRun.archived ? 'Archived baseline' : 'Bundled baseline');
      say('candidateHeading', sourceRun.archived ? 'Archived candidate' : 'Candidate');
      const previous = $('resultCase').value;
      $('resultCase').replaceChildren(...view.comparisons.map(item => option(item.key, item.label)));
      if (view.comparisons.some(item => item.key === previous)) $('resultCase').value = previous;
      $('resultCase').disabled = active || !view.comparisons.length;
      const cycle = Number($('cycle').value || 1);
      $('cycle').replaceChildren(...view.cycles.map(item => option(String(item.index), _('Cycle {index} · {kind}', { index: item.index, kind: item.deload ? 'deload' : _('ordinary') }))));
      $('cycle').value = String(view.cycleIndex || (view.cycles.some(item => item.index === cycle) ? cycle : view.cycles[0]?.index || 1));
      $('cycle').disabled = active || !view.cycles.length;
      $('cycleStatus').textContent = labelText(view.cycleLabel || '');
      say('resultSnapshot', 'Run {id} · {status} · {completed}/{total} cells · snapshot {revision}', { id: sourceRun.runId, status: _(sourceRun.status), completed: sourceRun.completed, total: sourceRun.total, revision: sourceRun.revision ?? sourceRun.plan?.experiment?.revision ?? sourceRun.configuration?.revision ?? _('embedded') });
      $('aggregateSummary').replaceChildren();
      metrics($('aggregateSummary'), view.aggregateRows);
      if (view.aggregateTable) renderTable($('aggregateSummary'), view.aggregateTable);
      if (view.aggregateStrataTable) renderTable($('aggregateSummary'), view.aggregateStrataTable);
      $('comparisonSummary').replaceChildren();
      metrics($('comparisonSummary'), view.metricRows);
      if (view.distributionTable) renderTable($('comparisonSummary'), view.distributionTable);
      if (view.setCountTable) renderTable($('comparisonSummary'), view.setCountTable);
      $('metricDetails').textContent = json(view.metricDetails || null);
      if (view.notice) $('comparisonSummary').append(text('p', labelText(view.notice), 'badge'));
      renderProgram($('baselineProgram'), view.baseline, Number($('cycle').value), view.baselineMarkers);
      renderProgram($('candidateProgram'), view.candidate, Number($('cycle').value), view.candidateMarkers);
      $('semanticChanges').replaceChildren();
      for (const change of view.changes || []) $('semanticChanges').append(text('p', typeof change === 'string' ? change : json(change), 'hint'));
      if (!view.changes?.length) $('semanticChanges').append(text('p', _('No semantic prescription changes in this comparison.'), 'hint'));
      $('diagnostics').textContent = json(view.diagnostics || { baseline: view.baseline?.result?.diagnostics, candidate: view.candidate?.result?.diagnostics });
      say('rawResult', '');
      renderRaw();
      if (!active) { $('progress').max = Math.max(1, sourceRun.total); $('progress').value = sourceRun.completed; say('runStatus', '{status} · {completed}/{total} cells{case}', { status: _(sourceRun.status), completed: sourceRun.completed, total: sourceRun.total, case: '' }); }
      say('analysisStatus', 'Cohort metrics ready.');
    } finally { if (analysisController === controller) analysisController = null; }
  }
  function renderRaw() {
    if (!$('rawDetails').open || !selectedRun || !selectedView) return;
    const source = selectedRun;
    $('rawResult').textContent = json({ runId: source.runId, revision: source.revision, status: source.status, completed: source.completed, total: source.total, saved: source.saved, error: source.error,
      buildProvenance: source.buildProvenance || null, configuration: source.plan?.experiment || source.configuration, baseline: selectedView.baseline, candidate: selectedView.candidate,
      changes: selectedView.changes });
  }
  function clearResult() {
    selectedView = null; selectedRun = null; analysisController?.abort(); say('analysisStatus', '');
    $('archiveActions').hidden = true;
    for (const id of ['baselineProgram', 'candidateProgram', 'aggregateSummary', 'comparisonSummary', 'semanticChanges', 'diagnostics', 'metricDetails', 'rawResult']) $(id).replaceChildren();
    say('resultSnapshot', 'This configuration has no saved execution snapshot.');
    $('resultCase').replaceChildren(option('', _('No results yet')));
    $('resultCase').disabled = true;
    $('cycle').disabled = true;
    say('cycleStatus', '');
  }
  async function refreshSaved() {
    const selected = $('savedExperiments').value;
    const items = await services.list();
    $('savedExperiments').replaceChildren(option('', _('Choose an experiment')), ...items.map(item => option(item.id, item.name)));
    if (items.some(item => item.id === selected)) $('savedExperiments').value = selected;
    $('load').disabled = active || !$('savedExperiments').value;
    await refreshRuns();
  }
  async function refreshRuns() {
    const experimentId = $('savedExperiments').value;
    const selected = $('savedRuns').value;
    const rows = experimentId ? await services.listRuns(experimentId) : [];
    if ($('savedExperiments').value !== experimentId) return;
    $('savedRuns').replaceChildren(option('', _('Choose a saved run')), ...rows.map(row => option(row.runId, _('Revision {revision} · {status} · {completed}/{total} · {id}', { revision: row.revision, status: _(row.status), completed: row.completed, total: row.total, id: row.runId.slice(0, 12) }))));
    if (rows.some(row => row.runId === selected)) $('savedRuns').value = selected;
    $('loadRun').disabled = active || !$('savedRuns').value;
  }
  async function save() {
    const record = await services.save(readConfiguration(), run);
    savedIdentity = record;
    dirty = false;
    say('persistenceStatus', 'Saved · revision {revision}', { revision: record.revision });
    await refreshSaved();
    if (record.id) $('savedExperiments').value = record.id;
    $('load').disabled = false;
    if (run?.saved === false) say('persistenceStatus', 'Configuration saved; displayed run remains unsaved and exportable.');
    await refreshRuns();
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
    say('runStatus', 'validating');
    $('progress').value = 0;
    $('progress').max = Math.max(1, plan?.cellCount || 1);
    setBusy(true);
    try {
      const result = await services.run(configuration, {
        allowUnsaved,
        onProgress: update => {
          if (token !== runToken) return;
          say('runStatus', '{status} · {completed}/{total} cells{case}', { status: _(update.status), completed: update.completed, total: update.total, case: update.caseName ? ` · ${update.caseName}` : '' });
          $('progress').setAttribute('aria-valuetext', _('{status} · {completed}/{total} cells{case}', { status: _(update.status), completed: update.completed, total: update.total, case: '' }));
          $('progress').max = Math.max(1, update.total);
          $('progress').value = update.completed;
        },
      });
      if (token !== runToken) return;
      run = result;
      $('cancel').disabled = true; // The executor is disposed; only result preparation remains.
      if (result.error) showError(result.error);
      say('runStatus', '{status} · {completed}/{total} cells{case}', { status: _(result.status), completed: result.completed, total: result.total, case: '' });
      say('persistenceStatus', (result.persisted === false || result.saved === false) ? 'Unsaved run · export remains available' : 'Saved run snapshot');
      dirty = false;
      await renderResult();
      await refreshSaved();
      if (result.saved) { $('savedExperiments').value = result.plan.experiment.experimentId; await refreshRuns(); }
    } catch (error) {
      if (token !== runToken) return;
      showError(error);
      say('runStatus', 'failed');
      if (['persistence_failed', 'storage_initialization_failed'].includes(error.code)) $('runUnsaved').hidden = false;
    } finally {
      if (token === runToken) { setBusy(false); await validate(); }
    }
  }
  function wire() {
    $('experimentName').addEventListener('input', markDirty);
    $('experimentNotes').addEventListener('input', markDirty);
    $('scenarioName').addEventListener('change', () => { draft.scenarios[selectedScenario].name = $('scenarioName').value; renderScenarios(); markDirty(); });
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      draft.mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.mode === draft.mode)));
      $('sweepControls').hidden = draft.mode !== 'sweep';
      markDirty();
    }));
    $('fixture').addEventListener('change', guard(async () => {
      const fixture = await services.fixture($('fixture').value);
      const scenarios = Array.isArray(fixture) ? fixture : [fixture];
      draft.scenarios = clone(draft.mode === 'single' ? [scenarios[0]] : scenarios);
      pendingScenarioEdits.clear(); canonicalDrafts.clear(); selectedScenario = 0; renderScenarios(); markDirty();
    }));
    $('caseList').addEventListener('change', () => { selectedScenario = Number($('caseList').value); renderScenarios(); if (draft.mode === 'single') markDirty(); else validate(); });
    $('updateScenario').addEventListener('click', guard(async () => {
      draft.scenarios[selectedScenario] = clone(await services.normalizeScenario({ ...draft.scenarios[selectedScenario], inputMode: 'answers' }));
      pendingScenarioEdits.delete(draft.scenarios[selectedScenario].id);
      renderScenarios(); markDirty();
    }));
    $('canonicalRequest').addEventListener('input', () => {
      const id = draft.scenarios[selectedScenario].id; canonicalDrafts.set(id, $('canonicalRequest').value); pendingScenarioEdits.add(id);
      $('run').disabled = true; $('updateScenario').disabled = true; plan = null;
      say('planSummary', 'Validate and apply the pending canonical request before running.');
      say('persistenceStatus', 'Unapplied canonical request'); $('inputsChanged').hidden = !run;
    });
    $('applyCanonical').addEventListener('click', guard(async () => {
      let request;
      try { request = JSON.parse($('canonicalRequest').value); }
      catch { throw Object.assign(new Error(_('Enter valid canonical request JSON.')), { issues: [{ path: 'canonicalRequest', message: _('Enter valid canonical request JSON.') }] }); }
      try { draft.scenarios[selectedScenario] = clone(await services.normalizeScenario({ ...draft.scenarios[selectedScenario], request, inputMode: 'canonical' })); }
      catch (error) { if (error.issues) error.issues = error.issues.map(item => ({ ...item, path: 'canonicalRequest', message: `${item.path || item.field || ''}: ${item.message || item.code}` })); throw error; }
      pendingScenarioEdits.delete(draft.scenarios[selectedScenario].id); canonicalDrafts.delete(draft.scenarios[selectedScenario].id);
      $('canonicalRequest').removeAttribute('aria-invalid'); $('canonicalError').textContent = '';
      renderScenarios(); markDirty();
    }));
    $('duplicateScenario').addEventListener('click', guard(async () => {
      if (pendingScenarioEdits.has(draft.scenarios[selectedScenario].id)) throw new Error(_('Apply pending scenario edits before duplicating.'));
      const duplicate = clone(await services.duplicateScenario(draft.scenarios[selectedScenario]));
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
      pendingScenarioEdits.delete(draft.scenarios[selectedScenario].id); canonicalDrafts.delete(draft.scenarios[selectedScenario].id);
      draft.scenarios.splice(selectedScenario, 1); selectedScenario = Math.min(selectedScenario, draft.scenarios.length - 1); renderScenarios(); markDirty();
    });
    $('applyPreset').addEventListener('click', guard(async () => {
      const preset = definitions.presets.find(item => item.id === $('preset').value);
      draft.candidatePolicy = clone(await services.applyPreset(preset.id, draft.candidatePolicy));
      $('presetDescription').textContent = labelText(preset.description);
      renderPolicy(); markDirty();
    }));
    for (const operation of definitions.bulkEdits || []) {
      const description = text('p', _('{description} Fields: {fields}', { description: labelText(operation.description), fields: operation.paths.join(', ') }), 'hint');
      const button = text('button', labelText(operation.label));
      button.addEventListener('click', guard(async () => {
        draft.candidatePolicy = clone(await services.bulkEdit(operation.id, draft.candidatePolicy)); renderPolicy(); markDirty();
      }));
      $('bulkActions').append(description, button);
    }
    $('resetPolicy').addEventListener('click', () => { draft.candidatePolicy = clone(draft.baselinePolicy); renderPolicy(); markDirty(); });
    $('sweepPath').addEventListener('change', markDirty);
    $('sweepValues').addEventListener('input', markDirty);
    $('runWithBuild').addEventListener('click', guard(async () => {
      const configuration = await services.adoptCurrentBuild(readConfiguration(), run);
      renderDraft(configuration); markDirty(); await execute();
    }));
    $('run').addEventListener('click', guard(() => execute()));
    $('runUnsaved').addEventListener('click', guard(() => execute(true)));
    $('cancel').addEventListener('click', guard(async () => { $('cancel').disabled = true; say('runStatus', 'Canceling active worker…'); await services.cancel(); if (active) say('runStatus', 'Cancellation acknowledged; finalizing accepted checkpoints.'); }));
    $('save').addEventListener('click', guard(save));
    $('savedExperiments').addEventListener('change', guard(async () => { $('load').disabled = active || !$('savedExperiments').value; await refreshRuns(); }));
    $('savedRuns').addEventListener('change', () => { $('loadRun').disabled = active || !$('savedRuns').value; });
    $('loadRun').addEventListener('click', guard(async () => {
      const record = await services.loadRun($('savedRuns').value);
      run = record.run; runToken++; renderDraft(record.configuration);
      $('inputsChanged').hidden = true; say('persistenceStatus', 'Saved · revision {revision}', { revision: record.revision });
      await renderResult();
    }));
    $('load').addEventListener('click', guard(async () => {
      const record = await services.load($('savedExperiments').value);
      savedIdentity = record; run = record.run || null; runToken++; renderDraft(record.configuration);
      dirty = false; $('inputsChanged').hidden = true; say('persistenceStatus', 'Saved · revision {revision}', { revision: record.revision });
      if (run) await renderResult(); else clearResult();
    }));
    const downloadURLs = [];
    async function exportArchive(includeRun) {
      setBusy(true); say('runStatus', 'Preparing archive in a dedicated worker…');
      say('cancel', 'Cancel operation');
      try {
        const parts = await services.exportArchive(includeRun && run ? run.plan.experiment : readConfiguration(), includeRun ? run : null);
        for (const url of downloadURLs.splice(0)) URL.revokeObjectURL(url);
        $('exportDownloads').replaceChildren();
        for (const part of parts) {
          const blob = part.blob || new Blob([part.text], { type: 'application/json' });
          const url = URL.createObjectURL(blob); downloadURLs.push(url);
          const link = Object.assign(document.createElement('a'), { href: url, download: part.name, textContent: part.name });
          $('exportDownloads').append(link, document.createElement('br'));
          if (parts.length === 1) link.click();
        }
        say('persistenceStatus', 'Prepared {count} archive part(s). Download every part.', { count: parts.length });
        say('runStatus', includeRun ? 'Archive contains the selected immutable run snapshot.' : 'Configuration-only archive prepared.');
      } catch (error) { say('runStatus', error.code === 'archive_canceled' ? 'Archive operation canceled.' : 'Archive operation failed.'); throw error;
      } finally { setBusy(false); say('cancel', 'Cancel run'); await validate(); }
    }
    $('export').addEventListener('click', guard(() => exportArchive(true)));
    $('exportConfiguration').addEventListener('click', guard(() => exportArchive(false)));
    $('importFiles').addEventListener('change', guard(async () => {
      const files = [...$('importFiles').files];
      if (!files.length) return;
      setBusy(true); say('runStatus', 'Validating archive in a dedicated worker…'); say('cancel', 'Cancel operation');
      try {
        const record = await services.importArchive(files);
        run = record.run || null; runToken++; renderDraft(record.configuration); dirty = false;
        $('inputsChanged').hidden = true; say('persistenceStatus', record.archived ? 'Imported archived result · exact replay unavailable on this build' : 'Imported experiment');
        if (run) { await renderResult(); $('progress').max = Math.max(1, run.total); $('progress').value = run.completed; } else clearResult();
        await refreshSaved();
        $('savedExperiments').value = record.configuration.experimentId;
        await refreshRuns();
        say('runStatus', 'Imported archive validated and committed.');
      } catch (error) { say('runStatus', error.code === 'archive_canceled' ? 'Archive operation canceled.' : 'Archive operation failed.'); throw error;
      } finally { $('importFiles').value = ''; setBusy(false); say('cancel', 'Cancel run'); await validate(); }
    }));
    $('rawDetails').addEventListener('toggle', renderRaw);
    $('resultCase').addEventListener('change', guard(renderResult));
    $('cycle').addEventListener('change', guard(renderResult));
  }

  /** The UI adapter contract deliberately contains no engine/persistence logic.
   * initialize({locale}) -> { manifest, defaultPolicy, policyFields[], presets[], fixtures[],
   *   scenarioFields[], configuration, exerciseLabels? }
   * validate(config) -> {ok,issues:[{path,code,message}]}; plan(config) ->
   *   {caseCount,cellCount,baselineReuse}; fixture(id) -> scenario | scenario[];
   * scenarioIdentity(scenario) -> read-only current compiler identity;
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
      definitions = await services.initialize({ locale: L.locale() });
      $('fatalError').hidden = true;
      const manifest = definitions.manifest;
      say('buildIdentity', 'Generator {version} · {commit}{dirty} · catalog {catalog}', () => ({ version: manifest.generatorVersion, commit: String(manifest.sourceCommit || _('uncommitted')).slice(0, 12), dirty: manifest.dirty ? _(' · modified build') : '', catalog: String(manifest.catalogSha256).slice(0, 12) }));
      $('buildManifest').textContent = json(manifest);
      say('baselineBadge', 'Bundled default · generator {version} · {fingerprint}', { version: manifest.generatorVersion, fingerprint: String(manifest.runtimeFingerprint).slice(0, 12) });
      $('fixture').replaceChildren(...definitions.fixtures.map(item => option(item.id, labelText(item.label || item.name || item.id))));
      $('preset').replaceChildren(...definitions.presets.map(item => option(item.id, labelText(item.label || item.name || item.id))));
      wire(); renderDraft(definitions.configuration); setBusy(false);
      await refreshSaved(); await validate();
      say('runStatus', 'Ready');
      document.documentElement.dataset.labReady = 'true';
    } catch (error) { services = null; showError(error); say('runStatus', 'Initialization failed'); throw error; }
  }
  L.localize(document);
  const skip = document.querySelector('.skip');
  skip.href = new URL('#workbench', root.location.href).href;
  skip.addEventListener('click', () => $('workbench').focus({ preventScroll: true }));
  $('language').addEventListener('change', guard(async () => {
    if (active) { $('language').value = L.locale(); throw new Error(_('Language cannot change while a run is active.')); }
    const persisted = L.setLocale($('language').value);
    L.localize(document);
    if (draft) {
      draft.name = $('experimentName').value; draft.notes = $('experimentNotes').value;
      const canonicalDraft = $('canonicalRequest').value;
      renderPolicy(); renderScenarios(); $('canonicalRequest').value = canonicalDraft;
      if (run) {
        await renderResult();
        say('runStatus', '{status} · {completed}/{total} cells{case}', { status: _(run.status), completed: run.completed, total: run.total, case: '' });
      }
      await validate(); await refreshRuns();
    }
    if (!persisted) showError('Language preference could not be saved. It applies to this tab only.');
  }));
  root.RepForgeProgramLabUI = Object.freeze({ connect });
  if (root.RepForgeProgramLabServices) connect(root.RepForgeProgramLabServices).catch(() => {});
  else {
    say('planSummary', 'Build incomplete');
    say('runStatus', 'Shared lab services are not assembled');
    showError('This source checkout is missing the lab integration services. Build the complete standalone artifact; generation is unavailable until the shared policy, domain and store modules are connected.');
  }
})(globalThis);
