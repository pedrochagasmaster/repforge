#!/usr/bin/env node
/**
 * Journeys out: install, install transfer and privacy.
 *
 * Plan 064 R5. Every place the app offers a way out of the screen in front of
 * the lifter — to the install sheet, the install-transfer explanation, or the
 * Privacy disclosure — is driven here through production controls, and so is
 * the way back from each. The places are
 *
 *   the landing, first visit      the install card, the header install link, Privacy
 *   the landing, returning visit  the same three, after the landing has been seen
 *   Settings                      Install, Privacy, and Privacy from inside the transfer sheet
 *   the milestone banner          the third saved workout's install offer (install-policy cadence)
 *
 * and the ways back are the ✕, the primary action, the scrim and Escape.
 *
 * At every hand-off the suite asserts the same contract:
 *
 *   opens        the sheet takes its documented initial focus, is a named
 *                `aria-modal` dialog, and the whole background is inert
 *   contained    Tab and Shift+Tab never leave the sheet and reach every control
 *   closes       focus returns to the control that opened it, the background is
 *                exactly as inert as before, and the sheet is gone
 *   unchanged    scroll position, the landing (not re-shown, not re-marked), the
 *                view in front, and the install cadence in the device prefs
 *   quiet        nothing is written to a live region twice
 *
 * Install, transfer, privacy and telemetry behaviour is not asserted here; the
 * owning suites do that (install-modes, install-transfer-ui, privacy-ui). This
 * suite only holds the hand-off between a screen and those surfaces.
 *
 * Seeded failures. `--seed <name>` serves the page with one production hand-off
 * deliberately broken and the run is expected to fail; `--seeded` runs every
 * seed in turn and passes only when each one is caught by the check family it
 * breaks. That is the RED proof for this file.
 *
 * Run: node test/journeys-out.mjs [--seed name | --seeded]
 */
import { readFileSync } from "node:fs";
import { launchChromium } from "./browser.mjs";
import { MINIMAL_PAYLOAD } from "./fixtures/shared-setup.mjs";
import { APP_INDEX, encodeSharedPayload, openAppPage, waitForFirstRun } from "./shared-setup-flow.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/install-transfer-clone-v1.json", import.meta.url), "utf8"));
const TOKEN_SEGMENT = Buffer.alloc(32, 7).toString("base64url");
const TOKEN = `v1.k1.${TOKEN_SEGMENT}.${TOKEN_SEGMENT}.${TOKEN_SEGMENT}`;
const EXPIRES_AT = "2099-01-01T01:00:00.000Z";

const argv = process.argv.slice(2);
const seedArg = argv.includes("--seed") ? argv[argv.indexOf("--seed") + 1] : null;
const SEEDED = argv.includes("--seeded");

/**
 * Each seed rewrites one production hand-off in the served app.js. `anchor` must
 * occur exactly once, so a refactor that moves the code fails loudly instead of
 * leaving a seed that quietly breaks nothing. `family` is the check family that
 * has to notice.
 */
const SEEDS = {
  "focus-lost": {
    family: "focus-return",
    anchor: "const target=resolveReturnFocus(rec.returnFocus);",
    replace: "const target=null;",
  },
  "not-inert": {
    family: "inert",
    anchor: "    child.inert=true}}",
    replace: "    child.inert=false}}",
  },
  "landing-reshown": {
    family: "landing",
    anchor: "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;",
    replace:
      "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;\n      if(firstRunPending()&&!hasProgramContent())openFirstRun();",
  },
  "scroll-lost": {
    family: "scroll",
    anchor: "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;",
    replace:
      "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;\n      window.scrollTo({top:0});for(const n of document.querySelectorAll('#firstRun,#settings'))n.scrollTop=0;",
  },
  "announce-twice": {
    family: "announce",
    anchor: "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;",
    replace:
      "      restoreBodyInert(rec.prevInert);\n      if(activeModal===rec)activeModal=null;\n      announce('Closed');announce('Closed');",
  },
  "cadence-written": {
    family: "cadence",
    anchor: 'function closeIosInstallSheet(){\n  const sheet=$("#iosInstallSheet");',
    replace:
      'function closeIosInstallSheet(){\n  const sheet=$("#iosInstallSheet");try{recordInstallPolicyDismissal({milestone:0})}catch{}',
  },
};

// ---- results ---------------------------------------------------------------

const results = { passed: 0, failed: [] };
let failFast = false;
class FailFast extends Error {}
let group = null;
function flushGroup() {
  if (group && !failFast && !group.failed) console.log(`  ✓ ${group.name} (${group.passed} checks)`);
  group = null;
}
function check(family, condition, name, detail) {
  if (group) group[condition ? "passed" : "failed"]++;
  if (condition) {
    results.passed++;
    return;
  }
  results.failed.push({ family, name });
  console.log(`  ✗ [${family}] ${name}`);
  if (detail != null) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}
/** A seeded run stops after the hand-off that failed, having seen all of its checks. */
function settleGroup() {
  if (failFast && group?.failed) throw new FailFast();
}
/** Checks are reported per hand-off: one line when every check held, the failures otherwise. */
const phase = (name) => {
  flushGroup();
  group = { name, passed: 0, failed: 0 };
};

// ---- pages -----------------------------------------------------------------

let activeSeed = seedArg;
async function newContext(browser, { ua = IOS_UA, motion = false, seed = activeSeed, locale = "en-US", routes } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: ua,
    locale,
    hasTouch: true,
    reducedMotion: motion ? "no-preference" : "reduce",
    serviceWorkers: "block",
  });
  if (seed) {
    const spec = SEEDS[seed];
    if (!spec) throw new Error(`unknown seed ${seed}`);
    await context.route(/\/app\.js(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const parts = source.split(spec.anchor);
      if (parts.length !== 2) throw new Error(`seed ${seed}: anchor occurs ${parts.length - 1} times in app.js`);
      await route.fulfill({ response, body: parts.join(spec.replace) });
    });
  }
  if (routes) await routes(context);
  return context;
}

const bootedPage = async (page) => {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
};

/** A device that has never been used: the landing is the boot surface. */
async function landingPage(browser, { returning = false, motion = false } = {}) {
  const context = await newContext(browser, { motion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await bootedPage(page);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  await bootedPage(page);
  if (returning) {
    // The first landing render recorded entryLandingSeen; the next boot is a return.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
    await bootedPage(page);
  }
  return { context, page, errors };
}

/** A device past setup with `workouts` saved sessions. */
async function establishedPage(browser, { workouts = 1, motion = false, routes } = {}) {
  const durable = structuredClone(FIXTURE.durableState);
  const template = durable.log[0];
  for (let index = 2; index <= workouts; index++) {
    const date = `2026-09-${String(10 + index).padStart(2, "0")}`;
    durable.log.push({ ...template, session: `journey-${index}`, date, created: `${date}T18:00:00.000Z` });
  }
  const context = await newContext(browser, { motion, routes });
  await context.addInitScript((seededState) => {
    if (sessionStorage.getItem("journeys-out-seeded")) return;
    sessionStorage.setItem("journeys-out-seeded", "1");
    localStorage.setItem("repforge_v1", JSON.stringify({ ...seededState, _storageRevision: 4 }));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme: "light", tourDone: true }));
    localStorage.setItem("repforge_telemetry_enabled_v1", "false");
  }, durable);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await bootedPage(page);
  return { context, page, errors };
}

// ---- observation -----------------------------------------------------------

/** Everything a hand-off must leave alone, read in the page. */
const readWorld = () => {
  const cadenceKeys = ["installLastOfferedMilestone", "installLastOfferedAt", "installDismissedMilestone", "installDismissedAt"];
  const uiPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}");
    } catch {
      return {};
    }
  })();
  const scrolled = {};
  for (const node of document.querySelectorAll("*")) {
    if (node.scrollTop > 0) scrolled[node.id || `${node.tagName}.${node.className}`] = Math.round(node.scrollTop);
  }
  const root = document.querySelector("#firstRun");
  const body = [...document.body.children].filter((child) => !["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE"].includes(child.tagName));
  return {
    activeId: document.activeElement?.id || document.activeElement?.tagName || null,
    windowScroll: Math.round(window.scrollY),
    scrolled,
    landing: {
      shown: !!root && !root.classList.contains("hidden"),
      visit: root?.dataset.entryVisit || null,
      kind: root?.dataset.entryLanding || null,
      bodyMarked: document.body.classList.contains("is-firstrun"),
    },
    views: [...document.querySelectorAll(".view.active")].map((view) => view.id),
    inertIds: body.filter((child) => child.inert).map((child) => child.id || child.tagName),
    cadence: Object.fromEntries(cadenceKeys.map((key) => [key, uiPrefs[key] ?? null])),
    decision: window.__repforgeUi?.installPolicyDecision?.() ?? null,
    sheetOpenClass: document.body.classList.contains("is-sheet-open"),
  };
};

/** Observers that live for one hand-off: live-region writes and landing re-marks. */
const startWatching = () => {
  const watch = { writes: [], landing: [], hero: document.querySelector("#firstRunHeadline") };
  window.__journeysOut = watch;
  const regionOf = (node) => {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element?.closest?.('[aria-live], [role="status"], [role="alert"], #toast, #announcementHost') || null;
  };
  const live = new MutationObserver((records) => {
    for (const record of records) {
      const region = regionOf(record.target);
      if (!region) continue;
      const text = region.textContent.trim();
      if (text) watch.writes.push(`${region.id || region.className}: ${text}`);
    }
  });
  live.observe(document.body, { subtree: true, childList: true, characterData: true });
  const root = document.querySelector("#firstRun");
  const landing = new MutationObserver((records) => {
    for (const record of records) watch.landing.push(`${record.type}:${record.attributeName || "children"}`);
  });
  // The sheet inerts the landing on purpose; anything else touching its marks is a re-show.
  if (root) landing.observe(root, { attributes: true, attributeFilter: ["class", "hidden", "style", "data-entry-visit", "data-entry-landing", "data-entry-draft"], childList: true });
  watch.stop = () => {
    live.disconnect();
    landing.disconnect();
  };
};
const stopWatching = () => {
  const watch = window.__journeysOut;
  watch.stop();
  const root = document.querySelector("#firstRunHeadline");
  return { writes: watch.writes, landing: watch.landing, heroKept: watch.hero === root };
};

const MODAL_STOPS =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** The sheet's tab stops as a keyboard reaches them. */
const sheetStops = (selector) =>
  document.querySelector(selector) &&
  [...document.querySelector(selector).querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.closest("[hidden]") && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden" && node.getClientRects().length > 0)
    .map((node) => node.id);

const backgroundLeaks = ({ sheet, scrim }) => {
  const host = document.querySelector("#announcementHost");
  return [...document.body.children]
    .filter((child) => !["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE"].includes(child.tagName))
    .filter((child) => child !== host && child.id !== sheet && child.id !== scrim && !child.inert)
    .map((child) => child.id || child.tagName);
};

/** Tab and Shift+Tab around the whole sheet: focus never leaves it and every stop is reached. */
async function checkContained(page, family, label, sheet) {
  const stops = await page.evaluate(sheetStops, sheet);
  const inside = () => page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement), sheet);
  const visitedForward = new Set();
  let contained = true;
  for (let step = 0; step < stops.length + 2; step++) {
    await page.keyboard.press("Tab");
    contained &&= await inside();
    visitedForward.add(await page.evaluate(() => document.activeElement?.id));
  }
  const visitedBack = new Set();
  for (let step = 0; step < stops.length + 2; step++) {
    await page.keyboard.press("Shift+Tab");
    contained &&= await inside();
    visitedBack.add(await page.evaluate(() => document.activeElement?.id));
  }
  check(family, contained, `${label}: Tab and Shift+Tab never leave the sheet`);
  check(
    family,
    stops.every((id) => visitedForward.has(id) && visitedBack.has(id)),
    `${label}: both directions reach every control (${stops.join(", ")})`,
    { stops, visitedForward: [...visitedForward], visitedBack: [...visitedBack] }
  );
}

const DISMISS = {
  escape: async (page) => page.keyboard.press("Escape"),
  close: async (page, spec) => page.click(spec.closeButton),
  done: async (page, spec) => page.click(spec.doneButton),
  // The scrim covers the whole viewport and the sheet sits at its foot: the top corner is scrim.
  scrim: async (page) => page.mouse.click(8, 8),
};

/** Scroll the opener into view (and so the screen off its top), then read the world. */
async function prepareOpener(page, opener) {
  await page.evaluate((selector) => {
    const node = document.querySelector(selector);
    node.scrollIntoView({ block: "center" });
  }, opener);
  await page.waitForTimeout(120);
}

/**
 * One hand-off and its way back.
 *
 *   spec.name       label for the report
 *   spec.opener     selector of the control that opens the sheet
 *   spec.sheet      sheet selector, spec.scrim its scrim
 *   spec.initial    id that must hold focus on open
 *   spec.dismiss    how the lifter comes back: escape | close | done | scrim
 *   spec.surface    "landing" or "app"
 */
async function handoff(page, spec) {
  phase(spec.name);
  const sheet = spec.sheet.slice(1);
  const scrim = spec.scrim.slice(1);
  await prepareOpener(page, spec.opener);
  const before = await page.evaluate(readWorld);
  const openerId = spec.opener.slice(1);
  if (spec.scrolled) {
    check("scroll", before.windowScroll > 0 || Object.keys(before.scrolled).length > 0,
      `${spec.name}: the screen is scrolled when the sheet opens, so a lost position would show`, before.scrolled);
  }
  await page.evaluate(startWatching);

  await page.click(spec.opener);
  await page.waitForFunction((selector) => {
    const node = document.querySelector(selector);
    return node && !node.hidden && node.classList.contains("is-open");
  }, spec.sheet, { timeout: 8000 });
  await page.waitForTimeout(spec.motion ? 400 : 60);

  // ---- opens
  const open = await page.evaluate(
    ({ sheetSelector, sheetId, scrimId }) => {
      const dialog = document.querySelector(sheetSelector);
      const labelled = dialog.getAttribute("aria-labelledby");
      return {
        role: dialog.getAttribute("role"),
        modal: dialog.getAttribute("aria-modal"),
        name: labelled ? document.getElementById(labelled)?.textContent.trim() : "",
        activeId: document.activeElement?.id || document.activeElement?.tagName,
        insideSheet: dialog.contains(document.activeElement),
        inert: dialog.inert || document.getElementById(scrimId)?.inert || false,
        sheetOpen: document.body.classList.contains("is-sheet-open"),
      };
    },
    { sheetSelector: spec.sheet, sheetId: sheet, scrimId: scrim }
  );
  check("initial-focus", open.activeId === spec.initial, `${spec.name}: opens with focus on #${spec.initial}`, open.activeId);
  check("modal", open.role === "dialog" && open.modal === "true" && !!open.name, `${spec.name}: a named aria-modal dialog`, open);
  check("modal", !open.inert, `${spec.name}: the sheet itself is not inert`);
  const leaks = await page.evaluate(backgroundLeaks, { sheet, scrim });
  check("inert", leaks.length === 0, `${spec.name}: every background layer is inert`, leaks);
  if (spec.surface === "landing") {
    check("inert", await page.evaluate(() => document.querySelector("#firstRun").inert), `${spec.name}: the landing is inert behind the sheet`);
  }
  await checkContained(page, "trap", spec.name, spec.sheet);
  // Containment leaves focus wherever the cycle ended; come back to the initial control.
  await page.evaluate((id) => document.getElementById(id)?.focus({ preventScroll: true }), spec.initial);

  // ---- way back
  await DISMISS[spec.dismiss](page, spec);
  await page.waitForFunction((selector) => document.querySelector(selector).hidden === true, spec.sheet, { timeout: 8000 });
  await page.waitForTimeout(spec.motion ? 100 : 40);

  const after = await page.evaluate(readWorld);
  const watched = await page.evaluate(stopWatching);

  check("focus-return", after.activeId === openerId, `${spec.name}: focus returns to #${openerId}`, `focus is on ${after.activeId}`);
  check("inert", JSON.stringify(after.inertIds) === JSON.stringify(before.inertIds), `${spec.name}: the background is exactly as inert as before`, { before: before.inertIds, after: after.inertIds });
  check("inert", !after.sheetOpenClass, `${spec.name}: the page is released from the sheet`);
  check("scroll", after.windowScroll === before.windowScroll && JSON.stringify(after.scrolled) === JSON.stringify(before.scrolled),
    `${spec.name}: scroll is where it was`, { before: [before.windowScroll, before.scrolled], after: [after.windowScroll, after.scrolled] });
  check("landing", JSON.stringify(after.landing) === JSON.stringify(before.landing) && JSON.stringify(after.views) === JSON.stringify(before.views),
    `${spec.name}: the ${spec.surface === "landing" ? "landing is not re-shown" : "screen in front is unchanged and the landing stays away"}`,
    { before: [before.landing, before.views], after: [after.landing, after.views] });
  check("landing", watched.landing.length === 0 && watched.heroKept, `${spec.name}: the landing is not re-marked or rebuilt`, watched.landing);
  const duplicated = watched.writes.filter((write, index) => watched.writes.indexOf(write) !== index);
  check("announce", duplicated.length === 0, `${spec.name}: nothing is announced twice`, { writes: watched.writes });
  if (spec.cadence !== false) {
    check("cadence", JSON.stringify(after.cadence) === JSON.stringify(before.cadence) && JSON.stringify(after.decision) === JSON.stringify(before.decision),
      `${spec.name}: the install cadence is unchanged by opening and closing`, { before: before.cadence, after: after.cadence });
  }
  settleGroup();
  return { before, after, watched };
}

const INSTALL_SHEET = { sheet: "#iosInstallSheet", scrim: "#iosInstallScrim", closeButton: "#iosInstallClose", doneButton: "#iosInstallDone" };
const PRIVACY_SHEET = { sheet: "#privacySheet", scrim: "#privacyScrim", closeButton: "#privacyClose", doneButton: "#privacyClose" };

// ---- journeys --------------------------------------------------------------

/** The landing, from its three controls, in each way back. */
async function landingJourney(browser, { returning, motion = false }) {
  const tag = `${returning ? "returning" : "first-visit"} landing${motion ? " (full motion)" : ""}`;
  const { context, page, errors } = await landingPage(browser, { returning, motion });
  const visit = returning ? "returning" : "first";
  check("landing", (await page.evaluate(() => document.querySelector("#firstRun").dataset.entryVisit)) === visit, `${tag}: the landing in front is the ${visit} landing`);
  const trips = [
    { name: `${tag}: install card, back with Escape`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "escape" },
    { name: `${tag}: install card, back with the close button`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "close" },
    { name: `${tag}: install card, back with Done`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "done" },
    { name: `${tag}: install card, back with the scrim`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "scrim" },
    { name: `${tag}: header install link, back with Escape`, opener: "#firstRunInstallLink", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "escape" },
    { name: `${tag}: header install link, back with Done`, opener: "#firstRunInstallLink", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "done" },
    { name: `${tag}: Privacy, back with Escape`, opener: "#firstRunPrivacy", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "escape" },
    { name: `${tag}: Privacy, back with the close button`, opener: "#firstRunPrivacy", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "close" },
    { name: `${tag}: Privacy, back with the scrim`, opener: "#firstRunPrivacy", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "scrim" },
  ];
  for (const trip of trips) await handoff(page, { ...trip, surface: "landing", motion, scrolled: trip.opener === "#firstRunInstallAction" });
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

/** The landing a shared setup link opens is the same page with a gate on it; its way out is the same too. */
async function sharedGateJourney(browser) {
  const tag = "shared-link gate";
  const { context, page, errors } = await openAppPage(browser, { ua: IOS_UA });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  const encoded = await encodeSharedPayload(page, MINIMAL_PAYLOAD);
  check("landing", !!encoded?.ok, `${tag}: a setup link could be built`, encoded);
  await page.goto(`${APP_INDEX}?journeys-out=1#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
  await waitForFirstRun(page);
  const trips = [
    { name: `${tag}: Privacy, back with Escape`, opener: "#firstRunPrivacy", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "escape" },
    { name: `${tag}: Privacy, back with the close button`, opener: "#firstRunPrivacy", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "close" },
    { name: `${tag}: install card, back with Escape`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "escape" },
    { name: `${tag}: install card, back with Done`, opener: "#firstRunInstallAction", ...INSTALL_SHEET, initial: "iosInstallDone", dismiss: "done" },
  ];
  for (const trip of trips) {
    if (!(await page.isVisible(trip.opener))) {
      check("landing", false, `${trip.name}: the control is offered on the gate`);
      continue;
    }
    await handoff(page, { ...trip, surface: "landing", motion: true });
  }
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

const openSettings = async (page) => {
  await page.click("#openSettings");
  await page.waitForSelector("#settings.active", { timeout: 8000 });
  await page.waitForTimeout(150);
};

/** Settings: Install and Privacy, with the nested Privacy hand-off from inside the transfer sheet. */
async function settingsJourney(browser, { motion = false } = {}) {
  const tag = `Settings${motion ? " (full motion)" : ""}`;
  const { context, page, errors } = await establishedPage(browser, { workouts: 1, motion });
  await openSettings(page);
  const trips = [
    { name: `${tag}: Install (transfer), back with Escape`, opener: "#installApp", ...INSTALL_SHEET, initial: "installTransferStart", dismiss: "escape" },
    { name: `${tag}: Install (transfer), back with the close button`, opener: "#installApp", ...INSTALL_SHEET, initial: "installTransferStart", dismiss: "close" },
    { name: `${tag}: Install (transfer), back with the scrim`, opener: "#installApp", ...INSTALL_SHEET, initial: "installTransferStart", dismiss: "scrim" },
    { name: `${tag}: Privacy, back with Escape`, opener: "#privacyDetails", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "escape" },
    { name: `${tag}: Privacy, back with the close button`, opener: "#privacyDetails", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "close" },
    { name: `${tag}: Privacy, back with the scrim`, opener: "#privacyDetails", ...PRIVACY_SHEET, initial: "privacyClose", dismiss: "scrim" },
  ];
  for (const trip of trips) await handoff(page, { ...trip, surface: "app", motion, scrolled: true });
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

/**
 * Install -> Privacy -> back to Install -> back to the opener. The second hop is
 * the one that can forget who opened the first.
 */
async function nestedJourney(browser, { from, openerSelector, prepare, label }) {
  const tag = `${label}: Install, then its Privacy details`;
  phase(tag);
  const { context, page, errors } = await establishedPage(browser, { workouts: from === "banner" ? 3 : 1 });
  if (prepare) await prepare(page);
  for (const way of ["escape", "close"]) {
    await prepareOpener(page, openerSelector);
    const before = await page.evaluate(readWorld);
    const openerId = openerSelector.slice(1);
    await page.evaluate(startWatching);
    await page.click(openerSelector);
    await page.waitForSelector("#iosInstallSheet.is-open", { timeout: 8000 });
    await page.waitForTimeout(60);
    check("initial-focus", (await page.evaluate(() => document.activeElement?.id)) === "installTransferStart", `${tag} (${way}): the transfer sheet opens on its primary action`);

    await page.click("#installTransferPrivacy");
    await page.waitForSelector("#privacySheet.is-open", { timeout: 8000 });
    await page.waitForTimeout(60);
    check("initial-focus", (await page.evaluate(() => document.activeElement?.id)) === "privacyClose", `${tag} (${way}): Privacy opens on its close button`);
    const hidden = await page.evaluate(() => document.querySelector("#iosInstallSheet").hidden);
    check("modal", hidden, `${tag} (${way}): only one dialog is open at a time`);
    const leaks = await page.evaluate(backgroundLeaks, { sheet: "privacySheet", scrim: "privacyScrim" });
    check("inert", leaks.length === 0, `${tag} (${way}): everything but Privacy is inert`, leaks);

    if (way === "escape") await page.keyboard.press("Escape");
    else await page.click("#privacyClose");
    await page.waitForSelector("#iosInstallSheet.is-open", { timeout: 8000 });
    await page.waitForTimeout(60);
    const back = await page.evaluate(() => ({
      active: document.activeElement?.id,
      privacyHidden: document.querySelector("#privacySheet").hidden,
      state: document.querySelector("#iosInstallSheet").dataset.transferState,
    }));
    check("focus-return", back.active === "installTransferPrivacy", `${tag} (${way}): Privacy hands focus back to the control that opened it`, back);
    check("modal", back.privacyHidden && back.state === "eligible", `${tag} (${way}): the transfer sheet comes back in the state it left`, back);
    const leaksBack = await page.evaluate(backgroundLeaks, { sheet: "iosInstallSheet", scrim: "iosInstallScrim" });
    check("inert", leaksBack.length === 0, `${tag} (${way}): the background is inert again behind the transfer sheet`, leaksBack);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#iosInstallSheet").hidden === true, undefined, { timeout: 8000 });
    await page.waitForTimeout(60);
    const after = await page.evaluate(readWorld);
    const watched = await page.evaluate(stopWatching);
    check("focus-return", after.activeId === openerId, `${tag} (${way}): closing the transfer sheet returns focus to #${openerId}`, `focus is on ${after.activeId}`);
    check("inert", JSON.stringify(after.inertIds) === JSON.stringify(before.inertIds) && !after.sheetOpenClass, `${tag} (${way}): the page is released`, { before: before.inertIds, after: after.inertIds });
    check("scroll", after.windowScroll === before.windowScroll && JSON.stringify(after.scrolled) === JSON.stringify(before.scrolled), `${tag} (${way}): scroll is where it was`);
    check("landing", JSON.stringify(after.landing) === JSON.stringify(before.landing) && JSON.stringify(after.views) === JSON.stringify(before.views), `${tag} (${way}): the screen in front is unchanged and the landing stays away`);
    check("announce", watched.writes.length === new Set(watched.writes).size, `${tag} (${way}): nothing is announced twice`, { writes: watched.writes });
    check("cadence", JSON.stringify(after.cadence) === JSON.stringify(before.cadence), `${tag} (${way}): the install cadence is unchanged`, { before: before.cadence, after: after.cadence });
  }
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

/** The third-workout install offer: the banner is part of the cadence, so it is read, never written, here. */
async function bannerJourney(browser) {
  const tag = "milestone banner";
  const { context, page, errors } = await establishedPage(browser, { workouts: 3 });
  await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 8000 });
  const offered = await page.evaluate(readWorld);
  check("cadence", offered.cadence.installLastOfferedMilestone === 3 && offered.cadence.installLastOfferedAt > 0 && offered.cadence.installDismissedMilestone === null,
    `${tag}: the third workout offers the install once and records the offer`, offered.cadence);
  const trips = [
    { name: `${tag}: install action, back with Escape`, dismiss: "escape" },
    { name: `${tag}: install action, back with the close button`, dismiss: "close" },
    { name: `${tag}: install action, back with the scrim`, dismiss: "scrim" },
  ];
  for (const trip of trips) {
    await handoff(page, { ...trip, opener: "#installBannerAction", ...INSTALL_SHEET, initial: "installTransferStart", surface: "app" });
    check("landing", await page.evaluate(() => !document.querySelector("#installBanner").classList.contains("hidden")), `${trip.name}: the offer is still in front afterwards`);
  }
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

/** Declining to transfer, completing a transfer, and the way back from each. */
async function transferJourney(browser) {
  const tag = "transfer";
  let created = 0;
  const { context, page, errors } = await establishedPage(browser, {
    workouts: 3,
    routes: async (ctx) => {
      await ctx.route("**/v1/transfers", async (route) => {
        created++;
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({
          status: 201, contentType: "application/json", headers: { "cache-control": "no-store" },
          body: JSON.stringify({ token: TOKEN, expiresAt: EXPIRES_AT }),
        });
      });
      await ctx.route("**/v1/transfers/status", (route) => route.fulfill({
        status: 200, contentType: "application/json", headers: { "cache-control": "no-store" },
        body: JSON.stringify({ state: "available", expiresAt: EXPIRES_AT }),
      }));
    },
  });
  await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 8000 });

  phase(`${tag}: decline from the explanation, then Done`);
  await prepareOpener(page, "#installBannerAction");
  let before = await page.evaluate(readWorld);
  await page.evaluate(startWatching);
  await page.click("#installBannerAction");
  await page.waitForSelector("#iosInstallSheet.is-open");
  await page.waitForTimeout(60);
  await page.click("#installTransferContinue");
  await page.waitForFunction(() => document.querySelector("#iosInstallSheet").dataset.transferState === "manual");
  await page.waitForTimeout(60);
  let active = await page.evaluate(() => document.activeElement?.id);
  check("initial-focus", active === "iosInstallDone", `${tag}: declining moves focus to the instructions' primary action, not to nothing`, `focus is on ${active}`);
  const leaks = await page.evaluate(backgroundLeaks, { sheet: "iosInstallSheet", scrim: "iosInstallScrim" });
  check("inert", leaks.length === 0, `${tag}: the background stays inert across the state change`, leaks);
  await checkContained(page, "trap", `${tag}: instructions`, "#iosInstallSheet");
  await page.evaluate(() => document.getElementById("iosInstallDone").focus({ preventScroll: true }));
  await page.click("#iosInstallDone");
  await page.waitForFunction(() => document.querySelector("#iosInstallSheet").hidden === true);
  await page.waitForTimeout(40);
  let after = await page.evaluate(readWorld);
  let watched = await page.evaluate(stopWatching);
  check("focus-return", after.activeId === "installBannerAction", `${tag}: Done returns focus to the banner action`, `focus is on ${after.activeId}`);
  check("inert", JSON.stringify(after.inertIds) === JSON.stringify(before.inertIds), `${tag}: the page is released`, { before: before.inertIds, after: after.inertIds });
  check("announce", watched.writes.length === new Set(watched.writes).size, `${tag}: nothing is announced twice`, { writes: watched.writes });
  check("cadence", JSON.stringify(after.cadence) === JSON.stringify(before.cadence), `${tag}: declining the transfer leaves the cadence alone`, { before: before.cadence, after: after.cadence });

  phase(`${tag}: complete from the explanation, then Escape`);
  await prepareOpener(page, "#installBannerAction");
  before = await page.evaluate(readWorld);
  await page.evaluate(startWatching);
  await page.click("#installBannerAction");
  await page.waitForSelector("#iosInstallSheet.is-open");
  await page.waitForTimeout(60);
  const state = await page.evaluate(() => document.querySelector("#iosInstallSheet").dataset.transferState);
  check("initial-focus", state === "eligible", `${tag}: reopening the offer shows the explanation again`, state);
  await page.click("#installTransferStart");
  await page.waitForFunction(() => document.querySelector("#iosInstallSheet").dataset.transferState === "creating", undefined, { timeout: 4000 });
  await page.waitForTimeout(30);
  const busy = await page.evaluate(() => ({
    inside: document.querySelector("#iosInstallSheet").contains(document.activeElement),
    active: document.activeElement?.id || document.activeElement?.tagName,
  }));
  check("focus-return", busy.inside, `${tag}: while the transfer is being made, focus stays inside the sheet`, busy);
  await page.keyboard.press("Escape");
  check("modal", await page.evaluate(() => !document.querySelector("#iosInstallSheet").hidden), `${tag}: Escape does not abandon a transfer being made`);
  await page.waitForFunction(() => document.querySelector("#iosInstallSheet").dataset.transferState === "ready", undefined, { timeout: 8000 });
  await page.waitForTimeout(60);
  active = await page.evaluate(() => document.activeElement?.id);
  check("initial-focus", active === "iosInstallTitle", `${tag}: a ready transfer moves focus to its heading`, `focus is on ${active}`);
  const leaksReady = await page.evaluate(backgroundLeaks, { sheet: "iosInstallSheet", scrim: "iosInstallScrim" });
  check("inert", leaksReady.length === 0, `${tag}: the background stays inert once the transfer is ready`, leaksReady);
  await checkContained(page, "trap", `${tag}: ready`, "#iosInstallSheet");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#iosInstallSheet").hidden === true);
  await page.waitForTimeout(40);
  after = await page.evaluate(readWorld);
  watched = await page.evaluate(stopWatching);
  check("focus-return", after.activeId === "installBannerAction", `${tag}: Escape from a ready transfer returns focus to the banner action`, `focus is on ${after.activeId}`);
  check("inert", JSON.stringify(after.inertIds) === JSON.stringify(before.inertIds), `${tag}: the page is released`, { before: before.inertIds, after: after.inertIds });
  check("landing", JSON.stringify(after.landing) === JSON.stringify(before.landing), `${tag}: the landing stays away`);
  check("announce", watched.writes.length === new Set(watched.writes).size, `${tag}: nothing is announced twice`, { writes: watched.writes });
  check("cadence", JSON.stringify(after.cadence) === JSON.stringify(before.cadence), `${tag}: making a transfer leaves the cadence alone`, { before: before.cadence, after: after.cadence });
  check("cadence", created === 1, `${tag}: one explicit action made exactly one transfer`, created);
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

/** Chromium's own prompt: no sheet, but the same banner and the same promise to say things once. */
async function nativeJourney(browser) {
  const tag = "native install prompt";
  phase(tag);
  const durable = structuredClone(FIXTURE.durableState);
  const context = await newContext(browser, { ua: ANDROID_UA });
  await context.addInitScript((seededState) => {
    if (sessionStorage.getItem("journeys-out-seeded")) return;
    sessionStorage.setItem("journeys-out-seeded", "1");
    localStorage.setItem("repforge_v1", JSON.stringify({ ...seededState, _storageRevision: 4 }));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ theme: "light", tourDone: true }));
    localStorage.setItem("repforge_telemetry_enabled_v1", "false");
  }, durable);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message)));
  await page.addInitScript(() => {
    window.__promptCalls = 0;
    window.__fireInstall = () => {
      const event = new Event("beforeinstallprompt");
      event.prompt = () => { window.__promptCalls++; };
      event.userChoice = new Promise((resolve) => setTimeout(() => resolve({ outcome: "accepted" }), 10));
      window.dispatchEvent(event);
    };
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await bootedPage(page);
  await page.evaluate(() => { window.__fireInstall(); });
  await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 8000 });
  const offered = await page.evaluate(readWorld);
  await page.evaluate(startWatching);
  await page.click("#installBannerAction");
  await page.waitForFunction(() => window.__promptCalls === 1, undefined, { timeout: 8000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(readWorld);
  const watched = await page.evaluate(stopWatching);
  check("announce", watched.writes.filter((write) => /Installing/.test(write)).length === 1, `${tag}: an accepted install is announced exactly once`, watched.writes);
  check("announce", watched.writes.length === new Set(watched.writes).size, `${tag}: nothing is announced twice`, watched.writes);
  check("inert", after.inertIds.join() === offered.inertIds.join() && !after.sheetOpenClass, `${tag}: the page never goes inert for the browser's own prompt`, after.inertIds);
  check("landing", !after.landing.shown && JSON.stringify(after.views) === JSON.stringify(offered.views), `${tag}: the screen in front is unchanged and the landing stays away`);
  check("cadence", after.cadence.installDismissedMilestone === null && after.cadence.installLastOfferedMilestone === offered.cadence.installLastOfferedMilestone,
    `${tag}: accepting writes no dismissal and no second offer`, after.cadence);
  check("landing", errors.length === 0, `${tag}: no page errors`, errors);
  await context.close();
}

// ---- run -------------------------------------------------------------------

async function runAll(browser) {
  await landingJourney(browser, { returning: false });
  await landingJourney(browser, { returning: true });
  await landingJourney(browser, { returning: false, motion: true });
  await sharedGateJourney(browser);
  await settingsJourney(browser);
  await settingsJourney(browser, { motion: true });
  await nestedJourney(browser, {
    from: "settings", label: "Settings", openerSelector: "#installApp",
    prepare: async (page) => openSettings(page),
  });
  await nestedJourney(browser, { from: "banner", label: "Milestone banner", openerSelector: "#installBannerAction",
    prepare: async (page) => { await page.waitForSelector("#installBanner:not(.hidden)", { timeout: 8000 }); } });
  await bannerJourney(browser);
  await transferJourney(browser);
  await nativeJourney(browser);
}

const browser = await launchChromium();
let exitCode = 0;
try {
  if (SEEDED) {
    // Each seed is served in turn; the run stops at its first failed check and
    // that failure has to belong to the family the seed breaks.
    console.log("Journeys out: seeded hand-offs must be caught\n");
    const missed = [];
    for (const [name, spec] of Object.entries(SEEDS)) {
      results.failed = [];
      failFast = true;
      activeSeed = name;
      const log = console.log;
      console.log = () => {};
      try {
        await landingJourney(browser, { returning: false });
      } catch (error) {
        if (!(error instanceof FailFast)) {
          console.log = log;
          throw error;
        }
      } finally {
        console.log = log;
      }
      const caught = results.failed.find((failure) => failure.family === spec.family);
      console.log(`${caught ? "  ✓" : "  ✗"} seed ${name}: ${caught ? `caught by [${caught.family}] ${caught.name}` : `NOT caught (${results.failed.map((f) => f.family).join(", ") || "no failure"})`}`);
      if (!caught) missed.push(name);
    }
    failFast = false;
    exitCode = missed.length ? 1 : 0;
    console.log(missed.length ? `\n${missed.length} seed(s) went unnoticed: ${missed.join(", ")}` : `\nAll ${Object.keys(SEEDS).length} seeded hand-offs were caught.`);
  } else {
    console.log(`Journeys out${seedArg ? ` (seed: ${seedArg})` : ""}\nTarget: ${BASE}`);
    await runAll(browser);
    flushGroup();
    console.log(`\n${results.passed} passed, ${results.failed.length} failed`);
    exitCode = results.failed.length ? 1 : 0;
  }
} finally {
  await browser.close();
}
process.exit(exitCode);
