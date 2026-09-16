# Final landing refinement

This is the bounded correction of reviewed candidate
`42f93a8d737401ce67223971d661470026f9ae53`, not a new landing direction.
PR #241 remains a draft and Plan 054 remains active for physical-device review.

## Before and after

The before frames were freshly captured from `42f93a8` before editing. The
after frames show the corrected composition. Files ending in `-full` expose
the complete page at the named width by increasing capture height. They do
not claim that the full page fits in one physical viewport. The corresponding
files without `-full` use the normal viewport.

| View | Before `42f93a8` | Refined candidate |
|---|---|---|
| 320 EN, full | [Before](before/320-en-full.png) | [After](after/320-en-full.png) |
| 390 EN | [Before](before/390-en.png) | [After](after/390-en.png) |
| 390 EN, full | [Before](before/390-en-full.png) | [After](after/390-en-full.png) |
| 390 PT-BR | [Before](before/390-pt-full.png) | [After](after/390-pt-full.png) |
| 430 EN | [Before](before/430-en-full.png) | [After](after/430-en-full.png) |
| 768 EN | [Before](before/768-en-full.png) | [After](after/768-en-full.png) |
| 390 dark | [Before](before/390-dark-full.png) | [After](after/390-dark-full.png) |
| 390 at 200% | [Before](before/390-text200-full.png) | [After](after/390-text200-full.png) |
| Shared EN | [Before](before/390-shared-full.png) | [After](after/390-shared-full.png) |
| Shared PT-BR | [Before](before/390-shared-pt-full.png) | [After](after/390-shared-pt-full.png) |
| Invalid link | [Before](before/390-invalid-full.png) | [After](after/390-invalid-full.png) |

The folders also contain reduced-motion, forced-colors, safe-area, PT-dark
and PT-enlarged-text frames. The final matrix adds 320 PT-BR and 320 EN/PT
at 200% to the original 16 cases.

## What changed

At 320, logged work, its factual explanation and the next target occupy one
vertical sequence. A thin divider separates cause and consequence. The target
has the strongest emphasis; its number and unit remain on one line, including
at 200% in both languages.

At 768, the introduction spans a 640px editorial column, followed by the two
actions on one row. Below it, the device and all three proof stages form one
figure. The ending follows that whole figure. Copy and product are no longer
independent mobile columns with an empty lower-left region.

The live result overlaps the lower device on phones and its right edge on the
wide canvas. The offset leaves part of the device edge visible behind it. The
orange crop-boundary rule is gone. All three actual history rows stay visible,
and all facts remain in semantic HTML. The explanation now sits with the
logged work, before the dominant next target.

The header mark and wordmark have slightly stronger proportions. The actions
use 52px minimum height, tighter spacing, adjusted padding and smaller arrows.
Their labels, primary/secondary distinction and behavior are unchanged.

The exact EN/PT headline, supporting paragraph and Plan/Lift/Progress ethos
come from `7970192deae4a197410ea7f42ce8fa093b733f50`. The ending uses that
commit's exact guidance benefit title and description. No new positioning copy
or marketing section was added.

## Product and renderer provenance

The four accepted Form iPhone Studio assets are unchanged. They retain the
Front + Soft Studio configuration and the verified real-app fixture from the
[product-led refinement](../premium-landing/README.md). No phone was rerendered
for this composition-only pass. The demonstrated facts remain three sets of
60 kg × 10 at RIR 2, producing three upcoming sets of 62.5 kg × 8.

## Proof

```sh
REPFORGE_URL=http://localhost:8914/ node tools/capture-landing-proof.mjs --matrix /tmp/landing-final
REPFORGE_URL=http://localhost:8914/ node tools/capture-landing-proof.mjs --matrix /tmp/landing-priority --cases 320-en,390-en,390-pt,768-en
REPFORGE_URL=http://localhost:8914/ node test/install-modes.mjs
```

The final [matrix report](after/proof.json) passes all 19 cases. Assertions
cover truthful next-target data, the localized loaded image, narrow vertical
ordering, number/unit containment, actual device/result overlap, ending below
the complete proof, overflow and reachable controls. The install suite passes
452 assertions, retaining its first-viewport actions, contrast and full text
scaling checks. Eighteen affected catalog frames were regenerated.

`--fault-narrow` deliberately restores a compressed two-column result at 320;
the production checker rejects it at the vertical-order assertion. `--fault-wrap`
separates the load and unit; the same checker rejects it at the containment
assertion. See [narrow fault](fault-narrow.txt) and [unit fault](fault-wrap.txt).
These are expected failing commands, distinct from the passing matrix.

During correction, the new containment assertion also rejected the first
320-at-200% treatment. Reducing only the oversized target numeral to 2.875rem
at narrow widths preserved 200% scaling and restored its gutter. The ending
now wraps as full-width text at enlarged sizes. The independent visual reviewer
inspected the corrected 320/390/768 and EN/PT enlarged frames and found no
remaining concrete visual blocker. Final clean-commit proof and broader
regression results are recorded on PR #241.

## Remaining review boundary

At 200%, the long Portuguese headline can break inside "exatamente". Every
character remains visible; its exact wording and full text enlargement are
preserved. The device screen remains an illustrative raster with equivalent
HTML facts. Physical Safari, Home Screen, Android and assistive-technology
acceptance still belong to the owner review gate.
