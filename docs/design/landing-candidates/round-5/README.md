# Landing candidates, round 5

Three candidates built from round 3's S, sharing one base and differing in art direction. Serve the
repo root (`python3 -m http.server 8000`) and open `/docs/design/landing-candidates/round-5/`.
Deep links: `#A-pt` (default), `#B-pt`, `#C-pt`, and `-en` for each. Add `?bare` to hide the
review bar. Rounds 1–4 are untouched.

## The shared base

- **Hero:** the live headline, "Chegue na academia sabendo exatamente o que fazer.", with round 3's
  subtitle unchanged, since it already follows on from the headline. The hero is words only: no
  figures.
- **Veja na prática:** a one-line bridge names the screen. Then the real training screen is walked
  through one step at a time:
  1. the screen, with RIR explained;
  2. the prefilled target;
  3. Registrar série;
  4. the rest timer;
  5. swapping an exercise;
  6. notes;
  7. the recommendation, in plain second person ("Você fez 10 repetições com 60 kg nas três
     séries, o máximo da sua meta…").

  Round 3's "entre uma série e outra" list is folded into these steps.
- **Bands:** each section is its own band with one idea: notebook versus Taurifer, three ways to
  start, your data, questions, then the close. There is no filler space.
- **Round 3's copy fixes are all kept:**
  - "treino" and "seu treino";
  - RIR explained where it appears;
  - "Você não precisa criar uma conta";
  - export as the safety net, with no promise that nothing can be lost;
  - usage data only in the FAQ;
  - "Montar meu treino".
- **Sticky CTA:** "Montar meu treino" appears only once the hero's own CTA has left the screen, and
  steps aside at the closing CTA.

## The three directions

| | Candidate | Art direction | Signature moment |
| --- | --- | --- | --- |
| A | Recibo | Warm paper, ink, full-width hairlines between bands, a thin progress rail. | The last step prints the next-session recommendation out of the phone as a receipt slip. |
| B | Lupa | An always-dark matte night panel, with bands alternating between two charcoal tones. | A pill-shaped lens glides over the dimmed real screen with a slight spring, sized to the line or control it reads. |
| C | Faixas | Hard-edged color blocks: an orange hero, an ink comparison band, square 4px corners. | The walkthrough is a deck of cards you swipe, with detent buttons; the phone follows the card. |

All three share one 8px spacing scale, balanced headlines, tabular figures, the same two easings
(`--out` settle and `--spring` overshoot), and pressed states on every control.

## Truth

- **Engine:** `engine-cases.mjs` runs `progression-engine.js` and asserts the numbers the
  walkthrough explains (60 kg × 10, 10, 10 at RIR 2 gives 62,5 kg × 8). `--check` / `--write` work
  as in earlier rounds.
- **Real renders:** the phone screens are fresh captures of the running app for that same session.
  `render/capture.mjs` saves the state, opens the Focus screen, logs a set (rest timer), opens
  exercise actions and the note, and writes each screen as WebP in both languages and themes. It
  also measures the controls the walkthrough zooms to and writes them into `SHOTS` in
  `index.html`. `wt-why-*` is captured for reference only; the page doesn't use it (see #278).
- **Known app issues visible in the renders:**
  - #277: the PT load dial prints "62.5".
  - #278: the "Por que essa carga" headline says "Mantenha" for an add-load recommendation.
  - The Focus screen's "-1kg e1RM" delta line.
- **Round 3's paste-review band** is copied byte for byte.

## Checks

`verify.mjs` (from `test/`) covers A, B and C in PT and EN at 360/375/390/430. It checks:

- **Layout:** no horizontal scroll at any scroll position or with everything open, no heading
  orphans, and 44px targets.
- **First screen at 390×844,** with and without the review bar: headline, subtitle and CTA are
  fully visible and uncovered, the hero has no figures, and the sticky CTA is hidden. The sticky
  appears after the hero CTA leaves and hides at the closing CTA.
- **Copy rules:** "treino", no "programa" outside app labels, no faixa/topo/piso, and no absolute
  "never lose" promise. The headline is the live one and "Você não precisa criar uma conta" is
  present.
- **Placement:** usage data appears only in the FAQ, and RIR is explained where it first appears.
- **Bridge lines:** a bridge sits before the walkthrough, and a what-you-see line before the paste
  screen.
- **Sources:** app strings match `i18n-*.json`, and screens follow the page language.
- **Ending:** the walkthrough ends on the second-person explanation.
- **Walkthroughs:**
  - A and B advance through all seven steps with scroll, with and without reduced motion.
  - A's slip prints and B's lens appears.
  - C's deck works by button, keyboard and swipe.
- **Harness:** deep links and back/forward work, switching candidates leaves nothing running, and
  OS dark mode has no errors.

```bash
python3 -m http.server 8000 &
(cd test && node ../docs/design/landing-candidates/round-5/verify.mjs)
```

`screens/` holds 390×844 first screens (light and dark) and each candidate's signature moment.
