#!/usr/bin/env node
/**
 * Portuguese copy walkthrough. Boots the app in Portuguese, logs a session, and
 * writes one PNG per surface whose copy this branch rewrites, plus a video of
 * the same walk.
 *
 * Run: node test/pt-copy-shots.mjs [outDir]
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const OUT = process.argv[2] || "/tmp/pt-copy-shots";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

async function persist(page, mutate) {
  await page.evaluate(
    async ({ k, src }) => {
      const blob = JSON.parse(localStorage.getItem(k) || "{}");
      new Function("s", "w", src)(blob, window);
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
    { k: KEY, src: mutate }
  );
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const dismissOverlays = () => {
  window.closeFirstRun?.();
  const onboarding = document.querySelector("#onboarding");
  if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
  const tour = document.querySelector("#tour");
  if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
};

async function shot(page, name) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 786, height: 1704 } },
  });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate((d) => {
    localStorage.removeItem(d);
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  }, DRAFT);

  // Portuguese, plus a week of history so every surface has numbers to show.
  await persist(page, `s.settings = { ...(s.settings || {}), lang: "pt" };`);
  await persist(
    page,
    `const days = [...new Set((s.program || []).map((e) => e.day))];
     const rows = [];
     [10, 7, 3].forEach((ago, session) => {
       const date = ${JSON.stringify([isoDaysAgo(10), isoDaysAgo(7), isoDaysAgo(3)])}[session];
       const day = days[session % days.length];
       (s.program || []).filter((e) => e.day === day).forEach((ex) => {
         for (let n = 1; n <= ex.sets; n++) rows.push({
           session: date + "_" + day + "_seed", date, day, name: ex.name, exerciseId: ex.id,
           set: n, load: 40 + session * 5, reps: ex.max - (n - 1), rir: 1,
           notes: "", created: date + "T12:00:00.000Z", primary: ex.primary, secondary: ex.secondary,
         });
       });
     });
     s.log = (s.log || []).concat(rows);
     s.programMeta = { ...(s.programMeta || {}), name: "Treino da Cecília", started: ${JSON.stringify(isoDaysAgo(21))}, onboarded: true };`
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(dismissOverlays);

  await shot(page, "01_hoje");

  // Log a session end to end, so the saved-workout copy is the real one.
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForTimeout(400);
  const loads = page.locator("#workout .setrow input[data-k$='_load']");
  const reps = page.locator("#workout .setrow input[data-k$='_reps']");
  const rirs = page.locator("#workout .setrow input[data-k$='_rir']");
  const n = Math.min(await loads.count(), 4);
  for (let i = 0; i < n; i++) {
    await loads.nth(i).fill("60");
    await reps.nth(i).fill(String(10 - i));
    if (await rirs.nth(i).count()) await rirs.nth(i).fill("1");
  }
  await shot(page, "02_treino_preenchido");
  await page.evaluate(() => window.__repforgeSaveWorkout?.());
  await page.waitForTimeout(1200);
  await shot(page, "03_resumo_da_sessao");
  await page.evaluate(() => document.querySelector("#sumDone")?.click());
  await page.waitForTimeout(800);

  const go = async (view) => {
    await page.evaluate((v) => {
      document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
      document.querySelector(`nav button[data-view="${v}"]`)?.click();
    }, view);
    await page.waitForTimeout(600);
  };

  await go("stats");
  await shot(page, "04_progresso");
  await page.evaluate(() => window.setStatsSeg?.("volume"));
  await shot(page, "05_progresso_volume");
  await go("history");
  await shot(page, "06_historico");
  await go("program");
  await shot(page, "07_programa");
  await page.evaluate(() => document.querySelector("#programEditToggle")?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector("#endBlock")?.scrollIntoView({ block: "center" }));
  await shot(page, "08_programa_editor");

  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.waitForTimeout(600);
  await shot(page, "09_ajustes");
  await page.evaluate(() => document.querySelector("#rirModeRow")?.click());
  await page.waitForTimeout(400);
  await shot(page, "10_ajustes_rir");
  await page.evaluate(() => {
    document.querySelector("#dataBackupRow")?.click();
    document.querySelector("#dataBackupRow")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await shot(page, "11_ajustes_backup");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "12_ajustes_dados");

  await context.close();
  await browser.close();
  console.log(`\nwrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
