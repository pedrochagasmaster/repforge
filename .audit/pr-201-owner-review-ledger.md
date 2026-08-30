# PR #201 owner-review finding ledger

Baseline: PR head `e63882b87cd30f33d7253947a6de37bc70ac95ba`; `origin/main` `e7b6d162983a4dd2549eb58c32bf6a344936ccf7`; reconstructed 2026-08-29 before implementation.

## Sources read

- `S0` — [deployment status](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5462541047); evidence only, no review finding.
- `S1` — [blast-radius audit](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464227795).
- `S2` — [visual parity audit](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464232424), including every linked mockup and runtime capture.
- `S3` — [interrogate synthesis](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464240664).
- `S4` — [visual audit repost with inline evidence](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464258135); duplicate of `S2` with the same evidence embedded.
- `S5` — [correctness and telemetry audit](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464259834).
- `S6` — [independent owner review](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464817294).
- `S7` — [owner-review repost with inline evidence](https://github.com/pedrochagasmaster/repforge/pull/201#issuecomment-5464956565); duplicate of `S6` with the same evidence embedded.

There were no inline review comments or submitted GitHub review objects at the baseline head. `S4` and `S7` are retained in the source inventory so their attached evidence is not silently omitted; repeated findings below point to the canonical row and are marked duplicate.

## Ledger

| ID | Source comment | Finding | Severity | Status | Fix commit | Verification |
|---|---|---|---|---|---|---|
| B01 | S6 §2.1; S7 duplicate | `about_half` maps to `interrupted` but disables its one-week re-entry treatment. It must not become `returning`. | blocker | fixed | `801b57e` | Named adapter test proves interrupted + enabled, reduced week 1, normal weeks 2–6 |
| B02 | S3 §8; S5 SHOULD 3 | Stored week prescriptions, including returning/interrupted treatment, are not consumed by the active week-one program sets. | blocker | fixed | `801b57e` | Pure projection and 44-check browser run prove reduced week 1, restored week 2, unchanged durable bytes |
| B03 | S1 §3; S3 §1; S5 BLOCKER 1; S6 §2.2 | Build immediately activates empty day containers and replaces the active program. | blocker | confirmed | — | Browser evidence plus `app.js` Build handler; red test pending |
| B04 | S1 §3; S3 §4; S6 §2.2 | Empty/incomplete Build results are considered activation-ready; validation does not explain missing exercises. | blocker | confirmed | — | `{}`/empty-result readiness trace; red test pending |
| B05 | S1 §2; S3 §1; S5 BLOCKER 1; S6 §2.3 | “Edit before using” activates, clears the draft, and edits active state instead of the candidate draft. | blocker | confirmed | — | Browser evidence and click-handler trace; byte test pending |
| B06 | S1 §1; S3 §2; S5 BLOCKER 2; S6 §2.4 | Ordinary replacement promises archival but archives only block-origin transitions. | blocker | confirmed | — | Browser evidence and finalizer trace; route matrix pending |
| B07 | S1 additional 1; S3 §9; S5 SHOULD 8; S6 §2.5 | Program-only Import bypasses the state-machine preview and common explicit activation transaction. | blocker | confirmed | — | Import handler trace; compatibility/browser tests pending |
| B08 | S1 §4; S3 §13; S6 correctness | Import emits `program_path_selected` twice in one setup flow. | blocker | confirmed | — | Runtime evidence and two call sites; event-count test pending |
| B09 | S3 §3; S6 race findings | Activation readiness reads an in-memory revision, while the durable transaction does not compare the exact expected durable revision. | blocker | confirmed | — | Persistence path trace; metadata race test pending |
| B10 | S3 §5; S5 SHOULD 2; S6 §2.6 | Failed activation unconditionally restores stale setup-draft bytes and can overwrite another tab's newer draft. | blocker | fixed | `a438404` | Named two-tab browser probe uses tab B's product writer, advances owner/revision, forces tab A failure, and proves newer draft plus active bytes survive exactly; stale activation is rejected inside the durable lock |
| B11 | S3 §5; S1 unproven 3 | Setup draft is removed before asynchronous durability completes, creating a crash-loss window. | blocker | fixed | `a438404` | Setup draft remains present through failed durability and is CAS-deleted only after successful activation; 57-check browser suite covers failure, success, cleanup, and pending-journal drain |
| B12 | S3 Consider; S6 §2.7 | Browser Back is not integrated with the entry route and can leave the app. | blocker | confirmed | — | No entry `pushState`/`popstate`; browser-history test pending |
| B13 | S1 additional 3; S3 §5; S6 §2.7 | Cancel is implicit state-machine Back and lacks explicit first-step/keep/discard semantics. | blocker | confirmed | — | Handler trace; browser test pending |
| B14 | S2 Resume; S6 UX | Resume notice competes with footer/navigation derived from the hidden route beneath it. | blocker | confirmed | — | Runtime capture and early-return renderer trace |
| B15 | S1 additional 8; S3 §14; S5 SHOULD 11; S6 §2.8 | Radio/checkbox roles expose `aria-pressed`, not `aria-checked`. | blocker | confirmed | — | DOM trace; accessibility-tree test pending |
| B16 | S3 §14; S5 SHOULD 11; S6 §2.8 | Radio groups lack roving focus and native arrow-key behavior. | blocker | confirmed | — | No entry keyboard handler; keyboard test pending |
| B17 | S5 SHOULD 11; S6 a11y | Rerenders steal focus; the full-screen flow lacks correct focus containment/restoration. | blocker | confirmed | — | Render focus trace; browser focus test pending |
| B18 | S6 a11y; S2 F1/F7 | Validation failures are neither announced nor focused, and disabled actions lack adjacent explanations. | blocker | confirmed | — | Renderer trace; live-region/focus tests pending |
| B19 | S6 a11y | The top Back target can be narrower than 44px and loses a meaningful accessible name when rendered as `‹`. | blocker | confirmed | — | CSS/DOM trace; geometry/name test pending |
| B20 | S2 F1; S6 §2.8 | At 320px/large text, selection marks overlap labels. | blocker | confirmed | — | Review screenshots show failure at 390px; 320px probe pending |
| B21 | S2 F7; S6 §2.8 | Sticky footer/translucent action region can obscure or visually compete with content. | blocker | confirmed | — | Review screenshots/CSS; geometry test pending |
| B22 | S1 additional 9; S3 §15; S6 §2.9 | Canonical syntax gate omits multiple production JavaScript modules. | blocker | confirmed | — | Workflow inventory; CI assertion pending |
| B23 | S1 additional 9; S3 §15; S6 §2.9 | Canonical runtime CI does not execute entry pure, adapter, browser, or Plan 048 compiler-preference suites. | blocker | confirmed | — | Workflow inventory; CI run pending |
| B24 | S1 additional 10; S3 §15; S6 §2.9 | UI catalogue/CI captures only one generic onboarding state, not the required entry-state matrix. | blocker | confirmed | — | Capture-script inventory; regenerated catalogue pending |
| C01 | S3 §6; S6 regression | Plan 048 de-emphasis ranking can invert authored slot muscle intent (123 reviewed cases). | high | confirmed | — | Exhaustive review probe; focused regression pending |
| C02 | S3 §7; S5 SHOULD 3 | Compiler paired-exposure relations are omitted from preview and lost/replaced on activation. | high | confirmed | — | Compiler/adapter trace; paired relation test pending |
| C03 | S6 correctness; S3 §10 | Generated routes activate with localized “Untitled program.” | high | confirmed | — | Activation trace; route activation tests pending |
| C04 | S6 correctness | Activated metadata loses entry-route/source provenance. | high | confirmed | — | Draft-to-meta trace; reload test pending |
| C05 | S6 correctness | Activated metadata loses the deterministic compiler/catalogue fingerprint. | high | confirmed | — | Draft-to-meta trace; persistence/privacy test pending |
| C06 | S6 correctness; S5 SHOULD 3 | New generated programs inherit unrelated active-program `progressionModifiers`. | high | confirmed | — | Sentinel inheritance trace; regression pending |
| C07 | S3 §4; S5 SHOULD 1; S6 consider | Persisted setup results have no closed, route-specific schema or answer/fingerprint binding. | high | confirmed | — | `{}` activation-ready probe; schema tests pending |
| C08 | S3 §16 | Draft version pins omit independent `recentConsistency` and `simpleStart` policy versions. | medium | confirmed | — | Version-key comparison; drift tests pending |
| C09 | S6 consider | Setup-draft save failures are console-only, leaving resumability failure invisible. | medium | fixed | `a438404` | Forced `QuotaExceededError` browser probe proves an announced visible error and byte-identical active state; EN/PT generated catalog parity passes |
| C10 | S3 §10; S6 correctness/UX | Recommendation reasoning is static in UI instead of citing actual answers and compiler facts. | high | confirmed | — | Adapter/render trace; factual-copy tests pending |
| C11 | S3 §10; S6 correctness/UX | Recommendation lacks a human name, duration, priorities, progression, equipment assumptions, reductions, and compromises. | high | confirmed | — | Runtime capture; result schema/UI tests pending |
| C12 | S6 false-positive list | Recommend should show at most one close alternative only when genuinely useful, not always. | medium | intentionally unchanged | — | Plan 048 §§Recommend/acceptance; retain optionality |
| C13 | S1 additional 4; S3 §11; S5 SHOULD 5; S6 correctness | Custom has no must-have exercise control. | high | confirmed | — | State supports it but UI does not; browser test pending |
| C14 | S3 §11; S5 SHOULD 5 | A must-have/avoid contradiction compiles silently instead of returning a clear typed conflict/compromise. | high | confirmed | — | Direct compiler probe; regression pending |
| C15 | S5 SHOULD 5 | `core` priority can be accepted without affecting output. | high | confirmed | — | Registry/slot trace; compiler test pending |
| C16 | S5 SHOULD 5 | A Custom split offered as compatible can compile directly into a time conflict. | high | confirmed | — | Choice/compile contract trace; compatibility test pending |
| C17 | S1 additional 11; S2 F3; S6 correctness | Raw family/blueprint IDs and “compiler” jargon appear in user-facing UI. | high | confirmed | — | Runtime captures; copy/DOM tests pending |
| C18 | S1 additional 15; S6 correctness | Muscle, movement, equipment, capability, and day-merge vocabularies are duplicated and drift. | high | confirmed | — | Cross-module inventory; equality test pending |
| C19 | S5 SHOULD 4 | Bands are compiler-supported but absent from entry equipment choices. | medium | confirmed | — | Approved design/compiler/UI comparison; test pending |
| C20 | S5 SHOULD 4 | Compatible exercise history is hardcoded empty instead of supporting continuity. | high | confirmed | — | Adapter trace; deterministic history test pending |
| C21 | S1 additional 5; S3 §12; S5 SHOULD 6 | Browse fabricates release/executable/tested flags and card facts instead of consuming declared catalogue metadata. | high | confirmed | — | Adapter/compiler metadata trace; catalogue contract pending |
| C22 | S3 §12; S5 SHOULD 6 | Browse fingerprints ignore context even though compiled previews depend on it; selected identity/frequency can be lost. | high | confirmed | — | Fingerprint/selection trace; deterministic test pending |
| C23 | S5 SHOULD 6 | Empty Browse catalogue has no recovery state. | medium | confirmed | — | Renderer trace; empty-service browser test pending |
| C24 | S6 correctness; S3 Consider | Obsolete generator and beginner replacement entry points remain publicly reachable. | high | confirmed | — | DOM/global handler inventory; remove only after parity proof |
| C25 | S5 SHOULD 7 | Removing the final exercise through raw JSON can drop the Build day container. | medium | confirmed | — | Migration helper trace; empty-day regression pending |
| C26 | S5 SHOULD 9 | Import buffers full files without byte/depth/node bounds and invents defaults for malformed exercise rows. | high | confirmed | — | Import boundary trace; hostile-file tests pending |
| C27 | S5 SHOULD 10 | Shared setup validates progression envelope shape but not executable strategy parameters. | high | confirmed | — | Shared validation trace; released-format regression pending |
| C28 | S1 additional 7 | Avoided exercise is assigned `dislike` before the user chooses a reason. | medium | confirmed | — | Event-handler trace; UI test pending |
| C29 | S2 F4; S3 Consider | Custom split auto-selection mutates storage during render and leaves Continue disabled until re-click. | high | confirmed | — | Runtime evidence/render trace; state test pending |
| C30 | S2 F2 | Result/preview progress resets and announces “Section 1 of 5.” | high | confirmed | — | Runtime evidence/progress trace; DOM test pending |
| C31 | S3 §13 | `generator_completed` fires after activation rather than when a reviewable result is produced. | high | confirmed | — | Schema/call-site trace; runtime test pending |
| C32 | S3 §13 | Re-selecting a Browse template can duplicate the once-per-flow `template_selected` event. | medium | confirmed | — | Call-site trace; runtime count test pending |
| C33 | S5 BLOCKER 3 | PostHog 1.400.0 drops accepted events because `before_send` removes its required project `token`. | blocker | confirmed | — | Official tagged SDK `_runBeforeSend`; faithful-envelope test pending |
| U01 | S2 matrix; S6 visual | Hub repeats the title, shows meaningless progress, and lacks the accepted primary/secondary route hierarchy, icons, and chevrons. | high | confirmed | — | Runtime capture; visual/DOM verification pending |
| U02 | S2 matrix; S6 visual | Recommend lacks a route-specific header/clear first-step Cancel and uses oversized, card-heavy controls. | high | confirmed | — | Runtime captures; visual QA pending |
| U03 | S2 matrix; S6 visual | Schedule, environment, priorities, and constraints need compact hairline groups; equipment inventory should sit behind disclosure. | high | confirmed | — | Runtime captures; visual QA pending |
| U04 | S1 additional 12; S2 F6 | Entry options overuse bordered cards instead of the brand's restrained grouped rows. | medium | confirmed | — | Brand guide + runtime captures; visual QA pending |
| U05 | S6 visual | Recommendation needs explicit “See recommendation” then “Review this program” actions and meaningful result hierarchy. | high | confirmed | — | Plan/capture comparison; browser test pending |
| U06 | S2/S6 Custom matrix | Custom needs human split names, at most two real compatible choices, default rationale, summaries/change links, and an explicit Generate action. | high | confirmed | — | Plan/capture comparison; adapter/UI tests pending |
| U07 | S2/S6 Browse matrix | Browse cards need useful filters/context, purpose, frequency, duration, weekly structure, plain progression, specific mismatch, and distinguishable names. | high | confirmed | — | Plan/capture comparison; catalogue/UI tests pending |
| U08 | S2/S6 Preview matrix | Preview must be a decision surface with identity/facts, collapsible day summaries, counts, assumptions, compromises, draft editing, and explicit activation. | blocker | confirmed | — | Plan/capture comparison; browser/a11y tests pending |
| U09 | S2/S6 Build matrix | Build must visibly communicate draft state, empty-day editing, incompleteness, Save draft, and disabled activation until ready. | blocker | confirmed | — | Plan/capture comparison; browser tests pending |
| U10 | S2/S6 Resume matrix | Resume must be one coherent composition with route/step/recency, Resume, and Start over. | high | confirmed | — | Runtime capture; browser test pending |
| U11 | S2/S6 Import matrix | Import needs a coherent safe source/review composition without implying current state is already replaced. | high | confirmed | — | Runtime capture; import browser test pending |
| U12 | S2/S6 desktop | Desktop merely stretches the mobile column and needs a wider composition using the same grammar. | medium | confirmed | — | Responsive CSS trace; desktop captures pending |
| L01 | S1 additional 13; S3 Consider | English UI uses the forbidden synonym “plan” where domain copy requires “program.” | medium | confirmed | — | i18n search; generated-i18n check pending |
| L02 | S1 additional 14; S6 a11y/i18n | PT-BR contains PT-PT forms such as “registado” and “mantém-se.” | high | confirmed | — | Native-copy audit; generated-i18n check pending |
| L03 | S6 a11y/i18n | “Recomendar um para mim” is awkward PT-BR. | medium | confirmed | — | Native-copy audit; screenshot pending |
| L04 | S5 SHOULD 12 | PT-BR exposes untranslated English/anglicisms such as “Press” and “spotting,” plus compiler labels. | high | confirmed | — | i18n/runtime inventory; screenshot pending |
| T01 | S3 generative/CI; S6 verified-good caveat | Generative entry journeys use dummy results and a never-mutated active-byte sentinel, so they do not prove Build/Import/preview safety. | high | confirmed | — | Model trace; production-backed properties pending |
| T02 | S1 unproven 1 | Installed service-worker upgrade from the previous released cache to this entry flow has no explicit regression proof. | medium | confirmed | — | Fresh offline proof exists; upgrade test pending |
| T03 | S1 unproven 5 | Rules/version drift has pure coverage but no required resume/rebuild UI proof. | high | confirmed | — | Browser scenario pending |
| T04 | S1 unproven 6 | Active-program two-tab conflict has pure coverage but no complete browser UX proof. | high | confirmed | — | Two-page scenario pending |
| T05 | S1 unproven 7 | Invalid reusable-context restore behavior is not specified by Plan 048 and is not part of the initial state-shape gate. | medium | intentionally unchanged | — | Separate pre-existing restore-policy decision; no new product policy invented |
| T06 | S1 unproven 8 | No real production-user export corpus is available for compatibility testing. | medium | blocked | — | Use repository legacy/sparse/malformed corpus; disclose external evidence gap |
| T07 | S1 unproven 9 | Telemetry leakage suite showed same-origin isolation sensitivity after a long serial run. | medium | confirmed | — | Clean isolated run passed; reproduce after transport fix |
| D01 | S4 | Reposted visual audit repeats S2 findings and evidence. | none | duplicate | — | Same images/text as S2 |
| D02 | S7 | Reposted owner review repeats S6 findings and evidence. | none | duplicate | — | Same findings/text as S6 |
| F01 | S6 false positives | Mapping `about_half` to `returning` would be wrong; interrupted with its own one-week treatment is authoritative. | none | false positive | — | Owner-approved consistency bands and Plan 048 |
| F02 | S6 false positives | Recommend is not required to always show an alternative. | none | false positive | — | Plan 048 permits at most one genuinely useful close alternative |
| F03 | S6 false positives | Browse may retain ranked mismatched frequencies when the mismatch is specific and explained. | none | false positive | — | Plan 048 Browse ranking contract |
| F04 | S6 false positives | Limited-home programs need not require owned equipment. | none | false positive | — | Owner-approved Home contract starts from bodyweight only |
| F05 | S6 false positives | Compiler-context v2 and reusable programming-context v1 are distinct schemas, not version drift. | none | false positive | — | Program-entry/progression contracts |
| F06 | S6 false positives | Generative state-machine tests do not prove the production Import adapter is safe. | none | false positive | — | Test boundary inspection |
| F07 | S2 F5; S6 intentional differences | Large orange CTA fields from mockups conflict with Taurifer's contrast/one-accent brand contract. | none | intentionally unchanged | — | `docs/brand-guide.md` CTA rule |
| F08 | S2 F6; S6 intentional differences | Fake device chrome, raster noise, and gratuitous drop shadows are mockup artifacts, not implementation requirements. | none | intentionally unchanged | — | Brand guide and owner instruction |
| F09 | S2/S6 intentional differences | Inset hairlines and grouped list rows are compatible with the brand and should not be removed as “cards.” | none | intentionally unchanged | — | Brand guide visual grammar |
| F10 | S2 Import mockup | A paste-text import capability shown in a mockup is not authorized by Plan 048. | none | intentionally unchanged | — | Owner scope restriction |
| F11 | S5 Import; architecture trace | Full-backup restore is not a normal program candidate and must remain separate from program-only Import convergence. | none | intentionally unchanged | — | Backup contract and hardened replace transaction |
| F12 | S3 Consider; Plan 048 | Shared setup is not dead: its hardened codec/cookie/consent gate stays separate, then must adapt to common preview/activation without altering released payload semantics. | high | confirmed | — | `docs/program-entry-flow.md:215,244-248`; convergence tests pending |
| F13 | S5 unconfirmed | Reordering semantically equivalent preference arrays can alter the fingerprint, but the contract guarantees identical normalized inputs, not unordered-set equivalence. | none | intentionally unchanged | — | Stable-input determinism contract; canonicalization remains under test |
| F14 | S5 unconfirmed | Environment corrections already re-resolve the family on each compile; no stale-family path was found. | none | false positive | — | `compileWithServices`/`resolveFamilyId` trace; regression lock pending |
| F15 | S1/S6 caveats | Physical iOS/Android, VoiceOver, and TalkBack were not available to reviewers or this workspace; do not claim those device results. | medium | blocked | — | Browser accessibility tree/keyboard/geometry remain required and will be reported separately |

## Reconciliation decisions

- `about_half` stays `interrupted`; the disabled treatment flag and runtime consumption are the defects (`B01`, `B02`).
- Program-only Import converges on the candidate preview. Full-backup restore remains a distinct explicit restore operation (`B07`, `F11`).
- Shared setup retains ADR 0007 parsing, first-run precedence, cookie handoff, and consent; convergence begins only after that hardened handoff (`F12`).
- Browse can only expose a release catalogue whose facts are declared from the existing closed family/blueprint inventory. This work may not invent a new family, blueprint, or compiler constant (`C21`).
- The PostHog token finding is valid even though the faulty filter predates this PR: the exact pinned SDK drops an event when `before_send` removes `token`, so Plan 048 telemetry is otherwise nonfunctional (`C33`).
- Visual mocks guide composition, while brand and accessibility control CTA color, chrome, shadows, type size, and target geometry (`F07`–`F09`).
