/* Taurifer main-screen directions: shared data and helpers.
   Every figure below is either authored training data or derived from it here,
   so the summary, History and Progress can never disagree. The recommendation
   targets (TODAY_REC, NEXT) were produced by running progression-engine.js on
   this exact history with the app defaults (jumpPct 2.5, minJump 2.5 kg,
   hardRir 4). Review-only; nothing here is loaded by the app. */
(function (root) {
  "use strict";

  const ART = "../../../assets/exercises/";

  const MUSCLE = {
    "Quads": ["Quadríceps", "Quads"],
    "Hamstrings": ["Posteriores", "Hamstrings"],
    "Glutes": ["Glúteos", "Glutes"],
    "Calves": ["Panturrilhas", "Calves"],
    "Chest": ["Peito", "Chest"],
    "Triceps": ["Tríceps", "Triceps"],
    "Front delts": ["Deltoides anteriores", "Front delts"],
    "Side delts": ["Deltoides laterais", "Side delts"],
    "Mid/upper back": ["Costas médias/superiores", "Mid/upper back"],
    "Lats": ["Dorsais", "Lats"],
    "Biceps": ["Bíceps", "Biceps"],
    "Forearms": ["Antebraços", "Forearms"],
    "Traps": ["Trapézio", "Traps"],
    "Spinal erectors": ["Eretores da espinha", "Spinal erectors"],
  };

  // Library ids, names and muscles are copied from exercises.js.
  const EX = {
    sq: { id: "sq_bb", pt: "Agachamento livre com barra", en: "Barbell back squat", bg: "#f0e6d6", pri: ["Quads"], sec: ["Glutes", "Hamstrings", "Calves"], n: 3, r: [4, 8], note: ["Rack no furo 9", "Rack on pin 9"] },
    pr: { id: "pr_bb", pt: "Supino com barra", en: "Barbell bench press", bg: "#eee3d0", pri: ["Chest"], sec: ["Triceps", "Front delts"], n: 3, r: [4, 8] },
    lc: { id: "lc_mc", pt: "Cadeira flexora", en: "Seated leg curl", bg: "#eae1d4", pri: ["Hamstrings"], sec: ["Calves"], n: 2, r: [8, 12], note: ["Encosto na posição 4", "Back pad on 4"] },
    rw: { id: "rw_cb", pt: "Remada sentada na polia", en: "Cable seated row", bg: "#ecdfcd", pri: ["Mid/upper back"], sec: ["Biceps", "Forearms"], n: 3, r: [8, 12] },
    lr: { id: "lr_db", pt: "Elevação lateral com halteres", en: "Dumbbell lateral raise", bg: "#ecdfcf", pri: ["Side delts"], sec: ["Traps"], n: 2, r: [10, 15] },
    hg: { id: "hg_bb", pt: "Levantamento terra romeno com barra", en: "Barbell Romanian deadlift", bg: "#f0e6da", pri: ["Hamstrings", "Glutes"], sec: ["Spinal erectors"], n: 3, r: [6, 10] },
    pd: { id: "pd_mc", pt: "Puxada frontal", en: "Lat pulldown", bg: "#f2eadf", pri: ["Lats"], sec: ["Biceps", "Forearms"], n: 3, r: [8, 12] },
    sp: { id: "sp_db", pt: "Desenvolvimento com halteres", en: "Dumbbell shoulder press", bg: "#e8dbc9", pri: ["Front delts"], sec: ["Triceps", "Mid/upper back"], n: 3, r: [6, 10] },
    lp: { id: "sq_lp", pt: "Leg press", en: "Leg press", bg: "#eee6d8", pri: ["Quads"], sec: ["Glutes", "Hamstrings", "Calves"], n: 2, r: [10, 15] },
    cz: { id: "cu_ez", pt: "Rosca com barra W", en: "EZ-bar curl", bg: "#e4d6bf", pri: ["Biceps"], sec: ["Forearms"], n: 2, r: [8, 12] },
    hk: { id: "sqk_mc", pt: "Agachamento hack na máquina", en: "Hack squat machine", bg: "#f4ede1", pri: ["Quads"], sec: ["Glutes", "Hamstrings", "Calves"], n: 3, r: [6, 10] },
    ip: { id: "ip_db", pt: "Supino inclinado com halteres", en: "Dumbbell incline press", bg: "#e8dbca", pri: ["Chest"], sec: ["Front delts", "Triceps"], n: 3, r: [6, 10] },
    rd: { id: "rw_db", pt: "Remada curvada com halteres", en: "Dumbbell bent over row", bg: "#eaddc8", pri: ["Mid/upper back"], sec: ["Biceps", "Forearms"], n: 3, r: [8, 12] },
    lcl: { id: "lcl_mc", pt: "Mesa flexora", en: "Lying leg curl", bg: "#f0e7d8", pri: ["Hamstrings"], sec: ["Calves"], n: 2, r: [8, 12] },
    tr: { id: "tr_mc", pt: "Extensão de tríceps na máquina", en: "Machine triceps extension", bg: "#ede2cf", pri: ["Triceps"], sec: ["Front delts"], n: 2, r: [8, 12] },
  };
  for (const k in EX) EX[k].art = ART + EX[k].id + ".webp";

  const PROGRAM = {
    name: ["Corpo todo", "Full body"],
    goal: ["Ganhar massa", "Build muscle"],
    started: "2026-08-31",
    weeks: 6,
    week: 4,
    rirHigh: 2,
    days: [
      { name: ["Dia 1", "Day 1"], lifts: ["sq", "pr", "lc", "rw", "lr"] },
      { name: ["Dia 2", "Day 2"], lifts: ["hg", "pd", "sp", "lp", "cz"] },
      { name: ["Dia 3", "Day 3"], lifts: ["hk", "ip", "rd", "lcl", "tr"] },
    ],
  };

  const S = (load, reps, rirs) => reps.map((r, i) => [load, r, rirs[i]]);
  // Every saved session of the current mesocycle, oldest first.
  const SESSIONS = [
    { date: "2026-08-31", day: 0, lifts: { sq: S(95, [8, 8, 7], [1, 1, 0]), pr: S(77.5, [6, 6, 5], [1, 1, 0]), lc: S(40, [11, 10], [2, 1]), rw: S(55, [10, 9, 9], [2, 1, 1]), lr: S(10, [12, 11], [1, 1]) } },
    { date: "2026-09-02", day: 1, lifts: { hg: S(80, [9, 8, 8], [2, 1, 1]), pd: S(55, [10, 10, 9], [2, 1, 1]), sp: S(20, [9, 8, 8], [1, 1, 1]), lp: S(160, [13, 12], [2, 1]), cz: S(25, [11, 10], [1, 1]) } },
    { date: "2026-09-04", day: 2, lifts: { hk: S(100, [9, 8, 8], [1, 1, 1]), ip: S(25, [9, 8, 8], [1, 1, 1]), rd: S(30, [11, 10, 10], [1, 1, 1]), lcl: S(35, [12, 11], [1, 1]), tr: S(40, [12, 11], [1, 1]) } },
    { date: "2026-09-07", day: 0, lifts: { sq: S(97.5, [8, 8, 7], [1, 1, 0]), pr: S(80, [6, 5, 5], [1, 1, 0]), lc: S(42.5, [11, 10], [2, 1]), rw: S(55, [11, 10, 9], [2, 1, 1]), lr: S(10, [12, 11], [1, 1]) } },
    { date: "2026-09-09", day: 1, lifts: { hg: S(80, [10, 9, 9], [1, 1, 1]), pd: S(57.5, [10, 9, 9], [1, 1, 1]), sp: S(20, [10, 10, 10], [1, 1, 0]), lp: S(170, [12, 12], [1, 1]), cz: S(25, [12, 12], [1, 0]) } },
    { date: "2026-09-11", day: 2, lifts: { hk: S(105, [9, 8, 8], [1, 1, 0]), ip: S(25, [10, 9, 9], [1, 1, 0]), rd: S(30, [12, 11, 11], [1, 1, 0]), lcl: S(37.5, [11, 10], [1, 1]), tr: S(45, [10, 10], [1, 1]) } },
    { date: "2026-09-14", day: 0, lifts: { sq: S(100, [8, 8, 8], [1, 1, 0]), pr: S(80, [7, 6, 6], [1, 1, 0]), lc: S(42.5, [12, 12], [2, 1]), rw: S(55, [11, 10, 10], [1, 1, 0]), lr: S(10, [12, 11], [1, 1]) } },
    { date: "2026-09-16", day: 1, lifts: { hg: S(82.5, [9, 9, 8], [1, 1, 0]), pd: S(57.5, [11, 10, 10], [1, 1, 0]), sp: S(22.5, [8, 8, 7], [1, 1, 0]), lp: S(170, [15, 15], [1, 1]), cz: S(27.5, [9, 9], [1, 0]) } },
    { date: "2026-09-18", day: 2, lifts: { hk: S(105, [9, 8, 8], [1, 1, 0]), ip: S(25, [10, 9, 8], [1, 1, 0]), rd: S(30, [12, 11, 10], [1, 1, 0]), lcl: S(37.5, [10, 10], [0, 0]), tr: S(45, [9, 9], [0, 0]) } },
    { date: "2026-09-21", day: 0, lifts: { sq: S(102.5, [7, 6, 6], [1, 1, 0]), pr: S(80, [8, 7, 7], [1, 1, 0]), lc: S(45, [10, 10], [2, 1]), rw: S(55, [10, 10, 9], [1, 1, 1]), lr: S(10, [13, 12], [1, 1]) } },
  ];
  // The previous mesocycle's squat sessions, used only by the exercise chart.
  const SQUAT_PRIOR = [
    { date: "2026-07-20", sets: S(87.5, [8, 7, 7], [1, 1, 0]) },
    { date: "2026-07-27", sets: S(90, [7, 7, 6], [1, 1, 0]) },
    { date: "2026-08-03", sets: S(90, [8, 7, 7], [1, 1, 0]) },
    { date: "2026-08-10", sets: S(92.5, [7, 6, 6], [1, 0, 0]) },
    { date: "2026-08-17", sets: S(92.5, [8, 7, 7], [1, 1, 0]) },
  ];

  /* Best sets from the previous mesocycle, per lift. Personal records are
     judged against these plus everything earlier in this block. */
  const PRIOR = {
    pr: [[80, 7], [82.5, 5]], lc: [[42.5, 11], [40, 12]], rw: [[57.5, 10], [55, 11]], lr: [[12, 10], [10, 12]],
    hg: [[85, 8], [80, 10]], pd: [[57.5, 11], [60, 8]], sp: [[22.5, 8], [20, 10]], lp: [[170, 13], [180, 10]],
    cz: [[27.5, 9], [25, 12]], hk: [[105, 9], [110, 6]], ip: [[25, 10], [27.5, 7]], rd: [[30, 12], [32.5, 10]],
    lcl: [[37.5, 11], [40, 8]], tr: [[45, 10], [50, 8]],
  };

  /* Engine output for today's Dia 1 before the session starts.
     status: up | hold | down | stalled | recover | new */
  const TODAY_REC = {
    sq: { status: "up", from: 100, load: 102.5, reps: 7, reason: "top", capReps: 9, capAtTarget: 8, typRir: 1, trend: ["rising", 3] },
    pr: { status: "hold", from: 80, load: 80, reps: 8, reason: "hold", capReps: 7, typRir: 1, trend: ["rising", 3] },
    lc: { status: "up", from: 42.5, load: 45, reps: 10, reason: "top", capReps: 13.5, capAtTarget: 11.5, typRir: 1.5, trend: ["rising", 3] },
    rw: { status: "hold", from: 55, load: 55, reps: 12, reason: "hold", capReps: 11, typRir: 1, trend: ["rising", 3] },
    lr: { status: "stalled", from: 10, load: 10, reps: 12, reason: "stalled", capReps: 12.5, typRir: 1, trend: ["flat", 3] },
  };
  // Squat, set 2, after set 1 was logged at 102.5 x 7 @1 (range.current_hold:
  // capacity about 7.5 reps, expected set-to-set drop about 1.3%).
  const SQUAT_SET2 = { load: 102.5, reps: 7, capReps: 7.5, drop: 0.013 };

  // Engine output for the next exposure of each lift after its latest session.
  const NEXT = {
    sq: { status: "hold", load: 102.5, reps: 8 },
    pr: { status: "hold", load: 80, reps: 8 },
    lc: { status: "hold", load: 45, reps: 11 },
    rw: { status: "stalled", load: 55, reps: 10 },
    lr: { status: "hold", load: 10, reps: 14 },
    hg: { status: "hold", load: 82.5, reps: 10 },
    pd: { status: "hold", load: 57.5, reps: 12 },
    sp: { status: "hold", load: 22.5, reps: 9 },
    lp: { status: "up", from: 170, load: 175, reps: 14 },
    cz: { status: "hold", load: 27.5, reps: 10 },
    hk: { status: "hold", load: 105, reps: 10 },
    ip: { status: "hold", load: 25, reps: 10 },
    rd: { status: "hold", load: 30, reps: 12 },
    lcl: { status: "recover", load: 37.5, reps: 10 },
    tr: { status: "recover", load: 45, reps: 9 },
  };
  // Next exposures as they stood right after the 18 Sep Dia 3 session.
  const NEXT_AFTER_DAY3 = ["hk", "ip", "rd", "lcl", "tr"];

  /* ---------- derived figures ---------- */
  const epley = (load, reps) => load * (1 + reps / 30);
  const best = (sets) => Math.max(...sets.map(([l, r]) => epley(l, r)));
  const topLoad = (sets) => Math.max(...sets.map(([l]) => l));
  const volume = (sets) => sets.reduce((t, [l, r]) => t + l * r, 0);

  function sessionTotals(s) {
    let sets = 0, vol = 0;
    for (const k in s.lifts) { sets += s.lifts[k].length; vol += volume(s.lifts[k]); }
    return { sets, vol: Math.round(vol), lifts: Object.keys(s.lifts).length };
  }

  function previousOf(k, date) {
    for (let i = SESSIONS.length - 1; i >= 0; i--) {
      const s = SESSIONS[i];
      if (s.date < date && s.lifts[k]) return { date: s.date, sets: s.lifts[k] };
    }
    return null;
  }

  // Outcome by lift: best-set e1RM against the previous exposure, ±1% band.
  function outcome(k, date) {
    const s = SESSIONS.find((x) => x.date === date);
    const prev = previousOf(k, date);
    if (!prev) return { kind: "new" };
    const a = best(prev.sets), b = best(s.lifts[k]);
    const ch = (b - a) / a;
    return { kind: ch > 0.01 ? "improved" : ch < -0.01 ? "declined" : "maintained", from: a, to: b };
  }

  // Personal records set in a session: heavier load, or more reps at a load.
  function prs(date) {
    const s = SESSIONS.find((x) => x.date === date);
    const out = [];
    for (const k in s.lifts) {
      const prior = SESSIONS.filter((x) => x.date < date && x.lifts[k]).flatMap((x) => x.lifts[k]);
      if (k === "sq") prior.push(...SQUAT_PRIOR.flatMap((x) => x.sets));
      else prior.push(...PRIOR[k]);
      if (!prior.length) continue;
      const maxLoad = Math.max(...prior.map(([l]) => l));
      const top = s.lifts[k].reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a));
      if (top[0] > maxLoad) { out.push({ k, load: top[0], reps: top[1], kind: "load", by: top[0] - maxLoad }); continue; }
      const atLoad = prior.filter(([l]) => l === top[0]).map(([, r]) => r);
      if (atLoad.length && top[1] > Math.max(...atLoad)) out.push({ k, load: top[0], reps: top[1], kind: "reps", by: top[1] - Math.max(...atLoad) });
    }
    return out;
  }

  // Hard sets per muscle: direct work 1, secondary 0.5.
  function muscles(date) {
    const s = SESSIONS.find((x) => x.date === date);
    const m = {};
    for (const k in s.lifts) {
      const n = s.lifts[k].length;
      for (const p of EX[k].pri) m[p] = (m[p] || 0) + n;
      for (const q of EX[k].sec) m[q] = (m[q] || 0) + n * 0.5;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  function dayMuscles(di) {
    const m = [];
    for (const k of PROGRAM.days[di].lifts) for (const p of EX[k].pri) if (!m.includes(p)) m.push(p);
    return m;
  }
  const daySets = (di) => PROGRAM.days[di].lifts.reduce((t, k) => t + EX[k].n, 0);

  function squatSeries() {
    const block = SESSIONS.filter((s) => s.lifts.sq).map((s) => ({ date: s.date, sets: s.lifts.sq, block: true }));
    return SQUAT_PRIOR.map((s) => ({ ...s, block: false })).concat(block).map((s) => ({
      ...s, e1rm: best(s.sets), top: topLoad(s.sets),
      topReps: Math.max(...s.sets.filter(([l]) => l === topLoad(s.sets)).map(([, r]) => r)),
    }));
  }

  // Block trend per lift: first vs latest best e1RM inside the mesocycle.
  function blockChange(k) {
    const xs = SESSIONS.filter((s) => s.lifts[k]);
    const a = best(xs[0].lifts[k]), b = best(xs[xs.length - 1].lifts[k]);
    return { from: a, to: b, pct: (b - a) / a, series: xs.map((s) => best(s.lifts[k])) };
  }

  /* ---------- language ---------- */
  const state = { lang: "pt" };
  const tx = (pt, en) => (state.lang === "pt" ? pt : en);
  const nm = (k) => (state.lang === "pt" ? EX[k].pt : EX[k].en);
  const mu = (m) => MUSCLE[m][state.lang === "pt" ? 0 : 1];
  const two = (arr) => arr[state.lang === "pt" ? 0 : 1];
  // "Quadríceps, peito e posteriores": sentence case, joined with the language's "and".
  function muList(ms) {
    const names = ms.map((m, i) => (i ? mu(m).charAt(0).toLowerCase() + mu(m).slice(1) : mu(m)));
    if (names.length < 2) return names.join("");
    return names.slice(0, -1).join(", ") + (state.lang === "pt" ? " e " : " and ") + names[names.length - 1];
  }

  function num(n, dec) {
    const d = dec == null ? (Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 1) : dec;
    return new Intl.NumberFormat(state.lang === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  const kg = (n) => num(n) + " kg";

  const WD_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const WS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const WS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const MO_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const date = {
    long(iso) { const d = parse(iso); return state.lang === "pt" ? cap(`${WD_PT[d.getUTCDay()]}, ${d.getUTCDate()} de ${MO_PT[d.getUTCMonth()]}`) : `${WD_EN[d.getUTCDay()]}, ${MO_EN[d.getUTCMonth()]} ${d.getUTCDate()}`; },
    short(iso) { const d = parse(iso); return state.lang === "pt" ? `${d.getUTCDate()} ${MO_PT[d.getUTCMonth()].slice(0, 3)}` : `${MO_EN[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; },
    wd(iso) { const d = parse(iso); return (state.lang === "pt" ? WS_PT : WS_EN)[d.getUTCDay()]; },
    wdLong(iso) { const d = parse(iso); return state.lang === "pt" ? cap(WD_PT[d.getUTCDay()]) : WD_EN[d.getUTCDay()]; },
    day(iso) { return parse(iso).getUTCDate(); },
    month(m) { return state.lang === "pt" ? cap(MO_PT[m]) : MO_EN[m]; },
    dow(iso) { return parse(iso).getUTCDay(); },
  };

  const TODAY = "2026-09-21";
  const LAST_DAY3 = "2026-09-18";

  root.TX = {
    EX, PROGRAM, SESSIONS, TODAY_REC, SQUAT_SET2, NEXT, NEXT_AFTER_DAY3, TODAY, LAST_DAY3,
    state, tx, nm, mu, muList, two, num, kg, date, epley, best, volume, sessionTotals, previousOf, outcome, prs, muscles,
    dayMuscles, daySets, squatSeries, blockChange,
  };
})(window);
