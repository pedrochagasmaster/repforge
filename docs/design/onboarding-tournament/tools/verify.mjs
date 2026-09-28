#!/usr/bin/env node
/**
 * Acceptance run for the onboarding tournament harness.
 *
 * For every candidate × checkpoint × (locale, theme) cell it loads app.html,
 * waits for the candidate to reach the checkpoint, then records:
 *   - runtime errors (window.__tournamentErrors, console errors, page errors);
 *   - whether the checkpoint marker rendered ([data-checkpoint="<id>"]);
 *   - horizontal overflow at the viewport width;
 *   - interactive targets below the 44px floor (visible buttons/links/inputs);
 *   - text nodes clipped by overflow:hidden ancestors at 200% (heuristic);
 * and writes a screenshot per cell. Output: round-N/acceptance/{results.json,
 * summary.md, shots/}.
 *
 * Usage: node tools/verify.mjs --base http://127.0.0.1:8123/docs/design/onboarding-tournament/ --round 1 [--candidates a,b,c] [--quick]
 */
import { chromium } from "../../../../test/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true] : []).filter(Boolean));
const BASE = args.base || "http://127.0.0.1:8123/docs/design/onboarding-tournament/";
const ROUND = String(args.round || "1");
const DOC = ROUND === "1" ? "app.html" : "round-2/app.html";
const CANDS = String(args.candidates || (ROUND === "1" ? "a,b,c" : "d,e,f")).split(",");
const QUICK = !!args.quick;
const ONLY200 = !!args.only200;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", `round-${ROUND}`, "acceptance");
mkdirSync(join(outDir, "shots"), { recursive: true });

const CELLS = ONLY200 ? [{ lang: "pt", theme: "light", vw: 390, text: "200" }] : QUICK
  ? [{ lang: "pt", theme: "light", vw: 390, text: "100" }]
  : [
    { lang: "pt", theme: "light", vw: 390, text: "100" },
    { lang: "en", theme: "dark", vw: 390, text: "100" },
    { lang: "pt", theme: "light", vw: 320, text: "100" },
    { lang: "pt", theme: "light", vw: 390, text: "200" },
    { lang: "en", theme: "light", vw: 430, text: "100", motion: "reduced" },
  ];

const exe = process.env.TOURNAMENT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const results = [];
let checkpoints = null;
for (const cand of CANDS) {
  for (const cell of CELLS) {
    const context = await browser.newContext({ viewport: { width: cell.vw, height: cell.vw === 320 ? 568 : cell.vw === 430 ? 932 : 844 }, deviceScaleFactor: 2, reducedMotion: cell.motion === "reduced" ? "reduce" : "no-preference", locale: cell.lang === "pt" ? "pt-BR" : "en-US" });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    if (!checkpoints) {
      await page.goto(`${BASE}${DOC}?c=${cand}&cp=landing&lang=en`, { waitUntil: "load" });
      await page.waitForFunction(() => window.__tournamentReady === true, undefined, { timeout: 30000 });
      checkpoints = await page.evaluate(() => TF.CHECKPOINTS.map((c) => c.id));
    }
    for (const cp of checkpoints) {
      consoleErrors.length = 0;
      const url = `${BASE}${DOC}?c=${cand}&cp=${cp}&lang=${cell.lang}&theme=${cell.theme}&text=${cell.text}&motion=${cell.motion || "normal"}`;
      const r = { candidate: cand, checkpoint: cp, ...cell, url, ok: true, problems: [] };
      try {
        await page.goto(url, { waitUntil: "load" });
        await page.waitForFunction(() => window.__tournamentReady === true, undefined, { timeout: 30000 });
        await page.waitForTimeout(150);
        const audit = await page.evaluate((cpId) => {
          const errs = [...(window.__tournamentErrors || [])];
          const marker = !!document.querySelector(`[data-checkpoint="${cpId}"]`);
          const overflow = [...document.querySelectorAll("body *")].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !el.closest("[style*=\"overflow\"], .b-rail, .c-tabs"); });
          const small = [];
          for (const el of document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button]")) {
            const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
            const rct = el.getBoundingClientRect(); if (rct.width === 0 || rct.height === 0) continue;
            if (rct.height < 43.5 || rct.width < 43.5) small.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}] ${Math.round(rct.width)}×${Math.round(rct.height)}`);
          }
          const clipped = [];
          for (const el of document.querySelectorAll("h1,h2,h3,p,span,button,label,li,strong,b")) {
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
        await page.screenshot({ path: join(outDir, shot), fullPage: !QUICK });
        r.shot = shot;
      } catch (e) { r.problems.push("load/run failed: " + String(e.message || e).slice(0, 200)); }
      r.ok = r.problems.filter((p) => !p.startsWith("targets under") && !p.startsWith("clipped")).length === 0;
      results.push(r);
      process.stdout.write(`${r.ok ? "✓" : "✗"} ${cand} ${cp} ${cell.lang}/${cell.theme}/${cell.vw}/${cell.text}${r.problems.length ? "  " + r.problems.join(" | ").slice(0, 200) : ""}\n`);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(join(outDir, "results.json"), JSON.stringify({ base: BASE, round: ROUND, generatedAt: new Date().toISOString(), cells: CELLS, results }, null, 1));
const byCand = {};
for (const r of results) { const b = byCand[r.candidate] = byCand[r.candidate] || { total: 0, ok: 0, warn: 0, fail: [] }; b.total++; if (r.ok) b.ok++; if (r.problems.some((p) => p.startsWith("targets") || p.startsWith("clipped"))) b.warn++; if (!r.ok) b.fail.push(`${r.checkpoint} ${r.lang}/${r.theme}/${r.vw}/${r.text}: ${r.problems.join(" | ")}`); }
const md = [`# Acceptance — round ${ROUND}`, "", `Generated ${new Date().toISOString()} against \`${BASE}${DOC}\`.`, "", "| Candidate | Cells | Hard pass | Cells with 44px/clipping warnings |", "|---|---|---|---|", ...Object.entries(byCand).map(([c, b]) => `| ${c} | ${b.total} | ${b.ok} | ${b.warn} |`), ""];
for (const [c, b] of Object.entries(byCand)) { md.push(`## ${c}`, ""); if (!b.fail.length) md.push("No hard failures.", ""); else md.push(...b.fail.map((f) => "- " + f), ""); const warns = results.filter((r) => r.candidate === c && r.problems.some((p) => p.startsWith("targets") || p.startsWith("clipped"))); if (warns.length) { md.push("Warnings:", "", ...warns.map((r) => `- ${r.checkpoint} ${r.lang}/${r.theme}/${r.vw}/${r.text}: ${r.problems.filter((p) => p.startsWith("targets") || p.startsWith("clipped")).join(" | ")}`), ""); } }
writeFileSync(join(outDir, "summary.md"), md.join("\n"));
console.log(`\nwrote ${join(outDir, "summary.md")}`);
