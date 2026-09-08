#!/usr/bin/env node
/**
 * Free-form program import: the paste door of the import route.
 *
 * A lifter who already has a program usually has it as a coach's message or a
 * note, not as a Taurifer file. That program is converted by the assistant
 * they already have on their phone: Taurifer writes the prompt around what was
 * pasted, the lifter taps ChatGPT or Claude, and the reply comes back through
 * the same review a file goes through.
 *
 * What this pins down is the part that can go quietly wrong:
 *   - nothing leaves the device by itself — the links are inert until the
 *     lifter has pasted something, and the pasted text is never persisted;
 *   - the link carries the prompt Taurifer wrote, in the reader's language;
 *   - a chat reply is prose around the answer as often as it is the answer,
 *     and the fenced block inside it still has to import;
 *   - a reply that is not a program is refused with an explanation rather
 *     than half-imported;
 *   - the reviewed rows are the ordinary import review, so activation stays
 *     the same explicit step it is for a file.
 *
 * Run: node test/program-freeform-import.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const UI_KEY = "repforge_ui_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}

const PASTED = [
  "Push A",
  "Bench press 4x6-8",
  "Overhead press 3x8-10",
  "",
  "Pull A",
  "Barbell row 4x6-10",
].join("\n");

/* What an assistant actually sends back: a sentence, a fenced block, and an
   offer to keep going. Only the middle of it is the program. */
const REPLY = [
  "Sure! Here is your program in the requested format:",
  "",
  "```json",
  '{"version":3,"meta":{"name":"Coach split"},"exercises":[',
  ' {"day":"Push A","order":1,"name":"Barbell bench press","sets":4,"min":6,"max":8},',
  ' {"day":"Push A","order":2,"name":"Overhead press","sets":3,"min":8,"max":10},',
  ' {"day":"Pull A","order":1,"name":"Barbell row","sets":4,"min":6,"max":10}]}',
  "```",
  "",
  "Let me know if you want a fourth day!",
].join("\n");

async function reset(page) {
  await page.evaluate(async ({ k, d, setup, ui }) => {
    try { window.closeOnboarding?.(); } catch {}
    try { window.closeFirstRun?.(); } catch {}
    try { await window.__repforgeStorage?.flush?.(); } catch {}
    try { await window.__repforgeOnboarding?.clearDraft?.(); } catch {}
    try { await window.__repforgeStorage?.flush?.(); } catch {}
    for (const key of [k, d, setup, ui]) localStorage.removeItem(key);
    localStorage.clear();
    sessionStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT, setup: SETUP_DRAFT, ui: UI_KEY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);
  await page.evaluate(({ setup }) => {
    try { localStorage.removeItem(setup); } catch {}
  }, { setup: SETUP_DRAFT });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 20000 });
}

/** First run → hub → "Use my own program" → the paste door. */
async function openFreeform(page) {
  await page.waitForSelector("#firstRunCreate", { timeout: 20000 });
  await page.click("#firstRunCreate");
  const restartBtn = page.locator("#entryResumeRestart");
  if (await restartBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await restartBtn.click();
  }
  await page.waitForSelector("#entryOwnToggle", { timeout: 20000 });
  await page.click("#entryOwnToggle");
  const doors = await page.evaluate(() => ({
    freeform: document.querySelectorAll("#entryFreeformStart").length,
    file: document.querySelectorAll('[data-entry-route="import"]').length,
  }));
  await page.click("#entryFreeformStart");
  await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
  return doors;
}

const settle = (page, ms = 350) => page.waitForTimeout(ms);

const linkState = (page) => page.evaluate(() => {
  const link = (app) => document.querySelector(`[data-freeform-app="${app}"]`);
  return {
    chatgpt: link("chatgpt")?.href || "",
    claude: link("claude")?.href || "",
    disabled: ["chatgpt", "claude"].map((app) => link(app)?.getAttribute("aria-disabled")),
    target: link("claude")?.target,
    rel: link("claude")?.rel || "",
    needsHidden: document.querySelector("#entryFreeformNeeds")?.hidden,
    copyDisabled: document.querySelector("#entryFreeformCopy")?.disabled,
    counter: document.querySelector("#entryFreeformCount")?.textContent || "",
  };
});

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page);
    await reset(page);

    console.log("\nThe paste door");
    const doors = await openFreeform(page);
    assert(doors.freeform === 1 && doors.file === 1,
      "the two import doors are two cards on one route", JSON.stringify(doors));

    const empty = await page.evaluate(() => ({
      needsHidden: document.querySelector("#entryFreeformNeeds")?.hidden,
      continueDisabled: document.querySelector("#entryFreeformContinue")?.disabled,
      counter: document.querySelector("#entryFreeformCount")?.textContent || "",
    }));
    assert(empty.continueDisabled === true && !empty.needsHidden,
      "with nothing pasted, continue is disabled and needs-input hint is visible",
      JSON.stringify(empty));

    await page.fill("#entryFreeformIn", PASTED);
    const filled = await page.evaluate(() => ({
      needsHidden: document.querySelector("#entryFreeformNeeds")?.hidden,
      continueDisabled: document.querySelector("#entryFreeformContinue")?.disabled,
      counter: document.querySelector("#entryFreeformCount")?.textContent || "",
    }));
    assert(filled.needsHidden === true && filled.continueDisabled === false,
      "pasting something enables continue and hides needs-input hint", JSON.stringify(filled));

    // Typing is the whole interaction on this screen: it must not cost the
    // caret, which a full re-render of the step would.
    await page.focus("#entryFreeformIn");
    await page.keyboard.type("!");
    const focused = await page.evaluate(() => ({
      id: document.activeElement?.id,
      counter: document.querySelector("#entryFreeformCount")?.textContent || "",
    }));
    assert(focused.id === "entryFreeformIn", "typing keeps the field and the caret", JSON.stringify(focused));
    assert(/\d/.test(focused.counter), "the character counter follows the field", focused.counter);

    // Advance to Stage 2: Open it in ChatGPT or Claude
    await page.click("#entryFreeformContinue");
    await page.waitForSelector(".entry__freeform-summary", { timeout: 20000 });
    const stage2 = await linkState(page);
    assert(stage2.chatgpt.startsWith("https://chatgpt.com/?q=")
      && stage2.claude.startsWith("https://claude.ai/new?q="),
      "each app is a prefilled link to its own composer",
      JSON.stringify({ chatgpt: stage2.chatgpt.slice(0, 40), claude: stage2.claude.slice(0, 40) }));
    const sent = decodeURIComponent(stage2.chatgpt.split("?q=")[1] || "");
    assert(sent.includes("Bench press 4x6-8") && sent.includes('"sets"') && sent.includes('"min"'),
      "the link carries the pasted program and the format Taurifer reads",
      sent.slice(0, 120));
    assert(stage2.target === "_blank" && /noopener/.test(stage2.rel),
      "the links leave the app deliberately and without an opener",
      JSON.stringify({ target: stage2.target, rel: stage2.rel }));

    console.log("\nNothing is sent or kept by itself");
    const stored = await page.evaluate(({ k, setup, ui }) => ({
      state: localStorage.getItem(k) || "",
      draft: localStorage.getItem(setup) || "",
      ui: localStorage.getItem(ui) || "",
      session: sessionStorage.getItem("repforge_freeform_session_v1"),
    }), { k: KEY, setup: SETUP_DRAFT, ui: UI_KEY });
    assert(![stored.state, stored.draft].some((value) => value.includes("Overhead press")),
      "the pasted program is never written to persistent storage",
      JSON.stringify({ state: stored.state.length, draft: stored.draft.length }));
    assert(JSON.parse(stored.ui || "{}").importSourceMode === "freeform",
      "only which door was used is remembered, as a device UI pref", stored.ui);
    assert(stored.session && JSON.parse(stored.session).stage === 2,
      "tab-scoped session storage tracks active stage during the flow");

    console.log("\nThe reply comes back through the import review");
    // Advance to Stage 3: Paste the assistant's reply
    await page.click("#entryFreeformCopy");
    await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
    assert(await page.locator("#entryFreeformOut").isVisible(), "copying advances to stage 3");
    await page.fill("#entryFreeformOut", REPLY);
    await page.click("#entryFreeformReview");
    await page.waitForSelector("#importReview.active", { timeout: 20000 });
    const review = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-imp-row]").length,
      text: document.querySelector("#importReview")?.innerText || "",
    }));
    assert(review.rows === 3, "prose around a fenced block still imports every exercise", String(review.rows));
    assert(review.text.includes("Barbell bench press") && review.text.includes("Barbell row"),
      "the review shows the names the reply used, not the library's");

    // The row leads with its shortlist and keeps the escape hatches behind a
    // disclosure, so resolving one means taking a candidate or opening that.
    while (await page.locator("#importCommit").isDisabled()) {
      const pick = page.locator('[data-imp-act="pick"]').first();
      if (await pick.count()) { await pick.click(); continue; }
      const more = page.locator(".improw.is-open .improw__more summary").first();
      if (await more.count()) await more.click();
      const raw = page.locator('[data-imp-act="raw"]').first();
      if (await raw.count()) await raw.click();
      else { await page.locator('[data-imp-act="link"]').first().click(); }
    }
    await page.click("#importCommit");
    await page.waitForSelector("#onboarding.active #entryActivate", { timeout: 20000 });
    const staged = await page.evaluate(({ k }) => ({
      preview: document.querySelector("#onbBody")?.innerText || "",
      program: (JSON.parse(localStorage.getItem(k) || "{}").program || []).length,
    }), { k: KEY });
    assert(staged.preview.includes("Coach split"), "the name in the reply reaches the preview");
    assert(staged.program === 0,
      "a converted program is a candidate: nothing is active until it is activated",
      String(staged.program));
    const sessionCleared = await page.evaluate(() => sessionStorage.getItem("repforge_freeform_session_v1"));
    assert(sessionCleared === null, "session storage is cleared on transition to review");

    console.log("\nA reply that is not a program");
    await page.click("#onbBack");
    await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
    assert(await page.locator("#entryFreeformIn").isVisible(),
      "Back from the preview returns to the door the import came through");
    await page.fill("#entryFreeformIn", PASTED);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector("#entryFreeformCopy", { timeout: 20000 });
    await page.click("#entryFreeformCopy");
    await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
    await page.fill("#entryFreeformOut", "I can't help with that, but here are some general tips!");
    await page.click("#entryFreeformReview");
    await page.waitForTimeout(400);
    const refused = await page.evaluate(() => ({
      toast: document.querySelector("#toast")?.textContent || "",
      reviewing: !!document.querySelector("#importReview.active"),
      hasNotice: !!document.querySelector(".entry__notice--warn"),
    }));
    assert(!refused.reviewing && /program/i.test(refused.toast),
      "an unusable reply is refused with an explanation, not half-imported",
      JSON.stringify(refused));
    assert(refused.hasNotice, "unreadable reply renders warning notice with repair and try another actions");

    // Test Try another assistant returns to Stage 2
    await page.click("#entryFreeformTryAnother");
    await page.waitForSelector(".entry__freeform-apps", { timeout: 20000 });
    assert(await page.locator(".entry__freeform-apps").isVisible(), "Try another assistant returns to stage 2");

    // Test Edit source returns to Stage 1
    await page.click("#entryFreeformEditSource");
    await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
    assert(await page.locator("#entryFreeformIn").isVisible(), "Edit source returns to stage 1");

    console.log("\nThe doors stay each other's neighbour");
    await page.click("#entryFreeformFile");
    await page.waitForSelector("#entryImportPick", { timeout: 20000 });
    assert(await page.locator("#entryImportPick").isVisible(), "the file door is one tap from the paste door");
    await page.click("#entryFreeformSwitch");
    await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
    assert(await page.locator("#entryFreeformIn").isVisible(), "and the paste door is one tap back");

    await reset(page);
    await page.waitForSelector("#firstRunCreate", { timeout: 20000 });
    await page.click("#firstRunCreate");
    const restartBtn = page.locator("#entryResumeRestart");
    if (await restartBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await restartBtn.click();
    }
    await page.waitForSelector("#entryOwnToggle", { timeout: 20000 });
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="import"]');
    await page.waitForSelector("#entryImportPick", { timeout: 20000 });
    assert(await page.locator("#entryImportPick").isVisible(),
      "the Import card opens the file door its caption describes");
    await page.evaluate(async () => {
      try { await window.__repforgeStorage?.flush?.(); } catch {}
    });

    console.log("\nFirst-run gate enters copy and paste as the primary BYOP door without opening file picker");
    await reset(page);
    await page.waitForSelector("#firstRunImport", { timeout: 20000 });
    await page.evaluate(() => {
      window.__filePickerClicked = false;
      document.querySelector("#importProgram")?.addEventListener("click", () => {
        window.__filePickerClicked = true;
      });
    });
    await page.click("#firstRunImport");
    await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
    assert(await page.locator("#entryFreeformIn").isVisible(),
      "first-run Import lands on the copy-and-paste door");
    const filePickerClicked = await page.evaluate(() => window.__filePickerClicked);
    assert(!filePickerClicked,
      "first-run Import does not automatically open the system file picker");
    assert(await page.locator("#entryFreeformFile").isVisible(),
      "file import is available via switch button");
    await page.evaluate(async () => {
      try { await window.__repforgeStorage?.flush?.(); } catch {}
    });

    console.log("\nLong-prompt path: two-tap form with clipboard confirmation");
    await reset(page);
    await openFreeform(page);
    const LONG_PROGRAM = "Day 1\n" + Array.from({length: 60}, (_, i) => `Exercise ${i + 1} with a descriptive name and long notes about technique 3x10-12`).join("\n");
    await page.fill("#entryFreeformIn", LONG_PROGRAM);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector('[data-freeform-app="chatgpt"]', { timeout: 20000 });

    const longState = await page.evaluate(() => {
      const btn = document.querySelector('[data-freeform-app="chatgpt"]');
      return {
        tagName: btn?.tagName,
        isLong: btn?.dataset.freeformLong === "true",
        href: btn?.getAttribute("href"),
        text: btn?.textContent || "",
      };
    });
    assert(longState.tagName === "BUTTON" && longState.isLong && !longState.href,
      "long prompt renders as a copy button rather than a direct anchor", JSON.stringify(longState));

    // Branch 1: Copy failure -> stays in Taurifer, nothing navigates
    await page.evaluate(() => {
      window.__originalClipboard = navigator.clipboard.writeText;
      navigator.clipboard.writeText = () => Promise.reject(new Error("clipboard denied"));
      document.execCommand = () => false;
    });
    await page.click('[data-freeform-app="chatgpt"]');
    const failedState = await page.evaluate(() => {
      const btn = document.querySelector('[data-freeform-app="chatgpt"]');
      return {
        tagName: btn?.tagName,
        href: btn?.getAttribute("href"),
      };
    });
    assert(failedState.tagName === "BUTTON" && !failedState.href,
      "when clipboard copy fails, nothing navigates and the button stays a button");

    // Branch 2: Copy success -> reveals anchor pointing to provider base URL
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.resolve();
    });
    await page.click('[data-freeform-app="chatgpt"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-freeform-app="chatgpt"]');
      return el && el.tagName === "A";
    });
    const copiedState = await page.evaluate(() => {
      const a = document.querySelector('[data-freeform-app="chatgpt"]');
      return {
        tagName: a?.tagName,
        isCopied: a?.dataset.freeformCopied === "true",
        href: a?.href || "",
        target: a?.target,
        text: a?.textContent || "",
      };
    });
    assert(copiedState.tagName === "A" && copiedState.isCopied && copiedState.href === "https://chatgpt.com/" && copiedState.target === "_blank",
      "when copy succeeds, button is replaced by direct anchor to assistant base URL", JSON.stringify(copiedState));
    assert(copiedState.text.includes("prompt copied") || copiedState.text.includes("copiado"),
      "revealed anchor indicates prompt is already copied on the clipboard", copiedState.text);

    // Return to Stage 1 and edit input to reset copied state
    await page.click("#entryFreeformEditSource");
    await page.waitForSelector("#entryFreeformIn", { timeout: 20000 });
    await page.focus("#entryFreeformIn");
    await page.keyboard.type(" ");
    await page.click("#entryFreeformContinue");
    await page.waitForSelector('[data-freeform-app="chatgpt"]', { timeout: 20000 });
    const invalidatedState = await page.evaluate(() => {
      const btn = document.querySelector('[data-freeform-app="chatgpt"]');
      return {
        tagName: btn?.tagName,
        isLong: btn?.dataset.freeformLong === "true",
      };
    });
    assert(invalidatedState.tagName === "BUTTON" && invalidatedState.isLong,
      "editing the prompt invalidates previous copy and restores the first tap button");

    console.log("\nThe prompt contract: strict transcription without contradiction");
    await reset(page);
    await page.evaluate(() => window.RepForgeI18n.setLang("en"));
    await openFreeform(page);
    await page.fill("#entryFreeformIn", PASTED);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector('[data-freeform-app="claude"]', { timeout: 20000 });
    const enPrompt = await page.evaluate(() =>
      decodeURIComponent((document.querySelector('[data-freeform-app="claude"]')?.href || "").split("?q=")[1] || "")
    );
    assert(!/closest sensible/i.test(enPrompt),
      "prompt does not instruct the assistant to choose closest sensible numbers");
    assert(!/choose the closest/i.test(enPrompt),
      "prompt does not license invention of missing numbers");
    assert(/Preserve exercise selection/i.test(enPrompt),
      "prompt requires strict preservation of exercise names, order and days");
    assert(/missing/i.test(enPrompt) && /notImported/i.test(enPrompt),
      "prompt specifies missing and notImported sidecars");

    console.log("\nThe reply envelope and gap reader (Pass 1 fast path and Pass 2 gap reader)");
    const step3Results = await page.evaluate(() => {
      const freeform = window.__repforgeFreeform;
      const parseSource = window.__repforgeParseProgramSource;

      // 1. Fast path: complete program with notImported
      const completeEnvelope = JSON.stringify({
        version: 3,
        meta: { name: "Upper Lower" },
        exercises: [
          { day: "Upper", order: 1, name: "Bench press", sets: 3, min: 8, max: 12 },
          { day: "Upper", order: 2, name: "Barbell row", sets: 3, min: 8, max: 12 },
        ],
        missing: [],
        notImported: ["rest_times", "tempo", "unrecognized_garbage"]
      });
      const parsedComplete = freeform.parseReply(completeEnvelope);

      // 2. Gap path: missing reps and missing sets with missing sidecar
      const gapEnvelope = JSON.stringify({
        version: 3,
        meta: { name: "Push Pull" },
        exercises: [
          { day: "Push", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
          { day: "Push", order: 2, name: "Cable flyes", sets: 3 }, // missing reps
          { day: "Pull", order: 1, name: "Lat pulldown", min: 10, max: 12 } // missing sets
        ],
        missing: [
          { day: "Push", order: 2, field: "reps" },
          { day: "Pull", order: 1, field: "sets" }
        ],
        notImported: ["rir_rpe", "supersets"]
      });
      const parsedGaps = freeform.parseReply(gapEnvelope);

      // 3. Assemble document from gaps
      const gapAnswers = {
        "1::reps": "12-15",
        "2::sets": "4"
      };
      const assembledDoc = freeform.assembleDocument(parsedGaps, gapAnswers);
      const reParsed = parseSource(assembledDoc);

      // 4. Invalid envelope: non-numeric requirement violated (empty exercise name)
      const invalidEnvelope = JSON.stringify({
        version: 3,
        meta: { name: "Broken" },
        exercises: [
          { day: "Push", order: 1, name: "", sets: 3, min: 10, max: 10 }
        ]
      });
      const parsedInvalid = freeform.parseReply(invalidEnvelope);

      // 5. Mixed explicit/omitted order where the numbered row is itself a gap.
      const collisionEnvelope = JSON.stringify({
        version: 3,
        meta: { name: "Collide" },
        exercises: [
          { day: "Push", order: 1, name: "Bench press", min: 6, max: 8 },
          { day: "Push", name: "Cable flyes", min: 10, max: 12 }
        ]
      });
      const parsedCollision = freeform.parseReply(collisionEnvelope);
      const collisionDoc = freeform.assembleDocument(parsedCollision,
        { "0::sets": "5", "1::sets": "2" });
      const collisionParsed = parseSource(collisionDoc);

      return {
        collision: {
          keys: parsedCollision?.gaps?.map(g => g.key),
          sets: collisionParsed?.exercises?.map(e => e.sets),
        },
        parsedComplete: {
          status: parsedComplete?.status,
          exercisesCount: parsedComplete?.exercises?.length,
          notImported: parsedComplete?.notImported,
        },
        parsedGaps: {
          status: parsedGaps?.status,
          gapsCount: parsedGaps?.gaps?.length,
          gaps: parsedGaps?.gaps?.map(g => ({ key: g.key, field: g.field, day: g.day, name: g.name })),
          notImported: parsedGaps?.notImported,
        },
        assembled: {
          hasDoc: !!assembledDoc,
          reParsedCount: reParsed?.exercises?.length,
          reParsedFormat: reParsed?.format,
          reParsedRows: reParsed?.exercises?.map(e => ({ name: e.name, sets: e.sets, min: e.min, max: e.max })),
        },
        parsedInvalid: {
          status: parsedInvalid?.status,
        }
      };
    });

    assert(step3Results.parsedComplete.status === "complete" && step3Results.parsedComplete.exercisesCount === 2,
      "fast path directly returns parsed complete program", JSON.stringify(step3Results.parsedComplete));
    assert(step3Results.parsedComplete.notImported.includes("rest_times") &&
           step3Results.parsedComplete.notImported.includes("tempo") &&
           !step3Results.parsedComplete.notImported.includes("unrecognized_garbage"),
      "fast path preserves valid notImported categories and drops unrecognized ones", JSON.stringify(step3Results.parsedComplete.notImported));

    assert(step3Results.parsedGaps.status === "gaps" && step3Results.parsedGaps.gapsCount === 2,
      "gap path returns gap status with paired gaps", JSON.stringify(step3Results.parsedGaps));
    assert(step3Results.parsedGaps.gaps[0].field === "reps" && step3Results.parsedGaps.gaps[0].name === "Cable flyes",
      "first gap pairs to Cable flyes missing reps");
    assert(step3Results.parsedGaps.gaps[1].field === "sets" && step3Results.parsedGaps.gaps[1].name === "Lat pulldown",
      "second gap pairs to Lat pulldown missing sets");
    assert(step3Results.parsedGaps.notImported.includes("rir_rpe") && step3Results.parsedGaps.notImported.includes("supersets"),
      "gap path preserves recognized notImported categories");

    assert(step3Results.assembled.hasDoc && step3Results.assembled.reParsedCount === 3 && step3Results.assembled.reParsedFormat === "json",
      "assembled document cleanly passes parseProgramSource", JSON.stringify(step3Results.assembled));
    assert(step3Results.assembled.reParsedRows[1].min === 12 && step3Results.assembled.reParsedRows[1].max === 15 &&
           step3Results.assembled.reParsedRows[2].sets === 4,
      "assembled document carries lifter filled numeric values into program rows");

    assert(new Set(step3Results.collision.keys).size === 2,
      "two gaps in one day never share a key when order is partly explicit",
      JSON.stringify(step3Results.collision.keys));
    assert(step3Results.collision.sets[0] === 5 && step3Results.collision.sets[1] === 2,
      "each gap answer lands on its own exercise", JSON.stringify(step3Results.collision.sets));

    assert(step3Results.parsedInvalid.status === "unreadable",
      "invalid non-numeric envelope yields unreadable status rather than gap result");

    console.log("\nGap resolution UI in the paste door");
    await reset(page);
    await openFreeform(page);
    await page.fill("#entryFreeformIn", PASTED);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector("#entryFreeformCopy", { timeout: 20000 });
    await page.click("#entryFreeformCopy");
    await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });

    const gapReply = JSON.stringify({
      version: 3,
      meta: { name: "Push Pull Split" },
      exercises: [
        { day: "Push", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
        { day: "Push", order: 2, name: "Cable flyes", sets: 3 },
        { day: "Pull", order: 1, name: "Lat pulldown", min: 10, max: 12 }
      ],
      missing: [
        { day: "Push", order: 2, field: "reps" },
        { day: "Pull", order: 1, field: "sets" }
      ],
      notImported: ["rest_times", "rir_rpe"]
    });

    await page.fill("#entryFreeformOut", gapReply);
    await page.click("#entryFreeformReview");

    await page.waitForSelector("#entryFreeformSubmitGaps", { timeout: 10000 });
    const gapState = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("[data-gap-key]")].map(i => i.dataset.gapKey);
      const notice = document.querySelector(".entry__notice--info")?.textContent || "";
      return { inputs, notice };
    });

    assert(gapState.inputs.length === 2, "gap UI renders inputs for each missing field", JSON.stringify(gapState.inputs));
    assert(gapState.inputs.includes("1::reps") && gapState.inputs.includes("2::sets"),
      "gap inputs are keyed by row position for missing reps and sets");
    assert(gapState.notice.includes("rest times") && gapState.notice.includes("RIR/RPE"),
      "gap screen displays non-blocking notImported disclosure", gapState.notice);

    // Submitting with empty inputs fails validation
    await page.click("#entryFreeformSubmitGaps");
    const hasInvalid = await page.evaluate(() => document.querySelectorAll(".is-invalid").length);
    assert(hasInvalid === 2, "empty gap inputs are marked invalid");

    // Filling valid inputs and submitting succeeds into Import Review
    await page.fill("[data-gap-key=\"1::reps\"]", "12-15");
    await page.fill("[data-gap-key=\"2::sets\"]", "4");
    await page.click("#entryFreeformSubmitGaps");

    await page.waitForSelector("#importReview.active", { timeout: 10000 });
    const reviewState = await page.evaluate(() => {
      const notImported = document.querySelector("#importNotImported")?.textContent || "";
      const originalText = document.querySelector("#importOriginalText pre")?.textContent || "";
      const rows = document.querySelectorAll("#importRows .improw").length;
      return { notImported, hasOriginal: originalText.length > 0, rows };
    });

    assert(reviewState.rows === 3, "import review contains all 3 exercises after gap resolution");
    assert(reviewState.notImported.includes("rest times"),
      "import review displays notImported disclosure");
    assert(reviewState.hasOriginal, "import review displays original pasted text disclosure");

    await page.click("#importReviewCancel");

    console.log("\nPortuguese reads the same screen");
    await reset(page);
    await page.evaluate(() => window.RepForgeI18n.setLang("pt"));
    await openFreeform(page);
    await page.fill("#entryFreeformIn", PASTED);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector('[data-freeform-app="claude"]', { timeout: 20000 });
    const portuguese = await page.evaluate(() => ({
      body: document.querySelector("#onbBody")?.innerText || "",
      prompt: decodeURIComponent((document.querySelector('[data-freeform-app="claude"]')?.href || "").split("?q=")[1] || ""),
    }));
    assert(!/^entry\.freeform\./m.test(portuguese.body) && portuguese.body.includes("ChatGPT"),
      "the screen is translated rather than rendering raw keys");
    assert(/JSON/.test(portuguese.prompt) && /programa/i.test(portuguese.prompt),
      "the prompt is written in the reader's language", portuguese.prompt.slice(0, 90));

    /* ---------- Import from clipboard ----------
       Clipboard is transport only: it fills the same reply the textarea fills
       and presses the same review action, so these checks are about the seam
       and the failure states, never about parsing. */
    console.log("\nImport from clipboard");

    // One stub for the whole section. It counts reads so "did rendering touch
    // the clipboard?" is answerable, and lets each case choose the outcome.
    const installClipboard = (page) => page.evaluate(() => {
      window.__clipReads = 0;
      window.__clipMode = { kind: "text", value: "" };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: () => {
            window.__clipReads++;
            const m = window.__clipMode;
            if (m.kind === "reject") return Promise.reject(new Error("denied"));
            if (m.kind === "hang") return new Promise((res) => { window.__clipRelease = res; });
            return Promise.resolve(m.value);
          },
        },
      });
    });
    const setClip = (page, kind, value) =>
      page.evaluate(({ kind, value }) => { window.__clipMode = { kind, value }; }, { kind, value });
    const clipReads = (page) => page.evaluate(() => window.__clipReads);
    const toStage3 = async (page) => {
      await reset(page);
      await openFreeform(page);
      await installClipboard(page);
      await page.fill("#entryFreeformIn", PASTED);
      await page.click("#entryFreeformContinue");
      await page.waitForSelector("#entryFreeformCopy", { timeout: 20000 });
      await page.click("#entryFreeformCopy");
      await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
    };

    const COMPLETE = JSON.stringify({
      version: 3, meta: { name: "Clipboard Split" },
      exercises: [
        { day: "Push", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
        { day: "Pull", order: 1, name: "Lat pulldown", sets: 3, min: 8, max: 12 },
      ],
    });
    const GAPPED = JSON.stringify({
      version: 3, meta: { name: "Gapped" },
      exercises: [
        { day: "Push", order: 1, name: "Bench press", sets: 4, min: 6, max: 8 },
        { day: "Push", order: 2, name: "Cable flyes", sets: 3 },
      ],
      missing: [{ day: "Push", order: 2, field: "reps" }],
      notImported: ["rest_times", "rir_rpe"],
    });

    await toStage3(page);
    const stage3 = await page.evaluate(() => {
      const btn = document.querySelector("#entryFreeformClipboard");
      return {
        exists: !!btn,
        tag: btn?.tagName, type: btn?.getAttribute("type"),
        name: btn?.textContent?.trim() || "",
        hasTextarea: !!document.querySelector("#entryFreeformOut"),
        noteHidden: document.querySelector("#entryFreeformClipNote")?.hidden,
      };
    });
    assert(stage3.exists && stage3.tag === "BUTTON" && stage3.type === "button" && stage3.name.length > 0,
      "stage 3 offers Import from clipboard as a real button with a name", JSON.stringify(stage3));
    assert(stage3.hasTextarea, "manual paste stays available beside it");
    assert(stage3.noteHidden === true, "no clipboard message shows before the lifter asks");
    assert(await clipReads(page) === 0, "rendering stage 3 never reads the clipboard");

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle(page, 120);
    assert(await clipReads(page) === 0, "returning to the tab never reads the clipboard");

    // A complete reply travels the ordinary route into the shared review.
    await setClip(page, "text", COMPLETE);
    await page.click("#entryFreeformClipboard");
    await page.waitForSelector("#importReview.active", { timeout: 20000 });
    const afterComplete = await page.evaluate(() => ({
      reads: window.__clipReads,
      source: window.__repforgeImportDraft()?.rows?.length ?? 0,
      session: sessionStorage.getItem("repforge_freeform_session_v1"),
      sourceType: window.__repforgeImportDraft()?.sourceType ?? null,
      shortlist: [...document.querySelectorAll('[data-imp-act="pick"]')].length,
    }));
    assert(afterComplete.reads === 1, "one tap reads the clipboard exactly once", String(afterComplete.reads));
    assert(afterComplete.source === 2, "the clipboard reply becomes ordinary import rows", String(afterComplete.source));
    assert(afterComplete.session === null, "reaching review clears the tab-scoped free-form session");
    assert(afterComplete.sourceType === "freeform",
      "the clipboard draft carries sourceType freeform, never clipboard", String(afterComplete.sourceType));
    assert(afterComplete.shortlist > 0, "the stacked ranked shortlist renders for a clipboard import");

    // The value the stacked PR reads at activation is written when review
    // commits, so drive the rows through and check it there.
    for (let guard = 0; guard < 12; guard++) {
      const acted = await page.evaluate(() => {
        const row = [...document.querySelectorAll("#importRows .improw")].find((r) => r.classList.contains("is-open"));
        if (!row) return false;
        (row.querySelector('[data-imp-act="pick"][data-imp-idx="0"]') ||
          row.querySelector('[data-imp-act="raw"]'))?.click();
        return true;
      });
      if (!acted) break;
      await settle(page, 120);
    }
    await page.click("#importCommit");
    await settle(page, 400);
    const stagedSource = await page.evaluate(() => sessionStorage.getItem("repforge_import_source_v1"));
    assert(stagedSource === "freeform",
      "the staged import source the stacked PR reads stays freeform", String(stagedSource));

    // A gapped reply reaches the existing gap step, disclosure and all.
    await toStage3(page);
    await setClip(page, "text", GAPPED);
    await page.click("#entryFreeformClipboard");
    await page.waitForSelector("#entryFreeformSubmitGaps", { timeout: 20000 });
    const gapText = await page.evaluate(() => document.querySelector(".entry__notice--info")?.textContent || "");
    assert(gapText.length > 0, "a gapped clipboard reply reaches the existing gap step with its disclosure", gapText);

    // Unreadable text is just another reply.
    await toStage3(page);
    await setClip(page, "text", "sorry, I cannot help with that");
    await page.click("#entryFreeformClipboard");
    await settle(page, 300);
    const unreadable = await page.evaluate(() => ({
      recovery: !!document.querySelector("#entryFreeformCopyRepair"),
      stillStage3: !!document.querySelector("#entryFreeformOut"),
    }));
    assert(unreadable.recovery && unreadable.stillStage3,
      "unreadable clipboard text lands in the existing repair state");

    // Empty clipboard must not submit and must not erase a typed reply.
    await toStage3(page);
    await page.fill("#entryFreeformOut", "half typed reply");
    await setClip(page, "text", "   \n  ");
    await page.click("#entryFreeformClipboard");
    await settle(page, 300);
    const clipEmpty = await page.evaluate(() => ({
      reply: document.querySelector("#entryFreeformOut")?.value || "",
      note: document.querySelector("#entryFreeformClipNote")?.hidden === false,
      review: !!document.querySelector("#importReview.active"),
    }));
    assert(clipEmpty.reply === "half typed reply", "an empty clipboard never overwrites a typed reply", clipEmpty.reply);
    assert(clipEmpty.note, "an empty clipboard explains itself");
    assert(!clipEmpty.review, "an empty clipboard does not enter review");

    // A rejected read is a browser capability state, not a broken import.
    await toStage3(page);
    await page.fill("#entryFreeformOut", "typed before the denial");
    await setClip(page, "reject");
    await page.click("#entryFreeformClipboard");
    await settle(page, 300);
    const denied = await page.evaluate(() => ({
      reply: document.querySelector("#entryFreeformOut")?.value || "",
      note: document.querySelector("#entryFreeformClipNote")?.textContent || "",
      source: document.querySelector("#entryFreeformIn")?.value ?? null,
      usable: document.querySelector("#entryFreeformOut")?.disabled === false,
      busy: document.querySelector("#entryFreeformClipboard")?.getAttribute("aria-busy"),
      focusedTag: document.activeElement?.tagName,
    }));
    assert(denied.reply === "typed before the denial", "a denied read preserves the typed reply", denied.reply);
    assert(denied.note.length > 0 && !/denied/i.test(denied.note),
      "a denied read explains itself without leaking the exception", denied.note);
    assert(denied.usable, "the manual field stays usable after a denial");
    assert(denied.busy === "false", "the button recovers from a rejected read");
    assert(denied.focusedTag !== "TEXTAREA", "a failed read does not force the keyboard open");

    // No Clipboard API at all.
    await reset(page);
    await openFreeform(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await page.fill("#entryFreeformIn", PASTED);
    await page.click("#entryFreeformContinue");
    await page.waitForSelector("#entryFreeformCopy", { timeout: 20000 });
    await page.click("#entryFreeformCopy");
    await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
    await page.click("#entryFreeformClipboard");
    await settle(page, 200);
    const missing = await page.evaluate(() => ({
      note: document.querySelector("#entryFreeformClipNote")?.hidden === false,
      textarea: !!document.querySelector("#entryFreeformOut"),
    }));
    assert(missing.note && missing.textarea,
      "a browser without the Clipboard API falls back to manual paste with an explanation");

    // Manual paste is untouched.
    await toStage3(page);
    await page.fill("#entryFreeformOut", COMPLETE);
    await page.click("#entryFreeformReview");
    await page.waitForSelector("#importReview.active", { timeout: 20000 });
    assert(await clipReads(page) === 0, "manual paste still works and never touches the clipboard");

    // Two rapid taps must produce one read and one transition.
    await toStage3(page);
    await setClip(page, "hang");
    await page.click("#entryFreeformClipboard");
    await page.evaluate(() => document.querySelector("#entryFreeformClipboard")?.click());
    await settle(page, 120);
    const busy = await page.evaluate(() => ({
      reads: window.__clipReads,
      disabled: document.querySelector("#entryFreeformClipboard")?.disabled,
      busy: document.querySelector("#entryFreeformClipboard")?.getAttribute("aria-busy"),
    }));
    assert(busy.reads === 1, "a double tap starts one clipboard read", String(busy.reads));
    assert(busy.disabled === true && busy.busy === "true", "the button reads as busy while the read is pending");
    await page.evaluate((v) => window.__clipRelease(v), COMPLETE);
    await page.waitForSelector("#importReview.active", { timeout: 20000 });
    const once = await page.evaluate(() => window.__repforgeImportDraft()?.rows?.length ?? 0);
    assert(once === 2, "one clipboard interaction reaches review once", String(once));

    // Stale results: a reply typed while the read was pending wins.
    await toStage3(page);
    await setClip(page, "hang");
    await page.click("#entryFreeformClipboard");
    await settle(page, 80);
    await page.evaluate(() => {
      const out = document.querySelector("#entryFreeformOut");
      out.value = "typed after the read began";
      out.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate((v) => window.__clipRelease(v), COMPLETE);
    await settle(page, 300);
    const stale = await page.evaluate(() => ({
      reply: document.querySelector("#entryFreeformOut")?.value || "",
      review: !!document.querySelector("#importReview.active"),
    }));
    assert(stale.reply === "typed after the read began" && !stale.review,
      "a stale clipboard result never overwrites a reply typed while it was pending", JSON.stringify(stale));

    // Stale results: Start over retires the pending read.
    await toStage3(page);
    await setClip(page, "hang");
    await page.click("#entryFreeformClipboard");
    await settle(page, 80);
    await page.click("#entryFreeformStartOver");
    await settle(page, 150);
    await page.evaluate((v) => window.__clipRelease(v), COMPLETE);
    await settle(page, 300);
    const afterStartOver = await page.evaluate(() => ({
      review: !!document.querySelector("#importReview.active"),
      onStage1: !!document.querySelector("#entryFreeformIn"),
    }));
    assert(!afterStartOver.review && afterStartOver.onStage1,
      "a stale clipboard result cannot act after Start over", JSON.stringify(afterStartOver));

    // Stale results: switching to the file door retires the pending read.
    await toStage3(page);
    await setClip(page, "hang");
    await page.click("#entryFreeformClipboard");
    await settle(page, 80);
    await page.click("#entryFreeformFile");
    await settle(page, 150);
    await page.evaluate((v) => window.__clipRelease(v), COMPLETE);
    await settle(page, 300);
    const afterDoor = await page.evaluate(() => ({
      review: !!document.querySelector("#importReview.active"),
      onFileDoor: !!document.querySelector("#entryFreeformSwitch"),
    }));
    assert(!afterDoor.review && afterDoor.onFileDoor,
      "a stale clipboard result cannot act after switching to file import", JSON.stringify(afterDoor));

    // Portuguese copy exists for every clipboard string.
    const ptClipboard = await page.evaluate(() => {
      const keys = ["clipboard_import", "clipboard_busy", "clipboard_or",
        "clipboard_empty", "clipboard_failed", "clipboard_unavailable"];
      return keys.map((k) => window.RepForgeI18n.t("entry.freeform." + k, {}, "pt"));
    });
    assert(ptClipboard.every((v) => v && !/^entry\.freeform\./.test(v)),
      "every clipboard string is translated for Portuguese", JSON.stringify(ptClipboard));
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nfree-form import: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
