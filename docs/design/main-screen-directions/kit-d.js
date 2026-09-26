/* Direction D family: shared components. D, E, F and G all build from these,
   so the dock, sheets, shelf, chart and marks behave the same in every
   candidate. Styles live in phone.css under .dx (shared) and each
   candidate's own scope. */
(function (root) {
  "use strict";
  const T = root.TX, K = root.KIT, D = root.DX;
  const { s, n, num } = D;
  const { ic, esc } = K;

  // Verdict glyph. Manual slots carry no mark but keep the column.
  const mark = (glyph, cls = "") => (glyph === "manual" || !glyph ? `<span class="mk mk--none ${cls}" aria-hidden="true"></span>` : K.mark(glyph, cls));

  // The production glass capsule: 62 px, four columns, active icon orange.
  function dock(active) {
    const items = [["today", "home", s("nav.log")], ["progress", "stats", s("nav.stats")], ["history", "history", s("nav.history")], ["program", "program", s("nav.program")]];
    return `<div class="x-fade" aria-hidden="true"></div><nav class="x-dock" aria-label="${s("nav.aria")}">${items.map(([id, i, l]) => `<button class="x-dock__b${id === active ? " is-on" : ""}" data-go="${id}"${id === active ? ' aria-current="page"' : ""}>${ic(i)}<span>${l}</span></button>`).join("")}</nav>`;
  }

  // Exercise artwork: only in the workout header. Empty tile when there is no plate.
  function art(k, cls = "") {
    const e = D.lift(k);
    if (!e.art) return `<span class="x-art x-art--empty ${cls}" aria-hidden="true"></span>`;
    return `<span class="x-art ${cls}" style="--art-bg:${e.bg}" aria-hidden="true"><img src="${e.art}" alt="" loading="lazy"></span>`;
  }

  function sheet({ title, body, close = "workout", cls = "", label }) {
    return `<div class="scrim" data-go="${close}"></div>
      <section class="x-sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
        <div class="grab" aria-hidden="true"></div>
        <button class="x-close" data-go="${close}" aria-label="${n("d.why.close")}">${ic("close")}</button>
        <div class="x-sheet__body">${body}</div>
      </section>`;
  }

  // Scrollable tab row. Every tab is at least 44 x 44.
  const tabs = (items, on, label) => `<div class="x-tabs" role="tablist" aria-label="${esc(label)}"><div class="x-tabs__in">${items.map((l, i) => `<button role="tab" aria-selected="${i === on}" class="${i === on ? "is-on" : ""}">${l}</button>`).join("")}</div></div>`;

  // Segmented control; each option carries its own data attribute.
  const seg = (items, label) => `<div class="x-seg" role="group" aria-label="${esc(label)}">${items.map(([attr, v, l, on]) => `<button ${attr}="${v}" aria-pressed="${!!on}">${l}</button>`).join("")}</div>`;

  /* The shelf: the only controls during a set.
     Field row, then either the step pads or, while resting, the rest controls,
     then the CTA. Reps is selected by default; a second tap on the selected
     field turns it into a real input. */
  function shelf(U, { setNo, correcting, resting, loadStep = 2.5 }) {
    const f = U.field || "reps";
    const vals = { load: num(U.load), reps: U.reps, rir: U.rir };
    const labels = { load: n("d.field.load"), reps: s("stats.table.reps"), rir: s("stats.table.rir") };
    const field = (id) => {
      const on = f === id;
      if (on && U.editing) {
        return `<label class="x-field is-sel is-edit"><small>${labels[id]}</small><input inputmode="decimal" data-input="${id}" value="${vals[id]}" aria-label="${labels[id]}"></label>`;
      }
      return `<button class="x-field${on ? " is-sel" : ""}" data-field="${id}" aria-pressed="${on}"><small>${labels[id]}</small><b>${vals[id]}</b></button>`;
    };
    const showRest = resting && U.shelfMode !== "pads" && U.rest > 0;
    const pads = showRest
      ? `<div class="x-pads x-pads--4">
          <button data-act="rest-30">−30 s</button>
          <button data-act="rest-pause">${U.running ? n("d.rest.pause") : n("d.rest.resume")}</button>
          <button data-act="rest+30">+30 s</button>
          <button data-act="rest-skip">${n("d.rest.skip")}</button>
        </div>`
      : (() => {
        const lab = (sign) => (f === "load" ? n("d.pad.load", { sign, step: num(loadStep) }) : f === "reps" ? n("d.pad.reps", { sign }) : n("d.pad.rir", { sign }));
        return `<div class="x-pads"><button data-act="dec">${lab("−")}</button><button data-act="inc">${lab("+")}</button></div>`;
      })();
    const cta = correcting ? n("d.save_set", { n: setNo }) : n("d.log_set", { n: setNo });
    return `<div class="x-shelf" role="region" aria-label="${cta}">
      <div class="x-fields">${field("load")}${field("reps")}${field("rir")}</div>
      ${pads}
      <button class="x-cta" data-go="${resting ? "summary" : "rest"}" data-log="1">${cta}</button>
    </div>`;
  }

  /* Honest chart: one series, the axis in the selected metric's units, the
     block start ruled, load increases drawn as the step itself with a small
     tick. The whole plot is one target that snaps to the nearest session;
     the table under it selects the same points with 48 px rows. */
  function chart(k, U, opts = {}) {
    const metric = U.metric === "e1rm" ? "e1rm" : "top";
    const all = D.series(k);
    const S = U.scope === "all" ? all : all.filter((x) => x.block);
    const vals = S.map((x) => (metric === "top" ? x.top : x.e1rm));
    const W = opts.w || 328, H = opts.h || 190, padL = 34, padR = 12, padT = 20, padB = 24;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const stepGuess = hi - lo > 12 ? 5 : 2.5;
    lo = Math.floor((lo - stepGuess * 0.6) / stepGuess) * stepGuess; hi = Math.ceil((hi + stepGuess * 0.6) / stepGuess) * stepGuess;
    const x = (i) => padL + (S.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (S.length - 1));
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const sel = U.pt == null || U.pt >= S.length ? S.length - 1 : U.pt;
    let g = "";
    const ticks = [];
    for (let t = lo; t <= hi + 1e-6; t += stepGuess) ticks.push(t);
    const every = ticks.length > 5 ? 2 : 1;
    ticks.forEach((t, i) => {
      g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="ch-grid"/>`;
      if (i % every === 0) g += `<text x="${padL - 6}" y="${(y(t) + 3.5).toFixed(1)}" class="ch-ax" text-anchor="end">${num(t)}</text>`;
    });
    const bi = S.findIndex((z) => z.block);
    if (bi > 0) {
      const bx = (x(bi - 1) + x(bi)) / 2;
      g += `<line x1="${bx}" x2="${bx}" y1="${padT - 12}" y2="${H - padB}" class="ch-block"/>`;
      g += `<text x="${bx + 4}" y="${padT - 4}" class="ch-ax ch-ax--l">${s("stats.scope.current_block")}</text>`;
    }
    let d;
    if (metric === "top") {
      d = S.map((z, i) => (i ? `H${x(i).toFixed(1)} V${y(vals[i]).toFixed(1)}` : `M${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`)).join(" ");
    } else d = S.map((z, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`).join(" ");
    g += `<path d="${d}" class="ch-line"/>`;
    S.forEach((z, i) => {
      if (metric === "top" && z.up && i > 0) g += `<path d="M${(x(i) - 4).toFixed(1)} ${(H - padB - 2).toFixed(1)} l4 -6 l4 6 z" class="x-tick"/>`;
      g += `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="${i === sel ? 5 : 3}" class="${i === sel ? "x-pt x-pt--sel" : z.block ? "x-pt" : "x-pt x-pt--old"}"/>`;
    });
    g += `<line x1="${x(sel).toFixed(1)}" x2="${x(sel).toFixed(1)}" y1="${padT - 6}" y2="${H - padB}" class="x-cursor"/>`;
    g += `<text x="${padL}" y="${H - 6}" class="ch-ax">${T.date.short(S[0].date)}</text><text x="${W - padR}" y="${H - 6}" class="ch-ax" text-anchor="end">${T.date.short(S[S.length - 1].date)}</text>`;
    const label = metric === "top" ? s("stats.metric.top_load") : s("stats.metric.best_e1rm");
    const xs = S.map((z, i) => ((x(i) / W) * 100).toFixed(2)).join(",");
    const svg = `<svg class="chart x-chart" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
    return { svg, S, vals, sel, label, xs, metric };
  }

  // A chart point's source set: "102,5 × 7".
  const setOf = (z) => `${num(z.top)} × ${z.topReps}`;

  function sparkline(values, w = 60, h = 22) { return K.sparkline(values, w, h, "spark x-spark"); }

  const fmtTime = K.fmtTime;

  /* ---------- shared wording ---------- */
  // "3 × 4–8 reps · RIR 0–2 · Faixa de repetições", per strategy.
  function exMeta(k) {
    const p = D.paramsOf(k), st = D.strategyOf(k), strat = s("program.progression.strategy." + st);
    if (st === "range") return n("d.exmeta.range", { sets: p.workingSets, min: p.repMin, max: p.repMax, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "rep_goal") return n("d.exmeta.goal", { sets: p.workingSets, goal: p.repGoal, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "effort_target") return n("d.exmeta.effort", { sets: p.workingSets, reps: p.targetReps, rmin: p.targetRirMin, rmax: p.targetRirMax }) + " · " + strat;
    if (st === "anchor_backoff") return n("d.exmeta.anchor", { amin: p.anchorRepMin, amax: p.anchorRepMax, n: p.backoffSets, bmin: p.backoffRepMin, bmax: p.backoffRepMax }) + " · " + strat;
    const m = D.MANUAL[k];
    return n("d.exmeta.manual", { sets: m.sets, min: m.lo, max: m.hi }) + " · " + strat;
  }
  // The cue, from focus.cue.*: line 1 with the load in mono, line 2 the reps.
  function cue(r) {
    if (r.glyph === "manual") return { glyph: null, l1: `${s("program.progression.strategy.manual")}: <b class="x-mono">${num(r.load)}</b> kg`, l2: `${r.manual.lo}–${r.manual.hi} reps` };
    const verb = r.glyph === "up" ? "focus.cue.up" : r.glyph === "down" ? "focus.cue.down" : "focus.cue.hold";
    const l1 = s(verb, { load: "\u0000", unit: "kg" }).replace("\u0000", `<b class="x-mono">${num(r.load)}</b>`);
    const reps = r.strategy === "rep_goal" ? r.sets.map((x) => x.reps).join(", ") : r.reps;
    return { glyph: r.glyph, l1, l2: s("focus.cue.reps", { reps }) };
  }
  // Per-set targets for a recommendation: [{label, load, reps, rir}]
  function targets(r) {
    if (r.glyph === "manual") return Array.from({ length: r.manual.sets }, (_, i) => ({ label: String(i + 1), load: r.load, reps: `${r.manual.lo}–${r.manual.hi}`, rir: null }));
    return r.sets.map((t, i) => ({ label: String(i + 1), load: t.load, reps: t.reps, rir: t.targetRirMin != null ? `${num(t.targetRirMin)}–${num(t.targetRirMax)}` : `0–${t.targetRir != null ? t.targetRir : 2}` }));
  }
  const prevLine = (p) => (p ? (D.hasEffort(p) ? n("d.prev_line", { load: num(p.load), reps: p.reps, rir: num(p.rir) }) : n("d.prev_line_norir", { load: num(p.load), reps: p.reps })) : "");
  // Why-sheet content shared by every candidate: blocks, calculation rows, evidence.
  function whyParts(k, iso, variant, U, cls = "x") {
    const w = D.why(k, iso, variant);
    const blocks = w.blocks.map((b) => `<div class="${cls}-reason">${b.label ? `<p class="${cls}-reason__lab">${b.label}</p>` : ""}<b>${b.lead}</b><p>${b.text}</p></div>`).join("");
    const rows = w.calc.map((c) => c.group ? `<p class="${cls}-calc__g">${c.group}</p>`
      : `<div class="${cls}-calc${c.sum ? ` ${cls}-calc--sum` : ""}${c.text ? ` ${cls}-calc--t` : ""}"><span class="${cls}-calc__k">${c.k}</span><span class="${cls}-calc__v">${c.v}${c.rir ? `<em>${c.rir}</em>` : ""}</span>${c.sub ? `<small>${c.sub}</small>` : ""}</div>`).join("");
    const calc = w.calc.length ? `<button class="${cls}-disc" data-toggle="calc" aria-expanded="${!!U.calcOpen}">${U.calcOpen ? n("d.why.calc_hide") : n("d.why.calc")}${ic("chev", U.calcOpen ? "rot-180" : "")}</button>${U.calcOpen ? `<div class="${cls}-calcs">${rows}</div>` : ""}` : "";
    const evidence = w.evidence ? (variant === "set2" ? `${s("why.session")}, ${n("d.set_label", { n: 1 })}` : w.evidence) : "";
    return { w, blocks, calc, evidence, glyph: variant === "set2" ? "hold" : w.r.glyph, noMark: !!w.noMark };
  }
  // Marks an element that shows an engine target, for the acceptance checks.
  const tgt = (r) => ` data-target="${r.k}@${r.iso}@${r.when}${r.input.currentSession.length ? "@set2" : ""}"`;
  const calIcon = () => `<svg class="ic-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`;
  // Scenario contexts: the main Monday and the D-only mixed Wednesday.
  const MAIN = { key: "main", iso: T.TODAY, dayName: T.PROGRAM.days[0].name, lifts: T.PROGRAM.days[0].lifts, done: 0, next: T.PROGRAM.days[1].name, week: 4 };
  const MIXD = { key: "mix", iso: D.MIX.today, dayName: D.MIX.name, lifts: D.MIX.lifts, done: 1, next: T.PROGRAM.days[2].name, week: 4 };
  const SET1 = [{ load: 102.5, reps: 7, rir: 1 }];
  // Week of the block for an ISO date (block started 31 Aug).
  const weekOf = (iso) => 1 + Math.floor((Date.parse(iso) - Date.parse(D.CONTEXT.blockStart)) / 6048e5);
  const nextOfSession = (iso, mix) => (mix ? T.PROGRAM.days[2].name : iso === T.TODAY ? T.PROGRAM.days[1].name : T.PROGRAM.days[0].name);

  root.KITD = { mark, dock, art, sheet, tabs, seg, shelf, chart, setOf, sparkline, fmtTime, exMeta, cue, targets, prevLine, whyParts, calIcon, tgt, MAIN, MIXD, SET1, weekOf, nextOfSession };
})(window);
