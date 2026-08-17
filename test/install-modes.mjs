#!/usr/bin/env node
/**
 * Install promotion and the first-run setup gate.
 *
 * The screen a lifter gets is decided by capabilities and display mode, never
 * by screen size, so this suite drives each capability combination and reads
 * back what was rendered:
 *
 *   standalone            → nothing is promoted anywhere
 *   deferred prompt held  → the Chromium card, and a button that asks Chrome
 *   iOS/iPadOS Safari     → the iOS card, and the app's own instruction sheet
 *   another iOS browser   → an explanation, and no button at all
 *   nothing available     → no install section, and no gate either
 *
 * Chrome's own install prompt is never drawn by the app, so it is never
 * asserted on here: what is asserted is that prompt() is called exactly once,
 * that the event is consumed, and that no install is claimed unless Chrome
 * said "accepted".
 *
 * Run: node test/install-modes.mjs   (with a static server on REPFORGE_URL)
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

// A stand-in for the event Chrome would fire. Headless Chromium never fires the
// real one, and the app only ever needs prompt() and userChoice from it.
const INSTALL_EVENT = `
  window.__promptCalls = 0;
  window.__choice = "accepted";
  window.__fireInstall = () => {
    const evt = new Event("beforeinstallprompt");
    evt.prompt = () => { window.__promptCalls++; };
    evt.userChoice = new Promise((res) => setTimeout(() => res({ outcome: window.__choice }), 10));
    window.dispatchEvent(evt);
  };
`;

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

async function firstRunPage(browser, { ua, locale = "en-US", standalone = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ua,
    locale,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  if (standalone) {
    await page.addInitScript(`
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q) => (q.includes("display-mode: standalone")
        ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
        : mm(q));
    `);
  }
  await page.addInitScript(INSTALL_EVENT);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  // Boot has made its first-run decision once one of the two first-run screens
  // is up. Firing the fake event before that would be testing boot timing, not
  // the install rules.
  await page.waitForFunction(
    () =>
      document.querySelector("#onboarding")?.classList.contains("active") ||
      document.querySelector("#firstRun")?.classList.contains("hidden") === false,
    undefined,
    { timeout: 15000 }
  );
  return { context, page, errors };
}

const card = () => ({
  section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
  title: document.querySelector(".installcard__title")?.textContent || null,
  body: document.querySelector(".installcard__body")?.textContent || null,
  action: document.querySelector("#firstRunInstallAction")?.textContent || null,
  continueLabel: document.querySelector("#firstRunContinueLabel")?.textContent || null,
  create: !!document.querySelector("#firstRunCreate"),
  import: !!document.querySelector("#firstRunImport"),
});

async function run() {
  console.log(`Install modes\nTarget: ${BASE}\n`);
  const browser = await launchChromium();
  const allErrors = [];

  // ---- Chromium holding a deferred prompt ----
  {
    console.log("Chromium with a captured beforeinstallprompt");
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA });
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const shown = await page.evaluate(card);
    assert(shown.section, "the install section is offered", JSON.stringify(shown));
    assert(shown.title === "Install Taurifer", "card title", shown.title);
    assert(
      shown.body === "Open it from your Home Screen, without browser controls.",
      "card body names browser controls",
      shown.body
    );
    assert(shown.action === "Install Taurifer", "the button asks Chrome to install", shown.action);
    assert(shown.continueLabel === "Continue in browser", "the escape hatch says browser", shown.continueLabel);

    await page.click("#firstRunInstallAction");
    await page.waitForTimeout(300);
    const accepted = await page.evaluate(() => ({
      calls: window.__promptCalls,
      section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
      gate: !document.querySelector("#firstRun").classList.contains("hidden"),
      create: !!document.querySelector("#firstRunCreate"),
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
      toast: (() => { const el = document.querySelector("#toast"); return el && !el.classList.contains("hidden") ? el.textContent : null; })(),
      lede: document.querySelector("#firstRunLede")?.textContent || null,
      continueShown: !document.querySelector("#firstRunContinue").classList.contains("hidden"),
    }));
    assert(accepted.calls === 1, "prompt() runs once per tap", String(accepted.calls));
    assert(accepted.toast === "Installing Taurifer…", "an accepted install is reported", String(accepted.toast));
    assert(
      accepted.lede === "Choose how you want to begin." && !accepted.continueShown,
      "the screen drops to the program question alone",
      JSON.stringify({ lede: accepted.lede, continueShown: accepted.continueShown })
    );
    assert(!accepted.section, "an accepted install removes the install section", JSON.stringify(accepted));
    assert(accepted.gate && accepted.create, "the program choices stay", JSON.stringify(accepted));
    assert(!accepted.topButton, "the consumed event leaves no install button behind", JSON.stringify(accepted));
    allErrors.push(...errors);
    await context.close();
  }

  // ---- Chromium, prompt dismissed ----
  {
    console.log("\nChromium after the lifter dismisses Chrome's prompt");
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA });
    await page.evaluate(() => {
      window.__choice = "dismissed";
      window.__fireInstall();
    });
    await page.waitForSelector("#firstRunInstallAction", { timeout: 8000 });
    await page.click("#firstRunInstallAction");
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      calls: window.__promptCalls,
      gate: !document.querySelector("#firstRun").classList.contains("hidden"),
      create: !!document.querySelector("#firstRunCreate"),
      import: !!document.querySelector("#firstRunImport"),
      section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
      toast: (() => { const el = document.querySelector("#toast"); return el && !el.classList.contains("hidden") ? el.textContent : null; })(),
    }));
    assert(after.gate && after.create && after.import, "Create and Import survive a dismissal", JSON.stringify(after));
    assert(after.calls === 1, "a dismissal does not prompt again", String(after.calls));
    assert(!after.section, "the spent event leaves no dead button", JSON.stringify(after));
    assert(!after.toast, "no install is claimed that Chrome did not confirm", JSON.stringify(after));

    // Chrome may offer the event again; the section comes back with it.
    await page.evaluate(() => window.__fireInstall());
    await page.waitForTimeout(100);
    assert(
      await page.evaluate(() => !document.querySelector("#firstRunInstall").classList.contains("hidden")),
      "a re-offered event brings the section back"
    );
    allErrors.push(...errors);
    await context.close();
  }

  // ---- iOS Safari ----
  {
    console.log("\niOS Safari");
    const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const shown = await page.evaluate(card);
    assert(shown.section, "the install section is offered", JSON.stringify(shown));
    assert(
      shown.body === "Open it from your Home Screen, without Safari controls.",
      "card body names Safari controls",
      shown.body
    );
    assert(shown.action === "Install on iPhone", "the button opens the instructions", shown.action);
    assert(shown.continueLabel === "Continue in Safari", "the escape hatch says Safari", shown.continueLabel);

    await page.click("#firstRunInstallAction");
    await page.waitForTimeout(450);
    const sheet = await page.evaluate(() => ({
      open: document.querySelector("#iosInstallSheet").classList.contains("is-open"),
      host: document.querySelector("#iosInstallHost")?.textContent,
      steps: [...document.querySelectorAll(".installsteps__body")].map((n) => n.textContent.trim()),
      bold: [...document.querySelectorAll(".installsteps__body b")].map((n) => n.textContent),
    }));
    assert(sheet.open, "the instruction sheet opens", JSON.stringify(sheet));
    assert(sheet.host === new URL(BASE).hostname, "it shows the page's own host", sheet.host);
    assert(sheet.steps.length === 3, "it lists the three Safari steps", JSON.stringify(sheet.steps));
    assert(
      sheet.bold.includes("Share") && sheet.bold.includes("Add to Home Screen"),
      "the Safari controls to look for are emphasised",
      JSON.stringify(sheet.bold)
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    assert(
      await page.evaluate(() => document.querySelector("#iosInstallSheet").hidden),
      "Escape closes the sheet"
    );
    assert(
      await page.evaluate(() => !document.querySelector("#firstRun").classList.contains("hidden")),
      "and leaves the gate standing"
    );
    allErrors.push(...errors);
    await context.close();
  }

  // ---- Another browser on iOS ----
  {
    console.log("\nAnother browser on iOS");
    const { context, page, errors } = await firstRunPage(browser, { ua: IOS_CHROME_UA });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const shown = await page.evaluate(card);
    assert(shown.section, "the section explains rather than disappears", JSON.stringify(shown));
    assert(/Safari/.test(shown.body || ""), "it names Safari as the way in", shown.body);
    assert(shown.action === null, "it offers no button it cannot honour", String(shown.action));
    assert(shown.continueLabel === "Continue in browser", "the escape hatch says browser", shown.continueLabel);
    allErrors.push(...errors);
    await context.close();
  }

  // ---- No mechanism at all ----
  {
    console.log("\nA browser with no install mechanism");
    const { context, page, errors } = await firstRunPage(browser, { ua: undefined });
    await page.waitForSelector("#onboarding.active", { timeout: 8000 });
    const st = await page.evaluate(() => ({
      gate: !document.querySelector("#firstRun").classList.contains("hidden"),
      banner: !document.querySelector("#installBanner").classList.contains("hidden"),
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
    }));
    assert(!st.gate, "no gate is interposed", JSON.stringify(st));
    assert(!st.banner && !st.topButton, "and nothing else promotes an install", JSON.stringify(st));
    allErrors.push(...errors);
    await context.close();
  }

  // ---- Already installed ----
  // The first launch from the Home Screen icon is a first run with an empty
  // store. Nothing can be installed there, but the program question is still
  // open, so the screen must still ask it rather than hand over the wizard.
  {
    console.log("\nRunning installed, in standalone display mode");
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA, standalone: true });
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const st = await page.evaluate(() => ({
      section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
      create: !!document.querySelector("#firstRunCreate"),
      import: !!document.querySelector("#firstRunImport"),
      lede: document.querySelector("#firstRunLede")?.textContent || null,
      continueShown: !document.querySelector("#firstRunContinue").classList.contains("hidden"),
      onboarding: document.querySelector("#onboarding").classList.contains("active"),
      banner: !document.querySelector("#installBanner").classList.contains("hidden"),
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
    }));
    assert(st.create && st.import, "the installed app still offers Create and Import", JSON.stringify(st));
    assert(!st.onboarding, "it does not jump straight into the wizard", JSON.stringify(st));
    assert(!st.section, "it promotes no install", JSON.stringify(st));
    assert(st.lede === "Choose how you want to begin.", "the lede drops the install sentence", st.lede);
    assert(!st.continueShown, "and there is no browser to continue in", JSON.stringify(st));
    assert(!st.banner, "the banner stays away", JSON.stringify(st));
    assert(!st.topButton, "the top install button stays away", JSON.stringify(st));

    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active", { timeout: 5000 });
    assert(true, "Create still hands over to onboarding");
    allErrors.push(...errors);
    await context.close();
  }

  // ---- The program choices ----
  {
    console.log("\nChoosing a program from the gate");
    const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    await page.click("#firstRunCreate");
    await page.waitForSelector("#onboarding.active", { timeout: 5000 });
    assert(
      await page.evaluate(() => document.querySelector("#firstRun").classList.contains("hidden")),
      "Create hands over to onboarding"
    );
    await context.close();
    allErrors.push(...errors);
  }

  {
    const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const shared = JSON.stringify({
      meta: { name: "Shared split" },
      exercises: [
        { id: "a", day: "Day 1", name: "Barbell bench press", sets: 3, repLow: 6, repHigh: 10, muscles: ["Chest"] },
        { id: "b", day: "Day 1", name: "Barbell back squat", sets: 3, repLow: 5, repHigh: 8, muscles: ["Quads"] },
      ],
    });
    await page.setInputFiles("#importProgram", {
      name: "shared.json",
      mimeType: "application/json",
      buffer: Buffer.from(shared),
    });
    await page.waitForSelector("#importReview.active", { timeout: 5000 });
    assert(
      await page.evaluate(() => document.querySelector("#firstRun").classList.contains("hidden")),
      "the gate steps aside for the import review"
    );
    await page.click("#importBack");
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 5000 });
    assert(true, "backing out of the review returns to the gate");

    await page.setInputFiles("#importProgram", {
      name: "shared.json",
      mimeType: "application/json",
      buffer: Buffer.from(shared),
    });
    await page.waitForSelector("#importReview.active", { timeout: 5000 });
    await page.click("#importCommit");
    await page.waitForFunction(
      () =>
        document.querySelector("#firstRun").classList.contains("hidden") &&
        !document.querySelector("#importReview").classList.contains("active"),
      undefined,
      { timeout: 8000 }
    );
    const committed = await page.evaluate(() => ({
      onboarded: JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded,
      log: document.querySelector("#log").classList.contains("active"),
    }));
    assert(committed.onboarded === true, "an import from the gate finishes first run", JSON.stringify(committed));
    assert(committed.log, "and lands on Today", JSON.stringify(committed));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
    await page.waitForTimeout(300);
    assert(
      await page.evaluate(() => document.querySelector("#firstRun").classList.contains("hidden")),
      "the gate does not come back once a program exists"
    );
    allErrors.push(...errors);
    await context.close();
  }

  // ---- Portuguese ----
  {
    console.log("\nPortuguese");
    const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA, locale: "pt-BR" });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const pt = await page.evaluate(card);
    assert(pt.title === "Instale o Taurifer", "PT card title", pt.title);
    assert(
      pt.body === "Abra pela Tela de Início, sem os controles do Safari.",
      "PT card body",
      pt.body
    );
    assert(pt.continueLabel === "Continuar no Safari", "PT escape hatch", pt.continueLabel);
    await context.close();
    allErrors.push(...errors);
  }

  {
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA, locale: "pt-BR" });
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const pt = await page.evaluate(card);
    assert(
      pt.body === "Abra pela Tela de Início, sem os controles do navegador.",
      "PT Chromium card body",
      pt.body
    );
    assert(pt.continueLabel === "Continuar no navegador", "PT Chromium escape hatch", pt.continueLabel);
    await context.close();
    allErrors.push(...errors);
  }

  await browser.close();
  assert(allErrors.length === 0, "no uncaught page errors", allErrors.slice(0, 3).join(" | "));

  console.log(`\ninstall modes: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("install-modes.mjs crashed:", err);
  process.exit(2);
});
