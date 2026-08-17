# Rename to Taurifer, confine the theme to the mark, keep neutral copy

The app shipped as RepForge, a name shared by several other training apps —
enough collisions that the product was hard to search for and impossible to
own. A rename had to change every user-facing surface without touching the
on-device contract: localStorage keys, the IndexedDB name, the service-worker
cache prefix, JS globals, and the GitHub Pages URL under the `repforge` slug
all sit under installed PWAs holding real training data.

Decision (product owner, 2026-08, grilled decision-by-decision): the brand is
**Taurifer** (Latin *taurĭfer*, "bull-bearing", after Milo of Croton carrying
the calf that grew into a bull — progressive overload as myth). The theme
lives **only in the app icon**, a bull-horned T monogram. All copy stays
neutral, functional training language in both English and Portuguese — the
name's origin never appears in user-facing strings. Internal identifiers keep
the `repforge` codename permanently; i18n keys are frozen codenames too, so
`toast.workout_forged` correctly holds "Workout saved".

Themed copy was not rejected in the abstract — it was implemented and then
reverted in the same PR cycle (#129). "Workout carried", the gauge idle label
"graze", "Every bull starts as a calf", and a Latin gloss under the Settings
app name all shipped in review and read as roleplay: they taxed translation
(the metaphor calques badly into Portuguese), aged the copy, and put theme
where users needed plain state. The de-themed strings kept the keys.

Also rejected: keeping the RepForge name (the collision problem stands), and
renaming internal identifiers to match the brand (orphans every install's
data for zero user-visible benefit).

Consequences: the brand/codename split is doctrine — enforcement note in
`AGENTS.md`, full naming-surface inventory plus voice and visual rules in
`docs/brand-guide.md` (the living reference; this ADR records why it exists).
The icon set landed separately (#131) with `icons/icon.svg` as generated
output. Any future re-theming of copy must revisit this ADR first.

Amended by [ADR 0006](0006-first-run-ethos-hero.md): the first-run setup
gate's ethos hero is the theme's second permitted surface. Every other ban
here stands.
