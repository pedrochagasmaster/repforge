# Execution lessons from Plans 050 and 051

This document records evidence for revising Plans 052–059, not new product
direction. The main problem was late proof of cross-cutting contracts combined
with quota interruptions and excessive coordinator handoffs. The available
evidence does not justify assigning percentages of delay or ranking model ability.

The reconstruction starts from main `c3491c5e1eb6a10975c27ceacf3259e8afd3dd74`.
Plan 050 merged in PR #227. Plan 051 merged in PR #226. Plan 052 already has
published work in PR #228 at `d1a84ea098bdba6a16f99a0a80e39e9fcae780f1`.
Its revised starting prompt must resume that branch and preserve its history.

## Sources and limits

| Source | Scope inspected |
|---|---|
| Codex thread `01a0713f-9696-7643-880a-4fd55a3417a9` | Plan 050, September 5, 11:06–17:37 UTC; kickoff, correction narrative, tool evidence |
| Codex thread `01a0714e-6620-7a12-8274-5b7f059a9740` | Plan 051, September 5–7; also Plan 050 final review on September 6, 00:03–00:40 UTC |
| T3 `f85a0d21-f75b-47d2-8696-919666a96bb0` | September 7, external Gemini CI diagnosis and verification |
| T3 `1b786a1b-489d-4b89-82c1-83999ad4fb9c` | September 7, final main integration and evidence corrections |
| T3 `97047f68-056d-4f75-8bd3-8ae57cd9423a` | September 7, authorized merge and closeout |
| [PR #227](https://github.com/pedrochagasmaster/repforge/pull/227) and [PR #226](https://github.com/pedrochagasmaster/repforge/pull/226) | Published commit sequences, final handoff and CI evidence, checked against Git |

Local Codex rollouts are under `.codex/sessions/2026/09/05/`; T3 history was read
from its SQLite projection in read-only mode. Account-directory copies did not
provide separate continuation narratives. Native-worker internal reasoning was
not available in readable form. The two external investigators read the relevant
narratives; the coordinator checked claimed fixes against source and Git diffs.
Raw conversations and credentials are not committed here.

The Plan 051 investigator initially called the Plan 050 thread a preflight
session. Its actual kickoff and the Plan 050 investigation establish otherwise.
This correction illustrates why worker summaries require source checks.

## Observed failures and resulting changes

| Observed mechanism | Concrete evidence | Change in remaining plans |
|---|---|---|
| Detector tests did not initially cover the actual rendered boundary | Plan 050 `d23f8321` needed `26f8d7d5` and `3bb04506` for intersecting filter rails; `c483d27a` added dynamic missing-key detection | Prove a real frame and deliberate violations before expanding a detector; reuse the shipped detector |
| Extra copy and clipping channels surfaced at final review | `7bd75234` covers object-shaped text, control values/placeholders, and vertical clipping | Test the existing fault catalogue up front, including intentional scroller exclusions; do not repeat its implementation in every UI plan |
| Matrix expansion dropped existing coverage | `8bf031cc` restored compact and reduced-motion axes; `a42c7821` then repaired cache atomicity | Compare old/new variant membership, retain required axes, and commit cached code/query revisions with the owning UI slice |
| Capture/process duplication wasted resources | Plan 050 September 5, 15:20 narrative identifies a stale duplicate capture and one remaining capture | One capture writer, known server root/port/PID, separate artifacts, and no duplicate full runs |
| Flat-draft and synchronous assumptions migrated reactively | Plan 051 September 7, 16:02 coordinator audit identifies repeated simulation discoveries; `89345e6a` changes simulation helpers and draft tests together | Inventory affected test helpers and consumers before changing state; prove storage and UI completion barriers explicitly |
| Important existing intent and precision behavior was proved late | `89345e6a` adds `contextTouched`, canonical unit precision, and queue/refresh completion cases | Carry preserved invariants into initial fixtures, including cleared values and exact numeric state, not only happy-path logging |
| A generic pending lock did not identify the intended race | `06988ac8` replaces that wait with the queued set-reduction journal and drains boot work | Fault fixtures wait on the exact operation before injecting the competing write |
| Active tab did not mean destination content existed | `5979fb5f` waits for the target exercise card before the existing attention-routing assertions | Separate navigation, rendering, and durable completion assertions; no arbitrary sleeps |
| Quota stalls were amplified by orchestration churn | Plan 050 limit errors and Plan 051 September 7 audit describe initialization stalls, repeated status interruptions, and small follow-up assignments | External workers, one bounded contract per turn, uninterrupted execution within that contract, script-based monitoring |
| Worker reports were not reliable evidence | Plan 051 external closeout brief corrects an invented SHA suffix, a claimed test count, and an omitted CI retry | Read actual Git/CI state; preserve failing run history; independently judge assertions and exact SHAs |

The strategic improvement was not merely using another model. The later Plan
051 assignments named the precise failure, immutable production baseline,
allowed test changes, negative proof, process ownership, and stopping boundary.
That reduced the engineering decisions left to the worker.

## What changes now

The [Herdr procedure](herdr-ui-overhaul-execution.md) and each revised plan put
proof before expansion. The coordinator prepares one bounded packet, then lets
the worker execute it without status-only interruptions. A packet can contain
several related assertions; it is not one dispatch per assertion or CSS rule.

Plan 052 proves real proposal/commit/reload/archive integration early. Plan 053
first resolves the actor/fault table and acknowledged clone boundary. Plans
054–057 prepare behavior tests before changing their UI. Plan 058 prepares
rendered contrast failures before broad CSS migration. Plan 059 retains one
candidate and the owner's physical-device/sign-off boundary.

These changes are expected to reduce avoidable rework. They cannot eliminate
provider limits, genuine integration defects, or human review time. No claim of
measured cost savings is made before this procedure is used.

No production implementation is authorized by this documentation task.
