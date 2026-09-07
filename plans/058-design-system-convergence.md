# Plan 058: Design-system convergence

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).
External Herdr workers additionally follow the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md)
and the [Herdr worker packets](#herdr-worker-packets) section below. The coordinator fills every packet field and the
live SHAs, thread ID, server origin, and PID before dispatch.

- **Plan number:** 058
- **Phase:** 7 — System convergence
- **Status:** Planned; implementation has not started
- **Owner approval state:** Semantic direction is approved; rendered results require owner visual review
- **Depends on:** Plans 049–057 merged; principal public surfaces and interaction structure must have stopped moving
- **Blocks:** Plan 059 public-launch validation
- **Governing G decisions:** G-13–G-14, G-28, G-57–G-60, G-67, G-74, G-80–G-81
- **Governing UI findings:** UI-20, UI-21, UI-22, UI-30
- **Affected surfaces:** Every public app/landing/sheet/dialog/toast/navigation/control/chart/catalog surface
- **Complexity:** Very high
- **Risk:** High — broad CSS/markup migration can regress strong task-specific hierarchy

## Problem statement

Taurifer's brand is coherent, but its implementation uses many literal radii, font sizes, shadows, stepper/selection/dismiss/disclosure/Skip treatments, uppercase structural labels, and progress encodings. The brand guide's literal “no cards/no shadows” rule contradicts several of the strongest current surfaces. Contrast claims based on one token do not reflect actual foreground/background/size/state roles. Earlier phases need stable semantic roles, but a piecemeal migration would leave the public product internally inconsistent.

This phase inventories and migrates the complete public surface after the main flows settle. It converges semantics without flattening legitimate workout/editor/management variants or replacing Taurifer's palette.

## Approved direction

- Ordinary content remains mostly flat; bounded elevation may communicate selected, floating, modal, or persistent-action roles. No nested-card tunnels.
- Equivalent controls share tokens, states, and meaning. Contextual variants exist only when task demands differ.
- Preserve Plex Sans for language/controls and Plex Mono for training data/technical values; use bounded scales.
- Use bounded radius roles and remove accidental literal proliferation.
- Name block, weekly, exercise/set, and onboarding/task progress dimensions before consolidating duplicates.
- Preserve warm paper/ink/burnt orange, token-swap dark theme, licensed paper-backed art, intentional empty media, and selected landing continuity.
- Apply WCAG 2.2 AA to actual rendered roles. Do not globally replace orange; distinguish decorative rules from required control boundaries.
- Migrate every public surface and account for every exception.

## Preserved strengths

Preserve Taurifer's warm paper/ink/burnt-orange identity, token-only dark swap, Plex Sans/Mono division, licensed art on sampled paper and intentional empty tiles, core workout/summary flow, Focus hierarchy, `Why this weight?`, deterministic/safety/validation language, explicit activation, local-first exception boundary, selected Plan 054 landing continuity, and the complete catalog. Convergence means semantic consistency, not visual homogenization.

## Non-goals

- No new routes, features, state models, content hierarchy, transition logic, progression math, or product decisions.
- No new landing motif or design direction; use the owner-selected Plan 054 reference and normal system.
- No darkening/recoloring licensed exercise-art paper backgrounds or filling empty art tiles.
- No forced single component for unlike workout/editor interactions.
- No blanket removal of middle dots, uppercase text, orange, cards, shadows, or contextual variants.
- No representative-lifter testing; owner and executable evidence govern acceptance.

## Current-state audit

- `styles.css` begins with the correct warm palette and `data-theme="dark"` token swap. Current root has one broad `--radius:14px`, `--shadow:none`, brand/dock tokens, and many later literals.
- A baseline scan finds more than ten distinct non-round radius literals (including 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, and 20 px), over twenty font-size values, and multiple shadow recipes for Focus, menus, sheets, dialogs, toasts, dock, identity mark, and selection.
- Existing bounded depth is often functional: Focus card, sheets/dialogs, toast, nav dock, selected entry card. Some ordinary content also uses card-within-card borders that can become tunnels.
- Current type roles are conceptually sound (Plex Sans/Mono) but literal sizes repeat inconsistently. Eyebrow/subhead uppercase labels sometimes repeat structure rather than add it.
- Current controls include base `.btn` variants, multiple steppers, radio cards, segmented controls/tabs, links/rows, icon buttons, switches, disclosure chevrons, and separate Skip treatments.
- Progress encodings appear in Today block/week, Focus exercise/set, entry steps, Review, and old tour. Their values are different dimensions and cannot be merged by appearance alone.
- Light `--accent` is approximately 3.57:1 on `--bg`, while `--accent-deep` is suitable for more small-text roles; this is not evidence to remove decorative accent. Some control boundaries rely on light `--rule` alone and require role-specific evaluation.
- The 72-state/221-frame audit baseline already changed: main `c3491c5e` is 75 screens / 317 frames after Plans 050/051, and Plans 053–057 will change it further. Plan 058 must inventory the live manifest at its dispatch base SHA rather than use any documented count.

## Architecture

### Re-runnable role inventory

Add planning/test artifacts that make convergence auditable:

- `tools/ui-role-inventory.json`: semantic role, selectors/components, allowed contextual variants, states, dimensions, public catalog owners, and documented exceptions.
- `tools/check-ui-system.mjs`: scans CSS for literal font/radius/shadow/color declarations outside token definitions/approved intrinsic exceptions; drives live catalog states to find visible semantic components without an inventory role, illegal nested elevation, and progress controls without a dimension.
- `test/ui-system.mjs`: validates computed tokens/states/contrast/focus/boundaries across manifest scenarios.

Intrinsic exceptions are narrow: `50%` geometry, `999px` pill via a token, exercise-media sampled `mediaBg`, data-URI icon artwork, transparent/none, and pixel-perfect decorative artwork documented by selector. Every exception has reason/owner; an allowlist cannot be a wildcard, file, or broad subtree.

### Token contract

Finalize the Phase 049 preliminary roles. Use names compatible with current custom-property style; the semantic contract is mandatory even if exact variable spelling differs.

#### Typography

- families: `--font-language` (Plex Sans) and `--font-training-data` (Plex Mono);
- sizes: label 0.6875rem, caption 0.75rem, body-small 0.875rem, body/control 1rem, subtitle 1.125rem, title 1.875rem, display 2.5rem;
- line heights: tight 1.1, standard 1.4, reading 1.55;
- weights: regular, medium, semibold from shipped font support.

Use label/caption only for supporting text, never as the sole text of a critical control at normal scale. Mono is assigned by semantic value (loads/reps/RIR/timer/counts/technical IDs where visible), not by component ancestry. If a current unique size cannot map without losing hierarchy or 200% fit, document one named additional role rather than retain a literal.

#### Radius

- none 0; compact 4px; control 8px; surface 12px; prominent/modal 16px; pill 999px; round 50%.

Asymmetric sheet/top-edge radii derive from the prominent token. Exercise-art corners may use the appropriate surface/prominent role; sampled paper color is not changed.

#### Elevation

- flat: no shadow, optional decorative separator;
- selected: inset/high-contrast selection boundary, no floating shadow;
- floating: menu/toast/Focus movable layer shadow;
- modal: sheet/dialog plus scrim and stronger depth;
- persistent-action: shallow top boundary/shadow for docks, including G-80 Program actions.

Each role has theme-aware shadow/boundary tokens. Focus, nav, and Program dock may use different contextual recipes only as declared variants of their semantic role. Elevated descendants inside an elevated ancestor are prohibited unless the inner role is `selected` or a true overlay; tests list the exact exception.

#### Control roles and states

Define base semantics for primary, secondary, quiet/navigation, destructive, disclosure, selection, disabled, and icon-only actions. Shared states cover default, hover where applicable, active/pressed, selected, focus-visible, disabled with reason, validation/error, and loading. Contextual variants include rapid workout stepper versus deliberate program stepper, but target sizes/focus/disabled semantics remain shared.

Inventory and reconcile:

- all steppers;
- radio/card/segmented/list selection;
- close/back/dismiss controls;
- expand versus navigate glyphs;
- Skip/restore treatments;
- Replace versus Remove;
- primary/disabled/persistent actions;
- switches and native inputs;
- horizontal scrollers and drill-in rows.

Do not alias unlike semantics simply because their silhouette matches.

#### Progress dimensions

Every progress element receives one machine-readable dimension:

- `block`: position within training block;
- `week`: sessions/volume within current week;
- `exercise-set`: current exercise and ordered set execution;
- `task`: entry/import/transfer/onboarding workflow.

Elements with identical dimension/value/scope on one surface consolidate; different dimensions remain separately labelled. Remove decorative duplicate bars/dots only after an accessible-text/value comparison proves duplication.

#### Semantic color and boundaries

Keep brand tokens and add/clarify role tokens for action/accent, action-text, improved/success, declined/warning, maintained/neutral, destructive, focus, disabled, required control boundary, decorative separator, surface, and ink hierarchy. Warning and destructive are distinct roles even if early palette values are related.

For each rendered role, inventory foreground, effective composited background, font size/weight, icon purpose, boundary purpose, and state. Requirements:

- normal text ≥4.5:1; large text ≥3:1;
- required non-text controls/state/focus graphics ≥3:1 against adjacent colors where WCAG applies;
- focus appearance and contrast meet WCAG 2.2 AA;
- decorative separators are marked/tested as non-required and need not pretend to be a control boundary;
- disabled exemptions do not justify unreadable explanations; disabled reason text remains compliant;
- color is never the only outcome/selection/error distinction.

Use `--accent-deep` for small accent text where appropriate and retain `--accent` for valid decorative/large/action roles. Measure, do not guess or blanket-swap.

### Migration order

1. Add checker/inventory without product change and record all debt.
2. Land tokens and compatibility aliases.
3. Migrate foundations: type/radius/elevation/control/progress/color primitives.
4. Migrate by stable surface group: entry/landing; Today/Focus/summary; Progress; History/Share/Program/Settings/library/install/help.
5. Delete compatibility aliases and close every exception.
6. Regenerate entire catalog and run rendered-role checks.

At each surface step, preserve its Plan 054–057 DOM/state/interaction contract. CSS refactors cannot reorder focus or hide controls.

## Domain/state model

No product state changes. Role inventory is versioned test metadata. Semantic annotations such as `data-elevation`, `data-control-role`, and `data-progress-dimension` are presentation/test contracts, not durable state. Theme continues to be resolved exclusively to `<html data-theme>` from device UI prefs.

## Migrations

- Introduce semantic tokens with aliases from old `--radius`, `--r`, and any shared values; migrate consumers before deleting aliases.
- Replace literals only when their semantic role is known. Unknown literals become inventory findings, not mechanically mapped guesses.
- Convert component classes in coherent surface slices; keep old/new selectors temporarily only within one atomic commit, not as a long-lived dual system.
- No user-data migration. Existing theme preference remains unchanged and excluded from backup/setup sharing.
- CSS/index changes require current service-worker cache bump; script query revisions change only when one of the six protected scripts (`program-compiler.js`, `program-entry.js`, `program-entry-adapter.js`, `shared-setup.js`, `workout-draft.js`, `app.js`) changes.

## UX state specification

No new product states. Every existing live catalog state must be assigned:

- elevation ancestry;
- control roles and interactive states;
- typography and data-family roles;
- radius role;
- progress dimension/scope where present;
- semantic color/boundary role;
- declared intentional exception, if any.

Inventory includes loading, empty, validation, selected, disabled, error, success, destructive confirmation, installed/browser, and recovery states added by earlier plans—not just happy paths.

## Accessibility

The migration must preserve or improve semantic elements, accessible names, selected/expanded/pressed states, disabled reasons, focus order/restoration, live announcements, dialog containment, keyboard interactions, touch targets, text scaling, safe areas, scroll discoverability, and reduced motion. Automated computed-style contrast uses actual rendered background/opacity layers. Manual keyboard and screen-reader smoke checks guard against class/markup refactors. At 200%, content and actions reflow without loss.

## Localization

No copy rewrite except removal of labels proven structurally redundant and already approved by the role inventory. Such removal must preserve equivalent accessible context in EN/PT-BR. Typography/components are tested with real PT-BR strings and data names, not lorem ipsum. Generated i18n remains source-derived.

## Responsive behavior

Validate every migrated surface at 320px, 390×844, 430px, applicable desktop, English 200%, and demanding PT-BR + 200%. Tokens cannot encode fixed heights that clip scaled text. Desktop expansion retains the same hierarchy. Intentional scrollers use Plan 050 markers/cues; nested scroll regions require explicit exception.

## Light/dark

All palette/theme values remain in root token blocks. Outside token definitions and reviewed intrinsic media metadata, selectors name no literal color. Dark is still one semantic token swap, not a second layout/stylesheet. Paper-backed exercise art and intentional empty tiles remain identical in meaning. Theme-switch no-flash behavior and native `color-scheme` controls remain.

## Offline/PWA

Pure CSS/static role metadata remain cached. Run fresh install and service-worker upgrade tests to prevent old CSS/new markup mismatches. No runtime design-system dependency, font CDN, or network request is introduced. Installed/browser safe-area and dock/persistent-action roles are both tested.

## Failure and recovery

- Checker missing/ambiguous selector fails loudly; it does not infer a role.
- Contrast tooling that cannot resolve an effective background reports unsupported and blocks completion until manually/structurally resolved.
- If a surface regression occurs, revert its migration slice while keeping token compatibility aliases; do not roll back all completed surfaces.
- Old worker/new HTML mismatch is avoided by one cache revision boundary; if detected, serve the prior coherent shell.
- Any role that requires product hierarchy change is handed back to its owning phase/owner rather than silently redesigned here.

## Privacy

No privacy/data behavior changes. Visual test fixtures remain deterministic/local. The Privacy page and transfer disclosures remain complete and cannot be visually demoted below required readability.

## Telemetry

None. Component tokens, contrast, and visual exceptions are not product analytics. Do not add automatic redesign triggers.

## Testing and executable evidence

### Inventory/static checks

- Every public manifest state and visible component is mapped to a semantic role.
- No unapproved font/radius/shadow/color literal remains outside token definitions/intrinsic exceptions.
- Every exception has exact selector, role, reason, owner, and affected catalog states.
- No illegal elevated descendant and no progress indicator without dimension/scope.

### Rendered-role checks

- Compute effective foreground/background and WCAG threshold by actual text/icon/control/boundary size/state in EN/PT and light/dark.
- Test focus-visible, selection, disabled reason, validation, Replace/Remove, improved/maintained/declined, and required boundaries.
- Verify decorative separators are not the sole affordance.

### Behavior/visual regression

- Run each earlier plan's critical flow after its surface migration; compare semantic tree, focus, geometry, and state facts, not only pixels.
- Full 320/390/430, 200%, PT+200, reduced-motion, installed/browser, overflow/scroll-clearance matrix.
- Regenerate and compare the entire live catalog; review every changed frame and document intentional diff by surface/role.
- Run full browser/generative suites and service-worker upgrade test.

## Screen catalog changes

- **New states:** none expected; add only a missing component state discovered by the completeness audit, not a design demo.
- **Removed states:** no product state solely for styling; remove only stale states already eliminated by prior plans.
- **Changed states:** every live public state is expected to change or be explicitly reviewed as already conforming.
- **Matrix expansion:** preserve Plan 050/059 risk matrix; add role/contrast semantic evidence to every state. Record live before/after screen/frame counts and the exact changed-frame inventory.

## Owner gates

Owner reviews a representative board of every surface group in light/dark and compact/PT+200 before the compatibility aliases are removed. This verifies continuity with the selected landing direction and protected Taurifer identity. Final physical-device sign-off remains Plan 059.

## STOP conditions

- Stop if a change would alter product flow/state/meaning owned by Plans 054–057.
- Stop if an elevated/control/progress exception lacks a semantic rationale and inventory entry.
- Stop if contrast cannot be measured against the effective rendered background.
- Stop before globally replacing orange, recoloring art paper, filling empty media, or forcing unlike controls together.
- Stop if a migration creates a nested-card tunnel, clips at 200%, or needs a root dependency/runtime design framework.

## Rollback

Compatibility tokens/aliases remain until every surface and catalog gate is green. Each surface-group commit can revert independently to aliases without changing behavior. The final cleanup commit is reverted first if a missed consumer appears. CSS/cache/catalog changes roll back together. Never rollback theme data or earlier phase state schemas for a visual regression.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(ui-system): inventory public visual roles` | Re-runnable selector/role/exception/progress inventory and debt report | new tool/test JSON+JS, catalog helpers/docs | Plans 054–057 stable | Inventory covers live manifest; seeded failure tests | Catalog completeness | No PNG change | Record exact debt counts/exceptions | Tests/metadata only |
| 2 | `refactor(css): define semantic type radius and elevation tokens` | Bounded token scales plus old-token aliases; no consumer change intended | `styles.css`, UI-system tests, brand-reference docs as assigned by Plan 049 | Commit 1 | Token existence/value/theme tests | Baseline visual comparison | No intended frame diff | Record compatibility aliases | Revert token definitions |
| 3 | `refactor(css): converge control states and progress dimensions` | Shared semantic roles/states, contextual variants, dimension annotations | styles/index/app renderers as needed, tests | Commit 2 | Component state and progress duplicate/dimension tests | Accessibility/critical controls | Component frames change | Record variant rationale | Revert primitives while aliases remain |
| 4 | `refactor(css): converge landing and program-entry surfaces` | Plan 054 surfaces use roles without motif drift | entry/landing styles/markup/tests | Commit 3 | Selected reference, all entry states/variants | Entry/install/shared suites | Entry frames changed | Review board/evidence | Revert surface slice |
| 5 | `refactor(css): converge Today Focus and summary surfaces` | Workout hierarchy, data type, sheets/actions/elevation align | workout/Today/summary styles/markup/tests | Commit 3 | Complete core loop semantic/visual checks | Focus/session/history | Core frames changed | Record protected-strength parity | Revert surface slice |
| 6 | `refactor(css): converge Progress surfaces` | Outcome/action/evidence/control/progress roles align | Progress styles/markup/tests | Commit 3 | Scope/outcome/contrast/chart checks | Progress/transition suites | Progress frames changed | Record every outcome/state | Revert surface slice |
| 7 | `refactor(css): converge management and library surfaces` | History/Share/Program/Settings/timer/library/install/help align | remaining public styles/markup/tests | Commits 3–6 | Role/contrast/nesting checks by surface | Management/library/install suites | Remaining frames changed | Close inventory exceptions | Revert surface group(s) independently |
| 8 | `test(ui-system): enforce rendered-role WCAG 2.2 AA` | Effective contrast/focus/boundary test across live catalog | UI-system/catalog tests/metadata | Surface migrations complete | Seeded fail/pass plus every role/state | Accessibility suite | Semantic evidence only | Record measured matrix | Revert checker only if demonstrably wrong; keep accessible fixes |
| 9 | `refactor(css): remove compatibility literals and nested surfaces` | Old aliases/dead selectors gone; no accidental one-off or tunnel remains | `styles.css`, markup cleanup, checker allowlist | Commits 4–8 and owner board approval | Zero-debt inventory; source scan | Full browser/generative | Broad intentional diffs | Record final exception list | Revert cleanup to aliases |
| 10 | `test(ui-system): regenerate the complete converged catalog` | Full catalog and responsive/theme/text/reduced/installed evidence | manifest/scenarios/PNGs/docs/SW inventory | Commits 2–9 | Capture/check/compare/role/overflow | Full regression/audit extraction | Entire live catalog reviewed | Fill owner/completion/handoff | Evidence/cache revert as one boundary |

For every row: mark 🟡; implement only the row; run focused proof; inspect the complete diff and every affected frame; remove unrelated changes; commit; push immediately; update PR; proceed only from a clean truthful remote boundary.

## Herdr worker packets

The atomic commit sequence above is the delivery contract. Each row is dispatched as one or more self-contained packets
per the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md); the coordinator fills every template
field before dispatch. Surface migration is dispatched **one bounded surface / state family per worker against frozen
roles** — no worker is handed "migrate the styles".

Rules for every packet in this plan:

- **Inventory and rendered-role AA negatives come first.** 058-P1 delivers the re-runnable role inventory *and* the
  rendered-role WCAG 2.2 AA negative cases (seeded failures that must be rejected) before any token or surface change,
  so the AA contract is not a late row-8 surprise. Row 8's remaining work is enforcement breadth (058-P5), not the
  first proof.
- **Roles are frozen before migration.** 058-P2/P3 land the token scales and control/progress semantics with
  compatibility aliases; the per-surface packets (058-P4a…P4d) then migrate consumers without changing the DOM/state/
  interaction contract owned by Plans 054–057.
- **Anchors are concrete.** Existing: `styles.css` root tokens (`--accent:#E04E14`, `--accent-deep:#B8410E`,
  `--radius:14px`, `--shadow:none`, `--rule`) and the `:root[data-theme="dark"]` swap; `tools/check-ui-screens.mjs`,
  `tools/compare-ui-screens.mjs`, `test/ui-catalog-contract.mjs`, `test/appearance.mjs`, `test/accessibility.mjs`.
  **NEW** (this plan): `tools/ui-role-inventory.json`, `tools/check-ui-system.mjs`, `test/ui-system.mjs`, semantic
  `data-elevation` / `data-control-role` / `data-progress-dimension` annotations.
- **Palette and licensed art are preserved.** No packet globally replaces orange, recolors the sampled `mediaBg`
  paper, or fills an empty media tile; contrast is measured per rendered role against the effective composited
  background, not against one token.
- **Every packet carries a deliberate failing case** and a STOP boundary; the coordinator reviews the changed-frame
  inventory before the next surface packet.

### Row → packet map

| Packet | Maps rows | Bounded objective · mode | Existing anchors (main unless NEW) | Proof-first: PLANNED assertion + independent oracle + deliberate failure | Commands: baseline now → planned | STOP · reviewer gate |
|---|---|---|---|---|---|---|
| 058-P1 | 1, 8 (negatives) | Re-runnable role inventory + `check-ui-system.mjs` + rendered-role AA negative cases (seeded bad artifacts the checker must reject) · **build (tests/metadata only)** | live manifest; `styles.css` literals; NEW `tools/ui-role-inventory.json`, `tools/check-ui-system.mjs`, `test/ui-system.mjs` | NEW `test/ui-system.mjs`: every live manifest state maps to a semantic role; a seeded literal `font-size`/radius/shadow/color outside token defs fails; a seeded 3.9:1 body-text role fails the AA check (oracle = WCAG 2.2 thresholds, not a snapshot). Failure: the checker infers a role for an ambiguous selector instead of failing loudly | baseline: `node test/ui-catalog-contract.mjs` → planned: `node tools/check-ui-system.mjs && node test/ui-system.mjs` | STOP if a visible component has no inventory role or the checker guesses · reviewer: reproduces one seeded-literal and one seeded-contrast rejection |
| 058-P2 | 2 | Define semantic type / radius / elevation token scales plus old-token aliases (`--radius`, `--r`); no intended consumer change · **build** | `styles.css` root; `test/appearance.mjs` | extend `test/ui-system.mjs`: each named token exists with its specified value in both themes; aliases resolve to the new tokens. Failure: an alias points at the wrong scale step | baseline: `node test/appearance.mjs` → planned: `node test/ui-system.mjs` | STOP if a token encodes a fixed height that clips scaled text · reviewer: token value/theme table |
| 058-P3 | 3 | Converge control states and progress dimensions: shared primary/secondary/quiet/destructive/disclosure/selection/disabled/icon semantics; `data-progress-dimension` on every progress element · **build** | `.btn` variants, steppers, radio cards, segmented/tabs, chevrons, Skip treatments in `styles.css`/renderers | extend `test/ui-system.mjs`: equivalent controls share states/tokens; a progress element without a `block` / `week` / `exercise-set` / `task` dimension fails; duplicate same-dimension bars on one surface consolidate only after an accessible-text comparison. Failure: two unlike semantics aliased because their silhouette matches | baseline: `node test/accessibility.mjs` → planned: `node test/ui-system.mjs` | STOP if a contextual variant loses shared target-size/focus/disabled semantics · reviewer: reproduces the dimension check and one variant rationale |
| 058-P4a | 4 | Migrate landing + program-entry surfaces to frozen roles, no motif drift · **build (one surface family)** | Plan 054 entry/landing markup (merged); owner-selected reference | per-surface: `node tools/capture-ui-screens.mjs --flow onboarding-start --flow onboarding-recommend`; semantic tree/focus/geometry unchanged vs Plan 054 contract. Failure: a CSS refactor reorders focus or hides a control | baseline: `node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs --flow onboarding-start` + `node tools/check-ui-system.mjs` | STOP if the surface's Plan 054 DOM/state contract changes · reviewer: changed-frame inventory for entry only |
| 058-P4b | 5 | Migrate Today / Focus / summary surfaces · **build (one surface family)** | Plan 055 workout markup (merged); `.focus-*` styles | `node tools/capture-ui-screens.mjs --flow today --flow workout --flow session`; core loop semantic/state facts unchanged; Mono assigned by value not ancestry. Failure: Focus hierarchy flattened | baseline: `node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs --flow workout` + `node tools/check-ui-system.mjs` | STOP if a workout/summary interaction contract shifts · reviewer: protected-strength parity note |
| 058-P4c | 6 | Migrate Progress surfaces · **build (one surface family)** | Plan 056 Progress markup (merged) | `node tools/capture-ui-screens.mjs --flow progress`; outcome/action/evidence roles and chart contrast pass in both themes. Failure: improved/declined distinguished by color only | baseline: `node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs --flow progress` + `node tools/check-ui-system.mjs` | STOP if a role needs a hierarchy change — hand it back to Plan 056 · reviewer: every outcome/state frame |
| 058-P4d | 7 | Migrate management + library surfaces (History/Share/Program/Settings/timer/library/install/help) · **build (one surface family)** | Plan 057 markup (merged); library styles | `node tools/capture-ui-screens.mjs --flow history --flow program --flow settings --flow library --flow install`; no nested-card tunnel; Replace/Remove keep rendered-role distinction. Failure: a card-within-card tunnel introduced | baseline: `node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs --flow history` + `node tools/check-ui-system.mjs` | STOP if an elevated descendant lacks a `selected`/overlay rationale · reviewer: closes the inventory exceptions for these surfaces |
| 058-P5 | 8 | Enforce rendered-role WCAG 2.2 AA across the whole live catalog (effective foreground/background, focus, boundary, state) · **build** | `test/ui-system.mjs`, catalog metadata | every role/state in EN/PT and light/dark computes its effective contrast and passes the applicable threshold; decorative separators marked non-required. Failure: a contrast case that cannot resolve its effective background is reported "unsupported" and blocks, not passed | baseline: `node test/accessibility.mjs` → planned: `node test/ui-system.mjs` (full catalog) | STOP if contrast cannot be measured against the effective rendered background · reviewer: measured matrix |
| 058-P6 | 9 | Remove compatibility literals/aliases and dead selectors; no one-off component or tunnel remains · **build** | `styles.css`, checker allowlist; owner board approval | zero-debt inventory + source scan; every remaining exception has selector/role/reason/owner. Failure: a consumer still on an old alias after removal | baseline: `node test/generative/run.mjs --profile ci` → planned: `node tools/check-ui-system.mjs` (zero debt) | STOP before removal until the owner visual board is approved · reviewer: final exception list |
| 058-P7 | 10 | Regenerate the complete converged catalog and prove responsive/theme/text/reduced/installed evidence · **build + owner board** | catalog manifest/scenarios/PNGs; `tools/check-ui-screens.mjs`, `tools/compare-ui-screens.mjs` | full regen + `node tools/check-ui-screens.mjs`; record live before/after screen/frame counts and the exact changed-frame inventory. Failure: a changed frame with no documented role/intent | baseline: `node tools/check-ui-screens.mjs && node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs` (full) then both checkers | STOP if any live public surface is unmigrated/unreviewed · reviewer + owner: board approval recorded (Plan 059 does physical sign-off) |

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/058-system-convergence`
- **Worktree:** `../repforge-ui-058-system`
- **Base:** current `origin/main`
- **Dependency gate:** Plans 049–057 merged and their principal surfaces accepted
- **Primary files:** `styles.css`, semantic markup/renderer annotations, UI-system/catalog tests and inventory, complete PNG catalog
- **Shared hotspots:** every public HTML/rendered component, `app.js`, i18n only for approved redundant labels, SW/cache, manifest
- **Conflicting phases:** all prior UI phases; none should concurrently edit public styling/markup. Plan 059 consumes final system and does not redefine it
- **Safe parallelism:** Inventory/checker work may start before the final principal PR merges against a pinned snapshot, but surface migration cannot merge before all dependencies. Within this plan, use the listed serial surface order unless separate branches have disjoint files and one designated integrator
- **Integration order:** 054/055/056/057 → 058 → 059

Fetch current main; inspect branches/worktrees/PRs; resume existing work. Use one dedicated worktree; keep coordination checkout clean; never copy uncommitted files or delete others' work. Push `chore(plan-058): start implementation`, open a draft PR, and fill it before substantive work. Target main. When a prerequisite merges, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected role/catalog/flow checks, push, update PR. Never rebase a published branch.

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

Push each coherent tested surface slice and update its PR/evidence immediately. Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash handoff. Never checkpoint a knowingly broken visual/semantic state; return to the last pushed boundary. Do not copy unpublished prior-phase work or redefine its contracts. Record role debt, exceptions, frames, owner board decision, commands/results, and exact next steps. Run `git status --short` before stopping; valid handoff is clean. Do not merge without authorization; owner review requires all inventory, rendered-role, catalog, regression, and visual gates complete.

## Completion gate

- A role inventory accounts for every public component/state and exact exception.
- No accidental one-off component, literal type/radius/shadow/color, unnamed progress dimension, or nested-card tunnel remains.
- Equivalent controls share semantic states; contextual variants are justified and tested.
- Plex Sans/Mono jobs, bounded scales, elevation/radius/progress roles, token-swap dark, palette, art paper, empty media, and selected landing continuity are preserved.
- Every rendered text/icon/control/boundary/focus role passes applicable WCAG 2.2 AA in both themes; color is never sole meaning.
- Every live public surface is migrated/reviewed, not only recently touched ones.
- EN/PT, 320/390/430/desktop, 200%, PT+200, reduced motion, overflow/scroll, installed/browser, SW upgrade, critical-flow, full regression, and complete catalog checks pass.
- Owner visual board approval is recorded; branch/PR are pushed, current, clean, and stopped at owner review.
