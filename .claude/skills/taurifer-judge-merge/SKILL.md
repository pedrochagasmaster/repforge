---
name: taurifer-judge-merge
description: "Judge a front's packet report and land the PR: read the real diff, return ACCEPT, REVISE or ESCALATE, apply the merge gates (both CI lanes, CLEAN, scope, revisions, fidelity, copy, Worker redeploy), merge, then broadcast the new main to every in-flight front. Use when a front reports a PR green, or the owner says 'merge #N when it's green' or 'should we merge N? review it'."
disable-model-invocation: true
---

# Taurifer judge and merge

The coordinator merges and fronts never do (hard rule 17 in `docs/agents/hard-rules.md`). Product, design and copy decisions still go to the owner.

## 1. Read the real thing

- Run `gh pr view <n> --json headRefOid,baseRefName,mergeStateStatus,statusCheckRollup,files`.
- Read the diff itself with `git diff origin/main...origin/<branch>`, not the packet report.
- Compare it with the packet brief. Extra work gets a REVISE, or a filed issue (rule 10). It never rides along.

## 2. Gates

Every gate must pass:

| Gate | Check |
| --- | --- |
| Both lanes | `ci` **and** `ci-full` green on the **final head**. A green PR lane alone has broken main before. |
| Mergeable | `mergeStateStatus` CLEAN, and `baseRefName` is `main` or the intended stack base. A DIRTY PR goes back for `taurifer-rebump`. |
| Revisions | `node tools/next-revision.mjs --pr <n>` reports no collision for this PR, and its claim is above main. |
| Fidelity | For any visible change, run `taurifer-fidelity-gate` and look at the frames yourself. |
| Copy | Every new or changed EN/PT string is exactly what the owner approved. |
| Flakes | Any replay-pass in the run history was fixed under `ci-watch-and-flakes`, not re-run away. |
| Worker | If the diff touches a validator, the draft or profile shape, or `services/install-transfer/`, follow section 4 first. |

## 3. Verdict

- **ACCEPT:** merge with `gh pr merge <n> --merge --match-head-commit <sha>`, marking a draft ready first. Merge one PR at a time. Then do section 5.
- **REVISE:** send a numbered list. Each item gives `file:line`, what is wrong and the expected behaviour.
- **ESCALATE:** the PR needs the owner. Tell the front exactly what to hold, then ask the owner (see `taurifer-orchestrator`, "Owner communication").

## 4. Worker redeploy (hard rule 18)

1. The front sends its final head SHA and does not move it again.
2. In the production checkout, check out that exact SHA and follow `services/install-transfer/RUNBOOK.md`. Do not rebuild the commands from old transcripts.
3. Deploy one Worker at a time, on odd minutes. A deploy during the cron pass once raised the incident generation.
4. Check the preflight probes and a fresh health status, and record the deployed version ids in the PR.
5. Then merge.

## 5. After the merge

1. Send each in-flight front one message: the new main SHA, the new `CACHE`/`?v=`, what changed in **its** area, and whether it must rebase now or at its next push.
2. When two PRs claim overlapping revision lines, set the merge order explicitly ("hold everything else until #499 lands").
3. Close the fixed issues and update the coordinator's queue and memory with the merge SHA and build number.
4. Tell the owner in one plain line what changed for them and which build to check on the phone.
5. When the front's packet is done, the front removes its own worktrees, branches and processes (rule 14), and then you archive the session.
