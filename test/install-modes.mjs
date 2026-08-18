#!/usr/bin/env node
/**
 * Install promotion and the first-run setup screen.
 *
 * The screen opens on every first run, because the program question is always
 * live there. What its install section says is decided by capabilities and
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
 * The ethos hero (ADR 0006) leads the gate in both languages; its strings are
 * locked here the way the install cards are — line breaks included, because the
 * block is set like a poem and the breaks are part of the copy — and its
 * illustration must stay decorative: painted by CSS, hidden from assistive
 * technology, never announced.
 *
 * The hero is also the one place in the app whose *shape* is copy: a wrapped
 * line is a broken line, so the last section drives the gate across phone
 * widths in both languages and counts the line boxes the poem actually
 * occupies against the breaks its string was written with.
 *
 * Two more sections cover the install offer outside first run:
 *
 *   the banner    measured across phone widths in both languages, because it
 *                 packs an icon, two paragraphs and a full-width CTA into a
 *                 toast — the copy has to keep a real measure and the button
 *                 has to stay inside the card
 *   the manifest  the file Chrome mints an Android WebAPK from: raster icons
 *                 only, all fetchable, 192 and 512 present (ADR 0008)
 *
 * Run: node test/install-modes.mjs   (with a static server on REPFORGE_URL)
 */
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

async function bannerPage(browser, { ua, locale = "en-US", width = 393, native = false } = {}) {
  const { context, page, errors } = await firstRunPage(browser, { ua, locale, width });
  await page.setInputFiles("#importProgram", {
    name: "program.json",
    mimeType: "application/json",
    buffer: Buffer.from(BANNER_PROGRAM),
  });
  await page.waitForSelector("#importReview.active", { timeout: 8000 });
  await page.click("#importCommit");
  await page.waitForFunction(() => document.querySelector("#firstRun").classList.contains("hidden"), undefined, {
    timeout: 8000,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  if (native) await page.evaluate(() => window.__fireInstall());
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
  heroBody: document.querySelector(".firstrun-hero__body")?.textContent || null,
  // The illustration is painted, not marked up, so nothing about it may reach a
  // screen reader: no alt text to read and no image element to announce.
  heroArtDecorative:
    [...document.querySelectorAll(".firstrun-hero img")].every((n) => n.getAttribute("alt") === "") &&
    (document.querySelector(".firstrun-hero__art")?.getAttribute("aria-hidden") === "true") &&
    !document.querySelector(".firstrun-hero__art")?.textContent.trim(),
  heroArtFile: (() => {
    const art = document.querySelector(".firstrun-hero__art");
    return art ? getComputedStyle(art).backgroundImage : null;
  })(),
  // The gate stands the mark on its paper, so it draws the ground-free
  // rendering and never the app icon, which carries a ground of its own.
  markSrc: document.querySelector(".firstrun__logo")?.getAttribute("src") || null,
});

// What the gate looks like, measured rather than described. The picture and
// copy use separate grid regions, so no line the passage was written with may
// wrap and no text can collide with the illustration. Compact screens stack
// title, art, and poem; wide screens give the art its own column. The complete
// export stays contained at its authored ratio, the page never grows wider
// than the viewport, and the enlarged brand row remains centred.
const heroShape = () => {
  const poem = document.querySelector(".firstrun-hero__body");
  const art = document.querySelector(".firstrun-hero__art");
  const title = document.querySelector(".firstrun-hero__title");
  const hero = document.querySelector(".firstrun-hero");
  const logo = document.querySelector(".firstrun__logo");
  const wordmark = document.querySelector(".firstrun__wordmark");
  const lede = document.querySelector(".firstrun__lede");
  const firstControl = document.querySelector("#firstRunInstallAction");
  const installLabel = document.querySelector("#firstRunInstallLabel");
  const installCard = document.querySelector("#firstRunInstallCard");
  const programLabel = document.querySelector("#firstRunProgramLabel");
  const rows = document.querySelector(".firstrun__rows");
  const continueButton = document.querySelector(".firstrun__continue");
  const row = document.querySelector(".firstrun__brand").getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(poem);
  const lineRects = [...range.getClientRects()].filter((r) => r.width > 0);
  const p = poem.getBoundingClientRect();
  const a = art.getBoundingClientRect();
  const t = title.getBoundingClientRect();
  const h = hero.getBoundingClientRect();
  const intersects = (one, two) =>
    one.left < two.right && one.right > two.left && one.top < two.bottom && one.bottom > two.top;
  return {
    // One rect per line box the poem occupies; the stanza breaks are empty
    // ones, and a wrapped line shows up as one more than was written.
    rendered: lineRects.length,
    written: poem.textContent.split("\n").filter((line) => line.trim()).length,
    poemSize: parseFloat(getComputedStyle(poem).fontSize),
    poemHeight: p.height,
    compact: matchMedia("(max-width:759px)").matches,
    titleAlign: getComputedStyle(title).textAlign,
    titleCentered: Math.abs((t.left + t.right) / 2 - (h.left + h.right) / 2) <= 1,
    artBeforePoem: a.bottom <= p.top + 1,
    artSeparated: !intersects(a, t) && !intersects(a, p),
    artInsideHero:
      a.left >= h.left - 1 && a.right <= h.right + 1 && a.top >= h.top - 1 && a.bottom <= h.bottom + 1,
    artInsideViewport: a.left >= -1 && a.right <= innerWidth + 1,
    artWidth: Math.round(a.width),
    artRatio: a.width / a.height,
    artContained: getComputedStyle(art).backgroundSize === "contain",
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    heroBottom: h.bottom,
    ledeTop: lede.getBoundingClientRect().top,
    firstControlTop: firstControl?.getBoundingClientRect().top ?? null,
    viewportHeight: innerHeight,
    leftEdges: {
      hero: h.left,
      title: t.left,
      poem: p.left,
      lede: lede.getBoundingClientRect().left,
      installLabel: installLabel.getBoundingClientRect().left,
      installCard: installCard.getBoundingClientRect().left,
      programLabel: programLabel.getBoundingClientRect().left,
      rows: rows.getBoundingClientRect().left,
      continueButton: continueButton.getBoundingClientRect().left,
    },
    logoWidth: Math.round(logo.getBoundingClientRect().width),
    wordmarkSize: parseFloat(getComputedStyle(wordmark).fontSize),
    // The tracked wordmark ends on a letter-space nothing fills, so the ink is
    // centred when this sits a pixel or two right of the column's middle.
    lockupOffset: Math.round(
      (logo.getBoundingClientRect().left + wordmark.getBoundingClientRect().right) / 2 -
        (row.left + row.right) / 2
    ),
  };
};

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
    assert(
      shown.heroTitle === "Strength isn't something you're born with.",
      "the ethos hero leads the gate",
      shown.heroTitle
    );
    assert(
      shown.heroBody ===
        "Challenge after challenge.\nDay after day.\nEvery time you go beyond\nwhat you thought possible," +
          "\nthe effort shapes you.\n\nIt becomes part of\nwho you are.\nAnd you become who you needed to be." +
          "\n\nStrength, then, is yours —\nnot because it was given to you,\nbut because you built it.",
      "the hero body carries the ethos, broken where it was written",
      JSON.stringify(shown.heroBody)
    );
    assert(shown.heroArtDecorative, "the hero art reaches no screen reader");
    assert(
      /assets\/brand\/milo-hero\.webp/.test(shown.heroArtFile || ""),
      "the illustration is the one the hero paints",
      shown.heroArtFile
    );
    assert(shown.markSrc === "assets/brand/mark.png", "the gate stands the ground-free mark on its paper", shown.markSrc);

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
    assert(st.lede === "Choose how you want to begin.", "the lede drops the install sentence", st.lede);
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
    assert(pt.heroTitle === "Força não vem de nascença.", "PT hero title", pt.heroTitle);
    assert(
      pt.heroBody ===
        "Desafio após desafio.\nDia após dia.\nToda vez que você vai além\ndo que julgava possível," +
          "\no esforço molda você.\n\nEle passa a fazer parte\nde quem você é.\nE você se torna quem precisou ser." +
          "\n\nA força, então, é sua —\nnão porque lhe foi dada,\nmas porque você a construiu.",
      "PT hero body",
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
      pt.body === "Abra pela Tela de Início, sem os controles do navegador.",
      "PT Chromium card body",
      pt.body
    );
    assert(pt.continueLabel === "Continuar no navegador", "PT Chromium escape hatch", pt.continueLabel);
    await context.close();
    allErrors.push(...errors);
  }

  // ---- The hero's shape, from compact phones through the wide composition ----
  {
    console.log("\nThe ethos hero's shape");
    const poemSizeAt759 = new Map();
    for (const width of [320, 390, 430, 759, 760, 768, 1024, 1280]) {
      for (const locale of ["en-US", "pt-BR"]) {
        const { context, page, errors } = await firstRunPage(browser, { ua: IOS_UA, locale, width });
        // The poem is measured in characters of a web font; measuring before it
        // arrives measures the fallback.
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        const shape = await page.evaluate(heroShape);
        const at = `${width}px ${locale}`;
        assert(
          shape.rendered === shape.written,
          `${at}: the poem keeps the breaks it was written with`,
          JSON.stringify(shape)
        );
        assert(shape.artSeparated, `${at}: text never overlaps the illustration`, JSON.stringify(shape));
        assert(
          shape.artInsideHero && shape.artInsideViewport && shape.artContained,
          `${at}: the complete illustration stays contained in the page`,
          JSON.stringify(shape)
        );
        assert(
          Math.abs(shape.artRatio - 1072 / 998) < 0.002,
          `${at}: the illustration keeps its original proportions`,
          JSON.stringify(shape)
        );
        if (width === 390) {
          assert(
            shape.artWidth >= 240,
            `${at}: the retained mobile illustration is at least 240px wide`,
            JSON.stringify(shape)
          );
        }
        assert(
          shape.compact ? shape.artBeforePoem : !shape.artBeforePoem,
          `${at}: the responsive hero uses the intended composition`,
          JSON.stringify(shape)
        );
        assert(
          shape.compact
            ? shape.titleAlign === "center" && shape.titleCentered
            : shape.titleAlign === "left",
          `${at}: the hero title follows the compact and wide alignment`,
          JSON.stringify({ align: shape.titleAlign, centered: shape.titleCentered })
        );
        assert(
          shape.logoWidth >= 62 && shape.wordmarkSize >= 21,
          `${at}: the brand lockup has deliberate prominence`,
          JSON.stringify(shape)
        );
        assert(shape.noHorizontalOverflow, `${at}: the page has no horizontal overflow`, JSON.stringify(shape));
        assert(
          Math.abs(shape.lockupOffset) <= 4,
          `${at}: the mark and the wordmark are centred on the column`,
          JSON.stringify(shape)
        );
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
        if (width === 759) poemSizeAt759.set(locale, shape.poemSize);
        if (width === 760) {
          assert(
            Math.abs(shape.poemSize - poemSizeAt759.get(locale)) < 1,
            `${at}: the poem size stays continuous across the breakpoint`,
            JSON.stringify({ at759: poemSizeAt759.get(locale), at760: shape.poemSize })
          );
        }
        if (width === 768 || width === 1280) {
          const edges = Object.values(shape.leftEdges);
          assert(
            Math.max(...edges) - Math.min(...edges) <= 1,
            `${at}: first-run content shares the hero's left edge`,
            JSON.stringify(shape.leftEdges)
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
      return { href, ok: res.ok, display: manifest.display, start: manifest.start_url, scope: manifest.scope, icons };
    });
    assert(read.ok, "the manifest the page links is served", JSON.stringify(read.href));
    assert(read.display === "standalone", "it asks for a standalone window", String(read.display));
    assert(!!read.start && !!read.scope, "it declares a start URL and a scope", JSON.stringify(read));
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
      assert(shown.heroTitle === "Strength isn't something you're born with.", "shared iOS Safari: ethos hero remains", shown.heroTitle);
      assert(shown.section, "shared iOS Safari: install card remains", JSON.stringify(shown));
      assert(gate.startVisible && !gate.createVisible && !gate.importVisible, "shared iOS Safari: one Start this program row", JSON.stringify(gate));
      assert(gate.lede === SHARED_COPY.en.lede, "shared iOS Safari: install-then-start lede", gate.lede);
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
    console.log("\nShared setup · Chromium native install");
    try {
      const { context, page, encoded } = await sharedInstallPage(browser, { ua: ANDROID_UA, payload: cloneFixture(MINIMAL_PAYLOAD) });
      assert(encoded?.ok, "shared Chromium: payload encodes", JSON.stringify(encoded));
      await page.evaluate(() => window.__fireInstall());
      await page.waitForSelector("#firstRunInstallAction", { timeout: 8000 });
      await page.click("#firstRunInstallAction");
      await page.waitForTimeout(300);
      const accepted = await page.evaluate(sharedGateSnapshot);
      assert(accepted.startVisible && accepted.gate && !accepted.install, "shared Chromium: accepted install leaves the shared action", JSON.stringify(accepted));
      await context.close();
    } catch (err) {
      assert(false, "shared Chromium accepted (uncaught)", String(err && err.stack || err));
    }
    try {
      const { context, page } = await sharedInstallPage(browser, { ua: ANDROID_UA, payload: cloneFixture(MINIMAL_PAYLOAD) });
      await page.evaluate(() => {
        window.__choice = "dismissed";
        window.__fireInstall();
      });
      await page.waitForSelector("#firstRunInstallAction", { timeout: 8000 });
      await page.click("#firstRunInstallAction");
      await page.waitForTimeout(300);
      const dismissed = await page.evaluate(sharedGateSnapshot);
      assert(dismissed.startVisible && dismissed.gate, "shared Chromium: dismissed prompt leaves the shared action", JSON.stringify(dismissed));
      await context.close();
    } catch (err) {
      assert(false, "shared Chromium dismissed (uncaught)", String(err && err.stack || err));
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
      assert(st.lede === SHARED_COPY.en.ledeInstalled, "shared standalone: installed lede", st.lede);
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
      assert(shown.heroTitle === "Força não vem de nascença.", "shared PT: hero follows the payload language", shown.heroTitle);
      assert(pt.lede === SHARED_COPY.pt.lede, "shared PT: lede before acceptance", pt.lede);
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
