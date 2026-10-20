# Stylesheet ownership

Edit the feature fragment, then run `node tools/build-styles.mjs`. Run
`node tools/build-styles.mjs --check` before committing; release assembly runs
that same check. `styles.css` is a generated, committed runtime asset so raw
source preview and the deployed app consume the same single stylesheet.

`tools/styles-order.mjs` is the explicit cascade order. Do not sort its paths,
merge distant fragments, or move a selector across fragments as routine cleanup.
Later control/refinement rules intentionally override earlier feature rules.
Keep a feature's media/container/support rules with that fragment. There is no
CSS import, preprocessor, selector rewrite, minification, layer or URL rewriting.
Relative URLs are interpreted from the generated root stylesheet (or its native
release mirror), never from an authoring fragment's directory.

Locate a change by owner: `tokens` for light/dark semantic values; `foundation`
for shared controls/data rows/roles; `workout` for Focus/session/summary/Why;
`selection` for Library/pickers/custom movements; `program` for installed/shared
editing; `shell` for navigation/modal containers; `records` for History/Progress;
`today`, `entry`, `landing` and `install` for those surfaces. Search selectors
inside the owner first; the following map records the inherited cascade bands.
The small shared record primitive and Why bands have distinct consumers and
remain separate to avoid changing cascade order. `foundation/interaction-and-detail`
retains the inherited animation/detail-art/announcement band; exercise-detail
illustration changes start there, with later chart rules under `records`.
Do not append new feature styling to the final shared-role refinements.

The extraction baseline is commit `bfed44a3c818b7340c119c203d57720eb5463a4e`,
`styles.css`: 7,880 lines, 618,605 bytes, SHA-256
`12a8d2d88646262ddb6fbbabf75733cb1afb1e9d4d7df6408afb113452a0a7c8`.
The initial concatenated output matches those original bytes exactly. These
ranges record provenance, not future line-number contracts. Authoring fragments
are excluded from native release/precache inventories; only generated runtime
assets ship. `motion-polish.css` keeps its existing independent owner and order.

| Source below this directory | Original lines |
| --- | --- |
| `tokens/theme.css` | 1–398 |
| `foundation/controls.css` | 399–859 |
| `workout/focus.css` | 860–1607 |
| `selection/library-and-picker.css` | 1608–2053 |
| `workout/sheets.css` | 2054–2406 |
| `foundation/record-primitives.css` | 2407–2445 |
| `program/editor.css` | 2446–2848 |
| `shell/navigation.css` | 2849–3049 |
| `workout/summary.css` | 3050–3178 |
| `shell/panels.css` | 3179–3334 |
| `records/history-edit.css` | 3335–3396 |
| `foundation/interaction-and-detail.css` | 3397–3499 |
| `today/dashboard.css` | 3500–3770 |
| `entry/result-and-choices.css` | 3771–4388 |
| `records/progress.css` | 4389–4641 |
| `records/history.css` | 4642–4751 |
| `program/overview.css` | 4752–4807 |
| `landing/first-run.css` | 4808–5288 |
| `install/sharing.css` | 5289–5345 |
| `workout/why.css` | 5346–5397 |
| `install/instructions.css` | 5398–5465 |
| `entry/controls.css` | 5466–5795 |
| `program/controls.css` | 5796–6207 |
| `entry/resume.css` | 6208–6300 |
| `entry/import.css` | 6301–6956 |
| `entry/shell-and-review.css` | 6957–7340 |
| `foundation/components.css` | 7341–7566 |
| `entry/generator-details.css` | 7567–7699 |
| `foundation/role-refinements.css` | 7700–7880 |
