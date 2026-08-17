# Taurifer brand guide

This is the working reference for anyone — human or agent — touching UI copy,
visuals, icons, or names in this repo. It states what the brand is, the rules
that keep it consistent, and where the machine-readable sources of truth live.
Rationale for the decisions here is recorded in
[ADR 0004](adr/0004-taurifer-rebrand-neutral-copy.md); the enforcement summary
agents always load is in `AGENTS.md`.

## Identity

Taurifer is a local-only progressive-overload tracker for calm, focused
training. All data stays on the device. The product's personality is a quiet
training partner: it records, computes, and suggests — it does not celebrate,
motivate, or entertain.

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
distilled pair on the first-run gate's hero (ADR 0006) — a threshold the app
crosses once, never a working surface:

| Key | English | Portuguese |
| --- | --- | --- |
| `setup.ethos.title` | Strength isn't given. It's built. | Força não se ganha. Força se constrói. |
| `setup.ethos.body` | Load by load. Day after day. Until you're carrying what once seemed impossible. | Carga a carga. Dia após dia. Até você carregar o que um dia pareceu impossível. |

The hero's illustration — the calf-carrier grown into the bull-carrier —
lives at `assets/brand/milo-hero.webp`: owner-licensed, decorative
(`alt=""`), replaced wholesale like the mark, precached like every asset.
Until the licensed export lands, the hero ships text-only; no placeholder
icons, initials, or silhouettes (the same line the exercise tiles hold).
Landing steps are in `assets/brand/README.md`. Past the gate, the app stays
quiet so the record can speak.

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
| Service-worker cache prefix | `repforge-vNN` (bump `NN` only) | Codename — frozen |
| Cross-tab lock name | `repforge:state-write` | Codename — frozen |
| JS globals and test hooks | `RepForgeI18n`, `RepForgeSchedule`, `RepForgeNotify`, `window.__repforge*` | Codename — frozen |
| i18n keys | e.g. `toast.workout_forged` | Codename — frozen |
| Repository slug, GitHub Pages URL | `pedrochagasmaster/repforge` | Codename — frozen |

Renaming any codename surface orphans on-device training data, breaks
installed-PWA scope, or silently detaches tests. New user-facing surfaces use
the brand; new internal identifiers stay in the `repforge` namespace so the
codebase keeps one codename, not two.
