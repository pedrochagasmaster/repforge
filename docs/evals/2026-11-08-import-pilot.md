# Import LLM eval — exploratory smoke and stress pilot

**Executed:** 2026-11-08/09 (America/Sao_Paulo). **Status:** Diagnostic
development experiment, not model selection or production approval.

**Transport:** Installed Claude Code `claude -p` using the `haiku` alias
(observed concrete model `claude-haiku-5-5`); Codex `codex exec` with
explicit `gpt-6-luna` (Codex events did not independently expose a resolved
model ID). Both with no tools and low reasoning effort. These are **not**
direct-API invoice/latency measurements.

## Dataset and correction

The initial six-case development pilot was 6/6 semantically exact for each
transport. That easy subset was not discriminating and **must not** be
interpreted as import accuracy in the wild.

A harder 16-case, explicitly selected development stress sample included
12 positive programs and four messages without any executable workout
prescription. Two reference-independent authored stress families (PT and EN)
were represented. The source-prescription gold was corrected where the first
version had unintentionally shortened day labels or treated non-prescriptive
forwarded text as a program note.

To avoid paying to re-execute identical requests after a gold correction,
the original baseline model replies were regraded through the updated
Taurifer parser/oracle and written to new, version-tagged artifacts. The
original results and their old benchmark hashes were preserved, not edited.
The strict candidate was executed on the corrected benchmark.

## Paired outcome (n=16 per model/prompt)

| Transport | Prompt | Exact | Positive parse | Correct rejection | Unsafe accepted | CLI-reported total charge |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Claude Code / Haiku | Merged baseline | 14/16 | 12/12 | 4/4 | 0 | $0.0202 |
| Claude Code / Haiku | strict-v1 | 14/16 | 12/12 | 4/4 | 0 | $0.0246 |
| Codex / GPT-6 Luna | Merged baseline | 12/16 | 12/12 | 4/4 | 0 | Not provided |
| Codex / GPT-6 Luna | strict-v1 | 13/16 | 12/12 | 4/4 | **1** | Not provided |

The strict variant **does not earn promotion**. It swaps two Haiku failure
cases for two different ones, with no net change and higher CLI-reported
charge. For Luna it improves one net case while introducing a material
**wrong day assignment that Taurifer would accept**. This is a critical
safety regression even though its aggregate exact rate improved.

### Failure details

- Haiku baseline: the time-only/AMRAP case misinterpreted a duration as reps
  and missed corresponding gap/notes; a RIR+tempo case omitted unsupported
  categories. Both are high-value improvements for future prompt candidates.
- Haiku strict: lost a note describing a duplicate final working set and
  added an optional note category for a forwarded instruction.
- Luna baseline: missed or added `other_notes` categories in time-only,
  repeated-exercise and forwarded-text cases.
- Luna strict: retained two minor note-category misses but incorrectly
  shortened day labels in a multi-day global-rule source (`ptx-01`).

The 16-case sample has only **two groups for family bootstrap**, so the
reported confidence bounds have very limited inferential value. Run a
larger source-family-stratified validation after removing benchmark
ambiguities and before opening the protected holdout.

## What this does and does not prove

It proves the CLI adapters, per-case parser bridge, strict fidelity grading,
correct negative rejection, and stable report/comparison workflow work in
practice. It shows the synthetic stress bank is meaningfully harder than
the initial generator corpus.

It does **not** establish a production primary model, exact API costs,
behavior under independently handwritten coach texts, data retention or
regional compliance, or whether managed import should ship ahead of the
accepted Taurifer AI sequencing decision. No provider API credentials
were available for a live direct-API bake-off in this run.

Raw synthetic output artifacts and complete JSON reports remain on the
devbox under `tools/program-import-eval/reports/runs/` and are ignored by
Git. Compare commands require identical case IDs and benchmark hashes.
