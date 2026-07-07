# RepForge Comprehensive UI/UX Evaluation Report

**Date:** July 6, 2026  
**App version:** `main` @ PR #51 merge (`c60334d`)  
**Evaluator:** Cursor Cloud Agent (computer-use testing + PR/code review)  
**Scope:** All merged user-facing PR contributions (PRs #1–#51) plus hands-on evaluation of the integrated product

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Evaluation methodology](#2-evaluation-methodology)
3. [PR contribution timeline — UI/UX impact](#3-pr-contribution-timeline--uiux-impact)
4. [Feature-by-feature UI/UX evaluation (current product)](#4-feature-by-feature-uiux-evaluation-current-product)
5. [Cross-cutting analysis](#5-cross-cutting-analysis)
6. [Bugs and polish issues](#6-bugs-and-polish-issues)
7. [Priority recommendations](#7-priority-recommendations)
8. [Testing coverage matrix](#8-testing-coverage-matrix)
9. [Conclusion](#9-conclusion)
10. [Appendix: PR reference index](#10-appendix-pr-reference-index)

---

## 1. Executive summary

RepForge has evolved from a **visual redesign of a progression logger** (June 2026) into a **local-first coaching PWA** with program editing, mesocycle lifecycle, analytics dashboards, and quick-entry tooling (July 2026). The arc is coherent: establish identity → fix trust bugs → add pro UX → add hypertrophy intelligence → abstract programs → integrate phased roadmap.

### 1.1 Overall verdict

| Era | PRs | UI contribution | UX contribution | Grade |
|-----|-----|-----------------|-----------------|-------|
| Foundation | #2, #4 | Strong design system | Solid baseline flows | A |
| Trust & quality | #7–#9 | Minor | Critical data integrity | A- |
| Pro coaching | #10, #13 | Good density | Addresses persona pain points | B+ |
| Wave 2 features | #17 | Functional | High value, some discoverability gaps | B+ |
| Program identity | #19, #28 | Good chips/meta | Context finally travels to Log | A- |
| Phase integration | #51 (P1–P19) | Strong cohesion | Big coaching upgrade, some jargon | B+ |

### 1.2 Strongest cumulative wins

- Heat/progression visual language (PR #2)
- Visual program editor with live volume audit (PR #4)
- Session integrity and stable exercise identity (PR #9)
- Rest timer, focus mode, per-set commit, unit toggle (PR #13)
- Hypertrophy coaching: fatigue watch, attention board, hard-set volume (PR #10)
- Warmup flag, PR ledger, substitution, import merge (PR #17)
- Program metadata and Log context line (PR #19, #28)
- Onboarding wizard, mesocycle lifecycle, stats segmentation, session deltas, command bar (PR #51)

### 1.3 Persistent gaps across all PRs

- Command-bar syntax discoverability
- Analytics drill-down (Strength/Volume/PRs are read-only)
- Abbreviated delta copy (`& new`, `1 improved` without context)
- Power features buried in Settings (voice, effort RIR mapping)
- Long-form Log scrolling on multi-exercise days (partially mitigated by Focus mode)

### 1.4 Bugs found in live testing

**None blocking.** Polish issues only: `& new` shorthand, grammar (“1 hard sets”), chart Y-axis label duplication.

---

## 2. Evaluation methodology

### 2.1 What was done

Three computer-use testing passes at **390×844** mobile viewport against `http://localhost:8000/`:

| Pass | Coverage |
|------|----------|
| **Pass 1** | Full app walkthrough: onboarding (8 steps), Log save, all 5 Stats segments, History, Program, Settings |
| **Pass 2** | Targeted interactions: command bar, Focus mode, day tabs, PR filters, voice toggle, RIR effort mode, onboarding re-trigger, End block confirm |
| **Pass 3** | Block review modal, This Week + Attention board, session deltas (Log preview, toast, History cards) |

**Test data:** Fresh onboarding → 4-day upper/lower program → 2 bench sessions (20×10, then 22.5×10) producing PRs and “1 improved” deltas.

### 2.2 Supplementary sources

- `docs/feature-tracker.csv` — 72 features, 68 verified pass / 4 verified fixed
- `docs/feature_specs.psv` — code-grounded expected behaviour
- `docs/persona-product-feedback-report.md` — seven persona audits (July 2026)
- `plans/001`–`029` — improvement and roadmap plans
- `test/simulation.mjs` — 116+ automated Playwright checks (CI via PR #31)
- Git history and merged PR descriptions (#1–#51)

### 2.3 What was not live-tested

Inferred from PR descriptions, feature tracker, and simulation harness:

- Rest timer during active countdown
- Warmup flag (tap set chip → “W”)
- Exercise substitution picker (“Use:” on cards)
- Import merge dialog (Merge / Replace / Cancel)
- Per-set “Save set” commit states and visual distinction
- kg/lb unit toggle effect on all displayed values
- Full next-block strategy execution (modal closed to preserve data)
- Voice recognition (browser-dependent; mic button verified)
- 52-week simulation scenarios
- Glossary tap-to-define interaction
- Collapse/expand per exercise card
- Copy-last button
- Fatigue-watch banner trigger
- Inline History session edit flow

### 2.4 Evaluation axes

Each feature is assessed on:

- **UI:** Visual hierarchy, consistency with design system, mobile layout, empty states, feedback, polish
- **UX:** Discoverability, cognitive load, task completion speed, error prevention, coaching clarity, accessibility

---

## 3. PR contribution timeline — UI/UX impact

### PR #1 — Development environment setup

**Merged:** June 2026  
**Contribution:** `AGENTS.md`, dev-server docs, agent workflow conventions.

| UI | UX |
|----|-----|
| None directly | Enables reliable local serve, SW-aware testing, agent smoke paths |

**Assessment:** Infrastructure only. No user-visible change.

---

### PR #2 — Forge/temperature visual redesign

**Merged:** June 2026  
**Contribution:** Complete visual identity rebuild (`index.html`, `styles.css`, render layer in `app.js`).

**Design thesis:** Temperature encodes readiness to overload. The double-progression engine decides add/hold/back off; the UI renders that as *heat*.

#### Design system

| Token | Value | Role |
|-------|-------|------|
| Iron base | `#0e1116` | App background |
| Surfaces | `#161b22`, `#1e2530` | Cards, inputs |
| Steel | `#7c899b` | Secondary text |
| Mist | `#eceff4` | Primary text |
| Heat ramp | ember `#ff5a1f` → gold `#ffb44c` → white `#ffe9c7` | Progression readiness |
| Quench | `#4fb6d9` | Cool / hold states |
| Display type | Saira Condensed | Headings, brand |
| Body type | IBM Plex Sans | Prose, labels |
| Data type | IBM Plex Mono | All numeric ledger data |

#### UI/UX evaluation

| Element | UI | UX |
|---------|----|----|
| Per-exercise heat strip + edge glow | Signature visual; status immediately scannable | Encodes progression without reading chip text |
| Status chips (Add load, Hold, Back off, New lift) | Consistent chip component; color tied to heat class | Plain-language coaching at card level |
| Session heat gauge in header | Compact “forge” / “N hot” pill | Answers “how many lifts ready to add?” without scrolling |
| Heated progression chart | Gradient area fill, gold data points, ember shadow on last point | Stats feel alive; recent progress emphasized |
| Bottom nav with icons | Five-tab shell, always visible | Standard mobile PWA pattern |
| REP**FORGE** wordmark | White-hot “FORGE” accent | Strong brand recall |

**Strengths:** Distinct from generic “acid accent on near-black” fitness apps. Self-hosted fonts preserve offline-first PWA promise.

**Weaknesses:** Heat metaphor can feel like branding over math for veteran lifters (noted in persona report). Secondary steel-on-iron text may fail WCAG AA in places.

**Assessment:** Foundational design bet that still holds through PR #51. All subsequent features inherit this system successfully.

---

### PR #3 — Hypertrophy mechanics review

**Merged:** June 2026  
**Contribution:** `docs/hypertrophy-mechanics-review.md` — domain research document.

**UI/UX impact:** None directly. Informed PR #10 progression logic (RIR-aware holds, stall detection, hard-set volume).

---

### PR #4 — Visual program editor

**Merged:** June 2026  
**Contribution:** `Exercise` / `Program` domain model; day-grouped visual editor replacing raw-JSON-only Program tab.

#### Features delivered

- Day cards: rename, delete, add day
- Per-exercise cards: name, sets, min/max reps, primary/secondary muscles
- Reorder exercises up/down within a day
- Live persist to `localStorage`; volume audit + heat gauge update on edit
- Raw JSON preserved under **Advanced** `<details>` for power users
- Service worker cache bumped to `repforge-v3`

#### UI/UX evaluation

| Element | UI | UX |
|---------|----|----|
| Day-grouped cards | Clear hierarchy: day header → exercise list | Non-technical users build splits without JSON |
| Live volume audit bars | Bar width proportional to effective sets | Surfaces muscle balance while editing |
| Advanced JSON in `<details>` | Progressive disclosure | Power users retained; everyday users not overwhelmed |
| Inline rename/reorder/delete | Standard form controls + confirm on delete | Program changes feel immediate |
| “+ Add day” / “+ Add exercise” | Steel buttons at logical positions | Obvious growth path for split |

**Strengths:** Major UX unlock. PR #51 onboarding output lands in this editor — handoff works visually.

**Weaknesses:** Long programs require heavy scrolling; no accordion collapse per day. Exercise utility controls (▲▼✕) are icon-only.

**Assessment:** Grade A for program management UX. Remains the right surface for post-onboarding tweaks.

---

### PR #7 — Feature spec, test, and fix pass

**Merged:** June 2026  
**Contribution:** Orchestrated four-phase pass — spec (72 features), browser test, fix, re-test.

#### Fixes with UX impact

| ID | Fix | UX impact |
|----|-----|-----------|
| LOG-5 | Blank kg default for new lifts; select-on-focus on inputs | Stops leading-zero confusion (“050”) |
| SET-3 | Settings accept `0` for RIR ceiling and jump %; min-jump kept > 0 | Power users can configure edge cases |
| PROG-10 | Program min/max auto-correction; invalid values revert on blur | Prevents garbage rep ranges |
| SHELL-10 | `mobile-web-app-capable` meta; SW cache bump | Cleaner PWA install; no deprecation warning |

**Deliverable:** `docs/feature-tracker.csv` — canonical 72-feature verification matrix.

**Assessment:** Invisible but essential. Trust-building fixes that prevent mid-workout frustration. UI unchanged; interaction quality improved.

---

### PR #8 — Fix nonsensical cross-exercise Stats metrics

**Merged:** July 2026  
**Contribution:** Replaced misleading global aggregates with per-lift framing.

| Before | After (PR #8) |
|--------|---------------|
| “Best e1RM” tile = max across all exercises | “Progressing” tile = lifts with increased top load |
| “Top loads” table ranked by absolute kg | “Progress by lift” table with per-lift Δ |

**Note:** PR #9 later **restored** Best e1RM tile and top-load leaderboard per feature-spec alignment. The cross-exercise lesson was absorbed: global tiles must be meaningful aggregates (sessions, volume), not cross-lift comparisons.

**Assessment:** Important UX correction. Current state (post-#9) is correct for chart-driven per-exercise Stats model.

---

### PR #9 — Veteran-user review fixes

**Merged:** July 2026  
**Contribution:** Data integrity, stable identity, simulation harness (`test/simulation.mjs`).

#### Changes with UX impact

| Change | UX impact |
|--------|-----------|
| Save only sets with load > 0 | No phantom history rows from empty defaults |
| `exerciseId` on log rows | Recommendations and stats follow renames |
| History by `created` timestamp, not backdated date | Correct “last session” for recommendations |
| Zero-load sets excluded from recommendation math | No false “Back off” signals |
| Settings normalized on load/import | No NaN targets from missing settings |
| Duplicate day rename rejected | No silent day merging |
| Day rename updates historical session labels | History stays coherent |
| Load inputs `step="any"` | Micro-plate loads (61.25 kg) accepted |
| Double-submit guard on Save workout | No duplicate sessions |
| UUID session IDs | No millisecond collisions |
| Draft cleared on import / program save / delete log | No stale values on wrong exercises |
| Service worker cache bumped to `repforge-v5` | Fresh asset delivery |

**Assessment:** Backend trust layer. Users feel it as “the app remembers correctly.” Enabled year-long simulation now gating CI (PR #31).

---

### PR #10 — Progression + UX + hypertrophy upgrades

**Merged:** July 2026  
**Contribution:** Three-tier coaching upgrade — largest pre-#51 feature drop.

#### Tier 1 — Progression trust

| Feature | Description | UI | UX |
|---------|-------------|----|----|
| Robust back-off | `reduce` on median reps below range | Cool heat styling on card | One junk set no longer vetoes session |
| Majority add rule | 3+ sets: near-miss within 1 rep still earns jump | Add chip appears correctly | Fairer progression for real gym variance |
| Last-session prefills | Reps/RIR default to actual last session | Inputs pre-filled sensibly | Less typing; matches memory |
| Honest save meta | `logged / planned` set count | Button subtext updates live | Know scope before Finish workout |
| Renamed volume audit | “Planned weekly volume” + clarifying copy | Program tab lede | Distinguishes plan vs logged volume |

#### Tier 2 — Pro UX

| Feature | Description | UI | UX |
|---------|-------------|----|----|
| kg steppers | `−`/`+` snap to `minJump` on every set row | Flanking buttons on load input | Faster than keyboard on mobile |
| Copy last | Fill lift from previous session | Button on exercise card | One-tap repeat |
| Collapse/expand | Per exercise card | Chevron on card header | Reduces scroll on long days |
| Heat gauge scroll | Tap header gauge → first hot lift | Gauge is button | Quick navigation to actionable lift |
| Settings auto-save | Changes persist on input | No explicit save needed for dials | Less friction |
| Inline session edit | History EDIT button | Editable fields on card | Fix mistakes without delete |

#### Tier 3 — Hypertrophy brain

| Feature | Description | UI | UX |
|---------|-------------|----|----|
| RIR-aware holds | ≤0.5 RIR → recover; reps in reserve → push reps | Chip text varies | Nuanced coaching vs binary hold |
| Stall/deload detection | 3 sessions same load, no rep gain | Deload cue on card | Catches plateaus |
| Fatigue-watch banner | Multiple back-off/stall in one session | Orange banner above workout | Acknowledges bad days |
| Completed hard sets | Per muscle, rolling 7/28d, RIR-gated by `hardRir` | Bar chart in Stats | Hypertrophy-specific volume tracking |
| Setup notes | Per exercise, shown on Log card | Notes field on program + display on Log | Machine/slot context |
| Stats attention board | Ready to add / back off / untested groups | Sectioned chips (pre-P15) | Action-oriented dashboard |

**Live-tested this session:** Heat strips, attention board (upgraded in P15), completed hard sets in Dig deeper, save meta, kg steppers visible.

**Not triggered:** Fatigue banner (requires multiple stall/reduce on same day).

**Assessment:** Directly addresses persona feedback. Still leaves Log as full-day form — PR #13 Focus mode partially answers “one exercise at a time.” Grade B+ for closing the session-loop gap without fully solving it.

---

### PR #11 — Persona product feedback report

**Merged:** July 2026  
**Contribution:** `docs/persona-product-feedback-report.md` — seven persona deep-audits.

**Key persona thesis (hypertrophy power user):**

> RepForge should be the fastest honest log for people who already know how to train — local-first, progression-aware, no theater — and it should win or lose on the sixty seconds between sets, not on the stats tab I open once a week.

**UI/UX impact:** Indirect — shaped PR #13 and #17 priorities. Report catalogued rest timer, session mode, lbs toggle, warmup distinction, and faster copy-last as top requests.

---

### PR #12 — Improvement plans from persona feedback

**Merged:** July 2026  
**Contribution:** Executable plans 001–016 (and later 017–023) filed from persona audit.

**UI/UX impact:** Planning artifact. Implementation in PR #13 and #17.

---

### PR #13 — Implement improvement plans (001–016)

**Merged:** July 2026  
**Contribution:** Largest pre-#51 UX batch. Simulation: 85 checks, 0 failed.

#### Plan → feature mapping

| Plan | Feature | UI | UX | Live-tested |
|------|---------|----|----|-------------|
| 001 | Rest timer | `#restBar` in header (dot + time) | Top persona request | No (countdown) |
| 013 | Focus mode | List/Focus toggle above day tabs | Single-exercise view | **Yes** |
| 008 | kg/lb toggle | Settings units dropdown | US gym compatibility | No |
| 009 | Bodyweight per session | Optional field on Log form | Session context | Visible |
| 002 | Glossary on tap | `role="dialog"` popup for terms | Explains RIR, hard set, e1RM | No |
| 003 | Advanced settings collapsed | `<details>` around progression dials | Reduces Settings overwhelm | Visible |
| 015 | Stats “Dig deeper” collapsed | `<details id="statsDeep">` | Actionable default Stats view | **Yes** |
| 016 | Per-set Save | Per-row commit state | Incremental logging | No |
| 005 | Skip/trim session | Fatigue-driven trim action | Session management | No |
| 014 | IndexedDB + localStorage mirror | Invisible persistence layer | Durability beyond quota | No |
| 006 | Preserve exercise IDs in JSON editor | IDs in raw JSON export | History survives bulk edit | No |
| 010 | Chart resize redraw | Canvas redraw on orientation change | Chart stays readable | No |
| 011 | Service worker freshness | Cache versioning | Updates reach users | N/A |
| 012 | Nav/tab ARIA + keyboard | `role="tablist"`, focusable controls | Accessibility | Partial |
| 004 | Import preview | Import hygiene (partial) | Safer restore | No |
| 007 | Rich CSV export | Computed columns in export | Spreadsheet analysis | No |

**Assessment:** Closes biggest persona gaps. Focus mode and rest timer are high-value. Per-set save shifts mental model from “fill form → save all” to “commit as you go.” Grade A- for breadth; discoverability of individual features varies.

---

### PR #17 — Wave 2 consolidated implementation

**Merged:** July 2026  
**Contribution:** Plans 017–022. Consolidated competing plan sets from PRs #15/#16.

| Plan | Feature | UI | UX | Live-tested |
|------|---------|----|----|-------------|
| 017 | Program-only export/import | Buttons in Program → Advanced | Share templates without log | No |
| 018 | Import merge by session id | `#importChoice` modal: Merge / Replace / Cancel | Safe multi-device sync | No |
| 019 | Warmup set flag | Tap set number chip → “W” badge | Warmups excluded from volume/recs | No |
| 020 | PR ledger per exercise | Below trend chart in Dig deeper | Per-exercise PR history with deltas | Seen in Overview |
| 021 | Exercise substitution | “Use:” picker per card | Log alternates; preserve slot ID | No |
| 022 | Beginner literacy | Beginner program + effort RIR mode | Lower barrier for novices | Effort RIR **yes** |

**Assessment:** High coaching value, moderate discoverability. Warmup flag is clever but invisible until explained. PR ledger buried in collapsed Dig deeper. Grade B+.

---

### PR #18 — Non-sticky Finish workout button

**Merged:** July 2026  
**Contribution:** Removed `position: sticky` from `.btn--save`.

| Before | After |
|--------|-------|
| Save button followed viewport bottom | Save button in document flow after notes + bodyweight |

**UX impact:** Positive. Sticky save obscured content on long forms and felt disconnected from notes/bodyweight. Document-flow placement matches “scroll to bottom, review, finish” mental model.

**Live-tested:** Confirmed — button sits after session notes and bodyweight fields.

---

### PR #19 — Program metadata abstraction

**Merged:** July 2026  
**Contribution:** `state.programMeta` sibling to `Exercise[]`; Program tab summary card; export v2.

#### Features

- `programMeta`: `id`, `name`, `started`, `created`, `updated`, plus Phase 2 fields added in PR #51
- Program tab: editable name + start date; read-only chips (week, adherence, status, progression health, volume compliance)
- Export v2: `{ version: 2, meta, exercises }`
- Legacy backup migration on load
- Domain docs: `CONTEXT.md`, ADR 0001, `docs/design/program-abstraction.md`

#### UI/UX evaluation

| Element | UI | UX |
|---------|----|----|
| `#programMeta` card | Chips + editable fields | Program feels like first-class object |
| Status chips | Color-coded badges | At-a-glance program health |
| Adherence `N/M days this week` | Numeric chip | Concrete weekly accountability |
| Volume compliance chip | 7-day rolling | Links plan to execution |

**Weaknesses:** “Untitled program” doesn’t look editable. Chip labels (“Rebuilding”) lack inline explanation.

**Assessment:** Grade A- for program identity. Foundation for PR #51 mesocycle lifecycle.

---

### PR #28 — Wave 3: program abstraction fixes

**Merged:** July 2026  
**Contribution:** Plans 025–028. Simulation: 116 checks, 0 failed.

| Plan | Fix | UI/UX impact |
|------|-----|--------------|
| 025 | Chip refresh on meta edit | Week chip updates without tab switch — prevents stale UI |
| 026 | Import meta semantics | Shared program adopts name only, not sender’s lifecycle clock |
| 027 | Single-pass program signals | Consistent volume/status between Stats and Program |
| 028 | Log context line | `#logContext` shows program name + week on Log tab |

**Live-tested:** Log eyebrow `UNTITLED PROGRAM · WEEK 1 OF 6` confirmed.

**Assessment:** Invisible correctness fixes plus high-value context surfacing on Log. Grade A-.

---

### PR #29 — Simulation speedup

**Merged:** July 2026  
**Contribution:** ~2.7× faster `test/simulation.mjs`.

**UI/UX impact:** None directly. Faster CI feedback loop (PR #31).

---

### PR #31 — GitHub Actions simulation CI

**Merged:** July 2026  
**Contribution:** `.github/workflows/simulation.yml` — `node --check`, static server, Playwright simulation on every push/PR.

**UI/UX impact:** None directly. Prevents regression of 116+ behavioural checks.

---

### PR #51 — Integrate all phases (P1–P19)

**Merged:** July 2026  
**Contribution:** Full phased roadmap integration.

#### Phase map

| Phase | PRs | Features |
|-------|-----|----------|
| 1.1 Session deltas | P1–P3 | Delta engine, finish toast + history summary, log preview + stats table |
| 2 Onboarding + mesocycle | P4–P9 | Schema, program generation, 8-step onboarding, week X of Y, block review, next-block strategies |
| 3 Analytics upgrade | P10–P16 | Stats segments, This Week, Strength/Volume dashboards, PR timeline, Attention upgrade, Review tab |
| 4 Command + voice | P17–P19 | Parser, command bar apply, voice wrapper + Settings toggle |

**Assessment:** Successfully layers coaching on PRs #2–#28 without sixth nav tab. Stats is dense (five segments + Dig deeper) but logically structured. See Section 4 for per-feature detail.

---

## 4. Feature-by-feature UI/UX evaluation (current product)

### 4.1 Session deltas (P2 / P3) — PR #51

**What it is:** Compares each lift to the previous session — improved / flat / regressed / stalled / new.

#### Surfaces

| Surface | Presentation | UI assessment | UX assessment |
|---------|--------------|---------------|---------------|
| **Log tab** | Dim gray `vs last: +0.5 e1RM` below “Last:” line | Correctly secondary; doesn’t compete with inputs | Live feedback while drafting reduces uncertainty |
| **Finish toast** | Orange: `Workout logged — 1 set salvaged. PR: Dumbbell bench press 22.5 kg. 1 improved.` | High contrast, celebratory | Immediate gratification; combines confirmation + PR + delta |
| **History cards** | Orange highlight on improved top set (`22.5×10` vs `20×10`) | Scannable at a glance | Visual comparison across sessions |
| **Stats → Dig deeper** | “Recent session deltas” table | Fits advanced analytics tier | Power-user audit trail |

#### Strengths

- Progressive disclosure: Log preview → toast → History visual → stats table
- Orange = positive change consistent with app accent
- Toast PR callout adds achievement layer

#### Weaknesses

- `& new` shorthand on History cards is cryptic
- History relies on color alone for improvement — no explicit “1 improved · 0 flat” line
- Log preview uses e1RM jargon without glossary link
- No visual treatment for regressed or stalled lifts in History

#### Recommendations

- Replace `& new` with “1 new lift”
- Add explicit delta count line on History cards
- Link “e1RM” to glossary on Log tab
- Add cool/red treatment for regressed lifts

---

### 4.2 Onboarding wizard (P6) — PR #51

**What it is:** 8-step full-screen flow for first-run (`!onboarded && log.length === 0`) and Settings → “Create new program.”

#### UI

- Full-screen `#onboarding` view
- Step counter: “Step X of 8”
- Large single-choice cards with orange border on selection
- Back (steel) / Next (forge orange) footer
- Final step: generated split grouped by day

#### UX

| Aspect | Rating | Notes |
|--------|--------|-------|
| Visual design | Strong | Generous whitespace, clear hierarchy |
| Flow logic | Strong | Goal → experience → schedule → split → equipment → priorities → length → review |
| Discoverability | Good | First-run auto; Settings re-trigger works |
| Cognitive load | Medium | 2–3 choices per step; plain language |
| Friction | Medium | 8 steps; no skip; read-only review |

#### Weaknesses

- No progress bar (only step counter)
- Optional steps don’t explain skip behavior
- Review is read-only — no inline tweak before save
- No “skip to manual program” for power users
- “SAVE PROGRAM” doesn’t indicate immediate program start

#### Recommendations

- Add thin progress bar
- Allow skip from Step 1 for manual program path
- Make review fields lightly editable
- Explain optional step consequences

---

### 4.3 Mesocycle lifecycle (P7) — PR #51

**What it is:** Week tracking, program status, End block entry point.

| Element | UI | UX |
|---------|----|----|
| Log context eyebrow | `UNTITLED PROGRAM · WEEK 1 OF 6` | Always-visible context |
| `#logBlockBanner` | Block prompt (hidden until triggered) | End-of-block awareness |
| Program status chip | Orange “Rebuilding” | Meaning not explained inline |
| Start date + weekly stats | `1/4 days this week · 1/1 ready to add · 20 volume (7D)` | Actionable program health |
| End block button | Prominent on Program tab | Correctly gated behind confirm |

#### Weaknesses

- Week banner not tappable — missed link to Review
- `20 volume (7D)` assumes volume literacy
- End block available at week 1 — review modal mostly zeros

#### Recommendations

- Tap week banner → Stats Review segment
- Gate or soften End block before final week
- Tooltip on status chip

---

### 4.4 Block review modal (P8) — PR #51

**What it is:** Post-block summary with recommendation and five next-block strategies.

#### UI

- `role="dialog"` modal: “Block review”
- Three stat groups: Sessions, Lifts (improved/flat/stalled), Volume (% planned)
- Narrative recommendation + explanatory note
- Five strategy buttons + Close

#### UX

| Strength | Weakness |
|----------|----------|
| Confirm gate before review | Native `confirm()` — not branded |
| Close without choosing strategy | Five equal-weight buttons — no recommended highlight |
| Self-explanatory strategy labels | Strategy consequences not previewed |
| Concrete stats (1/44 sessions) | Mostly zeros at week 1 — feels premature |

#### Strategies (P9)

1. Repeat same program
2. Repeat with swaps
3. Increase volume
4. Reduce volume
5. Start from onboarding again

**Not fully tested:** Strategy execution (modal closed to preserve data).

---

### 4.5 Stats segmented shell (P10) — PR #51

**What it is:** Five segments inside Stats without sixth nav tab.

| Segment | Default | Content |
|---------|---------|---------|
| Overview | Active | This Week, Attention, metrics, Dig deeper |
| Strength | — | Per-lift dashboard table |
| Volume | — | Muscle volume audit (planned vs 7d/28d) |
| PRs | — | Global PR timeline with filters |
| Review | — | Live block snapshot + coaching narrative |

#### UI/UX

**Strengths:** Avoids nav bloat; Overview as default preserves familiar path; segment names match mental models.

**Weaknesses:** Five segments + Dig deeper sub-sections = deep hierarchy; no first-visit descriptions; sparse data makes some segments feel heavy early on.

---

### 4.6 “This Week” card (P11) — PR #51

| Metric | Example | Purpose |
|--------|---------|---------|
| Days logged | `1 / 4` | Adherence |
| Hard sets | `1` | Effort volume |
| Lifts improved | `0` | Progress quality |
| Ready to add | `1` | Actionable count |
| Status | `Under target` | Weekly health label |

**Strengths:** Compact; mixes quantity and quality; honest status.

**Weaknesses:** “Under target” threshold opaque; “1 hard sets” grammar; metrics not tappable.

---

### 4.7 Attention board (P15) — PR #51

**Upgrade from PR #10:** Six signals with “why” copy per group.

| Section | Example | Behaviour |
|---------|---------|-----------|
| Ready to add | Dumbbell bench press chip | Tap → chart in Dig deeper (if logged) |
| Untested | Multiple exercise chips | Tap → toast “Log this lift” |

**Strengths:** Action-oriented grouping; “why” copy teaches progression logic.

**Weaknesses:** Many untested chips create noise on fresh program; untested should jump to Log day; only first item’s `why` shown per group.

---

### 4.8 Strength dashboard (P12) — PR #51

Columns: Exercise, Latest, Best e1RM, Δ block, PRs, Signal.

**Strengths:** One row per lift; Signal aligns with Log recommendations; block delta ties to mesocycle.

**Weaknesses:** Read-only; sparse with little data; “Δ block” needs domain knowledge; Signal not tappable.

---

### 4.9 Volume dashboard (P13) — PR #51

Columns: Muscle, Planned, Completed 7d, Completed 28d, Status.

**Strengths:** Surfaces under-training; dual windows; complements Program planned volume.

**Weaknesses:** All “Low” in same gray; no progress bars; not tappable; “Low” threshold unexplained.

---

### 4.10 PR timeline (P14) — PR #51

Filters: All, Load, Reps, e1RM, Program.

**Live-tested:** Reps filter → empty state; e1RM filter → one entry. Filters work.

**Weaknesses:** Duplicate date lines; entries not tappable; “Program” filter meaning unclear.

---

### 4.11 Review tab (P16) — PR #51

Block progress card + coaching narrative (reuses `buildBlockReview`).

**Strengths:** In-progress coach without ending block; narrative tone.

**Weaknesses:** Overlaps Block Review modal; no week-by-week breakdown; 0% volume discouraging without framing.

---

### 4.12 Command bar (P17–P18) — PR #51

**Syntax:** `25 x 10 @2` → fills next empty set on active exercise. Confirmation: `Applied: 25×10 @2`.

**Live-tested:** Yes — works correctly.

**Strengths:** Fast for repeat users; works offline; visible in Focus mode.

**Weaknesses:** Syntax not explained; target exercise unclear; zero discoverability for new users.

---

### 4.13 Voice input (P19) — PR #51

Hidden until Settings → “Enable voice input.” Mic button (🎤) appears next to command input.

**Strengths:** Opt-in respects privacy; Settings includes browser-provider disclosure.

**Weaknesses:** Buried in Settings; emoji may render inconsistently; speech not tested; no listening animation observed.

---

### 4.14 Focus mode — PR #13

List/Focus toggle on Log tab. Focus shows single exercise with larger inputs.

**Live-tested:** Yes — works; command bar remains; no exercise picker in Focus.

**Recommendation:** Add prev/next exercise chevrons; persist mode preference.

---

### 4.15 Rest timer — PR #13

`#restBar` in header. Configured in Settings (default 120s, 0 = off).

**Not live-tested:** Countdown behaviour. Addresses #1 persona request.

---

### 4.16 RIR effort mode — PR #17/22

Settings → Easy / Hard / Max replaces numeric RIR inputs with three buttons.

**Live-tested:** Yes — clean switch.

**Gap:** No mapping legend (Easy ≈ 3+ RIR).

---

### 4.17 Warmup sets — PR #17

Tap set number chip → “W” badge. `warmup: true` on row; excluded from recommendations, stats, hard-set volume.

**Not live-tested.** High value; zero discoverability.

---

### 4.18 Exercise substitution — PR #17

“Use:” picker per exercise card. Rows carry `performedName`; stats roll up under program slot `exerciseId`.

**Not live-tested.**

---

### 4.19 Import merge — PR #17

`#importChoice` modal: Merge / Replace all / Cancel. Merge unions by session id; device wins on collision.

**Not live-tested.**

---

### 4.20 Core Log loop (PRs #2, #10, #13)

| Feature | Status |
|---------|--------|
| Heat strips + chips | Present, readable |
| Day tabs | Switch correctly (Day 1 bench → Day 2 squat) |
| kg steppers | Visible on set rows |
| Copy last | Not individually tested |
| Collapse per exercise | Not individually tested |
| Fatigue banner | Not triggered |
| Save meta `Day 1 · 1/18 entered` | Present |
| Finish button in document flow | Confirmed (PR #18) |
| Bodyweight optional field | Present |
| Session notes | Present |
| Glossary terms | Present in Stats lede (`hard set` button) |

---

### 4.21 History (PRs #2, #9, #10)

| Feature | Assessment |
|---------|------------|
| Session cards newest-first | Works |
| EDIT / DELETE buttons | Visible |
| Delta highlighting | Orange on improved sets |
| Every set table | Full ledger below |

---

### 4.22 Program editor (PRs #4, #19, #28)

| Feature | Assessment |
|---------|------------|
| Day-grouped visual editor | Functional; scroll-heavy |
| Program meta card | Good chips; weak name edit affordance |
| Planned weekly volume bars | Clear muscle breakdown |
| Program-only export/import | In Advanced section |
| End block | Tested through confirm + review modal |

---

### 4.23 Settings (PRs #7, #10, #13, #17, #51)

| Feature | Assessment |
|---------|------------|
| Rest timer config | Present (120s default) |
| Units kg/lb | Present; not toggled in test |
| RIR mode radios | Work |
| Voice input + privacy copy | Work |
| Advanced progression dials collapsed | Good disclosure |
| Create new program / beginner program | Both trigger onboarding |
| Export/import/reset | Present in data section |

---

## 5. Cross-cutting analysis

### 5.1 Design system coherence (PR #2 → today)

The iron/ember/quench palette, Plex Mono numerics, heat metaphor, and card/seg/chip components survive intact through PR #51. Onboarding, stats segments, command bar, and block review modal all use the same vocabulary. **No visual regression** from phased integration.

### 5.2 Information architecture evolution

```
June (PR #2):     Log | Stats | History | Program | Settings
July (PR #10):    + Attention board, fatigue, hard sets
July (PR #13):    + Focus mode, rest timer, glossary, Dig deeper
July (PR #19):    + Program meta, Log context
July (PR #51):    + Onboarding view, Stats 5 segments, command bar, block review
```

Five bottom-nav tabs preserved. Complexity moved into collapsible sections and segmented controls — correct tradeoff per roadmap guardrails (no sixth tab; protect Log-tab speed).

### 5.3 Persona feedback resolution tracker

| Persona request | Addressed by | Remaining gap |
|-----------------|--------------|---------------|
| Rest timer | PR #13 | Discoverability / auto-start UX |
| Session mode (one exercise) | PR #13 Focus mode | No exercise picker in Focus |
| Lbs/kg toggle | PR #13 | Display conversion clarity |
| Warmup vs working sets | PR #17 | Discoverability |
| Faster set entry | PR #10 steppers, PR #51 command bar | Command syntax opaque |
| Per-set commit | PR #13, PR #16 | vs bottom “Finish workout” |
| Stats cross-exercise nonsense | PR #8 (reframed PR #9) | Resolved |
| Program identity | PR #19, #28, #51 | Name edit affordance |
| Mesocycle lifecycle | PR #51 P7–P9 | Early End block UX |
| Cloud sync | Not built | By design (local-first) |
| Social/gamification | Not built | By design |
| AI chat coach | Not built | By design |

### 5.4 Accessibility

| Good practices observed | Gaps |
|-------------------------|------|
| `role="tablist"` on day tabs, stats segments, volume window | Focus rings not verified in testing |
| `aria-label` on sections and inputs | Icon-only controls on Program editor |
| `aria-live="polite"` on toasts, rest bar, block banners | Color-only delta encoding in History |
| `role="dialog"` on glossary, block review, import choice | Secondary gray contrast may fail WCAG AA |
| Keyboard-operable heat gauge (PR #13) | Command bar syntax help not available to screen readers |

### 5.5 Mobile ergonomics

- All tested screens fit **390×844** without horizontal scroll
- Bottom nav always reachable
- Touch targets generally adequate (buttons, form fields, chips)
- Stats tables may require horizontal scroll with full column set
- Toast placement near bottom nav is tight but functional
- Long Log forms require scrolling (mitigated by Focus mode, not eliminated)

### 5.6 Performance and reliability

- App loads quickly on static server
- No crashes or navigation failures observed
- Tab transitions smooth
- Service worker caching requires hard-reload after asset edits (documented in AGENTS.md)
- IndexedDB mirror (PR #13) adds durability beyond localStorage quota
- CI simulation (PR #31) gates 116+ checks on every PR

---

## 6. Bugs and polish issues

| Severity | Issue | Origin | Surface |
|----------|-------|--------|---------|
| Low | `& new` delta shorthand | P2/P3 (PR #51) | History session cards |
| Low | “1 hard sets” grammar | P11 (PR #51) | This Week card |
| Low | Chart Y-axis “20 20kg” duplication | Pre-#51 | Dig deeper chart |
| Low | Program name doesn’t look editable | PR #19 | Program tab |
| Low | Block review uses native `confirm()` | P7 (PR #51) | End block flow |
| Low | Command syntax unexplained | P17–P18 (PR #51) | Log command bar |
| Low | Voice mic uses emoji not SVG | P19 (PR #51) | Log command bar |
| Low | “Repeat with swaps” strategy label ambiguous | P9 (PR #51) | Block review modal |
| None | Crashes, data loss, broken navigation | — | — |

---

## 7. Priority recommendations

### P0 — Copy and clarity (low effort, high impact)

1. Replace `& new` with “1 new lift” (or full `formatDeltaCounts` text) on History cards
2. Add command bar `?` tooltip with 2–3 syntax examples (`80 x 8 @1`, `100 x 5 @0`)
3. Show RIR effort mapping legend in Settings and on Log when effort mode active
4. Fix “1 hard sets” → “1 hard set” / “N hard sets”
5. Fix chart Y-axis label duplication

### P1 — Discoverability (medium effort)

6. First-run tip for warmup flag (“Tap set number to mark warmup”)
7. Promote voice input tip after first successful typed command
8. One-time coach marks on Stats segments
9. Make program name field visually editable (underline, pencil icon)
10. Explain “Under target” threshold on This Week card (tap for detail)

### P2 — Actionability (medium effort)

11. Attention untested chips → jump to Log tab on correct day
12. Strength / Volume / PR rows → drill down to Log or History session
13. Week banner on Log → open Stats Review segment
14. Highlight recommended strategy in block review modal
15. Attention “ready to add” chips → jump to Log with exercise scrolled into view

### P3 — Session loop (higher effort)

16. Prev/next exercise chevrons in Focus mode
17. Rest timer auto-start on set save with visible countdown; demo in onboarding tip
18. Per-set save states more visually distinct from draft (committed vs in-progress)
19. Branded confirm/dialog component replacing native `confirm()` for End block
20. Collapsible day cards in Program editor to reduce scroll

### P4 — Accessibility (ongoing)

21. Contrast audit on steel-on-iron secondary text
22. Visible focus indicators on all interactive elements
23. Non-color delta cues for regressed/stall states (icon + text, not color alone)
24. `aria-describedby` on command input linking to syntax help

---

## 8. Testing coverage matrix

| Feature area | PR source | Automated (simulation) | Live UI test | Verdict |
|--------------|-----------|------------------------|--------------|---------|
| Heat / progression chips | #2, #10 | Yes | Yes | Pass |
| Visual program editor | #4 | Yes | Partial | Pass |
| Feature spec fixes | #7 | Yes | Inferred | Pass |
| Data integrity | #9 | Yes | Inferred | Pass |
| kg steppers, copy-last, collapse | #10 | Yes | Partial | Pass |
| Fatigue banner | #10 | Yes | Not triggered | Inconclusive |
| Attention board | #10, #51 | Yes | Yes | Pass |
| Rest timer | #13 | Yes | No | Inconclusive |
| Focus mode | #13 | Yes | Yes | Pass |
| Unit toggle kg/lb | #13 | Yes | No | Inconclusive |
| Bodyweight field | #13 | Yes | Visible | Pass |
| Glossary | #13 | Yes | No | Inconclusive |
| Dig deeper collapse | #13, #15 | Yes | Yes | Pass |
| Per-set save | #13, #16 | Yes | No | Inconclusive |
| Warmup flag | #17 | Yes | No | Inconclusive |
| PR ledger | #17 | Yes | Seen | Pass |
| Substitution picker | #17 | Yes | No | Inconclusive |
| Import merge modal | #17 | Yes | No | Inconclusive |
| Effort RIR mode | #17, #22 | Yes | Yes | Pass |
| Non-sticky save button | #18 | Yes | Yes | Pass |
| Program meta + chips | #19, #28 | Yes | Yes | Pass |
| Log context line | #28 | Yes | Yes | Pass |
| Onboarding wizard | #51 P6 | Yes | Yes | Pass |
| Session deltas (all surfaces) | #51 P2/P3 | Yes | Yes | Pass |
| Mesocycle week display | #51 P7 | Yes | Yes | Pass |
| Block review modal | #51 P8/P9 | Yes | Yes | Pass |
| Stats 5 segments | #51 P10–P16 | Yes | Yes | Pass |
| This Week card | #51 P11 | Yes | Yes | Pass |
| Strength dashboard | #51 P12 | Yes | Yes | Pass |
| Volume dashboard | #51 P13 | Yes | Yes | Pass |
| PR timeline + filters | #51 P14 | Yes | Yes | Pass |
| Review tab | #51 P16 | Yes | Yes | Pass |
| Command bar apply | #51 P17–P18 | Yes | Yes | Pass |
| Voice input toggle | #51 P19 | Yes | Partial | Pass |

---

## 9. Conclusion

RepForge’s PR history shows deliberate, persona-informed evolution across six weeks:

1. **PR #2** established a distinctive visual language that still works.
2. **PRs #4, #10, #13** built the core product loop — edit programs, coach progression, log faster.
3. **PRs #7, #9, #17** fixed trust and data integrity — invisible but essential.
4. **PRs #19, #28** gave programs identity that travels to the Log tab.
5. **PR #51** integrated coaching lifecycle (onboarding → mesocycle → analytics → quick entry) without breaking the five-tab shell.
6. **PRs #29, #31** automated regression testing so future UX work ships with confidence.

**Live testing confirms** the integrated product is stable, visually cohesive, and functionally rich. The gap is no longer “missing features” — it is **discoverability, copy clarity, and drill-down actionability** between coaching surfaces (Stats, Attention, deltas) and the work surface (Log).

The product has moved from the persona diagnosis — *“spreadsheet I admire, logger I abandon”* — toward *“coaching system I can use in the gym.”* Rest timer, focus mode, command bar, session deltas, and onboarding are real answers to that critique. The remaining work is teaching users those features exist and connecting insights back to action in fewer taps.

---

## 10. Appendix: PR reference index

| PR | Title | User-facing impact |
|----|-------|-------------------|
| #1 | Set up development environment | Dev/agent docs |
| #2 | Redesign RepForge UI (forge/temperature identity) | Full visual system + heat metaphor |
| #3 | Hypertrophy mechanics review | Domain docs only |
| #4 | Visual program editor | Program tab editor + volume audit |
| #5 | Install Matt Pocock agent skills | Agent tooling |
| #7 | Feature spec, test, and fix pass | 4 UX bug fixes; feature tracker |
| #8 | Fix cross-exercise Stats metrics | Stats framing (later reframed by #9) |
| #9 | Veteran-user review fixes | Data integrity; simulation harness |
| #10 | Progression + UX + hypertrophy upgrades | Steppers, attention, fatigue, hard sets |
| #11 | Persona product feedback report | Research doc |
| #12 | Persona feedback plans | Planning docs |
| #13 | Implement improvement plans 001–016 | Rest timer, focus, units, glossary, IndexedDB |
| #14 | Install improve agent skill | Agent tooling |
| #17 | Wave 2 plans 017–023 | Warmup, PR ledger, substitution, import merge |
| #18 | Non-sticky Finish workout button | Log save button placement |
| #19 | Program metadata abstraction | Program meta card, export v2 |
| #27 | Wave 3 plans (review of #19) | Planning docs |
| #28 | Wave 3 implementation 025–028 | Chip refresh, import semantics, Log context |
| #29 | Simulation speedup | Faster CI |
| #31 | GitHub Actions simulation CI | Automated regression gate |
| #32–#36 | P1, P10, P17 foundations | Engine/parser/shell (pre-integration) |
| #51 | Integrate all phases P1–P19 | Full roadmap integration |

### Related documents

- `docs/persona-product-feedback-report.md` — source persona audits
- `docs/feature-tracker.csv` — 72-feature verification matrix
- `docs/feature_specs.psv` — code-grounded behaviour specs
- `plans/029-phased-roadmap-pr-breakdown.md` — P1–P19 roadmap
- `CONTEXT.md` — domain terms (Mesocycle, Block review, etc.)
- `AGENTS.md` — dev/test instructions for agents

---

*Report generated by Cursor Cloud Agent via computer-use testing, July 6, 2026.*
