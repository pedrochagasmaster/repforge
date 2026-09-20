# Canonical muscle attribution and compact planned volume

- **Status:** Accepted; Plan 056 follow-up
- **Decision owner:** Plan 056 (Progress and block lifecycle)
- **Scope:** custom exercises, program entry/import, durable state, and Progress

## Decision

Taurifer uses the closed `MUSCLE_TOKENS` vocabulary exported by
`program-entry.js` and re-exported by `program-entry-adapter.js` as the only
muscle-attribution domain. An attribution is a comma-separated string of
distinct, trimmed, case-sensitive canonical tokens in that vocabulary. The
empty string means that the side has no attribution; non-empty values are
stored in canonical comma-joined form and remain within the existing 500-code-
point field limit.

The same normalizer and typed `invalid-muscle-domain` rejection apply to the
custom-exercise editor, setup links, shared setup, JSON/free-form import
reconciliation, staged program rows, durable state, and DraftV2 workout
provenance. Compiler previews may carry their private internal muscle IDs while
they are staged, but the editor/activation boundary resolves those IDs to the
canonical exercise definition before anything durable is accepted.

`plannedVolumeHistory.muscles.direct` and `.secondary` use canonical muscle
tokens as sparse object keys. Their key limit is derived from
`MUSCLE_TOKENS.length`; the generic progression bounds remain unchanged, and
the history never stores a receipt for every exercise and week.

## Legacy and recovery behavior

Older snapshots may contain arbitrary labels because the previous contract
accepted them. There is no safe, lossless mapping from an unknown label to one
of the canonical tokens, so Taurifer does not rename, truncate, merge, or drop
that attribution. State-shape validation rejects it before normalization or a
write, and shared/import validation rejects it at ingress with the typed domain
error. The existing replica arbitration and recovery surfaces retain the
original local or IndexedDB value for export/manual repair; they do not replace
it with a silently altered valid snapshot. DraftV2 keeps the same raw recovery
behavior for an invalid legacy draft.

Manual repair means replacing the unsupported attribution with an intentional
canonical token (or removing it), then importing/activating the repaired state.
Historical volume is never silently reassigned, so exact totals remain the
owner's decision when repairing an old arbitrary label.
