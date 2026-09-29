# Round 3 acceptance checks: proof against Round 2

Q634 made Round 3 judge-free, so the defects the Round 2 judges found by hand
became checks K-25 to K-32 (`round-2/JOURNEYS.md` §6). Before building Round
3, each check was run against the frozen Round 2 candidates to confirm it
catches what the judges reported. Runs of 29 September 2026, `tools/verify.mjs
--round 2` with the flags noted.

| Check | D | E | F | Judge report it reproduces |
| --- | --- | --- | --- | --- |
| K-25 import work kept | pass | fail: paste and file tabs, including the active one, lose `ff-reply` and `ff-gaps` | fail: same, on the three doors | Charlie CH-1 |
| K-26 dialog focus | fail: Cancel returns focus to the heading; Recomeçar leaves focus on the page | fail: Escape closes no dialog; Recomeçar leaves focus outside | fail: focus never enters any dialog | Delta F-A1, E-A2, D note on A-3 |
| K-27 focus after an answer | fail | fail | fail | Delta A-shared |
| K-28 change statement in view | fail at 390 and 320/200 | fail at 320/200 | fail at 320/200 | Charlie CH-8, Delta D-2 |
| K-29 editor height | fail: 281 px of 568 | pass (inline) | fail: 153 px of 568 | Delta D-A1, F-A2, D/F-A3 |
| K-30 Skip keeps constraints | fail: "Pular esta seção" drops the pain avoidance | pass | pass | Delta D-1 |
| K-31 raw keys | pass (all 45 checkpoints, cells 1 and 6; `import-source` tap pass clean) | — | fail: "Escrever do zero" shows `entry.route.undefined` | Charlie CH-2 |
| K-32 program first | pass | fail: `rec-result`, `rec-result-corrected`, `custom-result` | fail: `rec-result-corrected`, `custom-result` | Charlie CH-7, Delta E-L3, F-L3 |

The audit and harness self-tests still pass. D's full checkpoint audit in
cells 1 and 6 shows no K-31 or K-32 failure, so neither check has a false
positive on a clean candidate.
