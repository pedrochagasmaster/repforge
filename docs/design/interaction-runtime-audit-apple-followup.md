# Interaction runtime audit — Apple-design follow-up

This note records the implemented follow-up to the Apple Design audit of PR #232. It supersedes only the conflicting statements in `interaction-runtime-audit.md`; all other decisions in that audit remain unchanged.

## Implemented

- **Focus deck interruption:** the 210ms carry remains visually short, but it no longer locks input. A new swipe can grab the live presentation position, opposite-direction input retargets from the current transform, and repeated same-direction navigation is queued rather than discarded.
- **Bottom-sheet re-grab:** a sheet settling toward rest can be grabbed again from its current on-screen offset. The old animation relinquishes ownership without clearing that presentation value, and the new drag adopts it as its origin.
- **Momentum projection:** sheet dismissal and Focus paging choose their resting state from Apple's exponential projected endpoint (`decelerationRate = 0.998`) and then hand the measured release velocity into the existing spring.
- **Accessibility preferences:** `prefers-reduced-transparency: reduce` replaces dock glass with its opaque material and removes blur; `prefers-contrast: more` strengthens the existing rule/dock-edge roles and makes the dock near-solid. These remain independent of Reduced Motion and of the light/dark theme.
- **Install banner semantics:** the non-modal install banner is exposed as a `region`, not a `dialog`, in the live accessibility tree.
- **Runtime launch cost:** Motion remains launch-ready because it owns sheet/focus interruption immediately after boot. The larger dnd-kit bundle is split into a tiny synchronous bootstrap plus a deferred heavy runtime. Both remain generated, pinned and precached; the heavy runtime is served cache-first from the service-worker shell. `test/runtime-budget.mjs` guards both the loading topology and gzip budgets.
- **Physical-device validation gate:** `interaction-runtime-device-matrix.md` turns the remaining feel/ergonomics questions into explicit C2/C3/C5/C6 hardware checks using the repository's existing manual-matrix taxonomy. PR #232 remains draft until those cells are recorded.

## Explicitly unchanged

The existing page-zoom policy is not changed by this follow-up, per owner direction.

## Verification

`test/apple-design-followup.mjs` mechanically guards the projection model, sheet presentation-value takeover, Focus retargeting, the two additional accessibility media queries, install-banner semantics, and the deliberate non-change to the zoom policy. `test/runtime-budget.mjs` guards the runtime split, offline availability and payload ceilings. The existing interaction-runtime contract remains the architecture gate around Motion, dnd-kit and native dialog usage.

Physical-device checks are intentionally not represented as automated success: their evidence belongs in `interaction-runtime-device-matrix.md`, because CI cannot validate touch feel, one-handed edge ergonomics, or real VoiceOver/TalkBack pacing.
