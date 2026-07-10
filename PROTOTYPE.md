# Session Grid

Session Grid is a table-first workout workspace. Exercises are rows, previous performance and suggestions provide context, and sets are aligned editable cells. The interface prioritizes scanning, comparison, and direct manipulation over presentation.

## Log workspace

- The workout uses a native table with scoped column and row headers.
- On desktop, the exercise, previous-performance, and suggestion columns stay pinned while set cells scroll.
- On mobile, Previous performance, Suggested next set, and Entered current values are explicitly separated in a keyboard-operable Details disclosure. Missing history reads “No previous data.” Only exercise and full-width set columns remain in the horizontal table flow.
- Each set cell contains load, reps, RIR or effort, warm-up status, and completion without opening another surface.
- Skip, collapse, warm-up, increment, decrement, and completion controls retain at least 44px touch targets.
- Focus mode renders a single exercise row, removes the generic horizontal-scroll hint, and provides Previous/Next controls to move through the training day. Returning to Grid mode restores the full table.
- Desktop uses a two-pane layout: the grid occupies the main pane and a sticky summary reports exercises, completed sets, entered load, and completion percentage.
- Mobile confines horizontal movement to the grid viewport so the page and bottom navigation remain stable.

## Other workspaces

- Stats presents key values as compact comparison rows with accessible inline sparklines. Detailed chart and table sections remain progressively disclosed.
- History keeps session edit/delete controls and adds a sortable all-set ledger.
- Program exposes each day as an editable grid with direct text, number, reorder, add, and delete controls.
- Settings, onboarding, backup, import/export, and installation retain their existing data behavior.

## Accessibility and resilience

Keyboard focus is explicit and high contrast. Text and controls meet WCAG AA contrast against their surfaces. Interactive controls use 44px minimum targets where practical. Motion is disabled under `prefers-reduced-motion`. The canvas chart reads semantic CSS variables, keeping its labels and data marks readable when the visual theme changes.

RepForge remains local-only. Workout data stays in browser storage, exports remain user initiated, and the service worker caches the static application for offline use.
