# Interaction runtime audit — Apple-design follow-up

This note records the implemented follow-up to the Apple Design audit of PR #232. It supersedes only the conflicting statements in `interaction-runtime-audit.md`; all other decisions in that audit remain unchanged.

## Implemented

- **Focus deck interruption:** the 210ms carry remains visually short, but it no longer locks input. A new swipe can grab the live presentation position, opposite-direction input retargets from the current transform, and repeated same-direction navigation is queued rather than discarded.
- **Bottom-sheet re-grab:** a sheet settling toward rest can be grabbed again from its current on-screen offset. The old animation relinquishes ownership without clearing that presentation value, and the new drag adopts it as its origin.
- **Momentum projection:** sheet dismissal and Focus paging choose their resting state from Apple's exponential projected endpoint (`decelerationRate = 0.998`) and then hand the measured release velocity into the existing spring.
- **Accessibility preferences:** `prefers-reduced-transparency: reduce` replaces dock glass with its opaque material and removes blur; `prefers-contrast: more` strengthens the existing rule/dock-edge roles and makes the dock near-solid. These remain independent of Reduced Motion and of the light/dark theme.
- **Install banner semantics:** the non-modal install banner is exposed as a `region`, not a `dialog`, in the live accessibility tree.

## Explicitly unchanged

The existing page-zoom policy is not changed by this follow-up, per owner direction.

## Verification

`test/apple-design-followup.mjs` mechanically guards the projection model, sheet presentation-value takeover, Focus retargeting, the two additional accessibility media queries, install-banner semantics, and the deliberate non-change to the zoom policy. The existing interaction-runtime contract remains the architecture gate around the Motion layer.
