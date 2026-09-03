# Taurifer UI audit

## Scope and standard

I reviewed all 218 production captures representing 71 logical screens, plus the 23 committed design and PR-proof PNGs. I excluded icons, splash screens, and standalone brand assets because they are not UI screenshots. The catalog covers light and dark themes, English and Portuguese, 320, 390, and 430 px viewports, 200% text, and reduced motion. The catalog integrity check passes.

I assessed the current product captures against the [Anthropic frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) and Taurifer's own [brand guide](brand-guide.md). The skill's most relevant tests are subject-specific identity, expressive typography, meaningful structure, disciplined restraint, exact action copy, useful empty states, and mobile accessibility.

## 1. Overall assessment

Taurifer does not look like generic AI-generated software. It has a real point of view. The bull-and-athlete opening, engraved exercise art, warm paper, near-black ink, burnt orange, and restrained tone form a coherent identity. The best working screens feel like a serious training log instead of a lifestyle fitness app.

The product weakens when it moves from training into configuration and analysis. Onboarding becomes a form system built from repeated rounded cards. Progress resembles a generic analytics dashboard. Several dense selectors fail at 200% text. The information architecture also asks users to understand differences between routes that share most of their questions.

| Area | Assessment |
| --- | --- |
| Brand and distinctiveness | Strong, especially first run, exercise detail, workout logging, and the timer |
| Visual consistency | Strong across themes and locales |
| Core workout ergonomics | Strong, with appropriately large set controls and clear current-state emphasis |
| Typography and hierarchy | Good at page level, less distinctive in tables and dense forms |
| Information architecture | Mixed, mainly because of onboarding routes and Progress |
| Accessibility | Good foundations, but one clear 200% text failure and several compounded states are not captured |
| Generic or AI-generated signals | Present in card stacks, metric triplets, and repetitive icon-plus-copy rows, but not dominant |

The skill explicitly warns about the warm-cream and terracotta template. Taurifer is close to that palette, but avoids the cliché through its sans typography, subject-specific illustrations, lack of gradients, and quiet training language. Changing the palette would be the wrong reaction. The work should focus on making structure and data feel more specific to progressive overload.

## 2. Recurring system-level problems

### Fixed grids do not survive text scaling

The clearest defect is the five-column session-duration selector at [200% text](ui-screens/screens/onboarding-custom/schedule__phone-390-light-en-text200.png). Every “minutes” label overlaps its neighbors. Similar pressure appears in muscle-priority segments, result metric triplets, and equipment grids.

This breaks the skill's accessibility quality floor. The layout changes font size but not component structure.

### Too many things look like the same card

Question choices, alerts, program summaries, metrics, selected states, review facts, and disclosures all use similar rounded white or charcoal containers. Compare the [validation error](https://github.com/pedrochagasmaster/repforge/blob/415e8c55b2ee9394696b91c0b9457e2091c1c06f/docs/ui-screens/screens/onboarding-recommend/validation-error__phone-390-light-en.png) with the [program review](ui-screens/screens/onboarding-recommend/preview-first-run__phone-390-light-en.png).

The containers remain tidy, but structure stops communicating meaning. This also conflicts with Taurifer's own rule that hairlines and whitespace should do most of the separating.

### Onboarding routes overlap conceptually

[Create a program](ui-screens/screens/onboarding-start/hub__phone-390-light-en.png) asks users to distinguish:

- Recommend one for me
- Generate a custom program
- Browse Taurifer programs
- Build a program
- Import a program

Recommend and Custom repeat most of the same questions. Browse repeats schedule and environment. Recommendation results then lead to another review screen containing much of the same information. The system exposes its generation modes before users have enough context to value the distinction.

### Dense choices arrive too early

Equipment correction, muscle priorities, exercise preferences, custom exercise metadata, and program editing ask for many small decisions at once. The [environment correction](ui-screens/screens/onboarding-recommend/environment-correction__phone-390-dark-en.png) and [exercise preferences](ui-screens/screens/onboarding-custom/exercise-preferences__phone-390-light-en.png) are the strongest examples.

The problem is not raw density alone. Workout logging is dense and works because the user understands the task. These onboarding screens demand similar concentration before that expertise has been established.

### Empty and blocked states do not always direct the next action

Three examples stand out:

- [Progress Overview](ui-screens/screens/progress/overview__phone-390-light-en.png) says “Needs more data” while showing “10 attention” and six warnings. It does not say what data is needed or how to produce it.
- [Progress Review](ui-screens/screens/progress/review__phone-390-light-en.png) recommends repeating with a simpler schedule but offers no action.
- [Share program setup](ui-screens/screens/program/share-setup__phone-390-light-en.png) disables “Copy link” and says to save unlinked exercises, but neither identifies them nor provides a way to fix them.

The skill's rule is exact here: failure and emptiness should explain both the condition and the remedy.

### Focus treatment competes with hierarchy

The orange rectangle around the heading in [Rules changed](ui-screens/screens/onboarding-recovery/rules-drift__phone-390-light-en.png) and [Create a program with an existing program](ui-screens/screens/onboarding-start/hub-existing__phone-390-light-en.png) looks like an editing selection or capture artifact.

Focus must remain visible for keyboard users, but programmatic page-heading focus should not become the strongest visual object on the page.

### Typography has an unused opportunity

Heavy Plex Sans gives the entry and onboarding pages authority. On working screens, however, load, reps, RIR, dates, percentages, and utility copy often merge into the same typographic voice. Taurifer already owns a useful pairing: Plex Sans for language and Plex Mono for training data. The screenshots rarely make that distinction memorable outside the timer.

## 3. Screen-specific findings

| Screens | Findings |
| --- | --- |
| First-run gate | [The hero](ui-screens/screens/onboarding-start/first-run__phone-390-light-en.png) is the strongest brand moment and the product's justified aesthetic risk. At [320 px](ui-screens/screens/onboarding-start/first-run__phone-320-light-en.png), no route or scroll cue is visible. That may be intentional, but a new user has no visible indication that setup continues below. |
| Shared first-run gate | [Start this program](ui-screens/screens/onboarding-shared/gate__phone-390-light-en.png) correctly moves the relevant action above the hero. This is a better task-first composition without weakening the identity. |
| Entry hub | The hierarchy is clear, but the distinction between “Recommend” and “Generate a custom program” depends on explanatory copy rather than an obvious outcome. |
| Recovery and conflicts | Consequences are unusually clear. “Your active program changed” and “Program rules have changed” say what happened and protect existing work. Only the heading focus treatment needs correction. |
| Recommend and Custom questions | Section counts and progress bars encode a real sequence, exactly as the skill recommends. Choice cards are readable, but fixed grids and repeated layouts make the flow feel generated rather than coached. |
| Pain and avoidance | [Pain handling at 200%](ui-screens/screens/onboarding-recommend/avoidance-pain__phone-390-light-en-text200.png) reflows well. The safety constraint is direct, adjacent, and calm. Preserve this pattern. |
| Browse catalogue | [The catalogue](ui-screens/screens/onboarding-browse/catalogue__phone-390-light-en.png) contains useful facts, but each program becomes a dense paragraph. Frequency, time, equipment fit, and tradeoffs need a more scannable comparison structure. |
| Recommendation result and review | “Recommended program” and “Review program” repeat the same identity, duration, rationale, and assumptions. They feel like two confirmation screens for one decision. |
| Build my own | [The empty editor](ui-screens/screens/onboarding-build/editor-empty__phone-390-light-en.png) exposes internal identifiers such as `day_empty:manual_d1`. This is the most serious copy defect in the catalog and directly violates the skill's user-side language rule. |
| Import and shared reviews | The common review template creates consistency and makes activation explicit. At 200% text, metric triplets become oversized and should stack rather than remain fixed columns. |
| Today | [Ready to start](ui-screens/screens/today/ready__phone-390-light-en.png), the day picker, and the completed state have strong hierarchy and sensible thumb placement. They are calm without becoming empty. |
| Workout logging | [List mode](ui-screens/screens/workout/list__phone-390-light-en.png) is dense but effective. Controls are large, the current set is unmistakable, and previous values stay close to the inputs. [Focus mode](ui-screens/screens/workout/focus__phone-390-light-en.png) is even stronger. The note and next-exercise icons are visually ambiguous for first-time users, but should not be expanded into permanent clutter. |
| Rest timer and explanation | The timer is one of the product's clearest subject-specific interactions. “Why this weight?” also makes an otherwise opaque recommendation inspectable. |
| Session summary | [Session saved](ui-screens/screens/session/summary__phone-390-light-en.png) is the best information hierarchy in the product. The metric triplet is justified by real session facts, personal records are prioritized, and “Done” is unambiguous. |
| Progress | The exercise chart is useful and specific. Overview, Strength, Volume, PRs, and Review feel like five separate reporting tools compressed into one tab strip. Review is the weakest screen because it turns a recommendation into a paragraph with no action. |
| History | The calendar is legible and its dots carry meaning. It still receives more vertical emphasis than the recent sessions most users are likely to revisit. The expanded session editor uses adequate controls, though its repeated exercise-name truncation could become ambiguous in mixed sessions. |
| Exercise library | The illustrations make the library unmistakably Taurifer. The search, partial next chip, and large selectable rows communicate horizontal and vertical browsing well. |
| Program | The overview is clear. The progression editor and custom exercise sheet become control-heavy, particularly the large chip taxonomy. The share sheet's blocked state needs a direct remedy. |
| Settings | Grouping is sensible and privacy copy is unusually specific. The page is long, and disclosure text receives the same subdued treatment whether it is incidental or decision-critical. |
| Install and tour | The [iOS install sheet](ui-screens/screens/install/ios-sheet__phone-390-light-en.png) is excellent. Its numbered structure represents an actual sequence. The [11-step tour](ui-screens/screens/install/tour__phone-390-light-en.png) is too long and front-loads a large privacy paragraph before demonstrating value. |

## 4. Prioritized recommended changes

### P0: Fix visible accessibility and copy failures

1. Replace fixed five-column selectors with responsive layouts. At 200% text, switch to two columns or full-width rows. Apply the same rule to metric triplets, muscle emphasis controls, and any segmented choice whose label can wrap.

2. Replace internal day identifiers with user-facing day names. The build error should say, for example, “Add an exercise to Day 1, Day 2, and Day 3.”

3. Make blocked actions repairable in place. The share sheet should name the blocking exercises and provide “Save as custom exercise” or a direct route to them. Progress empty states should state the required sessions and offer “Start today's workout.”

### P1: Reduce cognitive load and make structure meaningful

4. Reframe onboarding around user intent. A clearer top level would be “Taurifer chooses,” “I choose,” and “Use an existing program.” Recommend and Custom can then vary how much control appears inside the same flow.

5. Merge recommendation result and review unless the user chooses to edit. One screen can contain the rationale, assumptions, and primary activation action. Replacement consequences can remain a separate confirmation because they represent a real state change.

6. Redesign Progress around decisions. Overview should answer “What needs attention today?” Review should turn “Repeat with a simpler schedule” into a concrete action. Strength, Volume, and PR tables can remain drill-down destinations.

7. Reserve rounded containers for interaction, alerts, and independently selectable objects. Present static facts as editorial rows with hairlines. Present metric bands only when the values form a real comparison.

8. Break expert configuration into progressive disclosure. Environment correction, muscle priorities, exercise preferences, and custom exercise metadata should begin with common choices and reveal uncommon detail when requested.

### P2: Sharpen the design system

9. Use the existing type pairing more deliberately. Keep Plex Sans for language and make loads, reps, RIR, timers, and dense historical values visibly numeric through Plex Mono or stronger tabular-number treatment.

10. Keep keyboard focus visible, but restrict the large orange heading outline to genuine keyboard focus. Programmatic navigation focus should use a quieter treatment.

11. Add a restrained continuation cue to the 320 px first-run gate. Do not crop the hero or reduce its role. A bottom fade, short “Continue below” cue, or persistent scroll marker is enough.

12. Replace the 11-step tour with three short orientation steps or contextual tips shown when each feature first matters. Keep the excellent iOS installation instructions intact.

13. Add at least one combined Portuguese plus 200% text capture. The current catalog tests Portuguese and text enlargement separately, which misses the most demanding label-length combination.

## 5. What should be preserved

- The bull-and-athlete hero. It is specific to Taurifer and already spends the product's main aesthetic risk in the right place.
- The exercise illustration treatment, especially the large detail view and compact library thumbnails.
- The paper, ink, orange, green, and danger palette. It stays coherent across light and dark.
- The restrained voice. Taurifer records, explains, and protects. It does not cheerlead.
- The workout list and focus modes. They solve different logging preferences without changing the underlying task.
- The rest timer and “Why this weight?” inspector.
- The session summary hierarchy.
- The four-item bottom navigation and bottom-sheet interaction model.
- Meaningful sequential structure, including onboarding progress bars and numbered iOS installation steps.
- Adjacent validation, explicit archive-and-replace language, activation conflict handling, and the pain safety constraint.
- The screenshot catalog itself. Its 71-screen coverage makes system-level design drift visible.

No code, screenshots, or repository files were changed during the audit.
