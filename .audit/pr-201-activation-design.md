# PR #201 draft and activation design

## Problem

The entry state machine is pure, but its production boundary accepts an open-ended result object and writes one raw setup-draft key. Build, preview editing, program-only Import, shared setup, and ordinary replacement can leave through different paths. Those paths do not share archival, durable revision checks, draft cleanup, or metadata rules.

The correction needs one candidate boundary and one activation boundary. It must reuse the current state journal, active-workout draft transaction, Import parser, shared setup gate, and full-backup restore behavior.

## Caller usage

UI code receives a draft session. It does not write `repforge_program_setup_draft_v1` or mutate the active program.

```js
const opened = await setupDrafts.openOrCreate({
  activeProgramRevision: await readDurableRevision(),
  versions: entryVersions(),
  now: entryNow(),
});

const session = opened.session;
await session.transition((draft) => ProgramEntry.selectRoute(draft, "build"));
```

Build and preview editing replace the candidate in the draft. They do not activate a temporary program.

```js
await session.replaceCandidate(buildCandidate);
await session.editCandidate((candidate) => editCandidate(candidate, command));

const readiness = await session.activationReadiness();
if (readiness.ok) await activateEntryCandidate(session, { destination: "log" });
```

Program-only Import and shared setup keep their current parsers and consent gates. Each adapter hands the entry session a validated candidate.

```js
await session.replaceCandidate(importReview.toCandidate());
await session.replaceCandidate(sharedReview.toCandidate());
```

Full-backup restore does not enter this path.

## Shape

### The setup draft is an owned, versioned record

The existing setup key stores a bounded envelope:

```js
{
  schemaVersion: 1,
  draftId: "stable draft id",
  revision: 7,
  ownerId: "browser-session writer id",
  state: normalizedProgramEntryState,
}
```

The UI receives an opaque session capability. The session exposes these operations:

```js
session.read()                         // latest validated draft
session.transition(pureTransition)    // compare and save revision + 1
session.replaceCandidate(candidate)   // validate and save a closed result
session.editCandidate(edit)           // edit only candidate data
session.discard()                      // compare and delete this revision
session.prepareActivation()           // validate candidate and capture receipt
session.finalize(cleanupReceipt)       // compare and delete after commit
```

Every mutation runs under the existing state-write Web Lock. It reloads the setup key and compares the draft ID, owner ID, revision, and observed bytes before a write or delete. A mismatch returns `setup_draft_changed`. The store never restores earlier bytes. If the lock or storage fails, saving fails closed and the UI reports that the draft was not saved.

An old bare setup draft can migrate once into the envelope. Unsupported or malformed records fail closed. The owner ID identifies the writer of a revision; it does not create a lease, timeout, or takeover policy.

### Results form a closed route-specific union

`result: object | null` becomes a discriminated candidate union:

```js
GeneratedCandidate  // Recommend or Custom
CatalogueCandidate  // Browse
ManualCandidate     // Build
ImportedCandidate   // reviewed program-only import
SharedCandidate     // validated released setup handoff
```

Every candidate carries:

- its route and source;
- a human program identity;
- a deterministic fingerprint bound to normalized answers and version pins;
- a complete preview;
- candidate-owned program, structure, relations, modifiers, and incompatibilities;
- route-specific diagnostics and activation issues.

The parser rejects unknown fields, route mismatches, stale bindings, incomplete executable programs, unsupported progression, and missing Import or shared handoffs. Empty Build days remain valid draft data but fail activation readiness until every day contains an executable exercise.

The pure state machine owns candidate parsing and readiness. The production adapter converts compiler, catalogue, Import, and shared values into candidates. It does not parse files, fragments, cookies, or full backups.

### One transaction activates every candidate

`activateEntryCandidate` prepares one receipt:

```js
{
  setupDraftId,
  setupDraftRevision,
  setupDraftOwnerId,
  expectedActiveRevision,
  expectedProgramId,
  expectedProgramFingerprint,
  candidate,
  destination,
}
```

Inside the existing durable state-write lock, the transaction reloads the localStorage and IndexedDB head. It compares the exact `_storageRevision`, active program ID, and active program fingerprint from the receipt. A mismatch returns an activation conflict without changing active state or the setup draft.

On a match, one proposal:

1. Archives the outgoing program exactly once when an active program exists.
2. Preserves workout history.
3. Materializes the validated candidate.
4. Stores the candidate name, entry route, source, version pins, and deterministic fingerprint.
5. Uses only candidate-owned progression relations, modifiers, and incompatibilities.
6. Applies the existing active-workout draft effect.
7. Commits through the current pending journal and dual-mirror write.

First-program activation does not create an archive. The block-review path uses the same archive-capable transaction and retains its archive-once identifier. Full-backup restore keeps its separate full-state transaction.

The setup draft remains in storage until the active-state commit succeeds. The activation journal carries a cleanup receipt with the setup key, draft ID, owner ID, and revision. Success or boot replay deletes only that exact revision. A newer draft survives. Failure leaves the current draft resumable and never restores stale bytes.

### The runtime consumes the stored week prescription

The compiler remains the sole owner of the approved interrupted and returning schedules. `about_half` maps to `interrupted` with re-entry enabled.

A pure projection applies `programStructure.weekPrescriptions[week - 1]` to a copy of the authored program by stable slot ID:

```js
ProgramCompiler.projectProgramForWeek(program, programStructure, weekNumber)
```

Workout execution, Today counts, and other scheduled-work views use that projection for the current mesocycle week. Program editing and durable state keep the normal authored program plus all six stored prescriptions. This makes week one reduced and restores normal work in week two for interrupted treatment without mutating the program, strategy, RIR target, family, or weekly structure.

### Module ownership

| Module | Ownership |
|---|---|
| `program-entry.js` | Draft and candidate schemas, route transitions, validation, readiness |
| `program-entry-adapter.js` | Compiler, catalogue, Build, Import, and shared candidate conversion |
| `program-compiler.js` | Existing authored schedules and pure current-week projection |
| `app.js` setup-draft session | Lock-backed setup CAS and user-visible storage errors |
| `app.js` activation coordinator | Candidate proposal, exact durable preconditions, archive, commit, cleanup receipt |
| Existing Import/shared/full-backup code | Parsing, mapping, compatibility, consent, and full-state restore boundaries |

The UI crosses one draft-session boundary for edits and one activation boundary for replacement. It does not coordinate raw keys, archives, journals, or compensation.

## Synthesis decision

Candidate C is the base. It scored 29/30 in cross-judging and kept the smallest credible surface for this static PWA. Candidate D scored 27/30 and supplied the stronger session-capability vocabulary, explicit cleanup receipt, bare-draft migration rule, and candidate-scoped editor sink.

The synthesis rejects Candidate D's lockless read/write/readback fallback because it is not a cross-tab compare-and-swap guarantee. It also rejects owner leases and takeover timing because Plan 048 does not authorize that policy. The first two requested runners failed because their model quota was exhausted; Candidates C and D completed the required distinct designs.

The synthesis modifies both candidates' week-one proposal. Activating a permanently reduced program would fail to restore normal prescriptions in the next week. The selected design projects the stored prescription at runtime by the current block week instead.

## Tradeoffs

- We accept a versioned setup envelope in exchange for meaningful ownership and compare-and-swap behavior.
- We accept retaining a consumed draft until cleanup settles in exchange for crash recovery that cannot delete a newer draft.
- We accept a closed union that requires an explicit adapter for a future route in exchange for rejecting incomplete and mismatched results.
- We accept a candidate-scoped Build editor in exchange for keeping the active program byte-identical before activation.
- We accept one current-week projection call in scheduled-work readers in exchange for preserving the compiler's six-week schedule without a second formula.

## Rejected alternatives

- Direct localStorage writes plus restore-on-failure cannot prevent stale overwrite.
- A temporary active program makes draft editing destructive by construction.
- Separate Import, shared, Build, and generated activation helpers repeat archival and concurrency policy.
- An append-only setup event log adds a second replay protocol without a requirement for that complexity.
- One-time week-one set materialization cannot express the required return to normal work.

## First implementation slice

Add named failing tests for interrupted mapping and current-week projection. Then correct the flag and add the pure projection without changing a progression formula, family constant, or authored schedule.
