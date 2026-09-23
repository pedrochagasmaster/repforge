# Product

<!-- impeccable:product-schema 1 -->

Durable product truth for Taurifer. Visual decisions do not live here — see
`docs/brand-guide.md`, `docs/design/`, and the UI screen catalog in
`docs/ui-screens/`. Strategy lives in `docs/business-product-thesis.md`; the
only ordered queue is `docs/backlog.md`; the domain vocabulary that all copy
and code must use is `CONTEXT.md`.

## Platform

web

## Users

The primary user is a **self-directed Brazilian lifter who trains from a
structured program and wants to see that they are progressing**. They train in
a commercial gym, phone in hand, between sets — standing, sometimes sweaty,
often one-handed, frequently on a poor connection or none at all. Their job on
any given day is narrow: see what this training day asks for, log what actually
happened (load, reps, RIR), and know what to aim for next time.

Portuguese is the first language of the primary user. English ships at full
parity, but **design is judged against Portuguese first** — label lengths, text
expansion, truncation, and copy rhythm are validated in PT-BR before EN.
Brazil is the stated beachhead (`docs/business-product-thesis.md`); Taurifer AI
is specified PT-BR-first (ADR 0011).

Secondary, confirmed audiences:

- **The coach or creator** who authors a program and hands it to a lifter
  through a setup link. They never see the lifter's data; the link is one-way.
- **The recipient of a shared program**, who meets the product at the first-run
  gate before anything is written to their device.

The product has no synchronized cohort, no accounts, and no multi-user surface.
Today's real usage is the solo founder plus a rolling one-at-a-time
noncommercial alpha that has not started.

## Product Purpose

Taurifer is a **local-first mobile PWA for progressive overload**. It takes a
lifter from a structured program through execution to a clear next target, and
keeps the training record on the device.

The behavioral loop the product exists to serve:

> Generate or choose → execute → observe → interpret → adapt → transition →
> repeat.

Success is that a lifter finishes a session knowing what the next session asks
of them, and can see over weeks that the numbers moved — without an account,
without a network, and without being sold motivation.

What ships today: program creation, import, and receipt; per-set logging of
load, reps and RIR; deterministic double-progression recommendations; rest
timers and notifications; exercise substitution with performed snapshots; an
exercise library of 270 movements in EN/PT; volume audit; stats and history;
session summaries; block review; JSON/CSV/plain-text export; offline operation.

## Positioning

**Progression-first, not logging-first, and not an AI personal trainer.**

The mechanism a neighboring product could not truthfully copy:

- **Capacity as the single deterministic currency** (ADR 0003). Every
  recommendation derives from what a set demonstrated the lifter *could* have
  done — performed reps plus trusted RIR — never from a motivational model of
  how hard they should push. It is a measurement, not a judgment.
- **Analytical independence as a constitutional rule.** Deterministic training
  outputs derive only from the athlete's program, training record, and declared
  training rules. They are never altered, reworded, reordered, or re-presented
  for commercial benefit. Taurifer may monetize capabilities *around* the
  engine, never control over its conclusions.
- **Local-first by construction, not by policy.** There is no account and no
  sync. Ordinary training data physically cannot leave the device except
  through two explicit, user-initiated paths.
- **One engine for every program.** Generated, template, manual, imported and
  shared programs all converge on the same progression and execution engine
  once they declare the required semantics. A shared program is first-class,
  not a degraded import.

## Operating Context

- **Where:** a gym floor, on a phone, mid-session. Mobile is the only shipped
  form factor and the UI screen catalog is mobile-only on purpose.
- **Network:** assume none. The service worker precaches the shell atomically;
  the app must be fully usable offline, including first launch after install.
- **Interruption:** sessions are logged across rest periods, not in one sitting.
  A write-ahead journal and a cross-tab lock exist because the app is expected
  to be backgrounded, killed, and resumed.
- **Install:** used as an installed PWA (iOS Add to Home Screen, Android
  install prompt) as well as in-browser. Install-mode differences are a
  first-class surface, not an edge case.
- **The one intentional share:** a setup link carries a program, its settings,
  and the app language in the URL `#setup=` fragment. Workout history is never
  included. The link cannot be revoked; encoding is not encryption; there is a
  hard 3,072-character ceiling and notes-heavy payloads are never truncated.
  (ADR 0007.)
- **The one data-moving exception:** the temporary install transfer — an
  informed, encrypted, one-hour backend record that clones state into the
  installed PWA and then deletes itself. It is not sync, backup, or an account.
  (ADR 0013.)
- **Deployment:** static site on GitHub Pages; production analytics builds on
  Cloudflare Pages. Telemetry (PostHog via a managed reverse proxy) is opt-in
  and absent locally and on previews unless explicitly enabled.

## Capabilities and Constraints

**Architectural constraints that bind every future change:**

- **No build step, no package manager, no application dependencies.** Files are
  served as-is. There is no root `package.json` and there must not be one. Test
  and tooling dependencies are pinned under `test/` and `tools/` only.
- **Phase 1 static PWA.** No native shells, no accounts, no cloud sync, no
  hosted history, no general API layer. Minimal infrastructure is permitted
  only where `docs/backlog.md` authorizes it for an approved hypothesis.
- **Motion and drag ship as committed, pinned, tree-shaken vendor bundles**
  (`vendor/motion/`, `vendor/dnd-kit/`). No CDN, no runtime resolution.
  Application code reaches Motion only through `motion-layer.js`.
- **Dark theme is a token swap**, not a second stylesheet. New CSS rules name
  tokens, never raw colours. Appearance lives in device-only UI prefs
  (`repforge_ui_v1`) and never enters export, import, a state proposal, or the
  setup-link allowlist. (ADR 0009.)
- **Generated files are not hand-edited**: `exercises.js`, `i18n.js`, and the
  vendor bundles. Edit the source and re-run the tool.
- **Service-worker cache ritual**: any precached asset change bumps the
  `repforge-vNN` cache name and the `?v=NN` revisions in both `index.html` and
  `sw.js`, held in lockstep by `test/exercise-library.mjs`.
- **The UI screen catalog is a contract.** Any user-visible change must be
  followed by `node tools/capture-ui-screens.mjs` and the refreshed PNGs
  committed with it. CI fails on drift.
- **Internal identifiers keep the historical `repforge` codename** — storage
  keys, IndexedDB name, cache prefix, `RepForge*` globals, repo slug, Pages
  URL. Existing installs depend on them. Only the user-facing brand is
  "Taurifer".
- **Exercise illustrations are a closed set of 96 `.webp` files.** The other 174
  movements render a deliberately empty tile. Do not fill it with icons,
  initials, or silhouettes.
- **Library ids are provenance.** A saved program stores `libraryId`; an id is
  never repointed at a different movement.
- **Muscle tokens are a shared contract** across the volume audit,
  `exercises.js`, and both i18n catalogs. A token added in fewer than three
  places silently splits a row.
- **EN/PT key and placeholder parity is enforced** by `test/i18n.mjs`. Every
  user-visible string exists in both catalogs.

**Terminology is binding.** Use `CONTEXT.md`'s exact terms: *program*, *exercise
template*, *capacity*, *session*, *log row*, *mesocycle*, *block review*,
*shared program*. Say "session", not "workout", in domain code. Never
"routine", "plan", "e1RM", "true max". The AI vocabulary is *Taurifer AI* / *AI
request context* / *AI proposal* — never "coach", "chatbot", or "BYOK
assistant".

**Approved and explicitly unimplemented** (record them so future work does not
treat them as either shipped or unauthorized):

- **Taurifer Free / Taurifer Pro.** Free is a permanent floor — baseline program
  generation plus complete current-program execution, with free manual export.
  Pro is additive: advanced first-program generation, history-aware next-program
  generation, bounded within-block adaptation. The no-clawback rule binds from
  the commercial-launch boundary onward. Pro never buys different deterministic
  conclusions.
- **Publisher attribution** on shared programs — text-only provenance
  (publisher name, handle, short description). Attribution, never branding: it
  never restyles the app and never steers a recommendation. Requires a
  compatible versioning path; ADR 0007's payload contracts are locked.
- **Managed Taurifer AI** (ADR 0011) — sequenced *after* deterministic paid-beta
  economics. In context, never a permanent Chat tab; never mutates a program
  without approval. It pulls no accounts, cloud infra, or LLM dependency into
  Free or core. **ADR 0011 supersedes ADR 0002 and Plan 038; the BYOK AI coach
  is dead.**

**Explicitly undecided / not to be invented:** launch date, entitlement
lifecycle mechanics, and anything the backlog marks Gated or Evidence-only.
The thesis's quantitative figures are hypotheses, not requirements.

## Brand Commitments

- **Name:** Taurifer. User-facing only; internal `repforge` identifiers stay.
- **Personality: a quiet training partner.** It records, computes, and suggests.
  It does not celebrate, motivate, or entertain. No scores, ratings, grades,
  levels, streaks, badges, points, or celebration screens — this is a hard ban,
  and `CONTEXT.md` lists it under term after term.
- **The theme never appears in working surfaces.** The name's Milo-of-Croton
  etymology is internal background. No bull, calf, carrying, forge, or Latin in
  any string, in any language — not in copy, alt text, tooltips, notifications,
  export contents, or store metadata. Its only permitted surface is the app
  icon's bull-horned monogram and the landing lockup. Themed copy was
  implemented once and deliberately reverted (ADR 0004).
- **The ethos text is internal canon**, recorded in `docs/brand-guide.md` to keep
  historical screenshots interpretable. It is not referenced by production
  markup and must not be quoted in app copy.
- **Privacy is a product commitment, not a page.** Never log a setup-link
  payload, the handoff cookie, or a full URL. Never apply a payload when a
  program is onboarded or any log/history exists.
- **No program before onboarding.** First-run state is `program: []` /
  `onboarded: false`. There is no bundled starter split; backing out of
  onboarding leaves the no-program states pointing at the entry hub.
- **Typeface:** IBM Plex, self-hosted as woff2 in `fonts/`. No webfont CDN.

## Evidence on Hand

Real, in-repo, and usable:

- **The shipped app itself** — `index.html`, `app.js`, `styles.css` and the
  vendored runtimes are the incumbent design authority.
- **`docs/ui-screens/screens/`** — 66 mobile phone-frame captures covering every
  primary surface in both Appearance themes and every onboarding state across
  all entry routes. Regenerated on every user-visible change; CI fails on drift.
  This is the visual source of truth for any before/after judgement.
- **`docs/ui-audit.md`**, `docs/ui-audit-opus-design.md`,
  `docs/ui-screen-audit-opus-taste.md`, `docs/ui-screen-audit-sol-taste.md`, and
  `docs/ui-overhaul-disposition-register.md` — completed design critiques with
  per-finding dispositions.
- **`docs/adr/`** — 14 ADRs covering the irreversible decisions.
- **`assets/exercises/`** — 96 licensed `.webp` movement illustrations.
- **`assets/brand/milo-hero.webp`** — owner-licensed, archival, not referenced
  or precached.
- **The exercise dataset** derives from a third party; attribution in
  `NOTICE.md`.

Absences future work must not paper over:

- **No users yet.** The rolling noncommercial alpha has not started. There are
  no customers, no testimonials, no case studies, no press, no reviews, and no
  revenue.
- **No validated market data.** Every quantitative figure in the thesis is a
  hypothesis. Do not render one as a proven result.
- **No real-device screen-reader evidence for the release candidate yet** — the
  iOS/VoiceOver and Android/TalkBack cells required by Plan 041 are still open
  in `docs/backlog.md`.
- **No physical iOS validation** is claimed for the Add-to-Home-Screen cookie
  recovery path.
- Never fabricate pricing beyond the one recorded first price pair
  (R$24.90/month, R$179.90/year), licensing, deployment claims, or user counts.

## Product Principles

1. **The engine's conclusions are untouchable.** Deterministic output follows
   the athlete's record and declared rules alone. Commercial options appear
   only as clearly separate, subordinate choices. Never reorder, reword, or
   re-rank a recommendation for any other reason.
2. **Measure, don't motivate.** Capacity is what a set demonstrated, not a
   target to chase. The product reports; it does not cheer. Any surface that
   adds a score, streak, or celebration is wrong by definition.
3. **The device is the system of record.** Nothing leaves it except through a
   path the user initiated and understands. Offline is the assumed condition,
   not a degraded mode.
4. **Free stays whole.** From commercial launch onward, what shipped as Free
   stays Free. Pro grows by addition only. The user owns their records and can
   always export them.
5. **Truth over fluency.** Say what actually happened in the lifter's own
   vocabulary. A figure shown on one surface must be the same figure on every
   other surface — the session summary can never disagree with History or
   Progress.

## Accessibility & Inclusion

Binding:

- **WCAG 2.2 AA.** Contrast conformance including secondary text (Plan 036).
  The dark theme is held to the same bar as light; both are token swaps and
  both are captured in the screen catalog.
- **Real-device screen-reader behaviour is a release gate**, not a test
  practice: iOS/VoiceOver and Android/TalkBack verified against the exact
  release-candidate build (Plan 041). These cells are currently open.
- **Reduced motion is one decision, made once**, in `motion-layer.js`. No
  surface re-implements it.
- **Touch-first ergonomics.** Targets are sized for a standing, one-handed,
  mid-set user, not a mouse.
- **Full EN/PT parity**, enforced by `test/i18n.mjs`. Copy is validated in
  Portuguese first.
