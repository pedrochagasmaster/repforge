# UI overhaul canonical reconciliation

- **Status:** Accepted; Phase 0 contract for the owner-approved overhaul
- **Contract version:** 1
- **Contract owner:** Plan 049
- **Consumers:** Plans 050–059 (see per-role and per-surface owners below)
- **Product direction:** [`docs/ui-audit.md`](ui-audit.md) (authoritative)
- **Dispositions:** [`docs/ui-overhaul-disposition-register.md`](ui-overhaul-disposition-register.md)
- **Execution map:** [`docs/ui-overhaul-implementation-sequence.md`](ui-overhaul-implementation-sequence.md)

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
  and technical values. The bounded size/line-height steps are defined during
  the Plan 058 migration, not here.

## Semantic role inventory

### Family: elevation

Depth is allowlisted by role. Page content stays flat on hairlines and
whitespace. Nested-card tunnels (a card inside a card inside a card) are
prohibited in every phase.

| Role | Meaning | First consumed by |
|---|---|---|
| page | Default flat content surface; hairlines separate, whitespace groups | 058 |
| selected | Chosen option or current item; one level above page, never a tunnel wall | 058 |
| floating | Transient surfaces above content: dock, toasts, rest chip | 058 |
| modal | Blocking sheets and dialogs that take the interaction until dismissed | 058 |
| persistent-action | Sticky editor/program action layers; restrained boundary, shallow lift, never card-like or modal | 057 |

### Family: radius

| Role | Meaning | First consumed by |
|---|---|---|
| compact-control | Small controls: chips, steppers, segmented options | 058 |
| standard-control | Default buttons, inputs, cards, and sheets | 058 |
| surface | Large containers: editor days, summary blocks | 058 |
| pill | Full-round actions and timers only | 058 |

### Family: typography

| Role | Meaning | First consumed by |
|---|---|---|
| title | Screen titles; Sans, largest, tight tracking | 058 |
| heading | Content headings: exercise and session names; Sans | 058 |
| body | Rows, prose, and form text; Sans | 058 |
| eyebrow | Uppercase section labels; Sans, small, tracked; never a substitute for hierarchy | 058 |
| data | Training data numerals: loads, reps, sets; Mono with tabular figures | 058 |
| technical | Timers and technical values; Mono | 058 |

### Family: controls

Shared tokens, states, and semantics per role. A contextual variant is allowed
only where the task justifies it (fast logging versus program editing); unlike
interactions are never forced into one visual component.

| Role | Meaning | First consumed by |
|---|---|---|
| primary-action | The one forward action per screen; full emphasis | 050 |
| secondary-action | Safe alternative beside or under the primary action | 050 |
| quiet-navigation | Text links, chevrons, and back actions that move without committing | 057 |
| destructive-action | Deletion and irreversible clears; visually distinct from navigation | 057 |
| selection | Pickers, toggles, steppers, and choice groups with a visible selected state | 050 |
| disabled-action | Unavailable actions; muted mass, no competing live accent, reason exposed where the audit requires it | 050 |
| horizontal-scroller | Intentional horizontal scroll regions with a non-overlapping chip geometry and an edge continuation cue | 050 |

### Family: progress

Each dimension keeps its own encoding. No dimension may be deleted as a
"duplicate" without naming which surviving dimension carries its meaning.

| Role | Meaning | First consumed by |
|---|---|---|
| block-progress | Position inside the current block: week N of M plus session completion | 056 |
| weekly-completion | This week's completed versus planned sessions beside the day strip | 057 |
| exercise-progression | Per-exercise readiness and recommendation state | 056 |
| set-progression | Within-exercise completed versus planned sets | 055 |
| onboarding-progress | Position inside an entry route's semantic steps | 054 |
| task-progress | Short-lived task completion: install steps, import mapping, transfer states | 054 |

### Family: color

Words and icons always carry meaning; color supports them and never replaces
them. Decorative orange is preserved where valid; deeper tokens are used where
contrast is required (G-74, rendered-role audit in Plan 058).

| Role | Meaning | First consumed by |
|---|---|---|
| accent | Action and emphasis; used sparingly, never as decoration wash | 056 |
| success | Improved outcomes and confirmed completions | 056 |
| warning | Declined outcomes and attention states; reserved, never ambient | 056 |
| neutral | Maintained outcomes and informational states | 056 |
| focus | Live timer and active-workout signal | 055 |
| disabled | Unavailable control mass; exempt from contrast claims but ordered below enabled actions | 050 |
| boundary | Control edges that are the only cue; must clear WCAG 2.2 AA for their role | 058 |
| decorative | Rules and separators that carry no meaning; never the sole cue for anything | 058 |

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
[`docs/recovery-week-policy.md`](recovery-week-policy.md): eligibility on
`maintained`/`declined` evidence plus checkpoint recovery input, base-versus-
effective preview with explicit confirmation, optional work removed first,
ordinary `minSets` crossable under the named policy, at least one working set
per primary pattern, week-two canonical restoration, and reassessment with no
automatic repeat. It never mutates progression-engine arithmetic. The exact
rounding, allocation, tiebreak, and primary-pattern constants are an explicit
⛔ owner gate: until the selection is recorded in the policy, no
`recovery-week` transition record may be written and Plans 052/056 stop at
that gate.
