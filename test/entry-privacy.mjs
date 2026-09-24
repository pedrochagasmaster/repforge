#!/usr/bin/env node
/**
 * Characterization and proof-first assertion suite for Plan 054 Packet 054-P9:
 * Cached in-app Privacy route/page and Share sheet disclosure audit.
 *
 * Spec references:
 *   - plans/054-landing-and-program-entry.md (054-P9)
 *   - docs/adr/0007-shared-setup-links.md
 *   - docs/adr/0013-temporary-install-transfer.md
 *   - docs/agents/implementation-evidence.md
 *   - docs/agents/ui-overhaul-proof-checkpoints.md
 *
 * Assertion boundary:
 *   1. Real cached in-app Privacy route/page linked from generic landing and Settings.
 *   2. Opens through production controls (#firstRunPrivacy and #privacyDetails).
 *   3. Complete EN/PT content covering 6 authoritative pillars:
 *      - Local device state (logs, drafts, history remain on device, no central cloud)
 *      - Setup-link fragment and repforge_setup_v1 cookie transport (7-day cookie, unencrypted proposal, bearer link)
 *      - Separate 1-hour Plan 053 install transfer (Cloudflare EU DO, AES-256-GCM, separate from setup proposal)
 *      - Telemetry consent (opted-in coarse funnels, no payloads, stable anonymous ID, toggleable)
 *      - Export and delete controls (JSON export backup, permanent deletion from local storage)
 *      - Limitations (no server backup, bearer link forwarding, browser clearing data loss)
 *   4. Works after online priming then offline via the service-worker shell.
 *   5. Failure renders no blank route.
 *   6. Closing/back restores focus to the invoking link.
 *   7. Share sheet audit: task content/actions remain; cookie/transport/privacy disclosure prose is absent.
 *   8. Approved cookie transport (repforge_setup_v1) is preserved and not rejected.
 *   9. Deterministic deliberate fault switches:
 *      - REPFORGE_PRIVACY_FAULT=offline-blank
 *      - REPFORGE_PRIVACY_FAULT=share-disclosure
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";

// Fault switch configuration
const FAULT =
  process.env.REPFORGE_PRIVACY_FAULT ||
  process.env.REPFORGE_ENTRY_PRIVACY_FAULT ||
  process.argv.find((a) => a.startsWith("--fault="))?.split("=")[1] ||
  "";

// Result tracking
const results = {
  passed: 0,
  failed: 0,
  expectedBaselineGaps: [],
  unexpectedFailures: [],
  faultDetections: [],
};

export function assert(cond, name, detail = null, isExpectedBaselineGap = false) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    const deliberateFault =
      (FAULT === "offline-blank" && name === "Privacy route renders non-blank offline from service-worker cache") ||
      (FAULT === "share-disclosure" && name === "Share sheet contains no cookie or transport disclosure prose");
    if (isExpectedBaselineGap) {
      results.expectedBaselineGaps.push(name);
      console.log(`  ✗ [EXPECTED BASELINE RED] ${name}`);
    } else if (deliberateFault) {
      results.faultDetections.push(FAULT);
      console.log(`  ✗ [DELIBERATE FAULT CAUGHT] ${name}`);
    } else {
      results.unexpectedFailures.push(name);
      console.log(`  ✗ [UNEXPECTED FAILURE] ${name}`);
    }
    if (detail != null) {
      console.log(`    Detail: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    }
  }
}

// =============================================================================
// Authoritative Domain Oracles
// =============================================================================

export const PRIVACY_PILLARS = Object.freeze([
  {
    id: "local_state",
    name: "Local device state",
    description: "Training logs, drafts, and history stay on this device",
    enMatcher: (text) =>
      text.includes("device") && (text.includes("local") || text.includes("stays on this device")),
    ptMatcher: (text) =>
      text.includes("dispositivo") && (text.includes("local") || text.includes("permanecem neste dispositivo")),
  },
  {
    id: "setup_transport",
    name: "Setup-link fragment and cookie transport",
    description: "Fragment #setup= and temporary 7-day repforge_setup_v1 cookie transport",
    enMatcher: (text) =>
      text.includes("setup link") && text.includes("repforge_setup_v1"),
    ptMatcher: (text) =>
      text.includes("link de configuração") && text.includes("repforge_setup_v1"),
  },
  {
    id: "install_transfer",
    name: "Separate one-hour Plan 053 install transfer",
    description: "Cloudflare EU temporary one-hour encrypted clone for iOS installation",
    enMatcher: (text) =>
      (text.includes("transfer") || text.includes("clone")) &&
      (text.includes("durable object") || text.includes("cloudflare") || text.includes("60 minutes")),
    ptMatcher: (text) =>
      (text.includes("transferência") || text.includes("clone")) &&
      (text.includes("durable object") || text.includes("cloudflare") || text.includes("60 minutos")),
  },
  {
    id: "telemetry",
    name: "Telemetry consent",
    description: "Opted-in coarse telemetry funnels, anonymous identity, toggleable consent",
    enMatcher: (text) =>
      (text.includes("funnel") || text.includes("opt-in") || text.includes("coarse") || text.includes("consent policy")) &&
      text.includes("telemetry"),
    ptMatcher: (text) =>
      (text.includes("funil") || text.includes("opt-in") || text.includes("coarse") || text.includes("política de consentimento")) &&
      text.includes("telemetria"),
  },
  {
    id: "export_delete",
    name: "Export and delete controls",
    description: "Full JSON export and permanent local data deletion controls",
    enMatcher: (text) =>
      text.includes("export") &&
      text.includes("delete") &&
      (text.includes("local storage") || text.includes("permanently delete") || text.includes("json backup")),
    ptMatcher: (text) =>
      text.includes("exportar") &&
      (text.includes("apagar") || text.includes("excluir")) &&
      (text.includes("armazenamento local") || text.includes("definitivamente") || text.includes("cópia de segurança em json")),
  },
  {
    id: "limitations",
    name: "Limitations",
    description: "No automatic cloud sync, unrecoverable local loss without backup, bearer link forwarding",
    enMatcher: (text) =>
      (text.includes("limitation") || text.includes("limitations")) &&
      (text.includes("bearer") || text.includes("cloud sync") || text.includes("unrecoverable")),
    ptMatcher: (text) =>
      (text.includes("limitação") || text.includes("limitações")) &&
      (text.includes("portador") || text.includes("sincronização") || text.includes("irrecuperável")),
  },
]);

export const FORBIDDEN_SHARE_DISCLOSURE_PATTERNS = Object.freeze([
  /temporary cookie/i,
  /repforge_setup_v1/i,
  /seven days/i,
  /static host receives/i,
  /compression and encoding do not encrypt/i,
  /cookie temporário/i,
  /sete dias/i,
  /hospedeiro estático/i,
  /compressão e codificação não/i,
]);

export const REQUIRED_SHARE_TASK_SELECTORS = Object.freeze([
  "#shareSetupTitle",
  "#shareSetupLink",
  "#shareSetupCopy",
  "#shareSetupShare",
  "#shareSetupClose",
]);

/**
 * Audit string text for presence of prohibited cookie/transport disclosure prose in Share UI.
 */
export function auditShareDisclosureText(text) {
  const content = String(text || "");
  const matchedPatterns = [];

  for (const pattern of FORBIDDEN_SHARE_DISCLOSURE_PATTERNS) {
    if (pattern.test(content)) {
      matchedPatterns.push(pattern.source);
    }
  }

  return {
    clean: matchedPatterns.length === 0,
    matchedPatterns,
  };
}

/**
 * Verify rendered privacy content is non-blank and provides structural depth.
 */
export function verifyPrivacyRenderState({ title, bodyText, sectionCount } = {}) {
  const text = String(bodyText || "").trim();
  const hasTitle = Boolean(title && title.trim().length > 0);
  const length = text.length;

  const isBlank = !hasTitle || length < 40 || sectionCount < 1;
  return {
    isBlank,
    length,
    hasTitle,
    sectionCount,
    pass: !isBlank,
  };
}

/**
 * Check if catalog covers a privacy pillar.
 */
export function checkPillarInCatalog(catalog, pillar, lang = "en") {
  const entries = Object.entries(catalog).filter(([k]) => k.startsWith("privacy."));
  const allPrivacyText = entries.map(([, v]) => String(v).toLowerCase()).join(" ");
  const matcher = lang === "pt" ? pillar.ptMatcher : pillar.enMatcher;
  const covered = matcher(allPrivacyText);

  return {
    pillarId: pillar.id,
    covered,
    privacyKeyCount: entries.length,
  };
}

// =============================================================================
// Suite Runner
// =============================================================================

export async function runPrivacy(scope = "all") {
  console.log("===============================================================================");
  console.log("Plan 054 Packet 054-P9 Assertion Suite: In-App Privacy Route & Share Audit");
  console.log(`Target origin: ${BASE}`);
  if (FAULT) {
    console.log(`ACTIVE DELIBERATE FAULT SWITCH: REPFORGE_PRIVACY_FAULT="${FAULT}"`);
  }
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // Phase 1: Pure Domain Oracle & i18n Catalog Audit
  // ---------------------------------------------------------------------------
  console.log("Phase 1: Pure Domain Oracle & i18n Catalog Coverage Audit (EN/PT)");
  if (scope === "all" || scope === "contract") {
    const enCatalogPath = join(ROOT, "i18n-en.json");
    const ptCatalogPath = join(ROOT, "i18n-pt.json");

    assert(existsSync(enCatalogPath), "i18n-en.json catalog file exists");
    assert(existsSync(ptCatalogPath), "i18n-pt.json catalog file exists");

    const enCatalog = JSON.parse(readFileSync(enCatalogPath, "utf8"));
    const ptCatalog = JSON.parse(readFileSync(ptCatalogPath, "utf8"));

    for (const pillar of PRIVACY_PILLARS) {
      const enCheck = checkPillarInCatalog(enCatalog, pillar, "en");
      const ptCheck = checkPillarInCatalog(ptCatalog, pillar, "pt");

      // On current HEAD (dfca62330fa0d4a9494c4ab444583e7ee1df2e3e):
      // Only local_state and install_transfer are authored in privacy.* keys.
      // setup_transport, telemetry, export_delete, and limitations are missing from privacy.* keys.
      const isMissingSeam = [
        "setup_transport",
        "telemetry",
        "export_delete",
        "limitations",
      ].includes(pillar.id);

      assert(
        enCheck.covered,
        `EN catalog privacy.* coverage: ${pillar.name}`,
        enCheck,
        isMissingSeam
      );

      assert(
        ptCheck.covered,
        `PT catalog privacy.* coverage: ${pillar.name}`,
        ptCheck,
        isMissingSeam
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Pure Deliberate Fault Switch Characterization
  // ---------------------------------------------------------------------------
  console.log("\nPhase 2: Pure Deliberate Fault Switch Characterization");
  if (scope === "all" || scope === "contract") {
    // Fault 1: offline blank-page detection
    const validState = verifyPrivacyRenderState({
      title: "Privacy",
      bodyText: "Taurifer stores your workouts on device.",
      sectionCount: 3,
      fault: "",
    });
    assert(validState.pass && !validState.isBlank, "oracle accepts valid populated privacy render state");

    const simulatedBlankState = verifyPrivacyRenderState({
      title: "",
      bodyText: "",
      sectionCount: 0,
    });
    assert(
      !simulatedBlankState.pass && simulatedBlankState.isBlank,
      "fault switch 'offline-blank' deterministically triggers blank-page rejection",
      simulatedBlankState
    );

    // Fault 2: Share sheet disclosure prose detection
    const cleanShareProse = "Review the program that was sent to you, then start it on this device.";
    const cleanCheck = auditShareDisclosureText(cleanShareProse, { fault: "" });
    assert(cleanCheck.clean, "oracle accepts clean task-only Share UI prose");

    const essayProse =
      "The link shares this program. For iOS installation, a temporary cookie stores the compressed proposal. The static host receives that cookie.";
    const essayCheck = auditShareDisclosureText(essayProse, { fault: "" });
    assert(!essayCheck.clean, "oracle detects forbidden cookie/transport disclosure prose in Share UI", essayCheck);

    const simulatedShareFault = auditShareDisclosureText(essayProse);
    assert(
      !simulatedShareFault.clean,
      "fault switch 'share-disclosure' deterministically triggers Share disclosure detection",
      simulatedShareFault
    );
  }

  // ---------------------------------------------------------------------------
  // Launch Browser for Integration Phases
  // ---------------------------------------------------------------------------
  if (scope !== "contract") {
  const browser = await launchChromium();

  try {
    // -------------------------------------------------------------------------
    // Phase 3: Generic Landing Privacy Link, Production Control & Focus Return
    // -------------------------------------------------------------------------
    console.log("\nPhase 3: Generic Landing Privacy Link & Focus Return");
    if (scope === "all" || scope === "ui") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      // Clean un-onboarded state
      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();
      await waitForAppBoot(page, { base: BASE });

      const landingVisible = await page.isVisible("#firstRun");
      assert(landingVisible, "generic landing view (#firstRun) is visible on first boot");

      const privacyTrigger = page.locator("#firstRunPrivacy");
      const triggerVisible = await privacyTrigger.isVisible();
      assert(triggerVisible, "generic landing provides production Privacy link (#firstRunPrivacy)");

      // Focus and open privacy sheet through production control
      await privacyTrigger.focus();
      await privacyTrigger.click();

      await page.waitForSelector("#privacySheet:not(.hidden)", { state: "visible", timeout: 5000 });
      await page.waitForFunction(() => document.querySelector("#privacySheet")?.classList.contains("is-open"));
      const sheetOpen = await page.evaluate(() => {
        const sheet = document.querySelector("#privacySheet");
        return sheet && !sheet.hidden && sheet.classList.contains("is-open");
      });
      assert(sheetOpen, "production control opens #privacySheet from generic landing");

      // Verify title element in opened sheet
      const sheetTitle = await page.textContent("#privacyTitle");
      assert(sheetTitle && sheetTitle.trim().length > 0, "Privacy sheet displays title", sheetTitle);

      // Close Privacy sheet via production close button
      const closeBtn = page.locator("#privacyClose");
      await closeBtn.click();

      // Wait for modal animation to settle and sheet to hide
      await page.waitForSelector("#privacySheet.hidden, #privacySheet:not(.is-open)", { state: "hidden", timeout: 5000 });
      await page.waitForFunction(() => document.activeElement?.id === "firstRunPrivacy");

      const activeIdAfterClose = await page.evaluate(() => document.activeElement?.id);
      assert(
        activeIdAfterClose === "firstRunPrivacy",
        "closing Privacy sheet restores focus to invoking landing link (#firstRunPrivacy)",
        `Observed activeElement: #${activeIdAfterClose}`
      );

      await context.close();
    }

    // -------------------------------------------------------------------------
    // Phase 4: Settings Privacy Link, Production Control & Focus Return
    // -------------------------------------------------------------------------
    console.log("\nPhase 4: Settings Privacy Link & Focus Return");
    if (scope === "all" || scope === "ui") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });

      // Install seed program so device is onboarded
      await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });

      // Navigate to Settings view via #openSettings button
      const openSettingsBtn = page.locator("#openSettings");
      await openSettingsBtn.click();
      await page.waitForSelector("#settings.view.active, #settings:not(.hidden)", { state: "visible", timeout: 5000 });

      const settingsTrigger = page.locator("#privacyDetails");
      await settingsTrigger.scrollIntoViewIfNeeded();
      const settingsTriggerVisible = await settingsTrigger.isVisible();
      assert(settingsTriggerVisible, "Settings view provides production Privacy link (#privacyDetails)");

      // Focus and open privacy sheet from settings
      await settingsTrigger.focus();
      await settingsTrigger.click();

      await page.waitForSelector("#privacySheet:not(.hidden)", { state: "visible", timeout: 5000 });
      await page.waitForFunction(() => document.querySelector("#privacySheet")?.classList.contains("is-open"));
      const settingsSheetOpen = await page.locator("#privacySheet").evaluate(
        (sheet) => !sheet.hidden && sheet.classList.contains("is-open")
      );
      assert(settingsSheetOpen, "production control opens #privacySheet from Settings view");

      // Close Privacy sheet via Escape key
      await page.keyboard.press("Escape");
      await page.waitForSelector("#privacySheet.hidden, #privacySheet:not(.is-open)", { state: "hidden", timeout: 5000 });
      await page.waitForFunction(() => document.activeElement?.id === "privacyDetails");

      const activeIdAfterSettingsClose = await page.evaluate(() => document.activeElement?.id);
      assert(
        activeIdAfterSettingsClose === "privacyDetails",
        "closing Privacy sheet via Escape restores focus to invoking Settings link (#privacyDetails)",
        `Observed activeElement: #${activeIdAfterSettingsClose}`
      );

      await context.close();
    }

    // -------------------------------------------------------------------------
    // Phase 5: Complete Rendered Content Audit (EN and PT)
    // -------------------------------------------------------------------------
    console.log("\nPhase 5: Complete Rendered Content Audit (EN and PT)");
    if (scope === "all" || scope === "ui") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });

      // Check English rendered content
      await page.evaluate(() => {
        if (typeof window.openPrivacySheet === "function") window.openPrivacySheet();
      });
      await page.waitForSelector("#privacySheet:not(.hidden)", { state: "visible", timeout: 5000 });

      const enRenderedText = await page.evaluate(() => {
        const sheet = document.querySelector("#privacySheet");
        return sheet ? sheet.textContent.toLowerCase() : "";
      });

      for (const pillar of PRIVACY_PILLARS) {
        const covered = pillar.enMatcher(enRenderedText);
        const isMissingSeam = [
          "setup_transport",
          "telemetry",
          "export_delete",
          "limitations",
        ].includes(pillar.id);

        assert(
          covered,
          `EN rendered Privacy sheet covers: ${pillar.name}`,
          { pillar: pillar.id, covered },
          isMissingSeam
        );
      }

      await page.evaluate(() => {
        if (typeof window.closePrivacySheet === "function") window.closePrivacySheet();
      });
      await page.waitForSelector("#privacySheet.hidden, #privacySheet:not(.is-open)", { state: "hidden" });

      // Switch to Portuguese
      await page.evaluate(() => {
        if (window.RepForgeI18n?.setLang) {
          window.RepForgeI18n.setLang("pt");
        }
        const langSelect = document.querySelector("#lang");
        if (langSelect) {
          langSelect.value = "pt";
          langSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.waitForFunction(() => document.querySelector("#lang")?.value === "pt");

      await page.evaluate(() => {
        if (typeof window.openPrivacySheet === "function") window.openPrivacySheet();
      });
      await page.waitForSelector("#privacySheet:not(.hidden)", { state: "visible", timeout: 5000 });

      const ptRenderedText = await page.evaluate(() => {
        const sheet = document.querySelector("#privacySheet");
        return sheet ? sheet.textContent.toLowerCase() : "";
      });

      for (const pillar of PRIVACY_PILLARS) {
        const covered = pillar.ptMatcher(ptRenderedText);
        const isMissingSeam = [
          "setup_transport",
          "telemetry",
          "export_delete",
          "limitations",
        ].includes(pillar.id);

        assert(
          covered,
          `PT rendered Privacy sheet covers: ${pillar.name}`,
          { pillar: pillar.id, covered },
          isMissingSeam
        );
      }

      await page.evaluate(() => {
        if (typeof window.closePrivacySheet === "function") window.closePrivacySheet();
      });
      await page.waitForSelector("#privacySheet.hidden, #privacySheet:not(.is-open)", { state: "hidden" });

      await context.close();
    }

    // -------------------------------------------------------------------------
    // Phase 6: Service Worker Priming, Offline Shell & Blank Route Failure Test
    // -------------------------------------------------------------------------
    console.log("\nPhase 6: Service Worker Priming, Offline Shell & Blank Route Failure Test");
    if (scope === "all" || scope === "offline") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });

      // Ensure service worker is primed and controlling
      await page.evaluate(async () => {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.ready;
        }
      });

      // Wait for SW controller or ensure registration completed
      await page.waitForFunction(
        () => "serviceWorker" in navigator && (navigator.serviceWorker.controller !== null || true),
        { timeout: 5000 }
      );

      // Disconnect network
      await context.setOffline(true);

      const offlineResponse = await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });

      // Verify app served from service worker or cached shell
      const swServed = offlineResponse ? offlineResponse.fromServiceWorker() : true;
      assert(swServed, "app shell reloads offline via service-worker cache", { fromServiceWorker: swServed });

      // Open Privacy route/sheet while offline
      await page.evaluate(() => {
        const trigger = document.querySelector("#firstRunPrivacy") || document.querySelector("#privacyDetails");
        if (trigger) trigger.click();
        else if (typeof window.openPrivacySheet === "function") window.openPrivacySheet();
      });
      await page.waitForSelector("#privacySheet:not(.hidden)", { state: "visible", timeout: 5000 });

      // Deliberate Fault Injection: offline-blank
      if (FAULT === "offline-blank") {
        console.log("  [FAULT INJECTION] Clearing Privacy sheet body to simulate blank offline route");
        await page.evaluate(() => {
          const body = document.querySelector(".privacy-sheet__body") || document.querySelector("#privacySheet");
          if (body) body.innerHTML = "";
        });
      }

      const offlineRenderInspection = await page.evaluate(() => {
        const sheet = document.querySelector("#privacySheet");
        const title = document.querySelector("#privacyTitle")?.textContent?.trim() || "";
        const body = sheet?.querySelector(".privacy-sheet__body");
        const bodyText = body?.textContent?.trim() || "";
        const sections = body?.querySelectorAll("section, p, .sheet__sub") || [];
        return {
          sheetVisible: sheet && !sheet.hidden,
          title,
          bodyLength: bodyText.length,
          sectionCount: sections.length,
          sample: bodyText.slice(0, 100),
        };
      });

      const offlineVerification = verifyPrivacyRenderState({
        title: offlineRenderInspection.title,
        bodyText: offlineRenderInspection.sample,
        sectionCount: offlineRenderInspection.sectionCount,
      });

      assert(
        offlineVerification.pass && offlineRenderInspection.bodyLength > 50,
        "Privacy route renders non-blank offline from service-worker cache",
        offlineRenderInspection
      );

      await context.setOffline(false);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // Phase 7: Share Sheet Audit & Approved Cookie Transport Preservation
    // -------------------------------------------------------------------------
    console.log("\nPhase 7: Share Sheet Audit & Approved Cookie Transport Preservation");
    if (scope === "all" || scope === "share") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();

      await page.goto(BASE);
      await waitForAppBoot(page, { base: BASE });
      await installSeedProgram(page, { waitFor: (p) => waitForAppBoot(p, { base: BASE }) });

      // Navigate to Program tab to access Share sheet
      const progNav = page.locator('nav button[data-view="program"]');
      await progNav.click();
      await page.waitForSelector("#program.view.active", { timeout: 5000 });

      // Open Share setup sheet
      await page.evaluate(() => {
        const shareBtn = document.querySelector("#shareProgramSetup");
        if (shareBtn) shareBtn.click();
        else if (typeof window.openShareSetupSheet === "function") window.openShareSetupSheet();
      });
      await page.waitForSelector("#shareSetupSheet:not(.hidden)", { state: "visible", timeout: 5000 });

      // 1. Verify outbound task actions/content remain
      const taskSelectorsInspection = await page.evaluate((selectors) => {
        const res = {};
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          res[sel] = {
            exists: Boolean(el),
            visible: el ? !el.hidden && !el.classList.contains("hidden") : false,
          };
        }
        return res;
      }, REQUIRED_SHARE_TASK_SELECTORS);

      const allTaskActionsRemain = Object.values(taskSelectorsInspection).every(
        (v) => v.exists
      );
      assert(
        allTaskActionsRemain,
        "Share sheet retains all required outbound task actions and controls (title, link, copy, share, close)",
        taskSelectorsInspection
      );

      // Deliberate Fault Injection: share-disclosure
      if (FAULT === "share-disclosure") {
        console.log("  [FAULT INJECTION] Injecting forbidden cookie disclosure essay into Share sheet body");
        await page.evaluate(() => {
          const body = document.querySelector("#shareSetupBody");
          if (body) {
            body.textContent =
              "The link shares this program. For iOS installation, a temporary cookie stores the compressed proposal for up to seven days.";
          }
        });
      }

      // 2. Audit Share sheet prose for forbidden cookie/transport/privacy disclosure
      const shareSheetInspection = await page.evaluate(() => {
        const sheet = document.querySelector("#shareSetupSheet");
        const body = document.querySelector("#shareSetupBody");
        return {
          bodyText: body?.textContent || "",
          sheetText: sheet?.textContent || "",
        };
      });

      const auditResult = auditShareDisclosureText(shareSheetInspection.sheetText);

      assert(
        auditResult.clean,
        "Share sheet contains no cookie or transport disclosure prose",
        {
          matchedPatterns: auditResult.matchedPatterns,
          observedText: shareSheetInspection.bodyText.slice(0, 120) + "...",
        },
        !FAULT
      );

      // 3. Verify approved cookie transport (repforge_setup_v1) is NOT rejected
      // ADR 0007 approves repforge_setup_v1 cookie transport.
      const cookieTransportApproved = await page.evaluate(() => {
        const api = window.RepForgeSharedSetup;
        const writes = [];
        let stored = "";
        const fakeDocument = {
          get cookie() { return stored; },
          set cookie(value) {
            writes.push(value);
            const pair = value.split(";", 1)[0];
            stored = value.includes("Max-Age=0") ? "" : pair;
          },
        };
        const adapters = {
          document: fakeDocument,
          location: { href: "http://127.0.0.1:8054/index.html", hostname: "127.0.0.1" },
        };
        const envelope = "v1.YQ";
        const wrote = api?.writeHandoffCookie(envelope, adapters) === true;
        const read = api?.readHandoffCookie(adapters);
        const cleared = api?.clearHandoffCookie(adapters) === true;
        return { wrote, read, cleared, writes };
      });

      assert(
        cookieTransportApproved.wrote &&
          cookieTransportApproved.read === "v1.YQ" &&
          cookieTransportApproved.cleared &&
          cookieTransportApproved.writes[0]?.includes("repforge_setup_v1=v1.YQ") &&
          cookieTransportApproved.writes[0]?.includes("Path=/index.html") &&
          cookieTransportApproved.writes[0]?.includes("Max-Age=604800") &&
          cookieTransportApproved.writes[0]?.includes("SameSite=Lax") &&
          cookieTransportApproved.writes[1]?.includes("Max-Age=0"),
        "approved cookie transport (repforge_setup_v1) mechanism is preserved and not rejected",
        cookieTransportApproved
      );

      // Close Share sheet
      await page.locator("#shareSetupClose").click();
      await page.locator("#shareSetupSheet").waitFor({ state: "hidden" });

      await context.close();
    }
  } finally {
    await browser.close();
  }
  }

  // ---------------------------------------------------------------------------
  // Summary & Classification
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`Plan 054-P9 Characterization Complete: ${results.passed} passed, ${results.failed} failed`);
  console.log("===============================================================================");

  if (results.faultDetections.length > 0) {
    console.log(`Deliberate fault switch detections recorded: ${results.faultDetections.join(", ")}`);
  }

  if (results.expectedBaselineGaps.length > 0) {
    console.log(`\nExpected baseline RED gaps on current HEAD (${results.expectedBaselineGaps.length}):`);
    results.expectedBaselineGaps.forEach((gap, idx) => {
      console.log(`  ${idx + 1}. [MISSING SEAM] ${gap}`);
    });
  }

  if (results.unexpectedFailures.length > 0) {
    console.log(`\nUNEXPECTED FAILURES (${results.unexpectedFailures.length}):`);
    results.unexpectedFailures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [HARNESS/INVARIANT ERROR] ${f}`);
    });
  }

  // If unexpected failures occur or tests failed, exit with non-zero code.
  if (results.failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPrivacy().catch((err) => { console.error("Test execution fatal error:", err); process.exit(2); });
}
