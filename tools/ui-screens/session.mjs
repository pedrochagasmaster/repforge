/**
 * Browser session helpers shared by every capture scenario.
 *
 * Each capture gets its own isolated context with service workers blocked, so
 * a previously installed shell can never serve stale application code into
 * the evidence. Date is pinned because several surfaces render "3 days ago".
 */
import { launchChromium } from "../../test/browser.mjs";

export let BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
export function setCaptureBase(url) { BASE = url; }
export const KEY = "repforge_v1";
export const UI_KEY = "repforge_ui_v1";
export const LOG_DRAFT = "repforge_draft_v1";
export const SETUP_DRAFT = "repforge_program_setup_draft_v1";
// Resume renders a draft's updatedAt as a calendar date, and Today derives the
// scheduled day from the clock. Pin both so the catalog is reproducible.
export const CAPTURE_NOW = process.env.CAPTURE_NOW || "2026-08-31T12:00:00.000Z";

/* Contextual guides are modal dialogs, and the rendered-role audits skip what a modal makes inert. The catalog therefore
   draws every state on a device whose guides have been read (test/browser.mjs), so each surface is audited whole, and
   each guide has its own state that replays it over its real surface (the `*-guide` states and settings/guides-replay). */
export { launchChromium };

export const sleep = (page, ms = 300) => page.waitForTimeout(ms);

/** A guide state: Settings → Replay for one guide, which opens its dialog over the surface already on screen. */
export async function replayGuide(page, id) {
  await page.evaluate((guide) => window.__repforgeUi.replayGuide(guide), id);
  await page.waitForFunction((guide) => !!document.querySelector(`dialog#guideDialog[open][data-guide="${guide}"]`), id, { timeout: 20000 });
  await sleep(page, 300);
}

export function waitForApp(page) {
  // Hooks mount before durable state has loaded; a scenario may read state.
  return page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function"
      && typeof window.__repforgeUi?.setTheme === "function"
      && window.__repforgeBooted === true,
    undefined,
    { timeout: 20000 }
  );
}

async function seedStorage(page, state) {
  await page.evaluate(async ({ key, logDraft, setupDraft, uiKey, blob }) => {
    localStorage.removeItem(logDraft);
    localStorage.removeItem(setupDraft);
    localStorage.removeItem(uiKey);
    await new Promise((done) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = done;
      request.onerror = done;
      request.onblocked = done;
    });
    localStorage.setItem(key, JSON.stringify(blob));
    await new Promise((done, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, key);
        tx.oncomplete = () => { db.close(); done(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { key: KEY, logDraft: LOG_DRAFT, setupDraft: SETUP_DRAFT, uiKey: UI_KEY, blob: state });
}

/**
 * Reseed a running capture. The interface preferences carry the capture's theme, and seedStorage clears them so the
 * first boot starts clean; a reseed keeps them, or the reload boots back on the default palette under a dark file name.
 */
export async function seed(page, state) {
  const ui = await page.evaluate((uiKey) => localStorage.getItem(uiKey), UI_KEY);
  await seedStorage(page, state);
  if (ui !== null) await page.evaluate(({ uiKey, value }) => localStorage.setItem(uiKey, value), { uiKey: UI_KEY, value: ui });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

/**
 * Prove the production loader accepted the fixture. openPage seeds on an
 * inert same-origin document before boot, so no empty app can race its writes.
 */
async function verifySeed(page, state) {
  const last = await page.evaluate((key) => {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        onboarded: !!stored?.programMeta?.onboarded,
        exercises: (stored?.program || []).length,
        revision: stored?._storageRevision ?? null,
      };
    }, KEY);
  if (last.onboarded === !!state.programMeta?.onboarded && last.exercises === (state.program || []).length) return;
  throw new Error(
    `seeded state did not survive boot: wanted onboarded=${!!state.programMeta?.onboarded} `
    + `exercises=${(state.program || []).length}, got onboarded=${last?.onboarded} exercises=${last?.exercises}`
  );
}

export async function openPage(browser, manifest, capture, state, options = {}) {
  const viewport = manifest.viewports[capture.viewport];
  const locale = manifest.locales[capture.locale];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: manifest.deviceScaleFactor,
    locale: locale.browserLocale,
    timezoneId: "UTC",
    colorScheme: capture.theme === "dark" ? "dark" : "light",
    reducedMotion: manifest.motion[capture.motion].prefersReducedMotion ? "reduce" : "no-preference",
    serviceWorkers: "block",
    ...(options.userAgent ? { userAgent: options.userAgent } : {}),
  });
  // A full run opens a couple of hundred contexts back to back. Playwright's
  // 30s default is comfortable for one capture and marginal for the last of
  // 200, so give every action real headroom rather than reading contention as
  // a broken scenario.
  context.setDefaultTimeout(45000);
  const page = await context.newPage();
  // A state may be drawn on an earlier day than the catalog clock (`options.now`,
  // from APP_CLOCK in screens-app.mjs); every other state keeps CAPTURE_NOW.
  await page.addInitScript((fixedNow) => {
    const RealDate = Date;
    const fixedTime = RealDate.parse(fixedNow);
    class CaptureDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    }
    globalThis.Date = CaptureDate;
    // The generator seeds a program from its setup draft's random id, so a
    // capture pins those ids as it pins the clock: the sequence restarts with
    // each capture's fresh tab and continues across its reloads (ids stay
    // unique), so generated programs are the same every run.
    if (globalThis.crypto?.randomUUID) {
      const key = "__repforge_capture_uuid";
      const pinned = () => {
        let counter = 0;
        try { counter = Number(sessionStorage.getItem(key)) || 0; sessionStorage.setItem(key, String(counter + 1)); } catch {}
        return `00000000-0000-4000-8000-${String(counter + 1).padStart(12, "0")}`;
      };
      try { Object.defineProperty(globalThis.crypto, "randomUUID", { value: pinned, configurable: true }); }
      catch { globalThis.crypto.randomUUID = pinned; }
    }
  }, options.now || CAPTURE_NOW);
  // The enlarged-text state is an inline style on <html>, which a navigation
  // destroys — and several scenarios reach their surface through a real
  // `page.goto` rather than in-page routing (the setup-link gate is one). Set
  // it from an init script so it is reapplied to *every* document in this
  // context: the seed reload, the scenario's own navigations, and anything a
  // future scenario adds. Setting it once after the first load silently
  // captured those surfaces at 100% while the frame was still filed as
  // `-text200`, which is evidence that looks right and is not.
  const rootFontScale = manifest.textScales[capture.text].rootFontScale;
  if (rootFontScale !== 1) {
    await page.addInitScript((scale) => {
      const apply = () => {
        if (document.documentElement) document.documentElement.style.fontSize = `${scale * 100}%`;
      };
      apply();
      document.addEventListener("DOMContentLoaded", apply, { once: true });
    }, rootFontScale);
  }
  // Establish the fixture's origin without executing the app. Both replicas
  // commit before the first production script runs; no competing empty app
  // boot or seed retry is needed. Reload the same history entry so fixture
  // setup does not create an extra Back destination.
  const seedRoute = route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Capture fixture</title>" });
  await page.route(BASE, seedRoute);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await seedStorage(page, state);
  await page.unroute(BASE, seedRoute);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await verifySeed(page, state);
  await page.evaluate(({ theme, uiKey }) => {
    localStorage.setItem(uiKey, JSON.stringify({ theme }));
    window.__repforgeUi.setTheme(theme);
  }, { theme: capture.theme, uiKey: UI_KEY });
  await sleep(page, 180);
  return { context, page };
}

/**
 * A catalog frame has to show a surface at rest.
 *
 * Fonts first. A frame taken while Plex is still loading renders in the
 * fallback face, which shifts text metrics across the whole screen — broad
 * colour and edge deltas on arbitrary frames, with nothing wrong in the app.
 * That is invisible in a two-screen run and appears in a two-hundred-frame one,
 * so it reads as flake rather than as the reproducibility bug it is.
 *
 * Then illustrations, so an exercise tile is not photographed empty, then
 * animations: entrances that are still running paint half-opacity controls
 * over the copy behind them, which a designer reads as a colour decision
 * rather than a frame taken early. Looping animations (the rest bar's
 * breathing ring) never finish and are left alone.
 *
 * This deliberately does not reset scroll: several scenarios (the Settings
 * anchors, the Progress chart) scroll to their subject on purpose.
 */
export async function settle(page) {
  // Park the pointer off-viewport first. A scenario drives the app by clicking,
  // and the pointer stays where it was left, so whatever the last layout puts
  // under that point is photographed in its :hover state — a warm wash on one
  // arbitrary row that reads as a deliberate colour decision. Which row it hits
  // changes with the viewport, so it also made narrow frames disagree with wide
  // ones for no reason in the app. A catalog frame shows a surface at rest, and
  // nothing is hovered on a phone.
  await page.mouse.move(-50, -50);
  // Wait for the DOM to stop changing first. Several surfaces finish rendering
  // after their readiness selector appears — the hub's "current program stays
  // active" notice is one — and a frame taken in that window is missing real
  // content while looking perfectly plausible.
  await page.evaluate(() => new Promise((resolve) => {
    let quiet;
    const finish = () => { observer.disconnect(); clearTimeout(cap); resolve(); };
    const observer = new MutationObserver((records) => {
      // A pinned clock still has live timer callbacks. Reassigning the same
      // attribute or text generates mutation records without changing the
      // document; treating these as new work burns the entire 5s cap on every
      // rest frame. Ignore only demonstrable no-ops, never element replacement
      // or a real text/style change.
      const changed = records.some((record) => {
        if (record.type === "attributes") return record.oldValue !== record.target.getAttribute(record.attributeName);
        if (record.type === "characterData") return record.oldValue !== record.target.data;
        return !(record.addedNodes.length === 1 && record.removedNodes.length === 1
          && record.addedNodes[0].nodeType === Node.TEXT_NODE && record.removedNodes[0].nodeType === Node.TEXT_NODE
          && record.addedNodes[0].data === record.removedNodes[0].data);
      });
      if (!changed) return;
      clearTimeout(quiet);
      quiet = setTimeout(finish, 400);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true,
      characterData: true, characterDataOldValue: true });
    quiet = setTimeout(finish, 400);
    // Looping animations mutate attributes forever; never wait on them.
    const cap = setTimeout(finish, 5000);
  }));
  await page.evaluate(async () => {
    // Every wait here is raced against a deadline. An image that never loads
    // never settles decode(), and page.evaluate has no timeout of its own, so
    // an unbounded wait hangs the whole run rather than failing one frame.
    // The library deliberately ships 174 movements with no artwork, so this is
    // the normal case, not a pathological one.
    const deadline = (promise, ms) => Promise.race([
      promise,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
    await deadline(document.fonts.ready.catch(() => {}), 5000);
    // Only rendered images can change a frame. A lazy image inside a hidden
    // surface (the closed landing keeps its walkthrough images in the DOM)
    // never loads, so waiting on it only burns the deadline and lets a
    // transient state such as a toast expire before the shot.
    await deadline(Promise.all([...document.images]
      .filter((image) => !image.complete && image.checkVisibility())
      .map((image) => image.decode().catch(() => {}))), 3000);
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) continue;
      try { animation.finish(); } catch {}
    }
  });
  // One frame for the finished fonts and animations to actually paint.
  await sleep(page, 150);
}

export async function dismissChrome(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    document.querySelector(".installbanner")?.classList.add("hidden");
  });
}
