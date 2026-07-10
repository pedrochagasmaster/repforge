import { chromium } from "playwright";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:4178/";

function rgb(hex) {
  const value = hex.trim().replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
  return rgb(hex)
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function cssRgb(hex) {
  return `rgb(${rgb(hex).join(", ")})`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}?ascent-review=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { state: "attached" });
  await page.evaluate(() => {
    window.closeOnboarding?.();
    window.closeTour?.();
  });
  await page.waitForSelector("#log.view.active");

  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      decorative: styles.getPropertyValue("--orange-decorative").trim(),
      semantic: styles.getPropertyValue("--orange-semantic").trim(),
      gold: styles.getPropertyValue("--gold").trim(),
      bone: styles.getPropertyValue("--bone").trim(),
    };
  });
  assert(/^#[0-9a-f]{6}$/i.test(tokens.decorative), "decorative orange token exists");
  assert(/^#[0-9a-f]{6}$/i.test(tokens.semantic), "semantic orange token exists");
  assert(contrast(tokens.semantic, tokens.bone) >= 4.5, "semantic orange text meets WCAG AA on bone");
  assert(contrast(tokens.gold, tokens.bone) >= 4.5, "secondary orange text meets WCAG AA on bone");
  assert(contrast("#ffffff", tokens.semantic) >= 4.5, "white CTA text meets WCAG AA on semantic orange");

  const cta = await page.locator(".btn--forge").last().evaluate((element) => {
    const styles = getComputedStyle(element);
    return { color: styles.color, background: styles.backgroundColor };
  });
  assert(cta.color === "rgb(255, 255, 255)", "CTA uses white text");
  assert(cta.background === cssRgb(tokens.semantic), "CTA renders with semantic orange");
  assert(contrast(tokens.semantic, "#ffffff") >= 4.5, "rendered CTA color pairing meets WCAG AA");

  const decorativeText = await page.evaluate((decorative) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(decorative.slice(offset, offset + 2), 16));
    const color = `rgb(${channels.join(", ")})`;
    return [...document.querySelectorAll("body *")]
      .filter((element) => getComputedStyle(element).color === color)
      .filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      .map((element) => element.textContent.trim().slice(0, 40));
  }, tokens.decorative);
  assert(decorativeText.length === 0, "decorative orange is not used for readable text");

  await page.click("#modeFocus");
  for (const expected of ["1", "2", "3"]) {
    const checkpoint = await page.locator(".exercise.is-current").getAttribute("data-checkpoint");
    const marker = await page.locator(".exercise.is-current").evaluate(
      (element) => getComputedStyle(element, "::before").content.replaceAll('"', ""),
    );
    assert(checkpoint === expected, `Focus mode retains checkpoint ${expected}`);
    assert(marker === expected, `Focus mode renders checkpoint ${expected}`);
    if (expected !== "3") await page.click("[data-fnext]");
  }

  const appSource = await (await page.request.get(`${BASE}app.js`)).text();
  assert(!/\$\{hot\}\s+hot/.test(appSource), "gauge copy uses route language instead of hot");
  assert(
    appSource.includes('getPropertyValue("--orange-semantic")') &&
      appSource.includes("lg.addColorStop(1,C.ember)"),
    "trail chart summit gradient uses semantic orange token",
  );

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.click('nav button[data-view="log"]');
    await page.click("#modeFull");
    for (const view of ["log", "stats", "history"]) {
      await page.click(`nav button[data-view="${view}"]`);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert(
        overflow.document <= overflow.viewport && overflow.body <= overflow.viewport,
        `${width}px ${view} view has no horizontal page overflow`,
      );
    }
  }

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#dayTabs button", { state: "attached" });
  assert(await page.locator("#workout .exercise").count() > 0, "offline reload restores the workout route");
  await page.context().setOffline(false);
} finally {
  await browser.close();
}
