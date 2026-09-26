// Browser checks for the round-4 landing candidates N and P. Run with the repo
// root served over HTTP and the test/ Playwright install:
//
//   python3 -m http.server 8000 &
//   (cd test && node ../docs/design/landing-candidates/round-4/verify.mjs)
//
// Env: R4_URL (default http://localhost:8000/docs/design/landing-candidates/round-4/),
//      R4_SHOTS (directory for full-page screenshots; skipped when unset),
//      PW_CHROMIUM (optional executablePath).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../");
const URL0 = process.env.R4_URL || "http://localhost:8000/docs/design/landing-candidates/round-4/";
const SHOTS = process.env.R4_SHOTS || "";
const IDS = ["N", "P"];
const LANGS = ["pt", "en"];
const WIDTHS = [360, 375, 430];
const failures = [];
const notes = [];
const fail = (where, msg) => failures.push(where + ": " + msg);

const cat = { pt: JSON.parse(readFileSync(join(root, "i18n-pt.json"), "utf8")), en: JSON.parse(readFileSync(join(root, "i18n-en.json"), "utf8")) };
globalThis.window = globalThis; require(join(root, "exercises.js"));
const library = globalThis.RepForgeExercises.library;
const fmt = (lang, x) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en", { maximumFractionDigits: 1 }).format(x);

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function open(hash, { width = 375, height = 667, bare = true, reduced = false, dark = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: dark ? "dark" : "light", hasTouch: true });
  await ctx.addInitScript(() => {
    const live = { io: 0 };
    window.__live = live;
    const IO = window.IntersectionObserver;
    window.IntersectionObserver = class extends IO {
      constructor(cb, o) { super(cb, o); this.__on = false; }
      observe(t) { if (!this.__on) { this.__on = true; live.io++; } return super.observe(t); }
      disconnect() { if (this.__on) { this.__on = false; live.io--; } return super.disconnect(); }
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(URL0 + (bare ? "?bare" : "") + "#" + hash, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
async function scrollThrough(page, check) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 220) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(30); if (check) await check(y); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
}
async function expandAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll("#stage details").forEach((d) => { d.open = true; });
    document.querySelectorAll('#stage .disc[aria-expanded="false"]').forEach((b) => b.click());
  });
  await page.waitForTimeout(300);
}
const ORPHANS = () => [...document.querySelectorAll("#stage h1, #stage h2, #stage h3")].filter((h) => h.offsetParent && getComputedStyle(h).opacity !== "0").map((h) => {
  const words = [];
  const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const t = walk.currentNode; const re = /\S+/g; let m;
    while ((m = re.exec(t.data))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); const b = r.getBoundingClientRect(); words.push({ w: m[0], top: Math.round(b.top) }); }
  }
  const lastTop = Math.max(...words.map((x) => x.top));
  const onLast = words.filter((x) => Math.abs(x.top - lastTop) < 4);
  const lines = new Set(words.map((x) => Math.round(x.top / 4))).size;
  return { text: h.textContent.trim(), orphan: words.length > 2 && lines > 1 && onLast.length === 1 };
});

for (const id of IDS) for (const lang of LANGS) {
  const tag = id + "-" + lang;
  // ---------- per width: overflow while scrolling, orphans, targets, persistent CTA ----------
  for (const width of WIDTHS) {
    const { ctx, page, errors } = await open(tag, { width });
    const where = tag + "@" + width;
    let wide = 0, dockGone = 0;
    await scrollThrough(page, async () => {
      const s = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, dock: (() => { const d = document.getElementById("dock"); if (!d) return false; const r = d.getBoundingClientRect(); return getComputedStyle(d).visibility !== "hidden" && r.bottom <= innerHeight + 1 && r.top >= 0; })() }));
      if (s.sw > width) wide = Math.max(wide, s.sw);
      if (!s.dock) dockGone++;
    });
    if (wide) fail(where, "horizontal scroll " + wide);
    if (dockGone) fail(where, "persistent CTA off screen at " + dockGone + " scroll positions");
    await expandAll(page);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > width) fail(where, "horizontal scroll with everything open " + sw);
    if (errors.length) fail(where, "page errors: " + errors.join(" | "));
    if (width === 360) for (const o of await page.evaluate(ORPHANS)) if (o.orphan) fail(where, "orphan in heading: " + o.text);
    const small = await page.evaluate(() => [...document.querySelectorAll("#stage a, #stage button, #stage summary, #stage input, #stage [role=radio], .rv button, .rv a")]
      .filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden")
      .map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40), r: e.getBoundingClientRect() }))
      .filter((x) => x.r.height < 43.5 || x.r.width < 43.5).map((x) => x.t + " " + Math.round(x.r.width) + "x" + Math.round(x.r.height)));
    if (small.length) fail(where, "targets under 44px: " + small.join("; "));
    if (width === 375 && SHOTS) {
      await page.evaluate(() => document.querySelectorAll("#stage details").forEach((d) => { d.open = false; }));
      await page.evaluate(() => document.querySelectorAll('#stage .disc[aria-expanded="true"]').forEach((b) => b.click()));
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1500);
      await page.screenshot({ path: join(SHOTS, tag + "-375-fold.png") });
    }
    await ctx.close();
  }

  // ---------- first viewport at 375x667, with and without the review bar ----------
  for (const bare of [true, false]) {
    const { ctx, page } = await open(tag, { bare });
    const f = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; }; return { h1: r("#stage h1"), cta: r("#dockCta") }; });
    const where = tag + (bare ? " fold" : " fold+review-bar");
    for (const k of ["h1", "cta"]) if (!f[k] || f[k].bottom > 667 || f[k].top < 0) fail(where, k + " not in the first viewport (" + (f[k] && Math.round(f[k].bottom)) + ")");
    const label = await page.textContent("#dockCta");
    if (label.trim() !== (lang === "pt" ? "Montar meu treino" : "Build my program")) fail(where, "persistent CTA reads " + label);
    await ctx.close();
  }

  // ---------- copy ----------
  {
    const { ctx, page } = await open(tag);
    await expandAll(page);
    const text = await page.evaluate(() => document.getElementById("stage").innerText + "\n" + [...document.querySelectorAll("#stage [aria-label], #stage img[alt]")].map((e) => e.getAttribute("aria-label") || e.getAttribute("alt")).join("\n"));
    const plain = await page.evaluate(() => { const c = document.getElementById("stage").cloneNode(true); c.querySelectorAll(".ui").forEach((e) => e.remove()); return c.innerText; });
    const where = tag + " copy";
    if (/!/.test(text)) fail(where, "exclamation mark");
    if (/—/.test(text)) fail(where, "em dash");
    if (/[“”‘’]/.test(text)) fail(where, "curly quotes");
    if (/\b(streaks?|badges?|sequência de dias|medalhas?|conquistas?)\b/i.test(text)) fail(where, "streak or badge language");
    if (lang === "pt") {
      for (const w of ["offline", "log", "stats", "performance", "split", "delta", "aparelho", "quatro", "coach", "streak"]) if (new RegExp("\\b" + w + "\\b", "i").test(text)) fail(where, "banned PT word: " + w);
      if (/\b\d+\.\d\b/.test(text.replace(/\d{2}:\d{2}/g, ""))) fail(where, "EN-style decimal in PT: " + text.match(/\b\d+\.\d\b/)[0]);
      if (/\btu\b|\bteu\b|\btua\b/i.test(text)) fail(where, "tu-form in PT");
      if (/\bprogramas?\b/i.test(plain)) fail(where, "PT says programa outside an app label");
      for (const w of ["faixa", "topo", "piso", "hist[óo]rico de treinos", "o treino", "as s[ée]ries fizeram"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "PT wording: " + w);
    } else {
      if (/\b\d+,\d\b/.test(text)) fail(where, "PT-style decimal in EN: " + text.match(/\b\d+,\d\b/)[0]);
      for (const w of ["range", "the floor", "the sets did", "the program"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "EN wording: " + w);
    }
    if (/\bfour\b|\bquatro\b/i.test(text)) fail(where, "four/quatro");
    // RIR is explained where it first appears
    const rir = await page.evaluate(() => { const t = document.getElementById("stage").innerText; return { first: t.search(/\bRIR\b/), key: t.search(/repetições em reserva|reps in reserve/i) }; });
    if (rir.key < 0 || rir.key - rir.first > 40) fail(where, "RIR not explained where it first appears " + JSON.stringify(rir));
    // every app screen carries a one-line "what you're looking at"
    const unexplained = await page.evaluate(() => [...document.querySelectorAll("#stage picture")].filter((p) => {
      let e = p; for (let i = 0; i < 6 && e; i++) { let s = e.previousElementSibling; while (s) { if (s.matches(".seeing, .appline") || s.querySelector && s.querySelector(".seeing")) return false; s = s.previousElementSibling; } e = e.parentElement; }
      return true;
    }).map((p) => p.querySelector("img").getAttribute("src")));
    if (unexplained.length) fail(where, "app screen without a what-you-see line: " + unexplained.join(", "));
    if (!/O Taurifer coleta algum dado|Does Taurifer collect any data/.test(text)) fail(where, "no data-collection answer");
    // exercise names are library names
    const names = await page.evaluate(() => [...document.querySelectorAll("#stage .log__ex, #stage .flip__ex, #stage .dhead .lbl")].map((e) => e.textContent.trim()));
    for (const nme of names) if (!library.some((x) => (lang === "pt" ? x.namePt : x.name).toLowerCase() === nme.toLowerCase())) fail(where, "exercise name not in exercises.js: " + nme);
    // copied app strings, and page wording that runs ahead of the app
    const tables = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.textContent).join("\n"); const k = /var K = (\{[\s\S]*?\n\});/.exec(s); const p = /var P = (\{[\s\S]*?\n\});/.exec(s); return [k && k[1], p && p[1]]; });
    if (!tables[0] || !tables[1]) fail(where, "K or P table not found");
    else {
      for (const [key, [pt, en]] of Object.entries(Function("return " + tables[0])())) {
        if (cat.pt[key] !== pt) fail("i18n", key + " PT differs from i18n-pt.json");
        if (cat.en[key] !== en) fail("i18n", key + " EN differs from i18n-en.json");
      }
      for (const [key, v] of Object.entries(Function("return " + tables[1])())) {
        if (cat.pt[key] !== v.from[0] || cat.en[key] !== v.from[1]) fail("i18n", key + " moved in the app: update P");
        if (/programa/i.test(v.pt)) fail("i18n", key + " page wording still says programa");
      }
    }
    // screenshots follow the page language and load
    const srcs = await page.evaluate(() => [...document.querySelectorAll("#stage img, #stage source")].map((e) => e.getAttribute("src") || e.getAttribute("srcset")).filter((s) => /-(pt|en)-(light|dark)\.webp/.test(s)));
    if (!srcs.length) fail(where, "no app renders found");
    for (const s of srcs) if (!s.includes("-" + lang + "-")) fail(where, "image language mismatch: " + s);
    const broken = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("#stage img")];
      imgs.forEach((i) => { i.loading = "eager"; });
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src"));
    });
    if (broken.length) fail(where, "images that did not load: " + broken.join(", "));
    await ctx.close();
  }

  // ---------- reduced motion: final numbers without waiting ----------
  {
    const { ctx, page } = await open(tag, { reduced: true });
    const big = await page.evaluate(() => (document.querySelector("#nNum .swap, #pBig .swap") || {}).textContent);
    if (big !== fmt(lang, 62.5)) fail(tag + " reduced-motion", "hero number is " + big);
    await ctx.close();
  }
}

// ---------- interactions ----------
async function focusRing(page, sel, where) {
  const ok = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return "missing"; const cs = getComputedStyle(e); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 ? "ok" : "no ring (" + cs.outlineStyle + " " + cs.outlineWidth + ")"; }, sel);
  if (ok !== "ok") fail(where, sel + " focus ring: " + ok);
}
for (const lang of LANGS) {
  // N: hero roll, scrubbed steps, outcome keys, spotlight
  {
    const { ctx, page } = await open("N-" + lang);
    const w = "N-" + lang + " interaction";
    await page.waitForTimeout(1400);
    if ((await page.textContent("#nNum .swap")).trim() !== fmt(lang, 62.5)) fail(w, "hero did not land on 62,5");
    const steps = [];
    const box = await page.evaluate(() => { const s = document.getElementById("nDis"); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
    for (let y = box.top; y < box.top + box.h - 600; y += 150) {
      await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60);
      steps.push(await page.evaluate(() => [...document.querySelectorAll("#nDis .step")].findIndex((s) => s.classList.contains("on"))));
    }
    if (!(steps.includes(0) && steps.includes(3)) || steps.some((s, i) => i && s < steps[i - 1])) fail(w, "dissection steps did not advance with scroll: " + steps.join(","));
    await page.waitForTimeout(700);
    if (!(await page.textContent("#nDisV")).includes(fmt(lang, 62.5))) fail(w, "dissection did not end on 62,5");
    await page.locator('#nKeys [data-case="reduce"]').tap(); await page.waitForTimeout(700);
    let t = await page.textContent(".flip__out");
    if (!t.includes(fmt(lang, 67.5) + " kg") || !t.includes(cat[lang]["rec.reduce.label"]) || !t.includes(cat[lang]["rec.reduce.text"].split("{min}").join("8"))) fail(w, "reduce key wrong: " + t);
    await page.focus('#nKeys [aria-checked="true"]'); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(700);
    t = await page.textContent(".flip__out");
    if (!t.includes("100 kg") || !t.includes(cat[lang]["rec.hold_add_reps.text"])) fail(w, "ArrowLeft did not select hold: " + t);
    await focusRing(page, '#nKeys [aria-checked="true"]', w);
    if (!(await page.getAttribute("#nFlipBand img", "src")).includes("focus-hold-" + lang)) fail(w, "app band did not follow the case");
    const g = await page.evaluate(() => { const s = document.getElementById("nGym"); return s.getBoundingClientRect().top + scrollY + s.offsetHeight - innerHeight - 10; });
    await page.evaluate((y) => scrollTo(0, y), g); await page.waitForTimeout(200);
    const hy = await page.evaluate(() => document.getElementById("nSpot").style.getPropertyValue("--hy"));
    if (hy !== (lang === "pt" ? "39.3%" : "36.1%")) fail(w, "spotlight did not reach the last hotspot (" + hy + ")");
    const btn = page.locator("#nHandBtn"); await btn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
    if ((await btn.getAttribute("aria-expanded")) !== "true") fail(w, "paste disclosure did not open by keyboard");
    await focusRing(page, "#nHandBtn", w);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(200);
    await page.click("#stage .foot nav a >> nth=0"); await page.waitForTimeout(900);
    const dataTop = await page.evaluate((l) => document.getElementById(l === "pt" ? "dados" : "data").getBoundingClientRect().top, lang);
    if (dataTop < -2 || dataTop > 200) fail(w, "Privacy link did not land on the data section (" + Math.round(dataTop) + ")");
    if (!(await page.evaluate(() => location.hash)).match(/^#N-(pt|en)$/)) fail(w, "in-page anchor clobbered the deep link");
    await ctx.close();
  }
  // P: tap to log, RIR slider, spreadsheet, covering questions
  {
    const { ctx, page } = await open("P-" + lang);
    const w = "P-" + lang + " interaction";
    if (await page.evaluate(() => document.getElementById("pLogRes").classList.contains("on"))) fail(w, "result showing before any set is logged");
    await page.locator("#pLogBtn").scrollIntoViewIfNeeded();
    for (let i = 0; i < 3; i++) { await page.locator("#pLogBtn").tap(); await page.waitForTimeout(120); }
    const logged = await page.evaluate(() => ({ rows: [...document.querySelectorAll("#pLog .lrow.on")].length, res: document.getElementById("pLogRes").classList.contains("on"), dis: document.getElementById("pLogBtn").getAttribute("aria-disabled") }));
    if (logged.rows !== 3 || !logged.res || logged.dis !== "true") fail(w, "three taps did not log the session: " + JSON.stringify(logged));
    if (!(await page.textContent("#pLogRes")).includes(fmt(lang, 62.5) + " kg")) fail(w, "logged result is not 62,5 kg");
    await page.locator("#pRedo").tap(); await page.waitForTimeout(100);
    if ((await page.evaluate(() => document.querySelectorAll("#pLog .lrow.on").length)) !== 0) fail(w, "redo did not reset");
    await page.focus("#pRir"); await page.keyboard.press("ArrowRight");
    const r = await page.evaluate(() => ({ read: document.getElementById("pRirRead").textContent, res: document.querySelectorAll("#pPips .res").length }));
    if (r.res !== 3 || !/RIR\s*3/.test(r.read)) fail(w, "RIR slider did not move to 3: " + JSON.stringify(r));
    await focusRing(page, "#pRir", w);
    await page.locator("#pFill").scrollIntoViewIfNeeded(); await page.locator("#pFill").tap(); await page.waitForTimeout(700);
    if (!(await page.evaluate(() => document.getElementById("pSheet").classList.contains("on")))) fail(w, "spreadsheet cell did not fill");
    if (!(await page.textContent("#pSheetNote")).includes(fmt(lang, 62.5))) fail(w, "spreadsheet note does not name 62,5");
    // a question recedes once its answer covers it
    const cov = await page.evaluate(async () => {
      const s = document.getElementById("pQ3").closest(".qa"), a = s.querySelector(".a");
      scrollTo(0, a.getBoundingClientRect().top + scrollY - 120); await new Promise((r) => setTimeout(r, 120));
      return +getComputedStyle(s.querySelector(".q")).getPropertyValue("--c");
    });
    if (!(cov > .5)) fail(w, "question did not recede under its answer (" + cov + ")");
    await ctx.close();
  }
}

// ---------- deep links, back/forward, switching leaves nothing running ----------
{
  const { ctx, page } = await open("P-en", { bare: false });
  const w = "harness";
  let st = await page.evaluate(() => ({ tab: document.querySelector('[role=tab][aria-selected="true"] b').textContent, lang: document.documentElement.lang }));
  if (st.tab !== "P" || st.lang !== "en") fail(w, "deep link #P-en did not load P in English");
  await page.evaluate(() => scrollTo(0, 1500));
  await page.click('[role=tab][data-i="0"]'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => scrollY)) !== 0) fail(w, "switching did not reset scroll");
  if ((await page.evaluate(() => location.hash)) !== "#N-en") fail(w, "tab did not push #N-en");
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(300);
  await page.goBack(); await page.waitForTimeout(300);
  st = await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang }));
  if (st.hash !== "#N-en" || st.lang !== "en") fail(w, "back did not restore N-en: " + JSON.stringify(st));
  await page.goBack(); await page.waitForTimeout(300);
  if ((await page.evaluate(() => document.querySelector('[role=tab][aria-selected="true"] b').textContent)) !== "P") fail(w, "second back did not restore P");
  await page.goForward(); await page.waitForTimeout(300);
  for (const i of [1, 0, 1, 0]) { await page.click('[role=tab][data-i="' + i + '"]'); await page.waitForTimeout(40); }
  await page.waitForTimeout(1700);
  const live = await page.evaluate(() => ({ page: window.__r4.live(), io: window.__live.io }));
  if (live.io !== live.page.observers || live.page.timers !== 0 || live.page.frames !== 0) fail(w, "switching left work running: " + JSON.stringify(live));
  notes.push("after rapid switching: " + JSON.stringify(live));
  await page.focus('[role=tab][aria-selected="true"]'); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200);
  if ((await page.evaluate(() => location.hash)) !== "#P-en") fail(w, "ArrowRight on tabs");
  await focusRing(page, '[role=tab][aria-selected="true"]', w);
  await ctx.close();
}

// ---------- OS dark theme ----------
for (const id of IDS) for (const lang of LANGS) {
  const { ctx, page, errors } = await open(id + "-" + lang, { dark: true });
  const c = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (c === "rgb(244, 242, 239)") fail(id + " dark", "page stayed light under OS dark");
  if (errors.length) fail(id + "-" + lang + " dark", "page errors: " + errors.join(" | "));
  if (SHOTS && lang === "pt") { await page.waitForTimeout(1500); await page.screenshot({ path: join(SHOTS, id + "-pt-375-dark-fold.png") }); }
  await ctx.close();
}

await browser.close();
for (const n of notes) console.log("note: " + n);
if (failures.length) { console.log(failures.length + " failure(s):\n- " + failures.join("\n- ")); process.exit(1); }
console.log("round-4 candidates: all checks passed (" + IDS.length + " candidates x " + LANGS.length + " languages x " + WIDTHS.length + " widths).");
