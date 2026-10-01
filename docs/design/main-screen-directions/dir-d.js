/* Direction D: Folha e polegar (sheet and thumb).
   A's record, B's hand. Everything you read is laid out as A's ledger:
   aligned mono columns, hairlines, one inventory per screen. Everything you
   do mid-set sits in B's bottom shelf. Built to DIRECTION-D-SPEC.md; every
   figure comes from data-d.js. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT, D = root.DX, X = root.KITD;
  const { s, n, num, kg, date } = { ...D, date: T.date };
  const { ic, esc } = K;
  const { mark } = X;
  const U_ = "kg";

  // OG-6 rounds 1 and 2: the only strings these drawings add. Every other word is a shipped key.
  D.register({
    "d.og6.resume.title": ["Sessão em andamento", "Session in progress"],
    // The ledger's index label for a warm-up set (spec section 4): short enough for the 36 px index column.
    "d.og6.set.warmup": ["A", "W"],
  });

  /* ---------- scenarios ---------- */
  const MAIN = { iso: T.TODAY, dayName: T.PROGRAM.days[0].name, lifts: T.PROGRAM.days[0].lifts, done: 0, next: T.PROGRAM.days[1].name, week: 4 };
  const MIXD = { iso: D.MIX.today, dayName: D.MIX.name, lifts: D.MIX.lifts, done: 1, next: T.PROGRAM.days[2].name, week: 4 };

  const weekRule = (cur, total) => `<div class="d-weeks" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i + 1 < cur ? "done" : i + 1 === cur ? "now" : ""}"></i>`).join("")}</div>`;
  const colHead = (cells, cls) => `<div class="d-cols ${cls}" aria-hidden="true">${cells.map((c) => `<span>${c}</span>`).join("")}</div>`;
  const setsOnly = (k, iso) => D.loggedSets(k, iso);
  // Operators and units inside a Mono cell step back to soft ink so the figures lead.
  const ops = (x) => String(x).replace(/×/g, '<i class="d-op">×</i>').replace(/\bkg\b/g, '<i class="d-op">kg</i>');
  // "{label}: {value}" with the value in Mono: language in Sans, figures in Mono.
  const withMono = (str, value) => str.replace("\u0000", `<b class="x-mono">${value}</b>`);

  // Today sub-line: last session, first time, or the shipped stalled reason.
  function subLine(k, r, iso) {
    if (r.glyph === "stalled") return s("rec.stalled.text").split(". ")[0] + ".";
    const pd = D.previousDate(k, iso);
    if (!pd) return n("d.sub.first");
    return n("d.sub.before", { sets: D.setsLine(setsOnly(k, pd)) });
  }

  /* ---------------- 5.1 Today ---------------- */
  function today(U, ctx = MAIN, opts = {}) {
    const recs = ctx.lifts.map((k) => D.rec(k, ctx.iso));
    const sets = recs.reduce((t, r) => t + (r.manual ? r.manual.sets : r.sets.length), 0);
    const rows = recs.map((r) => {
      const k = r.k, manual = r.glyph === "manual";
      return `<div class="d-row d-row--rx${manual ? " is-manual" : ""}">
        ${mark(r.glyph)}
        <div class="d-row__name">${D.name(k)}<small>${subLine(k, r, ctx.iso)}</small></div>
        <span class="d-fig"${X.tgt(r)}>${num(r.load)}<i class="d-unit">${U_}</i></span>
        <span class="d-tgt">${ops(r.target)}</span>
      </div>`;
    }).join("");
    const tally = D.tally(recs).map((t) => `<span class="d-tally__i">${mark(t.glyph)}${t.text}</span>`).join("");
    const body = `
      <div class="d-pg">
        <div class="d-top">
          <span class="d-date">${date.long(ctx.iso)}</span>
          <div class="d-top__r"><button class="d-textbtn" data-sheet="days">${s("today.choose_day")}</button><button class="d-icb" aria-label="${n("d.settings")}">${ic("gear")}</button></div>
        </div>
        <h1 class="d-h1">${T.two(ctx.dayName)}</h1>
        <p class="d-lede">${n("d.lede_week", { program: T.two(T.PROGRAM.name), n: ctx.week, total: 6 })}</p>
        ${weekRule(ctx.week, 6)}
        ${opts.resume ? resumeBand(ctx) : ""}
        <p class="d-tally">${tally}</p>
        <div class="d-sec"><h2 class="d-h2">${n("d.rx.title")}</h2><span class="d-meta">${n("d.rx.meta", { lifts: recs.length, sets })}</span></div>
        ${colHead(["", n("d.col.exercise"), U_, n("d.col.target")], "d-cols--rx")}
        ${rows}
        <div class="d-split">
          <div><span class="d-k">${s("today.this_week")}</span><span class="d-v">${n("d.week_line", { done: ctx.done, planned: 3 })}</span></div>
          <div><span class="d-k">${s("today.up_next")}</span><span class="d-v">${T.two(ctx.next)}</span></div>
        </div>
      </div>`;
    const cta = `<div class="x-ctabar"><button class="x-cta x-cta--go" data-go="${ctx === MIXD ? "workout-mixed" : "workout"}">${s(opts.resume ? "today.continue" : "today.start")}${ic("arrow", "x-cta__ar")}</button></div>`;
    // With a draft open, confirming another day asks before it discards the draft (confirm.discard_draft).
    const days = U.sheet === "days" || U.sheet === "discard" ? daySheet(opts.resume) : "";
    const discard = U.sheet === "discard" ? discardDialog() : "";
    return { body, over: cta + X.dock("today") + days + discard, cls: "x-has-cta" };
  }

  function daySheet(resume) {
    const rows = T.PROGRAM.days.map((d, i) => `<button class="d-dayopt${i === 0 ? " is-on" : ""}" data-sheet="" aria-pressed="${i === 0}"><span><b>${T.two(d.name)}</b><small>${T.muList(T.dayMuscles(i).slice(0, 3))}</small></span>${i === 0 ? `<em>${s("today.choose_day_current")}</em>` : ""}</button>`).join("");
    return X.sheet({ title: s("today.choose_day_title"), close: resume ? "today-draft-resume" : "today", body: `<h2 class="d-sheet__t">${s("today.choose_day_title")}</h2><p class="d-sheet__sub">${s("today.choose_day_sub")}</p><div class="d-dayopts">${rows}</div><button class="x-sec" ${resume ? 'data-sheet="discard"' : 'data-go="today"'}>${s("today.choose_day_confirm")}</button>` });
  }

  /* ---------------- 5.2 Focus workout + 5.4 rest ---------------- */
  function exMeta(k) {
    const p = D.paramsOf(k), st = D.strategyOf(k), strat = s("program.progression.strategy." + st);
    if (st === "range") return n("d.exmeta.range", { sets: p.workingSets, min: p.repMin, max: p.repMax, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "rep_goal") return n("d.exmeta.goal", { sets: p.workingSets, goal: p.repGoal, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "effort_target") return n("d.exmeta.effort", { sets: p.workingSets, reps: p.targetReps, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "anchor_backoff") return n("d.exmeta.anchor", { amin: p.anchorRepMin, amax: p.anchorRepMax, n: p.backoffSets, bmin: p.backoffRepMin, bmax: p.backoffRepMax }) + " · " + strat;
    const m = D.MANUAL[k];
    return n("d.exmeta.manual", { sets: m.sets, min: m.lo, max: m.hi }) + " · " + strat;
  }

  function header(ctx, idx, U, resting) {
    const running = resting && U.rest > 0;
    return `<div class="d-wtop">
      <button class="d-icb" data-go="${ctx === MIXD ? "today-mixed" : "today"}" aria-label="${n("d.back_today")}">${ic("chev", "rot-r")}</button>
      <p class="d-wtop__c">${n("d.head.day_ex", { day: T.two(ctx.dayName), n: idx + 1, m: ctx.lifts.length })}</p>
      <button class="d-icb d-timer${running ? " is-live" : ""}" data-sheet="timer" aria-label="${n("d.timer")}">${ic("timer")}${running ? `<span>${X.fmtTime(U.rest)}</span>` : ""}</button>
      <button class="d-icb" data-go="workout-session" aria-label="${n("d.table_view")}">${ic("sheet")}</button>
      <button class="d-icb" data-sheet="actions" aria-label="${n("d.more")}">${ic("more")}</button>
    </div>
    <div class="d-seg" aria-hidden="true">${ctx.lifts.map((_, i) => `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")}</div>`;
  }

  // Ledger row, §4. state: done | open | queued.
  function setRow(i, st, vals, prev, opts = {}) {
    const [l, r, rir] = vals;
    const idx = opts.label || String(i + 1);
    const prevLine = prev ? (D.hasEffort(prev) ? n("d.prev_line", { load: num(prev.load), reps: prev.reps, rir: num(prev.rir) }) : n("d.prev_line_norir", { load: num(prev.load), reps: prev.reps })) : "";
    const cells = `<span class="d-set__n">${st === "done" && !opts.editing ? ic("check") : idx}</span><span class="d-set__v">${num(l)}</span><span class="d-set__v">${r}</span><span class="d-set__v">${rir == null ? "–" : rir}</span>`;
    const inner = `${cells}${prevLine ? `<small class="d-set__prev">${prevLine}</small>` : ""}`;
    if (st === "done") return `<button class="d-set is-done${opts.editing ? " is-editing" : ""}" data-edit="${i}" aria-label="${s("focus.edit_set_aria", { n: i + 1 })}"${opts.editing ? ' aria-pressed="true"' : ""}>${inner}</button>`;
    return `<div class="d-set is-${st}${opts.demoted ? " is-demoted" : ""}">${inner}</div>`;
  }

  function cueBlock(r, k, ctx, whyGo) {
    if (r.glyph === "manual") {
      return `<div class="d-cue d-cue--manual"><p class="d-cue__l1"><span>${s("program.progression.strategy.manual")}: <b class="d-mono">${num(r.load)}</b> ${U_}</span></p>
        <p class="d-cue__l2">${r.manual.lo}–${r.manual.hi} reps</p>
        <button class="d-why" data-go="${whyGo}">${s("why.open")}</button></div>`;
    }
    const verb = r.glyph === "up" ? "focus.cue.up" : r.glyph === "down" ? "focus.cue.down" : "focus.cue.hold";
    const line1 = s(verb, { load: `\u0000`, unit: U_ }).replace(`\u0000`, `<b class="d-mono">${num(r.load)}</b>`);
    const reps = r.strategy === "rep_goal" ? r.sets.map((x) => x.reps).join(", ") : r.reps;
    return `<div class="d-cue"><p class="d-cue__l1">${mark(r.glyph)}<span>${line1}</span></p>
      <p class="d-cue__l2">${s("focus.cue.reps", { reps })}</p>
      <button class="d-why" data-go="${whyGo}">${s("why.open")}</button></div>`;
  }

  function restBlock(U) {
    const p = Math.max(0, U.rest) / U.restTotal;
    // At zero the clock collapses to one line and keeps counting up (owner
    // decision 14). The check sits in the cue's mark column below it.
    if (U.rest <= 0) return `<div class="d-rest is-done" role="timer"><p class="d-rest__done"><span class="d-rest__mk" aria-hidden="true">${ic("check")}</span><span>${U.rest < 0 ? n("d.rest.done_over", { time: X.fmtTime(-U.rest) }) : n("d.rest.done")}</span></p></div>`;
    return `<div class="d-rest" role="timer" aria-live="off">
      <div class="d-rest__row"><span class="d-rest__k">${n("d.rest.label")}</span><b class="d-rest__t">${X.fmtTime(U.rest)}</b><span class="d-rest__of">${n("d.rest.of", { t: X.fmtTime(U.restTotal) })}</span></div>
      <div class="d-rest__bar"><i style="transform:scaleX(${p.toFixed(4)})"></i></div>
    </div>`;
  }

  /* The focus body for any lift in any scenario. phase: "set1" | "rest". */
  function focusBody(U, ctx, k, phase, fopts = {}) {
    const idx = ctx.lifts.indexOf(k);
    const r = D.rec(k, ctx.iso);
    const pd = D.previousDate(k, ctx.iso), prev = pd ? setsOnly(k, pd) : [];
    const resting = phase === "rest";
    const s2 = resting ? D.rec(k, ctx.iso, "today", [{ load: 102.5, reps: 7, rir: 1 }]) : null;
    const whyGo = ctx === MIXD ? { ht: "why-repgoal", dl: "why-anchor", cp: "why-manual" }[k] || "why" : "why";
    let ledger = "";
    const targets = r.glyph === "manual" ? Array.from({ length: r.manual.sets }, () => ({ load: r.load, reps: `${r.manual.lo}–${r.manual.hi}` })) : r.sets;
    const rirT = (t) => (t.targetRirMin != null ? `${t.targetRirMin}–${t.targetRirMax}` : `0–${t.targetRir != null ? t.targetRir : 2}`);
    const correcting = U.correct != null;
    // A warm-up set keeps its place in the ledger under a label instead of a number (spec section 4).
    const warmLab = fopts.warm ? { label: n("d.og6.set.warmup") } : {};
    targets.forEach((t, i) => {
      const lab = i === 0 ? warmLab : {};
      // The corrected row holds the shelf's live values; the open row steps back.
      if (resting && i === 0) ledger += correcting ? setRow(0, "done", [U.load, U.reps, U.rir], prev[0], { editing: true, ...lab }) : setRow(0, "done", [102.5, 7, 1], prev[0], lab);
      else if (resting && i === 1) ledger += correcting ? setRow(1, "open", [s2.load, s2.reps, s2.rir], prev[1], { demoted: true }) : setRow(1, "open", [U.load, U.reps, U.rir], prev[1]);
      else if (!resting && i === 0) ledger += setRow(i, "open", [U.load, U.reps, U.rir], prev[i], lab);
      else ledger += setRow(i, "queued", [resting ? s2.load : t.load, resting ? s2.reps : t.reps, r.glyph === "manual" ? null : rirT(t)], prev[i]);
    });
    const nextK = ctx.lifts[idx + 1];
    const note = T.EX[k] && T.EX[k].note ? `<p class="d-note">${ic("note")}<span>${T.two(T.EX[k].note)}</span></p>` : "";
    let cue;
    if (resting) {
      const nextCue = `<p class="d-nextcue">${n("d.rest.next", { n: 2, load: num(s2.load), reps: s2.reps })}<button class="d-why d-why--in" data-go="why-set2">${n("d.why_short")}</button></p>`;
      cue = U.rest > 0 ? restBlock(U) + nextCue : restBlock(U) + cueBlock(s2, k, ctx, "why-set2");
    } else cue = cueBlock(r, k, ctx, whyGo);
    return `${header(ctx, idx, U, resting)}
      <div class="d-pg d-pg--w">
        <div class="d-exh">${X.art(k)}<div><h1 class="d-exname">${D.name(k)}</h1><p class="d-exmeta">${exMeta(k)}</p>${fopts.instead ? `<p class="d-exmeta">${s("log.substitute_for", { name: D.name(fopts.instead) })}</p>` : ""}</div></div>
        ${cue}
        ${note}
        ${colHead([n("d.col.set"), U_, "reps", "RIR"], "d-cols--set")}
        ${ledger}
        ${nextK ? `<button class="d-next"><span>${n("d.next_row", { name: `<b>${D.name(nextK)}</b>` })}</span>${ic("chev", "rot-l")}</button>` : ""}
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
    const presets = [60, 90, 120, 180].map((t) => `<button class="d-preset${t === U.restTotal ? " is-on" : ""}" aria-pressed="${t === U.restTotal}" aria-label="${s("rest.sheet.preset_aria", { time: X.fmtTime(t) })}">${X.fmtTime(t)}</button>`).join("");
    return X.sheet({ title: s("rest.sheet.title"), close: back, body: `<h2 class="d-sheet__t">${s("rest.sheet.title")}</h2><div class="d-presets" role="group" aria-label="${s("rest.sheet.presets_aria")}">${presets}</div><div class="d-presets d-presets--ctl"><button>${s("rest.sheet.minus")}</button><button>${s("rest.sheet.plus")}</button><button>${s("rest.sheet.reset")}</button><button>${s("rest.sheet.stop")}</button></div>` });
  }

  function actionsSheet(back) {
    // Each action opens the sheet or state it leads to (OG-6 drawings), so the review page can be walked end to end.
    const item = (icn, key, go) => `<button class="d-act"${go ? ` data-go="${go}"` : ""}>${ic(icn)}<span>${s(key)}</span></button>`;
    return X.sheet({ title: s("ex.actions.title"), close: back, body: `<h2 class="d-sheet__t">${s("ex.actions.title")}</h2><div class="d-acts">${item("note", "ex.actions.open_notes", "workout-exercise-note")}${item("reset", "ex.actions.substitute", "workout-substituted-actions")}${item("skip", "ex.actions.skip", "workout-skipped-actions")}${item("sheet", "program.editor.reorder", "workout-session")}${item("check", "log.finish")}</div>` });
  }

  const workout = (U) => focusScreen(U, MAIN, "sq", "set1");
  const workoutMixed = (U) => focusScreen(U, MIXD, "dl", "set1");
  const rest = (U) => focusScreen(U, MAIN, "sq", "rest");

  /* ---------------- 5.3 Why this weight ---------------- */
  function whySheet(U, k, iso, variant, back) {
    const w = D.why(k, iso, variant);
    const r = w.r;
    const blocks = w.blocks.map((b) => `<div class="d-reason">${b.label ? `<p class="d-reason__lab">${b.label}</p>` : ""}<b>${b.lead}</b><p>${b.text}</p></div>`).join("");
    const calcRows = w.calc.map((c) => c.group ? `<p class="d-calc__g">${c.group}</p>`
      : `<div class="d-calc${c.sum ? " d-calc--sum" : ""}${c.text ? " d-calc--t" : ""}"><span class="d-calc__k">${c.k}</span><span class="d-calc__v">${c.v}${c.rir ? `<em>${c.rir}</em>` : ""}</span>${c.sub ? `<small>${c.sub}</small>` : ""}</div>`).join("");
    const calc = w.calc.length ? `<button class="d-disc" data-toggle="calc" aria-expanded="${!!U.calcOpen}">${U.calcOpen ? n("d.why.calc_hide") : n("d.why.calc")}${ic("chev", U.calcOpen ? "rot-180" : "")}</button>${U.calcOpen ? `<div class="d-calcs">${calcRows}</div>` : ""}` : "";
    const glyph = variant === "set2" ? "hold" : r.glyph;
    const head = String(w.head).replace(num(r.load), `<b class="x-mono">${num(r.load)}</b>`);
    const body = `<p class="d-sheet__eyebrow">${s("why.title")}</p>
      <h2 class="d-sheet__cue">${w.noMark ? "" : mark(glyph)}<span>${head}</span></h2>
      <div class="d-reasons">${blocks}</div>
      ${calc}
      ${w.evidence ? `<p class="d-evidence">${variant === "set2" ? `${s("why.session")}, ${n("d.set_label", { n: 1 })}` : w.evidence}</p>` : ""}
      <button class="x-sec" data-go="${back}">${n("d.why.ok")}</button>`;
    return X.sheet({ title: s("why.title"), close: back, body, cls: "d-whysheet" });
  }
  function why(U) { return { body: focusBody(U, MAIN, "sq", "set1"), over: whySheet(U, "sq", T.TODAY, null, "workout"), cls: "no-dock" }; }
  function whySet2(U) { return { body: focusBody(U, MAIN, "sq", "rest"), over: whySheet(U, "sq", T.TODAY, "set2", "rest"), cls: "no-dock" }; }
  const whyMix = (k) => (U) => ({ body: focusBody(U, MIXD, k, "set1"), over: whySheet(U, k, MIXD.iso, null, "workout-mixed"), cls: "no-dock" });

  /* ---------------- 5.5 / 5.6 Summary ---------------- */
  function summary(U, iso, mix) {
    const sn = D.session(iso, mix), prs = D.prsFor(iso, mix);
    const first = sn.lifts.every((k) => !D.previousDate(k, iso));
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), nx = D.rec(k, iso, "next");
      const word = first ? "" : `<span class="d-out${o.state === "insufficient" ? " is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</span>`;
      return `<div class="d-grp">
        <div class="d-grp__h"><span class="d-grp__n">${D.name(k)}</span>${word}</div>
        <p class="d-grp__sets">${ops(D.setsLine(setsOnly(k, iso), true))}</p>
        ${pr ? `<p class="d-pr">PR · ${D.prLine(pr)}</p>` : ""}
        <p class="d-grp__next"${X.tgt(nx)}>${mark(nx.glyph)}<span>${withMono(n("d.next_target", { target: "\u0000" }), ops(nx.next))}</span></p>
      </div>`;
    }).join("");
    const ms = D.musclesOf(iso, mix), shown = U.musclesAll ? ms : ms.slice(0, 6);
    const weekIdx = sn.mix ? 1 : iso === T.TODAY ? 1 : 3;
    const nextDay = sn.mix ? T.PROGRAM.days[2].name : iso === T.TODAY ? T.PROGRAM.days[1].name : T.PROGRAM.days[0].name;
    const body = `
      <div class="d-pg">
        <p class="d-eyebrow">${s("summary.eyebrow")}</p>
        <h1 class="d-h1">${T.two(sn.dayName)}</h1>
        <p class="d-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="d-totals">
          <div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div>
          <div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div>
          <div><b>${sn.lifts.length}</b><span>${n("d.totals.lifts")}</span></div>
        </div>
        ${first ? `<p class="d-baseline">${s("summary.baseline")}</p>` : ""}
        <div class="d-sec"><h2 class="d-h2">${n("d.outcome.head")}</h2></div>
        ${groups}
        <div class="d-sec"><h2 class="d-h2">${s("summary.muscles.title")}</h2></div>
        <div class="d-mus">${shown.map(([m, v]) => `<div><span>${D.muscle(m)}</span><b>${num(v)}</b></div>`).join("")}</div>
        ${ms.length > 6 ? `<button class="d-textbtn d-textbtn--l" data-toggle="muscles" aria-expanded="${!!U.musclesAll}">${U.musclesAll ? n("d.muscles.fewer") : n("d.muscles.all", { n: ms.length })}</button>` : ""}
        <div class="d-split">
          <div><span class="d-k">${s("today.this_week")}</span><span class="d-v">${n("d.week_line", { done: weekIdx, planned: 3 })}</span></div>
          <div><span class="d-k">${s("today.up_next")}</span><span class="d-v">${T.two(nextDay)}</span></div>
        </div>
      </div>`;
    const over = `<div class="x-actbar"><button class="x-sec" data-go="session">${s("summary.see_session")}</button><button class="x-cta" data-go="today">${s("summary.done")}</button></div>`;
    return { body, over, cls: "no-dock x-has-act" };
  }

  /* ---------------- 5.7 Progress ---------------- */
  const progressTabs = (on) => X.tabs([s("stats.overview"), s("stats.strength"), s("stats.volume"), s("stats.table.prs"), s("stats.review")], on, s("stats.title"));
  function attention() {
    const ks = Object.keys(T.EX).filter((k) => { const r = D.rec(k, "2026-09-22", "next"); return r.glyph !== "hold"; });
    return ks.map((k) => {
      const r = D.rec(k, "2026-09-22", "next"), last = D.sessionsOf(k).slice(-1)[0];
      const lastLoad = Math.max(...setsOnly(k, last).map((x) => x.load));
      const fig = r.load !== lastLoad ? `${num(lastLoad)}→${num(r.load)} ${U_}` : kg(r.load);
      const count = D.sessionsOf(k).filter((d) => d >= D.CONTEXT.blockStart).length;
      // Name and figure share the first baseline; the verdict and its evidence
      // run the full width under them instead of wrapping beside an empty column.
      return `<button class="d-att" data-go="chart" data-lift="${k}">
        ${mark(r.glyph)}
        <b class="d-att__n">${D.name(k)}</b>
        <span class="d-att__f">${fig}${ic("chev", "rot-l")}</span>
        <span class="d-att__v">${r.label}. ${r.text}</span>
        <small class="d-att__e">${n("d.progress.evidence", { kind: D.evidenceKind(count), n: count })}</small>
      </button>`;
    }).join("");
  }
  function progress() {
    const lifts = Object.keys(T.EX);
    const nAtt = lifts.filter((k) => D.rec(k, "2026-09-22", "next").glyph !== "hold").length;
    const rows = lifts.map((k) => {
      const c = D.topLoadChange(k), o = D.canonicalOutcome(k, D.sessionsOf(k).slice(-1)[0]);
      return `<button class="d-str" data-go="chart" data-lift="${k}"><span class="d-str__m"><b>${D.name(k)}</b><small><span data-outcome="${o.k}@${o.iso}">${o.word}</span> · ${date.short(o.iso)}</small></span>${X.sparkline(c.series)}<span class="d-str__f">${num(c.from)}→${num(c.to)} ${U_}</span></button>`;
    }).join("");
    const body = `
      <div class="d-pg">
        <h1 class="d-h1 d-h1--page">${s("stats.title")}</h1>
        ${progressTabs(0)}
        <div class="d-totals d-totals--2">
          <div><b>1<i>/3</i></b><span>${n("d.progress.sessions")}</span></div>
          <div><b>13<i>/39</i></b><span>${n("d.progress.sets")}</span></div>
        </div>
        <p class="d-soft d-weekline">${n("d.progress.week", { n: 4, total: 6 })}</p>
        <div class="d-sec"><h2 class="d-h2">${n("d.progress.attention", { n: nAtt })}</h2></div>
        ${attention()}
        <div class="d-sec"><h2 class="d-h2">${n("d.progress.strength")}</h2><span class="d-meta">${s("stats.metric.top_load")}</span></div>
        ${rows}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- 5.8 Exercise chart ---------------- */
  function chart(U) {
    const k = U.lift || "sq";
    const c = X.chart(k, U);
    const S = c.S, sel = S[c.sel];
    const figs = c.metric === "top"
      ? [[num(Math.max(...c.vals)), n("d.chart.fig.top")], [(c.vals[c.vals.length - 1] - c.vals[0] >= 0 ? "+" : "−") + num(Math.abs(c.vals[c.vals.length - 1] - c.vals[0])), n("d.chart.fig.change")], [S.length, n("d.chart.fig.sessions")]]
      : [[num(Math.max(...c.vals), 1), n("d.chart.fig.e1rm")], [(c.vals[c.vals.length - 1] - c.vals[0] >= 0 ? "+" : "−") + num(Math.abs(c.vals[c.vals.length - 1] - c.vals[0]), 1), n("d.chart.fig.change")], [S.length, n("d.chart.fig.sessions")]];
    const readout = n("d.chart.readout", { date: date.short(sel.date), metric: c.label, value: `<b>${c.metric === "top" ? num(sel.top) : num(sel.e1rm, 1)}</b>`, set: `<b>${ops(X.setOf(sel))}</b>` });
    // Loads padded to five Mono cells so "×" and the reps align down the column.
    const setOfPad = (z) => num(z.top).padStart(5, "\u00A0") + ops(` × ${z.topReps}`);
    const rows = S.map((z, i) => ({ z, i })).reverse().map(({ z, i }) => {
      const prev = S[i - 1];
      const v = c.metric === "top" ? z.top : z.e1rm, pv = prev ? (c.metric === "top" ? prev.top : prev.e1rm) : null;
      const dl = pv == null ? "–" : Math.abs(v - pv) < 0.05 ? "0" : (v > pv ? "+" : "−") + num(Math.abs(v - pv), c.metric === "top" ? undefined : 1);
      return `<button class="d-hrow${i === c.sel ? " is-sel" : ""}${z.block ? "" : " is-old"}" data-pt="${i}" aria-pressed="${i === c.sel}"><span>${date.short(z.date)}</span><span class="d-mono">${setOfPad(z)}</span><span class="d-mono">${num(z.e1rm, 1)}</span><span class="d-mono d-soft">${dl}</span></button>`;
    }).join("");
    const body = `
      <div class="d-pg">
        <button class="d-back" data-go="progress">${ic("chev", "rot-r")}${n("d.chart.back")}</button>
        <h1 class="d-h1 d-h1--ex">${D.name(k)}</h1>
        <div class="d-toggles">
          ${X.seg([["data-scope", "block", s("stats.scope.current_block"), U.scope !== "all"], ["data-scope", "all", s("stats.scope.all_history"), U.scope === "all"]], s("stats.scope.current_block"))}
          ${X.seg([["data-metric", "top", s("stats.metric.top_load"), c.metric === "top"], ["data-metric", "e1rm", s("stats.metric.best_e1rm"), c.metric === "e1rm"]], s("stats.metric.top_load"))}
        </div>
        <div class="d-totals">${figs.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <div class="d-chart" data-chart="${c.xs}" role="img" aria-label="${n("d.chart.aria", { metric: c.label, name: D.name(k) })}">${c.svg}</div>
        <p class="d-readout" aria-live="polite">${readout}</p>
        ${colHead([s("stats.table.date"), n("d.col.top_set"), "e1RM", "Δ"], "d-cols--hist")}
        ${rows}
      </div>`;
    return { body, over: X.dock("progress") };
  }

  /* ---------------- 5.9 History ---------------- */
  function sessRow(iso) {
    const sn = D.session(iso), p = D.prsFor(iso).length;
    const mus = T.muList(T.dayMuscles(sn.day).slice(0, 3));
    const dd = T.date.day(iso) + (iso.slice(5, 7) !== "09" ? ` ${date.short(iso).replace(/\d+\s?/, "").trim()}` : "");
    return `<button class="d-sess" data-go="${iso === T.TODAY ? "session" : "history"}">
      <span class="d-sess__d"><small>${date.wd(iso)}</small><b>${dd}</b></span>
      <span class="d-sess__m"><b>${T.two(sn.dayName)}</b><small>${mus}</small></span>
      <span class="d-sess__n"><span>${n("d.history.sets", { n: `<b>${sn.sets}</b>` })}</span><span><b>${num(sn.vol, 0)}</b> ${U_}</span>${p ? `<span class="d-pr">${n(p > 1 ? "d.history.prs_many" : "d.history.prs", { n: p })}</span>` : ""}</span>
    </button>`;
  }
  /* ---------- History frequency views (owner Q7: five shapes to compare) ----------
     Every shape follows the same guardrails: one session is one filled mark,
     no intensity by sets or volume, no streak count, nothing marks a missed
     day, and the list below stays the way into a session. */
  const BLOCK_WEEKS = 6, PLANNED = T.PROGRAM.days.length;
  const addDays = (iso, d) => { const x = new Date(Date.parse(iso + "T12:00:00Z") + d * 864e5); return x.toISOString().slice(0, 10); };
  const blockDay = (w, d) => addDays(D.CONTEXT.blockStart, (w - 1) * 7 + d);
  const sessionOn = (iso) => T.SESSIONS.find((x) => x.date === iso);
  const doneIn = (w) => [0, 1, 2, 3, 4, 5, 6].filter((d) => sessionOn(blockDay(w, d))).length;
  const nowWeek = X.weekOf(T.TODAY);
  const weekdayLetters = () => (T.state.lang === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]);
  const blockTotal = () => { let done = 0; for (let w = 1; w <= BLOCK_WEEKS; w++) done += doneIn(w); return done; };
  const freqLabel = () => n("d.freq.total", { done: blockTotal(), planned: PLANNED * BLOCK_WEEKS, n: nowWeek, total: BLOCK_WEEKS });
  const cellClass = (iso) => [sessionOn(iso) ? "is-on" : "", iso === T.TODAY ? "is-today" : "", iso > T.TODAY ? "is-future" : ""].filter(Boolean).join(" ");

  // A. The block as weeks by weekdays.
  function freqGrid() {
    const heads = weekdayLetters().map((c) => `<span>${c}</span>`).join("");
    const rows = Array.from({ length: BLOCK_WEEKS }, (_, i) => {
      const w = i + 1, future = w > nowWeek;
      const cells = [0, 1, 2, 3, 4, 5, 6].map((d) => `<i class="${cellClass(blockDay(w, d))}"></i>`).join("");
      return `<div class="d-fg__row${w === nowWeek ? " is-now" : ""}"><span class="d-fg__w">${n("d.freq.wk", { n: w })}</span>${cells}<span class="d-fg__n">${future ? "" : n("d.freq.count", { done: doneIn(w), planned: PLANNED })}</span></div>`;
    }).join("");
    return `<div class="d-freq d-fg" role="img" aria-label="${freqLabel()}"><div class="d-fg__row d-fg__head" aria-hidden="true"><span></span>${heads}<span></span></div>${rows}</div>`;
  }
  // B. A weekday strip inside each week header (drawn by history()).
  function weekStrip(w, labels) {
    const cells = [0, 1, 2, 3, 4, 5, 6].map((d, i) => `<i class="${cellClass(blockDay(w, d))}">${labels ? `<b>${weekdayLetters()[i]}</b>` : ""}</i>`).join("");
    return `<span class="d-ws${labels ? " d-ws--labels" : ""}" aria-hidden="true">${cells}</span>`;
  }
  // C. Weeks by training days: which program day happened, and when.
  function freqDays() {
    const heads = T.PROGRAM.days.map((d) => `<span>${T.two(d.name)}</span>`).join("");
    const rows = Array.from({ length: BLOCK_WEEKS }, (_, i) => {
      const w = i + 1;
      const cells = T.PROGRAM.days.map((_, di) => {
        const iso = [0, 1, 2, 3, 4, 5, 6].map((d) => blockDay(w, d)).find((x) => sessionOn(x) && sessionOn(x).day === di);
        return iso ? `<span class="d-fd__c is-on">${date.wd(iso)} ${date.day(iso)}</span>` : `<span class="d-fd__c${w > nowWeek || (w === nowWeek) ? " is-future" : ""}"></span>`;
      }).join("");
      return `<div class="d-fd__row${w === nowWeek ? " is-now" : ""}"><span class="d-fg__w">${n("d.freq.wk", { n: w })}</span>${cells}</div>`;
    }).join("");
    return `<div class="d-freq d-fd" role="img" aria-label="${freqLabel()}"><div class="d-fd__row d-fd__head" aria-hidden="true"><span></span>${heads}</div>${rows}</div>`;
  }
  // D. Planned slots per week, filled when done.
  function freqSlots() {
    const groups = Array.from({ length: BLOCK_WEEKS }, (_, i) => {
      const w = i + 1, done = doneIn(w);
      const dots = Array.from({ length: PLANNED }, (_, k) => `<i class="${k < done ? "is-on" : w > nowWeek ? "is-future" : ""}"></i>`).join("");
      return `<span class="d-fs__g${w === nowWeek ? " is-now" : ""}"><small>${n("d.freq.wk", { n: w })}</small><span>${dots}</span></span>`;
    }).join("");
    return `<div class="d-freq d-fs" role="img" aria-label="${freqLabel()}"><div class="d-fs__row" aria-hidden="true">${groups}</div><p class="d-fs__total" aria-hidden="true">${freqLabel()}</p></div>`;
  }
  // E. Two small counts: sessions per week against the plan, sessions by weekday.
  function freqBars() {
    const bars = (vals, max, labels, cls) => `<div class="d-fb__bars">${vals.map((v, i) => `<span class="d-fb__b${cls(i)}"><em>${v == null ? "" : v}</em><i style="height:${v ? Math.round((v / max) * 100) : 0}%"></i><small>${labels[i]}</small></span>`).join("")}</div>`;
    const perWeek = Array.from({ length: BLOCK_WEEKS }, (_, i) => (i + 1 > nowWeek ? null : doneIn(i + 1)));
    const perDay = [0, 1, 2, 3, 4, 5, 6].map((d) => { let c = 0; for (let w = 1; w <= nowWeek; w++) if (sessionOn(blockDay(w, d))) c++; return c; });
    const wkLabels = Array.from({ length: BLOCK_WEEKS }, (_, i) => n("d.freq.wk", { n: i + 1 }));
    return `<div class="d-freq d-fb" role="img" aria-label="${freqLabel()}">
      <div class="d-fb__col"><p>${n("d.freq.per_week")}</p><div class="d-fb__plot">${bars(perWeek, PLANNED, wkLabels, (i) => (i + 1 === nowWeek ? " is-now" : i + 1 > nowWeek ? " is-future" : ""))}<span class="d-fb__plan" aria-hidden="true"></span></div></div>
      <div class="d-fb__col"><p>${n("d.freq.per_weekday")}</p><div class="d-fb__plot">${bars(perDay.map((v) => v || null), nowWeek, weekdayLetters(), () => "")}</div></div>
    </div>`;
  }

  function history(U, freq) {
    const weeks = [[4, ["2026-09-21"]], [3, ["2026-09-18", "2026-09-16", "2026-09-14"]], [2, ["2026-09-11", "2026-09-09", "2026-09-07"]], [1, ["2026-09-04", "2026-09-02", "2026-08-31"]]];
    const sep = T.SESSIONS.filter((x) => x.date >= "2026-09-01");
    const sepSets = sep.reduce((t, x) => t + T.sessionTotals(x).sets, 0);
    const list = weeks.map(([w, ds], i) => `<div class="d-wk${freq === "b" ? " d-wk--strip" : ""}"><h2>${n("d.history.week", { n: w, done: ds.length, planned: 3 })}</h2>${freq === "b" ? weekStrip(w, i === 0) : ""}</div>${ds.map(sessRow).join("")}`).join("");
    const view = { a: freqGrid, c: freqDays, d: freqSlots, e: freqBars }[freq];
    const body = `
      <div class="d-pg">
        <div class="d-top d-top--h"><h1 class="d-h1 d-h1--page">${s("history.title")}</h1><div class="d-top__r"><button class="d-icb" aria-label="${n("d.history.search")}">${ic("search")}</button><button class="d-icb" data-sheet="cal" aria-label="${n("d.history.calendar")}">${calIcon()}</button></div></div>
        ${view ? `<div class="d-sec d-sec--freq"><h2 class="d-h2">${n("d.freq.title")}</h2></div>${view()}` : ""}
        <p class="d-month"><b>${s("history.month_title", { month: date.month(8), year: 2026 })}</b><span>${s("history.month_summary", { sessions: sep.length, sets: sepSets })}</span></p>
        ${list}
      </div>`;
    return { body, over: X.dock("history") + (U.sheet === "cal" ? calSheet() : "") };
  }
  const calIcon = () => `<svg class="ic-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`;
  function calSheet() {
    const on = T.SESSIONS.filter((x) => x.date >= "2026-09-01").map((x) => T.date.day(x.date));
    const heads = (T.state.lang === "pt" ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"]).map((c) => `<span class="d-cal__h">${c}</span>`).join("");
    let cells = `<span class="d-cal__d is-out">31</span>`;
    for (let d = 1; d <= 30; d++) cells += `<span class="d-cal__d${on.includes(d) ? " is-on" : ""}${d === 21 ? " is-today" : ""}">${d}</span>`;
    for (let d = 1; d <= 4; d++) cells += `<span class="d-cal__d is-out">${d}</span>`;
    const body = `<div class="d-calhead"><button class="d-icb" aria-label="${s("history.calendar_prev_aria")}">${ic("chev", "rot-r")}</button><h2 class="d-sheet__t">${s("history.month_title", { month: date.month(8), year: 2026 })}</h2><button class="d-icb" aria-label="${s("history.calendar_next_aria")}">${ic("chev", "rot-l")}</button></div><div class="d-cal">${heads}${cells}</div><p class="d-sheet__sub">${n("d.history.cal_hint")}</p>`;
    return X.sheet({ title: s("history.month_title", { month: date.month(8), year: 2026 }), close: "history", body });
  }

  /* ---------------- 5.10 History session ---------------- */
  function session() {
    const iso = T.TODAY, sn = D.session(iso), prs = D.prsFor(iso);
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), pr = prs.find((p) => p.k === k), pd = D.previousDate(k, iso);
      return `<div class="d-grp d-grp--s">
        <div class="d-grp__h"><span class="d-grp__n">${D.name(k)}</span><span class="d-grp__tags">${pr ? `<span class="d-pr">PR</span>` : ""}<span class="d-out${o.state === "insufficient" ? " is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</span></span></div>
        ${pd ? `<p class="d-grp__before">${n("d.history.before", { date: date.short(pd), sets: D.setsLine(setsOnly(k, pd)) })}</p>` : ""}
        ${setsOnly(k, iso).map((x, i) => `<div class="d-set d-set--ro"><span class="d-set__n">${i + 1}</span><span class="d-set__v">${num(x.load)}</span><span class="d-set__v">${x.reps}</span><span class="d-set__v">${x.rir == null ? "–" : x.rir}</span></div>`).join("")}
      </div>`;
    }).join("");
    const body = `
      <div class="d-pg">
        <button class="d-back" data-go="history">${ic("chev", "rot-r")}${s("history.title")}</button>
        <h1 class="d-h1">${T.two(sn.dayName)}</h1>
        <p class="d-lede">${n("d.saved_week", { date: date.long(iso), n: sn.week })}</p>
        <div class="d-totals">
          <div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div>
          <div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div>
          <div><b>${prs.length}</b><span>${s("stats.metric.prs")}</span></div>
        </div>
        ${colHead([n("d.col.set"), U_, "reps", "RIR"], "d-cols--set d-cols--sticky")}
        ${groups}
        <div class="d-actions"><button class="x-sec">${ic("pencil")}${s("history.session.edit")}</button><button class="d-danger">${s("history.session.delete")}</button></div>
      </div>`;
    return { body, over: X.dock("history") };
  }

  /* ---------------- 5.11 Program ---------------- */
  function program() {
    const days = T.PROGRAM.days.map((d, di) => {
      const rows = d.lifts.map((k) => {
        const r = di === 0 ? D.rec(k, T.TODAY) : D.rec(k, "2026-09-22", "next");
        const e = T.EX[k];
        return `<div class="d-prow"><span class="d-row__name">${D.name(k)}<small>${s("program.progression.strategy." + D.strategyOf(k))}</small></span><span class="d-mono">${ops(`${e.n} × ${e.r[0]}–${e.r[1]}`)}</span><span class="d-prow__n"${X.tgt(r)}>${mark(r.glyph)}${num(r.load)}</span></div>`;
      }).join("");
      return `<div class="d-day"><div class="d-day__h"><b>${T.two(d.name)}</b><span>${n("d.program.day_meta", { muscles: T.muList(T.dayMuscles(di).slice(0, 3)), sets: T.daySets(di) })}</span></div>
        ${colHead([n("d.col.exercise"), n("d.col.sets_range"), n("d.col.next")], "d-cols--prog")}
        ${di === 0 ? `<p class="d-legend">${n("d.program.legend")}</p>` : ""}
        ${rows}</div>`;
    }).join("");
    const body = `
      <div class="d-pg">
        <div class="d-top d-top--h"><span class="d-date">${s("program.title")}</span><button class="d-textbtn">${s("program.edit")}</button></div>
        <h1 class="d-h1">${T.two(T.PROGRAM.name)}</h1>
        <p class="d-lede">${n("d.program.lede", { goal: T.two(T.PROGRAM.goal), n: 4, total: 6 })}</p>
        ${weekRule(4, 6)}
        <p class="d-status">${n("d.program.status", { status: s("status.on_track"), n: 3, m: 3 })}</p>
        ${days}
      </div>`;
    return { body, over: X.dock("program") };
  }

  /* ---------------- OG-6 rounds 1 and 2 ----------------
     The nine Today and workout-sheet states the first drawings left open.
     Each carries every element and action of the real state (the catalog
     frames at unified-convergence), restyled on D's components: the sheet
     header band, ledger rows, the shelf, hairline-ruled groups. */

  // Today, an unfinished session: a status band above the prescription, and a confirmation before another day replaces the draft.
  const resumeBand = (ctx) => `<div class="d-resume" role="status"><b>${n("d.og6.resume.title")}</b><span>${n("d.head.day_ex", { day: T.two(ctx.dayName), n: 1, m: ctx.lifts.length })}</span></div>`;

  function discardDialog() {
    const foot = `<button class="x-cta" data-sheet="days">${s("dialog.cancel")}</button><button class="x-sec x-sec--danger" data-go="today">${s("draft.recovery.discard")}</button>`;
    return X.sheet({ title: s("draft.recovery.discard"), label: s("confirm.discard_draft"), noClose: true, over: true, closeAttr: 'data-sheet="days"', cls: "d-confirm", body: `<p class="d-confirm__t">${s("confirm.discard_draft")}</p>`, foot });
  }

  // Today, the day is complete: the saved session's totals, records and outcomes, then the week and what comes next.
  function todayDone() {
    const iso = T.TODAY, sn = D.session(iso), prs = D.prsFor(iso);
    const groups = sn.lifts.map((k) => {
      const o = D.canonicalOutcome(k, iso), nx = D.rec(k, iso, "next");
      return `<div class="d-grp d-grp--c">
        <div class="d-grp__h"><span class="d-grp__n">${D.name(k)}</span><span class="d-out${o.state === "insufficient" ? " is-insuf" : ""}" data-outcome="${o.k}@${o.iso}">${o.word}</span></div>
        <p class="d-grp__next"${X.tgt(nx)}>${mark(nx.glyph)}<span>${withMono(n("d.next_target", { target: "\u0000" }), ops(nx.next))}</span></p>
      </div>`;
    }).join("");
    const body = `
      <div class="d-pg">
        <div class="d-top">
          <span class="d-date">${date.long(iso)}</span>
          <div class="d-top__r"><button class="d-icb" aria-label="${n("d.settings")}">${ic("gear")}</button></div>
        </div>
        <p class="d-eyebrow d-eyebrow--done">${ic("check")}<span>${s("today.done_label")}</span></p>
        <h1 class="d-h1">${T.two(sn.dayName)}</h1>
        <p class="d-lede">${n("d.lede_week", { program: T.two(T.PROGRAM.name), n: sn.week, total: 6 })}</p>
        ${weekRule(sn.week, 6)}
        <div class="d-totals">
          <div><b>${sn.sets}</b><span>${n("d.totals.sets")}</span></div>
          <div><b>${num(sn.vol, 0)}</b><span>${s("summary.stat.moved", { unit: U_ })}</span></div>
          <div><b>${sn.lifts.length}</b><span>${n("d.totals.lifts")}</span></div>
        </div>
        ${prs.length ? `<p class="d-pr d-pr--day">${prs.length === 1 ? s("today.done_pr_one") : s("today.done_prs", { n: prs.length })}</p>` : ""}
        <p class="d-donenote">${s("today.done_note")}</p>
        <button class="x-sec d-another" data-go="workout">${s("today.done_another")}</button>
        <div class="d-sec"><h2 class="d-h2">${n("d.outcome.head")}</h2></div>
        ${groups}
        <div class="d-split d-split--one">
          <div><span class="d-k">${s("today.this_week")}</span><span class="d-v">${n("d.week_line", { done: 1, planned: 3 })}</span></div>
        </div>
        <button class="d-upnext" data-go="today"><span><span class="d-k">${s("today.up_next")}</span><b>${T.two(T.PROGRAM.days[1].name)}</b><small>${s("today.exercise_count", { n: T.PROGRAM.days[1].lifts.length })}</small></span>${ic("chev", "rot-l")}</button>
      </div>`;
    const cta = `<div class="x-ctabar"><button class="x-cta x-cta--go" data-go="session">${s("today.done_review")}${ic("arrow", "x-cta__ar")}</button></div>`;
    return { body, over: cta + X.dock("today"), cls: "x-has-cta" };
  }

  // The focus page behind a sheet: the lift's own page with the shelf in place, as the lifter left it.
  const SKIPCTX = { ...MAIN, lifts: MAIN.lifts.filter((k) => k !== "sq") };
  const SUBCTX = { ...MAIN, lifts: ["hk", ...MAIN.lifts.slice(1)] };
  function under(U, ctx, k, phase, sheetHtml, fopts = {}) {
    const resting = phase === "rest";
    return { body: focusBody(U, ctx, k, phase, { warm: !!U.warm, ...fopts }), over: X.shelf(U, { setNo: resting ? 2 : 1, correcting: false, resting }) + sheetHtml, cls: "no-dock x-has-shelf" };
  }

  // A form field on a sheet: a caption over a real input, 44 px at least, on the field ground and the required boundary.
  const fld = (label, inner, cls = "") => `<label class="d-fld ${cls}"><small>${label}</small>${inner}</label>`;
  const isoField = (iso) => { const [y, m, d] = iso.split("-"); return T.state.lang === "pt" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`; };

  // Exercise note (focus.note.*): Cancel and Save are the sheet's own, so there is no close button.
  function noteSheet() {
    const foot = `<button class="x-sec" data-go="workout">${s("dialog.cancel")}</button><button class="x-cta" data-go="workout">${s("dialog.save")}</button>`;
    const body = `<h2 class="d-sheet__t">${s("focus.note.title")}</h2><p class="d-sheet__sub">${D.name("sq")}</p>
      <div class="d-fld d-fld--area d-fld--focus"><textarea rows="6" aria-label="${esc(s("focus.note.title"))}" placeholder="${esc(s("log.note.placeholder"))}"></textarea></div>
      <p class="d-hint">${s("focus.note.carry")}</p>`;
    return X.sheet({ title: s("focus.note.title"), noClose: true, closeAttr: 'data-go="workout"', body, foot, cls: "d-notesheet" });
  }

  /* The Session sheet (the table-view button, implementation spec decision 11):
     the session map with reorder first, then date, bodyweight and notes; early
     finish waits in the foot and, once chosen, opens its confirmation there. */
  function sessionSheet({ order, done = {}, early = false }) {
    const total = (k) => T.EX[k].n;
    const rows = order.map((k, i) => {
      const complete = done[k] === total(k);
      const name = D.name(k);
      return `<div class="d-map__row${k === "sq" ? " is-cur" : ""}"${k === "sq" ? ' aria-current="true"' : ""}>
        <button class="d-map__jump" data-go="workout"><span class="d-map__n">${name}</span><span class="d-map__s">${complete ? ic("check") : ""}${done[k] || 0}/${total(k)}</span></button>
        <button class="d-map__mv" data-go="${early ? "workout-session" : "workout-reorder"}" aria-label="${esc(s("session.sheet.reorder_up_aria", { name }))}"${i === 0 ? " disabled" : ""}>${ic("chev", "rot-180")}</button>
        <button class="d-map__mv" data-go="${early ? "workout-session" : "workout-reorder"}" aria-label="${esc(s("session.sheet.reorder_down_aria", { name }))}"${i === order.length - 1 ? " disabled" : ""}>${ic("chev")}</button>
      </div>`;
    }).join("");
    const omitted = order.map((k) => {
      const sets = [];
      for (let i = (done[k] || 0) + 1; i <= total(k); i++) sets.push(i);
      return sets.length ? `<li>${withMono(s("session.sheet.omitted", { name: D.name(k), sets: "\u0000" }), sets.join(", "))}</li>` : "";
    }).join("");
    const body = `<h2 class="d-sheet__t">${s("session.sheet.title")}</h2><p class="d-sheet__sub">${s("session.sheet.subtitle")}</p>
      <h3 class="d-xs__h d-xs__h--first">${s("session.sheet.overview_label")}</h3>
      <div class="d-map" role="group" aria-label="${esc(s("session.sheet.title"))}">${rows}</div>
      <div class="d-flds">
        ${fld(s("log.date"), `<input value="${isoField(T.TODAY)}" inputmode="numeric" autocomplete="off">`, "d-fld--date")}
        ${fld(s("log.bodyweight_unit", { unit: U_ }), `<input inputmode="decimal" placeholder="${U_}" autocomplete="off">`)}
        ${fld(s("log.notes"), `<textarea rows="3" placeholder="${esc(s("log.notes.placeholder"))}"></textarea>`, "d-fld--area")}
      </div>`;
    const foot = early
      ? `<p class="d-early__msg" role="status">${s("session.sheet.early_prompt")}</p><ul class="d-early__list">${omitted}</ul>
         <button class="x-cta" data-go="summary">${s("session.sheet.early_confirm")}</button><button class="x-sec" data-go="workout-session">${s("dialog.cancel")}</button>`
      : `<button class="x-sec" data-go="workout-early-finish">${s("session.sheet.early_finish")}</button>`;
    return X.sheet({ title: s("session.sheet.title"), close: "workout", body, foot, cls: "d-sessheet" });
  }

  // The exercise actions sheet as shipped: setup notes, previous values, substitution, warm-up sets, status, notes.
  function exActionsSheet({ k, instead, warm, skipped }) {
    const e = D.lift(k), setsN = T.EX[k].n;
    const group = (head, inner, extra = "") => `<section class="d-xs"><h3 class="d-xs__h">${head}</h3>${extra}${inner}</section>`;
    const act = (icn, label, go, sub, attrs = "") => `<button class="d-act d-act--s"${go ? ` data-go="${go}"` : ""}${attrs}>${ic(icn)}<span>${label}${sub ? `<small>${sub}</small>` : ""}</span></button>`;
    const pd = D.previousDate(k, T.TODAY);
    // Setup notes belong to the program's slot, so a substitute shows the notes of the lift it stands in for.
    const slot = T.EX[instead || k];
    const note = slot.note ? T.two(slot.note) : s("ex.actions.no_setup_notes");
    const sub = instead
      ? [group(s("ex.actions.subst_title"), `<div class="d-acts">${act("reset", s("ex.actions.change_substitution"), "workout-substituted-actions")}${act("reset", s("ex.actions.restore_original"), "workout")}</div>`)]
      : [group(s("ex.actions.subst_title"), `<div class="d-acts">${act("reset", s("ex.actions.substitute"), "workout-substituted-actions")}</div>`)];
    const wrows = Array.from({ length: setsN }, (_, i) => {
      const isW = warm && i === 0;
      return `<div class="d-wrow"><span class="d-wrow__i"><b>${s("log.set")} ${i + 1}</b><span class="d-wrow__r${isW ? " is-warm" : ""}">${s(isW ? "ex.actions.role_warmup" : "ex.actions.role_working")}</span></span><button class="d-wbtn"${i === 0 ? ' data-toggle="warm"' : ""}>${s(isW ? "ex.actions.mark_working" : "ex.actions.mark_warmup")}</button></div>`;
    }).join("");
    const status = group(s("ex.actions.skip_title"), `<div class="d-acts">${act("skip", s(skipped ? "ex.actions.restore" : "ex.actions.skip"), skipped ? "workout" : "workout-skipped-actions")}</div>`, skipped ? `<p class="d-xs__v">${s("log.skipped")}</p>` : "");
    const body = `<p class="d-sheet__eyebrow">${s("ex.actions.title")}</p>
      <h2 class="d-sheet__t d-sheet__t--ex">${D.name(k)}</h2>
      <p class="d-sheet__sub">${instead ? `${s("log.substitute_for", { name: D.name(instead) })}<br>` : ""}${T.muList(e.pri)} · ${setsN} ${s("plural.set.other")}</p>
      ${group(s("ex.actions.setup_notes"), `<p class="d-xs__t">${note}</p>`)}
      ${group(s("ex.actions.history_title"), `<div class="d-acts">${act("history", s("ex.actions.repeat_last"), null, pd ? n("d.sub.before", { sets: D.setsLine(setsOnly(k, pd)) }) : s("ex.actions.no_history"))}</div>`)}
      ${sub.join("")}
      ${group(s("ex.actions.warmup_title"), `<div class="d-wrows" role="group">${wrows}</div>`)}
      ${status}
      ${group(s("ex.actions.notes_title"), `<div class="d-acts">${act("note", s("ex.actions.open_notes"), "workout-exercise-note")}</div>`)}`;
    return X.sheet({ title: D.name(k), label: s("ex.actions.title"), closeAttr: 'data-sheet="closed"', body, cls: "d-actsheet" });
  }

  const todayResume = (U) => today(U, MAIN, { resume: true });
  const exNote = (U) => under(U, MAIN, "sq", "set1", noteSheet());
  const REORDERED = ["pr", "sq", "lc", "rw", "lr"];
  const workoutSession = (U) => under(U, MAIN, "sq", "set1", sessionSheet({ order: MAIN.lifts }));
  const workoutReorder = (U) => {
    const ctx = { ...MAIN, lifts: REORDERED };
    const toast = `<div class="x-toast" role="status">${s("session.sheet.reorder_announcement", { name: D.name("sq"), index: 2, count: REORDERED.length })}</div>`;
    return under(U, ctx, "sq", "set1", sessionSheet({ order: REORDERED }) + toast);
  };
  const workoutEarly = (U) => under(U, MAIN, "sq", "rest", sessionSheet({ order: MAIN.lifts, done: { sq: 1 }, early: true }));
  // The actions sheet opens with its screen. Closing it leaves the lift's page and shelf; the ⋯ button opens it again.
  const actionsUnder = (U, ctx, k, sheetOpts, fopts) => under(U, ctx, k, "set1", U.sheet === "timer" ? timerSheet(U, "workout") : U.sheet === "closed" ? "" : exActionsSheet(sheetOpts), fopts);
  const workoutWarm = (U) => actionsUnder(U, MAIN, "sq", { k: "sq", warm: !!U.warm });
  const workoutSkipped = (U) => actionsUnder(U, SKIPCTX, "pr", { k: "sq", skipped: true });
  const workoutSubstituted = (U) => actionsUnder(U, SUBCTX, "hk", { k: "hk", instead: "sq" }, { instead: "sq" });

  root.DIR_D = {
    key: "d", family: true, name: "Folha e polegar", en: "Sheet and thumb",
    idea: "A's record, B's hand: read everything as a ledger of aligned columns and hairlines, act on every set from one bottom shelf.",
    screens: {
      today: (U) => today(U, MAIN), workout, why, rest, "why-set2": whySet2,
      summary: (U) => summary(U, T.TODAY), summary2: (U) => summary(U, T.LAST_DAY3),
      progress, chart, history: (U) => history(U), session, program,
      "history-freq-a": (U) => history(U, "a"), "history-freq-b": (U) => history(U, "b"), "history-freq-c": (U) => history(U, "c"),
      "history-freq-d": (U) => history(U, "d"), "history-freq-e": (U) => history(U, "e"),
      "today-mixed": (U) => today(U, MIXD), "why-repgoal": whyMix("ht"), "why-anchor": whyMix("dl"), "why-manual": whyMix("cp"),
      "summary-first": (U) => summary(U, D.MIX.first, true),
      "workout-mixed": workoutMixed,
      // OG-6 rounds 1 and 2
      "today-done": todayDone, "today-draft-resume": todayResume,
      "workout-exercise-note": exNote, "workout-session": workoutSession, "workout-early-finish": workoutEarly,
      "workout-warmup-actions": workoutWarm, "workout-reorder": workoutReorder,
      "workout-skipped-actions": workoutSkipped, "workout-substituted-actions": workoutSubstituted,
    },
    // Shelf values when a screen opens: the engine's load and reps, the lifter's typical RIR.
    seed(screen) {
      const k = { "why-repgoal": "ht", "why-anchor": "dl", "why-manual": "cp", "workout-mixed": "dl", "workout-skipped-actions": "pr", "workout-substituted-actions": "hk" }[screen] || "sq";
      const iso = D.isMix(k) ? D.MIX.today : T.TODAY;
      const resting = screen === "rest" || screen === "why-set2" || screen === "workout-early-finish";
      const r = resting ? D.rec("sq", T.TODAY, "today", [{ load: 102.5, reps: 7, rir: 1 }]) : D.rec(k, iso);
      const rir = r.facts && r.facts.typicalRir != null ? r.facts.typicalRir : 1;
      // The warm-up drawing opens with set 1 already marked a warm-up set.
      return { load: r.load, reps: r.reps != null ? r.reps : r.manual ? r.manual.hi : 8, rir: Math.round(rir), warm: screen === "workout-warmup-actions" };
    },
    notes: {
      today: "A's prescription table at B's figure scale: load, target and last session for all five lifts on the first screen. The tally replaces A's footer sentence.",
      workout: "The ledger holds every set; the shelf holds every control. Reps is selected, load comes from the engine, and a second tap on a field opens the keyboard.",
      why: "Sentences first, from the shipped why.* keys, with the RIR they used. The worked calculation is one tap away under Ver o cálculo.",
      "why-set2": "Opened from set 2's cue while resting: set 1 showed a capacity of 8; about 7,5 is the prediction for set 2. The two are never swapped.",
      rest: "Rest is a state of the focus screen. The clock takes the cue slot, the pads become rest controls, and Registrar série 2 stays live.",
      summary: "One group per lift, ending on its next target. The squat reads Manteve beside its load PR: a prescribed increase is judged on strength, not on the expected rep drop.",
      summary2: "The same structure without PR lines. Same load with fewer reps reads Regressou, in ink, never red.",
      progress: "Attention rows are full-width buttons with the shipped verdict and reason, evidence in soft text. Strength defaults to Maior carga.",
      chart: "One honest series in the selected metric's units. Load increases are the step itself with a small tick; the table selects the same points.",
      history: "Weeks, not a calendar strip. The calendar is one button away as a sheet.",
      "history-freq-a": "A. The block as a grid: six weeks down, seven weekdays across. A routine shows as columns; this week's count sits at the end of its row.",
      "history-freq-b": "B. No new region: each week header carries its own seven-day strip, aligned so the columns line up as you scroll.",
      "history-freq-c": "C. Weeks by training days: which program day was done each week, and on which date. Adherence rather than calendar frequency.",
      "history-freq-d": "D. Planned slots: three per week, one per program day, filled as sessions land. The most compact; it drops the weekday.",
      "history-freq-e": "E. Two small counts: sessions per week against the plan line, and sessions by weekday, which shows the habit without a calendar.",
      session: "A page, not a sheet: each lift with its canonical outcome and the previous exposure above its sets.",
      program: "Every day open. Próxima is the engine's next load, the strategy name sits under each exercise.",
      "today-mixed": "Every strategy on one Today: anchor 1 + 2, rep goal total 36, fixed effort, manual in soft ink with no mark, a custom exercise and a set logged without RIR.",
      "why-repgoal": "Rep goal: the total, the effort gate and how the reps split, all from why.repgoal.* and rec.repgoal.*.",
      "why-anchor": "Anchor and back-off: the performed top set, the rule, and the percentage that sets the lighter sets.",
      "why-manual": "Manual: one sentence. The program sets the load and the engine does not change it.",
      "summary-first": "Every lift is a first exposure: the shipped baseline sentence, no outcome words, and next targets from the engine.",
      "today-done": "OG-6 round 1. The day is complete: eyebrow, totals, record count, the shipped note, the second-session action, each lift's outcome and next target, the week line and the next day as a button. The start button becomes Ver a sessão de hoje.",
      "today-draft-resume": "OG-6 round 1. Today with an unfinished session: a status band above the prescription, Continuar sessão on the CTA, and the confirmation that appears when Escolher outro dia would replace the draft.",
      "workout-exercise-note": "OG-6 round 2. The exercise note: a sheet with its own Cancelar and Salvar, the field in the quiet selected state, and the carry-over line under it.",
      "workout-session": "OG-6 round 2. The Session sheet, opened from the table-view button: the session map with reorder first, then date, bodyweight and notes; early finish sits in the foot.",
      "workout-early-finish": "OG-6 round 2. Early finish chosen after one logged set: the foot opens the confirmation with the unlogged sets listed per lift, a confirm button and Cancelar.",
      "workout-warmup-actions": "OG-6 round 2. The exercise actions sheet with set 1 marked a warm-up set. The ledger behind it carries the warm-up label instead of a number.",
      "workout-reorder": "OG-6 round 2. After moving the squat down one place: the map in its new order, the first and last buttons off, and the shipped announcement as a toast.",
      "workout-skipped-actions": "OG-6 round 2. A skipped exercise reopened from the session map: its status reads Pulado and the action is Restaurar exercício. The lifter is on the next lift, exercise 1 of 4.",
      "workout-substituted-actions": "OG-6 round 2. A substituted exercise: the sheet carries the substitute's name and No lugar de the original, with Alterar substituição and Restaurar exercício original.",
    },
  };
})(window);
