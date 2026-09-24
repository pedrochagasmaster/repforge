/* Direction G: Só o essencial (only what matters).
   Restraint as the idea. Each screen answers one question in one line per
   item: what to lift, what to lift next time, what needs attention. Every
   supporting fact (last session, the reasons, hard sets by muscle) is one
   tap away, in place. Built on D's data layer and system rules. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT, D = root.DX, X = root.KITD;
  const { s, n, num } = D;
  const date = T.date;
  const { ic } = K;
  const { mark, MAIN, MIXD } = X;
  const U_ = "kg";

  D.register({
    "g.lede": ["Semana {n} de {total} · {lifts} exercícios", "Week {n} of {total} · {lifts} exercises"],
    "g.week_line": ["Esta semana {done} de {planned} · a seguir {next}", "This week {done} of {planned} · up next {next}"],
    "g.more.one": ["Mais 1 motivo e o cálculo", "1 more reason and the working"],
    "g.more.other": ["Mais {n} motivos e o cálculo", "{n} more reasons and the working"],
    "g.less": ["Mostrar menos", "Show less"],
    "g.summary.line": ["{sets} séries · {vol} kg · {lifts} exercícios", "{sets} sets · {vol} kg · {lifts} exercises"],
    "g.muscles.show": ["Séries efetivas por músculo", "Hard sets by muscle"],
    "g.progress.line": ["{s} de {S} sessões · {w} de {W} séries de trabalho · semana {n} de {t}", "{s} of {S} sessions · {w} of {W} working sets · week {n} of {t}"],
    "g.chart.more": ["Ver as {n} sessões", "Show all {n} sessions"],
    "g.program.day": ["{n} exercícios · {sets} séries", "{n} exercises · {sets} sets"],
    "g.done_set": ["Série {n}: {load} × {reps} · RIR {rir}", "Set {n}: {load} × {reps} · RIR {rir}"],
    "g.last_set": ["Da última vez: {load} × {reps} · RIR {rir}", "Last time: {load} × {reps} · RIR {rir}"],
    "g.last_set_norir": ["Da última vez: {load} × {reps}, sem RIR", "Last time: {load} × {reps}, no RIR"],
    "g.first": ["Sem sessão anterior", "No previous session"],
    "g.detail.before": ["Da última vez, {date}", "Last time, {date}"],
    "g.progress.open": ["Ver o gráfico", "Open the chart"],
  });

  const targetText = (r) => (r.glyph === "manual" ? `${r.manual.lo}–${r.manual.hi}` : r.strategy === "rep_goal" ? r.sets.map((x) => x.reps).join("·") : r.strategy === "anchor_backoff" ? `${r.anchor.reps} + ${r.sets.length - 1}×${r.backoff.reps}` : `${r.sets.length}×${r.reps}`);

  /* ---------------- Today ---------------- */
  function today(U, ctx = MAIN) {
    const recs = ctx.lifts.map((k) => D.rec(k, ctx.iso));
    const rows = recs.map((r) => {
      const open = U.open === r.k;
      const pd = D.previousDate(r.k, ctx.iso);
      const detail = open ? `<div class="g-detail">
          <p class="g-detail__k">${pd ? n("g.detail.before", { date: date.short(pd) }) : n("g.first")}</p>
          ${pd ? `<p class="g-mono">${D.setsLine(D.loggedSets(r.k, pd), true)}</p>` : ""}
          <p class="g-detail__t">${r.text}</p>
        </div>` : "";
      return `<div class="g-item${open ? " is-open" : ""}">
        <button class="g-row" data-open="${r.k}" aria-expanded="${open}">
          ${mark(r.glyph)}
          <span class="g-row__m"><b>${D.name(r.k)}</b><small>${r.glyph === "manual" ? s("program.progression.strategy.manual") : r.label}</small></span>
          <span class="g-row__f${r.glyph === "manual" ? " is-soft" : ""}"${X.tgt(r)}><b>${num(r.load)}</b><small>${targetText(r)}</small></span>
        </button>${detail}
      </div>`;
    }).join("");
    const body = `
      <div class="g-pg">
        <div class="g-top"><span class="g-date">${date.long(ctx.iso)}</span><button class="g-icb" aria-label="${n("d.settings")}">${ic("gear")}</button></div>
        <h1 class="g-h1">${T.two(ctx.dayName)}</h1>
        <p class="g-lede">${n("g.lede", { n: ctx.week, total: 6, lifts: recs.length })}</p>
        <div class="g-list">${rows}</div>
        <p class="g-foot">${n("g.week_line", { done: ctx.done, planned: 3, next: T.two(ctx.next) })}</p>
        <button class="g-textbtn" data-sheet="days">${s("today.choose_day")}</button>
      </div>`;
    const cta = `<div class="x-ctabar"><button class="x-cta" data-go="${ctx === MIXD ? "workout-mixed" : "workout"}">${s("today.start")}${ic("arrow", "x-cta__ar")}</button></div>`;
    return { body, over: cta + X.dock("today") + (U.sheet === "days" ? daySheet() : ""), cls: "x-has-cta" };
  }
  function daySheet() {
    const rows = T.PROGRAM.days.map((d, i) => `<button class="g-opt${i === 0 ? " is-on" : ""}" data-sheet="" aria-pressed="${i === 0}"><span><b>${T.two(d.name)}</b><small>${T.muList(T.dayMuscles(i).slice(0, 3))}</small></span>${i === 0 ? `<em>${s("today.choose_day_current")}</em>` : ""}</button>`).join("");
    return X.sheet({ title: s("today.choose_day_title"), close: "today", body: `<h2 class="g-sheet__t">${s("today.choose_day_title")}</h2><p class="g-sheet__sub">${s("today.choose_day_sub")}</p><div class="g-opts">${rows}</div><button class="x-sec" data-go="today">${s("today.choose_day_confirm")}</button>` });
  }

  /* ---------------- Workout and rest ---------------- */
  function focusBody(U, ctx, k, phase) {
    const idx = ctx.lifts.indexOf(k), r = D.rec(k, ctx.iso), resting = phase === "rest";
    const s2 = resting ? D.rec(k, ctx.iso, "today", X.SET1) : null;
    const pd = D.previousDate(k, ctx.iso), prev = pd ? D.loggedSets(k, pd) : [];
    const setIdx = resting ? 1 : 0, p = prev[setIdx];
    const nSets = r.manual ? r.manual.sets : r.sets.length;
    const whyGo = ctx === MIXD ? { ht: "why-repgoal", dl: "why-anchor", cp: "why-manual" }[k] || "why" : resting ? "why-set2" : "why";
    const running = resting && U.rest > 0;
    const c = X.cue(resting ? s2 : r);
    let main;
    if (running) {
      const pct = Math.max(0, U.rest) / U.restTotal;
      main = `<div class="g-rest" role="timer"><p class="g-rest__k">${n("d.rest.label")}</p><p class="g-rest__row"><b>${X.fmtTime(U.rest)}</b><em>${n("d.rest.of", { t: X.fmtTime(U.restTotal) })}</em></p><div class="g-rest__bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div></div>
        <p class="g-nextcue">${n("d.rest.next", { n: 2, load: num(s2.load), reps: s2.reps })}</p><button class="g-why" data-go="why-set2">${n("d.why_short")}</button>`;
    } else {
      main = `${resting ? `<p class="g-restdone">${ic("check")}${n("d.rest.done")}</p>` : ""}<div class="g-cue"><p class="g-cue__l1">${c.glyph ? mark(c.glyph) : ""}<span>${c.l1}</span></p><p class="g-cue__l2">${c.l2}</p><button class="g-why" data-go="${whyGo}">${s("why.open")}</button></div>`;
    }
    const lastLine = p ? (D.hasEffort(p) ? n("g.last_set", { load: num(p.load), reps: p.reps, rir: num(p.rir) }) : n("g.last_set_norir", { load: num(p.load), reps: p.reps })) : n("g.first");
    const dots = Array.from({ length: nSets }, (_, i) => `<i class="${i < setIdx ? "done" : i === setIdx ? "now" : ""}"></i>`).join("");
    const nextK = ctx.lifts[idx + 1];
    return `<div class="g-wtop">
        <button class="g-icb" data-go="${ctx === MIXD ? "today-mixed" : "today"}" aria-label="${n("d.back_today")}">${ic("chev")}</button>
        <p class="g-wtop__c">${s("log.focus.progress", { a: idx + 1, b: ctx.lifts.length })}</p>
        <button class="g-icb g-timer${running ? " is-live" : ""}" data-sheet="timer" aria-label="${n("d.timer")}">${ic("timer")}${running ? `<span>${X.fmtTime(U.rest)}</span>` : ""}</button>
        <button class="g-icb" data-sheet="actions" aria-label="${n("d.more")}">${ic("more")}</button>
      </div>
      <div class="g-prog" aria-hidden="true">${ctx.lifts.map((_, i) => `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")}</div>
      <div class="g-pg g-pg--w">
        <div class="g-exh">${X.art(k)}<div><h1 class="g-exname">${D.name(k)}</h1><p class="g-exmeta">${s("program.progression.strategy." + D.strategyOf(k))}</p></div></div>
        ${main}
        <div class="g-setline"><p><b>${s("focus.set_of", { x: setIdx + 1, y: nSets })}</b><span class="g-dots" aria-hidden="true">${dots}</span></p>
          ${resting ? `<button class="g-done" data-edit="0" aria-label="${s("focus.edit_set_aria", { n: 1 })}">${ic("check")}${n("g.done_set", { n: 1, load: num(102.5), reps: 7, rir: 1 })}</button>` : ""}
          <p class="g-last">${lastLine}</p></div>
        ${nextK ? `<button class="g-next"><span>${n("d.next_row", { name: `<b>${D.name(nextK)}</b>` })}</span>${ic("chev", "rot-l")}</button>` : ""}
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
    return X.sheet({ title: s("rest.sheet.title"), close: back, body: `<h2 class="g-sheet__t">${s("rest.sheet.title")}</h2><div class="g-presets">${presets}</div><div class="g-presets g-presets--ctl"><button>${s("rest.sheet.minus")}</button><button>${s("rest.sheet.plus")}</button><button>${s("rest.sheet.reset")}</button><button>${s("rest.sheet.stop")}</button></div>` });
  }
  function actionsSheet(back) {
    const item = (icn, key) => `<button class="g-act">${ic(icn)}<span>${s(key)}</span></button>`;
    return X.sheet({ title: s("ex.actions.title"), close: back, body: `<h2 class="g-sheet__t">${s("ex.actions.title")}</h2><div class="g-acts">${item("note", "ex.actions.open_notes")}${item("reset", "ex.actions.substitute")}${item("skip", "ex.actions.skip")}${item("sheet", "program.editor.reorder")}${item("check", "log.finish")}</div>` });
  }

  /* ---------------- Why: one reason first ---------------- */
  function whySheet(U, k, iso, variant, back) {
    const P = X.whyParts(k, iso, variant, U, "g");
    const all = P.w.blocks;
    const first = all[0], rest = all.slice(1);
    const more = rest.length + (P.w.calc.length ? 1 : 0);
    const reason = (b) => `<div class="g-reason">${b.label ? `<p class="g-reason__lab">${b.label}</p>` : ""}<b>${b.lead}</b><p>${b.text}</p></div>`;
    const body = `<p class="g-sheet__eyebrow">${s("why.title")}</p>
      <h2 class="g-sheet__cue">${P.noMark ? "" : mark(P.glyph)}<span>${P.w.head}</span></h2>
      <div class="g-reasons">${reason(first)}${U.calcOpen ? rest.map(reason).join("") : ""}</div>
      ${more ? `<button class="g-disc" data-toggle="calc" aria-expanded="${!!U.calcOpen}">${U.calcOpen ? n("g.less") : rest.length ? n(rest.length === 1 ? "g.more.one" : "g.more.other", { n: rest.length }) : n("d.why.calc")}${ic("chev", U.calcOpen ? "rot-180" : "")}</button>` : ""}
      ${U.calcOpen && P.w.calc.length ? `<div class="g-calcs">${P.w.calc.map((c) => c.group ? `<p class="g-calc__g">${c.group}</p>` : `<div class="g-calc${c.sum ? " g-calc--sum" : ""}${c.text ? " g-calc--t" : ""}"><span class="g-calc__k">${c.k}</span><span class="g-calc__v">${c.v}${c.rir ? `<em>${c.rir}</em>` : ""}</span>${c.sub ? `<small>${c.sub}</small>` : ""}</div>`).join("")}</div>` : ""}
      ${P.evidence ? `<p class="g-evidence">${P.evidence}</p>` : ""}
      <button class="x-sec" data-go="${back}">${n("d.why.ok")}</button>`;
    return X.sheet({ title: s("why.title"), close: back, body });
  }
  const why = (U) => ({ body: focusBody(U, MAIN, "sq", "set1"), over: X.shelf(U, { setNo: 1 }) + whySheet(U, "sq", T.TODAY, null, "workout"), cls: "no-dock x-has-shelf" });
  const whySet2 = (U) => ({ body: focusBody(U, MAIN, "sq", "rest"), over: whySheet(U, "sq", T.TODAY, "set2", "rest"), cls: "no-dock x-has-shelf" });
  const whyMix = (k) => (U) => ({ body: focusBody(U, MIXD, k, "set1"), over: X.shelf(U, { setNo: 1 }) + whySheet(U, k, MIXD.iso, null, "workout-mixed"), cls: "no-dock x-has-shelf" });

  /* ---------------- Summary: next time, one line per lift ---------------- */
  function summary(U, iso, mix) {
    const sn = D.session(iso, mix), prs = D.prsFor(iso, mix);
    const first = sn.lifts.every((k) => !D.previousDate(k, iso));
    const rows = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), nx = D.rec(k, iso, "next");
      const sub = [first ? "" : `<span class="${o.state === "insufficient" ? "g-soft" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</span>`, pr ? `<span class="g-pr">PR · ${D.prLine(pr)}</span>` : ""].filter(Boolean).join(`<span class="g-dot" aria-hidden="true"> · </span>`);
      return `<div class="g-srow">
        ${mark(nx.glyph)}
        <span class="g-srow__m"><b>${D.name(k)}</b><small>${D.setsLine(D.loggedSets(k, iso), true)}</small>${sub ? `<small class="g-srow__o">${sub}</small>` : ""}</span>
        <span class="g-srow__f"${X.tgt(nx)}><b>${num(nx.load)}</b><small>${targetText(nx)}</small></span>
      </div>`;
    }).join("");
    const ms = D.musclesOf(iso, mix);
    const mus = U.musclesAll ? `<div class="g-mus">${ms.map(([m, v]) => `<div><span>${D.muscle(m)}</span><b>${num(v)}</b></div>`).join("")}</div>` : "";
    const weekIdx = sn.mix ? 1 : iso === T.TODAY ? 1 : 3;
    const body = `
      <div class="g-pg">
        <p class="g-eyebrow">${s("summary.eyebrow")}</p>
        <h1 class="g-h1">${T.two(sn.dayName)}</h1>
        <p class="g-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <p class="g-sumline">${n("g.summary.line", { sets: sn.sets, vol: num(sn.vol, 0), lifts: sn.lifts.length })}</p>
        ${first ? `<p class="g-baseline">${s("summary.baseline")}</p>` : ""}
        <div class="g-sec"><h2>${n("d.outcome.head")}</h2><span>${n("d.col.next")}</span></div>
        <div class="g-list">${rows}</div>
        <button class="g-disc g-disc--page" data-toggle="muscles" aria-expanded="${!!U.musclesAll}">${n("g.muscles.show")}${ic("chev", U.musclesAll ? "rot-180" : "")}</button>
        ${mus}
        <p class="g-foot">${n("g.week_line", { done: weekIdx, planned: 3, next: T.two(X.nextOfSession(iso, mix)) })}</p>
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
      return `<button class="g-row g-row--link" data-go="chart" data-lift="${k}">${mark(r.glyph)}<span class="g-row__m"><b>${D.name(k)}</b><small>${r.label}</small></span><span class="g-row__f"><b class="g-row__sm">${r.load !== lastLoad ? `${num(lastLoad)}→${num(r.load)}` : num(r.load)}</b><small>${U_}</small></span>${ic("chev", "rot-l g-chev")}</button>`;
    }).join("");
    const rows = lifts.map((k) => {
      const c = D.topLoadChange(k), last = D.sessionsOf(k).slice(-1)[0], o = D.canonicalOutcome(k, last);
      return `<button class="g-row g-row--link" data-go="chart" data-lift="${k}"><span class="mk mk--none"></span><span class="g-row__m"><b>${D.name(k)}</b><small data-outcome="${o.k}@${o.iso}">${o.word}</small></span><span class="g-row__f"><b class="g-row__sm">${num(c.from)}→${num(c.to)}</b><small>${U_}</small></span>${ic("chev", "rot-l g-chev")}</button>`;
    }).join("");
    const body = `
      <div class="g-pg">
        <h1 class="g-h1 g-h1--page">${s("stats.title")}</h1>
        ${X.tabs([s("stats.overview"), s("stats.strength"), s("stats.volume"), s("stats.table.prs"), s("stats.review")], 0, s("stats.title"))}
        <p class="g-lede g-lede--p">${n("g.progress.line", { s: 1, S: 3, w: 13, W: 39, n: 4, t: 6 })}</p>
        <div class="g-sec"><h2>${n("d.progress.attention", { n: att.length })}</h2></div>
        <div class="g-list">${attRows}</div>
        <div class="g-sec"><h2>${n("d.progress.strength")}</h2><span>${s("stats.metric.top_load")}</span></div>
        <div class="g-list">${rows}</div>
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- Chart ---------------- */
  function chart(U) {
    const k = U.lift || "sq", c = X.chart(k, U, { h: 210 }), S = c.S, sel = S[c.sel];
    const list = S.map((z, i) => ({ z, i })).reverse();
    const shown = U.musclesAll ? list : list.slice(0, 3);
    const rows = shown.map(({ z, i }) => `<button class="g-hrow${i === c.sel ? " is-sel" : ""}" data-pt="${i}" aria-pressed="${i === c.sel}"><span>${date.short(z.date)}</span><span class="g-mono">${X.setOf(z)}</span><span class="g-mono">${c.metric === "top" ? num(z.top) : num(z.e1rm, 1)}</span></button>`).join("");
    const body = `
      <div class="g-pg">
        <button class="g-back" data-go="progress">${ic("chev", "rot-r")}${n("d.chart.back")}</button>
        <h1 class="g-h1 g-h1--ex">${D.name(k)}</h1>
        ${X.seg([["data-metric", "top", s("stats.metric.top_load"), c.metric === "top"], ["data-metric", "e1rm", s("stats.metric.best_e1rm"), c.metric === "e1rm"]], s("stats.metric.top_load"))}
        <p class="g-big"><b>${c.metric === "top" ? num(sel.top) : num(sel.e1rm, 1)}</b> ${U_}<small>${n("d.chart.readout", { date: date.short(sel.date), metric: c.label, value: c.metric === "top" ? num(sel.top) : num(sel.e1rm, 1), set: X.setOf(sel) })}</small></p>
        <div class="g-chart" data-chart="${c.xs}" role="img" aria-label="${n("d.chart.aria", { metric: c.label, name: D.name(k) })}">${c.svg}</div>
        ${X.seg([["data-scope", "block", s("stats.scope.current_block"), U.scope !== "all"], ["data-scope", "all", s("stats.scope.all_history"), U.scope === "all"]], s("stats.scope.current_block"))}
        <div class="g-list g-list--t">${rows}</div>
        ${S.length > 3 ? `<button class="g-textbtn" data-toggle="muscles" aria-expanded="${!!U.musclesAll}">${U.musclesAll ? n("g.less") : n("g.chart.more", { n: S.length })}</button>` : ""}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- History ---------------- */
  function history(U) {
    const rows = T.SESSIONS.slice().reverse().map((x) => {
      const sn = D.session(x.date), p = D.prsFor(x.date).length;
      return `<button class="g-row g-row--link g-row--h" data-go="${x.date === T.TODAY ? "session" : "history"}"><span class="g-hd"><small>${date.wd(x.date)}</small><b>${date.day(x.date)}</b></span><span class="g-row__m"><b>${T.two(sn.dayName)}</b><small>${n("d.history.sets", { n: sn.sets })}${p ? ` · <span class="g-pr">${n(p > 1 ? "d.history.prs_many" : "d.history.prs", { n: p })}</span>` : ""}</small></span>${ic("chev", "rot-l g-chev")}</button>`;
    }).join("");
    const sep = T.SESSIONS.filter((x) => x.date >= "2026-09-01");
    const body = `
      <div class="g-pg">
        <div class="g-top g-top--h"><h1 class="g-h1 g-h1--page">${s("history.title")}</h1><button class="g-icb" data-sheet="cal" aria-label="${n("d.history.calendar")}">${X.calIcon()}</button></div>
        <p class="g-lede g-lede--p">${s("history.month_title", { month: date.month(8), year: 2026 })} · ${s("history.month_summary", { sessions: sep.length, sets: sep.reduce((t, x) => t + T.sessionTotals(x).sets, 0) })}</p>
        <div class="g-list">${rows}</div>
      </div>`;
    return { body, over: X.dock("history") + (U.sheet === "cal" ? calSheet() : "") };
  }
  function calSheet() {
    const on = T.SESSIONS.filter((x) => x.date >= "2026-09-01").map((x) => T.date.day(x.date));
    const heads = (T.state.lang === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]).map((c) => `<span class="g-cal__h">${c}</span>`).join("");
    let cells = `<span class="g-cal__d is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="g-cal__d${on.includes(d) ? " is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="g-cal__d is-out">${d}</span>`;
    const title = s("history.month_title", { month: date.month(8), year: 2026 });
    return X.sheet({ title, close: "history", body: `<div class="g-calhead"><button class="g-icb" aria-label="${s("history.calendar_prev_aria")}">${ic("chev", "rot-r")}</button><h2 class="g-sheet__t">${title}</h2><button class="g-icb" aria-label="${s("history.calendar_next_aria")}">${ic("chev", "rot-l")}</button></div><div class="g-cal">${heads}${cells}</div><p class="g-sheet__sub">${n("d.history.cal_hint")}</p>` });
  }

  /* ---------------- Session ---------------- */
  function session() {
    const iso = T.TODAY, sn = D.session(iso), prs = D.prsFor(iso);
    const rows = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), sets = D.loggedSets(k, iso);
      return `<div class="g-sess"><p class="g-sess__h"><b>${D.name(k)}</b><span>${pr ? `<em class="g-pr">PR</em>` : ""}<span class="${o.state === "insufficient" ? "g-soft" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</span></span></p>
        <p class="g-mono">${D.setsLine(sets, true)}</p><p class="g-soft g-sess__rir">RIR ${sets.map((x) => (x.rir == null ? "–" : x.rir)).join(", ")}</p></div>`;
    }).join("");
    const body = `
      <div class="g-pg">
        <button class="g-back" data-go="history">${ic("chev", "rot-r")}${s("history.title")}</button>
        <h1 class="g-h1">${T.two(sn.dayName)}</h1>
        <p class="g-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <p class="g-sumline">${n("g.summary.line", { sets: sn.sets, vol: num(sn.vol, 0), lifts: sn.lifts.length })}</p>
        <div class="g-list g-list--top">${rows}</div>
        <div class="g-actions"><button class="x-sec">${ic("pencil")}${s("history.session.edit")}</button><button class="g-danger">${s("history.session.delete")}</button></div>
      </div>`;
    return { body, over: X.dock("history") };
  }

  /* ---------------- Program ---------------- */
  function program(U) {
    const openDay = U.open ? U.open : U.open === "" ? "" : "d0";
    const days = T.PROGRAM.days.map((d, di) => {
      const open = openDay === "d" + di;
      const rows = open ? d.lifts.map((k) => {
        const r = di === 0 ? D.rec(k, T.TODAY) : D.rec(k, "2026-09-22", "next"), e = T.EX[k];
        return `<div class="g-prow">${mark(r.glyph)}<span class="g-row__m"><b>${D.name(k)}</b><small>${e.n} × ${e.r[0]}–${e.r[1]} · ${s("program.progression.strategy." + D.strategyOf(k))}</small></span><span class="g-row__f"${X.tgt(r)}><b class="g-row__sm">${num(r.load)}</b><small>${U_}</small></span></div>`;
      }).join("") : "";
      return `<div class="g-day${open ? " is-open" : ""}"><button class="g-dayh" data-open="d${di}" aria-expanded="${open}"><span><b>${T.two(d.name)}</b><small>${T.muList(T.dayMuscles(di).slice(0, 3))} · ${n("g.program.day", { n: d.lifts.length, sets: T.daySets(di) })}</small></span>${ic("chev", open ? "rot-180" : "")}</button>${open ? `<p class="g-legend">${n("d.program.legend")}</p>${rows}` : ""}</div>`;
    }).join("");
    const body = `
      <div class="g-pg">
        <div class="g-top g-top--h"><span class="g-date">${s("program.title")}</span><button class="g-textbtn g-textbtn--r">${s("program.edit")}</button></div>
        <h1 class="g-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="g-lede">${n("d.program.lede", { goal: T.two(T.PROGRAM.goal), n: 4, total: 6 })}</p>
        <p class="g-status">${n("d.program.status", { status: s("status.on_track"), n: 3, m: 3 })}</p>
        <div class="g-days">${days}</div>
      </div>`;
    return { body, over: X.dock("program") };
  }

  root.DIR_G = {
    key: "g", family: true, name: "Só o essencial", en: "Only what matters",
    idea: "Restraint: each screen answers one question with one line per item, what to lift now, what to lift next time, what needs attention, and every supporting fact opens in place with one tap.",
    screens: {
      today: (U) => today(U, MAIN), workout: (U) => focusScreen(U, MAIN, "sq", "set1"), why, rest: (U) => focusScreen(U, MAIN, "sq", "rest"), "why-set2": whySet2,
      summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3), progress, chart, history, session, program,
      "today-mixed": (U) => today(U, MIXD), "why-repgoal": whyMix("ht"), "why-anchor": whyMix("dl"), "why-manual": whyMix("cp"),
      "summary-first": (U) => summary(U, D.MIX.first, true), "workout-mixed": (U) => focusScreen(U, MIXD, "dl", "set1"),
    },
    notes: {
      today: "One line per lift: the verdict under the name, the load at 20 px and the target beside it. Tap a lift for last session and the shipped reason, in place.",
      workout: "Only the cue, the set you are on and what you did last time on this set. The shelf does the rest.",
      why: "The first reason alone, with the RIR it used. The other reasons and the working are one tap away, not on the first read.",
      "why-set2": "In session the first reason is what set 1 showed: a capacity of 8. The prediction for set 2 sits behind the same tap.",
      rest: "The clock replaces the cue; set 1's line is checked and tappable to correct.",
      summary: "The next target is the figure on every row. What you did and the canonical outcome are the quiet second and third lines.",
      summary2: "Same rows, no PR lines.",
      progress: "Attention is a list of verdicts with the figure that changes; strength is one line per lift with its canonical outcome.",
      chart: "The selected session is the headline figure. Three recent sessions show; the rest are one tap away.",
      history: "A plain list of sessions, newest first. The month is a calendar sheet.",
      session: "Each lift in two lines: sets and RIR.",
      program: "One day open at a time; the others fold to a line.",
      "today-mixed": "Each strategy's target fits the same short figure: 5 + 2×8, 12·12·12, 3×10, a manual range in soft ink.",
      "why-repgoal": "Rep goal: the total first, the effort gate and split on request.",
      "why-anchor": "Anchor: the top set first, the rule and back-off on request.",
      "why-manual": "Manual: one sentence and nothing to expand.",
      "summary-first": "A first session: the baseline sentence and each lift's first next target, no outcome words.",
    },
  };
})(window);
