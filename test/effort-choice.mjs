/** Activation-boundary effort choice, composed into the effort-stage browser owner. */
import assert from "node:assert/strict";
import { openCatalogState } from "./fixtures/catalog-state.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
export async function verifyEffortChoice(browser) {
  let passed = 0;
  const check = (condition, message) => { assert.ok(condition, message); passed++; console.log(`  ✓ ${message}`); };
  const boot = async page => {
    await page.goto(BASE);
    await page.waitForFunction(() => window.__repforgeBooted === true);
  };
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1")));
  const fresh = await browser.newContext();
  try {
    const page = await fresh.newPage();
    await boot(page);
    check((await stored(page)).settings.rirMode === "effort", "a new device defaults to words");
  } finally { await fresh.close(); }

  // Old backups and legacy installed snapshots need not contain today's normalized setting.
  for (const mode of ["numeric", "effort", null]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await boot(page);
      await page.evaluate(async ({ program, programMeta, mode }) => {
        const raw = JSON.parse(localStorage.getItem("repforge_v1"));
        raw.program = program; raw.programMeta = programMeta;
        if (mode) raw.settings.rirMode = mode; else delete raw.settings.rirMode;
        localStorage.setItem("repforge_v1", JSON.stringify(raw));
        await new Promise((resolve, reject) => {
          const req = indexedDB.open("repforge", 1);
          req.onsuccess = () => { const tx = req.result.transaction("kv", "readwrite");
            tx.objectStore("kv").put(raw, "repforge_v1");
            tx.oncomplete = () => { req.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
          req.onerror = () => reject(req.error);
        });
      }, { program: seedProgram(), programMeta: seedProgramMeta(), mode });
      await boot(page);
      check((await stored(page)).settings.rirMode === (mode || "numeric"), `existing ${mode || "missing legacy"} mode survives boot`);
      await boot(page);
      check((await stored(page)).settings.rirMode === (mode || "numeric"), `existing ${mode || "missing legacy"} mode survives reload`);
    } finally { await context.close(); }
  }

  for (const route of ["build", "shared"]) {
    const key = route === "build" ? "onboarding-build/editor-ready" : "onboarding-shared/preview";
    const { context, page } = await openCatalogState(browser, key, 390, "pt", "normal");
    try {
      const activate = route === "build" ? "#entryEditorActivate" : "#entryActivate";
      const before = await stored(page);
      await page.click(activate);
      await page.waitForSelector("#effortChoiceSheet.is-open");
      check(await page.locator(`#effortChoiceSheet [data-effort-choice='${route === "shared" ? "numeric" : "effort"}']`).getAttribute("aria-checked") === "true",
        `${route} preselects ${route === "shared" ? "the shared stage" : "words"}`);
      check(JSON.stringify(await stored(page)) === JSON.stringify(before), "opening the question persists no proposal field");
      await page.keyboard.press("Escape");
      await page.waitForSelector("#effortChoiceSheet", { state: "hidden" });
      check(!await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_ui_v1"))?.effortChosen), "cancelling does not acknowledge a choice");
      await page.click(activate);
      await page.waitForSelector("#effortChoiceSheet.is-open");
      const selected = route === "build" ? "numeric" : "effort";
      await page.click(`[data-effort-choice='${selected}']`);
      await page.click("#effortChoiceContinue");
      await page.waitForFunction(mode => {
        const s = JSON.parse(localStorage.getItem("repforge_v1"));
        return s?.programMeta?.onboarded && s.settings.rirMode === mode;
      }, selected);
      check((await stored(page)).settings.rirMode === selected, `${route} commits the chosen mode with activation`);
      check(await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_ui_v1"))?.effortChosen === true), "successful activation acknowledges the device choice");
      await boot(page);
      check((await stored(page)).settings.rirMode === selected, "the chosen stage survives reload");
    } finally { await context.close(); }
  }

  // The same activation UI must skip the question for a previously chosen device or a lifter with history.
  for (const skip of ["chosen", "log"]) {
    const { context, page } = await openCatalogState(browser, "onboarding-build/editor-ready", 390, "en", "normal");
    try {
      if (skip === "chosen") await page.evaluate(() => window.__repforgeUi.setPref("effortChosen", true));
      else {
        // Use the shipped commit path to add a prior session, then resume the setup draft on reload.
        await page.evaluate(async () => {
          const raw = JSON.parse(localStorage.getItem("repforge_v1"));
          raw.log = [{ session: "prior", date: "2026-11-01", day: "Day 1", name: "Curl", exerciseId: "prior",
            set: 1, load: 20, reps: 8, rir: 2, created: "2026-11-01T10:00:00.000Z", notes: "", primary: "Biceps", secondary: "" }];
          await window.__repforgeCommitProposedState(raw);
        });
      }
      await page.click("#entryEditorActivate");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1"))?.programMeta?.onboarded === true);
      check(!await page.locator("#effortChoiceSheet").isVisible(), `activation skips the question with ${skip}`);
    } finally { await context.close(); }
  }
  return passed;
}
