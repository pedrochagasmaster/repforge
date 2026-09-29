/* F · A primeira pergunta
 *
 * Thesis: choosing a route should cost nothing extra, so the chooser opens on
 * Recommend's first question (answering it is choosing Recommend), and every
 * screen after that keeps the program in view: answers as chips, each one
 * corrected in a bottom sheet and followed by a before/after count.
 *
 * Axis: route-choice cost inside the chooser (O-4) plus a program-centred
 * review. Open items, as allocated (round-2/generator-brief.md, column F):
 *   route choice  up-front chooser whose first door IS Recommend's first
 *                 question; the helper ends at each of the five jobs
 *   O-1  hybrid: goal + background on one screen, schedule alone,
 *        environment alone (Recommend 4 sections, Custom 6)
 *   O-2  priorities/avoid before the result
 *   O-3  the answers on the review are chips
 *   O-5  a before/after count (exercises and sets) plus the identity sentence
 *   O-6  routes from the review: chooser only
 *   O-7  a quiet "Agora não" on the shared gate that saves nothing
 *   O-8  the proof figure above the landing actions, both actions inside the
 *        first viewport at 390x844
 *   O-9  answer editing in a bottom sheet
 *   O-10 the resume card on the landing and on the chooser
 *   O-11 Build is the third door of the import route
 *   Minutes and rest are asked; no program is shown before the answers.
 *
 * Product policy: F depends on no product decision
 * (policy.productDecisions = []). No PD-1 to PD-5 dependency.
 */
(function () {
  "use strict";
  const { esc } = TF;

  /* ---------- copy: PT-BR first, EN at parity (f.* keys only) ---------- */
  const COPY = {
    pt: {
      "f.land.lede": "O Taurifer monta seu programa, registra cada série e calcula a meta da próxima sessão.",
      "f.land.word": "Taurifer",
      "f.hub.title": "Como você quer começar?",
      "f.hub.lede": "Responder à primeira pergunta já começa a recomendação.",
      "f.rec.eyebrow": "Recomendar um programa",
      "f.rec.facts": "São {n} seções curtas e esta é a primeira pergunta. O Taurifer escolhe a estrutura.",
      "f.hub.others": "Outros caminhos",
      "f.door.custom.cap": "Você escolhe a ênfase de cada músculo e os exercícios. O Taurifer escreve o programa.",
      "f.door.custom.fact": "{n} seções",
      "f.door.browse.fact": "1 tela de filtros, depois uma lista",
      "f.door.own.cap": "Cole um texto, importe um arquivo ou escreva do zero.",
      "f.door.paste": "Colar de qualquer lugar",
      "f.door.paste.cap": "Mensagem do treinador, suas notas ou uma planilha",
      "f.door.file": "Importar um arquivo",
      "f.door.build": "Escrever do zero",
      "f.door.build.cap": "Dias de treino vazios. Você escreve cada exercício.",
      "f.door.build.cap_import": "Abre Montar um programa, com dias vazios",
      "f.door.current": "aberta",
      "f.help.summary": "Não sabe qual escolher?",
      "f.help.q": "Qual frase combina mais com você agora?",
      "f.help.recommend": "Quero que o Taurifer decida o programa",
      "f.help.custom": "Sei quais músculos e exercícios quero",
      "f.help.browse": "Prefiro escolher um programa pronto",
      "f.help.build": "Quero escrever cada exercício",
      "f.help.import": "Já tenho um programa escrito",
      "f.help.suggest": "Comece por: {route}.",
      "f.help.why.recommend": "Você responde {n} seções curtas e o Taurifer escolhe a estrutura.",
      "f.help.why.custom": "Você escolhe a ênfase e os exercícios. O Taurifer escreve o programa.",
      "f.help.why.browse": "Você filtra por dias, tempo e local e escolhe um programa da lista.",
      "f.help.why.build": "Você começa com dias vazios e escreve cada exercício.",
      "f.help.why.import": "Você cola o texto ou escolhe um arquivo e revisa cada exercício.",
      "f.help.go": "Começar por aqui",
      "f.resume.label": "Configuração em andamento",
      "f.resume.when": "Guardada em {date}.",
      "f.resume.continue": "Continuar de onde parei",
      "f.discard.title": "Descartar a configuração guardada?",
      "f.discard.body": "As respostas guardadas de {route} saem deste dispositivo. Nenhum programa ativo muda.",
      "f.discard.cancel": "Manter a configuração",
      "f.sec.about": "Seu objetivo e seu treino recente",
      "f.sec.about.lede": "O objetivo define a estrutura. O treino recente define como começam as primeiras semanas.",
      "f.sec.goal": "Objetivo",
      "f.sec.goal.change": "Alterar",
      "f.sec.priorities": "Algo para priorizar ou evitar?",
      "f.sec.priorities.lede": "Opcional. Sem nenhuma escolha, o Taurifer distribui a atenção entre os músculos.",
      "f.sec.muscles": "Músculos para priorizar (até 2)",
      "f.sec.filters": "Filtrar programas prontos",
      "f.sec.filters.lede": "Os programas que cabem nos seus dias, no seu tempo e no seu local aparecem primeiro.",
      "f.next.result": "Ver meu programa",
      "f.next.browse": "Ver programas",
      "f.reason.missing": "Falta responder: {items}.",
      "f.miss.goal": "objetivo",
      "f.miss.exp": "tempo com programas",
      "f.miss.cons": "últimas seis semanas",
      "f.miss.days": "dias por semana",
      "f.miss.minutes": "duração da sessão",
      "f.miss.rest": "descanso",
      "f.miss.env": "onde você treina",
      "f.miss.shape": "estrutura semanal",
      "f.miss.name": "nome do programa",
      "f.unit.days": "dias",
      "f.unit.min": "min",
      "f.facts.days": "{n} dias",
      "f.facts.sets": "{n} séries",
      "f.chips.label": "Montado com suas respostas",
      "f.chips.hint": "Toque em uma resposta para mudar. O programa é refeito aqui mesmo.",
      "f.chip.muscles": "Ênfase: {list}",
      "f.chip.muscles_none": "Ênfase normal em todos os músculos",
      "f.chip.shape": "Estrutura: {name}",
      "f.change.before": "Antes",
      "f.change.after": "Agora",
      "f.change.without": "Sem evitar",
      "f.change.with": "Evitando",
      "f.review.week": "Semana de treino",
      "f.review.adjusted": "O que o Taurifer ajustou",
      "f.review.constraints": "Suas restrições",
      "f.review.restore": "Restaurar",
      "f.review.restore_aria": "Restaurar {exercise}",
      "f.review.remove_aria": "Remover {exercise}",
      "f.review.purpose": "Objetivo do programa",
      "f.review.shared_note": "Recebido por link. Nada deste programa foi salvo até agora.",
      "f.review.alternative": "Alternativa próxima",
      "f.review.edit_title": "Editar antes de usar",
      "f.review.back_to_program": "Voltar ao programa",
      "f.sheet.apply": "Atualizar programa",
      "f.list.fits_none": "Nenhum programa combina com os seus {days} dias. Veja os outros horários abaixo ou mude os filtros.",
      "f.list.change": "Mudar filtros",
      "f.import.title": "Traga o programa que você já segue",
      "f.import.lede": "Nada é salvo até você revisar e usar o programa.",
      "f.import.doors": "Formas de trazer",
      "f.import.all": "Ver todas as formas de começar",
      "f.import.file_name": "Arquivo do programa do Rafael",
      "f.gate.day": "{day} · {n} {exercise}",
      "f.gate.decline": "Agora não",
      "f.gate.week": "O que chega",
      "f.build.editor_lede": "Adicione pelo menos um exercício a cada dia. Séries e repetições podem ser ajustadas depois.",
      "f.chip.aria": "Alterar {what}: {value}",
      "f.chip.goal.muscle_growth": "Ganho de massa",
      "f.chip.goal.balanced": "Massa e força",
      "f.chip.goal.strength": "Força",
      "f.chip.cons.most": "Quase todas as sessões",
      "f.chip.cons.about_half": "Metade das sessões",
      "f.chip.cons.few": "Poucas sessões",
      "f.chip.cons.none": "Voltando de uma pausa",
      "f.chip.days": "{n} dias",
      "f.chip.minutes": "Até {n} min",
      "f.chip.minutes_90": "90 min ou mais",
      "f.chip.rest.auto": "Descanso: o Taurifer escolhe",
      "f.chip.rest.60": "Descanso de 60 s",
      "f.chip.rest.90": "Descanso de 90 s",
      "f.chip.rest.120": "Descanso de 2 min",
      "f.chip.rest.180": "Descanso de 3 min ou mais",
      "f.chip.env.commercial_gym": "Academia comercial",
      "f.chip.env.basic_gym": "Academia básica",
      "f.chip.env.limited_home": "Casa, equipamento limitado",
      "f.chip.env.full_home": "Academia em casa",
      "f.chip.env.other": "Outra configuração",
      "f.chip.prio_none": "Sem prioridade",
      "f.chip.prio": "Prioriza {list}",
      "f.chip.avoid": "Evita {list}",
      "f.chip.include": "Inclui {list}",
      "f.miss.prio": "prioridades",
      "f.miss.avoid": "exercícios evitados",
      "f.miss.muscles": "ênfase muscular",
      "f.miss.exercises": "preferências de exercícios",
    },
    en: {
      "f.land.lede": "Taurifer builds your program, logs every set and works out the target for your next session.",
      "f.land.word": "Taurifer",
      "f.hub.title": "How do you want to start?",
      "f.hub.lede": "Answering the first question starts the recommendation.",
      "f.rec.eyebrow": "Recommend a program",
      "f.rec.facts": "{n} short sections, starting with this question. Taurifer chooses the structure.",
      "f.hub.others": "Other ways",
      "f.door.custom.cap": "You choose each muscle's emphasis and the exercises. Taurifer writes the program.",
      "f.door.custom.fact": "{n} sections",
      "f.door.browse.fact": "1 filter screen, then a list",
      "f.door.own.cap": "Paste text, import a file or write it from scratch.",
      "f.door.paste": "Paste from anywhere",
      "f.door.paste.cap": "A coach's message, your notes or a spreadsheet",
      "f.door.file": "Import a file",
      "f.door.build": "Write from scratch",
      "f.door.build.cap": "Empty training days. You write every exercise.",
      "f.door.build.cap_import": "Opens Build a program, with empty days",
      "f.door.current": "open",
      "f.help.summary": "Not sure which to pick?",
      "f.help.q": "Which sentence fits you best right now?",
      "f.help.recommend": "I want Taurifer to decide the program",
      "f.help.custom": "I know which muscles and exercises I want",
      "f.help.browse": "I'd rather pick a ready-made program",
      "f.help.build": "I want to write every exercise",
      "f.help.import": "I already have a written program",
      "f.help.suggest": "Start with: {route}.",
      "f.help.why.recommend": "You answer {n} short sections and Taurifer chooses the structure.",
      "f.help.why.custom": "You choose the emphasis and the exercises. Taurifer writes the program.",
      "f.help.why.browse": "You filter by days, time and place, then pick a program from the list.",
      "f.help.why.build": "You start with empty days and write every exercise.",
      "f.help.why.import": "You paste the text or choose a file, then review every exercise.",
      "f.help.go": "Start here",
      "f.resume.label": "Setup in progress",
      "f.resume.when": "Kept on {date}.",
      "f.resume.continue": "Continue where I stopped",
      "f.discard.title": "Discard the kept setup?",
      "f.discard.body": "The kept answers for {route} are removed from this device. No active program changes.",
      "f.discard.cancel": "Keep the setup",
      "f.sec.about": "Your goal and recent training",
      "f.sec.about.lede": "Your goal sets the structure. Your recent training sets how the first weeks start.",
      "f.sec.goal": "Goal",
      "f.sec.goal.change": "Change",
      "f.sec.priorities": "Anything to prioritize or avoid?",
      "f.sec.priorities.lede": "Optional. With nothing chosen, Taurifer spreads attention across the muscles.",
      "f.sec.muscles": "Muscles to prioritize (up to 2)",
      "f.sec.filters": "Filter ready-made programs",
      "f.sec.filters.lede": "Programs that fit your days, your time and your place come first.",
      "f.next.result": "See my program",
      "f.next.browse": "Show programs",
      "f.reason.missing": "Still to answer: {items}.",
      "f.miss.goal": "goal",
      "f.miss.exp": "time on programs",
      "f.miss.cons": "past six weeks",
      "f.miss.days": "days per week",
      "f.miss.minutes": "session length",
      "f.miss.rest": "rest",
      "f.miss.env": "where you train",
      "f.miss.shape": "weekly structure",
      "f.miss.name": "program name",
      "f.unit.days": "days",
      "f.unit.min": "min",
      "f.facts.days": "{n} days",
      "f.facts.sets": "{n} sets",
      "f.chips.label": "Built from your answers",
      "f.chips.hint": "Tap an answer to change it. The program is rebuilt right here.",
      "f.chip.muscles": "Emphasis: {list}",
      "f.chip.muscles_none": "Normal emphasis on every muscle",
      "f.chip.shape": "Structure: {name}",
      "f.change.before": "Before",
      "f.change.after": "Now",
      "f.change.without": "Without avoiding",
      "f.change.with": "Avoiding",
      "f.review.week": "Training week",
      "f.review.adjusted": "What Taurifer adjusted",
      "f.review.constraints": "Your constraints",
      "f.review.restore": "Restore",
      "f.review.restore_aria": "Restore {exercise}",
      "f.review.remove_aria": "Remove {exercise}",
      "f.review.purpose": "Program purpose",
      "f.review.shared_note": "Received by link. Nothing from this program has been saved yet.",
      "f.review.alternative": "Close alternative",
      "f.review.edit_title": "Edit before using",
      "f.review.back_to_program": "Back to the program",
      "f.sheet.apply": "Update program",
      "f.list.fits_none": "No program matches your {days} days. See the other schedules below or change the filters.",
      "f.list.change": "Change filters",
      "f.import.title": "Bring the program you already follow",
      "f.import.lede": "Nothing is saved until you review and use the program.",
      "f.import.doors": "Ways to bring it",
      "f.import.all": "See every way to start",
      "f.import.file_name": "Rafael's program file",
      "f.gate.day": "{day} · {n} {exercise}",
      "f.gate.decline": "Not now",
      "f.gate.week": "What arrives",
      "f.build.editor_lede": "Add at least one exercise to every day. Sets and reps can be adjusted later.",
      "f.chip.aria": "Change {what}: {value}",
      "f.chip.goal.muscle_growth": "Muscle growth",
      "f.chip.goal.balanced": "Muscle and strength",
      "f.chip.goal.strength": "Strength",
      "f.chip.cons.most": "Most sessions",
      "f.chip.cons.about_half": "Half the sessions",
      "f.chip.cons.few": "Few sessions",
      "f.chip.cons.none": "Back from a break",
      "f.chip.days": "{n} days",
      "f.chip.minutes": "Up to {n} min",
      "f.chip.minutes_90": "90 min or more",
      "f.chip.rest.auto": "Rest: Taurifer chooses",
      "f.chip.rest.60": "60 s rest",
      "f.chip.rest.90": "90 s rest",
      "f.chip.rest.120": "2 min rest",
      "f.chip.rest.180": "3 min rest or more",
      "f.chip.env.commercial_gym": "Commercial gym",
      "f.chip.env.basic_gym": "Basic gym",
      "f.chip.env.limited_home": "Home, limited equipment",
      "f.chip.env.full_home": "Home gym",
      "f.chip.env.other": "Another setup",
      "f.chip.prio_none": "No priority",
      "f.chip.prio": "Prioritizes {list}",
      "f.chip.avoid": "Avoids {list}",
      "f.chip.include": "Includes {list}",
      "f.miss.prio": "priorities",
      "f.miss.avoid": "avoided exercises",
      "f.miss.muscles": "muscle emphasis",
      "f.miss.exercises": "exercise preferences",
    },
  };

  /* ---------- structure ---------- */
  /* F's screens per route. "about" holds goal + background (O-1 hybrid);
     "filters" holds Browse's days, minutes and environment. */
  const SECTIONS = {
    recommend: ["about", "schedule", "environment", "priorities"],
    custom: ["about", "schedule", "environment", "priorities", "exercise_preferences", "custom_shape"],
  };
  const JOBS = ["recommend", "custom", "browse", "build", "import"];
  const MISS = { desired_result_required: "goal", structured_experience_required: "exp", recent_consistency_required: "cons", days_per_week_required: "days", session_minutes_required: "minutes", preferred_rest_required: "rest", environment_required: "env", split_preference_required: "shape", program_name_required: "name" };
  let t, lang, root, S;

  function fresh(seed) {
    TF.seedDevice(seed || "fresh");
    S = {
      view: TF.hasActiveProgram() ? "today" : "landing", route: null, screen: null, answers: {}, result: null, prev: null, prevKind: "recompile",
      build: null, editing: false, importMode: "freeform", importDraft: null, importKept: null, ff: TS.freeform.create(), picker: null,
      avoid: { query: "", pending: null }, pref: { query: "", pending: null }, own: false, helpOpen: false, help: null, goalOpen: true, envOpen: false,
      revAtStart: TF.liveRevision(), shared: null, sharedError: null, toast: null, notice: null, cpTag: null, error: null, overlay: null, sheet: null,
      origin: "hub", context: null, dayOpen: {}, focusSel: null,
    };
  }
  const answers = () => TF.normalizeAnswers(S.answers);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const name = () => TF.resultName(S.result, lang);
  const generated = () => S.route === "recommend" || S.route === "custom";
  const large = () => parseFloat(getComputedStyle(document.documentElement).fontSize) >= 24;
  const narrow = () => innerWidth <= 340;
  const sections = () => SECTIONS[S.route] || [];
  const reviewing = () => S.view === "route" && (S.screen === "result" || S.screen === "preview");

  /* The production step id of the visible screen (JOURNEYS.md entry()). */
  function entryStep() {
    const a = S.answers;
    if (S.screen === "about") return a.desiredResult ? "background" : "desired_result";
    if (S.screen === "filters") return a.daysPerWeek && a.sessionMinutes ? "environment" : "schedule";
    return S.screen;
  }
  function screenFor(route, step) {
    if (route === "recommend" || route === "custom") return step === "desired_result" || step === "background" ? "about" : step === "preview" ? "result" : step;
    if (route === "browse") return step === "schedule" || step === "environment" ? "filters" : step;
    return step;
  }
  function stepIssues(step, a = answers()) { try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: a, step })); } catch (e) { return ["state_invalid"]; } }
  function issuesFor(screen, a) {
    if (screen === "about") return [...stepIssues("desired_result", a), ...stepIssues("background", a)];
    if (screen === "filters") return [...stepIssues("schedule", a), ...stepIssues("environment", a)];
    if (["schedule", "environment", "priorities", "custom_shape", "build_setup"].includes(screen)) return stepIssues(screen, a);
    return [];
  }
  function reasonText(issues) {
    const keys = issues.map((i) => MISS[i]);
    if (keys.length && keys.every(Boolean)) return t("f.reason.missing", { items: [...new Set(keys)].map((k) => t(`f.miss.${k}`)).join(", ") });
    return TS.issueText(t, issues);
  }
  function compileNow() {
    const mode = S.route === "custom" ? "custom" : "recommend";
    const r = TF.compile(mode, answers());
    if (!r.ok) { S.result = null; S.error = TS.issueText(t, r); return false; }
    S.result = TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation });
    S.error = null;
    return true;
  }
  /* First result: when exercises are avoided, the count compares the same
     answers without and with the avoidance (truthfully "no exercise changed"
     when none did). */
  function firstResult() {
    S.prev = null;
    if (!compileNow()) return;
    if ((S.answers.exerciseConstraints || []).length) {
      const w = TF.compile(S.route === "custom" ? "custom" : "recommend", { ...answers(), exerciseConstraints: [] });
      if (w.ok) { S.prev = w.preview; S.prevKind = "constraints"; }
    }
  }
  function defaultSplit() {
    const c = TF.splitChoices(answers()).choices;
    if (c.length && !c.some((x) => x.id === S.answers.splitPreference)) S.answers.splitPreference = (c.find((x) => x.default) || c[0]).id;
  }

  /* ---------- navigation ---------- */
  function resetRoute(route) {
    S.view = "route"; S.route = route; S.result = null; S.prev = null; S.editing = false; S.revAtStart = TF.liveRevision(); S.notice = null; S.error = null;
    S.avoid = { query: "", pending: null }; S.pref = { query: "", pending: null }; S.envOpen = false; S.dayOpen = {}; S.picker = null; S.sheet = null; S.overlay = null;
  }
  function go(route, { goal, mode, origin } = {}) {
    resetRoute(route); S.origin = origin || "hub";
    S.answers = goal ? { desiredResult: goal } : {};
    S.goalOpen = !goal;
    if (route === "recommend" || route === "custom") S.screen = "about";
    if (route === "browse") { S.screen = "filters"; if (S.context) Object.assign(S.answers, clone(S.context)); }
    if (route === "build") { S.screen = "build_setup"; S.build = null; }
    if (route === "import") { S.screen = "import_source"; S.importMode = mode || "freeform"; S.ff = TS.freeform.create(); S.importDraft = null; S.importKept = null; }
    render(true);
  }
  function rememberContext() { const a = S.answers; S.context = {}; for (const k of ["daysPerWeek", "sessionMinutes", "environment"]) if (a[k] !== undefined) S.context[k] = clone(a[k]); }
  function advance() {
    if (issuesFor(S.screen).length || S.avoid.pending || S.pref.pending) return;
    if (S.screen === "build_setup") {
      const n = S.answers.daysPerWeek;
      if (!S.build || S.build.days.length !== n) { const old = S.build; S.build = TS.build.create(S.answers.programName, n); if (old) S.build.days.forEach((d, i) => { if (old.days[i]) d.exercises = old.days[i].exercises; }); }
      S.build.name = S.answers.programName; S.screen = "editor"; render(true); return;
    }
    if (S.screen === "filters") { rememberContext(); S.screen = "catalogue"; render(true); return; }
    const secs = sections(); const i = secs.indexOf(S.screen);
    if (i < 0) return;
    rememberContext();
    const next = secs[i + 1];
    if (next === "custom_shape") defaultSplit();
    if (!next) { S.screen = "result"; firstResult(); render(true); return; }
    S.screen = next; render(true);
  }
  function exitSetup() { S.route = null; S.screen = null; S.sheet = null; S.overlay = null; S.editing = false; S.view = TF.hasActiveProgram() ? "today" : "landing"; }
  function back() {
    if (S.sheet) { closeSheet(); return; }
    if (S.editing) { commitEdit(); return; }
    const r = S.route, sc = S.screen;
    if (r === "shared") { S.view = "gate"; S.route = null; render(true); return; }
    if (r === "import") {
      if (sc === "preview") { S.screen = "import_source"; S.importDraft = S.importKept; S.result = null; S.prev = null; render(true); return; }
      if (S.importDraft) { S.importDraft = null; S.picker = null; render(true); return; }
      if (S.origin === "landing" && !TF.hasActiveProgram()) { S.view = "landing"; S.route = null; render(true); return; }
      S.view = "hub"; S.route = null; render(true); return;
    }
    if (r === "browse") { if (sc === "preview") { S.screen = "catalogue"; S.result = null; render(true); return; } if (sc === "catalogue") { S.screen = "filters"; render(true); return; } S.view = "hub"; S.route = null; render(true); return; }
    if (r === "build") { if (sc === "editor") { S.screen = "build_setup"; render(true); return; } S.view = "hub"; S.route = null; render(true); return; }
    const secs = sections();
    if (sc === "result") { S.screen = secs[secs.length - 1]; S.result = null; S.prev = null; render(true); return; }
    const i = secs.indexOf(sc);
    if (i > 0) { S.screen = secs[i - 1]; render(true); return; }
    S.view = "hub"; S.route = null; render(true);
  }
  function stateFor(step) { return TF.entryState({ route: S.route, answers: answers(), result: resultNow(), step, activeProgramRevisionAtStart: S.revAtStart }); }
  function resultNow() {
    if (S.route === "build" && S.build && S.screen === "editor") return TS.build.result(S.build);
    if (S.editing && S.build && S.result) return TS.build.commit(S.result, S.build);
    return S.result;
  }
  function keepDraft() {
    const ui = S.route === "build" && S.build ? { build: S.build } : null;
    let r = { ok: false };
    try { r = TF.saveDraft(stateFor(entryStep()), { ui }); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { TF.saveDraft(TF.entryState({ route: S.route, answers: answers(), step: TF.Entry.ROUTE_STEPS[S.route][0], activeProgramRevisionAtStart: S.revAtStart }), { ui }); } catch (e) { /* nothing kept */ } }
  }
  function resume() {
    const info = TF.loadDraft(); if (!info || !info.state) return;
    const st = info.state;
    resetRoute(st.route); S.origin = "hub";
    S.answers = clone(st.answers || {}); S.result = st.result ? clone(st.result) : null; S.revAtStart = st.activeProgramRevisionAtStart;
    S.screen = screenFor(st.route, st.step); S.goalOpen = !S.answers.desiredResult;
    if (st.route === "build") { S.build = info.ui && info.ui.build ? clone(info.ui.build) : S.screen === "editor" ? TS.build.create(S.answers.programName || "", S.answers.daysPerWeek || 3) : null; }
    if (st.route === "import") { S.screen = "import_source"; S.importMode = "freeform"; S.ff = TS.freeform.create(); S.importDraft = null; S.result = null; }
    if (S.screen === "result" && !S.result) firstResult();
    if (st.route === "browse" && S.screen === "preview" && !S.result) S.screen = "catalogue";
    render(true);
  }
  function activateNow() {
    if (S.editing) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : generated() ? "result" : "preview";
    const r = TF.activate(TF.entryState({ route: S.route, answers: answers(), result: S.result, step, activeProgramRevisionAtStart: S.revAtStart }));
    S.overlay = null;
    if (r.ok) { S.view = "today"; S.route = null; S.toast = t("x.activated"); render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; render(true); return; }
    S.error = TS.issueText(t, r, { preview: S.result && S.result.preview }); S.focusSel = "#fActError"; render();
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render(); } else activateNow(); }
  function commitEdit() { const before = S.result.preview; S.result = TS.build.commit(S.result, S.build); S.editing = false; S.prev = before; S.prevKind = "recompile"; render(true); }

  /* ---------- sheets (O-9) ---------- */
  const CHIP_SHEET = { goal: "goal", exp: "background", cons: "background", days: "schedule", minutes: "schedule", rest: "schedule", env: "environment", prio: "priorities", avoid: "priorities", muscles: "muscles", include: "exercises", avoidc: "exercises", shape: "shape" };
  function openSheet(chip) { S.sheet = { kind: CHIP_SHEET[chip], chip, answers: clone(S.answers), avoid: { query: "", pending: null }, pref: { query: "", pending: null } }; S.focusSel = "#fSheetTitle"; render(); }
  function closeSheet() { const chip = S.sheet && S.sheet.chip; S.sheet = null; S.focusSel = chip ? `[data-chip="${chip}"]` : null; render(); }
  function sheetBlocked() { const sh = S.sheet; if (!sh) return true; if (sh.avoid.pending || sh.pref.pending) return true; const a = TF.normalizeAnswers(sh.answers); return ["priorities", "muscles"].includes(sh.kind) ? stepIssues("priorities", a).length > 0 : false; }
  function applySheet() {
    const sh = S.sheet; if (!sh || sheetBlocked()) return;
    const chip = sh.chip;
    if (JSON.stringify(sh.answers) === JSON.stringify(S.answers)) { closeSheet(); return; }
    const before = S.result ? S.result.preview : null;
    S.answers = sh.answers;
    if (S.route === "custom") defaultSplit();
    compileNow();
    if (before && S.result) { S.prev = before; S.prevKind = "recompile"; }
    S.sheet = null; S.focusSel = `[data-chip="${chip}"]`; render();
  }

  /* ---------- small renderers ---------- */
  const chev = `<span class="f-chev" aria-hidden="true"></span>`;
  const group = (label, html, id, { icon } = {}) => `<div class="f-group" role="radiogroup" aria-labelledby="${id}"><p class="f-group__label" id="${id}">${icon ? `<span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span>` : ""}${esc(label)}</p>${html}</div>`;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function numGrid(key, values, selected, unit, fmt = String) {
    return `<div class="f-numgrid">${values.map((n) => TS.choice({ key, val: n, title: fmt(n), cap: unit, selected: selected === n, cls: "choice--seg f-num" })).join("")}</div>`;
  }
  function goalChoices(a) { return `<div class="stack stack--tight">${TS.DESIRED.map((v) => TS.choice({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), icon: TS.DESIRED_ICON[v], selected: a.desiredResult === v })).join("")}</div>`; }
  function backgroundGroups(a, p = "") {
    return group(t("entry.background.experience.label"), `<div class="stack stack--tight">${TS.EXPERIENCE.map((v) => TS.choice({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "choice--compact" })).join("")}</div>`, `${p}gExp`)
      + group(t("entry.background.consistency.label"), `<div class="stack stack--tight">${TS.CONSISTENCY.map((v) => TS.choice({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "choice--compact" })).join("")}</div>`, `${p}gCons`);
  }
  function scheduleGroups(a, { rest = true, p = "" } = {}) {
    const restSel = (v) => has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : +v === a.preferredRestSeconds);
    return group(t("entry.schedule.days.label"), numGrid("daysPerWeek", TS.DAYS, a.daysPerWeek, t("f.unit.days")), `${p}gDays`, { icon: "cal" })
      + group(t("entry.schedule.minutes.label"), numGrid("sessionMinutes", TS.MINUTES, a.sessionMinutes, t("f.unit.min"), (n) => (n === 90 ? "90+" : String(n))), `${p}gMin`, { icon: "clock" })
      + (rest ? group(t("entry.schedule.rest.label"), `<div class="stack stack--tight">${TS.REST.map((v) => TS.choice({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: restSel(v), cls: "choice--compact" })).join("")}</div>`, `${p}gRest`, { icon: "clock" }) : "");
  }
  function envChoices(a, { compact = false } = {}) { return `<div class="stack stack--tight">${TS.ENVS.map((v) => TS.choice({ key: "environment", val: v, title: t(`entry.environment.${v}`), icon: TS.ENV_ICON[v], selected: a.environment?.kind === v, cls: compact ? "choice--compact" : "" })).join("")}</div>`; }
  function priorityGroups(a, avoid, searchId) {
    const pm = a.primaryMuscles || []; const mv = a.priorityMovements || [];
    const muscles = `<div class="f-chips" role="group" aria-labelledby="${searchId}M">${TS.chip({ key: "clearPriorities", val: "none", label: t("entry.priorities.none"), selected: !pm.length })}${TS.MUSCLES.map((m) => TS.chip({ key: "primaryMuscles", val: m, label: t(`entry.muscle.${m}`), selected: pm.includes(m), disabled: pm.length >= 2 && !pm.includes(m) })).join("")}</div>`;
    const moves = `<div class="f-chips" role="group" aria-labelledby="${searchId}V">${TS.MOVEMENTS.map((m) => TS.chip({ key: "priorityMovements", val: m, label: t(`entry.movement.${m}`), selected: mv.includes(m), disabled: mv.length >= 2 && !mv.includes(m) })).join("")}</div>`;
    return `<div class="f-group"><p class="f-group__label" id="${searchId}M">${esc(t("f.sec.muscles"))}</p>${muscles}</div>
      <div class="f-group"><p class="f-group__label" id="${searchId}V">${esc(t("entry.priorities.movements"))}</p>${moves}</div>
      <div class="f-group" data-avoid-group><p class="f-group__label">${esc(t("entry.priorities.avoid"))}</p>${TS.avoidSection(t, lang, { query: avoid.query, pending: avoid.pending, constraints: a.exerciseConstraints || [] }, { searchId })}</div>`;
  }
  function shapeChoices(a) {
    const c = TF.splitChoices(answers()).choices;
    if (!c.length) return `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(t("entry.custom_shape.none_body"))}</p><div class="btnrow"><button type="button" class="btn" data-act="to-screen" data-screen="schedule">${esc(t("entry.custom_shape.change_schedule"))}</button></div></div>`;
    return `<div class="stack stack--tight" role="radiogroup" aria-label="${esc(t(c.length === 1 ? "entry.custom_shape.split_sole" : "entry.custom_shape.split"))}">${c.map((x) => {
      const est = (x.days || []).map((d) => d.estimateMinutes).filter(Boolean);
      const cap = [x.default ? t("entry.custom_shape.default_reason") : t("entry.custom_shape.compatible_reason"), est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""].filter(Boolean).join(" ");
      return TS.choice({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt : x.name, days: x.frequency }), cap, selected: a.splitPreference === x.id });
    }).join("")}</div>`;
  }
  const exCount = (n) => t("entry.preview.exercises", { n, exercise: TF.tp(t, n, "exercise") });
  function factsLine(p) {
    const f = TF.previewFacts(p); const days = (p.days || []).length; const dur = TF.durationLabel(t, p);
    return `<p class="facts f-facts">${[t("f.facts.days", { n: days }), exCount(f.exercises), t("f.facts.sets", { n: f.sets }), dur].filter(Boolean).map((x) => `<span class="t-data">${esc(x)}</span>`).join(" ")}</p>`;
  }
  /* O-5: the before/after count. data-* carry the identity diff (C-5). */
  function delta(before, after) {
    const d = TF.identityDiff(before, after); const fb = TF.previewFacts(before), fa = TF.previewFacts(after);
    const cons = S.prevKind === "constraints";
    const cell = (label, f, cls) => `<div class="f-delta__cell ${cls}"><span class="f-delta__k">${esc(label)}</span><span class="f-delta__v t-data">${esc(exCount(f.exercises))}</span><span class="f-delta__v t-data">${esc(t("f.facts.sets", { n: f.sets }))}</span></div>`;
    return `<div class="f-delta" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}"><p class="f-delta__line">${esc(TS.changeText(t, d))}</p><div class="f-delta__grid">${cell(t(cons ? "f.change.without" : "f.change.before"), fb, "is-before")}<span class="f-delta__arrow" aria-hidden="true"></span>${cell(t(cons ? "f.change.with" : "f.change.after"), fa, "is-after")}</div></div>`;
  }
  const libNames = (ids) => ids.map((id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; });
  function chipList() {
    const a = S.answers; const out = [];
    const add = (chip, what, text) => out.push({ chip, what: t(`f.miss.${what}`), text });
    if (a.desiredResult) add("goal", "goal", t(`f.chip.goal.${a.desiredResult}`));
    if (a.structuredExperience) add("exp", "exp", t(`entry.background.experience.${a.structuredExperience}`));
    if (a.recentConsistency) add("cons", "cons", t(`f.chip.cons.${a.recentConsistency}`));
    if (a.daysPerWeek) add("days", "days", t("f.chip.days", { n: a.daysPerWeek }));
    if (a.sessionMinutes) add("minutes", "minutes", a.sessionMinutes >= 90 ? t("f.chip.minutes_90") : t("f.chip.minutes", { n: a.sessionMinutes }));
    if (has(a, "preferredRestSeconds")) add("rest", "rest", t(`f.chip.rest.${a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds}`));
    if (a.environment) add("env", "env", t(`f.chip.env.${a.environment.kind}`));
    const avoids = (a.exerciseConstraints || []).map((c) => c.exerciseId);
    if (S.route === "recommend") {
      const pr = TS.priorityLabel(t, lang, answers(), false);
      add("prio", "prio", pr ? t("f.chip.prio", { list: pr }) : t("f.chip.prio_none"));
      if (avoids.length) add("avoid", "avoid", t("f.chip.avoid", { list: libNames(avoids).join(", ") }));
    } else {
      const pr = TS.priorityLabel(t, lang, answers(), true);
      add("muscles", "muscles", pr ? t("f.chip.muscles", { list: pr }) : t("f.chip.muscles_none"));
      const inc = a.mustHaveExercises || [];
      if (inc.length) add("include", "exercises", t("f.chip.include", { list: libNames(inc).join(", ") }));
      if (avoids.length) add("avoidc", "exercises", t("f.chip.avoid", { list: libNames(avoids).join(", ") }));
      if (!inc.length && !avoids.length) add("include", "exercises", t("entry.preview.exercise_preferences_none"));
      const c = TF.splitChoices(answers()).choices.find((x) => x.id === a.splitPreference);
      if (c) add("shape", "shape", t("f.chip.shape", { name: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt : c.name, days: c.frequency }) }));
    }
    return out;
  }
  function chipsBlock() {
    return `<section class="f-answers" aria-labelledby="fChipsLabel"><p class="f-group__label" id="fChipsLabel">${esc(t("f.chips.label"))}</p><p class="t-caption">${esc(t("f.chips.hint"))}</p>
      <div class="f-chips f-chips--answers">${chipList().map((c) => `<button type="button" class="f-chip" data-act="chip" data-chip="${c.chip}" aria-haspopup="dialog" aria-label="${esc(t("f.chip.aria", { what: c.what, value: c.text }))}"><span>${esc(c.text)}</span><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span></button>`).join("")}</div></section>`;
  }
  function section(title, body, id) { return `<section class="f-sec" aria-labelledby="${id}"><h2 class="t-subtitle" id="${id}">${esc(title)}</h2>${body}</section>`; }

  /* ---------- views ---------- */
  function routeHeader({ back = true, cancel = true } = {}) {
    return `<header class="f-head">${back ? `<button type="button" class="btn btn--link f-head__back" data-act="back">${chev}${esc(t("entry.back"))}</button>` : "<span></span>"}<span class="f-head__route">${esc(TS.routeName(t, S.route))}</span>${cancel ? `<button type="button" class="btn btn--link f-head__cancel" data-act="cancel">${esc(t("entry.cancel"))}</button>` : "<span></span>"}</header>`;
  }
  function progress() {
    const secs = sections(); const i = secs.indexOf(S.screen); if (i < 0) return "";
    return `<div class="f-progress"><p class="t-label" aria-live="polite">${esc(t("entry.step", { n: i + 1, total: secs.length }))}</p><div class="segbar" data-progress-dimension="task" data-progress-scope="entry-route-step">${secs.map((_, j) => `<span class="segbar__seg${j < i ? " is-done" : j === i ? " is-current" : ""}"></span>`).join("")}</div></div>`;
  }
  const h1 = (text, { cls = "" } = {}) => `<h1 class="t-title f-h1 ${cls}">${esc(text)}</h1>`;
  function questionBody() {
    const a = S.answers; const sc = S.screen;
    if (sc === "about") {
      const goal = S.goalOpen || !a.desiredResult
        ? group(t("f.sec.goal"), goalChoices(a), "gGoal")
        : `<div class="f-carried"><div class="f-carried__text"><span class="f-group__label">${esc(t("f.sec.goal"))}</span><span class="f-carried__v">${esc(t(`entry.desired_result.${a.desiredResult}.label`))}</span></div><button type="button" class="btn btn--sm" data-act="goal-edit" aria-expanded="false">${esc(t("f.sec.goal.change"))}</button></div>`;
      return h1(t("f.sec.about")) + `<p class="t-lede">${esc(t("f.sec.about.lede"))}</p>` + goal + backgroundGroups(a);
    }
    if (sc === "schedule") return h1(t("entry.schedule.title")) + `<p class="t-lede">${esc(t("entry.schedule.lede"))}</p>` + scheduleGroups(a);
    if (sc === "environment") return h1(t("entry.environment.title")) + `<p class="t-lede">${esc(t("entry.environment.lede"))}</p>` + group(t("entry.environment.title"), envChoices(a), "gEnv") + TS.environmentCorrection(t, a.environment, { open: S.envOpen });
    if (sc === "priorities" && S.route === "custom") return h1(t("entry.priorities.custom_title")) + `<p class="t-lede">${esc(t("entry.priorities.custom_lede"))}</p>` + TS.muscleEmphasis(t, a);
    if (sc === "priorities") return h1(t("f.sec.priorities")) + `<p class="t-lede">${esc(t("f.sec.priorities.lede"))}</p>` + priorityGroups(a, S.avoid, "avoidSearch");
    if (sc === "exercise_preferences") return h1(t("entry.exercise_preferences.title")) + `<p class="t-lede">${esc(t("entry.exercise_preferences.lede"))}</p>` + TS.exercisePrefs(t, lang, { query: S.pref.query, pending: S.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] });
    if (sc === "custom_shape") { const n = TF.splitChoices(answers()).choices.length; return h1(t(n === 1 ? "entry.custom_shape.title_sole" : "entry.custom_shape.title")) + `<p class="t-lede">${esc(t(n === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede"))}</p>` + shapeChoices(a); }
    if (sc === "filters") return h1(t("f.sec.filters")) + `<p class="t-lede">${esc(t("f.sec.filters.lede"))}</p>` + scheduleGroups(a, { rest: false }) + group(t("entry.environment.title"), envChoices(a, { compact: true }), "gEnv");
    if (sc === "build_setup") return h1(t("entry.build_setup.title")) + `<p class="t-lede">${esc(t("entry.build_setup.lede"))}</p><label class="field"><span>${esc(t("entry.build_setup.name"))}</span><input id="fName" type="text" autocomplete="off" data-field="fName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>` + group(t("entry.build_setup.days"), numGrid("daysPerWeek", TS.DAYS, a.daysPerWeek, t("f.unit.days")), "gBDays", { icon: "cal" });
    return "";
  }
  function cardFacts(c) {
    const ex = c.structureFacts.map((f) => f.exerciseCount), sets = c.structureFacts.map((f) => f.setCount);
    const range = (list, exact, rng) => (Math.min(...list) === Math.max(...list) ? t(exact, { n: list[0] }) : t(rng, { min: Math.min(...list), max: Math.max(...list) }));
    return [c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }), range(ex, "entry.catalogue.exercises_exact", "entry.catalogue.exercises_range"), range(sets, "entry.catalogue.sets_exact", "entry.catalogue.sets_range")];
  }
  function catalogue() {
    const cards = TF.browseCards(answers()); const a = S.answers;
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    const card = (c) => {
      const nm = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName;
      const prog = c.progressionStrategies.map((s) => t(`program.progression.strategy.${s}`)).join(" · ");
      return `<button type="button" class="f-card" data-act="card" data-id="${esc(c.id)}" aria-label="${esc(t("entry.catalogue.review_aria", { name: `${nm} · ${t("entry.catalogue.days_badge", { days: c.daysPerWeek })}` }))}">
        <span class="f-card__top"><span class="f-card__name">${esc(nm)}</span><span class="f-card__days t-data">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span>
        <span class="f-card__purpose">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span>
        <span class="facts">${cardFacts(c).map((x) => `<span class="t-data">${esc(x)}</span>`).join("")}</span>
        <span class="t-caption">${esc(t("entry.catalogue.progression", { progression: prog }))}</span>
        <span class="t-caption">${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</span>
        ${c.mismatch ? `<span class="f-card__mismatch">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button>`;
    };
    return h1(t("entry.catalogue.title")) + `<p class="t-lede">${esc(t("entry.catalogue.lede"))}</p>
      <div class="f-context"><p class="facts"><span class="t-data">${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span class="t-data">${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment?.kind}`))}</span></p><button type="button" class="btn btn--sm" data-act="to-screen" data-screen="filters">${esc(t("f.list.change"))}</button></div>
      ${fits.length ? `<p class="f-group__label">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</p><div class="f-cards">${fits.map(card).join("")}</div>` : `<p class="notice notice--quiet" role="status">${esc(t("f.list.fits_none", { days: a.daysPerWeek }))}</p>`}
      ${others.length ? `<details class="disclosure f-others" data-flag="othersOpen"${S.othersOpen ? " open" : ""}><summary><span>${esc(t("entry.catalogue.group_other"))} <span class="t-data">(${others.length})</span></span><span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body"><div class="f-cards">${others.map(card).join("")}</div></div></details>` : ""}`;
  }
  function reviewExtras() {
    const p = S.result.preview; const out = [];
    if (S.route === "browse") {
      const c = TF.browseCards(answers()).find((x) => x.id === S.answers.catalogueSelection);
      if (c) out.push(section(t("f.review.purpose"), `<p class="t-small">${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</p><p class="t-small t-soft">${esc(t("entry.catalogue.equipment", { equipment: c.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }))}</p>`, "fPurpose"));
    }
    if (S.route === "shared") out.push(`<p class="notice notice--quiet" role="note">${esc(t("f.review.shared_note"))}</p>`);
    if (!generated()) out.push(section(t("entry.preview.progression"), `<p class="t-small">${esc(t(TF.progressionCopyKey(p)))}</p>`, "fProg"));
    return out.join("");
  }
  function reviewBody() {
    if (!S.result) return h1(t("entry.result.title")) + `<div class="notice notice--error" role="alert"><strong>${esc(t("entry.custom_shape.none_title"))}</strong><p>${esc(S.error || t("x.issue.generic"))}</p></div>`;
    const p = S.result.preview; const userName = !generated() && S.route !== "browse";
    const eyebrow = t(`entry.preview.source.${S.route}`);
    const reasons = generated() ? section(t("entry.result.why"), `<ul class="f-reasons">${TS.reasons(t, lang, S.result, answers(), { custom: S.route === "custom" }).map((r) => `<li><span class="icon-mask icon-mask--${r.icon}" aria-hidden="true"></span><span>${esc(r.text)}</span></li>`).join("")}</ul>`, "fWhy") : "";
    const adj = TS.adjustments(t, p);
    const adjusted = generated() || adj.length ? section(t("f.review.adjusted"), adj.length ? `<ul class="f-list">${adj.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul>` : `<p class="t-small t-soft">${esc(t("entry.preview.compromises_none"))}</p>`, "fAdj") : "";
    const cons = generated() ? TS.constraintLines(t, lang, answers()) : [];
    const constraints = cons.length ? `<section class="f-sec" aria-labelledby="fCons"${cons.some((c) => c.kind === "avoid") ? ' data-checkpoint-slot="constraints"' : ""}><h2 class="t-subtitle" id="fCons">${esc(t("f.review.constraints"))}</h2><ul class="f-cons">${cons.map((c) => { const e = TF.libraryEntry(c.id); const nm = e ? TF.libraryName(e, lang) : c.id; return `<li><span class="t-small">${esc(c.text)}</span><button type="button" class="btn btn--sm" data-act="constraint-drop" data-kind="${c.kind}" data-id="${esc(c.id)}" aria-label="${esc(t(c.kind === "avoid" ? "f.review.restore_aria" : "f.review.remove_aria", { exercise: nm }))}">${esc(c.kind === "avoid" ? t("f.review.restore") : t("entry.exercise_preferences.remove"))}</button></li>`; }).join("")}</ul>${(answers().exerciseConstraints || []).some((c) => c.reason === "pain") ? `<p class="status-line" role="note"><span class="icon-mask icon-mask--shield" aria-hidden="true"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}</section>` : "";
    const alt = S.result.alternative ? section(t("f.review.alternative"), `<p class="t-small">${esc(TF.resultName(S.result.alternative, lang) || "")}</p>`, "fAlt") : "";
    return `<p class="t-label t-label--accent">${esc(eyebrow)}</p><h1 class="t-feature f-name"${userName ? " data-user-text" : ""}>${esc(name() || t("untitled_program"))}</h1>${factsLine(p)}
      ${S.prev ? delta(S.prev, p) : ""}
      ${S.notice === "conflict" ? TS.conflictNotice(t) : ""}
      ${generated() ? chipsBlock() : ""}
      <section class="f-sec f-week" aria-labelledby="fWeek"><h2 class="t-subtitle" id="fWeek">${esc(t("f.review.week"))}</h2>${TS.programDays(t, lang, p)}</section>
      ${constraints}${reasons}${adjusted}${alt}${reviewExtras()}
      ${generated() ? `<p class="t-caption f-determinism">${esc(t("entry.result.lede"))}</p>` : ""}
      <div class="f-review-acts"><button type="button" class="btn" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("entry.preview.edit"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div>`;
  }
  function editorBody(forBuild) {
    const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
    const head = forBuild
      ? h1(t("entry.editor.title")) + `<p class="f-editor-name" data-user-text>${esc(S.build.name || "")}</p><p class="t-lede">${esc(t("f.build.editor_lede"))}</p>`
      : `<p class="t-label t-label--accent">${esc(t("f.review.edit_title"))}</p>${h1(name())}<button type="button" class="btn f-editdone" data-act="edit-done">${chev}${esc(t("f.review.back_to_program"))}</button>`;
    return { html: head + TS.build.editor(t, lang, S.build), status: st };
  }
  function importDoors() {
    const cur = S.importMode;
    const door = (mode, title, cap, icon, act = "import-mode") => `<button type="button" class="f-idoor${cur === mode ? " is-current" : ""}" data-act="${act}" data-mode="${mode}"${cur === mode ? ' aria-current="true"' : ""}><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="f-idoor__body"><span class="f-idoor__t">${esc(title)}${cur === mode ? `<span class="visually-hidden"> (${esc(t("f.door.current"))})</span>` : ""}</span><span class="f-idoor__c">${esc(cap)}</span></span>${cur === mode ? `<span class="icon-mask icon-mask--check f-idoor__mark" aria-hidden="true"></span>` : chev}</button>`;
    return `<nav class="f-idoors" aria-label="${esc(t("f.import.doors"))}">${door("freeform", t("f.door.paste"), t("f.door.paste.cap"), "clipboard")}${door("file", t("f.door.file"), t("x.cost.file"), "download")}${door("build", t("f.door.build"), t("f.door.build.cap_import"), "pencil", "route")}</nav>`;
  }
  function importBody() {
    if (S.importDraft) {
      const d = S.importDraft; const n = d.rows.length;
      return h1(t("import.heading")) + `<p class="t-lede">${esc(t("import.lede"))}</p><p class="t-small f-file" data-user-text>${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n, exercise: TF.tp(t, n, "exercise") }))}</p>${TS.importReview.counts(t, d)}${TS.importReview.rows(t, lang, d, { picker: S.picker })}<p class="t-caption">${esc(t("import.safe"))}</p>`;
    }
    const lede = S.importMode === "freeform" ? `<p class="t-small t-soft">${esc(t("entry.freeform.lede"))}</p>${TS.freeform.body(t, lang, S.ff)}` : `<p class="t-small t-soft">${esc(t("entry.import_source.lede"))}</p><button type="button" class="btn" data-act="import-file"><span class="icon-mask icon-mask--download" aria-hidden="true"></span>${esc(t("entry.import_source.pick"))}</button>`;
    return h1(t("f.import.title")) + `<p class="t-lede">${esc(t("f.import.lede"))}</p>${importDoors()}<div class="f-ibody">${lede}</div><button type="button" class="btn btn--link f-alllink" data-act="to-hub">${esc(t("f.import.all"))}</button>`;
  }
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    const r = S.route, s = S.screen, a = S.answers;
    if (r === "recommend") return { about: a.desiredResult ? "rec-background" : "rec-goal", schedule: "rec-schedule", environment: "rec-environment", priorities: "rec-priorities", result: "rec-result" }[s] || "";
    if (r === "custom") return { priorities: "custom-priorities", exercise_preferences: "custom-exercises", custom_shape: "custom-shape", result: "custom-result" }[s] || "custom-step";
    if (r === "browse") return { filters: "browse-filters", catalogue: "browse-list", preview: "browse-preview" }[s] || "";
    if (r === "build") { if (s === "build_setup") return "build-setup"; const filled = S.build.days.filter((d) => d.exercises.length).length; return filled === 0 ? "build-empty" : filled < S.build.days.length ? "build-partial" : "build-ready"; }
    if (r === "import") { if (s === "preview") return "import-preview"; if (S.importDraft) return "import-review"; if (S.importMode === "file") return "import-source"; const ff = S.ff; if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps"; if (ff.status === "unreadable") return "ff-unreadable"; return ff.stage === 1 ? (ff.input ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply"; }
    if (r === "shared") return "shared-preview";
    return "";
  }
  /* The pinned region holds the primary only (L-1). Its reason sits beside
     it at normal text and moves into the flow at large text (A-2, K-11). */
  function pinned(button, reasonId, reasonText, { checkpoint = "" } = {}) {
    const reason = reasonText ? `<p class="f-reason" id="${reasonId}"${reasonId === "fActError" ? ' role="alert" tabindex="-1"' : ""}>${esc(reasonText)}</p>` : "";
    const inFlow = large() || narrow();
    return { flow: inFlow ? reason : "", pin: `<footer class="pinned f-pin" data-persistent-action${checkpoint ? ` data-checkpoint="${checkpoint}"` : ""}>${inFlow ? "" : reason}${button}</footer>` };
  }
  function routeView() {
    const secs = sections(); const qi = secs.indexOf(S.screen);
    let body = "", pin = { flow: "", pin: "" }, head = routeHeader(), step = entryStep();
    const issues = issuesFor(S.screen); const pending = S.avoid.pending || S.pref.pending;
    const advanceBtn = (label) => { const blocked = issues.length || pending; const rid = pending ? "pendingAvoidNote" : "fReason"; return { html: `<button type="button" class="btn btn--primary" data-advance data-act="next"${blocked ? ` disabled aria-describedby="${rid}"` : ""}>${esc(label)}</button>`, reason: issues.length && !pending ? reasonText(issues) : "" }; };
    if (qi >= 0 || S.screen === "filters" || S.screen === "build_setup") {
      body = questionBody();
      const last = qi === secs.length - 1;
      const label = S.screen === "filters" ? t("f.next.browse") : S.screen === "build_setup" ? t("entry.build_setup.open") : S.screen === "custom_shape" ? t("entry.custom_shape.generate") : last ? t("f.next.result") : t("entry.next");
      const b = advanceBtn(label); pin = pinned(b.html, "fReason", b.reason);
    } else if (S.screen === "catalogue") body = catalogue();
    else if (S.screen === "import_source") {
      body = importBody();
      if (S.importDraft) { const c = TF.importCounts(S.importDraft); pin = pinned(`<button type="button" class="btn btn--primary" data-act="import-commit"${c.review ? ' disabled aria-describedby="fImpReason"' : ""}>${esc(t("import.commit"))}</button>`, "fImpReason", c.review ? t("import.commit_blocked", { n: c.review }) : ""); }
    } else if (S.route === "build" || S.editing) {
      const e = editorBody(S.route === "build"); body = e.html;
      const st = TS.build.statusLine(e.status);
      const btn = `<button type="button" class="btn btn--primary" data-activate data-act="activate"${e.status.ready ? "" : ' disabled aria-describedby="editorStatus"'}>${esc(t(TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.editor.use"))}</button>`;
      const inFlow = large() || narrow();
      pin = { flow: inFlow ? st : "", pin: `<footer class="pinned f-pin" data-persistent-action>${inFlow ? "" : st}${btn}</footer>` };
    } else if (reviewing()) {
      body = reviewBody();
      if (S.result && S.notice !== "conflict") pin = pinned(`<button type="button" class="btn btn--primary" data-activate data-act="activate"${S.error ? ' aria-describedby="fActError"' : ""}>${esc(t(TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.preview.activate_first"))}</button>`, "fActError", S.error || "", { checkpoint: "activate" });
    }
    const cp = checkpointFor();
    return `<div class="page f-page${S.overlay || S.sheet ? " has-modal" : ""}">${head}${qi >= 0 ? progress() : ""}
      <main class="stack f-main view-enter" data-entry-step="${esc(step)}"${S.editing ? " data-editor" : ""} data-checkpoint="${esc(cp)}">${body}${pin.flow}</main>${pin.pin}</div>`;
  }
  function resumeCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") return TS.rulesNotice(t);
    const route = TS.routeName(t, info.route); const sc = screenFor(info.route, info.step);
    const stepName = { about: t("f.sec.about"), schedule: t("entry.schedule.title"), environment: t("entry.environment.title"), priorities: info.route === "custom" ? t("entry.priorities.custom_title") : t("f.sec.priorities"), filters: t("f.sec.filters") }[sc] || TS.stepName(t, info.route, info.step);
    const date = info.savedAt ? new Date(info.savedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { day: "numeric", month: "long" }) : "";
    return `<section class="f-resume" data-checkpoint="resume" aria-labelledby="fResumeT"><p class="f-group__label" id="fResumeT">${esc(t("f.resume.label"))}</p><p class="f-resume__where">${esc(route)} · ${esc(stepName)}</p>${date ? `<p class="t-caption">${esc(t("f.resume.when", { date }))}</p>` : ""}
      <div class="f-resume__acts"><button type="button" class="btn f-resume__go" data-act="resume">${esc(t("f.resume.continue"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="resume-restart" aria-haspopup="dialog">${esc(t("entry.resume.restart"))}</button></div></section>`;
  }
  function lockup() { return `<div class="f-lockup"><img src="${esc(TF.asset("vendor/brand/mark.png"))}" width="36" height="36" alt=""><span class="f-lockup__word">${esc(t("f.land.word"))}</span></div>`; }
  function landingView() {
    if (S.view === "gate") {
      const meta = S.shared.program.meta; const pv = TF.sharedPreview(S.shared);
      const days = (pv.days || []).map((d, i) => `<li><span class="day__num" aria-hidden="true">${i + 1}</span><span data-user-text>${esc(t("f.gate.day", { day: TF.dayName(t, d, pv.programStructure, i), n: d.exercises.length, exercise: TF.tp(t, d.exercises.length, "exercise") }))}</span></li>`).join("");
      return `<main class="page f-land f-gate" data-checkpoint="shared-gate"><header class="f-land__top">${lockup()}${TS.privacyButton(t)}</header>
        <p class="t-label t-label--accent">${esc(t("landing.shared.eyebrow"))}</p><h1 class="f-land__head">${esc(t("landing.shared.headline"))}</h1><p class="t-lede">${esc(t("landing.shared.body"))}</p>
        <section class="f-received" aria-labelledby="fRecvName"><p class="f-received__name" id="fRecvName" data-user-text>${esc(meta.name)}</p><p class="t-small t-soft" data-user-text>${esc(t(meta.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: meta.name, n: meta.daysPerWeek }))}</p><p class="f-group__label">${esc(t("f.gate.week"))}</p><ul class="f-received__days">${days}</ul><p class="t-small t-soft">${esc(t("x.shared.what"))}</p></section>
        <div class="f-land__acts"><button type="button" id="firstRunSharedStart" class="btn btn--primary btn--accent" data-act="shared-start">${esc(t("setup.shared.title"))}</button><p class="t-caption f-center">${esc(t("x.shared.nothing_saved"))}</p><button type="button" class="btn btn--quiet" data-act="shared-decline">${esc(t("f.gate.decline"))}</button></div></main>`;
    }
    const invalid = S.view === "invalid"; const card = invalid ? "" : resumeCard();
    return `<main class="page f-land${card ? " has-resume" : ""}" data-checkpoint="${invalid ? "shared-invalid" : "landing"}"><header class="f-land__top">${lockup()}${TS.privacyButton(t)}</header>
      <h1 class="f-land__head">${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1><p class="t-lede">${esc(invalid ? t("landing.shared.invalid_body") : t("f.land.lede"))}</p>
      ${invalid ? `<p class="notice notice--error f-invalid" role="status">${esc(t(TF.sharedErrorKey(S.sharedError)))}</p>` : ""}${card}
      ${invalid ? "" : `<div class="f-proof">${TS.landingProof(t, lang)}</div>`}
      <div class="f-land__acts"><button type="button" id="firstRunCreate" class="btn btn--primary btn--accent" data-act="land-create">${esc(t("landing.build"))}</button><button type="button" id="firstRunImport" class="btn btn--bordered f-land__second" data-act="land-import">${esc(t("landing.track"))}</button></div>
      <p class="t-caption f-privacy-line">${esc(t("x.privacy.line"))}</p></main>`;
  }
  function hubView() {
    const existing = TF.hasActiveProgram();
    const goalRow = (v) => `<button type="button" class="f-goal" data-act="start-rec" data-goal="${v}"><span class="icon-mask icon-mask--${TS.DESIRED_ICON[v]}" aria-hidden="true"></span><span class="f-goal__body"><span class="f-goal__t">${esc(t(`entry.desired_result.${v}.label`))}</span><span class="f-goal__c">${esc(t(`entry.desired_result.${v}.sub`))}</span></span><span class="f-arrow" aria-hidden="true"></span></button>`;
    const door = (route, title, cap, fact, icon, extra = "") => `<button type="button" class="f-door" data-act="route" data-route="${route}"${extra}><span class="icon-mask icon-mask--${icon}" aria-hidden="true"></span><span class="f-door__body"><span class="f-door__t">${esc(title)}</span><span class="f-door__c">${esc(cap)}</span>${fact ? `<span class="f-door__f">${esc(fact)}</span>` : ""}</span>${chev}</button>`;
    const helpOpts = JOBS.map((j) => `<button type="button" class="choice choice--compact${S.help === j ? " is-selected" : ""}" role="radio" aria-checked="${S.help === j}" data-act="help-pick" data-job="${j}"><span class="choice__body"><span class="choice__title">${esc(t(`f.help.${j}`))}</span></span><span class="choice__mark" aria-hidden="true"></span></button>`).join("");
    const helpOut = S.help ? `<div class="f-help__out" role="status"><p class="t-small"><strong>${esc(t("f.help.suggest", { route: TS.routeName(t, S.help) }))}</strong> ${esc(t(`f.help.why.${S.help}`, { n: SECTIONS.recommend.length }))}</p><button type="button" class="btn" data-act="help-go" data-help-result="${S.help}">${esc(t("f.help.go"))}</button></div>` : "";
    return `<div class="page f-hub"><header class="f-head f-head--hub"><button type="button" class="btn btn--link f-head__back" data-act="hub-back">${chev}${esc(t("entry.back"))}</button></header>
      <main class="stack f-main view-enter" data-checkpoint="${existing ? "hub-existing" : "route-choice"}">${h1(t("f.hub.title"))}<p class="t-lede">${esc(t("f.hub.lede"))}</p>${existing ? TS.activeNotice(t) : ""}${resumeCard()}
      <section class="f-rec" aria-labelledby="fRecQ"><p class="t-label t-label--accent">${esc(t("f.rec.eyebrow"))}</p><h2 class="t-section f-rec__q" id="fRecQ">${esc(t("entry.desired_result.title"))}</h2><p class="t-small t-soft">${esc(t("f.rec.facts", { n: SECTIONS.recommend.length }))}</p>
        <div class="f-rec__opts" role="group" aria-labelledby="fRecQ">${TS.DESIRED.map(goalRow).join("")}</div></section>
      <section class="f-others-sec" aria-labelledby="fOthers"><p class="f-group__label" id="fOthers">${esc(t("f.hub.others"))}</p><div class="f-doors">
        ${door("custom", t("entry.hub.custom.title"), t("f.door.custom.cap"), t("f.door.custom.fact", { n: SECTIONS.custom.length }), "sliders")}
        ${door("browse", t("entry.hub.browse.title"), t("entry.hub.browse.cap"), t("f.door.browse.fact"), "search")}
        <details class="f-own" data-flag="own"${S.own ? " open" : ""}><summary class="f-door f-door--summary"><span class="icon-mask icon-mask--sheet" aria-hidden="true"></span><span class="f-door__body"><span class="f-door__t">${esc(t("entry.hub.own.title"))}</span><span class="f-door__c">${esc(t("f.door.own.cap"))}</span></span><span class="chevron" aria-hidden="true"></span></summary>
          <div class="f-own__body">${door("import", t("f.door.paste"), t("f.door.paste.cap"), "", "clipboard", ' data-mode="freeform"')}${door("import", t("f.door.file"), t("x.cost.file"), "", "download", ' data-mode="file"')}${door("build", t("f.door.build"), t("f.door.build.cap"), "", "pencil")}</div></details></div></section>
      <details class="f-help" data-flag="helpOpen"${S.helpOpen ? " open" : ""}><summary><span>${esc(t("f.help.summary"))}</span><span class="chevron" aria-hidden="true"></span></summary><div class="f-help__body" data-checkpoint="route-help"><p class="t-small" id="fHelpQ">${esc(t("f.help.q"))}</p><div class="stack stack--tight" role="radiogroup" aria-labelledby="fHelpQ">${helpOpts}</div>${helpOut}</div></details>
      </main></div>`;
  }
  function sheetView() {
    const sh = S.sheet; if (!sh) return "";
    const a = sh.answers; let title = "", body = "";
    if (sh.kind === "goal") { title = t("entry.desired_result.title"); body = goalChoices(a); }
    if (sh.kind === "background") { title = t("entry.background.title"); body = backgroundGroups(a, "s"); }
    if (sh.kind === "schedule") { title = t("entry.schedule.title"); body = `<p class="t-small t-soft">${esc(t("entry.schedule.lede"))}</p>` + scheduleGroups(a, { p: "s" }); }
    if (sh.kind === "environment") { title = t("entry.environment.title"); body = group(t("entry.environment.title"), envChoices(a, { compact: true }), "sEnv") + TS.environmentCorrection(t, a.environment, { open: true }); }
    if (sh.kind === "priorities") { title = t("entry.priorities.title"); body = priorityGroups(a, sh.avoid, "sheetAvoidSearch"); }
    if (sh.kind === "muscles") { title = t("entry.priorities.custom_title"); body = TS.muscleEmphasis(t, a); }
    if (sh.kind === "exercises") { title = t("entry.exercise_preferences.title"); body = TS.exercisePrefs(t, lang, { query: sh.pref.query, pending: sh.pref.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] }); }
    if (sh.kind === "shape") { title = t("entry.custom_shape.title"); const keep = S.answers; S.answers = a; body = shapeChoices(a); S.answers = keep; }
    const blocked = sheetBlocked();
    const blockedIssues = ["priorities", "muscles"].includes(sh.kind) ? stepIssues("priorities", TF.normalizeAnswers(a)) : [];
    const reasonId = sh.avoid.pending || sh.pref.pending ? "pendingAvoidNote" : "fSheetReason";
    return `<div class="sheet-scrim" data-act="sheet-close"></div><div class="sheet f-sheet" role="dialog" aria-modal="true" aria-labelledby="fSheetTitle"><div class="f-sheet__head"><span class="sheet__grab" aria-hidden="true"></span><div class="f-sheet__bar"><h2 class="t-subtitle" id="fSheetTitle" tabindex="-1">${esc(title)}</h2><button type="button" class="btn btn--link" data-act="sheet-close">${esc(t("entry.editor.close"))}</button></div></div>
      <div class="f-sheet__body stack">${body}${blockedIssues.length && !sh.avoid.pending && !sh.pref.pending ? `<p class="f-reason" id="fSheetReason">${esc(TS.issueText(t, blockedIssues))}</p>` : ""}</div>
      <div class="f-sheet__foot"><button type="button" class="btn btn--primary btn--noarrow" data-act="sheet-apply" data-advance${blocked ? ` disabled aria-describedby="${reasonId}"` : ""}>${esc(t("f.sheet.apply"))}</button></div></div>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return TS.cancelSheet(t);
    if (S.overlay === "replace") return TS.replaceSheet(t, TF.activeName(lang), name(), TF.device.sessions);
    if (S.overlay === "restart") return TS.restartSheet(t, { shared: S.route === "shared" });
    if (S.overlay === "discard") { const info = TF.loadDraft(); const route = info ? TS.routeName(t, info.route) : ""; return `<div class="sheet-scrim" data-act="discard-cancel"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="fDiscardT" aria-describedby="fDiscardB" data-confirm="discard-draft"><h2 id="fDiscardT">${esc(t("f.discard.title"))}</h2><p id="fDiscardB">${esc(t("f.discard.body", { route }))}</p><div class="stack stack--tight"><button type="button" class="btn btn--destructive" data-act="discard-confirm">${esc(t("x.restart.confirm"))}</button><button type="button" class="btn" data-act="discard-cancel">${esc(t("f.discard.cancel"))}</button></div></div>`; }
    return "";
  }
  function render(focus) {
    const active = document.activeElement; const savedId = active && active.id;
    const sheetScroll = root.querySelector(".f-sheet__body")?.scrollTop || 0;
    let html;
    if (S.view === "today") html = TF.renderToday(t, lang) + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    else if (S.view === "hub") html = hubView();
    else if (S.view === "route") html = routeView();
    else html = landingView();
    root.innerHTML = html + sheetView() + overlayView();
    for (const [i, d] of root.querySelectorAll("details.day").entries()) if (Object.prototype.hasOwnProperty.call(S.dayOpen, i)) d.open = S.dayOpen[i];
    const sb = root.querySelector(".f-sheet__body"); if (sb && sheetScroll) sb.scrollTop = sheetScroll;
    if (focus) { try { scrollTo(0, 0); } catch (e) { /* no scroll */ } }
    const refocus = savedId && /Search|ffIn|ffOut|fName|pickerSearch|prefSearch/.test(savedId);
    if (S.focusSel) { const el = root.querySelector(S.focusSel); S.focusSel = null; if (el) { try { el.focus({ preventScroll: !!el.closest(".f-sheet") }); } catch (e) { /* focus */ } return; } }
    if (refocus && !focus) TS.refocus(root, savedId);
    else if (focus) TS.focusHeading(root);
  }

  /* ---------- actions ---------- */
  function on(act, d) {
    S.cpTag = null;
    if (act === "land-create") { S.view = "hub"; render(true); return; }
    if (act === "land-import") { go("import", { mode: "freeform", origin: TF.hasActiveProgram() ? "hub" : "landing" }); return; }
    if (act === "hub-back") { S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return; }
    if (act === "to-hub") { S.view = "hub"; S.route = null; render(true); return; }
    if (act === "start-rec") { go("recommend", { goal: d.goal }); return; }
    if (act === "help-pick") { S.help = d.job; S.helpOpen = true; S.focusSel = `[data-act="help-pick"][data-job="${d.job}"]`; render(); return; }
    if (act === "help-go") { go(d.helpResult, { mode: "freeform" }); return; }
    if (act === "route") { if (d.route === "build" && S.route === "import") { go("build", {}); return; } go(d.route, { mode: d.mode }); return; }
    if (act === "goal-edit") { S.goalOpen = true; S.focusSel = `[data-key="desiredResult"][aria-checked="true"]`; render(); return; }
    if (act === "to-screen") { S.screen = d.screen; if (d.screen !== "preview") S.result = S.route === "browse" ? null : S.result; render(true); return; }
    if (act === "pick") {
      if (S.sheet) { if (d.key === "avoidReason") { S.sheet.avoid.pending = null; S.sheet.pref.pending = null; } S.sheet.answers = TS.applyPick(S.sheet.answers, d.key, d.val); render(); return; }
      if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
      if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
      S.answers = TS.applyPick(S.answers, d.key, d.val); render(); return;
    }
    if (act === "next") { advance(); return; }
    if (act === "back") { back(); return; }
    if (act === "cancel") { if (S.route === "shared") { S.view = "gate"; S.route = null; render(true); return; } S.overlay = "cancel"; render(); return; }
    if (act === "cancel-continue") { S.overlay = null; S.focusSel = '[data-act="cancel"]'; render(); return; }
    if (act === "cancel-keep") { keepDraft(); exitSetup(); render(true); return; }
    if (act === "cancel-discard") { TF.clearDraft(); exitSetup(); S.answers = {}; S.result = null; render(true); return; }
    if (act === "resume") { resume(); return; }
    if (act === "resume-restart") { S.overlay = "discard"; render(); return; }
    if (act === "discard-cancel") { S.overlay = null; S.focusSel = '[data-act="resume-restart"]'; render(); return; }
    if (act === "discard-confirm") { TF.clearDraft(); S.overlay = null; render(true); return; }
    if (act === "rules-rebuild") { const info = TF.loadDraft(); TF.clearDraft(); if (info && info.state) { resetRoute(info.state.route); S.answers = clone(info.state.answers || {}); S.screen = screenFor(info.state.route, info.state.step); S.goalOpen = !S.answers.desiredResult; if (S.screen === "result") firstResult(); } render(true); return; }
    const av = S.sheet ? S.sheet.avoid : S.avoid; const pf = S.sheet ? S.sheet.pref : S.pref;
    const setA = (fn) => { if (S.sheet) S.sheet.answers = fn(S.sheet.answers); else S.answers = fn(S.answers); };
    if (act === "avoid-add") { av.pending = d.id; av.query = ""; S.focusSel = `[data-key="avoidReason"][data-val="${d.id}|dislike"]`; render(); return; }
    if (act === "avoid-remove") { setA((a) => ({ ...a, exerciseConstraints: (a.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) })); if (av.pending === d.id) av.pending = null; if (pf.pending === d.id) pf.pending = null; render(); return; }
    if (act === "pref-add") { if (d.status === "include") setA((a) => ({ ...a, mustHaveExercises: [...(a.mustHaveExercises || []), d.id] })); else pf.pending = d.id; pf.query = ""; render(); return; }
    if (act === "pref-remove") { setA((a) => ({ ...a, mustHaveExercises: (a.mustHaveExercises || []).filter((x) => x !== d.id), exerciseConstraints: (a.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) })); render(); return; }
    if (act === "field:avoidQuery") { av.query = d.value; render(); return; }
    if (act === "field:prefQuery") { pf.query = d.value; render(); return; }
    if (act === "field:fName") { S.answers.programName = d.value.trim(); render(); return; }
    if (act === "field:dayName") { S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return; }
    if (act === "field:rx" || act === "change:rx") { S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return; }
    if (act === "field:pickerQuery") { if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return; }
    if (act === "build") { S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); if (d.build === "open-picker") S.focusSel = "#pickerSearch"; render(); return; }
    if (act === "pick-exercise") { if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return; }
    if (act === "card") { const c = TF.browseCards(answers()).find((x) => x.id === d.id); if (!c) return; S.answers.catalogueSelection = c.id; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.prev = null; S.screen = "preview"; render(true); return; }
    if (act === "import-mode") { S.importMode = d.mode; S.importDraft = null; S.ff = TS.freeform.create(); render(true); return; }
    if (act === "import-file") { S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("f.import.file_name"), "file"); render(true); return; }
    if (act === "imp") { if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; S.focusSel = "#pickerSearch"; render(); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return; }
    if (act === "import-commit") { S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.prev = null; S.screen = "preview"; S.importDraft = null; render(true); return; }
    if (act === "ff") {
      if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
      else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); }
      else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
      if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = TS.freeform.create(); S.importMode = "freeform"; render(true); return; }
      if (d.ff === "gap-submit" && S.ff.gapErrors.size) S.focusSel = ".notice--error";
      render(); return;
    }
    if (act === "field:ffInput") { S.ff = TS.freeform.apply(S.ff, "input", d.value); render(); return; }
    if (act === "field:ffReply") { S.ff = TS.freeform.apply(S.ff, "reply", d.value); return; }
    if (act === "field:gap") { S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return; }
    if (act === "shared-start") { resetRoute("shared"); S.screen = "preview"; S.result = TF.sharedResult(S.shared); render(true); return; }
    if (act === "shared-decline") { S.shared = null; S.view = "landing"; render(true); return; }
    if (act === "edit") { S.build = TS.build.fromPreview(S.result.preview, { name: name() }); S.editing = true; render(true); return; }
    if (act === "edit-done") { commitEdit(); return; }
    if (act === "activate") { requestActivate(); return; }
    if (act === "replace-confirm") { S.overlay = null; activateNow(); return; }
    if (act === "replace-cancel") { S.overlay = null; S.focusSel = "[data-activate]"; render(); return; }
    if (act === "conflict-review") { S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return; }
    if (act === "restart") { S.overlay = "restart"; render(); return; }
    if (act === "restart-cancel") { S.overlay = null; S.focusSel = '[data-act="restart"]'; render(); return; }
    if (act === "restart-confirm") { const shared = S.route === "shared"; S.overlay = null; S.route = null; S.screen = null; S.answers = {}; S.result = null; S.prev = null; S.editing = false; if (shared) { S.shared = null; S.view = TF.hasActiveProgram() ? "today" : "landing"; } else S.view = "hub"; render(true); return; }
    if (act === "chip") { openSheet(d.chip); return; }
    if (act === "sheet-close") { closeSheet(); return; }
    if (act === "sheet-apply") { applySheet(); return; }
    if (act === "constraint-drop") {
      const before = S.result.preview;
      if (d.kind === "avoid") S.answers = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) };
      else S.answers = { ...S.answers, mustHaveExercises: (S.answers.mustHaveExercises || []).filter((x) => x !== d.id) };
      compileNow(); if (S.result) { S.prev = before; S.prevKind = "recompile"; } S.focusSel = "[data-change-statement]"; render(); return;
    }
  }

  /* ---------- checkpoint reach (states built through the same actions) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  const customA = () => TF.fixtureAnswers("custom");
  function at(route, screen, a) { resetRoute(route); S.screen = screen; S.answers = a; S.goalOpen = !a.desiredResult; }
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("f.import.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  function ffView(ff) { at("import", "import_source", {}); S.importMode = "freeform"; S.ff = ff; }
  async function reach(cp) {
    const u = TF.F.users;
    const build = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [d, id] of plan) { S.build.picker = d; S.build = TS.build.apply(S.build, "add", id); } };
    const correction = () => { const c = u.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...c.equipmentAdd]; e.capabilities = [...c.capabilitiesAdd]; return e; };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": S.view = "hub"; break;
      case "route-help": S.view = "hub"; S.helpOpen = true; break;
      case "rec-goal": at("recommend", "about", {}); break;
      case "rec-background": at("recommend", "about", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": { const a = rafael(); delete a.environment; at("recommend", "environment", a); break; }
      case "rec-env-correction": { const a = rafael(); a.environment = correction(); at("recommend", "environment", a); S.envOpen = true; S.cpTag = cp; break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; at("recommend", "priorities", a); S.cpTag = cp; break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); firstResult(); if (cp === "replace-confirm") S.overlay = "replace"; break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); firstResult(); const before = S.result.preview; S.answers = { ...S.answers, environment: correction() }; compileNow(); S.prev = before; S.prevKind = "recompile"; S.cpTag = cp; break; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = u.rafael.pain.primaryMuscles; a.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; at("recommend", "result", a); firstResult(); S.cpTag = cp; break; }
      case "browse-filters": at("browse", "filters", {}); break;
      case "browse-list": at("browse", "catalogue", TF.fixtureAnswers("browse")); break;
      case "browse-preview": at("browse", "catalogue", TF.fixtureAnswers("browse")); on("card", { id: "balanced_4_v1" }); return;
      case "custom-priorities": at("custom", "priorities", customA()); break;
      case "custom-exercises": at("custom", "exercise_preferences", customA()); break;
      case "custom-shape": { at("custom", "custom_shape", customA()); defaultSplit(); break; }
      case "custom-result": { at("custom", "result", customA()); defaultSplit(); firstResult(); break; }
      case "build-setup": at("build", "build_setup", {}); break;
      case "build-empty": build([]); break;
      case "build-partial": build([["manual_d1", "pd_bw"]]); break;
      case "build-ready": build([["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]); break;
      case "ff-empty": ffView(TS.freeform.create()); break;
      case "ff-filled": ffView(ffAt(1)); break;
      case "ff-handoff": ffView(ffAt(2)); break;
      case "ff-reply": ffView(ffAt(3)); break;
      case "ff-gaps": ffView(ffAt(3, TF.F.freeform.replyGaps[lang])); break;
      case "ff-gaps-invalid": ffView(TS.freeform.apply(ffAt(3, TF.F.freeform.replyGaps[lang]), "gap-submit")); break;
      case "ff-unreadable": ffView(ffAt(3, TF.F.freeform.replyUnreadable[lang])); break;
      case "import-source": at("import", "import_source", {}); S.importMode = "file"; break;
      case "import-review": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("f.import.file_name"), "file"); break;
      case "import-preview": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = importDecided(); on("import-commit", {}); return;
      case "shared-gate": case "shared-preview": { const r = await TF.decodeShared(TF.F.sharedFragments[lang]); S.shared = r.ok ? r.payload : null; S.view = r.ok ? "gate" : "invalid"; S.sharedError = r.ok ? null : r.code; if (cp === "shared-preview" && r.ok) { on("shared-start", {}); return; } break; }
      case "shared-invalid": { const r = await TF.decodeShared(TF.F.sharedFragments.invalid); S.view = "invalid"; S.sharedError = r.code; break; }
      case "activation-conflict": at("recommend", "result", rafael()); firstResult(); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); S.overlay = "cancel"; break;
      case "activated-today": at("recommend", "result", rafael()); firstResult(); activateNow(); return;
      default: S.view = "landing";
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const restVal = (a) => (a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds);
  async function aboutAnswers(api, a, { goal = true } = {}) {
    if (goal) await api.tap(pickKey("desiredResult", a.desiredResult));
    await api.tap(pickKey("structuredExperience", a.structuredExperience)); await api.tap(pickKey("recentConsistency", a.recentConsistency)); await api.tap("[data-advance]");
  }
  async function weekAndPlace(api, a) {
    await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap(pickKey("preferredRestSeconds", restVal(a))); await api.tap("[data-advance]");
    await api.tap(pickKey("environment", a.environment.kind)); await api.tap("[data-advance]");
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function addExercise(api, dayId, id) {
    await api.tap(`[data-build="open-picker"][data-day="${dayId}"]`);
    await api.type("#pickerSearch", TF.libraryName(TF.libraryEntry(id), api.lang));
    await api.tap(`[data-act="pick-exercise"][data-id="${id}"]`);
  }
  async function decideRows(api) { for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  const openOwn = async (api) => { if (!api.find('[data-act="route"][data-route="build"]')) await api.tap({ selector: "summary", text: api.t("entry.hub.own.title") }); };
  async function removeTwo(api) { await api.tap('[data-act="edit"]'); for (const d of S.build.days.slice(0, 2)) await api.tap(`[data-build="remove"][data-id="${d.exercises[0].id}"]`); }
  async function avoidBench(api, searchSel) {
    await api.type(searchSel, TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
  }
  async function helpTo(api, job) { await api.tap({ selector: "summary", text: t("f.help.summary") }); await api.tap(`[data-act="help-pick"][data-job="${job}"]`); await api.tap("[data-help-result]"); api.snapshot("end"); }
  const journeys = {
    async "activate.recommend"(api) {
      const a = TF.fixtureAnswers("rafael");
      await api.tap("#firstRunCreate");
      await api.tap(`[data-act="start-rec"][data-goal="${a.desiredResult}"]`); /* the door is the first answer */
      await aboutAnswers(api, a, { goal: false }); await weekAndPlace(api, a);
      await api.tap("[data-advance]"); /* priorities: optional, none chosen */
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.custom"(api) {
      const a = TF.fixtureAnswers("custom");
      await api.tap('[data-act="route"][data-route="custom"]');
      await aboutAnswers(api, a); await weekAndPlace(api, a);
      await api.tap(pickKey("musclePriority", "chest|prioritize")); await api.tap(pickKey("musclePriority", "calves|deemphasize")); await api.tap("[data-advance]");
      await api.type("#prefSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="pr_bb"][data-status="include"]');
      await api.type("#prefSearch", TF.libraryName(TF.libraryEntry("cu_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="cu_bb"][data-status="avoid"]');
      await api.tap(pickKey("avoidReason", "cu_bb|dislike")); await api.tap("[data-advance]");
      await api.tap("[data-advance]"); /* structure: default preselected */
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.browse"(api) {
      await api.tap('[data-act="route"][data-route="browse"]');
      await api.tap(pickKey("daysPerWeek", 4)); await api.tap(pickKey("sessionMinutes", 60)); await api.tap(pickKey("environment", "commercial_gym")); await api.tap("[data-advance]");
      await api.tap('[data-act="card"][data-id="balanced_4_v1"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.build"(api) {
      await openOwn(api); await api.tap('[data-act="route"][data-route="build"]');
      await api.type("#fName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
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
    async "edit.remove-two.editor"(api) { api.snapshot("before"); await removeTwo(api); await activateAndWait(api); },
    async "edit.remove-two.review"(api) { api.snapshot("before"); await removeTwo(api); await api.tap('[data-act="edit-done"]'); api.snapshot("after"); await activateAndWait(api); },
    async "build.gating"(api) {
      await api.type("#fName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap("[data-advance]");
      api.snapshot("empty"); await addExercise(api, "manual_d1", "pd_bw"); api.snapshot("partial");
      await addExercise(api, "manual_d2", "rw_bb"); await addExercise(api, "manual_d3", "sq_lp"); api.snapshot("ready"); await activateAndWait(api);
    },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "cancel.keep-resume"(api) {
      await api.tap(pickKey("daysPerWeek", 4)); api.snapshot("before");
      await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); api.snapshot("kept");
      await api.tap('[data-act="resume"]'); /* O-10: the resume card is on the landing too */
      api.snapshot("resumed");
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
    async "existing.cancel-keep"(api) { await api.tap('[data-act="start-rec"][data-goal="muscle_growth"]'); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await api.tap('[data-act="start-rec"][data-goal="muscle_growth"]'); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async "avoid.pain"(api) {
      await api.tap(pickKey("primaryMuscles", "chest")); await avoidBench(api, "#avoidSearch"); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned"); await api.tap("[data-advance]"); api.snapshot("review");
    },
    async overlays(api) {
      for (const chip of ["goal", "exp", "days", "env", "prio"]) { await api.tap(`[data-chip="${chip}"]`); await api.checkOverlay('[data-act="sheet-apply"]', chip); await api.tap('button[data-act="sheet-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-chip="days"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="sheet-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      api.mark("start"); await api.tap('[data-chip="env"]');
      await api.tap(pickKey("environment", "limited_home")); await api.tap(pickKey("environmentEquipment", "dumbbell")); await api.tap(pickKey("environmentEquipment", "band")); await api.tap(pickKey("environmentCapabilities", "safe_pull"));
      await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await api.tap('[data-chip="prio"]'); await avoidBench(api, "#sheetAvoidSearch");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth"));
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m")); await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most")); await api.tap("[data-advance]");
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3)); await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60)); await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120)); await api.tap("[data-advance]");
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap("[data-advance]"); await api.tap("[data-advance]"); api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, sel] of [["recommend", '[data-act="start-rec"][data-goal="muscle_growth"]'], ["custom", '[data-act="route"][data-route="custom"]'], ["browse", '[data-act="route"][data-route="browse"]'], ["build", '[data-act="route"][data-route="build"]'], ["import", '[data-act="route"][data-route="import"][data-mode="file"]']]) {
        if (job === "build" || job === "import") await openOwn(api);
        await api.tap(sel); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
      }
    },
    "help.recommend": (api) => helpTo(api, "recommend"),
    "help.custom": (api) => helpTo(api, "custom"),
    "help.browse": (api) => helpTo(api, "browse"),
    "help.build": (api) => helpTo(api, "build"),
    "help.import": (api) => helpTo(api, "import"),
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.f = {
    id: "f", name: "F · A primeira pergunta", policy: { productDecisions: [] },
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang])); fresh(c.seed); TS.wire(root, on);
      /* Disclosure state follows the native toggle (details do not bubble toggle; capture does). */
      root.addEventListener("toggle", (e) => {
        const d = e.target; if (!(d instanceof HTMLDetailsElement)) return;
        if (d.dataset.flag) S[d.dataset.flag] = d.open;
        else if (d.dataset.role === "env-correction" && !S.sheet) S.envOpen = d.open;
        else if (d.classList.contains("day")) { const i = [...root.querySelectorAll("details.day")].indexOf(d); if (i >= 0) S.dayOpen[i] = d.open; }
      }, true);
      root.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (S.sheet) { closeSheet(); return; }
        if (S.overlay === "cancel") on("cancel-continue", {}); else if (S.overlay === "replace") on("replace-cancel", {}); else if (S.overlay === "restart") on("restart-cancel", {}); else if (S.overlay === "discard") on("discard-cancel", {});
      });
      render();
    },
    reach,
    /* The result is what activation would commit: the Build draft in the
       Build editor, the committed edit in Edit before using. */
    entry: () => (S.view === "route" && S.route ? TF.jsonClean({ route: S.route, step: entryStep(), answers: answers(), result: resultNow() }) : null),
    journeys,
    state: () => S,
  };
})();
