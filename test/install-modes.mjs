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
    poemFill: Math.max(...lineRects.map((r) => r.width)) / p.width,
    compact: matchMedia("(max-width:759px)").matches,
    artBeforePoem: a.bottom <= p.top + 1,
    artSeparated: !intersects(a, t) && !intersects(a, p),
    artInsideHero:
      a.left >= h.left - 1 && a.right <= h.right + 1 && a.top >= h.top - 1 && a.bottom <= h.bottom + 1,
    artInsideViewport: a.left >= -1 && a.right <= innerWidth + 1,
    artWidth: Math.round(a.width),
    artRatio: a.width / a.height,
    artContained: getComputedStyle(art).backgroundSize === "contain",
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
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
    for (const width of [320, 390, 430, 759, 760, 768, 1024]) {
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
        assert(
          shape.poemFill >= 0.82,
          `${at}: the poem uses its available measure`,
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
        const minimumArtWidth =
          width === 320 ? 220 : width === 390 ? 270 : width === 430 ? 300 : width < 1024 ? 340 : 360;
        assert(
          shape.artWidth >= minimumArtWidth,
          `${at}: the illustration uses the available space`,
          JSON.stringify({ minimumArtWidth, ...shape })
        );
        assert(
          shape.compact ? shape.artBeforePoem : !shape.artBeforePoem,
          `${at}: the responsive hero uses the intended composition`,
          JSON.stringify(shape)
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
        allErrors.push(...errors);
        await context.close();
      }
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
