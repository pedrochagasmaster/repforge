# Plan 053 packet C6 — handoff record

Written 2026-09-10 by the coordinator that took over the quota-terminated Plan 052/053
thread. Everything here existed only on one devbox before this branch; it is committed so
a session with nothing but the remote can continue the packet.

Companion PR comment:
<https://github.com/pedrochagasmaster/repforge/pull/235#issuecomment-5626601396>

## What this branch is

`handoff/053-c6-takeover` is a **preservation branch, not a candidate.** It does not
target a merge and nothing on it has passed review. It exists because the packet's real
state lived in uncommitted working trees and untracked files that no clone could see.

It deliberately does **not** touch `ui-overhaul/053-ios-install-transfer`, so PR #235's
head stays at `73d1e6164e7b9ca3715c21e04492614d02a2abb5` and still reflects the last
reviewed and accepted integration.

## The commits, oldest first

| Commit | What it is |
| --- | --- |
| `14d33d05` | `feat(storage): import install transfers atomically` — packet C2. Review **rejected** both axes. |
| `40c9d3e9` | `fix(install): scope inbound cleanup deferral to initial claim` — packet C3. **Correction required.** Adds the deferral that later matters. |
| `2ce4c7da` | `Fix install-transfer recovery and claim binding` — packet C5. Pinned review; its R7 axis **correction required**. |
| `a1dd6060` | The accepted 114-assertion import oracle, until now untracked. |
| `76c417ae` | The C6 slice exactly as inherited. 113/1 — `P4c-A` fails. |
| `37403cd0` | Candidate restoring the deferral. 113/1 — `P4c-M` fails instead. |

The three inherited commits were local-only on this devbox and had never been pushed
anywhere. They are preserved here as ancestry; **none of them is accepted work.**

## Where the packet actually stands

The recorded C6 red set does not reproduce. Four independent runs of the oracle against
the same unmodified code — coordinator twice on a private port, plus two separate workers
on separate ports — all return **113 passed, 1 failed of 114**. The large red set in the
predecessor's log (the `test-claim-setup-failed` cascade, `marker records the interrupted
import phase → null` at all seven fault points, P4c-B, P4c-G) was environment-dependent.

One real blocker remains, and it is a contested contract rather than missing code.

`P4c-A` and `P4c-M` drive the **identical** fixture —
`openStandaloneTransferPage(browser, envelope, events)` with `options = {}` — and read the
same `repforge_transfer_inbound_v1`:

| Assertion | Read position | Requirement |
| --- | --- | --- |
| `P4c-A` read 1 (`test/install-transfer-import.mjs:1133`) | boot + ~1 `page.evaluate` round-trip, measured ~7 ms | present, valid phase, sealed credential |
| `P4c-A` read 2 (`:1143`) | boot + `readLogical` + `readIdb` | `null` **or** `cleanup-pending` + `remoteState: deleted` |
| `P4c-M` (`:1787`, read at `:1777`) | boot + `localMarker` + `readIdbValue` | strictly `null` |

The effective contract is: present with credentials at roughly boot + 7 ms, absent by
roughly boot + 20 ms. Commit `76c417ae` clears before the lower bound; `37403cd0` never
clears at all. Every candidate so far fixes one side and breaks the other, which is the
whole rejection history of this packet.

## Recommended order of work

1. **Correct the oracle before writing another candidate.** Two assertions over one
   storage key from one fixture, separated only by browser round-trip latency, is not a
   durable contract; it will flake on a loaded machine whatever the implementation. Have
   `P4c-A` observe `cleanup-pending` through the recorded event stream, which the fixture
   already captures, instead of a post-hoc `localStorage` read racing the cleanup. Oracle
   correction is established practice here — `Q-C1`–`Q-C4` and `RC-C1`–`RC-C3` were all
   oracle corrections accepted after review.
2. **Then implement the deferral as release-after-boot, not suppression.** Write
   `cleanup-pending` so credentials survive a crash between local commit and acknowledged
   remote deletion, and release the deferred clear once the deletion is acknowledged,
   settling after boot resolves rather than awaiting it inside the boot path.
3. **Prove it repeatedly.** A timing-sensitive clear needs a flake budget, not one green.

Do not treat the recorded C6 red set as the work remaining. On current evidence the packet
is one contested assertion from green.

## Running the oracle

The oracle is not registered in `test/suites.mjs` and does not run in CI. It needs the
app served over HTTP and the Playwright browsers installed
(`cd test && npm ci && npx playwright install chromium --with-deps`).

```bash
python3 -m http.server 8071 --bind 127.0.0.1 &
REPFORGE_URL=http://127.0.0.1:8071/ node test/install-transfer-import.mjs
```

Use a port nobody else holds. Concurrent runs sharing a port are the most likely
explanation for the unreproducible red set described above.

## Contents

- `ledger.md` — the full takeover ledger: reconciliation of the predecessor thread,
  every finding, and one process-isolation incident during the session. Copied from
  `.git/agent-handoff/ledger.md`, which lives inside `.git` and therefore reaches no clone.
- `evidence/judge-oracle-run1.log`, `judge-oracle-run2.log` — coordinator runs against
  `76c417ae`. Both 113/1, `P4c-A`, identical position. Determinism check.
- `evidence/judge-oracle-deferral-restored.log` — coordinator run against `37403cd0`.
  113/1, `P4c-M`.
- `evidence/predecessor-c6-oracle.log` — the predecessor's 2026-09-10T19:27 run, kept as
  the artifact whose red set does not reproduce.

## Gates that remain open regardless

Authenticated EU staging, provider disposal and restore, billing/watchdog/log/deletion
evidence, minute-60 and minute-75 purge measurements, and physical iOS 17.2+ handoff.
None of these are touched by anything on this branch. PR #235 stays draft; the transfer
service is not deployed.
