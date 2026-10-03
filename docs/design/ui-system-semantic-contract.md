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

On Today, `#readyLine` is a supporting `secondary` action. It appears only when
the current day has a lift with an add-load recommendation and opens Focus on
the first such lift, creating or resuming its reversible workout draft. The
primary Start workout action remains the screen commitment.

In the setup-link Share sheet, `#shareSetupShare` is `primary`: after a valid
link exists, it advances the main sharing task by opening the user-mediated
system Share sheet. The lifter can cancel there without changing Taurifer
state; that cancellation does not make the task action secondary. `#shareSetupCopy`
remains `secondary` as the reversible supporting path.

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
| Responsive rest clock | `.restinline__clock` | rest clock type |

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
status (the inline rest's drain bar, `.restinline__fill`). The completed-volume comparison bar is a relative data visualization
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
600. Labels/captions cannot be the sole critical control text. Two exact
contextual variants protect established hierarchy: the Plan 054 first-run
headline (38px, 52px wide) and the responsive Mono rest clock
(`clamp(2rem,10cqi,2.625rem)` since the Plan 064 R3f amendment below). The
Plan 054 climax data (`min(68px,16vw)`, then `min(88px,7.5vw)` wide) retired
with the landing it belonged to, and its tokens are gone. Their selectors and
catalog owners are in the inventory; no other surface inherits them by visual
resemblance. The saved-session summary hero (`.sum-hero`) is not
a variant: it uses the `--font-size-title` role at 30px, the same step as page
titles (owner decision, #295 comment 5965828337).
Text glyphs used as control icons use `--control-icon-size` within the common
44px target; their glyph size is independent of the action label's type role.
P4 maps old sizes to the roles above by the named content job and checks 200%
fit. It may not introduce a new size because a legacy literal falls between
tiers; a genuinely new content job requires P2 contract review.

Radius roles are none 0, compact 4px, control 8px, surface 12px,
prominent/modal 16px, pill 999px, round 50%. During migration, the old 14px
`--radius`/`--r` pair and `--radius-legacy`, the old `--shadow` alias, and the
`--display`, `--body`, and `--mono` font aliases were compatibility paths, not
target semantic roles. P6 migrated their live consumers to named roles and
removed those aliases; the strict source scan rejects their reintroduction.
The 14px radius was not mechanically normalized: consumers now reference the
reviewed radius role for their own geometry. Elevation tokens use
theme-specific shadow channels so the dark theme never casts pale shadows.
`--elevation-focus-shadow` keeps the movable Focus card's two-level depth;
`--elevation-nav-shadow` preserves the glass dock's edge and drop shadow;
`--elevation-program-dock-shadow` preserves the flush Program edit bar. Modal
sheets and dialogs have separate depth tokens, while the full-screen gate and
summary keep their interaction role without being forced into card depth.
New rules use semantic tokens; the P6 final proof enforces zero in-scope CSS
literal declarations and obsolete alias references, with only the six
selector-exact inventory exceptions remaining.

P6's focused root helper recipes do not add semantic roles. The inventory's
`rootRecipeOwners` maps each one to its existing typography, floating, modal,
selected, focus-visible, selection, required-boundary, or warning role and its
catalog owners. Keep the lighter anchored popover and the stronger effort
explanation as floating contexts even where a shadow value matches another
role; keep the two nav lens recipes separate because their paint layers differ.
The same required-boundary keyline serves both the featured primary card and a
selected choice without merging those controls' roles.

Interaction timing and motion ownership remain governed by
[`docs/design/interaction-runtime-audit.md`](interaction-runtime-audit.md).
Its CSS-retained entries name the task or surface owner and explain why these
high-frequency acknowledgements, transitions, hover corrections, and reduced-
motion paths stay stylesheet-driven. `motion-polish.css` implements those
existing interaction owners; it does not define a second palette, type scale,
elevation system, or control role. P6's strict debt proof scans it alongside
`styles.css`. The selector families below make that ownership concrete without
creating another role inventory:

| `motion-polish.css` selectors | Existing semantic owner | Interaction evidence |
| --- | --- | --- |
| `.view`, `.btn`, `.btn:active`, `nav button:active` | Navigation and action-control roles | Navigation and button feedback in the interaction audit |
| `.ledger__row.is-fresh`, `.ledger__row.is-fresh .ledger__check`, `.ledger__tick.is-fresh`, `.focus-ex__setof.is-fresh b` | Workout set acknowledgement | Set completion rows in the interaction audit |
| `.effortpop`, `.effortpop.is-open`, `.effortpop.is-closing`, `.effortpop.is-open .effortpop__arrow`, `.effortpop.is-bump .effortpop__hint` | Floating effort explanation | Effort/RIR explainer row in the interaction audit |
| `.toast`, `.toast.hidden`, `.tour`, `.tour.hidden`, `.installbanner`, `.installbanner.hidden`, `@starting-style` for `.toast:not(.hidden)`, `.tour:not(.hidden)`, and `.installbanner:not(.hidden)` | Status notice, coach overlay and install action | Transient runtime UI rows in the interaction audit |
| `.toggle::after` and its selected/pressed facets | Reversible selection control | Toggle owner in the UI-role inventory; reduced-motion alternate remains in the interaction audit |
| The selectors inside `(hover:none), (pointer:coarse)` | Their existing button, selection, destructive, navigation, and disclosure roles | Per-control hover corrections in the interaction audit; this media rule restores the registered resting treatment on touch devices |
| `.exercise:not(.is-skipped) .ex__topend .ex__skip:hover` | Workout skipped-action selection | Retained for the pinned pre-058 `app.js` (`3fbae92f`) used by old-client workout-draft scenarios; current owner is the workout selection role |
| `.entry__exercise-action--avoid:hover` | Entry exercise-selection control | Retained for the pinned pre-058 `app.js` (`3fbae92f`) used by the old-client entry/draft-conflict scenario; current owner is the entry selection role |

The current `styles.css` also retains one selector for that pinned old app:
`.tour-rest-hint` is the small supporting caption generated by the pre-058
rest-preview tour (`app.js` at `3fbae92f`, `tour.rest_preview_hint`). Its owner
is the rest-preview guidance caption. Current app.js does not emit it; it stays
because the old-client workout-draft scenarios run against the current shell.

The reduced-motion selector list follows the same owners: it removes animation
from their motion facets and leaves the semantic state, contrast, and control
geometry in the owning `styles.css` recipe.

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
progress segments, and the rest drain bar as `required`. Their visual state must
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
| `.restinline__fill` | Rest countdown status (the inline drain bar), not workflow progress | `workout/rest-running` |
| `#completedVolume .vrow__bar` | Relative completed-muscle comparison, no target | `progress/volume`, `progress/overview`, `progress/overview-action`, `progress/overview-baseline`, `progress/exercise-chart` |
| `.safaribar__side` | Decorative Safari teaching artwork, not a live control | `install/ios-sheet`, `install/transfer-ready` |

P6 adds production-backed rendered states for these contextual controls:
`#glossary` is open in `workout/focus-glossary` and
`library/exercise-detail-glossary`, `#restBar` is visible in
`today/rest-bar`, and `#libBar` is visible in `library/list-selected`.
Their scenarios activate each control through its user action and leave the
surrounding surface in its real context, so contrast, geometry, and elevation
are measured rather than inferred from source.

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

## Execution reference

This file freezes the semantic roles. Current Plan 058 status, source and
catalog SHAs, live counts, owner decision, matrix, and proof results are
recorded in [the Plan 058 checkpoint](../../plans/058-design-system-convergence.md)
and draft PR #256. The former “Luna Max execution handoff” has been removed:
its 704-literal and 819-frame figures and older command guidance were initial
baseline facts, not current P6/P7 results.

Use `node tools/check-ui-system.mjs --state <flow/screen> --verbose` to
reproduce one rendered state. For selection inspection use
`node tools/run-tests.mjs affected --list --base <slice-base>`; the Plan 058
checkpoint records the current broad selection and local cutoff.

## Plan 064 contract review amendment (2026-10-01)

Plan 064 R1b amends this contract for the content jobs and tokens the owner
approved. The authority is two owner records on PR #295, and nothing here is
inferred from a prototype or a recommendation:

- OG-4: [owner decisions recorded, 2026-10-01](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5923364252)
  (the polish proposals, the seven content jobs and the routed choices).
- OG-1, OG-2, OG-3 and OG-5: [owner decisions recorded, 2026-10-01](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5923279555)
  (for the landing bands, OG-3).

The review that framed these choices is the "Contract review for Direction D
content jobs" section of `docs/design/plan-064-reconciliation.md`. Every value
below is either an existing palette value or token, or comes verbatim from the
pinned sources named in the tables: the Direction D review page at `2f2fc044`
(`docs/design/main-screen-directions/phone.css`) and the landing final page at
`336b492d` (`docs/design/landing-candidates/final/index.html`). No type size,
radius step, shadow value, control role or layer is added. Contrast ratios are
WCAG 2.x relative-luminance ratios over the opaque hex values in `styles.css`
(alpha pairs are composited over their field first), measured with
`contrastRatio` from `tools/ui-system-core.mjs`. The required floors are the
contract's: 4.5:1 for text, 3:1 for large text and for required boundaries,
icons and state marks.

R1b adds tokens and four unrendered shared components. It changes no existing
token value and no existing rule, so no rendered frame changes. The changes that
alter a rendered frame are named below as pending, each with the slice that
makes it.

### New tokens

Tokens that depend on the theme are declared in both theme blocks. Lengths are
declared once.

| Token | Light | Dark | Source of the value | Job |
| --- | --- | --- | --- | --- |
| `--boundary-selected-quiet` | `var(--ink)` | `var(--ink)` | `phone.css` `--boundary-selected-quiet:var(--ink)`; OG-4 "the quiet-selected boundary token aliases `--ink`" | The selected boundary where orange is rationed: shelf fields, the open ledger row, the tab indicator |
| `--elevation-selected-quiet-shadow` | `inset 0 0 0 2px var(--boundary-selected-quiet)` | same | The existing `--elevation-selected-shadow` recipe (2px inset) with the quiet boundary; OG-4 "2px contract recipe in ink ... no new width" | The ledger open row's ring |
| `--rule-on-surface` | `var(--rule)` | `var(--rule-strong)` | `phone.css` lines 53 and 90 | A decorative separator drawn on `--surface` (sheets, the shelf). Never the sole cue for a required mark |
| `--space-4`, `-8`, `-12`, `-14`, `-16`, `-18`, `-26`, `-32` | 4, 8, 12, 14, 16, 18, 26, 32 px | same | `phone.css` line 55, which copies the `DESIGN.md` `spacing` scale | Margins, padding and gaps in the redesigned surfaces |
| `--gut` | 16px | same | `phone.css` `--gut:16px`; `DESIGN.md` `gutter` | The page gutter. `--settings-inset` stays Settings-only |
| `--shelf-field-bg` | `var(--well)` | `var(--well)` | `phone.css` `--control-field-bg:var(--well)`; OG-4 "fields on `--well`" | Field ground, on the workout shelf only |
| `--shelf-pad-bg` | `var(--bg)` | `var(--bg)` | `phone.css` `--control-adjustment-bg:var(--bg)`; OG-4 "pads on `--bg`" | Pad ground, on the workout shelf only |
| `--band-night-bg` | `#141310` | `#141310` | The dark palette `--bg`; landing `.night` | Landing hero, proof band and footer ground |
| `--band-night-raised` | `#1E1C18` | `#1E1C18` | The dark palette `--surface` | Proof-band field |
| `--band-night-ink`, `-ink-soft`, `-ink-faint` | `#F2EFE9`, `#ADA79D`, `#99938A` | same | The dark palette `--ink`, `--ink-soft`, `--ink-faint` | Primary, supporting and faint text on the night band |
| `--band-night-rule` | `#2E2B26` | `#2E2B26` | The dark palette `--rule` | Decorative hairlines on the night band |
| `--band-night-accent`, `-accent-text` | `#F2703B`, `#FF8A3D` | same | The dark palette `--accent`, `--accent-deep` | Rail current step; proof result |
| `--band-night-boundary-required` | `var(--band-night-ink-soft)` | same | The dark palette `--boundary-required` (`--ink-soft`) | The two marks the final page draws in `#4A453D` (rail inactive step, "Abrir o app" pill border) |
| `--band-night-cta-bg`, `-cta-ink` | `#DED7CC`, `#161513` | same | The dark palette `--cta`, `--cta-ink` | A primary action on the night band |
| `--band-orange-bg` | `var(--accent)` | `var(--accent)` | Landing `--field:var(--accent)` | Orange stripe and closing band field |
| `--band-orange-ink` | `#141310` | `#141310` | Landing `--field-ink:#141310`; the dark palette `--bg` | Text and the action ground on the orange band |
| `--band-orange-cta-ink`, `-cta-mark` | `#F4F2EF`, `#F2703B` | same | Landing `.close .cta` and `.close .cta::after`; the light palette `--bg` and the dark palette `--accent` | Label and arrow on the action over the orange band |
| `--band-ink-bg`, `--band-ink-ink` | `var(--ink)`, `var(--bg)` | same | Landing `.ways .w3` | Ink band field and its primary text |
| `--band-ink-ink-soft`, `--band-ink-rule` | `rgba(var(--bg-rgb),.78)`, `rgba(var(--bg-rgb),.22)` | same | Landing `.ways .w3>p` (.78) and its `--rule` (.22) | Supporting text and a decorative hairline on the ink band |

The names `--band-*` and `--shelf-*` are R1b's. The values are not new: each
holds an existing palette value or token, or the verbatim source value above.
Where the light and dark columns read the same, a colour token is still declared in
both blocks so each theme block shows the whole set; the spacing lengths are not.

### Roles, variants and components

- **Quiet selection (OG-4).** The `selected` layer's recipe stays an inset
  2px boundary. Where orange is rationed it uses `--boundary-selected-quiet`
  (ink) instead of `--boundary-selected`. The contract gains no width, and
  1.5px is rejected. Consumers: the shelf field, the open ledger row, and the
  tab indicator.
- **Workout shelf (OG-4).** A "Workout shelf" contextual variant of
  `persistent-action` is added to the variants table above:

  | Variant | Exact selector | Parent role |
  | --- | --- | --- |
  | Workout shelf | `.workshelf` | persistent-action |

  Its recipe is a full-width surface with `--radius-prominent` on the top
  corners and none below (an existing radius step), a `--boundary-persistent`
  top edge and `--elevation-persistent-shadow`. Fields and pads carry a
  boundary and no shadow, so no second raised card sits inside. Within the
  shelf the field role's ground is `--well` and the adjustment role's ground is
  `--bg`; the override is scoped to `.workshelf`. The shelf's fields, pads and
  primary action keep the roles `selection`/`field`, `adjustment` and `primary`
  and are inventoried by R3c with the slice that renders them.
- **Ledger open row (OG-4).** `.ledgerline--open`, layer `selected`: a `--well`
  ground, `--radius-surface`, and the 2px quiet boundary. The row being
  corrected uses the same modifier. The decorative hairline of the flat row
  gives way to the ring.
- **Tab row (OG-4).** `.tabrow` with `.tabrow__tab`: each tab is `selection`
  at 44 by 44 or more, label `control` 16/500 (selected 600), unselected label
  `--color-ink-secondary`. The selected indicator is 2px in
  `--boundary-selected-quiet` instead of the shipped 2px `--accent`. The paper
  fade drawn while the row overflows is a gradient the rendered-role audit
  reports as `unsupported`, so it is not part of the component.
- **Frequency counts (OG-4).** `.freqcount`: flat and not interactive, one
  labelled image for assistive technology, bars in ink, a decorative
  `--boundary-decorative` baseline, and an optional planned marker on
  `--boundary-required`. The prototype's `--rule-strong` marker is not carried:
  it measures 1.31:1 in light and 1.95:1 in dark on `--bg`. Radii use
  `--radius-compact`, not the prototype's 2px. The progress classification of
  the per-week bars (a count against a planned denominator) is decided by R3j
  under the Progress section above, with evidence.
- **Spacing scale (OG-4).** The `--space-*` scale and `--gut` are named
  tokens. The contract still defines no spacing role, and `--strict-css` still
  scans only type, weight, radius, shadow and color, so the scale is a naming
  convention that new rules use, not an enforced one.
- **Decorative separators on surfaces (OG-4).** `--rule-on-surface` is the
  decorative separator inside sheets and the shelf: `--rule` in light and
  `--rule-strong` in dark. It is decorative only and never carries a required
  mark; a required boundary uses `--boundary-required`.

- **Verdict mark: hold and recover (2026-10-01).** The owner decided on
  [#295, comment 5937182678](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5937182678)
  that the shared `.verdictmark` gains two variants beside up, down and record:
  `.verdictmark--hold` draws "=" and `.verdictmark--recover` draws a clockwise
  return arrow (`↻`). Both are drawn masks (`--verdict-hold`, `--verdict-recover`,
  like `--arrow`, never typed characters) painted in `--color-ink`: orange stays
  the up glyph alone (section 8.8), so neither variant is accent. Stalled and new
  stay word-only. Today's rows and tally, the Why headline and the summary's next
  target draw them where the engine's verdict is hold or recover. No role, tier,
  radius or colour is added; `.verdictmark` keeps its inventory row.

- **Verdict mark: the maintained outcome (2026-10-01).** The owner decided on
  [#295, comment 5940349337](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5940349337)
  (recorded in Plan 064 section 8 rule 11 as amended) that one meaning has one
  glyph: the session outcome "Maintained" (PT "Manteve") draws the same ink "="
  as the hold recommendation, through `.verdictmark--maintained`, which reuses
  the `--verdict-hold` mask. Improved keeps the up arrow, the only accent mark,
  and Declined keeps its ink down arrow. Wherever an outcome word renders with
  `.verdictmark` (the session summary, the History session page, Progress'
  Strength rows) the maintained variant carries the glyph, and the Focus cue
  draws hold "=" and recover "↻" through the same shared mark. The word is still
  `--color-maintained`; the glyph is never the accent. No role, tier, radius or
  colour is added.

- **Icons: one set, G's (2026-10-01).** The owner decided Q-D on #295
  (comment 5927122354): onboarding direction G's glyphs are the app-wide icons
  through the shared mask mechanism, inventoried, so a name draws the same icon
  on the dock, Today and onboarding (Plan 064 section 8 rule 7). `.icon-mask--NAME`,
  `.chevron` (with `.is-down` and `.is-up`, and `.icon-mask--chev-down` and
  `--chev-up` drawn with rotated path coordinates, not a CSS transform) and the
  `--arrow` and `--check` tokens take G's drawings; the 24 grid, 1.75 stroke (2
  for check, arrow, plus, minus and close), round caps and joins and the 2.5px
  safe area are the set's. `tools/build-icon-masks.mjs` generates them into
  `styles.css`, one definition per name. History, note, overflow, rosette, skip,
  stop, timer and the dock's own glyphs were not drawn by G and keep their rules.
  No role, tier, radius or colour is added; icons stay `aria-hidden` beside their
  labels and an icon-only control keeps its accessible name and 44px target.

### Type role changes

- **Section heads (OG-4, proposal 2).** `section-title` (24px) now names a
  sheet or a page section. An in-flow section head, such as "Prescrição de
  hoje" and its peers, uses `subtitle` (18px/600). The type paragraph above,
  which says `section-title` "names a section or sheet", is read with this
  narrowing. Pending: the consumers move in the R3 slices that render them.
- **Focal exercise name (OG-4, proposal 1).** The Focus exercise name is
  `subtitle` 18px, not `feature-title` 28px. The `feature-title` definition
  above ("names a focal exercise, program, result, or editorial beat") is read
  without "focal exercise". Pending: the shipped `.focus-ex__name` moves in
  R3c.
- **Rest clock (OG-4, C-02).** The responsive rest clock variant adopts
  `clamp(2rem,10cqi,2.625rem)`. **Implemented in R3f (2026-10-02)**, see "Inline
  rest (R3f, 2026-10-02)" below. R1b did not change `--font-size-rest-clock` or
  any existing rule; R3f changes the token once, where it is defined. In the app
  `:root` is already the size container, so `10cqi` and `10vw` resolve to the
  same length on a phone to within a scrollbar width.

### Approved without an addition

- Content jobs 4, 6 and 7 (prescription row, sheet header band, rows on a
  first baseline) need no contract addition; R1a's components stand.
- Inline rest (job 3) follows from Direction D's ratified inline rest: the
  inline clock joins the rest-clock variant, and the inline drain bar gets a
  selector-exact temporal-status exception like the retired
  `#restSheet .restdial__arc` (it measures 3.05:1 in light and 4.80:1 in dark
  against its `--rule` track). **Implemented in R3f (2026-10-02)**; the drain
  bar does not match a progress candidate selector.
- Proposals 3, 4 and 5 (exercise-complete shelf, invalid-set reason string,
  overrun after Skip) change no role, tier or radius. Proposal 3 goes to an
  OG-6 drawing round before R3c builds it. The `body-small` reason beside the
  disabled primary action uses `--color-disabled-reason` (5.71:1 in light,
  7.12:1 in dark on `--surface`).
- Left to engineering and not owner choices: whether the Focus art tile needs a
  selector-exact exception (only if it paints the sampled paper), the frequency
  bars' progress classification (R3j), and the role of the cue line that
  returns after rest, which these owner records do not decide.

### Inline rest (R3f, 2026-10-02)

Plan 064 R3f builds Direction D's inline rest (D spec section 4.2, owner gate
OG-4 job 3) and retires the `rest-timer` sheet (C-07). The authority is the OG-4
record on PR #295 (the rest clock proposal C-02 and overrun after Skip,
proposal 5, both accepted) and the approved L3 motion amendment
(`docs/design/motion-rule-11-amendment.md`). No role, tier, radius or elevation
is added; every value below is an existing token.

- **C-02, the rest clock.** `--font-size-rest-clock` changes from
  `clamp(2rem,10vw,2.625rem)` to `clamp(2rem,10cqi,2.625rem)`, Direction D's
  value, in the one place it is defined. The "Responsive rest clock" variant
  stays selector-exact and its selector is now `.restinline__clock` alone: the
  dial's `.restdial__clock` retires with the sheet, and nothing else inherits the
  variant by visual resemblance. The role (rest clock type, Mono, `line-height`
  tight) is unchanged; at 360 px the clock is 36px.
- **The drain bar.** `.restinline__fill` (`--accent` on the `--rule` track of
  `.restinline__bar`, 4px, `--radius-compact`, driven by `transform: scaleX`) is
  a selector-exact countdown exception with the arc's rationale: it measures time
  left in this rest, so assigning block, week, exercise-set or task would falsify
  its denominator. Boundary `required`: it measures 3.05:1 (light) and 4.80:1
  (dark) against its track and 3.57:1 and 6.33:1 against `--bg`. It is not a
  progress candidate selector and declares no `data-progress-*`. It is the one
  orange mark a running timer is allowed (D spec section 8.8).
- **The rest pads.** The shelf's pad row is `-30s`, `Pausar`/`Retomar`, `+30s`,
  `Pular` while a rest runs. `.restpad--adjust` (the two nudges) is
  `adjustment`, `.restpad--toggle` is `selection` on the shelf's field ground and
  `.restpad--skip` is `secondary`, as `#restMinus`/`#restPlus`, the retired
  `#restPlayPause` and `#restStop` were in the sheet. They are 56px text pads, not
  the 44px icon steppers, so they do not take the "Rapid workout stepper" variant
  and carry no variant of their own. Four labels do not fit one row once the root
  font is above 16px, and a second row would push the shelf's action below the
  safe area at 320px with double-size text (`test/focus-geometry.mjs`), so at
  large text the field pads stay while a rest runs and the rest controls are the
  presets sheet's; the clock and the next cue stay inline (owner decision, #295
  comment 5948281184).
- **Overrun.** Past the bell, and after Pular, the line reads "Descanso
  concluído · +0:15" on `subtitle` in `--ink-soft` (5.11:1 and 7.78:1 on `--bg`),
  not the warning colour (decision 14). The header timer chip follows it: it
  counts up as "+0:15" in `--ink-soft` with no warning or danger treatment, and
  the `restover` pulse and its shadow tokens are retired (owner decision, #295
  comment 5948281184).
- **Retired with the sheet.** `#restPlayPause`, `#restSheetClock`,
  `#restDialArc`, `.restdial`, `.restdial__arc`, `.restdial__clock`, their rows,
  the `#restSheet .restdial__arc` exception, the `.restdial__arc` progress
  candidate selector and the `workout/rest-timer` and `workout/rest-timer-paused`
  catalog states. The presets sheet (`#restSheet`, `modal`) stays with its
  presets, `-30s`, `+30s`, Restart and End; no catalog state captures it open, so
  its rows are source-only (the calendar sheet's precedent), pending an OG-6
  drawing round for an open-sheet frame.

### Landing bands (OG-3)

The landing final page at `336b492d` is accepted as is. Its night hero, proof
band and footer are built as a named surface pair holding the existing
dark-palette values in both themes (`--band-night-*`); no new palette value is
added. The page's two `#4A453D` marks (the rail's inactive step and the "Abrir o
app" pill border) measure 1.79:1 on `--band-night-raised` and 1.95:1 on
`--band-night-bg`, below 3:1, so they use `--band-night-boundary-required`
(`--ink-soft` in the dark palette) instead. The orange stripe and closing band
use `--band-orange-*`, and the ink band uses `--band-ink-*`, each over its
existing values. R2 builds the page and measures it in the rendered-role audit
on every landing state, theme and locale.

### Landing recipes and page structure (R2a-B, 2026-10-01)

Plan 064 R2a-B builds the final page inside `#firstRun`. The authority is two
owner records on PR #295 and nothing here is inferred from the prototype: OG-3
(accept the final page as is) and the R2a/R4 decisions at
[comment 5927122354](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5927122354):
L-1 (the ink-pill primary with its arrow, "Track" as an underlined text link and
the floating sticky Build control are as drawn), L-2 (the chart figures stay) and
L-3 (the headline is the ethos line). This section **supersedes** the landing rows
above for the first-run landing: the `landing-accent-primary` and
`landing-bordered-navigation` recipes and their state table, the
`.firstrun-stage` device-stage radius row and the `landing-climax-data` type
variant describe a page that no longer exists. The text above is kept so the
earlier decisions stay readable; where it differs, this section governs. No type
size, radius step, shadow value or palette value is added, and `styles.css`
holds no colour, size, radius or shadow literal in the landing.

**Button recipes.** Selector-exact, with the same facts in
`tools/ui-role-inventory.json`:

| Variant | Exact selector | Role | Recipe |
| --- | --- | --- | --- |
| `landing-ink-primary` | `#firstRunCreate`, `#firstRunCreateClose`, `#firstRunSharedStart` | primary, decorative boundary | A 56px `--radius-surface` pill with no border of its own and a trailing arrow. On the night band: `--band-night-cta-bg` ground, `--band-night-cta-ink` label and arrow (12.77:1). On the orange band: `--band-orange-ink` ground, `--band-orange-cta-ink` label (16.63:1) and `--band-orange-cta-mark` arrow (6.33:1 on the pill). Label `control` 16/600. Disabled keeps the shared primary disabled ground and ink. |
| `landing-text-link` | `#firstRunImport`, `#firstRunImportClose` | quiet-navigation, no boundary | An underlined text link, `control` 16/600, in the ink of the band it sits on (`--band-night-ink`, `--band-orange-ink`); the underline is `-ink-soft` and takes full ink on hover and press. 44px target. It has no fill and no border. |
| `landing-sticky-build` | `#firstRunCreateDock` | primary, decorative boundary, **floating** elevation | The same pill, floating on `--elevation-floating-shadow`. It is the landing's persistent Build control: it appears once the hero action has scrolled away, steps aside at the closing action, opens the same route as `#firstRunCreate`, and never exists on the received-program gate (`display:none` and no observer). Its ink follows the band beneath it: the night recipe over a dark ground, the orange-band recipe over a light one. |

The sticky Build control is a floating surface outside the dock, the workout
shelf and the sheets (section 8.2): it is not a fifth elevation, it is a
persistent-action *variant* on the existing `floating` role. Today's
Start / Continue control (`#startWorkout`, #303) is the other: sticky in the
flow, it floats on the same `floating` role a 12px gap above the dock, measured
from `--nav` and the safe area, while its own place is below the fold, and it
settles back above Choose another day at the end of Today. Its focus ring is
the app's own focus accent (`--color-focus`), because the ground it floats over
changes while the lifter scrolls.

**The night pill's arrow.** The prototype drew the arrow in `--accent` on the
parchment pill, which measures 2.05:1, below the 3:1 floor for a mark. No existing
token is both orange and passing there, and adding one is a token decision this
packet does not make, so the night pill draws its arrow in `--band-night-cta-ink`.
The orange-band pill keeps its orange arrow (`--band-orange-cta-mark`, 6.33:1).

**Device-stage radius.** `landing-device-stage-radius` is re-pointed from
`.firstrun-stage` to the proof's phone plate and the step crop: `.firstrun-proof__glass`
24px (`--radius-landing-stage`), 20px at 340px and below
(`--radius-landing-stage-compact`), and `.firstrun-step__crop` 14px
(`--radius-landing-crop`). The crop no longer takes the compact step.

**Headline.** `.firstrun-h1` (the hero headline and the closing title) is the first-run
headline variant `--font-size-landing-headline` (`-wide` from 700px, and
`--font-size-title` at 340px and below), weight 500. No landing section takes any
other off-scale size: the prototype's 17, 15, 15.5, 14.5, 13 and 26px snap to the
existing tiers as follows.

| Prototype size | Tier used |
| --- | --- |
| h1 `clamp(36px,10vw,46px)` | `--font-size-landing-headline` 38px (`-wide` 52px) |
| h2 `clamp(30px,8.4vw,38px)` | `--font-size-title` 30px |
| sub 17px | `--font-size-subtitle` 18px (hero), `--font-size-body` 16px (bands) |
| action 17px, track and disclosure 15px | `--font-size-control` 16px |
| summary and verdict 17px, brand 650 18px | `--font-size-subtitle` 18px at weight 600 |
| 15.5px and 15px body | `--font-size-body` 16px and `--font-size-body-small` 14px |
| 14.5px and 13px | `--font-size-body-small` 14px |
| result figure 26px Mono | `--font-size-focal-data` 28px |
| next-target figure 17px Mono | `--font-size-body` 16px |

Spacing is composed from the `--space-*` scale (the prototype's 24, 40, 48, 64 and
80px rhythm is `calc(var(--space-8) * 3 | 5 | 6)` and `calc(var(--space-32) * 2)`).

**Page structure.** Each band is a `section` with `data-landing-section`; the page
scrolls inside the fixed `#firstRun` dialog, so every observer and sticky element is
rooted on it. The proof's seven steps are static cards first (each with its own
crop of the screen it reads); the controller adds the pinned phone, lens and rail
only when motion is welcome, the screen is at least 600px tall and the root text
is not enlarged, and removes them again with the gate. The seven rail buttons
(`.firstrun-proof__rail button`, quiet-navigation, bottom edge as the bar, marked
current by `aria-current="step"`), the paste disclosure `#firstRunHandBtn`
(disclosure) and the five `summary` controls (the shared disclosure row) are
inventoried; the footer Privacy link `#firstRunFooterPrivacy` moves to the data
band and never opens the sheet, so `#firstRunPrivacy` stays the single opener.
`.verdictmark` draws the three outcomes (up, maintained, down): the prototype's
all-orange glyphs and the dash on hold become the shared component's ink and
orange-for-up recipe, a forced deviation recorded on the changed-frame board.
The mark keeps its paper plate in both appearances because the hero is the night
band in both (the `.firstrun__logo` exception row).

**Rendered states.** The landing's catalog states are the hero
(`onboarding-start/first-run`, `onboarding-shared/gate`, `onboarding-shared/invalid`) and
six scrolled states, `onboarding-start/first-run-proof`, `-ways`, `-track`, `-data`,
`-faq-open` and `-close`, so the rendered-role audit measures every band, in both
themes and both locales.

### Measured contrast

Light and dark are the two `styles.css` themes. A row shows light then dark.

| Pair | Floor | Light | Dark |
| --- | --- | --- | --- |
| `--boundary-selected-quiet` (ink) on `--well` | 3:1 | 16.42:1 | 15.60:1 |
| `--boundary-selected-quiet` on `--surface` | 3:1 | 17.40:1 | 14.82:1 |
| `--boundary-selected-quiet` on `--bg` | 3:1 | 15.57:1 | 16.19:1 |
| Ledger open row: `--ink-soft` on `--well` | 4.5:1 | 5.39:1 | 7.49:1 |
| Shelf field: `--boundary-required` on `--well` | 3:1 | 5.39:1 | 7.49:1 |
| Shelf field value `--ink` on `--well` | 4.5:1 | 16.42:1 | 15.60:1 |
| Shelf pad: `--boundary-required` on `--bg` | 3:1 | 5.11:1 | 7.78:1 |
| Shelf pad label `--ink` on `--bg` | 4.5:1 | 15.57:1 | 16.19:1 |
| Tab selected label `--ink` on `--bg` | 4.5:1 | 15.57:1 | 16.19:1 |
| Tab unselected label `--ink-soft` on `--bg` | 4.5:1 | 5.11:1 | 7.78:1 |
| Tab unselected label `--ink-soft` on `--surface` | 4.5:1 | 5.71:1 | 7.12:1 |
| Tab indicator on `--bg` | 3:1 | 15.57:1 | 16.19:1 |
| Frequency bar `--ink` on `--bg` | 3:1 | 15.57:1 | 16.19:1 |
| Frequency planned marker `--boundary-required` on `--bg` | 3:1 | 5.11:1 | 7.78:1 |
| Frequency label `--ink-soft` on `--bg` | 4.5:1 | 5.11:1 | 7.78:1 |
| `--rule-on-surface` on `--surface` (decorative) | none | 1.31:1 | 1.79:1 |
| Frequency baseline `--boundary-decorative` on `--bg` (decorative) | none | 1.17:1 | 1.32:1 |
| Rejected reference: `--rule-strong` on `--bg` | 3:1 | 1.31:1 (fails) | 1.95:1 (fails) |
| Orange band: `--band-orange-ink` on `--band-orange-bg` | 4.5:1 | 4.66:1 | 6.33:1 |
| Orange band action: `--band-orange-cta-ink` on `--band-orange-ink` | 4.5:1 | 16.63:1 | 16.63:1 |
| Orange band action: `--band-orange-cta-mark` on `--band-orange-ink` | 3:1 | 6.33:1 | 6.33:1 |
| Ink band: `--band-ink-ink` on `--band-ink-bg` | 4.5:1 | 15.57:1 | 16.19:1 |
| Ink band: `--band-ink-ink-soft` (.78) on `--band-ink-bg` | 4.5:1 | 9.84:1 | 8.56:1 |
| Ink band: `--band-ink-rule` (.22) on `--band-ink-bg` (decorative) | none | 1.95:1 | 1.61:1 |

The night band is identical in both themes:

| Pair | Floor | Ratio |
| --- | --- | --- |
| `--band-night-ink` on `--band-night-bg` | 4.5:1 | 16.19:1 |
| `--band-night-ink-soft` on `--band-night-bg` | 4.5:1 | 7.78:1 |
| `--band-night-ink-faint` on `--band-night-bg` | 4.5:1 | 6.10:1 |
| `--band-night-ink` on `--band-night-raised` | 4.5:1 | 14.82:1 |
| `--band-night-ink-soft` on `--band-night-raised` | 4.5:1 | 7.12:1 |
| `--band-night-ink-faint` on `--band-night-raised` | 4.5:1 | 5.59:1 |
| `--band-night-accent-text` on `--band-night-raised` (26px Mono, large) | 3:1 | 7.25:1 |
| `--band-night-accent` on `--band-night-raised` | 3:1 | 5.80:1 |
| `--band-night-accent` on `--band-night-bg` | 3:1 | 6.33:1 |
| `--band-night-boundary-required` on `--band-night-raised` | 3:1 | 7.12:1 |
| `--band-night-boundary-required` on `--band-night-bg` | 3:1 | 7.78:1 |
| `--band-night-cta-ink` on `--band-night-cta-bg` | 4.5:1 | 12.77:1 |
| `--band-night-cta-bg` on `--band-night-bg` | 3:1 | 13.00:1 |
| `--band-night-rule` on `--band-night-bg` (decorative) | none | 1.32:1 |
| `--band-night-rule` on `--band-night-raised` (decorative) | none | 1.21:1 |
| Rejected reference: `#4A453D` on `--band-night-raised` | 3:1 | 1.79:1 (fails) |
| Rejected reference: `#4A453D` on `--band-night-bg` | 3:1 | 1.95:1 (fails) |

Every new pair that carries required meaning passes its floor in both themes.
The two `#4A453D` references are the pair this amendment replaces.
