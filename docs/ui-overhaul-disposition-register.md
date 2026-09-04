# UI overhaul decision and finding disposition register

- **Version:** 1
- **Owner:** Plan 049 (canonical reconciliation)
- **Consumers:** Plans 050–059 (implementation), Plan 059 (final verification)
- **Sources:** [`docs/ui-audit.md`](ui-audit.md) (authoritative product direction),
  [`docs/ui-overhaul-implementation-sequence.md`](ui-overhaul-implementation-sequence.md)
  (execution map; its disposition tables are transcribed here, not replaced)

Every grilling decision G-01–G-88 and every audit finding UI-01–UI-32 appears
exactly once below. No later plan may redefine another row's contract; later
plans may extend only through a versioned Plan 049 amendment.

Run `node tools/check-ui-overhaul-disposition.mjs` to verify the register
parses, every ID appears exactly once, and every row names a contract owner.

## Disposition vocabulary

| Value | Meaning |
|---|---|
| `specified-here` | The contract is specified in Plan 049 documentation. Named plans consume or verify it but do not redefine it. |
| `implemented` | One plan implements the decision or finding. No other plan shares the contract. |
| `split` | One contract owner plus named consumers. Consumers use the owner's contract and may not fork its meaning. Cross-cutting verification in Plan 059 is never a second implementation owner. |
| `preserved-strength` | Protected current behavior. Later plans must not regress it; no new contract is written. |
| `rejected-or-closed-by-audit` | The consolidated audit closed the claim. It is not work. |
| `owner-gated` | Specified but blocked on an explicit owner choice. Slices stop at the gate instead of improvising. |

**Owner rule.** For `split` rows transcribed from the sequence document, the
contract owner is the first plan the sequence names; the remaining named plans
are consumers. The two deliberate exceptions are UI-14 (the finding's missing
behavior is Share repair, owned by Plan 057) and UI-25 (the sequence itself
names Plan 057 the finding owner); both record their rationale inline.

## G-decision disposition (G-01–G-88)

| Decision | Disposition | Owner | Consumers | Notes |
|---|---|---|---|---|
| G-01 | split | 049 | 050, 059 | Evidence bar: defects fixed in 050, final evidence in 059 |
| G-02 | split | 049 | 058, 059 | Prior decisions may be superseded by a better review outcome |
| G-03 | split | 049 | 054, 055, 056, 057, 058 | Preserve core and identity; redesign weak surfaces |
| G-04 | specified-here | 049 | 050, 051, 052, 053, 054, 055, 056, 057, 058, 059 | Overhaul is the active initiative before alpha; backlog records it in slice 6 |
| G-05 | split | 049 | 059 | Gated phases; sequence document is the map, 059 closes each gate |
| G-06 | implemented | 059 | — | Owner-only evaluation over automated and device evidence |
| G-07 | split | 049 | 053 | Static local-first default; one approved transfer exception |
| G-08 | split | 051 | 055 | Workout contracts preserved while workflow changes |
| G-09 | implemented | 054 | — | First-run gate becomes a landing page |
| G-10 | implemented | 054 | — | All five entry jobs kept |
| G-11 | implemented | 056 | — | Progress is a hybrid decision guide and record |
| G-12 | implemented | 057 | — | History reads first, then edits in place |
| G-13 | split | 049 | 057, 058 | Bounded elevation roles specified in slice 2 |
| G-14 | split | 049 | 057, 058 | Shared control semantics with contextual variants, slice 2 |
| G-15 | implemented | 055 | — | Focus-led logging, resolved to Focus-only by G-22 |
| G-16 | split | 049 | 054 | Tour/install split resolved by the G-39/G-40 contracts |
| G-17 | split | 049 | 054, 057 | Task-only Share sheet; separate cached Privacy page |
| G-18 | implemented | 054 | — | First-run proposition headline |
| G-19 | implemented | 054 | — | Product-led preview loop |
| G-20 | implemented | 054 | — | One early Start training action |
| G-21 | implemented | 054 | — | One short ethos line |
| G-22 | split | 051 | 055 | Focus-only after the DraftV2 state migration |
| G-23 | implemented | 057 | — | Session replaces calendar after selection |
| G-24 | split | 052 | 056, 057 | Outcome versus recommendation vocabulary; 052 owns the shared contract |
| G-25 | implemented | 054 | — | Expert configuration stays visible |
| G-26 | implemented | 054 | — | Browse scan-first summaries |
| G-27 | implemented | 056 | — | Snapshot / comparison / trend by evidence count |
| G-28 | split | 049 | 058 | Full system migration before launch; roles specified in slice 2 |
| G-29 | implemented | 056 | — | Two-level Progress navigation |
| G-30 | implemented | 056 | — | Weekly status plus program action queue |
| G-31 | split | 052 | 056 | Neutral baseline for insufficient evidence |
| G-32 | implemented | 056 | — | One lifecycle surface for Review and End block |
| G-33 | split | 052 | 056 | Faithful previewed and confirmed structural changes |
| G-34 | implemented | 056 | — | Strength defaults to the current block |
| G-35 | implemented | 056 | — | Volume compares this week and block-to-date against elapsed plan |
| G-36 | implemented | 056 | — | Mobile summary rows with drill-in |
| G-37 | implemented | 054 | — | Adaptive shared-link landing page |
| G-38 | split | 054 | 056, 057 | Locale-aware date roles: long headings, short lists, native control while editing |
| G-39 | split | 053 | 054 | Platform-sensitive install timing and transfer primitive |
| G-40 | split | 054 | 055, 056, 057 | Contextual guidance registry replaces the modal tour |
| G-41 | split | 051 | 055 | Structured flexibility: inspect/reorder exercises, ordered sets |
| G-42 | split | 051 | 055 | Session-sheet versus exercise-action utility ownership |
| G-43 | split | 051 | 055 | Immersive shell with draft-preserving Leave action |
| G-44 | implemented | 055 | — | Read-only Today session preview |
| G-45 | implemented | 057 | — | In-context Share repair per unresolved row |
| G-46 | split | 049 | 054, 057 | Cached Privacy page linked from landing and Settings, never Share |
| G-47 | implemented | 054 | — | Landing appears once; later visits use no-program states |
| G-48 | split | 053 | 054 | Persistent non-blocking install pressure with milestones and cooldown |
| G-49 | split | 054 | 055, 056, 057 | Action-linked cue registry; surfaces anchor to it |
| G-50 | implemented | 054 | — | Recommend-primary five-job hierarchy |
| G-51 | owner-gated | 054 | — | STOP: imagegen directions require owner selection before any direction becomes an asset |
| G-52 | split | 050 | 054 | Visible 2x2 muscle choices resilient at enlarged text |
| G-53 | split | 052 | 056 | Diagnose fewer days versus long sessions |
| G-54 | split | 052 | 056 | Separate protected permanent volume reduction |
| G-55 | split | 049 | 052, 056 | Volume-only week-one recovery; exact constants are owner-gated (slice 4) |
| G-56 | split | 049 | 052, 056 | Stagnation/decline plus recovery-check evidence; corroboration input specified in slice 4 |
| G-57 | split | 049 | 058 | Plex Sans/Mono jobs and bounded scale, slice 2 |
| G-58 | split | 049 | 058, 059 | Paper backgrounds preserved in dark; 059 verifies |
| G-59 | split | 050 | 059 | Risk-based language/text matrix and every-state overflow gate |
| G-60 | split | 056 | 057, 058 | Restrained semantic outcomes carried by words and icons |
| G-61 | split | 052 | 056 | Exact-program guided manual repair fallback |
| G-62 | split | 054 | 055, 056, 057 | Cues complete or dismiss once; Settings replays |
| G-63 | implemented | 057 | — | Ranked weighted hard-set counts without bars |
| G-64 | implemented | 057 | — | Block position plus one weekly line |
| G-65 | implemented | 057 | — | Nonzero readiness count as a navigation route |
| G-66 | implemented | 057 | — | Task-based Settings sections |
| G-67 | split | 055 | 057, 058 | Orange live timer progress with neutral controls |
| G-68 | implemented | 057 | — | Explicit History Save/Cancel with isolated Delete |
| G-69 | split | 054 | 055, 056, 057 | Lifecycle guide coverage: first set, utilities, Progress, transition, backup, install |
| G-70 | split | 049 | 052, 056 | Recovery minimums policy; exact allocation rule is owner-gated (slice 4) |
| G-71 | split | 049 | 053, 054 | One-hour backend transfer with atomic import; provider ownership is owner-gated (slice 5) |
| G-72 | implemented | 054 | — | Milestone install cadence with increasing cooldown |
| G-73 | implemented | 054 | — | Complete ethos passage removed |
| G-74 | split | 049 | 050, 058, 059 | WCAG 2.2 AA by rendered role; no blanket token swap |
| G-75 | implemented | 059 | — | Automated plus physical browser/PWA/AT gates with owner sign-off |
| G-76 | implemented | 059 | — | Owner-only prelaunch evaluation; no representative lifters |
| G-77 | specified-here | 049 | 050, 051, 052, 053, 054, 055, 056, 057, 058, 059 | Foundations-first order owned with the sequence document |
| G-78 | split | 049 | 050, 051, 052, 053, 054, 055, 056, 057, 058, 059 | Umbrella initiative with bounded takeover-ready child plans |
| G-79 | implemented | 054 | — | Merged recommendation result and editable preview |
| G-80 | split | 057 | 058 | Shallow sticky Program action layer |
| G-81 | split | 054 | 058 | Landing uses the normal Taurifer system, no separate motif |
| G-82 | split | 049 | 054 | Creator identity deferred; no unverified name or avatar ships |
| G-83 | split | 049 | 053, 054, 055, 056, 057, 059 | Allowlisted privacy-preserving telemetry; owner interprets evidence |
| G-84 | split | 049 | 051, 053 | Exact logical clone with explicit exclusions; schema in slice 5 |
| G-85 | split | 049 | 053, 059 | Claim-or-60-minute deletion; service behavior in 053, evidence in 059 |
| G-86 | split | 049 | 053, 054 | Explicit informed install-and-transfer action |
| G-87 | split | 049 | 053, 059 | Telemetry identity preserved across transfer with context split |
| G-88 | split | 049 | 053, 054, 059 | Safari recovery snapshot with divergence warning |

## UI-finding disposition (UI-01–UI-32)

| Finding | Disposition | Owner | Consumers | Notes |
|---|---|---|---|---|
| UI-01 | implemented | 050 | — | Map raw day/equipment identifiers; rendered-key detector |
| UI-02 | implemented | 050 | — | Complete EN/PT messages; no grammar fragments |
| UI-03 | implemented | 050 | — | Reflow fixed controls; do not shrink type |
| UI-04 | split | 050 | 059 | Risk matrix and every-state overflow gate; 059 verifies |
| UI-05 | implemented | 050 | — | Non-overlapping filter scroller with continuation cue |
| UI-06 | implemented | 050 | — | Real Program editor label row across variants |
| UI-07 | implemented | 050 | — | Canonical disabled-primary hierarchy |
| UI-08 | implemented | 056 | — | Mobile summary rows and drill-in; tables secondary or cued |
| UI-09 | implemented | 056 | — | Week status separated from actionable program evidence; neutral baseline |
| UI-10 | split | 052 | 056 | Unified Review with exact safe transitions and bounded recovery |
| UI-11 | implemented | 056 | — | Overview/Review primary; Evidence secondary |
| UI-12 | split | 056 | 057 | Outcome/action vocabulary contract; 057 consumes it in Summary and Program |
| UI-13 | implemented | 057 | — | History read-first with calendar replacement and stale-safe edit/delete |
| UI-14 | split | 057 | 054 | Exception to the owner rule: the finding's missing behavior is per-row Share repair (057); 054 owns the task-only sheet and Privacy-page constraints it must respect |
| UI-15 | implemented | 054 | — | Visible responsive expert controls with 2x2 muscle groups |
| UI-16 | implemented | 054 | — | Five-job hierarchy with merged recommendation/editor and explicit activation |
| UI-17 | implemented | 054 | — | Browse scan facts from canonical metadata |
| UI-18 | split | 051 | 055 | DraftV2 removes hidden DOM state; 055 reaches parity then deletes List |
| UI-19 | split | 053 | 054 | Transfer primitive and platform timing (053); promotion and guides (054) |
| UI-20 | split | 049 | 058 | Bounded elevation roles specified in slice 2; 058 migrates |
| UI-21 | split | 049 | 058 | Shared semantic controls specified in slice 2; 058 migrates |
| UI-22 | split | 049 | 058 | Bounded type/radius/label/progress system in slice 2; 058 migrates |
| UI-23 | implemented | 055 | — | Content-driven Focus spacing with stable timer/title geometry |
| UI-24 | implemented | 057 | — | Summary hierarchy with semantic outcomes and ranked counts |
| UI-25 | split | 057 | 055 | The sequence names 057 the finding owner; 055 owns the read-only Preview slice |
| UI-26 | implemented | 057 | — | Distinct Program action roles with nonzero readiness route and shallow dock |
| UI-27 | implemented | 057 | — | Four Settings task groups with Privacy route and replayable guides |
| UI-28 | split | 055 | 057 | Timer geometry and function (055); visual semantics (057) |
| UI-29 | split | 050 | 056 | Credible load fixture (050); 1/2/3+ evidence chart policy (056) |
| UI-30 | split | 058 | 059 | Rendered-role WCAG audit in 058; 059 verifies (no blanket orange swap) |
| UI-31 | implemented | 059 | — | Real scroll-end plus physical browser/PWA/AT evidence |
| UI-32 | implemented | 054 | — | Product-explaining landing with early action and selected preview |

## Rejected and closed source-audit claims

These are guardrails, not backlog items. Plan 059's disposition check must fail
if any reappears as a requirement. Transcribed from the sequence document.

| # | Closed claim |
|---|---|
| R-01 | Do not darken licensed exercise-art paper or fill empty media tiles |
| R-02 | Do not merge Recommend and Custom |
| R-03 | Do not treat every English exercise/user/shared name on PT-BR as a leak |
| R-04 | Do not re-fix scripted heading focus already fixed in `0c807118` |
| R-05 | Do not globally replace orange or indiscriminately strengthen dark secondary text |
| R-06 | Do not add creator avatars or trust metadata |
| R-07 | Do not create or propagate a separate landing motif |
| R-08 | Do not ban middle dots globally |
| R-09 | Do not restore the Program dock's old flatness instead of applying G-80 |
| R-10 | Do not preserve List merely because earlier Plan 013 did |
| R-11 | Do not infer a dock-occlusion bug from a non-terminal screenshot |

## Owner gates recorded here

| Gate | State | Blocking |
|---|---|---|
| Transfer provider, region, key ownership, deletion mechanism, operations owner, and privacy disclosure | Open; specified as unresolved in slice 5 | Transfer implementation in Plan 053 and the established-data offer in Plan 054 |
| Recovery-week deterministic rounding, allocation, optional-work ties, and primary-pattern rule | Open; candidate rule presented in slice 4 | Recovery implementation in Plans 052/056 |
| Landing mini-interface direction (G-51) | Open; recorded for Plan 054 | Production landing preview asset and markup |
| Phase phone reviews and physical-device sign-off | Open; recorded for Plans 053–059 | Respective plan completion and the public-launch gate |
