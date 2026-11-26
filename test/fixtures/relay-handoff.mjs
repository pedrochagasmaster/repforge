/**
 * A fake trainer relay for browser tests and catalog states (Plan 086 slice 2). It answers the production contract
 * (POST create, POST read, CORS for the calling page) through Playwright routes, so nothing reaches
 * relay.taurifer.com. `mode`: "up", "down" (503) or "hold" (never answers, for the opening state).
 */
import { randomBytes } from "node:crypto";
import { SETUP_SETTINGS } from "./setup-link-v4.mjs";

export const RELAY_ORIGIN = "https://relay.taurifer.com";

export function fakeRelay({ fixedId = null, fixedExpiresAt = null } = {}) {
  const relay = { records: new Map(), mode: "up", requests: [] };
  relay.handler = async (route) => {
    const request = route.request();
    const origin = request.headers().origin || "";
    const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type", "access-control-max-age": "600", vary: "Origin" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    relay.requests.push({ path, credentials: request.headers().cookie ? "sent" : "omitted" });
    const json = (status, body) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (relay.mode === "hold") return;
    if (relay.mode === "down") return json(503, { state: "unavailable" });
    const body = JSON.parse(request.postData() || "{}");
    if (path === "/v1/relay/records") {
      const id = fixedId || randomBytes(16).toString("base64url");
      const expiresAt = fixedExpiresAt || new Date(Date.now() + 7 * 864e5).toISOString();
      relay.records.set(id, { ...body, expiresAt });
      return json(201, { id, expiresAt });
    }
    if (path === "/v1/relay/records/read") {
      const record = relay.records.get(body.id);
      return record ? json(200, record) : json(404, { state: "unavailable" });
    }
    return json(404, { state: "unavailable" });
  };
  /** Route a page or a browser context to this relay, and let a local page use it. */
  relay.install = async (target) => {
    await target.route(`${RELAY_ORIGIN}/**`, relay.handler);
    await target.addInitScript(() => { window.__repforgeLocalRelay = true; });
  };
  return relay;
}

/**
 * Seal a program handoff in the page (the app's own encoder and relay client) and store its record in `relay`.
 * Returns the `#r=<id>.<key>` fragment. `document` overrides the handoff document entirely (for a newer version).
 */
export async function sealHandoff(page, relay, { name = "Coach block", language = "en", trainer = null, message = "", document = null } = {}) {
  const sealed = await page.evaluate(async ({ name, language, trainer, message, document, settings }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const Compiler = window.RepForgeProgramCompiler;
    let text = document ? JSON.stringify(document) : null;
    if (!text) {
      const mapped = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", daysPerWeek: 4, sessionMinutes: 60,
        environment: { kind: "commercial_gym" },
      }, catalog);
      const definition = Compiler.generateProgram(mapped.value, catalog).value;
      const sharedSettings = { ...settings, lang: language };
      const encoded = window.RepForgeTrainerDocuments.encodeProgramHandoff({
        program: { name, definition }, settings: sharedSettings, language, startingLoads: [],
        ...(trainer ? { trainer } : {}), ...(message ? { message } : {}),
      }, {
        builtInIds: new Set(catalog.exercises.map((exercise) => exercise.id)), catalogSnapshot: catalog,
        validateProgramDefinition: Compiler.validateProgramDefinition, generateProgram: Compiler.generateProgram,
        generatorVersion: Compiler.GENERATOR_VERSION,
      });
      if (!encoded.ok) return { ok: false, code: encoded.code, issues: encoded.issues?.slice(0, 3) };
      text = encoded.text;
    }
    const result = await window.RepForgeTrainerRelay.seal(text);
    return result.ok ? { ok: true, record: result.record, key: result.key } : result;
  }, { name, language, trainer, message, document, settings: SETUP_SETTINGS });
  if (!sealed?.ok) throw new Error(`sealHandoff failed: ${JSON.stringify(sealed)}`);
  const id = randomBytes(16).toString("base64url");
  relay.records.set(id, { ...sealed.record, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() });
  return `#r=${id}.${sealed.key}`;
}
