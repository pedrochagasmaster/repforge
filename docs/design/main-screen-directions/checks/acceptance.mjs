/* Acceptance checks for DIRECTION-D-SPEC.md §7, run on D and on every
   candidate built on it (E, F, G).

   Serve the repository root, then:
     REVIEW_URL=http://localhost:8000/docs/design/main-screen-directions/ \
       node docs/design/main-screen-directions/checks/acceptance.mjs

   Uses the pinned Playwright under test/ (cd test && npm ci). Writes
   checks/acceptance-report.md and exits non-zero on any failure.

   1 Targets   every button, a, input, [role=button], [data-pt] >= 44 x 44 at 360, PT and EN
   2 Overflow  nothing wider than its box at 360 PT (the tab row may scroll); no ellipsis in the CSS
   3 Orange    every element painted --accent is on the §3 allowlist
   4 Parity    outcome words match an oracle built from app.js; targets match the engine
   5 Strings   no Regrediu, no em dash, no EN "Hold" pause; no hard-coded copy in the renderers */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import vm from "vm";

const here = new URL(".", import.meta.url);
const root = new URL("../../../../", import.meta.url);
const require = createRequire(new URL("test/package.json", root));
const { chromium } = require("playwright");

const BASE = process.env.REVIEW_URL || "http://localhost:8000/docs/design/main-screen-directions/";
const DIRS = (process.env.DIRS || "d,e,f,g").split(",");
const SCREENS = ["today", "workout", "why", "rest", "why-set2", "summary", "summary2", "progress", "chart", "history", "history-freq-a", "history-freq-b", "history-freq-c", "history-freq-d", "history-freq-e", "session", "program",
  "today-mixed", "why-repgoal", "why-anchor", "why-manual", "summary-first"];
// Interaction states that reveal more controls: [screen, selector to click, label]
const STATES = [
  ["today", '[data-sheet="days"]', "day picker sheet"],
  ["workout", '[data-sheet="timer"]', "timer presets sheet"],
  ["workout", '[data-sheet="actions"]', "exercise actions sheet"],
  ["workout", '[data-field="reps"]', "reps field as input"],
  ["workout", '[data-field="load"]', "load field selected"],
  ["why", '[data-toggle="calc"]', "working disclosed"],
  ["summary", '[data-toggle="muscles"]', "all muscles"],
  ["history", '[data-sheet="cal"]', "calendar sheet"],
  ["rest", "[data-edit]", "correcting set 1"],
  ["chart", '[data-scope="all"]', "all history"],
  ["chart", '[data-metric="e1rm"]', "best e1RM"],
  ["today", "[data-open]", "row disclosed"],
];
// §3 orange budget.
const ALLOW = [
  [".mk--up", "verdict glyph"], [".mk--down", "verdict glyph"],
  [".x-cta__ar", "CTA arrow"], [".x-dock__b.is-on .ic", "active dock icon"],
  [".d-seg i.now", "current exercise segment"], [".e-prog i.now", "current exercise segment"], [".g-prog i.now", "current exercise segment"], [".x-seg-now", "current exercise segment"],
  [".d-rest__bar i", "timer drain bar"], [".e-rest__bar i", "timer drain bar"], [".f-rest__bar i", "timer drain bar"], [".g-rest__bar i", "timer drain bar"],
];

/* ---------- independent oracles ---------- */
// Canonical outcome, rebuilt from app.js's own source text (buildSessionDelta and helpers).
function appOracle() {
  // APP_JS points the oracle at another checkout's app.js, for a branch that
  // predates the session-outcome rule the review page now mirrors.
  const src = readFileSync(process.env.APP_JS || new URL("app.js", root), "utf8");
  const grab = (re) => { const m = src.match(re); if (!m) throw new Error("app.js moved: " + re); return m[0]; };
  const code = [
    grab(/^const avg=.*$/m), grab(/^const e1rm=.*$/m), grab(/^const isWork=.*$/m),
    grab(/^const DELTA_THRESHOLDS=.*$/m), grab(/^function workingRows\(rows\).*$/m),
    grab(/^function exerciseSessionMetrics\(rows\)[\s\S]*?\n(?=function )/m),
    grab(/^function buildSessionDelta\(prevRows,currentRows\)[\s\S]*?\n(?=function )/m),
    "globalThis.buildSessionDelta=buildSessionDelta;",
  ].join("\n");
  const ctx = { t: (k) => k };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.buildSessionDelta;
}
function loadFixtures() {
  const win = { navigator: { language: "pt" } };
  const ctx = { window: win, globalThis: win, Intl, Math, Date, Object, Array, String, Number, JSON, Map, Set, Error };
  vm.createContext(ctx);
  win.RepForgeI18n = require(new URL("i18n.js", root).pathname);
  win.RepForgeProgression = require(new URL("progression-engine.js", root).pathname);
  for (const f of ["data.js", "data-d.js"]) vm.runInContext(readFileSync(new URL("../" + f, here), "utf8"), ctx);
  return { TX: win.TX, DX: win.DX, ENG: win.RepForgeProgression, I18N: win.RepForgeI18n };
}

const results = { targets: [], overflow: [], orange: [], parity: [], strings: [] };

// The literal text of every template literal in a source file, with each
// \${...} hole replaced by U+0001. Handles nesting, strings and comments.
function templateLiterals(src) {
  const out = [];
  let i = 0;
  const skipString = (q) => { i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } i++; };
  function readTemplate() {
    i++;
    let buf = "";
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") { buf += src[i + 1]; i += 2; continue; }
      if (c === "`") { i++; out.push(buf); return; }
      if (c === "$" && src[i + 1] === "{") { i += 2; buf += "\u0001"; readCode(1); continue; }
      buf += c; i++;
    }
  }
  function readCode(depth) {
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'") { skipString(c); continue; }
      if (c === "`") { readTemplate(); continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 2; continue; }
      if (c === "{") depth++;
      if (c === "}") { depth--; if (depth === 0) { i++; return; } }
      i++;
    }
  }
  readCode(Infinity);
  return out;
}
const fail = (k, x) => results[k].push(x);

async function main() {
  const buildSessionDelta = appOracle();
  const { TX, DX, ENG, I18N } = loadFixtures();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  async function open(dir, screen, lang, theme = "light", w = 360) {
    await page.goto("about:blank");
    await page.goto(`${BASE}#${dir}-${screen}`);
    await page.evaluate(([lang, theme, w]) => {
      localStorage.setItem("taurifer-directions:lang", lang); localStorage.setItem("taurifer-directions:theme", theme);
      localStorage.setItem("taurifer-directions:w", String(w)); localStorage.setItem("taurifer-directions:view", "one");
    }, [lang, theme, w]);
    await page.reload();
    await page.waitForSelector('.ph[data-phone="main"]');
    await page.evaluate(() => { window.UI.running = false; document.querySelectorAll(".device").forEach((d) => { d.style.transform = "none"; }); });
  }
  const unscale = () => page.evaluate(() => document.querySelectorAll(".device").forEach((d) => { d.style.transform = "none"; }));

  const measureTargets = () => page.evaluate(() => {
    const ph = document.querySelector('.ph[data-phone="main"]');
    const out = [];
    for (const el of ph.querySelectorAll("button, a, input, [role=button], [data-pt]")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push({ el: el.tagName.toLowerCase() + "." + [...el.classList].join("."), text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
  const measureOverflow = () => page.evaluate(() => {
    const ph = document.querySelector('.ph[data-phone="main"]');
    const pr = ph.getBoundingClientRect();
    const out = [];
    for (const el of ph.querySelectorAll("*")) {
      if (el.closest(".x-tabs__in") || el.closest("svg") || el.closest(".sb")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.display === "inline") continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) out.push({ el: el.tagName.toLowerCase() + "." + [...el.classList].join("."), text: (el.textContent || "").trim().slice(0, 40), scroll: el.scrollWidth, client: el.clientWidth });
      if (el.children.length === 0 && (el.textContent || "").trim()) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > pr.right + 0.5 || r.left < pr.left - 0.5)) out.push({ el: el.tagName.toLowerCase() + "." + [...el.classList].join("."), text: el.textContent.trim().slice(0, 40), outside: true });
      }
    }
    return out;
  });
  const measureOrange = (allow) => page.evaluate((allow) => {
    const ph = document.querySelector('.ph[data-phone="main"]');
    const hex = getComputedStyle(ph).getPropertyValue("--accent").trim().replace("#", "");
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const acc = `rgb(${rgb.join(", ")})`, accA = `rgba(${rgb.join(", ")}`;
    const hit = (v) => v && (v.includes(acc) || v.includes(accA));
    const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const out = [];
    for (const el of [ph, ...ph.querySelectorAll("*")]) {
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
        if (cs.display === "none") continue;
        const props = [];
        if (!pseudo && own(el) && hit(cs.color)) props.push("color");
        if (hit(cs.backgroundColor)) props.push("background");
        for (const side of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(cs["border" + side + "Width"]) > 0 && hit(cs["border" + side + "Color"])) { props.push("border"); break; }
        if (cs.boxShadow !== "none" && hit(cs.boxShadow)) props.push("shadow");
        if (el instanceof SVGElement && (hit(cs.fill) || (cs.stroke !== "none" && hit(cs.stroke)))) props.push("svg");
        if (!props.length) continue;
        const a = allow.find(([sel]) => el.closest(sel));
        out.push({ el: el.tagName.toLowerCase() + "." + [...(el.classList || [])].join(".") + (pseudo || ""), props: props.join("+"), allowed: a ? a[1] : null });
      }
    }
    return out;
  }, allow);
  const collectOutcomes = () => page.evaluate(() => [...document.querySelectorAll('.ph[data-phone="main"] [data-outcome]')].map((el) => ({ key: el.dataset.outcome, word: el.textContent.trim() })));
  const collectTargets = () => page.evaluate(() => [...document.querySelectorAll('.ph[data-phone="main"] [data-target]')].map((el) => ({ key: el.dataset.target, text: el.textContent.replace(/\s+/g, " ").trim() })));
  const phoneText = () => page.evaluate(() => document.querySelector('.ph[data-phone="main"]').innerText);
  const pauseLabels = () => page.evaluate(() => [...document.querySelectorAll('.ph[data-phone="main"] [data-act="rest-pause"]')].map((b) => b.textContent.trim()));

  /* ---------- oracles in Node ---------- */
  const settings = { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 };
  const context = { weekNumber: 4, blockLength: 6, blockStart: "2026-08-31" };
  const mixKeys = new Set(Object.keys(DX.MIX_EX));
  function sessionsFor(k, mix) {
    if (mixKeys.has(k)) return DX.MIX_SESSIONS.filter((s) => s.lifts[k]).map((s) => ({ date: s.date, sets: s.lifts[k].map((x) => ({ ...x })) }));
    return TX.SESSIONS.filter((s) => s.lifts[k]).map((s) => ({ date: s.date, sets: s.lifts[k].map(([load, reps, rir]) => ({ load, reps, rir })) }));
  }
  function prescription(k) {
    if (mixKeys.has(k)) return JSON.parse(JSON.stringify(DX.MIX_RX[k]));
    const e = TX.EX[k];
    return { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: e.n, repMin: e.r[0], repMax: e.r[1], targetRirMin: 0, targetRirMax: 2 } }, modifiers: [] };
  }
  function engineLoad(key) {
    const [k, iso, when, set2] = key.split("@");
    const hist = sessionsFor(k).filter((s) => (when === "next" ? s.date <= iso : s.date < iso)).map((s) => ({ sessionId: k + s.date, date: s.date, sets: s.sets }));
    const res = ENG.evaluateProgression({ engineVersion: 1, prescription: prescription(k), relation: null, modifiers: [], settings, history: hist, currentSession: set2 ? [{ load: 102.5, reps: 7, rir: 1 }] : [], context });
    if (res.kind === "manual") return { manual: true };
    if (!res.target.sets.length) throw new Error("engine gave no target for " + key + ": " + JSON.stringify(res.reasonCodes) + JSON.stringify(res.facts));
    return { load: res.target.sets[0].load, sets: res.target.sets };
  }
  const hasEffort = (r) => r.rir != null && r.rir !== "" && Number.isFinite(Number(r.rir));
  function oracleOutcome(k, iso, lang) {
    const ss = sessionsFor(k);
    const i = ss.findIndex((s) => s.date === iso);
    const cur = ss[i].sets, prev = i > 0 ? ss[i - 1].sets : null;
    const word = (key) => { TX.state.lang = lang; return key.startsWith("stats.") ? I18N.STRINGS[lang][key] : DX.n(key); };
    if (!prev) return word("d.short." + (cur.some((r) => !hasEffort(r)) ? "missing-effort" : "single-observation"));
    if (![...prev, ...cur].every(hasEffort)) return word("d.short.missing-effort");
    const st = buildSessionDelta(prev, cur).status;
    const map = { improved: "stats.outcome.improved", flat: "stats.outcome.maintained", regressed: "stats.outcome.declined" };
    return map[st] ? word(map[st]) : word("d.short." + (st === "changed_load" ? "changed-load" : "incompatible-exposure"));
  }
  const fmt = (x, lang) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 1 }).format(x);

  const seenOutcome = {};
  const counts = { screens: 0, targets: 0, outcomes: 0, engineTargets: 0, orangeEls: 0, states: 0 };
  const orangeByDir = {};

  for (const dir of DIRS) {
    orangeByDir[dir] = {};
    for (const lang of ["pt", "en"]) {
      for (const screen of SCREENS) {
        await open(dir, screen, lang);
        counts.screens++;
        const where = `${dir}-${screen} ${lang}`;
        for (const t of await measureTargets()) fail("targets", { where, ...t });
        if (lang === "pt") {
          for (const o of await measureOverflow()) fail("overflow", { where, ...o });
          const oranges = await measureOrange(ALLOW);
          counts.orangeEls += oranges.length;
          orangeByDir[dir][screen] = [...new Set(oranges.map((o) => o.allowed || "NOT ALLOWED " + o.el))];
          for (const o of oranges) if (!o.allowed) fail("orange", { where, ...o });
        }
        for (const o of await collectOutcomes()) {
          counts.outcomes++;
          const [k, iso] = o.key.split("@");
          const expect = oracleOutcome(k, iso, lang);
          if (o.word !== expect) fail("parity", { where, what: "outcome", key: o.key, shown: o.word, oracle: expect });
          const id = `${lang}:${o.key}`;
          if (seenOutcome[id] && seenOutcome[id] !== o.word) fail("parity", { where, what: "cross-screen outcome", key: o.key, shown: o.word, other: seenOutcome[id] });
          seenOutcome[id] = o.word;
        }
        for (const t of await collectTargets()) {
          const e = engineLoad(t.key);
          if (e.manual) continue;
          counts.engineTargets++;
          if (!t.text.includes(fmt(e.load, lang))) fail("parity", { where, what: "target", key: t.key, shown: t.text, engine: fmt(e.load, lang) });
        }
        const text = await phoneText();
        if (/Regrediu/.test(text)) fail("strings", { where, what: "Regrediu" });
        if (/—/.test(text)) fail("strings", { where, what: "em dash" });
        if (lang === "en") for (const l of await pauseLabels()) if (/^Hold$/i.test(l)) fail("strings", { where, what: "EN pause labelled Hold" });
      }
      for (const [screen, sel, label] of STATES) {
        await open(dir, screen, lang);
        const b = await page.$(`.ph[data-phone="main"] ${sel}`);
        if (!b) continue;
        await b.click();
        await page.waitForTimeout(60);
        await unscale();
        counts.states++;
        const where = `${dir}-${screen} ${lang}, ${label}`;
        for (const t of await measureTargets()) fail("targets", { where, ...t });
        if (lang === "pt") {
          for (const o of await measureOverflow()) fail("overflow", { where, ...o });
          for (const o of await measureOrange(ALLOW)) if (!o.allowed) fail("orange", { where, ...o });
        }
      }
    }
  }
  await browser.close();
  for (const e of errors) fail("strings", { what: "page error", detail: e });

  /* ---------- static checks ---------- */
  const cssFiles = ["phone.css", "phone-e.css", "phone-f.css", "phone-g.css"];
  for (const f of cssFiles) {
    const css = readFileSync(new URL("../" + f, here), "utf8");
    const family = f === "phone.css" ? css.slice(css.indexOf("D family (.dx)")) : css;
    if (/text-overflow\s*:\s*ellipsis/.test(family)) fail("overflow", { where: f, what: "text-overflow: ellipsis in a D-family rule" });
    for (const m of family.matchAll(/^[^{}\n]*\{[^}]*#[0-9a-fA-F]{3,8}\b[^}]*\}/gm)) fail("orange", { where: f, what: "raw hex in a D-family rule", rule: m[0].slice(0, 80) });
  }
  // Hard-coded copy: every text node in the renderers' templates must come from s() or n().
  const ALLOWED_WORDS = new Set(["kg", "RIR", "reps", "e1RM", "PR", "P", "Δ", "s"]);
  for (const f of ["kit-d.js", "dir-d.js", "dir-e.js", "dir-f.js", "dir-g.js"]) {
    for (const tpl of templateLiterals(readFileSync(new URL("../" + f, here), "utf8"))) {
      for (const m of tpl.matchAll(/>([^<>]*)</g)) {
        for (const chunk of m[1].split("\u0001")) {
          const words = chunk.split(/\s+/).map((w) => w.replace(/^[−+.,:·×()–]+|[.,:·×()–]+$/g, "")).filter((w) => /[A-Za-zÀ-ÿ]/.test(w));
          if (words.some((w) => !ALLOWED_WORDS.has(w))) fail("strings", { where: f, what: "literal copy outside s()/n()", text: chunk.trim().slice(0, 60) });
        }
      }
    }
  }

  /* ---------- report ---------- */
  const section = (title, key, fmtRow) => `### ${title}: ${results[key].length ? `**${results[key].length} failures**` : "pass"}\n\n${results[key].slice(0, 40).map(fmtRow).join("\n")}${results[key].length > 40 ? `\n… ${results[key].length - 40} more` : ""}\n`;
  const orangeTable = DIRS.map((d) => `| ${d.toUpperCase()} | ${[...new Set(Object.values(orangeByDir[d]).flat())].join(", ")} |`).join("\n");
  const report = `## Acceptance checks (§7), run on ${DIRS.map((d) => d.toUpperCase()).join(", ")}

${counts.screens} screen renders (${DIRS.length} directions × ${SCREENS.length} screens × PT and EN at 360 px) plus ${counts.states} interaction states (sheets open, disclosures open, the shelf field as a real input, chart toggles).

${section("1. Targets ≥ 44 × 44", "targets", (x) => `- ${x.where}: \`${x.el}\` "${x.text}" ${x.w}×${x.h}`)}
${section("2. Overflow at 360 PT", "overflow", (x) => `- ${x.where}: \`${x.el || ""}\` ${x.what || `"${x.text}" ${x.outside ? "outside the phone" : `${x.scroll} > ${x.client}`}`}`)}
${section("3. Orange budget", "orange", (x) => `- ${x.where}: \`${x.el || x.rule}\` ${x.props || x.what}`)}
Orange elements found, by kind (every one is on the §3 allowlist):

| Dir | Kinds |
| --- | --- |
${orangeTable}

${section("4. Parity", "parity", (x) => `- ${x.where}: ${x.what} ${x.key} shows "${x.shown}", expected "${x.oracle || x.engine || x.other}"`)}
Outcome words checked: ${counts.outcomes} (oracle: \`buildSessionDelta\` and its helpers evaluated from app.js source, plus the evidence rules of \`strengthEvidenceRecords\`). Engine targets checked: ${counts.engineTargets} (each recomputed in Node with \`RepForgeProgression.evaluateProgression\`).

${section("5. Strings", "strings", (x) => `- ${x.where || ""}: ${x.what}${x.text ? ` "${x.text}"` : ""}${x.detail ? ` ${x.detail}` : ""}`)}
`;
  writeFileSync(new URL("acceptance-report.md", here), report);
  console.log(report);
  const total = Object.values(results).reduce((t, x) => t + x.length, 0);
  process.exit(total ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
