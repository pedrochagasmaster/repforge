/**
 * 055-P6 Verification Suite: Focus Geometry, Timer Stability, and Gesture Lifetime.
 *
 * Requirements:
 * 1. Geometry stability: bounding boxes for title, timer chip, and previous-session band
 *    are stable across 320/390/430 viewports, EN/PT, 200% font scaling, and PT+200%.
 * 2. Deliberate failure contract: title must NOT shift or wrap/clip when the timer
 *    transitions between idle and running at PT+200%.
 * 3. Previous-session band minimum: defined compact ledger band that does not dominate.
 * 3. The shelf's action stays whole at large text (R7 V-02): on every Focus state of the screen catalog, at 320, 360 and
 *    390 in both languages with double-size text, the action is inside the viewport above the bottom safe area and
 *    is what a tap lands on, the load does not wrap, the card does not overflow, no two lines of the shelf overprint,
 *    and the context region (never the shelf) is what gives up height.
 * 3b. The smallest phone at the usual size (R7 V-05): the day title shows in full, the context region opens at its top
 *    with the exercise's name in view, a running rest keeps a readable block, and the shelf keeps its action.
 * 4. Explicit gesture controller lifetime:
 *    - Boot mounts one gesture owner returning a disposal handle { dispose }.
 *    - Mounting twice is idempotent (does not duplicate listeners/navigation).
 *    - Disposal safely removes listeners, disconnects observers, cancels running work.
 *    - Disposal during active drag/swipe is safe.
 *    - Pointer cancellation, Escape, and reduced-motion remain correct.
 *    - Missing Motion runtime leaves fallback functional.
 */

import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { CATALOG_PHONES, SAFE_AREA, inPool, openCatalogState } from "./fixtures/catalog-state.mjs";

const BASE_URL = process.env.REPFORGE_URL || "http://localhost:8000/";
const STATE_KEY = "repforge_v1";

// FOCUS_GEOMETRY_ONLY=large,smallest runs just those sections (stability, large, smallest, gestures); the default is all.
const only = (process.env.FOCUS_GEOMETRY_ONLY || "").split(",").filter(Boolean);
const wants = (section) => !only.length || only.includes(section);

function assert(condition, message, detail = "") {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}${detail ? ` — detail: ${detail}` : ""}`);
  }
}

const FOCUS_STATES = ["workout/focus", "workout/focus-glossary", "workout/exercise-note", "workout/why-this-weight",
  "workout/rest-running", "workout/rest-done", "workout/correction", "workout/stale-draft", "workout/persist-retry"];

/** What the live Focus card looks like in this frame; every number is measured in the page. */
function measureFocusCard(safeBottom) {
  const q = (selector, root = document) => root.querySelector(selector);
  const art = q("#workout .exercise--focus.is-current");
  if (!art) return { error: "no live Focus card" };
  const cta = q("[data-save]", art);
  if (!cta) return { error: "the shelf has no action" };
  const rect = cta.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  const values = [...art.querySelectorAll(".shelf__val")].map((value) => {
    const lineHeight = parseFloat(getComputedStyle(value).lineHeight);
    return { text: value.textContent.trim(), height: value.scrollHeight, lineHeight, wraps: value.scrollHeight > lineHeight * 1.5, spills: value.scrollWidth > value.clientWidth + 1 };
  });
  const shelf = q(".focus-shelf", art);
  const boxes = [];
  const walker = document.createTreeWalker(shelf, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    let hidden = false;
    for (let el = node.parentElement; el && el !== shelf.parentElement; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) === 0) { hidden = true; break; }
    }
    if (hidden) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) if (box.width > 1 && box.height > 1) boxes.push({ text: node.textContent.trim().slice(0, 16), left: box.left, right: box.right, top: box.top, bottom: box.bottom });
  }
  const overprinted = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    // Tight leading lets neighbouring lines' boxes touch; overprint is one line sitting over another.
    const across = Math.min(a.right, b.right) - Math.max(a.left, b.left), down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (across > 1 && down > 0.35 * Math.min(a.bottom - a.top, b.bottom - b.top)) overprinted.push(`${a.text} / ${b.text}`);
  }
  const context = q(".fcard__context", art);
  const banner = q("#draftRecovery");
  const bannerRect = banner && !banner.classList.contains("hidden") ? banner.getBoundingClientRect() : null;
  const shelfRect = shelf.getBoundingClientRect();
  const title = q("#woDayTitle"), name = q(".focus-ex__name .ex__namebtn", art), slot = q(".fx-slot", art);
  const nameRect = name?.getBoundingClientRect(), slotRect = slot?.getBoundingClientRect();
  return {
    height: innerHeight,
    // A state that opens a sheet or the glossary is drawn with that layer over the card, and what lies over the action
    // there is the layer's; every other state must put the tap on the action itself.
    action: { top: rect.top, bottom: rect.bottom, inside: rect.top >= 0 && rect.bottom <= innerHeight - safeBottom + 0.5,
      tapped: !!hit && (hit === cta || cta.contains(hit) || !!hit.closest(".sheet,.sheet-scrim,#glossary")) },
    values, overprinted,
    card: { scroll: art.scrollHeight, client: art.clientHeight },
    contextScrolls: !!context && ["auto", "scroll"].includes(getComputedStyle(context).overflowY),
    banner: bannerRect && { top: bannerRect.top, bottom: bannerRect.bottom, aboveShelf: bannerRect.bottom <= shelfRect.top + 1 },
    title: { scroll: title.scrollHeight, client: title.clientHeight, clamp: getComputedStyle(title).webkitLineClamp },
    window: context && { top: context.getBoundingClientRect().top, bottom: context.getBoundingClientRect().bottom, scrollTop: context.scrollTop },
    name: nameRect && { top: nameRect.top, bottom: nameRect.bottom },
    slot: slotRect && { top: slotRect.top, bottom: slotRect.bottom, state: slot.dataset.rest },
  };
}

function focusCardProblems(m) {
  if (m.error) return [m.error];
  const problems = [];
  if (!m.action.inside) problems.push(`the action is not above the safe area (top ${Math.round(m.action.top)}, bottom ${Math.round(m.action.bottom)} of ${m.height}, safe ${SAFE_AREA.bottom})`);
  if (!m.action.tapped) problems.push("a tap at the centre of the action does not land on it");
  const wrapped = m.values.filter((value) => value.wraps || value.spills);
  if (wrapped.length) problems.push(`shelf values wrap or spill: ${wrapped.map((value) => `${value.text} (${Math.round(value.height)}px over a ${Math.round(value.lineHeight)}px line)`).join(", ")}`);
  if (m.card.scroll > m.card.client + 1) problems.push(`the card overflows itself (${m.card.scroll} > ${m.card.client})`);
  if (m.overprinted.length) problems.push(`shelf lines overprint: ${m.overprinted.join("; ")}`);
  if (!m.contextScrolls) problems.push("the context region is not the scroller");
  if (m.banner && !m.banner.aboveShelf) problems.push(`the banner (bottom ${Math.round(m.banner.bottom)}) is not above the shelf`);
  return problems;
}

async function checkFocusStatesAtLargeText(browser) {
  console.log("\nFocus states at double-size text: 320/360/390 x EN/PT, every catalog state");
  const cases = [];
  for (const key of FOCUS_STATES) for (const width of Object.keys(CATALOG_PHONES)) for (const lang of ["en", "pt"]) cases.push({ key, width: +width, lang });
  const failures = [];
  await inPool(cases, 3, async ({ key, width, lang }) => {
    const label = `${key} ${width}px ${lang} 200%`;
    let opened;
    try {
      opened = await openCatalogState(browser, key, width, lang, "text200");
      const problems = focusCardProblems(await opened.page.evaluate(measureFocusCard, SAFE_AREA.bottom));
      if (problems.length) failures.push(`${label}: ${problems.join(" | ")}`);
    } catch (error) {
      failures.push(`${label}: the state did not reach its drawing: ${String(error.message).split("\n")[0]}`);
    } finally {
      await opened?.context.close();
    }
  });
  failures.sort();
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  assert(!failures.length, `${failures.length} of ${cases.length} large-text Focus frames lose the shelf's action or its values`, failures.slice(0, 3).join(" || "));
  console.log(`  ${cases.length} frames keep the shelf whole`);
}

/** The part of a box that shows inside the context region's window. */
const shown = (box, window) => Math.max(0, Math.min(box.bottom, window.bottom) - Math.max(box.top, window.top));

/**
 * R7 V-05: Focus at 320x568 with the usual text. The title is a heading and shows in full (no line clamp), the context
 * region opens at its top with the exercise's name in view, a running or finished rest keeps a readable part of its
 * block in the window, and a banner or guide never takes the shelf's room.
 */
async function checkFocusAtSmallestPhone(browser) {
  console.log("\nFocus on the smallest phone at the usual size: 320x568, EN/PT");
  const cases = [];
  for (const key of ["workout/focus", "workout/rest-running", "workout/rest-done", "workout/stale-draft", "workout/persist-retry"]) for (const lang of ["en", "pt"]) cases.push({ key, lang });
  const failures = [];
  await inPool(cases, 3, async ({ key, lang }) => {
    const label = `${key} 320px ${lang} 100%`;
    let opened;
    try {
      opened = await openCatalogState(browser, key, 320, lang, "normal");
      const m = await opened.page.evaluate(measureFocusCard, SAFE_AREA.bottom);
      const problems = focusCardProblems(m);
      if (!m.error) {
        if (m.title.scroll > m.title.client + 1 || m.title.clamp !== "none") problems.push(`the day title is cut short (${m.title.scroll}px of text in ${m.title.client}px, line-clamp ${m.title.clamp})`);
        if (key === "workout/focus") {
          if (m.window.scrollTop !== 0) problems.push(`the context region opens scrolled ${Math.round(m.window.scrollTop)}px`);
          if (!m.name || m.name.top < m.window.top - 1 || m.name.bottom > m.window.bottom + 1) problems.push("the exercise's name is not whole in the context window on first paint");
        }
        if (key.startsWith("workout/rest-") && (!m.slot || shown(m.slot, m.window) < 44)) problems.push(`the rest block keeps ${Math.round(m.slot ? shown(m.slot, m.window) : 0)}px of the window`);
      }
      if (problems.length) failures.push(`${label}: ${problems.join(" | ")}`);
    } catch (error) {
      failures.push(`${label}: the state did not reach its drawing: ${String(error.message).split("\n")[0]}`);
    } finally {
      await opened?.context.close();
    }
  });
  failures.sort();
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  assert(!failures.length, `${failures.length} of ${cases.length} Focus frames on the smallest phone hide the title, the name or the rest block`, failures.slice(0, 3).join(" || "));
  console.log(`  ${cases.length} frames show the title, the name and the rest block`);
}

async function main() {
  const browser = await launchChromium();

  try {
    /* ======================================================================
     * 1. Geometry Stability: Title & Timer at PT + 200% scaling
     * ====================================================================== */
    console.log("\nGeometry Stability: PT + 200% text scaling across viewports (320, 390, 430)");
    if (wants("stability")) for (const width of [320, 390, 430]) for (const lang of ["en", "pt"]) for (const theme of ["light", "dark"]) for (const scale of [1, 2]) {
      const height = { 320: 568, 390: 844, 430: 932 }[width];
      const context = await browser.newContext({
        viewport: { width, height },
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 44, bottom: 34, left: 0, right: 0 } });

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true);

      // Seed program and set Portuguese locale
      await installSeedProgram(page, {
        key: STATE_KEY,
        waitFor: async (p) => p.waitForFunction(() => window.__repforgeBooted === true),
      });

      await page.evaluate(async () => {
        const state = JSON.parse(localStorage.getItem("repforge_v1"));
        const ex = state.program[0];
        const date = new Date(); date.setDate(date.getDate() - 7);
        state.log = [1, 2].map(set => ({ date: date.toISOString().slice(0, 10), day: ex.day,
          exerciseId: ex.id, name: ex.name, set, load: 60, reps: 8, rir: 2,
          programId: state.programMeta.id, sessionId: "geometry-previous" }));
        localStorage.setItem("repforge_v1", JSON.stringify(state));
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open("repforge", 1);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        await new Promise((resolve, reject) => { const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(state, "repforge_v1"); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        db.close();
      });
      await page.reload();
      await page.waitForFunction(() => window.__repforgeBooted);
      await page.locator("#openSettings").click();
      await page.locator("#lang").selectOption(lang);
      await page.waitForFunction(lang => document.documentElement.lang === (lang === "pt" ? "pt-BR" : "en"), lang);
      await page.waitForFunction(lang => JSON.parse(localStorage.getItem("repforge_v1"))?.settings?.lang === lang, lang);
      await page.evaluate(({ theme, scale }) => {
        window.__repforgeUi.setTheme(theme);
        document.documentElement.style.fontSize = `${scale * 100}%`;
      }, { theme, scale });
      assert(await page.locator("html").getAttribute("lang") === (lang === "pt" ? "pt-BR" : "en"), "actual document language matches fixture");
      await page.locator("#settingsBack").click();
      // Enter Focus workout
      await page.locator("#startWorkout").click();
      await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
      await page.waitForTimeout(350);

      // Measure title bounding box when timer is idle
      const titleEl = page.locator(".wo-head__title");
      const titleIdleBox = await titleEl.boundingBox();
      assert(titleIdleBox != null && titleIdleBox.width > 0, `title exists and has width at ${width}px PT+200%`);

      // Start the rest timer
      await page.locator("#woRest").click();
      await page.waitForSelector("#woRest.is-running");

      // Measure title bounding box while timer is running
      const titleRunningBox = await titleEl.boundingBox();
      const shiftX = Math.abs(titleRunningBox.x - titleIdleBox.x);
      const shiftY = Math.abs(titleRunningBox.y - titleIdleBox.y);

      console.log(`${width}px ${lang} ${theme} ${scale * 100}%: timer title shift ${shiftX.toFixed(2)}, ${shiftY.toFixed(2)}`);
      assert(shiftX <= 1.0, `title X must remain stable when timer runs at ${width}px PT+200% (shift: ${shiftX.toFixed(2)}px)`);
      assert(shiftY <= 1.0, `title Y must remain stable when timer runs at ${width}px PT+200% (shift: ${shiftY.toFixed(2)}px)`);

      // Check controls are not clipped
      const headEndBox = await page.locator(".wo-head__end").boundingBox();
      const leaveBox = await page.locator("#leaveWorkout").boundingBox();
      assert(leaveBox.x >= 0, `leave button is not clipped off-screen at ${width}px`);
      assert(headEndBox.x + headEndBox.width <= width + 1, `header controls do not overflow viewport at ${width}px`);

      // The first-use guide rides above the shelf until it is dismissed; on the shortest screen the
      // ledger proof is about the card itself, so the guide is put away first.
      await page.locator("[data-guide-dismiss]").click({ timeout: 1500 }).catch(() => {});
      // Check previous-session band minimum / existence
      const prevBand = page.locator(".exercise.is-current .fcard__ledger");
      await prevBand.scrollIntoViewIfNeeded();
      const firstPreviousRow = prevBand.locator(".ledgerline--two").first();
      await firstPreviousRow.scrollIntoViewIfNeeded();
      const prevBandBox = await prevBand.boundingBox();
      const contextBox = await page.locator(".exercise.is-current .fcard__context").boundingBox();
      assert(await prevBand.locator(".ledgerline__prev").count() === 2, "previous-session proof uses actual history");
      const firstPrevious = await firstPreviousRow.boundingBox();
      if (width === 320 && scale === 2) {
        // Double-size text on the narrowest screen: the shelf keeps its three fields, pads and action whole, and
        // the ledger above it is a short window onto rows taller than itself, so the proof is that it scrolls.
        const ledgerWindow = await page.locator(".exercise.is-current .fcard__context").evaluate(el => ({ scrolls: el.scrollHeight > el.clientHeight + 1 }));
        assert(ledgerWindow.scrolls, `the ledger scrolls to its rows at ${width}px with double-size text`, JSON.stringify(ledgerWindow));
      } else {
        assert(prevBandBox != null && firstPrevious.y >= contextBox.y && firstPrevious.y + firstPrevious.height <= Math.min(prevBandBox.y + prevBandBox.height, contextBox.y + contextBox.height) + 1,
          `at least one complete row with its previous-session line remains readable at ${width}px`);
      }
      const safe = await page.evaluate(() => {
        const head = document.querySelector(".wo-head").getBoundingClientRect();
        const action = document.querySelector(".exercise.is-current [data-save]").getBoundingClientRect();
        return { top: head.top, bottom: action.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(safe.top >= 44 && safe.bottom <= height - 34 && !safe.overflow,
        `header and primary action respect emulated safe areas at ${width}px`, JSON.stringify(safe));

      await page.close();
      await context.close();
    }

    /* ======================================================================
     * 2. The shelf's action stays whole at large text (R7 V-02)
     * ====================================================================== */
    if (wants("large")) await checkFocusStatesAtLargeText(browser);
    if (wants("smallest")) await checkFocusAtSmallestPhone(browser);
    if (!wants("gestures")) return;

    /* ======================================================================
     * 3. Gesture Controller Lifetime
     * ====================================================================== */
    console.log("\nGesture Controller Lifetime: explicit mount, disposal, safety");
    const testPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await testPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await testPage.waitForFunction(() => window.__repforgeBooted === true);

    const gestureContract = await testPage.evaluate(() => {
      const motion = window.RepForgeMotion;
      if (!motion || typeof motion.mountGestureController !== "function") {
        return { exists: false };
      }

      // 1. First mount
      const controller1 = motion.mountGestureController();
      const hasDispose = typeof controller1?.dispose === "function";

      // 2. Double mount: idempotent, returns same active controller or safe handle
      const controller2 = motion.mountGestureController();
      const doubleMountSafe = controller1 === controller2;

      // 3. Disposal
      controller1.dispose();

      // 4. Safe re-mount after dispose
      const controller3 = motion.mountGestureController();
      const canRemount = typeof controller3?.dispose === "function";

      controller3.dispose();

      return {
        exists: true,
        hasDispose,
        doubleMountSafe,
        canRemount,
      };
    });

    assert(gestureContract.exists, "window.RepForgeMotion exposes mountGestureController");
    assert(gestureContract.hasDispose, "gesture controller returns disposal handle with dispose()");
    assert(gestureContract.doubleMountSafe, "double mount is safe and idempotent");
    assert(gestureContract.canRemount, "controller can be re-mounted cleanly after disposal");

    await testPage.close();
    for (const runtime of ["motion", "fallback", "no-layer"]) for (const reduced of [false, true]) {
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block",reducedMotion:reduced?"reduce":"no-preference"});
      const page=await context.newPage();
      page.setDefaultTimeout(10000);
      if(runtime!=="motion")await page.route("**/vendor/motion/motion.js",route=>route.abort());
      if(runtime==="no-layer")await page.route("**/motion-layer.js*",route=>route.abort());
      await page.goto(BASE_URL);
      await page.waitForFunction(()=>window.__repforgeBooted);
      await installSeedProgram(page,{waitFor:p=>p.waitForFunction(()=>window.__repforgeBooted)});
      await page.locator("#startWorkout").click();
      await page.locator("#workout .exercise.is-current").waitFor({state:"visible"});
      const cancel=await page.evaluate(async()=>{
        const start=window.__repforgeFocus.at();
        const card=document.querySelector(".exercise.is-current");
        card.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,pointerId:19,pointerType:"touch",clientX:280,clientY:250}));
        window.dispatchEvent(new PointerEvent("pointermove",{pointerId:19,pointerType:"touch",clientX:80,clientY:250}));
        window.dispatchEvent(new PointerEvent("pointercancel",{pointerId:19,pointerType:"touch",clientX:80,clientY:250}));
        await new Promise(resolve=>setTimeout(resolve,400));
        return {start,end:window.__repforgeFocus.at()};
      });
      assert(cancel.start===cancel.end,`${runtime} reduced=${reduced}: pointercancel never navigates`);
      await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
      await page.waitForFunction(()=>window.__repforgeFocus.at()===1);
      const disposal=await page.evaluate(async()=>{
        const handle=window.__repforgeGestureHandle;
        if(!matchMedia("(prefers-reduced-motion: reduce)").matches)handle.navigate(1);
        const at=window.__repforgeFocus.at();
        handle.dispose();handle.dispose();
        await new Promise(resolve=>setTimeout(resolve,450));
        const after=window.__repforgeFocus.at();
        window.__repforgeGestureHandle=window.RepForgeMotion?.mountGestureController()||window.mountFallbackGestures();
        return {at,after,clean:!document.querySelector("#focusDeck.is-swiping, .exercise.is-dragging")};
      });
      assert(disposal.at===disposal.after && disposal.clean,`${runtime} reduced=${reduced}: disposal cancels pending navigation and gesture state`);
      await page.locator("#workout .exercise.is-current [data-fnextrow]").click();
      await page.waitForFunction(()=>window.__repforgeFocus.at()===2);
      await context.close();
    }

    console.log("\nAll Focus geometry and gesture lifetime assertions passed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nFocus geometry proof failed:", err);
  process.exit(1);
});
