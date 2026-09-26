// Browser checks for round-3 landing candidate S. Run with the repo root
// served over HTTP and the test/ Playwright install:
//
//   python3 -m http.server 8000 &
//   (cd test && node ../docs/design/landing-candidates/round-3/verify.mjs)
//
// Env: R3_URL (default http://localhost:8000/docs/design/landing-candidates/round-3/),
//      R3_SHOTS (directory for full-page screenshots; skipped when unset),
//      PW_CHROMIUM (optional executablePath).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../");
const URL0 = process.env.R3_URL || "http://localhost:8000/docs/design/landing-candidates/round-3/";
const SHOTS = process.env.R3_SHOTS || "";
const IDS = ["S"];
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
    // i18n strings the page copied, and the page wording that runs ahead of the app
    const tables = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.textContent).join("\n"); const k = /var K = (\{[\s\S]*?\n\});/.exec(s); const p = /var P = (\{[\s\S]*?\n\});/.exec(s); return [k && k[1], p && p[1]]; });
    if (!tables[0]) fail(where, "K table not found");
    else {
      const table = Function("return " + tables[0])();
      for (const [key, [pt, en]] of Object.entries(table)) {
        if (cat.pt[key] !== pt) fail("i18n", key + " PT differs from i18n-pt.json");
        if (cat.en[key] !== en) fail("i18n", key + " EN differs from i18n-en.json");
      }
    }
    if (!tables[1]) fail(where, "P table not found");
    else {
      const table = Function("return " + tables[1])();
      for (const [key, v] of Object.entries(table)) {
        if (cat.pt[key] !== v.from[0] || cat.en[key] !== v.from[1]) fail("i18n", key + " moved in the app: update P (round 3 runs ahead of it)");
        if (/programa/i.test(v.pt)) fail("i18n", key + " page wording still says programa");
      }
    }
    // round-3 copy rules
    const plain = await page.evaluate(() => { const c = document.getElementById("stage").cloneNode(true); c.querySelectorAll(".ui").forEach((e) => e.remove()); return c.innerText; });
    if (lang === "pt") {
      const m = plain.match(/\bprogramas?\b/i);
      if (m) fail(where, "PT says programa outside an app label: " + plain.slice(Math.max(0, plain.search(/\bprogramas?\b/i) - 60), plain.search(/\bprogramas?\b/i) + 20).replace(/\n/g, " "));
      for (const w of ["faixa", "topo", "piso", "hist[óo]rico de treinos", "o treino", "as s[ée]ries fizeram"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "PT round-3 wording: " + w);
    } else for (const w of ["range", "the floor", "the sets did", "the program"]) if (new RegExp("\\b" + w + "\\b", "i").test(plain)) fail(where, "EN round-3 wording: " + w);
    // RIR is explained where it first appears, before the FAQ
    const rir = await page.evaluate(() => { const t = document.getElementById("stage").innerText; return { first: t.search(/\bRIR\b/), key: t.search(/repetições em reserva|reps in reserve/i), faq: t.search(/O que é RIR|What is RIR/) }; });
    if (rir.key < 0 || rir.key - rir.first > 40 || rir.key > rir.faq) fail(where, "RIR not explained where it first appears " + JSON.stringify(rir));
    // the data section no longer carries usage data or the install transfer; the FAQ does
    const data = await page.evaluate((l) => document.getElementById(l === "pt" ? "dados" : "data").innerText, lang);
    if (/Dados de uso|Usage data|transfer/i.test(data)) fail(where, "data section still mentions usage data or the install transfer");
    if (!/O Taurifer coleta algum dado|Does Taurifer collect any data/.test(text)) fail(where, "FAQ has no data-collection entry");

    // screenshots match the page language
    const srcs = await page.evaluate(() => [...document.querySelectorAll("#stage img, #stage source")].map((e) => e.getAttribute("src") || e.getAttribute("srcset")).filter((s) => /(^|\/)assets\/(brand\/)?(?!mark)[\w-]+-(pt|en)-(light|dark)\.webp/.test(s)));
    if (!srcs.length) fail(where, "no screenshots found to check");
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
    if (st.rows.some((x) => !x)) fail(where, "ledger rows not in end state");
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
    if (!v.includes(cat[lang]["rec.hold_add_reps.text"])) fail(w, "hold explanation does not quote rec.hold_add_reps.text");
    if (!v.includes(cat[lang]["rec.hold_add_reps.label"]) || !v.includes(lang === "pt" ? "100 kg" : "100 kg")) fail(w, "hold segment did not swap case: " + v);
    await page.focus('#seg [aria-checked="true"]');
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    v = await page.textContent("#ledgerNext");
    if (!v.includes(cat[lang]["rec.reduce.text"].split("{min}").join("8"))) fail(w, "back-off explanation does not quote rec.reduce.text");
    if (!/^(Você fez|You did)/.test(await page.textContent("#ledgerNext .why"))) fail(w, "explanation is not second person");
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
}

// ---------- deep links, back/forward, switching leaves nothing running ----------
{
  const { ctx, page } = await open("S-en", { bare: false });
  const w = "harness";
  if ((await page.evaluate(() => document.documentElement.lang)) !== "en") fail(w, "deep link #S-en did not load English");
  if ((await page.getAttribute("#r2", "href")) !== "../round-2/#S-en") fail(w, "round-2 link does not follow the language");
  await page.evaluate(() => scrollTo(0, 1500));
  await page.click('[data-lang="pt"]'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => scrollY)) !== 0) fail(w, "switching language did not reset scroll");
  if ((await page.evaluate(() => location.hash)) !== "#S-pt") fail(w, "language did not push #S-pt");
  await page.goBack(); await page.waitForTimeout(300);
  let st = await page.evaluate(() => ({ hash: location.hash, lang: document.documentElement.lang }));
  if (st.hash !== "#S-en" || st.lang !== "en") fail(w, "back did not restore S-en: " + JSON.stringify(st));
  await page.goForward(); await page.waitForTimeout(300);
  if ((await page.evaluate(() => location.hash)) !== "#S-pt") fail(w, "forward did not restore S-pt");
  // Start the row fill, then switch language mid-flight.
  await page.evaluate(() => document.getElementById("ledger").scrollIntoView());
  await page.waitForTimeout(150);
  for (const l of ["en", "pt", "en"]) { await page.click('[data-lang="' + l + '"]'); await page.waitForTimeout(30); }
  await page.waitForTimeout(50);
  const live = await page.evaluate(() => ({ page: window.__r3.live(), io: window.__live.io }));
  if (live.io !== live.page.observers || live.page.timers !== 0) fail(w, "switching left work running: " + JSON.stringify(live));
  notes.push("after rapid language switching: " + JSON.stringify(live));
  await page.focus('[data-lang="pt"]'); await page.keyboard.press("Tab");
  await focusRing(page, '[data-lang="en"]', w);
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
console.log("round-3 S: all checks passed (" + IDS.length + " candidate x " + LANGS.length + " languages x " + WIDTHS.length + " widths).");
