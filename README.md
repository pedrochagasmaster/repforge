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
- Illustrations for 96 movements; everything else shows a plain placeholder
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

The app files can be hosted on GitHub Pages, but ordinary training data stays on this device. There is no account and no sync; the only networked cross-device path is the explicit one-hour install transfer described below (user-mediated JSON backup/import through a file remains a manual path).

Taurifer never uploads ordinary workout data except through that explicit install transfer or opted-in telemetry. A setup link is an intentional share: the coach creates a URL and sends it themselves. The program travels in the URL fragment (`#setup=`), which is not part of the initial HTTP request to GitHub Pages. The temporary installation-handoff cookie is sent to the static host as described below.

Distinguish five things:

- **Ordinary training data** — sessions, the log, drafts, and program history — remains on this device.
- **A setup link** — an intentional share of the active program, its configuration, allowlisted app settings, and language. The semantic payload is kind `taurifer-shared-setup` version 1. The fragment carries a self-contained `v1.` canonical JSON+gzip envelope or a `v2.` compact tuple JSON+gzip envelope; both decode forever, and new links pick the shorter valid candidate (tie `v1.`). Anyone who has the URL can read and start that program during first-run setup. Encoding and compression are not encryption. The link cannot be revoked. The encoded value has a hard 3,072-character ceiling. A representative complete production URL is a 700-character regression target, not a universal maximum; notes-heavy or custom-heavy programs may be longer and are never truncated. Outbound system share is title plus URL only; the Share sheet stays task-only and the privacy and cookie disclosure lives on the cached in-app Privacy page.
- **The temporary install-handoff cookie** (`repforge_setup_v1`) — the same compressed `v1.` or `v2.` proposal, kept up to seven days so iOS/iPadOS 17.2+ Add to Home Screen can recover it in the installed app. The cookie name is a historical identifier and stays `repforge_setup_v1` even for `v2.` values. Older iOS versions can still open the link in the browser; this app does not claim that an older Home Screen install will inherit the proposal, and it does not claim physical iOS validation. The cookie is sent with the matching `index.html` request. It is not workout history.
- **The temporary install transfer** — the one explicit exception that moves established data off the device: after an informed `Install and transfer my data` action, an encrypted one-hour backend record carries an exact logical clone (durable state including logs and history, active draft, UI preferences, consent, telemetry identity) into the installed PWA, then deletes it on claim or expiry. The handoff token travels in a dedicated short-lived `repforge_transfer_v1` cookie, distinct from the setup-proposal cookie above. See `docs/adr/0013-temporary-install-transfer.md`. This is not sync, backup, or an account.
- **Excluded workout history** — logs, completed sessions, prior blocks, notification permission, and device UI preferences are never included in a setup link.

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

## Cloudflare Pages and analytics

The production Cloudflare Pages build command is:

```bash
node scripts/generate-posthog-config.mjs
```

Set `POSTHOG_PROJECT_TOKEN` to the public `phc_...` project token and set
`POSTHOG_HOST` to the HTTPS ingestion origin (the default is
`https://e.taurifer.com`). Production builds fail closed when the token is
missing or either value is malformed. Preview analytics stays disabled unless
`POSTHOG_ENABLE_PREVIEWS=true` is set explicitly.

For a local analytics check, copy `posthog-config.js.example` to the ignored
`posthog-config.js`, replace the public token, and temporarily load it directly
before `posthog-init.js` in `index.html`. Do not commit the generated config or
any project credential. Ordinary local development needs no analytics config.

The service worker treats `posthog-config.js` as a network-first shell file. It
is intentionally not part of the atomic precache because the file only exists
in configured deployments; a missing local analytics config must never prevent
the offline app shell from installing.

## Files

```text
index.html
styles.css
app.js
shared-setup.js         # setup-link codec (v1/v2 envelopes)
exercises.js            # generated exercise library (see tools/README.md)
assets/exercises/       # the 96 licensed exercise illustrations
manifest.webmanifest
sw.js
icons/                  # SVG source, PWA icons, Apple touch icon, and iOS launch images
tools/                  # offline generators; nothing here runs in the browser
docs/ui-screens/        # mobile phone-frame catalog for UI and Brand Designers
.nojekyll
```

Exercise data derives from a third-party dataset; see [NOTICE.md](NOTICE.md).

## UI screen catalog

`docs/ui-screens/screens/` holds phone-frame captures of every primary surface in both Appearance themes, plus every onboarding state across all entry routes. It is mobile-only and is the visual reference for UI and Brand Designers. Regenerate it with `node tools/capture-ui-screens.mjs` whenever a user-visible surface changes — see that folder's README and `AGENTS.md`.

## Development

Serve locally instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Testing

Browser suites (Playwright) and the generative property suite (fast-check) live under `test/` with their own pinned dependencies — see `test/generative/README.md` for the property-based, stateful, and adversarial testing architecture.
