#!/usr/bin/env node
/**
 * Share templates (owner decisions, 2026-11-11): Share on the finish screen opens a sheet with every card the session
 * can fill (Highlight, Progress, Numbers, Sticker, Line sticker, Summary), drawn on the device as PNGs in a swiping
 * row, with the format, the background and Save/Share. Edit opens the card in view in an editor inside the sheet.
 * Only the image leaves the phone.
 *
 * Proofs, on the catalog's real Day 1 summary:
 *  - Share opens the sheet on the card the row shows (Highlight), as a 1080×1920 PNG on the dark ground, with the
 *    file ready before any tap; every template draws on every ground it offers (dark, orange, clear) and in Square;
 *  - with file sharing, Share calls navigator.share with exactly that one PNG; without it, Save leads and downloads it;
 *  - closing (×, Escape) returns to the summary with focus on Share; no request leaves the app's origin;
 *  - the editor: Edit opens the card in view; a drag moves it (never the row behind), a pinch and the slider resize it,
 *    Reset puts it back; Cancel discards and Done keeps the edit and redraws the file; Escape closes the editor first;
 *  - a photo: Add photo opens the picker; a file that isn't a picture says so; the chosen photo is scaled down, drawn
 *    under the card and kept across templates and formats; the shade darkens behind the type and the editor's
 *    "Darken photo" turns it off; an older decode can't overwrite a newer pick, an explicit background chosen during a
 *    decode wins, and a failed draw keeps the last file available; closing lets the photo go and nothing reaches
 *    storage;
 *  - from History: a past session's page offers Share, which opens the same sheet on the card the finish screen drew;
 *  - a session with no record and nothing improved leads with the workouts done, and no card number is volume.
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
/** The pixel at (x, y) of the card in view, read back from its canvas, as #RRGGBB plus its alpha. */
const pixel = (page, x, y) => page.evaluate(([px, py]) => {
  const canvas = document.querySelectorAll("#shareRail .sharesheet__slide")[window.__repforgeShareSheet.state().index].querySelector("canvas");
  const d = canvas.getContext("2d").getImageData(px, py, 1, 1).data;
  return { hex: `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`, alpha: d[3] };
}, [x, y]);
/** Brings a template into view the way a swipe does, and waits for its file. */
async function showTemplate(page, template) {
  await page.evaluate((name) => {
    const st = window.__repforgeShareSheet.state(), rail = document.querySelector("#shareRail");
    const slide = rail.querySelector(".sharesheet__slide");
    rail.scrollLeft = st.templates.indexOf(name) * (slide.offsetWidth + 16);
  }, template);
  await page.waitForFunction((name) => { const s = window.__repforgeShareSheet.state(); return s?.template === name && s.fileTemplate === name; }, template, { timeout: 15000 });
}
async function chooseGround(page, ground) {
  await page.click(`#shareGrounds [data-ground="${ground}"]`);
  await page.waitForFunction((g) => window.__repforgeShareSheet.state()?.ground === g, ground, { timeout: 15000 });
  await page.waitForFunction(() => { const s = window.__repforgeShareSheet.state(); return s.fileTemplate === s.template && !s.shareDisabled; }, undefined, { timeout: 15000 });
}
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
async function openSheet(page, opener = "#sumShare") {
  await page.click(opener);
  await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
}
const pngOf = (page, w, h, color) => page.evaluate(async ([width, height, fill]) => {
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext("2d");
  ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height);
  return [...new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer())];
}, [w, h, color]).then((bytes) => Buffer.from(bytes));

const browser = await chromium.launch();
try {
  console.log("\nShare, with file sharing");
  {
    const { context, page, errors, foreign } = await openSummary(browser, "session/summary", { canShare: true });
    try {
      await openSheet(page);
      let s = await state(page);
      const ui = await page.evaluate(() => ({ open: !document.querySelector("#shareCardSheet").hidden, focus: document.activeElement?.id,
        share: !document.querySelector("#shareCardShare").classList.contains("hidden"), save: document.querySelector("#shareCardSave").className,
        name: document.querySelector("#shareTemplateName").textContent, edit: !document.querySelector("#shareCardEdit").hidden,
        slides: [...document.querySelectorAll("#shareRail .sharesheet__slide")].map((slide) => slide.getAttribute("aria-label")) }));
      check(ui.open && ui.focus === "shareCardClose", "Share opens the sheet, focus on its close button", ui);
      check(ui.share && /btn--steel/.test(ui.save) && !/btn--cta/.test(ui.save), "with file sharing, Share leads and Save is the secondary choice", ui);
      check(JSON.stringify(s.templates) === JSON.stringify(["hero", "progress", "stats", "badge", "sticker", "summary"]) && ui.slides.length === 6,
        "the row holds every card the session can fill, the Progress line included", s.templates);
      check(s.template === "hero" && ui.name === "Highlight" && s.size === "story" && s.ground === "dark" && ui.edit,
        "it opens on the card the finish row shows: Highlight, Story, dark, with Edit", { s, ui });
      check(s.file?.type === "image/png" && s.file.name === "taurifer-2026-08-31-hero-story.png" && s.file.size > 30000,
        "the card in view is already a PNG made on the device", s.file);
      check(/^Highlight: New record, Barbell back squat, 102\.5 kg, 7 reps$/.test(ui.slides[0]), "each card says what it shows", ui.slides[0]);
      check((await pixel(page, 8, 8)).hex === "#141310", "the dark ground", await pixel(page, 8, 8));
      check(!s.stats.includes("volume") && !s.row.includes("volume"), "no card number is volume", s.stats);

      // Every template, on every ground it offers.
      const seen = [];
      for (const template of s.templates) {
        await showTemplate(page, template);
        const offered = await page.evaluate(() => [...document.querySelectorAll("#shareGrounds [data-ground]")].map((b) => b.dataset.ground).filter((g) => g !== "photo"));
        for (const ground of offered) {
          await chooseGround(page, ground);
          const now = await state(page), px = await pixel(page, 4, 4);
          const expected = ground === "dark" ? px.hex === "#141310" : ground === "orange" ? px.hex === "#B8410E" : px.alpha === 0;
          seen.push(`${template}/${ground}:${now.file.name === `taurifer-2026-08-31-${template}-story.png` && now.drawn?.ground === ground && expected ? "ok" : JSON.stringify({ file: now.file, drawn: now.drawn, px })}`);
        }
      }
      const bad = seen.filter((entry) => !entry.endsWith(":ok"));
      check(seen.length === 12 && !bad.length, "every template draws on every ground it offers: dark, orange, or clear (transparent)", bad.length ? bad : seen.length);

      await chooseGround(page, "dark");
      await page.locator('#shareSizeSegments [data-value="square"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.size === "square" && /square/.test(window.__repforgeShareSheet.state().file?.name || ""), undefined, { timeout: 15000 });
      s = await state(page);
      const box = await page.evaluate(() => { const c = document.querySelectorAll("#shareRail canvas")[0]; return [c.width, c.height]; });
      check(box[0] === 1080 && box[1] === 1080 && s.file.name === `taurifer-2026-08-31-${s.template}-square.png`, "Square redraws every card at 1080×1080", { box, file: s.file });

      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      const shared = await page.evaluate(() => window.__shared);
      check(shared.length === 1 && shared[0].length === 1 && shared[0][0].type === "image/png" && shared[0][0].name === s.file.name && shared[0][0].size === s.file.size,
        "Share hands the system sheet exactly the one PNG in view", shared);

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden && !document.querySelector("#sessionSummary").hidden, undefined, { timeout: 5000 }).catch(() => {});
      const back = await page.evaluate(() => ({ sheet: document.querySelector("#shareCardSheet").hidden, summary: !document.querySelector("#sessionSummary").hidden,
        focus: document.activeElement?.id, state: window.__repforgeShareSheet.state() }));
      check(back.sheet && back.summary && back.focus === "sumShare" && back.state === null, "Escape closes the sheet back to the summary, focus on Share", back);
      await openSheet(page);
      await page.click("#shareCardClose");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden && !document.querySelector("#sessionSummary").hidden, undefined, { timeout: 5000 }).catch(() => {});
      check(await page.evaluate(() => !document.querySelector("#sessionSummary").hidden && document.activeElement?.id === "sumShare"), "the close button does the same");
      check(!foreign.length, "nothing is requested outside the app's origin while sharing", foreign);
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nThe editor");
  {
    const { context, page, errors } = await openSummary(browser, "session/summary", { canShare: true });
    try {
      await openSheet(page);
      await showTemplate(page, "badge");
      const before = await state(page);
      await page.click("#shareCardEdit");
      await page.waitForFunction(() => document.querySelector("#shareEditor.is-open") && document.querySelector("#shareEditFrame canvas"), undefined, { timeout: 5000 });
      const opened = await page.evaluate(() => ({ focus: document.activeElement?.id, hint: document.querySelector("#shareEditHint").textContent,
        size: !document.querySelector("#shareEditSizeRow").hidden, shade: !document.querySelector("#shareEditShadeRow").hidden,
        reset: document.querySelector("#shareEditReset").disabled, behind: document.querySelector("#shareCardSheet .sharesheet").inert }));
      check(opened.focus === "shareEditDone" && opened.hint === "Drag to move · pinch to resize" && opened.size && !opened.shade && opened.reset && opened.behind,
        "Edit opens the sticker in the editor: Done focused, size control, nothing to reset yet, the sheet behind out of reach", opened);

      // A drag on the card moves it, and never the row behind.
      const frame = await page.locator("#shareEditFrame").boundingBox();
      const cx = frame.x + frame.width / 2, cy = frame.y + frame.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(cx - 10 * i, cy - 12 * i);
      await page.mouse.up();
      let s = await state(page);
      check(s.editor.edits.offset.x < -100 && s.editor.edits.offset.y < -100 && s.index === before.index && s.template === "badge",
        "a drag moves the sticker; the row behind stays on the same card", { offset: s.editor.edits.offset, index: s.index });

      // Two fingers pinch it bigger.
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
      const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
      await touch("touchStart", [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }]);
      for (let i = 1; i <= 6; i++) await touch("touchMove", [{ x: cx - 30 - 6 * i, y: cy, id: 1 }, { x: cx + 30 + 6 * i, y: cy, id: 2 }]);
      await touch("touchEnd", []);
      s = await state(page);
      check(s.editor.edits.scale > 1.2, "a pinch resizes it", s.editor.edits.scale);
      await page.locator("#shareEditSize").fill("0.8");
      s = await state(page);
      check(Math.abs(s.editor.edits.scale - 0.8) < 0.001, "the size slider resizes it too", s.editor.edits.scale);
      await page.click("#shareEditReset");
      s = await state(page);
      check(s.editor.edits.scale === 1 && !s.editor.edits.offset.x && !s.editor.edits.offset.y, "Reset puts it back", s.editor.edits);

      await page.locator("#shareEditSize").fill("0.7");
      await page.click("#shareEditCancel");
      await page.waitForFunction(() => document.querySelector("#shareEditor").hidden);
      s = await state(page);
      check(!Object.keys(s.edits).length && s.file.size === before.file.size && await page.evaluate(() => document.activeElement?.id) === "shareCardEdit",
        "Cancel discards the edit; focus returns to Edit", { edits: s.edits, size: s.file.size });

      await page.click("#shareCardEdit");
      await page.waitForFunction(() => document.querySelector("#shareEditor.is-open"));
      await page.locator("#shareEditSize").fill("0.7");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareEditor").hidden);
      check(await page.evaluate(() => !document.querySelector("#shareCardSheet").hidden) && !Object.keys((await state(page)).edits).length,
        "Escape closes the editor first, discarding, and leaves the sheet open");

      await page.click("#shareCardEdit");
      await page.waitForFunction(() => document.querySelector("#shareEditor.is-open"));
      await page.locator("#shareEditSize").fill("0.7");
      await page.click("#shareEditDone");
      await page.waitForFunction((size) => { const s = window.__repforgeShareSheet.state(); return s.file && s.file.size !== size; }, before.file.size, { timeout: 15000 });
      s = await state(page);
      check(Math.abs(s.edits["badge-story"]?.scale - 0.7) < 0.001 && s.drawn.hit.w < before.drawn.hit.w,
        "Done keeps the edit: the sticker is redrawn smaller and the file follows", { edits: s.edits, w: s.drawn.hit.w, was: before.drawn.hit.w });
      await page.locator('#shareSizeSegments [data-value="square"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.size === "square");
      s = await state(page);
      check(s.drawn.hit && Math.abs(s.drawn.hit.w - 655) < 40, "an edit belongs to its format: the Square sticker keeps its own size", s.drawn.hit);

      await showTemplate(page, "progress");
      check(await page.evaluate(() => document.querySelector("#shareCardEdit").hidden), "a fixed layout with nothing to adjust hides Edit");
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nShare over a photo");
  {
    const { context, page, errors, foreign } = await openSummary(browser, "session/summary", { canShare: true });
    try {
      // A large, plain white picture: the worst ground for white type, and big enough to be scaled down.
      const photo = await pngOf(page, 3000, 2000, "#FFFFFF");
      const stored = () => page.evaluate(async () => ({ local: JSON.stringify(Object.entries(localStorage).sort()),
        session: JSON.stringify(Object.entries(sessionStorage).sort()), dbs: JSON.stringify((await indexedDB.databases()).map((d) => d.name).sort()) }));
      await openSheet(page);
      const before = await stored();
      const label = await page.evaluate(() => document.querySelector('#shareGrounds [data-ground="photo"]').textContent.trim());
      check(label === "Add photo", "the photo swatch offers Add photo", label);

      const [badChooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click('#shareGrounds [data-ground="photo"]')]);
      check(badChooser.isMultiple() === false, "Add photo opens the photo picker in the same tap");
      await badChooser.setFiles({ name: "notes.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a picture") });
      await page.waitForFunction(() => /couldn't be opened/.test(document.querySelector("#toast")?.textContent || ""), undefined, { timeout: 5000 }).catch(() => {});
      check(/couldn't be opened/.test(await page.evaluate(() => document.querySelector("#toast")?.textContent || "")) && (await state(page)).photo === null,
        "a file that isn't a picture says so and changes nothing");

      const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.click('#shareGrounds [data-ground="photo"]')]);
      await chooser.setFiles({ name: "gym.png", mimeType: "image/png", buffer: photo });
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.ground === "photo" && window.__repforgeShareSheet.state().drawn?.photo, undefined, { timeout: 15000 });
      await page.waitForFunction(() => { const s = window.__repforgeShareSheet.state(); return s.fileTemplate === s.template && !s.shareDisabled; });
      let s = await state(page);
      const corner = await pixel(page, 8, 1900), channel = parseInt(corner.hex.slice(1, 3), 16);
      check(s.photo.width === 2160 && s.photo.height === 1440, "the photo is scaled down as it is decoded", s.photo);
      check(s.drawn.shade === true && channel < 0xB0, "the card is drawn over the photo, darkened behind the type", { drawn: s.drawn, corner });
      check(await page.evaluate(() => document.querySelector('#shareGrounds [data-ground="photo"]').textContent.trim()) === "Change photo"
        && /Taurifer doesn't keep it/.test(await page.evaluate(() => document.querySelector("#shareCardSheet .sharesheet__note").textContent)),
        "the swatch now offers Change photo, and the sheet says the photo isn't kept");

      // The editor's switch turns the shade off: the photo is left as it is.
      await page.click("#shareCardEdit");
      await page.waitForFunction(() => document.querySelector("#shareEditor.is-open"));
      check(await page.evaluate(() => !document.querySelector("#shareEditShadeRow").hidden), "over a photo the editor offers Darken photo");
      await page.click("#shareEditShade");
      await page.click("#shareEditDone");
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.drawn?.shade === false);
      await page.waitForFunction(() => { const s = window.__repforgeShareSheet.state(); return s.fileTemplate === s.template && !s.shareDisabled; });
      check((await pixel(page, 8, 1900)).hex === "#FFFFFF", "with Darken photo off the photo is left as it is", await pixel(page, 8, 1900));

      await showTemplate(page, "stats");
      await page.locator('#shareSizeSegments [data-value="square"]').click();
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.size === "square" && window.__repforgeShareSheet.state().drawn?.photo);
      await page.waitForFunction(() => /stats-square/.test(window.__repforgeShareSheet.state().file?.name || ""));
      s = await state(page);
      check(s.ground === "photo" && s.drawn.photo, "the photo stays through templates and formats", s);
      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      const shared = await page.evaluate(() => window.__shared);
      check(shared.length === 1 && shared[0].length === 1 && shared[0][0].name === s.file.name, "Share hands over the one composed PNG, not the photo", shared);

      // Hold real decodes at the browser boundary and complete the newer pick first.
      await page.evaluate(() => {
        const decode = window.createImageBitmap.bind(window);
        window.__photoPicks = {};
        window.createImageBitmap = async (file, ...options) => {
          const bitmap = await decode(file, ...options);
          if (!(file instanceof File) || !file.name.startsWith("ordered-")) return bitmap;
          return new Promise(resolve => { window.__photoPicks[file.name] = () => { resolve(bitmap); return bitmap.width; }; });
        };
      });
      await page.setInputFiles("#sharePhotoInput", { name: "ordered-old.png", mimeType: "image/png", buffer: photo });
      await page.waitForFunction(() => !!window.__photoPicks["ordered-old.png"]);
      await page.setInputFiles("#sharePhotoInput", { name: "ordered-new.png", mimeType: "image/png", buffer: await pngOf(page, 640, 320, "#000000") });
      await page.waitForFunction(() => !!window.__photoPicks["ordered-new.png"]);
      await page.evaluate(() => window.__photoPicks["ordered-new.png"]());
      await page.waitForFunction(() => window.__repforgeShareSheet.state()?.photo?.width === 640 && !window.__repforgeShareSheet.state().shareDisabled);
      await page.evaluate(() => window.__photoPicks["ordered-old.png"]());
      s = await state(page);
      check(s.photo.width === 640 && s.photo.height === 320, "N13: an older photo decode cannot overwrite the newer pick", s.photo);

      for (const failure of ["render-null", "blob-null"]) {
        await page.evaluate((kind) => {
          const cards = window.TauriferShareCards = { ...window.TauriferShareCards }, method = kind === "render-null" ? "render" : "toBlob", original = cards[method];
          window.__failedPaint = false;
          cards[method] = (...args) => { cards[method] = original; window.__failedPaint = true; return method === "render" ? null : Promise.resolve(null); };
          const size = document.querySelector("#shareCardSize");
          size.value = size.value === "story" ? "square" : "story";
          size.dispatchEvent(new Event("change", { bubbles: true }));
        }, failure);
        await page.waitForFunction(() => window.__failedPaint);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        s = await state(page);
        check(!s.shareDisabled && !s.saveDisabled && !!s.file?.name, `N13: ${failure} keeps a file available to Share and Save`, s);
      }

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden, undefined, { timeout: 5000 }).catch(() => {});
      const after = await stored();
      const input = await page.evaluate(() => ({ value: document.querySelector("#sharePhotoInput").value, files: document.querySelector("#sharePhotoInput").files.length,
        canvases: document.querySelectorAll("#shareRail canvas").length }));
      check(input.value === "" && input.files === 0 && !input.canvases && (await state(page)) === null, "closing the sheet lets the photo and its cards go", input);
      check(after.local === before.local && after.session === before.session && after.dbs === before.dbs, "nothing about the photo reaches storage",
        { before: before.dbs, after: after.dbs });
      await openSheet(page);
      s = await state(page);
      check(s.photo === null && s.ground === "dark" && !Object.keys(s.edits).length, "the next share starts without it, or its edits", s);
      check(!foreign.length, "nothing is requested outside the app's origin", foreign);
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  for (const [origin, key, opener] of [["summary", "session/summary", "#sumShare"], ["history", "history/session", "[data-history-share]"]]) {
    const { context, page, errors } = await openSummary(browser, key, { canShare: true });
    try {
      await openSheet(page, opener);
      const photo = await pngOf(page, 640, 320, "#000000");
      await page.evaluate(() => {
        const decode = window.createImageBitmap.bind(window);
        window.__styleBitmapClosed = false;
        window.createImageBitmap = async (file, ...options) => {
          const bitmap = await decode(file, ...options);
          if (!(file instanceof File)) return bitmap;
          const close = bitmap.close.bind(bitmap);
          bitmap.close = () => { window.__styleBitmapClosed = true; close(); };
          return new Promise(resolve => { window.__releaseStylePhoto = () => resolve(bitmap); });
        };
      });
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click('#shareGrounds [data-ground="photo"]')]);
      await chooser.setFiles({ name: "held-style.png", mimeType: "image/png", buffer: photo });
      await page.waitForFunction(() => !!window.__releaseStylePhoto);
      await chooseGround(page, "orange");
      await page.evaluate(async () => { window.__releaseStylePhoto(); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
      const observed = await state(page);
      check(observed.ground === "orange" && observed.photo === null && observed.drawn.ground === "orange" && !observed.shareDisabled && !observed.saveDisabled,
        `N13 style: ${origin} keeps the background chosen during a decode`, observed);
      check(await page.evaluate(() => window.__styleBitmapClosed), `N13 style: ${origin} releases the rejected bitmap`);
      check(!errors.length, `${origin} background choice during a decode has no page errors`, errors);
    } finally { await context.close(); }
  }

  console.log("\nShare from History");
  {
    const finish = await openSummary(browser, "session/summary", { canShare: true });
    let finishCard;
    try {
      await openSheet(finish.page);
      finishCard = await state(finish.page);
    } finally { await finish.context.close(); }
    const { context, page, errors, foreign } = await openSummary(browser, "history/session", { canShare: true });
    try {
      const share = page.locator("[data-history-share]");
      check(await share.count() === 1 && (await share.textContent()).trim() === "Share", "the session's page offers Share", await share.count());
      await openSheet(page, "[data-history-share]");
      const s = await state(page);
      check(s.template === "hero" && s.size === "story" && s.ground === "dark" && s.file.name === finishCard.file.name,
        "it opens the same sheet on that session's Highlight", { history: s.file, finish: finishCard.file });
      check(s.file.size === finishCard.file.size && s.lead === finishCard.lead, "the card is the one the finish screen drew for the session",
        { size: s.file.size, finishSize: finishCard.file.size });
      const under = await page.evaluate(() => ({ summary: document.querySelector("#sessionSummary").hidden, history: !!document.querySelector(".session--read") }));
      check(under.summary && under.history, "the History page stays under the sheet; the finish screen doesn't appear", under);
      await page.click("#shareCardShare");
      await page.waitForFunction(() => window.__shared.length === 1, undefined, { timeout: 5000 }).catch(() => {});
      check((await page.evaluate(() => window.__shared)).length === 1, "Share hands the system sheet the PNG");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#shareCardSheet").hidden && document.activeElement?.matches?.("[data-history-share]"), undefined, { timeout: 5000 }).catch(() => {});
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
      await openSheet(page);
      const ui = await page.evaluate(() => ({ share: !document.querySelector("#shareCardShare").classList.contains("hidden"),
        save: document.querySelector("#shareCardSave").className }));
      check(!ui.share && /btn--cta/.test(ui.save), "Share steps aside and Save leads", ui);
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), page.click("#shareCardSave")]);
      check(download.suggestedFilename() === "taurifer-2026-08-31-hero-story.png", "Save downloads the PNG in view", download.suggestedFilename());
      check(!errors.length, "no page errors", errors);
    } finally { await context.close(); }
  }

  console.log("\nA session with no record and nothing improved");
  {
    const { context, page } = await openSummary(browser, "session/summary-declined", { canShare: true });
    try {
      await openSheet(page);
      const s = await state(page);
      const label = await page.evaluate(() => document.querySelector("#shareRail .sharesheet__slide").getAttribute("aria-label"));
      check(s.lead === "milestone" && /^Highlight: (Showing up|Getting started), Day \d, \d+ workouts?, /.test(label),
        "the Highlight leads with the workouts done", { lead: s.lead, label });
      check(!s.stats.includes("records") && !s.stats.includes("volume"), "no zero takes a number's place, and no number is volume", s.stats);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
