import { chromium } from "playwright";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:4178/";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}?timeline-flow=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { state: "attached" });
  assert(await page.locator("#onboarding.active").count() === 1, "first run shows onboarding");
  await page.evaluate(() => {
    window.closeOnboarding?.();
    window.closeTour?.();
  });
  await page.waitForSelector("#log.view.active");
  await page.waitForTimeout(700);

  assert(await page.locator(".timeline-shell").count() === 1, "workout uses the Timeline Flow shell");
  assert(await page.locator("#sessionOutline").count() === 1, "desktop session outline exists");
  assert(await page.locator("#eventDetail").count() === 1, "desktop event detail exists");
  assert(await page.locator(".timeline-event--start").count() === 1, "stream begins with a session start event");
  assert(await page.locator(".timeline-event--complete").count() === 1, "stream ends with a completion event");
  assert(await page.locator(".exercise.is-current").count() === 1, "exactly one exercise event is current");
  assert(await page.locator(".exercise.is-future").count() > 0, "future exercises render as a queue");
  assert(await page.locator(".actiondock").count() === 1, "sticky action dock is present");

  const targets = await page.locator("button:visible, input:visible, select:visible, textarea:visible").evaluateAll((controls) =>
    controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { label: control.getAttribute("aria-label") || control.textContent.trim(), width: rect.width, height: rect.height };
    }),
  );
  assert(targets.every(({ width, height }) => width >= 44 && height >= 44), "visible controls meet 44px targets");

  const colors = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      accent: styles.getPropertyValue("--accent").trim(),
      ink: styles.getPropertyValue("--ink").trim(),
      muted: styles.getPropertyValue("--muted").trim(),
      surface: styles.getPropertyValue("--surface").trim(),
    };
  });
  assert(contrast("#ffffff", colors.accent) >= 4.5, "primary action contrast meets WCAG AA");
  assert(contrast(colors.ink, colors.surface) >= 4.5, "primary text contrast meets WCAG AA");
  assert(contrast(colors.muted, colors.surface) >= 4.5, "secondary text contrast meets WCAG AA");

  const currentSet = page.locator(".exercise.is-current .setrow").first();
  await currentSet.locator('input[data-k$="_load"]').fill("80");
  await currentSet.locator('input[data-k$="_reps"]').fill("8");
  await currentSet.locator('input[data-k$="_rir"]').fill("1");
  await page.click("[data-dock-save]");
  assert(await page.locator(".exercise.is-current .setrow.is-done").count() === 1, "action dock saves the current set");
  assert(await page.locator(".exercise.is-current .timeline-rest").count() === 1, "saved set adds a rest interval event");
  assert(!(await page.locator("#restBar").getAttribute("class")).includes("hidden"), "saving a set starts the rest timer");

  for (const expected of ["1", "2", "3"]) {
    assert(
      await page.locator(".exercise.is-current").getAttribute("data-checkpoint") === expected,
      `current event progresses to exercise ${expected}`,
    );
    if (expected !== "3") {
      await page.locator("[data-fnext]").focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      assert(
        await page.evaluate(() => document.activeElement?.closest(".exercise.is-current") !== null),
        "focus restores inside the new current event",
      );
    }
  }
  await page.click("[data-fprev]");
  assert(
    await page.locator(".exercise.is-current").getAttribute("data-checkpoint") === "2",
    "Back returns to the previous event",
  );

  await page.click(".btn--save");
  await page.waitForFunction(() => document.querySelector("#toast")?.textContent.includes("Workout saved."));
  assert((await page.locator("#toast").textContent()).includes("Workout saved."), "full workout save uses neutral confirmation");

  const visibleCopy = (await page.locator("body").innerText()).replaceAll("RepForge", "");
  assert(
    !/\b(ascent|topographic|trail|summit|checkpoint|elevation|grade|climb|route|forged)\b/i.test(visibleCopy),
    "visible copy is neutral and task-oriented",
  );

  for (const width of [320, 390, 760, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    assert(
      overflow.document <= overflow.viewport && overflow.body <= overflow.viewport,
      `${width}px layout has no horizontal page overflow`,
    );
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  assert(await page.locator("#sessionOutline").isVisible(), "session outline is visible on desktop");
  assert(await page.locator("#eventDetail").isVisible(), "event detail is visible on desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert(
    await page.locator("#log").evaluate((element) => getComputedStyle(element).animationName === "none"),
    "reduced-motion preference disables interface animation",
  );

  await page.click('nav button[data-view="stats"]');
  assert(await page.locator("#stats .stats-seg").count() >= 5, "Stats contains period sections");
  assert(await page.locator("#metrics .metric").count() === 4, "saved workout updates Stats");
  assert(
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
    "Stats sections form a scrollable review",
  );

  await page.click('nav button[data-view="history"]');
  assert(await page.locator("#sessions").getAttribute("class").then((value) => value.includes("eventstream")), "History uses event-stream structure");
  assert(await page.locator("#sessions .history-event").count() === 1, "saved workout appears in History");
  await page.click("#sessions [data-edit]");
  assert(await page.locator("#sessions .session--edit").count() === 1, "History workout can be edited");
  await page.click("#sessions [data-edcancel]");
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#sessions [data-del]");
  assert(await page.locator("#sessions .history-event").count() === 0, "History workout can be deleted");

  await page.click('nav button[data-view="program"]');
  assert(await page.locator("#programEditor").getAttribute("class").then((value) => value.includes("sequence")), "Program uses sequence structure");
  const beforeOrder = await page.locator("#programEditor .pday").first().locator(".pex__name").evaluateAll((inputs) => inputs.slice(0, 2).map((input) => input.value));
  await page.locator("#programEditor .pday").first().locator('[data-act="down"]').first().click();
  const afterOrder = await page.locator("#programEditor .pday").first().locator(".pex__name").evaluateAll((inputs) => inputs.slice(0, 2).map((input) => input.value));
  assert(beforeOrder[0] === afterOrder[1] && beforeOrder[1] === afterOrder[0], "Program sequence can be reordered");

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { state: "attached" });
  assert(await page.locator("#workout .exercise").count() > 0, "offline reload restores timeline events");
  await page.context().setOffline(false);
} finally {
  await browser.close();
}
