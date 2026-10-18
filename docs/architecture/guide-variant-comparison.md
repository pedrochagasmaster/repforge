# Taurifer guide comparison: A versus B

Prepared 18 October 2026, 20:20 UTC. Status: protocol ready; comparison NOT EXECUTED; winner NOT SELECTED.

## Decision and scope

The user's latest instruction is **“Test both and choose the best one”**, received 18 October 2026 at 20:20 UTC, in reply to full-background dimming versus keeping the explained control bright but unclickable until the guide closes. The user delegated the final design selection to comparative testing. **There is no remaining user-preference question.** Older L03 wording requiring the user to choose a highlight style is superseded for this evaluation.

App execution remains blocked by coding usage. This document uses existing evidence and defines the future comparison; it does not certify execution, accessibility, current-head behavior, or a winner. Evaluation and selection authorization does not itself decide feature intake into #448 versus a separate native follow-up, resolve the separate #441 hold, or authorize merge/deployment.

Target supplied for this comparison: `pedrochagasmaster/repforge`, branch `refactor/agent-first-integration`, latest reported SHA `77dd8ca65e02e7a5de5a6effd9b87469ec038b65`. Pin and verify the actual test SHA before executing. The older source inspection below concerns `959c037b33d2623ff7a218f2f817bdae813112b7`; do not silently transfer its conclusions to the newer SHA.

## Controlled variants

- **A — centered/dim:** centered modal, entire background dimmed, no anchor cut-out. Background remains inert.
- **B — anchor/bright/inert:** the explained control remains undimmed through an anchor cut-out but is still inert; place the same modal where it fits without obscuring the explained control. Use centered/full-dim fallback when the anchor is absent, off-screen, or there is insufficient usable room.

Hold everything else constant: exact guide title/body/action wording and translations, font/size, dialog styling, dismissal semantics, eligibility/version state, focus behavior, persistence, first-tap interception/replay, app data, viewport, device/browser, theme, zoom, reduced-motion preference, animation settings, and shared native modal/action ownership. One “Got it” action in both. No variant-specific rewritten copy, extra buttons, or relaxed test thresholds.

Use one controlled implementation with a test-only A/B switch, or two revisions differing only in the presentation under comparison. Archive the diff. Do not compare old #435 against current #448 as if architecture and behavior differences were presentation effects.

## Existing evidence, with limits

1. [#435](https://github.com/pedrochagasmaster/repforge/pull/435) proposes modal guides, first-tap held replay, and Q1's bright/inert anchor. The historical inspection recorded head `7c0c438c8f65`.
2. Its [guide-modal job](https://github.com/pedrochagasmaster/repforge/actions/runs/39098232613/job/117589041141) failed the **dark Progress, 375 × 667** anchor-undimmed assertion: dialog-open luminance **55.71**, bare-anchor luminance **58.90**. Diagnostic replay passed but did not replace the red initial gate. This is a mandatory reproduction target, not evidence that A is better than B. No matched A trial exists in this record.
3. Its [catalog job](https://github.com/pedrochagasmaster/repforge/actions/runs/39098232613/job/117589041077) failed shard 3/6 verification. Classify/fix this independently; do not score infrastructure or inventory failures as visual superiority.
4. At the older inspected native head, [guides.js](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/settings/guides.js#L60) still constructed `aside.guide-cue`, while [geometry.js](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/focus/geometry.js) budgeted inline-guide space. Extraction did not establish modal adoption. Reinspect the current native owners before preparing trials.
5. Existing #425/#435 decision-record disagreement is historical context, not a reason to ask for the same preference again after the explicit test-and-choose instruction. Preserve provenance, then record the newly evidence-backed selection.

Source records read for this protocol: `pr-intake-reconciliation.md`, especially “#435: modal guides, first-tap replay and anchor cut-out”; `phone-acceptance-checklist.md`, P12 and L03. These are earlier snapshots, not live current-head results.

## Paired comparison matrix

Run each condition on A and B from identical reset data and guide state. Alternate A/B order to reduce familiarity effects. First capture the unobscured anchor reference at the same state, theme and scale. Record exact CSS viewport, visual viewport, DPR and browser/OS; do not substitute screenshot pixel dimensions for viewport dimensions.

| Case | Conditions | Required observation |
| --- | --- | --- |
| C1 | Progress, 375 × 667, dark, normal text | Reproduce historical failure; paired bare/open anchor pixels and panel fit. |
| C2 | Progress, 375 × 667, light, normal text | Same content and anchor; compare context visibility without losing panel readability. |
| C3 | First-set field and pad, narrow portrait, both themes | Held tap replay exactly once; no input leakage to bright/dim background. |
| C4 | Narrow portrait at 200% text, both themes | Full text and “Got it” reachable; readable wrapping, no clipping or required horizontal scroll; usable internal scroll where needed. |
| C5 | Anchor partly outside and entirely outside visual viewport; anchor absent after rerender | B uses deterministic safe fallback; neither variant scrolls/activates hidden content to manufacture context. |
| C6 | Insufficient space around visible anchor, narrow landscape and smallest supported viewport | No anchor/panel overlap when B claims contextual placement; fallback is clean and panel stays usable. |
| C7 | Hardware keyboard, both themes, normal and 200% text | Initial title focus, Tab/Shift-Tab containment, Enter/Space only act on modal controls, Escape and return focus. |
| C8 | Real mobile keyboard open, field context; viewport resize/rotation, both themes | Measure actual visual viewport; guide/action remain reachable without jump loops; no prematurely replayed field action. CSS-only keyboard simulation is insufficient for phone acceptance. |
| C9 | Reduced motion and ordinary motion; scroll/resize while open; close/reopen repeatedly | No jitter, stale cut-out, stranded dim layer or detached listeners; no motion dependency for understanding. |

Smoke every reachable guide in both variants: entry, first-set, focus-utilities, progress, block-transition, backup, install and privacy. Use the matrix above for deeper representative coverage, and expand any failing layout to all affected guides. Live/fresh-device guide checks must use pristine state, not fixtures with dismissal preferences pre-seeded.

## Hard gates: failure disqualifies a variant until repaired and retested

1. **Modal focus/accessibility:** correct dialog name/semantics; title receives initial focus as specified; keyboard focus cannot leave the modal; background content is not actionable through pointer, touch, keyboard or assistive technology. Closing returns focus to a valid intended control even after DOM rebuilding, with a documented safe fallback if it disappeared.
2. **Inertness:** a bright cut-out is visual only. Taps, held touches, double taps, keyboard activation and pointer release cannot trigger its underlying action while the guide is open. Assert state/event counts, not appearance alone. Background stays inert through opening/closing transitions.
3. **Held-tap lifecycle:** first-set does not open merely on Focus arrival. First field/pad action is held, then replayed exactly once after each supported dismissal route; no duplicate mutation or stale-node replay. Test rapid dismissal and re-entry, and capture before/after state plus handler counts. Direct Log set marks the guide completed; no second guide in the same Focus visit.
4. **Shared dismissal/eligibility:** Got it, Escape and supported cancel routes preserve the agreed dismissal/persistence contract. Reload retains dismissal; Settings → Replay works; versions and eligibility match between variants. Existing-modal refusal and teardown/disposal are correct.
5. **Readable, operable layout:** no lost copy/action, unusable clipping, inaccessible overflow, unsafe keyboard overlap or broken 200% text support. Assess actual rendered contrast using the project's applicable oracle; do not silently waive #441.
6. **B's advertised rendering:** visible anchor is genuinely undimmed within the established pixel oracle and tolerance, without undimming unrelated actionable regions. Off-screen/no-room/missing-anchor fallback passes. Investigate timing, rendering and measurement stability for the historical dark failure before considering any threshold change; never relax it just to get a pass.

A gate failure is not automatically a permanent design rejection: identify a recoverable implementation defect, repair within authorized scope, then rerun affected paired cases. Keep the original failed artifacts. If both fail or the evidence is incomplete, report no selectable winner yet.

## Ranking after all hard gates pass

Use matched screenshots/video and concrete observations to score each dimension 0–3 per matrix case. Anchor each score to evidence: 0 unusable (also a gate failure where applicable); 1 material friction; 2 clear with minor compromise; 3 clear with no observed compromise. Do not invent user-study results or infer comprehension speed from static screenshots.

1. **Readability (weight 4):** text/action legibility, scanning order, contrast, wrapping and extra scrolling needed to read the same copy.
2. **Context (weight 3):** how clearly the guide's referenced control can be identified; record visible label/control fraction and whether placement makes the relationship unambiguous. An attractive cut-out alone does not establish better comprehension.
3. **Occlusion (weight 2):** modal/cut-out overlap and loss of relevant surrounding information, especially compact and large-text cases. Report fallback frequency explicitly.
4. **Motion and implementation complexity (weight 1):** visible repositioning/jitter, animation burden, number of fallbacks and placement/listener lifecycle obligations demonstrated by the controlled diff and run. Distinguish perceived motion from source-level complexity.

For each dimension use the mean across paired applicable cases, weighted 4:3:2:1; report the worst case alongside the mean. Score fallback cases as delivered, not as hypothetical successful anchors. Do not let a high average hide an unresolved gate failure.

## Selection rule and result packet

- Select only after both variants have actual matched comparative evidence at the pinned test revision and all relevant common gates have been evaluated.
- If one variant passes all gates and the other still fails after diagnosing/retesting recoverable defects, choose the passing variant with the failing case and limits documented.
- If both pass, choose the higher weighted score, provided the difference has concrete supporting observations and is stable across repeat captures. For unstable/tied scores, compare readability first, then context, then occlusion. If still equivalent, prefer the demonstrably simpler motion/placement/lifecycle implementation. This is a predeclared tie-break, not a present choice of A.
- If neither passes or comparisons remain unreliable, make no winner claim; identify the blocking evidence/action and continue when execution is available. Do not re-open the user's preference question.
- Save exact source/base and variant SHAs/diff, fixture/reset procedure, browser/device/viewport/theme/text scale, commands, timestamps, gate assertions, raw failure logs, matched bare/A/B screenshots, focused interaction video, state/event traces, repetitions and score rationale. Each finding must link to its artifact and case.
- Report the chosen variant, the concrete improvement, any trade-off/fallback frequency, gate results and exact tested revision. Keep test results distinct from final native-intake, final-head CI and physical-phone acceptance.

## L03/P12 reconciliation to apply after testing

L03 now means **execute the authorized comparison and record the assistant's evidence-backed selection**, not ask the user to choose a preference. Record the 18 October 20:20 UTC instruction, actual comparison evidence, selected contract, exact candidate SHA and any remaining scope/contrast hold.

P12 remains conditional on guide feature inclusion in the candidate. Run the comparative protocol for design evaluation, then run P12 acceptance against the single selected contract on the final included candidate. If guides are excluded, P12 is N/A with explicit scope provenance; that does not cancel the authorized A/B evaluation. Neither older branch proof nor this protocol is final #448 acceptance.
