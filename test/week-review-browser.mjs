import assert from "node:assert/strict";
import {loadManifest} from "../tools/ui-screens/manifest.mjs";
import {appState, APP_SCENARIOS} from "../tools/ui-screens/screens-app.mjs";
import {openPage, dismissChrome} from "../tools/ui-screens/session.mjs";
import {waitForAppBoot} from "./browser.mjs";

export async function runWeekReviewBrowser(browser) {
  const manifest=loadManifest();
  for (const locale of ["en","pt"]) {
    const capture={flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale,text:"normal",motion:"normal"};
    const opened=await openPage(browser,manifest,capture,appState("progress/review-active",locale));
    const {page,context}=opened;
    try {
      await dismissChrome(page);
      await APP_SCENARIOS["progress/review-active"](page);
      assert.equal(await page.locator('[data-week-review="last"]').count(),1,"active Review states last week's facts");
      const last=await page.locator('[data-week-review="last"]').innerText();
      assert.match(last,locale==="pt"?/2 de 3 sessões/:/2 of 3 sessions/);
      assert.match(last,/Day 3|Dia 3/);
      assert.match(last,locale==="pt"?/Melhoraram:/:/Moved up:/);
      assert.match(last,locale==="pt"?/Sem avanço/:/Stalled/);
      assert.match(last,locale==="pt"?/Desconforto/:/Discomfort/);
      assert.match(last,locale==="pt"?/Tempo/:/Time/);
      assert.equal(await page.locator('[data-week-review="current"]').count(),1);
      assert.equal(await page.locator('[data-review-action]').count(),0,"facts alone offer no structural action in an active block");
      assert.equal(await page.locator('.review__readonly').count(),0);
      await page.locator('nav [data-view="log"]').click();
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),1,"a nonempty last week offers its card");
      await page.locator('#weekCardReview').click();
      assert.equal(await page.locator('#stats.view.active [data-week-review="last"]').count(),1,"card opens Review");
      await page.locator('nav [data-view="log"]').click();
      await page.locator('#weekCardDismiss').click();
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0);
      assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_ui_v1")).weekCardSeen),/^\d{4}-W\d{2}$/);
      await page.reload({waitUntil:"domcontentloaded"}); await waitForAppBoot(page);
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0,"dismissal survives reload");
      await page.clock.setFixedTime(new Date("2026-09-07T12:00:00Z"));
      await page.reload({waitUntil:"domcontentloaded"}); await waitForAppBoot(page);
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0,"an empty week never gets a card");
    } finally {await context.close();}
  }
  console.log("PASS weekly review browser: EN/PT facts, active lifecycle, Today navigation, dismissal/reload and empty week");
}
