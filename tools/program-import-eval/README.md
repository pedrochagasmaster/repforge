# Program-import LLM benchmark (development tooling)

Runs cheap-model extraction evals against Taurifer's **actual** program-import
parser, without changing the production importer. The long implementation
specification is delivered separately as a Markdown document.

## Current scope

- 20 researched public training-text **format** references, recorded as URL
  plus broad format observation; no original posts or personal details copied.
- Exactly 10 original synthetic programs per reference: 200 cases, 100 PT / 100
  EN, 2,676 gold exercise rows, 60 gap cases, 120 unsupported-concept cases.
- Family-exclusive splits: 120 development, 40 validation, 40 protected holdout.
- Deterministic construction-time gold; no model-assisted gold writing.
- Baseline prompt is read from the exact checked-out i18n catalogues.
- Adapters for Claude Code `-p` and Codex `exec` (`e` alias), **not**
  yet direct API adapters.
- No network or model calls in CI. Browser parser contract validation requires
  Playwright under the repository's `test/node_modules`.

## Commands

```bash
cd /home/ubuntu/repforge-import-eval
node tools/program-import-eval/cli.mjs generate
node tools/program-import-eval/cli.mjs validate
node tools/run-tests.mjs full-fast --suite-id test-program-import-eval-mjs
node tools/program-import-eval/cli.mjs validate-parser

# These commands spend model calls; the explicit --execute flag is required.
node tools/program-import-eval/cli.mjs run \
  --transport claude --model haiku --split development \
  --prompt baseline --limit 10 --execute

node tools/program-import-eval/cli.mjs run \
  --transport codex --model gpt-6-luna --split development \
  --prompt strict-v1 --limit 10 --execute

node tools/program-import-eval/cli.mjs report --run /path/to/run
node tools/program-import-eval/cli.mjs compare --left /path/to/base --right /path/to/candidate
```

Use `--case pt03-05` for an individual case and `--repeat 3` to repeat each
case independently. Runs can resume at an existing `--out` directory only
when prompt and code identities match. Holdout requires `--unlock-holdout`.

Results are stored under `reports/runs/` and are ignored by Git. The runner
stores raw **synthetic** model replies locally. Do not use it on personal
programs until a consent and no-raw-output mode exists.

## Evaluator and benchmarking rules

JSON parsing success is insufficient: `grade.mjs` compares the parse result
against strict source-truth fields, including omissions and `notImported`.
`unsafeComplete` flags wrong prescriptions that the importer would otherwise
accept as a complete candidate. Treat these as blocking findings, not a
negligible change in an average score.

Never use the holdout for routine prompt iteration. Its current protection
flag is a workflow guard, not a permission boundary. Source-family splits
reduce superficial contamination but generated cases share a grammar and do not
represent genuine human-source performance. Before model selection, add
independently reviewed, consented real programs, negative cases, and a direct
API bake-off.

Claude's `haiku` alias can change versions. Pin the actual model snapshot
before comparative conclusions. Codex's wrapper can consume much more context
than a bare API prompt. CLI tokens and subscription accounting are **not**
production per-request API economics. Prices are intentionally not hardcoded.
