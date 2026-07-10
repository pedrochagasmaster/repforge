# Exercise Board

This prototype changes RepForge from a sequential form into a spatial workspace. The Log view shows every exercise as a large tile with completion, previous performance, and the next recommendation. A tile opens a focused set-entry inspector; saving a set closes the inspector, updates the tile, and returns keyboard focus to the board. Exercises can therefore be completed in any order without losing session context.

Stats uses the same overview-to-detail pattern: metric tiles open a shared inspector and keep the larger analysis available below. Program exercises are arranged as editable tiles with explicit earlier/later buttons, so reordering works with touch, mouse, and keyboard.

## Interaction architecture

- `renderWorkout()` owns the board overview and derives each tile from program, draft, history, and recommendation state.
- `exerciseEditor()` owns focused set entry without duplicating session data.
- `openInspector()` and `closeInspector()` provide one focus-trapped surface for exercise and metric details, including focus return.
- Draft values remain in `repforge_draft_v1`; completed workouts still persist through the existing IndexedDB and `localStorage` path.
- The compact session bar remains visible above navigation and exposes status plus the final Finish action.
- Program movement uses ordinary buttons and the existing program model; no pointer-only drag behavior is required.

## Usability constraints

- Interactive controls are at least 44 CSS pixels high.
- Selected, completed, in-progress, hover, and keyboard-focus states remain visually distinct.
- The inspector fills the mobile viewport and becomes a right-side panel on larger screens.
- One, two, three, and four board columns are used at 320, 390, 760, and 1280 pixels respectively.
- Escape closes the inspector, Tab remains inside it, and focus returns to the tile that opened it.
- Reduced-motion preferences remove view and inspector transitions.
- Persistence failure keeps the draft and avoids any success message.
- Offline behavior, imports, exports, history editing, program editing, settings, onboarding, and install behavior remain available without dependencies.

## Visual system

The interface uses a neutral work-surface palette, dense labels, clear borders, and large typographic hierarchy. Color communicates completion, recommendation, selection, and caution. Styling does not explain itself in visible copy; labels describe only user tasks and data.
