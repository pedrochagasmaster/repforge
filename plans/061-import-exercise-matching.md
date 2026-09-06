# Plan 061: Import exercise matching

- **Plan number:** 061
- **Phase:** Not part of the UI overhaul programme (049–059)
- **Status:** Owner-ratified direction; implementation has not started
- **Owner approval state:** All seventeen decisions below were settled in a grilling session and are final. Reopen one only with new evidence, not with a new preference
- **Depends on:** Nothing. Deliberately independent of PR #225, which ships the paste door
- **Blocks:** Nothing
- **Governing decisions:** Q1–Q17 of the matching grilling, recorded in *Settled decisions*
- **Affected surfaces:** `nameAffinity` and `classifyImportRow` in `app.js`, the shared import review row, `tools/exercise-curation.json` and the generated `exercises.js`, `telemetry.js`, `docs/measurement/`, the UI screen catalog
- **Complexity:** Medium
- **Risk:** Medium — the matcher is shared by every import path, and rows that resolve correctly today can regress silently

## Problem statement

A twenty-lift Portuguese program imported through the paste door produced six
linked rows and fourteen needing review, and several of the proposals were
confidently wrong. "Hip thrust com barra" proposed Barbell back squat. "Búlgaro
com halteres" proposed Dumbbell bench press. "RDL" and "Banco Romano 45°"
matched nothing at all.

This is not a paste-door defect. `nameAffinity` and `classifyImportRow` are
shared with file import and have behaved this way since long before the paste
door existed. The paste door only made it visible, because a lifter pasting a
coach's message brings names written the way people actually write them.

## What the matcher actually does

Measured against the real library, not inferred.

`nameAffinity` is bag-of-words overlap over tokens longer than two characters,
divided by the larger token count. Three consequences, each verified:

1. **Stopwords and equipment words carry the same weight as movements.** The
   Portuguese `com` is three characters, so it survives the length filter. For
   "Hip thrust com barra", `com` and `barra` are the only tokens that match
   anything, and **thirty-six library entries tie at 0.50** — every barbell
   movement. Array position picks the winner, which is why `sq_bb` at line 17
   beats `ht_bb` at line 29.

2. **The correct entry is usually already at the top, and loses the tie.** In
   five of the eight observed failures the right library entry scores exactly
   what the wrong one scores: `sqk_mc` ties `sqk_bb` for "Hack squat", `ht_mc`
   ties `ht_bb` for "Hip thrust na máquina", `lgr_db` ties `lg_db` for "Afundo
   reverso com halteres".

3. **A longer input dilutes an exact containment.** "Leg press 45°, pés altos e
   afastados" contains the library name `Leg press` completely, yet scores
   2/5 = 0.40 and falls under the 0.50 threshold, so nothing is proposed.

A fourth class no scoring change reaches: `ab_mc` is "Cadeira abdutora", so
"Abdução de quadril na máquina" shares no token with it and sits seventh even
after reweighting. `RDL` and "Abdução em pé no cabo" produce no candidates at
all.

One correction to the record: **"Remada máquina com apoio peitoral" already
resolves correctly** to `rwv_mc` at 0.60. It appears in the failure screenshots
but is not a failure.

## The measurement that decides the design

A prototype applying stopword removal and equipment de-weighting, roughly ten
lines:

| Metric | Before | After |
|---|---|---|
| Correct entry in the top three | 2 of 7 | **6 of 7** |
| Correct entry ranked first | 1 of 7 | 2 of 7 |
| "Hip thrust com barra" | 36-way tie | `ht_bb` wins outright |

Scoring reliably moves the right answer *into* the visible set and does not
reliably move it to *first place*, because some inputs are genuinely ambiguous.
"Hack squat" ties Barbell hack squat against Hack squat machine at 0.89 and the
source never says which. That asymmetry is why the row shows candidates rather
than a verdict.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | This work ships in its own PR with a backlog entry, not folded into #225 |
| Q2 | The review row offers up to three ranked candidates rather than one proposal |
| Q3 | A fixture corpus is built first and must pass before any scoring change merges |
| Q4 | The assistant is never asked for a canonical or library name |
| Q5 | Aliases live in `tools/exercise-curation.json` and are regenerated into `exercises.js` |
| Q6 | Scoring gains stopword removal, equipment de-weighting and containment. No movement-token vocabulary |
| Q7 | Equipment is de-weighted in scoring and is the first tie-breaker, then `rank`, then stable order |
| Q8 | Alternates appear on every row that is not an exact or alias hit |
| Q9 | A row with alternates still blocks Import until a human touches it |
| Q10 | The corpus has a strict tier asserting exact identity and a loose tier asserting top-three membership |
| Q11 | Alias only what the corpus proves broken; the systematic pass is a separate backlog entry |
| Q12 | A curated alias hit classifies as `IMPORT_ALIAS` and arrives pre-confirmed |
| Q13 | The display floor drops from 0.50 to about 0.35, tuned from corpus evidence |
| Q14 | Three candidate chips lead the row; Choose, Keep and Create custom collapse behind a disclosure |
| Q15 | This plan plus two backlog entries |
| Q16 | Ambiguous corpus rows accept a set of acceptable ids |
| Q17 | One categorical event records how each row was resolved |

## Approved direction

### Scoring

Rewrite `nameAffinity` to:

- drop stopwords in both languages before scoring, so `com`, `para`, `the` and
  `with` never contribute;
- weight equipment tokens at a fraction of a movement token, so `barra` and
  `halteres` inform a match without deciding one;
- score containment separately, so a library name wholly present inside a longer
  input is not punished for the lifter's setup notes.

Do not add a curated movement-token vocabulary. It would be a second bilingual
word list to maintain beside the muscle tokens, and the corpus will show whether
it is needed at all.

### Tie-breaking

Equipment is de-weighted for scoring and decisive for ties. When two entries
score equally, prefer the one whose equipment appears in the input, then the
higher `rank`, then stable order. This alone turns "Hip thrust na máquina" from
`ht_bb` into `ht_mc`.

### The review row

`classifyImportRow` returns a ranked candidate list rather than a single match.
Every row that is not an exact or alias hit shows up to three candidates above
the display floor. Below the floor a row shows no candidates and keeps its
imported name, which is what "Banco Romano 45°" should do rather than proposing
Glute-ham raise at 0.31.

The three candidates lead the row. Choose, Keep the name and Create custom move
behind a disclosure: they matter for a minority of rows, and twenty rows at four
wrapped lines is the scroll the screenshots already show. Nothing here changes
what blocks activation. A row with three candidates is still unreviewed until a
human picks one, exactly as a probable row is today.

`IMPORT_PROBABLE_MIN` is only a display filter and always has been.
`buildImportDraft` gives both `IMPORT_PROBABLE` and `IMPORT_UNMATCHED` rows
`decision: "raw"` and `reviewed: false`, so lowering it cannot weaken the
activation gate.

### Aliases

A new `aliases` array per entry in `tools/exercise-curation.json`, regenerated
into `exercises.js` by `tools/build-exercises.mjs`, covered by
`test/exercise-library.mjs`, and matched case- and accent-folded like the
existing names. Never hand-edit `exercises.js`; `--check` flags the drift.

An alias hit classifies as `IMPORT_ALIAS`, which arrives pre-confirmed. The
precedent is already in the product: a Portuguese name match is an alias hit
today, which is why "Cadeira flexora" shows as Confirmed and folded, correctly.
The distinction that matters is provenance rather than confidence. An alias in
the curation file passed the same editorial gate as the library entry; "RDL
means Romanian deadlift" is not a guess.

First pass covers only what the corpus proves broken: `hg_bb` for RDL, `hx_bw`
for Banco Romano, `ss_db` for Búlgaro, `sq_lp` for Leg press 45, `ab_mc` for
abdução de quadril, and `sqk_mc` for Hack.

### The corpus

A fixture asserting input-to-expected across both languages, wired into
`.github/workflows/simulation.yml`, in two tiers:

- **Strict.** The row must resolve to exactly this library id. Seed it with the
  five Cecela rows that already work, so a regression fails loudly:
  `Cadeira flexora`, `Cadeira extensora`, `Mesa flexora`,
  `Elevação lateral na máquina`, and `Remada máquina com apoio peitoral`.
- **Loose.** The expected id must appear in the top three. Ambiguous rows list a
  set of acceptable ids rather than freezing a guess into a test.

The owner arbitrates which rows are ambiguous and what their acceptable sets
contain. `Hack squat` is the clear case: both `sqk_bb` and `sqk_mc` are
defensible readings of a source that never says.

### Telemetry

One categorical event recording how a review row was resolved, distinguishing
the leading candidate, an alternate, keep-as-imported, a new custom definition
and a full picker trip. It carries no exercise name, program name or any other
content. It needs an enumeration in `telemetry.js` and an entry under
`docs/measurement/`, the same discipline Plan 060 applied to the import funnel.

Do not record match scores. Scores invite tuning against a number nobody
validated.

## Non-goals

- No movement-token vocabulary, and no stemmer.
- No systematic alias pass over all 270 movements in this plan.
- No request to the assistant for canonical or library names. ADR 0014 and Plan
  060's fourth standing principle both hold: the assistant transcribes, the
  matching layer maps.
- No change to what blocks activation.
- No repointing of any `libraryId` at a different movement. Aliases add ways to
  reach an entry and never change which movement an id means, so nothing already
  saved on a device changes.

## Verification

```bash
node --check app.js
node tools/build-exercises.mjs --check
node test/exercise-library.mjs
REPFORGE_URL=http://localhost:8000/ node test/program-import-review.mjs
REPFORGE_URL=http://localhost:8000/ node test/program-freeform-import.mjs
REPFORGE_URL=http://localhost:8000/ node test/accessibility.mjs
```

The corpus must be green before any scoring change merges, which is the point of
building it first. Both tiers run in CI.

Because the shared import review changes, re-run
`node tools/capture-ui-screens.mjs` and commit the refreshed frames, adding the
alternates row and its disclosure to `docs/ui-screens/manifest.json`. Capture on
the browser build the catalog is pinned to; read the current one out of
`test/browser.mjs` and the workflow rather than assuming, because a mismatched
Chromium rewrites every frame in the tree and none of that diff is real.

Because `app.js` changes, bump `CACHE` in `sw.js` and move every `?v=` revision
that tracks it in `index.html` and `sw.js` together. Read the current number
from `sw.js`; `CLAUDE.md` is stale on this.

## Standing principles

1. The review screen is the trust boundary. A confident wrong answer is worse
   than an honest list of candidates.
2. Ambiguity is disclosed, not resolved by guessing. When the source does not
   say whether Hack squat means the barbell or the machine, neither does
   Taurifer.
3. Provenance decides match strength. A curated alias arrives confirmed; a
   score-derived guess does not.
4. Aliases add reach, never meaning. An id keeps pointing at the movement it
   always pointed at.
5. Improvement is measured before it is claimed. The corpus says whether
   matching got better; the field event says whether it got better for people
   whose programs we have never seen.
