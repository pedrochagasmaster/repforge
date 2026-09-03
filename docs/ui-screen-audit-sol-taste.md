# Taurifer UI audit

## Overall assessment

Taurifer has a distinctive, credible visual identity but uneven product ergonomics. The warm cream, near-black, burnt-orange palette, bull mark, and exercise illustrations feel authored rather than generic. The workout, Today, and program-overview screens already form a coherent core experience.

The main weaknesses emerge as complexity increases: onboarding becomes repetitive, analytical screens squeeze desktop-style tables onto phones, editing screens accumulate nested controls, and accessibility variants expose major reflow failures. My overall verdict is:

> A strong branded beta with a good core workout experience, but not yet production-polished across onboarding, accessibility, localization, and dense management workflows.

I audited commit [`6681f130d5e0`](https://github.com/pedrochagasmaster/repforge/tree/6681f130d5e003153fd10cc470141b0d9175d583): 215 current UI captures plus 13 supporting real-screen captures in [`docs/design/library`](https://github.com/pedrochagasmaster/repforge/tree/6681f130d5e003153fd10cc470141b0d9175d583/docs/design/library) and [`docs/pr-proof`](https://github.com/pedrochagasmaster/repforge/tree/6681f130d5e003153fd10cc470141b0d9175d583/docs/pr-proof). Conceptual mocks and icon/splash assets were excluded from screen evidence.

The supplied [Taste skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) explicitly says its rules are contextual and that it is not primarily for dashboards, tables, or multi-step product UI. I therefore applied its portable principles: audit-first redesign, brand preservation, hierarchy, anti-template discipline, restrained cards, direct copy, coherent tokens, mobile resilience, accessibility, and intentional density.

**Design read:** a mobile-first strength-training product for committed recreational lifters, with a serious, heritage-athletic identity. Appropriate dials are roughly variance 4/10, motion 2–3/10, and density 6–7/10 during active training but 4–5 elsewhere.

## Recurring system-level problems

### 1. Text scaling causes structural failures

This is the most serious issue. The 200% captures demonstrate scaling rather than true reflow:

- Schedule controls merge into repeated, unreadable “minutes” columns in the [custom schedule](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-custom/schedule__phone-390-light-en-text200.png).
- Muscle-priority actions truncate or split across narrow buttons in [exercise preferences](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-custom/exercise-preferences__phone-390-light-en-text200.png).
- The main heading clips horizontally in the [recommendation result](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-recommend/result__phone-390-light-en-text200.png).
- Summary metrics crowd each other in the [import preview](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-import/preview__phone-390-light-en-text200.png).

The Taste standard prioritizes typography, spacing, mobile adaptation, and accessibility over decorative polish. These screens need breakpoint-specific restructuring: vertical fields, two-column maximum button grids, wrapping statistics, flexible heights, and alternate tab/navigation patterns.

### 2. The first-run screen hides the first meaningful action

The [390px first-run screen](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-start/first-run__phone-390-light-en.png) spends nearly the entire viewport on the logo, large headline, illustration, and manifesto. The user reaches the “Choose how…” section without seeing an actionable option. At [320px](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-start/first-run__phone-320-light-en.png), the problem is more pronounced.

This conflicts directly with the Taste skill’s hard-hero requirement that the primary CTA remain visible in the initial viewport.

Reduce the manifesto to two or three lines, shrink the illustration, and show one primary action such as **Create a program**, with **Import a program** as a quieter secondary action. Preserve the manifesto, but move its full version below the decision point.

### 3. Onboarding has overlapping choices and too many steps

The hub distinguishes among:

- Recommend one for me
- Generate a custom program
- Browse Taurifer programs
- Bring or build my own

The difference between “recommend” and “custom” is not evident before entering the flows. Once inside, both ask similar questions about schedule, background, goals, equipment, priorities, and exclusions. Several flows also separate result and preview/review into nearly duplicate confirmation screens.

This increases cognitive load and weakens information architecture. The Taste skill calls for hierarchy based on user intent, not a template’s available components.

Recommended structure:

- **Guided builder**, with “Let Taurifer decide” and “Fine-tune details” modes.
- **Browse programs**.
- **Import or build manually**.

Use sensible defaults followed by exceptions. Combine result and review into one confirmation screen, and keep compact progress plus Back/Continue controls visible during long steps.

### 4. Dense data is being compressed rather than redesigned for mobile

The [Strength](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/progress/strength__phone-390-light-en.png) and [Volume](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/progress/volume__phone-390-light-en.png) tables have clipped headings and very small scan targets. The [history session editor](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/history/session__phone-390-light-en.png) compresses exercise names and several numeric inputs into narrow rows.

Use responsive information patterns instead:

- Strength: one lift per row with latest result, estimated 1RM, and change.
- Volume: muscle group plus completed/planned volume, with secondary period data underneath.
- History: exercise summary rows opening a dedicated set editor.
- Preserve full tables only at tablet widths or behind an explicitly scrollable detailed view.

The [exercise chart](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/progress/exercise-chart__phone-390-light-en.png) is a much better model: a few useful metrics, a legible trend, and supporting detail.

### 5. Internal terminology and localization leaks damage trust

Several captures expose implementation details:

- The build error renders keys such as `day_empty:manual_d1` in the [empty editor](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-build/editor-empty__phone-390-light-en.png).
- The custom exercise screen displays `picker.equipment.band` in [Program](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/program/custom-exercise__phone-390-light-en.png).
- The nominally Portuguese [shared-program gate](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-shared/gate__phone-390-light-pt.png) remains in English.
- Portuguese screens mix localized interface copy with English exercise and fixture names.

Never render untranslated keys. The build error should say, for example, “Add at least one exercise to each training day,” while marking the incomplete days inline. Add a visible localization fallback strategy and audit the entire PT route as a single journey.

### 6. The component grammar becomes formulaic

Many screens repeat the same recipe: tiny uppercase eyebrow, oversized heading, muted paragraph, rounded white card, hairline divider, small orange label. Examples span [Today](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/today/ready__phone-390-light-en.png), [Workout](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/workout/focus__phone-390-light-en.png), and [Progress](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/progress/overview__phone-390-light-en.png).

This is the principal sign of AI-generated UI. It is not the palette or brand; it is the repeated compositional grammar and explanatory copy.

Reduce uppercase labels by roughly one-third. Establish three primary type tiers: page title, section title, and support text. Use cards only for independent objects or meaningful interaction boundaries. Let whitespace and alignment perform more of the grouping.

### 7. Dark mode loses too much secondary information

Primary headings remain strong, but muted copy, inactive navigation, field metadata, and dividers become extremely subdued in screens such as [Settings](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/settings/main__phone-390-dark-en.png) and [Recommend](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/onboarding-recommend/result__phone-390-dark-en.png).

Raise the contrast of secondary text and structural dividers. Verify actual rendered colors against WCAG AA: 4.5:1 for normal text and 3:1 for large text and meaningful controls. Small orange text should not be assumed accessible simply because it is the accent.

### 8. Navigation semantics and active-workout ergonomics need normalization

Across flows, `Cancel`, `Back`, `Close`, `Done`, chevrons, and bottom actions overlap in purpose. Some long onboarding screens lose their step context as the user scrolls.

The active [workout list](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/workout/list__phone-390-light-en.png) also retains the global application dock while showing workout navigation, day tabs, skip controls, and logging actions. That creates accidental-exit risk during a high-attention, one-handed activity.

Use a consistent grammar:

- **Cancel** exits a flow.
- **Back** returns to the previous step.
- **Close** dismisses a sheet.
- **Done** commits or finishes.
- Hide or demote the global dock during an active workout.
- Make workout controls at least 44×44px and provide safe-area padding.

## Screen-specific findings

| Area | Issues and recommended changes |
|---|---|
| **Today** | Strong title-to-primary-action hierarchy. Separate “Week 4 of 6” from “0 of 3 sessions completed”; their adjacent progress treatments suggest a contradiction. Keep the clear Start Workout CTA and compact exercise preview. |
| **Workout** | The current-set hierarchy and rest timer are excellent. Reduce simultaneous controls, enlarge steppers, and make “focus” versus “list” modes explicit. Condense [Why this weight?](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/workout/why-this-weight__phone-390-light-en.png) to a conclusion plus optional calculation details. |
| **History** | Compress the large gap between calendar and recent sessions. Replace tiny orange date dots with a stronger selected/session state and a legend. Move dense set editing into a drill-in screen. |
| **Progress** | Five tabs are too small for phone use and will not survive text scaling. Use scrollable tabs with a visible overflow cue or a section selector. Show the three most important “Needs attention” items, then disclose the rest. Remove decorative tracks from [PR rows](https://github.com/pedrochagasmaster/repforge/blob/6681f130d5e003153fd10cc470141b0d9175d583/docs/ui-screens/screens/progress/prs__phone-390-light-en.png) when they encode no quantity. |
| **Program** | The overview is one of the cleanest screens. The editor becomes nested-card-heavy; use summary rows and dedicated edit sheets. Consolidate the multiple exercise pickers into one responsive component. |
| **Library** | The exercise illustrations and muscle information are a signature strength. Preserve them. Fix clipped filter chips and strengthen full-row selection instead of relying on tiny circles. Rename “Understand Why this weight?” to “Why this weight?” |
| **Settings** | The IA is broadly clear. Privacy copy is too long for a settings surface; present a one-sentence choice, then disclose “What is shared.” Switch states should not depend on color alone. |
| **Install and tour** | The iOS instructions are concrete and effective. The install banner competes with Today’s primary action. Offer installation after a successful workout or from Settings. Reduce the 11-step tour to 3–5 contextual tips and replace the tiny dot sequence with “1 of 4.” |
| **Browse** | Catalogue entries expose too much technical specification at once. Lead with frequency, duration, level, and main differentiator; move progression mechanics into details. Add filters when catalogue size warrants them. |
| **Build/import** | Import source selection is clear, but Cancel plus Back is redundant. Older [import-review and quick-add captures](https://github.com/pedrochagasmaster/repforge/tree/6681f130d5e003153fd10cc470141b0d9175d583/docs/design/library) show the same overpacked inline-control problem; resolve one ambiguous exercise at a time. |
| **Shared program** | The flow lacks creator trust signals. Show creator name/avatar, real program title, short description, days/week, duration, privacy, and what happens next. Use “Review program” at the gate and reserve “Use program” for the final commit. |
| **Session summary** | Clear success feedback and useful statistics. Clarify “5 lifts” versus “5 sets.” Keep semantic green for actual positive change, but define it as an explicit exception to the single-accent brand palette. |

## Prioritized recommendations

### P0: Release blockers

1. Rebuild responsive behavior for 320px and 200% text instead of scaling fixed layouts.
2. Put a meaningful program-creation action above the fold on first run.
3. Eliminate raw localization keys and complete the Portuguese journeys.
4. Resolve clipped tables, controls, headings, and bottom-dock overlap.
5. Validate dark-theme contrast and minimum touch targets.

### P1: High-impact product improvements

6. Merge Recommend and Custom into one guided builder with Basic and Advanced paths.
7. Combine redundant result/review screens and add persistent flow navigation.
8. Replace phone tables with responsive summary rows and drill-in detail.
9. Create a focused active-workout shell without the global navigation dock.
10. Improve shared-program identity and creator trust.
11. Normalize CTA and navigation language. For example, replace the wrapping “Archive current program and use this one” with **Replace current program**, explaining archiving above the button.

### P2: System refinement

12. Remove 30–40% of uppercase eyebrows, dividers, and nonessential cards.
13. Consolidate picker, tag, filter, and selection patterns into shared components.
14. Rewrite technical or system-sounding copy such as “Same answers and rules always produce the same result,” “Nothing had to be traded off,” and implementation details about cookies, `index.html`, or compression.
15. Turn the Progress review into an actionable recommendation with one or two next steps rather than a prose-only report.

## What is working well and should be preserved

- The cream, black, and burnt-orange identity is memorable and brand-specific.
- The bull mark and exercise illustrations prevent the product from feeling like a generic fitness template.
- Typography is confident and especially effective on Today, workout focus, and program overview.
- The core bottom dock is simple and understandable outside active workouts.
- Current-set logging and the rest timer have strong hierarchy.
- Recovery and safety states are thoughtful: activation conflicts, replacement confirmation, resume recovery, and discomfort warnings.
- “Why this weight?” creates valuable transparency and differentiation.
- Light, dark, Portuguese, 320/390/430px, text-scaling, and reduced-motion captures represent unusually good visual-QA coverage.
- Taurifer avoids the most obvious AI-design clichés: purple gradients, generic glassmorphism, fake dashboard charts, and interchangeable three-card layouts.

Static PNGs cannot verify screen-reader semantics, keyboard order, runtime animation timing, tactile feedback, or actual reduced-motion behavior. Those need an interaction-level accessibility pass after the P0 layout corrections. No repository files were modified.
