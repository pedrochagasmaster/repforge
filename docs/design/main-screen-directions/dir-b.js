/* Direction B: Um polegar (one thumb).
   Built at arm's length: read in the top half, act in the bottom third.
   During a session the dock gives way to a raised action shelf that holds
   every control the thumb needs; figures are sized to read from a bench. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT;
  const { tx, nm, num, kg, date } = T;
  const { ic, mark } = K;

  const art = (k, cls = "") => `<span class="b-art ${cls}" style="--art-bg:${T.EX[k].bg}"><img src="${T.EX[k].art}" alt="" loading="lazy"></span>`;

  function dock(active) {
    const items = [["today", "home", tx("Hoje", "Today")], ["progress", "stats", tx("Progresso", "Progress")], ["history", "history", tx("Histórico", "History")], ["program", "program", tx("Programa", "Program")]];
    return `<nav class="b-dock">${items.map(([id, i, l]) => `<button class="b-dock__b${id === active ? " is-on" : ""}" data-go="${id}">${ic(i)}<span>${l}</span></button>`).join("")}</nav>`;
  }

  /* ---------------- Today ---------------- */
  function today() {
    const day = T.PROGRAM.days[0];
    const rows = day.lifts.map((k) => {
      const r = T.TODAY_REC[k];
      const sub = r.status === "up" ? tx(`Sobe de ${kg(r.from)}`, `Up from ${kg(r.from)}`) : r.status === "stalled" ? tx("Travado há 3 sessões", "Stalled for 3 sessions") : tx("Mesma carga, mais reps", "Same load, more reps");
      return `<div class="b-row">${art(k)}<div class="b-row__m"><b>${nm(k)}</b><small class="${r.status === "up" ? "is-up" : ""}">${sub}</small></div><div class="b-row__v"><b>${num(r.load)}</b><small>${T.EX[k].n} × ${r.reps}</small></div></div>`;
    }).join("");
    const body = `
      <div class="b-pg">
        <div class="b-top"><span class="b-soft">${date.long(T.TODAY)}</span><button class="b-icb" aria-label="${tx("Ajustes", "Settings")}">${ic("gear")}</button></div>
        <h1 class="b-hero">${T.two(day.name)}</h1>
        <p class="b-lede">${T.muList(T.dayMuscles(0).slice(0, 3))}</p>
        <p class="b-soft b-meta">${tx("Semana 4 de 6, 13 séries", "Week 4 of 6, 13 sets")}</p>
        <div class="b-list">${rows}</div>
        <p class="b-lab">${tx("Treinar outro dia", "Train another day")}</p>
        <div class="b-days">
          <button class="is-on"><b>${tx("Dia 1", "Day 1")}</b><small>${tx("hoje", "today")}</small></button>
          <button><b>${tx("Dia 2", "Day 2")}</b><small>${tx("5 exercícios", "5 exercises")}</small></button>
          <button><b>${tx("Dia 3", "Day 3")}</b><small>${tx("5 exercícios", "5 exercises")}</small></button>
        </div>
        <p class="b-soft b-week">${tx("Esta semana: 0 de 3 sessões", "This week: 0 of 3 sessions")}</p>
      </div>`;
    const over = `<div class="b-thumb"><button class="b-cta" data-go="workout">${tx("Começar treino", "Start workout")}${ic("arrow", "b-cta__ar")}</button></div>${dock("today")}`;
    return { body, over, cls: "b-has-thumb" };
  }

  /* ---------------- Workout ---------------- */
  function wtop(live, U) {
    return `<div class="b-wtop">
      <button class="b-icb" data-go="today" aria-label="${tx("Voltar para Hoje", "Back to Today")}">${ic("chev")}</button>
      <div class="b-wtop__c"><span>${tx("Exercício 1 de 5", "Exercise 1 of 5")}</span><div class="b-dots"><i class="now"></i><i></i><i></i><i></i><i></i></div></div>
      <button class="b-icb${live ? " b-icb--live" : ""}" data-go="rest">${ic("timer")}${live ? `<span>${K.fmtTime(U.rest)}</span>` : ""}</button>
    </div>`;
  }

  function workoutBody(U, setNo) {
    const rec = T.TODAY_REC.sq, prev = T.previousOf("sq", T.TODAY);
    const target = setNo === 1 ? rec : { status: "hold", load: T.SQUAT_SET2.load, reps: T.SQUAT_SET2.reps };
    return `${wtop(setNo > 1, U)}
      <div class="b-pg b-pg--w">
        <div class="b-ex">${art("sq", "b-art--l")}<div><h1 class="b-exname">${nm("sq")}</h1><p class="b-soft">${T.EX.sq.n} × ${K.range("sq")} reps, RIR 0–${T.PROGRAM.rirHigh}</p></div></div>
        <div class="b-cue">
          <p class="b-cue__main">${mark(target.status)}${target.status === "up" ? tx("Subir para", "Go up to") : tx("Manter", "Hold")} ${kg(target.load)}</p>
          <p class="b-cue__sub">${tx("buscar", "aim for")} ${target.reps} reps</p>
          <button class="b-why" data-go="why">${tx("Por que essa carga?", "Why this weight?")}</button>
        </div>
        <p class="b-note">${ic("note")}${T.two(T.EX.sq.note)}</p>
        <p class="b-last">${tx("Última vez", "Last time")}, ${date.short(prev.date)}: <b>${K.setsLine(prev.sets)}</b></p>
        <div class="b-sets">${[1, 2, 3].map((n) => `<span class="${n < setNo ? "done" : n === setNo ? "now" : ""}">${n < setNo ? ic("check") : ""}${tx("Série", "Set")} ${n}</span>`).join("")}</div>
      </div>`;
  }

  function shelf(U, cta, go) {
    const f = U.field, step = f === "load" ? 2.5 : 1;
    const field = (id, label, v) => `<button class="b-field${f === id ? " is-sel" : ""}" data-field="${id}"><small>${label}</small><b>${v}</b></button>`;
    return `<div class="b-shelf">
      <div class="b-fields">${field("load", tx("Carga, kg", "Load, kg"), num(U.load))}${field("reps", "Reps", U.reps)}${field("rir", "RIR", U.rir)}</div>
      <div class="b-pads"><button data-act="dec">${ic("minus")}<span>${num(step)}</span></button><button data-act="inc">${ic("plus")}<span>${num(step)}</span></button></div>
      <button class="b-cta" data-go="${go}">${cta}</button>
    </div>`;
  }

  function workout(U) {
    return { body: workoutBody(U, 1), over: shelf(U, tx("Registrar série 1", "Log set 1"), "rest"), cls: "no-dock b-has-shelf" };
  }

  /* ---------------- Why ---------------- */
  function why(U) {
    const rec = T.TODAY_REC.sq, prev = T.previousOf("sq", T.TODAY);
    const reason = (lead, body) => `<div class="b-reason"><b>${lead}</b><p>${body}</p></div>`;
    const sheet = `<div class="scrim" data-go="workout"></div>
      <section class="b-sheet" role="dialog" aria-label="${tx("Por que essa carga", "Why this weight")}">
        <div class="grab"></div>
        <p class="b-soft">${tx("Por que essa carga", "Why this weight")}</p>
        <h2 class="b-sheet__t">${mark("up")}${tx("Subir para", "Go up to")} ${kg(rec.load)}</h2>
        ${reason(tx("Topo da faixa", "Top of the range"), tx(`Você fez ${K.repsList(prev.sets).replace(/, (\d+)$/, " e $1")} reps com 100 kg. A faixa vai até 8, então a carga sobe.`, `You did ${K.repsList(prev.sets).replace(/, (\d+)$/, " and $1")} reps at 100 kg. The range tops out at 8, so the load goes up.`))}
        ${reason(tx("Passo de carga", "Load step"), tx(`100 kg mais 2,5%, arredondado para o passo de 2,5 kg: ${kg(rec.load)}.`, `100 kg plus 2.5%, rounded to the nearest 2.5 kg step: ${kg(rec.load)}.`))}
        ${reason(tx(`Meta de ${rec.reps} reps`, `Target of ${rec.reps} reps`), tx(`Com ${kg(rec.load)} sua capacidade é de cerca de ${rec.capAtTarget} reps. Menos seu RIR habitual de ${rec.typRir}, a meta começa em ${rec.reps}.`, `At ${kg(rec.load)} your capacity is about ${rec.capAtTarget} reps. Minus your usual ${rec.typRir} RIR, the target starts at ${rec.reps}.`))}
        <p class="b-soft b-sheet__foot">${tx("A força subiu em 3 sessões neste bloco.", "Strength rose across 3 sessions in this block.")}</p>
        <button class="b-sec" data-go="workout">${tx("Entendi", "Got it")}</button>
      </section>`;
    return { body: workoutBody(U, 1), over: sheet, cls: "no-dock" };
  }

  /* ---------------- Rest ---------------- */
  function rest(U) {
    const p = Math.max(0, U.rest) / U.restTotal;
    const done = T.SESSIONS[T.SESSIONS.length - 1].lifts.sq[0];
    const body = `
      <div class="b-rest">
        <div class="b-rest__top"><div><p class="b-soft">${tx("Descanso", "Rest")}</p><b>${nm("sq")}</b></div><button class="b-icb" data-go="workout" aria-label="${tx("Fechar o timer de descanso", "Close rest timer")}">${ic("close")}</button></div>
        <div class="b-drain"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
        <div class="b-clock" role="timer"><b>${K.fmtTime(U.rest)}</b><span>${U.rest > 0 ? `${tx("de", "of")} ${K.fmtTime(U.restTotal)}` : tx("Descanso concluído.", "Rest done.")}</span></div>
        <div class="b-logged">${ic("check")}<span>${tx("Série 1 registrada", "Set 1 logged")}: <b>${kg(done[0])} × ${done[1]}</b>, RIR ${done[2]}</span></div>
        <div class="b-nextset"><small>${tx("A seguir, série 2 de 3", "Next, set 2 of 3")}</small><b>${kg(T.SQUAT_SET2.load)} × ${T.SQUAT_SET2.reps}</b></div>
      </div>`;
    const over = `<div class="b-shelf">
      <div class="b-pads b-pads--3"><button data-act="rest-30">${ic("minus")}<span>30 s</span></button><button data-act="rest-pause">${ic(U.running ? "pause" : "play")}<span>${U.running ? tx("Pausar", "Hold") : tx("Retomar", "Resume")}</span></button><button data-act="rest+30">${ic("plus")}<span>30 s</span></button></div>
      <button class="b-cta" data-go="workout2">${tx("Ir para a série 2", "Go to set 2")}</button>
    </div>`;
    return { body, over, cls: "no-dock b-has-shelf" };
  }

  function workout2(U) {
    return { body: workoutBody(U, 2), over: shelf(U, tx("Registrar série 2", "Log set 2"), "summary"), cls: "no-dock b-has-shelf" };
  }

  /* ---------------- Summary ---------------- */
  function summary(U, iso) {
    const s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), prs = T.prs(iso);
    const prBlock = prs.length ? `<h2 class="b-h2">${tx("Recordes pessoais", "Personal records")}</h2>` + prs.map((p) => `<div class="b-pr"><span class="b-pr__tag">PR</span><div><b>${nm(p.k)}</b><small>${K.prLine(p)}</small></div><span class="b-pr__v">${num(p.load)} × ${p.reps}</span></div>`).join("") : "";
    const next = Object.keys(s.lifts).map((k) => {
      const n = T.NEXT[k];
      return `<div class="b-row b-row--s">${art(k, "b-art--s")}<div class="b-row__m"><b>${nm(k)}</b><small class="${n.status === "up" ? "is-up" : ""}">${K.verdict(n.status)}</small></div><div class="b-row__v"><b>${num(n.load)}</b><small>× ${n.reps}</small></div></div>`;
    }).join("");
    const outs = Object.keys(s.lifts).map((k) => { const o = T.outcome(k, iso); return `<div class="b-out"><span>${nm(k)}</span><span class="b-o b-o--${o.kind}">${o.kind === "improved" ? ic("arrow", "mk-up") : o.kind === "declined" ? ic("arrow", "mk-down") : ic("equal")}${K.outcomeWord(o.kind)}</span></div>`; }).join("");
    const body = `
      <div class="b-pg">
        <p class="b-soft b-top--sum">${tx("Sessão salva", "Session saved")}</p>
        <h1 class="b-hero">${T.two(T.PROGRAM.days[s.day].name)}</h1>
        <p class="b-lede">${date.long(iso)}</p>
        <div class="b-figs"><div><b>${t.sets}</b><small>${tx("séries", "sets")}</small></div><div><b>${num(t.vol, 0)}</b><small>${tx("kg movimentados", "kg moved")}</small></div><div><b>${t.lifts}</b><small>${tx("exercícios", "exercises")}</small></div></div>
        ${prBlock}
        <h2 class="b-h2">${tx("Na próxima vez", "Next time")}</h2>
        ${next}
        <h2 class="b-h2">${tx("Resultado por exercício", "Outcome by lift")}</h2>
        ${outs}
        <h2 class="b-h2">${tx("Esta semana", "This week")}</h2>
        <p class="b-lede b-lede--s">${iso === T.TODAY ? tx("1 de 3 sessões. A seguir: Dia 2.", "1 of 3 sessions. Up next: Day 2.") : tx("3 de 3 sessões. A seguir: Dia 1.", "3 of 3 sessions. Up next: Day 1.")}</p>
      </div>`;
    const over = `<div class="b-shelf b-shelf--flat"><div class="b-two"><button class="b-sec" data-go="session">${tx("Ver a sessão", "See the session")}</button><button class="b-cta" data-go="today">${tx("Concluir", "Done")}</button></div></div>`;
    return { body, over, cls: "no-dock b-has-shelf-s" };
  }

  /* ---------------- Progress ---------------- */
  const pills = (items, on) => `<div class="b-pills">${items.map((l, i) => `<button class="${i === on ? "is-on" : ""}">${l}</button>`).join("")}</div>`;

  function progress() {
    const att = [
      ["lp", "up", `${num(170)} → ${num(175)} kg`, tx("Topo da faixa em todas as séries.", "Top of range on every set.")],
      ["rw", "stalled", `${num(55)} kg`, tx("Sem progresso em três sessões.", "No progress in three sessions.")],
      ["lcl", "recover", `${num(37.5)} kg`, tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move.")],
      ["tr", "recover", `${num(45)} kg`, tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move.")],
    ].map(([k, st, v, why]) => `<button class="b-att">${art(k, "b-art--s")}<div class="b-att__m"><span class="b-verd b-verd--${st}">${K.verdict(st)}, ${v}</span><b>${nm(k)}</b><small>${why}</small></div>${ic("chev", "rot-l")}</button>`).join("");
    const lifts = ["sq", "pr", "hg", "hk"].map((k) => { const b = T.blockChange(k); return `<button class="b-lift" data-go="${k === "sq" ? "chart" : "progress"}"><div><b>${nm(k)}</b><small>e1RM ${num(b.from, 1)} → ${num(b.to, 1)} kg</small></div>${K.sparkline(b.series, 72, 30)}<span class="b-lift__d">${K.pct(b.pct)}</span></button>`; }).join("");
    const body = `
      <div class="b-pg">
        <h1 class="b-title">${tx("Progresso", "Progress")}</h1>
        ${pills([tx("Visão geral", "Overview"), tx("Força", "Strength"), "Volume", "PRs", tx("Revisão", "Review")], 0)}
        <div class="b-week">
          <div><b>1 <i>${tx("de", "of")} 3</i></b><small>${tx("sessões nesta semana", "sessions this week")}</small></div>
          <div><b>13 <i>${tx("de", "of")} 39</i></b><small>${tx("séries de trabalho", "working sets")}</small></div>
          <div class="b-week__bar"><i class="on"></i><i></i><i></i></div>
        </div>
        <h2 class="b-h2">${tx("Precisa de atenção", "Needs attention")}</h2>
        ${att}
        <h2 class="b-h2">${tx("Força neste bloco", "Strength this block")}</h2>
        ${lifts}
      </div>`;
    return { body, over: dock("progress") };
  }

  function chart(U) {
    const S = T.squatSeries();
    const i = U.pt == null ? S.length - 1 : U.pt;
    const p = S[i];
    const W = 328, H = 230, padL = 8, padR = 8, padT = 24, padB = 26, ymin = 108, ymax = 130;
    const x = (j) => padL + 10 + (j * (W - padL - padR - 20)) / (S.length - 1);
    const y = (v) => padT + (1 - (v - ymin) / (ymax - ymin)) * (H - padT - padB);
    let g = "";
    for (const t of [110, 120, 130]) g += `<line x1="0" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="ch-grid"/><text x="${W}" y="${y(t) - 4}" class="ch-ax" text-anchor="end">${t}</text>`;
    const bi = S.findIndex((s) => s.block);
    g += `<rect x="${x(bi) - 10}" y="${padT - 14}" width="${W - x(bi) + 10}" height="${H - padB - padT + 14}" class="ch-band"/>`;
    g += `<line x1="${x(i)}" x2="${x(i)}" y1="${padT - 14}" y2="${H - padB}" class="ch-cursor"/>`;
    g += `<path d="${S.map((s, j) => (j ? "L" : "M") + x(j) + " " + y(s.e1rm)).join(" ")}" class="ch-line ch-line--b"/>`;
    S.forEach((s, j) => { g += `<circle cx="${x(j)}" cy="${y(s.e1rm)}" r="${j === i ? 6 : 3.5}" class="ch-pt${j === i ? " ch-pt--live" : s.block ? "" : " ch-pt--old"}"/><rect x="${x(j) - 16}" y="0" width="32" height="${H}" class="ch-hit" data-pt="${j}"/>`; });
    g += `<text x="${x(bi) - 4}" y="${H - 8}" class="ch-ax">${T.tx("Bloco atual", "Current block")}</text>`;
    const rows = S.slice(-4).reverse().map((s) => `<div class="b-hrow"><span>${date.short(s.date)}</span><b>${num(s.top)} × ${s.topReps}</b><span>${num(s.e1rm, 1)}</span></div>`).join("");
    const body = `
      <div class="b-pg">
        <div class="b-top"><button class="b-icb" data-go="progress" aria-label="${tx("Voltar", "Back")}">${ic("chev", "rot-r")}</button>${pills([tx("Bloco", "Block"), tx("Tudo", "All")], 1)}</div>
        <div class="b-ex">${art("sq", "b-art--l")}<h1 class="b-exname">${nm("sq")}</h1></div>
        <div class="b-read"><b>${num(p.e1rm, 1)} <i>kg</i></b><small>e1RM, ${date.short(p.date)}, ${tx("maior série", "top set")} ${num(p.top)} × ${p.topReps}</small></div>
        <svg class="chart chart--b" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx("e1RM por sessão. Toque em um ponto para ler.", "e1RM by session. Tap a point to read it.")}">${g}</svg>
        <p class="b-soft b-hint">${tx("Toque em um ponto para ler a sessão.", "Tap a point to read that session.")}</p>
        <h2 class="b-h2">${tx("Sessões recentes", "Recent sessions")}</h2>
        ${rows}
      </div>`;
    return { body, over: dock("progress") };
  }

  /* ---------------- History ---------------- */
  function cal() {
    const on = T.SESSIONS.filter((s) => s.date >= "2026-09-01").map((s) => T.date.day(s.date));
    const head = tx("STQQSSD", "MTWTFSS").split("").map((c) => `<span class="b-cal__h">${c}</span>`).join("");
    let cells = "";
    // September 2026 starts on a Tuesday; the grid starts on Monday.
    cells += `<span class="b-cal__d is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="b-cal__d${on.includes(d) ? " is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="b-cal__d is-out">${d}</span>`;
    return `<div class="b-cal">${head}${cells}</div>`;
  }

  function history() {
    const list = T.SESSIONS.filter((s) => s.date >= "2026-09-07").slice().reverse().map((s) => {
      const t = T.sessionTotals(s), p = T.prs(s.date).length;
      return `<button class="b-sess" data-go="${s.date === T.TODAY ? "session" : "history"}"><span class="b-sess__d"><small>${date.wd(s.date)}</small><b>${date.day(s.date)}</b></span><span class="b-sess__m"><b>${T.two(T.PROGRAM.days[s.day].name)}</b><small>${t.sets} ${tx("séries", "sets")}, ${num(t.vol, 0)} kg</small></span>${p ? `<span class="b-pr__tag">${p} PR${p > 1 ? "s" : ""}</span>` : ""}${ic("chev", "rot-l")}</button>`;
    }).join("");
    const body = `
      <div class="b-pg">
        <div class="b-top"><h1 class="b-title">${tx("Histórico", "History")}</h1><button class="b-icb" aria-label="${tx("Buscar sessões", "Search sessions")}">${ic("search")}</button></div>
        <div class="b-month"><button class="b-icb">${ic("chev", "rot-r")}</button><b>${tx("Setembro", "September")}</b><button class="b-icb">${ic("chev", "rot-l")}</button></div>
        ${cal()}
        <p class="b-soft b-center">${tx("9 sessões, 117 séries", "9 sessions, 117 sets")}</p>
        ${list}
      </div>`;
    return { body, over: dock("history") };
  }

  function session() {
    const base = history();
    const iso = T.TODAY, s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), prs = T.prs(iso);
    const lifts = Object.keys(s.lifts).map((k) => `<div class="b-slift">${art(k, "b-art--s")}<div><b>${nm(k)}${prs.find((p) => p.k === k) ? ` <span class="b-pr__tag">PR</span>` : ""}</b><div class="b-chips">${s.lifts[k].map((st) => `<span>${num(st[0])} × ${st[1]}<i>RIR ${st[2]}</i></span>`).join("")}</div></div></div>`).join("");
    const sheet = `<div class="scrim" data-go="history"></div>
      <section class="b-sheet b-sheet--tall" role="dialog">
        <div class="grab"></div>
        <div class="b-sheet__head"><div><h2 class="b-sheet__t">${T.two(T.PROGRAM.days[s.day].name)}</h2><p class="b-soft">${date.long(iso)}, ${t.sets} ${tx("séries", "sets")}, ${num(t.vol, 0)} kg</p></div><button class="b-icb" data-go="history">${ic("close")}</button></div>
        <div class="b-sheet__scroll">${lifts}</div>
        <div class="b-two"><button class="b-sec b-sec--danger">${tx("Excluir", "Delete")}</button><button class="b-sec">${ic("pencil")}${tx("Editar", "Edit")}</button></div>
      </section>`;
    return { body: base.body, over: base.over + sheet };
  }

  /* ---------------- Program ---------------- */
  function program(U) {
    const di = U.day || 0, d = T.PROGRAM.days[di];
    const rows = d.lifts.map((k) => `<div class="b-row">${art(k)}<div class="b-row__m"><b>${nm(k)}</b><small>${T.EX[k].n} ${tx("séries", "sets")}, ${K.range(k)} reps</small></div><div class="b-row__v"><b>${num(di === 0 ? T.TODAY_REC[k].load : T.NEXT[k].load)}</b><small>kg</small></div></div>`).join("");
    const body = `
      <div class="b-pg">
        <div class="b-top"><span class="b-soft">${tx("Programa", "Program")}</span><button class="b-link">${tx("Editar", "Edit")}</button></div>
        <h1 class="b-hero b-hero--m">${T.two(T.PROGRAM.name)}</h1>
        <p class="b-lede">${T.two(T.PROGRAM.goal)}, ${tx("3 dias por semana", "3 days per week")}</p>
        <div class="b-status"><b>${tx("No caminho certo", "On track")}</b><span>${tx("3 de 3 sessões nos últimos 7 dias. Semana 4 de 6, iniciado em 31 ago.", "3 of 3 sessions in the last 7 days. Week 4 of 6, started Aug 31.")}</span></div>
        <h2 class="b-h2">${T.two(d.name)}<span class="b-soft">${T.muList(T.dayMuscles(di).slice(0, 3))}</span></h2>
        <div class="b-list">${rows}</div>
      </div>`;
    const seg = `<div class="b-thumb b-thumb--seg"><div class="b-seg">${T.PROGRAM.days.map((x, i) => `<button class="${i === di ? "is-on" : ""}" data-day="${i}">${T.two(x.name)}</button>`).join("")}</div></div>`;
    return { body, over: seg + dock("program"), cls: "b-has-thumb" };
  }

  root.DIR_B = {
    key: "b", name: "Um polegar", en: "One thumb",
    idea: "Designed at arm's length: read in the top half, act in the bottom third, every control within reach of one thumb.",
    screens: { today, workout, why, rest, workout2, summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program },
    notes: {
      today: "Start sits right above the dock, in the thumb's arc. Other days are one tap away as chips, not a second screen.",
      workout: "The dock gives way to an action shelf: tap a figure, then press the big pads. Figures are sized to read from the bench.",
      why: "A half sheet in plain sentences, closed from the bottom.",
      rest: "Rest takes the whole screen: the countdown reads from across the rack, and the next set is already stated.",
      summary: "Records first, then what the next session asks, with the actions on the shelf.",
      summary2: "Without records the page starts at the next session's targets.",
      progress: "Attention items are full-width targets with the verdict first; lifts show their block change large.",
      chart: "One large readout driven by the chart: tap any point to read that session.",
      history: "A compact month you can hit with a thumb, then big session rows.",
      session: "A session opens as a sheet over the list, with Edit and Delete at the bottom.",
      program: "The day switcher moves to the bottom, next to the thumb.",
    },
  };
})(window);
