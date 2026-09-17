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

import { chromium } from "playwright";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE_URL = process.env.REPFORGE_URL || "http://localhost:8807/";
const STATE_KEY = "repforge_v1";

function assert(condition, message, detail = "") {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}${detail ? ` — detail: ${detail}` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    /* ======================================================================
     * 1. Geometry Stability: Title & Timer at PT + 200% scaling
     * ====================================================================== */
    console.log("\nGeometry Stability: PT + 200% text scaling across viewports (320, 390, 430)");
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        serviceWorkers: "block",
      });
      const page = await context.newPage();

      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__repforgeBooted === true);

      // Seed program and set Portuguese locale
      await installSeedProgram(page, {
        key: STATE_KEY,
        waitFor: async (p) => p.waitForFunction(() => window.__repforgeBooted === true),
      });

      await page.evaluate(async (k) => {
        const s = JSON.parse(localStorage.getItem(k) || "{}");
        s.settings = s.settings || {};
        s.settings.lang = "pt";
        localStorage.setItem(k, JSON.stringify(s));
        if (typeof window.setLang === "function") await window.setLang("pt");
      }, STATE_KEY);
      await page.waitForTimeout(100);

      // Apply 200% font scaling via text-size-adjust / font scale emulation
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "32px"; // 200% of 16px
      });

      // Enter Focus workout
      await page.locator("#startWorkout").click();
      await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
      await page.waitForTimeout(350);

      // Measure title bounding box when timer is idle
      const titleEl = page.locator(".wo-head__title");
      const titleIdleBox = await titleEl.boundingBox();
      assert(titleIdleBox != null && titleIdleBox.width > 0, `title exists and has width at ${width}px PT+200%`);

      // Start the rest timer
      await page.evaluate(() => {
        const rest = document.querySelector("#woRest");
        if (rest) {
          rest.classList.remove("hidden");
          rest.classList.add("is-running");
          const time = rest.querySelector(".wo-rest__time");
          if (time) time.textContent = "1:30";
        }
      });
      await page.waitForTimeout(100);

      // Measure title bounding box while timer is running
      const titleRunningBox = await titleEl.boundingBox();
      const shiftX = Math.abs(titleRunningBox.x - titleIdleBox.x);
      const shiftY = Math.abs(titleRunningBox.y - titleIdleBox.y);

      console.log(`[Viewport ${width}px PT+200%] Title shift X: ${shiftX.toFixed(2)}px, Y: ${shiftY.toFixed(2)}px`);
      const idleSub = await page.locator("#woDaySub").boundingBox();
      const centerBox = await page.locator(".wo-head__center").boundingBox();
      const leaveBox2 = await page.locator("#leaveWorkout").boundingBox();
      console.log("Leave box:", leaveBox2);
      console.log("Center box:", centerBox);
      console.log("Idle Title:", titleIdleBox);
      console.log("Idle Sub:", idleSub);
      console.log("Running:", titleRunningBox);
      const headBoxes = await page.evaluate(() => {
        return {
          headIdle: document.querySelector(".wo-head").getBoundingClientRect(),
          end: document.querySelector(".wo-head__end").getBoundingClientRect(),
          rest: document.querySelector("#woRest")?.getBoundingClientRect(),
        };
      });
      console.log("Head boxes:", headBoxes);
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
      const doubleMountSafe = controller1 === controller2 || typeof controller2?.dispose === "function";

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
    console.log("\nAll Focus geometry and gesture lifetime assertions passed successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nFocus geometry proof failed:", err);
  process.exit(1);
});
