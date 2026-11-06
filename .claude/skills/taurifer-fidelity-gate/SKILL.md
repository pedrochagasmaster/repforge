---
name: taurifer-fidelity-gate
description: "Side-by-side visual review of a Taurifer UI change against its approved prototype or mock before merge: the frame matrix (light/dark, 390/320, normal/200% text, EN/PT, top/scrolled), what to look for at full size, and how to report gaps and deviations. Use whenever a PR or packet changes anything visible, before calling a redesign or polish task done, when reviewing catalog frames or a contact sheet, or when the owner says something 'doesn't look like the prototype'."
---

# Taurifer fidelity gate

Hard rule 19 in `docs/agents/hard-rules.md`: production must match the quality of the approved prototypes across the whole app, and "close enough" does not merge. The gate exists because of real misses. A context menu shipped with missing icons, a hard border where the prototype had a soft surface, and the wrong wording. Pills turned into circles at 200% text, which the reviewer missed because they "only checked the normal-size screenshots".

## 1. Name the reference

Use the approved prototype or mock for this change, as named in the packet brief or the owner's decision. If the screen was never prototyped, use the nearest prototyped screen plus `docs/design/native-ui-kit.md`. Say which reference you used.

## 2. Capture the matrix

For each state the change affects, capture into the design refs `fidelity/<PR>/` folder. Prefer the frames CI already rendered (`node tools/fetch-ci-captures.mjs <run-id>`) over long local captures. Wrap any local capture in `flock /tmp/taurifer-browser.lock`.

| Axis | Values |
| --- | --- |
| Theme | light, dark (check that "dark" frames really are dark: 9 of 220 were once mislabelled) |
| Width | 390, 320 |
| Text | normal, 200% |
| Language | EN, PT (PT wraps differently and moves hotspots) |
| Position | top and scrolled; sheets at rest, never mid-animation |

For motion such as landing demos or timers, use a contact sheet with a frame every 250–500 ms instead of single frames. A change to a shared component needs a few text200 and 320 frames from other screens too.

## 3. Look

Open the PNGs at full size, next to the reference, and check:

- **Material:** a soft translucent surface versus a hard border; blur and opacity.
- **Icons:** present, placed and sized as in the reference.
- **Geometry:** radii that relate to each other (concentric), the spacing rhythm, nothing cropped at the screen edges or tucked under the header, no control wrapping into a new shape at 200%.
- **Copy:** only owner-approved strings, in both languages.
- **Truth:** no screenshot, demo or landing frame shows UI that no longer exists.

## 4. Verdict

- **Match:** one line that lists the frames you looked at.
- **Gaps:** a numbered list. Each item gives the frame file, how it differs from the reference, and the fix. A small deliberate difference, such as 16 px instead of 17 px to match body text, is fine when you say why.
- **Deviations the owner must approve:** put them in a numbered list with your recommendation, so the owner can answer "approve all except 6 and 14".

## 5. After merge

Browser frames are not the phone. Tell the owner which build to check and what to try on the device: momentum, snapping, swipe thresholds and keyboard focus only show up there.
