# Plan 054 landing directions

Status: the owner-selected target was implemented in PR #241. The owner
authorized a subsequent product-led refinement on 2026-09-15. Historical
preview rasters remain outside production and the UI screen catalog.

## Shared content and provenance

All three directions use the same 390 × 844 phone-canvas request and the same
copy and data. The image tool returned each raster at the same 853 × 1844 pixel
size.

The product loop is:

1. Program prescription: Bench press, 3 × 8–10, 60 kg, target RIR 2.
2. Completed work: three sets at 60 kg × 10, RIR 2.
3. Derived next-session target: add load, 3 × 8 at 62.5 kg.

The target is not invented preview copy. `progression-engine.js` range strategy
version 1 returns `status: "advance"`, `targetLoad: 62.5`, and `targetReps: 8`
for that prescription, history, and the current 2.5 kg minimum increment.

Generation tool: built-in `image_gen`. The invocation runtime did not expose a
model identifier; each PNG's embedded provenance identifies `gpt-image` version
`2.0` and `OpenAI Media Service API`. Generated 2026-09-12.

Common accessibility caveat: these are raster composition previews, not an
accessible implementation. Production must preserve semantic heading/list/table
structure, logical reading order, text alternatives where needed, keyboard
operation, dynamic type/localization reflow, and verified contrast. Burnt orange
cannot be the only carrier of state.

Exercise-vocabulary extraction: `reuse not yet earned`. P1 and P2 add no second
non-entry consumer and move no coherent exercise-vocabulary operation.

## Direction A — vertical proof strip

Artifact: [landing-direction-a.png](mocks/plan-054/landing-direction-a.png)

SHA-256: `093d98ed08a7c7e267928c95f5293c39ef0fe8cc1c23e81f933b52f3f4ea5d56`

Layout difference: three stacked stages connected by a restrained orange
progression line. The log is the middle proof between prescription and result.

Accessibility caveat: the vertical line and dots must remain decorative; DOM
order must carry the sequence. The tall stack must reflow without forcing small
type or hiding the next-session result below an unexplained fold.

Prompt:

```text
Use case: ui-mockup
Asset type: preview-only mobile landing direction A for Taurifer, a local-first progressive-overload workout tracker
Primary request: create one polished, compact 390 x 844 phone-screen product UI that explains one truthful progression loop from program prescription to completed logged work to the derived next-session target.
Style/medium: realistic shippable mobile product UI, not concept art, not an illustration, not a marketing dashboard. Editorial and quiet. Warm paper background #F4F2EF, near-black ink #1B1A17, muted ink #6E6A63, burnt-orange accent #E04E14, white surface only where necessary, thin warm-gray rules #E4E1DA, 14 px corner radius, no shadows. Typography roles: IBM Plex Sans-like humanist sans for headings/body; IBM Plex Mono-like monospace for numbers, loads, reps, RIR, and compact labels.
Composition/framing: DIRECTION A — a single vertical proof strip. Small TAURIFER wordmark at top, then a compact headline "Your program learns from the work you log." Below it, three clearly connected stacked stages separated by thin rules and a restrained burnt-orange vertical progression line: prescription first, completed log second, next-session target third. Keep the entire screen sparse, useful, and mobile-native with generous side margins and strong scanning hierarchy.
Text (render verbatim, no substitutions, no extra words): "TAURIFER"; "Your program learns from the work you log."; "PROGRAM PRESCRIPTION"; "BENCH PRESS"; "3 × 8–10"; "60 kg"; "Target RIR 2"; "SETS LOGGED 3/3"; "SET 1"; "60 kg × 10"; "RIR 2"; "SET 2"; "60 kg × 10"; "RIR 2"; "SET 3"; "60 kg × 10"; "RIR 2"; "NEXT SESSION"; "ADD LOAD"; "3 × 8"; "62.5 kg".
Truth constraint: the next target is derived from a range-progression prescription of 3 sets at 8–10 reps, after all three completed sets at 60 kg × 10 with RIR 2; show no other data.
Constraints: same 390 x 844 phone canvas specified here; exact copy and data only; no fake AI; no streaks; no social proof; no charts; no invented metrics; no navigation dashboard; no exercise image or human figure; no iconography except a minimal check mark beside each completed set; no gradients; no glossy effects; no watermark; no device bezel; do not use purple, blue, or green. Emphasize information hierarchy and accessible contrast.
```

## Direction B — summary pair over evidence ledger

Artifact: [landing-direction-b.png](mocks/plan-054/landing-direction-b.png)

SHA-256: `d98359b740752eea727b38a66c1723263d70d6e99f24311d9cac4375a4116eb5`

Layout difference: prescription and next target are balanced side by side above
one full-width completed-set ledger, making the outcome comparison immediate.

Accessibility caveat: the two-column summary may become cramped under dynamic
type or longer translations. The arrow must not establish reading order or be
the only explanation of the relationship.

Prompt:

```text
Use case: ui-mockup
Asset type: preview-only mobile landing direction B for Taurifer, a local-first progressive-overload workout tracker
Primary request: create one polished, compact 390 x 844 phone-screen product UI that explains one truthful progression loop from program prescription to completed logged work to the derived next-session target.
Style/medium: realistic shippable mobile product UI, not concept art, not an illustration, not a marketing dashboard. Editorial and quiet. Warm paper background #F4F2EF, near-black ink #1B1A17, muted ink #6E6A63, burnt-orange accent #E04E14, white surface only where necessary, thin warm-gray rules #E4E1DA, 14 px corner radius, no shadows. Typography roles: IBM Plex Sans-like humanist sans for headings/body; IBM Plex Mono-like monospace for numbers, loads, reps, RIR, and compact labels.
Composition/framing: DIRECTION B — one compact workout ledger with an integrated before/after header. Small TAURIFER wordmark at top, then the compact headline "Your program learns from the work you log." Put PROGRAM PRESCRIPTION and NEXT SESSION as two balanced, adjacent summary blocks near the top, joined by one restrained burnt-orange arrow or rule. Put the completed SETS LOGGED 3/3 ledger below as the evidence supporting the change. The screen must still read in causal order: prescription, logged work, derived target. Keep it sparse, useful, and mobile-native with generous side margins and strong scanning hierarchy.
Text (render verbatim, no substitutions, no extra words): "TAURIFER"; "Your program learns from the work you log."; "PROGRAM PRESCRIPTION"; "BENCH PRESS"; "3 × 8–10"; "60 kg"; "Target RIR 2"; "SETS LOGGED 3/3"; "SET 1"; "60 kg × 10"; "RIR 2"; "SET 2"; "60 kg × 10"; "RIR 2"; "SET 3"; "60 kg × 10"; "RIR 2"; "NEXT SESSION"; "ADD LOAD"; "3 × 8"; "62.5 kg".
Truth constraint: the next target is derived from a range-progression prescription of 3 sets at 8–10 reps, after all three completed sets at 60 kg × 10 with RIR 2; show no other data.
Constraints: same 390 x 844 phone canvas specified here; exact copy and data only; no fake AI; no streaks; no social proof; no charts; no invented metrics; no navigation dashboard; no exercise image or human figure; no iconography except a minimal check mark beside each completed set; no gradients; no glossy effects; no watermark; no device bezel; do not use purple, blue, or green. Emphasize information hierarchy and accessible contrast.
```

## Direction C — exercise-led causal band

Artifact: [landing-direction-c.png](mocks/plan-054/landing-direction-c.png)

SHA-256: `1a0e184a5c0728abc6f6c5eb60d13359e3bf726108d84232dc03d0b4a1246ce8`

Layout difference: one Bench press ledger contains a three-column causal band,
then the completed rows beneath it. The next target receives the strongest
numeric emphasis.

Accessibility caveat: three columns are the most localization- and zoom-sensitive
direction. A production version would need a narrow-screen fallback and explicit
semantic associations between each label, value, and the completed-set evidence.

Prompt:

```text
Use case: ui-mockup
Asset type: preview-only mobile landing direction C for Taurifer, a local-first progressive-overload workout tracker
Primary request: create one polished, compact 390 x 844 phone-screen product UI that explains one truthful progression loop from program prescription to completed logged work to the derived next-session target.
Style/medium: realistic shippable mobile product UI, not concept art, not an illustration, not a marketing dashboard. Editorial and quiet. Warm paper background #F4F2EF, near-black ink #1B1A17, muted ink #6E6A63, burnt-orange accent #E04E14, white surface only where necessary, thin warm-gray rules #E4E1DA, 14 px corner radius, no shadows. Typography roles: IBM Plex Sans-like humanist sans for headings/body; IBM Plex Mono-like monospace for numbers, loads, reps, RIR, and compact labels.
Composition/framing: DIRECTION C — a compact editorial ledger centered on BENCH PRESS. Small TAURIFER wordmark at top, then the compact headline "Your program learns from the work you log." Use one full-width exercise header, followed by a three-column horizontal causal band labeled PROGRAM PRESCRIPTION, SETS LOGGED 3/3, and NEXT SESSION. Directly beneath that band, show the three completed set rows as a minimal table spanning the screen. Make the NEXT SESSION result the strongest element with a restrained burnt-orange edge or underline, while preserving causal reading from left to right then down. Keep it sparse, useful, and mobile-native with generous side margins and strong scanning hierarchy.
Text (render verbatim, no substitutions, no extra words): "TAURIFER"; "Your program learns from the work you log."; "PROGRAM PRESCRIPTION"; "BENCH PRESS"; "3 × 8–10"; "60 kg"; "Target RIR 2"; "SETS LOGGED 3/3"; "SET 1"; "60 kg × 10"; "RIR 2"; "SET 2"; "60 kg × 10"; "RIR 2"; "SET 3"; "60 kg × 10"; "RIR 2"; "NEXT SESSION"; "ADD LOAD"; "3 × 8"; "62.5 kg".
Truth constraint: the next target is derived from a range-progression prescription of 3 sets at 8–10 reps, after all three completed sets at 60 kg × 10 with RIR 2; show no other data.
Constraints: same 390 x 844 phone canvas specified here; exact copy and data only; no fake AI; no streaks; no social proof; no charts; no invented metrics; no navigation dashboard; no exercise image or human figure; no iconography except a minimal check mark beside each completed set; no gradients; no glossy effects; no watermark; no device bezel; do not use purple, blue, or green. Emphasize information hierarchy and accessible contrast.
```

## Owner decision

Selected on 2026-09-13: the owner supplied a new reference and stated, "This is
the exact target we should aim for." It replaces A, B, and C as the production
visual target.

Selected artifact: [owner-selected-target.jpg](mocks/plan-054/owner-selected-target.jpg)

SHA-256: `390f3fccf2fb24a766146311754599c3c3f0217568c05db0ffc029735674812e`

The binding composition is the complete editorial landing shown in the selected
artifact: compact brand/install/menu header; oversized proposition; short
supporting copy; two early program-entry actions; a prominent phone product view
that demonstrates prescription, logged sets, and the next target; and a concise
three-part benefit strip. Production must build this as responsive semantic UI.
The JPEG is a reference record, not a production image or screen-catalog frame.

The earlier A/B/C artifacts remain preview evidence only. None is selected or
eligible to enter production markup.

### Hero photograph, supplied 2026-09-14

The selected target carries a photographic hero background. At selection time
no such licensed file existed in the repository, so the first implementation
pass built the composition on flat paper and recorded the photograph as
reference-only. The owner then supplied the photograph itself.

Production asset: `assets/brand/landing-hero.webp` (941×1672, ~88 kB).

SHA-256 of the supplied source PNG:
`3c66655225cb75bb35c041532b19e017af6735c59f567ce697767468182fe43b`

SHA-256 of the shipped WebP:
`ebbe91723ad9c8479af8ed79b009ff3affb115ddb7c85aff6f2eeb3b9f254a11`

It ships white-balanced onto `--bg` and otherwise uncropped; the crop is a CSS
decision that differs between compact and wide, because a portrait photograph
cannot hold a landscape hero at the phone's composition. Provenance,
processing, and the dark/`forced-colors` withholding rule are recorded in
`assets/brand/README.md`. This is brand art, not exercise art: the 96-file
illustration set stays closed and untouched.

The photograph carries no product fact.

### Device render, supplied 2026-09-14

The selected target's phone is a rendered device showing the product. The first
implementation drew that phone in CSS with the loop as live text. The owner
judged the result too far from the target and supplied a device render to use
instead.

Production asset: `assets/brand/landing-device.webp` (541×1058 with alpha, ~33 kB).

SHA-256 of the supplied source PNG:
`8f2411895e8611a7b84f2046273310eb4ba15bfe9eca8bd88587de45d82c9598`

SHA-256 of the shipped WebP:
`52a7e5158c2dfdef385b62f621b24326bef20cae07aea7b9813f4a0c4a5f3cb4`

The render shows a real Taurifer screen, so the truthful-loop requirement still
holds: a Push session in week 4, the incline converging chest press prescribed
at 4–8 reps and RIR 0–2, the 152.5 kg for 7 reps logged last session, and the
set derived from it. The numbers differ from the A/B/C previews because this is
a different session, not because anything was invented.

**This trades live text for a raster, and that cost was accepted knowingly.**
The loop now reaches assistive technology and both languages through the
image's localized `alt` (`landing.preview.alt`, bound by a new `data-i18n-alt`
attribute), and `test/install-modes.mjs` asserts the prescription, the logged
work and the derived target from that accessible name in en-US and pt-BR. What
is genuinely lost: the screen inside the render does not reflow at 200% text,
does not restyle for dark, and does not translate — a pt-BR reader sees an
English screen described in Portuguese. The ten `landing.preview.*` strings the
drawn phone used are removed.

This supersedes the accessibility caveat above for the phone only. Everything
outside the render — proposition, actions, benefits, ethos, Privacy — remains
semantic, localized, reflowing text.

## Responsive Composition & Visual Alignment (Focused Pass)

Following owner review of candidate implementation `210404ac`, this section records the intended responsive composition bringing the physical mobile landing page materially closer to `docs/design/mocks/plan-054/owner-selected-target.jpg`.

### Typography Retention Decision
- **Established Typography Preserved**: Taurifer strictly preserves its established **IBM Plex Sans** (body and editorial display) and **IBM Plex Mono** (ethos, tags, technical notation).
- **Explicit Rejection**: No serif font, secondary display face, or foreign web fonts are introduced. The editorial gravitas of the target is achieved entirely through typographic weight, leading, scale hierarchy, and layout rhythm within the existing Plex family.

### Responsive Composition Architecture
1. **Hero Photograph Composition**:
   - The owner-supplied hero photograph (`assets/brand/landing-hero.webp`) is positioned so that the primary proposition (headline, supporting copy, and program actions) sits over the light upper wall background.
   - The dark weight plates sit visually below the action controls rather than behind them.
   - The textured foreground floor is preserved, with the bottom fade transition (`-webkit-mask`) held until the contact base where it blends seamlessly into the warm paper background of the benefit strip.
   - The crop remains fully responsive across compact viewports via CSS background positioning and sizing (`background-position: 36% top; background-size: cover;`) rather than baked into a static raster export.

2. **Phone Prominence and Placement**:
   - The supplied device render (`assets/brand/landing-device.webp`) is significantly enlarged (from the previous rigid 146px column to ~50–52% of mobile viewport width, e.g. ~195–215px at 390px, ~215–235px at 430px) so it serves as the visual anchor of the hero.
   - The render matches the target's diagonal placement and edge-to-edge rightward bleed.
   - Its base is convincingly grounded on the photographed surface near the plate level, utilizing its natural shadow and contact treatment.
   - Geometric separation invariants are maintained: the device render does not collide with or crowd the headline, supporting copy, or action buttons.

3. **Mobile Hero Layout & Dynamic Width**:
   - The rigid 146px mobile grid is replaced with a responsive structure that allows the headline to claim ample width near the top (e.g. ~240px–260px at 390px), breaking cleanly across 4 editorial lines matching the target ("Stop guessing / what to lift. / And start / progressing.").
   - Lower in the composition, narrower supporting copy and actions coexist alongside the enlarged diagonal phone render without text collisions.
   - Safe stacked fallback is retained for compact 320px viewports, enlarged 200% dynamic text, and localized Portuguese (PT-BR) where button copy requires greater measure.

4. **Action Buttons & Readability**:
   - Primary action (`#firstRunCreate`): prominent burnt-orange background (`--accent-deep`) with white ink, refined padding, weight 600, right-aligned arrow.
   - Secondary action (`#firstRunImport`): solid, opaque warm-paper background (`--bg` / `--well`) with burnt-orange hairline border (`--accent-deep`) and dark ink (`--ink`), ensuring complete legibility and preventing visual disappearance against textured background or plates.
   - Both actions maintain touch target compliance (>=44px), refined label weights, and flex-wrap tolerance for localized text.

5. **Hero Ending, Ethos & Benefit Strip Rhythm**:
   - "Plan. Lift. Progress." (`.firstrun__ethos`) is positioned quietly within the lower-left hero composition, preceded by a restrained short rule divider matching the target (~24px–32px).
   - The 3-part benefit strip (`.firstrun-benefits`) sits immediately after the hero, featuring warm-paper surface (`--bg`), subtle vertical hairline dividers (`--rule`), consistent orange line icons, stronger titles, and concise descriptions.
   - Expanded installation instructions (`#firstRunInstall`) sit below the benefit strip or reveal contextually upon tapping the header install link, preserving the approved install policy and early iOS offer.

6. **Header Spacing & Lockup**:
   - Excess vertical margin between header and proposition is reduced to bring the headline into close editorial proximity with the brand lockup.
   - Compact brand lockup (mark >= 39px, wordmark >= 14px) and utility actions (Privacy and policy-gated Install) remain cleanly aligned without inventing placeholder navigation controls.


## Owner-directed product refinement, 2026-09-15

The copy choice in this historical section was superseded by the bounded final
pass below. Its accepted product assets and truthful fixture remain in use.

The owner supplied `docs/taurifer-pr241-premium-landing-refinement.md` and
explicitly authorized moving beyond literal reproduction of the selected
raster. The earlier selection, photograph and device provenance above remain
historical evidence. The photograph and supplied device no longer enter the
landing or service-worker cache.

The new direction leads with "Your last set. Your next move." The early
Build my program and Track my current program actions retain their existing
routes. One actual workout screen explains the product, with live prescription,
completed-work and next-target details outside the raster. The example is
explicitly labelled and does not purport to describe an incoming shared program.

The shown example uses the current range-progression engine: three bench-press
sets at 60 kg, 10 reps and RIR 2 produce a 62.5 kg, 8-rep target. The working
program prescribes 3 sets of 8–10 reps, with RIR 0–2. No new progression logic,
user state or training capability was introduced for the landing.

### Composition and benchmark

The live [Alpha Progression site](https://alphaprogression.com/en) was inspected
at 390px and 1440px on 2026-09-15. Its paired product screens share clear edges,
large scale and consistent lighting. It gives each feature enough space for
one specific software detail to carry the claim. Those are craft lessons,
not a reason to reproduce its blue palette, pill labels, long feature tour,
ratings, pricing or section order.

Taurifer keeps its paper, Plex type, quiet rules and burnt orange. It uses one
compact training example instead of a feature catalogue. The next load has the
strongest numeric emphasis, while the entry actions remain above the example.
The result crosses the lower device edge as a readable HTML detail. The old
three benefit columns are replaced by this causal sequence and a short statement
about device-local training data.

The near-frontal Form iPhone Studio render preserves readable columns. The
Three Quarter / Bright Product alternative introduces stronger reflection and
perspective compression. Two tighter in-page crops were also rejected because
they hid the recorded work. English and Portuguese each have light and dark
source captures, so the raster now follows the page's language and appearance.

Portuguese uses "Da última série à próxima meta." It expresses the causal
relationship naturally rather than forcing the English line breaks or idiom.
Critical facts remain live, localized text that reflows at 200% text size.

### Reproduction and evidence

See [premium refinement evidence](../pr-proof/premium-landing/README.md)
for source captures, renderer configuration, before/after frames, commands,
trade-offs and verification. [Brand asset provenance](../../assets/brand/README.md)
records the source viewport, hardware-model attribution and export steps.

This is a subsequent owner-directed refinement, not a retroactive change to the
2026-09-13 selection. Plan 054 remains active. Physical iOS/Android review in
EN/PT is pending, and PR #241 must not be merged on automated evidence alone.

## Bounded final art-direction pass

The owner accepted `42f93a8` as the product-led foundation and closed copy
exploration. The final correction restores the exact EN/PT hero and ethos from
`7970192`, and ends with its guidance benefit. It keeps the four accepted Form
renders, actual progression fixture and all Plan 054 behavior.

The composition now uses a full-width vertical logged-work/next-target sequence
at 320. At 768, a single editorial introduction leads into one integrated
phone/proof figure, with the closing below it. The live result overlaps the
device, replacing the orange crop boundary. The next target carries the
strongest emphasis, while the factual explanation belongs to the work that
caused it. Header and CTA changes are optical refinements only.

[Before/after evidence against `42f93a8`](../pr-proof/landing-final-pass/README.md)
records the 19-case matrix, deliberate geometry failures and the remaining
PT-at-200% word-break trade-off. The independent correction review found no
remaining concrete visual blocker. This records implementation and browser
review, not physical-device acceptance. PR #241 remains unmerged and Plan 054
remains active.
