/* Direction C: Evidência (evidence).
   The engine made visible. Every recommendation is drawn next to the record
   that produced it: rep-range tracks, before-and-after pairs and an evidence
   chain replace paragraphs. Flat cards on paper; orange marks the target. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT;
  const { tx, nm, num, kg, date } = T;
  const { ic, mark } = K;

  const art = (k, cls = "") => `<span class="c-art ${cls}" style="--art-bg:${T.EX[k].bg}"><img src="${T.EX[k].art}" alt="" loading="lazy"></span>`;
  const verd = (st) => `<span class="c-verd c-verd--${st}">${mark(st)}${K.verdict(st)}</span>`;

  function dock(active, live) {
    const items = [["today", "home", tx("Hoje", "Today")], ["progress", "stats", tx("Progresso", "Progress")], ["history", "history", tx("Histórico", "History")], ["program", "program", tx("Programa", "Program")]];
    return `<nav class="c-dock">${items.map(([id, i, l]) => `<button class="c-dock__b${id === active ? " is-on" : ""}" data-go="${id}">${ic(i)}<span>${l}</span></button>`).join("")}</nav>`;
  }

  /* Rep-range track. lanes: [{label, dots:[reps], ring, pin}] drawn on one rep axis. */
  function track(k, lanes, opts = {}) {
    const [lo, hi] = T.EX[k].r;
    const a = lo - 1, b = hi + 2;
    const W = 300, laneH = opts.laneH || 26, top = 4, labW = opts.labels ? 74 : 0;
    const H = top + lanes.length * laneH + 18;
    const x = (v) => labW + 8 + ((v - a) / (b - a)) * (W - labW - 16);
    let g = `<rect x="${x(lo)}" y="${top}" width="${x(hi) - x(lo)}" height="${lanes.length * laneH}" rx="6" class="tr-band"/>`;
    for (let v = a; v <= b; v++) {
      g += `<line x1="${x(v)}" x2="${x(v)}" y1="${top + lanes.length * laneH}" y2="${top + lanes.length * laneH + 4}" class="tr-tick"/>`;
      if (v === lo || v === hi || v === b || v === a || (opts.all && true)) g += `<text x="${x(v)}" y="${H - 2}" text-anchor="middle" class="tr-num${v === lo || v === hi ? " tr-num--b" : ""}">${v}</text>`;
    }
    lanes.forEach((ln, i) => {
      const cy = top + i * laneH + laneH / 2;
      if (opts.labels) g += `<text x="0" y="${cy + 4}" class="tr-lab">${ln.label}</text>`;
      if (ln.ring != null) g += `<circle cx="${x(ln.ring)}" cy="${cy}" r="6.5" class="tr-ring"/>`;
      const counts = {};
      (ln.dots || []).forEach((d) => {
        const n = (counts[d] = (counts[d] || 0) + 1);
        g += `<circle cx="${x(d) + (n - 1) * 8 - ((ln.dots.filter((z) => z === d).length - 1) * 8) / 2}" cy="${cy}" r="3.6" class="tr-dot"/>`;
      });
      if (ln.pin != null) g += `<path d="M${x(ln.pin)} ${cy - (ln.dots && ln.dots.includes(ln.pin) ? 5 : -5)} l-6 -10 h12 z" class="tr-pin"/>`;
    });
    return `<svg class="track" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
  }

  /* ---------------- Today ---------------- */
  function today() {
    const day = T.PROGRAM.days[0];
    const cards = day.lifts.map((k) => {
      const r = T.TODAY_REC[k], prev = T.previousOf(k, T.TODAY);
      const load = r.status === "up" ? `<span class="c-step"><s>${num(r.from)}</s>${ic("arrow")}<b>${kg(r.load)}</b></span>` : `<span class="c-step"><b>${kg(r.load)}</b></span>`;
      const note = r.status === "stalled" ? `<p class="c-note">${tx("Três sessões com 10 kg sem reps novas. Use uma carga menor por uma sessão, ou adicione uma série.", "Three sessions at 10 kg without new reps. Use a lighter load for one session, or add one set.")}</p>` : "";
      return `<article class="c-card">
        <div class="c-card__h">${art(k)}<div class="c-card__n"><b>${nm(k)}</b>${verd(r.status)}</div></div>
        <div class="c-card__row">${load}<span class="c-reps">${T.EX[k].n} × ${r.reps} reps</span></div>
        ${track(k, [{ dots: prev.sets.map((s) => s[1]), pin: r.reps }])}
        <p class="c-legend"><i class="lg-dot"></i>${date.short(prev.date)}<i class="lg-pin"></i>${tx("meta de hoje", "today's target")}</p>
        ${note}
      </article>`;
    }).join("");
    const body = `
      <div class="c-pg">
        <div class="c-top"><span class="c-soft">${date.long(T.TODAY)}</span><button class="c-icb" aria-label="${tx("Ajustes", "Settings")}">${ic("gear")}</button></div>
        <h1 class="c-h1">${T.two(day.name)}</h1>
        <p class="c-lede">${tx("Semana 4 de 6. O que muda hoje:", "Week 4 of 6. What changes today:")}</p>
        <div class="c-tally"><span>${mark("up")}<b>2</b> ${tx("sobem", "go up")}</span><span>${mark("hold")}<b>2</b> ${tx("mantêm", "hold")}</span><span>${mark("stalled")}<b>1</b> ${tx("travado", "stalled")}</span></div>
        ${cards}
      </div>`;
    return { body, over: `<div class="c-sticky"><button class="c-cta" data-go="workout">${tx("Começar treino", "Start workout")}${ic("arrow", "c-cta__ar")}</button></div>${dock("today")}`, cls: "c-has-sticky" };
  }

  /* ---------------- Workout ---------------- */
  function wtop(live, U) {
    return `<div class="c-wtop">
      <button class="c-icb" data-go="today">${ic("chev")}</button>
      <div class="c-wtop__c"><b>${tx("Dia 1", "Day 1")}</b><span>${tx("1 de 5", "1 of 5")}</span></div>
      <button class="c-pill${live ? " is-live" : ""}" data-go="rest">${ic("timer")}${live ? K.fmtTime(U.rest) : "2:00"}</button>
      <button class="c-icb">${ic("more")}</button>
    </div>
    <div class="c-seg5"><i class="now"></i><i></i><i></i><i></i><i></i></div>`;
  }

  function inputs(U) {
    const g = (f, label, v, step) => `<div class="c-in${U.field === f ? " is-sel" : ""}" data-field="${f}"><small>${label}</small><b>${v}</b><div class="c-in__b"><button data-act="dec" data-f="${f}" aria-label="−${step}">${ic("minus")}</button><button data-act="inc" data-f="${f}" aria-label="+${step}">${ic("plus")}</button></div></div>`;
    return `<div class="c-ins">${g("load", tx("Carga, kg", "Load, kg"), num(U.load), 2.5)}${g("reps", "Reps", U.reps, 1)}${g("rir", "RIR", U.rir, 1)}</div>`;
  }

  function workoutBody(U, resting) {
    const rec = T.TODAY_REC.sq, prev = T.previousOf("sq", T.TODAY);
    return `${wtop(resting, U)}
      <div class="c-pg c-pg--w">
        <div class="c-exh">${art("sq", "c-art--m")}<div><h1 class="c-exname">${nm("sq")}</h1><p class="c-soft">${T.EX.sq.n} × ${K.range("sq")} reps, RIR 0–${T.PROGRAM.rirHigh}</p></div></div>
        <div class="c-verdict">
          <div class="c-verdict__t">${mark(resting ? "hold" : "up")}<span>${resting ? tx("Série 2: ", "Set 2: ") + K.cue({ status: "hold", load: T.SQUAT_SET2.load, reps: T.SQUAT_SET2.reps }) : K.cue(rec)}</span></div>
          ${track("sq", [
            { label: `${date.short(prev.date)}, 100`, dots: prev.sets.map((s) => s[1]), ring: rec.capReps },
            { label: `${tx("hoje", "today")}, ${num(rec.load)}`, ring: rec.capAtTarget, pin: rec.reps },
          ], { labels: true, laneH: 30 })}
          <p class="c-legend"><i class="lg-dot"></i>${tx("reps feitas", "reps done")}<i class="lg-ring"></i>${tx("capacidade", "capacity")}<i class="lg-pin"></i>${tx("meta", "target")}</p>
          <button class="c-why" data-go="why">${tx("Ver o raciocínio", "See the reasoning")}${ic("chev", "rot-l")}</button>
        </div>
        <div class="c-setstrip">${resting ? `<span class="done">${ic("check")}1</span><span class="now">${tx("Série 2", "Set 2")}</span><span>3</span>` : `<span class="now">${tx("Série 1", "Set 1")}</span><span>2</span><span>3</span>`}</div>
        ${inputs(U)}
      </div>`;
  }

  function workout(U) {
    return { body: workoutBody(U, false), over: `<div class="c-sticky c-sticky--w"><button class="c-cta" data-go="rest">${tx("Registrar série 1", "Log set 1")}</button></div>`, cls: "no-dock c-has-sticky" };
  }

  /* ---------------- Why ---------------- */
  function why(U) {
    const rec = T.TODAY_REC.sq, prev = T.previousOf("sq", T.TODAY);
    const sq = T.SESSIONS.filter((s) => s.lifts.sq && s.date < T.TODAY).map((s) => T.best(s.lifts.sq));
    const node = (label, value, note, cls = "") => `<li class="c-node ${cls}"><small>${label}</small><b${cls.includes("t") && !cls.includes("end") ? ` class="c-node__t"` : ""}>${value}</b>${note ? `<p>${note}</p>` : ""}</li>`;
    const sheet = `<div class="scrim" data-go="workout"></div>
      <section class="c-sheet" role="dialog" aria-label="${tx("Por que essa carga", "Why this weight")}">
        <div class="grab"></div>
        <div class="c-sheet__h"><h2>${tx("Por que essa carga", "Why this weight")}</h2><button class="c-icb" data-go="workout">${ic("close")}</button></div>
        <ol class="c-chain">
          ${node(tx("Última sessão", "Last session") + ", " + date.short(prev.date), prev.sets.map((s) => `${num(s[0])} × ${s[1]}`).join("  "), `RIR ${prev.sets.map((s) => s[2]).join(", ")}`)}
          ${node(tx("Capacidade mostrada", "Capacity shown"), `≈ ${rec.capReps} reps ${tx("com", "at")} 100 kg`, tx("Reps mais RIR, contando até 4 RIR.", "Reps plus RIR, counting up to 4 RIR."))}
          ${node(tx("Regra da faixa 4–8", "Range rule, 4–8"), tx("Topo da faixa atingido", "Range top reached"), tx("Todas as séries chegaram a 8. A carga sobe.", "Every set reached 8. The load goes up."), "t")}
          ${node(tx("Nova carga", "New load"), `100 + ${num(2.5)}% → ${kg(rec.load)}`, tx("Arredondado para o passo de 2,5 kg.", "Rounded to the nearest 2.5 kg step."))}
          ${node(tx("Meta de reps", "Rep target"), `≈ ${rec.capAtTarget} − ${rec.typRir} RIR = ${rec.reps} reps`, tx("Capacidade na nova carga menos seu RIR habitual.", "Capacity at the new load minus your usual RIR."))}
          ${node(tx("Hoje", "Today"), `${kg(rec.load)} × ${rec.reps}`, "", "c-node--end")}
        </ol>
        <div class="c-ctx">${K.sparkline(sq, 72, 26)}<p>${tx("Neste bloco a força subiu em 3 sessões. Mantenha o programa atual.", "Strength rose across 3 sessions in this block. Keep the current program.")}</p></div>
      </section>`;
    return { body: workoutBody(U, false), over: sheet, cls: "no-dock" };
  }

  /* ---------------- Rest ---------------- */
  function rest(U) {
    const p = 1 - Math.max(0, U.rest) / U.restTotal;
    const sheet = `<section class="c-sheet c-sheet--rest" role="dialog" aria-label="${tx("Timer de descanso", "Rest timer")}">
        <div class="grab"></div>
        <div class="c-sheet__h"><h2>${tx("Descanso", "Rest")}</h2><button class="c-icb" data-go="workout">${ic("close")}</button></div>
        <div class="c-clock"><b role="timer">${K.fmtTime(U.rest)}</b><span>${U.rest > 0 ? tx("restantes de", "left of") + " " + K.fmtTime(U.restTotal) : tx("Descanso concluído.", "Rest done.")}</span></div>
        <div class="c-ttrack"><i style="width:${(p * 100).toFixed(1)}%"></i><em style="left:${(p * 100).toFixed(1)}%"></em></div>
        <div class="c-ttrack__l"><span>0:00</span><span>1:00</span><span>2:00</span></div>
        <div class="c-rctl"><button data-act="rest-30">−30 s</button><button data-act="rest-pause">${ic(U.running ? "pause" : "play")}</button><button data-act="rest+30">+30 s</button><button data-act="rest-skip">${tx("Pular", "Skip")}</button></div>
        <div class="c-next">
          <p><small>${tx("A seguir", "Next")}</small><b>${tx("Série 2", "Set 2")}: ${kg(T.SQUAT_SET2.load)}, ${tx("meta", "target")} ${T.SQUAT_SET2.reps} reps</b></p>
          ${track("sq", [{ dots: [7], ring: 7.5, pin: T.SQUAT_SET2.reps }])}
          <p class="c-legend"><i class="lg-dot"></i>${tx("série 1", "set 1")}<i class="lg-ring"></i>${tx("capacidade", "capacity")}<i class="lg-pin"></i>${tx("meta da série 2", "set 2 target")}</p>
          <p class="c-note">${tx("A série 1 mostrou capacidade de cerca de 7,5 reps com 102,5 kg. Com a queda habitual de cerca de 1% por série, a meta da série 2 continua em 7.", "Set 1 showed a capacity of about 7.5 reps at 102.5 kg. With your usual drop of about 1% per set, the set 2 target stays at 7.")}</p>
        </div>
      </section>`;
    return { body: workoutBody(U, true), over: sheet, cls: "no-dock" };
  }

  /* ---------------- Summary ---------------- */
  function slope(a, b) {
    const W = 54, H = 28, lo = Math.min(a, b), hi = Math.max(a, b), span = Math.max(hi - lo, hi * 0.04);
    const y = (v) => 5 + (1 - (v - (lo + hi) / 2 + span / 2) / span) * (H - 10);
    return `<svg class="c-slope" viewBox="0 0 ${W} ${H}" aria-hidden="true"><line x1="6" x2="${W - 6}" y1="${y(a)}" y2="${y(b)}"/><circle cx="6" cy="${y(a)}" r="3" class="o"/><circle cx="${W - 6}" cy="${y(b)}" r="3.5"/></svg>`;
  }

  function summary(U, iso) {
    const s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), prs = T.prs(iso);
    const lifts = Object.keys(s.lifts).map((k) => {
      const o = T.outcome(k, iso);
      return `<div class="c-lift">${slope(o.from, o.to)}<div class="c-lift__m"><b>${nm(k)}</b><small>e1RM ${num(o.from, 1)} → ${num(o.to, 1)}</small></div><span class="c-out c-out--${o.kind}">${K.outcomeWord(o.kind)}</span></div>`;
    }).join("");
    const ms = T.muscles(iso).slice(0, 8), max = 4;
    const bars = ms.map(([m, v]) => `<div class="c-bar"><span>${T.mu(m)}</span><i style="width:${(v / max) * 100}%"></i><b>${num(v)}</b></div>`).join("");
    const next = Object.keys(s.lifts).map((k) => { const n = T.NEXT[k]; return `<div class="c-nrow">${mark(n.status)}<span>${nm(k)}</span><b>${n.status === "up" ? `${num(n.from)} → ` : ""}${num(n.load)} × ${n.reps}</b></div>`; }).join("");
    const body = `
      <div class="c-pg">
        <p class="c-soft">${tx("Sessão salva", "Session saved")}</p>
        <h1 class="c-h1">${T.two(T.PROGRAM.days[s.day].name)}</h1>
        <p class="c-lede">${date.long(iso)}</p>
        <div class="c-figs"><div><b>${t.sets}</b><small>${tx("séries", "sets")}</small></div><div><b>${num(t.vol, 0)}</b><small>${tx("kg movimentados", "kg moved")}</small></div><div><b>${prs.length || t.lifts}</b><small>${prs.length ? tx("recordes", "records") : tx("exercícios", "exercises")}</small></div></div>
        <h2 class="c-h2">${tx("Como cada exercício mudou", "How each lift moved")}</h2>
        <div class="c-box">${lifts}</div>
        ${prs.length ? `<h2 class="c-h2">${tx("Recordes pessoais", "Personal records")}</h2><div class="c-box">${prs.map((p) => `<div class="c-prrow"><span class="c-prtag">PR</span><span>${nm(p.k)}</span><b>${num(p.load)} × ${p.reps}</b><small>${K.prLine(p)}</small></div>`).join("")}</div>` : ""}
        <h2 class="c-h2">${tx("Na próxima vez", "Next time")}</h2>
        <div class="c-box">${next}</div>
        <h2 class="c-h2">${tx("Séries efetivas por músculo", "Hard sets by muscle")}</h2>
        <p class="c-soft c-small">${tx("Trabalho direto conta 1, secundário conta 0,5.", "Direct work counts 1, secondary counts 0.5.")}</p>
        <div class="c-bars">${bars}</div>
      </div>`;
    return { body, over: `<div class="c-sticky c-sticky--w"><button class="c-cta" data-go="today">${tx("Concluir", "Done")}</button></div>`, cls: "no-dock c-has-sticky" };
  }

  /* ---------------- Progress ---------------- */
  const tabs = (items, on) => `<div class="c-tabs">${items.map((l, i) => `<button class="${i === on ? "is-on" : ""}">${l}</button>`).join("")}</div>`;

  function progress() {
    const ev = (kind, n) => `<span class="c-ev">${kind === "trend" ? tx("Tendência", "Trend") : tx("Comparação", "Comparison")}, ${n} ${tx("sessões", "sessions")}</span>`;
    const group = (st, count, items) => `<div class="c-grp"><div class="c-grp__h">${verd(st)}<span class="c-soft">${count}</span></div>${items}</div>`;
    const item = (k, why, e) => `<button class="c-item"><div><b>${nm(k)}</b><small>${why}</small></div>${e}</button>`;
    const lifts = ["sq", "pr", "hg", "pd", "hk", "lp"].map((k) => { const b = T.blockChange(k); return `<button class="c-trow" data-go="${k === "sq" ? "chart" : "progress"}"><span>${nm(k)}</span>${K.sparkline(b.series, 60, 22)}<b>${K.pct(b.pct)}</b></button>`; }).join("");
    const body = `
      <div class="c-pg">
        <h1 class="c-h1">${tx("Progresso", "Progress")}</h1>
        ${tabs([tx("Visão geral", "Overview"), tx("Força", "Strength"), "Volume", "PRs", tx("Revisão", "Review")], 0)}
        <div class="c-week">
          <div class="c-week__r"><span>${tx("Sessões", "Sessions")}</span><div class="c-cells">${[1, 2, 3].map((i) => `<i class="${i === 1 ? "on" : ""}"></i>`).join("")}</div><b>1/3</b></div>
          <div class="c-week__r"><span>${tx("Séries", "Sets")}</span><div class="c-meter"><i style="width:${(13 / 39) * 100}%"></i></div><b>13/39</b></div>
          <p class="c-soft c-small">${tx("Semana 4 de 6 em andamento.", "Week 4 of 6 in progress.")}</p>
        </div>
        <h2 class="c-h2">${tx("Precisa de atenção", "Needs attention")}</h2>
        ${group("up", 1, item("lp", tx("Topo da faixa em todas as séries. 170 → 175 kg.", "Top of range on every set. 170 → 175 kg."), ev("comparison", 2)))}
        ${group("stalled", 1, item("rw", tx("Três sessões com 55 kg sem reps novas.", "Three sessions at 55 kg without new reps."), ev("trend", 4)))}
        ${group("recover", 2, item("lcl", tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move."), ev("comparison", 2)) + item("tr", tx("Séries pesadas, mas as reps não subiram.", "Hard sets, but reps did not move."), ev("comparison", 2)))}
        <h2 class="c-h2">${tx("Tendência de força no bloco", "Strength trend this block")}</h2>
        <div class="c-box">${lifts}</div>
      </div>`;
    return { body, over: dock("progress") };
  }

  function chart() {
    const S = T.squatSeries();
    const events = S.filter((s, i) => i && s.block && S[i - 1].block && s.top > S[i - 1].top).map((s) => {
      const i = S.indexOf(s);
      return `<div class="c-evrow"><span class="c-soft">${date.short(s.date)}</span><span>${mark("up")}${num(S[i - 1].top)} → ${kg(s.top)}</span><small>${tx("topo da faixa na sessão anterior", "range top in the previous session")}</small></div>`;
    }).reverse().join("");
    const body = `
      <div class="c-pg">
        <button class="c-back" data-go="progress">${ic("chev", "rot-r")}${tx("Progresso", "Progress")}</button>
        <div class="c-exh">${art("sq", "c-art--m")}<h1 class="c-exname">${nm("sq")}</h1></div>
        ${tabs([tx("Bloco atual", "Current block"), tx("Todo o histórico", "All history")], 1)}
        <div class="c-figs c-figs--4"><div><b>${num(Math.max(...S.map((s) => s.e1rm)), 1)}</b><small>${tx("melhor e1RM", "best e1RM")}</small></div><div><b>${num(102.5)}</b><small>${tx("maior carga", "top load")}</small></div><div><b>${K.pct(T.blockChange("sq").pct)}</b><small>${tx("no bloco", "this block")}</small></div></div>
        <div class="c-chart">${K.squatChart({ h: 210, band: true, steps: true, events: true })}</div>
        <p class="c-legend c-legend--chart"><i class="lg-line"></i>e1RM<i class="lg-step"></i>${tx("maior carga", "top load")}<i class="lg-ev"></i>${tx("carga subiu", "load went up")}</p>
        <h2 class="c-h2">${tx("Por que a carga mudou", "Why the load changed")}</h2>
        <div class="c-box">${events}<div class="c-evrow c-evrow--next"><span class="c-soft">${tx("Próxima", "Next")}</span><span>${mark("hold")}${kg(102.5)} × 8</span><small>${tx("A faixa ainda tem espaço: a carga fica e as reps sobem.", "The range still has room: the load stays while reps climb.")}</small></div></div>
      </div>`;
    return { body, over: dock("progress") };
  }

  /* ---------------- History ---------------- */
  function history() {
    const rows = T.SESSIONS.filter((s) => s.date >= "2026-09-07").slice().reverse().map((s) => {
      const t = T.sessionTotals(s);
      const strip = Object.keys(s.lifts).map((k) => { const o = T.outcome(k, s.date); return `<i class="o-${o.kind}" title="${nm(k)}">${o.kind === "improved" ? ic("arrow", "mk-up") : o.kind === "declined" ? ic("arrow", "mk-down") : ic("equal")}</i>`; }).join("");
      return `<button class="c-sess" data-go="${s.date === T.TODAY ? "session" : "history"}"><div class="c-sess__h"><b>${T.two(T.PROGRAM.days[s.day].name)}</b><span class="c-soft">${date.wd(s.date)}, ${date.short(s.date)}</span></div><div class="c-sess__r"><span class="c-ostrip">${strip}</span><span class="c-soft">${t.sets} ${tx("séries", "sets")}, ${num(t.vol, 0)} kg</span></div></button>`;
    }).join("");
    const on = T.SESSIONS.filter((s) => s.date >= "2026-09-01").map((s) => T.date.day(s.date));
    let cells = `<span class="is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="${on.includes(d) ? "is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="is-out">${d}</span>`;
    const body = `
      <div class="c-pg">
        <div class="c-top"><h1 class="c-h1">${tx("Histórico", "History")}</h1><button class="c-icb">${ic("search")}</button></div>
        <div class="c-month"><button class="c-icb">${ic("chev", "rot-r")}</button><b>${tx("Setembro de 2026", "September 2026")}</b><button class="c-icb">${ic("chev", "rot-l")}</button></div>
        <div class="c-cal">${tx("STQQSSD", "MTWTFSS").split("").map((c) => `<em>${c}</em>`).join("")}${cells}</div>
        <p class="c-legend c-legend--hist"><i class="o-improved">${ic("arrow", "mk-up")}</i>${tx("melhorou", "improved")}<i class="o-maintained">${ic("equal")}</i>${tx("manteve", "held")}<i class="o-declined">${ic("arrow", "mk-down")}</i>${tx("regrediu", "declined")}</p>
        ${rows}
      </div>`;
    return { body, over: dock("history") };
  }

  function session() {
    const iso = T.TODAY, s = T.SESSIONS.find((x) => x.date === iso), t = T.sessionTotals(s), prs = T.prs(iso);
    const lifts = Object.keys(s.lifts).map((k) => {
      const o = T.outcome(k, iso), prev = T.previousOf(k, iso), pr = prs.find((p) => p.k === k);
      return `<article class="c-card c-card--s">
        <div class="c-card__n c-card__n--row"><b>${nm(k)}</b><span class="c-out c-out--${o.kind}">${K.outcomeWord(o.kind)}</span></div>
        <div class="c-cmp"><span class="c-soft">${date.short(prev.date)}</span><span class="c-mono">${K.setsLine(prev.sets)}</span><span class="c-soft">${tx("hoje", "today")}</span><span class="c-mono c-ink">${K.setsLine(s.lifts[k])}</span></div>
        ${pr ? `<p class="c-prline"><span class="c-prtag">PR</span>${K.prLine(pr)}</p>` : ""}
      </article>`;
    }).join("");
    const body = `
      <div class="c-pg">
        <button class="c-back" data-go="history">${ic("chev", "rot-r")}${tx("Histórico", "History")}</button>
        <h1 class="c-h1">${T.two(T.PROGRAM.days[s.day].name)}</h1>
        <p class="c-lede">${date.long(iso)}, ${t.sets} ${tx("séries", "sets")}, ${num(t.vol, 0)} kg</p>
        ${lifts}
        <div class="c-actions"><button class="c-sec">${ic("pencil")}${tx("Editar", "Edit")}</button><button class="c-danger">${tx("Excluir sessão", "Delete session")}</button></div>
      </div>`;
    return { body, over: dock("history") };
  }

  /* ---------------- Program ---------------- */
  function program() {
    const days = T.PROGRAM.days.map((d, di) => {
      const rows = d.lifts.map((k) => {
        const n = di === 0 ? T.TODAY_REC[k] : T.NEXT[k];
        return `<div class="c-prow">${art(k, "c-art--s")}<div><b>${nm(k)}</b><small>${T.EX[k].n} × ${K.range(k)}, ${tx("faixa, passo 2,5%", "range, 2.5% step")}</small></div><span class="c-prow__n">${mark(n.status)}${num(n.load)}</span></div>`;
      }).join("");
      return `<article class="c-card c-card--day"><div class="c-day__h"><b>${T.two(d.name)}</b><span class="c-soft">${T.muList(T.dayMuscles(di).slice(0, 3))}</span></div>${rows}</article>`;
    }).join("");
    const body = `
      <div class="c-pg">
        <div class="c-top"><span class="c-soft">${tx("Programa", "Program")}</span><button class="c-link">${tx("Editar", "Edit")}</button></div>
        <h1 class="c-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="c-lede">${T.two(T.PROGRAM.goal)}, ${tx("3 dias por semana", "3 days per week")}</p>
        <div class="c-week c-week--prog">
          <div class="c-week__r"><span>${tx("Semana", "Week")}</span><div class="c-cells c-cells--6">${[1, 2, 3, 4, 5, 6].map((i) => `<i class="${i < 4 ? "done" : i === 4 ? "on" : ""}"></i>`).join("")}</div><b>4/6</b></div>
          <p class="c-soft c-small">${tx("No caminho certo: 3 de 3 sessões nos últimos 7 dias. Iniciado em 31 ago.", "On track: 3 of 3 sessions in the last 7 days. Started Aug 31.")}</p>
        </div>
        <p class="c-legend">${mark("up")}${tx("sobe", "goes up")}${mark("hold")}${tx("mantém", "holds")}${mark("stalled")}${tx("travado", "stalled")}${mark("recover")}${tx("recuperar", "recover")}</p>
        ${days}
      </div>`;
    return { body, over: dock("program") };
  }

  root.DIR_C = {
    key: "c", name: "Evidência", en: "Evidence",
    idea: "Every number carries its proof: the engine's answer leads, and the record that produced it is drawn beside it, not written out.",
    screens: { today, workout, why, rest, summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program },
    notes: {
      today: "Leads with what changes today. Each lift draws last session's reps against today's target on its rep range.",
      workout: "Two lanes on one rep axis: what 100 kg showed, and what 102,5 kg asks. The reasoning is one tap away.",
      why: "The recommendation as a chain of evidence, from the logged sets to today's target.",
      rest: "A short sheet that also explains the next set: why its target is one rep lower.",
      summary: "Each lift as a before and after slope, then records, next targets and hard sets as plain bars.",
      summary2: "Holds and declines use the same slope, so the session still reads as evidence.",
      progress: "Attention grouped by verdict, each item labelled with how much evidence backs it.",
      chart: "e1RM and top load together, with every load increase marked and explained below.",
      history: "Each session row shows how every lift moved against its previous session.",
      session: "Each lift compares its sets with the previous session's.",
      program: "Each slot shows its progression rule and what the engine asks next.",
    },
  };
})(window);
