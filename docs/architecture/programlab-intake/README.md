# Program Lab native-interface intake (slice 18)

PR [#432](https://github.com/pedrochagasmaster/repforge/pull/432) was independently
read through the authorized GitHub connector on 2026-10-18: **open, draft,
unmerged**, exact head `ce0b4403341ee9dbdd34dc6994a1244172189fb8`. Its PR description
reports CI on that head; those earlier results are not acceptance evidence for
this migration. The CLI API was unavailable; the connector supplied the actual
current PR record. Recheck the head immediately before applying this intake.

Native base: `5a2f6b671bc0bb17a58e8259d91fd8db4266dce8`.
Shared engine intake: `dcb05a3663366ccff1e3159e0d7481c62df338a4`.
The [input manifest](source-inputs.json) pins SHA-256 of every incoming file used
by the patch/reproducer. A moving Lab head requires a new comparison and proof,
not silently changing the recorded head. No Lab product implementation was
copied into the production tree, and no Lab merge or deployment is promised.

## Acceptance contract

The production side owns one compiler, layout, identity and executor. The Lab
owner retains its UI, database, run/archive algorithms and product acceptance.
The first complete slice is edited per-call policy → native allocation → actual
module worker → Lab run → isolated IndexedDB → archive worker → identical saved
result bytes. The patch targets final native interfaces; it never targets the
migration bridge or restores a classic compiler.

| Contract | Producer/consumer and objective evidence | Deliberate violation |
| --- | --- | --- |
| Production default preservation | `node test/programlab-default-parity.mjs`: all 233 pre-extraction result hashes and byte lengths, omitted/explicit defaults, successful and refused results, diagnostics noninterference. Fixture retains source `5a2a3928`; no golden regeneration. | Any changed result byte or diagnostic mutation fails the immutable hash comparison. |
| Complete immutable policy | `node test/programlab-policy-contract.mjs`: the native compiler's policy API validates, detaches and freezes. | Partial/unknown fields, sparse arrays, accessor/unsafe keys, nonfinite and cross-field RIR overflow are refused. |
| Actual allocation and estimates | `node test/programlab-native-policy.mjs`: three-day distribution/spillover changes before materialization; assumptions-only and changed-work cases; explicit saved rest beats common-model fallback. | Dropped allocation policy or substituted explicit rest changes the asserted outputs. |
| Historical readability distinct from eligibility | `node test/programlab-structure-contract.mjs`: supported historical identities remain unchanged; current catalog validation still refuses them. | Malformed identity, metric, RIR, set index, duplicate day and unsafe accessor cases fail structural validation. |
| Strict executor and snapshot ownership | `node --test test/programlab-executor-contract.mjs`: no main computation after absent/constructor/init/send failures; queued policy snapshot detaches; stale ready cannot revive a failed executor. | A main fallback, mutated queued policy or dropped diagnostics fails. Existing `test/platform-executor-contract.mjs` also remains green. |
| Actual native worker | `node test/programlab-worker-policy.mjs`: complete experimental-policy/diagnostics result equality between direct, actual module worker and production fallback; strict broken-worker mode refuses with main count zero. | Worker options discarded or strict failure replaced by fallback fails. Uses the existing browser harness and a served repository. |
| Pinned Lab compatibility patch | Reproducer below: patch applies cleanly to exact hashed incoming source, builds the transitive native graph and runs the **original pinned** Lab native-policy assertions against its real patched domain. | Missing transitive policy and a Lab import backedge fail actual packaging; existing output is never overwritten. |
| Packaged runtime/data boundary | Reproducer `--browser`: actual packaged Lab root initializes, executes two policy cells in the real compiler worker, saves/loads real IndexedDB records and exports/imports through the actual module archive worker with exact result bytes. Build provenance names native policy/source hashes; production state/draft sentinels stay unchanged; only `taurifer_programlab_v1` exists; zero SW registrations. | Result-byte, provenance, store-name, sentinel or SW changes fail assertions. This is a seam proof, not full Lab UI acceptance. |

The configured existing strict scopes and architecture checker pass on the
shared intake. Strict closure of generation internals is owned by the concurrent
training typing slice; the configured-scope result does not certify unchecked
imports or replace that final gate.

## Public interfaces and source disposition

| Incoming responsibility/file | Final interface / disposition |
| --- | --- |
| `engine-policy.js` | One implementation in `src/training/generation/internal/policy.js`, constructed inside the compiler's explicit lifetime. Public policy/default/metadata operations are on the compiler instance and exported by `training/generation.js`. No new generic policy registry or second public barrel. |
| `generation-layout.js` | Existing native `generation/internal/layout.js` gains the exact incoming policy hooks for allocation cost, pre-distribution set count, spillover and estimates. Supported request ceilings remain the production domain. No retired time trimming, seed behavior or emphasis policy is restored. |
| `program-compiler.js` | Existing native compiler owns per-call policy validation, prescription materialization, deterministic `allocation-lineage@1` diagnostics and catalog-independent historical structure validation. Default generator namespace/version `073.4` and canonical request eligibility stay unchanged. |
| `program-transition.js` | Retain the native transition factory and its shared compiler authority; incoming #432 makes no transition algorithm change. Never construct a hidden catalog/compiler for it. |
| `program-engine.js` | Replace incoming classic worker/script discovery with the native `platform/program-executor.js` and `platform/program-worker.js`. Optional production fallback stays enabled; Lab passes `allowMainThreadFallback:false`. The compiler instance supplies policy validation before enqueue. Minimal non-policy executor clients remain supported; supplying a policy without a policy-capable compiler is refused. |
| `programlab/services.js` | Saved patch imports the four public native entries directly and composes one generation/catalog authority. Uses existing `canonicalizeRequest`; does not preserve redundant `normalizeProgramRequest` alias. UI/store/run/archive algorithms stay owned here/on their existing modules. |
| `programlab/domain.js` | Retain all algorithms/limits. Replace identity `require`/global discovery with the native identity public entry. Build provenance consumes the assembler's exact `runtimeFiles`, not a classic script allowlist. |
| `programlab/store.js` | Retain unchanged, including `taurifer_programlab_v1`/schema 1, revisions, transaction/recovery and fresh imported IDs. No production persistence import or automatic program activation. |
| `programlab/archive.js` | Retain bounds, validation, historical records and multipart algorithms; replace domain discovery with its explicit Lab module import. Historical supported records are structurally readable, never automatically current-eligible. |
| `programlab/archive-entry.js`, `archive-worker.js` | Trusted literal native imports and fixed catalog pin; module worker constructor. Remove `importScripts` and the root relocation alias. A record/archive never chooses executable modules. |
| `programlab/index.html`, new `native-entry.js` | Keep Lab markup/UI unchanged. Retain generated exercise index and Lab i18n; one ordered Lab composition root mounts its existing domain/store/services/app. No production boot, SW, telemetry or migration globals. The existing Lab-owned host globals remain local to its artifact; this patch creates no production compatibility bridge. |
| `tools/build-programlab.mjs` | Saved patch derives the transitive static graph from native public entries plus the real worker root, preserving source paths. AST parsing uses the already-pinned verification TypeScript tool (not shipped). Reject graph backedges outside training/platform. Manifest hashes every shipped byte; fingerprints include policy, compiler/layout, catalog, executor/worker and adapters. Refuse existing output and production `dist/`. |
| `programlab/app.js`, i18n, styles | Retain unchanged; no UI implementation is duplicated in this branch. |

The patched standalone artifact contains 39 files on the recorded intake. That
count is an observation, not a permanent limit: closure and hashes govern.
Classic shared scripts are absent. Type-only contracts stay out of the runtime
artifact. Normal production release assembly continues to exclude `programlab/`
and the owner-only Lab assembler.

## Apply and independently reproduce

Install the existing pinned verification tools and test browser dependencies as
documented by the repository; no root package manifest is introduced. The source
checkout below must already contain the pinned PR commit. The verifier only
reads it with `git show`; all application, patching, builds, fault injection and
browser data occur in temporary space and are deleted afterward.

```sh
node tools/verify-programlab-intake.mjs --source /path/to/checkout-containing-ce0b4403
REPFORGE_CHROME=/path/to/chromium node tools/verify-programlab-intake.mjs --source /path/to/checkout-containing-ce0b4403 --browser
```

The verifier checks hashes, runs `git apply --check`, applies the
[owner patch](ce0b4403-native-imports.patch), overlays this revision's actual
native source graph and builds the real standalone artifact. Its temporary
checkout truthfully records `sourceCommit:null`, not a fictitious clean commit;
the outer report records both exact source heads. An owner-built artifact in a
real clean combined checkout must record that checkout's actual commit/dirty
state. Hashes detect differences; they do not prove authorship.

For owner integration, first reconcile the current architecture branch and this
shared engine intake into the Lab branch, then apply the patch against its
recorded incoming file versions. Do not apply the production architecture's
old root-script deletions as permission to discard Lab tests. Resolve source
conflicts by preserving the single native algorithms; resolve UI conflicts with
the Lab owner. If a shared engine file changes afterward, rerun immutable
233-case/default and native-policy/worker proofs before accepting the update.

## Test redesign intake and remaining owner gates

These incoming commands remain distinct risk owners. Integrate with #446's
current suite inventory/dependency selector; do not restore its retired broad
matrix or drop Lab contracts to keep a particular command count. The new
production-side tests above are independently runnable. Their targeted seam
coverage does not attest completion of every incoming Lab command.

| Incoming command / ownership | Required reconciliation on the Lab branch |
| --- | --- |
| `programlab-default-parity.mjs` | Use the native test/immutable 233-case fixture adopted here; retain hashes, refused cases and diagnostic noninterference. This path intentionally supersedes the incoming classic-import version. |
| `programlab-native-policy.mjs` | Keep the incoming **Lab-domain own/common metrics assertions**, with native imports. The verifier runs those exact pinned assertions. Production's estimator-only variant is an additional seam check, not permission to discard Lab metrics assertions when resolving the path conflict. |
| `programlab-domain.mjs` | Update test imports to native generation/authoring and the Lab domain's default export. Preserve snapshot identity, semantic comparison/cohort, timeout/checkpoint/cancel races and fresh-executor assertions. |
| `programlab-archive.mjs` | Import the Lab archive default export and native compiler's structural boundary. Preserve historical unknown IDs/unsupported diagnostics read-only data and current eligibility refusal. |
| `programlab-package.mjs` | Replace classic script-list expectations with native transitive module/source hashes. Its fixture must include actual native modules and the verification parser. Retain missing-source/catalog pin/remote path/no-overwrite/production-output negatives. New reproducer already falsifies a missing transitive module and a Lab backedge. |
| `programlab-archive-limits.mjs` | Retain published real limits, raw-byte round trip and maximum-bound rejection; adapt imports only. The intake browser seam is not a 500 MiB responsiveness proof. |
| `programlab-store.mjs` | Retain real IndexedDB atomic import/fault/recovery assertions with module archive worker and native result producer. The intake confirms one real save/load/archive round trip, not every storage fault. |
| `programlab-ui.mjs` normal | Preserve edited controls → real worker → inspector → save/reload/archive, exact Single/Batch/Sweep bytes, historical readonly, unsaved/checkpoint/cancel and production-origin sentinel. Point its builder at native paths. |
| `programlab-ui.mjs --corpus` | Retain real 180-scenario/360-cell execution, truthful domain conflicts versus errors, cancellation and measured responsiveness. Never replace this with the Node default hash proof. |
| `programlab-ui.mjs --shell` | Retain missing-service fail-closed behavior, EN/PT draft/reload, keyboard/narrow/200% text. Existing Lab markup/styles are unchanged; this intake does not assert a new visual certificate. |

Required before production slice 19: shared intake is integrated once; native
compiler/default/policy/worker checks and final type/dependency gates pass;
production package remains Lab-free; this concrete pinned owner patch and
reproducer remain reviewable. **Those are the production-side slice 18 exit
criteria.** Full Lab branch acceptance, current-head rebasing and owner review
remain #432's gates. No new product decision is needed for this intake.
