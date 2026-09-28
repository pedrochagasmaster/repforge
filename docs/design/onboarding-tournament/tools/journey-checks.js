/* Verifier checks for the Round 2 candidate journeys (round-2/JOURNEYS.md).
 * Each check receives the recorded run (snapshots, trace, marks, final state)
 * and returns a list of problems. Expected programs are computed here from
 * the real engine (TF.compile, TF.browseCards, the shared build model, the
 * ported import and free-form code) and the shared fixtures, never taken
 * from the candidate.
 */
(function () {
  "use strict";
  const C = {};
  const T = (lang) => TF.makeT(lang, TS.COPY[lang]);
  const J = (v) => JSON.stringify(v);
  const prog = (x) => (Array.isArray(x) ? x : x?.preview?.program || x?.program || []);
  const key = (e) => [e.day, e.libraryId || TF.fold(e.name), e.sets, e.min, e.max, e.progression?.strategy?.id || ""].join("|");
  function sameProgram(label, got, want, { params = false } = {}) {
    const a = prog(got), b = prog(want); const out = [];
    if (a.length !== b.length) return [`${label}: ${a.length} exercises, expected ${b.length}`];
    for (let i = 0; i < a.length; i++) {
      if (key(a[i]) !== key(b[i])) { out.push(`${label}: exercise ${i + 1} is ${key(a[i])}, expected ${key(b[i])}`); if (out.length > 3) break; continue; }
      if (params && J(a[i].progression) !== J(b[i].progression)) { out.push(`${label}: exercise ${i + 1} (${a[i].libraryId || a[i].name}) progression differs`); if (out.length > 3) break; }
    }
    return out;
  }
  function normAnswers(a) { try { return TF.entryState({ route: "recommend", answers: a || {} }).answers; } catch (e) { return { invalid: String(e.message) }; } }
  const sameAnswers = (a, b) => J(sortKeys(normAnswers(a))) === J(sortKeys(normAnswers(b)));
  function sortKeys(o) { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === "object") return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])); return o; }
  const snap = (run, label, out) => { const s = run.snapshots[label]; if (!s) out.push(`snapshot "${label}" was not taken`); return s || null; };
  function reviewResult(run, label, out) { const s = snap(run, label, out); if (!s) return null; if (!s.entry || !s.entry.result) { out.push(`snapshot "${label}": entry().result is empty`); return null; } return s.entry.result; }
  function landedToday(run, name, out) {
    const f = run.final;
    if (!f.device.active) { out.push("no active program after the journey"); return; }
    if (!f.dom.checkpoints.includes("activated-today")) out.push("Today ([data-checkpoint=activated-today]) is not visible at the end");
    if (name && !f.dom.today.includes(name)) out.push(`Today shows "${f.dom.today}", expected the localized name "${name}"`);
  }
  function activeIsReviewed(run, reviewed, out) { if (reviewed && run.final.device.active) out.push(...sameProgram("active vs reviewed", run.final.device.active.program, reviewed, { params: true })); }
  const noLanding = (dom, out, where) => { if (dom.landing) out.push(`${where}: the first-run landing is shown`); };
  function statementMatches(dom, before, after, out, where) {
    const d = TF.identityDiff(before, after);
    const s = dom.change[0];
    if (!s) { out.push(`${where}: no [data-change-statement] visible (expected n=${d.n}, total=${d.total})`); return; }
    if (s.n !== d.n || s.total !== d.total) out.push(`${where}: change statement says ${s.n} of ${s.total}, identity diff is ${d.n} of ${d.total}`);
    if (!(s.n <= s.total)) out.push(`${where}: change statement n > total`);
    if (d.n > 0 && !(s.text.includes(String(d.n)) && s.text.includes(String(d.total)))) out.push(`${where}: change statement text "${s.text}" does not state ${d.n} and ${d.total}`);
  }
  const codeLike = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[a-z][a-z0-9_]*:[a-z0-9]/;

  /* ---- expected programs (real engine) ---- */
  const E = {
    rafael: () => TF.fixtureAnswers("rafael"),
    compile(mode, answers) { const r = TF.compile(mode, answers); if (!r.ok) throw new Error(`expected compile failed: ${r.code}`); return r; },
    recommend() { return E.compile("recommend", E.rafael()); },
    custom() { const a = TF.fixtureAnswers("custom"); const s = TF.splitChoices(a); a.splitPreference = (s.choices.find((c) => c.default) || s.choices[0]).id; return E.compile("custom", a); },
    browse() { return TF.browseCards(TF.fixtureAnswers("browse")).find((c) => c.id === "balanced_4_v1"); },
    buildPlan: [["manual_d1", ["sq_bb", "pr_bb"]], ["manual_d2", ["pd_bw", "rw_bb"]], ["manual_d3", ["sq_lp"]]],
    build(lang, plan = E.buildPlan) { let b = TS.build.create(T(lang)("entry.build_setup.name_placeholder"), 3); for (const [d, ids] of plan) for (const id of ids) { b.picker = d; b = TS.build.apply(b, "add", id); } return TS.build.result(b); },
    decide(draft) { for (const r of draft.rows) if (!r.reviewed) draft = TS.importReview.apply(draft, r.shortlist.length ? "pick" : "raw", r.key, 0); return draft; },
    importFile(lang) { return TF.importResult(E.decide(TF.buildImportDraft(TF.F.importFile[lang], "", "file")), T(lang)); },
    gapValues: { reps: "10-12", sets: "3" },
    importPaste(lang) {
      const g = TF.parseFreeformReply(TF.F.freeform.replyGaps[lang]); const answers = {};
      for (const gap of g.gaps) answers[gap.key] = E.gapValues[gap.field];
      const a = TF.assembleGaps(g, answers);
      return TF.importResult(E.decide(TF.buildImportDraft({ meta: a.source.meta, exercises: a.source.exercises, notImported: a.source.notImported }, "", "freeform")), T(lang));
    },
    shared(lang) { return TF.sharedResult(TF.F.sharedFragments[lang + "Payload"]); },
    correctionEnv() { const c = TF.F.users.rafael.correction; const e = TF.env(c.environmentKind); e.equipment = [...new Set([...e.equipment, ...c.equipmentAdd])]; e.capabilities = [...new Set([...e.capabilities, ...c.capabilitiesAdd])]; return e; },
  };
  const sameEnv = (a, b) => a && b && a.kind === b.kind && J([...(a.equipment || [])].sort()) === J([...(b.equipment || [])].sort()) && J([...(a.capabilities || [])].sort()) === J([...(b.capabilities || [])].sort());

  /* ---- K-1: every route activates what was reviewed ---- */
  function activation(run, ctx, expected, { answers = null, name } = {}) {
    const out = [];
    const reviewed = reviewResult(run, "review", out);
    if (reviewed) {
      out.push(...sameProgram("reviewed vs engine", reviewed, expected));
      if (answers) { const got = run.snapshots.review.entry.answers || {}; for (const k of Object.keys(answers)) { if (k === "environment") { if (!sameEnv(got.environment, answers.environment)) out.push(`reviewed answers: environment ${J(got.environment)} differs from the fixture`); } else if (J(got[k] ?? null) !== J(answers[k] ?? null) && !(Array.isArray(answers[k]) && !answers[k].length && !(got[k] || []).length)) out.push(`reviewed answers: ${k}=${J(got[k])}, fixture ${J(answers[k])}`); } }
    }
    activeIsReviewed(run, reviewed, out);
    landedToday(run, name, out);
    return out;
  }
  C["activate.recommend"] = (run, ctx) => { const e = E.recommend(); return activation(run, ctx, e, { answers: E.rafael(), name: TF.resultName(e, ctx.lang) }); };
  C["activate.custom"] = (run, ctx) => { const e = E.custom(); const a = TF.fixtureAnswers("custom"); delete a.splitPreference; return activation(run, ctx, e, { answers: a, name: TF.resultName(e, ctx.lang) }); };
  C["activate.browse"] = (run, ctx) => { const c = E.browse(); return activation(run, ctx, c, { name: TF.resultName(c, ctx.lang) }); };
  C["activate.build"] = (run, ctx) => { const r = E.build(ctx.lang); return activation(run, ctx, r, { name: r.name }); };
  C["activate.import-file"] = (run, ctx) => { const r = E.importFile(ctx.lang); return activation(run, ctx, r, { name: r.name }); };
  C["activate.import-paste"] = (run, ctx) => { const r = E.importPaste(ctx.lang); return activation(run, ctx, r, { name: r.name }); };
  C["activate.shared"] = (run, ctx) => { const r = E.shared(ctx.lang); return activation(run, ctx, r, { name: r.name }); };

  /* ---- K-2 / K-3: the editor round trip ---- */
  C["edit.roundtrip"] = (run, ctx) => {
    const out = []; const b = reviewResult(run, "before", out), a = reviewResult(run, "after", out); if (!a || !b) return out;
    out.push(...sameProgram("after edit round trip vs before", a, b, { params: true }));
    const ids = (r) => prog(r).map((e) => e.id).join(","); if (ids(a) !== ids(b)) out.push("exercise ids changed in the round trip");
    for (const k of ["explanation"]) if (J(a[k]) !== J(b[k])) out.push(`result.${k} changed in the round trip`);
    for (const k of ["limitations", "reductions"]) if (J(a.preview?.[k]) !== J(b.preview?.[k])) out.push(`preview.${k} changed in the round trip`);
    if (!run.snapshots.after.dom.text.includes(TF.resultName(b, ctx.lang))) out.push("the review no longer shows the program name");
    activeIsReviewed(run, a, out); landedToday(run, TF.resultName(b, ctx.lang), out);
    return out;
  };
  function removeTwo(run, ctx, viaReview) {
    const out = []; const b = reviewResult(run, "before", out); if (!b) return out;
    const act = run.final.device.active; if (!act) { out.push("no active program after the journey"); return out; }
    const before = new Map(prog(b).map((e) => [e.id, e]));
    if (act.program.length !== prog(b).length - 2) out.push(`active program has ${act.program.length} exercises, expected ${prog(b).length - 2}`);
    for (const e of act.program) { const o = before.get(e.id); if (!o) { out.push(`active exercise ${e.id} was not in the reviewed program`); continue; } if (J(o.progression) !== J(e.progression) || o.sets !== e.sets || o.min !== e.min || o.max !== e.max || o.libraryId !== e.libraryId) out.push(`active exercise ${e.id} differs from the reviewed one`); }
    if (viaReview) { const a = reviewResult(run, "after", out); if (a) { if (prog(a).length !== prog(b).length - 2) out.push(`review after editing shows ${prog(a).length} exercises`); activeIsReviewed(run, a, out); } }
    landedToday(run, null, out);
    return out;
  }
  C["edit.remove-two.editor"] = (run, ctx) => removeTwo(run, ctx, false);
  C["edit.remove-two.review"] = (run, ctx) => removeTwo(run, ctx, true);

  /* ---- K-4: Build gating ---- */
  C["build.gating"] = (run, ctx) => {
    const out = []; const t = T(ctx.lang); const day = (n) => t("program.default.day", { n });
    const gate = (label, must, mustNot) => { const s = snap(run, label, out); if (!s) return; const a = s.dom.activate[0]; if (!a) { out.push(`${label}: no visible [data-activate]`); return; } if (!a.disabled) out.push(`${label}: activation is enabled`); if (!a.reason) out.push(`${label}: disabled activation has no aria-describedby reason`); for (const d of must) if (!a.reason.includes(d)) out.push(`${label}: reason "${a.reason}" does not name ${d}`); for (const d of mustNot) if (a.reason.includes(d)) out.push(`${label}: reason still names ${d}`); if (codeLike.test(a.reason)) out.push(`${label}: reason contains a raw code`); };
    gate("empty", [day(1), day(2), day(3)], []);
    gate("partial", [day(2), day(3)], [day(1)]);
    const r = snap(run, "ready", out); if (r) { const a = r.dom.activate[0]; if (!a || a.disabled) out.push("ready: activation is not enabled"); }
    const exp = E.build(ctx.lang, [["manual_d1", ["pd_bw"]], ["manual_d2", ["rw_bb"]], ["manual_d3", ["sq_lp"]]]);
    if (run.final.device.active) out.push(...sameProgram("active vs built", run.final.device.active.program, exp));
    landedToday(run, exp.name, out);
    return out;
  };

  /* ---- K-5: Cancel is a question; Keep keeps ---- */
  C["cancel"] = (run, ctx) => {
    const out = []; const f = run.final; const s0 = run.snapshots.__start;
    if (run.params.checkpoint === "shared-preview") {
      if (!f.dom.checkpoints.includes("shared-gate")) out.push("Cancel on the shared review did not return to the gate");
      if (f.device.active || f.device.draft) out.push("something was persisted from the link");
      return out;
    }
    if (!f.dom.dialogs.some((d) => d.checkpoint === "cancel-confirm")) out.push(`Cancel on ${run.params.checkpoint} did not open cancel-confirm`);
    const sig = (e) => J(e ? { route: e.route, step: e.step, answers: sortKeys(normAnswers(e.answers)) } : null);
    if (sig(f.entry) !== sig(s0.entry)) out.push("opening the cancel dialog changed the entry state");
    if (J(f.device.draft) !== J(s0.device.draft)) out.push("opening the cancel dialog changed the kept draft");
    return out;
  };
  C["cancel.keep-resume"] = (run, ctx) => {
    const out = []; const b = snap(run, "before", out), k = snap(run, "kept", out), r = snap(run, "resumed", out); if (!b || !k || !r) return out;
    if (b.entry?.step !== "schedule" || b.entry?.answers?.daysPerWeek !== 4) out.push(`before: expected step schedule with 4 days, got ${b.entry?.step} / ${b.entry?.answers?.daysPerWeek}`);
    const d = k.device.draft; if (!d) out.push("kept: device.draft is empty after Keep"); else { if (d.state.step !== "schedule") out.push(`kept: draft step ${d.state.step}`); if (!sameAnswers(d.state.answers, b.entry.answers)) out.push("kept: draft answers differ from the answers at Cancel"); }
    if (r.entry?.route !== "recommend" || r.entry?.step !== "schedule") out.push(`resumed: ${r.entry?.route} / ${r.entry?.step}, expected recommend / schedule`);
    if (!sameAnswers(r.entry?.answers, b.entry?.answers)) out.push("resumed: answers differ from the answers at Cancel");
    if (!r.dom.steps.includes("schedule")) out.push("resumed: [data-entry-step=schedule] is not visible");
    return out;
  };

  /* ---- K-6: Back from every review ---- */
  function backFromReview(run, ctx, { step } = {}) {
    const out = []; const s0 = run.snapshots.__start; const a = snap(run, "after", out); if (!a) return out;
    if (a.dom.dialogs.length) out.push("Back opened a dialog");
    noLanding(a.dom, out, "after Back");
    if (step) { if (!a.dom.steps.includes(step)) out.push(`after Back: ${J(a.dom.steps)} visible, expected ${step}`); }
    else if (!a.dom.steps.some((s) => s !== "result" && s !== "preview")) out.push(`after Back: still on ${J(a.dom.steps)}`);
    if (a.entry?.route !== s0.entry?.route) out.push(`after Back: route ${a.entry?.route}, was ${s0.entry?.route}`);
    if (!sameAnswers(a.entry?.answers, s0.entry?.answers)) out.push("after Back: answers changed");
    return out;
  }
  C["back.recommend"] = (run, ctx) => backFromReview(run, ctx);
  C["back.custom"] = (run, ctx) => backFromReview(run, ctx);
  C["back.browse"] = (run, ctx) => backFromReview(run, ctx, { step: "catalogue" });
  C["back.import"] = (run, ctx) => {
    const out = []; const d = snap(run, "decided", out), p = snap(run, "preview", out), b = snap(run, "back", out); if (!d || !p || !b) return out;
    if (!p.dom.steps.includes("preview")) out.push("preview: [data-entry-step=preview] not visible");
    if (!b.dom.checkpoints.includes("import-review")) out.push("after Back: import review not visible");
    const rows = (s) => J(s.dom.improws.map((r) => [r.name, r.badge]).sort());
    if (rows(b) !== rows(d)) out.push("after Back: row decisions differ from before the commit");
    if (b.dom.improws.some((r) => r.open)) out.push("after Back: a row is open for review again");
    return out;
  };
  C["back.shared"] = (run) => { const out = []; const f = run.final; if (!f.dom.checkpoints.includes("shared-gate")) out.push("Back from the shared review did not return to the gate"); if (f.device.active || f.device.draft) out.push("something was persisted from the link"); return out; };

  /* ---- K-7: whole-draft destruction confirms ---- */
  const resultSig = (e) => J(e ? { route: e.route, step: e.step, answers: sortKeys(normAnswers(e.answers)), n: prog(e.result).length, fp: e.result?.fingerprint || null } : null);
  C["destroy.review-start-over"] = (run) => {
    const out = []; if (run.notOffered.some((n) => n.what === "start-over")) return out;
    const s0 = run.snapshots.__start; const a = snap(run, "asked", out), c = snap(run, "after-cancel", out); if (!a || !c) return out;
    if (!a.dom.dialogs.length) out.push("Start over did not open a confirmation");
    if (resultSig(a.entry) !== resultSig(s0.entry)) out.push("state changed before the confirmation");
    if (resultSig(c.entry) !== resultSig(s0.entry)) out.push("state changed after cancelling the confirmation");
    if (c.dom.dialogs.length) out.push("the confirmation is still open after cancelling");
    return out;
  };
  C["destroy.paste-restart"] = (run, ctx) => {
    const out = []; const t = T(ctx.lang); const a = snap(run, "asked", out), c = snap(run, "after-cancel", out); if (!a || !c) return out;
    if (!a.dom.dialogs.some((d) => d.text.includes(t("entry.freeform.confirm_start_over")))) out.push("Recomeçar did not ask entry.freeform.confirm_start_over");
    if (c.dom.dialogs.length) out.push("the confirmation is still open after keeping");
    if (!c.dom.text.includes(t("entry.freeform.stage3_title"))) out.push("after keeping, the reply stage is gone");
    return out;
  };
  C["destroy.discard-draft"] = (run) => {
    const out = []; const s0 = run.snapshots.__start; const a = snap(run, "asked", out), d = snap(run, "discarded", out); if (!a || !d) return out;
    if (!a.dom.dialogs.some((x) => x.checkpoint === "cancel-confirm")) out.push("Cancel did not ask before discarding");
    if (resultSig(a.entry) !== resultSig(s0.entry)) out.push("state changed before the confirmation");
    if (d.device.draft) out.push("a draft is still kept after Discard");
    if (d.dom.dialogs.length) out.push("the dialog is still open after Discard");
    return out;
  };

  /* ---- K-8: configured users never see the first-run landing ---- */
  const unchangedActive = (run, out) => { if (J(run.final.device.active) !== J(run.snapshots.__start.device.active)) out.push("the active program changed"); };
  function existingExit(run, { today = true } = {}) {
    const out = []; noLanding(run.final.dom, out, "final");
    for (const tr of run.trace) if (tr.checkpoints.includes("landing")) { out.push(`the landing rendered after "${tr.label}"`); break; }
    if (today && !run.final.dom.checkpoints.includes("activated-today")) out.push("the exit did not land on Today");
    unchangedActive(run, out); return out;
  }
  C["existing.back"] = (run) => existingExit(run);
  C["existing.cancel-keep"] = (run) => existingExit(run);
  C["existing.cancel-discard"] = (run) => existingExit(run);
  C["existing.replace-cancel"] = (run) => { const out = existingExit(run, { today: false }); if (run.final.dom.dialogs.some((d) => d.checkpoint === "replace-confirm")) out.push("the replacement dialog is still open"); if (!run.final.dom.steps.some((s) => s === "result" || s === "preview")) out.push("the review is not visible after keeping the current program"); return out; };
  C["existing.conflict"] = (run) => { const out = existingExit(run, { today: false }); const r = snap(run, "reviewed", out); if (r && !r.dom.steps.some((s) => s === "result" || s === "preview")) out.push("Review again did not return to the review"); if (!run.final.dom.dialogs.some((d) => d.checkpoint === "replace-confirm")) out.push("activating after Review again did not run the replacement dialog"); return out; };

  /* ---- K-9: pain avoidance ---- */
  C["avoid.pain"] = (run, ctx) => {
    const out = []; const t = T(ctx.lang);
    const p = snap(run, "pending", out), r = snap(run, "reasoned", out), v = snap(run, "review", out); if (!p || !r || !v) return out;
    const adv = (s) => s.dom.advance[0];
    if (!adv(p)) out.push("pending: no visible [data-advance]"); else if (!adv(p).disabled) out.push("pending: Continue/Apply is enabled before a reason is chosen");
    if (!adv(r)) out.push("reasoned: no visible [data-advance]"); else if (adv(r).disabled) out.push("reasoned: Continue/Apply is still disabled");
    if (!r.dom.text.includes(t("entry.priorities.pain_note"))) out.push("reasoned: the production pain note is not visible");
    const a = v.entry?.answers || {}; if (!(a.exerciseConstraints || []).some((c) => c.exerciseId === "pr_bb" && c.reason === "pain")) out.push("review: answers do not avoid pr_bb for pain");
    const name = TF.libraryName(TF.libraryEntry("pr_bb"), ctx.lang); if (!v.dom.text.includes(name)) out.push(`review: "${name}" not listed`);
    if (!v.dom.text.toLowerCase().includes(t("entry.priorities.reason.pain").toLowerCase())) out.push("review: the reason is not stated");
    const without = { ...a, exerciseConstraints: (a.exerciseConstraints || []).filter((c) => c.exerciseId !== "pr_bb") };
    try { statementMatches(v.dom, E.compile("recommend", without).preview, E.compile("recommend", a).preview, out, "review"); } catch (e) { out.push(String(e.message)); }
    return out;
  };
  /* ---- K-14 ---- */
  C["overlays"] = (run) => { const out = []; if (!run.overlays.length) out.push("no overlay was checked"); for (const o of run.overlays) if (!o.ok) out.push(`overlay "${o.label}": confirm not fully visible above the pinned region (${o.detail})`); return out; };
  /* ---- K-17 / K-24 ---- */
  C["change.days"] = (run, ctx) => {
    const out = []; const c = snap(run, "changed", out); if (!c) return out;
    const a4 = { ...E.rafael(), daysPerWeek: 4 };
    if (c.entry?.answers?.daysPerWeek !== 4) out.push("changed: daysPerWeek is not 4");
    const e4 = E.compile("recommend", a4); if (c.entry?.result) out.push(...sameProgram("changed vs engine", c.entry.result, e4));
    statementMatches(c.dom, E.recommend().preview, e4.preview, out, "changed");
    return out;
  };
  const segment = (run, out) => { const s = run.marks.start, e = run.marks.end; if (!s || !e) { out.push("marks start/end missing"); return null; } return { taps: e.taps - s.taps, trace: run.trace.slice(s.trace, e.trace) }; };
  C["correct.environment"] = (run, ctx) => {
    const out = []; const seg = segment(run, out); const c = snap(run, "corrected", out); if (!seg || !c) return out;
    const target = E.correctionEnv(); const base = TF.env(target.kind);
    const changes = 1 + target.equipment.filter((x) => !base.equipment.includes(x)).length + target.capabilities.filter((x) => !base.capabilities.includes(x)).length;
    const bound = 1 + changes + 1;
    if (seg.taps > bound) out.push(`correction took ${seg.taps} taps; bound is ${bound} (open 1 + answer changes ${changes} + apply 1)`);
    for (const tr of seg.trace) { const other = tr.steps.filter((s) => s !== "result" && s !== "preview"); if (other.length) { out.push(`section ${other.join(",")} was shown during the correction (after "${tr.label}")`); break; } }
    if (!sameEnv(c.entry?.answers?.environment, target)) out.push(`corrected: environment ${J(c.entry?.answers?.environment)} is not the fixture correction`);
    const want = { ...E.rafael(), environment: target }; const ec = E.compile("recommend", want);
    if (c.entry?.result) out.push(...sameProgram("corrected vs engine", c.entry.result, ec));
    statementMatches(c.dom, E.recommend().preview, ec.preview, out, "corrected");
    run.segmentTaps = seg.taps; run.bound = bound;
    return out;
  };
  C["avoid.from-review"] = (run, ctx) => {
    const out = []; const seg = segment(run, out); const v = snap(run, "review", out); if (!seg || !v) return out;
    const a = v.entry?.answers || {}; if (!(a.exerciseConstraints || []).some((c) => c.exerciseId === "pr_bb" && c.reason === "pain")) out.push("review: answers do not avoid pr_bb for pain");
    try { statementMatches(v.dom, E.recommend().preview, E.compile("recommend", a).preview, out, "review"); } catch (e) { out.push(String(e.message)); }
    run.segmentTaps = seg.taps;
    return out;
  };
  /* ---- K-18 ---- */
  C["recommend.required"] = (run, ctx) => {
    const out = []; const pd = new Set((ctx.policy && ctx.policy.productDecisions) || []);
    const keys = ["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "preferredRestSeconds", "environment"].filter((k) => !(k === "sessionMinutes" && pd.has("PD-2")) && !(k === "preferredRestSeconds" && pd.has("PD-3")));
    for (const k of keys) {
      const s = run.snapshots[`missing:${k}`]; if (!s) { out.push(`probe missing:${k} was not taken`); continue; }
      const a = s.entry?.answers || {}; if (Object.prototype.hasOwnProperty.call(a, k) && !(k !== "preferredRestSeconds" && a[k] == null)) out.push(`missing:${k}: the answer is already set (${J(a[k])})`);
      if (!s.probe?.blocked) out.push(`missing:${k}: not blocked (${s.probe?.how})`);
      if (s.dom.activate.some((x) => !x.disabled)) out.push(`missing:${k}: an enabled activation control is visible`);
      if (s.entry?.result) out.push(`missing:${k}: a result exists`);
    }
    const r = snap(run, "review", out); if (r && !r.entry?.result) out.push("review: no result after all answers");
    return out;
  };
  /* ---- K-19 ---- */
  const JOBS = ["recommend", "custom", "browse", "build", "import"];
  C["chooser.doors"] = (run) => { const out = []; for (const j of JOBS) { const s = run.snapshots[`door:${j}`]; if (!s) out.push(`door:${j} not taken`); else if (s.entry?.route !== j) out.push(`door:${j} started route ${s.entry?.route}`); } return out; };
  for (const j of JOBS) C[`help.${j}`] = (run) => { const out = []; const s = run.snapshots.end; if (!s) out.push("snapshot end not taken"); else if (s.entry?.route !== j) out.push(`the helper ended at route ${s.entry?.route}, expected ${j}`); return out; };

  window.__journeyChecks = C;
  window.__journeyExpected = E;
})();
