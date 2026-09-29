#!/usr/bin/env node
/**
 * Acceptance run for the onboarding tournament harness.
 *
 * Round 1 (unchanged contract, frozen): five cells per checkpoint; records
 * runtime errors, missing checkpoint markers, horizontal overflow (hard),
 * targets under 44 px and clipped text (warnings). H-14: the clipping
 * heuristic ignores .visually-hidden and its descendants.
 *
 * Round 2 (synthesis spec §12): loads round-2/app.html?c=<id>&…
 *   1. Checkpoint audit: all 45 checkpoints in the eight §12.1 cells, with
 *      the generic checks from tools/audit-page.js (runtime errors, marker,
 *      overflow, K-10, K-11, K-12 incl. control-label overflow, K-13, K-15,
 *      K-16, K-21, K-23 hard; 44 px, clipping, K-22 warnings). K-23's
 *      Privacy click is performed here with a real tap.
 *   2. Journeys: the candidate's `journeys` export (round-2/JOURNEYS.md) in
 *      PT light 390 100% and PT light 320 200%, driven through the in-page
 *      api (tools/journey-api.js) and judged by tools/journey-checks.js.
 * Every hard check is a failure. Output: <out>/{results.json, summary.md,
 * shots/} where <out> defaults to round-N/acceptance.
 *
 * Usage:
 *   node tools/verify.mjs --round 1 [--base URL] [--candidates a,b,c] [--quick]
 *   node tools/verify.mjs --round 2 [--base URL] [--candidates d,e,f]
 *        [--cells 1,6] [--checkpoints landing,rec-result] [--journeys all|none|id,id]
 *        [--no-audit] [--no-shots] [--out DIR]
 */
import { chromium } from "../../../../test/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; args[k] = v; }
const BASE = args.base || "http://127.0.0.1:8123/docs/design/onboarding-tournament/";
const ROUND = String(args.round || "1");
const DOC = ROUND === "1" ? "app.html" : `round-${ROUND}/app.html`;
const CANDS = String(args.candidates || ({ 1: "a,b,c", 2: "d,e,f", 3: "g" }[ROUND] || "")).split(",").filter(Boolean);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = args.out ? resolve(args.out) : join(here, "..", `round-${ROUND}`, "acceptance");
const SHOTS = !args["no-shots"];
mkdirSync(join(outDir, "shots"), { recursive: true });
const exe = process.env.TOURNAMENT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const heightFor = (vw) => (vw === 320 ? 568 : vw === 430 ? 932 : 844);
const cellName = (c) => `${c.lang}/${c.theme}/${c.vw}/${c.text}${c.motion === "reduced" ? "/reduced" : ""}`;
const newContext = (cell) => browser.newContext({ viewport: { width: cell.vw, height: heightFor(cell.vw) }, deviceScaleFactor: 2, reducedMotion: cell.motion === "reduced" ? "reduce" : "no-preference", locale: cell.lang === "pt" ? "pt-BR" : "en-US" });
const docUrl = (cand, cp, cell, extra = "") => `${BASE}${DOC}?c=${cand}&cp=${cp}&lang=${cell.lang}&theme=${cell.theme}&text=${cell.text}&motion=${cell.motion || "normal"}${extra}`;
async function load(page, url) { await page.goto(url, { waitUntil: "load" }); await page.waitForFunction(() => window.__tournamentReady === true, undefined, { timeout: 30000 }); await page.waitForTimeout(150); }


/* ------------------------------------------------------------------ */
async function roundOne() {
  const QUICK = !!args.quick, ONLY200 = !!args.only200;
  const CELLS = ONLY200 ? [{ lang: "pt", theme: "light", vw: 390, text: "200" }] : QUICK ? [{ lang: "pt", theme: "light", vw: 390, text: "100" }] : [
    { lang: "pt", theme: "light", vw: 390, text: "100" },
    { lang: "en", theme: "dark", vw: 390, text: "100" },
    { lang: "pt", theme: "light", vw: 320, text: "100" },
    { lang: "pt", theme: "light", vw: 390, text: "200" },
    { lang: "en", theme: "light", vw: 430, text: "100", motion: "reduced" },
  ];
  const results = []; let checkpoints = null;
  for (const cand of CANDS) for (const cell of CELLS) {
    const context = await newContext(cell); const page = await context.newPage(); const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); }); page.on("pageerror", (e) => consoleErrors.push(String(e)));
    if (!checkpoints) { await load(page, `${BASE}${DOC}?c=${cand}&cp=landing&lang=en`); checkpoints = await page.evaluate(() => TF.CHECKPOINTS.map((c) => c.id)); }
    for (const cp of checkpoints) {
      consoleErrors.length = 0; const url = docUrl(cand, cp, cell); const r = { candidate: cand, checkpoint: cp, ...cell, url, ok: true, problems: [] };
      try {
        await load(page, url);
        const audit = await page.evaluate((cpId) => {
          const errs = [...(window.__tournamentErrors || [])];
          const marker = !!document.querySelector(`[data-checkpoint="${cpId}"]`);
          const overflow = [...document.querySelectorAll("body *")].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !el.closest("[style*=\"overflow\"], .b-rail, .c-tabs"); });
          const small = [];
          for (const el of document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button]")) { const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue; const rct = el.getBoundingClientRect(); if (rct.width === 0 || rct.height === 0) continue; if (rct.height < 43.5 || rct.width < 43.5) small.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}] ${Math.round(rct.width)}×${Math.round(rct.height)}`); }
          const clipped = [];
          for (const el of document.querySelectorAll("h1,h2,h3,p,span,button,label,li,strong,b")) {
            if (el.closest(".visually-hidden")) continue; /* H-14 */
            if (el.children.length && el.textContent.trim().length > 60) continue;
            if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== "visible" && getComputedStyle(el).textOverflow !== "ellipsis") clipped.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
          }
          return { errs, marker, overflow, small: small.slice(0, 12), clipped: clipped.slice(0, 6), title: document.querySelector("h1")?.textContent?.trim() };
        }, cp);
        if (audit.errs.length) r.problems.push(...audit.errs.map((e) => "error: " + e.slice(0, 200)));
        if (consoleErrors.length) r.problems.push(...consoleErrors.map((e) => "console: " + e.slice(0, 160)));
        if (!audit.marker) r.problems.push("checkpoint marker missing");
        if (audit.overflow) r.problems.push("horizontal overflow");
        if (audit.small.length) r.problems.push("targets under 44px: " + audit.small.join("; "));
        if (audit.clipped.length) r.problems.push("clipped text: " + audit.clipped.join("; "));
        r.title = audit.title;
        const shot = join("shots", `${cand}__${cp}__${cell.lang}-${cell.theme}-${cell.vw}-${cell.text}${cell.motion === "reduced" ? "-reduced" : ""}.png`);
        await page.screenshot({ path: join(outDir, shot), fullPage: !QUICK }); r.shot = shot;
      } catch (e) { r.problems.push("load/run failed: " + String(e.message || e).slice(0, 200)); }
      r.ok = r.problems.filter((p) => !p.startsWith("targets under") && !p.startsWith("clipped")).length === 0;
      results.push(r);
      process.stdout.write(`${r.ok ? "✓" : "✗"} ${cand} ${cp} ${cellName(cell)}${r.problems.length ? "  " + r.problems.join(" | ").slice(0, 200) : ""}\n`);
    }
    await context.close();
  }
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ base: BASE, round: ROUND, generatedAt: new Date().toISOString(), cells: CELLS, results }, null, 1));
  const byCand = {};
  for (const r of results) { const b = byCand[r.candidate] = byCand[r.candidate] || { total: 0, ok: 0, warn: 0, fail: [] }; b.total++; if (r.ok) b.ok++; if (r.problems.some((p) => p.startsWith("targets") || p.startsWith("clipped"))) b.warn++; if (!r.ok) b.fail.push(`${r.checkpoint} ${r.lang}/${r.theme}/${r.vw}/${r.text}: ${r.problems.join(" | ")}`); }
  const md = [`# Acceptance — round ${ROUND}`, "", `Generated ${new Date().toISOString()} against \`${BASE}${DOC}\`.`, "", "| Candidate | Cells | Hard pass | Cells with 44px/clipping warnings |", "|---|---|---|---|", ...Object.entries(byCand).map(([c, b]) => `| ${c} | ${b.total} | ${b.ok} | ${b.warn} |`), ""];
  for (const [c, b] of Object.entries(byCand)) { md.push(`## ${c}`, ""); if (!b.fail.length) md.push("No hard failures.", ""); else md.push(...b.fail.map((f) => "- " + f), ""); const warns = results.filter((r) => r.candidate === c && r.problems.some((p) => p.startsWith("targets") || p.startsWith("clipped"))); if (warns.length) md.push("Warnings:", "", ...warns.map((r) => `- ${r.checkpoint} ${r.lang}/${r.theme}/${r.vw}/${r.text}: ${r.problems.filter((p) => p.startsWith("targets") || p.startsWith("clipped")).join(" | ")}`), ""); }
  writeFileSync(join(outDir, "summary.md"), md.join("\n"));
  console.log(`\nwrote ${join(outDir, "summary.md")}`);
}

/* ------------------------------------------------------------------ */
/* §12.1: Round 1's five cells plus the three hardest. */
const R2_CELLS = [
  { n: 1, lang: "pt", theme: "light", vw: 390, text: "100" },
  { n: 2, lang: "en", theme: "dark", vw: 390, text: "100" },
  { n: 3, lang: "pt", theme: "light", vw: 320, text: "100" },
  { n: 4, lang: "pt", theme: "light", vw: 390, text: "200" },
  { n: 5, lang: "en", theme: "light", vw: 430, text: "100", motion: "reduced" },
  { n: 6, lang: "pt", theme: "light", vw: 320, text: "200" },
  { n: 7, lang: "pt", theme: "light", vw: 430, text: "100" },
  { n: 8, lang: "en", theme: "dark", vw: 320, text: "200", motion: "reduced" },
];
/* §12.2: journeys run in PT light 390 100% and PT light 320 200%. */
const JOURNEY_CELLS = [R2_CELLS[0], R2_CELLS[5]];
/* The journey registry. Kept in lockstep with round-2/JOURNEYS.md. */
const CANCEL_VIEWS = ["rec-goal", "rec-background", "rec-schedule", "rec-environment", "rec-priorities", "rec-result", "custom-priorities", "custom-exercises", "custom-shape", "custom-result", "browse-filters", "browse-list", "browse-preview", "build-setup", "build-empty", "build-ready", "ff-empty", "ff-reply", "ff-gaps", "ff-unreadable", "import-source", "import-review", "import-preview", "shared-preview"];
const JOURNEYS = [
  { id: "activate.recommend", k: "K-1 K-24", start: "landing" },
  { id: "activate.custom", k: "K-1", start: "route-choice" },
  { id: "activate.browse", k: "K-1", start: "route-choice" },
  { id: "activate.build", k: "K-1", start: "route-choice" },
  { id: "activate.import-file", k: "K-1", start: "import-source" },
  { id: "activate.import-paste", k: "K-1", start: "ff-empty" },
  { id: "activate.shared", k: "K-1", start: "shared-gate" },
  { id: "edit.roundtrip", k: "K-2", start: "rec-result" },
  { id: "edit.remove-two.editor", k: "K-3", start: "rec-result" },
  { id: "edit.remove-two.review", k: "K-3", start: "rec-result" },
  { id: "build.gating", k: "K-4", start: "build-setup" },
  ...CANCEL_VIEWS.map((cp) => ({ id: "cancel", k: "K-5", start: cp, params: { checkpoint: cp } })),
  { id: "cancel.keep-resume", k: "K-5", start: "rec-schedule" },
  { id: "back.recommend", k: "K-6", start: "rec-result" },
  { id: "back.custom", k: "K-6", start: "custom-result" },
  { id: "back.browse", k: "K-6", start: "browse-preview" },
  { id: "back.import", k: "K-6", start: "import-review" },
  { id: "back.shared", k: "K-6", start: "shared-preview" },
  { id: "destroy.review-start-over", k: "K-7", start: "rec-result" },
  { id: "destroy.paste-restart", k: "K-7", start: "ff-reply" },
  { id: "destroy.discard-draft", k: "K-7", start: "rec-schedule" },
  { id: "existing.back", k: "K-8", start: "hub-existing" },
  { id: "existing.cancel-keep", k: "K-8", start: "hub-existing" },
  { id: "existing.cancel-discard", k: "K-8", start: "hub-existing" },
  { id: "existing.replace-cancel", k: "K-8", start: "replace-confirm" },
  { id: "existing.conflict", k: "K-8", start: "activation-conflict" },
  { id: "avoid.pain", k: "K-9", start: "rec-priorities" },
  { id: "overlays", k: "K-14", start: "rec-result" },
  { id: "change.days", k: "K-17", start: "rec-result" },
  { id: "correct.environment", k: "K-17 K-24", start: "rec-result" },
  { id: "avoid.from-review", k: "K-17 K-24", start: "rec-result" },
  { id: "recommend.required", k: "K-18", start: "rec-goal" },
  { id: "chooser.doors", k: "K-19", start: "route-choice" },
  ...["recommend", "custom", "browse", "build", "import"].map((j) => ({ id: `help.${j}`, k: "K-19", start: "route-choice" })),
];
const pick = (list, sel, keyf) => (!sel || sel === true || sel === "all" ? list : list.filter((x) => String(sel).split(",").includes(String(keyf(x)))));

async function auditCheckpoint(page, cand, cp, cell, consoleErrors) {
  const r = { candidate: cand, checkpoint: cp, cell: cell.n, ...cell, hard: [], warn: [] };
  try {
    await load(page, docUrl(cand, cp, cell));
    await page.addScriptTag({ path: join(here, "audit-page.js") });
    const a = await page.evaluate((o) => window.__audit.run(o), { checkpoint: cp, lang: cell.lang, vw: cell.vw, text: cell.text, motion: cell.motion || "normal" });
    r.hard.push(...a.hard); r.warn.push(...a.warn); r.data = a.data;
    for (const e of consoleErrors) r.hard.push(`console error: ${e.slice(0, 160)}`);
    if (SHOTS) {
      /* The page is reused per cell, so park the pointer first: an earlier real
         tap (the K-23 Privacy check) must not leave a hover state in this shot.
         The full-page shot draws sticky pinned bars mid-page, so a viewport shot
         (…-vp.png) is kept alongside it as the evidence for pinned placement. */
      await page.mouse.move(0, 0);
      const base = `${cand}__${cp}__${cell.lang}-${cell.theme}-${cell.vw}-${cell.text}${cell.motion === "reduced" ? "-reduced" : ""}`;
      const shot = join("shots", `${base}.png`); await page.screenshot({ path: join(outDir, shot), fullPage: true }); r.shot = shot;
      const vp = join("shots", `${base}-vp.png`); await page.screenshot({ path: join(outDir, vp), fullPage: false }); r.shotViewport = vp;
    }
    if (a.data.k23) {
      /* K-23: the Privacy control opens the stub (real tap), Escape closes it. */
      const opener = page.locator("[data-privacy-open]").first();
      if (await opener.count()) {
        await opener.click({ timeout: 5000 }).catch((e) => r.hard.push(`K-23 Privacy control could not be tapped: ${String(e.message).split("\n")[0]}`));
        const open = await page.evaluate(() => { const s = document.querySelector("[data-privacy-stub]"); return !!s && window.__audit.visible(s) && /dialog/.test(s.getAttribute("role") || ""); });
        if (!open) r.hard.push("K-23 the Privacy control did not open the Privacy stub"); else {
          await page.keyboard.press("Escape"); await page.waitForTimeout(80);
          const after = await page.evaluate(() => ({ closed: !document.querySelector("[data-privacy-stub]"), focus: !!document.activeElement?.closest("[data-privacy-open]") }));
          if (!after.closed) r.warn.push("K-23 Escape did not close the Privacy stub"); else if (!after.focus) r.warn.push("K-20 focus did not return to the Privacy control");
        }
        await page.mouse.move(0, 0);
      }
    }
  } catch (e) { r.hard.push(`load/run failed: ${String(e.message || e).slice(0, 200)}`); }
  r.ok = r.hard.length === 0;
  return r;
}

/* ------------------------------------------------------------------ */
/* Interaction checks (Q634): driven here with real input, because each one
   needs a real tap, key press or focus change. They run in the journey
   cells; the K-31 tap-every-control pass runs in cell 1 only. */
const settle = (page, ms = 150) => page.waitForTimeout(ms);
async function mark(page, sel, attr = "data-k-target") {
  return page.evaluate(({ sel, attr }) => { document.querySelectorAll(`[${attr}]`).forEach((e) => e.removeAttribute(attr)); const els = [...document.querySelectorAll(sel)].filter((e) => window.__audit.visible(e) && !e.disabled && e.getAttribute("aria-disabled") !== "true"); els.forEach((e, i) => e.setAttribute(attr, String(i))); return els.map((e) => ({ mode: e.dataset.mode || e.dataset.importMode || null, label: (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40), tag: e.tagName.toLowerCase() })); }, { sel, attr });
}
const inPage = (page) => page.addScriptTag({ path: join(here, "audit-page.js") });
const cpVisible = (page, cp) => page.evaluate((cp) => [...document.querySelectorAll(`[data-checkpoint="${cp}"]`)].some((e) => window.__audit.visible(e)), cp);
const dialogOpen = (page) => page.evaluate(() => [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].some((e) => window.__audit.visible(e)));
const focusInfo = (page) => page.evaluate(() => { const a = document.activeElement; return { tag: a ? a.tagName.toLowerCase() : null, inDialog: !!(a && a.closest("[role=dialog],[role=alertdialog]")), key: a?.dataset?.key || null, val: a?.dataset?.val || null, target: a?.getAttribute?.("data-k-target") ?? null, desc: a ? window.__audit.describe(a) : "none" }; });

async function interactionChecks(cand, cell) {
  const out = []; const ctx = await newContext(cell); const page = await ctx.newPage();
  const open = async (cp) => { await load(page, docUrl(cand, cp, cell)); await inPage(page); };
  const rec = (check, where, problems) => { out.push({ candidate: cand, check, where, cell: cell.n, ok: problems.length === 0, problems }); };
  /* K-25: an import-mode control never discards paste-door work. */
  for (const cp of ["ff-reply", "ff-gaps"]) {
    await open(cp); const controls = await mark(page, '[data-act="import-mode"],[data-import-mode]');
    const problems = [];
    for (let i = 0; i < controls.length; i++) {
      try {
        await open(cp); await mark(page, '[data-act="import-mode"],[data-import-mode]');
        await page.locator(`[data-k-target="${i}"]`).click({ timeout: 4000 }); await settle(page);
        if (await dialogOpen(page)) continue; /* a confirmation guards the work */
        if (await cpVisible(page, cp)) continue; /* nothing changed */
        const back = await mark(page, '[data-act="import-mode"][data-mode="freeform"],[data-import-mode="freeform"]', "data-k-back");
        if (!back.length) { problems.push(`after "${controls[i].label}" no control returns to the paste door`); continue; }
        await page.locator('[data-k-back="0"]').click({ timeout: 4000 }); await settle(page);
        if (!(await cpVisible(page, cp))) problems.push(`"${controls[i].label}" (${controls[i].mode}) and back lost the paste work (${cp} is gone)`);
      } catch (e) { problems.push(`"${controls[i]?.label}": ${String(e.message).split("\n")[0].slice(0, 120)}`); }
    }
    rec("K-25", cp, problems);
  }
  /* K-26: every dialog takes focus inside it, Escape closes it, focus returns to the opener. */
  for (const [cp, opener, prep] of [["rec-schedule", '[data-act="cancel"]'], ["rec-result", '[data-act="restart"]'], ["ff-reply", '[data-ff="start-over"]'], ["replace-confirm", "[data-activate]", "close"]]) {
    const problems = [];
    try {
      await open(cp);
      if (prep === "close") { await page.keyboard.press("Escape"); await settle(page); if (await dialogOpen(page)) { const c = await mark(page, '[data-act="replace-cancel"]', "data-k-close"); if (c.length) { await page.locator('[data-k-close="0"]').click({ timeout: 4000 }); await settle(page); } } if (await dialogOpen(page)) problems.push("could not close the replacement dialog to reopen it"); }
      const found = await mark(page, opener);
      if (!found.length) problems.push(`no visible opener ${opener}`);
      else {
        await page.locator('[data-k-target="0"]').click({ timeout: 4000 }); await settle(page, 250);
        if (!(await dialogOpen(page))) problems.push(`${opener} opened no dialog`);
        else {
          const f = await focusInfo(page); if (!f.inDialog) problems.push(`focus is not inside the dialog (on ${f.desc})`);
          await page.keyboard.press("Escape"); await settle(page, 250);
          if (await dialogOpen(page)) problems.push("Escape did not close the dialog");
          else { const back = await page.evaluate((sel) => { const a = document.activeElement; return { ok: !!(a && a.matches && a.matches(sel)), desc: a ? window.__audit.describe(a) : "none" }; }, opener); if (!back.ok) problems.push(`focus did not return to the opener (on ${back.desc})`); }
        }
      }
    } catch (e) { problems.push(String(e.message).split("\n")[0].slice(0, 160)); }
    rec("K-26", `${cp} ${opener}`, problems);
  }
  /* K-27: after an answer, focus stays on the chosen option (tap and Space). */
  { const problems = [];
    try {
      await open("rec-schedule");
      for (const [key, how] of [["daysPerWeek", "tap"], ["sessionMinutes", "space"]]) {
        const opts = await mark(page, `[data-act="pick"][data-key="${key}"]`);
        if (!opts.length) continue; /* one-question-per-screen layouts show one key at a time */
        const val = await page.locator('[data-k-target="1"],[data-k-target="0"]').last().getAttribute("data-val");
        const loc = page.locator(`[data-act="pick"][data-key="${key}"][data-val="${val}"]`).first();
        if (how === "tap") await loc.click(); else { await loc.focus(); await page.keyboard.press("Space"); }
        await settle(page);
        const f = await focusInfo(page);
        if (!(f.key === key && f.val === val)) problems.push(`${how} on ${key}=${val}: focus moved to ${f.desc}`);
      }
      if (!(await mark(page, '[data-act="pick"]')).length) problems.push("no answer option visible on rec-schedule");
    } catch (e) { problems.push(String(e.message).split("\n")[0].slice(0, 160)); }
    rec("K-27", "rec-schedule", problems);
  }
  /* K-30: Skip never discards a constraint the lifter chose. */
  { const problems = [];
    try {
      await open("rec-avoid-pain");
      const skips = await mark(page, '[data-act="skip"],[data-skip]');
      if (skips.length) {
        await page.locator('[data-k-target="0"]').click({ timeout: 4000 }); await settle(page);
        const kept = await page.evaluate(() => { const c = window.__tournamentCandidates[window.__tq.candidate]; const e = c.entry(); return !!(e && (e.answers?.exerciseConstraints || []).some((x) => x.exerciseId === "pr_bb" && x.reason === "pain")); });
        if (!kept) problems.push(`"${skips[0].label}" discarded the pain avoidance of the barbell bench press`);
      }
    } catch (e) { problems.push(String(e.message).split("\n")[0].slice(0, 160)); }
    rec("K-30", "rec-avoid-pain", problems);
  }
  await ctx.close();
  return out;
}
/* K-31 smoke: tap every visible control on every checkpoint once (fresh
   load each time) and scan for raw keys, undefined values and errors. */
async function smoke(cand, cell, checkpoints) {
  const out = []; const ctx = await newContext(cell); const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  const SEL = 'button,summary,[role=button],a[href]:not([target="_blank"])';
  for (const cp of checkpoints) {
    const problems = [];
    try {
      await load(page, docUrl(cand, cp, cell)); await inPage(page);
      const n = (await mark(page, SEL)).length;
      for (let i = 0; i < Math.min(n, 40); i++) {
        errs.length = 0;
        await load(page, docUrl(cand, cp, cell)); await inPage(page); const list = await mark(page, SEL);
        if (!list[i]) continue;
        try { await page.locator(`[data-k-target="${i}"]`).click({ timeout: 2500 }); } catch (e) { continue; }
        await settle(page, 120);
        const raw = await page.evaluate(() => { try { return window.__audit.k31().concat((window.__tournamentErrors || []).map((e) => "runtime error: " + String(e).slice(0, 120))); } catch (e) { return ["page replaced"]; } }).catch(() => []);
        for (const r of raw) if (r !== "page replaced") problems.push(`after "${list[i].label}": ${r}`);
        for (const e of errs) problems.push(`after "${list[i].label}": console ${e.slice(0, 120)}`);
        if (problems.length > 6) break;
      }
    } catch (e) { problems.push(String(e.message).split("\n")[0].slice(0, 160)); }
    out.push({ candidate: cand, check: "K-31", where: `${cp} (tap every control)`, cell: cell.n, ok: problems.length === 0, problems: [...new Set(problems)] });
    process.stdout.write(`${problems.length ? "✗" : "✓"} ${cand} smoke ${cp}${problems.length ? "  " + problems.slice(0, 2).join(" | ").slice(0, 200) : ""}\n`);
  }
  await ctx.close();
  return out;
}

async function runJourney(cand, j, cell, policy) {
  const context = await newContext(cell); const page = await context.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.exposeBinding("__journeyAct", async (_src, a) => {
    const loc = page.locator(`[data-journey-target="${a.n}"]`);
    try { if (a.kind === "fill") await loc.fill(a.value, { timeout: 5000 }); else await loc.click({ timeout: 5000 }); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e.message || e).split("\n")[0].slice(0, 200) }; }
  });
  let run;
  try {
    await load(page, docUrl(cand, j.start, cell, `&journey=${encodeURIComponent(j.id)}`));
    for (const f of ["audit-page.js", "journey-api.js", "journey-checks.js"]) await page.addScriptTag({ path: join(here, f) });
    run = await page.evaluate(({ id, params, cell }) => window.__journeyRun(id, params, cell), { id: j.id, params: j.params || {}, cell: { vw: cell.vw, text: cell.text, lang: cell.lang } });
  } catch (e) { run = { id: j.id, status: "error", problems: [`runner failed: ${String(e.message || e).slice(0, 200)}`], taps: 0 }; }
  for (const e of errors) if (!(run.problems || []).some((p) => p.includes(e.slice(0, 60)))) (run.problems = run.problems || []).push(`page error: ${e.slice(0, 200)}`);
  if (run.status === "ok" && run.problems?.length) run.status = "fail";
  /* K-19 is a warning for a candidate flagged for PD-1. */
  run.severity = run.status === "ok" ? "pass" : (/^K-19/.test(j.k) && (policy.productDecisions || []).includes("PD-1")) ? "warn" : "hard";
  /* Checks already ran in the page on the full data; store a compact record. */
  const brief = (s) => { if (!s) return s; if (s.dom) delete s.dom.text; if (s.entry?.result) s.entry.result = { fingerprint: s.entry.result.fingerprint || null, name: s.entry.result.name || null, namePt: s.entry.result.namePt || null, exercises: (s.entry.result.preview?.program || []).length }; if (s.device) s.device = { active: s.device.active ? { name: s.device.active.name, namePt: s.device.active.namePt || null, exercises: (s.device.active.program || []).length } : null, revision: s.device.revision, draft: s.device.draft ? { route: s.device.draft.state?.route, step: s.device.draft.state?.step } : null }; return s; };
  for (const s of Object.values(run.snapshots || {})) brief(s);
  brief(run.final);
  if (SHOTS && run.status !== "not-implemented") { const shot = join("shots", `${cand}__journey__${j.id}${j.params?.checkpoint ? "__" + j.params.checkpoint : ""}__${cell.vw}-${cell.text}.png`); await page.screenshot({ path: join(outDir, shot), fullPage: false }).catch(() => {}); run.shot = shot; }
  await context.close();
  return { candidate: cand, id: j.id, k: j.k, start: j.start, params: j.params || null, cell: cell.n, ...run };
}

async function roundTwo() {
  const cells = pick(R2_CELLS, args.cells, (c) => c.n);
  const audits = [], journeys = [], policies = {}, interactions = [];
  for (const cand of CANDS) {
    { /* policy + checkpoint list */
      const ctx = await newContext(R2_CELLS[0]); const page = await ctx.newPage();
      await load(page, `${BASE}${DOC}?c=${cand}&cp=none&lang=pt`);
      const info = await page.evaluate(() => { const c = (window.__tournamentCandidates || {})[window.__tq.candidate]; return { loaded: !!c, policy: (c && c.policy) || {}, checkpoints: TF.CHECKPOINTS.map((x) => x.id), journeys: c && c.journeys ? Object.keys(c.journeys) : [], entry: !!(c && typeof c.entry === "function") }; });
      policies[cand] = info; await ctx.close();
      if (!info.loaded) { console.log(`✗ candidate ${cand} did not load`); continue; }
      var checkpoints = pick(info.checkpoints, args.checkpoints, (x) => x);
    }
    if (!args["no-audit"]) for (const cell of cells) {
      const ctx = await newContext(cell); const page = await ctx.newPage(); const consoleErrors = [];
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); }); page.on("pageerror", (e) => consoleErrors.push(String(e)));
      for (const cp of checkpoints) {
        consoleErrors.length = 0;
        const r = await auditCheckpoint(page, cand, cp, cell, consoleErrors); audits.push(r);
        process.stdout.write(`${r.ok ? "✓" : "✗"} ${cand} ${cp} [${r.cell}] ${cellName(cell)}${r.hard.length ? "  " + r.hard.join(" | ").slice(0, 220) : ""}\n`);
      }
      await ctx.close();
    }
    if (!args["no-interactions"]) {
      for (const cell of JOURNEY_CELLS) { const r = await interactionChecks(cand, cell); interactions.push(...r); for (const x of r) process.stdout.write(`${x.ok ? "✓" : "✗"} ${cand} ${x.check} ${x.where} [${x.cell}]${x.problems.length ? "  " + x.problems.join(" | ").slice(0, 240) : ""}\n`); }
      if (!args["no-smoke"]) interactions.push(...await smoke(cand, R2_CELLS[0], checkpoints));
    }
    if (args.journeys !== "none") {
      const list = pick(JOURNEYS, args.journeys, (j) => j.id);
      for (const j of list) for (const cell of JOURNEY_CELLS) {
        const r = await runJourney(cand, j, cell, policies[cand].policy || {}); journeys.push(r);
        const mark = r.severity === "pass" ? "✓" : r.severity === "warn" ? "!" : "✗";
        process.stdout.write(`${mark} ${cand} journey ${j.id}${j.params ? " @" + j.params.checkpoint : ""} [${cell.n}] ${r.status} taps=${r.taps ?? "-"}${r.problems?.length ? "  " + r.problems.join(" | ").slice(0, 240) : ""}\n`);
      }
    }
  }
  writeFileSync(join(outDir, "results.json"), JSON.stringify({ base: BASE, round: ROUND, doc: DOC, generatedAt: new Date().toISOString(), cells, journeyCells: JOURNEY_CELLS.map((c) => c.n), policies, audits, journeys, interactions }, null, 1));
  writeFileSync(join(outDir, "summary.md"), summaryTwo(cells, audits, journeys, policies, interactions));
  console.log(`\nwrote ${join(outDir, "summary.md")}`);
}

function summaryTwo(cells, audits, journeys, policies, interactions = []) {
  const md = [`# Acceptance — round ${ROUND}`, "", `Generated ${new Date().toISOString()} against \`${BASE}${DOC}\` by \`tools/verify.mjs --round ${ROUND}\`.`, "",
    "Cells (§12.1): " + cells.map((c) => `${c.n} ${cellName(c)}`).join(" · ") + ".", `Journeys (§12.2) run in cells ${JOURNEY_CELLS.map((c) => c.n).join(" and ")}. Every hard check is a failure; warnings are listed separately.`, ""];
  const cands = [...new Set([...audits.map((a) => a.candidate), ...journeys.map((j) => j.candidate)])];
  md.push("| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented | Interaction checks passed |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const c of cands) {
    const A = audits.filter((a) => a.candidate === c), Jr = journeys.filter((j) => j.candidate === c), I = interactions.filter((x) => x.candidate === c);
    md.push(`| ${c} | ${((policies[c]?.policy?.productDecisions) || []).join(", ") || "none"} | ${A.length} | ${A.filter((a) => a.ok).length} | ${A.filter((a) => a.warn.length).length} | ${Jr.length} | ${Jr.filter((j) => j.severity === "pass").length} | ${Jr.filter((j) => j.severity === "hard" && j.status !== "not-implemented").length} | ${Jr.filter((j) => j.status === "not-implemented").length} | ${I.length ? `${I.filter((x) => x.ok).length} / ${I.length}` : "not run"} |`);
  }
  md.push("", "Interaction checks (Q634): K-25 import work kept, K-26 dialog focus, K-27 focus after an answer, K-30 Skip keeps constraints (cells " + JOURNEY_CELLS.map((c) => c.n).join(" and ") + "), K-31 tap every control (cell 1). K-28, K-29, K-31 and K-32 also run inside the journeys and the checkpoint audit.", "");
  for (const c of cands) {
    const A = audits.filter((a) => a.candidate === c), Jr = journeys.filter((j) => j.candidate === c);
    md.push(`## ${c}`, "");
    /* hard failures grouped by check */
    const byCheck = {};
    for (const a of A) for (const h of a.hard) { const k = (h.match(/^(K-\d+)/) || [])[1] || h.split(":")[0]; (byCheck[k] = byCheck[k] || []).push(`${a.checkpoint} [${a.cell}] ${h}`); }
    md.push("### Checkpoint audit: hard failures", "");
    if (!Object.keys(byCheck).length) md.push(A.length ? "None." : "Not run.", "");
    for (const [k, list] of Object.entries(byCheck).sort()) { md.push(`**${k}** (${list.length})`, "", ...list.slice(0, 40).map((x) => `- ${x.replace(/\|/g, "\\|")}`), ...(list.length > 40 ? [`- … ${list.length - 40} more in results.json`] : []), ""); }
    const I = interactions.filter((x) => x.candidate === c);
    if (I.length) { const bad = I.filter((x) => !x.ok); md.push("### Interaction checks", "", bad.length ? `${bad.length} of ${I.length} failed:` : `All ${I.length} passed.`, "", ...bad.map((x) => `- **${x.check}** ${x.where} [${x.cell}]: ${x.problems.join(" | ").slice(0, 400).replace(/\|/g, "\\|")}`), ""); }
    const warns = A.filter((a) => a.warn.length);
    md.push("### Checkpoint audit: warnings", "", warns.length ? `${warns.length} cells with warnings (44 px targets, clipping, K-22, K-20). First 20:` : "None.", "", ...warns.slice(0, 20).map((a) => `- ${a.checkpoint} [${a.cell}]: ${a.warn.join(" | ").slice(0, 300).replace(/\|/g, "\\|")}`), "");
    if (Jr.length) {
      md.push("### Journeys", "", `| Journey | Check | Start | ${JOURNEY_CELLS.map((c) => `Cell ${c.n} (${cellName(c)})`).join(" | ")} | Taps |`, `|---|---|---|${JOURNEY_CELLS.map(() => "---").join("|")}|---|`);
      const keyOf = (j) => j.id + (j.params?.checkpoint ? ` @${j.params.checkpoint}` : "");
      const ids = [...new Set(Jr.map(keyOf))];
      for (const id of ids) {
        const rs = Jr.filter((j) => keyOf(j) === id);
        const cellTxt = JOURNEY_CELLS.map((c) => { const r = rs.find((x) => x.cell === c.n); if (!r) return "–"; return r.severity === "pass" ? "pass" : r.status === "not-implemented" ? "**not implemented**" : `**${r.severity === "warn" ? "warn" : "FAIL"}**`; }).join(" | ");
        md.push(`| ${id} | ${rs[0].k} | ${rs[0].start} | ${cellTxt} | ${rs.map((r) => r.taps ?? "–").join(" / ")} |`);
      }
      md.push("");
      const fails = Jr.filter((j) => j.severity !== "pass");
      if (fails.length) { md.push("Journey problems:", ""); for (const f of fails) md.push(`- ${keyOf(f)} [${f.cell}] ${f.status}: ${(f.problems || []).join(" | ").slice(0, 400).replace(/\|/g, "\\|") || "(journey not exported by the candidate)"}`); md.push(""); }
      /* K-24 */
      const k24 = (id, seg) => JOURNEY_CELLS.map((c) => { const r = Jr.find((x) => x.id === id && x.cell === c.n); if (!r || r.status === "not-implemented") return "–"; return String(seg ? r.segmentTaps ?? "–" : r.taps ?? "–") + (r.severity === "pass" ? "" : " (failed)"); }).join(" | ");
      md.push("### K-24 tap counts (reported, not thresholds)", "", `| Task | ${JOURNEY_CELLS.map((c) => `Cell ${c.n}`).join(" | ")} |`, `|---|${JOURNEY_CELLS.map(() => "---").join("|")}|`,
        `| Rafael, landing → Today (Recommend) | ${k24("activate.recommend", false)} |`,
        `| Correction from the review → recompiled review (hard bound ${Jr.find((x) => x.id === "correct.environment" && x.bound)?.bound ?? 6} taps) | ${k24("correct.environment", true)} |`,
        `| Avoid bench press from the review → recompiled review | ${k24("avoid.from-review", true)} |`, "");
    }
  }
  return md.join("\n");
}

/* Dispatch last: the Round 2 tables above are module-level consts. */
if (ROUND === "1") await roundOne(); else await roundTwo();
await browser.close();
