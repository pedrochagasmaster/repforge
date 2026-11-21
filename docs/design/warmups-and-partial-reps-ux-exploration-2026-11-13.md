# Warmups and Partial Reps: Taurifer UX Exploration

**Date:** 2026-11-13\
**Status:** Proposed UX direction, not an approved implementation specification\
**Product:** Taurifer (PWA-first validation product)\
**Scope:** Workout execution, set logging, correction, history, and progression semantics

> The goal is that an athlete can record what they actually did, understand what happens next, and put the phone down. Ordinary set logging should require no additional decisions.

## Executive recommendation

Introduce **warmups as an optional preparation sequence before working sets** and **partial reps as a detail within a set’s repetition record**. Both should reuse Taurifer’s existing workout screen and bottom input panel.

- **Warmup** describes a set’s *purpose*.
- **Partial** describes the *repetitions performed*.
- They are different dimensions, not alternatives in a shared “Normal / Warmup / Partial” selector.
- Both must retain their meaning in history and in progression inputs.
- Do not introduce a new global logging mode, additional always-visible columns, or automatic progression credit for partials.

### Important current-state distinction

At the time of the original investigation, Taurifer already supported warmup flags and excluded warmups from certain progression targets. However, the current warmup action **relabelled an existing programmed set**, potentially consuming a working-set slot. For example, converting one of three planned sets to warmup left only two working sets.

**Proposal:** Adding preparation must *not* consume prescribed working sets. Three planned working sets remain three planned working sets, regardless of the number of warmups.

This is a design proposal, not a claim that this behaviour has already been implemented. Recheck the latest code before implementation.

Source: [Exercise actions and draft model](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/app.js#L9360).

## 1. First-principles model

The interface must answer three different athlete questions:

| Athlete question | UI concept | What must be represented |
|---|---|---|
| What do I do before my first working set? | Preparation | Warmup sets and transition into working sets |
| What did I complete in this set? | Performance | Full reps, partial reps, load, effort, and correction |
| What does that mean for next time? | Comparable evidence | Accurate history and progression eligibility |

The organizing principle is **preserve the meaning of the action**. Reducing database or interface complexity at the expense of training meaning is not a good simplification.

Possible cases that the model must not conflate:

1. Full reps followed by partials, e.g. **8 full + 3 partial**.
2. An entirely partial set, e.g. **0 full + 8 partial**.
3. An exercise deliberately prescribed with a specific partial range.
4. A warmup that also contains partial reps.

The first three cases have different implications for comparable performance, progression, and calibration.

### Steve Jobs interpretation

This is an interpretation of Jobs’s design philosophy, not an assertion that he designed workout software. The relevant principles are:

- Edit away controls that are unnecessary for the common action.
- Give people a clear model of what the product is doing.
- Reveal capabilities in the context where they are useful.
- Make the product responsible for interpreting data faithfully instead of shifting that burden to users.

**Taurifer application:** Make the common action effortless, reveal detail where it belongs, and take responsibility for the meaning of the recorded result.

Relevant reading: [Steve Jobs Archive](https://book.stevejobsarchive.com/), [Don Norman on design as communication](https://jnd.org/design-as-communication/).

## 2. UX principles and consequences

| Principle | Consequence for Taurifer |
|---|---|
| Progressive disclosure | Keep ordinary logging unchanged. Reveal partials from the repetition editor; show them immediately if prescribed. |
| Prevent mode errors | Each selected set carries its own purpose. Show **Warm-up** and **Log warm-up**; do not rely on a persistent mode toggle. |
| Recognition over recall | Always show **8 full + 3 partial**, including in history and correction. Avoid unlabeled counts. |
| Low-effort input | Reuse the established load/reps controls, prior values, and adjustment affordances. |
| Accessible, visible actions | Gestures can be accelerators but must not be the sole entry path. |
| Visibility of system status | Make it clear whether a set is preparation, working, pending, completed, or corrected. |
| Error prevention and recovery | Correction must be safe, easy, and independent of rest-timer state. |

Research:
- [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [NN/g — Modes](https://www.nngroup.com/articles/modes/)
- [NN/g — Recognition Rather than Recall](https://www.nngroup.com/articles/recognition-and-recall/)
- [Apple HIG — Entering Data](https://developer.apple.com/design/human-interface-guidelines/entering-data)
- [Apple HIG — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)

## 3. Warmups UX

### 3.1 Entry point

Before the first working set, present a quiet **Warm up** action near the upcoming set.

- Available inline, without entering Settings or modifying a whole program.
- Dismissible by simply continuing into the first working set.
- Retain a secondary action in the exercise menu for later warmups, e.g. after an interruption or exercise substitution.
- Do not force athletes through a warmup wizard or calculator.

### 3.2 Insertion and execution

Selecting **Warm up** inserts preparation rows **before working set 1**.

The familiar bottom input panel remains the execution surface:

- Load
- Reps
- **Log warm-up** as the primary action

The selected ledger row and the main action both communicate that it is a warmup. Avoid carrying a working-set RIR field into this path without deliberate meaning.

**Invariants:**
- Adding one or more warmups never reduces the number of working sets.
- A warmup is logged only on an explicit completion action.
- Uncompleted warmups must not be counted as performed.
- A change to the selected warmup must not change the purpose of subsequent rows.

### 3.3 Transition into work

For a single improvised warmup, return focus to the upcoming working set after logging.

For an explicitly recalled sequence, advance through its preparation rows and then into working set 1.

Provide a clear **Start working sets** action to leave preparation early. Skipped preparation rows are not silently completed.

### 3.4 Completed warmups

After completion, visually collapse the preparation rows into a subtle summary such as:

**2 warm-ups logged**

The summary is expandable so completed warmups can be reviewed and corrected. Avoid allowing preparation to dominate the working-set ledger.

The ordinary rest timer remains available. Editing a completed warmup must not restart it. A session containing only warmups can remain in truthful history, but should not appear to have completed its prescribed working sets.

### 3.5 Defaults and future automation

Start with manual entry and clearly labelled recalled values from the athlete’s previous preparation. Recalled values are **suggestions/starting points**, not completed sets.

Percentage-based warmup generation is a **separate recommendation decision**, not a prerequisite to these UX changes. It may need exercise-specific equipment increments, load availability, and strategy controls.

Competitive precedents:
- [Strong — Warm-Up Calculator](https://help.strongapp.io/article/171-warm-up-calculator)
- [Hevy — Percentage-Based Warm-Up Sets](https://help.hevyapp.com/hc/en-us/articles/35650921359639-How-to-Use-the-Warm-Up-Calculator-for-Percentage-Based-Warm-Up-Sets)

## 4. Partial-rep UX

### 4.1 Entry

Extend the current reps picker with a visible **Add partial reps** action.

Do not add an always-visible partial-rep input to every set. Preserve the existing interaction grammar: selecting the reps field exposes its adjustment controls, while the picker provides detailed editing.

Design-system reference: [Focus and shelf specification](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/design/direction-d-implementation-spec.md#42-focus-and-the-shelf-d-52-4).

### 4.2 Recording

After choosing **Add partial reps**, expose two explicitly labelled values:

- **Full reps: 8**
- **Partial reps: 3**

Applying the edit returns to the existing workout screen. Both the reps field and the ledger row display **8 full + 3 partial**. Logging records **one** set.

The main full-repetition count remains **8**.

Never transform the record into:
- 11 ordinary reps
- A decimal rep count
- An invented equivalent-rep score

### 4.3 Defaults and subsequent sets

For an unprescribed next set, default the partial count to **none recorded**, even when the previous set contained partials.

Remembering that a user has used the partials control may justify making it easier to discover, but must not cause the product to assume more partials were performed.

If partials are explicitly prescribed, they should be visible as part of the set’s planned work instead of hidden behind a picker.

### 4.4 Correction

Tapping the completed row opens both values in the existing correction path.

- Save updates the same set, not a second set.
- Rest timing continues uninterrupted.
- The upcoming set and exercise position remain unchanged.
- The saved row immediately reflects the corrected full/partial counts.

This should remain a routine operation, not a separate editing workflow.

### 4.5 Partial-only and prescribed partial-range work

Allow **0 full + 8 partial** without forcing a fictitious full rep.

However, distinguish this from an exercise deliberately prescribed with a partial range. A repetition completed through its **prescribed** range is a valid repetition of that variation. Its progression should compare matching variations and ranges rather than borrowing full-range exercise records.

**Scope recommendation:** Support mixed and partial-only *logging* in the first release; treat authored partial-range prescriptions as an explicit extension of the program model.

## 5. Effort and progression integrity

### 5.1 RIR ambiguity

The record **8 full + 3 partial · RIR 0** is ambiguous.

Does RIR 0 describe the end of the full reps or the end of the partial extension? Those are different observations, with different implications for later load suggestions.

For mixed sets, label the effort field:

**Full reps left**

Prompt:

> Before the partials, how many more full reps could you do?

Leave the value **unknown/not recorded** if the athlete cannot answer. Do not infer RIR 0 merely because partial reps were performed.

### 5.2 Invariants for downstream systems

- Partial counts do not increase full-rep goal totals.
- Partial-only sets do not establish ordinary full-ROM strength records.
- Ambiguous effort reports do not automatically update effort calibration.
- A failed full-ROM attempt is not automatically a completed partial rep.
- A load change within one sequence cannot be represented faithfully with only one load and two counts; use a separate set or a future segment model.
- Warmups must not be silently included in working-set records, load progression evidence, or completed working-set counts.

Taurifer’s product thesis emphasizes trust in progression and adaptation, so faithful training semantics are part of the user experience, not merely an internal analytics concern.

Source: [Taurifer product thesis](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/business-product-thesis.md).

### 5.3 Existing code check

The original inspection suggested that a historical progression adapter might drop an existing warmup flag without filtering the set first. This was a **code-inspection concern, not a reproduced defect**.

Before implementation, verify warmup handling across:
- Live recommendations
- Saved and reloaded history
- Personal records
- Calibration and effort interpretation
- Session-completion and target-completion calculations

Inspection reference: [Historical progression adapter](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/app.js#L6407).

## 6. Visual and interaction constraints

Preserve the established Taurifer system:
- Exercise hero and hierarchy
- Set ledger
- Bottom input panel
- Current correction interaction
- Typography and visual rhythm
- Existing restrained colour use and purposeful motion

Use language and hierarchy to explain the difference. Avoid a new mode selector, multiple permanent pill controls, or a second persistent panel.

The feature should feel native to the workout interaction rather than like two unrelated overlays added to the screen.

Reference: [Taurifer brand guide](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/brand-guide.md).

## 7. Proposed usability validation

Test on the PWA using actual physical devices. Do not explain the interface beforehand.

| Task | Observation / success criterion |
|---|---|
| Record an ordinary set | No required extra decision or step |
| Add two warmups to an exercise with three prescribed sets | Three working sets remain |
| Move from warmup to work | No accidental warmup classification of working set 1 |
| Record 8 full + 3 partial reps | Athlete does not enter 11 full reps |
| Correct the partial count during rest | Timer and set position remain intact |
| Read the completed set later | Athlete can accurately describe full vs partial reps |
| Observe next target or recommendation | Partial-rep data is neither discarded nor misrepresented as full reps |
| Log a partial-only set | No fictitious full rep required |

Useful measurement dimensions:
- Completion and correction rate for warmups/partials
- Time/steps required for ordinary set logging, before vs after
- Misclassification and accidental mode-entry rates
- Time to transition from warmups to working sets
- Accurate recall/interpretation of history
- Progression data eligibility, rather than mere feature adoption

Avoid treating feature usage itself as proof that the UX is good. The strongest success measures are **accurate interpretation, low correction effort, and unchanged ordinary logging speed**.

## 8. Scope and sequencing recommendation

**Initial UX implementation candidate:**
1. Warmup insertion as distinct preparation rows; preserve working-set count.
2. Contextual warmup logging and explicit transition to working sets.
3. Collapsed summary of completed warmups and routine correction.
4. Reps-picker partial entry; explicit full and partial counts.
5. Ledger/history/correction display showing both counts.
6. Downstream progression, records, and calibration safeguards.

**Deferred / distinct product decisions:**
- Automatic percentage-based warmup prescription
- Automatic warmup sequences conditioned on exercise or user history
- Full program authoring for partial-ROM exercise variations
- More sophisticated within-set segment models for changing load or ROM

These are proposed boundaries for validation, not ratified roadmap changes.

## 9. Final design test

A well-integrated result should require no new explanation for the ordinary athlete:

- **Preparing?** Add a warmup before work.
- **Performed partials?** Record them within reps.
- **Done?** The ledger tells the truth.
- **Training again?** Taurifer only compares evidence that genuinely belongs together.

**North star:** One familiar logging surface, with context-specific detail. Warmups appear when preparing, partials appear when describing repetitions, and the completed record preserves both meanings.

---

## References

### Taurifer repository snapshot used for the original discussion

- [Exercise actions and draft model](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/app.js#L9360)
- [Historical progression adapter](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/app.js#L6407)
- [Product thesis](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/business-product-thesis.md)
- [Brand guide](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/brand-guide.md)
- [Focus and shelf design spec](https://github.com/pedrochagasmaster/repforge/blob/88d0784d371838153c181c86509969d5e52cab44/docs/design/direction-d-implementation-spec.md#42-focus-and-the-shelf-d-52-4)

### General design and product UX

- [Don Norman — Design as Communication](https://jnd.org/design-as-communication/)
- [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Nielsen Norman Group — Modes](https://www.nngroup.com/articles/modes/)
- [Nielsen Norman Group — Recognition Rather than Recall](https://www.nngroup.com/articles/recognition-and-recall/)
- [Apple HIG — Entering Data](https://developer.apple.com/design/human-interface-guidelines/entering-data)
- [Apple HIG — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)
- [Steve Jobs Archive](https://book.stevejobsarchive.com/)

### Workout-app precedents

- [Strong — Warm-Up Calculator](https://help.strongapp.io/article/171-warm-up-calculator)
- [Hevy — Percentage-Based Warm-Up Sets](https://help.hevyapp.com/hc/en-us/articles/35650921359639-How-to-Use-the-Warm-Up-Calculator-for-Percentage-Based-Warm-Up-Sets)
