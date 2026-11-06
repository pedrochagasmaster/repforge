---
name: ci-watch-and-flakes
description: "Watch your own CI after every push to this repo and act on red at once; treat a test that passed only on the diagnostic replay as a bug to fix in the same PR, proven with a repeat loop. Use right after a git push, when a ci or ci-full job fails, when a run is 'flaky', 'passed on retry' or 'suspected synchronization flake', or before considering any re-run."
---

# CI watch and flakes

This skill is how to apply hard rules 11–13 in `docs/agents/hard-rules.md`. Read them there; they are not repeated here. They exist because flakes and red runs nobody noticed once ate most of a day, at 30–50 minutes per round.

## Watch

Right after each push, start a background watcher on your own run, then keep working:

```bash
R=pedrochagasmaster/repforge
id=$(gh run list -R $R --branch "$(git branch --show-current)" --workflow ci --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$id" -R $R --exit-status >/dev/null 2>&1; echo "$id $(gh run view "$id" -R $R --json conclusion -q .conclusion)"
```

Run it in the background (`run_in_background` or a Monitor) so its exit wakes you. When `ci` passes, `ci-full` starts by itself; watch that run the same way. Do not poll on a timer, and never dispatch `ci-full`.

On red, at once:
1. Read the failing job's log. If it is empty, read the run's artifacts, the evidence JSON and the fixture diffs. `node tools/fetch-ci-captures.mjs <run-id>` brings back frames that rendered differently.
2. Write down the exact suite id, test and state name now. A failure recorded as "37 pass / 1 fail, didn't capture which" later cost a 20× hunt.
3. If you are a front, send the coordinator one line: run link, failing test, first hypothesis.

## Classify

| What happened | What it is |
| --- | --- |
| Fails, and the diff explains it | A real failure. Fix it. |
| Fails, then the diagnostic replay passes | A flake, which is a defect (rule 13). Fix it below. |
| Fails in a state this PR never touches | Still rule 13. If an open PR already fixes the same race, link it instead. |
| Runner lost, cancelled before tests, infrastructure error with no test result | One re-run, with the evidence in the PR. |

## Fix a flake

1. Find the race. In this repo it has usually been one of these: clicking or measuring while a sheet or animation is still moving, a fixed wait (`520 ms`) instead of an end event, polling before `popstate` after `history.go(-1)`, a page still growing when the scroll lands, or a screenshot taken before a painted frame.
2. Fix it by waiting on a real event or a settled state, through the helpers in `test/browser.mjs`. Search the same file for the same pattern and fix those too.
3. Prove it on the single affected suite, under the browser lock:
   ```bash
   for i in $(seq 10); do flock /tmp/taurifer-browser.lock node tools/run-tests.mjs <lane> --suite <stem> || break; done
   ```
   Use 20 runs when the failure rate is low.
4. If the cause is deterministic and the fix is obvious, or the 2-CPU devbox cannot finish the loop in reasonable time, skip the loop and say why. The pushed head's CI is then the evidence.
5. Put the cause, the fix and the loop result in the PR body.
