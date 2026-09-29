/* Candidate K · Linhas (Round 4, bold directions)
   Setup as a trip on a metro network, in the grammar of São Paulo Metrô
   wayfinding: the five ways in are five coloured lines on one map, each step
   is a station, the cost of a route is counted in stations, and every line
   ends at the same terminal (your program), then Today.
   Signature interaction: the Diagrama unifilar, the in-car one-line strip at
   the top of every station. Passed stations light up in the line colour and
   carry the lifter's own answer; the fill travels to the next station on each
   Continue; any passed question station is one tap back. Baldeação
   (transfer) moves between Recommend and Custom keeping the shared answers.
   State machine, engine calls, checkpoint reach and journeys follow the
   Round 3 G contract (TF/TS); every atom is rebuilt in the metro vocabulary.
   Product policy: no product decision reopened (PD-1 to PD-4 stay closed;
   minutes and rest are asked; no program before the answers). */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "k.line.n": "Linha {n}",
      "k.line.recommend": "Recomendar", "k.line.custom": "Personalizar", "k.line.browse": "Programas prontos", "k.line.build": "Montar do zero", "k.line.import": "Trazer o seu", "k.line.shared": "Programa recebido",
      "k.do.recommend": "Você responde {n} seções. O Taurifer escolhe a estrutura e monta o programa.",
      "k.do.custom": "Você escolhe ênfase muscular e exercícios. O Taurifer escreve o programa.",
      "k.do.browse": "Você informa dias, tempo e local, depois escolhe um programa Taurifer pronto.",
      "k.do.build": "Você dá nome e dias ao programa, depois digita cada exercício.",
      "k.do.import": "Você cola a mensagem do treinador ou suas notas. Com um arquivo Taurifer, são {n} estações.",
      "k.cost.one": "1 estação", "k.cost.other": "{n} estações",
      "k.map.title": "Mapa das linhas",
      "k.map.lede": "Cada linha leva ao seu programa. As estações são as perguntas ou os passos de cada caminho, contadas antes de você embarcar.",
      "k.map.lede_existing": "Escolha como montar o próximo programa. Nada muda no atual até você confirmar a troca no fim da linha.",
      "k.map.origin": "Você está aqui",
      "k.map.end_program": "Seu programa", "k.map.end_program_sub": "Você revisa e decide usar.",
      "k.map.end_today": "Hoje", "k.map.end_today_sub": "A primeira sessão aparece aqui.",
      "k.map.back_today": "Voltar para Hoje",
      "k.map.active_title": "Programa ativo: {name}",
      "k.map.sessions.one": "1 sessão registrada", "k.map.sessions.other": "{n} sessões registradas",
      "k.map.replace_note": "Ao usar um novo programa, o atual é arquivado. As sessões registradas continuam no Histórico.",
      "k.land.map": "Cinco linhas, um destino: seu programa. Depois dele, Hoje.",
      "k.land.proof_title": "No fim da linha, Hoje",
      "k.land.proof_body": "É assim que Hoje mostra a primeira sessão depois que você usa um programa.",
      "k.st.about": "Objetivo", "k.st.schedule": "Agenda", "k.st.environment": "Local", "k.st.priorities": "Prioridades", "k.st.priorities_custom": "Ênfase", "k.st.exercise_preferences": "Exercícios", "k.st.custom_shape": "Estrutura",
      "k.st.catalogue": "Catálogo", "k.st.build_setup": "Nome e dias", "k.st.ff1": "Colar", "k.st.ff2": "Assistente", "k.st.ff3": "Resposta", "k.st.file": "Arquivo", "k.st.review": "Revisão", "k.st.link": "Link", "k.st.end": "Seu programa", "k.st.today": "Hoje",
      "k.strip.aria": "Linha {n}, {line}. Estação {i} de {total}.",
      "k.strip.back": "Voltar à estação {station}: {answer}",
      "k.strip.left.one": "Falta 1 estação", "k.strip.left.other": "Faltam {n} estações",
      "k.strip.terminal": "Terminal", "k.strip.today": "Fim da linha",
      "k.ans.goal.muscle_growth": "Massa", "k.ans.goal.balanced": "Massa e força", "k.ans.goal.strength": "Força",
      "k.ans.schedule": "{days} dias · {min} min",
      "k.ans.env.commercial_gym": "Academia completa", "k.ans.env.basic_gym": "Academia básica", "k.ans.env.limited_home": "Casa, limitado", "k.ans.env.full_home": "Casa completa", "k.ans.env.other": "Outro local",
      "k.ans.env_adjusted": "{env}, ajustado",
      "k.ans.prio_none": "Sem prioridade", "k.ans.none": "Nenhuma",
      "k.ans.choices.one": "1 escolha", "k.ans.choices.other": "{n} escolhas",
      "k.ans.lines.one": "1 linha", "k.ans.lines.other": "{n} linhas",
      "k.ans.sent": "Comando pronto", "k.ans.reply": "Resposta lida", "k.ans.file": "Arquivo lido", "k.ans.reviewed": "Revisado", "k.ans.received": "Recebido",
      "k.about.title": "Seu objetivo e seu treino recente",
      "k.about.lede": "O objetivo define a estrutura. O treino recente define como começam as primeiras semanas.",
      "k.about.goal": "Objetivo", "k.about.goal_change": "Alterar o objetivo",
      "k.q.missing": "Escolha uma opção.",
      "k.q.priorities_lede": "Sem escolhas aqui, o Taurifer monta o programa só com as respostas anteriores.",
      "k.q.none_limit": "Você já escolheu dois músculos. Desmarque um para trocar.",
      "k.unit.min": "min",
      "k.go.next": "Próxima: {station}", "k.go.show": "Sentido: Seu programa", "k.exit": "Saída", "k.exit_aria": "Saída: cancelar a configuração", "k.ff.note_edit": "Editar o texto", "k.ff.reply_label": "Resposta do assistente", "k.land.map_aria": "Mapa: cinco linhas saem de um ponto de partida comum e terminam no mesmo trilho, seu programa, que leva a Hoje.",
      "k.xfer.title": "Baldeação", "k.xfer.to": "Linha {n} · {line}", "k.xfer.keeps": "Suas respostas seguem com você.",
      "k.xfer.done.one": "Baldeação feita. 1 resposta veio da Linha {n}.", "k.xfer.done.other": "Baldeação feita. {k} respostas vieram da Linha {n}.",
      "k.chips.label": "Montado com suas respostas",
      "k.chips.hint": "Toque em uma resposta para mudá-la. O programa é refeito aqui mesmo.",
      "k.chip.aria": "Alterar {what}: {value}",
      "k.chip.goal.muscle_growth": "Ganho de massa", "k.chip.goal.balanced": "Massa e força", "k.chip.goal.strength": "Força",
      "k.chip.cons.most": "Fez a maior parte das sessões", "k.chip.cons.about_half": "Fez cerca de metade das sessões", "k.chip.cons.few": "Fez poucas sessões", "k.chip.cons.none": "Sem treino recente",
      "k.chip.days": "{n} dias por semana", "k.chip.minutes": "Até {n} min por sessão", "k.chip.minutes_90": "90 min ou mais por sessão",
      "k.chip.rest.auto": "Descanso: o Taurifer escolhe", "k.chip.rest.60": "Descanso de 60 s", "k.chip.rest.90": "Descanso de 90 s", "k.chip.rest.120": "Descanso de 2 min", "k.chip.rest.180": "Descanso de 3 min ou mais",
      "k.chip.env_adjusted": "{env}, com ajustes",
      "k.chip.prio_none": "Sem prioridade", "k.chip.prio": "Prioriza {list}", "k.chip.avoid": "Evita {list}", "k.chip.include": "Inclui {list}",
      "k.chip.emph_none": "Ênfase normal em todos os músculos", "k.chip.emph": "Ênfase: {list}", "k.chip.shape": "Estrutura: {name}", "k.chip.prefs_none": "Sem preferência de exercícios",
      "k.what.goal": "objetivo", "k.what.exp": "tempo com programas", "k.what.cons": "últimas seis semanas", "k.what.days": "dias por semana", "k.what.minutes": "duração da sessão", "k.what.rest": "descanso", "k.what.env": "onde você treina", "k.what.prio": "prioridades", "k.what.avoid": "exercícios evitados", "k.what.emph": "ênfase muscular", "k.what.prefs": "preferências de exercícios", "k.what.shape": "estrutura semanal",
      "k.edit.keep": "Manter como estava",
      "k.change.before": "Antes", "k.change.after": "Agora", "k.change.without": "Sem evitar", "k.change.with": "Evitando",
      "k.change.facts": "{ex} · {sets}",
      "k.change.answer": "Resposta alterada.", "k.change.answers": "Respostas alteradas.", "k.change.restore": "Restrição removida.", "k.change.constraints": "Restrições aplicadas.", "k.change.edit": "Edição aplicada.",
      "k.rev.new": "novo",
      "k.rev.adjusted": "O que o Taurifer ajustou", "k.rev.constraints": "Suas restrições", "k.rev.restore": "Restaurar", "k.rev.restore_aria": "Restaurar {exercise}", "k.rev.more": "Mais opções",
      "k.rev.error_title": "Não foi possível montar o programa",
      "k.fact.goal": "Objetivo", "k.fact.background": "Histórico de treino", "k.fact.schedule": "Agenda", "k.fact.environment": "Onde você treina", "k.fact.priorities": "Prioridades e restrições", "k.fact.emphasis": "Ênfase muscular", "k.fact.exercises": "Preferências de exercícios", "k.fact.shape": "Estrutura semanal",
      "k.sheet.apply": "Refazer o programa",
      "k.edit.lede": "Remova exercícios ou ajuste séries e repetições. As mudanças valem só para este programa ainda não usado.",
      "k.edit.done": "Voltar ao programa",
      "k.build.days_caption": "{n} dias de treino",
      "k.imp.write_own": "Linha 4 · Montar do zero",
      "k.imp.file_name": "Treino do Rafael.json",
      "k.imp.switch": "Outro jeito de trazer o seu",
      "k.ff.gaps_title": "Complete o que falta",
      "k.ff.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições. Preencha os campos abaixo.",
      "k.cancel.title": "Sair da configuração?",
      "k.cancel.body": "Salve suas respostas neste dispositivo para continuar depois, ou descarte-as. Nenhum programa é ativado.",
      "k.cancel.keep": "Salvar e sair", "k.cancel.discard": "Descartar e sair", "k.cancel.continue": "Continuar a configuração",
      "k.resume.at": "{route} · {step} · salvo em {when}",
      "k.resume.discard_title": "Descartar a configuração salva?",
      "k.resume.discard_body": "As respostas salvas neste dispositivo serão apagadas. O que já está ativo não muda.",
      "k.resume.discard_confirm": "Descartar e começar de novo", "k.resume.discard_cancel": "Manter a configuração salva",
      "k.gate.what": "O que chega",
      "k.catalogue.change_aria": "Alterar dias, tempo e local",
    },
    en: {
      "k.line.n": "Line {n}",
      "k.line.recommend": "Recommend", "k.line.custom": "Customize", "k.line.browse": "Ready-made programs", "k.line.build": "Build from scratch", "k.line.import": "Bring your own", "k.line.shared": "Received program",
      "k.do.recommend": "You answer {n} sections. Taurifer chooses the structure and builds the program.",
      "k.do.custom": "You choose muscle emphasis and exercises. Taurifer writes the program.",
      "k.do.browse": "You give days, time and place, then pick a ready-made Taurifer program.",
      "k.do.build": "You name the program and set its days, then type each exercise.",
      "k.do.import": "You paste a coach's message or your notes. With a Taurifer file, it is {n} stations.",
      "k.cost.one": "1 station", "k.cost.other": "{n} stations",
      "k.map.title": "Line map",
      "k.map.lede": "Every line ends at your program. Stations are the questions or steps on each route, counted before you board.",
      "k.map.lede_existing": "Choose how to set up your next program. Nothing changes in the current one until you confirm the switch at the end of the line.",
      "k.map.origin": "You are here",
      "k.map.end_program": "Your program", "k.map.end_program_sub": "You review it and decide to use it.",
      "k.map.end_today": "Today", "k.map.end_today_sub": "Your first session appears here.",
      "k.map.back_today": "Back to Today",
      "k.map.active_title": "Active program: {name}",
      "k.map.sessions.one": "1 logged session", "k.map.sessions.other": "{n} logged sessions",
      "k.map.replace_note": "Using a new program archives the current one. Logged sessions stay in History.",
      "k.land.map": "Five lines, one destination: your program. After it, Today.",
      "k.land.proof_title": "At the end of the line, Today",
      "k.land.proof_body": "This is how Today shows the first session once you use a program.",
      "k.st.about": "Goal", "k.st.schedule": "Schedule", "k.st.environment": "Place", "k.st.priorities": "Priorities", "k.st.priorities_custom": "Emphasis", "k.st.exercise_preferences": "Exercises", "k.st.custom_shape": "Structure",
      "k.st.catalogue": "Catalogue", "k.st.build_setup": "Name and days", "k.st.ff1": "Paste", "k.st.ff2": "Assistant", "k.st.ff3": "Reply", "k.st.file": "File", "k.st.review": "Review", "k.st.link": "Link", "k.st.end": "Your program", "k.st.today": "Today",
      "k.strip.aria": "Line {n}, {line}. Station {i} of {total}.",
      "k.strip.back": "Back to {station}: {answer}",
      "k.strip.left.one": "1 station to go", "k.strip.left.other": "{n} stations to go",
      "k.strip.terminal": "Terminal", "k.strip.today": "End of the line",
      "k.ans.goal.muscle_growth": "Muscle", "k.ans.goal.balanced": "Muscle and strength", "k.ans.goal.strength": "Strength",
      "k.ans.schedule": "{days} days · {min} min",
      "k.ans.env.commercial_gym": "Full gym", "k.ans.env.basic_gym": "Basic gym", "k.ans.env.limited_home": "Home, limited", "k.ans.env.full_home": "Full home gym", "k.ans.env.other": "Other setup",
      "k.ans.env_adjusted": "{env}, adjusted",
      "k.ans.prio_none": "No priority", "k.ans.none": "None",
      "k.ans.choices.one": "1 choice", "k.ans.choices.other": "{n} choices",
      "k.ans.lines.one": "1 line", "k.ans.lines.other": "{n} lines",
      "k.ans.sent": "Prompt ready", "k.ans.reply": "Reply read", "k.ans.file": "File read", "k.ans.reviewed": "Reviewed", "k.ans.received": "Received",
      "k.about.title": "Your goal and recent training",
      "k.about.lede": "Your goal sets the structure. Your recent training sets how the first weeks start.",
      "k.about.goal": "Goal", "k.about.goal_change": "Change the goal",
      "k.q.missing": "Choose one option.",
      "k.q.priorities_lede": "With nothing chosen here, Taurifer builds the program from your earlier answers alone.",
      "k.q.none_limit": "You already chose two muscles. Clear one to switch.",
      "k.unit.min": "min",
      "k.go.next": "Next: {station}", "k.go.show": "Towards: Your program", "k.exit": "Exit", "k.exit_aria": "Exit: cancel setup", "k.ff.note_edit": "Edit the text", "k.ff.reply_label": "Assistant reply", "k.land.map_aria": "Map: five lines leave one shared starting point and end on the same rail, your program, which leads to Today.",
      "k.xfer.title": "Transfer", "k.xfer.to": "Line {n} · {line}", "k.xfer.keeps": "Your answers come with you.",
      "k.xfer.done.one": "Transfer done. 1 answer came from Line {n}.", "k.xfer.done.other": "Transfer done. {k} answers came from Line {n}.",
      "k.chips.label": "Built from your answers",
      "k.chips.hint": "Tap an answer to change it. The program is rebuilt right here.",
      "k.chip.aria": "Change {what}: {value}",
      "k.chip.goal.muscle_growth": "Muscle growth", "k.chip.goal.balanced": "Muscle and strength", "k.chip.goal.strength": "Strength",
      "k.chip.cons.most": "Did most sessions", "k.chip.cons.about_half": "Did about half the sessions", "k.chip.cons.few": "Did only a few sessions", "k.chip.cons.none": "No recent training",
      "k.chip.days": "{n} days a week", "k.chip.minutes": "Up to {n} min a session", "k.chip.minutes_90": "90 min or more a session",
      "k.chip.rest.auto": "Rest: Taurifer chooses", "k.chip.rest.60": "60 s rest", "k.chip.rest.90": "90 s rest", "k.chip.rest.120": "2 min rest", "k.chip.rest.180": "3 min rest or more",
      "k.chip.env_adjusted": "{env}, adjusted",
      "k.chip.prio_none": "No priority", "k.chip.prio": "Prioritizes {list}", "k.chip.avoid": "Avoids {list}", "k.chip.include": "Includes {list}",
      "k.chip.emph_none": "Normal emphasis on every muscle", "k.chip.emph": "Emphasis: {list}", "k.chip.shape": "Structure: {name}", "k.chip.prefs_none": "No exercise preferences",
      "k.what.goal": "goal", "k.what.exp": "time on programs", "k.what.cons": "past six weeks", "k.what.days": "days per week", "k.what.minutes": "session length", "k.what.rest": "rest", "k.what.env": "where you train", "k.what.prio": "priorities", "k.what.avoid": "avoided exercises", "k.what.emph": "muscle emphasis", "k.what.prefs": "exercise preferences", "k.what.shape": "weekly structure",
      "k.edit.keep": "Keep as it was",
      "k.change.before": "Before", "k.change.after": "Now", "k.change.without": "Without avoiding", "k.change.with": "Avoiding",
      "k.change.facts": "{ex} · {sets}",
      "k.change.answer": "Answer changed.", "k.change.answers": "Answers changed.", "k.change.restore": "Constraint removed.", "k.change.constraints": "Constraints applied.", "k.change.edit": "Edits applied.",
      "k.rev.new": "new",
      "k.rev.adjusted": "What Taurifer adjusted", "k.rev.constraints": "Your constraints", "k.rev.restore": "Restore", "k.rev.restore_aria": "Restore {exercise}", "k.rev.more": "More options",
      "k.rev.error_title": "The program could not be built",
      "k.fact.goal": "Goal", "k.fact.background": "Training background", "k.fact.schedule": "Schedule", "k.fact.environment": "Where you train", "k.fact.priorities": "Priorities and constraints", "k.fact.emphasis": "Muscle emphasis", "k.fact.exercises": "Exercise preferences", "k.fact.shape": "Weekly structure",
      "k.sheet.apply": "Rebuild the program",
      "k.edit.lede": "Remove exercises or adjust sets and reps. Changes apply only to this unused program.",
      "k.edit.done": "Back to the program",
      "k.build.days_caption": "{n} training days",
      "k.imp.write_own": "Line 4 · Build from scratch",
      "k.imp.file_name": "Rafael's program.json",
      "k.imp.switch": "Another way to bring your own",
      "k.ff.gaps_title": "Fill in what is missing",
      "k.ff.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing. Fill in the fields below.",
      "k.cancel.title": "Leave setup?",
      "k.cancel.body": "Save your answers on this device to continue later, or discard them. No program is activated.",
      "k.cancel.keep": "Save and leave", "k.cancel.discard": "Discard and leave", "k.cancel.continue": "Continue setup",
      "k.resume.at": "{route} · {step} · saved {when}",
      "k.resume.discard_title": "Discard the saved setup?",
      "k.resume.discard_body": "The answers kept on this device will be deleted. Nothing that is already active changes.",
      "k.resume.discard_confirm": "Discard and start over", "k.resume.discard_cancel": "Keep the saved setup",
      "k.gate.what": "What arrives",
      "k.catalogue.change_aria": "Change days, time and place",
    },
  };
  const STEPS = TF.Entry.ROUTE_STEPS;
  const QUESTIONS = { recommend: ["about", "schedule", "environment", "priorities"], custom: ["about", "schedule", "environment", "priorities", "exercise_preferences", "custom_shape"], browse: ["schedule", "environment"] };
  const REVIEW = { recommend: "result", custom: "result", browse: "preview", import: "preview", shared: "preview", build: "editor" };
  const LINE = { recommend: 1, custom: 2, browse: 3, build: 4, import: 5, shared: 0 };
  const MAP = [["recommend"], ["custom"], ["browse"], ["build"], ["import", "freeform"]];
  const SHARED_KEYS = ["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "preferredRestSeconds", "environment"];
  const XFER = { recommend: "custom", custom: "recommend" };
  const entryStep = () => (S.step === "about" ? (S.answers.desiredResult ? "background" : "desired_result") : S.step);
  const screenOf = (route, step) => ((route === "recommend" || route === "custom") && (step === "desired_result" || step === "background") ? "about" : step);
  const CODE_KEY = { desired_result_required: "desiredResult", structured_experience_required: "structuredExperience", recent_consistency_required: "recentConsistency", days_per_week_required: "daysPerWeek", session_minutes_required: "sessionMinutes", preferred_rest_required: "preferredRestSeconds", environment_required: "environment", program_name_required: "programName", split_preference_required: "splitPreference" };
  let t, lang, root, S, lastStrip = null;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const plural = (key, n, p = {}) => t(`${key}.${n === 1 ? "one" : "other"}`, { n, ...p });
  const compact = () => document.documentElement.style.fontSize === "200%" || window.innerWidth < 360;
  const reduced = () => document.documentElement.dataset.motion === "reduced" || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ARROW = `<svg class="k-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 10.4h13.1l-4.9-4.9 2.3-2.3L21.8 12l-8.8 8.8-2.3-2.3 4.9-4.9H2.5z"/></svg>`;
  const CHEV = `<svg class="k-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.6 3.2l2.3 2.3-6.5 6.5 6.5 6.5-2.3 2.3L6.8 12z"/></svg>`;
  const EXIT = `<svg class="k-exit__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3h10v4h-2.4V5.4H5.4v13.2h5.2V17H13v4H3zM15.4 7.2l4.8 4.8-4.8 4.8-1.7-1.7 1.9-1.9H8v-2.4h7.6l-1.9-1.9z"/></svg>`;
  const pict = (icon, cls = "") => `<span class="k-pict ${cls}" aria-hidden="true"><span class="icon-mask icon-mask--${icon}"></span></span>`;
  const roundel = (n) => (n ? `<span class="k-roundel" data-line="${n}" aria-hidden="true">${n}</span>` : `<span class="k-roundel k-roundel--ink" aria-hidden="true"></span>`);

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, step: null, answers: {}, result: null, card: null, changeFrom: null, lastPreview: null, validation: false, build: null, editing: false, importMode: "freeform", importDraft: null, importKept: null, importHeld: null, ff: TS.freeform.create(), picker: null, envOpen: false, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, sheet: null, goalOpen: false, overlay: null, notice: null, actError: null, toast: null, revAtStart: TF.liveRevision(), shared: S ? S.shared : null, sharedError: null, cpTag: null, stash: S ? S.stash : null, xfer: null, trip: null };
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
  function compileFirst() {
    const r = compileWith(answers());
    S.result = r.ok ? r.result : null; S.compileError = r.ok ? null : r.text; S.changeFrom = null;
    if (!r.ok) return;
    if (S.lastPreview && TF.identityDiff(S.lastPreview, S.result.preview).n > 0) S.changeFrom = { preview: S.lastPreview, ctx: "k.change.answers" };
    else if ((S.answers.exerciseConstraints || []).length) { const w = compileWith({ ...answers(), exerciseConstraints: [] }); if (w.ok) S.changeFrom = { preview: w.result.preview, ctx: "k.change.constraints" }; }
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
    const prev = S.answers || {}; const stash = S.stash;
    S = blank("route"); S.route = route; S.step = QUESTIONS[route] && route !== "browse" ? QUESTIONS[route][0] : STEPS[route][0];
    if (goal && (route === "recommend" || route === "custom")) S.answers.desiredResult = goal;
    if (stash && stash.route === route) S.answers = clone(stash.answers);
    if (route === "browse") for (const k of ["daysPerWeek", "sessionMinutes", "environment"]) if (prev[k] != null && !has(S.answers, k)) S.answers[k] = clone(prev[k]);
    if (route === "import") S.importMode = importMode || "file";
    S.stash = null;
    render(true);
  }
  /* Baldeação: switch line at a shared station, carrying the shared answers. */
  function transfer(route) {
    const from = S.route; const keep = {};
    for (const k of SHARED_KEYS) if (has(S.answers, k)) keep[k] = clone(S.answers[k]);
    const step = S.step; const rev = S.revAtStart;
    S = blank("route"); S.route = route; S.answers = keep; S.revAtStart = rev;
    S.step = QUESTIONS[route].includes(step) ? step : QUESTIONS[route][0];
    S.xfer = { from: LINE[from], k: Object.keys(keep).length };
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
    const screens = generated() ? [...QUESTIONS[S.route], "result"] : STEPS[S.route];
    const next = screens[screens.indexOf(S.step) + 1];
    if (next === "custom_shape") ensureSplit(S.answers);
    S.step = next;
    if (next === "result") compileFirst();
    render(true);
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
    const steps = generated() ? [...QUESTIONS[S.route], "result"] : STEPS[S.route]; const i = steps.indexOf(S.step);
    if (i <= 0) { toHub(); return; }
    let prev = steps[i - 1]; if (prev === "result") prev = steps[i - 2];
    S.step = prev; S.validation = false; S.avoid.pending = null; S.pref.pending = null; render(true);
  }
  function jump(step) { if (S.step === "result") { S.lastPreview = S.result ? S.result.preview : null; S.result = null; S.changeFrom = null; } S.step = step; S.validation = false; render(true); }
  function editDone() {
    const before = S.result.preview;
    S.result = TS.build.commit(S.result, S.build); S.editing = false; S.build = null;
    S.changeFrom = { preview: before, ctx: "k.change.edit" };
    render(); showChange();
  }
  function tripOf() { const list = stationList(); return list.length ? { route: S.route, importMode: S.importMode, list: list.map((s) => ({ id: s.id, kind: s.kind || "", ans: stAnswer(s.id) })) } : null; }
  function activateNow() {
    S.actError = null;
    if (S.editing && S.build) { S.result = TS.build.commit(S.result, S.build); S.editing = false; }
    if (S.route === "build") S.result = TS.build.result(S.build);
    const step = S.route === "build" ? "editor" : generated() ? "result" : "preview";
    let r;
    try { r = TF.activate(stateFor(step)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { const toast = t("x.activated"); const trip = tripOf(); S = blank("today"); S.shared = null; S.toast = toast; S.trip = trip; render(true); const mine = S; setTimeout(() => { if (S === mine && S.toast) { S.toast = null; const el = root.querySelector(".k-toast"); if (el) el.remove(); } }, 6000); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render("dConflictBox"); return; }
    S.actError = TS.issueText(t, r, { preview: S.result && S.result.preview }); render("dActError");
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render("replTitle"); } else activateNow(); }

  /* ---------- stations (the one-line diagram) ---------- */
  function stationList(route = S.route, importMode = S.importMode) {
    if (route === "recommend" || route === "custom") return [...QUESTIONS[route].map((id) => ({ id, kind: "q" })), { id: "result", kind: "end" }];
    if (route === "browse") return [{ id: "schedule", kind: "q" }, { id: "environment", kind: "q" }, { id: "catalogue" }, { id: "preview", kind: "end" }];
    if (route === "build") return [{ id: "build_setup" }, { id: "editor", kind: "end" }];
    if (route === "import") return importMode === "file" ? [{ id: "file" }, { id: "review" }, { id: "preview", kind: "end" }] : [{ id: "ff1" }, { id: "ff2" }, { id: "ff3" }, { id: "review" }, { id: "preview", kind: "end" }];
    if (route === "shared") return [{ id: "link" }, { id: "preview", kind: "end" }];
    return [];
  }
  function stationIndex(list) {
    const r = S.route;
    if (S.editing) return list.length - 1;
    if (r === "import") {
      if (S.step === "preview") return list.length - 1;
      if (S.importDraft) return list.length - 2;
      if (S.importMode === "file") return 0;
      return S.ff.stage === 1 ? 0 : S.ff.stage === 2 ? 1 : 2;
    }
    if (r === "shared") return 1;
    if (r === "build") return S.step === "editor" ? 1 : 0;
    const i = list.findIndex((s) => s.id === S.step); return i < 0 ? 0 : i;
  }
  const stName = (id, route = S.route) => (id === "result" || id === "preview" || id === "editor" ? t("k.st.end") : id === "priorities" && route === "custom" ? t("k.st.priorities_custom") : t(`k.st.${id}`));
  function envShort(e) {
    if (!e || !e.kind) return "";
    const base = TF.env(e.kind); const same = (x, y) => JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort());
    const s = t(`k.ans.env.${e.kind}`);
    return same(base.equipment, e.equipment) && same(base.capabilities, e.capabilities) ? s : t("k.ans.env_adjusted", { env: s });
  }
  function stAnswer(id) {
    const a = S.answers;
    switch (id) {
      case "about": return a.desiredResult ? t(`k.ans.goal.${a.desiredResult}`) : "";
      case "schedule": return a.daysPerWeek && a.sessionMinutes ? t("k.ans.schedule", { days: a.daysPerWeek, min: a.sessionMinutes >= 90 ? "90+" : a.sessionMinutes }) : "";
      case "environment": return envShort(a.environment);
      case "priorities": { if (S.route === "custom") { const n = (a.primaryMuscles || []).length + (a.deEmphasizedMuscles || []).length + (a.ignoredMuscles || []).length; return n ? plural("k.ans.choices", n) : t("k.ans.none"); } const m = (a.primaryMuscles || []).map((x) => t(`entry.muscle.${x}`, undefined, x)); return m.length ? m.join(", ") : t("k.ans.prio_none"); }
      case "exercise_preferences": { const n = (a.mustHaveExercises || []).length + (a.exerciseConstraints || []).length; return n ? plural("k.ans.choices", n) : t("k.ans.none"); }
      case "custom_shape": { const c = (TF.splitChoices(TF.normalizeAnswers(a)).choices || []).find((x) => x.id === a.splitPreference); return c ? (lang === "pt" ? c.namePt || c.name : c.name) : ""; }
      case "catalogue": { const c = S.card ? TF.browseCards(answers()).find((x) => x.id === S.card) : null; return c ? (lang === "pt" ? c.familyNamePt || c.familyName : c.familyName) : ""; }
      case "build_setup": return a.programName || "";
      case "ff1": return plural("k.ans.lines", TS.freeform.lines(S.ff));
      case "ff2": return S.ff.provider === "chatgpt" ? "ChatGPT" : S.ff.provider === "claude" ? "Claude" : t("k.ans.sent");
      case "ff3": return t("k.ans.reply");
      case "file": return t("k.ans.file");
      case "review": return t("k.ans.reviewed");
      case "link": return t("k.ans.received");
      default: return "";
    }
  }
  /* The in-car diagram. trip: a stored list (Today); otherwise live state. */
  function strip(trip) {
    const route = trip ? trip.route : S.route;
    const list = trip ? trip.list : stationList().map((s) => ({ ...s, ans: "" }));
    if (!list.length) return "";
    const cur = trip ? list.length : stationIndex(list);
    const n = LINE[route]; const line = t(`k.line.${route}`);
    const total = trip ? list.length + 1 : list.length;
    const dense = total > 5;
    const items = list.map((s, i) => {
      const state = i < cur ? "passed" : i === cur ? "here" : "next";
      const label = stName(s.id, route);
      const ans = state === "passed" ? (trip ? s.ans : stAnswer(s.id)) : "";
      const inner = `<span class="k-st__dot" aria-hidden="true"></span><span class="k-st__txt"><span class="k-st__name">${esc(label)}</span>${ans ? `<span class="k-st__ans"${S.route === "import" ? " data-user-text" : ""}>${esc(ans)}</span>` : ""}</span>`;
      const jumpable = !trip && state === "passed" && QUESTIONS[route] && QUESTIONS[route].includes(s.id) && S.view === "route";
      const cls = `k-st is-${state}${s.kind === "end" ? " k-st--end" : ""}`;
      if (jumpable) return `<li class="${cls}" style="--k:${i}"><button type="button" class="k-st__btn" data-act="jump" data-step="${s.id}" aria-label="${esc(t("k.strip.back", { station: label, answer: ans || label }))}">${inner}</button></li>`;
      return `<li class="${cls}" style="--k:${i}"${state === "here" ? ' aria-current="step"' : ""}><span class="k-st__btn">${inner}</span></li>`;
    });
    if (trip) items.push(`<li class="k-st is-here k-st--today" style="--k:${list.length}" aria-current="step"><span class="k-st__btn"><span class="k-st__dot" aria-hidden="true"></span><span class="k-st__txt"><span class="k-st__name">${esc(t("k.st.today"))}</span></span></span></li>`);
    const left = total - 1 - cur;
    const nowName = trip ? t("k.st.today") : stName((list[Math.min(cur, list.length - 1)] || {}).id, route);
    const count = trip ? t("k.strip.today") : left <= 0 ? t("k.strip.terminal") : plural("k.strip.left", left);
    return `<nav class="k-strip${dense ? " k-strip--dense" : ""}" aria-label="${esc(t("k.strip.aria", { n: n || "", line, i: Math.min(cur + 1, total), total }))}">
      <div class="k-strip__route">${roundel(n)}<span class="k-strip__line">${n ? `${esc(t("k.line.n", { n }))} · ` : ""}${esc(line)}</span><span class="k-strip__count">${esc(count)}</span></div>
      <div class="k-strip__track" style="--n:${total};--i:${Math.min(cur, total - 1)}"><span class="k-strip__base" aria-hidden="true"></span><span class="k-strip__fill" aria-hidden="true"></span><ol class="k-strip__stops">${items.join("")}</ol></div><p class="k-strip__now" aria-hidden="true">${esc(nowName)} · ${esc(count)}</p></nav>`;
  }
  function animateStrip() {
    const nav = root.querySelector(".k-strip"); const tr = nav && nav.querySelector(".k-strip__track");
    const key = tr ? `${S.view}:${S.route || (S.trip && S.trip.route)}:${S.route === "import" ? S.importMode : ""}` : null;
    const i = tr ? +tr.style.getPropertyValue("--i") : null;
    const prev = lastStrip; lastStrip = tr ? { key, i } : null;
    if (!tr || reduced()) return;
    if (!prev || prev.key !== key) { nav.classList.add("is-boarding"); return; }
    if (prev.i === i) return;
    const fill = tr.querySelector(".k-strip__fill");
    fill.style.transition = "none"; tr.style.setProperty("--i", prev.i); void fill.getBoundingClientRect();
    fill.style.transition = ""; tr.style.setProperty("--i", i);
    const here = tr.querySelector(".k-st.is-here"); if (here) here.classList.add("is-arriving");
  }

  /* ---------- atoms ---------- */
  const opt = ({ key, val, title, cap, selected, role = "radio", icon, disabled, cls = "" }) =>
    `<button type="button" class="k-opt${role === "checkbox" ? " k-opt--check" : ""} ${cls}${selected ? " is-on" : ""}" role="${role}" aria-checked="${selected ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"${disabled ? " disabled" : ""}>${icon ? pict(icon) : ""}<span class="k-opt__body"><span class="k-opt__t">${esc(title)}</span>${cap ? `<span class="k-opt__c">${esc(cap)}</span>` : ""}</span><span class="k-opt__mark" aria-hidden="true"></span></button>`;
  const tag = ({ key, val, label, selected, role = "radio", disabled }) =>
    `<button type="button" class="k-tag${selected ? " is-on" : ""}" role="${role}" aria-checked="${selected ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"${disabled ? " disabled" : ""}>${esc(label)}</button>`;
  function group(id, label, inner, { role = "radiogroup", key, hint } = {}) {
    const miss = key && missingKeys().has(key);
    return `<section class="k-group${miss ? " is-missing" : ""}" role="${role}" aria-labelledby="${id}"${miss ? ` aria-describedby="${id}Err"` : ""}><h2 class="k-group__label" id="${id}">${esc(label)}</h2>${hint ? `<p class="k-hint">${esc(hint)}</p>` : ""}${miss ? `<p class="k-missing" id="${id}Err">${pict("alert", "k-pict--sm k-pict--warn")}<span>${esc(t("k.q.missing"))}</span></p>` : ""}${inner}</section>`;
  }
  const nums = (key, values, sel, unit) => `<div class="k-nums">${values.map((n) => `<button type="button" class="k-num${sel === n ? " is-on" : ""}" role="radio" aria-checked="${sel === n ? "true" : "false"}" data-act="pick" data-key="${key}" data-val="${n}"><span class="k-num__v">${n === 90 && key === "sessionMinutes" ? "90+" : n}</span><span class="k-num__u">${esc(unit)}</span></button>`).join("")}</div>`;
  const restSelected = (a, v) => has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : v !== "auto" && +v === a.preferredRestSeconds);
  const restText = (a) => (a.preferredRestSeconds === null ? t("k.chip.rest.auto") : t(`k.chip.rest.${a.preferredRestSeconds}`));
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };
  const goBtn = ({ label, attrs = "", cls = "", icon = true }) => `<button type="button" class="k-go ${cls}" ${attrs}><span class="k-go__t">${esc(label)}</span>${icon ? `<span class="k-go__arrow" aria-hidden="true">${ARROW}</span>` : ""}</button>`;
  const platform = (inner, extra = "") => `<footer class="k-platform" data-persistent-action${extra}><div class="k-platform__edge" aria-hidden="true"></div><div class="k-platform__in">${inner}</div></footer>`;
  function sign(title, { n = LINE[S.route], sub = "", cls = "", userText = false } = {}) {
    return `<div class="k-sign ${cls}">${roundel(n)}<h1 class="k-sign__name" data-focus${userText ? " data-user-text" : ""}>${esc(title)}</h1></div>${sub ? `<p class="k-q">${esc(sub)}</p>` : ""}`;
  }
  const note = (text, icon = "shield", role = "note") => `<p class="k-note" role="${role}">${pict(icon, "k-pict--sm")}<span>${esc(text)}</span></p>`;
  const alertBox = (title, body, { id = "", extra = "", role = "alert" } = {}) => `<div class="k-alert"${id ? ` id="${id}" tabindex="-1"` : ""} role="${role}"><div class="k-alert__band" aria-hidden="true"></div><div class="k-alert__in">${pict("alert", "k-pict--warn")}<div class="k-alert__txt">${title ? `<strong>${esc(title)}</strong>` : ""}${body ? `<p>${esc(body)}</p>` : ""}${extra}</div></div></div>`;
  const field = ({ label, input, hint = "", hintId = "", search = false }) => `<label class="k-field${search ? " k-field--search" : ""}"><span class="k-field__label">${esc(label)}</span><span class="k-field__box">${search ? `<span class="icon-mask icon-mask--search" aria-hidden="true"></span>` : ""}${input}</span>${hint ? `<span class="k-field__hint"${hintId ? ` id="${hintId}"` : ""}>${esc(hint)}</span>` : ""}</label>`;

  /* ---------- question bodies ---------- */
  function envCorrection(a, open) {
    const eq = new Set(a.environment.equipment || []), caps = new Set(a.environment.capabilities || []);
    return `<details class="k-disc" data-role="env-correction"${open ? " open" : ""}><summary class="k-disc__sum">${pict("sliders", "k-pict--line")}<span class="k-disc__t">${esc(t("entry.env_correct.summary"))}</span><span class="k-disc__chev" aria-hidden="true">${CHEV}</span></summary><div class="k-disc__body">
      <h3 class="k-group__label" id="kEq">${esc(t("entry.env_correct.equipment"))}</h3><div class="k-grid2" role="group" aria-labelledby="kEq">${TS.EQUIP.map((k) => opt({ key: "environmentEquipment", val: k, title: t(`entry.equip.${k}`, undefined, k), selected: eq.has(k), role: "checkbox", cls: "k-opt--compact" })).join("")}</div>
      <h3 class="k-group__label" id="kCaps">${esc(t("entry.env_correct.capabilities"))}</h3><div class="k-stack" role="group" aria-labelledby="kCaps">${TS.CAPS.map((k) => opt({ key: "environmentCapabilities", val: k, title: t(`entry.cap.${k}`, undefined, k), selected: caps.has(k), role: "checkbox", cls: "k-opt--compact" })).join("")}</div>
      <p class="k-hint">${esc(t("entry.env_correct.note"))}</p></div></details>`;
  }
  function reasonBlock(id, reason, pending) {
    const nm = exLabel(id);
    return `<div class="k-reason" role="group" aria-label="${esc(t("entry.priorities.avoid_reason", { exercise: nm }))}"><div class="k-reason__head"><strong>${esc(nm)}</strong><button type="button" class="k-link" data-act="avoid-remove" data-id="${esc(id)}">${esc(t("entry.priorities.avoid_remove"))}</button></div>
      <p class="k-reason__q">${esc(t("entry.priorities.avoid_reason", { exercise: nm }))}</p><div class="k-tags" role="radiogroup">${TS.REASONS.map((r) => tag({ key: "avoidReason", val: `${id}|${r}`, label: t(`entry.priorities.reason.${r}`), selected: reason === r })).join("")}</div>
      ${pending ? `<p class="k-hint" id="pendingAvoidNote">${esc(t("entry.priorities.reason_required"))}</p>` : ""}</div>`;
  }
  function avoidBlock(st, constraints, searchId) {
    const taken = new Set(constraints.map((c) => c.exerciseId)); if (st.pending) taken.add(st.pending);
    const matches = TF.searchLibrary(st.query, lang, { exclude: taken, limit: 6 });
    const hasPain = constraints.some((c) => c.reason === "pain");
    return `<div class="k-stack">${field({ label: t("entry.priorities.avoid_search"), search: true, input: `<input id="${searchId}" type="search" autocomplete="off" data-field="avoidQuery" value="${esc(st.query || "")}" placeholder="${esc(t("entry.search_placeholder"))}">` })}
      ${matches.length ? `<div class="k-results" role="listbox" aria-label="${esc(t("entry.priorities.avoid_search"))}">${matches.map((e) => `<button type="button" class="k-result" role="option" aria-selected="false" data-act="avoid-add" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span><span class="icon-mask icon-mask--plus" aria-hidden="true"></span></button>`).join("")}</div>` : ""}
      ${st.pending ? reasonBlock(st.pending, null, true) : ""}${constraints.map((c) => reasonBlock(c.exerciseId, c.reason, false)).join("")}
      ${hasPain ? note(t("entry.priorities.pain_note")) : ""}</div>`;
  }
  function questionBody(step, a, o = {}) {
    const route = o.route || S.route; const p = o.sheet ? "s" : "q";
    if (step === "about") {
      const goal = !a.desiredResult || S.goalOpen
        ? questionBody("desired_result", a, o)
        : `<div class="k-carried"><div class="k-carried__t"><span class="k-carried__k">${esc(t("k.about.goal"))}</span><span class="k-carried__v">${esc(t(`entry.desired_result.${a.desiredResult}.label`))}</span></div><button type="button" class="k-btn k-btn--sm" data-act="goal-edit" aria-label="${esc(t("k.about.goal_change"))}">${esc(t("x.change"))}</button></div>`;
      return goal + questionBody("background", a, o);
    }
    if (step === "desired_result") return group(`${p}Goal`, t("entry.desired_result.lede"), `<div class="k-stack">${TS.DESIRED.map((v) => opt({ key: "desiredResult", val: v, title: t(`entry.desired_result.${v}.label`), cap: t(`entry.desired_result.${v}.sub`), selected: a.desiredResult === v, icon: TS.DESIRED_ICON[v] })).join("")}</div>`, { key: "desiredResult" });
    if (step === "background") return group(`${p}Exp`, t("entry.background.experience.label"), `<div class="k-stack">${TS.EXPERIENCE.map((v) => opt({ key: "structuredExperience", val: v, title: t(`entry.background.experience.${v}`), selected: a.structuredExperience === v, cls: "k-opt--compact" })).join("")}</div>`, { key: "structuredExperience" })
      + group(`${p}Cons`, t("entry.background.consistency.label"), `<div class="k-stack">${TS.CONSISTENCY.map((v) => opt({ key: "recentConsistency", val: v, title: t(`entry.background.consistency.${v}`), selected: a.recentConsistency === v, cls: "k-opt--compact" })).join("")}</div>`, { key: "recentConsistency" });
    if (step === "schedule") {
      const days = group(`${p}Days`, t("entry.schedule.days.label"), nums("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek" });
      const mins = group(`${p}Min`, t("entry.schedule.minutes.label"), nums("sessionMinutes", TS.MINUTES, a.sessionMinutes, t("k.unit.min")), { key: "sessionMinutes" });
      const rest = route === "browse" ? "" : group(`${p}Rest`, t("entry.schedule.rest.label"), `<div class="k-stack">${TS.REST.map((v) => opt({ key: "preferredRestSeconds", val: v, title: t(`entry.schedule.rest.${v}`), selected: restSelected(a, v), cls: "k-opt--compact" })).join("")}</div>`, { key: "preferredRestSeconds" });
      return days + mins + rest;
    }
    if (step === "environment") {
      const open = o.sheet ? true : S.envOpen;
      const corr = a.environment ? `<div class="k-corr"${open && (o.sheet || route !== "browse") ? ' data-checkpoint="rec-env-correction"' : ""}>${envCorrection(a, open)}</div>` : "";
      return group(`${p}Env`, t("entry.environment.lede"), `<div class="k-stack">${TS.ENVS.map((v) => opt({ key: "environment", val: v, title: t(`entry.environment.${v}`), selected: a.environment && a.environment.kind === v, icon: TS.ENV_ICON[v], cls: "k-opt--compact" })).join("")}</div>`, { key: "environment" }) + corr;
    }
    if (step === "priorities" && route === "custom") return `<p class="k-hint">${esc(t("entry.priorities.state_hint"))}</p><div class="k-legacy">${TS.muscleEmphasis(t, a)}</div>`;
    if (step === "priorities") {
      const prim = a.primaryMuscles || []; const st = o.sheet ? S.sheet.avoid : S.avoid;
      return group(`${p}Prim`, t("entry.priorities.primary"), `<div class="k-stack">${opt({ key: "clearPriorities", val: "1", title: t("entry.priorities.none"), selected: prim.length === 0, cls: "k-opt--compact" })}<div class="k-grid2">${TS.MUSCLES.map((m) => opt({ key: "primaryMuscles", val: m, title: t(`entry.muscle.${m}`), selected: prim.includes(m), role: "checkbox", cls: "k-opt--compact", disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div><p class="k-hint">${esc(t(prim.length >= 2 ? "k.q.none_limit" : "entry.priorities.lede"))}</p></div>`, { role: "group" })
        + group(`${p}Mov`, t("entry.priorities.movements"), `<div class="k-stack">${TS.MOVEMENTS.map((m) => opt({ key: "priorityMovements", val: m, title: t(`entry.movement.${m}`), selected: (a.priorityMovements || []).includes(m), role: "checkbox", cls: "k-opt--compact" })).join("")}</div>`, { role: "group" })
        + `<section class="k-group" aria-labelledby="${p}Avoid"><h2 class="k-group__label" id="${p}Avoid">${esc(t("entry.priorities.avoid"))}</h2>${avoidBlock(st, a.exerciseConstraints || [], o.sheet ? "dSheetAvoid" : "avoidSearch")}</section>`;
    }
    if (step === "exercise_preferences") { const st = o.sheet ? S.sheet.pref : S.pref; return `<div class="k-legacy">${TS.exercisePrefs(t, lang, { query: st.query, pending: st.pending, mustHave: a.mustHaveExercises || [], constraints: a.exerciseConstraints || [] })}</div>`; }
    if (step === "custom_shape") {
      const c = TF.splitChoices(TF.normalizeAnswers(a)).choices || [];
      if (!c.length) return alertBox(t("entry.custom_shape.none_title"), t("entry.custom_shape.none_body"));
      return `<div class="k-stack" role="radiogroup" aria-label="${esc(t("entry.custom_shape.split"))}">${c.map((x) => { const est = (x.days || []).map((d) => d.estimateMinutes).filter(Number.isFinite); return opt({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt || x.name : x.name, days: x.frequency }), cap: `${c.length === 1 ? "" : t(x.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason")} ${est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""}`.trim(), selected: a.splitPreference === x.id }); }).join("")}</div>`;
    }
    return "";
  }
  function stepHead(step) {
    if (step === "priorities" && S.route === "custom") return { title: t("entry.priorities.custom_title"), lede: t("entry.priorities.custom_lede") };
    if (step === "priorities") return { title: t("entry.priorities.title"), lede: t("k.q.priorities_lede"), optional: true };
    if (step === "exercise_preferences") return { title: t("entry.exercise_preferences.title"), lede: t("entry.exercise_preferences.lede"), optional: true };
    if (step === "custom_shape") { const n = (TF.splitChoices(answers()).choices || []).length; return { title: t(n === 1 ? "entry.custom_shape.title_sole" : "entry.custom_shape.title"), lede: t(n === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede") }; }
    if (step === "schedule") return { title: t("entry.schedule.title"), lede: t("entry.schedule.lede") };
    if (step === "about") return { title: t("k.about.title"), lede: t("k.about.lede") };
    if (step === "environment") return { title: t("entry.environment.title") };
    return { title: "" };
  }

  /* ---------- the line network (map and landing) ---------- */
  function lineCost(route) {
    if (route === "import") return stationList("import", "freeform").length - 1;
    return stationList(route).length - 1;
  }
  const doTextOf = (route) => (route === "recommend" ? t("k.do.recommend", { n: QUESTIONS.recommend.length }) : route === "import" ? t("k.do.import", { n: stationList("import", "file").length - 1 }) : t(`k.do.${route}`));
  /* The full map: every line is a coloured track (the tap target) running from
     the origin rail into the terminal rail, with its station names on the dots. */
  function network() {
    const rows = MAP.map(([route, m]) => {
      const n = LINE[route]; const list = stationList(route, m || "freeform").slice(0, -1);
      const stops = list.map((st, i) => `<span class="k-net__stop" style="--k:${i}"><span class="k-net__dot" aria-hidden="true"></span><span class="k-net__stopname">${esc(stName(st.id, route))}</span></span>`).join("");
      return `<li class="k-net__row" data-line="${n}"><button type="button" class="k-net__line" data-act="route" data-route="${route}"${m ? ` data-mode="${m}"` : ""} aria-describedby="kDo${n}"><span class="k-net__head">${roundel(n)}<span class="k-net__name">${esc(t(`k.line.${route}`))}</span><span class="k-net__cost">${esc(plural("k.cost", list.length))}</span></span><span class="k-net__track k-net__track--${list.length}">${stops}</span></button><p class="k-net__do" id="kDo${n}">${esc(doTextOf(route))}</p></li>`;
    }).join("");
    return `<div class="k-net"><p class="k-net__origin"><span class="k-net__ring" aria-hidden="true"></span>${esc(t("k.map.origin"))}</p><ol class="k-net__rows">${rows}</ol>
      <div class="k-net__end"><div class="k-net__endstop"><span class="k-net__enddot" aria-hidden="true"></span><p><strong>${esc(t("k.map.end_program"))}</strong><span>${esc(t("k.map.end_program_sub"))}</span></p></div><div class="k-net__endstop"><span class="k-net__enddot k-net__enddot--today" aria-hidden="true"></span><p><strong>${esc(t("k.map.end_today"))}</strong><span>${esc(t("k.map.end_today_sub"))}</span></p></div></div></div>`;
  }
  /* The landing diagram: octilinear, drawn once in SVG. Five lines fan out at
     45° from one ring-marked interchange, run level, and end in the terminal
     rail, which feeds Seu programa and then Hoje. Station dots are the real
     station counts of each line. */
  function lineDiagram() {
    const ox = 20, oy = 100, rail = 326, ys = [20, 60, 100, 140, 180];
    const col = (n) => `var(--k-l${n})`, ink = "var(--k-ink)", panel = "var(--k-panel)";
    let paths = "", dots = "", labels = "";
    MAP.forEach(([route, m], i) => {
      const n = LINE[route]; const y = ys[i]; const sy = oy + (i - 2) * 10; const dy = Math.abs(y - sy); const x1 = ox + 16, x2 = x1 + dy;
      const d = `M${ox} ${sy}H${x1}L${x2} ${y}H${rail}`;
      if (n === 4) paths += `<path d="${d}" style="stroke:${ink}" stroke-width="10" fill="none" stroke-linejoin="round"/>`;
      paths += `<path d="${d}" style="stroke:${col(n)}" stroke-width="7" fill="none" stroke-linejoin="round"/>`;
      const count = stationList(route, m || "freeform").length - 1;
      for (let k = 0; k < count; k++) { const x = 212 + (count === 1 ? 50 : (k * 100) / (count - 1)); dots += `<circle cx="${x}" cy="${y}" r="5" style="fill:${panel};stroke:${n === 4 ? ink : col(n)}" stroke-width="3.2"/>`; }
      labels += `<circle cx="132" cy="${y - 1}" r="9.5" style="fill:${col(n)};stroke:${n === 4 ? ink : panel}" stroke-width="${n === 4 ? 1.5 : 0}"/><text x="132" y="${y + 3}" text-anchor="middle" class="k-svgnum" style="fill:var(--k-l${n}-ink)">${n}</text><text x="146" y="${y - 7}" class="k-svgname">${esc(t(`k.line.${route}`))}</text>`;
    });
    const rails = `<rect x="${rail - 6}" y="8" width="12" height="184" rx="6" style="fill:${panel};stroke:${ink}" stroke-width="3.5"/><path d="M${rail} 192V246" style="stroke:${ink}" stroke-width="5"/><rect x="${rail - 7}" y="206" width="14" height="22" rx="7" style="fill:${panel};stroke:${ink}" stroke-width="3.5"/><circle cx="${rail}" cy="246" r="6.5" style="fill:${ink};stroke:${panel}" stroke-width="3"/><circle cx="${rail}" cy="246" r="11" style="fill:none;stroke:${ink}" stroke-width="3"/>`;
    const origin = `<rect x="${ox - 9}" y="${oy - 30}" width="18" height="60" rx="9" style="fill:${panel};stroke:${ink}" stroke-width="3.5"/><circle cx="${ox}" cy="${oy}" r="6.5" style="fill:${panel};stroke:${ink}" stroke-width="3"/><circle cx="${ox}" cy="${oy}" r="2.5" style="fill:${ink}"/>`;
    const end = `<text x="${rail - 16}" y="222" text-anchor="end" class="k-svgname">${esc(t("k.map.end_program"))}</text><text x="${rail - 16}" y="251" text-anchor="end" class="k-svgname">${esc(t("k.map.end_today"))}</text>`;
    return `<svg class="k-diagram" viewBox="0 0 346 262" aria-hidden="true" focusable="false">${paths}${rails}${origin}${dots}${labels}${end}</svg>`;
  }

  /* ---------- screens ---------- */
  const band = () => `<header class="k-band"><span class="k-band__mark"><img src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="40" height="40"></span><span class="k-band__name">Taurifer</span><span class="k-band__gap"></span>${TS.privacyButton(t, { cls: "k-band__privacy" })}<span class="k-band__lines" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></header>`;
  const landingActions = () => `<div class="k-land__acts">${goBtn({ label: t("landing.build"), attrs: 'id="firstRunCreate" data-act="land-create"' })}${goBtn({ label: t("landing.track"), attrs: 'id="firstRunImport" data-act="land-import"', cls: "k-go--outline" })}</div>`;
  function landingView() {
    if (S.view === "shared-gate" && S.shared) {
      const m = S.shared.program.meta; const n = S.shared.program.exercises.length;
      return `<main class="k-land" data-checkpoint="shared-gate">${band()}<div class="k-land__in">
        <h1 class="k-land__head" data-focus>${esc(t("landing.shared.headline"))}</h1><p class="k-lede">${esc(t("landing.shared.body"))}</p>
        <section class="k-panel k-gate" aria-labelledby="kGateName"><h2 class="k-gate__name" id="kGateName" data-user-text>${esc(m.name)}</h2><p class="k-facts"><span>${esc(t("entry.catalogue.days_badge", { days: m.daysPerWeek }))}</span><span>${esc(t("entry.preview.exercises", { n, exercise: TF.tp(t, n, "exercise") }))}</span></p><h3 class="k-group__label">${esc(t("k.gate.what"))}</h3><p>${esc(t("x.shared.what"))}</p><p>${esc(t("x.shared.nothing_saved"))}</p></section>
        <div class="k-land__acts">${goBtn({ label: t("setup.shared.title"), attrs: 'id="firstRunSharedStart" data-act="shared-start" aria-describedby="kGateCap"' })}<p class="k-hint" id="kGateCap"><span data-user-text>${esc(t(m.daysPerWeek === 1 ? "setup.shared.cap_one" : "setup.shared.cap_many", { name: m.name, n: m.daysPerWeek }))}</span></p></div>
        <p class="k-land__privacy">${esc(t("x.privacy.line"))}</p></div></main>`;
    }
    const invalid = S.view === "shared-invalid";
    return `<main class="k-land" data-checkpoint="${invalid ? "shared-invalid" : "landing"}">${band()}<div class="k-land__in">
      <h1 class="k-land__head" data-focus>${esc(t(invalid ? "landing.shared.invalid_headline" : "landing.headline"))}</h1>
      <p class="k-lede">${esc(t(invalid ? "landing.shared.invalid_body" : "landing.body"))}</p>
      ${invalid ? alertBox("", t(TF.sharedErrorKey(S.sharedError)), { role: "status" }) : `<figure class="k-land__map" role="img" aria-label="${esc(t("k.land.map_aria"))}">${lineDiagram()}<figcaption aria-hidden="true">${esc(t("k.land.map"))}</figcaption></figure>`}
      ${landingActions()}
      <p class="k-land__privacy">${pict("shield", "k-pict--sm")}<span>${esc(t("x.privacy.line"))}</span></p>
      ${invalid ? "" : `<section class="k-proof" aria-labelledby="kProof"><h2 class="k-h2" id="kProof">${esc(t("k.land.proof_title"))}</h2><p class="k-hint">${esc(t("k.land.proof_body"))}</p>${TS.landingProof(t, lang)}</section>`}
      </div></main>`;
  }
  function recoveryCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") { const keep = info.route === "import" || info.route === "shared"; return `<div class="k-recover" data-checkpoint="rules-changed">${alertBox(t("entry.rules_changed.title"), t(keep ? "entry.rules_changed.body_keep" : "entry.rules_changed.body_rebuild"), { role: "status", extra: `<div class="k-acts">${keep ? `<button type="button" class="k-btn" data-act="rules-keep" disabled>${esc(t("entry.rules_changed.keep"))}</button>` : `<button type="button" class="k-btn" data-act="rules-rebuild">${esc(t("entry.rules_changed.rebuild"))}</button>`}</div>` })}</div>`; }
    const f = TS.resumeFacts(t, lang, info);
    return `<section class="k-panel k-resume" data-checkpoint="resume" aria-labelledby="kResumeTitle"><h2 class="k-h2" id="kResumeTitle">${esc(t("entry.resume.title"))}</h2><p>${esc(t("entry.resume.body"))}</p><p class="k-hint">${esc(t("k.resume.at", { route: f.route, step: f.step, when: f.when }))}</p><div class="k-acts">${goBtn({ label: t("entry.resume.continue"), attrs: 'id="dResume" data-act="resume"' })}<button type="button" class="k-btn k-btn--danger" id="dResumeRestart" data-act="resume-restart" aria-haspopup="dialog">${esc(t("entry.resume.restart"))}</button></div></section>`;
  }
  function activeBoard() {
    return `<section class="k-status" aria-labelledby="kActive">${pict("pin")}<div class="k-status__txt"><h2 class="k-status__name" id="kActive">${esc(t("k.map.active_title", { name: "\u0000" })).split("\u0000").join(`<span data-user-text>${esc(TF.activeName(lang))}</span>`)}</h2><p class="k-status__meta">${esc(plural("k.map.sessions", TF.device.sessions))}</p><p class="k-status__note">${esc(t("k.map.replace_note"))}</p></div></section>`;
  }
  const chev = `<span class="k-chev" aria-hidden="true">${CHEV}</span>`;
  function hubView() {
    const active = TF.hasActiveProgram();
    return `<div class="k-app" data-line="0"><header class="k-bar"><button type="button" class="k-bar__btn" data-act="hub-back">${chev}${esc(t(active ? "k.map.back_today" : "entry.back"))}</button></header>
      <main class="k-main k-map" data-checkpoint="${active ? "hub-existing" : "route-choice"}">
        ${sign(t("k.map.title"), { n: 0, cls: "k-sign--map" })}<p class="k-lede">${esc(t(active ? "k.map.lede_existing" : "k.map.lede"))}</p>
        ${active ? activeBoard() : ""}${recoveryCard()}${network()}
      </main></div>`;
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

  /* ---------- the terminal (review) ---------- */
  const factLabel = (kind) => t({ desired_result: "k.fact.goal", background: "k.fact.background", schedule: "k.fact.schedule", environment: "k.fact.environment", priorities: S.route === "custom" ? "k.fact.emphasis" : "k.fact.priorities", exercise_preferences: "k.fact.exercises", custom_shape: "k.fact.shape" }[kind]);
  function addedIds(before, after) {
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    return added.size && added.size < (after.program || []).length ? added : new Set();
  }
  function changeLine() {
    if (!S.changeFrom || !S.result) return "";
    const b = S.changeFrom.preview, a = S.result.preview, d = TF.identityDiff(b, a);
    const fb = TF.previewFacts(b), fa = TF.previewFacts(a); const cons = S.changeFrom.ctx === "k.change.constraints";
    const facts = (f) => t("k.change.facts", { ex: t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), sets: t("entry.preview.sets", { n: f.sets }) });
    return `<div class="k-change" id="kChange" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}">${pict("reset", "k-pict--line")}<div class="k-change__txt"><p class="k-change__line">${esc(t(S.changeFrom.ctx))} ${esc(TS.changeText(t, d))}</p>${d.n === 0 && fb.sets === fa.sets ? "" : `<p class="k-change__ba"><span><span class="k-change__k">${esc(t(cons ? "k.change.without" : "k.change.before"))}</span> ${esc(facts(fb))}</span><span><span class="k-change__k">${esc(t(cons ? "k.change.with" : "k.change.after"))}</span> ${esc(facts(fa))}</span></p>`}</div></div>`;
  }
  function weekView(preview, added) {
    const days = preview.days || [];
    return `<ol class="k-week">${days.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((n, e) => n + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const open = i === 0 || ex.some((e) => added.has(e.id));
      const list = ex.length ? ex.map((e) => { const isNew = added.has(e.id); return `<li class="k-ex${isNew ? " is-new" : ""}" data-slot="${esc(e.id)}"><span class="k-ex__tick" aria-hidden="true"></span><span class="k-ex__name">${esc(TS.exName(e, lang))}${isNew ? ` <span class="k-new">${esc(t("k.rev.new"))}</span>` : ""}</span><span class="k-ex__rx">${e.sets != null ? `${e.sets} × ${e.min}–${e.max}` : ""}</span></li>`; }).join("") : `<li class="k-ex k-ex--empty">${esc(t("program.empty.exercises"))}</li>`;
      return `<li class="k-day"><details${open ? " open" : ""}><summary class="k-day__sum"><span class="k-day__dot" aria-hidden="true"></span><span class="k-day__head"><span class="k-day__name">${esc(TF.dayName(t, d, preview.programStructure, i))}</span><span class="k-day__meta">${esc(meta)}</span></span><span class="k-disc__chev" aria-hidden="true">${CHEV}</span></summary><ul class="k-day__list">${list}</ul></details></li>`;
    }).join("")}</ol>`;
  }
  const CHIP_STEP = { goal: "desired_result", exp: "background", cons: "background", days: "schedule", minutes: "schedule", rest: "schedule", env: "environment", prio: "priorities", avoid: "priorities", emph: "priorities", prefs: "exercise_preferences", shape: "custom_shape" };
  function chipList() {
    const a = S.answers, n = answers(); const out = [];
    const add = (chip, what, text) => out.push({ chip, what: t(`k.what.${what}`), text });
    const libs = (ids) => ids.map(exLabel).join(", ");
    if (a.desiredResult) add("goal", "goal", t(`k.chip.goal.${a.desiredResult}`));
    if (a.structuredExperience) add("exp", "exp", t(`entry.background.experience.${a.structuredExperience}`));
    if (a.recentConsistency) add("cons", "cons", t(`k.chip.cons.${a.recentConsistency}`));
    if (a.daysPerWeek) add("days", "days", t("k.chip.days", { n: a.daysPerWeek }));
    if (a.sessionMinutes) add("minutes", "minutes", a.sessionMinutes >= 90 ? t("k.chip.minutes_90") : t("k.chip.minutes", { n: a.sessionMinutes }));
    if (has(a, "preferredRestSeconds")) add("rest", "rest", restText(a));
    if (a.environment) { const kind = a.environment.kind; const env = t(`entry.environment.${kind}`); add("env", "env", envShort(a.environment) === t(`k.ans.env.${kind}`) ? env : t("k.chip.env_adjusted", { env })); }
    const avoids = (a.exerciseConstraints || []).map((c) => c.exerciseId);
    if (S.route === "recommend") {
      const pr = TS.priorityLabel(t, lang, n, false); add("prio", "prio", pr ? t("k.chip.prio", { list: pr }) : t("k.chip.prio_none"));
      if (avoids.length) add("avoid", "avoid", t("k.chip.avoid", { list: libs(avoids) }));
    } else {
      const pr = TS.priorityLabel(t, lang, n, true); add("emph", "emph", pr ? t("k.chip.emph", { list: pr }) : t("k.chip.emph_none"));
      const inc = a.mustHaveExercises || [];
      add("prefs", "prefs", [inc.length ? t("k.chip.include", { list: libs(inc) }) : "", avoids.length ? t("k.chip.avoid", { list: libs(avoids) }) : ""].filter(Boolean).join(" · ") || t("k.chip.prefs_none"));
      const c = (TF.splitChoices(n).choices || []).find((x) => x.id === a.splitPreference);
      if (c) add("shape", "shape", t("k.chip.shape", { name: t("entry.custom_shape.choice", { name: lang === "pt" ? c.namePt || c.name : c.name, days: c.frequency }) }));
    }
    return out;
  }
  function editorView() {
    const sh = S.sheet; if (!sh) return "";
    const pending = sh.avoid.pending || sh.pref.pending;
    return `<section class="k-edit" id="kEdit" aria-labelledby="kEditTitle"><div class="k-edit__head">${pict("pencil", "k-pict--line")}<h2 class="k-edit__title" id="kEditTitle" tabindex="-1">${esc(factLabel(sh.kind))}</h2></div>
      ${sh.error ? alertBox("", sh.error) : ""}${questionBody(sh.kind, sh.answers, { sheet: true })}
      <div class="k-acts">${goBtn({ label: t("k.sheet.apply"), attrs: `data-act="sheet-apply"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}` })}<button type="button" class="k-btn" data-act="sheet-close">${esc(t("k.edit.keep"))}</button></div></section>`;
  }
  function chipsBlock() {
    return `<section class="k-sec" aria-labelledby="kChipsLabel"><h2 class="k-h2" id="kChipsLabel">${esc(t("k.chips.label"))}</h2><p class="k-hint">${esc(t("k.chips.hint"))}</p>
      <div class="k-chips">${chipList().map((c) => { const open = !!(S.sheet && S.sheet.chip === c.chip); return `<button type="button" class="k-chip${open ? " is-open" : ""}" data-act="chip" data-chip="${c.chip}" aria-expanded="${open}"${open ? ' aria-controls="kEdit"' : ""} aria-label="${esc(t("k.chip.aria", { what: c.what, value: c.text }))}"><span>${esc(c.text)}</span><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span></button>`; }).join("")}</div>${editorView()}</section>`;
  }
  const infoList = (rows) => `<ul class="k-info">${rows.map((x) => `<li>${pict(x.icon, "k-pict--sm")}<span>${esc(x.text)}</span>${x.after || ""}</li>`).join("")}</ul>`;
  function reviewBody() {
    if (!S.result) return `${sign(t("k.rev.error_title"))}${alertBox("", S.compileError || t("x.issue.compile"))}`;
    const r = S.result, p = r.preview, f = TF.previewFacts(p), a = answers(), gen = generated();
    const sub = S.route === "recommend" ? t("entry.result.title") : S.route === "custom" ? t("entry.result.custom_title") : t(`entry.preview.source.${S.route}`);
    const facts = [t("entry.catalogue.days_badge", { days: (p.days || []).length }), TF.durationLabel(t, p), t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), t("entry.preview.sets", { n: f.sets })].filter(Boolean);
    const conflict = S.notice === "conflict" ? `<div id="dConflictBox" tabindex="-1" class="k-conflict" data-checkpoint="activation-conflict">${alertBox(t("entry.conflict.title"), t("entry.conflict.body"), { extra: `<div class="k-acts"><button type="button" class="k-btn" data-act="conflict-review">${esc(t("entry.conflict.review"))}</button></div>` })}</div>` : "";
    let out = `${sign(name(), { sub, cls: "k-sign--terminal", userText: S.route === "shared" || S.route === "import" })}${conflict}
      <p class="k-facts" id="kFacts">${facts.map((x) => `<span>${esc(x)}</span>`).join("")}</p>${changeLine()}
      ${TF.hasActiveProgram() && S.notice !== "conflict" ? note(t("entry.active_notice"), "pin", "status") : ""}
      <section class="k-sec" aria-labelledby="kWeek"><h2 class="k-h2" id="kWeek">${esc(t("entry.preview.days"))}</h2>${weekView(p, S.changeFrom && gen ? addedIds(S.changeFrom.preview, p) : new Set())}</section>`;
    if (gen) {
      out += chipsBlock();
      const reasons = TS.reasons(t, lang, r, a, { custom: S.route === "custom" });
      out += `<section class="k-sec" aria-labelledby="kWhy"><h2 class="k-h2" id="kWhy">${esc(t("entry.result.why"))}</h2>${infoList(reasons)}<p class="k-hint">${esc(t("entry.result.lede"))}</p></section>`;
    } else {
      const card = S.route === "browse" && S.card ? TF.browseCards(answers()).find((c) => c.id === S.card) : null;
      const rows = [];
      if (card) { rows.push({ icon: "target", text: t(`entry.catalogue.purpose.${card.purpose}`) }); rows.push({ icon: "dumbbell", text: t("entry.catalogue.equipment", { equipment: card.equipmentAssumptions.map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ") }) }); }
      rows.push({ icon: "trend", text: t(TF.progressionCopyKey(p)) });
      if (S.route === "import") rows.push({ icon: "shield", text: t("import.safe") });
      out += `<section class="k-sec" aria-labelledby="kProg"><h2 class="k-h2" id="kProg">${esc(t("entry.preview.progression"))}</h2>${infoList(rows)}</section>`;
    }
    const adj = TS.adjustments(t, p);
    if (adj.length) out += `<section class="k-sec" aria-labelledby="kAdj"><h2 class="k-h2" id="kAdj">${esc(t("k.rev.adjusted"))}</h2>${infoList(adj.map((x) => ({ icon: "scale", text: x.text })))}</section>`;
    const cons = gen ? TS.constraintLines(t, lang, a) : [];
    if (cons.length) out += `<section class="k-sec" aria-labelledby="kCons"><h2 class="k-h2" id="kCons">${esc(t("k.rev.constraints"))}</h2>${infoList(cons.map((x) => ({ icon: x.kind === "avoid" ? "shield" : "check", text: x.text, after: x.kind === "avoid" ? `<button type="button" class="k-btn k-btn--sm" data-act="restore" data-id="${esc(x.id)}" aria-label="${esc(t("k.rev.restore_aria", { exercise: exLabel(x.id) }))}">${esc(t("k.rev.restore"))}</button>` : "" })))}</section>`;
    if (r.alternative) out += `<section class="k-sec" aria-labelledby="kAlt"><h2 class="k-h2" id="kAlt">${esc(t("entry.result.alternative"))}</h2><p>${esc(TF.resultName(r.alternative, lang) || "")}</p></section>`;
    if (TF.progressionIssue(p)) out += `<div id="dBlocked">${alertBox("", t("entry.preview.activation_blocked"))}</div>`;
    if (S.actError) out += `<div id="dActError" tabindex="-1">${alertBox("", S.actError)}</div>`;
    out += `<section class="k-sec k-more" aria-labelledby="kMore"><h2 class="visually-hidden" id="kMore">${esc(t("k.rev.more"))}</h2><div class="k-acts"><button type="button" class="k-btn" id="dEdit" data-act="edit"><span class="icon-mask icon-mask--pencil" aria-hidden="true"></span>${esc(t("entry.preview.edit"))}</button><button type="button" class="k-btn k-btn--danger" id="dRestart" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div></section>`;
    return out;
  }
  function activateFooter({ ready = true, reasonId = null, statusHtml = "" } = {}) {
    const blocked = S.notice === "conflict" ? "dConflictBox" : !ready ? reasonId : null;
    const label = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : S.route === "build" && !S.editing ? t("entry.editor.use") : t("entry.preview.activate_first");
    return platform(`${statusHtml}${goBtn({ label, attrs: `id="dActivate" data-activate data-act="activate"${blocked ? ` disabled aria-describedby="${blocked}"` : ""}` })}`, ' data-checkpoint="activate"');
  }
  function catalogueBody() {
    const a = S.answers; const cards = TF.browseCards(answers());
    const label = (s) => t(`program.progression.strategy.${s}`, undefined, s);
    const range = (vals, exact, rng) => (Math.min(...vals) === Math.max(...vals) ? t(exact, { n: vals[0] }) : t(rng, { min: Math.min(...vals), max: Math.max(...vals) }));
    const card = (c) => { const nm = lang === "pt" ? c.familyNamePt || c.familyName : c.familyName; const ex = c.structureFacts.map((x) => x.exerciseCount), sets = c.structureFacts.map((x) => x.setCount);
      return `<li><button type="button" class="k-card" data-act="card" data-id="${esc(c.id)}"><span class="k-card__top"><span class="k-card__name">${esc(nm)}</span><span class="k-card__days">${esc(t("entry.catalogue.days_badge", { days: c.daysPerWeek }))}</span></span><span>${esc(t(`entry.catalogue.purpose.${c.purpose}`))}</span><span class="k-facts"><span>${esc(c.minutes[0] === c.minutes[1] ? t("entry.preview.minutes", { n: c.minutes[0] }) : t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }))}</span><span>${esc(range(ex, "entry.catalogue.exercises_exact", "entry.catalogue.exercises_range"))}</span><span>${esc(range(sets, "entry.catalogue.sets_exact", "entry.catalogue.sets_range"))}</span></span><span class="k-hint">${esc(t("entry.catalogue.progression", { progression: c.progressionStrategies.map(label).join(" · ") }))}</span>${c.mismatch ? `<span class="k-hint">${esc(t("entry.catalogue.mismatch_frequency", { requested: a.daysPerWeek, actual: c.daysPerWeek }))}</span>` : ""}</button></li>`; };
    const fits = cards.filter((c) => !c.mismatch), others = cards.filter((c) => c.mismatch);
    return `${sign(t("k.st.catalogue"), { sub: t("entry.catalogue.title") })}<p class="k-lede">${esc(t("entry.catalogue.lede"))}</p>
      <div class="k-context"><p class="k-facts"><span>${esc(t("entry.catalogue.context_days", { days: a.daysPerWeek }))}</span><span>${esc(t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }))}</span><span>${esc(t(`entry.environment.${a.environment ? a.environment.kind : "other"}`))}</span></p><button type="button" class="k-btn k-btn--sm" data-act="jump" data-step="schedule" aria-label="${esc(t("k.catalogue.change_aria"))}">${esc(t("x.change"))}</button></div>
      ${fits.length ? `<section class="k-sec" aria-labelledby="kFits"><h2 class="k-h2" id="kFits">${esc(t("entry.catalogue.group_fits", { days: a.daysPerWeek }))}</h2><ul class="k-cards">${fits.map(card).join("")}</ul></section>` : alertBox(t("entry.catalogue.empty_title"), t("entry.catalogue.empty_body"))}
      ${others.length ? `<details class="k-disc"><summary class="k-disc__sum"><span class="k-disc__t">${esc(t("entry.catalogue.group_other"))} (${others.length})</span><span class="k-disc__chev" aria-hidden="true">${CHEV}</span></summary><div class="k-disc__body"><p class="k-hint">${esc(t("entry.catalogue.mismatch"))}</p><ul class="k-cards">${others.map(card).join("")}</ul></div></details>` : ""}`;
  }
  function editorParts() {
    const forBuild = S.route === "build" && !S.editing;
    const st = forBuild ? TS.build.status(t, S.build, { revAtStart: S.revAtStart }) : TS.build.status(t, S.build, { route: S.route, result: S.result, revAtStart: S.revAtStart });
    const head = forBuild
      ? `${sign(S.build.name || t("untitled_program"), { userText: true, sub: t("k.build.days_caption", { n: S.build.days.length }) })}`
      : `${sign(name(), { sub: t("entry.preview.edit") })}<p class="k-lede">${esc(t("k.edit.lede"))}</p><button type="button" class="k-btn" data-act="edit-done">${esc(t("k.edit.done"))}</button>`;
    const status = TS.build.statusLine(st, { id: "editorStatus" });
    const tail = forBuild ? `<div class="k-acts"><button type="button" class="k-btn" data-act="save-draft">${esc(t("entry.editor.save"))}</button></div>` : "";
    const inFlow = compact() || st.ready;
    return { body: head + `<div class="k-legacy k-editor">${TS.build.editor(t, lang, S.build)}</div>` + (inFlow ? status : "") + tail, footer: activateFooter({ ready: st.ready, reasonId: "editorStatus", statusHtml: inFlow ? "" : status }) };
  }
  function buildSetupBody() {
    const a = S.answers; const miss = missingKeys();
    return `${sign(t("k.st.build_setup"), { sub: t("entry.build_setup.title") })}<p class="k-lede">${esc(t("entry.build_setup.lede"))}</p>${TF.hasActiveProgram() ? note(t("entry.active_notice"), "pin", "status") : ""}${validationNotice()}
      <div class="k-group">${field({ label: t("entry.build_setup.name"), input: `<input id="dBuildName" type="text" maxlength="80" autocomplete="off" data-field="programName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"${miss.has("programName") ? ' aria-invalid="true" aria-describedby="dNameErr"' : ""}>` })}${miss.has("programName") ? `<p class="k-missing" id="dNameErr">${esc(TS.issueText(t, ["program_name_required"]))}</p>` : ""}</div>
      ${group("qBDays", t("entry.build_setup.days"), nums("daysPerWeek", TS.DAYS, a.daysPerWeek, t("entry.schedule.days.sub")), { key: "daysPerWeek" })}`;
  }

  /* ---------- import: paste door, file door, review ---------- */
  const badgeFor = (row) => (row.reviewed ? { k: "confirmed", icon: "check" } : { k: row.status === "probable" ? "probable" : row.status, icon: row.status === "unmatched" ? "alert" : "search" });
  function pickerBody(query) {
    const results = TF.searchLibrary(query, lang, { limit: 6, all: true });
    return `<div class="k-picker">${field({ label: t("x.build.search"), search: true, input: `<input id="pickerSearch" type="search" autocomplete="off" data-field="pickerQuery" value="${esc(query || "")}" placeholder="${esc(t("entry.search_placeholder"))}">` })}<div class="k-results" role="listbox" aria-label="${esc(t("x.build.search"))}">${results.map((e) => `<button type="button" class="k-result" role="option" aria-selected="false" data-act="pick-exercise" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span><span class="icon-mask icon-mask--plus" aria-hidden="true"></span></button>`).join("")}</div></div>`;
  }
  function importRows(draft) {
    const ordered = [...draft.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
    return `<ol class="k-imp">${ordered.map((row) => {
      const proposed = !row.reviewed && row.match ? row.match : null; const shown = row.decision === "link" && row.match ? row.match : proposed;
      const target = shown ? TF.libraryName(shown, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
      const b = badgeFor(row);
      const folded = row.reviewed && !row.expanded;
      const links = !folded && row.shortlist.length ? row.shortlist.map((e, i) => `<button type="button" class="k-btn k-btn--sm${i === 0 ? " k-btn--line" : ""}" data-act="imp" data-imp="pick" data-key="${row.key}" data-idx="${i}">${esc(t("import.action_link", { name: TF.libraryName(e, lang) }))}</button>`).join("") : (!folded && row.match && row.decision !== "link" ? `<button type="button" class="k-btn k-btn--sm k-btn--line" data-act="imp" data-imp="link" data-key="${row.key}">${esc(t("import.action_link", { name: TF.libraryName(row.match, lang) }))}</button>` : "");
      const escapes = `<button type="button" class="k-btn k-btn--sm" data-act="imp" data-imp="choose" data-key="${row.key}">${esc(t("import.action_choose"))}</button>${row.decision !== "raw" || !row.reviewed ? `<button type="button" class="k-btn k-btn--sm" data-act="imp" data-imp="raw" data-key="${row.key}">${esc(t("import.action_keep"))}</button>` : ""}${row.decision !== "custom" ? `<button type="button" class="k-btn k-btn--sm" data-act="imp" data-imp="custom" data-key="${row.key}">${esc(t("import.action_custom"))}</button>` : ""}`;
      const acts = folded ? `<button type="button" class="k-btn k-btn--sm" data-act="imp" data-imp="expand" data-key="${row.key}">${esc(t("import.action_change"))}</button>` : links ? links + `<details class="k-more-opts"><summary>${esc(t("import.more_options"))}</summary><div class="k-imp__acts">${escapes}</div></details>` : escapes;
      const picker = S.picker && S.picker.key === row.key ? pickerBody(S.picker.query) : "";
      return `<li class="k-imp__row improw${row.reviewed ? "" : " is-open"}" data-imp-row="${row.key}"><div class="k-imp__pair"><p class="k-imp__from" data-user-text>${esc(row.raw.name || "")}</p><span class="k-imp__arrow" aria-hidden="true">${ARROW}</span><div class="k-imp__to"><p class="k-imp__name improw__name">${esc(target)}</p><span class="k-badge impbadge is-${b.k}"><span class="icon-mask icon-mask--${b.icon}" aria-hidden="true"></span>${esc(t(`import.status.${b.k}`))}</span></div></div><div class="k-imp__acts">${acts}</div>${picker}</li>`;
    }).join("")}</ol>`;
  }
  function importCounts(d) {
    const c = TF.importCounts(d);
    return `<dl class="k-boardrow">${[["linked", c.linked], ["review", c.review], ["custom", c.custom]].map(([k, v]) => `<div class="k-boardrow__cell${k === "review" && v ? " is-open" : ""}" data-metric="${k}"><dt>${esc(t(`import.count_${k}`))}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
  }
  function ffSummary(ff) { return `<div class="k-stnote"><span class="k-stnote__dot" aria-hidden="true"></span><p class="k-stnote__t"><strong>${esc(t("k.st.ff1"))}</strong><span data-user-text>${esc(t("entry.freeform.source_summary", { lines: TS.freeform.lines(ff) }))}</span></p><button type="button" class="k-btn k-btn--sm" data-act="ff" data-ff="edit-source">${esc(t("k.ff.note_edit"))}</button></div>`; }
  function ffBody(ff) {
    const program = TS.freeform.program(ff);
    if (ff.status === "gaps" && ff.gap) {
      const g = ff.gap;
      return `<div class="k-stack">${g.notImported.length ? note(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }), "alert", "status") : ""}${ff.gapErrors.size ? `<div id="dGapError" tabindex="-1">${alertBox("", t("entry.freeform.gap_error"))}</div>` : ""}
        <ol class="k-gaps">${g.gaps.map((gap) => { const bad = ff.gapErrors.has(gap.key); const label = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` }); return `<li class="k-gap${bad ? " is-bad" : ""}">${field({ label, input: `<input type="text" inputmode="numeric"${bad ? ' aria-invalid="true"' : ""} data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}">` })}${bad ? `<p class="k-missing">${pict("alert", "k-pict--sm k-pict--warn")}<span>${esc(t("entry.freeform.gap_error"))}</span></p>` : ""}</li>`; }).join("")}</ol>
        <div class="k-acts">${goBtn({ label: t("entry.freeform.gaps_submit"), attrs: 'data-act="ff" data-ff="gap-submit"' })}<button type="button" class="k-btn" data-act="ff" data-ff="gap-back">${esc(t("entry.freeform.back_to_reply"))}</button></div></div>`;
    }
    if (ff.stage === 1) return `<div class="k-stack">${field({ label: t("entry.freeform.input_label"), input: `<textarea id="ffIn" rows="${compact() ? 5 : 8}" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(ff.input)}</textarea>`, hint: t("entry.freeform.count", { n: TF.nf(lang, ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }), hintId: "ffCount" })}
      <p class="k-hint" id="ffNeeds"${program ? " hidden" : ""}>${esc(t("entry.freeform.needs_input"))}</p>${note(t("entry.freeform.privacy"))}
      ${goBtn({ label: t("entry.freeform.continue"), attrs: `data-act="ff" data-ff="continue"${program ? "" : " disabled"}` })}</div>`;
    const prompt = TF.freeformPrompt(t, program);
    if (ff.stage === 2) return ffSummary(ff) + `<div class="k-stack k-sec"><p class="k-hint">${esc(t("entry.freeform.stage2_hint"))}</p>
      <div class="k-providers"><a class="k-go k-go--provider" href="https://chatgpt.com/?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt"><span class="k-go__t">${esc(t("entry.freeform.open_chatgpt"))}</span><span class="k-go__arrow" aria-hidden="true">${ARROW}</span></a><a class="k-go k-go--provider" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude"><span class="k-go__t">${esc(t("entry.freeform.open_claude"))}</span><span class="k-go__arrow" aria-hidden="true">${ARROW}</span></a></div>
      <details class="k-disc"><summary class="k-disc__sum"><span class="k-disc__t">${esc(t("entry.freeform.preview_prompt"))}</span><span class="k-disc__chev" aria-hidden="true">${CHEV}</span></summary><div class="k-disc__body"><pre class="k-pre">${esc(prompt)}</pre></div></details>
      <button type="button" class="k-btn" data-act="ff" data-ff="copy">${esc(t("entry.freeform.copy"))}</button></div>`;
    const unreadable = ff.status === "unreadable" ? alertBox(t("entry.freeform.unreadable_title"), t("entry.freeform.unreadable_body"), { extra: `<div class="k-acts"><button type="button" class="k-btn" data-act="ff" data-ff="copy-repair">${esc(t("entry.freeform.copy_repair_prompt"))}</button><button type="button" class="k-btn" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button></div>` }) : "";
    const invalidated = ff.invalidated ? note(t("entry.freeform.edit_source_warning"), "alert", "status") : "";
    return ffSummary(ff) + `<div class="k-stack k-sec">${invalidated}${unreadable}<p class="k-hint">${esc(t("entry.freeform.stage3_hint"))}</p>
      ${goBtn({ label: t("entry.freeform.clipboard_import"), attrs: 'data-act="ff" data-ff="clipboard"' })}
      <label class="k-field"><span class="visually-hidden">${esc(t("k.ff.reply_label"))}</span><span class="k-field__box"><textarea id="ffOut" rows="${compact() ? 5 : 7}" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.clipboard_or"))}">${esc(ff.reply)}</textarea></span></label>
      <button type="button" class="k-btn" data-act="ff" data-ff="review">${esc(t("entry.freeform.review"))}</button>
      <div class="k-acts k-acts--row"><button type="button" class="k-btn" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button><button type="button" class="k-btn k-btn--danger" data-act="ff" data-ff="start-over" aria-haspopup="dialog">${esc(t("entry.freeform.start_over"))}</button></div></div>`;
  }
  function importSwitches() {
    const toMode = S.importMode === "freeform" ? "file" : "freeform";
    return `<section class="k-transfer" aria-labelledby="kSwitch"><h2 class="k-transfer__title" id="kSwitch">${pict("reset", "k-pict--sm")}${esc(t("k.imp.switch"))}</h2>
      <button type="button" class="k-transfer__go" data-act="import-mode" data-mode="${toMode}">${roundel(5)}<span class="k-transfer__txt"><strong>${esc(t(toMode === "file" ? "entry.freeform.to_file" : "entry.import_source.to_freeform"))}</strong></span></button>
      <button type="button" class="k-transfer__go k-transfer__go--4" data-act="switch-build">${roundel(4)}<span class="k-transfer__txt"><strong>${esc(t("k.imp.write_own"))}</strong></span></button></section>`;
  }
  function importBody() {
    if (S.importDraft) {
      const d = S.importDraft; const c = TF.importCounts(d);
      return { body: `${sign(t("k.st.review"), { sub: t("import.heading") })}<p class="k-lede">${esc(t("import.lede"))}</p><p class="k-ticket" data-user-text><span>${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</span></p>
        ${d.notImported.length ? note(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }), "alert", "status") : ""}
        ${importCounts(d)}${importRows(d)}
        ${d.originalText ? `<details class="k-disc"><summary class="k-disc__sum"><span class="k-disc__t">${esc(t("entry.freeform.view_original"))}</span><span class="k-disc__chev" aria-hidden="true">${CHEV}</span></summary><div class="k-disc__body"><pre class="k-pre">${esc(d.originalText)}</pre></div></details>` : ""}
        ${note(t("import.safe"))}${c.review && compact() ? `<p class="k-hint k-reasonline" id="dImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}`,
        footer: platform(`${c.review && !compact() ? `<p class="k-platform__reason" id="dImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}${goBtn({ label: t("entry.preview.review"), attrs: `id="dImportCommit" data-act="import-commit"${c.review ? ' disabled aria-describedby="dImpReason"' : ""}` })}`) };
    }
    const active = TF.hasActiveProgram() ? note(t("entry.active_notice"), "pin", "status") : "";
    if (S.importMode === "freeform") {
      const ff = S.ff; const gaps = ff.status === "gaps";
      const st = ff.stage === 1 ? "ff1" : ff.stage === 2 ? "ff2" : "ff3";
      const sub = gaps ? t("k.ff.gaps_title") : ff.stage === 1 ? t("entry.freeform.title") : ff.stage === 2 ? t("entry.freeform.stage2_title") : t("entry.freeform.stage3_title");
      const lede = gaps ? t("k.ff.gaps_lede") : ff.stage === 1 ? t("entry.freeform.lede") : "";
      const dialog = ff.confirmStartOver ? dialogHtml({ id: "ffRestartTitle", role: "alertdialog", attrs: 'data-confirm="ff-start-over"', close: 'data-act="ff" data-ff="start-over-cancel"', title: t("entry.freeform.confirm_start_over"), buttons: [`<button type="button" class="k-btn k-btn--danger" data-act="ff" data-ff="start-over-confirm">${esc(t("x.ff.restart_confirm"))}</button>`, `<button type="button" class="k-btn k-btn--strong" data-act="ff" data-ff="start-over-cancel">${esc(t("x.ff.restart_cancel"))}</button>`] }) : "";
      const ledeHtml = lede ? `<p class="k-lede">${esc(lede)}</p>` : "";
      return { body: `${sign(t(`k.st.${st}`), { sub })}${compact() ? "" : ledeHtml}${active}<div class="k-ff">${ffBody(ff)}</div>${compact() ? ledeHtml : ""}${gaps ? "" : importSwitches()}`, footer: "", overlay: dialog };
    }
    return { body: `${sign(t("k.st.file"), { sub: t("entry.import_source.title") })}<p class="k-lede">${esc(t("entry.import_source.lede"))}</p>${active}<div class="k-stack">${goBtn({ label: t("entry.import_source.pick"), attrs: 'data-act="import-file"' })}<p class="k-hint">${esc(t("x.cost.file"))}</p></div>${importSwitches()}`, footer: "" };
  }
  function validationNotice() { return S.validation ? `<div id="dValidation" tabindex="-1" class="k-validation">${alertBox(t("entry.validation.title"), t("entry.validation.body"))}</div>` : ""; }
  function transferBlock() {
    const to = XFER[S.route]; if (!to || !["about", "schedule", "environment"].includes(S.step)) return "";
    const kept = SHARED_KEYS.filter((k) => has(S.answers, k)).length; if (!kept) return "";
    const list = stationList(to); const idx = list.findIndex((s) => s.id === S.step); const left = list.length - 1 - Math.max(0, idx);
    return `<section class="k-transfer" aria-labelledby="kXfer"><h2 class="k-transfer__title" id="kXfer"><span class="k-xring" aria-hidden="true">${roundel(LINE[S.route])}${roundel(LINE[to])}</span>${esc(t("k.xfer.title"))}</h2>
      <button type="button" class="k-transfer__go k-transfer__go--${LINE[to]}" data-act="transfer" data-route="${to}">${roundel(LINE[to])}<span class="k-transfer__txt"><strong>${esc(t("k.xfer.to", { n: LINE[to], line: t(`k.line.${to}`) }))}</strong><span>${esc(t("k.xfer.keeps"))} ${esc(plural("k.strip.left", left))}.</span></span></button></section>`;
  }
  function routeView() {
    const qs = QUESTIONS[S.route] || []; const qi = qs.indexOf(S.step);
    let body = "", footer = "", overlay = "";
    if (qi >= 0) {
      const h = stepHead(S.step); const pending = S.avoid.pending || S.pref.pending;
      const ledeHtml = h.lede ? `<p class="k-lede">${esc(h.lede)}</p>` : "";
      body = `${sign(stName(S.step), { sub: h.title })}${h.optional ? `<p class="k-optional">${esc(t("entry.optional"))}</p>` : ""}${compact() ? "" : ledeHtml}${validationNotice()}${questionBody(S.step, S.answers)}${compact() ? ledeHtml : ""}${transferBlock()}`;
      const screens = generated() ? [...qs, "result"] : STEPS[S.route];
      const next = screens[screens.indexOf(S.step) + 1];
      const label = S.step === "custom_shape" ? t("entry.custom_shape.generate") : next === "result" ? t("k.go.show") : t("k.go.next", { station: stName(next) });
      footer = platform(goBtn({ label, attrs: `id="dNext" data-advance data-act="next"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}` }));
    } else if (S.step === "catalogue") body = catalogueBody();
    else if (S.step === "build_setup") { body = buildSetupBody(); footer = platform(goBtn({ label: t("entry.build_setup.open"), attrs: 'id="dNext" data-advance data-act="next"' })); }
    else if (S.step === "import_source") { const r = importBody(); body = r.body; footer = r.footer; overlay = r.overlay || ""; }
    else if ((S.route === "build" && S.step === "editor") || S.editing) { const e = editorParts(); body = e.body; footer = e.footer; }
    else if (reviewing()) { body = reviewBody(); if (S.result && !S.sheet) footer = activateFooter({ ready: !TF.progressionIssue(S.result.preview), reasonId: "dBlocked" }); }
    const xfer = S.xfer ? `<p class="k-xfer-done" role="status">${pict("reset", "k-pict--sm")}<span>${esc(plural("k.xfer.done", S.xfer.k, { k: S.xfer.k, n: S.xfer.from }))}</span></p>` : "";
    return `<div class="k-app" data-line="${LINE[S.route]}"><header class="k-bar"><button type="button" class="k-bar__btn" data-act="back">${chev}${esc(t("entry.back"))}</button><span class="k-bar__gap"></span><button type="button" class="k-exit" data-act="cancel" aria-label="${esc(t("k.exit_aria"))}">${EXIT}<span>${esc(t("k.exit"))}</span></button></header>
      ${strip()}${xfer}
      <main class="k-main" data-entry-step="${esc(entryStep())}"${S.editing ? " data-editor" : ""} data-checkpoint="${esc(checkpointFor())}">${body}</main>${footer}</div>${overlay}`;
  }
  function dialogHtml({ id, role = "dialog", attrs = "", close, title, body = "", bodyId = "", buttons }) {
    return `<div class="k-scrim" ${close}></div><div class="k-dialog" role="${role}" aria-modal="true" aria-labelledby="${id}"${bodyId ? ` aria-describedby="${bodyId}"` : ""} ${attrs}><div class="k-dialog__band">${pict("alert", "k-pict--inv")}<h2 id="${id}" tabindex="-1">${esc(title)}</h2></div>${body ? `<p class="k-dialog__body"${bodyId ? ` id="${bodyId}"` : ""}>${esc(body)}</p>` : ""}<div class="k-dialog__acts">${buttons.join("")}</div></div>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return dialogHtml({ id: "cancelTitle", attrs: 'data-checkpoint="cancel-confirm"', close: 'data-act="cancel-continue"', title: t("k.cancel.title"), body: t("k.cancel.body"), bodyId: "cancelBody", buttons: [`<button type="button" class="k-btn k-btn--strong" data-act="cancel-keep">${esc(t("k.cancel.keep"))}</button>`, `<button type="button" class="k-btn k-btn--danger" data-act="cancel-discard">${esc(t("k.cancel.discard"))}</button>`, `<button type="button" class="k-btn" data-act="cancel-continue">${esc(t("k.cancel.continue"))}</button>`] });
    if (S.overlay === "replace") { const current = TF.activeName(lang), next = name(); return dialogHtml({ id: "replTitle", attrs: 'data-checkpoint="replace-confirm"', close: 'data-act="replace-cancel"', title: t("x.replace.title"), body: t("x.replace.body", { current, next, n: TF.device.sessions }), bodyId: "replBody", buttons: [`<button type="button" class="k-btn k-btn--strong" data-act="replace-confirm">${esc(t("x.replace.confirm", { next }))}</button>`, `<button type="button" class="k-btn" data-act="replace-cancel">${esc(t("x.replace.cancel", { current }))}</button>`] }); }
    if (S.overlay === "restart") return dialogHtml({ id: "restartTitle", role: "alertdialog", attrs: 'data-confirm="restart"', close: 'data-act="restart-cancel"', title: t("x.restart.title"), body: t(S.route === "shared" ? "x.restart.body_shared" : "x.restart.body"), bodyId: "restartBody", buttons: [`<button type="button" class="k-btn k-btn--danger" data-act="restart-confirm">${esc(t("x.restart.confirm"))}</button>`, `<button type="button" class="k-btn k-btn--strong" data-act="restart-cancel">${esc(t("x.restart.cancel"))}</button>`] });
    if (S.overlay === "resume-discard") return dialogHtml({ id: "dDiscardTitle", role: "alertdialog", attrs: 'data-confirm="discard-draft"', close: 'data-act="resume-discard-cancel"', title: t("k.resume.discard_title"), body: t("k.resume.discard_body"), bodyId: "dDiscardBody", buttons: [`<button type="button" class="k-btn k-btn--danger" data-act="resume-discard-confirm">${esc(t("k.resume.discard_confirm"))}</button>`, `<button type="button" class="k-btn k-btn--strong" data-act="resume-discard-cancel">${esc(t("k.resume.discard_cancel"))}</button>`] });
    return "";
  }
  const toastHtml = () => (S.toast ? `<div class="k-toast" role="status">${pict("check", "k-pict--sm k-pict--line")}<span>${esc(S.toast)}</span></div>` : "");
  function view() {
    if (S.view === "today") return `<div class="k-app k-today" data-line="${S.trip ? LINE[S.trip.route] : 0}">${S.trip ? strip(S.trip) : ""}${TF.renderToday(t, lang)}</div>` + toastHtml();
    if (S.view === "hub") return hubView() + overlayView();
    if (S.view === "route") return routeView() + overlayView() + toastHtml();
    return landingView();
  }
  const sel = (x) => (/^[#\[.]/.test(x) ? x : "#" + CSS.escape(x));
  function focusId(id) {
    const el = root.querySelector(sel(id)) || document.querySelector(sel(id));
    if (!el) { TS.focusHeading(root); return; }
    if (!el.matches("button,a,input,textarea,select,summary") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: false }); } catch (e) { /* ignore */ }
  }
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
    document.body.classList.toggle("k-body", true);
    animateStrip();
    if (typeof focus === "string") focusId(focus);
    else if (focus) { window.scrollTo(0, 0); TS.focusHeading(root); }
    else if (key) { const el = root.querySelector(key); if (el) { if (typing && el.id) TS.refocus(root, el.id); else try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  }
  function scrollToEl(el, pad = 12) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - pad)); }

  /* ---------- inline answer editors ---------- */
  function openSheet(chip) {
    const kind = CHIP_STEP[chip];
    S.sheet = { kind, chip, answers: clone(S.answers), avoid: { query: "", pending: null }, pref: { query: "", pending: null }, error: null };
    render(); revealEditor();
  }
  function revealEditor() {
    const ed = root.querySelector("#kEdit"); if (!ed) return;
    const h = ed.querySelector("h2"); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    const ok = ed.querySelector('[data-act="sheet-apply"]'); const r = ed.getBoundingClientRect(); const o = ok.getBoundingClientRect();
    if (o.bottom - r.top + 24 <= window.innerHeight) scrollToEl(ed); else window.scrollTo(0, Math.max(0, o.bottom + window.scrollY - window.innerHeight + 16));
  }
  function closeSheet() { const chip = S.sheet && S.sheet.chip; S.sheet = null; render(chip ? `[data-chip="${chip}"]` : true); }
  function showChange() {
    const c = root.querySelector("#kChange"); if (!c) { TS.focusHeading(root); return; }
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
    if (!r.ok) { sh.error = r.text; render("kEditTitle"); return; }
    S.changeFrom = { preview: S.result.preview, ctx: "k.change.answer" };
    S.answers = next; S.result = r.result; S.sheet = null;
    render(); showChange();
  }
  function restore(id) {
    const next = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== id) };
    const r = compileWith(TF.normalizeAnswers(next)); if (!r.ok) { S.actError = r.text; render("dActError"); return; }
    S.changeFrom = { preview: S.result.preview, ctx: "k.change.restore" }; S.answers = next; S.result = r.result; render(); showChange();
  }

  /* ---------- actions ---------- */
  function onPick(d) {
    if (S.sheet) {
      const sh = S.sheet;
      if (d.key === "avoidReason") { sh.avoid.pending = null; sh.pref.pending = null; }
      sh.answers = TS.applyPick(sh.answers, d.key, d.val); sh.error = null; render(); return;
    }
    if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
    if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (d.key === "daysPerWeek" && S.route === "custom") delete S.answers.splitPreference;
    render();
  }
  function on(act, d) {
    S.cpTag = null;
    if (!/^field:/.test(act)) S.xfer = null;
    if (act !== "save-draft" && S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": S.view = "hub"; render(true); return;
      case "land-import": go("import", "freeform"); return;
      case "hub-back": S.view = TF.hasActiveProgram() ? "today" : "landing"; render(true); return;
      case "route": go(d.route, d.mode); return;
      case "transfer": transfer(d.route); return;
      case "goal-edit": S.goalOpen = true; render(`[data-key="desiredResult"][data-val="${S.answers.desiredResult}"]`); return;
      case "pick": onPick(d); return;
      case "next": advance(); return;
      case "back": back(); return;
      case "jump": jump(d.step); return;
      case "cancel": if (S.route === "shared") { toGate(); return; } S.overlay = "cancel"; render("cancelTitle"); return;
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
      case "resume-restart": S.overlay = "resume-discard"; render("dDiscardTitle"); return;
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
      case "import-file": S.importDraft = S.importHeld && S.importHeld.sourceType === "file" ? S.importHeld : TF.buildImportDraft(TF.F.importFile[lang], t("k.imp.file_name"), "file"); S.importHeld = null; render(true); return;
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
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("k.imp.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  async function reach(cp) {
    const u = TF.F.users;
    lastStrip = null;
    const build = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [dd, id] of plan) { S.build.picker = dd; S.build = TS.build.apply(S.build, "add", id); } };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": case "route-help": S.view = "hub"; break;
      case "rec-goal": at("recommend", "about", {}); break;
      case "rec-background": at("recommend", "about", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", "schedule", { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" }); break;
      case "rec-environment": at("recommend", "environment", rafael()); break;
      case "rec-env-correction": { const a = rafael(); a.environment = correctedEnv(); at("recommend", "environment", a); S.envOpen = true; break; }
      case "rec-priorities": at("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", "priorities", a); break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); compileFirst(); if (cp === "replace-confirm") { S.overlay = "replace"; render("replTitle"); return; } break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); compileFirst(); const before = S.result.preview; S.answers = { ...S.answers, environment: correctedEnv() }; compileFirst(); S.changeFrom = { preview: before, ctx: "k.change.answer" }; S.cpTag = cp; break; }
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
      case "import-review": at("import", "import_source", {}); S.importMode = "file"; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("k.imp.file_name"), "file"); break;
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
  async function recommendSections(api, a) {
    await api.tap(pickKey("desiredResult", a.desiredResult));
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
  async function startRecommendFromHub(api) { await api.tap('[data-act="route"][data-route="recommend"]'); await api.tap(pickKey("desiredResult", "muscle_growth")); }
  const journeys = {
    async "activate.recommend"(api) {
      const a = TF.fixtureAnswers("rafael");
      await api.tap("#firstRunCreate"); await api.tap('[data-act="route"][data-route="recommend"]');
      await recommendSections(api, a);
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
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth"));
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m")); await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most")); await api.tap(advanceSel);
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3)); await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60)); await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120)); await api.tap(advanceSel);
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap(advanceSel);
      await api.tap(advanceSel); api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, s] of [["recommend", '[data-act="route"][data-route="recommend"]'], ["custom", '[data-act="route"][data-route="custom"]'], ["browse", '[data-act="route"][data-route="browse"]'], ["build", '[data-act="route"][data-route="build"]'], ["import", '[data-act="route"][data-route="import"]']]) {
        await api.tap(s); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
      }
    },
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.k = {
    id: "k", name: "K · Linhas", policy: { productDecisions: [] },
    thesis: "Setup as a metro trip: five coloured lines on one map, each step a station, cost counted in stations, every line ending at your program and then Today.",
    axis: "Route comprehension and safe switching through a network map, the in-car one-line diagram and transfers; no product decision reopened.",
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      fresh(c.seed); TS.wire(root, on);
      root.addEventListener("toggle", (ev) => { const el = ev.target; if (!el || el.tagName !== "DETAILS") return; if (el.dataset.role === "env-correction" && !S.sheet) S.envOpen = el.open; }, true);
      document.addEventListener("keydown", onKey);
      render();
    },
    reach,
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
