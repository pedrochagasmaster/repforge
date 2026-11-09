/** Activation-boundary effort choice, composed into the program-entry browser owner. */
import assert from "node:assert/strict";
import { openCatalogState } from "./fixtures/catalog-state.mjs";
import { collectProgramEntrySemantics } from "../tools/ui-screens/semantics.mjs";
import { emptyEntryState } from "../tools/ui-screens/fixtures.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
export async function verifyEffortChoice(browser) {
  let passed = 0;
  const failures = [];
  const check = (condition, message) => {
    if (condition) { passed++; console.log(`  ✓ ${message}`); }
    else { failures.push(message); console.error(`  ✗ ${message}`); }
  };
  const boot = async page => {
    await page.goto(BASE);
    await page.waitForFunction(() => window.__repforgeBooted === true);
  };
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1")));
  const fresh = await browser.newContext({ effortChoice: "live" });
  try {
    const page = await fresh.newPage();
    await boot(page);
    check((await stored(page)).settings.rirMode === "effort", "a new device defaults to words");
  } finally { await fresh.close(); }

  // Old backups and legacy installed snapshots need not contain today's normalized setting.
  for (const { mode, installed } of [{ mode: "numeric", installed: true }, { mode: "effort", installed: true },
    { mode: null, installed: true }, { mode: "unexpected", installed: true }, { mode: null, installed: false }]) {
    const expected = mode === "effort" ? "effort" : mode === "numeric" || installed ? "numeric" : "effort";
    const context = await browser.newContext({ effortChoice: "live" });
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
      }, { program: installed ? seedProgram() : [], programMeta: installed ? seedProgramMeta() : {}, mode });
      await boot(page);
      check((await stored(page)).settings.rirMode === expected, `${installed ? "existing" : "fresh"} ${mode || "missing"} mode survives boot`);
      await boot(page);
      check((await stored(page)).settings.rirMode === expected, `${installed ? "existing" : "fresh"} ${mode || "missing"} mode survives reload`);
    } finally { await context.close(); }
  }

  for (const route of ["build", "shared"]) {
    const key = route === "build" ? "onboarding-build/editor-ready" : "onboarding-shared/preview";
    const snapshot = emptyEntryState("pt");
    snapshot.settings.rirMode = "effort";
    const { context, page } = await openCatalogState(browser, key, 390, "pt", "normal", { effortChoice: "live", snapshot });
    try {
      const activate = route === "build" ? "#entryEditorActivate" : "#entryActivate";
      const before = await stored(page);
      await page.click(activate);
      await page.waitForSelector("#effortChoiceSheet.is-open");
      check(await page.locator(`#effortChoiceSheet [data-effort-choice='${route === "shared" ? "numeric" : "effort"}']`).getAttribute("aria-checked") === "true",
        `${route} preselects ${route === "shared" ? "the shared stage" : "words"}`);
      check(await page.evaluate(() => Number(getComputedStyle(document.querySelector("#effortChoiceSheet")).zIndex) >
        Number(getComputedStyle(document.querySelector("#onboarding")).zIndex)), "the effort question paints above onboarding");
      const semantics = await page.evaluate(collectProgramEntrySemantics);
      check(semantics[0]?.role === "dialog" && semantics.some(record => record.tag === "h2" && record.text === semantics[0].labelledBy),
        "catalog semantics describe the activation question rather than the underlying editor");
      check(JSON.stringify(await stored(page)) === JSON.stringify(before), "opening the question persists no proposal field");
      const duplicate = await page.evaluate(() => window.__repforgeActivateEntryPreview());
      check(duplicate?.cancelled === true && await page.locator("#effortChoiceSheet").isVisible(), "a repeated activation keeps one unanswered question");
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
    const snapshot = emptyEntryState("en");
    if (skip === "log") snapshot.log = [{ session: "prior", date: "2026-11-01", day: "Day 1", name: "Curl", exerciseId: "prior",
      set: 1, load: 20, reps: 8, rir: 2, created: "2026-11-01T10:00:00.000Z", notes: "", primary: "Biceps", secondary: "" }];
    const { context, page } = await openCatalogState(browser, "onboarding-build/editor-ready", 390, "en", "normal", { effortChoice: "live", snapshot });
    try {
      if (skip === "chosen") await page.evaluate(() => window.__repforgeUi.setPref("effortChosen", true));
      await page.click("#entryEditorActivate");
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1"))?.programMeta?.onboarded === true);
      check(!await page.locator("#effortChoiceSheet").isVisible(), `activation skips the question with ${skip}`);
      check((await stored(page)).settings.rirMode === snapshot.settings.rirMode, "skipping preserves the existing effort stage");
    } finally { await context.close(); }
  }
  {
    const snapshot = emptyEntryState("en");
    snapshot.settings.rirMode = "effort";
    const { context, page } = await openCatalogState(browser, "onboarding-build/editor-ready", 390, "en", "normal", { effortChoice: "live", snapshot });
    try {
      await page.evaluate(() => { window.__effortActivation = window.__repforgeActivateEntryPreview(); });
      await page.waitForSelector("#effortChoiceSheet.is-open");
      await page.evaluate(async () => {
        const proposal = window.__repforgeWorkoutDraft.state();
        proposal.settings.restSec = 180;
        await window.__repforgeCommitProposedState(proposal);
      });
      check((await stored(page)).settings.restSec === 180, "the newer setting is durably committed while the question waits");
      await page.click("#effortChoiceContinue");
      const result = await page.evaluate(() => window.__effortActivation);
      const after = await stored(page);
      check((result?.staleRevision || result?.conflict || result?.cancelled) && after.program.length === 0 && after.settings.restSec === 180,
        "a state change while the question is open refuses the stale activation and preserves the newer setting");
      check(!await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_ui_v1"))?.effortChosen),
        "a refused activation does not acknowledge the device choice");
    } finally { await context.close(); }
  }
  assert.equal(failures.length, 0, failures.join("; "));
  return passed;
}
