# Plan 058 semantic contract (P1–P3)

This contract was derived from the production scenarios at `78492da2`: 143
mobile catalog screens, 819 frames, and a fresh Chromium render of every
canonical 390px light/English state. `tools/ui-role-inventory.json` owns the
exact selector and state mapping. Plan 058 P4–P7 migrate and verify consumers;
they do not need to choose a new role vocabulary.

## Layers

| Role | Meaning | Boundary and depth | Existing owners |
| --- | --- | --- | --- |
| `flat` | Ordinary reading, data, grouping, and editable page content | Whitespace or decorative rule; no outward shadow | All base views, Progress evidence, History lists, Program rows |
| `selected` | A chosen option or active destination | Inset high-contrast boundary or fill, no outward shadow | Choice cards, selected chips/tabs, nav destination |
| `floating` | Temporarily raised local tool | Theme-aware outward shadow and boundary | Focus card, menus, toast |
| `modal` | Layer that owns attention and blocks the parent task | Scrim and stronger depth where the layer has a card | Sheets, dialogs, first-run gate, summary |
| `persistent-action` | Actions/navigation kept reachable while content scrolls | Shallow edge and depth; no second raised card inside | Main nav and Program edit dock, summary Done bar |

The first-run gate and full-screen summary are modal by interaction, even
without a visible modal card shadow. The orange outlined recommendation card
is a featured **primary action**, not a selected choice. The normal nav is a
floating capsule; Program edit uses a flush dock variant of the same
`persistent-action` role. A selected child may live inside an elevated layer;
a second outward shadow may not, except for a true positioned overlay. Brand
artwork plates are the exact exceptions in the inventory.

## Controls

The control role answers what an action does. A visual treatment does not
change its role.

| Role | Meaning | Specific distinction |
| --- | --- | --- |
| `primary` | Commits or advances the main task | Start, save, activate, Done, featured recommendation |
| `secondary` | Supporting, reversible action | Replace exercise, retry, copy, add, repeat; not Remove |
| `quiet-navigation` | Changes view, returns, or dismisses without mutating training data | Back/close and drill-in rows; dismiss is an explicit variant |
| `destructive` | Removes or discards user work | Remove, delete, reset, start over; confirmation stays explicit |
| `disclosure` | Expands/collapses content on this view | `aria-expanded`; a chevron on a navigation row does not make it disclosure |
| `selection` | Chooses an option or toggles a reversible state | Choice cards, tabs, switches, Skip/Restore, unit/language/theme |
| `adjustment` | Repeatedly changes a numeric value | Workout stepper is rapid; Program stepper is deliberate |
| `field` | Accepts or edits a typed/native value | Text, numeric, select, textarea; invalid state belongs to the field |

`icon-only` and `disabled` are facets of those roles, not alternative action
intents. Every icon-only control needs an accessible name and the same 44px
target/focus rules. A disabled control has native/ARIA disabled semantics;
its explanation remains readable. `horizontal-scroller` is a region affordance,
not a button role. Shared states are default, hover (pointer only), pressed,
focus-visible, selected where applicable, disabled with reason, validation
error, and loading. A state that does not apply to a role is not synthesized.
The destination dock has an exact `neverDisabledReason`: top-level destinations
remain reachable and show their own empty states. Every other inventoried
control declares its disabled state. The checker requires default and focus
states for every control and an explicit reason wherever disabled is omitted.

The inventory assigns every visible control a role in its catalog state.
Exceptions and variants are selector-exact; they are not blanket style
exemptions. P4 may apply shared role tokens to consumers, but may not map a
stepper to selection or a drill-in chevron to disclosure for styling ease.

### Permitted contextual variants

The inventory lists the exact affected catalog states and rationale for each
variant. These selectors may use a distinct recipe within their parent role;
they do not create new roles.

| Variant | Exact selector | Parent role |
| --- | --- | --- |
| Rapid workout stepper | `.stepbtn` | adjustment |
| Deliberate Program stepper | `button[data-role="adjust"]` | adjustment |
| Floating navigation capsule | `nav` | persistent-action |
| Flush Program edit dock | `body:has(#program.program-editor-installed) nav` | persistent-action |
| Featured entry action | `.entry-card--primary` | primary |
| Accent-filled first-run start | `#firstRunCreate`, `#firstRunCreateClose`, `#firstRunSharedStart` | primary |
| Bordered first-run import route | `#firstRunImport`, `#firstRunImportClose` | quiet-navigation |
| First-run device-stage radius | `.firstrun-stage` (including `.firstrun-stage--signature-crop`) | radius:landing-device-stage |
| Full-screen entry gate | `#firstRun` | modal |
| Full-screen saved-session summary | `#sessionSummary` | modal |
| Scope-dependent volume indicator | `#volumeDash .vrow__bar` | week or block from selected scope |
| First-run headline | `.firstrun .firstrun-hero__title` | landing headline type |
| First-run climax data | `.firstrun-pull--climax .firstrun-pull__value` | landing Mono data type |
| Saved-session hero | `.sum-hero` | summary hero type |
| Responsive rest clock | `.restdial__clock` | rest clock type |

The two creation buttons share one `landing-accent-primary` recipe. Both open
the same main creation route without saving a program. `#firstRunSharedStart`
uses the same accent-filled primary treatment to advance a received program
to review; it is the only other consumer of that treatment on the first-run
gate. The two import buttons share one `landing-bordered-navigation` recipe.
Both open the same import route without committing training state. The closing
chapter repeats the same actions, so its placement does not create another
control intent or color treatment. The recipe selectors name all five IDs
exactly: creation and import in `onboarding-start/first-run` and
`onboarding-shared/invalid`, plus received-program Start in
`onboarding-shared/gate`.
The existing featured entry action is an outlined recommendation card on the
subsequent chooser, so it cannot supply either landing recipe.

| State | `landing-accent-primary` | `landing-bordered-navigation` |
| --- | --- | --- |
| Default | `background: --color-action-text`; `color: --color-action-on-fill`; border the same as the fill, decorative | `background: --bg` (opaque paper); `color: --color-ink`; `border-color: --color-action-text`, required |
| Hover | Keep the default colors and boundary; do not substitute the ordinary CTA ground | `background: --well`; keep default ink and required accent boundary |
| Pressed | Keep the hover colors and boundary; use shared `--control-pressed-transform` | Keep the hover colors and boundary; use shared `--control-pressed-transform` |
| Focus visible | Keep default colors; use `--control-focus-outline` with 2px outside offset | Keep default colors and required boundary; use `--control-focus-outline` with 2px outside offset |
| Disabled | Native disabled state, `background: --control-primary-disabled-bg`, `color: --color-ink`, decorative transparent border, full opacity, no hover/press; explain unavailability in separate readable text | Native disabled state, `background: --bg`, `color: --color-disabled-reason`, decorative `--boundary-decorative` border, full opacity, no hover/press; explain unavailability in separate readable text |

The aliases resolve in light to burnt orange `#B8410E`, white fill ink,
paper `#F4F2EF`, hover paper `#FAF8F5`, and dark ink `#1B1A17`.
In dark they resolve to orange `#FF8A3D`, dark fill ink `#231A14`,
paper `#141310`, hover paper `#191713`, and light ink `#F2EFE9`.
The accent-filled label measures 5.53:1 in light and 7.28:1 in dark.
The import label exceeds 15:1 on both paper states; its required accent
boundary measures at least 4.95:1 in light and 7.63:1 in dark. The
focus outline measures at least 3.57:1 against the page in light and 6.33:1
in dark. Disabled labels retain at least 4.5:1 without opacity, while the
separate reason keeps the shared disabled-reason treatment. No new palette
value or global control recipe is needed.

### Entry hub import doors

In `onboarding-start/hub-own-open`, `#entryFreeformStart` and the secondary
`[data-entry-route="import"]` card both enter the `import` route. Each sets
`uiPrefs.importSourceMode` so the route opens on the subview named by that
card and can resume with the last-used source. This device-only preference is
route context; it does not commit a program or leave either hub card selected.
The file path retains its confirmation before discarding staged freeform work.
Both cards are `quiet-navigation` with the existing `entry-alternative`
component variant, no facet, and default, hover, pressed, focus-visible, and
disabled states. `#entryFreeformStart` keeps its exact selector because its ID
excludes it from `.entry-card.entry-card--secondary:not([id])`, which owns the
file card and the other secondary route cards. No selected state or new recipe
is implied by remembering the source.

### Import-mode subview switches

On the Import route, `#entryFreeformSwitch` navigates from the File subview to
the Freeform subview, and `#entryFreeformFile` navigates back to File. Both call
`setImportSourceMode()`, which records `uiPrefs.importSourceMode` as device-only
UI route context and does not mutate training state. Each switch disappears
when its destination subview renders; the active subview itself carries the
current mode. Both controls are ordinary `quiet-navigation` ghost buttons with
no contextual variant or facet, and have default, hover, pressed,
focus-visible, and disabled states. Neither remains selected, and neither uses
`aria-selected` or `aria-pressed`.

### Import review mapping actions

The ordinary `.improw__btn:not(.improw__btn--change):not([id])` controls choose
the proposed exercise mapping or keep the imported exercise as-is. Their
selection completes the row decision, after which these alternatives leave the
row and the chosen target is rendered as row content. They are `selection`
controls without a selected state, variant, or facet.

`.improw__btn.improw__btn--change:not([id])` reopens the mapping alternatives
for a settled row. It preserves the current decision, changes the row from its
summary to its editing choices, and disappears when that view is rendered. It
is `quiet-navigation`, with no variant, facet, or selected state. The active
row already represents the current decision; neither role requires
`aria-selected` or `aria-pressed` on these one-shot controls. The separate
`.improw__more` disclosure remains responsible for expanding its options in
place.

### Exercise-preference selection

The two search-result buttons at `.entry__exercise-action:not([id])` belong
only to `onboarding-custom/exercise-preferences`. Include adds that exercise
to `mustHaveExercises`. Avoid opens the required reason choice; choosing a
reason adds an `exerciseConstraints` exclusion. Both are reversible selections.
Neither button remains selected: after activation its exercise leaves search
results and appears under the separately named Include or Avoid list, where
Remove reverses it. `aria-pressed` and `aria-selected` would misdescribe these
one-shot buttons; the selected list and reason radio group carry the resulting
state. Each repeated button needs an accessible name that includes its exercise,
such as "Include Barbell back squat" or "Avoid Barbell back squat".

The old accent-tinted *unselected* Include button is legacy visual emphasis,
not a distinct state or control intent. Both buttons use the ordinary selection
recipe, with no contextual variant or Include/Avoid visual facet. Their labels,
exercise-specific names, resulting lists, and required Avoid reason carry the
meaning. P4 must apply these states to both buttons:

| State | Both Include and Avoid search-result buttons |
| --- | --- |
| Default | `--control-selection-bg`, `--control-selection-ink`, required `--control-selection-boundary` |
| Hover | `--well` background; keep default ink and required boundary |
| Pressed | Keep hover colors and boundary; use `--control-pressed-transform` |
| Focus visible | Keep default colors and boundary; use `--control-focus-outline` with 2px outside offset |
| Selected | No selected state on either button. The chosen exercise moves to its separately named Include or Avoid list with a Remove action; list membership and its heading identify the committed preference. |
| Disabled | Native disabled state, full opacity, `--control-selection-bg`, `--color-disabled-reason`, decorative `--boundary-decorative` border, no hover/press, and a separate readable reason. |

Both buttons retain the shared 44px target and visible focus treatment.
The existing semantic tokens resolve in both themes. Required default boundaries
and focus outlines must meet 3:1; button text and disabled reasons must meet
4.5:1 against their composited surfaces. An accent-tinted unselected button
must not masquerade as a selected exercise.

## Progress

| Dimension | Denominator and scope | Production selectors |
| --- | --- | --- |
| `block` | Current week within active training block, or block review evidence | `#todayProgram .segbar`, `#programOverview .segbar`, `.blockprogress` |
| `week` | Sessions, trained days, or muscle sets against the current week's plan | `#todayWeek .week-letters`, `#thisWeek .ov-week-bar`, `#sessionSummary .sum-segbar`, `#overviewVolume .vrow__bar` |
| `exercise-set` | Exercise position in an active workout | `#woProgress .segbar--ex` |
| `task` | Step of entry or exercise-picker workflow | `#onbSegbar`, `#libStep` |

`#volumeDash .vrow__bar` changes between `week` (`this-week`) and `block`
(`block-to-date`) with the selected scope. Every listed indicator carries
`data-progress-dimension` and `data-progress-scope` on the rendered element.
The adjacent copy supplies the accessible value. A rest countdown is temporal
status. The completed-volume comparison bar is a relative data visualization
with no goal denominator. These two have selector-exact exclusions from the
four-dimensional checker. The old `#volume` Program distribution bar has no
reachable catalog state: its host is hidden outside installed edit mode, and
installed edit mode hides the bar. It is dead presentation code for P6 removal,
not an exception to the live progress contract. The review
evidence container uses `block` to identify its scope, but its prose is not a
second numeric progress bar. Do not remove two marks solely because they share
a dimension: prove that their denominator, value, scope, and accessible copy
are duplicates first.

## Type, shape, depth, and color

Plex Sans is for language and controls; Plex Mono is for loads, reps, RIR,
time, counts, and visible technical IDs. Choose by value, not ancestry.
Type sizes are `label` 11px, `caption` 12px, `body-small` 14px, `body/control`
16px, `subtitle` 18px, `metric` 22px, `section-title` 24px,
`feature-title`/`focal-data` 28px, `title` 30px, and `display` 40px at the
default root size. `metric` is a prominent numeric value, `section-title`
names a section or sheet, `feature-title` names a focal exercise, program,
result, or editorial beat, and `focal-data` is the Mono workout value that
anchors the current task. The two 28px roles share one scale step but keep
their content and font-family meanings distinct. These intermediate roles
close the gap between the preliminary 18px
and 30px tiers in the live product; they are general roles, not one-off
exceptions. Page titles use `title`, and full display statements use
`display`. Controls and prose use the 16px roles even where a legacy rule uses
15px or 17px. Structural labels and supporting notes use label, caption, or
body-small according to whether they carry essential information.
Line heights are tight 1.1, standard 1.4, reading 1.55; weights are 400, 500,
600. Labels/captions cannot be the sole critical control text. Four exact
contextual variants protect established hierarchy: the Plan 054 first-run
headline (38px, 52px wide), its Mono climax data (`min(68px,16vw)`, then
`min(88px,7.5vw)` wide), the Plan 057 summary hero (34px), and the responsive
Mono rest clock (`clamp(32px,10vw,42px)`). Their selectors and catalog owners
are in the inventory; no other surface inherits them by visual resemblance.
Text glyphs used as control icons use `--control-icon-size` within the common
44px target; their glyph size is independent of the action label's type role.
P4 maps old sizes to the roles above by the named content job and checks 200%
fit. It may not introduce a new size because a legacy literal falls between
tiers; a genuinely new content job requires P2 contract review.

Radius roles are none 0, compact 4px, control 8px, surface 12px,
prominent/modal 16px, pill 999px, round 50%. The old 14px `--radius`/`--r`
value is a named `--radius-legacy` compatibility alias: mapping it to 12px or
16px before consumer review would change approved geometry. The old `--shadow`
is an alias to flat elevation. Elevation tokens use theme-specific shadow
channels so the dark theme never casts pale shadows. `--elevation-focus-shadow`
keeps the movable Focus card's two-level depth;
`--elevation-nav-shadow` preserves the glass dock's edge and drop shadow;
`--elevation-program-dock-shadow` preserves the flush Program edit bar. Modal
sheets and dialogs have separate depth tokens, while the full-screen gate and
summary keep their interaction role without being forced into card depth.
New rules use semantic tokens; P4–P6 remove literal debt and the legacy aliases
after consumers move.

The owner-directed Plan 054 composition has one exact
`landing-device-stage-radius` recipe outside the reusable radius scale. Large
product-render plates use `--radius-landing-stage:24px`. At
`@media (max-width:340px)`, `.firstrun-stage` uses
`--radius-landing-stage-compact:20px`. The smaller overlapping reasoning crop
uses `--radius-landing-crop:14px` above 340px. The compact rule follows the
crop rule, so the crop also resolves to 20px at 320px. This matches the
rendered page at `300de203`. These are stage-composition values, not general
radius steps or exceptions. Only `.firstrun-stage` and its
`.firstrun-stage--signature-crop` subtype in the three first-run gate catalog
states own the recipe. P4a's 16px mapping changes their established framing;
the consumer must use the named tokens.

Control tokens follow intent: primary commits use the CTA ground/ink,
secondary and adjustment controls use the ordinary surface and required
boundary, quiet navigation and disclosure use an unfilled surface with legible
ink, destructive actions use the danger ink with a required boundary when
their shape carries the affordance, selection uses a required boundary and
the selected fill/boundary when chosen, and fields use the ordinary surface,
ink, and required boundary. The featured Plan 054 entry action keeps its
declared accent-outline variant. The first-run creation and import controls
keep the two selector-exact landing recipes above; the import hairline is a
required boundary even though the action remains quiet navigation. Focus and
Program steppers retain their
declared rapid/deliberate variants. Pressed, focus, disabled, and error
tokens are shared facets. A visible label does not become an icon simply
because a CSS pseudo-element draws an arrow.

Brand orange remains action/decorative emphasis. Small accent text uses
`--accent-deep`; filled accent uses `--accent-ink`.
`--color-action-text` is a foreground color job shared by differently intended
controls, not a quiet-navigation variant: existing accent links include Back,
Edit, and Clear. Improved, declined, maintained, warning, destructive,
disabled explanation, focus, required
boundary, decorative separator, surface, and ink hierarchy are separate
semantic roles even if two currently share a palette value. Required control
boundaries use the high-contrast boundary token. Decorative rules may use
`--rule` and are never the sole cue for a control. Measure text against its
actual composited surface at 4.5:1 (or 3:1 for large text) and required
non-text boundaries, icons, state marks, and focus at 3:1. An unresolved image,
gradient, opacity, or glass background is `unsupported`, not a pass.

The inventory marks choice outlines/fills, field extents, selected tabs/nav,
progress segments, and the rest arc as `required`. Their visual state must
reach the non-text threshold where it supplies the affordance or value.
Read-only row separators, the block-review prose container, relative comparison
tracks with explicit values, and Safari teaching artwork are `decorative`.
These marks may be quieter only because text, labels, or a separate required
indicator carries the meaning. A P4 migration cannot demote a required mark
to decorative merely to make a contrast failure disappear.

## Exact exceptions and catalog reachability

The JSON inventory owns the catalog-state arrays and these six exact
selectors. None is a subtree waiver.

| Selector | Exception | Rendered catalog states |
| --- | --- | --- |
| `.settings-identity__mark` | Brand artwork's paper and small shadow, not elevated Settings content | `settings/main`, `settings/appearance`, `settings/guides`, `settings/guides-replay`, `settings/privacy` |
| `.firstrun__logo` | Ground-free mark's dark paper plate | `onboarding-start/first-run`, `onboarding-shared/preview`, `onboarding-shared/gate`, `onboarding-shared/invalid` |
| `.exdet-art` | Licensed illustration's sampled `mediaBg` and reviewed fallback paper | `library/exercise-preview`, `library/exercise-detail` |
| `#restSheet .restdial__arc` | Rest countdown status, not workflow progress | `workout/rest-timer` |
| `#completedVolume .vrow__bar` | Relative completed-muscle comparison, no target | `progress/volume`, `progress/overview`, `progress/overview-action`, `progress/overview-baseline`, `progress/exercise-chart` |
| `.safaribar__side` | Decorative Safari teaching artwork, not a live control | `install/ios-sheet`, `install/transfer-ready` |

Three owned controls do not appear in the canonical catalog frames:
`#glossary` opens only after a term tap, `#restBar` requires a running timer,
and `#libBar` requires an exercise-picker choice. The inventory marks each
`sourceOnly` with a reason and its affected surface states. Their roles are
frozen, while P4/P7 should add a state when migrating their surface so their
rendered appearance is proven rather than inferred from source.

## Executable ownership

`node tools/check-ui-system.mjs` renders every canonical catalog state and
rejects unmapped/ambiguous visible controls, illegal nested elevation, and
unnamed progress. It reports current CSS literal debt; `--strict-css` becomes
the P6 zero-debt gate. `node test/ui-system.mjs` seeds bad literal, contrast,
focus, boundary, selector, and dimension cases and proves rejection. P5 expands
rendered role coverage to all locales/themes/states. P4 migrates one surface
at a time in the order stated by Plan 058. P6 removes aliases and closes
literal debt; P7 regenerates/reviews the entire catalog and required device
matrix. This document and the inventory are the role authority until an
explicit P2/P3 contract review changes them.

## Luna Max execution handoff

The foundation starts with 704 reported CSS literal declarations. This is
P4–P6 migration debt, not an allowlist; `--strict-css` is expected to fail
until P6. Use `node tools/check-ui-system.mjs --metadata` for a quick contract
check, `node test/ui-system.mjs` for deliberate failure and token proofs,
`node tools/check-ui-system.mjs` for all 143 live states, and
`node tools/check-ui-screens.mjs` for the 819-frame catalog. Run
`node tools/check-ui-system.mjs --state <flow/screen> --verbose` to reproduce
a single catalog failure without re-rendering the whole catalog. Run
`node tools/run-tests.mjs affected --base origin/main` after each coherent
slice, then the final plan-required CI gate. The exact affected state and
selector lists are in `tools/ui-role-inventory.json`; update them only after
rendered evidence proves the live ownership changed.

Proceed in Plan 058 order: P4a entry/landing, P4b Today/Focus/summary, P4c
Progress, P4d History/Share/Program/Settings/library/install/help. Migrate
consumers to the named roles while keeping each Plan 054–057 interaction and
state contract. P5 extends the computed-role AA check to every relevant
theme, locale, and state. P6 removes the legacy aliases, the old hidden
`#volume` presentation path, dead selectors, and remaining literal debt;
`node tools/check-ui-system.mjs --strict-css` must then pass. P6 also needs the
owner visual board approval specified in the plan. P7 regenerates and reviews
the complete catalog and responsive/theme/text/reduced/installed matrix.
The PR for this foundation remains separate from those migrations and is not
merge authorization.
