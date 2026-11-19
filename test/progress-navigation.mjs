#!/usr/bin/env node
// Progress Summary, pushed pages, migration routing and Program Review entry.
import assert from "node:assert/strict";
import { assertServingApp, launchChromium, openProgressPage } from "./browser.mjs";
import { seedProgram, seedProgramMeta, installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
await assertServingApp(base);
const browser = await launchChromium();
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
  await page.evaluate(program => {
    const exercise = program[0];
    localStorage.setItem("repforge_v1", JSON.stringify({ log: [{
      id: "navigation-set", session: "navigation-session", exerciseId: exercise.id,
      name: exercise.name, day: exercise.day, set: 1, work: true, date: new Date().toISOString().slice(0, 10), load: 40, reps: 8, rir: 2, warmup: false
    }] }));
  }, seedProgram());
  await installSeedProgram(page);
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  // The tab bar can be display:none (landing/settings states); click via DOM.
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  return { context, page };
}

function snapOf(page) {
  return page.evaluate(() => ({
    page: document.querySelector("#stats").dataset.page,
    panels: {
      profile: document.querySelector("#segProfile")?.classList.contains("active") ?? false,
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

// Summary links push exclusive pages and Back restores the opening control.
{
  const { context, page } = await freshPage();
  assert.equal((await snapOf(page)).page, "summary");
  assert.equal(await page.locator("#statsBack").isVisible(), false);
  assert.equal(await page.locator("#stats [role=tab], #stats [role=tabpanel]").count(), 0);
  for (const destination of ["strength", "volume", "prs", "review", "profile"]) {
    const link = page.locator(`#segOverview [data-open-page="${destination}"]`).first();
    const linked = await link.isVisible();
    // A program that has not started has no block Review link yet.
    if (destination !== "review") assert.equal(linked, true, `${destination} is discoverable on Summary`);
    await openProgressPage(page, destination);
    const state = await snapOf(page);
    assert.equal(state.panels[destination], true);
    assert.equal(Object.values(state.panels).filter(Boolean).length, 1);
    assert.equal(await page.locator("#statsBack").isVisible(), true);
    assert.ok((await page.locator("#statsTitle").innerText()).trim());
    assert.equal(await page.locator("#statsTitle").evaluate(el => el === document.activeElement), true);
    await page.locator("#statsBack").click();
    await page.waitForSelector('#stats[data-page="summary"]');
    if (linked) assert.equal(await link.evaluate(el => el === document.activeElement), true, "Back focuses the opening link");
  }
  await openProgressPage(page, "strength");
  await page.goBack();
  await page.waitForSelector('#stats[data-page="summary"]');
  await openProgressPage(page, "volume");
  await page.click('nav button[data-view="stats"]');
  await page.waitForSelector('#stats[data-page="summary"]');
  await context.close();
}

// Filter groups retain their toggle-button semantics.
{
  const { context, page } = await freshPage();
  const groups = await page.evaluate(() => ["#strengthScopeSeg", "#volumeScopeSeg", "#prFilterSeg", "#dayTabs"].map((selector) => {
    const group = document.querySelector(selector);
    return { selector, role: group?.getAttribute("role"), tabs: group?.querySelectorAll("[role=tab]").length, selectedAttr: group?.querySelectorAll("[aria-selected]").length };
  }));
  assert.ok(groups.every((g) => g.role === "group" && g.tabs === 0 && g.selectedAttr === 0),
    `the window, filter and day segments are groups of toggle buttons, not tablists: ${JSON.stringify(groups)}`);
  for (const [seg, group, attr] of [["strength", "#strengthScopeSeg", "scope"], ["volume", "#volumeScopeSeg", "vscope"], ["prs", "#prFilterSeg", "prf"]]) {
    await openProgressPage(page, seg);
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
        tabActive: document.querySelector("#stats").dataset.page === seg,
        panel: document.querySelector(panelId[seg])?.classList.contains("active") ?? false,
      };
    }
    window.__repforgeStatsNav.setStatsSeg("unknown-legacy-value");
    out.unknown = {
      overviewSelected: (document.querySelector("#stats")?.dataset.page === "summary"),
      overviewPanel: document.querySelector("#segOverview")?.classList.contains("active"),
    };
    window.__repforgeStatsNav.setStatsSeg("review");
    out.review = {
      reviewPanel: document.querySelector("#segReview")?.classList.contains("active"),
      reviewSelected: (document.querySelector("#stats")?.dataset.page === "review"),
    };
    return out;
  });
  for (const seg of ["strength", "volume", "prs"]) {
    assert.equal(mapped[seg].tabActive, true, `legacy "${seg}" opens its page`);
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
  assert.equal(routed.page, "review", "Review is the active page");
  assert.equal(routed.confirmOpen, false, "the separate end-block confirm dialog does not open");
  assert.equal(routed.dialogOpen, false, "the separate block-review dialog does not open");
  const focusOk = await page.evaluate(() => document.activeElement === document.querySelector("#statsTitle"));
  assert.equal(focusOk, true, "focus lands on the Review heading");
  await context.close();
}

// R7 J-10: the exercise page's scope and metric toggles re-render the page; each keeps focus on the same toggle.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => openExerciseView(JSON.parse(localStorage.getItem("repforge_v1")).program[0].id, "stats"));
  await page.waitForSelector("#exercise.view.active #exDetail [data-metric]", { timeout: 5000 });
  for (const selector of ['[data-metric="e1rm"]', '[data-scope="all-history"]', '[data-metric="top"]', '[data-scope="current-block"]']) {
    await page.locator(`#exDetail ${selector}`).click();

    const held = await page.evaluate((sel) => {
      const el = document.activeElement;
      return { matches: !!el?.matches?.(`#exDetail ${sel}`), pressed: el?.getAttribute?.("aria-pressed"), tag: el?.tagName };
    }, selector);
    assert.equal(held.matches, true, `the ${selector} toggle keeps focus after the chart re-renders (${JSON.stringify(held)})`);
    assert.equal(held.pressed, "true", `the focused ${selector} toggle is the one now pressed`);
  }
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during navigation journeys");
await browser.close();
console.log("PASS: progress navigation (Summary pages, migration map, End block route)");
