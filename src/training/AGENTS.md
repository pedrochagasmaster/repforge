# Training rules

The public interfaces are `metrics.js`, `identity.js`, `model.js`, `generation.js`,
`authoring.js`, `workout.js`, and `progress.js`. Other domains import those entry
files. Internal files exist for distinct algorithms, not for one-function layers.

Training never reads the DOM, browser storage, current app state, a catalog
singleton, a clock or random source. Supply catalog, identity and time explicitly.
`createProgramModel` accepts a captured ISO instant or an explicit caller clock;
command owners should capture one instant when multiple decisions must agree.
Custom lists are snapshot arguments. Archives retain captured movement facts.

`createGenerationRules()` owns one app/worker lifetime: the immutable catalog
identity cache, compiler, and validated transition capabilities. Supply its
`identity` to the platform catalog loader. Bare generation exports are pure
conveniences with no shared cache. A capability issued by one transition instance
must be validated/committed by that same instance. Never serialize capabilities.

`createEntryRules(catalog)` and `createWorkoutRules(catalog)` bind only verified
immutable catalog input. They return immutable operation interfaces, not stores.
`createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta})` owns installed
document replay, canonical sync and conflict refusal. Build explicitly opts into
`allowCreateDefinition`; installed documents never create a missing definition.
`authoring.suggestion` owns the shared Suggest loads opt-in and confirmation.
`authoring.review` edits recommendations; mounting, localization and DOM events
belong to UI. Pure edits return data/refusals; storage commands publish results.

Run the owning redesigned suite through `tools/run-tests.mjs --suite-id ...`.
Algorithm owners include `test/progression-engine-plan067.mjs`,
`test/generation-identity.mjs`, `test/program-compiler-plan067.mjs`,
`test/program-transition-plan067.mjs`, `test/program-review.mjs`,
`test/program-entry.mjs`, `test/workout-draft.mjs`, and migration fixtures in
`test/workout-draft-migration.mjs`. Migration-specific interfaces are proved by
`test/training-module-contracts.mjs`, `test/training-model.mjs`, `test/training-installed-editor.mjs`, and the real
worker/catalog protocol in `test/training-worker-modules.mjs`. Preserve semantic
assertions and fixture ownership when changing their import path.

Identity digests are full SHA-256 over the declared canonical bytes. Never replace
them with a shorter hash, localized name, date, mutable slot index or live state.
