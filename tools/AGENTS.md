# Verification-tool changes

Follow root `AGENTS.md`. For test/CI tooling work:

- `tools/run-tests.mjs` is the single local/CI runner and `test/suites.mjs` is the executable inventory. Do not duplicate command lists in workflows.
- Prove runner/selection changes with `node --test test/ci.mjs` and `node tools/run-tests.mjs --check` before broad application suites.
- Default terminal output must remain bounded and useful to coding agents. Preserve complete retained logs, but do not stream successful child output unless `--verbose` is explicitly requested.
- `edit` optimizes latency, `packet` coherent impact coverage, and `branch`/`candidate` remain conservative. `affected` is a compatibility alias for branch. Narrow selection requires a direct suite, static dependency, explicit dynamic-owner mapping, or reviewed domain mapping; unknown executable inputs expand to all tests. A support fixture must select its real scheduled consumers rather than widen merely because the fixture itself is not executable. A directly edited candidate-tier suite remains selectable. Local `candidate` is diagnostic; normal handoff dispatches the remote exact-SHA candidate once.
- Visual selection is separate from test selection. Generic tests and runner tooling cannot change rendered catalog pixels and must not trigger a six-minute recapture; `test/browser.mjs`, shared setup capture fixtures, capture tooling and application/render inputs remain capture-affecting.
- Selector changes require `node --test test/ci.mjs` and representative before/after measurements. Keep output bounded. New modes compose the one inventory/preview owners rather than adding a second runner. Visual selection is independently conservative; unannotated shared changes widen to full capture.
