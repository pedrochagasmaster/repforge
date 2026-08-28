#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(new URL("index.html", BASE).href);
  await waitForAppBoot(page, { base: BASE });
  const report = await page.evaluate(() => {
    const Compiler = window.RepForgeProgramCompiler;
    const library = window.RepForgeExercises.library;
    const results = [];
    for (const familyId of Compiler.FAMILY_IDS) for (const frequency of Compiler.FREQUENCIES) {
      const home = familyId === "home";
      const input = {
        schemaVersion: 1, familyId, frequency, sessionMinutes: 90,
        equipment: home ? [] : ["barbell", "dumbbell", "machine", "cable", "smith"],
        environment: home ? [] : ["safe_pull", "training_support"],
        loadIncrements: home ? {} : { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
      };
      const first = Compiler.compile(input, library);
      const second = Compiler.compile(structuredClone(input), library);
      results.push({ familyId, frequency, kind: first.kind, deterministic: JSON.stringify(first) === JSON.stringify(second), days: first.days?.length });
    }
    const durable = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      compilerLoaded: !!Compiler,
      blueprintCount: Compiler.BLUEPRINTS.length,
      results,
      persistedStructure: durable?.programMeta?.programStructure,
      persistedSlots: durable?.program,
    };
  });
  assert.equal(report.compilerLoaded, true);
  assert.equal(report.blueprintCount, 20);
  assert(report.results.every((entry) => entry.kind === "compiled" && entry.deterministic && entry.days === entry.frequency));
  assert.equal(report.persistedStructure?.schemaVersion, 1, "boot migration persists explicit day records");
  assert(report.persistedStructure.days.every((day) => typeof day.dayId === "string" && day.dayId));
  assert(report.persistedSlots.every((slot) => slot.dayId && slot.slotId), "boot migration persists stable slot/day ids");
  console.log("PASS browser compiler runtime: 20 deterministic programs and durable explicit structure");
} finally {
  await browser.close();
}
