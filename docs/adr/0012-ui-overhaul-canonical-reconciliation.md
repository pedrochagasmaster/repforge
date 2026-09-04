# UI overhaul canonical reconciliation

- **Status:** Accepted; Phase 0 contract for the owner-approved overhaul
- **Contract version:** 1
- **Contract owner:** Plan 049
- **Consumers:** Plans 050–059 (see per-role and per-surface owners below)
- **Product direction:** [`docs/ui-audit.md`](../ui-audit.md) (authoritative)
- **Dispositions:** [`docs/ui-overhaul-disposition-register.md`](../ui-overhaul-disposition-register.md)
- **Execution map:** [`docs/ui-overhaul-implementation-sequence.md`](../ui-overhaul-implementation-sequence.md)

Later phases may add UI only through the semantic roles named here. Meanings
cannot change per feature. Phase 7 (Plan 058) owns the full inventory and
migration; earlier phases consume only the roles they touch. Run
`node tools/check-ui-semantic-roles.mjs --check` to verify the inventory and
the release matrix below.

## Context

The owner-approved audit (`docs/ui-audit.md`, decisions G-01–G-88, findings
UI-01–UI-32) changes several contracts that current canonical documents still
describe differently. This ADR establishes the replacement design-system
contract and the release-evidence matrix. It does not rewrite history:
superseded sections stay readable and are marked, never deleted. The remaining
reconciliation (backlog priority, ADRs 0005–0007/0010 pointers, entry and
progression guidance, privacy wording) lands in later Plan 049 slices.

## Supersedes in part

- The brand guide's literal no-card/no-shadow surface policy is replaced by
  the bounded elevation roles below. Palette, type jobs, artwork rules, voice,
  and naming surfaces are unchanged.
- `docs/design/ui-overhaul-spec.md` remains the record of its mock-driven
  pass, but where it conflicts with G decisions it is historical: List-mode
  preservation (G-22), five equal Progress tabs (G-29), the modal tour
  (G-40), and the visual-only scope that would leave UI-08–UI-19 unaddressed.
  Plans 051/055 own List deletion, Plan 054 owns tour removal, Plan 056 owns
  Progress structure. Do not implement from that spec without a governing
  child plan.

## Reaffirmed, not changed

- ADR 0009: dark remains a `:root[data-theme="dark"]` token swap. New rules
  name tokens, never colours.
- Licensed illustrations keep their sampled paper backgrounds in both themes;
  movements without licensed art keep the intentionally empty tile.
- Plex Sans carries language and controls; Plex Mono carries training data
  and technical values. The bounded size and line-height steps are defined in
  the role inventory below; Plan 058 migrates every surface onto them.

## Role ownership rule

Earlier phases consume only the names below. Any new role requires a
versioned Phase 0 amendment; Plan 058's inventory reconciles these roles
into selectors and tokens but must not rename their meanings or invent
competing roles. Where Plan 058's token spelling differs from a name here,
this semantic contract still governs.

## Semantic role inventory

### Family: elevation

Depth is allowlisted by role. Page content stays flat on hairlines and
whitespace. Nested-card tunnels (a card inside a card inside a card) are
prohibited in every phase. Elevated descendants inside an elevated ancestor
are prohibited unless the inner role is `selected` or a true overlay.

| Role | Meaning | First consumed by |
|---|---|---|
| flat | Default content surface; no shadow, optional decorative separator | 058 |
| selected | Chosen option or current item; inset or high-contrast selection boundary, no floating shadow | 058 |
| floating | Menu, toast, and Focus movable layers above content | 058 |
| modal | Blocking sheets and dialogs with scrim and stronger depth | 058 |
| persistent-action | Sticky editor/program action layers; restrained boundary, shallow lift, never card-like or modal | 057 |

### Family: radius

Asymmetric sheet and top-edge radii derive from `prominent`.
Exercise-artwork corners use `surface` or `prominent`; sampled paper color
never changes.

| Role | Meaning | First consumed by |
|---|---|---|
| none | Sharp corners where the component carries the boundary | 058 |
| compact | 4px: chips, steppers, segmented options | 058 |
| control | 8px: default buttons, inputs, cards, sheets | 058 |
| surface | 12px: large containers such as editor days and summary blocks | 058 |
| prominent | 16px: modals and prominent sheets | 058 |
| pill | Full-round actions and timers | 058 |
| round | Circular geometry only | 058 |

### Family: typography

| Role | Meaning | First consumed by |
|---|---|---|
| language | Plex Sans for language and controls | 058 |
| training-data | Plex Mono for training data and technical values, assigned by semantic value rather than component ancestry | 058 |
| display | 2.5rem titles | 058 |
| title | 1.875rem screen titles | 058 |
| subtitle | 1.125rem content headings | 058 |
| body | 1rem rows, prose, and controls; also the control-text step, never a separate size | 058 |
| body-small | 0.875rem secondary rows | 058 |
| caption | 0.75rem supporting text, never the sole text of a critical control at normal scale | 058 |
| label | 0.6875rem uppercase section labels; never a substitute for hierarchy | 058 |
| tight | 1.1 line height for display and title | 058 |
| standard | 1.4 line height for body and controls | 058 |
| reading | 1.55 line height for sustained prose | 058 |

Weights are regular, medium, and semibold from shipped font support; they
are not separate roles. If a current unique size cannot map onto the steps
above without losing hierarchy or 200% fit, Plan 058 documents one named
additional role rather than retaining a literal.

### Family: controls

Shared tokens, states, and semantics per role: default, hover where
applicable, active/pressed, selected, focus-visible, disabled with reason,
validation/error, and loading. A contextual variant is allowed only where the
task justifies it (rapid workout stepper versus deliberate program stepper);
target sizes, focus behavior, and disabled semantics stay shared, and unlike
interactions are never forced into one visual component.

| Role | Meaning | First consumed by |
|---|---|---|
| primary | The one forward action per screen; full emphasis | 050 |
| secondary | Safe alternative beside or under the primary action | 050 |
| quiet-navigation | Text links, chevrons, and back actions that move without committing | 057 |
| destructive | Deletion and irreversible clears; visually distinct from navigation and from declined outcomes | 057 |
| disclosure | Expand-versus-navigate glyphs with distinct semantics | 057 |
| selection | Pickers, toggles, steppers, and choice groups with a visible selected state | 050 |
| disabled | Unavailable actions; muted mass, no competing live accent, reason exposed where required | 050 |
| icon-only | Glyph buttons with accessible names; normalized stroke weight | 055 |
| horizontal-scroller | Intentional horizontal scroll regions with non-overlapping chip geometry and an edge continuation cue; reconciled into Plan 058's scroller inventory under this name | 050 |

### Family: progress

Each dimension keeps its own machine-readable encoding. Elements with
identical dimension, value, and scope on one surface consolidate; different
dimensions remain separately labelled. No dimension may be deleted as a
"duplicate" without naming which surviving dimension carries its meaning.

| Role | Meaning | First consumed by |
|---|---|---|
| block | Position within the training block | 056 |
| week | Sessions and volume within the current week | 057 |
| exercise-set | Current exercise and ordered set execution | 055 |
| task | Entry, import, transfer, and onboarding workflow progress | 054 |

### Family: color

Words and icons always carry meaning; color supports them and never replaces
them. Decorative orange is preserved where valid; deeper tokens are used
where contrast is required (G-74, rendered-role audit in Plan 058). Warning
and destructive are distinct roles even where early palette values relate.

| Role | Meaning | First consumed by |
|---|---|---|
| action | Action and emphasis; used sparingly, never as decoration wash (058 spelling: accent) | 058 |
| action-text | Small text on or in the accent role where contrast requires depth | 058 |
| improved | Improved outcomes and confirmed completions (058 spelling: success) | 056 |
| declined | Declined outcomes and attention states; reserved, never ambient (058 spelling: warning) | 056 |
| maintained | Maintained outcomes and informational states (058 spelling: neutral) | 056 |
| destructive | Destructive actions and confirmations; distinct from declined | 057 |
| focus | Live timer and active-workout signal | 055 |
| disabled | Unavailable control mass; ordered below enabled actions, with compliant reason text | 050 |
| boundary | Required control edges that are the only cue; must clear WCAG 2.2 AA for their role | 058 |
| decorative | Rules and separators that carry no meaning; never the sole cue for anything | 058 |
| surface | Surface fills behind content | 058 |
| ink | Text hierarchy fills | 058 |

### Cross-family pairs

Three names recur across families by design; each pair shares one meaning
and may not drift per family.

| Name | Families | Shared meaning |
|---|---|---|
| disabled | controls, color | Unavailable: muted control mass with an exposed reason |
| destructive | controls, color | Irreversible clears, distinct from declined outcomes |
| surface | radius, color | Large content containers and the fills behind them |

## Release matrix

The catalog matrix is risk-based (G-59), not a full language × theme ×
text-size product.

- Broad normal-size coverage stays in both languages for every screen.
- Demanding surfaces additionally capture PT-BR at 200% text (`pt-text200`,
  added by Plan 050: phone-390, light, `pt`, `text200`).
- Document and component overflow assertions run across every catalog screen
  (implemented by Plan 050, completed by Plan 059). Image comparison alone
  cannot tell a designed scroller from a failure.
- Contrast is audited per rendered role under WCAG 2.2 AA (Plan 058).
- Scroll clearance and critical flows are additionally proven on physical
  iOS/Android hardware with VoiceOver and TalkBack (Plan 059, owner sign-off).

### Demanding surfaces

`Flow / screen` names a `flow` and `id` from `docs/ui-screens/manifest.json`.
Plan 050 implements the captures and the overflow gate; this table is the
requirement.

| Flow / screen | Required variant sets | Rationale |
|---|---|---|
| onboarding-custom/schedule | pt-text200 | Five fixed duration segments overlap at 200% text (UI-03) |
| onboarding-recommend/schedule | pt-text200 | Same fixed-segment component as Custom |
| onboarding-custom/priorities | pt-text200 | Prioritize/De-emphasize clip inside four fixed tracks (UI-03) |
| onboarding-custom/exercise-preferences | pt-text200 | Dense expert control with selected lists |
| onboarding-recommend/environment-correction | pt-text200 | Dense capability-correction disclosure |
| onboarding-custom/result | pt-text200 | Recommendation-result title needs a fresh runtime overflow check (UI-03) |
| onboarding-recommend/result | pt-text200 | Same title component as the Custom result |
| onboarding-import/preview | pt-text200 | Import metric bands crowd at enlarged text (UI-03) |
| onboarding-build/editor-empty | pt-text200 | Installed editor label collision across themes and enlarged text (UI-06) |

## Workout truth and state ownership

Plan 051's DraftV2 is the only active-session truth: stable exercise and set
identity, programmed versus edited values, completion and uncommit, skip and
restore, repeat-last values, substitution, warm-up marking, notes and session
metadata, revisioned persistence, stale-tab rejection, and reload, crash, and
save semantics. Every rendered value reads from that draft.

DOM-backed value carriers are prohibited: hidden inputs must not own set data
(the current List/Focus hidden-input coupling is the violation Plan 051
removes). List markup is deleted only after DraftV2 migration proves
capability parity (Plan 055); deleting the markup first would lose draft
values.

No consumer adds fields to another plan's schema. Schema changes return to
the owning plan through a versioned Phase 0 amendment; renderers never extend
a schema ad hoc.

| State | Contract owner | Consumers | Serialization |
|---|---|---|---|
| Active workout draft (DraftV2) | 051 | 053 (logical clone), 055 (workout UI) | 051 → 053 → 055 |
| Block-transition record and proposal | 052 | 056 (lifecycle UI) | 052 → 056 |
| Install-transfer clone and import marker | 053 | 054 (promotion) | 053 → 054 |
| Entry candidate draft and activation | 048 (existing) | 052/056 (transition adapter boundary), 057 (repair routes) | Provenance first, entry UI second, repair consumers last |

## Recovery-week experiment (owner-gated)

Recovery is a versioned week-one schedule overlay governed by
[`docs/recovery-week-policy.md`](../recovery-week-policy.md): eligibility on
`maintained`/`declined` evidence plus checkpoint recovery input, base-versus-
effective preview with explicit confirmation, optional work removed first,
ordinary `minSets` crossable under the named policy, at least one working set
per primary pattern, week-two canonical restoration, and reassessment with no
automatic repeat. It never mutates progression-engine arithmetic. The exact
rounding, allocation, tiebreak, and primary-pattern constants are an explicit
⛔ owner gate: until the selection is recorded in the policy, no
`recovery-week` transition record may be written and Plans 052/056 stop at
that gate.
