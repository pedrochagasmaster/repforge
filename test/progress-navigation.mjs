#!/usr/bin/env node
// Plan 056 P3 — two-level Progress navigation.
// Covers the old statsSeg migration map, the secondary Evidence group, and the
// Program End block route into the single Review surface.
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
    primary: [...document.querySelectorAll("#statsSeg button")].map((b) => ({
      seg: b.dataset.seg, selected: b.getAttribute("aria-selected"), active: b.classList.contains("active"),
    })),
    evidence: [...document.querySelectorAll("#statsEvidence button")].map((b) => ({
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

// One-view sanity: with no seeded state the primary group is Overview/Review
// and the Evidence group carries the three secondary views.
{
  const { context, page } = await freshPage();
  const nav = await snapOf(page);
  assert.deepEqual(nav.primary.map((b) => b.seg), ["overview", "review"], "primary tabs are Overview and Review");
  assert.deepEqual(nav.evidence.map((b) => b.seg), ["strength", "volume", "prs"], "Evidence group carries strength/volume/prs");
  assert.equal(nav.panels.overview, true, "Overview panel is the default");
  const roles = await page.evaluate(() => ({
    primaryRole: document.querySelector("#statsSeg")?.getAttribute("role"),
    evidenceRole: document.querySelector("#statsEvidence")?.getAttribute("role"),
    evidenceLabel: document.querySelector("#statsEvidence")?.getAttribute("aria-label"),
  }));
  assert.equal(roles.primaryRole, "tablist");
  assert.equal(roles.evidenceRole, "tablist");
  assert.ok(roles.evidenceLabel, "Evidence group is labelled");

  // Evidence selection activates its panel without becoming a primary task.
  await page.click('#statsEvidence button[data-seg="volume"]');
  let s = await snapOf(page);
  assert.equal(s.panels.volume, true, "Evidence volume opens its panel");
  assert.equal(s.evidence.find((b) => b.seg === "volume").selected, "true");
  assert.equal(s.primary.find((b) => b.seg === "overview").selected, "true", "primary selection unchanged while Evidence is open");

  // Returning to a primary task closes the Evidence view.
  await page.click('#statsSeg button[data-seg="review"]');
  s = await snapOf(page);
  assert.equal(s.panels.review, true, "primary Review opens the review panel");
  assert.equal(s.panels.volume, false, "Evidence panel closes");
  assert.equal(s.evidence.every((b) => b.selected === "false"), true, "Evidence tabs deselect");
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
        evidenceActive: [...document.querySelectorAll("#statsEvidence button")].some((b) => b.dataset.seg === seg && b.classList.contains("active")),
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
    assert.equal(mapped[seg].evidenceActive, true, `legacy "${seg}" maps onto the Evidence view`);
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
  assert.equal(routed.primary.find((b) => b.seg === "review").active, true, "Review is the active primary tab");
  assert.equal(routed.confirmOpen, false, "the separate end-block confirm dialog does not open");
  assert.equal(routed.dialogOpen, false, "the separate block-review dialog does not open");
  const focusOk = await page.evaluate(() => document.activeElement === document.querySelector('#statsSeg button[data-seg="review"]'));
  assert.equal(focusOk, true, "focus lands on the Review tab");
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during navigation journeys");
await browser.close();
console.log("PASS: progress navigation (two-level tabs, migration map, End block route)");
