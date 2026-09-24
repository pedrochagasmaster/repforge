# Focus mode — definitive mockups

This set documents the polished Focus Mode interaction system across its core states. All screenshots use the same 853×1844 canvas, card geometry, progress semantics, and attached action area.

| File | State |
| --- | --- |
| `01-new-exercise.png` | New exercise, first set, no logged history |
| `02-returning-exercise.png` | Returning exercise with previous-session context |
| `03-mid-exercise-rir.png` | Mid-exercise logging with numeric RIR |
| `04-effort-mode.png` | Mid-exercise logging with effort mode |
| `05-folded-history.png` | High-volume exercise with folded set history |
| `06-editing-set.png` | Editing a previously logged set |
| `07-active-rest.png` | Active rest timer in global workout chrome |
| `08-note-editor.png` | Native exercise-note editor sheet |
| `09-exercise-complete.png` | Exercise complete with another exercise remaining |
| `10-workout-complete.png` | Final exercise and workout completion |
| `11-card-swipe.png` | Horizontal exercise-card swipe transition |

## Interaction principles

- The exercise remains a full-height swipeable card.
- The upper ledger is the only vertically scrollable region.
- Recommendation, inputs, and primary action remain fixed in the attached lower well.
- Completed exercise segments are near-black, the current segment is orange, and upcoming segments are warm gray.
- Rest timing lives in the global workout chrome rather than inside the exercise card.
- Extreme set counts fold older rows behind a single disclosure instead of shrinking the active controls.
- Commit actions use sentence case and no arrow; navigation actions may use one arrow.
