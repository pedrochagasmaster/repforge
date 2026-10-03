#!/usr/bin/env node
// Plan 056 P3 / Plan 064 R3i — Progress navigation: one tab row of five.
// Covers the old statsSeg migration map, exclusive selection across the five
// tabs, and the Program End block route into the single Review surface.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertServingApp } from "./browser.mjs";
import { seedProgram, seedProgramMeta, installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
await assertServingApp(base);
const browser = await chromium.launch();
const errors = [];

async function freshPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // The empty first boot persists its own first-run state; seeding before it
  // finishes lets that write land over the seeded program.
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const reg of regs) await reg.unregister();
    const keys = await caches?.keys?.() || [];
    for (const key of keys) await caches.delete(key);
    localStorage.clear();
  });
  await installSeedProgram(page);
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  // The tab bar can be display:none (landing/settings states); click via DOM.
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  return { context, page };
}

function snapOf(page) {
  return page.evaluate(() => ({
    tabs: [...document.querySelectorAll("#statsSeg button")].map((b) => ({
      seg: b.dataset.seg, selected: b.getAttribute("aria-selected"), active: b.classList.contains("active"),
    })),
    panels: {
      overview: document.querySelector("#segOverview")?.classList.contains("active") ?? false,
      review: document.querySelector("#segReview")?.classList.contains("active") ?? false,
      strength: document.querySelector("#segStrength")?.classList.contains("active") ?? false,
      volume: document.querySelector("#segVolume")?.classList.contains("active") ?? false,
      prs: document.querySelector("#segPRs")?.classList.contains("active") ?? false,
    },
    confirmOpen: !!document.querySelector("#endBlockConfirm")?.open,
    dialogOpen: !!document.querySelector("#blockReview")?.open,
  }));
}

// One-view sanity: Progress is one tab row of five, and exactly one tab is selected at a time.
{
  const { context, page } = await freshPage();
  const nav = await snapOf(page);
  assert.deepEqual(nav.tabs.map((b) => b.seg), ["overview", "strength", "volume", "prs", "review"], "one row carries Overview, Strength, Volume, PRs and Review");
  assert.equal(nav.panels.overview, true, "Overview panel is the default");
  const roles = await page.evaluate(() => ({
    role: document.querySelector("#statsSeg")?.getAttribute("role"),
    label: document.querySelector("#statsSeg")?.getAttribute("aria-label"),
    legacyGroup: !!document.querySelector("#statsEvidence"),
    tabRow: document.querySelector("#statsSeg")?.classList.contains("tabrow"),
  }));
  assert.equal(roles.role, "tablist");
  assert.ok(roles.label, "the tab row is labelled");
  assert.equal(roles.legacyGroup, false, "no second Evidence group remains");
  assert.equal(roles.tabRow, true, "the row is the shared tab row");

  // Every tab opens its own panel and deselects the others.
  for (const seg of ["volume", "strength", "prs", "review", "overview"]) {
    await page.click(`#statsSeg button[data-seg="${seg}"]`);
    const s = await snapOf(page);
    assert.equal(s.panels[seg], true, `${seg} opens its panel`);
    assert.deepEqual(s.tabs.filter((b) => b.selected === "true").map((b) => b.seg), [seg], `${seg} is the only selected tab`);
    assert.deepEqual(s.tabs.filter((b) => b.active).map((b) => b.seg), [seg], `${seg} is the only active tab`);
    assert.equal(Object.entries(s.panels).filter(([, open]) => open).length, 1, `${seg} is the only open panel`);
  }
  await context.close();
}

// R7 J-20: the Progress row is the WAI tabs pattern (tabpanels, roving tabindex, Left/Right/Home/End). The
// window and filter segments (Strength scope, Volume period, PR kind) and the day picker change one region and
// have no panels of their own, so they are toggle-button groups with aria-pressed, not tabs.
{
  const { context, page } = await freshPage();
  const model = await page.evaluate(() => [...document.querySelectorAll("#statsSeg [role=tab]")].map((tab) => {
    const panel = document.getElementById(tab.getAttribute("aria-controls") || "");
    return { seg: tab.dataset.seg, id: tab.id, tabindex: tab.getAttribute("tabindex"), controls: tab.getAttribute("aria-controls"),
      panelRole: panel?.getAttribute("role"), panelLabelledBy: panel?.getAttribute("aria-labelledby") };
  }));
  assert.equal(model.length, 5, "five tabs");
  assert.ok(model.every((tab) => tab.id && tab.controls && tab.panelRole === "tabpanel" && tab.panelLabelledBy === tab.id),
    `every tab controls a tabpanel that it labels: ${JSON.stringify(model)}`);
  assert.deepEqual(model.map((tab) => tab.tabindex), ["0", "-1", "-1", "-1", "-1"], "roving tabindex: only the selected tab is a tab stop");
  const state = () => page.evaluate(() => ({
    focus: document.activeElement?.dataset?.seg || document.activeElement?.id || "",
    selected: [...document.querySelectorAll("#statsSeg [role=tab]")].filter((b) => b.getAttribute("aria-selected") === "true").map((b) => b.dataset.seg),
    stops: [...document.querySelectorAll("#statsSeg [role=tab]")].filter((b) => b.tabIndex === 0).map((b) => b.dataset.seg),
  }));
  await page.focus('#statsSeg button[data-seg="overview"]');
  for (const [key, expected] of [["ArrowRight", "strength"], ["ArrowRight", "volume"], ["End", "review"], ["ArrowRight", "overview"],
    ["ArrowLeft", "review"], ["Home", "overview"]]) {
    await page.keyboard.press(key);
    const at = await state();
    assert.deepEqual([at.focus, at.selected, at.stops], [expected, [expected], [expected]], `${key} moves focus, selection and the tab stop to ${expected}: ${JSON.stringify(at)}`);
    assert.equal(await page.evaluate((seg) => document.getElementById(document.querySelector(`#statsSeg [data-seg="${seg}"]`).getAttribute("aria-controls")).classList.contains("active"), expected), true, `${expected}'s panel is the open one`);
  }
  const groups = await page.evaluate(() => ["#strengthScopeSeg", "#volumeScopeSeg", "#prFilterSeg", "#dayTabs"].map((selector) => {
    const group = document.querySelector(selector);
    return { selector, role: group?.getAttribute("role"), tabs: group?.querySelectorAll("[role=tab]").length, selectedAttr: group?.querySelectorAll("[aria-selected]").length };
  }));
  assert.ok(groups.every((g) => g.role === "group" && g.tabs === 0 && g.selectedAttr === 0),
    `the window, filter and day segments are groups of toggle buttons, not tablists: ${JSON.stringify(groups)}`);
  for (const [seg, group, attr] of [["strength", "#strengthScopeSeg", "scope"], ["volume", "#volumeScopeSeg", "vscope"], ["prs", "#prFilterSeg", "prf"]]) {
    await page.click(`#statsSeg button[data-seg="${seg}"]`);
    const buttons = await page.$$(`${group} button`);
    const pressed = () => page.evaluate((g) => [...document.querySelectorAll(`${g} button`)].map((b) => b.getAttribute("aria-pressed")), group);
    assert.deepEqual((await pressed()).filter((v) => v === "true").length, 1, `${group}: exactly one button is pressed`);
    await buttons[1].click();
    const after = await pressed();
    assert.deepEqual([after[0], after[1]], ["false", "true"], `${group}: pressing the second button moves the pressed state to it`);
    assert.equal(await page.evaluate(() => document.activeElement?.closest("[role=group]")?.id || ""), group.slice(1), `${group}: focus stays on the pressed button`);
    void attr;
  }
  await context.close();
}

// Migration map: legacy one-level seg values route correctly, unknown → Overview.
{
  const { context, page } = await freshPage();
  const mapped = await page.evaluate(() => {
    const panelId = { strength: "#segStrength", volume: "#segVolume", prs: "#segPRs" };
    const out = {};
    for (const seg of ["strength", "volume", "prs"]) {
      window.__repforgeStatsNav.setStatsSeg(seg);
      out[seg] = {
        tabActive: [...document.querySelectorAll("#statsSeg button")].filter((b) => b.classList.contains("active")).map((b) => b.dataset.seg).join() === seg,
        panel: document.querySelector(panelId[seg])?.classList.contains("active") ?? false,
      };
    }
    window.__repforgeStatsNav.setStatsSeg("unknown-legacy-value");
    out.unknown = {
      overviewSelected: document.querySelector('#statsSeg button[data-seg="overview"]')?.classList.contains("active"),
      overviewPanel: document.querySelector("#segOverview")?.classList.contains("active"),
    };
    window.__repforgeStatsNav.setStatsSeg("review");
    out.review = {
      reviewPanel: document.querySelector("#segReview")?.classList.contains("active"),
      reviewSelected: document.querySelector('#statsSeg button[data-seg="review"]')?.classList.contains("active"),
    };
    return out;
  });
  for (const seg of ["strength", "volume", "prs"]) {
    assert.equal(mapped[seg].tabActive, true, `legacy "${seg}" selects its tab`);
    assert.equal(mapped[seg].panel, true, `legacy "${seg}" shows its panel`);
  }
  assert.equal(mapped.unknown.overviewSelected, true, "unknown seg value returns to Overview");
  assert.equal(mapped.unknown.overviewPanel, true, "unknown seg value shows the Overview panel");
  assert.equal(mapped.review.reviewPanel, true, "legacy review maps onto the primary Review");
  await context.close();
}

// Program End block routes into the single Review surface — no competing dialog.
{
  const { context, page } = await freshPage();
  await page.evaluate(({ program, meta }) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    raw.program = program;
    raw.programMeta = meta;
    localStorage.setItem("repforge_v1", JSON.stringify(raw));
  }, { program: seedProgram(), meta: seedProgramMeta() });
  await installSeedProgram(page);
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  // The live Program control is the read-view "Review block" row; the old
  // #endBlock button is editor-wrap dead state removed later in the plan.
  await page.waitForSelector("#reviewBlockLink", { state: "visible", timeout: 10000 });
  await page.click("#reviewBlockLink");
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  const routed = await snapOf(page);
  assert.equal(routed.panels.review, true, "End block opens the single Review surface");
  assert.equal(routed.tabs.find((b) => b.seg === "review").active, true, "Review is the active tab");
  assert.equal(routed.confirmOpen, false, "the separate end-block confirm dialog does not open");
  assert.equal(routed.dialogOpen, false, "the separate block-review dialog does not open");
  const focusOk = await page.evaluate(() => document.activeElement === document.querySelector('#statsSeg button[data-seg="review"]'));
  assert.equal(focusOk, true, "focus lands on the Review tab");
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during navigation journeys");
await browser.close();
console.log("PASS: progress navigation (one tab row, migration map, End block route)");
