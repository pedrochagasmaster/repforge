# Landing page, final version

The definitive landing page, assembled from the rounds before it. Serve the repo root
(`python3 -m http.server 8000`) and open `/docs/design/landing-candidates/final/`. Deep links:
`#pt` (default) and `#en`. Add `?bare` to hide the review bar. Rounds 1–5 are untouched.

## What comes from where

| Part | Source | What changed |
| --- | --- | --- |
| Base: copy, order, rules | S, round 3 | Everything below the proof is S's content: three ways to start, the three answers the engine gives, your data, questions, the close. Round 3's copy fixes all hold ("treino", "seu treino", RIR explained where it appears, "Você não precisa criar uma conta", usage data only in the FAQ). |
| Hero title and typography | B, round 5 | The live headline, "Chegue na academia sabendo exatamente o que fazer.", in B's night field and lighter display voice (Plex Sans 500, tight tracking). Every heading on the page uses B's scale. |
| Proof ("Veja na prática") | B's lens, round 5, rebuilt | See below. |
| Section structure | C, round 5 | Each section is its own field of color instead of hairlines on one background: night hero and proof, three full-bleed stripes for the ways to start (orange, paper, ink), a paper band, an ink band for your data, a light band for questions, an orange close. |

## The lens, rebuilt

Round 5's lens guessed where things were and magnified whatever sat nearby, so it caught parts of
neighboring rows, clipped the Now line against the frame, and skipped the notes step. This version:

- **Reads exact elements.** `render/capture.mjs` measures each target from the app's own DOM (the
  Now line's text, the Registrar série button, the rest dial, Substituir exercício, the note's
  first line, the last-session row) and writes the boxes into `SHOTS`. The lens is a crop of that
  box, nothing more.
- **Takes the shape of what it reads.** A pill for a line of text, a circle for the rest dial, and
  the app's own corner radius (magnified) for a button, which is read edge to edge, so the lens
  *is* the button.
- **Can overhang the phone.** Magnification is limited by the page column, not the phone frame, so
  a whole line reads at up to 1.95x without clipping.
- **Tells the last step as cause and effect.** Step 7 first reads the last-session row (60 kg × 10,
  RIR 2), then glides to the Now line (Subir para 62,5 kg · buscar 8 reps) while the caption
  explains why. With reduced motion it goes straight to the Now line.
- **Has a rail you can tap.** Seven detents under the phone show progress and jump to a step.
- The screen dims under the lens. The phone shows the dark captures because the proof sits on the
  night field in both themes.

## The persistent CTA

"Montar meu treino" appears once the hero's CTA has left the screen and steps aside at the closing
CTA. It is a single floating button, with no glass plate, and it takes the ink that contrasts with
the band beneath it (parchment over the night and ink bands, dark over paper), so it never sinks
into a dark field.

## Truth

- **Engine:** `engine-cases.mjs` runs `progression-engine.js` and asserts all three answers
  (60 kg × 10, 10, 10 → 62,5 kg × 8; 100 kg × 8, 7, 6 → hold at 100 kg; 70 kg × 7, 6, 6 → 67,5 kg).
  `--check` / `--write` work as in earlier rounds.
- **Real renders:** `render/capture.mjs` saves that session in the running app, opens each screen,
  measures the lens targets and writes WebP in both languages and themes.
- **App strings** in `K` match `i18n-*.json`; page wording ahead of the app (issue #274) is in `P`
  with the catalog value it replaces.
- **Known app issue visible in the renders:** #277, the PT load dial prints "62.5" (visible on step
  1, when the whole screen is shown; the lens never reads it).
- Orange fields carry ink, not white: `#141310` on `#E04E14` is 4.66:1 (round 5's white-on-orange
  failed at 3.99:1).

## Checks

`verify.mjs` (from `test/`) covers PT and EN at 360/375/390/430:

- no horizontal scroll at any scroll position or with everything open; the lens stays on screen
  on every step; no heading orphans; 44px targets;
- the 390×844 first screen, with and without the review bar: headline, subtitle and CTA visible and
  uncovered, no figures in the hero, B's display weight, sticky CTA hidden; the sticky CTA appears
  after the hero CTA, inks correctly over dark and light bands, and hides at the close;
- copy rules (no programa outside app labels, no faixa/topo/piso, no absolute never-lose promise,
  no eyebrows or section numbers), the live headline, RIR explained where it first appears, usage
  data only in the FAQ, bridge lines, i18n parity for `K` and `P`, image language;
- the three answers quote the app's rule lines and the engine's targets, in second person;
- the proof advances through all seven steps by scroll, the lens reads every target, step 7 reads
  the last session then the Now line, the lens image is the screen it reads, the rail jumps to a
  step; all with and without reduced motion;
- deep links, back/forward, nothing left running after rapid language switching, OS dark mode.

```bash
python3 -m http.server 8000 &
(cd test && node ../docs/design/landing-candidates/final/verify.mjs)
```

`screens/` holds the 390×844 first screen and the end of the proof in PT and EN, and the PT first screen under OS dark.
