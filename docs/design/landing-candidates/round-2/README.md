# Landing candidates, round 2

`index.html` is one self-contained review page with four candidates (S, T, U,
V). Serve the repo root (`python3 -m http.server 8000`) and open
`/docs/design/landing-candidates/round-2/`. Deep links: `#S-pt`, `#T-en`, and
so on. Add `?bare` to hide the review bar. Round 1 is untouched at `../index.html`.

| | Candidate | Hypothesis |
| --- | --- | --- |
| S | Síntese (recommended) | A's ledger made interactive with C's three outcomes; building and bringing a program one tap away |
| T | Sua vez | Doing beats watching: the visitor logs the last set and the engine answers |
| U | Seis semanas | The outcome over time sells the benefit: one lift across a six-week block |
| V | Duas telas | A free, no-account product converts best on a two-screen page |

## Engine data

Every number the page claims comes from `progression-engine.js`:

- `engine-cases.mjs`: the three verified cases (S, and V's worked example). Asserts the brief's expected results.
- `engine-grid.mjs`: T's 5 × 4 grid (set 3 reps 6–10 × RIR 0–3). `--explain` shows why sets 1–2 differ from the brief: with 60×10 RIR 2 twice, all 20 cells return Add load 62,5 × 8.
- `six-weeks.mjs`: U's block. It states the deliberate miss (week 4).

Each prints its JSON; `--check` verifies the copy embedded in `index.html`, `--write` updates it.

## Checks

`verify.mjs` runs in Playwright (from `test/`): no horizontal scroll and no heading orphans at 360/375/430,
44px targets, the fold at 375×667 with and without the review bar, focus rings, keyboard, sticky CTA
states, reduced motion end states, PT banned words and punctuation, localized decimals, exercise names
against `exercises.js`, copied strings against `i18n-*.json`, screenshot language, deep links,
back/forward, and that switching leaves no observer or timer running. `screens/` holds the 375px
full-page captures.
