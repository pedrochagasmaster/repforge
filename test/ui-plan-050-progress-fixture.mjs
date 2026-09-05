#!/usr/bin/env node
import assert from "node:assert/strict";
import { catalogState } from "../tools/ui-screens/fixtures.mjs";

const state = catalogState();
const movement = state.program.find((exercise) => exercise.id === "ex-lat");
const sessions = [...new Map(state.log
  .filter((row) => row.exerciseId === "ex-lat" && !row.warmup)
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((row) => [row.session, { date: row.date, loads: [] }]))].map(([session, detail]) => ({
  session,
  date: detail.date,
  loads: state.log.filter((row) => row.session === session && row.exerciseId === "ex-lat").map((row) => row.load),
}));

assert.deepEqual(
  { id: movement?.id, name: movement?.name, primary: movement?.primary, sets: movement?.sets },
  { id: "ex-lat", name: "Machine lateral raise", primary: "Side delts", sets: 2 },
  "the catalog's named progress subject is a machine lateral raise"
);
assert.deepEqual(sessions.map(({ loads }) => loads), [[12, 12], [12.5, 12.5]],
  "the catalog records a credible, gradual Machine lateral raise load progression");
assert.ok(sessions.every(({ loads }) => loads.every((load) => load >= 2.5 && load <= 30 && Number.isInteger(load * 2))),
  "machine lateral raise fixture loads remain plausible positive half-kilogram values");

console.log(`credible catalog fixture: ${JSON.stringify({ movement, sessions })}`);
