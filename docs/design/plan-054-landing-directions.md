# Plan 054 landing directions

Status: preview-only owner gate. No direction is selected. These rasters are not
production assets and are not part of the UI screen catalog.

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

Pending. Record the selected direction and exact artifact SHA-256 here and in
draft PR #241 before 054-P3 begins.
