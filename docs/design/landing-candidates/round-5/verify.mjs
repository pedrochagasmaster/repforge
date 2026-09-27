// Browser checks for the round-5 landing candidates A, B and C. Run with the
// repo root served over HTTP and the test/ Playwright install:
//
//   python3 -m http.server 8000 &
//   (cd test && node ../docs/design/landing-candidates/round-5/verify.mjs)
//
// Env: R5_URL (default http://localhost:8000/docs/design/landing-candidates/round-5/),
//      R5_SHOTS (directory for screenshots; skipped when unset), PW_CHROMIUM (optional executablePath).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../");
const URL0 = process.env.R5_URL || "http://localhost:8000/docs/design/landing-candidates/round-5/";
const SHOTS = process.env.R5_SHOTS || "";
const IDS = ["A", "B", "C"];
const LANGS = ["pt", "en"];
const WIDTHS = [360, 375, 390, 430];
const failures = [];
const notes = [];
const fail = (where, msg) => failures.push(where + ": " + msg);
const cat = { pt: JSON.parse(readFileSync(join(root, "i18n-pt.json"), "utf8")), en: JSON.parse(readFileSync(join(root, "i18n-en.json"), "utf8")) };
const fmt = (lang, x) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en", { maximumFractionDigits: 1 }).format(x);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function open(hash, { width = 390, height = 844, bare = true, reduced = false, dark = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: dark ? "dark" : "light", hasTouch: true });
  await ctx.addInitScript(() => {
    const live = { io: 0 }; window.__live = live;
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
  for (let y = 0; y < h; y += 240) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(25); if (check) await check(y); }
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
}
async function expandAll(page) {
  await page.evaluate(() => { document.querySelectorAll("#stage details").forEach((d) => { d.open = true; }); document.querySelectorAll('#stage .disc[aria-expanded="false"]').forEach((b) => b.click()); });
  await page.waitForTimeout(300);
}
const ORPHANS = () => [...document.querySelectorAll("#stage h1, #stage h2, #stage h3")].filter((h) => h.offsetParent).map((h) => {
  const words = []; const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) { const t = walk.currentNode; const re = /\S+/g; let m; while ((m = re.exec(t.data))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); words.push({ top: Math.round(r.getBoundingClientRect().top) }); } }
  const lastTop = Math.max(...words.map((x) => x.top)); const onLast = words.filter((x) => Math.abs(x.top - lastTop) < 4).length;
  const lines = new Set(words.map((x) => Math.round(x.top / 4))).size;
  return { text: h.textContent.trim(), orphan: words.length > 2 && lines > 1 && onLast === 1 };
});

for (const id of IDS) for (const lang of LANGS) {
  const tag = id + "-" + lang;
  // ---------- per width: overflow, orphans, targets ----------
  for (const width of WIDTHS) {
    const { ctx, page, errors } = await open(tag, { width });
    const where = tag + "@" + width;
    let wide = 0;
    await scrollThrough(page, async () => { const sw = await page.evaluate(() => document.documentElement.scrollWidth); if (sw > width) wide = Math.max(wide, sw); });
    if (wide) fail(where, "horizontal scroll " + wide);
    await expandAll(page);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > width) fail(where, "horizontal scroll with everything open " + sw);
    if (errors.length) fail(where, "page errors: " + errors.join(" | "));
    for (const o of await page.evaluate(ORPHANS)) if (o.orphan) fail(where, "orphan in heading: " + o.text);
    const small = await page.evaluate(() => [...document.querySelectorAll("#stage a, #stage button, #stage summary, .rv button, .rv a")]
      .filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && !e.closest(".dock:not(.on)"))
      .map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40), r: e.getBoundingClientRect() }))
      .filter((x) => x.r.height < 43.5 || x.r.width < 43.5).map((x) => x.t + " " + Math.round(x.r.width) + "x" + Math.round(x.r.height)));
    if (small.length) fail(where, "targets under 44px: " + small.join("; "));
    await ctx.close();
  }

  // ---------- first screen at 390x844: headline, subtitle, CTA, nothing covering them ----------
  for (const bare of [true, false]) {
    const { ctx, page } = await open(tag, { bare });
    const where = tag + (bare ? " first screen" : " first screen+review-bar");
    const f = await page.evaluate(() => {
      const out = {};
      for (const [k, s] of [["h1", "#stage h1"], ["sub", "#stage .hero .sub"], ["cta", "#heroCta"]]) {
        const e = document.querySelector(s), r = e.getBoundingClientRect();
        const pts = [[r.left + 18, r.top + 18], [r.right - 18, r.bottom - 18], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
        out[k] = { top: r.top, bottom: r.bottom, covered: pts.some(([x, y]) => { const hit = document.elementFromPoint(x, y); return !hit || !(e === hit || e.contains(hit)); }) };
      }
      out.rv = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--rv"), 10) || 0;
      out.dock = document.getElementById("dock").classList.contains("on");
      out.heroDigits = /\d/.test(document.querySelector("#stage .hero").innerText);
      return out;
    });
    for (const k of ["h1", "sub", "cta"]) if (f[k].bottom > 844 || f[k].top < f.rv || f[k].covered) fail(where, k + " not fully visible and uncovered " + JSON.stringify(f[k]));
    if (f.dock) fail(where, "sticky CTA showing while the hero CTA is on screen");
    if (f.heroDigits) fail(where, "the hero shows figures");
    if (bare && SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: join(SHOTS, tag + "-390-first.png") }); }
    // the sticky appears once the hero CTA scrolls away, and steps aside at the closing CTA
    await page.evaluate(() => { const r = document.getElementById("heroCta").getBoundingClientRect(); scrollTo(0, scrollY + r.bottom + 40); });
    await page.waitForTimeout(500);
    if (!(await page.evaluate(() => document.getElementById("dock").classList.contains("on")))) fail(where, "sticky CTA did not appear after the hero CTA left");
    await page.evaluate(() => document.getElementById("closeCta").scrollIntoView({ block: "center" })); await page.waitForTimeout(500);
    if (await page.evaluate(() => document.getElementById("dock").classList.contains("on"))) fail(where, "sticky CTA still showing at the closing CTA");
    const label = (await page.textContent("#dockCta")).trim();
    if (label !== (lang === "pt" ? "Montar meu treino" : "Build my program")) fail(where, "sticky CTA reads " + label);
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
    if (/\b(streaks?|badges?|medalhas?|conquistas?)\b/i.test(text)) fail(where, "streak or badge language");
    if (lang === "pt") {
      for (const w of ["offline", "log", "stats", "performance", "split", "delta", "aparelho", "quatro", "coach", "streak"]) if (new RegExp("\\b" + w + "\\b", "i").test(text)) fail(where, "banned PT word: " + w);
      if (/\b\d+\.\d\b/.test(text.replace(/\d{2}:\d{2}/g, ""))) fail(where, "EN-style decimal in PT");
      if (/\btu\b|\bteu\b|\btua\b/i.test(text)) fail(where, "tu-form in PT");
      if (/\bprogramas?\b/i.test(plain)) fail(where, "PT says programa outside an app label");
      for (const w of ["faixa", "topo", "piso", "hist[óo]rico de treinos", "o treino", "você n[ãa]o perde nada", "nunca perde"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "PT wording: " + w);
      if (!/Você não precisa criar uma conta\./.test(text)) fail(where, "missing \"Você não precisa criar uma conta.\"");
      if (!/Chegue na academia sabendo exatamente o que fazer\./.test(text)) fail(where, "headline is not the live one");
    } else {
      if (/\b\d+,\d\b/.test(text)) fail(where, "PT-style decimal in EN");
      for (const w of ["range", "the floor", "the program", "you lose nothing", "never lose"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "EN wording: " + w);
    }
    // usage data only in the FAQ
    const dataBand = await page.evaluate((l) => document.getElementById(l === "pt" ? "dados" : "data").innerText, lang);
    if (/Dados de uso|usage data|pseud/i.test(dataBand)) fail(where, "usage data outside the FAQ");
    if (!/O Taurifer coleta algum dado|Does Taurifer collect any data/.test(text)) fail(where, "no data-collection answer");
    // RIR explained where it first appears
    const rir = await page.evaluate(() => { const t = document.getElementById("stage").innerText; return { first: t.search(/\bRIR\b/), key: t.search(/repetições em reserva|reps in reserve/i) }; });
    if (rir.key < 0 || rir.key - rir.first > 40) fail(where, "RIR not explained where it first appears " + JSON.stringify(rir));
    // a one-line bridge before the demo, and a what-you-see line before every app screen
    const seen = await page.evaluate(() => {
      const bridge = document.querySelector("#demoH + .sub"); const wt = document.getElementById("wtGlass");
      const band = document.querySelector(".bandimg"); let s = band && band.closest("figure").previousElementSibling;
      return { bridge: !!bridge && /tela de treino do app|app's workout screen/.test(bridge.textContent) && !!(bridge.compareDocumentPosition(wt) & 4), band: !!s && s.classList.contains("seeing") };
    });
    if (!seen.bridge) fail(where, "no one-line bridge naming the screen before the walkthrough");
    if (!seen.band) fail(where, "paste screen without a what-you-see line");
    // strings copied from the app, and page wording ahead of it
    const tables = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.textContent).join("\n"); const k = /var K = (\{[\s\S]*?\n\});/.exec(s); const p = /var P = (\{[\s\S]*?\n\});/.exec(s); return [k && k[1], p && p[1]]; });
    if (!tables[0] || !tables[1]) fail(where, "K or P table not found");
    else {
      for (const [key, [pt, en]] of Object.entries(Function("return " + tables[0])())) { if (cat.pt[key] !== pt) fail("i18n", key + " PT differs"); if (cat.en[key] !== en) fail("i18n", key + " EN differs"); }
      for (const [key, v] of Object.entries(Function("return " + tables[1])())) { if (cat.pt[key] !== v.from[0] || cat.en[key] !== v.from[1]) fail("i18n", key + " moved in the app: update P"); if (/programa/i.test(v.pt)) fail("i18n", key + " still says programa"); }
    }
    // screens follow the page language and load
    const srcs = await page.evaluate(() => [...document.querySelectorAll("#stage img, #stage source")].map((e) => e.getAttribute("src") || e.getAttribute("srcset")).filter((s) => /-(pt|en)-(light|dark)\.webp/.test(s)));
    if (srcs.length < 5) fail(where, "app screens missing");
    for (const s of srcs) if (!s.includes("-" + lang + "-")) fail(where, "image language mismatch: " + s);
    const broken = await page.evaluate(async () => { const imgs = [...document.querySelectorAll("#stage img")]; imgs.forEach((i) => { i.loading = "eager"; }); await Promise.all(imgs.map((i) => i.decode().catch(() => {}))); return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")); });
    if (broken.length) fail(where, "images that did not load: " + broken.join(", "));
    // the walkthrough ends on the second-person explanation with the engine's numbers
    const last = await page.evaluate(() => [...document.querySelectorAll("#stage .cap, #stage .card")].pop().textContent);
    if (!(lang === "pt" ? /Você fez 10 repetições com 60 kg nas três séries, o máximo da sua meta/ : /You did 10 reps at 60 kg on all three sets/).test(last) || !last.includes(fmt(lang, 62.5) + " kg")) fail(where, "walkthrough does not end on the explained recommendation: " + last);
    await ctx.close();
  }
}

// ---------- the walkthroughs ----------
for (const lang of LANGS) {
  for (const id of ["A", "B"]) {
    for (const reduced of [false, true]) {
      const { ctx, page, errors } = await open(id + "-" + lang, { reduced });
      const w = id + "-" + lang + " walkthrough" + (reduced ? " (reduced motion)" : "");
      const box = await page.evaluate(() => { const s = document.getElementById("wt"); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight }; });
      const steps = []; let lensSeen = false;
      for (let y = box.top; y < box.top + box.h - 700; y += 120) {
        await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(40);
        const s = await page.evaluate(() => ({ step: +document.getElementById("wtPhone").dataset.step, lens: !!document.querySelector("#wtLens.on") }));
        steps.push(s.step); if (s.lens) lensSeen = true;
      }
      if (new Set(steps).size !== 7 || steps.some((s, i) => i && s < steps[i - 1])) fail(w, "steps did not advance through all seven with scroll: " + [...new Set(steps)].join(","));
      if (id === "B" && !lensSeen) fail(w, "the lens never appeared");
      await page.waitForTimeout(reduced ? 100 : 1400);
      const end = await page.evaluate(() => { const c = document.querySelector("#stage .cap.on"); const sl = c && c.querySelector(".slip"); return { text: c && c.textContent, slip: sl ? getComputedStyle(sl).clipPath : null, visible: c && getComputedStyle(c).opacity }; });
      if (!end.text || !/Você fez|You did/.test(end.text) || end.visible !== "1") fail(w, "last step not shown: " + JSON.stringify(end));
      if (id === "A" && end.slip && !/inset\(0(px)?\)|none/.test(end.slip)) fail(w, "the slip did not print: " + end.slip);
      if (errors.length) fail(w, "page errors: " + errors.join(" | "));
      if (SHOTS && !reduced && lang === "pt") await page.screenshot({ path: join(SHOTS, id + "-pt-390-walkthrough-end.png") });
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open("C-" + lang);
    const w = "C-" + lang + " deck";
    await page.evaluate(() => document.getElementById("deck").scrollIntoView({ block: "center" })); await page.waitForTimeout(300);
    if ((await page.getAttribute("#deckPrev", "aria-disabled")) !== "true") fail(w, "previous not disabled on the first card");
    for (let i = 0; i < 6; i++) { await page.locator("#deckNext").tap(); await page.waitForTimeout(450); }
    let s = await page.evaluate(() => ({ step: +document.getElementById("wtPhone").dataset.step, next: document.getElementById("deckNext").getAttribute("aria-disabled"), count: document.getElementById("deckCount").textContent }));
    if (s.step !== 6 || s.next !== "true") fail(w, "next did not walk to the last card: " + JSON.stringify(s));
    await page.focus("#deck"); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(450);
    s = await page.evaluate(() => +document.getElementById("wtPhone").dataset.step);
    if (s !== 5) fail(w, "ArrowLeft did not step back (" + s + ")");
    // swiping: scroll the deck and the phone follows
    await page.evaluate(() => { const d = document.getElementById("deck"), c = d.querySelectorAll(".card")[1]; d.scrollTo({ left: c.offsetLeft - d.querySelector(".card").offsetLeft }); }); await page.waitForTimeout(500);
    if ((await page.evaluate(() => +document.getElementById("wtPhone").dataset.step)) !== 1) fail(w, "swiping the deck did not move the phone");
    const ring = await page.evaluate(() => getComputedStyle(document.getElementById("deckNext")).borderRadius);
    notes.push("C deck button radius " + ring);
    if (SHOTS && lang === "pt") await page.screenshot({ path: join(SHOTS, "C-pt-390-deck.png") });
    await ctx.close();
  }
}

// ---------- harness ----------
{
  const { ctx, page } = await open("B-en", { bare: false });
  const w = "harness";
  let st = await page.evaluate(() => ({ tab: document.querySelector('[role=tab][aria-selected="true"] b').textContent, lang: document.documentElement.lang }));
  if (st.tab !== "B" || st.lang !== "en") fail(w, "deep link #B-en did not load B in English");
  await page.evaluate(() => scrollTo(0, 1500));
  await page.click('[role=tab][data-i="0"]'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => scrollY)) !== 0) fail(w, "switching did not reset scroll");
  if ((await page.evaluate(() => location.hash)) !== "#A-en") fail(w, "tab did not push #A-en");
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(300);
  await page.goBack(); await page.waitForTimeout(300);
  st = await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang }));
  if (st.hash !== "#A-en" || st.lang !== "en") fail(w, "back did not restore A-en");
  await page.goBack(); await page.waitForTimeout(300);
  if ((await page.evaluate(() => document.querySelector('[role=tab][aria-selected="true"] b').textContent)) !== "B") fail(w, "second back did not restore B");
  for (const i of [2, 0, 1, 2, 0]) { await page.click('[role=tab][data-i="' + i + '"]'); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);
  const live = await page.evaluate(() => ({ page: window.__r5.live(), io: window.__live.io }));
  if (live.io !== live.page.observers || live.page.timers !== 0 || live.page.frames !== 0) fail(w, "switching left work running: " + JSON.stringify(live));
  notes.push("after rapid switching: " + JSON.stringify(live));
  await page.focus('[role=tab][aria-selected="true"]'); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200);
  if ((await page.evaluate(() => location.hash)) !== "#B-en") fail(w, "ArrowRight on tabs");
  await ctx.close();
}
for (const id of IDS) for (const lang of LANGS) {
  const { ctx, page, errors } = await open(id + "-" + lang, { dark: true });
  const c = await page.evaluate(() => getComputedStyle(document.querySelector("#stage > div")).backgroundColor + "|" + getComputedStyle(document.body).backgroundColor);
  if (/rgb\(244, 242, 239\)/.test(c.split("|")[1])) fail(id + " dark", "page stayed light under OS dark");
  if (errors.length) fail(id + "-" + lang + " dark", "page errors: " + errors.join(" | "));
  if (SHOTS && lang === "pt") { await page.waitForTimeout(400); await page.screenshot({ path: join(SHOTS, id + "-pt-390-first-dark.png") }); }
  await ctx.close();
}

await browser.close();
for (const n of notes) console.log("note: " + n);
if (failures.length) { console.log(failures.length + " failure(s):\n- " + failures.join("\n- ")); process.exit(1); }
console.log("round-5 candidates: all checks passed (" + IDS.length + " candidates x " + LANGS.length + " languages x " + WIDTHS.length + " widths).");
