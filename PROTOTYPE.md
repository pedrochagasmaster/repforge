# Focus Deck

## UX architecture

Focus Deck makes one exercise the primary unit of a workout. The Log view no longer renders a vertical list of exercise cards.

- **Focus is the default.** The active exercise owns the main workspace.
- **Session progress stays visible.** A sticky rail reports completed sets and the current exercise position, with progressbar values announced to assistive technology.
- **Previous and Next stay available.** Persistent controls move through the session without returning to a list.
- **Set entry is thumb-friendly.** Load and reps use large decrement/input/increment controls. Every interactive target is at least 44 CSS pixels.
- **Completed sets become receipts.** A completed set collapses to its load, reps, effort, and an Edit control.
- **Overview is a modal layer.** It lists the whole session in a native dialog, makes the background inert, traps keyboard focus, and restores focus to its trigger.
- **Desktop uses a split layout.** A persistent exercise navigator sits left of the active exercise workspace.

The existing program, log, settings, import/export, IndexedDB/localStorage persistence, and offline service-worker behavior remain unchanged.

## Product-wide layout

Stats uses a summary-first metric grid with segmented drill-downs. History separates session actions from the full set table. Program uses a responsive two-column day editor. Settings uses a two-column preference layout on larger screens. All sections share the same spacing, control geometry, surfaces, and typography.

## Neutral-copy rule

Interface copy describes the task or system state only. Status labels use **Add load**, **Keep load**, and **Reduce load**. Saved-workout confirmation uses **Workout saved**. Section labels use **Session**, **Exercise**, **Stats**, and **History**.

Copy must not explain or name the visual design. Metaphor-specific terms are prohibited in interface-owned visible text. The RepForge brand name is the only exception.

## Accessibility

- Native buttons, inputs, labels, details, and dialog semantics are retained.
- Exercise navigation supports keyboard focus and Left/Right Arrow shortcuts when focus is outside a form control.
- Tab and Shift+Tab cycle within Overview. Escape closes it and returns focus to its trigger.
- Visible controls use a minimum 44px target.
- Focus indicators are high contrast.
- `prefers-reduced-motion` reduces transitions and animation.

## Offline behavior

The static shell remains dependency-free. Cache `repforge-v17-focus-deck-a11y` refreshes the redesigned HTML, CSS, JavaScript, manifest, icon, and local fonts while preserving network-first shell updates and cached offline reloads.
