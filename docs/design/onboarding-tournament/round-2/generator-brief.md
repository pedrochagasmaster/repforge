# Round 2 generator brief

You are a fresh generator. You have not seen the Round 1 judge reports, their
scores or their debate, and you must not read them
(`round-1/judges/` is off limits). Your only inputs are the synthesis spec,
the product sources, the existing harness and the Round 1 candidate code as
reference for the shared contract.

## Inputs

1. **The normative spec:** `docs/design/onboarding-tournament/round-1/synthesis-spec.md`.
   Read it in full. Items marked **settled** are fixed. Items marked
   **rejected** are excluded. Items marked **open** are yours to explore. Items
   marked **requires product decision** must not be resolved silently: where a
   direction depends on one, implement it and flag it in the candidate header
   comment and in `round-2/manifest.md`, exactly as Round 1 did.
2. **Product sources:** `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`,
   `docs/brand-guide.md`, `docs/design/ui-system-semantic-contract.md`, ADR
   0007, ADR 0014, `plans/054-landing-and-program-entry.md`,
   `plans/048-program-entry-onboarding-redesign.md`, the PR #256 captures under
   `docs/ui-screens/screens/onboarding-*/`.
3. **The harness:** `docs/design/onboarding-tournament/README.md` (contract),
   `runtime.js` (real/ported/simulated boundary, `TF.CHECKPOINTS`),
   `candidates/shared-screens.js` (shared widgets), `base.css`, `tokens.css`,
   `data/fixtures.js`, `tools/verify.mjs`, and the Round 1 candidates
   `candidates/{a,b,c}.js` as reference implementations of the checkpoint
   contract (not as designs to polish).

## What to build

Three Round 2 candidates in `docs/design/onboarding-tournament/round-2/candidates/`:

- **D · control**: implements the synthesis spec faithfully and completely.
  Where the spec leaves something open, take the spec's stated default or the
  most conservative reading, and say which in the header comment.
- **E** and **F**: two new directions that preserve every settled and every
  rejected item, and diverge materially from D and from each other on the open
  items. Each has a one-sentence thesis and a named axis of divergence. Do not
  merely polish a Round 1 candidate; nothing from Round 1 is sacred beyond the
  settled rules.

Same shared contract as Round 1: all 45 checkpoints (`TF.CHECKPOINTS`), the
same fixtures and example users, the same real engine calls through `TF`, the
same shared widgets for import review, free-form hand-off and gap repair,
build editor, replacement, conflict, resume and rules-changed (you may restyle
their composition; you may not give one candidate an easier version), PT-BR
first with full EN parity, light and dark, 320/390/430, 200% text, reduced
motion, 44 px targets, 16 px control text, token-only colour, Plan 058 control
intents and elevation roles, and every product rule listed in the README.

## Delivery

- `round-2/app.html` (copy `app.html`, point it at `../` shared files and at
  `candidates/{d,e,f}.{js,css}`), and register the three candidates in
  `harness.js` under `ROUNDS[2]` with names, theses and axes.
- `round-2/manifest.md`: candidates, theses, axes, per-checkpoint mapping,
  declared product-policy dependencies, and the exact commit SHA once frozen.
- Run `node docs/design/onboarding-tournament/tools/verify.mjs --round 2` against
  the static server at `http://127.0.0.1:8123/` and fix every hard failure
  before freezing. Commit `round-2/acceptance/summary.md` and `results.json`.
- Commit on branch `ccr-15c50ac8-pki40i` with a clear message; do not touch
  Round 1 files except `harness.js` (round registration).

Quality bar: plausibly shippable; finished PT-BR and EN copy; production-grade
spacing and typography; real controls and states; no placeholder text; no
impossible engine output; no generic dashboard styling; no gratuitous cards,
gradients, glass, pills or hero type; no unexplained removal of difficult
states.
