# Plan 068: Generate inputs — equipment, program length and rep pattern, movement confirmations

- **Plan number:** 068
- **Status:** PLANNED — OWNER DECISIONS PENDING (see [Owner decisions](#owner-decisions)). No production code.
- **Requested:** 10 October 2026, issue [#323](https://github.com/pedrochagasmaster/repforge/issues/323) phases 2–3.
- **Baseline:** `439a2c23` (`main`). Re-check every anchor against `HEAD` before implementing.
- **Outcome:** Generate takes the remaining Plan 067 request inputs the entry flow never asks for: a corrected equipment inventory, program length and rep pattern, and per-movement confirmations. Every input has a no-touch default that reproduces today's request.
- **Sequencing:** Completes Plan 067's input surface, so it sits beside the Plan 067 row in the backlog's **Now** section, before Plan 059 freezes the candidate. That placement is owner decision OD-10. Three independent implementation PRs (C → A → B, OD-9). Each serializes against other entry-flow work on `app.js`, `program-entry.js`, `i18n-*.json` and the cache/script revisions.
- **Out of scope:** the `pullups10` mapping defect ([#340](https://github.com/pedrochagasmaster/repforge/issues/340)), deload scheduling, emphasis/exclusion UI, an abilities answer chip, persistent equipment contexts (backlog Later), and any compiler selection-policy change.

## Governing sources

[`AGENTS.md`](../AGENTS.md) (setup links, generated files, revisions, catalog), [Plan 067](./067-engine-replacement.md) and its [unknowns ledger](./067/unknowns.md) (inputs, defaults, "unknown prerequisite IDs require a movement-specific confirmation"), [ADR 0007](../docs/adr/0007-shared-setup-links.md) (setup links), [ADR 0010](../docs/adr/0010-product-business-thesis-and-validation-sequencing.md) (Free/Pro), [`docs/design/interaction-runtime-audit.md`](../docs/design/interaction-runtime-audit.md) (O2 choice cards, O3 build, disclosure height runs), [`docs/ci.md`](../docs/ci.md), [`test/suites.mjs`](../test/suites.mjs), [`telemetry.js`](../telemetry.js) and [`docs/agents/implementation-evidence.md`](../docs/agents/implementation-evidence.md).

## What the code does today

`programRequestFromAnswers` (`program-entry-adapter.js` ~L179–224) produces the full Plan 067 request, but hardcodes four inputs:

| Request field | Today | Compiler accepts |
|---|---|---|
| `gymProfile.equipmentIds` | Every catalog equipment object whose flag for the environment is 1 (`GYM_FLAGS`: `commercial_gym→commercialGym`, `basic_gym→localGym`, `full_home→garageGym`, `limited_home→homeGym`) | Any set of catalog equipment UUIDs |
| `movementConfirmations` | `{}` | `{exerciseId: [prerequisiteId…]}` for current catalog exercises |
| `periodization` | `"static"` | `static`, `linear`, `reverse_linear`, `undulating` |
| `cycles` / `deloadCycles` | `7` / `[]` | 1–12 / unique cycle numbers |

`competencyAnswers` is already wired; phase 1 (#312) added the Movement abilities step.

The compiler, the program schema (`REQUEST_KEYS`) and the setup-link recipe already carry every field above. A "g" link stores `["g", catalogFingerprint, generatorVersion, compactTree(request), seed]` and the receiver regenerates (`shared-setup.js` `regenerableForm`/`regenerate`). **This plan is an entry and preview change plus one additive compiler report. It changes no selection policy.**

There is also inert scaffolding:

- `answers.environment.equipment`/`capabilities` are validated against a coarse 7-token vocabulary (`KNOWN_EQUIPMENT`) that the adapter never reads.
- `app.js` calls `ProgramEntryAdapter.defaultEnvironment`, which does not exist.
- The `wireEntryDom` pick handler for `environmentEquipment` has no rendered control.
- The `entry.env_correct.*` and `entry.equip.*` copy is unused.
- The manifest's environment scenario mentions a "capability correction disclosure" that is never drawn.
- `preview.limitations`/`reductions` are read but never written.

## Measured effect

All figures come from the real exported `generateProgram` over `assets/exercise-catalog.json` at the baseline, with `goal`/`days`/`seed` matrices as stated. The scripts are reproducible from this plan's PR description.

**Gated movements.** Exactly **140** of 1,345 exercises carry a prerequisite, each exactly one, drawn from 43 prerequisite objects.

- **69** are reachable through the six mapped competency answers. This is phase 1, already shipped: per-answer unlocks are bench ×10 → 28, pull-ups ×5 → 12, OHP ×10 → 11, dips ×10 → 8, push-ups ×15 → 5, incline ×10 → 5, and pull-ups ×10 → **0** (#340).
- **71** are reachable **only** through `movementConfirmations`. Examples: weighted pull-ups and chin-ups, wide-grip pull-up, push-up variants, Nordic curl, single-leg leg curls, muscle-up.
- One gated movement (Barbell thruster) has no role tier and can never be auto-selected.

**What actually gets selected.** Each program has 22 job slots and only the best-ranked eligible candidate per slot is chosen, so eligibility is not selection. Over 480 programs (4 environments × 3 goals × 5 day counts × 8 seeds):

| Input state | Programs whose selection changes | Slots changed |
|---|---|---|
| Abilities all "yes" vs all unsure | 480 / 480 | 1,505 / 10,560 (14 %) |
| Plus every gated movement confirmed | 440 / 480 | 650 more |

Confirmation picks are dominated by Overhand grip weighted pull-up (340 programs), single-leg stability-ball leg curl (90), and weighted chin-ups and neutral-grip weighted pull-ups (50 each).

**Offers per preview.** Confirming everything changes 1–4 slots per program (mean 2.9) when abilities were skipped, and 0–2 (mean 1.0) when all abilities were "yes" (48-program sample). So an inline per-slot offer adds at most a handful of rows to a preview.

**Equipment.** Equipment adjustments unlock **none** of the 140 gated movements: prerequisites, not equipment, gate them. Equipment still changes selection a lot. Slot-change rates per group (16 programs per cell: hypertrophy/strength × 3/4 days × 2 seeds):

| Change | Slots changed |
|---|---|
| limited_home + bench | 36 % |
| limited_home + cable | 52 % |
| limited_home + barbell | 16 % |
| limited_home + leg press | 14 % |
| limited_home − dumbbells | 61 % |
| full_home − bench | 33 % |
| commercial_gym − barbell | 27 % |
| commercial_gym − dumbbells | 25 % |
| commercial_gym − Smith | 11 % |
| basic_gym + Smith | 13 % |

Removing the **pull-up bar** or **bands** from either home environment makes every sampled request fail with a no-candidate conflict. Adding a rack alone, dip bars, landmine, trap bar or dip belt changes ≤2 % in the environments that lack them (with abilities unanswered); adding an EZ bar changes 5–9 %. `full_home` already includes barbell, power rack and adjustable bench, so "a home gym with a rack and barbell" is a choice of environment, not a missing input.

**Program length and rep pattern** have no effect on eligibility or selection: exercise IDs are byte-identical across all four patterns and across 3/7/12 cycles. They change only `prescriptionsByCycle` ranges (for example cycle 1 at 7–9 static, 9–11 linear, 5–7 reverse linear) and its length.

**Determinism.** The same request and seed give a byte-identical definition; a different seed changes tie-breaks only.

## Design

### Step count: zero new screens (OD-1)

Today the Generate route has six question screens (goal, background, schedule, environment, abilities, priorities), then the result screen with answer chips, then the preview/confirm screen with Activate (`ROUTE_STEPS.recommend`: eight steps). The owner noted that MacroFactor's onboarding has many more screens. This plan adds **no** step.

Taurifer's thesis puts workout speed and time to first set first. A screen earns its place only when most lifters must answer it to get a correct program. None of these inputs passes that test:

- **Equipment** only corrects an environment the lifter has already chosen. Most lifters accept the preset, so it belongs inside the Environment step as a closed disclosure, not on its own screen.
- **Program length and rep pattern** don't change which exercises are chosen. They are refinements a lifter makes while looking at the program, so they belong on the result screen as an answer chip. The answer-chip editor already rebuilds from an answer at rest.
- **Movement confirmations** only make sense next to the exercise they would change. A question screen would have to list up to 71 movements in the abstract, so they belong inline in the preview.

Each input's default (disclosure left closed, chip untouched, offer ignored) produces exactly today's request. That meets #323's "each step should have a Skip that keeps today's defaults" without a single Skip button.

Rejected alternative: #323's dedicated Equipment step for home/basic environments. It adds one screen for half of all lifters to answer a question whose preset is usually right, and it cannot express removals in gyms (see OD-2).

### Slice A — equipment adjustments in the Environment step

**Question and placement.** Below the four environment cards, a native `<details>` disclosure appears once a card is selected. It stays closed by default and reuses the existing summary key. It is also reachable from the result screen's existing **env** chip editor, which renders the Environment step.

**Vocabulary.** There are thirteen curated groups (OD-3). Each group maps to catalog equipment **UUIDs** (identity, never names); both members of each plural/singular pair are listed explicitly, because the compiler's `equipmentClosure` follows `pluralOf` only from plural to singular. A group starts ticked when the environment's preset includes **any** of its members. Ticking adds all members; unticking removes all members.

| Token | EN | PT | Catalog members (by name; mapped by UUID) | commercial / basic / full home / limited home |
|---|---|---|---|---|
| `barbell` | Barbell and plates | Barra e anilhas | Barbell, Weight plate(s), Bumper plate(s) | ✓ / ✓ / ✓ / – |
| `rack` | Squat rack | Rack de agachamento | Power rack, Squat stand | ✓ / ✓ / ✓ / – |
| `bench` | Bench | Banco | Adjustable bench, Flat bench | ✓ / ✓ / ✓ / – |
| `dumbbells` | Dumbbells | Halteres | Dumbbells, Dumbbell | ✓ / ✓ / ✓ / ✓ |
| `kettlebells` | Kettlebells | Kettlebells | Kettlebell(s) | ✓ / ✓ / ✓ / ✓ |
| `pullup_bar` | Pull-up bar | Barra fixa | Straight / Multi-grip pull-up bar | ✓ / ✓ / ✓ / ✓ |
| `dip_bars` | Dip bars | Barras paralelas | Dip bars | ✓ / – / – / – |
| `cable` | Cable machine | Polia | Pin-loaded single cable machine, Pin-loaded cable crossover, Cuff cable attachment(s), V-bar row grip attachment | ✓ / ✓ / ✓ / – |
| `smith` | Smith machine | Smith | Smith machine | ✓ / – / – / – |
| `ez_bar` | EZ bar | Barra W | EZ bar | ✓ / – / – / – |
| `leg_press` | Leg press or hack squat | Leg press ou hack | 45° leg press, Pin-loaded leg press, Hack squat | ✓ / ✓ / – / – |
| `bands` | Resistance bands | Elásticos | Long/short resistance band(s), band anchor point | ✓ / ✓ / ✓ / ✓ |
| `suspension` | Suspension trainer or rings | Fita de suspensão ou argolas | Suspension trainer, its anchor point, Gymnastics ring(s) | ✓ / ✓ / ✓ / – |

The ✓ column shows the initial tick state (any member present). Equipment outside these groups keeps following the environment preset.

**Copy.**

| Key | EN | PT |
|---|---|---|
| `entry.env_correct.summary` (existing) | Change what this setup includes | Alterar os equipamentos desta configuração *(shortened: capabilities are retired)* |
| `entry.equipment.lede` | Ticked items come from the place you chose. Tick what you have and untick what you don't. | Os itens marcados vêm do local que você escolheu. Marque o que você tem e desmarque o que não tem. |
| `entry.equipment.group.<token>` | as table | as table |
| `entry.equipment.reset` | Use the usual equipment for this place | Usar o equipamento comum deste local |
| `entry.chip.env_adjusted` | {environment}, adjusted | {environment}, ajustado |
| `entry.result.equipment_conflict` | Without this equipment, nothing in the catalog can train: {jobs}. Tick something that can, or choose another place. | Sem esse equipamento, nenhum exercício do catálogo treina: {jobs}. Marque algo que treine, ou escolha outro local. |

**Answers and request mapping.**

- Store `answers.environment.adjust = {add: [token…], remove: [token…]}`: group tokens, sorted and disjoint, with unknown tokens dropped. `normalizeEnvironment` (`program-entry.js`, which rejects any key other than `kind`, `capabilities` and `equipment` today) gains `adjust` and its validator. Because slice A retires `capabilities`/`equipment`, it tolerates and drops them for legacy drafts instead of rejecting them.
- Changing `environment.kind` clears `adjust`.
- The adapter computes `equipmentIds = (preset ∪ members(add)) − members(remove)`, sorted.
- An absent or empty `adjust` returns exactly today's set. This is proved byte-for-byte.
- The group → UUID table is pure data in `program-entry-adapter.js` (the catalog-integration owner).
- Retire the inert `KNOWN_EQUIPMENT`/`KNOWN_CAPABILITIES` fields, the dead `defaultEnvironment` calls, the dead pick handler and the unused `entry.env_correct.capabilities`/`.note` and `entry.equip.*` copy (OD-12). For an existing setup draft that still holds them, the normalizer drops them.

**Removal conflicts (OD-4).** The compiler already returns explicit no-candidate conflicts. The result step renders them with `entry.result.equipment_conflict` (job names localized) and a button back to the Environment step with the disclosure open. Nothing is activated. Nothing is silently re-added.

### Slice B — program length and rep pattern as a result-screen chip

**Placement.** Add a new answer chip, `block`, to `entryChipList` (recommend and custom), always present. Its editor is a new `ENTRY_CHIP_KIND` entry rendered inside the existing chip editor. Applying it rebuilds at rest (O3 does not replay), and `renderEntryChangeStatement` reports the change.

**Controls.**

- A length stepper from 4 to 12 weeks, default 7, using the existing numeric-card pattern (OD-5). Lifters see cycles as "weeks" (`program.week_chip`), so the copy says weeks.
- A four-option radio group for rep pattern (OD-6), using the O2 choice-card recipe.

**Copy.**

| Key | EN | PT |
|---|---|---|
| `entry.chip.what.block` | program length and rep pattern | duração e padrão de repetições |
| `entry.chip.block` | {n} weeks · {pattern} | {n} semanas · {pattern} |
| `entry.block.length` | Program length | Duração do programa |
| `entry.block.length_value` | {n} weeks | {n} semanas |
| `entry.block.length_hint` | 4 to 12 weeks, then you review how it went. | De 4 a 12 semanas; depois você revisa como foi. |
| `entry.block.pattern` | How reps change across the weeks | Como as repetições mudam ao longo das semanas |
| `entry.block.pattern.static` / `.hint` | Same every week / Each lift keeps its rep range. | Iguais toda semana / Cada exercício mantém sua faixa de repetições. |
| `entry.block.pattern.linear` / `.hint` | More reps first, heavier later / Ranges start 2 reps higher and end 2 lower. | Mais repetições no início, mais carga no fim / As faixas começam 2 repetições acima e terminam 2 abaixo. |
| `entry.block.pattern.reverse_linear` / `.hint` | Heavier first, more reps later / Ranges start 2 reps lower and end 2 higher. | Mais carga no início, mais repetições no fim / As faixas começam 2 repetições abaixo e terminam 2 acima. |
| `entry.block.pattern.undulating` / `.hint` | Alternate each week / Ranges alternate 2 reps higher and 2 lower. | Alternar a cada semana / As faixas alternam 2 repetições acima e 2 abaixo. |

The chip's `{pattern}` uses the short label; for example, the default chip reads "7 weeks · same every week".

**Mapping.** `answers.block = {cycles, periodization}`, added to `normalizeAnswers`' allowlist with its own validator (see slice C's note on that allowlist). The adapter reads `cycles` (integer 4–12, otherwise 7) and `periodization` (one of `PERIODIZATIONS`, otherwise `static`) in place of the literals. `deloadCycles` stays `[]`.

### Slice C — per-movement confirmation in the preview

**Compiler report (additive, outside the definition).** `generateProgram` gains `result.confirmationOffers`. An offer exists for a slot when, among that slot's candidates ranked **above** the selected one, the best candidate fails eligibility **only** through prerequisites that are unanswered: the competency is `null` or unmapped and the ID is unconfirmed. The offer carries `{dayId, slotId, currentExerciseId, offeredExerciseId, prerequisiteIds}`; at most one offer per slot.

No offer is made in these cases:

- the abilities answer is "no" (`competency_answer_no`);
- the candidate also fails equipment, exclusion or collision checks;
- the candidate ranks below the selection.

The offer is diagnostic, the same kind of output as `explanations`. It is new bookkeeping: selection today only tallies rejections by reason, so the implementation must record, per slot, the best-ranked candidate rejected solely for prerequisites, without changing the ranking or the `usedIds`/`usedGroups` state that drives the definition. `value` (the `ProgramDefinition`) is unchanged, so **`GENERATOR_VERSION` stays `067.1`** (see Determinism).

**Offers are verified, not predicted.** Collision avoidance and time fit can stop a confirmed candidate from landing where it was offered. In a 16-program sample, 34 of 38 single confirmations swapped into the offered slot, 4 did not, and 16 also moved another slot. So the production adapter keeps an offer only if regenerating with that one confirmation (same request, same seed) puts the offered exercise in that slot. That costs one generation per candidate offer: about 67 ms each in Node on the devbox, and at most 4 per preview at the measured rates. It runs once per fresh result and is cached on the staged result with its fingerprint, never on a re-render. The verified offer records the slots its confirmation would also change, so the preview can say so before the tap.

**Preview UX.** `renderEntryWeek` draws the week on both the `result` step and the `preview`/confirm step, so the offer appears on both. Under the affected exercise row in `renderEntryWeek`, a quiet line and a secondary button appear:

- EN: "Could be **{exercise}** if you already do it with good form." / button "I can — swap it in"
- PT: "Pode ser **{exercise}** se você já faz com boa técnica." / button "Consigo — trocar"

Tapping writes `answers.movementConfirmations[offeredExerciseId] = prerequisiteIds` and regenerates with the same seed. The result renders at rest and `renderEntryChangeStatement` names every row that changed, because collision avoidance can move a neighbouring slot.

A confirmed row shows "Swapped in because you confirmed it." / "Trocado porque você confirmou." and an **Undo** / **Desfazer** button that deletes that confirmation and regenerates. Focus moves to the new row's Undo (or, after Undo, to the restored row's offer button). A polite status line announces the change.

There is no new motion: the swap is a re-render at rest and buttons use the existing press feedback (audit O2/O3).

The `confirmationOffers` key is added to the closed `PREVIEW_KEYS` and result normalizer in `program-entry.js` so persisted setup drafts validate.

**Mapping.** `normalizeAnswers` takes no route and uses one allowlist for every route, so `movementConfirmations` (like slice B's `block`) is added to that allowlist as a valid answers key on every route. Only the recommend and custom flows produce it and only `programRequestFromAnswers` consumes it; the Browse/Build/Import/Shared paths never read it. It is not added to `SHARED_GENERATOR_KEYS`, so it is not carried into reusable context across routes. Do not change `normalizeAnswers`' signature for this. Normalization keeps only current catalog exercises whose listed prerequisite IDs are a subset of the exercise's own, and drops an entry whose prerequisite the lifter has answered "no". The adapter passes it through in place of `{}`.

### Determinism, versions and setup links

- **No `GENERATOR_VERSION` bump in this plan.** Slices A and B only change request values. Slice C adds a field outside `value`. For any request, `value` must stay byte-identical to the baseline. This is the definition-hash corpus proof below.
- **Existing "g" links keep working.** They carry their own request (with the old preset `equipmentIds`, `periodization: "static"`, `cycles: 7`, `movementConfirmations: {}`). The receiver regenerates them under the unchanged version and verifies the identical definition.
- **New links carry the new values automatically.** `compactTree` encodes UUIDs as catalog indices. A confirmation adds two indices; equipment IDs were already present. Prove the representative ≤700-character target and the hard 3,072 limit with confirmations and adjustments present.
- **Rules recovery.** The setup-draft `answerFingerprint` hashes all answers, so the new answers invalidate a staged result with no extra wiring. `VERSION_KEYS` is unchanged because no policy version moves.
- **#340 is deliberately separate.** Mapping `pullups10` changes selection for an existing request, so it needs a `GENERATOR_VERSION` bump. Every existing "g" link would then decode as `unsupported-version`; the decoder refuses a mismatched version and cannot regenerate the old engine. That trade-off belongs to #340's own owner decision.

### Catalog states and role inventory

New `tools/ui-screens/screens-onboarding.mjs` scenarios with entries in `docs/ui-screens/manifest.json`, light and dark, EN and PT per the catalog's existing variants:

| State | Slice | Scenario |
|---|---|---|
| `onboarding-recommend/environment-equipment` | A | `limited_home` selected, disclosure open, `bench` ticked by the lifter |
| `onboarding-recommend/result-equipment-conflict` | A | `limited_home` minus pull-up bar and bands, showing the conflict notice |
| `onboarding-recommend/result-block` | B | Result with the `block` chip editor open, 10 weeks, undulating |
| `onboarding-recommend/result-confirm-offer` | C | Commercial gym, abilities skipped, fixed draft ID, at least one offer and one confirmed row with Undo |
| `onboarding-custom/*` equivalents | A–C | Only where the custom route renders differently |

Also update the existing `onboarding-recommend/environment` scenario text; its "capability correction disclosure" becomes the equipment disclosure.

In `tools/ui-role-inventory.json`, add owner `plan-068` and `catalogStates` for: the disclosure summary; the group checkboxes; the reset button; the conflict's back button; the `block` chip and its stepper and pattern radios; the offer button; and the Undo button.

None of these states goes into `tools/check-rules-only.mjs`'s fixed Plan 064 list.

### Telemetry (OD-8)

The closed schema has no property for any of these inputs. `generator_completed` fires at the first result, before any chip edit or confirmation, so it cannot carry them.

Proposal: **one** new event, emitted once per setup flow at activation on the recommend and custom routes, alongside `program_activated`:

```js
generator_inputs_applied: event({
  equipment: values("preset", "added", "removed", "added_removed"),
  weeks: values("4_6", "7", "8_9", "10_12"),
  rep_pattern: values("static", "linear", "reverse_linear", "undulating"),
  confirmations: values("0", "1", "2_3", "4_plus"),
  offers_shown: values("0", "1", "2_3", "4_plus"),
}, "Generate inputs in the activated program", "once_per_setup_flow")
```

It carries categorical buckets only: no exercise or equipment identities, no counts finer than the buckets. Add it to `ALPHA_EVENT_NAMES` and `VALID_ALPHA_EVENTS` in `test/fixtures/telemetry.mjs`, add a producer and a leakage assertion, and add a line to `docs/measurement/` describing it. It answers the product question this plan cannot: do lifters use these inputs, and do offers get accepted (`confirmations` against `offers_shown`)? Without OD-8 approval, the slices ship with no telemetry.

## Acceptance proofs

Proofs come before code: each proof is written first and must fail for the stated reason. The highest realistic boundary is the production browser journey in `test/generate-program-browser.mjs`, which the owning suites in `test/suites.mjs` run through `tools/run-tests.mjs`. Isolated proofs are limited to the combinatorial and serialization contracts named here, each with its justification.

| ID | Slice | Observable result | Owner / boundary | Deliberate failing case |
|---|---|---|---|---|
| P068-A1 | A | `limited_home` + Bench + Barbell: the staged request's `gymProfile.equipmentIds` contains every member UUID, and the preview contains a bench or barbell movement absent from the same seed without them | Browser, `generate-program-browser` | Before slice A the disclosure does not exist; the request equals the preset |
| P068-A2 | A | Disclosure never opened: the request is byte-identical to baseline for every environment; changing environment clears `adjust` | Browser plus the adapter contract in `test/program-entry-contracts.mjs`: set algebra over 4 environments × 13 groups, and a check that each mapped UUID is `type: "equipment"` | Adjustments leaking across an environment change |
| P068-A3 | A | `limited_home` − Pull-up bar − Bands: the result shows the localized conflict naming the vertical-pull job and the back action opens the disclosure; nothing activates; reload restores the same state | Browser | Silent re-add, or a partial program |
| P068-A4 | A | A legacy setup draft holding `environment.equipment`/`capabilities` resumes without error; the dropped fields do not change the request | `test/program-entry.mjs` (durable-draft normalization) | A draft rejected or lost on resume |
| P068-B1 | B | Chip edited to 10 weeks undulating: the activated program has `cycles: 10` and `request.periodization: "undulating"`, cycle-1 targets follow the undulating offset, and Today reads "Week 1 of 10"; the default chip leaves the request identical | Browser | Before slice B there is no chip; literals 7/static |
| P068-B2 | B | Length outside 4–12 or an unknown pattern in a stored draft normalizes to 7/static | `test/program-entry.mjs` | Invalid draft value reaching the compiler |
| P068-C1 | C | Offer contract: for a fixed corpus (4 environments × 3 goals × 2–6 days × 4 seeds × {abilities skipped, mixed, all yes}), every compiler candidate offer ranks above the selection and fails only on unanswered prerequisites; every *verified* offer, applied alone with the same seed, selects that exercise in that slot, and its recorded side effects equal the actual changed slots; there are no offers for "no" answers or equipment-ineligible candidates | Compiler-owned algorithm proof in `test/program-compiler-plan067.mjs` plus the adapter contract in `test/program-entry-contracts.mjs`: combinatorial ranking boundary, justified under the test-authoring policy | Offer for a "no" answer, or a shown offer that does not swap in |
| P068-C4 | C | Verification cost: on the browser preview path, a fresh result runs exactly one generation plus one per candidate offer, and re-renders, chip opens and reloads run none | Browser (count generations through the services hook) | Verification repeating on every render |
| P068-C2 | C | Determinism: the definition hash of `value` over the same corpus equals the baseline hashes recorded before slice C; `generatorVersion` is still `067.1` | Same suite | Any selection drift from the report code |
| P068-C3 | C | Commercial gym, abilities skipped, pinned draft ID: the preview shows an offer; tapping it swaps the row, writes `movementConfirmations`, announces the change and moves focus to Undo; Undo restores the original; reload keeps the confirmed state; activation stores the confirmation in `request` | Browser | Before slice C there are no offers; the request carries `{}` |
| P068-LINK | A–C | A generated program with adjustments, 10 weeks undulating and two confirmations shares as a "g" link under the size limits; the first-run receiver regenerates an identical definition. A baseline-era "g" link fixture still regenerates | `test/shared-setup-flow.mjs` (browser) plus `test/shared-setup-unit.mjs` for the size bound | Link refused, truncated or mismatched |
| P068-TEL | per OD-8 | The event fires once at activation with only allowed buckets, and not at all when opted out; the fixture set matches the schema | `test/telemetry-unit.mjs`, `test/telemetry-runtime.mjs`, `test/telemetry-leakage.mjs` | Unknown property, or a second emission on reload |
| P068-UI | A–C | New catalog states captured in light/dark and EN/PT, plus role-inventory coverage | `tools/capture-ui-screens.mjs --affected`, `check-ui-system` (CI shards) | Missing manifest or role entry |

Each PR is complete when its focused owning suites are green locally, it has had independent review, and the `ci` check is green on the final head (the complete inventory). Local browser runs on the shared devbox go through `flock /tmp/taurifer-browser.lock`.

## Slices and PRs (OD-9)

| PR | Slice | Main files | Why this order |
|---|---|---|---|
| 1 | **C** confirmations | `program-compiler.js` (report only), `program-entry.js` (preview key, answers), `program-entry-adapter.js`, `app.js` (`renderEntryWeek`, handlers), i18n, catalog, role inventory | Addresses the issue's headline: 71 movements are reachable only this way, and it changes selection in 440/480 sampled programs. It is the only slice that touches the compiler, so it lands first while the corpus baseline is fresh |
| 2 | **A** equipment | `program-entry.js` (answers, retire scaffolding), `program-entry-adapter.js` (group table), `app.js` (Environment step), i18n, catalog, role inventory | Largest selection effect for home lifters (16–61 % of slots per group); needs the conflict path |
| 3 | **B** length and rep pattern | `program-entry.js`, `program-entry-adapter.js`, `app.js` (chip), i18n, catalog, role inventory | Smallest: no eligibility effect, pure wiring |
| — | Telemetry | Folded into PR 3, or a fourth PR, if OD-8 is approved | Needs every input to exist |

Each PR follows the revision procedure in `AGENTS.md`: `?v=` bumps for the changed query-versioned scripts in `index.html` and their exact `sw.js` precache URLs (`transitionAssets`), plus a `CACHE` bump, each set relative to `main` when the PR opens and again after the final rebase. The PRs collide on these numbers and on `app.js`/`i18n-*.json`, so merge them one at a time. On completion, the final PR updates `plans/README.md` and the backlog row.

## Risks

1. **Cascading swaps.** In the sample, 16 of 38 single confirmations also moved another slot. Mitigation: the verified offer names those rows before the tap, and the change statement lists them after it; P068-C1 and P068-C3 assert both.
2. **Phone cost of verification.** About 67 ms per generation on the devbox in Node; phones are slower. At most 4 extra generations run once per fresh result (P068-C4). If physical-device timing under Plan 059 shows a visible stall, verify offers lazily on first scroll into view rather than dropping verification.
3. **Self-attested safety.** Confirmations unlock demanding movements (weighted pull-ups, Nordic curls, muscle-ups). The copy asks about current ability with good form and never encourages trying. Undo is always available, and the editor's substitution stays available after activation.
4. **Removal conflicts.** Covered by the conflict path (OD-4). An alternative is to block unticking the last vertical-pull group.
5. **Concurrent entry-flow work.** #316 (generated day names), #319 (review regeneration) and the open onboarding PRs #309/#313 touch the same renderers. Rebase on whichever merges first; do not combine.
6. **Catalog churn.** #315 changes Portuguese names only; group membership is by UUID and P068-A2 fails if a UUID stops being equipment.
7. **Free/Pro boundary.** The backlog's Gated row "Advanced first-program generation" could be read to cover length and rep-pattern choice. Plan 067 lists both as Generate inputs with defaults, so this plan treats them as Free (OD-6).
8. **Measurement gap.** Without OD-8 there is no evidence that lifters use these inputs.

## Owner decisions

| ID | Decision | Recommendation | Alternative |
|---|---|---|---|
| OD-1 | Extra onboarding screens | **None.** Equipment goes inside Environment; length and rep pattern go in a result chip; confirmations go inline in the preview | #323's separate Equipment step for home/basic (+1 screen on those paths) |
| OD-2 | Which environments get equipment adjustment | **All four, with add and remove.** Removal changes 11–27 % of slots in a commercial gym (no Smith, no barbell) | Home/basic only, add-only (#323 text) |
| OD-3 | Equipment vocabulary | **The thirteen groups above.** Landmine, trap bar and dip belt are omitted because they change ≤2 %. Dip bars stay, despite ≤2 % with abilities unanswered, because they carry the bodyweight-dip movements that a "yes" or a confirmation unlocks | Different list, or expose raw catalog items (297, including duplicates and furniture) |
| OD-4 | Unticking equipment that leaves a job with no candidate | **Allow it and show the explicit conflict** with a way back | Prevent unticking the last group for a required job |
| OD-5 | Program length range and default | **4–12 weeks, default 7.** No deload choice in this plan | 1–12 (compiler range); or include a "deload last week" toggle |
| OD-6 | Free or Pro for length and rep pattern | **Free**, as Plan 067 Generate inputs | Hold for the Gated advanced-generation row |
| OD-7 | Offer rule | **At most one offer per slot**, only for a better-ranked candidate blocked solely by unanswered prerequisites, never after a "no", with no total cap (measured 1–4) | Also list confirmable movements that would not be selected; or cap at three per preview |
| OD-8 | Telemetry | **Approve `generator_inputs_applied`** as specified | Ship without telemetry |
| OD-9 | PR order | **C → A → B**, three PRs | A → B → C, or one combined PR |
| OD-10 | Backlog placement | **Now**, as Plan 067's input completion before Plan 059 | Next |
| OD-11 | `pullups10` (#340) | Keep separate. Recommend mapping it to *Weighted vertical pulls* with a `GENERATOR_VERSION` bump, after accepting that existing "g" links become unsupported | Remove the question |
| OD-12 | Inert coarse equipment/capability scaffolding | **Retire it in PR 2** | Leave it |

## References

- Issue #323 and its comments; phase 1 in PR #312 (`078f4678`, `a9db4920`).
- `program-compiler.js`: `GENERATOR_VERSION`, `PERIODIZATIONS`, `PRECONDITION_COMPETENCIES`, `prerequisitesSatisfied`, `candidateFailure`, `cycleRepOffset`, `REQUEST_KEYS`.
- `program-entry-adapter.js`: `GYM_FLAGS`, `programRequestFromAnswers`.
- `program-entry.js`: `ROUTE_STEPS`, `normalizeAnswers`, `normalizeEnvironment`, `validationIssues`, `PREVIEW_KEYS`, `answerFingerprint`.
- `app.js`: `renderEnvironmentStep`, `renderAbilitiesStep`, `renderResultStep`, `renderEntryWeek`, `entryChipList`, `ENTRY_CHIP_KIND`, `ensureGeneratorResult`.
- `shared-setup.js`: `regenerableForm`, `regenerate`, `compactTree`.
- `telemetry.js` `EVENTS`; `test/fixtures/telemetry.mjs`.
