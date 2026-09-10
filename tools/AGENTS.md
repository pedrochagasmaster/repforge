# Verification-tool changes

Follow root `AGENTS.md`. For test/CI tooling work:

- `tools/run-tests.mjs` is the single local/CI runner and `test/suites.mjs` is the executable inventory. Do not duplicate command lists in workflows.
- Prove runner/selection changes with `node --test test/ci.mjs` and `node tools/run-tests.mjs --check` before broad application suites.
- Default terminal output must remain bounded and useful to coding agents. Preserve complete retained logs, but do not stream successful child output unless `--verbose` is explicitly requested.
- `affected` selection may be narrow only when a direct suite, static dependency, or reviewed domain mapping proves the consumer. Unknown executable inputs must expand to all tests.
- Visual selection is separate from test selection. Generic tests and runner tooling cannot change rendered catalog pixels and must not trigger a six-minute recapture; `test/browser.mjs`, shared setup capture fixtures, capture tooling and application/render inputs remain capture-affecting.
- Performance changes need measured evidence. Do not claim lower wall time or runner-minutes from architecture alone.
