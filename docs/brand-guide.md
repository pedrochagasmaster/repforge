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
uploads it. A coach may choose to put a program, its settings, and the app
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
was implemented and deliberately reverted (see ADR 0004). The theme's
permitted surfaces are exactly two: the app icon (see [The mark](#the-mark))
and the first-run gate's ethos hero (see [Ethos](#ethos); ADR 0006).

## Ethos

The belief the product exists to serve, stated once. It retells the Milo
story in plain life terms — no training vocabulary — so it holds for anyone
building anything slowly. The canon below is internal: never quote it in app
copy, and use it to judge decisions. Its one user-facing rendering is the
distilled passage on the first-run gate's hero (ADR 0006) — a threshold the
app crosses once, never a working surface:

| Key | English | Portuguese |
| --- | --- | --- |
| `setup.ethos.title` | Strength isn't something you're born with. | Força não vem de nascença. |
| `setup.ethos.body` | Challenge after challenge. / Day after day. / Every time you go beyond / what you thought possible, / the effort shapes you. // It becomes part of / who you are. / And you become who you needed to be. // Strength, then, is yours — / not because it was given to you, / but because you built it. | Desafio após desafio. / Dia após dia. / Toda vez que você vai além / do que julgava possível, / o esforço molda você. // Ele passa a fazer parte / de quem você é. / E você se torna quem precisou ser. // A força, então, é sua — / não porque lhe foi dada, / mas porque você a construiu. |

The body is the one string in the app that is **set, not just written**: it is
typeset in the mono face as a short poem, and `/` above marks a line break
(`\n` in the catalogues, `//` a stanza break). The breaks are part of the copy
and travel with the translation — a wrapped-wherever-it-lands version of this
passage is a different passage.

The illustration is never cropped and never leaves the page: **neither the copy
nor the picture gives.** They occupy separate grid areas. On compact screens
the complete picture is a centred beat between the title and poem; at 760 px
and above it moves into a dedicated column beside both. Its box keeps the
export's exact aspect ratio and paints it with `background-size:contain`, so no
part of the drawing can be clipped or stretched.

The written breaks still have to fit as written, in both languages, at every
supported width. A translation is re-broken by hand rather than allowed to
wrap wherever the browser happens to find room. `node test/install-modes.mjs`
counts the rendered lines against the written ones and also checks text/art
separation, aspect ratio, containment, lockup prominence, horizontal overflow,
and continuous type sizing across the responsive breakpoint. The poem is sized
for legibility and centred within a `40ch` measure; the remaining side margin is
intentional, not a space the type must fill.

On a 390 px first-run screen the complete picture remains at least 240 px wide.
That choice means the install card may begin below the first screen, but the
introduction to the setup controls must remain visible there and the first
control must stay within a short scroll (at most 1.15 screens).

The hero's illustration — the calf-carrier grown into the bull-carrier — lives
at `assets/brand/milo-hero.webp`: owner-supplied, decorative, painted by CSS so
an absent export leaves paper rather than a broken image, replaced wholesale
like the mark, precached like every asset. No placeholder icons, initials, or
silhouettes ever stand in for it (the same line the exercise tiles hold). It is
white-balanced onto `--bg` so the file's own rectangle disappears into the page
— the same problem the exercise detail page solves with a `mediaBg` field, made
cheaper here by there being one file. How it was produced, and how
to replace it, is in `assets/brand/README.md`. Past the gate, the app stays
quiet so the record can speak.

Shared setup links (ADR 0007) switch only the program-choice rows that
follow this hero. They do not change the title, poem, illustration, brand
lockup, installation card, installation sheet, or responsive composition.

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

The first-run gate (`#firstRun`, "Set up Taurifer") is the theme's second
permitted surface and the one door into a first program. It has two
program-choice modes. The hero rules in [Ethos](#ethos) and ADR 0006 apply
to both; shared mode must not restyle or crop them.

**Standard** — no shared setup source. The install section behaves as ADR
0005. The program section is two equal rows: Create a program and Import a
program. Ledes stay `setup.lede` / `setup.lede_installed`.

**Shared** — a valid setup proposal on a first run with no archived
program history. The install section, hero, and lockup are unchanged. Create
and Import are hidden. One Start this program row identifies the proposal
by name and day count. The gate itself is the confirmation; there is no
second preview or exercise-mapping review. Ledes and the row:

| Key | English | Portuguese |
| --- | --- | --- |
| `setup.shared.lede` | Install the app, then start your program. | Instale o app e comece seu programa. |
| `setup.shared.lede_installed` | Your program is ready. | Seu programa está pronto. |
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

**What a setup link shares.** The in-app share sheet states the exact
claim before the coach acts; do not strengthen or soften it in other
copy, and do not paste it into the outbound system share or the
clipboard:

| Key | English | Portuguese |
| --- | --- | --- |
| `program.share_setup_sub` | Program, settings and app language · no workout history | Programa, configurações e idioma do app · sem histórico de treinos |
| `program.share_setup_body` | The link shares this program, its configuration, eight selected settings, and the app language. Workout history is not included. A temporary cookie keeps the compressed proposal for iOS installation and is sent to the static host with matching index.html requests for up to seven days. Compression and encoding are not encryption. | O link compartilha este programa, sua configuração, oito ajustes selecionados e o idioma do app. O histórico de treinos não é incluído. Um cookie temporário guarda a proposta comprimida para a instalação no iOS e é enviado ao host estático com as requisições correspondentes de index.html por até sete dias. Compressão e codificação não são criptografia. |

Outbound Share link is title plus URL only. Copy link is the URL only.

The URL is a bearer capability the coach sends. Encoding is not encryption
and not proof of identity. Taurifer never uploads ordinary workout data.
The fragment is local-first and unencrypted. Workout logs, completed
sessions, prior blocks, notification permission, and device UI
preferences never travel with the link. A temporary `repforge_setup_v1`
cookie — the historical name, kept even when the value is a `v2.`
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
| Workout saved — {n} {sets} logged. | Workout carried — … | `toast.workout_forged` |
| Session saved | Session forged | `summary.eyebrow` |
| steady *(gauge idle label)* | graze | `top.gauge.forge` |
| Nothing logged yet | Every bull starts as a calf | `stats.empty.title` |
| No sessions yet. Start your first on the Log tab. | … Carry your first … | `history.empty.sessions` |
| *(nothing under the Settings app name)* | taurĭfer — bull-bearing | `settings.identity_gloss` (deleted) |

Mechanics, all verifiable against the current catalogs:

- **Sentence case everywhere** — titles, buttons, tabs, toasts. Capitals only
  for sentence starts and proper nouns (Taurifer, Log, PR).
- **No exclamation marks.** Both catalogs have zero today; keep it that way.
- **Toasts are complete sentences ending in a period.** Compound facts join
  with an em dash: "Workout saved — {n} {sets} logged."
- **Placeholders are lowercase curly tokens** (`{n}`, `{unit}`, `{name}`).
  Translate around them; never build sentences by concatenation.
- **Every string ships in English and Portuguese together.** Edit
  `i18n-en.json` and `i18n-pt.json`, then mirror both into `i18n.js` (the
  runtime dictionary). `test/i18n.mjs` fails on missing keys, key-set or
  placeholder mismatches, and drift between the JSON catalogs and `i18n.js`.
- **Portuguese uses você** and translates meaning, not words — same calm,
  direct tone as English, no literal calques (also audited by `test/i18n.mjs`).
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
- Hairline rules (`--rule`) separate content; no cards, no borders-as-boxes.
- No drop shadows on surfaces (`--shadow: none` is deliberate); `box-shadow`
  appears only as accent focus rings and inset hairlines. No decorative
  gradients — the two in the CSS are functional (a select chevron and a
  sticky-nav scroll fade).
- The light editorial look depends on restraint: warm paper, near-black ink,
  generous whitespace.

Dark appearance carries the same material grammar rather than introducing a
second visual identity: warm charcoal paper, off-white ink, ember orange,
hairlines and whitespace. Its primary action is a quiet parchment inversion,
not a large orange field. Exercise illustrations keep their own sampled paper
as lit archival plates; never invert, tint, or dim the licensed drawings.
Repeated status markers should not all glow on charcoal — let one orange signal
carry the hierarchy and render repetition in soft ink. The canonical values and
rationale live in `styles.css` and
[`ADR 0009`](adr/0009-appearance-setting-dark-theme.md).

`styles.css` `:root` is canonical for every value. If this document and the
CSS disagree, the CSS wins — fix this document.

## The mark

The app icon is a charcoal monogram: a letter T whose crossbar sweeps up into
bull horns, cut with a burnt-orange edge, resting on the warm paper ground.
Outside the first-run hero (see [Ethos](#ethos)), it is the one place the
name's origin is allowed to show.

- `icons/icon.svg` is **generated output, not source** — 9,233 vector paths.
  Never hand-edit it and never run optimizers (SVGO etc.) on it; a new mark
  replaces the file wholesale.
- The raster assets (favicon, 192/512/1024, maskable, Apple touch, splash
  screens) are **compositions, not resizes** — the maskable variant keeps the
  full mark inside the safe circle, and splash screens place the isolated mark
  on the paper background. Regenerate per `icons/README.md`; never with an
  ad-hoc downscale.
- `assets/brand/mark.png` is the same mark **with the paper ground dropped**,
  for the one place inside the app that stands it on the page: the first-run
  gate's brand row, where mark and wordmark sit **centred** on the column. It
  is derived from `icons/icon.svg` by
  `tools/build-brand-mark.mjs`, which removes the single full-bleed ground rect
  and rasterises the rest — so it is generated output twice over. Re-run it
  when a new mark lands; never hand-edit or hand-crop it, and never use the app
  icon in that row: its ground reads as a plate against the app's paper.
- The mark carries **no themed text**: no caption, tooltip, or alt text about
  bulls or bearing. The Settings identity mark ships `alt=""`.

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
| Setup-link handoff cookie | `repforge_setup_v1` | Codename — frozen, including when the value is a `v2.` envelope |
| Service-worker cache prefix | `repforge-vNN` (bump `NN` only) | Codename — frozen |
| Cross-tab lock name | `repforge:state-write` | Codename — frozen |
| JS globals and test hooks | `RepForgeI18n`, `RepForgeSchedule`, `RepForgeNotify`, `RepForgeSharedSetup`, `window.__repforge*` | Codename — frozen |
| i18n keys | e.g. `toast.workout_forged` | Codename — frozen |
| Repository slug, GitHub Pages URL | `pedrochagasmaster/repforge` | Codename — frozen |

Renaming any codename surface orphans on-device training data, breaks
installed-PWA scope, or silently detaches tests. New user-facing surfaces use
the brand; new internal identifiers stay in the `repforge` namespace so the
codebase keeps one codename, not two.
