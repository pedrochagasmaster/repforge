/* Shared rendering kit: icons (the app's own glyph set from styles.css),
   status bar, charts and small formatting helpers used by all directions. */
(function (root) {
  "use strict";
  const T = root.TX;

  // Glyph drawings copied from styles.css (.nav__icon and .icon-mask--*).
  const SVG = {
    home: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1V10.5z'/></svg>",
    stats: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'><path d='M5 20V10M12 20V4M19 20v-7'/></svg>",
    history: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M3 12a9 9 0 1 0 3-6.7'/><path d='M3 4v5h5'/><path d='M12 7v5l3 2'/></svg>",
    program: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'><path d='M8 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'/><path d='M9 9h8M9 13h8M9 17h5'/></svg>",
    gear: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M9.93 5.63L9.98 2.51A9.7 9.7 0 0 1 14.02 2.51L14.07 5.63A6.7 6.7 0 0 1 16.48 7.02L19.21 5.51A9.7 9.7 0 0 1 21.23 9L18.55 10.61A6.7 6.7 0 0 1 18.55 13.39L21.23 15A9.7 9.7 0 0 1 19.21 18.49L16.48 16.98A6.7 6.7 0 0 1 14.07 18.37L14.02 21.49A9.7 9.7 0 0 1 9.98 21.49L9.93 18.37A6.7 6.7 0 0 1 7.52 16.98L4.79 18.49A9.7 9.7 0 0 1 2.77 15L5.45 13.39A6.7 6.7 0 0 1 5.45 10.61L2.77 9A9.7 9.7 0 0 1 4.79 5.51L7.52 7.02Z'/><circle cx='12' cy='12' r='3.2'/></svg>",
    timer: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='13.5' r='7.5'/><path d='M9.5 2.5h5'/><path d='M12 2.5V6'/><path d='M18.6 7.4l1.6-1.6'/><path d='M12 13.5V9.8'/></svg>",
    sheet: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><rect x='3.25' y='4.5' width='17.5' height='15' rx='2.5'/><path d='M3.25 9.25h17.5M9.75 9.25v10.25M3.25 14.4h17.5'/></svg>",
    more: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'><circle cx='5' cy='12' r='1.6'/><circle cx='12' cy='12' r='1.6'/><circle cx='19' cy='12' r='1.6'/></svg>",
    chev: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>",
    close: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'><path d='M6 6l12 12M18 6L6 18'/></svg>",
    note: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M5.5 3.5h8.5l4.5 4.5v12.5h-13z'/><path d='M14 3.5V8h4.5'/><path d='M8.5 12.5h7M8.5 16h4.5'/></svg>",
    skip: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 5 14 12 6 19'/><path d='M18 5v14'/></svg>",
    plus: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5v14M5 12h14'/></svg>",
    minus: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12h14'/></svg>",
    pause: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'><rect x='7' y='5' width='3.6' height='14' rx='1.2'/><rect x='13.4' y='5' width='3.6' height='14' rx='1.2'/></svg>",
    play: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'><path d='M8 5.4a1 1 0 0 1 1.53-.85l9 6.6a1 1 0 0 1 0 1.7l-9 6.6A1 1 0 0 1 8 18.6z'/></svg>",
    reset: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><path d='M20 12a8 8 0 1 1-2.34-5.66'/><polyline points='20 3.5 20 8.5 15 8.5'/></svg>",
    search: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><circle cx='10.4' cy='10.4' r='6.1'/><path d='M14.9 14.9 19.8 19.8'/></svg>",
    pencil: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><path d='M4.1 19.9h4.1L19.6 8.5a2.2 2.2 0 0 0-3.1-3.1L5.1 16.8z'/><path d='m14.9 7 3.1 3.1'/></svg>",
    check: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><polyline points='4 12.5 9.5 18 20 6.5'/></svg>",
    arrow: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12h15'/><polyline points='13.2 6.2 19 12 13.2 17.8'/></svg>",
    bolt: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'><path d='M13.6 2 4 13.4h6.1L9.4 22 20 10.2h-6.6z'/></svg>",
    equal: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'><path d='M6 9.5h12M6 14.5h12'/></svg>",
    trend: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><path d='M3.6 16.4 9.8 10.2l3.8 3.8 6.8-6.8'/><path d='M15.2 7.2h5.2v5.2'/></svg>",
  };
  (function injectIcons() {
    let css = "";
    for (const k in SVG) css += `.i-${k}{--i:url("data:image/svg+xml,${encodeURIComponent(SVG[k])}")}\n`;
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  })();

  const ic = (name, cls = "") => `<span class="ic i-${name} ${cls}" aria-hidden="true"></span>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function statusBar(time = "18:42") {
    return `<div class="sb"><span class="sb-t">${time}</span><span class="sb-r"><i class="sb-sig"></i><i class="sb-bat"></i></span></div>`;
  }

  // Marker glyph for an engine verdict.
  function mark(status, cls = "") {
    const g = { up: "arrow mk-up", hold: "equal", stalled: "reset", recover: "pause", down: "arrow mk-down", new: "plus" }[status] || "equal";
    const [icon, rot] = g.split(" ");
    return `<span class="mk mk--${status} ${cls}">${ic(icon, rot || "")}</span>`;
  }
  const verdict = (s) => ({
    up: T.tx("Subir", "Add load"), hold: T.tx("Manter", "Hold"), stalled: T.tx("Travado", "Stalled"),
    recover: T.tx("Recuperar", "Recover"), down: T.tx("Reduzir", "Back off"), new: T.tx("Novo", "New"),
  }[s]);
  const outcomeWord = (k) => ({ improved: T.tx("Melhorou", "Improved"), maintained: T.tx("Manteve", "Maintained"), declined: T.tx("Regrediu", "Declined"), new: T.tx("Novo", "New") }[k]);

  // Cue sentence matching focus.cue.* copy.
  function cue(rec) {
    const L = T.kg(rec.load);
    if (rec.status === "up") return T.tx(`Subir para ${L}, buscar ${rec.reps} reps`, `Go up to ${L}, aim for ${rec.reps} reps`);
    if (rec.status === "down") return T.tx(`Reduzir para ${L}, buscar ${rec.reps} reps`, `Drop to ${L}, aim for ${rec.reps} reps`);
    return T.tx(`Manter ${L}, buscar ${rec.reps} reps`, `Hold ${L}, aim for ${rec.reps} reps`);
  }

  const range = (k) => `${T.EX[k].r[0]}–${T.EX[k].r[1]}`;
  const repsList = (sets) => sets.map(([, r]) => r).join(", ");
  const sameLoad = (sets) => sets.every(([l]) => l === sets[0][0]);
  function setsLine(sets) {
    if (sameLoad(sets)) return `${T.num(sets[0][0])} × ${repsList(sets)}`;
    return sets.map(([l, r]) => `${T.num(l)} × ${r}`).join(", ");
  }
  const pct = (p, dec = 1) => (p >= 0 ? "+" : "−") + T.num(Math.abs(p * 100), dec) + "%";
  const signed = (n, dec) => (Math.abs(n) < 0.05 ? "" : n > 0 ? "+" : "−") + T.num(Math.abs(n), dec);

  function prLine(p) {
    if (p.kind === "load") return T.tx(`+${T.kg(p.by)} acima do seu melhor`, `+${T.kg(p.by)} over your best`);
    return T.tx(`+${p.by} ${p.by === 1 ? "rep" : "reps"} nessa carga`, `+${p.by} ${p.by === 1 ? "rep" : "reps"} at that load`);
  }

  function sparkline(values, w = 64, h = 22, cls = "spark") {
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => [2 + (i * (w - 4)) / (values.length - 1), h - 3 - ((v - min) / span) * (h - 6)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const last = pts[pts.length - 1];
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" class="spark-l"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.4" class="spark-d"/></svg>`;
  }

  /* Squat e1RM chart. opts.h height, opts.band draws the block region,
     opts.steps overlays the top-load step line, opts.cursor marks the last point. */
  function squatChart(opts = {}) {
    const S = T.squatSeries();
    const W = 328, H = opts.h || 190, padL = 30, padR = 10, padT = 18, padB = 22;
    const ys = S.map((s) => s.e1rm);
    const ymin = 108, ymax = 130;
    const x = (i) => padL + (i * (W - padL - padR)) / (S.length - 1);
    const y = (v) => padT + (1 - (v - ymin) / (ymax - ymin)) * (H - padT - padB);
    let g = "";
    for (const t of [110, 115, 120, 125, 130]) {
      g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="ch-grid"/>`;
      g += `<text x="${padL - 6}" y="${y(t) + 3.5}" class="ch-ax" text-anchor="end">${t}</text>`;
    }
    const bi = S.findIndex((s) => s.block);
    if (opts.band) g += `<rect x="${x(bi) - 8}" y="${padT - 8}" width="${W - padR - x(bi) + 8}" height="${H - padT - padB + 8}" class="ch-band"/>`;
    g += `<line x1="${x(bi) - 8}" x2="${x(bi) - 8}" y1="${padT - 8}" y2="${H - padB}" class="ch-block"/>`;
    g += `<text x="${x(bi) - 4}" y="${padT - 1}" class="ch-ax ch-ax--l">${T.tx("Bloco atual", "Current block")}</text>`;
    if (opts.steps) {
      // top load, drawn on the same kg scale shifted by the e1RM ratio of the first point, as a secondary trace
      const k = S[0].e1rm / S[0].top;
      let d = "";
      S.forEach((s, i) => { const yy = y(s.top * k); d += i ? ` H${x(i)} V${yy}` : `M${x(i)} ${yy}`; });
      g += `<path d="${d}" class="ch-step"/>`;
    }
    const d = S.map((s, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(s.e1rm).toFixed(1)).join(" ");
    g += `<path d="${d}" class="ch-line"/>`;
    S.forEach((s, i) => {
      const last = i === S.length - 1;
      g += `<circle cx="${x(i)}" cy="${y(s.e1rm)}" r="${last ? 4.5 : 3}" class="${last ? "ch-pt ch-pt--live" : s.block ? "ch-pt" : "ch-pt ch-pt--old"}"/>`;
    });
    if (opts.events) {
      S.forEach((s, i) => { if (i && s.block && S[i - 1].block && s.top > S[i - 1].top) g += `<path d="M${x(i) - 4} ${H - padB - 3} l4 -5 l4 5" class="ch-ev"/>`; });
    }
    const bestI = ys.indexOf(Math.max(...ys));
    g += `<text x="${x(bestI)}" y="${y(ys[bestI]) - 10}" class="ch-val" text-anchor="middle">${T.num(ys[bestI], 1)}</text>`;
    g += `<text x="${padL}" y="${H - 4}" class="ch-ax">${T.date.short(S[0].date)}</text>`;
    g += `<text x="${W - padR}" y="${H - 4}" class="ch-ax" text-anchor="end">${T.date.short(S[S.length - 1].date)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${T.tx("e1RM do agachamento por sessão", "Squat e1RM by session")}">${g}</svg>`;
  }

  const fmtTime = (s) => { const m = Math.floor(Math.max(0, s) / 60), r = Math.max(0, s) % 60; return `${m}:${String(r).padStart(2, "0")}`; };

  root.KIT = { ic, esc, statusBar, mark, verdict, outcomeWord, cue, range, repsList, setsLine, pct, signed, prLine, sparkline, squatChart, fmtTime };
})(window);
