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
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 20000 });
}

/** First run → hub → "Use my own program" → the paste door. */
async function openFreeform(page) {
  await page.waitForSelector("#firstRunCreate", { timeout: 20000 });
  await page.click("#firstRunCreate");
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
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page);
    await reset(page);

    console.log("\nThe paste door");
    const doors = await openFreeform(page);
    assert(doors.freeform === 1 && doors.file === 1,
      "the two import doors are two cards on one route", JSON.stringify(doors));

    const empty = await linkState(page);
    assert(empty.disabled.every((value) => value === "true") && empty.copyDisabled === true && !empty.needsHidden,
      "with nothing pasted, no app link and no copy is available",
      JSON.stringify(empty.disabled));

    await page.fill("#entryFreeformIn", PASTED);
    const filled = await linkState(page);
    assert(filled.chatgpt.startsWith("https://chatgpt.com/?q=")
      && filled.claude.startsWith("https://claude.ai/new?q="),
      "each app is a prefilled link to its own composer",
      JSON.stringify({ chatgpt: filled.chatgpt.slice(0, 40), claude: filled.claude.slice(0, 40) }));
    const sent = decodeURIComponent(filled.chatgpt.split("?q=")[1] || "");
    assert(sent.includes("Bench press 4x6-8") && sent.includes('"sets"') && sent.includes('"min"'),
      "the link carries the pasted program and the format Taurifer reads",
      sent.slice(0, 120));
    assert(filled.target === "_blank" && /noopener/.test(filled.rel),
      "the links leave the app deliberately and without an opener",
      JSON.stringify({ target: filled.target, rel: filled.rel }));
    assert(filled.needsHidden === true && filled.copyDisabled === false,
      "pasting something is what makes the hand-off available", JSON.stringify(filled.counter));

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

    console.log("\nNothing is sent or kept by itself");
    const stored = await page.evaluate(({ k, setup, ui }) => ({
      state: localStorage.getItem(k) || "",
      draft: localStorage.getItem(setup) || "",
      ui: localStorage.getItem(ui) || "",
    }), { k: KEY, setup: SETUP_DRAFT, ui: UI_KEY });
    assert(!Object.values(stored).some((value) => value.includes("Overhead press")),
      "the pasted program is never written to storage",
      JSON.stringify(Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, v.length]))));
    assert(JSON.parse(stored.ui || "{}").importSourceMode === "freeform",
      "only which door was used is remembered, as a device UI pref", stored.ui);

    console.log("\nThe reply comes back through the import review");
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

    if (await page.locator("#importCommit").isDisabled()) {
      const raw = page.locator('[data-imp-act="raw"]').first();
      if (await raw.count()) await raw.click();
      else await page.locator('[data-imp-act="link"]').first().click();
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

    console.log("\nA reply that is not a program");
    await page.click("#onbBack");
    await page.waitForSelector("#entryFreeformOut", { timeout: 20000 });
    assert(await page.locator("#entryFreeformOut").isVisible(),
      "Back from the preview returns to the door the import came through");
    await page.fill("#entryFreeformOut", "I can't help with that, but here are some general tips!");
    await page.click("#entryFreeformReview");
    await page.waitForTimeout(400);
    const refused = await page.evaluate(() => ({
      toast: document.querySelector("#toast")?.textContent || "",
      reviewing: !!document.querySelector("#importReview.active"),
    }));
    assert(!refused.reviewing && /program/i.test(refused.toast),
      "an unusable reply is refused with an explanation, not half-imported",
      JSON.stringify(refused));

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
    await page.waitForSelector("#entryOwnToggle", { timeout: 20000 });
    await page.click("#entryOwnToggle");
    await page.click('[data-entry-route="import"]');
    await page.waitForSelector("#entryImportPick", { timeout: 20000 });
    assert(await page.locator("#entryImportPick").isVisible(),
      "the Import card opens the file door its caption describes");

    console.log("\nPortuguese reads the same screen");
    await reset(page);
    await page.evaluate(() => window.RepForgeI18n.setLang("pt"));
    await openFreeform(page);
    await page.fill("#entryFreeformIn", PASTED);
    const portuguese = await page.evaluate(() => ({
      body: document.querySelector("#onbBody")?.innerText || "",
      prompt: decodeURIComponent((document.querySelector('[data-freeform-app="claude"]')?.href || "").split("?q=")[1] || ""),
    }));
    assert(!/^entry\.freeform\./m.test(portuguese.body) && portuguese.body.includes("ChatGPT"),
      "the screen is translated rather than rendering raw keys");
    assert(/JSON/.test(portuguese.prompt) && /programa/i.test(portuguese.prompt),
      "the prompt is written in the reader's language", portuguese.prompt.slice(0, 90));
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
