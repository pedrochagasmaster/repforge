# Screen-by-screen native-fidelity audit (read-only)

You audit committed catalog screenshots of the Taurifer PWA against a native UI kit spec. You do
NOT change any repository file, run tests, or open a browser. Write ONLY your output file.

Inputs:
- The kit: /tmp/taurifer-ui-kit/docs/design/native-ui-kit.md — read it fully first. It is the yardstick.
- The prototype the kit came from (for reference, same palette): /tmp/uikit-proto/{native.css,app.css,tokens.css}.
  Prototype "before/after" photos: `git -C /tmp/taurifer-ui-kit show origin/design/native-feel:docs/design/native-feel/before/<x>.jpg` is not needed; use the kit.
- Production CSS for concrete values: /tmp/taurifer-ui-kit/styles.css and motion-polish.css (grep the selectors you see).
- Screens: your list file (given below). Each line is `flow/id — label: scenario`.
  PNGs are at /tmp/taurifer-ui-kit/docs/ui-screens/screens/<flow>/<id>__phone-390-light-en.png and
  ...__phone-390-dark-en.png. View BOTH themes for every screen (use the Read tool on the PNG). If a
  file is missing, list it as missing and move on. Glance at the -text200 variant only where it exists and something looks broken.

For every screen state, judge against the kit's rules: no boxed surfaces / 1px outlines around cards,
lists, menus, dialogs, previews; hairline separators; glass only where content scrolls under;
one row anatomy (height, insets, value text, chevron); pill buttons (rectangular buttons are off-kit);
icons in menus/rows from the G set; type roles and tracking, tabular Mono numerals, consistent
number styling; spacing rhythm (16 gutter, 26 between groups); sheet anatomy (grabber, one exit,
close disc); states visible in the shot (selected, disabled); dark theme values (e.g. outlines that
glare in dark, wrong tints).

Be concrete and verifiable. Bad: "looks unpolished". Good: "1px --rule border + 12px radius card
around the exercise list (styles.css .card); kit: unboxed grouped list with inset hairlines".
Find the CSS selector in styles.css when you can, and say so. Don't invent problems; if a screen
meets the kit, say "meets kit" in one line.

Other work in flight — tag a finding with the PR that already covers it:
- #483 wheel picker for load/reps (Focus shelf picker sheet);
- #484 phase 3 navigation: large-title collapse, scroll-edge bar glass, bottom scroll-edge fade under the dock, tab re-tap;
- #485 phase 5 large text: Focus at 200%, dock label cap/large-content viewer;
- "fidelity pass 1/2/4": context menu material/icons/preview/copy, sheet one-exit + close disc, switch, segmented control, stepper, action sheet.
Untagged findings are new.

Output file format (markdown), written to the path given below:

## Shared components
For each component that is off-kit on 2+ screens: name, CSS selector(s), the deviation, the fix
(token/component from the kit), effort S/M/L, and the list of catalog paths it affects.

## Screens
One entry per screen state, in list order:
### flow/id
- light: docs/ui-screens/screens/flow/id__phone-390-light-en.png · dark: ...dark-en.png
- severity: high | medium | low | meets kit
- deviations: bullets, each `what → kit fix (effort) [covered by #NNN if so]`

## Worst 3
The three screens in your set that most visibly fall short of prototype quality, with one sentence why.
Prefer screens the prototype did NOT show (the prototype showed: Today ready, Focus, rest, summary, Settings, day picker, program editor, why sheet, context menu, dock).

Keep the file under ~600 lines. Finish by replying with just the output path and your Worst 3.
