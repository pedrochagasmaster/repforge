# Landing candidates, round 2: direction and implementation brief

Status: the definitive brief for the round-2 landing exploration (follows PR #252).
Audience: the implementation agent. Scope: design exploration only. The production
landing in `index.html` and the round-1 page in `docs/design/landing-candidates/index.html`
are not modified.

This brief merges two earlier review prompts. From the first it keeps the review
rationale, the design freedom for new directions, and the round-1 comparison. From the
second it keeps the enforceable brand rules, the section-level spec for the synthesis,
the 5-second test and the engine verification. Where the second prompt contradicted the
codebase, this brief follows the codebase. Those corrections are listed in §8.

---

## 1. What round 1 taught us (keep this reasoning in mind)

| Round 1 | What worked | What failed | Carry forward |
| --- | --- | --- | --- |
| A · Caderno | The ledger explains the product: logged sets produce a next target you can understand. Editorial, on-brand. | The scroll is too long. Brand slips: "Supino reto com barra", "offline" in PT, a secondary link that isn't an app label. | The foundation and the ledger |
| B · Noite | The real app is shown, and the CTA stays available. | The proof sits inside a horizontal carousel, where most visitors never see slides 2 and later. | Only the sticky CTA behaviour |
| C · Números | The most distinctive idea: the next target is the focus, and it shows add, hold and back off. | Poster hero. It asks visitors to understand the mechanism before they see the benefit. | The three engine cases, compact |
| D · Traga o seu | Speaks to people who already have a program. | It makes importing look more direct than the real ChatGPT/Claude hand-off. | The message → program-card demo, with honest copy |
| E · Vitrine | Tidy and recognisable. | It looks like an app-store template, not Taurifer. | Its privacy rows and install steps, restyled |

## 2. Acquisition principles this round is built on

These are the reasons behind the rules in §3 and §4. Where a rule conflicts with taste,
the rule wins unless you can argue otherwise in the candidate note.

1. **The first screen has to do the job.** Most viewing time happens above the fold and
   in the first two screenfuls (NN/g's scrolling-and-attention eye-tracking). At 375×667,
   the first screen has to show what the product is, who it's for, and the primary CTA,
   in both languages.
2. **Show the mechanism by example, not by adjectives.** A worked example (these sets →
   this next load, and why) is what makes a progression app believable. A's ledger
   proved this. Every candidate needs one concrete, engine-verified example above the
   second screen.
3. **One primary action.** Every candidate has one primary CTA label. The second route
   is a text link, never a second black button. Competing CTAs split intent and slow the
   decision (choice overload).
4. **The label promises where it goes.** The CTA label matches the control the visitor
   presses next. The app's first-run screen says "Montar meu programa" / "Build my
   program" and "Acompanhar meu programa atual" / "Track my current program", so those
   are the landing labels.
5. **Put risk reducers next to the CTA.** "Sem conta · Funciona sem internet ·
   Gratuito" sits directly under the hero CTA, not in a later section. A free product
   with no account needs little persuasion, which is why pages should be short.
6. **Nothing important in carousels, tabs you must discover, or auto-advance.**
   Carousel engagement drops sharply after the first slide. Put proof in the vertical
   flow. The one exception is a visible segmented control with a sensible default, like
   S's add/hold/back-off control, because its first state already makes the point.
7. **Sticky CTA on mobile, added late.** It appears once the hero CTA scrolls out of
   view, never covers content (reserve bottom padding), and is the only floating layer.
8. **Answer objections, briefly.** Is it free, do I need an app store, what is RIR,
   where does my data live, can my coach send me a program. Answer them in the FAQ or
   inline. Don't give each one its own section.
9. **Lead with building, keep bringing visible.** The thesis (ADR 0010, v1.2) makes
   generator-first acquisition primary and BYOP the migration/expert path. The primary
   CTA builds. "Track my current program" is always the visible second route.
10. **Speed counts as design.** Bounce rises steeply as mobile load time grows. Load the
    hero image eagerly and everything else lazily, add no web fonts beyond the app's Plex
    woff2, and add no JS libraries. Aim for LCP under 2.5 s on a throttled 4G profile.

## 3. Rules every candidate must pass

All of these are checked against `DESIGN.md`, `docs/brand-guide.md`, `CONTEXT.md` and
the i18n catalogs.

**Visual**
- Orange (`--accent` / `--accent-deep`) marks only what is live or changed: the next
  load, the active segment, the CTA's arrow glyph. Never a headline line, a decorative
  glyph, a repeated icon or a section number. At most one orange element competes for
  attention per screen.
- Rules are hairlines (`--hairline`, `--hairline-strong`), never shadows. No bounded tile
  inside a card. Glass and shadow belong only to the single floating layer.
- Name tokens, not raw colours. Translucent colour goes through the triplet:
  `rgba(var(--accent-rgb), .12)`. Copy the token block from `styles.css`. Don't retype hex.
- Every tap target is at least 44px. The primary CTA follows DESIGN.md's primary button:
  near-black ink, at least 54px tall, orange arrow in `::after`.
- IBM Plex from `fonts/`, with tabular figures for every number.
- Screenshots come from `assets/brand/*-{pt|en}-{light|dark}.webp` and match the page
  language. No crop may clip content under the dynamic island (round 1's
  `exercise-chart` did). Crop or offset the frame so the top of the chart shows.
- No illustrations, icons, initials or silhouettes in place of missing exercise art.

**Copy**
- PT first, then EN. PT runs longer, so validate PT at 360px before EN.
- PT must not contain `offline`, `log`, `stats`, `performance`, `split`, `delta` or
  `aparelho`. Use "sem internet", "registrar", "histórico", "Progresso", "divisão",
  "equipamento". PT uses *você*.
- No exclamation marks, no em dashes in prose (en dashes only inside numeric ranges),
  straight quotes.
- Nothing about bulls, forges, streaks, badges, celebration, or "coach" for the AI.
  Use CONTEXT.md terms: *program* (not routine/plan/template), *session*, *capacity*.
- Localize numbers: `62,5 kg` in PT, `62.5 kg` in EN. Format them with
  `Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en")` from a numeric source. Never type
  the string by hand.
- Exercise names match `exercises.js` exactly: **"Supino com barra" / "Barbell bench
  press"**, **"Agachamento livre com barra" / "Barbell back squat"**.
- Copy that points at a control uses that control's label from `i18n-*.json`. The
  labels this brief relies on:

  | Control | PT | EN | Key |
  | --- | --- | --- | --- |
  | Primary CTA | Montar meu programa | Build my program | `landing.build` |
  | Second route | Acompanhar meu programa atual | Track my current program | `landing.track` |
  | Entry hub title | Criar um programa | Create a program | `entry.hub.title` |
  | Entry groups | O Taurifer monta o programa · Escolha um programa pronto · Traga ou monte o seu | (EN equivalents) | `entry.hub.group.*` |
  | Paste route | Colar de qualquer lugar | (EN equivalent) | `entry.hub.freeform.title` |
  | Log a set | Registrar série | Log set | `today.log_set` |
  | Engine verdicts | Aumentar carga · Manter · somar reps · Reduzir | Add load · Hold · add reps · Back off | `rec.add/hold_add_reps/reduce.label` |

- **Three** ways to start a program, matching the entry hub's three groups. Never "four".

**Truth**
- Every engine example comes from `progression-engine.js`. The verified cases are in §5.
  Anything new must be run through the engine the same way, with the script kept in the
  PR.
- Privacy: training data stays on the device. The only exception is the explicit,
  one-hour install transfer, and absolute claims like "never leaves" must allow for it.
  Say "No account" and "Your history is saved on this device". Telemetry is **opt-in**
  (`privacy.telemetry.body`): coarse anonymous product funnels, never workout values,
  exercise names, notes or setup links. Any "anonymous usage" row must say it is off
  unless you turn it on.
- "Gratuito / Free": building a program, logging sessions and getting the next target
  are free. Don't promise that everything stays free forever (Taurifer Pro is planned).
- The assistant hand-off is a copy-paste relay. Taurifer gives you a prompt, you paste it
  into ChatGPT or Claude with your program text, and you paste the reply back. Then you
  check every exercise before anything is saved. The pasted text stays in the tab for
  that import only (`entry.freeform.privacy`). Taurifer does not call an AI itself.
- **There is no deep link into a specific entry route.** The app only reads `?goto=<day>`
  (`app.js`, `applyGotoParam`). So every CTA goes to the app root
  (`https://pedrochagasmaster.github.io/repforge/`). There, first-run shows "Montar meu
  programa" and "Acompanhar meu programa atual", and "Colar de qualquer lugar" sits
  under *Traga ou monte o seu → Usar meu próprio programa*. **Therefore: no "Colar meu
  treino / Paste my program" CTA.** Say in copy where the paste route lives, e.g.
  "No app, toque em Acompanhar meu programa atual e depois em Colar de qualquer lugar."
  Check that path in the running app before writing it.
- The Privacy page is an in-app dialog with no URL. The footer link "Privacidade /
  Privacy" goes to the page's own data section (`#dados` / `#data`). That section ends
  with "Detalhes completos no app: Ajustes → Detalhes de privacidade", with labels
  checked against `settings.group.privacy` / `privacy.open`.

## 4. The page harness

- New file: `docs/design/landing-candidates/round-2/index.html`. A single self-contained
  page with inline CSS/JS, no build step and no dependencies, following the round-1
  file's conventions (`shot()`, `L(pt, en)`).
- A fixed top switcher: candidate tabs (S, T, U, V, …) plus a PT/EN toggle. Each is a
  44px segmented control. Below them is a one-line note on the candidate's idea, with
  the synthesis labelled "Síntese recomendada / Recommended synthesis". The switcher is
  review chrome, not part of the design. Keep it visually distinct (a hairline and a
  neutral fill) and don't count it against the "one floating layer" rule.
- Deep links `#S-pt`, `#T-en`, etc. They update on switch, load directly, and work with
  back/forward.
- Switching candidates cancels timers and observers and resets scroll. Round 1 leaked
  observers, so use one `track()` registry and clear it on switch.
- A small "Ver rodada 1 / See round 1" link in the switcher goes to the untouched
  round-1 page, for comparison without embedding it.
- `prefers-reduced-motion`: every animation resolves to its end state immediately.
- Light theme is the reference. Every candidate stays readable if the OS is dark (either
  support dark tokens or force `color-scheme: light` for the candidate).

## 5. Verified engine cases (use these numbers exactly)

Range strategy v1, settings `{ minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 }`,
the logged session as history, `currentSession: []`. Run on this branch:

| Case | Exercise · prescription | Logged (load × reps · RIR) | Engine result | Reason code |
| --- | --- | --- | --- | --- |
| Add load | Supino com barra · 3 × 8–10 | 60 × 10 · 2, 60 × 10 · 2, 60 × 10 · 2 | `advance` → **62,5 kg × 8** | `range.performed_top` |
| Hold | Agachamento livre com barra · 3 × 5–8 | 100 × 8 · 1, 100 × 7 · 0, 100 × 6 · 0 | `hold` → **100 kg × 8** | `range.room_in_range` |
| Back off | Supino com barra · 3 × 8–10 | 70 × 7 · 0, 70 × 6 · 0, 70 × 6 · 0 | `reduce` → **67,5 kg × 8** | `range.below_floor` |

To reproduce:

```js
const E = require("./progression-engine.js");
E.evaluateProgression({ engineVersion: 1, relation: null, modifiers: [],
  prescription: { schemaVersion: 1, modifiers: [],
    strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 8, repMax: 10 } } },
  settings: { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 },
  history: [{ sessionId: "s1", date: "2026-09-20",
    sets: [{ load: 60, reps: 10, rir: 2 }, { load: 60, reps: 10, rir: 2 }, { load: 60, reps: 10, rir: 2 }] }],
  currentSession: [], context: { weekNumber: 1, blockLength: 6, blockStart: null } });
// → status "advance", target.sets[0] = { load: 62.5, reps: 8, … }
```

Take the rule sentences from the app's own copy, filled for the case:
`rec.add.text` ("Todas as séries bateram o topo da faixa. Aumente o peso."),
`rec.hold_add_reps.text`, and `rec.reduce.text` with `{min}` = 8. You may add one
plain sentence of numbers ("A carga sobe 2,5 kg; a meta volta para 8 reps"). Don't
write "reps start again at 8" as a general rule, because re-entry reps are computed per
case. Keep A's footnote only in the form "Calculado pelo motor de progressão do
Taurifer." Drop "no number was adjusted" unless the page actually computes the result
live from the engine.

---

## 6. Candidate S: the recommended synthesis

**Idea:** A's training ledger, made interactive with C's three outcomes, with building
and bringing a program both one tap away. The review picked this direction. Build it
exactly, but **to a scroll budget**: at most about 6 screens at 375×667 in PT (≈ 4,000
CSS px), footer excluded. Round-1 A ran long, and the second prompt's 12-section list
would have made it longer. The budget wins, so sections below are merged or folded
where noted.

1. **Header.** A's: mark, "Taurifer", and a small "Abrir o app / Open the app" pill (44px
   target).
2. **Hero.** A's eyebrow, headline and lede. Fix the lede so it's accurate: "O Taurifer
   monta seu programa, guarda cada série que você faz e calcula a meta da próxima
   sessão, sempre com o motivo por escrito." Primary CTA "Montar meu programa". Text link
   "Acompanhar meu programa atual". Meta row: "Sem conta · Funciona sem internet ·
   Gratuito" / "No account · Works offline · Free". Check the headline breaks at 360px in
   PT, with no orphan (use `text-wrap: balance` plus a manual `&nbsp;` where needed).
   **5-second test:** headline, lede, CTA and meta row all show above 667px.
3. **Ledger demo.** A's ledger card, with a 3-segment control (44px, full width) above
   it. PT **Aumentar carga · Manter · Reduzir**, EN **Add load · Hold · Back off**,
   default Aumentar carga. Each segment swaps in the §5 case (exercise, prescription, 3
   rows, next load, verdict label, rule sentence) and replays A's row-fill (staggered,
   ~120 ms). The active segment and the next load are the screen's orange marks.
   `aria-pressed`/`role="radiogroup"`, arrow-key support, and `aria-live="polite"` on the
   verdict. No sticky board, no poster.
4. **01 · Começar / Start.** A's three routes, titled by the entry-hub groups (a, b, c;
   ink, not orange). Route c, "Traga ou monte o seu", is a disclosure (44px, chevron,
   animated height via CSS, `aria-expanded`). When open, it shows D's demo: a coach's
   WhatsApp-style message → a Taurifer program card (Supino com barra etc., library
   names). The arrow between them is `--ink-3`, not orange. Under it:
   - one honest line: "Você copia o comando do Taurifer, cola no ChatGPT ou no Claude
     junto com o seu treino e traz a resposta de volta. Antes de salvar, você confere
     cada exercício."
   - D's privacy note, aligned with `entry.freeform.privacy`.
   - where to find it: "No app: Acompanhar meu programa atual → Colar de qualquer
     lugar" (verify the path first; see §3 Truth).
   - no Paste CTA (there's no deep link).
5. **02 · Treinar e acompanhar / Train and track.** A's sections 02 and 03 merged to fit
   the budget. One heading, the `focus` screenshot, a 4-item key-value list (Sugestão,
   Descanso, Troca, Notas; tighten the copy), then the `exercise-chart` screenshot
   **with the top unclipped** and a one-line caption ("92,5 → 100 kg em quatro
   sessões"). The two screenshots can sit side by side at about 46% width each, if they
   stay legible at 360px. Otherwise stack them and cap each at 60vh.
6. **03 · Seus dados / Your data** (`id="dados"` / `"data"`). One hairline card with
   three rows, each with a plain ink icon: *No seu celular* (history saved on this
   device, no account, export JSON/CSV/texto), *Sem internet* (works without a
   connection once opened), *Uso anônimo, só se você permitir* (opt-in funnels, never
   workout values). Close with the in-app privacy pointer.
7. **FAQ.** Four `<details>` items, each at least 44px: *É grátis?* · *Preciso de loja de
   apps?* (E's iPhone and Android install steps inside, using the app's install labels) ·
   *O que é RIR?* · *Meu treinador pode me mandar um programa?* This last one replaces
   the second prompt's standalone "For coaches" section: D's setup-link card goes inside
   it, flattened (no icon tile), with the "Vai no link / Não vai" columns kept word for
   word, checked against `privacy.setup.body` and `program.share_setup_body`.
8. **Close.** A's closing: "Comece de onde você está." plus the primary CTA and the text
   link.
9. **Footer.** A's. "Privacidade" → `#dados`.
10. **Sticky CTA.** B's behaviour in light tokens. It appears once the hero CTA leaves
    the viewport (IntersectionObserver), hides again when the closing CTA is on screen,
    and reserves `padding-bottom` so it never covers the footer. Black CTA with an orange
    arrow, frosted paper background via `rgba(var(--bg-rgb), .82)` + `backdrop-filter`,
    `bottom: calc(10px + env(safe-area-inset-bottom))`. The page's only floating layer.

## 7. New candidates T, U, V

Each has its own concept, composition and flow, different from S and from round 1. Each
passes the 5-second test at 375×667 in both languages, obeys §3, and has a one-line note.
Make them as polished as S. You may add **one** more direction of your own if it tests a
hypothesis these three don't. Don't add more than that. Four finished candidates beat
six unfinished ones.

### T · "Sua vez" / "Your turn". Hypothesis: learning by doing beats watching

- **Concept:** the visitor logs the last set themselves and sees the engine answer. The
  hero is a live ledger: sets 1–2 are filled (60 × 10 · RIR 2 on Supino com barra,
  3 × 8–10), and set 3 has two 44px steppers for reps (6–10) and RIR (0–3) plus a
  "Registrar série" button. Pressing it reveals the next load, the verdict label and the
  rule sentence.
- **Truth mechanism:** before building, run the engine over the full reps × RIR grid for
  set 3 (5 × 4 = 20 cases) and embed the results as a JSON table. The page never guesses.
  Commit the generator script as `round-2/engine-grid.mjs`. If some grid cells give
  verdicts the copy can't explain in one line, shrink the grid. Don't paper over it.
- **Composition:** almost no scroll. Hero with the interactive card, one line of
  headline above it, CTA directly below the result. Then a compact "three ways to start"
  list, a two-line privacy statement, and the footer. Target ≤ 3 screens.
- **Must not** look like a calculator widget. It's the app's own ledger rows and dials
  in miniature, using DESIGN.md's numeric group.

### U · "Seis semanas" / "Six weeks". Hypothesis: showing the outcome over time sells the benefit

- **Concept:** one lift followed across a real 6-week block. Scrolling moves through the
  sessions, a hairline load chart draws in step, and each session shows its verdict. The
  sequence has to include at least one *Manter* and one *Reduzir*, because progress that
  only ever goes up looks fake.
- **Truth mechanism:** generate the sequence by iterating the engine. Each session's
  logged sets are plausible performance at the target the engine gave, with the
  deliberate misses stated in the script. Commit it as `round-2/six-weeks.mjs`, and label
  the chart "Exemplo calculado pelo motor do Taurifer".
- **Composition:** a vertical timeline (scroll position = time) with the chart pinned in
  the upper third while session cards scroll beneath. The pin releases after week 6. The
  primary CTA and the risk reducers sit in the hero above the timeline, and the sticky
  CTA takes over. No horizontal scroll, and no scroll-jacking: native scroll only, with
  the chart driven by IntersectionObserver thresholds.
- **Tone:** it's the Progresso tab's language, the load line and the verdicts, not a
  fitness-transformation story. No before/after bodies, no percentages of strength gain.

### V · "Duas telas" / "Two screens". Hypothesis: a free product with no account converts best on a very short page

- **Concept:** the whole pitch fits in two screens at 375×667. Screen 1: headline, a
  one-sentence lede, the primary CTA, the meta row, and the real `focus` screenshot
  bleeding off the bottom edge. Screen 2: the three routes as a three-row hairline list
  (each row a text description, not a button), the privacy statement, and a second CTA.
- **Everything else** (the worked example, FAQ, install steps, the assistant hand-off)
  sits behind one "Como funciona / How it works" disclosure. The page is fully usable
  without opening it.
- **Composition:** screenshot-dominant, big type, no section numbers, no cards except
  the one list. This is the control for testing whether S's length matters. Make it
  just as polished, not a stripped-down S.

## 8. Where this brief corrects the source prompts

- The segment labels are the app's verdict labels, **Aumentar carga · Manter · Reduzir /
  Add load · Hold · Back off**. The earlier suggestions "Subir / Manter / Recuar" and
  EN "Reduce" aren't app labels: `rec.reduce.label` is "Back off" in EN.
- "Colar meu treino / Paste my program" CTA: **leave it out.** No deep link to "Colar de
  qualquer lugar" exists (only `?goto=<day>`). Deep-linking entry routes (e.g.
  `?start=build|track|paste`) would be an app change, outside this exploration. Raise it
  as a follow-up and don't implement it here.
- "Privacidade" can't link to the in-app Privacy page, because it's a dialog with no URL.
  It links to the page's data section, which points to Ajustes → Detalhes de privacidade.
- The anonymous-usage row says **opt-in**. "Never leaves the device" allows for the
  install-transfer exception.
- The second prompt's S had 12 sections, which brings back the length problem the review
  flagged. Sections 02 and 03 are merged, "For coaches" moved into the FAQ, and a scroll
  budget added.
- Round-1 A's "reps start again at 8" is phrased per case, not as a rule. "No number was
  adjusted" is dropped unless the page computes the result live.
- The round-1 page stays untouched and linked for comparison, not embedded.

## 9. Before you hand it back

Run through this for **every candidate, PT then EN, at 360, 375 and 430px wide**
(Playwright with `executablePath: '/opt/pw-browsers/chromium'`, or the pinned `test/`
deps):

- [ ] 5-second test at 375×667: product, audience and primary CTA show without scrolling.
- [ ] No headline orphans at 360px, and no horizontal page scroll at any width.
- [ ] Every interactive element works by touch and keyboard, has a visible focus ring,
      and is at least 44px (check with `getBoundingClientRect`).
- [ ] Reduced motion shows end states and every demo still makes sense.
- [ ] Sticky CTA: hidden in the hero, shown after it, hidden at the closing CTA, never
      overlapping content, clear of the safe area.
- [ ] Grep the PT strings for the banned words, `!`, `—`, "quatro", "coach", "streak".
- [ ] Every number goes through `Intl.NumberFormat`, and every exercise name matches
      `exercises.js`.
- [ ] Every engine claim traces to §5 or a committed generator script.
- [ ] No screenshot is clipped under the dynamic island, and each image matches the page
      language.
- [ ] Deep links (`#S-pt`, `#V-en`) load the right state, and switching leaves no
      running timers or observers (log `track()` registry size).
- [ ] Full-page screenshots of each candidate in both languages at 375px, for the PR.

**Delivery:** serve the repo root (`python3 -m http.server 8000`), expose it with
`cloudflared tunnel --url http://localhost:8000`, and send the
`…trycloudflare.com/docs/design/landing-candidates/round-2/` URL with the one-line
notes and S marked as the recommended synthesis. Commit the page, the generator scripts
and the screenshots. Don't touch `sw.js`, `index.html`, `app.js` or the UI screen
catalog: this page isn't precached and isn't part of the app.
