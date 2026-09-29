/* Round 4 candidate I · Ficha.
   Setup is the lifter's own printed training card: every answer is written
   onto it in the lifter's pen as it is chosen, the review is the completed
   card, and activation date-stamps it and hands it to Today. The only hand
   on the card is the lifter's; everything Taurifer contributes is printed.
   Product policy: no product decision reopened (PD-1 to PD-4 stay closed;
   minutes and rest are asked; no program before the answers).
   Engine truth: every program comes from TF (compile, importResult,
   sharedResult, activate, readiness); the paste door, gap repair and import
   review run through TS.freeform.apply and TS.importReview.apply with this
   candidate's own markup. The state machine follows the Round 3 reference
   contract; the views, components and motion are this world's own. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "i.name": "I · Ficha",
      "i.land.f.goal": "Objetivo", "i.land.f.days": "Dias por semana", "i.land.f.length": "Duração", "i.land.f.rest": "Descanso", "i.land.f.where": "Onde treina",
      "i.grid.exercise": "Exercício", "i.grid.sets": "Séries", "i.grid.reps": "Reps", "i.grid.load": "Carga",
      "i.land.blank": "Um programa em branco, com os campos objetivo, dias por semana, duração, descanso e local, e uma tabela de exercícios, séries, repetições e carga ainda vazia.",
      "i.land.proof": "Quando o programa fica pronto, a tela Hoje mostra a sessão do dia.",
      "i.hub.lede_first": "Cada caminho preenche o programa de um jeito. Responder à primeira pergunta já começa a recomendação.",
      "i.hub.lede_existing": "Escolha como montar o próximo programa. O atual continua ativo até você confirmar a troca.",
      "i.hub.do": "Você faz", "i.hub.get": "Você recebe",
      "i.get.recommend": "Um programa completo e editável. O Taurifer escolhe a estrutura.",
      "i.get.custom": "Você escolhe ênfase e exercícios. O Taurifer monta o programa.",
      "i.hub.current": "Programa atual",
      "i.hub.current_facts": "{days} dias por semana · {n} sessões registradas",
      "i.help.toggle": "Não sabe qual escolher?",
      "i.help.q1": "Você já tem um programa que quer seguir?", "i.help.q1.yes": "Sim, já tenho", "i.help.q1.no": "Não, preciso de um",
      "i.help.q2_no": "O que você prefere?", "i.help.q2.recommend": "Que o Taurifer decida por mim", "i.help.q2.custom": "Escolher músculos e exercícios", "i.help.q2.browse": "Escolher entre programas prontos",
      "i.help.q2_yes": "Como você quer trazê-lo?", "i.help.q2.import": "Colar o texto ou importar um arquivo", "i.help.q2.build": "Digitar cada exercício",
      "i.help.go": "Seguir com {route}",
      "i.resume.at": "{route} · {step} · salvo em {when}",
      "i.resume.discard_title": "Descartar a configuração salva?",
      "i.resume.discard_body": "As respostas salvas neste dispositivo serão apagadas. O que já está ativo não muda.",
      "i.resume.discard_confirm": "Descartar e começar de novo",
      "i.resume.discard_cancel": "Manter a configuração salva",
      "i.rail": "Suas respostas",
      "i.field.goal": "Objetivo", "i.field.background": "Histórico", "i.field.schedule": "Semana", "i.field.environment": "Local", "i.field.priorities": "Prioridades",
      "i.field.emphasis": "Ênfase", "i.field.exercises": "Exercícios", "i.field.shape": "Estrutura",
      "i.field.edit": "Alterar {what}: {value}",
      "i.field.blank": "em branco",
      "i.field.here": "preenchendo agora",
      "i.v.goal.muscle_growth": "Ganho de massa", "i.v.goal.balanced": "Massa e força", "i.v.goal.strength": "Força",
      "i.v.cons.most": "fez a maior parte", "i.v.cons.about_half": "fez cerca de metade", "i.v.cons.few": "fez poucas sessões", "i.v.cons.none": "sem treino recente",
      "i.v.days": "{n} dias", "i.v.minutes": "até {n} min", "i.v.minutes_90": "90 min ou mais",
      "i.v.rest.auto": "o Taurifer escolhe", "i.v.rest.60": "60 s", "i.v.rest.90": "90 s", "i.v.rest.120": "2 min", "i.v.rest.180": "3 min ou mais",
      "i.v.schedule": "{days} · {minutes} · descanso {rest}",
      "i.v.env_adjusted": "{env}, com ajustes",
      "i.v.none": "nenhuma", "i.v.prefs_none": "sem preferências",
      "i.chip.goal": "Objetivo", "i.chip.exp": "Tempo com programas", "i.chip.cons": "Últimas 6 semanas", "i.chip.days": "Dias por semana", "i.chip.minutes": "Duração", "i.chip.rest": "Descanso",
      "i.chip.env": "Onde você treina", "i.chip.prio": "Prioridades", "i.chip.avoid": "Evitar", "i.chip.emph": "Ênfase muscular", "i.chip.prefs": "Exercícios", "i.chip.shape": "Estrutura",
      "i.rev.fields_hint": "Toque em uma resposta para corrigir. O programa é refeito aqui mesmo.",
      "i.rev.adjusted": "O que o Taurifer ajustou",
      "i.rev.constraints": "Suas restrições",
      "i.rev.restore": "Restaurar", "i.rev.restore_aria": "Restaurar {exercise}",
      "i.rev.more": "Mais opções",
      "i.rev.new": "novo",
      "i.rev.error_title": "Não foi possível montar o programa",
      "i.rev.source": "Origem: {source}",
      "i.grid.load_note": "A coluna de carga fica em branco: você registra a carga no primeiro treino e o Taurifer indica a próxima.",
      "i.grid.day_meta": "{ex} · {sets}",
      "i.edit.apply": "Atualizar programa",
      "i.edit.keep": "Manter como estava",
      "i.change.answer": "Resposta corrigida.", "i.change.answers": "Respostas alteradas.", "i.change.restore": "Restrição removida.", "i.change.constraints": "Restrições aplicadas.", "i.change.edit": "Edição aplicada.",
      "i.change.before": "Antes", "i.change.after": "Agora", "i.change.without": "Sem evitar", "i.change.with": "Evitando",
      "i.change.facts": "{ex} · {sets}",
      "i.q.missing": "Marque uma opção.",
      "i.q.priorities_lede": "Sem escolhas aqui, o Taurifer monta o programa só com as respostas anteriores.",
      "i.q.skip": "Pular esta seção",
      "i.q.show": "Mostrar meu programa",
      "i.q.none_limit": "Você já marcou dois músculos. Desmarque um para trocar.",
      "i.unit.min": "min",
      "i.stamp.active": "Ativo",
      "i.stamp.aria": "Carimbo: ativo desde {date}",
      "i.edit.lede": "Remova exercícios ou ajuste séries e repetições. As mudanças valem só para este programa ainda não usado.",
      "i.edit.done": "Voltar ao programa",
      "i.build.days_caption": "{n} dias de treino",
      "i.import.write_own": "Prefiro escrever do zero",
      "i.import.file_name": "Treino do Rafael.json",
      "i.ff.gaps_title": "Complete o que falta",
      "i.ff.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições. Escreva os números que faltam.",
      "i.ff.or": "ou",
      "i.catalogue.change_aria": "Alterar dias, tempo e local",
      "i.gate.what": "O que chega",
      "i.cancel_keep": "Salvar rascunho e sair",
    },
    en: {
      "i.name": "I · Card",
      "i.land.f.goal": "Goal", "i.land.f.days": "Days per week", "i.land.f.length": "Length", "i.land.f.rest": "Rest", "i.land.f.where": "Where",
      "i.grid.exercise": "Exercise", "i.grid.sets": "Sets", "i.grid.reps": "Reps", "i.grid.load": "Load",
      "i.land.blank": "A blank program, with goal, days per week, length, rest and place fields, and an empty table of exercises, sets, reps and load.",
      "i.land.proof": "Once the program is ready, the Today screen shows the day's session.",
      "i.hub.lede_first": "Each way fills in the program differently. Answering the first question starts the recommendation.",
      "i.hub.lede_existing": "Choose how to set up your next program. The current one stays active until you confirm the switch.",
      "i.hub.do": "You do", "i.hub.get": "You get",
      "i.get.recommend": "A complete, editable program. Taurifer chooses the structure.",
      "i.get.custom": "You choose emphasis and exercises. Taurifer writes the program.",
      "i.hub.current": "Current program",
      "i.hub.current_facts": "{days} days a week · {n} logged sessions",
      "i.help.toggle": "Not sure which one?",
      "i.help.q1": "Do you already have a program you want to follow?", "i.help.q1.yes": "Yes, I have one", "i.help.q1.no": "No, I need one",
      "i.help.q2_no": "What would you rather do?", "i.help.q2.recommend": "Let Taurifer decide for me", "i.help.q2.custom": "Choose muscles and exercises", "i.help.q2.browse": "Pick from ready-made programs",
      "i.help.q2_yes": "How do you want to bring it in?", "i.help.q2.import": "Paste the text or import a file", "i.help.q2.build": "Type each exercise",
      "i.help.go": "Continue with {route}",
      "i.resume.at": "{route} · {step} · saved {when}",
      "i.resume.discard_title": "Discard the saved setup?",
      "i.resume.discard_body": "The answers kept on this device will be deleted. Nothing that is already active changes.",
      "i.resume.discard_confirm": "Discard and start over",
      "i.resume.discard_cancel": "Keep the saved setup",
      "i.rail": "Your answers",
      "i.field.goal": "Goal", "i.field.background": "Background", "i.field.schedule": "Week", "i.field.environment": "Place", "i.field.priorities": "Priorities",
      "i.field.emphasis": "Emphasis", "i.field.exercises": "Exercises", "i.field.shape": "Structure",
      "i.field.edit": "Change {what}: {value}",
      "i.field.blank": "blank",
      "i.field.here": "filling in now",
      "i.v.goal.muscle_growth": "Muscle growth", "i.v.goal.balanced": "Muscle and strength", "i.v.goal.strength": "Strength",
      "i.v.cons.most": "did most sessions", "i.v.cons.about_half": "did about half", "i.v.cons.few": "did a few sessions", "i.v.cons.none": "no recent training",
      "i.v.days": "{n} days", "i.v.minutes": "up to {n} min", "i.v.minutes_90": "90 min or more",
      "i.v.rest.auto": "Taurifer chooses", "i.v.rest.60": "60 s", "i.v.rest.90": "90 s", "i.v.rest.120": "2 min", "i.v.rest.180": "3 min or more",
      "i.v.schedule": "{days} · {minutes} · rest {rest}",
      "i.v.env_adjusted": "{env}, adjusted",
      "i.v.none": "none", "i.v.prefs_none": "no preferences",
      "i.chip.goal": "Goal", "i.chip.exp": "Time on programs", "i.chip.cons": "Past 6 weeks", "i.chip.days": "Days per week", "i.chip.minutes": "Length", "i.chip.rest": "Rest",
      "i.chip.env": "Where you train", "i.chip.prio": "Priorities", "i.chip.avoid": "Avoid", "i.chip.emph": "Muscle emphasis", "i.chip.prefs": "Exercises", "i.chip.shape": "Structure",
      "i.rev.fields_hint": "Tap an answer to correct it. The program is rebuilt right here.",
      "i.rev.adjusted": "What Taurifer adjusted",
      "i.rev.constraints": "Your constraints",
      "i.rev.restore": "Restore", "i.rev.restore_aria": "Restore {exercise}",
      "i.rev.more": "More options",
      "i.rev.new": "new",
      "i.rev.error_title": "The program could not be built",
      "i.rev.source": "Source: {source}",
      "i.grid.load_note": "The load column stays blank: you log the load at the first session and Taurifer sets the next one.",
      "i.grid.day_meta": "{ex} · {sets}",
      "i.edit.apply": "Update program",
      "i.edit.keep": "Keep as it was",
      "i.change.answer": "Answer corrected.", "i.change.answers": "Answers changed.", "i.change.restore": "Constraint removed.", "i.change.constraints": "Constraints applied.", "i.change.edit": "Edits applied.",
      "i.change.before": "Before", "i.change.after": "Now", "i.change.without": "Without avoiding", "i.change.with": "Avoiding",
      "i.change.facts": "{ex} · {sets}",
      "i.q.missing": "Mark one option.",
      "i.q.priorities_lede": "With nothing chosen here, Taurifer builds the program from your earlier answers alone.",
      "i.q.skip": "Skip this section",
      "i.q.show": "Show my program",
      "i.q.none_limit": "You already marked two muscles. Clear one to switch.",
      "i.unit.min": "min",
      "i.stamp.active": "Active",
      "i.stamp.aria": "Stamp: active since {date}",
      "i.edit.lede": "Remove exercises or adjust sets and reps. Changes apply only to this unused program.",
      "i.edit.done": "Back to the program",
      "i.build.days_caption": "{n} training days",
      "i.import.write_own": "I'd rather write it from scratch",
      "i.import.file_name": "Rafael's program.json",
      "i.ff.gaps_title": "Fill in what is missing",
      "i.ff.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing. Write in the missing numbers.",
      "i.ff.or": "or",
      "i.catalogue.change_aria": "Change days, time and place",
      "i.gate.what": "What arrives",
      "i.cancel_keep": "Save draft and leave",
    },
  };
  const STEPS = TF.Entry.ROUTE_STEPS;
  const QUESTIONS = { recommend: ["desired_result", "background", "schedule", "environment", "priorities"], custom: ["desired_result", "background", "schedule", "environment", "priorities", "exercise_preferences", "custom_shape"], browse: ["schedule", "environment"] };
  const REVIEW = { recommend: "result", custom: "result", browse: "preview", import: "preview", shared: "preview", build: "editor" };
  const STOCK = { recommend: "yellow", custom: "pink", browse: "mint", import: "blue", build: "white", shared: "white" };
  const CODE_KEY = { desired_result_required: "desiredResult", structured_experience_required: "structuredExperience", recent_consistency_required: "recentConsistency", days_per_week_required: "daysPerWeek", session_minutes_required: "sessionMinutes", preferred_rest_required: "preferredRestSeconds", environment_required: "environment", program_name_required: "programName", split_preference_required: "splitPreference" };
  const MONTHS = { pt: ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"], en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] };
  let t, lang, root, S;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const compact = () => document.documentElement.style.fontSize === "200%" || window.innerWidth < 360;
  const reduced = () => document.documentElement.dataset.motion === "reduced" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- authored marks (the lifter's pen, one stroke family) ---------- */
  const SVG_X = `<svg class="i-x" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M5.5 5.2c3.2 3.9 7.4 8.6 12.9 13.9"/><path pathLength="1" d="M18.4 4.6c-4.6 4.1-8.7 9.1-12.6 14.8"/></svg>`;
  const SVG_RING = `<svg class="i-ring" viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M60 6C33 3 9 13 6 31c-3 18 22 29 49 27 26-2 41-13 39-29C92 14 72 5 47 7"/></svg>`;
  const SVG_CHEV = `<svg class="i-chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M7.8 2.2 4 6l3.8 3.8"/></svg>`;
  const SVG_TICK = `<svg class="i-x i-tick" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M4.5 12.8c2.2 1.8 3.8 3.6 5.3 6.1 2.6-6.1 5.6-10.4 9.8-14.3"/></svg>`;
  const stampDate = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`; };
  const stamp = (cls = "") => `<span class="i-stamp ${cls}" role="img" aria-label="${esc(t("i.stamp.aria", { date: stampDate() }))}"><span class="i-stamp__w">${esc(t("i.stamp.active"))}</span><span class="i-stamp__d">${esc(stampDate())}</span></span>`;

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, step: null, answers: {}, result: null, card: null, changeFrom: null, lastPreview: null, validation: false, build: null, editing: false, importMode: "freeform", importDraft: null, importKept: null, importHeld: null, ff: TS.freeform.create(), picker: null, help: null, envOpen: false, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, sheet: null, overlay: null, notice: null, actError: null, toast: null, revAtStart: TF.liveRevision(), shared: S ? S.shared : null, sharedError: null, cpTag: null, stash: S ? S.stash : null, orig: null, fresh: null, freshChips: null, freshField: null, stamping: false, handover: null };
  }
  function fresh(seed) { S = null; TF.seedDevice(seed || "fresh"); S = blank(TF.hasActiveProgram() ? "today" : "landing"); }
  const answers = () => TF.normalizeAnswers(S.answers);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const name = () => TF.resultName(S.result, lang) || S.answers.programName || t("untitled_program");
  const generated = () => S.route === "recommend" || S.route === "custom";
  const reviewing = () => !!S.route && S.step === REVIEW[S.route] && S.route !== "build";
  const mode = () => (S.route === "custom" ? "custom" : "recommend");
  const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };
  function issues() {
    const qs = QUESTIONS[S.route] || [];
    if (!qs.includes(S.step) && S.step !== "build_setup") return [];
    try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: answers(), step: S.step })); } catch (e) { return ["state_invalid"]; }
  }
  const missingKeys = () => new Set(S.validation ? issues().map((c) => CODE_KEY[c]).filter(Boolean) : []);
  function ensureSplit(a) {
    const c = TF.splitChoices(TF.normalizeAnswers(a)).choices || [];
    if (c.length && !c.some((x) => x.id === a.splitPreference)) a.splitPreference = (c.find((x) => x.default) || c[0]).id;
    return a;
  }
  function compileWith(a) {
    const r = TF.compile(mode(), a);
    if (!r.ok) return { ok: false, text: TS.issueText(t, r) };
    return { ok: true, result: TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation }) };
  }
  function compileFirst() {
    const r = compileWith(answers());
    S.result = r.ok ? r.result : null; S.compileError = r.ok ? null : r.text; S.changeFrom = null;
    if (!r.ok) return;
    if (!S.orig) S.orig = fieldMap();
    if (S.lastPreview && TF.identityDiff(S.lastPreview, S.result.preview).n > 0) S.changeFrom = { preview: S.lastPreview, ctx: "i.change.answers" };
    else if ((S.answers.exerciseConstraints || []).length) { const w = compileWith({ ...answers(), exerciseConstraints: [] }); if (w.ok) S.changeFrom = { preview: w.result.preview, ctx: "i.change.constraints" }; }
    S.lastPreview = null;
  }
  function stateFor(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    const ui = TF.jsonClean({ build: S.build || null, importMode: S.importMode, editing: false });
    const step = S.route === "build" && S.step === "editor" ? "editor" : S.step;
    let r = { ok: false };
    try { r = TF.saveDraft(stateFor(step), { ui }); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { r = TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step, activeProgramRevisionAtStart: S.revAtStart }), { ui }); } catch (e) { r = { ok: false }; } }
    if (!r.ok) { try { TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step: STEPS[S.route][0], activeProgramRevisionAtStart: S.revAtStart }), { ui }); } catch (e) { /* nothing kept */ } }
  }
  function leaveSetup() { const active = TF.hasActiveProgram(); S = blank(active ? "today" : "landing"); S.shared = null; render(true); }

  /* ---------- navigation ---------- */
  function go(route, importMode, goal) {
    const prev = S.answers || {}; const stash = S.stash;
    S = blank("route"); S.route = route; S.step = QUESTIONS[route] ? QUESTIONS[route][0] : STEPS[route][0];
    if (stash && stash.route === route) S.answers = clone(stash.answers);
    if (goal && (route === "recommend" || route === "custom")) { S.answers.desiredResult = goal; S.step = "background"; S.freshField = "desired_result"; }
    if (route === "browse") for (const k of ["daysPerWeek", "sessionMinutes", "environment"]) if (prev[k] != null && !has(S.answers, k)) S.answers[k] = clone(prev[k]);
    if (route === "import") S.importMode = importMode || "file";
    S.stash = null;
    render(true);
  }
  function toHub() { S.stash = S.route && QUESTIONS[S.route] ? { route: S.route, answers: clone(S.answers) } : null; S.view = "hub"; S.route = null; S.step = null; S.result = null; S.validation = false; S.orig = null; render(true); }
  function toGate() { const shared = S.shared; S = blank("shared-gate"); S.shared = shared; render(true); }
  function advance() {
    if (S.avoid.pending || S.pref.pending) return;
    if (issues().length) { S.validation = true; render("iValidation"); return; }
    S.validation = false;
    if (S.step === "build_setup") {
      if (!S.build || S.build.days.length !== S.answers.daysPerWeek) S.build = TS.build.create(S.answers.programName || "", S.answers.daysPerWeek);
      else S.build = { ...S.build, name: S.answers.programName || "" };
      S.step = "editor"; render(true); return;
    }
    const screens = generated() ? [...QUESTIONS[S.route], "result"] : STEPS[S.route];
    const next = screens[screens.indexOf(S.step) + 1];
    if (next === "custom_shape") ensureSplit(S.answers);
    S.step = next;
    if (next === "result") compileFirst();
    render(true);
  }
  function skipPriorities() {
    S.answers = { ...S.answers, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] };
    S.avoid = { query: "", pending: null }; S.validation = false;
    S.step = "result"; compileFirst(); render(true);
  }
  function leaveResult() { S.lastPreview = S.result ? S.result.preview : null; S.result = null; S.changeFrom = null; S.orig = null; S.sheet = null; }
  function back() {
    if (S.editing) { editDone(); return; }
    if (S.route === "shared") { toGate(); return; }
    if (S.route === "import") {
      if (S.step === "preview") { S.step = "import_source"; S.importDraft = S.importKept; S.result = null; S.changeFrom = null; render(true); return; }
      if (S.importDraft) { S.importHeld = S.importDraft; S.importDraft = null; S.picker = null; render(true); return; }
      if (S.importMode === "freeform") {
        const ff = S.ff;
        if (ff.status === "gaps") { S.ff = TS.freeform.apply(ff, "gap-back"); render(true); return; }
        if (ff.stage === 3) { S.ff = { ...ff, stage: 2, status: null, gapErrors: new Set() }; render(true); return; }
        if (ff.stage === 2) { S.ff = { ...ff, stage: 1, gapErrors: new Set() }; render(true); return; }
      }
      toHub(); return;
    }
    if (S.route === "build" && S.step === "editor") { S.step = "build_setup"; render(true); return; }
    if (S.route === "browse" && S.step === "preview") { S.step = "catalogue"; S.result = null; S.card = null; render(true); return; }
    if (generated() && S.step === "result") leaveResult();
    const steps = generated() ? [...QUESTIONS[S.route], "result"] : STEPS[S.route]; const i = steps.indexOf(S.step);
    if (i <= 0) { toHub(); return; }
    S.step = steps[i - 1]; S.validation = false; S.avoid.pending = null; S.pref.pending = null; render(true);
  }
  function jump(step) { if (S.step === "result") leaveResult(); S.step = step; S.validation = false; render(true); }
  function editDone() {
    const before = S.result.preview;
    S.result = TS.build.commit(S.result, S.build); S.editing = false; S.build = null;
    S.changeFrom = { preview: before, ctx: "i.change.edit" };
    render(); showChange();
  }
  /* The signature closes here: the stamp lands on the finished card, then
     the card is handed to Today. Activation itself is immediate (TF.activate);
     the stamp is the visible record of it. */
  function activateNow() {
    S.actError = null;
    if (S.editing && S.build) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : generated() ? "result" : "preview";
    let r;
    try { r = TF.activate(stateFor(step)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) {
      const stock = STOCK[S.route] || "yellow";
      const hand = () => { S = blank("today"); S.shared = null; S.handover = { stock }; render(true); };
      if (reduced()) { hand(); return; }
      S.stamping = true; render(); setTimeout(hand, 820); return;
    }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render("iConflictBox"); return; }
    S.actError = TS.issueText(t, r, { preview: S.result && S.result.preview }); render("iActError");
  }
  function requestActivate() { if (S.stamping) return; if (TF.hasActiveProgram()) { S.overlay = "replace"; render("replTitle"); } else activateNow(); }

  /* ---------- answer values (what the pen writes) ---------- */
  const restVal = (a) => t(`i.v.rest.${a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds}`);
  const minVal = (a) => (a.sessionMinutes >= 90 ? t("i.v.minutes_90") : t("i.v.minutes", { n: a.sessionMinutes }));
  function envVal(a) {
    if (!a.environment) return "";
    const kind = a.environment.kind; const base = TF.env(kind); const same = (x, y) => JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort());
    const e = t(`entry.environment.${kind}`);
    return same(base.equipment, a.environment.equipment) && same(base.capabilities, a.environment.capabilities) ? e : t("i.v.env_adjusted", { env: e });
  }
  /* The section fields printed at the head of the card during the questions. */
  function sectionValue(step, a) {
    const n = TF.normalizeAnswers(a);
    if (step === "desired_result") return a.desiredResult ? t(`i.v.goal.${a.desiredResult}`) : "";
    if (step === "background") return [a.structuredExperience && t(`entry.background.experience.${a.structuredExperience}`), a.recentConsistency && t(`i.v.cons.${a.recentConsistency}`)].filter(Boolean).join(" · ");
    if (step === "schedule") return [a.daysPerWeek && t("i.v.days", { n: a.daysPerWeek }), a.sessionMinutes && minVal(a), has(a, "preferredRestSeconds") && S.route !== "browse" && restVal(a)].filter(Boolean).join(" · ");
    if (step === "environment") return envVal(a);
    if (step === "priorities" && S.route === "custom") return TS.priorityLabel(t, lang, n, true) || t("i.v.none");
    if (step === "priorities") { const p = [TS.priorityLabel(t, lang, n, false)]; const av = (a.exerciseConstraints || []).map((c) => exLabel(c.exerciseId)); if (av.length) p.push(t("entry.preview.avoid", { exercises: av.join(", ") })); return p.filter(Boolean).join(" · ") || t("i.v.none"); }
    if (step === "exercise_preferences") { const inc = (a.mustHaveExercises || []).map(exLabel), av = (a.exerciseConstraints || []).map((c) => exLabel(c.exerciseId)); return [inc.length ? t("entry.preview.include", { exercises: inc.join(", ") }) : "", av.length ? t("entry.preview.avoid", { exercises: av.join(", ") }) : ""].filter(Boolean).join(" · ") || t("i.v.prefs_none"); }
    if (step === "custom_shape") { const c = (TF.splitChoices(n).choices || []).find((x) => x.id === a.splitPreference); return c ? t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }) : ""; }
    return "";
  }
  const FIELD_LABEL = { desired_result: "i.field.goal", background: "i.field.background", schedule: "i.field.schedule", environment: "i.field.environment", priorities: "i.field.priorities", exercise_preferences: "i.field.exercises", custom_shape: "i.field.shape" };
  const fieldLabel = (step) => t(step === "priorities" && S.route === "custom" ? "i.field.emphasis" : FIELD_LABEL[step]);
  /* The card head during the questions: earlier fields written in pen (tap to
     go back and correct), the current field filling as the lifter marks,
     later fields still blank dotted lines. */
  function cardHead() {
    const qs = QUESTIONS[S.route] || []; const idx = qs.indexOf(S.step); if (idx < 0) return "";
    const items = qs.map((step, i) => {
      const v = i <= idx ? sectionValue(step, S.answers) : "";
      const isFresh = S.freshField === step;
      const pen = v ? `<span class="i-pen${isFresh ? " is-fresh" : ""}">${esc(v)}</span>` : `<span class="i-blank"><span class="visually-hidden">${esc(t(i === idx ? "i.field.here" : "i.field.blank"))}</span></span>`;
      const lab = `<span class="i-field__l">${esc(fieldLabel(step))}</span>`;
      if (i < idx && v) return `<li class="i-field is-filled"><button type="button" class="i-field__btn" data-act="jump" data-step="${step}" aria-label="${esc(t("i.field.edit", { what: lcFirst(fieldLabel(step)), value: v }))}">${lab}${pen}</button></li>`;
      return `<li class="i-field${i === idx ? " is-here" : ""}"${i === idx ? ' aria-current="step"' : ""}><span class="i-field__static">${lab}${pen}</span></li>`;
    }).join("");
    return `<nav class="i-head" aria-label="${esc(t("i.rail"))}"><ol class="i-fields i-fields--q">${items}</ol></nav>`;
  }

  /* ---------- controls in the card's vocabulary ---------- */
  /* Single choice: printed parentheses, marked with the lifter's X.
     Multiple choice: a printed square, marked with a tick. */
  function opt({ key, val, title, cap, selected, role = "radio", disabled, act = "pick", extra = "", cls = "" }) {
    const inked = selected && S.fresh && S.fresh.key === key && String(S.fresh.val) === String(val);
    const box = role === "checkbox" ? `<span class="i-box i-box--sq" aria-hidden="true">${SVG_TICK}</span>` : `<span class="i-box" aria-hidden="true"><span class="i-paren">(</span>${SVG_X}<span class="i-paren">)</span></span>`;
    return `<button type="button" class="i-opt${selected ? " is-on" : ""}${inked ? " is-inked" : ""} ${cls}" role="${role}" aria-checked="${selected ? "true" : "false"}" data-act="${act}" data-key="${esc(key)}" data-val="${esc(val)}"${extra}${disabled ? " disabled" : ""}>${box}<span class="i-opt__b"><span class="i-opt__t">${esc(title)}</span>${cap ? `<span class="i-opt__c">${esc(cap)}</span>` : ""}</span></button>`;
  }
  /* Numbers are circled, as on a paper form. */
  function numRow(key, values, sel, unit) {
    return `<div class="i-nums">${values.map((n) => { const on = sel === n; const inked = on && S.fresh && S.fresh.key === key && +S.fresh.val === n; return `<button type="button" class="i-num${on ? " is-on" : ""}${inked ? " is-inked" : ""}" role="radio" aria-checked="${on}" data-act="pick" data-key="${key}" data-val="${n}"><span class="i-num__v">${n === 90 && key === "sessionMinutes" ? "90+" : n}</span><span class="i-num__u">${esc(unit)}</span>${SVG_RING}</button>`; }).join("")}</div>`;
  }
  function group(id, label, inner, { role = "radiogroup", key, hint, cls = "" } = {}) {
    const miss = key && missingKeys().has(key);
    return `<section class="i-group ${cls}" role="${role}" aria-labelledby="${id}"${miss ? ` aria-describedby="${id}Err"` : ""}><h2 class="i-group__l" id="${id}">${esc(label)}</h2>${hint ? `<p class="i-group__h">${esc(hint)}</p>` : ""}${miss ? `<p class="i-miss" id="${id}Err">${esc(t("i.q.missing"))}</p>` : ""}<div class="i-lines">${inner}</div></section>`;
  }
  const restSelected = (a, v) => has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : v !== "auto" && +v === a.preferredRestSeconds);
  function envCorrection(a, open, tag) {
    if (!a.environment) return "";
    const eq = new Set(a.environment.equipment || []), caps = new Set(a.environment.capabilities || []);
    return `<details class="i-corr" data-role="env-correction"${open ? " open" : ""}${open && tag ? ' data-checkpoint="rec-env-correction"' : ""}><summary class="i-corr__s"><span>${esc(t("entry.env_correct.summary"))}</span>${SVG_CHEV}</summary><div class="i-corr__b">
      <section class="i-group" role="group" aria-labelledby="iEq${tag ? "" : "S"}"><h3 class="i-group__l" id="iEq${tag ? "" : "S"}">${esc(t("entry.env_correct.equipment"))}</h3><div class="i-lines i-lines--2">${TS.EQUIP.map((k) => opt({ key: "environmentEquipment", val: k, title: t(`entry.equip.${k}`, undefined, k), selected: eq.has(k), role: "checkbox" })).join("")}</div></section>
      <section class="i-group" role="group" aria-labelledby="iCap${tag ? "" : "S"}"><h3 class="i-group__l" id="iCap${tag ? "" : "S"}">${esc(t("entry.env_correct.capabilities"))}</h3><div class="i-lines">${TS.CAPS.map((k) => opt({ key: "environmentCapabilities", val: k, title: t(`entry.cap.${k}`, undefined, k), selected: caps.has(k), role: "checkbox" })).join("")}</div></section>
      <p class="i-note">${esc(t("entry.env_correct.note"))}</p></div></details>`;
  }
  function questionBody(step, a, o = {}) {
    const route = o.route || S.route; const p = o.sheet ? "s" : "q";
    if (step === "desired_result") return group(`${p}Goal`, t("entry.desired_result.lede"), TS.DESIRED.map((v) => opt({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v })).join(""), { key: "desiredResult" });
    if (step === "background") return group(`${p}Exp`, t("entry.background.experience.label"), TS.EXPERIENCE.map((v) => opt({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v })).join(""), { key: "structuredExperience" })
      + group(`${p}Cons`, t("entry.background.consistency.label"), TS.CONSISTENCY.map((v) => opt({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v })).join(""), { key: "recentConsistency" });
    if (step === "schedule") {
      const days = group(`${p}Days`, t("entry.schedule.days.label"), numRow("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek", cls: "i-group--nums" });
      const mins = group(`${p}Min`, t("entry.schedule.minutes.label"), numRow("sessionMinutes", TS.MINUTES, a.sessionMinutes, t("i.unit.min")), { key: "sessionMinutes", cls: "i-group--nums" });
      const rest = route === "browse" ? "" : group(`${p}Rest`, t("entry.schedule.rest.label"), TS.REST.map((v) => opt({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: restSelected(a, v) })).join(""), { key: "preferredRestSeconds" });
      return days + mins + rest;
    }
    if (step === "environment") {
      const open = o.sheet ? true : S.envOpen;
      return group(`${p}Env`, t("entry.environment.lede"), TS.ENVS.map((v) => opt({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment && a.environment.kind === v })).join(""), { key: "environment" }) + envCorrection(a, open, !o.sheet && route !== "browse" || !!o.sheet);
    }
    if (step === "priorities" && route === "custom") return `<p class="i-note">${esc(t("entry.priorities.state_hint"))}</p><div class="i-ts">${TS.muscleEmphasis(t, a)}</div>`;
    if (step === "priorities") {
      const prim = a.primaryMuscles || []; const st = o.sheet ? S.sheet.avoid : S.avoid;
      return group(`${p}Prim`, t("entry.priorities.primary"), opt({ key: "clearPriorities", val: "1", title: t("entry.priorities.none"), selected: prim.length === 0 }) + `<div class="i-lines--2">${TS.MUSCLES.map((m) => opt({ key: "primaryMuscles", val: m, title: t(`entry.muscle.${m}`), selected: prim.includes(m), role: "checkbox", disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div>`, { role: "group", hint: t(prim.length >= 2 ? "i.q.none_limit" : "entry.priorities.lede") })
        + group(`${p}Mov`, t("entry.priorities.movements"), TS.MOVEMENTS.map((m) => opt({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (a.priorityMovements || []).includes(m), role: "checkbox" })).join(""), { role: "group" })
        + `<section class="i-group i-ts" aria-labelledby="${p}Avoid"><h2 class="i-group__l" id="${p}Avoid">${esc(t("entry.priorities.avoid"))}</h2>${TS.avoidSection(t, lang, { query: st.query, pending: st.pending, constraints: a.exerciseConstraints || [] }, { searchId: o.sheet ? "iSheetAvoid" : "avoidSearch" })}</section>`;
    }
    if (step === "exercise_preferences") { const st = o.sheet ? S.sheet.pref : S.pref; return `<div class="i-ts">${TS.exercisePrefs(t, lang, { query: st.query, pending: st.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] })}</div>`; }
    if (step === "custom_shape") {
      const c = TF.splitChoices(TF.normalizeAnswers(a)).choices || [];
      if (!c.length) return `<div class="i-notice i-notice--err" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p></div>`;
      return `<div class="i-lines" role="radiogroup" aria-label="${esc(t("entry.custom_shape.split"))}">${c.map((x) => { const est = (x.days || []).map((d) => d.estimateMinutes).filter(Number.isFinite); return opt({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt || x.name : x.name, days: x.frequency }), cap: `${c.length === 1 ? "" : t(x.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason")} ${est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""}`.trim(), selected: a.splitPreference === x.id }); }).join("")}</div>`;
    }
    return "";
  }
  function stepHead(step) {
    if (step === "priorities" && S.route === "custom") return { title: t("entry.priorities.custom_title"), lede: t("entry.priorities.custom_lede") };
    if (step === "priorities") return { title: t("entry.priorities.title"), lede: t("i.q.priorities_lede"), optional: true };
    if (step === "exercise_preferences") return { title: t("entry.exercise_preferences.title"), lede: t("entry.exercise_preferences.lede"), optional: true };
    if (step === "custom_shape") { const n = (TF.splitChoices(answers()).choices || []).length; return { title: t(n === 1 ? "entry.custom_shape.title_sole" : "entry.custom_shape.title"), lede: t(n === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede") }; }
    if (step === "schedule") return { title: t("entry.schedule.title"), lede: t("entry.schedule.lede") };
    if (step === "background") return { title: t("entry.background.title"), lede: t("entry.background.lede") };
    if (step === "environment") return { title: t("entry.environment.title") };
    return { title: t("entry.desired_result.title") };
  }
  const btn = (label, act, { cls = "i-btn", id, extra = "" } = {}) => `<button type="button" class="${cls}"${id ? ` id="${id}"` : ""} data-act="${act}"${extra}>${esc(label)}</button>`;
  const slip = (inner, { role = "dialog", label, desc, attrs = "", scrimAct }) => `<div class="i-scrim" data-act="${scrimAct}"></div><div class="i-slip" role="${role}" aria-modal="true" aria-labelledby="${label}"${desc ? ` aria-describedby="${desc}"` : ""} ${attrs}><span class="i-slip__perf" aria-hidden="true"></span>${inner}</div>`;

  /* ---------- landing ---------- */
  const mast = () => `<header class="i-mast"><span class="i-mast__mark" aria-hidden="true" style="--mark:url('${esc(TF.asset("vendor/brand/mark.png"))}')"></span><span class="i-mast__word">Taurifer</span><span class="i-mast__gap"></span>${TS.privacyButton(t, { cls: "i-link i-mast__priv" })}</header>`;
  function blankCard() {
    const f = (k, wide) => `<span class="i-bf${wide ? " i-bf--wide" : ""}"><span class="i-field__l">${esc(t(k))}</span><span class="i-blank"></span></span>`;
    return `<div class="i-blankcard" role="img" aria-label="${esc(t("i.land.blank"))}"><div class="i-bf-grid" aria-hidden="true">${f("i.land.f.goal", true)}${f("i.land.f.days")}${f("i.land.f.length")}${f("i.land.f.rest")}${f("i.land.f.where")}</div>
      <div class="i-bgrid" aria-hidden="true"><div class="i-bgrid__h"><span>${esc(t("i.grid.exercise"))}</span><span>${esc(t("i.grid.sets"))}</span><span>${esc(t("i.grid.reps"))}</span><span>${esc(t("i.grid.load"))}</span></div>${"<div class=\"i-bgrid__r\"><span></span><span></span><span></span><span></span></div>".repeat(3)}</div></div>`;
  }
  const landingActions = () => `<div class="i-acts"><button type="button" id="firstRunCreate" class="i-btn i-btn--solid" data-act="land-create">${esc(t("landing.build"))}</button><button type="button" id="firstRunImport" class="i-btn" data-act="land-import">${esc(t("landing.track"))}</button></div>`;
  function landingView() {
    if (S.view === "shared-gate" && S.shared) {
      const m = S.shared.program.meta; const n = S.shared.program.exercises.length;
      return `<main class="i-page i-land" data-checkpoint="shared-gate">${mast()}
        <h1 class="i-display" data-focus>${esc(t("landing.shared.headline"))}</h1><p class="i-lede">${esc(t("landing.shared.body"))}</p>
        <section class="i-gate" aria-labelledby="iGateName"><h2 class="i-gate__n" id="iGateName" data-user-text>${esc(m.name)}</h2><p class="i-facts"><span>${esc(t("entry.catalogue.days_badge", { days: m.daysPerWeek }))}</span><span>${esc(t("entry.preview.exercises", { n, exercise: TF.tp(t, n, "exercise") }))}</span></p>
          <h3 class="i-rule-l">${esc(t("i.gate.what"))}</h3><p class="i-small">${esc(t("x.shared.what"))}</p><p class="i-small">${esc(t("x.shared.nothing_saved"))}</p></section>
        <div class="i-acts"><button type="button" id="firstRunSharedStart" class="i-btn i-btn--solid" data-act="shared-start" aria-describedby="iGateCap">${esc(t("setup.shared.title"))}</button><p class="i-note" id="iGateCap"><span data-user-text>${esc(t(m.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: m.name, n: m.daysPerWeek }))}</span></p></div>
        <p class="i-note i-land__priv">${esc(t("x.privacy.line"))}</p></main>`;
    }
    const invalid = S.view === "shared-invalid";
    return `<main class="i-page i-land" data-checkpoint="${invalid ? "shared-invalid" : "landing"}">${mast()}
      <h1 class="i-display" data-focus>${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1>
      <p class="i-lede">${esc(t(invalid ? "landing.shared.invalid_body" : "landing.body"))}</p>
      ${invalid ? `<p class="i-notice i-notice--err" role="status">${esc(t(TF.sharedErrorKey(S.sharedError)))}</p>` : blankCard()}
      ${landingActions()}
      <p class="i-note i-land__priv">${esc(t("x.privacy.line"))}</p>
      ${invalid ? "" : `<figure class="i-proof"><span class="i-proof__clip" aria-hidden="true"></span>${TS.landingProof(t, lang)}<figcaption class="i-note">${esc(t("i.land.proof"))}</figcaption></figure>`}</main>`;
  }

  /* ---------- route choice: the card box ---------- */
  function door(route, { importMode } = {}) {
    const key = route === "import" ? (importMode === "freeform" ? "freeform" : "file") : route;
    const title = route === "import" ? t(importMode === "freeform" ? "entry.hub.freeform.title" : "entry.hub.import.title") : t(`entry.hub.${route}.title`);
    const ask = { custom: t("x.cost.custom"), browse: t("x.cost.browse"), build: t("x.cost.build"), freeform: t("x.cost.paste"), file: t("x.cost.file") }[key];
    const get = { custom: t("i.get.custom"), browse: t("x.get.browse"), build: t("x.get.build"), freeform: t("x.get.import"), file: t("x.get.import") }[key];
    const stock = route === "import" ? (importMode === "freeform" ? "blue" : "blue2") : STOCK[route];
    return `<li class="i-idx" data-stock="${stock}"><button type="button" class="i-idx__btn" data-act="route" data-route="${route}"${importMode ? ` data-mode="${importMode}"` : ""}><span class="i-idx__t">${esc(title)}</span><span class="i-idx__line"><span class="i-idx__k">${esc(t("i.hub.do"))}</span> ${esc(ask)}</span><span class="i-idx__line"><span class="i-idx__k">${esc(t("i.hub.get"))}</span> ${esc(get)}</span></button></li>`;
  }
  function recoveryCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") return `<div class="i-recover i-notice" data-checkpoint="rules-changed" role="status"><strong>${esc(t("entry.rules_changed.title"))}</strong><p>${esc(t(info.route === "import" || info.route === "shared" ? "entry.rules_changed.body_keep" : "entry.rules_changed.body_rebuild"))}</p>${info.route === "import" || info.route === "shared" ? btn(t("entry.rules_changed.keep"), "rules-keep", { extra: " disabled" }) : btn(t("entry.rules_changed.rebuild"), "rules-rebuild")}</div>`;
    const f = TS.resumeFacts(t, lang, info);
    return `<section class="i-recover i-idx i-idx--static" data-stock="${STOCK[info.route] || "yellow"}" data-checkpoint="resume" aria-labelledby="iResumeTitle"><div class="i-idx__btn"><h2 class="i-idx__t" id="iResumeTitle">${esc(t("entry.resume.title"))}</h2><p class="i-small">${esc(t("entry.resume.body"))}</p><p class="i-pen i-resume__at">${esc(t("i.resume.at", { route: f.route, step: f.step, when: f.when }))}</p><div class="i-acts">${btn(t("entry.resume.continue"), "resume", { cls: "i-btn i-btn--solid", id: "iResume" })}${btn(t("entry.resume.restart"), "resume-restart", { cls: "i-link i-link--danger", id: "iResumeRestart", extra: ' aria-haspopup="dialog"' })}</div></div></section>`;
  }
  function helpPanel() {
    const h = S.help; if (!h) return "";
    const q = (qq, val, label) => opt({ key: qq, val, title: label, selected: h[qq] === val, act: "help-pick", extra: ` data-q="${qq}"` });
    const q2 = h.q1 === "no" ? { label: t("i.help.q2_no"), opts: ["recommend", "custom", "browse"] } : h.q1 === "yes" ? { label: t("i.help.q2_yes"), opts: ["import", "build"] } : null;
    const target = q2 && q2.opts.includes(h.q2) ? h.q2 : null;
    return `<div class="i-help" id="iHelp" data-checkpoint="route-help"><section class="i-group" role="radiogroup" aria-labelledby="iHelpQ1"><h2 class="i-group__l" id="iHelpQ1">${esc(t("i.help.q1"))}</h2><div class="i-lines">${q("q1", "no", t("i.help.q1.no"))}${q("q1", "yes", t("i.help.q1.yes"))}</div></section>
      ${q2 ? `<section class="i-group" role="radiogroup" aria-labelledby="iHelpQ2"><h2 class="i-group__l" id="iHelpQ2">${esc(q2.label)}</h2><div class="i-lines">${q2.opts.map((o) => q("q2", o, t(`i.help.q2.${o}`))).join("")}</div></section>` : ""}
      ${target ? `<button type="button" class="i-btn i-btn--solid" data-act="help-go" data-job="${target}">${esc(t("i.help.go", { route: TS.routeName(t, target) }))}</button>` : ""}</div>`;
  }
  function hubView() {
    const active = TF.hasActiveProgram();
    const cur = active ? TF.device.active : null;
    return `<div class="i-page i-hub"><header class="i-bar">${btn("", "hub-back", { cls: "i-link i-bar__btn" }).replace("></button>", `>${SVG_CHEV}${esc(t("entry.back"))}</button>`)}</header>
      <main class="i-main" data-checkpoint="${active ? "hub-existing" : "route-choice"}">
        <h1 class="i-title" data-focus>${esc(t("entry.hub.title"))}</h1><p class="i-lede">${esc(active ? t("i.hub.lede_existing") : t("i.hub.lede_first"))}</p>
        ${cur ? `<section class="i-current" aria-labelledby="iCur"><h2 class="i-rule-l" id="iCur">${esc(t("i.hub.current"))}</h2><p class="i-current__n" data-user-text>${esc(TF.activeName(lang))}</p><p class="i-small">${esc(t("i.hub.current_facts", { days: cur.daysPerWeek, n: TF.device.sessions }))}</p>${stamp("i-stamp--sm")}<p class="i-note">${esc(t("entry.active_notice"))}</p></section>` : ""}
        ${recoveryCard()}
        <ol class="i-box-list">
          <li class="i-idx i-idx--rec" data-stock="yellow"><section class="i-idx__btn" aria-labelledby="iRecQ"><span class="i-idx__t">${esc(t("entry.hub.recommend.title"))}</span><h2 class="i-idx__q" id="iRecQ">${esc(t("entry.desired_result.title"))}</h2><p class="i-idx__line"><span class="i-idx__k">${esc(t("i.hub.do"))}</span> ${esc(t("x.cost.recommend"))}</p><p class="i-idx__line"><span class="i-idx__k">${esc(t("i.hub.get"))}</span> ${esc(t("i.get.recommend"))}</p>
            <div class="i-lines" role="group" aria-labelledby="iRecQ">${TS.DESIRED.map((v) => `<button type="button" class="i-opt i-opt--go" data-act="start-rec" data-goal="${v}"><span class="i-box" aria-hidden="true"><span class="i-paren">(</span>${SVG_X}<span class="i-paren">)</span></span><span class="i-opt__b"><span class="i-opt__t">${esc(t(`entry.desired_result.${v}.label`))}</span><span class="i-opt__c">${esc(t(`entry.desired_result.${v}.sub`))}</span></span></button>`).join("")}</div></section></li>
          ${door("custom")}${door("browse")}${door("import", { importMode: "freeform" })}${door("import", { importMode: "file" })}${door("build")}
        </ol>
        <button type="button" class="i-link i-help-t" id="iHelpToggle" data-act="help-toggle" aria-expanded="${S.help ? "true" : "false"}" aria-controls="iHelp">${esc(t("i.help.toggle"))}</button>${helpPanel()}
      </main></div>`;
  }

  /* ---------- checkpoints ---------- */
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    const r = S.route, s = S.step;
    if (r === "recommend") {
      if (s === "environment") return S.envOpen ? "rec-env-correction" : "rec-environment";
      if (s === "priorities") return (S.answers.exerciseConstraints || []).some((c) => c.reason === "pain") ? "rec-avoid-pain" : "rec-priorities";
      return { desired_result: "rec-goal", background: "rec-background", schedule: "rec-schedule", result: "rec-result" }[s] || "";
    }
    if (r === "custom") return { priorities: "custom-priorities", exercise_preferences: "custom-exercises", custom_shape: "custom-shape", result: "custom-result" }[s] || `custom-${s}`;
    if (r === "browse") return { schedule: "browse-filters", environment: "browse-filters", catalogue: "browse-list", preview: "browse-preview" }[s];
    if (r === "build") { if (s === "build_setup") return "build-setup"; const filled = S.build ? S.build.days.filter((d) => d.exercises.length).length : 0; return filled === 0 ? "build-empty" : filled < S.build.days.length ? "build-partial" : "build-ready"; }
    if (r === "import") {
      if (s === "preview") return "import-preview";
      if (S.importDraft) return "import-review";
      if (S.importMode === "file") return "import-source";
      const ff = S.ff;
      if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps";
      if (ff.status === "unreadable") return "ff-unreadable";
      return ff.stage === 1 ? (TS.freeform.program(ff) ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply";
    }
    if (r === "shared") return "shared-preview";
    return "";
  }

  /* ---------- the completed card (review) ---------- */
  const CHIP_STEP = { goal: "desired_result", exp: "background", cons: "background", days: "schedule", minutes: "schedule", rest: "schedule", env: "environment", prio: "priorities", avoid: "priorities", emph: "priorities", prefs: "exercise_preferences", shape: "custom_shape" };
  function chipList(a0) {
    const a = a0 || S.answers, n = TF.normalizeAnswers(a); const out = [];
    const add = (chip, text) => out.push({ chip, label: t(`i.chip.${chip}`), text });
    const libs = (ids) => ids.map(exLabel).join(", ");
    if (a.desiredResult) add("goal", t(`i.v.goal.${a.desiredResult}`));
    if (a.structuredExperience) add("exp", t(`entry.background.experience.${a.structuredExperience}`));
    if (a.recentConsistency) add("cons", t(`i.v.cons.${a.recentConsistency}`));
    if (a.daysPerWeek) add("days", t("i.v.days", { n: a.daysPerWeek }));
    if (a.sessionMinutes) add("minutes", minVal(a));
    if (has(a, "preferredRestSeconds")) add("rest", restVal(a));
    if (a.environment) add("env", envVal(a));
    const avoids = (a.exerciseConstraints || []).map((c) => c.exerciseId);
    if (S.route === "recommend") {
      add("prio", TS.priorityLabel(t, lang, n, false) || t("i.v.none"));
      if (avoids.length) add("avoid", libs(avoids));
    } else {
      add("emph", TS.priorityLabel(t, lang, n, true) || t("i.v.none"));
      const inc = a.mustHaveExercises || [];
      add("prefs", [inc.length ? t("entry.preview.include", { exercises: libs(inc) }) : "", avoids.length ? t("entry.preview.avoid", { exercises: libs(avoids) }) : ""].filter(Boolean).join(" · ") || t("i.v.prefs_none"));
      const c = (TF.splitChoices(n).choices || []).find((x) => x.id === a.splitPreference);
      if (c) add("shape", t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }));
    }
    return out;
  }
  function fieldMap() { const m = {}; for (const c of chipList()) m[c.chip] = c.text; return m; }
  function addedIds(before, after) {
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    return added.size && added.size < (after.program || []).length ? added : new Set();
  }
  function changeLine() {
    if (!S.changeFrom || !S.result) return "";
    const b = S.changeFrom.preview, a = S.result.preview, d = TF.identityDiff(b, a);
    const fb = TF.previewFacts(b), fa = TF.previewFacts(a); const cons = S.changeFrom.ctx === "i.change.constraints";
    const facts = (f) => t("i.change.facts", { ex: t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), sets: t("entry.preview.sets", { n: f.sets }) });
    return `<div class="i-change" id="iChange" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}"><p class="i-change__l">${esc(t(S.changeFrom.ctx))} ${esc(TS.changeText(t, d))}</p>${d.n === 0 && fb.sets === fa.sets ? "" : `<p class="i-change__ba"><span><span class="i-change__k">${esc(t(cons ? "i.change.without" : "i.change.before"))}</span> ${esc(facts(fb))}</span><span><span class="i-change__k">${esc(t(cons ? "i.change.with" : "i.change.after"))}</span> ${esc(facts(fa))}</span></p>`}</div>`;
  }
  /* The program printed into the card's grid: one block per training day. */
  function grid(preview, added = new Set()) {
    return (preview.days || []).map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((n, e) => n + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const dn = TF.dayName(t, d, preview.programStructure, i);
      return `<section class="i-day" aria-labelledby="iDay${i}"><header class="i-day__h"><span class="i-day__n" aria-hidden="true">${i + 1}</span><span class="i-day__hb"><h3 class="i-day__t" id="iDay${i}">${esc(dn)}</h3><span class="i-day__m">${esc(meta)}</span></span></header>
        <table class="i-grid"><thead><tr><th scope="col" class="i-grid__ex">${esc(t("i.grid.exercise"))}</th><th scope="col" class="i-grid__n">${esc(t("i.grid.sets"))}</th><th scope="col" class="i-grid__n">${esc(t("i.grid.reps"))}</th><th scope="col" class="i-grid__ld">${esc(t("i.grid.load"))}</th></tr></thead>
        <tbody>${ex.length ? ex.map((e, j) => { const isNew = added.has(e.id); return `<tr class="i-row${isNew ? " is-new" : ""}" data-slot="${esc(e.id)}" style="--i:${j}"><td class="i-grid__ex">${esc(TS.exName(e, lang))}${isNew ? ` <span class="i-new">${esc(t("i.rev.new"))}</span>` : ""}</td><td class="i-grid__n">${e.sets != null ? e.sets : ""}</td><td class="i-grid__n">${e.min != null ? (e.min === e.max ? e.min : `${e.min}–${e.max}`) : ""}</td><td class="i-grid__ld"><span class="i-ldline"></span></td></tr>`; }).join("") : `<tr><td colspan="4" class="i-grid__ex">${esc(t("program.empty.exercises"))}</td></tr>`}</tbody></table></section>`;
    }).join("");
  }
  function editorView() {
    const sh = S.sheet; if (!sh) return "";
    const pending = sh.avoid.pending || sh.pref.pending;
    const label = t(`i.chip.${sh.chip}`);
    return `<section class="i-edit" id="iEdit" aria-labelledby="iEditTitle"><h2 class="i-edit__t" id="iEditTitle" tabindex="-1">${esc(label)}</h2>
      ${sh.error ? `<div class="i-notice i-notice--err" role="alert"><p>${esc(sh.error)}</p></div>` : ""}${questionBody(sh.kind, sh.answers, { sheet: true })}
      <div class="i-acts"><button type="button" class="i-btn i-btn--solid" data-act="sheet-apply"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(t("i.edit.apply"))}</button><button type="button" class="i-btn i-btn--quiet" data-act="sheet-close">${esc(t("i.edit.keep"))}</button></div></section>`;
  }
  function fieldsBlock() {
    const fc = S.freshChips || new Set();
    const items = chipList().map((c) => {
      const old = S.orig && S.orig[c.chip] !== undefined && S.orig[c.chip] !== c.text ? S.orig[c.chip] : null;
      const open = S.sheet && S.sheet.chip === c.chip;
      return `<li class="i-field is-filled${old ? " is-corrected" : ""}"><button type="button" class="i-field__btn${open ? " is-open" : ""}" data-act="chip" data-chip="${c.chip}" aria-expanded="${open ? "true" : "false"}"${open ? ' aria-controls="iEdit"' : ""} aria-label="${esc(t("i.field.edit", { what: lcFirst(c.label), value: c.text }))}"><span class="i-field__l">${esc(c.label)}</span>${old ? `<s class="i-struck">${esc(old)}</s>` : ""}<span class="i-pen${fc.has(c.chip) ? " is-fresh" : ""}">${esc(c.text)}</span></button></li>`;
    }).join("");
    return `<section class="i-head i-head--rev" aria-labelledby="iFieldsL"><h2 class="visually-hidden" id="iFieldsL">${esc(t("i.rail"))}</h2><ol class="i-fields">${items}</ol><p class="i-note i-head__hint">${esc(t("i.rev.fields_hint"))}</p>${editorView()}</section>`;
  }
  function reviewBody() {
    if (!S.result) return `<h1 class="i-title" data-focus>${esc(t("i.rev.error_title"))}</h1><div class="i-notice i-notice--err" role="alert"><p>${esc(S.compileError || t("x.issue.compile"))}</p></div>`;
    const r = S.result, p = r.preview, f = TF.previewFacts(p), a = answers(), gen = generated();
    const facts = [t("entry.catalogue.days_badge", { days: (p.days || []).length }), TF.durationLabel(t, p), t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), t("entry.preview.sets", { n: f.sets })].filter(Boolean);
    const conflict = S.notice === "conflict" ? `<div id="iConflictBox" tabindex="-1" class="i-notice i-notice--err" role="alert" data-checkpoint="activation-conflict"><strong>${esc(t("entry.conflict.title"))}</strong><p>${esc(t("entry.conflict.body"))}</p>${btn(t("entry.conflict.review"), "conflict-review")}</div>` : "";
    let out = `${conflict}<div class="i-namebar">${S.stamping ? stamp("i-stamp--press") : ""}<h1 class="i-progname" data-focus${S.route === "shared" || S.route === "import" ? " data-user-text" : ""}>${esc(name())}</h1>
      <p class="i-facts" id="iFacts">${facts.map((x) => `<span>${esc(x)}</span>`).join("")}</p></div>${changeLine()}
      ${TF.hasActiveProgram() && S.notice !== "conflict" ? `<p class="i-note i-active">${esc(t("entry.active_notice"))}</p>` : ""}`;
    if (gen) out += fieldsBlock();
    else out += `<p class="i-note i-src">${esc(t("i.rev.source", { source: t(`entry.preview.source.${S.route}`) }))}</p>`;
    out += `<section class="i-week" aria-labelledby="iWeek"><h2 class="visually-hidden" id="iWeek">${esc(t("entry.preview.days"))}</h2>${grid(p, S.changeFrom && gen ? addedIds(S.changeFrom.preview, p) : new Set())}<p class="i-note i-loadnote">${esc(t("i.grid.load_note"))}</p></section>`;
    const obs = [];
    if (gen) for (const x of TS.reasons(t, lang, r, a, { custom: S.route === "custom" })) obs.push(x.text);
    else {
      const card = S.route === "browse" && S.card ? TF.browseCards(answers()).find((c) => c.id === S.card) : null;
      if (card) { obs.push(t(`entry.catalogue.purpose.${card.purpose}`)); obs.push(t("entry.catalogue.equipment", { equipment: card.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") })); }
      obs.push(t(TF.progressionCopyKey(p)));
      if (S.route === "import") obs.push(t("import.safe"));
    }
    out += `<section class="i-obs" aria-labelledby="iWhy"><h2 class="i-rule-l" id="iWhy">${esc(t(gen ? "entry.result.why" : "entry.preview.progression"))}</h2><ul class="i-obs__l">${obs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${gen ? `<p class="i-note">${esc(t("entry.result.lede"))}</p>` : ""}</section>`;
    const adj = TS.adjustments(t, p);
    if (adj.length) out += `<section class="i-obs" aria-labelledby="iAdj"><h2 class="i-rule-l" id="iAdj">${esc(t("i.rev.adjusted"))}</h2><ul class="i-obs__l">${adj.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul></section>`;
    const cons = gen ? TS.constraintLines(t, lang, a) : [];
    if (cons.length) out += `<section class="i-obs" aria-labelledby="iCons"><h2 class="i-rule-l" id="iCons">${esc(t("i.rev.constraints"))}</h2><ul class="i-obs__l">${cons.map((x) => `<li class="i-cons"><span>${esc(x.text)}</span>${x.kind === "avoid" ? `<button type="button" class="i-btn i-btn--sm" data-act="restore" data-id="${esc(x.id)}" aria-label="${esc(t("i.rev.restore_aria", { exercise: exLabel(x.id) }))}">${esc(t("i.rev.restore"))}</button>` : ""}</li>`).join("")}</ul>${cons.some((x) => x.reason === "pain") ? `<p class="i-note">${esc(t("entry.priorities.pain_note"))}</p>` : ""}</section>`;
    if (r.alternative) out += `<section class="i-obs" aria-labelledby="iAlt"><h2 class="i-rule-l" id="iAlt">${esc(t("entry.result.alternative"))}</h2><p class="i-small">${esc(TF.resultName(r.alternative, lang) || "")}</p></section>`;
    if (TF.progressionIssue(p)) out += `<p class="i-notice i-notice--err" id="iBlocked" role="alert">${esc(t("entry.preview.activation_blocked"))}</p>`;
    if (S.actError) out += `<p class="i-notice i-notice--err" id="iActError" tabindex="-1" role="alert">${esc(S.actError)}</p>`;
    out += `<section class="i-more" aria-labelledby="iMore"><h2 class="visually-hidden" id="iMore">${esc(t("i.rev.more"))}</h2><button type="button" class="i-btn" id="iEditBtn" data-act="edit">${esc(t("entry.preview.edit"))}</button><button type="button" class="i-link i-link--danger" id="iRestart" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></section>`;
    return out;
  }
  function activateStub({ ready = true, reasonId = null, statusHtml = "" } = {}) {
    const blocked = S.notice === "conflict" ? "iConflictBox" : !ready ? reasonId : null;
    const label = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : S.route === "build" && !S.editing ? t("entry.editor.use") : t("entry.preview.activate_first");
    return `<footer class="i-stub" data-persistent-action data-checkpoint="activate">${statusHtml}<button type="button" class="i-btn i-btn--stamp" id="iActivate" data-activate data-act="activate"${blocked ? ` disabled aria-describedby="${blocked}"` : ""}${S.stamping ? ' aria-disabled="true"' : ""}>${esc(label)}</button></footer>`;
  }
  function catalogueBody() {
    const a = S.answers; const cards = TF.browseCards(answers());
    const label = (s) => t(`program.progression.strategy.${s}`, undefined, s);
    const range = (vals, exact, rng) => (Math.min(...vals) === Math.max(...vals) ? t(exact, { n: vals[0] }) : t(rng, { min: Math.min(...vals), max: Math.max(...vals) }));
    const card = (c) => { const nm = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; const ex = c.structureFacts.map((x) => x.exerciseCount), sets = c.structureFacts.map((x) => x.setCount);
      return `<li class="i-idx" data-stock="mint"><button type="button" class="i-idx__btn" data-act="card" data-id="${esc(c.id)}"><span class="i-idx__t">${esc(nm)} · ${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span><span class="i-idx__line">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span><span class="i-idx__line">${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))} · ${esc(range(ex, "entry.catalogue.exercises_exact", "entry.catalogue.exercises_range"))} · ${esc(range(sets, "entry.catalogue.sets_exact", "entry.catalogue.sets_range"))}</span><span class="i-idx__line">${esc(t("entry.catalogue.progression", { progression: c.progressionStrategies.map(label).join(" · ") }))}</span>${c.mismatch ? `<span class="i-idx__line">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button></li>`; };
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    return `<h1 class="i-title" data-focus>${esc(t("entry.catalogue.title"))}</h1><p class="i-lede">${esc(t("entry.catalogue.lede"))}</p>
      <div class="i-ctx"><p class="i-facts"><span>${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span>${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment ? a.environment.kind : "other"}`))}</span></p><button type="button" class="i-btn i-btn--sm" data-act="jump" data-step="schedule" aria-label="${esc(t("i.catalogue.change_aria"))}">${esc(t("x.change"))}</button></div>
      ${fits.length ? `<section aria-labelledby="iFits"><h2 class="i-rule-l" id="iFits">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</h2><ul class="i-box-list">${fits.map(card).join("")}</ul></section>` : `<div class="i-notice i-notice--err" role="alert"><strong>${esc(t("entry.catalogue.empty_title"))}</strong><p>${esc(t("entry.catalogue.empty_body"))}</p></div>`}
      ${others.length ? `<details class="i-corr"><summary class="i-corr__s"><span>${esc(t("entry.catalogue.group_other"))} (${others.length})</span>${SVG_CHEV}</summary><div class="i-corr__b"><p class="i-note">${esc(t("entry.catalogue.mismatch"))}</p><ul class="i-box-list">${others.map(card).join("")}</ul></div></details>` : ""}`;
  }
  function editorParts() {
    const forBuild = S.route === "build" && !S.editing;
    const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
    const head = forBuild
      ? `<h1 class="i-progname" data-focus data-user-text>${esc(S.build.name || t("untitled_program"))}</h1><p class="i-facts"><span>${esc(t("i.build.days_caption", { n: S.build.days.length }))}</span></p>`
      : `<h1 class="i-progname" data-focus>${esc(name())}</h1><p class="i-lede">${esc(t("i.edit.lede"))}</p><button type="button" class="i-btn" data-act="edit-done">${esc(t("i.edit.done"))}</button>`;
    const status = TS.build.statusLine(st, { id: "editorStatus" });
    const tail = forBuild ? `<div class="i-more"><button type="button" class="i-btn i-btn--quiet" data-act="save-draft">${esc(t("entry.editor.save"))}</button></div>` : "";
    const inFlow = compact() || st.ready;
    return { body: head + `<div class="i-ts i-editor">${TS.build.editor(t, lang, S.build)}</div>` + (inFlow ? status : "") + tail, footer: activateStub({ ready: st.ready, reasonId: "editorStatus", statusHtml: inFlow ? "" : status }) };
  }
  function buildSetupBody() {
    const a = S.answers; const miss = missingKeys();
    return `<h1 class="i-title" data-focus>${esc(t("entry.build_setup.title"))}</h1><p class="i-lede">${esc(t("entry.build_setup.lede"))}</p>${TF.hasActiveProgram() ? `<p class="i-note">${esc(t("entry.active_notice"))}</p>` : ""}${validationNotice()}
      <label class="i-input"><span class="i-field__l">${esc(t("entry.build_setup.name"))}</span><input id="iBuildName" type="text" maxlength="80" autocomplete="off" data-field="programName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"${miss.has("programName") ? ' aria-invalid="true" aria-describedby="iNameErr"' : ""}>${miss.has("programName") ? `<span class="i-miss" id="iNameErr">${esc(TS.issueText(t, ["program_name_required"]))}</span>` : ""}</label>
      ${group("qBDays", t("entry.build_setup.days"), numRow("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek", cls: "i-group--nums" })}`;
  }

  /* ---------- import: the paste door and the review of rows ---------- */
  const modeSwitch = () => `<div class="i-switch"><button type="button" class="i-link" data-act="import-mode" data-mode="${S.importMode === "freeform" ? "file" : "freeform"}">${esc(t(S.importMode === "freeform" ? "entry.freeform.to_file" : "entry.import_source.to_freeform"))}</button><button type="button" class="i-link" data-act="switch-build">${esc(t("i.import.write_own"))}</button></div>`;
  function ffBody() {
    const ff = S.ff; const program = TS.freeform.program(ff);
    if (ff.status === "gaps" && ff.gap) {
      const g = ff.gap;
      const ni = g.notImported.length ? `<p class="i-note i-notice" role="status">${esc(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }))}</p>` : "";
      const err = ff.gapErrors.size ? `<p class="i-notice i-notice--err" role="alert" id="iGapError" tabindex="-1">${esc(t("entry.freeform.gap_error"))}</p>` : "";
      return `${ni}${err}<ol class="i-gaps">${g.gaps.map((gap) => { const bad = ff.gapErrors.has(gap.key); const lab = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` }); return `<li><label class="i-input i-input--pen${bad ? " is-bad" : ""}"><span class="i-input__l">${esc(lab)}</span><input type="text" inputmode="numeric" autocomplete="off" data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}"${bad ? ' aria-invalid="true"' : ""}>${bad ? `<span class="i-miss">${esc(t("entry.freeform.gap_error"))}</span>` : ""}</label></li>`; }).join("")}</ol>
        <div class="i-acts"><button type="button" class="i-btn i-btn--solid" data-act="ff" data-ff="gap-submit">${esc(t("entry.freeform.gaps_submit"))}</button><button type="button" class="i-btn i-btn--quiet" data-act="ff" data-ff="gap-back">${esc(t("entry.freeform.back_to_reply"))}</button></div>`;
    }
    const summary = ff.stage > 1 ? `<div class="i-srcrow"><span class="i-pen">${esc(t("entry.freeform.source_summary", { lines: TS.freeform.lines(ff) }))}</span><button type="button" class="i-btn i-btn--sm" data-act="ff" data-ff="edit-source">${esc(t("entry.freeform.edit_source"))}</button></div>` : "";
    const stages = `<ol class="i-steps" aria-hidden="true">${[1, 2, 3].map((n) => `<li class="${ff.stage === n ? "is-here" : ff.stage > n ? "is-done" : ""}">${n}</li>`).join("")}</ol>`;
    if (ff.stage === 1) return `${stages}<label class="i-sheet"><span class="i-group__l">${esc(t("entry.freeform.input_label"))}</span><textarea id="ffIn" rows="${compact() ? 6 : 8}" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(ff.input)}</textarea><span class="i-note" id="ffCount">${esc(t("entry.freeform.count", { n: TF.nf(lang, ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }))}</span></label>
        <p class="i-note" id="ffNeeds"${program ? " hidden" : ""}>${esc(t("entry.freeform.needs_input"))}</p>
        <p class="i-note i-privnote">${esc(t("entry.freeform.privacy"))}</p>
        <button type="button" class="i-btn i-btn--solid" data-act="ff" data-ff="continue"${program ? "" : " disabled"}>${esc(t("entry.freeform.continue"))}</button>`;
    const prompt = TF.freeformPrompt(t, program);
    if (ff.stage === 2) return `${stages}${summary}<h2 class="i-group__l">${esc(t("entry.freeform.stage2_title"))}</h2><p class="i-small">${esc(t("entry.freeform.stage2_hint"))}</p>
        <div class="i-acts i-acts--2"><a class="i-btn i-btn--solid" href="https://chatgpt.com/?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt">${esc(t("entry.freeform.open_chatgpt"))}</a><a class="i-btn i-btn--solid" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude">${esc(t("entry.freeform.open_claude"))}</a></div>
        <details class="i-corr"><summary class="i-corr__s"><span>${esc(t("entry.freeform.preview_prompt"))}</span>${SVG_CHEV}</summary><div class="i-corr__b"><pre class="i-pre">${esc(prompt)}</pre></div></details>
        <button type="button" class="i-btn i-btn--quiet" data-act="ff" data-ff="copy">${esc(t("entry.freeform.copy"))}</button>`;
    const unreadable = ff.status === "unreadable" ? `<div class="i-notice i-notice--err" role="alert"><strong>${esc(t("entry.freeform.unreadable_title"))}</strong><p>${esc(t("entry.freeform.unreadable_body"))}</p><div class="i-acts">${`<button type="button" class="i-btn" data-act="ff" data-ff="copy-repair">${esc(t("entry.freeform.copy_repair_prompt"))}</button>`}</div></div>` : "";
    const invalidated = ff.invalidated ? `<p class="i-notice" role="status">${esc(t("entry.freeform.edit_source_warning"))}</p>` : "";
    return `${stages}${summary}${invalidated}${unreadable}<h2 class="i-group__l">${esc(t("entry.freeform.stage3_title"))}</h2><p class="i-small">${esc(t("entry.freeform.stage3_hint"))}</p>
      <button type="button" class="i-btn i-btn--solid" data-act="ff" data-ff="clipboard">${esc(t("entry.freeform.clipboard_import"))}</button>
      <p class="i-or"><span>${esc(t("entry.freeform.clipboard_or"))}</span></p>
      <label class="i-sheet"><span class="visually-hidden">${esc(t("entry.freeform.stage3_title"))}</span><textarea id="ffOut" rows="${compact() ? 5 : 6}" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(ff.reply)}</textarea></label>
      <button type="button" class="i-btn" data-act="ff" data-ff="review">${esc(t("entry.freeform.review"))}</button>
      <div class="i-more"><button type="button" class="i-btn i-btn--quiet" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button><button type="button" class="i-link i-link--danger" data-act="ff" data-ff="start-over" aria-haspopup="dialog">${esc(t("entry.freeform.start_over"))}</button></div>`
      + (ff.confirmStartOver ? slip(`<h2 class="i-slip__t" id="ffRestartTitle" tabindex="-1">${esc(t("entry.freeform.confirm_start_over"))}</h2><div class="i-acts"><button type="button" class="i-btn i-btn--danger" data-act="ff" data-ff="start-over-confirm">${esc(t("x.ff.restart_confirm"))}</button><button type="button" class="i-btn" data-act="ff" data-ff="start-over-cancel">${esc(t("x.ff.restart_cancel"))}</button></div>`, { role: "alertdialog", label: "ffRestartTitle", attrs: 'data-confirm="ff-start-over"', scrimAct: "ff-scrim" }) : "");
  }
  function importRows(d) {
    const ordered = [...d.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
    return `<ol class="i-imp">${ordered.map((row) => {
      const proposed = !row.reviewed && row.match ? row.match : null; const shown = row.decision === "link" && row.match ? row.match : proposed;
      const target = shown ? TF.libraryName(shown, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
      const st = row.reviewed ? "confirmed" : row.status === "probable" ? "probable" : row.status;
      const badge = `<span class="impbadge i-mark i-mark--${st}${row.reviewed ? " is-done" : " is-open"}">${esc(t(`import.status.${st}`))}</span>`;
      const folded = row.reviewed && !row.expanded;
      const picks = !folded && row.shortlist.length ? row.shortlist.map((e, i) => `<button type="button" class="i-btn i-btn--sm${i === 0 ? " i-btn--solid" : ""}" data-act="imp" data-imp="pick" data-key="${row.key}" data-idx="${i}">${esc(t("import.action_link", { name: TF.libraryName(e, lang) }))}</button>`).join("") : (!folded && row.match && row.decision !== "link" ? `<button type="button" class="i-btn i-btn--sm i-btn--solid" data-act="imp" data-imp="link" data-key="${row.key}">${esc(t("import.action_link", { name: TF.libraryName(row.match, lang) }))}</button>` : "");
      const escapes = `<button type="button" class="i-btn i-btn--sm" data-act="imp" data-imp="choose" data-key="${row.key}">${esc(t("import.action_choose"))}</button>${row.decision !== "raw" || !row.reviewed ? `<button type="button" class="i-btn i-btn--sm" data-act="imp" data-imp="raw" data-key="${row.key}">${esc(t("import.action_keep"))}</button>` : ""}${row.decision !== "custom" ? `<button type="button" class="i-btn i-btn--sm" data-act="imp" data-imp="custom" data-key="${row.key}">${esc(t("import.action_custom"))}</button>` : ""}`;
      const acts = folded ? `<button type="button" class="i-link" data-act="imp" data-imp="expand" data-key="${row.key}">${esc(t("import.action_change"))}</button>` : picks ? `${picks}<details class="i-corr i-corr--in"><summary class="i-corr__s"><span>${esc(t("import.more_options"))}</span>${SVG_CHEV}</summary><div class="i-corr__b i-imp__acts">${escapes}</div></details>` : escapes;
      const picker = S.picker && S.picker.key === row.key ? `<div class="i-ts i-imp__picker">${TS.pickerBody(t, lang, S.picker.query, { limit: 6, all: true })}</div>` : "";
      const rx = row.raw.sets != null ? `${row.raw.sets} × ${row.raw.min ?? row.raw.repLow ?? ""}${(row.raw.max ?? row.raw.repHigh) != null && (row.raw.max ?? row.raw.repHigh) !== (row.raw.min ?? row.raw.repLow) ? "–" + (row.raw.max ?? row.raw.repHigh) : ""}` : "";
      return `<li class="improw i-imp__row${row.reviewed ? "" : " is-open"}" data-imp-row="${row.key}"><div class="i-imp__line"><p class="improw__from i-pen" data-user-text>${esc(row.raw.name || "")}${rx ? ` <span class="i-imp__rx">${esc(rx)}</span>` : ""}</p>${badge}</div><p class="improw__name i-imp__to">${esc(target)}</p><div class="i-imp__acts">${acts}</div>${picker}</li>`;
    }).join("")}</ol>`;
  }
  function importBody() {
    if (S.importDraft) {
      const d = S.importDraft; const c = TF.importCounts(d);
      return { body: `<h1 class="i-title" data-focus>${esc(t("import.heading"))}</h1><p class="i-lede">${esc(t("import.lede"))}</p><p class="i-note" data-user-text>${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</p>
        ${d.notImported.length ? `<p class="i-notice" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}
        <dl class="i-tally"><div><dt>${esc(t("import.count_linked"))}</dt><dd>${c.linked}</dd></div><div><dt>${esc(t("import.count_review"))}</dt><dd>${c.review}</dd></div><div><dt>${esc(t("import.count_custom"))}</dt><dd>${c.custom}</dd></div></dl>
        ${importRows(d)}
        ${d.originalText ? `<details class="i-corr"><summary class="i-corr__s"><span>${esc(t("entry.freeform.view_original"))}</span>${SVG_CHEV}</summary><div class="i-corr__b"><pre class="i-pre" data-user-text>${esc(d.originalText)}</pre></div></details>` : ""}
        <p class="i-note">${esc(t("import.safe"))}</p>${c.review && compact() ? `<p class="i-note i-reason" id="iImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}`,
        footer: `<footer class="i-stub" data-persistent-action>${c.review && !compact() ? `<p class="i-note i-reason" id="iImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}<button type="button" class="i-btn i-btn--solid" id="iImportCommit" data-act="import-commit"${c.review ? ' disabled aria-describedby="iImpReason"' : ""}>${esc(t("entry.preview.review"))}</button></footer>` };
    }
    const active = TF.hasActiveProgram() ? `<p class="i-note">${esc(t("entry.active_notice"))}</p>` : "";
    if (S.importMode === "freeform") {
      const gaps = S.ff.status === "gaps";
      return { body: `<h1 class="i-title" data-focus>${esc(t(gaps ? "i.ff.gaps_title" : "entry.freeform.title"))}</h1><p class="i-lede">${esc(t(gaps ? "i.ff.gaps_lede" : "entry.freeform.lede"))}</p>${active}<div class="i-ff">${ffBody()}</div>${gaps ? "" : modeSwitch()}`, footer: "" };
    }
    return { body: `<h1 class="i-title" data-focus>${esc(t("entry.import_source.title"))}</h1><p class="i-lede">${esc(t("entry.import_source.lede"))}</p>${active}<button type="button" class="i-btn i-btn--solid" data-act="import-file">${esc(t("entry.import_source.pick"))}</button><p class="i-note">${esc(t("x.cost.file"))}</p>${modeSwitch()}`, footer: "" };
  }
  function validationNotice() { return S.validation ? `<div class="i-notice i-notice--err" role="alert" tabindex="-1" id="iValidation"><strong>${esc(t("entry.validation.title"))}</strong><p>${esc(t("entry.validation.body"))}</p></div>` : ""; }
  function routeView() {
    const qs = QUESTIONS[S.route] || []; const qi = qs.indexOf(S.step);
    let body = "", footer = "";
    if (qi >= 0) {
      const h = stepHead(S.step); const pending = S.avoid.pending || S.pref.pending;
      const emptyPrio = !(S.answers.primaryMuscles || []).length && !(S.answers.priorityMovements || []).length && !(S.answers.exerciseConstraints || []).length && !S.avoid.pending;
      const skip = S.route === "recommend" && S.step === "priorities" && emptyPrio ? `<button type="button" class="i-link i-skip" data-act="skip">${esc(t("i.q.skip"))}</button>` : "";
      body = `<h1 class="i-title" data-focus>${esc(h.title)}</h1>${h.optional ? `<p class="i-opt-l">${esc(t("entry.optional"))}</p>` : ""}${h.lede ? `<p class="i-lede">${esc(h.lede)}</p>` : ""}${skip}${validationNotice()}${questionBody(S.step, S.answers)}`;
      const label = S.step === "custom_shape" ? t("entry.custom_shape.generate") : S.route === "recommend" && S.step === "priorities" ? t("i.q.show") : t("entry.next");
      footer = `<footer class="i-stub" data-persistent-action><button type="button" class="i-btn i-btn--solid" id="iNext" data-advance data-act="next"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(label)}</button></footer>`;
    } else if (S.step === "catalogue") body = catalogueBody();
    else if (S.step === "build_setup") { body = buildSetupBody(); footer = `<footer class="i-stub" data-persistent-action><button type="button" class="i-btn i-btn--solid" id="iNext" data-advance data-act="next">${esc(t("entry.build_setup.open"))}</button></footer>`; }
    else if (S.step === "import_source") { const r = importBody(); body = r.body; footer = r.footer; }
    else if ((S.route === "build" && S.step === "editor") || S.editing) { const e = editorParts(); body = e.body; footer = e.footer; }
    else if (reviewing()) { body = reviewBody(); if (S.result && !S.sheet) footer = activateStub({ ready: !TF.progressionIssue(S.result.preview), reasonId: "iBlocked" }); }
    const where = `<p class="i-where"><span>${esc(TS.routeName(t, S.route))}</span>${qi >= 0 ? `<span aria-live="polite">${esc(t("entry.step", { n: qi + 1, total: qs.length }))}</span>` : ""}</p>`;
    return `<div class="i-page i-route"><header class="i-bar"><button type="button" class="i-link i-bar__btn" data-act="back">${SVG_CHEV}${esc(t("entry.back"))}</button><button type="button" class="i-link i-bar__btn" data-act="cancel">${esc(t("entry.cancel"))}</button></header>
      ${reviewing() ? "" : where}${qi >= 0 ? cardHead() : ""}
      <main class="i-main${reviewing() ? " i-main--card" : ""}${S.stamping ? " is-stamping" : ""}" data-entry-step="${esc(S.step)}"${S.editing ? " data-editor" : ""} data-checkpoint="${esc(checkpointFor())}">${body}</main>${footer}</div>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return slip(`<h2 class="i-slip__t" id="cancelTitle" tabindex="-1">${esc(t("entry.cancel_confirm.title"))}</h2><p class="i-small" id="cancelBody">${esc(t("entry.cancel_confirm.body"))}</p><div class="i-acts"><button type="button" class="i-btn i-btn--solid" data-act="cancel-keep">${esc(t("i.cancel_keep"))}</button><button type="button" class="i-btn i-btn--danger" data-act="cancel-discard">${esc(t("entry.cancel_confirm.discard"))}</button><button type="button" class="i-btn i-btn--quiet" data-act="cancel-continue">${esc(t("entry.cancel_confirm.continue"))}</button></div>`, { label: "cancelTitle", desc: "cancelBody", attrs: 'data-checkpoint="cancel-confirm"', scrimAct: "cancel-continue" });
    if (S.overlay === "replace") { const current = TF.activeName(lang), next = name(); return slip(`<h2 class="i-slip__t" id="replTitle" tabindex="-1">${esc(t("x.replace.title"))}</h2><p class="i-small" id="replBody">${esc(t("x.replace.body", { current, next, n: TF.device.sessions }))}</p><div class="i-acts"><button type="button" class="i-btn i-btn--stamp" data-act="replace-confirm">${esc(t("x.replace.confirm", { next }))}</button><button type="button" class="i-btn" data-act="replace-cancel">${esc(t("x.replace.cancel", { current }))}</button></div>`, { label: "replTitle", desc: "replBody", attrs: 'data-checkpoint="replace-confirm"', scrimAct: "replace-cancel" }); }
    if (S.overlay === "restart") return slip(`<h2 class="i-slip__t" id="restartTitle" tabindex="-1">${esc(t("x.restart.title"))}</h2><p class="i-small" id="restartBody">${esc(t(S.route === "shared" ? "x.restart.body_shared" : "x.restart.body"))}</p><div class="i-acts"><button type="button" class="i-btn i-btn--danger" data-act="restart-confirm">${esc(t("x.restart.confirm"))}</button><button type="button" class="i-btn" data-act="restart-cancel">${esc(t("x.restart.cancel"))}</button></div>`, { role: "alertdialog", label: "restartTitle", desc: "restartBody", attrs: 'data-confirm="restart"', scrimAct: "restart-cancel" });
    if (S.overlay === "resume-discard") return slip(`<h2 class="i-slip__t" id="iDiscardTitle" tabindex="-1">${esc(t("i.resume.discard_title"))}</h2><p class="i-small" id="iDiscardBody">${esc(t("i.resume.discard_body"))}</p><div class="i-acts"><button type="button" class="i-btn i-btn--danger" data-act="resume-discard-confirm">${esc(t("i.resume.discard_confirm"))}</button><button type="button" class="i-btn" data-act="resume-discard-cancel">${esc(t("i.resume.discard_cancel"))}</button></div>`, { role: "alertdialog", label: "iDiscardTitle", desc: "iDiscardBody", attrs: 'data-confirm="discard-draft"', scrimAct: "resume-discard-cancel" });
    return "";
  }
  function todayView() {
    const h = S.handover;
    return `<div class="i-today${h ? " is-handed" : ""}">${h ? `<div class="i-handover" data-stock="${h.stock}">${stamp("i-stamp--on")}<p class="i-handover__t" role="status">${esc(t("x.activated"))}</p></div>` : ""}${TF.renderToday(t, lang)}</div>`;
  }
  function view() {
    if (S.view === "today") return todayView();
    if (S.view === "hub") return hubView() + overlayView();
    if (S.view === "route") return routeView() + overlayView() + (S.toast ? `<div class="i-toast" role="status">${esc(S.toast)}</div>` : "");
    return landingView();
  }
  function stockNow() {
    if (S.view === "today") return S.handover ? S.handover.stock : "yellow";
    if (S.view === "hub") return "kraft";
    if (S.view === "route") return S.route === "import" && S.importMode === "file" && !S.importDraft && S.step !== "preview" ? "blue2" : STOCK[S.route] || "yellow";
    if (S.view === "shared-gate") return "white";
    return "yellow";
  }
  const sel = (x) => (/^[#\[.]/.test(x) ? x : "#" + CSS.escape(x));
  function focusId(id) {
    const el = root.querySelector(sel(id)) || document.querySelector(sel(id));
    if (!el) { TS.focusHeading(root); return; }
    if (!el.matches("button,a,input,textarea,select,summary") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: false }); } catch (e) { /* ignore */ }
  }
  /* A re-render keeps focus on the same control (K-27). */
  const FOCUS_ATTRS = ["act", "key", "val", "chip", "step", "imp", "ff", "build", "day", "mode", "route", "q", "job", "goal", "provider", "status", "rx", "field", "id"];
  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = FOCUS_ATTRS.filter((a) => el.dataset && el.dataset[a] !== undefined).map((a) => `[data-${a}="${CSS.escape(el.dataset[a])}"]`);
    return parts.length ? parts.join("") : null;
  }
  function render(focus) {
    const act = document.activeElement; const key = focusKey(act); const typing = act && /^(INPUT|TEXTAREA)$/.test(act.tagName);
    document.documentElement.dataset.stock = stockNow();
    root.innerHTML = view();
    S.fresh = null; S.freshChips = null; S.freshField = null;
    if (typeof focus === "string") focusId(focus);
    else if (focus) { window.scrollTo(0, 0); TS.focusHeading(root); }
    else if (key) { const el = root.querySelector(key); if (el) { if (typing && el.id) TS.refocus(root, el.id); else try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  }
  function scrollToEl(el, pad = 12) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - pad)); }

  /* ---------- correcting an answer on the finished card ---------- */
  function openSheet(chip) {
    S.sheet = { kind: CHIP_STEP[chip], chip, answers: clone(S.answers), avoid: { query: "", pending: null }, pref: { query: "", pending: null }, error: null };
    render(); revealEditor();
  }
  function revealEditor() {
    const ed = root.querySelector("#iEdit"); if (!ed) return;
    const h = ed.querySelector("h2"); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    const ok = ed.querySelector('[data-act="sheet-apply"]'); const r = ed.getBoundingClientRect(); const o = ok.getBoundingClientRect();
    if (o.bottom - r.top + 24 <= window.innerHeight) scrollToEl(ed); else window.scrollTo(0, Math.max(0, o.bottom + window.scrollY - window.innerHeight + 16));
  }
  function closeSheet() { const chip = S.sheet && S.sheet.chip; S.sheet = null; render(chip ? `[data-chip="${chip}"]` : true); }
  function showChange() {
    const c = root.querySelector("#iChange"); if (!c) { TS.focusHeading(root); return; }
    const pin = root.querySelector("[data-persistent-action]"); const limit = pin ? pin.getBoundingClientRect().top + window.scrollY : Infinity;
    const bottomAtTop = c.getBoundingClientRect().bottom + window.scrollY;
    if (bottomAtTop <= Math.min(limit, window.innerHeight) - 8) window.scrollTo(0, 0); else scrollToEl(c, 16);
    try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function markFresh(before) { const after = fieldMap(); S.freshChips = new Set(Object.keys(after).filter((k) => after[k] !== before[k])); }
  function applySheet() {
    const sh = S.sheet; if (sh.avoid.pending || sh.pref.pending) return;
    const next = clone(sh.answers); if (S.route === "custom") ensureSplit(next);
    if (JSON.stringify(TF.normalizeAnswers(next)) === JSON.stringify(answers())) { closeSheet(); return; }
    const r = compileWith(TF.normalizeAnswers(next));
    if (!r.ok) { sh.error = r.text; render("iEditTitle"); return; }
    const before = fieldMap();
    S.changeFrom = { preview: S.result.preview, ctx: "i.change.answer" };
    S.answers = next; S.result = r.result; S.sheet = null; markFresh(before);
    render(); showChange();
  }
  function restore(id) {
    const next = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== id) };
    const r = compileWith(TF.normalizeAnswers(next)); if (!r.ok) { S.actError = r.text; render("iActError"); return; }
    const before = fieldMap();
    S.changeFrom = { preview: S.result.preview, ctx: "i.change.restore" }; S.answers = next; S.result = r.result; markFresh(before); render(); showChange();
  }

  /* ---------- actions ---------- */
  function onPick(d) {
    if (S.sheet) {
      const sh = S.sheet;
      if (d.key === "avoidReason") { sh.avoid.pending = null; sh.pref.pending = null; }
      sh.answers = TS.applyPick(sh.answers, d.key, d.val); sh.error = null; S.fresh = { key: d.key, val: d.val }; render(); return;
    }
    if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
    if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
    const before = sectionValue(S.step, S.answers);
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (d.key === "daysPerWeek" && S.route === "custom") delete S.answers.splitPreference;
    S.fresh = { key: d.key, val: d.val };
    if (sectionValue(S.step, S.answers) !== before) S.freshField = S.step;
    if (S.validation && !issues().length) S.validation = false;
    render();
  }
  function on(act, d, el) {
    S.cpTag = null;
    if (act !== "save-draft" && S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": S.view = "hub"; render(true); return;
      case "land-import": go("import", "freeform"); return;
      case "hub-back": S.help = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return;
      case "help-toggle": S.help = S.help ? null : { q1: null, q2: null }; render(S.help ? "#iHelp [data-q=\"q1\"]" : "iHelpToggle"); return;
      case "help-pick": S.help = d.q === "q1" ? { q1: d.val, q2: null } : { ...S.help, q2: d.val }; render(); return;
      case "help-go": go(d.job, d.job === "import" ? "freeform" : undefined); return;
      case "route": go(d.route, d.mode); return;
      case "start-rec": go("recommend", undefined, d.goal); return;
      case "pick": onPick(d); return;
      case "next": advance(); return;
      case "skip": skipPriorities(); return;
      case "back": back(); return;
      case "jump": jump(d.step); return;
      case "cancel": if (S.route === "shared") { toGate(); return; } S.overlay = "cancel"; render("cancelTitle"); return;
      case "cancel-continue": S.overlay = null; render('[data-act="cancel"]'); return;
      case "cancel-keep": keepDraft(); leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); leaveSetup(); return;
      case "resume": {
        const info = TF.loadDraft(); if (!info || !info.state) return; const st = info.state; const shared = S.shared;
        S = blank("route"); S.shared = shared; S.route = st.route; S.step = st.step; S.answers = clone(st.answers) || {}; S.result = st.result ? clone(st.result) : null; S.revAtStart = st.activeProgramRevisionAtStart;
        if (info.ui && info.ui.build) S.build = clone(info.ui.build); if (info.ui && info.ui.importMode) S.importMode = info.ui.importMode;
        if (S.route === "build" && S.step === "editor" && !S.build) S.build = TS.build.create(S.answers.programName || "", S.answers.daysPerWeek || 3);
        if (S.step === "result" && !S.result) compileFirst();
        if (S.step === "preview" && !S.result) S.step = STEPS[S.route][0];
        render(true); return;
      }
      case "resume-restart": S.overlay = "resume-discard"; render("iDiscardTitle"); return;
      case "resume-discard-cancel": S.overlay = null; render("iResumeRestart"); return;
      case "resume-discard-confirm": TF.clearDraft(); S.overlay = null; render(true); return;
      case "rules-rebuild": { const info = TF.loadDraft(); TF.clearDraft(); if (info && info.state && QUESTIONS[info.state.route]) { const st = info.state; S = blank("route"); S.route = st.route; S.step = QUESTIONS[st.route].includes(st.step) ? st.step : QUESTIONS[st.route][0]; S.answers = clone(st.answers) || {}; } render(true); return; }
      case "rules-keep": { const info = TF.loadDraft(); if (!info || !info.state) return; const st = info.state; TF.clearDraft(); S = blank("route"); S.route = st.route; S.step = "preview"; S.answers = clone(st.answers) || {}; S.result = clone(st.result); render(true); return; }
      case "avoid-add": if (S.sheet) { S.sheet.avoid.pending = d.id; S.sheet.avoid.query = ""; } else { S.avoid.pending = d.id; S.avoid.query = ""; } render(); return;
      case "avoid-remove": {
        const tgt = S.sheet ? S.sheet.answers : S.answers; tgt.exerciseConstraints = (tgt.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id);
        for (const st of S.sheet ? [S.sheet.avoid, S.sheet.pref] : [S.avoid, S.pref]) if (st.pending === d.id) st.pending = null;
        render(); return;
      }
      case "pref-add": { const tgt = S.sheet ? S.sheet.answers : S.answers; const st = S.sheet ? S.sheet.pref : S.pref; if (d.status === "include") tgt.mustHaveExercises = [...(tgt.mustHaveExercises || []), d.id]; else st.pending = d.id; st.query = ""; render(); return; }
      case "pref-remove": { const tgt = S.sheet ? S.sheet.answers : S.answers; tgt.mustHaveExercises = (tgt.mustHaveExercises || []).filter((x) => x !== d.id); tgt.exerciseConstraints = (tgt.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); render(); return; }
      case "field:avoidQuery": if (S.sheet) S.sheet.avoid.query = d.value; else S.avoid.query = d.value; render(); return;
      case "field:prefQuery": if (S.sheet) S.sheet.pref.query = d.value; else S.pref.query = d.value; render(); return;
      case "field:programName": S.answers.programName = d.value.trim(); if (S.validation && S.answers.programName) { const e = root.querySelector("#iNameErr"); if (e) e.remove(); } return;
      case "field:dayName": S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return;
      case "field:rx": case "change:rx": S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return;
      case "field:pickerQuery": if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return;
      case "build": S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(d.build === "open-picker" ? "pickerSearch" : undefined); return;
      case "pick-exercise": if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return;
      case "save-draft": keepDraft(); S.toast = t("entry.editor.saved"); render(); return;
      case "card": { const c = TF.browseCards(answers()).find((x) => x.id === d.id); if (!c) return; S.answers.catalogueSelection = c.id; S.card = c.id; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.step = "preview"; render(true); return; }
      case "import-mode": S.importMode = d.mode; S.importDraft = null; S.picker = null; render(true); return;
      case "switch-build": go("build"); return;
      case "import-file": S.importDraft = S.importHeld && S.importHeld.sourceType === "file" ? S.importHeld : TF.buildImportDraft(TF.F.importFile[lang], t("i.import.file_name"), "file"); S.importHeld = null; render(true); return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render("pickerSearch"); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return;
      case "import-commit": S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.step = "preview"; S.importDraft = null; S.picker = null; render(true); return;
      case "ff-scrim": on("ff", { ff: "start-over-cancel" }); return;
      case "ff": {
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
        else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); return; }
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...S.ff, status: null, parsed: null }; render(true); return; }
        const stageChange = ["continue", "open", "copy", "try-another", "gap-back", "start-over-confirm", "review", "gap-submit", "edit-source"].includes(d.ff);
        if (d.ff === "start-over") { render("ffRestartTitle"); return; }
        if (d.ff === "start-over-cancel") { render('[data-ff="start-over"]'); return; }
        if (d.ff === "gap-submit" && S.ff.gapErrors.size) { render("iGapError"); return; }
        render(stageChange ? true : undefined); return;
      }
      case "field:ffInput": {
        S.ff = TS.freeform.apply(S.ff, "input", d.value);
        const c = root.querySelector("#ffCount"); if (c) c.textContent = t("entry.freeform.count", { n: TF.nf(lang, S.ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) });
        const need = root.querySelector("#ffNeeds"); if (need) need.hidden = !!TS.freeform.program(S.ff);
        const b = root.querySelector('[data-ff="continue"]'); if (b) b.disabled = !TS.freeform.program(S.ff);
        const main = root.querySelector("main[data-checkpoint]"); if (main) main.dataset.checkpoint = checkpointFor();
        return;
      }
      case "field:ffReply": S.ff = TS.freeform.apply(S.ff, "reply", d.value); return;
      case "field:gap": S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return;
      case "shared-start": S.view = "route"; S.route = "shared"; S.step = "preview"; S.result = TF.sharedResult(S.shared); S.revAtStart = TF.liveRevision(); render(true); return;
      case "edit": S.build = TS.build.fromPreview(S.result.preview, { name: name() }); S.editing = true; S.sheet = null; render(true); return;
      case "edit-done": editDone(); return;
      case "activate": requestActivate(); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; render("iActivate"); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return;
      case "restart": S.overlay = "restart"; render("restartTitle"); return;
      case "restart-cancel": S.overlay = null; render("iRestart"); return;
      case "restart-confirm": { if (S.route === "shared") { S = blank("landing"); S.shared = null; render(true); return; } S = blank("hub"); S.stash = null; render(true); return; }
      case "chip": if (S.sheet && S.sheet.chip === d.chip) { closeSheet(); return; } openSheet(d.chip); return;
      case "sheet-close": closeSheet(); return;
      case "sheet-apply": applySheet(); return;
      case "restore": restore(d.id); return;
      default: return;
    }
  }
  function onKey(ev) {
    if (ev.key !== "Escape" || document.getElementById("tfPrivacy")) return;
    if (S.sheet) { closeSheet(); return; }
    if (S.overlay === "cancel") on("cancel-continue", {});
    else if (S.overlay === "replace") on("replace-cancel", {});
    else if (S.overlay === "restart") on("restart-cancel", {});
    else if (S.overlay === "resume-discard") on("resume-discard-cancel", {});
    else if (S.ff && S.ff.confirmStartOver) on("ff", { ff: "start-over-cancel" });
  }

  /* ---------- checkpoint reach (states built through the same model) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  const customA = () => TF.fixtureAnswers("custom");
  function at(route, step, a) { const shared = S.shared; S = blank("route"); S.shared = shared; S.route = route; S.step = step; S.answers = a; S.revAtStart = TF.liveRevision(); }
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("i.import.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  const pasteDecided = () => { const g = TF.parseFreeformReply(TF.F.freeform.replyGaps[lang]); let ff = ffAt(3, TF.F.freeform.replyGaps[lang]); for (const gap of g.gaps) ff = TS.freeform.apply(ff, "gap-input", { key: gap.key, value: gap.field === "reps" ? "10-12" : "3" }); ff = TS.freeform.apply(ff, "gap-submit"); return ff; };
  async function reach(cp) {
    const u = TF.F.users;
    const build = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [dd, id] of plan) { S.build.picker = dd; S.build = TS.build.apply(S.build, "add", id); } };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": S.view = "hub"; break;
      case "route-help": S.view = "hub"; S.help = { q1: "no", q2: null }; break;
      case "rec-goal": at("recommend", "desired_result", {}); break;
      case "rec-background": at("recommend", "background", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": at("recommend", "environment", rafael()); break;
      case "rec-env-correction": { const a = rafael(); a.environment = correctedEnv(); at("recommend", "environment", a); S.envOpen = true; break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", "priorities", a); break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); compileFirst(); if (cp === "replace-confirm") { S.overlay = "replace"; render("replTitle"); return; } break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); compileFirst(); const before = S.result.preview; const f0 = fieldMap(); S.answers = { ...S.answers, environment: correctedEnv() }; compileFirst(); S.changeFrom = { preview: before, ctx: "i.change.answer" }; markFresh(f0); S.cpTag = cp; break; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", "result", a); compileFirst(); S.cpTag = cp; break; }
      case "browse-filters": at("browse", "schedule", {}); break;
      case "browse-list": at("browse", "catalogue", TF.fixtureAnswers("browse")); break;
      case "browse-preview": at("browse", "catalogue", TF.fixtureAnswers("browse")); on("card", { id: "balanced_4_v1" }); return;
      case "custom-priorities": at("custom", "priorities", customA()); break;
      case "custom-exercises": at("custom", "exercise_preferences", customA()); break;
      case "custom-shape": at("custom", "custom_shape", ensureSplit(customA())); break;
      case "custom-result": at("custom", "result", ensureSplit(customA())); compileFirst(); break;
      case "build-setup": at("build", "build_setup", {}); break;
      case "build-empty": build([]); break;
      case "build-partial": build([["manual_d1", "pd_bw"]]); break;
      case "build-ready": build([["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]); break;
      case "ff-empty": at("import", "import_source", {}); S.importMode = "freeform"; break;
      case "ff-filled": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(1); break;
      case "ff-handoff": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(2); break;
      case "ff-reply": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3); break;
      case "ff-gaps": case "ff-gaps-invalid": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyGaps[lang]); if (cp === "ff-gaps-invalid") { const g = S.ff.gap.gaps; S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[0].key, value: "12-10" }); if (g[1]) S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[1].key, value: "abc" }); S.ff = TS.freeform.apply(S.ff, "gap-submit"); } break;
      case "ff-unreadable": at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyUnreadable[lang]); break;
      case "import-source": at("import", "import_source", {}); S.importMode = "file"; break;
      /* The core journey reaches import review and preview through the paste
         door (the gaps reply, completed with 10-12 and 3). */
      case "import-review": case "import-preview": {
        at("import", "import_source", {}); S.importMode = "freeform"; const ff = pasteDecided();
        S.importDraft = TF.buildImportDraft({ meta: ff.parsed.meta, exercises: ff.parsed.exercises, notImported: ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...ff, status: null, parsed: null };
        if (cp === "import-preview") { for (const r of S.importDraft.rows) if (!r.reviewed) S.importDraft = TS.importReview.apply(S.importDraft, r.shortlist.length ? "pick" : "raw", r.key, 0); on("import-commit", {}); return; }
        break;
      }
      case "shared-gate": case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; if (cp === "shared-preview" && r.ok) { on("shared-start", {}); return; } break; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "activation-conflict": at("recommend", "result", rafael()); compileFirst(); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; render("cancelTitle"); return;
      case "activated-today": { at("recommend", "result", rafael()); compileFirst(); TF.activate(stateFor("result")); S = blank("today"); S.handover = { stock: "yellow" }; break; }
      default: S.view = "landing";
    }
    render(true);
  }
  void importDecided;

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const advanceSel = "[data-advance]";
  async function recommendSections(api, a, { goal = true } = {}) {
    if (goal) { await api.tap(pickKey("desiredResult", a.desiredResult)); await api.tap(advanceSel); }
    await api.tap(pickKey("structuredExperience", a.structuredExperience)); await api.tap(pickKey("recentConsistency", a.recentConsistency)); await api.tap(advanceSel);
    await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap(pickKey("preferredRestSeconds", a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds)); await api.tap(advanceSel);
    await api.tap(pickKey("environment", a.environment.kind)); await api.tap(advanceSel);
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function addExercise(api, dayId, id) {
    await api.tap(`[data-build="open-picker"][data-day="${dayId}"]`);
    await api.type("#pickerSearch", TF.libraryName(TF.libraryEntry(id), api.lang));
    await api.tap(`[data-act="pick-exercise"][data-id="${id}"]`);
  }
  async function decideRows(api) { for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  async function removeTwo(api) { for (const dd of S.build.days.slice(0, 2)) await api.tap(`[data-build="remove"][data-id="${dd.exercises[0].id}"]`); }
  async function startRecommendFromHub(api) { await api.tap('[data-act="start-rec"][data-goal="muscle_growth"]'); }
  const HELP = { recommend: ["no", "recommend"], custom: ["no", "custom"], browse: ["no", "browse"], build: ["yes", "build"], import: ["yes", "import"] };
  const journeys = {
    async "activate.recommend"(api) {
      const a = TF.fixtureAnswers("rafael");
      await api.tap("#firstRunCreate"); await api.tap(`[data-act="start-rec"][data-goal="${a.desiredResult}"]`);
      await recommendSections(api, a, { goal: false });
      await api.tap(advanceSel);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.custom"(api) {
      const a = TF.fixtureAnswers("custom");
      await api.tap('[data-act="route"][data-route="custom"]');
      await recommendSections(api, a);
      await api.tap(pickKey("musclePriority", "chest|prioritize")); await api.tap(pickKey("musclePriority", "calves|deemphasize")); await api.tap(advanceSel);
      await api.type("#prefSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="pr_bb"][data-status="include"]');
      await api.type("#prefSearch", TF.libraryName(TF.libraryEntry("cu_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="cu_bb"][data-status="avoid"]');
      await api.tap(pickKey("avoidReason", "cu_bb|dislike")); await api.tap(advanceSel);
      await api.tap(advanceSel);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.browse"(api) {
      await api.tap('[data-act="route"][data-route="browse"]');
      await api.tap(pickKey("daysPerWeek", 4)); await api.tap(pickKey("sessionMinutes", 60)); await api.tap(advanceSel);
      await api.tap(pickKey("environment", "commercial_gym")); await api.tap(advanceSel);
      await api.tap('[data-act="card"][data-id="balanced_4_v1"]');
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.build"(api) {
      await api.tap('[data-act="route"][data-route="build"]');
      await api.type("#iBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(advanceSel);
      for (const [dd, ids] of [["manual_d1", ["sq_bb", "pr_bb"]], ["manual_d2", ["pd_bw", "rw_bb"]], ["manual_d3", ["sq_lp"]]]) for (const id of ids) await addExercise(api, dd, id);
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
    async "edit.remove-two.editor"(api) { api.snapshot("before"); await api.tap('[data-act="edit"]'); await removeTwo(api); await activateAndWait(api); },
    async "edit.remove-two.review"(api) { api.snapshot("before"); await api.tap('[data-act="edit"]'); await removeTwo(api); await api.tap('[data-act="edit-done"]'); api.snapshot("after"); await activateAndWait(api); },
    async "build.gating"(api) {
      await api.type("#iBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(advanceSel);
      api.snapshot("empty"); await addExercise(api, "manual_d1", "pd_bw"); api.snapshot("partial");
      await addExercise(api, "manual_d2", "rw_bb"); await addExercise(api, "manual_d3", "sq_lp"); api.snapshot("ready"); await activateAndWait(api);
    },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "cancel.keep-resume"(api) {
      await api.tap(pickKey("daysPerWeek", 4)); api.snapshot("before");
      await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); api.snapshot("kept");
      await api.tap("#firstRunCreate"); await api.tap('[data-act="resume"]'); api.snapshot("resumed");
    },
    async "back.recommend"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.custom"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.browse"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.import"(api) { await decideRows(api); api.snapshot("decided"); await api.tap('[data-act="import-commit"]'); api.snapshot("preview"); await api.tap('[data-act="back"]'); api.snapshot("back"); },
    async "back.shared"(api) { await api.tap('[data-act="back"]'); },
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.discard-draft"(api) { await api.tap('[data-act="cancel"]'); api.snapshot("asked"); await api.tap('button[data-act="cancel-discard"]'); api.snapshot("discarded"); },
    async "existing.back"(api) { await api.tap('[data-act="hub-back"]'); },
    async "existing.cancel-keep"(api) { await startRecommendFromHub(api); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await startRecommendFromHub(api); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async "avoid.pain"(api) {
      await api.tap(pickKey("primaryMuscles", "chest"));
      await api.type("#avoidSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]'); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned"); await api.tap(advanceSel); api.snapshot("review");
    },
    async overlays(api) {
      for (const c of chipList().map((x) => x.chip)) { await api.tap(`[data-chip="${c}"]`); await api.checkOverlay('[data-act="sheet-apply"]', c); await api.tap('button[data-act="sheet-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-chip="days"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="sheet-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      const c = TF.F.users.rafael.correction; const base = TF.env(c.environmentKind);
      api.mark("start"); await api.tap('[data-chip="env"]');
      await api.tap(pickKey("environment", c.environmentKind));
      for (const e of c.equipmentAdd) if (!base.equipment.includes(e)) await api.tap(pickKey("environmentEquipment", e));
      for (const k of c.capabilitiesAdd) if (!base.capabilities.includes(k)) await api.tap(pickKey("environmentCapabilities", k));
      await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await api.tap('[data-chip="prio"]');
      await api.type("#iSheetAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap(advanceSel);
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m")); await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most")); await api.tap(advanceSel);
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3)); await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60)); await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120)); await api.tap(advanceSel);
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap(advanceSel);
      await api.tap(advanceSel); api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, s] of [["recommend", '[data-act="start-rec"][data-goal="muscle_growth"]'], ["custom", '[data-act="route"][data-route="custom"]'], ["browse", '[data-act="route"][data-route="browse"]'], ["build", '[data-act="route"][data-route="build"]'], ["import", '[data-act="route"][data-route="import"][data-mode="file"]']]) {
        await api.tap(s); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
        if (job === "recommend") await api.tap('[data-act="back"]');
      }
    },
  };
  for (const job of Object.keys(HELP)) journeys[`help.${job}`] = async (api) => {
    const [q1, q2] = HELP[job];
    await api.tap('[data-act="help-toggle"]'); await api.tap(`[data-act="help-pick"][data-q="q1"][data-val="${q1}"]`); await api.tap(`[data-act="help-pick"][data-q="q2"][data-val="${q2}"]`);
    await api.tap('[data-act="help-go"]'); api.snapshot("end");
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.i = {
    id: "i", name: "I · Ficha", policy: { productDecisions: [] },
    thesis: "Setup is filling in your own printed training card: each answer is written on it in your pen, the review is the completed card, activation stamps it and hands it to Today.",
    axis: "Own visual world (the academy card: cardstock, one-colour print, the lifter's ballpoint, a rubber stamp); no product decision.",
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      fresh(c.seed); TS.wire(root, on);
      root.addEventListener("toggle", (ev) => { const el = ev.target; if (!el || el.tagName !== "DETAILS") return; if (el.dataset.role === "env-correction" && !S.sheet) { S.envOpen = el.open; const m = root.querySelector("main[data-checkpoint]"); if (m && S.route === "recommend" && S.step === "environment") { m.dataset.checkpoint = checkpointFor(); if (el.open) el.setAttribute("data-checkpoint", "rec-env-correction"); else el.removeAttribute("data-checkpoint"); } } }, true);
      document.addEventListener("keydown", onKey);
      render();
    },
    reach,
    entry() {
      if (!S || S.view !== "route" || !S.route) return null;
      let result = S.result;
      if (S.route === "build" && S.step === "editor" && S.build) result = TS.build.result(S.build);
      else if (S.editing && S.build && S.result) result = TS.build.commit(S.result, S.build);
      return TF.jsonClean({ route: S.route, step: S.step, answers: answers(), result: result || null });
    },
    journeys,
    state: () => S,
  };
})();
