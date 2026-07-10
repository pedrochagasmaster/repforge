# RepForge Timeline Flow

## Concept

Timeline Flow treats a workout as a chronological stream of events. The stream begins with session start, moves through exercise and set events, records rest intervals and notes, and ends with workout completion. One exercise event is current and expanded. Earlier events compress into receipts; later exercises remain a lightweight queue.

The active event keeps the existing load, reps, RIR, substitution, warmup, skip, and rest controls. A sticky action dock provides Back, Save current set, Next, and Save workout actions. Moving between events restores keyboard focus to the new current exercise.

## Supporting views

- History reuses the event stream, with each saved workout followed by compact set receipts and edit/delete controls.
- Stats presents Overview, Strength, Volume, PRs, and Review as stacked period sections with sticky section navigation.
- Program presents days and exercises as an ordered sequence and retains its existing move controls.
- Desktop layouts add a sticky workout outline on the left and current-event details on the right.

## Accessibility and responsive behavior

- Interactive controls use a minimum 44px target.
- Focus moves to the current event after Back, Next, or outline selection.
- Text and controls meet WCAG AA contrast.
- Reduced-motion preferences disable transitions and animations.
- Mobile widths stack set controls without horizontal page overflow.

## Scope and constraints

- Static, offline-first PWA with no new dependencies.
- Existing data structures, local storage keys, IndexedDB mirror, imports, exports, and progression behavior remain compatible.
- Existing selectors remain available for established features and browser simulation.
- All visible interface copy is neutral and task-oriented.
- Service-worker cache is `repforge-timeline-v16`.
