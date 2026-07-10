# Quick Capture

Quick Capture makes set entry the primary interaction. The Log screen opens on a large composer that accepts the existing shorthand (`80 x 8 @1`), while the selected exercise, previous-set suggestions, and current session remain visible around it.

## Interaction model

- The exercise dock sets the composer target. Pointer users can tap a target; keyboard users can move through targets with the dock’s left and right arrow keys or use Alt + Left/Right from the composer.
- An exercise name in the command overrides the selected target. `set 2` targets a numbered set using the existing parser.
- Applying a command writes into the existing draft fields and adds the result to a chronological session feed. The composer clears and retains focus for the next entry.
- Previous working sets appear as reusable tokens. Selecting a token loads its values into the composer without submitting them.
- Detailed load, reps, RIR, warm-up, rest, and substitution controls remain available in a secondary panel. It opens as a bottom sheet on mobile and stays visible beside the composer on desktop.
- Voice uses the same composer and parser. When speech recognition is unavailable, the app keeps focus on the text input and gives a direct fallback message.

## Other workspaces

Stats begins with search and view controls. The existing overview, strength, volume, PR, and review calculations remain intact; search filters the active result set.

History begins with search and presents individual sets as an activity feed. Session edit and delete controls remain attached to session summaries.

## Layout and accessibility

Mobile prioritizes composer, suggestions, exercise switcher, and feed in that order. At desktop widths, composer and feed occupy the left workspace while the session summary and selected-exercise details occupy the right.

Interactive controls retain 44px hit areas where space permits, all inputs have visible or programmatic labels, the detail panel supports Escape, and reduced-motion preferences disable animation and transitions. Existing local storage, IndexedDB mirroring, backup/import, offline service worker, and install behavior are unchanged.

The prototype has no dependencies or build step. The general and maskable icons use the same neutral capture mark; the maskable artwork stays inside the central safe zone.
