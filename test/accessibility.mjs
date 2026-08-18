#!/usr/bin/env node
/** Focused Playwright checks for modal, disclosure, and live-status semantics. Requires the app HTTP server. */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";
import { MINIMAL_PAYLOAD, cloneFixture } from "./fixtures/shared-setup.mjs";
import {
  APP_INDEX,
  encodeSharedPayload,
  openAppPage,
  SHARED_COPY,
  SHARED_DOM,
  sharedGateSnapshot,
} from "./shared-setup-flow.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";

const results = { passed: 0, failed: 0 };

export function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeStorage.flush === "function",
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function")
      window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function")
      window.closeTour();
  });
  await page.waitForFunction(() => typeof window.detectPRs === "function", { timeout: 10000 });
}

async function clearState(page) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
}

async function idbPut(page, blob) {
  await page.evaluate(
    async ({ k, dbName, storeName, blob }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, dbName: DB, storeName: STORE, blob }
  );
}

function sampleState(overrides = {}) {
  const log = overrides.log || [
    {
      session: "s1",
      date: "2026-01-02",
      day: "Day 1",
      name: "Press",
      exerciseId: "ex1",
      set: 1,
      load: 60,
      reps: 10,
      rir: 1,
      notes: "",
      created: "2026-01-02T00:00:00.000Z",
      primary: "Chest",
      secondary: "",
    },
  ];
  return {
    settings: {
      jumpPct: 2.5,
      minJump: 2.5,
      rirHigh: 2,
      hardRir: 4,
      restSec: 120,
      lastExport: "",
      unit: "kg",
      lang: "en",
      rirMode: "numeric",
      voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: overrides.programId || "prog-a",
      name: overrides.name || "Alpha",
      started: "2026-01-01",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 3,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "45",
      completedAt: null,
    },
    program: [
      {
        id: "ex1",
        name: "Press",
        day: "Day 1",
        order: 0,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "",
      },
    ],
    log,
    programHistory: overrides.programHistory || [],
  };
}

async function freshPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

async function modalInfo(page, sel) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const host = document.querySelector("#announcementHost");
    const bodyKids = [...document.body.children].map((c) => ({
      id: c.id,
      inert: !!c.inert,
      tag: c.tagName.toLowerCase(),
    }));
    const stops = [...(el?.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])") || [])]
      .filter((n) => getComputedStyle(n).display !== "none")
      .map((n) => n.id || n.tagName);
    return {
      hidden: !el || el.classList.contains("hidden") || el.hidden === true || (el.tagName === "DIALOG" && !el.open),
      open: el?.tagName === "DIALOG" ? !!el.open : !!(el && !el.classList.contains("hidden")),
      active: document.activeElement?.id || document.activeElement?.tagName || null,
      stops,
      hostInert: host ? !!host.inert : null,
      inertIds: bodyKids.filter((c) => c.inert).map((c) => c.id || c.tag),
      liveKids: bodyKids.filter((c) => !c.inert).map((c) => c.id || c.tag),
    };
  }, sel);
}

async function tabWrap(page, sel) {
  await page.keyboard.press("Tab");
  const forward = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    return { id: document.activeElement?.id, inside: !!(root && root.contains(document.activeElement)) };
  }, sel);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const back = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    return { id: document.activeElement?.id, inside: !!(root && root.contains(document.activeElement)) };
  }, sel);
  return { forward, back };
}

async function persistState(page, state) {
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob: state }
  );
}

async function readLogModeControls(page) {
  return page.evaluate(() => {
    const controls = [
      { mode: "list", element: document.querySelector("#modeFull") },
      { mode: "focus", element: document.querySelector("#modeFocus") },
    ];
    const active = controls.filter(({ element }) => element?.classList.contains("active")).map(({ mode }) => mode);
    const pressed = controls.filter(({ element }) => element?.getAttribute("aria-pressed") === "true").map(({ mode }) => mode);
    return {
      active,
      pressed,
      same: active.length === 1 && pressed.length === 1 && active[0] === pressed[0],
      attributes: controls.map(({ mode, element }) => ({
        mode,
        active: !!element?.classList.contains("active"),
        pressed: element?.getAttribute("aria-pressed") || null,
      })),
    };
  });
}

function expectedTourMode(step, originMode) {
  if (step === 0) return originMode;
  return step === 3 || step === 4 ? "focus" : "list";
}

async function readLogicalFocus(page, selector) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    const style = element ? getComputedStyle(element) : null;
    const rect = element?.getBoundingClientRect();
    const visible = !!(
      element?.isConnected &&
      !element.closest("[inert],[hidden],.hidden,.is-hidden") &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      Number(style?.opacity) !== 0 &&
      rect &&
      rect.width > 0 &&
      rect.height > 0
    );
    return {
      selector: sel,
      active: document.activeElement?.id || document.activeElement?.tagName || null,
      isTarget: document.activeElement === element,
      connected: !!element?.isConnected,
      visible,
    };
  }, selector);
}

async function prepareReplayTour(page, originMode) {
  await showView(page, "log");
  const entry = originMode === "focus" ? "#startWorkout" : "#viewExercises";
  await page.locator(entry).focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const entered = await readLogModeControls(page);
  await page.locator("#leaveWorkout").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#todayDash:not(.hidden)");
  await page.locator("#openSettings").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#settings.view.active");
  await page.locator("#replayTour").focus();
  const ready = await readLogModeControls(page);
  return { entered, ready };
}

async function runReplayTourScenario(browser, originMode, exitKind) {
  const { context, page } = await freshPage(browser);
  const origin = await prepareReplayTour(page, originMode);
  assert(
    origin.entered.same &&
      origin.entered.active[0] === originMode &&
      origin.ready.same &&
      origin.ready.active[0] === originMode,
    `Replay Tour ${exitKind}: ${originMode} is reachable and synchronized before replay`,
    JSON.stringify(origin)
  );

  await page.keyboard.press("Enter");
  await page.waitForSelector("#tour:not(.hidden)");
  if (originMode === "list" && exitKind === "cancel") {
    const wrap = await tabWrap(page, "#tour");
    assert(
      wrap.forward.inside && wrap.back.inside,
      "Replay Tour uses the shared modal controller for forward/reverse Tab containment",
      JSON.stringify(wrap)
    );
  }
  const total = await page.locator("#tourDots .tour__dot").count();
  const lastStep = exitKind === "cancel" ? Math.min(3, total - 1) : total - 1;
  const trace = [];
  for (let step = 0; step <= lastStep; step++) {
    if (step > 0) {
      await page.locator("#tourNext").focus();
      await page.keyboard.press("Enter");
    }
    const controls = await readLogModeControls(page);
    trace.push({ step, expected: expectedTourMode(step, originMode), ...controls });
  }
  const violations = trace.filter(
    ({ expected, active, pressed, same }) =>
      !same || active[0] !== expected || pressed[0] !== expected
  );
  assert(
    violations.length === 0,
    `Replay Tour ${exitKind}: every ${originMode} transition keeps one matching active/pressed mode`,
    JSON.stringify(violations)
  );

  if (exitKind === "cancel") {
    await page.keyboard.press("Escape");
  } else {
    await page.locator("#tourNext").focus();
    await page.keyboard.press("Enter");
  }
  await page.waitForFunction(() => document.querySelector("#tour")?.classList.contains("hidden"));
  await page.waitForSelector("#settings.view.active");
  const restored = await readLogModeControls(page);
  const focus = await readLogicalFocus(page, "#replayTour");
  assert(
    restored.same &&
      restored.active[0] === originMode &&
      restored.pressed[0] === originMode,
    `Replay Tour ${exitKind}: restores snapshotted ${originMode} mode`,
    JSON.stringify(restored)
  );
  assert(
    focus.isTarget && focus.connected && focus.visible,
    `Replay Tour ${exitKind}: restores focus to the live visible Replay Tour origin (${originMode})`,
    JSON.stringify(focus)
  );
  await context.close();
}

async function runLocalizedHistoryAndTourChecks(browser) {
  console.log("\nLocalized History controls and feature-tour invariants");
  {
    const { context, page } = await freshPage(browser);
    const expected = {
      en: { previous: "Previous month", next: "Next month" },
      pt: { previous: "Mês anterior", next: "Próximo mês" },
    };
    for (const lang of ["en", "pt"]) {
      await seedLangUnit(page, lang, "kg", true);
      await showView(page, "history");
      await page.waitForSelector("#history.view.active #calPrev");
      const rendered = await page.evaluate(() => ({
        previous: document.querySelector("#calPrev")?.getAttribute("aria-label") || "",
        next: document.querySelector("#calNext")?.getAttribute("aria-label") || "",
      }));
      assert(
        rendered.previous === expected[lang].previous && rendered.next === expected[lang].next,
        `History calendar renders localized previous/next button names (${lang})`,
        JSON.stringify({ expected: expected[lang], rendered })
      );
    }
    await context.close();
  }

  for (const originMode of ["list", "focus"]) {
    for (const exitKind of ["cancel", "complete"]) {
      await runReplayTourScenario(browser, originMode, exitKind);
    }
  }

  {
    const { context, page } = await freshPage(browser);
    await showView(page, "log");
    await page.evaluate(() => window.startTour("first-run"));
    await page.waitForSelector("#tour:not(.hidden)");
    const total = await page.locator("#tourDots .tour__dot").count();
    for (let step = 1; step < total; step++) {
      await page.locator("#tourNext").focus();
      await page.keyboard.press("Enter");
    }
    await page.locator("#tourNext").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#tour")?.classList.contains("hidden"));
    const focus = await readLogicalFocus(page, "#startWorkout");
    assert(
      focus.isTarget && focus.connected && focus.visible,
      "First-run tour completion keeps focus on visible Start Workout",
      JSON.stringify(focus)
    );
    await context.close();
  }
}

export async function runWorkoutValidationFocusCheck(browser, check = assert) {
  console.log("\nWorkout validation focus");
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  await page.evaluate(() => setLogMode("full"));

  const load = page.locator('#workout input[data-k$="_load"]').first();
  const loadKey = await load.getAttribute("data-k");
  const setKey = loadKey?.replace(/_load$/, "");
  const reps = page.locator(`[data-k="${setKey}_reps"]`);
  const rir = page.locator(`[data-k="${setKey}_rir"]`);

  await load.fill("60");
  await reps.fill("8");
  await reps.fill("");
  await rir.fill("1");

  const finish = page.locator("#logForm .btn--save");
  await finish.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const form = document.querySelector("#logForm");
    return (
      !!form?.querySelector("[aria-invalid='true']") &&
      !form.inert &&
      form.getAttribute("aria-busy") !== "true"
    );
  });

  const rejected = await page.evaluate((expectedKey) => {
    const form = document.querySelector("#logForm");
    const invalid = [...form.querySelectorAll("[aria-invalid='true']")];
    const first = invalid[0];
    const finishButton = form.querySelector(".btn--save");
    return {
      activeKey: document.activeElement?.dataset?.k || document.activeElement?.id || null,
      expectedKey,
      firstInvalidKey: first?.dataset?.k || first?.id || null,
      invalidCount: invalid.length,
      focusOnFirstInvalid: document.activeElement === first,
      formInert: !!form.inert,
      formBusy: form.getAttribute("aria-busy"),
      finishDisabled: !!finishButton?.disabled,
    };
  }, `${setKey}_reps`);
  await page.keyboard.type("8");
  const afterEdit = await page.evaluate((expectedKey) => {
    const repsInput = document.querySelector(`[data-k="${expectedKey}"]`);
    return {
      activeKey: document.activeElement?.dataset?.k || document.activeElement?.id || null,
      repsValue: repsInput?.value ?? null,
    };
  }, `${setKey}_reps`);

  check(
    rejected.firstInvalidKey === rejected.expectedKey &&
      rejected.invalidCount === 1 &&
      rejected.focusOnFirstInvalid &&
      !rejected.formInert &&
      rejected.formBusy == null &&
      !rejected.finishDisabled &&
      afterEdit.activeKey === rejected.expectedKey &&
      afterEdit.repsValue === "8",
    "Rejected Finish focuses the first invalid field and leaves the workout form operable",
    JSON.stringify({ rejected, afterEdit })
  );

  await context.close();
}

async function runAccessibleInteractions(browser) {
console.log("\nAccessible interactions (UX-07 / UX-16 / A11Y-02)");

{
  const { context, page } = await freshPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden) #endBlock");
  await page.locator("#endBlock").click();
  let info = await modalInfo(page, "#endBlockConfirm");
  assert(info.open && info.active === "endBlockCancel", "End Block Confirm: initial focus is #endBlockCancel", JSON.stringify(info));
  assert(info.liveKids.includes("endBlockConfirm") && info.liveKids.includes("announcementHost"), "End Block Confirm: dialog and announcement host stay interactive", JSON.stringify(info.liveKids));
  assert(info.inertIds.includes("main") || info.inertIds.length > 0, "End Block Confirm: background is inert", JSON.stringify(info.inertIds));
  const wrap = await tabWrap(page, "#endBlockConfirm");
  assert(wrap.forward.inside && wrap.back.inside, "End Block Confirm: Tab wraps inside", JSON.stringify(wrap));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  await page.waitForFunction(() => document.activeElement?.id === "endBlock");
  info = await modalInfo(page, "#endBlockConfirm");
  const afterEsc = await page.evaluate(() => ({
    hidden: document.querySelector("#endBlockConfirm")?.classList.contains("hidden"),
    active: document.activeElement?.id,
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id),
  }));
  assert(info.hidden && afterEsc.active === "endBlock", "End Block Confirm: Escape is Cancel and returns to #endBlock", JSON.stringify(afterEsc));
  assert(afterEsc.leaked.length === 0, "End Block Confirm: closing restores inertness", JSON.stringify(afterEsc.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden) #endBlock");
  await page.locator("#endBlock").click();
  await page.locator("#endBlockGo").click();
  const review = await modalInfo(page, "#blockReview");
  const confirmGone = await page.evaluate(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  assert(review.open && review.active === "blockReviewClose", "Block Review: initial focus is #blockReviewClose after handoff", JSON.stringify(review));
  assert(confirmGone, "Block Review: End Block Confirm is hidden after handoff");
  assert(!review.liveKids.includes("endBlockConfirm") || document.querySelector("#endBlockConfirm")?.inert, "Block Review: confirm dialog is not left interactive", JSON.stringify(review.liveKids));
  const wrap = await tabWrap(page, "#blockReview");
  assert(wrap.forward.inside && wrap.back.inside, "Block Review: Tab wraps inside", JSON.stringify(wrap));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  await page.waitForFunction(() => document.activeElement?.id === "endBlock");
  const after = await page.evaluate(() => ({
    hidden: document.querySelector("#blockReview")?.classList.contains("hidden"),
    active: document.activeElement?.id,
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
  }));
  assert(after.hidden && after.active === "endBlock", "Block Review: Escape closes and returns to original #endBlock opener", JSON.stringify(after));
  assert(after.leaked.length === 0, "chained modals do not leak inertness", JSON.stringify(after.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await page.locator("#dataImportRow").click();
  await page.evaluate(() =>
    openImportChoice({
      s: { program: [], log: [], settings: {} },
      inSessions: 1,
      inSets: 1,
      curSessions: 0,
      curSets: 0,
      newSessions: 1,
    })
  );
  let info = await modalInfo(page, "#importChoice");
  assert(info.open && info.active === "importCancel", "Import Choice: initial focus is #importCancel", JSON.stringify(info));
  const wrap = await tabWrap(page, "#importChoice");
  assert(wrap.forward.inside && wrap.back.inside, "Import Choice: Tab wraps inside", JSON.stringify(wrap));
  const outside = await page.evaluate(() => {
    document.querySelector("nav")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return !document.querySelector("#importChoice")?.classList.contains("hidden");
  });
  assert(outside, "Import Choice: outside click does nothing");
  const toastWatch = await page.evaluate(async () => {
    const live = document.querySelector("#toast");
    const host = document.querySelector("#announcementHost");
    const seen = [];
    const mo = new MutationObserver(() => {
      if (live.textContent) seen.push(live.textContent);
    });
    mo.observe(live, { childList: true, characterData: true, subtree: true });
    const raw = JSON.parse(localStorage.getItem("repforge_v1"));
    await window.__repforgeStorage.writeWithAdapter(raw, {
      writeLocal() {
        throw new Error("fail ls");
      },
      async writeIdb() {
        throw new Error("fail idb");
      },
    });
    await new Promise((r) => setTimeout(r, 80));
    mo.disconnect();
    const operable = [...host.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(
      (el) => getComputedStyle(el).display !== "none"
    );
    return {
      seen,
      role: live.getAttribute("role"),
      live: live.getAttribute("aria-live"),
      operable: operable.map((el) => el.id || el.tagName),
      importOpen: !document.querySelector("#importChoice")?.classList.contains("hidden"),
    };
  });
  assert(toastWatch.role === "alert" && toastWatch.live === "assertive", "both-store failure while Import Choice is open uses assertive alert", JSON.stringify(toastWatch));
  assert(toastWatch.operable.length === 0, "#announcementHost contains no operable background content", JSON.stringify(toastWatch.operable));
  assert(toastWatch.importOpen, "Import Choice stays open during the assertive announcement");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#importChoice")?.classList.contains("hidden"));
  const after = await page.evaluate(() => {
    const el = document.activeElement;
    const trigger = !!(
      el?.id === "importJson" ||
      el?.id === "dataImportRow" ||
      el?.closest?.("#dataImportRow, #dataImportPanel, label.file")
    );
    return {
      hidden: document.querySelector("#importChoice")?.classList.contains("hidden"),
      active: el?.id,
      trigger,
    };
  });
  assert(after.hidden && after.trigger, "Import Choice: Escape is Cancel and returns to the import trigger", JSON.stringify(after));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.evaluate(() => {
    localStorage.setItem(
      "repforge_v1",
      JSON.stringify({
        program: [{ id: "a", name: "CopyA", day: "Day 1", order: 0, sets: 2, min: 8, max: 12, primary: "Chest", secondary: "" }],
        log: [{ session: "s1", date: "2026-01-02", day: "Day 1", name: "CopyA", exerciseId: "a", set: 1, load: 50, reps: 8, rir: 1, notes: "", created: "2026-01-02T00:00:00.000Z", primary: "Chest", secondary: "" }],
        settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "", unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false, notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true } },
        programMeta: { id: "prog-a", name: "CopyA", started: "2026-01-01", onboarded: true, mesocycleStatus: "active" },
        programHistory: [],
      })
    );
  });
  const other = sampleState({ name: "Beta", programId: "prog-b" });
  await idbPut(page, other);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#storageRecovery")?.open, { timeout: 15000 });
  const info = await modalInfo(page, "#storageRecovery");
  assert(info.open && (info.active === "storageExportA" || info.active === "storageRetry" || info.active === "storageRecoveryTitle"), "Storage Recovery: initial focus is a non-destructive action", JSON.stringify(info));
  const stillOpen = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return !!document.querySelector("#storageRecovery")?.open;
  });
  assert(stillOpen, "Storage Recovery: Escape does nothing until resolved");
  await page.locator("#storageUseA").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#storageRecovery")?.open, { timeout: 5000 });
  await waitForApp(page);
  const after = await page.evaluate(() => {
    const active = document.activeElement;
    const start = document.querySelector("#startWorkout");
    const style = start ? getComputedStyle(start) : null;
    const startVisible = !!(
      start &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      start.getClientRects().length
    );
    return {
      open: !!document.querySelector("#storageRecovery")?.open,
      leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
      active: active?.id || active?.tagName,
      activeIsStart: active === start,
      activeConnected: !!active?.isConnected,
      startVisible,
      startInert: !!start?.closest("[inert]"),
    };
  });
  assert(!after.open && after.leaked.length === 0, "Storage Recovery: close restores inertness", JSON.stringify(after));
  assert(
    after.activeIsStart && after.activeConnected && after.startVisible && !after.startInert,
    "Storage Recovery: Enter on Use Copy A restores focus to visible #startWorkout",
    JSON.stringify(after)
  );
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const local = sampleState({ name: "CopyA", programId: "prog-a" });
  const other = sampleState({ name: "Beta", programId: "prog-b" });
  await page.evaluate(
    ({ k, blob }) => localStorage.setItem(k, JSON.stringify(blob)),
    { k: KEY, blob: local }
  );
  await idbPut(page, other);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#storageRecovery")?.open, { timeout: 15000 });
  await page.locator("#storageUseB").focus();
  await page.keyboard.press(" ");
  await page.waitForFunction(() => !document.querySelector("#storageRecovery")?.open, { timeout: 5000 });
  await waitForApp(page);
  const after = await page.evaluate(() => {
    const active = document.activeElement;
    const start = document.querySelector("#startWorkout");
    const style = start ? getComputedStyle(start) : null;
    const startVisible = !!(
      start &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      start.getClientRects().length
    );
    return {
      open: !!document.querySelector("#storageRecovery")?.open,
      leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
      active: active?.id || active?.tagName,
      activeIsStart: active === start,
      activeConnected: !!active?.isConnected,
      startVisible,
      startInert: !!start?.closest("[inert]"),
    };
  });
  assert(!after.open && after.leaked.length === 0, "Storage Recovery: Use Copy B closes and restores inertness", JSON.stringify(after));
  assert(
    after.activeIsStart && after.activeConnected && after.startVisible && !after.startInert,
    "Storage Recovery: Space on Use Copy B restores focus to visible #startWorkout",
    JSON.stringify(after)
  );
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const noteBtn = page.locator("#workout [data-exnote-open]").first();
  const noteId = await noteBtn.getAttribute("data-exnote-open");
  await noteBtn.click();
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return s && !s.hidden && !s.classList.contains("hidden");
  }, { timeout: 8000 });
  const info = await modalInfo(page, "#exNoteSheet");
  assert(info.open && info.active === "exNoteText", "Exercise Note: initial focus is #exNoteText", JSON.stringify({ ...info, noteId }));
  const wrap = await tabWrap(page, "#exNoteSheet");
  assert(wrap.forward.inside && wrap.back.inside, "Exercise Note: Tab wraps inside", JSON.stringify(wrap));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return !s || s.hidden || s.classList.contains("hidden");
  });
  const after = await page.evaluate(() => ({
    hidden: document.querySelector("#exNoteSheet")?.hidden || document.querySelector("#exNoteSheet")?.classList.contains("hidden"),
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
    focusNote: document.activeElement?.getAttribute("data-exnote-open"),
  }));
  assert(after.hidden, "Exercise Note: Escape is Cancel and hides the sheet", JSON.stringify(after));
  assert(after.leaked.length === 0, "Exercise Note: close restores inertness", JSON.stringify(after.leaked));
  assert(after.focusNote === noteId, "Exercise Note: Cancel returns focus to the exact note trigger", JSON.stringify({ noteId, after }));

  await page.evaluate((id) => {
    [...document.querySelectorAll("#workout [data-exnote-open]")].find((b) => b.dataset.exnoteOpen === id)?.click();
  }, noteId);
  await page.waitForSelector("#exNoteSheet:not([hidden])", { timeout: 8000 });
  await page.locator("#exNoteText").fill("Saved focus note");
  await page.locator("#exNoteSave").click();
  await page.waitForFunction((id) => {
    const sheet = document.querySelector("#exNoteSheet");
    return !!(sheet?.hidden && document.activeElement?.getAttribute("data-exnote-open") === id);
  }, noteId, { timeout: 8000 });
  const saved = await page.evaluate(() => ({
    focusNote: document.activeElement?.getAttribute("data-exnote-open"),
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
  }));
  assert(saved.focusNote === noteId, "Exercise Note: Save returns focus after the rerender", JSON.stringify({ noteId, saved }));
  assert(saved.leaked.length === 0, "Exercise Note: Save restores inertness", JSON.stringify(saved.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  const rows = [
    ["#restSecRow", "#restSecPanel"],
    ["#rirModeRow", "#rirModePanel"],
    ["#progressionRow", "#progressionDetails"],
    ["#notifyConfigRow", "#notifyTypes"],
    ["#dataBackupRow", "#dataBackupPanel"],
    ["#dataImportRow", "#dataImportPanel"],
  ];
  const start = await page.evaluate((pairs) =>
    pairs.map(([b, p]) => ({
      b,
      expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
      controls: document.querySelector(b)?.getAttribute("aria-controls"),
      open: document.querySelector(p)?.classList.contains("is-open"),
    })), rows);
  assert(
    start.every((r) => r.expanded === "false" && r.controls && r.open === false),
    "all six disclosure buttons start collapsed with aria-controls",
    JSON.stringify(start)
  );
  for (const [btn, panel] of rows) {
    await page.locator(btn).click();
    const open = await page.evaluate(
      ([b, p]) => ({
        expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
        open: document.querySelector(p)?.classList.contains("is-open"),
        controls: document.querySelector(b)?.getAttribute("aria-controls") === p.slice(1),
      }),
      [btn, panel]
    );
    assert(open.expanded === "true" && open.open && open.controls, `${btn} reports and controls its panel when open`, JSON.stringify(open));
    await page.locator(btn).click();
    const closed = await page.evaluate(
      ([b, p]) => ({
        expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
        open: document.querySelector(p)?.classList.contains("is-open"),
      }),
      [btn, panel]
    );
    assert(closed.expanded === "false" && !closed.open, `${btn} collapses its panel`, JSON.stringify(closed));
  }
  await context.close();
}

{
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__repforgeNotifyAdapter = {
      canUse() { return true; },
      permission() { return "granted"; },
      async request() { return "granted"; },
    };
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
  const date = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const ex = (state.program || []).find((e) => e.day === "Day 1") || (state.program || [])[0];
  if (ex) {
    state.settings = {
      ...state.settings,
      notify: { enabled: true, timer: true, session: true, unfinished: true, missed: true },
    };
    state.log = [
      {
        session: `${date}_Day 1_ban`,
        date,
        day: "Day 1",
        name: ex.name,
        exerciseId: ex.id,
        set: 1,
        load: 60,
        reps: 8,
        rir: 1,
        notes: "",
        created: new Date(`${date}T12:00:00Z`).toISOString(),
        primary: ex.primary,
        secondary: ex.secondary,
      },
    ];
    await page.evaluate(
      async ({ k, blob }) => {
        localStorage.setItem(k, JSON.stringify(blob));
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open("repforge", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("kv");
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        await new Promise((res, rej) => {
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(blob, k);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        db.close();
      },
      { k: KEY, blob: state }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    const bannerTarget = await page.evaluate(() => ({
      beforeDay: document.querySelector('#dayTabs button[aria-selected="true"]')?.dataset?.day,
      dueDay: RepForgeSchedule.mostOverdueDay(state.log, days(), today())?.day || null,
    }));
    await page.locator(".sessionbanner__act").focus();
    await page.keyboard.press("Enter");
    const afterEnter = await page.evaluate(() => ({
      hidden: document.querySelector("#sessionBanner")?.classList.contains("hidden"),
      activeDay: document.querySelector('#dayTabs button[aria-selected="true"]')?.dataset?.day,
      workoutVisible: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
      dashboardHidden: document.querySelector("#todayDash")?.classList.contains("hidden"),
    }));
    assert(
      afterEnter.hidden &&
        afterEnter.activeDay === bannerTarget.dueDay &&
        afterEnter.workoutVisible &&
        afterEnter.dashboardHidden,
      "session banner Enter action opens the advertised workout day",
      JSON.stringify({ bannerTarget, afterEnter })
    );
    await page.evaluate(
      async ({ k, blob }) => {
        localStorage.setItem(k, JSON.stringify(blob));
        localStorage.removeItem("repforge_notify_v1");
      },
      { k: KEY, blob: state }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    await page.locator(".sessionbanner__act").focus();
    await page.keyboard.press(" ");
    const afterSpace = await page.evaluate(() => ({
      hidden: document.querySelector("#sessionBanner")?.classList.contains("hidden"),
      activeDay: document.querySelector('#dayTabs button[aria-selected="true"]')?.dataset?.day,
      dueDay: RepForgeSchedule.mostOverdueDay(state.log, days(), today())?.day || null,
      workoutVisible: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
      dashboardHidden: document.querySelector("#todayDash")?.classList.contains("hidden"),
    }));
    assert(
      afterSpace.hidden &&
        afterSpace.activeDay === afterSpace.dueDay &&
        afterSpace.workoutVisible &&
        afterSpace.dashboardHidden,
      "session banner Space action opens the advertised workout day",
      JSON.stringify(afterSpace)
    );
    await page.evaluate(
      async ({ k, blob }) => {
        localStorage.setItem(k, JSON.stringify(blob));
        localStorage.removeItem("repforge_notify_v1");
      },
      { k: KEY, blob: state }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    await page.locator(".sessionbanner__close").focus();
    await page.keyboard.press("Enter");
    const dismissed = await page.evaluate(() => document.querySelector("#sessionBanner")?.classList.contains("hidden"));
    assert(dismissed, "session banner dismiss remains independent of the main action");
  } else {
    assert(false, "session banner fixture could not find an exercise");
  }
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const toastSeq = await page.evaluate(async () => {
    const live = document.querySelector("#toast");
    const afterFrames = (count = 4) =>
      new Promise((resolve) => {
        const next = () => (--count > 0 ? requestAnimationFrame(next) : resolve());
        requestAnimationFrame(next);
      });
    const capture = async (invoke) => {
      const seen = [];
      const mo = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData") seen.push(record.target.data);
          else seen.push([...record.addedNodes].map((node) => node.textContent).join(""));
        }
      });
      mo.observe(live, { childList: true, characterData: true, subtree: true });
      invoke();
      await afterFrames();
      mo.disconnect();
      return { seen, final: live.textContent };
    };
    live.textContent = "";
    const repeated = await capture(() => {
      toast("alpha");
      toast("alpha");
    });
    live.textContent = "";
    const rapid = await capture(() => {
      toast("alpha");
      toast("alpha");
      toast("beta");
    });
    const polite = { role: live.getAttribute("role"), live: live.getAttribute("aria-live"), atomic: live.getAttribute("aria-atomic") };
    const raw = JSON.parse(localStorage.getItem("repforge_v1"));
    await window.__repforgeStorage.writeWithAdapter(raw, {
      writeLocal() {
        throw new Error("fail ls");
      },
      async writeIdb() {
        throw new Error("fail idb");
      },
    });
    await afterFrames();
    const assertive = { role: live.getAttribute("role"), live: live.getAttribute("aria-live") };
    toast("beta");
    await afterFrames();
    const restored = { role: live.getAttribute("role"), live: live.getAttribute("aria-live") };
    return { repeated, rapid, polite, assertive, restored };
  });
  assert(
    toastSeq.polite.role === "status" && toastSeq.polite.live === "polite" && toastSeq.polite.atomic === "true",
    "toast is an atomic polite status region",
    JSON.stringify(toastSeq.polite)
  );
  assert(
    JSON.stringify(toastSeq.repeated.seen) === JSON.stringify(["alpha", "", "alpha"]) &&
      toastSeq.repeated.final === "alpha",
    "immediate repeated-identical toast is cleared and re-announced in exact order",
    JSON.stringify(toastSeq.repeated)
  );
  assert(
    JSON.stringify(toastSeq.rapid.seen) === JSON.stringify(["alpha", "", "beta"]) &&
      toastSeq.rapid.final === "beta",
    "newer rapid toast cancels stale identical-message work and remains final",
    JSON.stringify(toastSeq.rapid)
  );
  assert(toastSeq.assertive.role === "alert" && toastSeq.assertive.live === "assertive", "simulated both-store failure uses the assertive alert path", JSON.stringify(toastSeq.assertive));
  assert(toastSeq.restored.role === "status" && toastSeq.restored.live === "polite", "next routine toast restores polite semantics", JSON.stringify(toastSeq.restored));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const restLive = await page.evaluate(() => document.querySelector("#restBar")?.getAttribute("aria-live"));
  assert(!restLive || restLive === "off", "rest countdown is not a live region", restLive);
  for (const enabled of [false, true]) {
    await page.evaluate((on) => {
      state.settings.notify = { ...(state.settings.notify || {}), enabled: on, timer: true };
    }, enabled);
    await page.evaluate(() => startRest(1));
    await page.waitForFunction(() => (document.querySelector("#restAnnounce")?.textContent || "").trim().length > 0, { timeout: 4000 });
    const first = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const second = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    assert(!!first && first === second, `rest completion announces once (notify ${enabled ? "on" : "off"})`, JSON.stringify({ first, second }));
    await page.evaluate(() => stopRest());
    await page.evaluate(() => startRest(30));
    await page.evaluate(() => {
      window.__repforgeRest.expire();
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => (document.querySelector("#restAnnounce")?.textContent || "").trim().length > 0, { timeout: 4000 });
    const catchup = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    assert(!!(catchup || "").trim(), `visibilitychange catch-up announces completion (notify ${enabled ? "on" : "off"})`, catchup);
    const again = await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      return document.querySelector("#restAnnounce")?.textContent;
    });
    assert(again === catchup, `repeated visibility changes do not re-announce (notify ${enabled ? "on" : "off"})`, JSON.stringify({ catchup, again }));
    await page.evaluate(() => stopRest());
  }
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const pressed = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
    fullActive: document.querySelector("#modeFull")?.classList.contains("active"),
  }));
  assert(pressed.focus === "true" && pressed.full === "false" && pressed.count === 1, "Start workout presses only the Focus button", JSON.stringify(pressed));
  await page.evaluate(() => setLogMode("focus"));
  const focus = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
  }));
  assert(focus.full === "false" && focus.focus === "true" && focus.count === 1, "Focus mode presses only the Focus button", JSON.stringify(focus));
  await page.evaluate(() => enterWorkout({ focus: false }));
  const list = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
  }));
  assert(list.full === "true" && list.focus === "false" && list.count === 1, "enterWorkout keeps exactly one pressed layout button", JSON.stringify(list));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.evaluate(() => promptEndBlock());
  await page.locator("#endBlockCancel").click();
  await page.evaluate(() => promptEndBlock());
  await page.locator("#endBlockCancel").click();
  const leaked = await page.evaluate(() => ({
    inert: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
    confirm: document.querySelector("#endBlockConfirm")?.classList.contains("hidden"),
  }));
  assert(leaked.confirm && leaked.inert.length === 0, "two consecutive modals do not leak inertness/listeners", JSON.stringify(leaked));
  await context.close();
}

}

/* ---- Visual accessibility (UX-05, UX-06, A11Y-01, A11Y-02 focus/touch) ---- */

const VIEWPORTS = [
  { w: 320, h: 568, name: "320×568" },
  { w: 390, h: 844, name: "390×844" },
  { w: 430, h: 932, name: "430×932" },
];

const AUDIT_JS = `(() => {
  const parse = (str) => {
    if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return [0, 0, 0, 0];
    const m = String(str).match(/rgba?\\((\\d+(?:\\.\\d+)?)[,\\s]+(\\d+(?:\\.\\d+)?)[,\\s]+(\\d+(?:\\.\\d+)?)(?:[,\\s\\/]+(\\d+(?:\\.\\d+)?))?\\)/i);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    const h = String(str).trim();
    if (h[0] === "#") {
      const x = h.slice(1);
      if (x.length === 3) return [parseInt(x[0] + x[0], 16), parseInt(x[1] + x[1], 16), parseInt(x[2] + x[2], 16), 1];
      if (x.length === 6 || x.length === 8) return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1];
    }
    return null;
  };
  const lum = (rgb) => {
    const c = rgb.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const mix = (fg, bg) => {
    const a = Math.max(0, Math.min(1, fg[3]));
    if (a >= 0.999) return [fg[0], fg[1], fg[2], 1];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const stackedBg = (el) => {
    let bg = [244, 242, 239, 1];
    const chain = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    chain.push(document.body, document.documentElement);
    for (const n of chain.reverse()) {
      const st = getComputedStyle(n);
      const col = parse(st.backgroundColor);
      if (!col) continue;
      const op = Number(st.opacity);
      const withOp = [col[0], col[1], col[2], col[3] * (Number.isFinite(op) ? op : 1)];
      if (withOp[3] > 0.01) bg = mix(withOp, bg);
    }
    return bg;
  };
  const effectiveFg = (el, colorStr) => {
    let col = parse(colorStr) || [27, 26, 23, 1];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const op = Number(getComputedStyle(n).opacity);
      if (Number.isFinite(op) && op < 1) col = [col[0], col[1], col[2], col[3] * op];
    }
    return col;
  };
  const hidden = (el) => {
    if (!el || !(el instanceof Element)) return true;
    if (el.closest(".visually-hidden,[hidden]")) return true;
    if (el.classList.contains("hidden") || el.classList.contains("is-hidden")) return true;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return true;
    const r = el.getBoundingClientRect();
    return r.width < 0.5 || r.height < 0.5;
  };
  const largeText = (st) => {
    const px = parseFloat(st.fontSize) || 0;
    const weight = parseInt(st.fontWeight, 10) || 400;
    return px >= 24 || (px >= 18.66 && weight >= 700);
  };
  const contrastIssues = [];
  const exemptions = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\\s+/g, " ").trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || hidden(el) || el.closest("script,style,noscript")) continue;
    const st = getComputedStyle(el);
    const fg = effectiveFg(el, st.color);
    const bg = stackedBg(el);
    const composed = mix(fg, bg);
    const r = ratio(composed, bg);
    const min = largeText(st) ? 3 : 4.5;
    const disabled = !!(el.closest("[disabled], [aria-disabled='true']"));
    if (disabled) {
      exemptions.push({ text: text.slice(0, 48), why: "disabled control text", ratio: +r.toFixed(2) });
      continue;
    }
    if (largeText(st) && r >= 3 && r < 4.5) {
      exemptions.push({ text: text.slice(0, 48), why: "large text (≥18pt or ≥14pt bold) uses 3:1", ratio: +r.toFixed(2), px: parseFloat(st.fontSize) });
      continue;
    }
    if (r + 1e-6 < min) {
      contrastIssues.push({
        text: text.slice(0, 64),
        ratio: +r.toFixed(2),
        min,
        color: st.color,
        bg: st.backgroundColor,
        px: parseFloat(st.fontSize),
        tag: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className ? "." + String(el.className).trim().split(/\\s+/).slice(0, 2).join(".") : ""),
      });
    }
  }
  for (const el of document.querySelectorAll("*")) {
    if (hidden(el)) continue;
    for (const pseudo of ["::before", "::after"]) {
      const st = getComputedStyle(el, pseudo);
      const raw = st.content;
      if (!raw || raw === "none" || raw === "normal" || raw === '""' || raw === "''") continue;
      const text = raw.replace(/^["']|["']$/g, "").trim();
      if (!text || !/[\\p{L}\\p{N}]/u.test(text)) continue;
      const fg = effectiveFg(el, st.color);
      const bg = stackedBg(el);
      const r = ratio(mix(fg, bg), bg);
      const min = largeText(st) ? 3 : 4.5;
      if (r + 1e-6 < min) contrastIssues.push({ text: text.slice(0, 64), ratio: +r.toFixed(2), min, pseudo, tag: el.tagName.toLowerCase() });
    }
  }
  const sel = [
    "button", "a[href]", "summary", "input:not([type=hidden])", "select", "textarea",
    "[role=button]", "[role=tab]", "[role=switch]", "[role=checkbox]",
    "[tabindex]:not([tabindex='-1'])", ".term[data-term]",
  ].join(",");
  const seen = new Set();
  const targets = [];
  for (const el of document.querySelectorAll(sel)) {
    if (seen.has(el) || hidden(el)) continue;
    seen.add(el);
    const box = el.getBoundingClientRect();
    targets.push({
      id: el.id, tag: el.tagName.toLowerCase(), cls: String(el.className || "").split(/\\s+/).slice(0, 2).join("."),
      role: el.getAttribute("role"), w: +box.width.toFixed(2), h: +box.height.toFixed(2),
      ok: box.width + 0.01 >= 44 && box.height + 0.01 >= 44,
    });
  }
  if (window.__repforgeHeard instanceof Set) {
    for (const el of window.__repforgeHeard) {
      if (!(el instanceof Element) || seen.has(el) || hidden(el)) continue;
      seen.add(el);
      const box = el.getBoundingClientRect();
      targets.push({
        id: el.id, tag: el.tagName.toLowerCase(), cls: "heard",
        w: +box.width.toFixed(2), h: +box.height.toFixed(2),
        ok: box.width + 0.01 >= 44 && box.height + 0.01 >= 44,
      });
    }
  }
  const fields = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea")]
    .filter((el) => !hidden(el))
    .map((el) => ({ id: el.id, px: parseFloat(getComputedStyle(el).fontSize) }));
  return {
    contrastIssues,
    exemptions,
    smallTargets: targets.filter((t) => !t.ok),
    targetCount: targets.length,
    smallFields: fields.filter((f) => f.px + 1e-6 < 16),
  };
})()`;

async function auditEnabledControlText(page, rootSelector, extraTextSelectors = []) {
  return page.evaluate(
    ({ rootSelector, extraTextSelectors }) => {
      const parse = (str) => {
        if (!str || str === "transparent") return [0, 0, 0, 0];
        const match = String(str).match(
          /rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d+(?:\.\d+)?))?\)/i
        );
        if (match) {
          return [
            +match[1],
            +match[2],
            +match[3],
            match[4] == null ? 1 : +match[4],
          ];
        }
        const hex = String(str).trim();
        if (hex[0] !== "#") return null;
        const value = hex.slice(1);
        if (value.length === 3) {
          return [
            parseInt(value[0] + value[0], 16),
            parseInt(value[1] + value[1], 16),
            parseInt(value[2] + value[2], 16),
            1,
          ];
        }
        if (value.length === 6 || value.length === 8) {
          return [
            parseInt(value.slice(0, 2), 16),
            parseInt(value.slice(2, 4), 16),
            parseInt(value.slice(4, 6), 16),
            value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1,
          ];
        }
        return null;
      };
      const over = (front, back) => {
        const alpha = front[3] + back[3] * (1 - front[3]);
        if (alpha <= 0) return [0, 0, 0, 0];
        return [
          (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
          (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
          (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
          alpha,
        ];
      };
      const withOpacity = (color, opacity) => [
        color[0],
        color[1],
        color[2],
        color[3] * opacity,
      ];
      const luminance = (color) => {
        const channels = color.slice(0, 3).map((value) => {
          const channel = value / 255;
          return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0] +
          0.7152 * channels[1] +
          0.0722 * channels[2]
        );
      };
      const contrast = (a, b) => {
        const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      const visible = (element) => {
        if (!element || !element.isConnected || element.closest("[hidden]")) return false;
        for (let node = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return false;
          }
        }
        const rect = element.getBoundingClientRect();
        return rect.width >= 0.5 && rect.height >= 0.5;
      };
      const renderedPixel = (element, paint) => {
        const chain = [];
        for (let node = element; node; node = node.parentElement) chain.push(node);
        chain.reverse();
        let pixel = [255, 255, 255, 1];
        const groups = [];
        for (const node of chain) {
          const style = getComputedStyle(node);
          const opacity = Number(style.opacity);
          if (Number.isFinite(opacity) && opacity < 0.999) {
            groups.push({ backdrop: pixel, opacity });
            pixel = [0, 0, 0, 0];
          }
          const background = parse(style.backgroundColor);
          if (background && background[3] > 0) pixel = over(background, pixel);
        }
        if (paint) pixel = over(paint, pixel);
        for (let index = groups.length - 1; index >= 0; index--) {
          pixel = over(
            withOpacity(pixel, groups[index].opacity),
            groups[index].backdrop
          );
        }
        return pixel;
      };
      const keyFor = (element) => {
        const id = element.id ? `#${element.id}` : "";
        const classes = String(element.className || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((name) => `.${name}`)
          .join("");
        const data =
          element.getAttribute("data-k") ||
          element.getAttribute("data-warm") ||
          element.getAttribute("data-edrm") ||
          element.getAttribute("data-skip");
        return `${element.tagName.toLowerCase()}${id}${classes}${
          data ? `[data=${data}]` : ""
        }`;
      };
      const measure = (element, text, color) => {
        const background = renderedPixel(element, null);
        const foreground = renderedPixel(
          element,
          parse(color || getComputedStyle(element).color) || [27, 26, 23, 1]
        );
        const ratio = contrast(foreground, background);
        const opacityPath = [];
        for (let node = element; node; node = node.parentElement) {
          const opacity = Number(getComputedStyle(node).opacity);
          if (Number.isFinite(opacity) && opacity < 0.999) {
            opacityPath.push(`${keyFor(node)}=${opacity}`);
          }
        }
        return {
          element: keyFor(element),
          text: String(text).replace(/\s+/g, " ").trim().slice(0, 64),
          ratio: +ratio.toFixed(2),
          color: getComputedStyle(element).color,
          background: getComputedStyle(element).backgroundColor,
          opacityPath,
        };
      };
      const root = document.querySelector(rootSelector);
      if (!root) {
        return {
          missingRoot: rootSelector,
          controls: [],
          issues: [],
          extraText: [],
        };
      }
      const controlSelector = [
        "button",
        "a[href]",
        "input:not([type=hidden])",
        "select",
        "textarea",
        "[role=button]",
        "[role=link]",
      ].join(",");
      const controls = [
        ...(root.matches(controlSelector) ? [root] : []),
        ...root.querySelectorAll(controlSelector),
      ].filter(
        (element) =>
          visible(element) &&
          !element.matches(":disabled") &&
          element.getAttribute("aria-disabled") !== "true"
      );
      const measurements = [];
      for (const control of controls) {
        if (control.matches("input:not([type=button]):not([type=submit]),textarea")) {
          const value = control.value || control.placeholder;
          if (value) {
            const color = control.value
              ? getComputedStyle(control).color
              : getComputedStyle(control, "::placeholder").color;
            measurements.push(measure(control, value, color));
          }
          continue;
        }
        if (control.matches("select")) {
          const text = control.selectedOptions[0]?.textContent || "";
          if (text.trim()) measurements.push(measure(control, text));
          continue;
        }
        const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.replace(/\s+/g, " ").trim();
          const owner = node.parentElement;
          if (text && owner && visible(owner)) measurements.push(measure(owner, text));
        }
      }
      const extraText = extraTextSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element || !visible(element)) return { selector, missing: true };
        return { selector, ...measure(element, element.textContent) };
      });
      return {
        controls: measurements,
        issues: measurements.filter((entry) => entry.ratio + 1e-6 < 4.5),
        extraText,
      };
    },
    { rootSelector, extraTextSelectors }
  );
}

async function installVisualHooks(context) {
  await context.addInitScript(() => {
    window.__repforgeHeard = new Set();
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (this instanceof Element && (type === "click" || type === "keydown" || type === "keyup" || type === "pointerup")) {
        window.__repforgeHeard.add(this);
      }
      return orig.call(this, type, fn, opts);
    };
    const proto = CanvasRenderingContext2D.prototype;
    const origFillText = proto.fillText;
    proto.fillText = function (text, x, y, ...rest) {
      const c = this.canvas;
      c.__fillTexts = c.__fillTexts || [];
      c.__fillTexts.push({ text: String(text), fillStyle: String(this.fillStyle), font: String(this.font) });
      return origFillText.call(this, text, x, y, ...rest);
    };
  });
}

async function seedLangUnit(page, lang, unit, populated, rirMode = "numeric") {
  const blob = sampleState({
    log: populated
      ? sampleState().log.concat([
          {
            session: "s2",
            date: "2026-01-09",
            day: "Day 1",
            name: "Press",
            exerciseId: "ex1",
            set: 1,
            load: 65,
            reps: 9,
            rir: 1,
            notes: "",
            created: "2026-01-09T00:00:00.000Z",
            primary: "Chest",
            secondary: "",
          },
        ])
      : [],
  });
  blob.settings.lang = lang;
  blob.settings.unit = unit;
  blob.settings.rirMode = rirMode;
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function showView(page, view) {
  await page.evaluate((v) => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    const settings = document.querySelector("#settings");
    if (settings) settings.classList.remove("active");
    const btn = document.querySelector(`nav button[data-view="${v}"]`);
    if (btn) btn.click();
    else if (v === "settings") document.querySelector("#openSettings")?.click();
  }, view);
  if (view !== "settings") await page.waitForSelector(`#${view}.view.active`);
}

/** Seeds a program whose first slot links to a movement with licensed art. */
async function seedIllustratedProgram(page, lang) {
  const blob = sampleState({ log: [] });
  blob.settings.lang = lang;
  blob.program = [
    {
      id: "ex1",
      name: "Hack squat machine",
      day: "Day 1",
      order: 0,
      sets: 3,
      min: 4,
      max: 8,
      primary: "Quads",
      secondary: "Glutes",
      libraryId: "sqk_mc",
    },
  ];
  await page.evaluate(
    async ({ k, blob }) => {
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, blob }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => openExerciseView("ex1", "log"));
  await page.waitForSelector("#exercise.view.active", { timeout: 8000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(".exdet-art__img");
    return !!img && img.complete && img.naturalWidth > 0;
  }, { timeout: 8000 });
}

export async function runExerciseIllustrationAccessibility(browser, check = assert) {
  console.log("\nExercise detail illustration");
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearState(page);
    await seedIllustratedProgram(page, vp.w === 320 ? "pt" : "en");
    const info = await page.evaluate(() => {
      const img = document.querySelector(".exdet-art__img");
      const r = img.getBoundingClientRect();
      const field = document.querySelector(".exdet-art").getBoundingClientRect();
      const stats = document.querySelector(".exdet__stats");
      const statsCs = getComputedStyle(stats);
      const cell = stats.querySelector(".statrow__cell:not(:last-child)");
      const rec = document.querySelector("#exDetail .recblock");
      const recCs = rec ? getComputedStyle(rec) : null;
      return {
        alt: img.getAttribute("alt"),
        tabindex: img.getAttribute("tabindex"),
        role: img.getAttribute("role"),
        // A focusable image would show up in a tab order sweep; an <img> with no
        // tabindex and no handler cannot receive focus at all.
        focusable: img.matches("a,button,[tabindex]") || typeof img.onclick === "function",
        imgLeft: Math.round(r.left),
        imgRight: Math.round(r.right),
        fieldLeft: Math.round(field.left),
        fieldRight: Math.round(field.right),
        viewport: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        aspect: r.width && r.height ? +(r.width / r.height).toFixed(3) : null,
        statsTop: statsCs.borderTopWidth,
        statsBottom: statsCs.borderBottomWidth,
        cellSep: cell ? getComputedStyle(cell, "::after").content : null,
        recBorderLeft: recCs ? recCs.borderLeftWidth : null,
        recBorderColor: recCs ? recCs.borderLeftColor : null,
      };
    });
    check(
      !!info.alt && info.alt.trim().length > 0 && !info.focusable && info.tabindex === null && info.role === null,
      `Detail illustration has a localized alt and is not focusable (${vp.name})`,
      JSON.stringify(info)
    );
    check(
      info.imgLeft >= 0 &&
        info.imgRight <= info.viewport &&
        info.docScrollWidth <= info.viewport &&
        info.aspect === 1,
      `Detail illustration stays uncropped inside the viewport with no horizontal overflow (${vp.name})`,
      JSON.stringify(info)
    );
    check(
      info.fieldLeft <= 0 && info.fieldRight >= info.viewport,
      `Illustration field bleeds through main's padding to the shell edges (${vp.name})`,
      JSON.stringify(info)
    );
    check(
      info.statsTop === "0px" && info.statsBottom === "0px" && info.cellSep === "none",
      `Exercise summary metrics carry no enclosing or internal rules (${vp.name})`,
      JSON.stringify(info)
    );
    check(
      info.recBorderLeft === "3px" && /rgb\(/.test(info.recBorderColor || ""),
      `Recommendation keeps its 3px accent rail (${vp.name})`,
      JSON.stringify(info)
    );
    await context.close();
  }
}

export async function runHistoryResponsiveLayoutChecks(browser, check = assert) {
  console.log("\nResponsive History layout (320×568)");
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await context.newPage();
  await installVisualHooks(context);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await seedLangUnit(page, "en", "kg", true);
  await showView(page, "history");
  await page.waitForSelector("#history.view.active");
  await page.waitForSelector("#sessions [data-sess]");
  await page.waitForFunction(() => document.querySelectorAll(".cal-grid__day").length >= 28);

  const sessionCount = await page.locator("#sessions [data-sess]").count();
  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const history = document.querySelector("#history");
    const calendar = document.querySelector(".cal-grid");
    const days = [...document.querySelectorAll(".cal-grid__day")];
    const measure = (el) => ({
      clientWidth: el?.clientWidth || 0,
      scrollWidth: el?.scrollWidth || 0,
    });
    const columns = calendar ? getComputedStyle(calendar).gridTemplateColumns : "";
    return {
      viewport: { innerWidth: window.innerWidth, clientWidth: root.clientWidth },
      document: measure(root),
      history: measure(history),
      calendar: {
        ...measure(calendar),
        columns,
        columnCount: columns.split(/\s+/).filter(Boolean).length,
        dayCount: days.length,
        dowCount: document.querySelectorAll(".cal-grid__dow").length,
        minDayHeight: Math.min(...days.map((day) => day.getBoundingClientRect().height)),
      },
    };
  });

  const fits = (measurement) => measurement.scrollWidth <= measurement.clientWidth;

  check(sessionCount === 2, "320px History opens with two seeded sessions", `count=${sessionCount}`);
  check(
    fits(layout.document),
    "320px populated History does not overflow the document",
    JSON.stringify({ viewport: layout.viewport, document: layout.document })
  );
  check(
    fits(layout.history),
    "320px populated History fits its own content box",
    JSON.stringify(layout.history)
  );
  check(
    fits(layout.calendar) &&
      layout.calendar.columnCount === 7 &&
      layout.calendar.dowCount === 7 &&
      layout.calendar.dayCount >= 28 &&
      layout.calendar.minDayHeight >= 44,
    "320px History calendar keeps seven columns without horizontal overflow",
    JSON.stringify(layout.calendar)
  );

  await context.close();
}

/* Views enter under `animation: rise .35s both` and the workout shell under
   `woEnter`, both of which start from opacity 0 and scale(.98). Fill mode `both`
   means computed style reports that opening keyframe until the animation
   timeline actually advances, so a runner that is starved of frames hands the
   audits a page that is fully transparent and 2% too small. That reads as text
   at a contrast ratio of exactly 1 against its own backdrop, and as 43.12px tap
   targets. Jump every finite animation to its end state so the audits measure
   the settled page they are asking about. The rest-over indicator loops
   forever and `finish()` rejects an infinite animation, so failures are per
   animation rather than fatal. */
async function settleAnimations(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {}
    }
  });
}

async function visitSurfaces(page) {
  await showView(page, "log");
  await page.evaluate(() => toast("audit toast"));
  await showView(page, "stats");
  await page.evaluate(() => {
    if (typeof setStatsSeg === "function") {
      setStatsSeg("overview");
      setStatsSeg("strength");
      setStatsSeg("volume");
      setStatsSeg("prs");
      setStatsSeg("overview");
    }
  });
  await showView(page, "history");
  await showView(page, "program");
  await showView(page, "log");
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await showView(page, "log");
  const start = page.locator("#startWorkout");
  if (await start.isVisible()) {
    await start.click();
    await page.waitForSelector("#workoutShell:not(.hidden)");
    await page.evaluate(() => {
      if (typeof setLogMode === "function") setLogMode("full");
    });
    const term = page.locator(".term[data-term]").first();
    if (await term.count()) await term.click().catch(() => {});
  }
  await settleAnimations(page);
}

async function runTouchTarget320Regression(browser) {
  console.log("\nNarrow list-mode touch targets (320×568)");
  for (const mode of ["numeric", "effort"]) {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearState(page);
    await seedLangUnit(page, "en", "kg", true, mode);
    await page.click("#viewExercises");
    await page.waitForSelector("#workoutShell:not(.hidden) #workout .setrow");
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish())
    );

    const layout = await page.evaluate((rirMode) => {
      const round = (value) => +value.toFixed(2);
      const rectOf = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: round(rect.x),
          y: round(rect.y),
          w: round(rect.width),
          h: round(rect.height),
          right: round(rect.right),
          bottom: round(rect.bottom),
        };
      };
      const selectorFor = (element) => {
        const tag = element.tagName.toLowerCase();
        if (element.dataset.k) return `${tag}[data-k="${element.dataset.k}"]`;
        if (element.dataset.warm) return `${tag}[data-warm="${element.dataset.warm}"]`;
        if (element.dataset.save) return `${tag}[data-save="${element.dataset.save}"]`;
        if (element.dataset.step) {
          return `${tag}[data-step="${element.dataset.step}"][data-dir="${element.dataset.dir}"]`;
        }
        if (element.dataset.eff) {
          return `${tag}[data-eff="${element.dataset.eff}"][data-e="${element.dataset.e}"]`;
        }
        return tag;
      };
      const categoryFor = (element) => {
        if (element.dataset.warm) return "warm-up";
        if (element.dataset.save) return "save";
        if (element.dataset.step) return "load-step";
        if (element.dataset.eff) return "effort";
        if (element.dataset.k?.endsWith("_load")) return "load";
        if (element.dataset.k?.endsWith("_reps")) return "reps";
        if (element.dataset.k?.endsWith("_rir")) return "rir";
        return element.tagName.toLowerCase();
      };
      const rows = [...document.querySelectorAll("#workout .setrow")];
      const targets = rows.flatMap((row) =>
        [...row.querySelectorAll("button,input:not([type=hidden])")].map((element) => ({
          selector: selectorFor(element),
          category: categoryFor(element),
          type: element.getAttribute("type"),
          inputMode: element.getAttribute("inputmode"),
          rect: rectOf(element),
        }))
      );
      const expectedFieldSelectors = rows.flatMap((row) => {
        const key = row.dataset.set;
        const selectors = [
          `input[data-k="${key}_load"]`,
          `input[data-k="${key}_reps"]`,
        ];
        if (rirMode === "numeric") selectors.push(`input[data-k="${key}_rir"]`);
        return selectors;
      });
      const actualFieldSelectors = rows.flatMap((row) =>
        [...row.querySelectorAll("input[data-k]")].map(selectorFor)
      );
      const loadInputs = targets.filter((target) => target.category === "load");
      const violations = targets.filter(
        ({ rect }) => rect.w + 0.01 < 44 || rect.h + 0.01 < 44
      );
      const overlaps = [];
      for (const row of rows) {
        const firstLine = [...row.children]
          .filter((element) => !element.classList.contains("effort"))
          .map((element) => ({ selector: selectorFor(element), rect: rectOf(element) }))
          .sort((a, b) => a.rect.x - b.rect.x);
        for (let index = 1; index < firstLine.length; index++) {
          if (firstLine[index - 1].rect.right > firstLine[index].rect.x + 0.01) {
            overlaps.push([firstLine[index - 1], firstLine[index]]);
          }
        }
        const load = row.querySelector(".kg input");
        const down = row.querySelector('.kg [data-dir="-1"]');
        const up = row.querySelector('.kg [data-dir="1"]');
        if (load && down && up) {
          const loadRect = rectOf(load);
          const downRect = rectOf(down);
          const upRect = rectOf(up);
          if (
            loadRect.bottom > downRect.y + 0.01 ||
            loadRect.bottom > upRect.y + 0.01 ||
            downRect.right > upRect.x + 0.01
          ) {
            overlaps.push([
              { selector: selectorFor(load), rect: loadRect },
              { selector: `${selectorFor(down)} / ${selectorFor(up)}`, rect: downRect },
            ]);
          }
        }
      }
      const dimensions = {};
      for (const target of targets) {
        dimensions[target.category] ||= [];
        const value = `${target.rect.w}×${target.rect.h}`;
        if (!dimensions[target.category].includes(value)) {
          dimensions[target.category].push(value);
        }
      }
      const root = document.documentElement;
      const workout = document.querySelector("#workout");
      const firstRow = rows[0];
      const header = document.querySelector("#workout .sets__head");
      const rowTracks = firstRow ? getComputedStyle(firstRow).gridTemplateColumns : "";
      const headerTracks = header ? getComputedStyle(header).gridTemplateColumns : "";
      return {
        mode: rirMode,
        rowCount: rows.length,
        expectedFieldSelectors,
        actualFieldSelectors,
        loadInputs,
        targetCount: targets.length,
        violations,
        overlaps,
        dimensions,
        rowTracks,
        headerTracks,
        overflow: {
          document: { client: root.clientWidth, scroll: root.scrollWidth },
          workout: {
            client: workout?.clientWidth || 0,
            scroll: workout?.scrollWidth || 0,
          },
          rows: rows.map((row) => ({
            key: row.dataset.set,
            client: row.clientWidth,
            scroll: row.scrollWidth,
          })),
        },
      };
    }, mode);

    const exactFields =
      layout.rowCount === 3 &&
      JSON.stringify(layout.actualFieldSelectors) ===
        JSON.stringify(layout.expectedFieldSelectors) &&
      layout.loadInputs.length === 3 &&
      layout.loadInputs.every(
        ({ type, inputMode }) => type === "text" && inputMode === "decimal"
      );
    assert(
      exactFields,
      `320px ${mode} rows expose the exact expected set-field selectors`,
      JSON.stringify({
        expected: layout.expectedFieldSelectors,
        actual: layout.actualFieldSelectors,
        loads: layout.loadInputs,
      })
    );
    assert(
      layout.violations.length === 0,
      `320px ${mode} row actions are all at least 44×44 CSS px`,
      JSON.stringify(layout.violations)
    );
    const noOverflow =
      layout.rowTracks === layout.headerTracks &&
      layout.overlaps.length === 0 &&
      layout.overflow.document.scroll <= layout.overflow.document.client &&
      layout.overflow.workout.scroll <= layout.overflow.workout.client &&
      layout.overflow.rows.every(({ client, scroll }) => scroll <= client);
    assert(
      noOverflow,
      `320px ${mode} header and rows align without overlap or horizontal overflow`,
      JSON.stringify({
        tracks: { header: layout.headerTracks, row: layout.rowTracks },
        overlaps: layout.overlaps,
        overflow: layout.overflow,
      })
    );
    console.log(
      `    ${mode}: ${layout.rowTracks}; ${JSON.stringify(layout.dimensions)}`
    );
    await context.close();
  }
}

async function runDimmedStateAccessibility(browser) {
  console.log("\nDimmed-state accessibility");
  const expected = {
    en: {
      skipped: "Skipped",
      restore: "Restore",
      restoreAria: "Restore Press today",
      skip: "Skip",
      skipAria: "Skip Press today",
      removeSet: "Remove set",
      undoRemove: "Undo remove",
    },
    pt: {
      skipped: "Pulado",
      restore: "Restaurar",
      restoreAria: "Restaurar Press hoje",
      skip: "Pular",
      skipAria: "Pular Press hoje",
      removeSet: "Remover série",
      undoRemove: "Desfazer remoção",
    },
  };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);

  for (const lang of ["en", "pt"]) {
    const first = sampleState().log[0];
    const blob = sampleState({
      log: [
        first,
        {
          ...first,
          set: 2,
          load: 55,
          reps: 11,
        },
      ],
    });
    blob.settings.lang = lang;
    await page.evaluate((draftKey) => localStorage.removeItem(draftKey), DRAFT);
    await persistState(page, blob);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await showView(page, "log");

    await page.click("#startWorkout");
    await page.waitForSelector("#workoutShell:not(.hidden)");
    await page.evaluate(() => setLogMode("full"));
    await page.locator("#workout [data-warm]").first().click();
    await page.waitForSelector("#workout .setrow.is-warmup");
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish())
    );
    const warmup = await auditEnabledControlText(
      page,
      "#workout .setrow.is-warmup"
    );
    assert(
      warmup.controls.length >= 5,
      `warm-up state exposes its enabled control text to the contrast audit (${lang})`,
      JSON.stringify(warmup)
    );
    assert(
      warmup.issues.length === 0,
      `warm-up enabled control text contrast ≥4.5:1 (${lang})`,
      JSON.stringify(warmup.issues)
    );

    await page.locator("#workout .exercise .ex__skip").first().click();
    await page.waitForSelector("#workout .exercise.is-skipped");
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish())
    );
    const semantics = await page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-skipped");
      const action = card?.querySelector(".ex__skip");
      const status = card?.querySelector(".ex__state");
      const name = card?.querySelector(".ex__name");
      return {
        actionText: action?.textContent.replace(/\s+/g, " ").trim() || "",
        actionAria: action?.getAttribute("aria-label") || "",
        statusText: status?.textContent.replace(/\s+/g, " ").trim() || "",
        statusIsRealDom: !!status,
        generatedNameContent: name
          ? getComputedStyle(name, "::after").content
          : "",
      };
    });
    const copy = expected[lang];
    assert(
      semantics.actionText === copy.restore &&
        semantics.actionAria === copy.restoreAria &&
        semantics.statusText === copy.skipped &&
        semantics.statusIsRealDom &&
        !["Skipped", "Pulado"].some((label) =>
          semantics.generatedNameContent.includes(label)
        ),
      `skipped label and restore action are state-correct real DOM copy (${lang})`,
      JSON.stringify({ expected: copy, actual: semantics })
    );
    const skipped = await auditEnabledControlText(
      page,
      "#workout .exercise.is-skipped",
      ["#workout .exercise.is-skipped .ex__state"]
    );
    assert(
      skipped.issues.length === 0 &&
        skipped.extraText.length === 1 &&
        !skipped.extraText[0].missing &&
        skipped.extraText[0].ratio >= 4.5,
      `skipped label/action and enabled control text contrast ≥4.5:1 (${lang})`,
      JSON.stringify(skipped)
    );

    await page.locator("#workout .exercise.is-skipped .ex__skip").click();
    await page.waitForSelector("#workout .exercise:not(.is-skipped)");
    const restored = await page.evaluate(() => {
      const action = document.querySelector("#workout .exercise .ex__skip");
      return {
        text: action?.textContent.replace(/\s+/g, " ").trim() || "",
        aria: action?.getAttribute("aria-label") || "",
      };
    });
    assert(
      restored.text === copy.skip && restored.aria === copy.skipAria,
      `restoring returns the action to Skip semantics (${lang})`,
      JSON.stringify({ expected: copy, actual: restored })
    );

    await page.evaluate(() => leaveWorkout());
    await showView(page, "history");
    await page.waitForSelector("#sessions [data-sess]");
    await page.locator("#sessions .session__toggle").first().click();
    await page.locator("#sessions [data-edit]").first().click();
    await page.waitForSelector(".session--edit");
    const removeAction = await page.evaluate(() => {
      const action = document.querySelector(".session--edit [data-edrm]");
      const box = action?.getBoundingClientRect();
      return {
        text: action?.textContent.replace(/\s+/g, " ").trim() || "",
        aria: action?.getAttribute("aria-label") || "",
        width: box ? +box.width.toFixed(2) : 0,
        height: box ? +box.height.toFixed(2) : 0,
      };
    });
    assert(
      removeAction.text === "×" &&
        removeAction.aria === copy.removeSet &&
        removeAction.width >= 36 &&
        removeAction.height >= 36,
      `history remove-set action is an icon-only box with an accessible name (${lang})`,
      JSON.stringify(removeAction)
    );
    await page.locator(".session--edit [data-edrm]").first().click();
    await page.waitForSelector(".session--edit .edrow.is-removed");
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish())
    );
    const removed = await auditEnabledControlText(
      page,
      ".session--edit .edrow.is-removed"
    );
    const removedState = await page.evaluate(() => {
      const row = document.querySelector(".session--edit .edrow.is-removed");
      const fields = [...(row?.querySelectorAll(".edrow__in") || [])];
      const action = row?.querySelector("[data-edrm]");
      return {
        fieldCount: fields.length,
        disabledCount: fields.filter((field) => field.disabled).length,
        actionText: action?.textContent.replace(/\s+/g, " ").trim() || "",
        actionAria: action?.getAttribute("aria-label") || "",
        actionDisabled: !!action?.disabled,
      };
    });
    assert(
      removedState.fieldCount === 3 &&
        removedState.disabledCount === 3 &&
        !removedState.actionDisabled &&
        removedState.actionText === "↺" &&
        removedState.actionAria === copy.undoRemove,
      `history removed row distinguishes disabled fields from enabled restore action (${lang})`,
      JSON.stringify(removedState)
    );
    assert(
      removed.issues.length === 0,
      `history removed-row enabled control text contrast ≥4.5:1 (${lang})`,
      JSON.stringify(removed)
    );
  }
  await context.close();
}

function canvasContrast(page, sel) {
  return page.evaluate((selector) => {
    const parse = (str) => {
      if (!str || str === "transparent") return [0, 0, 0, 0];
      const m = String(str).match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d+(?:\.\d+)?))?\)/i);
      if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
      const h = String(str).trim();
      if (h[0] === "#" && (h.length === 7 || h.length === 9)) {
        return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), h.length === 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1];
      }
      if (h[0] === "#" && h.length === 4) {
        return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16), 1];
      }
      return null;
    };
    const lum = (rgb) => {
      const c = rgb.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const css = getComputedStyle(document.documentElement);
    const bgHex = css.getPropertyValue("--bg").trim() || "#F4F2EF";
    const bg = parse(bgHex) || parse("rgb(244, 242, 239)");
    const c = document.querySelector(selector);
    const texts = c?.__fillTexts || [];
    const palette = window.__repforgeChartPalette?.() || null;
    const fails = [];
    for (const t of texts) {
      const fg = parse(t.fillStyle);
      if (!fg) {
        fails.push({ text: t.text, fillStyle: t.fillStyle, reason: "unparsed" });
        continue;
      }
      const r = ratio(fg, bg);
      if (r + 1e-6 < 4.5) fails.push({ text: t.text, fillStyle: t.fillStyle, ratio: +r.toFixed(2) });
    }
    return { count: texts.length, fails, palette, bg: bgHex };
  }, sel);
}

async function runVisualAccessibility(browser) {
console.log("\nVisual accessibility (UX-05 / UX-06 / A11Y-01 / A11Y-02)");

{
  const { context, page } = await freshPage(browser);
  // Zoom is off by decision: the layout is fixed to the phone and worked
  // one-handed mid-set, so the meta pins the scale and the root takes panning
  // only. Text size is what has to carry legibility instead, which is why the
  // font-size floors below are the assertions that matter here.
  const meta = await page.evaluate(() => {
    const content = document.querySelector('meta[name="viewport"]')?.content || "";
    return {
      content,
      blocks: /\bmaximum-scale\s*=\s*1\b/.test(content) && /\buser-scalable\s*=\s*no\b/i.test(content),
      root: getComputedStyle(document.documentElement).touchAction,
    };
  });
  assert(meta.blocks && /width=device-width/.test(meta.content) && /initial-scale=1/.test(meta.content), "viewport pins the scale at 1", JSON.stringify(meta));
  assert(meta.root === "pan-x pan-y", "root takes panning only, never a zoom", meta.root);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const fonts = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("#workout input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #workout select, #workout textarea, #notes, #bodyweight, #date")];
    return nodes.filter((el) => getComputedStyle(el).display !== "none").map((el) => ({ id: el.id, px: parseFloat(getComputedStyle(el).fontSize) }));
  });
  assert(fonts.every((f) => f.px >= 16), "visible editable fields are at least 16px", JSON.stringify(fonts));
  const touch = await page.evaluate(() => {
    const step = document.querySelector(".stepbtn, .curset__step");
    const field = document.querySelector("#workout input, #workout .curset__val");
    return {
      step: step ? getComputedStyle(step).touchAction : null,
      field: field ? getComputedStyle(field).touchAction : null,
    };
  });
  assert(touch.step === "manipulation" && touch.field === "manipulation", "controls retain touch-action:manipulation", JSON.stringify(touch));
  await page.evaluate(() => setLogMode("focus"));
  await page.waitForSelector("#workout .exercise.is-current");
  const grip = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const ledger = card?.querySelector(".fcard__ledger");
    return {
      card: card ? getComputedStyle(card).touchAction : null,
      ledger: ledger ? getComputedStyle(ledger).touchAction : null,
      scrolls: ledger ? ledger.scrollHeight > ledger.clientHeight + 1 : false,
    };
  });
  const wantLedger = grip.scrolls ? "pan-y" : "none";
  assert(grip.card === "pan-y" && grip.ledger === wantLedger, "Focus card/ledger take panning only, never a zoom", JSON.stringify(grip));
  await context.close();
}

{
  const context = await browser.newContext();
  await installVisualHooks(context);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  const settingsRing = await page.evaluate(() => {
    const el = document.querySelector("#unit, .settings-row select");
    el?.focus();
    const st = getComputedStyle(el);
    return { outline: st.outlineStyle, outlineW: parseFloat(st.outlineWidth) || 0, shadow: st.boxShadow };
  });
  assert(
    (settingsRing.outline !== "none" && settingsRing.outlineW > 0) || (settingsRing.shadow && settingsRing.shadow !== "none"),
    "Settings select shows a non-zero focus outline/ring",
    JSON.stringify(settingsRing)
  );
  await page.evaluate(() => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    document.querySelector("#settings")?.classList.remove("active");
    document.querySelector('nav button[data-view="stats"]')?.click();
  });
  await page.waitForSelector("#stats.view.active");
  await page.evaluate(() => typeof setStatsSeg === "function" && setStatsSeg("overview"));
  await page.waitForSelector("#statExercise", { state: "visible" });
  const strengthRing = await page.evaluate(() => {
    const el = document.querySelector("#statExercise");
    if (!el) return { missing: true };
    el.focus();
    const st = getComputedStyle(el);
    return { outline: st.outlineStyle, outlineW: parseFloat(st.outlineWidth) || 0, shadow: st.boxShadow, outlineColor: st.outlineColor };
  });
  assert(
    !strengthRing.missing && ((strengthRing.outline !== "none" && strengthRing.outlineW > 0) || (strengthRing.shadow && strengthRing.shadow !== "none")),
    "Strength select shows a non-zero focus outline/ring",
    JSON.stringify(strengthRing)
  );
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const states = [
    ["en", "kg", "Bodyweight (kg, optional)"],
    ["en", "lb", "Bodyweight (lb, optional)"],
    ["pt", "kg", "Peso corporal (kg, opcional)"],
    ["pt", "lb", "Peso corporal (lb, opcional)"],
  ];
  for (const [lang, unit, expected] of states) {
    await page.evaluate(
      ({ lang, unit }) => {
        state.settings.lang = lang;
        state.settings.unit = unit;
        if (window.RepForgeI18n) window.RepForgeI18n.setLang(lang);
        syncLang();
        updateBodyweightField();
      },
      { lang, unit }
    );
    await page.click("#startWorkout").catch(() => {});
    const info = await page.evaluate((expected) => {
      const lbl = document.querySelector("#bodyweightLabel");
      const span = lbl?.querySelector("span");
      const extras = [...(lbl?.childNodes || [])].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent);
      const hits = (lbl?.textContent || "").match(/Bodyweight|Peso corporal/g) || [];
      return { span: (span?.textContent || "").replace(/\s+/g, " ").trim(), extras, hits: hits.length, expected };
    }, expected);
    assert(
      info.span === expected && info.extras.length === 0 && info.hits === 1,
      `bodyweight label is singular and translated (${lang}/${unit})`,
      JSON.stringify(info)
    );
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installVisualHooks(context);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  for (const populated of [false, true]) {
    for (const lang of ["en", "pt"]) {
      await seedLangUnit(page, lang, "kg", populated);
      await visitSurfaces(page);
      const audit = await page.evaluate(AUDIT_JS);
      assert(
        audit.contrastIssues.length === 0,
        `visible text contrast ≥4.5:1 (${lang}, ${populated ? "populated" : "empty"})`,
        JSON.stringify({ issues: audit.contrastIssues.slice(0, 8), exemptions: audit.exemptions.slice(0, 6) })
      );
      await page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-focus-wo");
        if (typeof leaveWorkout === "function") leaveWorkout();
        document.querySelector('nav button[data-view="stats"]')?.click();
      });
      await page.waitForSelector("#stats.view.active");
      await page.evaluate(() => {
        if (typeof redrawChart === "function") redrawChart();
        const canvas = document.querySelector("#chart");
        if (canvas) canvas.__fillTexts = [];
        if (typeof draw === "function") {
          const rows = (state.log || []).filter((r) => r.exerciseId === (state.program?.[0]?.id)).map((r) => ({ date: r.date, e1rm: r.load * (1 + r.reps / 30), top: r.load }));
          draw(rows.length ? rows : [], "#chart");
        }
      });
      const chart = await canvasContrast(page, "#chart");
      assert(chart.fails.length === 0, `#chart canvas text contrast (${lang}, ${populated ? "populated" : "empty"})`, JSON.stringify(chart));
      assert(!!chart.palette && !!chart.palette.text, "window.__repforgeChartPalette exposes tokenized chart text color", JSON.stringify(chart.palette));
      await page.evaluate(() => {
        const key = state.program?.[0]?.id;
        if (key && typeof openExerciseView === "function") openExerciseView(key, "stats");
      });
      await page.waitForSelector("#exChart", { timeout: 8000 });
      await page.evaluate((populated) => {
        const ex = document.querySelector("#exChart");
        if (ex) ex.__fillTexts = [];
        if (typeof draw === "function") {
          const rows = (state.log || []).filter((r) => r.exerciseId === (state.program?.[0]?.id)).map((r) => ({ date: r.date, e1rm: r.load * (1 + r.reps / 30), top: r.load }));
          draw(populated ? rows : [], "#exChart");
        }
      }, populated);
      const exChart = await canvasContrast(page, "#exChart");
      assert(exChart.fails.length === 0, `#exChart canvas text contrast (${lang}, ${populated ? "populated" : "empty"})`, JSON.stringify(exChart));
      await page.evaluate(() => {
        document.body.classList.remove("is-exercise");
        if (typeof closeExerciseView === "function") closeExerciseView();
      });
    }
  }
  await context.close();
}

{
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await installVisualHooks(context);
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearState(page);
    await seedLangUnit(page, "en", "kg", true);
    await visitSurfaces(page);
    const audit = await page.evaluate(AUDIT_JS);
    assert(
      audit.smallTargets.length === 0,
      `visible actions are at least 44×44 CSS px (${vp.name})`,
      JSON.stringify({ count: audit.targetCount, small: audit.smallTargets.slice(0, 12) })
    );
    await context.close();
  }
}

}

async function runSharedSetupAccessibility(browser) {
console.log("\nShared setup gate accessibility");

{
  const { context, page } = await openAppPage(browser);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  const standard = await page.evaluate(() => {
    const hiddenRoot = (node) =>
      !node || node.hidden === true || node.classList.contains("hidden") || !!node.closest(".hidden,[hidden]");
    const focusable = (node) => {
      if (!node || hiddenRoot(node) || node.disabled) return false;
      const st = getComputedStyle(node);
      return st.display !== "none" && st.visibility !== "hidden";
    };
    const start = document.querySelector("#firstRunSharedStart");
    const error = document.querySelector("#firstRunSharedError");
    const sharedGroup = document.querySelector("#firstRunSharedProgram");
    const groupStops = (root) =>
      root
        ? [...root.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((n) => focusable(n)).map((n) => n.id)
        : [];
    return {
      createFocusable: focusable(document.querySelector("#firstRunCreate")),
      importFocusable: focusable(document.querySelector("#firstRunImport")),
      startFocusable: focusable(start),
      errorExposed: !!(error && !hiddenRoot(error) && error.getAttribute("role") === "status" && (error.textContent || "").trim()),
      sharedStops: groupStops(sharedGroup),
    };
  });
  assert(standard.createFocusable && standard.importFocusable, "standard first run: Create and Import stay keyboard-reachable", JSON.stringify(standard));
  assert(!standard.startFocusable, "standard first run: shared Start is absent or not focusable", JSON.stringify(standard));
  assert(!standard.errorExposed, "standard first run: shared error status stays silent", JSON.stringify(standard));
  assert(standard.sharedStops.length === 0, "standard first run: hidden shared group exposes no tab stops", JSON.stringify(standard.sharedStops));
  await context.close();
}

{
  const { context, page } = await openAppPage(browser);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
  const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
  assert(encoded.ok === true, "shared a11y: payload encodes", JSON.stringify(encoded));
  if (encoded.ok) {
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 }).catch(() => {});
    const gate = await page.evaluate(sharedGateSnapshot);
    assert(gate.startVisible && gate.startFocusable, "shared first run: Start this program is keyboard-reachable", JSON.stringify(gate));
    assert(!gate.createFocusable && !gate.importFocusable, "shared first run: Create/Import are not keyboard-reachable", JSON.stringify(gate));
    assert(
      gate.startName.includes(SHARED_COPY.en.title) && gate.startName.includes("Coach program"),
      "shared first run: Start has an accessible name from title and caption",
      gate.startName
    );
    const ring = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { missing: true };
      el.focus();
      const st = getComputedStyle(el);
      return {
        outline: st.outlineStyle,
        outlineW: parseFloat(st.outlineWidth) || 0,
        shadow: st.boxShadow,
        outlineColor: st.outlineColor,
      };
    }, SHARED_DOM.start);
    assert(
      !ring.missing && ((ring.outline !== "none" && ring.outlineW > 0) || (ring.shadow && ring.shadow !== "none")),
      "shared first run: Start shows a visible focus treatment",
      JSON.stringify(ring)
    );
    const trap = await tabWrap(page, "#firstRun");
    assert(trap.forward.inside && trap.back.inside, "shared first run: Tab stays inside the gate", JSON.stringify(trap));
  }
  await context.close();
}

{
  const { context, page } = await openAppPage(browser);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.goto(`${APP_INDEX}#setup=v1.not+base64`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 }).catch(() => {});
  const invalid = await page.evaluate(sharedGateSnapshot);
  assert(invalid.errorRole === "status", "invalid shared link: error is a status live region", JSON.stringify(invalid));
  assert(invalid.errorVisible && invalid.errorText === SHARED_COPY.en.invalid, "invalid shared link: error is announced with the invalid copy", JSON.stringify(invalid));
  assert(invalid.createFocusable && invalid.importFocusable, "invalid shared link: standard choices remain reachable", JSON.stringify(invalid));
  await context.close();
}

{
  const { context, page } = await openAppPage(browser);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const encoded = await encodeSharedPayload(page, cloneFixture(MINIMAL_PAYLOAD));
  if (!encoded.ok) {
    assert(false, "shared busy a11y: payload encodes", JSON.stringify(encoded));
  } else {
    await page.goto(`${APP_INDEX}#setup=${encoded.value}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#firstRunSharedStart", { timeout: 15000 }).catch(() => {});
    const busy = await page.evaluate(async () => {
      const hook = window.__repforgeSharedSetup;
      const start = document.querySelector("#firstRunSharedStart");
      if (!hook?.commit || !start) return { missing: true, hasStart: !!start };
      hook.commit({
        writeLocal() { return new Promise(() => {}); },
        writeIdb() { return new Promise(() => {}); },
      });
      await new Promise((res) => setTimeout(res, 50));
      return {
        missing: false,
        disabled: !!start.disabled,
        busy: start.getAttribute("aria-busy") === "true",
      };
    });
    assert(!busy.missing && busy.disabled && busy.busy, "shared commit: busy state is disabled and announced", JSON.stringify(busy));
  }
  await context.close();
}

}

async function main() {
  const browser = await launchChromium();
  if (process.argv.includes("--touch-targets-320")) {
    await runTouchTarget320Regression(browser);
  } else if (process.argv.includes("--history-tour")) {
    await runLocalizedHistoryAndTourChecks(browser);
  } else if (process.argv.includes("--history-320")) {
    await runHistoryResponsiveLayoutChecks(browser);
  } else if (process.argv.includes("--dimmed-states")) {
    await runDimmedStateAccessibility(browser);
  } else if (process.argv.includes("--workout-validation-focus")) {
    await runWorkoutValidationFocusCheck(browser);
  } else if (process.argv.includes("--exercise-illustration")) {
    await runExerciseIllustrationAccessibility(browser);
  } else if (process.argv.includes("--shared-setup")) {
    await runSharedSetupAccessibility(browser);
  } else {
    await runWorkoutValidationFocusCheck(browser);
    await runAccessibleInteractions(browser);
    await runExerciseIllustrationAccessibility(browser);
    await runHistoryResponsiveLayoutChecks(browser);
    await runLocalizedHistoryAndTourChecks(browser);
    await runDimmedStateAccessibility(browser);
    await runVisualAccessibility(browser);
    await runSharedSetupAccessibility(browser);
  }
  await browser.close();
  console.log(`\n${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("accessibility.mjs crashed:", err);
    process.exit(2);
  });
}
