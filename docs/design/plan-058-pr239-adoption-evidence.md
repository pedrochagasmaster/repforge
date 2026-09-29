# Plan 058 PR239 architecture-adoption evidence

Plan 058 adopts Architecture-audit items 1–7 as acceptance scope. This record
binds each item to the current implementation and executable proof; the P6
checkpoint comment on PR #256 binds the evidence to its pushed source SHA and
automatic-feedback receipt.

## Acceptance evidence

| Item | Current owner and implementation | Concrete evidence |
| --- | --- | --- |
| 1. Release/cache contract | `sw.js` declares the runtime asset policy once in `ASSETS`, including required/optional ownership and immutable-runtime policy. `RELEASE_ASSETS` and `APP_SHELL_PATHS` derive the resolved policy; the release assertion reads actual `index.html` script tags for URL, optional-owner, and load-order parity. | `test/vendor-runtimes.mjs` passes 96/96; `test/exercise-library.mjs` passes 39/39 and checks the final revision 337 plus every exact runtime URL. No additional runtime manifest or build step was introduced. |
| 2. Moved-source guard and selection | Production syntax and telemetry checks enumerate extracted modules as well as `app.js`; unknown executable inputs remain conservatively selected. | `node tools/check-production-syntax.mjs`: 24 modules and 27 reviewed telemetry producer calls pass. `node --test test/ci.mjs`: 26/26; `node tools/run-tests.mjs --check`: all 156 commands classified. `node tools/run-tests.mjs affected --list --base 4693d5c4bdad57d0c14a94da3bc26baee42d2d0b` selects 155 commands across fast, entry, workout, state, and privacy. Shared `app.js`, `styles.css`, `sw.js`, and catalog ownership widen beyond the ten-command cutoff, so generic regression is delegated to remote feedback. `test/telemetry-leakage.mjs` remains covered by the privacy lane. |
| 3. Cold/offline/upgrade/failure behavior | `sw.js` serves only valid code responses for script requests. Optional Motion, DnD, and deploy-generated PostHog config have explicit owners and guarded callers. | At cache revision 336, `node tools/run-tests.mjs state --suite sw-upgrade` passed 1/1. The suite proves cold boot, cached offline boot, old/new worker control, and required-code failure; its optional-HTML fixture rejects HTML for Motion, DnD, and `posthog-config.js`, returns a non-HTML 503, and verifies the app and telemetry boundary boot without generated config. The Sol correction boundary `4b61d990fe8b7ee765d0eac701a69546bb0402bd` advanced the cache to 337; the focused `sw-upgrade` rerun and automatic feedback `36527278582` passed at that final revision. |
| 4. Presentation ownership | The semantic contract owns applicable `motion-polish.css` rules. The 15 `rootRecipeOwners` entries in `tools/ui-role-inventory.json` map each helper to an existing role, selector, rationale, plan owner, and affected states. Numerically equal recipes remain separate when their contexts differ. | At the P6 cleanup SHA, EN and PT-BR audits passed 294 rendered variants and 26,896 checks per locale. At final P6 correction SHA `4b61d990fe8b7ee765d0eac701a69546bb0402bd`, the complete audit passed 148 live states, 592 rendered variants, and 53,916/53,916 checks with zero failures/unsupported/missing/exempt. Strict CSS reports 0 literal declarations and 0 obsolete alias references. `node test/ui-system.mjs --css-debt-only` passes seeded negatives for URL-bearing color declarations, arbitrary-name custom-property literals, `motion-polish.css` debt, unsupported weights, and obsolete aliases. The retained old-client hover rules and `.tour-rest-hint` caption have exact semantic owners in `ui-system-semantic-contract.md`. |
| 5. Obsolete delegates and selectors | Removed `saveOnboardingProgram` and `editOnboardingProgram`; their callers use `activateEntryPreview` → `finalizeProgramSetup` → the existing replacement transaction. Removed the unreachable Program `renderVolume()` presentation and current-shell rules for `.blockreview`, `.tag-rec`, `#blockStrategies`, and `.attn--add`. | Entry/program runtime suites and `test/program-actions.mjs` cover the replacement route. The visible `#seeVolumeAudit` row remains and enters the installed editor; its old scroll target was a permanently hidden `#volume` host with no registered rendered state. `OLD_APP_SHA` does emit the block-review family, but its matching cached generation includes its own stylesheet; the current shell has no `#blockReview`/`#blockStrategies` host, the current app emits none of those selectors, and the pinned historical draft fixtures do not invoke that retired route. The static scan also confirmed the current recommendation producer has no `attn--add` class. CSS-debt negatives reject obsolete aliases. |
| 6. Historical formats and behavior | Durable keys, readers, locks, DraftV2, progression identity, and transfer scope are unchanged. The shell retains `#volume` as hidden, inert, and absent from the accessibility tree for the pinned pre-058 app. | Historical-app suites completed on the P6 worktree against `OLD_APP_SHA=3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4`: workout-draft storage 77/77, program-draft conflicts 75/75, adversarial draft transactions 37/37. Full outputs show downstream save, conflict, replacement, reload, recovery, and stale-writer scenarios completed. The final revision-337 change did not alter compatibility behavior; `sw.js` and `test/exercise-library.mjs` are aligned. |
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
