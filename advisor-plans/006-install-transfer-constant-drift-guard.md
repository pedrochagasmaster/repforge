# Plan 006: A test fails if the install-transfer client and the shared contract disagree on endpoints or the claim-response limit

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- install-transfer.js install-transfer-contract.js test/install-transfer-client-contract.mjs`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (test-only)
- **Depends on**: none
- **Category**: tech-debt (drift guard)
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

The iOS install transfer is the app's only server round-trip (ADR 0013). `install-transfer-contract.js` is the shared protocol truth; the server in `services/install-transfer/` consumes it. The browser client `install-transfer.js`, however, redeclares its own endpoint paths and size limits instead of reading them from the contract. They agree today. If someone later changes a path or limit in the contract, the client keeps the old value, and transfers fail at runtime with confusing "unavailable" outcomes rather than a test failure.

A refactor to share the constants is awkward. The client receives the contract by injection (a `contract` argument on each call), and it is loaded both as a browser global and under Node `require`. A small equality test gives the same protection at almost no risk.

## Current state

`install-transfer-contract.js:4-10` exports (`api.ENDPOINTS`, `api.LIMITS`):

```js
  const ENDPOINTS = Object.freeze({
    create: "/v1/transfers",
    claims: "/v1/transfers/claims",
    commit: "/v1/transfers/claims/commit",
    status: "/v1/transfers/status",
    envelope: "/envelope",
  });
  const LIMITS = deepFreeze({ /* … */ envelopeBytes: 2_000_000,
    claimResponseBytes: 2_004_096, /* … */ identifierChars: 256, stringChars: 8_000, /* … */ });
```

`install-transfer.js:15-45` (module factory; exports `ENDPOINTS` and `RESPONSE_LIMITS` at `:1026-1033`):

```js
  const ENDPOINTS = Object.freeze({
    create: "/v1/transfers",
    claim: "/v1/transfers/claims",          // note: key "claim", contract uses "claims"
    commit: "/v1/transfers/claims/commit",
    status: "/v1/transfers/status",
  });
  const IDENTIFIER_MAX_CHARS = 256;
  const CREDENTIAL_MAX_CHARS = 8_000;
  const SMALL_RESPONSE_MAX_BYTES = 4_096;
  const ENVELOPE_MAX_BYTES = 2_000_000;
  const CLAIM_RESPONSE_MAX_BYTES = ENVELOPE_MAX_BYTES + SMALL_RESPONSE_MAX_BYTES;
  const RESPONSE_LIMITS = Object.freeze({
    [ENDPOINTS.create]: SMALL_RESPONSE_MAX_BYTES,
    [ENDPOINTS.claim]: CLAIM_RESPONSE_MAX_BYTES,
    [ENDPOINTS.commit]: SMALL_RESPONSE_MAX_BYTES,
    [ENDPOINTS.status]: SMALL_RESPONSE_MAX_BYTES,
  });
```

Both modules support Node: `require(join(ROOT, "install-transfer-contract.js"))` returns the contract `api`, and `require(join(ROOT, "install-transfer.js"))` returns the client `api` (see `test/install-transfer-limits.mjs:20-23` for the pattern).

`IDENTIFIER_MAX_CHARS` and `CREDENTIAL_MAX_CHARS` are not exported. This plan guards them with a source-text assertion instead of widening the client API.

Existing target test: `test/install-transfer-client-contract.mjs` (fast lane, pure Node, `node:assert/strict`). Add the new block there.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Target test | `node test/install-transfer-client-contract.mjs` | exit 0 |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |

## Scope

**In scope:** `test/install-transfer-client-contract.mjs`.

**Out of scope:** `install-transfer.js`, `install-transfer-contract.js`, and `services/install-transfer/**`. Renaming the client's `claim` key is unnecessary churn, since the URL is what matters. There is also no cache ritual, because no precached file changes.

## Git workflow

- Branch: `advisor/006-transfer-constant-guard`
- Commit: `test(transfer): guard client constants against contract drift`
- Do not push.

## Steps

### Step 1: Read the test's header

Open `test/install-transfer-client-contract.mjs` and find how it obtains the contract and client (`require` or `import`) and its assertion style. Reuse those handles; do not load the modules a second way.

**Verify**: you can name the two variables holding the contract and client APIs.

### Step 2: Add the drift guard

Append one block that asserts:

```js
// Client transport constants must match the shared contract the server consumes.
assert.equal(client.ENDPOINTS.create, contract.ENDPOINTS.create);
assert.equal(client.ENDPOINTS.claim, contract.ENDPOINTS.claims);
assert.equal(client.ENDPOINTS.commit, contract.ENDPOINTS.commit);
assert.equal(client.ENDPOINTS.status, contract.ENDPOINTS.status);
assert.equal(client.RESPONSE_LIMITS[contract.ENDPOINTS.claims], contract.LIMITS.claimResponseBytes);
const clientSource = readFileSync(join(ROOT, "install-transfer.js"), "utf8");
assert.match(clientSource, new RegExp(`IDENTIFIER_MAX_CHARS = ${contract.LIMITS.identifierChars};`));
assert.match(clientSource, new RegExp(`ENVELOPE_MAX_BYTES = ${contract.LIMITS.envelopeBytes.toLocaleString("en-US").replaceAll(",", "_")};`));
```

Adapt the variable names to Step 1, and add `readFileSync`/`join`/`ROOT` imports if the file lacks them. Print one line in the file's existing log style.

**Verify**: `node test/install-transfer-client-contract.mjs` → exit 0.

### Step 3: Prove the guard bites (do not commit this)

Temporarily change `claim: "/v1/transfers/claims"` in `install-transfer.js` to `"/v1/transfers/claim"` and re-run the test. Then revert with `git checkout -- install-transfer.js`, running `git status` first to confirm that only your temporary edit is there.

**Verify**: with the temporary edit, the test exits non-zero on the `claims` assertion. After reverting, `git diff --stat install-transfer.js` is empty.

### Step 4

**Verify**: `node tools/run-tests.mjs fast` → exit 0.

## Test plan

The new assertions live in `test/install-transfer-client-contract.mjs`. Step 3 is the negative control.

## Done criteria

- [ ] `grep -c "contract.LIMITS.claimResponseBytes" test/install-transfer-client-contract.mjs` → at least `1`
- [ ] `node tools/run-tests.mjs fast` exits 0
- [ ] `git diff --stat` shows only the test file
- [ ] The `advisor-plans/README.md` row is updated

## STOP conditions

- The client's exported `ENDPOINTS`/`RESPONSE_LIMITS` no longer exist or have been renamed.
- Any assertion fails on the unmodified code. That is a real client/contract mismatch: report it, and do not "fix" either module in this plan.

## Maintenance notes

- If the client is later refactored to read `contract.LIMITS` directly, delete the source-text assertions and keep the exported-value ones.
