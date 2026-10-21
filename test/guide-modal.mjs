#!/usr/bin/env node
// Contextual guides are a native modal <dialog> (owner decision, 2026-10-17).
// Every guide reuses the entry dialog: its title and body, one "Got it", focus
// on the title and kept inside, Escape and "Got it" record `dismissed`, which
// survives a reload, and Settings → Replay shows it again. The first-set guide
// waits for the lifter's first tap on the shelf and then applies that tap.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const EN = JSON.parse(readFileSync(new URL("../i18n-en.json", import.meta.url), "utf8"));
const UI_KEY = "repforge_ui_v1";
const browser = await launchChromium({ guides: "live" });
const errors = [];
let passed = 0;
const ok = (value, message, detail) => { assert.ok(value, `${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`); passed++; };

async function freshPage({ seed = true, ui = null, viewport = { width: 390, height: 844 }, text = 1 } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  if (text !== 1) await context.addInitScript((scale) => {
    const apply = () => { if (document.documentElement) document.documentElement.style.fontSize = `${scale * 100}%`; };
    apply();
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  }, text);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    if (value) localStorage.setItem(key, JSON.stringify(value));
  }, { key: UI_KEY, value: ui });
  if (seed) await installSeedProgram(page, { waitFor: (target) => waitForAppBoot(target, { base: BASE }) });
  else { await page.reload({ waitUntil: "domcontentloaded" }); await waitForAppBoot(page, { base: BASE }); }
  return { context, page };
}

/** Two frames: every queued render and guide decision has run. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const guideStatus = (page, id) => page.evaluate((guide) => window.__repforgeUi.guideState()[guide]?.status || "unseen", id);

/** The open guide dialog, read as the lifter and assistive technology meet it. */
async function readDialog(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector("dialog#guideDialog");
    const title = dialog?.querySelector(".entry-dialog__title");
    const body = dialog?.querySelector(".entry-dialog__body");
    const buttons = [...(dialog?.querySelectorAll("button") || [])];
    return {
      open: !!dialog?.open,
      modal: !!dialog?.matches(":modal"),
      guide: dialog?.dataset.guide || null,
      entryDialog: !!dialog?.classList.contains("entry-dialog"),
      labelledBy: !!title?.id && dialog?.getAttribute("aria-labelledby") === title.id,
      describedBy: !!body?.id && dialog?.getAttribute("aria-describedby") === body.id,
      title: title?.textContent || "",
      body: body?.textContent || "",
      buttons: buttons.map((button) => button.textContent.trim()),
      focusOnTitle: !!title && document.activeElement === title,
      cues: document.querySelectorAll(".guide-cue, [data-guide-cue]").length,
    };
  });
}

async function expectGuideDialog(page, id, label) {
  await page.waitForSelector(`dialog#guideDialog[open][data-guide="${id}"]`, { timeout: 10000 });
  const dialog = await readDialog(page);
  ok(dialog.modal && dialog.entryDialog, `${label}: the guide is a modal entry dialog`, dialog);
  ok(dialog.title === EN[`guide.${id}.title`] && dialog.body === EN[`guide.${id}.body`], `${label}: the dialog carries the guide's title and body`, dialog);
  ok(dialog.labelledBy && dialog.describedBy, `${label}: the dialog is named by its title and described by its body`, dialog);
  ok(JSON.stringify(dialog.buttons) === JSON.stringify([EN["why.ok"]]), `${label}: the one action is "Got it"`, dialog);
  ok(dialog.focusOnTitle, `${label}: focus starts on the title`, dialog);
  ok(dialog.cues === 0, `${label}: no inline guide cue is left in the document`, dialog);
  return dialog;
}

async function expectFocusTrapped(page, label) {
  const stops = [];
  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    stops.push(await page.evaluate(() => !!document.activeElement?.closest("dialog#guideDialog")));
  }
  ok(stops.every(Boolean), `${label}: Tab and Shift+Tab stay inside the dialog`, stops);
}

async function expectClosed(page, label) {
  await page.waitForFunction(() => !document.querySelector("dialog#guideDialog[open]"), undefined, { timeout: 5000 });
  ok(await page.evaluate(() => !document.querySelector("main")?.inert), `${label}: the page is live again`);
}

async function openProgress(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 10000 });
}

async function openReplay(page, id) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await settle(page);
  // Settings' own guides may open on arrival; this replay is about another one.
  while (await page.locator("dialog#guideDialog[open]").count()) {
    await page.click("#guideDialogOk");
    await expectClosed(page, "Settings arrival");
  }
  if (!(await page.locator("#guideReplayPanel.is-open").count())) await page.click("#guideReplayToggle");
  await page.waitForSelector("#guideReplayPanel.is-open");
  await page.click(`[data-guide-replay="${id}"]`);
}

// Progress: the arrival guide opens as the modal, traps focus, "Got it"
// dismisses it back to its anchor, the dismissal survives a reload, and Replay
// shows it again on the next visit.
{
  const { context, page } = await freshPage();
  await openProgress(page);
  await expectGuideDialog(page, "progress", "Progress");
  ok(await page.evaluate(() => !!document.querySelector("main")?.inert), "Progress: the page under the dialog is inert");
  await expectFocusTrapped(page, "Progress");
  await page.click("#guideDialogOk");
  await expectClosed(page, "Progress");
  ok(await guideStatus(page, "progress") === "dismissed", "Progress: Got it records dismissed");
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#statsSeg [data-seg="overview"]')),
    "Progress: focus returns to the guide's anchor");

  // Block transition, on the Review tab: Escape dismisses it too.
  await page.click('#statsSeg [data-seg="review"]');
  await expectGuideDialog(page, "block-transition", "Block transition");
  await page.keyboard.press("Escape");
  await expectClosed(page, "Block transition");
  ok(await guideStatus(page, "block-transition") === "dismissed", "Block transition: Escape records dismissed");
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#statsSeg [data-seg="review"]')),
    "Block transition: focus returns to the Review tab");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await openProgress(page);
  await page.click('#statsSeg [data-seg="review"]');
  await settle(page);
  ok(await page.locator("dialog#guideDialog[open]").count() === 0, "Progress: dismissed guides stay dismissed across a reload");

  await openReplay(page, "progress");
  await page.waitForFunction(() => window.__repforgeUi.guideState().progress?.status === "deferred");
  ok(await page.locator("dialog#guideDialog[open]").count() === 0, "Progress: a replay with no anchor on screen waits for it");
  await openProgress(page);
  // Progress reopens on the Review tab it was left on; Overview is the progress guide's moment.
  await page.click('#statsSeg [data-seg="overview"]');
  await expectGuideDialog(page, "progress", "Progress replay");
  await page.keyboard.press("Escape");
  await expectClosed(page, "Progress replay");
  await context.close();
}

// Settings: replay in place opens the dialog on its title, and closing it
// returns focus to the Replay control that asked for it.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => window.__repforgeShowSettings());
  await expectGuideDialog(page, "privacy", "Privacy");
  await expectFocusTrapped(page, "Privacy");
  await page.keyboard.press("Escape");
  await expectClosed(page, "Privacy");
  ok(await guideStatus(page, "privacy") === "dismissed", "Privacy: Escape records dismissed");

  await openReplay(page, "privacy");
  await expectGuideDialog(page, "privacy", "Privacy replay");
  await page.click("#guideDialogOk");
  await expectClosed(page, "Privacy replay");
  ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-guide-replay="privacy"]')),
    "Privacy replay: focus returns to the Replay control");

  // Backup, on opening the backup disclosure.
  await page.click("#dataBackupRow");
  await expectGuideDialog(page, "backup", "Backup");
  await page.click("#guideDialogOk");
  await expectClosed(page, "Backup");
  ok(await guideStatus(page, "backup") === "dismissed", "Backup: Got it records dismissed");
  await context.close();
}

// Entry: the chooser's guide opens over the hub.
{
  const { context, page } = await freshPage({ seed: false });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 20000 });
  await expectGuideDialog(page, "entry", "Entry");
  await page.click("#guideDialogOk");
  await expectClosed(page, "Entry");
  ok(await guideStatus(page, "entry") === "dismissed", "Entry: Got it records dismissed");
  await context.close();
}

/** Arrive in Focus with the first-set guide still to come. */
async function arriveInFocus(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workoutShell:not(.hidden) .focus-shelf .shelf__fieldbtn", { timeout: 15000 });
  await settle(page);
}

// First set (Q4): nothing opens on arrival. The first tap on a shelf field
// opens the guide before the tap does anything, and "Got it" then selects the
// field the lifter tapped.
{
  const { context, page } = await freshPage();
  await arriveInFocus(page);
  ok(await page.locator("dialog#guideDialog[open]").count() === 0, "First set: arriving in Focus opens no dialog");
  ok(await guideStatus(page, "first-set") === "unseen", "First set: arrival records nothing");
  const field = await page.evaluate(() => {
    const button = document.querySelector('.focus-shelf .shelf__fieldbtn[aria-pressed="false"]');
    return { field: button.dataset.shelfField, set: button.dataset.set };
  });
  const fieldSel = `.focus-shelf [data-shelf-field="${field.field}"][data-set="${field.set}"]`;
  await page.click(fieldSel);
  await expectGuideDialog(page, "first-set", "First set");
  ok(await page.locator(fieldSel).getAttribute("aria-pressed") === "false", "First set: the tap waits behind the dialog");
  await page.click("#guideDialogOk");
  await expectClosed(page, "First set");
  ok(await guideStatus(page, "first-set") === "dismissed", "First set: Got it records dismissed");
  ok(await page.locator(fieldSel).getAttribute("aria-pressed") === "true", "First set: the tapped field is selected after Got it");
  ok(await page.evaluate((sel) => document.activeElement === document.querySelector(sel), fieldSel), "First set: the tapped field has focus after Got it");

  // The next arrival belongs to the focus-utilities guide.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await arriveInFocus(page);
  await expectGuideDialog(page, "focus-utilities", "Focus utilities");
  await page.keyboard.press("Escape");
  await expectClosed(page, "Focus utilities");
  ok(await page.evaluate(() => document.activeElement === document.querySelector("#woOverflowBtn")), "Focus utilities: focus returns to its anchor");
  await context.close();
}

// First set (Q4) on a pad: the step the lifter tapped is applied after "Got it".
{
  const { context, page } = await freshPage();
  await arriveInFocus(page);
  const before = await page.locator(".focus-shelf button.shelf__fieldbtn[aria-pressed='true'] .shelf__val").textContent();
  await page.click('.focus-shelf .shelf__pad[data-dir="1"]');
  await expectGuideDialog(page, "first-set", "First set pad");
  ok(await page.locator(".focus-shelf button.shelf__fieldbtn[aria-pressed='true'] .shelf__val").textContent() === before, "First set pad: the step waits behind the dialog");
  await page.click("#guideDialogOk");
  await expectClosed(page, "First set pad");
  await page.waitForFunction((value) => document.querySelector(".focus-shelf button.shelf__fieldbtn[aria-pressed='true'] .shelf__val")?.textContent !== value, before, { timeout: 5000 });
  ok(true, "First set pad: the tapped step is applied after Got it");
  await context.close();
}

// Dark mode: the dialog takes the dark surface and ink tokens.
{
  const tokens = {};
  for (const theme of ["light", "dark"]) {
    const { context, page } = await freshPage({ ui: { theme, lang: "en" } });
    await openProgress(page);
    await expectGuideDialog(page, "progress", `Progress ${theme}`);
    tokens[theme] = await page.evaluate(() => {
      const dialog = document.querySelector("dialog#guideDialog");
      const probe = document.createElement("div");
      probe.style.cssText = "background:var(--surface);color:var(--ink)";
      dialog.append(probe);
      const expected = getComputedStyle(probe);
      const actual = getComputedStyle(dialog);
      const result = { background: actual.backgroundColor, color: actual.color, surface: expected.backgroundColor, ink: expected.color,
        resolved: window.__repforgeUi.resolvedTheme() };
      probe.remove();
      return result;
    });
    await context.close();
  }
  for (const theme of ["light", "dark"]) {
    const t = tokens[theme];
    ok(t.resolved === theme && t.background === t.surface && t.color === t.ink, `${theme}: the dialog draws the theme's surface and ink`, t);
  }
  ok(tokens.light.background !== tokens.dark.background, "Dark mode swaps the dialog's surface", tokens);
}

/** The guide is the entry dialog centred in the visible viewport over the whole scrim, wherever its control is. */
async function expectCentred(page, label) {
  // The view under the guide may still be playing its entrance (Progress fades in, Focus rises): read it at rest.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  const plain = await page.evaluate(() => {
    const dialog = document.querySelector("dialog#guideDialog"), box = dialog.getBoundingClientRect();
    return { backdrop: getComputedStyle(dialog, "::backdrop").backgroundColor,
      centre: Math.abs((box.top + box.bottom) / 2 - (visualViewport.offsetTop + visualViewport.height / 2)),
      fits: box.top >= 0 && box.bottom <= visualViewport.height };
  });
  ok(plain.backdrop !== "rgba(0, 0, 0, 0)" && plain.centre <= 1 && plain.fits, `${label}: the centred dialog over the whole scrim`, plain);
}

/** Click the centre of what `selector` draws, as a pointer would: whatever the top layer leaves under that point. */
async function tapAt(page, selector) {
  const box = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((node) => node.getClientRects().length);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  await page.mouse.click(box.x, box.y);
}

// Inertness: the page under the guide, the control it explains included, takes no tap and no key while the guide is up.
{
  const { context, page } = await freshPage();
  await openProgress(page);
  await expectGuideDialog(page, "progress", "Inert Progress");
  const seg = () => page.evaluate(() => document.querySelector("#statsSeg [aria-selected='true']")?.dataset.seg);
  const before = await seg();
  await tapAt(page, '#statsSeg [data-seg="overview"]');
  await tapAt(page, '#statsSeg [data-seg="strength"]');
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await settle(page);
  ok(await seg() === before && await page.locator('dialog#guideDialog[open][data-guide="progress"]').count() === 1
    && await guideStatus(page, "progress") === "shown", "Inert Progress: taps on its control and the tabs and keys on the title change nothing",
  { before, after: await seg() });
  await context.close();
}
{
  const { context, page } = await freshPage();
  await arriveInFocus(page);
  await page.locator('.focus-shelf .shelf__fieldbtn[data-shelf-field][aria-pressed="false"]').first().click();
  await expectGuideDialog(page, "first-set", "Inert first set");
  const logged = () => page.evaluate(() => Object.values(window.__repforgeWorkoutDraft.current().exercises)
    .flatMap((exercise) => Object.values(exercise.sets)).filter((set) => set.completion !== "pending").length);
  const before = await logged();
  await tapAt(page, ".focus-shelf .saveset");
  await tapAt(page, ".focus-shelf .saveset");
  await settle(page);
  ok(await logged() === before && await page.locator('dialog#guideDialog[open][data-guide="first-set"]').count() === 1,
    "Inert first set: tapping Log set through the guide logs nothing", { before, after: await logged() });
  await context.close();
}

// The held tap is carried out exactly once, whichever way the guide is closed.
for (const close of ["Got it", "Escape"]) {
  const { context, page } = await freshPage();
  await arriveInFocus(page);
  await page.evaluate(() => {
    // Bubbling to the document means the click reached its pad; the shelf may be rebuilt, the document is not.
    window.__padArrivals = 0;
    document.addEventListener("click", (event) => { if (event.target.closest?.(".focus-shelf .shelf__pad")) window.__padArrivals++; });
  });
  await page.click('.focus-shelf .shelf__pad[data-dir="1"]');
  await expectGuideDialog(page, "first-set", `Held tap (${close})`);
  ok(await page.evaluate(() => window.__padArrivals) === 0, `Held tap (${close}): the tap is held behind the guide`);
  if (close === "Escape") await page.keyboard.press("Escape"); else await page.click("#guideDialogOk");
  await expectClosed(page, `Held tap (${close})`);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await settle(page);
  ok(await page.evaluate(() => window.__padArrivals) === 1, `Held tap (${close}): the held tap reaches its pad exactly once`,
    await page.evaluate(() => window.__padArrivals));
  await context.close();
}

// At 200% text on a short phone the whole guide, its action included, is on screen.
for (const theme of ["light", "dark"]) {
  for (const guide of ["progress", "first-set"]) {
    const label = `${guide} ${theme} 375x667 text200`;
    const { context, page } = await freshPage({ ui: { theme, lang: "en" }, viewport: { width: 375, height: 667 }, text: 2 });
    if (guide === "progress") await openProgress(page);
    else {
      await arriveInFocus(page);
      await page.locator('.focus-shelf .shelf__fieldbtn[data-shelf-field][aria-pressed="false"]').first().click();
    }
    await expectGuideDialog(page, guide, label);
    const fit = await page.evaluate(() => {
      const panel = document.querySelector("dialog#guideDialog").getBoundingClientRect();
      const okButton = document.querySelector("#guideDialogOk").getBoundingClientRect();
      const height = visualViewport.height;
      return { panel: [panel.top, panel.bottom], ok: [okButton.top, okButton.bottom], height,
        fits: panel.top >= 0 && panel.bottom <= height && okButton.bottom <= panel.bottom && document.documentElement.scrollWidth <= innerWidth };
    });
    ok(fit.fits, `${label}: the panel and Got it are whole on screen`, fit);
    await context.close();
  }
}

// Placement: on Focus and Progress, in both themes, on a tall and a short phone, the guide is centred over the whole
// scrim.
for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  for (const theme of ["light", "dark"]) {
    const tag = `${theme} ${viewport.width}x${viewport.height}`;
    {
      const { context, page } = await freshPage({ ui: { theme, lang: "en" }, viewport });
      await arriveInFocus(page);
      await page.locator('.focus-shelf .shelf__fieldbtn[data-shelf-field][aria-pressed="false"]').first().click();
      await expectGuideDialog(page, "first-set", `First set ${tag}`);
      await expectCentred(page, `First set ${tag}`);
      await context.close();
    }
    {
      const { context, page } = await freshPage({ ui: { theme, lang: "en" }, viewport });
      await openProgress(page);
      await expectGuideDialog(page, "progress", `Progress ${tag}`);
      await expectCentred(page, `Progress ${tag}`);
      await context.close();
    }
  }
}

await browser.close();
assert.deepEqual(errors, [], "no page errors during guide dialog journeys");
console.log(`guide modal: ${passed} passed, 0 failed`);
