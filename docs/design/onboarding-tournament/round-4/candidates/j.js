/* Candidate J · Conversa (Round 4, bold directions)
   Setup is a chat the lifter already knows how to use. Taurifer asks fixed
   questions in its own plain voice; the lifter answers with quick replies
   that stay in the thread as their own messages; the program arrives as a
   message; a correction is a reply to the line it changes, and a new
   version of the program arrives beneath it with the count of exercises
   that changed. Taurifer never reads free text, never types, never says "I":
   the only free input is pasting a program, which goes through the reviewed
   hand-off to an assistant the lifter opens.

   Product policy: reopens PD-1 (no chooser). The routes are offered inside
   the thread: reply to the questions (Recommend), paste a program into the
   composer (paste door) or attach a Taurifer file with the paperclip (file
   door). Custom, Browse and Build are not offered in this round's core.
   Every program comes from the real engine through TF / TS. */
(function () {
  "use strict";
  const { esc } = TF;
  const COPY = {
    pt: {
      "j.name": "J · Conversa",
      "j.status.landing": "Sem conta · neste dispositivo",
      "j.status.review": "Programa para revisar",
      "j.status.import": "Importar um programa",
      "j.status.ready": "Pronto para começar",
      "j.back": "Voltar uma pergunta",
      "j.back_import": "Voltar uma etapa",
      "j.leave": "Sair",
      "j.leave_aria": "Sair da configuração do programa",
      "j.privacy_aria": "Privacidade: como o Taurifer guarda seus dados",
      "j.land.caption": "Assim fica a tela Hoje quando o programa está ativo.",
      "j.land.open_image": "Abrir a imagem da tela Hoje",
      "j.media.close": "Fechar a imagem",
      "j.you": "Você",
      "j.edited": "editada",
      "j.rec.intro": "São cinco seções curtas. Toque em uma resposta, ou cole abaixo um programa que você já treina.",
      "j.rec.active": "Programa ativo: {name}",
      "j.q.exp": "Há quanto tempo você segue programas de treino estruturados?",
      "j.q.cons": "E nas últimas seis semanas, quantas das sessões planejadas você fez?",
      "j.q.days": "Quantos dias por semana você pode treinar?",
      "j.q.minutes": "Quanto dura, no máximo, uma sessão típica?",
      "j.q.rest": "Quanto você prefere descansar entre séries exigentes?",
      "j.q.env": "Onde você treina?",
      "j.q.env_check": "{env} inclui: {equipment}. Confere?",
      "j.q.env_check_none": "Com {env}, o Taurifer não conta com nenhum equipamento. Confere?",
      "j.env.ok": "Confere",
      "j.env.fix": "Corrigir o equipamento",
      "j.env.fix_title": "Marque o que existe onde você treina.",
      "j.env.fixed": "Corrigido: {list}",
      "j.env.fixed_none": "Corrigido: sem equipamento",
      "j.q.prio": "Quer priorizar algum músculo ou evitar algum exercício? É opcional.",
      "j.prio.none": "Sem prioridades",
      "j.prio.open": "Escolher prioridades",
      "j.prio.limit": "Você já escolheu dois músculos. Desmarque um para trocar.",
      "j.prio.sent_prio": "Priorizar {list}",
      "j.prio.sent_avoid": "Evitar {list}",
      "j.unit.days": "dias",
      "j.unit.min": "min",
      "j.a.days": "{n} dias por semana",
      "j.a.minutes": "Até {n} min por sessão",
      "j.a.minutes_90": "90 min ou mais por sessão",
      "j.c.tap": "Toque em uma resposta acima",
      "j.c.send": "Enviar",
      "j.c.paste": "Colar um programa que já tenho",
      "j.c.attach": "Anexar um arquivo de programa",
      "j.c.fix_draft": "Enviar a correção do equipamento",
      "j.c.prio_draft": "Enviar as prioridades",
      "j.c.prio_empty": "Escolha acima ou toque em Sem prioridades",
      "j.c.ff_in": "Cole aqui o seu programa",
      "j.c.ff_wait": "Abra o ChatGPT ou o Claude acima",
      "j.c.gaps": "Preencha os detalhes acima e envie",
      "j.c.send_aria": "Enviar",
      "j.what.goal": "Objetivo", "j.what.exp": "Tempo com programas", "j.what.cons": "Últimas seis semanas", "j.what.days": "Dias por semana", "j.what.minutes": "Duração da sessão", "j.what.rest": "Descanso", "j.what.env": "Onde você treina", "j.what.prio": "Prioridades",
      "j.reply.aria": "Responder a {what}: {value}",
      "j.ans.aria": "Sua resposta, {what}: {value}. Toque para responder com outra.",
      "j.card.version": "Versão {n}",
      "j.card.built": "Montado com as suas respostas",
      "j.card.built_hint": "Toque em uma linha para responder com outra resposta. O programa é refeito aqui mesmo.",
      "j.card.ticks": "Respostas usadas neste programa",
      "j.card.adjusted": "O que o Taurifer ajustou",
      "j.card.constraints": "Suas restrições",
      "j.card.updated": "Programa refeito com a sua resposta.",
      "j.card.constraints_applied": "Restrições aplicadas.",
      "j.card.before": "Antes",
      "j.card.after": "Agora",
      "j.card.facts": "{ex} · {sets}",
      "j.card.folded": "Versão {n}, substituída pela de baixo: {name} · {facts}",
      "j.card.more_days": "Os outros dias",
      "j.card.prio_none": "Sem prioridades",
      "j.sheet.title": "Responder",
      "j.sheet.close": "Manter como estava",
      "j.sheet.send": "Enviar resposta",
      "j.sheet.error_title": "Não foi possível refazer o programa",
      "j.cancel.body": "Suas respostas podem ficar salvas neste dispositivo para você continuar depois. O que já está ativo não muda.",
      "j.cancel.keep": "Salvar respostas e sair",
      "j.cancel.discard": "Apagar esta conversa e sair",
      "j.cancel.continue": "Continuar respondendo",
      "j.restart.confirm": "Apagar e começar de novo",
      "j.imp.lede": "Cole do jeito que estiver: mensagem do treinador, suas notas, uma planilha ou outro lugar. O Taurifer monta um comando para o ChatGPT ou o Claude, que devolve o programa no formato do app.",
      "j.imp.attach_hint": "Tem um arquivo de programa Taurifer? Toque no clipe para anexar.",
      "j.imp.pasted": "Colado",
      "j.imp.handoff": "O Taurifer não lê texto livre. Um assistente que você abre converte o seu texto para o formato do app, e o Taurifer confere o resultado antes de salvar qualquer coisa.",
      "j.imp.copy": "Copiar o comando",
      "j.imp.opened": "Você abriu o {provider} com o comando.",
      "j.imp.copied": "Você copiou o comando.",
      "j.imp.reply_label": "Resposta do {provider}, colada",
      "j.imp.reply_label_any": "Resposta do assistente, colada",
      "j.imp.gaps_title": "Complete o que falta",
      "j.imp.gaps_lede": "A resposta trouxe a estrutura do programa, mas faltam algumas séries ou repetições. Preencha os campos e envie.",
      "j.imp.gap_sets": "{name}: {v} séries",
      "j.imp.gap_reps": "{name}: {v} repetições",
      "j.imp.commit": "Revisar o programa",
      "j.imp.file_name": "Treino do Rafael.json",
      "j.imp.file_meta": "Arquivo de programa Taurifer · {n} exercícios",
      "j.imp.more": "Outras opções",
      "j.imp.progression": "Progressão",
      "j.attach.title": "Anexar",
      "j.attach.file": "Arquivo de programa Taurifer",
      "j.attach.discard": "O texto colado nesta conversa será descartado.",
      "j.attach.close": "Voltar à conversa",
      "j.read_more": "Ler mais",
      "j.ffmsg.error": "Informe valores válidos nos campos destacados.",
    },
    en: {
      "j.name": "J · Conversation",
      "j.status.landing": "No account · on this device",
      "j.status.review": "Program to review",
      "j.status.import": "Import a program",
      "j.status.ready": "Ready to start",
      "j.back": "Back one question",
      "j.back_import": "Back one step",
      "j.leave": "Leave",
      "j.leave_aria": "Leave program setup",
      "j.privacy_aria": "Privacy: how Taurifer keeps your data",
      "j.land.caption": "This is the Today screen once a program is active.",
      "j.land.open_image": "Open the Today screen image",
      "j.media.close": "Close the image",
      "j.you": "You",
      "j.edited": "edited",
      "j.rec.intro": "Five short sections. Tap an answer, or paste a program you already train below.",
      "j.rec.active": "Active program: {name}",
      "j.q.exp": "How long have you followed structured training programs?",
      "j.q.cons": "And in the past six weeks, how many of your planned sessions did you do?",
      "j.q.days": "How many days a week can you train?",
      "j.q.minutes": "How long is a usual session, at most?",
      "j.q.rest": "How long do you like to rest between demanding sets?",
      "j.q.env": "Where do you train?",
      "j.q.env_check": "{env} includes: {equipment}. Is that right?",
      "j.q.env_check_none": "With {env}, Taurifer assumes no equipment. Is that right?",
      "j.env.ok": "That's right",
      "j.env.fix": "Correct the equipment",
      "j.env.fix_title": "Mark what is there where you train.",
      "j.env.fixed": "Corrected: {list}",
      "j.env.fixed_none": "Corrected: no equipment",
      "j.q.prio": "Want to prioritize a muscle or avoid an exercise? It is optional.",
      "j.prio.none": "No priorities",
      "j.prio.open": "Choose priorities",
      "j.prio.limit": "You already chose two muscles. Clear one to switch.",
      "j.prio.sent_prio": "Prioritize {list}",
      "j.prio.sent_avoid": "Avoid {list}",
      "j.unit.days": "days",
      "j.unit.min": "min",
      "j.a.days": "{n} days a week",
      "j.a.minutes": "Up to {n} min a session",
      "j.a.minutes_90": "90 min or more a session",
      "j.c.tap": "Tap an answer above",
      "j.c.send": "Send",
      "j.c.paste": "Paste a program I already have",
      "j.c.attach": "Attach a program file",
      "j.c.fix_draft": "Send the equipment correction",
      "j.c.prio_draft": "Send the priorities",
      "j.c.prio_empty": "Choose above or tap No priorities",
      "j.c.ff_in": "Paste your program here",
      "j.c.ff_wait": "Open ChatGPT or Claude above",
      "j.c.gaps": "Fill in the details above and send",
      "j.c.send_aria": "Send",
      "j.what.goal": "Goal", "j.what.exp": "Time on programs", "j.what.cons": "Past six weeks", "j.what.days": "Days per week", "j.what.minutes": "Session length", "j.what.rest": "Rest", "j.what.env": "Where you train", "j.what.prio": "Priorities",
      "j.reply.aria": "Reply to {what}: {value}",
      "j.ans.aria": "Your answer, {what}: {value}. Tap to reply with another.",
      "j.card.version": "Version {n}",
      "j.card.built": "Built from your answers",
      "j.card.built_hint": "Tap a line to reply with another answer. The program is rebuilt right here.",
      "j.card.ticks": "Answers used in this program",
      "j.card.adjusted": "What Taurifer adjusted",
      "j.card.constraints": "Your constraints",
      "j.card.updated": "Program rebuilt with your reply.",
      "j.card.constraints_applied": "Constraints applied.",
      "j.card.before": "Before",
      "j.card.after": "Now",
      "j.card.facts": "{ex} · {sets}",
      "j.card.folded": "Version {n}, replaced by the one below: {name} · {facts}",
      "j.card.more_days": "The other days",
      "j.card.prio_none": "No priorities",
      "j.sheet.title": "Reply",
      "j.sheet.close": "Keep as it was",
      "j.sheet.send": "Send reply",
      "j.sheet.error_title": "The program could not be rebuilt",
      "j.cancel.body": "Your answers can stay saved on this device so you can continue later. Nothing already active changes.",
      "j.cancel.keep": "Save answers and leave",
      "j.cancel.discard": "Delete this conversation and leave",
      "j.cancel.continue": "Keep answering",
      "j.restart.confirm": "Delete and start over",
      "j.imp.lede": "Paste it however you have it: a message from your trainer, your notes, a spreadsheet or anywhere else. Taurifer writes a prompt for ChatGPT or Claude, which returns the program in the app's format.",
      "j.imp.attach_hint": "Have a Taurifer program file? Tap the paperclip to attach it.",
      "j.imp.pasted": "Pasted",
      "j.imp.handoff": "Taurifer does not read free text. An assistant you open converts your text into the app's format, and Taurifer checks the result before anything is saved.",
      "j.imp.copy": "Copy the prompt",
      "j.imp.opened": "You opened {provider} with the prompt.",
      "j.imp.copied": "You copied the prompt.",
      "j.imp.reply_label": "{provider} reply, pasted",
      "j.imp.reply_label_any": "Assistant reply, pasted",
      "j.imp.gaps_title": "Fill in what is missing",
      "j.imp.gaps_lede": "The reply brought back the program's structure, but some sets or reps are missing. Fill in the fields and send.",
      "j.imp.gap_sets": "{name}: {v} sets",
      "j.imp.gap_reps": "{name}: {v} reps",
      "j.imp.commit": "Review the program",
      "j.imp.file_name": "Rafael's program.json",
      "j.imp.file_meta": "Taurifer program file · {n} exercises",
      "j.imp.more": "Other options",
      "j.imp.progression": "Progression",
      "j.attach.title": "Attach",
      "j.attach.file": "Taurifer program file",
      "j.attach.discard": "The text pasted in this conversation will be discarded.",
      "j.attach.close": "Back to the conversation",
      "j.read_more": "Read more",
      "j.ffmsg.error": "Please enter valid numbers for the highlighted fields.",
    },
  };

  /* ---------- icons: one authored set, 24 grid, 1.9 stroke, round ---------- */
  const P = {
    back: '<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    dcheck: '<path d="M2.5 12.8l4 4L16 7.2"/><path d="M11.2 16.2l.6.6L21.3 7.2"/>',
    reply: '<path d="M9.5 6.5L4 12l5.5 5.5"/><path d="M4.5 12H14a6 6 0 016 6v1"/>',
    fwd: '<path d="M14.5 6.5L20 12l-5.5 5.5"/><path d="M19.5 12H10a6 6 0 00-6 6v1"/>',
    clip: '<path d="M19.5 11.2l-7.7 7.7a4.8 4.8 0 01-6.8-6.8l8-8a3.2 3.2 0 014.5 4.5l-7.9 7.9a1.6 1.6 0 01-2.3-2.3l7.3-7.3"/>',
    send: '<path d="M5 12l14-7-4.2 14-3.3-5.7z"/><path d="M11.5 13.3L19 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    chev: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
    doc: '<path d="M7.2 3.5h6.9l4.4 4.4v11.6c0 .6-.4 1-1 1H7.2c-.6 0-1-.4-1-1v-15c0-.6.4-1 1-1z"/><path d="M14 3.7V8h4.3M9.3 12.5h5.4M9.3 16h5.4"/>',
    paste: '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9.5 4.5v-.3c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v.3M9.5 10.5h5M9.5 14h5"/>',
    search: '<circle cx="10.8" cy="10.8" r="6"/><path d="M15.3 15.3L20 20"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    alert: '<path d="M12 4l8.5 15h-17z"/><path d="M12 10v4M12 16.8v.2"/>',
    arrow: '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5"/>',
    redo: '<path d="M5 12a7 7 0 0112-5l2 2"/><path d="M19 4.5V9h-4.5"/><path d="M19 12a7 7 0 01-12 5"/>',
    open: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M17 13.5v5a1 1 0 01-1 1H5.5a1 1 0 01-1-1V8a1 1 0 011-1h5"/>',
  };
  const ico = (n, cls = "") => `<svg class="j-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;

  let t, lang, root, S, theme;
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const reduced = () => document.documentElement.dataset.motion === "reduced" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const exLabel = (id) => { const e = TF.libraryEntry(id); return e ? TF.libraryName(e, lang) : id; };
  const listJoin = (arr) => arr.filter(Boolean).join(", ");

  /* ---------- the Recommend question script ---------- */
  const QS = [
    { key: "desiredResult", step: "desired_result", what: "goal" },
    { key: "structuredExperience", step: "background", what: "exp" },
    { key: "recentConsistency", step: "background", what: "cons" },
    { key: "daysPerWeek", step: "schedule", what: "days" },
    { key: "sessionMinutes", step: "schedule", what: "minutes" },
    { key: "preferredRestSeconds", step: "schedule", what: "rest" },
    { key: "environment", step: "environment", what: "env" },
  ];
  const SECTION = { desired_result: 1, background: 2, schedule: 3, environment: 4, priorities: 5 };
  const KEY_WHAT = Object.fromEntries(QS.map((q) => [q.key, q.what]));
  const answered = (a, k) => (k === "preferredRestSeconds" ? has(a, k) : a[k] !== undefined && a[k] !== null && a[k] !== "");
  const questionText = (key) => ({ desiredResult: t("entry.desired_result.title"), structuredExperience: t("j.q.exp"), recentConsistency: t("j.q.cons"), daysPerWeek: t("j.q.days"), sessionMinutes: t("j.q.minutes"), preferredRestSeconds: t("j.q.rest"), environment: t("j.q.env") }[key]);
  const questionNote = (key) => ({ structuredExperience: t("entry.background.lede"), sessionMinutes: t("entry.schedule.lede"), environment: t("entry.environment.lede") }[key] || "");
  function options(key) {
    if (key === "desiredResult") return TS.DESIRED.map((v) => ({ val: v, title: t(`entry.desired_result.${v}.label`), sub: t(`entry.desired_result.${v}.sub`) }));
    if (key === "structuredExperience") return TS.EXPERIENCE.map((v) => ({ val: v, title: t(`entry.background.experience.${v}`) }));
    if (key === "recentConsistency") return TS.CONSISTENCY.map((v) => ({ val: v, title: t(`entry.background.consistency.${v}`) }));
    if (key === "daysPerWeek") return TS.DAYS.map((v) => ({ val: v, num: String(v), unit: t("j.unit.days") }));
    if (key === "sessionMinutes") return TS.MINUTES.map((v) => ({ val: v, num: v === 90 ? "90+" : String(v), unit: t("j.unit.min") }));
    if (key === "preferredRestSeconds") return TS.REST.map((v) => ({ val: v, title: t(`entry.schedule.rest.${v}`) }));
    if (key === "environment") return TS.ENVS.map((v) => ({ val: v, title: t(`entry.environment.${v}`) }));
    return [];
  }
  const valOf = (a, key) => (key === "environment" ? a.environment && a.environment.kind : key === "preferredRestSeconds" ? (a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds) : a[key]);
  function answerText(a, key) {
    const v = a[key];
    if (key === "desiredResult") return t(`entry.desired_result.${v}.label`);
    if (key === "structuredExperience") return t(`entry.background.experience.${v}`);
    if (key === "recentConsistency") return t(`entry.background.consistency.${v}`);
    if (key === "daysPerWeek") return t("j.a.days", { n: v });
    if (key === "sessionMinutes") return v >= 90 ? t("j.a.minutes_90") : t("j.a.minutes", { n: v });
    if (key === "preferredRestSeconds") return t(`entry.schedule.rest.${v === null ? "auto" : v}`);
    if (key === "environment") return a.environment ? t(`entry.environment.${a.environment.kind}`) : "";
    if (key === "priorities") return prioText(a);
    if (key === "envCheck") return envCheckText(a);
    return "";
  }
  const sameSet = (x, y) => JSON.stringify([...(x || [])].sort()) === JSON.stringify([...(y || [])].sort());
  const envAdjusted = (e) => { if (!e) return false; const b = TF.env(e.kind); return !(sameSet(b.equipment, e.equipment) && sameSet(b.capabilities, e.capabilities)); };
  const equipList = (e) => [...(e?.equipment || []).map((k) => t(`entry.equip.${k}`, undefined, k)), ...(e?.capabilities || []).map((k) => t(`entry.cap.${k}`, undefined, k))].map((x, i) => (i === 0 ? x : /^Smith/.test(x) ? x : lcFirst(x)));
  function envCheckText(a) {
    if (!envAdjusted(a.environment)) return t("j.env.ok");
    const l = equipList(a.environment); return l.length ? t("j.env.fixed", { list: listJoin(l) }) : t("j.env.fixed_none");
  }
  function prioText(a) {
    const parts = [];
    const m = (a.primaryMuscles || []).map((x) => lcFirst(t(`entry.muscle.${x}`)));
    const mv = (a.priorityMovements || []).map((x) => lcFirst(t(`entry.movement.${x}`)));
    if (m.length || mv.length) parts.push(t("j.prio.sent_prio", { list: listJoin([...m, ...mv]) }));
    const av = (a.exerciseConstraints || []).map((c) => `${exLabel(c.exerciseId)} (${lcFirst(t(`entry.priorities.reason.${c.reason}`))})`);
    if (av.length) parts.push(t("j.prio.sent_avoid", { list: listJoin(av) }));
    return parts.join(" · ") || t("j.prio.none");
  }

  /* ---------- state ---------- */
  function blank(view) {
    return { view, route: null, landingPick: null, answers: {}, envOk: false, envFix: false, prioDone: false, prioOpen: false, avoid: { query: "", pending: null }, versions: [], lastPreview: null, edited: {}, sheet: null, overlay: null, notice: null, revAtStart: TF.liveRevision(), actError: null, compileError: null, importMode: "freeform", importDraft: null, importKept: null, importHeld: null, fileSent: false, ff: TS.freeform.create(), ffSent: null, gapSent: null, picker: null, cpTag: null, toast: null };
  }
  function fresh(seed) { TF.seedDevice(seed || "fresh"); S = blank(TF.hasActiveProgram() ? "today" : "landing"); }
  const answers = () => TF.normalizeAnswers(S.answers);
  const result = () => (S.versions.length ? S.versions[S.versions.length - 1].result : null);
  const name = () => TF.resultName(result(), lang) || t("untitled_program");
  function recStep() {
    const a = S.answers;
    if (!answered(a, "desiredResult")) return "desired_result";
    if (!answered(a, "structuredExperience") || !answered(a, "recentConsistency")) return "background";
    if (!answered(a, "daysPerWeek") || !answered(a, "sessionMinutes") || !answered(a, "preferredRestSeconds")) return "schedule";
    if (!answered(a, "environment") || !S.envOk) return "environment";
    if (!S.prioDone) return "priorities";
    return "result";
  }
  function step() {
    if (S.route === "recommend") return recStep();
    if (S.route === "import") return result() ? "preview" : "import_source";
    return null;
  }
  const reviewing = () => (S.route === "recommend" || S.route === "import") && !!result() && (step() === "result" || step() === "preview");
  const noAnswers = () => S.route === "recommend" && !Object.keys(S.answers).length;

  function compileWith(a) {
    const r = TF.compile("recommend", a);
    if (!r.ok) return { ok: false, text: TS.issueText(t, r) };
    return { ok: true, result: TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, alternative: r.alternative, preview: r.preview, explanation: r.explanation }) };
  }
  /* The first program of a walk. A change statement only when it is true:
     the answers changed since the last program, or constraints were applied. */
  function compileFirst() {
    const r = compileWith(answers());
    S.compileError = r.ok ? null : r.text; S.versions = [];
    if (!r.ok) return;
    let changeFrom = null;
    if (S.lastPreview && TF.identityDiff(S.lastPreview, r.result.preview).n > 0) changeFrom = { preview: S.lastPreview };
    else if ((S.answers.exerciseConstraints || []).length) { const w = compileWith({ ...answers(), exerciseConstraints: [] }); if (w.ok) changeFrom = { preview: w.result.preview, constraints: true }; }
    S.versions.push({ result: r.result, changeFrom, reply: null });
    S.lastPreview = null;
  }
  function stateFor(st) { return TF.entryState({ route: S.route, answers: S.route === "import" ? {} : answers(), result: result(), step: st || step(), activeProgramRevisionAtStart: S.revAtStart }); }
  function keepDraft() {
    const st = step(); let r = { ok: false };
    try { r = TF.saveDraft(stateFor(st), { ui: TF.jsonClean({ envOk: S.envOk, prioDone: S.prioDone }) }); } catch (e) { r = { ok: false }; }
    if (!r.ok) { try { TF.saveDraft(TF.entryState({ route: S.route, answers: S.route === "import" ? {} : answers(), step: st === "result" ? "priorities" : st, activeProgramRevisionAtStart: S.revAtStart })); } catch (e) { /* nothing kept */ } }
  }
  function leaveSetup() { S = blank(TF.hasActiveProgram() ? "today" : "landing"); render({ scroll: "top", focus: "heading" }); }
  function startRoute(route, { pick = null, mode = "freeform" } = {}) {
    const keep = S.landingPick; S = blank("chat"); S.route = route; S.landingPick = pick || keep; S.importMode = mode;
  }

  /* ---------- time stamps: the moment each message first appeared ---------- */
  const times = {};
  const stamp = (id) => { if (!times[id]) { const d = new Date(); times[id] = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; } return times[id]; };

  /* ---------- message builders ---------- */
  /* A message: { id, from: "in" | "out" | "sys" | "chips", html, cls, cp } */
  const meta = (id, { ticks = 0, edited = false } = {}) => `<span class="j-meta">${edited ? `<span class="j-meta__ed">${esc(t("j.edited"))}</span>` : ""}<span class="j-meta__time">${stamp(id)}</span>${ticks ? `<span class="j-meta__ticks${ticks === 2 ? " is-used" : ""}">${ico(ticks === 2 ? "dcheck" : "check")}</span>` : ""}</span>`;
  const inMsg = (id, body, { cls = "", cp = "", label = "" } = {}) => ({ id, from: "in", cp, html: `<div class="j-bubble j-in ${cls}"${label ? ` aria-label="${esc(label)}"` : ""}>${body}${meta(id)}</div>` });
  const sysMsg = (id, body, { cls = "", cp = "" } = {}) => ({ id, from: "sys", cp, html: `<div class="j-sys ${cls}">${body}</div>` });
  function ansBubble(id, key, val, text, { what, quote = null, label = null, src = null } = {}) {
    const used = !!result() && S.route === "recommend";
    const w = what || t(`j.what.${KEY_WHAT[key] || (key === "priorities" ? "prio" : "env")}`);
    return { id, from: "out", html: `<button type="button" class="j-bubble j-out j-ans" data-act="reply" data-key="${esc(key)}" data-val="${esc(val)}"${src ? ` data-src="${src}"` : ""} aria-label="${esc(t("j.ans.aria", { what: lcFirst(w), value: text }))}">${quote ? quoteBlock(quote.what, quote.text) : ""}${label ? `<span class="j-label">${label}</span>` : ""}<span class="j-ans__t">${esc(text)}</span><span class="j-ans__swipe" aria-hidden="true">${ico("reply")}</span>${meta(id, { ticks: used ? 2 : 1, edited: !!S.edited[key] })}</button>` };
  }
  const outMsg = (id, body, { cls = "", label = "" } = {}) => ({ id, from: "out", html: `<div class="j-bubble j-out ${cls}">${label ? `<span class="j-label">${label}</span>` : ""}${body}${meta(id, { ticks: 1 })}</div>` });
  const quoteBlock = (what, text) => `<span class="j-quote"><span class="j-quote__bar" aria-hidden="true"></span><span class="j-quote__body"><span class="j-quote__who">${esc(t("j.you"))} · ${esc(what)}</span><span class="j-quote__text">${esc(text)}</span></span></span>`;
  /* Quick replies for the question being asked. */
  function chipsMsg(id, key) {
    const opts = options(key);
    const numeric = key === "daysPerWeek" || key === "sessionMinutes";
    const html = `<div class="j-replies${numeric ? " j-replies--num" : ""}" role="group" aria-labelledby="q-${id}">${opts.map((o) => `<button type="button" class="j-qr${o.sub ? " j-qr--sub" : ""}${numeric ? " j-qr--num" : ""}" data-act="pick" data-key="${key}" data-val="${esc(o.val)}"${numeric ? ` aria-label="${esc(o.num)} ${esc(o.unit)}"` : ""}>${numeric ? `<span class="j-qr__n">${esc(o.num)}</span><span class="j-qr__u" aria-hidden="true">${esc(o.unit)}</span>` : `<span class="j-qr__t">${esc(o.title)}</span>${o.sub ? `<span class="j-qr__s">${esc(o.sub)}</span>` : ""}`}</button>`).join("")}</div>`;
    return { id: id + ":chips", from: "chips", html };
  }
  const qMsg = (id, text, note = "", { cp = "" } = {}) => inMsg(id, `<p class="j-q" id="q-${id}">${esc(text)}</p>${note ? `<p class="j-note">${esc(note)}</p>` : ""}`, { cp });
  /* Buttons attached under a bubble (the interactive-message grammar). */
  const attached = (btns) => `<div class="j-attached">${btns.join("")}</div>`;
  const attBtn = ({ act, label, extra = "", id = "", icon = "", danger = false, primary = false }) => `<button type="button" class="j-att${danger ? " is-danger" : ""}${primary ? " is-primary" : ""}"${id ? ` id="${id}"` : ""} data-act="${act}"${extra}>${icon ? ico(icon) : ""}<span>${esc(label)}</span></button>`;

  /* The landing opening: kept above the conversation it starts. */
  function landingMessages({ live }) {
    const m = [];
    const src = TF.asset(`vendor/brand/today-ready-${lang === "pt" ? "pt" : "en"}-${theme}.webp`);
    const img = `<img src="${esc(src)}" width="903" height="1832" decoding="async" alt="${esc(t("landing.shot.today_ready.alt"))}">`;
    m.push(sysMsg("land:lock", `${ico("lock")}<span>${esc(t("x.privacy.line"))}</span>`, { cls: "j-sys--lock" }));
    m.push({ id: "land:img", from: "in", html: `<div class="j-bubble j-in j-media">${live ? `<button type="button" class="j-media__btn" data-act="media-open" aria-haspopup="dialog">${img}<span class="visually-hidden">${esc(t("j.land.open_image"))}</span></button>` : `<span class="j-media__btn">${img}</span>`}<p class="j-media__cap">${esc(t("j.land.caption"))}</p>${meta("land:img")}</div>` });
    const head = `<p class="j-headline">${esc(t("landing.headline"))}</p><p class="j-body">${esc(t("landing.body"))}</p>`;
    if (live) m.push({ id: "land:pitch", from: "in", cp: "", html: `<div class="j-bubble j-in j-pitch">${head}${meta("land:pitch")}${attached([attBtn({ act: "land-create", id: "firstRunCreate", label: t("landing.build"), primary: true, icon: "arrow" }), attBtn({ act: "land-import", id: "firstRunImport", label: t("landing.track"), icon: "paste" })])}</div>` });
    else {
      m.push(inMsg("land:pitch", head, { cls: "j-pitch" }));
      if (S.landingPick) m.push(outMsg(`land:pick:${S.landingPick}`, `<span class="j-ans__t">${esc(t(S.landingPick === "import" ? "landing.track" : "landing.build"))}</span>`));
    }
    return m;
  }
  function activeMsgs() {
    if (!TF.hasActiveProgram()) return [];
    const first = noAnswers() || (S.route === "import" && !S.importDraft && S.ff.stage === 1 && !S.fileSent && !result());
    return [sysMsg("active", `<strong>${esc(t("j.rec.active", { name: TF.activeName(lang) }))}</strong><span>${esc(t("entry.active_notice"))}</span>`, { cls: "j-sys--active", cp: first ? "hub-existing" : "" })];
  }

  /* ---------- Recommend thread ---------- */
  function recMessages() {
    const m = [];
    if (S.landingPick) m.push(...landingMessages({ live: false }));
    m.push(...activeMsgs());
    const offer = noAnswers() ? attached([attBtn({ act: "to-paste", label: t("j.c.paste"), icon: "paste" }), attBtn({ act: "import-mode", label: t("j.c.attach"), icon: "clip", extra: ' data-mode="file" aria-haspopup="dialog"' })]) : "";
    m.push(inMsg("intro", `<p class="j-body">${esc(t("j.rec.intro"))}</p><p class="j-note">${esc(t("entry.result.lede"))}</p>${offer}`, { cp: noAnswers() ? "route-choice" : "" }));
    const a = S.answers;
    for (const q of QS) {
      m.push(qMsg(`q:${q.key}`, questionText(q.key), questionNote(q.key)));
      if (!answered(a, q.key)) { m.push(chipsMsg(`q:${q.key}`, q.key)); return m; }
      m.push(ansBubble(`a:${q.key}`, q.key, valOf(a, q.key), answerText(a, q.key)));
    }
    /* Environment: what the choice includes, confirmed or corrected. */
    const e = a.environment; const base = TF.env(e.kind); const l = equipList(base);
    m.push(inMsg("q:envCheck", `<p class="j-q" id="q-q:envCheck">${esc(l.length ? t("j.q.env_check", { env: t(`entry.environment.${e.kind}`), equipment: listJoin(l) }) : t("j.q.env_check_none", { env: lcFirst(t(`entry.environment.${e.kind}`)) }))}</p>`));
    if (!S.envOk) {
      if (S.envFix) m.push(envFixMsg());
      else m.push({ id: "q:envCheck:chips", from: "chips", html: `<div class="j-replies" role="group" aria-labelledby="q-q:envCheck"><button type="button" class="j-qr" data-act="env-ok">${esc(t("j.env.ok"))}</button><button type="button" class="j-qr" data-act="env-fix">${esc(t("j.env.fix"))}</button></div>` });
      return m;
    }
    m.push(ansBubble("a:envCheck", "envCheck", e.kind, envCheckText(a), { what: t("j.what.env") }));
    m.push(qMsg("q:prio", t("j.q.prio")));
    if (!S.prioDone) {
      if (S.prioOpen) m.push(prioMsg());
      else m.push({ id: "q:prio:chips", from: "chips", html: `<div class="j-replies" role="group" aria-labelledby="q-q:prio"><button type="button" class="j-qr" data-act="prio-none">${esc(t("j.prio.none"))}</button><button type="button" class="j-qr" data-act="prio-open">${esc(t("j.prio.open"))}</button></div>` });
      return m;
    }
    m.push(ansBubble("a:prio", "priorities", "set", prioText(a)));
    m.push(...versionMessages());
    return m;
  }
  function envFixMsg() {
    const e = S.answers.environment || TF.env("other");
    return inMsg("q:envFix", `<p class="j-q">${esc(t("j.env.fix_title"))}</p>${envToggles(e)}<p class="j-note">${esc(t("entry.env_correct.note"))}</p>`, { cls: "j-form", cp: "rec-env-correction" });
  }
  const toggle = (key, val, label, on, { disabled = false } = {}) => `<button type="button" class="j-tog${on ? " is-on" : ""}" role="checkbox" aria-checked="${on}" data-act="pick" data-key="${key}" data-val="${esc(val)}"${disabled ? " disabled" : ""}><span class="j-tog__box" aria-hidden="true">${ico("check")}</span><span class="j-tog__t">${esc(label)}</span></button>`;
  function envToggles(e) {
    const eq = new Set(e.equipment || []), caps = new Set(e.capabilities || []);
    return `<p class="j-sub" id="jEq">${esc(t("entry.env_correct.equipment"))}</p><div class="j-togs" role="group" aria-labelledby="jEq">${TS.EQUIP.map((k) => toggle("environmentEquipment", k, t(`entry.equip.${k}`, undefined, k), eq.has(k))).join("")}</div>
      <p class="j-sub" id="jCaps">${esc(t("entry.env_correct.capabilities"))}</p><div class="j-togs" role="group" aria-labelledby="jCaps">${TS.CAPS.map((k) => toggle("environmentCapabilities", k, t(`entry.cap.${k}`, undefined, k), caps.has(k))).join("")}</div>`;
  }
  function prioBody(a, st, { searchId = "avoidSearch" } = {}) {
    const prim = a.primaryMuscles || [];
    const full = prim.length >= 2;
    const taken = new Set((a.exerciseConstraints || []).map((c) => c.exerciseId)); if (st.pending) taken.add(st.pending);
    const matches = TF.searchLibrary(st.query, lang, { exclude: taken, limit: 5 });
    const hasPain = (a.exerciseConstraints || []).some((c) => c.reason === "pain");
    const reasonBlock = (id, reason, pending) => `<div class="j-avoid" role="group" aria-label="${esc(t("entry.priorities.avoid_reason", { exercise: exLabel(id) }))}"><div class="j-avoid__head"><strong>${esc(exLabel(id))}</strong><button type="button" class="j-link" data-act="avoid-remove" data-id="${esc(id)}">${esc(t("entry.priorities.avoid_remove"))}</button></div><p class="j-sub">${esc(t("entry.priorities.avoid_reason", { exercise: exLabel(id) }))}</p><div class="j-togs j-togs--radio" role="radiogroup">${TS.REASONS.map((r) => `<button type="button" class="j-tog j-tog--radio${reason === r ? " is-on" : ""}" role="radio" aria-checked="${reason === r}" data-act="pick" data-key="avoidReason" data-val="${esc(id)}|${r}"><span class="j-tog__box" aria-hidden="true"></span><span class="j-tog__t">${esc(t(`entry.priorities.reason.${r}`))}</span></button>`).join("")}</div>${pending ? `<p class="j-note" id="pendingAvoidNote">${esc(t("entry.priorities.reason_required"))}</p>` : ""}</div>`;
    return `<p class="j-sub" id="jPrim">${esc(t("entry.priorities.primary"))}</p><p class="j-note">${esc(full ? t("j.prio.limit") : t("entry.priorities.lede"))}</p><div class="j-togs" role="group" aria-labelledby="jPrim">${TS.MUSCLES.map((m) => toggle("primaryMuscles", m, t(`entry.muscle.${m}`), prim.includes(m), { disabled: full && !prim.includes(m) })).join("")}</div>
      <p class="j-sub" id="jMov">${esc(t("entry.priorities.movements"))}</p><div class="j-togs" role="group" aria-labelledby="jMov">${TS.MOVEMENTS.map((m) => toggle("priorityMovements", m, t(`entry.movement.${m}`), (a.priorityMovements || []).includes(m))).join("")}</div>
      <p class="j-sub" id="jAvoidL">${esc(t("entry.priorities.avoid"))}</p>
      <label class="j-search">${ico("search")}<span class="visually-hidden">${esc(t("entry.priorities.avoid_search"))}</span><input id="${searchId}" type="search" autocomplete="off" data-field="avoidQuery" value="${esc(st.query || "")}" placeholder="${esc(t("entry.priorities.avoid_search"))}"></label>
      ${matches.length ? `<div class="j-results" role="list">${matches.map((e) => `<button type="button" class="j-result" role="listitem" data-act="avoid-add" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span>${ico("plus")}</button>`).join("")}</div>` : ""}
      ${st.pending ? reasonBlock(st.pending, null, true) : ""}${(a.exerciseConstraints || []).map((c) => reasonBlock(c.exerciseId, c.reason, false)).join("")}
      ${hasPain ? `<p class="j-sysline" role="note">${ico("alert")}<span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}`;
  }
  function prioMsg() {
    const pain = (S.answers.exerciseConstraints || []).some((c) => c.reason === "pain");
    return inMsg("q:prioForm", prioBody(S.answers, S.avoid), { cls: "j-form", cp: pain ? "rec-avoid-pain" : "" });
  }

  /* ---------- the program as a message ---------- */
  const factsOf = (p) => { const f = TF.previewFacts(p); return t("j.card.facts", { ex: t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), sets: t("entry.preview.sets", { n: f.sets }) }); };
  function addedIds(before, after) {
    const count = new Map(); for (const e of before.program || []) { const k = TF.exerciseIdentity(e); count.set(k, (count.get(k) || 0) + 1); }
    const added = new Set();
    for (const e of after.program || []) { const k = TF.exerciseIdentity(e); if (count.get(k)) count.set(k, count.get(k) - 1); else added.add(e.id); }
    return added.size && added.size < (after.program || []).length ? added : new Set();
  }
  function daysHtml(p, added) {
    const days = p.days || [];
    const day = (d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((n, e) => n + (+e.sets || 0), 0);
      const metaLine = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      const rows = ex.map((e) => `<li class="j-ex${added.has(e.id) ? " is-new" : ""}"><span class="j-ex__n">${esc(TS.exName(e, lang))}${added.has(e.id) ? `<span class="j-new">${esc(lang === "pt" ? "novo" : "new")}</span>` : ""}</span><span class="j-ex__rx">${e.sets != null ? `${e.sets}<span class="j-x">×</span>${e.min}–${e.max}` : ""}</span></li>`).join("");
      const head = `<span class="j-day__num" aria-hidden="true">${i + 1}</span><span class="j-day__name">${esc(TF.dayName(t, d, p.programStructure, i))}</span><span class="j-day__meta">${esc(metaLine)}</span>`;
      const open = i === 0 || ex.some((e) => added.has(e.id));
      return `<details class="j-day"${open ? " open" : ""}><summary>${head}${ico("chev", "j-day__chev")}</summary><ol class="j-exlist">${rows}</ol></details>`;
    };
    return `<div class="j-days">${days.map(day).join("")}</div>`;
  }
  function factRows(a) {
    const rows = [["desiredResult", "goal"], ["structuredExperience", "exp"], ["recentConsistency", "cons"], ["daysPerWeek", "days"], ["sessionMinutes", "minutes"], ["preferredRestSeconds", "rest"], ["environment", "env"], ["priorities", "prio"]];
    return rows.map(([key, w]) => {
      let text = answerText(a, key);
      if (key === "environment" && envAdjusted(a.environment)) text = `${text}: ${listJoin(equipList(a.environment)) || lcFirst(t("j.env.fixed_none").split(": ").pop())}`;
      const what = t(`j.what.${w}`);
      return `<li><button type="button" class="j-fact" data-act="reply" data-src="card" data-key="${key}" data-val="${esc(key === "priorities" ? "set" : valOf(a, key))}" aria-label="${esc(t("j.reply.aria", { what: lcFirst(what), value: text }))}"><span class="j-fact__k">${esc(what)}</span><span class="j-fact__v">${esc(text)}</span>${ico("reply", "j-fact__r")}</button></li>`;
    }).join("");
  }
  function changeBlock(v, i) {
    if (!v.changeFrom) return "";
    const b = v.changeFrom.preview, p = v.result.preview, d = TF.identityDiff(b, p);
    const fb = TF.previewFacts(b), fa = TF.previewFacts(p);
    const lead = v.changeFrom.constraints ? t("j.card.constraints_applied") : t("j.card.updated");
    const same = d.n === 0 && fb.sets === fa.sets;
    return `<div class="j-change" id="jChange${i}" tabindex="-1" role="status" data-change-statement data-changed="${d.n}" data-total="${d.total}"><p class="j-change__line">${ico("redo")}<span>${esc(lead)} <strong>${esc(TS.changeText(t, d))}</strong></span></p>${same ? "" : `<p class="j-change__ba"><span><span class="j-change__k">${esc(t("j.card.before"))}</span> ${esc(factsOf(b))}</span><span><span class="j-change__k">${esc(t("j.card.after"))}</span> ${esc(factsOf(p))}</span></p>`}</div>`;
  }
  function cardMsg(v, i, n) {
    const r = v.result, p = r.preview, f = TF.previewFacts(p); const rec = S.route === "recommend";
    const source = rec ? t("entry.preview.source.recommend") : t("entry.preview.source.import");
    const facts = [t("entry.catalogue.days_badge", { days: (p.days || []).length }), TF.durationLabel(t, p), t("entry.preview.exercises", { n: f.exercises, exercise: TF.tp(t, f.exercises, "exercise") }), t("entry.preview.sets", { n: f.sets })].filter(Boolean).join(" · ");
    const added = v.changeFrom && !v.changeFrom.constraints ? addedIds(v.changeFrom.preview, p) : new Set();
    let body = `<div class="j-card__head">${ico("doc", "j-card__doc")}<div class="j-card__id"><h2 class="j-card__name" id="jCardName"${rec ? "" : " data-user-text"}>${esc(TF.resultName(r, lang) || t("untitled_program"))}</h2><p class="j-card__src">${esc(source)}${n > 1 ? ` · ${esc(t("j.card.version", { n: i + 1 }))}` : ""}</p></div></div>
      ${changeBlock(v, i)}<p class="j-card__facts" id="jFacts">${esc(facts)}</p>
      <section class="j-card__sec" aria-labelledby="jWeek"><h3 class="visually-hidden" id="jWeek">${esc(t("entry.preview.days"))}</h3>${daysHtml(p, added)}</section>`;
    const adj = TS.adjustments(t, p);
    if (adj.length) body += `<section class="j-card__sec" aria-labelledby="jAdj"><h3 class="j-card__h" id="jAdj">${esc(t("j.card.adjusted"))}</h3><ul class="j-lines">${adj.map((x) => `<li>${ico("alert")}<span>${esc(x.text)}</span></li>`).join("")}</ul></section>`;
    if (rec) {
      const cons = TS.constraintLines(t, lang, answers());
      if (cons.length) body += `<section class="j-card__sec" aria-labelledby="jCons"><h3 class="j-card__h" id="jCons">${esc(t("j.card.constraints"))}</h3><ul class="j-lines">${cons.map((x) => `<li>${ico(x.kind === "avoid" ? "x" : "check")}<span>${esc(x.text)}</span></li>`).join("")}</ul></section>`;
      body += `<section class="j-card__sec" aria-labelledby="jBuilt"><h3 class="j-card__h" id="jBuilt">${esc(t("j.card.built"))}</h3><p class="j-note">${esc(t("j.card.built_hint"))}</p><ul class="j-facts">${factRows(S.answers)}</ul></section>`;
      const reasons = TS.reasons(t, lang, r, answers());
      body += `<details class="j-why"><summary><span>${esc(t("entry.result.why"))}</span>${ico("chev", "j-day__chev")}</summary><ul class="j-lines">${reasons.map((x) => `<li>${ico("check")}<span>${esc(x.text)}</span></li>`).join("")}</ul><p class="j-note">${esc(t("entry.result.lede"))}</p></details>`;
    } else {
      body += `<section class="j-card__sec" aria-labelledby="jProg"><h3 class="j-card__h" id="jProg">${esc(t("j.imp.progression"))}</h3><ul class="j-lines"><li>${ico("check")}<span>${esc(t(TF.progressionCopyKey(p)))}</span></li><li>${ico("check")}<span>${esc(t("import.safe"))}</span></li></ul></section>`;
    }
    if (TF.progressionIssue(p)) body += `<p class="j-sysline is-error" id="jBlocked" role="alert">${ico("alert")}<span>${esc(t("entry.preview.activation_blocked"))}</span></p>`;
    return { id: `card:${i}`, from: "in", html: `<article class="j-bubble j-in j-card" data-card aria-labelledby="jCardName">${body}${meta(`card:${i}`)}${attached([attBtn({ act: "restart", id: "jRestart", label: t("entry.preview.restart"), danger: true, extra: ' aria-haspopup="dialog"' })])}</article>` };
  }
  function versionMessages() {
    const m = []; const n = S.versions.length;
    if (!n) { m.push(inMsg("card:error", `<p class="j-q">${esc(t("j.sheet.error_title"))}</p><p class="j-body">${esc(S.compileError || t("x.issue.compile"))}</p>`, { cls: "is-error" })); return m; }
    S.versions.forEach((v, i) => {
      if (v.reply) m.push(ansBubble(`reply:${i}`, v.reply.key, v.reply.val, v.reply.text, { what: v.reply.what, quote: { what: v.reply.what, text: v.reply.old } }));
      if (i < n - 1) m.push(inMsg(`card:${i}`, `<p class="j-folded">${ico("doc")}<span>${esc(t("j.card.folded", { n: i + 1, name: TF.resultName(v.result, lang), facts: factsOf(v.result.preview) }))}</span></p>`, { cls: "j-card--folded" }));
      else m.push(cardMsg(v, i, n));
    });
    if (S.notice === "conflict") m.push(sysMsg("conflict", `<p class="j-sys__t">${ico("alert")}<strong>${esc(t("entry.conflict.title"))}</strong></p><p id="jConflictBody">${esc(t("entry.conflict.body"))}</p>${attached([attBtn({ act: "conflict-review", label: t("entry.conflict.review"), icon: "redo" })])}`, { cls: "j-sys--error", cp: "activation-conflict" }));
    if (S.actError) m.push(sysMsg("acterr", `<p id="jActError" tabindex="-1">${esc(S.actError)}</p>`, { cls: "j-sys--error" }));
    return m;
  }

  /* ---------- Import thread (paste door and file door) ---------- */
  const provName = (p) => (p === "claude" ? "Claude" : "ChatGPT");
  function impMessages() {
    const m = [];
    if (S.landingPick) m.push(...landingMessages({ live: false }));
    m.push(...activeMsgs());
    const canAttach = !S.fileSent && S.ff.stage === 1;
    m.push(inMsg("imp:intro", `<p class="j-q">${esc(t("entry.freeform.title"))}</p><p class="j-body">${esc(t("j.imp.lede"))}</p>${canAttach ? `<p class="j-note">${esc(t("j.imp.attach_hint"))}</p>` + attached([attBtn({ act: "import-mode", label: t("j.c.attach"), icon: "clip", extra: ' data-mode="file" aria-haspopup="dialog"' })]) : ""}`));
    m.push(sysMsg("imp:privacy", `${ico("lock")}<span>${esc(t("entry.freeform.privacy"))}</span>`, { cls: "j-sys--lock" }));
    const ff = S.ff; const program = TS.freeform.program(ff);
    if (S.importMode === "file" && S.fileSent) {
      const d = S.importDraft || S.importKept;
      m.push(outMsg("imp:file", `<span class="j-doc">${ico("doc")}<span class="j-doc__t"><span class="j-doc__n" data-user-text>${esc(t("j.imp.file_name"))}</span><span class="j-doc__m">${esc(t("j.imp.file_meta", { n: d ? d.rows.length : 0 }))}</span></span></span>`));
    } else if (ff.stage >= 2 && program) {
      m.push(outMsg("imp:pasted", `<pre class="j-pasted" data-user-text>${esc(ff.input.trim())}</pre>`, { label: `${ico("paste")}<span>${esc(t("j.imp.pasted"))}</span>` }));
      const prompt = TF.freeformPrompt(t, program);
      const opened = ff.stage >= 3;
      m.push(inMsg("imp:handoff", `<p class="j-q">${esc(t("entry.freeform.stage2_title"))}</p><p class="j-body">${esc(t("j.imp.handoff"))}</p><p class="j-note">${esc(t("entry.freeform.stage2_hint"))}</p><details class="j-why j-prompt"><summary><span>${esc(t("entry.freeform.preview_prompt"))}</span>${ico("chev", "j-day__chev")}</summary><pre class="j-pasted">${esc(prompt)}</pre></details>` + attached([
        `<a class="j-att${opened ? "" : " is-primary"}" href="https://chatgpt.com/?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt">${ico("open")}<span>${esc(t("entry.freeform.open_chatgpt"))}</span></a>`,
        `<a class="j-att" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude">${ico("open")}<span>${esc(t("entry.freeform.open_claude"))}</span></a>`,
        attBtn({ act: "ff", label: t("j.imp.copy"), extra: ' data-ff="copy"', icon: "paste" })])));
      if (opened) {
        m.push(sysMsg("imp:opened", `<span>${esc(ff.provider === "copy" ? t("j.imp.copied") : t("j.imp.opened", { provider: provName(ff.provider) }))}</span>`, { cls: "j-sys--event" }));
        const sent = S.ffSent;
        const live = !sent || ff.status === "unreadable";
        m.push(inMsg("imp:reply", `<p class="j-q">${esc(t("entry.freeform.stage3_title"))}</p><p class="j-body">${esc(t("entry.freeform.stage3_hint"))}</p>${live ? `<p class="j-note">${esc(t("entry.freeform.clipboard_or"))}</p>` + attached([
          attBtn({ act: "ff", label: t("entry.freeform.clipboard_import"), extra: ' data-ff="clipboard"', icon: "paste", primary: true }),
          attBtn({ act: "ff", label: t("entry.freeform.try_another"), extra: ' data-ff="try-another"', icon: "redo" }),
          attBtn({ act: "ff", label: t("entry.freeform.start_over"), extra: ' data-ff="start-over" aria-haspopup="dialog"', danger: true })]) : ""}`));
        if (sent) {
          m.push(outMsg("imp:replysent", `<details class="j-more"><summary><pre class="j-pasted j-pasted--clip" data-user-text>${esc(sent.reply.trim())}</pre><span class="j-more__t">${esc(t("j.read_more"))}</span></summary><pre class="j-pasted" data-user-text>${esc(sent.reply.trim())}</pre></details>`, { label: `${ico("fwd")}<span>${esc(ff.provider && ff.provider !== "copy" ? t("j.imp.reply_label", { provider: provName(ff.provider) }) : t("j.imp.reply_label_any"))}</span>` }));
          if (ff.status === "unreadable") m.push(inMsg("imp:unreadable", `<p class="j-q">${esc(t("entry.freeform.unreadable_title"))}</p><p class="j-body">${esc(t("entry.freeform.unreadable_body"))}</p>` + attached([attBtn({ act: "ff", label: t("entry.freeform.copy_repair_prompt"), extra: ' data-ff="copy-repair"', icon: "paste" }), attBtn({ act: "ff", label: t("entry.freeform.try_another"), extra: ' data-ff="try-another"', icon: "redo" })]), { cls: "is-error" }));
        }
        if (ff.status === "gaps" && ff.gap) m.push(gapsMsg(ff));
        else if (S.gapSent) m.push(inMsg("imp:gaps", `<p class="j-q">${esc(t("j.imp.gaps_title"))}</p><p class="j-body">${esc(t("j.imp.gaps_lede"))}</p>`));
        if (S.gapSent) m.push(outMsg("imp:gapsent", `<ul class="j-gapsent">${S.gapSent.map((x) => `<li data-user-text>${esc(x)}</li>`).join("")}</ul>`));
      }
    }
    if (S.importDraft) m.push(reviewMsg(S.importDraft));
    else if (S.importKept && result()) m.push(reviewMsg(S.importKept, { folded: true }));
    if (result()) m.push(...versionMessages());
    return m;
  }
  function gapsMsg(ff) {
    const g = ff.gap;
    const ni = g.notImported.length ? `<p class="j-sysline">${ico("alert")}<span>${esc(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }))}</span></p>` : "";
    const err = ff.gapErrors.size ? `<p class="j-sysline is-error" role="alert" id="jGapError" tabindex="-1">${ico("alert")}<span>${esc(t("entry.freeform.gap_error"))}</span></p>` : "";
    const fields = g.gaps.map((gap) => {
      const bad = ff.gapErrors.has(gap.key);
      const label = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` });
      return `<label class="j-field${bad ? " is-bad" : ""}"><span class="j-field__l">${esc(label)}</span><input type="text" inputmode="numeric" autocomplete="off" data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}"${bad ? ' aria-invalid="true" aria-describedby="jGapError"' : ""}></label>`;
    }).join("");
    return inMsg("imp:gaps", `<p class="j-q">${esc(t("j.imp.gaps_title"))}</p><p class="j-body">${esc(t("j.imp.gaps_lede"))}</p>${ni}${err}<div class="j-fields">${fields}</div>` + attached([attBtn({ act: "ff", label: t("entry.freeform.back_to_reply"), extra: ' data-ff="gap-back"', icon: "back" })]), { cls: "j-form" });
  }
  function reviewMsg(d, { folded = false } = {}) {
    const c = TF.importCounts(d);
    const counts = `<p class="j-counts"><span><strong>${c.linked}</strong> ${esc(t("import.count_linked"))}</span><span><strong>${c.review}</strong> ${esc(t("import.count_review"))}</span><span><strong>${c.custom}</strong> ${esc(t("import.count_custom"))}</span></p>`;
    const ordered = [...d.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
    const rows = ordered.map((row) => {
      const proposed = !row.reviewed && row.match ? row.match : null; const shown = row.decision === "link" && row.match ? row.match : proposed;
      const target = shown ? TF.libraryName(shown, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
      const badge = row.reviewed ? t("import.status.confirmed") : t(`import.status.${row.status === "probable" ? "probable" : row.status}`);
      const isOpen = !row.reviewed || row.expanded;
      let acts = "";
      if (!folded) {
        if (!isOpen) acts = `<button type="button" class="j-link" data-act="imp" data-imp="expand" data-key="${row.key}">${esc(t("import.action_change"))}</button>`;
        else {
          const picks = row.shortlist.length ? row.shortlist.map((e, i) => `<button type="button" class="j-qr j-qr--sm${i === 0 ? " is-lead" : ""}" data-act="imp" data-imp="pick" data-key="${row.key}" data-idx="${i}">${esc(t("import.action_link", { name: TF.libraryName(e, lang) }))}</button>`).join("") : row.match && row.decision !== "link" ? `<button type="button" class="j-qr j-qr--sm is-lead" data-act="imp" data-imp="link" data-key="${row.key}">${esc(t("import.action_link", { name: TF.libraryName(row.match, lang) }))}</button>` : "";
          const escapes = `<button type="button" class="j-qr j-qr--sm" data-act="imp" data-imp="choose" data-key="${row.key}">${esc(t("import.action_choose"))}</button>${row.decision !== "raw" || !row.reviewed ? `<button type="button" class="j-qr j-qr--sm" data-act="imp" data-imp="raw" data-key="${row.key}">${esc(t("import.action_keep"))}</button>` : ""}${row.decision !== "custom" ? `<button type="button" class="j-qr j-qr--sm" data-act="imp" data-imp="custom" data-key="${row.key}">${esc(t("import.action_custom"))}</button>` : ""}`;
          acts = picks ? `<div class="j-imp__acts">${picks}</div><details class="j-imp__more"><summary>${esc(t("j.imp.more"))}${ico("chev", "j-day__chev")}</summary><div class="j-imp__acts">${escapes}</div></details>` : `<div class="j-imp__acts">${escapes}</div>`;
        }
      }
      const picker = !folded && S.picker && S.picker.key === row.key ? `<div class="j-picker"><label class="j-search">${ico("search")}<span class="visually-hidden">${esc(t("x.build.search"))}</span><input id="pickerSearch" type="search" autocomplete="off" data-field="pickerQuery" value="${esc(S.picker.query || "")}" placeholder="${esc(t("x.build.search"))}"></label><div class="j-results" role="list">${TF.searchLibrary(S.picker.query, lang, { limit: 5, all: true }).map((e) => `<button type="button" class="j-result" role="listitem" data-act="pick-exercise" data-id="${esc(e.id)}"><span>${esc(TF.libraryName(e, lang))}</span>${ico("plus")}</button>`).join("")}</div></div>` : "";
      return `<li class="j-imp__row${isOpen && !folded ? " is-open" : ""}" data-imp-row="${row.key}"><div class="j-imp__map"><span class="j-imp__from" data-user-text>${esc(row.raw.name || "")}</span>${ico("arrow", "j-imp__arrow")}<span class="j-imp__to improw__name">${esc(target)}</span><span class="j-badge impbadge${row.reviewed ? " is-done" : ""}">${row.reviewed ? ico("check") : ""}${esc(badge)}</span></div>${acts}${picker}</li>`;
    }).join("");
    const reason = c.review && !folded ? `<p class="j-note" id="jImpReason">${esc(t("import.commit_blocked", { n: c.review }))}</p>` : "";
    return inMsg(folded ? "imp:review:done" : "imp:review", `<p class="j-q">${esc(t("import.heading"))}</p><p class="j-body">${esc(t("import.lede"))}</p>${d.notImported.length && S.importMode === "file" ? `<p class="j-sysline">${ico("alert")}<span>${esc(t("entry.freeform.not_imported_notice", { items: d.notImported.map((x) => t(`entry.freeform.not_imported.${x}`)).join(", ") }))}</span></p>` : ""}${counts}<ol class="j-imp">${rows}</ol><p class="j-note">${esc(t("import.safe"))}</p>${reason}`, { cls: "j-form j-impmsg" + (folded ? " is-folded" : "") });
  }

  /* ---------- chrome: app bar, composer, dock ---------- */
  function statusLine() {
    if (S.view === "landing") return t("j.status.landing");
    if (S.route === "import") return reviewing() ? t("j.status.review") : t("j.status.import");
    const st = step();
    if (st === "result") return t("j.status.review");
    return t("entry.step", { n: SECTION[st] || 1, total: 5 });
  }
  function appBar() {
    const chat = S.view === "chat";
    const back = chat ? `<button type="button" class="j-bar__icon" data-act="back" aria-label="${esc(t(S.route === "import" ? "j.back_import" : "j.back"))}">${ico("back")}</button>` : "";
    const right = chat ? `<button type="button" class="j-bar__txt" data-act="cancel" aria-haspopup="dialog" aria-label="${esc(t("j.leave_aria"))}">${esc(t("j.leave"))}</button>` : `<button type="button" class="j-bar__txt" data-act="privacy-open" data-privacy-open aria-haspopup="dialog" aria-label="${esc(t("j.privacy_aria"))}">${esc(t("privacy.title"))}</button>`;
    return `<header class="j-bar${chat ? "" : " j-bar--land"}">${back}<span class="j-bar__avatar" aria-hidden="true"><img src="${esc(TF.asset("vendor/brand/mark.png"))}" alt="" width="40" height="40"></span><span class="j-bar__who"><h1 class="j-bar__name" data-focus>Taurifer</h1><span class="j-bar__status">${esc(statusLine())}</span></span>${right}</header>`;
  }
  const sendBtn = ({ act = "", extra = "", enabled = false, describedby = "", label = t("j.c.send_aria"), advance = true }) => `<button type="button" class="j-send" id="jSend"${advance ? " data-advance" : ""} data-act="${act}"${extra} aria-label="${esc(label)}"${enabled ? "" : ` disabled${describedby ? ` aria-describedby="${describedby}"` : ""}`}>${ico("send")}</button>`;
  function composer() {
    if (S.view !== "chat" || S.sheet) return "";
    if (reviewing()) {
      const blocked = S.notice === "conflict" ? "jConflictBody" : TF.progressionIssue(result().preview) ? "jBlocked" : null;
      const label = TF.hasActiveProgram() ? t("entry.preview.activate_replace") : t("entry.preview.activate_first");
      return `<footer class="j-dock" data-persistent-action data-checkpoint="activate"><button type="button" class="j-go" id="jActivate" data-activate data-act="activate"${blocked ? ` disabled aria-describedby="${blocked}"` : ""}>${esc(label)}${ico("arrow")}</button></footer>`;
    }
    if (S.route === "import" && S.importDraft) {
      const c = TF.importCounts(S.importDraft);
      return `<footer class="j-dock" data-persistent-action><button type="button" class="j-go" id="jImportCommit" data-act="import-commit"${c.review ? ' disabled aria-describedby="jImpReason"' : ""}>${esc(t("j.imp.commit"))}${ico("arrow")}</button></footer>`;
    }
    let attach = "", pill = "", send = "";
    const tapPill = (id = "jPill") => `<span class="j-pill j-pill--hint" id="${id}">${esc(t("j.c.tap"))}</span>`;
    if (S.route === "recommend") {
      const st = step();
      if (st === "environment" && S.envFix) { pill = `<span class="j-pill j-pill--draft" id="jPill">${esc(t("j.c.fix_draft"))}</span>`; send = sendBtn({ act: "env-send", enabled: true, label: t("j.c.fix_draft") }); }
      else if (st === "priorities" && S.prioOpen) {
        const pending = !!S.avoid.pending; const txt = prioText(S.answers);
        pill = `<span class="j-pill j-pill--draft" id="jPill">${esc(txt)}</span>`;
        send = sendBtn({ act: "prio-send", enabled: !pending, describedby: "pendingAvoidNote", label: t("j.c.prio_draft") });
      } else { pill = tapPill(); send = sendBtn({ describedby: "jPill" }); }
    } else if (S.route === "import") {
      const ff = S.ff;
      if (S.importMode === "file" || ff.stage === 1) {
        pill = `<label class="j-pill j-pill--field"><span class="visually-hidden">${esc(t("entry.freeform.input_label"))}</span><textarea id="ffIn" rows="1" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("j.c.ff_in"))}">${esc(ff.input)}</textarea></label>`;
        send = sendBtn({ act: "ff", extra: ' data-ff="continue"', enabled: !!TS.freeform.program(ff), describedby: "jFfNeeds" }) + `<span class="visually-hidden" id="jFfNeeds">${esc(t("entry.freeform.needs_input"))}</span>`;
      } else if (ff.stage === 2) { pill = `<span class="j-pill j-pill--hint" id="jPill">${esc(t("j.c.ff_wait"))}</span>`; send = sendBtn({ describedby: "jPill" }); }
      else if (ff.status === "gaps") { pill = `<span class="j-pill j-pill--hint" id="jPill">${esc(t("j.c.gaps"))}</span>`; send = sendBtn({ act: "ff", extra: ' data-ff="gap-submit"', enabled: true, label: t("entry.freeform.gaps_submit") }); }
      else {
        pill = `<label class="j-pill j-pill--field"><span class="visually-hidden">${esc(t("entry.freeform.stage3_title"))}</span><textarea id="ffOut" rows="1" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(S.ffSent ? "" : ff.reply)}</textarea></label>`;
        send = sendBtn({ act: "ff", extra: ' data-ff="review"', enabled: true, label: t("entry.freeform.review") });
      }
    }
    return `<footer class="j-composer" data-persistent-action>${attach}${pill}${send}</footer>`;
  }

  /* ---------- overlays ---------- */
  const dlg = (id, { cp = "", confirm = "", role = "alertdialog", title, body = "", btns, scrimAct, cls = "" }) => `<div class="j-scrim" data-act="${scrimAct}"></div><div class="j-dialog ${cls}" role="${role}" aria-modal="true" aria-labelledby="${id}T"${body ? ` aria-describedby="${id}B"` : ""}${cp ? ` data-checkpoint="${cp}"` : ""}${confirm ? ` data-confirm="${confirm}"` : ""}><h2 class="j-dialog__t" id="${id}T" tabindex="-1">${esc(title)}</h2>${body ? `<p class="j-dialog__b" id="${id}B">${esc(body)}</p>` : ""}<div class="j-dialog__acts">${btns.join("")}</div></div>`;
  const dBtn = (act, label, { kind = "", extra = "" } = {}) => `<button type="button" class="j-dbtn${kind ? " is-" + kind : ""}" data-act="${act}"${extra}>${esc(label)}</button>`;
  function overlayView() {
    if (S.overlay === "cancel") return dlg("jCancel", { cp: "cancel-confirm", role: "dialog", title: t("entry.cancel_confirm.title"), body: t("j.cancel.body"), scrimAct: "cancel-continue", btns: [dBtn("cancel-keep", t("j.cancel.keep"), { kind: "primary" }), dBtn("cancel-discard", t("j.cancel.discard"), { kind: "danger" }), dBtn("cancel-continue", t("j.cancel.continue"))] });
    if (S.overlay === "replace") { const cur = TF.activeName(lang), next = name(); return dlg("jRepl", { cp: "replace-confirm", role: "dialog", title: t("x.replace.title"), body: t("x.replace.body", { current: cur, next, n: TF.device.sessions }), scrimAct: "replace-cancel", btns: [dBtn("replace-confirm", t("x.replace.confirm", { next }), { kind: "primary" }), dBtn("replace-cancel", t("x.replace.cancel", { current: cur }))] }); }
    if (S.overlay === "restart") return dlg("jRestartD", { confirm: "restart", title: t("x.restart.title"), body: t("x.restart.body"), scrimAct: "restart-cancel", btns: [dBtn("restart-confirm", t("j.restart.confirm"), { kind: "danger" }), dBtn("restart-cancel", t("x.restart.cancel"))] });
    if (S.ff && S.ff.confirmStartOver) return dlg("jFfRestart", { confirm: "ff-start-over", title: t("entry.freeform.confirm_start_over"), scrimAct: "ff", btns: [dBtn("ff", t("x.ff.restart_confirm"), { kind: "danger", extra: ' data-ff="start-over-confirm"' }), dBtn("ff", t("x.ff.restart_cancel"), { extra: ' data-ff="start-over-cancel"' })] }).replace('data-act="ff"></div>', 'data-act="ff" data-ff="start-over-cancel"></div>');
    if (S.overlay === "attach") {
      const discard = S.route === "import" && S.importMode === "freeform" && S.ff.input.trim();
      return `<div class="j-scrim" data-act="attach-close"></div><div class="j-dialog j-attach" role="dialog" aria-modal="true" aria-labelledby="jAttachT"><h2 class="j-dialog__t" id="jAttachT" tabindex="-1">${esc(t("j.attach.title"))}</h2><button type="button" class="j-attach__opt" data-act="import-file">${ico("doc")}<span><span class="j-attach__t">${esc(t("j.attach.file"))}</span><span class="j-attach__s">${esc(t("x.cost.file"))}</span>${discard ? `<span class="j-attach__s is-warn">${esc(t("j.attach.discard"))}</span>` : ""}</span></button><div class="j-dialog__acts">${dBtn("attach-close", t("j.attach.close"))}</div></div>`;
    }
    if (S.overlay === "media") {
      const src = TF.asset(`vendor/brand/today-ready-${lang === "pt" ? "pt" : "en"}-${theme}.webp`);
      return `<div class="j-scrim j-scrim--media" data-act="media-close"></div><div class="j-viewer" role="dialog" aria-modal="true" aria-labelledby="jViewerT"><h2 class="visually-hidden" id="jViewerT" tabindex="-1">${esc(t("j.land.caption"))}</h2><button type="button" class="j-viewer__x" data-act="media-close" aria-label="${esc(t("j.media.close"))}">${ico("x")}</button><img src="${esc(src)}" width="903" height="1832" alt="${esc(t("landing.shot.today_ready.alt"))}"></div>`;
    }
    return "";
  }
  /* The reply sheet: the composer risen, quoting the line being answered. */
  function sheetView() {
    const sh = S.sheet; if (!sh) return "";
    const a = sh.answers; let body = "";
    if (sh.key === "environment" || sh.key === "envCheck") {
      body = `<div class="j-sheet__opts" role="radiogroup" aria-label="${esc(t("j.what.env"))}">${options("environment").map((o) => radio("environment", o.val, o.title, a.environment && a.environment.kind === o.val)).join("")}</div>${envToggles(a.environment || TF.env("other"))}<p class="j-note">${esc(t("entry.env_correct.note"))}</p>`;
    } else if (sh.key === "priorities") body = prioBody(a, sh.avoid, { searchId: "jSheetAvoid" });
    else body = `<div class="j-sheet__opts${sh.key === "daysPerWeek" || sh.key === "sessionMinutes" ? " j-sheet__opts--num" : ""}" role="radiogroup" aria-label="${esc(sh.what)}">${options(sh.key).map((o) => radio(sh.key, o.val, o.num ? `${o.num} ${o.unit}` : o.title, String(valOf(a, sh.key)) === String(o.val), o.sub)).join("")}</div>`;
    const pending = !!sh.avoid.pending;
    return `<div class="j-scrim" data-act="sheet-close"></div><div class="j-sheet" role="dialog" aria-modal="true" aria-labelledby="jSheetT" data-sheet="${esc(sh.key)}">
      <div class="j-sheet__head"><button type="button" class="j-sheet__x" data-act="sheet-close" aria-label="${esc(t("j.sheet.close"))}">${ico("x")}</button><h2 class="j-sheet__t" id="jSheetT" tabindex="-1">${esc(t("j.sheet.title"))}</h2></div>
      <div class="j-sheet__body">${quoteBlock(sh.what, sh.old)}${sh.error ? `<p class="j-sysline is-error" role="alert">${ico("alert")}<span>${esc(sh.error)}</span></p>` : ""}${body}</div>
      <div class="j-sheet__foot"><button type="button" class="j-go" data-act="sheet-apply"${pending ? ' disabled aria-describedby="pendingAvoidNote"' : ""}>${esc(t("j.sheet.send"))}${ico("send")}</button></div></div>`;
  }
  const radio = (key, val, label, on, sub = "") => `<button type="button" class="j-radio${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-act="pick" data-key="${key}" data-val="${esc(val)}"><span class="j-radio__dot" aria-hidden="true"></span><span class="j-radio__t"><span>${esc(label)}</span>${sub ? `<span class="j-radio__s">${esc(sub)}</span>` : ""}</span></button>`;

  /* ---------- views ---------- */
  function checkpointFor() {
    if (S.cpTag) return S.cpTag;
    if (S.view === "landing") return "landing";
    if (S.route === "recommend") {
      const st = step();
      if (st === "environment") return S.envFix ? "rec-env-correction" : "rec-environment";
      if (st === "priorities") return (S.answers.exerciseConstraints || []).some((c) => c.reason === "pain") ? "rec-avoid-pain" : "rec-priorities";
      return { desired_result: "rec-goal", background: "rec-background", schedule: "rec-schedule", result: "rec-result" }[st] || "";
    }
    if (S.route === "import") {
      if (result()) return "import-preview";
      if (S.importDraft) return "import-review";
      if (S.importMode === "file") return "import-source";
      const ff = S.ff;
      if (ff.status === "gaps") return ff.gapErrors.size ? "ff-gaps-invalid" : "ff-gaps";
      if (ff.status === "unreadable") return "ff-unreadable";
      return ff.stage === 1 ? (TS.freeform.program(ff) ? "ff-filled" : "ff-empty") : ff.stage === 2 ? "ff-handoff" : "ff-reply";
    }
    return "";
  }
  function threadHtml(msgs) {
    let prev = null; const out = [];
    for (const m of msgs) {
      const first = m.from !== prev && m.from !== "sys";
      out.push(`<div class="j-row j-row--${m.from}${first ? " is-first" : ""}${m.from === "chips" ? "" : ""}" data-mid="${esc(m.id)}"${m.cp ? ` data-checkpoint="${m.cp}"` : ""}>${m.html}</div>`);
      if (m.from !== "chips") prev = m.from;
    }
    return out.join("");
  }
  function view() {
    if (S.view === "today") return `<div class="j-today">${TF.renderToday(t, lang)}</div>${S.toast ? `<div class="j-toast" role="status">${ico("check")}<span>${esc(S.toast)}</span></div>` : ""}`;
    if (S.view === "landing") {
      return `<div class="j-app j-app--land">${appBar()}<main class="j-thread j-thread--land" data-checkpoint="landing">${threadHtml(landingMessages({ live: true }))}</main></div>${overlayView()}`;
    }
    const msgs = S.route === "import" ? impMessages() : recMessages();
    return `<div class="j-app">${appBar()}<main class="j-thread" data-entry-step="${esc(step())}" data-checkpoint="${esc(checkpointFor())}">${threadHtml(msgs)}</main>${composer()}</div>${sheetView()}${overlayView()}<p class="visually-hidden" role="status" aria-live="polite" id="jLive"></p>`;
  }

  /* ---------- render, focus, scroll, motion ---------- */
  const seen = new Set();
  const sel = (x) => (/^[#\[.]/.test(x) ? x : "#" + CSS.escape(x));
  const FOCUS_ATTRS = ["act", "key", "val", "id", "src", "imp", "ff", "mode", "provider", "field"];
  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = FOCUS_ATTRS.filter((a) => el.dataset && el.dataset[a] !== undefined).map((a) => `[data-${a}="${CSS.escape(el.dataset[a])}"]`);
    return parts.length ? parts.join("") : null;
  }
  const headerH = () => { const b = root.querySelector(".j-bar"); return b ? b.getBoundingClientRect().height : 0; };
  const dockH = () => { const d = root.querySelector(".j-composer,.j-dock"); return d ? d.getBoundingClientRect().height : 0; };
  function scrollBehavior() { return reduced() ? "auto" : "smooth"; }
  function scrollTo(y, smooth) { window.scrollTo({ top: Math.max(0, y), behavior: smooth ? scrollBehavior() : "auto" }); }
  function scrollCard(smooth) { const c = root.querySelector("[data-card]"); if (!c) return; scrollTo(c.getBoundingClientRect().top + window.scrollY - headerH() - 8, smooth); }
  function scrollBottom(smooth) { scrollTo(document.documentElement.scrollHeight, smooth); }
  /* render({ focus: selector | "heading", scroll: "bottom" | "card" | "top" | "keep", flip: { rect, sel } }) */
  function render(o = {}) {
    const act = document.activeElement; const key = focusKey(act); const typing = act && /^(INPUT|TEXTAREA)$/.test(act.tagName); const caret = typing ? act.selectionStart : null;
    root.innerHTML = view();
    document.documentElement.style.setProperty("--j-dock-h", `${Math.ceil(dockH())}px`);
    /* Entrance: only messages that were not on screen before. */
    let i = 0;
    root.querySelectorAll("[data-mid]").forEach((el) => { const id = el.dataset.mid; if (!seen.has(id)) { seen.add(id); if (o.enter !== false) { el.classList.add("is-new"); el.style.setProperty("--j-i", String(Math.min(i++, 3))); } } });
    if (o.flip && !reduced()) flip(o.flip);
    if (o.focus === "heading") TS.focusHeading(root);
    else if (typeof o.focus === "string") focusSel(o.focus);
    else if (key) { const el = root.querySelector(key); if (el) { try { el.focus({ preventScroll: true }); if (typing && el.setSelectionRange && caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } } }
    if (o.scroll === "bottom") scrollBottom(o.smooth);
    else if (o.scroll === "card") scrollCard(o.smooth);
    else if (o.scroll === "top") scrollTo(0, false);
    announce();
  }
  function focusSel(s) {
    const el = root.querySelector(sel(s)) || document.querySelector(sel(s));
    if (!el) { TS.focusHeading(root); return; }
    if (!el.matches("button,a,input,textarea,select,summary") && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  /* The latest message from Taurifer, read out once. */
  let lastSaid = "";
  function announce() {
    const live = root.querySelector("#jLive"); if (!live) return;
    const ins = root.querySelectorAll(".j-row--in .j-q, .j-row--in .j-card__name"); const last = ins[ins.length - 1];
    const text = last ? last.textContent.trim() : "";
    if (text && text !== lastSaid) { lastSaid = text; live.textContent = text; }
  }
  /* The tapped quick reply lifts into the outgoing bubble's place. */
  function flip({ rect, target }) {
    const el = root.querySelector(target); if (!el || !rect) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const dx = rect.left + rect.width / 2 - (r.left + r.width / 2), dy = rect.top + rect.height / 2 - (r.top + r.height / 2);
    const sx = Math.max(0.4, Math.min(2, rect.width / r.width)), sy = Math.max(0.4, Math.min(2, rect.height / r.height));
    el.closest("[data-mid]")?.classList.remove("is-new");
    try { el.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: "999px" }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.16,1,.3,1)" }); } catch (e) { /* ignore */ }
  }

  /* ---------- actions ---------- */
  const ansSel = (key, val) => `[data-act="reply"][data-key="${key}"][data-val="${CSS.escape(String(val))}"]:not([data-src])`;
  function onPick(d, el) {
    if (S.sheet) {
      const sh = S.sheet;
      if (d.key === "avoidReason") sh.avoid.pending = null;
      sh.answers = TS.applyPick(sh.answers, d.key, d.val); sh.error = null;
      render({ focus: `[data-act="pick"][data-key="${d.key}"][data-val="${CSS.escape(d.val)}"]` }); return;
    }
    const inForm = d.key === "environmentEquipment" || d.key === "environmentCapabilities" || d.key === "primaryMuscles" || d.key === "priorityMovements" || d.key === "avoidReason";
    if (d.key === "avoidReason") S.avoid.pending = null;
    S.answers = TS.applyPick(S.answers, d.key, d.val);
    if (inForm) { render({ focus: `[data-act="pick"][data-key="${d.key}"][data-val="${CSS.escape(d.val)}"]` }); return; }
    if (d.key === "environment") { S.envOk = false; S.envFix = false; }
    const rect = el ? el.getBoundingClientRect() : null;
    const target = ansSel(d.key, d.val);
    render({ focus: target, scroll: "bottom", smooth: true, flip: { rect, target } });
  }
  function toResult() {
    S.prioDone = true; S.prioOpen = false; S.avoid = { query: "", pending: null };
    compileFirst(); render({ focus: "#jCardName", scroll: "card", smooth: true });
  }
  function back() {
    if (S.sheet) { closeSheet(); return; }
    if (S.route === "import") {
      if (result()) { S.versions = []; S.importDraft = S.importKept; render({ scroll: "bottom", focus: "heading" }); return; }
      if (S.importDraft) {
        if (S.importMode === "file") { S.importHeld = S.importDraft; S.importDraft = null; S.fileSent = false; S.picker = null; render({ scroll: "bottom", focus: "heading" }); return; }
        const ff = S.ff; S.importDraft = null; S.gapSent = null; S.picker = null; S.ff = { ...ff, status: ff.gap ? "gaps" : null, gapErrors: new Set() }; if (!ff.gap) S.ffSent = null; render({ scroll: "bottom", focus: "heading" }); return;
      }
      const ff = S.ff;
      if (ff.status === "gaps") { S.ff = TS.freeform.apply(ff, "gap-back"); S.ffSent = null; render({ scroll: "bottom", focus: "heading" }); return; }
      if (S.ffSent) { S.ffSent = null; S.ff = { ...ff, status: null }; render({ scroll: "bottom", focus: "heading" }); return; }
      if (ff.stage === 3) { S.ff = { ...ff, stage: 2, status: null }; render({ scroll: "bottom", focus: "heading" }); return; }
      if (ff.stage === 2) { S.ff = { ...ff, stage: 1 }; render({ scroll: "bottom", focus: "heading" }); return; }
      exitToStart(); return;
    }
    const st = step();
    if (st === "result") { S.lastPreview = result() ? result().preview : null; S.versions = []; S.notice = null; S.actError = null; S.prioDone = false; S.prioOpen = !!((S.answers.primaryMuscles || []).length || (S.answers.priorityMovements || []).length || (S.answers.exerciseConstraints || []).length); render({ scroll: "bottom", focus: "heading" }); return; }
    if (st === "priorities") { if (S.prioOpen) { S.prioOpen = false; } else { S.envOk = false; } render({ scroll: "bottom", focus: "heading" }); return; }
    if (st === "environment" && S.envFix) { S.envFix = false; render({ scroll: "bottom", focus: "heading" }); return; }
    /* Otherwise the last answer is taken back and its question asked again. */
    const lastKey = [...QS].reverse().find((q) => answered(S.answers, q.key));
    if (!lastKey) { exitToStart(); return; }
    const next = { ...S.answers }; delete next[lastKey.key]; S.answers = next; if (lastKey.key === "environment") S.envOk = false;
    render({ scroll: "bottom", focus: "heading" });
  }
  function exitToStart() {
    if (TF.hasActiveProgram()) { S = blank("today"); render({ scroll: "top", focus: "heading" }); return; }
    S = blank("landing"); render({ scroll: "top", focus: "heading" });
  }
  /* Reply to a line: open the sheet quoting it. */
  function openSheet(d, el) {
    const key = d.key;
    const what = key === "priorities" ? t("j.what.prio") : key === "envCheck" ? t("j.what.env") : t(`j.what.${KEY_WHAT[key]}`);
    const old = key === "envCheck" ? answerText(S.answers, "environment") : answerText(S.answers, key);
    S.sheet = { key, what, old, answers: clone(S.answers), avoid: { query: "", pending: null }, error: null, opener: focusKey(el) || null };
    render({ focus: "#jSheetT" });
  }
  function closeSheet() { const op = S.sheet && S.sheet.opener; S.sheet = null; render({ focus: op || "heading" }); }
  function applySheet() {
    const sh = S.sheet; if (!sh || sh.avoid.pending) return;
    const next = clone(sh.answers);
    if (JSON.stringify(TF.normalizeAnswers(next)) === JSON.stringify(answers())) { closeSheet(); return; }
    const key = sh.key === "envCheck" ? "environment" : sh.key;
    if (!result() || S.route !== "recommend") { S.answers = next; S.edited[key] = true; S.sheet = null; render({ focus: ansSel(key, key === "priorities" ? "set" : valOf(next, key)) }); return; }
    const r = compileWith(TF.normalizeAnswers(next));
    if (!r.ok) { sh.error = r.text; render({ focus: "#jSheetT" }); return; }
    const newText = key === "environment" && envAdjusted(next.environment) ? `${answerText(next, "environment")}: ${listJoin(equipList(next.environment)) || lcFirst(t("j.env.fixed_none").split(": ").pop())}` : answerText(next, key);
    S.versions.push({ result: r.result, changeFrom: { preview: result().preview }, reply: { key, val: key === "priorities" ? "set" : valOf(next, key), what: sh.what, old: sh.old, text: newText } });
    S.answers = next; S.edited[key] = true; S.sheet = null; S.notice = null; S.actError = null;
    render({ scroll: "card", smooth: false });
    showChange();
  }
  /* After a reply: the new version's first lines and its change statement in view. */
  function showChange() {
    const i = S.versions.length - 1; const c = root.querySelector(`#jChange${i}`); if (!c) return;
    scrollCard(false);
    const limit = window.innerHeight - dockH();
    if (c.getBoundingClientRect().bottom > limit - 8) scrollTo(c.getBoundingClientRect().top + window.scrollY - headerH() - 12, false);
    try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function activateNow() {
    S.actError = null;
    const st = S.route === "import" ? "preview" : "result";
    let r; try { r = TF.activate(stateFor(st)); } catch (e) { r = { ok: false, code: "state_invalid" }; }
    if (r.ok) { const toast = t("x.activated"); S = blank("today"); S.toast = toast; render({ scroll: "top", focus: "heading" }); return; }
    if (r.code === "active_program_changed") { S.notice = "conflict"; S.overlay = null; render({ scroll: "bottom", focus: "#jConflictBody" }); return; }
    S.actError = TS.issueText(t, r, { preview: result() && result().preview }); render({ scroll: "bottom", focus: "#jActError" });
  }
  function requestActivate() { if (TF.hasActiveProgram()) { S.overlay = "replace"; render({ focus: "#jReplT" }); } else activateNow(); }
  function importFile() {
    S.route = "import"; S.importMode = "file"; S.ff = TS.freeform.create(); S.ffSent = null; S.gapSent = null; S.overlay = null;
    S.importDraft = S.importHeld && S.importHeld.sourceType === "file" ? S.importHeld : TF.buildImportDraft(TF.F.importFile[lang], t("j.imp.file_name"), "file");
    S.importHeld = null; S.fileSent = true; render({ scroll: "bottom", smooth: true, focus: "heading" });
  }
  function on(act, d, el) {
    S.cpTag = null;
    if (S.toast && S.view !== "today") S.toast = null;
    switch (act) {
      case "land-create": startRoute("recommend", { pick: "create" }); render({ scroll: "bottom", smooth: true, focus: '[data-act="pick"][data-key="desiredResult"]' }); return;
      case "land-import": startRoute("import", { pick: "import" }); render({ scroll: "bottom", smooth: true, focus: "#ffIn" }); return;
      case "media-open": S.overlay = "media"; render({ focus: '[data-act="media-close"].j-viewer__x' }); return;
      case "media-close": S.overlay = null; render({ focus: '[data-act="media-open"]' }); return;
      case "pick": onPick(d, el); return;
      case "reply": openSheet(d, el); return;
      case "sheet-close": closeSheet(); return;
      case "sheet-apply": applySheet(); return;
      case "env-ok": S.envOk = true; render({ scroll: "bottom", smooth: true, focus: ansSel("envCheck", S.answers.environment.kind) }); return;
      case "env-fix": S.envFix = true; render({ scroll: "bottom", smooth: true, focus: '[data-act="pick"][data-key="environmentEquipment"]' }); return;
      case "env-send": S.envOk = true; S.envFix = false; render({ scroll: "bottom", smooth: true, focus: ansSel("envCheck", S.answers.environment.kind) }); return;
      case "prio-none": S.answers = { ...S.answers, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] }; toResult(); return;
      case "prio-open": S.prioOpen = true; render({ scroll: "bottom", smooth: true, focus: '[data-act="pick"][data-key="primaryMuscles"]' }); return;
      case "prio-send": if (S.avoid.pending) return; toResult(); return;
      case "to-paste": startRoute("import", { mode: "freeform" }); render({ scroll: "bottom", smooth: true, focus: "#ffIn" }); return;
      case "import-mode": S.overlay = "attach"; S.overlayReturn = '[data-act="import-mode"]'; render({ focus: "#jAttachT" }); return;
      case "attach-close": S.overlay = null; render({ focus: '[data-act="import-mode"]' }); return;
      case "import-file": importFile(); return;
      case "back": back(); return;
      case "cancel": S.overlay = "cancel"; render({ focus: "#jCancelT" }); return;
      case "cancel-continue": S.overlay = null; render({ focus: '[data-act="cancel"]' }); return;
      case "cancel-keep": keepDraft(); leaveSetup(); return;
      case "cancel-discard": TF.clearDraft(); leaveSetup(); return;
      case "avoid-add": if (S.sheet) { S.sheet.avoid.pending = d.id; S.sheet.avoid.query = ""; } else { S.avoid.pending = d.id; S.avoid.query = ""; } render({ focus: `[data-key="avoidReason"][data-val="${CSS.escape(d.id)}|pain"]` }); return;
      case "avoid-remove": { const tgt = S.sheet ? S.sheet.answers : S.answers; tgt.exerciseConstraints = (tgt.exerciseConstraints || []).filter((c) => c.exerciseId !== d.id); const st = S.sheet ? S.sheet.avoid : S.avoid; if (st.pending === d.id) st.pending = null; render({ focus: S.sheet ? "#jSheetAvoid" : "#avoidSearch" }); return; }
      case "field:avoidQuery": if (S.sheet) S.sheet.avoid.query = d.value; else S.avoid.query = d.value; render(); return;
      case "field:pickerQuery": if (S.picker) { S.picker.query = d.value; render(); } return;
      case "imp": if (d.imp === "choose") { S.picker = { key: d.key, query: "" }; render({ focus: "#pickerSearch" }); return; } S.importDraft = TS.importReview.apply(S.importDraft, d.imp, d.key, d.idx); render({ focus: `[data-imp-row="${d.key}"] .j-imp__to` }); return;
      case "pick-exercise": if (S.picker) { S.importDraft = TS.importReview.apply(S.importDraft, "choose", S.picker.key, d.id); const k = S.picker.key; S.picker = null; render({ focus: `[data-imp-row="${k}"] .j-imp__to` }); } return;
      case "import-commit": { if (TF.importCounts(S.importDraft).review) return; S.importKept = S.importDraft; const r = TF.importResult(S.importDraft, t); S.versions = [{ result: r, changeFrom: null, reply: null }]; S.importDraft = null; S.picker = null; render({ focus: "#jCardName", scroll: "card", smooth: true }); return; }
      case "ff": {
        const was = S.ff;
        if (d.ff === "clipboard") { S.ff = TS.freeform.apply(S.ff, "reply", TF.F.freeform.replyGaps[lang]); S.ff = TS.freeform.apply(S.ff, "review"); S.ffSent = { reply: S.ff.reply }; }
        else if (d.ff === "copy-repair") { S.toast = t("entry.freeform.toast_repair_copied"); render(); return; }
        else if (d.ff === "review") { if (!S.ff.reply.trim()) return; S.ff = TS.freeform.apply(S.ff, "review"); S.ffSent = { reply: S.ff.reply }; }
        else if (d.ff === "gap-submit") {
          const gap = S.ff.gap; S.ff = TS.freeform.apply(S.ff, "gap-submit");
          if (S.ff.gapErrors.size) { render({ focus: "#jGapError", scroll: "keep" }); return; }
          S.gapSent = gap.gaps.map((g) => t(g.field === "sets" ? "j.imp.gap_sets" : "j.imp.gap_reps", { name: g.name, v: was.gapAnswers[g.key] }));
          S.ff = { ...S.ff, gap };
        }
        else if (d.ff === "try-another") { S.ff = TS.freeform.apply(S.ff, "try-another"); S.ffSent = null; }
        else if (d.ff === "start-over-confirm") { S.ff = TS.freeform.create(); S.ffSent = null; S.gapSent = null; render({ scroll: "bottom", focus: "#ffIn" }); return; }
        else S.ff = TS.freeform.apply(S.ff, d.ff, d.provider, t);
        if (S.ff.status === "complete" && S.ff.parsed) { S.importDraft = TF.buildImportDraft({ meta: S.ff.parsed.meta, exercises: S.ff.parsed.exercises, notImported: S.ff.parsed.notImported }, t("entry.freeform.source_name"), "freeform"); S.ff = { ...S.ff, status: null, parsed: null }; render({ scroll: "bottom", smooth: true, focus: '[data-mid="imp:review"] .j-q' }); return; }
        if (d.ff === "start-over") { render({ focus: "#jFfRestartT" }); return; }
        if (d.ff === "start-over-cancel") { render({ focus: '[data-ff="start-over"]' }); return; }
        const moved = ["continue", "open", "copy", "try-another", "gap-back", "review", "clipboard"].includes(d.ff);
        render(moved ? { scroll: "bottom", smooth: true, focus: d.ff === "continue" ? '[data-ff="open"][data-provider="chatgpt"]' : d.ff === "open" || d.ff === "copy" ? '[data-ff="clipboard"]' : S.ff.status === "gaps" ? '[data-field="gap"]' : "heading" } : undefined); return;
      }
      case "field:ffInput": {
        S.ff = TS.freeform.apply(S.ff, "input", d.value);
        const btn = root.querySelector('[data-ff="continue"]'); if (btn) { const ok = !!TS.freeform.program(S.ff); btn.disabled = !ok; if (ok) btn.removeAttribute("aria-describedby"); else btn.setAttribute("aria-describedby", "jFfNeeds"); }
        const main = root.querySelector("main[data-checkpoint]"); if (main) main.dataset.checkpoint = checkpointFor();
        autosize(root.querySelector("#ffIn")); return;
      }
      case "field:ffReply": S.ff = TS.freeform.apply(S.ff, "reply", d.value); autosize(root.querySelector("#ffOut")); return;
      case "field:gap": S.ff = TS.freeform.apply(S.ff, "gap-input", { key: d.key, value: d.value }); return;
      case "activate": requestActivate(); return;
      case "replace-confirm": S.overlay = null; activateNow(); return;
      case "replace-cancel": S.overlay = null; render({ focus: "[data-activate]" }); return;
      case "conflict-review": S.notice = null; S.revAtStart = TF.liveRevision(); render({ scroll: "card", focus: "#jCardName" }); return;
      case "restart": S.overlay = "restart"; render({ focus: "#jRestartDT" }); return;
      case "restart-cancel": S.overlay = null; render({ focus: '[data-act="restart"]' }); return;
      case "restart-confirm": { const pick = S.landingPick; S = blank("chat"); S.route = "recommend"; S.landingPick = pick; render({ scroll: "bottom", focus: '[data-act="pick"][data-key="desiredResult"]' }); return; }
      default: return;
    }
  }
  function autosize(el) { if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.22)}px`; document.documentElement.style.setProperty("--j-dock-h", `${Math.ceil(dockH())}px`); }
  function onKey(ev) {
    if (ev.key !== "Escape" || document.getElementById("tfPrivacy")) return;
    if (S.sheet) { closeSheet(); return; }
    if (S.overlay === "cancel") on("cancel-continue", {});
    else if (S.overlay === "replace") on("replace-cancel", {});
    else if (S.overlay === "restart") on("restart-cancel", {});
    else if (S.overlay === "attach") on("attach-close", {});
    else if (S.overlay === "media") on("media-close", {});
    else if (S.ff && S.ff.confirmStartOver) on("ff", { ff: "start-over-cancel" });
  }
  /* Swipe right on a reply-able line to reply to it (tap does the same). */
  function wireSwipe() {
    let s = null; let swallow = false;
    root.addEventListener("pointerdown", (ev) => { const el = ev.target.closest('[data-act="reply"]'); if (!el || ev.button !== 0) return; s = { el, x: ev.clientX, y: ev.clientY, dx: 0, on: false }; }, true);
    root.addEventListener("pointermove", (ev) => {
      if (!s) return; const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
      if (!s.on && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s = null; return; }
      if (dx > 8 && Math.abs(dx) > Math.abs(dy)) s.on = true;
      if (s.on) { s.dx = Math.max(0, Math.min(84, dx)); s.el.style.transform = `translateX(${s.dx}px)`; s.el.classList.toggle("is-armed", s.dx > 56); }
    }, true);
    const end = () => {
      if (!s) return; const { el, dx, on: moved } = s; s = null;
      el.style.transform = ""; el.classList.remove("is-armed");
      if (moved) { swallow = true; if (dx > 56) on("reply", { ...el.dataset }, el); }
    };
    root.addEventListener("pointerup", end, true); root.addEventListener("pointercancel", end, true);
    root.addEventListener("click", (ev) => { if (swallow) { swallow = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  }

  /* ---------- checkpoint reach (states built through the same model) ---------- */
  const rafael = () => TF.fixtureAnswers("rafael");
  function at(route, a, { envOk = false, prioDone = false } = {}) { S = blank("chat"); S.route = route; S.answers = a; S.envOk = envOk; S.prioDone = prioDone; S.revAtStart = TF.liveRevision(); }
  const bg = () => ({ desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most" });
  const sched = () => { const a = rafael(); return { ...bg(), daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, preferredRestSeconds: a.preferredRestSeconds }; };
  const correctedEnv = () => { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; };
  function ffAt(stage, reply) { let ff = TS.freeform.apply(TS.freeform.create(), "input", TF.F.freeform.pasted[lang]); if (stage >= 2) ff = TS.freeform.apply(ff, "continue"); if (stage >= 3) ff = TS.freeform.apply(ff, "open", "chatgpt"); if (reply) { ff = TS.freeform.apply(ff, "reply", reply); ff = TS.freeform.apply(ff, "review"); S.ffSent = { reply }; } return ff; }
  function atResult(a) { at("recommend", a, { envOk: true, prioDone: true }); compileFirst(); }
  async function reach(cp) {
    const u = TF.F.users; let o = { scroll: "bottom", enter: false };
    switch (cp) {
      case "landing": S = blank("landing"); o.scroll = "top"; break;
      case "route-choice": case "hub-existing": at("recommend", {}); S.landingPick = TF.hasActiveProgram() ? null : "create"; break;
      case "rec-goal": at("recommend", {}); S.landingPick = "create"; break;
      case "rec-background": at("recommend", { desiredResult: "muscle_growth" }); break;
      case "rec-schedule": at("recommend", bg()); break;
      case "rec-environment": at("recommend", sched()); break;
      case "rec-env-correction": at("recommend", { ...sched(), environment: correctedEnv() }); S.envFix = true; break;
      case "rec-priorities": at("recommend", rafael(), { envOk: true }); break;
      case "rec-avoid-pain": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; at("recommend", a, { envOk: true }); S.prioOpen = true; break; }
      case "rec-result": case "activate": atResult(rafael()); o.scroll = "card"; break;
      case "replace-confirm": atResult(rafael()); S.overlay = "replace"; o = { scroll: "card", enter: false, focus: "#jReplT" }; break;
      case "rec-result-corrected": {
        atResult(rafael()); const before = result().preview; const next = { ...S.answers, environment: correctedEnv() }; const r = compileWith(TF.normalizeAnswers(next)); const old = answerText(S.answers, "environment");
        S.answers = next; S.versions.push({ result: r.result, changeFrom: { preview: before }, reply: { key: "environment", val: next.environment.kind, what: t("j.what.env"), old, text: `${answerText(next, "environment")}: ${listJoin(equipList(next.environment))}` } });
        S.cpTag = cp; o.scroll = "card"; break;
      }
      case "rec-result-avoided": { const a = rafael(); a.primaryMuscles = [...u.rafael.pain.primaryMuscles]; a.exerciseConstraints = [{ exerciseId: u.rafael.pain.exerciseId, reason: u.rafael.pain.reason }]; atResult(a); S.cpTag = cp; o.scroll = "card"; break; }
      case "ff-empty": case "import-source": at("import", {}); S.importMode = cp === "import-source" ? "file" : "freeform"; break;
      case "ff-filled": at("import", {}); S.ff = ffAt(1); break;
      case "ff-handoff": at("import", {}); S.ff = ffAt(2); break;
      case "ff-reply": at("import", {}); S.ff = ffAt(3); break;
      case "ff-gaps": case "ff-gaps-invalid": at("import", {}); S.ff = ffAt(3, TF.F.freeform.replyGaps[lang]); if (cp === "ff-gaps-invalid") { const g = S.ff.gap.gaps; S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[0].key, value: "12-10" }); if (g[1]) S.ff = TS.freeform.apply(S.ff, "gap-input", { key: g[1].key, value: "abc" }); S.ff = TS.freeform.apply(S.ff, "gap-submit"); } break;
      case "ff-unreadable": at("import", {}); S.ff = ffAt(3, TF.F.freeform.replyUnreadable[lang]); break;
      case "import-review": at("import", {}); S.importMode = "file"; S.fileSent = true; S.importDraft = TF.buildImportDraft(TF.F.importFile[lang], t("j.imp.file_name"), "file"); break;
      case "import-preview": { at("import", {}); S.importMode = "file"; S.fileSent = true; let dr = TF.buildImportDraft(TF.F.importFile[lang], t("j.imp.file_name"), "file"); for (const r of dr.rows) if (!r.reviewed) dr = TS.importReview.apply(dr, r.shortlist.length ? "pick" : "raw", r.key, 0); S.importKept = dr; S.versions = [{ result: TF.importResult(dr, t), changeFrom: null, reply: null }]; o.scroll = "card"; break; }
      case "activation-conflict": atResult(rafael()); TF.device.revision += 1; activateNow(); return;
      case "cancel-confirm": at("recommend", bg()); S.overlay = "cancel"; o = { scroll: "bottom", enter: false, focus: "#jCancelT" }; break;
      case "activated-today": atResult(rafael()); activateNow(); return;
      default: S = blank("landing"); o.scroll = "top";
    }
    if (cp === "route-choice") S.cpTag = null;
    render(o);
    if (o.scroll === "card") scrollCard(false); else if (o.scroll === "bottom") scrollBottom(false);
  }

  /* ---------- journeys (round-2/JOURNEYS.md) ---------- */
  const pickKey = (k, v) => `[data-act="pick"][data-key="${k}"][data-val="${v}"]`;
  async function answerRafael(api, a, { goal = true } = {}) {
    if (goal) await api.tap(pickKey("desiredResult", a.desiredResult));
    await api.tap(pickKey("structuredExperience", a.structuredExperience)); await api.tap(pickKey("recentConsistency", a.recentConsistency));
    await api.tap(pickKey("daysPerWeek", a.daysPerWeek)); await api.tap(pickKey("sessionMinutes", a.sessionMinutes)); await api.tap(pickKey("preferredRestSeconds", a.preferredRestSeconds === null ? "auto" : a.preferredRestSeconds));
    await api.tap(pickKey("environment", a.environment.kind)); await api.tap('[data-act="env-ok"]');
    await api.tap('[data-act="prio-none"]');
  }
  async function activateAndWait(api) { await api.tap("[data-activate]"); await api.waitFor('[data-checkpoint="activated-today"]'); }
  async function decideRows(api) { for (const r of S.importDraft.rows) if (!r.reviewed) await api.tap(r.shortlist.length ? `[data-imp="pick"][data-key="${r.key}"][data-idx="0"]` : `[data-imp="raw"][data-key="${r.key}"]`); }
  const CARD_KEYS = ["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "preferredRestSeconds", "environment", "priorities"];
  const journeys = {
    async "activate.recommend"(api) {
      await api.tap("#firstRunCreate");
      await answerRafael(api, TF.fixtureAnswers("rafael"));
      api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.import-paste"(api) {
      await api.type("#ffIn", TF.F.freeform.pasted[api.lang]); await api.tap('[data-ff="continue"]'); await api.tap('[data-ff="open"][data-provider="chatgpt"]'); await api.tap('[data-ff="clipboard"]');
      for (const g of S.ff.gap.gaps) await api.type(`[data-field="gap"][data-key="${g.key}"]`, g.field === "reps" ? "10-12" : "3");
      await api.tap('[data-ff="gap-submit"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api);
    },
    async "activate.import-file"(api) { await api.tap('[data-act="import-mode"]'); await api.tap('[data-act="import-file"]'); await decideRows(api); await api.tap('[data-act="import-commit"]'); api.snapshot("review"); await activateAndWait(api); },
    async cancel(api) { await api.tap('[data-act="cancel"]'); },
    async "back.recommend"(api) { await api.tap('[data-act="back"]'); api.snapshot("after"); },
    async "back.import"(api) { await decideRows(api); api.snapshot("decided"); await api.tap('[data-act="import-commit"]'); api.snapshot("preview"); await api.tap('[data-act="back"]'); api.snapshot("back"); },
    async "destroy.review-start-over"(api) { await api.tap('[data-act="restart"]'); api.snapshot("asked"); await api.tap('button[data-act="restart-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.paste-restart"(api) { await api.tap('button[data-ff="start-over"]'); api.snapshot("asked"); await api.tap('button[data-ff="start-over-cancel"]'); api.snapshot("after-cancel"); },
    async "destroy.discard-draft"(api) { await api.tap('[data-act="cancel"]'); api.snapshot("asked"); await api.tap('button[data-act="cancel-discard"]'); api.snapshot("discarded"); },
    async "existing.replace-cancel"(api) { await api.tap('button[data-act="replace-cancel"]'); },
    async "existing.conflict"(api) { await api.tap('[data-act="conflict-review"]'); api.snapshot("reviewed"); await api.tap("[data-activate]"); },
    async "existing.back"(api) { await api.tap('[data-act="back"]'); },
    async "existing.cancel-keep"(api) { await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-keep"]'); },
    async "existing.cancel-discard"(api) { await api.tap(pickKey("desiredResult", "muscle_growth")); await api.tap('[data-act="cancel"]'); await api.tap('button[data-act="cancel-discard"]'); },
    async overlays(api) {
      for (const k of CARD_KEYS) { await api.tap(`[data-src="card"][data-key="${k}"]`); await api.checkOverlay('[data-act="sheet-apply"]', k); await api.tap('button.j-sheet__x[data-act="sheet-close"]'); }
    },
    async "change.days"(api) { await api.tap('[data-src="card"][data-key="daysPerWeek"]'); await api.tap(pickKey("daysPerWeek", 4)); await api.tap('[data-act="sheet-apply"]'); api.snapshot("changed"); },
    async "correct.environment"(api) {
      const c = TF.F.users.rafael.correction; const base = TF.env(c.environmentKind);
      api.mark("start"); await api.tap('[data-src="card"][data-key="environment"]');
      await api.tap(pickKey("environment", c.environmentKind));
      for (const e of c.equipmentAdd) if (!base.equipment.includes(e)) await api.tap(pickKey("environmentEquipment", e));
      for (const k of c.capabilitiesAdd) if (!base.capabilities.includes(k)) await api.tap(pickKey("environmentCapabilities", k));
      await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("corrected");
    },
    async "avoid.from-review"(api) {
      api.mark("start"); await api.tap('[data-src="card"][data-key="priorities"]');
      await api.type("#jSheetAvoid", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]');
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); await api.tap('[data-act="sheet-apply"]'); api.mark("end"); api.snapshot("review");
    },
    async "avoid.pain"(api) {
      await api.tap(pickKey("primaryMuscles", "chest"));
      await api.type("#avoidSearch", TF.libraryName(TF.libraryEntry("pr_bb"), api.lang)); await api.tap('[data-act="avoid-add"][data-id="pr_bb"]'); api.snapshot("pending");
      await api.tap(pickKey("avoidReason", "pr_bb|pain")); api.snapshot("reasoned"); await api.tap("[data-advance]"); api.snapshot("review");
    },
    async "recommend.required"(api) {
      await api.probe("missing:desiredResult"); await api.tap(pickKey("desiredResult", "muscle_growth"));
      await api.probe("missing:structuredExperience"); await api.tap(pickKey("structuredExperience", "6_to_24m"));
      await api.probe("missing:recentConsistency"); await api.tap(pickKey("recentConsistency", "most"));
      await api.probe("missing:daysPerWeek"); await api.tap(pickKey("daysPerWeek", 3));
      await api.probe("missing:sessionMinutes"); await api.tap(pickKey("sessionMinutes", 60));
      await api.probe("missing:preferredRestSeconds"); await api.tap(pickKey("preferredRestSeconds", 120));
      await api.probe("missing:environment"); await api.tap(pickKey("environment", "commercial_gym")); await api.tap('[data-act="env-ok"]');
      await api.tap('[data-act="prio-none"]'); api.snapshot("review");
    },
  };

  window.__tournamentCandidates = window.__tournamentCandidates || {};
  window.__tournamentCandidates.j = {
    id: "j", name: "J · Conversa", policy: { productDecisions: ["PD-1"] },
    thesis: "Setup is a chat the lifter already knows: fixed questions answered by quick replies, the program arriving as a message, corrections made by replying to the line they change.",
    axis: "Reopens PD-1: no chooser; the routes (answer, paste, attach) are offered inside the thread.",
    async mount(c) {
      lang = c.lang; root = c.root; theme = c.theme === "dark" ? "dark" : "light";
      t = TF.makeT(lang, Object.assign({}, TS.COPY[lang], COPY[lang]));
      fresh(c.seed); TS.wire(root, on);
      document.addEventListener("keydown", onKey);
      wireSwipe();
      render({ enter: false });
    },
    reach,
    entry() {
      if (!S || S.view !== "chat" || !S.route) return null;
      return TF.jsonClean({ route: S.route, step: step(), answers: S.route === "import" ? {} : answers(), result: result() || null });
    },
    journeys,
    state: () => S,
  };
})();
