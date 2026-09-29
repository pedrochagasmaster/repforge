# Round 4: production findings

Finish reviewers flagged these problems while reviewing Round 4 candidates. They sit in the production engine or catalogs that the harness reproduces faithfully, so no candidate may fix them. Each needs its own production change.

## PF-1. Growth 3-day Day 1 is named "Lower body hypertrophy" but carries upper-body work

- **Seen in:** the Round 4 captures of `rec-result` and `activated-today` for the Rafael scenario (hypertrophy, 3 days, full gym).
- **Name:** Day 1 compiles with the display key `program.day.growth_3_d1`, which is "Lower body hypertrophy" in EN and "Hipertrofia de membros inferiores" in PT.
- **Contents:** the day's exercises are Leg press, Machine chest press, Seated machine row, Machine Romanian deadlift, Cable lateral raise and Cable curl.
- **Flagged by:** the reviewers for L · Pino and J · Conversa, independently.
- **Source:** the harness only calls `TF.dayName`, which resolves the engine's `displayNameKey`. Both the name and the contents come from `program-compiler.js` and the i18n catalogs, as they do in production.
- **Suggested direction:** either rename the day (for example "Lower-body emphasis") or restrict its accessory slots to lower-body work. This is a product decision to make in its own PR. It is not part of the onboarding redesign.
