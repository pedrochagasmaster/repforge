// Drives a deterministic on-screen demo of the focus deck for the walkthrough video.
import { chromium } from "playwright";
import { existsSync, unlinkSync } from "fs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await chromium.launchPersistentContext("/tmp/repforge-demo-profile", {
  headless: false,
  viewport: { width: 400, height: 800 },
  args: [
    "--window-position=730,40",
    "--window-size=430,900",
    "--hide-crash-restore-bubble",
    "--disable-session-crashed-bubble",
  ],
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto("http://localhost:8000/");
await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
await page.evaluate(() => {
  if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
  const tour = document.querySelector("#tour");
  if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  localStorage.removeItem("repforge_draft_v1");
  localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true }));
});
await page.reload();
await page.waitForTimeout(1200);
await page.evaluate(() => {
  if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
  const tour = document.querySelector("#tour");
  if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  window.__repforgeLeaveWorkout?.();
});
await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 8000 });
console.log("staged");

if (existsSync("/tmp/demo-go")) unlinkSync("/tmp/demo-go");
while (!existsSync("/tmp/demo-go")) await wait(250);

async function swipe(dir) {
  const box = await page.locator("#workout .exercise.is-current").boundingBox();
  const y = Math.round(box.y + 42);
  const startX = dir < 0 ? Math.round(box.x + box.width - 40) : Math.round(box.x + 40);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(startX + dir * i * 13, y + Math.round(Math.sin(i / 4) * 3));
    await wait(45);
  }
  await wait(600);
  if (process.env.DEMO_SHOT) await page.screenshot({ path: `/tmp/live_middrag_${dir}.png` });
  await page.mouse.up();
  await wait(700);
}

async function logCurrentSet() {
  const plus = page.locator("#workout .exercise.is-current .curset__cell.is-load .stepbtn[data-dir='1']");
  for (let i = 0; i < 3; i++) {
    await plus.click();
    await wait(280);
  }
  await wait(400);
  await page.click("#workout .exercise.is-current .curset__save");
  await wait(1200);
}

await wait(1500);
await page.click("#startWorkout");
await wait(2200);

await swipe(-1);
await wait(700);
await swipe(-1);
await wait(700);
await swipe(1);
await wait(900);

await logCurrentSet();
await page.click("#leaveWorkout");
await wait(2600);

console.log("demo done");
await new Promise(() => {});
