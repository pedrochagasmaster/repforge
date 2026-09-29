# Plan 058 PR239 architecture-adoption evidence

Plan 058 adopts Architecture-audit items 1–7 as acceptance scope. This record
binds each item to the current implementation and executable proof; the P6
checkpoint comment on PR #256 binds the evidence to its pushed source SHA and
automatic-feedback receipt.

## Acceptance evidence

| Item | Current owner and implementation | Concrete evidence |
| --- | --- | --- |
| 1. Release/cache contract | `sw.js` declares the runtime asset policy once in `ASSETS`, including required/optional ownership and immutable-runtime policy. `RELEASE_ASSETS` and `APP_SHELL_PATHS` derive the resolved policy; the release assertion reads actual `index.html` script tags for URL, optional-owner, and load-order parity. | `test/vendor-runtimes.mjs` passes 96/96; `test/exercise-library.mjs` passes 39/39 at exact P6 SHA `e5bca41c5cb017c3cd161e8a880237a3c94a5de7`, and checks cache revision 339 plus every exact runtime URL. No additional runtime manifest or build step was introduced. |
| 2. Moved-source guard and selection | Production syntax and telemetry checks enumerate extracted modules as well as `app.js`; unknown executable inputs remain conservatively selected. | At `e5bca41c`, `node tools/check-production-syntax.mjs` passes 24 modules and 27 reviewed telemetry producer calls. The exact-head plan job passes `node tools/run-tests.mjs --check`; `test/ci.mjs` remains in the required fast feedback lane. `node tools/run-tests.mjs affected --list --base 94fe9daae34e65c821bf4a18576007ecc4f4f39a` selects 82 commands across fast, entry, workout, and state. Shared `styles.css`, catalog ownership, and cache revision exceed the ten-command cutoff, so broad regression was delegated to automatic feedback `36594476625`, which passed at the exact head. `test/telemetry-leakage.mjs` remains covered by the privacy lane. |
| 3. Cold/offline/upgrade/failure behavior | `sw.js` serves only valid code responses for script requests. Optional Motion, DnD, and deploy-generated PostHog config have explicit owners and guarded callers. | `node test/sw-upgrade.mjs` passes at exact P6 SHA `e5bca41c` and cache revision 339; automatic feedback `36594476625` also passes its state lane at that SHA. The suite proves cold boot, cached offline boot, old/new worker control, and required-code failure. Its optional-HTML fixture rejects HTML for Motion, DnD, and `posthog-config.js`, returns a non-HTML 503, and verifies the app and telemetry boundary boot without generated config. Earlier revision-336/337 proofs are historical. |
| 4. Presentation ownership | The semantic contract owns applicable `motion-polish.css` rules. The 15 `rootRecipeOwners` entries in `tools/ui-role-inventory.json` map each helper to an existing role, selector, rationale, plan owner, and affected states. Numerically equal recipes remain separate when their contexts differ. | At final production source `e5bca41c`, strict metadata reports 148 states, 275 selectors, six exact exceptions, zero CSS literals, and zero obsolete aliases. The final local rendered traversal completed 592/592 variants and reported 6,156/6,156 checks with zero failures, unsupported, missing, or exempt roles; exact evidence-head feedback `36600457425` independently completed `node tools/check-ui-system.mjs` successfully. The focused `library/list` role audit also passes 5,664/5,664. Deliberate negatives reject URL-bearing colors, arbitrary-name custom properties, `motion-polish.css` literals/aliases, unsupported weights, obsolete aliases, named colors such as `rebeccapurple`, Color 4 `color()` values, and `ch` font sizes. |
| 5. Obsolete delegates and selectors | Removed `saveOnboardingProgram` and `editOnboardingProgram`; their callers use `activateEntryPreview` → `finalizeProgramSetup` → the existing replacement transaction. Removed the unreachable Program `renderVolume()` presentation and current-shell rules for `.blockreview`, `.tag-rec`, `#blockStrategies`, and `.attn--add`. | Entry/program runtime suites and `test/program-actions.mjs` cover the replacement route. The visible `#seeVolumeAudit` row remains and enters the installed editor; its old scroll target was a permanently hidden `#volume` host with no registered rendered state. `OLD_APP_SHA` does emit the block-review family, but its matching cached generation includes its own stylesheet; the current shell has no `#blockReview`/`#blockStrategies` host, the current app emits none of those selectors, and the pinned historical draft fixtures do not invoke that retired route. The static scan also confirmed the current recommendation producer has no `attn--add` class. CSS-debt negatives reject obsolete aliases. |
| 6. Historical formats and behavior | Durable keys, readers, locks, DraftV2, progression identity, and transfer scope are unchanged. The shell retains `#volume` as hidden, inert, and absent from the accessibility tree for the pinned pre-058 app. | Against `OLD_APP_SHA=3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4`, the full historical-app outputs complete downstream save, conflict, replacement, reload, recovery, and stale-writer scenarios: workout-draft storage 77/77, program-draft conflicts 75/75, adversarial draft transactions 37/37. The full logs were inspected. P6 e5 changes no HTML or app/durable modules; its exact-head workout and state feedback lanes pass. Cache revision 339 is aligned across `sw.js` and `test/exercise-library.mjs`. |
| 7. Retained delegates and exceptions | The forwarding seams below have live app consumers and one implementation owner; they are not alternate storage authorities. Exact CSS exceptions remain only in the role inventory. | The complete forwarding families, consumers, reasons, and plan owner are listed below. `tools/ui-role-inventory.json` records every surviving CSS exception with exact selector, semantic role, rationale, owner, and affected catalog states. |

## Retained forwarding seams

| Forwarding family | Live consumer | Reason retained | Existing owner |
| --- | --- | --- | --- |
| `idbGet`, `idbSet`, `idbDel` | App boot, auxiliary IndexedDB reads/writes, and recovery flows | Stable app bindings to the single auxiliary-IDB implementation | Plan 052 `DurableState` |
| `stripStorageMeta`, `exportableState`, `mirrorComparisonSnapshot`, `canonicalPayload`, `snapshotsEqual`, `readLocalStatus`, `readIdbStatus`, `chooseSnapshot`, `enqueueWrite`, `writeSnapshot`, `requireAdapter`, `refreshPersistenceHead`, `withStorageLock`, `resolveBootReplicas`, `settlePendingJournal`, `enqueueStateChange`, `clearAllPendingJournal`, `readPendingJournal` | App boot reconciliation, replica arbitration, state commits, and journal settlement | App composition consumes `DurableState`; settlement, replay, and replica policy each have one implementation | Plan 052 `DurableState` |
| `draftEffectOutcome`, `normalizeDraftEffectOutcome`, `pendingJournalEffect`, `draftEffectRequiresCoordination`, `pendingDraftTransaction`, `pendingJournalEffectState`, `applyPendingJournalEffect`, `pendingDraftPostEffectAccepted`, `pendingDraftRelatedState`, `pendingDraftSettlementAccepted`, `pendingDraftEffectAccepted`, `draftProgramFingerprint` | Program replacement and draft/WAL coordination | Transaction callers retain a narrow composition seam while `DurableState` owns the effect and journal behavior | Plan 052 `DurableState` |
| `persist`, `commitProposedState` | User state proposals and app mutations | These retain app-level validation, normalization, rebase, and preflight; they are not pass-through copies of durable settlement | Plan 052 `DurableState` plus the app proposal boundary |
| `#volume` hidden compatibility hook | Pinned pre-058 app SHA above | Old cached app boot still looks up and writes this element; current UI never exposes it | Plan 058 cache compatibility; old-client fixture |
| `.exercise:not(.is-skipped) .ex__topend .ex__skip:hover`, `.entry__exercise-action--avoid:hover`, `.tour-rest-hint` | Pinned pre-058 workout/entry scenarios | Preserve the old client's workout action, entry choice, and rest-preview caption while using their existing semantic roles | Plans 054/055; documented in the semantic contract |

The six exact CSS exceptions are `.settings-identity__mark`, `.firstrun__logo`,
`#restSheet .restdial__arc`, `#completedVolume .vrow__bar`,
`.safaribar__side`, and `.exdet-art`. Their selector-specific reasons, owners,
and states live in `tools/ui-role-inventory.json`.

The first-run brand paper is owned by the exact `.firstrun__logo` decorative-art
exception, including its `--brand-paper:#F4F2EF` value and affected states.
`.installbanner__icon` uses the committed icon PNG as its background and has no
CSS color literal to exempt.

## Dead-selector verification

The parallel pre-final audit's approximate 105-name scan was a lead from an
earlier source boundary. At the live P6-start head `4693d5c4bdad57d0c14a94da3bc26baee42d2d0b`
and the current P6 cleanup worktree, its named legacy families
`.weekstrip*`, `.settings-profile*`, `.today-program*`, `.cal__*`,
`.blockreview*`, `.program-day*`, `.program-footer*`, `.statband*`,
`.sectionhead*`, `.onb__changes*`, `.onb__hint*`, `.onb__import*`,
`.datepick*`, `.sum-chip*`, `.card--danger`, `.card--flat`, `.text-btn*`,
`.cta-sub*`, and `.pagehead__back` are absent from current CSS.

The current runbook literal scan reports 26 class names absent as complete
strings from root JavaScript and HTML. Every one is a generated current class or
the pinned old-client caption:

| Candidate family | Producer or historical consumer | Proof |
| --- | --- | --- |
| `.exthumb--sm`, `.exthumb--md` | `exerciseThumb`/`emptyThumb` accepts a size; `pickerRow`, Program exercise rows, and Share use `sm`/`md` | `test/library-flow.mjs`, Program/Library catalog states |
| `.deck__slot--prev`, `.deck__slot--next` | Focus deck slot template interpolates the side | `test/focus-mode.mjs`, `test/simulation.mjs` |
| `.is-new`, `.is-hold`, `.is-reduce` | Current recommendation/exercise templates interpolate the validated progression status | `test/simulation.mjs` exercises all three statuses |
| `.sum-outcome__state--improved`, `.sum-outcome__state--declined` | Summary template interpolates `outcome.outcome`; the frozen outcome map contains `improved`, `maintained`, and `declined` | Production summary and declined-summary catalog states |
| `.icon-mask--trend`, `.icon-mask--scale`, `.icon-mask--building`, `.icon-mask--house`, `.icon-mask--kettlebell`, `.icon-mask--rack`, `.icon-mask--flex` | Entry icon templates interpolate icon IDs; `ENTRY_DESIRED_ICONS` and `ENTRY_ENV_ICONS` supply these values | Registered entry route states render the radio-card, group, result, and preview icons |
| `.entry__fact--data` | Catalogue context facts interpolate `fact.kind` (`data`/`language`) | Production catalogue state |
| `.entry-body--entry`, `.entry-body--priorities` | Onboarding template interpolates `entryState.step` | `program-entry.js` validates step/route state; entry browser suite |
| `.entry-route--recommend`, `.entry-route--custom`, `.entry-route--browse`, `.entry-route--build`, `.entry-route--shared`, `.entry-route--import` | Onboarding template interpolates `entryState.route` | `program-entry.js` closed `ROUTE_SET`; all route producers and registered states |
| `.tour-rest-hint` | Pinned `OLD_APP_SHA=3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4` creates the rest-preview caption | Historical-app suites completed after restoring the hidden inert compatibility hook; caption ownership is in the semantic contract |

The 26 candidate names therefore resolve to live runtime or pinned historical
consumers. The specifically named obsolete families were removed or are absent
at the current CSS boundary; no further deletion is justified by the static
candidate scan.
