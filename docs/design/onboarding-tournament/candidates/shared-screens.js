/* Shared widgets and models. The hard states (import review, free-form hand-off,
   gap repair, build editor, activation gating, replacement/conflict/resume)
   run on one implementation so no candidate gets an easier version of them.
   Candidates own composition, copy overrides, and where these appear. */
(function () {
  "use strict";
  const { esc } = TF;
  const T = {};

  /* ---------- copy shared by all candidates (both catalogs), used only where the
     production catalog has no string. Every key is new copy for the tournament. */
  T.COPY = {
    en: {
      "x.limit.home.pull_capability_unavailable": "No vertical pull: this setup has nothing to hang or pull from.",
      "x.limit.conditional_slot_unresolved": "One optional slot was left empty for this equipment.",
      "x.limit.optional_slot_unresolved": "One optional exercise was left out for this equipment.",
      "x.limit.deemphasized_optional_omitted": "An optional exercise was dropped for a de-emphasized muscle.",
      "x.limit.ignored_direct_work_omitted": "Direct work for an ignored muscle was left out.",
      "x.limit.required_slot_unresolved": "A required slot could not be filled with this equipment.",
      "x.reduce.remove_optional": "First week: one optional exercise removed.",
      "x.reduce.efficient_two_set": "First week: one exercise starts at two sets.",
      "x.reduce.trim_reducible_assistance": "First week: assistance work trimmed.",
      "x.avoid.constraint": "Avoided: {exercise} ({reason})",
      "x.include.constraint": "Included: {exercise}",
      "x.replace.title": "Replace your current program?",
      "x.replace.body": "{current} is archived and {next} becomes active. Your {n} logged sessions stay in History.",
      "x.replace.confirm": "Archive and use {next}",
      "x.replace.cancel": "Keep {current}",
      "x.activated": "Program active. Today shows your first session.",
      "x.build.day_needs": "{day} still needs an exercise.",
      "x.build.add": "Add exercise",
      "x.build.remove": "Remove",
      "x.build.sets": "Sets",
      "x.build.min": "Min",
      "x.build.max": "Max",
      "x.build.day_name": "Day name",
      "x.build.picker_title": "Add an exercise",
      "x.build.search": "Search the library",
      "x.build.done": "Done",
      "x.build.rx_invalid": "Reps must be whole numbers, and max not below min.",
      "x.today.first": "Your first session is ready.",
      "x.assumed": "Assumed",
      "x.change": "Change",
      "x.cost.recommend": "5 short sections · about 2 minutes",
      "x.cost.custom": "7 sections · about 5 minutes",
      "x.cost.browse": "2 questions, then pick from a list",
      "x.cost.build": "You type every exercise · 10 to 20 minutes",
      "x.cost.paste": "Paste text, tap ChatGPT or Claude, paste the reply",
      "x.cost.file": "A Taurifer program file from another device",
      "x.get.generated": "A complete, editable program with progression built in",
      "x.get.browse": "One of 20 released Taurifer programs",
      "x.get.build": "Exactly what you write; you set each target",
      "x.get.import": "Your own program, reviewed exercise by exercise",
      "x.shared.what": "What arrives with the link: the program, its settings and the app language. No workout history.",
      "x.shared.nothing_saved": "Nothing is saved until you start it.",
      "x.privacy.line": "Works offline. No account. Your training stays on this device.",
    },
    pt: {
      "x.limit.home.pull_capability_unavailable": "Sem puxada vertical: neste espaço não há onde se pendurar ou puxar.",
      "x.limit.conditional_slot_unresolved": "Uma vaga opcional ficou vazia com este equipamento.",
      "x.limit.optional_slot_unresolved": "Um exercício opcional ficou de fora com este equipamento.",
      "x.limit.deemphasized_optional_omitted": "Um exercício opcional saiu por causa de um músculo com menos ênfase.",
      "x.limit.ignored_direct_work_omitted": "O trabalho direto de um músculo ignorado ficou de fora.",
      "x.limit.required_slot_unresolved": "Uma vaga obrigatória não pôde ser preenchida com este equipamento.",
      "x.reduce.remove_optional": "Primeira semana: um exercício opcional removido.",
      "x.reduce.efficient_two_set": "Primeira semana: um exercício começa com duas séries.",
      "x.reduce.trim_reducible_assistance": "Primeira semana: trabalho acessório reduzido.",
      "x.avoid.constraint": "Evitado: {exercise} ({reason})",
      "x.include.constraint": "Incluído: {exercise}",
      "x.replace.title": "Substituir o programa atual?",
      "x.replace.body": "{current} é arquivado e {next} passa a ser o ativo. Suas {n} sessões registradas continuam no Histórico.",
      "x.replace.confirm": "Arquivar e usar {next}",
      "x.replace.cancel": "Manter {current}",
      "x.activated": "Programa ativo. Hoje mostra sua primeira sessão.",
      "x.build.day_needs": "{day} ainda precisa de um exercício.",
      "x.build.add": "Adicionar exercício",
      "x.build.remove": "Remover",
      "x.build.sets": "Séries",
      "x.build.min": "Mín.",
      "x.build.max": "Máx.",
      "x.build.day_name": "Nome do dia",
      "x.build.picker_title": "Adicionar um exercício",
      "x.build.search": "Buscar na biblioteca",
      "x.build.done": "Concluir",
      "x.build.rx_invalid": "Repetições em números inteiros, e o máximo nunca abaixo do mínimo.",
      "x.today.first": "Sua primeira sessão está pronta.",
      "x.assumed": "Suposto",
      "x.change": "Alterar",
      "x.cost.recommend": "5 seções curtas · cerca de 2 minutos",
      "x.cost.custom": "7 seções · cerca de 5 minutos",
      "x.cost.browse": "2 perguntas, depois escolha numa lista",
      "x.cost.build": "Você digita cada exercício · 10 a 20 minutos",
      "x.cost.paste": "Cole o texto, toque em ChatGPT ou Claude, cole a resposta",
      "x.cost.file": "Um arquivo de programa Taurifer de outro aparelho",
      "x.get.generated": "Um programa completo e editável, com progressão incluída",
      "x.get.browse": "Um dos 20 programas Taurifer já publicados",
      "x.get.build": "Exatamente o que você escrever; você define cada meta",
      "x.get.import": "Seu próprio programa, revisado exercício por exercício",
      "x.shared.what": "O que chega com o link: o programa, os ajustes e o idioma do app. Sem histórico de treinos.",
      "x.shared.nothing_saved": "Nada é salvo até você começar.",
      "x.privacy.line": "Funciona sem conexão. Sem conta. Seu treino fica neste aparelho.",
    },
  };

  /* ---------- reasons and adjustments, computed once from the real result ---------- */
  T.reasons = function (t, lang, result, answers, { custom = false } = {}) {
    const ex = result.explanation || {}, preview = result.preview || {};
    const rows = [];
    if (ex.desiredResult) rows.push({ icon: "flex", key: "goal", text: t("entry.result.why_goal", { goal: t(`entry.desired_result.${ex.desiredResult}.label`).toLowerCase() }) });
    if (ex.daysPerWeek && ex.sessionMinutes) rows.push({ icon: "cal", key: "schedule", text: t("entry.result.why_schedule", { days: ex.daysPerWeek, minutes: ex.sessionMinutes }) });
    if (ex.mainConstraint) rows.push({ icon: "building", key: "environment", text: t(`entry.result.why_environment.${ex.mainConstraint}`) });
    const eq = TF.equipmentLabel(t, answers.environment); if (eq) rows.push({ icon: "dumbbell", key: "equipment", text: t("entry.result.why_equipment", { equipment: eq }) });
    const pr = T.priorityLabel(t, lang, answers, custom); if (pr) rows.push({ icon: "target", key: "priorities", text: t("entry.result.why_priorities", { priorities: pr }) });
    rows.push({ icon: "trend", key: "progression", text: t("entry.result.why_progression", { progression: TF.progressionLabel(t, preview).toLowerCase() }) });
    if ((preview.reductions || []).length) rows.push({ icon: "scale", key: "reductions", text: t("entry.result.why_reductions", { n: preview.reductions.length }) });
    if ((preview.limitations || []).length) rows.push({ icon: "scale", key: "limitations", text: t("entry.result.why_compromises", { n: preview.limitations.length }) });
    if (ex.recentConsistency === "about_half") rows.push({ icon: "clock", key: "interrupted", text: t("entry.result.why_interrupted") });
    return rows;
  };
  T.priorityLabel = function (t, lang, answers, custom) {
    const facts = [];
    const m = answers.primaryMuscles || []; if (m.length) facts.push(m.map((x) => t(`entry.muscle.${x}`, undefined, x)).join(", "));
    if (custom) for (const [key, st] of [["deEmphasizedMuscles", "deemphasize"], ["ignoredMuscles", "ignore"]]) { const l = answers[key] || []; if (l.length) facts.push(`${t(`entry.priorities.state.${st}`)}: ${l.map((x) => t(`entry.muscle.${x}`, undefined, x)).join(", ")}`); }
    const mv = answers.priorityMovements || []; if (mv.length) facts.push(mv.map((x) => t(`entry.movement.${x}`, undefined, x)).join(", "));
    return facts.join(" · ");
  };
  T.constraintLines = function (t, lang, answers) {
    const out = [];
    for (const id of answers.mustHaveExercises || []) { const e = TF.libraryEntry(id); if (e) out.push({ kind: "include", id, text: t("x.include.constraint", { exercise: TF.libraryName(e, lang) }) }); }
    for (const c of answers.exerciseConstraints || []) { const e = TF.libraryEntry(c.exerciseId); if (e) out.push({ kind: "avoid", id: c.exerciseId, reason: c.reason, text: t("x.avoid.constraint", { exercise: TF.libraryName(e, lang), reason: t(`entry.priorities.reason.${c.reason}`).toLowerCase() }) }); }
    return out;
  };
  T.adjustments = function (t, preview) {
    const out = [];
    for (const l of preview?.limitations || []) out.push({ kind: "limitation", code: l.code, text: t(`x.limit.${l.code}`, undefined, l.code), slotId: l.slotId });
    for (const r of preview?.reductions || []) out.push({ kind: "reduction", code: r.step, text: t(`x.reduce.${r.step}`, undefined, r.step), slotId: r.slotId });
    return out;
  };

  /* ---------- program days ---------- */
  T.programDays = function (t, lang, preview, { openFirst = true, openAll = false, cls = "" } = {}) {
    const days = preview?.days || [];
    return `<div class="stack ${cls}">` + days.map((d, i) => {
      const ex = d.exercises || []; const sets = ex.reduce((s, e) => s + (+e.sets || 0), 0);
      const meta = [t("entry.preview.exercises", { n: ex.length, exercise: TF.tp(t, ex.length, "exercise") }), t("entry.preview.sets", { n: sets }), d.estimateMinutes ? t("entry.preview.minutes", { n: d.estimateMinutes }) : ""].filter(Boolean).join(" · ");
      return `<details class="day" ${openAll || (openFirst && i === 0) ? "open" : ""}><summary><span class="day__num" aria-hidden="true">${i + 1}</span><span class="day__name">${esc(TF.dayName(t, d, preview.programStructure, i))}<span class="day__meta" style="display:block;margin-top:2px">${esc(meta)}</span></span><span class="chevron" aria-hidden="true"></span></summary><div class="day__list">${ex.length ? ex.map((e) => `<div class="ex" data-slot="${esc(e.id)}"><span class="ex__name">${esc(T.exName(e, lang))}</span><span class="ex__rx">${e.sets != null ? `${e.sets} × ${e.min}–${e.max}` : ""}</span></div>`).join("") : `<div class="ex t-soft">${esc(t("program.empty.exercises"))}</div>`}</div></details>`;
    }).join("") + `</div>`;
  };
  T.exName = (e, lang) => { const entry = e.libraryId ? TF.libraryEntry(e.libraryId) : null; return entry ? TF.libraryName(entry, lang) : e.name || ""; };

  /* ---------- option groups (real vocabularies from the adapter) ---------- */
  T.DESIRED = ["muscle_growth", "balanced", "strength"];
  T.EXPERIENCE = ["first", "under_6m", "6_to_24m", "over_24m"];
  T.CONSISTENCY = ["most", "about_half", "few", "none"];
  T.DAYS = [2, 3, 4, 5, 6];
  T.MINUTES = [30, 45, 60, 75, 90];
  T.REST = ["auto", 60, 90, 120, 180];
  T.ENVS = TF.Adapter.ENTRY_ENVIRONMENTS;
  T.ENV_ICON = { commercial_gym: "building", basic_gym: "house", limited_home: "kettlebell", full_home: "rack", other: "dumbbell" };
  T.DESIRED_ICON = { muscle_growth: "flex", balanced: "scale", strength: "dumbbell" };
  T.EQUIP = TF.Adapter.KNOWN_EQUIPMENT;
  T.CAPS = TF.Adapter.KNOWN_CAPABILITIES;
  T.MUSCLES = TF.Adapter.ENTRY_MUSCLES;
  T.MOVEMENTS = TF.Adapter.ENTRY_MOVEMENTS;
  T.REASONS = TF.Adapter.CONSTRAINT_REASONS;
  T.choice = ({ key, val, title, cap, selected, role = "radio", icon, disabled, cls = "" }) =>
    `<button type="button" class="choice ${cls}${selected ? " is-selected" : ""}" role="${role}" aria-checked="${selected ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"${disabled ? " disabled" : ""}>${icon ? `<span class="choice__icon icon-mask icon-mask--${icon}" aria-hidden="true"></span>` : ""}<span class="choice__body"><span class="choice__title">${esc(title)}</span>${cap ? `<span class="choice__cap">${esc(cap)}</span>` : ""}</span><span class="choice__mark" aria-hidden="true"></span></button>`;
  T.chip = ({ key, val, label, selected, role = "checkbox", disabled }) =>
    `<button type="button" class="chip${selected ? " is-selected" : ""}" role="${role}" aria-checked="${selected ? "true" : "false"}" data-act="pick" data-key="${esc(key)}" data-val="${esc(val)}"${disabled ? " disabled" : ""}>${esc(label)}</button>`;

  /* Environment correction disclosure (equipment + capabilities), real vocab. */
  T.environmentCorrection = function (t, envValue, { open = false } = {}) {
    if (!envValue) return "";
    const eq = new Set(envValue.equipment || []), caps = new Set(envValue.capabilities || []);
    return `<details class="disclosure" ${open ? "open" : ""} data-role="env-correction"><summary><span>${esc(t("entry.env_correct.summary"))}</span><span class="chevron" aria-hidden="true"></span></summary><div class="disclosure__body stack">
      <p class="t-label">${esc(t("entry.env_correct.equipment"))}</p><div class="grid-2" role="group" aria-label="${esc(t("entry.env_correct.equipment"))}">${T.EQUIP.map((k) => T.choice({ key: "environmentEquipment", val: k, title: t(`entry.equip.${k}`, undefined, k), selected: eq.has(k), role: "checkbox", cls: "choice--compact" })).join("")}</div>
      <p class="t-label">${esc(t("entry.env_correct.capabilities"))}</p><div class="stack stack--tight" role="group" aria-label="${esc(t("entry.env_correct.capabilities"))}">${T.CAPS.map((k) => T.choice({ key: "environmentCapabilities", val: k, title: t(`entry.cap.${k}`, undefined, k), selected: caps.has(k), role: "checkbox", cls: "choice--compact" })).join("")}</div>
      <p class="t-caption">${esc(t("entry.env_correct.note"))}</p></div></details>`;
  };

  /* Avoid an exercise: search + reason. State: {query, pending, constraints[]} */
  T.avoidSection = function (t, lang, s, { searchId = "avoidSearch", label } = {}) {
    const taken = new Set([...(s.constraints || []).map((c) => c.exerciseId), ...(s.mustHave || [])]); if (s.pending) taken.add(s.pending);
    const matches = TF.searchLibrary(s.query, lang, { exclude: taken, limit: 6 });
    const hasPain = (s.constraints || []).some((c) => c.reason === "pain");
    return `<div class="stack">
      <label class="field field--search"><span>${esc(label || t("entry.priorities.avoid_search"))}</span><span class="icon-mask icon-mask--search" aria-hidden="true"></span><input id="${searchId}" type="search" autocomplete="off" data-field="avoidQuery" value="${esc(s.query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></label>
      ${matches.length ? `<div class="stack stack--tight" role="listbox" aria-label="${esc(t("entry.priorities.avoid_search"))}">${matches.map((e) => `<button type="button" class="choice choice--compact" role="option" data-act="avoid-add" data-id="${esc(e.id)}"><span class="choice__body"><span class="choice__title">${esc(TF.libraryName(e, lang))}</span></span><span class="icon-mask icon-mask--plus" aria-hidden="true" style="color:var(--ink-soft)"></span></button>`).join("")}</div>` : ""}
      ${s.pending ? T.reasonBlock(t, lang, s.pending, null, true) : ""}
      ${(s.constraints || []).map((c) => T.reasonBlock(t, lang, c.exerciseId, c.reason, false)).join("")}
      ${hasPain ? `<p class="status-line" role="note"><span class="icon-mask icon-mask--shield" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}
    </div>`;
  };
  T.reasonBlock = function (t, lang, id, reason, pending) {
    const e = TF.libraryEntry(id); const name = e ? TF.libraryName(e, lang) : id;
    return `<div class="card"><div class="card__body stack stack--tight" role="group" aria-label="${esc(t("entry.priorities.avoid_reason", { exercise: name }))}">
      <div class="row row--between"><strong>${esc(name)}</strong><button type="button" class="btn btn--link" data-act="avoid-remove" data-id="${esc(id)}">${esc(t("entry.priorities.avoid_remove"))}</button></div>
      <p class="t-label">${esc(t("entry.priorities.avoid_reason", { exercise: name }))}</p>
      <div class="row" style="flex-wrap:wrap;gap:8px" role="radiogroup">${T.REASONS.map((r) => T.chip({ key: "avoidReason", val: `${id}|${r}`, label: t(`entry.priorities.reason.${r}`), selected: reason === r, role: "radio" })).join("")}</div>
      ${pending ? `<p class="t-caption" id="pendingAvoidNote">${esc(t("entry.priorities.reason_required"))}</p>` : ""}</div></div>`;
  };

  /* Custom per-muscle emphasis (real 4-state vocabulary, max 2 prioritized). */
  T.muscleEmphasis = function (t, a) {
    const status = (m) => (a.primaryMuscles || []).includes(m) ? "prioritize" : (a.deEmphasizedMuscles || []).includes(m) ? "deemphasize" : (a.ignoredMuscles || []).includes(m) ? "ignore" : "normal";
    return `<div class="stack stack--tight" role="group">${T.MUSCLES.map((m) => { const cur = status(m); const full = (a.primaryMuscles || []).length >= 2 && cur !== "prioritize"; return `<div class="card"><div class="card__body" style="padding:10px 12px"><div class="row row--between" style="margin-bottom:8px"><strong id="ml-${m}">${esc(t(`entry.muscle.${m}`))}</strong><span class="t-caption">${esc(t(`entry.priorities.state.${cur}`))}</span></div><div class="grid-2" role="radiogroup" aria-labelledby="ml-${m}">${["normal", "prioritize", "deemphasize", "ignore"].map((st) => `<button type="button" class="chip${cur === st ? " is-selected" : ""}" role="radio" aria-checked="${cur === st}" data-act="pick" data-key="musclePriority" data-val="${m}|${st}"${st === "prioritize" && full ? " disabled" : ""} style="justify-content:center">${esc(t(`entry.priorities.state.${st}`))}</button>`).join("")}</div></div></div>`; }).join("")}</div>`;
  };
  /* Include/avoid search (custom route). s: {query, pending, mustHave[], constraints[]} */
  T.exercisePrefs = function (t, lang, s) {
    const taken = new Set([...(s.mustHave || []), ...(s.constraints || []).map((c) => c.exerciseId)]); if (s.pending) taken.add(s.pending);
    const matches = TF.searchLibrary(s.query, lang, { exclude: taken, limit: 6, all: true });
    const hasPain = (s.constraints || []).some((c) => c.reason === "pain");
    return `<div class="stack">
      <label class="field field--search"><span>${esc(t("entry.exercise_preferences.search"))}</span><span class="icon-mask icon-mask--search" aria-hidden="true"></span><input id="prefSearch" type="search" autocomplete="off" data-field="prefQuery" value="${esc(s.query || "")}" placeholder="${esc(t("entry.exercise_preferences.search"))}"></label>
      <div class="card"><div role="list" aria-label="${esc(t("entry.exercise_preferences.results"))}">${matches.map((e) => { const n = TF.libraryName(e, lang); return `<div class="row row--between" role="listitem" style="padding:8px 12px;border-top:1px solid var(--rule)"><span class="t-small" style="flex:1;min-width:0">${esc(n)}</span><span class="row" style="gap:6px"><button type="button" class="btn btn--sm" aria-label="${esc(t("entry.exercise_preferences.include"))} ${esc(n)}" data-act="pref-add" data-id="${esc(e.id)}" data-status="include">${esc(t("entry.exercise_preferences.include"))}</button><button type="button" class="btn btn--sm" aria-label="${esc(t("entry.exercise_preferences.avoid"))} ${esc(n)}" data-act="pref-add" data-id="${esc(e.id)}" data-status="avoid">${esc(t("entry.exercise_preferences.avoid"))}</button></span></div>`; }).join("")}</div></div>
      <section aria-labelledby="incLab"><p class="t-label" id="incLab">${esc(t("entry.exercise_preferences.include_list"))}</p>${(s.mustHave || []).length ? `<div class="card">${s.mustHave.map((id) => { const e = TF.libraryEntry(id); return `<div class="row row--between" style="padding:8px 12px;border-top:1px solid var(--rule)"><span class="t-small">${esc(e ? TF.libraryName(e, lang) : id)}</span><button type="button" class="btn btn--link" data-act="pref-remove" data-id="${esc(id)}">${esc(t("entry.exercise_preferences.remove"))}</button></div>`; }).join("")}</div>` : `<p class="t-caption">${esc(t("entry.exercise_preferences.include_none"))}</p>`}</section>
      <section aria-labelledby="avLab"><p class="t-label" id="avLab">${esc(t("entry.exercise_preferences.avoid_list"))}</p>${s.pending ? T.reasonBlock(t, lang, s.pending, null, true) : ""}${(s.constraints || []).length ? s.constraints.map((c) => T.reasonBlock(t, lang, c.exerciseId, c.reason, false)).join("") : s.pending ? "" : `<p class="t-caption">${esc(t("entry.exercise_preferences.avoid_none"))}</p>`}</section>
      ${hasPain ? `<p class="status-line" role="note"><span class="icon-mask icon-mask--shield" aria-hidden="true" style="color:var(--accent)"></span><span>${esc(t("entry.priorities.pain_note"))}</span></p>` : ""}
    </div>`;
  };

  /* ---------- answers reducer shared by all candidates (mirrors app.js picks) ---------- */
  T.applyPick = function (a, key, raw) {
    const next = { ...a };
    if (key === "environment") { next.environment = TF.env(raw); return next; }
    if (key === "environmentEquipment" || key === "environmentCapabilities") {
      const envv = next.environment || { kind: "other", equipment: [], capabilities: [] }; const field = key === "environmentEquipment" ? "equipment" : "capabilities";
      const cur = [...(envv[field] || [])]; const i = cur.indexOf(raw); if (i >= 0) cur.splice(i, 1); else cur.push(raw);
      next.environment = { ...envv, [field]: cur }; return next;
    }
    if (key === "musclePriority") {
      const [m, st] = String(raw).split("|");
      const primary = (next.primaryMuscles || []).filter((x) => x !== m), de = (next.deEmphasizedMuscles || []).filter((x) => x !== m), ig = (next.ignoredMuscles || []).filter((x) => x !== m);
      if (st === "prioritize") { if (primary.length >= 2) return a; primary.push(m); } else if (st === "deemphasize") de.push(m); else if (st === "ignore") ig.push(m);
      return { ...next, primaryMuscles: primary, deEmphasizedMuscles: de, ignoredMuscles: ig };
    }
    if (key === "avoidReason") { const [id, reason] = String(raw).split("|"); const cs = [...(next.exerciseConstraints || [])]; const i = cs.findIndex((c) => c.exerciseId === id); if (i >= 0) cs[i] = { exerciseId: id, reason }; else cs.push({ exerciseId: id, reason }); next.exerciseConstraints = cs; return next; }
    if (key === "preferredRestSeconds") { next.preferredRestSeconds = raw === "auto" ? null : +raw; return next; }
    if (key === "daysPerWeek" || key === "sessionMinutes") { next[key] = +raw; return next; }
    if (key === "primaryMuscles" || key === "priorityMovements") { const cur = [...(next[key] || [])]; const i = cur.indexOf(raw); if (i >= 0) cur.splice(i, 1); else if (cur.length < 2) cur.push(raw); next[key] = cur; return next; }
    if (key === "clearPriorities") { next.primaryMuscles = []; return next; }
    next[key] = raw; return next;
  };

  /* ---------- free-form model ---------- */
  T.freeform = {
    create: () => ({ stage: 1, input: "", reply: "", status: null, failReason: null, gap: null, gapAnswers: {}, gapErrors: new Set(), copied: false, invalidated: false, provider: null }),
    program: (ff) => { const v = ff.input.trim(); return v.length >= 10 ? v.slice(0, TF.FREEFORM_MAX_CHARS) : ""; },
    lines: (ff) => ff.input.split(/\r?\n/).filter(Boolean).length,
    apply(ff, act, payload, t) {
      const n = { ...ff, gapErrors: new Set(ff.gapErrors) };
      switch (act) {
        case "input": n.input = String(payload || "").slice(0, TF.FREEFORM_MAX_CHARS); n.copied = false; return n;
        case "continue": if (!T.freeform.program(n)) return n; n.stage = 2; return n;
        case "copy": case "open": n.copied = true; n.provider = payload || "copy"; n.stage = 3; return n;
        case "edit-source": if (n.reply.trim()) { n.reply = ""; n.invalidated = true; } n.stage = 1; n.status = null; return n;
        case "reply": n.reply = String(payload || ""); n.status = null; n.failReason = null; return n;
        case "try-another": n.stage = 2; n.status = null; return n;
        case "start-over": return T.freeform.create();
        case "review": {
          const r = TF.parseFreeformReply(n.reply);
          if (r.status === "unreadable") { n.status = "unreadable"; n.failReason = r.reason; return n; }
          if (r.status === "gaps") { n.gap = r; n.gapAnswers = {}; n.gapErrors = new Set(); n.status = "gaps"; return n; }
          n.status = "complete"; n.parsed = { meta: r.meta, exercises: r.exercises, notImported: r.notImported }; return n;
        }
        case "gap-input": n.gapAnswers = { ...n.gapAnswers, [payload.key]: payload.value }; n.gapErrors.delete(payload.key); return n;
        case "gap-submit": { const r = TF.assembleGaps(n.gap, n.gapAnswers); if (!r.ok) { n.gapErrors = r.errors; return n; } n.status = "complete"; n.parsed = r.source; n.gap = null; return n; }
        case "gap-back": n.gap = null; n.status = null; n.gapErrors = new Set(); return n;
        default: return n;
      }
    },
    /* Stage body only; the candidate supplies heading/lede/chrome. */
    body(t, lang, ff, { compact = false } = {}) {
      const program = T.freeform.program(ff);
      if (ff.status === "gaps" && ff.gap) return T.freeform.gaps(t, lang, ff);
      const summary = ff.stage > 1 ? `<div class="card"><div class="card__body row row--between"><span class="t-small">${esc(t("entry.freeform.source_summary", { lines: T.freeform.lines(ff) }))}</span><button type="button" class="btn btn--sm" data-act="ff" data-ff="edit-source">${esc(t("entry.freeform.edit_source"))}</button></div></div>` : "";
      if (ff.stage === 1) return `<div class="stack">
        <label class="field"><span>${esc(t("entry.freeform.input_label"))}</span><textarea id="ffIn" rows="${compact ? 5 : 7}" maxlength="${TF.FREEFORM_MAX_CHARS}" spellcheck="false" autocapitalize="off" data-field="ffInput" placeholder="${esc(t("entry.freeform.input_placeholder"))}">${esc(ff.input)}</textarea><span class="field__hint" id="ffCount">${esc(t("entry.freeform.count", { n: TF.nf(lang, ff.input.length), max: TF.nf(lang, TF.FREEFORM_MAX_CHARS) }))}</span></label>
        <p class="t-caption" id="ffNeeds"${program ? " hidden" : ""}>${esc(t("entry.freeform.needs_input"))}</p>
        <p class="notice notice--quiet" role="note">${esc(t("entry.freeform.privacy"))}</p>
        <button type="button" class="btn btn--primary" data-act="ff" data-ff="continue"${program ? "" : " disabled"}>${esc(t("entry.freeform.continue"))}</button></div>`;
      if (ff.stage === 2) return summary + `<div class="stack section-gap" style="margin-top:14px">
        <p class="t-label t-label--accent"><span class="icon-mask icon-mask--wand icon-mask--sm" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"></span>${esc(t("entry.freeform.stage2_title"))}</p>
        <p class="t-small t-soft">${esc(t("entry.freeform.stage2_hint"))}</p>
        <div class="grid-2"><a class="btn" href="https://chatgpt.com/?q=${encodeURIComponent(TF.freeformPrompt(t, program))}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="chatgpt">${esc(t("entry.freeform.open_chatgpt"))}</a><a class="btn" href="https://claude.ai/new?q=${encodeURIComponent(TF.freeformPrompt(t, program))}" target="_blank" rel="noopener noreferrer" data-act="ff" data-ff="open" data-provider="claude">${esc(t("entry.freeform.open_claude"))}</a></div>
        <details class="disclosure disclosure--plain"><summary>${esc(t("entry.freeform.preview_prompt"))}</summary><pre class="t-caption" style="white-space:pre-wrap;font-family:var(--font-training-data);padding:8px 0">${esc(TF.freeformPrompt(t, program))}</pre></details>
        <div class="row" style="justify-content:center"><button type="button" class="btn btn--quiet" data-act="ff" data-ff="copy">${esc(t("entry.freeform.copy"))}</button></div></div>`;
      const unreadable = ff.status === "unreadable" ? `<div class="notice notice--error" role="alert"><strong><span class="icon-mask icon-mask--alert icon-mask--sm" aria-hidden="true"></span>${esc(t("entry.freeform.unreadable_title"))}</strong><p>${esc(t("entry.freeform.unreadable_body"))}</p><div class="btnrow"><button type="button" class="btn" data-act="ff" data-ff="copy-repair">${esc(t("entry.freeform.copy_repair_prompt"))}</button><button type="button" class="btn btn--quiet" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button></div></div>` : "";
      const invalidated = ff.invalidated ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.edit_source_warning"))}</p>` : "";
      return summary + `<div class="stack" style="margin-top:14px">${invalidated}${unreadable}
        <p class="t-label t-label--accent"><span class="icon-mask icon-mask--clipboard icon-mask--sm" aria-hidden="true" style="vertical-align:-3px;margin-right:6px"></span>${esc(t("entry.freeform.stage3_title"))}</p>
        <p class="t-small t-soft">${esc(t("entry.freeform.stage3_hint"))}</p>
        <button type="button" class="btn btn--primary" data-act="ff" data-ff="clipboard">${esc(t("entry.freeform.clipboard_import"))}</button>
        <p class="t-caption" style="text-align:center">${esc(t("entry.freeform.clipboard_or"))}</p>
        <label class="field"><span class="visually-hidden">${esc(t("entry.freeform.stage3_title"))}</span><textarea id="ffOut" rows="${compact ? 5 : 7}" spellcheck="false" autocapitalize="off" data-field="ffReply" placeholder="${esc(t("entry.freeform.output_placeholder"))}">${esc(ff.reply)}</textarea></label>
        <button type="button" class="btn btn--primary" data-act="ff" data-ff="review">${esc(t("entry.freeform.review"))}</button>
        <div class="btnrow"><button type="button" class="btn" data-act="ff" data-ff="try-another">${esc(t("entry.freeform.try_another"))}</button><button type="button" class="btn btn--quiet btn--destructive" data-act="ff" data-ff="start-over">${esc(t("entry.freeform.start_over"))}</button></div></div>`;
    },
    gaps(t, lang, ff) {
      const g = ff.gap; const ni = g.notImported.length ? `<p class="notice notice--info" role="status">${esc(t("entry.freeform.not_imported_notice", { items: g.notImported.map((c) => t(`entry.freeform.not_imported.${c}`)).join(", ") }))}</p>` : "";
      const err = ff.gapErrors.size ? `<p class="notice notice--error" role="alert">${esc(t("entry.freeform.gap_error"))}</p>` : "";
      return `<div class="stack">${ni}${err}${g.gaps.map((gap) => { const bad = ff.gapErrors.has(gap.key); const label = gap.field === "sets" ? t("entry.freeform.gap_sets_label", { exercise: `${gap.day} · ${gap.name}` }) : t("entry.freeform.gap_reps_label", { exercise: `${gap.day} · ${gap.name}` }); return `<label class="field"><span>${esc(label)}</span><input type="text" inputmode="numeric" class="${bad ? "is-invalid" : ""}"${bad ? ' aria-invalid="true"' : ""} data-field="gap" data-key="${esc(gap.key)}" value="${esc(ff.gapAnswers[gap.key] || "")}" placeholder="${esc(gap.field === "sets" ? t("entry.freeform.gap_sets_placeholder") : t("entry.freeform.gap_reps_placeholder"))}">${bad ? `<span class="field__error">${esc(t("entry.freeform.gap_error"))}</span>` : ""}</label>`; }).join("")}
        <div class="btnrow"><button type="button" class="btn btn--primary" data-act="ff" data-ff="gap-submit">${esc(t("entry.freeform.gaps_submit"))}</button><button type="button" class="btn" data-act="ff" data-ff="gap-back">${esc(t("entry.freeform.back_to_reply"))}</button></div></div>`;
    },
  };

  /* ---------- import review model ---------- */
  T.importReview = {
    apply(draft, act, key, idx) {
      const d = { ...draft, rows: draft.rows.map((r) => ({ ...r })) }; const row = d.rows.find((r) => r.key === key); if (!row) return d;
      const settle = () => { row.reviewed = true; row.expanded = false; };
      if (act === "expand") { row.expanded = true; return d; }
      if (act === "pick") { const e = row.shortlist[Number(idx)]; if (!e) return d; row.match = e; row.decision = "link"; settle(); return d; }
      if (act === "link" && row.match) { row.decision = "link"; settle(); return d; }
      if (act === "raw") { row.decision = "raw"; settle(); return d; }
      if (act === "custom") { row.decision = "custom"; row.createdCustom = { id: `custom:${TF.fold(row.raw.name).replace(/[^a-z0-9]+/g, "-")}`, name: row.raw.name }; settle(); return d; }
      if (act === "choose" && idx) { const e = TF.libraryEntry(idx); if (e) { row.match = e; row.decision = "link"; settle(); } return d; }
      return d;
    },
    rows(t, lang, draft, { picker } = {}) {
      const ordered = [...draft.rows].sort((a, b) => (a.reviewed ? 1 : 0) - (b.reviewed ? 1 : 0));
      return `<div class="card"><div style="padding:0 14px">${ordered.map((row) => {
        const proposed = !row.reviewed && row.match ? row.match : null; const shown = row.decision === "link" && row.match ? row.match : proposed;
        const target = shown ? TF.libraryName(shown, lang) : row.decision === "custom" ? t("import.target_custom") : t("import.target_raw");
        const badge = row.reviewed ? `<span class="impbadge is-done">${esc(t("import.status.confirmed"))}</span>` : `<span class="impbadge is-open">${esc(t(`import.status.${row.status === "probable" ? "probable" : row.status}`))}</span>`;
        const media = TF.mediaFor(shown); const art = `<span class="improw__art" aria-hidden="true">${media ? `<img src="${media}" alt="" loading="eager">` : ""}</span>`;
        const folded = row.reviewed && !row.expanded;
        const chips = !folded && row.shortlist.length ? row.shortlist.map((e, i) => `<button type="button" class="btn btn--sm" data-act="imp" data-imp="pick" data-key="${row.key}" data-idx="${i}">${esc(t("import.action_link", { name: TF.libraryName(e, lang) }))}</button>`).join("") : (!folded && row.match && row.decision !== "link" ? `<button type="button" class="btn btn--sm" data-act="imp" data-imp="link" data-key="${row.key}">${esc(t("import.action_link", { name: TF.libraryName(row.match, lang) }))}</button>` : "");
        const escapes = `<button type="button" class="btn btn--sm" data-act="imp" data-imp="choose" data-key="${row.key}">${esc(t("import.action_choose"))}</button>${row.decision !== "raw" || !row.reviewed ? `<button type="button" class="btn btn--sm" data-act="imp" data-imp="raw" data-key="${row.key}">${esc(t("import.action_keep"))}</button>` : ""}${row.decision !== "custom" ? `<button type="button" class="btn btn--sm" data-act="imp" data-imp="custom" data-key="${row.key}">${esc(t("import.action_custom"))}</button>` : ""}`;
        const acts = folded ? `<button type="button" class="btn btn--sm btn--quiet" data-act="imp" data-imp="expand" data-key="${row.key}">${esc(t("import.action_change"))}</button>` : chips ? chips + `<details class="disclosure disclosure--plain" style="flex:1 0 100%"><summary>${esc(t("import.more_options"))}</summary><div class="improw__acts" style="padding:6px 0 4px">${escapes}</div></details>` : escapes;
        const pickerHtml = picker && picker.key === row.key ? `<div class="improw__acts" style="flex-direction:column;align-items:stretch">${T.pickerBody(t, lang, picker.query, { limit: 6, all: true })}</div>` : "";
        return `<div class="improw${row.reviewed ? "" : " is-open"}" data-imp-row="${row.key}"><p class="improw__from">${esc(row.raw.name || "")}</p><span class="improw__arrow" aria-hidden="true">→</span>${art}<div class="improw__to"><p class="improw__name">${esc(target)}</p>${badge}</div><div class="improw__acts">${acts}</div>${pickerHtml}</div>`;
      }).join("")}</div></div>`;
    },
    counts(t, draft) { const c = TF.importCounts(draft); return `<div class="metrics"><div class="metric"><span class="metric__value">${c.linked}</span><span class="t-caption">${esc(t("import.count_linked"))}</span></div><div class="metric"><span class="metric__value">${c.review}</span><span class="t-caption">${esc(t("import.count_review"))}</span></div><div class="metric"><span class="metric__value">${c.custom}</span><span class="t-caption">${esc(t("import.count_custom"))}</span></div></div>`; },
  };
  T.pickerBody = function (t, lang, query, { limit = 8, all = false, exclude = new Set() } = {}) {
    const results = TF.searchLibrary(query, lang, { limit, all, exclude });
    return `<label class="field field--search"><span>${esc(t("x.build.search"))}</span><span class="icon-mask icon-mask--search" aria-hidden="true"></span><input id="pickerSearch" type="search" autocomplete="off" data-field="pickerQuery" value="${esc(query || "")}" placeholder="${esc(t("entry.search_placeholder"))}"></label>
      <div class="stack stack--tight" role="listbox">${results.map((e) => `<button type="button" class="choice choice--compact" role="option" data-act="pick-exercise" data-id="${esc(e.id)}"><span class="choice__body"><span class="choice__title">${esc(TF.libraryName(e, lang))}</span><span class="choice__cap">${esc(t(`entry.muscle.${String(e.primary).toLowerCase().replace(/[^a-z]+/g, "_")}`, undefined, e.primary))} · ${esc((e.equipment || []).map((k) => t(`entry.equip.${k}`, undefined, k)).join(", "))}</span></span><span class="icon-mask icon-mask--plus" aria-hidden="true" style="color:var(--ink-soft)"></span></button>`).join("")}</div>`;
  };

  /* ---------- build model (manual program) ---------- */
  T.build = {
    create: (name, days) => ({ name: name || "", days: Array.from({ length: days }, (_, i) => ({ dayId: `manual_d${i + 1}`, label: `Day ${i + 1}`, exercises: [] })), picker: null, query: "" }),
    preview(b, t) {
      const program = []; b.days.forEach((d) => d.exercises.forEach((e, i) => program.push({ id: e.id, day: d.label, dayId: d.dayId, order: i + 1, name: e.name, libraryId: e.libraryId, sets: e.sets, min: e.min, max: e.max, primary: e.primary, secondary: e.secondary, progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: e.sets, repMin: e.min, repMax: e.max, targetRirMin: 1, targetRirMax: 3 } }, modifiers: [] } })));
      return { source: "manual_build", frequency: b.days.length, program, days: b.days.map((d) => ({ dayId: d.dayId, label: d.label, exercises: d.exercises.map((e) => ({ id: e.id, name: e.name, libraryId: e.libraryId, sets: e.sets, min: e.min, max: e.max })) })), programStructure: { schemaVersion: 1, days: b.days.map((d, i) => ({ dayId: d.dayId, label: d.label, order: i + 1 })) }, limitations: [], reductions: [], primaryMuscles: [] };
    },
    issues(b, t) {
      const out = []; const empty = b.days.filter((d) => !d.exercises.length);
      if (empty.length) out.push(t("entry.editor.empty_days", { days: empty.map((d) => T.dayLabel(t, d)).join(", ") }));
      if (b.days.some((d) => d.exercises.some((e) => !(Number.isInteger(e.sets) && e.sets >= 1 && Number.isInteger(e.min) && e.min >= 1 && Number.isInteger(e.max) && e.max >= e.min)))) out.push(t("entry.editor.exercise_invalid"));
      return out;
    },
    apply(b, act, p) {
      const n = { ...b, days: b.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })) };
      if (act === "open-picker") { n.picker = p.dayId; n.query = ""; return n; }
      if (act === "close-picker") { n.picker = null; return n; }
      if (act === "query") { n.query = p; return n; }
      if (act === "add") { const d = n.days.find((x) => x.dayId === n.picker); const e = TF.libraryEntry(p); if (d && e) { d.exercises.push({ id: `${d.dayId}_${TF.uid().slice(0, 8)}`, libraryId: e.id, name: e.name, primary: e.primary, secondary: e.secondary, sets: 3, min: 6, max: 10 }); } n.picker = null; return n; }
      if (act === "remove") { const d = n.days.find((x) => x.dayId === p.dayId); if (d) d.exercises = d.exercises.filter((e) => e.id !== p.id); return n; }
      if (act === "field") { const d = n.days.find((x) => x.dayId === p.dayId); const e = d && d.exercises.find((x) => x.id === p.id); if (e) { const v = parseInt(p.value, 10); e[p.field] = Number.isFinite(v) ? v : NaN; } return n; }
      if (act === "step") { const d = n.days.find((x) => x.dayId === p.dayId); const e = d && d.exercises.find((x) => x.id === p.id); if (e) e.sets = Math.min(10, Math.max(1, (e.sets || 0) + p.delta)); return n; }
      if (act === "day-name") { const d = n.days.find((x) => x.dayId === p.dayId); if (d) d.label = p.value; return n; }
      if (act === "name") { n.name = p; return n; }
      return n;
    },
    editor(t, lang, b) {
      return `<div class="stack">${b.days.map((d) => `<div class="card" data-day="${d.dayId}"><div class="card__body stack stack--tight">
        <label class="field"><span>${esc(t("x.build.day_name"))}</span><input type="text" data-field="dayName" data-day="${d.dayId}" value="${esc(T.dayLabel(t, d))}" aria-label="${esc(t("program.day.name_aria"))}"></label>
        ${d.exercises.length ? d.exercises.map((e) => { const bad = !(Number.isInteger(e.sets) && e.sets >= 1 && Number.isInteger(e.min) && e.min >= 1 && Number.isInteger(e.max) && e.max >= e.min); return `<div class="well stack stack--tight" data-ex="${e.id}"><div class="row row--between"><strong class="t-small">${esc(T.exName(e, lang))}</strong><button type="button" class="btn btn--link btn--destructive" style="border:0" data-act="build" data-build="remove" data-day="${d.dayId}" data-id="${e.id}">${esc(t("x.build.remove"))}</button></div>
          <div class="row" style="flex-wrap:wrap;gap:10px"><span class="stack stack--tight"><span class="t-label">${esc(t("x.build.sets"))}</span><span class="stepper"><button type="button" data-act="build" data-build="step" data-day="${d.dayId}" data-id="${e.id}" data-delta="-1" aria-label="−">−</button><output aria-live="polite">${Number.isFinite(e.sets) ? e.sets : "–"}</output><button type="button" data-act="build" data-build="step" data-day="${d.dayId}" data-id="${e.id}" data-delta="1" aria-label="+">+</button></span></span>
          <label class="field" style="width:76px"><span>${esc(t("x.build.min"))}</span><input type="number" inputmode="numeric" min="1" data-field="rx" data-rx="min" data-day="${d.dayId}" data-id="${e.id}" value="${Number.isFinite(e.min) ? e.min : ""}"${bad ? ' aria-invalid="true" class="is-invalid"' : ""}></label>
          <label class="field" style="width:76px"><span>${esc(t("x.build.max"))}</span><input type="number" inputmode="numeric" min="1" data-field="rx" data-rx="max" data-day="${d.dayId}" data-id="${e.id}" value="${Number.isFinite(e.max) ? e.max : ""}"${bad ? ' aria-invalid="true" class="is-invalid"' : ""}></label></div>${bad ? `<span class="field__error">${esc(t("x.build.rx_invalid"))}</span>` : ""}</div>`; }).join("") : `<p class="t-caption">${esc(t("program.empty.exercises"))}</p>`}
        ${b.picker === d.dayId ? `<div class="stack stack--tight">${T.pickerBody(t, lang, b.query, { limit: 6, all: true })}<button type="button" class="btn btn--quiet" data-act="build" data-build="close-picker">${esc(t("x.build.done"))}</button></div>` : `<button type="button" class="btn" data-act="build" data-build="open-picker" data-day="${d.dayId}"><span class="icon-mask icon-mask--plus" aria-hidden="true"></span>${esc(t("x.build.add"))}</button>`}
      </div></div>`).join("")}</div>`;
    },
  };
  T.dayLabel = (t, d) => { const m = /^Day (\d+)$/i.exec(String(d.label || "").trim()); return m ? t("program.default.day", { n: +m[1] }) : d.label; };

  /* ---------- delegated event wiring ---------- */
  T.wire = function (root, on) {
    root.onclick = (ev) => {
      const el = ev.target.closest("[data-act]"); if (!el || el.disabled) return;
      if (el.tagName === "A" && el.dataset.act === "ff") ev.preventDefault();
      on(el.dataset.act, el.dataset, el, ev);
    };
    root.oninput = (ev) => { const el = ev.target.closest("[data-field]"); if (el) on("field:" + el.dataset.field, { ...el.dataset, value: el.value }, el, ev); };
    root.onchange = (ev) => { const el = ev.target.closest("[data-field]"); if (el && (el.type === "number" || el.tagName === "SELECT")) on("change:" + el.dataset.field, { ...el.dataset, value: el.value }, el, ev); };
  };
  /* Keep the caret in a search field across a rerender. */
  T.refocus = function (root, id) { const el = root.querySelector("#" + CSS.escape(id)); if (el) { try { el.focus({ preventScroll: true }); const n = el.value.length; el.setSelectionRange && el.setSelectionRange(n, n); } catch {} } };
  T.focusHeading = function (root) { const h = root.querySelector("h1,h2,[data-focus]"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch {} } };

  /* ---------- replacement / conflict / resume helpers (same rules everywhere) ---------- */
  T.replaceSheet = (t, current, next, n) => `<div class="sheet-scrim" data-act="replace-cancel"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="replTitle" data-checkpoint="replace-confirm"><h2 id="replTitle">${esc(t("x.replace.title"))}</h2><p>${esc(t("x.replace.body", { current, next, n }))}</p><div class="stack stack--tight"><button type="button" class="btn btn--primary btn--noarrow" data-act="replace-confirm">${esc(t("x.replace.confirm", { next }))}</button><button type="button" class="btn" data-act="replace-cancel">${esc(t("x.replace.cancel", { current }))}</button></div></div>`;
  T.cancelSheet = (t) => `<div class="sheet-scrim" data-act="cancel-continue"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cancelTitle" data-checkpoint="cancel-confirm"><h2 id="cancelTitle">${esc(t("entry.cancel_confirm.title"))}</h2><p>${esc(t("entry.cancel_confirm.body"))}</p><div class="stack stack--tight"><button type="button" class="btn btn--primary btn--noarrow" data-act="cancel-keep">${esc(t("entry.cancel_confirm.keep"))}</button><button type="button" class="btn btn--destructive" data-act="cancel-discard">${esc(t("entry.cancel_confirm.discard"))}</button><button type="button" class="btn btn--quiet" data-act="cancel-continue">${esc(t("entry.cancel_confirm.continue"))}</button></div></div>`;
  T.conflictNotice = (t) => `<div class="notice notice--error" role="alert" data-checkpoint="activation-conflict"><strong><span class="icon-mask icon-mask--alert icon-mask--sm" aria-hidden="true"></span>${esc(t("entry.conflict.title"))}</strong><p>${esc(t("entry.conflict.body"))}</p><div class="btnrow"><button type="button" class="btn" data-act="conflict-review">${esc(t("entry.conflict.review"))}</button></div></div>`;
  T.rulesNotice = (t, { keep = false, keepReady = true } = {}) => `<div class="notice notice--warn" role="status" data-checkpoint="rules-changed"><strong><span class="icon-mask icon-mask--alert icon-mask--sm" aria-hidden="true"></span>${esc(t("entry.rules_changed.title"))}</strong><p>${esc(t(keep ? "entry.rules_changed.body_keep" : "entry.rules_changed.body_rebuild"))}</p><div class="btnrow">${keep ? `<button type="button" class="btn" data-act="rules-keep"${keepReady ? "" : " disabled"}>${esc(t("entry.rules_changed.keep"))}</button>` : `<button type="button" class="btn" data-act="rules-rebuild">${esc(t("entry.rules_changed.rebuild"))}</button>`}</div></div>`;
  T.activeNotice = (t) => `<p class="notice notice--quiet" role="status">${esc(t("entry.active_notice"))}</p>`;

  /* Seeds shared by every candidate for the recovery/conflict checkpoints. */
  T.seeds = {
    interruptedDraft(lang) {
      const u = TF.F.users.rafael.answers;
      const answers = { desiredResult: u.desiredResult, structuredExperience: u.structuredExperience, recentConsistency: u.recentConsistency, daysPerWeek: u.daysPerWeek, sessionMinutes: u.sessionMinutes, preferredRestSeconds: u.preferredRestSeconds, environment: TF.env(u.environmentKind) };
      const state = TF.entryState({ route: "recommend", answers, step: "priorities", draftId: "11111111-1111-4111-8111-111111111111", now: new Date(Date.now() - 86400000).toISOString() });
      return { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "harness", state: { ...state, updatedAt: new Date(Date.now() - 86400000).toISOString() } };
    },
    rulesDriftDraft() {
      const u = TF.F.users.rafael.answers;
      const answers = { desiredResult: u.desiredResult };
      const state = TF.entryState({ route: "recommend", answers, step: "desired_result", draftId: "22222222-2222-4222-8222-222222222222", versions: { ...TF.versions(), rules: "old-rules" } });
      return { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "harness", state };
    },
  };
  window.TS = T;
})();
