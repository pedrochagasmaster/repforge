#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, loadManifest, capturePath, captureKey, screenKey } from "../tools/ui-screens/manifest.mjs";
import { criticalCaptures, sourceHead, validateCriticalReport } from "../tools/critical-ui.mjs";
import { observeCatalogFrame } from "../tools/capture-ui-screens.mjs";
import { comparePngFiles, comparePngBuffers } from "../tools/compare-ui-screens.mjs";
import { loadRoleInventory, validateRoleInventory, requiredBoundaryExceptionRequests } from "../tools/ui-system-core.mjs";
import { measureClampedHeadings, measureRenderedRoles, renderedRoleProblems } from "../tools/ui-system-rendered.mjs";
import { auditFocusRoles, inspectRoleCoverage } from "../tools/check-ui-system.mjs";
import { maybeStartLocalPreview } from "../tools/local-preview.mjs";
import { setCaptureBase, launchChromium, openPage, dismissChrome, settle } from "../tools/ui-screens/session.mjs";
import { APP_SCENARIOS, APP_CLOCK, APP_USER_AGENT, appState } from "../tools/ui-screens/screens-app.mjs";
import { ONBOARDING_SCENARIOS, onboardingState } from "../tools/ui-screens/screens-onboarding.mjs";

const manifest = loadManifest(), inventory = loadRoleInventory();
assert.deepEqual(validateRoleInventory(inventory, manifest), []);
const preview = await maybeStartLocalPreview([{ lane: "state" }], { cwd: ROOT });
setCaptureBase(preview.env.REPFORGE_URL);
process.env.REPFORGE_URL = preview.env.REPFORGE_URL;
const { runProgramEntryA11y } = await import("./program-entry-a11y.mjs");
const browser = await launchChromium();
const artifact = process.env.REPFORGE_ARTIFACT_DIR || mkdtempSync(join(tmpdir(), "critical-ui-"));
mkdirSync(artifact, { recursive: true });
const report = { schemaVersion: 1, kind: "critical-ui", source: sourceHead(), status: "failed", cells: [] };
try {
  // Deliberate defects exercise the same checker used below, with real pixels.
  const fault = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    const page = await fault.newPage();
    await page.setContent(`<style>body{margin:0;background:white}.glass{position:absolute;top:500px;left:20px;width:200px;height:60px;background:rgba(0,0,0,.8);backdrop-filter:blur(2px);color:#333}</style><button class="glass">Unreadable action</button>`);
    const baseline = await page.screenshot();
    const rendered = await page.evaluate(measureRenderedRoles, { requests: [{ selector: ".glass", kind: "text" }], pixels: baseline.toString("base64") });
    assert.ok(rendered.some(item => item.kind === "text" && item.status === "fail"), "DPR2 contrast defect over a low-page glass layer must fail the actual contrast measurement");
    await page.locator("button").evaluate(el => { el.textContent = "A changed action"; el.style.cssText = "position:absolute;top:20px;width:350px;height:300px;background:red;color:white;font-size:36px"; });
    assert.equal(comparePngBuffers(baseline, await page.screenshot()).ok, false, "real layout/copy defect fails pixel comparison");
    const coverage = await page.evaluate(inspectRoleCoverage, { key: "injected", components: [], exceptions: [], progressCandidateSelectors: [] });
    assert.ok(coverage.problems.some(p => p.includes("no inventory role")), "unknown controls fail live ownership");
  } finally { await fault.close(); }
  if (process.argv.includes("--checker-self-test")) {
    console.log("critical UI injected pixel/role/contrast defects rejected");
  } else {
    const semantics = new Map();
    const baselineSemantics = new Map(JSON.parse(readFileSync(join(ROOT, "docs/ui-screens/entry-semantics.json"))).captures.map(c => [c.key, c.semantic]));
    const scenarios = { ...APP_SCENARIOS, ...ONBOARDING_SCENARIOS };
    const protocolOnly = process.argv.includes("--protocol-self-test");
    const captures = criticalCaptures(manifest).filter(c => !protocolOnly || ["workout/why-manual", "settings/guides-replay"].includes(screenKey(c)));
    for (const capture of captures) {
      const key = screenKey(capture), id = captureKey(capture), onboarding = capture.flow.startsWith("onboarding");
      const cell = { key: id, status: "failed", problems: [] };
      let context;
      try {
        const opened = await openPage(browser, manifest, capture,
          onboarding ? onboardingState(key, capture.locale) : appState(key, capture.locale),
          { userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key] });
        context = opened.context;
        const page = opened.page;
        if (!onboarding) await dismissChrome(page);
        await scenarios[key](page);
        await settle(page);
        const whyOpener = key === "workout/why-manual"
          ? await page.locator("#workout .exercise.is-current [data-why]").getAttribute("data-why") : null;
        const out = capturePath(manifest, capture, join(artifact, "frames"));
        mkdirSync(join(out, ".."), { recursive: true });
        await observeCatalogFrame(page, capture, { out, semanticByKey: semantics });
        const png = readFileSync(out);
        cell.pixelDigest = createHash("sha256").update(png).digest("hex");
        const comparison = comparePngFiles(capturePath(manifest, capture), out);
        cell.pixelComparison = comparison.ok;
        if (!comparison.ok && !protocolOnly) cell.problems.push(...comparison.reasons);
        if (!comparison.ok && protocolOnly) console.log(`pixel diagnostic remains failed: ${id}: ${comparison.reasons.join(" | ")}`);
        cell.semanticComparison = !onboarding || JSON.stringify(semantics.get(id)) === JSON.stringify(baselineSemantics.get(id));
        if (!cell.semanticComparison) cell.problems.push("fresh semantics differ from committed selected frame");
        const coverage = await page.evaluate(inspectRoleCoverage, { key, components: inventory.components, exceptions: inventory.exceptions, progressCandidateSelectors: inventory.progressCandidateSelectors });
        cell.problems.push(...coverage.problems);
        const pixels = png.toString("base64");
        const rendered = await page.evaluate(measureRenderedRoles, { components: inventory.components, pixels });
        const boundaries = requiredBoundaryExceptionRequests(inventory.exceptions, key);
        if (boundaries.length) rendered.push(...await page.evaluate(measureRenderedRoles, { requests: boundaries, pixels }));
        const focus = await auditFocusRoles(page, { key, components: inventory.components, pixels });
        cell.roleMeasurements = rendered.length + focus.measurements.total;
        cell.problems.push(...focus.problems, ...renderedRoleProblems(key, rendered));
        if (key === "workout/why-manual") {
          const modal = await page.evaluate(() => {
            const el = document.querySelector("#whySheet");
            return { role: el?.getAttribute("role"), modal: el?.getAttribute("aria-modal"),
              name: document.getElementById(el?.getAttribute("aria-labelledby"))?.textContent.trim(),
              focused: el?.contains(document.activeElement), backgroundInert: document.querySelector("main")?.inert,
              opener: document.querySelector("#workout .exercise.is-current [data-why]")?.getAttribute("data-why") };
          });
          assert.ok(modal.role === "dialog" && modal.modal === "true" && modal.name && modal.focused && modal.backgroundInert && whyOpener && modal.opener === whyOpener,
            `Why modal semantics/focus/inertness: ${JSON.stringify(modal)}`);
          await page.locator("#whyOk").focus(); await page.keyboard.press("Tab");
          assert.ok(await page.evaluate(() => document.querySelector("#whySheet").contains(document.activeElement)), "Why Tab wraps inside");
          await page.locator("#whyClose").focus(); await page.keyboard.press("Shift+Tab");
          assert.ok(await page.evaluate(() => document.querySelector("#whySheet").contains(document.activeElement)), "Why reverse Tab wraps inside");
          await page.keyboard.press("Escape");
          await page.waitForSelector("#whySheet", { state: "hidden" });
          assert.ok(await page.evaluate(opener => document.activeElement?.getAttribute("data-why") === opener && !document.activeElement.closest("[inert]"), modal.opener),
            "Why Escape restores its live opener");
        }
        if (key === "settings/guides-replay") {
          const cue = '[data-guide-cue="privacy"]';
          assert.ok(await page.evaluate(selector => document.querySelector(selector)?.contains(document.activeElement), cue), "replayed guide receives focus");
          await page.keyboard.press("Escape");
          await page.waitForSelector(cue, { state: "detached" });
          assert.ok(await page.evaluate(() => document.activeElement?.matches('[data-guide-replay="privacy"]')), "guide Escape returns focus to Replay");
          assert.equal(await page.evaluate(() => window.__repforgeUi.guideState().privacy?.status), "dismissed", "guide Escape persists dismissal");
        }
        // Preserve small-phone geometry without another app boot.
        await page.setViewportSize(manifest.viewports["phone-320"]);
        await settle(page);
        cell.problems.push(...renderedRoleProblems(`${key}/320`, await page.evaluate(measureClampedHeadings)));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) cell.problems.push("document overflows at 320px");
        cell.status = cell.problems.length ? "failed" : "passed";
      } catch (error) { cell.problems.push(error.stack || error.message); }
      finally { await context?.close(); }
      report.cells.push(cell);
      console.log(`${cell.status}: ${id}${cell.problems.length ? `: ${cell.problems.join(" | ")}` : ""}`);
    }
    await runProgramEntryA11y(browser, (condition, name, detail) => assert.ok(condition, `${name}: ${JSON.stringify(detail)}`));
    if (report.cells.every(c => c.status === "passed")) report.status = "passed";
    if (protocolOnly) {
      assert.equal(report.status, "passed", "focused modal/guide/a11y diagnostic must pass");
      console.log("focused Why, guide replay and entry accessibility protocols passed");
    } else {
      writeFileSync(join(artifact, "ui-critical-report.json"), JSON.stringify(report, null, 2));
      assert.deepEqual(validateCriticalReport(report), [], "all declared representative frames must pass their initial execution");
    }
  }
} finally {
  await browser.close();
  preview.cleanup();
}
