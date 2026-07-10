# The Loading Bay

## Concept

RepForge becomes a compact strength-loading terminal rather than a dashboard. Powder-coated charcoal forms the chassis; warm off-white stencil paint carries the hierarchy; oxidized red/orange marks active load; cold steel identifies structure and recovery states.

The visual metaphor is literal where it improves comprehension:

- Each exercise is a numbered **bay**, separated by a heavy left rail.
- Each set is a **bar assembly**: set number, red plate cluster around load, reps/RIR readouts, then a grooved collar.
- Saving a set turns the shaft bright, slides the row into its locked state, and lights the collar pin.
- Finishing a workout uses two oversized collars and a short mechanical lock animation.
- Tables, panels, tabs, and navigation use steel housings, painted rules, and square switchgear instead of floating rounded cards.

The treatment stays minimal: texture is low-contrast, shadows communicate physical depth only, and no decorative object competes with entering load, reps, or RIR.

## Interaction decisions

- Existing DOM ids, classes used by JavaScript, data attributes, labels, tab roles, and focus behavior remain intact.
- Load remains the widest set value and is visually bracketed by plates; reps and RIR remain compact adjacent readings.
- The existing per-set Save control becomes the collar. Its text and accessible name are unchanged, while `is-done` supplies the locked visual state.
- Existing progression heat remains semantic, translated into painted rail color and a small industrial indicator.
- Focus and List modes remain the same control with a recessed two-position switch treatment.
- Touch targets and the five-item bottom navigation retain their dimensions. The narrow-screen rules reduce plate widths before reducing readable type.
- Motion is brief and mechanical, and the existing `prefers-reduced-motion` rule disables it.
- The service-worker cache is bumped to `repforge-v14-loading-bay` so the prototype cannot be masked by the previous shell.

## Reference principles

NN/g’s skeuomorphism guidance is used as a restraint: familiar real-world cues should improve recognition and perceived affordance, while excessive realism adds noise. The bar, plates, collars, recessed fields, and pressed switches explain state or action; they are not ornamental simulation. This also follows NN/g’s broader match-between-system-and-real-world heuristic: RepForge uses the lifter’s vocabulary and loading sequence, while preserving explicit labels and conventional form behavior.

References:

- Nielsen Norman Group, [Skeuomorphism in Flat Design](https://www.nngroup.com/articles/skeuomorphism-flat-design/)
- Nielsen Norman Group, [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)

Strong and Hevy are reference points only for the efficient workout-log information pattern: repeated compact set rows, predictable load/reps columns, and immediate completion controls. The Loading Bay does not copy their visual style, card treatment, iconography, colors, or brand language. It keeps RepForge’s progression recommendations and RIR workflow while presenting the set table as a physical loading sequence.

Product references:

- [Strong](https://www.strong.app/)
- [Hevy](https://www.hevyapp.com/)
