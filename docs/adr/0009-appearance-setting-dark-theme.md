# Appearance is a UI pref, and dark is a palette

`docs/design/ui-overhaul-spec.md` ruled dark mode out when the light editorial
look was specified. The reason was maintenance, not taste: a second palette that
lived in a second stylesheet would double the surface every later change had to
be reviewed against, and the app was a single 2,700-line `styles.css` with no
build step to keep two copies honest.

That reason no longer holds, because the overhaul it was written for is what
removed it. `styles.css` now resolves colour through `var(--*)` 858 times, and
the only literals left outside `:root` were shadows, a handful of `#fff` inks on
filled grounds, four scrims and tints, and two plates that carry the app icon's
own ground. Tokenising those — `--accent-rgb` and its siblings for the
translucent washes, `--accent-ink` for copy on orange, `--scrim`, `--knob`,
`--dock-*-sheen`, `--scheme` — leaves dark as a block of custom properties under
`:root[data-theme="dark"]`. No rule below that block names a colour, so the
review question for a new rule stays "does it use a token", exactly as before.

Shadows deliberately stay literal. They are black in both themes because their
job is to darken whatever is behind them, and the elevation they draw reads
against `--surface` on `#141310` as well as it does on cream.

The palette is warm charcoal rather than neutral grey. The burnt orange, the 96
licensed exercise illustrations and the app icon were all drawn on warm paper,
and a grey ground puts them on a different object. Two roles invert rather than
darken: the CTA, because a near-black pill disappears on near-black paper, so it
becomes a light pill with `--cta-ink` dark; and `--accent-deep`, whose job is
emphasis, which on dark means the *lighter* orange. That is why copy on a filled
orange ground reads `--accent-ink` and not `--cta-ink` — the two inks move in
opposite directions between themes.

The exercise illustrations keep their own paper. Each carries a sampled
`mediaBg`, and the detail view still bridges from `--bg` to it, so on dark the
drawing sits in a lit field instead of being dimmed or inverted. Inverting
licensed artwork would be a change to the artwork.

## Where the setting lives

Appearance is stored in `uiPrefs` (`repforge_ui_v1`), not `state.settings`.
Which paper this device prefers says nothing about the training in a backup, and
a setup link that repainted the recipient's app would be reading well past its
remit. Keeping it in UI prefs means it never enters export/import, never enters
a state proposal or the cross-tab write path, and leaves the shared-setup
allowlist at the eight settings `docs/adr/0007-shared-setup-links.md` describes
and `index.html` names to the lifter.

`system` is stored as `system`, not resolved once and frozen. A phone that
switches at sunset should carry the app with it without being reopened, so
`resolvedTheme()` asks `matchMedia` each time and a `change` listener repaints
while the preference is `system`.

## Applying it

`app.js` resolves the preference to `light` or `dark` and writes it to
`<html data-theme>`; `styles.css` reads nothing else. There is no
`prefers-color-scheme` query in the stylesheet, because the attribute is always
the answer and two mechanisms would disagree the moment the lifter picks a
theme explicitly.

Two consequences follow from `app.js` being the last script on the page:

- A dark install would spend the whole load painted cream. An inline snippet in
  `<head>` replays the resolved theme onto `<html>` before the first paint. It
  only reads, and the markup default (`light`) stands if the read throws.
- Browser chrome cannot read a custom property, so `--bg` is spelled out again
  as `THEME_COLOR` in `app.js` and in that snippet. Three copies of two hexes;
  they move together.

The chart is the one surface a token swap cannot reach on its own, because it is
painted into a canvas that has already sampled the palette. `repaintForTheme()`
follows every theme change with `redrawChart()`; `chartPalette()` already reads
the tokens, so nothing about the drawing changed.

`test/appearance.mjs` holds the line: the default follows the system, an
explicit choice survives a reload, the pre-paint snippet applies it before
`app.js` runs, the chart repaints, `theme-color` tracks the theme, and no theme
key reaches `repforge_v1` or a shared setup link.
