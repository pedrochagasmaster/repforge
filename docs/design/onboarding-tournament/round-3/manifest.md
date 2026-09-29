# Round 3 — manifest

Round 3 is one candidate, G · Síntese: the synthesis both Round 2 judges
converged on, built from the owner decisions Q622–Q637 and checked by the
acceptance run only, with no judging (Q626). Build notes and the source of
every part: `round-3/candidates/g.notes.md`.

- Candidate files: `round-3/candidates/g.{js,css,notes.md}`, page `round-3/app.html`
- Built on: harness and checks at `c9eed95` (checks K-25–K-32 added in `13718e3`, proven against Round 2 in `round-3/acceptance-checks.md`)
- Product decisions: none (PD-1 to PD-4 closed, Q622–Q624)
- Review page: `index.html?round=3`

## Acceptance at freeze

`node docs/design/onboarding-tournament/tools/verify.mjs --round 3`: all 45
checkpoints in all 8 cells, all journeys in cells 1 and 6, and the interaction
checks, including the tap-every-control pass.

| Candidate | Checkpoint cells | Without hard failures | With warnings | Journeys | Passed | Interaction checks |
| --- | --- | --- | --- | --- | --- | --- |
| g | 360 | 360 | 0 | 122 | 122 | 61 / 61 |

Taps: Rafael from landing to Today 13; correction from the review 6 (bound 6);
avoiding an exercise from the review 5.

## What G is not

G is the conventional arm: today's onboarding layout, polished and fixed. After
seeing it, the owner asked for bolder exploration (Round 4), where each
candidate tests a different idea of onboarding in its own visual world. G
stays in the harness as the baseline those directions are measured against.
