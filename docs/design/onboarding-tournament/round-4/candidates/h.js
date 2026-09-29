/* Candidate H · Concreto (Round 4, bold directions; seed 41ef581f, assigned lead)
   Onboarding as a sequence of concrete poems: every screen is one
   typographic composition on a six-column grid, one monumental lowercase
   word states the decision, the answers are words placed in the
   composition, and the lifter's choice floods its cell with the one
   saturated field. Signature interaction, "o verso": every answer is set
   into a running verse; on the review the verse becomes the poster's
   colophon and each of its words reopens that answer in place.
   Product policy: no product decision reopened (PD-1 to PD-4 closed). The
   chooser offers all five jobs; minutes and rest are asked; nothing is
   preselected; no program exists before the answers. Every program comes
   from the real engine through TF / TS. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "h.name": "H · Concreto",
      "h.land.key": "exatamente",
      "h.land.proof": "Hoje, logo depois de ativar um programa.",
      "h.land.proof_alt": "A tela de Hoje: Corpo inteiro, semana 1 de 6, 0 de 3 sessões concluídas. A sessão de hoje é o Dia 1, com quadríceps, peito e posteriores em cinco exercícios, e o botão Começar treino.",
      "h.brand.home": "Taurifer",
      "h.index": "{n} de {total}",
      "h.index.sr": "Pergunta {n} de {total}.",
      "h.verse.sr": "Suas respostas até aqui:",
      "h.verse.more": "e mais {n}",
      "h.hub.lede_existing": "{name} continua ativo até você usar outro programa. Escolha como montar o próximo.",
      "h.door.recommend": "recomendar", "h.door.custom": "personalizar", "h.door.browse": "explorar", "h.door.freeform": "colar", "h.door.file": "importar", "h.door.build": "montar",
      "h.cost.recommend": "{n} perguntas, uma por tela, e uma etapa opcional.",
      "h.cost.custom": "{n} perguntas, uma por tela, depois ênfase, exercícios e estrutura.",
      "h.cost.browse": "{n} perguntas, depois você escolhe em uma lista.",
      "h.cost.freeform": "Cole o texto, abra o ChatGPT ou o Claude, cole a resposta.",
      "h.cost.file": "Um arquivo de programa Taurifer de outro dispositivo.",
      "h.cost.build": "Você digita cada exercício de cada dia.",
      "h.resume.at": "{route} · {step} · salvo em {when}",
      "h.mono.goal": "objetivo", "h.mono.experience": "experiência", "h.mono.consistency": "constância", "h.mono.days": "dias", "h.mono.minutes": "minutos", "h.mono.rest": "descanso", "h.mono.environment": "lugar", "h.mono.priorities": "prioridades", "h.mono.emphasis": "ênfase", "h.mono.prefs": "exercícios", "h.mono.shape": "estrutura", "h.mono.setup": "nome", "h.mono.editor": "dias",
      "h.mono.paste": "colar", "h.mono.handoff": "converter", "h.mono.reply": "resposta", "h.mono.gaps": "lacunas", "h.mono.file": "arquivo", "h.mono.review": "vínculos", "h.mono.catalogue": "programas",
      "h.q.goal": "O que você quer deste programa?",
      "h.q.experience": "Há quanto tempo você segue programas de treino estruturados?",
      "h.q.consistency": "Com que constância você treinou nas últimas seis semanas?",
      "h.q.days": "Quantos dias por semana você pode treinar?",
      "h.q.minutes": "Quanto tempo cabe em uma sessão típica?",
      "h.q.rest": "Quanto você prefere descansar entre séries exigentes?",
      "h.q.environment": "Onde você treina?",
      "h.q.priorities": "Algo para priorizar ou evitar?",
      "h.q.priorities_lede": "Opcional. Sem escolhas aqui, o Taurifer monta o programa só com as respostas anteriores.",
      "h.q.emphasis": "Que ênfase cada músculo deve ter?",
      "h.q.none_limit": "Você já escolheu dois músculos. Desmarque um para trocar.",
      "h.q.prefs": "Algum exercício para incluir ou evitar?",
      "h.q.minutes_lede": "É um teto: o Taurifer monta sessões que cabem nele.",
      "h.unit.days": "dias", "h.unit.min": "minutos", "h.unit.sec": "segundos", "h.unit.minrest": "minutos",
      "h.rest.about": "cerca de",
      "h.rest.more": "ou mais",
      "h.adv.need": "Escolha uma resposta.",
      "h.adv.show": "Mostrar meu programa",
      "h.adv.catalogue": "Ver programas",
      "h.adv.editor": "Abrir os dias",
      "h.v.goal.muscle_growth": "ganhar massa", "h.v.goal.balanced": "massa e força", "h.v.goal.strength": "força",
      "h.v.exp.first": "primeiro programa", "h.v.exp.under_6m": "menos de 6 meses", "h.v.exp.6_to_24m": "6 a 24 meses", "h.v.exp.over_24m": "mais de 2 anos",
      "h.v.cons.most": "maior parte das sessões", "h.v.cons.about_half": "cerca de metade das sessões", "h.v.cons.few": "poucas sessões", "h.v.cons.none": "voltando de uma pausa",
      "h.v.days": "{n} dias", "h.v.min": "até {n} min", "h.v.min90": "90 min ou mais",
      "h.v.rest.auto": "descanso a critério do Taurifer", "h.v.rest.60": "descanso de 60 s", "h.v.rest.90": "descanso de 90 s", "h.v.rest.120": "descanso de 2 min", "h.v.rest.180": "descanso de 3 min ou mais",
      "h.v.env.commercial_gym": "academia comercial", "h.v.env.basic_gym": "academia básica", "h.v.env.limited_home": "casa, pouco equipamento", "h.v.env.full_home": "academia em casa", "h.v.env.other": "outra configuração",
      "h.v.env_adj": "{env}, ajustado",
      "h.v.prio_none": "sem prioridade", "h.v.prio": "prioriza {list}", "h.v.avoid": "evita {list}", "h.v.include": "inclui {list}",
      "h.v.emph_none": "ênfase normal", "h.v.emph": "{state}: {list}", "h.v.prefs_none": "sem preferência de exercícios", "h.v.shape": "{name}",
      "h.what.goal": "objetivo", "h.what.background": "treino recente", "h.what.schedule": "agenda", "h.what.environment": "lugar de treino", "h.what.priorities": "prioridades", "h.what.emphasis": "ênfase muscular", "h.what.prefs": "preferências de exercícios", "h.what.shape": "estrutura semanal",
      "h.chip.aria": "Alterar {what}:",
      "h.ed.title": "Mudar {what}",
      "h.ed.apply": "Refazer o programa",
      "h.ed.keep": "Manter como estava",
      "h.rev.verse": "Montado com as suas palavras. Toque em uma para mudar e o programa é refeito aqui.",
      "h.rev.days": "{n} dias",
      "h.rev.new": "novo",
      "h.rev.before_after": "Antes {before}. Agora {after}.",
      "h.rev.facts_short": "{ex} exercícios, {sets} séries",
      "h.rev.source": "Origem: {source}",
      "h.rev.why": "Por que este programa",
      "h.rev.col_meta": "{n} exercícios · {sets} séries",
      "h.rev.rx_sr": "{sets} séries de {min} a {max} repetições",
      "h.ff.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições nos campos desta tela.",
      "h.ff.edit_sr": "Editar o texto colado",
      "h.mode.label": "Como trazer o programa",
      "h.mode.freeform": "Colar texto",
      "h.mode.file": "Arquivo Taurifer",
      "h.import.file_name": "programa-do-rafael.json",
      "h.import.counts": "{linked} vinculados · {review} para revisar · {custom} personalizados",
      "h.import.from": "No arquivo",
      "h.import.to": "No programa",
      "h.import.back_links": "Voltar aos vínculos",
      "h.today.toast": "Programa ativo. Hoje mostra sua primeira sessão.",
      "h.build.name_label": "Nome do programa",
      "h.build.days_q": "Quantos dias de treino?",
      "h.build.need_name": "Dê um nome e escolha os dias para continuar.",
      "h.cat.facts": "{days} dias · {minutes}",
      "h.error.title": "O programa não pôde ser montado",
      "entry.cancel_confirm.body": "Salve este rascunho para retomar depois, ou descarte para começar de novo na próxima vez.",
      "entry.cancel_confirm.keep": "Salvar rascunho e sair",
      "entry.freeform.not_imported.cardio": "cardio",
      "entry.freeform.input_placeholder": "Empurrar A\nSupino reto 4 x 6-8\nSupino inclinado com halteres 3 x 8-12",
      "entry.freeform.needs_input": "Cole o seu programa acima primeiro.",
      "entry.freeform.copy_repair_prompt": "Copiar comando de correção",
    },
    en: {
      "h.name": "H · Concreto",
      "h.land.key": "exactly",
      "h.land.proof": "Today, right after a program is activated.",
      "h.land.proof_alt": "The Today screen: Full body, week 1 of 6, zero of three sessions completed. Today's session is Day 1, with quads, chest and hamstrings across five exercises, and a Start workout button.",
      "h.brand.home": "Taurifer",
      "h.index": "{n} of {total}",
      "h.index.sr": "Question {n} of {total}.",
      "h.verse.sr": "Your answers so far:",
      "h.verse.more": "and {n} more",
      "h.hub.lede_existing": "{name} stays active until you use another program. Choose how to set up the next one.",
      "h.door.recommend": "recommend", "h.door.custom": "customize", "h.door.browse": "browse", "h.door.freeform": "paste", "h.door.file": "import", "h.door.build": "build",
      "h.cost.recommend": "{n} questions, one per screen, and one optional step.",
      "h.cost.custom": "{n} questions, one per screen, then emphasis, exercises and structure.",
      "h.cost.browse": "{n} questions, then you pick from a list.",
      "h.cost.freeform": "Paste the text, open ChatGPT or Claude, paste the reply.",
      "h.cost.file": "A Taurifer program file from another device.",
      "h.cost.build": "You type every exercise of every day.",
      "h.resume.at": "{route} · {step} · saved {when}",
      "h.mono.goal": "goal", "h.mono.experience": "experience", "h.mono.consistency": "consistency", "h.mono.days": "days", "h.mono.minutes": "minutes", "h.mono.rest": "rest", "h.mono.environment": "place", "h.mono.priorities": "priorities", "h.mono.emphasis": "emphasis", "h.mono.prefs": "exercises", "h.mono.shape": "structure", "h.mono.setup": "name", "h.mono.editor": "days",
      "h.mono.paste": "paste", "h.mono.handoff": "convert", "h.mono.reply": "reply", "h.mono.gaps": "gaps", "h.mono.file": "file", "h.mono.review": "matches", "h.mono.catalogue": "programs",
      "h.q.goal": "What do you want from this program?",
      "h.q.experience": "How long have you followed structured training programs?",
      "h.q.consistency": "How consistently have you trained in the last six weeks?",
      "h.q.days": "How many days a week can you train?",
      "h.q.minutes": "How long can a typical session last?",
      "h.q.rest": "How long do you prefer to rest between hard sets?",
      "h.q.environment": "Where do you train?",
      "h.q.priorities": "Anything to prioritize or avoid?",
      "h.q.priorities_lede": "Optional. With nothing chosen here, Taurifer builds the program from your earlier answers alone.",
      "h.q.emphasis": "What emphasis should each muscle get?",
      "h.q.none_limit": "You have chosen two muscles. Clear one to choose another.",
      "h.q.prefs": "Any exercise to include or avoid?",
      "h.q.minutes_lede": "It is a ceiling: Taurifer builds sessions that fit inside it.",
      "h.unit.days": "days", "h.unit.min": "minutes", "h.unit.sec": "seconds", "h.unit.minrest": "minutes",
      "h.rest.about": "about",
      "h.rest.more": "or more",
      "h.adv.need": "Choose an answer.",
      "h.adv.show": "Show my program",
      "h.adv.catalogue": "See programs",
      "h.adv.editor": "Open the days",
      "h.v.goal.muscle_growth": "muscle growth", "h.v.goal.balanced": "muscle and strength", "h.v.goal.strength": "strength",
      "h.v.exp.first": "first program", "h.v.exp.under_6m": "under 6 months", "h.v.exp.6_to_24m": "6 to 24 months", "h.v.exp.over_24m": "over 2 years",
      "h.v.cons.most": "most planned sessions", "h.v.cons.about_half": "about half the sessions", "h.v.cons.few": "a few sessions", "h.v.cons.none": "returning from a break",
      "h.v.days": "{n} days", "h.v.min": "up to {n} min", "h.v.min90": "90 min or more",
      "h.v.rest.auto": "rest chosen by Taurifer", "h.v.rest.60": "60 s rest", "h.v.rest.90": "90 s rest", "h.v.rest.120": "2 min rest", "h.v.rest.180": "3 min rest or more",
      "h.v.env.commercial_gym": "commercial gym", "h.v.env.basic_gym": "basic gym", "h.v.env.limited_home": "home, little equipment", "h.v.env.full_home": "home gym", "h.v.env.other": "other setup",
      "h.v.env_adj": "{env}, adjusted",
      "h.v.prio_none": "no priority", "h.v.prio": "prioritizes {list}", "h.v.avoid": "avoids {list}", "h.v.include": "includes {list}",
      "h.v.emph_none": "normal emphasis", "h.v.emph": "{state}: {list}", "h.v.prefs_none": "no exercise preferences", "h.v.shape": "{name}",
      "h.what.goal": "goal", "h.what.background": "recent training", "h.what.schedule": "schedule", "h.what.environment": "training place", "h.what.priorities": "priorities", "h.what.emphasis": "muscle emphasis", "h.what.prefs": "exercise preferences", "h.what.shape": "weekly structure",
      "h.chip.aria": "Change {what}:",
      "h.ed.title": "Change the {what}",
      "h.ed.apply": "Rebuild the program",
      "h.ed.keep": "Keep it as it was",
      "h.rev.verse": "Built from your words. Tap one to change it and the program is rebuilt here.",
      "h.rev.days": "{n} days",
      "h.rev.new": "new",
      "h.rev.before_after": "Before {before}. Now {after}.",
      "h.rev.facts_short": "{ex} exercises, {sets} sets",
      "h.rev.source": "Source: {source}",
      "h.rev.why": "Why this program",
      "h.rev.col_meta": "{n} exercises · {sets} sets",
      "h.rev.rx_sr": "{sets} sets of {min} to {max} reps",
      "h.ff.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing in the fields on this screen.",
      "h.ff.edit_sr": "Edit the pasted text",
      "h.mode.label": "How to bring the program",
      "h.mode.freeform": "Paste text",
      "h.mode.file": "Taurifer file",
      "h.import.file_name": "rafaels-program.json",
      "h.import.counts": "{linked} linked · {review} to review · {custom} custom",
      "h.import.from": "In the file",
      "h.import.to": "In the program",
      "h.import.back_links": "Back to the matches",
      "h.today.toast": "Program active. Today shows your first session.",
      "h.build.name_label": "Program name",
      "h.build.days_q": "How many training days?",
      "h.build.need_name": "Give it a name and choose the days to continue.",
      "h.cat.facts": "{days} days · {minutes}",
      "h.error.title": "The program could not be built",
    },
  };

  /* ---------- question model ---------- */
  const QLIST = {
    recommend: ["goal", "experience", "consistency", "days", "minutes", "rest", "environment", "priorities"],
    custom: ["goal", "experience", "consistency", "days", "minutes", "rest", "environment", "emphasis", "prefs", "shape"],
    browse: ["days", "minutes", "environment"],
  };
  const QDEF = {
    goal: { key: "desiredResult", step: "desired_result", cp: "rec-goal" },
    experience: { key: "structuredExperience", step: "background", cp: "rec-background" },
    consistency: { key: "recentConsistency", step: "background", cp: "rec-background" },
    days: { key: "daysPerWeek", step: "schedule", cp: "rec-schedule" },
    minutes: { key: "sessionMinutes", step: "schedule", cp: "rec-schedule" },
    rest: { key: "preferredRestSeconds", step: "schedule", cp: "rec-schedule" },
    environment: { key: "environment", step: "environment", cp: "rec-environment" },
    priorities: { step: "priorities", cp: "rec-priorities", optional: true },
    emphasis: { step: "priorities", cp: "custom-priorities", optional: true },
    prefs: { step: "exercise_preferences", cp: "custom-exercises", optional: true },
    shape: { key: "splitPreference", step: "custom_shape", cp: "custom-shape" },
  };
  /* The review's editable groups: each word of the colophon opens one. */
  const GROUPS = {
    recommend: [["goal", ["goal"]], ["background", ["experience", "consistency"]], ["schedule", ["days", "minutes", "rest"]], ["environment", ["environment"]], ["priorities", ["priorities"]]],
    custom: [["goal", ["goal"]], ["background", ["experience", "consistency"]], ["schedule", ["days", "minutes", "rest"]], ["environment", ["environment"]], ["emphasis", ["emphasis"]], ["prefs", ["prefs"]], ["shape", ["shape"]]],
  };
  const CODE_KEY = { desired_result_required: "desiredResult", structured_experience_required: "structuredExperience", recent_consistency_required: "recentConsistency", days_per_week_required: "daysPerWeek", session_minutes_required: "sessionMinutes", preferred_rest_required: "preferredRestSeconds", environment_required: "environment", split_preference_required: "splitPreference", program_name_required: "programName" };

  let t, lang, root, S;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const answers = () => TF.normalizeAnswers(S.answers);
  const reduced = () => document.documentElement.dataset.motion === "reduced" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- drawn marks (one stroke family, square caps) ---------- */
  const ARROW = (dir = "right") => `<svg class="h-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${dir === "left" ? "M21 12H5M12 5l-7 7 7 7" : "M3 12h16M12 5l7 7-7 7"}" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
  const TICK = `<svg class="h-tick" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="17" height="17" fill="currentColor"/><path d="M5.5 10.2l3 3 6-6.6" fill="none" stroke="var(--h-field)" stroke-width="2.6" stroke-linecap="square"/></svg>`;
  const PLUS = `<svg class="h-ico h-ico--sm" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="square"/></svg>`;

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, stage: null, qi: 0, answers: {}, result: null, changeFrom: null, lastPreview: null, cpTag: null, flood: null, fresh: null, envOpen: false, avoid: { query: "", pending: null }, pref: { query: "", pending: null }, sheet: null, overlay: null, overlayReturn: null, notice: null, actError: null, compileError: null, toast: null, importMode: "freeform", ff: TS.freeform.create(), imp: { freeform: null, file: null }, impKept: null, picker: null, build: null, revAtStart: TF.liveRevision(), stash: S ? S.stash : null };
  }
  function fresh(seed) { S = null; TF.seedDevice(seed || "fresh"); S = blank(TF.hasActiveProgram() ? "today" : "landing"); }
  const qid = () => (S.stage === "q" ? QLIST[S.route][S.qi] : null);
  const generated = () => S.route === "recommend" || S.route === "custom";
  const mode = () => (S.route === "custom" ? "custom" : "recommend");
  const draft = () => S.imp[S.importMode];
  function entryStep() {
    if (!S || S.view !== "route") return null;
    if (S.stage === "q") return QDEF[qid()].step;
    return { result: "result", catalogue: "catalogue", preview: "preview", setup: "build_setup", editor: "editor", import: "import_source" }[S.stage] || null;
  }
  function answered(q, a) {
    const d = QDEF[q];
    if (d.optional) return true;
    if (q === "rest") return has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null || Number.isFinite(a.preferredRestSeconds));
    if (q === "environment") return !!(a.environment && a.environment.kind);
    return a[d.key] != null && a[d.key] !== "";
  }
  function stepIssues(q, a) {
    try { return TF.Entry.validationIssues(TF.entryState({ route: S.route, answers: TF.normalizeAnswers(a), step: QDEF[q].step })); } catch (e) { return ["state_invalid"]; }
  }
  /* A question blocks only on its own key, or (optional ones) on its step's
     own issues such as a pending avoidance without a reason. */
  function blocker(q, a, st) {
    if (!answered(q, a)) return t("h.adv.need");
    if ((st.avoid && st.avoid.pending) || (st.pref && st.pref.pending)) return t("entry.priorities.reason_required");
    if (QDEF[q].optional) { const iss = stepIssues(q, a).filter((c) => !CODE_KEY[c]); if (iss.length) return TS.issueText(t, iss); }
    return null;
  }
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
    if (S.lastPreview && TF.identityDiff(S.lastPreview, S.result.preview).n > 0) S.changeFrom = { preview: S.lastPreview };
    else if ((S.answers.exerciseConstraints || []).length) { const w = compileWith({ ...answers(), exerciseConstraints: [] }); if (w.ok) S.changeFrom = { preview: w.result.preview }; }
    S.lastPreview = null;
  }
  function stateFor(step) { return TF.entryState({ route: S.route, answers: answers(), result: S.result, step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    const step = entryStep() || "desired_result";
    const ui = TF.jsonClean({ build: S.build || null, importMode: S.importMode, qi: S.qi, stage: S.stage });
    const attempts = [() => stateFor(step), () => TF.entryState({ route: S.route, answers: answers(), step, activeProgramRevisionAtStart: S.revAtStart }), () => TF.entryState({ route: S.route, answers: answers(), step: TF.Entry.ROUTE_STEPS[S.route][0], activeProgramRevisionAtStart: S.revAtStart })];
    for (const f of attempts) { try { const r = TF.saveDraft(f(), { ui }); if (r.ok) return; } catch (e) { /* next */ } }
  }
  function leaveSetup() { S = blank(TF.hasActiveProgram() ? "today" : "landing"); render(true); }

  /* ---------- navigation ---------- */
  function go(route, importMode) {
    const stash = S.stash;
    S = blank("route"); S.route = route;
    if (QLIST[route]) { S.stage = "q"; S.qi = 0; }
    else if (route === "build") S.stage = "setup";
    else if (route === "import") { S.stage = "import"; S.importMode = importMode || "freeform"; }
    if (stash && stash.route === route) S.answers = clone(stash.answers);
    S.stash = null;
    render(true);
  }
  function toHub() { S.stash = S.route && QLIST[S.route] ? { route: S.route, answers: clone(S.answers) } : null; const stash = S.stash; S = blank("hub"); S.stash = stash; render(true); }
  function advance() {
    if (S.stage === "setup") {
      if (!S.answers.programName || !S.answers.daysPerWeek) return;
      if (!S.build || S.build.days.length !== S.answers.daysPerWeek) S.build = TS.build.create(S.answers.programName, S.answers.daysPerWeek); else S.build = { ...S.build, name: S.answers.programName };
      S.stage = "editor"; render(true); return;
    }
    const q = qid(); if (!q) return;
    if (blocker(q, S.answers, S)) return;
    const list = QLIST[S.route];
    if (S.qi < list.length - 1) {
      S.qi += 1; if (list[S.qi] === "shape") ensureSplit(S.answers);
      render(true); return;
    }
    if (S.route === "browse") { S.stage = "catalogue"; render(true); return; }
    S.stage = "result"; compileFirst(); render(true);
  }
  function back() {
    if (S.route === "import") {
      if (S.stage === "preview") { S.stage = "import"; S.importMode = S.impKept.sourceType === "file" ? "file" : "freeform"; S.imp[S.importMode] = S.impKept; S.result = null; S.changeFrom = null; render(true); return; }
      if (draft()) { if (S.importMode === "freeform") { S.imp.freeform = null; render(true); return; } S.imp.file = null; S.picker = null; render(true); return; }
      if (S.importMode === "freeform") {
        const ff = S.ff;
        if (ff.status === "gaps") { S.ff = TS.freeform.apply(ff, "gap-back"); render(true); return; }
        if (ff.stage === 3) { S.ff = { ...ff, stage: 2, status: null, gapErrors: new Set() }; render(true); return; }
        if (ff.stage === 2) { S.ff = { ...ff, stage: 1, gapErrors: new Set() }; render(true); return; }
      }
      toHub(); return;
    }
    if (S.route === "build") { if (S.stage === "editor") { S.stage = "setup"; render(true); return; } toHub(); return; }
    if (S.route === "browse" && S.stage === "preview") { S.stage = "catalogue"; S.result = null; render(true); return; }
    if (S.stage === "result" || S.stage === "catalogue") {
      if (S.stage === "result") { S.lastPreview = S.result ? S.result.preview : null; S.result = null; S.changeFrom = null; }
      S.stage = "q"; S.qi = QLIST[S.route].length - 1; render(true); return;
    }
    if (S.stage === "q") { if (S.qi === 0) { toHub(); return; } S.qi -= 1; S.avoid.pending = null; S.pref.pending = null; render(true); return; }
    toHub();
  }
  function activateNow() {
    S.actError = null;
    const step = S.route === "build" ? "editor" : generated() ? "result" : "preview";
    if (S.route === "build") S.result = TS.build.result(S.build);
    let r;
    try { r = TF.activate(stateFor(step)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { S = blank("today"); S.toast = t("h.today.toast"); render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render("#hConflict"); return; }
    S.actError = TS.issueText(t, r, { preview: S.result && S.result.preview }); render("#hActError");
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; S.overlayReturn = "[data-activate]"; render("#hDlgTitle"); } else activateNow(); }

  /* ---------- the verse ---------- */
  const listOf = (arr, f) => arr.map(f).join(", ");
  const muscle = (m) => t(`entry.muscle.${m}`, undefined, m).toLowerCase();
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };
  function envAdjusted(e) { if (!e || !e.kind) return false; const d = TF.env(e.kind); const s = (x) => JSON.stringify([...(x || [])].sort()); return s(d.equipment) !== s(e.equipment) || s(d.capabilities) !== s(e.capabilities); }
  function vWord(q, a) {
    switch (q) {
      case "goal": return a.desiredResult ? t(`h.v.goal.${a.desiredResult}`) : null;
      case "experience": return a.structuredExperience ? t(`h.v.exp.${a.structuredExperience}`) : null;
      case "consistency": return a.recentConsistency ? t(`h.v.cons.${a.recentConsistency}`) : null;
      case "days": return a.daysPerWeek ? t("h.v.days", { n: a.daysPerWeek }) : null;
      case "minutes": return a.sessionMinutes ? (a.sessionMinutes >= 90 ? t("h.v.min90") : t("h.v.min", { n: a.sessionMinutes })) : null;
      case "rest": return has(a, "preferredRestSeconds") ? t(a.preferredRestSeconds === null ? "h.v.rest.auto" : `h.v.rest.${a.preferredRestSeconds}`) : null;
      case "environment": { if (!a.environment || !a.environment.kind) return null; const e = t(`h.v.env.${a.environment.kind}`); return envAdjusted(a.environment) ? t("h.v.env_adj", { env: e }) : e; }
      case "priorities": {
        const out = [];
        if ((a.primaryMuscles || []).length) out.push(t("h.v.prio", { list: listOf(a.primaryMuscles, muscle) }));
        if ((a.priorityMovements || []).length) out.push(t("h.v.prio", { list: listOf(a.priorityMovements, (m) => t(`entry.movement.${m}`).toLowerCase()) }));
        if ((a.exerciseConstraints || []).length) out.push(t("h.v.avoid", { list: listOf(a.exerciseConstraints, (c) => `${exLabel(c.exerciseId)} (${t(`entry.priorities.reason.${c.reason}`).toLowerCase()})`) }));
        return out.length ? out.join(" · ") : t("h.v.prio_none");
      }
      case "emphasis": {
        const out = [];
        for (const [k, st] of [["primaryMuscles", "prioritize"], ["deEmphasizedMuscles", "deemphasize"], ["ignoredMuscles", "ignore"]]) if ((a[k] || []).length) out.push(t("h.v.emph", { state: t(`entry.priorities.state.${st}`), list: listOf(a[k], muscle) }));
        return out.length ? out.join(" · ") : t("h.v.emph_none");
      }
      case "prefs": {
        const out = [];
        if ((a.mustHaveExercises || []).length) out.push(t("h.v.include", { list: listOf(a.mustHaveExercises, exLabel) }));
        if ((a.exerciseConstraints || []).length) out.push(t("h.v.avoid", { list: listOf(a.exerciseConstraints, (c) => `${exLabel(c.exerciseId)} (${t(`entry.priorities.reason.${c.reason}`).toLowerCase()})`) }));
        return out.length ? out.join(" · ") : t("h.v.prefs_none");
      }
      case "shape": { const c = (TF.splitChoices(TF.normalizeAnswers(a)).choices || []).find((x) => x.id === a.splitPreference); return c ? (lang === "pt" ? c.namePt || c.name : c.name) : null; }
      default: return null;
    }
  }
  function runningVerse() {
    const list = QLIST[S.route] || []; const words = [];
    list.forEach((q, i) => { if (i > S.qi) return; if (QDEF[q].optional && i === S.qi) return; if (QDEF[q].optional && !["priorities", "emphasis", "prefs"].includes(q)) return; const w = vWord(q, S.answers); if (w && !(QDEF[q].optional && /^(sem |no |ênfase normal|normal emphasis)/.test(w))) words.push({ q, w }); });
    const idx = `${S.qi + 1}/${list.length}`;
    const last = words[words.length - 1];
    const compact = `<p class="h-verse h-verse--compact">${words.length ? `<span class="visually-hidden">${esc(t("h.verse.sr"))} ${esc(words.map((x) => x.w).join(", "))}</span>` : ""}<span aria-hidden="true"><span class="h-verse__idx">${esc(idx)}</span>${last ? ` <span class="h-verse__sep">/</span> <span class="h-verse__w${S.fresh === last.q ? " is-new" : ""}">${esc(last.w)}</span>${words.length > 1 ? ` <span class="h-verse__more">${esc(t("h.verse.more", { n: words.length - 1 }))}</span>` : ""}` : ""}</span></p>`;
    if (!words.length) return compact;
    return compact + `<p class="h-verse h-verse--full" aria-live="polite"><span class="visually-hidden">${esc(t("h.verse.sr"))} </span>${words.map((x, i) => `${i ? '<span class="h-verse__sep" aria-hidden="true">/</span> ' : ""}<span class="h-verse__w${S.fresh === x.q ? " is-new" : ""}">${esc(x.w)}</span>`).join(" ")}</p>`;
  }

  /* ---------- atoms ---------- */
  const mono = (word, { max = 132, vh = 0.17, cls = "" } = {}) => `<span class="h-mono ${cls}" data-fit data-fit-max="${max}" data-fit-vh="${vh}" aria-hidden="true">${esc(word)}</span>`;
  function opt({ key, val, title, sub, sel, role = "radio", ctx }) {
    const fl = ctx && !ctx.sheet && S.flood === `${key}|${val}`;
    return `<button type="button" class="h-opt${sel ? " is-on" : ""}${fl ? " is-flood" : ""}" role="${role}" aria-checked="${sel ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"><span class="h-opt__t">${esc(title)}</span>${sub ? `<span class="h-opt__s">${esc(sub)}</span>` : ""}${TICK}</button>`;
  }
  /* Phrase answers as words placed in the six-column composition. spots:
     [column start, span] per answer; each screen has its own placement. */
  function placed({ key, items, spots, ctx, labelId, name }) {
    const g = `${name}${ctx.sheet ? "S" : ""}`;
    return `<div class="h-place h-place--${name}" role="radiogroup" aria-labelledby="${labelId}">${items.map((it, i) => {
      const [c, span] = spots[i]; const fl = !ctx.sheet && S.flood === `${key}|${it.val}`;
      return `<button type="button" class="h-word${it.sel ? " is-on" : ""}${fl ? " is-flood" : ""}" style="--c:${c};--s:${span}" role="radio" aria-checked="${it.sel ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(it.val)}"><span class="h-word__t" data-fit data-fit-group="${g}${it.solo ? "0" : ""}" data-fit-rem="${it.solo ? 2.25 : 1.625}">${esc(it.title)}</span>${it.sub ? `<span class="h-word__s">${esc(it.sub)}</span>` : ""}${TICK}</button>`;
    }).join("")}</div>`;
  }
  function chip({ key, val, label, sel, role = "checkbox", disabled, ctx }) {
    const fl = ctx && !ctx.sheet && S.flood === `${key}|${val}`;
    return `<button type="button" class="h-chip${sel ? " is-on" : ""}${fl ? " is-flood" : ""}" role="${role}" aria-checked="${sel ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"${disabled ? " disabled" : ""}>${esc(label)}</button>`;
  }
  function stair(key, items, sel, ctx, labelId) {
    return `<div class="h-stair" role="radiogroup" aria-labelledby="${labelId}" style="--n:${items.length}">${items.map((it, i) => {
      const on = sel(it.val); const fl = ctx && !ctx.sheet && S.flood === `${key}|${it.val}`;
      return `<button type="button" class="h-step${on ? " is-on" : ""}${fl ? " is-flood" : ""}" style="--i:${i}" role="radio" aria-checked="${on ? "true" : "false"}" data-act="pick" data-key="${key}" data-val="${esc(it.val)}">${it.pre ? `<span class="visually-hidden">${esc(it.pre)} </span>` : ""}<span class="h-step__n">${esc(it.num)}</span> <span class="h-step__u">${esc(it.unit)}</span>${TICK}</button>`;
    }).join("")}</div>`;
  }
  const btn = ({ act, label, cls = "h-btn--field", attrs = "", arrow = true, id }) => `<button type="button" class="h-btn ${cls}"${id ? ` id="${id}"` : ""} data-act="${act}"${attrs ? " " + attrs : ""}><span class="h-btn__l">${esc(label)}</span>${arrow ? ARROW() : ""}</button>`;
  function bar({ backAct = "back", center = "", centerSr = "", cancel = true } = {}) {
    return `<header class="h-bar"><button type="button" class="h-bar__btn h-bar__back" data-act="${backAct}"><span class="h-bar__arrow">${ARROW("left")}</span><span class="visually-hidden">${esc(t("entry.back"))}</span></button><p class="h-bar__mid">${center ? `<span class="visually-hidden">${esc(centerSr || center)}</span><span class="h-bar__vis" aria-hidden="true">${esc(center)}</span>` : ""}</p>${cancel ? `<button type="button" class="h-bar__btn h-bar__cancel" data-act="cancel" aria-haspopup="dialog">${esc(t("entry.cancel"))}</button>` : '<span class="h-bar__spacer"></span>'}</header>`;
  }
  function dock(inner, attrs = "") { return `<div class="h-dock" data-persistent-action ${attrs}><div class="h-dock__in">${inner}</div></div>`; }

  /* ---------- question bodies (screens and review editors share them) ---------- */
  function qBody(q, a, ctx) {
    const p = ctx.sheet ? "hS" : "hQ"; const lab = `${p}L-${q}`;
    switch (q) {
      case "goal": return placed({ key: "desiredResult", name: "goal", ctx, labelId: lab, spots: [[1, 5], [2, 5], [3, 4]], items: TS.DESIRED.map((v) => ({ val: v, title: t(`entry.desired_result.${v}.label`), sub: t(`entry.desired_result.${v}.sub`), sel: a.desiredResult === v })) });
      case "experience": return placed({ key: "structuredExperience", name: "exp", ctx, labelId: lab, spots: [[1, 3], [2, 3], [3, 3], [4, 3]], items: TS.EXPERIENCE.map((v) => ({ val: v, title: t(`entry.background.experience.${v}`), sel: a.structuredExperience === v })) });
      case "consistency": return placed({ key: "recentConsistency", name: "cons", ctx, labelId: lab, spots: [[1, 3], [4, 3], [1, 3], [4, 3]], items: TS.CONSISTENCY.map((v) => ({ val: v, title: t(`entry.background.consistency.${v}`), sel: a.recentConsistency === v })) });
      case "days": return stair("daysPerWeek", TS.DAYS.map((n) => ({ val: n, num: String(n), unit: t("h.unit.days") })), (v) => a.daysPerWeek === v, ctx, lab);
      case "minutes": return stair("sessionMinutes", TS.MINUTES.map((n) => ({ val: n, num: n === 90 ? "90+" : String(n), unit: t("h.unit.min") })), (v) => a.sessionMinutes === v, ctx, lab);
      case "rest": {
        const sel = (v) => has(a, "preferredRestSeconds") && (a.preferredRestSeconds === null ? v === "auto" : v !== "auto" && +v === a.preferredRestSeconds);
        const items = [[60, "60", "h.unit.sec"], [90, "90", "h.unit.sec"], [120, "2", "h.unit.minrest"], [180, "3+", "h.unit.minrest"]].map(([v, num, u]) => ({ val: v, num, unit: t(u), pre: t("h.rest.about") }));
        return `<div class="h-words h-words--lead" role="radiogroup" aria-labelledby="${lab}">${opt({ key: "preferredRestSeconds", val: "auto", title: t("entry.schedule.rest.auto"), sel: sel("auto"), ctx })}</div>${stair("preferredRestSeconds", items, (v) => sel(v), ctx, lab)}`;
      }
      case "environment": {
        const e = a.environment;
        const kinds = placed({ key: "environment", name: "env", ctx, labelId: lab, spots: [[1, 6], [1, 3], [4, 3], [1, 3], [4, 3]], items: TS.ENVS.map((v, i) => ({ val: v, title: t(`entry.environment.${v}`), sel: !!(e && e.kind === v), solo: i === 0 })) });
        if (!e) return kinds;
        const eq = new Set(e.equipment || []), caps = new Set(e.capabilities || []);
        const groups = `<p class="h-label" id="${p}Eq">${esc(t("entry.env_correct.equipment"))}</p><div class="h-chips" role="group" aria-labelledby="${p}Eq">${TS.EQUIP.map((k) => chip({ key: "environmentEquipment", val: k, label: t(`entry.equip.${k}`, undefined, k), sel: eq.has(k), ctx })).join("")}</div>
          <p class="h-label" id="${p}Cap">${esc(t("entry.env_correct.capabilities"))}</p><div class="h-chips" role="group" aria-labelledby="${p}Cap">${TS.CAPS.map((k) => chip({ key: "environmentCapabilities", val: k, label: t(`entry.cap.${k}`, undefined, k), sel: caps.has(k), ctx })).join("")}</div>
          <p class="h-note">${esc(t("entry.env_correct.note"))}</p>`;
        if (ctx.sheet) return kinds + `<div class="h-corr h-corr--open" data-checkpoint="rec-env-correction">${groups}</div>`;
        return kinds + `<details class="h-corr" data-role="env-correction"${S.envOpen ? ' open data-checkpoint="rec-env-correction"' : ""}><summary><span>${esc(t("entry.env_correct.summary"))}</span>${PLUS}</summary><div class="h-corr__body">${groups}</div></details>`;
      }
      case "priorities": {
        const prim = a.primaryMuscles || []; const st = ctx.sheet ? S.sheet.avoid : S.avoid;
        return `<div class="h-words h-words--lead">${opt({ key: "clearPriorities", val: "1", title: t("entry.priorities.none"), sel: prim.length === 0 && !(a.priorityMovements || []).length && !(a.exerciseConstraints || []).length, role: "checkbox", ctx })}</div>
          <p class="h-label" id="${p}Prim">${esc(t("entry.priorities.primary"))}</p><p class="h-note">${esc(t(prim.length >= 2 ? "h.q.none_limit" : "entry.priorities.lede"))}</p>
          <div class="h-chips" role="group" aria-labelledby="${p}Prim">${TS.MUSCLES.map((m) => chip({ key: "primaryMuscles", val: m, label: t(`entry.muscle.${m}`), sel: prim.includes(m), disabled: prim.length >= 2 && !prim.includes(m), ctx })).join("")}</div>
          <p class="h-label" id="${p}Mov">${esc(t("entry.priorities.movements"))}</p>
          <div class="h-chips" role="group" aria-labelledby="${p}Mov">${TS.MOVEMENTS.map((m) => chip({ key: "priorityMovements", val: m, label: t(`entry.movement.${m}`), sel: (a.priorityMovements || []).includes(m), ctx })).join("")}</div>
          <p class="h-label" id="${p}Av">${esc(t("entry.priorities.avoid"))}</p>${avoidBlock(a, st, ctx)}`;
      }
      case "emphasis": {
        const status = (m) => (a.primaryMuscles || []).includes(m) ? "prioritize" : (a.deEmphasizedMuscles || []).includes(m) ? "deemphasize" : (a.ignoredMuscles || []).includes(m) ? "ignore" : "normal";
        return `<div class="h-emph">${TS.MUSCLES.map((m) => { const cur = status(m); const full = (a.primaryMuscles || []).length >= 2 && cur !== "prioritize"; return `<div class="h-emph__row"><p class="h-emph__m" id="${p}M-${m}">${esc(t(`entry.muscle.${m}`))}</p><div class="h-chips h-chips--4" role="radiogroup" aria-labelledby="${p}M-${m}">${["normal", "prioritize", "deemphasize", "ignore"].map((stt) => chip({ key: "musclePriority", val: `${m}|${stt}`, label: t(`entry.priorities.state.${stt}`), sel: cur === stt, role: "radio", disabled: stt === "prioritize" && full, ctx })).join("")}</div></div>`; }).join("")}</div>`;
      }
      case "prefs": {
        const st = ctx.sheet ? S.sheet.pref : S.pref;
        const taken = new Set([...(a.mustHaveExercises || []), ...(a.exerciseConstraints || []).map((c) => c.exerciseId)]); if (st.pending) taken.add(st.pending);
        const matches = TF.searchLibrary(st.query, lang, { exclude: taken, limit: 6, all: true });
        const sid = ctx.sheet ? "hSPrefSearch" : "hPrefSearch";
        return `<label class="h-field"><span class="h-field__l">${esc(t("entry.exercise_preferences.search"))}</span><input id="${sid}" type="search" autocomplete="off" data-field="prefQuery" value="${esc(st.query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></label>
          <ul class="h-results" aria-label="${esc(t("entry.exercise_preferences.results"))}">${matches.map((e) => { const n = TF.libraryName(e, lang); return `<li class="h-result"><span class="h-result__n">${esc(n)}</span><span class="h-result__acts"><button type="button" class="h-mini" data-act="pref-add" data-id="${esc(e.id)}" data-status="include" aria-label="${esc(t("entry.exercise_preferences.include"))} ${esc(n)}">${esc(t("entry.exercise_preferences.include"))}</button><button type="button" class="h-mini" data-act="pref-add" data-id="${esc(e.id)}" data-status="avoid" aria-label="${esc(t("entry.exercise_preferences.avoid"))} ${esc(n)}">${esc(t("entry.exercise_preferences.avoid"))}</button></span></li>`; }).join("")}</ul>
          <p class="h-label">${esc(t("entry.exercise_preferences.include_list"))}</p>${(a.mustHaveExercises || []).length ? `<ul class="h-results">${a.mustHaveExercises.map((id) => `<li class="h-result"><span class="h-result__n">${esc(exLabel(id))}</span><button type="button" class="h-mini" data-act="pref-remove" data-id="${esc(id)}">${esc(t("entry.exercise_preferences.remove"))}</button></li>`).join("")}</ul>` : `<p class="h-note">${esc(t("entry.exercise_preferences.include_none"))}</p>`}
          <p class="h-label">${esc(t("entry.exercise_preferences.avoid_list"))}</p>${st.pending ? reasonBlock(st.pending, null, true) : ""}${(a.exerciseConstraints || []).map((c) => reasonBlock(c.exerciseId, c.reason, false)).join("")}${!st.pending && !(a.exerciseConstraints || []).length ? `<p class="h-note">${esc(t("entry.exercise_preferences.avoid_none"))}</p>` : ""}
          ${(a.exerciseConstraints || []).some((c) => c.reason === "pain") ? `<p class="h-pain" role="note">${esc(t("entry.priorities.pain_note"))}</p>` : ""}`;
      }
      case "shape": {
        const c = TF.splitChoices(TF.normalizeAnswers(a)).choices || [];
        if (!c.length) return `<div class="h-alert" role="alert"><p class="h-alert__t">${esc(t("entry.custom_shape.none_title"))}</p><p>${esc(t("entry.custom_shape.none_body"))}</p></div>`;
        return `<div class="h-words" role="radiogroup" aria-labelledby="${lab}">${c.map((x) => { const est = (x.days || []).map((d) => d.estimateMinutes).filter(Number.isFinite); return opt({ key: "splitPreference", val: x.id, title: t("entry.custom_shape.choice", { name: lang === "pt" ? x.namePt || x.name : x.name, days: x.frequency }), sub: `${c.length === 1 ? "" : t(x.default ? "entry.custom_shape.default_reason" : "entry.custom_shape.compatible_reason")} ${est.length ? t("entry.custom_shape.summary", { days: x.frequency, min: Math.min(...est), max: Math.max(...est) }) : ""}`.trim(), sel: a.splitPreference === x.id, ctx }); }).join("")}</div>`;
      }
      default: return "";
    }
  }
  function avoidBlock(a, st, ctx) {
    const taken = new Set((a.exerciseConstraints || []).map((c) => c.exerciseId)); if (st.pending) taken.add(st.pending);
    const matches = TF.searchLibrary(st.query, lang, { exclude: taken, limit: 6 });
    const sid = ctx.sheet ? "hSAvoid" : "hAvoid";
    return `<label class="h-field"><span class="h-field__l">${esc(t("entry.priorities.avoid_search"))}</span><input id="${sid}" type="search" autocomplete="off" data-field="avoidQuery" value="${esc(st.query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></label>
      ${matches.length ? `<div class="h-results" role="listbox" aria-label="${esc(t("entry.priorities.avoid_search"))}">${matches.map((e) => `<button type="button" class="h-result h-result--btn" role="option" aria-selected="false" data-act="avoid-add" data-id="${esc(e.id)}"><span class="h-result__n">${esc(TF.libraryName(e, lang))}</span>${PLUS}</button>`).join("")}</div>` : ""}
      ${st.pending ? reasonBlock(st.pending, null, true) : ""}${(a.exerciseConstraints || []).map((c) => reasonBlock(c.exerciseId, c.reason, false)).join("")}
      ${(a.exerciseConstraints || []).some((c) => c.reason === "pain") ? `<p class="h-pain" role="note">${esc(t("entry.priorities.pain_note"))}</p>` : ""}`;
  }
  function reasonBlock(id, reason, pending) {
    const name = exLabel(id);
    return `<div class="h-reason" role="group" aria-label="${esc(t("entry.priorities.avoid_reason", { exercise: name }))}"><div class="h-reason__head"><p class="h-reason__n">${esc(name)}</p><button type="button" class="h-mini h-mini--quiet" data-act="avoid-remove" data-id="${esc(id)}">${esc(t("entry.priorities.avoid_remove"))}</button></div>
      <p class="h-label">${esc(t("entry.priorities.avoid_reason", { exercise: name }))}</p><div class="h-chips" role="radiogroup">${TS.REASONS.map((r) => chip({ key: "avoidReason", val: `${id}|${r}`, label: t(`entry.priorities.reason.${r}`), sel: reason === r, role: "radio" })).join("")}</div>
      ${pending ? `<p class="h-note" id="hPendingNote">${esc(t("entry.priorities.reason_required"))}</p>` : ""}</div>`;
  }
  function qHead(q, { sheet = false } = {}) {
    const sentence = q === "priorities" && S.route === "custom" ? t("entry.priorities.custom_title") : q === "shape" ? t((TF.splitChoices(answers()).choices || []).length === 1 ? "entry.custom_shape.title_sole" : "entry.custom_shape.title") : t(`h.q.${q}`);
    const id = `${sheet ? "hS" : "hQ"}L-${q}`;
    const lede = { goal: t("entry.desired_result.lede"), experience: t("entry.background.lede"), minutes: t("h.q.minutes_lede"), environment: t("entry.environment.lede"), priorities: t("h.q.priorities_lede"), emphasis: t("entry.priorities.custom_lede"), prefs: t("entry.exercise_preferences.lede"), shape: t((TF.splitChoices(answers()).choices || []).length === 1 ? "entry.custom_shape.lede_sole" : "entry.custom_shape.lede") }[q];
    if (sheet) return `<h3 class="h-head h-head--sheet">${mono(t(`h.mono.${q}`), { max: 72, vh: 0.1 })}<span class="h-head__q" id="${id}">${esc(sentence)}</span></h3>${lede && q !== "experience" ? `<p class="h-lede">${esc(lede)}</p>` : ""}`;
    return `<h1 class="h-head" tabindex="-1">${mono(t(`h.mono.${q}`))}<span class="h-head__q" id="${id}">${esc(sentence)}</span></h1>${lede ? `<p class="h-lede">${esc(lede)}</p>` : ""}`;
  }

  /* ---------- screens ---------- */
  const privacyBtn = () => `<button type="button" class="h-link h-brand__privacy" data-act="privacy-open" data-privacy-open aria-haspopup="dialog">${esc(t("privacy.title"))}</button>`;
  const brand = () => `<header class="h-brand"><img class="h-brand__mark" src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="30" height="30"><span class="h-brand__word"><span class="h-brand__vis" aria-hidden="true">Taurifer</span><span class="visually-hidden">Taurifer</span></span>${privacyBtn()}</header>`;
  function landingView() {
    const head = t("landing.headline"); const key = t("h.land.key"); const at = head.toLowerCase().indexOf(key.toLowerCase());
    let poem;
    if (at > 0) {
      const before = head.slice(0, at).trim(), word = head.slice(at, at + key.length), after = head.slice(at + key.length).trim();
      const parts = before.split(/\s+/); const last = parts.pop();
      poem = `<span class="h-poem__line" data-fit data-fit-line data-fit-group="land" data-fit-max="46">${esc(parts.join(" "))}</span> <span class="h-poem__line h-poem__line--in" data-fit data-fit-line data-fit-group="land" data-fit-max="46">${esc(last)}</span> <span class="h-band"><span class="h-poem__key" data-fit data-fit-line data-fit-max="118">${esc(word)}</span></span> <span class="h-poem__line h-poem__line--end" data-fit data-fit-line data-fit-group="land" data-fit-max="46">${esc(after)}</span>`;
    } else poem = `<span class="h-poem__line">${esc(head)}</span>`;
    return `<main class="h-page h-land" data-checkpoint="landing">${brand()}
      <h1 class="h-poem" tabindex="-1">${poem}</h1>
      <p class="h-land__body">${esc(t("landing.body"))}</p>
      <div class="h-land__acts"><button type="button" id="firstRunCreate" class="h-btn h-btn--field" data-act="land-create"><span class="h-btn__l">${esc(t("landing.build"))}</span>${ARROW()}</button><button type="button" id="firstRunImport" class="h-btn h-btn--line" data-act="land-import"><span class="h-btn__l">${esc(t("landing.track"))}</span>${ARROW()}</button></div>
      <div class="h-land__proof"><p class="h-land__cap">${esc(t("h.land.proof"))}</p><figure class="h-land__shot"><img src="${esc(TF.asset(`round-4/assets/h/today-ready-${lang === "pt" ? "pt" : "en"}-${document.documentElement.dataset.theme === "dark" ? "dark" : "light"}.png`))}" width="780" height="1688" decoding="async" data-proof-own alt="${esc(t("h.land.proof_alt"))}"></figure></div>
      <p class="h-land__privacy">${esc(t("x.privacy.line"))}</p></main>`;
  }
  function door(route, { lead = false, importMode } = {}) {
    const key = route === "import" ? importMode : route;
    const title = route === "import" ? t(importMode === "freeform" ? "entry.hub.freeform.title" : "entry.hub.import.title") : t(`entry.hub.${route}.title`);
    const n = QLIST[route] ? QLIST[route].filter((q) => !QDEF[q].optional && q !== "shape").length : 0;
    const cost = t(`h.cost.${key}`, { n });
    return `<button type="button" class="h-door${lead ? " h-door--lead" : ""}" data-act="route" data-route="${route}"${importMode ? ` data-mode="${importMode}"` : ""}><span class="h-door__w" data-fit data-fit-group="doors" data-fit-max="64">${esc(t(`h.door.${key}`))}</span><span class="visually-hidden">: ${esc(title)}.</span><span class="h-door__c">${esc(cost)}</span><span class="h-door__a">${ARROW()}</span></button>`;
  }
  function resumeCard() {
    const info = TF.loadDraft(); if (!info || info.status !== "resumable") return "";
    const f = TS.resumeFacts(t, lang, info);
    return `<section class="h-resume" data-checkpoint="resume" aria-labelledby="hResumeT"><h2 class="h-resume__t" id="hResumeT">${esc(t("entry.resume.title"))}</h2><p class="h-note">${esc(t("h.resume.at", { route: f.route, step: f.step, when: f.when }))}</p><div class="h-stack">${btn({ act: "resume", label: t("entry.resume.continue"), cls: "h-btn--ink", id: "hResume" })}<button type="button" class="h-link" data-act="resume-drop">${esc(t("entry.resume.restart"))}</button></div></section>`;
  }
  function hubView() {
    const existing = TF.hasActiveProgram();
    return `<main class="h-page h-hub" data-checkpoint="${existing ? "hub-existing" : "route-choice"}">${bar({ backAct: "hub-back", cancel: false, center: "" })}
      <h1 class="h-hub__t" tabindex="-1"><span class="h-hub__w" data-fit data-fit-max="60" data-fit-vh="0.12">${esc(t("entry.hub.title"))}</span></h1>
      <p class="h-lede">${esc(existing ? t("h.hub.lede_existing", { name: TF.activeName(lang) }) : t("entry.hub.lede"))}</p>
      ${resumeCard()}
      <section class="h-stanza h-stanza--first" aria-label="${esc(t("entry.hub.group.written"))}">${door("recommend", { lead: true })}${door("custom")}</section>
      <section class="h-stanza" aria-label="${esc(t("entry.hub.group.browse"))}">${door("browse")}</section>
      <section class="h-stanza" aria-label="${esc(t("entry.hub.group.own"))}">${door("import", { importMode: "freeform" })}${door("import", { importMode: "file" })}${door("build")}</section>
    </main>`;
  }
  function questionView() {
    const q = qid(); const d = QDEF[q]; const list = QLIST[S.route];
    const cp = S.route === "recommend" ? d.cp : S.route === "browse" ? "browse-filters" : (["emphasis", "prefs", "shape"].includes(q) ? d.cp : "");
    const why = blocker(q, S.answers, S);
    const label = q === "priorities" || q === "emphasis" || q === "prefs" ? (S.route === "custom" ? t("entry.next") : t("h.adv.show")) : q === "shape" ? t("entry.custom_shape.generate") : S.route === "browse" && S.qi === list.length - 1 ? t("h.adv.catalogue") : t("entry.next");
    return `<main class="h-page h-qs"${cp ? ` data-checkpoint="${cp}"` : ""} data-entry-step="${d.step}" data-q="${q}">${bar({ center: t("h.index", { n: S.qi + 1, total: list.length }), centerSr: t("h.index.sr", { n: S.qi + 1, total: list.length }) })}
      ${runningVerse()}
      <div class="h-comp h-comp--${q}">${qHead(q)}${qBody(q, S.answers, { sheet: false })}</div></main>
      ${dock(`${why ? `<p class="h-dock__why" id="hAdvWhy">${esc(why)}</p>` : ""}<button type="button" class="h-btn h-btn--field" data-act="next" data-advance${why ? ' disabled aria-describedby="hAdvWhy"' : ""}><span class="h-btn__l">${esc(label)}</span>${ARROW()}</button>`)}`;
  }
  function identityCounts(p) { const m = new Map(); for (const e of (p && p.program) || []) { const k = TF.exerciseIdentity(e); m.set(k, (m.get(k) || 0) + 1); } return m; }
  function posterCols(preview) {
    const diff = S.changeFrom ? TF.identityDiff(S.changeFrom.preview, preview) : null;
    const before = diff && diff.n < diff.total ? identityCounts(S.changeFrom.preview) : null;
    const days = preview.days || [];
    return `<div class="h-cols" data-n="${days.length}" style="--cols:${Math.min(3, days.length)}">${days.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((s, e) => s + (+e.sets || 0), 0);
      return `<section class="h-col" aria-labelledby="hDay${i}"><p class="h-col__n" aria-hidden="true">${i + 1}</p><h2 class="h-col__name" id="hDay${i}">${esc(TF.dayName(t, d, preview.programStructure, i))}</h2><p class="h-col__meta">${esc(t("h.rev.col_meta", { n: ex.length, sets }))}${d.estimateMinutes ? ` · ${esc(t("entry.preview.minutes", { n: d.estimateMinutes }))}` : ""}</p>
        <ol class="h-col__list">${ex.map((e) => { let isNew = false; if (before) { const k = TF.exerciseIdentity(e); const c = before.get(k) || 0; if (c > 0) before.set(k, c - 1); else isNew = true; } return `<li class="h-ex${isNew ? " is-new" : ""}"><span class="h-ex__n">${esc(TS.exName(e, lang))}</span>${e.sets != null ? `<span class="h-ex__rx" aria-hidden="true">${e.sets} × ${e.min}–${e.max}</span><span class="visually-hidden">, ${esc(t("h.rev.rx_sr", { sets: e.sets, min: e.min, max: e.max }))}</span>` : ""}${isNew ? `<span class="h-ex__new">${esc(t("h.rev.new"))}</span>` : ""}</li>`; }).join("")}</ol></section>`;
    }).join("")}</div>`;
  }
  function factsLine(preview) {
    const f = TF.previewFacts(preview); const dur = TF.durationLabel(t, preview); const n = (preview.days || []).length;
    return `<p class="h-poster__facts"><span>${esc(t("h.rev.days", { n }))}</span><span>${esc(t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }))}</span><span>${esc(t("entry.preview.sets", { n: f.sets }))}</span>${dur ? `<span>${esc(dur)}</span>` : ""}</p>`;
  }
  function changeBlock() {
    if (!S.changeFrom || !S.result) return "";
    const d = TF.identityDiff(S.changeFrom.preview, S.result.preview);
    const fb = TF.previewFacts(S.changeFrom.preview), fa = TF.previewFacts(S.result.preview);
    return `<div class="h-change"><p class="h-change__s" id="hChange" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}">${esc(TS.changeText(t, d))}</p><p class="h-change__ba">${esc(t("h.rev.before_after", { before: t("h.rev.facts_short", { ex: fb.exercises, sets: fb.sets }), after: t("h.rev.facts_short", { ex: fa.exercises, sets: fa.sets }) }))}</p></div>`;
  }
  function colophon() {
    if (!generated()) return "";
    return `<section class="h-colo" aria-labelledby="hColoT"><p class="h-colo__t" id="hColoT">${esc(t("h.rev.verse"))}</p><p class="h-colo__verse">${GROUPS[S.route].map(([g, qs], i) => { const words = qs.map((q) => vWord(q, S.answers)).filter(Boolean); return `${i ? '<span class="h-verse__sep" aria-hidden="true">/</span> ' : ""}<button type="button" class="h-vw" data-act="chip" data-chip="${g}" aria-haspopup="dialog"><span class="visually-hidden">${esc(t("h.chip.aria", { what: t(`h.what.${g}`) }))} </span>${esc(words.join(" · "))}</button>`; }).join(" ")}</p></section>`;
  }
  function whyBlock() {
    if (!generated() || !S.result) return "";
    const rows = TS.reasons(t, lang, S.result, answers(), { custom: S.route === "custom" });
    const adj = TS.adjustments(t, S.result.preview);
    return `<section class="h-why" aria-labelledby="hWhyT"><h2 class="h-why__t" id="hWhyT">${esc(t("h.rev.why"))}</h2><ol class="h-why__list">${rows.map((r) => `<li>${esc(r.text)}</li>`).join("")}${adj.map((a) => `<li>${esc(a.text)}</li>`).join("")}</ol><p class="h-note">${esc(t("entry.result.lede"))}</p></section>`;
  }
  function posterView() {
    const preview = S.result.preview; const name = TF.resultName(S.result, lang) || t("untitled_program");
    const isImport = S.route === "import"; const step = generated() ? "result" : "preview";
    const cp = S.cpTag || (generated() ? (S.route === "custom" ? "custom-result" : "rec-result") : isImport ? "import-preview" : S.route === "browse" ? "browse-preview" : "");
    const kind = generated() ? t(S.route === "custom" ? "entry.result.custom_title" : "entry.result.title") : t("entry.preview.title");
    const source = isImport ? t("h.rev.source", { source: S.result.preview.source === "freeform" ? t("entry.freeform.source_name") : t("entry.preview.source.import") }) : S.route === "browse" ? t("h.rev.source", { source: t("entry.preview.source.browse") }) : "";
    const progNote = !generated() ? `<p class="h-note">${esc(t(TF.progressionCopyKey(preview)))}</p>` : "";
    const replace = TF.hasActiveProgram();
    const conflict = S.notice === "conflict" ? `<div class="h-alert" role="alert" data-checkpoint="activation-conflict" id="hConflict" tabindex="-1"><p class="h-alert__t">${esc(t("entry.conflict.title"))}</p><p>${esc(t("entry.conflict.body"))}</p><button type="button" class="h-btn h-btn--ink" data-act="conflict-review"><span class="h-btn__l">${esc(t("entry.conflict.review"))}</span>${ARROW()}</button></div>` : "";
    const err = S.actError ? `<p class="h-alert" role="alert" id="hActError" tabindex="-1">${esc(S.actError)}</p>` : "";
    return `<main class="h-page h-poster"${cp ? ` data-checkpoint="${cp}"` : ""} data-entry-step="${step}">${bar({ center: kind })}
      ${conflict}
      <header class="h-poster__head"><h1 class="h-poster__name" tabindex="-1"><span class="h-poster__nm" data-fit data-fit-lines="2" data-fit-max="92" data-fit-vh="0.12" data-fit-vh-large="0.085">${esc(name)}</span></h1>${factsLine(preview)}${source ? `<p class="h-note">${esc(source)}</p>` : ""}</header>
      ${changeBlock()}
      ${posterCols(preview)}
      ${colophon()}${progNote}${whyBlock()}
      ${replace ? `<p class="h-note h-note--rule" role="status">${esc(t("entry.active_notice"))}</p>` : ""}
      <div class="h-poster__end">${generated() || isImport ? `<button type="button" class="h-link" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button>` : ""}</div></main>
      ${dock(`${err}<button type="button" class="h-btn h-btn--field" data-act="activate" data-activate id="hActivate"><span class="h-btn__l">${esc(t(replace ? "entry.preview.activate_replace" : "entry.preview.activate_first"))}</span>${ARROW()}</button>`, 'data-checkpoint="activate"')}`;
  }
  function compileErrorView() {
    return `<main class="h-page h-poster" data-entry-step="result">${bar({ center: t("entry.result.title") })}<div class="h-alert" role="alert"><p class="h-alert__t">${esc(t("h.error.title"))}</p><p>${esc(S.compileError || t("x.issue.compile"))}</p></div></main>`;
  }
  function catalogueView() {
    const cards = TF.browseCards(answers());
    const a = S.answers;
    return `<main class="h-page h-cat" data-checkpoint="browse-list" data-entry-step="catalogue">${bar({ center: t("entry.catalogue.title") })}
      <h1 class="h-head" tabindex="-1">${mono(t("h.mono.catalogue"))}<span class="h-head__q">${esc(t("entry.catalogue.title"))}</span></h1><p class="h-lede">${esc(t("entry.catalogue.lede"))}</p>
      <p class="h-note">${esc([t("entry.catalogue.context_days", { days: a.daysPerWeek }), t("entry.catalogue.context_minutes", { minutes: a.sessionMinutes }), vWord("environment", a)].join(" · "))}</p>
      ${cards.length ? `<div class="h-cards">${cards.map((c) => { const f = TF.previewFacts(c.preview); const nm = lang === "pt" ? c.namePt || c.name : c.name; return `<button type="button" class="h-card" data-act="card" data-id="${esc(c.id)}"><span class="h-card__n">${esc(nm)}</span><span class="h-card__p">${esc(t(`entry.catalogue.purpose.${c.purpose}`, undefined, ""))}</span><span class="h-card__f">${esc(t("h.cat.facts", { days: c.daysPerWeek, minutes: t("entry.catalogue.minutes", { min: c.minutes[0], max: c.minutes[1] }) }))} · ${esc(t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }))}</span>${c.mismatch ? `<span class="h-card__m">${esc(t("entry.catalogue.mismatch"))}</span>` : ""}${ARROW()}</button>`; }).join("")}</div>` : `<div class="h-alert" role="status"><p class="h-alert__t">${esc(t("entry.catalogue.empty_title"))}</p><p>${esc(t("entry.catalogue.empty_body"))}</p></div>`}</main>`;
  }
  function buildSetupView() {
    const a = S.answers; const ready = !!(a.programName && a.daysPerWeek);
    return `<main class="h-page h-qs" data-checkpoint="build-setup" data-entry-step="build_setup">${bar({ center: t("entry.build_setup.title") })}
      <div class="h-comp"><h1 class="h-head" tabindex="-1">${mono(t("h.mono.setup"))}<span class="h-head__q">${esc(t("entry.build_setup.title"))}</span></h1><p class="h-lede">${esc(t("entry.build_setup.lede"))}</p>
      <label class="h-field"><span class="h-field__l">${esc(t("h.build.name_label"))}</span><input id="hBuildName" type="text" autocomplete="off" data-field="programName" value="${esc(a.programName || "")}" placeholder="${esc(t("entry.build_setup.name_placeholder"))}"></label>
      <p class="h-label" id="hQL-bdays">${esc(t("h.build.days_q"))}</p>${stair("daysPerWeek", TS.DAYS.map((n) => ({ val: n, num: String(n), unit: t("h.unit.days") })), (v) => a.daysPerWeek === v, { sheet: false }, "hQL-bdays")}</div></main>
      ${dock(`${ready ? "" : `<p class="h-dock__why" id="hAdvWhy">${esc(t("h.build.need_name"))}</p>`}<button type="button" class="h-btn h-btn--field" data-act="next" data-advance${ready ? "" : ' disabled aria-describedby="hAdvWhy"'}><span class="h-btn__l">${esc(t("h.adv.editor"))}</span>${ARROW()}</button>`)}`;
  }
  function editorView() {
    const b = S.build; const st = TS.build.status(t, b, { revAtStart: S.revAtStart });
    const cp = b.days.every((d) => !d.exercises.length) ? "build-empty" : st.ready ? "build-ready" : "build-partial";
    return `<main class="h-page h-ed-page" data-checkpoint="${cp}" data-entry-step="editor">${bar({ center: b.name })}
      <h1 class="h-head" tabindex="-1">${mono(b.name || t("h.mono.editor"), { max: 92, vh: 0.12 })}<span class="h-head__q">${esc(t("entry.editor.title"))}</span></h1>
      <div class="h-bdays">${b.days.map((d, di) => `<section class="h-bday" aria-labelledby="hBD${di}"><p class="h-col__n" aria-hidden="true">${di + 1}</p><label class="h-field"><span class="h-field__l" id="hBD${di}">${esc(t("x.build.day_name"))}</span><input type="text" data-field="dayName" data-day="${d.dayId}" value="${esc(TS.dayLabel(t, d, di))}"></label>
        <ol class="h-col__list">${d.exercises.map((e) => { const bad = !(Number.isInteger(e.sets) && e.sets >= 1 && Number.isInteger(e.min) && e.min >= 1 && Number.isInteger(e.max) && e.max >= e.min); return `<li class="h-bex"><div class="h-bex__head"><span class="h-ex__n">${esc(TS.exName(e, lang))}</span><button type="button" class="h-mini h-mini--quiet" data-act="build" data-build="remove" data-day="${d.dayId}" data-id="${e.id}">${esc(t("x.build.remove"))}</button></div>
          <div class="h-bex__rx"><span class="h-stepper" role="group" aria-label="${esc(t("x.build.sets"))}"><button type="button" class="h-mini" data-act="build" data-build="step" data-day="${d.dayId}" data-id="${e.id}" data-delta="-1" aria-label="${esc(t("x.build.sets"))} −1">−</button><output aria-live="polite">${Number.isFinite(e.sets) ? e.sets : "–"}</output><button type="button" class="h-mini" data-act="build" data-build="step" data-day="${d.dayId}" data-id="${e.id}" data-delta="1" aria-label="${esc(t("x.build.sets"))} +1">+</button></span>
          <label class="h-field h-field--num"><span class="h-field__l">${esc(t("x.build.min"))}</span><input type="number" inputmode="numeric" min="1" data-field="rx" data-rx="min" data-day="${d.dayId}" data-id="${e.id}" value="${Number.isFinite(e.min) ? e.min : ""}"${bad ? ' aria-invalid="true"' : ""}></label><label class="h-field h-field--num"><span class="h-field__l">${esc(t("x.build.max"))}</span><input type="number" inputmode="numeric" min="1" data-field="rx" data-rx="max" data-day="${d.dayId}" data-id="${e.id}" value="${Number.isFinite(e.max) ? e.max : ""}"${bad ? ' aria-invalid="true"' : ""}></label></div>${bad ? `<p class="h-err">${esc(t("x.build.rx_invalid"))}</p>` : ""}</li>`; }).join("")}</ol>
        ${b.picker === d.dayId ? `<div class="h-picker">${pickerBody(b.query)}<button type="button" class="h-link" data-act="build" data-build="close-picker">${esc(t("x.build.done"))}</button></div>` : `<button type="button" class="h-btn h-btn--line" data-act="build" data-build="open-picker" data-day="${d.dayId}"><span class="h-btn__l">${esc(t("x.build.add"))}</span>${PLUS}</button>`}</section>`).join("")}</div></main>
      ${dock(`<p class="h-dock__why${st.ready ? " is-ready" : ""}" id="hEditorStatus" role="status" aria-live="polite">${esc(st.text)}</p><button type="button" class="h-btn h-btn--field" data-act="activate" data-activate id="hActivate"${st.ready ? "" : ' disabled aria-describedby="hEditorStatus"'}><span class="h-btn__l">${esc(t(TF.hasActiveProgram() ? "entry.preview.activate_replace" : "entry.editor.use"))}</span>${ARROW()}</button>`)}`;
  }
  function pickerBody(query) {
    const results = TF.searchLibrary(query, lang, { limit: 6, all: true });
    return `<label class="h-field"><span class="h-field__l">${esc(t("x.build.search"))}</span><input id="hPickerSearch" type="search" autocomplete="off" data-field="pickerQuery" value="${esc(query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></label>
      <div class="h-results" role="listbox" aria-label="${esc(t("x.build.search"))}">${results.map((e) => `<button type="button" class="h-result h-result--btn" role="option" aria-selected="false" data-act="pick-exercise" data-id="${esc(e.id)}"><span class="h-result__n">${esc(TF.libraryName(e, lang))}</span>${PLUS}</button>`).join("")}</div>`;
  }

  /* ---------- the import door (paste and file) ---------- */
  function ffCheckpoint() {
    const ff = S.ff;
    if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps";
    if (ff.status === "unreadable") return "ff-unreadable";
    if (ff.stage === 3) return "ff-reply";
    if (ff.stage === 2) return "ff-handoff";
    return ff.input.trim() ? "ff-filled" : "ff-empty";
  }
  function modeSwitch() {
    return `<div class="h-modes" role="group" aria-label="${esc(t("h.mode.label"))}">${["freeform", "file"].map((m) => `<button type="button" class="h-modes__b${S.importMode === m ? " is-on" : ""}" data-act="import-mode" data-mode="${m}" aria-pressed="${S.importMode === m}">${esc(t(`h.mode.${m}`))}</button>`).join("")}</div>`;
  }
  function ffSummary() { return `<div class="h-srcline"><p>${esc(t("entry.freeform.source_summary", { lines: TS.freeform.lines(S.ff) }))}</p><button type="button" class="h-mini" data-act="ff" data-ff="edit-source" aria-label="${esc(t("h.ff.edit_sr"))}">${esc(t("entry.freeform.edit_source"))}</button></div>`; }
  function ffBody() {
    const ff = S.ff; const program = TS.freeform.program(ff);
    if (ff.status === "gaps" && ff.gap) {
      const g = ff.gap;
      return `<h1 class="h-head" tabindex="-1">${mono(t("h.mono.gaps"))}<span class="h-head__q">${esc(t("entry.freeform.gaps_title"))}</span></h1><p class="h-lede">${esc(t("h.ff.gaps_lede"))}</p>
        ${g.notImported.length ? `<p class="h-note h-note--rule" role="status">${esc(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }))}</p>` : ""}
        ${ff.gapErrors.size ? `<p class="h-alert" role="alert" id="hGapError" tabindex="-1">${esc(t("entry.freeform.gap_error"))}</p>` : ""}
        <div class="h-gaps">${g.gaps.map((gap) => { const bad = ff.gapErrors.has(gap.key); const label = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` }); return `<label class="h-field${bad ? " is-bad" : ""}"><span class="h-field__l">${esc(label)}</span><input type="text" inputmode="numeric" data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}"${bad ? ' aria-invalid="true"' : ""}>${bad ? `<span class="h-err">${esc(t("entry.freeform.gap_error"))}</span>` : ""}</label>`; }).join("")}</div>
        <div class="h-stack">${`<button type="button" class="h-btn h-btn--field" data-act="ff" data-ff="gap-submit"><span class="h-btn__l">${esc(t("entry.freeform.gaps_submit"))}</span>${ARROW()}</button>`}<button type="button" class="h-link" data-act="ff" data-ff="gap-back">${esc(t("entry.freeform.back_to_reply"))}</button></div>`;
    }
    if (ff.stage === 1) return `<h1 class="h-head" tabindex="-1">${mono(t("h.mono.paste"))}<span class="h-head__q">${esc(t("entry.freeform.title"))}</span></h1><p class="h-lede">${esc(t("entry.freeform.lede"))}</p>
      <label class="h-field h-field--area"><span class="h-field__l">${esc(t("entry.freeform.input_label"))}</span><textarea id="hFfIn" rows="7" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(ff.input)}</textarea><span class="h-field__hint" id="hFfCount">${esc(t("entry.freeform.count", { n: TF.nf(lang, ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }))}</span></label>
      <p class="h-note" id="hFfNeeds"${program ? " hidden" : ""}>${esc(t("entry.freeform.needs_input"))}</p>
      <p class="h-note h-note--rule">${esc(t("entry.freeform.privacy"))}</p>
      <button type="button" class="h-btn h-btn--field" data-act="ff" data-ff="continue"${program ? "" : ' disabled aria-describedby="hFfNeeds"'}><span class="h-btn__l">${esc(t("entry.freeform.continue"))}</span>${ARROW()}</button>`;
    if (ff.stage === 2) {
      const prompt = TF.freeformPrompt(t, program);
      return `${ffSummary()}<h1 class="h-head" tabindex="-1">${mono(t("h.mono.handoff"))}<span class="h-head__q">${esc(t("entry.freeform.stage2_title"))}</span></h1><p class="h-lede">${esc(t("entry.freeform.stage2_hint"))}</p>
        <div class="h-pair"><a class="h-btn h-btn--ink" href="https://chatgpt.com/?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt"><span class="h-btn__l">${esc(t("entry.freeform.open_chatgpt"))}</span>${ARROW()}</a><a class="h-btn h-btn--ink" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude"><span class="h-btn__l">${esc(t("entry.freeform.open_claude"))}</span>${ARROW()}</a></div>
        <button type="button" class="h-btn h-btn--line" data-act="ff" data-ff="copy"><span class="h-btn__l">${esc(t("entry.freeform.copy"))}</span></button>
        <details class="h-corr"><summary><span>${esc(t("entry.freeform.preview_prompt"))}</span>${PLUS}</summary><pre class="h-prompt">${esc(prompt)}</pre></details>`;
    }
    const unreadable = ff.status === "unreadable" ? `<div class="h-alert" role="alert"><p class="h-alert__t">${esc(t("entry.freeform.unreadable_title"))}</p><p>${esc(t("entry.freeform.unreadable_body"))}</p><button type="button" class="h-mini" data-act="ff" data-ff="copy-repair">${esc(t("entry.freeform.copy_repair_prompt"))}</button></div>` : "";
    return `${ffSummary()}<h1 class="h-head" tabindex="-1">${mono(t("h.mono.reply"))}<span class="h-head__q">${esc(t("entry.freeform.stage3_title"))}</span></h1><p class="h-lede">${esc(t("entry.freeform.stage3_hint"))}</p>
      ${ff.invalidated ? `<p class="h-note h-note--rule" role="status">${esc(t("entry.freeform.edit_source_warning"))}</p>` : ""}${unreadable}
      <button type="button" class="h-btn h-btn--field" data-act="ff" data-ff="clipboard"><span class="h-btn__l">${esc(t("entry.freeform.clipboard_import"))}</span>${ARROW()}</button>
      <label class="h-field h-field--area"><span class="h-field__l">${esc(t("entry.freeform.clipboard_or"))}</span><textarea id="hFfOut" rows="5" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(ff.reply)}</textarea></label>
      <button type="button" class="h-btn h-btn--ink" data-act="ff" data-ff="review"><span class="h-btn__l">${esc(t("entry.freeform.review"))}</span>${ARROW()}</button>
      <div class="h-row2"><button type="button" class="h-link" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button><button type="button" class="h-link h-link--danger" data-act="ff" data-ff="start-over" aria-haspopup="dialog">${esc(t("entry.freeform.start_over"))}</button></div>`;
  }
  function reviewBody(dr) {
    const c = TF.importCounts(dr);
    const ordered = [...dr.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
    const rows = ordered.map((row) => {
      const proposed = !row.reviewed && row.match ? row.match : null; const shown = row.decision === "link" && row.match ? row.match : proposed;
      const target = shown ? TF.libraryName(shown, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
      const badge = row.reviewed ? t("import.status.confirmed") : t(`import.status.${row.status === "probable" ? "probable" : row.status}`);
      const folded = row.reviewed && !row.expanded;
      let acts;
      if (folded) acts = `<button type="button" class="h-mini h-mini--quiet" data-act="imp" data-imp="expand" data-key="${row.key}">${esc(t("import.action_change"))}</button>`;
      else {
        const links = row.shortlist.length ? row.shortlist.map((e, i) => `<button type="button" class="h-mini h-mini--link" data-act="imp" data-imp="pick" data-key="${row.key}" data-idx="${i}">${esc(t("import.action_link", { name: TF.libraryName(e, lang) }))}</button>`).join("") : (row.match && row.decision !== "link" ? `<button type="button" class="h-mini h-mini--link" data-act="imp" data-imp="link" data-key="${row.key}">${esc(t("import.action_link", { name: TF.libraryName(row.match, lang) }))}</button>` : "");
        const escapes = `<button type="button" class="h-mini" data-act="imp" data-imp="choose" data-key="${row.key}">${esc(t("import.action_choose"))}</button>${row.decision !== "raw" || !row.reviewed ? `<button type="button" class="h-mini" data-act="imp" data-imp="raw" data-key="${row.key}">${esc(t("import.action_keep"))}</button>` : ""}${row.decision !== "custom" ? `<button type="button" class="h-mini" data-act="imp" data-imp="custom" data-key="${row.key}">${esc(t("import.action_custom"))}</button>` : ""}`;
        acts = links + escapes;
      }
      const picker = S.picker && S.picker.key === row.key ? `<div class="h-picker">${pickerBody(S.picker.query)}</div>` : "";
      return `<li class="h-imp${row.reviewed ? "" : " is-open"}" data-imp-row="${row.key}"><p class="h-imp__from"><span class="visually-hidden">${esc(t("h.import.from"))}: </span><span data-user-text>${esc(row.raw.name || "")}</span></p><p class="h-imp__to"><span class="visually-hidden">${esc(t("h.import.to"))}: </span><span class="improw__name">${esc(target)}</span> <span class="impbadge h-badge${row.reviewed ? " is-done" : ""}">${esc(badge)}</span></p><div class="h-imp__acts">${acts}</div>${picker}</li>`;
    }).join("");
    return `<h1 class="h-head" tabindex="-1">${mono(t("h.mono.review"))}<span class="h-head__q">${esc(t("import.heading"))}</span></h1><p class="h-lede">${esc(t("import.lede"))}</p>
      <p class="h-note">${esc(dr.sourceType === "file" ? t("import.file", { name: dr.fileName, n: dr.rows.length, exercise: TF.tp(t, dr.rows.length, "exercise") }) : t("entry.freeform.source_name"))}</p>
      <p class="h-counts"><span data-metric="linked"><b>${c.linked}</b> ${esc(t("import.count_linked"))}</span><span data-metric="review"><b>${c.review}</b> ${esc(t("import.count_review"))}</span><span data-metric="custom"><b>${c.custom}</b> ${esc(t("import.count_custom"))}</span></p>
      <ol class="h-imps">${rows}</ol><p class="h-note">${esc(t("import.safe"))}</p>`;
  }
  function importView() {
    const dr = draft();
    let cp, body, dockHtml = "";
    if (dr) {
      cp = "import-review"; body = reviewBody(dr);
      const c = TF.importCounts(dr);
      dockHtml = dock(`${c.review ? `<p class="h-dock__why" id="hCommitWhy">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : ""}<button type="button" class="h-btn h-btn--field" data-act="import-commit"${c.review ? ' disabled aria-describedby="hCommitWhy"' : ""}><span class="h-btn__l">${esc(t("import.commit"))}</span>${ARROW()}</button>`);
    } else if (S.importMode === "freeform") { cp = ffCheckpoint(); body = ffBody(); }
    else { cp = "import-source"; body = `<h1 class="h-head" tabindex="-1">${mono(t("h.mono.file"))}<span class="h-head__q">${esc(t("entry.import_source.title"))}</span></h1><p class="h-lede">${esc(t("entry.import_source.lede"))}</p><button type="button" class="h-btn h-btn--field" data-act="import-file"><span class="h-btn__l">${esc(t("entry.import_source.pick"))}</span>${ARROW()}</button>`; }
    return `<main class="h-page h-impv${dr ? " h-impv--review" : ""}" data-checkpoint="${cp}" data-entry-step="import_source">${bar({ center: t("entry.route.import") })}${modeSwitch()}<div class="h-comp h-stack">${body}</div></main>${dockHtml}`;
  }
  function todayView() {
    const label = `<p class="t-label">${esc(t("today.session_label"))}</p>`;
    return `<div class="h-today">${S.toast ? `<p class="h-toast" role="status">${esc(S.toast)}</p>` : ""}${TF.renderToday(t, lang).replace(label, "")}</div>`;
  }
  function routeView() {
    if (S.stage === "q") return questionView();
    if (S.stage === "result" || S.stage === "preview") return S.result ? posterView() : compileErrorView();
    if (S.stage === "catalogue") return catalogueView();
    if (S.stage === "setup") return buildSetupView();
    if (S.stage === "editor") return editorView();
    if (S.stage === "import") return importView();
    return "";
  }

  /* ---------- dialogs ---------- */
  const slab = ({ role = "dialog", cp, confirm, title, body, acts }) => `<div class="h-scrim" data-scrim></div><div class="h-slab" role="${role}" aria-modal="true" aria-labelledby="hDlgTitle"${body ? ' aria-describedby="hDlgBody"' : ""}${cp ? ` data-checkpoint="${cp}"` : ""}${confirm ? ` data-confirm="${confirm}"` : ""}><h2 class="h-slab__t" id="hDlgTitle" tabindex="-1">${esc(title)}</h2>${body ? `<p class="h-slab__b" id="hDlgBody">${esc(body)}</p>` : ""}<div class="h-slab__acts">${acts}</div></div>`;
  const sbtn = (act, label, cls, extra = "") => `<button type="button" class="h-btn ${cls}" data-act="${act}"${extra}><span class="h-btn__l">${esc(label)}</span></button>`;
  function dialogView() {
    if (S.sheet) return editorSheet();
    if (S.overlay === "cancel") return slab({ cp: "cancel-confirm", title: t("entry.cancel_confirm.title"), body: t("entry.cancel_confirm.body"), acts: sbtn("cancel-keep", t("entry.cancel_confirm.keep"), "h-btn--field") + sbtn("cancel-discard", t("entry.cancel_confirm.discard"), "h-btn--line") + sbtn("cancel-continue", t("entry.cancel_confirm.continue"), "h-btn--text") });
    if (S.overlay === "replace") { const cur = TF.activeName(lang), next = TF.resultName(S.result, lang) || S.answers.programName || t("untitled_program"); return slab({ cp: "replace-confirm", title: t("x.replace.title"), body: t("x.replace.body", { current: cur, next, n: TF.device.sessions }), acts: sbtn("replace-confirm", t("x.replace.confirm", { next }), "h-btn--field") + sbtn("replace-cancel", t("x.replace.cancel", { current: cur }), "h-btn--line") }); }
    if (S.overlay === "restart") return slab({ role: "alertdialog", confirm: "restart", title: t("x.restart.title"), body: t("x.restart.body"), acts: sbtn("restart-confirm", t("x.restart.confirm"), "h-btn--field") + sbtn("restart-cancel", t("x.restart.cancel"), "h-btn--line") });
    if (S.route === "import" && S.ff.confirmStartOver) return slab({ role: "alertdialog", confirm: "ff-start-over", title: t("entry.freeform.confirm_start_over"), acts: `<button type="button" class="h-btn h-btn--field" data-act="ff" data-ff="start-over-confirm"><span class="h-btn__l">${esc(t("x.ff.restart_confirm"))}</span></button><button type="button" class="h-btn h-btn--line" data-act="ff" data-ff="start-over-cancel"><span class="h-btn__l">${esc(t("x.ff.restart_cancel"))}</span></button>` });
    return "";
  }
  function editorSheet() {
    const sh = S.sheet; const qs = GROUPS[S.route].find((g) => g[0] === sh.group)[1];
    const blockers = qs.map((q) => blocker(q, sh.answers, sh)).filter(Boolean);
    return `<div class="h-scrim" data-scrim></div><div class="h-sheet" role="dialog" aria-modal="true" aria-labelledby="hDlgTitle">
      <div class="h-sheet__body"><h2 class="h-sheet__t" id="hDlgTitle" tabindex="-1">${esc(t("h.ed.title", { what: t(`h.what.${sh.group}`) }))}</h2>${qs.map((q) => `<section class="h-sheet__q">${qHead(q, { sheet: true })}${qBody(q, sh.answers, { sheet: true })}</section>`).join("")}</div>
      <div class="h-sheet__foot">${sh.error ? `<p class="h-alert" role="alert">${esc(sh.error)}</p>` : ""}${blockers.length ? `<p class="h-dock__why" id="hSheetWhy">${esc(blockers[0])}</p>` : ""}<button type="button" class="h-btn h-btn--field" data-act="sheet-apply"${blockers.length ? ' disabled aria-describedby="hSheetWhy"' : ""}><span class="h-btn__l">${esc(t("h.ed.apply"))}</span>${ARROW()}</button><button type="button" class="h-link h-sheet__keep" data-act="sheet-close">${esc(t("h.ed.keep"))}</button></div></div>`;
  }
  function openSheet(group) { S.sheet = { group, answers: clone(S.answers), avoid: { query: "", pending: null }, pref: { query: "", pending: null }, error: null }; S.overlayReturn = `[data-chip="${group}"]`; render("#hDlgTitle"); }
  function closeSheet() { const g = S.sheet && S.sheet.group; S.sheet = null; render(g ? `[data-chip="${g}"]` : true); }
  function applySheet() {
    const sh = S.sheet; const qs = GROUPS[S.route].find((g) => g[0] === sh.group)[1];
    if (qs.some((q) => blocker(q, sh.answers, sh))) return;
    const next = clone(sh.answers); if (S.route === "custom") ensureSplit(next);
    if (JSON.stringify(TF.normalizeAnswers(next)) === JSON.stringify(answers())) { closeSheet(); return; }
    const r = compileWith(TF.normalizeAnswers(next));
    if (!r.ok) { sh.error = r.text; render(); return; }
    S.changeFrom = { preview: S.result.preview }; S.answers = next; S.result = r.result; S.sheet = null;
    render(); showChange();
  }
  function showChange() {
    const c = root.querySelector("#hChange"); if (!c) return;
    const pin = root.querySelector("[data-persistent-action]"); const limit = pin ? pin.getBoundingClientRect().top : innerHeight;
    const r = c.getBoundingClientRect();
    if (r.top + scrollY + r.height + 8 <= Math.min(limit, innerHeight)) window.scrollTo(0, 0);
    else window.scrollTo(0, Math.max(0, scrollY + r.top - 64));
    try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  /* ---------- render ---------- */
  const IDENT = ["data-act", "data-key", "data-val", "data-ff", "data-chip", "data-mode", "data-imp", "data-idx", "data-route", "data-id", "data-build", "data-day", "data-status", "data-provider", "data-rx", "data-field"];
  function ident(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const sel = IDENT.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join("");
    return sel || null;
  }
  function render(focus) {
    const prev = ident(document.activeElement); const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    const page = S.view === "landing" ? landingView() : S.view === "hub" ? hubView() : S.view === "today" ? todayView() : routeView();
    const dlg = S.view === "route" ? dialogView() : "";
    document.documentElement.classList.toggle("h-locked", !!dlg); setLarge();
    root.innerHTML = `<div class="h-app${S.view === "today" ? " h-app--today" : ""}"${dlg ? " inert" : ""}>${page}</div>${dlg}`;
    S.flood = null; S.fresh = null;
    layout();
    if (focus === true) { window.scrollTo(0, 0); const h = root.querySelector("h1"); if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    else if (typeof focus === "string") { const el = root.querySelector(focus); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    else if (prev) { const el = root.querySelector(prev); if (el) { try { el.focus({ preventScroll: true }); if (typing && el.setSelectionRange && el.type !== "number") { const n = el.value.length; el.setSelectionRange(n, n); } } catch (e) { /* ignore */ } } }
    if (dlg) { const body = root.querySelector(".h-sheet__body"); if (body && focus === "#hDlgTitle") body.scrollTop = 0; }
  }

  /* ---------- measured type: monumental words fit the grid ---------- */
  const ctx2d = document.createElement("canvas").getContext("2d");
  function widthPerPx(text, cs) {
    const txt = cs.textTransform === "lowercase" ? text.toLowerCase() : cs.textTransform === "uppercase" ? text.toUpperCase() : text;
    ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
    const ls = (parseFloat(cs.letterSpacing) || 0) / (parseFloat(cs.fontSize) || 16);
    return ctx2d.measureText(txt).width / 100 + ls * txt.length;
  }
  /* Large text is measured, not read from the harness query: when the root
     em is big for the viewport (OS or browser text size, or 200%), the grid
     re-sets itself. */
  function setLarge() {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const large = rem >= 24 || innerWidth / rem < 16;
    document.documentElement.classList.toggle("h-large", large);
    return large;
  }
  function fitSize(el) {
    const cs = getComputedStyle(el);
    const box = cs.display === "inline" ? el.parentElement : el; const bcs = box === el ? cs : getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(bcs.paddingLeft) - parseFloat(bcs.paddingRight);
    const text = el.textContent.trim(); if (!text || avail <= 0) return null;
    let unit = el.dataset.fitLine !== undefined ? widthPerPx(text, cs) : Math.max(...text.split(/\s+/).map((w) => widthPerPx(w, cs)));
    if (el.dataset.fitLines) unit = Math.max(unit, (widthPerPx(text, cs) * 1.08) / +el.dataset.fitLines);
    const large = document.documentElement.classList.contains("h-large");
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const vh = el.dataset.fitVh ? (large ? Math.min(+el.dataset.fitVh, +(el.dataset.fitVhLarge || 0.11)) : +el.dataset.fitVh) : null;
    const capPx = el.dataset.fitRem ? rem * (large ? Math.min(+el.dataset.fitRem, 1.125) : +el.dataset.fitRem) : +el.dataset.fitMax || 120;
    const cap = Math.min(capPx, vh ? innerHeight * vh + (large ? 0 : 24) : Infinity);
    return Math.max(12, Math.min(cap, (avail * 0.97) / unit));
  }
  function fitAll() {
    const groups = new Map();
    for (const el of root.querySelectorAll("[data-fit]")) {
      el.style.fontSize = "";
      const s = fitSize(el); if (s == null) continue;
      const g = el.dataset.fitGroup; if (g) { groups.set(g, Math.min(groups.get(g) ?? Infinity, s)); } else el.style.fontSize = s.toFixed(2) + "px";
    }
    for (const [g, s] of groups) for (const el of root.querySelectorAll(`[data-fit-group="${g}"]`)) el.style.fontSize = s.toFixed(2) + "px";
  }
  /* Days are columns when every word fits its column; otherwise the poster
     re-sets itself in fewer columns (4 days at 390 px become 2 × 2). */
  function layoutCols() {
    for (const g of root.querySelectorAll(".h-cols")) {
      const n = +g.dataset.n || 1; const avail = g.clientWidth; const gap = parseFloat(getComputedStyle(g).columnGap) || 0;
      let longest = 0;
      for (const el of g.querySelectorAll(".h-ex__n, .h-col__name")) { const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); for (const w of el.textContent.trim().split(/\s+/)) longest = Math.max(longest, widthPerPx(w, cs) * size); }
      const pad = 4; let cols = Math.min(n, 4);
      while (cols > 1 && ((avail - gap * (cols - 1)) / cols - pad < Math.max(longest + 2, 92))) cols--;
      const rows = Math.ceil(n / cols); cols = Math.ceil(n / rows);
      g.style.setProperty("--cols", cols);
    }
  }
  function layout() { try { setLarge(); fitAll(); layoutCols(); } catch (e) { /* layout is cosmetic */ } }

  /* ---------- actions ---------- */
  function onPick(d) {
    if (S.sheet) {
      const sh = S.sheet;
      if (d.key === "avoidReason") { sh.avoid.pending = null; sh.pref.pending = null; }
      sh.answers = TS.applyPick(sh.answers, d.key, d.val); sh.error = null; render(); return;
    }
    if (d.key === "avoidReason") { S.avoid.pending = null; S.pref.pending = null; }
    if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
    if (d.key === "environment") S.envOpen = S.envOpen && false;
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (d.key === "daysPerWeek" && S.route === "custom") delete S.answers.splitPreference;
    S.flood = `${d.key}|${d.val}`; S.fresh = qid();
    render();
  }
  function on(act, d, el) {
    S.cpTag = null;
    if (S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": S = blank("hub"); render(true); return;
      case "land-import": go("import", "freeform"); return;
      case "hub-back": S = blank(TF.hasActiveProgram() ? "today" : "landing"); render(true); return;
      case "route": go(d.route, d.mode); return;
      case "pick": onPick(d); return;
      case "next": advance(); return;
      case "back": back(); return;
      case "cancel": S.overlay = "cancel"; S.overlayReturn = '[data-act="cancel"]'; render("#hDlgTitle"); return;
      case "cancel-continue": S.overlay = null; render('[data-act="cancel"]'); return;
      case "cancel-keep": keepDraft(); leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); leaveSetup(); return;
      case "resume": {
        const info = TF.loadDraft(); if (!info || !info.state) return; const st = info.state;
        S = blank("route"); S.route = st.route; S.answers = clone(st.answers) || {}; S.revAtStart = st.activeProgramRevisionAtStart;
        const ui = info.ui || {};
        if (QLIST[S.route] && ui.stage === "q" && Number.isInteger(ui.qi)) { S.stage = "q"; S.qi = Math.min(ui.qi, QLIST[S.route].length - 1); }
        else if (QLIST[S.route]) { S.stage = "q"; S.qi = Math.max(0, QLIST[S.route].findIndex((q) => QDEF[q].step === st.step)); }
        else if (S.route === "build") { S.stage = ui.build ? "editor" : "setup"; S.build = clone(ui.build); }
        else { S.stage = "import"; S.importMode = ui.importMode || "freeform"; }
        render(true); return;
      }
      case "resume-drop": TF.clearDraft(); render(true); return;
      case "avoid-add": { const st = S.sheet ? S.sheet.avoid : S.avoid; st.pending = d.id; st.query = ""; render(); return; }
      case "avoid-remove": { const tgt = S.sheet ? S.sheet.answers : S.answers; tgt.exerciseConstraints = (tgt.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); for (const st of S.sheet ? [S.sheet.avoid, S.sheet.pref] : [S.avoid, S.pref]) if (st.pending === d.id) st.pending = null; render(); return; }
      case "pref-add": { const tgt = S.sheet ? S.sheet.answers : S.answers; const st = S.sheet ? S.sheet.pref : S.pref; if (d.status === "include") tgt.mustHaveExercises = [...(tgt.mustHaveExercises || []), d.id]; else st.pending = d.id; st.query = ""; render(); return; }
      case "pref-remove": { const tgt = S.sheet ? S.sheet.answers : S.answers; tgt.mustHaveExercises = (tgt.mustHaveExercises || []).filter((x) => x !== d.id); render(); return; }
      case "field:avoidQuery": (S.sheet ? S.sheet.avoid : S.avoid).query = d.value; render(); return;
      case "field:prefQuery": (S.sheet ? S.sheet.pref : S.pref).query = d.value; render(); return;
      case "field:programName": { S.answers.programName = d.value.trim(); const b = root.querySelector("[data-advance]"); const ok = !!(S.answers.programName && S.answers.daysPerWeek); if (b && b.disabled === ok) render(); return; }
      case "field:dayName": S.build = TS.build.apply(S.build, "day-name", { dayId: d.day, value: d.value }); return;
      case "field:rx": case "change:rx": S.build = TS.build.apply(S.build, "field", { dayId: d.day, id: d.id, field: d.rx, value: d.value }); if (act === "change:rx") render(); return;
      case "field:pickerQuery": if (S.picker) S.picker.query = d.value; else S.build = TS.build.apply(S.build, "query", d.value); render(); return;
      case "build": S.build = TS.build.apply(S.build, d.build, { dayId: d.day, id: d.id, delta: +d.delta }); render(d.build === "open-picker" ? "#hPickerSearch" : d.build === "close-picker" ? `[data-build="open-picker"][data-day="${S.build.days[0] && d.day ? d.day : ""}"]` : undefined); return;
      case "pick-exercise": if (S.picker) { S.imp[S.importMode] = TS.importReview.apply(draft(), "choose", S.picker.key, d.id); S.picker = null; render(); return; } S.build = TS.build.apply(S.build, "add", d.id); render(); return;
      case "card": { const c = TF.browseCards(answers()).find((x) => x.id === d.id); if (!c) return; S.answers.catalogueSelection = c.id; S.result = TF.jsonClean({ fingerprint: c.fingerprint, name: c.name, namePt: c.namePt, selected: { id: c.id, familyId: c.familyId, daysPerWeek: c.daysPerWeek, blueprintId: c.id }, preview: c.preview }); S.stage = "preview"; render(true); return; }
      case "import-mode": if (S.importMode === d.mode) return; S.importMode = d.mode; S.picker = null; render(true); return;
      case "import-file": S.imp.file = TF.buildImportDraft(TF.F.importFile[lang], t("h.import.file_name"), "file"); render(true); return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render("#hPickerSearch"); return; } S.imp[S.importMode] = TS.importReview.apply(draft(), d.imp, d.key, d.idx); render(); return;
      case "import-commit": { const dr = draft(); if (!dr || TF.importCounts(dr).review) return; S.impKept = dr; S.result = TF.importResult(dr, t); S.stage = "preview"; S.picker = null; render(true); return; }
      case "ff": {
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
        else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); return; }
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.imp.freeform = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...S.ff, status: null, parsed: null }; render(true); return; }
        if (d.ff === "start-over") { S.overlayReturn = '[data-ff="start-over"]'; render("#hDlgTitle"); return; }
        if (d.ff === "start-over-cancel") { render('[data-ff="start-over"]'); return; }
        if (d.ff === "gap-submit" && S.ff.gapErrors.size) { render("#hGapError"); return; }
        render(["continue", "open", "copy", "try-another", "gap-back", "start-over-confirm", "review", "gap-submit", "edit-source"].includes(d.ff) ? true : undefined); return;
      }
      case "field:ffInput": {
        S.ff = TS.freeform.apply(S.ff, "input", d.value);
        const c = root.querySelector("#hFfCount"); if (c) c.textContent = t("entry.freeform.count", { n: TF.nf(lang, S.ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) });
        const ok = !!TS.freeform.program(S.ff);
        const need = root.querySelector("#hFfNeeds"); if (need) need.hidden = ok;
        const b = root.querySelector('[data-ff="continue"]'); if (b) { b.disabled = !ok; if (ok) b.removeAttribute("aria-describedby"); else b.setAttribute("aria-describedby", "hFfNeeds"); }
        const main = root.querySelector("main[data-checkpoint]"); if (main) main.dataset.checkpoint = ffCheckpoint();
        return;
      }
      case "field:ffReply": S.ff = TS.freeform.apply(S.ff, "reply", d.value); return;
      case "field:gap": S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return;
      case "activate": requestActivate(); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; render("[data-activate]"); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render(true); return;
      case "restart": S.overlay = "restart"; S.overlayReturn = '[data-act="restart"]'; render("#hDlgTitle"); return;
      case "restart-cancel": S.overlay = null; render('[data-act="restart"]'); return;
      case "restart-confirm": S = blank("hub"); render(true); return;
      case "chip": openSheet(d.chip); return;
      case "sheet-close": closeSheet(); return;
      case "sheet-apply": applySheet(); return;
      default: return;
    }
  }
  function closeTop() {
    if (document.getElementById("tfPrivacy")) return false;
    if (S.sheet) { closeSheet(); return true; }
    if (S.overlay === "cancel") { on("cancel-continue", {}); return true; }
    if (S.overlay === "replace") { on("replace-cancel", {}); return true; }
    if (S.overlay === "restart") { on("restart-cancel", {}); return true; }
    if (S.ff && S.ff.confirmStartOver) { S.ff = TS.freeform.apply(S.ff, "start-over-cancel"); render('[data-ff="start-over"]'); return true; }
    return false;
  }
  function onKey(ev) {
    if (ev.key === "Escape") { if (closeTop()) ev.preventDefault(); return; }
    if (ev.key === "Tab") {
      const dlg = root.querySelector(".h-slab, .h-sheet"); if (!dlg) return;
      const f = [...dlg.querySelectorAll("button:not([disabled]),a[href],input,textarea,summary,[tabindex='0']")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && (document.activeElement === last || !dlg.contains(document.activeElement))) { ev.preventDefault(); first.focus(); }
    }
  }

  /* ---------- checkpoint reach (every state built through the same model) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  const customA = () => TF.fixtureAnswers("custom");
  function at(route, stage, a, qi) { S = blank("route"); S.route = route; S.stage = stage; S.answers = a; if (qi != null) S.qi = qi; S.revAtStart = TF.liveRevision(); }
  const qAt = (route, q, a) => at(route, "q", a, QLIST[route].indexOf(q));
  function importDecided() { let dr = TF.buildImportDraft(TF.F.importFile[lang], t("h.import.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); return dr; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  const partial = (keys) => { const a = rafael(); const o = {}; for (const k of keys) o[k] = a[k]; return o; };
  async function reach(cp) {
    const u = TF.F.users;
    const buildPlan = (plan) => { at("build", "editor", { programName: t("entry.build_setup.name_placeholder"), daysPerWeek: 3 }); S.build = TS.build.create(S.answers.programName, 3); for (const [dd, id] of plan) { S.build.picker = dd; S.build = TS.build.apply(S.build, "add", id); } };
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "route-help": S = blank("hub"); break;
      case "rec-goal": qAt("recommend", "goal", {}); break;
      case "rec-background": qAt("recommend", "experience", partial(["desiredResult"])); break;
      case "rec-schedule": qAt("recommend", "days", partial(["desiredResult", "structuredExperience", "recentConsistency"])); break;
      case "rec-environment": qAt("recommend", "environment", partial(["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "preferredRestSeconds"])); break;
      case "rec-env-correction": { const a = rafael(); a.environment = correctedEnv(); qAt("recommend", "environment", a); S.envOpen = true; break; }
      case "rec-priorities": qAt("recommend", "priorities", rafael()); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; qAt("recommend", "priorities", a); break; }
      case "rec-result": case "activate": case "replace-confirm": at("recommend", "result", rafael()); compileFirst(); if (cp === "replace-confirm") { S.overlay = "replace"; S.overlayReturn = "[data-activate]"; render("#hDlgTitle"); return; } break;
      case "rec-result-corrected": { at("recommend", "result", rafael()); compileFirst(); const before = S.result.preview; S.answers = { ...S.answers, environment: correctedEnv() }; compileFirst(); S.changeFrom = { preview: before }; S.cpTag = cp; break; }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", "result", a); compileFirst(); S.cpTag = cp; break; }
      case "browse-filters": qAt("browse", "days", {}); break;
      case "browse-list": at("browse", "catalogue", TF.fixtureAnswers("browse")); break;
      case "browse-preview": at("browse", "catalogue", TF.fixtureAnswers("browse")); on("card", { id: "balanced_4_v1" }); return;
      case "custom-priorities": qAt("custom", "emphasis", customA()); break;
      case "custom-exercises": qAt("custom", "prefs", customA()); break;
      case "custom-shape": qAt("custom", "shape", ensureSplit(customA())); break;
      case "custom-result": at("custom", "result", ensureSplit(customA())); compileFirst(); break;
      case "build-setup": at("build", "setup", {}); break;
      case "build-empty": buildPlan([]); break;
      case "build-partial": buildPlan([["manual_d1", "pd_bw"]]); break;
      case "build-ready": buildPlan([["manual_d1", "sq_bb"], ["manual_d1", "pr_bb"], ["manual_d2", "pd_bw"], ["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]); break;
      case "ff-empty": at("import", "import", {}); S.importMode = "freeform"; break;
      case "ff-filled": at("import", "import", {}); S.importMode = "freeform"; S.ff = ffAt(1); break;
      case "ff-handoff": at("import", "import", {}); S.importMode = "freeform"; S.ff = ffAt(2); break;
      case "ff-reply": at("import", "import", {}); S.importMode = "freeform"; S.ff = ffAt(3); break;
      case "ff-gaps": case "ff-gaps-invalid": at("import", "import", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyGaps[lang]); if (cp === "ff-gaps-invalid") { const g = S.ff.gap.gaps; S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[0].key, value: "12-10" }); if (g[1]) S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[1].key, value: "abc" }); S.ff = TS.freeform.apply(S.ff, "gap-submit"); } break;
      case "ff-unreadable": at("import", "import", {}); S.importMode = "freeform"; S.ff = ffAt(3, TF.F.freeform.replyUnreadable[lang]); break;
      case "import-source": at("import", "import", {}); S.importMode = "file"; break;
      case "import-review": at("import", "import", {}); S.importMode = "file"; S.imp.file = TF.buildImportDraft(TF.F.importFile[lang], t("h.import.file_name"), "file"); break;
      case "import-preview": at("import", "import", {}); S.importMode = "file"; S.imp.file = importDecided(); on("import-commit", {}); return;
      case "activation-conflict": at("recommend", "result", rafael()); compileFirst(); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": qAt("recommend", "days", partial(["desiredResult", "structuredExperience", "recentConsistency"])); S.overlay = "cancel"; S.overlayReturn = '[data-act="cancel"]'; render("#hDlgTitle"); return;
      case "activated-today": at("recommend", "result", rafael()); compileFirst(); activateNow(); return;
      default: S = blank(TF.hasActiveProgram() ? "hub" : "landing");
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md; Round 4 core) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const ADV = "[data-advance]";
  const restVal = (a) => (a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds);
  async function walk(api, a, qs, { probe = false } = {}) {
    const val = { goal: ["desiredResult", a.desiredResult], experience: ["structuredExperience", a.structuredExperience], consistency: ["recentConsistency", a.recentConsistency], days: ["daysPerWeek", a.daysPerWeek], minutes: ["sessionMinutes", a.sessionMinutes], rest: ["preferredRestSeconds", restVal(a)], environment: ["environment", a.environment && a.environment.kind] };
    for (const q of qs) {
      if (val[q]) { if (probe) await api.probe(`missing:${val[q][0]}`); await api.tap(pickKey(val[q][0], val[q][1])); }
      await api.tap(ADV);
    }
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function decideRows(api) { for (const r of draft().rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  async function addExercise(api, dayId, id) { await api.tap(`[data-build="open-picker"][data-day="${dayId}"]`); await api.type("#hPickerSearch", TF.libraryName(TF.libraryEntry(id), api.lang)); await api.tap(`[data-act="pick-exercise"][data-id="${id}"]`); }
  const journeys = {
    async "activate.recommend"(api) {
      await api.tap("#firstRunCreate"); await api.tap('[data-act="route"][data-route="recommend"]');
      await walk(api, TF.fixtureAnswers("rafael"), QLIST.recommend);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.custom"(api) {
      const a = TF.fixtureAnswers("custom");
      await api.tap('[data-act="route"][data-route="custom"]');
      await walk(api, a, ["goal", "experience", "consistency", "days", "minutes", "rest", "environment"]);
      await api.tap(pickKey("musclePriority", "chest|prioritize")); await api.tap(pickKey("musclePriority", "calves|deemphasize")); await api.tap(ADV);
      await api.type("#hPrefSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="pr_bb"][data-status="include"]');
      await api.type("#hPrefSearch", TF.libraryName(TF.libraryEntry("cu_bb"), api.lang)); await api.tap('[data-act="pref-add"][data-id="cu_bb"][data-status="avoid"]');
      await api.tap(pickKey("avoidReason", "cu_bb|dislike")); await api.tap(ADV);
      await api.tap(ADV);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.browse"(api) {
      await api.tap('[data-act="route"][data-route="browse"]');
      await api.tap(pickKey("daysPerWeek", 4)); await api.tap(ADV); await api.tap(pickKey("sessionMinutes", 60)); await api.tap(ADV); await api.tap(pickKey("environment", "commercial_gym")); await api.tap(ADV);
      await api.tap('[data-act="card"][data-id="balanced_4_v1"]');
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.build"(api) {
      await api.tap('[data-act="route"][data-route="build"]');
      await api.type("#hBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(ADV);
      for (const [dd, ids] of [["manual_d1", ["sq_bb", "pr_bb"]], ["manual_d2", ["pd_bw", "rw_bb"]], ["manual_d3", ["sq_lp"]]]) for (const id of ids) await addExercise(api, dd, id);
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.import-file"(api) { await api.tap('[data-act="import-file"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api); },
    async "activate.import-paste"(api) {
      await api.type("#hFfIn", TF.F.freeform.pasted[api.lang]); await api.tap('[data-ff="continue"]'); await api.tap('[data-ff="open"][data-provider="chatgpt"]'); await api.tap('[data-ff="clipboard"]');
      for (const g of S.ff.gap.gaps) await api.type(`[data-field="gap"][data-key="${g.key}"]`, g.field === "reps" ? "10-12" : "3");
      await api.tap('[data-ff="gap-submit"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "build.gating"(api) {
      await api.type("#hBuildName", api.t("entry.build_setup.name_placeholder")); await api.tap(pickKey("daysPerWeek", 3)); await api.tap(ADV);
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
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.discard-draft"(api) { await api.tap('[data-act="cancel"]'); api.snapshot("asked"); await api.tap('button[data-act="cancel-discard"]'); api.snapshot("discarded"); },
    async "existing.back"(api) { await api.tap('[data-act="hub-back"]'); },
    async "existing.cancel-keep"(api) { await api.tap('[data-act="route"][data-route="recommend"]'); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await api.tap('[data-act="route"][data-route="recommend"]'); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async "avoid.pain"(api) {
      await api.tap(pickKey("primaryMuscles", "chest"));
      await api.type("#hAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]'); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned"); await api.tap(ADV); api.snapshot("review");
    },
    async overlays(api) {
      for (const [g] of GROUPS[S.route]) { await api.tap(`[data-chip="${g}"]`); await api.checkOverlay('[data-act="sheet-apply"]', g); await api.tap('button[data-act="sheet-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-chip="schedule"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="sheet-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      const c = TF.F.users.rafael.correction; const base = TF.env(c.environmentKind);
      api.mark("start"); await api.tap('[data-chip="environment"]');
      await api.tap(pickKey("environment", c.environmentKind));
      for (const e of c.equipmentAdd) if (!base.equipment.includes(e)) await api.tap(pickKey("environmentEquipment", e));
      for (const k of c.capabilitiesAdd) if (!base.capabilities.includes(k)) await api.tap(pickKey("environmentCapabilities", k));
      await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await api.tap('[data-chip="priorities"]');
      await api.type("#hSAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      await walk(api, TF.fixtureAnswers("rafael"), QLIST.recommend, { probe: true });
      api.snapshot("review");
    },
    async "chooser.doors"(api) {
      for (const [job, sel] of [["recommend", '[data-act="route"][data-route="recommend"]'], ["custom", '[data-act="route"][data-route="custom"]'], ["browse", '[data-act="route"][data-route="browse"]'], ["build", '[data-act="route"][data-route="build"]'], ["import", '[data-act="route"][data-route="import"][data-mode="file"]']]) {
        await api.tap(sel); api.snapshot(`door:${job}`); await api.tap('[data-act="back"]');
      }
    },
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.h = {
    id: "h", name: "H · Concreto", policy: { productDecisions: [] },
    thesis: "Onboarding as a sequence of concrete poems: one monumental word per decision, answers placed as words on a strict grid, the program set as a poster.",
    axis: "Own visual world (Brazilian concrete poetry); no product decision reopened.",
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      document.documentElement.classList.add("h-world");
      try { await Promise.race([Promise.all(["400", "500", "600", "700", "800"].map((w) => document.fonts.load(`${w} 32px Jost`))), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fallback metrics */ }
      fresh(c.seed); TS.wire(root, on);
      root.addEventListener("click", (ev) => { if (ev.target.closest("[data-scrim]")) closeTop(); });
      root.addEventListener("toggle", (ev) => { const el = ev.target; if (el && el.tagName === "DETAILS" && el.dataset.role === "env-correction") { S.envOpen = el.open; if (el.open) el.setAttribute("data-checkpoint", "rec-env-correction"); else el.removeAttribute("data-checkpoint"); } }, true);
      document.addEventListener("keydown", onKey);
      let raf = 0; window.addEventListener("resize", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
      render();
    },
    reach,
    entry() {
      if (!S || S.view !== "route" || !S.route) return null;
      let result = S.result;
      if (S.route === "build" && S.stage === "editor" && S.build) result = TS.build.result(S.build);
      if (S.stage === "q" || S.stage === "catalogue" || S.stage === "setup" || S.stage === "import") result = null;
      return TF.jsonClean({ route: S.route, step: entryStep(), answers: answers(), result: result || null });
    },
    journeys,
    state: () => S,
  };
})();
