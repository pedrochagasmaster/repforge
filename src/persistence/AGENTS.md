# Persistence

Public entries are `snapshot.js`, `durable.js`, and `preferences.js`.
`contracts.d.ts` describes the existing protocol; it is not a new saved schema.
Snapshot policy validates/canonicalizes/rebases values. The durable instance owns
replicas, WAL, state lock, DraftV2 checkpoints/sidecars/CAS, and settlement.
Preferences owns device/tab records; those records are separate from training.

Keep historical `repforge` keys, database/store names, identities, raw recovery
bytes and unknown saved fields. Input validation and stored-data preservation
have different policies. No UI gets a replica adapter or writes storage directly.
Do not hide committed/pending/rejected/settled outcomes behind `save(): boolean`.

A protocol change needs the real fault/race owner: find commands with
`node tools/run-tests.mjs state --list`. Examples include `persistence-race`,
`workout-draft-storage`, `draftv2-staged-cas`, and transition crash/replay.
Use shipped interfaces and real localStorage/IndexedDB for publication claims.
The immutable migration fixtures are historical evidence; never regenerate them
to hide drift. Matching historical shell/script fixtures remain deliberate.

The entire persistence/training import graph is checked by strict checkJs in
`tools/typecheck/tsconfig.json`. Keep raw external values unknown until validated.
