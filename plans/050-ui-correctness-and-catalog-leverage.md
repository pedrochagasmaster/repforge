# Plan 050: UI correctness and catalog leverage

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 050
- **Phase:** 1 — Proven defects and test leverage
- **Status:** Planned; implementation has not started
- **Owner approval state:** Approved in `docs/ui-audit.md`; no product choice remains
- **Depends on:** Plan 049 decision register and preliminary semantic control roles
- **Blocks:** Plan 054 and final Plan 059 validation; supplies overflow gates to every UI plan
- **Governing G decisions:** G-01, G-59, G-74
- **Governing UI findings:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, and the fixture-only part of UI-29
- **Affected surfaces:** Build editor, custom program schedule/muscle controls, exercise detail, recommendation rationale, exercise-library filters, import/review bands, screen-catalog harness
- **Complexity:** Medium
- **Risk:** Medium — catalog/test changes affect every later visual PR

## Problem statement

Current production output visibly exposes `day_empty:*` issue values and `picker.equipment.band`, composes ungrammatical messages, clips fixed controls at 200% text, overlaps exercise filter chips and installed-editor labels, and gives a disabled Build activation control more weight than its enabled neighbor. The catalog also lacks PT-BR + 200% demanding cases and executable per-component overflow checks. Separately, a 100 kg lateral-raise fixture makes an otherwise legitimate chart example implausible.

These are verified defects and test leverage. This phase fixes only them; it does not adopt the later landing, Focus, Progress, or design-system redesign.

## Approved direction

- Map machine identifiers to user-facing names and reject raw/key-shaped rendered copy.
- Localize complete messages independently in English and PT-BR; do not stitch display-label fragments into grammar.
- Reflow controls at enlarged text; never “fix” them by shrinking typography.
- Test every catalog state for document and component overflow, with explicit intentional-scroller allowlisting.
- Preserve the visible continuation cue in horizontal filter chips without allowing sibling overlap.
- Give installed editor labels their own geometry and reuse the canonical disabled-primary-action treatment.
- Correct the implausible fixture now; leave sparse-chart policy to Plan 056.

## Preserved strengths

Preserve the palette/theme token swap, Sans/Mono jobs, licensed/empty exercise-media treatment, complete five-job entry and explicit activation, valid horizontal-scroll continuation cues, adjacent validation, core workout loop, and production-backed catalog. These defect fixes must not flatten or redesign surrounding surfaces.

## Non-goals

- No general redesign, new navigation, route, state model, or transition behavior.
- No blanket ban on English exercise names, middle dots, orange, truncation, or horizontal scrolling.
- No full token migration, chart-policy change, List removal, landing work, or catalog state deletion.
- No changes to exercise media or generated exercise-library records.

## Current-state audit

- `updateOnboardingEditorActions()` in `app.js` joins validation issue strings. A second editor path maps `day_empty:` values to `programStructure.days`, so the application already contains the correct approach but applies it inconsistently.
- The custom exercise picker asks for an equipment namespace not present in `i18n-en.json`/`i18n-pt.json`; the existing `entry.equip.band` vocabulary can be shared or aliased at the source dictionaries.
- Exercise detail and recommendation result render independently translated fragments around display labels. The test target is the complete visible message, not the individual dictionary entries.
- Custom schedule uses fixed segmented choices; muscle controls use fixed tracks. `styles.css` contains fixed geometry and text-overflow rules that conceal rather than reflow long/enlarged labels.
- Library filters use `.filters`; a partial final chip is intentional, but chips must have non-overlapping bounding boxes inside a labelled horizontal scroller.
- `.program-editor__range legend` and installed editor spacing cancel via a negative margin/small row gap.
- `.program-editor__activate:disabled` overrides established `.btn--cta:disabled` semantics and leaves an accent arrow visually live.
- `tools/ui-screens/fixtures.mjs` seeds lateral raise as the fifth 100 kg value in a historical session.
- `docs/ui-screens/manifest.json` has 31 `standard`, 26 `localized`, 7 `accessibility`, and 8 `customAccessibility` screens. Its 221 frames contain only seven English 200% cases and no PT-BR + 200% case.
- `tools/check-ui-screens.mjs` checks manifest/file dimensions; `test/ui-screens.mjs` checks coverage/semantic evidence. Neither drives and measures every captured screen for overflow.

## Architecture

### Rendered-copy detector

Extend the catalog capture/check boundary to collect visible, accessibility-relevant rendered text after each scenario is stable. Reject:

- `day_empty:` and other named internal prefixes in a maintained denylist;
- dotted translation-key shapes only when they match a known dictionary namespace or a requested-but-missing key;
- literal `undefined`, `null`, `[object Object]`, or unresolved `{placeholder}` output.

Do not use a generic “contains a dot/underscore/English word” heuristic. Permit user-entered content and documented technical output by state-specific allowlist with a reason.

### Overflow detector

Add a reusable browser-side measurement to the same production-backed catalog journey. For each screen, assert:

1. root/document `scrollWidth <= clientWidth + 1`;
2. visible controls, fieldsets, labels, headings, tables, buttons, and declared layout containers do not exceed their own rendered box when clipping loses content;
3. pairs in non-overlap groups have disjoint bounding boxes;
4. every horizontally overflowing element carries an explicit semantic marker such as `data-allow-horizontal-scroll`, is keyboard/touch reachable, and retains a continuation cue.

The allowlist is a small manifest field keyed by screen and stable locator, with reason and expected axis. A CSS class alone is not proof because accidental elements could acquire it. Print the screen ID, variant, locator, client/scroll widths, and bounding boxes on failure.

### Catalog matrix

- Add PT-BR normal-size coverage to every standard public screen, not only onboarding.
- Retain English light/dark normal coverage.
- Add a named `demandingText` variant set containing PT-BR + 200% at 320px or 390px as appropriate.
- Assign demanding surfaces explicitly: custom schedule, muscle priority, recommendation result, Build empty/partial/ready, import preview, Progress review metrics, History selected session, Share blocked state, and any later state whose longest localized control approaches its container.
- Run overflow assertions for every manifest screen/variant, not only image-diff candidates.

Phase 050 must update expected catalog counts mechanically from the manifest. It must not hard-code 72/221 after variants change.

## Domain/state model

No durable model changes. The intentional-scroller allowlist and rendered-copy exceptions are versioned test metadata with stable screen IDs, locators, reasons, and reviewer ownership.

## Migrations

No user-data migration. Rebuild `i18n.js` from both source dictionaries. If a cached production file changes, read the current service-worker revision, increment it once, and keep `sw.js`, its asset inventory, and all five protected script query revisions in lockstep where applicable.

## UX state specification

- Build invalid: readable complete list of invalid days by translated/display day label; activation uses quiet disabled-primary semantics and muted/absent arrow.
- Build valid: primary activation regains accent; Save draft remains secondary.
- Custom schedule/muscles: normal layouts remain concise; 200% reflows to full-width or 2×2 labelled groups with no clipped label.
- Filter strip: first/current controls fully readable; last visible edge may be partial as a scroll cue; no two chips overlap.
- Program range: `REP RANGE`, `MIN`, and associated values occupy separate rows/columns at all required variants.

## Accessibility

Reflow preserves DOM order, group labels, `fieldset`/`legend` semantics, current selection, 44×44 CSS-pixel targets, and visible focus. Disabled activation retains `disabled` plus a nearby reason linked by `aria-describedby`; do not rely on grey alone. The filter region has an accessible name and keyboard scroll behavior. Detector failures include accessible text clipped by CSS even when document width fits.

## Localization

Implement full-message variants in both `i18n-en.json` and `i18n-pt.json`, then run `node tools/build-i18n.mjs` and `--check`. Recommendation reasons receive grammar-ready variants rather than interpolated title-cased labels. Test both display copy and accessible names.

## Responsive behavior

Verify 320px, 390×844, 430px, applicable desktop widths, 200% English, and demanding PT-BR + 200%. Import/review metric bands may reflow into stacked rows; no font reduction below the established type role is allowed.

## Light/dark

Run affected states in light and dark. Layout is identical across themes. Disabled semantics use Phase 049 tokens; the fix must not add literal colors. Exercise art/paper backgrounds are untouched.

## Offline/PWA

All changes work offline after the updated shell is installed. Catalog/tests use a fresh service-worker context. Cache revision changes follow the repository lockstep rule; no new network dependency is introduced.

## Failure and recovery

If a localized message lacks a variant, fail generation/tests rather than fall back to a raw key. If a catalog locator disappears, the checker fails as stale metadata rather than silently skipping it. Roll back a fixture-only commit independently if it destabilizes unrelated scenario assumptions.

## Privacy

Rendered text inspection stays local in the test process; it is never telemetry. Do not include user-authored values in failure artifacts beyond deterministic catalog fixtures.

## Telemetry

None.

## Testing and executable evidence

| Acceptance invariant | Executable proof |
|---|---|
| No raw issue/equipment keys | Unit tests for issue-to-label mapping plus rendered-copy scan of all catalog frames |
| Complete EN/PT messages | Dictionary/generation checks and production-backed exercise-detail/recommendation journeys in both locales |
| 200% schedule/muscle controls fit | Browser geometry assertions at 320/390px and PT-BR + 200%; semantic group assertions |
| Catalog is risk-based and complete | Manifest test validates required language/theme/text axes and demanding-screen membership |
| No accidental overflow | Per-screen document/component detector with intentional-scroller metadata validation |
| Filter continuation without overlap | Bounding-box and scrollability assertions in Library EN/PT, 320/390, light/dark |
| Editor labels and disabled hierarchy | Focused Build/installed editor captures plus computed style, focus, disabled-reason, and bounding-box assertions |
| Fixture is credible | Fixture assertion names Machine lateral raise and a plausible load; Progress snapshot updates only from fixture change |
| Generated/cache files agree | `node tools/build-i18n.mjs --check`; `node test/exercise-library.mjs`; service-worker revision test |

Run focused suites first (`test/program-entry-browser.mjs`, `test/library-flow.mjs`, `test/accessibility.mjs`, the catalog checks), then `node test/run.mjs` or the repository's current full browser gate. Regenerate the complete catalog with `node tools/capture-ui-screens.mjs`, never hand-edit PNGs, and run both catalog check and compare tools.

## Screen catalog changes

- **New semantic states:** none.
- **Removed states:** none.
- **Changed states:** current Build empty/partial/ready, Custom schedule/priorities, recommendation result, exercise detail, Library list, installed Program editor, import/review metrics, and Progress fixture-dependent frames.
- **Matrix expansion:** PT-BR normal is added to the 31 current `standard` screens (subject to the live manifest at implementation); PT-BR + 200% is added to an explicit demanding set. The PR records exact before/after screen and frame counts.

## Owner gates

None. Owner review confirms the fixes match approved direction; it does not reopen it.

## STOP conditions

- Stop if fixing copy requires inventing a recommendation rationale not present in the domain output.
- Stop if an intentional-scroller rule would become a broad selector or hide failures on unrelated elements.
- Stop before changing chart policy, navigation, landing hierarchy, or global tokens.
- Stop if current main already fixed a named artifact; delete that slice from the sequence and record proof rather than rewriting it.

## Rollback

The copy, geometry, catalog harness, and fixture commits are independently revertible. A rollback must revert generated `i18n.js`, catalog PNGs, and cache revision with their source change as one boundary. Do not restore raw keys or broken layout just to preserve an old golden image; if the detector itself is faulty, revert the detector/matrix slice while retaining proven product fixes.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `fix(i18n): render complete localized UI messages` | UI-01/02: mapped day/equipment labels and grammar-complete EN/PT messages | `app.js`, `i18n-en.json`, `i18n-pt.json`, generated `i18n.js`, focused tests, `sw.js`/script revisions | Plan 049 message/control roles | i18n build/check; rendered copy in Build, picker, detail, recommendation | Relevant program-entry/library/browser suites | Affected frames changed | Record keys, SHA, exact focused results | Revert source/generated/cache/test changes together |
| 2 | `test(ui): reject raw copy and accidental catalog overflow` | G-59 detector, explicit scroller metadata, diagnostic failures | catalog manifest/helpers, `test/ui-screens.mjs`, catalog docs | Commit 1 | Seed detector failures then pass real catalog | Catalog completeness/compare | Matrix metadata changes; no product state | Record before/after counts and allowlist | Revert harness independently; product fixes remain |
| 3 | `fix(ui): reflow enlarged program-entry controls` | UI-03 schedule/muscle/import/review geometry without smaller type | `styles.css`, entry markup/renderers, accessibility/program-entry tests, cache | Commit 2 | 320/390 and EN/PT 200% geometry/semantics | Program-entry and accessibility suites | Custom/recommend/import/review frames | Attach focused frame IDs/results | Revert layout/cache/catalog together |
| 4 | `fix(ui): restore non-overlapping filter and editor geometry` | UI-05/06 continuation-safe filter strip and real editor label row | `styles.css`, optional semantic markers, library/editor tests, cache | Commit 2 | Bounding boxes, scroll cue, editor light/dark/compact/200% | Library/program editor/accessibility suites | Library and Program frames | Record measurements and variants | Revert component change and its images |
| 5 | `fix(ui): align disabled Build action hierarchy` | UI-07 canonical disabled CTA, reason retained, arrow quiet | `styles.css`, renderer if needed, entry tests, cache | Commit 1 and Plan 049 role | Computed styles/semantics for valid+invalid Build | Program-entry/accessibility suites | Build invalid/valid frames | Record enabled/disabled proof | Revert isolated hierarchy slice |
| 6 | `test(ui): replace implausible progress fixture` | UI-29 fixture credibility only | `tools/ui-screens/fixtures.mjs`, fixture assertions, regenerated affected PNGs | None; may run parallel | Named fixture snapshot and value assertion | Progress/catalog suites | Progress frames using seeded history | State clearly chart policy remains Plan 056 | Revert fixture and images only |
| 7 | `test(ui): regenerate expanded catalog evidence` | Complete 72-state-derived matrix and green overflow/copy gates | manifest, all generated PNGs, catalog README/check baselines | Commits 1–6 | Capture/check/compare and exact count | Full browser regression; audit extraction check | Complete catalog regenerated | Fill verification table and completion gate | Revert evidence only if preceding product commits also roll back |

For each row, mark 🟡, implement only that slice, run focused proof, inspect the entire diff, remove unrelated changes, commit, push, and update the PR before continuing.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/050-correctness-catalog`
- **Worktree:** `../repforge-ui-050-correctness`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 049 merged; merge it from `origin/main`, never duplicate its tokens/contracts
- **Primary files:** i18n source/generated files, focused `app.js`/`styles.css` defects, catalog manifest/check/capture helpers, focused tests and PNGs
- **Shared hotspots:** `app.js`, `styles.css`, `i18n*.json`, `i18n.js`, `sw.js`, `index.html`, `docs/ui-screens/manifest.json`, catalog tooling
- **Conflict risk:** High with Plans 054–058; Plan 050 merges before them
- **Safe parallelism:** Plan 051 pure state-module work and Plan 052 provenance design may proceed; neither may edit shared UI/catalog files until this merges

Fetch main; inspect existing branches/worktrees/PRs; resume existing work. Use one dedicated worktree, keep the coordination checkout clean, never copy uncommitted files or delete another worktree/branch, and target `main`. For a fresh plan, push `chore(plan-050): start implementation`, open a draft PR, and fill its body before substantive work. After prerequisites merge, fetch, explicitly merge `origin/main`, resolve, rerun affected checks, push, and update the PR. Do not rebase a published branch.

### Required implementation PR body

```markdown
## Objective
## Scope boundary
### In this PR
### Explicitly out of scope
## Dependencies
- Depends on:
- Blocks:
- Required main state:
- Current dependency status:
## Planned commit sequence
| # | Status | Atomic commit | SHA | Focused verification |
|---|---|---|---|---|
<!-- ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
## Current state
- Current slice:
- Last pushed SHA:
- Worktree:
- Worktree clean:
- Relationship to main:
- Active blocker:
- Owner decision required:
- Completion-gate status:
## Completed work
## Verification evidence
| Check | Result | SHA |
|---|---|---|
## Risks and decisions
### Confirmed decisions
### Assumptions
### Newly discovered risks
### Outstanding owner decisions
## Next exact steps
1.
2.
3.
## Future plan steps
## Handoff
- Branch:
- Worktree:
- PR:
- Base:
- Current main SHA:
- Last known-good SHA:
- Latest focused tests:
- Latest full regression:
- Latest catalog evidence:
- Latest physical-device evidence:
- Files owned:
- Shared hotspots:
- Blocked on:
- Owner approval required:
- Exact next action:
- Last updated:
```

### Push, history, and handoff discipline

Every completed slice is pushed immediately and its PR row/evidence updated. Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash handoff. Never checkpoint known-broken work; either complete and prove the slice or return to the last pushed boundary. Do not bypass dependencies through duplicate contracts, unpublished copies, or arbitrary cherry-picks. Assume context can end after any call: keep decisions and `Next exact steps` current. Before stopping, run `git status --short`; a valid handoff is clean. Unless authorized, do not merge—stop at owner review with remote/PR/evidence current and all review threads and STOP conditions resolved.

## Completion gate

- Generated localization files are current and no visible raw identifier/key-shaped leak remains.
- Complete English and PT-BR messages render grammatically on their own.
- Affected light/dark, 320px, canonical, 430px, 200% and demanding PT-BR + 200% cases pass.
- Every catalog state executes document/component overflow checks; intentional scrollers are explicit and preserve discoverability.
- Filter chips do not overlap; editor labels do not collide; disabled Build hierarchy is correct.
- The lateral-raise fixture is credible without changing chart policy.
- Complete catalog is regenerated and exact counts recorded; generated/cache inventories agree.
- Focused and full regression gates pass, branch is pushed and clean, and PR stops at owner review.
