# Landing candidates, round 4

Two new directions. The message is round 3's; the page around it is rethought from scratch.
Serve the repo root (`python3 -m http.server 8000`) and open
`/docs/design/landing-candidates/round-4/`. Deep links: `#N-pt` (default), `#N-en`, `#P-pt`,
`#P-en`. Add `?bare` to hide the review bar. Rounds 1–3 are untouched.

| | Candidate | Concept |
| --- | --- | --- |
| N | O próximo número | The page is the anatomy of one number, the weight for next time. It rolls up from 60 to 62,5 in the hero. Scrolling builds it from the sets, the target, the RIR and the rule; three keys morph the same diagram into holding and lowering; the real workout screen zooms to each control in turn. Ledger world: paper, ink, orange only on what changed. |
| P | Perguntas | The page is a first-time visitor's questions, in the order they come up. Each question owns a full orange field. Its answer is paper that slides over it, and the question recedes as it is answered. Visitors log three sets with one tap each, drag the RIR, and watch Taurifer fill the spreadsheet cell a spreadsheet leaves empty. |

Both keep a persistent "Montar meu treino" CTA on screen from the first frame to the last.

## Truth

- **Engine:** `engine-cases.mjs` runs `progression-engine.js` for the three cases both pages show
  and asserts the results, including the capacity figure behind "dava para fazer 12".
  `--check` verifies the copy embedded in `index.html`; `--write` updates it.
- **App strings:** app strings are quoted verbatim (`K`, checked against `i18n-*.json`).
- **Wording ahead of the app:** "treino" where the app still says "programa" lives in `P`, each
  entry with the catalog value it replaces (issue #274).
- **Renders:** app screens are real renders: the round-2 bands in `assets/` (copied byte for byte)
  and the shipped `assets/brand/` renders (`focus`, `why-this-weight`). Every one is introduced by
  a line saying what the visitor is looking at.
- **Diagrams:** the rep ruler (N), pips (P) and spreadsheet (P) are diagrams drawn from the same
  engine numbers, never passed off as app screens.

## Checks

`verify.mjs` runs in Playwright (from `test/`) across both candidates, PT and EN, at 360/375/430.
It checks:

- **Layout:** no horizontal scroll at any scroll position or with everything open; no heading
  orphans; 44px targets.
- **CTA and fold:** the persistent CTA stays on screen at every scroll position, and the H1 and
  CTA sit in the first viewport, with and without the review bar.
- **Errors:** no page or console errors, including under OS dark.
- **Copy:** PT banned words and punctuation, localized decimals, no "programa" outside an app
  label, and no faixa/topo/piso.
- **Clarity:** RIR is explained where it first appears; every app render has its
  "what you see" line; there is a data-collection answer.
- **Sources:** exercise names come from `exercises.js`; `K` and `P` match the catalogs; renders
  follow the page language.
- **Interactions:**
  - N: the hero lands on 62,5; the dissection advances with scroll; the outcome keys work by
    touch and keyboard and switch the band; the workout-screen zoom visits all seven stops.
  - P: three taps log the session; redo resets it; the RIR slider responds to the keyboard; the
    spreadsheet cell fills; a question recedes under its answer.
- **Harness:** reduced motion shows the final number; deep links and back/forward work;
  switching candidates leaves no timer, frame or observer running.

```bash
python3 -m http.server 8000 &
(cd test && node ../docs/design/landing-candidates/round-4/verify.mjs)
```

`screens/` holds the 375px first viewports (`R4_SHOTS`), light and dark.
