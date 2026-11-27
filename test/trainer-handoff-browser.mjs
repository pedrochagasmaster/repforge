#!/usr/bin/env node
/**
 * Plan 086 slice 2: a program handoff through the relay, in the app.
 *
 * The Share sheet creates an encrypted relay link in one tap, with who it is from
 * behind one collapsed row; a new client opens it at the first-run gate with the
 * sender's name and message; the relay's failures each get their own gate; the
 * iOS handoff cookie carries only the locator and is cleared when the installed
 * app has opened the program. A fake relay answers through Playwright routes, so
 * no request ever reaches relay.taurifer.com.
 *
 * Run: node test/trainer-handoff-browser.mjs (REPFORGE_URL names a static server).
 */
import { randomBytes } from "node:crypto";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const RELAY = "https://relay.taurifer.com";
const COOKIE = "repforge_setup_v1";

let passed = 0;
const failures = [];
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); }
  else { failures.push(message); console.log(`  ✗ ${message}`); if (detail !== undefined) console.log(`    ${JSON.stringify(detail).slice(0, 600)}`); }
}

/** An in-memory relay with the production contract: POST create and POST read, CORS for this page only. */
function fakeRelay() {
  const records = new Map();
  const relay = { records, mode: "up", requests: [] };
  relay.install = async (context) => {
    await context.route(`${RELAY}/**`, async (route) => {
      const request = route.request();
      const origin = request.headers().origin || "";
      const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type", "access-control-max-age": "600", vary: "Origin" };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      relay.requests.push({ path, cookie: request.headers().cookie || "", credentials: request.headers().cookie ? "sent" : "omitted" });
      const json = (status, body) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
      if (relay.mode === "down") return json(503, { state: "unavailable" });
      const body = JSON.parse(request.postData() || "{}");
      if (path === "/v1/relay/records") {
        const id = randomBytes(16).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString();
        records.set(id, { ...body, expiresAt });
        return json(201, { id, expiresAt });
      }
      if (path === "/v1/relay/records/read") {
        const record = records.get(body.id);
        return record ? json(200, record) : json(404, { state: "unavailable" });
      }
      return json(404, { state: "unavailable" });
    });
  };
  return relay;
}

async function fresh(browser, relay, { standalone = false, url = BASE } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await relay.install(context);
  await context.addInitScript(() => { window.__repforgeLocalRelay = true; });
  if (standalone) await context.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function activateProgram(page) {
  return page.evaluate(async () => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog);
    const definition = window.RepForgeProgramCompiler.generateProgram(mapped.value, catalog).value;
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Upper/Lower block", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "trainer-handoff" },
    });
    await window.__repforgeStorage.flush();
    return !!(result?.localOk || result?.idbOk);
  });
}

async function openShare(page) {
  await page.locator('nav button[data-view="program"]').click();
  await page.waitForSelector("#program.view.active");
  await page.locator("#shareProgramSetup").click();
  await page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 15000 });
}

const sheet = (page) => page.evaluate(() => {
  const shown = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains("hidden") && !el.hidden; };
  return {
    relay: document.querySelector("#shareSetupSheet").dataset.relay || "",
    who: shown("shareSetupWho"), whoOpen: document.querySelector("#shareSetupWho")?.getAttribute("aria-expanded"),
    fields: shown("shareSetupWhoFields"), create: shown("shareSetupCreate"), copy: shown("shareSetupCopy"),
    copyEnabled: !document.querySelector("#shareSetupCopy")?.disabled, qr: shown("shareSetupQr") && !!document.querySelector("#shareSetupQr svg"),
    hint: shown("shareSetupQrHint"), expiry: document.querySelector("#shareSetupExpiry")?.textContent || "",
    warn: shown("shareSetupWarn") ? document.querySelector("#shareSetupWarn").textContent : "", retry: shown("shareSetupRetry"),
    link: document.querySelector("#shareSetupLink")?.textContent || "", file: shown("shareSetupFile"),
  };
});

const gate = (page) => page.evaluate(() => {
  const shown = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains("hidden"); };
  return {
    status: window.__repforgeSharedSetup?.status, headline: document.querySelector("#firstRunHeadline")?.textContent || "",
    name: document.querySelector("#firstRunSharedName")?.textContent || "", from: shown("firstRunSharedFrom") ? document.querySelector("#firstRunSharedFrom").textContent : "",
    message: shown("firstRunSharedMessageBox") ? document.querySelector("#firstRunSharedMessage").textContent : "",
    label: document.querySelector("#firstRunSharedMessageLabel")?.textContent || "",
    body: document.querySelector("#firstRunSharedBody")?.textContent || "", error: shown("firstRunSharedError") ? document.querySelector("#firstRunSharedError").textContent : "",
    action: shown("firstRunRelayAction") ? document.querySelector("#firstRunRelayActionLabel").textContent : "",
    start: shown("firstRunSharedProgram"), busy: document.querySelector("#firstRunSharedStart")?.getAttribute("aria-busy"), hash: location.hash,
    stored: JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.programMeta?.onboarded === true,
  };
});
const cookieOf = async (context) => (await context.cookies()).find((cookie) => cookie.name === COOKIE)?.value ?? null;
const waitStatus = (page, statuses) => page.waitForFunction((list) => list.includes(window.__repforgeSharedSetup?.status), statuses, { timeout: 15000 });

async function main() {
  console.log("Plan 086 slice 2: program handoff through the relay");
  const browser = await launchChromium();
  const relay = fakeRelay();
  const errors = [];
  try {
    // ---- Share ---------------------------------------------------------------------------------------------
    const sender = await fresh(browser, relay);
    errors.push(sender.errors);
    check(await activateProgram(sender.page), "the sender has an active program");
    await openShare(sender.page);
    let s = await sheet(sender.page);
    check(s.relay === "start" && s.create && s.who && s.whoOpen === "false" && !s.fields && !s.copy && !s.link,
      "the Share sheet opens with Create link and one collapsed row; no link yet", s);
    await sender.page.locator("#shareSetupWho").click();
    s = await sheet(sender.page);
    check(s.whoOpen === "true" && s.fields, "the row opens to name, registration and message", s);
    await sender.page.fill("#shareSetupName", "  Rafael   Lima ");
    await sender.page.fill("#shareSetupRegistration", "CREF 012345-G/SP");
    await sender.page.fill("#shareSetupMessage", "Start light in week 1.\nTell me how the squat feels.");
    await sender.page.locator("#shareSetupCreate").click();
    await sender.page.waitForFunction(() => document.querySelector("#shareSetupSheet").dataset.relay === "ready", undefined, { timeout: 15000 });
    s = await sheet(sender.page);
    check(s.qr && s.hint && /7/.test(s.expiry) && s.copy && s.copyEnabled && !s.create && !s.who,
      "Create link shows the QR code, the camera hint, the expiry and Copy link", s);
    const link = s.link;
    check(/#r=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(link) && link.startsWith(new URL(BASE).origin), "the link opens this app at #r=<id>.<key>", link.replace(/\.[^.]+$/, ".<key>"));
    check(relay.records.size === 1 && relay.requests.every((r) => r.credentials === "omitted"), "the relay got one record and no cookie", relay.requests);
    const stored = [...relay.records.values()][0];
    check(!JSON.stringify(stored).includes("Rafael") && !JSON.stringify(stored).includes(link.split(".").pop()),
      "the relay holds ciphertext only: no name and no key");
    await sender.page.keyboard.press("Escape");
    await sender.page.waitForSelector("#shareSetupSheet", { state: "hidden" });
    await openShare(sender.page);
    const remembered = await sender.page.evaluate(() => ({ name: document.querySelector("#shareSetupName").value,
      registration: document.querySelector("#shareSetupRegistration").value, message: document.querySelector("#shareSetupMessage").value }));
    check(remembered.name === "Rafael Lima" && remembered.registration === "CREF 012345-G/SP" && remembered.message === "",
      "name and registration are remembered on this device; the message is not", remembered);

    // Relay down: the setup link is the fallback, and Try again returns to the relay.
    relay.mode = "down";
    await sender.page.locator("#shareSetupCreate").click();
    await sender.page.waitForFunction(() => !document.querySelector("#shareSetupWarn").classList.contains("hidden"), undefined, { timeout: 20000 });
    s = await sheet(sender.page);
    check(s.retry && s.warn.length > 0 && (s.link.includes("#setup=v") ? s.copy : s.file),
      "with the relay down, the sheet falls back to the setup link or the file, says what that loses, and offers Try again", { ...s, link: s.link.slice(0, 40) });
    relay.mode = "up";
    await sender.page.locator("#shareSetupRetry").click();
    await sender.page.waitForFunction(() => document.querySelector("#shareSetupSheet").dataset.relay === "ready", undefined, { timeout: 15000 });
    s = await sheet(sender.page);
    check(s.qr && !s.warn && !s.retry && /#r=/.test(s.link), "Try again creates the relay link once the relay is back", { ...s, link: "" });
    await sender.context.close();

    // ---- Receive: a new client --------------------------------------------------------------------------------
    const client = await fresh(browser, relay, { url: link });
    errors.push(client.errors);
    await waitStatus(client.page, ["ready", "invalid"]);
    let g = await gate(client.page);
    check(g.status === "ready" && /Rafael Lima/.test(g.from) && /CREF 012345-G\/SP/.test(g.from) && /Upper\/Lower block/.test(g.name),
      "the gate names the program and who it is from", g);
    check(g.message === "Start light in week 1.\nTell me how the squat feels." && /Rafael/.test(g.label), "the sender's message is shown as sent", g);
    check(g.start && g.busy !== "true" && g.hash === "" && !g.stored, "nothing is saved before Start, and the key leaves the address bar", g);
    const locator = await cookieOf(client.context);
    check(/^r=[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(locator || ""), "a browser tab keeps the locator cookie for the Home Screen app", locator ? "r=<locator>" : null);
    await client.page.locator("#firstRunSharedStart").click();
    await client.page.waitForFunction(() => document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
    check(true, "See the program opens the received program's review");
    check(await cookieOf(client.context) === locator, "the cookie stays while the program is an unopened proposal");
    await client.page.locator("#entryActivate").click();
    await client.page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
    check(await cookieOf(client.context) === null, "starting the program in the browser tab clears the cookie");
    await client.context.close();

    // ---- The installed app clears the cookie once it has opened the program ---------------------------------------
    const installed = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await relay.install(installed);
  await installed.addInitScript(() => { window.__repforgeLocalRelay = true; });
    await installed.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true }));
    await installed.addCookies([{ name: COOKIE, value: locator, url: BASE }]);
    const home = await installed.newPage();
    await home.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(home, { base: BASE });
    await waitStatus(home, ["ready", "invalid"]);
    g = await gate(home);
    check(g.status === "ready" && /Rafael Lima/.test(g.from), "the installed app opens the program from the cookie", g);
    check(await cookieOf(installed) === null, "and then clears the cookie");
    await installed.close();

    // ---- Failures -----------------------------------------------------------------------------------------------
    relay.mode = "down";
    const down = await fresh(browser, relay, { url: link });
    errors.push(down.errors);
    await waitStatus(down.page, ["invalid"]);
    g = await gate(down.page);
    check(/right now|agora/i.test(g.headline) && g.action && g.error && !g.stored, "relay unavailable: its own gate with Try again; nothing saved", g);
    check(await cookieOf(down.context) !== null, "an unavailable relay keeps the cookie, so Try again can still open it");
    relay.mode = "up";
    await down.page.locator("#firstRunRelayAction").click();
    await waitStatus(down.page, ["ready"]);
    check((await gate(down.page)).status === "ready", "Try again opens the program once the relay answers");
    await down.context.close();

    const expiredLink = link.replace(/#r=[A-Za-z0-9_-]{22}/, `#r=${randomBytes(16).toString("base64url")}`);
    const expired = await fresh(browser, relay, { url: expiredLink });
    errors.push(expired.errors);
    await waitStatus(expired.page, ["invalid"]);
    g = await gate(expired.page);
    check(/expired|expirou/i.test(g.headline) && !g.action && g.hash === "", "an expired link gets the expired gate, with no Try again", g);
    check(await cookieOf(expired.context) === null, "an expired link's cookie is cleared");
    await expired.context.close();

    const newer = await fresh(browser, relay);
    errors.push(newer.errors);
    const newerLink = await newer.page.evaluate(async () => {
      const doc = JSON.stringify({ kind: "taurifer-program-handoff", version: 2 });
      const sealed = await window.RepForgeTrainerRelay.seal(doc);
      return { record: sealed.record, key: sealed.key };
    });
    const newerId = randomBytes(16).toString("base64url");
    relay.records.set(newerId, { ...newerLink.record, expiresAt: new Date(Date.now() + 864e5).toISOString() });
    await newer.page.goto(`${BASE}#r=${newerId}.${newerLink.key}`, { waitUntil: "domcontentloaded" });
    await newer.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(newer.page, { base: BASE });
    await waitStatus(newer.page, ["invalid"]);
    g = await gate(newer.page);
    check(/newer|mais novo/i.test(g.headline) && /Reload|Recarregar/.test(g.action), "a link from a newer version asks to reload Taurifer", g);
    check(await cookieOf(newer.context) === null, "and its cookie is cleared");
    await newer.context.close();

    const before = relay.requests.length;
    const incomplete = await fresh(browser, relay, { url: link.slice(0, -10) });
    errors.push(incomplete.errors);
    await waitStatus(incomplete.page, ["invalid"]);
    g = await gate(incomplete.page);
    check(/incomplete|incompleto/i.test(g.headline) && relay.requests.length === before, "a truncated link is incomplete and asks the relay nothing", g);
    await incomplete.context.close();

    // A device that already has a program opens a relay link as a program update: test/trainer-update-browser.mjs.

    check(errors.flat().length === 0, "no page errors", errors.flat());
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    await browser.close();
  }
  console.log(`\nPlan 086 handoff: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
