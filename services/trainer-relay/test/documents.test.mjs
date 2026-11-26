// Plan 086 stage 2: the program handoff and training update documents, their
// strict validation, their trip through a local relay, the update's privacy
// boundary and its measured size.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { after, before, describe, test } from "node:test";
import { APP_ORIGIN, Contract, ROOT, startRelay } from "./local-relay.mjs";
import { logRows } from "./log-fixture.mjs";
import { Setup, fourDaySevenWeekDocument } from "./program-fixture.mjs";

const Docs = createRequire(import.meta.url)(join(ROOT, "trainer-documents.js"));
const BLOCK = "block-current";

let fixture;
let firstSlot;
before(() => {
  fixture = fourDaySevenWeekDocument();
  firstSlot = fixture.document.program.definition.days.find((day) => day.kind === "training").slots[0].id;
});

function handoffInput(overrides = {}) {
  const { program, settings, language } = structuredClone(fixture.document);
  return {
    program, settings, language,
    startingLoads: [{ slotId: firstSlot, openingKg: 42.5 }],
    message: "Começa leve na primeira semana.\nQualquer dor, me avisa.",
    trainer: { displayName: "Ana Souza", registration: "CREF 012345-G/SP" },
    ...overrides,
  };
}

function updateSource(log, extra = {}) {
  return { program: structuredClone(fixture.document.program), programMeta: { blockId: BLOCK }, log, ...extra };
}

describe("program handoff", () => {
  test("encodes, validates and decodes the trainer's parts exactly", () => {
    const encoded = Docs.encodeProgramHandoff(handoffInput(), fixture.options);
    assert.equal(encoded.ok, true, JSON.stringify(encoded.issues?.slice(0, 3)));
    assert.equal(encoded.value.kind, Docs.HANDOFF_KIND);
    assert.equal(encoded.value.version, 1);
    const decoded = Docs.decodeProgramHandoff(encoded.text, fixture.options);
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.value, encoded.value);
    assert.deepEqual(decoded.value.program, fixture.document.program, "the program is the validated shared-setup program");
    const bare = Docs.encodeProgramHandoff(handoffInput({ message: "", startingLoads: [], trainer: { displayName: "Ana" } }), fixture.options);
    assert.equal(bare.ok, true, "message, starting loads and registration are optional");
    assert.equal("message" in bare.value, false);
  });

  test("fails closed on other kinds, newer versions and anything unknown", () => {
    const good = Docs.encodeProgramHandoff(handoffInput(), fixture.options).value;
    const code = (document) => Docs.validateProgramHandoff(document, fixture.options).code;
    assert.equal(code({ ...good, kind: Setup.KIND }), "unsupported-kind");
    assert.equal(code({ ...good, kind: Docs.UPDATE_KIND }), "unsupported-kind");
    assert.equal(code({ ...good, version: 2 }), "unsupported-version", "a newer handoff is refused whole");
    assert.equal(code({ ...good, extra: true }), "invalid-schema");
    assert.equal(code({ ...good, trainer: { displayName: "Ana", email: "x@example.com" } }), "invalid-schema");
    assert.equal(code({ ...good, trainer: { displayName: " " } }), "invalid-schema");
    // A plain share from the app may carry no trainer at all; a present trainer still needs a name.
    const { trainer: _omitted, ...anonymous } = good;
    assert.equal(Docs.validateProgramHandoff(anonymous, fixture.options).ok, true);
    assert.equal(code({ ...good, trainer: {} }), "invalid-schema");
    assert.equal(code({ ...good, trainer: null }), "invalid-schema");
    assert.equal(code({ ...good, message: "x".repeat(Docs.LIMITS.messageChars + 1) }), "invalid-schema");
    assert.equal(code({ ...good, startingLoads: [{ slotId: "no-such-slot", openingKg: 10 }] }), "invalid-schema");
    assert.equal(code({ ...good, startingLoads: [{ slotId: firstSlot, openingKg: 10 }, { slotId: firstSlot, openingKg: 12 }] }), "invalid-schema");
    assert.equal(code({ ...good, startingLoads: [{ slotId: firstSlot, openingKg: 0 }] }), "invalid-schema");
    assert.equal(code({ ...good, settings: { ...good.settings, theme: "dark" } }), "invalid-schema", "only the allowlisted settings");
    const unknownExercise = structuredClone(good);
    unknownExercise.program.definition.days.find((day) => day.kind === "training").slots[0].exerciseId = "not-a-catalog-id";
    assert.equal(code(unknownExercise), "invalid-schema");
    const withHistory = structuredClone(good);
    withHistory.program.history = [];
    assert.equal(code(withHistory), "invalid-schema", "performed state is not shareable, as in a setup link");
    assert.equal(Docs.decodeProgramHandoff("{not json", fixture.options).code, "invalid-json");
  });

  test("leaves the locked setup-link document and its envelopes unchanged", async () => {
    const good = Docs.encodeProgramHandoff(handoffInput(), fixture.options).value;
    assert.equal(Setup.KIND, "taurifer-shared-setup");
    assert.equal(Setup.VERSION, 2);
    assert.equal(Setup.ENCODING_VERSION, 5);
    assert.equal(Setup.validate(good, fixture.options).ok, false, "a setup-link reader refuses a handoff");
    assert.equal(Docs.validateProgramHandoff(fixture.document, fixture.options).code, "unsupported-kind", "a handoff reader refuses a setup document");
  });
});

describe("training update", () => {
  test("carries only the current program's sessions since the last update", () => {
    const earlier = logRows(fixture.document.program.definition, { weeks: 2, blockId: "block-earlier", start: "2026-07-06T18:00:00.000Z", sessionPrefix: "old" });
    const current = logRows(fixture.document.program.definition, { weeks: 3, blockId: BLOCK });
    const warmup = { ...current[0], set: 0, origin: "suggested-warmup", warmupOrdinal: 1 };
    const source = updateSource([...earlier, ...current, warmup]);
    const first = Docs.encodeTrainingUpdate(source, fixture.options);
    assert.equal(first.ok, true, JSON.stringify(first.issues?.slice(0, 3)));
    assert.equal(first.value.sessions.length, 12, "three weeks of four sessions, none from the earlier program");
    assert.ok(first.value.sessions.every((session) => !session.id.startsWith("old-")));
    assert.equal(first.value.sessions.flatMap((session) => session.sets).length, current.length, "no suggested warm-up rows");
    const cutoff = first.value.sessions[7].completedAt;
    const second = Docs.encodeTrainingUpdate(source, fixture.options, { lastSentAt: cutoff });
    assert.equal(second.ok, true);
    assert.deepEqual(second.value.sessions.map((session) => session.id), first.value.sessions.slice(8).map((session) => session.id));
    assert.equal(Docs.encodeTrainingUpdate(source, fixture.options, { lastSentAt: first.value.sessions.at(-1).completedAt }).code, "nothing-to-send");
    assert.equal(Docs.encodeTrainingUpdate({ ...source, programMeta: {} }, fixture.options).code, "no-current-program");
    const decoded = Docs.decodeTrainingUpdate(first.text, fixture.options);
    assert.equal(decoded.ok, true);
    assert.deepEqual(decoded.value, first.value);
    const set = decoded.value.sessions[1].sets[0];
    const row = current.find((entry) => entry.session === decoded.value.sessions[1].id);
    assert.deepEqual([set.name, set.load, set.reps, set.rir, set.effortSource, set.libraryId], [row.name, row.load, row.reps, row.rir, "rir", row.sourceLibraryId]);
    assert.equal(decoded.value.sessions[1].notes, row.notes, "the client's session notes travel");
  });

  test("fails closed on other kinds, newer versions and unknown fields", () => {
    const good = Docs.encodeTrainingUpdate(updateSource(logRows(fixture.document.program.definition, { weeks: 1, blockId: BLOCK })), fixture.options).value;
    const code = (document) => Docs.validateTrainingUpdate(document, fixture.options).code;
    assert.equal(code({ ...good, kind: Docs.HANDOFF_KIND }), "unsupported-kind");
    assert.equal(code({ ...good, version: 2 }), "unsupported-version");
    assert.equal(code({ ...good, settings: {} }), "invalid-schema");
    const badSet = structuredClone(good);
    badSet.sessions[0].sets[0].libraryId = "not-a-catalog-id";
    assert.equal(code(badSet), "invalid-schema");
    const tooMany = { ...good, sessions: Array.from({ length: Docs.LIMITS.sessions + 1 }, (_, index) => ({ ...good.sessions[0], id: `x${index}` })) };
    assert.equal(code(tooMany), "invalid-schema");
  });
});

describe("training update privacy", () => {
  // Values that exist only in excluded places. None may appear in an encoded update.
  const SENTINEL = {
    bodyweight: 83.71,
    earlierNote: "SENTINEL-EARLIER-HISTORY-NOTE",
    beforeCutoffNote: "SENTINEL-BEFORE-LAST-UPDATE",
    settings: "SENTINEL-SETTING",
    profile: "SENTINEL-PROFILE",
    devicePrefs: "SENTINEL-DEVICE-PREFERENCE",
    rowExtra: "SENTINEL-ROW-EXTRA",
  };
  const EXCLUDED_KEYS = ["bodyweight", "bodyweightKg", "loadingContext", "settings", "profile", "ui", "theme", "calibration",
    "lastRepSlow", "startingLoad", "programHistory", "warmupObservations", "warmupPreferences", "primary", "secondary"];

  function hostileState() {
    const definition = fixture.document.program.definition;
    const earlier = logRows(definition, { weeks: 1, blockId: "block-earlier", start: "2026-07-06T18:00:00.000Z", sessionPrefix: "old" })
      .map((row) => ({ ...row, notes: SENTINEL.earlierNote, exNote: SENTINEL.earlierNote }));
    const sent = logRows(definition, { weeks: 1, blockId: BLOCK, start: "2026-08-31T18:00:00.000Z", sessionPrefix: "sent" })
      .map((row) => ({ ...row, notes: SENTINEL.beforeCutoffNote }));
    const current = logRows(definition, { weeks: 2, blockId: BLOCK }).map((row, index) => ({
      ...row,
      bodyweight: SENTINEL.bodyweight,
      loadingContext: { ...row.loadingContext, bodyweightKg: SENTINEL.bodyweight },
      calibration: { v: 1, predictedReps: 8, predictionEdited: false, prefillBasis: "reps" },
      lastRepSlow: true,
      startingLoad: { v: 1, openingKg: 40, basis: "typed", ramps: 0, version: SENTINEL.rowExtra },
      [`extra${index % 3}`]: SENTINEL.rowExtra,
    }));
    return updateSource([...earlier, ...sent, ...current], {
      settings: { unit: "kg", note: SENTINEL.settings },
      profile: { sex: "f", weightKg: SENTINEL.bodyweight, note: SENTINEL.profile },
      ui: { theme: "dark", note: SENTINEL.devicePrefs },
      bodyweight: SENTINEL.bodyweight,
      programHistory: [{ note: SENTINEL.earlierNote }],
      warmupObservations: { note: SENTINEL.rowExtra },
    });
  }

  function assertClean(encoded) {
    assert.equal(encoded.ok, true, JSON.stringify(encoded.issues?.slice(0, 3)));
    for (const value of Object.values(SENTINEL)) assert.equal(encoded.text.includes(String(value)), false, `${value} leaked`);
    const keys = new Set();
    const walk = (value, path) => {
      if (Array.isArray(value)) value.forEach((entry) => walk(entry, path));
      else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) {
        if (path !== "program") keys.add(key);
        walk(entry, path === "" ? key : path);
      }
    };
    walk(encoded.value, "");
    for (const key of EXCLUDED_KEYS) assert.equal(keys.has(key), false, `${key} is outside the update`);
    for (const session of encoded.value.sessions) {
      assert.deepEqual(Object.keys(session).filter((key) => !Docs.SESSION_KEYS.includes(key)), []);
      for (const set of session.sets) assert.deepEqual(Object.keys(set).filter((key) => !Docs.SET_KEYS.includes(key)), []);
    }
  }

  test("earlier history, body weight, settings and device preferences are never encoded", () => {
    const state = hostileState();
    const lastSentAt = state.log.filter((row) => row.session.startsWith("sent-")).map((row) => row.created).sort().at(-1);
    const encoded = Docs.encodeTrainingUpdate(state, fixture.options, { lastSentAt });
    assertClean(encoded);
    assert.equal(encoded.value.sessions.length, 8, "only the two current weeks after the last update");
  });

  test("random extra row fields and values never pass through (200 seeded rows)", () => {
    let seed = 20261126;
    const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const base = logRows(fixture.document.program.definition, { weeks: 1, blockId: BLOCK });
    const rows = Array.from({ length: 200 }, (_, index) => {
      const row = { ...base[index % base.length], session: `r-${Math.floor(index / 10)}` };
      for (let extra = 0; extra < 1 + Math.floor(random() * 4); extra += 1) {
        const key = EXCLUDED_KEYS[Math.floor(random() * EXCLUDED_KEYS.length)] + (random() < 0.5 ? "" : `_${extra}`);
        row[key] = random() < 0.5 ? SENTINEL.rowExtra : { nested: SENTINEL.rowExtra, kg: SENTINEL.bodyweight };
      }
      return row;
    });
    assertClean(Docs.encodeTrainingUpdate(updateSource(rows), fixture.options));
  });

  test("a document that names an excluded field is refused by the decoder", () => {
    const good = Docs.encodeTrainingUpdate(updateSource(logRows(fixture.document.program.definition, { weeks: 1, blockId: BLOCK })), fixture.options).value;
    const inject = (mutate) => {
      const copy = structuredClone(good);
      mutate(copy);
      return Docs.decodeTrainingUpdate(JSON.stringify(copy), fixture.options).code;
    };
    assert.equal(inject((doc) => { doc.sessions[0].sets[0].bodyweight = 80; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.sessions[0].bodyweight = 80; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.sessions[0].sets[0].loadingContext = { bodyweightKg: 80 }; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.settings = { unit: "kg" }; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.profile = {}; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.history = []; }), "invalid-schema");
    assert.equal(inject((doc) => { doc.program.programHistory = []; }), "invalid-schema");
  });
});

describe("documents through the relay", () => {
  let relay;
  before(async () => { relay = await startRelay(); });
  after(async () => { await relay.stop(); });
  const options = (extra = {}) => ({ serviceOrigin: "https://relay.test", linkBase: APP_ORIGIN + "/", fetch: relay.fetchFrom(), ...extra });

  test("a handoff and an update round-trip and decode as their kind only", async () => {
    const handoff = Docs.encodeProgramHandoff(handoffInput(), fixture.options);
    const sentHandoff = await Docs.send(handoff, options());
    assert.equal(sentHandoff.ok, true, sentHandoff.code);
    const receivedHandoff = await Docs.receive(sentHandoff.link, Docs.HANDOFF_KIND, fixture.options, options());
    assert.equal(receivedHandoff.ok, true, receivedHandoff.code);
    assert.deepEqual(receivedHandoff.value, handoff.value);
    assert.equal((await Docs.receive(sentHandoff.link, Docs.UPDATE_KIND, fixture.options, options())).code, "unsupported-kind",
      "a handoff link is never read as an update");

    const update = Docs.encodeTrainingUpdate(updateSource(logRows(fixture.document.program.definition, { weeks: 3, blockId: BLOCK })), fixture.options);
    const sentUpdate = await Docs.send(update, options({ linkBase: "https://studio.taurifer.com/" }));
    assert.equal(sentUpdate.ok, true, sentUpdate.code);
    const receivedUpdate = await Docs.receive(sentUpdate.link, Docs.UPDATE_KIND, fixture.options, options());
    assert.equal(receivedUpdate.ok, true, receivedUpdate.code);
    assert.deepEqual(receivedUpdate.value, update.value);

    const wrongKey = Contract.formatLink(APP_ORIGIN + "/", sentUpdate.id, Contract.base64UrlEncode(new Uint8Array(32)));
    assert.equal((await Docs.receive(wrongKey, Docs.UPDATE_KIND, fixture.options, options())).code, "decrypt-failed");
    assert.equal((await Docs.send({ ok: false }, options())).code, "invalid-document");
  });
});

describe("training update size", () => {
  test("measured on realistic logs and held under the proposed bound", () => {
    const definition = fixture.document.program.definition;
    const programOnly = Buffer.byteLength(JSON.stringify(fixture.document.program));
    const lines = [`program alone: ${programOnly} bytes JSON, ${gzipSync(JSON.stringify(fixture.document.program)).length} gzip`];
    for (const weeks of [1, 3, 7, Docs.LIMITS.sessions / 4]) {
      const log = logRows(definition, { weeks, blockId: BLOCK });
      const encoded = Docs.encodeTrainingUpdate(updateSource(log), fixture.options);
      assert.equal(encoded.ok, true, encoded.code);
      const bytes = Buffer.byteLength(encoded.text);
      const gzip = gzipSync(encoded.text).length;
      assert.ok(bytes <= Docs.LIMITS.updateBytes, `${weeks} weeks: ${bytes} bytes`);
      assert.ok(gzip + 16 <= Contract.LIMITS.maxCiphertextBytes, "the relay's ciphertext bound is never the binding limit");
      lines.push(`${weeks} weeks: ${encoded.value.sessions.length} sessions, ${log.length} sets, ${bytes} bytes JSON, ${gzip} gzip`);
    }
    console.log(lines.join("\n"));
  });
});
