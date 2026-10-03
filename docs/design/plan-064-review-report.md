# Plan 064 R7 review report

**Status:** fixes integrated on `redesign/unified-convergence` (PR #295). Reviewed head: `d5ae5d8`.

R7 was the independent review of the converged redesign. Three reviewers worked from that head, with no access to the build's rationale:

- **J: journeys and semantics.** Keyboard and screen-reader journeys through every route, EN and PT, plus offline.
- **V: visual and accessibility matrix.** Every catalog screen at 320 × EN/PT × light/dark; 360 and 430 in part; 200% text; reduced motion; forced hover, active and focus states on 370 controls.
- **C: contracts.** The test inventory, removed assertions, dead code, CSS, i18n and tokens, the generated files and the docs.

This report gives every finding a stable ID, its severity, and how it was closed: the commit on the integration branch, and the assertion that now guards it. A finding is closed only when that assertion exists and failed before the fix, or when the reason it needs none is given.

**Owner decisions** made during R7 are recorded on #295:

- Comment 5965828337:
  - V-03: the summary hero stays 30px.
  - V-04: the landing chart is cropped, and its alt text describes Best e1RM.
  - V-17: one 16px CTA label size.
  - V-12: a neutral pain note.
- Comment 5948281184 decided large text earlier, and V-02 follows it.

## Totals

| Reviewer | Blocker | Major | Minor | Note | Closed | Open |
|---|---|---|---|---|---|---|
| J | 1 | 14 | 8 | 5 | 23 findings; N-1 | N-2 to N-5 (notes, below) |
| V | 1 | 5 | 12 | 3 | 17 findings | V-16 (deferred, below); N-1 to N-3 (notes) |
| C | 0 | 0 | 8 | 4 | 8 minors; C-09, C-10 | C-11, C-12 (notes) |

Both blockers are closed.

## J: journeys and semantics

| ID | Sev | Finding | Closed by | Guard |
|---|---|---|---|---|
| J-01 | blocker | Two unnamed, clipped checkboxes were in the Settings tab order. | `bbfa66c` | `accessibility`: every Settings tab stop is named and visible |
| J-02 | major | Discarding or clearing a session left the rest clock running. | `6e633b8` | `workout-day-context-discard`: no running rest, bar or announcement after discard |
| J-03 | major | Focus dropped to `<body>` after Log set and after each correction step. | `2613e89`, `80ebfcb` | `focus-mode`; `workout-draft-storage` §7 (20/20) |
| J-04 | major | Early finish and its Cancel dropped focus. | `5a6d876` | `focus-session-sheet` |
| J-05 | major | Build's Open editor left focus on `<body>`. | `261dd0a` | `journeys-in` J6 |
| J-06 | major | History Edit opened scrolled down, with focus off-screen. | `411f52e` | `history-edit` |
| J-07 | major | A custom lift with a PT name read under two names. | `a4c8c8a` (display only; nothing written) | `exercise-display-name` |
| J-08 | major | Editor add, replace, remove and custom save left focus on `<body>` and announced nothing. | `7f11074` | `exercise-picker` |
| J-09 | major | Settings open and Back left focus on `<body>`. | `a540871` (routing, orchestrator), `1ca151e` | `journeys-out` |
| J-10 | major | The exercise-page chart toggles dropped focus. | `a61d912` | `progress-navigation` |
| J-11 | major | Edge-swipe back missed three of the four pushed pages. | `9613f29` | `motion-integration`: a swipe from x=4 commits on all four pages |
| J-12 | major | The live step label re-announced on every answer. | `b668c52` | `program-entry-a11y`: zero writes while answering |
| J-13 | major | The PT editor status read "Day 1, Day 2". | `b1822a6` | `program-entry-browser`, PT Build editor |
| J-14 | major | The editor's aria names were hard-coded in English. | `3452616` | `program-editor-text-fields`, PT mount |
| J-15 | major | The RIR glossary could not be reached or closed by keyboard. | `b7b3a78`, `90f4c08` (inventory) | `focus-mode`; `check-ui-system` |
| J-16 | minor | Entry screens exposed their title twice. | `2bf3300` | `program-entry-a11y` |
| J-17 | minor | The legacy `#heatGauge` button was exposed to assistive technology. | `53a0995` | `accessibility` |
| J-18 | minor | "＋ + Add day" showed two pluses. | `ebf99f8`, `151c7e1` | `program-editor-text-fields`, EN and PT |
| J-19 | minor | Library Back from the picker left focus on `<body>`. | `765988b` | `library-flow` |
| J-20 | minor | The tablist segments had no keyboard model. | `ec17e92` (`#statsSeg` is now WAI tabs; the scope, period, filter and day segments are toggle groups), `af68bc5`, `543c426` (inventory) | `progress-navigation`; `accessibility` |
| J-21 | minor | An empty custom name was reported by toast only. | `634931a` | `exercise-picker` |
| J-22 | minor | An edge-swipe commit lost the opener's focus. | `003ba8a` | `motion-integration` pages section |
| J-23 | minor | The Focus name heading was named by its button. | `803732c` | `focus-mode` |
| N-1 | note | History delete is an in-page alert, not `confirm()` as the docs said. | `fb30a91` (docs) | — |
| N-2 | note | Six reachable native `confirm()` calls remain. | open | Backlog row "Remaining native confirmations" |
| N-3 | note | The dock ring measures 1.03:1 on the half that straddles a same-colour band boundary (pointer only). | open | Accepted: the other half carries the ring. |
| N-4 | note | Heading levels: the main tabs use h2 with no h1, while Settings, the library and the editor use h1. No level is skipped. | open | No change. |
| N-5 | note | A refused setup link leaves `repforge_setup_v1` set. | open | Backlog row "Refused setup-link cookie" (ADR 0007 decides; out of R7 scope) |

## V: visual and accessibility matrix

| ID | Sev | Finding | Closed by | Guard |
|---|---|---|---|---|
| V-02 | blocker | At 200% text, the Focus "Log set" CTA was clipped or off-screen at 320, 360 and 390. This broke the recorded large-text decision. | `05c8851`, `ff2a399`, `99ab616` | `focus-geometry` §2: 9 Focus states × 320/360/390 × EN/PT at 200% (54 frames, all red at base). Checks that the CTA is whole above the safe area, the value stays on one line, the card does not overflow and nothing overprints. |
| V-01 | major | The CTA arrow was `--accent` on the parchment CTA in dark, at 2.05:1. | `3b2e283`, `b2b08fe`, `1703592` | rendered-role mark contrast ≥ 3:1 in both themes |
| V-05 | major | At 320×568 the Focus header was clamped, the name scrolled away, and the rest block was squeezed. | `00b9ef8`, `6247ace` | `focus-geometry` §2b; the new heading-clamp gate in `check-ui-system` |
| V-06 | major | The early-finish confirm foot was off-screen. | `5864c33`, `99ab616` | `focus-session-sheet` (10 frames, red at base) |
| V-08 | major | The landing proof rail buttons were 40×44 at 360. | `92f35be` | `landing-variants`: every button 44×44 at 320 and 360 |
| V-09 | major | The exercise chart at PT 200% scrolled sideways, and its figures overprinted. | `8915ab5` | `progress-evidence` |
| V-10 | minor | Nine D screens lacked 320 and 200% frames. | `d7bf786` plus the 45 captured frames | catalog manifest, `check-ui-screens` |
| V-03 | minor | The summary hero is 30px, but the contract said 34px. | `09fbb7c` (owner decision: 30px) | `ui-system` token contract |
| V-04 | minor | The landing chart rendered at 0.31–0.47 scale, and its alt named the wrong metric. | `369c46a`, `da02472` (owner decision: crop) | `landing-variants`: effective scale ≥ 0.75 at 360 and 390 |
| V-07 | minor | "＋ + Add day" | = J-18 | — |
| V-11 | minor | The History title overlapped the search button at PT 200%. | `cf6dc64` | `history` |
| V-12 | minor | The onboarding pain note and the hub guide cue used accent. | `8289283` (owner decision: neutral) | `check-rules-only --onboarding` reports 0 for both |
| V-13 | minor | Smooth `scrollIntoView` ignored reduced motion. | `c4034dd` | `motion-integration` |
| V-14 | minor | "1 sessions" / "1 sessões" | `754fc24` | `history`: count forms, EN and PT, n = 1 and 2 |
| V-15 | minor | Pseudo-element transitions escaped reduced motion. | `9f58e4b` | `motion-integration` checks computed durations on pseudo-elements |
| V-17 | minor | Onboarding CTA labels were 18px; the app's are 16px. | `7ca6dd4`, `027485a` (owner decision: 16px) | rendered-role CTA size in every catalog state |
| V-18 | minor | Words were set in Plex Mono on the onboarding review meta lines. | `8154cd3` | `ui-system` |
| V-16 | minor | 628 off-scale spacing groups; nothing enforces the scale. | deferred | See "Deferred". |
| N-1–N-3 | note | 320 PT 200% page scroll on four screens predates main; the note sheet has no band close; main's session-map ellipsis is fixed. | — | Pre-existing or already fixed. |

## C: contracts

| ID | Sev | Finding | Closed by | Guard |
|---|---|---|---|---|
| C-01 | minor | `workout-draft-storage` §7 was flaky: Retry restored focus to a dormant input. | `2613e89` | §7 passes 20/20 |
| C-02 | minor | Dead production code. | `55e83ed` (`pushRoute` kept: it is R5 glue) | — (a sweep would need an allowlist of 41 wrappers; recorded in the commit) |
| C-03 | minor | Dead CSS selectors; `vendor-runtimes` pinned a dead class. | `f74d6da` (33 classes) | `vendor-runtimes` pins `.ledgerline.is-fresh` |
| C-04 | minor | 64 orphaned i18n keys. | `7645e5f` (69 keys) | `i18n` |
| C-05 | minor | Unread tokens. | `b2f6328`, `09fbb7c` | `ui-system` pins that they stay gone |
| C-06 | minor | `.impeccable/design.json` was stale. | `52a3a2c` (deleted; nothing read it) | — |
| C-07 | minor | Plan 064 L-06 said "five exits". | `fb30a91` | — |
| C-08 | minor | The install-modes ethos contrast assertion was removed without replacement. | `d2e8f15` | `install-modes` ethos ≥ 4.5:1 in EN, PT and at 200% |
| C-09 | note | Legacy-writer fixtures serve the old shell; this was not documented. | AGENTS.md (this change) | — |
| C-10 | note | N01/N02 were still marked OPEN. | `fb30a91` | — |
| C-11 | note | Pre-existing: a missing splash, unreferenced fonts, a stale pref. | open | Outside Plan 064. |
| C-12 | note | A state-lane test injects the preview line into `index.html` while it runs. | open | See I-4. |

## Found during integration

These were not in any review. They surfaced while integrating the fix packets, and each is closed.

| ID | Finding | Closed by |
|---|---|---|
| I-1 | `simulation.mjs` discard watcher raced a later question. The `#draftDiscardSheet` element is reused, so a waiting locator click aimed at a closing question could answer the next one. This failed CI twice on `0854832`. | `ff6d123`: the watcher answers in one page step (3/3 local passes) |
| I-2 | The check-ui-system shards called the Progress tabs and toggle groups roleless after J-20. | `543c426` (inventory) |
| I-3 | `check-ui-system` forced `:focus-visible` on a quiet hand-off target. Such a target draws no ring after a tap until a key is pressed. | `90f4c08`: the gate clears the marker first, as a key press does |
| I-4 | A preview-injected `posthog-config` line was committed while a gate was still serving the worktree. | `4d367dd`; the orchestrator now checks `index.html` before every shell commit |
| I-5 | The Build editor frames captured the new "Exercise added." toast over the editor. | The scenario lets the toast's lifetime end before capture. |

## Deferred, with reasons

- **V-16, a spacing-scale gate.** A rendered check would need triage of 628 groups and a per-selector allowlist; a static check cannot see computed layout. That is a separate piece of work, not a fix, and the owner decides whether it is wanted. Cost notes are in the R7d hand-back.
- **Onboarding accent uses outside V-12.** `check-rules-only --onboarding` lists 108 (light) and 153 (dark) other uses: the landing orange band, the segbar's current segment, group labels, `entry__new`, warn marks. These are existing budget questions for OG-8, not regressions.
- **Session summary at PT 200%.** `vrow__num` ends at 406 > 390 inside an overflow container (the page does not scroll). Observed by R7c on a new frame. It predates R7, and it is recorded for OG-8.

## Behaviour to read at OG-8

- **First-use guides on short screens.** The first-set and focus-utilities guides are hidden on screens shorter than 600px; clipped, they read worse than absent. They keep their stored state, so they appear on a taller screen. At large text, a guide also gives way to a recovery banner. (R7c, V-02.)
- **The bottom safe area is reserved twice.** `main` subtracts it and the shelf pads it again, so on a real iPhone the Focus CTA sits about 34px higher than it needs to. This was left as is: the catalog has no inset to prove a change.
- **Quiet hand-off focus.** After a tap, focus moves to the next control without a ring, and the first key press shows it.
- **The CTA arrow is ink in both themes** (V-01), as on the landing.
