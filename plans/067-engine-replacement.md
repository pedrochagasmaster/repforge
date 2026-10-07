# Plan 067: Replace program generation, exercise ontology, and progression

- **Status:** Application replacement in progress on `impl/067-engine-replacement`.
- **Owner direction:** 5 October 2026 conversation. Closest practicable mirror,
  full usable catalog and ontology, generation and progression replacement,
  explicit approximations, no existing users requiring migration, one complete
  replacement release. The owner authorized a PR containing this plan and artifacts.
- **Base:** `11cb3a9d`, current main when this package was prepared.
- **Queue:** Now, before Plan 059 freezes the alpha candidate. Supersedes the
  future engine direction of Plans 046–048 and 065. Plan 065 shipped in PR #306;
  its historical results remain valid for that version. Do not reapply its patch.
- **Boundary:** This PR delivers specification, source data, sanitized evidence,
  and reproducible tooling. The future app remains the static local-first PWA.

## Goal and authority

Generate coherent user programs from the complete source exercise knowledge
base and adapt prescriptions from actual performance. Replace coarse name-based
catalog inference, family templates, and selectable strategy engines wherever
these prevent the new behavior. Preserve storage safety, explicit activation,
fast logging, offline operation, accessibility, and the internal `repforge` names.

The [evidence README](067/README.md) owns corpus provenance and reproduction.
The [unknowns ledger](067/unknowns.md) owns unresolved behavior and corrections.
Exact data, export observations, supplied research, inferred rules, and chosen
approximations must remain distinguishable. Native strings are evidence of names,
not recovered formulas. Full parity with an unavailable server is not a claim.

No user migration is required. The implementation must reconcile the existing
"decode v1/v2/v3 forever" rule in AGENTS/ADR 0007 explicitly: this owner direction
permits a versioned replacement format and retiring obsolete program semantics.
Reject unsupported legacy imports with an actionable message, retain their source
bytes, and never erase local data on an unsupported version. Update the governing
contract and tests in the same implementation change; do not silently repoint IDs.
Keep sharing consent, first-run eligibility, the 3,072-character encoded limit,
no truncation, and install-transfer clone fidelity. This planning PR changes none
of the currently running application's compatibility or storage behavior.

## Catalog, model, and interfaces

Use the exact raw catalog as the authority: 1,345 exercises, 5,301 UUID objects,
22 types, 3,057 role-tier assignments, six recommendation roles, 11 metric types.
Keep every source field and reference. Build a compact offline search index and
load details locally. Add reviewed Portuguese display/search aliases without
changing canonical identity. Names and aliases are search inputs, never joins.
Resolve canonical names before aliases; ambiguous names require disambiguation.

Equipment availability is evaluated against concrete gym equipment IDs. Expand
plural-to-singular links transitively. Each resistance/support alternatives list
uses OR; a referenced group requires all of its members. Both resistance and
support conditions must pass. A preferred/allowed exercise cannot bypass missing
equipment. Null role tiers are ineligible for that automatic role but remain
available to Build. The three metricless entries require manual metric definition.
ROM/stability identities are retained without invented numerical ranking weights.
Map licensed existing illustrations only when the exact movement matches; other
entries use the established empty media tile. Include no competitor media.

Create domain modules with these pure entry points; `app.js` handles routing and
presentation rather than owning generation or progression:

```text
generateProgram(request, catalog, seed) -> Result<ProgramDefinition, conflicts>
findSubstitutions(program, slotId, context, catalog) -> Candidate[]
recommendSets(prescriptions, history, currentSession, loadingContext, settings)
  -> SetRecommendation[]
```

`Result` carries either a complete program plus explanations or explicit conflicts,
never a partially activated program. Candidates carry eligible equipment contexts,
role tier and reasons. Recommendations carry values, history anchors, formula
version, loading assumptions and reasons, or a manual/configuration-required status.
Functions do not write storage, read the clock, or use global randomness.

The authoritative model separates GymProfile, ProgramDefinition, SetPrescription,
SetRecommendation and PerformedSet. Stable slot identities survive substitution;
exercise identities do not. A program records ordered training/rest days, cycles,
per-cycle prescriptions, provenance, seed, request, and generator version.
Prescriptions store each set's metric targets and RIR independently. Performed sets
store actual values, completion, edits and loading context separately. History
comparison requires the same exercise and compatible equipment/load convention.
Metric storage uses kg, metres and seconds; display conversion must round-trip.
Represent assistance, per-side loads, persistent per-side loads, unilateral reps,
duration, distance and zero external load explicitly. Never force every metric
combination into a positive kg/reps pair.

## Generation policy

Inputs: hypertrophy, strength or hybrid; beginner/intermediate/advanced; 2–6
training days; duration buckets up to 20, 20–40, 40–60, 60–90, 90–120 and over
120 minutes; gym; seven competency answers; at most five emphasis points and
five deprioritized muscle groups; split; periodization; cycles and deload choice.
Default seven cycles, static periodization, no deload and no emphasis/exclusions.
Default competency answers are unconfirmed. Review generation before activation.

Auto splits: two/three days full body, four upper/lower/upper/lower, five
push/pull/legs/upper/lower, six push/pull/legs repeated. Schedule training days
in authored order; the four-day schedule follows the observed fixture. Explicit
split choices must be compatible with day count; expose authored split names,
not the retired families. Unknown prerequisite IDs require a movement-specific
confirmation; only reviewed mappings allow one of the seven answers to satisfy
an ID. Excluded exercises/muscles, equipment and prerequisites are hard filters.

Use the P1–P3 standard and P4 compact day/slot prescriptions directly as four-day
hypertrophy anchors. Slots record pattern, muscle purpose, exercise type and
recommendation role. Single-joint accessory slots cannot silently become compound
slots because the tier is better. Select lowest eligible role tier, then explicit
preference, then deterministic seeded order over canonical IDs. Hybrid uses strength
tiers for main work and hypertrophy tiers for assistance. Avoid repeated exercise
IDs and shared exclusion groupings within the generated cycle; substitutions
exclude the displaced slot from that collision check. Repeating a selected program
across cycles is deliberate and allowed. Report no-candidate conflicts; never
change frequency or ignore a hard constraint to fill an empty slot.

The authored standard jobs, in fixture order, are:

| Day | Jobs | Recommendation roles |
|---|---|---|
| Upper A | Horizontal push, horizontal pull, lateral delts, triceps, rear delts, lat isolation | First two primary compound; remaining accessory |
| Lower A | Squat, secondary hip extension, calves, quadriceps isolation, hip abduction | First primary compound, second secondary compound, remaining accessory |
| Upper B | High-incline/overhead push, vertical pull, additional horizontal push, additional horizontal pull, biceps, chest isolation | First two primary compound, next two secondary compound, remaining accessory |
| Lower B | Hip hinge, secondary squat, knee flexion, abs, obliques | First primary compound, second secondary compound, remaining accessory |

Compact jobs come from P4 in the same order: Upper A keeps the first four;
Lower A keeps squat/calves/quadriceps; Upper B keeps its first two plus
biceps/chest/rear delts; Lower B keeps hinge/knee flexion/abs. Each job stores
these purposes with the fixture's exact dose. Derive eligible muscle and pattern
IDs by canonical ontology names and check the generated policy against P1–P4;
ambiguous identities require explicit authored ID sets. High-incline and overhead
pressing are both permitted in the first Upper B push job. Secondary hip extension
permits the source hip-thrust and good-morning variants observed in P1/P2.

For unobserved splits, redistribute the standard weekly job list across compatible
training days in original order, assigning each job to the eligible day with the
fewest assigned sets, ties by day order. Full-body days accept all jobs; upper/lower
restrict region; push accepts chest/shoulder/triceps, pull accepts back/biceps,
legs accepts lower body, and trunk assistance follows the least-loaded day.
Primary coverage is protected. The compact job list applies at ceilings ≤40 minutes;
longer buckets start with standard volume rather than automatically adding sets.
Beginners lose one set per job, minimum one, and gain one RIR; intermediate and
advanced keep the anchor dose. These rules are approximations, not recovered tables.

Emphasis moves optional assistance sets from deprioritized, then lowest-priority
jobs to eligible emphasized jobs, one set per point, maximum three working sets
per assistance job. Keep main pattern coverage. Add an appropriate assistance job
only when no existing job serves the muscle and time permits. Report points that
cannot be applied; do not claim every requested priority changed the program.

Fit the whole program, not independent exercise clipping: optional jobs may move
between compatible days before removal. Estimate three minutes preparation per
session, one minute setup per exercise, four seconds per rep, two sides for sequential
unilateral work, and between-set rest of 120 seconds compound/90 accessory.
Use range midpoint reps. Ceilings are 20/40/60/90/120 minutes; over-120 defaults to
an editable 150-minute ceiling. Move an optional job to a compatible day with spare
time, then remove emphasis bonuses, trim assistance to two then one set, then omit
optional jobs in reverse authored order. Never shorten rest to claim fit. If protected
work still exceeds the ceiling, return an explicit time conflict. P4 is its own
observed compact template: its first bench job gains a set and rear delts move days.

Hypertrophy ranges: first push/lower compound 7–9, first pull 9–11, additional
push/lower 9–11, additional pull 11–13, assistance 14–16. Strength approximations:
first push/lower 3–5, first pull and additional push/lower 5–7, additional pull
7–9, assistance 8–12. Hybrid uses strength main work and hypertrophy assistance.
For N sets, set i starting at one has RIR `max(0, N-i+finalRir-extraFailureSet)`.
Push/lower compounds use finalRir 1 and extraFailureSet 0; pulls use 0/0;
assistance uses 0/1. Apply the beginner adjustment last.

Static cycles keep ranges. Linear varies a rep offset from +2 to -2 over the block,
reverse linear reverses it, and undulating alternates +2/-2. For a one-cycle block,
offset is zero; otherwise round linear offsets to nearest integer, halves away
from zero. Clip generated bounds to 3–30 while retaining order. Deload cycles halve
sets with upward rounding and add two RIR capped at four. Deload is explicitly
scheduled by the user, never inserted silently. Editor overrides are independent
per cycle/set. Cycle advancement uses completed or explicitly skipped sessions,
not elapsed calendar time. Substitute with the same slot constraints and preserve
dose unless the new metric convention requires reviewed manual targets.

## Adaptive prescription policy

Use RIR-adjusted Epley capacity for supported weighted-rep conventions:
`capacity = effectiveLoad × (1 + (fullReps + RIR)/30)`.
Use median first-set capacity from the latest three comparable sessions as the
next-session baseline; use the latest completed comparable set within the live
session for the next set. No history means no invented initial load. Missing RIR,
load convention, bodyweight required by a nonzero coefficient, or available-load
configuration gives a manual/configuration-required result. Unsupported combinations
still log all values and retain manual prescriptions.

Effective load adds the catalog's fractional bodyweight contribution when enabled;
assistance subtracts assistance from that contribution. Reject nonpositive effective
load for capacity estimation. Per-side conventions normalize only through explicit
loading context; never double blindly. A gym's discrete weights/plate combinations
own candidate loads, including bar weight. Never guess a universal 5 kg increment.

Expected fatigue is the median proportional capacity drop between corresponding
adjacent sets in up to three comparable sessions, clamped to 0–15%, default zero.
For an in-session recommendation apply one adjacent-set drop to the latest completed
capacity. For future set j apply the sequential factors from the first-set baseline.
Enumerate available external/display loads and integer reps inside the target range.
Transform each candidate into `candidateEffectiveLoad` using exactly the same
bodyweight, assistance and per-side convention as the comparable history anchor.
Reject candidates with nonpositive effective load. Predicted RIR is
`30 × (capacity/candidateEffectiveLoad - 1) - reps`; prefer candidates in
[targetRIR,targetRIR+1].
Rank by distance from range midpoint, distance from target RIR, absolute change from
anchor external/display load, then ascending external/display load and reps. Weight Match promotes the previous load only
among admissible candidates. If no candidate fits and expansion is enabled, extend
by one rep at each boundary per pass up to four reps, keeping the 3–30 bounds. If
still none fits, retain manual targets and explain the equipment/range conflict.

Screenshot checkpoint: completed 110 kg × 6 at 2 RIR, target 7–9; next displayed
105 kg for 7–9 at 1 RIR, prefilled eight reps and unperformed. An external-load-only
illustration with a 5 kg grid and zero fatigue yields capacity 139.333 and 105 × 8.
Those assumptions are not known for the screenshot; this is not an exact recovery test.

Recompute only unfinished, untouched fields. A manual edit protects its own field;
completion freezes performed values. Corrections/reopening invalidate dependent
recommendations and recompute eligible later fields through real draft commands.
Preserve canonical draft identity/revision, cross-tab locking, checkpoints, journals,
and recovery bytes while replacing the prescription schema and its consumers.

## Implementation sequence and acceptance contract

| Slice | Real path and observable result | Required evidence, currently planned |
|---|---|---|
| 1. Catalog and complete metric logging | Build a manual program from the catalog, log weighted, zero-load, assistance, unilateral, duration and distance sets; save, reload, history and backup retain their meanings | Production browser journey through real loader/storage; deliberate invalid metric/context and corrupted import rejected without losing source |
| 2. Generation | Generate/preview/edit/activate with deterministic seed and full eligibility; cancel leaves no program; regenerate changes seed and reload preserves an activated program | Pure combinatorial proofs before implementation plus browser entry journey; P1–P4 structures/doses, impossible equipment and time requests |
| 3. Adaptive execution | Real completion/edit/reopen commands update only eligible unfinished values; recommendation explanation names anchors and assumptions | Algorithm proofs before implementation; production draft journey, coarse loads, missing RIR/bodyweight, per-side conventions and conflicting edits |
| 4. Integration and release | Editor, transitions, history, Stats, file/free-form import, backup, setup sharing, install transfer and offline behavior consume the same model | Actual round-trips, cross-tab recovery faults, consent/size refusal, offline installed app, EN/PT, keyboard/screen-reader, updated screen catalog and final-head CI |

Remove the legacy strategy registry, family/Browse routes, obsolete compiler tables,
name-inferred selection logic and tests tied only to their private implementation
as callers migrate. Retain regression contracts for plausible surviving product bugs.
Reconcile canonical docs, ADRs, generated catalogs, fixtures and cache inventories.
Use authored source inputs for generated files; keep runtime dependencies unchanged.
The release is one coherent replacement, not a user-facing sequence of mixed engines.
Internal commits may land only as coherent verified slices; do not expose unfinished
replacement choices. Final launch/device gates remain with Plan 059.

## Acceptance contract

- **Plan and governing requirement:** Plan 067 and the Taurifer repository contract
  in `AGENTS.md`; this replacement supersedes the legacy family/compiler and
  selectable progression semantics in one release.
- **Base SHA:** `11cb3a9d` (Plan 067 corpus authority); current implementation
  head is recorded by the verification runner when each browser proof executes.
- **Contract owner and authoritative representation:** the checked-in raw catalog
  snapshot is authoritative for exercise identity and metrics; `ProgramDefinition`
  is authoritative for scheduled prescriptions; DraftV2 and saved log rows are
  authoritative for performed values. Flat editor rows are a display projection.
- **Consumers and generated examples:** the catalog loader, Build and Generate,
  workout draft, save path, history/Stats, backup, setup sharing, install transfer,
  and offline shell. The exact browser assertion must compare the same metric IDs,
  canonical values, prescription tree, and actual rows before and after reload or
  round-trip.
- **First complete slice:** manually choose real catalog movements, build a program,
  record a weighted set including zero external load, an assistance set, unilateral
  per-side work, duration, and distance, save, reload, inspect History, then export
  and re-import a backup. A deliberately invalid metric composition and malformed
  backup must be refused while preserving the original bytes and local state.

| ID | Required observable result | Real producer/consumer | Command and assertion location | Deliberate failing case | Evidence or pending reason |
|---|---|---|---|---|---|
| P067-S1-CATALOG | The complete raw catalog loads offline and Build resolves selected UUIDs to the same canonical records and licensed media mappings. | `RepForgeExerciseCatalog.load()` → Build → ProgramDefinition. | Pending registered production browser journey in `test/catalog-metric-program-browser.mjs`; assert selected raw IDs and resolved record fields. | Unknown UUID and malformed catalog entry cannot become a program slot. | Planned; first implementation slice. |
| P067-S1-METRICS | Prescription and performed values remain separate, preserve source metric UUIDs, and use kg/metres/seconds including zero load, assistance, per-side, duration, and distance. | ProgramDefinition → DraftV2 commands → saved `log` rows. | Same browser journey; assert live draft, committed log, and rendered History values. | Unsupported composition, non-finite value, or incompatible context blocks save without dropping draft bytes. | Planned; first implementation slice. |
| P067-S1-RELOAD | The canonical program, per-cycle prescriptions, and performed metric values survive normal reload and ordinary backup export/import. | durable state normalizer/loader → backup codec → production import path. | Same browser journey; compare parsed values before save, after reload, and after import. | Malformed/unsupported backup is rejected; original file bytes and current local state remain intact. | Planned; first implementation slice. |
| P067-SHARE-VERSION | New shared payloads carry the replacement schema under a new semantic version; unsupported old semantics are actionable and preserve source bytes. | setup encode/decode and first-run/Share surfaces. | Pending versioned-sharing browser proof; assert 3,072-character refusal without truncation and consent gate before writes. | Legacy payload, malformed version, or over-limit payload is refused without mutating state or deleting source. | Planned; integration slice. |
| P067-DRAFT-COMMANDS | Completion, edit, reopen, and substitution preserve slot identity and recompute only eligible untouched future values. | UI actions → real DraftV2 commands → progression recommendations. | Pending production draft journey plus engine-owned algorithm proofs. | Conflicting tab edit or invalid context leaves the acknowledged draft and recovery bytes available. | Planned; slices 2–3. |
| P067-FULL-INTEGRATION | Editor, transitions, import, backup, share, transfer, offline, accessibility, and EN/PT consume the same model. | Current app surfaces and actual data round-trips. | Exact owning registered suites and updated UI screen catalog. | Unsupported import/transfer clone shape, stale worker schema, or inaccessible interaction is detected. | Planned; integration/release slice. |

### Gate boundaries

- **Required for this PR:** one coherent current-schema release; raw catalog
  loader and index; manual Build → complete metric log → save/reload/history/backup
  proof; migrated UI consumers; versioned sharing and explicit legacy refusal;
  focused owning proofs and final-head CI.
- **Required later, with owning plan:** device launch checks remain under Plan 059;
  further managed distribution and commercialization remain behind the strategy
  evidence gates.
- **Owner decisions held:** none for this replacement. The documented defaults
  remain approximations where source formulas were not recovered.

### Review findings

| ID | Requirement or concrete failure | Reproduction | Blocking reason | Status and closing evidence |
|---|---|---|---|---|
| P067-R1 | Legacy setup/backup semantics can silently coerce old flat prescriptions into the new metric model. | Feed a released old-schema payload through the production import path. | Could change a lift's meaning or hide unsupported fields. | Open; close with actionable refusal and retained source bytes. |
| P067-R2 | Existing row projections can diverge from the complete ProgramDefinition. | Edit, save, reload, export/import, and compare slots, prescriptions, and metrics. | A round-trip could lose or invent scheduled or performed data. | Open; close with canonical equality assertions in the production browser proof. |

A bounded AOT investigation may replace approximations only with recovered executable
logic and reproducible cases. Check Dart 3.13.3 tool compatibility, then inspect named
program-creation and smart-progression routines. Stop the research pass after one
working extraction attempt or a documented tool incompatibility; the stated defaults
remain executable. No further owner collection is a prerequisite.

## This PR's acceptance and evidence boundary

This PR's contract owner is the raw APK database and explicitly selected workbook
observations. The extractor produces the committed corpus; the validator consumes it.
Run `python3 plans/067/verify.py --negative-controls`, reproduce into a separate directory,
and compare all bytes. The verifier must reject dangling references, wrong tiers,
missing P4 prescriptions, missing equipment unexpected nested personal fixture fields and uniformly wrong rep ranges.
Hashes alone do not prove semantics; fixed counts, reference types and observed
prescription equality are checked independently. Capture command/source identity using
the existing verification recorder after committing.

Required now: reproducible corpus, privacy allowlists, an accurate specification,
independent review, diff checks and applicable final-head CI. Required later: all
application/browser/algorithm/device proofs above. No application test is marked
passed by this plan. Review findings belong in the PR with stable IDs and closing
evidence. Additional research changes evidence strength, not implementation authorization.
