# Test execution for coding agents

Follow the root `AGENTS.md`; this file only narrows test-development behavior.

- Start with the exact owning contract if known; otherwise run `node tools/run-tests.mjs edit`. It selects the dirty worktree or, when clean, the last commit. Unknown executable inputs widen safely. A focused/edit pass is correction feedback, not completion evidence.
- Output is terse by default. Full stdout/stderr is retained under `.ci-results/`. Use `--verbose` only when the failure excerpt and retained artifacts are insufficient; do not spend context tokens streaming passing assertions.
- After a failure, rerun the exact suite using the printed `--suite-id` command. A diagnostic replay never changes the original result to green.
- Follow RED focused proof → fix → same focused proof → coherent commit → `packet --base <packet-start-sha>`. History behavior uses its owning browser contract; persistence changes also need strict storage/race proofs; fixtures select their static dependents; shared shell/cache changes widen. At the stable clean SHA, dispatch candidate verification and inspect its exact-SHA result. `branch` is diagnostic scope, not the default correction loop.
- Browser dependencies are a one-time checkout setup. The runner and capture tool start an isolated current-worktree preview on a fresh loopback port when `REPFORGE_URL` is unset. Explicit local URLs require worktree identity. Leave it unset for normal evidence; do not add private fixed-port servers.
- A fresh-device fixture must isolate all storage that affects boot, including device UI preferences. Prefer a new browser context. If resetting a loaded page, await `waitForAppBoot` before clearing storage, then reload and await boot again; `DOMContentLoaded` does not mean initialization has finished writing. Deleting workout history is not a fresh-device reset.
- Never use arbitrary sleeps or repeated reruns to manufacture a pass. Reproduce a flaky contract with the smallest exact suite/seed/path, inspect its retained log/trace, then fix the state model or oracle.
