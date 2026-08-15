# Taurifer

Taurifer is a local-only mobile PWA for tracking load progression and progressive overload.

The name is new; the repository slug, GitHub Pages URL, and on-device storage keys keep the historical `repforge` prefix so existing installs and training data are untouched.

## Features

- Progressive overload for machines, cables, dumbbells, barbells, and bodyweight
- Mobile-first workout logging
- Load, reps, and RIR per working set
- Double-progression recommendations
- Previous-session display
- Session summary at the end of a workout: records, lift movement, hard sets per muscle, and the week
- Stats dashboard with top-load chart
- Training history and session deletion
- Visual program editor (add/reorder/remove days and exercises), with raw-JSON advanced mode
- Volume audit with direct and partial set counting
- JSON backup/import
- Plain-text program export, to read or paste into a chat
- CSV export
- Offline-capable service worker

## Local-only data model

The app files can be hosted on GitHub Pages, but training data stays on this device. There is no account sync or cross-device recovery.

Nothing is sent to GitHub or any backend by the app.

Use **Settings → Export backup JSON** before clearing browser data or changing phones.

## GitHub Pages deployment

This repo is ready for GitHub Pages.

1. Go to **Settings → Pages**
2. Select **Deploy from a branch**
3. Branch: `main`
4. Folder: `/root`
5. Save

The app should become available at:

```text
https://pedrochagasmaster.github.io/repforge/
```

## Files

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icons/                  # SVG source, PWA icons, Apple touch icon, and iOS launch images
.nojekyll
```

## Development

Serve locally instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
