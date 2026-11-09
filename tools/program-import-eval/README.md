# Taurifer program import — local LLM eval harness

Developer tooling to evaluate low-cost model extraction using the **actual**
Taurifer free-form import parser. This is **not** a production inference
integration; the current PWA behavior is unchanged.

Full implementation notes and current contracts:
[docs/evals/program-import-llm.md](../../docs/evals/program-import-llm.md).

## Dataset

- 20 researched public *format* references × 10 original synthetic workouts
  = **200** baseline programs, 100 Portuguese / 100 English, with 2,676
  annotated exercise rows.
- Split by entire reference family: 120 development, 40 validation, 40 sealed
  holdout. No holdout replays for prompt tuning.
- **40 additional scored stress cases**: 24 difficult positives and 16
  no-program messages that must be rejected.
- **8 human-adjudication examples**: truly ambiguous prescriptions without
  fabricated answer keys, excluded from automated scoring.
- Reproducible JSONL generation and a signed-off content hash in
  `fixtures/manifest.json`. Source texts are constructed synthetically,
  never reproduced from public posts.

## Quickstart

```bash
cd /home/ubuntu/repforge-import-eval
node tools/program-import-eval/cli.mjs generate
node tools/program-import-eval/cli.mjs validate
node tools/program-import-eval/cli.mjs validate-parser
node tools/run-tests.mjs full-fast --suite-id test-program-import-eval-mjs
node tools/run-tests.mjs full-fast --suite-id test-program-import-eval-api-mjs

# Inspect exactly which requests will be made; no costs.
node tools/program-import-eval/cli.mjs plan \
  --transport claude --model haiku --split stress \
  --cases ptx-04,enx-06,ptn-03 --max-calls 3

# Both CLIs are already installed on the devbox.
node tools/program-import-eval/cli.mjs run \
  --transport claude --model haiku --split development \
  --indices 05,08,10 --max-calls 36 --execute

node tools/program-import-eval/cli.mjs run \
  --transport codex --model gpt-6-luna --prompt strict-v1 \
  --split stress --cases ptx-04,enx-06,ptn-03 \
  --max-calls 3 --execute

# Direct API mode: requires OPENAI_API_KEY or ANTHROPIC_API_KEY in env.
node tools/program-import-eval/cli.mjs run \
  --transport anthropic-api --model claude-haiku-5-5 \
  --mode schema --prompt strict-v1 --split development \
  --limit 3 --max-calls 3 --execute

node tools/program-import-eval/cli.mjs compare --left RUN_A --right RUN_B
node tools/program-import-eval/cli.mjs regrade --from RUN_OLD --out RUN_NEW
node tools/program-import-eval/cli.mjs report --run RUN_A
```

Only explicit `--execute` spends provider calls. Default request cap is 100,
one process at a time, with bounded time and response size; no fallback models
or retries. The runner fails closed for missing credentials and unapproved
(expensive) models. Claude and Codex CLIs are proxies, not API cost benchmarks.

All raw synthetic replies and reports go to Git-ignored
`tools/program-import-eval/reports/runs/`. Use `--no-raw-replies` to suppress
saving reply text. Never put private training data or credentials in fixture
files. No model calls enter CI.

## Development

The canonical importing logic remains owned by `app.js`; `parser.mjs` starts
the PWA in its existing Playwright infrastructure and calls
`window.__repforgeFreeform.parseReply`. It never substitutes its own import
acceptance parser. `grade.mjs` compares accepted data against authored gold:
prescription integrity is more important than JSON syntax.

Reported positive parse success excludes negative cases. Correct rejection is
scored separately. `unsafeComplete` is a critical finding for wrong-but-
accepted prescriptions or invented programs. Paired comparisons require equal
case IDs, benchmark hashes and repeat indices and cannot promote to
production automatically.

Direct provider HTTP requests are modeled on OpenAI Responses and Anthropic
Messages; both `prompt` and `schema` modes are covered by no-network mocks.
No live direct-API call has been proven without separately supplied keys.
