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
  assert(await page.locator("#workout").getAttribute("aria-live") === null, "workout container is not a live region");
  assert(await page.locator("#timelineStatus").getAttribute("aria-live") === "polite", "dedicated timeline status is a live region");
  assert(await page.locator(".exercise.is-current").count() === 1, "exactly one exercise event is current");
  assert(await page.locator(".exercise.is-future").count() > 0, "future exercises render as a queue");
  assert(await page.locator(".actiondock").count() === 1, "sticky action dock is present");
  const plannedExerciseTotal = await page.locator("#workout .exercise").count();
  assert(
    (await page.locator("#sessionProgress").textContent()).endsWith(`of ${plannedExerciseTotal}`) &&
      (await page.locator(".focusbar__prog").textContent()).endsWith(`of ${plannedExerciseTotal}`),
    "exercise total starts from the full programmed sequence",
  );

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
  const currentLoad = currentSet.locator('input[data-k$="_load"]');
  await currentLoad.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("70");
  assert(await currentLoad.inputValue() === "70", "direct keyboard entry updates the current load");
  assert(
    await currentLoad.evaluate((input) => JSON.parse(localStorage.getItem("repforge_draft_v1") || "{}")[input.dataset.k]) === "70",
    "direct keyboard entry persists the current load draft",
  );

  await page.locator("#commandInput").fill("80 x 8 @1");
  await page.click("#commandApply");
  assert(await currentLoad.inputValue() === "80", "quick entry applies load to the current set");
  assert(await currentSet.locator('input[data-k$="_reps"]').inputValue() === "8", "quick entry applies reps to the current set");
  assert(await currentSet.locator('input[data-k$="_rir"]').inputValue() === "1", "quick entry applies RIR to the current set");
  assert(
    await currentLoad.evaluate((input) => JSON.parse(localStorage.getItem("repforge_draft_v1") || "{}")[input.dataset.k]) === "80",
    "quick entry persists the current load draft",
  );
  await page.click("[data-dock-save]");
  assert(await page.locator(".exercise.is-current .setrow.is-done").count() === 1, "action dock saves the current set");
  assert(await page.locator(".exercise.is-current .timeline-rest").count() === 1, "saved set adds a rest interval event");
  assert(!(await page.locator("#restBar").getAttribute("class")).includes("hidden"), "saving a set starts the rest timer");
  const restTargets = await page.locator("#restBar:visible, .ex__rest:visible, .timeline-rest button:visible").evaluateAll((controls) =>
    controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  assert(restTargets.every(({ width, height }) => width >= 44 && height >= 44), "rest controls meet 44px targets");

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
      assert(
        (await page.locator("#sessionProgress").textContent()).endsWith(`of ${plannedExerciseTotal}`) &&
          (await page.locator(".focusbar__prog").textContent()).endsWith(`of ${plannedExerciseTotal}`),
        "exercise total remains stable after Next",
      );
    }
  }
  await page.click("[data-fprev]");
  assert(
    await page.locator(".exercise.is-current").getAttribute("data-checkpoint") === "2",
    "Back returns to the previous event",
  );
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  assert(
    (await page.locator("#sessionProgress").textContent()).endsWith(`of ${plannedExerciseTotal}`) &&
      (await page.locator(".focusbar__prog").textContent()).endsWith(`of ${plannedExerciseTotal}`),
    "exercise total remains stable after Prev and scroll",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const visitedZeroSet = page.locator('.exercise[data-checkpoint="3"]');
  assert(
    (await visitedZeroSet.getAttribute("class")).includes("is-visited") &&
      (await visitedZeroSet.getAttribute("class")).includes("is-incomplete") &&
      !(await visitedZeroSet.getAttribute("class")).includes("is-past"),
    "visited zero-set exercise remains explicitly incomplete",
  );
  const skippedId = await page.locator(".exercise.is-current").getAttribute("data-ex");
  await page.click(".exercise.is-current .ex__skip");
  const skippedEvent = page.locator(`.exercise[data-ex="${skippedId}"]`);
  assert(
    (await skippedEvent.getAttribute("class")).includes("is-skipped") &&
      (await skippedEvent.getAttribute("class")).includes("is-incomplete") &&
      !(await skippedEvent.getAttribute("class")).includes("is-past"),
    "skipped exercise remains incomplete instead of completed",
  );
  assert(
    (await page.locator("#sessionProgress").textContent()).endsWith(`of ${plannedExerciseTotal}`) &&
      (await page.locator(".focusbar__prog").textContent()).endsWith(`of ${plannedExerciseTotal}`),
    "skipping an exercise does not reduce the programmed total",
  );
  await page.click(".skipbar__show");

  await page.click(".btn--save");
  await page.waitForFunction(() => document.querySelector("#toast")?.textContent.includes("Workout saved."));
  assert((await page.locator("#toast").textContent()).includes("Workout saved."), "full workout save uses neutral confirmation");

  const visibleCopy = (await page.locator("body").textContent()).replace(/repforge/gi, "");
  assert(
    !/\b(ascent|topographic|trail|summit|checkpoint|elevation|grade|climb|route|forge|forged)\b/i.test(visibleCopy),
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
  assert(await page.locator('#statsSeg[role="navigation"]').count() === 1, "Stats section control uses navigation semantics");
  assert(await page.locator('#statsSeg [role="tab"]').count() === 0, "Stats stacked-section controls are not tabs");
  assert(
    await page.locator("#statsSeg button").evaluateAll((buttons) =>
      buttons.every((button) => button.hasAttribute("aria-controls")) &&
        buttons.filter((button) => button.getAttribute("aria-current") === "location").length === 1,
    ),
    "Stats navigation exposes aria-controls and current section",
  );
  assert(
    await page.locator("#stats .stats-seg").evaluateAll((sections) =>
      sections.every((section) => getComputedStyle(section).display !== "none" && section.getAttribute("role") === "region"),
    ),
    "all Stats sections render as stacked regions",
  );
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
  await page.setViewportSize({ width: 320, height: 900 });
  const programNameWidths = await page.locator("#programName, .pday__name, .pex__name").evaluateAll((inputs) =>
    inputs.slice(0, 3).map((input) => input.getBoundingClientRect().width),
  );
  assert(programNameWidths.every((width) => width >= 150), "Program name fields remain usable at 320px");
  await page.setViewportSize({ width: 1280, height: 900 });
  const beforeOrder = await page.locator("#programEditor .pday").first().locator(".pex__name").evaluateAll((inputs) => inputs.slice(0, 2).map((input) => input.value));
  await page.locator("#programEditor .pday").first().locator('[data-act="down"]').first().click();
  const afterOrder = await page.locator("#programEditor .pday").first().locator(".pex__name").evaluateAll((inputs) => inputs.slice(0, 2).map((input) => input.value));
  assert(beforeOrder[0] === afterOrder[1] && beforeOrder[1] === afterOrder[0], "Program sequence can be reordered");

  const expectedHistory = await page.evaluate(async () => {
    const key = "repforge_v1";
    const state = JSON.parse(localStorage.getItem(key));
    const day = state.program[0].day;
    const exercises = state.program.filter((exercise) => exercise.day === day);
    const ordered = [];
    for (const exercise of exercises) {
      for (let set = 1; set <= exercise.sets && ordered.length < 8; set++) {
        ordered.push({
          session: "timeline-history-eight",
          date: "2026-07-10",
          created: `2026-07-10T09:00:${String(ordered.length).padStart(2, "0")}Z`,
          day,
          exerciseId: exercise.id,
          name: exercise.name,
          set,
          load: 80 + ordered.length,
          reps: 8,
          rir: 1,
        });
      }
      if (ordered.length === 8) break;
    }
    state.log = [...ordered].reverse();
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(state, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    return ordered.map((row) => `${row.name} · Set ${row.set}`);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { state: "attached" });
  await page.evaluate(() => {
    window.closeOnboarding?.();
    window.closeTour?.();
  });
  await page.click('nav button[data-view="history"]');
  const historyReceipts = await page.locator("#sessions .session__receipt").allTextContents();
  assert(historyReceipts.length === 8, "History renders all 8+ logged sets without truncation");
  assert(
    historyReceipts.every((receipt, index) => receipt.startsWith(expectedHistory[index])),
    "History receipts follow program and set order",
  );
  const historyTableOrder = await page.locator("#historyTable tbody tr").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return `${cells[2]?.textContent.trim()} · Set ${cells[3]?.textContent.trim()}`;
    }),
  );
  assert(
    historyTableOrder.every((row, index) => row === expectedHistory[index]),
    "History set table follows program and set order",
  );
  await page.setViewportSize({ width: 320, height: 900 });
  const historyLayout = await page.locator("#sessions .history-event").evaluate((card) => {
    const info = card.querySelector(".session__info").getBoundingClientRect();
    const receipts = card.querySelector(".session__receipts").getBoundingClientRect();
    const actions = card.querySelector(".session__btns").getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const names = [...card.querySelectorAll(".receipt__name")].map((name) => {
      const styles = getComputedStyle(name);
      return name.getBoundingClientRect().height / Number.parseFloat(styles.lineHeight);
    });
    return {
      cardWidth: cardRect.width,
      infoWidth: info.width,
      receiptWidth: receipts.width,
      actionsAfterReceipts: actions.top >= receipts.bottom,
      maxNameLines: names.length ? Math.max(...names) : Number.POSITIVE_INFINITY,
    };
  });
  assert(
    historyLayout.infoWidth >= historyLayout.cardWidth - 32 &&
      historyLayout.receiptWidth >= historyLayout.cardWidth - 32 &&
      historyLayout.actionsAfterReceipts,
    "History summary, receipts, and actions use separate full-width rows at 320px",
  );
  assert(historyLayout.maxNameLines <= 2.1, "History receipt exercise names remain legible at 320px");

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
