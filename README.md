# Taurifer

Taurifer is a local-first mobile PWA for tracking load progression and progressive overload.

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
- Exercise library of 270 movements with English and Portuguese names, searchable by either
- Illustrations for 24 movements; everything else shows a plain placeholder
- Browse, preview and add several exercises at once, then set their sets and reps
- Custom exercises you create yourself, reusable across programs and portable with them
- Program import reviewed name by name before anything is written
- Share a setup link from Program: this program, its settings, and the app language. Workout history is not included. System share sends title plus URL; Copy link is the URL only
- Visual program editor (add/reorder/remove days and exercises), with raw-JSON advanced mode
- Volume audit with direct and partial set counting
- JSON backup/import
- Plain-text program export, to read or paste into a chat
- CSV export
- Offline-capable service worker

## Local-first data model

The app files can be hosted on GitHub Pages, but ordinary training data stays on this device. There is no account, no sync, and no cross-device recovery.

Taurifer never uploads ordinary workout data. A setup link is an intentional share: the coach creates a URL and sends it themselves. The program travels in the URL fragment (`#setup=`), which is not part of the initial HTTP request to GitHub Pages. The temporary installation-handoff cookie is sent to the static host as described below.

Distinguish four things:

- **Ordinary training data** — sessions, the log, drafts, and program history — remains on this device.
- **A setup link** — an intentional share of the active program, its configuration, allowlisted app settings, and language. The semantic payload is kind `taurifer-shared-setup` version 1. The fragment carries a self-contained `v1.` canonical JSON+gzip envelope or a `v2.` compact tuple JSON+gzip envelope; both decode forever, and new links pick the shorter valid candidate (tie `v1.`). Anyone who has the URL can read and start that program during first-run setup. Encoding and compression are not encryption. The link cannot be revoked. The encoded value has a hard 3,072-character ceiling. A representative complete production URL is a 700-character regression target, not a universal maximum; notes-heavy or custom-heavy programs may be longer and are never truncated. Outbound system share is title plus URL only; the privacy and cookie text stays in the in-app sheet.
- **The temporary install-handoff cookie** (`repforge_setup_v1`) — the same compressed `v1.` or `v2.` proposal, kept up to seven days so iOS/iPadOS 17.2+ Add to Home Screen can recover it in the installed app. The cookie name is a historical identifier and stays `repforge_setup_v1` even for `v2.` values. Older iOS versions can still open the link in the browser; this app does not claim that an older Home Screen install will inherit the proposal, and it does not claim physical iOS validation. The cookie is sent with the matching `index.html` request. It is not workout history.
- **Excluded workout history** — logs, completed sessions, prior blocks, notification permission, and device UI preferences are never included.

A recipient with no program sees the existing first-run gate. Create and Import are replaced by one Start this program action. Opening the link does not write the shared program; that happens only when they start it. Someone who already has a program, logs, or archived program history is not overwritten.

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
shared-setup.js         # setup-link codec (v1/v2 envelopes)
exercises.js            # generated exercise library (see tools/README.md)
assets/exercises/       # the 24 licensed exercise illustrations
manifest.webmanifest
sw.js
icons/                  # SVG source, PWA icons, Apple touch icon, and iOS launch images
tools/                  # offline generators; nothing here runs in the browser
docs/ui-screens/        # light/dark phone-frame catalog for UI and Brand Designers
.nojekyll
```

Exercise data derives from a third-party dataset; see [NOTICE.md](NOTICE.md).

## UI screen catalog

`docs/ui-screens/` holds an exhaustive set of phone-frame captures of every primary surface in both Appearance themes (`light/` and `dark/`). It is the visual reference for UI and Brand Designers. Regenerate it with `node tools/capture-ui-screens.mjs` whenever a user-visible surface changes — see that folder's README and `AGENTS.md`.

## Development

Serve locally instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
