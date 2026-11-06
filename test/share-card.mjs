#!/usr/bin/env node
/**
 * Finish-share PR 2 (owner decisions, 2026-11-05): Share on the finish screen opens a sheet with the card in view,
 * drawn on the device as a PNG, and hands that file to the system share sheet, or saves it where file sharing is
 * unavailable. Only the image leaves the phone.
 *
 * Proofs, on the catalog's real Day 1 summary:
 *  - Share opens the sheet on the record poster (the card the row opens on), as a 1080×1920 PNG that lists every
 *    lift and carries the brand, on the poster's AA ground;
 *  - Square, Stats and Light redraw it (1080×1080, the stats card, its light ground);
 *  - with file sharing, Share calls navigator.share with exactly that one PNG;
 *  - without it, Share is hidden and Save downloads the PNG;
 *  - closing (×, Escape) returns to the summary with focus on Share;
 *  - a session with no record and nothing improved offers only the stats card;
 *  - no request leaves the app's origin while sharing;
 *  - from History (PR 4): a past session's page offers Share, which opens the same sheet on that session's card,
 *    the same card the finish screen drew for it; closing returns to the page with focus on Share;
 *  - Photo (PR 3): choosing it opens the picker; until a photo is chosen nothing can be sent; the chosen photo is
 *    scaled down, drawn dimmed under the card and kept across card and format choices; a file that isn't a picture
 *    says so; closing the sheet lets the photo go, and nothing about it reaches storage.
 *
 * Run: node test/share-card.mjs   (requires the app served over HTTP; REPFORGE_URL)
 */
import { chromium } from "playwright";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const results = { passed: 0, failed: 0 };
function check(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail === undefined ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`); }
}
const manifest = loadManifest();
const state = (page) => page.evaluate(() => window.__repforgeShareSheet.state());
/** The preview's pixel at (x, y), read back from the PNG the sheet holds. */
const pixel = (page, x, y) => page.evaluate(async ([px, py]) => {
  const img = document.querySelector("#shareCardPreview");
  const bitmap = await createImageBitmap(await (await fetch(img.src)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const d = ctx.getImageData(px, py, 1, 1).data;
  return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}, [x, y]);
async function openSummary(browser, key, { canShare }) {
  const capture = { flow: key.split("/")[0], screen: key.split("/")[1], viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "reduced" };
  const opened = await openPage(browser, manifest, capture, appState(key, "en"));
  const page = opened.page, errors = [], foreign = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => { if (!request.url().startsWith(new URL(page.url()).origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) foreign.push(request.url()); });
  await dismissChrome(page);
  await APP_SCENARIOS[key](page);
  await settle(page);
  await page.evaluate((enabled) => {
    window.__shared = [];
    // A stand-in for the system share sheet: it records what it was handed.
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data) => enabled && Array.isArray(data?.files) && data.files.length > 0 });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => {
      window.__shared.push((data.files || []).map((file) => ({ name: file.name, type: file.type, size: file.size })));
    } });
  }, canShare);
  return { ...opened, page, errors, foreign };
}

const browser = await chromium.launch();
try {
  console.log("\nShare, with file sharing");
  {
    const { context, page, errors, foreign } = await openSummary(browser, "session/summary", { canShare: true });
    try {
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      let s = await state(page);
      const ui = await page.evaluate(() => ({ open: !document.querySelector("#shareCardSheet").hidden, focus: document.activeElement?.id,
        share: !document.querySelector("#shareCardShare").classList.contains("hidden"), alt: document.querySelector("#shareCardPreview").alt }));
      check(ui.open && ui.focus === "shareCardClose", "Share opens the sheet, focus on its close button", ui);
      const buttons = await page.evaluate(() => ({ share: document.querySelector("#shareCardShare").textContent.trim(),
        save: document.querySelector("#shareCardSave").className }));
      check(ui.share && buttons.share === "Share…" && /btn--steel/.test(buttons.save) && !/btn--cta/.test(buttons.save),
        "with file sharing, Share… leads and Save image is the secondary choice", { ui, buttons });
      check(s.kind === "record" && s.size === "story" && s.style === "orange", "it opens on the card the row opens on: the record poster, Story, orange", s);
      check(s.file?.type === "image/png" && s.file.name === "taurifer-2026-08-31-record-story.png" && s.file.size > 50000
        && s.drawn.width === 1080 && s.drawn.height === 1920, "the card is a 1080×1920 PNG made on the device", s);
      check(s.drawn.lifts === 5 && s.drawn.brand, "the card lists every lift and carries the brand", s.drawn);
      check(/New record, Barbell back squat, 102\.5 kg × 7/.test(ui.alt), "the preview says what the card shows", ui.alt);
      check(await pixel(page, 8, 8) === "#B8410E", "the poster stands on its AA ground", await pixel(page, 8, 8));

      await page.locator('#shareSizeSegments [data-value="square"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.height === 1080, undefined, { timeout: 15000 });
      await page.locator('#shareKindSegments [data-value="stats"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.kind === "stats", undefined, { timeout: 15000 });
      await page.locator('#shareStyleSegments [data-value="alternate"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.style === "light", undefined, { timeout: 15000 });
      s = await state(page);
      check(s.drawn.width === 1080 && s.drawn.height === 1080 && s.kind === "stats" && s.file.name === "taurifer-2026-08-31-stats-square.png",
        "Square and Stats redraw it as the 1080×1080 stats card", s);
      check(await pixel(page, 8, 8) === "#F4F2EF" && s.drawn.lifts === 5, "Light gives the stats card its light ground, every lift still listed",
        await pixel(page, 8, 8));

      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      const shared = await page.evaluate(() => window.__shared);
      check(shared.length === 1 && shared[0].length === 1 && shared[0][0].type === "image/png" && shared[0][0].name === s.file.name && shared[0][0].size === s.file.size,
        "Share hands the system sheet exactly the one PNG it shows", shared);

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden && !document.querySelector("#sessionSummary").hidden, undefined, { timeout: 5000 }).catch(() => {});
      const back = await page.evaluate(() => ({ sheet: document.querySelector("#shareCardSheet").hidden, summary: !document.querySelector("#sessionSummary").hidden,
        focus: document.activeElement?.id, state: window.__repforgeShareSheet.state() }));
      check(back.sheet && back.summary && back.focus === "sumShare" && back.state === null, "Escape closes the sheet back to the summary, focus on Share", back);
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      await page.click("#shareCardClose");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden && !document.querySelector("#sessionSummary").hidden, undefined, { timeout: 5000 }).catch(() => {});
      check(await page.evaluate(() => !document.querySelector("#sessionSummary").hidden && document.activeElement?.id === "sumShare"),
        "the close button does the same");
      check(!foreign.length, "nothing is requested outside the app's origin while sharing", foreign);
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nShare over a photo");
  {
    const { context, page, errors, foreign } = await openSummary(browser, "session/summary", { canShare: true });
    try {
      // A large, plain white picture: the worst ground for white type, and big enough to be scaled down.
      const photo = Buffer.from(await page.evaluate(async () => {
        const canvas = new OffscreenCanvas(3000, 2000), ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 3000, 2000);
        return [...new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer())];
      }));
      const stored = () => page.evaluate(async () => ({ local: JSON.stringify(Object.entries(localStorage).sort()),
        session: JSON.stringify(Object.entries(sessionStorage).sort()), dbs: JSON.stringify((await indexedDB.databases()).map((d) => d.name).sort()) }));
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      const before = await stored();

      const [firstChooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null),
        page.locator('#shareStyleSegments [data-value="photo"]').click()]);
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.style === "photo", undefined, { timeout: 15000 });
      let s = await state(page);
      let ui = await page.evaluate(() => ({ row: !document.querySelector("#sharePhotoRow").hidden, pick: document.querySelector("#sharePhotoPick").textContent.trim(),
        note: document.querySelector("#shareCardSheet .sharesheet__note").textContent.trim() }));
      check(!!firstChooser && firstChooser.isMultiple() === false, "choosing Photo opens the photo picker in the same tap", !!firstChooser);
      check(s.photo === null && s.shareDisabled && s.saveDisabled && !s.drawn.photo, "until a photo is chosen, the stand-in preview can't be sent", s);
      check(ui.row && ui.pick === "Choose photo" && /Taurifer doesn't keep it/.test(ui.note), "the sheet offers Choose photo and says the photo isn't kept", ui);

      const [badChooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click("#sharePhotoPick")]);
      await badChooser.setFiles({ name: "notes.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a picture") });
      await page.waitForFunction(() => /couldn't be opened/.test(document.querySelector("#toast")?.textContent || ""), undefined, { timeout: 5000 }).catch(() => {});
      check(/couldn't be opened/.test(await page.evaluate(() => document.querySelector("#toast")?.textContent || "")) && (await state(page)).photo === null,
        "a file that isn't a picture says so and changes nothing", await page.evaluate(() => document.querySelector("#toast")?.textContent));

      const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click("#sharePhotoPick")]);
      await chooser.setFiles({ name: "gym.png", mimeType: "image/png", buffer: photo });
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.photo && !window.__repforgeShareSheet.state().shareDisabled, undefined, { timeout: 15000 });
      s = await state(page);
      const corner = await pixel(page, 8, 8), channel = parseInt(corner.slice(1, 3), 16);
      check(s.photo.width === 2160 && s.photo.height === 1440, "the photo is scaled down as it is decoded", s.photo);
      check(s.file.name === "taurifer-2026-08-31-record-story-photo.png" && s.drawn.lifts === 5 && s.drawn.brand && !s.shareDisabled && !s.saveDisabled,
        "the card is drawn over the photo, every lift and the brand on it, ready to send", s);
      check(channel >= 0x80 && channel <= 0xA0, "the photo is dimmed under the type", corner);
      check(await page.evaluate(() => document.querySelector("#sharePhotoPick").textContent.trim()) === "Change photo", "the picker now offers Change photo");

      await page.locator('#shareKindSegments [data-value="stats"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.kind === "stats", undefined, { timeout: 15000 });
      await page.locator('#shareSizeSegments [data-value="square"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.height === 1080, undefined, { timeout: 15000 });
      s = await state(page);
      check(s.style === "photo" && s.drawn.photo && s.file.name === "taurifer-2026-08-31-stats-square-photo.png", "the photo stays through card and format choices", s);
      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      const shared = await page.evaluate(() => window.__shared);
      check(shared.length === 1 && shared[0].length === 1 && shared[0][0].name === s.file.name, "Share hands over the one composed PNG, not the photo", shared);

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden, undefined, { timeout: 5000 }).catch(() => {});
      const after = await stored();
      const input = await page.evaluate(() => ({ value: document.querySelector("#sharePhotoInput").value, files: document.querySelector("#sharePhotoInput").files.length }));
      check(input.value === "" && input.files === 0 && (await state(page)) === null, "closing the sheet lets the photo go", input);
      check(after.local === before.local && after.session === before.session && after.dbs === before.dbs, "nothing about the photo reaches storage",
        { before: before.dbs, after: after.dbs });
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      s = await state(page);
      check(s.photo === null && s.style !== "photo", "the next share starts without it", s);
      check(!foreign.length, "nothing is requested outside the app's origin", foreign);
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nShare from History");
  {
    // The finish screen's card for Day 1, to compare with the one History draws for the same session.
    const finish = await openSummary(browser, "session/summary", { canShare: true });
    let finishCard;
    try {
      await finish.page.click("#sumShare");
      await finish.page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      finishCard = { state: await state(finish.page), alt: await finish.page.evaluate(() => document.querySelector("#shareCardPreview").alt) };
    } finally { await finish.context.close(); }
    const { context, page, errors, foreign } = await openSummary(browser, "history/session", { canShare: true });
    try {
      const share = page.locator("[data-history-share]");
      check(await share.count() === 1 && (await share.textContent()).trim() === "Share", "the session's page offers Share", await share.count());
      await share.click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      const s = await state(page);
      const alt = await page.evaluate(() => document.querySelector("#shareCardPreview").alt);
      check(s.kind === "record" && s.size === "story" && s.style === "orange" && s.file.name === finishCard.state.file.name,
        "it opens the same sheet on that session's record poster", { history: s.file, finish: finishCard.state.file });
      check(alt === finishCard.alt && s.drawn.lifts === finishCard.state.drawn.lifts && s.file.size === finishCard.state.file.size,
        "the card is the one the finish screen drew for the session", { alt, finishAlt: finishCard.alt, size: s.file.size, finishSize: finishCard.state.file.size });
      const under = await page.evaluate(() => ({ summary: document.querySelector("#sessionSummary").hidden, history: !!document.querySelector(".session--read") }));
      check(under.summary && under.history, "the History page stays under the sheet; the finish screen doesn't appear", under);
      await page.locator('#shareKindSegments [data-value="stats"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.kind === "stats", undefined, { timeout: 15000 });
      check((await state(page)).drawn.lifts === finishCard.state.drawn.lifts, "the stats card lists every lift too");
      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      check((await page.evaluate(() => window.__shared)).length === 1, "Share hands the system sheet the PNG");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden, undefined, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      const back = await page.evaluate(() => ({ focus: document.activeElement?.matches?.("[data-history-share]"), summary: document.querySelector("#sessionSummary").hidden,
        reading: !!document.querySelector(".session--read"), state: window.__repforgeShareSheet.state() }));
      check(back.focus && back.summary && back.reading && back.state === null, "closing returns to the session's page, focus on Share", back);
      check(!foreign.length, "nothing is requested outside the app's origin", foreign);
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nShare, without file sharing");
  {
    const { context, page, errors } = await openSummary(browser, "session/summary", { canShare: false });
    try {
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      const ui = await page.evaluate(() => ({ share: !document.querySelector("#shareCardShare").classList.contains("hidden"),
        save: document.querySelector("#shareCardSave").className }));
      check(!ui.share && /btn--cta/.test(ui.save), "Share steps aside and Save leads", ui);
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#shareCardSave")]);
      check(download.suggestedFilename() === "taurifer-2026-08-31-record-story.png", "Save downloads the PNG it shows", download.suggestedFilename());
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nA session with no record and nothing improved");
  {
    const { context, page } = await openSummary(browser, "session/summary-declined", { canShare: true });
    try {
      await page.click("#sumShare");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
      const s = await state(page);
      const recordOffered = await page.evaluate(() => !document.querySelector('#shareKindSegments [data-value="record"]').hidden);
      check(s.kind === "stats" && s.style === "dark" && !recordOffered, "only the stats card is offered", { s, recordOffered });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
