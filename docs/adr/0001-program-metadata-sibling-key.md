# Program metadata as sibling `programMeta` key

RepForge stores the active program as a flat exercise array (`state.program`) for backward-compatible backups and program-only export. We add program identity and lifecycle fields in a sibling object `state.programMeta` rather than wrapping exercises in `{ meta, exercises }`.

We rejected reshaping `state.program` into an envelope because every consumer (Log tab, Stats, migration, program-only import) already treats it as `Exercise[]`. A sibling key lets legacy backups load unchanged, keeps the exercise array as the stable interchange format, and avoids a breaking migration. Program-only export gains an optional v2 shape `{ version: 2, meta, exercises }` while array-only imports remain supported forever.

Program status on the Program tab is derived plain language (On track, Partial week, Rebuilding) from adherence and progression health — not a stored numeric score, streak, or gamification metric.
