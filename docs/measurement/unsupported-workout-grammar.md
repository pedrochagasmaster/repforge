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

The importer emits one event for each distinct recognized category in a parsed
reply, in canonical order. Repeated mentions collapse into one event. Unknown,
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
