# Plan 084, round 3: Your profile / Seu perfil

[Plan, model, simulation and remaining decisions](../../../plans/084-gauge-return.md).
[One contact sheet](contact-sheet.png).

The owner chose A's ink ring and the name Your profile / Seu perfil. This
round replaces the short-lived four-lift completion count with per-lift stages
and saved-session depth. B and C are retired; their round-1 artifacts remain
in Git at `a02c7a567`.

Open `index.html` directly. Use the prototype controls to switch screens,
fresh/mid/well-tailored evidence, language and theme. Selections live in the
URL, not storage. Gauge tap opens Overview; each lift opens its stage reader;
Back returns to Overview. The finish can replay its saved stage step. The Finish step control also
shows Solid and the first saved test set, at the same 8-unit stage weight.
Use `screen=finish&event=solid` or `screen=finish&event=checked`. The
Start session link skips to a synthetic saved finish, not a real Focus flow.
History and Program dock links are context-only links back to Overview.

```text
?screen=today&stage=mid&lang=pt&theme=dark
?screen=overview&stage=mid&lang=en&theme=light
?screen=lift&lang=pt&theme=light
?screen=finish&lang=en&theme=dark
?screen=scope&lang=pt&theme=light
```

The single sheet contains 32 whole 390 × 844 browser captures. Columns:

1. Today, fresh, 0/320 internal steps.
2. Today, mid-way, 157/320, beginner week 5.
3. Today, well-tailored, 272/320, beginner week 16. Still room to grow.
4. Overview, with Your profile as the heading and the existing sentence below.
5. Cable row's attained stages, current standing, depth and next condition.
6. Finish with the previous ring reading, 157/320.
7. The same finish with its updated reading, 168/320.
8. A week-8 scope expansion, 200/320 → 200/480, with all learned steps retained.

Rows are PT light, PT dark, EN light, EN dark. Fractions above are design
arithmetic, never percentages printed in the product. Only the evidence
counts and explanations appear on screen. `capture=1` hides prototype tools;
`freeze=before` holds the old finish reading. Review copy is synthetic and
pending owner approval.

## Where the evidence comes from

`simulate.mjs` constructs its own synthetic completed sessions and calls the
shipped `progression-engine.js` and `effort-calibration.js` public interfaces.
`simulation.json` retains every week's per-lift standing evidence, calibration
count/bias/spread, attained transitions, depth and total. `simulation-shares.md`
and its JSON companion separate stage and date contributions at week 16. `simulation-table.md`
and `simulation-chart.html` are generated from it. The latter uses the small
`render-simulation.py` helper. Run the simulation without launching a browser:

```bash
node docs/design/plan-084-gauge/simulate.mjs
```

This is scenario arithmetic, not a test suite. There are no assertions, app
writes, test fixture imports or CI calls. It does not predict actual people.
The beginner's agreeing test sets deliberately model a fast calibration path;
the ring still has months of saved-session depth left. The intermediate has
no test sets and continues gaining evidence through all 16 weeks.

The history path at 32/64 dates is approved. The recommended weighting is
8 units per attained transition and ¾ per saved lift-date, retaining the
64-date runway and an 80-unit per-lift budget. The plan is approved in substance. Existing standing and calibration
thresholds are read from production modules, not changed. Findings and opening
loads explain evidence; they do not add duplicate steps. The UI fixtures use
the generated week-5/week-16 totals, with a separate explicit three-check
finish example. They are not a second production implementation of the model.

## Rendering

The prototype loads the repo's actual `styles.css` and local Plex fonts,
including the root light/dark token swap. Today retains `.pagehead` and
`.rxrow`; Overview retains `.tabrow` and `.profile-lifts`; finish keeps the
saved-summary ledger, factual totals and Done action. The new ring/stage reader
uses those same ink, paper, type, hairline and control tokens. No app scripts,
service worker, storage, analytics or network service is loaded.

Reproduce only these design captures, using the existing pinned browser and
Python Pillow:

```bash
NODE_PATH=/home/ubuntu/repforge/test/node_modules \
  flock /tmp/taurifer-browser.lock \
  node docs/design/plan-084-gauge/capture.mjs
```

For this round, only the 24 frames with changed fill or numbers were rendered:

```bash
NODE_PATH=/home/ubuntu/repforge/test/node_modules \
  flock /tmp/taurifer-browser.lock \
  node docs/design/plan-084-gauge/capture.mjs \
  --reuse /tmp/gauge-084-lAuVOg/cells.json
```

That retained manifest holds round-2 source images. The eight unchanged Today
fresh and per-lift-reader cells are used directly, not re-rendered or edited.
The new manifest labels each retained/rendered cell. The contact-sheet layout
remains eight columns by four rows. If the temporary source archive is gone,
the first command rebuilds the full sheet; it is not the command run for this
round. The finish now counts four new lift-date observations and one stage,
157 → 168 weighted units, with no percentage or weighted total printed in-app.

The approved before/now scope explanation is shown once per actual growth,
with acknowledgment surviving reload. It is not a screen on every visit.

If dependencies are already available under this worktree's `test/`, omit
`NODE_PATH`. One browser captures only the eight requested/complementary scenes
in the four language/theme combinations. It closes before the contact-sheet
assembler lays the unchanged pixels into one PNG. Raw frames are retained in
an announced temporary directory. Do not launch a second browser alongside it.

The fill moves once after the synthetic save, with no celebration. Reduced
motion uses the finished state. Stage check marks are static evidence labels,
in ink, not rewards. The scope-change scene keeps both static readings rather
than animating a drain or hiding a changed denominator.

The screen is an excerpt of the profile, not a proposal to remove its signal
counts, findings, dates or recent checks. Collapsed-header scrolling, full
production navigation, screen readers, 200% text and physical devices are not
validated by these pictures. No tests or CI run in this design round.

## Production scope acknowledgment contract (PR 2)

`repforge_ui_v1.profileScope` is a device-only UI preference with exactly
`{v: 1, scope: string[], acknowledged: boolean}`. `scope` is the sorted,
deduplicated set of canonical comparable identities last accepted by the
presentation. The automatic fresh baseline is `{v:1,scope:[],acknowledged:false}`.
Only that exact empty automatic record is ignored for install-transfer
destination eligibility. An explicit acknowledgment, an unknown version or
field, and malformed records remain protected. The existing generic UI-preference
clone carries the whole record; no training, draft or transfer schema changes.

The first nonempty program establishes the automatic baseline. Subsequent
identity changes retain the old baseline until the before/now explanation is
acknowledged. Acknowledgment replaces the baseline with the current scope and
sets `acknowledged:true`; a later scope change is therefore a new explanation.
The ring uses the current denominator immediately and never animates backwards.
A reload preserves both pending and acknowledged comparisons. No-program
surfaces have no ring, and boot never rewrites an unknown or malformed record.
