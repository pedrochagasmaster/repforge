#!/usr/bin/env node
/**
 * Calls the shared helpers directly in a real browser document (round-2/app.html
 * with no candidate) to prove the harness fixes that every candidate relies on:
 * H-1 import and paste activation reach Today; H-2 the editor round trip keeps
 * progression ids; H-3 removing two exercises activates 16; H-4 Build activates
 * its own draft and its status reads TF.readiness; H-5 Today shows the localized
 * name and muscles; H-9 Keep then resume restores the step and answers. Also
 * H-6, H-10, H-11 and H-15 spot checks.
 *
 * Usage: node tools/harness-selftest.mjs [--base URL]
 */
import { chromium } from "../../../../test/node_modules/playwright/index.mjs";
const argv = process.argv.slice(2); const i = argv.indexOf("--base");
const BASE = i >= 0 ? argv[i + 1] : "http://127.0.0.1:8123/docs/design/onboarding-tournament/";
const browser = await chromium.launch({ executablePath: process.env.TOURNAMENT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ locale: "pt-BR" });
await page.goto(`${BASE}round-2/app.html?c=&cp=none&lang=pt`);
await page.waitForFunction(() => window.__tournamentReady === true);
const out = await page.evaluate(async () => {
  const lines = []; let fails = 0;
  const ok = (cond, label, detail = "") => { if (!cond) fails++; lines.push(`${cond ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`); };
  const t = TF.makeT("pt", TS.COPY.pt);
  const todayText = () => { const d = document.createElement("div"); d.innerHTML = TF.renderToday(t, "pt"); return d; };
  const decide = (draft) => { for (const r of draft.rows) if (!r.reviewed) draft = TS.importReview.apply(draft, r.shortlist.length ? "pick" : "raw", r.key, 0); return draft; };
  const strategyIds = (p) => p.map((e) => `${e.id}:${e.progression.strategy.id}`).join(",");

  /* H-1 file import */
  TF.seedDevice("fresh");
  const fileDraft = decide(TF.buildImportDraft(TF.F.importFile.pt, "arquivo", "file"));
  const fileResult = TF.importResult(fileDraft, t);
  const undef = JSON.stringify(fileResult, (k, v) => (v === undefined ? "__UNDEFINED__" : v)).includes("__UNDEFINED__");
  ok(!undef, "H-1 importResult has no undefined fields (raw row 'Zerbulator 9000' has no libraryId key)", JSON.stringify(fileResult.preview.program.find((e) => e.name === "Zerbulator 9000")));
  let a = TF.activate(TF.entryState({ route: "import", result: fileResult, step: "preview" }));
  ok(a.ok && todayText().querySelector("[data-today-program]").textContent === "Treino do Rafael", "H-1 file import activates and Today shows it", `activate=${JSON.stringify(a)}; active exercises=${TF.device.active.program.length}`);
  /* H-1 paste door */
  TF.seedDevice("fresh");
  let ff = TS.freeform.create();
  ff = TS.freeform.apply(ff, "input", TF.F.freeform.pasted.pt); ff = TS.freeform.apply(ff, "continue"); ff = TS.freeform.apply(ff, "copy", "chatgpt");
  ff = TS.freeform.apply(ff, "reply", TF.F.freeform.replyGaps.pt); ff = TS.freeform.apply(ff, "review");
  for (const g of ff.gap.gaps) ff = TS.freeform.apply(ff, "gap-input", { key: g.key, value: g.field === "reps" ? "10-12" : "3" });
  ff = TS.freeform.apply(ff, "gap-submit");
  const pasteDraft = decide(TF.buildImportDraft(ff.parsed, "texto colado", "freeform"));
  a = TF.activate(TF.entryState({ route: "import", result: TF.importResult(pasteDraft, t), step: "preview" }));
  ok(a.ok && todayText().querySelector("[data-today-program]").textContent === "Empurrar e puxar", "H-1 paste door (gaps repaired) activates and Today shows it", `activate=${JSON.stringify(a)}; active exercises=${TF.device.active.program.length}`);

  /* H-2 editor round trip */
  TF.seedDevice("fresh");
  const r = TF.compile("recommend", TF.fixtureAnswers("rafael"));
  const result = TF.jsonClean({ fingerprint: r.fingerprint, name: r.name, namePt: r.namePt, selected: r.selected, preview: r.preview, explanation: r.explanation });
  const build = TS.build.fromPreview(result.preview, { name: TF.resultName(result, "pt") });
  const back = TS.build.commit(result, build);
  ok(JSON.stringify(back) === JSON.stringify(result), "H-2 fromPreview → commit with no change is byte-identical to the reviewed result", `strategies before ${[...new Set(result.preview.program.map((e) => e.progression.strategy.id))]} after ${[...new Set(back.preview.program.map((e) => e.progression.strategy.id))]}`);
  ok(strategyIds(back.preview.program) === strategyIds(result.preview.program), "H-2 every exercise keeps its progression id", `${back.preview.program.filter((e) => e.progression.strategy.id === "rep_goal").length} rep_goal, ${back.preview.program.filter((e) => e.progression.strategy.id === "range").length} range`);
  a = TF.activate(TF.entryState({ route: "recommend", answers: TF.fixtureAnswers("rafael"), result: back, step: "result" }));
  ok(a.ok, "H-2 the round-tripped result activates (Round 1 threw here)", JSON.stringify(a));

  /* H-3 remove two, commit, activate */
  TF.seedDevice("fresh");
  let b2 = TS.build.fromPreview(result.preview, { name: "x" });
  const removed = [b2.days[0].exercises[0].id, b2.days[1].exercises[0].id];
  b2 = TS.build.apply(b2, "remove", { dayId: b2.days[0].dayId, id: removed[0] });
  b2 = TS.build.apply(b2, "remove", { dayId: b2.days[1].dayId, id: removed[1] });
  const edited = TS.build.commit(result, b2);
  a = TF.activate(TF.entryState({ route: "recommend", answers: TF.fixtureAnswers("rafael"), result: edited, step: "result" }));
  const act = TF.device.active.program;
  const intact = act.every((e) => JSON.stringify(e) === JSON.stringify(result.preview.program.find((o) => o.id === e.id)));
  ok(a.ok && act.length === 16 && intact && !act.some((e) => removed.includes(e.id)), "H-3 removing two exercises activates exactly 16, each identical to the reviewed row", `${result.preview.program.length} → ${act.length}; removed ${removed.join(", ")}`);
  ok(TS.changeText(t, TF.identityDiff(result.preview, edited.preview)) === "2 dos 16 exercícios mudaram.", "C-5 change statement by identity", TS.changeText(t, TF.identityDiff(result.preview, edited.preview)));

  /* H-4 Build */
  TF.seedDevice("fresh");
  let bb = TS.build.create("Meu programa", 3);
  const st0 = TS.build.status(t, bb);
  bb.picker = "manual_d1"; bb = TS.build.apply(bb, "add", "pd_bw");
  const st1 = TS.build.status(t, bb);
  for (const [d, id] of [["manual_d2", "rw_bb"], ["manual_d3", "sq_lp"]]) { bb.picker = d; bb = TS.build.apply(bb, "add", id); }
  const st2 = TS.build.status(t, bb);
  ok(!st0.ready && st0.text === "Adicione um exercício a Dia 1, Dia 2, Dia 3." && !st1.ready && st1.text === "Adicione um exercício a Dia 2, Dia 3." && st2.ready && st2.text === "Pronto para ativar.", "H-4 status reads TF.readiness", `"${st0.text}" / "${st1.text}" / "${st2.text}"`);
  a = TF.activate(TF.entryState({ route: "build", answers: { programName: bb.name, daysPerWeek: 3 }, result: TS.build.result(bb), step: "editor" }));
  ok(a.ok && TF.activeName("pt") === "Meu programa" && TF.device.active.program.map((e) => e.libraryId).join(",") === "pd_bw,rw_bb,sq_lp", "H-4 Build activates its own draft (not a stale compile)", TF.device.active.program.map((e) => e.libraryId).join(","));

  /* H-5 Today localized */
  TF.seedDevice("fresh");
  a = TF.activate(TF.entryState({ route: "recommend", answers: TF.fixtureAnswers("rafael"), result, step: "result" }));
  const today = todayText();
  const session = today.querySelector(".today__session .t-small").textContent;
  ok(today.querySelector("[data-today-program]").textContent === "Ganhar massa" && !/Build Muscle/.test(today.textContent), "H-5 Today shows the localized program name", today.querySelector("[data-today-program]").textContent);
  ok(!/[a-z]_[a-z]|,/.test(session.split(" · ").slice(0, -1).join(" ")), "H-5 muscle tokens on the session line are localized and split", session);

  /* H-9 keep then resume */
  TF.seedDevice("fresh");
  const kept = TF.entryState({ route: "recommend", answers: { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 4 }, step: "schedule" });
  const saved = TF.saveDraft(kept);
  const info = TF.loadDraft();
  ok(saved.ok && info.status === "resumable" && info.state.step === "schedule" && info.state.answers.daysPerWeek === 4, "H-9 Keep (TF.saveDraft) then resume (TF.loadDraft) restores the step and answers", `${info.status} ${info.route}/${info.step}; ${TS.resumeFacts(t, "pt", info).route} · ${TS.resumeFacts(t, "pt", info).step}`);
  TF.clearDraft(); ok(TF.loadDraft() === null, "H-9 Discard (TF.clearDraft) leaves nothing to resume");
  TF.seedDevice("interrupted"); ok(TF.loadDraft()?.step === "priorities", "H-9 seed 'interrupted' is read through the same API", TF.loadDraft()?.status);
  TF.seedDevice("rules-drift"); ok(TF.loadDraft()?.status === "rules_changed", "H-9 seed 'rules-drift' reports rules_changed");

  /* H-6, H-10, H-11, H-15 spot checks */
  let f2 = TS.freeform.apply(TS.freeform.apply(TS.freeform.create(), "input", "x".repeat(20)), "start-over");
  ok(f2.input.length === 20 && TS.freeform.body(t, "pt", { ...f2, stage: 3 }).includes(t("entry.freeform.confirm_start_over")), "H-6 Recomeçar asks entry.freeform.confirm_start_over before discarding");
  ok(TS.freeform.apply(f2, "start-over-confirm").input === "", "H-6 confirming discards");
  const texts = TS.issueTexts(t, ["preview_not_ready", "day_empty:manual_d1", "exercise_invalid:x", "compile_threw", "totally_unknown_code"], { preview: TS.build.result(TS.build.create("x", 1)).preview });
  ok(texts.every((s) => !/[a-z]_[a-z]/.test(s)), "H-10 issueText maps codes to copy; unknown code → generic sentence", texts.join(" | "));
  ok(!/min/.test(Object.keys(TS.COPY.pt).filter((k) => k.startsWith("x.cost.")).map((k) => TS.COPY.pt[k]).join(" ")) && TS.COPY.pt["x.cost.recommend"] === `${TS.routeSections("recommend")} seções curtas`, "H-11 door facts have no minutes; counts come from ROUTE_STEPS", ["recommend", "custom", "browse"].map((r) => `${r} ${TS.routeSections(r)}`).join(", "));
  document.body.insertAdjacentHTML("beforeend", TS.privacyButton(t)); TS.openPrivacy(document.querySelector("[data-privacy-open]"));
  ok(!!document.querySelector("[data-privacy-stub][role=dialog]") && document.activeElement?.id === "privacyTitle", "H-15 the Privacy stub opens and takes focus");
  TS.closePrivacy(true); ok(!document.querySelector("[data-privacy-stub]") && document.activeElement?.hasAttribute("data-privacy-open"), "H-15 closing returns focus to the opener");
  ok(t("x.privacy.line").includes("dispositivo") && t("x.cost.file").includes("dispositivo") && t("entry.result.why_goal", { goal: "x" }) === "Objetivo: x." && t("entry.build_setup.name_placeholder") === "Meu programa", "H-7 override layer and §5.3 strings are live");
  return { lines, fails };
});
console.log(out.lines.join("\n"));
console.log(out.fails ? `${out.fails} failed` : "all harness self-tests passed");
await browser.close();
process.exit(out.fails ? 1 : 0);
