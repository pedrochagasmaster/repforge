#!/usr/bin/env node
/**
 * Self-test for tools/audit-page.js: loads a real checkpoint of a Round 2
 * candidate (default: the _example placeholder), injects one known defect
 * per check, and shows that the check reports it, then that the clean page
 * does not. Proves the generic Round 2 checks fire for the right reason.
 *
 * Usage: node tools/audit-selftest.mjs [--base URL] [--candidate _example]
 */
import { chromium } from "../../../../test/node_modules/playwright/index.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const argv = process.argv.slice(2); const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const BASE = arg("base", "http://127.0.0.1:8123/docs/design/onboarding-tournament/");
const CAND = arg("candidate", "_example");
const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.TOURNAMENT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const CASES = [
  { check: "K-10", cp: "build-empty", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p>day_empty:manual_d1</p>')` },
  { check: "K-10", cp: "rec-result", inject: `document.querySelector("[data-activate]").setAttribute("aria-label", "preview_not_ready")` },
  { check: "K-11", cp: "rec-result", inject: `document.body.insertAdjacentHTML("beforeend", '<div style="position:fixed;bottom:0;left:0;right:0"><button>Extra</button></div>')` },
  { check: "K-11", cp: "rec-result", inject: `document.querySelector("footer.pinned").style.height = "320px"` },
  { check: "K-12", cp: "rec-result", inject: `document.querySelector("main").insertAdjacentHTML("afterbegin", '<div style="width:90px"><button class="btn" style="overflow-wrap:anywhere">Desenvolvimento</button></div>')` },
  { check: "K-12", cp: "rec-result", inject: `document.querySelector("main").insertAdjacentHTML("afterbegin", '<div style="display:flex;width:90px"><button class="btn">Desenvolvimento</button></div>')` },
  { check: "K-13", cp: "rec-schedule", inject: `for (const el of document.querySelectorAll('[data-key="sessionMinutes"] .choice__title')) { el.style.whiteSpace = "normal"; el.style.width = "8px"; el.style.overflowWrap = "anywhere"; }` },
  { check: "K-15", cp: "landing", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p>Seu treino fica neste aparelho.</p>')` },
  { check: "K-15", cp: "landing", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<button class="btn">Close</button>')` },
  { check: "K-15", cp: "landing", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p>Porquê evitar?</p>')` },
  { check: "K-16", cp: "route-choice", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p>A maioria começa por aqui</p>')` },
  { check: "K-16", cp: "route-choice", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p>5 seções curtas · cerca de 2 minutos</p>')` },
  { check: "K-21", cp: "landing", motion: "reduced", inject: `const s = document.createElement("style"); s.textContent = "#firstRunCreate{transition:opacity .3s linear!important;transition-duration:.3s!important}"; document.head.appendChild(s)` },
  { check: "K-23", cp: "landing", inject: `document.querySelector("[data-privacy-open]").remove()` },
  { check: "K-23", cp: "landing", inject: `document.querySelector("[data-landing-proof]").remove()` },
  { check: "clipped", cp: "landing", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<p style="width:40px;overflow:hidden;white-space:nowrap">personalizados</p>')` },
  { check: "clipped", cp: "landing", expectNone: true, note: "H-14: the same clipped text inside .visually-hidden is ignored", inject: `document.querySelector("main").insertAdjacentHTML("beforeend", '<span class="visually-hidden"><span style="width:40px;overflow:hidden;white-space:nowrap;display:block">personalizados</span></span>')` },
];
let failures = 0;
for (const c of CASES) {
  const motion = c.motion || "normal";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: motion === "reduced" ? "reduce" : "no-preference", locale: "pt-BR" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}round-2/app.html?c=${CAND}&cp=${c.cp}&lang=pt&theme=light&text=100&motion=${motion}`);
  await page.waitForFunction(() => window.__tournamentReady === true);
  await page.addScriptTag({ path: join(here, "audit-page.js") });
  const opts = { checkpoint: c.cp, lang: "pt", vw: 390, text: "100", motion };
  const clean = await page.evaluate((o) => window.__audit.run(o), opts);
  await page.evaluate((src) => (0, eval)(src), c.inject); await page.waitForTimeout(400);
  const dirty = await page.evaluate((o) => window.__audit.run(o), opts);
  const match = (list) => list.filter((p) => (c.check === "clipped" ? p.startsWith("clipped") : p.startsWith(c.check)));
  const before = [...match(clean.hard), ...match(clean.warn)], after = [...match(dirty.hard), ...match(dirty.warn)];
  const ok = c.expectNone ? after.length === 0 : before.length === 0 && after.length > 0;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.check} @${c.cp}${c.note ? " (" + c.note + ")" : ""}: clean ${before.length}, injected ${after.length}${after.length ? " → " + after[0].slice(0, 170) : ""}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} self-test case(s) failed` : "all self-test cases behaved as expected");
process.exit(failures ? 1 : 0);
