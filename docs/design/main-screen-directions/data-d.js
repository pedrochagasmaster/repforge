/* Direction D family: the data layer.
   Extends window.TX without changing any value that A, B or C read. Every
   recommendation below is produced live by RepForgeProgression
   (progression-engine.js, loaded read-only), every outcome word comes from
   canonicalOutcome(), and every shipped word is read from i18n.js. D and the
   candidates built on it (E, F, G) all read this one file, so a figure can
   never differ between them. Review-only; nothing here is loaded by the app. */
(function (root) {
  "use strict";
  const T = root.TX, ENG = root.RepForgeProgression, I18N = root.RepForgeI18n;
  if (!T || !ENG || !I18N) throw new Error("data-d.js needs data.js, progression-engine.js and i18n.js first");

  /* ---------- engine inputs ----------
     App defaults: 2,5 % jump, 2,5 kg minimum step, hard-RIR cap 4. The block
     started 31 Aug 2026 and runs six weeks. */
  const SETTINGS = Object.freeze({ minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 });
  const CONTEXT = Object.freeze({ weekNumber: 4, blockLength: 6, blockStart: "2026-08-31" });
  const UNIT = "kg";

  /* ---------- the D-only mixed day ----------
     "Dia 2 · misto": one lift per strategy, a movement without an
     illustration, a custom exercise and a set logged without RIR. It lives in
     its own scenario (Wednesday 23 Sep, week 4) and A, B and C never see it.
     Names, muscles and plate grounds are copied from exercises.js. */
  const ART = "../../../assets/exercises/";
  const MIX_EX = {
    dl: { id: "dl_bb", pt: "Levantamento terra com barra", en: "Barbell deadlift", bg: "#efe4d5", art: ART + "dl_bb.webp", pri: ["Hamstrings", "Glutes"], sec: ["Spinal erectors"] },
    ht: { id: "ht_bb", pt: "Elevação pélvica com barra", en: "Barbell hip thrust", bg: "#f2e9da", art: ART + "ht_bb.webp", pri: ["Glutes"], sec: ["Hamstrings"] },
    // Library movement with no licensed illustration: the tile stays empty.
    ts: { id: "trs_bb", pt: "Tríceps testa com barra", en: "Barbell skull crusher", bg: null, art: null, pri: ["Triceps"], sec: ["Front delts"] },
    cp: { id: "cvl_mc", pt: "Panturrilha no leg press", en: "Calf press on leg press", bg: "#ebdecd", art: ART + "cvl_mc.webp", pri: ["Calves"], sec: [] },
    // A custom exercise: the lifter typed this name, so it reads the same in both languages.
    cr: { id: "custom:remada-articulada", custom: true, pt: "Remada articulada no aparelho", en: "Remada articulada no aparelho", bg: null, art: null, pri: ["Mid/upper back"], sec: ["Biceps"] },
    hc: { id: "cuh_db", pt: "Rosca martelo com halteres", en: "Dumbbell hammer curl", bg: "#ede0d0", art: ART + "cuh_db.webp", pri: ["Biceps"], sec: ["Forearms"] },
  };

  // Prescriptions, exactly as the engine receives them.
  const P = (id, params) => ({ schemaVersion: 1, strategy: { id, version: 1, params }, modifiers: [] });
  const MIX_RX = {
    dl: P("anchor_backoff", { anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 1, anchorTargetRirMax: 2, backoffSets: 2, backoffRepMin: 6, backoffRepMax: 8, backoffPercent: 0.85, minLoadIncrement: 2.5, jumpPercent: 2.5 }),
    ht: P("rep_goal", { workingSets: 3, repGoal: 36, repFloor: 8, repCeiling: 15, targetRirMin: 1, targetRirMax: 3, minLoadIncrement: 2.5, jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1" }),
    ts: P("effort_target", { workingSets: 3, targetReps: 10, targetRirMin: 2, targetRirMax: 3, minLoadIncrement: 2.5 }),
    cp: P("manual", {}),
    cr: P("range", { workingSets: 3, repMin: 8, repMax: 12, targetRirMin: 0, targetRirMax: 2 }),
    hc: P("range", { workingSets: 2, repMin: 10, repMax: 15, targetRirMin: 0, targetRirMax: 2 }),
  };
  // Authored template for the manual slot. The engine returns no target for it.
  const MANUAL = { cp: { sets: 3, lo: 12, hi: 15, load: 120 } };

  const W = (load, reps, rir, role) => (role ? { load, reps, rir, role } : { load, reps, rir });
  // Logged history of the mixed day, oldest first. hc's last set has no RIR.
  const MIX_SESSIONS = [
    { date: "2026-09-02", lifts: {
      dl: [W(130, 4, 2, "anchor"), W(110, 8, 2, "backoff"), W(110, 7, 1, "backoff")],
      ht: [W(90, 12, 2), W(90, 11, 2), W(90, 10, 1)],
      ts: [W(30, 10, 3), W(30, 10, 3), W(30, 10, 2)],
      cp: [W(120, 15, 2), W(120, 14, 2), W(120, 13, 1)],
      cr: [W(50, 10, 2), W(50, 9, 1), W(50, 9, 1)],
      hc: [W(15, 12, 1), W(15, 11, 1)],
    } },
    { date: "2026-09-09", lifts: {
      dl: [W(132.5, 5, 1, "anchor"), W(112.5, 8, 2, "backoff"), W(112.5, 8, 1, "backoff")],
      ht: [W(95, 12, 2), W(95, 12, 1), W(95, 11, 1)],
      ts: [W(32.5, 10, 3), W(32.5, 10, 2), W(32.5, 10, 2)],
      cp: [W(120, 15, 2), W(120, 15, 1), W(120, 14, 1)],
      cr: [W(50, 11, 2), W(50, 10, 1), W(50, 10, 1)],
      hc: [W(15, 13, 1), W(15, 12, 1)],
    } },
    { date: "2026-09-16", lifts: {
      dl: [W(135, 5, 1, "anchor"), W(115, 8, 2, "backoff"), W(115, 8, 1, "backoff")],
      ht: [W(100, 12, 1), W(100, 11, 1), W(100, 10, 1)],
      ts: [W(32.5, 10, 4), W(32.5, 10, 4), W(32.5, 10, 3)],
      cp: [W(120, 15, 1), W(120, 15, 1), W(120, 15, 0)],
      cr: [W(50, 12, 1), W(50, 12, 1), W(50, 11, 0)],
      hc: [W(15, 13, 1), W(15, 12, null)],
    } },
  ];
  const MIX = { name: ["Dia 2 · misto", "Day 2 · mixed"], lifts: ["dl", "ht", "ts", "cp", "cr", "hc"], today: "2026-09-23", first: "2026-09-02" };

  /* ---------- language ---------- */
  const L = () => (T.state.lang === "pt" ? "pt" : "en");
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
  // A shipped string, word for word from i18n.js. Unknown keys throw so a typo can't ship.
  function s(key, vars) {
    const v = I18N.STRINGS[L()][key];
    if (v == null) throw new Error("missing shipped key " + key);
    return fill(v, vars);
  }
  const plain = (html) => String(html).replace(/<\/?b>/g, "");

  /* New strings, PT and EN. Every one is listed in the README table, which is
     generated from this object (tools: checks/strings-table.mjs). */
  const NEW = {
    "d.lede_week": ["{program}, semana {n} de {total}", "{program}, week {n} of {total}"],
    "d.tally.up.one": ["{n} sobe", "{n} goes up"],
    "d.tally.up.other": ["{n} sobem", "{n} go up"],
    "d.tally.hold.one": ["{n} mantém", "{n} holds"],
    "d.tally.hold.other": ["{n} mantêm", "{n} hold"],
    "d.tally.stalled.one": ["{n} travado", "{n} stalled"],
    "d.tally.stalled.other": ["{n} travados", "{n} stalled"],
    "d.tally.recover.one": ["{n} recupera", "{n} recovers"],
    "d.tally.recover.other": ["{n} recuperam", "{n} recover"],
    "d.tally.down.one": ["{n} reduz", "{n} backs off"],
    "d.tally.down.other": ["{n} reduzem", "{n} back off"],
    "d.tally.new.one": ["{n} novo", "{n} new"],
    "d.tally.new.other": ["{n} novos", "{n} new"],
    "d.tally.manual.one": ["{n} manual", "{n} manual"],
    "d.tally.manual.other": ["{n} manuais", "{n} manual"],
    "d.rx.title": ["Prescrição de hoje", "Today's prescription"],
    "d.rx.meta": ["{lifts} exercícios, {sets} séries", "{lifts} exercises, {sets} sets"],
    "d.col.exercise": ["Exercício", "Exercise"],
    "d.col.target": ["Meta", "Target"],
    "d.col.set": ["Série", "Set"],
    "d.col.next": ["Próxima (kg)", "Next (kg)"],
    "d.col.sets_range": ["Séries × faixa", "Sets × range"],
    "d.col.top_set": ["maior série", "top set"],
    "d.sub.before": ["Antes {sets}", "Last {sets}"],
    "d.sub.first": ["Primeira vez", "First time"],
    "d.sub.custom": ["Exercício personalizado", "Custom exercise"],
    "d.week_line": ["{done} de {planned} sessões", "{done} of {planned} sessions"],
    "d.target.total": ["total {n}", "total {n}"],
    "d.target.anchor": ["1 + {n}", "1 + {n}"],
    "d.head.day_ex": ["{day} · exercício {n} de {m}", "{day} · exercise {n} of {m}"],
    "d.exmeta.range": ["{sets} × {min}–{max} reps · RIR {rmin}–{rmax}", "{sets} × {min}–{max} reps · RIR {rmin}–{rmax}"],
    "d.exmeta.goal": ["{sets} séries · total {goal} reps · RIR {rmin}–{rmax}", "{sets} sets · {goal} reps total · RIR {rmin}–{rmax}"],
    "d.exmeta.effort": ["{sets} × {reps} reps · RIR {rmin}–{rmax}", "{sets} × {reps} reps · RIR {rmin}–{rmax}"],
    "d.exmeta.anchor": ["1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps", "1 × {amin}–{amax} + {n} × {bmin}–{bmax} reps"],
    "d.exmeta.manual": ["{sets} × {min}–{max} reps", "{sets} × {min}–{max} reps"],
    "d.prev_line": ["antes {load} × {reps} · RIR {rir}", "last {load} × {reps} · RIR {rir}"],
    "d.prev_line_norir": ["antes {load} × {reps} · sem RIR", "last {load} × {reps} · no RIR"],
    "d.next_row": ["Próximo: {name}", "Next: {name}"],
    "d.set_label": ["Série {n}", "Set {n}"],
    "d.field.load": ["Carga, kg", "Load, kg"],
    "d.pad.reps": ["{sign} 1 rep", "{sign} 1 rep"],
    "d.pad.load": ["{sign} {step} kg", "{sign} {step} kg"],
    "d.pad.rir": ["{sign} 1 RIR", "{sign} 1 RIR"],
    "d.log_set": ["Registrar série {n}", "Log set {n}"],
    "d.save_set": ["Salvar série {n}", "Save set {n}"],
    "d.rest.label": ["Descanso", "Rest"],
    "d.rest.of": ["de {t}", "of {t}"],
    "d.rest.pause": ["Pausar", "Pause"],
    "d.rest.resume": ["Retomar", "Resume"],
    "d.rest.skip": ["Pular", "Skip"],
    "d.rest.next": ["Série {n}: manter {load} kg, buscar {reps} reps", "Set {n}: hold {load} kg, aim for {reps} reps"],
    "d.rest.done": ["Descanso concluído", "Rest done"],
    "d.why_short": ["Por quê?", "Why?"],
    "d.why.close": ["Fechar", "Close"],
    "d.why.ok": ["Entendi", "Got it"],
    "d.why.calc": ["Ver o cálculo", "See the working"],
    "d.why.calc_hide": ["Ocultar o cálculo", "Hide the working"],
    "d.why.evidence": ["Com base em {n} sessão comparável, {date}", "Based on {n} comparable session, {date}"],
    "d.why.performed": ["{reps} reps com {load} kg, RIR {rirs}.", "{reps} reps at {load} kg, RIR {rirs}."],
    "d.why.lead.top": ["Topo da faixa atingido", "Top of the range reached"],
    "d.why.lead.hold": ["A faixa ainda tem espaço", "The range still has room"],
    "d.why.lead.stalled": ["Três sessões iguais", "Three sessions alike"],
    "d.why.lead.recover": ["Séries pesadas, reps iguais", "Hard sets, same reps"],
    "d.why.lead.load": ["Passo de carga", "Load step"],
    "d.why.lead.load_hold": ["Mesma carga", "Same load"],
    "d.why.lead.reps": ["Meta de {n} reps", "Target of {n} reps"],
    "d.why.lead.set1": ["O que a série 1 mostrou", "What set 1 showed"],
    "d.why.lead.set2": ["Meta da série 2", "Set 2 target"],
    "d.why.lead.goal": ["Total da última vez", "Last session's total"],
    "d.why.lead.effort": ["Esforço registrado", "Logged effort"],
    "d.why.lead.spread": ["Como as reps se dividem", "How the reps split"],
    "d.why.lead.anchor": ["Série principal", "Top set"],
    "d.why.lead.backoff": ["Séries mais leves", "Lighter sets"],
    "d.why.lead.manual": ["Carga do programa", "Program load"],
    "d.why.manual": ["O programa define esta carga. O Taurifer não a altera.", "The program sets this load. Taurifer does not change it."],
    "d.why.set1": ["A série 1 mostrou uma capacidade de {cap}: {reps} reps com {load} kg e RIR {rir}.", "Set 1 showed a capacity of {cap}: {reps} reps at {load} kg and RIR {rir}."],
    "d.why.set2": ["Com a queda habitual entre séries, a capacidade prevista é de cerca de {pred} na próxima série. Menos seu RIR habitual de {rir}, a meta fica em {reps}.", "With your usual drop between sets, the predicted capacity is about {pred} on the next set. Minus your usual {rir} RIR, the target stays at {reps}."],
    "d.why.split": ["As {total} repetições de hoje se dividem em {reps}.", "Today's {total} reps split into {reps}."],
    "d.why.top_rir": ["Você registrou RIR {rir}.", "You logged RIR {rir}."],
    "d.why.lead.rule": ["O que a regra pede", "What the rule asks"],
    "d.calc.set": ["Série {n}", "Set {n}"],
    "d.calc.last": ["Última sessão, {date}", "Last session, {date}"],
    "d.calc.working": ["Cálculo", "Working"],
    "d.calc.capacity": ["Capacidade mostrada", "Capacity shown"],
    "d.calc.capacity_v": ["cerca de {cap} reps com {load} kg", "about {cap} reps at {load} kg"],
    "d.calc.rule": ["Regra", "Rule"],
    "d.calc.rule_top": ["topo da faixa, {max}", "range top, {max}"],
    "d.calc.rule_hold": ["dentro da faixa, {min}–{max}", "inside the range, {min}–{max}"],
    "d.calc.new_load": ["Nova carga", "New load"],
    "d.calc.rep_target": ["Meta de reps", "Rep target"],
    "d.calc.rep_target_v": ["cerca de {pred} − {rir} = {reps}", "about {pred} − {rir} = {reps}"],
    "d.calc.today": ["Hoje", "Today"],
    "d.calc.goal": ["Total", "Total"],
    "d.calc.split": ["Divisão", "Split"],
    "d.calc.backoff": ["Séries leves", "Lighter sets"],
    "d.calc.block": ["Bloco", "Block"],
    "d.saved_week": ["{date}, semana {n}", "{date}, week {n}"],
    "d.totals.sets": ["séries", "sets"],
    "d.totals.lifts": ["exercícios", "exercises"],
    "d.outcome.head": ["Resultado e próxima meta", "Outcome and next target"],
    "d.next_target": ["Próxima: {target}", "Next: {target}"],
    "d.short.changed-load": ["Carga alterada", "Changed load"],
    "d.short.single-observation": ["Primeira sessão", "First session"],
    "d.short.missing-effort": ["Sem RIR", "No RIR"],
    "d.short.incompatible-exposure": ["Não comparável", "Not comparable"],
    "d.muscles.all": ["Ver os {n} músculos", "Show all {n} muscles"],
    "d.muscles.fewer": ["Ver menos", "Show fewer"],
    "d.progress.sessions": ["sessões", "sessions"],
    "d.progress.sets": ["séries de trabalho", "working sets"],
    "d.progress.week": ["Semana {n} de {total} em andamento", "Week {n} of {total} in progress"],
    "d.progress.attention": ["Precisa de atenção ({n})", "Needs attention ({n})"],
    "d.progress.strength": ["Força neste bloco", "Strength this block"],
    "d.progress.evidence": ["{kind}, {n} sessões", "{kind}, {n} sessions"],
    "d.chart.back": ["Progresso", "Progress"],
    "d.chart.fig.top": ["maior carga, kg", "top load, kg"],
    "d.chart.fig.e1rm": ["melhor e1RM, kg", "best e1RM, kg"],
    "d.chart.fig.sessions": ["sessões", "sessions"],
    "d.chart.fig.change": ["no bloco, kg", "this block, kg"],
    "d.chart.readout": ["{date} · {metric} {value} kg · {set}", "{date} · {metric} {value} kg · {set}"],
    "d.chart.aria": ["{metric} do {name} por sessão", "{metric} for {name} by session"],
    "d.history.search": ["Buscar sessões", "Search sessions"],
    "d.history.calendar": ["Abrir o calendário", "Open the calendar"],
    "d.history.week": ["Semana {n} · {done} de {planned}", "Week {n} · {done} of {planned}"],
    "d.history.sets": ["{n} séries", "{n} sets"],
    "d.history.prs": ["{n} PR", "{n} PR"],
    "d.history.prs_many": ["{n} PRs", "{n} PRs"],
    "d.history.before": ["Antes, {date}: {sets}", "Before, {date}: {sets}"],
    "d.history.cal_hint": ["Dias com sessão estão marcados.", "Days with a session are marked."],
    "d.program.status": ["{status}: {n} de {m} nos últimos 7 dias", "{status}: {n} of {m} in the last 7 days"],
    "d.program.legend": ["Próxima: carga sugerida pelo Taurifer para a próxima sessão", "Next: the load Taurifer suggests for the next session"],
    "d.program.lede": ["{goal}, 3 dias por semana, semana {n} de {total}", "{goal}, 3 days per week, week {n} of {total}"],
    "d.program.day_meta": ["{muscles} · {sets} séries", "{muscles} · {sets} sets"],
    "d.settings": ["Ajustes", "Settings"],
    "d.back_today": ["Voltar para Hoje", "Back to Today"],
    "d.timer": ["Timer de descanso", "Rest timer"],
    "d.table_view": ["Ver como tabela", "Show as table"],
    "d.more": ["Ações do exercício", "Exercise actions"],
  };
  // Candidates built on D register their own new strings here, so one table lists them all.
  function register(table) { for (const k in table) { if (NEW[k]) throw new Error("duplicate string " + k); NEW[k] = table[k]; } }
  function n(id, vars) {
    const v = NEW[id];
    if (!v) throw new Error("missing new string " + id);
    return fill(v[L() === "pt" ? 0 : 1], vars);
  }

  /* ---------- formatting ---------- */
  const num = (x, dec) => T.num(x, dec);
  const kg = (x) => num(x) + " " + UNIT;
  // "8, 8 e 8" / "8, 8 and 8"
  function listAnd(items) {
    const xs = items.map(String);
    if (xs.length < 2) return xs.join("");
    return xs.slice(0, -1).join(", ") + (L() === "pt" ? " e " : " and ") + xs[xs.length - 1];
  }
  const repsOf = (sets) => sets.map((x) => (Array.isArray(x) ? x[1] : x.reps));
  // "100 × 8, 8, 8" when one load, otherwise per set.
  function setsLine(sets, withUnit) {
    const rows = sets.map((x) => (Array.isArray(x) ? { load: x[0], reps: x[1] } : x));
    const same = rows.every((r) => r.load === rows[0].load);
    if (same) return `${num(rows[0].load)}${withUnit ? " " + UNIT : ""} × ${rows.map((r) => r.reps).join(", ")}`;
    return rows.map((r) => `${num(r.load)} × ${r.reps}`).join(", ");
  }

  /* ---------- lifts: one lookup for both fixtures ---------- */
  function lift(k) {
    if (T.EX[k]) {
      const e = T.EX[k];
      return { k, id: e.id, pt: e.pt, en: e.en, bg: e.bg, art: e.art, pri: e.pri, sec: e.sec, custom: false,
        rx: P("range", { workingSets: e.n, repMin: e.r[0], repMax: e.r[1], targetRirMin: 0, targetRirMax: T.PROGRAM.rirHigh }), note: e.note };
    }
    const e = MIX_EX[k];
    return { k, ...e, rx: MIX_RX[k] };
  }
  const name = (k) => { const e = lift(k); return L() === "pt" ? e.pt : e.en; };
  const strategyOf = (k) => lift(k).rx.strategy.id;
  const paramsOf = (k) => lift(k).rx.strategy.params;
  const isMix = (k) => !!MIX_EX[k];

  // Every session for lift k as the engine wants it, before (or through) an ISO date.
  function historyFor(k, iso, inclusive) {
    const src = isMix(k)
      ? MIX_SESSIONS.map((x) => ({ date: x.date, sets: x.lifts[k] }))
      : T.SESSIONS.filter((x) => x.lifts[k]).map((x) => ({ date: x.date, sets: x.lifts[k].map(([load, reps, rir]) => ({ load, reps, rir })) }));
    return src
      .filter((x) => x.sets && (inclusive ? x.date <= iso : x.date < iso))
      .map((x) => ({ sessionId: `${k}@${x.date}`, date: x.date, sets: x.sets.map((z) => ({ ...z })) }));
  }
  const loggedSets = (k, iso) => {
    if (isMix(k)) { const x = MIX_SESSIONS.find((z) => z.date === iso); return x && x.lifts[k] ? x.lifts[k].map((z) => ({ ...z })) : null; }
    const x = T.SESSIONS.find((z) => z.date === iso);
    return x && x.lifts[k] ? x.lifts[k].map(([load, reps, rir]) => ({ load, reps, rir })) : null;
  };
  const sessionsOf = (k) => (isMix(k) ? MIX_SESSIONS.filter((x) => x.lifts[k]).map((x) => x.date) : T.SESSIONS.filter((x) => x.lifts[k]).map((x) => x.date));
  const previousDate = (k, iso) => { const ds = sessionsOf(k).filter((d) => d < iso); return ds.length ? ds[ds.length - 1] : null; };

  /* ---------- engine ----------
     §2.3: every target is RepForgeProgression.evaluateProgression output.
     `input` is kept on the result so the checks can print the exact call. */
  const memo = new Map();
  function evaluate(k, iso, opts = {}) {
    const key = [k, iso, opts.inclusive ? 1 : 0, JSON.stringify(opts.current || [])].join("|");
    if (memo.has(key)) return memo.get(key);
    const input = {
      engineVersion: 1, prescription: lift(k).rx, relation: null, modifiers: [], settings: SETTINGS,
      history: historyFor(k, iso, opts.inclusive), currentSession: opts.current || [],
      context: { ...CONTEXT },
    };
    const result = ENG.evaluateProgression(input);
    const out = { input, result };
    memo.set(key, out);
    return out;
  }

  /* One engine result, one verdict. Mirrors the app's own mapping so the words
     are the product's: RANGE_REASON_UI + rangeCopy (app.js:4825-4843),
     repGoalCopy, effortTargetCopy and anchorCopy (app.js:4850-4938).
     glyph feeds KIT.mark(): up | hold | stalled | recover | down | new | manual. */
  function verdictOf(k, result) {
    const c = result.reasonCodes, f = result.facts, st = strategyOf(k);
    if (result.kind === "manual") return { glyph: "manual", label: s("program.progression.strategy.manual"), text: n("d.why.manual") };
    if (st === "range") {
      const r = c[0];
      if (r === "range.no_history") return { glyph: "new", label: s("rec.new.label"), text: s("rec.new.text", { min: paramsOf(k).repMin, max: paramsOf(k).repMax, rirHigh: T.PROGRAM.rirHigh }) };
      if (r === "range.capacity_top_double") return c.includes("range.block_tempered")
        ? { glyph: "up", label: s("rec.add.label"), text: s("rec.add.tempered.text") }
        : { glyph: "up", label: s("rec.add2.label"), text: s("rec.add2.text") };
      if (r === "range.performed_top" || r === "range.capacity_top") return { glyph: "up", label: s("rec.add.label"), text: s("rec.add.text") };
      if (r === "range.below_floor") return { glyph: "down", label: s("rec.reduce.label"), text: s("rec.reduce.text", { min: paramsOf(k).repMin }) };
      if (r === "range.stalled") return { glyph: "stalled", label: s("rec.stalled.label"), text: s("rec.stalled.text") };
      if (r === "range.recovery") return { glyph: "recover", label: s("rec.recover.label"), text: s("rec.recover.text") };
      if (r === "range.capacity_room") return { glyph: "hold", label: s("rec.push_reps.label"), text: s("rec.push_reps.text") };
      if (r === "range.current_advance") return { glyph: "up", label: s("rec.add.label"), text: "" };
      if (r === "range.current_reduce") return { glyph: "down", label: s("rec.reduce.label"), text: "" };
      if (r === "range.current_hold") return { glyph: "hold", label: s("rec.hold_add_reps.label"), text: "" };
      return { glyph: "hold", label: s("rec.hold_add_reps.label"), text: s("rec.hold_add_reps.text") };
    }
    if (st === "rep_goal") {
      const sets = result.target.sets;
      if (c.includes("rep_goal.no_history")) return { glyph: "new", label: s("rec.repgoal.new.label"), text: s("rec.repgoal.new.text", { floor: paramsOf(k).repFloor, ceiling: paramsOf(k).repCeiling, goal: f.repGoal }) };
      if (c.includes("rep_goal.current_progress")) return { glyph: "hold", label: s("rec.repgoal.session.label"), text: s("rec.repgoal.session.text", { done: f.completedReps, goal: f.repGoal, reps: sets[0] && sets[0].reps }) };
      if (c.includes("rep_goal.advance")) return c.includes("rep_goal.rebuild_after_advance")
        ? { glyph: "up", label: s("rec.repgoal.rebuild.label"), text: s("rec.repgoal.rebuild.text", { goal: f.repGoal, reps: sets[0].reps }) }
        : { glyph: "up", label: s("rec.repgoal.advance.label"), text: s("rec.repgoal.advance.text", { goal: f.repGoal }) };
      if (c.includes("rep_goal.effort_too_high")) return { glyph: "recover", label: s("rec.repgoal.effort.label"), text: s("rec.repgoal.effort.text", { goal: f.repGoal }) };
      if (c.includes("rep_goal.capacity_below_floor")) return { glyph: "down", label: s("rec.repgoal.reduce.label"), text: s("rec.repgoal.reduce.text", { floor: paramsOf(k).repFloor }) };
      return { glyph: "hold", label: s("rec.repgoal.progress.label"), text: s("rec.repgoal.progress.text", { done: f.performedTotal, goal: f.repGoal }) };
    }
    if (st === "effort_target") {
      const fm = (x) => num(x);
      if (c.includes("effort_target.no_history")) return { glyph: "new", label: s("rec.effort.new.label"), text: s("rec.effort.new.text", { reps: f.targetReps, min: fm(f.targetRirMin), max: fm(f.targetRirMax) }) };
      if (c.includes("effort_target.no_rir_evidence")) return { glyph: "hold", label: s("rec.effort.no_rir.label"), text: s("rec.effort.no_rir.text") };
      if (c.includes("effort_target.too_easy")) return { glyph: "up", label: s("rec.effort.advance.label"), text: s("rec.effort.advance.text", { reps: f.targetReps, max: fm(f.targetRirMax) }) };
      if (c.includes("effort_target.rep_miss")) return { glyph: "down", label: s("rec.effort.reduce.label"), text: s("rec.effort.rep_miss.text", { reps: f.targetReps }) };
      if (c.includes("effort_target.too_hard")) return { glyph: "down", label: s("rec.effort.reduce.label"), text: s("rec.effort.too_hard.text", { min: fm(f.targetRirMin) }) };
      return { glyph: "hold", label: s("rec.effort.hold.label"), text: s("rec.effort.hold.text", { reps: f.targetReps, min: fm(f.targetRirMin), max: fm(f.targetRirMax) }) };
    }
    // anchor_backoff
    const p = paramsOf(k);
    if (c.includes("anchor_backoff.no_history")) return { glyph: "new", label: s("rec.anchor.new.label"), text: s("rec.anchor.new.text", { min: p.anchorRepMin, max: p.anchorRepMax, backoffs: p.backoffSets }) };
    if (c.includes("anchor_backoff.anchor_advance")) return { glyph: "up", label: s("rec.anchor.advance.label"), text: s("rec.anchor.advance.text", { max: p.anchorRepMax }) };
    if (c.includes("anchor_backoff.anchor_below_floor")) return { glyph: "down", label: s("rec.anchor.reduce.label"), text: s("rec.anchor.reduce.text", { min: p.anchorRepMin }) };
    return { glyph: "hold", label: s("rec.anchor.hold.label"), text: s("rec.anchor.hold.text", { min: p.anchorRepMin, max: p.anchorRepMax }) };
  }

  /* A recommendation, shaped for screens.
     when: "today" (before the lift's session on iso), "next" (after it). */
  function rec(k, iso, when = "today", current) {
    const { input, result } = evaluate(k, iso, { inclusive: when === "next", current });
    const v = verdictOf(k, result);
    const st = strategyOf(k), p = paramsOf(k);
    const sets = result.target.sets || [];
    const out = { k, iso, when, input, result, strategy: st, glyph: v.glyph, label: v.label, text: v.text, sets, facts: result.facts, status: result.status };
    if (st === "manual") {
      const m = MANUAL[k];
      out.load = m.load; out.reps = null; out.manual = m;
      out.target = `${m.sets} × ${m.lo}–${m.hi}`;
      out.next = `${kg(m.load)} × ${m.lo}–${m.hi}`;
      return out;
    }
    out.load = sets[0] ? sets[0].load : null;
    out.reps = sets[0] ? sets[0].reps : null;
    if (st === "rep_goal") {
      out.target = n("d.target.total", { n: sets.reduce((t, x) => t + x.reps, 0) });
      out.next = `${kg(out.load)} × ${sets.map((x) => x.reps).join(", ")}`;
    } else if (st === "anchor_backoff") {
      const b = sets[1];
      out.target = n("d.target.anchor", { n: sets.length - 1 });
      out.anchor = sets[0]; out.backoff = b;
      out.next = `${kg(sets[0].load)} × ${sets[0].reps} + ${sets.length - 1} × ${num(b.load)} × ${b.reps}`;
    } else {
      out.target = `${sets.length} × ${out.reps}`;
      out.next = `${kg(out.load)} × ${out.reps}`;
    }
    return out;
  }

  /* ---------- canonical outcomes (§2.1) ----------
     Mirrors buildSessionDelta in app.js (Session outcome, CONTEXT.md), as
     amended by the owner decision of 2026-09-25 on PR #264's questions: at
     the same load total reps decide; when the load went up, best-set e1RM
     decides at DELTA_THRESHOLDS.e1rmPct (a prescribed increase with the
     expected rep drop reads flat); when the load went down it improves only
     on more strength or more volume at similar effort, otherwise it is not
     comparable. Evidence states follow strengthEvidenceRecords: a second
     comparable observation is required, every row must carry effort, and
     improved/flat/regressed map to improved/maintained/declined. */
  const DELTA = { e1rmPct: 0.01, volumePct: 0.025, rir: 0.75 };
  const e1rm = (load, reps) => load * (1 + reps / 30);
  function metrics(rows) {
    const w = rows.filter((r) => r.load > 0 && r.reps > 0);
    if (!w.length) return null;
    let topLoad = 0, topLoadReps = 0, totalReps = 0, totalVolume = 0, bestE1rm = 0; const rirs = [];
    for (const r of w) {
      totalReps += r.reps; totalVolume += r.load * r.reps; rirs.push(+r.rir);
      const em = e1rm(r.load, r.reps); if (em > bestE1rm) bestE1rm = em;
      if (r.load > topLoad || (r.load === topLoad && r.reps > topLoadReps)) { topLoad = r.load; topLoadReps = r.reps; }
    }
    return { topLoad, topLoadReps, totalReps, totalVolume, bestE1rm, avgRir: rirs.reduce((a, b) => a + b, 0) / rirs.length };
  }
  function sessionDelta(prevRows, curRows) {
    const a = metrics(prevRows), b = metrics(curRows);
    if (!a || !b) return { status: "not_comparable" };
    const loadDelta = b.topLoad - a.topLoad, repsDelta = b.totalReps - a.totalReps, volumeDelta = b.totalVolume - a.totalVolume,
      e1rmDelta = b.bestE1rm - a.bestE1rm, avgRirDelta = b.avgRir - a.avgRir;
    const d = { loadDelta, repsDelta, volumeDelta, e1rmDelta, avgRirDelta, prev: a, cur: b };
    const band = a.bestE1rm * DELTA.e1rmPct;
    let status;
    if (Math.abs(loadDelta) < 0.01) status = repsDelta > 0 ? "improved" : repsDelta < 0 ? "regressed" : "flat";
    else if (loadDelta > 0) status = e1rmDelta > band ? "improved" : e1rmDelta < -band ? "regressed" : "flat";
    else status = e1rmDelta > band || (volumeDelta > a.totalVolume * DELTA.volumePct && avgRirDelta <= DELTA.rir) ? "improved" : "changed_load";
    return { status, d };
  }
  const hasEffort = (r) => r.rir != null && r.rir !== "" && Number.isFinite(Number(r.rir));
  function canonicalOutcome(k, iso) {
    const cur = loggedSets(k, iso);
    if (!cur) return null;
    const pd = previousDate(k, iso);
    let o;
    if (!pd) o = { state: "insufficient", reason: cur.some((r) => !hasEffort(r)) ? "missing-effort" : "single-observation" };
    else {
      const prev = loggedSets(k, pd);
      if (![...prev, ...cur].every(hasEffort)) o = { state: "insufficient", reason: "missing-effort" };
      else {
        const dl = sessionDelta(prev, cur);
        const map = { improved: "improved", flat: "maintained", regressed: "declined" };
        o = map[dl.status]
          ? { state: "sufficient", outcome: map[dl.status], delta: dl.d }
          : { state: "insufficient", reason: dl.status === "changed_load" ? "changed-load" : "incompatible-exposure", delta: dl.d };
      }
    }
    o.k = k; o.iso = iso; o.prevDate = pd;
    o.word = o.state === "sufficient" ? s("stats.outcome." + o.outcome) : n("d.short." + o.reason);
    o.longReason = o.state === "sufficient" ? "" : s("stats.evidence.reason." + o.reason);
    return o;
  }

  /* ---------- records ----------
     Load PRs and rep PRs at a load, judged against every earlier set. Main
     fixture uses TX.prs (data.js); the mixed day has no prior block. */
  function prsFor(iso, mix) {
    if (mix) {
      const out = [];
      const x = MIX_SESSIONS.find((z) => z.date === iso);
      for (const k in x.lifts) {
        const prior = MIX_SESSIONS.filter((z) => z.date < iso && z.lifts[k]).flatMap((z) => z.lifts[k]);
        if (!prior.length) continue;
        const maxLoad = Math.max(...prior.map((r) => r.load));
        const top = x.lifts[k].reduce((a, b) => (b.load > a.load || (b.load === a.load && b.reps > a.reps) ? b : a));
        if (top.load > maxLoad) { out.push({ k, load: top.load, reps: top.reps, kind: "load", by: top.load - maxLoad }); continue; }
        const at = prior.filter((r) => r.load === top.load).map((r) => r.reps);
        if (at.length && top.reps > Math.max(...at)) out.push({ k, load: top.load, reps: top.reps, kind: "reps", by: top.reps - Math.max(...at) });
      }
      return out;
    }
    return T.prs(iso);
  }
  const prLine = (p) => (p.kind === "load"
    ? s("summary.pr.over_load", { n: num(p.by), unit: UNIT })
    : s("summary.pr.over_reps", { n: p.by, reps: p.by === 1 ? s("plural.rep.one") : s("plural.rep.other") }));

  /* ---------- sessions ---------- */
  function session(iso, mix) {
    const m = mix && MIX_SESSIONS.find((x) => x.date === iso);
    if (m) {
      const lifts = Object.keys(m.lifts);
      let sets = 0, vol = 0;
      for (const k of lifts) for (const r of m.lifts[k]) { sets++; vol += r.load * r.reps; }
      return { iso, mix: true, dayName: MIX.name, lifts, sets, vol: Math.round(vol), week: 1 + Math.floor((Date.parse(iso) - Date.parse(CONTEXT.blockStart)) / 6048e5) };
    }
    const x = T.SESSIONS.find((z) => z.date === iso);
    const t = T.sessionTotals(x);
    return { iso, mix: false, day: x.day, dayName: T.PROGRAM.days[x.day].name, lifts: Object.keys(x.lifts), sets: t.sets, vol: t.vol, week: 1 + Math.floor((Date.parse(iso) - Date.parse(CONTEXT.blockStart)) / 6048e5) };
  }
  // Hard sets per muscle: direct work 1, secondary 0.5 (summary.muscles.note).
  function musclesOf(iso, mix) {
    const sn = session(iso, mix), m = {};
    for (const k of sn.lifts) {
      const cnt = loggedSets(k, iso).length, e = lift(k);
      for (const p of e.pri) m[p] = (m[p] || 0) + cnt;
      for (const q of e.sec) m[q] = (m[q] || 0) + cnt * 0.5;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  const MUSCLE_EXTRA = { "Spinal erectors": ["Eretores da espinha", "Spinal erectors"] };
  const muscle = (m) => T.mu(m) || MUSCLE_EXTRA[m][L() === "pt" ? 0 : 1];

  /* ---------- Why this weight (§5.3) ----------
     Rows follow explainRecommendation / explainStrategy (app.js:5134-5203):
     every number is a fact the engine attached to its own result. */
  function why(k, iso, variant) {
    const r = variant === "set2"
      ? rec(k, iso, "today", [{ load: 102.5, reps: 7, rir: 1 }])
      : rec(k, iso, "today");
    const f = r.facts, st = r.strategy, p = paramsOf(k);
    const pd = previousDate(k, iso), prev = pd ? loggedSets(k, pd) : [];
    const blocks = [], calc = [];
    const u = UNIT;
    const rirs = prev.map((x) => (hasEffort(x) ? num(x.rir) : s("why.effort.missing")));
    const performed = n("d.why.performed", { reps: listAnd(repsOf(prev)), load: num(prev[0] ? prev[0].load : 0), rirs: listAnd(rirs) });
    let evidence = pd ? n("d.why.evidence", { n: 1, date: T.date.short(pd) }) : "";
    if (st === "manual") {
      blocks.push({ lead: n("d.why.lead.manual"), text: n("d.why.manual") });
      return { r, blocks, calc: [], evidence: "", head: `${kg(r.load)} × ${r.manual.lo}–${r.manual.hi}`, noMark: true };
    }
    if (variant === "set2") {
      // In-session: why.session leads. Observed capacity (8) is never swapped
      // with the fatigue-adjusted prediction for the next set (about 7,5).
      const cur = r.input.currentSession[0];
      const observed = cur.reps + Math.min(cur.rir, SETTINGS.hardRir);
      blocks.push({ label: s("why.session"), lead: n("d.why.lead.set1"), text: n("d.why.set1", { reps: cur.reps, rir: cur.rir, cap: num(observed), load: num(cur.load) }) });
      blocks.push({ lead: n("d.why.lead.set2"), text: s("log.insession.hold", { set: 2, load: num(r.load), unit: u, reps: r.reps }) + " " + n("d.why.set2", { pred: num(Math.round(f.capacityReps * 2) / 2), rir: num(f.typicalRir), reps: r.reps }) });
      calc.push({ group: s("why.session") });
      calc.push({ k: n("d.calc.set", { n: 1 }), v: `${num(cur.load)} × ${cur.reps}`, rir: `RIR ${cur.rir}` });
      calc.push({ k: n("d.calc.capacity"), v: n("d.calc.capacity_v", { cap: num(observed), load: num(cur.load) }) });
      calc.push({ k: n("d.calc.rep_target"), v: n("d.calc.rep_target_v", { pred: num(Math.round(f.capacityReps * 10) / 10), rir: num(f.typicalRir), reps: r.reps }) });
      calc.push({ sum: true, k: n("d.set_label", { n: 2 }), v: `${kg(r.load)} × ${r.reps}` });
      return { r, blocks, calc, evidence: n("d.why.evidence", { n: 1, date: T.date.short(iso) }), head: s("focus.cue.hold", { load: num(r.load), unit: u }) + ", " + s("focus.cue.reps", { reps: r.reps }) };
    }
    if (st === "range") {
      const reason = r.result.reasonCodes[0];
      const cr = Math.round(f.capacityReps);
      const ruleKey = { "range.performed_top": "top", "range.capacity_top": "cap_top", "range.capacity_top_double": "cap_top2", "range.below_floor": "below_range", "range.stalled": "stalled", "range.recovery": "recover", "range.capacity_room": "push_reps", "range.room_in_range": "hold" }[reason];
      const rule = s("why.rule." + ruleKey, { max: p.repMax, min: p.repMin, cr, margin: 3, gap: Math.round(f.capacityReps - f.latestMedianReps) });
      const leadKey = { top: "top", cap_top: "top", cap_top2: "top", hold: "hold", push_reps: "hold", stalled: "stalled", recover: "recover", below_range: "hold" }[ruleKey];
      // The first sentence carries the RIR it used.
      blocks.push({ lead: n("d.why.lead." + leadKey), text: performed + " " + rule });
      const raw = f.latestLoad * SETTINGS.jumpPercent * (f.jumpMultiplier || 1) / 100;
      const move = { prev: num(f.latestLoad), pct: num(SETTINGS.jumpPercent * (f.jumpMultiplier || 1)), step: num(SETTINGS.minLoadIncrement), load: num(r.load), unit: u };
      let loadText;
      if (["top", "cap_top", "cap_top2"].includes(ruleKey)) loadText = s(raw > SETTINGS.minLoadIncrement ? "why.load_up" : "why.load_up_step", move);
      else if (ruleKey === "below_range") loadText = s(raw > SETTINGS.minLoadIncrement ? "why.load_down" : "why.load_down_step", move);
      else if (Math.abs(r.load - f.latestLoad) < 1e-6) loadText = s("why.load_hold", { load: num(r.load), unit: u });
      else loadText = s("why.load_snap", { step: num(SETTINGS.minLoadIncrement), load: num(r.load), unit: u });
      const reenter = r.status === "advance" || r.status === "reduce" || Math.abs(r.load - f.latestLoad) > 1e-6;
      const pred = Math.round(ENG.repsAtLoad(f.capacityE1rm, r.load));
      const repsText = reenter ? s("why.reps", { load: num(r.load), unit: u, pred, typrir: num(f.typicalRir), reps: r.reps })
        : f.pushReps ? s("why.reps_chase", { min: p.repMin, max: p.repMax }) : s("why.reps_hold");
      if (reenter) {
        blocks.push({ lead: n(r.load !== f.latestLoad ? "d.why.lead.load" : "d.why.lead.load_hold"), text: loadText });
        blocks.push({ lead: n("d.why.lead.reps", { n: r.reps }), text: repsText });
      } else blocks.push({ lead: n("d.why.lead.reps", { n: r.reps }), text: loadText + " " + repsText });
      calc.push({ group: n("d.calc.last", { date: T.date.short(pd) }) });
      prev.forEach((x, i) => calc.push({ k: n("d.calc.set", { n: i + 1 }), v: `${num(x.load)} × ${x.reps}`, rir: hasEffort(x) ? `RIR ${num(x.rir)}` : s("why.effort.missing") }));
      calc.push({ group: n("d.calc.working") });
      calc.push({ k: n("d.calc.capacity"), v: n("d.calc.capacity_v", { cap: num(cr), load: num(f.latestLoad) }), sub: s("why.showed", { cap: SETTINGS.hardRir, cr, load: num(f.latestLoad), unit: u }) });
      calc.push({ k: n("d.calc.rule"), v: ruleKey === "top" ? n("d.calc.rule_top", { max: p.repMax }) : n("d.calc.rule_hold", { min: p.repMin, max: p.repMax }) });
      if (r.load !== f.latestLoad) calc.push({ k: n("d.calc.new_load"), v: raw > SETTINGS.minLoadIncrement ? `${num(f.latestLoad)} + ${num(SETTINGS.jumpPercent * (f.jumpMultiplier || 1))}% → ${num(r.load)}` : `${num(f.latestLoad)} + ${num(SETTINGS.minLoadIncrement)} → ${num(r.load)}` });
      if (reenter) calc.push({ k: n("d.calc.rep_target"), v: n("d.calc.rep_target_v", { pred, rir: num(f.typicalRir), reps: r.reps }) });
      if (f.blockTrend && f.blockTrend.direction) calc.push({ k: n("d.calc.block"), v: s("rec.block." + f.blockTrend.direction, { sessions: f.blockTrend.sessionCount }), text: true });
      calc.push({ sum: true, k: n("d.calc.today"), v: `${kg(r.load)} × ${r.reps}` });
    } else if (st === "rep_goal") {
      blocks.push({ lead: n("d.why.lead.goal"), text: performed + " " + s("why.repgoal.total", { done: f.performedTotal, goal: f.repGoal, sets: p.workingSets }) });
      blocks.push({ lead: n("d.why.lead.effort"), text: s("why.repgoal.effort", { rir: num(f.medianTrustedRir), min: num(p.targetRirMin) }) });
      if (r.result.reasonCodes.includes("rep_goal.rebuild_after_advance")) blocks.push({ lead: n("d.why.lead.spread"), text: s("why.repgoal.rebuild", { goal: f.repGoal, reps: r.sets[0].reps }) });
      else blocks.push({ lead: n("d.why.lead.spread"), text: n("d.why.split", { total: r.sets.reduce((t, x) => t + x.reps, 0), reps: listAnd(r.sets.map((x) => x.reps)) }) });
      calc.push({ group: n("d.calc.last", { date: T.date.short(pd) }) });
      prev.forEach((x, i) => calc.push({ k: n("d.calc.set", { n: i + 1 }), v: `${num(x.load)} × ${x.reps}`, rir: `RIR ${num(x.rir)}` }));
      calc.push({ group: n("d.calc.working") });
      calc.push({ k: n("d.calc.goal"), v: `${f.performedTotal} / ${f.repGoal}` });
      calc.push({ k: n("d.calc.split"), v: r.sets.map((x) => x.reps).join(" + ") + ` = ${r.sets.reduce((t, x) => t + x.reps, 0)}` });
      calc.push({ sum: true, k: n("d.calc.today"), v: `${kg(r.load)} × ${r.sets.map((x) => x.reps).join(", ")}` });
    } else if (st === "anchor_backoff") {
      const a = prev[0];
      // why.anchor.top names the performed top set. The shipped sheet passes
      // capacity reps here (app.js:5155-5156), which reads 6 for a logged 5;
      // D passes the performed reps. See the README notes.
      blocks.push({ lead: n("d.why.lead.anchor"), text: s("why.anchor.top", { load: num(a.load), unit: u, reps: a.reps }) + " " + n("d.why.top_rir", { rir: num(a.rir) }) });
      blocks.push({ lead: n("d.why.lead.rule"), text: r.text });
      blocks.push({ lead: n("d.why.lead.backoff"), text: s("why.anchor.backoff", { percent: num(Math.round(p.backoffPercent * 100)), load: num(f.backoffLoad), unit: u }) });
      calc.push({ group: n("d.calc.last", { date: T.date.short(pd) }) });
      prev.forEach((x, i) => calc.push({ k: i ? n("d.calc.set", { n: i + 1 }) : n("d.why.lead.anchor"), v: `${num(x.load)} × ${x.reps}`, rir: `RIR ${num(x.rir)}` }));
      calc.push({ group: n("d.calc.working") });
      calc.push({ k: n("d.calc.capacity"), v: n("d.calc.capacity_v", { cap: num(Math.round(f.capacityReps)), load: num(a.load) }) });
      calc.push({ k: n("d.calc.new_load"), v: `${num(a.load)} + ${num(p.jumpPercent)}% → ${num(f.targetLoad)}` });
      calc.push({ k: n("d.calc.backoff"), v: `${num(f.targetLoad)} × ${num(Math.round(p.backoffPercent * 100))}% → ${num(f.backoffLoad)}` });
      calc.push({ sum: true, k: n("d.calc.today"), v: r.next });
    } else if (st === "effort_target") {
      blocks.push({ lead: n("d.why.lead.effort"), text: s("why.effort.evidence", { load: num(f.representativeLoad), unit: u, reps: num(f.representativeReps), rir: f.representativeRir == null ? s("why.effort.missing") : num(f.representativeRir) }) + " " + r.text });
      blocks.push({ lead: n("d.why.lead.reps", { n: f.targetReps }), text: s("why.effort.target", { reps: f.targetReps, min: num(f.targetRirMin), max: num(f.targetRirMax) }) });
      if (r.result.reasonCodes.includes("effort_target.grid_rounded")) blocks.push({ lead: n("d.why.lead.load"), text: s("why.effort.grid", { load: num(f.targetLoad), unit: u }) });
      calc.push({ group: n("d.calc.last", { date: T.date.short(pd) }) });
      prev.forEach((x, i) => calc.push({ k: n("d.calc.set", { n: i + 1 }), v: `${num(x.load)} × ${x.reps}`, rir: `RIR ${num(x.rir)}` }));
      calc.push({ sum: true, k: n("d.calc.today"), v: r.next });
    }
    const head = r.glyph === "up" ? s("focus.cue.up", { load: num(r.load), unit: u }) : r.glyph === "down" ? s("focus.cue.down", { load: num(r.load), unit: u }) : s("focus.cue.hold", { load: num(r.load), unit: u });
    const reps = st === "rep_goal" ? r.sets.map((x) => x.reps).join(", ") : r.reps;
    return { r, blocks, calc, evidence, head: head + ", " + s("focus.cue.reps", { reps }) };
  }

  /* ---------- exercise chart (§5.8) ----------
     Maior carga is the shipped Strength metric (progress-model.js:370-372).
     Load increases are marked from logged facts only: this session's top
     load above the previous session's. */
  function series(k) {
    const base = k === "sq" ? T.squatSeries() : sessionsOf(k).map((d) => {
      const sets = loggedSets(k, d).map((r) => [r.load, r.reps, r.rir]);
      const top = Math.max(...sets.map((r) => r[0]));
      return { date: d, sets, block: d >= CONTEXT.blockStart, e1rm: T.best(sets), top, topReps: Math.max(...sets.filter((r) => r[0] === top).map((r) => r[1])) };
    });
    return base.map((x, i, all) => ({ ...x, up: i > 0 && x.top > all[i - 1].top }));
  }
  // Tally of today's verdicts, in a fixed order: "↑ 2 sobem · = 2 mantêm · ↻ 1 travado".
  function tally(recs) {
    const order = ["up", "hold", "recover", "stalled", "down", "new", "manual"];
    const c = {};
    for (const r of recs) c[r.glyph] = (c[r.glyph] || 0) + 1;
    return order.filter((g) => c[g]).map((g) => ({ glyph: g, n: c[g], text: n(`d.tally.${g}.${c[g] === 1 ? "one" : "other"}`, { n: c[g] }) }));
  }

  // Block change of the shipped Strength metric, first vs latest session in the block.
  function topLoadChange(k) {
    const ds = sessionsOf(k).filter((d) => d >= CONTEXT.blockStart);
    const tops = ds.map((d) => Math.max(...loggedSets(k, d).map((r) => r.load)));
    return { from: tops[0], to: tops[tops.length - 1], series: tops, count: ds.length };
  }
  const evidenceKind = (count) => (count <= 1 ? s("stats.evidence.snapshot") : count === 2 ? s("stats.evidence.comparison") : s("stats.evidence.trend"));

  root.DX = {
    SETTINGS, CONTEXT, UNIT, MIX, MIX_EX, MIX_SESSIONS, MIX_RX, MANUAL, NEW,
    s, n, register, plain, num, kg, listAnd, setsLine, lift, name, strategyOf, paramsOf, isMix,
    tally, historyFor, loggedSets, sessionsOf, previousDate, evaluate, rec, verdictOf,
    sessionDelta, canonicalOutcome, prsFor, prLine, session, musclesOf, muscle, why, series, topLoadChange, evidenceKind, hasEffort,
  };
})(window);
