// Hand-drawn wayfinding glyphs for the mockups: 24 grid, 1.75 stroke, round caps.
// They follow docs/brand-guide.md "UI glyphs"; production keeps its mask set.
(function () {
  const p = (d) => `<path d="${d}"/>`;
  const c = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  const I = {
    female: c(12, 9, 5) + p("M12 14v7M9 18h6"),
    male: c(10, 14, 5) + p("M13.6 10.4 19 5M14.5 5H19v4.5"),
    none: c(12, 12, 8) + p("M8.5 12h7"),
    bars0: c(12, 12, 8),
    bars1: c(12, 12, 8) + p("M9 15v-1"),
    bars2: c(12, 12, 8) + p("M9 15v-1M12 15v-3"),
    bars3: c(12, 12, 8) + p("M9 15v-1M12 15v-3M15 15v-5"),
    heart: p("M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19Z"),
    everything: p("M3 20V9l5-3v14M8 20V6l6 3v11M14 20v-8h7v8M2 20h20"),
    commercial: p("M5 20V4h10v16M15 9h4v11M8 7h1M11 7h1M8 10h1M11 10h1M8 13h1M11 13h1M9 20v-3h2v3M3 20h18"),
    warehouse: p("M3 20V10l9-5 9 5v10M7 20v-6h10v6M7 17h10M2 20h20"),
    local: p("M4 20V9h16v11M3 9l2-4h14l2 4M9 20v-5h6v5M2 20h20"),
    garage: p("M4 20V10l8-6 8 6v10M8 20v-7h8v7M8 16h8M2 20h20"),
    home: p("M5 20v-9l7-6 7 6v9M10 20v-5h4v5M3 20h18"),
    muscle: p("M5 17c2-1 4-1.5 7-1 3 .5 5-.5 6.5-2.5 1-1.3.5-3.5-1-4-1.2-.4-2.5.2-3 1.2M5 17V9.5C5 7 6.5 5 9 5h1.5l1 2.5-2.5 1V12"),
    dumbbell: p("M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"),
    balance: p("M12 4v16M8 20h8M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7ZM19 7l-3 6a3 3 0 0 0 6 0l-3-6Z"),
    calendar: p("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"),
    clock: c(12, 12, 8) + p("M12 8v4l3 2"),
    lighter: p("M4 19h16M6 19V9M10 19V7M14 19V11M18 19v-4"),
    check: p("M5 12.5 10 17l9-10"),
    chevL: p("M15 5l-7 7 7 7"),
    chevR: p("M9 5l7 7-7 7"),
    chevD: p("M6 9l6 6 6-6"),
    wand: p("M4 20 15 9M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7L19 11Z"),
    pencil: p("M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3"),
    file: p("M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 16h6"),
    clip: p("M8 5H6v16h12V5h-2M9 3h6v4H9z"),
    link: p("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
    lock: p("M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3"),
    warn: p("M12 4 2.5 20h19L12 4ZM12 10v4M12 17v.5"),
  };
  window.icon = (name, size = 24, cls = "") =>
    `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ""}</svg>`;
})();
