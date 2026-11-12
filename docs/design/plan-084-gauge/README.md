# Plan 084: three disposable gauge directions

Design question: how can saved training feel like a growing investment without
turning effort reporting into a percentage to fill?

[Plan and owner questions](../../../plans/084-gauge-return.md).
These are synthetic fixtures and candidate copy, not a shipping UI or an
approved decision. Open `index.html` directly in a browser. No server, app boot,
storage, service worker, analytics, network requests or training mutations.
Fonts and tokens load from the repo. Only relative local files are needed.

## Compare

Use the floating prototype controls or the left/right arrow keys to switch
directions. Every selection is in the URL. The tools are absent from captures.
The Start session action jumps to the simulated saved finish; it does not
implement Focus or claim a workout happened. Gauge taps open Overview. The
finish reader has an explicit return link, illustrated in the interactive page.
Other dock destinations are context-only links back to Overview.

| Direction | Question it answers | Contact sheet |
| --- | --- | --- |
| A, evidence ring | Does #636's compact glanceable shape work when each segment means one lift with saved evidence used in a later target? Recommended. | [A](contact-a.png) |
| B, coverage rail | Is a flat coverage bar plus an explicit load/basis/used table clearer than a ring? | [B](contact-b.png) |
| C, history in use | Is an open-ended source-session count enough to convey investment without a completion total? | [C](contact-c.png) |

Each sheet contains 24 whole 390 × 844 screens. Columns are Today fresh,
Today mid-way, Today well-tailored, Overview mid-way, finish previous reading, finish
updated reading. Rows are PT light, PT dark, EN light, EN dark. The two finish columns
show the same simulated save, not two sessions. Replay the change in the
interactive page. Reduced motion uses the immediate final state.

Example file URL query, appended to `index.html`:

```text
?variant=A&screen=today&stage=mid&lang=pt&theme=dark
?variant=B&screen=overview&stage=mid&lang=en&theme=light
?variant=C&screen=finish&stage=mid&lang=pt&theme=dark
```

`freeze=before` holds the pre-save gauge for capture. `capture=1` hides the
review tools. The simulated finish always uses 1/4 → 2/4 and five → six source
sessions regardless of the stage selector. The fresh Today has an onboarded
four-lift program with no saved sets, not the product's no-program state.
Overview's text labels are current standing; the gauge is historical earned
evidence. After a real break those can differ, as the plan explains.

## Sources and limits

The page imports the actual `styles.css`, including local Plex fonts and the
`:root[data-theme]` theme swap. It uses Today's `.pagehead` and `.rxrow`,
Overview's `.tabrow`, `.profile-lifts`, `.profile-finding`, and the summary's
eyebrow/hero/ledger structure. It keeps the training values, quiet hairlines,
CTA and four-destination dock in view. Prototype-only CSS arranges the new
gauge and confines the frame; it names production colour tokens. The ring and
bar are ink, with no new orange-budget use or colour scale.

Historical comparison: `758e298b3^` has the removed Today title/bar ring,
Overview percentage/six bars and `calib.*` EN/PT copy. The Plan 054 standalone
prototype informed the local token reuse and language/theme controls. Ring
history was read in `calib-ring-prototype.md` and `plan077-calibration.md` in
the owner's project memory. The selected test-set-dot ring shipped in #636;
these designs deliberately propose a different denominator and no percent.

The Overview frame is an excerpt, not a plan to delete the remaining signals,
findings or recent-test rows. There is no live estimator, engine replay or
persistence proof in this prototype. No collapsed-header scrolling, screen
reader, 200% text, physical device or production fidelity acceptance is claimed.
The visible count changes illustrate the proposed projection; they do not
establish that every older log can reproduce a historical prescription.

## Reproduce only these artifacts

From the repo root, using the existing pinned browser tooling and Python Pillow:

```bash
flock /tmp/taurifer-browser.lock node docs/design/plan-084-gauge/capture.mjs
```

If this worktree has no test-only dependencies but the shared clone does:

```bash
NODE_PATH=/home/ubuntu/repforge/test/node_modules \
  flock /tmp/taurifer-browser.lock \
  node docs/design/plan-084-gauge/capture.mjs
```

This captures exactly the three directions and four language/theme combinations.
It launches one browser, retains source frames in an announced temporary
folder, closes it, then lays those unchanged pixels into three labelled PNGs.
`contact-sheets.py` is a contact-sheet assembler, not a screenshot editor.
No test suite or CI command is part of this design phase.
