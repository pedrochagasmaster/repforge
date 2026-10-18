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

async function freshPage({ seed = true, ui = null, viewport = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
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
      entryDialog: !!dialog?.querySelector(":scope > .entry-dialog"),
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
      const dialog = document.querySelector("dialog#guideDialog .guide-dialog__panel");
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

/** Mean luminance of a page region, decoded in the page from a screenshot. */
async function regionLuma(page, clip) {
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data: px } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    return sum / (px.length / 4);
  }, png);
}

/** The guide's control is left out of the scrim, and the panel sits beside it rather than over it. */
async function expectAnchored(page, anchorSelector, label) {
  const geometry = await page.evaluate((selector) => {
    const dialog = document.querySelector("dialog#guideDialog");
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    const anchor = [...document.querySelectorAll(selector)].find((el) => el.getClientRects().length);
    return {
      anchored: dialog.classList.contains("is-anchored"),
      anchor: anchor && box(anchor),
      hole: box(dialog.querySelector(".guide-dialog__hole")),
      panel: box(dialog.querySelector(".guide-dialog__panel")),
      viewport: { height: innerHeight },
    };
  }, anchorSelector);
  const { anchor, hole, panel } = geometry;
  ok(geometry.anchored && anchor, `${label}: the dialog is placed on its anchor`, geometry);
  ok(hole.top <= anchor.top && hole.bottom >= anchor.bottom && hole.left <= anchor.left && hole.right >= anchor.right,
    `${label}: the cut-out holds the whole anchor`, geometry);
  ok(panel.bottom <= hole.top || panel.top >= hole.bottom, `${label}: the panel does not cover the cut-out`, geometry);
  ok(panel.top >= 0 && panel.bottom <= geometry.viewport.height, `${label}: the panel is on screen`, geometry);
  // The anchor looks the same with the guide up as with no guide at all, while the page beside the panel is dimmed.
  // The middle of the anchor: the panel's shadow may fall on its near edge.
  const w = anchor.right - anchor.left, h = anchor.bottom - anchor.top;
  const clip = { x: anchor.left + w / 4, y: anchor.top + h / 4, width: Math.max(1, w / 2), height: Math.max(1, h / 2) };
  const side = { x: 2, y: Math.round(geometry.viewport.height / 2), width: 8, height: 8 };
  const up = { anchor: await regionLuma(page, clip), side: await regionLuma(page, side) };
  await page.evaluate(() => { document.querySelector("dialog#guideDialog").style.display = "none"; });
  const bare = { anchor: await regionLuma(page, clip), side: await regionLuma(page, side) };
  await page.evaluate(() => { document.querySelector("dialog#guideDialog").style.display = ""; });
  ok(Math.abs(up.anchor - bare.anchor) < 1.5 && bare.side - up.side > 1, `${label}: the anchor is undimmed and the page around it is dimmed`, { up, bare });
}

// Highlight: the scrim leaves the anchor uncovered on Focus and Progress, in
// both themes, at a tall and a short phone.
for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  for (const theme of ["light", "dark"]) {
    const tag = `${theme} ${viewport.width}x${viewport.height}`;
    {
      const { context, page } = await freshPage({ ui: { theme, lang: "en" }, viewport });
      await arriveInFocus(page);
      await page.locator('.focus-shelf .shelf__fieldbtn[data-shelf-field][aria-pressed="false"]').first().click();
      await expectGuideDialog(page, "first-set", `First set ${tag}`);
      await expectAnchored(page, ".focus-shelf .saveset", `First set ${tag}`);
      await context.close();
    }
    {
      const { context, page } = await freshPage({ ui: { theme, lang: "en" }, viewport });
      await openProgress(page);
      await expectGuideDialog(page, "progress", `Progress ${tag}`);
      await expectAnchored(page, '#statsSeg [data-seg="overview"]', `Progress ${tag}`);
      await context.close();
    }
  }
}

// Without room beside its anchor the guide is the plain centred dialog over the whole scrim.
{
  const { context, page } = await freshPage({ viewport: { width: 390, height: 320 } });
  await openProgress(page);
  await expectGuideDialog(page, "progress", "Progress short");
  const plain = await page.evaluate(() => {
    const dialog = document.querySelector("dialog#guideDialog");
    return { anchored: dialog.classList.contains("is-anchored"), backdrop: getComputedStyle(dialog, "::backdrop").backgroundColor,
      hole: getComputedStyle(dialog.querySelector(".guide-dialog__hole")).display };
  });
  ok(!plain.anchored && plain.hole === "none" && plain.backdrop !== "rgba(0, 0, 0, 0)", "Progress short: no room falls back to the centred dialog", plain);
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], "no page errors during guide dialog journeys");
console.log(`guide modal: ${passed} passed, 0 failed`);
