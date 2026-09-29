/* E · Uma pergunta por vez
 *
 * Thesis: Start is a conversation, not a menu. Taurifer asks one thing at a
 * time and builds the program, and every other way to get a program stays
 * one explicit, named, reversible step away from the question you are on and
 * from the program you are looking at.
 *
 * Axis: deferred route choice with progressive single questions; the review is
 * the hub. Answers, optional refinements (priorities, avoidance) and the other
 * four routes all hang off the program itself, and every answer is corrected
 * inline, in place, with the changed rows marked.
 *
 * Product decision: PD-1 (deferred route choice), and only PD-1.
 *   What it changes versus Plan 054 ("Start training opens the five-job
 *   chooser"): the landing primary opens Recommend's first question instead of
 *   a chooser page. The five jobs are still offered before any answer: the
 *   first question carries the other four routes as a visible list (never
 *   collapsed) plus a helper that ends at each of the five; the days question
 *   offers Browse for the chosen day count; the review offers every route
 *   again, carrying the answers. Custom stays its own route with its own
 *   questions, section count and provenance ("Programa personalizado pelo
 *   Taurifer"); every route switch is explicit, stated on arrival and reversible
 *   with Back (N-7). The landing secondary still opens Import on the paste door,
 *   so importers never pass a Recommend screen. An existing user entering setup
 *   lands on the same first question, with the active-program notice and the
 *   full route list visible, so every job is reachable from the first screen.
 *   Checks it relaxes: K-19 only (help.* and chooser.doors turn into warnings).
 *   E does not use PD-2, PD-3 or PD-4: minutes and rest are asked and required,
 *   nothing is preselected, and no program is shown before the answers.
 *
 * Open items (synthesis spec §9) as allocated to E: O-1 one question per
 * screen (section counter stays semantic: 4 sections, 7 questions); O-2
 * priorities and avoidance offered from the review as optional refinements
 * before activation (proactive search, reason required, production pain note);
 * O-3 an inline fact list at the top of the review; O-5 changed rows marked
 * inline plus a polite status; O-6 routes from the review; O-7 Start only;
 * O-8 default landing; O-9 inline expansion; O-10 resume card on the landing;
 * O-11 a quiet "Prefiro escrever do zero" link from Import.
 */
(function () {
  "use strict";
  const { esc } = TF;

  /* ---------- copy (PT-BR first; EN parity) ---------- */
  const COPY = {
    pt: {
      "e.land.start_cap": "Sete perguntas curtas, uma de cada vez.",
      "e.sec.desired_result": "Objetivo", "e.sec.background": "Histórico", "e.sec.schedule": "Semana", "e.sec.environment": "Local",
      "e.sec.priorities": "Músculos", "e.sec.exercise_preferences": "Exercícios", "e.sec.custom_shape": "Estrutura",
      "e.counter": "Seção {n} de {total} · {name}",
      "e.q.exp.title": "Há quanto tempo você segue programas estruturados?",
      "e.q.cons.title": "Nas últimas seis semanas, quantas sessões planejadas você fez?",
      "e.q.cons.lede": "Esta resposta e a anterior ajustam o trabalho das primeiras semanas.",
      "e.q.days.title": "Quantos dias por semana você vai treinar?",
      "e.q.days.lede": "Conte os dias que cabem numa semana comum.",
      "e.q.min.title": "Até quanto tempo pode durar uma sessão?",
      "e.q.rest.title": "Quanto você prefere descansar entre séries exigentes?",
      "e.q.rest.lede": "Muda a duração estimada das sessões, não os exercícios.",
      "e.q.env.title": "Onde você treina?",
      "e.q.pick": "Escolha uma resposta.",
      "e.q.show": "Montar meu programa",
      "e.q.show_list": "Ver programas",
      "e.unit.days": "dias", "e.unit.min": "min",
      "e.ways.title": "Ou comece de outro jeito",
      "e.ways.review_title": "Outros caminhos a partir daqui",
      "e.ways.review_lede": "Suas respostas vão junto. Voltar traz você de volta a este programa.",
      "e.ways.recommend.title": "Deixar o Taurifer montar", "e.ways.recommend.cap": "Responda às perguntas; o Taurifer escolhe a estrutura.",
      "e.ways.recommend.cap_carry": "Mesmas respostas; o Taurifer escolhe a estrutura e os exercícios.",
      "e.ways.custom.title": "Escolher músculos e exercícios", "e.ways.custom.cap": "Você define ênfase e exercícios; o Taurifer escreve o programa. {n} seções.",
      "e.ways.custom.cap_carry": "Suas respostas vão junto; faltam músculos, exercícios e estrutura.",
      "e.ways.browse.title": "Escolher um programa pronto", "e.ways.browse.cap": "{n} perguntas, depois uma lista de programas Taurifer completos.",
      "e.ways.browse.title_carry": "Ver programas prontos para {days} dias", "e.ways.browse.cap_carry": "Filtrados pelos seus dias, pelo seu tempo e pelo seu local.",
      "e.ways.build.title": "Escrever do zero", "e.ways.build.cap": "Dias vazios; você digita cada exercício e cada meta.",
      "e.ways.import.title": "Trazer o programa que você já tem", "e.ways.import.cap": "Cole um texto de qualquer lugar ou importe um arquivo Taurifer.",
      "e.ways.days_browse": "Prefere um programa pronto? Ver programas para {days} dias",
      "e.help.summary": "Não sabe qual caminho serve?", "e.help.q": "O que descreve melhor o seu caso?",
      "e.help.recommend": "Quero que o Taurifer decida por mim", "e.help.custom": "Sei quais músculos e exercícios quero",
      "e.help.browse": "Prefiro escolher entre programas prontos", "e.help.build": "Quero escrever cada exercício eu mesmo",
      "e.help.import": "Já tenho um programa escrito, em texto ou arquivo",
      "e.help.go": "Seguir por aqui: {route}", "e.help.go_recommend": "Continuar com estas perguntas",
      "e.switch.note": "Caminho anterior: {route}. Suas respostas vieram junto.", "e.switch.back": "Voltar ao caminho anterior",
      "e.rev.answers": "Suas respostas", "e.rev.choices": "Suas escolhas", "e.rev.optional": "Opcional",
      "e.rev.answers_hint": "Toque em uma resposta para mudá-la. O programa é refeito aqui mesmo.",
      "e.rev.week": "Semana de treino", "e.rev.adjusted": "O que o Taurifer ajustou", "e.rev.constraints": "Suas restrições",
      "e.rev.restore": "Restaurar", "e.rev.restore_aria": "Restaurar {exercise}",
      "e.rev.avoid_absent": "Não estava no programa, então nada foi trocado.", "e.rev.avoid_removed": "Saiu do programa.",
      "e.rev.new": "novo", "e.rev.left": "Saíram: {names}.", "e.rev.left_many": "Saíram {n} exercícios do programa anterior.",
      "e.rev.for": "Para {days} dias · até {minutes} min · {env}",
      "e.rev.source_days": "{n} dias por semana",
      "e.fact.aria": "{label}: {value}. Toque para alterar.",
      "e.fact.goal": "Objetivo", "e.fact.exp": "Experiência", "e.fact.cons": "Últimas seis semanas", "e.fact.days": "Dias", "e.fact.min": "Tempo por sessão",
      "e.fact.rest": "Descanso", "e.fact.env": "Local", "e.fact.prio": "Prioridades", "e.fact.avoid": "Exercícios evitados",
      "e.fact.emph": "Ênfase muscular", "e.fact.prefs": "Exercícios", "e.fact.shape": "Estrutura",
      "e.fact.exp.first": "Primeiro programa estruturado", "e.fact.exp.under_6m": "Menos de 6 meses de programa", "e.fact.exp.6_to_24m": "6 a 24 meses de programa", "e.fact.exp.over_24m": "Mais de 2 anos de programa",
      "e.fact.cons.most": "Fez a maior parte das sessões", "e.fact.cons.about_half": "Fez cerca de metade das sessões", "e.fact.cons.few": "Fez poucas sessões", "e.fact.cons.none": "Sem treino recente",
      "e.fact.days_v": "{n} dias por semana", "e.fact.min_v": "Até {n} min por sessão", "e.fact.min_90": "90 min ou mais por sessão",
      "e.fact.rest.auto": "Descanso: o Taurifer escolhe", "e.fact.rest.60": "Descanso de cerca de 60 s", "e.fact.rest.90": "Descanso de cerca de 90 s", "e.fact.rest.120": "Descanso de cerca de 2 min", "e.fact.rest.180": "Descanso de 3 min ou mais",
      "e.fact.env_adjusted": "{env}, com ajustes",
      "e.fact.prio_v": "Prioridade: {m}", "e.fact.avoid_none": "Nenhum exercício evitado", "e.fact.emph_none": "Todos os músculos em normal",
      "e.edit.apply": "Atualizar programa", "e.edit.apply_list": "Atualizar lista", "e.edit.keep": "Manter como estava",
      "e.prio.title": "Músculos que merecem atenção extra", "e.avoid.lede": "Busque o exercício e diga por que evitá-lo.",
      "e.cat.for": "Buscando por", "e.cat.count_one": "1 programa combina com {days} dias.", "e.cat.count_many": "{n} programas combinam com {days} dias.",
      "e.cat.open_aria": "Abrir {name}",
      "e.imp.mode": "Como trazer o programa", "e.imp.paste": "Colar texto", "e.imp.file": "Arquivo Taurifer",
      "e.imp.build": "Prefiro escrever do zero", "e.imp.file_name": "treino-do-rafael.json",
      "e.build.days": "Escolha quantos dias de treino criar.",
      "e.edit_done": "Voltar ao programa",
      "e.resume.where": "Você parou em {route} · {step}, em {date}.",
      "e.resume.discard": "Descartar rascunho",
      "e.discard.title": "Descartar o rascunho?", "e.discard.body": "As respostas salvas em {date} saem deste dispositivo. Nenhum programa ativo muda.",
      "e.discard.confirm": "Descartar rascunho", "e.discard.cancel": "Manter rascunho",
      "e.gate.what": "O que chega com o link",
      "entry.freeform.copy": "Copiar o comando",
    },
    en: {
      "e.land.start_cap": "Seven short questions, one at a time.",
      "e.sec.desired_result": "Goal", "e.sec.background": "Background", "e.sec.schedule": "Week", "e.sec.environment": "Place",
      "e.sec.priorities": "Muscles", "e.sec.exercise_preferences": "Exercises", "e.sec.custom_shape": "Structure",
      "e.counter": "Section {n} of {total} · {name}",
      "e.q.exp.title": "How long have you followed structured programs?",
      "e.q.cons.title": "In the past six weeks, how many planned sessions did you complete?",
      "e.q.cons.lede": "This answer and the previous one adjust the work of the first weeks.",
      "e.q.days.title": "How many days a week will you train?",
      "e.q.days.lede": "Count the days that fit an ordinary week.",
      "e.q.min.title": "What is the longest a session can run?",
      "e.q.rest.title": "How long do you like to rest between demanding sets?",
      "e.q.rest.lede": "It changes the estimated session length, not the exercises.",
      "e.q.env.title": "Where do you train?",
      "e.q.pick": "Choose an answer.",
      "e.q.show": "Build my program",
      "e.q.show_list": "See programs",
      "e.unit.days": "days", "e.unit.min": "min",
      "e.ways.title": "Or start another way",
      "e.ways.review_title": "Other paths from here",
      "e.ways.review_lede": "Your answers come along. Back returns you to this program.",
      "e.ways.recommend.title": "Let Taurifer build it", "e.ways.recommend.cap": "Answer the questions; Taurifer picks the structure.",
      "e.ways.recommend.cap_carry": "Same answers; Taurifer picks the structure and the exercises.",
      "e.ways.custom.title": "Choose muscles and exercises", "e.ways.custom.cap": "You set emphasis and exercises; Taurifer writes the program. {n} sections.",
      "e.ways.custom.cap_carry": "Your answers come along; muscles, exercises and structure remain.",
      "e.ways.browse.title": "Pick a ready-made program", "e.ways.browse.cap": "{n} questions, then a list of complete Taurifer programs.",
      "e.ways.browse.title_carry": "See ready-made programs for {days} days", "e.ways.browse.cap_carry": "Filtered by your days, your time and where you train.",
      "e.ways.build.title": "Write it from scratch", "e.ways.build.cap": "Empty days; you type every exercise and every target.",
      "e.ways.import.title": "Bring the program you already have", "e.ways.import.cap": "Paste text from anywhere or import a Taurifer file.",
      "e.ways.days_browse": "Rather use a ready-made program? See programs for {days} days",
      "e.help.summary": "Not sure which path fits?", "e.help.q": "What describes you best?",
      "e.help.recommend": "I want Taurifer to decide for me", "e.help.custom": "I know which muscles and exercises I want",
      "e.help.browse": "I'd rather pick from ready-made programs", "e.help.build": "I want to write every exercise myself",
      "e.help.import": "I already have a written program, as text or a file",
      "e.help.go": "Go this way: {route}", "e.help.go_recommend": "Keep going with these questions",
      "e.switch.note": "Previous path: {route}. Your answers came along.", "e.switch.back": "Back to the previous path",
      "e.rev.answers": "Your answers", "e.rev.choices": "Your choices", "e.rev.optional": "Optional",
      "e.rev.answers_hint": "Tap an answer to change it. The program is rebuilt right here.",
      "e.rev.week": "Training week", "e.rev.adjusted": "What Taurifer adjusted", "e.rev.constraints": "Your constraints",
      "e.rev.restore": "Restore", "e.rev.restore_aria": "Restore {exercise}",
      "e.rev.avoid_absent": "It was not in the program, so nothing was swapped.", "e.rev.avoid_removed": "Removed from the program.",
      "e.rev.new": "new", "e.rev.left": "Left the program: {names}.", "e.rev.left_many": "{n} exercises from the previous program left it.",
      "e.rev.for": "For {days} days · up to {minutes} min · {env}",
      "e.rev.source_days": "{n} days per week",
      "e.fact.aria": "{label}: {value}. Tap to change.",
      "e.fact.goal": "Goal", "e.fact.exp": "Experience", "e.fact.cons": "Past six weeks", "e.fact.days": "Days", "e.fact.min": "Time per session",
      "e.fact.rest": "Rest", "e.fact.env": "Place", "e.fact.prio": "Priorities", "e.fact.avoid": "Avoided exercises",
      "e.fact.emph": "Muscle emphasis", "e.fact.prefs": "Exercises", "e.fact.shape": "Structure",
      "e.fact.exp.first": "First structured program", "e.fact.exp.under_6m": "Under 6 months on programs", "e.fact.exp.6_to_24m": "6 to 24 months on programs", "e.fact.exp.over_24m": "Over 2 years on programs",
      "e.fact.cons.most": "Did most sessions", "e.fact.cons.about_half": "Did about half the sessions", "e.fact.cons.few": "Did only a few sessions", "e.fact.cons.none": "No recent training",
      "e.fact.days_v": "{n} days a week", "e.fact.min_v": "Up to {n} min a session", "e.fact.min_90": "90 min or more a session",
      "e.fact.rest.auto": "Rest: Taurifer chooses", "e.fact.rest.60": "About 60 s of rest", "e.fact.rest.90": "About 90 s of rest", "e.fact.rest.120": "About 2 min of rest", "e.fact.rest.180": "3 min of rest or more",
      "e.fact.env_adjusted": "{env}, adjusted",
      "e.fact.prio_v": "Priority: {m}", "e.fact.avoid_none": "No exercise avoided", "e.fact.emph_none": "Every muscle at normal",
      "e.edit.apply": "Update program", "e.edit.apply_list": "Update list", "e.edit.keep": "Keep as it was",
      "e.prio.title": "Muscles that get extra attention", "e.avoid.lede": "Search for the exercise and say why you avoid it.",
      "e.cat.for": "Searching for", "e.cat.count_one": "1 program fits {days} days.", "e.cat.count_many": "{n} programs fit {days} days.",
      "e.cat.open_aria": "Open {name}",
      "e.imp.mode": "How to bring the program", "e.imp.paste": "Paste text", "e.imp.file": "Taurifer file",
      "e.imp.build": "I'd rather write it from scratch", "e.imp.file_name": "rafael-program.json",
      "e.build.days": "Choose how many training days to create.",
      "e.edit_done": "Back to the program",
      "e.resume.where": "You stopped at {route} · {step}, on {date}.",
      "e.resume.discard": "Discard draft",
      "e.discard.title": "Discard the draft?", "e.discard.body": "The answers saved on {date} are removed from this device. No active program changes.",
      "e.discard.confirm": "Discard draft", "e.discard.cancel": "Keep draft",
      "e.gate.what": "What arrives with the link",
    },
  };

  /* ---------- flow model ---------- */
  const REVIEW = { recommend: "result", custom: "result", browse: "preview", import: "preview", shared: "preview", build: "editor" };
  const CONTEXT_KEYS = ["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "preferredRestSeconds", "environment"];
  const SHARED_Q = [["desired_result", ["goal"]], ["background", ["exp", "cons"]], ["schedule", ["days", "min", "rest"]], ["environment", ["env"]]];
  const FLOW = {
    recommend: SHARED_Q,
    custom: [...SHARED_Q, ["priorities", ["emph"]], ["exercise_preferences", ["prefs"]], ["custom_shape", ["shape"]]],
    browse: [["schedule", ["days", "min"]], ["environment", ["env"]]],
  };
  const OTHER_JOBS = ["recommend", "custom", "browse", "build", "import"];
  const FACTS_REC = ["goal", "exp", "cons", "days", "min", "rest", "env"];
  let t, lang, root, S;

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const A = (a) => TF.normalizeAnswers(a || S.answers);
  const generated = () => S.route === "recommend" || S.route === "custom";
  const exName = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };

  function fresh(seed) {
    TF.seedDevice(seed || "fresh");
    S = {
      view: TF.hasActiveProgram() ? "today" : "landing", route: null, step: null, sub: 0, answers: {}, bank: {}, result: null, before: null,
      origin: null, fact: null, fa: null, factError: null, lastFact: null, envOpen: false, open: {}, help: null,
      editing: false, build: null, importMode: "freeform", importDraft: null, importKept: null, ff: TS.freeform.create(), picker: null,
      avoid: { query: "", pending: null }, pref: { query: "", pending: null }, overlay: null, notice: null, error: null,
      revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, cpTag: null, cpPanel: null, card: null, listNote: false, focusAfter: null,
    };
  }

  /* ---------- questions ---------- */
  function answered(q, a) {
    switch (q) {
      case "goal": return !!a.desiredResult;
      case "exp": return !!a.structuredExperience;
      case "cons": return !!a.recentConsistency;
      case "days": return Number.isFinite(a.daysPerWeek);
      case "min": return Number.isFinite(a.sessionMinutes);
      case "rest": return has(a, "preferredRestSeconds");
      case "env": return !!(a.environment && a.environment.kind);
      default: return true;
    }
  }
  const flow = (r) => FLOW[r || S.route] || null;
  const sectionIndex = () => (flow() || []).findIndex(([s]) => s === S.step);
  function curQ() { const f = flow(); if (!f) return null; const e = f.find(([s]) => s === S.step); return e ? e[1][S.sub || 0] || null : null; }
  const isFirstQuestion = () => { const f = flow(); return !!f && f[0][0] === S.step && !(S.sub || 0); };
  function qIssues() {
    const q = curQ(); if (!q) return [];
    if (FACTS_REC.includes(q)) return answered(q, S.answers) ? [] : ["e_pick"];
    try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: A(), step: S.step })); } catch (e) { return ["state_invalid"]; }
  }
  /* First place to land in a route: the first unanswered question; custom
     always visits its own three sections; with everything answered,
     Recommend goes to its review and Browse to its list. */
  function firstOpen(route, a) {
    for (const [step, qs] of FLOW[route]) for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      if (!FACTS_REC.includes(q)) return { step, sub: i };
      if (!answered(q, a)) return { step, sub: i };
    }
    return { step: route === "browse" ? "catalogue" : "result", sub: 0 };
  }
  function ensureSplit(a) {
    const c = TF.splitChoices(A(a)).choices;
    if (c.length && !c.some((x) => x.id === a.splitPreference)) a.splitPreference = (c.find((x) => x.default) || c[0]).id;
    return a;
  }
  function compileWith(a) {
    const mode = S.route === "custom" ? "custom" : "recommend";
    if (mode === "custom") ensureSplit(a);
    const r = TF.compile(mode, A(a));
    if (!r.ok) return { ok: false, error: TS.issueText(t, r) };
    return { ok: true, result: TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation }) };
  }
  function compileNow() { const r = compileWith(S.answers); if (!r.ok) { S.result = null; S.error = r.error; return false; } S.result = r.result; S.error = null; return true; }

  /* ---------- entering and switching routes ---------- */
  function enterRoute(route, answers, { mode } = {}) {
    Object.assign(S, { view: "route", route, answers: answers || {}, result: null, before: null, fact: null, fa: null, editing: false, notice: null, error: null, sub: 0, cpTag: null, cpPanel: null, help: null, card: null, listNote: false, envOpen: false, revAtStart: TF.liveRevision(), avoid: { query: "", pending: null }, pref: { query: "", pending: null } });
    S.open = {};
    if (route === "import") { S.step = "import_source"; S.importMode = mode || "freeform"; S.ff = TS.freeform.create(); S.importDraft = null; S.importKept = null; S.picker = null; return; }
    if (route === "build") { S.step = "build_setup"; S.build = null; return; }
    const f = firstOpen(route, S.answers); S.step = f.step; S.sub = f.sub;
    if (route === "custom" && S.step === "custom_shape") ensureSplit(S.answers);
    if (S.step === "result") compileNow();
  }
  const pick = (a, keys) => Object.fromEntries(keys.filter((k) => has(a, k)).map((k) => [k, clone(a[k])]));
  function carry(from, to, a) {
    if (to === "browse") return pick(a, ["daysPerWeek", "sessionMinutes", "environment"]);
    if (to === "recommend") return { ...(S.bank.recommend || {}), ...pick(a, CONTEXT_KEYS), ...pick(a, ["primaryMuscles", "priorityMovements", "exerciseConstraints"]) };
    if (to === "custom") return { ...(S.bank.custom || {}), ...pick(a, CONTEXT_KEYS), ...pick(a, ["primaryMuscles", "exerciseConstraints"]) };
    return {};
  }
  const LOC_KEYS = ["view", "route", "step", "sub", "answers", "result", "before", "importMode", "importDraft", "importKept", "card", "revAtStart"];
  function switchTo(route, { mode } = {}) {
    const state = {}; for (const k of LOC_KEYS) state[k] = clone(S[k]);
    const prev = { state, origin: S.origin, from: S.route };
    if (S.route && FLOW[S.route]) S.bank[S.route] = clone(S.answers);
    enterRoute(route, carry(S.route, route, S.answers), { mode });
    S.origin = { ...prev, entry: { route: S.route, step: S.step, sub: S.sub } };
    render(true);
  }
  const atEntryPoint = () => !!S.origin && S.route === S.origin.entry.route && S.step === S.origin.entry.step && (S.sub || 0) === (S.origin.entry.sub || 0) && !S.importDraft;
  function restoreOrigin() {
    const o = S.origin; if (!o) return;
    if (S.route && FLOW[S.route]) S.bank[S.route] = clone(S.answers);
    Object.assign(S, clone(o.state)); S.origin = o.origin || null;
    S.fact = null; S.editing = false; S.notice = null; S.error = null; S.cpTag = null; S.cpPanel = null; S.overlay = null;
    if (S.route === "import") S.ff = TS.freeform.create();
    render(true);
  }
  function leaveSetup() {
    S.view = TF.hasActiveProgram() ? "today" : "landing"; S.route = null; S.step = null; S.origin = null; S.fact = null; S.editing = false;
    render(true);
  }

  /* ---------- navigation ---------- */
  function advance() {
    if (S.route === "build" && S.step === "build_setup") {
      if (!(S.answers.programName && S.answers.daysPerWeek)) return;
      S.build = TS.build.create(S.answers.programName, S.answers.daysPerWeek); S.step = "editor"; render(true); return;
    }
    if (qIssues().length || S.avoid.pending || S.pref.pending) return;
    const f = flow(); const i = sectionIndex(); if (i < 0) return;
    const subs = f[i][1];
    if ((S.sub || 0) < subs.length - 1) { S.sub = (S.sub || 0) + 1; render(true); return; }
    if (i < f.length - 1) { S.step = f[i + 1][0]; S.sub = 0; if (S.step === "custom_shape") ensureSplit(S.answers); render(true); return; }
    S.sub = 0;
    if (S.route === "browse") { S.step = "catalogue"; render(true); return; }
    S.step = "result"; S.before = null; compileNow(); render(true);
  }
  function lastQuestion() { const f = flow(); const [step, qs] = f[f.length - 1]; return { step, sub: qs.length - 1 }; }
  function back() {
    if (S.fact) { closeFact(); return; }
    if (S.editing) { S.editing = false; S.build = null; render(true); return; }
    if (S.origin && atEntryPoint()) { restoreOrigin(); return; }
    if (S.route === "shared") { toGate(); return; }
    if (S.route === "import") {
      if (S.step === "preview") { S.step = "import_source"; S.importDraft = S.importKept; S.result = null; S.before = null; render(true); return; }
      if (S.importDraft) { S.importDraft = null; S.picker = null; render(true); return; }
      leaveSetup(); return;
    }
    if (S.route === "build") { if (S.step === "editor") { S.step = "build_setup"; render(true); return; } leaveSetup(); return; }
    if (S.route === "browse" && S.step === "preview") { S.step = "catalogue"; S.result = null; S.card = null; render(true); return; }
    if (S.step === "catalogue" || S.step === "result") { const l = lastQuestion(); S.step = l.step; S.sub = l.sub; S.result = null; S.before = null; render(true); return; }
    const f = flow(); const i = sectionIndex();
    if ((S.sub || 0) > 0) { S.sub -= 1; render(true); return; }
    if (i > 0) { S.step = f[i - 1][0]; S.sub = f[i - 1][1].length - 1; render(true); return; }
    leaveSetup();
  }
  function toGate() { S.view = "shared-gate"; S.route = null; S.step = null; S.result = null; S.overlay = null; S.editing = false; render(true); }

  /* ---------- drafts, activation ---------- */
  const entryStep = () => S.step;
  function stateFor(step, withResult = true) { return TF.entryState({ route: S.route, answers: A(), result: withResult ? S.result : null, step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    let r = { ok: false };
    const ui = { sub: S.sub || 0 };
    try { r = TF.saveDraft(stateFor(entryStep()), { ui }); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { r = TF.saveDraft(stateFor(FLOW[S.route] && FLOW[S.route].some(([s]) => s === S.step) ? S.step : TF.Entry.ROUTE_STEPS[S.route][0], false), { ui }); } catch (e) { r = { ok: false }; } }
    return r.ok;
  }
  function activateNow() {
    if (S.editing) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : REVIEW[S.route];
    let r;
    try { r = TF.activate(stateFor(step)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { S.view = "today"; S.toast = t("x.activated"); S.overlay = null; S.origin = null; render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render(true); return; }
    S.error = TS.issueText(t, r, { preview: S.result && S.result.preview }); S.overlay = null; render();
    const el = root.querySelector("#eActErr"); if (el) { el.setAttribute("tabindex", "-1"); try { el.focus(); } catch (e) {} }
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }

  /* ---------- small view helpers ---------- */
  const routeName = (r) => TS.routeName(t, r);
  function topBar() {
    return `<header class="e-top"><button type="button" class="btn btn--link e-top__back" data-act="back"><span class="chevron e-chev-back" aria-hidden="true"></span>${esc(t("entry.back"))}</button><span class="e-top__route">${esc(routeName(S.route))}</span><button type="button" class="btn btn--link e-top__cancel" data-act="cancel">${esc(t("entry.cancel"))}</button></header>`;
  }
  function progress() {
    const f = flow(); const si = sectionIndex(); if (si < 0) return "";
    const ticks = f.map(([s, qs], i) => `<span class="e-ticks__grp">${qs.map((q, j) => `<span class="e-tick${i < si || (i === si && j < (S.sub || 0)) ? " is-done" : ""}${i === si && j === (S.sub || 0) ? " is-now" : ""}"></span>`).join("")}</span>`).join("");
    return `<div class="e-prog"><p class="t-label e-prog__label" aria-live="polite">${esc(t("e.counter", { n: si + 1, total: f.length, name: t(`e.sec.${S.step}`) }))}</p><div class="e-ticks" data-progress-dimension="task" data-progress-scope="entry-route-step" aria-hidden="true">${ticks}</div></div>`;
  }
  const radios = (labelId, html, cls = "stack stack--tight") => `<div class="${cls}" role="radiogroup" aria-labelledby="${labelId}">${html}</div>`;
  const numUnit = (key, n, unit, selected) => TS.choice({ key, val: n, title: n === 90 && key === "sessionMinutes" ? "90+" : String(n), cap: unit, selected, cls: "choice--seg e-num__opt" });
  /* The answer body for one question, used by the question screens and by the
     inline fact editors on the review (same options, same reducer). */
  function optionsFor(q, a, labelId) {
    switch (q) {
      case "goal": return radios(labelId, TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), icon: TS.DESIRED_ICON[v], selected: a.desiredResult === v })).join(""));
      case "exp": return radios(labelId, TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v })).join(""));
      case "cons": return radios(labelId, TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v })).join(""));
      case "days": return radios(labelId, TS.DAYS.map((n) => numUnit("daysPerWeek", n, t("e.unit.days"), a.daysPerWeek === n)).join(""), "e-num");
      case "min": return radios(labelId, TS.MINUTES.map((n) => numUnit("sessionMinutes", n, t("e.unit.min"), a.sessionMinutes === n)).join(""), "e-num");
      case "rest": return radios(labelId, TS.REST.map((v) => TS.choice({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : +v === a.preferredRestSeconds), cls: "choice--compact" })).join(""));
      case "env": return radios(labelId, TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), icon: TS.ENV_ICON[v], selected: a.environment && a.environment.kind === v, cls: "choice--compact" })).join("")) + (a.environment ? TS.environmentCorrection(t, a.environment, { open: S.envOpen }) : "");
      default: return "";
    }
  }
  const Q_TITLE = { goal: "entry.desired_result.title", exp: "e.q.exp.title", cons: "e.q.cons.title", days: "e.q.days.title", min: "e.q.min.title", rest: "e.q.rest.title", env: "e.q.env.title", emph: "entry.priorities.custom_title", prefs: "entry.exercise_preferences.title", shape: "entry.custom_shape.title", prio: "e.prio.title", avoid: "entry.priorities.avoid" };
  const Q_LEDE = { goal: "entry.desired_result.lede", exp: "entry.background.lede", cons: "e.q.cons.lede", days: "e.q.days.lede", min: "entry.schedule.lede", rest: "e.q.rest.lede", env: "entry.environment.lede", emph: "entry.priorities.custom_lede", prefs: "entry.exercise_preferences.lede", prio: "entry.priorities.lede", avoid: "e.avoid.lede" };

  function wayRow(job, { carry: fromReview = false } = {}) {
    const a = S.answers;
    let title = t(`e.ways.${job}.title`), cap;
    if (job === "custom") cap = fromReview ? t("e.ways.custom.cap_carry") : t("e.ways.custom.cap", { n: TS.routeSections("custom") });
    else if (job === "browse") { if (fromReview && a.daysPerWeek) { title = t("e.ways.browse.title_carry", { days: a.daysPerWeek }); cap = t("e.ways.browse.cap_carry"); } else cap = t("e.ways.browse.cap", { n: TS.routeSections("browse") }); }
    else if (job === "recommend") cap = fromReview ? t("e.ways.recommend.cap_carry") : t("e.ways.recommend.cap");
    else cap = t(`e.ways.${job}.cap`);
    return `<li><button type="button" class="e-way" data-act="switch" data-route="${job}"${job === "import" ? ' data-mode="freeform"' : ""}><span class="e-way__body"><span class="e-way__title">${esc(title)}</span><span class="e-way__cap">${esc(cap)}</span></span><span class="chevron" aria-hidden="true"></span></button></li>`;
  }
  function helpBlock() {
    const open = !!S.open.help;
    const opts = OTHER_JOBS.map((j) => `<button type="button" class="choice choice--compact" role="radio" aria-checked="${S.help === j}" data-act="help-pick" data-job="${j}"><span class="choice__body"><span class="choice__title">${esc(t(`e.help.${j}`))}</span></span><span class="choice__mark" aria-hidden="true"></span></button>`).join("");
    const go = S.help ? `<button type="button" class="btn btn--block" data-act="help-go" data-help-go data-help-result="${S.help}">${esc(S.help === S.route ? t("e.help.go_recommend") : t("e.help.go", { route: routeName(S.help) }))}</button>` : "";
    return `<details class="disclosure disclosure--plain e-help" data-open-key="help"${open ? " open" : ""}${open ? ' data-checkpoint="route-help"' : ""}><summary>${esc(t("e.help.summary"))}<span class="chevron" aria-hidden="true"></span></summary><div class="stack stack--tight e-help__body"><p class="t-small" id="eHelpQ">${esc(t("e.help.q"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="eHelpQ">${opts.replace(/class="choice choice--compact" role="radio" aria-checked="true"/g, 'class="choice choice--compact is-selected" role="radio" aria-checked="true"')}</div>${go}</div></details>`;
  }

  /* ---------- question screens ---------- */
  function questionView() {
    const q = curQ(); const a = S.answers;
    const lede = Q_LEDE[q] ? `<p class="t-lede">${esc(t(Q_LEDE[q]))}</p>` : "";
    let body = "";
    if (FACTS_REC.includes(q)) body = optionsFor(q, a, "eQTitle");
    else if (q === "emph") body = TS.muscleEmphasis(t, a);
    else if (q === "prefs") body = TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] });
    else if (q === "shape") body = shapeOptions(a);
    let title = t(Q_TITLE[q]);
    if (q === "shape") { const c = TF.splitChoices(A()).choices; if (c.length === 1) title = t("entry.custom_shape.title_sole"); }
    const shapeLede = q === "shape" ? `<p class="t-lede">${esc(t(TF.splitChoices(A()).choices.length === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede"))}</p>` : "";
    let extra = "";
    if (isFirstQuestion() && (S.route === "recommend" || S.route === "custom")) {
      extra = `<section class="e-ways" aria-labelledby="eWaysTitle" data-checkpoint="route-choice"><h2 class="t-label" id="eWaysTitle">${esc(t("e.ways.title"))}</h2><ul class="e-way-list">${OTHER_JOBS.filter((j) => j !== S.route).map((j) => wayRow(j)).join("")}</ul>${helpBlock()}</section>`;
    }
    if (q === "days" && S.route !== "browse" && Number.isFinite(a.daysPerWeek)) extra = `<button type="button" class="btn btn--link e-inline-way" data-act="switch" data-route="browse">${esc(t("e.ways.days_browse", { days: a.daysPerWeek }))}</button>`;
    const existing = TF.hasActiveProgram() && isFirstQuestion() ? TS.activeNotice(t) : "";
    return `${existing}<h1 class="t-title e-q__title" id="eQTitle">${esc(title)}</h1>${lede}${shapeLede}${body}${extra}`;
  }
  function shapeOptions(a) {
    const c = TF.splitChoices(A(a)).choices;
    if (!c.length) return `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p></div>`;
    return radios("eQTitle", c.map((x) => { const est = (x.days || []).map((d) => d.estimateMinutes).filter(Boolean); const cap = [t(x.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason"), est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""].filter(Boolean).join(" "); return TS.choice({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt : x.name, days: x.frequency }), cap, selected: a.splitPreference === x.id }); }).join(""));
  }
  function advanceLabel() {
    const f = flow(); const i = sectionIndex(); const last = i === f.length - 1 && (S.sub || 0) === f[i][1].length - 1;
    if (S.step === "custom_shape") return t("entry.custom_shape.generate");
    if (last && S.route === "recommend") return t("e.q.show");
    if (last && S.route === "browse") return t("e.q.show_list");
    return t("entry.next");
  }

  /* ---------- review ---------- */
  function factValue(k, a) {
    switch (k) {
      case "goal": return t(`entry.desired_result.${a.desiredResult}.label`);
      case "exp": return t(`e.fact.exp.${a.structuredExperience}`);
      case "cons": return t(`e.fact.cons.${a.recentConsistency}`);
      case "days": return t("e.fact.days_v", { n: a.daysPerWeek });
      case "min": return a.sessionMinutes >= 90 ? t("e.fact.min_90") : t("e.fact.min_v", { n: a.sessionMinutes });
      case "rest": return t(`e.fact.rest.${a.preferredRestSeconds === null || a.preferredRestSeconds === undefined ? "auto" : a.preferredRestSeconds}`);
      case "env": { const kind = a.environment && a.environment.kind; const base = TF.env(kind); const env = t(`entry.environment.${kind}`); const same = (x, y) => JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort()); return same(base.equipment, a.environment.equipment) && same(base.capabilities, a.environment.capabilities) ? env : t("e.fact.env_adjusted", { env }); }
      case "prio": { const m = a.primaryMuscles || [], mv = a.priorityMovements || []; if (!m.length && !mv.length) return t("entry.preview.priorities_none"); return t("e.fact.prio_v", { m: [...m.map((x) => t(`entry.muscle.${x}`)), ...mv.map((x) => t(`entry.movement.${x}`))].join(", ") }); }
      case "avoid": { const c = a.exerciseConstraints || []; return c.length ? t("entry.preview.avoid", { exercises: c.map((x) => exName(x.exerciseId)).join(", ") }) : t("e.fact.avoid_none"); }
      case "emph": return TS.priorityLabel(t, lang, a, true) || t("e.fact.emph_none");
      case "prefs": { const inc = a.mustHaveExercises || [], av = a.exerciseConstraints || []; if (!inc.length && !av.length) return t("entry.preview.exercise_preferences_none"); return [inc.length ? t("entry.preview.include", { exercises: inc.map(exName).join(", ") }) : "", av.length ? t("entry.preview.avoid", { exercises: av.map((x) => exName(x.exerciseId)).join(", ") }) : ""].filter(Boolean).join(" · "); }
      case "shape": { const c = TF.splitChoices(A(a)).choices.find((x) => x.id === a.splitPreference); return c ? t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt : c.name, days: c.frequency }) : ""; }
      default: return "";
    }
  }
  function factButton(k, a) {
    const open = S.fact === k; const value = factValue(k, a);
    return `<button type="button" class="e-fact${open ? " is-open" : ""}${S.lastFact === k ? " is-last" : ""}" id="eFact-${k}" data-act="fact" data-fact="${k}" aria-expanded="${open}"${open ? ' aria-controls="eEdit"' : ""} aria-label="${esc(t("e.fact.aria", { label: t(`e.fact.${k}`), value }))}">${esc(value)}</button>`;
  }
  function factGroup(id, label, keys, a, { hint = "" } = {}) {
    return `<div class="e-facts-group"><p class="t-label" id="${id}">${esc(label)}</p><div class="e-facts" role="group" aria-labelledby="${id}">${keys.map((k) => factButton(k, a)).join("")}</div>${hint}</div>`;
  }
  function factEditor() {
    const k = S.fact; const a = S.fa; const titleId = "eEditTitle";
    let body = "";
    if (FACTS_REC.includes(k)) body = optionsFor(k, a, titleId);
    else if (k === "prio") {
      const m = a.primaryMuscles || [];
      body = `<div class="e-chips" role="group" aria-labelledby="${titleId}">${TS.chip({ key: "clearPriorities", val: "1", label: t("entry.priorities.none"), selected: !m.length })}${TS.MUSCLES.map((x) => TS.chip({ key: "primaryMuscles", val: x, label: t(`entry.muscle.${x}`), selected: m.includes(x), disabled: m.length >= 2 && !m.includes(x) })).join("")}</div>
        <p class="t-label" id="eMovLab">${esc(t("entry.priorities.movements"))}</p><div class="e-chips" role="group" aria-labelledby="eMovLab">${TS.MOVEMENTS.map((x) => TS.chip({ key: "priorityMovements", val: x, label: t(`entry.movement.${x}`), selected: (a.priorityMovements || []).includes(x) })).join("")}</div>`;
    } else if (k === "avoid") body = TS.avoidSection(t, lang, { query: S.avoid.query, pending: S.avoid.pending, constraints: a.exerciseConstraints || [] });
    else if (k === "emph") body = TS.muscleEmphasis(t, a);
    else if (k === "prefs") body = TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] });
    else if (k === "shape") body = shapeOptions(a).replace('aria-labelledby="eQTitle"', `aria-labelledby="${titleId}"`);
    const pending = S.avoid.pending || S.pref.pending;
    const listMode = S.route === "browse";
    const cp = S.cpPanel || (k === "prio" ? "rec-priorities" : "");
    return `<section class="e-edit" id="eEdit" aria-labelledby="${titleId}"${cp ? ` data-checkpoint="${cp}"` : ""}>
      <h2 class="t-subtitle" id="${titleId}" tabindex="-1">${esc(t(Q_TITLE[k]))}</h2>${Q_LEDE[k] && !["days", "rest"].includes(k) ? `<p class="t-small t-soft">${esc(t(Q_LEDE[k]))}</p>` : ""}
      ${k === "prio" || k === "avoid" ? `<p class="t-caption e-optional">${esc(t("e.rev.optional"))}</p>` : ""}
      ${body}
      ${S.factError ? `<p class="notice notice--error" role="alert">${esc(S.factError)}</p>` : ""}
      <div class="stack stack--tight e-edit__acts"><button type="button" class="btn btn--primary btn--noarrow" data-act="fact-apply" data-advance${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(t(listMode ? "e.edit.apply_list" : "e.edit.apply"))}</button><button type="button" class="btn btn--quiet" data-act="fact-close">${esc(t("e.edit.keep"))}</button></div></section>`;
  }
  /* Identity-level change set between two previews (C-5): the rows of the new
     program that were not in the old one, and the names that left. */
  function changeSet(before, after) {
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    const left = []; const seen = new Map(); for (const e of after.program || []) { const k = TF.exerciseIdentity(e); seen.set(k, (seen.get(k) || 0) + 1); }
    for (const e of before.program || []) { const k = TF.exerciseIdentity(e); if (seen.get(k)) seen.set(k, seen.get(k) - 1); else left.push(TS.exName(e, lang)); }
    return { added, left };
  }
  function changeBlock(before, after) {
    const d = TF.identityDiff(before, after); const cs = changeSet(before, after);
    const left = cs.left.length ? `<p class="t-caption e-change__left">${esc(cs.left.length > 4 ? t("e.rev.left_many", { n: cs.left.length }) : t("e.rev.left", { names: cs.left.join(", ") }))}</p>` : "";
    return `<div class="e-change"><p class="status-line change-line" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}">${esc(TS.changeText(t, d))}</p>${left}</div>`;
  }
  function daysView(preview, added) {
    const days = preview.days || [];
    const mark = added && added.size && added.size < (preview.program || []).length ? added : null;
    return `<ol class="e-days">${days.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((s, e) => s + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const key = `day:${d.dayId || i}`; const hasNew = mark && ex.some((e) => mark.has(e.id));
      const open = has(S.open, key) ? S.open[key] : i === 0 || hasNew;
      return `<li><details class="e-day" data-open-key="${esc(key)}"${open ? " open" : ""}><summary><span class="e-day__n t-data" aria-hidden="true">${i + 1}</span><span class="e-day__name">${esc(TF.dayName(t, d, preview.programStructure, i))}<span class="e-day__meta">${esc(meta)}</span></span><span class="chevron" aria-hidden="true"></span></summary>
        <ul class="e-day__list">${ex.length ? ex.map((e) => { const isNew = mark && mark.has(e.id); return `<li class="e-ex${isNew ? " is-new" : ""}" data-slot="${esc(e.id)}"><span class="e-ex__name">${esc(TS.exName(e, lang))}${isNew ? ` <span class="e-ex__tag">${esc(t("e.rev.new"))}</span>` : ""}</span><span class="e-ex__rx t-data">${e.sets != null ? `${e.sets} × ${e.min}–${e.max}` : ""}</span></li>`; }).join("") : `<li class="e-ex t-soft">${esc(t("program.empty.exercises"))}</li>`}</ul></details></li>`;
    }).join("")}</ol>`;
  }
  function constraintsBlock(a) {
    const lines = TS.constraintLines(t, lang, A(a)); if (!lines.length) return "";
    const inProgram = new Set((S.result.preview.program || []).map((e) => e.libraryId));
    const wasIn = S.before ? new Set((S.before.program || []).map((e) => e.libraryId)) : null;
    return `<section class="e-sec" aria-labelledby="eConsLab"><h2 class="t-label" id="eConsLab">${esc(t("e.rev.constraints"))}</h2><ul class="e-rows">${lines.map((c) => {
      let note = "";
      if (c.kind === "avoid") note = !inProgram.has(c.id) && (!wasIn || !wasIn.has(c.id)) ? t("e.rev.avoid_absent") : !inProgram.has(c.id) ? t("e.rev.avoid_removed") : "";
      const restore = c.kind === "avoid" ? `<button type="button" class="btn btn--sm" data-act="restore" data-id="${esc(c.id)}" aria-label="${esc(t("e.rev.restore_aria", { exercise: exName(c.id) }))}">${esc(t("e.rev.restore"))}</button>` : "";
      return `<li class="e-row"><span class="e-row__text"><span>${esc(c.text)}</span>${note ? `<span class="t-caption">${esc(note)}</span>` : ""}</span>${restore}</li>`;
    }).join("")}</ul>${(a.exerciseConstraints || []).some((c) => c.reason === "pain") ? `<p class="status-line e-pain" role="note"><span class="icon-mask icon-mask--shield" aria-hidden="true"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}</section>`;
  }
  function reviewView() {
    const p = S.result.preview; const f = TF.previewFacts(p); const a = S.answers; const gen = generated();
    const src = t(`entry.preview.source.${S.route}`);
    const factsLine = [t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), t("entry.preview.sets", { n: f.sets }), TF.durationLabel(t, p)].filter(Boolean);
    const cs = S.before ? changeSet(S.before, p) : null;
    let facts = "";
    if (gen) {
      facts = `<section class="e-answers" aria-label="${esc(t("e.rev.answers"))}">${factGroup("eAnsLab", t("e.rev.answers"), FACTS_REC, a)}${S.route === "recommend" ? factGroup("eOptLab", t("e.rev.optional"), ["prio", "avoid"], a) : factGroup("eChoLab", t("e.rev.choices"), ["emph", "prefs", "shape"], a)}<p class="t-caption e-answers__hint">${esc(t("e.rev.answers_hint"))}</p>${S.fact ? factEditor() : ""}</section>`;
    } else if (S.route === "browse") {
      facts = `<p class="t-small t-soft e-for">${esc(t("e.rev.for", { days: a.daysPerWeek, minutes: a.sessionMinutes, env: t(`entry.environment.${a.environment.kind}`) }))}</p>`;
    } else if (S.route === "shared") {
      const m = p.sharedMeta || {}; facts = `<p class="t-small t-soft e-for">${esc(t("e.rev.source_days", { n: m.daysPerWeek || p.frequency }))}</p>`;
    }
    const reasons = gen ? `<section class="e-sec" aria-labelledby="eWhyLab"><h2 class="t-label" id="eWhyLab">${esc(t("entry.result.why"))}</h2><ul class="e-why">${TS.reasons(t, lang, S.result, A(), { custom: S.route === "custom" }).map((r) => `<li><span class="icon-mask icon-mask--${r.icon}" aria-hidden="true"></span><span>${esc(r.text)}</span></li>`).join("")}</ul></section>` : "";
    const adj = TS.adjustments(t, p);
    const adjusted = gen ? `<section class="e-sec" aria-labelledby="eAdjLab"><h2 class="t-label" id="eAdjLab">${esc(t("e.rev.adjusted"))}</h2>${adj.length ? `<ul class="e-why e-why--plain">${adj.map((c) => `<li><span>${esc(c.text)}</span></li>`).join("")}</ul>` : `<p class="t-small t-soft">${esc(t("entry.preview.compromises_none"))}</p>`}</section>` : "";
    const progression = !gen ? `<section class="e-sec" aria-labelledby="eProgLab"><h2 class="t-label" id="eProgLab">${esc(t("entry.preview.progression"))}</h2><p class="t-small">${esc(t(TF.progressionCopyKey(p)))}</p>${S.route === "browse" && S.card ? `<p class="t-small t-soft">${esc(t("entry.catalogue.equipment", { equipment: (S.card.equipment || []).map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</p>` : ""}</section>` : "";
    const determinism = gen ? `<p class="t-caption e-det">${esc(t("entry.result.lede"))}</p>` : "";
    const ways = gen ? `<section class="e-sec e-ways" aria-labelledby="eWaysRev"><h2 class="t-label" id="eWaysRev">${esc(t("e.ways.review_title"))}</h2><p class="t-small t-soft">${esc(t("e.ways.review_lede"))}</p><ul class="e-way-list">${OTHER_JOBS.filter((j) => j !== S.route).map((j) => wayRow(j, { carry: true })).join("")}</ul></section>` : "";
    const secondary = `<div class="stack stack--tight e-sec"><button type="button" class="btn" data-act="edit">${esc(t("entry.preview.edit"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div>`;
    return `<p class="t-label e-eyebrow">${esc(src)}</p><h1 class="t-feature e-name">${esc(TF.resultName(S.result, lang))}</h1>
      <p class="e-factsline">${factsLine.map((x) => `<span class="t-data">${esc(x)}</span>`).join('<span class="e-dot" aria-hidden="true"> · </span>')}</p>
      ${S.before ? changeBlock(S.before, p) : ""}
      ${S.notice === "conflict" ? TS.conflictNotice(t) : ""}
      ${facts}
      <section class="e-sec" aria-labelledby="eWeekLab"><h2 class="t-label" id="eWeekLab">${esc(t("e.rev.week"))}</h2>${daysView(p, cs && cs.added)}</section>
      ${gen ? constraintsBlock(a) : ""}${reasons}${adjusted}${progression}${determinism}${ways}${secondary}
      ${S.error ? `<p class="notice notice--error" id="eActErr" role="alert">${esc(S.error)}</p>` : ""}`;
  }

  /* ---------- browse list ---------- */
  function catalogueView() {
    const a = S.answers; const cards = TF.browseCards(A());
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    const label = (s) => t(`program.progression.strategy.${s}`, undefined, s);
    const range = (vals, exact, rng) => (Math.min(...vals) === Math.max(...vals) ? t(exact, { n: vals[0] }) : t(rng, { min: Math.min(...vals), max: Math.max(...vals) }));
    const card = (c) => {
      const name = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName;
      const ex = c.structureFacts.map((x) => x.exerciseCount), sets = c.structureFacts.map((x) => x.setCount);
      const mins = c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] });
      return `<li><button type="button" class="e-card" data-act="card" data-id="${esc(c.id)}" aria-label="${esc(t("e.cat.open_aria", { name: lang === "pt" ? c.namePt : c.name }))}"><span class="e-card__top"><span class="e-card__name">${esc(name)}</span><span class="t-data e-card__days">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span class="e-card__purpose">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span><span class="e-card__facts t-data">${esc(mins)} · ${esc(range(ex, "entry.catalogue.exercises_exact", "entry.catalogue.exercises_range"))} · ${esc(range(sets, "entry.catalogue.sets_exact", "entry.catalogue.sets_range"))}</span><span class="e-card__meta">${esc(t("entry.catalogue.progression", { progression: c.progressionStrategies.map(label).join(" · ") }))}</span><span class="e-card__meta">${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span>${c.mismatch ? `<span class="e-card__mismatch">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button></li>`;
    };
    const count = fits.length === 1 ? t("e.cat.count_one", { days: a.daysPerWeek }) : t("e.cat.count_many", { n: fits.length, days: a.daysPerWeek });
    return `<h1 class="t-title e-q__title">${esc(t("entry.catalogue.title"))}</h1><p class="t-lede">${esc(t("entry.catalogue.lede"))}</p>
      <section class="e-answers" aria-label="${esc(t("e.cat.for"))}">${factGroup("eForLab", t("e.cat.for"), ["days", "min", "env"], a)}${S.fact ? factEditor() : ""}</section>
      <p class="t-small e-count"${S.listNote ? ' role="status" aria-live="polite"' : ""}>${esc(count)}</p>
      ${fits.length ? `<section aria-labelledby="eFitLab"><h2 class="t-label" id="eFitLab">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</h2><ul class="e-cards">${fits.map(card).join("")}</ul></section>` : `<div class="notice"><strong>${esc(t("entry.catalogue.empty_title"))}</strong><p>${esc(t("entry.catalogue.empty_body"))}</p></div>`}
      ${others.length ? `<details class="disclosure e-others" data-open-key="others"${S.open.others ? " open" : ""}><summary>${esc(t("entry.catalogue.group_other"))} (${others.length})<span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body"><ul class="e-cards">${others.map(card).join("")}</ul></div></details>` : ""}`;
  }

  /* ---------- import ---------- */
  function importView() {
    if (S.importDraft) {
      return `<h1 class="t-title e-q__title">${esc(t("import.heading"))}</h1><p class="t-lede">${esc(t("import.lede"))}</p><p class="t-small t-soft" data-user-text>${esc(S.importDraft.fileName)}</p>${TS.importReview.counts(t, S.importDraft)}${TS.importReview.rows(t, lang, S.importDraft, { picker: S.picker })}<p class="t-caption">${esc(t("import.safe"))}</p>`;
    }
    const tab = (m, k) => `<button type="button" class="btn btn--quiet e-mode${S.importMode === m ? " is-on" : ""}" data-act="import-mode" data-mode="${m}" aria-pressed="${S.importMode === m}">${esc(t(k))}</button>`;
    const modes = `<div class="e-modes" role="group" aria-label="${esc(t("e.imp.mode"))}">${tab("freeform", "e.imp.paste")}${tab("file", "e.imp.file")}</div>`;
    const build = `<button type="button" class="btn btn--link e-inline-way" data-act="switch" data-route="build">${esc(t("e.imp.build"))}</button>`;
    if (S.importMode === "freeform") return `<h1 class="t-title e-q__title">${esc(t("entry.freeform.title"))}</h1>${modes}<p class="t-lede">${esc(t("entry.freeform.lede"))}</p>${TS.freeform.body(t, lang, S.ff)}${build}`;
    return `<h1 class="t-title e-q__title">${esc(t("entry.import_source.title"))}</h1>${modes}<p class="t-lede">${esc(t("entry.import_source.lede"))}</p><button type="button" class="btn btn--block" data-act="import-file">${esc(t("entry.import_source.pick"))}</button><p class="t-caption">${esc(t("x.cost.file"))}</p>${build}`;
  }

  /* ---------- build ---------- */
  function buildSetupView() {
    const a = S.answers;
    return `<h1 class="t-title e-q__title">${esc(t("entry.build_setup.title"))}</h1><p class="t-lede">${esc(t("entry.build_setup.lede"))}</p>
      <label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="eName" type="text" autocomplete="off" data-field="eName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>
      <p class="t-label" id="eBDays">${esc(t("entry.build_setup.days"))}</p>${radios("eBDays", TS.DAYS.map((n) => numUnit("daysPerWeek", n, t("e.unit.days"), a.daysPerWeek === n)).join(""), "e-num")}`;
  }

  /* ---------- route view ---------- */
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    const r = S.route, s = S.step;
    if (r === "recommend") { if (s === "desired_result") return TF.hasActiveProgram() ? "hub-existing" : "rec-goal"; return { background: "rec-background", schedule: "rec-schedule", environment: "rec-environment", result: "rec-result" }[s] || ""; }
    if (r === "custom") return { priorities: "custom-priorities", exercise_preferences: "custom-exercises", custom_shape: "custom-shape", result: "custom-result" }[s] || "";
    if (r === "browse") return { schedule: "browse-filters", environment: "browse-filters", catalogue: "browse-list", preview: "browse-preview" }[s] || "";
    if (r === "build") { if (s === "build_setup") return "build-setup"; const filled = S.build.days.filter((d) => d.exercises.length).length; return filled === 0 ? "build-empty" : filled < S.build.days.length ? "build-partial" : "build-ready"; }
    if (r === "import") { if (s === "preview") return "import-preview"; if (S.importDraft) return "import-review"; if (S.importMode === "file") return "import-source"; const ff = S.ff; if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps"; if (ff.status === "unreadable") return "ff-unreadable"; return ff.stage === 1 ? (ff.input ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply"; }
    if (r === "shared") return "shared-preview";
    return "";
  }
  function pin(inner) { return `<footer class="pinned e-pin" data-persistent-action>${inner}</footer>`; }
  function routeView() {
    let body = "", footer = "", prog = "";
    const q = curQ();
    if (q) {
      body = questionView(); prog = progress();
      const iss = qIssues(); const pending = S.avoid.pending || S.pref.pending;
      const reason = pending ? "" : iss.length ? `<p class="e-pin__why" id="eWhy">${esc(iss[0] === "e_pick" ? t("e.q.pick") : TS.issueText(t, iss))}</p>` : "";
      const blocked = iss.length || pending;
      footer = pin(`${reason}<button type="button" class="btn btn--primary" data-advance data-act="next"${blocked ? ` disabled aria-describedby="${pending ? "pendingAvoidNote" : "eWhy"}"` : ""}>${esc(advanceLabel())}</button>`);
    } else if (S.step === "catalogue") body = catalogueView();
    else if (S.step === "build_setup") {
      body = buildSetupView();
      const a = S.answers; const why = !a.programName ? t("x.issue.program_name") : !a.daysPerWeek ? t("e.build.days") : "";
      footer = pin(`${why ? `<p class="e-pin__why" id="eWhy">${esc(why)}</p>` : ""}<button type="button" class="btn btn--primary" data-advance data-act="next"${why ? ' disabled aria-describedby="eWhy"' : ""}>${esc(t("entry.build_setup.open"))}</button>`);
    } else if (S.step === "import_source") {
      body = importView();
      if (S.importDraft) { const c = TF.importCounts(S.importDraft); footer = pin(`${c.review ? `<p class="e-pin__why" id="eImpWhy">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}<button type="button" class="btn btn--primary" data-act="import-commit"${c.review ? ' disabled aria-describedby="eImpWhy"' : ""}>${esc(t("import.commit"))}</button>`); }
    } else if ((S.route === "build" && S.step === "editor") || S.editing) {
      const forBuild = S.route === "build";
      const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
      const head = forBuild ? `<h1 class="t-title e-q__title">${esc(t("entry.editor.title"))}</h1><p class="t-small t-soft" data-user-text>${esc(S.build.name)}</p>` : `<p class="t-label e-eyebrow">${esc(t("entry.preview.edit"))}</p><h1 class="t-feature e-name">${esc(TF.resultName(S.result, lang))}</h1><button type="button" class="btn btn--block" data-act="edit-done">${esc(t("e.edit_done"))}</button>`;
      body = head + TS.build.editor(t, lang, S.build) + TS.build.statusLine(st) + (S.error ? `<p class="notice notice--error" id="eActErr" role="alert">${esc(S.error)}</p>` : "");
      footer = pin(`<button type="button" class="btn btn--primary" data-activate data-act="activate"${st.ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(t(forBuild ? "entry.editor.use" : TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.preview.activate_first"))}</button>`);
    } else if (S.step === REVIEW[S.route] && S.result) {
      body = reviewView();
      if (S.notice !== "conflict" && !S.fact) footer = pin(`<button type="button" class="btn btn--primary" data-activate data-act="activate">${esc(t(TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.preview.activate_first"))}</button>`);
    } else body = `<p class="notice notice--error" role="alert">${esc(S.error || t("x.issue.generic"))}</p>`;
    const sw = S.origin && atEntryPoint() ? `<div class="e-switch" role="status"><p class="t-small">${esc(t("e.switch.note", { route: routeName(S.origin.from || "recommend") }))}</p><button type="button" class="btn btn--link" data-act="origin-back">${esc(t("e.switch.back"))}</button></div>` : "";
    const cp = checkpointFor();
    return `<div class="page e-page${q ? " e-page--q" : ""}">${topBar()}${prog}
      <main class="stack e-main view-enter" data-entry-step="${esc(entryStep())}"${S.editing ? " data-editor" : ""}${cp ? ` data-checkpoint="${esc(cp)}"` : ""}>${sw}${body}</main>${footer}</div>`;
  }

  /* ---------- landing, gate, today ---------- */
  const brand = () => `<header class="e-brand"><span class="e-brand__lock"><img src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="30" height="30"><span class="e-brand__word">Taurifer</span></span>${TS.privacyButton(t)}</header>`;
  function resumeCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") return TS.rulesNotice(t, { keep: info.route === "import" || info.route === "shared" });
    const f = TS.resumeFacts(t, lang, info); const step = info.route === "recommend" && info.step === "priorities" ? t("entry.priorities.title") : f.step;
    return `<section class="e-resume" data-checkpoint="resume" aria-labelledby="eResTitle"><h2 class="t-subtitle" id="eResTitle">${esc(t("entry.resume.title"))}</h2><p class="t-small t-soft">${esc(t("e.resume.where", { route: f.route, step, date: f.when }))}</p><button type="button" class="btn btn--primary btn--noarrow" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="resume-discard" aria-haspopup="dialog">${esc(t("e.resume.discard"))}</button></section>`;
  }
  function landingView() {
    const invalid = S.view === "shared-invalid";
    return `<main class="page e-landing" data-checkpoint="${invalid ? "shared-invalid" : "landing"}">${brand()}
      <h1 class="e-headline" tabindex="-1">${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1><p class="t-lede e-land__lede">${esc(t(invalid ? "landing.shared.invalid_body" : "landing.body"))}</p>
      ${invalid ? `<p class="status-line e-land__status" role="status"><span class="icon-mask icon-mask--alert" aria-hidden="true"></span><span>${esc(t(TF.sharedErrorKey(S.sharedError)))}</span></p>` : resumeCard()}
      <div class="e-land__acts"><button type="button" id="firstRunCreate" class="btn btn--primary btn--accent" data-act="land-create">${esc(t("landing.build"))}</button><p class="t-caption e-land__cap">${esc(t("e.land.start_cap"))}</p>
      <button type="button" id="firstRunImport" class="btn btn--bordered btn--block" data-act="land-import">${esc(t("landing.track"))}</button></div>
      ${invalid ? "" : TS.landingProof(t, lang)}<p class="t-caption e-land__privacy">${esc(t("x.privacy.line"))}</p></main>`;
  }
  function gateView() {
    const m = S.shared.program.meta;
    return `<main class="page e-landing e-gate" data-checkpoint="shared-gate">${brand()}
      <p class="t-label e-eyebrow">${esc(t("landing.shared.eyebrow"))}</p><h1 class="e-headline" tabindex="-1">${esc(t("landing.shared.headline"))}</h1><p class="t-lede e-land__lede">${esc(t("landing.shared.body"))}</p>
      <div class="e-land__acts"><button type="button" id="firstRunSharedStart" class="btn btn--primary btn--accent" data-act="shared-start">${esc(t("setup.shared.title"))}</button><p class="t-caption e-land__cap" data-user-text>${esc(t(m.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: m.name, n: m.daysPerWeek }))}</p></div>
      <section class="e-gate__what" aria-labelledby="eGateWhat"><h2 class="t-label" id="eGateWhat">${esc(t("e.gate.what"))}</h2><p class="t-small">${esc(t("x.shared.what"))}</p><p class="t-small">${esc(t("x.shared.nothing_saved"))}</p></section>
      <p class="t-caption e-land__privacy">${esc(t("x.privacy.line"))}</p></main>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return TS.cancelSheet(t);
    if (S.overlay === "replace") return TS.replaceSheet(t, TF.activeName(lang), TF.resultName(S.result, lang), TF.device.sessions);
    if (S.overlay === "restart") return TS.restartSheet(t, { shared: S.route === "shared" });
    if (S.overlay === "discard") { const info = TF.loadDraft(); const f = info ? TS.resumeFacts(t, lang, info) : { when: "" }; return `<div class="sheet-scrim" data-act="discard-cancel"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="eDiscTitle" aria-describedby="eDiscBody" data-confirm="discard-draft"><h2 id="eDiscTitle" tabindex="-1">${esc(t("e.discard.title"))}</h2><p id="eDiscBody">${esc(t("e.discard.body", { date: f.when }))}</p><div class="stack stack--tight"><button type="button" class="btn btn--destructive" data-act="discard-confirm">${esc(t("e.discard.confirm"))}</button><button type="button" class="btn" data-act="discard-cancel">${esc(t("e.discard.cancel"))}</button></div></div>`; }
    return "";
  }

  /* ---------- render ---------- */
  function render(focus) {
    const active = document.activeElement; const saved = active && active.id;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (S.view === "route") html = routeView();
    else if (S.view === "shared-gate") html = gateView();
    else html = landingView();
    root.innerHTML = html + overlayView();
    if (S.overlay) { const h = root.querySelector(".dialog h2"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e) {} } return; }
    if (S.focusAfter) { const el = root.querySelector(S.focusAfter); S.focusAfter = null; if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} return; } }
    if (saved && /Search|ffIn|ffOut|eName|pickerSearch/.test(saved) && !focus) TS.refocus(root, saved);
    else if (focus) { try { window.scrollTo(0, 0); } catch (e) {} TS.focusHeading(root); }
  }
  /* Opening an inline editor: focus its heading, then scroll so its confirm
     control is fully in view (the pinned activation is hidden while an
     editor is open, so nothing sits over it). */
  function revealEditor() {
    const ed = root.querySelector("#eEdit"); if (!ed) return;
    const h = ed.querySelector("h2"); try { h.focus({ preventScroll: true }); } catch (e) {}
    const ok = ed.querySelector('[data-act="fact-apply"]'); const r = ed.getBoundingClientRect(); const o = ok.getBoundingClientRect();
    const top = r.top + window.scrollY - 12;
    if (o.bottom - r.top + 24 <= window.innerHeight) window.scrollTo(0, Math.max(0, top));
    else window.scrollTo(0, Math.max(0, o.bottom + window.scrollY - window.innerHeight + 16));
  }
  function openFact(k) {
    S.fact = k; S.fa = clone(S.answers); S.factError = null; S.avoid = { query: "", pending: null }; S.pref = { query: "", pending: null }; S.envOpen = false; S.cpPanel = null;
    render(); revealEditor();
  }
  function closeFact() { const k = S.fact; S.fact = null; S.fa = null; S.factError = null; S.avoid = { query: "", pending: null }; S.pref = { query: "", pending: null }; S.cpPanel = null; S.focusAfter = `#eFact-${k}`; render(); }
  const sameJSON = (x, y) => JSON.stringify(A(x)) === JSON.stringify(A(y));
  function applyFact() {
    if (S.avoid.pending || S.pref.pending) return;
    const k = S.fact; const next = clone(S.fa);
    if (S.route === "browse") { S.answers = next; S.fact = null; S.fa = null; S.listNote = true; S.lastFact = k; S.focusAfter = `#eFact-${k}`; render(); return; }
    if (sameJSON(next, S.answers)) { closeFact(); return; }
    const r = compileWith(next);
    if (!r.ok) { S.factError = r.error; render(); return; }
    S.before = S.result.preview; S.answers = next; S.result = r.result; S.lastFact = k;
    S.fact = null; S.fa = null; S.factError = null; S.cpPanel = null; S.cpTag = null; S.avoid = { query: "", pending: null }; S.pref = { query: "", pending: null };
    S.open = Object.fromEntries(Object.entries(S.open).filter(([key]) => !key.startsWith("day:")));
    S.focusAfter = `#eFact-${k}`; render();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function restoreConstraint(id) {
    const next = clone(S.answers); next.exerciseConstraints = (next.exerciseConstraints || []).filter((c) => c.exerciseId !== id);
    const r = compileWith(next); if (!r.ok) { S.error = r.error; render(); return; }
    S.before = S.result.preview; S.answers = next; S.result = r.result; S.lastFact = "avoid"; S.cpTag = null;
    S.focusAfter = "#eFact-avoid"; render(); try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* ---------- actions ---------- */
  function resumeFrom(info, { rebuild = false } = {}) {
    const st = info.state; S.origin = null;
    enterRoute(st.route, clone(st.answers));
    S.step = st.step; S.sub = (info.ui && info.ui.sub) || 0; S.revAtStart = rebuild ? TF.liveRevision() : st.activeProgramRevisionAtStart;
    if (S.route === "import") { S.step = "import_source"; }
    if (S.route === "build") { S.step = "build_setup"; }
    if (S.route === "recommend" && S.step === "priorities") { S.step = "result"; compileNow(); render(true); openFact("prio"); return; }
    if (S.step === "result" || S.step === "preview") { if (!rebuild && st.result) S.result = clone(st.result); else if (generated()) compileNow(); if (!S.result) { const l = lastQuestion(); S.step = l.step; S.sub = l.sub; } }
    render(true);
  }
  function on(act, d) {
    S.cpTag = act === "pick" || act.startsWith("field:") || act === "fact" ? S.cpTag : null;
    const tgt = () => (S.fact ? "fa" : "answers");
    switch (act) {
      case "land-create": S.origin = null; enterRoute("recommend", {}); render(true); return;
      case "land-import": S.origin = null; enterRoute("import", {}, { mode: "freeform" }); render(true); return;
      case "switch": switchTo(d.route, { mode: d.mode }); return;
      case "origin-back": restoreOrigin(); return;
      case "help-pick": S.help = d.job; S.open.help = true; render(); return;
      case "help-go": if (d.helpResult === S.route) { S.open.help = false; S.help = null; render(true); return; } switchTo(d.helpResult, { mode: d.helpResult === "import" ? "freeform" : undefined }); return;
      case "pick": {
        const k = tgt();
        if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
        const before = S[k].environment && S[k].environment.kind;
        S[k] = TS.applyPick(S[k], d.key, d.val);
        if (d.key === "environment" && S.fact && d.val !== (S.answers.environment && S.answers.environment.kind)) S.envOpen = true;
        if (d.key === "environment" && !S.fact && before && before !== d.val) S.envOpen = false;
        if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
        render(); return;
      }
      case "next": advance(); return;
      case "back": back(); return;
      case "cancel": if (S.route === "shared") { toGate(); return; } S.fact = null; S.overlay = "cancel"; render(); return;
      case "cancel-continue": S.overlay = null; S.focusAfter = '[data-act="cancel"]'; render(); return;
      case "cancel-keep": keepDraft(); S.overlay = null; leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); S.overlay = null; S.answers = {}; S.bank = {}; S.result = null; leaveSetup(); return;
      case "resume": { const info = TF.loadDraft(); if (info && info.status === "resumable") resumeFrom(info); return; }
      case "resume-discard": S.overlay = "discard"; render(); return;
      case "discard-cancel": S.overlay = null; S.focusAfter = '[data-act="resume-discard"]'; render(); return;
      case "discard-confirm": TF.clearDraft(); S.overlay = null; render(true); return;
      case "rules-rebuild": { const info = TF.loadDraft(); TF.clearDraft(); if (info && info.state) resumeFrom(info, { rebuild: true }); else render(true); return; }
      case "rules-keep": { const info = TF.loadDraft(); if (info && info.state) resumeFrom(info); return; }
      case "fact": if (S.fact === d.fact) { closeFact(); return; } openFact(d.fact); return;
      case "fact-apply": applyFact(); return;
      case "fact-close": closeFact(); return;
      case "restore": restoreConstraint(d.id); return;
      case "avoid-add": S.avoid.pending = d.id; S.avoid.query = ""; render(); return;
      case "avoid-remove": { const k = tgt(); S[k] = { ...S[k], exerciseConstraints: (S[k].exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) }; if (S.avoid.pending === d.id) S.avoid.pending = null; if (S.pref.pending === d.id) S.pref.pending = null; render(); return; }
      case "pref-add": { const k = tgt(); if (d.status === "include") S[k] = { ...S[k], mustHaveExercises: [...(S[k].mustHaveExercises || []), d.id] }; else S.pref.pending = d.id; S.pref.query = ""; render(); return; }
      case "pref-remove": { const k = tgt(); S[k] = { ...S[k], mustHaveExercises: (S[k].mustHaveExercises || []).filter((x) => x !== d.id), exerciseConstraints: (S[k].exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) }; if (S.pref.pending === d.id) S.pref.pending = null; render(); return; }
      case "field:avoidQuery": S.avoid.query = d.value; render(); return;
      case "field:prefQuery": S.pref.query = d.value; render(); return;
      case "field:eName": S.answers = { ...S.answers, programName: d.value.trim() }; render(); return;
      case "field:dayName": S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return;
      case "field:rx": case "change:rx": S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return;
      case "field:pickerQuery": if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return;
      case "build": S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(); return;
      case "pick-exercise": if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return;
      case "card": { const c = TF.browseCards(A()).find((x) => x.id === d.id); if (!c) return; S.answers = { ...S.answers, catalogueSelection: c.id }; S.card = { id: c.id, equipment: c.equipmentAssumptions }; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.step = "preview"; S.before = null; render(true); return; }
      case "import-mode": S.importMode = d.mode; S.importDraft = null; S.ff = TS.freeform.create(); render(); return;
      case "import-file": S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("e.imp.file_name"), "file"); render(true); return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return;
      case "import-commit": S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.step = "preview"; S.importDraft = null; S.before = null; render(true); return;
      case "ff": {
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
        else if (d.ff === "copy-repair") S.toast = t("entry.freeform.toast_repair_copied");
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); render(true); return; }
        if (d.ff === "gap-submit" && S.ff.gapErrors.size) { render(); const n = root.querySelector(".notice--error[role=alert]"); if (n) { n.setAttribute("tabindex", "-1"); try { n.focus(); } catch (e) {} } return; }
        render(); return;
      }
      case "field:ffInput": S.ff = TS.freeform.apply(S.ff, "input", d.value); render(); return;
      case "field:ffReply": S.ff = TS.freeform.apply(S.ff, "reply", d.value); return;
      case "field:gap": S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return;
      case "shared-start": S.view = "route"; S.route = "shared"; S.step = "preview"; S.answers = {}; S.result = TF.sharedResult(S.shared); S.before = null; S.revAtStart = TF.liveRevision(); S.origin = null; render(true); return;
      case "edit": S.build = TS.build.fromPreview(S.result.preview, { name: TF.resultName(S.result, lang) }); S.editing = true; render(true); return;
      case "edit-done": { const next = TS.build.commit(S.result, S.build); if (JSON.stringify(next.preview.program) !== JSON.stringify(S.result.preview.program)) S.before = S.result.preview; S.result = next; S.editing = false; S.build = null; render(true); return; }
      case "activate": requestActivate(); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; S.focusAfter = "[data-activate]"; render(); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return;
      case "restart": S.overlay = "restart"; render(); return;
      case "restart-cancel": S.overlay = null; S.focusAfter = '[data-act="restart"]'; render(); return;
      case "restart-confirm": {
        const shared = S.route === "shared"; S.overlay = null; S.origin = null; S.bank = {};
        if (shared) { S.shared = null; S.view = "landing"; S.route = null; S.result = null; render(true); return; }
        const route = S.route; enterRoute(route === "import" || route === "build" ? route : route, {}); render(true); return;
      }
      default: return;
    }
  }

  /* ---------- checkpoint reach (states built through the same functions) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  function at(route, step, a, sub = 0) { enterRoute(route, a); S.step = step; S.sub = sub; S.result = null; S.before = null; }
  function review(route, a) { enterRoute(route, a); S.step = "result"; S.sub = 0; compileNow(); }
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("e.imp.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  function correctedEnv() { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; }
  async function reach(cp) {
    const u = TF.F.users;
    const build = (plan) => { enterRoute("build", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.step = "editor"; S.build = TS.build.create(S.answers.programName, 3); for (const [d, id] of plan) { S.build.picker = d; S.build = TS.build.apply(S.build, "add", id); } };
    const ffv = (ff) => { enterRoute("import", {}, { mode: "freeform" }); S.ff = ff; };
    switch (cp) {
      case "landing": case "resume": case "rules-changed": S.view = "landing"; break;
      case "route-choice": case "rec-goal": case "hub-existing": enterRoute("recommend", {}); break;
      case "route-help": enterRoute("recommend", {}); S.open.help = true; break;
      case "rec-background": at("recommend", "background", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": at("recommend", "environment", rafael()); break;
      case "rec-env-correction": { const a = rafael(); a.environment = correctedEnv(); at("recommend", "environment", a); S.envOpen = true; S.cpTag = cp; break; }
      case "rec-result": case "activate": case "replace-confirm": review("recommend", rafael()); if (cp === "activate") S.cpTag = cp; if (cp === "replace-confirm") S.overlay = "replace"; break;
      case "rec-priorities": review("recommend", rafael()); render(); openFact("prio"); return;
      case "rec-result-corrected": { review("recommend", rafael()); const before = S.result.preview; S.answers = { ...S.answers, environment: correctedEnv() }; compileNow(); S.before = before; S.lastFact = "env"; S.cpTag = cp; break; }
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; review("recommend", a); render(); openFact("avoid"); S.fa.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; S.cpPanel = cp; render(); revealEditor(); return; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; const without = compileWith(clone(a)); a.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; review("recommend", a); S.before = without.ok ? without.result.preview : null; S.lastFact = "avoid"; S.cpTag = cp; break; }
      case "browse-filters": enterRoute("browse", {}); break;
      case "browse-list": enterRoute("browse", TF.fixtureAnswers("browse")); break;
      case "browse-preview": enterRoute("browse", TF.fixtureAnswers("browse")); on("card", { id: "balanced_4_v1" }); return;
      case "custom-priorities": at("custom", "priorities", TF.fixtureAnswers("custom")); break;
      case "custom-exercises": at("custom", "exercise_preferences", TF.fixtureAnswers("custom")); break;
      case "custom-shape": at("custom", "custom_shape", ensureSplit(TF.fixtureAnswers("custom"))); break;
      case "custom-result": review("custom", TF.fixtureAnswers("custom")); break;
      case "build-setup": enterRoute("build", {}); break;
      case "build-empty": build([]); break;
      case "build-partial": build([["manual_d1", "pd_bw"]]); break;
      case "build-ready": build([["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]); break;
      case "ff-empty": ffv(TS.freeform.create()); break;
      case "ff-filled": ffv(ffAt(1)); break;
      case "ff-handoff": ffv(ffAt(2)); break;
      case "ff-reply": ffv(ffAt(3)); break;
      case "ff-gaps": ffv(ffAt(3, TF.F.freeform.replyGaps[lang])); break;
      case "ff-gaps-invalid": ffv(TS.freeform.apply(ffAt(3, TF.F.freeform.replyGaps[lang]), "gap-submit")); break;
      case "ff-unreadable": ffv(ffAt(3, TF.F.freeform.replyUnreadable[lang])); break;
      case "import-source": enterRoute("import", {}, { mode: "file" }); break;
      case "import-review": enterRoute("import", {}, { mode: "file" }); S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("e.imp.file_name"), "file"); break;
      case "import-preview": enterRoute("import", {}, { mode: "file" }); S.importDraft = importDecided(); on("import-commit", {}); return;
      case "shared-gate": case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "shared-gate" : "shared-invalid"; S.sharedError = r.ok ? null : r.code; if (cp === "shared-preview" && r.ok) { on("shared-start", {}); return; } break; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "shared-invalid"; S.sharedError = r.code; break; }
      case "activation-conflict": review("recommend", rafael()); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; break;
      case "activated-today": review("recommend", rafael()); activateNow(); return;
      default: S.view = "landing";
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const restVal = (v) => (v === null || v === undefined ? "auto" : v);
  async function answerQuestions(api, a, { rest = true } = {}) {
    await api.tap(pickKey("desiredResult", a.desiredResult)); await api.tap("[data-advance]");
    await api.tap(pickKey("structuredExperience", a.structuredExperience)); await api.tap("[data-advance]");
    await api.tap(pickKey("recentConsistency", a.recentConsistency)); await api.tap("[data-advance]");
    await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap("[data-advance]");
    await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap("[data-advance]");
    if (rest) { await api.tap(pickKey("preferredRestSeconds", restVal(a.preferredRestSeconds))); await api.tap("[data-advance]"); }
    await api.tap(pickKey("environment", a.environment.kind)); await api.tap("[data-advance]");
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function addExercise(api, dayId, id) {
    await api.tap(`[data-build="open-picker"][data-day="${dayId}"]`);
    await api.type("#pickerSearch", TF.libraryName(TF.libraryEntry(id), api.lang));
    await api.tap(`[data-act="pick-exercise"][data-id="${id}"]`);
  }
  async function decideRows(api) { for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  async function avoidFromReview(api) {
    await api.tap('[data-act="fact"][data-fact="avoid"]');
    await api.type("#avoidSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang));
    await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
  }
  const journeys = {
    async "activate.recommend"(api) { await api.tap("#firstRunCreate"); await answerQuestions(api, TF.fixtureAnswers("rafael")); api.snapshot("review"); await activateAndWait(api); },
    async "activate.custom"(api) {
      const a = TF.fixtureAnswers("custom");
      await api.tap('[data-act="switch"][data-route="custom"]');
      await answerQuestions(api, a);
      for (const m of a.primaryMuscles) await api.tap(pickKey("musclePriority", `${m}|prioritize`));
      for (const m of a.deEmphasizedMuscles) await api.tap(pickKey("musclePriority", `${m}|deemphasize`));
      await api.tap("[data-advance]");
      for (const id of a.mustHaveExercises) { await api.type("#prefSearch", TF.libraryName(TF.libraryEntry(id), api.lang)); await api.tap(`[data-act="pref-add"][data-id="${id}"][data-status="include"]`); }
      for (const c of a.exerciseConstraints) { await api.type("#prefSearch", TF.libraryName(TF.libraryEntry(c.exerciseId), api.lang)); await api.tap(`[data-act="pref-add"][data-id="${c.exerciseId}"][data-status="avoid"]`); await api.tap(pickKey("avoidReason", `${c.exerciseId}|${c.reason}`)); }
      await api.tap("[data-advance]"); /* default structure preselected */
      await api.tap("[data-advance]");
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.browse"(api) {
      const a = TF.fixtureAnswers("browse");
      await api.tap('[data-act="switch"][data-route="browse"]');
      await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap("[data-advance]");
      await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap("[data-advance]");
      await api.tap(pickKey("environment", a.environment.kind)); await api.tap("[data-advance]");
      await api.tap('[data-act="card"][data-id="balanced_4_v1"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.build"(api) {
      await api.tap('[data-act="switch"][data-route="build"]');
      await api.type("#eName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
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
      await api.type("#eName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
      api.snapshot("empty"); await addExercise(api, "manual_d1", "pd_bw"); api.snapshot("partial");
      await addExercise(api, "manual_d2", "rw_bb"); await addExercise(api, "manual_d3", "sq_lp"); api.snapshot("ready"); await activateAndWait(api);
    },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "cancel.keep-resume"(api) {
      await api.tap(pickKey("daysPerWeek", 4)); api.snapshot("before");
      await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); api.snapshot("kept");
      await api.tap('[data-act="resume"]'); api.snapshot("resumed");
    },
    async "back.recommend"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.custom"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.browse"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.import"(api) { await decideRows(api); api.snapshot("decided"); await api.tap('[data-act="import-commit"]'); api.snapshot("preview"); await api.tap('[data-act="back"]'); api.snapshot("back"); },
    async "back.shared"(api) { await api.tap('[data-act="back"]'); },
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.discard-draft"(api) { await api.tap('[data-act="cancel"]'); api.snapshot("asked"); await api.tap('button[data-act="cancel-discard"]'); api.snapshot("discarded"); },
    async "existing.back"(api) { await api.tap('[data-act="back"]'); },
    async "existing.cancel-keep"(api) { await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap("[data-advance]"); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap("[data-advance]"); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async "avoid.pain"(api) {
      /* E's rec-priorities is the review with the optional priorities editor
         open. Chest is applied there first (its own recompile), then the avoid
         editor states the avoidance's own consequence. */
      await api.tap(pickKey("primaryMuscles", "chest")); await api.tap('[data-act="fact-apply"]');
      await avoidFromReview(api); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned");
      await api.tap("[data-advance]"); api.snapshot("review");
    },
    async overlays(api) {
      for (const k of [...FACTS_REC, "prio", "avoid"]) { await api.tap(`[data-act="fact"][data-fact="${k}"]`); await api.checkOverlay('[data-act="fact-apply"]', k); await api.tap('[data-act="fact-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-act="fact"][data-fact="days"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="fact-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      const c = TF.F.users.rafael.correction;
      api.mark("start"); await api.tap('[data-act="fact"][data-fact="env"]');
      await api.tap(pickKey("environment", c.environmentKind));
      for (const k of c.equipmentAdd) await api.tap(pickKey("environmentEquipment", k));
      for (const k of c.capabilitiesAdd) await api.tap(pickKey("environmentCapabilities", k));
      await api.tap('[data-act="fact-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await avoidFromReview(api); await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="fact-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      const a = TF.fixtureAnswers("rafael");
      const steps = [["desiredResult", a.desiredResult], ["structuredExperience", a.structuredExperience], ["recentConsistency", a.recentConsistency], ["daysPerWeek", a.daysPerWeek], ["sessionMinutes", a.sessionMinutes], ["preferredRestSeconds", restVal(a.preferredRestSeconds)], ["environment", a.environment.kind]];
      for (const [k, v] of steps) { await api.probe(`missing:${k}`); await api.tap(pickKey(k, v)); await api.tap("[data-advance]"); }
      api.snapshot("review");
    },
    async "chooser.doors"(api) {
      /* Under PD-1 the chooser is Recommend's first question: the Recommend
         door is the screen itself, the other four are its visible list. */
      api.snapshot("door:recommend");
      for (const job of ["custom", "browse", "build", "import"]) { await api.tap(`[data-act="switch"][data-route="${job}"]`); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]'); }
    },
  };
  for (const job of OTHER_JOBS) journeys[`help.${job}`] = async (api) => { await api.tap({ selector: "summary", text: t("e.help.summary") }); await api.tap(`[data-act="help-pick"][data-job="${job}"]`); await api.tap("[data-help-go]"); api.snapshot("end"); };

  /* ---------- export ---------- */
  function wire() {
    TS.wire(root, on);
    /* Remember disclosure state (<details> toggled natively) across renders. */
    root.addEventListener("toggle", (ev) => { const el = ev.target; if (!(el instanceof HTMLDetailsElement)) return; if (el.dataset.openKey) S.open[el.dataset.openKey] = el.open; if (el.dataset.role === "env-correction") S.envOpen = el.open; }, true);
  }
  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.e = {
    id: "e", name: "E · Uma pergunta por vez", policy: { productDecisions: ["PD-1"] },
    thesis: "Start is a conversation, not a menu: one question at a time, with every other route one explicit, reversible step away from the question and from the program.",
    axis: "Deferred route choice (PD-1); one question per screen; the review is the hub with inline answer editing.",
    async mount(c) { lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); wire(); render(); },
    reach,
    /* The result is what activation would commit: the Build draft in the
       Build editor, the committed edit in Edit before using. */
    entry: () => (S.view === "route" && S.route ? TF.jsonClean({ route: S.route, step: entryStep(), answers: A(), result: S.route === "build" && S.build && S.step === "editor" ? TS.build.result(S.build) : S.editing && S.build && S.result ? TS.build.commit(S.result, S.build) : S.result }) : null),
    journeys,
    state: () => S,
  };
})();
