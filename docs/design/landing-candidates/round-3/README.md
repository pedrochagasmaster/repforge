# Landing candidates, round 3

Candidate S only, rewritten for someone who has never opened Taurifer. Serve the repo root
(`python3 -m http.server 8000`) and open `/docs/design/landing-candidates/round-3/`. Deep links:
`#S-pt` (default) and `#S-en`. Add `?bare` to hide the review bar. Round 2 is untouched at
`../round-2/` (its S is `../round-2/#S-pt`), round 1 at `../index.html`.

## What changed from round 2

Every section now says what the app does and why that helps, in plain words:

- **Hero** names the pain ("stop guessing the weight"), and the subtitle says how Taurifer helps
  and why it beats a spreadsheet. The eyebrow names the audience instead of the process.
- **Demo** opens with a bridge that says what the ledger is and what to tap. The result is one
  second-person explanation: what you did against your target (page), the app's rule line
  (`rec.*.text`, verbatim), and the exact next target (page, from the engine). The caption says
  plainly that the band is the same session in the app.
- **Jargon**: RIR is explained where it first appears (the ledger), and the chart caption explains
  the e1RM the screenshot shows.
- **02** renames Sugestão to Já vem preenchido, rewrites Troca and Notas, and a light recurring
  line says logging is one tap and that each set feeds the next target.
- **03** leads with "Você não precisa criar uma conta", says what export is for, and no longer
  carries usage data or the install transfer. Both moved to the FAQ (the transfer under the app
  store answer, usage data as its own question).
- **Wording**: PT says "treino" (your program) and "sessão" (one day's workout), possessive
  ("seu treino"), including the CTAs. EN mirrors every change and keeps "program".

## App strings

The page still quotes the app exactly. `rec.add.text`, `rec.hold_add_reps.text` and
`rec.reduce.text` were rewritten in `i18n-pt.json` / `i18n-en.json` in the same change, so the
explanation's middle sentence is the app's own line.

The app still says "programa". Page wording that runs ahead of it lives in `P` in `index.html`,
each entry with the catalog value it replaces (`from`); `verify.mjs` fails if the app moves first.
Where the page tells the visitor which button to tap in the app, it keeps the app's label
verbatim (`<b class="ui">`) and says once that the app still calls the treino a programa.

## Engine data

`engine-cases.mjs` runs `progression-engine.js` for the three cases and asserts the verified
results. `--check` verifies the copy embedded in `index.html`, `--write` updates it.

## App renders

`assets/` holds the four bands S uses (`focus-add`, `focus-hold`, `focus-reduce`,
`paste-review`), copied byte for byte from round 2. The focus bands stop at the cue line, so the
rewritten rule lines do not appear in them. The pipeline is `../round-2/render/`.

## Checks

`verify.mjs` runs in Playwright (from `test/`) and keeps round 2's checks for S: no horizontal
scroll and no heading orphans at 360/375/430, 44px targets, the fold at 375×667 with and without
the review bar, focus rings, keyboard, sticky CTA states, reduced motion end states, PT banned
words and punctuation, localized decimals, exercise names against `exercises.js`, copied strings
against `i18n-*.json`, screenshot language, deep links, back/forward, and that switching language
leaves no observer or timer running. Round 3 adds: `P` against the catalog, no PT "programa"
outside an app label, no "faixa"/"topo"/"piso"/"o treino" in PT (nor "range"/"the program" in EN),
RIR explained before the FAQ, the data section free of usage data and the transfer, a data FAQ, and
each explanation in second person quoting its `rec.*.text`.

```bash
python3 -m http.server 8000 &
(cd test && node ../docs/design/landing-candidates/round-3/verify.mjs)
```

`screens/` holds the 375px full-page captures (`R3_SHOTS`).
