// Captures the round-5 walkthrough screens from the real app: one bench
// session (round 3's "add" case: 60 kg x 10, 10, 10 at RIR 2, target 8-10),
// the shipped UI at 390x844 CSS px and 2x, a fixed clock, a saved state.
// Nothing is redrawn. Each screen is written as WebP (encoded by Chromium)
// with the hotspots the walkthrough zooms to, measured from the app's own
// elements, into ../index.html's /*@SHOTS*/ block.
//
//   python3 -m http.server 8000 &
//   (cd test && REPFORGE_URL=http://localhost:8000/ node ../docs/design/landing-candidates/round-5/render/capture.mjs)
//
// Env: PW_CHROMIUM (optional executablePath).
import { writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { STATES, TODAY } from "../../round-2/render/fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "../../../../../test/package.json"))("playwright");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const OUT = join(here, "../assets");
const PAGE = join(here, "../index.html");
const W = 390, H = 844, DPR = 2;
const NOTE = { pt: "Banco no 4, pegada um dedo além da marca.", en: "Bench on 4, grip one finger past the ring." };

async function open(browser, lang, theme) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: DPR,
    locale: lang === "pt" ? "pt-BR" : "en-US", timezoneId: "UTC",
    colorScheme: theme, serviceWorkers: "block", reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.route("**/styles.css", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text())
      .replaceAll("env(safe-area-inset-top)", "47px").replaceAll("env(safe-area-inset-bottom)", "34px") });
  });
  await page.clock.setFixedTime(new Date(TODAY.add));
  await page.addInitScript(({ state, theme }) => {
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme, entryLandingSeen: true, guides: { seen: ["*"] } }));
    localStorage.setItem("repforge_v1", JSON.stringify(state));
  }, { state: STATES.add(lang), theme });
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__repforgeStorage?.flush === "function", undefined, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.evaluate((d) => window.__repforgeEnterWorkout({ focus: true, day: d }), lang === "pt" ? "Dia 1" : "Day 1");
  await page.waitForTimeout(900);
  // one-time guides and tips are not part of a returning lifter's screen
  for (let i = 0; i < 4; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll("#workout button, .guide button, [class*=guide] button")].find((x) => x.offsetParent && /^(fechar|dispensar|dismiss|close)/i.test(x.getAttribute("aria-label") || ""));
      if (b) { b.click(); return true; } return false;
    });
    if (!closed) break;
    await page.waitForTimeout(250);
  }
  return { ctx, page };
}

// Hotspot: centre of an element as % of the screen, and its size in %.
const box = (sel, re) => {
  let els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length);
  if (re) els = els.filter((e) => new RegExp(re, "i").test(e.textContent));
  const e = els[0]; if (!e) return null;
  const r = e.getBoundingClientRect();
  return [+(100 * (r.left + r.width / 2) / innerWidth).toFixed(2), +(100 * (r.top + r.height / 2) / innerHeight).toFixed(2), +(100 * r.width / innerWidth).toFixed(1), +(100 * r.height / innerHeight).toFixed(1)];
};

const SCENES = {
  focus: { run: async () => {}, spots: {
    now: ["#workout .is-current *", "^(\\s*)?(agora|now)\\b.*(buscar|aim for)"],
    dials: ["#workout .is-current [class*=dial], #workout .is-current [class*=stepper], #workout .is-current .focus-inputs, #workout .is-current [class*=inputs]"],
    log: ["#workout .is-current button", "^\\s*(registrar série|log set)\\s*$"],
    timer: ["#woRest"],
    note: ["#workout .is-current [data-exnote-open]"],
    actions: ["#workout .is-current [data-exactions-open]"],
    why: ["#workout .is-current [data-why]"] } },
  rest: { run: async (page) => {
      await page.locator("#workout .is-current button", { hasText: /^\s*(Registrar série|Log set)\s*$/ }).first().click();
      await page.waitForFunction(() => document.querySelector("#woRest")?.classList.contains("is-running"), undefined, { timeout: 20000 });
      await page.click("#woRest");
      await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
      await page.waitForTimeout(500);
    }, spots: { sheet: ["#restSheet"] } },
  actions: { run: async (page) => {
      await page.locator("#workout .is-current [data-exactions-open]").click();
      await page.waitForTimeout(700);
      await page.evaluate(() => { const b = document.querySelector(".exactions-sheet__body"); if (b) b.scrollTop = 0; });
      await page.waitForTimeout(200);
    }, spots: { swap: ["#exActionsSheet button", "(substituir exercício|replace exercise|substitute|swap)"] } },
  note: { run: async (page, lang) => {
      await page.locator("#workout [data-exnote-open]").first().click();
      await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
      await page.fill("#exNoteText", NOTE[lang]);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(400);
    }, spots: { text: ["#exNoteText"] } },
  why: { run: async (page) => {
      await page.click("#workout .is-current [data-why]");
      await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
      await page.waitForTimeout(500);
    }, spots: { sheet: ["#whySheet"] } },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const shots = {};
for (const lang of ["pt", "en"]) for (const theme of ["light", "dark"]) for (const [name, s] of Object.entries(SCENES)) {
  const { ctx, page } = await open(browser, lang, theme);
  try {
    await s.run(page, lang);
    const png = await page.screenshot({ type: "png" });
    const spots = {};
    for (const [k, [sel, re]] of Object.entries(s.spots)) spots[k] = await page.evaluate(`(${box.toString()})(${JSON.stringify(sel)}, ${JSON.stringify(re || null)})`);
    // Encode WebP in the page's own Chromium; no image tool is needed.
    const webp = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/webp", 0.86).split(",")[1];
    }, png.toString("base64"));
    await writeFile(join(OUT, "wt-" + name + "-" + lang + "-" + theme + ".webp"), Buffer.from(webp, "base64"));
    if (theme === "light") shots[name] = shots[name] || {}, shots[name][lang] = spots;
    console.log("ok " + name + " " + lang + " " + theme + " " + JSON.stringify(spots));
  } catch (e) {
    await page.screenshot({ path: join(OUT, "FAILED-" + name + "-" + lang + "-" + theme + ".png") }).catch(() => {});
    console.log("FAIL " + name + " " + lang + " " + theme + ": " + e.message.split("\n")[0]);
  }
  await ctx.close();
}
await browser.close();
const html = await readFile(PAGE, "utf8").catch(() => null);
const line = "var SHOTS = " + JSON.stringify({ size: [W * DPR, H * DPR], spots: shots }) + ";";
if (html && /\/\*@SHOTS\*\/[\s\S]*?\/\*@end\*\//.test(html)) {
  await writeFile(PAGE, html.replace(/\/\*@SHOTS\*\/[\s\S]*?\/\*@end\*\//, "/*@SHOTS*/" + line + "/*@end*/"));
  console.log("updated SHOTS in index.html");
} else console.log(line);
