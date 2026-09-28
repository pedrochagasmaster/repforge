/* _example · placeholder candidate for the Round 2 tooling. NOT A DESIGN.
   It exists to prove round-2/JOURNEYS.md and tools/verify.mjs --round 2 end
   to end: it implements mount / reach / entry / journeys against the shared
   widgets (TS.*) and the shared runtime (TF.*), reaches all 45 checkpoints
   with plain layouts, and implements a deliberate subset of the journeys so
   the verifier shows both passing and "not implemented" results.
   Product policy: none (policy.productDecisions = []). */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    en: {
      "ex.min": "min", "ex.optional": "Optional", "ex.built_from": "Built from", "ex.change": "Change", "ex.days_fact": "{n} training days", "ex.apply": "Update program",
      "ex.facts": "{exercises} exercises · {sets} sets", "ex.back_to_program": "Back to the program", "ex.file_door": "Import a file", "ex.paste_door": "Paste a program", "ex.write_own": "I'd rather write it from scratch",
      "ex.help": "Not sure which one?", "ex.help_q": "What do you have now?", "ex.help.recommend": "Nothing yet, let Taurifer choose", "ex.help.custom": "I want to pick muscles and exercises",
      "ex.help.browse": "I'd rather pick a ready-made program", "ex.help.build": "I want to write every exercise", "ex.help.import": "I already have a written program", "ex.help_go": "Go with {route}",
      "ex.adjusted": "What Taurifer adjusted", "ex.constraints": "Your constraints", "ex.file_name": "Rafael's program file", "ex.close": "Close",
    },
    pt: {
      "ex.min": "min", "ex.optional": "Opcional", "ex.built_from": "Montado com", "ex.change": "Alterar", "ex.days_fact": "{n} dias de treino", "ex.apply": "Atualizar programa",
      "ex.facts": "{exercises} exercícios · {sets} séries", "ex.back_to_program": "Voltar ao programa", "ex.file_door": "Importar um arquivo", "ex.paste_door": "Colar um programa", "ex.write_own": "Prefiro escrever do zero",
      "ex.help": "Não sabe qual escolher?", "ex.help_q": "O que você tem agora?", "ex.help.recommend": "Nada ainda, o Taurifer escolhe", "ex.help.custom": "Quero escolher músculos e exercícios",
      "ex.help.browse": "Quero escolher entre programas prontos", "ex.help.build": "Quero escrever cada exercício", "ex.help.import": "Já tenho um programa escrito", "ex.help_go": "Seguir com {route}",
      "ex.adjusted": "O que o Taurifer ajustou", "ex.constraints": "Suas restrições", "ex.file_name": "Arquivo do programa do Rafael", "ex.close": "Fechar",
    },
  };
  const STEPS = TF.Entry.ROUTE_STEPS;
  const QUESTIONS = { recommend: ["desired_result", "background", "schedule", "environment", "priorities"], custom: ["desired_result", "background", "schedule", "environment", "priorities", "exercise_preferences", "custom_shape"], browse: ["schedule", "environment"] };
  const REVIEW = { recommend: "result", custom: "result", browse: "preview", import: "preview", shared: "preview", build: "editor" };
  let t, lang, root, S, seedKind;

  function fresh(seed) {
    seedKind = seed || "fresh"; TF.seedDevice(seedKind);
    S = { view: TF.hasActiveProgram() ? "today" : "landing", route: null, step: null, answers: {}, result: null, prev: null, build: null, editing: false, importDraft: null, importKept: null, importMode: "file", ff: TS.freeform.create(), overlay: null, sheet: null, sheetAnswers: null, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, picker: null, own: false, help: null, helpOpen: false, revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, notice: null, envOpen: false, cpTag: null, error: null };
  }
  const answers = () => TF.normalizeAnswers(S.answers);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const name = () => TF.resultName(S.result, lang);
  const reviewing = () => S.route && S.step === REVIEW[S.route];
  function issues() {
    if (!S.route || !QUESTIONS[S.route] || !QUESTIONS[S.route].includes(S.step)) return [];
    try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: answers(), step: S.step })); } catch (e) { return ["state_invalid"]; }
  }
  function compileNow() {
    const mode = S.route === "custom" ? "custom" : "recommend";
    const r = TF.compile(mode, answers());
    if (!r.ok) { S.result = null; S.error = TS.issueText(t, r); return; }
    S.result = TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation });
    S.error = null;
    /* First result with avoidances: state truthfully whether they changed anything. */
    if (!S.prev && (S.answers.exerciseConstraints || []).length) { const w = TF.compile(mode, { ...answers(), exerciseConstraints: [] }); if (w.ok) S.prev = w.preview; }
  }
  function go(route, mode) {
    S.view = "route"; S.route = route; S.step = STEPS[route][0]; S.result = null; S.prev = null; S.editing = false; S.revAtStart = TF.liveRevision(); S.notice = null;
    if (route === "import") { S.importMode = mode || "file"; S.ff = TS.freeform.create(); S.importDraft = null; }
    if (route === "build") S.build = null;
    render(true);
  }
  function advance() {
    if (issues().length || S.avoid.pending || S.pref.pending) return;
    if (S.step === "build_setup") { S.build = TS.build.create(S.answers.programName || "", S.answers.daysPerWeek); S.step = "editor"; render(true); return; }
    const steps = STEPS[S.route]; const next = steps[steps.indexOf(S.step) + 1];
    if (next === "custom_shape") { const c = TF.splitChoices(answers()).choices; if (c.length && !c.some((x) => x.id === S.answers.splitPreference)) S.answers.splitPreference = (c.find((x) => x.default) || c[0]).id; }
    S.step = next; S.prev = null;
    if (next === "result") compileNow();
    render(true);
  }
  function back() {
    if (S.overlay) { S.overlay = null; render(); return; }
    if (S.sheet) { S.sheet = null; render(); return; }
    if (S.editing) { S.editing = false; render(true); return; }
    if (S.route === "shared") { S.view = "shared-gate"; S.route = null; render(true); return; }
    if (S.route === "import" && S.step === "preview") { S.step = "import_source"; S.importDraft = S.importKept; S.result = null; render(true); return; }
    if (S.route === "import" && S.importDraft) { S.importDraft = null; render(true); return; }
    const steps = STEPS[S.route]; const i = steps.indexOf(S.step);
    if (i <= 0) { S.view = "hub"; S.route = null; render(true); return; }
    let prev = steps[i - 1]; if (prev === "result") prev = steps[i - 2];
    if (S.route === "build" && S.step === "editor") prev = "build_setup";
    S.step = prev; render(true);
  }
  function entryStep() { return S.route === "build" && S.step === "editor" ? "editor" : S.step; }
  function stateFor(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    let r = { ok: false };
    try { r = TF.saveDraft(stateFor(entryStep())); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step: QUESTIONS[S.route] ? S.step : STEPS[S.route][0], activeProgramRevisionAtStart: S.revAtStart })); } catch (e) {} }
  }
  function activateNow() {
    if (S.editing) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : S.route === "recommend" || S.route === "custom" ? "result" : "preview";
    const r = TF.activate(stateFor(step));
    if (r.ok) { S.view = "today"; S.toast = t("x.activated"); S.overlay = null; render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render(true); return; }
    S.error = TS.issueText(t, r, { preview: S.result?.preview }); render();
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }

  /* ---------- views ---------- */
  const choice = (o) => TS.choice(o);
  const group = (label, html, id) => `<div class="stack stack--tight" role="radiogroup" aria-labelledby="${id}"><p class="t-label" id="${id}">${esc(label)}</p>${html}</div>`;
  function question() {
    const a = S.answers; const st = S.step; const h = (k) => `<h1 class="t-title">${esc(t(k))}</h1>`;
    if (st === "desired_result") return h("entry.desired_result.title") + group(t("entry.desired_result.lede"), `<div class="stack stack--tight">${TS.DESIRED.map((v) => choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v })).join("")}</div>`, "gGoal");
    if (st === "background") return h("entry.background.title") + group(t("entry.background.experience.label"), `<div class="stack stack--tight">${TS.EXPERIENCE.map((v) => choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v })).join("")}</div>`, "gExp") + group(t("entry.background.consistency.label"), `<div class="stack stack--tight">${TS.CONSISTENCY.map((v) => choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v })).join("")}</div>`, "gCons");
    if (st === "schedule") {
      const days = `<div class="grid-3">${TS.DAYS.map((n) => choice({ key: "daysPerWeek", val: n, title: String(n), cap: t("entry.schedule.days.sub"), selected: a.daysPerWeek === n, cls: "choice--seg ex-num" })).join("")}</div>`;
      const mins = `<div class="grid-3">${TS.MINUTES.map((n) => choice({ key: "sessionMinutes", val: n, title: n === 90 ? "90+" : String(n), cap: t("ex.min"), selected: a.sessionMinutes === n, cls: "choice--seg ex-num" })).join("")}</div>`;
      const rest = S.route === "browse" ? "" : group(t("entry.schedule.rest.label"), `<div class="stack stack--tight">${TS.REST.map((v) => choice({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : +v === a.preferredRestSeconds) })).join("")}</div>`, "gRest");
      return h("entry.schedule.title") + group(t("entry.schedule.days.label"), days, "gDays") + group(t("entry.schedule.minutes.label"), mins, "gMin") + rest;
    }
    if (st === "environment") return h("entry.environment.title") + group(t("entry.environment.lede"), `<div class="stack stack--tight">${TS.ENVS.map((v) => choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment?.kind === v })).join("")}</div>`, "gEnv") + TS.environmentCorrection(t, a.environment, { open: S.envOpen });
    if (st === "priorities" && S.route === "custom") return h("entry.priorities.custom_title") + TS.muscleEmphasis(t, a);
    if (st === "priorities") return h("entry.priorities.title") + `<p class="t-caption">${esc(t("ex.optional"))}</p>` + `<div class="row" style="flex-wrap:wrap;gap:8px" role="group" aria-label="${esc(t("entry.priorities.primary"))}">${TS.MUSCLES.map((m) => TS.chip({ key: "primaryMuscles", val: m, label: t(`entry.muscle.${m}`), selected: (a.primaryMuscles || []).includes(m) })).join("")}</div>` + `<p class="t-label">${esc(t("entry.priorities.avoid"))}</p>` + TS.avoidSection(t, lang, { query: S.avoid.query, pending: S.avoid.pending, constraints: a.exerciseConstraints || [] });
    if (st === "exercise_preferences") return h("entry.exercise_preferences.title") + TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] });
    if (st === "custom_shape") { const c = TF.splitChoices(answers()).choices; return h("entry.custom_shape.title") + `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("entry.custom_shape.split"))}">${c.map((x) => choice({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt : x.name, days: x.frequency }), selected: a.splitPreference === x.id })).join("")}</div>`; }
    return "";
  }
  function catalogue() {
    const cards = TF.browseCards(answers());
    return `<h1 class="t-title">${esc(t("entry.catalogue.title"))}</h1><div class="stack stack--tight">${cards.map((c) => `<button type="button" class="choice" data-act="card" data-id="${esc(c.id)}"><span class="choice__body"><span class="choice__title">${esc(lang === "pt" ? c.namePt : c.name)}</span><span class="choice__cap">${esc(TF.durationLabel(t, c.preview))}</span></span></button>`).join("")}</div>`;
  }
  function review() {
    const p = S.result.preview; const f = TF.previewFacts(p); const a = S.answers; const generated = S.route === "recommend" || S.route === "custom";
    const built = generated ? `<section class="stack stack--tight" aria-labelledby="exBuilt"><h2 class="t-subtitle" id="exBuilt">${esc(t("ex.built_from"))}</h2>
      <div class="row row--between"><span class="t-small">${esc(t("ex.days_fact", { n: a.daysPerWeek }))}</span><button type="button" class="btn btn--sm" data-act="sheet-open" data-sheet="days" aria-label="${esc(t("ex.change"))} ${esc(t("entry.schedule.days.label"))}">${esc(t("ex.change"))}</button></div>
      <div class="row row--between"><span class="t-small">${esc(t(`entry.environment.${a.environment?.kind || "other"}`))}</span><button type="button" class="btn btn--sm" data-act="sheet-open" data-sheet="env" aria-label="${esc(t("ex.change"))} ${esc(t("entry.environment.title"))}">${esc(t("ex.change"))}</button></div></section>` : "";
    const reasons = generated ? `<section class="stack stack--tight"><h2 class="t-subtitle">${esc(t("entry.result.why"))}</h2>${TS.reasons(t, lang, S.result, answers(), { custom: S.route === "custom" }).map((r) => `<p class="t-small">${esc(r.text)}</p>`).join("")}</section>` : "";
    const cons = TS.constraintLines(t, lang, answers()); const adj = TS.adjustments(t, p);
    return `<h1 class="t-feature">${esc(name())}</h1><p class="facts">${esc(t("ex.facts", { exercises: f.exercises, sets: f.sets }))}${TF.durationLabel(t, p) ? ` · ${esc(TF.durationLabel(t, p))}` : ""}</p>
      ${S.prev ? TS.changeStatement(t, S.prev, p) : ""}
      ${S.notice === "conflict" ? TS.conflictNotice(t) : ""}
      ${TS.programDays(t, lang, p)}${built}${reasons}
      ${cons.length ? `<section class="stack stack--tight"><h2 class="t-subtitle">${esc(t("ex.constraints"))}</h2>${cons.map((c) => `<p class="t-small">${esc(c.text)}</p>`).join("")}</section>` : ""}
      ${adj.length ? `<section class="stack stack--tight"><h2 class="t-subtitle">${esc(t("ex.adjusted"))}</h2>${adj.map((c) => `<p class="t-small">${esc(c.text)}</p>`).join("")}</section>` : ""}
      <div class="stack stack--tight"><button type="button" class="btn" data-act="edit">${esc(t("entry.preview.edit"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div>`;
  }
  function editor(forBuild) {
    const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
    const nm = forBuild ? `<h1 class="t-title">${esc(t("entry.editor.title"))}</h1>` : `<h1 class="t-title">${esc(name())}</h1><button type="button" class="btn" data-act="edit-done">${esc(t("ex.back_to_program"))}</button>`;
    return { html: nm + TS.build.editor(t, lang, S.build) + TS.build.statusLine(st), ready: st.ready };
  }
  function importSource() {
    if (S.importDraft) { const c = TF.importCounts(S.importDraft); return `<h1 class="t-title">${esc(t("import.title"))}</h1>${TS.importReview.counts(t, S.importDraft)}${TS.importReview.rows(t, lang, S.importDraft, { picker: S.picker })}
      ${c.review ? `<p class="t-caption" id="exImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}<button type="button" class="btn btn--primary" data-act="import-commit"${c.review ? ' disabled aria-describedby="exImpReason"' : ""}>${esc(t("import.commit"))}</button>`; }
    if (S.importMode === "freeform") return `<h1 class="t-title">${esc(t("entry.freeform.title"))}</h1><p class="t-lede">${esc(t("entry.freeform.lede"))}</p>${TS.freeform.body(t, lang, S.ff)}<button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="file">${esc(t("ex.file_door"))}</button>`;
    return `<h1 class="t-title">${esc(t("entry.import_source.title"))}</h1><p class="t-lede">${esc(t("entry.import_source.lede"))}</p><button type="button" class="btn" data-act="import-file">${esc(t("entry.import_source.pick"))}</button><button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="freeform">${esc(t("ex.paste_door"))}</button><button type="button" class="btn btn--link" data-act="route" data-route="build">${esc(t("ex.write_own"))}</button>`;
  }
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    const r = S.route, s = S.step;
    if (r === "recommend") return { desired_result: "rec-goal", background: "rec-background", schedule: "rec-schedule", environment: "rec-environment", priorities: "rec-priorities", result: "rec-result" }[s];
    if (r === "custom") return { priorities: "custom-priorities", exercise_preferences: "custom-exercises", custom_shape: "custom-shape", result: "custom-result" }[s] || "custom-step";
    if (r === "browse") return { schedule: "browse-filters", environment: "browse-filters", catalogue: "browse-list", preview: "browse-preview" }[s];
    if (r === "build") { if (s === "build_setup") return "build-setup"; const filled = S.build.days.filter((d) => d.exercises.length).length; return filled === 0 ? "build-empty" : filled < S.build.days.length ? "build-partial" : "build-ready"; }
    if (r === "import") { if (s === "preview") return "import-preview"; if (S.importDraft) return "import-review"; if (S.importMode === "file") return "import-source"; const ff = S.ff; if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps"; if (ff.status === "unreadable") return "ff-unreadable"; return ff.stage === 1 ? (ff.input ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply"; }
    if (r === "shared") return "shared-preview";
    return "";
  }
  function routeView() {
    const qs = QUESTIONS[S.route] || []; const qi = qs.indexOf(S.step);
    let body, primary = "";
    const iss = issues(); const pending = S.avoid.pending || S.pref.pending;
    if (qi >= 0) {
      body = question();
      const reason = pending ? "pendingAvoidNote" : iss.length ? "exReason" : "";
      primary = `${iss.length && !pending ? `<p class="t-caption" id="exReason">${esc(TS.issueText(t, iss))}</p>` : ""}<button type="button" class="btn btn--primary" data-advance data-act="next"${iss.length || pending ? ` disabled aria-describedby="${reason}"` : ""}>${esc(S.step === "custom_shape" ? t("entry.custom_shape.generate") : t("entry.next"))}</button>`;
    } else if (S.step === "catalogue") body = catalogue();
    else if (S.step === "build_setup") {
      const ok = !!(S.answers.programName && S.answers.daysPerWeek);
      body = `<h1 class="t-title">${esc(t("entry.build_setup.title"))}</h1><label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="exName" type="text" data-field="exName" value="${esc(S.answers.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>` + group(t("entry.build_setup.days"), `<div class="grid-3">${TS.DAYS.map((n) => choice({ key: "daysPerWeek", val: n, title: String(n), cap: t("entry.schedule.days.sub"), selected: S.answers.daysPerWeek === n, cls: "choice--seg ex-num" })).join("")}</div>`, "gBDays");
      primary = `<button type="button" class="btn btn--primary" data-advance data-act="next"${ok ? "" : ' disabled aria-describedby="exBReason"'}>${esc(t("entry.build_setup.open"))}</button>${ok ? "" : `<p class="t-caption" id="exBReason">${esc(TS.issueText(t, ["program_name_required"]))}</p>`}`;
    } else if (S.step === "import_source") body = importSource();
    else if (S.route === "build" || S.editing) { const e = editor(S.route === "build"); body = e.html; primary = `<button type="button" class="btn btn--primary" data-activate data-act="activate"${e.ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(t("entry.editor.use"))}</button>`; }
    else if (reviewing() && S.result) { body = review(); primary = S.notice === "conflict" ? "" : `${S.error ? `<p class="t-caption" id="exActErr" role="alert">${esc(S.error)}</p>` : ""}<button type="button" class="btn btn--primary" data-activate data-act="activate">${esc(t(TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.preview.activate_first"))}</button>`; }
    else body = `<p class="t-small">${esc(S.error || t("x.issue.generic"))}</p>`;
    const counter = qi >= 0 ? `<p class="t-label" aria-live="polite">${esc(t("entry.step", { n: qi + 1, total: qs.length }))}</p><div class="segbar" data-progress-dimension="task" data-progress-scope="entry-route-step">${qs.map((_, i) => `<span class="segbar__seg${i <= qi ? " is-done" : ""}"></span>`).join("")}</div>` : "";
    return `<div class="page ex-page"><header class="row row--between ex-head"><button type="button" class="btn btn--link" data-act="back">${esc(t("entry.back"))}</button><span class="t-caption">${esc(TS.routeName(t, S.route))}</span><button type="button" class="btn btn--link" data-act="cancel">${esc(t("entry.cancel"))}</button></header>${counter}
      <main class="stack view-enter" data-entry-step="${esc(S.step)}"${S.editing ? " data-editor" : ""} data-checkpoint="${esc(checkpointFor())}">${body}</main>
      ${primary ? `<footer class="pinned" data-persistent-action>${primary}</footer>` : ""}</div>`;
  }
  function landingView() {
    if (S.view === "shared-gate") { const p = S.shared.program.meta; return `<main class="page stack" data-checkpoint="shared-gate"><p class="t-label t-label--accent">${esc(t("landing.shared.eyebrow"))}</p><h1 class="t-title">${esc(t("landing.shared.headline"))}</h1><p class="t-lede">${esc(t("landing.shared.body"))}</p><button type="button" id="firstRunSharedStart" class="btn btn--primary" data-act="shared-start">${esc(t("setup.shared.title"))}</button><p class="t-caption">${esc(t(p.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: p.name, n: p.daysPerWeek }))}</p><p class="t-small">${esc(t("x.shared.what"))}</p><p class="t-small">${esc(t("x.shared.nothing_saved"))}</p></main>`; }
    const invalid = S.view === "shared-invalid";
    return `<main class="page stack ex-landing" data-checkpoint="${invalid ? "shared-invalid" : "landing"}"><h1 class="t-title">${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1><p class="t-lede">${esc(t(invalid ? "landing.shared.invalid_body" : "landing.body"))}</p>${invalid ? `<p class="status-line" role="status">${esc(t(TF.sharedErrorKey(S.sharedError)))}</p>` : ""}
      <div class="stack stack--tight"><button type="button" id="firstRunCreate" class="btn btn--primary" data-act="land-create">${esc(t("landing.build"))}</button><button type="button" id="firstRunImport" class="btn btn--bordered" data-act="land-import">${esc(t("landing.track"))}</button></div>
      ${invalid ? "" : TS.landingProof(t, lang)}<p class="t-caption">${esc(t("x.privacy.line"))}</p>${TS.privacyButton(t)}</main>`;
  }
  function hubView() {
    const existing = TF.hasActiveProgram(); const info = TF.loadDraft();
    const door = (route, extra = "", primary = false) => `<button type="button" class="choice${primary ? " is-featured" : ""}" data-act="route" data-route="${route}" ${extra}><span class="choice__body"><span class="choice__title">${esc(t(`entry.hub.${route === "import" && extra.includes("freeform") ? "freeform" : route}.title`))}</span><span class="choice__cap">${esc(t(`entry.hub.${route === "import" && extra.includes("freeform") ? "freeform" : route}.cap`))}</span></span></button>`;
    let card = "";
    if (info && info.status === "rules_changed") card = TS.rulesNotice(t);
    else if (info && info.status !== "corrupt") { const f = TS.resumeFacts(t, lang, info); card = `<section class="card" data-checkpoint="resume"><div class="card__body stack stack--tight"><h2 class="t-subtitle">${esc(t("entry.resume.title"))}</h2><p class="t-small">${esc(f.route)} · ${esc(f.step)} · ${esc(f.when)}</p><button type="button" class="btn btn--primary btn--noarrow" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="resume-restart">${esc(t("entry.resume.restart"))}</button></div></section>`; }
    const help = `<details class="disclosure" data-act="help-toggle"${S.helpOpen ? " open" : ""}${S.helpOpen ? ' data-checkpoint="route-help"' : ""}><summary>${esc(t("ex.help"))}<span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body stack stack--tight" role="radiogroup" aria-label="${esc(t("ex.help_q"))}">${["recommend", "custom", "browse", "build", "import"].map((j) => `<button type="button" class="choice choice--compact" role="radio" aria-checked="${S.help === j}" data-act="help-pick" data-job="${j}"><span class="choice__body"><span class="choice__title">${esc(t(`ex.help.${j}`))}</span></span></button>`).join("")}${S.help ? `<button type="button" class="btn" data-act="help-go" data-help-result="${S.help}">${esc(t("ex.help_go", { route: TS.routeName(t, S.help) }))}</button>` : ""}</div></details>`;
    return `<div class="page"><header class="row"><button type="button" class="btn btn--link" data-act="hub-back">${esc(t("entry.back"))}</button></header><main class="stack view-enter" data-checkpoint="${existing ? "hub-existing" : "route-choice"}"><h1 class="t-title">${esc(t("entry.hub.title"))}</h1><p class="t-lede">${esc(t("entry.hub.lede"))}</p>${existing ? TS.activeNotice(t) : ""}${card}
      ${door("recommend", "", true)}${door("custom")}${door("browse")}
      <details class="disclosure" data-act="own-toggle"${S.own ? " open" : ""}><summary>${esc(t("entry.hub.own.title"))}<span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body stack stack--tight">${door("build")}${door("import", 'data-mode="freeform"')}${door("import", 'data-mode="file"')}</div></details>${help}</main></div>`;
  }
  function sheetView() {
    if (!S.sheet) return "";
    const a = S.sheetAnswers;
    const body = S.sheet === "days" ? `<div class="grid-3" role="radiogroup" aria-label="${esc(t("entry.schedule.days.label"))}">${TS.DAYS.map((n) => choice({ key: "daysPerWeek", val: n, title: String(n), cap: t("entry.schedule.days.sub"), selected: a.daysPerWeek === n, cls: "choice--seg ex-num" })).join("")}</div>`
      : `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("entry.environment.title"))}">${TS.ENVS.map((v) => choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment?.kind === v, cls: "choice--compact" })).join("")}</div>${TS.environmentCorrection(t, a.environment, { open: true })}`;
    return `<div class="sheet-scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="exSheetTitle"><span class="sheet__grab" aria-hidden="true"></span><div class="stack"><h2 class="t-section" id="exSheetTitle">${esc(t(S.sheet === "days" ? "entry.schedule.days.label" : "entry.environment.title"))}</h2>${body}<button type="button" class="btn btn--primary btn--noarrow" data-act="sheet-apply">${esc(t("ex.apply"))}</button><button type="button" class="btn btn--quiet" data-act="sheet-close">${esc(t("ex.close"))}</button></div></div>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return TS.cancelSheet(t);
    if (S.overlay === "replace") return TS.replaceSheet(t, TF.activeName(lang), name(), TF.device.sessions);
    if (S.overlay === "restart") return TS.restartSheet(t, { shared: S.route === "shared" });
    return "";
  }
  function render(focus) {
    const saved = document.activeElement && document.activeElement.id;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (S.view === "hub") html = hubView();
    else if (S.view === "route") html = routeView();
    else html = landingView();
    root.innerHTML = html + sheetView() + overlayView();
    if (saved && /Search|ffIn|ffOut|exName|pickerSearch/.test(saved) && !focus) TS.refocus(root, saved); else if (focus) TS.focusHeading(root);
  }

  /* ---------- actions ---------- */
  function on(act, d) {
    S.cpTag = null;
    if (act === "land-create") { S.view = "hub"; render(true); return; }
    if (act === "land-import") { go("import", "freeform"); return; }
    if (act === "hub-back") { S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return; }
    if (act === "own-toggle") { S.own = !S.own; return; }
    if (act === "help-toggle") { S.helpOpen = !S.helpOpen; return; }
    if (act === "help-pick") { S.help = d.job; S.helpOpen = true; render(); return; }
    if (act === "help-go") { go(d.helpResult, d.helpResult === "import" ? "freeform" : undefined); return; }
    if (act === "route") { go(d.route, d.mode); return; }
    if (act === "pick") {
      if (S.sheet) { S.sheetAnswers = TS.applyPick(S.sheetAnswers, d.key, d.val); render(); return; }
      if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
      if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
      S.answers = TS.applyPick(S.answers, d.key, d.val); if (!reviewing()) S.result = null; render(); return;
    }
    if (act === "next") { advance(); return; }
    if (act === "back") { back(); return; }
    if (act === "cancel") { if (S.route === "shared") { S.view = "shared-gate"; S.route = null; render(true); return; } S.overlay = "cancel"; render(); return; }
    if (act === "cancel-continue") { S.overlay = null; render(); return; }
    if (act === "cancel-keep") { keepDraft(); S.overlay = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; S.route = null; render(true); return; }
    if (act === "cancel-discard") { TF.clearDraft(); const active = TF.hasActiveProgram(); S = { ...S, view: active ? "today" : "landing", route: null, step: null, answers: {}, result: null, overlay: null, editing: false }; render(true); return; }
    if (act === "resume") { const info = TF.loadDraft(); if (!info) return; S.view = "route"; S.route = info.state.route; S.step = info.state.step; S.answers = JSON.parse(JSON.stringify(info.state.answers)); S.result = info.state.result; S.revAtStart = info.state.activeProgramRevisionAtStart; if (S.step === "result" && !S.result) compileNow(); render(true); return; }
    if (act === "resume-restart") { TF.clearDraft(); render(true); return; }
    if (act === "rules-rebuild") { const info = TF.loadDraft(); TF.clearDraft(); if (info?.state) { S.view = "route"; S.route = info.state.route; S.step = info.state.step; S.answers = JSON.parse(JSON.stringify(info.state.answers)); } render(true); return; }
    if (act === "avoid-add") { S.avoid.pending = d.id; S.avoid.query = ""; render(); return; }
    if (act === "avoid-remove") { S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); if (S.avoid.pending === d.id) S.avoid.pending = null; if (S.pref.pending === d.id) S.pref.pending = null; render(); return; }
    if (act === "pref-add") { if (d.status === "include") S.answers.mustHaveExercises = [...(S.answers.mustHaveExercises || []), d.id]; else S.pref.pending = d.id; S.pref.query = ""; render(); return; }
    if (act === "pref-remove") { S.answers.mustHaveExercises = (S.answers.mustHaveExercises || []).filter((x) => x !== d.id); S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); render(); return; }
    if (act === "field:avoidQuery") { S.avoid.query = d.value; render(); return; }
    if (act === "field:prefQuery") { S.pref.query = d.value; render(); return; }
    if (act === "field:exName") { S.answers.programName = d.value.trim(); render(); return; }
    if (act === "field:dayName") { S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return; }
    if (act === "field:rx" || act === "change:rx") { S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return; }
    if (act === "field:pickerQuery") { if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return; }
    if (act === "build") { S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(); return; }
    if (act === "pick-exercise") { if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return; }
    if (act === "card") { const c = TF.browseCards(answers()).find((x) => x.id === d.id); if (!c) return; S.answers.catalogueSelection = c.id; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.step = "preview"; render(true); return; }
    if (act === "import-mode") { S.importMode = d.mode; S.importDraft = null; S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-file") { S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("ex.file_name"), "file"); render(true); return; }
    if (act === "imp") { if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return; }
    if (act === "import-commit") { S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.step = "preview"; S.importDraft = null; render(true); return; }
    if (act === "ff") {
      if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
      else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); }
      else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
      if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); S.importMode = "freeform"; }
      render(); return;
    }
    if (act === "field:ffInput") { S.ff = TS.freeform.apply(S.ff, "input", d.value); render(); return; }
    if (act === "field:ffReply") { S.ff = TS.freeform.apply(S.ff, "reply", d.value); return; }
    if (act === "field:gap") { S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return; }
    if (act === "shared-start") { S.view = "route"; S.route = "shared"; S.step = "preview"; S.result = TF.sharedResult(S.shared); render(true); return; }
    if (act === "edit") { S.build = TS.build.fromPreview(S.result.preview, { name: name() }); S.editing = true; render(true); return; }
    if (act === "edit-done") { S.prev = S.result.preview; S.result = TS.build.commit(S.result, S.build); S.editing = false; render(true); return; }
    if (act === "activate") { requestActivate(); return; }
    if (act === "replace-confirm") { S.overlay = null; activateNow(); return; }
    if (act === "replace-cancel") { S.overlay = null; render(); return; }
    if (act === "conflict-review") { S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return; }
    if (act === "restart") { S.overlay = "restart"; render(); return; }
    if (act === "restart-cancel") { S.overlay = null; render(); return; }
    if (act === "restart-confirm") { const shared = S.route === "shared"; S = { ...S, overlay: null, route: null, step: null, answers: {}, result: null, prev: null, view: shared ? "landing" : "hub" }; render(true); return; }
    if (act === "sheet-open") { S.sheet = d.sheet; S.sheetAnswers = JSON.parse(JSON.stringify(S.answers)); render(); return; }
    if (act === "sheet-close") { S.sheet = null; render(); return; }
    if (act === "sheet-apply") { S.prev = S.result.preview; S.answers = S.sheetAnswers; S.sheet = null; compileNow(); render(true); return; }
  }

  /* ---------- checkpoint reach (states built through the same actions) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  const customA = () => TF.fixtureAnswers("custom");
  function at(route, step, a) { S.view = "route"; S.route = route; S.step = step; S.answers = a; S.result = null; S.prev = null; S.revAtStart = TF.liveRevision(); }
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("ex.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  async function reach(cp) {
    const u = TF.F.users;
    const build = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [d, id] of plan) { S.build.picker = d; S.build = TS.build.apply(S.build, "add", id); } };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": S.view = "hub"; break;
      case "route-help": S.view = "hub"; S.helpOpen = true; break;
      case "rec-goal": at("recommend", "desired_result", {}); break;
      case "rec-background": at("recommend", "background", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": { const a = rafael(); at("recommend", "environment", a); break; }
      case "rec-env-correction": { const a = rafael(); const c = u.rafael.correction; a.environment = TF.env(c.environmentKind); a.environment.equipment = [...c.equipmentAdd]; a.environment.capabilities = [...c.capabilitiesAdd]; at("recommend", "environment", a); S.envOpen = true; S.cpTag = "rec-env-correction"; break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; at("recommend", "priorities", a); S.cpTag = "rec-avoid-pain"; break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); compileNow(); if (cp === "activate") S.cpTag = "activate"; if (cp === "replace-confirm") S.overlay = "replace"; break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); compileNow(); const before = S.result.preview; const c = u.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...c.equipmentAdd]; e.capabilities = [...c.capabilitiesAdd]; S.answers = { ...S.answers, environment: e }; compileNow(); S.prev = before; S.cpTag = cp; break; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; at("recommend", "result", a); compileNow(); S.cpTag = cp; break; }
      case "browse-filters": at("browse", "schedule", {}); break;
      case "browse-list": at("browse", "catalogue", TF.fixtureAnswers("browse")); break;
      case "browse-preview": at("browse", "catalogue", TF.fixtureAnswers("browse")); on("card", { id: "balanced_4_v1" }); return;
      case "custom-priorities": at("custom", "priorities", customA()); break;
      case "custom-exercises": at("custom", "exercise_preferences", customA()); break;
      case "custom-shape": { const a = customA(); a.splitPreference = TF.splitChoices(a).choices[0].id; at("custom", "custom_shape", a); break; }
      case "custom-result": { const a = customA(); a.splitPreference = TF.splitChoices(a).choices[0].id; at("custom", "result", a); compileNow(); break; }
      case "build-setup": at("build", "build_setup", {}); break;
      case "build-empty": build([]); break;
      case "build-partial": build([["manual_d1", "pd_bw"]]); break;
      case "build-ready": build([["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]); break;
      case "ff-empty": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = TS.freeform.create(); break;
      case "ff-filled": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(1); break;
      case "ff-handoff": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(2); break;
      case "ff-reply": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3); break;
      case "ff-gaps": case "ff-gaps-invalid": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyGaps[lang]); if (cp === "ff-gaps-invalid") S.ff = TS.freeform.apply(S.ff, "gap-submit"); break;
      case "ff-unreadable": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyUnreadable[lang]); break;
      case "import-source": at("import", "import_source", {}); S.importMode = "file"; break;
      case "import-review": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("ex.file_name"), "file"); break;
      case "import-preview": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = importDecided(); on("import-commit", {}); return;
      case "shared-gate": case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; if (cp === "shared-preview" && r.ok) { on("shared-start", {}); return; } break; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "activation-conflict": at("recommend", "result", rafael()); compileNow(); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; break;
      case "activated-today": at("recommend", "result", rafael()); compileNow(); activateNow(); return;
      default: S.view = "landing";
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md); a deliberate subset ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  async function recommendAnswers(api, a) {
    await api.tap(pickKey("desiredResult", a.desiredResult)); await api.tap("[data-advance]");
    await api.tap(pickKey("structuredExperience", a.structuredExperience)); await api.tap(pickKey("recentConsistency", a.recentConsistency)); await api.tap("[data-advance]");
    await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap(pickKey("preferredRestSeconds", a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds)); await api.tap("[data-advance]");
    await api.tap(pickKey("environment", a.environment.kind)); await api.tap("[data-advance]");
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function addExercise(api, dayId, id) {
    await api.tap(`[data-build="open-picker"][data-day="${dayId}"]`);
    await api.type("#pickerSearch", TF.libraryName(TF.libraryEntry(id), api.lang));
    await api.tap(`[data-act="pick-exercise"][data-id="${id}"]`);
  }
  async function decideRows(api) {
    for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`);
  }
  const journeys = {
    async "activate.recommend"(api) {
      await api.tap("#firstRunCreate"); await api.tap('[data-act="route"][data-route="recommend"]');
      await recommendAnswers(api, TF.fixtureAnswers("rafael"));
      await api.tap("[data-advance]"); /* priorities: optional, none chosen */
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.build"(api) {
      await api.tap({ selector: "summary", text: api.t("entry.hub.own.title") }); await api.tap('[data-act="route"][data-route="build"]');
      await api.type("#exName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
      for (const [d, ids] of [["manual_d1", ["sq_bb", "pr_bb"]], ["manual_d2", ["pd_bw", "rw_bb"]], ["manual_d3", ["sq_lp"]]]) for (const id of ids) await addExercise(api, d, id);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.import-file"(api) { await api.tap('[data-act="import-file"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api); },
    async "activate.import-paste"(api) {
      await api.type("#ffIn", TF.F.freeform.pasted[api.lang]); await api.tap('[data-ff="continue"]'); await api.tap('[data-ff="open"][data-provider="chatgpt"]'); await api.tap('[data-ff="clipboard"]');
      for (const g of S.ff.gap.gaps) await api.type(`[data-field="gap"][data-key="${g.key}"]`, g.field === "reps" ? "10-12" : "3");
      await api.tap('[data-ff="gap-submit"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.shared"(api) { await api.tap("#firstRunSharedStart"); api.snapshot("review"); await activateAndWait(api); },
    async "edit.roundtrip"(api) { api.snapshot("before"); await api.tap('[data-act="edit"]'); await api.tap('[data-act="edit-done"]'); api.snapshot("after"); await activateAndWait(api); },
    async "edit.remove-two.editor"(api) { api.snapshot("before"); await api.tap('[data-act="edit"]'); for (const d of S.build.days.slice(0, 2)) await api.tap(`[data-build="remove"][data-id="${d.exercises[0].id}"]`); await activateAndWait(api); },
    async "edit.remove-two.review"(api) { api.snapshot("before"); await api.tap('[data-act="edit"]'); for (const d of S.build.days.slice(0, 2)) await api.tap(`[data-build="remove"][data-id="${d.exercises[0].id}"]`); await api.tap('[data-act="edit-done"]'); api.snapshot("after"); await activateAndWait(api); },
    async "build.gating"(api) {
      await api.type("#exName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
      api.snapshot("empty"); await addExercise(api, "manual_d1", "pd_bw"); api.snapshot("partial");
      await addExercise(api, "manual_d2", "rw_bb"); await addExercise(api, "manual_d3", "sq_lp"); api.snapshot("ready"); await activateAndWait(api);
    },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "cancel.keep-resume"(api) {
      await api.tap(pickKey("daysPerWeek", 4)); api.snapshot("before");
      await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); api.snapshot("kept");
      await api.tap("#firstRunCreate"); await api.tap('[data-act="resume"]'); api.snapshot("resumed");
    },
    async "back.import"(api) { await decideRows(api); api.snapshot("decided"); await api.tap('[data-act="import-commit"]'); api.snapshot("preview"); await api.tap('[data-act="back"]'); api.snapshot("back"); },
    async "back.shared"(api) { await api.tap('[data-act="back"]'); },
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "existing.back"(api) { await api.tap('[data-act="hub-back"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "avoid.pain"(api) {
      await api.tap(pickKey("primaryMuscles", "chest"));
      await api.type("#avoidSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]'); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned"); await api.tap("[data-advance]"); api.snapshot("review");
    },
    async overlays(api) {
      for (const s of ["days", "env"]) { await api.tap(`[data-act="sheet-open"][data-sheet="${s}"]`); await api.checkOverlay('[data-act="sheet-apply"]', s); await api.tap('button[data-act="sheet-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-act="sheet-open"][data-sheet="days"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="sheet-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      api.mark("start"); await api.tap('[data-act="sheet-open"][data-sheet="env"]');
      await api.tap(pickKey("environment", "limited_home")); await api.tap(pickKey("environmentEquipment", "dumbbell")); await api.tap(pickKey("environmentEquipment", "band")); await api.tap(pickKey("environmentCapabilities", "safe_pull"));
      await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "recommend.required"(api) {
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap("[data-advance]");
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m")); await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most")); await api.tap("[data-advance]");
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3)); await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60)); await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120)); await api.tap("[data-advance]");
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap("[data-advance]"); await api.tap("[data-advance]"); api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, sel] of [["recommend", '[data-route="recommend"]'], ["custom", '[data-route="custom"]'], ["browse", '[data-route="browse"]'], ["build", '[data-route="build"]'], ["import", '[data-route="import"][data-mode="file"]']]) {
        if (!api.find(sel)) await api.tap({ selector: "summary", text: api.t("entry.hub.own.title") });
        await api.tap(sel); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
      }
    },
    async "help.browse"(api) { await api.tap({ selector: "summary", text: t("ex.help") }); await api.tap('[data-act="help-pick"][data-job="browse"]'); await api.tap("[data-help-result]"); api.snapshot("end"); },
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates._example = {
    id: "_example", name: "Example (placeholder)", policy: { productDecisions: [] },
    async mount(c) { lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); TS.wire(root, on); render(); },
    reach,
    /* The result is what activation would commit: the Build draft in the
       Build editor, the committed edit in Edit before using. */
    entry: () => (S.view === "route" && S.route ? TF.jsonClean({ route: S.route, step: S.step, answers: answers(), result: S.route === "build" && S.build ? TS.build.result(S.build) : S.editing && S.build && S.result ? TS.build.commit(S.result, S.build) : S.result }) : null),
    journeys,
    state: () => S,
  };
})();
