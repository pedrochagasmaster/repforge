# PR #241 product-led landing refinement

Starting candidate: `7970192deae4a197410ea7f42ce8fa093b733f50`.
The [design decision](../../design/plan-054-landing-directions.md#owner-directed-product-refinement-2026-09-15)
records the owner authorization and rationale. Plan 054 remains active, with
physical-device acceptance pending.

## Compare the actual landing

The `before/` frames come from the unchanged starting commit, served separately
from a Git archive. The current candidate is captured in `after/`. Files without
`-full` preserve the specified first viewport. Full frames keep the same width
and expand browser height to show the whole landing. They are composition
references, not evidence that all content fits in one physical viewport.

| State | Before | After |
|---|---|---|
| 320 EN | [Before](before/320-en.png) | [After](after/320-en.png) |
| 390 EN | [Before](before/390-en.png) | [After](after/390-en.png) |
| 390 EN, whole composition | [Before](before/390-en-full.png) | [After](after/390-en-full.png) |
| 390 PT-BR | [Before](before/390-pt.png) | [After](after/390-pt.png) |
| 430 EN | [Before](before/430-en.png) | [After](after/430-en.png) |
| 390 dark | [Before](before/390-dark.png) | [After](after/390-dark.png) |
| 390 enlarged text | [Before](before/390-text200.png) | [After](after/390-text200.png) |
| 768 EN | [Before](before/768-en.png) | [After](after/768-en.png) |
| Shared EN | [Before](before/390-shared.png) | [After](after/390-shared.png) |
| Shared PT-BR | [Before](before/390-shared-pt.png) | [After](after/390-shared-pt.png) |
| Invalid link | [Before](before/390-invalid.png) | [After](after/390-invalid.png) |

Additional final frames cover 360px, Portuguese dark, Portuguese at 200%,
reduced motion, forced colors, and simulated safe-area insets. The catalog
remains the canonical phone reference. This folder includes the required 768px
proof, which intentionally does not enter the mobile-only catalog.

## Reproduce the product render

Source captures live in `source/`. The source route is an active Focus workout,
Upper body in English or Superiores in Portuguese, with one barbell bench press
exercise. The fixture prescribes 3 sets at 8–10 reps. All three previous sets
are 60 kg × 10 at RIR 2. The actual app computes 62.5 kg × 8 for each of the three upcoming sets.

The fixture is in `test/fixtures/landing-proof.json`. The source tool verifies
the actual Focus inputs and each actual history row before capturing pixels.
It then switches to the app’s List view and verifies all three upcoming
load/repetition pairs. The source fault test corrupts set 3 to reject an error
that checking only the first set would miss.
The example is test data, never written into a real visitor's training state.

Run from the Taurifer worktree with a static server already running:

```bash
REPFORGE_URL=http://127.0.0.1:8914 node tools/capture-landing-proof.mjs --source /tmp/landing-source
REPFORGE_URL=http://127.0.0.1:8914 node tools/capture-landing-proof.mjs --matrix /tmp/landing-matrix
```

Both commands accept `--fault-next`, which deliberately substitutes 99 for the
next load and must exit nonzero through the same assertion as the normal run.
The matrix also accepts `--fault-overflow`, which forces a 200vw result panel
and must fail the normal overflow assertion. These rejections prove the tool
does more than photograph whatever is present.

The 430×932 CSS viewport uses 3× DPR. The resulting screenshots are 1290×2796.
Existing safe-area expressions resolve to 59px top and 34px bottom in the capture
route. This keeps device hardware clear of app content without drawing a fake
status bar or changing the product. It is emulation, not physical iOS testing.

Render each of the four source variants with the existing Form CLI:

```bash
cd /home/ubuntu/projects/form-iphone-studio
node bin/form-studio.mjs render /tmp/landing-source/workout-en-light.png \
  --config /home/ubuntu/repforge-ui-054-landing-entry/docs/pr-proof/premium-landing/render/scene.json \
  --resolution 2160 --transparent --timeout 120000 -o /tmp/landing-en-light.png
```

The same configuration renders `en-dark`, `pt-light` and `pt-dark`. It selects
`iphone15`, Front, Soft Studio, fit, zoom 1, neutral screen position, 9:16,
2160px, transparent background, no ground and a -8° device yaw.

Renderer base: `605f1650e7454baebe9c34fac33cc43d7d0490e0`. The initial renderer
export incorrectly showed the studio sample screen. That export was rejected.
The [recorded CLI patch](render/form-studio-upload.patch) waits for initial
model readiness before uploading, closing the placeholder/upload race. CLI
argument and screen-texture regression checks passed after the fix. The patch
is applied in the devbox renderer and must be present when reproducing this
asset from that renderer revision.

[Selected Front / Soft Studio](render/front-soft-studio.png) and
[alternative Three Quarter / Bright Product](render/three-quarter-bright-product.png)
record the camera decision. The alternative predates the final taller source
capture and is evidence of camera/light exploration only. The final source
shows all three rows without scrolling or occlusion.

After rendering, trim only transparent margins and encode WebP:

```python
from PIL import Image
image = Image.open('/tmp/landing-en-light.png')
image = image.crop(image.getbbox())
image.save('landing-workout-en-light.webp', quality=88, method=6)
```

The 1215×2160 render trims to 759×1566. All production paths, hashes and sizes
are recorded in [asset inventory](assets.json). Model attribution and licence
are in [brand assets](../../../assets/brand/README.md).

## Verification

The production example, source capture, device image selection, overflow and
control reachability are proved through the actual app. Install-mode tests
retain geometry, copy scaling and contrast assertions, while replacing exact
photograph-mask and small-phone placement constraints. The new contract
requires live prescription, logged work and next target facts, a prominent
product image, and both entry actions in the normal-size first viewport.

Focused and affected regression results are recorded in the final PR checkpoint.
The retained development failures are separate from final passing proof:

- Initial affected invocation stopped in Node 22.23.2's undici parser before
  any suite ran. An explicit worktree server avoids the default-port probe.
- Updated install assertions rejected the old landing, 308 passed / 100 failed.
- The matrix rejected the missing PT-dark production asset before its export
  finished. It was rerun after all four assets existed.
- The first affected run found a catalog locale-check collision: the new
  landing exercise label also appears as editable program data. Landing
  translation markers now apply to the three registered landing routes.
  Deliberate English-copy injections prove all three still fail, and global
  entry-copy markers still fail outside them. The exact corrected suite passed.
- The catalog contract still asserted an obsolete headline/action. Those two
  semantic expectations now name the current copy; the exact EN/PT contract
  passed with its deliberate copy, overlap, clipping and wrong-route faults.
- The first full catalog process received SIGTERM after 457 frames without a
  capture assertion failure. The detached rerun completed all 469 frames successfully.
- The first new no-image oracle counted the global navigation fade behind the
  opaque landing dialog. Its corrected scope stops at that dialog, preserving
  the check against imagery that can actually paint behind the landing text.

Independent review closed two findings: the example is explicitly labeled so
it cannot be mistaken for a received program, and the phone crop no longer
reveals its bottom bezel beneath the HTML result. The reviewer found no
remaining blocker after inspecting 320, 390, 768 and 200% frames.

## Remaining trade-offs

- The app screen inside a device remains a raster. Its controls are illustrative
  and do not reflow. Every progression fact also appears as localized HTML.
- The larger product view needs scrolling on a physical phone. Both entry
  actions stay early; the page does not shrink its product to fit everything
  into one viewport.
- Four localized/theme renders total 187,608 bytes in the offline cache,
  65,094 bytes more than the two retired landing images. Each visible render
  is under 49 KB.
- The renderer's hardware is a proportion-adjusted Pro model. The landing
  makes no hardware claim.
- Browser evidence does not close physical Safari, Home Screen, Android,
  VoiceOver or TalkBack acceptance. Owner review remains open.
