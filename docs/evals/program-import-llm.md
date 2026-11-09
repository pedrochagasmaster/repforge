# Program-import LLM evaluation — implementation and runbook

**Status:** Development tooling implemented in draft PR #707. Production managed
inference is **not** shipped. The PWA's existing copy/paste handoff and importer
remain the source of truth.

**Owner documents:** [ADR 0014](../adr/0014-free-form-program-import-handoff.md),
[Plan 060](../../plans/060-free-form-import-grilling-reconciliation.md),
[ADR 0011](../adr/0011-managed-taurifer-ai.md), and [CI](../ci.md).

## Purpose and trust boundary

Compare inexpensive language models for *transcribing an external coach's
training program*, not writing one. A valid import that silently changes a load
prescription is worse than an import the validator rejects. The complete product
pipeline remains: source text → model candidate → Taurifer's real
`parseFreeformProgramReply` → gap resolution where necessary → canonical
`parseProgramSource` → exercise-by-exercise review → explicit activation.

The evaluation suite never writes a program or alters training history.

## Benchmark

**Main benchmark (200 synthetic programs):** Twenty public, linked free-text
exercise-prescription format references, ten original generated cases per
reference, 100 in Brazilian Portuguese and 100 in English. Development has
120 cases, validation 40, and protected holdout 40. All variants inspired by a
reference stay in its split. References provide broad formatting cues only,
not copied personal data or sentences. The generator first constructs the
prescription, then renders text, then emits independently known gold. The
2,676 gold working-exercise rows are not produced by an LLM.

**Stress suite (40 scored inputs):** Independently authored, original
training-text examples. Twenty-four difficult but unambiguous prescriptions,
including global set rules, mixed languages, duplicate exercises, warmups
embedded in a working-set line, non-numeric repetition targets, supersets,
RIR, tempo, loads, progression, and injection. Sixteen messages with
*no executable prescription* must be rejected, not fabricated into workouts.
Positive and rejection denominators are reported separately.

**Manual-only ambiguity bank (8 inputs):** Alternatives, unnamed exercises,
conditional prescriptions, and unclear pyramid/drop-set counts are explicitly
flagged `requiresAdjudication`. There is no single fabricated gold answer,
and they are **excluded from automated rankings**.

The 200-case 10× reference-multiplication promise is preserved. The 48
independently authored stress/adjudication cases are an additional evaluation
dimension, not extra variants attributed to public sources.

All fixture files have deterministic byte output and content SHA-256 manifests.
The locked holdout file exists on disk, but the CLI unlock flag is only a
workflow guard, not a permission boundary. The stress suite is an exploratory
development set, **not** a second holdout.

## Devbox commands

Use a clean, isolated repository worktree. This feature branch currently
lives in `/home/ubuntu/repforge-import-eval`.

```bash
cd /home/ubuntu/repforge-import-eval

# Free; deterministic and reproducible.
node tools/program-import-eval/cli.mjs generate
node tools/program-import-eval/cli.mjs validate
node tools/program-import-eval/cli.mjs validate-parser
node tools/run-tests.mjs full-fast --suite-id test-program-import-eval-mjs
node tools/run-tests.mjs full-fast --suite-id test-program-import-eval-api-mjs

# Inspect selected cases and call cap without provider calls.
node tools/program-import-eval/cli.mjs plan \
  --transport claude --model haiku --split stress \
  --cases ptx-04,enx-06,ptn-03 --max-calls 3

# Explicitly permitted cheap-model execution through installed CLIs.
node tools/program-import-eval/cli.mjs run \
  --transport claude --model haiku --prompt baseline \
  --split stress --cases ptx-04,enx-06,ptn-03 \
  --max-calls 3 --execute

node tools/program-import-eval/cli.mjs run \
  --transport codex --model gpt-6-luna --prompt strict-v1 \
  --split development --indices 05,08,10 \
  --max-calls 36 --execute

# Direct provider APIs: requires corresponding environment key.
node tools/program-import-eval/cli.mjs run \
  --transport openai-api --model gpt-6-luna --mode schema \
  --prompt strict-v1 --split development --limit 4 \
  --max-calls 4 --execute

node tools/program-import-eval/cli.mjs run \
  --transport anthropic-api --model claude-haiku-5-5 \
  --mode prompt --prompt strict-v1 --split development \
  --limit 4 --max-calls 4 --execute

# Re-score saved *synthetic* responses after changing gold/grader,
# without paid inference; the original run is never overwritten.
node tools/program-import-eval/cli.mjs regrade \
  --from tools/program-import-eval/reports/runs/old-run \
  --out tools/program-import-eval/reports/runs/regraded-run

node tools/program-import-eval/cli.mjs compare \
  --left tools/program-import-eval/reports/runs/baseline \
  --right tools/program-import-eval/reports/runs/strict

node tools/program-import-eval/cli.mjs report \
  --run tools/program-import-eval/reports/runs/strict
```

All commands default to sequential execution. Each paid run requires
`--execute` and an explicit `--max-calls` when more than 100 requests are
planned. The default timeout is 120 seconds per case and the output-size
bound is 4 MB. No automatic retries or model substitution are performed.
Case IDs and prompt hashes are pinned in `meta.json`. A resumed run refuses
changed source selection, benchmark, or grader/adapter code hashes.

CLI subprocesses run in temporary directories with tools disabled (Claude)
or read-only (Codex); the harness flags unexpected tool activity. API
requests transmit only synthetic examples from the fixture dataset; keys
stay in environment variables. Both API adapters accept prompt-only and
constrained JSON output with the current Taurifer envelope schema. Strict
schema fields permit `null` where the normal free-text prompt omits an
unknown number; the real gap reader must still resolve it with a human.
Do not compare schema-constrained inference to bare-JSON prompting as if
only model weights had changed.

For OpenAI's Responses API, see
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
For Anthropic's Messages API, see
[structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

## Primary metrics and promotion

`semanticPass`: all day-local ordered exercise occurrences, exact names,
working sets, repetition bounds, missing-number gaps and approved unsupported
categories match construction-time truth. For negative examples, only an
unreadable outcome is correct.

`unsafeComplete`: the importer accepts altered program content as a complete
candidate, or accepts an invented program from non-program text. **Every
observed unsafe acceptance requires investigation.** Category-loss failures
are distinct from altered prescription failures.

Reports show parse rate for **positive** cases and rejection rate for negative
cases separately, alongside strict semantic success, per-language, per-
difficulty and per-reference outcomes, cost and token provenance. CLI
subscription token use, notably Codex wrapper overhead, does **not** estimate
direct API invoice costs. Unknown costs remain `null`.

Paired comparisons demand identical case IDs/repeats and matching benchmark
hashes, report family-bootstrap uncertainty, and explicitly return
`productionPromotionApproved:false`. Winning on synthetic data alone is
insufficient for production.

## Policy and integration boundaries

- No paid network calls occur in CI. The deterministic baseline and mocked
  API contract tests live in the established `full-fast` lane, preserving
  the fixed pull-request CI budget.
- No production prompt, PWA route, exercise library, storage key, telemetry
  schema, or permission behavior changes here.
- No end-user workout text is imported into benchmarks. All raw synthetic
  model replies are stored only under Git-ignored `reports/runs/`; use
  `--no-raw-replies` when raw artifacts should not be retained.
- Direct API adapters exist for local testing and are **not production
  services**; no provider retention/no-training contract is assumed.
- Whether founder-funded managed import precedes broader Taurifer AI remains
  a **proposed** decision under ADR 0011/0014, not a settled policy.
- The core product's matching review and explicit activation are unchanged.

## Remaining production evidence

1. Independently annotated, consented human-written real-world programs,
   with privacy review and a genuinely protected external holdout.
2. Live API smoke and cost measurement once authorized direct credentials
   are configured; mocked requests prove serialization, not provider availability.
3. Provider data handling, region and retention contract; per-installation
   abuse limits, founder-funded budgets, kill switch, and production endpoint.
4. A staged PT-BR pilot with measured import completion and activation
   outcomes, not only synthetic lexical fidelity.
5. Owner-approved decision on managed import scope, its timing, and its
   relationship to the later general Taurifer AI capability.

Do not automatically copy a benchmark-winning prompt into production.
Review actual user source and imported outcome before ratifying any change.
