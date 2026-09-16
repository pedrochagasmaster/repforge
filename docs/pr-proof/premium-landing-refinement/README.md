# Premium landing art-direction refinement

This is a composition/art-direction delta on top of the owner-approved
six-beat integration at `a2ce8ca8698d20bae4d3752c9ecb23491b09c0cd`, not a new
landing direction or a new Plan 054 specification. PR #241 remains a draft
and Plan 054 remains active for physical-device and assistive-technology
review. See [the design record](../../design/plan-054-landing-directions.md#owner-directed-art-direction-recomposition-2026-09-16)
for the full composition rationale.

## Before and after

Before frames were captured fresh from `a2ce8ca8` in an isolated worktree.
After frames were captured from the recomposed candidate. All frames are
full-page (the internal `#firstRun` scroll container, sized to its own
`scrollHeight` before capture, not the ordinary viewport).

| View | Before `a2ce8ca8` (six beats) | After (four chapters) |
|---|---|---|
| 320 EN, full page | [Before](before/320-en-full.png) | [After](after/320-en-full.png) |
| 390 EN, full page | [Before](before/390-en-full.png) | [After](after/390-en-full.png) |
| 768 EN, full page | [Before](before/768-en-full.png) | [After](after/768-en-full.png) |
| 390 dark (catalog) | — | [After](after/390-dark-en.png) |
| 390 PT-BR (catalog) | — | [After](after/390-light-pt.png) |

The dark and PT-BR frames are the regenerated UI-screen-catalog PNGs
(`docs/ui-screens/screens/onboarding-start/first-run__phone-390-{dark-en,light-pt}.png`),
captured through the repository's own tooling rather than an ad hoc script,
so they reflect exactly what CI's catalog check holds as current.

## What changed

Six sequential beats (getting started, the program, the prescription, the
reasoning, the record, over time) recompose into four movements: hero,
**01 / Getting started** (entry + program), **02 / What happens after you log
a set** (the signature progression system — prescription, logged work, the
rule, the verdict, session evidence, and the four-session trend as one
causal composition), and the closing. Device appearances drop from eight
images across seven stages to five images across four stages. No new device
renders were generated; this recomposes the eight already-approved Form
iPhone Studio scenes. Full rationale, the exact crop math for the "why this
weight" card, and the retired/added i18n keys are recorded in the design doc
linked above.

The hero's `today-ready` device is larger and bleeds to the trailing
viewport edge instead of sitting centered below the copy. The four-session
`92.5 → 100 kg` trend is now the single largest, most dominant statement on
the page — the intended visual climax — instead of one fact among six
similarly-weighted beats.

A pre-existing bug surfaced while rebuilding that exact climax: the trend's
screen-reader-only "to" used a class (`sr-only`) that does not exist in
`styles.css` (the project's real utility is `.visually-hidden`), so the word
rendered visibly next to the decorative arrow in the six-beat production
candidate. Fixed in the same markup this pass already owns.

## Renders, assets, and offline boundary

All eight approved scenes (`entry-hub`, `recommend-result`, `today-ready`,
`program-overview`, `focus`, `why-this-weight`, `session-summary`,
`exercise-chart`, each EN/PT × light/dark, shared 903×1832 frame) stay in
`assets/brand/`. `entry-hub`, `recommend-result`, `focus`, `why-this-weight`
and `today-ready` remain in production use. `program-overview`,
`session-summary` and `exercise-chart` no longer appear in `index.html`;
they remain real, captured, documented renders — used by the standalone
prototype at `docs/design/plan-054-landing-prototype/` and its evidence —
not deleted. They were already lazy-loaded, not precached, so removing their
production references changes zero precache weight.

Cache revision advanced `repforge-v256` → `repforge-v257` because
`index.html`, `styles.css` and the generated `i18n.js` all changed. The
coupled `shared-setup.js`/`app.js` `?v=` revisions moved to `257` in lockstep
per the existing ritual, even though neither script's content changed, to
keep `test/exercise-library.mjs`'s three-way lockstep check meaningful.

## i18n

`landing.beat1`–`landing.beat6` (and their `.fact*`/`.index`/`.title`/`.body`
children) retired from both `i18n-en.json` and `i18n-pt.json`.
`landing.program.*` and `landing.system.*` replace them, carrying forward the
same underlying facts and fixture — nothing was invented. The now-unused
`landing.shot.program_overview.alt`, `landing.shot.session_summary.alt` and
`landing.shot.exercise_chart.alt` keys were also removed (confirmed unused:
the standalone prototype page carries its own independent, unprefixed i18n
keys and never referenced these). `landing.closing.body` was reworded to
call back to the signature chapter's promise instead of a generic time
estimate. Generated catalog: 1,898 EN / 1,898 PT keys (down from 1,925/1,925,
reflecting the net key retirement).

## Test updates

`test/install-modes.mjs`'s landing-shape oracle (`heroShape()`) encoded parts
of the old six-beat geometry rather than the intended observable contract, so
it was corrected rather than loosened:

- `/Program|Programa/` (case-sensitive) only matched because of the removed
  `program-overview.alt`'s capitalized "The Program screen:". Changed to
  `/program|programa/i` — the actual intent ("the narrative mentions a
  program") holds against the new copy without depending on incidental
  capitalization from a deleted string.
- The four-render-inventory assertion literally named the six-beat renders
  (`"Program screen"`, `"saved session summary"`, `"strength trend"`).
  Replaced with the renders actually in production
  (`"recommended program screen"`, `"Create a program screen"`,
  `"focused set view"`, `"Why this weight sheet"`).
- `lastBeat` and `narrowSequence` queried only `.firstrun-beat`, so they
  silently stopped covering the new `.firstrun-signature` section instead of
  failing — a coverage gap, not a red test. Both were widened to also
  measure `.firstrun-beats > *` (all sections, for `endingAfterProof`) and
  `.firstrun-signature__copy`/`__figure` (for `narrowSequence`'s
  copy-before-figure order at narrow widths).
- Added `signatureCropAttached`: the "why this weight" crop must intersect
  the signature anchor (the new pair-like overlap relationship the old
  composition never had). Deliberately does not require the crop to stay
  fully inside the viewport — like the hero figure, it is allowed a few
  pixels of intentional edge bleed, clipped harmlessly by `.firstrun`'s
  existing `overflow-x:hidden`; `noHorizontalOverflow` (unchanged, still
  asserted) is what actually guards against a real scrollbar.

No behavioral, accessibility, localization, privacy, install, or shared-link
assertion was weakened. Every existing passing assertion about the pair
overlap (24%), the live prescription/logged/verdict/trend facts, 200% text,
reduced motion, and forced colors still passes unchanged against the new
markup.

## Proof

```sh
node tools/build-i18n.mjs                              # 1,898 EN / 1,898 PT keys
node test/i18n.mjs                                      # 36 passed, 0 failed
node test/exercise-library.mjs                           # 39 passed, 0 failed (incl. repforge-v257 lockstep)
node --check app.js && node --check i18n.js && node --check sw.js
REPFORGE_URL=http://127.0.0.1:8231/ node test/install-modes.mjs        # 470 passed, 0 failed
REPFORGE_URL=http://127.0.0.1:8231/ node test/entry-landing.mjs        # 114 passed, 0 failed
REPFORGE_URL=http://127.0.0.1:8231/ node test/accessibility.mjs        # 158 passed, 0 failed
REPFORGE_URL=http://127.0.0.1:8231/ node test/ui-catalog-contract.mjs  # green
CAPTURE_FILTER=onboarding-start/first-run REPFORGE_URL=http://127.0.0.1:8231/ \
  node tools/capture-ui-screens.mjs                      # 7/7 committed atomically
node tools/check-ui-screens.mjs                          # 96 screens, 469 frames
REPFORGE_URL=http://127.0.0.1:8231/ node tools/run-tests.mjs affected --base origin/main
```

The accessibility count (158/158) matches the PR's existing baseline
unchanged — this pass touched typography, spacing, crop and copy, not the
accessibility tree, and the one real bug it fixed (`.visually-hidden`) had no
dedicated assertion either before or after.

## Remaining review boundary

Automated and deployed-browser evidence is complete for this pass. Physical
iOS/Android and assistive-technology review in EN/PT, light/dark remains the
owner's open gate, unchanged from the state PR #241 was already in.
