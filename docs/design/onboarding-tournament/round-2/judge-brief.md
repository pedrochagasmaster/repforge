# Judge brief — Round 2 (identical for every judge)

You are one of several independent judges. You have not seen, and must not
seek, any other judge's notes, scores or conclusions, in this round or the
previous one: `round-1/judges/` and `round-2/judges/` are off limits. You must
not modify any candidate, harness or fixture file. Evaluate the artifact as
committed at the SHA recorded in `round-2/manifest.md`.

## The decision this round informs

Taurifer (a local-first mobile PWA for progressive overload; see `PRODUCT.md`)
is redesigning its complete onboarding system: first-run landing, route
choice, the recommended / custom / browse / build / paste-import / file-import
routes, shared-link gate and preview, invalid link, replacement of an existing
program, cross-tab activation conflict, interrupted-setup resume, rules-drift
recovery, and the hand-off into Today after activation. The goal is that a new
Brazilian recreational lifter reaches a trustworthy, usable first program with
the least unnecessary cognitive and interaction cost while understanding enough
of what Taurifer did to trust the result.

Round 1 produced three candidates (A, B, C). A synthesis agent turned the
Round 1 evidence into a normative spec. Round 2 has three new candidates built
from that spec:

- **D · control** implements the spec faithfully, taking the spec's stated
  default on every open item.
- **E** and **F** are two new directions. Each keeps every settled and rejected
  item and takes an allocated, different position on the open items (the
  allocation table is at the end of `round-2/generator-brief.md`).

Your verdict decides whether one candidate is ready to be recommended to the
product owner, whether an explicit synthesis is needed, or whether the
remaining disagreement is a matter of taste that the owner must decide.

## Artifact (immutable)

- Repository checkout: `/home/user/repforge`; the frozen commit is in
  `docs/design/onboarding-tournament/round-2/manifest.md`.
- Harness: `docs/design/onboarding-tournament/`. Read `README.md` first (what
  is real product logic, ported, or simulated; the 45 checkpoints; the 14
  scenarios; the example users), then `round-2/JOURNEYS.md` (the Round 2
  candidate interface and the acceptance journeys) and `round-2/manifest.md`
  (candidates, theses, axes, per-checkpoint mapping, declared product
  decisions, harness interpretations).
- **The normative spec:** `round-1/synthesis-spec.md`. Every item in it is
  marked settled, rejected, open, or requires product decision. §9 lists the
  open items (O-1 to O-12), §10 the product decisions (PD-1 to PD-5), §12 the
  acceptance checks (K-1 to K-24) and the eight-cell matrix.
- A static server is already running at `http://127.0.0.1:8123/`, rooted at
  the repository. Review page:
  `http://127.0.0.1:8123/docs/design/onboarding-tournament/index.html?round=2`.
  Single phone:
  `…/round-2/app.html?c={d|e|f}&cp=<checkpoint>&lang={pt|en}&theme={light|dark}&text={100|200}&motion={normal|reduced}`.
- Candidate sources: `round-2/candidates/{d,e,f}.js` and `.css`, plus each
  generator's `round-2/candidates/<id>.notes.md`. Shared code: `runtime.js`,
  `candidates/shared-screens.js`, `base.css`, `tokens.css`, `data/fixtures.js`.
  The Round 1 candidates (`candidates/{a,b,c}.js`) remain for reference only.
- Acceptance evidence: `round-2/acceptance/summary.md` and `results.json`
  (hard and soft checks, K-checks and journeys per candidate). Screenshots
  from the frozen run are on disk under `round-2/acceptance/shots/`
  (gitignored; filename `{c}__{checkpoint}__{cell}.png`). Regenerate any you
  need with
  `node docs/design/onboarding-tournament/tools/verify.mjs --round 2 --candidates <id> --out <your scratch dir>`,
  or render the phones yourself.

Rendering yourself: Playwright is installed under `test/node_modules`. Launch
Chromium with `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`
and `args: ["--no-sandbox"]`. Drive the phones: answer questions, open and
edit answers, avoid an exercise, type in search fields, submit invalid gaps,
decline and accept the shared gate, confirm replacement, trigger the conflict,
resume an interrupted setup, and so on. Judging from screenshots or source
alone is not acceptable for the interaction-heavy dimensions.

## Product sources you must read before scoring

`PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, `docs/brand-guide.md`,
`docs/design/ui-system-semantic-contract.md`, `docs/adr/0007-shared-setup-links.md`,
`docs/adr/0014-free-form-program-import-handoff.md`, `plans/054-landing-and-program-entry.md`
(Approved direction and Non-goals sections), `plans/048-program-entry-onboarding-redesign.md`
(Locked UX/product decisions), and the PR #256 baseline captures at
`docs/ui-screens/screens/onboarding-*/`. The scratch checkout of the PR #256
head is at
`/tmp/claude-0/-home-user-repforge/d4429a92-dc1c-5374-aae2-80a77b0b0566/scratchpad/pr256`
if you need `app.js` or `program-entry.js` at the baseline.

## Reference user and environment

A Brazilian recreational lifter opening Taurifer on a phone, possibly
unfamiliar with progression terminology, who wants to get from "I need a useful
program" to "I know what I am doing today" without configuring software for its
own sake. Mobile-first; PT-BR is the primary copy stress test and English must
also work; 320–430 px widths; light and dark; 200% text must remain usable;
reduced motion must stay coherent; many users will not know which route is
technically best for them; abandonment rises with unnecessary decisions,
unexplained jargon, repetition, or asking for information before its value is
clear.

## Rubric

Score each candidate 1–5 on every dimension, with a justification that cites
evidence (file:line, checkpoint id, acceptance result, screenshot filename, or
what you did in the browser). Scores are evidence annotations, not votes.

1. Activation efficiency: how directly a user reaches a trainable program.
2. Route comprehension: can users understand how Recommend, Browse, Custom,
   Build and Import differ and choose appropriately.
3. Decision burden: number, timing and difficulty of choices.
4. Information scent: does every action make its consequence clear.
5. Trust: does Taurifer explain recommendations and transformations enough to
   be credible without becoming verbose.
6. Progressive disclosure: advanced choices appear when useful, not all at once.
7. Editability and agency: can the user correct Taurifer without restarting or
   feeling trapped.
8. Error and recovery quality: gaps, invalid input, interruptions, conflicts,
   shared-link failures.
9. Mobile ergonomics: reach, targets, keyboard/input behaviour, scrolling,
   persistent actions.
10. PT-BR robustness: expansion and natural Portuguese first.
11. Accessibility: 200% text, focus, non-colour state communication, reduced
    motion, target geometry.
12. Visual hierarchy and craft.
13. Taurifer brand and system fit (DESIGN.md, brand guide, Plan 058 semantic
    contract: control intents, elevation roles, one accent).
14. Cross-route coherence: do the routes still feel like one onboarding product.
15. Feasibility against the current architecture and semantic contracts
    (`program-entry.js` ROUTE_STEPS, activation rules, ADR 0007/0014).
16. Improvement over PR #256's current onboarding.
17. Validation value: does the design help Taurifer learn something important
    about activation rather than merely adding polish.

Round 2 additions (spec §12.3), each scored pass / partial / fail with
evidence:

18. **Spec compliance:** does the candidate honour every **settled** and every
    **rejected** item? List each violation with the spec section and the
    checkpoint where you saw it.
19. **Visible divergence:** is each **open** item resolved as the candidate's
    allocation and thesis claim, in a way that is visibly different from D on
    the screen (not only in the source)? For D, say whether it took the spec's
    default each time.
20. **Product-decision declaration:** is every **requires product decision**
    dependency declared in the candidate header, in `policy.productDecisions`,
    and in `round-2/manifest.md`, and is the declaration complete? Name any
    undeclared product-policy change you find.

## Required output

Write your report to the path you were given, as Markdown, containing:

1. Candidate-by-dimension comparison table (dimensions 1–20) with scores and
   justifications.
2. Scenario-by-scenario / state-by-state verdicts (all 14 scenarios; name the
   strongest treatment of each and why).
3. Biggest strength and biggest weakness of each candidate.
4. Concrete correctness or product-truth defects (anything that contradicts
   the engine, the ADRs, the locked decisions, the spec's settled items, or
   the brand rules; anything the prototype fakes that the product cannot do).
5. Accessibility or responsive defects, with the cell where you saw them.
6. Implementation conflicts or hidden product decisions (including the ones the
   candidate declares; say whether the declaration is complete).
7. Comparison against the PR #256 onboarding: where each candidate is better,
   equal or worse.
8. **Nature of the remaining differences.** For every pair of candidates,
   classify each material difference as one of: correctness, usability,
   accessibility, product truth, or taste. State plainly whether the choice
   between the best two candidates is now mainly a matter of taste or product
   policy, or whether one is better on evidence.
9. Final recommendation: a winner, an explicit synthesis (which parts from
   which candidate, and why), or "surface to the owner" with the exact
   question to ask. If your recommendation depends on a product decision
   (PD-1 to PD-5), give your recommendation both with and without it.
10. Citations for every concrete claim.

Rules: do not grade on a curve; do not split the difference diplomatically; a
visually attractive candidate with worse activation or broken product truth
loses; a familiar candidate does not win because it resembles the current
product or the control; a candidate does not win because it is new; you may
conclude that none is good enough.
