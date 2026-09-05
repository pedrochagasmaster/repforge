# Prove contracts before expanding implementation

Use this protocol when implementing or reviewing a UI-overhaul plan, changing a
durable schema, or introducing a checker used as completion evidence. It adds
verification discipline to the existing branch, commit, PR, and owner gates.
Product direction remains in `docs/ui-audit.md`. It creates no new product or
owner-approval gate.

## Start with an acceptance contract

Before substantive implementation, add the following section to the plan's
existing draft PR. Link it from the PR's verification and handoff sections.
Use the [phase checkpoints](ui-overhaul-proof-checkpoints.md) to select the
first risky slice. Revalidate every referenced module against the base SHA.

```markdown
## Acceptance contract
- Plan and governing requirement:
- Base SHA and current head SHA:
- Contract owner and authoritative representation:
- Consumers and generated examples:
- First complete slice:

| ID | Required observable result | Real producer/consumer | Command and assertion location | Deliberate failing case | Evidence or pending reason |
|---|---|---|---|---|---|

### Gate boundaries
- Required for this PR:
- Required later, with owning plan:
- Owner decisions still held, with decision reference:

### Review findings
| ID | Requirement or concrete failure | Reproduction | Blocking reason | Status and closing evidence |
|---|---|---|---|---|
```

Map every acceptance criterion to evidence or an explicit pending gate. Keep
individual rows small. A command must name the assertion that proves the row;
"CI green" and test counts cannot substitute for that mapping. A test that
does not exist yet is **planned**, with an owning slice, never **passed**.

The implementer and reviewer use this same contract. Reviewer agreement on its
engineering interpretation is a normal review step, not owner product approval.
Resolve missing technical details with existing code and requirements. Escalate
only a new product decision, architecture exception, or explicitly held owner gate.

## Prove one complete slice first

1. Trace the actual producer, representation, consumer, and observable result.
2. Implement the smallest slice that crosses that complete path.
3. Test the approved invariant and a deliberate violation before expanding to
   other surfaces. Use an isolated test fixture for fault injection.
4. Publish the coherent slice and its evidence using the plan's atomic-commit
   protocol. The reviewer examines the assertion and reproduces the risky path.
5. Expand implementation after the first contract works through its real consumer.

Pure tests can verify a model. Persistence claims also require real loader,
storage, reload, and migration behavior. Browser assertions use the existing
test harness; do not scrape `app.js` functions into a substitute normalizer.
Visual claims require rendered geometry and interaction in the specified matrix.
Existing broad suites remain required where the plan calls for them.

## Choose evidence that can falsify the claim

| Contract | Required relationship to test | Example failure that must be detected |
|---|---|---|
| Durable state or clone | Real normalized source through current save/load, with an explicit allowlist of volatile differences | Missing structure strips provenance; reload changes a logical field |
| Identity mapping | Compiler-produced identities; every source and target accounted for once; deterministic pairing, order, and preserved relations | Duplicate target, omitted source, wrong template, incompatible relation |
| Hash or canonical form | Declared preimage, independently checked serialization, lifecycle exclusions, permutation rules, and non-mutation | Semantic change has no effect; mutable input changes; dangerous property accepted |
| Cross-context protocol | Each actor's state and credentials at every network/local-write boundary | Lost response, restart, expiry, duplicate claim, stale source, or unknown outcome silently resumes |
| Generated documentation | One authoritative schema/example, generated copies or parsed equality against it | Fixture changes but an embedded example or enum remains stale |
| New checker | An isolated bad artifact is rejected by the actual checker; repaired artifact passes | Required word exists elsewhere but the governing enum or mapping is wrong |
| UI and accessibility | Production-backed journey, semantic tree, interaction, and measured layout | Read-only preview writes state; scaling clips a control; focus cannot return |

Generated fixtures need independent assertions about meaning. A digest or a
snapshot generated from the same incorrect object is not an independent oracle.
Avoid duplicating normative schemas in prose. Reference the owning contract;
when a copy is necessary, generate it or compare the parsed structures.

## Record what actually ran

Run narrow checks during implementation. After committing a coherent slice,
record its focused proof with `tools/record-verification.mjs` as documented in
[tools](../../tools/README.md#record-verificationmjs). Keep reports outside the
worktree and attach them to CI or the PR. The recorder captures command output,
exit status, and Git state before and after execution. Its successful result
means **command passed on an unchanged clean commit**, not **phase complete**.

- Name the exact assertion and its limitations beside each report.
- Record failing cases too. A failed command must remain distinguishable from
  a test suite that successfully rejected a deliberately invalid fixture.
- Describe screenshots, real-device reviews, and owner decisions separately.
  They require actual evidence; a script cannot attest that a person approved.
- After source changes, rerun affected proof. Older evidence remains historical.
  Reuse unaffected evidence only with an explicit dependency explanation; final
  release evidence still follows Plan 059's same-candidate requirement.
- Fetch the remote PR head and checks directly before issuing a verdict. The
  owner should not have to relay CI state or supply information available in Git.

## Review for convergence

Pin both the review base and head. Review the full affected contract, including
unchanged callers and authoritative docs, before returning the initial findings.
For a mapping defect, inspect identity, uniqueness, coverage, pairing, order,
provenance, and hashing together. For transfer, trace both actors through crash,
retry, claim, commit, expiry, and recovery together.

Every blocker needs a governing requirement or a reproducible correctness,
security, data-loss, or accessibility failure. Explain the consequence and the
smallest closing evidence. Treat naming preferences, speculative edge cases,
and optional refactors as non-blocking unless they cause a demonstrated failure.
The number of reviewers agreeing is a signal, not a substitute for reproduction.

Keep stable finding IDs. On a correction pass, close existing findings, inspect
the changed contract and regressions, and list new findings separately with the
reason they were not visible before. A newly discovered real bug can still block;
the acceptance contract does not grant immunity to defects. New preferences do
not silently expand scope. Corrections to an earlier review must be explicit.

If a second pass repeats a defect in the same contract, stop local wording and
fixture patches. Reconstruct that contract from its producer and consumer, add
the smallest semantic proof, and have the reviewer rerun it before another broad
regression cycle. If the agent still cannot produce that proof, reduce the slice
or hand the bounded contract to a different implementation agent. Do not ask the
owner to debug engineering details or declare completion to end the loop.

## Hand off facts, not conclusions without evidence

Use distinct statuses in the existing PR body:

- **Implemented:** code or specification is present.
- **Focused proof passed:** named assertions ran at the recorded SHA.
- **Regression passed:** specified broader checks passed at their recorded SHA.
- **Ready for owner review:** required evidence is present and engineering
  blockers are closed; any owner gate is named and remains open.
- **Approved:** an actual owner decision is linked.

Before stopping, inspect `git status --short` in every touched worktree, push
completed slices, and update `Next exact steps`. Preserve the existing prohibition
on merge without owner authorization. Avoid repeating the same contract in a new
handoff document: the remote PR, plan, and authoritative specification are the record.
