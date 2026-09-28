# Judge brief — Round 1 (identical for every judge)

You are one of several independent judges. You have not seen, and must not
seek, any other judge's notes, scores or conclusions. You must not modify any
candidate, harness or fixture file. Evaluate the artifact as committed.

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

## Artifact (immutable)

- Repository checkout: `/home/user/repforge`, commit recorded in
  `docs/design/onboarding-tournament/round-1/manifest.md`.
- Harness: `docs/design/onboarding-tournament/` (read its `README.md` first:
  it states what is real product logic, what is ported, what is simulated, the
  45 checkpoints, the 14 scenarios, the example users and the matrix).
- A static server is already running at
  `http://127.0.0.1:8123/` rooted at the repository. Review page:
  `http://127.0.0.1:8123/docs/design/onboarding-tournament/index.html`.
  Single phone: `…/app.html?c={a|b|c}&cp=<checkpoint>&lang={pt|en}&theme={light|dark}&text={100|200}&motion={normal|reduced}`.
- Candidate sources: `candidates/a.js` + `a.css` (A · Uma pergunta),
  `candidates/b.js` + `b.css` (B · Cinco portas honestas), `candidates/c.js` +
  `c.css` (C · Programa primeiro); shared: `runtime.js`,
  `candidates/shared-screens.js`, `base.css`, `tokens.css`, `data/fixtures.js`.
- Acceptance evidence: `round-1/acceptance/summary.md`, `results.json`, and one
  screenshot per candidate × checkpoint × cell under `round-1/acceptance/shots/`
  (filename `{c}__{checkpoint}__{lang}-{theme}-{width}-{text}[-reduced].png`).

Rendering yourself: Playwright is installed under `test/node_modules`; launch
Chromium with `executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`
and `args: ["--no-sandbox"]`. Drive the phones: click options, type in search
fields, open sheets, submit invalid gaps, confirm replacement, trigger the
conflict, and so on. Judging from screenshots or source alone is not
acceptable for the interaction-heavy dimensions.

## Product sources you must read before scoring

`PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, `docs/brand-guide.md`,
`docs/design/ui-system-semantic-contract.md`, `docs/adr/0007-shared-setup-links.md`,
`docs/adr/0014-free-form-program-import-handoff.md`, `plans/054-landing-and-program-entry.md`
(Approved direction and Non-goals sections), `plans/048-program-entry-onboarding-redesign.md`
(Locked UX/product decisions), and the current production onboarding captures at
`docs/ui-screens/screens/onboarding-*/` (these are the PR #256 baseline; the
scratch checkout of that head is at
`/tmp/claude-0/-home-user-repforge/d4429a92-dc1c-5374-aae2-80a77b0b0566/scratchpad/pr256`
if you need `app.js` or `program-entry.js` at the baseline).

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
evidence (file:line, checkpoint id, screenshot filename, or what you did in the
browser). Scores are evidence annotations, not votes.

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

## Required output

Write your report to the path you were given, as Markdown, containing:

1. Candidate-by-dimension comparison table with scores and justifications.
2. Scenario-by-scenario / state-by-state verdicts (all 14 scenarios; name the
   strongest treatment of each and why).
3. Biggest strength and biggest weakness of each candidate.
4. Concrete correctness or product-truth defects (anything that contradicts
   the engine, the ADRs, the locked decisions, or the brand rules; anything the
   prototype fakes that the product cannot do).
5. Accessibility or responsive defects, with the cell where you saw them.
6. Implementation conflicts or hidden product decisions (including the ones the
   candidate declares; say whether the declaration is complete).
7. Comparison against the PR #256 onboarding: where each candidate is better,
   equal or worse.
8. Final recommendation: a winner or an explicit synthesis, with the reasoning.
9. Citations for every concrete claim.

Rules: do not grade on a curve; do not split the difference diplomatically; a
visually attractive candidate with worse activation or broken product truth
loses; a familiar candidate does not win because it resembles the current
product; you may conclude that none is good enough.
