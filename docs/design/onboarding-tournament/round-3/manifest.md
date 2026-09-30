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

## Polish pass

After Round 4 the owner still wanted G at a premium finish without a
redesign. A polish pass on `g.js` and `g.css` followed, in themed commits,
each checked before it landed. Structure, steps, controls, routes,
information and every Q622–Q637 decision are unchanged; so is every
behaviour the acceptance checks prove. The audit that ranked the findings
is `round-3/polish/AUDIT.md`; before/after pairs for every finding, at
390 PT light, 390 EN dark and 320 PT 200%, are the PNGs beside it
(`<finding>__<checkpoint>__<cell>__before|after.png`).

| Theme | Commit | What changed | Checkpoints affected |
| --- | --- | --- | --- |
| Audit | `a9dea73` | `round-3/polish/AUDIT.md`, 20 ranked findings | none |
| Spacing and the negative margins | `1e462b2` | One scale (4 · 8 · 12 · 16 · 20 · 28); intro stacks for every page head; group heads; the nine negative margins removed | all route pages, chooser, landing |
| Hierarchy and focal points | `e37fb02` | Group questions on body 16/600 sentence case; review section heads on subtitle 18/600; program name on title 30 | question screens, every review, editors |
| The program review as payoff | `4ff6b60` | Facts strip (Mono metric values, caption units); week as hairline bands with a Mono index; cards, disclosures and import metrics as bands; change statement as a label/value grid; reason icons in ink; browse facts without stranded separators | every review, `import-review`, `browse-list`, `rec-background`, build editor |
| Option and chip states | `a72194b` | Numeric cards in Mono metric at 68 px; pressed transform and short transitions on every selection control; answer chips without pencils, open state as the selected grammar; row heights 44/52/56/68; featured block without head tint | schedule, priorities, environment, chooser, every review |
| Inline editors and the pinned activation | `7bde881` | Solid persistent region with a hairline; disabled primary without arrow, reason above; editor rail and spacing; Build editor bands | `activate`, `import-review`, `build-*`, editor open on any review |
| Dark theme | `70c43ed` | Decision panels and the "novo" row on the surface material; resume rail kept in both themes; no focus ring on the conflict alert's own border | all dark cells |
| Motion | `6944b61` | Editor, change statement and "novo" rows rise once as they appear; day chevron turns; Today enters with the view fade; reduced motion unchanged (shared rule) | any apply, editor open, `activated-today` |
| Edge states | `68d3304` | Invalid-link reason as a body band; free-form gap labels sentence case; stage heads in ink; "not imported" note as body-small; quiet Build link in ink | `shared-invalid`, `ff-*`, `import-source` |
| Records and pairs | `fa5a57f` | Manifest, notes, final-report §13, acceptance, before/after PNGs | none |
| Icons | `147b92d` | A 28-glyph icon set drawn for G (24 grid, 1.75 stroke, one optical weight), scoped to the candidate root with its own arrow and check; generator and contact sheets in `round-3/polish/` | every screen with a glyph: chooser, goals, environments, reasons, import, free-form, landing arrows |

Checks before each commit: `tools/verify.mjs --round 3 --quick` plus a
cell and journey subset (`--quick` narrows only Round 1; for Round 3 the
per-commit runs used `--cells` with the interaction checks and the
journeys the theme touched). The full run and both self-tests ran at the
end.

### Acceptance

| Run | Checkpoint cells | Without hard failures | With warnings | Journeys | Passed | Interaction checks |
| --- | --- | --- | --- | --- | --- | --- |
| Freeze (`6724648`) | 360 | 360 | 0 | 122 | 122 | 61 / 61 |
| Baseline of this pass (`0535d92`, reproduced) | 360 | 360 | 0 | 122 | 122 | 61 / 61 |
| After the pass (`68d3304`) | 360 | 360 | 0 | 122 | 122 | 61 / 61 |

Taps, before and after: Rafael from landing to Today 13; correction from
the review 6 (bound 6); avoiding an exercise from the review 5.
`tools/audit-selftest.mjs` and `tools/harness-selftest.mjs` pass.

### Contrast

Measured from the token values in both themes (text at 4.5:1, required
non-text at 3:1): every pair G paints passes, light and dark: ink and soft
ink on page, surface, well and the selected tint; the eyebrow and
ANTES/AGORA labels (4.60:1 light); accent-deep small text (5.53:1 light);
the danger label; the primary's ink on the CTA; the required boundary, the
selected ring, the accent rail and the featured outline. One shared
recipe G does not own is short in light: the landing CTA label, white on
`--accent` (`btn--accent`, the owner-selected burnt-orange landing action)
measures 3.99:1 at 18 px/600, which is under the 4.5:1 that body-size text
needs and over the 3:1 that large text needs. It is recorded as a shared
proposal in the PR comment, not changed here.
