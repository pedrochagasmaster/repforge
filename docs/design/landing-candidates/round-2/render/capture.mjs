// Captures round-2 source screenshots from the real app, the same way
// tools/landing-prototype/capture.mjs does: 430x932 CSS px at 3x, the app's
// safe-area insets resolved to 59/34 px, a fixed clock, and a saved state.
//
//   REPFORGE_URL=http://localhost:8000/ node docs/design/landing-candidates/round-2/render/capture.mjs
//
// Env: R2_SRC (output dir, default /tmp/r2-src), LANGS, THEMES, ONLY (comma list of scenes).
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STATES, TODAY, EMPTY, COACH_MESSAGE, assistantReply } from "./fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "../../../../../test/package.json"))("playwright");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const OUT = process.env.R2_SRC || "/tmp/r2-src";
const LANGS = (process.env.LANGS || "pt,en").split(",");
const THEMES = (process.env.THEMES || "light,dark").split(",");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
await mkdir(OUT, { recursive: true });
const sleep = (p, ms) => p.waitForTimeout(ms);

async function open(browser, { theme, lang, state, today, empty }) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 3,
    locale: lang === "pt" ? "pt-BR" : "en-US", timezoneId: "UTC",
    colorScheme: theme, serviceWorkers: "block", reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  await page.route("**/styles.css", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text())
      .replaceAll("env(safe-area-inset-top)", "59px").replaceAll("env(safe-area-inset-bottom)", "34px") });
  });
  await page.clock.setFixedTime(new Date(today || "2026-08-31T12:00:00Z"));
  await page.addInitScript(({ state, theme, empty }) => {
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme, ...(empty ? {} : { entryLandingSeen: true }) }));
    localStorage.setItem("repforge_v1", JSON.stringify(state));
  }, { state: empty ? EMPTY(lang) : state, theme, empty });
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__repforgeStorage?.flush === "function", undefined, { timeout: 30000 });
  await page.evaluate((d) => { window.__r2Day = d; }, lang === "pt" ? "Dia 1" : "Day 1");
  await sleep(page, 900);
  return { ctx, page };
}

async function focus(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: window.__r2Day }));
  await sleep(page, 900);
}
// The six-week state ends the mesocycle, so Today stacks block-end notices
// above the card. Dismiss them the way a lifter would before training.
async function focusClean(page) {
  await focus(page);
  for (let i = 0; i < 4; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll("#workout button")].find((x) => x.offsetParent && /^(fechar|dismiss|close)/i.test(x.getAttribute("aria-label") || ""));
      if (b) { b.click(); return true; } return false;
    });
    if (!closed) break;
    await sleep(page, 300);
  }
  await sleep(page, 500);
}
// The per-lift Exercise page, opened from Today the way the app does it.
async function exercisePage(page) {
  await page.click('#todayExList [data-exopen="ex-bench"]');
  await sleep(page, 1100);
}
// The same page scrolled to its e1RM chart and session history. The page head
// is not sticky, so the rows above the chart sit under the island here; the
// landing crops the render below that line.
async function exerciseChart(page) {
  await exercisePage(page);
  await page.evaluate(() => {
    const lab = [...document.querySelectorAll("#exercise *")].find((e) => e.children.length === 0 && /^(progressão|progression)$/i.test(e.textContent.trim()));
    if (!lab) throw new Error("no progression label");
    window.scrollBy(0, lab.getBoundingClientRect().top - 130);
  });
  await sleep(page, 900);
}
async function why(page) {
  await focus(page);
  await page.evaluate(() => {
    const el = document.querySelector('#workout [data-i18n="why.open"]')
      || [...document.querySelectorAll("#workout button, #workout a")].find((b) => /why this weight|por que essa carga/i.test(b.textContent));
    if (!el) throw new Error('no "why this weight" control');
    el.click();
  });
  await page.waitForSelector("#whySheet.is-open, #whySheet[open], #whySheet:not(.hidden)", { timeout: 15000 });
  await sleep(page, 900);
}
// The Progress tab's trend card for the lead lift, scrolled so its label sits
// clear of the dynamic island (the round-1 capture had rows under it).
async function chart(page) {
  await page.evaluate(() => document.querySelector('nav [data-view="stats"]')?.click());
  await sleep(page, 800);
  await page.evaluate(() => {
    const select = document.querySelector("#statExercise");
    const option = [...(select?.options || [])].find((o) => /bench press|supino com barra/i.test(o.textContent));
    if (option) { select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await sleep(page, 600);
  await page.evaluate(() => {
    const card = document.querySelector(".chartcard");
    const label = card.previousElementSibling && card.previousElementSibling.getBoundingClientRect().height < 60 ? card.previousElementSibling : card;
    window.scrollBy(0, label.getBoundingClientRect().top - 76);
  });
  await page.waitForFunction(() => { const c = document.querySelector("#chart"); return c && c.width; }, undefined, { timeout: 20000 });
  await sleep(page, 700);
}
async function hub(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active .entry__hub", { timeout: 25000 });
  await page.click("#entryOwnToggle");
  await sleep(page, 700);
  // close the one-time guide so the three groups read as the screen does later
  await page.evaluate(() => document.querySelector('#onboarding [aria-label="Dispensar guia"], #onboarding [aria-label="Dismiss guide"]')?.click());
  await page.evaluate(() => {
    const lab = [...document.querySelectorAll("#onboarding .entry__group-lab")].pop();
    let sc = lab.parentElement;
    while (sc && sc !== document.body && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
    if (!sc || sc === document.body) sc = document.scrollingElement;
    sc.scrollTop += lab.getBoundingClientRect().top - 190;
  });
  await sleep(page, 700);
}
async function pasteStart(page, lang) {
  await page.click("#firstRunImport");
  await page.waitForSelector("#onboarding.active textarea", { timeout: 25000 });
  await page.fill("#onboarding.active textarea", COACH_MESSAGE[lang]);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await sleep(page, 700);
}
async function pasteSend(page, lang) {
  await pasteStart(page, lang);
  await page.click("#onboarding.active [data-i18n='entry.freeform.continue'], #onboarding.active button:has-text('" + (lang === "pt" ? "Continuar" : "Continue") + "')");
  await sleep(page, 900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(page, 400);
}
async function review(page, lang) {
  await pasteSend(page, lang);
  await page.click("#entryFreeformCopy");
  await sleep(page, 800);
  const areas = await page.locator("#onboarding.active textarea:visible").all();
  if (!areas.length) throw new Error("no reply field after copying the prompt");
  await areas[areas.length - 1].fill(assistantReply(lang));
  await page.evaluate(() => document.activeElement?.blur());
  await page.click("#onboarding.active button:has-text('" + (lang === "pt" ? "Rever o programa" : "Review the program") + "')");
  await sleep(page, 1400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(page, 500);
}

// The rows each band crop keeps: [first element, last element], found by the
// text the app renders, in CSS px from the top of the screen.
const leaf = (root, re) => [...document.querySelectorAll(root + " *")].filter((e) => e.offsetParent && [...e.childNodes].some((c) => c.nodeType === 3 && re.test(c.textContent.trim())));
function bandRows(scene) {
  const T = (el) => el.getBoundingClientRect().top, B = (el) => el.getBoundingClientRect().bottom;
  const first = (list, what) => { if (!list.length) throw new Error("band: no " + what); return list[0]; };
  if (scene.startsWith("focus")) {
    const last = first(leaf("#workout", /^(última sessão|last session)$/i), "last-session label");
    const cue = first(leaf("#workout", /(buscar|aim for) \d+ reps/i), "cue line");
    return [T(last) - 10, B(cue) + 5];
  }
  if (scene === "exchart-six") {
    const prog = first(leaf("#exercise", /^(progressão|progression)$/i), "progression label");
    const records = first(leaf("#exercise", /^(recordes|records)$/i), "records label");
    return [T(prog) - 12, T(records) - 16];
  }
  if (scene === "paste-send") {
    const lines = first(leaf("#onboarding", /(linhas coladas|lines pasted)/i), "pasted summary");
    const prev = first(leaf("#onboarding", /^(pré-visualizar comando|preview prompt)$/i), "preview toggle");
    return [T(lines.closest("div") || lines) - 12, B(prev) + 12];
  }
  if (scene === "paste-review") {
    const h = first(leaf("body", /^(revise os exercícios|review the exercises)$/i), "review heading");
    const more = leaf("body", /^(mais opções|more options)$/i);
    if (!more.length) throw new Error("band: no exercise rows");
    return [T(h) - 30, B(more[0]) + 10];
  }
  if (scene === "hub-own") {
    const lab = [...document.querySelectorAll("#onboarding .entry__group-lab")].pop();
    const cards = [...document.querySelectorAll("#entryOwnChoices .entry-card, #entryOwnChoices button")];
    return [T(lab) - 12, B(cards[cards.length - 1]) + 10];
  }
  return null;
}

const SCENES = {
  "focus-add": { state: "add", run: focus },
  "focus-hold": { state: "hold", run: focus },
  "focus-reduce": { state: "reduce", run: focus },
  "focus-six": { state: "six", run: focusClean },
  "exercise-six": { state: "six", run: exercisePage },
  "exchart-six": { state: "six", run: exerciseChart },
  "why-add": { state: "add", run: why },
  "why-six": { state: "six", run: why },
  "chart-six": { state: "six", run: chart },
  "hub-own": { empty: true, run: hub },
  "paste-start": { empty: true, run: pasteStart },
  "paste-send": { empty: true, run: pasteSend },
  "paste-review": { empty: true, run: review },
};

const browser = await chromium.launch();
for (const lang of LANGS) for (const theme of THEMES) for (const [name, s] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const { ctx, page } = await open(browser, { theme, lang, empty: s.empty, state: s.state && STATES[s.state](lang), today: s.state && TODAY[s.state] });
  const file = name + "-" + lang + "-" + theme;
  try {
    await s.run(page, lang);
    await page.screenshot({ path: join(OUT, file + ".png") });
    let rows = null, bandError = null;
    try { rows = await page.evaluate(`(() => { const leaf = ${leaf.toString()}; ${bandRows.toString()}; return bandRows(${JSON.stringify(name)}); })()`); }
    catch (e) { bandError = e.message.split("\n")[0]; console.log("  band rows: " + bandError); }
    await writeFile(join(OUT, file + ".json"), JSON.stringify({ viewport: [430, 932], rows, bandError }));
    console.log("ok " + file);
  } catch (e) {
    await page.screenshot({ path: join(OUT, file + ".FAILED.png") }).catch(() => {});
    console.log("FAIL " + file + ": " + e.message.split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
