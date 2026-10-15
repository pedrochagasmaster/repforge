# ADR 0020: Onboarding follows candidate B, and its result screen is the program editor

- **Status:** Accepted, 2026-10-10 (owner)
- **Decision owner:** Product owner, after comparing the three working prototypes
- **Reference:** [`docs/design/onboarding-mf/`](../design/onboarding-mf/README.md), candidate B
  (`prototype/app.html?c=b`)
- **Affects:** Plan 068 OD-1 and the placement of its
  inputs (PR #345, not yet on `main`); issue #323

## Context

The onboarding had gone through several redesigns. The owner asked for one direction
referenced on MacroFactor Workouts that ends the cycle. Three candidates were built as
working prototypes over the real engine and the app's own motion layer. A was faithful
to MacroFactor's look, B kept MacroFactor's structure in Taurifer's identity, and C was
a compressed version. The owner compared them and chose B.

Before this decision, a Generate result went from the result step to a preview, and then
through "Editar antes de usar" into the generic Build editor. That editor shows the
canonical definition as raw fields: per-cycle forms, metric compositions, English
catalog names in Portuguese. It is the screen that decides whether a lifter trusts the
recommendation, and it was the weakest one in the flow.

## Decision

1. **B is the design reference for onboarding**, from the entry hub to Activate. That
   covers the screen order, MacroFactor's full question set including the Basics,
   one question per screen, the controls (choice cards, wheels, ruler, segmented
   controls, switches), the copy register and the motion. A change that departs from B
   needs an owner decision. B uses the existing tokens and the motion vocabulary in
   [`interaction-runtime-audit.md`](../design/interaction-runtime-audit.md). Direction D
   ([ADR 0016](0016-direction-d-design-reference.md)) stays the reference for the main
   screens.
2. **The result screen is where the recommendation is reviewed and adjusted.** It
   replaces the preview step and the jump into the Build editor for the Generate route;
   Build and Import keep their editor. On it:
   - The program and each day can be renamed.
   - The time shown for each day comes from `estimateDaySeconds` and updates with every
     change. A day over the chosen session length says so.
   - Tapping an exercise opens one sheet. There the lifter can set the set count, the rep
     range, the RIR per set and the rest. They can swap the movement for one of the
     engine's candidates from `findSubstitutions`, or for any catalog movement that
     records reps. They can keep up to five in-session alternates
     ([ADR 0019](0019-slot-alternates.md)), move the exercise to another day, or remove it.
   - A day can add exercises and be reordered.
   - Plan 068's per-movement offers stay inline.
   - Every change is an edit on the canonical `ProgramDefinition`, checked by
     `validateProgramDefinition`. Changed rows are marked. Each change can be undone, and
     the whole recommendation can be restored.
   - A change that regenerates the program, such as length or rep pattern, asks first
     when it would discard adjustments.
   - Activate is blocked, with the reason shown, while a training day is empty or the
     definition is invalid.
3. **No further onboarding overhaul without evidence.** A later redesign of this flow
   needs measured completion or drop-off, time to first set, or lifter feedback. A new
   reference app is not enough.

## Consequences

- An implementation plan follows. It folds in Plan 068's inputs as B places them. Equipment
  adjustment becomes its own step after the gym preset, which settles OD-1 against the
  zero-new-screens proposal. Block length and rep pattern sit on the result's block row,
  and the offers stay inline. The plan also owns the questions B leaves open:
  - a purpose, a local-only privacy note and a skip for the Basics the engine doesn't read
    yet (sex, birth date, height, cardio);
  - one set of experience bands, since MacroFactor's 1 and 4 years differ from the engine's
    6 and 24 months;
  - the deload default;
  - the Everything and Warehouse presets.
- B has 17 screens from the hub to Activate, against 8 today. The owner accepted that.
  The plan should measure time to first set so decision 3 has its evidence.
- The equipment conflict must not ship until the engine fails fast. Today a request
  with no candidate for one job takes about 22 s, because `selectAllJobs` backtracks to
  its node cap, and `app.js` generates on the main thread.
- The edit operations in the prototype's `engine-worker.js` are the reference behaviour,
  not production code. They are applying a set count to every cycle (the deload week keeps
  one set fewer), shifting a rep range across cycles, RIR per set (deload +2, capped at 4),
  and copying the catalog-derived slot fields on a swap. The implementation moves them
  behind the editor's intents and proves them with the owning suites.
