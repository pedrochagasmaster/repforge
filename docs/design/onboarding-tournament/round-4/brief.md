# Round 4 brief — bold onboarding directions

## Why this round exists

Rounds 1–3 varied open items inside one layout, and G (Round 3) is today's
onboarding polished and fixed. The owner judged that too timid: every
candidate must now test a genuinely different idea of what onboarding is, in
its own committed visual world, at the finish level of a professional product
(as in the landing rounds, PRs #252/#254/#276, and the main-screen rounds, PRs
#259/#264). G stays in the harness as the conventional baseline.

Owner decisions for this round:

1. A direction **may reopen a closed product decision** (PD-1, PD-4, or the
   question set) if it declares it openly: in its header, in
   `policy.productDecisions`, and in its notes.
2. **Each candidate owns its visual world**: palette, type, material, motion.
   Product truth, brand rules and accessibility floors still bind.
3. **Core journey, maximum polish** (below). Other states come later.
4. **The owner picks** what advances, assisted by a finish review and the
   acceptance floor.

## Process (Impeccable, code-led; the concept roll ran degraded, seed 41ef581f)

Each builder builds **one** direction, fully committed, following the
Impeccable skill at `.claude/skills/impeccable/`:

1. Read `PRODUCT.md`, `CONTEXT.md`, `docs/brand-guide.md`, then
   `.claude/skills/impeccable/reference/new-work.md` §4–§7 and
   `reference/onboard.md`. Read `reference/craft-floor.md` immediately before
   the first UI edit.
2. **Record the direction contract** (THESIS, OWN-WORLD, STORY, FIRST
   VIEWPORT, FORM with list position and seed key `41ef581f`, FINISH) in the
   surface brief:
   `.claude/skills/impeccable/scripts/impeccable surface-brief write docs/design/onboarding-tournament/round-4/candidates/<id>.js <body-file>`.
   Read it back once. Never copy the contract into shipped markup.
3. **Build with full commitment**: every atom (buttons, inputs, choices,
   navigation, dialogs, the import states) rebuilt in the world's vocabulary.
   No stock component inside a committed form. Code-led: the ambition lives
   in the contract's FIRST VIEWPORT and one named **signature interaction**.
4. **Inspect once, fix once**: one batched screenshot round (PT light 390,
   PT light 320 at 200% text, EN dark 390, reduced motion), fix everything in
   one batch, confirm with at most one more round.
5. Run the detector once: `.claude/skills/impeccable/scripts/impeccable detect --json <your files>`; fix what is mechanical.
6. Run the acceptance floor until zero hard failures:
   `node docs/design/onboarding-tournament/tools/verify.mjs --round 4 --candidates <id> --out <scratch>`.
7. **Do not write `DESIGN.md`** (it is the app's). Document the world in
   `round-4/candidates/<id>.world.md` (palette with roles and contrast, type,
   components, motion, dark rendition). Do not commit; the orchestrator runs
   the fresh finish review and commits.

## Files and harness contract

- Write only: `round-4/candidates/<id>.js`, `<id>.css`, `<id>.notes.md`,
  `<id>.world.md`, `round-4/assets/<id>/…`, `round-4/fonts/<family>/…`.
- Page: `round-4/app.html?c=<id>&cp=<checkpoint>&lang=pt|en&theme=light|dark&text=100|200&motion=normal|reduced`.
  It loads `tokens.css` and `base.css` before your CSS; override freely.
- **Fonts**: self-host an open-licence family with
  `node docs/design/onboarding-tournament/tools/fetch-font.mjs "Family" "400;700"`
  (writes `round-4/fonts/<slug>/<slug>.css`; link it from your JS or CSS with
  a relative URL). Faces on the craft floor's default list (IBM Plex, Space
  Grotesk, Inter-as-display, DM Sans, Syne, Fraunces, …) need a reason no other
  face could satisfy. No CDN at runtime. No image generation is available:
  author graphics in code (CSS, canvas, small SVG) and keep them truthful.
- **Interface**: `round-2/JOURNEYS.md` (`mount`, `reach`, `entry`, `policy`,
  `journeys`) and §6 (checks K-25–K-32). `round-2/candidates/_example.js` and
  `round-3/candidates/g.js` are working references of the contract, **not**
  designs to follow.
- **Core checkpoints** you must reach and mark with `data-checkpoint` (a
  direction without a chooser marks `route-choice` on whatever offers the
  routes): `landing, route-choice, hub-existing, rec-goal, rec-background,
  rec-schedule, rec-environment, rec-priorities, rec-result,
  rec-env-correction, rec-result-corrected, activate, replace-confirm,
  activation-conflict, cancel-confirm, activated-today, ff-empty, ff-reply,
  ff-gaps, import-review, import-preview`. Any other checkpoint may fall back
  to the nearest view.
- **Core journeys** you must export: `activate.recommend`,
  `activate.import-paste`, `change.days`, `correct.environment`,
  `recommend.required`, `cancel`, `back.recommend`,
  `destroy.review-start-over`, `destroy.paste-restart`,
  `existing.replace-cancel`, `existing.conflict`, `overlays`.
- **Markup the checks read** (keep it whatever your world looks like):
  `data-entry-step`, `data-advance`, `data-activate`,
  `data-change-statement data-changed data-total`,
  `data-persistent-action`, `#firstRunCreate`, `#firstRunImport`,
  `TS.privacyButton` (`data-privacy-open`), answer controls as
  `[data-act="pick"][data-key][data-val]`, import-mode controls as
  `[data-act="import-mode"][data-mode]`, cancel as `[data-act="cancel"]`,
  review Start over as `[data-act="restart"]`, the paste door's Recomeçar as
  `[data-ff="start-over"]`, dialogs with `role="dialog"`/`"alertdialog"`.

## Truth (binding for every direction)

- Every program comes from the real engine through `TF` (`TF.compile`,
  `TF.importResult`, `TF.sharedResult`, `TF.activate`, `TF.readiness`); the
  paste door, gap repair and import review go through `TS.freeform.apply` and
  `TS.importReview.apply` (you may render your own markup for them). Same
  fixtures (Rafael, the import file, the pasted text). No invented numbers,
  no fake AI, no counterpart that pretends to be a person.
- Brand: a quiet training partner. No celebration, scores, streaks, badges;
  no bull, forge or Latin in any string; `CONTEXT.md` terms (program, session,
  capacity…). PT-BR first, EN at full parity.
- Local-first: nothing persists before activation; a replacement archives the
  current program and says so; the conflict state is honest.
- Floors: 44 px targets; 320–430 px; light **and** dark (your world defines
  its dark rendition); 200% text usable; reduced motion coherent; focus kept
  after answers and returned by dialogs; colour never the only signal.

## The five directions

Seed `41ef581f` assigned the lead. Each card is the builder's brief.

### H · Concreto (the roll's assigned lead)
Brazilian concrete poetry and modernist typography (Noigandres, the 1950s
São Paulo concretists): monumental words on a strict grid, black and white
plus one saturated field; the page is a composition, not a form. Each
question is a typographic composition whose answers are words placed in it;
the result is the program set as a poster, days as columns of words.
**Hypothesis:** one huge decision per screen, stated in words the lifter can
see all at once, cuts decision burden and is unforgettable in PT-BR.
**Risk:** legibility at 200% text; drifting into editorial decoration.
**Policy:** none.

### I · Ficha (my top-ranked grounded candidate)
The academy's *ficha de treino*: printed cardstock with a pre-set grid
(EXERCÍCIO · SÉRIES · REPS · CARGA), the instructor's blue-ballpoint hand, the
gym's rubber stamp, a punched hole. The first screen is the lifter's own
blank ficha; each answer is written onto it; the review is the completed
ficha; activation stamps it and hands it over into Today.
**Hypothesis:** watching the program being written makes every question's
purpose visible and builds trust.
**Risk:** the most familiar of the five; skeuomorphic cliché if the craft
slips. **Policy:** none.

### J · Conversa
WhatsApp's interface grammar: bubbles, quick-reply chips, read ticks,
forwarded messages. Taurifer asks in its own voice, the lifter replies with
chips; importing is pasting or forwarding the coach's message into the
thread; the program arrives as a message card.
**Hypothesis:** Brazil's most familiar interface turns setup into "just
reply", and route choice dissolves into the conversation.
**Risk:** must never read as AI or as a person (the brand bans coach and
chatbot language); honesty about deterministic questions.
**Policy:** reopens **PD-1** (no chooser; routes offered in the thread).

### K · Linhas
São Paulo Metrô wayfinding: line colours, station dots, signage type,
pictograms. The start is a line map of the five routes; each step is a
station; switching route is a transfer that keeps the answers.
**Hypothesis:** seeing every route as one network, with cost counted in
stations, solves route comprehension and makes switching safe.
**Risk:** the map must work at 320 px and 200% text. **Policy:** none.

### L · Pino
The machine weight stack: stencilled slabs, the selector pin, black powder
coat, safety yellow. A real program built from labelled defaults ("ainda não
é seu") appears at once; the lifter tunes it by pulling pins (days, minutes,
goal, place, rest), recompiling live; it activates only when every pin has
been set by the lifter.
**Hypothesis:** tuning a live program beats answering a questionnaire.
**Risk:** close to Round 1 C's rejected "defaults first" (activating defaults
must be impossible). **Policy:** reopens **PD-4**.
