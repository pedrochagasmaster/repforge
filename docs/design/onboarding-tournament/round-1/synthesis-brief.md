# Synthesis brief — Round 1

You are consolidating independent design reviews of the same candidate set.
You receive all reports at once. Do not select by score totals or majority
vote. For every material finding and every disagreement, go back to the
underlying evidence (the artifact, the acceptance shots, the product sources)
and decide.

## Inputs

- Judge reports: `docs/design/onboarding-tournament/round-1/judges/judge-*.md`
- Artifact: `docs/design/onboarding-tournament/` at the commit in
  `round-1/manifest.md`; `README.md` states what is real, ported and simulated.
- Acceptance: `round-1/acceptance/summary.md`, `results.json`, `shots/`.
- Product sources: `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, `docs/brand-guide.md`,
  `docs/design/ui-system-semantic-contract.md`, ADR 0007, ADR 0014,
  `plans/054-landing-and-program-entry.md`, `plans/048-program-entry-onboarding-redesign.md`,
  the PR #256 onboarding captures under `docs/ui-screens/screens/onboarding-*/`.
- Live harness at `http://127.0.0.1:8123/docs/design/onboarding-tournament/`
  (Playwright under `test/node_modules`, Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `--no-sandbox`).

## Classify every material finding

product/domain correctness · activation and task performance · information
architecture · interaction/system constraints · accessibility/responsiveness ·
visual craft · implementation risk · open taste decision.

## Output: a durable Round 2 specification

Write `docs/design/onboarding-tournament/round-1/synthesis-spec.md` so that a
fresh implementation agent can build Round 2 without reading the raw debate.
It must contain, in this order:

1. Chosen base system (one of A/B/C, or an explicit synthesis), with the
   evidence that decided it.
2. Per-step / per-state decisions for all 45 checkpoints (a table: checkpoint,
   decision, status).
3. Cross-cutting navigation and layout rules.
4. Mandatory correctness fixes (product truth, engine, ADR, brand).
5. Copy principles (PT-BR first) and any settled strings.
6. Accessibility constraints.
7. Semantic-system constraints (Plan 058 control intents, elevation, progress
   dimensions, one-accent rule).
8. Patterns explicitly rejected, and why.
9. Decisions that remain intentionally open for Round 2, each with the
   divergence it invites.
10. Product-policy decisions that require human approval (do not resolve them;
    state each as a question with the trade-off).
11. Decision log: every item marked exactly one of **settled**, **rejected**,
    **open**, **requires product decision**, with its evidence.
12. Acceptance checks for Round 2 (the full comparison matrix plus any new
    checks the evidence justifies).

Rules: do not turn a judge preference into a settled rule unless the evidence
supports it; preserve the distinction between product truth and prototype
truth (a prototype shortcut is never canonical because judges liked it); where
judges disagree, say who was right and why, citing the artifact; keep the
document self-contained.
