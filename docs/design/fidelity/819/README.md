# Fidelity: solid dark selected lens (PR 819, issue #818)

Reference: the production dock on main (the floating dock's filled lens, plan 057/058 and `docs/design/interaction-runtime-audit.md` N1). This change is a token swap in dark only: `--dock-pill` goes from `rgba(255,255,255,.13)` to `#3A3733`. Light is unchanged.

`dock-before-after.png` shows the dock band of six catalog frames, main on the left and this PR on the right. Each `<state>__<frame>-before.png` / `-after.png` pair is the same crop. The full frames are the catalog's own (`docs/ui-screens/screens/…`), rendered by CI, so CI verifies them.

Frames changed: 32 dark frames, at 390 and 320, EN and PT, every state where the dock shows a selected tab. In each frame only the selected tab's lens moved. No light frame changed.

## Every visible difference

1. **The selected lens no longer shows the page through it.** Before, page text and rules under the selected tab showed faintly through the 13% white pill, for example "Chest-supported row" on progress/review and "92.5" on program/overview. Now the pill is solid smoked glass in the tone it already had over dark pages, so whatever scrolls under it stays hidden. The rest of the dock is unchanged: it is still the translucent smoked glass.
2. **Contrast is now fixed, whatever is under the dock.** The orange label (`--accent-deep`) works out to about 5.0:1 on the pill, and the orange icon (`--accent`) to about 4.0:1. Before, both depended on the page: 4.74:1 on progress/overview PT, 4.39:1 with PR 816's fixture, and about 1.7:1 over a light block.
3. **No change** to tab layout, labels, icons, colours of unselected tabs, the lens geometry, its travel or the light theme.

Not in this set: text200 frames. At enlarged text the whole dock already sits on its opaque material, and the lens uses the same token.
