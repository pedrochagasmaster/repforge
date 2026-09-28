/* Candidate B · Cinco portas honestas
   Thesis: keep the five jobs and make choosing one cheap. Every door states
   its cost and its outcome; questions stay grouped by consequence with an
   answer rail that makes every earlier answer one tap away; the result leads
   with the program itself, reasons second; recovery states live inline where
   the lifter is, not on separate screens.
   Product policy: none changed. ROUTE_STEPS, activation rules, replacement
   confirmation, shared gate, import review and free-form stages are the
   production ones. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    en: {
      "b.land.head": "Know what to do at the gym today.",
      "b.land.lede": "Taurifer turns a program into sessions, logs every set, and sets the next target itself.",
      "b.land.build": "Get a program",
      "b.land.build_cap": "Answer a few questions or pick a ready-made one",
      "b.land.own": "I already have a program",
      "b.land.own_cap": "Paste it, import a file, or write it in",
      "b.hub.title": "How do you want to start?",
      "b.hub.lede": "Five ways in. Each one says what it asks of you and what you get back.",
      "b.hub.featured": "Most people start here",
      "b.hub.ask": "You do",
      "b.hub.get": "You get",
      "b.hub.help": "Not sure which one?",
      "b.hub.help_q1": "Do you already have a program you want to follow?",
      "b.hub.help_yes": "Yes, I have one",
      "b.hub.help_no": "No, I need one",
      "b.hub.help_q2": "Do you want to pick exercises yourself?",
      "b.hub.help_pick": "Yes, I have preferences",
      "b.hub.help_nopick": "No, decide for me",
      "b.hub.help_go": "Go with {route}",
      "b.rail.goal": "Goal",
      "b.rail.days": "{n} days",
      "b.rail.minutes": "up to {n} min",
      "b.rail.rest": "rest {v}",
      "b.rail.rest_auto": "rest auto",
      "b.rail.edit": "Change {what}",
      "b.q.goal": "What should this program prioritize?",
      "b.q.background": "How have you been training?",
      "b.q.background_lede": "Two facts. They decide how much work the first weeks carry.",
      "b.q.schedule": "Fit it into your week",
      "b.q.schedule_lede": "Days and the longest session you can usually do.",
      "b.q.environment": "Where do you train?",
      "b.q.environment_lede": "Pick the closest. Correct the equipment if something is off.",
      "b.q.priorities": "Anything to prioritize or avoid?",
      "b.q.priorities_lede": "Optional. Skip it and Taurifer balances everything.",
      "b.q.custom_prio": "Set the emphasis per muscle",
      "b.q.custom_ex": "Exercises to include or avoid",
      "b.q.shape": "Your weekly structure",
      "b.res.title": "Your program",
      "b.res.custom_title": "Your custom program",
      "b.res.why": "Why this program",
      "b.res.adjust": "What Taurifer adjusted",
      "b.res.constraints": "Your constraints",
      "b.res.change": "Change an answer",
      "b.res.det": "Same answers, same program, every time.",
      "b.browse.title": "Ready-made programs",
      "b.browse.lede": "Complete programs you can run and edit. Filtered by your week and your gym.",
      "b.build.title": "Write your program",
      "b.import.title": "Bring your program",
      "b.import.file": "Choose a Taurifer file",
      "b.import.file_cap": ".json or .txt exported from Taurifer",
      "b.import.paste": "Paste it as text",
      "b.import.paste_cap": "A coach's message, your notes, a spreadsheet column",
      "b.import.review_title": "Review the exercises",
      "b.import.review_lede": "Match each imported name to the library, or keep it as written. Nothing is saved yet.",
      "b.shared.head": "A program was sent to you.",
      "b.shared.lede": "Review it, then start it on this phone.",
      "b.shared.by": "Received via link",
      "b.resume.title": "Pick up where you left off?",
      "b.resume.at": "{route} · {step} · saved {when}",
      "b.today.toast": "Program active. Your first session is on Today.",
      "b.edit.title": "Edit before using",
      "b.edit.done": "Back to review",
      "b.skip": "Skip this section",
      "b.continue": "Continue",
      "b.back": "Back",
      "b.cancel": "Cancel",
      "b.exit": "Leave",
      "b.open_editor": "Open the editor",
      "b.file_picked": "Rafael's program.json",
      "b.section": "Section {n} of {total}",
      "b.custom.shape_only": "Only one weekly structure fits these answers.",
    },
    pt: {
      "b.land.head": "Saiba o que fazer na academia hoje.",
      "b.land.lede": "O Taurifer transforma um programa em sessões, registra cada série e já define a próxima meta.",
      "b.land.build": "Quero um programa",
      "b.land.build_cap": "Responda algumas perguntas ou escolha um pronto",
      "b.land.own": "Já tenho um programa",
      "b.land.own_cap": "Cole, importe um arquivo ou escreva o seu",
      "b.hub.title": "Como você quer começar?",
      "b.hub.lede": "Cinco caminhos. Cada um diz o que pede de você e o que devolve.",
      "b.hub.featured": "A maioria começa por aqui",
      "b.hub.ask": "Você faz",
      "b.hub.get": "Você recebe",
      "b.hub.help": "Não sabe qual escolher?",
      "b.hub.help_q1": "Você já tem um programa que quer seguir?",
      "b.hub.help_yes": "Sim, já tenho",
      "b.hub.help_no": "Não, preciso de um",
      "b.hub.help_q2": "Quer escolher os exercícios você mesmo?",
      "b.hub.help_pick": "Sim, tenho preferências",
      "b.hub.help_nopick": "Não, decida por mim",
      "b.hub.help_go": "Ir de {route}",
      "b.rail.goal": "Objetivo",
      "b.rail.days": "{n} dias",
      "b.rail.minutes": "até {n} min",
      "b.rail.rest": "descanso {v}",
      "b.rail.rest_auto": "descanso automático",
      "b.rail.edit": "Alterar {what}",
      "b.q.goal": "O que este programa deve priorizar?",
      "b.q.background": "Como você vem treinando?",
      "b.q.background_lede": "Dois fatos. Eles decidem quanto trabalho as primeiras semanas carregam.",
      "b.q.schedule": "Encaixe na sua semana",
      "b.q.schedule_lede": "Dias e a sessão mais longa que você costuma conseguir.",
      "b.q.environment": "Onde você treina?",
      "b.q.environment_lede": "Escolha o mais próximo. Corrija o equipamento se algo estiver errado.",
      "b.q.priorities": "Algo para priorizar ou evitar?",
      "b.q.priorities_lede": "Opcional. Pule e o Taurifer equilibra tudo.",
      "b.q.custom_prio": "Defina a ênfase por músculo",
      "b.q.custom_ex": "Exercícios para incluir ou evitar",
      "b.q.shape": "Sua estrutura semanal",
      "b.res.title": "Seu programa",
      "b.res.custom_title": "Seu programa personalizado",
      "b.res.why": "Por que este programa",
      "b.res.adjust": "O que o Taurifer ajustou",
      "b.res.constraints": "Suas restrições",
      "b.res.change": "Alterar uma resposta",
      "b.res.det": "Mesmas respostas, mesmo programa, sempre.",
      "b.browse.title": "Programas prontos",
      "b.browse.lede": "Programas completos que você pode seguir e editar. Filtrados pela sua semana e pela sua academia.",
      "b.build.title": "Escreva seu programa",
      "b.import.title": "Traga seu programa",
      "b.import.file": "Escolher um arquivo Taurifer",
      "b.import.file_cap": ".json ou .txt exportado do Taurifer",
      "b.import.paste": "Colar como texto",
      "b.import.paste_cap": "Mensagem do treinador, suas anotações, uma coluna de planilha",
      "b.import.review_title": "Revise os exercícios",
      "b.import.review_lede": "Vincule cada nome importado à biblioteca ou mantenha como está escrito. Nada foi salvo ainda.",
      "b.shared.head": "Enviaram um programa para você.",
      "b.shared.lede": "Revise e depois comece neste celular.",
      "b.shared.by": "Recebido por link",
      "b.resume.title": "Continuar de onde parou?",
      "b.resume.at": "{route} · {step} · salvo {when}",
      "b.today.toast": "Programa ativo. Sua primeira sessão está em Hoje.",
      "b.edit.title": "Editar antes de usar",
      "b.edit.done": "Voltar à revisão",
      "b.skip": "Pular esta seção",
      "b.continue": "Continuar",
      "b.back": "Voltar",
      "b.cancel": "Cancelar",
      "b.exit": "Sair",
      "b.open_editor": "Abrir o editor",
      "b.file_picked": "Treino do Rafael.json",
      "b.section": "Seção {n} de {total}",
      "b.custom.shape_only": "Só uma estrutura semanal combina com estas respostas.",
    },
  };
  const STEPS = TF.Entry.ROUTE_STEPS;
  let ctx, t, lang, root, S;

  function fresh(seed) {
    TF.seedDevice(seed === "existing" ? "existing" : "fresh");
    S = { view: "landing", route: null, step: null, answers: {}, result: null, notice: null, overlay: null, own: false, help: null, ff: TS.freeform.create(), importDraft: null, build: null, importMode: "file", avoid: { query: "", pending: null }, pref: { query: "", pending: null }, picker: null, editing: false, pinned: false, revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, draft: null };
  }
  const routeLabel = (r) => t(`entry.route.${r}`);
  const stepLabel = (route, step) => ({ desired_result: t("b.q.goal"), background: t("b.q.background"), schedule: t("b.q.schedule"), environment: t("b.q.environment"), priorities: route === "custom" ? t("b.q.custom_prio") : t("b.q.priorities"), exercise_preferences: t("b.q.custom_ex"), custom_shape: t("b.q.shape"), result: t("b.res.title"), preview: t("entry.preview.title"), catalogue: t("b.browse.title"), build_setup: t("b.build.title"), editor: t("b.build.title"), import_source: t("b.import.title") }[step] || step);
  const answers = () => TF.normalizeAnswers(S.answers);
  const stepIndex = () => STEPS[S.route].indexOf(S.step);
  const total = () => ({ recommend: 5, custom: 7, browse: 3, build: 1, import: 1, shared: 1 }[S.route]);
  const sectionNo = () => Math.min(total(), stepIndex() + 1);
  function entry(extra = {}) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step: S.step === "result" || S.step === "catalogue" ? "preview" : S.step === "editor" ? "editor" : S.step, activeProgramRevisionAtStart: S.revAtStart, versions: S.draft?.state?.versions, ...extra }); }
  function validation() { try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: answers(), result: S.result, step: S.step, activeProgramRevisionAtStart: S.revAtStart })); } catch (e) { return [String(e.message)]; } }
  function compileNow() { const r = TF.compile(S.route === "custom" ? "custom" : "recommend", answers()); if (r.ok) { S.result = { fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, candidates: r.candidates, alternative: r.alternative, preview: r.preview, explanation: r.explanation, telemetry: r.telemetry }; S.compileError = null; } else { S.result = null; S.compileError = r; } }
  const resultName = () => (S.result ? (lang === "pt" ? S.result.namePt || S.result.name : S.result.name) || S.answers.programName || t("untitled_program") : "");

  /* ---------- navigation ---------- */
  function go(route) { S.route = route; S.step = STEPS[route][0]; S.result = null; S.view = "route"; S.notice = null; S.revAtStart = TF.liveRevision(); if (route === "import") { S.ff = TS.freeform.create(); S.importDraft = null; } render(true); }
  function advance() {
    if (S.step === "build_setup") { const name = root.querySelector("#bName"); if (name) S.answers.programName = name.value.trim(); }
    const issues = validation(); if (issues.length) { S.validation = true; render(); return; }
    S.validation = false;
    if (S.step === "build_setup") { S.build = TS.build.create(S.answers.programName, S.answers.daysPerWeek); S.step = "editor"; render(true); return; }
    const steps = STEPS[S.route]; let next = steps[Math.min(stepIndex() + 1, steps.length - 1)];
    if (next === "custom_shape") { const splits = TF.splitChoices(answers()); if (splits.choices.length === 1) { S.answers.splitPreference = splits.choices[0].id; } else if (splits.choices.length && !splits.choices.some((c) => c.id === S.answers.splitPreference)) S.answers.splitPreference = (splits.choices.find((c) => c.default) || splits.choices[0]).id; }
    S.step = next; if (next === "result") compileNow(); render(true);
  }
  function back() {
    if (S.overlay) { S.overlay = null; render(); return; }
    if (S.editing) { S.editing = false; render(true); return; }
    if (!S.route || S.step === STEPS[S.route][0] || S.step === "editor") { S.overlay = "cancel"; render(); return; }
    if (S.step === "activation_conflict") { S.step = "preview"; render(true); return; }
    const steps = STEPS[S.route]; let prev = steps[Math.max(0, stepIndex() - 1)];
    if (S.route === "custom" && prev === "custom_shape" && TF.splitChoices(answers()).choices.length <= 1) prev = "exercise_preferences";
    S.step = prev; render(true);
  }
  function jumpTo(step) { S.step = step; S.result = null; render(true); }
  function activateNow() {
    const state = entry({ step: S.route === "build" ? "editor" : "preview" });
    const r = TF.activate(state, { pinnedVersionsExecutable: S.pinned });
    if (r.ok) { S.view = "today"; S.toast = t("b.today.toast"); render(true); return; }
    if (r.code === "active_program_changed") { S.step = "activation_conflict"; S.notice = "conflict"; render(true); return; }
    if (r.code === "rules_changed_rebuild_required") { S.notice = "rules_changed"; render(); return; }
    S.activationIssues = r.issues || [r.code]; render();
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }

  /* ---------- chrome ---------- */
  function chrome(body, { nav = true, progress = true, backLabel } = {}) {
    const stepsShown = progress && S.route && !["result", "preview", "catalogue", "editor", "build_setup", "import_source", "activation_conflict"].includes(S.step) && S.route !== "shared";
    const showNext = S.route && !["result", "preview", "catalogue", "import_source", "activation_conflict", "editor"].includes(S.step);
    const issues = showNext ? validation() : [];
    const pendingReason = S.avoid.pending || S.pref.pending;
    const nextLabel = S.step === "build_setup" ? t("b.open_editor") : S.step === "custom_shape" ? t("entry.custom_shape.generate") : t("b.continue");
    return `<div class="page b-page">
      <header class="b-head"><button type="button" class="btn btn--link" data-act="cancel" style="margin-left:-4px">${esc(S.view === "route" && S.route ? t("b.cancel") : t("b.back"))}</button>${S.route ? `<span class="b-head__route">${esc(routeLabel(S.route))}</span>` : ""}<span></span></header>
      ${stepsShown ? `<div class="b-progress"><span class="t-label" aria-live="polite">${esc(t("b.section", { n: sectionNo(), total: total() }))}</span><div class="segbar" data-progress-dimension="task" data-progress-scope="entry-route-step">${Array.from({ length: total() }, (_, i) => `<span class="segbar__seg${i < sectionNo() ? " is-done" : ""}"></span>`).join("")}</div>${rail()}</div>` : ""}
      ${S.notice === "rules_changed" && !["result","preview","activation_conflict"].includes(S.step) ? TS.rulesNotice(t) : ""}${S.notice === "resume" ? "" : S.validation ? `<div class="notice notice--error" role="alert" tabindex="-1" id="bValidation"><strong>${esc(t("entry.validation.title"))}</strong><p>${esc(t("entry.validation.body"))}</p></div>` : ""}
      <main class="b-body view-enter" id="bBody">${body}</main>
      ${nav && (showNext || (S.route && S.step !== STEPS[S.route][0] && !["result", "preview", "editor"].includes(S.step))) ? `<footer class="b-nav pinned"><div class="row">${S.route && S.step !== STEPS[S.route][0] && S.step !== "editor" ? `<button type="button" class="btn" data-act="back" style="flex:0 0 auto;min-width:96px">${esc(backLabel || t("b.back"))}</button>` : ""}${showNext ? `<button type="button" class="btn btn--primary" data-act="next" style="flex:1"${issues.length || pendingReason ? " disabled" : ""}${pendingReason ? ' aria-describedby="pendingAvoidNote"' : ""}>${esc(nextLabel)}</button>` : ""}</div></footer>` : ""}
      ${S.overlay === "replace" ? TS.replaceSheet(t, TF.device.active?.name || "", resultName(), TF.device.sessions) : S.overlay === "cancel" ? TS.cancelSheet(t) : ""}
      ${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ""}
    </div>`;
  }
  /* The answer rail: every earlier answer, one tap from being changed. */
  function rail() {
    const a = S.answers; const chips = [];
    const idx = stepIndex();
    const add = (step, label) => { if (STEPS[S.route].indexOf(step) < idx) chips.push(`<button type="button" class="b-rail__chip" data-act="jump" data-step="${step}" aria-label="${esc(t("b.rail.edit", { what: label }))}">${esc(label)}<span class="icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span></button>`); };
    if (a.desiredResult) add("desired_result", t(`entry.desired_result.${a.desiredResult}.label`));
    if (a.structuredExperience) add("background", t(`entry.background.experience.${a.structuredExperience}`));
    if (a.daysPerWeek) add("schedule", `${t("b.rail.days", { n: a.daysPerWeek })}${a.sessionMinutes ? " · " + t("b.rail.minutes", { n: a.sessionMinutes }) : ""}`);
    if (a.environment?.kind) add("environment", t(`entry.environment.${a.environment.kind}`));
    return chips.length ? `<div class="b-rail" aria-label="${esc(t("b.res.change"))}">${chips.join("")}</div>` : "";
  }
  const heading = (title, lede, optional) => `<h1 class="t-title b-q" data-focus>${esc(title)}</h1>${optional ? `<p class="t-caption">${esc(t("entry.optional"))}</p>` : ""}${lede ? `<p class="t-lede b-lede">${esc(lede)}</p>` : ""}`;

  /* ---------- screens ---------- */
  function landing() {
    const shared = S.view === "shared-gate" && S.shared;
    const invalid = S.view === "shared-invalid";
    return `<div class="page b-land" data-checkpoint="${shared ? "shared-gate" : invalid ? "shared-invalid" : "landing"}">
      <header class="b-land__brand"><img src="vendor/brand/mark.png" alt="" width="40" height="40" class="b-land__mark"><span class="b-land__word">Taurifer</span><span style="flex:1"></span><button type="button" class="btn btn--link">${esc(t("privacy.title"))}</button></header>
      ${shared ? `<p class="t-label t-label--accent">${esc(t("landing.shared.eyebrow"))}</p><h1 class="b-land__head" data-focus>${esc(t("b.shared.head"))}</h1><p class="t-lede">${esc(t("b.shared.lede"))}</p>
        <div class="card b-shared"><div class="card__body stack stack--tight"><span class="t-label">${esc(t("b.shared.by"))}</span><strong class="t-subtitle">${esc(S.shared.program.meta.name)}</strong><span class="t-small t-soft">${esc(t(S.shared.program.meta.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: "", n: S.shared.program.meta.daysPerWeek }).replace(/^\s*·\s*/, ""))} · ${esc(t("entry.preview.exercises", { n: S.shared.program.exercises.length, exercise: TF.tp(t, S.shared.program.exercises.length, "exercise") }))}</span><p class="t-caption">${esc(t("x.shared.what"))} ${esc(t("x.shared.nothing_saved"))}</p></div></div>
        <button type="button" class="btn btn--primary btn--accent" id="firstRunSharedStart" data-act="shared-start">${esc(t("setup.shared.title"))}</button>
        <p class="t-caption" style="text-align:center">${esc(t("x.privacy.line"))}</p>`
      : `${invalid ? `<h1 class="b-land__head" data-focus>${esc(t("landing.shared.invalid_headline"))}</h1><p class="t-lede">${esc(t("landing.shared.invalid_body"))}</p><p class="status-line" role="status" style="color:var(--danger)"><span class="icon-mask icon-mask--alert" aria-hidden="true"></span><span>${esc(t(TF.sharedErrorKey(S.sharedError)))}</span></p>` : `<h1 class="b-land__head" data-focus>${esc(t("b.land.head"))}</h1><p class="t-lede">${esc(t("b.land.lede"))}</p>`}
        <div class="stack" style="margin-top:22px">
          <button type="button" class="b-door b-door--primary" id="firstRunCreate" data-act="land-build"><span class="b-door__body"><span class="b-door__title">${esc(t("b.land.build"))}</span><span class="b-door__cap">${esc(t("b.land.build_cap"))}</span></span><span class="icon-mask icon-mask--arrow" aria-hidden="true"></span></button>
          <button type="button" class="b-door" id="firstRunImport" data-act="land-own"><span class="b-door__body"><span class="b-door__title">${esc(t("b.land.own"))}</span><span class="b-door__cap">${esc(t("b.land.own_cap"))}</span></span><span class="icon-mask icon-mask--arrow" aria-hidden="true"></span></button>
        </div>
        <p class="t-caption" style="margin-top:18px">${esc(t("x.privacy.line"))}</p>`}
    </div>`;
  }
  function hub() {
    const active = TF.hasActiveProgram();
    const door = (route, icon, title, cost, get, featured, id) => `<button type="button" class="b-route${featured ? " b-route--featured" : ""}" data-act="route" data-route="${route}"${id ? ` id="${id}"` : ""}>${featured ? `<span class="t-label t-label--accent b-route__flag">${esc(t("b.hub.featured"))}</span>` : ""}<span class="row"><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="b-route__title">${esc(title)}</span><span class="chevron" aria-hidden="true"></span></span><span class="b-route__facts"><span><b>${esc(t("b.hub.ask"))}</b> ${esc(cost)}</span><span><b>${esc(t("b.hub.get"))}</b> ${esc(get)}</span></span></button>`;
    const resume = S.notice === "resume" && S.draft ? resumeCard() : "";
    const rules = S.notice === "rules_changed" ? TS.rulesNotice(t) : "";
    const help = S.help ? helpBlock() : "";
    return `<div data-checkpoint="${active ? "hub-existing" : S.help ? "route-help" : "route-choice"}">
      ${heading(t("b.hub.title"), t("b.hub.lede"))}
      ${active ? TS.activeNotice(t) : ""}${resume}${rules}
      <div class="stack" style="margin-top:14px">
        ${door("recommend", "wand", t("entry.hub.recommend.title"), t("x.cost.recommend"), t("x.get.generated"), true)}
        ${door("custom", "sliders", t("entry.hub.custom.title"), t("x.cost.custom"), t("x.get.generated"))}
        ${door("browse", "search", t("entry.hub.browse.title"), t("x.cost.browse"), t("x.get.browse"))}
        <details class="disclosure" ${S.own ? "open" : ""} id="entryOwnToggle" data-role="own"><summary data-act="own-toggle"><span>${esc(t("entry.hub.own.title"))}</span><span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body stack stack--tight">
          ${door("build", "pencil", t("entry.hub.build.title"), t("x.cost.build"), t("x.get.build"))}
          ${door("freeform", "clipboard", t("entry.hub.freeform.title"), t("x.cost.paste"), t("x.get.import"), false, "entryFreeformStart")}
          ${door("import", "download", t("entry.hub.import.title"), t("x.cost.file"), t("x.get.import"))}
        </div></details>
        <button type="button" class="btn btn--quiet" data-act="help-toggle" aria-expanded="${S.help ? "true" : "false"}">${esc(t("b.hub.help"))}</button>${help}
      </div></div>`;
  }
  function helpBlock() {
    const h = S.help; const target = h.q1 === "yes" ? "own" : h.q2 === "pick" ? "custom" : h.q2 === "nopick" ? "recommend" : null;
    return `<div class="card b-help" role="group" aria-label="${esc(t("b.hub.help"))}"><div class="card__body stack">
      <p class="t-small"><b>${esc(t("b.hub.help_q1"))}</b></p><div class="grid-2">${TS.chip({ key: "help.q1", val: "yes", label: t("b.hub.help_yes"), selected: h.q1 === "yes", role: "radio" })}${TS.chip({ key: "help.q1", val: "no", label: t("b.hub.help_no"), selected: h.q1 === "no", role: "radio" })}</div>
      ${h.q1 === "no" ? `<p class="t-small"><b>${esc(t("b.hub.help_q2"))}</b></p><div class="grid-2">${TS.chip({ key: "help.q2", val: "pick", label: t("b.hub.help_pick"), selected: h.q2 === "pick", role: "radio" })}${TS.chip({ key: "help.q2", val: "nopick", label: t("b.hub.help_nopick"), selected: h.q2 === "nopick", role: "radio" })}</div>` : ""}
      ${target === "own" ? `<button type="button" class="btn btn--primary btn--noarrow" data-act="own-open">${esc(t("b.hub.help_go", { route: t("entry.hub.own.title") }))}</button>` : target ? `<button type="button" class="btn btn--primary btn--noarrow" data-act="route" data-route="${target}">${esc(t("b.hub.help_go", { route: t(`entry.hub.${target}.title`) }))}</button>` : ""}
    </div></div>`;
  }
  function resumeCard() {
    const st = S.draft.state; const when = new Date(st.updatedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric" });
    return `<div class="card b-resume" role="status" data-checkpoint="resume"><div class="card__body stack stack--tight"><strong class="t-subtitle">${esc(t("b.resume.title"))}</strong><p class="t-small t-soft">${esc(t("entry.resume.body"))}</p><p class="status-line"><span class="icon-mask icon-mask--pin" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("b.resume.at", { route: routeLabel(st.route), step: stepLabel(st.route, st.step), when }))}</span></p><div class="btnrow"><button type="button" class="btn btn--primary btn--noarrow" id="entryResumeContinue" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="btn btn--destructive" data-act="resume-restart">${esc(t("entry.resume.restart"))}</button></div></div></div>`;
  }
  function qGoal() { return heading(t("b.q.goal"), t("entry.desired_result.lede")) + `<div class="stack" role="radiogroup" aria-label="${esc(t("b.q.goal"))}">${TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: S.answers.desiredResult === v, icon: TS.DESIRED_ICON[v] })).join("")}</div>`; }
  function qBackground() { return heading(t("b.q.background"), t("b.q.background_lede")) + `<p class="t-label" id="expLab">${esc(t("entry.background.experience.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="expLab">${TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: S.answers.structuredExperience === v, cls: "choice--compact" })).join("")}</div><p class="t-label section-gap" id="conLab">${esc(t("entry.background.consistency.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="conLab">${TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: S.answers.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`; }
  function qSchedule() {
    const browse = S.route === "browse";
    return heading(t("b.q.schedule"), t("b.q.schedule_lede")) + `<p class="t-label" id="daysLab">${esc(t("entry.schedule.days.label"))}</p><div class="b-seg" role="radiogroup" aria-labelledby="daysLab">${TS.DAYS.map((n) => TS.choice({ key: "daysPerWeek", val: n, title: String(n), cap: t("entry.schedule.days.sub"), selected: S.answers.daysPerWeek === n, cls: "choice--seg" })).join("")}</div>
      <p class="t-label section-gap" id="minLab">${esc(t("entry.schedule.minutes.label"))}</p><div class="b-seg" role="radiogroup" aria-labelledby="minLab">${TS.MINUTES.map((n) => TS.choice({ key: "sessionMinutes", val: n, title: n === 90 ? "90+" : String(n), cap: "min", selected: S.answers.sessionMinutes === n, cls: "choice--seg" })).join("")}</div>
      ${browse ? "" : `<p class="t-label section-gap" id="restLab">${esc(t("entry.schedule.rest.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="restLab">${TS.REST.map((v) => TS.choice({ key: "preferredRestSeconds", val: v, title: v === "auto" ? t("entry.schedule.rest.auto") : t(`entry.schedule.rest.${v}`), selected: v === "auto" ? S.answers.preferredRestSeconds === null : S.answers.preferredRestSeconds === v, cls: "choice--compact" })).join("")}</div>`}`;
  }
  function qEnvironment(openCorrection) { const envv = S.answers.environment; return heading(t("b.q.environment"), t("b.q.environment_lede")) + `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("b.q.environment"))}">${TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: envv?.kind === v, icon: TS.ENV_ICON[v], cls: "choice--compact" })).join("")}</div>${envv ? `<div style="margin-top:12px">${TS.environmentCorrection(t, envv, { open: openCorrection || S.envOpen })}</div>` : ""}`; }
  function qPriorities() {
    if (S.route === "custom") return heading(t("b.q.custom_prio"), t("entry.priorities.state_hint"), true) + TS.muscleEmphasis(t, S.answers) + `<p class="t-label section-gap">${esc(t("entry.priorities.movements"))}</p><div class="grid-2" role="group">${TS.MOVEMENTS.map((m) => TS.choice({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (S.answers.priorityMovements || []).includes(m), role: "checkbox", cls: "choice--compact" })).join("")}</div>`;
    const prim = S.answers.primaryMuscles || [];
    return heading(t("b.q.priorities"), t("b.q.priorities_lede"), true) + `<div role="radiogroup" aria-label="${esc(t("entry.priorities.primary"))}">${TS.choice({ key: "clearPriorities", val: "1", title: t("entry.priorities.none"), selected: prim.length === 0, cls: "choice--compact" })}</div>
      <p class="t-label section-gap">${esc(t("entry.priorities.primary"))} <span class="t-soft" style="text-transform:none;letter-spacing:0;font-weight:400">· ${esc(t("entry.priorities.lede"))}</span></p><div class="grid-2" role="group">${TS.MUSCLES.map((m) => TS.choice({ key: "primaryMuscles", val: m, title: t(`entry.muscle.${m}`), selected: prim.includes(m), role: "checkbox", cls: "choice--compact", disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div>
      <p class="t-label section-gap">${esc(t("entry.priorities.movements"))}</p><div class="grid-2" role="group">${TS.MOVEMENTS.map((m) => TS.choice({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (S.answers.priorityMovements || []).includes(m), role: "checkbox", cls: "choice--compact" })).join("")}</div>
      <p class="t-label section-gap">${esc(t("entry.priorities.avoid"))}</p>${TS.avoidSection(t, lang, { query: S.avoid.query, pending: S.avoid.pending, constraints: S.answers.exerciseConstraints || [] })}`;
  }
  function qExercisePrefs() { return heading(t("b.q.custom_ex"), t("entry.exercise_preferences.lede"), true) + TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: S.answers.mustHaveExercises || [], constraints: S.answers.exerciseConstraints || [] }); }
  function qShape() {
    const splits = TF.splitChoices(answers()); const sole = splits.choices.length === 1;
    if (!splits.choices.length) return heading(t("b.q.shape")) + `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p><div class="btnrow"><button type="button" class="btn" data-act="jump" data-step="schedule">${esc(t("entry.custom_shape.change_schedule"))}</button></div></div>`;
    return heading(t("b.q.shape"), sole ? t("b.custom.shape_only") + " " + t("entry.custom_shape.lede_sole") : t("entry.custom_shape.lede")) + `<div class="stack" role="radiogroup">${splits.choices.map((c) => { const est = (c.days || []).map((d) => d.estimateMinutes).filter(Number.isFinite); return TS.choice({ key: "splitPreference", val: c.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }), cap: `${t(c.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason")} ${est.length ? t("entry.custom_shape.summary", { days: c.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""}`, selected: S.answers.splitPreference === c.id || sole }); }).join("")}</div>`;
  }
  /* Result = program first, reasons second, one activation action. */
  function result({ custom = false, source } = {}) {
    if (!S.result) { const f = S.compileError; return heading(t("b.res.title")) + `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.error.summary"))}</strong><p>${esc(f?.code || "")}</p>${f?.conflicts ? `<div class="btnrow"><button type="button" class="btn" data-act="jump" data-step="exercise_preferences">${esc(t("entry.result.change_preferences"))}</button></div>` : ""}</div>`; }
    const preview = S.result.preview; const facts = TF.previewFacts(preview); const a = answers();
    const reasons = TS.reasons(t, lang, S.result, a, { custom }).filter((r) => !["reductions", "limitations"].includes(r.key));
    const adjustments = TS.adjustments(t, preview); const constraints = TS.constraintLines(t, lang, a);
    const issue = TF.progressionIssue(preview);
    const activeLabel = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("entry.preview.activate_first");
    const srcLabel = source || t(`entry.preview.source.${S.route}`);
    const cp = S.cpTag ? S.cpTag : S.step === "activation_conflict" ? "activation-conflict" : S.route === "shared" ? "shared-preview" : S.route === "browse" ? "browse-preview" : S.route === "import" ? "import-preview" : custom ? "custom-result" : "rec-result";
    const generated = S.route === "recommend" || S.route === "custom";
    return `<div data-checkpoint="${cp}">
      ${S.notice === "conflict" || S.step === "activation_conflict" ? TS.conflictNotice(t) : ""}
      ${S.notice === "rules_changed" ? TS.rulesNotice(t, { keep: S.route === "import" || S.route === "shared", keepReady: TF.activationIssues(entry({ step: "preview" })).length === 0 }) : ""}
      ${heading(custom ? t("b.res.custom_title") : S.route === "browse" || S.route === "import" || S.route === "shared" ? t("entry.preview.title") : t("b.res.title"))}
      ${TF.hasActiveProgram() && S.step !== "activation_conflict" ? TS.activeNotice(t) : ""}
      <div class="b-ident"><h2 class="t-feature">${esc(resultName())}</h2><p class="t-small t-soft">${esc(srcLabel)}${generated ? ` · ${esc(t("b.res.det"))}` : ""}</p></div>
      <div class="facts b-facts"><span class="t-data">${esc(t("entry.catalogue.days_badge", { days: (preview.days || []).length }))}</span>${TF.durationLabel(t, preview) ? `<span class="t-data">${esc(TF.durationLabel(t, preview))}</span>` : ""}<span class="t-data">${esc(t("entry.preview.exercises", { n: facts.exercises, exercise: TF.tp(t, facts.exercises, "exercise") }))}</span><span class="t-data">${esc(t("entry.preview.sets", { n: facts.sets }))}</span></div>
      <p class="t-label section-gap">${esc(t("entry.preview.days"))}</p>${TS.programDays(t, lang, preview, { openFirst: true })}
      ${generated ? `<p class="t-label section-gap">${esc(t("b.res.why"))}</p><ul class="b-reasons">${reasons.map((r) => `<li class="fact-row"><span class="icon-mask icon-mask--${r.icon}" aria-hidden="true"></span><span class="fact-row__text">${esc(r.text)}</span></li>`).join("")}</ul>` : `<p class="t-label section-gap">${esc(t("entry.preview.progression"))}</p><p class="t-small t-soft">${esc(t(TF.progressionCopyKey(preview)))}</p>`}
      ${adjustments.length ? `<p class="t-label section-gap">${esc(t("b.res.adjust"))}</p><ul class="b-reasons">${adjustments.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--scale" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul>` : ""}
      ${constraints.length ? `<p class="t-label section-gap">${esc(t("b.res.constraints"))}</p><ul class="b-reasons">${constraints.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--${x.kind === "avoid" ? "shield" : "check"}" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul>` : ""}
      ${generated ? `<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:14px"><span class="t-label" style="flex:1 0 100%">${esc(t("b.res.change"))}</span>${custom ? `<button type="button" class="btn btn--sm" data-act="jump" data-step="priorities">${esc(t("entry.result.change_priorities"))}</button><button type="button" class="btn btn--sm" data-act="jump" data-step="exercise_preferences">${esc(t("entry.result.change_exercise_preferences"))}</button>` : `<button type="button" class="btn btn--sm" data-act="jump" data-step="priorities">${esc(t("entry.priorities.title"))}</button>`}<button type="button" class="btn btn--sm" data-act="jump" data-step="schedule">${esc(t("b.q.schedule"))}</button><button type="button" class="btn btn--sm" data-act="jump" data-step="environment">${esc(t("b.q.environment"))}</button></div>` : ""}
      ${issue ? `<p class="notice notice--error" role="alert" id="entryActivationStatus" tabindex="-1">${esc(t("entry.preview.activation_blocked"))}</p>` : ""}
      ${S.activationIssues ? `<p class="notice notice--error" role="alert">${esc(S.activationIssues.join(", "))}</p>` : ""}
      <div class="pinned b-confirm"><button type="button" class="btn btn--primary" id="entryActivate" data-act="activate"${issue || S.step === "activation_conflict" ? " disabled" : ""}>${esc(activeLabel)}</button><div class="btnrow" style="margin-top:8px"><button type="button" class="btn" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("entry.preview.edit"))}</button><button type="button" class="btn btn--destructive" data-act="restart"><span class="icon-mask icon-mask--reset" aria-hidden="true"></span>${esc(t("entry.preview.restart"))}</button></div></div>
    </div>`;
  }
  function catalogue() {
    const cards = TF.browseCards(answers()); const a = S.answers;
    const label = { range: t("program.progression.strategy.range"), rep_goal: t("program.progression.strategy.rep_goal"), effort_target: t("program.progression.strategy.effort_target"), anchor_backoff: t("program.progression.strategy.anchor_backoff") };
    const card = (c) => { const name = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; const ex = c.structureFacts.map((f) => f.exerciseCount), sets = c.structureFacts.map((f) => f.setCount); return `<button type="button" class="b-prog" data-act="catalogue" data-id="${esc(c.id)}" aria-label="${esc(t("entry.catalogue.review_aria", { name }))}"><span class="row row--between"><span class="t-subtitle">${esc(name)}</span><span class="t-data t-small">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span class="t-small t-soft">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span><span class="facts"><span class="t-data">${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))}</span><span class="t-data">${esc(Math.min(...ex) === Math.max(...ex) ? t("entry.catalogue.exercises_exact", { n: ex[0] }) : t("entry.catalogue.exercises_range", { min: Math.min(...ex), max: Math.max(...ex) }))}</span><span class="t-data">${esc(Math.min(...sets) === Math.max(...sets) ? t("entry.catalogue.sets_exact", { n: sets[0] }) : t("entry.catalogue.sets_range", { min: Math.min(...sets), max: Math.max(...sets) }))}</span></span><span class="t-caption">${esc(t("entry.catalogue.progression", { progression: c.progressionStrategies.map((s) => label[s]).join(" · ") }))} · ${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span>${c.mismatch ? `<span class="t-caption" style="color:var(--accent-deep)">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button>`; };
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    return `<div data-checkpoint="browse-list">${heading(t("b.browse.title"), t("b.browse.lede"))}<div class="facts" style="margin-bottom:12px"><span class="t-data">${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span class="t-data">${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment?.kind}`))}</span><button type="button" class="btn btn--link" data-act="jump" data-step="schedule" style="padding:0 6px">${esc(t("x.change"))}</button></div>
      ${fits.length ? `<p class="t-label">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</p><div class="stack stack--tight">${fits.map(card).join("")}</div>` : `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.catalogue.empty_title"))}</strong><p>${esc(t("entry.catalogue.empty_body"))}</p></div>`}
      ${others.length ? `<details class="disclosure disclosure--plain section-gap"><summary>${esc(t("entry.catalogue.group_other"))} (${others.length})</summary><div class="stack stack--tight" style="padding-top:8px">${others.map(card).join("")}</div></details>` : ""}</div>`;
  }
  function buildSetup() { return `<div data-checkpoint="build-setup">${heading(t("b.build.title"), t("entry.build_setup.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="bName" type="text" maxlength="80" data-field="programName" value="${esc(S.answers.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label><p class="t-label section-gap">${esc(t("entry.build_setup.days"))}</p><div class="b-seg" role="radiogroup">${TS.DAYS.map((n) => TS.choice({ key: "daysPerWeek", val: n, title: String(n), cap: t("entry.schedule.days.sub"), selected: S.answers.daysPerWeek === n, cls: "choice--seg" })).join("")}</div></div>`; }
  function editor() {
    const b = S.build; const issues = TS.build.issues(b, t); const ready = !issues.length;
    const cp = S.editing ? "activate" : ready ? "build-ready" : b.days.some((d) => d.exercises.length) ? "build-partial" : "build-empty";
    return `<div data-checkpoint="${cp}">${heading(S.editing ? t("b.edit.title") : t("b.build.title"))}<label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input type="text" maxlength="80" data-field="buildName" value="${esc(b.name)}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>
      <p class="status-line" role="status" aria-live="polite" id="editorStatus" style="margin:10px 0;color:${ready ? "var(--positive)" : "var(--danger)"}"><span class="icon-mask icon-mask--${ready ? "check" : "alert"}" aria-hidden="true"></span><span>${esc(ready ? t("entry.editor.ready") : issues.join(" "))}</span></p>
      ${TS.build.editor(t, lang, b)}
      <div class="pinned b-confirm"><button type="button" class="btn btn--primary" id="entryEditorActivate" data-act="activate"${ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("entry.editor.use"))}</button>${S.editing ? `<button type="button" class="btn" style="margin-top:8px" data-act="edit-done">${esc(t("b.edit.done"))}</button>` : `<button type="button" class="btn" style="margin-top:8px" data-act="save-draft">${esc(t("entry.editor.save"))}</button>`}</div></div>`;
  }
  function importSource() {
    if (S.importDraft) return importReview();
    if (S.importMode === "freeform") { const ff = S.ff; const cp = ff.status === "gaps" ? (ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps") : ff.status === "unreadable" ? "ff-unreadable" : ff.stage === 3 ? "ff-reply" : ff.stage === 2 ? "ff-handoff" : TS.freeform.program(ff) ? "ff-filled" : "ff-empty"; return `<div data-checkpoint="${cp}">${heading(ff.status === "gaps" ? t("entry.freeform.gaps_title") : t("entry.freeform.title"), ff.status === "gaps" ? t("entry.freeform.gaps_lede") : t("entry.freeform.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}${TS.freeform.body(t, lang, ff)}<div class="row" style="justify-content:center;margin-top:16px"><button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="file">${esc(t("entry.freeform.to_file"))}</button></div></div>`; }
    return `<div data-checkpoint="import-source">${heading(t("b.import.title"), t("entry.import_source.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<div class="stack"><button type="button" class="b-door b-door--primary" id="entryImportPick" data-act="import-file"><span class="b-door__body"><span class="b-door__title">${esc(t("b.import.file"))}</span><span class="b-door__cap">${esc(t("b.import.file_cap"))}</span></span><span class="icon-mask icon-mask--download" aria-hidden="true"></span></button><button type="button" class="b-door" data-act="import-mode" data-mode="freeform"><span class="b-door__body"><span class="b-door__title">${esc(t("b.import.paste"))}</span><span class="b-door__cap">${esc(t("b.import.paste_cap"))}</span></span><span class="icon-mask icon-mask--clipboard" aria-hidden="true"></span></button></div></div>`;
  }
  function importReview() {
    const d = S.importDraft; const c = TF.importCounts(d);
    return `<div data-checkpoint="import-review">${heading(t("b.import.review_title"), t("b.import.review_lede"))}<p class="t-caption">${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</p>${d.notImported.length ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}${TS.importReview.counts(t, d)}<div style="margin-top:12px">${TS.importReview.rows(t, lang, d, { picker: S.picker })}</div>${d.originalText ? `<details class="disclosure disclosure--plain"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="t-caption" style="white-space:pre-wrap">${esc(d.originalText)}</pre></details>` : ""}<p class="t-caption" style="margin-top:10px">${esc(t("import.safe"))}</p><div class="pinned b-confirm"><button type="button" class="btn btn--primary" id="importCommit" data-act="import-commit"${c.review ? " disabled" : ""}>${esc(c.review ? t("import.commit_blocked", { n: c.review }) : t("entry.preview.review"))}</button><button type="button" class="btn btn--quiet" style="margin-top:8px" data-act="import-cancel">${esc(t("import.cancel"))}</button></div></div>`;
  }
  function stepBody() {
    switch (S.step) {
      case "desired_result": return `<div data-checkpoint="rec-goal">${qGoal()}</div>`;
      case "background": return `<div data-checkpoint="rec-background">${qBackground()}</div>`;
      case "schedule": return `<div data-checkpoint="${S.route === "browse" ? "browse-filters" : "rec-schedule"}">${qSchedule()}</div>`;
      case "environment": return `<div data-checkpoint="${S.route === "browse" ? "browse-filters" : S.envOpen ? "rec-env-correction" : "rec-environment"}">${qEnvironment()}</div>`;
      case "priorities": return `<div data-checkpoint="${S.route === "custom" ? "custom-priorities" : (S.answers.exerciseConstraints || []).some((c) => c.reason === "pain") ? "rec-avoid-pain" : "rec-priorities"}">${qPriorities()}</div>`;
      case "exercise_preferences": return `<div data-checkpoint="custom-exercises">${qExercisePrefs()}</div>`;
      case "custom_shape": return `<div data-checkpoint="custom-shape">${qShape()}</div>`;
      case "result": case "preview": case "activation_conflict": return S.editing ? editor() : result({ custom: S.route === "custom" });
      case "catalogue": return catalogue();
      case "build_setup": return buildSetup();
      case "editor": return editor();
      case "import_source": return importSource();
      default: return hub();
    }
  }
  function render(focus) {
    const saved = document.activeElement && document.activeElement.id;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (S.view === "landing" || S.view === "shared-gate" || S.view === "shared-invalid") html = landing();
    else if (S.view === "hub") html = chrome(hub(), { nav: false, progress: false });
    else html = chrome(stepBody());
    root.innerHTML = html;
    if (saved && /Search|ffIn|ffOut|bName|pickerSearch/.test(saved)) TS.refocus(root, saved); else if (focus) TS.focusHeading(root);
    const v = root.querySelector("#bValidation"); if (v) { try { v.focus(); } catch {} }
  }

  /* ---------- actions ---------- */
  function on(act, d, el) {
    S.cpTag = null;
    if (act === "land-build") { S.view = "hub"; S.own = false; render(true); return; }
    if (act === "land-own") { S.view = "hub"; S.own = true; render(true); return; }
    if (act === "shared-start") { S.route = "shared"; S.step = "preview"; S.result = { fingerprint: "shared", name: S.shared.program.meta.name, selected: { id: "shared", source: "shared" }, preview: TF.sharedPreview(S.shared) }; S.view = "route"; render(true); return; }
    if (act === "route") { if (d.route === "freeform") { S.importMode = "freeform"; go("import"); return; } if (d.route === "import") S.importMode = "file"; go(d.route); return; }
    if (act === "own-toggle") { S.own = !S.own; return; }
    if (act === "own-open") { S.own = true; S.help = null; render(); return; }
    if (act === "help-toggle") { S.help = S.help ? null : { q1: null, q2: null }; render(); return; }
    if (act === "pick") {
      if (d.key === "help.q1") { S.help = { q1: d.val, q2: null }; render(); return; }
      if (d.key === "help.q2") { S.help = { ...S.help, q2: d.val }; render(); return; }
      if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
      S.answers = TS.applyPick(S.answers, d.key, d.val); S.result = null; S.validation = false; if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true; render(); return;
    }
    if (act === "next") { advance(); return; }
    if (act === "back") { back(); return; }
    if (act === "cancel") { if (S.view === "hub") { S.view = "landing"; render(true); return; } if (S.route === "shared") { S.view = "shared-gate"; render(true); return; } S.overlay = "cancel"; render(); return; }
    if (act === "cancel-continue") { S.overlay = null; render(); return; }
    if (act === "cancel-keep") { S.overlay = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; S.notice = null; render(true); return; }
    if (act === "cancel-discard") { fresh(TF.hasActiveProgram() ? "existing" : "fresh"); S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return; }
    if (act === "jump") { jumpTo(d.step); return; }
    if (act === "avoid-add") { S.avoid.pending = d.id; S.avoid.query = ""; render(); return; }
    if (act === "avoid-remove") { S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); if (S.avoid.pending === d.id) S.avoid.pending = null; if (S.pref.pending === d.id) S.pref.pending = null; S.result = null; render(); return; }
    if (act === "pref-add") { if (d.status === "include") { S.answers.mustHaveExercises = [...(S.answers.mustHaveExercises || []), d.id]; } else S.pref.pending = d.id; S.pref.query = ""; S.result = null; render(); return; }
    if (act === "pref-remove") { S.answers.mustHaveExercises = (S.answers.mustHaveExercises || []).filter((x) => x !== d.id); S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); S.result = null; render(); return; }
    if (act === "field:avoidQuery") { S.avoid.query = d.value; render(); return; }
    if (act === "field:prefQuery") { S.pref.query = d.value; render(); return; }
    if (act === "field:programName") { S.answers.programName = d.value.trim(); const n = root.querySelector('[data-act="next"]'); if (n) n.disabled = validation().length > 0; return; }
    if (act === "field:buildName") { S.build = TS.build.apply(S.build, "name", d.value); return; }
    if (act === "field:dayName") { S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return; }
    if (act === "field:rx" || act === "change:rx") { S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return; }
    if (act === "field:pickerQuery") { if (S.picker) { S.picker.query = d.value; } else S.build = TS.build.apply(S.build, "query", d.value); render(); return; }
    if (act === "build") { S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(); return; }
    if (act === "pick-exercise") { if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return; }
    if (act === "catalogue") { const card = TF.browseCards(answers()).find((c) => c.id === d.id); if (!card) return; S.answers.catalogueSelection = card.id; S.result = { fingerprint: card.fingerprint, name: card.name, namePt: card.namePt, selected: { id: card.id, familyId: card.familyId, daysPerWeek: card.daysPerWeek, blueprintId: card.id }, preview: card.preview }; S.step = "preview"; render(true); return; }
    if (act === "import-mode") { S.importMode = d.mode; S.importDraft = null; if (d.mode === "file") S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-file") { S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("b.file_picked"), "file"); render(true); return; }
    if (act === "imp") { if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return; }
    if (act === "import-commit") { const preview = TF.importPreview(S.importDraft, t); S.result = { fingerprint: "import", name: preview.name, selected: { id: "import", source: "import" }, preview }; S.step = "preview"; S.importDraft = null; render(true); return; }
    if (act === "import-cancel") { S.importDraft = null; S.ff = TS.freeform.create(); render(true); return; }
    if (act === "ff") {
      if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); afterFreeform(); return; }
      if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); setTimeout(() => { S.toast = null; render(); }, 1800); return; }
      S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t); afterFreeform(); return;
    }
    if (act === "field:ffInput") { S.ff = TS.freeform.apply(S.ff, "input", d.value); const c = root.querySelector("#ffCount"); if (c) c.textContent = t("entry.freeform.count", { n: TF.nf(lang, S.ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }); const need = root.querySelector("#ffNeeds"); if (need) need.hidden = !!TS.freeform.program(S.ff); const btn = root.querySelector('[data-ff="continue"]'); if (btn) btn.disabled = !TS.freeform.program(S.ff); return; }
    if (act === "field:ffReply") { S.ff = TS.freeform.apply(S.ff, "reply", d.value); return; }
    if (act === "field:gap") { S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return; }
    if (act === "activate") { requestActivate(); return; }
    if (act === "replace-confirm") { S.overlay = null; activateNow(); return; }
    if (act === "replace-cancel") { S.overlay = null; render(); return; }
    if (act === "conflict-review") { S.notice = null; S.step = "preview"; S.revAtStart = TF.liveRevision(); render(true); return; }
    if (act === "rules-rebuild") { S.notice = null; S.draft = null; if (S.step === "result") compileNow(); render(true); return; }
    if (act === "rules-keep") { S.pinned = true; S.notice = null; render(); return; }
    if (act === "resume") { const st = S.draft.state; S.route = st.route; S.step = st.step; S.answers = { ...st.answers }; S.result = st.result; S.notice = null; S.revAtStart = st.activeProgramRevisionAtStart; S.view = "route"; render(true); return; }
    if (act === "resume-restart") { S.draft = null; S.notice = null; render(true); return; }
    if (act === "edit") { S.build = TS.build.create(resultName(), (S.result.preview.days || []).length); S.build.days = (S.result.preview.days || []).map((d) => ({ dayId: d.dayId || d.label, label: TF.dayName(t, d, S.result.preview.programStructure), exercises: (d.exercises || []).map((e) => ({ id: e.id, libraryId: e.libraryId, name: e.name, sets: e.sets, min: e.min, max: e.max, primary: TF.libraryEntry(e.libraryId)?.primary })) })); S.editing = true; render(true); return; }
    if (act === "edit-done") { S.result = { ...S.result, preview: { ...TS.build.preview(S.build, t), source: S.result.preview.source }, name: S.build.name || S.result.name }; S.editing = false; render(true); return; }
    if (act === "save-draft") { S.toast = t("entry.editor.saved"); render(); setTimeout(() => { S.toast = null; render(); }, 1500); return; }
    if (act === "restart") { fresh(TF.hasActiveProgram() ? "existing" : "fresh"); S.view = "hub"; render(true); return; }
  }
  function afterFreeform() {
    if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported, originalText: S.ff.input }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); render(true); return; }
    render(true);
  }

  /* ---------- checkpoint reach ---------- */
  const U = () => TF.F.users;
  function rafael() { const u = U().rafael.answers; return { desiredResult: u.desiredResult, structuredExperience: u.structuredExperience, recentConsistency: u.recentConsistency, daysPerWeek: u.daysPerWeek, sessionMinutes: u.sessionMinutes, preferredRestSeconds: u.preferredRestSeconds, environment: TF.env(u.environmentKind), primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] }; }
  function customAnswers() { const u = U().custom.answers; return { desiredResult: u.desiredResult, structuredExperience: u.structuredExperience, recentConsistency: u.recentConsistency, daysPerWeek: u.daysPerWeek, sessionMinutes: u.sessionMinutes, preferredRestSeconds: u.preferredRestSeconds, environment: TF.env(u.environmentKind), primaryMuscles: u.primaryMuscles, deEmphasizedMuscles: u.deEmphasizedMuscles, ignoredMuscles: [], priorityMovements: [], mustHaveExercises: u.mustHaveExercises, exerciseConstraints: u.exerciseConstraints }; }
  function at(route, step, a) { S.view = "route"; S.route = route; S.step = step; S.answers = a; S.result = null; S.revAtStart = TF.liveRevision(); S.cpTag = null; }
  async function reach(cp) {
    const u = U();
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": S.view = "hub"; break;
      case "route-help": S.view = "hub"; S.help = { q1: "no", q2: null }; break;
      case "rec-goal": at("recommend", "desired_result", {}); break;
      case "rec-background": at("recommend", "background", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": { const a = rafael(); delete a.environment; at("recommend", "environment", a); S.answers.environment = TF.env("commercial_gym"); break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-result": at("recommend", "result", rafael()); compileNow(); break;
      case "rec-env-correction": { const a = rafael(); const c = u.rafael.correction; a.environment = TF.env(c.environmentKind); a.environment.equipment = [...new Set([...a.environment.equipment, ...c.equipmentAdd])]; a.environment.capabilities = [...new Set([...a.environment.capabilities, ...c.capabilitiesAdd])]; at("recommend", "environment", a); S.envOpen = true; break; }
      case "rec-result-corrected": { const a = rafael(); const c = u.rafael.correction; a.environment = TF.env(c.environmentKind); a.environment.equipment = [...new Set([...a.environment.equipment, ...c.equipmentAdd])]; a.environment.capabilities = [...new Set([...a.environment.capabilities, ...c.capabilitiesAdd])]; at("recommend", "result", a); compileNow(); S.cpTag = "rec-result-corrected"; break; }
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: "pain" }]; at("recommend", "priorities", a); break; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: "pain" }]; at("recommend", "result", a); compileNow(); S.cpTag = "rec-result-avoided"; break; }
      case "browse-filters": at("browse", "schedule", {}); break;
      case "browse-list": at("browse", "catalogue", { daysPerWeek: 4, sessionMinutes: 60, environment: TF.env("commercial_gym") }); break;
      case "browse-preview": { at("browse", "catalogue", { daysPerWeek: 4, sessionMinutes: 60, environment: TF.env("commercial_gym") }); render(); on("catalogue", { id: "balanced_4_v1" }); return; }
      case "custom-priorities": { const a = customAnswers(); at("custom", "priorities", a); break; }
      case "custom-exercises": at("custom", "exercise_preferences", customAnswers()); break;
      case "custom-shape": { const a = customAnswers(); at("custom", "custom_shape", a); const s = TF.splitChoices(a); if (s.choices.length) S.answers.splitPreference = s.choices[0].id; break; }
      case "custom-result": { const a = customAnswers(); const s = TF.splitChoices(a); a.splitPreference = s.choices[0]?.id; at("custom", "result", a); compileNow(); break; }
      case "build-setup": at("build", "build_setup", {}); break;
      case "build-empty": at("build", "editor", { programName: lang === "pt" ? "Meu programa" : "My program", daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); break;
      case "build-partial": at("build", "editor", { programName: lang === "pt" ? "Meu programa" : "My program", daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); S.build.picker = "manual_d1"; S.build = TS.build.apply(S.build, "add", "pd_bw"); break;
      case "build-ready": at("build", "editor", { programName: lang === "pt" ? "Meu programa" : "My program", daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [d, id] of [["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]) { S.build.picker = d; S.build = TS.build.apply(S.build, "add", id); } break;
      case "ff-empty": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = TS.freeform.create(); break;
      case "ff-filled": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); break;
      case "ff-handoff": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"); break;
      case "ff-reply": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "chatgpt"); break;
      case "ff-gaps": case "ff-gaps-invalid": { at("import", "import_source", {}); S.importMode = "freeform"; let ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "chatgpt"); ff = TS.freeform.apply(ff, "reply", TF.F.freeform.replyGaps[lang]); ff = TS.freeform.apply(ff, "review"); if (cp === "ff-gaps-invalid") ff = TS.freeform.apply(ff, "gap-submit"); S.ff = ff; break; }
      case "ff-unreadable": { at("import", "import_source", {}); S.importMode = "freeform"; let ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "claude"); ff = TS.freeform.apply(ff, "reply", TF.F.freeform.replyUnreadable[lang]); ff = TS.freeform.apply(ff, "review"); S.ff = ff; break; }
      case "import-source": at("import", "import_source", {}); S.importMode = "file"; break;
      case "import-review": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("b.file_picked"), "file"); break;
      case "import-preview": { at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("b.file_picked"), "file"); for (const r of S.importDraft.rows) if (!r.reviewed) S.importDraft = TS.importReview.apply(S.importDraft, r.shortlist.length ? "pick" : "raw", r.key, 0); render(); on("import-commit", {}); return; }
      case "shared-gate": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; break; }
      case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.payload; S.view = "shared-gate"; render(); on("shared-start", {}); return; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "hub-existing": S.view = "hub"; break;
      case "replace-confirm": at("recommend", "result", rafael()); compileNow(); S.overlay = "replace"; break;
      case "activation-conflict": at("recommend", "result", rafael()); compileNow(); TF.device.revision += 1; TF.device.active.name = lang === "pt" ? "Programa mais novo" : "Newer active program"; render(); activateNow(); return;
      case "resume": S.draft = TS.seeds.interruptedDraft(lang); S.notice = "resume"; S.view = "hub"; break;
      case "rules-changed": { S.draft = TS.seeds.rulesDriftDraft(); const st = S.draft.state; at("recommend", "desired_result", { ...st.answers }); S.notice = "rules_changed"; break; }
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; break;
      case "activate": at("recommend", "result", rafael()); compileNow(); S.cpTag = "activate"; break;
      case "activated-today": { at("recommend", "result", rafael()); compileNow(); render(); activateNow(); return; }
      default: S.view = "landing";
    }
    render(true);
  }
  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.b = {
    id: "b", name: "B · Cinco portas honestas",
    async mount(c) { ctx = c; lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); TS.wire(root, on); render(); },
    reach,
    state: () => S,
  };
})();
