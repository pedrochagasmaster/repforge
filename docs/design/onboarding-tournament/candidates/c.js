/* Candidate C · Programa primeiro
   Thesis: show a real, trainable program before asking anything, and let the
   lifter correct the facts it was built from directly on the program until it
   is theirs. There are no question screens: every input is a fact strip on the
   program, edited in place, with the program recompiling live and a diff line
   saying what changed. Other routes are "switch this program for…" actions.
   Product-policy decisions this direction requires (flagged): (1) a program is
   compiled from default answers before the lifter answers anything (shown as
   unconfirmed assumptions; nothing is activated or persisted); (2) Recommend,
   Custom and Browse are reached from one surface rather than a chooser.
   Activation rules, replacement, shared gate, import review, free-form stages
   and build gating are production. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    en: {
      "c.head": "A program you could start tomorrow.",
      "c.lede": "Built from four assumptions. Tap any that is wrong and the program rebuilds itself.",
      "c.assume.title": "Built on assumptions",
      "c.assume.body": "Tap a fact to confirm or change it. Unconfirmed facts are marked.",
      "c.assume.help": "Not sure where to start?",
      "c.assume.help_body": "This program already works as written. Confirm the days and where you train, and it is yours. Everything else can wait until after your first session.",
      "c.fact.confirm": "Confirm",
      "c.fact.confirmed": "Confirmed",
      "c.fact.unconfirmed": "Unconfirmed",
      "c.fact.days": "Days a week",
      "c.fact.where": "Where you train",
      "c.fact.goal": "Priority",
      "c.fact.bg": "Recent training",
      "c.fact.minutes": "Session length",
      "c.fact.rest": "Rest between sets",
      "c.fact.priority": "Muscle priority",
      "c.fact.priority_none": "None",
      "c.fact.rest_auto": "Chosen by Taurifer",
      "c.diff.rebuilt": "Rebuilt: {n} of {total} exercises changed.",
      "c.diff.same": "Rebuilt with the same exercises.",
      "c.diff.first": "Confirm the facts above and this is your program.",
      "c.switch": "Switch program",
      "c.switch.title": "Switch this program for…",
      "c.switch.facts": "Keep it, just change the facts",
      "c.switch.browse": "A ready-made Taurifer program",
      "c.switch.browse_cap": "Twenty released programs, filtered by these facts",
      "c.switch.custom": "One built from my muscle and exercise choices",
      "c.switch.custom_cap": "Emphasis per muscle, exercises to include or avoid",
      "c.switch.build": "One I write from scratch",
      "c.switch.build_cap": "Empty days you fill in",
      "c.switch.bring": "The program I already have",
      "c.switch.bring_cap": "Paste text, or import a Taurifer file",
      "c.why": "Why it looks like this",
      "c.adjust": "Adjusted",
      "c.avoids": "Kept out",
      "c.use": "Use this program",
      "c.ex.avoid": "Keep out",
      "c.ex.why": "Why keep {name} out?",
      "c.ex.apply": "Rebuild without it",
      "c.ex.cancel": "Never mind",
      "c.ex.restore": "Allow again",
      "c.browse.title": "Ready-made programs",
      "c.browse.lede": "Filtered by the facts on your program. Change the facts to see other days.",
      "c.browse.back": "Back to my program",
      "c.custom.title": "Your choices",
      "c.custom.muscles": "Emphasis per muscle",
      "c.custom.exercises": "Include or avoid exercises",
      "c.custom.shape": "Weekly structure",
      "c.custom.shape_only": "Only one weekly structure fits these facts.",
      "c.custom.apply": "Rebuild with these choices",
      "c.build.title": "Write your program",
      "c.build.lede": "Name it, choose the days, then fill each one.",
      "c.build.open": "Open the days",
      "c.import.title": "Bring your program",
      "c.import.paste": "Paste it as text",
      "c.import.paste_cap": "A coach's message or your notes. ChatGPT or Claude converts it.",
      "c.import.file": "Import a Taurifer file",
      "c.import.file_cap": "Exported from Taurifer on another device",
      "c.import.review": "Check the exercises",
      "c.import.review_lede": "Match each name to the library, or keep it as written. Nothing is saved yet.",
      "c.shared.head": "A program was sent to you.",
      "c.shared.lede": "It arrives as it was written. Look it over, then start it here.",
      "c.resume.title": "You were changing a program",
      "c.resume.body": "The facts you set are still here. Continue, or drop them and start from the assumptions.",
      "c.resume.continue": "Continue with my facts",
      "c.resume.restart": "Drop them",
      "c.today.toast": "Program active. Today shows your first session.",
      "c.file_picked": "Rafael's program.json",
      "c.cancel": "Cancel",
      "c.edit": "Edit exercises",
      "c.edit_done": "Back to program",
      "c.source.default": "Taurifer, from the facts above",
      "c.short.most": "most sessions done",
      "c.short.about_half": "about half done",
      "c.short.few": "few sessions done",
      "c.short.none": "no recent training",
      "c.short.minutes": "up to {n} min",
      "c.short.rest": "rest {v}",
      "c.fact.rest_auto": "rest chosen by Taurifer",
      "c.fact.priority_none": "no muscle priority",
    },
    pt: {
      "c.head": "Um programa para começar amanhã.",
      "c.lede": "Montado com quatro suposições. Toque na que estiver errada e o programa se remonta sozinho.",
      "c.assume.title": "Montado com suposições",
      "c.assume.body": "Toque em um fato para confirmar ou mudar. Os não confirmados ficam marcados.",
      "c.assume.help": "Não sabe por onde começar?",
      "c.assume.help_body": "Este programa já funciona como está. Confirme os dias e onde você treina, e ele é seu. O resto pode esperar até depois da primeira sessão.",
      "c.fact.confirm": "Confirmar",
      "c.fact.confirmed": "Confirmado",
      "c.fact.unconfirmed": "Não confirmado",
      "c.fact.days": "Dias por semana",
      "c.fact.where": "Onde você treina",
      "c.fact.goal": "Prioridade",
      "c.fact.bg": "Treino recente",
      "c.fact.minutes": "Duração da sessão",
      "c.fact.rest": "Descanso entre séries",
      "c.fact.priority": "Prioridade muscular",
      "c.fact.priority_none": "Nenhuma",
      "c.fact.rest_auto": "Escolhido pelo Taurifer",
      "c.diff.rebuilt": "Remontado: {n} de {total} exercícios mudaram.",
      "c.diff.same": "Remontado com os mesmos exercícios.",
      "c.diff.first": "Confirme os fatos acima e este programa é seu.",
      "c.switch": "Trocar programa",
      "c.switch.title": "Trocar este programa por…",
      "c.switch.facts": "Manter, só mudar os fatos",
      "c.switch.browse": "Um programa pronto do Taurifer",
      "c.switch.browse_cap": "Vinte programas publicados, filtrados por estes fatos",
      "c.switch.custom": "Um montado com minhas escolhas de músculos e exercícios",
      "c.switch.custom_cap": "Ênfase por músculo, exercícios para incluir ou evitar",
      "c.switch.build": "Um que eu escrevo do zero",
      "c.switch.build_cap": "Dias vazios que você preenche",
      "c.switch.bring": "O programa que já tenho",
      "c.switch.bring_cap": "Cole um texto ou importe um arquivo Taurifer",
      "c.why": "Por que ele é assim",
      "c.adjust": "Ajustado",
      "c.avoids": "Deixado de fora",
      "c.use": "Usar este programa",
      "c.ex.avoid": "Deixar fora",
      "c.ex.why": "Por que deixar {name} de fora?",
      "c.ex.apply": "Remontar sem ele",
      "c.ex.cancel": "Deixa pra lá",
      "c.ex.restore": "Permitir de novo",
      "c.browse.title": "Programas prontos",
      "c.browse.lede": "Filtrados pelos fatos do seu programa. Mude os fatos para ver outros dias.",
      "c.browse.back": "Voltar ao meu programa",
      "c.custom.title": "Suas escolhas",
      "c.custom.muscles": "Ênfase por músculo",
      "c.custom.exercises": "Incluir ou evitar exercícios",
      "c.custom.shape": "Estrutura semanal",
      "c.custom.shape_only": "Só uma estrutura semanal combina com estes fatos.",
      "c.custom.apply": "Remontar com estas escolhas",
      "c.build.title": "Escreva seu programa",
      "c.build.lede": "Dê um nome, escolha os dias e preencha cada um.",
      "c.build.open": "Abrir os dias",
      "c.import.title": "Traga seu programa",
      "c.import.paste": "Colar como texto",
      "c.import.paste_cap": "Mensagem do treinador ou suas anotações. O ChatGPT ou o Claude converte.",
      "c.import.file": "Importar um arquivo Taurifer",
      "c.import.file_cap": "Exportado do Taurifer em outro aparelho",
      "c.import.review": "Confira os exercícios",
      "c.import.review_lede": "Vincule cada nome à biblioteca ou mantenha como está escrito. Nada foi salvo ainda.",
      "c.shared.head": "Enviaram um programa para você.",
      "c.shared.lede": "Ele chega como foi escrito. Dê uma olhada e comece aqui.",
      "c.resume.title": "Você estava mudando um programa",
      "c.resume.body": "Os fatos que você definiu continuam aqui. Continue, ou descarte e volte às suposições.",
      "c.resume.continue": "Continuar com meus fatos",
      "c.resume.restart": "Descartar",
      "c.today.toast": "Programa ativo. Hoje mostra sua primeira sessão.",
      "c.file_picked": "Treino do Rafael.json",
      "c.cancel": "Cancelar",
      "c.edit": "Editar exercícios",
      "c.edit_done": "Voltar ao programa",
      "c.source.default": "Taurifer, a partir dos fatos acima",
      "c.short.most": "maioria das sessões feitas",
      "c.short.about_half": "metade das sessões feitas",
      "c.short.few": "poucas sessões feitas",
      "c.short.none": "sem treino recente",
      "c.short.minutes": "até {n} min",
      "c.short.rest": "descanso {v}",
      "c.fact.rest_auto": "descanso escolhido pelo Taurifer",
      "c.fact.priority_none": "sem prioridade muscular",
    },
  };
  const FACTS = ["days", "where", "goal", "bg", "minutes", "rest", "priority"];
  let ctx, t, lang, root, S;

  function defaults() { return { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: null, environment: TF.env("commercial_gym"), primaryMuscles: [], priorityMovements: [], exerciseConstraints: [], mustHaveExercises: [], deEmphasizedMuscles: [], ignoredMuscles: [] }; }
  function fresh(seed) {
    TF.seedDevice(seed === "existing" ? "existing" : "fresh");
    S = { view: "program", answers: defaults(), confirmed: new Set(), mode: "recommend", route: "recommend", result: null, prevProgram: null, diff: null, open: null, panel: null, help: false, notice: null, overlay: null, exOpen: null, envOpen: false, pref: { query: "", pending: null }, ff: TS.freeform.create(), importDraft: null, importMode: "file", build: null, buildStep: "setup", picker: null, editing: false, revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, draft: null, cpTag: null, pinned: false };
    compileNow();
  }
  const answers = () => TF.normalizeAnswers(S.answers);
  const generated = () => S.route === "recommend" || S.route === "custom";
  function compileNow() {
    const before = S.result?.preview?.program?.map((e) => e.libraryId || e.name) || null;
    if (S.mode === "custom") { const sp = TF.splitChoices(answers()); if (sp.choices.length && !sp.choices.some((c) => c.id === S.answers.splitPreference)) S.answers.splitPreference = (sp.choices.find((c) => c.default) || sp.choices[0]).id; }
    const r = TF.compile(S.mode, answers());
    if (r.ok) { S.result = { fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, candidates: r.candidates, alternative: r.alternative, preview: r.preview, explanation: r.explanation }; S.route = S.mode; S.compileError = null; if (before) { const after = S.result.preview.program.map((e) => e.libraryId || e.name); const changed = after.filter((id, i) => before[i] !== id).length + Math.max(0, before.length - after.length); S.diff = { n: changed, total: after.length }; } } else { S.result = null; S.compileError = r; }
  }
  const resultName = () => (S.result ? (lang === "pt" ? S.result.namePt || S.result.name : S.result.name) || S.answers.programName || t("untitled_program") : "");
  function entry(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step: step || (S.route === "build" ? "editor" : "preview"), activeProgramRevisionAtStart: S.revAtStart, versions: S.draft?.state?.versions }); }
  function activateNow() {
    const r = TF.activate(entry(), { pinnedVersionsExecutable: S.pinned });
    if (r.ok) { S.view = "today"; S.toast = t("c.today.toast"); render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; render(true); return; }
    if (r.code === "rules_changed_rebuild_required") { S.notice = "rules_changed"; render(); return; }
    S.activationIssues = r.issues || [r.code]; render();
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }

  /* ---------- fact strip ---------- */
  function factValue(k) {
    const a = S.answers;
    const shortCons = { most: t("c.short.most"), about_half: t("c.short.about_half"), few: t("c.short.few"), none: t("c.short.none") }[a.recentConsistency];
    return { days: t("entry.catalogue.days_badge", { days: a.daysPerWeek }), where: t(`entry.environment.${a.environment.kind}`), goal: t(`entry.desired_result.${a.desiredResult}.label`), bg: `${t(`entry.background.experience.${a.structuredExperience}`)} · ${shortCons}`, minutes: t("c.short.minutes", { n: a.sessionMinutes }), rest: a.preferredRestSeconds === null ? t("c.fact.rest_auto") : t("c.short.rest", { v: t(`entry.schedule.rest.${a.preferredRestSeconds}`).toLowerCase() }), priority: (a.primaryMuscles || []).length ? a.primaryMuscles.map((m) => t(`entry.muscle.${m}`)).join(", ") : t("c.fact.priority_none") }[k];
  }
  function factEditor(k) {
    const a = S.answers;
    if (k === "days") return `<div class="c-seg" role="radiogroup" aria-label="${esc(t("c.fact.days"))}">${TS.DAYS.map((n) => TS.chip({ key: "daysPerWeek", val: n, label: String(n), selected: a.daysPerWeek === n, role: "radio" })).join("")}</div>`;
    if (k === "where") return `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("c.fact.where"))}">${TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment?.kind === v, icon: TS.ENV_ICON[v], cls: "choice--compact" })).join("")}</div>${TS.environmentCorrection(t, a.environment, { open: S.envOpen })}`;
    if (k === "goal") return `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("c.fact.goal"))}">${TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v, cls: "choice--compact" })).join("")}</div>`;
    if (k === "bg") return `<p class="t-label" id="cExp">${esc(t("entry.background.experience.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="cExp">${TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "choice--compact" })).join("")}</div><p class="t-label" id="cCon" style="margin-top:10px">${esc(t("entry.background.consistency.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="cCon">${TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`;
    if (k === "minutes") return `<div class="c-seg" role="radiogroup" aria-label="${esc(t("c.fact.minutes"))}">${TS.MINUTES.map((n) => TS.chip({ key: "sessionMinutes", val: n, label: n === 90 ? "90+ min" : n + " min", selected: a.sessionMinutes === n, role: "radio" })).join("")}</div>`;
    if (k === "rest") return `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("c.fact.rest"))}">${TS.REST.map((v) => TS.choice({ key: "preferredRestSeconds", val: v, title: v === "auto" ? t("entry.schedule.rest.auto") : t(`entry.schedule.rest.${v}`), selected: v === "auto" ? a.preferredRestSeconds === null : a.preferredRestSeconds === v, cls: "choice--compact" })).join("")}</div>`;
    if (k === "priority") { const prim = a.primaryMuscles || []; return `<p class="t-small t-soft">${esc(t("entry.priorities.lede"))}</p><div class="c-seg" role="group" style="margin-top:6px">${TS.MUSCLES.map((m) => TS.chip({ key: "primaryMuscles", val: m, label: t(`entry.muscle.${m}`), selected: prim.includes(m), disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div><p class="t-label" style="margin-top:10px">${esc(t("entry.priorities.movements"))}</p><div class="c-seg" role="group">${TS.MOVEMENTS.map((m) => TS.chip({ key: "priorityMovements", val: m, label: t(`entry.movement.${m}`), selected: (a.priorityMovements || []).includes(m) })).join("")}</div>`; }
    return "";
  }
  function factStrip() {
    const open = S.open;
    return `<div class="c-chips" role="list" aria-label="${esc(t("c.assume.title"))}">${FACTS.map((k) => { const ok = S.confirmed.has(k); const isOpen = open === k; return `<button type="button" class="c-chip${ok ? " is-confirmed" : ""}${isOpen ? " is-open" : ""}" role="listitem" data-act="fact-open" data-key="${k}" aria-expanded="${isOpen}" aria-label="${esc(t(`c.fact.${k}`))}: ${esc(factValue(k))}. ${esc(ok ? t("c.fact.confirmed") : t("c.fact.unconfirmed"))}"><span class="c-chip__mark" aria-hidden="true">${ok ? `<span class="icon-mask icon-mask--check"></span>` : ""}</span><span class="c-chip__val">${esc(factValue(k))}</span></button>`; }).join("")}</div>${open ? `<div class="c-editor" role="group" aria-label="${esc(t(`c.fact.${open}`))}"><p class="t-label" style="margin-bottom:8px">${esc(t(`c.fact.${open}`))}</p>${factEditor(open)}<div class="row" style="margin-top:10px;gap:8px"><button type="button" class="btn btn--sm btn--primary btn--noarrow" style="flex:1;min-height:44px" data-act="fact-confirm" data-key="${open}">${esc(S.confirmed.has(open) ? t("a.sheet.close", undefined, "OK") : t("c.fact.confirm"))}</button></div></div>` : ""}`;
  }
  /* ---------- program view ---------- */
  function program() {
    const shared = S.route === "shared";
    const cp = S.cpTag || (S.panel === "switch" ? "route-choice" : S.help ? "route-help" : S.panel === "browse" ? (S.browseFilters ? "browse-filters" : "browse-list") : S.panel === "custom" ? (S.customTab === "exercises" ? "custom-exercises" : S.customTab === "shape" ? "custom-shape" : "custom-priorities") : S.open === "goal" ? "rec-goal" : S.open === "bg" ? "rec-background" : S.open === "days" || S.open === "minutes" ? "rec-schedule" : S.open === "where" ? (S.envOpen ? "rec-env-correction" : "rec-environment") : S.open === "priority" ? "rec-priorities" : S.exOpen ? "rec-avoid-pain" : S.notice === "conflict" ? "activation-conflict" : S.overlay === "replace" ? "replace-confirm" : S.notice === "resume" ? "resume" : S.route === "custom" ? "custom-result" : S.route === "browse" ? "browse-preview" : S.route === "import" ? "import-preview" : shared ? "shared-preview" : TF.hasActiveProgram() ? "hub-existing" : S.confirmed.size >= 4 ? "rec-result" : "landing");
    const preview = S.result?.preview; const a = answers();
    if (!preview) return `<div class="page c-page" data-checkpoint="${cp}">${header()}<div class="notice notice--error" role="alert"><strong>${esc(t("entry.error.summary"))}</strong><p>${esc(S.compileError?.code || "")}</p></div></div>`;
    const facts = TF.previewFacts(preview);
    const reasons = TS.reasons(t, lang, S.result, a, { custom: S.route === "custom" }).filter((r) => ["goal", "schedule", "progression"].includes(r.key));
    const adjustments = TS.adjustments(t, preview); const constraints = TS.constraintLines(t, lang, a);
    const issue = TF.progressionIssue(preview); const activeLabel = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("c.use");
    const firstRun = !TF.hasActiveProgram() && S.confirmed.size === 0 && generated() && !S.notice;
    const days = (preview.days || []).map((d, i) => { const ex = d.exercises || []; const sets = ex.reduce((s, e) => s + (+e.sets || 0), 0); return `<section class="c-day"><h3 class="c-day__h"><span class="day__num" aria-hidden="true">${i + 1}</span><span>${esc(TF.dayName(t, d, preview.programStructure, i))}</span><span class="day__meta">${esc(t("entry.preview.sets", { n: sets }))}${d.estimateMinutes ? ` · ${esc(t("entry.preview.minutes", { n: d.estimateMinutes }))}` : ""}</span></h3><div class="c-day__list">${ex.map((e) => { const open = S.exOpen === e.libraryId && e.libraryId; const existing = (a.exerciseConstraints || []).find((c) => c.exerciseId === e.libraryId); return `<div class="c-ex${open ? " is-open" : ""}"><div class="c-ex__row"><span class="ex__name">${esc(TS.exName(e, lang))}</span><span class="ex__rx">${e.sets} × ${e.min}–${e.max}</span>${generated() && e.libraryId ? `<button type="button" class="btn btn--sm btn--quiet c-ex__btn" data-act="ex-open" data-id="${esc(e.libraryId)}" aria-expanded="${!!open}" aria-label="${esc(t("c.ex.avoid"))} ${esc(TS.exName(e, lang))}">${esc(t("c.ex.avoid"))}</button>` : ""}</div>${open ? `<div class="c-ex__editor"><p class="t-label">${esc(t("c.ex.why", { name: TS.exName(e, lang) }))}</p><div class="c-seg" role="radiogroup">${TS.REASONS.map((r) => TS.chip({ key: "avoidReason", val: `${e.libraryId}|${r}`, label: t(`entry.priorities.reason.${r}`), selected: existing?.reason === r, role: "radio" })).join("")}</div>${existing?.reason === "pain" ? `<p class="status-line" role="note" style="margin-top:8px"><span class="icon-mask icon-mask--shield" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}<div class="row" style="margin-top:10px;gap:8px"><button type="button" class="btn btn--sm btn--primary btn--noarrow" style="flex:1;min-height:44px" data-act="ex-apply"${existing ? "" : " disabled"}>${esc(t("c.ex.apply"))}</button><button type="button" class="btn btn--sm" data-act="ex-cancel" data-id="${esc(e.libraryId)}">${esc(t("c.ex.cancel"))}</button></div></div>` : ""}</div>`; }).join("")}</div></section>`; }).join("");
    return `<div class="page c-page" data-checkpoint="${cp}">
      ${header()}
      ${S.notice === "resume" && S.draft ? resumeCard() : ""}
      ${S.notice === "conflict" ? TS.conflictNotice(t) : ""}
      ${S.notice === "rules_changed" ? TS.rulesNotice(t, { keep: S.route === "import" || S.route === "shared", keepReady: TF.activationIssues(entry()).length === 0 }) : ""}
      ${TF.hasActiveProgram() && S.notice !== "conflict" ? TS.activeNotice(t) : ""}
      ${firstRun ? `<h1 class="c-head" data-focus>${esc(t("c.head"))}</h1><p class="t-small t-soft" style="margin-bottom:12px">${esc(t("c.lede"))}</p>` : `<h1 class="t-feature" data-focus>${esc(resultName())}</h1><p class="t-small t-soft">${esc(generated() ? t("c.source.default") : t(`entry.preview.source.${S.route}`))}</p>`}
      ${firstRun ? `<h2 class="t-feature" style="margin-top:16px">${esc(resultName())}</h2>` : ""}
      <p class="facts" style="margin:6px 0 12px"><span class="t-data">${esc(t("entry.catalogue.days_badge", { days: (preview.days || []).length }))}</span>${TF.durationLabel(t, preview) ? `<span class="t-data">${esc(TF.durationLabel(t, preview))}</span>` : ""}<span class="t-data">${esc(t("entry.preview.exercises", { n: facts.exercises, exercise: TF.tp(t, facts.exercises, "exercise") }))}</span></p>
      ${S.panel === "switch" ? switchPanel() : S.panel === "browse" ? browsePanel() : S.panel === "custom" ? customPanel() : ""}
      ${generated() && !S.panel ? `<section class="c-assume" aria-labelledby="assumeTitle"><div class="row row--between"><h2 class="t-label" id="assumeTitle" style="margin:0">${esc(t("c.assume.title"))}</h2><span class="t-caption">${S.confirmed.size}/${FACTS.length} ${esc(t("c.fact.confirmed").toLowerCase())}</span></div>${factStrip()}${S.open ? "" : `<p class="t-caption" style="margin:8px 0 0">${esc(t("c.assume.body"))}</p>`}<details class="disclosure disclosure--plain" ${S.help ? "open" : ""} data-role="help"><summary data-act="help-toggle">${esc(t("c.assume.help"))}</summary><p class="t-small t-soft" style="padding:4px 0 8px">${esc(t("c.assume.help_body"))}</p></details></section>` : ""}
      ${S.diff ? `<p class="status-line" role="status" style="color:${S.diff.n ? "var(--accent-deep)" : "var(--ink-soft)"};margin-top:10px"><span class="icon-mask icon-mask--${S.diff.n ? "reset" : "check"}" aria-hidden="true"></span><span>${esc(S.diff.n ? t("c.diff.rebuilt", { n: S.diff.n, total: S.diff.total }) : t("c.diff.same"))}</span></p>` : firstRun ? `<p class="status-line" role="status" style="margin-top:10px"><span class="icon-mask icon-mask--target" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("c.diff.first"))}</span></p>` : ""}
      <div class="stack section-gap">${days}</div>
      ${generated() ? `<p class="t-label section-gap">${esc(t("c.why"))}</p><ul class="c-reasons">${reasons.map((r) => `<li class="fact-row"><span class="icon-mask icon-mask--${r.icon}" aria-hidden="true"></span><span class="fact-row__text">${esc(r.text)}</span></li>`).join("")}</ul>` : `<p class="t-label section-gap">${esc(t("entry.preview.progression"))}</p><p class="t-small t-soft">${esc(t(TF.progressionCopyKey(preview)))}</p>`}
      ${adjustments.length ? `<p class="t-label section-gap">${esc(t("c.adjust"))}</p><ul class="c-reasons">${adjustments.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--scale" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul>` : ""}
      ${constraints.length ? `<p class="t-label section-gap">${esc(t("c.avoids"))}</p><ul class="c-reasons">${constraints.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--${x.kind === "avoid" ? "shield" : "check"}" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}${x.kind === "avoid" ? ` <button type="button" class="btn btn--link" data-act="avoid-remove" data-id="${esc(x.id)}">${esc(t("c.ex.restore"))}</button>` : ""}</span></li>`).join("")}</ul>` : ""}
      ${issue ? `<p class="notice notice--error" role="alert" id="entryActivationStatus" tabindex="-1">${esc(t("entry.preview.activation_blocked"))}</p>` : ""}
      ${S.activationIssues ? `<p class="notice notice--error" role="alert">${esc(S.activationIssues.join(", "))}</p>` : ""}
      <div class="pinned c-confirm"><button type="button" class="btn btn--primary" id="entryActivate" data-act="activate"${issue || S.notice === "conflict" ? " disabled" : ""}>${esc(activeLabel)}</button><div class="row" style="margin-top:8px;gap:8px"><button type="button" class="btn" style="flex:1" data-act="panel" data-panel="switch" aria-expanded="${S.panel === "switch"}"><span class="icon-mask icon-mask--reset" aria-hidden="true"></span>${esc(t("c.switch"))}</button><button type="button" class="btn" style="flex:1" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("c.edit"))}</button></div></div>
      ${S.overlay === "replace" ? TS.replaceSheet(t, TF.device.active?.name || "", resultName(), TF.device.sessions) : S.overlay === "cancel" ? TS.cancelSheet(t) : ""}
      ${S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : ""}
    </div>`;
  }
  const header = () => `<header class="c-top"><span class="c-top__brand"><img src="vendor/brand/mark.png" alt="" width="26" height="26">Taurifer</span><span style="flex:1"></span>${TF.hasActiveProgram() || S.route !== "recommend" || S.confirmed.size ? `<button type="button" class="btn btn--link" data-act="cancel">${esc(t("c.cancel"))}</button>` : `<button type="button" class="btn btn--link">${esc(t("privacy.title"))}</button>`}</header>`;
  function resumeCard() { return `<div class="card c-resume" role="status"><div class="card__body stack stack--tight"><strong class="t-subtitle">${esc(t("c.resume.title"))}</strong><p class="t-small t-soft">${esc(t("c.resume.body"))}</p><div class="btnrow"><button type="button" class="btn btn--primary btn--noarrow" id="entryResumeContinue" data-act="resume">${esc(t("c.resume.continue"))}</button><button type="button" class="btn btn--destructive" data-act="resume-restart">${esc(t("c.resume.restart"))}</button></div></div></div>`; }
  function switchPanel() {
    const door = (act, icon, ttl, cap, extra = "") => `<button type="button" class="c-door" data-act="${act}" ${extra}><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="c-door__body"><span class="c-door__title">${esc(ttl)}</span>${cap ? `<span class="c-door__cap">${esc(cap)}</span>` : ""}</span><span class="chevron" aria-hidden="true"></span></button>`;
    return `<section class="c-panel" aria-labelledby="switchTitle"><div class="row row--between"><h2 class="t-subtitle" id="switchTitle" data-focus>${esc(t("c.switch.title"))}</h2><button type="button" class="btn btn--quiet" data-act="panel" data-panel="" aria-label="${esc(t("a.sheet.close", undefined, "Close"))}"><span class="icon-mask icon-mask--close" aria-hidden="true"></span></button></div><div class="stack stack--tight" style="margin-top:8px">${door("panel", "sliders", t("c.switch.facts"), "", 'data-panel=""')}${door("panel", "search", t("c.switch.browse"), t("c.switch.browse_cap"), 'data-panel="browse"')}${door("panel", "dumbbell", t("c.switch.custom"), t("c.switch.custom_cap"), 'data-panel="custom"')}${door("build-open", "pencil", t("c.switch.build"), t("c.switch.build_cap"))}${door("import-open", "clipboard", t("c.switch.bring"), t("c.switch.bring_cap"))}</div></section>`;
  }
  function browsePanel() {
    const a = answers(); const cards = TF.browseCards({ daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, environment: a.environment });
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    const card = (c) => { const name = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; return `<button type="button" class="c-door" data-act="catalogue" data-id="${esc(c.id)}" aria-label="${esc(t("entry.catalogue.review_aria", { name }))}"><span class="c-door__body"><span class="c-door__title">${esc(name)} · <span class="t-data">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span class="c-door__cap">${esc(t(`entry.catalogue.purpose.${c.purpose}`))} · ${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))} · ${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span></span><span class="chevron" aria-hidden="true"></span></button>`; };
    return `<section class="c-panel" aria-labelledby="browseTitle"><div class="row row--between"><h2 class="t-subtitle" id="browseTitle" data-focus>${esc(t("c.browse.title"))}</h2><button type="button" class="btn btn--quiet" data-act="panel" data-panel="" aria-label="${esc(t("c.browse.back"))}"><span class="icon-mask icon-mask--close" aria-hidden="true"></span></button></div><p class="t-small t-soft" style="margin:4px 0 8px">${esc(t("c.browse.lede"))}</p><div class="facts" style="margin-bottom:10px"><span class="t-data">${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span class="t-data">${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment.kind}`))}</span><button type="button" class="btn btn--link" data-act="browse-facts" style="padding:0 6px">${esc(t("x.change"))}</button></div>${S.browseFilters ? `<div class="well stack stack--tight" style="margin-bottom:10px"><p class="t-label">${esc(t("c.fact.days"))}</p>${factEditor("days")}<p class="t-label">${esc(t("c.fact.minutes"))}</p>${factEditor("minutes")}<p class="t-label">${esc(t("c.fact.where"))}</p>${factEditor("where")}</div>` : ""}<div class="stack stack--tight">${fits.map(card).join("")}</div>${others.length ? `<details class="disclosure disclosure--plain" style="margin-top:8px"><summary>${esc(t("entry.catalogue.group_other"))} (${others.length})</summary><div class="stack stack--tight" style="padding-top:8px">${others.map(card).join("")}</div></details>` : ""}</section>`;
  }
  function customPanel() {
    const a = S.answers; const tab = S.customTab || "muscles"; const sp = TF.splitChoices(answers());
    const tabs = [["muscles", t("c.custom.muscles")], ["exercises", t("c.custom.exercises")], ["shape", t("c.custom.shape")]];
    let body = "";
    if (tab === "muscles") body = `<p class="t-small t-soft">${esc(t("entry.priorities.state_hint"))}</p><div style="margin-top:8px">${TS.muscleEmphasis(t, a)}</div>`;
    if (tab === "exercises") body = TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] });
    if (tab === "shape") body = sp.choices.length === 1 ? `<p class="t-small t-soft">${esc(t("c.custom.shape_only"))} ${esc(t("entry.custom_shape.lede_sole"))}</p><div class="stack" style="margin-top:8px">${TS.choice({ key: "splitPreference", val: sp.choices[0].id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? sp.choices[0].namePt || sp.choices[0].name : sp.choices[0].name, days: sp.choices[0].frequency }), cap: t("entry.custom_shape.default_reason"), selected: true })}</div>` : sp.choices.length ? `<div class="stack" role="radiogroup">${sp.choices.map((c) => TS.choice({ key: "splitPreference", val: c.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }), cap: t(c.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason"), selected: a.splitPreference === c.id })).join("")}</div>` : `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p></div>`;
    return `<section class="c-panel" aria-labelledby="customTitle"><div class="row row--between"><h2 class="t-subtitle" id="customTitle" data-focus>${esc(t("c.custom.title"))}</h2><button type="button" class="btn btn--quiet" data-act="panel" data-panel="" aria-label="${esc(t("c.browse.back"))}"><span class="icon-mask icon-mask--close" aria-hidden="true"></span></button></div><div class="c-tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" class="c-tab${tab === id ? " is-selected" : ""}" aria-selected="${tab === id}" data-act="custom-tab" data-tab="${id}">${esc(l)}</button>`).join("")}</div><div style="margin-top:10px">${body}</div><button type="button" class="btn btn--primary btn--noarrow" style="margin-top:12px" data-act="custom-apply"${S.pref.pending ? " disabled" : ""}>${esc(t("c.custom.apply"))}</button></section>`;
  }
  function landingShared() {
    const shared = S.view === "shared-gate" && S.shared, invalid = S.view === "shared-invalid";
    return `<div class="page c-page c-land" data-checkpoint="${shared ? "shared-gate" : "shared-invalid"}">${header()}
      ${shared ? `<p class="t-label t-label--accent">${esc(t("landing.shared.eyebrow"))}</p><h1 class="c-head" data-focus>${esc(t("c.shared.head"))}</h1><p class="t-lede">${esc(t("c.shared.lede"))}</p><div class="c-shared"><strong class="t-subtitle">${esc(S.shared.program.meta.name)}</strong><span class="t-small t-soft">${esc(t("entry.catalogue.days_badge", { days: S.shared.program.meta.daysPerWeek }))} · ${esc(t("entry.preview.exercises", { n: S.shared.program.exercises.length, exercise: TF.tp(t, S.shared.program.exercises.length, "exercise") }))}</span><p class="t-caption">${esc(t("x.shared.what"))} ${esc(t("x.shared.nothing_saved"))}</p></div><button type="button" class="btn btn--primary btn--accent" id="firstRunSharedStart" data-act="shared-start">${esc(t("setup.shared.title"))}</button>`
      : `<h1 class="c-head" data-focus>${esc(t("landing.shared.invalid_headline"))}</h1><p class="t-lede">${esc(t("landing.shared.invalid_body"))}</p><p class="status-line" role="status" style="color:var(--danger)"><span class="icon-mask icon-mask--alert" aria-hidden="true"></span><span>${esc(t(TF.sharedErrorKey(S.sharedError)))}</span></p><div class="stack" style="margin-top:20px"><button type="button" class="btn btn--primary btn--accent" id="firstRunCreate" data-act="to-program">${esc(t("c.use").replace(/^Use this program$|^Usar este programa$/, lang === "pt" ? "Ver um programa para começar" : "See a program to start"))}</button><button type="button" class="btn btn--bordered btn--block" id="firstRunImport" data-act="import-open" style="min-height:54px">${esc(t("c.switch.bring"))}</button></div>`}
      <p class="t-caption" style="margin-top:18px">${esc(t("x.privacy.line"))}</p></div>`;
  }
  function buildView() {
    if (S.buildStep === "setup") return `<div class="page c-page" data-checkpoint="build-setup">${header()}<h1 class="t-title" data-focus>${esc(t("c.build.title"))}</h1><p class="t-lede">${esc(t("c.build.lede"))}</p>${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="cName" type="text" maxlength="80" data-field="programName" value="${esc(S.answers.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label><p class="t-label section-gap">${esc(t("entry.build_setup.days"))}</p><div class="c-seg" role="radiogroup">${TS.DAYS.map((n) => TS.chip({ key: "buildDays", val: n, label: `${n} ${t("entry.schedule.days.sub")}`, selected: S.buildDays === n, role: "radio" })).join("")}</div><footer class="pinned c-confirm"><button type="button" class="btn btn--primary" data-act="build-start"${S.answers.programName && S.buildDays ? "" : " disabled"}>${esc(t("c.build.open"))}</button></footer></div>`;
    const b = S.build; const issues = TS.build.issues(b, t); const ready = !issues.length;
    const cp = S.editing ? "activate" : ready ? "build-ready" : b.days.some((d) => d.exercises.length) ? "build-partial" : "build-empty";
    return `<div class="page c-page" data-checkpoint="${cp}">${header()}<h1 class="t-title" data-focus>${esc(S.editing ? t("c.edit") : b.name || t("c.build.title"))}</h1><p class="status-line" role="status" aria-live="polite" id="editorStatus" style="margin:6px 0 12px;color:${ready ? "var(--positive)" : "var(--danger)"}"><span class="icon-mask icon-mask--${ready ? "check" : "alert"}" aria-hidden="true"></span><span>${esc(ready ? t("entry.editor.ready") : issues.join(" "))}</span></p>${TS.build.editor(t, lang, b)}<div class="pinned c-confirm"><button type="button" class="btn btn--primary" id="entryEditorActivate" data-act="activate"${ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("entry.editor.use"))}</button>${S.editing ? `<button type="button" class="btn" style="margin-top:8px" data-act="edit-done">${esc(t("c.edit_done"))}</button>` : ""}</div>${S.overlay === "replace" ? TS.replaceSheet(t, TF.device.active?.name || "", b.name, TF.device.sessions) : S.overlay === "cancel" ? TS.cancelSheet(t) : ""}</div>`;
  }
  function importView() {
    if (S.importDraft) { const d = S.importDraft; const c = TF.importCounts(d); return `<div class="page c-page" data-checkpoint="import-review">${header()}<h1 class="t-title" data-focus>${esc(t("c.import.review"))}</h1><p class="t-lede">${esc(t("c.import.review_lede"))}</p><p class="t-caption">${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</p>${d.notImported.length ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}${TS.importReview.counts(t, d)}<div style="margin-top:12px">${TS.importReview.rows(t, lang, d, { picker: S.picker })}</div>${d.originalText ? `<details class="disclosure disclosure--plain"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="t-caption" style="white-space:pre-wrap">${esc(d.originalText)}</pre></details>` : ""}<p class="t-caption" style="margin-top:10px">${esc(t("import.safe"))}</p><div class="pinned c-confirm"><button type="button" class="btn btn--primary" id="importCommit" data-act="import-commit"${c.review ? " disabled" : ""}>${esc(c.review ? t("import.commit_blocked", { n: c.review }) : t("entry.preview.review"))}</button></div></div>`; }
    const ff = S.ff;
    if (S.importMode === "freeform") { const cp = ff.status === "gaps" ? (ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps") : ff.status === "unreadable" ? "ff-unreadable" : ff.stage === 3 ? "ff-reply" : ff.stage === 2 ? "ff-handoff" : TS.freeform.program(ff) ? "ff-filled" : "ff-empty"; return `<div class="page c-page" data-checkpoint="${cp}">${header()}<h1 class="t-title" data-focus>${esc(ff.status === "gaps" ? t("entry.freeform.gaps_title") : t("entry.freeform.title"))}</h1><p class="t-lede">${esc(ff.status === "gaps" ? t("entry.freeform.gaps_lede") : t("entry.freeform.lede"))}</p>${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}${TS.freeform.body(t, lang, ff)}<div class="row" style="justify-content:center;margin-top:16px"><button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="file">${esc(t("entry.freeform.to_file"))}</button></div>${S.overlay === "cancel" ? TS.cancelSheet(t) : ""}</div>`; }
    return `<div class="page c-page" data-checkpoint="import-source">${header()}<h1 class="t-title" data-focus>${esc(t("c.import.title"))}</h1><p class="t-lede">${esc(t("entry.import_source.lede"))}</p>${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<div class="stack stack--tight"><button type="button" class="c-door" data-act="import-mode" data-mode="freeform"><span class="icon-mask icon-mask--clipboard" aria-hidden="true"></span><span class="c-door__body"><span class="c-door__title">${esc(t("c.import.paste"))}</span><span class="c-door__cap">${esc(t("c.import.paste_cap"))}</span></span><span class="chevron" aria-hidden="true"></span></button><button type="button" class="c-door" id="entryImportPick" data-act="import-file"><span class="icon-mask icon-mask--download" aria-hidden="true"></span><span class="c-door__body"><span class="c-door__title">${esc(t("c.import.file"))}</span><span class="c-door__cap">${esc(t("c.import.file_cap"))}</span></span><span class="chevron" aria-hidden="true"></span></button></div></div>`;
  }
  function render(focus) {
    const saved = document.activeElement && document.activeElement.id;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (S.view === "shared-gate" || S.view === "shared-invalid") html = landingShared();
    else if (S.view === "build") html = buildView();
    else if (S.view === "import") html = importView();
    else html = program();
    root.innerHTML = html;
    if (saved && /Search|ffIn|ffOut|cName|pickerSearch/.test(saved)) TS.refocus(root, saved); else if (focus) TS.focusHeading(root);
  }

  /* ---------- actions ---------- */
  function on(act, d) {
    S.cpTag = null;
    if (act === "fact-open") { S.open = S.open === d.key ? null : d.key; S.panel = null; render(); return; }
    if (act === "fact-confirm") { S.confirmed.add(d.key); S.open = null; render(); return; }
    if (act === "help-toggle") { S.help = !S.help; return; }
    if (act === "pick") {
      if (d.key === "buildDays") { S.buildDays = +d.val; render(); return; }
      if (d.key === "avoidReason") { S.answers = TS.applyPick(S.answers, "avoidReason", d.val); S.pref.pending = null; render(); return; }
      S.answers = TS.applyPick(S.answers, d.key, d.val);
      if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
      if (FACTS.includes({ daysPerWeek: "days", environment: "where", environmentEquipment: "where", environmentCapabilities: "where", desiredResult: "goal", structuredExperience: "bg", recentConsistency: "bg", sessionMinutes: "minutes", preferredRestSeconds: "rest", primaryMuscles: "priority", priorityMovements: "priority" }[d.key])) { const k = { daysPerWeek: "days", environment: "where", environmentEquipment: "where", environmentCapabilities: "where", desiredResult: "goal", structuredExperience: "bg", recentConsistency: "bg", sessionMinutes: "minutes", preferredRestSeconds: "rest", primaryMuscles: "priority", priorityMovements: "priority" }[d.key]; S.confirmed.add(k); if (generated()) { S.mode = S.route === "custom" ? "custom" : "recommend"; compileNow(); } }
      render(); return;
    }
    if (act === "ex-open") { S.exOpen = S.exOpen === d.id ? null : d.id; render(); return; }
    if (act === "ex-cancel") { S.exOpen = null; S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id || S.applied?.has(d.id)); render(); return; }
    if (act === "ex-apply") { S.applied = S.applied || new Set(); for (const c of S.answers.exerciseConstraints || []) S.applied.add(c.exerciseId); S.exOpen = null; compileNow(); render(true); return; }
    if (act === "avoid-remove") { S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); if (S.pref.pending === d.id) S.pref.pending = null; if (generated()) compileNow(); render(true); return; }
    if (act === "panel") { S.panel = d.panel || null; S.open = null; S.browseFilters = false; if (d.panel === "custom") { S.mode = "custom"; S.customTab = S.customTab || "muscles"; } render(); const h = root.querySelector(".c-panel h2"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch {} } return; }
    if (act === "browse-facts") { S.browseFilters = !S.browseFilters; render(); return; }
    if (act === "custom-tab") { S.customTab = d.tab; render(); return; }
    if (act === "custom-apply") { S.mode = "custom"; compileNow(); S.panel = null; S.confirmed.add("priority"); render(true); return; }
    if (act === "pref-add") { if (d.status === "include") S.answers.mustHaveExercises = [...(S.answers.mustHaveExercises || []), d.id]; else S.pref.pending = d.id; S.pref.query = ""; render(); return; }
    if (act === "pref-remove") { S.answers.mustHaveExercises = (S.answers.mustHaveExercises || []).filter((x) => x !== d.id); S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); render(); return; }
    if (act === "field:prefQuery") { S.pref.query = d.value; render(); return; }
    if (act === "catalogue") { const card = TF.browseCards(answers()).find((c) => c.id === d.id); if (!card) return; S.answers.catalogueSelection = card.id; S.result = { fingerprint: card.fingerprint, name: card.name, namePt: card.namePt, selected: { id: card.id, familyId: card.familyId, daysPerWeek: card.daysPerWeek, blueprintId: card.id }, preview: card.preview }; S.route = "browse"; S.panel = null; S.diff = null; render(true); return; }
    if (act === "build-open") { S.panel = null; S.view = "build"; S.buildStep = "setup"; S.route = "build"; S.buildDays = S.buildDays || null; render(true); return; }
    if (act === "field:programName") { S.answers.programName = d.value.trim(); const b = root.querySelector('[data-act="build-start"]'); if (b) b.disabled = !(S.answers.programName && S.buildDays); return; }
    if (act === "build-start") { S.build = TS.build.create(S.answers.programName, S.buildDays); S.buildStep = "editor"; S.route = "build"; render(true); return; }
    if (act === "field:buildName") { S.build = TS.build.apply(S.build, "name", d.value); return; }
    if (act === "field:dayName") { S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return; }
    if (act === "field:rx" || act === "change:rx") { S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return; }
    if (act === "field:pickerQuery") { if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return; }
    if (act === "build") { S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(); return; }
    if (act === "pick-exercise") { if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return; }
    if (act === "import-open") { S.panel = null; S.view = "import"; S.route = "import"; S.importMode = "file"; S.importDraft = null; S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-mode") { S.importMode = d.mode; S.importDraft = null; if (d.mode === "file") S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-file") { S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("c.file_picked"), "file"); render(true); return; }
    if (act === "imp") { if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return; }
    if (act === "import-commit") { const preview = TF.importPreview(S.importDraft, t); S.result = { fingerprint: "import", name: preview.name, selected: { id: "import", source: "import" }, preview }; S.route = "import"; S.importDraft = null; S.view = "program"; S.diff = null; render(true); return; }
    if (act === "ff") {
      if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); afterFreeform(); return; }
      if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); setTimeout(() => { S.toast = null; render(); }, 1800); return; }
      S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t); afterFreeform(); return;
    }
    if (act === "field:ffInput") { S.ff = TS.freeform.apply(S.ff, "input", d.value); const c = root.querySelector("#ffCount"); if (c) c.textContent = t("entry.freeform.count", { n: TF.nf(lang, S.ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }); const need = root.querySelector("#ffNeeds"); if (need) need.hidden = !!TS.freeform.program(S.ff); const btn = root.querySelector('[data-ff="continue"]'); if (btn) btn.disabled = !TS.freeform.program(S.ff); return; }
    if (act === "field:ffReply") { S.ff = TS.freeform.apply(S.ff, "reply", d.value); return; }
    if (act === "field:gap") { S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return; }
    if (act === "shared-start") { S.route = "shared"; S.mode = "shared"; S.result = { fingerprint: "shared", name: S.shared.program.meta.name, selected: { id: "shared", source: "shared" }, preview: TF.sharedPreview(S.shared) }; S.view = "program"; S.diff = null; render(true); return; }
    if (act === "to-program") { S.view = "program"; render(true); return; }
    if (act === "activate") { requestActivate(); return; }
    if (act === "replace-confirm") { S.overlay = null; activateNow(); return; }
    if (act === "replace-cancel") { S.overlay = null; render(); return; }
    if (act === "conflict-review") { S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return; }
    if (act === "rules-rebuild") { S.notice = null; S.draft = null; if (generated()) compileNow(); render(true); return; }
    if (act === "rules-keep") { S.pinned = true; S.notice = null; render(); return; }
    if (act === "resume") { const st = S.draft.state; S.answers = { ...S.answers, ...st.answers }; for (const k of Object.keys(st.answers)) { const m = { daysPerWeek: "days", environment: "where", desiredResult: "goal", structuredExperience: "bg", sessionMinutes: "minutes", preferredRestSeconds: "rest" }[k]; if (m) S.confirmed.add(m); } S.notice = null; S.revAtStart = st.activeProgramRevisionAtStart; compileNow(); S.diff = null; render(true); return; }
    if (act === "resume-restart") { S.draft = null; S.notice = null; render(true); return; }
    if (act === "cancel") { if (S.route === "shared") { S.view = "shared-gate"; render(true); return; } S.overlay = "cancel"; render(); return; }
    if (act === "cancel-continue") { S.overlay = null; render(); return; }
    if (act === "cancel-keep") { S.overlay = null; if (TF.hasActiveProgram()) { S.view = "today"; render(true); return; } fresh("fresh"); render(true); return; }
    if (act === "cancel-discard") { fresh(TF.hasActiveProgram() ? "existing" : "fresh"); if (TF.hasActiveProgram()) S.view = "today"; render(true); return; }
    if (act === "edit") { S.build = TS.build.create(resultName(), (S.result.preview.days || []).length); S.build.days = (S.result.preview.days || []).map((dd) => ({ dayId: dd.dayId || dd.label, label: TF.dayName(t, dd, S.result.preview.programStructure), exercises: (dd.exercises || []).map((e) => ({ id: e.id, libraryId: e.libraryId, name: e.name, sets: e.sets, min: e.min, max: e.max, primary: TF.libraryEntry(e.libraryId)?.primary })) })); S.editing = true; S.buildStep = "editor"; S.view = "build"; render(true); return; }
    if (act === "edit-done") { S.result = { ...S.result, preview: { ...TS.build.preview(S.build, t), source: S.result.preview.source }, name: S.build.name || S.result.name }; S.editing = false; S.view = "program"; S.diff = null; render(true); return; }
  }
  function afterFreeform() {
    if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported, originalText: S.ff.input }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); render(true); return; }
    render(true);
  }

  /* ---------- reach ---------- */
  const U = () => TF.F.users;
  function confirmAll() { for (const k of ["days", "where", "goal", "bg", "rest"]) S.confirmed.add(k); S.answers.preferredRestSeconds = TF.F.users.rafael.answers.preferredRestSeconds; }
  function customInto() { const u = U().custom.answers; Object.assign(S.answers, { desiredResult: u.desiredResult, daysPerWeek: u.daysPerWeek, preferredRestSeconds: u.preferredRestSeconds, primaryMuscles: [...u.primaryMuscles], deEmphasizedMuscles: [...u.deEmphasizedMuscles], mustHaveExercises: [...u.mustHaveExercises], exerciseConstraints: u.exerciseConstraints.map((c) => ({ ...c })) }); confirmAll(); S.mode = "custom"; compileNow(); S.panel = "custom"; }
  function correctionInto() { const c = U().rafael.correction; S.answers.environment = TF.env(c.environmentKind); S.answers.environment.equipment = [...new Set([...S.answers.environment.equipment, ...c.equipmentAdd])]; S.answers.environment.capabilities = [...new Set([...S.answers.environment.capabilities, ...c.capabilitiesAdd])]; S.confirmed.add("where"); }
  async function reach(cp) {
    switch (cp) {
      case "landing": break;
      case "route-choice": S.panel = "switch"; break;
      case "route-help": S.help = true; break;
      case "rec-goal": S.open = "goal"; break;
      case "rec-background": S.open = "bg"; break;
      case "rec-schedule": S.open = "days"; break;
      case "rec-environment": S.open = "where"; break;
      case "rec-priorities": confirmAll(); S.open = "priority"; break;
      case "rec-result": confirmAll(); S.diff = null; break;
      case "rec-env-correction": correctionInto(); S.open = "where"; S.envOpen = true; compileNow(); break;
      case "rec-result-corrected": correctionInto(); confirmAll(); compileNow(); S.cpTag = "rec-result-corrected"; break;
      case "rec-avoid-pain": confirmAll(); S.answers.primaryMuscles = [...U().rafael.pain.primaryMuscles]; compileNow(); S.answers.exerciseConstraints = [{ exerciseId: U().rafael.pain.exerciseId, reason: "pain" }]; S.exOpen = U().rafael.pain.exerciseId; S.diff = null; break;
      case "rec-result-avoided": confirmAll(); S.answers.primaryMuscles = [...U().rafael.pain.primaryMuscles]; compileNow(); S.answers.exerciseConstraints = [{ exerciseId: U().rafael.pain.exerciseId, reason: "pain" }]; S.applied = new Set([U().rafael.pain.exerciseId]); compileNow(); S.cpTag = "rec-result-avoided"; break;
      case "browse-filters": confirmAll(); S.answers.daysPerWeek = 4; compileNow(); S.panel = "browse"; S.browseFilters = true; break;
      case "browse-list": confirmAll(); S.answers.daysPerWeek = 4; compileNow(); S.panel = "browse"; break;
      case "browse-preview": confirmAll(); S.answers.daysPerWeek = 4; compileNow(); render(); on("catalogue", { id: "balanced_4_v1" }); return;
      case "custom-priorities": customInto(); S.customTab = "muscles"; break;
      case "custom-exercises": customInto(); S.customTab = "exercises"; break;
      case "custom-shape": customInto(); S.customTab = "shape"; break;
      case "custom-result": customInto(); S.panel = null; S.diff = null; break;
      case "build-setup": S.view = "build"; S.route = "build"; S.buildStep = "setup"; break;
      case "build-empty": S.view = "build"; S.route = "build"; S.buildStep = "editor"; S.build = TS.build.create(lang === "pt" ? "Meu programa" : "My program", 3); break;
      case "build-partial": S.view = "build"; S.route = "build"; S.buildStep = "editor"; S.build = TS.build.create(lang === "pt" ? "Meu programa" : "My program", 3); S.build.picker = "manual_d1"; S.build = TS.build.apply(S.build, "add", "pd_bw"); break;
      case "build-ready": S.view = "build"; S.route = "build"; S.buildStep = "editor"; S.build = TS.build.create(lang === "pt" ? "Meu programa" : "My program", 3); for (const [dd, id] of [["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]) { S.build.picker = dd; S.build = TS.build.apply(S.build, "add", id); } break;
      case "ff-empty": S.view = "import"; S.route = "import"; S.importMode = "freeform"; break;
      case "ff-filled": S.view = "import"; S.route = "import"; S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); break;
      case "ff-handoff": S.view = "import"; S.route = "import"; S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"); break;
      case "ff-reply": S.view = "import"; S.route = "import"; S.importMode = "freeform"; S.ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "chatgpt"); break;
      case "ff-gaps": case "ff-gaps-invalid": { S.view = "import"; S.route = "import"; S.importMode = "freeform"; let ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "chatgpt"); ff = TS.freeform.apply(ff, "reply", TF.F.freeform.replyGaps[lang]); ff = TS.freeform.apply(ff, "review"); if (cp === "ff-gaps-invalid") ff = TS.freeform.apply(ff, "gap-submit"); S.ff = ff; break; }
      case "ff-unreadable": { S.view = "import"; S.route = "import"; S.importMode = "freeform"; let ff = TS.freeform.apply(TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]), "continue"), "copy", "claude"); ff = TS.freeform.apply(ff, "reply", TF.F.freeform.replyUnreadable[lang]); ff = TS.freeform.apply(ff, "review"); S.ff = ff; break; }
      case "import-source": S.view = "import"; S.route = "import"; S.importMode = "file"; break;
      case "import-review": S.view = "import"; S.route = "import"; S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("c.file_picked"), "file"); break;
      case "import-preview": { S.view = "import"; S.route = "import"; S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("c.file_picked"), "file"); for (const r of S.importDraft.rows) if (!r.reviewed) S.importDraft = TS.importReview.apply(S.importDraft, r.shortlist.length ? "pick" : "raw", r.key, 0); render(); on("import-commit", {}); return; }
      case "shared-gate": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; break; }
      case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.payload; S.view = "shared-gate"; render(); on("shared-start", {}); return; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "hub-existing": break;
      case "replace-confirm": confirmAll(); S.overlay = "replace"; break;
      case "activation-conflict": confirmAll(); TF.device.revision += 1; TF.device.active.name = lang === "pt" ? "Programa mais novo" : "Newer active program"; render(); activateNow(); return;
      case "resume": S.draft = TS.seeds.interruptedDraft(lang); S.notice = "resume"; break;
      case "rules-changed": { S.draft = TS.seeds.rulesDriftDraft(); S.answers = { ...S.answers, ...S.draft.state.answers }; S.notice = "rules_changed"; S.cpTag = "rules-changed"; break; }
      case "cancel-confirm": S.confirmed.add("days"); S.overlay = "cancel"; break;
      case "activate": confirmAll(); S.cpTag = "activate"; break;
      case "activated-today": confirmAll(); render(); activateNow(); return;
      default: break;
    }
    render(true);
  }
  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.c = {
    id: "c", name: "C · Programa primeiro",
    async mount(c) { ctx = c; lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); TS.wire(root, on); render(); },
    reach, state: () => S,
  };
})();
