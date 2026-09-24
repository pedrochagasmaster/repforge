/* Direction A: Folha de treino (the training sheet).
   The ledger taken literally: figures in aligned mono columns, a left margin
   that carries the marks, hairlines instead of boxes, and no cards at all.
   Only the sheet and the bottom bar float. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT;
  const { tx, nm, num, kg, date } = T;
  const { ic, mark } = K;

  function nav(active) {
    const items = [["today", "home", tx("Hoje", "Today")], ["progress", "stats", tx("Progresso", "Progress")], ["history", "history", tx("Histórico", "History")], ["program", "program", tx("Programa", "Program")]];
    return `<nav class="a-nav">${items.map(([id, i, l]) => `<button class="a-nav__b${id === active ? " is-on" : ""}" data-go="${id}">${ic(i)}<span>${l}</span></button>`).join("")}</nav>`;
  }

  function weekRule(cur, total) {
    let s = "";
    for (let i = 1; i <= total; i++) s += `<i class="${i < cur ? "done" : i === cur ? "now" : ""}"></i>`;
    return `<div class="a-weeks" aria-hidden="true">${s}</div>`;
  }

  /* ---------------- Today ---------------- */
  function today() {
    const day = T.PROGRAM.days[0];
    const rows = day.lifts.map((k) => {
      const r = T.TODAY_REC[k];
      const prev = T.previousOf(k, T.TODAY);
      const sub = r.status === "stalled"
        ? tx("Três sessões sem reps novas", "Three sessions without new reps")
        : tx("Antes ", "Last ") + K.setsLine(prev.sets);
      return `<div class="a-row${r.status === "up" ? " is-up" : ""}">
        ${mark(r.status)}
        <div class="a-row__name">${nm(k)}<small>${sub}</small></div>
        <div class="a-num">${num(r.load)}</div>
        <div class="a-num">${T.EX[k].n} × ${r.reps}</div>
      </div>`;
    }).join("");
    const body = `
      <div class="a-pg">
        <div class="a-top"><span class="a-date">${date.long(T.TODAY)}</span><button class="a-icb" aria-label="${tx("Ajustes", "Settings")}">${ic("gear")}</button></div>
        <h1 class="a-h1">${T.two(day.name)}</h1>
        <p class="a-lede">${T.two(T.PROGRAM.name)}, ${tx("semana 4 de 6", "week 4 of 6")}</p>
        ${weekRule(4, 6)}
        <div class="a-tablehead"><h2 class="a-h2">${tx("Prescrição de hoje", "Today's prescription")}</h2><span class="a-meta">${tx("5 exercícios, 13 séries", "5 exercises, 13 sets")}</span></div>
        <div class="a-cols"><span></span><span>${tx("Exercício", "Exercise")}</span><span>kg</span><span>${tx("Meta", "Target")}</span></div>
        ${rows}
        <p class="a-foot">${tx("2 exercícios sobem de carga hoje. O resto mantém a carga e busca reps.", "2 lifts go up in load today. The rest hold the load and chase reps.")}</p>
        <button class="a-textbtn a-textbtn--l">${tx("Escolher outro dia", "Choose another day")}</button>
        <div class="a-split">
          <div><span class="a-k">${tx("Esta semana", "This week")}</span><span class="a-v">0 ${tx("de", "of")} 3 ${tx("sessões", "sessions")}</span></div>
          <div><span class="a-k">${tx("A seguir", "Up next")}</span><span class="a-v">${T.two(T.PROGRAM.days[1].name)}</span></div>
        </div>
      </div>`;
    const cta = `<div class="a-dockcta a-dockcta--nav"><button class="a-cta" data-go="workout">${tx("Começar treino", "Start workout")}${ic("arrow", "a-cta__ar")}</button></div>`;
    return { body, over: cta + nav("today"), cls: "a-has-cta" };
  }

  /* ---------------- Workout ---------------- */
  function topbar(timerText, live) {
    return `<div class="a-wtop">
      <button class="a-icb" data-go="today" aria-label="${tx("Voltar para Hoje", "Back to Today")}">${ic("chev")}</button>
      <div class="a-wtop__c"><b>${tx("Dia 1", "Day 1")}</b><span>${tx("exercício 1 de 5", "exercise 1 of 5")}</span></div>
      <button class="a-timer${live ? " is-live" : ""}" data-go="rest">${ic("timer")}${timerText ? `<span>${timerText}</span>` : ""}</button>
      <button class="a-icb">${ic("more")}</button>
    </div>
    <div class="a-seg5" aria-hidden="true"><i class="now"></i><i></i><i></i><i></i><i></i></div>`;
  }

  function stepper(U) {
    const f = U.field;
    const step = f === "load" ? 2.5 : 1;
    const label = { load: tx("Carga", "Load"), reps: "Reps", rir: "RIR" }[f];
    return `<div class="a-step">
      <button class="a-step__b" data-act="dec">${ic("minus")}<span>${num(step)}</span></button>
      <div class="a-step__v"><small>${label}</small><b>${f === "load" ? num(U.load) : U[f]}</b></div>
      <button class="a-step__b" data-act="inc">${ic("plus")}<span>${num(step)}</span></button>
    </div>`;
  }

  function setRow(n, vals, state, prev, U) {
    if (state === "open") {
      const cell = (f, v) => `<button class="a-in${U.field === f ? " is-sel" : ""}" data-field="${f}">${v}</button>`;
      return `<div class="a-set is-open"><span class="a-set__n">${n}</span>${cell("load", num(U.load))}${cell("reps", U.reps)}${cell("rir", U.rir)}</div>
        <p class="a-set__prev">${tx("Última", "Last")} ${num(prev[0])} × ${prev[1]}, RIR ${prev[2]}</p>
        ${stepper(U)}`;
    }
    const [l, r, rir] = vals;
    const cls = state === "done" ? " is-done" : "";
    return `<div class="a-set${cls}"><span class="a-set__n">${state === "done" ? ic("check") : n}</span><span class="a-num">${num(l)}</span><span class="a-num">${r}</span><span class="a-num">${rir == null ? "–" : rir}</span></div>
      <p class="a-set__prev">${tx("Última", "Last")} ${num(prev[0])} × ${prev[1]}, RIR ${prev[2]}</p>`;
  }

  function workoutBody(U, resting) {
    const k = "sq", rec = T.TODAY_REC.sq, prev = T.previousOf(k, T.TODAY).sets;
    const done = T.SESSIONS[T.SESSIONS.length - 1].lifts.sq[0];
    let sets;
    if (!resting) {
      sets = setRow(1, null, "open", prev[0], U) + setRow(2, [rec.load, rec.reps, null], "queued", prev[1]) + setRow(3, [rec.load, rec.reps, null], "queued", prev[2]);
    } else {
      sets = setRow(1, done, "done", prev[0]) + restLine(U) + setRow(2, null, "open", prev[1], U) + setRow(3, [T.SQUAT_SET2.load, T.SQUAT_SET2.reps, null], "queued", prev[2]);
    }
    return `
      ${topbar(resting ? K.fmtTime(U.rest) : "", resting)}
      <div class="a-pg a-pg--w">
        <h1 class="a-exname">${nm(k)}</h1>
        <p class="a-exmeta"><span class="a-mono">${T.EX[k].n} × ${K.range(k)}</span> reps, RIR 0–${T.PROGRAM.rirHigh}</p>
        <div class="a-cue">${mark(resting ? "hold" : rec.status)}<span>${resting ? tx(`Série 2: ${kg(T.SQUAT_SET2.load)}, buscar ${T.SQUAT_SET2.reps} reps`, `Set 2: ${kg(T.SQUAT_SET2.load)}, aim for ${T.SQUAT_SET2.reps} reps`) : K.cue(rec)}</span><button class="a-why" data-go="why">${tx("Por quê?", "Why?")}</button></div>
        <p class="a-note">${ic("note")}${T.two(T.EX.sq.note)}</p>
        <div class="a-cols a-cols--set"><span>${tx("Série", "Set")}</span><span>kg</span><span>reps</span><span>RIR</span></div>
        ${sets}
        <button class="a-next">${tx("Próximo", "Next")} <b>${nm("pr")}</b>${ic("chev", "rot-l")}</button>
      </div>`;
  }

  function restLine(U) {
    const p = Math.max(0, U.rest) / U.restTotal;
    return `<div class="a-rest" role="timer">
      <div class="a-rest__row"><span class="a-rest__k">${U.rest > 0 ? tx("Descanso", "Rest") : tx("Descanso concluído", "Rest done")}</span><b class="a-rest__t">${K.fmtTime(U.rest)}</b><span class="a-rest__of">${tx("de", "of")} ${K.fmtTime(U.restTotal)}</span></div>
      <div class="a-rest__bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
      <div class="a-rest__ctl"><button data-act="rest-30">−30 s</button><button data-act="rest+30">+30 s</button><button data-act="rest-pause">${U.running ? tx("Pausar", "Hold") : tx("Retomar", "Resume")}</button><button data-act="rest-skip">${tx("Pular", "Skip")}</button></div>
    </div>`;
  }

  function workout(U) {
    return { body: workoutBody(U, false), over: `<div class="a-dockcta"><button class="a-cta" data-go="rest">${tx("Registrar série 1", "Log set 1")}</button></div>`, cls: "no-dock" };
  }

  function rest(U) {
    return { body: workoutBody(U, true), over: `<div class="a-dockcta"><button class="a-cta a-cta--quiet" data-go="summary">${tx("Registrar série 2", "Log set 2")}</button></div>`, cls: "no-dock" };
  }

  /* ---------------- Why this weight ---------------- */
  function why(U) {
    const rec = T.TODAY_REC.sq, prev = T.previousOf("sq", T.TODAY);
    const line = (k, v, sub, text) => `<div class="a-calc"><span class="a-calc__k">${k}</span><span class="a-calc__v${text ? " a-calc__v--t" : ""}">${v}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const sheet = `<div class="scrim" data-go="workout"></div>
      <section class="a-sheet" role="dialog" aria-label="${tx("Por que essa carga", "Why this weight")}">
        <div class="grab"></div>
        <div class="a-sheet__h"><h2>${tx("Por que", "Why")} ${kg(rec.load)}</h2><button class="a-icb" data-go="workout" aria-label="${tx("Fechar", "Close")}">${ic("close")}</button></div>
        <p class="a-calc__group">${tx("Última sessão", "Last session")}, ${date.short(prev.date)}</p>
        ${prev.sets.map((s, i) => line(`${tx("Série", "Set")} ${i + 1}`, `${num(s[0])} × ${s[1]}<em>RIR ${s[2]}</em>`)).join("")}
        <p class="a-calc__group">${tx("Cálculo", "Working")}</p>
        ${line(tx("Capacidade mostrada", "Capacity shown"), `≈ ${rec.capReps} reps`, tx("Reps mais RIR, contando até 4 RIR, com 100 kg.", "Reps plus RIR, counting up to 4 RIR, at 100 kg."))}
        ${line(tx("Regra", "Rule"), tx("topo da faixa, 8", "range top, 8"), tx("Todas as séries chegaram ao topo da faixa. A carga sobe.", "Every set reached the top of the range. The load goes up."), true)}
        ${line(tx("Nova carga", "New load"), `${num(rec.from)} + ${num(2.5)}% = ${num(rec.load)}`, tx("Arredondado para o passo de 2,5 kg.", "Rounded to the nearest 2.5 kg step."))}
        ${line(tx("Meta de reps", "Rep target"), `≈ ${rec.capAtTarget} − ${rec.typRir} = ${rec.reps}`, tx(`Capacidade com ${kg(rec.load)} menos seu RIR habitual.`, `Capacity at ${kg(rec.load)} minus your usual RIR.`))}
        <div class="a-calc a-calc--sum"><span class="a-calc__k">${tx("Hoje", "Today")}</span><span class="a-calc__v">${kg(rec.load)} × ${rec.reps}</span></div>
        <p class="a-sheet__foot">${tx("A força subiu em 3 sessões neste bloco. Mantenha o programa atual.", "Strength rose across 3 sessions in this block. Keep the current program.")}</p>
      </section>`;
    return { body: workoutBody(U, false), over: sheet, cls: "no-dock" };
  }

  /* ---------------- Summary ---------------- */
  function summary(U, iso = T.TODAY) {
    const s = T.SESSIONS.find((x) => x.date === iso);
    const tot = T.sessionTotals(s);
    const prs = T.prs(iso);
    const week = iso === T.TODAY ? 4 : 3;
    const lifts = Object.keys(s.lifts).map((k) => {
      const o = T.outcome(k, iso);
      const pr = prs.find((p) => p.k === k);
      return `<div class="a-lift">
        <div class="a-lift__h"><span>${nm(k)}</span><span class="a-out a-out--${o.kind}">${K.outcomeWord(o.kind)}</span></div>
        <div class="a-lift__s"><span class="a-mono">${num(s.lifts[k][0][0])} kg × ${K.repsList(s.lifts[k])}</span>${pr ? `<span class="a-pr">PR ${K.prLine(pr)}</span>` : ""}</div>
      </div>`;
    }).join("");
    const next = Object.keys(s.lifts).map((k) => {
      const n = T.NEXT[k];
      return `<div class="a-row a-row--tight${n.status === "up" ? " is-up" : ""}">${mark(n.status)}<div class="a-row__name">${nm(k)}</div><div class="a-num">${num(n.load)}</div><div class="a-num">× ${n.reps}</div></div>`;
    }).join("");
    const ms = T.muscles(iso);
    const body = `
      <div class="a-pg">
        <p class="a-date a-date--top">${tx("Sessão salva", "Session saved")}</p>
        <h1 class="a-h1">${T.two(T.PROGRAM.days[s.day].name)}</h1>
        <p class="a-lede">${date.long(iso)}, ${tx("semana", "week")} ${week}</p>
        <div class="a-totals">
          <div><b>${tot.sets}</b><span>${tx("séries", "sets")}</span></div>
          <div><b>${num(tot.vol, 0)}</b><span>${tx("kg movimentados", "kg moved")}</span></div>
          <div><b>${tot.lifts}</b><span>${tx("exercícios", "exercises")}</span></div>
        </div>
        <h2 class="a-h2 a-h2--sec">${tx("Resultado por exercício", "Outcome by lift")}</h2>
        ${lifts}
        <h2 class="a-h2 a-h2--sec">${tx("Na próxima vez", "Next time")}</h2>
        ${next}
        <h2 class="a-h2 a-h2--sec">${tx("Séries efetivas por músculo", "Hard sets by muscle")}</h2>
        <div class="a-mus">${ms.slice(0, 6).map(([m, v]) => `<div><span>${T.mu(m)}</span><b>${num(v)}</b></div>`).join("")}</div>
        <button class="a-textbtn a-textbtn--l">${tx(`Ver os ${ms.length} músculos`, `Show all ${ms.length} muscles`)}</button>
        <div class="a-split">
          <div><span class="a-k">${tx("Esta semana", "This week")}</span><span class="a-v">${iso === T.TODAY ? tx("1 de 3 sessões", "1 of 3 sessions") : tx("3 de 3 sessões", "3 of 3 sessions")}</span></div>
          <div><span class="a-k">${tx("A seguir", "Up next")}</span><span class="a-v">${iso === T.TODAY ? tx("Dia 2", "Day 2") : tx("Dia 1", "Day 1")}</span></div>
        </div>
      </div>`;
    return { body, over: `<div class="a-dockcta"><button class="a-cta" data-go="today">${tx("Concluir", "Done")}</button></div>`, cls: "no-dock" };
  }

  /* ---------------- Progress ---------------- */
  function tabs(items, on) {
    return `<div class="a-tabs">${items.map((l, i) => `<button class="${i === on ? "is-on" : ""}">${l}</button>`).join("")}</div>`;
  }
  const progressTabs = (on) => tabs([tx("Visão geral", "Overview"), tx("Força", "Strength"), "Volume", "PRs", tx("Revisão", "Review")], on);

  function attentionRows() {
    const items = [
      ["lp", "up", tx("Topo da faixa em todas as séries.", "Top of range on every set."), `${num(170)} → ${num(175)}`],
      ["rw", "stalled", tx("Sem progresso em três sessões. Use uma carga menor por uma sessão ou adicione uma série.", "No progress in three sessions. Use a lighter load for one session, or add one set."), num(55)],
      ["lcl", "recover", tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move."), num(37.5)],
      ["tr", "recover", tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move."), num(45)],
    ];
    return items.map(([k, st, why, v]) => `<div class="a-row a-row--att${st === "up" ? " is-up" : ""}">${mark(st)}<div class="a-row__name">${nm(k)}<small>${K.verdict(st)}. ${why}</small></div><div class="a-num">${v}</div></div>`).join("");
  }

  function progress() {
    const lifts = ["sq", "pr", "hg", "pd", "hk", "lp"];
    const body = `
      <div class="a-pg">
        <h1 class="a-h1 a-h1--page">${tx("Progresso", "Progress")}</h1>
        ${progressTabs(0)}
        <div class="a-totals a-totals--2">
          <div><b>1<i>/3</i></b><span>${tx("sessões", "sessions")}</span></div>
          <div><b>13<i>/39</i></b><span>${tx("séries de trabalho", "working sets")}</span></div>
        </div>
        <p class="a-foot a-foot--top">${tx("Semana 4 de 6 em andamento.", "Week 4 of 6 in progress.")}</p>
        <div class="a-tablehead"><h2 class="a-h2">${tx("Precisa de atenção", "Needs attention")}</h2><span class="a-meta">4</span></div>
        ${attentionRows()}
        <div class="a-tablehead"><h2 class="a-h2">${tx("Força neste bloco", "Strength this block")}</h2><span class="a-meta">e1RM</span></div>
        ${lifts.map((k) => { const b = T.blockChange(k); return `<button class="a-trow" data-go="${k === "sq" ? "chart" : "progress"}"><span class="a-row__name">${nm(k)}</span>${K.sparkline(b.series)}<span class="a-num">${K.pct(b.pct)}</span></button>`; }).join("")}
      </div>`;
    return { body, over: nav("progress") };
  }

  function chart() {
    const S = T.squatSeries();
    const bestE = Math.max(...S.map((s) => s.e1rm));
    const rows = S.slice().reverse().map((s, i, arr) => {
      const prev = arr[i + 1];
      const d = prev ? s.e1rm - prev.e1rm : null;
      return `<div class="a-hrow${s.block ? "" : " is-old"}"><span>${date.short(s.date)}</span><span class="a-num">${num(s.top)} × ${s.topReps}</span><span class="a-num">${num(s.e1rm, 1)}</span><span class="a-num a-soft">${d == null ? "–" : K.signed(d, 1)}</span></div>`;
    }).join("");
    const body = `
      <div class="a-pg">
        <button class="a-back" data-go="progress">${ic("chev", "rot-r")}${tx("Progresso", "Progress")}</button>
        <h1 class="a-h1 a-h1--ex">${nm("sq")}</h1>
        ${tabs([tx("Bloco atual", "Current block"), tx("Todo o histórico", "All history")], 1)}
        <div class="a-totals a-totals--3">
          <div><b>${num(bestE, 1)}</b><span>${tx("melhor e1RM, kg", "best e1RM, kg")}</span></div>
          <div><b>${num(102.5)}</b><span>${tx("maior carga, kg", "top load, kg")}</span></div>
          <div><b>${S.length}</b><span>${tx("sessões", "sessions")}</span></div>
        </div>
        <div class="a-chart">${K.squatChart({ h: 200 })}</div>
        <div class="a-cols a-cols--hist"><span>${tx("Data", "Date")}</span><span>${tx("maior série", "top set")}</span><span>e1RM</span><span>Δ</span></div>
        ${rows}
      </div>`;
    return { body, over: nav("progress") };
  }

  /* ---------------- History ---------------- */
  function monthStrip() {
    const days = T.SESSIONS.filter((s) => s.date >= "2026-09-01").map((s) => T.date.day(s.date));
    let c = "";
    for (let d = 1; d <= 30; d++) c += `<i class="${d === 21 ? "now" : days.includes(d) ? "on" : ""}"></i>`;
    return `<div class="a-strip" aria-hidden="true">${c}</div><div class="a-strip__lab"><span>1</span><span>7</span><span>14</span><span>21</span><span>30</span></div>`;
  }

  function history() {
    const weeks = [[4, ["2026-09-21"]], [3, ["2026-09-18", "2026-09-16", "2026-09-14"]], [2, ["2026-09-11", "2026-09-09", "2026-09-07"]], [1, ["2026-09-04", "2026-09-02", "2026-08-31"]]];
    const sep = T.SESSIONS.filter((s) => s.date >= "2026-09-01");
    const sepSets = sep.reduce((t, s) => t + T.sessionTotals(s).sets, 0);
    const block = weeks.map(([w, ds]) => {
      const rows = ds.map((iso) => {
        const s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), p = T.prs(iso).length;
        const mus = T.muList(T.dayMuscles(s.day).slice(0, 3));
        return `<button class="a-sess" data-go="${iso === T.TODAY ? "session" : "history"}">
          <span class="a-sess__d"><small>${date.wd(iso)}</small>${date.day(iso)}</span>
          <span class="a-sess__m"><b>${T.two(T.PROGRAM.days[s.day].name)}</b><small>${mus}</small></span>
          <span class="a-sess__n"><span class="a-num">${t.sets} ${tx("séries", "sets")}</span><span class="a-num a-soft">${num(t.vol, 0)} kg</span>${p ? `<span class="a-pr">${p} PR${p > 1 ? "s" : ""}</span>` : ""}</span>
        </button>`;
      }).join("");
      return `<div class="a-wk"><span>${tx("Semana", "Week")} ${w}</span></div>${rows}`;
    }).join("");
    const body = `
      <div class="a-pg">
        <div class="a-top a-top--h"><h1 class="a-h1 a-h1--page">${tx("Histórico", "History")}</h1><button class="a-icb" aria-label="${tx("Buscar sessões", "Search sessions")}">${ic("search")}</button></div>
        <div class="a-month"><button class="a-icb a-icb--s">${ic("chev", "rot-r")}</button><b>${tx("Setembro de 2026", "September 2026")}</b><button class="a-icb a-icb--s">${ic("chev", "rot-l")}</button></div>
        ${monthStrip()}
        <p class="a-foot a-foot--c">${sep.length} ${tx("sessões", "sessions")}, ${sepSets} ${tx("séries", "sets")}</p>
        ${block}
      </div>`;
    return { body, over: nav("history") };
  }

  function session() {
    const iso = T.TODAY, s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), prs = T.prs(iso);
    const groups = Object.keys(s.lifts).map((k) => {
      const pr = prs.find((p) => p.k === k);
      return `<div class="a-grp"><span>${nm(k)}</span>${pr ? `<span class="a-pr">PR</span>` : ""}</div>` +
        s.lifts[k].map((st, i) => `<div class="a-set a-set--ro"><span class="a-set__n">${i + 1}</span><span class="a-num">${num(st[0])}</span><span class="a-num">${st[1]}</span><span class="a-num">${st[2]}</span></div>`).join("");
    }).join("");
    const body = `
      <div class="a-pg">
        <button class="a-back" data-go="history">${ic("chev", "rot-r")}${tx("Histórico", "History")}</button>
        <h1 class="a-h1">${T.two(T.PROGRAM.days[s.day].name)}</h1>
        <p class="a-lede">${date.long(iso)}, ${tx("semana 4", "week 4")}</p>
        <div class="a-totals">
          <div><b>${t.sets}</b><span>${tx("séries", "sets")}</span></div>
          <div><b>${num(t.vol, 0)}</b><span>${tx("kg movimentados", "kg moved")}</span></div>
          <div><b>${prs.length}</b><span>PRs</span></div>
        </div>
        <div class="a-cols a-cols--set"><span>${tx("Série", "Set")}</span><span>kg</span><span>reps</span><span>RIR</span></div>
        ${groups}
        <div class="a-actions"><button class="a-sec">${ic("pencil")}${tx("Editar", "Edit")}</button><button class="a-danger">${tx("Excluir sessão", "Delete session")}</button></div>
      </div>`;
    return { body, over: nav("history") };
  }

  /* ---------------- Program ---------------- */
  function program() {
    const days = T.PROGRAM.days.map((d, di) => {
      const rows = d.lifts.map((k) => {
        const load = di === 0 ? T.TODAY_REC[k].load : T.NEXT[k].load;
        return `<div class="a-prow"><span class="a-row__name">${nm(k)}</span><span class="a-num">${T.EX[k].n} × ${K.range(k)}</span><span class="a-num a-soft">${num(load)}</span></div>`;
      }).join("");
      return `<div class="a-day"><div class="a-day__h"><b>${T.two(d.name)}</b><span>${T.muList(T.dayMuscles(di).slice(0, 3))}</span><span class="a-num">${T.daySets(di)} ${tx("séries", "sets")}</span></div>
        <div class="a-cols a-cols--prog"><span>${tx("Exercício", "Exercise")}</span><span>${tx("Faixa", "Range")}</span><span>kg</span></div>${rows}</div>`;
    }).join("");
    const body = `
      <div class="a-pg">
        <div class="a-top a-top--h"><span class="a-date">${tx("Programa", "Program")}</span><button class="a-textbtn a-textbtn--acc">${tx("Editar", "Edit")}</button></div>
        <h1 class="a-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="a-lede">${T.two(T.PROGRAM.goal)}, ${tx("3 dias por semana", "3 days per week")}</p>
        ${weekRule(4, 6)}
        <div class="a-split a-split--top">
          <div><span class="a-k">${tx("Semana", "Week")}</span><span class="a-v">4 ${tx("de", "of")} 6</span></div>
          <div><span class="a-k">${tx("Iniciado em", "Started")}</span><span class="a-v">${date.short(T.PROGRAM.started)}</span></div>
          <div><span class="a-k">${tx("Últimos 7 dias", "Last 7 days")}</span><span class="a-v">3 ${tx("de", "of")} 3</span></div>
        </div>
        <p class="a-status">${tx("No caminho certo", "On track")}</p>
        ${days}
      </div>`;
    return { body, over: nav("program") };
  }

  root.DIR_A = {
    key: "a", name: "Folha de treino", en: "Training sheet",
    idea: "Every screen is a page of the training record: figures in aligned columns, marks in the margin, hairlines instead of boxes.",
    screens: { today, workout, why, rest, summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program },
    notes: {
      today: "Shows today's actual prescription (load and reps from the engine), not the template. The table replaces the preview button.",
      workout: "All sets of the lift as ledger lines; the open line takes input, a stepper under it edits the tapped field.",
      why: "The recommendation as a worked calculation that sums to today's line.",
      rest: "Rest is a line in the ledger, not a sheet: the set you just logged and the next one stay in view.",
      summary: "A receipt: totals, one line per lift, then what the next session asks.",
      summary2: "A session with no records reads just as plainly. Declines are ink, not red.",
      progress: "One flat tab row. Attention items carry their reason; strength is a table with sparklines.",
      chart: "One series, both blocks, the block start ruled. The table below is the chart's data.",
      history: "The month collapses into one strip; sessions are ledger lines grouped by week.",
      session: "Sets grouped under each lift, so a name is printed once.",
      program: "The printed program: every day open, with the working load beside each range.",
    },
  };
})(window);
