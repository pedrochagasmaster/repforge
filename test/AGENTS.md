# Test execution for coding agents

Follow the root `AGENTS.md`; this file only narrows test-development behavior.

- During implementation, start with `node tools/run-tests.mjs affected --base origin/main`. It includes committed branch changes plus staged, unstaged and untracked work. Selection is deliberately conservative; an unmapped executable path expands to the full inventory rather than guessing.
- Output is terse by default. Full stdout/stderr is retained under `.ci-results/`. Use `--verbose` only when the failure excerpt and retained artifacts are insufficient; do not spend context tokens streaming passing assertions.
- After a failure, rerun the exact suite (`node tools/run-tests.mjs <lane> --suite <stem>`), not the whole lane after every edit. A diagnostic replay never changes the original result to green.
- Run a broader affected lane after integrating a coherent packet. Run `all` only when the governing plan/acceptance contract requires a full local regression; otherwise let the required GitHub checks provide the final clean-candidate regression.
- Browser dependencies are a one-time checkout setup. `affected` starts a temporary localhost preview automatically when it selects browser suites and no server is reachable; it never kills or replaces an existing server.
- Never use arbitrary sleeps or repeated reruns to manufacture a pass. Reproduce a flaky contract with the smallest exact suite/seed/path, inspect its retained log/trace, then fix the state model or oracle.
