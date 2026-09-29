/* Candidate L · Pino (Round 4, bold directions)
   World: the selectorized weight stack. Black powder-coat plates, a steel
   selector rod, stencilled numerals, a safety-yellow selector pin as the only
   chosen-state mark, a yellow/black hazard tag for "not yours yet".

   PRODUCT DECISION REOPENED: PD-4 (a program from labelled defaults before
   the answers). Recommend opens on a program the real engine compiles from
   the first value of every column, labelled "Ainda não é seu". Every
   required answer is a pin the lifter moves; each move recompiles the
   program and states how many exercises changed. Activating defaults is
   impossible: the activation control stays aria-disabled, with a visible
   reason naming the missing answers, until all seven pins were set by the
   lifter. The defaults never enter entry().answers, a kept draft or the
   activation state, and entry().result stays null until every pin is the
   lifter's. PD-1, PD-2 and PD-3 stay closed: Start opens a chooser, and
   minutes and rest are asked like every other answer.

   Signature interaction: the pin drop. Tapping a plate slides the pin to
   it, recompiles the readout and counts the exercises that changed; the last
   pin removes the hazard tag and locks the machine into the review, where
   each answer is a pin that can be pulled, moved (live) and confirmed or
   undone. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "l.name": "L · Pino",
      "l.hub.lede_first": "Escolha por onde começar.",
      "l.hub.lede_existing": "Escolha como montar o próximo programa.",
      "l.hub.rec_line": "Um programa aparece na hora, montado com valores padrão. Você troca cada valor e o programa muda junto.",
      "l.hub.rec_ask": "Sete escolhas, uma por coluna",
      "l.hub.rec_get": "Um programa completo desde o início, que você usa quando as sete escolhas forem suas",
      "l.hub.others": "Trazer o seu programa",
      "l.hub.ask": "Você faz",
      "l.hub.get": "Você recebe",
      "l.resume.at": "{route} · {step} · salvo em {when}",
      "l.resume.discard_title": "Descartar a configuração salva?",
      "l.resume.discard_body": "As respostas salvas neste dispositivo serão apagadas. O que já está ativo não muda.",
      "l.resume.discard_confirm": "Descartar e começar de novo",
      "l.resume.discard_cancel": "Manter a configuração salva",
      "l.tag.default": "Ainda não é seu",
      "l.tag.left_one": "1 resposta no padrão",
      "l.tag.left_many": "{n} respostas no padrão",
      "l.tag.own": "Seu programa",
      "l.tag.own_all": "As {n} respostas são suas",
      "l.tag.open": "Uma resposta aberta",
      "l.tune.lede": "Montado com o primeiro valor de cada coluna. Escolha o seu em cada uma e o programa muda na hora.",
      "l.state.default": "Padrão",
      "l.state.set": "Sua escolha",
      "l.sr.default": "Ainda no padrão: {value}.",
      "l.sr.set": "Sua escolha: {value}.",
      "l.lock.one": "Falta 1 resposta: {list}.",
      "l.lock.many": "Faltam {n} respostas: {list}.",
      "l.lock.short_one": "Falta 1 resposta.",
      "l.lock.short_many": "Faltam {n} respostas.",
      "l.s.goal": "objetivo", "l.s.exp": "tempo com programas", "l.s.cons": "últimas seis semanas", "l.s.days": "dias por semana", "l.s.minutes": "duração da sessão", "l.s.rest": "descanso", "l.s.env": "onde você treina", "l.s.prio": "prioridades",
      "l.k.goal": "Objetivo", "l.k.exp": "Programas", "l.k.cons": "Últimas 6 semanas", "l.k.days": "Dias", "l.k.minutes": "Minutos", "l.k.rest": "Descanso", "l.k.env": "Local", "l.k.prio": "Prioridades",
      "l.v.goal.muscle_growth": "Ganho de massa", "l.v.goal.balanced": "Massa e força", "l.v.goal.strength": "Força",
      "l.v.cons.most": "A maior parte das sessões", "l.v.cons.about_half": "Cerca de metade", "l.v.cons.few": "Poucas sessões", "l.v.cons.none": "Sem treino recente",
      "l.v.rest.auto": "O Taurifer escolhe", "l.v.rest.60": "60 s", "l.v.rest.90": "90 s", "l.v.rest.120": "2 min", "l.v.rest.180": "3 min ou mais",
      "l.v.env.commercial_gym": "Academia completa", "l.v.env.basic_gym": "Academia básica", "l.v.env.limited_home": "Casa, pouco equipamento", "l.v.env.full_home": "Academia em casa", "l.v.env.other": "Outro lugar",
      "l.v.env_adjusted": "{env}, ajustado",
      "l.v.prio_none": "Nenhuma",
      "l.v.prio_avoid": "Evita {list}",
      "l.plate.days": "{n} dias por semana",
      "l.plate.minutes": "Até {n} minutos",
      "l.plate.minutes_90": "90 minutos ou mais",
      "l.tune.done": "Todas as respostas são suas.",
      "l.tune.lock": "Ver o programa completo",
      "l.opt.hint": "Sem escolhas aqui, o programa usa só as sete respostas acima.",
      "l.opt.limit": "Você já escolheu dois músculos. Desmarque um para trocar.",
      "l.board.title": "Suas respostas",
      "l.board.hint": "Toque em uma resposta para mudá-la. O programa é refeito na hora.",
      "l.board.aria": "Alterar {what}: {value}",
      "l.pull.confirm": "Confirmar",
      "l.pull.undo": "Desfazer a mudança",
      "l.pull.close": "Fechar sem mudar",
      "l.change.ba": "Antes {ex0} exercícios e {s0} séries, agora {ex1} e {s1}.",
      "l.new": "novo",
      "l.rev.adjusted": "O que o Taurifer ajustou",
      "l.rev.constraints": "Suas restrições",
      "l.rev.restore": "Restaurar",
      "l.rev.restore_aria": "Restaurar {exercise}",
      "l.rev.error_title": "Não foi possível montar o programa",
      "l.cancel.keep": "Salvar rascunho e sair",
      "l.mode.label": "Como trazer o programa",
      "l.mode.freeform": "Colar texto",
      "l.mode.file": "Arquivo Taurifer",
      "l.ff.s1": "Cole o programa",
      "l.ff.gaps_title": "Complete o que falta",
      "l.ff.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições. Preencha os campos abaixo.",
      "l.ff.done": "Feito",
      "l.import.file_name": "Treino do Rafael.json",
      "l.imp.facts": "{linked} vinculados · {review} para revisar · {custom} personalizados",
      "l.imp.more": "Outras opções",
      "l.prev.title": "Revisar o programa",
      "l.proof": "Depois de usar um programa, Hoje mostra a sessão do dia.",
      "l.hub.aria": "Como começar", "l.imp.suggested": "Sugerido", "l.imp.keep": "Manter o nome importado", "l.imp.choose": "Escolher na biblioteca", "l.imp.as_imported": "Como veio: {name}", "l.day.trains": "Trabalha {muscles}",
      "entry.rules_changed.rebuild": "Montar de novo com as regras atuais",
    },
    en: {
      "l.name": "L · Pin",
      "l.hub.lede_first": "Choose where to start.",
      "l.hub.lede_existing": "Choose how to set up your next program.",
      "l.hub.rec_line": "A program appears at once, built from default values. You change each value and the program changes with it.",
      "l.hub.rec_ask": "Seven choices, one per column",
      "l.hub.rec_get": "A complete program from the start, which you use once all seven choices are yours",
      "l.hub.others": "Bring your own program",
      "l.hub.ask": "You do",
      "l.hub.get": "You get",
      "l.resume.at": "{route} · {step} · saved {when}",
      "l.resume.discard_title": "Discard the saved setup?",
      "l.resume.discard_body": "The answers kept on this device will be deleted. Nothing that is already active changes.",
      "l.resume.discard_confirm": "Discard and start over",
      "l.resume.discard_cancel": "Keep the saved setup",
      "l.tag.default": "Not yours yet",
      "l.tag.left_one": "1 answer at its default",
      "l.tag.left_many": "{n} answers at their defaults",
      "l.tag.own": "Your program",
      "l.tag.own_all": "All {n} answers are yours",
      "l.tag.open": "One answer open",
      "l.tune.lede": "Built from the first value in each column. Choose yours in each one and the program changes right away.",
      "l.state.default": "Default",
      "l.state.set": "Your choice",
      "l.sr.default": "Still at the default: {value}.",
      "l.sr.set": "Your choice: {value}.",
      "l.lock.one": "1 answer left: {list}.",
      "l.lock.many": "{n} answers left: {list}.",
      "l.lock.short_one": "1 answer left.",
      "l.lock.short_many": "{n} answers left.",
      "l.s.goal": "goal", "l.s.exp": "time on programs", "l.s.cons": "past six weeks", "l.s.days": "days per week", "l.s.minutes": "session length", "l.s.rest": "rest", "l.s.env": "where you train", "l.s.prio": "priorities",
      "l.k.goal": "Goal", "l.k.exp": "Programs", "l.k.cons": "Past 6 weeks", "l.k.days": "Days", "l.k.minutes": "Minutes", "l.k.rest": "Rest", "l.k.env": "Place", "l.k.prio": "Priorities",
      "l.v.goal.muscle_growth": "Muscle growth", "l.v.goal.balanced": "Muscle and strength", "l.v.goal.strength": "Strength",
      "l.v.cons.most": "Nearly every session", "l.v.cons.about_half": "About half", "l.v.cons.few": "A few sessions", "l.v.cons.none": "No recent training",
      "l.v.rest.auto": "Taurifer chooses", "l.v.rest.60": "60 s", "l.v.rest.90": "90 s", "l.v.rest.120": "2 min", "l.v.rest.180": "3 min or more",
      "l.v.env.commercial_gym": "Full gym", "l.v.env.basic_gym": "Basic gym", "l.v.env.limited_home": "Home, little equipment", "l.v.env.full_home": "Home gym", "l.v.env.other": "Another place",
      "l.v.env_adjusted": "{env}, adjusted",
      "l.v.prio_none": "None",
      "l.v.prio_avoid": "Avoids {list}",
      "l.plate.days": "{n} days a week",
      "l.plate.minutes": "Up to {n} minutes",
      "l.plate.minutes_90": "90 minutes or more",
      "l.tune.done": "Every answer is yours.",
      "l.tune.lock": "See the full program",
      "l.opt.hint": "With nothing chosen here, the program uses only the seven answers above.",
      "l.opt.limit": "You already chose two muscles. Clear one to switch.",
      "l.board.title": "Your answers",
      "l.board.hint": "Tap an answer to change it. The program is rebuilt right away.",
      "l.board.aria": "Change {what}: {value}",
      "l.pull.confirm": "Confirm",
      "l.pull.undo": "Undo the change",
      "l.pull.close": "Close without changes",
      "l.change.ba": "Before {ex0} exercises and {s0} sets, now {ex1} and {s1}.",
      "l.new": "new",
      "l.rev.adjusted": "What Taurifer adjusted",
      "l.rev.constraints": "Your constraints",
      "l.rev.restore": "Restore",
      "l.rev.restore_aria": "Restore {exercise}",
      "l.rev.error_title": "The program could not be built",
      "l.cancel.keep": "Save draft and leave",
      "l.mode.label": "How to bring the program",
      "l.mode.freeform": "Paste text",
      "l.mode.file": "Taurifer file",
      "l.ff.s1": "Paste the program",
      "l.ff.gaps_title": "Fill in what is missing",
      "l.ff.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing. Fill in the fields below.",
      "l.ff.done": "Done",
      "l.import.file_name": "Rafael's program.json",
      "l.imp.facts": "{linked} linked · {review} to review · {custom} custom",
      "l.imp.more": "Other options",
      "l.prev.title": "Review the program",
      "l.proof": "Once a program is in use, Today shows the session of the day.",
      "l.hub.aria": "How to start", "l.imp.suggested": "Suggested", "l.imp.keep": "Keep the imported name", "l.imp.choose": "Choose from the library", "l.imp.as_imported": "As imported: {name}", "l.day.trains": "Trains {muscles}",
      "entry.rules_changed.rebuild": "Rebuild with current rules",
    },
  };

  /* ---------- the seven pins ---------- */
  /* Every column is ordered so its first plate is the lightest commitment
     (first program, no recent training, 2 days, 30 minutes); the default is
     always the first plate. */
  const PINS = [
    { id: "goal", key: "desiredResult", step: "desired_result", values: TS.DESIRED, q: "entry.desired_result.title" },
    { id: "exp", key: "structuredExperience", step: "background", values: TS.EXPERIENCE, q: "entry.background.experience.label" },
    { id: "cons", key: "recentConsistency", step: "background", values: ["none", "few", "about_half", "most"], q: "entry.background.consistency.label" },
    { id: "days", key: "daysPerWeek", step: "schedule", values: TS.DAYS, q: "entry.schedule.days.label", num: true },
    { id: "minutes", key: "sessionMinutes", step: "schedule", values: TS.MINUTES, q: "entry.schedule.minutes.label", num: true },
    { id: "rest", key: "preferredRestSeconds", step: "schedule", values: TS.REST, q: "entry.schedule.rest.label" },
    { id: "env", key: "environment", step: "environment", values: TS.ENVS, q: "entry.environment.title" },
  ];
  const PIN = Object.fromEntries(PINS.map((p) => [p.id, p]));
  const STATIONS = ["desired_result", "background", "schedule", "environment", "priorities"];
  const PRIO_KEYS = new Set(["primaryMuscles", "priorityMovements", "clearPriorities", "avoidReason"]);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const J = (v) => JSON.stringify(v);

  let t, lang, root, S, flipOff = false;
  const reducedMotion = () => document.documentElement.dataset.motion === "reduced" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const compact = () => document.documentElement.style.fontSize === "200%" || window.innerWidth < 360;

  /* ---------- icons (one 24-unit grid, 2-unit stroke) ---------- */
  const svg = (d, cls = "") => `<svg class="l-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const I = {
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    next: svg('<path d="M5 12h13M13 6l6 6-6 6"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    open: svg('<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    arrow: svg('<path d="M4 12h15M14 7l5 5-5 5"/>'),
    paste: svg('<rect x="6" y="4" width="12" height="17" rx="1.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>'),
    file: svg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h5M10 17h5"/>'),
    ext: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/>'),
    search: svg('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    stack: svg('<path d="M5 5h14M5 10h14M5 15h14M5 20h14"/>'),
  };

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, mode: "tune", station: "desired_result", answers: {}, live: null, liveKey: null, change: null, pull: null, envOpen: false, prioOpen: false, avoid: { query: "", pending: null }, notice: null, actError: null, overlay: null, toast: null, cpTag: null, justLocked: false, revAtStart: TF.liveRevision(), stash: S ? S.stash : null,
      importMode: "freeform", ff: TS.freeform.create(), importDraft: null, importKept: null, importHeld: null, picker: null, result: null, step: null };
  }
  function fresh(seed) { S = null; TF.seedDevice(seed || "fresh"); S = blank(TF.hasActiveProgram() ? "today" : "landing"); }
  const isSet = (p) => has(S.answers, p.key);
  const allSet = () => PINS.every(isSet);
  const missing = () => PINS.filter((p) => !isSet(p));
  function defaults() { return { desiredResult: PIN.goal.values[0], structuredExperience: PIN.exp.values[0], recentConsistency: PIN.cons.values[0], daysPerWeek: PIN.days.values[0], sessionMinutes: PIN.minutes.values[0], preferredRestSeconds: null, environment: TF.env(PIN.env.values[0]) }; }
  const effective = () => TF.normalizeAnswers(Object.assign(defaults(), clone(S.answers)));
  /* The value a pin shows (the lifter's or the default), as its plate value. */
  function pinVal(p, a = null) {
    const src = a || (isSet(p) ? S.answers : defaults());
    if (p.id === "rest") return src.preferredRestSeconds === null || src.preferredRestSeconds === undefined ? "auto" : src.preferredRestSeconds;
    if (p.id === "env") return src.environment ? src.environment.kind : PIN.env.values[0];
    return src[p.key];
  }
  function relive() {
    const a = effective(); const key = J(a);
    if (S.liveKey === key && S.live) return;
    const r = TF.compile("recommend", a);
    S.live = r.ok ? { ok: true, result: TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation }) } : { ok: false, text: TS.issueText(t, r) };
    S.liveKey = key;
  }
  const livePreview = () => (S.live && S.live.ok ? S.live.result.preview : null);
  const progName = () => (S.route === "import" ? (S.result ? S.result.name : "") : S.live && S.live.ok ? TF.resultName(S.live.result, lang) : t("untitled_program"));
  const entryStep = () => (S.view !== "machine" && S.view !== "import" ? null : S.route === "import" ? (S.step === "preview" ? "preview" : "import_source") : S.mode === "review" ? "result" : S.station);
  const valueLabel = (p, v) => {
    if (p.id === "goal") return t(`entry.desired_result.${v}.label`);
    if (p.id === "exp") return t(`entry.background.experience.${v}`);
    if (p.id === "cons") return t(`entry.background.consistency.${v}`);
    if (p.id === "days") return t("l.plate.days", { n: v });
    if (p.id === "minutes") return v >= 90 ? t("l.plate.minutes_90") : t("l.plate.minutes", { n: v });
    if (p.id === "rest") return t(`entry.schedule.rest.${v}`);
    return t(`entry.environment.${v}`);
  };
  const sameList = (x, y) => J([...(x || [])].sort()) === J([...(y || [])].sort());
  function tileValue(p) {
    const v = pinVal(p);
    if (p.id === "goal") return t(`l.v.goal.${v}`);
    if (p.id === "exp") return t(`entry.background.experience.${v}`);
    if (p.id === "cons") return t(`l.v.cons.${v}`);
    if (p.id === "days" ) return String(v);
    if (p.id === "minutes") return v >= 90 ? "90+" : String(v);
    if (p.id === "rest") return t(`l.v.rest.${v}`);
    const e = S.answers.environment || TF.env(v); const base = TF.env(e.kind);
    const label = t(`l.v.env.${e.kind}`);
    return sameList(base.equipment, e.equipment) && sameList(base.capabilities, e.capabilities) ? label : t("l.v.env_adjusted", { env: label });
  }
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };
  function prioValue() {
    const a = TF.normalizeAnswers(S.answers);
    const pr = TS.priorityLabel(t, lang, a, false);
    const av = (a.exerciseConstraints || []).map((c) => exLabel(c.exerciseId));
    return [pr, av.length ? t("l.v.prio_avoid", { list: av.join(", ") }) : ""].filter(Boolean).join(" · ") || t("l.v.prio_none");
  }

  /* ---------- small builders ---------- */
  const factsList = (p) => { const f = TF.previewFacts(p); return [["days", t("entry.catalogue.days_badge", { days: (p.days || []).length })], ["time", TF.durationLabel(t, p)], ["ex", t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") })], ["sets", t("entry.preview.sets", { n: f.sets })]].filter((x) => x[1]); };
  function factsHtml(p, id = "lFacts") {
    const prev = S._facts || {}; const next = {};
    const out = factsList(p).map(([k, v]) => { next[k] = v; const changed = prev[k] !== undefined && prev[k] !== v; return `<span class="l-fact${changed ? " is-changed" : ""}" data-fact="${k}">${esc(v)}</span>`; }).join("");
    S._factsNext = next;
    return `<p class="l-facts" id="${id}"><span class="l-facts__in">${out}</span></p>`;
  }
  function addedIds(before, after) {
    if (!before || !after) return new Set();
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    return added.size < (after.program || []).length ? added : new Set();
  }
  function statement(from, to, id = "lChange") {
    const d = TF.identityDiff(from, to); const fb = TF.previewFacts(from), fa = TF.previewFacts(to);
    const ba = fb.exercises === fa.exercises && fb.sets === fa.sets ? "" : `<p class="l-change__ba">${esc(t("l.change.ba", { ex0: fb.exercises, s0: fb.sets, ex1: fa.exercises, s1: fa.sets }))}</p>`;
    return `<div class="l-change" id="${id}" tabindex="-1" role="status" aria-live="polite" data-change-statement data-changed="${d.n}" data-total="${d.total}"><p class="l-change__line"><span class="l-change__pin" aria-hidden="true"></span>${esc(TS.changeText(t, d))}</p>${ba}</div>`;
  }
  function days(preview, { added = new Set(), openAll = false, openFirst = true } = {}) {
    const list = preview.days || [];
    return `<div class="l-days">${list.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((n, e) => n + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const open = openAll || (openFirst && i === 0) || (openFirst && ex.some((e) => added.has(e.id)));
      const nNew = ex.filter((e) => added.has(e.id)).length;
      const prog = (preview.program || []).filter((e) => (d.dayId && e.dayId === d.dayId) || e.day === d.label);
      const muscles = [...new Set(prog.flatMap((e) => TF.muscleLabels(t, e.primary)))];
      return `<details class="l-day"${open ? " open" : ""}><summary class="l-day__sum"><span class="l-day__n" aria-hidden="true">${i + 1}</span><span class="l-day__body"><span class="l-day__name">${esc(TF.dayName(t, d, preview.programStructure, i))}</span>${muscles.length ? `<span class="l-day__trains">${esc(t("l.day.trains", { muscles: muscles.join(", ").toLowerCase() }))}</span>` : ""}<span class="l-day__meta">${esc(meta)}${nNew && !open ? ` <span class="l-new">${esc(t("l.new"))} ${nNew}</span>` : ""}</span></span><span class="l-chev" aria-hidden="true"></span></summary>
        <ul class="l-exlist">${ex.length ? ex.map((e) => { const isNew = added.has(e.id); return `<li class="l-ex${isNew ? " is-new" : ""}"><span class="l-ex__name">${esc(TS.exName(e, lang))}${isNew ? ` <span class="l-new">${esc(t("l.new"))}</span>` : ""}</span><span class="l-ex__rx">${e.sets != null ? `${e.sets} × ${e.min}–${e.max}` : ""}</span></li>`; }).join("") : `<li class="l-ex l-ex--empty">${esc(t("program.empty.exercises"))}</li>`}</ul></details>`;
    }).join("")}</div>`;
  }
  const PIN_PATH = "M20 11a9 9 0 1 1 0 18a9 9 0 1 1 0-18M29 20h11";
  const knob = (id, kind) => `<span class="l-knob l-knob--${kind}" data-knob="${esc(id)}" aria-hidden="true"><svg class="l-knob__svg" viewBox="0 0 40 40" focusable="false"><path d="${PIN_PATH}"/></svg></span>`;
  const hole = (inner = "", cls = "") => `<span class="l-hole ${cls}" aria-hidden="true">${inner}</span>`;
  const plateNo = (n) => `<span class="l-no" aria-hidden="true">${n}</span>`;

  /* One column of plates: the lifter's selector. */
  function stack(p, a, { ctx = "tune" } = {}) {
    const set = has(a, p.key); const cur = pinVal(p, set ? a : null); const def = p.values[0];
    const hid = `${ctx}-${p.id}`;
    const state = set ? t("l.state.set") : t("l.state.default");
    const plates = p.values.map((v) => {
      const pinned = String(cur) === String(v); const chosen = set && pinned;
      const label = p.num ? (p.id === "minutes" && v === 90 ? "90+" : String(v)) : p.id === "goal" ? t(`entry.desired_result.${v}.label`) : valueLabel(p, v);
      const sub = p.id === "goal" ? `<span class="l-plate__sub">${esc(t(`entry.desired_result.${v}.sub`))}</span>` : "";
      const aria = p.num ? ` aria-label="${esc(valueLabel(p, v))}"` : "";
      return `<button type="button" class="l-plate${pinned ? " is-pinned" : ""}${chosen ? " is-chosen" : ""}${!set && v === def ? " is-default" : ""}" role="radio" aria-checked="${chosen ? "true" : "false"}" data-act="pick" data-key="${p.key}" data-val="${esc(v)}"${aria}>
        ${p.num ? "" : plateNo(p.values.indexOf(v) + 1)}<span class="l-plate__body"><span class="l-plate__v">${esc(label)}</span>${sub}</span>
        ${!set && v === def ? `<span class="l-plate__def" aria-hidden="true">${esc(t("l.state.default"))}</span>` : ""}
        <span class="l-hole" aria-hidden="true">${pinned ? knob(`${ctx}-${p.id}`, set ? "set" : "ghost") : ""}</span></button>`;
    }).join("");
    return `<section class="l-stack${p.num ? " l-stack--num" : ""}${set ? " is-set" : ""}" data-pin="${p.id}" aria-labelledby="${hid}">
      <div class="l-stack__head"><h2 class="l-stack__q" id="${hid}">${esc(t(p.q))}</h2><span class="l-state${set ? " is-set" : ""}">${set ? I.check : ""}${esc(state)}</span></div>
      <div class="l-plates" role="radiogroup" aria-labelledby="${hid}" aria-describedby="${hid}-sr">${plates}</div>
      <p class="visually-hidden" id="${hid}-sr">${esc(t(set ? "l.sr.set" : "l.sr.default", { value: valueLabel(p, cur) }))}</p>
      ${S.change && S.change.at === p.id && livePreview() ? statement(S.change.from, livePreview()) : ""}</section>`;
  }
  function toggle(key, val, label, on, { disabled = false, role = "checkbox" } = {}) {
    return `<button type="button" class="l-toggle${on ? " is-on" : ""}" role="${role}" aria-checked="${on ? "true" : "false"}" data-act="pick" data-key="${key}" data-val="${esc(val)}"${disabled ? " disabled" : ""}><span class="l-toggle__box" aria-hidden="true">${on ? I.check : ""}</span><span class="l-toggle__t">${esc(label)}</span></button>`;
  }
  function correction(env, { open, inline }) {
    if (!env) return "";
    const eq = new Set(env.equipment || []), caps = new Set(env.capabilities || []);
    const body = `<div class="l-corr"${open ? ' data-checkpoint="rec-env-correction"' : ""}>
      <h3 class="l-sub" id="lEq${inline ? "P" : "T"}">${esc(t("entry.env_correct.equipment"))}</h3>
      <div class="l-toggles" role="group" aria-labelledby="lEq${inline ? "P" : "T"}">${TS.EQUIP.map((k) => toggle("environmentEquipment", k, t(`entry.equip.${k}`, undefined, k), eq.has(k))).join("")}</div>
      <h3 class="l-sub" id="lCap${inline ? "P" : "T"}">${esc(t("entry.env_correct.capabilities"))}</h3>
      <div class="l-toggles l-toggles--wide" role="group" aria-labelledby="lCap${inline ? "P" : "T"}">${TS.CAPS.map((k) => toggle("environmentCapabilities", k, t(`entry.cap.${k}`, undefined, k), caps.has(k))).join("")}</div>
      <p class="l-note">${esc(t("entry.env_correct.note"))}</p></div>`;
    if (inline) return body;
    return `<details class="l-disc" data-role="env-correction"${open ? " open" : ""}><summary class="l-disc__sum"><span>${esc(t("entry.env_correct.summary"))}</span><span class="l-chev" aria-hidden="true"></span></summary>${body}</details>`;
  }
  function reasonBlock(id, reason, pending) {
    const name = exLabel(id);
    return `<div class="l-reason" role="group" aria-label="${esc(t("entry.priorities.avoid_reason", { exercise: name }))}">
      <div class="l-reason__top"><strong class="l-reason__name">${esc(name)}</strong><button type="button" class="l-btn l-btn--quiet l-btn--sm" data-act="avoid-remove" data-id="${esc(id)}">${esc(t("entry.priorities.avoid_remove"))}</button></div>
      <p class="l-sub">${esc(t("entry.priorities.avoid_reason", { exercise: name }))}</p>
      <div class="l-toggles" role="radiogroup">${TS.REASONS.map((r) => toggle("avoidReason", `${id}|${r}`, t(`entry.priorities.reason.${r}`), reason === r, { role: "radio" })).join("")}</div>
      ${pending ? `<p class="l-note" id="pendingAvoidNote">${esc(t("entry.priorities.reason_required"))}</p>` : ""}</div>`;
  }
  function priorities(a, st, { searchId }) {
    const prim = a.primaryMuscles || [];
    const taken = new Set([...(a.exerciseConstraints || []).map((c) => c.exerciseId)]); if (st.pending) taken.add(st.pending);
    const matches = TF.searchLibrary(st.query, lang, { exclude: taken, limit: 6 });
    const pain = (a.exerciseConstraints || []).some((c) => c.reason === "pain");
    return `<div class="l-prio">
      <h3 class="l-sub" id="${searchId}Prim">${esc(t("entry.priorities.primary"))}</h3>
      <div class="l-toggles" role="group" aria-labelledby="${searchId}Prim">${toggle("clearPriorities", "1", t("entry.priorities.none"), prim.length === 0, { role: "radio" })}${TS.MUSCLES.map((m) => toggle("primaryMuscles", m, t(`entry.muscle.${m}`), prim.includes(m), { disabled: prim.length >= 2 && !prim.includes(m) })).join("")}</div>
      <p class="l-note">${esc(t(prim.length >= 2 ? "l.opt.limit" : "entry.priorities.lede"))}</p>
      <h3 class="l-sub" id="${searchId}Mov">${esc(t("entry.priorities.movements"))}</h3>
      <div class="l-toggles" role="group" aria-labelledby="${searchId}Mov">${TS.MOVEMENTS.map((m) => toggle("priorityMovements", m, t(`entry.movement.${m}`), (a.priorityMovements || []).includes(m))).join("")}</div>
      <h3 class="l-sub">${esc(t("entry.priorities.avoid"))}</h3>
      <label class="l-field l-field--search"><span class="l-field__label">${esc(t("entry.priorities.avoid_search"))}</span><span class="l-field__row">${I.search}<input id="${searchId}" type="search" autocomplete="off" data-field="avoidQuery" value="${esc(st.query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></span></label>
      ${matches.length ? `<div class="l-results" role="listbox" aria-label="${esc(t("entry.priorities.avoid_search"))}">${matches.map((e) => `<button type="button" class="l-result" role="option" data-act="avoid-add" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span>${I.plus}</button>`).join("")}</div>` : ""}
      ${st.pending ? reasonBlock(st.pending, null, true) : ""}${(a.exerciseConstraints || []).map((c) => reasonBlock(c.exerciseId, c.reason, false)).join("")}
      ${pain ? `<p class="l-caution" role="note">${esc(t("entry.priorities.pain_note"))}</p>` : ""}</div>`;
  }

  /* ---------- views ---------- */
  const brandMark = () => `<span class="l-mark"><img src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="40" height="40"></span>`;
  function landingView() {
    return `<main class="l-land" data-checkpoint="landing">
      <div class="l-land__panel">
        <header class="l-brand">${brandMark()}<span class="l-brand__word">Taurifer</span><span class="l-grow"></span>${TS.privacyButton(t, { cls: "l-link l-link--onCoat" })}</header>
        <h1 class="l-land__head" data-focus>${esc(t("landing.headline"))}</h1>
        <p class="l-land__lede">${esc(t("landing.body"))}</p>
        <div class="l-land__stack">
          <button type="button" id="firstRunCreate" class="l-bigplate l-bigplate--yellow" data-act="land-create">${plateNo(1)}<span class="l-bigplate__t">${esc(t("landing.build"))}</span><span class="l-hole" aria-hidden="true">${knob("land", "steel")}</span></button>
          <button type="button" id="firstRunImport" class="l-bigplate" data-act="land-import">${plateNo(2)}<span class="l-bigplate__t">${esc(t("landing.track"))}</span><span class="l-hole" aria-hidden="true"></span></button>
        </div>
      </div>
      <div class="l-land__proof"><div class="l-proofplate">${TS.landingProof(t, lang)}<p class="l-proofplate__cap">${esc(t("l.proof"))}</p></div>
      <p class="l-land__privacy">${esc(t("x.privacy.line"))}</p></div></main>`;
  }
  /* The chooser is a stack: every route is a plate on one rod, and the pin
     drops into the plate the lifter taps before the route opens. */
  const HUB_PLATES = [
    { route: "recommend", mode: "", title: "entry.hub.recommend.title", line: "l.hub.rec_line", ask: "l.hub.rec_ask", get: "l.hub.rec_get" },
    { route: "import", mode: "freeform", title: "entry.hub.freeform.title", line: null, ask: "x.cost.paste", get: "x.get.import" },
    { route: "import", mode: "file", title: "entry.hub.import.title", line: null, ask: "x.cost.file", get: "x.get.import" },
  ];
  function hubStack() {
    const chosen = S.hubPick;
    return `<div class="l-cstack" role="group" aria-label="${esc(t("l.hub.aria"))}">${HUB_PLATES.map((d, i) => {
      const key = d.route + (d.mode ? ":" + d.mode : ""); const here = chosen ? chosen === key : i === 0;
      return `<button type="button" class="l-cplate${i === 0 ? " l-cplate--lead" : ""}${chosen === key ? " is-chosen" : ""}" data-act="route" data-route="${d.route}"${d.mode ? ` data-mode="${d.mode}"` : ""}>${plateNo(i + 1)}<span class="l-cplate__body"><span class="l-cplate__t">${esc(t(d.title))}</span>${d.line ? `<span class="l-cplate__line">${esc(t(d.line))}</span>` : ""}<span class="l-cplate__l"><span class="l-cplate__k">${esc(t("l.hub.ask"))}</span> ${esc(t(d.ask))}</span><span class="l-cplate__l"><span class="l-cplate__k">${esc(t("l.hub.get"))}</span> ${esc(t(d.get))}</span></span>${hole(here ? knob("hub", chosen ? "set" : "steel") : "")}</button>`;
    }).join("")}</div>`;
  }
  function recoveryCard() {
    const info = TF.loadDraft(); if (!info || info.status === "corrupt") return "";
    if (info.status === "rules_changed") return `<div class="l-notice l-notice--warn" role="status" data-checkpoint="rules-changed"><p class="l-notice__t">${esc(t("entry.rules_changed.title"))}</p><p>${esc(t("entry.rules_changed.body_rebuild"))}</p><button type="button" class="l-btn l-btn--coat" data-act="rules-rebuild">${esc(t("entry.rules_changed.rebuild"))}</button></div>`;
    const f = TS.resumeFacts(t, lang, info);
    return `<section class="l-resume" data-checkpoint="resume" aria-labelledby="lResumeT"><h2 class="l-h2" id="lResumeT">${esc(t("entry.resume.title"))}</h2><p class="l-body">${esc(t("entry.resume.body"))}</p><p class="l-facts"><span class="l-fact">${esc(t("l.resume.at", { route: f.route, step: f.step, when: f.when }))}</span></p>
      <div class="l-acts"><button type="button" class="l-btn l-btn--yellow" id="lResume" data-act="resume">${esc(t("entry.resume.continue"))}</button><button type="button" class="l-btn l-btn--quiet l-btn--danger" id="lResumeRestart" data-act="resume-restart" aria-haspopup="dialog">${esc(t("entry.resume.restart"))}</button></div></section>`;
  }
  function hubView() {
    const active = TF.hasActiveProgram();
    return `<div class="l-page">${header({ back: "hub-back" })}
      <main class="l-main" data-checkpoint="${active ? "hub-existing" : "route-choice"}">
        <h1 class="l-title" data-focus>${esc(t("entry.hub.title"))}</h1><p class="l-lede">${esc(t(active ? "l.hub.lede_existing" : "l.hub.lede_first"))}</p>
        ${active ? `<p class="l-notice" role="status">${esc(t("entry.active_notice"))}</p>` : ""}
        ${recoveryCard()}
        ${hubStack()}
      </main>${overlayView()}</div>`;
  }
  function header({ back = "back", cancel = false } = {}) {
    return `<header class="l-head"><button type="button" class="l-headbtn" data-act="${back}">${I.back}<span>${esc(t("entry.back"))}</span></button>${cancel ? `<button type="button" class="l-headbtn l-headbtn--end" data-act="cancel">${esc(t("entry.cancel"))}</button>` : ""}</header>`;
  }
  function tag() {
    if (S.pull) return `<p class="l-tag l-tag--open"><span class="l-tag__mark" aria-hidden="true">${I.open}</span><span class="l-tag__t">${esc(t("l.tag.open"))}</span></p>`;
    const m = missing().length;
    if (!m) return `<p class="l-tag l-tag--own"><span class="l-tag__mark" aria-hidden="true">${I.check}</span><span class="l-tag__t"><strong>${esc(t("l.tag.own"))}</strong> · ${esc(t("l.tag.own_all", { n: PINS.length }))}</span></p>`;
    return `<p class="l-tag l-tag--hazard"><span class="l-tag__stripe" aria-hidden="true"></span><span class="l-tag__t"><strong>${esc(t("l.tag.default"))}</strong> · ${esc(m === 1 ? t("l.tag.left_one") : t("l.tag.left_many", { n: m }))}</span></p>`;
  }
  function readout() {
    if (!S.live || !S.live.ok) return `<section class="l-readout"><h1 class="l-name" data-focus>${esc(t("l.rev.error_title"))}</h1><p class="l-caution" role="alert">${esc((S.live && S.live.text) || t("x.issue.compile"))}</p></section>`;
    const p = S.live.result.preview;
    const added = S.change && S.change.at !== "pull" ? addedIds(S.change.from, p) : new Set();
    const stmt = S.change && S.change.at === "top" ? statement(S.change.from, p) : "";
    return `<section class="l-readout${S.justLocked ? " is-locking" : ""}" aria-labelledby="lName">
      <h1 class="l-name" id="lName" data-focus tabindex="-1">${esc(progName())}</h1>${tag()}
      ${factsHtml(p)}${stmt}${S.notice === "conflict" ? `<div id="lConflict" tabindex="-1" class="l-conflict" role="alert" data-checkpoint="activation-conflict"><p class="l-notice__t">${esc(t("entry.conflict.title"))}</p><p>${esc(t("entry.conflict.body"))}</p><button type="button" class="l-btn l-btn--yellow" data-act="conflict-review">${esc(t("entry.conflict.review"))}</button></div>` : ""}
      ${days(p, { added })}</section>`;
  }
  function tuneBody() {
    const a = S.answers; const out = [];
    out.push(`<p class="l-lede l-lede--tune">${esc(t("l.tune.lede"))}</p>`);
    const pair = (x, y) => `<div class="l-pair">${stack(PIN[x], a)}${stack(PIN[y], a)}</div>`;
    out.push(stack(PIN.goal, a));
    out.push(stack(PIN.exp, a), stack(PIN.cons, a));
    out.push(compact() ? stack(PIN.days, a) + stack(PIN.minutes, a) : pair("days", "minutes"));
    out.push(stack(PIN.rest, a));
    out.push(stack(PIN.env, a) + (isSet(PIN.env) ? correction(a.environment, { open: S.envOpen, inline: false }) : ""));
    out.push(`<details class="l-disc l-disc--opt" id="lOpt"${S.prioOpen ? " open" : ""}><summary class="l-disc__sum"><span><span class="l-disc__t">${esc(t("entry.priorities.title"))}</span><span class="l-disc__v">${esc(t("entry.optional"))} · ${esc(prioValue())}</span></span><span class="l-chev" aria-hidden="true"></span></summary>
      <p class="l-note">${esc(t("l.opt.hint"))}</p>${priorities(TF.normalizeAnswers(a), S.avoid, { searchId: "avoidSearch" })}${S.change && S.change.at === "prio" && livePreview() ? statement(S.change.from, livePreview()) : ""}</details>`);
    if (allSet()) out.push(`<div class="l-done"><p class="l-done__t">${I.check}${esc(t("l.tune.done"))}</p><button type="button" class="l-btn l-btn--coat" data-act="lock">${esc(t("l.tune.lock"))}</button></div>`);
    return out.join("");
  }
  const TILE_WHAT = { goal: "l.s.goal", exp: "l.s.exp", cons: "l.s.cons", days: "l.s.days", minutes: "l.s.minutes", rest: "l.s.rest", env: "l.s.env", prio: "l.s.prio" };
  function pulledPanel() {
    const pl = S.pull; const a = S.answers;
    const changed = J(TF.normalizeAnswers(a)) !== J(TF.normalizeAnswers(pl.answers));
    let body;
    if (pl.pin === "prio") body = priorities(TF.normalizeAnswers(a), pl.avoid, { searchId: "lPullAvoid" });
    else body = stack(PIN[pl.pin], a, { ctx: "pull" }) + (pl.pin === "env" ? correction(a.environment, { open: true, inline: true }) : "");
    const pending = pl.avoid && pl.avoid.pending;
    const stmt = S.change && S.change.at === "pull" && livePreview() ? statement(S.change.from, livePreview()) : "";
    return `<div class="l-pull" id="lPull" role="group" aria-labelledby="lPullT"><h3 class="l-pull__t" id="lPullT" tabindex="-1">${esc(t("l.board.aria", { what: t(TILE_WHAT[pl.pin]), value: pl.pin === "prio" ? prioValue() : tileValue(PIN[pl.pin]) }))}</h3>
      ${pl.pin === "prio" ? `<p class="l-note">${esc(t("l.opt.hint"))}</p>` : ""}${body}${stmt}
      <div class="l-acts l-pull__acts"><button type="button" class="l-btn l-btn--yellow" data-act="pull-confirm"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(t("l.pull.confirm"))}</button><button type="button" class="l-btn l-btn--quiet" data-act="pull-close">${esc(t(changed ? "l.pull.undo" : "l.pull.close"))}</button></div></div>`;
  }
  function board() {
    const tiles = [...PINS.map((p) => ({ id: p.id, k: t(`l.k.${p.id}`), v: tileValue(p), wide: p.id === "env" })), { id: "prio", k: t("l.k.prio"), v: prioValue(), opt: true }];
    return `<section class="l-board" aria-labelledby="lBoardT"><h2 class="l-h2" id="lBoardT">${esc(t("l.board.title"))}</h2><p class="l-note">${esc(t("l.board.hint"))}</p>
      <div class="l-tiles${S.justLocked ? " is-locking" : ""}">${tiles.map((x, i) => {
        const open = S.pull && S.pull.pin === x.id;
        return `<button type="button" class="l-tile${open ? " is-open" : ""}${x.opt ? " l-tile--opt" : ""}${x.wide ? " l-tile--wide" : ""}" style="--i:${i}" data-act="pull" data-pin="${x.id}" aria-expanded="${open ? "true" : "false"}"${open ? ' aria-controls="lPull"' : ""} aria-label="${esc(t("l.board.aria", { what: t(TILE_WHAT[x.id]), value: x.v }))}"><span class="l-tile__k">${esc(x.k)}</span><span class="l-tile__v">${esc(x.v)}</span>${x.opt ? "" : `<span class="l-tile__pin" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="${PIN_PATH}"/></svg></span>`}</button>${open ? pulledPanel() : ""}`;
      }).join("")}</div></section>`;
  }
  function reviewBody() {
    if (!S.live || !S.live.ok) return "";
    const r = S.live.result, a = TF.normalizeAnswers(S.answers);
    let out = board();
    const eqText = [...new Set((a.environment && a.environment.equipment) || [])].map((k) => { const l = t(`entry.equip.${k}`, undefined, k); return /^Smith/.test(l) ? l : l.toLowerCase(); }).join(", ");
    const reasons = TS.reasons(t, lang, r, a, {}).map((x) => (x.key === "equipment" ? { ...x, text: t("entry.result.why_equipment", { equipment: eqText }) } : x));
    out += `<section class="l-sec" aria-labelledby="lWhy"><h2 class="l-h2" id="lWhy">${esc(t("entry.result.why"))}</h2><ul class="l-list">${reasons.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul><p class="l-note">${esc(t("entry.result.lede"))}</p></section>`;
    const adj = TS.adjustments(t, r.preview);
    if (adj.length) out += `<section class="l-sec" aria-labelledby="lAdj"><h2 class="l-h2" id="lAdj">${esc(t("l.rev.adjusted"))}</h2><ul class="l-list">${adj.map((x) => `<li>${esc(x.text)}</li>`).join("")}</ul></section>`;
    const cons = TS.constraintLines(t, lang, a);
    if (cons.length) out += `<section class="l-sec" aria-labelledby="lCons"><h2 class="l-h2" id="lCons">${esc(t("l.rev.constraints"))}</h2><ul class="l-list">${cons.map((x) => `<li class="l-list__row"><span>${esc(x.text)}</span>${x.kind === "avoid" ? `<button type="button" class="l-btn l-btn--quiet l-btn--sm" data-act="restore" data-id="${esc(x.id)}" aria-label="${esc(t("l.rev.restore_aria", { exercise: exLabel(x.id) }))}">${esc(t("l.rev.restore"))}</button>` : ""}</li>`).join("")}</ul></section>`;
    if (TF.progressionIssue(r.preview)) out += `<p class="l-caution" id="lBlocked" role="alert">${esc(t("entry.preview.activation_blocked"))}</p>`;
    if (S.actError) out += `<p class="l-caution" id="lActError" tabindex="-1" role="alert">${esc(S.actError)}</p>`;
    out += `<div class="l-tail"><button type="button" class="l-btn l-btn--quiet l-btn--danger" id="lRestart" data-act="restart" aria-haspopup="dialog">${esc(t("entry.preview.restart"))}</button></div>`;
    return out;
  }
  function footer() {
    if (S.pull) return "";
    const route = S.route; const active = TF.hasActiveProgram();
    const label = active ? t("entry.preview.activate_replace") : t("entry.preview.activate_first");
    let reason = "", blocked = false, reasonId = "lLock";
    if (route === "recommend") {
      const m = missing();
      if (m.length) { blocked = true; const list = m.map((p) => t(`l.s.${p.id}`)).join(", "); reason = compact() || m.length > 3 ? t(m.length === 1 ? "l.lock.short_one" : "l.lock.short_many", { n: m.length }) : t(m.length === 1 ? "l.lock.one" : "l.lock.many", { n: m.length, list }); }
      else if (S.live && S.live.ok && TF.progressionIssue(S.live.result.preview)) { blocked = true; reasonId = "lBlocked"; }
      else if (!S.live || !S.live.ok) { blocked = true; reason = t("x.issue.compile"); }
    }
    if (S.notice === "conflict") { blocked = true; reasonId = "lConflict"; reason = ""; }
    const cp = (route === "recommend" && S.mode === "review") || (route === "import" && S.step === "preview") ? ' data-checkpoint="activate"' : "";
    return `<footer class="l-foot" data-persistent-action${cp}>${reason ? `<p class="l-foot__why" id="lLock">${I.lock}<span>${esc(reason)}</span></p>` : ""}<button type="button" class="l-go${blocked ? " is-locked" : ""}" id="lActivate" data-activate data-act="activate"${blocked ? ` aria-disabled="true" aria-describedby="${reasonId}"` : ""}><span class="l-go__t">${esc(label)}</span><span class="l-go__ico" aria-hidden="true">${blocked ? I.lock : I.arrow}</span></button></footer>`;
  }
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    if (S.route === "import") {
      if (S.step === "preview") return "import-preview";
      if (S.importDraft) return "import-review";
      if (S.importMode === "file") return "import-source";
      const ff = S.ff;
      if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps";
      if (ff.status === "unreadable") return "ff-unreadable";
      return ff.stage === 1 ? (TS.freeform.program(ff) ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply";
    }
    if (S.mode === "review") return "rec-result";
    return { desired_result: "rec-goal", background: "rec-background", schedule: "rec-schedule", environment: "rec-environment", priorities: "rec-priorities" }[S.station] || "rec-goal";
  }
  function machineView() {
    const rev = S.mode === "review";
    const strip = !rev && S.live && S.live.ok ? (() => { const p = S.live.result.preview; const f = TF.previewFacts(p); const m = missing().length; return `<div class="l-strip" id="lStrip" aria-hidden="true"><span class="l-strip__name">${esc(progName())}</span><span class="l-strip__f">${esc([t("entry.catalogue.days_badge", { days: (p.days || []).length }), t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") })].join(" · "))}</span><span class="l-strip__tag${m ? "" : " is-own"}">${esc(m ? t(m === 1 ? "l.tag.left_one" : "l.tag.left_many", { n: m }) : t("l.tag.own"))}</span></div>`; })() : "";
    return `<div class="l-page l-page--machine">${header({ back: "back", cancel: true })}${strip}
      <main class="l-main l-main--machine${rev ? " is-review" : ""}" data-entry-step="${esc(entryStep())}" data-checkpoint="${esc(checkpointFor())}">${readout()}${rev ? reviewBody() : tuneBody()}</main>${footer()}${overlayView()}</div>`;
  }

  /* ---------- import (paste door placard, file door, review, preview) ---------- */
  function modeSwitch() {
    const m = S.importMode;
    const b = (mode, label, n) => `<button type="button" class="l-mode${m === mode ? " is-on" : ""}" role="radio" aria-checked="${m === mode}" data-act="import-mode" data-mode="${mode}">${plateNo(n)}<span class="l-mode__t">${esc(label)}</span>${hole(m === mode ? knob("mode", "set") : "")}</button>`;
    return `<div class="l-modes" role="radiogroup" aria-label="${esc(t("l.mode.label"))}">${b("freeform", t("l.mode.freeform"), 1)}${b("file", t("l.mode.file"), 2)}</div>`;
  }
  function ffPlacard() {
    const ff = S.ff; const program = TS.freeform.program(ff);
    if (ff.status === "gaps" && ff.gap) return ffGaps();
    const step = (n, title, state, inner) => `<li class="l-step is-${state}"${state === "now" ? ' aria-current="step"' : ""}><div class="l-step__head"><span class="l-step__n" aria-hidden="true">${state === "done" ? I.check : n}</span><h2 class="l-step__t">${esc(title)}</h2>${state === "done" && n === 1 ? `<button type="button" class="l-btn l-btn--quiet l-btn--sm" data-act="ff" data-ff="edit-source">${esc(t("entry.freeform.edit_source"))}</button>` : ""}</div>${inner ? `<div class="l-step__body">${inner}</div>` : ""}</li>`;
    const s1 = ff.stage === 1 ? `<label class="l-field"><span class="l-field__label">${esc(t("entry.freeform.input_label"))}</span><textarea id="ffIn" rows="${compact() ? 5 : 7}" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(ff.input)}</textarea><span class="l-field__hint" id="ffCount">${esc(t("entry.freeform.count", { n: TF.nf(lang, ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }))}</span></label>
        <p class="l-note" id="ffNeeds"${program ? " hidden" : ""}>${esc(t("entry.freeform.needs_input"))}</p><p class="l-note l-note--quiet">${esc(t("entry.freeform.privacy"))}</p>
        <button type="button" class="l-btn l-btn--yellow" data-act="ff" data-ff="continue"${program ? "" : " disabled"}>${esc(t("entry.freeform.continue"))}</button>`
      : `<p class="l-note">${esc(t("entry.freeform.source_summary", { lines: TS.freeform.lines(ff) }))}</p>`;
    const prompt = TF.freeformPrompt(t, program);
    const s2 = ff.stage === 2 ? `<p class="l-note">${esc(t("entry.freeform.stage2_hint"))}</p><div class="l-providers"><a class="l-btn l-btn--coat" href="https://chatgpt.com/?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt">${esc(t("entry.freeform.open_chatgpt"))}${I.ext}</a><a class="l-btn l-btn--coat" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude">${esc(t("entry.freeform.open_claude"))}${I.ext}</a></div>
        <details class="l-disc l-disc--plain"><summary class="l-disc__sum"><span>${esc(t("entry.freeform.preview_prompt"))}</span><span class="l-chev" aria-hidden="true"></span></summary><pre class="l-pre">${esc(prompt)}</pre></details>
        <button type="button" class="l-btn l-btn--quiet" data-act="ff" data-ff="copy">${esc(t("entry.freeform.copy"))}</button>` : "";
    const unreadable = ff.status === "unreadable" ? `<div class="l-caution" role="alert"><p class="l-notice__t">${esc(t("entry.freeform.unreadable_title"))}</p><p>${esc(t("entry.freeform.unreadable_body"))}</p><div class="l-acts"><button type="button" class="l-btn l-btn--coat" data-act="ff" data-ff="copy-repair">${esc(t("entry.freeform.copy_repair_prompt"))}</button></div></div>` : "";
    const s3 = ff.stage === 3 ? `${ff.invalidated ? `<p class="l-notice" role="status">${esc(t("entry.freeform.edit_source_warning"))}</p>` : ""}${unreadable}<p class="l-note">${esc(t("entry.freeform.stage3_hint"))}</p>
        <button type="button" class="l-btn l-btn--yellow" data-act="ff" data-ff="clipboard">${esc(t("entry.freeform.clipboard_import"))}</button>
        <label class="l-field"><span class="l-field__label">${esc(t("entry.freeform.clipboard_or"))}</span><textarea id="ffOut" rows="${compact() ? 5 : 6}" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(ff.reply)}</textarea></label>
        <button type="button" class="l-btn l-btn--coat" data-act="ff" data-ff="review">${esc(t("entry.freeform.review"))}</button>
        <div class="l-acts l-acts--row"><button type="button" class="l-btn l-btn--quiet" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button><button type="button" class="l-btn l-btn--quiet l-btn--danger" data-act="ff" data-ff="start-over" aria-haspopup="dialog">${esc(t("entry.freeform.start_over"))}</button></div>` : "";
    const st = (n) => (ff.stage > n ? "done" : ff.stage === n ? "now" : "next");
    return `<ol class="l-placard">${step(1, t("l.ff.s1"), st(1), s1)}${step(2, t("entry.freeform.stage2_title"), st(2), s2)}${step(3, t("entry.freeform.stage3_title"), st(3), s3)}</ol>`;
  }
  function ffGaps() {
    const ff = S.ff; const g = ff.gap;
    const ni = g.notImported.length ? `<p class="l-notice" role="status">${esc(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }))}</p>` : "";
    const err = ff.gapErrors.size ? `<p class="l-caution" role="alert" id="lGapError" tabindex="-1">${esc(t("entry.freeform.gap_error"))}</p>` : "";
    return `<div class="l-gaps">${ni}${err}${g.gaps.map((gap) => { const bad = ff.gapErrors.has(gap.key); const label = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` }); return `<label class="l-field${bad ? " is-bad" : ""}"><span class="l-field__label" data-user-text>${esc(label)}</span><input type="text" inputmode="numeric"${bad ? ' aria-invalid="true"' : ""} data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}">${bad ? `<span class="l-field__err">${esc(t("entry.freeform.gap_error"))}</span>` : ""}</label>`; }).join("")}
      <div class="l-acts"><button type="button" class="l-btn l-btn--yellow" data-act="ff" data-ff="gap-submit">${esc(t("entry.freeform.gaps_submit"))}</button><button type="button" class="l-btn l-btn--quiet" data-act="ff" data-ff="gap-back">${esc(t("entry.freeform.back_to_reply"))}</button></div></div>`;
  }
  function pickerBody(query) {
    const results = TF.searchLibrary(query, lang, { limit: 6, all: true });
    return `<div class="l-picker"><label class="l-field l-field--search"><span class="l-field__label">${esc(t("x.build.search"))}</span><span class="l-field__row">${I.search}<input id="pickerSearch" type="search" autocomplete="off" data-field="pickerQuery" value="${esc(query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></span></label>
      <div class="l-results" role="listbox">${results.map((e) => `<button type="button" class="l-result" role="option" data-act="pick-exercise" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span>${I.plus}</button>`).join("")}</div></div>`;
  }
  function importRows(d) {
    const ordered = [...d.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
    return `<ul class="l-imps">${ordered.map((row) => {
      const target = row.decision === "link" && row.match ? TF.libraryName(row.match, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
      const status = row.reviewed ? t("import.status.confirmed") : t(`import.status.${row.status === "probable" ? "probable" : row.status}`);
      const head = `<p class="l-imp__from"><span class="l-imp__src" data-user-text>${esc(t("l.imp.as_imported", { name: row.raw.name || "" }))}</span><span class="impbadge visually-hidden">${esc(status)}</span><span class="improw__name visually-hidden">${esc(target)}</span></p>`;
      if (row.reviewed && !row.expanded) {
        return `<li class="l-imp" data-imp-row="${row.key}">${head}<div class="l-imp__done"><span class="l-cplate l-cplate--static">${hole(knob(`imp-${row.key}`, "set"))}<span class="l-cplate__body"><span class="l-cplate__t">${esc(target)}</span></span></span><button type="button" class="l-btn l-btn--quiet l-btn--sm" data-act="imp" data-imp="expand" data-key="${row.key}" aria-label="${esc(t("import.action_change"))}: ${esc(row.raw.name || "")}">${esc(t("import.action_change"))}</button></div></li>`;
      }
      /* The option plates. The pin sits on the lifter's decision; before one
         is made, a hollow pin marks the suggestion. */
      const opts = [];
      const inShort = row.match && row.shortlist.some((e) => e.id === row.match.id);
      if (row.match && !inShort) opts.push({ imp: "link", label: TF.libraryName(row.match, lang), on: row.decision === "link", sug: !row.reviewed && row.decision === "link" });
      row.shortlist.forEach((e, i) => opts.push({ imp: "pick", idx: i, label: TF.libraryName(e, lang), on: row.reviewed && row.decision === "link" && row.match && row.match.id === e.id, sug: !row.reviewed && i === 0 }));
      opts.push({ imp: "raw", label: t("l.imp.keep"), on: row.reviewed && row.decision === "raw", sug: !row.reviewed && !row.shortlist.length && !row.match });
      opts.push({ imp: "custom", label: t("import.action_custom"), on: row.decision === "custom" });
      opts.push({ imp: "choose", label: t("l.imp.choose"), on: false, more: true });
      const plates = opts.map((o, i) => `<button type="button" class="l-plate${o.on ? " is-chosen is-pinned" : ""}${o.sug ? " is-default" : ""}" data-act="imp" data-imp="${o.imp}" data-key="${row.key}"${o.idx !== undefined ? ` data-idx="${o.idx}"` : ""}${o.imp === "choose" ? "" : ` role="radio" aria-checked="${o.on ? "true" : "false"}"`}>${plateNo(i + 1)}<span class="l-plate__body"><span class="l-plate__v">${esc(o.label)}</span></span>${o.sug ? `<span class="l-plate__def" aria-hidden="true">${esc(t("l.imp.suggested"))}</span>` : ""}${hole(o.on ? knob(`imp-${row.key}`, "set") : o.sug ? knob(`imp-${row.key}`, "ghost") : o.more ? I.search : "")}</button>`).join("");
      const picker = S.picker && S.picker.key === row.key ? pickerBody(S.picker.query) : "";
      return `<li class="l-imp${row.reviewed ? "" : " is-open"}" data-imp-row="${row.key}">${head}<div class="l-plates" role="radiogroup" aria-label="${esc(t("l.imp.as_imported", { name: row.raw.name || "" }))}">${plates}</div>${picker}</li>`;
    }).join("")}</ul>`;
  }
  function importView() {
    let body = "", foot = "";
    if (S.step === "preview" && S.result) {
      const p = S.result.preview;
      body = `<section class="l-readout" aria-labelledby="lName"><h1 class="l-name" id="lName" data-focus tabindex="-1" data-user-text>${esc(S.result.name)}</h1><p class="l-tag l-tag--own"><span class="l-tag__mark" aria-hidden="true">${I.file}</span><span class="l-tag__t"><strong>${esc(t("entry.preview.source.import"))}</strong></span></p>${factsHtml(p)}
        ${S.notice === "conflict" ? `<div id="lConflict" tabindex="-1" class="l-conflict" role="alert" data-checkpoint="activation-conflict"><p class="l-notice__t">${esc(t("entry.conflict.title"))}</p><p>${esc(t("entry.conflict.body"))}</p><button type="button" class="l-btn l-btn--yellow" data-act="conflict-review">${esc(t("entry.conflict.review"))}</button></div>` : ""}${days(p)}</section>
        ${TF.hasActiveProgram() ? `<p class="l-notice" role="status">${esc(t("entry.active_notice"))}</p>` : ""}
        <section class="l-sec" aria-labelledby="lProg"><h2 class="l-h2" id="lProg">${esc(t("entry.preview.progression"))}</h2><ul class="l-list"><li>${esc(t(TF.progressionCopyKey(p)))}</li><li>${esc(t("import.safe"))}</li></ul></section>
        ${S.actError ? `<p class="l-caution" id="lActError" tabindex="-1" role="alert">${esc(S.actError)}</p>` : ""}`;
      foot = footer();
    } else if (S.importDraft) {
      const d = S.importDraft; const c = TF.importCounts(d);
      body = `<h1 class="l-title" data-focus>${esc(t("import.heading"))}</h1><p class="l-lede">${esc(t("import.lede"))}</p><p class="l-facts"><span class="l-fact" data-user-text>${esc(t("import.file", { name: d.fileName || t("import.file_fallback"), n: c.total, exercise: TF.tp(t, c.total, "lift") }))}</span></p>
        ${d.notImported.length ? `<p class="l-notice" role="status">${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</p>` : ""}
        <p class="l-count">${esc(t("l.imp.facts", c))}</p>${importRows(d)}
        ${d.originalText ? `<details class="l-disc l-disc--plain"><summary class="l-disc__sum"><span>${esc(t("entry.freeform.view_original"))}</span><span class="l-chev" aria-hidden="true"></span></summary><pre class="l-pre" data-user-text>${esc(d.originalText)}</pre></details>` : ""}
        <p class="l-note">${esc(t("import.safe"))}</p>`;
      foot = `<footer class="l-foot" data-persistent-action>${c.review ? `<p class="l-foot__why" id="lImpReason">${I.lock}<span>${esc(t("import.commit_blocked", { n: c.review }))}</span></p>` : ""}<button type="button" class="l-go${c.review ? " is-locked" : ""}" id="lImportCommit" data-act="import-commit"${c.review ? ' disabled aria-describedby="lImpReason"' : ""}><span class="l-go__t">${esc(t("l.prev.title"))}</span><span class="l-go__ico" aria-hidden="true">${c.review ? I.lock : I.arrow}</span></button></footer>`;
    } else {
      const ff = S.importMode === "freeform"; const gaps = ff && S.ff.status === "gaps";
      body = `<h1 class="l-title" data-focus>${esc(t(gaps ? "l.ff.gaps_title" : ff ? "entry.freeform.title" : "entry.import_source.title"))}</h1><p class="l-lede">${esc(t(gaps ? "l.ff.gaps_lede" : ff ? "entry.freeform.lede" : "entry.import_source.lede"))}</p>
        ${TF.hasActiveProgram() ? `<p class="l-notice" role="status">${esc(t("entry.active_notice"))}</p>` : ""}${gaps ? "" : modeSwitch()}
        ${ff ? ffPlacard() : `<div class="l-filedoor"><button type="button" class="l-btn l-btn--yellow" data-act="import-file">${I.file}${esc(t("entry.import_source.pick"))}</button><p class="l-note">${esc(t("x.cost.file"))}</p></div>`}`;
    }
    const restart = S.ff.confirmStartOver ? `<div class="l-scrim" data-act="ff" data-ff="start-over-cancel"></div><div class="l-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ffRestartTitle" data-confirm="ff-start-over"><h2 class="l-dialog__t" id="ffRestartTitle" tabindex="-1">${esc(t("entry.freeform.confirm_start_over"))}</h2><div class="l-acts"><button type="button" class="l-btn l-btn--danger-fill" data-act="ff" data-ff="start-over-confirm">${esc(t("x.ff.restart_confirm"))}</button><button type="button" class="l-btn l-btn--coat" data-act="ff" data-ff="start-over-cancel">${esc(t("x.ff.restart_cancel"))}</button></div></div>` : "";
    return `<div class="l-page">${header({ back: "back", cancel: true })}<main class="l-main" data-entry-step="${esc(entryStep())}" data-checkpoint="${esc(checkpointFor())}">${body}</main>${foot}${overlayView()}${restart}</div>`;
  }

  /* ---------- dialogs ---------- */
  function dialog({ id, title, body, acts, role = "dialog", attrs = "", scrimAct }) {
    return `<div class="l-scrim" data-act="${scrimAct}"></div><div class="l-dialog" role="${role}" aria-modal="true" aria-labelledby="${id}"${body ? ` aria-describedby="${id}B"` : ""} ${attrs}><h2 class="l-dialog__t" id="${id}" tabindex="-1">${esc(title)}</h2>${body ? `<p class="l-dialog__b" id="${id}B">${esc(body)}</p>` : ""}<div class="l-acts">${acts}</div></div>`;
  }
  function overlayView() {
    if (S.overlay === "cancel") return dialog({ id: "cancelTitle", title: t("entry.cancel_confirm.title"), body: t("entry.cancel_confirm.body"), scrimAct: "cancel-continue", attrs: 'data-checkpoint="cancel-confirm"', acts: `<button type="button" class="l-btn l-btn--yellow" data-act="cancel-keep">${esc(t("l.cancel.keep"))}</button><button type="button" class="l-btn l-btn--danger-line" data-act="cancel-discard">${esc(t("entry.cancel_confirm.discard"))}</button><button type="button" class="l-btn l-btn--quiet" data-act="cancel-continue">${esc(t("entry.cancel_confirm.continue"))}</button>` });
    if (S.overlay === "replace") { const cur = TF.activeName(lang), next = progName(); return dialog({ id: "replTitle", title: t("x.replace.title"), body: t("x.replace.body", { current: cur, next, n: TF.device.sessions }), scrimAct: "replace-cancel", attrs: 'data-checkpoint="replace-confirm"', acts: `<button type="button" class="l-btn l-btn--yellow" data-act="replace-confirm">${esc(t("x.replace.confirm", { next }))}</button><button type="button" class="l-btn l-btn--coat" data-act="replace-cancel">${esc(t("x.replace.cancel", { current: cur }))}</button>` }); }
    if (S.overlay === "restart") return dialog({ id: "restartTitle", role: "alertdialog", title: t("x.restart.title"), body: t("x.restart.body"), scrimAct: "restart-cancel", attrs: 'data-confirm="restart"', acts: `<button type="button" class="l-btn l-btn--danger-fill" data-act="restart-confirm">${esc(t("x.restart.confirm"))}</button><button type="button" class="l-btn l-btn--coat" data-act="restart-cancel">${esc(t("x.restart.cancel"))}</button>` });
    if (S.overlay === "resume-discard") return dialog({ id: "lDiscardTitle", role: "alertdialog", title: t("l.resume.discard_title"), body: t("l.resume.discard_body"), scrimAct: "resume-discard-cancel", attrs: 'data-confirm="discard-draft"', acts: `<button type="button" class="l-btn l-btn--danger-fill" data-act="resume-discard-confirm">${esc(t("l.resume.discard_confirm"))}</button><button type="button" class="l-btn l-btn--coat" data-act="resume-discard-cancel">${esc(t("l.resume.discard_cancel"))}</button>` });
    return "";
  }
  function view() {
    document.body.dataset.lView = S.view;
    if (S.view === "today") return `<div class="l-today">${TF.renderToday(t, lang)}</div>` + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");
    if (S.view === "hub") return hubView();
    if (S.view === "machine") return machineView();
    if (S.view === "import") return importView();
    return landingView();
  }

  /* ---------- render, focus, the pin drop ---------- */
  const sel = (x) => (/^[#\[.]/.test(x) ? x : "#" + CSS.escape(x));
  function focusId(id) {
    const el = root.querySelector(sel(id)) || document.querySelector(sel(id));
    if (!el) { TS.focusHeading(root); return; }
    if (!el.matches("button,a,input,textarea,select,summary") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  const FOCUS_ATTRS = ["act", "key", "val", "pin", "imp", "ff", "mode", "route", "provider", "id", "field"];
  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = FOCUS_ATTRS.filter((a) => el.dataset && el.dataset[a] !== undefined).map((a) => `[data-${a}="${CSS.escape(el.dataset[a])}"]`);
    return parts.length ? parts.join("") : null;
  }
  function render(focus) {
    const act = document.activeElement; const key = focusKey(act); const typing = act && /^(INPUT|TEXTAREA)$/.test(act.tagName);
    const motion = !reducedMotion() && !flipOff;
    const knobs = motion ? new Map([...root.querySelectorAll("[data-knob]")].map((k) => [k.dataset.knob, k.getBoundingClientRect()])) : null;
    root.innerHTML = view();
    S._facts = S._factsNext || S._facts; S.justLocked = false;
    if (typeof focus === "string") focusId(focus);
    else if (focus) { window.scrollTo(0, 0); TS.focusHeading(root); }
    else if (key) { const el = root.querySelector(key); if (el) { if (typing && el.id) TS.refocus(root, el.id); else try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    if (knobs) for (const k of root.querySelectorAll("[data-knob]")) {
      const was = knobs.get(k.dataset.knob); if (!was) continue;
      const now = k.getBoundingClientRect(); const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      k.classList.add("is-travel"); k.style.transform = `translate(${dx}px,${dy}px)`;
      void k.offsetWidth; k.classList.add("is-go"); k.style.transform = "";
      k.addEventListener("transitionend", () => k.classList.remove("is-travel", "is-go"), { once: true });
    }
    watchStrip();
  }
  /* The compact readout strip shows while the readout plate is off screen. */
  let io = null;
  function watchStrip() {
    if (io) { io.disconnect(); io = null; }
    const strip = root.querySelector("#lStrip"), ro = root.querySelector(".l-readout");
    if (!strip || !ro || !("IntersectionObserver" in window) || compact()) return;
    io = new IntersectionObserver((es) => { for (const e of es) strip.classList.toggle("is-shown", !e.isIntersecting && e.boundingClientRect.top < 0); });
    io.observe(ro);
  }
  function scrollToEl(el, pad = 12) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - pad)); }
  function revealPull() {
    const ed = root.querySelector("#lPull"); if (!ed) return;
    try { ed.querySelector("#lPullT").focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    const ok = ed.querySelector('[data-act="pull-confirm"]'); const r = ed.getBoundingClientRect(); const o = ok.getBoundingClientRect();
    const tile = ed.previousElementSibling; const top = tile ? tile.getBoundingClientRect().top : r.top;
    if (o.bottom - top + 24 <= window.innerHeight) window.scrollTo(0, Math.max(0, window.scrollY + top - 12));
    else window.scrollTo(0, Math.max(0, o.bottom + window.scrollY - window.innerHeight + 16));
  }
  function showChange() {
    const c = root.querySelector("#lChange"); if (!c) { TS.focusHeading(root); return; }
    const pin = root.querySelector("[data-persistent-action]"); const limit = pin ? pin.getBoundingClientRect().top + window.scrollY : Infinity;
    const bottomAtTop = c.getBoundingClientRect().bottom + window.scrollY;
    if (bottomAtTop <= Math.min(limit, window.innerHeight) - 8) window.scrollTo(0, 0); else scrollToEl(c, 16);
    try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  /* ---------- navigation ---------- */
  function openMachine(answers) {
    const stash = S.stash; const shared = null;
    S = blank("machine"); S.route = "recommend"; S.stash = null;
    S.answers = answers ? clone(answers) : stash && stash.route === "recommend" ? clone(stash.answers) : {};
    const first = missing()[0]; S.station = first ? first.step : "environment";
    relive(); void shared;
    render(true);
  }
  function openImport(mode) { const stash = S.stash; S = blank("import"); S.route = "import"; S.step = "import_source"; S.importMode = mode || "freeform"; S.stash = stash; render(true); }
  function toHub() { S.stash = S.route === "recommend" ? { route: "recommend", answers: clone(S.answers) } : null; const stash = S.stash; S = blank("hub"); S.stash = stash; render(true); }
  function leaveSetup() { const active = TF.hasActiveProgram(); S = blank(active ? "today" : "landing"); S.stash = null; render(true); }
  function stateFor(step, withResult) { return TF.entryState({ route: S.route, answers: TF.normalizeAnswers(S.answers), result: withResult ? (S.route === "import" ? S.result : S.live && S.live.ok ? S.live.result : null) : null, step, activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    const step = entryStep() || "desired_result";
    const ui = TF.jsonClean({ importMode: S.importMode, mode: S.mode });
    const tries = [() => stateFor(step, S.route === "import" ? S.step === "preview" : allSet()), () => stateFor(step, false), () => stateFor(TF.Entry.ROUTE_STEPS[S.route][0], false)];
    for (const mk of tries) { try { const r = TF.saveDraft(mk(), { ui }); if (r.ok) return; } catch (e) { /* next */ } }
  }
  function back() {
    if (S.view === "machine") {
      if (S.pull) { closePull(); return; }
      if (S.mode === "review") { S.mode = "tune"; S.station = "environment"; S.change = null; S.notice = null; render(true); return; }
      toHub(); return;
    }
    if (S.view === "import") {
      if (S.step === "preview") { S.step = "import_source"; S.importDraft = S.importKept; S.result = null; S.notice = null; render(true); return; }
      if (S.importDraft) { S.importHeld = S.importDraft; S.importDraft = null; S.picker = null; render(true); return; }
      if (S.importMode === "freeform") {
        const ff = S.ff;
        if (ff.status === "gaps") { S.ff = TS.freeform.apply(ff, "gap-back"); render(true); return; }
        if (ff.stage === 3) { S.ff = { ...ff, stage: 2, status: null, gapErrors: new Set() }; render(true); return; }
        if (ff.stage === 2) { S.ff = { ...ff, stage: 1, gapErrors: new Set() }; render(true); return; }
      }
      toHub(); return;
    }
  }
  function lockNow(focus = true) { S.mode = "review"; S.justLocked = !reducedMotion(); render(focus ? "lName" : undefined); window.scrollTo(0, 0); }
  function activateNow() {
    S.actError = null;
    const step = S.route === "import" ? "preview" : "result";
    let r;
    try { r = TF.activate(stateFor(step, true)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { const toast = t("x.activated"); S = blank("today"); S.toast = toast; render(true); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render("lConflict"); const c = root.querySelector("#lConflict"); if (c) scrollToEl(c, 60); return; }
    S.actError = TS.issueText(t, r, { preview: S.route === "import" ? S.result && S.result.preview : livePreview() }); render("lActError");
  }
  function requestActivate(el) {
    if (el && el.getAttribute("aria-disabled") === "true") {
      if (S.route === "recommend" && missing().length) { const p = missing()[0]; const stackEl = root.querySelector(`.l-stack[data-pin="${p.id}"]`); if (stackEl) { scrollToEl(stackEl, 72); const b = stackEl.querySelector(".l-plate"); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
      return;
    }
    if (TF.hasActiveProgram()) { S.overlay = "replace"; render("replTitle"); } else activateNow();
  }

  /* ---------- pins: set, pull, confirm, undo ---------- */
  const pinOfKey = (key) => (key === "environmentEquipment" || key === "environmentCapabilities" ? "env" : PRIO_KEYS.has(key) ? "prio" : (PINS.find((p) => p.key === key) || {}).id || null);
  function onPick(d) {
    const pinId = pinOfKey(d.key); if (!pinId) return;
    const st = S.pull ? S.pull.avoid : S.avoid;
    if (d.key === "avoidReason" && st) st.pending = null;
    const before = livePreview(); const wasAll = allSet();
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (d.key === "environmentEquipment" || d.key === "environmentCapabilities") S.envOpen = true;
    relive();
    if (S.mode === "review") { if (S.pull) S.change = { from: S.pull.preview, at: "pull" }; render(); return; }
    const p = PIN[pinId]; S.station = p ? p.step : "priorities";
    S.change = before && livePreview() ? { from: before, at: pinId === "prio" ? "prio" : pinId } : null;
    if (!wasAll && allSet()) { S.change = before && livePreview() ? { from: before, at: "top" } : null; lockNow(); return; }
    render();
  }
  function openPull(pin) {
    if (S.pull && S.pull.pin === pin) { closePull(); return; }
    if (S.pull) { S.answers = S.pull.answers; relive(); }
    S.pull = { pin, answers: clone(S.answers), preview: livePreview(), avoid: { query: "", pending: null } };
    S.change = null; S.notice = null; render(); revealPull();
  }
  function closePull() {
    const pin = S.pull.pin; S.answers = S.pull.answers; relive(); S.pull = null; S.change = null;
    render(`[data-act="pull"][data-pin="${pin}"]`); const tile = root.querySelector(`[data-pin="${pin}"].l-tile`); if (tile) { const r = tile.getBoundingClientRect(); if (r.top < 60 || r.bottom > window.innerHeight - 100) scrollToEl(tile, 80); }
  }
  function confirmPull() {
    const pl = S.pull; if (pl.avoid && pl.avoid.pending) return;
    if (J(TF.normalizeAnswers(S.answers)) === J(TF.normalizeAnswers(pl.answers))) { closePull(); return; }
    if (!S.live || !S.live.ok) return;
    S.change = { from: pl.preview, at: "top" }; S.pull = null; render(); showChange();
  }
  function restore(id) {
    const before = livePreview();
    S.answers = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== id) };
    relive(); S.change = before && livePreview() ? { from: before, at: "top" } : null; render(); showChange();
  }

  /* ---------- actions ---------- */
  function on(act, d, el) {
    S.cpTag = null;
    if (S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": S.view = "hub"; render(true); return;
      case "land-import": openImport("freeform"); return;
      case "hub-back": S = blank(TF.hasActiveProgram() ? "today" : "landing"); render(true); return;
      case "route": {
        if (S.hubBusy) return;
        const go = () => { S.hubBusy = false; if (d.route === "recommend") openMachine(); else openImport(d.mode); };
        if (reducedMotion()) { go(); return; }
        S.hubPick = d.route + (d.mode ? ":" + d.mode : ""); S.hubBusy = true; render(); setTimeout(go, 380); return;
      }
      case "pick": onPick(d); return;
      case "lock": lockNow(); return;
      case "pull": openPull(d.pin); return;
      case "pull-confirm": confirmPull(); return;
      case "pull-close": closePull(); return;
      case "restore": restore(d.id); return;
      case "back": back(); return;
      case "cancel": S.overlay = "cancel"; S.overlayReturn = '[data-act="cancel"]'; render("cancelTitle"); return;
      case "cancel-continue": S.overlay = null; render('[data-act="cancel"]'); return;
      case "cancel-keep": keepDraft(); leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); leaveSetup(); return;
      case "resume": {
        const info = TF.loadDraft(); if (!info || !info.state) return; const st = info.state;
        if (st.route === "import") { openImport(info.ui && info.ui.importMode); return; }
        const a = clone(st.answers) || {}; for (const k of Object.keys(a)) if (Array.isArray(a[k]) && !a[k].length) delete a[k];
        S = blank("machine"); S.route = "recommend"; S.answers = a; S.revAtStart = st.activeProgramRevisionAtStart; relive();
        if (st.step === "result" && allSet()) S.mode = "review"; else S.station = STATIONS.includes(st.step) ? st.step : (missing()[0] || PIN.env).step;
        render(true);
        if (S.mode === "tune") { const target = root.querySelector(`.l-stack[data-pin="${(PINS.find((p) => p.step === S.station) || PIN.goal).id}"]`); if (target) scrollToEl(target, 60); }
        return;
      }
      case "resume-restart": S.overlay = "resume-discard"; render("lDiscardTitle"); return;
      case "resume-discard-cancel": S.overlay = null; render("lResumeRestart"); return;
      case "resume-discard-confirm": TF.clearDraft(); S.overlay = null; render(true); return;
      case "rules-rebuild": { const info = TF.loadDraft(); TF.clearDraft(); const a = info && info.state ? clone(info.state.answers) : {}; for (const k of Object.keys(a || {})) if (Array.isArray(a[k]) && !a[k].length) delete a[k]; openMachine(a || {}); return; }
      case "avoid-add": { const st = S.pull ? S.pull.avoid : S.avoid; st.pending = d.id; st.query = ""; render(); return; }
      case "avoid-remove": {
        const st = S.pull ? S.pull.avoid : S.avoid; const before = livePreview();
        S.answers = { ...S.answers, exerciseConstraints: (S.answers.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id) };
        if (st.pending === d.id) st.pending = null;
        relive(); if (S.pull) S.change = { from: S.pull.preview, at: "pull" }; else if (before && livePreview()) S.change = { from: before, at: "prio" };
        render(); return;
      }
      case "field:avoidQuery": { const st = S.pull ? S.pull.avoid : S.avoid; st.query = d.value; render(); return; }
      case "field:pickerQuery": if (S.picker) { S.picker.query = d.value; render(); } return;
      case "activate": requestActivate(el); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; render("lActivate"); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render("lName"); return;
      case "restart": S.overlay = "restart"; render("restartTitle"); return;
      case "restart-cancel": S.overlay = null; render("lRestart"); return;
      case "restart-confirm": S = blank("hub"); S.stash = null; render(true); return;
      /* import */
      case "import-mode": if (S.importMode === d.mode) { render(); return; } S.importMode = d.mode; if (S.importDraft) { S.importHeld = S.importDraft; S.importDraft = null; } S.picker = null; render(`[data-act="import-mode"][data-mode="${d.mode}"]`); return;
      case "import-file": S.importDraft = S.importHeld && S.importHeld.sourceType === "file" ? S.importHeld : TF.buildImportDraft(TF.F.importFile[lang], t("l.import.file_name"), "file"); S.importHeld = null; render(true); return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render("pickerSearch"); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render(); return;
      case "pick-exercise": if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); S.picker = null; render(); } return;
      case "import-commit": S.importKept = S.importDraft; S.result = TF.importResult(S.importDraft, t); S.step = "preview"; S.importDraft = null; S.picker = null; render(true); return;
      case "ff": {
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); }
        else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); return; }
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...S.ff, status: null, parsed: null }; render(true); return; }
        if (d.ff === "start-over") { render("ffRestartTitle"); return; }
        if (d.ff === "start-over-cancel") { render('[data-ff="start-over"]'); return; }
        if (d.ff === "gap-submit" && S.ff.gapErrors.size) { render("lGapError"); return; }
        render(["continue", "open", "copy", "try-another", "gap-back", "start-over-confirm", "review", "edit-source"].includes(d.ff) ? true : undefined); return;
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
      default: return;
    }
  }
  function onKey(ev) {
    if (ev.key !== "Escape" || document.getElementById("tfPrivacy")) return;
    if (S.overlay === "cancel") on("cancel-continue", {});
    else if (S.overlay === "replace") on("replace-cancel", {});
    else if (S.overlay === "restart") on("restart-cancel", {});
    else if (S.overlay === "resume-discard") on("resume-discard-cancel", {});
    else if (S.ff && S.ff.confirmStartOver) on("ff", { ff: "start-over-cancel" });
    else if (S.pull) closePull();
  }

  /* ---------- checkpoint reach (states built through the same model) ---------- */
  const rafael = () => { const a = TF.fixtureAnswers("rafael"); for (const k of Object.keys(a)) if (Array.isArray(a[k]) && !a[k].length) delete a[k]; return a; };
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  function machineAt(answers, { mode = "tune", station } = {}) {
    S = blank("machine"); S.route = "recommend"; S.answers = clone(answers); S.mode = mode; relive();
    const first = missing()[0]; S.station = station || (first ? first.step : "environment");
  }
  function importAt(mode) { S = blank("import"); S.route = "import"; S.step = "import_source"; S.importMode = mode; }
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "copy", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); } return ff; }
  function scrollToPin(id) { const el = root.querySelector(`.l-stack[data-pin="${id}"]`); if (el) scrollToEl(el, 88); }
  async function reach(cp) {
    flipOff = true;
    try { await reachInner(cp); } finally { flipOff = false; }
  }
  async function reachInner(cp) {
    const a = rafael();
    switch (cp) {
      case "landing": S.view = "landing"; break;
      case "route-choice": case "hub-existing": case "resume": case "rules-changed": S.view = "hub"; break;
      case "route-help": S.view = "hub"; break;
      case "rec-goal": machineAt({}); break;
      case "rec-background": machineAt({ desiredResult: a.desiredResult }); render(true); scrollToPin("exp"); return;
      case "rec-schedule": machineAt({ desiredResult: a.desiredResult, structuredExperience: a.structuredExperience, recentConsistency: a.recentConsistency }); render(true); scrollToPin("days"); return;
      case "rec-environment": { const b = { ...a }; delete b.environment; machineAt(b); render(true); scrollToPin("env"); return; }
      case "rec-priorities": case "rec-avoid-pain": {
        machineAt(a, { station: "priorities" }); S.prioOpen = true;
        if (cp === "rec-avoid-pain") { S.answers.primaryMuscles = [...TF.F.users.rafael.pain.primaryMuscles]; S.answers.exerciseConstraints = [{ exerciseId: TF.F.users.rafael.pain.exerciseId, reason: "pain" }]; relive(); S.cpTag = cp; }
        render(true); const o = root.querySelector("#lOpt"); if (o) scrollToEl(o, 64); return;
      }
      case "rec-result": case "activate": case "rec-result-avoided": machineAt(a, { mode: "review" }); if (cp === "rec-result-avoided") { const before = livePreview(); S.answers.primaryMuscles = ["chest"]; S.answers.exerciseConstraints = [{ exerciseId: "pr_bb", reason: "pain" }]; relive(); S.change = { from: before, at: "top" }; S.cpTag = cp; } break;
      case "rec-env-correction": machineAt(a, { mode: "review" }); openPull("env"); S.answers.environment = correctedEnv(); relive(); S.change = { from: S.pull.preview, at: "pull" }; render(); revealPull(); { const c = root.querySelector(".l-corr"); if (c) scrollToEl(c, 12); } return;
      case "rec-result-corrected": { machineAt(a, { mode: "review" }); const before = livePreview(); S.answers.environment = correctedEnv(); relive(); S.change = { from: before, at: "top" }; S.cpTag = cp; break; }
      case "replace-confirm": machineAt(a, { mode: "review" }); S.overlay = "replace"; render("replTitle"); return;
      case "activation-conflict": machineAt(a, { mode: "review" }); TF.device.revision += 1; activateNow(); window.scrollTo(0, 0); return;
      case "cancel-confirm": machineAt({ desiredResult: a.desiredResult, structuredExperience: a.structuredExperience, recentConsistency: a.recentConsistency }); S.overlay = "cancel"; render("cancelTitle"); return;
      case "activated-today": machineAt(a, { mode: "review" }); activateNow(); return;
      case "ff-empty": importAt("freeform"); break;
      case "ff-filled": importAt("freeform"); S.ff = ffAt(1); break;
      case "ff-handoff": importAt("freeform"); S.ff = ffAt(2); break;
      case "ff-reply": importAt("freeform"); S.ff = ffAt(3); break;
      case "ff-gaps": case "ff-gaps-invalid": importAt("freeform"); S.ff = ffAt(3, TF.F.freeform.replyGaps[lang]); if (cp === "ff-gaps-invalid") { const g = S.ff.gap.gaps; S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[0].key, value: "12-10" }); if (g[1]) S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[1].key, value: "abc" }); S.ff = TS.freeform.apply(S.ff, "gap-submit"); } break;
      case "ff-unreadable": importAt("freeform"); S.ff = ffAt(3, TF.F.freeform.replyUnreadable[lang]); break;
      case "import-source": importAt("file"); break;
      case "import-review": importAt("file"); S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("l.import.file_name"), "file"); break;
      case "import-preview": { importAt("file"); let dr = TF.buildImportDraft(TF.F.importFile[lang], t("l.import.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); S.importDraft = dr; on("import-commit", {}); return; }
      default: /* non-core checkpoints fall back to the nearest core view */
        if (/^custom-|^browse-|^build-/.test(cp)) { S.view = "hub"; break; }
        if (/^shared/.test(cp)) { S.view = "landing"; break; }
        S.view = "landing";
    }
    render(true);
  }

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  const valOf = (p, a) => (p.id === "rest" ? (a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds) : p.id === "env" ? a.environment.kind : a[p.key]);
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function decideRows(api) { for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  const journeys = {
    async "activate.recommend"(api) {
      const a = TF.fixtureAnswers("rafael");
      await api.tap("#firstRunCreate"); await api.tap('[data-act="route"][data-route="recommend"]'); await api.waitFor("[data-entry-step]");
      for (const p of PINS) await api.tap(pickKey(p.key, valOf(p, a)));
      api.snapshot("review"); await activateAndWait(api);
    },
    async "recommend.required"(api) {
      const a = TF.fixtureAnswers("rafael");
      const probeKey = { goal: "desiredResult", exp: "structuredExperience", cons: "recentConsistency", days: "daysPerWeek", minutes: "sessionMinutes", rest: "preferredRestSeconds", env: "environment" };
      for (const p of PINS) { await api.probe(`missing:${probeKey[p.id]}`); await api.tap(pickKey(p.key, valOf(p, a))); }
      api.snapshot("review");
    },
    async "activate.import-paste"(api) {
      await api.type("#ffIn", TF.F.freeform.pasted[api.lang]); await api.tap('[data-ff="continue"]'); await api.tap('[data-ff="open"][data-provider="chatgpt"]'); await api.tap('[data-ff="clipboard"]');
      for (const g of S.ff.gap.gaps) await api.type(`[data-field="gap"][data-key="${g.key}"]`, g.field === "reps" ? "10-12" : "3");
      await api.tap('[data-ff="gap-submit"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.import-file"(api) { await api.tap('[data-act="import-file"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api); },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "cancel.keep-resume"(api) {
      await api.tap(pickKey("daysPerWeek", 4)); api.snapshot("before");
      await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); api.snapshot("kept");
      await api.tap("#firstRunCreate"); await api.tap('[data-act="resume"]'); api.snapshot("resumed");
    },
    async "back.recommend"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.import"(api) { await decideRows(api); api.snapshot("decided"); await api.tap('[data-act="import-commit"]'); api.snapshot("preview"); await api.tap('[data-act="back"]'); api.snapshot("back"); },
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.discard-draft"(api) { await api.tap('[data-act="cancel"]'); api.snapshot("asked"); await api.tap('button[data-act="cancel-discard"]'); api.snapshot("discarded"); },
    async "existing.back"(api) { await api.tap('[data-act="hub-back"]'); },
    async "existing.cancel-keep"(api) { await api.tap('[data-act="route"][data-route="recommend"]'); await api.waitFor("[data-entry-step]"); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await api.tap('[data-act="route"][data-route="recommend"]'); await api.waitFor("[data-entry-step]"); await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async overlays(api) {
      for (const id of [...PINS.map((p) => p.id), "prio"]) { await api.tap(`[data-act="pull"][data-pin="${id}"]`); await api.checkOverlay('[data-act="pull-confirm"]', id); await api.tap('button[data-act="pull-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-act="pull"][data-pin="days"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="pull-confirm"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      const c = TF.F.users.rafael.correction; const base = TF.env(c.environmentKind);
      api.mark("start"); await api.tap('[data-act="pull"][data-pin="env"]');
      await api.tap(pickKey("environment", c.environmentKind));
      for (const e of c.equipmentAdd) if (!base.equipment.includes(e)) await api.tap(pickKey("environmentEquipment", e));
      for (const k of c.capabilitiesAdd) if (!base.capabilities.includes(k)) await api.tap(pickKey("environmentCapabilities", k));
      await api.tap('[data-act="pull-confirm"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await api.tap('[data-act="pull"][data-pin="prio"]');
      await api.type("#lPullAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="pull-confirm"]'); api.mark("end"); api.snapshot("review");
    },
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.l = {
    id: "l", name: "L · Pino", policy: { productDecisions: ["PD-4"] },
    thesis: "The program exists before the questions: a real program compiled from labelled defaults appears at once, every answer is a selector pin that recompiles it, and it can be used only when every pin is the lifter's.",
    axis: "Reopens PD-4 (a program from labelled defaults before the answers); activating defaults is impossible.",
    async mount(c) {
      lang = c.lang; root = c.root; t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      root.classList.add("l-app");
      fresh(c.seed); TS.wire(root, on);
      root.addEventListener("toggle", (ev) => { const el = ev.target; if (!el || el.tagName !== "DETAILS") return; if (el.id === "lOpt") { S.prioOpen = el.open; if (el.open && S.mode === "tune") { S.station = "priorities"; const m = root.querySelector("main[data-checkpoint]"); if (m) { m.dataset.checkpoint = checkpointFor(); m.dataset.entryStep = entryStep(); } } } else if (el.dataset.role === "env-correction") S.envOpen = el.open; }, true);
      document.addEventListener("keydown", onKey);
      try { await Promise.race([Promise.all(['800 40px "Big Shoulders Stencil Display"', '400 16px "Barlow"', '600 16px "Barlow"', '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts optional */ }
      render();
    },
    reach,
    entry() {
      if (!S || !S.route || (S.view !== "machine" && S.view !== "import")) return null;
      let result = null;
      if (S.route === "import") result = S.step === "preview" ? S.result : null;
      else if (allSet() && S.live && S.live.ok) result = S.live.result;
      return TF.jsonClean({ route: S.route, step: entryStep(), answers: TF.normalizeAnswers(S.answers), result });
    },
    journeys,
    state: () => S,
  };
})();
