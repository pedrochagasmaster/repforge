/* Direction F: Uma folha só (one sheet).
   The session is one document at four stages. Today's prescription is the
   blank form: every set is a slot. Starting the workout makes the same page
   live, logging fills the slots, the summary is the page closed, and History
   keeps it. Nothing pages between exercises. Built on D's data layer. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT, D = root.DX, X = root.KITD;
  const { s, n, num } = D;
  const date = T.date;
  const { ic } = K;
  const { mark, MAIN, MIXD } = X;
  const U_ = "kg";

  D.register({
    "f.count": ["{done} de {total} séries", "{done} of {total} sets"],
    "f.head": ["{day} · {done} de {total} séries", "{day} · {done} of {total} sets"],
    "f.before": ["antes {sets}", "last {sets}"],
    "f.why.hide": ["Fechar a explicação", "Close the explanation"],
    "f.first_time": ["primeira vez", "first time"],
    "f.sheet_note": ["Cada caixa é uma série. Ao treinar, você preenche esta mesma folha.", "Each box is a set. When you train, you fill in this same sheet."],
    "f.program_note": ["Cada dia é a folha que você vai preencher. As cargas são as próximas do Taurifer.", "Each day is the sheet you will fill in. Loads are Taurifer's next ones."],
    "f.progress.top": ["{a}→{b} kg", "{a}→{b} kg"],
    "f.next": ["Próxima", "Next"],
  });

  const totalSets = (recs) => recs.reduce((t, r) => t + (r.manual ? r.manual.sets : r.sets.length), 0);
  const labelOf = (r, i) => (r.strategy === "anchor_backoff" && i === 0 ? "P" : String(i + 1));

  /* One slot. st: plan | now | done. v: {load, reps, rir} */
  function slot(i, st, v, label, opts = {}) {
    const rir = v.rir != null && v.rir !== "" ? `<i>RIR ${v.rir}</i>` : "";
    const inner = st === "plan"
      ? `<small>${label}</small><b class="f-slot__l">${num(v.load)}</b><i>× ${v.reps}</i>`
      : `<small>${st === "done" ? ic("check") : label}</small><b>${num(v.load)} × ${v.reps}</b>${rir}`;
    if (opts.button) return `<button class="f-slot is-${st}" data-edit="${i}" aria-label="${s("focus.edit_set_aria", { n: i + 1 })}">${inner}</button>`;
    return `<span class="f-slot is-${st}${opts.soft ? " is-soft" : ""}">${inner}</span>`;
  }
  // Planned slots straight from the engine targets.
  function planSlots(r) {
    return `<div class="f-slots"${X.tgt(r)}>${X.targets(r).map((t, i) => slot(i, "plan", { load: t.load, reps: t.reps, rir: null }, labelOf(r, i), { soft: r.glyph === "manual" })).join("")}</div>`;
  }
  const beforeLine = (k, iso) => {
    const pd = D.previousDate(k, iso);
    return pd ? n("f.before", { sets: D.setsLine(D.loggedSets(k, pd)) }) : n("f.first_time");
  };

  /* A collapsed lift on the sheet: name, verdict, slots, last time. */
  function liftBlock(r, iso, opts = {}) {
    const label = r.glyph === "manual" ? s("program.progression.strategy.manual") : r.label;
    const extra = r.strategy === "rep_goal" ? ` · ${r.target}` : "";
    return `<div class="f-lift${opts.cls ? " " + opts.cls : ""}">
      <p class="f-lift__h">${mark(r.glyph)}<span class="f-lift__n">${D.name(r.k)}${D.lift(r.k).custom ? `<small>${n("d.sub.custom")}</small>` : ""}</span><em>${label}${extra}</em></p>
      ${opts.slots || planSlots(r)}
      <p class="f-before">${opts.before != null ? opts.before : beforeLine(r.k, iso)}</p>
    </div>`;
  }

  /* ---------------- Today: the blank sheet ---------------- */
  function today(U, ctx = MAIN) {
    const recs = ctx.lifts.map((k) => D.rec(k, ctx.iso));
    const tally = D.tally(recs).map((t) => `<span class="f-tally__i">${mark(t.glyph)}${t.text}</span>`).join("");
    const body = `
      <div class="f-pg">
        <div class="f-top"><span class="f-date">${date.long(ctx.iso)}</span><div class="f-top__r"><button class="f-textbtn" data-sheet="days">${s("today.choose_day")}</button><button class="f-icb" aria-label="${n("d.settings")}">${ic("gear")}</button></div></div>
        <h1 class="f-h1">${T.two(ctx.dayName)}</h1>
        <p class="f-lede">${n("d.lede_week", { program: T.two(T.PROGRAM.name), n: ctx.week, total: 6 })}</p>
        <div class="f-sheethead"><span class="f-count">${n("f.count", { done: 0, total: totalSets(recs) })}</span><span class="f-tally">${tally}</span></div>
        <div class="f-sheet">${recs.map((r) => liftBlock(r, ctx.iso)).join("")}</div>
        <p class="f-note">${n("f.sheet_note")}</p>
        <div class="f-split">
          <div><span class="f-k">${s("today.this_week")}</span><span class="f-v">${n("d.week_line", { done: ctx.done, planned: 3 })}</span></div>
          <div><span class="f-k">${s("today.up_next")}</span><span class="f-v">${T.two(ctx.next)}</span></div>
        </div>
      </div>`;
    const cta = `<div class="x-ctabar"><button class="x-cta" data-go="${ctx === MIXD ? "workout-mixed" : "workout"}">${s("today.start")}${ic("arrow", "x-cta__ar")}</button></div>`;
    return { body, over: cta + X.dock("today") + (U.sheet === "days" ? daySheet() : ""), cls: "x-has-cta" };
  }
  function daySheet() {
    const rows = T.PROGRAM.days.map((d, i) => `<button class="f-opt${i === 0 ? " is-on" : ""}" data-sheet="" aria-pressed="${i === 0}"><span><b>${T.two(d.name)}</b><small>${T.muList(T.dayMuscles(i).slice(0, 3))}</small></span>${i === 0 ? `<em>${s("today.choose_day_current")}</em>` : ""}</button>`).join("");
    return X.sheet({ title: s("today.choose_day_title"), close: "today", body: `<h2 class="f-sheet__t">${s("today.choose_day_title")}</h2><p class="f-sheet__sub">${s("today.choose_day_sub")}</p><div class="f-opts">${rows}</div><button class="x-sec" data-go="today">${s("today.choose_day_confirm")}</button>` });
  }

  /* ---------------- The live sheet: workout, rest and why ---------------- */
  // Inline explanation band: F never opens a sheet for Why.
  function whyBand(U, k, iso, variant, back) {
    const P = X.whyParts(k, iso, variant, U, "f");
    return `<div class="f-whyband" role="region" aria-label="${s("why.title")}">
      <p class="f-whyband__t">${s("why.title")}</p>
      <div class="f-reasons">${P.blocks}</div>
      ${P.calc}
      ${P.evidence ? `<p class="f-evidence">${P.evidence}</p>` : ""}
      <button class="f-whyclose" data-go="${back}">${n("f.why.hide")}</button>
    </div>`;
  }

  function liveSheet(U, ctx, cur, phase, whyVariant) {
    const resting = phase === "rest";
    const recs = ctx.lifts.map((k) => D.rec(k, ctx.iso));
    const total = totalSets(recs), done = resting ? 1 : 0;
    const back = ctx === MIXD ? "workout-mixed" : resting ? "rest" : "workout";
    const whyGo = ctx === MIXD ? { ht: "why-repgoal", dl: "why-anchor", cp: "why-manual" }[cur] || "why" : "why";
    const blocks = recs.map((r) => {
      if (r.k !== cur) return liftBlock(r, ctx.iso, { cls: "is-later" });
      const s2 = resting ? D.rec(cur, ctx.iso, "today", X.SET1) : null;
      const tg = X.targets(r);
      const slots = tg.map((t, i) => {
        if (resting && i === 0) return slot(0, "done", { load: 102.5, reps: 7, rir: 1 }, "1", { button: true });
        if ((resting && i === 1) || (!resting && i === 0)) return slot(i, "now", { load: U.load, reps: U.reps, rir: U.rir }, labelOf(r, i));
        const q = resting ? X.targets(s2)[0] : t;
        return slot(i, "plan", { load: q.load, reps: q.reps }, labelOf(r, i), { soft: true });
      }).join("");
      const c = X.cue(resting ? s2 : r);
      let cueHTML;
      if (resting && U.rest > 0) {
        const p = Math.max(0, U.rest) / U.restTotal;
        cueHTML = `<div class="f-rest" role="timer"><div class="f-rest__row"><span>${n("d.rest.label")}</span><b>${X.fmtTime(U.rest)}</b><em>${n("d.rest.of", { t: X.fmtTime(U.restTotal) })}</em></div><div class="f-rest__bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
          <p class="f-nextcue">${n("d.rest.next", { n: 2, load: num(s2.load), reps: s2.reps })} <button class="f-why f-why--in" data-go="why-set2">${n("d.why_short")}</button></p></div>`;
      } else {
        cueHTML = `${resting ? `<p class="f-restdone">${ic("check")}${n("d.rest.done")}</p>` : ""}<div class="f-cue"><p class="f-cue__l1">${c.glyph ? mark(c.glyph) : ""}<span>${c.l1}</span></p><p class="f-cue__l2">${c.l2}</p>${whyVariant !== undefined ? "" : `<button class="f-why" data-go="${resting ? "why-set2" : whyGo}">${s("why.open")}</button>`}</div>`;
      }
      const band = whyVariant !== undefined ? whyBand(U, cur, ctx.iso, whyVariant, back) : "";
      const note = T.EX[cur] && T.EX[cur].note ? `<p class="f-exnote">${ic("note")}<span>${T.two(T.EX[cur].note)}</span></p>` : "";
      return `<div class="f-lift f-lift--now">
        <span class="f-nowbar x-seg-now" aria-hidden="true"></span>
        <div class="f-exh">${X.art(cur)}<div><h1 class="f-exname">${D.name(cur)}</h1><p class="f-exmeta">${X.exMeta(cur)}</p></div></div>
        ${resting && whyVariant !== undefined ? `<p class="f-nextcue f-nextcue--top">${n("d.rest.next", { n: 2, load: num(s2.load), reps: s2.reps })}</p>` : cueHTML}
        ${band}
        ${note}
        <div class="f-slots">${slots}</div>
        <p class="f-before">${beforeLine(cur, ctx.iso)}</p>
      </div>`;
    }).join("");
    const running = resting && U.rest > 0;
    const head = `<div class="f-wtop">
      <button class="f-icb" data-go="${ctx === MIXD ? "today-mixed" : "today"}" aria-label="${n("d.back_today")}">${ic("chev")}</button>
      <p class="f-wtop__c">${n("f.head", { day: T.two(ctx.dayName), done, total })}</p>
      <button class="f-icb f-timer${running ? " is-live" : ""}" data-sheet="timer" aria-label="${n("d.timer")}">${ic("timer")}${running ? `<span>${X.fmtTime(U.rest)}</span>` : ""}</button>
      <button class="f-icb" data-sheet="actions" aria-label="${n("d.more")}">${ic("more")}</button>
    </div>
    <div class="f-meter" aria-hidden="true"><i style="width:${((done / total) * 100).toFixed(1)}%"></i></div>`;
    return `${head}<div class="f-pg f-pg--w"><div class="f-sheet">${blocks}</div></div>`;
  }

  function live(U, ctx, cur, phase, whyVariant) {
    const resting = phase === "rest";
    const setNo = U.correct != null ? U.correct + 1 : resting ? 2 : 1;
    let over = X.shelf(U, { setNo, correcting: U.correct != null, resting });
    if (U.sheet === "timer") over += timerSheet(U, resting ? "rest" : "workout");
    if (U.sheet === "actions") over += actionsSheet(resting ? "rest" : "workout");
    return { body: liveSheet(U, ctx, cur, phase, whyVariant), over, cls: "no-dock x-has-shelf" };
  }
  function timerSheet(U, back) {
    const presets = [60, 90, 120, 180].map((t) => `<button class="${t === U.restTotal ? "is-on" : ""}" aria-pressed="${t === U.restTotal}" aria-label="${s("rest.sheet.preset_aria", { time: X.fmtTime(t) })}">${X.fmtTime(t)}</button>`).join("");
    return X.sheet({ title: s("rest.sheet.title"), close: back, body: `<h2 class="f-sheet__t">${s("rest.sheet.title")}</h2><div class="f-presets">${presets}</div><div class="f-presets f-presets--ctl"><button>${s("rest.sheet.minus")}</button><button>${s("rest.sheet.plus")}</button><button>${s("rest.sheet.reset")}</button><button>${s("rest.sheet.stop")}</button></div>` });
  }
  function actionsSheet(back) {
    const item = (icn, key) => `<button class="f-act">${ic(icn)}<span>${s(key)}</span></button>`;
    return X.sheet({ title: s("ex.actions.title"), close: back, body: `<h2 class="f-sheet__t">${s("ex.actions.title")}</h2><div class="f-acts">${item("note", "ex.actions.open_notes")}${item("reset", "ex.actions.substitute")}${item("skip", "ex.actions.skip")}${item("sheet", "program.editor.reorder")}${item("check", "log.finish")}</div>` });
  }

  /* ---------------- Summary: the sheet closed ---------------- */
  function doneSlots(k, iso) {
    return `<div class="f-slots">${D.loggedSets(k, iso).map((x, i) => slot(i, "done", { load: x.load, reps: x.reps, rir: x.rir == null ? "–" : num(x.rir) }, String(i + 1))).join("")}</div>`;
  }
  function summary(U, iso, mix) {
    const sn = D.session(iso, mix), prs = D.prsFor(iso, mix);
    const first = sn.lifts.every((k) => !D.previousDate(k, iso));
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), nx = D.rec(k, iso, "next");
      return `<div class="f-lift">
        <p class="f-lift__h f-lift__h--sum"><span class="f-lift__n">${D.name(k)}</span>${first ? "" : `<em class="f-out${o.state === "insufficient" ? " is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</em>`}</p>
        ${doneSlots(k, iso)}
        ${pr ? `<p class="f-pr">PR · ${D.prLine(pr)}</p>` : ""}
        <p class="f-next"${X.tgt(nx)}>${mark(nx.glyph)}<span>${n("d.next_target", { target: nx.next })}</span></p>
      </div>`;
    }).join("");
    const ms = D.musclesOf(iso, mix), shown = U.musclesAll ? ms : ms.slice(0, 6);
    const weekIdx = sn.mix ? 1 : iso === T.TODAY ? 1 : 3;
    const body = `
      <div class="f-pg">
        <p class="f-eyebrow">${s("summary.eyebrow")}</p>
        <h1 class="f-h1">${T.two(sn.dayName)}</h1>
        <p class="f-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="f-totals"><div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div><div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div><div><b>${sn.lifts.length}</b><span>${n("d.totals.lifts")}</span></div></div>
        ${first ? `<p class="f-baseline">${s("summary.baseline")}</p>` : ""}
        <h2 class="f-h2">${n("d.outcome.head")}</h2>
        <div class="f-sheet">${groups}</div>
        <h2 class="f-h2">${s("summary.muscles.title")}</h2>
        <div class="f-mus">${shown.map(([m, v]) => `<div><span>${D.muscle(m)}</span><b>${num(v)}</b></div>`).join("")}</div>
        ${ms.length > 6 ? `<button class="f-textbtn f-textbtn--l" data-toggle="muscles" aria-expanded="${!!U.musclesAll}">${U.musclesAll ? n("d.muscles.fewer") : n("d.muscles.all", { n: ms.length })}</button>` : ""}
        <div class="f-split"><div><span class="f-k">${s("today.this_week")}</span><span class="f-v">${n("d.week_line", { done: weekIdx, planned: 3 })}</span></div><div><span class="f-k">${s("today.up_next")}</span><span class="f-v">${T.two(X.nextOfSession(iso, mix))}</span></div></div>
      </div>`;
    return { body, over: `<div class="x-actbar"><button class="x-sec" data-go="session">${s("summary.see_session")}</button><button class="x-cta" data-go="today">${s("summary.done")}</button></div>`, cls: "no-dock x-has-act" };
  }

  /* ---------------- Progress ---------------- */
  function progress() {
    const lifts = Object.keys(T.EX);
    const att = lifts.filter((k) => D.rec(k, "2026-09-22", "next").glyph !== "hold");
    const attRows = att.map((k) => {
      const r = D.rec(k, "2026-09-22", "next"), last = D.sessionsOf(k).slice(-1)[0];
      const count = D.sessionsOf(k).filter((d) => d >= D.CONTEXT.blockStart).length;
      return `<button class="f-att" data-go="chart" data-lift="${k}">
        <p class="f-lift__h">${mark(r.glyph)}<span class="f-lift__n">${D.name(k)}</span><em>${r.label}</em></p>
        <span class="f-att__why">${r.text}</span>
        <span class="f-att__row"><span class="f-slot is-done"><small>${date.short(last)}</small><b>${D.setsLine(D.loggedSets(k, last))}</b></span><span class="f-slot is-plan"><small>${n("f.next")}</small><b>${r.next.replace(" kg", "")}</b></span></span>
        <small class="f-att__ev">${n("d.progress.evidence", { kind: D.evidenceKind(count), n: count })}</small>
      </button>`;
    }).join("");
    const rows = lifts.map((k) => {
      const c = D.topLoadChange(k), last = D.sessionsOf(k).slice(-1)[0], o = D.canonicalOutcome(k, last);
      return `<button class="f-str" data-go="chart" data-lift="${k}"><span class="f-str__m"><b>${D.name(k)}</b><small><span data-outcome="${o.k}@${o.iso}">${o.word}</span> · ${date.short(last)}</small></span>${X.sparkline(c.series)}<span class="f-str__f">${n("f.progress.top", { a: num(c.from), b: num(c.to) })}</span></button>`;
    }).join("");
    const body = `
      <div class="f-pg">
        <h1 class="f-h1 f-h1--page">${s("stats.title")}</h1>
        ${X.tabs([s("stats.overview"), s("stats.strength"), s("stats.volume"), s("stats.table.prs"), s("stats.review")], 0, s("stats.title"))}
        <div class="f-totals f-totals--2"><div><b>1<i>/3</i></b><span>${n("d.progress.sessions")}</span></div><div><b>13<i>/39</i></b><span>${n("d.progress.sets")}</span></div></div>
        <p class="f-soft f-weekline">${n("d.progress.week", { n: 4, total: 6 })}</p>
        <h2 class="f-h2">${n("d.progress.attention", { n: att.length })}</h2>
        ${attRows}
        <h2 class="f-h2 f-h2--split"><span>${n("d.progress.strength")}</span><em>${s("stats.metric.top_load")}</em></h2>
        ${rows}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- Chart ---------------- */
  function chart(U) {
    const k = U.lift || "sq", c = X.chart(k, U), S = c.S, sel = S[c.sel], dec = c.metric === "top" ? undefined : 1;
    const last = c.vals[c.vals.length - 1], firstV = c.vals[0];
    const figs = [[num(Math.max(...c.vals), dec), c.metric === "top" ? n("d.chart.fig.top") : n("d.chart.fig.e1rm")], [(last - firstV >= 0 ? "+" : "−") + num(Math.abs(last - firstV), dec), n("d.chart.fig.change")], [S.length, n("d.chart.fig.sessions")]];
    const rows = S.map((z, i) => ({ z, i })).reverse().map(({ z, i }) => `<button class="f-hrow${i === c.sel ? " is-sel" : ""}${z.block ? "" : " is-old"}" data-pt="${i}" aria-pressed="${i === c.sel}"><span class="f-hrow__d">${date.short(z.date)}</span><span class="f-hrow__s">${D.setsLine(z.sets.map((x) => (Array.isArray(x) ? x : [x.load, x.reps])))}</span><span class="f-hrow__v">${c.metric === "top" ? num(z.top) : num(z.e1rm, 1)}</span></button>`).join("");
    const body = `
      <div class="f-pg">
        <button class="f-back" data-go="progress">${ic("chev", "rot-r")}${n("d.chart.back")}</button>
        <h1 class="f-h1 f-h1--ex">${D.name(k)}</h1>
        <div class="f-toggles">
          ${X.seg([["data-scope", "block", s("stats.scope.current_block"), U.scope !== "all"], ["data-scope", "all", s("stats.scope.all_history"), U.scope === "all"]], s("stats.scope.current_block"))}
          ${X.seg([["data-metric", "top", s("stats.metric.top_load"), c.metric === "top"], ["data-metric", "e1rm", s("stats.metric.best_e1rm"), c.metric === "e1rm"]], s("stats.metric.top_load"))}
        </div>
        <div class="f-totals">${figs.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <div class="f-chart" data-chart="${c.xs}" role="img" aria-label="${n("d.chart.aria", { metric: c.label, name: D.name(k) })}">${c.svg}</div>
        <p class="f-readout" aria-live="polite">${n("d.chart.readout", { date: date.short(sel.date), metric: c.label, value: c.metric === "top" ? num(sel.top) : num(sel.e1rm, 1), set: X.setOf(sel) })}</p>
        <div class="f-hcols" aria-hidden="true"><span>${s("stats.table.date")}</span><span>${s("stats.table.sets")}</span><span>${c.label}</span></div>
        ${rows}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- History: the kept sheets ---------------- */
  function history(U) {
    const sessions = T.SESSIONS.slice().reverse();
    const months = [[8, sessions.filter((x) => x.date >= "2026-09-01")], [7, sessions.filter((x) => x.date < "2026-09-01")]];
    const list = months.map(([m, xs]) => `<div class="f-mhead"><h2>${s("history.month_title", { month: date.month(m), year: 2026 })}</h2><span>${s("history.month_summary", { sessions: xs.length, sets: xs.reduce((t, x) => t + T.sessionTotals(x).sets, 0) })}</span></div>` + xs.map((x) => {
      const sn = D.session(x.date), p = D.prsFor(x.date).length;
      return `<button class="f-sess" data-go="${x.date === T.TODAY ? "session" : "history"}">
        <span class="f-sess__d"><small>${date.wd(x.date)}</small><b>${date.day(x.date)}</b></span>
        <span class="f-sess__m"><b>${T.two(sn.dayName)}</b><small>${D.name(sn.lifts[0])} ${s("summary.prs.more", { n: sn.lifts.length - 1 })}</small></span>
        <span class="f-sess__n"><span>${n("d.history.sets", { n: sn.sets })}</span><span>${num(sn.vol, 0)} ${U_}</span>${p ? `<em>${n(p > 1 ? "d.history.prs_many" : "d.history.prs", { n: p })}</em>` : ""}</span>
      </button>`;
    }).join("")).join("");
    const body = `
      <div class="f-pg">
        <div class="f-top f-top--h"><h1 class="f-h1 f-h1--page">${s("history.title")}</h1><div class="f-top__r"><button class="f-icb" aria-label="${n("d.history.search")}">${ic("search")}</button><button class="f-icb" data-sheet="cal" aria-label="${n("d.history.calendar")}">${X.calIcon()}</button></div></div>
        ${list}
      </div>`;
    return { body, over: X.dock("history") + (U.sheet === "cal" ? calSheet() : "") };
  }
  function calSheet() {
    const on = T.SESSIONS.filter((x) => x.date >= "2026-09-01").map((x) => T.date.day(x.date));
    const heads = (T.state.lang === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]).map((c) => `<span class="f-cal__h">${c}</span>`).join("");
    let cells = `<span class="f-cal__d is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="f-cal__d${on.includes(d) ? " is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="f-cal__d is-out">${d}</span>`;
    const title = s("history.month_title", { month: date.month(8), year: 2026 });
    return X.sheet({ title, close: "history", body: `<div class="f-calhead"><button class="f-icb" aria-label="${s("history.calendar_prev_aria")}">${ic("chev", "rot-r")}</button><h2 class="f-sheet__t">${title}</h2><button class="f-icb" aria-label="${s("history.calendar_next_aria")}">${ic("chev", "rot-l")}</button></div><div class="f-cal">${heads}${cells}</div><p class="f-sheet__sub">${n("d.history.cal_hint")}</p>` });
  }

  /* ---------------- Session: the same sheet, kept ---------------- */
  function session() {
    const iso = T.TODAY, sn = D.session(iso), prs = D.prsFor(iso);
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), pd = D.previousDate(k, iso);
      return `<div class="f-lift"><p class="f-lift__h f-lift__h--sum"><span class="f-lift__n">${D.name(k)}</span><span class="f-tags">${pr ? `<span class="f-pr">PR</span>` : ""}<em class="f-out${o.state === "insufficient" ? " is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</em></span></p>
        ${doneSlots(k, iso)}
        ${pd ? `<p class="f-before">${n("d.history.before", { date: date.short(pd), sets: D.setsLine(D.loggedSets(k, pd)) })}</p>` : ""}</div>`;
    }).join("");
    const body = `
      <div class="f-pg">
        <button class="f-back" data-go="history">${ic("chev", "rot-r")}${s("history.title")}</button>
        <h1 class="f-h1">${T.two(sn.dayName)}</h1>
        <p class="f-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="f-totals"><div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div><div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div><div><b>${prs.length}</b><span>${s("stats.metric.prs")}</span></div></div>
        <div class="f-sheet f-sheet--top">${groups}</div>
        <div class="f-actions"><button class="x-sec">${ic("pencil")}${s("history.session.edit")}</button><button class="f-danger">${s("history.session.delete")}</button></div>
      </div>`;
    return { body, over: X.dock("history") };
  }

  /* ---------------- Program: the blank sheets ---------------- */
  function program() {
    const days = T.PROGRAM.days.map((d, di) => {
      const recs = d.lifts.map((k) => (di === 0 ? D.rec(k, T.TODAY) : D.rec(k, "2026-09-22", "next")));
      const blocks = recs.map((r) => {
        const e = T.EX[r.k];
        return liftBlock(r, di === 0 ? T.TODAY : "2026-09-22", { before: `${e.n} × ${e.r[0]}–${e.r[1]} · ${s("program.progression.strategy." + D.strategyOf(r.k))}` });
      }).join("");
      return `<div class="f-day"><div class="f-day__h"><b>${T.two(d.name)}</b><span>${n("d.program.day_meta", { muscles: T.muList(T.dayMuscles(di).slice(0, 3)), sets: T.daySets(di) })}</span></div><div class="f-sheet">${blocks}</div></div>`;
    }).join("");
    const body = `
      <div class="f-pg">
        <div class="f-top f-top--h"><span class="f-date">${s("program.title")}</span><button class="f-textbtn">${s("program.edit")}</button></div>
        <h1 class="f-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="f-lede">${n("d.program.lede", { goal: T.two(T.PROGRAM.goal), n: 4, total: 6 })}</p>
        <p class="f-status">${n("d.program.status", { status: s("status.on_track"), n: 3, m: 3 })}</p>
        <p class="f-note">${n("f.program_note")}</p>
        ${days}
      </div>`;
    return { body, over: X.dock("program") };
  }

  root.DIR_F = {
    key: "f", family: true, name: "Uma folha só", en: "One sheet",
    idea: "Today, the workout, the summary and the history entry are one document: every set is a box on the page, you fill the boxes as you train, and the closed page is what you keep.",
    screens: {
      today: (U) => today(U, MAIN), workout: (U) => live(U, MAIN, "sq", "set1"), why: (U) => live(U, MAIN, "sq", "set1", null),
      rest: (U) => live(U, MAIN, "sq", "rest"), "why-set2": (U) => live(U, MAIN, "sq", "rest", "set2"),
      summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program,
      "today-mixed": (U) => today(U, MIXD), "why-repgoal": (U) => live(U, MIXD, "ht", "set1", null), "why-anchor": (U) => live(U, MIXD, "dl", "set1", null),
      "why-manual": (U) => live(U, MIXD, "cp", "set1", null), "summary-first": (U) => summary(U, D.MIX.first, true), "workout-mixed": (U) => live(U, MIXD, "dl", "set1"),
    },
    notes: {
      today: "The prescription is the blank sheet: one box per set, filled with the engine's load and reps. The count at the top is the whole session, 0 of 13 sets.",
      workout: "The same page, now live. The current lift opens in place with its cue; the others stay on the page below it. No paging between exercises.",
      why: "Why opens inside the sheet, under the cue, instead of covering it. Sentences first, the working one tap further.",
      "why-set2": "While resting, the explanation opens under the next cue: observed 8, predicted about 7,5.",
      rest: "Set 1's box is filled and checked; the clock sits where the cue was, and the next box is outlined.",
      summary: "The sheet closed: every box filled, the canonical outcome beside each lift, and the next target as the last line.",
      summary2: "Same page, no PR lines.",
      progress: "Attention items show last session's boxes against the next target, so the reason reads as data first.",
      chart: "The table lists each session's full sheet line, not just the top set.",
      history: "The kept sheets, by month, each row naming the lifts it holds.",
      session: "Exactly the summary's layout, read-only: the page you kept.",
      program: "Each training day is the blank sheet you will fill, with Taurifer's next loads in the boxes.",
      "today-mixed": "Every strategy fits the box: P for the anchor set, three boxes that add up to total 36, manual boxes in soft ink.",
      "why-repgoal": "The rep-goal explanation opens inside the sheet at the hip thrust.",
      "why-anchor": "The anchor explanation opens inside the sheet at the deadlift.",
      "why-manual": "One sentence: the program sets the load.",
      "summary-first": "A first sheet: the baseline sentence, filled boxes, no outcome words, and the first next targets.",
    },
  };
})(window);
