# Plan 084, round 2: Your profile / Seu perfil

[Plan, model, simulation and remaining decisions](../../../plans/084-gauge-return.md).
[One contact sheet](contact-sheet.png).

The owner chose A's ink ring and the name Your profile / Seu perfil. This
round replaces the short-lived four-lift completion count with per-lift stages
and saved-session depth. B and C are retired; their round-1 artifacts remain
in Git at `a02c7a567`.

Open `index.html` directly. Use the prototype controls to switch screens,
fresh/mid/well-tailored evidence, language and theme. Selections live in the
URL, not storage. Gauge tap opens Overview; each lift opens its stage reader;
Back returns to Overview. The finish can replay its saved stage step. The
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

1. Today, fresh, 0/272 internal steps.
2. Today, mid-way, 74/272, beginner week 5.
3. Today, well-tailored, 208/272, beginner week 16. Still room to grow.
4. Overview, with Your profile as the heading and the existing sentence below.
5. Cable row's attained stages, current standing, depth and next condition.
6. Finish with the previous ring reading, 74/272.
7. The same finish with its updated reading, 76/272.
8. A week-8 scope expansion, 112/272 → 112/408, with all learned steps retained.

Rows are PT light, PT dark, EN light, EN dark. Fractions above are design
arithmetic, never percentages printed in the product. Only the evidence
counts and explanations appear on screen. `capture=1` hides prototype tools;
`freeze=before` holds the old finish reading. Review copy is synthetic and
pending owner approval.

## Where the evidence comes from

`simulate.mjs` constructs its own synthetic completed sessions and calls the
shipped `progression-engine.js` and `effort-calibration.js` public interfaces.
`simulation.json` retains every week's per-lift standing evidence, calibration
count/bias/spread, attained transitions, depth and total. `simulation-table.md`
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

The proposed 64-date budget and alternate long-history stage path are new
presentation choices for owner review. Existing standing and calibration
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
