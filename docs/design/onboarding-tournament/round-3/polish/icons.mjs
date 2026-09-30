// Icon set for G: 24-grid, 1.75 stroke (2 for the four glyphs), round caps and joins, 2.5 px safe area.
import { writeFileSync } from "node:fs";
const gear = (() => { const pts = []; const n = 8, ro = 9, ri = 7.1, tw = 10, rw = 12.5; for (let i = 0; i < n; i++) { const a = (i * 360) / n; for (const [da, r] of [[-rw, ri], [-tw, ro], [tw, ro], [rw, ri]]) { const t = ((a + da) * Math.PI) / 180; pts.push([12 + r * Math.sin(t), 12 - r * Math.cos(t)]); } } return "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z"; })();
const I = {
  wand: { d: "M3.5 20.5 12.6 11.4", extra: "<path d='M17.5 3.3c.4 2.4 1.6 3.6 4 4-2.4.4-3.6 1.6-4 4-.4-2.4-1.6-3.6-4-4 2.4-.4 3.6-1.6 4-4z'/><path d='M7 3.5v3M5.5 5h3'/>" },
  sliders: { d: "M3.5 6h9.2M17.3 6h3.2M3.5 12h3.2M11.3 12h9.2M3.5 18h7.2M15.3 18h5.2", extra: "<circle cx='15' cy='6' r='2.1'/><circle cx='9' cy='12' r='2.1'/><circle cx='13' cy='18' r='2.1'/>" },
  search: { d: "M15.4 15.4 20.5 20.5", extra: "<circle cx='10.6' cy='10.6' r='6.6'/>" },
  pencil: { d: "M4 20l.9-4.2L15.9 4.8a2.1 2.1 0 0 1 3 0l.3.3a2.1 2.1 0 0 1 0 3L8.2 19.1 4 20zM14.6 6.1l3.3 3.3" },
  clipboard: { d: "M9 5H7.4A1.9 1.9 0 0 0 5.5 6.9v11.6a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V6.9A1.9 1.9 0 0 0 16.6 5H15M9.2 14l2 2 3.8-4.2", extra: "<rect x='9' y='3.2' width='6' height='3.6' rx='1.2'/>" },
  download: { d: "M12 3.8v11.2M7.8 11l4.2 4.2 4.2-4.2M4.5 17v1.6A2.4 2.4 0 0 0 6.9 21h10.2a2.4 2.4 0 0 0 2.4-2.4V17" },
  sheet: { d: "M3.5 9.8h17M10 9.8v9.7M3.5 14.6h17", extra: "<rect x='3.5' y='4.5' width='17' height='15' rx='2.4'/>" },
  flex: { d: "M5.5 7.4V5.5a2 2 0 0 1 2-2h1.2a2 2 0 0 1 2 2v4.1C12.5 8 15 7.6 17 8.4c2.3.9 3.5 3.1 3.5 5.6v3.5a3 3 0 0 1-3 3H7A3.5 3.5 0 0 1 3.5 17v-3.5c0-2.5.7-4.5 2-6.1zM10.7 9.6c-.7 1.5-1 3-1 4.6" },
  scale: { d: "M12 4v16.5M8 20.5h8M4.5 8h15M7 8l-3 6M7 8l3 6M17 8l-3 6M17 8l3 6M4 14a3 3 0 0 0 6 0M14 14a3 3 0 0 0 6 0" },
  dumbbell: { d: "M8.6 12h6.8", extra: "<rect x='3' y='8.6' width='2.6' height='6.8' rx='1'/><rect x='5.6' y='6.5' width='3' height='11' rx='1.1'/><rect x='15.4' y='6.5' width='3' height='11' rx='1.1'/><rect x='18.4' y='8.6' width='2.6' height='6.8' rx='1'/>" },
  building: { d: "M3 20.5h18M5.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 18.5 5v15.5M8.7 7.5h2M13.3 7.5h2M8.7 11.5h2M13.3 11.5h2M10 20.5v-4.5h4v4.5" },
  house: { d: "M3.5 11 12 4l8.5 7M5.7 9.4v11.1h12.6V9.4M10 20.5v-5.2h4v5.2" },
  kettlebell: { d: "M9 10V8a3 3 0 0 1 6 0v2", extra: "<circle cx='12' cy='15' r='5.6'/>" },
  rack: { d: "M7.5 3.5v17M16.5 3.5v17M7.5 6.5h9M5 20.5h5M14 20.5h5M3 13.5h18M5.3 11.2v4.6M18.7 11.2v4.6" },
  target: { d: "", extra: "<circle cx='12' cy='12' r='8.3'/><circle cx='12' cy='12' r='3.6'/>" },
  trend: { d: "M3.5 16.6l5.6-5.6 3.6 3.6 7.8-7.8M15.6 6.8h4.9v4.9" },
  cal: { d: "M3.5 9.8h17M8 3.4v3.2M16 3.4v3.2", extra: "<rect x='3.5' y='5' width='17' height='15.5' rx='2.4'/>" },
  clock: { d: "M12 7.4v4.9l3.1 1.9", extra: "<circle cx='12' cy='12' r='8.3'/>" },
  shield: { d: "M12 3.4l7.1 2.7v5.3c0 4.7-3 8.3-7.1 9.6-4.1-1.3-7.1-4.9-7.1-9.6V6.1zM8.9 12.2l2.2 2.2 4-4.4" },
  pin: { d: "M12 20.9c-4-4.6-6.6-7.7-6.6-10.8a6.6 6.6 0 0 1 13.2 0c0 3.1-2.6 6.2-6.6 10.8z", extra: "<circle cx='12' cy='10.1' r='2.4'/>" },
  alert: { d: "M12 7.6v5.1M12 16.3h.01", extra: "<circle cx='12' cy='12' r='8.3'/>" },
  gear: { d: gear, extra: "<circle cx='12' cy='12' r='3'/>" },
  check: { d: "M4.8 12.6l4.6 4.6L19.4 7", w: 2 },
  arrow: { d: "M4.5 12h14.6M13.6 6.4l5.6 5.6-5.6 5.6", w: 2 },
  plus: { d: "M12 5.5v13M5.5 12h13", w: 2 },
  minus: { d: "M5.5 12h13", w: 2 },
  close: { d: "M6.5 6.5l11 11M17.5 6.5l-11 11", w: 2 },
  reset: { d: "M19.6 12a7.6 7.6 0 1 1-2.3-5.4M20.1 3.6v4.9h-4.9" },
  chevron: { d: "M9.4 6.4l5.6 5.6-5.6 5.6" },
};
const svg = (k) => { const i = I[k]; return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='${i.w || 1.75}' stroke-linecap='round' stroke-linejoin='round'>${i.d ? `<path d='${i.d}'/>` : ""}${i.extra || ""}</svg>`; };
const uri = (k) => `url("data:image/svg+xml,${encodeURIComponent(svg(k)).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29")}")`;
let css = `/* ================= Icons (G set) =================
   One icon set, drawn for G: 24 grid, 1.75 stroke (2 for check, arrow,
   plus, minus and close), round caps and joins, 2.5 px safe area, one
   optical weight. Each mask replaces the shared base.css glyph inside the
   candidate root only (#root, which also covers the landing); the shared
   files are untouched. The selected choice mark uses the same check. The forward arrow and the
   check are the same drawings, exposed as G's --arrow and --check so the
   primary's arrow and the selection check use them too. */
`;
for (const k of Object.keys(I)) { if (k === "chevron") css += `#root .chevron{-webkit-mask-image:${uri(k)};mask-image:${uri(k)}}\n`; else css += `#root .icon-mask--${k}{-webkit-mask-image:${uri(k)};mask-image:${uri(k)}}\n`; }
css += `#root{--arrow:${uri("arrow")};--check:${uri("check")}}\n`;
const white = `url("data:image/svg+xml,${encodeURIComponent(svg("check").replace("stroke='black'", "stroke='white'")).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29")}")`;
css += `#root .choice.is-selected .choice__mark{background-image:${white};background-size:14px}\n`;
writeFileSync(process.argv[2], css); console.log("bytes", css.length);
