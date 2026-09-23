# Impeccable technical audit — September 2026

**Command:** `/impeccable audit` (Impeccable skill v4.3.1, engine 0.1.5)
**Date:** 2026-09-22
**Commit audited:** `37c0942` (branch `claude/impeccable-setup-4p88ij`)
**Scope:** the whole shipped implementation. The app is one `index.html` shell plus one
`styles.css`, so a per-surface split would have been artificial.

**This is a report, not a queue.** [`docs/backlog.md`](backlog.md) remains the repository's only
ordered queue, and Plans 049–059 remain the governing contract for the active UI overhaul. Nothing
here is scheduled by being written down; several findings overlap work Plan 058 already owns, and
those are marked. It sits alongside the earlier design critiques ([`ui-audit.md`](ui-audit.md),
[`ui-audit-opus-design.md`](ui-audit-opus-design.md),
[`ui-screen-audit-opus-taste.md`](ui-screen-audit-opus-taste.md),
[`ui-screen-audit-sol-taste.md`](ui-screen-audit-sol-taste.md)) as a mechanical counterpart: this
one measures, it does not judge taste.

---

## Health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 / 4 | CTA arrow glyph drops to 2.05:1 in dark mode |
| 2 | Performance | 2 / 4 | 8.59 MB atomic precache, 2.3 MB of it a 9,233-path favicon SVG |
| 3 | Theming | 4 / 4 | 27 tokens, full dark swaps, 5 hex values outside the token blocks |
| 4 | Responsive | 3 / 4 | 44px floor enforced globally; PT-BR expansion untested above 320px |
| 5 | Implementation Integrity | 3 / 4 | 33 distinct font sizes, 18 of them written in both px and rem |
| **Total** | | **15 / 20** | **Good — address performance first** |

## Implementation integrity verdict: PASS

The implementation expresses a coherent, product-specific system rather than a template. Tokens
carry meaning and the CSS says why: `--accent` and `--accent-deep` exist as separate tokens because
the contrast maths differs between a mark and text. Decisions are commented with their reasoning —
the disabled-CTA treatment, the drawn arrow glyph, the `--entry-tint` alpha, the `color-scheme`
keyword indirection.

The bundled detector reported 400 findings. 372 are `design-system-*` advisories that only began
firing once `DESIGN.md` existed to compare against, and they restate the scale drift recorded as
P2-A below rather than adding new information. Of the 28 remaining "slop" findings, nearly all are
verified-intentional in this system:

| Rule | Count | Verdict |
|---|---|---|
| `side-tab` | 12 | **False positive here.** Tokenized `border-left: 2–3px solid var(--accent \| --rule \| --danger)` used as quote-bars and inline-note edges, not AI card accents. |
| `bounce-easing` | 10 | **Intentional.** A deliberate `cubic-bezier(.2, 1.2–1.4, .4, 1)` family confined to control affordances (the checkbox tick), never layout. |
| `layout-transition` | 3 | **Real but low impact.** See P3-B. |
| `gpt-thin-border-wide-shadow` | 3 | Confined to the dock and sheet material, which is the system's one deliberate floating layer. |
| `extreme-negative-tracking` | 1 | Landing headline at −0.05em. Tighter than the −0.02em display tier `DESIGN.md` records. |
| `all-caps-body` | 1 | A 34-character uppercase label; within the sanctioned 11px label tier. |
| `numbered-section-labels` | 2 | Not reviewed in depth. |

---

## Findings

### [P1-A] CTA arrow glyph is near-invisible in dark mode

- **Location:** `styles.css:306-312`, `.btn--cta::after`
- **Category:** Accessibility
- **Standard:** WCAG 2.2 — 1.4.11 Non-text Contrast (3:1) if the glyph is treated as a meaningful
  affordance; arguably exempt as purely decorative `::after` content, but it is the only directional
  indicator on the primary action.

The rule sets `color: var(--accent)` with no dark-theme override. The existing comment explains the
light-mode choice and is correct for light:

```
/* Brand accent stays here deliberately: on the near-black CTA the brighter
 * orange measures ~4.6:1 while --accent-deep drops to ~3.3:1 (C1). */
```

In dark, `--cta` inverts to a light pill (`#DED7CC`) while `--accent` stays orange (`#F2703B`). The
two inks move in opposite directions and the arrow is left behind.

| Theme | Button fill | Arrow | Ratio |
|---|---|---|---|
| Light | `#161513` | `#E04E14` | **4.58:1** ✓ |
| Dark | `#DED7CC` | `#F2703B` | **2.05:1** ✗ |

The button's *label* inverts correctly (`#161513` on `#DED7CC` = 12.77:1). Only the glyph was missed.

- **Evidence:** computed at render in headless Chromium — fill `rgb(222, 215, 204)`, arrow
  `rgb(242, 112, 59)`. Confirmed no dark override exists for the selector.
- **Recommendation:** the token for exactly this case already exists. `--accent-ink` is defined per
  theme precisely because "in dark the CTA inverts to a light pill while the orange stays orange, so
  the two inks move in opposite directions" (`styles.css:36-38`). Either give `::after` a per-theme
  value, or reuse the CTA label's own ink.
- **Suggested command:** `/impeccable harden`

### [P1-B] 8.59 MB atomic precache

- **Location:** `sw.js`, `ASSETS`
- **Category:** Performance

140 unique files installed through a single `cache.addAll`. The install is all-or-nothing, on a
product whose recorded operating context is a gym floor with poor or absent connectivity.

| Group | Size |
|---|---|
| `assets/` (96 exercise `.webp` + 5 brand) | 3,267 KB |
| `icons/` | 2,763 KB |
| root JS + CSS | 2,505 KB |
| `vendor/` | 169 KB |
| `fonts/` | 89 KB |

The cache-revision ritual itself is being followed correctly: `repforge-v257` in `sw.js` and `?v=257`
in both `sw.js` and `index.html` are in lockstep.

- **Recommendation:** the 96 exercise illustrations are the largest group and the least likely to be
  needed at install. Splitting them into a lazily-populated cache, separate from the atomic shell
  precache, would cut first-install weight by roughly a third without changing offline behaviour for
  any exercise already viewed. This is a service-worker architecture change, not a styling one.
- **Suggested command:** `/impeccable optimize`

### [P1-C] `icons/icon.svg` is 2.3 MB

- **Location:** `icons/icon.svg`, referenced at `index.html:19` and precached in `sw.js:8`
- **Category:** Performance

The file contains **9,233 `<path>` elements** — a vector-traced illustration of the bull-horned
monogram — and is served as `rel="icon"`, rendered at 16–32px. It is 27% of the entire precache.

`favicon-32.png` (1 KB) and `icon-192.png` are already declared as fallbacks at `index.html:20-21`,
but browsers that support SVG favicons prefer the SVG, so every modern browser fetches the full
2.3 MB for a 16px glyph.

- **Recommendation:** keep the detailed file as an archival source asset outside the served set, ship
  a simplified favicon SVG (tens of paths, not thousands), and drop the heavy one from `ASSETS`.
  This is the single largest win available and carries no visual risk at the sizes it renders at.
- **Suggested command:** `/impeccable optimize`

### [P2-A] The type scale is written in two units

- **Location:** `styles.css`, throughout
- **Category:** Implementation Integrity
- **Overlaps:** Plan 058 (design-system-convergence) already owns this area.

51 raw `font-size` declarations collapse to 33 distinct computed sizes. **18 of those sizes are
written both ways** — the same value with two spellings:

```
10px/.625rem   10.5px/.65625rem  11px/.6875rem   12px/.75rem    12.5px/.78125rem
13px/.8125rem  14px/.875rem      15px/.9375rem   16px/1rem      17px/1.0625rem
18px/1.125rem  19px/1.1875rem    24px/1.5rem     26px/1.625rem  27px/1.6875rem
28px/1.75rem   30px/1.875rem     40px/2.5rem
```

Radii show the same spread: 18 distinct px values against a `--radius: 14px` token.

- **Impact:** a scale change cannot be done by search-and-replace, and the design system cannot be
  enforced mechanically — which is why the detector's `design-system-font-size` rule fires 309 times
  against the `DESIGN.md` scale.
- **Recommendation:** pick one unit and converge, under Plan 058 rather than as a standalone change.
- **Suggested command:** `/impeccable typeset`, then `/impeccable layout`

### [P2-B] The global reduced-motion kill overrides 17 scoped alternatives

- **Location:** `styles.css:2771`
- **Category:** Accessibility
- **Standard:** WCAG 2.2 — 2.3.3 Animation from Interactions (AAA)

```css
@media (prefers-reduced-motion: reduce) {
  *{animation:none!important;transition:none!important}
}
```

There are 19 `prefers-reduced-motion` blocks in the file. **17 use no `!important`**, so this blanket
rule wins over all of them regardless of specificity.

Most of those 17 set `transition: none` themselves, so this is primarily dead code and maintenance
drag rather than broken behaviour — but it creates a false impression that motion is handled
per-surface when one rule decides everything. Two blocks do carry a distinct intent that the blanket
rule flattens:

- `styles.css:980` — "Colour alone carries overtime; the dot holds at half strength"
- `styles.css:2424` — "The panel still arrives as a full screen; it just stops moving"

Their non-transition declarations survive (the `*` rule only touches `animation` and `transition`);
their transition intent does not. Separately, `styles.css:3994`'s
`.firstrun *{animation-duration:.01ms!important;transition-duration:.01ms!important}` is fully
redundant behind it.

- **Impact:** the blanket rule also removes colour and border cross-fades, which are not vestibular
  triggers. WCAG 2.3.3 targets motion, not all state feedback; reduced-motion users lose the save
  confirmation's colour change along with the movement.
- **Recommendation:** collapse to one intentional layer — keep the scoped alternatives, drop the
  global kill and the redundant `.firstrun` block, and let the `!important`-free rules do their job.
- **Suggested command:** `/impeccable animate`

### [P3-A] `--ink-faint` on `--bg` is 4.60:1 in light

- **Location:** `styles.css:20` (`--ink-faint: #716D66`) against `--bg: #F4F2EF`
- **Category:** Accessibility
- **Standard:** WCAG 2.2 — 1.4.3 Contrast (Minimum), 4.5:1

Passes by 0.10. That token carries the entire 11px uppercase label tier — eyebrows, card titles,
section labels, chips. It is the thinnest margin in the palette, and any future warming of the paper
or lightening of the ink breaks it.

Worth noting the token is deliberately *darker* than `--ink-soft` (#6E6A63) in light mode, which
looks like an error until you see it only sits on small uppercase type. That inversion is correct and
is recorded in `DESIGN.md` so it does not get "fixed".

- **Recommendation:** a regression test pinning the pair, not a colour change.

### [P3-B] `transition: width` in three places

- **Location:** `styles.css:434` (toggle knob), `:674` (mono chip), `:1525` (`.pickrow__tick`)
- **Category:** Performance

The first two animate a single small element and are negligible. The third transitions a tick column
from `width: 0` and sits in a list, so a mode switch into a selectable state can animate every
visible row at once.

- **Recommendation:** only the `.pickrow__tick` case is worth revisiting, and only if a long list
  shows measurable jank.

### [P3-C] Stale numbers in `CLAUDE.md`

- **Location:** `CLAUDE.md:46`, `:53`, `:78`
- **Category:** Implementation Integrity

| Claim | Stated | Actual |
|---|---|---|
| Service-worker cache | `repforge-v112`, `?v=112` | **`repforge-v257`, `?v=257`** |
| `app.js` size | ~566 KB | **935 KB** |
| UI screen catalog | 66 screens | **96 declared** in `manifest.json`, 469 PNGs |

This is the orientation file every contributor and agent reads first.

### [P3-D] Unreferenced font files

- **Location:** `fonts/saira-600.woff2`, `saira-700.woff2`, `saira-800.woff2`
- **Category:** Implementation Integrity

No `@font-face`, no CSS, no JS, no HTML reference, and not in the precache list. Roughly 100 KB of
repository weight at no runtime cost. Probably left over from an earlier wordmark direction.

---

## Positive findings

- **Theming is the strongest dimension in the codebase.** Every translucent use of a theme colour
  reads a `--*-rgb` channel triplet (`rgba(var(--accent-rgb), .12)`) rather than a hardcoded rgba, so
  a theme swap carries washes and focus rings with it. Only 5 hex values sit outside the token
  blocks, and 3 carry comments explaining why (`--exercise-art-bg` as a deliberate constant across a
  `#E3D4BE`–`#F4EDE1` illustration range; `.firstrun`'s scoped `--brand-paper`; the install-banner
  mark).
- **The repository's own accessibility suite passes 158/158** — modal and disclosure semantics, live
  regions, four-state radio groups per muscle, focus restoration after re-render, 320px layout
  without horizontal overflow, 200% root text genuinely enlarging onboarding typography, dark theme
  staying tokenized through the entry flow, and reduced-motion removing entry transitions.
- **`inert` is used 16 times** for modal isolation — the modern primitive, more reliable than a
  hand-rolled focus trap. Alongside 15 `aria-modal`, 170 `aria-label`s, 156 roles, 17 live regions, a
  skip link, landmark elements, and alt text on every `<img>`.
- **`document.documentElement.lang` is correctly set to `pt-BR`** on language switch
  (`i18n.js`), satisfying WCAG 3.1.1. Checked expecting a bug; there isn't one.
- **No layout thrash.** 24 synchronous layout reads (`offsetHeight`, `getBoundingClientRect`,
  `scrollHeight`, `getComputedStyle`) across 935 KB of `app.js`, against 21 `requestAnimationFrame`
  calls. `will-change` appears exactly twice, and one of those is scoped to `.is-dragging` so the
  hint is dropped at rest. This is more disciplined than most production frontends.
- **EN/PT parity is complete** — 1,898 keys in both catalogs, enforced by `test/i18n.mjs`.

---

## Localization measurement

Recorded because `PRODUCT.md` binds design work to judging copy in Portuguese first.

- Median PT/EN length ratio: **1.147**
- Mean: **1.204**
- Share of strings expanding more than 1.3×: **26%**

The largest expansions land on short labels, which is where overflow bites:

| Key | EN | PT | Growth |
|---|---|---|---|
| `program.day.growth_6_d4` | "Lower body hip volume" (21) | "Volume de membros inferiores com foco no quadril" (48) | +27 |
| `program.day.growth_6_d2` | "Lower body knee volume" (22) | "Volume de membros inferiores com foco no joelho" (47) | +25 |
| `program.day.strength_3_d3` | "Full body hinge strength" (24) | "Força de corpo inteiro com foco no quadril" (42) | +18 |
| `install.transfer.unknown_title` | "Transfer outcome unknown" (24) | "Não foi possível confirmar a transferência" (42) | +18 |
| `settings.delete_log` | "Delete log" (10) | "Apagar histórico de treinos" (27) | +17 |

The first three are training-day names, which render as day tab labels. The existing suite covers
320px overflow in the entry flow; it does not cover these labels at PT length across the main views.

---

## Method and limits

**What produced the evidence:**

- Headless Chromium 1194 (the environment's preinstalled build, via `REPFORGE_CHROME`) at emulated
  mobile viewports, against `python3 -m http.server` on the audited commit.
- The repository's own `test/accessibility.mjs` suite, run in full.
- The Impeccable bundled detector over `index.html`, `styles.css`, `motion-polish.css`, `app.js`,
  `program-editor.js`, `program-compiler.js`.
- Static analysis of `styles.css`, `sw.js`, `i18n-{en,pt}.json` and the icon and font assets.
- Contrast computed from the token values for every meaningful foreground/background pair in both
  themes, plus one rendered verification on the CTA arrow.

**What was not verified — stated so nobody reads more into the score than it earned:**

- **Per-element rendered contrast on real surfaces was not measured.** A cross-surface probe over
  Log / Stats / History / Program in both themes at 360px and 390px hung on view switching and was
  abandoned. Contrast here is analytical across token pairs, with the single exception of the
  rendered CTA-arrow check. A surface that composes tokens in a way the pair matrix does not
  anticipate could still fail.
- **Touch targets are verified only as a CSS rule** — the blanket 44px minimum at
  `styles.css:216-220` — not as rendered geometry.
- **No synthesized touch gestures and no physical device.** Gesture surfaces (the deck, sheet drag,
  reorder) were read, not exercised.
- The real-device iOS/VoiceOver and Android/TalkBack cells Plan 041 requires remain open, as
  `docs/backlog.md` already records. Nothing in this audit substitutes for them.

## Suggested order

Priority order for the findings above, if and when the backlog schedules them:

1. **[P1-C]** `/impeccable optimize` — the favicon SVG. Largest win, lowest risk, no visual change.
2. **[P1-B]** `/impeccable optimize` — precache split for the exercise illustrations.
3. **[P1-A]** `/impeccable harden` — the dark-mode CTA arrow.
4. **[P2-B]** `/impeccable animate` — collapse the reduced-motion layers.
5. **[P2-A]** `/impeccable typeset`, then `/impeccable layout` — unit convergence, under Plan 058.
6. **[P3-*]** `/impeccable polish` — the remaining items.
