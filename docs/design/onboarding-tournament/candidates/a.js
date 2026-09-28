/* Candidate A · Uma pergunta
   Thesis: never make a new lifter choose a method. Ask the four things that
   change the program (days, where, goal, recent training), one per screen,
   show the program at once, and let every other route appear as a refinement
   of what is on the screen ("something different?"). Session length and rest
   are assumed and shown as editable facts.
   Product-policy decisions this direction requires (flagged, not silently
   applied): (1) Recommend, Custom and Browse collapse into one guided path
   with refinements, which Plan 054 explicitly did not authorise; (2) session
   length defaults to 60 min and rest to automatic before the lifter answers,
   shown as "assumed" facts. Everything else (activation rules, replacement,
   shared gate, import review, free-form stages, build gating) is production. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    en: {
      "a.land.head": "Your next session, already decided.",
      "a.land.lede": "Four questions. Then a program you can train tomorrow, and change any time.",
      "a.land.start": "Start",
      "a.land.have": "I already have a program",
      "a.land.how": "How it works",
      "a.land.how1": "Answer four short questions: days, where, goal, recent training.",
      "a.land.how2": "See the whole program, with every set and rep range.",
      "a.land.how3": "Change any fact on the program itself, or swap it for a ready-made one, or bring your own.",
      "a.land.how4": "Start it. Nothing is saved before that.",
      "a.q.of": "Question {n} of {total}",
      "a.q.days": "How many days a week can you train?",
      "a.q.days_lede": "Be realistic. The program is built around this number.",
      "a.q.where": "Where will you train?",
      "a.q.where_lede": "Choose the closest. You can fix the equipment list right here.",
      "a.q.goal": "What do you want most from it?",
      "a.q.goal_lede": "This sets the rep ranges and the starting volume.",
      "a.q.bg": "How has your training been lately?",
      "a.q.bg_lede": "Answer for the last six weeks. It decides how much the first week carries.",
      "a.q.next": "Next",
      "a.q.show": "Show my program",
      "a.q.back": "Back",
      "a.res.made": "Built from your {n} answers",
      "a.res.facts": "Built from",
      "a.res.assumed": "assumed",
      "a.res.why": "Why this program",
      "a.res.adjust": "Adjusted for you",
      "a.res.avoids": "Kept out",
      "a.res.diff": "Something different?",
      "a.res.updated": "Program updated.",
      "a.res.use": "Use this program",
      "a.res.row_hint": "Tap an exercise to keep it out of the program.",
      "a.fact.days": "{n} days a week",
      "a.fact.minutes": "up to {n} min a session",
      "a.fact.rest": "rest between sets: {v}",
      "a.fact.rest_auto": "rest chosen by Taurifer",
      "a.fact.priority_none": "no muscle priority",
      "a.fact.priority": "priority: {list}",
      "a.fact.custom": "your muscle emphasis and exercise choices",
      "a.sheet.days": "Days a week",
      "a.sheet.where": "Where you train",
      "a.sheet.goal": "What to prioritize",
      "a.sheet.bg": "Recent training",
      "a.sheet.minutes": "Longest usual session",
      "a.sheet.rest": "Rest between demanding sets",
      "a.sheet.priority": "Muscles to prioritize",
      "a.sheet.priority_lede": "At most two. Leave it empty and everything is balanced.",
      "a.sheet.apply": "Update program",
      "a.sheet.close": "Close",
      "a.sheet.ex_title": "{name}",
      "a.sheet.ex_avoid": "Keep this exercise out",
      "a.sheet.ex_lede": "Taurifer rebuilds the program without it. Say why, so it can pick a safe substitute.",
      "a.sheet.ex_keep": "Keep it",
      "a.sheet.ex_restore": "Allow it again",
      "a.more.browse": "See ready-made programs for {n} days",
      "a.more.browse_cap": "Twenty released Taurifer programs, filtered by your week",
      "a.more.custom": "Choose muscles and exercises",
      "a.more.custom_cap": "Set an emphasis per muscle, include or avoid specific exercises",
      "a.more.build": "Write it from scratch",
      "a.more.build_cap": "Empty days, your exercises, your targets",
      "a.more.bring": "Paste or import my own",
      "a.more.bring_cap": "A coach's message, your notes, or a Taurifer file",
      "a.bring.title": "Bring your program",
      "a.bring.paste": "Paste it as text",
      "a.bring.paste_cap": "From a coach, notes or a spreadsheet. ChatGPT or Claude converts it.",
      "a.bring.file": "Import a Taurifer file",
      "a.bring.file_cap": "A program exported from Taurifer on another device",
      "a.bring.build": "Write it in",
      "a.bring.build_cap": "Empty days you fill yourself",
      "a.browse.title": "Ready-made programs",
      "a.browse.for": "For {days} days, up to {minutes} min, {env}",
      "a.custom.muscles": "Muscle emphasis",
      "a.custom.exercises": "Exercises to include or avoid",
      "a.custom.shape": "Weekly structure",
      "a.custom.shape_only": "Only one structure fits these answers. Taurifer sets the sets, targets and progression.",
      "a.build.title": "Write your program",
      "a.build.lede": "Name it and choose how many days. Then fill each day.",
      "a.build.open": "Open the days",
      "a.import.title": "Bring your program",
      "a.import.file": "Choose a Taurifer file",
      "a.import.review": "Check the exercises",
      "a.import.review_lede": "Match each name to the library, or keep it as written. Nothing is saved yet.",
      "a.shared.head": "A program was sent to you.",
      "a.shared.lede": "Look it over, then start it here.",
      "a.resume.title": "Continue where you stopped?",
      "a.resume.at": "Question {n} of {total} · saved {when}",
      "a.today.toast": "Program active. Today shows your first session.",
      "a.file_picked": "Rafael's program.json",
      "a.cancel": "Cancel",
      "a.exit": "Leave",
      "a.edit": "Edit exercises",
      "a.edit_done": "Back to program",
      "a.restart": "Start over",
    },
    pt: {
      "a.land.head": "Sua próxima sessão, já decidida.",
      "a.land.lede": "Quatro perguntas. Depois um programa para treinar amanhã, que você muda quando quiser.",
      "a.land.start": "Começar",
      "a.land.have": "Já tenho um programa",
      "a.land.how": "Como funciona",
      "a.land.how1": "Responda quatro perguntas curtas: dias, onde, objetivo, treino recente.",
      "a.land.how2": "Veja o programa inteiro, com cada série e faixa de repetições.",
      "a.land.how3": "Mude qualquer fato no próprio programa, troque por um pronto ou traga o seu.",
      "a.land.how4": "Comece. Nada é salvo antes disso.",
      "a.q.of": "Pergunta {n} de {total}",
      "a.q.days": "Quantos dias por semana você consegue treinar?",
      "a.q.days_lede": "Seja realista. O programa é montado em cima desse número.",
      "a.q.where": "Onde você vai treinar?",
      "a.q.where_lede": "Escolha o mais próximo. Dá para corrigir a lista de equipamentos aqui mesmo.",
      "a.q.goal": "O que você mais quer com ele?",
      "a.q.goal_lede": "Isso define as faixas de repetições e o volume inicial.",
      "a.q.bg": "Como anda seu treino ultimamente?",
      "a.q.bg_lede": "Responda pelas últimas seis semanas. Isso decide quanto a primeira semana carrega.",
      "a.q.next": "Próxima",
      "a.q.show": "Mostrar meu programa",
      "a.q.back": "Voltar",
      "a.res.made": "Montado a partir das suas {n} respostas",
      "a.res.facts": "Montado com",
      "a.res.assumed": "suposto",
      "a.res.why": "Por que este programa",
      "a.res.adjust": "Ajustado para você",
      "a.res.avoids": "Deixado de fora",
      "a.res.diff": "Quer algo diferente?",
      "a.res.updated": "Programa atualizado.",
      "a.res.use": "Usar este programa",
      "a.res.row_hint": "Toque em um exercício para deixá-lo fora do programa.",
      "a.fact.days": "{n} dias por semana",
      "a.fact.minutes": "até {n} min por sessão",
      "a.fact.rest": "descanso entre séries: {v}",
      "a.fact.rest_auto": "descanso escolhido pelo Taurifer",
      "a.fact.priority_none": "sem prioridade muscular",
      "a.fact.priority": "prioridade: {list}",
      "a.fact.custom": "sua ênfase por músculo e escolhas de exercícios",
      "a.sheet.days": "Dias por semana",
      "a.sheet.where": "Onde você treina",
      "a.sheet.goal": "O que priorizar",
      "a.sheet.bg": "Treino recente",
      "a.sheet.minutes": "Sessão mais longa habitual",
      "a.sheet.rest": "Descanso entre séries exigentes",
      "a.sheet.priority": "Músculos a priorizar",
      "a.sheet.priority_lede": "No máximo dois. Deixe vazio e tudo fica equilibrado.",
      "a.sheet.apply": "Atualizar programa",
      "a.sheet.close": "Fechar",
      "a.sheet.ex_title": "{name}",
      "a.sheet.ex_avoid": "Deixar este exercício fora",
      "a.sheet.ex_lede": "O Taurifer remonta o programa sem ele. Diga o motivo para ele escolher um substituto seguro.",
      "a.sheet.ex_keep": "Manter",
      "a.sheet.ex_restore": "Permitir de novo",
      "a.more.browse": "Ver programas prontos para {n} dias",
      "a.more.browse_cap": "Vinte programas Taurifer publicados, filtrados pela sua semana",
      "a.more.custom": "Escolher músculos e exercícios",
      "a.more.custom_cap": "Defina a ênfase por músculo, inclua ou evite exercícios específicos",
      "a.more.build": "Escrever do zero",
      "a.more.build_cap": "Dias vazios, seus exercícios, suas metas",
      "a.more.bring": "Colar ou importar o meu",
      "a.more.bring_cap": "Mensagem do treinador, suas anotações ou um arquivo Taurifer",
      "a.bring.title": "Traga seu programa",
      "a.bring.paste": "Colar como texto",
      "a.bring.paste_cap": "Do treinador, das notas ou de uma planilha. O ChatGPT ou o Claude converte.",
      "a.bring.file": "Importar um arquivo Taurifer",
      "a.bring.file_cap": "Um programa exportado do Taurifer em outro aparelho",
      "a.bring.build": "Escrever o meu",
      "a.bring.build_cap": "Dias vazios que você mesmo preenche",
      "a.browse.title": "Programas prontos",
      "a.browse.for": "Para {days} dias, até {minutes} min, {env}",
      "a.custom.muscles": "Ênfase por músculo",
      "a.custom.exercises": "Exercícios para incluir ou evitar",
      "a.custom.shape": "Estrutura semanal",
      "a.custom.shape_only": "Só uma estrutura combina com estas respostas. O Taurifer define séries, metas e progressão.",
      "a.build.title": "Escreva seu programa",
      "a.build.lede": "Dê um nome e escolha quantos dias. Depois preencha cada dia.",
      "a.build.open": "Abrir os dias",
      "a.import.title": "Traga seu programa",
      "a.import.file": "Escolher um arquivo Taurifer",
      "a.import.review": "Confira os exercícios",
      "a.import.review_lede": "Vincule cada nome à biblioteca ou mantenha como está escrito. Nada foi salvo ainda.",
      "a.shared.head": "Enviaram um programa para você.",
      "a.shared.lede": "Dê uma olhada e comece aqui.",
      "a.resume.title": "Continuar de onde parou?",
      "a.resume.at": "Pergunta {n} de {total} · salvo {when}",
      "a.today.toast": "Programa ativo. Hoje mostra sua primeira sessão.",
      "a.file_picked": "Treino do Rafael.json",
      "a.cancel": "Cancelar",
      "a.exit": "Sair",
      "a.edit": "Editar exercícios",
      "a.edit_done": "Voltar ao programa",
      "a.restart": "Começar de novo",
    },
  };
  const QUESTIONS = ["days", "where", "goal", "bg"];
  const DEFAULTS = { sessionMinutes: 60, preferredRestSeconds: null };
  let ctx, t, lang, root, S;

  function fresh(seed) {
    TF.seedDevice(seed === "existing" ? "existing" : "fresh");
    S = { view: "landing", q: 0, answers: { ...DEFAULTS, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [], mustHaveExercises: [], deEmphasizedMuscles: [], ignoredMuscles: [] }, assumed: new Set(["sessionMinutes", "preferredRestSeconds"]), mode: "recommend", route: "recommend", result: null, sheet: null, overlay: null, notice: null, envOpen: false, how: false, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, ff: TS.freeform.create(), importDraft: null, importMode: "file", build: null, buildStep: "setup", picker: null, editing: false, revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, draft: null, updated: false, cpTag: null, pinned: false };
  }
  const answers = () => TF.normalizeAnswers(S.answers);
  const generated = () => S.route === "recommend" || S.route === "custom";
  function compileNow() {
    if (S.mode === "custom") { const sp = TF.splitChoices(answers()); if (sp.choices.length && !sp.choices.some((c) => c.id === S.answers.splitPreference)) S.answers.splitPreference = (sp.choices.find((c) => c.default) || sp.choices[0]).id; }
    const r = TF.compile(S.mode, answers());
    if (r.ok) { S.result = { fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, candidates: r.candidates, alternative: r.alternative, preview: r.preview, explanation: r.explanation }; S.route = S.mode; S.compileError = null; } else { S.result = null; S.compileError = r; }
  }
  const resultName = () => (S.result ? (lang === "pt" ? S.result.namePt || S.result.name : S.result.name) || S.answers.programName || t("untitled_program") : "");
  function entry(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step: step || (S.route === "build" ? "editor" : "preview"), activeProgramRevisionAtStart: S.revAtStart, versions: S.draft?.state?.versions }); }
  function activateNow() {
    const r = TF.activate(entry(), { pinnedVersionsExecutable: S.pinned });
    if (r.ok) { S.view = "today"; S.toast = t("a.today.toast"); render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.sheet = null; render(true); return; }
    if (r.code === "rules_changed_rebuild_required") { S.notice = "rules_changed"; render(); return; }
    S.activationIssues = r.issues || [r.code]; render();
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }
  const complete = () => !!(S.answers.daysPerWeek && S.answers.environment && S.answers.desiredResult && S.answers.structuredExperience && S.answers.recentConsistency);
  const qAnswered = (q) => ({ days: !!S.answers.daysPerWeek, where: !!S.answers.environment, goal: !!S.answers.desiredResult, bg: !!(S.answers.structuredExperience && S.answers.recentConsistency) }[q]);

  /* ---------- pieces ---------- */
  const heading = (title, lede) => `<h1 class="t-title a-q" data-focus>${esc(title)}</h1>${lede ? `<p class="t-lede a-lede">${esc(lede)}</p>` : ""}`;
  const topbar = (label, act = "cancel") => `<header class="a-top"><button type="button" class="btn btn--link" data-act="${act}" style="margin-left:-4px">${esc(label)}</button>${S.notice === "rules_changed" ? "" : ""}</header>`;
  function landing() {
    const shared = S.view === "shared-gate" && S.shared, invalid = S.view === "shared-invalid";
    const resume = S.notice === "resume" && S.draft ? resumeCard() : "";
    return `<div class="page a-land" data-checkpoint="${shared ? "shared-gate" : invalid ? "shared-invalid" : S.sheet?.kind === "bring" ? "route-choice" : S.how ? "route-help" : S.notice === "resume" ? "resume" : "landing"}">
      <header class="a-land__brand"><img src="vendor/brand/mark.png" alt="" width="36" height="36"><span class="a-land__word">Taurifer</span><span style="flex:1"></span><button type="button" class="btn btn--link">${esc(t("privacy.title"))}</button></header>
      ${resume}
      ${shared ? `<p class="t-label t-label--accent">${esc(t("landing.shared.eyebrow"))}</p><h1 class="a-land__head" data-focus>${esc(t("a.shared.head"))}</h1><p class="t-lede">${esc(t("a.shared.lede"))}</p>
        <div class="a-shared"><strong class="t-subtitle">${esc(S.shared.program.meta.name)}</strong><span class="t-small t-soft">${esc(t("entry.catalogue.days_badge", { days: S.shared.program.meta.daysPerWeek }))} · ${esc(t("entry.preview.exercises", { n: S.shared.program.exercises.length, exercise: TF.tp(t, S.shared.program.exercises.length, "exercise") }))}</span><p class="t-caption">${esc(t("x.shared.what"))} ${esc(t("x.shared.nothing_saved"))}</p></div>
        <button type="button" class="btn btn--primary btn--accent" id="firstRunSharedStart" data-act="shared-start">${esc(t("setup.shared.title"))}</button>`
      : `${invalid ? `<h1 class="a-land__head" data-focus>${esc(t("landing.shared.invalid_headline"))}</h1><p class="t-lede">${esc(t("landing.shared.invalid_body"))}</p><p class="status-line" role="status" style="color:var(--danger)"><span class="icon-mask icon-mask--alert" aria-hidden="true"></span><span>${esc(t(TF.sharedErrorKey(S.sharedError)))}</span></p>` : `<h1 class="a-land__head" data-focus>${esc(t("a.land.head"))}</h1><p class="t-lede">${esc(t("a.land.lede"))}</p>`}
        <div class="stack" style="margin-top:24px">
          <button type="button" class="btn btn--primary btn--accent" id="firstRunCreate" data-act="start">${esc(t("a.land.start"))}</button>
          <button type="button" class="btn btn--bordered btn--block" id="firstRunImport" data-act="bring" style="min-height:54px">${esc(t("a.land.have"))}</button>
        </div>
        <details class="disclosure disclosure--plain" ${S.how ? "open" : ""} style="margin-top:14px" data-role="how"><summary data-act="how-toggle">${esc(t("a.land.how"))}</summary><ol class="a-how">${[1, 2, 3, 4].map((i) => `<li><span class="a-how__n" aria-hidden="true">${i}</span><span>${esc(t(`a.land.how${i}`))}</span></li>`).join("")}</ol></details>
        <p class="t-caption" style="margin-top:18px">${esc(t("x.privacy.line"))}</p>`}
      ${S.sheet?.kind === "bring" ? bringSheet() : ""}
    </div>`;
  }
  function resumeCard() {
    const st = S.draft.state; const when = new Date(st.updatedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { month: "short", day: "numeric" });
    const n = Math.min(4, Object.keys(st.answers).filter((k) => ["daysPerWeek", "environment", "desiredResult", "structuredExperience"].includes(k)).length + 1);
    return `<div class="card a-resume" role="status"><div class="card__body stack stack--tight"><strong class="t-subtitle">${esc(t("a.resume.title"))}</strong><p class="t-small t-soft">${esc(t("entry.resume.body"))}</p><p class="status-line"><span class="icon-mask icon-mask--pin" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("a.resume.at", { n, total: 4, when }))}</span></p><div class="btnrow"><button type="button" class="btn btn--primary btn--noarrow" id="entryResumeContinue" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="btn btn--destructive" data-act="resume-restart">${esc(t("entry.resume.restart"))}</button></div></div></div>`;
  }
  function bringSheet() {
    const door = (act, icon, title, cap, mode) => `<button type="button" class="a-door" data-act="${act}"${mode ? ` data-mode="${mode}"` : ""}><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="a-door__body"><span class="a-door__title">${esc(title)}</span><span class="a-door__cap">${esc(cap)}</span></span><span class="chevron" aria-hidden="true"></span></button>`;
    return `<div class="sheet-scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="bringTitle" data-checkpoint="route-choice"><span class="sheet__grab" aria-hidden="true"></span><h2 class="t-section" id="bringTitle" data-focus>${esc(t("a.bring.title"))}</h2><div class="stack stack--tight" style="margin-top:12px">${door("import-open", "clipboard", t("a.bring.paste"), t("a.bring.paste_cap"), "freeform")}${door("import-open", "download", t("a.bring.file"), t("a.bring.file_cap"), "file")}${door("build-open", "pencil", t("a.bring.build"), t("a.bring.build_cap"))}</div><button type="button" class="btn btn--quiet btn--block" style="margin-top:10px" data-act="sheet-close">${esc(t("a.sheet.close"))}</button></div>`;
  }
  function ask() {
    const q = QUESTIONS[S.q]; const a = S.answers; const last = S.q === QUESTIONS.length - 1;
    const cpMap = { days: "rec-schedule", where: S.envOpen ? "rec-env-correction" : "rec-environment", goal: "rec-goal", bg: "rec-background" };
    let body = "";
    if (q === "days") body = heading(t("a.q.days"), t("a.q.days_lede")) + `<div class="a-days" role="radiogroup" aria-label="${esc(t("a.q.days"))}">${TS.DAYS.map((n) => `<button type="button" class="a-day${a.daysPerWeek === n ? " is-selected" : ""}" role="radio" aria-checked="${a.daysPerWeek === n}" data-act="pick" data-key="daysPerWeek" data-val="${n}"><span class="a-day__n">${n}</span><span class="a-day__l">${esc(t("entry.schedule.days.sub"))}</span></button>`).join("")}</div>`;
    if (q === "where") body = heading(t("a.q.where"), t("a.q.where_lede")) + `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("a.q.where"))}">${TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment?.kind === v, icon: TS.ENV_ICON[v] })).join("")}</div>${a.environment ? `<div style="margin-top:12px">${TS.environmentCorrection(t, a.environment, { open: S.envOpen })}</div>` : ""}`;
    if (q === "goal") body = heading(t("a.q.goal"), t("a.q.goal_lede")) + `<div class="stack" role="radiogroup" aria-label="${esc(t("a.q.goal"))}">${TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v, icon: TS.DESIRED_ICON[v] })).join("")}</div>`;
    if (q === "bg") body = heading(t("a.q.bg"), t("a.q.bg_lede")) + `<p class="t-label" id="expLab">${esc(t("entry.background.experience.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="expLab">${TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "choice--compact" })).join("")}</div><p class="t-label section-gap" id="conLab">${esc(t("entry.background.consistency.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="conLab">${TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`;
    return `<div class="page a-page" data-checkpoint="${TF.hasActiveProgram() && S.q === 0 && !S.cpTag ? "hub-existing" : cpMap[q]}">
      ${topbar(t("a.cancel"))}
      ${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}
      ${S.notice === "rules_changed" ? TS.rulesNotice(t) : ""}
      <div class="a-prog"><span class="t-label" aria-live="polite">${esc(t("a.q.of", { n: S.q + 1, total: QUESTIONS.length }))}</span><div class="segbar" data-progress-dimension="task" data-progress-scope="entry-route-step">${QUESTIONS.map((_, i) => `<span class="segbar__seg${i <= S.q ? " is-done" : ""}"></span>`).join("")}</div></div>
      <main class="view-enter">${body}</main>
      <footer class="pinned a-nav"><div class="row">${S.q > 0 ? `<button type="button" class="btn" data-act="q-back" style="flex:0 0 auto;min-width:96px">${esc(t("a.q.back"))}</button>` : ""}<button type="button" class="btn btn--primary" data-act="q-next" style="flex:1"${qAnswered(q) ? "" : " disabled"}>${esc(last ? t("a.q.show") : t("a.q.next"))}</button></div></footer>
      ${S.overlay === "cancel" ? TS.cancelSheet(t) : ""}</div>`;
  }
  /* The result is the review: facts you can change, the program you can prune, one action. */
  function result() {
    const cp = S.cpTag || (S.sheet?.kind === "fact" && S.sheet.key === "priority" ? "rec-priorities" : S.sheet?.kind === "exercise" ? "rec-avoid-pain" : S.sheet?.kind === "more" ? "browse-filters" : S.sheet?.kind === "browse" ? "browse-list" : S.sheet?.kind === "custom-muscles" ? "custom-priorities" : S.sheet?.kind === "custom-exercises" ? "custom-exercises" : S.sheet?.kind === "shape" ? "custom-shape" : S.notice === "conflict" ? "activation-conflict" : S.overlay === "replace" ? "replace-confirm" : S.route === "custom" ? "custom-result" : S.route === "browse" ? "browse-preview" : S.route === "import" ? "import-preview" : S.route === "shared" ? "shared-preview" : "rec-result");
    if (!S.result) return `<div class="page a-page" data-checkpoint="${cp}">${topbar(t("a.cancel"))}<div class="notice notice--error" role="alert"><strong>${esc(t("entry.error.summary"))}</strong><p>${esc(S.compileError?.code || "")}</p><div class="btnrow"><button type="button" class="btn" data-act="open-sheet" data-kind="custom-exercises">${esc(t("entry.result.change_preferences"))}</button></div></div></div>`;
    const preview = S.result.preview; const a = answers(); const facts = TF.previewFacts(preview);
    const reasons = TS.reasons(t, lang, S.result, a, { custom: S.route === "custom" }).filter((r) => ["goal", "progression"].includes(r.key));
    const adjustments = TS.adjustments(t, preview); const constraints = TS.constraintLines(t, lang, a);
    const issue = TF.progressionIssue(preview); const activeLabel = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("a.res.use");
    const factChips = generated() ? `<p class="t-label">${esc(t("a.res.facts"))}</p><div class="a-facts" aria-label="${esc(t("a.res.facts"))}">${factChip("days", t("a.fact.days", { n: a.daysPerWeek }))}${factChip("where", t(`entry.environment.${a.environment.kind}`))}${factChip("goal", t(`entry.desired_result.${a.desiredResult}.label`))}${factChip("bg", t(`entry.background.consistency.${a.recentConsistency}`))}${factChip("minutes", t("a.fact.minutes", { n: a.sessionMinutes }), S.assumed.has("sessionMinutes"))}${factChip("rest", a.preferredRestSeconds === null ? t("a.fact.rest_auto") : t("a.fact.rest", { v: t(`entry.schedule.rest.${a.preferredRestSeconds}`).toLowerCase() }), S.assumed.has("preferredRestSeconds"))}${S.route === "custom" ? factChip("custom", t("a.fact.custom")) : factChip("priority", (a.primaryMuscles || []).length ? t("a.fact.priority", { list: a.primaryMuscles.map((m) => t(`entry.muscle.${m}`)).join(", ") }) : t("a.fact.priority_none"))}</div>` : `<p class="t-small t-soft">${esc(t(`entry.preview.source.${S.route}`))}</p>`;
    const days = (preview.days || []).map((d, i) => { const ex = d.exercises || []; const sets = ex.reduce((s, e) => s + (+e.sets || 0), 0); return `<section class="a-dayblock"><h3 class="a-dayblock__h"><span class="day__num" aria-hidden="true">${i + 1}</span><span>${esc(TF.dayName(t, d, preview.programStructure, i))}</span><span class="day__meta">${esc(t("entry.preview.sets", { n: sets }))}${d.estimateMinutes ? ` · ${esc(t("entry.preview.minutes", { n: d.estimateMinutes }))}` : ""}</span></h3><div class="a-dayblock__list">${ex.map((e) => generated() ? `<button type="button" class="a-exrow" data-act="open-exercise" data-id="${esc(e.libraryId || "")}" data-slot="${esc(e.id)}"><span class="ex__name">${esc(TS.exName(e, lang))}</span><span class="ex__rx">${e.sets} × ${e.min}–${e.max}</span><span class="chevron" aria-hidden="true"></span></button>` : `<div class="ex"><span class="ex__name">${esc(TS.exName(e, lang))}</span><span class="ex__rx">${e.sets} × ${e.min}–${e.max}</span></div>`).join("")}</div></section>`; }).join("");
    return `<div class="page a-page a-result" data-checkpoint="${cp}">
      ${topbar(t("a.cancel"))}
      ${S.notice === "conflict" ? TS.conflictNotice(t) : ""}
      ${S.notice === "rules_changed" ? TS.rulesNotice(t, { keep: S.route === "import" || S.route === "shared", keepReady: TF.activationIssues(entry()).length === 0 }) : ""}
      ${TF.hasActiveProgram() && S.notice !== "conflict" ? TS.activeNotice(t) : ""}
      <h1 class="t-feature" data-focus>${esc(resultName())}</h1>
      <p class="facts" style="margin:6px 0 12px"><span class="t-data">${esc(t("entry.catalogue.days_badge", { days: (preview.days || []).length }))}</span>${TF.durationLabel(t, preview) ? `<span class="t-data">${esc(TF.durationLabel(t, preview))}</span>` : ""}<span class="t-data">${esc(t("entry.preview.exercises", { n: facts.exercises, exercise: TF.tp(t, facts.exercises, "exercise") }))}</span></p>
      ${S.updated ? `<p class="status-line" role="status" style="color:var(--positive)"><span class="icon-mask icon-mask--check" aria-hidden="true"></span><span>${esc(t("a.res.updated"))}</span></p>` : ""}
      ${factChips}
      ${generated() ? `<p class="t-caption" style="margin:14px 0 6px">${esc(t("a.res.row_hint"))}</p>` : `<p class="t-label section-gap">${esc(t("entry.preview.days"))}</p>`}
      <div class="stack">${days}</div>
      ${generated() ? `<p class="t-label section-gap">${esc(t("a.res.why"))}</p><ul class="a-reasons">${reasons.map((r) => `<li class="fact-row"><span class="icon-mask icon-mask--${r.icon}" aria-hidden="true"></span><span class="fact-row__text">${esc(r.text)}</span></li>`).join("")}</ul>` : `<p class="t-label section-gap">${esc(t("entry.preview.progression"))}</p><p class="t-small t-soft">${esc(t(TF.progressionCopyKey(preview)))}</p>`}
      ${adjustments.length ? `<p class="t-label section-gap">${esc(t("a.res.adjust"))}</p><ul class="a-reasons">${adjustments.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--scale" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul>` : ""}
      ${constraints.length ? `<p class="t-label section-gap">${esc(t("a.res.avoids"))}</p><ul class="a-reasons">${constraints.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--${x.kind === "avoid" ? "shield" : "check"}" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}${x.kind === "avoid" ? ` <button type="button" class="btn btn--link" data-act="avoid-remove" data-id="${esc(x.id)}">${esc(t("a.sheet.ex_restore"))}</button>` : ""}</span></li>`).join("")}</ul>` : ""}
      ${issue ? `<p class="notice notice--error" role="alert" id="entryActivationStatus" tabindex="-1">${esc(t("entry.preview.activation_blocked"))}</p>` : ""}
      ${S.activationIssues ? `<p class="notice notice--error" role="alert">${esc(S.activationIssues.join(", "))}</p>` : ""}
      <div class="pinned a-confirm"><button type="button" class="btn btn--primary" id="entryActivate" data-act="activate"${issue || S.notice === "conflict" ? " disabled" : ""}>${esc(activeLabel)}</button><div class="row" style="margin-top:8px;gap:8px">${generated() ? `<button type="button" class="btn" style="flex:1" data-act="open-sheet" data-kind="more">${esc(t("a.res.diff"))}</button>` : ""}<button type="button" class="btn" style="flex:1" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("a.edit"))}</button></div></div>
      ${sheet()}
      ${S.overlay === "replace" ? TS.replaceSheet(t, TF.device.active?.name || "", resultName(), TF.device.sessions) : S.overlay === "cancel" ? TS.cancelSheet(t) : ""}
    </div>`;
  }
  const factChip = (key, label, assumed) => `<button type="button" class="a-chip${assumed ? " a-chip--assumed" : ""}" data-act="open-sheet" data-kind="fact" data-key="${key}"><span>${esc(label)}</span>${assumed ? `<span class="a-chip__tag">${esc(t("a.res.assumed"))}</span>` : ""}<span class="icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span></button>`;
  function sheet() {
    if (!S.sheet) return "";
    const k = S.sheet.kind; const a = S.answers; let title = "", body = "", apply = true;
    if (k === "fact") {
      const key = S.sheet.key;
      if (key === "days") { title = t("a.sheet.days"); body = `<div class="a-days" role="radiogroup">${TS.DAYS.map((n) => `<button type="button" class="a-day${a.daysPerWeek === n ? " is-selected" : ""}" role="radio" aria-checked="${a.daysPerWeek === n}" data-act="pick" data-key="daysPerWeek" data-val="${n}"><span class="a-day__n">${n}</span><span class="a-day__l">${esc(t("entry.schedule.days.sub"))}</span></button>`).join("")}</div>`; }
      if (key === "where") { title = t("a.sheet.where"); body = `<div class="stack stack--tight" role="radiogroup">${TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment?.kind === v, icon: TS.ENV_ICON[v], cls: "choice--compact" })).join("")}</div>${TS.environmentCorrection(t, a.environment, { open: S.envOpen })}`; }
      if (key === "goal") { title = t("a.sheet.goal"); body = `<div class="stack stack--tight" role="radiogroup">${TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v })).join("")}</div>`; }
      if (key === "bg") { title = t("a.sheet.bg"); body = `<p class="t-label" id="sExp">${esc(t("entry.background.experience.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="sExp">${TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "choice--compact" })).join("")}</div><p class="t-label" id="sCon" style="margin-top:12px">${esc(t("entry.background.consistency.label"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="sCon">${TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`; }
      if (key === "minutes") { title = t("a.sheet.minutes"); body = `<div class="grid-3" role="radiogroup">${TS.MINUTES.map((n) => TS.choice({ key: "sessionMinutes", val: n, title: n === 90 ? "90+" : String(n), cap: "min", selected: a.sessionMinutes === n, cls: "choice--seg" })).join("")}</div>`; }
      if (key === "rest") { title = t("a.sheet.rest"); body = `<div class="stack stack--tight" role="radiogroup">${TS.REST.map((v) => TS.choice({ key: "preferredRestSeconds", val: v, title: v === "auto" ? t("entry.schedule.rest.auto") : t(`entry.schedule.rest.${v}`), selected: v === "auto" ? a.preferredRestSeconds === null : a.preferredRestSeconds === v, cls: "choice--compact" })).join("")}</div>`; }
      if (key === "priority") { title = t("a.sheet.priority"); const prim = a.primaryMuscles || []; body = `<p class="t-small t-soft">${esc(t("a.sheet.priority_lede"))}</p><div class="grid-2" role="group" style="margin-top:8px">${TS.MUSCLES.map((m) => TS.choice({ key: "primaryMuscles", val: m, title: t(`entry.muscle.${m}`), selected: prim.includes(m), role: "checkbox", cls: "choice--compact", disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div><p class="t-label" style="margin-top:12px">${esc(t("entry.priorities.movements"))}</p><div class="grid-2" role="group">${TS.MOVEMENTS.map((m) => TS.choice({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (a.priorityMovements || []).includes(m), role: "checkbox", cls: "choice--compact" })).join("")}</div>`; }
      if (key === "custom") { title = t("a.more.custom"); body = `<div class="stack stack--tight"><button type="button" class="a-door" data-act="open-sheet" data-kind="custom-muscles"><span class="icon-mask icon-mask--sliders" aria-hidden="true"></span><span class="a-door__body"><span class="a-door__title">${esc(t("a.custom.muscles"))}</span></span><span class="chevron" aria-hidden="true"></span></button><button type="button" class="a-door" data-act="open-sheet" data-kind="custom-exercises"><span class="icon-mask icon-mask--dumbbell" aria-hidden="true"></span><span class="a-door__body"><span class="a-door__title">${esc(t("a.custom.exercises"))}</span></span><span class="chevron" aria-hidden="true"></span></button></div>`; apply = false; }
    }
    if (k === "exercise") {
      const e = TF.libraryEntry(S.sheet.id); const name = e ? TF.libraryName(e, lang) : S.sheet.id; const existing = (a.exerciseConstraints || []).find((c) => c.exerciseId === S.sheet.id);
      title = name; apply = false;
      body = `<p class="t-subtitle">${esc(t("a.sheet.ex_avoid"))}</p><p class="t-small t-soft">${esc(t("a.sheet.ex_lede"))}</p><p class="t-label" style="margin-top:10px">${esc(t("entry.priorities.avoid_reason", { exercise: name }))}</p><div class="row" style="flex-wrap:wrap;gap:8px" role="radiogroup">${TS.REASONS.map((r) => TS.chip({ key: "avoidReason", val: `${S.sheet.id}|${r}`, label: t(`entry.priorities.reason.${r}`), selected: existing?.reason === r, role: "radio" })).join("")}</div>${existing?.reason === "pain" || S.sheet.reason === "pain" ? `<p class="status-line" role="note" style="margin-top:10px"><span class="icon-mask icon-mask--shield" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}<div class="stack stack--tight" style="margin-top:14px"><button type="button" class="btn btn--primary btn--noarrow" data-act="exercise-apply"${existing ? "" : " disabled"}>${esc(t("a.sheet.apply"))}</button><button type="button" class="btn btn--quiet" data-act="sheet-close">${esc(t("a.sheet.ex_keep"))}</button></div>`;
    }
    if (k === "more") {
      title = t("a.res.diff"); apply = false;
      const door = (act, icon, ttl, cap, extra = "") => `<button type="button" class="a-door" data-act="${act}" ${extra}><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="a-door__body"><span class="a-door__title">${esc(ttl)}</span><span class="a-door__cap">${esc(cap)}</span></span><span class="chevron" aria-hidden="true"></span></button>`;
      body = `<div class="stack stack--tight">${door("open-sheet", "search", t("a.more.browse", { n: a.daysPerWeek }), t("a.more.browse_cap"), 'data-kind="browse"')}${door("open-sheet", "sliders", t("a.more.custom"), t("a.more.custom_cap"), 'data-kind="fact" data-key="custom"')}${door("build-open", "pencil", t("a.more.build"), t("a.more.build_cap"))}${door("bring", "clipboard", t("a.more.bring"), t("a.more.bring_cap"))}</div>`;
    }
    if (k === "browse") {
      title = t("a.browse.title"); apply = false;
      const cards = TF.browseCards({ daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, environment: a.environment });
      const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
      const card = (c) => { const name = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; return `<button type="button" class="a-door" data-act="catalogue" data-id="${esc(c.id)}" aria-label="${esc(t("entry.catalogue.review_aria", { name }))}"><span class="a-door__body"><span class="a-door__title">${esc(name)} · <span class="t-data">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span class="a-door__cap">${esc(t(`entry.catalogue.purpose.${c.purpose}`))} · ${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))} · ${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k2) => t(`entry.equip.${k2}`, undefined, k2)).join(", ") }))}</span></span><span class="chevron" aria-hidden="true"></span></button>`; };
      body = `<p class="t-small t-soft">${esc(t("a.browse.for", { days: a.daysPerWeek, minutes: a.sessionMinutes, env: t(`entry.environment.${a.environment.kind}`).toLowerCase() }))} <button type="button" class="btn btn--link" data-act="open-sheet" data-kind="fact" data-key="days" style="padding:0 4px">${esc(t("x.change"))}</button></p><div class="stack stack--tight" style="margin-top:8px">${fits.map(card).join("")}</div>${others.length ? `<details class="disclosure disclosure--plain" style="margin-top:8px"><summary>${esc(t("entry.catalogue.group_other"))} (${others.length})</summary><div class="stack stack--tight" style="padding-top:8px">${others.map(card).join("")}</div></details>` : ""}`;
    }
    if (k === "custom-muscles") { title = t("a.custom.muscles"); body = `<p class="t-small t-soft">${esc(t("entry.priorities.state_hint"))}</p><div style="margin-top:8px">${TS.muscleEmphasis(t, a)}</div>`; }
    if (k === "custom-exercises") { title = t("a.custom.exercises"); body = TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] }); }
    if (k === "shape") { title = t("a.custom.shape"); const sp = TF.splitChoices(answers()); body = sp.choices.length === 1 ? `<p class="t-small t-soft">${esc(t("a.custom.shape_only"))}</p><div class="stack" style="margin-top:8px">${TS.choice({ key: "splitPreference", val: sp.choices[0].id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? sp.choices[0].namePt || sp.choices[0].name : sp.choices[0].name, days: sp.choices[0].frequency }), cap: t("entry.custom_shape.default_reason"), selected: true })}</div>` : `<div class="stack" role="radiogroup">${sp.choices.map((c) => TS.choice({ key: "splitPreference", val: c.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }), cap: t(c.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason"), selected: a.splitPreference === c.id })).join("")}</div>`; }
    const pending = S.pref.pending;
    return `<div class="sheet-scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"><span class="sheet__grab" aria-hidden="true"></span><div class="row row--between"><h2 class="t-section" id="sheetTitle" data-focus>${esc(title)}</h2><button type="button" class="btn btn--quiet" data-act="sheet-close" aria-label="${esc(t("a.sheet.close"))}"><span class="icon-mask icon-mask--close" aria-hidden="true"></span></button></div><div style="margin-top:10px">${body}</div>${apply ? `<div class="stack stack--tight" style="margin-top:14px"><button type="button" class="btn btn--primary btn--noarrow" data-act="sheet-apply"${pending ? " disabled" : ""}>${esc(t("a.sheet.apply"))}</button></div>` : ""}</div>`;
  }
  function buildView() {
    if (S.buildStep === "setup") return `<div class="page a-page" data-checkpoint="build-setup">${topbar(t("a.cancel"))}${heading(t("a.build.title"), t("a.build.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="aName" type="text" maxlength="80" data-field="programName" value="${esc(S.answers.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label><p class="t-label section-gap">${esc(t("entry.build_setup.days"))}</p><div class="a-days" role="radiogroup">${TS.DAYS.map((n) => `<button type="button" class="a-day${S.answers.daysPerWeek === n ? " is-selected" : ""}" role="radio" aria-checked="${S.answers.daysPerWeek === n}" data-act="pick" data-key="daysPerWeek" data-val="${n}"><span class="a-day__n">${n}</span><span class="a-day__l">${esc(t("entry.schedule.days.sub"))}</span></button>`).join("")}</div><footer class="pinned a-nav"><button type="button" class="btn btn--primary" data-act="build-start"${S.answers.programName && S.answers.daysPerWeek ? "" : " disabled"}>${esc(t("a.build.open"))}</button></footer></div>`;
    const b = S.build; const issues = TS.build.issues(b, t); const ready = !issues.length;
    const cp = S.editing ? "activate" : ready ? "build-ready" : b.days.some((d) => d.exercises.length) ? "build-partial" : "build-empty";
    return `<div class="page a-page" data-checkpoint="${cp}">${topbar(t("a.cancel"))}${heading(S.editing ? t("a.edit") : b.name || t("a.build.title"))}<p class="status-line" role="status" aria-live="polite" id="editorStatus" style="margin:6px 0 12px;color:${ready ? "var(--positive)" : "var(--danger)"}"><span class="icon-mask icon-mask--${ready ? "check" : "alert"}" aria-hidden="true"></span><span>${esc(ready ? t("entry.editor.ready") : issues.join(" "))}</span></p>${TS.build.editor(t, lang, b)}<div class="pinned a-confirm"><button type="button" class="btn btn--primary" id="entryEditorActivate" data-act="activate"${ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("entry.editor.use"))}</button>${S.editing ? `<button type="button" class="btn" style="margin-top:8px" data-act="edit-done">${esc(t("a.edit_done"))}</button>` : ""}</div>${S.overlay === "replace" ? TS.replaceSheet(t, TF.device.active?.name || "", b.name, TF.device.sessions) : S.overlay === "cancel" ? TS.cancelSheet(t) : ""}</div>`;
  }
  function importView() {
    if (S.importDraft) { const d = S.importDraft; const c = TF.importCounts(d); return `<div class="page a-page" data-checkpoint="import-review">${topbar(t("a.cancel"))}${heading(t("a.import.review"), t("a.import.review_lede"))}<p class="t-caption">${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</p>${d.notImported.length ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}${TS.importReview.counts(t, d)}<div style="margin-top:12px">${TS.importReview.rows(t, lang, d, { picker: S.picker })}</div>${d.originalText ? `<details class="disclosure disclosure--plain"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="t-caption" style="white-space:pre-wrap">${esc(d.originalText)}</pre></details>` : ""}<p class="t-caption" style="margin-top:10px">${esc(t("import.safe"))}</p><div class="pinned a-confirm"><button type="button" class="btn btn--primary" id="importCommit" data-act="import-commit"${c.review ? " disabled" : ""}>${esc(c.review ? t("import.commit_blocked", { n: c.review }) : t("entry.preview.review"))}</button></div></div>`; }
    const ff = S.ff;
    if (S.importMode === "freeform") { const cp = ff.status === "gaps" ? (ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps") : ff.status === "unreadable" ? "ff-unreadable" : ff.stage === 3 ? "ff-reply" : ff.stage === 2 ? "ff-handoff" : TS.freeform.program(ff) ? "ff-filled" : "ff-empty"; return `<div class="page a-page" data-checkpoint="${cp}">${topbar(t("a.cancel"))}${heading(ff.status === "gaps" ? t("entry.freeform.gaps_title") : t("entry.freeform.title"), ff.status === "gaps" ? t("entry.freeform.gaps_lede") : t("entry.freeform.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}${TS.freeform.body(t, lang, ff)}<div class="row" style="justify-content:center;margin-top:16px"><button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="file">${esc(t("entry.freeform.to_file"))}</button></div>${S.overlay === "cancel" ? TS.cancelSheet(t) : ""}</div>`; }
    return `<div class="page a-page" data-checkpoint="import-source">${topbar(t("a.cancel"))}${heading(t("a.import.title"), t("entry.import_source.lede"))}${TF.hasActiveProgram() ? TS.activeNotice(t) : ""}<button type="button" class="btn btn--primary" id="entryImportPick" data-act="import-file">${esc(t("a.import.file"))}</button><div class="row" style="justify-content:center;margin-top:12px"><button type="button" class="btn btn--quiet" data-act="import-mode" data-mode="freeform">${esc(t("entry.import_source.to_freeform"))}</button></div></div>`;
  }
  function render(focus) {
    const saved = document.activeElement && document.activeElement.id;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (["landing", "shared-gate", "shared-invalid"].includes(S.view)) html = landing();
    else if (S.view === "ask") html = ask();
    else if (S.view === "result") html = result();
    else if (S.view === "build") html = buildView();
    else if (S.view === "import") html = importView();
    root.innerHTML = html;
    if (saved && /Search|ffIn|ffOut|aName|pickerSearch/.test(saved)) TS.refocus(root, saved); else if (focus) TS.focusHeading(root);
  }

  /* ---------- actions ---------- */
  function on(act, d) {
    S.cpTag = null; S.updated = false;
    if (act === "start") { S.view = "ask"; S.q = 0; render(true); return; }
    if (act === "bring") { S.sheet = { kind: "bring" }; if (S.view !== "landing") S.view = "landing"; render(true); return; }
    if (act === "how-toggle") { S.how = !S.how; return; }
    if (act === "sheet-close") { S.sheet = null; S.pref.pending = null; render(); return; }
    if (act === "shared-start") { S.route = "shared"; S.mode = "shared"; S.result = { fingerprint: "shared", name: S.shared.program.meta.name, selected: { id: "shared", source: "shared" }, preview: TF.sharedPreview(S.shared) }; S.view = "result"; render(true); return; }
    if (act === "pick") {
      if (d.key === "avoidReason") { const [id, reason] = d.val.split("|"); S.answers = TS.applyPick(S.answers, "avoidReason", d.val); if (S.sheet?.kind === "exercise") S.sheet.reason = reason; S.pref.pending = null; render(); return; }
      S.answers = TS.applyPick(S.answers, d.key, d.val);
      if (d.key === "sessionMinutes" || d.key === "preferredRestSeconds") S.assumed.delete(d.key);
      if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
      if (S.view === "ask" || S.view === "build") { render(); return; }
      render(); return;
    }
    if (act === "q-next") { if (S.q < QUESTIONS.length - 1) { S.q++; S.envOpen = false; render(true); return; } S.mode = "recommend"; compileNow(); S.view = "result"; render(true); return; }
    if (act === "q-back") { if (S.q > 0) { S.q--; render(true); } return; }
    if (act === "cancel") { if (S.view === "result" && S.route === "shared") { S.view = "shared-gate"; render(true); return; } S.overlay = "cancel"; render(); return; }
    if (act === "cancel-continue") { S.overlay = null; render(); return; }
    if (act === "cancel-keep") { S.overlay = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; S.notice = null; render(true); return; }
    if (act === "cancel-discard") { fresh(TF.hasActiveProgram() ? "existing" : "fresh"); S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return; }
    if (act === "open-sheet") { if (d.kind === "custom-muscles" || d.kind === "custom-exercises") S.mode = "custom"; S.sheet = { kind: d.kind, key: d.key }; render(); const h = root.querySelector("#sheetTitle"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch {} } return; }
    if (act === "sheet-apply") { const k = S.sheet?.kind; S.sheet = null; if (k === "custom-muscles") { S.mode = "custom"; const sp = TF.splitChoices(answers()); if (sp.choices.length > 1) { S.sheet = { kind: "shape" }; compileNow(); render(); return; } } compileNow(); S.updated = true; render(true); return; }
    if (act === "open-exercise") { if (!d.id) return; const existing = (S.answers.exerciseConstraints || []).find((c) => c.exerciseId === d.id); S.sheet = { kind: "exercise", id: d.id, reason: existing?.reason || null }; render(); return; }
    if (act === "exercise-apply") { S.sheet = null; compileNow(); S.updated = true; render(true); return; }
    if (act === "avoid-remove") { S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); if (S.pref.pending === d.id) S.pref.pending = null; if (S.view === "result") { compileNow(); S.updated = true; } render(true); return; }
    if (act === "pref-add") { if (d.status === "include") S.answers.mustHaveExercises = [...(S.answers.mustHaveExercises || []), d.id]; else S.pref.pending = d.id; S.pref.query = ""; render(); return; }
    if (act === "pref-remove") { S.answers.mustHaveExercises = (S.answers.mustHaveExercises || []).filter((x) => x !== d.id); S.answers.exerciseConstraints = (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); render(); return; }
    if (act === "field:prefQuery") { S.pref.query = d.value; render(); return; }
    if (act === "catalogue") { const card = TF.browseCards(answers()).find((c) => c.id === d.id); if (!card) return; S.answers.catalogueSelection = card.id; S.result = { fingerprint: card.fingerprint, name: card.name, namePt: card.namePt, selected: { id: card.id, familyId: card.familyId, daysPerWeek: card.daysPerWeek, blueprintId: card.id }, preview: card.preview }; S.route = "browse"; S.sheet = null; S.view = "result"; render(true); return; }
    if (act === "build-open") { S.sheet = null; S.view = "build"; S.buildStep = "setup"; S.route = "build"; S.answers.programName = S.answers.programName || ""; render(true); return; }
    if (act === "field:programName") { S.answers.programName = d.value.trim(); const b = root.querySelector('[data-act="build-start"]'); if (b) b.disabled = !(S.answers.programName && S.answers.daysPerWeek); return; }
    if (act === "build-start") { S.build = TS.build.create(S.answers.programName, S.answers.daysPerWeek); S.buildStep = "editor"; S.route = "build"; render(true); return; }
    if (act === "field:buildName") { S.build = TS.build.apply(S.build, "name", d.value); return; }
    if (act === "field:dayName") { S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return; }
    if (act === "field:rx" || act === "change:rx") { S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return; }
    if (act === "field:pickerQuery") { if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return; }
    if (act === "build") { S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(); return; }
    if (act === "pick-exercise") { if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return; }
    if (act === "import-open") { S.sheet = null; S.view = "import"; S.route = "import"; S.importMode = d.mode; S.importDraft = null; S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-mode") { S.importMode = d.mode; S.importDraft = null; if (d.mode === "file") S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-file") { S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("a.file_picked"), "file"); render(true); return; }
    if (act === "imp") { if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return; }
    if (act === "import-commit") { const preview = TF.importPreview(S.importDraft, t); S.result = { fingerprint: "import", name: preview.name, selected: { id: "import", source: "import" }, preview }; S.route = "import"; S.importDraft = null; S.view = "result"; render(true); return; }
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
    if (act === "conflict-review") { S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return; }
    if (act === "rules-rebuild") { S.notice = null; S.draft = null; if (S.view === "result") compileNow(); render(true); return; }
    if (act === "rules-keep") { S.pinned = true; S.notice = null; render(); return; }
    if (act === "resume") { const st = S.draft.state; S.answers = { ...S.answers, ...st.answers }; S.notice = null; S.revAtStart = st.activeProgramRevisionAtStart; S.view = "ask"; S.q = QUESTIONS.findIndex((q) => !qAnswered(q)); if (S.q < 0) S.q = QUESTIONS.length - 1; render(true); return; }
    if (act === "resume-restart") { S.draft = null; S.notice = null; render(true); return; }
    if (act === "edit") { S.build = TS.build.create(resultName(), (S.result.preview.days || []).length); S.build.days = (S.result.preview.days || []).map((dd) => ({ dayId: dd.dayId || dd.label, label: TF.dayName(t, dd, S.result.preview.programStructure), exercises: (dd.exercises || []).map((e) => ({ id: e.id, libraryId: e.libraryId, name: e.name, sets: e.sets, min: e.min, max: e.max, primary: TF.libraryEntry(e.libraryId)?.primary })) })); S.editing = true; S.buildStep = "editor"; S.view = "build"; render(true); return; }
    if (act === "edit-done") { S.result = { ...S.result, preview: { ...TS.build.preview(S.build, t), source: S.result.preview.source }, name: S.build.name || S.result.name }; S.editing = false; S.view = "result"; render(true); return; }
  }
  function afterFreeform() {
    if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported, originalText: S.ff.input }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); render(true); return; }
    render(true);
  }

  /* ---------- reach ---------- */
  const U = () => TF.F.users;
  function rafaelInto() { const u = U().rafael.answers; Object.assign(S.answers, { desiredResult: u.desiredResult, structuredExperience: u.structuredExperience, recentConsistency: u.recentConsistency, daysPerWeek: u.daysPerWeek, environment: TF.env(u.environmentKind) }); S.answers.sessionMinutes = u.sessionMinutes; S.answers.preferredRestSeconds = u.preferredRestSeconds; S.assumed = new Set(["sessionMinutes", "preferredRestSeconds"]); }
  function customInto() { const u = U().custom.answers; Object.assign(S.answers, { desiredResult: u.desiredResult, structuredExperience: u.structuredExperience, recentConsistency: u.recentConsistency, daysPerWeek: u.daysPerWeek, sessionMinutes: u.sessionMinutes, preferredRestSeconds: u.preferredRestSeconds, environment: TF.env(u.environmentKind), primaryMuscles: [...u.primaryMuscles], deEmphasizedMuscles: [...u.deEmphasizedMuscles], mustHaveExercises: [...u.mustHaveExercises], exerciseConstraints: u.exerciseConstraints.map((c) => ({ ...c })) }); S.assumed = new Set(["preferredRestSeconds"]); }
  function correctionInto() { const c = U().rafael.correction; S.answers.environment = TF.env(c.environmentKind); S.answers.environment.equipment = [...new Set([...S.answers.environment.equipment, ...c.equipmentAdd])]; S.answers.environment.capabilities = [...new Set([...S.answers.environment.capabilities, ...c.capabilitiesAdd])]; }
  async function reach(cp) {
    switch (cp) {
      case "landing": break;
      case "route-choice": S.sheet = { kind: "bring" }; break;
      case "route-help": S.how = true; break;
      case "rec-schedule": S.view = "ask"; S.q = 0; break;
      case "rec-environment": S.view = "ask"; S.q = 1; S.answers.daysPerWeek = 3; S.answers.environment = TF.env("commercial_gym"); break;
      case "rec-goal": S.view = "ask"; S.q = 2; S.answers.daysPerWeek = 3; S.answers.environment = TF.env("commercial_gym"); break;
      case "rec-background": S.view = "ask"; S.q = 3; S.answers.daysPerWeek = 3; S.answers.environment = TF.env("commercial_gym"); S.answers.desiredResult = "muscle_growth"; break;
      case "rec-priorities": rafaelInto(); compileNow(); S.view = "result"; S.sheet = { kind: "fact", key: "priority" }; break;
      case "rec-result": rafaelInto(); compileNow(); S.view = "result"; break;
      case "rec-env-correction": S.view = "ask"; S.q = 1; S.answers.daysPerWeek = 3; correctionInto(); S.envOpen = true; break;
      case "rec-result-corrected": rafaelInto(); correctionInto(); compileNow(); S.view = "result"; S.cpTag = "rec-result-corrected"; break;
      case "rec-avoid-pain": rafaelInto(); S.answers.primaryMuscles = [...U().rafael.pain.primaryMuscles]; compileNow(); S.view = "result"; S.answers.exerciseConstraints = [{ exerciseId: U().rafael.pain.exerciseId, reason: "pain" }]; S.sheet = { kind: "exercise", id: U().rafael.pain.exerciseId, reason: "pain" }; break;
      case "rec-result-avoided": rafaelInto(); S.answers.primaryMuscles = [...U().rafael.pain.primaryMuscles]; S.answers.exerciseConstraints = [{ exerciseId: U().rafael.pain.exerciseId, reason: "pain" }]; compileNow(); S.view = "result"; S.cpTag = "rec-result-avoided"; S.updated = true; break;
      case "browse-filters": rafaelInto(); S.answers.daysPerWeek = 4; compileNow(); S.view = "result"; S.sheet = { kind: "more" }; break;
      case "browse-list": rafaelInto(); S.answers.daysPerWeek = 4; compileNow(); S.view = "result"; S.sheet = { kind: "browse" }; break;
      case "browse-preview": rafaelInto(); S.answers.daysPerWeek = 4; compileNow(); S.view = "result"; render(); on("catalogue", { id: "balanced_4_v1" }); return;
      case "custom-priorities": customInto(); S.mode = "custom"; compileNow(); S.view = "result"; S.sheet = { kind: "custom-muscles" }; break;
      case "custom-exercises": customInto(); S.mode = "custom"; compileNow(); S.view = "result"; S.sheet = { kind: "custom-exercises" }; break;
      case "custom-shape": customInto(); S.mode = "custom"; compileNow(); S.view = "result"; S.sheet = { kind: "shape" }; break;
      case "custom-result": customInto(); S.mode = "custom"; compileNow(); S.view = "result"; break;
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
      case "import-review": S.view = "import"; S.route = "import"; S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("a.file_picked"), "file"); break;
      case "import-preview": { S.view = "import"; S.route = "import"; S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("a.file_picked"), "file"); for (const r of S.importDraft.rows) if (!r.reviewed) S.importDraft = TS.importReview.apply(S.importDraft, r.shortlist.length ? "pick" : "raw", r.key, 0); render(); on("import-commit", {}); return; }
      case "shared-gate": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; break; }
      case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.payload; S.view = "shared-gate"; render(); on("shared-start", {}); return; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "hub-existing": S.view = "ask"; S.q = 0; break;
      case "replace-confirm": rafaelInto(); compileNow(); S.view = "result"; S.overlay = "replace"; break;
      case "activation-conflict": rafaelInto(); compileNow(); S.view = "result"; TF.device.revision += 1; TF.device.active.name = lang === "pt" ? "Programa mais novo" : "Newer active program"; render(); activateNow(); return;
      case "resume": S.draft = TS.seeds.interruptedDraft(lang); S.notice = "resume"; S.view = "landing"; break;
      case "rules-changed": { S.draft = TS.seeds.rulesDriftDraft(); S.answers = { ...S.answers, ...S.draft.state.answers }; S.notice = "rules_changed"; S.view = "ask"; S.q = 0; S.cpTag = "rules-changed"; break; }
      case "cancel-confirm": S.view = "ask"; S.q = 1; S.answers.daysPerWeek = 3; S.overlay = "cancel"; break;
      case "activate": rafaelInto(); compileNow(); S.view = "result"; S.cpTag = "activate"; break;
      case "activated-today": rafaelInto(); compileNow(); S.view = "result"; render(); activateNow(); return;
      default: break;
    }
    render(true);
  }
  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.a = {
    id: "a", name: "A · Uma pergunta",
    async mount(c) { ctx = c; lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); TS.wire(root, on); render(); },
    reach, state: () => S,
  };
})();
