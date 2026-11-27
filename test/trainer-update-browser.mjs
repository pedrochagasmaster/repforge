#!/usr/bin/env node
/**
 * Plan 086 slice 3: a program update for a client who already has a program.
 *
 * A trainer revises the client's program and shares it through the relay. The client opens the link and a sheet
 * over Today shows what changed (swapped, changed, removed), the trainer's message and the whole program. Keep my
 * current program writes nothing; Use the update replaces the program through the transition adapter. Either way
 * the history, the archive of past programs and a workout in progress survive (the plan's owning proof). The
 * relay's failures show the gate's errors in the sheet, the installed app opens the update from the handoff cookie,
 * and the cookie follows the slice 2 rules. A fake relay answers through Playwright routes, so no request ever
 * reaches relay.taurifer.com.
 *
 * Run: node test/trainer-update-browser.mjs (REPFORGE_URL names a static server).
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
  else { failures.push(message); console.log(`  ✗ ${message}`); if (detail !== undefined) console.log(`    ${JSON.stringify(detail).slice(0, 800)}`); }
}

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
      relay.requests.push({ path, credentials: request.headers().cookie ? "sent" : "omitted" });
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

async function fresh(browser, relay, { standalone = false, url = BASE, context = null } = {}) {
  context ||= await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (!context.__relay) { await relay.install(context); context.__relay = true; }
  await context.addInitScript(() => { window.__repforgeLocalRelay = true; });
  if (standalone) await context.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

/** Activates a generated program, or the given definition, through the production setup boundary. */
async function activate(page, { name, definition = null, days = 4 }) {
  return page.evaluate(async ({ name, definition, days }) => {
    if (!definition) {
      const catalog = window.RepForgeExerciseCatalog.snapshot();
      const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: days, sessionMinutes: 60,
        environment: { kind: "commercial_gym" },
      }, catalog);
      definition = window.RepForgeProgramCompiler.generateProgram(mapped.value, catalog).value;
    }
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name, answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "trainer-update" },
    });
    await window.__repforgeStorage.flush();
    return !!(result?.localOk || result?.idbOk);
  }, { name, definition, days });
}

/** Logs a workout on a training day: every set when it is saved as history, else one set left in progress. */
async function logWorkout(page, dayIndex, { save }) {
  const result = await page.evaluate(async ({ dayIndex, save }) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1"));
    const day = state.programMeta.programDefinition.days.filter((entry) => entry.kind === "training")[dayIndex].name;
    await window.__repforgeEnterWorkout({ day });
    const draft = window.__repforgeWorkoutDraft.current();
    for (const exerciseInstanceId of save ? draft.exerciseOrder : draft.exerciseOrder.slice(0, 1)) {
      const exercise = draft.exercises[exerciseInstanceId];
      for (const setId of save ? exercise.setOrder : exercise.setOrder.slice(0, 1)) {
        for (const metric of exercise.sets[setId].programmed.metrics || [])
          await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId: metric.id, value: metric.semantic === "loadKg" ? "40" : "8" });
        await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId, setId, field: "rir", value: "2" });
        await window.__repforgeWorkoutDraft.dispatch("completeSet", { exerciseInstanceId, setId, completedAt: new Date().toISOString() });
      }
    }
    await window.__repforgeWorkoutDraft.flush();
    if (!save) return { day };
    const finished = await window.__repforgeSaveWorkout();
    await window.__repforgeStorage.flush();
    return { day, saved: !!(finished?.localOk || finished?.idbOk), reason: finished?.reason || null };
  }, { dayIndex, save });
  if (save) {
    await page.evaluate(() => window.__repforgeSessionSummary?.close?.());
    await page.waitForTimeout(400);
  }
  return result;
}

const durable = (page) => page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem("repforge_v1"));
  return {
    programId: state.programMeta.id, name: state.programMeta.name,
    definition: JSON.stringify(state.programMeta.programDefinition),
    log: JSON.stringify(state.log), logCount: state.log.length,
    archive: (state.programHistory || []).map((entry) => entry.id),
    draft: localStorage.getItem("repforge_draft_v1"),
  };
});

const sheet = (page) => page.evaluate(() => {
  const el = document.getElementById("relayUpdateSheet");
  const shown = (id) => { const node = document.getElementById(id); return !!node && !node.classList.contains("hidden") && !node.hidden; };
  const text = (id) => (shown(id) ? document.getElementById(id).textContent : "");
  return {
    open: !!el && !el.hidden && !el.classList.contains("hidden"), state: el?.dataset.relayUpdate || "",
    title: text("relayUpdateTitle"), sub: text("relayUpdateFor"), lead: text("relayUpdateLead"),
    rows: [...document.querySelectorAll("#relayUpdateDiff .relay-update__row")].map((row) => ({
      day: row.querySelector(".relay-update__day")?.textContent || "", name: row.querySelector(".relay-update__name")?.textContent || "",
      tag: row.querySelector(".relay-update__tag")?.textContent || "", was: row.querySelector(".relay-update__was")?.textContent || "",
      now: row.querySelector(".relay-update__now")?.textContent || "" })),
    label: text("relayUpdateMessageLabel"), message: text("relayUpdateMessage"), note: text("relayUpdateNote"),
    all: document.querySelectorAll("#relayUpdateAll .relay-update__row").length, seeAll: shown("relayUpdateSeeAll"),
    use: shown("relayUpdateUse"), keep: shown("relayUpdateKeep"), action: text("relayUpdateAction"), dismiss: shown("relayUpdateDismiss"),
    error: text("relayUpdateError"), changes: window.__repforgeRelayUpdate?.changes, hash: location.hash,
  };
});
const waitSheet = (page, prefix) => page.waitForFunction((prefix) =>
  (document.getElementById("relayUpdateSheet")?.dataset.relayUpdate || "").startsWith(prefix), prefix, { timeout: 20000 });
const waitClosed = (page) => page.waitForFunction(() => document.getElementById("relayUpdateSheet")?.hidden === true, undefined, { timeout: 15000 });
const cookieOf = async (context) => (await context.cookies()).find((cookie) => cookie.name === COOKIE)?.value ?? null;

/** The trainer's revision of the client's program: one swap, one change, one removal. Slot ids are kept. */
async function revise(page, definition) {
  return page.evaluate((json) => {
    const next = JSON.parse(json);
    const training = next.days.filter((day) => day.kind === "training");
    const [first, second] = training;
    const moved = second.slots.find((slot) => !first.slots.some((other) => other.exerciseId === slot.exerciseId));
    const copy = JSON.parse(JSON.stringify(moved));
    for (const cycle of copy.prescriptionsByCycle) for (const set of cycle.sets) set.id = `${set.id}t`;
    const swapped = first.slots[0];
    first.slots[0] = { ...copy, id: swapped.id, order: swapped.order };
    second.slots = second.slots.filter((slot) => slot !== moved).map((slot, index) => ({ ...slot, order: index + 1 }));
    const changed = second.slots[0];
    for (const cycle of changed.prescriptionsByCycle) for (const set of cycle.sets) set.targets.reps = { min: 10, max: 12 };
    return { definition: JSON.stringify(next), swapped: swapped.id, changed: changed.id, removed: moved.id };
  }, definition);
}

async function main() {
  console.log("Plan 086 slice 3: a program update for an existing client");
  const browser = await launchChromium();
  const relay = fakeRelay();
  const errors = [];
  try {
    // ---- The client: an archived program, history and a workout in progress ---------------------------------
    const client = await fresh(browser, relay);
    errors.push(client.errors);
    check(await activate(client.page, { name: "First block" }), "the client's first program");
    check(await activate(client.page, { name: "Upper/Lower block" }), "the client's current program, with the first archived");
    const saved = await logWorkout(client.page, 0, { save: true });
    check(saved.saved === true, "a finished workout is in the history", saved);
    await logWorkout(client.page, 1, { save: false });
    const before = await durable(client.page);
    check(before.logCount > 0 && before.archive.length === 1 && !!before.draft, "history, one archived program and a workout in progress",
      { log: before.logCount, archive: before.archive.length, draft: !!before.draft });

    // ---- The trainer revises it and shares it through the relay ------------------------------------------------
    const trainer = await fresh(browser, relay);
    errors.push(trainer.errors);
    const revision = await revise(trainer.page, before.definition);
    check(await activate(trainer.page, { name: "Upper/Lower block v2", definition: JSON.parse(revision.definition) }), "the trainer's revision");
    await trainer.page.locator('nav button[data-view="program"]').click();
    await trainer.page.locator("#shareProgramSetup").click();
    await trainer.page.waitForSelector("#shareSetupSheet:not(.hidden)", { timeout: 15000 });
    await trainer.page.locator("#shareSetupWho").click();
    await trainer.page.fill("#shareSetupName", "Rafael Lima");
    await trainer.page.fill("#shareSetupMessage", "Bench goes to 10–12 this block.");
    await trainer.page.locator("#shareSetupCreate").click();
    await trainer.page.waitForFunction(() => document.querySelector("#shareSetupSheet").dataset.relay === "ready", undefined, { timeout: 15000 });
    const link = await trainer.page.evaluate(() => document.querySelector("#shareSetupLink").textContent);
    check(/#r=/.test(link), "the trainer has a relay link");
    await trainer.context.close();

    // ---- The update opens in the app the client already uses --------------------------------------------------
    await client.page.evaluate((hash) => { location.hash = hash; }, new URL(link).hash);
    await waitSheet(client.page, "ready");
    let s = await sheet(client.page);
    check(s.title === "Program update" && /^From Rafael · Upper\/Lower block v2 · sent /.test(s.sub), "the sheet names the update, who sent it and when", s);
    check(s.lead === "3 changes to your program" && JSON.stringify(s.changes) === JSON.stringify(["swapped", "changed", "removed"]),
      "it counts the changes: swapped, changed, removed, in the program's order", s);
    check(s.rows[0].tag === "Swapped" && !!s.rows[0].was && s.rows[0].was !== s.rows[0].name && /^\d+ × \d+/.test(s.rows[0].now),
      "a swap names the new exercise, strikes the old one and gives its figures", s.rows[0]);
    check(s.rows[1].tag === "Changed" && /× 10–12$/.test(s.rows[1].now) && /×/.test(s.rows[1].was) && !/10–12/.test(s.rows[1].was),
      "a change strikes the old figures and shows the new ones", s.rows[1]);
    check(s.rows[2].tag === "Removed" && !s.rows[2].now, "a removal is named with no figures", s.rows[2]);
    check(s.label === "Message from Rafael" && s.message === "Bench goes to 10–12 this block.", "the trainer's message", s);
    check(s.note === "Your workout in progress stays as it is. The update starts with your next session, and your history stays." && s.use && s.keep,
      "with a workout in progress, the action bar says it stays; Use the update and Keep my current program", s);
    check(s.hash === "" && await cookieOf(client.context) !== null, "the key leaves the address bar; the tab keeps the cookie while it is unanswered");
    check(s.seeAll && s.all === 0, "the whole program waits behind See the whole program");
    await client.page.locator("#relayUpdateSeeAll").click();
    s = await sheet(client.page);
    check(!s.seeAll && s.all > 10, "See the whole program lists every exercise", s.all);

    // Keep my current program: nothing changes.
    await client.page.locator("#relayUpdateKeep").click();
    await waitClosed(client.page);
    let after = await durable(client.page);
    check(after.programId === before.programId && after.definition === before.definition && after.log === before.log &&
      JSON.stringify(after.archive) === JSON.stringify(before.archive) && after.draft === before.draft,
    "Keep my current program writes nothing: program, history, archive and the workout in progress are as they were");
    check(await cookieOf(client.context) === null, "and the answered link's cookie is cleared");

    // Use the update, opened by navigating to the link (the boot path).
    const reopened = await client.page.goto(link, { waitUntil: "domcontentloaded" }).then(() => waitForAppBoot(client.page, { base: BASE }));
    void reopened;
    await waitSheet(client.page, "ready");
    await client.page.locator("#relayUpdateUse").click();
    await waitClosed(client.page);
    await client.page.evaluate(() => window.__repforgeStorage.flush());
    after = await durable(client.page);
    const received = JSON.parse(after.definition);
    check(after.programId !== before.programId && after.name === "Upper/Lower block v2" &&
      received.days.some((day) => day.slots?.some((slot) => slot.id === revision.swapped)) &&
      !received.days.some((day) => day.slots?.some((slot) => slot.id === revision.removed)),
    "Use the update makes the received program the current one", { name: after.name });
    check(after.log === before.log, "the history is untouched");
    check(after.archive.length === 2 && after.archive[0] === before.archive[0] && after.archive[1] === before.programId,
      "the archive keeps the first program and adds the one it replaced", after.archive);
    check(after.draft === before.draft, "the workout in progress is left exactly as it was");
    check(await cookieOf(client.context) === null, "no cookie is left behind");
    const toast = await client.page.evaluate(() => document.querySelector("#toast")?.textContent || "");
    check(/Program saved/.test(toast), "a toast confirms it", toast);
    await client.context.close();

    // ---- The installed app opens an update from the handoff cookie, then clears it -----------------------------
    const installedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const seededInstalled = await fresh(browser, relay, { context: installedContext });
    errors.push(seededInstalled.errors);
    await activate(seededInstalled.page, { name: "Full body", days: 3 });
    await seededInstalled.page.close();
    const locator = new URL(link).hash.slice(1);
    await installedContext.addCookies([{ name: COOKIE, value: locator, url: BASE }]);
    const installed = await fresh(browser, relay, { context: installedContext, standalone: true });
    errors.push(installed.errors);
    await waitSheet(installed.page, "ready");
    s = await sheet(installed.page);
    check(s.title === "New program" && s.lead === "" && s.all > 10 && s.note === "Your history and past programs stay. The update starts with your next session.",
      "a program that shares nothing with the current one is a new program, shown whole", s);
    check(await cookieOf(installedContext) === null, "the installed app clears the cookie once it has opened the update");
    await installedContext.close();

    // ---- The relay's failures: the gate's errors in the sheet -------------------------------------------------
    const failing = await fresh(browser, relay);
    errors.push(failing.errors);
    await activate(failing.page, { name: "Upper/Lower block" });
    relay.mode = "down";
    await failing.page.evaluate((hash) => { location.hash = hash; }, new URL(link).hash);
    await waitSheet(failing.page, "error-unavailable");
    s = await sheet(failing.page);
    check(s.action === "Try again" && !s.use && !s.keep && await cookieOf(failing.context) !== null,
      "relay down: Try again, nothing changes, and the cookie stays for it", s);
    relay.mode = "up";
    await failing.page.locator("#relayUpdateAction").click();
    await waitSheet(failing.page, "ready");
    check(true, "Try again opens the update once the relay is back");
    await failing.page.locator("#relayUpdateClose").click();
    await waitClosed(failing.page);
    relay.records.clear();
    await failing.page.evaluate((hash) => { location.hash = hash; }, new URL(link).hash);
    await waitSheet(failing.page, "error-expired");
    s = await sheet(failing.page);
    check(/expired/.test(s.lead) && s.dismiss && !s.action && await cookieOf(failing.context) === null,
      "an expired link: its own message, Close only, and the cookie is cleared", s);
    await failing.page.locator("#relayUpdateDismiss").click();
    await waitClosed(failing.page);
    const truncated = new URL(link).hash.slice(0, -3);
    const reads = relay.requests.length;
    await failing.page.evaluate((hash) => { location.hash = hash; }, truncated);
    await waitSheet(failing.page, "error-incomplete");
    check(relay.requests.length === reads, "a truncated link is incomplete and asks the relay nothing");
    const unchanged = await durable(failing.page);
    check(unchanged.name === "Upper/Lower block", "none of the failures changed the program");
    await failing.context.close();

    check(errors.flat().length === 0, "no page errors", errors.flat());
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally {
    await browser.close();
  }
  console.log(`\nPlan 086 update: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
