# Review of `docs/comprehensive-ui-ux-evaluation-report.md`

**Date:** July 7, 2026
**Reviewed at:** `main` @ `5c46c1b` (the commit that merged the report; `app.js` is unchanged since the report's stated baseline `c60334d`)
**Method:** every actionable claim in the report's §6 (bugs) and §7 (priority recommendations) was re-verified against the live code and, where cheap, against the running app with a scripted Playwright session (seeded program + two sessions at 390×844). Contrast ratios were computed per WCAG 2.x relative luminance. Baseline `test/simulation.mjs`: **PASSED 267 / FAILED 0**.

---

## 1. Verdict

The report's **structural conclusions hold**: the product is stable, visually cohesive, and its remaining gap is discoverability, copy clarity, and drill-down actionability rather than missing features. Its PR-history narrative (§3, §5, §9) matches the git log and the plans index.

Its **recommendation list does not survive verification as-is**. Of the 24 numbered recommendations in §7:

- ~13 are confirmed and worth doing (several reformulated after checking the code),
- 3 target behavior that is **already implemented**,
- 3 are grounded in **observations that don't match the product** (quoted UI strings that don't exist in `app.js`),
- the rest are real but low-leverage or product decisions rather than fixes.

The report also **missed** two concrete defects that live testing surfaced immediately (a grammar bug in the finish toast, and a dead settings field).

The definitive list in §5 below supersedes the report's §7. Executable plans are filed as `plans/030`–`036`.

---

## 2. Claims verified TRUE (evidence)

| Report claim | Evidence |
|---|---|
| "1 hard sets" grammar on This Week card | `app.js:926` — `` `${w.totalHardSets} hard sets` `` with no pluralization (the adjacent lifts line at `app.js:927` pluralizes correctly) |
| Chart Y-axis label duplication | Reproduced live: with two sessions at the same load, all four gridline labels read `20` (labels are `Math.round`ed at `app.js:1196`, collapsing a padded but narrow value range). The report's example "20 20kg" misdescribes the mechanism but the defect is real. |
| Block review entry uses native `confirm()` | `app.js:543` — `promptEndBlock()`; the app already has branded dialog patterns (`#blockReview`, `#importChoice` in `index.html:225-247`) |
| No recommended-strategy highlight in block review | `index.html:229-233` — five equal `btn--steel` buttons; `buildBlockReview` computes a recommendation (`app.js:465-470`) that is shown as prose only |
| Effort mode has no in-context RIR mapping | Effort buttons at `app.js:728-731` are plain buttons; `GLOSSARY` already contains "Easy effort"/"Hard effort"/"Max effort" entries (`app.js:47-49`) that nothing surfaces |
| Attention "untested" chips dead-end in a toast | `app.js:1156` — chips for unlogged lifts fire `toast("Log this lift to chart it.")` instead of navigating; confirmed live |
| Only the first item's "why" shows per attention group | `app.js:1151` — `items[0]?.why` |
| Week banner on Log is not tappable | `index.html:39` — `#logContext` is a `<p>`; nothing binds it (`app.js:701-702`) |
| "Under target" threshold opaque | Thresholds live in `weeklySnapshot` (`app.js:400-405`); no UI explains them |
| Onboarding has no progress bar; review step read-only | `index.html:196-209` — only `#onbStepLabel` text counter; final step renders a read-only split |
| Secondary text contrast may fail WCAG AA | Computed: `--steel` `#7c899b` **passes** (5.32:1 on iron, 4.87:1 on slag) but `--steel-dim` `#586474` **fails** (3.14:1 on iron, 2.87:1 on slag) and is used for ~25 text styles incl. `.ex__meta`, `.prev`, `.session__delta`, `.attn__why` (`styles.css:25` and usages); the chart's `C.dim` (`app.js:1187`) is the same value |
| Strength/Volume/PR rows are read-only | Rendered via the generic `table()` helper (`app.js:1407-1408`) / plain markup with no handlers |
| Focus mode preference not persisted | `logMode` is a runtime variable (`app.js:333`); resets to List on reload |
| Voice mic button is an emoji | `index.html:54` — `🎤` |

## 3. Claims that do NOT survive verification

| Report claim | What the product actually does |
|---|---|
| §6/§7-1: History cards show a cryptic "`& new`" shorthand; "Replace `& new` with '1 new lift'" | No such string exists. `formatDeltaCounts` (`app.js:628-631`) emits `1 improved · 1 new`. Live-verified: History delta lines rendered exactly `"1 improved · 1 new"`. The only defensible residue is appending "lift" to the `new` part — that is folded into plan 030. |
| §4.1: "History relies on color alone — no explicit '1 improved · 0 flat' line"; §7 P0-2 "Add explicit delta count line on History cards" | The line already exists: `.session__delta` renders `formatDeltaCounts` on every session card (`app.js:1229`), live-verified. |
| §4.1: quotes the finish toast as "Workout logged — 1 set salvaged. …" | No "salvaged" string exists anywhere in the repo. The actual toast is `Workout forged — ${rows.length} sets logged.` (`app.js:892`), live-verified as "Workout forged — 1 sets logged. PR: Bench press 25 kg. 1 improved." The quoted observation appears fabricated — and it masked a real bug the report missed (see §4). |
| §4.14/§7 P3-16: "no exercise picker in Focus; add prev/next exercise chevrons" | Already implemented: Focus mode renders a `focusbar` with Prev/Next buttons and an "N of M" counter, with Finish workout on the last exercise (`app.js:831-839`). |
| §7 P3-17: "Rest timer auto-start on set save with visible countdown" | Already implemented: per-set save starts the timer (`app.js:794` — `if(committed.has(key))startRest()`) and `#restBar` in the header shows a live countdown (`app.js:685-692`, `index.html:25-27`). |
| §4.12/§7: "Command syntax not explained; **zero** discoverability" | Overstated: the input's placeholder is `Type: 80 x 8 @1` (`index.html:53`). The gap is real but narrower — no persistent help affordance, no screen-reader-accessible syntax description. Reformulated in plan 032. |
| §7 P1-9: "Program name field doesn't look editable" | Weak: the name is a labeled `<input>` ("Program name", placeholder "Untitled program") with a distinct field background (`app.js:1287`, `styles.css:350-351`). Rejected as a standalone item. |
| §7 P3-18: "Per-set save states more visually distinct" | Committed rows already get an ember left border, background tint, and a gold ✓ button (`styles.css:270-271`); suggested rows are dimmed (`styles.css:269`). Rejected — no concrete deficiency stated. |

## 4. Defects the report missed

| Finding | Evidence |
|---|---|
| **"1 sets logged"** grammar in the finish toast | `app.js:892`; live-verified toast: "Workout forged — 1 sets logged." Ironically on the same surface the report misquoted. |
| **Dead `commandParserHints` setting** | Defined in `DEFAULTS` (`app.js:57`), normalized (`app.js:60`), preserved on every settings commit (`app.js:1404`) — but never read by any render or behavior. Either an unfinished hints feature (P17-P18) or cruft. Resolved by plan 032. |
| "N sets" in Completed hard sets rows can read "1 sets" | `app.js:1181` — `` `<b>${fmt(x.eff)}</b> sets` `` (folded into plan 030) |

## 5. Definitive improvement list

Ordered by leverage (impact ÷ effort). Each of items 1–7 has a self-contained executable plan.

| # | Improvement | Plan | Effort | Risk |
|---|---|---|---|---|
| 1 | Pluralization/copy fixes: "1 sets logged" toast, "1 hard sets", "N sets" volume rows, "1 new" → "1 new lift" in delta counts | [`plans/030`](../plans/030-pluralization-copy-fixes.md) | S | LOW |
| 2 | Chart Y-axis: deduplicate rounded gridline labels (add precision when the range is narrow) | [`plans/031`](../plans/031-chart-gridline-label-dedupe.md) | S | LOW |
| 3 | Command bar syntax help: `?` affordance with examples, `aria-describedby`, remove the dead `commandParserHints` field | [`plans/032`](../plans/032-command-bar-syntax-help.md) | S | LOW |
| 4 | Effort scale legend: surface the existing Easy/Hard/Max glossary entries on the Log column header and under the Settings radios | [`plans/033`](../plans/033-effort-scale-legend.md) | S | LOW |
| 5 | Coaching → Log navigation: attention chips jump to the lift on the Log tab (correct day, scrolled into view); week eyebrow opens Stats → Review | [`plans/034`](../plans/034-coaching-surfaces-navigate-to-log.md) | M | MED |
| 6 | Branded End-block confirm (replacing native `confirm()`) + recommended-strategy highlight in the block review modal | [`plans/035`](../plans/035-branded-end-block-confirm-and-strategy-highlight.md) | M | MED |
| 7 | Contrast: make dim secondary text pass WCAG AA while preserving the steel/dim hierarchy (incl. chart `C.dim`) | [`plans/036`](../plans/036-secondary-text-contrast-aa.md) | S | LOW |

**Deferred to backlog** (real but lower leverage or needing product decisions — recorded in `plans/README.md`):

- Persist Focus/List mode preference across reloads (small, but wants a decision on whether it belongs in `settings`).
- Onboarding progress bar, skip-to-manual path, editable review step (product-design pass on an 8-step flow; no defect).
- Strength/Volume/PR row drill-down (L effort; needs a target-surface decision per row type).
- "Under target" status explanation (fold into a future glossary pass; `weeklySnapshot` thresholds would need naming first).
- Volume dashboard progress bars / status colors.
- Replace mic emoji with an SVG icon (cosmetic; icon set currently has a single SVG).
- One-time coach marks on Stats segments; first-run warmup-flag tip (needs a "tips seen" state design; risk of tip fatigue).
- Focus-mode visible-focus / `aria` audit beyond `:focus-visible` (`styles.css:176` already defines a global focus ring — the report's "not verified" stands, but no concrete failure was found).

**Rejected** (do not re-file): the already-implemented and unsubstantiated items in §3 above.

## 6. Note on the report's methodology

The report is strongest where it stayed close to the code (§3 PR timeline, §5 cross-cutting analysis) and weakest where it reported UI strings from memory of live sessions — three of its quoted strings do not exist in the product. Future evaluation passes should quote UI copy only from `app.js`/`index.html` or from a screenshot taken in the same session, and should re-check each §7 recommendation against the code before publishing (two were already shipped at the report's own baseline commit).
