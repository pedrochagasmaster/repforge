# Fidelity: solid light selected lens (PR 833, issue #824)

Reference: the production dock on main (the floating dock's filled lens, plan 057/058 and `docs/design/interaction-runtime-audit.md` N1), and PR 819, which made the same change for dark. This change swaps one token in light only: `--dock-pill` goes from `rgba(255,255,255,.82)` to `#FFFFFF`. Dark is unchanged.

`dock-before-after.png` shows the dock band of six light catalog states. Main's token is on the left, this PR's in the middle, and their pixel difference, amplified 40 times, on the right. Both sides were rendered by the same local browser from the same commit, with only the token toggled. They are a review aid, not catalog frames.

Frames changed in the catalog: none. CI's catalog verify on bff4f9d passed with no `ci-captures` artifact, so every light frame still matches within the catalog's comparison limits. Locally, the change is confined to the selected lens: at most 3 to 9 levels out of 255 per channel, over about 13,000 device pixels per frame.

## Every visible difference

1. **The selected lens no longer shows the page through it.** Before, the lens was 82% white, so whatever scrolled under the dock tinted it faintly; on today/ready 320 PT, the "Triceps…" row shows through the "Hoje" lens. Now the lens is solid white and hides what is under it. The rest of the dock is still translucent frosted glass.
2. **Contrast is now fixed, whatever is under the dock.** Measured with the rendered-role checker (`test/native-feel.mjs`), the 11px `--accent-deep` label over a pure black block went from 4.47:1 (below AA) to 5.53:1, and over a dark photo-like gradient from 4.55:1 to 5.53:1. The `--accent` icon, calculated on the same measured grounds, went from about 3.2:1 to about 4.0:1.
3. **No change** to tab layout, labels, icons, colours of unselected tabs, the lens geometry, its travel, or the dark theme.
