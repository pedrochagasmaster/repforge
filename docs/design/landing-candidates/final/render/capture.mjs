// Captures the final page's walkthrough screens from the real app: one bench
// session (round 3's "add" case: 60 kg x 10, 10, 10 at RIR 2, target 8-10),
// the shipped UI at 390x844 CSS px and 2x, a fixed clock, a saved state.
// Nothing is redrawn. Each screen is written as WebP (encoded by Chromium)
// with the hotspots the walkthrough zooms to, measured from the app's own
// elements, into ../index.html's /*@SHOTS*/ block.
//
//   python3 -m http.server 8000 &
//   (cd test && REPFORGE_URL=http://localhost:8000/ node ../docs/design/landing-candidates/final/render/capture.mjs)
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

// A hotspot is the exact box the lens reads, as % of the screen: [cx, cy, w, h].
// Each one is measured from the app's own elements, never estimated.
const MEASURE = `(${(() => {
  const pct = (l, t, r, b) => [l + (r - l) / 2, t + (b - t) / 2, r - l, b - t].map((v, i) => +(100 * v / (i % 2 ? innerHeight : innerWidth)).toFixed(2));
  const rect = (e) => e && e.getBoundingClientRect();
  const vis = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && rect(e).width);
  const of = (e) => { const r = rect(e); return r ? pct(r.left, r.top, r.right, r.bottom) : null; };
  // the first line of a textarea: its full text column, one line tall
  const firstLine = (ta) => {
    const cs = getComputedStyle(ta), r = rect(ta);
    const l = r.left + ta.clientLeft, t = r.top + ta.clientTop + parseFloat(cs.paddingTop), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return pct(l, t, l + ta.clientWidth, t + lh);
  };
  return {
    focus: () => {
      const card = vis("#workout .is-current"), cue = card.querySelector(".focus-cue.is-now");
      const head = card.querySelectorAll(".ledger__head > span"), row = card.querySelector(".ledger__row");
      const cells = [...row.children], a = rect(head[1]), b = rect(cells[cells.length - 1]);
      return { cue: of(cue), log: of([...card.querySelectorAll("button")].find((x) => /^\s*(registrar série|log set)\s*$/i.test(x.textContent))),
        last: pct(a.left, a.top, b.right, rect(row).bottom) };
    },
    rest: () => ({ dial: of(vis("#restSheet .restdial")) }),
    actions: () => ({ swap: of(vis("#exActionSubstBtn")) }),
    note: () => ({ text: firstLine(vis("#exNoteText")) }),
  };
}).toString()})()`;

const SCENES = {
  focus: { run: async () => {}, spots: "focus" },
  rest: { run: async (page) => {
      await page.locator("#workout .is-current button", { hasText: /^\s*(Registrar série|Log set)\s*$/ }).first().click();
      await page.waitForFunction(() => document.querySelector("#woRest")?.classList.contains("is-running"), undefined, { timeout: 20000 });
      await page.click("#woRest");
      await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
      await page.waitForTimeout(500);
    }, spots: "rest" },
  actions: { run: async (page) => {
      await page.locator("#workout .is-current [data-exactions-open]").click();
      await page.waitForTimeout(700);
      await page.evaluate(() => { const b = document.querySelector(".exactions-sheet__body"); if (b) b.scrollTop = 0; });
      await page.waitForTimeout(200);
    }, spots: "actions" },
  note: { run: async (page, lang) => {
      await page.locator("#workout [data-exnote-open]").first().click();
      await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
      await page.fill("#exNoteText", NOTE[lang]);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(400);
    }, spots: "note" },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const shots = {};
for (const lang of ["pt", "en"]) for (const theme of ["light", "dark"]) for (const [name, s] of Object.entries(SCENES)) {
  const { ctx, page } = await open(browser, lang, theme);
  try {
    await s.run(page, lang);
    const png = await page.screenshot({ type: "png" });
    const spots = await page.evaluate(`${MEASURE}[${JSON.stringify(s.spots)}]()`);
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
