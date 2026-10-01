# Unsupported workout grammar measurement

The `program_import_unsupported_concept` event measures categories explicitly
returned in the free-form import `notImported` sidecar. It carries only one
closed-enum `category` value from:

- `supersets`
- `rest_times`
- `rir_rpe`
- `tempo`
- `warmups`
- `cardio`
- `progression_rules`
- `deload`

The importer emits one event for each distinct recognized category when a
successfully parsed reply is accepted for review, in canonical order. Repeated
mentions collapse into one telemetry event, including a reply that goes through gap
resolution or is retried before review. Unknown,
malformed, and partially invalid sidecar entries are ignored; the client never
infers a category from source text, exercise names, model prose, or an unknown
sidecar value. These categories remain informational and do not change the
accepted executable program or progression contract.
The existing display-only `other_notes` value remains local and is not part of
this measurement vocabulary.

For analysis, use event count (imports surfacing the category) and unique
installations by `category`, with the same schema, release, consent, and pilot
filters as the free-form import funnel. This does not estimate mention counts
or prove that a category blocked adoption. Pair the distribution with direct
user evidence before planning executable support.

Telemetry opt-out, schema rejection, and transport failure retain the existing
closed-boundary behavior. No source, reply, prompt, provider text, exercise or
program name, arbitrary sidecar value, or personal information is permitted.

## PR #255 acceptance and integration rule

PR #255 is a standalone alpha-readiness branch, not part of the unified redesign. Under stage 5 of the [post-058 clearance sequence](../post-058-open-pr-clearance-sequence.md) it lands before the unified redesign branch is cut. It merges current `main` by merge commit (a published branch is never rebased, amended or force-pushed), is integrated one standalone branch at a time, allocates its cache revision from the then-live `main` at merge time, and merges only with a green `ci` on its exact final head. The [canonical backlog](../backlog.md) owns queue status; reconcile it when the merge is authorized, not while this branch is unmerged.

The branch changes cached `app.js`, `index.html`, `telemetry.js`, and `sw.js`, and adds a boot-time module, so the merge must bump the cache. The branch deliberately carries no cache or `?v=` change of its own: at merge time, read the live `CACHE` and the protected script-query inventory in `test/exercise-library.mjs`, allocate the next revision, and align the revisioned script URLs, the exact `sw.js` precache entries, and that contract. Do not infer a future revision from this branch. The module `unsupported-workout-grammar.js` is a plain required entry in the `sw.js` `ASSETS` release inventory (network-first, no owner or cache policy) and loads from `index.html` immediately after `telemetry.js` without a query revision.

Current branch evidence is the focused grammar and privacy assertions. `test/unsupported-workout-grammar.mjs` proves the closed enum, deterministic dedupe, unknown-value rejection, exact display vocabulary coverage, and that the module is loaded by `index.html` and is a required `ASSETS` entry. `test/telemetry-unit.mjs`, `test/telemetry-leakage.mjs`, `test/telemetry-runtime.mjs`, `test/program-freeform-import.mjs`, and `test/entry-privacy.mjs` cover event consent, the closed event schema and the import handoff. The merge candidate must rerun these against its exact final head and verify that no raw program or import text, arbitrary unsupported sidecar text, or personal data can enter event properties. The earlier PR evidence at `88c8226dbabe91b906bd127216b2bb34897065c1` is historical, not current-head review evidence.
