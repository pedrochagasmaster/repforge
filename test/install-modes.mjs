#!/usr/bin/env node
/**
 * Install promotion and the first-run setup screen.
 *
 * The landing opens once on an empty device. What its install section says is decided by capabilities and
 * display mode, never by screen size, so this suite drives each capability
 * combination and reads back what was rendered:
 *
 *   deferred prompt held  → the Chromium card, and a button that asks Chrome
 *   iOS/iPadOS Safari     → the iOS card, and the app's own instruction sheet
 *   another iOS browser   → an explanation, and no button at all
 *   standalone            → no install section: it is already installed
 *   nothing available     → no install section either, and the program
 *                           question by itself
 *
 * Chrome's own install prompt is never drawn by the app, so it is never
 * asserted on here: what is asserted is that prompt() is called exactly once,
 * that the event is consumed, and that no install is claimed unless Chrome
 * said "accepted".
 *
 * Plan 054 supersedes the full ethos hero with the owner-selected product loop.
 * This suite locks its prescription, logged sets, derived next target, early
 * entry actions, and responsive separation from controls across both locales.
 *
 * Two more sections cover the install offer outside first run:
 *
 *   the banner    measured across phone widths in both languages, because it
 *                 packs an icon, two paragraphs and a full-width CTA into a
 *                 toast — the copy has to keep a real measure and the button
 *                 has to stay inside the card
 *   the manifest  the file Chrome mints an Android WebAPK from: identity
 *                 inherited from the project-scoped start URL; raster icons
 *                 only, all fetchable, 192 and 512 present (ADR 0008)
 *
 * Run: node test/install-modes.mjs   (with a static server on REPFORGE_URL)
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { launchChromium } from "./browser.mjs";
import { MINIMAL_PAYLOAD, REPRESENTATIVE_PAYLOAD, cloneFixture } from "./fixtures/shared-setup.mjs";
import {
  APP_INDEX,
  encodeSharedPayload,
  openAppPage,
  SHARED_COPY,
  sharedGateSnapshot,
  waitForFirstRun,
} from "./shared-setup-flow.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const SW_SOURCE = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
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

async function firstRunPage(browser, { ua, locale = "en-US", standalone = false, width = 390 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
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
  // P3 writes entryLandingSeen at the end of the first landing render. Let
  // that boot settle before clearing the origin, or its late UI-pref write can
  // race the reset and make the deliberate clean reload look like a return.
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  // A first run lands on the setup screen. Firing the fake event before it is up
  // would be testing boot timing, not the install rules.
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  return { context, page, errors };
}

async function sharedInstallPage(browser, { ua, locale = "en-US", standalone = false, width = 390, payload = MINIMAL_PAYLOAD } = {}) {
  const { context, page, errors } = await openAppPage(browser, { ua, locale, standalone, width });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  const encoded = await encodeSharedPayload(page, payload);
  if (encoded?.ok) {
    await page.goto(`${APP_INDEX}?shared-install=${width}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await waitForFirstRun(page);
  }
  return { context, page, errors, encoded };
}

// The banner only shows to a lifter who is past first run, so these pages
// import a program, then boot again into the app proper.
const BANNER_PROGRAM = JSON.stringify({
  meta: { name: "Banner split" },
  exercises: [
    { id: "a", day: "Day 1", name: "Barbell bench press", sets: 3, repLow: 6, repHigh: 10, muscles: ["Chest"] },
    { id: "b", day: "Day 1", name: "Barbell back squat", sets: 3, repLow: 5, repHigh: 8, muscles: ["Quads"] },
  ],
});

async function bannerPage(browser, { ua, locale = "en-US", width = 393, native = false, choice = "accepted" } = {}) {
  const { context, page, errors } = await firstRunPage(browser, { ua, locale, width });
  await page.setInputFiles("#importProgram", {
    name: "program.json",
    mimeType: "application/json",
    buffer: Buffer.from(BANNER_PROGRAM),
  });
  await page.waitForSelector("#importReview.active", { timeout: 8000 });
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  await page.click("#entryActivate");
  await page.waitForFunction(() => document.querySelector("#firstRun").classList.contains("hidden"), undefined, {
    timeout: 8000,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  if (native) {
    const seeded = await page.evaluate(async (nextChoice) => {
      const proposal = window.__repforgeWorkoutDraft.state();
      const exercise = proposal.program[0];
      proposal.log.push({
        session: "install-value-1", date: "2026-09-13", day: exercise.day,
        name: exercise.name, exerciseId: exercise.id, set: 1, load: 50, reps: 8, rir: 2,
        notes: "", created: "2026-09-13T12:00:00.000Z",
      });
      const result = await window.__repforgeCommitProposedState(proposal);
      window.__choice = nextChoice;
      window.__fireInstall();
      window.__repforgeUi.showInstallBanner(false);
      return result?.committed === true && result?.settled === true;
    }, choice);
    if (!seeded) throw new Error("install value milestone did not commit");
  } else {
    await page.evaluate(() => window.__repforgeUi.showInstallBanner(true));
  }
  await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 8000 });
  // The copy is measured in characters of a web font.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return { context, page, errors };
}

// What the banner looks like, measured rather than described. It is a toast
// over a working app, so it has to stay short, keep its copy in a column wide
// enough to set sentences in, and keep every control inside its own card.
const bannerShape = () => {
  const banner = document.querySelector("#installBanner");
  const action = document.querySelector("#installBannerAction");
  const text = document.querySelector(".installbanner__text");
  const body = document.querySelector(".installbanner__body");
  const close = document.querySelector("#installBannerClose");
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };
  // Inline markup — the bold words, the iOS share glyph — puts more than one
  // rect on a line, so lines are counted by the tops they sit on.
  const lineCount = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
  };
  const inkRects = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  };
  const intersects = (one, two) =>
    one.left < two.right && one.right > two.left && one.top < two.bottom && one.bottom > two.top;
  // Every control in the app carries a 44px hit area, which is wider than the
  // gutter the banner reserves — so the ✕ drawn inside it, not its box, is what
  // the copy has to clear.
  const closeInk = inkRects(close)[0];
  const pad = getComputedStyle(banner);
  const actionShown = !action.classList.contains("hidden");
  return {
    closeInk: closeInk
      ? { left: Math.round(closeInk.left), right: Math.round(closeInk.right), top: Math.round(closeInk.top) }
      : null,
    copyOverlapsClose:
      !!closeInk &&
      [...inkRects(document.querySelector(".installbanner__title")), ...inkRects(body)].some((line) =>
        intersects(line, closeInk)
      ),
    shown: !banner.classList.contains("hidden"),
    banner: box(banner),
    text: box(text),
    close: box(close),
    action: actionShown ? box(action) : null,
    actionShown,
    actionLabel: actionShown ? action.textContent : null,
    bodyLines: lineCount(body),
    bodyWords: body.textContent.trim().split(/\s+/).length,
    padding: { left: parseFloat(pad.paddingLeft), right: parseFloat(pad.paddingRight) },
    viewport: { width: innerWidth, height: innerHeight },
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
};

const card = () => ({
  section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
  title: document.querySelector(".installcard__title")?.textContent || null,
  body: document.querySelector(".installcard__body")?.textContent || null,
  action: document.querySelector("#firstRunInstallAction")?.textContent || null,
  continueLabel: document.querySelector("#firstRunContinueLabel")?.textContent || null,
  create: !!document.querySelector("#firstRunCreate"),
  import: !!document.querySelector("#firstRunImport"),
  heroTitle: document.querySelector(".firstrun-hero__title")?.textContent || null,
  heroBody: document.querySelector("#firstRunLede")?.textContent || null,
  previewText: document.querySelector(".firstrun-preview")?.textContent.replace(/\s+/g, " ").trim() || null,
  privacy: document.querySelector("#firstRunPrivacy")?.textContent.trim() || null,
  // The gate stands the mark on its paper, so it draws the ground-free
  // rendering and never the app icon, which carries a ground of its own.
  markSrc: document.querySelector(".firstrun__logo")?.getAttribute("src") || null,
});

// The selected landing keeps the live product loop separate from copy and
// controls. At the narrowest supported width it stacks; otherwise it uses the
// owner-selected copy/phone composition without horizontal overflow.
const heroShape = () => {
  const title = document.querySelector(".firstrun-hero__title");
  const hero = document.querySelector(".firstrun-hero");
  const preview = document.querySelector(".firstrun-preview");
  const logo = document.querySelector(".firstrun__logo");
  const wordmark = document.querySelector(".firstrun__wordmark");
  const lede = document.querySelector(".firstrun__lede");
  const actions = document.querySelector("#firstRunStandardProgram");
  const firstControl = document.querySelector("#firstRunCreate");
  const row = document.querySelector(".firstrun__brand").getBoundingClientRect();
  const p = preview.getBoundingClientRect();
  const copy = document.querySelector(".firstrun-hero__copy").getBoundingClientRect();
  const controls = actions.getBoundingClientRect();
  const t = title.getBoundingClientRect();
  const h = hero.getBoundingClientRect();
  const intersects = (one, two) =>
    one.left < two.right && one.right > two.left && one.top < two.bottom && one.bottom > two.top;
  return {
    stacked: getComputedStyle(hero).gridTemplateAreas.includes('"copy"') &&
      !getComputedStyle(hero).gridTemplateAreas.includes('"copy preview"'),
    titleAlign: getComputedStyle(title).textAlign,
    previewSeparated: !intersects(p, controls) && !intersects(p, t) && !intersects(p, lede.getBoundingClientRect()),
    previewInsideViewport: p.left >= -1 && p.right <= innerWidth + 1,
    previewFacts: preview.textContent.replace(/\s+/g, " ").trim(),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    heroBottom: h.bottom,
    ledeTop: lede.getBoundingClientRect().top,
    firstControlTop: firstControl?.getBoundingClientRect().top ?? null,
    viewportHeight: innerHeight,
    copyInsideHero: copy.left >= h.left - 1 && copy.right <= h.right + 1,
    logoWidth: Math.round(logo.getBoundingClientRect().width),
    wordmarkSize: parseFloat(getComputedStyle(wordmark).fontSize),
    lockupInsideViewport: row.left >= 0 && row.right <= innerWidth,
  };
};

async function run() {
  console.log(`Install modes\nTarget: ${BASE}\n`);
  const browser = await launchChromium();
  const allErrors = [];

  // ---- Chromium holding a deferred prompt before first value ----
  {
    console.log("Chromium before the first saved-workout value milestone");
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA });
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const shown = await page.evaluate(card);
    assert(!shown.section, "Chromium does not promote installation before first value", JSON.stringify(shown));
    assert(shown.title === null && shown.action === null, "the gated card exposes no dead install action", JSON.stringify(shown));
    assert(
      shown.heroTitle === "Stop guessing what to lift. And start progressing.",
      "the product landing leads the gate",
      shown.heroTitle
    );
    assert(
      shown.heroBody === "Show up and lift. Taurifer plans your sessions, logs your sets, and tells you what comes next.",
      "the landing explains the product loop",
      JSON.stringify(shown.heroBody)
    );
    assert(
      /Program prescription/.test(shown.previewText || "") && /Sets logged 3\/3/.test(shown.previewText || "") && /62\.5 kg/.test(shown.previewText || ""),
      "the preview carries prescription, logged work, and derived next target",
      shown.previewText
    );
    assert(shown.privacy === "Privacy", "the landing links to Privacy", shown.privacy);
    assert(shown.markSrc === "assets/brand/mark.png", "the gate stands the ground-free mark on its paper", shown.markSrc);

    await page.click("#firstRunPrivacy");
    await page.waitForSelector("#privacySheet.is-open:not([hidden])", { timeout: 8000 });
    const privacy = await page.evaluate(() => ({
      title: document.querySelector("#privacyTitle")?.textContent.trim() || "",
      modal: document.querySelector("#privacySheet")?.getAttribute("aria-modal") || null,
    }));
    assert(privacy.title === "Privacy" && privacy.modal === "true", "the landing Privacy action opens the existing disclosure surface", JSON.stringify(privacy));
    await page.click("#privacyClose");
    await page.waitForFunction(() => document.querySelector("#privacySheet")?.hidden === true, undefined, { timeout: 8000 });

    const gated = await page.evaluate(() => ({
      calls: window.__promptCalls,
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
      decision: window.__repforgeUi.installPolicyDecision(),
    }));
    assert(gated.calls === 0, "the native prompt is not consumed before value", JSON.stringify(gated));
    assert(!gated.topButton && gated.decision.state === "chromium-awaiting-value",
      "all automatic Chromium promotion awaits value", JSON.stringify(gated));
    allErrors.push(...errors);
    await context.close();
  }

  // ---- Chromium after first value, prompt dismissed ----
  {
    console.log("\nChromium after first value and prompt dismissal");
    const { context, page, errors } = await bannerPage(browser, { ua: ANDROID_UA, native: true, choice: "dismissed" });
    await page.click("#installBannerAction");
    await page.waitForFunction(() => window.__promptCalls === 1, undefined, { timeout: 8000 });
    const after = await page.evaluate(() => ({
      calls: window.__promptCalls,
      banner: !document.querySelector("#installBanner").classList.contains("hidden"),
      toast: (() => { const el = document.querySelector("#toast"); return el && !el.classList.contains("hidden") ? el.textContent : null; })(),
      prefs: JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}"),
    }));
    assert(after.calls === 1, "the eligible native prompt runs exactly once", String(after.calls));
    assert(!after.banner, "the spent event leaves no dead banner action", JSON.stringify(after));
    assert(!after.toast, "no install is claimed that Chrome did not confirm", JSON.stringify(after));
    assert(after.prefs.installDismissedMilestone === 1 && Number.isFinite(after.prefs.installDismissedAt),
      "dismissal records the first-value milestone", JSON.stringify(after.prefs));

    // A fresh capability event cannot bypass the recorded milestone.
    await page.evaluate(() => { window.__fireInstall(); window.__repforgeUi.showInstallBanner(false); });
    assert(
      await page.evaluate(() => document.querySelector("#installBanner").classList.contains("hidden")),
      "a re-offered event does not loop before the third workout"
    );
    allErrors.push(...errors);
    await context.close();

  }

  // ---- Chromium after first value, prompt accepted ----
  {
    console.log("\nChromium after first value and prompt acceptance");
    const { context, page, errors } = await bannerPage(browser, { ua: ANDROID_UA, native: true });
    await page.click("#installBannerAction");
    await page.waitForFunction(() => window.__promptCalls === 1, undefined, { timeout: 8000 });
    const accepted = await page.evaluate(() => ({
      calls: window.__promptCalls,
      banner: !document.querySelector("#installBanner").classList.contains("hidden"),
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
      toast: (() => { const el = document.querySelector("#toast"); return el && !el.classList.contains("hidden") ? el.textContent : null; })(),
    }));
    assert(accepted.calls === 1, "accepted value-milestone prompt runs exactly once", JSON.stringify(accepted));
    assert(accepted.toast === "Installing Taurifer…", "an accepted install is reported", String(accepted.toast));
    assert(!accepted.banner && !accepted.topButton, "accepted install consumes every native promotion action", JSON.stringify(accepted));
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
    assert(sheet.steps.length === 4, "it lists the four Safari steps", JSON.stringify(sheet.steps));
    assert(
      sheet.bold.includes("Share") && sheet.bold.includes("View More") && sheet.bold.includes("Add to Home Screen"),
      "the Safari controls to look for are emphasised",
      JSON.stringify(sheet.bold)
    );
    // iOS keeps Share behind the ••• menu at the right of the address bar, and
    // Add to Home Screen behind View More — a step short of either dead-ends.
    assert(/•••/.test(sheet.steps[0]) && /address bar/.test(sheet.steps[0]),
      "step 01 points at ••• beside the address bar", sheet.steps[0]);
    assert(sheet.steps.findIndex((s) => /View More/.test(s))
      < sheet.steps.findIndex((s) => /Add to Home Screen/.test(s)),
      "View More comes before Add to Home Screen", JSON.stringify(sheet.steps));

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
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const st = await page.evaluate(() => ({
      section: !document.querySelector("#firstRunInstall").classList.contains("hidden"),
      create: !!document.querySelector("#firstRunCreate"),
      import: !!document.querySelector("#firstRunImport"),
      lede: document.querySelector("#firstRunLede")?.textContent || null,
      continueShown: !document.querySelector("#firstRunContinue").classList.contains("hidden"),
      banner: !document.querySelector("#installBanner").classList.contains("hidden"),
      topButton: !document.querySelector("#installBtn").classList.contains("hidden"),
    }));
    assert(st.create && st.import, "the screen still asks the program question", JSON.stringify(st));
    assert(!st.section, "no install section is drawn", JSON.stringify(st));
    assert(st.lede === "Show up and lift. Taurifer plans your sessions, logs your sets, and tells you what comes next.", "the landing copy does not invent an unavailable install action", st.lede);
    assert(!st.continueShown, "no browser to continue in, no link offering it", JSON.stringify(st));
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
    assert(st.lede === "Show up and lift. Taurifer plans your sessions, logs your sets, and tells you what comes next.", "the installed landing keeps its product explanation", st.lede);
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
    await page.waitForSelector("#entryActivate", { timeout: 10000 });
    await page.click("#entryActivate");
    await page.waitForFunction(
      () =>
        document.querySelector("#firstRun").classList.contains("hidden") &&
        !document.querySelector("#importReview").classList.contains("active") &&
        document.querySelector("#log").classList.contains("active"),
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
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
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
    assert(pt.heroTitle === "Pare de adivinhar o que levantar. E comece a progredir.", "PT landing title", pt.heroTitle);
    assert(
      pt.heroBody === "Apareça e treine. O Taurifer planeja suas sessões, registra suas séries e diz o que vem depois.",
      "PT landing body",
      JSON.stringify(pt.heroBody)
    );
    await context.close();
    allErrors.push(...errors);
  }

  {
    const { context, page, errors } = await firstRunPage(browser, { ua: ANDROID_UA, locale: "pt-BR" });
    await page.evaluate(() => window.__fireInstall());
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 8000 });
    const pt = await page.evaluate(card);
    assert(
      !pt.section && pt.body === null,
      "PT Chromium also withholds promotion before value",
      JSON.stringify(pt)
    );
    assert(pt.continueLabel === "Continuar no navegador", "PT Chromium escape hatch", pt.continueLabel);
    await context.close();
    allErrors.push(...errors);
  }

  // ---- The landing's shape, from compact phones through the wide composition ----
  {
    console.log("\nThe product landing's shape");
    for (const width of [320, 390, 430, 759, 760, 768, 1024, 1280]) {
      for (const locale of ["en-US", "pt-BR"]) {
        const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA, locale, width });
        // The poem is measured in characters of a web font; measuring before it
        // arrives measures the fallback.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        const shape = await page.evaluate(heroShape);
        const at = `${width}px ${locale}`;
        assert(shape.previewSeparated, `${at}: product preview does not cover copy or entry actions`, JSON.stringify(shape));
        assert(shape.previewInsideViewport, `${at}: product preview stays inside the viewport`, JSON.stringify(shape));
        assert(/3 × 8–10/.test(shape.previewFacts) && /60 kg × 10/.test(shape.previewFacts) && /62\.5 kg/.test(shape.previewFacts), `${at}: the complete product loop remains present`, shape.previewFacts);
        assert(shape.titleAlign === "left", `${at}: the editorial headline stays left aligned`, shape.titleAlign);
        assert(
          shape.logoWidth >= 39 && shape.wordmarkSize >= 14 && shape.lockupInsideViewport,
          `${at}: the brand lockup remains legible and contained`,
          JSON.stringify(shape)
        );
        assert(shape.noHorizontalOverflow, `${at}: the page has no horizontal overflow`, JSON.stringify(shape));
        assert(shape.copyInsideHero, `${at}: landing copy stays within its grid region`, JSON.stringify(shape));
        if (width === 320 || width === 390) {
          assert(
            shape.ledeTop < shape.viewportHeight,
            `${at}: the introduction text starts on the first screen`,
            JSON.stringify(shape)
          );
          assert(
            shape.firstControlTop != null && shape.firstControlTop <= 1.15 * shape.viewportHeight,
            `${at}: the first control is within 1.15 screens`,
            JSON.stringify(shape)
          );
        }
        allErrors.push(...errors);
        await context.close();
      }
    }
  }

  // ---- The install banner's shape ----
  // Its action is a CTA, and a CTA is a full-width control. Beside the copy it
  // took the whole card, left the text column at its minimum width — one word
  // per line — and hung off the right edge, so the layout is measured here
  // rather than trusted.
  {
    console.log("\nThe install banner's shape");
    const cases = [
      { name: "Chromium", ua: ANDROID_UA, native: true, action: true },
      { name: "iOS Safari", ua: IOS_UA, native: false, action: true },
      { name: "another iOS browser", ua: IOS_CHROME_UA, native: false, action: false },
    ];
    for (const kase of cases) {
      for (const width of [320, 393]) {
        for (const locale of ["en-US", "pt-BR"]) {
          const { context, page, errors } = await bannerPage(browser, {
            ua: kase.ua,
            locale,
            width,
            native: kase.native,
          });
          const shape = await page.evaluate(bannerShape);
          const at = `${kase.name} ${width}px ${locale}`;
          assert(shape.shown, `${at}: the banner is offered`, JSON.stringify(shape));
          assert(
            shape.actionShown === kase.action,
            `${at}: it draws a button only where it has one to honour`,
            JSON.stringify({ shown: shape.actionShown, label: shape.actionLabel })
          );
          if (kase.action) {
            assert(
              shape.action.left >= shape.banner.left + shape.padding.left - 1 &&
                shape.action.right <= shape.banner.right - shape.padding.right + 1,
              `${at}: the button stays inside the card`,
              JSON.stringify({ action: shape.action, banner: shape.banner, padding: shape.padding })
            );
          }
          assert(
            shape.text.width >= shape.banner.width * 0.5,
            `${at}: the copy keeps a column at least half the card wide`,
            JSON.stringify({ text: shape.text.width, banner: shape.banner.width })
          );
          assert(
            shape.bodyLines <= 5 && shape.bodyLines < shape.bodyWords / 2,
            `${at}: the body sets as sentences, not one word per line`,
            JSON.stringify({ lines: shape.bodyLines, words: shape.bodyWords })
          );
          assert(
            !shape.copyOverlapsClose,
            `${at}: no copy runs under the dismiss control`,
            JSON.stringify({ text: shape.text, closeInk: shape.closeInk })
          );
          assert(
            shape.banner.left >= 0 && shape.banner.right <= shape.viewport.width && !shape.docOverflow,
            `${at}: the card and the page stay inside the viewport`,
            JSON.stringify(shape)
          );
          assert(
            shape.banner.height <= shape.viewport.height * 0.25,
            `${at}: the banner stays a toast over a working app`,
            JSON.stringify({ height: shape.banner.height, viewport: shape.viewport })
          );
          allErrors.push(...errors);
          await context.close();
        }
      }
    }
  }

  // ---- The manifest an Android install is minted from (ADR 0008) ----
  // Chrome ranks an "any"-sized SVG above every raster icon that does not match
  // the device's launcher size exactly, and an SVG primary icon drops the
  // install from a WebAPK to a browser shortcut. The mint itself happens on a
  // Google server and cannot be driven from here; what can be held is the file
  // it is handed.
  {
    console.log("\nThe install manifest");
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      userAgent: ANDROID_UA,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const read = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href");
      if (!href) return { href: null };
      const base = new URL(href, location.href);
      const res = await fetch(base, { cache: "no-store" });
      const manifest = await res.json();
      const icons = [];
      for (const icon of manifest.icons || []) {
        const entry = { src: icon.src, sizes: icon.sizes, type: icon.type, purpose: icon.purpose, status: 0 };
        try {
          const hit = await fetch(new URL(icon.src, base), { cache: "no-store" });
          entry.status = hit.status;
          entry.served = hit.headers.get("content-type") || "";
        } catch (err) {
          entry.error = String(err);
        }
        icons.push(entry);
      }
      return {
        href,
        ok: res.ok,
        display: manifest.display,
        start: manifest.start_url,
        scope: manifest.scope,
        hasExplicitId: Object.hasOwn(manifest, "id"),
        explicitId: manifest.id,
        icons,
      };
    });
    assert(read.ok, "the manifest the page links is served", JSON.stringify(read.href));
    assert(read.display === "standalone", "it asks for a standalone window", String(read.display));
    assert(!!read.start && !!read.scope, "it declares a start URL and a scope", JSON.stringify(read));
    // Relative manifest ids resolve from the start URL's origin, not from the
    // manifest's directory. On GitHub Pages, "./index.html" therefore means
    // /index.html rather than /repforge/index.html and changes the identity
    // Chrome sends to the WebAPK mint. With no id, the spec falls back to the
    // already-correct, manifest-relative start URL.
    assert(
      !read.hasExplicitId,
      "app identity inherits the project-scoped start URL",
      JSON.stringify({ id: read.explicitId, start: read.start })
    );
    assert(read.icons.length > 0, "it declares icons", JSON.stringify(read.icons));
    assert(
      read.icons.every((icon) => icon.status === 200),
      "every icon it declares is a file the server serves",
      JSON.stringify(read.icons.filter((icon) => icon.status !== 200))
    );
    assert(
      read.icons.every((icon) => !/^data:/i.test(icon.src)),
      "no icon is inlined as a data URI",
      JSON.stringify(read.icons.map((icon) => icon.src))
    );
    assert(
      read.icons.every(
        (icon) => icon.type === "image/png" && !/\.svg$/i.test(icon.src) && !/^any$/i.test(icon.sizes || "")
      ),
      "the install icons are raster, sized, and never an any-sized SVG",
      JSON.stringify(read.icons)
    );
    const anyPurpose = (icon) => !icon.purpose || icon.purpose.split(/\s+/).includes("any");
    assert(
      read.icons.some((icon) => icon.sizes === "192x192" && anyPurpose(icon)) &&
        read.icons.some((icon) => icon.sizes === "512x512" && anyPurpose(icon)),
      "192 and 512 are both offered for the home screen",
      JSON.stringify(read.icons)
    );
    assert(
      read.icons.some((icon) => (icon.purpose || "").split(/\s+/).includes("maskable")),
      "a maskable composition is offered for adaptive launchers",
      JSON.stringify(read.icons)
    );
    allErrors.push(...errors);
    await context.close();

    // Run the service worker's actual path helper with the GitHub Pages scope.
    // Root-only SHELL entries must still match requests under /repforge/ or the
    // corrected manifest can remain cache-first after a deploy.
    const swContext = {
      URL,
      self: {
        registration: { scope: "https://pedrochagasmaster.github.io/repforge/" },
        addEventListener() {},
      },
    };
    runInNewContext(SW_SOURCE, swContext);
    assert(
      swContext.shellPathname?.("/repforge/manifest.webmanifest") === "/manifest.webmanifest" &&
        swContext.shellPathname?.("/repforge/index.html") === "/index.html",
      "service-worker shell matching is relative to its project scope",
      JSON.stringify({
        manifest: swContext.shellPathname?.("/repforge/manifest.webmanifest"),
        index: swContext.shellPathname?.("/repforge/index.html"),
      })
    );
  }

  // ---- Shared setup mode across the same capability matrix ----
  // Standard no-link cases above stay unchanged. These extra pages keep their
  // own error list so a missing implementation cannot rewrite the no-link
  // "no uncaught page errors" check.
  {
    console.log("\nShared setup · iOS Safari");
    try {
      const { context, page, encoded } = await sharedInstallPage(browser, { ua: IOS_UA, payload: cloneFixture(MINIMAL_PAYLOAD) });
      assert(encoded?.ok, "shared iOS Safari: payload encodes", JSON.stringify(encoded));
      const shown = await page.evaluate(card);
      const gate = await page.evaluate(sharedGateSnapshot);
      assert(shown.heroTitle === "Your program is ready to train.", "shared iOS Safari: landing adapts to the received program", shown.heroTitle);
      assert(shown.section, "shared iOS Safari: install card remains", JSON.stringify(shown));
      assert(gate.startVisible && !gate.createVisible && !gate.importVisible, "shared iOS Safari: one Start this program row", JSON.stringify(gate));
      assert(gate.lede === "Review the program that was sent to you, then start it on this device.", "shared iOS Safari: review-before-start lede", gate.lede);
      assert(shown.create, "shared iOS Safari: Create still exists in the document", JSON.stringify(shown));
      await page.click("#firstRunContinue");
      await page.waitForTimeout(200);
      const after = await page.evaluate(sharedGateSnapshot);
      assert(after.startVisible && !after.install && !after.continueShown, "shared iOS Safari: Continue removes only the install offer", JSON.stringify(after));
      await context.close();
    } catch (err) {
      assert(false, "shared iOS Safari (uncaught)", String(err && err.stack || err));
    }
  }

  {
    console.log("\nShared setup · Chromium awaits value");
    try {
      const { context, page, encoded } = await sharedInstallPage(browser, { ua: ANDROID_UA, payload: cloneFixture(MINIMAL_PAYLOAD) });
      assert(encoded?.ok, "shared Chromium: payload encodes", JSON.stringify(encoded));
      await page.evaluate(() => window.__fireInstall());
      const gated = await page.evaluate(sharedGateSnapshot);
      assert(gated.startVisible && gated.gate && !gated.install,
        "shared Chromium: pre-activation proposal keeps Start and suppresses install before value", JSON.stringify(gated));
      await context.close();
    } catch (err) {
      assert(false, "shared Chromium awaiting value (uncaught)", String(err && err.stack || err));
    }
  }

  {
    console.log("\nShared setup · standalone");
    try {
      const { context, page, encoded } = await sharedInstallPage(browser, {
        ua: ANDROID_UA,
        standalone: true,
        payload: cloneFixture(MINIMAL_PAYLOAD),
      });
      assert(encoded?.ok, "shared standalone: payload encodes", JSON.stringify(encoded));
      const st = await page.evaluate(sharedGateSnapshot);
      assert(st.startVisible && !st.createVisible, "shared standalone: Start this program is the program control", JSON.stringify(st));
      assert(!st.install && !st.continueShown, "shared standalone: no install section", JSON.stringify(st));
      assert(st.lede === "Review the program that was sent to you, then start it on this device.", "shared standalone: review-before-start lede", st.lede);
      assert(!st.onboarding, "shared standalone: does not jump into the wizard", JSON.stringify(st));
      await context.close();
    } catch (err) {
      assert(false, "shared standalone (uncaught)", String(err && err.stack || err));
    }
  }

  {
    console.log("\nShared setup · Portuguese iOS Safari");
    try {
      const { context, page, encoded } = await sharedInstallPage(browser, {
        ua: IOS_UA,
        locale: "en-US",
        payload: cloneFixture(REPRESENTATIVE_PAYLOAD),
      });
      assert(encoded?.ok, "shared PT: payload encodes", JSON.stringify(encoded));
      const pt = await page.evaluate(sharedGateSnapshot);
      const shown = await page.evaluate(card);
      assert(shown.heroTitle === "Seu programa está pronto para treinar.", "shared PT: landing follows the payload language", shown.heroTitle);
      assert(pt.lede === "Revise o programa que enviaram para você e depois comece neste dispositivo.", "shared PT: review-before-start lede", pt.lede);
      assert(pt.startTitle === SHARED_COPY.pt.title, "shared PT: Start this program in Portuguese", pt.startTitle);
      await context.close();
    } catch (err) {
      assert(false, "shared PT (uncaught)", String(err && err.stack || err));
    }
  }

  {
    console.log("\nShared setup · 320px overflow");
    try {
      const long = cloneFixture(MINIMAL_PAYLOAD);
      long.program.meta.name = "Long name ".repeat(10).trim();
      const { context, page } = await sharedInstallPage(browser, {
        ua: IOS_UA,
        width: 320,
        payload: long,
      });
      const shape = await page.evaluate(heroShape);
      const gate = await page.evaluate(sharedGateSnapshot);
      assert(shape.noHorizontalOverflow, "shared 320px: page has no horizontal overflow", JSON.stringify(shape));
      assert(gate.startVisible && !gate.overflow, "shared 320px: long name does not overflow the gate", JSON.stringify(gate));
      await context.close();
    } catch (err) {
      assert(false, "shared 320px overflow (uncaught)", String(err && err.stack || err));
    }
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
