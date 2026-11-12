# Plan 084: the gauge returns as Training foundation

Status: design proposal for owner review, 2026-11-11. Docs and a disposable
static prototype only. The owner has reversed D-6's removal of the gauge and
rejected the name "effort calibration". The model, name, visual direction and
copy below are recommendations, not approved changes to the product rules.

Base: `origin/main` at `991163048b9e0da288e20924660e1b285c9ac4ca`.
[Prototype and contact sheets](../docs/design/plan-084-gauge/README.md).

## 1. The job

The owner's brief asks for progression, tailoring and investment, eventually
leading to a paywall after the alpha. The gauge should make the connection
visible: the lifter saved work, Taurifer learned something specific, and a later
target used it. A growing record makes that connection more useful over time.
It must never imply that a fuller ring means a stronger or more diligent person.

Plan 077's percent answered a smaller question, how much recent evidence exists
about effort reporting. Its six signals are T test sets, A set agreement,
H suggestion agreement, W week pairs, S slow-rep answers and R history.
`calibration-gauge.js` still computes the percent on this base but nothing renders
it. Renaming that number would preserve the wrong model.

T has 55% of the weight, with two weighted checks on up to four eligible lifts.
Without optional test sets the ceiling is 45%. Evidence has a 90-day half-life,
so the number falls during rest. The old Today ring combined that percent with
test-set dots; the Overview repeated it over six weighted bars. Direction B of
the earlier ring study shipped in #636. Commit `758e298b3` removed that UI under
Plan 081. Neither the formula nor its dots should return under a broader name.

## 2. Proposed model: evidence used, with its history intact

Recommend counting **lifts with a demonstrated history-to-target chain**.
This measures one bounded part of tailoring, not everything Taurifer knows.
Beside it, show the actual investment, sessions whose saved rows informed later
saved targets, and the optional lessons in test sets and findings. Do not add
these unlike units into a weighted total.

A lift contributes once when all three statements have saved evidence:

| Step | Required evidence | What it means |
| --- | --- | --- |
| A working load exists | A saved non-warm-up row with valid performed load and reps. A session-zero `startingLoad` can explain its origin; it is not required. | A declared prior has met work the lifter actually did. |
| A basis formed | At a historical session boundary the comparable-key estimate was Solid under the pinned standing rule. Retain the row/session references that reproduce that boundary. | Enough comparable evidence existed. This does not promise that today's standing is Solid. |
| The basis was used | A later saved session contains a working set at the history-derived suggested load, within one implied capacity rep of that target, under a pinned engine replay with only earlier sessions available. | A target informed by that basis was borne out by saved work. A hold target qualifies. |

The proposed projection reconstructs these events from saved rows. It never
awards credit for a tap, a preview, accepting an invitation, purchasing, or
merely waiting. Words count under the standing module's existing row weights;
missing effort and untouched prefills cannot fabricate a qualifying basis.
Measured failure rows follow the standing owner's rules rather than a second
quality table. A pain stop or an unmatched target has no penalty. There is no
request to train extra or obey a load to fill the gauge.

Use the engine's complete comparability identity, including performed movement,
equipment, loading convention and metrics. A display alias or duplicate slot
must not earn another contribution. The current movement-only profile/gauge
keys are not sufficient authority for this new projection. Do not merge a new
machine with an old one to make a mark fill.

### Scope and monotonicity

The ring/bar describes the active program's distinct comparable keys. The
prototype has four. Production uses the actual number, never the old four-lift
cap. With no program show no gauge; with no usable keys show a plain explanation,
not 0/0. For a large program, use a continuous arc plus the exact textual count,
not dozens of unreadable segments.

Within a fixed program scope, an earned chain stays earned while its saved
source evidence remains valid. Time alone never subtracts it. Historical Solid
is distinct from current Solid: after a break the profile may say Learning while
the gauge still says that this lift has informed targets before. The detail
explains both, with dates. Never use the gauge to schedule test sets or select
loads; the estimator's uncertainty and safety ceilings remain authoritative.

Changing program scope can change the fraction. Say "New program: 2 of 6 lifts
have a basis from your history", retain the prior program's factual record,
and avoid an animated fall. Changing equipment creates a new key with its own
learning, with an explanation. History correction, deletion, backup replacement
or a revised projection can also reduce counts. Re-derive, name the reason and
never silently preserve an unsupported high-water value. Clearing history clears
its gauge. Evidence must travel only with the existing authorized backup and
install-transfer data, not a new counter or setup-link field.

Pin a foundation-rule version and replay dependency versions before implementation.
A historical rule is an explicit interpretation of saved evidence, not a claim
that the old app stored or executed an adaptation it did not. If the replay
cannot reconstruct a comparable prescription and history, leave the chain
unproven. Legacy/imported logs keep their factual session and test counts;
unknown provenance never becomes confirmed target use. Do not introduce a saved
acceptance event or schema just to make a prototype number attainable.

### Candidate signals, and why they stay separate

| Candidate | Proposed treatment |
| --- | --- |
| First / Learning / Solid per lift | Show current standing in the profile; historical Solid forms one part of a chain. Never average the three words. |
| Test sets | Saved guess against result, dated and optional. No minimum for filling the gauge. Three checks still govern a bias correction under OD-14/18. |
| Findings released | Reuse the seven rules and dates from `progress-model.js`. No credit for opening or dismissing one; no extra invented findings. |
| Opening loads confirmed | Saved working-load evidence, whether from session zero or ordinary sessions. A prior alone is not confirmation. |
| Weeks trained | Optional factual distinct weeks with saved sessions, never consecutive weeks or elapsed calendar time. Not in the gauge arithmetic. |
| Adaptations accepted | Only name an adaptation when a saved applied definition and its provenance prove it. Not an input in the first implementation; accepting a proposal alone proves no benefit. |
| Sessions informing targets | Distinct source session ids in successful chain replays, counted once across all lifts, never all sessions merely logged. Direction C makes this investment the lead figure. |

### Worked states in the prototype

The four-lift program is machine chest press, cable row, leg press and pulldown.
The full-day prescription remains the focus of Today.

| State | Earned chains | Source sessions used | Other evidence |
| --- | --- | --- | --- |
| Fresh, before first saved session | 0 of 4 | 0 | All First; no test sets or findings yet. |
| Mid-way | 2 of 4 | 6 | Chest press and row earned; leg press Learning, pulldown First; 1 optional test set. |
| Well-tailored in this bounded sense | 4 of 4 | 18 | Every current lift has a chain; more evidence and new findings can still arrive. |
| Finish, before → after this save | 1 of 4 → 2 of 4 | 5 → 6 | Row's first qualifying use completes its chain. A separate first-test-set finding says guessed 11, did 14; one check changes no bias. |

These are synthetic design fixtures, not production-module outputs or observed
lifter results. The finish may reveal existing saved source sessions as newly
used by today's target; its count does not mean six sessions happened today.
If a session earns nothing, show the unchanged reading and its next evidence
need. Never manufacture a delta. A first saved session confirms work but cannot
have its own previous-history chain, so the ring can honestly remain empty.

## 3. Names, PT first

| PT | EN | Assessment |
| --- | --- | --- |
| **Base do treino** | **Training foundation** | Recommend. A basis in the record, with no claim of comprehensive knowledge. |
| Construído com suas sessões | Built from your sessions | Makes investment clear; too long for a small header. Good supporting sentence. |
| Histórico em uso | History in use | Most literal for the successful chain, but colder as a title. |
| O que aprendemos | What we've learned | Warm and close to the profile; the subject can imply a human team. |
| Seu treino, com mais contexto | Your program, with more context | Broad and understandable; "context" needs a concrete line underneath. |

Avoid "sob medida", rejected by the strategy note for promising tailored
generation, as well as coach, score, streak, accuracy and completion language.
Standing remains First / Learning / Solid in its existing localized words;
it never becomes the name of a whole-person state.

## 4. Three directions, with one recommended

**A. Evidence ring, recommended.** A segmented ink ring beside the Today title,
with the earned-lift count inside and a short "Base do treino" label. A larger
version leads the profile. The finish shows the same ring moving from 1/4 to
2/4, accompanied by the row's saved reason. Keep the appeal of #636's small
ring, but remove the percent, test-set dots and colour ladder. Trade-off: a
closed circle still invites completion. The count and scope must be explicit.

**B. Coverage rail.** A flat row beneath Today's program name contains four
segments, one per lift, with an exact "2 of 4" line. Overview replaces the
abstract rail with a three-column evidence table: load, basis, used. The finish
extends one segment and names the lift. It explains the denominator best, at
the cost of a full-width item ahead of the training task. This is explicitly
a proposed exception to the ban on bars, not a way around it.

**C. History in use.** Today has a slim typographic line, "6 sessions informing
your targets", beside six restrained ledger marks. Overview opens a receipt of
source dates and the target they informed. The finish moves 5 → 6 with one new
source line. No total to fill; 18 keeps growing. The same 2-of-4 coverage stays
in the detail. This is the least game-like alternative, but the least like the
small ring the owner originally liked. Marks are compressed above 12, never a
hidden maximum. The exact count always remains visible.

### Placement and interaction

- Today: below the title for B/C, beside it for A. A fresh onboarded lifter sees
  a quiet empty reading and a truthful next step. Start session remains the
  strongest action. Never show this in the no-program invitation or as an
  interruption while logging in Focus. For a collapsed header, propose a
  44px tap target containing A's 30px ring; B/C remain in the scroll content.
  The static prototype concentrates on the large header, not that scroll path.
- Progress › Overview: gauge, brief meaning and dated evidence, followed by
  the profile's per-lift standing, findings, six signal counts and recent tests.
  It is one reader, not a fifth dock destination or a second dashboard.
- Finish: factual session totals first, one gauge change and its reason next,
  the existing new finding beneath it. One tap opens Overview, with a return
  to the finish screen. Keep the finding visible when the gauge does not move.
- Later commercial moment: the block review, when a history-aware next program
  is a real available action. The gauge is subordinate evidence, never the
  trigger, a countdown, or a lock. No commercial UI is in this prototype.

Gauge tap announces the name, exact count and scope, then opens Overview at
its explanation. No slider semantics. Decorative arcs/marks are hidden from
assistive technology; the text is the reading. A live update announces once
after a successful save, never every animation frame. All controls retain
44px targets, visible focus and localized labels. PT is reviewed first.
The proposed 500ms linear change in the disposable prototype is a comparison
aid with a manual replay control, not approved product motion. Production would
use `motion-layer.js`, one short transition with no bounce, and an immediate
end state under reduced motion. No pulse, confetti, sound, haptic or reward.

## 5. Keep the profile and findings

#731's profile and #737's seven findings are merged on this base. #736's
finish findings remain an open PR at the time of writing; this design depicts
its intended finding slot and must integrate with its final implementation.
Do not restore removed markup/globals as a shortcut. The old historical shell
is research material, not a compatibility requirement for a new design.

The profile answers "what is known on this lift now?" Findings say what the
record first showed and when. The gauge answers "where has my history already
informed a target?" A lift can be Learning today after a break and still carry
an earned historical chain. Show its dated evidence; do not overwrite standing
or release another first finding to make the gauge feel busy.

Reuse the actual `standing` field and findings owner. The old six signals stay
as diagnostic counts, including disagreeing sets. They are not six progress
bars again, and poorer agreement does not subtract investment. The prototype
shows a compact excerpt of the profile so the whole relationship fits at 390;
it does not propose deleting the remaining rows from production.

## 6. Answer the rejected gauge and define the later commercial hook

The strategy rejected a percentage in a landing hero, a bar to fill and the
45% ceiling. This proposal keeps the gauge inside the lifter's record, keeps
the landing unchanged, uses countable work instead of a synthetic percentage,
and makes full coverage possible without test sets, numeric effort mode or
paid adaptations. It never fades while the person rests.

That answers the arithmetic and pressure objections. It does not erase the
visual objection: A's ring and B's rail still look fillable. The owner must
approve a narrow exception for actual evidence coverage or choose C. If even
an exact count becomes an instruction to comply, prefer C or remove the
Today gauge while keeping its evidence reader. Do not reward hitting targets
in the engine or increase test frequency to make a mark move.

Post-alpha proposal only: keep the gauge, its source record, current-program
profile, seven findings, test-set corrections, normal progression and exports
Free. Pro can add a next program built from the record and bounded adaptations
under the existing thesis jobs. The block review can say which source sessions
are available to that real capability, with an ordinary optional Pro choice
separate from its factual conclusions. It cannot say that buying Pro completes
the ring or that Free loses what Taurifer learned. Never dim saved facts, sell
accuracy or show a withheld proposal. A lapsed subscription changes no earned
mark and no Free target. Across-program factual records remain readable Free;
the tentative paid boundary is synthesis into a new program, not ownership of
history. This specific boundary still needs the owner's post-alpha decision.

All alpha participants retain all features, without payment or a trial clock.
No price, fake door, checkout, entitlement call or backend belongs to Plan 084.
An entitlement-lifecycle ADR and the alpha evidence gates still precede any
commercial implementation, as D-7 to D-13 and ADR 0010 require.

## 7. Conflicts the owner must settle

| Rule / decision | Proposed treatment |
| --- | --- |
| D-6, Plan 081 §2 and Plan 077 OD-20 amendment | Owner's new brief reverses removal. Amend these records with the selected model and keep the profile/findings. Do not erase their historical rationale. |
| PRODUCT.md / CONTEXT.md percentage and score bans | Keep percentages and arbitrary points banned. Add a precise exception for dated evidence counts and, if A/B wins, their scoped coverage visualization. The gauge is not capacity, accuracy or current standing. |
| No bars and no celebrations, Plan 081 §3/6 and DESIGN.md | A/B require an explicit visual exception; C avoids a completion total but still needs agreement that cumulative evidence is useful. Keep celebrations banned in every direction. |
| DESIGN.md orange budget | Prototype uses ink for every gauge mark. No additional orange use is requested. Rest/Focus bars retain their own meanings. A coloured gauge would require a separate owner decision and contract amendment. |
| ADR 0003, no new Settings dial | Keep fixed versioned rules in code, no sensitivity, weights, goal or visibility setting. The gauge never feeds recommendations. |
| Telemetry freeze and closed schema | No new event, property, percent, source id, finding text, lift name or Basics value. Design reviewed without measuring gauge engagement. Any later experiment requires its own approved schema decision; never infer permission from the funnel aim. |
| Free floor, analytical independence, ADR 0010 | Commercial choice is separate from engine conclusions. No pay-to-fill, decayed Free reading or degraded suggestions. |

This PR leaves the governing documents intact until the owner chooses. A plan
is not silent permission to bypass them during implementation.

## 8. Proposed PR split after owner selection

1. **Decision record and pure model.** Record the selected exceptions/name in
   PRODUCT, CONTEXT, strategy D-6 and Plans 077/081. Define the versioned
   evidence projection through shipped modules. Prove saved provenance,
   comparability, no-test-set completion, idempotent replay, no change with
   elapsed time, correct history edits/deletion and unsupported legacy inputs.
   First resolve replay limits and version availability, before promising a
   production count. No visual work before that contract holds.
2. **Today and Overview.** Build the chosen direction beside the existing
   profile and findings. Approved EN/PT strings, navigation and return focus,
   no-program state, new equipment/program scope explanations, motion and
   reduced motion, shared roles, asset/cache revisions and affected catalog
   frames. Keep old percent unrendered. Handle the collapsed-header ring here
   if selected. No new durable preference or schema is presumed.
3. **Finish integration.** Rebase onto the final #736 implementation, one
   successful-save comparison, unchanged-count state, finding co-presence,
   Overview-and-back navigation and approved localized copy/frames. A failed
   or cancelled save earns nothing. Only necessary implementation proofs,
   according to the repository's then-current rules.
4. **Separate gated commercial design later.** Alpha evidence, owner Free/Pro
   decision and entitlement ADR first. This is not authorization to build it.

This design PR runs no tests and waits on no CI, by the explicit brief. Browser
work is limited to prototype capture and visual inspection under
`flock /tmp/taurifer-browser.lock`. No app assets, test files, production catalog,
cache inventory, source strings, settings or telemetry are changed.

## 9. Owner questions

1. **Recommend A, the small evidence ring.** Choose A, B's explicit coverage
   rail, or C's open-ended history receipt? A best preserves the original
   glanceable ring while tying every segment to a lift.
2. **Recommend Training foundation / Base do treino.** Approve that name and
   the prototype's EN/PT candidate copy, or choose another row in §3?
3. **Recommend one earned history-to-target chain per comparable lift, with
   optional test sets and no weighted total.** Approve this definition of
   learning and tailoring, with session counts as investment alongside it?
4. **Recommend no time decay and no loss during rest.** Approve historical
   earned evidence separate from current standing, with explained changes
   only after scope changes, corrected/deleted records or a version change?
5. **Recommend a narrow ink-only coverage exception for A/B, no percent and
   no celebration.** Approve the amendments in §7 while keeping the landing,
   orange budget, settings and telemetry unchanged?
6. **Recommend Today + Overview + finish, with Start session dominant and no
   gauge in Focus.** Approve these placements and a static full ring once
   current-program coverage is complete, while evidence keeps growing?
7. **Recommend all of it Free in the alpha, and facts Free afterwards.** Keep
   Pro as the later action of building/adapting from the record, decided
   after alpha evidence and an entitlement ADR, with no paywall in this plan?
