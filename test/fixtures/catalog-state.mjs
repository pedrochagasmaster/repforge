/**
 * A catalog state opened for a geometry proof: the same seed, clock, user agent and scenario the screen catalog draws,
 * on a phone with the emulated safe areas the shipped app sees. Owner suites use it to prove a layout rule on the
 * states the catalog actually shows instead of on a fixture of their own.
 */
import { loadManifest } from "../../tools/ui-screens/manifest.mjs";
import { APP_CLOCK, APP_SCENARIOS, APP_USER_AGENT, appState } from "../../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../../tools/ui-screens/session.mjs";

export const SAFE_AREA = { top: 44, bottom: 34 };
/** The three phones a large-text proof covers: the smallest supported, a common small one and the canonical one. */
export const CATALOG_PHONES = { 320: 568, 360: 740, 390: 844 };

/** Run `work(item)` for every item, a few at a time; catalog states are independent of one another. */
export async function inPool(items, size, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => { for (let item = queue.shift(); item; item = queue.shift()) await work(item); }));
}

/**
 * Open `key` ("workout/focus") at `width` in `lang` ("en" | "pt") and `text` ("normal" | "text200") and run its
 * catalog scenario. The caller closes `opened.context`.
 */
export async function openCatalogState(browser, key, width, lang, text, { theme = "light" } = {}) {
  const manifest = loadManifest();
  manifest.viewports[`phone-${width}`] = { width, height: CATALOG_PHONES[width], label: "geometry" };
  manifest.deviceScaleFactor = 1;
  const [flow, screen] = key.split("/");
  const job = { flow, screen, viewport: `phone-${width}`, theme, locale: lang, text, motion: "normal" };
  const opened = await openPage(browser, manifest, job, appState(key, manifest.locales[lang].lang), { userAgent: APP_USER_AGENT[key], now: APP_CLOCK[key] });
  const cdp = await opened.context.newCDPSession(opened.page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { ...SAFE_AREA, left: 0, right: 0 } });
  await dismissChrome(opened.page);
  await APP_SCENARIOS[key](opened.page);
  await settle(opened.page);
  return opened;
}
