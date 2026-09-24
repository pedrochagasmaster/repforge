/* Direction E: Bloco (the block).
   The six-week block is the page. Weeks are columns on every screen, so a
   lift's progress reads across one row: what each week logged, where today
   sits, and what comes next. Built on D's data layer and system rules. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT, D = root.DX, X = root.KITD;
  const { s, n, num, kg } = D;
  const date = T.date;
  const { ic } = K;
  const { mark, MAIN, MIXD } = X;
  const U_ = "kg";

  D.register({
    "e.wk": ["S{n}", "W{n}"],
    "e.wk_long": ["Semana {n}", "Week {n}"],
    "e.col.week": ["Semana", "Week"],
    "e.today": ["hoje", "today"],
    "e.next": ["próxima", "next"],
    "e.block_line": ["{program} · semana {n} de {total}", "{program} · week {n} of {total}"],
    "e.grid_note": ["Cada coluna é uma semana do bloco: maior série registrada e, na semana {n}, a prescrição de hoje.", "Each column is a week of the block: the top set logged and, in week {n}, today's prescription."],
    "e.col.before": ["Antes", "Before"],
    "e.col.today": ["Hoje", "Today"],
    "e.col.next": ["Próxima", "Next"],
    "e.why.weeks": ["Semana a semana", "Week by week"],
    "e.why.weeks_note": ["A decisão usa a semana {n}. As anteriores mostram a tendência do bloco.", "The decision uses week {n}. Earlier weeks show the block's trend."],
    "e.history.block": ["Bloco atual · semana {n} de {total}", "Current block · week {n} of {total}"],
    "e.history.ahead": ["Semanas {a} e {b} ainda não começaram.", "Weeks {a} and {b} have not started."],
    "e.history.free": ["Livre", "Open"],
    "e.progress.matrix": ["O bloco por exercício", "The block by lift"],
    "e.progress.matrix_meta": ["maior carga, kg", "top load, kg"],
    "e.program.note": ["Cargas registradas por semana. A semana {n} mostra a próxima carga do Taurifer.", "Loads logged each week. Week {n} shows Taurifer's next load."],
  });

  /* ---------- the block for one lift ---------- */
  // Top set of each logged week inside the block.
  function weeks(k, uptoIso, inclusive) {
    const out = {};
    for (const d of D.sessionsOf(k)) {
      if (d < D.CONTEXT.blockStart || (inclusive ? d > uptoIso : d >= uptoIso)) continue;
      const sets = D.loggedSets(k, d);
      const top = sets.reduce((a, b) => (b.load > a.load || (b.load === a.load && b.reps > a.reps) ? b : a));
      out[X.weekOf(d)] = { date: d, sets, top };
    }
    return out;
  }
  const wk = (i) => n("e.wk", { n: i });

  // One row of week cells. focus = the week that holds today's prescription.
  function grid(k, ctx, r, opts = {}) {
    const past = weeks(k, ctx.iso, false);
    const cols = [];
    let cells = "";
    for (let i = 1; i <= 6; i++) {
      if (i === ctx.week) {
        cols.push("1.75fr");
        cells += `<span class="e-c e-c--now${r.glyph === "manual" ? " is-manual" : ""}"${X.tgt(r)}><b>${num(r.load)}</b><small>${r.target}</small></span>`;
      } else if (past[i]) {
        cols.push("1fr");
        cells += `<span class="e-c"><b>${num(past[i].top.load)}</b><small>× ${past[i].top.reps}</small></span>`;
      } else {
        cols.push(i < ctx.week ? "1fr" : ".55fr");
        cells += `<span class="e-c e-c--empty" aria-hidden="true">–</span>`;
      }
    }
    return `<div class="e-grid${opts.head ? " e-grid--head" : ""}" style="grid-template-columns:${cols.join(" ")}">${cells}</div>`;
  }
  function gridHead(ctx) {
    const cols = [], cells = [];
    for (let i = 1; i <= 6; i++) {
      cols.push(i === ctx.week ? "1.75fr" : i < ctx.week ? "1fr" : ".55fr");
      cells.push(`<span class="${i === ctx.week ? "is-now" : ""}">${i === ctx.week ? `${wk(i)} · ${n("e.today")}` : wk(i)}</span>`);
    }
    return `<div class="e-ghead" aria-hidden="true" style="grid-template-columns:${cols.join(" ")}">${cells.join("")}</div>`;
  }

  /* ---------------- Today ---------------- */
  function today(U, ctx = MAIN) {
    const recs = ctx.lifts.map((k) => D.rec(k, ctx.iso));
    const sets = recs.reduce((t, r) => t + (r.manual ? r.manual.sets : r.sets.length), 0);
    const rows = recs.map((r) => {
      const stalled = r.glyph === "stalled" ? `<small>${s("rec.stalled.text").split(". ")[0]}.</small>` : "";
      const custom = D.lift(r.k).custom ? `<small>${n("d.sub.custom")}</small>` : "";
      return `<div class="e-lift">
        <p class="e-lift__n">${mark(r.glyph)}<span>${D.name(r.k)}${stalled}${custom}</span><em>${r.glyph === "manual" ? s("program.progression.strategy.manual") : r.label}</em></p>
        ${grid(r.k, ctx, r)}
      </div>`;
    }).join("");
    const tally = D.tally(recs).map((t) => `<span class="e-tally__i">${mark(t.glyph)}${t.text}</span>`).join("");
    const body = `
      <div class="e-pg">
        <div class="e-top"><span class="e-date">${date.long(ctx.iso)}</span><div class="e-top__r"><button class="e-textbtn" data-sheet="days">${s("today.choose_day")}</button><button class="e-icb" aria-label="${n("d.settings")}">${ic("gear")}</button></div></div>
        <h1 class="e-h1">${T.two(ctx.dayName)}</h1>
        <p class="e-lede">${n("e.block_line", { program: T.two(T.PROGRAM.name), n: ctx.week, total: 6 })} · ${n("d.rx.meta", { lifts: recs.length, sets })}</p>
        <p class="e-tally">${tally}</p>
        <div class="e-block">
          ${gridHead(ctx)}
          ${rows}
        </div>
        <p class="e-note">${n("e.grid_note", { n: ctx.week })}</p>
        <div class="e-split">
          <div><span class="e-k">${s("today.this_week")}</span><span class="e-v">${n("d.week_line", { done: ctx.done, planned: 3 })}</span></div>
          <div><span class="e-k">${s("today.up_next")}</span><span class="e-v">${T.two(ctx.next)}</span></div>
        </div>
      </div>`;
    const cta = `<div class="x-ctabar"><button class="x-cta" data-go="${ctx === MIXD ? "workout-mixed" : "workout"}">${s("today.start")}${ic("arrow", "x-cta__ar")}</button></div>`;
    const days = U.sheet === "days" ? daySheet() : "";
    return { body, over: cta + X.dock("today") + days, cls: "x-has-cta" };
  }
  function daySheet() {
    const rows = T.PROGRAM.days.map((d, i) => `<button class="e-opt${i === 0 ? " is-on" : ""}" data-sheet="" aria-pressed="${i === 0}"><span><b>${T.two(d.name)}</b><small>${T.muList(T.dayMuscles(i).slice(0, 3))}</small></span>${i === 0 ? `<em>${s("today.choose_day_current")}</em>` : ""}</button>`).join("");
    return X.sheet({ title: s("today.choose_day_title"), close: "today", body: `<h2 class="e-sheet__t">${s("today.choose_day_title")}</h2><p class="e-sheet__sub">${s("today.choose_day_sub")}</p><div class="e-opts">${rows}</div><button class="x-sec" data-go="today">${s("today.choose_day_confirm")}</button>` });
  }

  /* ---------------- Workout and rest ---------------- */
  function header(ctx, idx, U, resting) {
    const running = resting && U.rest > 0;
    return `<div class="e-wtop">
      <button class="e-icb" data-go="${ctx === MIXD ? "today-mixed" : "today"}" aria-label="${n("d.back_today")}">${ic("chev")}</button>
      <p class="e-wtop__c">${n("d.head.day_ex", { day: T.two(ctx.dayName), n: idx + 1, m: ctx.lifts.length })}</p>
      <button class="e-icb e-timer${running ? " is-live" : ""}" data-sheet="timer" aria-label="${n("d.timer")}">${ic("timer")}${running ? `<span>${X.fmtTime(U.rest)}</span>` : ""}</button>
      <button class="e-icb" data-sheet="actions" aria-label="${n("d.more")}">${ic("more")}</button>
    </div>
    <div class="e-prog" aria-hidden="true">${ctx.lifts.map((_, i) => `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")}</div>`;
  }

  function focusBody(U, ctx, k, phase) {
    const idx = ctx.lifts.indexOf(k), r = D.rec(k, ctx.iso), resting = phase === "rest";
    const s2 = resting ? D.rec(k, ctx.iso, "today", X.SET1) : null;
    const pd = D.previousDate(k, ctx.iso), prev = pd ? D.loggedSets(k, pd) : [];
    const prevWeek = pd ? X.weekOf(pd) : null;
    const whyGo = ctx === MIXD ? { ht: "why-repgoal", dl: "why-anchor", cp: "why-manual" }[k] || "why" : "why";
    const tg = X.targets(resting ? s2 : r);
    const rows = X.targets(r).map((t, i) => {
      const p = prev[i];
      const before = p ? `${num(p.load)} × ${p.reps}<i>${D.hasEffort(p) ? `RIR ${num(p.rir)}` : n("d.short.missing-effort")}</i>` : "–";
      let st = "queued", now;
      if (resting && i === 0) { st = "done"; now = `${num(102.5)} × 7<i>RIR 1</i>`; }
      else if ((resting && i === 1) || (!resting && i === 0)) { st = "open"; now = `${num(U.load)} × ${U.reps}<i>RIR ${U.rir}</i>`; }
      else { const q = resting ? tg[0] : t; now = `${num(q.load)} × ${q.reps}${q.rir ? `<i>RIR ${q.rir}</i>` : ""}`; }
      const inner = `<span class="e-set__n">${st === "done" ? ic("check") : t.label}</span><span class="e-set__b">${before}</span><span class="e-set__t">${now}</span>`;
      return st === "done" ? `<button class="e-set is-done" data-edit="${i}" aria-label="${s("focus.edit_set_aria", { n: i + 1 })}">${inner}</button>` : `<div class="e-set is-${st}">${inner}</div>`;
    }).join("");
    let cueHTML;
    const c = X.cue(r);
    const cueFor = (cc, go) => `<div class="e-cue"><p class="e-cue__l1">${cc.glyph ? mark(cc.glyph) : ""}<span>${cc.l1}</span></p><p class="e-cue__l2">${cc.l2}</p><button class="e-why" data-go="${go}">${s("why.open")}</button></div>`;
    if (resting) {
      const p = Math.max(0, U.rest) / U.restTotal;
      cueHTML = U.rest > 0
        ? `<div class="e-rest" role="timer"><div class="e-rest__row"><span>${n("d.rest.label")}</span><b>${X.fmtTime(U.rest)}</b><em>${n("d.rest.of", { t: X.fmtTime(U.restTotal) })}</em></div><div class="e-rest__bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div></div>
          <p class="e-nextcue">${n("d.rest.next", { n: 2, load: num(s2.load), reps: s2.reps })} <button class="e-why e-why--in" data-go="why-set2">${n("d.why_short")}</button></p>`
        : `<p class="e-restdone">${ic("check")}${n("d.rest.done")}</p>` + cueFor(X.cue(s2), "why-set2");
    } else cueHTML = cueFor(c, whyGo);
    const nextK = ctx.lifts[idx + 1];
    const note = T.EX[k] && T.EX[k].note ? `<p class="e-note2">${ic("note")}<span>${T.two(T.EX[k].note)}</span></p>` : "";
    return `${header(ctx, idx, U, resting)}
      <div class="e-pg e-pg--w">
        <div class="e-exh">${X.art(k)}<div><h1 class="e-exname">${D.name(k)}</h1><p class="e-exmeta">${X.exMeta(k)}</p></div></div>
        <div class="e-block e-block--one">${gridHead(ctx)}${grid(k, ctx, r)}</div>
        ${cueHTML}
        ${note}
        <div class="e-scols" aria-hidden="true"><span>${n("d.col.set")}</span><span>${prevWeek ? n("e.wk_long", { n: prevWeek }) : n("e.col.before")}</span><span>${n("e.wk_long", { n: ctx.week })}</span></div>
        ${rows}
        ${nextK ? `<button class="e-next"><span>${n("d.next_row", { name: `<b>${D.name(nextK)}</b>` })}</span>${ic("chev", "rot-l")}</button>` : ""}
      </div>`;
  }
  function focusScreen(U, ctx, k, phase) {
    const resting = phase === "rest";
    const setNo = U.correct != null ? U.correct + 1 : resting ? 2 : 1;
    let over = X.shelf(U, { setNo, correcting: U.correct != null, resting });
    if (U.sheet === "timer") over += timerSheet(U, resting ? "rest" : "workout");
    if (U.sheet === "actions") over += actionsSheet(resting ? "rest" : "workout");
    return { body: focusBody(U, ctx, k, phase), over, cls: "no-dock x-has-shelf" };
  }
  function timerSheet(U, back) {
    const presets = [60, 90, 120, 180].map((t) => `<button class="${t === U.restTotal ? "is-on" : ""}" aria-pressed="${t === U.restTotal}" aria-label="${s("rest.sheet.preset_aria", { time: X.fmtTime(t) })}">${X.fmtTime(t)}</button>`).join("");
    return X.sheet({ title: s("rest.sheet.title"), close: back, body: `<h2 class="e-sheet__t">${s("rest.sheet.title")}</h2><div class="e-presets">${presets}</div><div class="e-presets e-presets--ctl"><button>${s("rest.sheet.minus")}</button><button>${s("rest.sheet.plus")}</button><button>${s("rest.sheet.reset")}</button><button>${s("rest.sheet.stop")}</button></div>` });
  }
  function actionsSheet(back) {
    const item = (icn, key) => `<button class="e-act">${ic(icn)}<span>${s(key)}</span></button>`;
    return X.sheet({ title: s("ex.actions.title"), close: back, body: `<h2 class="e-sheet__t">${s("ex.actions.title")}</h2><div class="e-acts">${item("note", "ex.actions.open_notes")}${item("reset", "ex.actions.substitute")}${item("skip", "ex.actions.skip")}${item("sheet", "program.editor.reorder")}${item("check", "log.finish")}</div>` });
  }

  /* ---------------- Why ---------------- */
  function whySheet(U, k, iso, variant, back, ctx) {
    const P = X.whyParts(k, iso, variant, U, "e");
    // Week by week: every week of the block this lift has logged, with the capacity each showed.
    const past = weeks(k, iso, variant === "set2");
    const decided = variant === "set2" ? X.weekOf(iso) : D.previousDate(k, iso) ? X.weekOf(D.previousDate(k, iso)) : null;
    const wrows = Object.keys(past).map(Number).sort((a, b) => a - b).map((w) => {
      const sets = variant === "set2" && w === X.weekOf(iso) ? X.SET1 : past[w].sets;
      const rirs = "RIR " + sets.map((x) => (D.hasEffort(x) ? num(x.rir) : "–")).join(", ");
      return `<div class="e-wrow${w === decided ? " is-used" : ""}"><span>${n("e.wk_long", { n: w })}</span><span class="e-mono">${D.setsLine(sets)}</span><span class="e-mono e-soft">${rirs}</span></div>`;
    }).join("");
    const weeksBlock = wrows && D.strategyOf(k) !== "manual" ? `<p class="e-wtitle">${n("e.why.weeks")}</p><div class="e-wrows">${wrows}</div><p class="e-wnote">${n("e.why.weeks_note", { n: decided })}</p>` : "";
    const body = `<p class="e-sheet__eyebrow">${s("why.title")}</p>
      <h2 class="e-sheet__cue">${P.noMark ? "" : mark(P.glyph)}<span>${P.w.head}</span></h2>
      ${weeksBlock}
      <div class="e-reasons">${P.blocks}</div>
      ${P.calc}
      ${P.evidence ? `<p class="e-evidence">${P.evidence}</p>` : ""}
      <button class="x-sec" data-go="${back}">${n("d.why.ok")}</button>`;
    return X.sheet({ title: s("why.title"), close: back, body });
  }
  const why = (U) => ({ body: focusBody(U, MAIN, "sq", "set1"), over: X.shelf(U, { setNo: 1 }) + whySheet(U, "sq", T.TODAY, null, "workout"), cls: "no-dock x-has-shelf" });
  const whySet2 = (U) => ({ body: focusBody(U, MAIN, "sq", "rest"), over: whySheet(U, "sq", T.TODAY, "set2", "rest"), cls: "no-dock x-has-shelf" });
  const whyMix = (k) => (U) => ({ body: focusBody(U, MIXD, k, "set1"), over: X.shelf(U, { setNo: 1 }) + whySheet(U, k, MIXD.iso, null, "workout-mixed"), cls: "no-dock x-has-shelf" });

  /* ---------------- Summary ---------------- */
  function summary(U, iso, mix) {
    const sn = D.session(iso, mix), prs = D.prsFor(iso, mix), wkN = X.weekOf(iso);
    const first = sn.lifts.every((k) => !D.previousDate(k, iso));
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), nx = D.rec(k, iso, "next");
      const pd = D.previousDate(k, iso);
      const cur = D.loggedSets(k, iso), top = cur.reduce((a, b) => (b.load > a.load || (b.load === a.load && b.reps > a.reps) ? b : a));
      const ptop = pd ? D.loggedSets(k, pd).reduce((a, b) => (b.load > a.load || (b.load === a.load && b.reps > a.reps) ? b : a)) : null;
      return `<div class="e-sum">
        <p class="e-sum__h"><span>${D.name(k)}</span>${first ? "" : `<em class="${o.state === "insufficient" ? "is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</em>`}</p>
        <div class="e-trio${ptop ? "" : " e-trio--2"}">
          ${ptop ? `<span class="e-c"><small>${n("e.wk", { n: X.weekOf(pd) })}</small><b>${num(ptop.load)}</b><i>× ${D.loggedSets(k, pd).map((x) => x.reps).join(", ")}</i></span>` : ""}
          <span class="e-c e-c--done"><small>${n("e.wk", { n: wkN })} · ${n("e.today")}</small><b>${num(top.load)}</b><i>× ${cur.map((x) => x.reps).join(", ")}</i></span>
          <span class="e-c e-c--next"${X.tgt(nx)}><small>${n("e.wk", { n: wkN + 1 })} · ${n("e.next")}</small><b>${mark(nx.glyph)}${num(nx.load)}</b><i>${nx.strategy === "anchor_backoff" ? `× ${nx.anchor.reps} + ${nx.sets.length - 1} × ${num(nx.backoff.load)} × ${nx.backoff.reps}` : nx.strategy === "rep_goal" ? `× ${nx.sets.map((x) => x.reps).join(", ")}` : nx.manual ? `× ${nx.manual.lo}–${nx.manual.hi}` : `× ${nx.reps}`}</i></span>
        </div>
        ${pr ? `<p class="e-pr">PR · ${D.prLine(pr)}</p>` : ""}
      </div>`;
    }).join("");
    const ms = D.musclesOf(iso, mix), shown = U.musclesAll ? ms : ms.slice(0, 6);
    const weekIdx = sn.mix ? 1 : iso === T.TODAY ? 1 : 3;
    const body = `
      <div class="e-pg">
        <p class="e-eyebrow">${s("summary.eyebrow")}</p>
        <h1 class="e-h1">${T.two(sn.dayName)}</h1>
        <p class="e-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="e-totals">
          <div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div>
          <div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div>
          <div><b>${sn.lifts.length}</b><span>${n("d.totals.lifts")}</span></div>
        </div>
        ${first ? `<p class="e-baseline">${s("summary.baseline")}</p>` : ""}
        <h2 class="e-h2">${n("d.outcome.head")}</h2>
        ${groups}
        <h2 class="e-h2">${s("summary.muscles.title")}</h2>
        <div class="e-mus">${shown.map(([m, v]) => `<div><span>${D.muscle(m)}</span><b>${num(v)}</b></div>`).join("")}</div>
        ${ms.length > 6 ? `<button class="e-textbtn e-textbtn--l" data-toggle="muscles" aria-expanded="${!!U.musclesAll}">${U.musclesAll ? n("d.muscles.fewer") : n("d.muscles.all", { n: ms.length })}</button>` : ""}
        <div class="e-split">
          <div><span class="e-k">${s("today.this_week")}</span><span class="e-v">${n("d.week_line", { done: weekIdx, planned: 3 })}</span></div>
          <div><span class="e-k">${s("today.up_next")}</span><span class="e-v">${T.two(X.nextOfSession(iso, mix))}</span></div>
        </div>
      </div>`;
    return { body, over: `<div class="x-actbar"><button class="x-sec" data-go="session">${s("summary.see_session")}</button><button class="x-cta" data-go="today">${s("summary.done")}</button></div>`, cls: "no-dock x-has-act" };
  }

  /* ---------------- Progress ---------------- */
  function progress() {
    const lifts = Object.keys(T.EX);
    const att = lifts.filter((k) => D.rec(k, "2026-09-22", "next").glyph !== "hold");
    const attRows = att.map((k) => {
      const r = D.rec(k, "2026-09-22", "next"), last = D.sessionsOf(k).slice(-1)[0];
      const lastLoad = Math.max(...D.loggedSets(k, last).map((x) => x.load));
      const count = D.sessionsOf(k).filter((d) => d >= D.CONTEXT.blockStart).length;
      return `<button class="e-att" data-go="chart" data-lift="${k}">${mark(r.glyph)}<span class="e-att__m"><b>${D.name(k)}</b><span>${r.label}. ${r.text}</span><small>${n("d.progress.evidence", { kind: D.evidenceKind(count), n: count })}</small></span><span class="e-att__f">${r.load !== lastLoad ? `${num(lastLoad)}→${num(r.load)}` : num(r.load)} ${U_}${ic("chev", "rot-l")}</span></button>`;
    }).join("");
    const heads = [1, 2, 3, 4].map((w) => `<span>${n("e.wk", { n: w })}</span>`).join("");
    const matrix = lifts.map((k) => {
      const wks = weeks(k, "2026-09-22", false), last = D.sessionsOf(k).slice(-1)[0], o = D.canonicalOutcome(k, last);
      const cells = [1, 2, 3, 4].map((w) => `<span class="e-mono${wks[w] ? "" : " e-soft"}">${wks[w] ? num(wks[w].top.load) : "–"}</span>`).join("");
      return `<button class="e-mrow" data-go="chart" data-lift="${k}"><span class="e-mrow__n"><b>${D.name(k)}</b><small><span data-outcome="${o.k}@${o.iso}">${o.word}</span> · ${date.short(last)}</small></span>${cells}</button>`;
    }).join("");
    const body = `
      <div class="e-pg">
        <h1 class="e-h1 e-h1--page">${s("stats.title")}</h1>
        ${X.tabs([s("stats.overview"), s("stats.strength"), s("stats.volume"), s("stats.table.prs"), s("stats.review")], 0, s("stats.title"))}
        <div class="e-totals e-totals--2"><div><b>1<i>/3</i></b><span>${n("d.progress.sessions")}</span></div><div><b>13<i>/39</i></b><span>${n("d.progress.sets")}</span></div></div>
        <p class="e-soft e-weekline">${n("d.progress.week", { n: 4, total: 6 })}</p>
        <h2 class="e-h2">${n("d.progress.attention", { n: att.length })}</h2>
        ${attRows}
        <h2 class="e-h2 e-h2--split"><span>${n("e.progress.matrix")}</span><em>${n("e.progress.matrix_meta")}</em></h2>
        <div class="e-mhead" aria-hidden="true"><span></span>${heads}</div>
        ${matrix}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- Chart ---------------- */
  function chart(U) {
    const k = U.lift || "sq", c = X.chart(k, U), S = c.S, sel = S[c.sel];
    const last = c.vals[c.vals.length - 1], firstV = c.vals[0], dec = c.metric === "top" ? undefined : 1;
    const figs = [[num(Math.max(...c.vals), dec), c.metric === "top" ? n("d.chart.fig.top") : n("d.chart.fig.e1rm")], [(last - firstV >= 0 ? "+" : "−") + num(Math.abs(last - firstV), dec), n("d.chart.fig.change")], [S.length, n("d.chart.fig.sessions")]];
    const rows = S.map((z, i) => ({ z, i })).reverse().map(({ z, i }) => {
      const pv = i ? (c.metric === "top" ? S[i - 1].top : S[i - 1].e1rm) : null, v = c.metric === "top" ? z.top : z.e1rm;
      const dl = pv == null ? "–" : Math.abs(v - pv) < 0.05 ? "0" : (v > pv ? "+" : "−") + num(Math.abs(v - pv), dec);
      const wlabel = z.block ? n("e.wk", { n: X.weekOf(z.date) }) : date.short(z.date);
      return `<button class="e-hrow${i === c.sel ? " is-sel" : ""}${z.block ? "" : " is-old"}" data-pt="${i}" aria-pressed="${i === c.sel}"><span><b>${wlabel}</b>${z.block ? `<small>${date.short(z.date)}</small>` : ""}</span><span class="e-mono">${X.setOf(z)}</span><span class="e-mono">${num(z.e1rm, 1)}</span><span class="e-mono e-soft">${dl}</span></button>`;
    }).join("");
    const body = `
      <div class="e-pg">
        <button class="e-back" data-go="progress">${ic("chev", "rot-r")}${n("d.chart.back")}</button>
        <h1 class="e-h1 e-h1--ex">${D.name(k)}</h1>
        <div class="e-toggles">
          ${X.seg([["data-scope", "block", s("stats.scope.current_block"), U.scope !== "all"], ["data-scope", "all", s("stats.scope.all_history"), U.scope === "all"]], s("stats.scope.current_block"))}
          ${X.seg([["data-metric", "top", s("stats.metric.top_load"), c.metric === "top"], ["data-metric", "e1rm", s("stats.metric.best_e1rm"), c.metric === "e1rm"]], s("stats.metric.top_load"))}
        </div>
        <div class="e-totals">${figs.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <div class="e-chart" data-chart="${c.xs}" role="img" aria-label="${n("d.chart.aria", { metric: c.label, name: D.name(k) })}">${c.svg}</div>
        <p class="e-readout" aria-live="polite">${n("d.chart.readout", { date: date.short(sel.date), metric: c.label, value: c.metric === "top" ? num(sel.top) : num(sel.e1rm, 1), set: X.setOf(sel) })}</p>
        <div class="e-hcols" aria-hidden="true"><span>${n("e.col.week")}</span><span>${n("d.col.top_set")}</span><span>e1RM</span><span>Δ</span></div>
        ${rows}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- History: the block as weeks by days ---------------- */
  function history(U) {
    const byWeekDay = {};
    for (const x of T.SESSIONS) byWeekDay[`${X.weekOf(x.date)}-${x.day}`] = x.date;
    const dayHeads = T.PROGRAM.days.map((d) => `<span>${T.two(d.name)}</span>`).join("");
    const rows = [4, 3, 2, 1].map((w) => {
      const cells = T.PROGRAM.days.map((d, di) => {
        const iso = byWeekDay[`${w}-${di}`];
        if (!iso) return `<span class="e-hcell e-hcell--empty" aria-hidden="true">${w > 4 || (w === 4 && di > 0) ? "" : n("e.history.free")}</span>`;
        const sn = D.session(iso), p = D.prsFor(iso).length;
        return `<button class="e-hcell" data-go="${iso === T.TODAY ? "session" : "history"}" aria-label="${T.two(sn.dayName)}, ${date.long(iso)}"><small>${date.wd(iso)} ${date.day(iso)}</small><b>${n("d.history.sets", { n: sn.sets })}</b>${p ? `<em>${n(p > 1 ? "d.history.prs_many" : "d.history.prs", { n: p })}</em>` : `<i>${num(sn.vol, 0)} ${U_}</i>`}</button>`;
      }).join("");
      return `<div class="e-hweek${w === 4 ? " is-now" : ""}"><span class="e-hweek__w"><b>${n("e.wk", { n: w })}</b></span>${cells}</div>`;
    }).join("");
    const all = T.SESSIONS;
    const body = `
      <div class="e-pg">
        <div class="e-top e-top--h"><h1 class="e-h1 e-h1--page">${s("history.title")}</h1><div class="e-top__r"><button class="e-icb" aria-label="${n("d.history.search")}">${ic("search")}</button><button class="e-icb" data-sheet="cal" aria-label="${n("d.history.calendar")}">${X.calIcon()}</button></div></div>
        <p class="e-month"><b>${n("e.history.block", { n: 4, total: 6 })}</b><span>${s("history.month_summary", { sessions: all.length, sets: all.reduce((t, x) => t + T.sessionTotals(x).sets, 0) })}</span></p>
        <p class="e-ahead">${n("e.history.ahead", { a: 5, b: 6 })}</p>
        <div class="e-hhead" aria-hidden="true"><span></span>${dayHeads}</div>
        ${rows}
      </div>`;
    return { body, over: X.dock("history") + (U.sheet === "cal" ? calSheet() : "") };
  }
  function calSheet() {
    const on = T.SESSIONS.filter((x) => x.date >= "2026-09-01").map((x) => T.date.day(x.date));
    const heads = (T.state.lang === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]).map((c) => `<span class="e-cal__h">${c}</span>`).join("");
    let cells = `<span class="e-cal__d is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="e-cal__d${on.includes(d) ? " is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="e-cal__d is-out">${d}</span>`;
    const title = s("history.month_title", { month: date.month(8), year: 2026 });
    return X.sheet({ title, close: "history", body: `<div class="e-calhead"><button class="e-icb" aria-label="${s("history.calendar_prev_aria")}">${ic("chev", "rot-r")}</button><h2 class="e-sheet__t">${title}</h2><button class="e-icb" aria-label="${s("history.calendar_next_aria")}">${ic("chev", "rot-l")}</button></div><div class="e-cal">${heads}${cells}</div><p class="e-sheet__sub">${n("d.history.cal_hint")}</p>` });
  }

  /* ---------------- Session ---------------- */
  function session() {
    const iso = T.TODAY, sn = D.session(iso), prs = D.prsFor(iso);
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), pd = D.previousDate(k, iso);
      const prev = pd ? D.loggedSets(k, pd) : [];
      const rows = D.loggedSets(k, iso).map((x, i) => {
        const p = prev[i];
        return `<div class="e-set e-set--ro"><span class="e-set__n">${i + 1}</span><span class="e-set__b">${p ? `${num(p.load)} × ${p.reps}<i>RIR ${num(p.rir)}</i>` : "–"}</span><span class="e-set__t">${num(x.load)} × ${x.reps}<i>RIR ${x.rir == null ? "–" : x.rir}</i></span></div>`;
      }).join("");
      return `<div class="e-sgrp"><p class="e-sum__h"><span>${D.name(k)}</span><span class="e-tags">${pr ? `<span class="e-pr">PR</span>` : ""}<em class="${o.state === "insufficient" ? "is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</em></span></p>
        <div class="e-scols e-scols--s" aria-hidden="true"><span>${n("d.col.set")}</span><span>${pd ? n("e.wk_long", { n: X.weekOf(pd) }) : n("e.col.before")}</span><span>${n("e.wk_long", { n: sn.week })}</span></div>${rows}</div>`;
    }).join("");
    const body = `
      <div class="e-pg">
        <button class="e-back" data-go="history">${ic("chev", "rot-r")}${s("history.title")}</button>
        <h1 class="e-h1">${T.two(sn.dayName)}</h1>
        <p class="e-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="e-totals"><div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div><div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div><div><b>${prs.length}</b><span>${s("stats.metric.prs")}</span></div></div>
        ${groups}
        <div class="e-actions"><button class="x-sec">${ic("pencil")}${s("history.session.edit")}</button><button class="e-danger">${s("history.session.delete")}</button></div>
      </div>`;
    return { body, over: X.dock("history") };
  }

  /* ---------------- Program: the block plan ---------------- */
  function program() {
    const days = T.PROGRAM.days.map((d, di) => {
      const rows = d.lifts.map((k) => {
        const r = di === 0 ? D.rec(k, T.TODAY) : D.rec(k, "2026-09-22", "next");
        const ctx = { iso: di === 0 ? T.TODAY : "2026-09-22", week: 4 };
        const e = T.EX[k];
        return `<div class="e-plift"><p class="e-plift__n"><span>${D.name(k)}<small>${e.n} × ${e.r[0]}–${e.r[1]} · ${s("program.progression.strategy." + D.strategyOf(k))}</small></span></p>${grid(k, ctx, r)}</div>`;
      }).join("");
      return `<div class="e-day"><div class="e-day__h"><b>${T.two(d.name)}</b><span>${n("d.program.day_meta", { muscles: T.muList(T.dayMuscles(di).slice(0, 3)), sets: T.daySets(di) })}</span></div>${gridHead({ week: 4 }).replace(`${n("e.wk", { n: 4 })} · ${n("e.today")}`, `${n("e.wk", { n: 4 })} · ${n("e.next")}`)}${rows}</div>`;
    }).join("");
    const body = `
      <div class="e-pg">
        <div class="e-top e-top--h"><span class="e-date">${s("program.title")}</span><button class="e-textbtn">${s("program.edit")}</button></div>
        <h1 class="e-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="e-lede">${n("d.program.lede", { goal: T.two(T.PROGRAM.goal), n: 4, total: 6 })}</p>
        <p class="e-status">${n("d.program.status", { status: s("status.on_track"), n: 3, m: 3 })}</p>
        <p class="e-note">${n("e.program.note", { n: 4 })}</p>
        ${days}
      </div>`;
    return { body, over: X.dock("program") };
  }

  root.DIR_E = {
    key: "e", family: true, name: "Bloco", en: "The block",
    idea: "The six-week block is the page: weeks are columns on every screen, so each lift reads across one row, from what each week logged to today's prescription and the next target.",
    screens: {
      today: (U) => today(U, MAIN), workout: (U) => focusScreen(U, MAIN, "sq", "set1"), why, rest: (U) => focusScreen(U, MAIN, "sq", "rest"), "why-set2": whySet2,
      summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program,
      "today-mixed": (U) => today(U, MIXD), "why-repgoal": whyMix("ht"), "why-anchor": whyMix("dl"), "why-manual": whyMix("cp"),
      "summary-first": (U) => summary(U, D.MIX.first, true), "workout-mixed": (U) => focusScreen(U, MIXD, "dl", "set1"),
    },
    notes: {
      today: "Every lift is a row of six weeks: the top set each week logged, then today's load and target in the wide week-4 cell. Progress reads left to right, with no chart.",
      workout: "The lift's own block strip sits above the cue, and the ledger compares each set with the same set last week, column by column.",
      why: "Week by week first: every logged week of this lift, with the one the decision used marked. Then the shipped sentences, then the working.",
      "why-set2": "In session, the week strip ends at set 1. Observed capacity 8, predicted about 7,5 for set 2.",
      rest: "Rest takes the cue slot; the ledger keeps last week and this week side by side.",
      summary: "Each lift ends on three cells, last week, today and next week. The next target is always in the rightmost cell.",
      summary2: "Week 3's session: the trio shifts one week left. Carga alterada and Manteve come from canonicalOutcome.",
      progress: "Attention rows, then the whole block as a matrix: one row per lift, top load per week, latest canonical outcome under the name.",
      chart: "The honest chart, labelled by week inside the block and by date before it.",
      history: "History is the block itself: weeks down, training days across, each cell a session.",
      session: "Each set against the same set a week earlier.",
      program: "The program as a block plan. Week 4 shows the engine's next load in the wide cell.",
      "today-mixed": "Mixed strategies in the same grid. The week-4 cell carries each strategy's own target: 1 + 2, total 36, 3 × 10, manual in soft ink.",
      "why-repgoal": "Weeks of the rep-goal lift, then total, effort gate and split.",
      "why-anchor": "Weeks show the top set climbing 130, 132,5, 135; the rule and the 85 % back-off follow.",
      "why-manual": "Manual has no week table: the program sets the load.",
      "summary-first": "Week 1: no before cell to compare, so no outcome words; the next cell holds the engine's first targets.",
    },
  };
})(window);
