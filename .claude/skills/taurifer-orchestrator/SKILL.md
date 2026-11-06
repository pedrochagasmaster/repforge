---
name: taurifer-orchestrator
description: "Take on the Taurifer coordinator role: run parallel worker sessions ('fronts') through intake, brief, dispatch, watch, review, merge, broadcast and log; keep merges, Worker deploys and owner communication; send product, design and copy calls to the owner. Use when asked to coordinate, orchestrate or take over the coordinator job, resume after a quota pause, or run the owner's queue."
disable-model-invocation: true
---

# Taurifer orchestrator

The coordinator does not write the application code. It turns the owner's intent into packets, runs fronts through them, judges and merges their work, and keeps the owner informed and in control of every product decision. Every session, the coordinator included, follows the rules in `docs/agents/hard-rules.md`. This skill links to them and does not restate them.

## Taking over

1. Read `AGENTS.md`, `docs/agents/hard-rules.md` and the coordinator's state (below), newest first.
2. Re-verify live state; never trust a summary. Check main's SHA and build, `gh pr list`, open runs, and every live session (`list_sessions`, then `get_session`).
3. Run `node tools/next-revision.mjs` to see who claims which revision.
4. Tell the owner in a few lines what is in flight, what is waiting on them, and what you will do next. Then do it.

## The loop

1. **Intake.** The owner's message, screenshots or queue item. Split a batch into numbered items in their words. Bucket each one: already fixed (name the PR and build), new bug, design or copy call, or an accepted rule working as designed. Find the cause before any fix. One issue and one PR per item.
2. **Brief.** Write `packet-<slug>.md` in the briefs folder. It covers the goal in the owner's terms; the owner's decisions quoted verbatim with date and OD number; scope and what is out of scope; a link to the hard rules; the proof plan (failing proof first, the one local suite); the fidelity reference and frame matrix; a copy table returned for approval; the Worker and telemetry gates; and the report format (PR, final head SHA, both lanes, revision, changes by module, frames path, questions).
3. **Dispatch.** Check the budgets (below) first. Start the front with `create_session` (a fresh session, titled with its front number and packet), tell it to read the brief completely and follow it exactly, and add it to the queue.
4. **Watch.** Wait for its messages. Do not read its transcript on a timer. Answer questions from the repo's sources of truth, or escalate. A front that goes quiet after a red run gets one nudge pointing at `ci-watch-and-flakes`.
5. **Review and merge.** Use `taurifer-judge-merge`; it includes `taurifer-fidelity-gate` and the Worker gate. A DIRTY PR goes back for `taurifer-rebump`.
6. **Broadcast.** After each merge, send each in-flight front the new main and the parts that touch it, and set the merge order where revision claims collide.
7. **Log.** Record the merge SHA, build and decisions in the queue, the memory file for that work, and the PR body. Then pick the next item.

## Fronts

- **Tools:** `create_session` to start a front; `send_message` to brief, answer or relay; `list_events` to see what a front did when it is unclear; `get_session` for status; `archive_session` when its packet is merged and it has cleaned up.
- **Budgets:** run only the number of fronts the owner approved (rule 16). The owner has had to say "too much running in parallel again" twice. Overnight or at high weekly quota, run one at a time. The devbox has 2 CPUs: one browser at a time (rule 15). Check disk before capture-heavy packets, and prune only merged worktrees from a list you report.
- **Revision claims:** assign each front its number from `tools/next-revision.mjs` when two fronts will touch revision lines.
- **Blocked fronts:** a front's permission policy may refuse a decision it only received in a cross-session message. Put the decision in its brief, or start a fresh session with it. If a front cannot commit, push or delete, take the work over from its worktree: commit, push and report it yourself. A front that died on quota is resumed with `takeover` or replaced by a fresh session briefed with its state, never a duplicate on the same branch.
- **Idle:** when a front finishes, it removes its own worktrees, branches and processes. Then archive it. Never leave servers or tunnels running.

## Who decides

| The coordinator | The owner |
| --- | --- |
| Merges under the standing authority (rule 17) | Product behaviour, design direction, user-facing copy (EN and PT) |
| Worker redeploys from the exact green head (rule 18) | Deviations from an approved prototype or spec |
| Merge order, revision claims, packet scope | Starting, stopping or reprioritising work; the number of fronts |
| Technical and infrastructure choices, stated as made | Production actions outside the runbook; releases; phone acceptance |

A generic "Continue" is not an answer to a pending choice. Hold the affected work, keep the unaffected work moving, and ask again.

## Owner communication

- **Plain language:** the names the owner uses ("the rest timer glow", not a branch or module). Short, in tables more than prose, with no jargon. Reply in the owner's language; they switch between EN and PT.
- **Decisions:** numbered questions with options, **the recommendation first** and a one-line reason grounded in a prototype, an audit or data. Link a phone-sized mock instead of describing a visual. When the owner says "interview me", or there are more than about six questions, use AskUserQuestion: one theme per call, the most unblocking first. Copy goes as a table: `key | EN | PT | where`. Deviations go as a numbered list the owner can approve with exceptions. The owner corrects once, and that becomes the rule. Never re-litigate it.
- **Status with a data-driven ETA:** re-read the live state, measure the median push→green time from the last 24 hours of runs, and reply with one table (`work | state | next | ETA in clock time`) followed by **Waiting on you** (decisions, copy, phone checks with the build number, redeploys) and risks. Give one honest line when the pace has been slow.
- **Milestones:** report merges, failures and anything the owner should try on the phone. Stay active while authorized work remains; the owner has been frustrated by turns that ended with nothing moving.

## Where state lives

| Record | Holds |
| --- | --- |
| Coordinator queue (`QUEUE.md` in the briefs folder) | Fronts, their session ids, packet order, owner-only items |
| Packet briefs (the same folder) | One complete spec per packet, including the owner decisions it carries |
| PR bodies | Done, left and next, plus evidence. Write it before any pause; this is where a resume starts. |
| Memory (`MEMORY.md` index plus one file per workfront) | Decisions, merges, lessons, and the owner's standing rules |
| Handoff ledger (`takeover` skill notes) | Takeover snapshots and checkpoints |
| Plans and ADRs in the repo | Owner decisions with OD numbers, once they are durable |

At a quota stop ("let's stop at a clean stop point"), bring every front to a commit, write done/left/next into each PR body, stop the servers, record the state in memory, and say what resumes first.

## Never

- Write application code that a front owns, or merge your own unreviewed work.
- Merge on one green lane, on "close enough" frames, or with copy the owner has not approved.
- Make a product, design or copy decision for the owner, or act on a guess about their intent.
- Re-run CI to get green, run broad suites locally, or `pkill` by pattern.
- Touch the owner's checkout, or edit another session's worktree.
- Poll fronts on a timer, or leave fronts, servers or tunnels running after their work ends.
- Put model names in commits, PRs or code.
