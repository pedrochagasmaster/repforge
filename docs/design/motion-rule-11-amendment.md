# Plan 064 motion amendment (§8 rule 11)

- **Status:** Approved by the owner on 2026-10-01 as one batched amendment to
  Plan 064 §8 rule 11 (#295, comment 5941747309). Copied from draft PR #297
  at `4317edc`; Plan 064 §8 rule 11 now carries the replacement text in §3.
- **Source:** the standalone motion-design exploration board
  (`/tmp/taurifer-motion-exploration.html`, not part of the repository or the
  release inventory) and the owner interview that walked through its 29 use
  cases.
- **Authorities read:** `DESIGN.md`, `AGENTS.md`, `motion-layer.js`,
  `motion-polish.css`, the [semantic contract](ui-system-semantic-contract.md),
  [Plan 064](../../plans/064-unified-redesign-convergence.md) §5 and §8, the
  [interaction runtime audit](interaction-runtime-audit.md) and its
  [Apple follow-up](interaction-runtime-audit-apple-followup.md), and the
  Direction D implementation spec §8 on `redesign/direction-d`.
- **Effect when approved:** one owner-approved amendment to Plan 064 §8 rule 11,
  applied as a `docs(plan-064)` commit in R0, with the vocabulary and helpers
  landing in R1 and each consumer landing in the slice that owns its surface.

## 1. What the current rule allows

Plan 064 §8 rule 11 limits new motion to four additions: the shelf crossfade
(≤160 ms), the drain-bar transform, disclosure height, and the landing's
scroll-linked proof section if it degrades to static bands without JavaScript
and under reduced motion. Everything goes through `motion-layer.js`, reduced
motion removes all of it, nothing animates to celebrate, and each addition is
recorded in the interaction runtime audit.

The owner's picks keep that discipline but go beyond the four named additions.
Rather than amend the rule case by case, the owner chose one batched amendment.

## 2. Owner picks

"In scope" means the pick is already covered by rule 11 or is unchanged
production behavior. "Amend" means it needs this proposal.

| Case | Surface | Pick | Scope |
| --- | --- | --- | --- |
| T1 | Shelf field selection | C · one outline travels between Carga, Reps and RIR | Amend |
| T2 | Press response | A · existing compression, no rebound | In scope |
| L1 | Set commit | A · existing ≤160 ms acknowledgement | In scope |
| L2 | Ledger open row and correction | A · one outline travels between rows | Amend |
| L3 | Inline rest in the cue slot | B · measured height push with crossfade | Amend |
| L4 | Exercise complete in the shelf | B · completion actions rise 12 px while fading in | Amend |
| D1 | Bottom-sheet drag | A · production projection and springs | In scope |
| D2 | Focus deck swipe | A · production rubberband and projection | In scope |
| D3 | Reorder in the Session sheet | Both production paths: Move buttons with `layoutShift`, drag with @dnd-kit | In scope |
| D4 | Exercise chart scrubbing | A · marker snaps per session and travels | Amend |
| N1 | Dock | A · the selected lens travels; dock structure unchanged | Amend |
| N2 | Top-level views | A · existing 140 ms fade | In scope |
| N3 | Progress tab row | A · the underline travels | Amend |
| N4 | Drill-downs (History, Today row, Program) | A · push from the right | Amend |
| N5 | Today → Focus | Push, the same as the drill-downs | Amend |
| — | Push timing | Interruptible spring with roughly a 220 ms feel | Amend |
| — | Back gesture | Interactive edge swipe on pushed pages, not in Focus | Amend |
| P1 | Why this weight calculation | A · existing disclosure height | In scope |
| P2 | Summary muscles list | A · existing disclosure height | Audit row only |
| M1 | Shelf value on a pad tap | B · directional 6 px, 120 ms | Amend |
| M2 | Summary totals | A · keep the existing 600 ms count ramp; the row stagger stays removed | In scope |
| M3 | Changed targets on Today | C · no emphasis; the verdict mark carries it | In scope |
| C1 | Chart line | A · clip wipe on open; only the new segment on extension | Amend |
| C2 | Chart scope change | B · shared sessions travel; metric changes crossfade | Amend |
| S1 | Persist-retry banner | A · hairline sweep while the write is in flight | Amend |
| S2 | Restored draft on Today | A · notice measures in; CTA relabels | Audit row only |
| O1 | Landing proof | A · stepped reveal on entry, static without JavaScript | In scope (rule 11 condition) |
| O2 | Onboarding choice cards | A · outline plus the existing check growth | In scope |
| O3 | Generated program appears | A · reading-order build, 55 ms apart | Amend, after OG-1 |

The negative controls on the board stay rejected: celebratory commit, CTA tick
state, odometer digits, overshooting counts, orange flash, dock icon bounce,
full-width tab slides, metric morph, inertial scrubbing, lifted choice cards,
PR celebration, parallax header and the breathing rest clock.

## 3. Proposed replacement text for rule 11

> 11. **Motion.** Everything goes through `motion-layer.js`. Reduced motion
>     removes all of it and leaves the state change and its information
>     identical. Nothing animates to celebrate, and orange is spent only within
>     the §8.8 budget. New motion is limited to the following, each recorded in
>     `docs/design/interaction-runtime-audit.md` with its owner and reduced-motion
>     path:
>     - **Training loop:** the drain bar transform; the rest block entering and
>       leaving the cue slot as a measured height change with a crossfade
>       (≤200 ms); the shelf changing job with a crossfade and a ≤12 px rise
>       (≤160 ms); the shelf field outline and the ledger open-row outline
>       travelling with `layoutShift`; the selected field's value changing
>       direction-aware by ≤6 px (≤120 ms). None of these may delay or disable
>       the shelf CTA.
>     - **Navigation:** the dock lens and the Progress tab underline travelling
>       with `layoutShift`; drill-downs and Today → Focus as an interruptible
>       push on the new `navPush` spring; an interactive edge swipe back on
>       pushed pages outside Focus, owned by `motion-layer.js`. The top-level
>       view fade stays as it is.
>     - **Progress chart:** the selected-session marker travelling between
>       discrete sessions; a clip reveal of the line on open and of only the new
>       segment when a session is added; shared sessions travelling on a scope
>       change. A metric change only crossfades.
>     - **Disclosure and system states:** disclosure height on Why, the summary
>       muscle list, the persist-retry banner and the restored-draft notice; an
>       indeterminate hairline only while a durable write is in flight.
>     - **Public and first run:** the landing proof's stepped reveal, static
>       without JavaScript and under reduced motion; the generated program's
>       reading-order build once per generation, subject to OG-1.

## 4. Vocabulary and helpers in `motion-layer.js`

The audit's rule stands: no spring literal at a call site. Most picks reuse
existing names.

| Need | Proposal | Consumers |
| --- | --- | --- |
| Indicator travel | Reuse `layoutShift`. Add one helper, `animateIndicator(el, fromRect)`, a single-element FLIP that retargets from the live transform, beside `animateExerciseReorder`. | T1, L2, N1, N3, D4 |
| Push | New `navPush` entry. Start from `gestureExit`'s constants (k 700, c 53, critically damped) so it lands without overshoot and can be retargeted mid-flight. Kept as its own name because no gesture drives a tapped push. | N4, N5 |
| Edge-swipe back | A third gesture owner inside `mountGestureController()`, beside the sheet and Focus owners, with the same lifecycle: idempotent mount, disposal cancels any run, `pointercancel` never commits. Release uses `projectMomentum` and `nearestSnap`; settle uses `gestureSettle`, commit uses `navPush` seeded with the release velocity. | N4 pages |
| Measured slot height | Reuse `animateDisclosure` semantics (`revealIn` / `revealOut`) on the cue slot, generalised to a content swap rather than open and close. | L3 |
| Short fixed beats | CSS in `motion-polish.css` with reduced-motion entries: the 12 px shelf rise, the 6 px value change, the clip reveal, the landing step reveal, the 55 ms build stagger, and the retry hairline. | L4, M1, C1, O1, O3, S1 |
| Chart coordinate travel | A small interpolation helper over `layoutShift` that rebuilds the step path per frame for the sessions present in both scopes. | C2 |

`window.Motion` stays unreachable from application code. No new runtime
export is needed; the vendored entry file does not widen.

## 5. Constraints each pick must meet

- **L3 height push.** It puts a layout animation on the set path, which the
  audit avoided for the ledger fold. The CTA stays enabled throughout, logging
  during the transition must not queue, and the slot keeps a fixed minimum
  height so the ledger below moves once, not twice. The live region still
  announces only the start and the end of rest.
- **S1 hairline.** This would be the only continuous loop outside the rest
  timer. It runs only while a durable write is in flight, stops on settlement
  or failure, and is replaced by the text label under reduced motion.
- **M1 directional value.** It is conditional on a physical phone check at
  logging frequency; if it reads as busy after thirty taps, the fallback is the
  80 ms crossfade. Record the outcome in the device matrix.
- **N4 and N5 push.** Both views must be mounted during the transition, focus
  lands on the new page heading, and Back from Focus keeps the draft (G-43).
  Telemetry, route state and the view's scroll restoration are unchanged.
- **Edge-swipe back.** In a Safari browser tab the left edge belongs to the
  browser's own history gesture. Enable the in-app edge swipe only when
  `display-mode: standalone` matches, and keep the visible back control as the
  primary route everywhere. Focus is excluded because its horizontal axis
  belongs to the deck.
- **C1 and C2.** The data table stays the accessible alternative and updates
  instantly. A metric change never travels, because the two metrics are
  different quantities on different axes (Direction D §1.6).
- **O3.** The onboarding direction is still open (OG-1). This pick applies to
  whichever direction is selected and does not pre-empt that gate.
- **All picks.** Transform, opacity, clip and measured FLIP only. Every pick
  has a reduced-motion path that jumps to the end state, and each one gets a
  row in the interaction runtime audit before it ships.

## 6. Where each pick lands in Plan 064

| Slice | Picks |
| --- | --- |
| R0 | This amendment as a `docs(plan-064)` commit, once the owner approves it |
| R1 | `animateIndicator`, `navPush`, the edge-swipe owner, the slot-height helper, the CSS beats in `motion-polish.css`, and the audit rows |
| R2 | O1 landing proof |
| R3 | T1, L2, L3, L4, M1, D4, C1, C2, N3, S1, S2 and the reuse of D3 in the Session sheet |
| R4 | O2, and O3 after OG-1 |
| R5 | N4 and N5 push and the edge-swipe back, as part of the transition glue |
| R6 | N1 dock lens, if R1 does not already apply it with the shared components |

## 7. Unchanged by this proposal

The sheet and deck physics, press compression, the ≤160 ms set
acknowledgement, the 140 ms view fade, the summary count ramp, the toast
transitions, the toggle, and every reduced-motion path already in production
stay as they are. The summary's row stagger stays removed, per the owner's
earlier Plan 064 decision; only the count ramp is kept. No palette value, type tier, radius step,
elevation role or control role is added.
