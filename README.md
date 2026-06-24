# RepForge

RepForge is a local-only mobile PWA for tracking load progression and progressive overload.

## Features

- Machine-only 3-day split included by default
- Mobile-first workout logging
- Load, reps, and RIR per working set
- Double-progression recommendations
- Previous-session display
- Stats dashboard with top-load chart
- Training history and session deletion
- Visual program editor (add/reorder/remove days and exercises), with raw-JSON advanced mode
- Volume audit with direct and partial set counting
- JSON backup/import
- CSV export
- Offline-capable service worker

## Local-only data model

The app files can be hosted on GitHub Pages, but training data stays in the device browser through `localStorage`.

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
icons/icon.svg
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
