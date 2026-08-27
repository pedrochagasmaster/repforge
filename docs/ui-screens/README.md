# UI screen catalog

Exhaustive phone-frame captures of Taurifer's primary surfaces in both Appearance themes.
This folder is the visual reference for UI and Brand Designers.

**Agents: keep this folder in sync.** Whenever a change alters a user-visible surface
(`index.html`, `styles.css`, `app.js`, `i18n-*.json` copy that appears on screen, sheets,
first-run, or install UI), regenerate both theme folders before merging. Do not ship a UI
change that leaves these PNGs showing an older layout, palette, or label. See `AGENTS.md`.

## Layout

```text
docs/ui-screens/
  README.md     ← this file
  light/        ← cream paper theme
  dark/         ← warm charcoal theme
```

Filenames are identical across `light/` and `dark/` so a designer can compare a pair by name.
Each PNG is a 390×844 logical viewport at 2× device scale, English, kilogram units, against a
seeded three-day program with enough history for Progress and History to look lived-in.

## Screens

| File | Surface |
| --- | --- |
| `01-today.png` | Today — ready to start |
| `02-today-day-picker.png` | Today — choose another day sheet |
| `03-workout-list.png` | Workout — list mode |
| `04-workout-focus.png` | Workout — focus mode |
| `05-rest-timer.png` | Rest timer sheet |
| `06-exercise-note.png` | Exercise note sheet |
| `07-exercise-detail.png` | Exercise detail (illustrated) |
| `08-progress-overview.png` | Progress — overview |
| `09-progress-exercise-chart.png` | Progress — exercise strength chart |
| `10-progress-strength.png` | Progress — Strength |
| `11-progress-volume.png` | Progress — Volume |
| `12-progress-prs.png` | Progress — PRs |
| `13-progress-review.png` | Progress — Review |
| `14-history.png` | History |
| `15-history-session.png` | History — expanded session |
| `16-library.png` | Exercise library |
| `17-exercise-preview.png` | Exercise preview (illustrated) |
| `18-program.png` | Program |
| `19-share-setup.png` | Share setup link sheet |
| `20-program-text.png` | Program text export sheet |
| `21-settings.png` | Settings |
| `22-settings-appearance.png` | Settings — Appearance row |
| `34-settings-privacy.png` | Settings — privacy and analytics |
| `23-exercise-picker.png` | Exercise picker sheet |
| `24-custom-exercise.png` | Custom exercise sheet |
| `25-session-summary.png` | Session summary |
| `26-today-done.png` | Today — session complete |
| `27-tour.png` | Feature tour |
| `28-first-run.png` | First-run gate |
| `29-onboarding.png` | Create-program onboarding |
| `30-shared-setup-gate.png` | Shared setup confirmation gate |
| `31-install-banner.png` | Install banner |
| `32-ios-install-sheet.png` | iOS install instruction sheet |
| `33-why-this-weight.png` | Why this weight sheet |

## Regeneration

Serve the repo root, then rewrite both theme folders:

```bash
python3 -m http.server 8000
node tools/capture-ui-screens.mjs
```

The script is the only supported way to refresh these images. Do not hand-edit the PNGs,
and do not capture against an unseeded or partial install — designers need a stable,
comparable pair. Appearance (System/Light/Dark) must be present in the running app.

Captured 2026-08-27 · 34 screens × 2 themes.
