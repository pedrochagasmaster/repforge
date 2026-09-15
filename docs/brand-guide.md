# Taurifer brand guide

This is the working reference for anyone — human or agent — touching UI copy,
visuals, icons, or names in this repo. It states what the brand is, the rules
that keep it consistent, and where the machine-readable sources of truth live.
Rationale for the decisions here is recorded in
[ADR 0004](adr/0004-taurifer-rebrand-neutral-copy.md); the enforcement summary
agents always load is in `AGENTS.md`.

## Identity

Taurifer is a local-first progressive-overload tracker for calm, focused
training. Ordinary training data stays on this device; Taurifer never
uploads it except through the explicit one-hour install transfer
([ADR 0013](adr/0013-temporary-install-transfer.md)) or opted-in telemetry. A coach may choose to put a program, its settings, and the app
language into a URL they send themselves — never workout history. That is
a setup link, not an account or a backend (see
[First-run modes](#first-run-modes); [ADR 0007](adr/0007-shared-setup-links.md)).
The product's personality is a quiet training partner: it records,
computes, and suggests — it does not celebrate, motivate, or entertain.

**Name origin (internal background — never user-facing).** *Taurĭfer* is a
Latin adjective meaning "bull-bearing". The name nods to Milo of Croton, who
carried the same calf every day as it grew until he was carrying a bull —
the oldest story about progressive overload. This etymology explains why the
app icon is a bull-horned monogram, and it stops there.

**The rule: the theme never appears in working surfaces.** No bull, calf,
carrying, forge, or Latin in any string, in any language — not in copy, alt
text, tooltips, notifications, export contents, or store metadata. Themed copy
was implemented and deliberately reverted (see ADR 0004). Its permitted
surface is the app icon (see [The mark](#the-mark)). The landing uses the mark
and wordmark as identity, but Plan 054 retired the Milo illustration and themed
passage from the shipped surface.

## Ethos

The belief the product exists to serve, stated once. It retells the Milo
story in plain life terms — no training vocabulary — so it holds for anyone
building anything slowly. The canon below is internal: never quote it in app
copy, and use it to judge decisions. ADR 0006 once permitted a distilled
first-run rendering; Plan 054 and the owner's selected landing target retired
that exception:

| Key | English | Portuguese |
| --- | --- | --- |
| `setup.ethos.title` | Strength isn't something you're born with. | Força não vem de nascença. |
| `setup.ethos.body` | Challenge after challenge. / Day after day. / Every time you go beyond / what you thought possible, / the effort shapes you. // It becomes part of / who you are. / And you become who you needed to be. // Strength, then, is yours — / not because it was given to you, / but because you built it. | Desafio após desafio. / Dia após dia. / Toda vez que você vai além / do que julgava possível, / o esforço molda você. // Ele passa a fazer parte / de quem você é. / E você se torna quem precisou ser. // A força, então, é sua — / não porque lhe foi dada, / mas porque você a construiu. |

The table records the retired rendering verbatim so historical screenshots and
ADR 0006 remain interpretable. The strings are not referenced by production
markup. `assets/brand/milo-hero.webp` remains an owner-licensed archival source;
it is not referenced or precached. Current landing rules live in
[First-run modes](#first-run-modes).

> Strength isn't something you're born with.\
> It's something you build.\
> Day after day.
>
> The load grows a little every day.\
> Never enough to notice.\
> Just enough to matter.\
> You grow with it.\
> Until one day you're carrying what once seemed impossible.
>
> What you carry shapes you.\
> It becomes part of you.\
> You become what you had to become.
>
> There was never a day you became strong.\
> Only days you didn't put it down.
>
> To those who see your daily effort, nothing about you is sudden.\
> To everyone else, you're unrecognizable.
>
> Strength will be your gift.\
> Not because anyone gave it to you —\
> no one could.\
> You built it.\
> Day after day.

## First-run modes

The Plan 054 landing (`#firstRun`) is the one-time threshold into an empty
device. It uses warm paper, ink, burnt orange, the Taurifer lockup, an editorial
headline, and a live HTML product loop showing prescription, logged sets, and a
derived next target. The owner-selected reference and hash live in
`docs/design/plan-054-landing-directions.md`; the reference photograph does not
ship.

**Generic** — no shared setup source. It renders only while no program,
content, or history exists and `repforge_ui_v1.entryLandingSeen` is not true.
Build my workout and I already have my workout are the early entry actions.
Privacy opens the existing disclosure surface. A later empty visit boots the
ordinary Today/Program no-program states.

**Shared valid** — a valid setup proposal on an eligible device. The headline
explains that the received program is ready, and one Start this program action
identifies it by name and day count. The landing remains the consent boundary:
Start accepts the handoff into the owned editable preview while active durable
state stays untouched. The preview's explicit Use this program action is still
required for activation.

**Shared invalid** — an invalid or unsupported link says that it cannot be used
and that nothing was saved, retains the specific live-region reason, and offers
the safe generic entry actions. It does not consume `entryLandingSeen`.

Shared captions remain localized rather than assembled from fragments:

| Key | English | Portuguese |
| --- | --- | --- |
| `setup.shared.title` | Start this program | Começar este programa |
| `setup.shared.cap_one` | {name} · 1 day per week | {name} · 1 dia por semana |
| `setup.shared.cap_many` | {name} · {n} days per week | {name} · {n} dias por semana |

Use `cap_one` when `n === 1` and `cap_many` otherwise. Do not assemble the
caption from English fragments. Payload-derived names go through
`textContent`. An invalid, oversized, or unsupported link returns to
standard controls plus an inline error; it does not write application
state.

Existing configured state — onboarded metadata, any log rows, or any
`programHistory` — does not reopen this gate and does not apply the
proposal.

Plan 054 P3 owns only the landing and routing above. Later packets still own
install timing, contextual guidance, and the cached Privacy page.

**What a setup link shares.** The in-app share sheet states the exact
claim before the coach acts; do not strengthen or soften it in other
copy, and do not paste it into the outbound system share or the
clipboard:

| Key | English | Portuguese |
| --- | --- | --- |
| `program.share_setup_sub` | Program, settings and app language · no workout history | Programa, ajustes e idioma do app · sem histórico de treinos |
| `program.share_setup_body` | The link shares this program, its configuration, eight selected settings, and the app language. It does not include workout history. For iOS installation, a temporary cookie stores the compressed proposal. The static host receives that cookie with matching index.html requests for up to seven days. Compression and encoding do not encrypt the proposal. | O link compartilha este programa, sua configuração, oito ajustes selecionados e o idioma do app. Ele não inclui o histórico de treinos. Para instalar no iOS, um cookie temporário armazena a proposta comprimida. O host estático recebe esse cookie com as requisições correspondentes de index.html por até sete dias. A compressão e a codificação não criptografam a proposta. |

Outbound Share link is title plus URL only. Copy link is the URL only. The
Share sheet stays task-only: privacy and transport explanations live on the
cached in-app Privacy page (linked from the landing page and Settings, never
from Share), and per-row repair keeps a blocked share actionable without
leaving the task (G-17, G-45–G-46; Plans 054, 057).

The URL is a bearer capability the coach sends. Encoding is not encryption
and not proof of identity. Taurifer never uploads ordinary workout data
except through the explicit one-hour install-transfer exception
([ADR 0013](adr/0013-temporary-install-transfer.md)) or opted-in telemetry;
the cached in-app Privacy page is the canonical user disclosure for both.
The fragment is local-first and unencrypted. Workout logs, completed
sessions, prior blocks, notification permission, and device UI
preferences never travel with the link. A temporary `repforge_setup_v1`
cookie — the historical name, kept even when the value is a `v2.` or `v3.`
envelope — exists only so iOS 17.2+ Add to Home Screen can recover the
same proposal. It is compressed, not encrypted, is sent to the static
host with matching app-page requests for up to seven days, and is not
training history. Do not claim physical iOS validation from this
document.

## Voice and copy

Taurifer states facts and offers next steps, in second person, with no hype.
A saved workout is "saved", not an achievement; an empty screen says what to
do next, not how to feel about it.

Real pairs from the reverted themed copy — the left column ships today:

| Write | Not | Key |
| --- | --- | --- |
| Workout saved. {n} {sets} logged. | Workout carried — … | `toast.workout_forged` |
| Session saved | Session forged | `summary.eyebrow` |
| steady *(gauge idle label)* | graze | `top.gauge.forge` |
| Nothing logged yet | Every bull starts as a calf | `stats.empty.title` |
| No sessions yet. Start your first on the Today tab. | … Carry your first … | `history.empty.sessions` |
| *(nothing under the Settings app name)* | taurĭfer — bull-bearing | `settings.identity_gloss` (deleted) |

Mechanics, all verifiable against the current catalogs:

- **Sentence case everywhere** — titles, buttons, tabs, toasts. Capitals only
  for sentence starts and proper nouns (Taurifer, Today, PR).
- **No exclamation marks.** Both catalogs have zero today; keep it that way.
- **Toasts are complete sentences ending in a period.** Put compound facts in
  separate sentences: "Workout saved. {n} {sets} logged."
- **App prose uses periods and commas, not em dashes.** Do not replace an em
  dash with parentheses, an en dash, or a spaced
  hyphen. En dashes remain valid inside numeric ranges, where they mean "to".
  Use straight quotes in UI copy.
- **Name the fact or action.** Avoid metaphor labels, promotional claims,
  generic summaries, passive voice, and adverbs that hide an unmeasured claim.
  If the same sentence could describe any app, make it specific or remove it.
- **Placeholders are lowercase curly tokens** (`{n}`, `{unit}`, `{name}`).
  Translate around them; never build sentences by concatenation.
- **Every string ships in English and Portuguese together.** Edit
  `i18n-en.json` and `i18n-pt.json`, then mirror both into `i18n.js` (the
  runtime dictionary). `test/i18n.mjs` fails on missing keys, key-set or
  placeholder mismatches, and drift between the JSON catalogs and `i18n.js`.
- **Copy names the control it points at.** When a string tells someone to press
  something, it repeats that control's own label: `log.unfinished.body` names
  `log.finish`. Contextual-guide copy follows the same rule for its anchored
  action. `test/i18n.mjs` checks these relationships in both languages, so
  renaming a button breaks the guidance that refers to it.
- **Portuguese uses você** and translates meaning, not words — same calm,
  direct tone as English, no literal calques (also audited by `test/i18n.mjs`).
- **Portuguese keeps one word per thing, and it is a Portuguese word.** The
  Progress tab is Progresso, the saved sessions are the histórico, a counted set
  is a série efetiva, and gym hardware is equipamento. `stats`, `log`,
  `performance`, `delta`, `split`, `offline` and `aparelho` do not ship in
  Portuguese copy; `test/i18n.mjs` fails on them. Loanwords that Brazilian
  Portuguese has absorbed stay: backup, timer, deload, PR, RIR, e1RM.
- **Portuguese agrees in number and gender at every count.** A string that a
  count of one can reach cannot carry a plural verb or adjective: write
  "{n} com melhora", not "{n} melhoraram". Exercise names agree with their head
  noun ("Barra fixa assistida", not "assistido") — for library names that means
  a `namePt` override in `tools/exercise-curation.json`, never an edit to the
  generated `exercises.js`.
- **i18n keys are frozen codenames.** Values change; keys never do —
  `toast.workout_forged` holds "Workout saved" and that is correct. Renaming
  keys breaks `data-i18n` bindings and churns three files for zero user value.

## Color and type

The identity colors, anchored here because they are the brand:

| Role | Hex | Token |
| --- | --- | --- |
| Paper (background) | `#F4F2EF` | `--bg` |
| Ink (text) | `#1B1A17` | `--ink` |
| Accent (burnt orange) | `#E04E14` | `--accent` (deep: `#B8410E`) |
| Positive (PRs, progress) | `#2F7D33` | `--positive` |
| Danger (destructive) | `#C93A2B` | `--danger` |

Type: **Plex Sans** (variable, 100–700) for display and body; **Plex Mono**
(400/500/600) for numeric data — weights, reps, timers. Fonts are self-hosted
woff2 files; no external font services.

Principles the tokens can't express:

- One accent, used sparingly — emphasis, primary actions, small highlights.
  Never decorative washes or large orange fields.
- Page content stays flat: hairlines (`--rule`) separate content, whitespace
  groups it. Depth is allowlisted by semantic role only — `flat`, `selected`,
  `floating`, `modal`, and `persistent-action` as defined in
  [ADR 0012](adr/0012-ui-overhaul-canonical-reconciliation.md). Anything outside
  those roles stays flat, and nested-card tunnels (a card inside a card inside
  a card) are prohibited everywhere.
- Shadows draw only the allowed elevation roles, accent focus rings, and inset
  hairlines. No decorative gradients — the two in the CSS are functional (a
  select chevron and a sticky-nav scroll fade).
- The light editorial look depends on restraint: warm paper, near-black ink,
  generous whitespace.

Dark appearance carries the same material grammar rather than introducing a
second visual identity: warm charcoal paper, off-white ink, ember orange,
hairlines and whitespace. Working-surface primary actions use a quiet parchment
inversion. The one-time landing's owner-selected burnt-orange CTA is the
approved exception. Artwork painted on cream — the exercise illustrations and
the ground-free mark — keeps that paper as a deliberate archival
plate with a corner of its own, rather than being inverted, tinted, dimmed, or
dissolved into charcoal with a gradient. Repeated status markers should not all
glow on charcoal; a repeated *signal* is a different thing from a repeated glow,
though, and the Attention board keeps its orange dot in both themes because the
count above it is measured in that colour. The canonical values and rationale
live in `styles.css` and
[`ADR 0009`](adr/0009-appearance-setting-dark-theme.md).

`styles.css` `:root` is canonical for every value. If this document and the
CSS disagree, the CSS wins — fix this document.

## The mark

The app icon is a charcoal monogram: a letter T whose crossbar sweeps up into
bull horns, cut with a burnt-orange edge, resting on the warm paper ground.
It is the one place the name's origin is allowed to show.

- `icons/icon.svg` is **generated output, not source** — 9,233 vector paths.
  Never hand-edit it and never run optimizers (SVGO etc.) on it; a new mark
  replaces the file wholesale.
- The raster assets (favicon, 192/512/1024, maskable, Apple touch, splash
  screens) are **compositions, not resizes** — the maskable variant keeps the
  full mark inside the safe circle, and splash screens place the isolated mark
  on the paper background. Regenerate per `icons/README.md`; never with an
  ad-hoc downscale.
- `assets/brand/mark.png` is the same mark **with the paper ground dropped**,
  for the one place inside the app that stands it on the page: the landing
  header, where mark and wordmark form the left side of the utility row. It
  is derived from `icons/icon.svg` by
  `tools/build-brand-mark.mjs`, which removes the single full-bleed ground rect
  and rasterises the rest — so it is generated output twice over. Re-run it
  when a new mark lands; never hand-edit or hand-crop it, and never use the app
  icon in that row: its ground reads as a plate against the app's paper. That
  reasoning is about cream. The rendering keeps a pale edge where its ground was
  taken away, so on charcoal the gate paints the paper back under it as a plate
  rather than leaving a smudge on the dark page — the same answer dark gives
  the exercise artwork.
- The mark carries **no themed text**: no caption, tooltip, or alt text about
  bulls or bearing. The Settings identity mark ships `alt=""`.

## UI glyphs

The interface glyphs are a separate system from [the mark](#the-mark) and carry
none of its meaning: they are wayfinding, not identity. They live as CSS mask
data URIs on `.icon-mask--*` in `styles.css`, painted with `currentColor`, so a
selected card, a copper section label, and dark mode all recolour them for free.
Never introduce one as a `<img>`, an emoji, or a font glyph — a mask is the only
form that follows the ink.

The drawing rules, so a row of them reads as one weight rather than a scrapbook:

- **24 grid, 20 live area.** Every shape sits inside a 2-unit margin, and is
  optically centred rather than mathematically centred — a wand on a diagonal
  and a wide dumbbell both have to look centred at 28px.
- **1.75 stroke, round caps, round joins.** One weight for the whole set. Solid
  fills are reserved for shapes a stroke cannot carry (the wand's sparkles); the
  rest are outlines.
- **The metaphor is literal.** A bicep for muscle, a balance for the trade-off,
  a dumbbell for strength, a kettlebell that is a ball with a handle. A glyph
  that needs its label to be understood is not finished.
- **Drawn for its display size, not for the artboard.** The entry glyphs render
  at 18–28px; interior detail that survives at 64px and mushes at 26px (a
  narrow handle hole, a crowded window grid) is drawn larger or dropped.

A new glyph is checked at 18, 22 and 28px against the set before it lands,
not just at full size, and the change is followed by the usual UI-screen capture
(see `AGENTS.md`).

## Naming surfaces

One decision, two vocabularies: **Taurifer** is the brand users see;
**repforge** is the frozen internal codename that keeps existing installs and
their data working. The split is deliberate (ADR 0004), and `AGENTS.md`
carries the short enforcement note.

| Surface | Value | Rule |
| --- | --- | --- |
| Manifest `name`/`short_name`, `<title>`, iOS web-app title | Taurifer | Brand |
| Notification titles, share titles, UI copy naming the app | Taurifer | Brand |
| Export filenames | `taurifer_*` (`log`, `program`, `backup`, `copy_a`/`copy_b`) | Brand, lowercase |
| localStorage keys | `repforge_v1`, `repforge_draft_v1`, `repforge_pending_v1:*` | Codename — frozen |
| IndexedDB database / store | `repforge` / `kv` | Codename — frozen |
| Setup-link handoff cookie | `repforge_setup_v1` | Codename — frozen, including when the value is a `v2.` or `v3.` envelope |
| Service-worker cache prefix | `repforge-vNN` (bump `NN` only) | Codename — frozen |
| Cross-tab lock name | `repforge:state-write` | Codename — frozen |
| JS globals and test hooks | `RepForgeI18n`, `RepForgeSchedule`, `RepForgeNotify`, `RepForgeSharedSetup`, `window.__repforge*` | Codename — frozen |
| i18n keys | e.g. `toast.workout_forged` | Codename — frozen |
| Repository slug, GitHub Pages URL | `pedrochagasmaster/repforge` | Codename — frozen |

Renaming any codename surface orphans on-device training data, breaks
installed-PWA scope, or silently detaches tests. New user-facing surfaces use
the brand; new internal identifiers stay in the `repforge` namespace so the
codebase keeps one codename, not two.
