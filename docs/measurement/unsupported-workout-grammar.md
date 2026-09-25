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

## Draft PR #255 acceptance and merge handoff

The branch is still draft and the [canonical backlog](../backlog.md) still places this measurement in the post-overhaul queue. Reconcile the backlog status when the eventual merge is authorized, not while this branch is unmerged.

The branch changes cached `app.js`, `index.html`, `telemetry.js`, and `sw.js`, and adds a boot-time module, but its current cache remains `repforge-v301`, the same revision as its present `main` base. This violates the cache-bump rule. Final closure is **DEFERRED BY DESIGN — post-Plan-059 rebase**. After Plan 059 merges, assign the next real cache revision from that baseline, align revisioned script URLs and `sw.js` precache entries, and rerun the shell/upgrade gate. Do not infer a future revision from the present branch.

Current branch evidence is limited to the focused grammar and privacy assertions. `test/unsupported-workout-grammar.mjs` proves the closed enum, deterministic dedupe, unknown-value rejection, exact display vocabulary coverage, and shell inventory. `test/telemetry-unit.mjs`, `test/telemetry-fixtures.mjs`, `test/program-freeform-import.mjs`, and `test/entry-privacy.mjs` cover event consent and the import handoff. The eventual candidate must rerun these against its exact post-rebase SHA and verify that no raw program or import text, arbitrary unsupported sidecar text, or personal data can enter event properties. The earlier PR evidence at `88c8226dbabe91b906bd127216b2bb34897065c1` is historical, not current-head review evidence.

Expected Plan 058 #256 rebase overlaps: `app.js`, `index.html`, `sw.js`, and `test/suites.mjs`, plus the shell revision assertions in `test/exercise-library.mjs`. Preserve the new measurement module in both `ASSETS` and `SHELL` during that rebase. This note does not authorize changing the active Plan 058/059 candidate.
