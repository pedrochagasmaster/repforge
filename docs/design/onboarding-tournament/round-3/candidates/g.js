/* Candidate G · Síntese (Round 3, owner decisions Q622–Q637)
   The recommended synthesis of the Round 2 judging, built once and checked
   by the acceptance run only (Q626). Base: D's architecture (ROUTE_STEPS
   unchanged, program-first review on every route, D's import, dialog and
   conflict behaviour, one accent, helper at the top of the chooser, resume
   on the chooser, quiet Build link, Start-only shared gate).
   Grafts, each an owner decision:
   - Q627 (from F): the chooser's featured Recommend block is the goal
     question; Recommend then has four sections (about you: experience and
     consistency, with the carried goal; schedule; environment; optional
     priorities). Custom has six.
   - Q628: editable answer chips after the week (first day open, the other
     days collapsed), so the program stays first on every route.
   - Q629 (from E): answers are edited inline at every size; no sheets.
   - Q637 + F's O-5: after an apply, a before/after count with the identity
     statement; focus and scroll move to it; added exercises carry an accent
     edge and a "novo" tag.
   - Fixes: Skip only while the optional section is empty; focus stays on
     the chosen option after every answer; every dialog returns focus to its
     opener; "salvar", never "guardar".
   Product policy: no product decision (PD-1 to PD-4 closed, Q622–Q624);
   minutes and rest are asked; no program before the answers. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "g.name": "G · Síntese",
      "g.hub.lede_first": "Responder à primeira pergunta já começa a recomendação.",
      "g.rec.eyebrow": "Recomendar um programa",
      "g.rec.facts": "São {n} seções curtas e esta é a primeira pergunta. O Taurifer escolhe a estrutura.",
      "g.hub.others": "Outros caminhos",
      "g.about.title": "Seu objetivo e seu treino recente",
      "g.about.lede": "O objetivo define a estrutura. O treino recente define como começam as primeiras semanas.",
      "g.about.goal": "Objetivo",
      "g.about.goal_change": "Alterar o objetivo",
      "g.chips.label": "Montado com suas respostas",
      "g.chips.hint": "Toque em uma resposta para mudá-la. O programa é refeito aqui mesmo.",
      "g.chip.aria": "Alterar {what}: {value}",
      "g.chip.goal.muscle_growth": "Ganho de massa", "g.chip.goal.balanced": "Massa e força", "g.chip.goal.strength": "Força",
      "g.chip.cons.most": "Fez a maior parte das sessões", "g.chip.cons.about_half": "Fez cerca de metade das sessões", "g.chip.cons.few": "Fez poucas sessões", "g.chip.cons.none": "Sem treino recente",
      "g.chip.days": "{n} dias por semana", "g.chip.minutes": "Até {n} min por sessão", "g.chip.minutes_90": "90 min ou mais por sessão",
      "g.chip.rest.auto": "Descanso: o Taurifer escolhe", "g.chip.rest.60": "Descanso de 60 s", "g.chip.rest.90": "Descanso de 90 s", "g.chip.rest.120": "Descanso de 2 min", "g.chip.rest.180": "Descanso de 3 min ou mais",
      "g.chip.env_adjusted": "{env}, com ajustes",
      "g.chip.prio_none": "Sem prioridade", "g.chip.prio": "Prioriza {list}", "g.chip.avoid": "Evita {list}", "g.chip.include": "Inclui {list}",
      "g.chip.emph_none": "Ênfase normal em todos os músculos", "g.chip.emph": "Ênfase: {list}", "g.chip.shape": "Estrutura: {name}", "g.chip.prefs_none": "Sem preferência de exercícios",
      "g.what.goal": "objetivo", "g.what.exp": "tempo com programas", "g.what.cons": "últimas seis semanas", "g.what.days": "dias por semana", "g.what.minutes": "duração da sessão", "g.what.rest": "descanso", "g.what.env": "onde você treina", "g.what.prio": "prioridades", "g.what.avoid": "exercícios evitados", "g.what.emph": "ênfase muscular", "g.what.prefs": "preferências de exercícios", "g.what.shape": "estrutura semanal",
      "g.edit.keep": "Manter como estava",
      "g.change.before": "Antes", "g.change.after": "Agora", "g.change.without": "Sem evitar", "g.change.with": "Evitando",
      "g.change.facts": "{ex} · {sets}",
      "g.rev.new": "novo",
      "g.hub.lede_existing": "Escolha como montar o próximo programa.",
      "g.hub.ask": "Você faz",
      "g.hub.get": "Você recebe",
      "g.get.recommend": "Um programa completo e editável. O Taurifer escolhe a estrutura.",
      "g.get.custom": "Você escolhe ênfase e exercícios. O Taurifer escreve o programa.",
      "g.help.toggle": "Não sabe qual escolher?",
      "g.help.q1": "Você já tem um programa que quer seguir?",
      "g.help.q1.yes": "Sim, já tenho",
      "g.help.q1.no": "Não, preciso de um",
      "g.help.q2_no": "O que você prefere?",
      "g.help.q2.recommend": "Que o Taurifer decida por mim",
      "g.help.q2.custom": "Escolher músculos e exercícios",
      "g.help.q2.browse": "Escolher entre programas prontos",
      "g.help.q2_yes": "Como você quer trazê-lo?",
      "g.help.q2.import": "Colar o texto ou importar um arquivo",
      "g.help.q2.build": "Digitar cada exercício",
      "g.help.go": "Seguir com {route}",
      "g.resume.at": "{route} · {step} · salvo em {when}",
      "g.resume.discard_title": "Descartar a configuração salva?",
      "g.resume.discard_body": "As respostas salvas neste dispositivo serão apagadas. O que já está ativo não muda.",
      "g.resume.discard_confirm": "Descartar e começar de novo",
      "g.resume.discard_cancel": "Manter a configuração salva",
      "g.q.missing": "Escolha uma opção.",
      "g.q.priorities_lede": "Sem escolhas aqui, o Taurifer monta o programa só com as respostas anteriores.",
      "g.q.skip": "Pular esta seção",
      "g.q.show": "Mostrar meu programa",
      "g.q.none_limit": "Você já escolheu dois músculos. Desmarque um para trocar.",
      "g.unit.min": "minutos",
      "g.rail": "Suas respostas",
      "g.rail.edit": "Alterar {what}",
      "g.rail.schedule": "{days} dias · até {minutes} min",
      "g.rev.built_from": "Montado com",
      "g.rev.built_from_hint": "Altere uma resposta e o programa é refeito aqui mesmo.",
      "g.rev.adjusted": "O que o Taurifer ajustou",
      "g.rev.constraints": "Suas restrições",
      "g.rev.restore": "Restaurar",
      "g.rev.restore_aria": "Restaurar {exercise}",
      "g.rev.more": "Mais opções",
      "g.fact.goal": "Objetivo",
      "g.fact.background": "Histórico de treino",
      "g.fact.schedule": "Agenda",
      "g.fact.environment": "Onde você treina",
      "g.fact.priorities": "Prioridades e restrições",
      "g.fact.emphasis": "Ênfase muscular",
      "g.fact.exercises": "Preferências de exercícios",
      "g.fact.shape": "Estrutura semanal",
      "g.fact.change_aria": "Alterar {fact}",
      "g.fact.schedule_value": "{days} dias · até {minutes} min · descanso: {rest}",
      "g.fact.minutes_90": "90 ou mais",
      "g.fact.rest_auto": "o Taurifer escolhe",
      "g.fact.env_value": "{kind}: {equipment}",
      "g.sheet.apply": "Atualizar programa",
      "g.change.answer": "Resposta alterada.",
      "g.change.answers": "Respostas alteradas.",
      "g.change.restore": "Restrição removida.",
      "g.change.constraints": "Restrições aplicadas.",
      "g.change.edit": "Edição aplicada.",
      "g.edit.lede": "Remova exercícios ou ajuste séries e repetições. As mudanças valem só para este programa ainda não usado.",
      "g.edit.done": "Voltar ao programa",
      "g.build.days_caption": "{n} dias de treino",
      "g.import.write_own": "Prefiro escrever do zero",
      "g.import.file_name": "Treino do Rafael.json",
      "g.ff.gaps_title": "Complete o que falta",
      "g.ff.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições. Preencha os campos abaixo.",
      "g.catalogue.change_aria": "Alterar dias, tempo e local",
      "g.gate.what": "O que chega",
      "g.rev.error_title": "Não foi possível montar o programa",
      "g.facts.days": "dias de treino", "g.facts.day_one": "dia de treino", "g.facts.minutes": "min por sessão", "g.facts.sets": "séries de trabalho",
    },
    en: {
      "g.name": "G · Synthesis",
      "g.hub.lede_first": "Answering the first question starts the recommendation.",
      "g.rec.eyebrow": "Recommend a program",
      "g.rec.facts": "{n} short sections, starting with this question. Taurifer chooses the structure.",
      "g.hub.others": "Other ways",
      "g.about.title": "Your goal and recent training",
      "g.about.lede": "Your goal sets the structure. Your recent training sets how the first weeks start.",
      "g.about.goal": "Goal",
      "g.about.goal_change": "Change the goal",
      "g.chips.label": "Built from your answers",
      "g.chips.hint": "Tap an answer to change it. The program is rebuilt right here.",
      "g.chip.aria": "Change {what}: {value}",
      "g.chip.goal.muscle_growth": "Muscle growth", "g.chip.goal.balanced": "Muscle and strength", "g.chip.goal.strength": "Strength",
      "g.chip.cons.most": "Did most sessions", "g.chip.cons.about_half": "Did about half the sessions", "g.chip.cons.few": "Did only a few sessions", "g.chip.cons.none": "No recent training",
      "g.chip.days": "{n} days a week", "g.chip.minutes": "Up to {n} min a session", "g.chip.minutes_90": "90 min or more a session",
      "g.chip.rest.auto": "Rest: Taurifer chooses", "g.chip.rest.60": "60 s rest", "g.chip.rest.90": "90 s rest", "g.chip.rest.120": "2 min rest", "g.chip.rest.180": "3 min rest or more",
      "g.chip.env_adjusted": "{env}, adjusted",
      "g.chip.prio_none": "No priority", "g.chip.prio": "Prioritizes {list}", "g.chip.avoid": "Avoids {list}", "g.chip.include": "Includes {list}",
      "g.chip.emph_none": "Normal emphasis on every muscle", "g.chip.emph": "Emphasis: {list}", "g.chip.shape": "Structure: {name}", "g.chip.prefs_none": "No exercise preferences",
      "g.what.goal": "goal", "g.what.exp": "time on programs", "g.what.cons": "past six weeks", "g.what.days": "days per week", "g.what.minutes": "session length", "g.what.rest": "rest", "g.what.env": "where you train", "g.what.prio": "priorities", "g.what.avoid": "avoided exercises", "g.what.emph": "muscle emphasis", "g.what.prefs": "exercise preferences", "g.what.shape": "weekly structure",
      "g.edit.keep": "Keep as it was",
      "g.change.before": "Before", "g.change.after": "Now", "g.change.without": "Without avoiding", "g.change.with": "Avoiding",
      "g.change.facts": "{ex} · {sets}",
      "g.rev.new": "new",
      "g.hub.lede_existing": "Choose how to set up your next program.",
      "g.hub.ask": "You do",
      "g.hub.get": "You get",
      "g.get.recommend": "A complete, editable program. Taurifer chooses the structure.",
      "g.get.custom": "You choose emphasis and exercises. Taurifer writes the program.",
      "g.help.toggle": "Not sure which one?",
      "g.help.q1": "Do you already have a program you want to follow?",
      "g.help.q1.yes": "Yes, I have one",
      "g.help.q1.no": "No, I need one",
      "g.help.q2_no": "What would you rather do?",
      "g.help.q2.recommend": "Let Taurifer decide for me",
      "g.help.q2.custom": "Choose muscles and exercises",
      "g.help.q2.browse": "Pick from ready-made programs",
      "g.help.q2_yes": "How do you want to bring it in?",
      "g.help.q2.import": "Paste the text or import a file",
      "g.help.q2.build": "Type each exercise",
      "g.help.go": "Continue with {route}",
      "g.resume.at": "{route} · {step} · saved {when}",
      "g.resume.discard_title": "Discard the saved setup?",
      "g.resume.discard_body": "The answers kept on this device will be deleted. Nothing that is already active changes.",
      "g.resume.discard_confirm": "Discard and start over",
      "g.resume.discard_cancel": "Keep the saved setup",
      "g.q.missing": "Choose one option.",
      "g.q.priorities_lede": "With nothing chosen here, Taurifer builds the program from your earlier answers alone.",
      "g.q.skip": "Skip this section",
      "g.q.show": "Show my program",
      "g.q.none_limit": "You already chose two muscles. Clear one to switch.",
      "g.unit.min": "minutes",
      "g.rail": "Your answers",
      "g.rail.edit": "Change {what}",
      "g.rail.schedule": "{days} days · up to {minutes} min",
      "g.rev.built_from": "Built from",
      "g.rev.built_from_hint": "Change an answer and the program is rebuilt right here.",
      "g.rev.adjusted": "What Taurifer adjusted",
      "g.rev.constraints": "Your constraints",
      "g.rev.restore": "Restore",
      "g.rev.restore_aria": "Restore {exercise}",
      "g.rev.more": "More options",
      "g.fact.goal": "Goal",
      "g.fact.background": "Training background",
      "g.fact.schedule": "Schedule",
      "g.fact.environment": "Where you train",
      "g.fact.priorities": "Priorities and constraints",
      "g.fact.emphasis": "Muscle emphasis",
      "g.fact.exercises": "Exercise preferences",
      "g.fact.shape": "Weekly structure",
      "g.fact.change_aria": "Change {fact}",
      "g.fact.schedule_value": "{days} days · up to {minutes} min · rest: {rest}",
      "g.fact.minutes_90": "90 or more",
      "g.fact.rest_auto": "Taurifer chooses",
      "g.fact.env_value": "{kind}: {equipment}",
      "g.sheet.apply": "Update program",
      "g.change.answer": "Answer changed.",
      "g.change.answers": "Answers changed.",
      "g.change.restore": "Constraint removed.",
      "g.change.constraints": "Constraints applied.",
      "g.change.edit": "Edits applied.",
      "g.edit.lede": "Remove exercises or adjust sets and reps. Changes apply only to this unused program.",
      "g.edit.done": "Back to the program",
      "g.build.days_caption": "{n} training days",
      "g.import.write_own": "I'd rather write it from scratch",
      "g.import.file_name": "Rafael's program.json",
      "g.ff.gaps_title": "Fill in what is missing",
      "g.ff.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing. Fill in the fields below.",
      "g.catalogue.change_aria": "Change days, time and place",
      "g.gate.what": "What arrives",
      "g.rev.error_title": "The program could not be built",
      "g.facts.days": "training days", "g.facts.day_one": "training day", "g.facts.minutes": "min a session", "g.facts.sets": "working sets",
    },
  };
  const STEPS = TF.Entry.ROUTE_STEPS;
  /* Q627: "about" is one screen for desired_result + background. */
  const QUESTIONS = { recommend: ["about", "schedule", "environment", "priorities"], custom: ["about", "schedule", "environment", "priorities", "exercise_preferences", "custom_shape"], browse: ["schedule", "environment"] };
  const REVIEW = { recommend: "result", custom: "result", browse: "preview", import: "preview", shared: "preview", build: "editor" };
  /* The production step of the visible screen (JOURNEYS.md entry()). */
  const entryStep = () => (S.step === "about" ? (S.answers.desiredResult ? "background" : "desired_result") : S.step);
  const screenOf = (route, step) => ((route === "recommend" || route === "custom") && (step === "desired_result" || step === "background") ? "about" : step);
  const CODE_KEY = { desired_result_required: "desiredResult", structured_experience_required: "structuredExperience", recent_consistency_required: "recentConsistency", days_per_week_required: "daysPerWeek", session_minutes_required: "sessionMinutes", preferred_rest_required: "preferredRestSeconds", environment_required: "environment", program_name_required: "programName", split_preference_required: "splitPreference" };
  const ICON = { recommend: "wand", custom: "sliders", browse: "search", build: "pencil", freeform: "clipboard", file: "download" };
  let t, lang, root, S;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  /* L-1: at 200% text or on a narrow phone only the primary stays pinned. */
  const compact = () => document.documentElement.style.fontSize === "200%" || window.innerWidth < 360;

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, step: null, answers: {}, result: null, card: null, changeFrom: null, lastPreview: null, validation: false, build: null, editing: false, importMode: "freeform", importDraft: null, importKept: null, importHeld: null, ff: TS.freeform.create(), picker: null, own: false, help: null, envOpen: false, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, sheet: null, goalOpen: false, overlay: null, overlayReturn: null, notice: null, actError: null, toast: null, revAtStart: TF.liveRevision(), shared: S ? S.shared : null, sharedError: null, cpTag: null, stash: S ? S.stash : null };
  }
  function fresh(seed) { S = null; TF.seedDevice(seed || "fresh"); S = blank(TF.hasActiveProgram() ? "today" : "landing"); }
  const answers = () => TF.normalizeAnswers(S.answers);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const name = () => TF.resultName(S.result, lang) || S.answers.programName || t("untitled_program");
  const generated = () => S.route === "recommend" || S.route === "custom";
  const reviewing = () => !!S.route && S.step === REVIEW[S.route] && S.route !== "build";
  const mode = () => (S.route === "custom" ? "custom" : "recommend");
  function issues() {
    const qs = QUESTIONS[S.route] || [];
    if (!qs.includes(S.step) && S.step !== "build_setup") return [];
    const v = (step) => { try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: answers(), step })); } catch (e) { return ["state_invalid"]; } };
    return S.step === "about" ? [...v("desired_result"), ...v("background")] : v(S.step);
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
  /* The first result of a walk: a change statement only when it is true and
     meaningful (answers changed since the last result, or constraints were
     applied, stated against the program without them). */
  function compileFirst() {
    const r = compileWith(answers());
    S.result = r.ok ? r.result : null; S.compileError = r.ok ? null : r.text; S.changeFrom = null;
    if (!r.ok) return;
    if (S.lastPreview && TF.identityDiff(S.lastPreview, S.result.preview).n > 0) S.changeFrom = { preview: S.lastPreview, ctx: "g.change.answers" };
    else if ((S.answers.exerciseConstraints || []).length) { const w = compileWith({ ...answers(), exerciseConstraints: [] }); if (w.ok) S.changeFrom = { preview: w.result.preview, ctx: "g.change.constraints" }; }
    S.lastPreview = null;
  }
  function stateFor(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step: step === "about" ? entryStep() : step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    const ui = TF.jsonClean({ build: S.build || null, importMode: S.importMode, editing: false });
    const step = S.route === "build" && S.step === "editor" ? "editor" : S.step;
    let r = { ok: false };
    try { r = TF.saveDraft(stateFor(step), { ui }); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { r = TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step: step === "about" ? entryStep() : step, activeProgramRevisionAtStart: S.revAtStart }), { ui }); } catch (e) { r = { ok: false }; } }
    if (!r.ok) { try { TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step: STEPS[S.route][0], activeProgramRevisionAtStart: S.revAtStart }), { ui }); } catch (e) { /* nothing kept */ } }
  }
  function leaveSetup() { const active = TF.hasActiveProgram(); S = blank(active ? "today" : "landing"); S.shared = null; render(true); }

  /* ---------- navigation ---------- */
  function go(route, importMode, goal) {
    const prev = S.answers || {}; const own = S.own; const stash = S.stash;
    S = blank("route"); S.own = own; S.route = route; S.step = QUESTIONS[route] && route !== "browse" ? QUESTIONS[route][0] : STEPS[route][0];
    if (goal && (route === "recommend" || route === "custom")) S.answers.desiredResult = goal;
    if (stash && stash.route === route) S.answers = clone(stash.answers);
    if (route === "browse") for (const k of ["daysPerWeek", "sessionMinutes", "environment"]) if (prev[k] != null && !has(S.answers, k)) S.answers[k] = clone(prev[k]);
    if (route === "import") S.importMode = importMode || "file";
    S.stash = null;
    render(true);
  }
  function toHub() { S.stash = S.route && QUESTIONS[S.route] ? { route: S.route, answers: clone(S.answers) } : null; S.view = "hub"; S.route = null; S.step = null; S.result = null; S.validation = false; render(true); }
  function toGate() { const shared = S.shared; S = blank("shared-gate"); S.shared = shared; render(true); }
  function advance() {
    if (S.avoid.pending || S.pref.pending) return;
    if (issues().length) { S.validation = true; render("dValidation"); return; }
    S.validation = false;
    if (S.step === "build_setup") {
      if (!S.build || S.build.days.length !== S.answers.daysPerWeek) S.build = TS.build.create(S.answers.programName || "", S.answers.daysPerWeek);
      else S.build = { ...S.build, name: S.answers.programName || "" };
      S.step = "editor"; render(true); return;
    }
    const screens = S.route === "recommend" || S.route === "custom" ? [...QUESTIONS[S.route], "result"] : STEPS[S.route];
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
    if (generated() && S.step === "result") { S.lastPreview = S.result ? S.result.preview : null; S.result = null; S.changeFrom = null; }
    const steps = S.route === "recommend" || S.route === "custom" ? [...QUESTIONS[S.route], "result"] : STEPS[S.route]; const i = steps.indexOf(S.step);
    if (i <= 0) { toHub(); return; }
    let prev = steps[i - 1]; if (prev === "result") prev = steps[i - 2];
    S.step = prev; S.validation = false; S.avoid.pending = null; S.pref.pending = null; render(true);
  }
  function jump(step) { if (S.step === "result") { S.lastPreview = S.result ? S.result.preview : null; S.result = null; S.changeFrom = null; } S.step = step; S.validation = false; render(true); }
  function editDone() {
    const before = S.result.preview;
    S.result = TS.build.commit(S.result, S.build); S.editing = false; S.build = null;
    S.changeFrom = { preview: before, ctx: "g.change.edit" };
    render(); showChange();
  }
  function activateNow() {
    S.actError = null;
    if (S.editing && S.build) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : generated() ? "result" : "preview";
    let r;
    try { r = TF.activate(stateFor(step)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { const toast = t("x.activated"); S = blank("today"); S.shared = null; S.toast = toast; render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render("dConflictBox"); return; }
    S.actError = TS.issueText(t, r, { preview: S.result && S.result.preview }); render("dActError");
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; S.overlayReturn = "dActivate"; render("replTitle"); } else activateNow(); }

  /* ---------- small builders ---------- */
  const choice = (o) => TS.choice(o);
  function group(id, label, inner, { role = "radiogroup", key, hint, cls = "" } = {}) {
    const miss = key && missingKeys().has(key);
    return `<section class="g-group ${cls}" role="${role}" aria-labelledby="${id}"${miss ? ` aria-describedby="${id}Err"` : ""}><header class="g-group__head"><p class="g-group__label" id="${id}">${esc(label)}</p>${hint ? `<p class="t-caption g-group__hint">${esc(hint)}</p>` : ""}${miss ? `<p class="field__error g-missing" id="${id}Err">${esc(t("g.q.missing"))}</p>` : ""}</header>${inner}</section>`;
  }
  const numGrid = (key, values, sel, unit) => `<div class="g-num">${values.map((n) => choice({ key, val: n, title: n === 90 && key === "sessionMinutes" ? "90+" : String(n), cap: unit, selected: sel === n, cls: "choice--seg g-num__opt" })).join("")}</div>`;
  const restSelected = (a, v) => has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : v !== "auto" && +v === a.preferredRestSeconds);
  const restText = (a) => (a.preferredRestSeconds === null ? t("g.fact.rest_auto") : lcFirst(t(`entry.schedule.rest.${a.preferredRestSeconds}`)));
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };

  /* Question bodies, shared by the section steps and the review's sheets.
     a: answers; o: { sheet, route } */
  function questionBody(step, a, o = {}) {
    const route = o.route || S.route; const p = o.sheet ? "s" : "q";
    if (step === "about") {
      const goal = !a.desiredResult || S.goalOpen
        ? questionBody("desired_result", a, o)
        : `<div class="g-carried"><div class="g-carried__text"><span class="t-label">${esc(t("g.about.goal"))}</span><span class="g-carried__v">${esc(t(`entry.desired_result.${a.desiredResult}.label`))}</span></div><button type="button" class="btn btn--sm" data-act="goal-edit" aria-label="${esc(t("g.about.goal_change"))}">${esc(t("x.change"))}</button></div>`;
      return goal + questionBody("background", a, o);
    }
    if (step === "desired_result") return group(`${p}Goal`, t("entry.desired_result.lede"), `<div class="stack stack--tight">${TS.DESIRED.map((v) => choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v, icon: TS.DESIRED_ICON[v] })).join("")}</div>`, { key: "desiredResult" });
    if (step === "background") return group(`${p}Exp`, t("entry.background.experience.label"), `<div class="stack stack--tight">${TS.EXPERIENCE.map((v) => choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "choice--compact" })).join("")}</div>`, { key: "structuredExperience" })
      + group(`${p}Cons`, t("entry.background.consistency.label"), `<div class="stack stack--tight">${TS.CONSISTENCY.map((v) => choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`, { key: "recentConsistency" });
    if (step === "schedule") {
      const days = group(`${p}Days`, t("entry.schedule.days.label"), numGrid("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek" });
      const mins = group(`${p}Min`, t("entry.schedule.minutes.label"), numGrid("sessionMinutes", TS.MINUTES, a.sessionMinutes, t("g.unit.min")), { key: "sessionMinutes" });
      const rest = route === "browse" ? "" : group(`${p}Rest`, t("entry.schedule.rest.label"), `<div class="stack stack--tight">${TS.REST.map((v) => choice({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: restSelected(a, v), cls: "choice--compact" })).join("")}</div>`, { key: "preferredRestSeconds" });
      return days + mins + rest;
    }
    if (step === "environment") {
      const open = o.sheet ? true : S.envOpen;
      const corr = a.environment ? `<div class="g-corr"${open && (o.sheet || route !== "browse") ? ' data-checkpoint="rec-env-correction"' : ""}>${TS.environmentCorrection(t, a.environment, { open })}</div>` : "";
      return group(`${p}Env`, t("entry.environment.lede"), `<div class="stack stack--tight">${TS.ENVS.map((v) => choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment && a.environment.kind === v, icon: TS.ENV_ICON[v], cls: "choice--compact" })).join("")}</div>`, { key: "environment" }) + corr;
    }
    if (step === "priorities" && route === "custom") return `<p class="t-caption">${esc(t("entry.priorities.state_hint"))}</p>` + TS.muscleEmphasis(t, a);
    if (step === "priorities") {
      const prim = a.primaryMuscles || []; const st = o.sheet ? S.sheet.avoid : S.avoid;
      return group(`${p}Prim`, t("entry.priorities.primary"), `<div class="stack stack--tight">${choice({ key: "clearPriorities", val: "1", title: t("entry.priorities.none"), selected: prim.length === 0, cls: "choice--compact" })}<div class="grid-2 g-muscles">${TS.MUSCLES.map((m) => choice({ key: "primaryMuscles", val: m, title: t(`entry.muscle.${m}`), selected: prim.includes(m), role: "checkbox", cls: "choice--compact", disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div><p class="t-caption">${esc(t(prim.length >= 2 ? "g.q.none_limit" : "entry.priorities.lede"))}</p></div>`, { role: "group" })
        + group(`${p}Mov`, t("entry.priorities.movements"), `<div class="stack stack--tight">${TS.MOVEMENTS.map((m) => choice({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (a.priorityMovements || []).includes(m), role: "checkbox", cls: "choice--compact" })).join("")}</div>`, { role: "group" })
        + `<section class="g-group" aria-labelledby="${p}Avoid"><header class="g-group__head"><p class="g-group__label" id="${p}Avoid">${esc(t("entry.priorities.avoid"))}</p></header>${TS.avoidSection(t, lang, { query: st.query, pending: st.pending, constraints: a.exerciseConstraints || [] }, { searchId: o.sheet ? "dSheetAvoid" : "avoidSearch" })}</section>`;
    }
    if (step === "exercise_preferences") { const st = o.sheet ? S.sheet.pref : S.pref; return TS.exercisePrefs(t, lang, { query: st.query, pending: st.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] }); }
    if (step === "custom_shape") {
      const c = TF.splitChoices(TF.normalizeAnswers(a)).choices || [];
      if (!c.length) return `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p></div>`;
      return `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t("entry.custom_shape.split"))}">${c.map((x) => { const est = (x.days || []).map((d) => d.estimateMinutes).filter(Number.isFinite); return choice({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt || x.name : x.name, days: x.frequency }), cap: `${c.length === 1 ? "" : t(x.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason")} ${est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""}`.trim(), selected: a.splitPreference === x.id }); }).join("")}</div>`;
    }
    return "";
  }
  const STEP_TITLE = { desired_result: "entry.desired_result.title", background: "entry.background.title", schedule: "entry.schedule.title", environment: "entry.environment.title", exercise_preferences: "entry.exercise_preferences.title" };
  function stepHead(step) {
    if (step === "priorities" && S.route === "custom") return { title: t("entry.priorities.custom_title"), lede: t("entry.priorities.custom_lede") };
    if (step === "priorities") return { title: t("entry.priorities.title"), lede: t("g.q.priorities_lede"), optional: true };
    if (step === "exercise_preferences") return { title: t("entry.exercise_preferences.title"), lede: t("entry.exercise_preferences.lede"), optional: true };
    if (step === "custom_shape") { const n = (TF.splitChoices(answers()).choices || []).length; return { title: t(n === 1 ? "entry.custom_shape.title_sole" : "entry.custom_shape.title"), lede: t(n === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede") }; }
    if (step === "schedule") return { title: t("entry.schedule.title"), lede: t("entry.schedule.lede") };
    if (step === "about") return { title: t("g.about.title"), lede: t("g.about.lede") };
    if (step === "background") return { title: t("entry.background.title"), lede: t("entry.background.lede") };
    if (step === "environment") return { title: t("entry.environment.title") };
    return { title: t(STEP_TITLE[step] || "entry.desired_result.title") };
  }

  /* ---------- screens ---------- */
  const brand = () => `<header class="g-brand"><img class="g-brand__mark" src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="44" height="44"><span class="g-brand__word">Taurifer</span><span class="g-brand__gap"></span>${TS.privacyButton(t, { cls: "btn--link g-brand__privacy" })}</header>`;
  const landingActions = () => `<div class="stack g-land__acts"><button type="button" id="firstRunCreate" class="btn btn--primary btn--accent" data-act="land-create">${esc(t("landing.build"))}</button><button type="button" id="firstRunImport" class="btn btn--bordered g-bordered" data-act="land-import">${esc(t("landing.track"))}</button></div>`;
  function landingView() {
    if (S.view === "shared-gate" && S.shared) {
      const m = S.shared.program.meta; const n = S.shared.program.exercises.length;
      return `<main class="page g-land" data-checkpoint="shared-gate">${brand()}
        <header class="g-intro g-land__intro"><p class="t-label">${esc(t("landing.shared.eyebrow"))}</p>
        <h1 class="g-land__head" data-focus>${esc(t("landing.shared.headline"))}</h1>
        <p class="t-lede">${esc(t("landing.shared.body"))}</p></header>
        <section class="g-gate" aria-labelledby="dGateName"><h2 class="t-subtitle" id="dGateName" data-user-text>${esc(m.name)}</h2><p class="facts g-gate__facts"><span class="t-data">${esc(t("entry.catalogue.days_badge", { days: m.daysPerWeek }))}</span><span class="t-data">${esc(t("entry.preview.exercises", { n, exercise: TF.tp(t, n, "exercise") }))}</span></p>
          <p class="t-label g-gate__label">${esc(t("g.gate.what"))}</p><p class="t-small">${esc(t("x.shared.what"))}</p><p class="t-small">${esc(t("x.shared.nothing_saved"))}</p></section>
        <div class="stack stack--tight g-land__acts"><button type="button" id="firstRunSharedStart" class="btn btn--primary btn--accent" data-act="shared-start" aria-describedby="dGateCap">${esc(t("setup.shared.title"))}</button><p class="t-caption g-gate__cap" id="dGateCap"><span data-user-text>${esc(t(m.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: m.name, n: m.daysPerWeek }))}</span></p></div>
        <p class="t-caption g-land__privacy">${esc(t("x.privacy.line"))}</p></main>`;
    }
    const invalid = S.view === "shared-invalid";
    return `<main class="page g-land" data-checkpoint="${invalid ? "shared-invalid" : "landing"}">${brand()}
      <header class="g-intro g-land__intro"><h1 class="g-land__head" data-focus>${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1>
      <p class="t-lede">${esc(t(invalid ? "landing.shared.invalid_body" : "landing.body"))}</p></header>
      ${invalid ? `<p class="status-line g-invalid" role="status"><span class="icon-mask icon-mask--alert" aria-hidden="true"></span><span>${esc(t(TF.sharedErrorKey(S.sharedError)))}</span></p>` : ""}
      ${landingActions()}
      ${invalid ? "" : TS.landingProof(t, lang)}
      <p class="t-caption g-land__privacy">${esc(t("x.privacy.line"))}</p></main>`;
  }
  function door(route, { featured = false, importMode } = {}) {
    const key = route === "import" ? (importMode === "freeform" ? "freeform" : "file") : route;
    const title = route === "import" ? t(importMode === "freeform" ? "entry.hub.freeform.title" : "entry.hub.import.title") : t(`entry.hub.${route}.title`);
    const ask = { recommend: t("x.cost.recommend"), custom: t("x.cost.custom"), browse: t("x.cost.browse"), build: t("x.cost.build"), freeform: t("x.cost.paste"), file: t("x.cost.file") }[key];
    const get = { recommend: t("g.get.recommend"), custom: t("g.get.custom"), browse: t("x.get.browse"), build: t("x.get.build"), freeform: t("x.get.import"), file: t("x.get.import") }[key];
    return `<button type="button" class="g-door${featured ? " g-door--featured" : ""}" data-act="route" data-route="${route}"${importMode ? ` data-mode="${importMode}"` : ""}><span class="icon-mask icon-mask--${ICON[key]} g-door__icon" aria-hidden="true"></span><span class="g-door__body"><span class="g-door__title">${esc(title)}</span><span class="g-door__line"><span class="g-door__k">${esc(t("g.hub.ask"))}</span> ${esc(ask)}</span><span class="g-door__line"><span class="g-door__k">${esc(t("g.hub.get"))}</span> ${esc(get)}</span></span><span class="chevron g-door__chev" aria-hidden="true"></span></button>`;
  }
  function recoveryCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") return `<div class="g-recover">${TS.rulesNotice(t, { keep: info.route === "import" || info.route === "shared", keepReady: false })}</div>`;
    const f = TS.resumeFacts(t, lang, info);
    return `<section class="card g-recover g-resume" data-checkpoint="resume" aria-labelledby="dResumeTitle"><div class="card__body stack stack--tight"><h2 class="t-subtitle" id="dResumeTitle">${esc(t("entry.resume.title"))}</h2><p class="t-small t-soft">${esc(t("entry.resume.body"))}</p><p class="status-line"><span class="icon-mask icon-mask--pin" aria-hidden="true"></span><span>${esc(t("g.resume.at", { route: f.route, step: f.step, when: f.when }))}</span></p><div class="stack stack--tight g-resume__acts"><button type="button" class="btn btn--primary btn--noarrow" id="dResume" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="btn btn--quiet btn--destructive" id="dResumeRestart" data-act="resume-restart" aria-haspopup="dialog">${esc(t("entry.resume.restart"))}</button></div></div></section>`;
  }
  function helpPanel() {
    const h = S.help; if (!h) return "";
    const opt = (q, val, label) => `<button type="button" class="chip g-help__opt${h[q] === val ? " is-selected" : ""}" role="radio" aria-checked="${h[q] === val}" data-act="help-pick" data-q="${q}" data-val="${val}">${esc(label)}</button>`;
    const q2 = h.q1 === "no" ? { id: "dHelpQ2", label: t("g.help.q2_no"), opts: ["recommend", "custom", "browse"] } : h.q1 === "yes" ? { id: "dHelpQ2", label: t("g.help.q2_yes"), opts: ["import", "build"] } : null;
    const target = q2 && q2.opts.includes(h.q2) ? h.q2 : null;
    return `<div class="g-help" id="dHelp" role="group" aria-labelledby="dHelpToggle" data-checkpoint="route-help">
      <p class="g-help__q" id="dHelpQ1">${esc(t("g.help.q1"))}</p><div class="g-help__opts" role="radiogroup" aria-labelledby="dHelpQ1">${opt("q1", "no", t("g.help.q1.no"))}${opt("q1", "yes", t("g.help.q1.yes"))}</div>
      ${q2 ? `<p class="g-help__q" id="${q2.id}">${esc(q2.label)}</p><div class="g-help__opts" role="radiogroup" aria-labelledby="${q2.id}">${q2.opts.map((o) => opt("q2", o, t(`g.help.q2.${o}`))).join("")}</div>` : ""}
      ${target ? `<button type="button" class="btn btn--primary btn--noarrow g-help__go" data-act="help-go" data-job="${target}">${esc(t("g.help.go", { route: TS.routeName(t, target) }))}</button>` : ""}</div>`;
  }
  function hubView() {
    const active = TF.hasActiveProgram();
    return `<div class="page g-page g-app"><header class="g-head"><button type="button" class="btn btn--link g-head__btn" data-act="hub-back"><span class="chevron g-head__chev" aria-hidden="true"></span>${esc(t("entry.back"))}</button></header>
      <main class="g-main view-enter" data-checkpoint="${active ? "hub-existing" : "route-choice"}">
        <header class="g-intro"><h1 class="t-title" data-focus>${esc(t("entry.hub.title"))}</h1><p class="t-lede">${esc(active ? t("g.hub.lede_existing") : t("g.hub.lede_first"))}</p></header>
        ${active ? `<div class="g-notice">${TS.activeNotice(t)}</div>` : ""}
        ${recoveryCard()}
        <div class="g-helpblock"><button type="button" class="btn btn--link g-help-toggle" id="dHelpToggle" data-act="help-toggle" aria-expanded="${S.help ? "true" : "false"}" aria-controls="dHelp">${esc(t("g.help.toggle"))}</button>${helpPanel()}</div>
        <section class="g-rec" aria-labelledby="gRecQ"><p class="t-label g-rec__eyebrow">${esc(t("g.rec.eyebrow"))}</p><h2 class="t-section g-rec__q" id="gRecQ">${esc(t("entry.desired_result.title"))}</h2><p class="t-small t-soft g-rec__facts">${esc(t("g.rec.facts", { n: QUESTIONS.recommend.length }))}</p>
          <div class="g-rec__opts" role="group" aria-labelledby="gRecQ">${TS.DESIRED.map((v) => `<button type="button" class="g-goal" data-act="start-rec" data-goal="${v}"><span class="icon-mask icon-mask--${TS.DESIRED_ICON[v]}" aria-hidden="true"></span><span class="g-goal__body"><span class="g-goal__t">${esc(t(`entry.desired_result.${v}.label`))}</span><span class="g-goal__c">${esc(t(`entry.desired_result.${v}.sub`))}</span></span><span class="chevron g-door__chev" aria-hidden="true"></span></button>`).join("")}</div></section>
        <section class="g-hubgroup" aria-labelledby="dG1"><p class="t-label g-hubgroup__label" id="dG1">${esc(t("entry.hub.group.written"))}</p>${door("custom")}</section>
        <section class="g-hubgroup" aria-labelledby="dG2"><p class="t-label g-hubgroup__label" id="dG2">${esc(t("entry.hub.group.browse"))}</p>${door("browse")}</section>
        <section class="g-hubgroup" aria-labelledby="dG3"><p class="t-label g-hubgroup__label" id="dG3">${esc(t("entry.hub.group.own"))}</p>
          <details class="g-own" id="dOwn"${S.own ? " open" : ""}><summary class="g-own__sum"><span class="icon-mask icon-mask--sheet g-door__icon" aria-hidden="true"></span><span class="g-door__body"><span class="g-door__title">${esc(t("entry.hub.own.title"))}</span><span class="g-door__line">${esc(t("entry.hub.own.cap"))}</span></span><span class="chevron g-own__chev" aria-hidden="true"></span></summary>
            <div class="g-own__body">${door("build")}${door("import", { importMode: "freeform" })}${door("import", { importMode: "file" })}</div></details></section>
      </main></div>`;
  }

  /* The answer rail: every earlier answer, one tap from being changed. */
  function rail() {
    const qs = QUESTIONS[S.route] || []; const idx = qs.indexOf(S.step); if (idx <= 0 || S.route === "browse") return "";
    const a = S.answers; const chips = [];
    const add = (step, label, what) => { if (qs.indexOf(step) < idx && label) chips.push(`<button type="button" class="g-rail__chip" data-act="jump" data-step="${step}" aria-label="${esc(t("g.rail.edit", { what }))}: ${esc(label)}">${esc(label)}<span class="icon-mask icon-mask--pencil icon-mask--sm" aria-hidden="true"></span></button>`); };
    if (a.desiredResult) add("about", t(`entry.desired_result.${a.desiredResult}.label`), lcFirst(t("g.fact.goal")));
    if (a.daysPerWeek && a.sessionMinutes) add("schedule", t("g.rail.schedule", { days: a.daysPerWeek, minutes: a.sessionMinutes === 90 ? "90+" : a.sessionMinutes }), lcFirst(t("g.fact.schedule")));
    if (a.environment && a.environment.kind) add("environment", t(`entry.environment.${a.environment.kind}`), lcFirst(t("g.fact.environment")));
    return chips.length ? `<nav class="g-rail" aria-label="${esc(t("g.rail"))}">${chips.join("")}</nav>` : "";
  }
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    const r = S.route, s = S.step;
    if (r === "recommend") {
      if (s === "environment") return S.envOpen ? "rec-env-correction" : "rec-environment";
      if (s === "priorities") return (S.answers.exerciseConstraints || []).some((c) => c.reason === "pain") ? "rec-avoid-pain" : "rec-priorities";
      return { about: S.answers.desiredResult ? "rec-background" : "rec-goal", schedule: "rec-schedule", result: "rec-result" }[s] || "";
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

  /* Review = result: program first, then how it was built (editable),
     why, what was adjusted, the lifter's constraints. */
  function factValue(kind, a) {
    if (kind === "desired_result") return a.desiredResult ? t(`entry.desired_result.${a.desiredResult}.label`) : "";
    if (kind === "background") return [a.structuredExperience && t(`entry.background.experience.${a.structuredExperience}`), a.recentConsistency && t(`entry.background.consistency.${a.recentConsistency}`)].filter(Boolean).join(" · ");
    if (kind === "schedule") return t("g.fact.schedule_value", { days: a.daysPerWeek, minutes: a.sessionMinutes === 90 ? t("g.fact.minutes_90") : a.sessionMinutes, rest: restText(a) });
    if (kind === "environment") { const k = t(`entry.environment.${a.environment ? a.environment.kind : "other"}`); const eq = TF.equipmentLabel(t, a.environment).split(", ").filter(Boolean).map((x) => (/^Smith$/.test(x) ? x : x.toLowerCase())).join(", "); return eq ? t("g.fact.env_value", { kind: k, equipment: eq }) : k; }
    if (kind === "priorities" && S.route === "custom") return TS.priorityLabel(t, lang, a, true) || t("entry.preview.priorities_none");
    if (kind === "priorities") {
      const parts = [TS.priorityLabel(t, lang, a, false) || t("entry.preview.priorities_none")];
      const av = (a.exerciseConstraints || []).map((c) => exLabel(c.exerciseId)); if (av.length) parts.push(t("entry.preview.avoid", { exercises: av.join(", ") }));
      return parts.join(" · ");
    }
    if (kind === "exercise_preferences") {
      const inc = (a.mustHaveExercises || []).map(exLabel), av = (a.exerciseConstraints || []).map((c) => exLabel(c.exerciseId));
      const parts = []; if (inc.length) parts.push(t("entry.preview.include", { exercises: inc.join(", ") })); if (av.length) parts.push(t("entry.preview.avoid", { exercises: av.join(", ") }));
      return parts.join(" · ") || t("entry.preview.exercise_preferences_none");
    }
    if (kind === "custom_shape") { const c = (TF.splitChoices(TF.normalizeAnswers(a)).choices || []).find((x) => x.id === a.splitPreference); return c ? t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }) : ""; }
    return "";
  }
  const factLabel = (kind) => t({ desired_result: "g.fact.goal", background: "g.fact.background", schedule: "g.fact.schedule", environment: "g.fact.environment", priorities: S.route === "custom" ? "g.fact.emphasis" : "g.fact.priorities", exercise_preferences: "g.fact.exercises", custom_shape: "g.fact.shape" }[kind]);
  /* O-5 (F) + Q637: identity statement, before/after count, and the ids of
     exercises that were not in the previous program. */
  function addedIds(before, after) {
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    return added.size && added.size < (after.program || []).length ? added : new Set();
  }
  function changeLine() {
    if (!S.changeFrom || !S.result) return "";
    const b = S.changeFrom.preview, a = S.result.preview, d = TF.identityDiff(b, a);
    const fb = TF.previewFacts(b), fa = TF.previewFacts(a); const cons = S.changeFrom.ctx === "g.change.constraints";
    const facts = (f) => t("g.change.facts", { ex: t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), sets: t("entry.preview.sets", { n: f.sets }) });
    return `<div class="g-change" id="gChange" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}"><p class="g-change__line">${esc(t(S.changeFrom.ctx))} ${esc(TS.changeText(t, d))}</p>${d.n === 0 && fb.sets === fa.sets ? "" : `<dl class="g-change__ba"><dt class="g-change__k">${esc(t(cons ? "g.change.without" : "g.change.before"))}</dt><dd class="g-change__v t-data">${esc(facts(fb))}</dd><dt class="g-change__k">${esc(t(cons ? "g.change.with" : "g.change.after"))}</dt><dd class="g-change__v t-data">${esc(facts(fa))}</dd></dl>`}</div>`;
  }
  function daysView(preview, added) {
    const days = preview.days || [];
    return `<div class="g-week">${days.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((n, e) => n + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const open = i === 0 || ex.some((e) => added.has(e.id));
      return `<details class="day"${open ? " open" : ""}><summary><span class="day__num" aria-hidden="true">${i + 1}</span><span class="day__name">${esc(TF.dayName(t, d, preview.programStructure, i))}<span class="day__meta" style="display:block;margin-top:2px">${esc(meta)}</span></span><span class="chevron" aria-hidden="true"></span></summary><div class="day__list">${ex.length ? ex.map((e) => { const isNew = added.has(e.id); return `<div class="ex${isNew ? " is-new" : ""}" data-slot="${esc(e.id)}"><span class="ex__name">${esc(TS.exName(e, lang))}${isNew ? ` <span class="g-new">${esc(t("g.rev.new"))}</span>` : ""}</span><span class="ex__rx">${e.sets != null ? `${e.sets} × ${e.min}–${e.max}` : ""}</span></div>`; }).join("") : `<div class="ex t-soft">${esc(t("program.empty.exercises"))}</div>`}</div></details>`;
    }).join("")}</div>`;
  }
  /* Q628: chips after the week; each opens its inline editor (Q629). */
  const CHIP_STEP = { goal: "desired_result", exp: "background", cons: "background", days: "schedule", minutes: "schedule", rest: "schedule", env: "environment", prio: "priorities", avoid: "priorities", emph: "priorities", prefs: "exercise_preferences", shape: "custom_shape" };
  function chipList() {
    const a = S.answers, n = answers(); const out = [];
    const add = (chip, what, text) => out.push({ chip, what: t(`g.what.${what}`), text });
    const libs = (ids) => ids.map(exLabel).join(", ");
    if (a.desiredResult) add("goal", "goal", t(`g.chip.goal.${a.desiredResult}`));
    if (a.structuredExperience) add("exp", "exp", t(`entry.background.experience.${a.structuredExperience}`));
    if (a.recentConsistency) add("cons", "cons", t(`g.chip.cons.${a.recentConsistency}`));
    if (a.daysPerWeek) add("days", "days", t("g.chip.days", { n: a.daysPerWeek }));
    if (a.sessionMinutes) add("minutes", "minutes", a.sessionMinutes >= 90 ? t("g.chip.minutes_90") : t("g.chip.minutes", { n: a.sessionMinutes }));
    if (has(a, "preferredRestSeconds")) add("rest", "rest", t(`g.chip.rest.${a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds}`));
    if (a.environment) { const kind = a.environment.kind; const base = TF.env(kind); const same = (x, y) => JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort()); const env = t(`entry.environment.${kind}`); add("env", "env", same(base.equipment, a.environment.equipment) && same(base.capabilities, a.environment.capabilities) ? env : t("g.chip.env_adjusted", { env })); }
    const avoids = (a.exerciseConstraints || []).map((c) => c.exerciseId);
    if (S.route === "recommend") {
      const pr = TS.priorityLabel(t, lang, n, false); add("prio", "prio", pr ? t("g.chip.prio", { list: pr }) : t("g.chip.prio_none"));
      if (avoids.length) add("avoid", "avoid", t("g.chip.avoid", { list: libs(avoids) }));
    } else {
      const pr = TS.priorityLabel(t, lang, n, true); add("emph", "emph", pr ? t("g.chip.emph", { list: pr }) : t("g.chip.emph_none"));
      const inc = a.mustHaveExercises || [];
      add("prefs", "prefs", [inc.length ? t("g.chip.include", { list: libs(inc) }) : "", avoids.length ? t("g.chip.avoid", { list: libs(avoids) }) : ""].filter(Boolean).join(" · ") || t("g.chip.prefs_none"));
      const c = (TF.splitChoices(n).choices || []).find((x) => x.id === a.splitPreference);
      if (c) add("shape", "shape", t("g.chip.shape", { name: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }) }));
    }
    return out;
  }
  function editorView() {
    const sh = S.sheet; if (!sh) return "";
    const pending = sh.avoid.pending || sh.pref.pending;
    return `<section class="g-edit" id="gEdit" aria-labelledby="gEditTitle"><h2 class="t-subtitle g-edit__title" id="gEditTitle" tabindex="-1">${esc(factLabel(sh.kind))}</h2>
      ${sh.error ? `<div class="notice notice--error" role="alert"><p>${esc(sh.error)}</p></div>` : ""}${questionBody(sh.kind, sh.answers, { sheet: true })}
      <div class="stack stack--tight g-edit__acts"><button type="button" class="btn btn--primary btn--noarrow" data-act="sheet-apply"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(t("g.sheet.apply"))}</button><button type="button" class="btn btn--quiet" data-act="sheet-close">${esc(t("g.edit.keep"))}</button></div></section>`;
  }
  function chipsBlock() {
    return `<section class="g-sec g-answers" aria-labelledby="gChipsLabel"><header class="g-sec__head"><h2 class="t-subtitle g-sec__label" id="gChipsLabel">${esc(t("g.chips.label"))}</h2><p class="t-caption">${esc(t("g.chips.hint"))}</p></header>
      <div class="g-chips">${chipList().map((c) => `<button type="button" class="g-chip${S.sheet && S.sheet.chip === c.chip ? " is-open" : ""}" data-act="chip" data-chip="${c.chip}" aria-expanded="${!!(S.sheet && S.sheet.chip === c.chip)}"${S.sheet && S.sheet.chip === c.chip ? ' aria-controls="gEdit"' : ""} aria-label="${esc(t("g.chip.aria", { what: c.what, value: c.text }))}"><span>${esc(c.text)}</span><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span></button>`).join("")}</div>${editorView()}</section>`;
  }
  function reviewBody() {
    if (!S.result) return `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t("g.rev.error_title"))}</h1></header><div class="notice notice--error" role="alert"><p>${esc(S.compileError || t("x.issue.compile"))}</p></div>`;
    const r = S.result, p = r.preview, f = TF.previewFacts(p), a = answers(), gen = generated();
    const eyebrow = S.route === "recommend" ? t("entry.result.title") : S.route === "custom" ? t("entry.result.custom_title") : t(`entry.preview.source.${S.route}`);
    const facts = [t("entry.catalogue.days_badge", { days: (p.days || []).length }), TF.durationLabel(t, p), t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), t("entry.preview.sets", { n: f.sets })].filter(Boolean);
    /* F01: the payoff's facts as a strip of Mono values with their units. */
    const nDays = (p.days || []).length;
    const cells = [[String(nDays), t(nDays === 1 ? "g.facts.day_one" : "g.facts.days")], f.minMinutes ? [f.minMinutes === f.maxMinutes ? String(f.minMinutes) : `${f.minMinutes}–${f.maxMinutes}`, t("g.facts.minutes")] : null, [String(f.exercises), TF.tp(t, f.exercises, "exercise")], [String(f.sets), t("g.facts.sets")]].filter(Boolean);
    const strip = `<p class="visually-hidden">${facts.map(esc).join(" · ")}</p><dl class="g-facts g-strip" id="dFacts" aria-hidden="true">${cells.map(([v, u]) => `<div class="g-strip__cell"><dt class="g-strip__unit">${esc(u)}</dt><dd class="g-strip__value t-data">${esc(v)}</dd></div>`).join("")}</dl>`;
    const conflict = S.notice === "conflict" ? `<div id="dConflictBox" tabindex="-1" class="g-conflict">${TS.conflictNotice(t)}</div>` : "";
    let out = `${conflict}<header class="g-intro g-intro--review"><p class="t-label">${esc(eyebrow)}</p><h1 class="t-title g-progname" data-focus${S.route === "shared" || S.route === "import" ? " data-user-text" : ""}>${esc(name())}</h1>
      ${strip}</header>${changeLine()}
      ${TF.hasActiveProgram() && S.notice !== "conflict" ? `<div class="g-notice">${TS.activeNotice(t)}</div>` : ""}
      <section class="g-sec" aria-labelledby="dWeek"><h2 class="t-subtitle g-sec__label" id="dWeek">${esc(t("entry.preview.days"))}</h2>${daysView(p, S.changeFrom && gen ? addedIds(S.changeFrom.preview, p) : new Set())}</section>`;
    if (gen) {
      out += chipsBlock();
      const reasons = TS.reasons(t, lang, r, a, { custom: S.route === "custom" });
      out += `<section class="g-sec" aria-labelledby="dWhy"><h2 class="t-subtitle g-sec__label" id="dWhy">${esc(t("entry.result.why"))}</h2><ul class="g-list">${reasons.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--${x.icon}" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul><p class="t-caption g-det">${esc(t("entry.result.lede"))}</p></section>`;
    } else {
      const card = S.route === "browse" && S.card ? TF.browseCards(answers()).find((c) => c.id === S.card) : null;
      out += `<section class="g-sec" aria-labelledby="dProg"><h2 class="t-subtitle g-sec__label" id="dProg">${esc(t("entry.preview.progression"))}</h2><ul class="g-list">
        ${card ? `<li class="fact-row"><span class="icon-mask icon-mask--target" aria-hidden="true"></span><span class="fact-row__text">${esc(t(`entry.catalogue.purpose.${card.purpose}`))}</span></li><li class="fact-row"><span class="icon-mask icon-mask--dumbbell" aria-hidden="true"></span><span class="fact-row__text">${esc(t("entry.catalogue.equipment", { equipment: card.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span></li>` : ""}
        <li class="fact-row"><span class="icon-mask icon-mask--trend" aria-hidden="true"></span><span class="fact-row__text">${esc(t(TF.progressionCopyKey(p)))}</span></li>
        ${S.route === "import" ? `<li class="fact-row"><span class="icon-mask icon-mask--shield" aria-hidden="true"></span><span class="fact-row__text">${esc(t("import.safe"))}</span></li>` : ""}</ul></section>`;
    }
    const adj = TS.adjustments(t, p);
    if (adj.length) out += `<section class="g-sec" aria-labelledby="dAdj"><h2 class="t-subtitle g-sec__label" id="dAdj">${esc(t("g.rev.adjusted"))}</h2><ul class="g-list">${adj.map((x) => `<li class="fact-row"><span class="icon-mask icon-mask--scale" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span></li>`).join("")}</ul></section>`;
    const cons = gen ? TS.constraintLines(t, lang, a) : [];
    if (cons.length) out += `<section class="g-sec" aria-labelledby="dCons"><h2 class="t-subtitle g-sec__label" id="dCons">${esc(t("g.rev.constraints"))}</h2><ul class="g-list">${cons.map((x) => `<li class="fact-row g-cons"><span class="icon-mask icon-mask--${x.kind === "avoid" ? "shield" : "check"}" aria-hidden="true"></span><span class="fact-row__text">${esc(x.text)}</span>${x.kind === "avoid" ? `<button type="button" class="btn btn--sm g-cons__btn" data-act="restore" data-id="${esc(x.id)}" aria-label="${esc(t("g.rev.restore_aria", { exercise: exLabel(x.id) }))}">${esc(t("g.rev.restore"))}</button>` : ""}</li>`).join("")}</ul></section>`;
    if (r.alternative) out += `<section class="g-sec" aria-labelledby="dAlt"><h2 class="t-subtitle g-sec__label" id="dAlt">${esc(t("entry.result.alternative"))}</h2><p class="t-small">${esc(TF.resultName(r.alternative, lang) || "")}</p></section>`;
    const issue = TF.progressionIssue(p);
    if (issue) out += `<p class="notice notice--error" id="dBlocked" role="alert">${esc(t("entry.preview.activation_blocked"))}</p>`;
    if (S.actError) out += `<p class="notice notice--error" id="dActError" tabindex="-1" role="alert">${esc(S.actError)}</p>`;
    out += `<section class="g-sec g-more" aria-labelledby="dMore"><h2 class="visually-hidden" id="dMore">${esc(t("g.rev.more"))}</h2><div class="stack stack--tight"><button type="button" class="btn" id="dEdit" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("entry.preview.edit"))}</button><button type="button" class="btn btn--quiet btn--destructive" id="dRestart" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div></section>`;
    return out;
  }
  function activateFooter({ ready = true, reasonId = null, statusHtml = "" } = {}) {
    const blocked = S.notice === "conflict" ? "dConflictBox" : !ready ? reasonId : null;
    const label = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : S.route === "build" && !S.editing ? t("entry.editor.use") : t("entry.preview.activate_first");
    return `<footer class="pinned g-pin" data-persistent-action data-checkpoint="activate">${statusHtml}<button type="button" class="btn btn--primary" id="dActivate" data-activate data-act="activate"${blocked ? ` disabled aria-describedby="${blocked}"` : ""}>${esc(label)}</button></footer>`;
  }
  function catalogueBody() {
    const a = S.answers; const cards = TF.browseCards(answers());
    const label = (s) => t(`program.progression.strategy.${s}`, undefined, s);
    const range = (vals, exact, rng) => (Math.min(...vals) === Math.max(...vals) ? t(exact, { n: vals[0] }) : t(rng, { min: Math.min(...vals), max: Math.max(...vals) }));
    const card = (c) => { const nm = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; const ex = c.structureFacts.map((x) => x.exerciseCount), sets = c.structureFacts.map((x) => x.setCount);
      return `<li><button type="button" class="g-card" data-act="card" data-id="${esc(c.id)}"><span class="g-card__top"><span class="g-card__name">${esc(nm)}</span><span class="t-data g-card__days">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span class="t-small t-soft">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span><span class="facts g-card__facts"><span class="t-data">${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))}</span><span class="t-data">${esc(range(ex, "entry.catalogue.exercises_exact", "entry.catalogue.exercises_range"))}</span><span class="t-data">${esc(range(sets, "entry.catalogue.sets_exact", "entry.catalogue.sets_range"))}</span></span><span class="t-caption">${esc(t("entry.catalogue.progression", { progression: c.progressionStrategies.map(label).join(" · ") }))}</span><span class="t-caption">${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span>${c.mismatch ? `<span class="t-small g-card__mismatch">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button></li>`; };
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    return `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t("entry.catalogue.title"))}</h1><p class="t-lede">${esc(t("entry.catalogue.lede"))}</p></header>
      <div class="g-context"><p class="facts"><span class="t-data">${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span class="t-data">${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment ? a.environment.kind : "other"}`))}</span></p><button type="button" class="btn btn--sm" data-act="jump" data-step="schedule" aria-label="${esc(t("g.catalogue.change_aria"))}">${esc(t("x.change"))}</button></div>
      ${fits.length ? `<section class="g-sec" aria-labelledby="dFits"><h2 class="t-subtitle g-sec__label" id="dFits">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</h2><ul class="g-cards">${fits.map(card).join("")}</ul></section>` : `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.catalogue.empty_title"))}</strong><p>${esc(t("entry.catalogue.empty_body"))}</p></div>`}
      ${others.length ? `<details class="disclosure g-others"><summary><span>${esc(t("entry.catalogue.group_other"))} <span class="t-data">(${others.length})</span></span><span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body"><p class="t-caption">${esc(t("entry.catalogue.mismatch"))}</p><ul class="g-cards">${others.map(card).join("")}</ul></div></details>` : ""}`;
  }
  function editorParts() {
    const forBuild = S.route === "build" && !S.editing;
    const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
    const head = forBuild
      ? `<header class="g-intro"><h1 class="t-title g-progname" data-focus data-user-text>${esc(S.build.name || t("untitled_program"))}</h1><p class="facts g-facts"><span class="t-data">${esc(t("g.build.days_caption", { n: S.build.days.length }))}</span></p></header>`
      : `<header class="g-intro"><p class="t-label">${esc(t("entry.preview.edit"))}</p><h1 class="t-title g-progname" data-focus>${esc(name())}</h1><p class="t-lede">${esc(t("g.edit.lede"))}</p><button type="button" class="btn g-editdone" data-act="edit-done">${esc(t("g.edit.done"))}</button></header>`;
    const status = TS.build.statusLine(st, { id: "editorStatus" });
    const tail = forBuild ? `<div class="g-more"><button type="button" class="btn btn--quiet" data-act="save-draft">${esc(t("entry.editor.save"))}</button></div>` : "";
    const inFlow = compact() || st.ready;
    return { body: head + `<div class="g-editor">${TS.build.editor(t, lang, S.build)}</div>` + (inFlow ? status : "") + tail, footer: activateFooter({ ready: st.ready, reasonId: "editorStatus", statusHtml: inFlow ? "" : status }) };
  }
  function buildSetupBody() {
    const a = S.answers; const miss = missingKeys();
    return `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t("entry.build_setup.title"))}</h1><p class="t-lede">${esc(t("entry.build_setup.lede"))}</p></header>${TF.hasActiveProgram() ? `<div class="g-notice">${TS.activeNotice(t)}</div>` : ""}${validationNotice()}
      <label class="field g-group"><span>${esc(t("entry.build_setup.name"))}</span><input id="dBuildName" type="text" maxlength="80" autocomplete="off" data-field="programName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"${miss.has("programName") ? ' aria-invalid="true" class="is-invalid" aria-describedby="dNameErr"' : ""}>${miss.has("programName") ? `<span class="field__error" id="dNameErr">${esc(TS.issueText(t, ["program_name_required"]))}</span>` : ""}</label>
      ${group("qBDays", t("entry.build_setup.days"), numGrid("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek" })}`;
  }
  function importBody() {
    if (S.importDraft) {
      const d = S.importDraft; const c = TF.importCounts(d);
      return { body: `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t("import.heading"))}</h1><p class="t-lede">${esc(t("import.lede"))}</p><p class="t-caption" data-user-text>${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</p></header>
        ${d.notImported.length ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}
        <div class="g-sec">${TS.importReview.counts(t, d)}</div><div class="g-sec">${TS.importReview.rows(t, lang, d, { picker: S.picker })}</div>
        ${d.originalText ? `<details class="disclosure disclosure--plain"><summary>${esc(t("entry.freeform.view_original"))}</summary><pre class="t-caption" style="white-space:pre-wrap">${esc(d.originalText)}</pre></details>` : ""}
        <p class="t-caption g-safe">${esc(t("import.safe"))}</p>${c.review && compact() ? `<p class="t-small g-reason" id="dImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}`,
        footer: `<footer class="pinned g-pin" data-persistent-action>${c.review && !compact() ? `<p class="t-small g-reason" id="dImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}<button type="button" class="btn btn--primary" id="dImportCommit" data-act="import-commit"${c.review ? ' disabled aria-describedby="dImpReason"' : ""}>${esc(t("entry.preview.review"))}</button></footer>` };
    }
    const own = `<div class="g-switches"><button type="button" class="btn btn--quiet g-switch" data-act="import-mode" data-mode="${S.importMode === "freeform" ? "file" : "freeform"}">${esc(t(S.importMode === "freeform" ? "entry.freeform.to_file" : "entry.import_source.to_freeform"))}</button><button type="button" class="btn btn--link g-switch" data-act="switch-build">${esc(t("g.import.write_own"))}</button></div>`;
    const active = TF.hasActiveProgram() ? `<div class="g-notice">${TS.activeNotice(t)}</div>` : "";
    if (S.importMode === "freeform") {
      const gaps = S.ff.status === "gaps";
      return { body: `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t(gaps ? "g.ff.gaps_title" : "entry.freeform.title"))}</h1><p class="t-lede">${esc(t(gaps ? "g.ff.gaps_lede" : "entry.freeform.lede"))}</p></header>${active}<div class="g-ff">${TS.freeform.body(t, lang, S.ff)}</div>${gaps ? "" : own}`, footer: "" };
    }
    return { body: `<header class="g-intro"><h1 class="t-title" data-focus>${esc(t("entry.import_source.title"))}</h1><p class="t-lede">${esc(t("entry.import_source.lede"))}</p></header>${active}<button type="button" class="btn btn--primary btn--noarrow g-pick" data-act="import-file"><span class="icon-mask icon-mask--download" aria-hidden="true"></span>${esc(t("entry.import_source.pick"))}</button><p class="t-caption">${esc(t("x.cost.file"))}</p>${own}`, footer: "" };
  }
  function validationNotice() { return S.validation ? `<div class="notice notice--error g-validation" role="alert" tabindex="-1" id="dValidation"><strong>${esc(t("entry.validation.title"))}</strong><p>${esc(t("entry.validation.body"))}</p></div>` : ""; }
  function routeView() {
    const qs = QUESTIONS[S.route] || []; const qi = qs.indexOf(S.step);
    let body = "", footer = "";
    if (qi >= 0) {
      const h = stepHead(S.step); const pending = S.avoid.pending || S.pref.pending;
      /* Skip only while the optional section is empty (Delta D-1). */
      const emptyPrio = !(S.answers.primaryMuscles || []).length && !(S.answers.priorityMovements || []).length && !(S.answers.exerciseConstraints || []).length && !S.avoid.pending;
      const skip = S.route === "recommend" && S.step === "priorities" && emptyPrio ? `<button type="button" class="btn btn--quiet g-skip" data-act="skip">${esc(t("g.q.skip"))}</button>` : "";
      body = `<header class="g-intro">${h.optional ? `<p class="t-label">${esc(t("entry.optional"))}</p>` : ""}<h1 class="t-title" data-focus>${esc(h.title)}</h1>${h.lede ? `<p class="t-lede">${esc(h.lede)}</p>` : ""}${skip}</header>${validationNotice()}${questionBody(S.step, S.answers)}`;
      const label = S.step === "custom_shape" ? t("entry.custom_shape.generate") : S.route === "recommend" && S.step === "priorities" ? t("g.q.show") : t("entry.next");
      footer = `<footer class="pinned g-pin" data-persistent-action><button type="button" class="btn btn--primary" id="dNext" data-advance data-act="next"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(label)}</button></footer>`;
    } else if (S.step === "catalogue") body = catalogueBody();
    else if (S.step === "build_setup") { body = buildSetupBody(); footer = `<footer class="pinned g-pin" data-persistent-action><button type="button" class="btn btn--primary" id="dNext" data-advance data-act="next">${esc(t("entry.build_setup.open"))}</button></footer>`; }
    else if (S.step === "import_source") { const r = importBody(); body = r.body; footer = r.footer; }
    else if ((S.route === "build" && S.step === "editor") || S.editing) { const e = editorParts(); body = e.body; footer = e.footer; }
    else if (reviewing()) { body = reviewBody(); if (S.result && !S.sheet) footer = activateFooter({ ready: !TF.progressionIssue(S.result.preview), reasonId: "dBlocked" }); }
    const counter = qi >= 0 ? `<span class="g-where__sep" aria-hidden="true">·</span><span aria-live="polite">${esc(t("entry.step", { n: qi + 1, total: qs.length }))}</span>` : "";
    const segbar = qi >= 0 ? `<div class="segbar g-segbar" data-progress-dimension="task" data-progress-scope="entry-route-step" aria-hidden="true">${qs.map((_, i) => `<span class="segbar__seg${i < qi ? " is-done" : i === qi ? " is-current" : ""}"></span>`).join("")}</div>` : "";
    return `<div class="page g-page g-app"><header class="g-head"><button type="button" class="btn btn--link g-head__btn" data-act="back"><span class="chevron g-head__chev" aria-hidden="true"></span>${esc(t("entry.back"))}</button><button type="button" class="btn btn--link g-head__btn" data-act="cancel">${esc(t("entry.cancel"))}</button></header>
      ${reviewing() && generated() && !S.editing ? "" : `<p class="g-where"><span class="g-where__route">${esc(TS.routeName(t, S.route))}</span>${counter}</p>`}${segbar}${qi >= 0 ? rail() : ""}
      <main class="g-main view-enter" data-entry-step="${esc(entryStep())}"${S.editing ? " data-editor" : ""} data-checkpoint="${esc(checkpointFor())}">${body}</main>${footer}</div>`;
  }
  function sheetView() { return ""; } /* Q629: editors are inline (editorView). */
  function overlayView() {
    if (S.overlay === "cancel") return TS.cancelSheet(t);
    if (S.overlay === "replace") return TS.replaceSheet(t, TF.activeName(lang), name(), TF.device.sessions);
    if (S.overlay === "restart") return TS.restartSheet(t, { shared: S.route === "shared" });
    if (S.overlay === "resume-discard") return `<div class="sheet-scrim" data-act="resume-discard-cancel"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dDiscardTitle" aria-describedby="dDiscardBody" data-confirm="discard-draft"><h2 id="dDiscardTitle" tabindex="-1">${esc(t("g.resume.discard_title"))}</h2><p id="dDiscardBody">${esc(t("g.resume.discard_body"))}</p><div class="stack stack--tight"><button type="button" class="btn btn--destructive" data-act="resume-discard-confirm">${esc(t("g.resume.discard_confirm"))}</button><button type="button" class="btn" data-act="resume-discard-cancel">${esc(t("g.resume.discard_cancel"))}</button></div></div>`;
    return "";
  }
  function view() {
    if (S.view === "today") return `<div class="g-app view-enter">${TF.renderToday(t, lang)}</div>` + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    if (S.view === "hub") return hubView() + overlayView();
    if (S.view === "route") return routeView() + sheetView() + overlayView() + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    return landingView();
  }
  const sel = (x) => (/^[#\[.]/.test(x) ? x : "#" + CSS.escape(x));
  function focusId(id) {
    const el = root.querySelector(sel(id)) || document.querySelector(sel(id));
    if (!el) { TS.focusHeading(root); return; }
    if (!el.matches("button,a,input,textarea,select,summary") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: false }); } catch (e) { /* ignore */ }
  }
  /* K-27: a re-render keeps focus on the same control (same id, or the same
     data-* identity), so a keyboard user never loses their place. */
  const FOCUS_ATTRS = ["act", "key", "val", "id", "chip", "step", "imp", "ff", "build", "day", "mode", "route", "q", "job", "sheet", "goal", "provider", "status", "rx", "field"];
  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = FOCUS_ATTRS.filter((a) => el.dataset && el.dataset[a] !== undefined).map((a) => `[data-${a}="${CSS.escape(el.dataset[a])}"]`);
    return parts.length ? parts.join("") : null;
  }
  function render(focus) {
    const act = document.activeElement; const key = focusKey(act); const typing = act && /^(INPUT|TEXTAREA)$/.test(act.tagName);
    root.innerHTML = view();
    if (typeof focus === "string") focusId(focus);
    else if (focus) { window.scrollTo(0, 0); TS.focusHeading(root); }
    else if (key) { const el = root.querySelector(key); if (el) { if (typing && el.id) TS.refocus(root, el.id); else try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  }
  /* Scroll so an element sits just below the top edge. */
  function scrollToEl(el, pad = 12) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - pad)); }

  /* ---------- sheets (O-9) ---------- */
  function openSheet(chip) {
    const kind = CHIP_STEP[chip];
    S.sheet = { kind, chip, answers: clone(S.answers), avoid: { query: "", pending: null }, pref: { query: "", pending: null }, error: null };
    render(); revealEditor();
  }
  /* Focus the editor heading, then scroll so its confirm control is in view
     (the pinned activation is hidden while an editor is open). */
  function revealEditor() {
    const ed = root.querySelector("#gEdit"); if (!ed) return;
    ed.classList.add("g-enter");
    const h = ed.querySelector("h2"); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    const ok = ed.querySelector('[data-act="sheet-apply"]'); const r = ed.getBoundingClientRect(); const o = ok.getBoundingClientRect();
    if (o.bottom - r.top + 24 <= window.innerHeight) scrollToEl(ed); else window.scrollTo(0, Math.max(0, o.bottom + window.scrollY - window.innerHeight + 16));
  }
  function closeSheet() { const chip = S.sheet && S.sheet.chip; S.sheet = null; render(chip ? `[data-chip="${chip}"]` : true); }
  /* After an apply: focus and scroll to the change statement (K-28). */
  function showChange() {
    const c = root.querySelector("#gChange"); if (!c) { TS.focusHeading(root); return; }
    c.classList.add("g-enter"); for (const row of root.querySelectorAll(".ex.is-new")) row.classList.add("g-enter");
    /* Prefer the top of the review (name, facts and statement together);
       otherwise bring the statement itself just below the top edge. */
    const pin = root.querySelector("[data-persistent-action]"); const limit = pin ? pin.getBoundingClientRect().top + window.scrollY : Infinity;
    const bottomAtTop = c.getBoundingClientRect().bottom + window.scrollY;
    if (bottomAtTop <= Math.min(limit, window.innerHeight) - 8) window.scrollTo(0, 0); else scrollToEl(c, 16);
    try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function applySheet() {
    const sh = S.sheet; if (sh.avoid.pending || sh.pref.pending) return;
    const next = clone(sh.answers); if (S.route === "custom") ensureSplit(next);
    if (JSON.stringify(TF.normalizeAnswers(next)) === JSON.stringify(answers())) { closeSheet(); return; }
    const r = compileWith(TF.normalizeAnswers(next));
    if (!r.ok) { sh.error = r.text; render("gEditTitle"); return; }
    S.changeFrom = { preview: S.result.preview, ctx: "g.change.answer" };
    S.answers = next; S.result = r.result; S.sheet = null;
    render(); showChange();
  }
  function restore(id) {
    const next = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== id) };
    const r = compileWith(TF.normalizeAnswers(next)); if (!r.ok) { S.actError = r.text; render("dActError"); return; }
    S.changeFrom = { preview: S.result.preview, ctx: "g.change.restore" }; S.answers = next; S.result = r.result; render(); showChange();
  }

  /* ---------- actions ---------- */
  function onPick(d) {
    if (S.sheet) {
      const sh = S.sheet;
      if (d.key === "avoidReason") sh.avoid.pending = null, sh.pref.pending = null;
      sh.answers = TS.applyPick(sh.answers, d.key, d.val); sh.error = null; render(); return;
    }
    if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
    if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (d.key === "daysPerWeek" && S.route === "custom") delete S.answers.splitPreference;
    render();
  }
  function on(act, d, el) {
    S.cpTag = null;
    if (act !== "save-draft" && S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": S.view = "hub"; render(true); return;
      case "land-import": go("import", "freeform"); return;
      case "hub-back": S.help = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return;
      case "help-toggle": S.help = S.help ? null : { q1: null, q2: null }; render(S.help ? "dHelpQ1" : "dHelpToggle"); return;
      case "help-pick": S.help = d.q === "q1" ? { q1: d.val, q2: null } : { ...S.help, q2: d.val }; render(); return;
      case "help-go": go(d.job, d.job === "import" ? "freeform" : undefined); return;
      case "route": go(d.route, d.mode); return;
      case "start-rec": go("recommend", undefined, d.goal); return;
      case "goal-edit": S.goalOpen = true; render(`[data-key="desiredResult"][data-val="${S.answers.desiredResult}"]`); return;
      case "pick": onPick(d); return;
      case "next": advance(); return;
      case "skip": skipPriorities(); return;
      case "back": back(); return;
      case "jump": jump(d.step); return;
      case "cancel": if (S.route === "shared") { toGate(); return; } S.overlay = "cancel"; S.overlayReturn = null; render("cancelTitle"); return;
      case "cancel-continue": S.overlay = null; render('[data-act="cancel"]'); return;
      case "cancel-keep": keepDraft(); leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); leaveSetup(); return;
      case "resume": {
        const info = TF.loadDraft(); if (!info || !info.state) return; const st = info.state; const shared = S.shared;
        S = blank("route"); S.shared = shared; S.route = st.route; S.step = screenOf(st.route, st.step); S.answers = clone(st.answers) || {}; S.result = st.result ? clone(st.result) : null; S.revAtStart = st.activeProgramRevisionAtStart;
        if (info.ui && info.ui.build) S.build = clone(info.ui.build); if (info.ui && info.ui.importMode) S.importMode = info.ui.importMode;
        if (S.route === "build" && S.step === "editor" && !S.build) S.build = TS.build.create(S.answers.programName || "", S.answers.daysPerWeek || 3);
        if (S.step === "result" && !S.result) compileFirst();
        if (S.step === "preview" && !S.result) S.step = STEPS[S.route][0];
        render(true); return;
      }
      case "resume-restart": S.overlay = "resume-discard"; S.overlayReturn = "dResumeRestart"; render("dDiscardTitle"); return;
      case "resume-discard-cancel": S.overlay = null; render("dResumeRestart"); return;
      case "resume-discard-confirm": TF.clearDraft(); S.overlay = null; render(true); return;
      case "rules-rebuild": { const info = TF.loadDraft(); TF.clearDraft(); if (info && info.state && QUESTIONS[info.state.route]) { const st = info.state; S = blank("route"); S.route = st.route; S.step = QUESTIONS[st.route].includes(screenOf(st.route, st.step)) ? screenOf(st.route, st.step) : QUESTIONS[st.route][0]; S.answers = clone(st.answers) || {}; } render(true); return; }
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
      case "field:programName": S.answers.programName = d.value.trim(); if (S.validation && S.answers.programName) { const e = root.querySelector("#dNameErr"); if (e) e.remove(); } return;
      case "field:dayName": S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return;
      case "field:rx": case "change:rx": S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return;
      case "field:pickerQuery": if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return;
      case "build": S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(d.build === "open-picker" ? "pickerSearch" : undefined); return;
      case "pick-exercise": if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return;
      case "save-draft": keepDraft(); S.toast = t("entry.editor.saved"); render(); return;
      case "card": { const c = TF.browseCards(answers()).find((x) => x.id === d.id); if (!c) return; S.answers.catalogueSelection = c.id; S.card = c.id; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.step = "preview"; render(true); return; }
      case "import-mode": S.importMode = d.mode; S.importDraft = null; S.picker = null; render(true); return;
      case "switch-build": go("build"); return;
      case "import-file": S.importDraft = S.importHeld && S.importHeld.sourceType === "file" ? S.importHeld : TF.buildImportDraft(TF.F.importFile[lang], t("g.import.file_name"), "file"); S.importHeld = null; render(true); return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render("pickerSearch"); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return;
      case "import-commit": S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.step = "preview"; S.importDraft = null; S.picker = null; render(true); return;
      case "ff": {
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
        else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); return; }
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...S.ff, status: null, parsed: null }; render(true); return; }
        const stageChange = ["continue", "open", "copy", "try-another", "gap-back", "start-over-confirm", "review", "gap-submit", "edit-source"].includes(d.ff);
        if (d.ff === "start-over") { render("ffRestartTitle"); return; }
        if (d.ff === "start-over-cancel") { render('[data-ff="start-over"]'); return; }
        if (d.ff === "gap-submit" && S.ff.gapErrors.size) { render("dGapError"); return; }
        render(stageChange ? true : undefined); return;
      }
      case "field:ffInput": {
        S.ff = TS.freeform.apply(S.ff, "input", d.value);
        const c = root.querySelector("#ffCount"); if (c) c.textContent = t("entry.freeform.count", { n: TF.nf(lang, S.ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) });
        const need = root.querySelector("#ffNeeds"); if (need) need.hidden = !!TS.freeform.program(S.ff);
        const btn = root.querySelector('[data-ff="continue"]'); if (btn) btn.disabled = !TS.freeform.program(S.ff);
        const main = root.querySelector("main[data-checkpoint]"); if (main) main.dataset.checkpoint = checkpointFor();
        return;
      }
      case "field:ffReply": S.ff = TS.freeform.apply(S.ff, "reply", d.value); return;
      case "field:gap": S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return;
      case "shared-start": S.view = "route"; S.route = "shared"; S.step = "preview"; S.result = TF.sharedResult(S.shared); S.revAtStart = TF.liveRevision(); render(true); return;
      case "edit": S.build = TS.build.fromPreview(S.result.preview, { name: name() }); S.editing = true; render(true); return;
      case "edit-done": editDone(); return;
      case "activate": requestActivate(); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; render("dActivate"); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return;
      case "restart": S.overlay = "restart"; render("restartTitle"); return;
      case "restart-cancel": S.overlay = null; render("dRestart"); return;
      case "restart-confirm": { if (S.route === "shared") { S = blank("landing"); S.shared = null; render(true); return; } const own = S.own; S = blank("hub"); S.own = own; S.stash = null; render(true); return; }
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
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("g.import.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  async function reach(cp) {
    const u = TF.F.users;
    const build = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [dd, id] of plan) { S.build.picker = dd; S.build = TS.build.apply(S.build, "add", id); } };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": S.view = "hub"; break;
      case "route-help": S.view = "hub"; S.help = { q1: "no", q2: null }; break;
      case "rec-goal": at("recommend", "about", {}); break;
      case "rec-background": at("recommend", "about", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": at("recommend", "environment", rafael()); break;
      case "rec-env-correction": { const a = rafael(); a.environment = correctedEnv(); at("recommend", "environment", a); S.envOpen = true; break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", "priorities", a); break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); compileFirst(); if (cp === "replace-confirm") { S.overlay = "replace"; render("replTitle"); return; } break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); compileFirst(); const before = S.result.preview; S.answers = { ...S.answers, environment: correctedEnv() }; compileFirst(); S.changeFrom = { preview: before, ctx: "g.change.answer" }; S.cpTag = cp; break; }
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
      case "import-review": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("g.import.file_name"), "file"); break;
      case "import-preview": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = importDecided(); on("import-commit", {}); return;
      case "shared-gate": case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; if (cp === "shared-preview" && r.ok) { on("shared-start", {}); return; } break; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "activation-conflict": at("recommend", "result", rafael()); compileFirst(); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; render("cancelTitle"); return;
      case "activated-today": at("recommend", "result", rafael()); compileFirst(); activateNow(); return;
      default: S.view = "landing";
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const advanceSel = "[data-advance]";
  /* The about screen (goal only when not carried from the chooser), then
     schedule and environment. */
  async function recommendSections(api, a, { goal = true } = {}) {
    if (goal) await api.tap(pickKey("desiredResult", a.desiredResult));
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
  async function openOwnIfNeeded(api, sel) { if (!api.find(sel)) await api.tap("#dOwn > summary"); }
  async function removeTwo(api) { for (const dd of S.build.days.slice(0, 2)) await api.tap(`[data-build="remove"][data-id="${dd.exercises[0].id}"]`); }
  async function startRecommendFromHub(api) { await api.tap('[data-act="start-rec"][data-goal="muscle_growth"]'); }
  const HELP = { recommend: ["no", "recommend"], custom: ["no", "custom"], browse: ["no", "browse"], build: ["yes", "build"], import: ["yes", "import"] };
  const journeys = {
    async "activate.recommend"(api) {
      const a = TF.fixtureAnswers("rafael");
      await api.tap("#firstRunCreate"); await api.tap(`[data-act="start-rec"][data-goal="${a.desiredResult}"]`); /* the first door is the first answer */
      await recommendSections(api, a, { goal: false });
      await api.tap(advanceSel); /* priorities: optional, nothing chosen */
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
      await api.tap(advanceSel); /* the sole structure is preselected: Gerar programa */
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
      await openOwnIfNeeded(api, '[data-act="route"][data-route="build"]'); await api.tap('[data-act="route"][data-route="build"]');
      await api.type("#dBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(advanceSel);
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
      await api.type("#dBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(advanceSel);
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
      await api.type("#dSheetAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth")); /* same screen as the background (Q627) */
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m")); await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most")); await api.tap(advanceSel);
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3)); await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60)); await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120)); await api.tap(advanceSel);
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap(advanceSel);
      await api.tap(advanceSel); api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, sel] of [["recommend", '[data-act="start-rec"][data-goal="muscle_growth"]'], ["custom", '[data-act="route"][data-route="custom"]'], ["browse", '[data-act="route"][data-route="browse"]'], ["build", '[data-act="route"][data-route="build"]'], ["import", '[data-act="route"][data-route="import"][data-mode="file"]']]) {
        await openOwnIfNeeded(api, sel); await api.tap(sel); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
      }
    },
  };
  for (const job of Object.keys(HELP)) journeys[`help.${job}`] = async (api) => {
    const [q1, q2] = HELP[job];
    await api.tap('[data-act="help-toggle"]'); await api.tap(`[data-act="help-pick"][data-q="q1"][data-val="${q1}"]`); await api.tap(`[data-act="help-pick"][data-q="q2"][data-val="${q2}"]`);
    await api.tap('[data-act="help-go"]'); api.snapshot("end");
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.g = {
    id: "g", name: "G · Síntese", policy: { productDecisions: [] },
    thesis: "The synthesis spec built as written: five honest doors, B's five grouped sections, and one review that is the result, corrected in place with a true change statement.",
    axis: "Control: every open item at the spec's stated default; no product decision.",
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      fresh(c.seed); TS.wire(root, on);
      root.addEventListener("toggle", (ev) => { const el = ev.target; if (!el || el.tagName !== "DETAILS") return; if (el.id === "dOwn") S.own = el.open; else if (el.dataset.role === "env-correction" && !S.sheet) S.envOpen = el.open; }, true);
      document.addEventListener("keydown", onKey);
      render();
    },
    reach,
    /* The result is what activation would commit: the Build draft in the
       Build editor, the committed edit in Edit before using. */
    entry() {
      if (!S || S.view !== "route" || !S.route) return null;
      let result = S.result;
      if (S.route === "build" && S.step === "editor" && S.build) result = TS.build.result(S.build);
      else if (S.editing && S.build && S.result) result = TS.build.commit(S.result, S.build);
      return TF.jsonClean({ route: S.route, step: entryStep(), answers: answers(), result: result || null });
    },
    journeys,
    state: () => S,
  };
})();
