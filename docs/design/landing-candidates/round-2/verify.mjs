// Browser checks for the round-2 landing candidates. Run with the repo root
// served over HTTP and the test/ Playwright install:
//
//   python3 -m http.server 8000 &
//   (cd test && node ../docs/design/landing-candidates/round-2/verify.mjs)
//
// Env: R2_URL (default http://localhost:8000/docs/design/landing-candidates/round-2/),
//      R2_SHOTS (directory for full-page screenshots; skipped when unset),
//      PW_CHROMIUM (optional executablePath).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../");
const URL0 = process.env.R2_URL || "http://localhost:8000/docs/design/landing-candidates/round-2/";
const SHOTS = process.env.R2_SHOTS || "";
const IDS = ["S", "T", "U", "V"];
const LANGS = ["pt", "en"];
const WIDTHS = [360, 375, 430];
const failures = [];
const notes = [];
const fail = (where, msg) => failures.push(where + ": " + msg);

// Catalog + library sources the page must match.
const cat = { pt: JSON.parse(readFileSync(join(root, "i18n-pt.json"), "utf8")), en: JSON.parse(readFileSync(join(root, "i18n-en.json"), "utf8")) };
globalThis.window = globalThis; require(join(root, "exercises.js"));
const library = globalThis.RepForgeExercises.library;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function open(hash, { width = 375, height = 667, bare = true, reduced = false, dark = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference", colorScheme: dark ? "dark" : "light", hasTouch: true });
  // Count live observers and pending timers so a switch can prove it left nothing running.
  await ctx.addInitScript(() => {
    const live = { io: 0, timers: new Set() };
    window.__live = live;
    const IO = window.IntersectionObserver;
    window.IntersectionObserver = class extends IO {
      constructor(cb, o) { super(cb, o); this.__on = false; }
      observe(t) { if (!this.__on) { this.__on = true; live.io++; } return super.observe(t); }
      disconnect() { if (this.__on) { this.__on = false; live.io--; } return super.disconnect(); }
    };
    const st = window.setTimeout, ct = window.clearTimeout;
    window.setTimeout = (fn, ms, ...a) => { const id = st(() => { live.timers.delete(id); typeof fn === "function" && fn(...a); }, ms); live.timers.add(id); return id; };
    window.clearTimeout = (id) => { live.timers.delete(id); return ct(id); };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL0 + (bare ? "?bare" : "") + "#" + hash, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  return { ctx, page, errors };
}

async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 250) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(40); }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function expandAll(page) {
  await page.evaluate(() => {
    document.querySelectorAll("#stage details").forEach((d) => { d.open = true; });
    document.querySelectorAll('#stage .disc[aria-expanded="false"]').forEach((b) => b.click());
  });
  await page.waitForTimeout(300);
}

// Words on a heading's last rendered line.
const ORPHANS = () => [...document.querySelectorAll("#stage h1, #stage h2, #stage h3")].filter((h) => h.offsetParent).map((h) => {
  const words = [];
  const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const t = walk.currentNode; const re = /\S+/g; let m;
    while ((m = re.exec(t.data))) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); const b = r.getBoundingClientRect(); words.push({ w: m[0], top: Math.round(b.top) }); }
  }
  const lastTop = Math.max(...words.map((x) => x.top));
  const onLast = words.filter((x) => Math.abs(x.top - lastTop) < 4);
  const lines = new Set(words.map((x) => Math.round(x.top / 4))).size;
  return { text: h.textContent.trim(), lastLine: onLast.map((x) => x.w).join(" "), orphan: words.length > 2 && lines > 1 && onLast.length === 1 };
});

for (const id of IDS) for (const lang of LANGS) {
  const tag = id + "-" + lang;
  // ---------- per width: overflow, orphans, targets ----------
  for (const width of WIDTHS) {
    const { ctx, page, errors } = await open(tag, { width });
    await scrollThrough(page);
    await expandAll(page);
    const where = tag + "@" + width;
    if (errors.length) fail(where, "page errors: " + errors.join(" | "));
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > width) fail(where, "horizontal scroll " + sw);
    if (width === 360) for (const o of await page.evaluate(ORPHANS)) if (o.orphan) fail(where, "orphan in heading: " + o.text);
    const small = await page.evaluate(() => [...document.querySelectorAll("#stage a, #stage button, #stage summary, #stage [role=spinbutton], #stage [role=radio], .rv button, .rv a")]
      .filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden" && !e.closest(".dock:not(.on)"))
      .map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40), r: e.getBoundingClientRect() }))
      .filter((x) => x.r.height < 43.5 || x.r.width < 43.5).map((x) => x.t + " " + Math.round(x.r.width) + "x" + Math.round(x.r.height)));
    if (small.length) fail(where, "targets under 44px: " + small.join("; "));
    if (width === 375 && SHOTS) {
      await page.evaluate(() => document.querySelectorAll("#stage details").forEach((d) => { d.open = false; }));
      await page.evaluate(() => document.querySelectorAll('#stage .disc[aria-expanded="true"]').forEach((b) => b.click()));
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
      await page.screenshot({ path: join(SHOTS, tag + "-375-full.png"), fullPage: true });
    }
    await ctx.close();
  }

  // ---------- 5-second test at 375x667 ----------
  for (const bare of [true, false]) {
    const { ctx, page } = await open(tag, { bare });
    const fold = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      return { h1: r("#stage h1"), cta: r("#heroCta"), link: r("#stage .link2"), meta: r("#stage .meta") };
    });
    const where = tag + (bare ? " fold" : " fold+review-bar");
    for (const k of ["h1", "cta", "link", "meta"]) if (!fold[k] || fold[k].bottom > 667) fail(where, k + " below the fold (" + (fold[k] && Math.round(fold[k].bottom)) + ")");
    if (bare && SHOTS) await page.screenshot({ path: join(SHOTS, tag + "-375-fold.png") });
    await ctx.close();
  }

  // ---------- copy ----------
  {
    const { ctx, page } = await open(tag);
    await expandAll(page);
    const text = await page.evaluate(() => document.getElementById("stage").innerText + "\n" + [...document.querySelectorAll("#stage [aria-label], #stage img[alt]")].map((e) => e.getAttribute("aria-label") || e.getAttribute("alt")).join("\n"));
    const where = tag + " copy";
    if (/!/.test(text)) fail(where, "exclamation mark");
    if (/—/.test(text)) fail(where, "em dash");
    if (/[“”‘’]/.test(text)) fail(where, "curly quotes");
    if (lang === "pt") {
      for (const w of ["offline", "log", "stats", "performance", "split", "delta", "aparelho", "quatro", "coach", "streak"]) {
        const m = text.match(new RegExp("\\b" + w + "\\b", "i"));
        if (m) fail(where, "banned PT word: " + w);
      }
      if (/\b\d+\.\d\b/.test(text.replace(/\d{2}:\d{2}/g, ""))) fail(where, "EN-style decimal in PT: " + text.match(/\b\d+\.\d\b/)[0]);
      if (/\btu\b|\bteu\b|\btua\b/i.test(text)) fail(where, "tu-form in PT");
    } else if (/\b\d+,\d\b/.test(text)) fail(where, "PT-style decimal in EN: " + text.match(/\b\d+,\d\b/)[0]);
    if (/\bfour\b|\bquatro\b/i.test(text)) fail(where, "four/quatro");
    // exercise names must be exact library names
    const names = await page.evaluate(() => [...document.querySelectorAll("#stage .ledger__ex, #stage .chart__ex, #stage .prog li span:first-child")].map((e) => e.childNodes[0].textContent.trim()));
    for (const nme of names) if (!library.some((x) => (lang === "pt" ? x.namePt : x.name) === nme)) fail(where, "exercise name not in exercises.js: " + nme);
    // i18n strings the page copied
    const K = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.textContent).join("\n"); const m = /var K = (\{[\s\S]*?\n\});/.exec(s); return m ? m[1] : null; });
    if (!K) fail(where, "K table not found");
    else {
      const table = Function("return " + K)();
      for (const [key, [pt, en]] of Object.entries(table)) {
        if (cat.pt[key] !== pt) fail("i18n", key + " PT differs from i18n-pt.json");
        if (cat.en[key] !== en) fail("i18n", key + " EN differs from i18n-en.json");
      }
    }
    // screenshots match the page language
    const srcs = await page.evaluate(() => [...document.querySelectorAll("#stage img, #stage source")].map((e) => e.getAttribute("src") || e.getAttribute("srcset")).filter((s) => /(^|\/)assets\/(brand\/)?(?!mark)[\w-]+-(pt|en)-(light|dark)\.webp/.test(s)));
    if (!srcs.length && id !== "T") fail(where, "no screenshots found to check");
    for (const s of srcs) if (!s.includes("-" + lang + "-")) fail(where, "image language mismatch: " + s);
    await expandAll(page);
    const broken = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll("#stage img")];
      imgs.forEach((i) => { i.loading = "eager"; });
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src"));
    });
    if (broken.length) fail(where, "images that did not load: " + broken.join(", "));
    await ctx.close();
  }

  // ---------- reduced motion shows end states ----------
  {
    const { ctx, page } = await open(tag, { reduced: true });
    const where = tag + " reduced-motion";
    const st = await page.evaluate(() => ({
      rows: [...document.querySelectorAll("#stage [data-row]")].map((r) => r.classList.contains("on")),
      next: [...document.querySelectorAll("#stage #ledgerNext")].map((r) => r.classList.contains("on")),
      segs: [...document.querySelectorAll("#stage [data-seg]")].map((r) => r.classList.contains("on"))
    }));
    if (id !== "V" && st.rows.some((x) => !x)) fail(where, "ledger rows not in end state");
    if (st.next.some((x) => !x)) fail(where, "next target not in end state");
    if (st.segs.some((x) => !x)) fail(where, "chart not fully drawn");
    if (SHOTS && lang === "pt") await page.screenshot({ path: join(SHOTS, tag + "-375-reduced-fold.png") });
    await ctx.close();
  }
}

// ---------- interactions, keyboard, focus ring, sticky ----------
async function focusRing(page, sel, where) {
  const ok = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return "missing"; const cs = getComputedStyle(e); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 ? "ok" : "no ring (" + cs.outlineStyle + " " + cs.outlineWidth + ")"; }, sel);
  if (ok !== "ok") fail(where, sel + " focus ring: " + ok);
}
for (const lang of LANGS) {
  // S: radiogroup by touch and keyboard
  {
    const { ctx, page } = await open("S-" + lang);
    const w = "S-" + lang + " interaction";
    if (await page.evaluate(() => document.getElementById("dock").classList.contains("on"))) fail(w, "sticky visible in hero");
    await page.locator('#seg [data-case="hold"]').tap();
    await page.waitForTimeout(500);
    let v = await page.textContent("#ledgerNext");
    if (!v.includes(cat[lang]["rec.hold_add_reps.label"]) || !v.includes(lang === "pt" ? "100 kg" : "100 kg")) fail(w, "hold segment did not swap case: " + v);
    await page.focus('#seg [aria-checked="true"]');
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    v = await page.textContent("#ledgerNext");
    if (!v.includes(cat[lang]["rec.reduce.label"]) || !v.includes(lang === "pt" ? "67,5 kg" : "67.5 kg")) fail(w, "ArrowRight did not select back-off case");
    await focusRing(page, "#seg [aria-checked=true]", w);
    const live = await page.getAttribute("#ledgerNext .body", "aria-live");
    if (live !== "polite") fail(w, "verdict not aria-live");
    await page.keyboard.press("Home"); await page.waitForTimeout(300);
    if ((await page.getAttribute('#seg [data-case="add"]', "aria-checked")) !== "true") fail(w, "Home key");
    // disclosure
    const btn = page.locator("#sHandBtn");
    await btn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
    if ((await btn.getAttribute("aria-expanded")) !== "true" || await page.locator("#sHand").isHidden()) fail(w, "hand-off disclosure did not open by keyboard");
    await focusRing(page, "#sHandBtn", w);
    // sticky
    const dockOn = () => page.evaluate(() => document.getElementById("dock").classList.contains("on"));
    await page.evaluate(() => { const r = document.getElementById("heroCta").getBoundingClientRect(); scrollTo(0, scrollY + r.bottom + 40); });
    await page.waitForTimeout(400);
    if (!(await dockOn())) fail(w, "sticky not visible after hero CTA leaves");
    await page.evaluate(() => document.getElementById("closeCta").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    if (await dockOn()) fail(w, "sticky still visible at closing CTA");
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const overlap = await page.evaluate(() => { const d = document.getElementById("dock"); if (!d.classList.contains("on")) return null; const r = d.getBoundingClientRect(); const f = document.querySelector("#stage .footer").getBoundingClientRect(); return f.bottom > r.top ? "footer under dock" : null; });
    if (overlap) fail(w, overlap);
    // footer privacy link lands on the data section
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.click("#stage .footer nav a >> nth=0"); await page.waitForTimeout(900);
    const dataTop = await page.evaluate((l) => document.getElementById(l === "pt" ? "dados" : "data").getBoundingClientRect().top, lang);
    if (dataTop < -2 || dataTop > 200) fail(w, "Privacy link did not land on the data section (" + Math.round(dataTop) + ")");
    if (!(await page.evaluate(() => location.hash)).match(/^#S-(pt|en)$/)) fail(w, "in-page anchor clobbered the deep link");
    await ctx.close();
  }
  // T: steppers, keyboard, reveal matches the embedded grid
  {
    const { ctx, page } = await open("T-" + lang);
    const w = "T-" + lang + " interaction";
    const grid = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.textContent).join(""); return JSON.parse(/var GRID = (\{.*?\});\/\*@end/.exec(s)[1]); });
    await page.locator('[data-step="reps"][data-d="1"]').tap(); await page.locator('[data-step="reps"][data-d="1"]').tap();
    await page.locator("#tLog").tap(); await page.waitForTimeout(200);
    let c = grid.cells["10/1"], txt = await page.textContent("#tRes");
    const fmt = (x) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en").format(x);
    if (!txt.includes(fmt(c.load) + " kg")) fail(w, "10/1 reveal shows wrong load: " + txt);
    await page.focus("#tv-rir"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
    await focusRing(page, "#tv-rir", w);
    const pend = await page.textContent("#tRes");
    if (!pend.includes(cat[lang]["today.log_set"])) fail(w, "changing set 3 did not return to pending");
    await page.focus("#tv-reps"); for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
    await page.focus("#tLog"); await page.keyboard.press("Enter"); await page.waitForTimeout(200);
    c = grid.cells["6/0"]; txt = await page.textContent("#tRes");
    if (!txt.includes(fmt(c.load) + " kg") || !txt.includes(cat[lang]["rec.reduce.label"])) fail(w, "6/0 keyboard reveal wrong: " + txt);
    if ((await page.isDisabled('[data-step="reps"][data-d="-1"]')) !== true) fail(w, "reps minus not disabled at 6");
    // every cell renders and states the engine's load
    for (const key of Object.keys(grid.cells)) {
      const [r, i] = key.split("/").map(Number);
      for (const [el, v, vals] of [["#tv-reps", r, grid.reps], ["#tv-rir", i, grid.rirs]]) {
        await page.focus(el); await page.keyboard.press("Home");
        for (let j = 0; j < vals.indexOf(v); j++) await page.keyboard.press("ArrowUp");
      }
      await page.click("#tLog");
      const t = await page.textContent("#tRes"), cc = grid.cells[key];
      const label = { add: "rec.add.label", hold: "rec.hold_add_reps.label", push: "rec.push_reps.label", reduce: "rec.reduce.label" }[cc.verdict];
      if (!t.includes(fmt(cc.load) + " kg") || !t.includes(cat[lang][label])) fail(w, "cell " + key + " reveal wrong: " + t);
    }
    await ctx.close();
  }
  // U: chart advances with scroll; sticky
  {
    const { ctx, page } = await open("U-" + lang);
    const w = "U-" + lang + " interaction";
    await page.evaluate(() => document.querySelector('[data-wk="4"]').scrollIntoView({ block: "center" }));
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => ({ on: document.querySelectorAll("#stage .seg.on").length, now: document.querySelector("#stage .dot.now").dataset.dot, dock: document.getElementById("dock").classList.contains("on") }));
    if (s.now !== "3") fail(w, "chart not at week 4 (now dot " + s.now + ")");
    if (!s.dock) fail(w, "sticky hidden mid-page");
    const cover = await page.evaluate(() => { const c = document.getElementById("uChart").getBoundingClientRect(); return c.bottom < innerHeight * .45; });
    if (!cover) fail(w, "pinned chart taller than the upper half");
    await page.evaluate(() => document.getElementById("closeCta").scrollIntoView({ block: "center" })); await page.waitForTimeout(400);
    if (await page.evaluate(() => document.getElementById("dock").classList.contains("on"))) fail(w, "sticky still visible at closing CTA");
    await ctx.close();
  }
  // V: disclosure
  {
    const { ctx, page } = await open("V-" + lang);
    const w = "V-" + lang + " interaction";
    const s2 = await page.evaluate(() => { const b = document.querySelector("#vHowBtn").getBoundingClientRect(); return b.bottom + scrollY; });
    if (s2 > 667 * 2) fail(w, "How it works button beyond two screens (" + Math.round(s2) + ")");
    const second = await page.evaluate(() => document.getElementById("closeCta").getBoundingClientRect().bottom + scrollY);
    if (second > 667 * 2) fail(w, "second CTA beyond two screens");
    await page.locator("#vHowBtn").tap(); await page.waitForTimeout(200);
    if (await page.locator("#vHow").isHidden()) fail(w, "How it works did not open");
    await page.focus("#closeCta"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
    await focusRing(page, "#vHowBtn", w);
    await ctx.close();
  }
}

// ---------- deep links, back/forward, switching leaves nothing running ----------
{
  const { ctx, page } = await open("U-en", { bare: false });
  const w = "harness";
  let st = await page.evaluate(() => ({ tab: document.querySelector('[role=tab][aria-selected="true"] b').textContent, lang: document.documentElement.lang }));
  if (st.tab !== "U" || st.lang !== "en") fail(w, "deep link #U-en did not load U in English");
  await page.evaluate(() => scrollTo(0, 1500));
  await page.click('[role=tab][data-i="0"]'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => scrollY)) !== 0) fail(w, "switching did not reset scroll");
  if ((await page.evaluate(() => location.hash)) !== "#S-en") fail(w, "tab did not push #S-en");
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(300);
  await page.goBack(); await page.waitForTimeout(300);
  st = await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang }));
  if (st.hash !== "#S-en" || st.lang !== "en") fail(w, "back did not restore S-en: " + JSON.stringify(st));
  await page.goBack(); await page.waitForTimeout(300);
  if ((await page.evaluate(() => document.querySelector('[role=tab][aria-selected="true"] b').textContent)) !== "U") fail(w, "second back did not restore U");
  await page.goForward(); await page.waitForTimeout(300);
  if ((await page.evaluate(() => location.hash)) !== "#S-en") fail(w, "forward did not restore S-en");
  // Start S's row fill and hand-off timers, then switch away mid-flight.
  await page.evaluate(() => document.getElementById("ledger").scrollIntoView());
  await page.waitForTimeout(150);
  for (const i of [3, 1, 2, 0, 3]) { await page.click('[role=tab][data-i="' + i + '"]'); await page.waitForTimeout(30); }
  await page.waitForTimeout(50);
  const live = await page.evaluate(() => ({ page: window.__r2.live(), io: window.__live.io }));
  const expectIo = live.page.observers; // V registers none
  if (live.io !== expectIo || live.page.timers !== 0) fail(w, "switching left work running: " + JSON.stringify(live));
  notes.push("after rapid switching to V: " + JSON.stringify(live));
  // keyboard on tabs
  await page.focus('[role=tab][aria-selected="true"]'); await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(200);
  if ((await page.evaluate(() => location.hash)) !== "#U-en") fail(w, "ArrowLeft on tabs");
  await focusRing(page, '[role=tab][aria-selected="true"]', w);
  await ctx.close();
}

// ---------- OS dark theme ----------
for (const id of IDS) {
  const { ctx, page } = await open(id + "-pt", { dark: true });
  const c = await page.evaluate(() => { const cs = getComputedStyle(document.body); return [cs.backgroundColor, cs.color]; });
  if (c[0] === "rgb(244, 242, 239)") fail(id + " dark", "page stayed light under OS dark");
  if (SHOTS) { await scrollThrough(page); await page.screenshot({ path: join(SHOTS, id + "-pt-375-dark-full.png"), fullPage: true }); }
  await ctx.close();
}

await browser.close();
for (const n of notes) console.log("note: " + n);
if (failures.length) { console.log(failures.length + " failure(s):\n- " + failures.join("\n- ")); process.exit(1); }
console.log("round-2 candidates: all checks passed (" + IDS.length + " candidates x " + LANGS.length + " languages x " + WIDTHS.length + " widths).");
