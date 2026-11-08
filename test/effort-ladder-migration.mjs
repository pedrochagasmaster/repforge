#!/usr/bin/env node
/** Plan 078 PR 1: upgrade real saved settings and DraftV2 without rewriting held input. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const browser = await launchChromium();
try {
  for (const mode of ["legacy-reps", "numeric", "finishing"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    try {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(page);
      await page.evaluate(async ({ key, program, meta, mode }) => {
        const snapshot = JSON.parse(localStorage.getItem(key));
        snapshot.settings = { ...snapshot.settings, lang: "en", rirMode: mode === "numeric" ? "numeric" : "effort", effortScale: "reps" };
        snapshot.program = program;
        snapshot.programMeta = meta;
        snapshot.log = [];
        localStorage.setItem(key, JSON.stringify(snapshot));
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("repforge", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(snapshot, key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      }, { key: KEY, program: seedProgram(), meta: seedProgramMeta(), mode });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page);
      await page.evaluate(async mode => {
        window.closeFirstRun?.();
        const api = window.__repforgeWorkoutDraft;
        await window.__repforgeEnterWorkout({ day: state.program[0].day });
        const draft = api.current(), exerciseInstanceId = draft.exerciseOrder[0];
        const setId = draft.exercises[exerciseInstanceId].setOrder[0];
        // Reconstruct an old writer's vocabulary through the shipped reducer, not a fake normalizer.
        if (mode !== "numeric") await api.dispatch("setRirMode", { value: "effort" });
        await api.dispatch("editSetField", { exerciseInstanceId, setId,
          field: mode === "numeric" ? "rir" : "effort", value: mode === "numeric" ? "3" : "r2" });
        if (mode === "finishing") await api.dispatch("beginFinish", {});
        await api.flush();
        await window.__repforgeStorage?.flush?.();
      }, mode);
      // Restore the pre-upgrade setting in both replicas after the draft was authored.
      await page.evaluate(async ({ key, mode }) => {
        const snapshot = JSON.parse(localStorage.getItem(key));
        snapshot.settings.rirMode = mode === "numeric" ? "numeric" : "effort";
        snapshot.settings.effortScale = "reps";
        localStorage.setItem(key, JSON.stringify(snapshot));
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("repforge", 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(snapshot, key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      }, { key: KEY, mode });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page);
      const result = await page.evaluate(key => {
        const draft = window.__repforgeWorkoutDraft.current();
        const exercise = draft.exercises[draft.exerciseOrder[0]];
        return { settings: JSON.parse(localStorage.getItem(key)).settings, mode: draft.program.rirMode,
          edited: exercise.sets[exercise.setOrder[0]].edited };
      }, KEY);
      assert.equal(result.settings.rirMode, "numeric", `${mode}: stored settings migrate`);
      assert.equal(Object.hasOwn(result.settings, "effortScale"), false, `${mode}: retired setting is absent`);
      assert.equal(result.mode, mode === "finishing" ? "effort" : "numeric", `${mode}: draft changes only when its reducer permits it`);
      assert.equal(result.edited[mode === "numeric" ? "rir" : "effort"], mode === "numeric" ? "3" : "r2", `${mode}: held input survives unchanged`);
      console.log(`PASS ${mode}: settings migration preserves held input`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
