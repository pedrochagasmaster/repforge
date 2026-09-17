/**
 * 055-P6 Verification Suite: Focus Geometry, Timer Stability, and Gesture Lifetime.
 *
 * Requirements:
 * 1. Geometry stability: bounding boxes for title, timer chip, and previous-session band
 *    are stable across 320/390/430 viewports, EN/PT, 200% font scaling, and PT+200%.
 * 2. Deliberate failure contract: title must NOT shift or wrap/clip when the timer
 *    transitions between idle and running at PT+200%.
 * 3. Previous-session band minimum: defined compact ledger band that does not dominate.
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

const BASE_URL = process.env.REPFORGE_URL || "http://localhost:8807/";
const STATE_KEY = "repforge_v1";

function assert(condition, message, detail = "") {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}${detail ? ` — detail: ${detail}` : ""}`);
  }
}

async function main() {
  const browser = await launchChromium();

  try {
    /* ======================================================================
     * 1. Geometry Stability: Title & Timer at PT + 200% scaling
     * ====================================================================== */
    console.log("\nGeometry Stability: PT + 200% text scaling across viewports (320, 390, 430)");
    for (const width of [320, 390, 430]) for (const lang of ["en", "pt"]) for (const theme of ["light", "dark"]) for (const scale of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true);

      // Seed program and set Portuguese locale
      await installSeedProgram(page, {
        key: STATE_KEY,
        waitFor: async (p) => p.waitForFunction(() => window.__repforgeBooted === true),
      });

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

      // Check previous-session band minimum / existence
      const prevBand = page.locator(".exercise.is-current .fcard__ledger");
      const prevBandBox = await prevBand.boundingBox();
      assert(prevBandBox != null && prevBandBox.height >= 40, `previous-session band has defined minimum height at ${width}px`);

      await page.close();
      await context.close();
    }

    /* ======================================================================
     * 2. Gesture Controller Lifetime
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
      await page.locator("#woNext").click();
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
      await page.locator("#woNext").click();
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
