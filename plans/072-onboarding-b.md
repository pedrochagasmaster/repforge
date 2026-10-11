# Plan 072: The rest of onboarding direction B

- **Plan number:** 072
- **Status:** PLANNED, OWNER DECISIONS PENDING (see [§13](#13-owner-decisions)). No production code.
- **Decision:** [ADR 0020](../docs/adr/0020-onboarding-candidate-b.md) makes candidate B the onboarding reference
  from the entry hub to Activate. Its result screen, the program editor, shipped in PR #351 under
  [Plan 070](./070-onboarding-b-program-editor.md). This plan covers the rest of B.
- **Spec:** candidate B in [`docs/design/onboarding-mf/`](../docs/design/onboarding-mf/README.md)
  (`prototype/app.html?c=b`). Its behaviour, order and copy are the reference. Its code is not: it runs the
  engine in a worker, writes no app state and calls Motion directly.
- **Absorbs:** [Plan 068](https://github.com/pedrochagasmaster/repforge/pull/345) (Generate inputs, PR #345,
  never merged). Its measurements stand and are cited here. Its OD-1 to OD-12 are restated in §13 as B places
  them. PR #345 closes with a reference to this plan.
- **Baseline:** `32ecc21c` (`main`, 11 October 2026). Re-check every anchor against `HEAD` before implementing.
- **Out of scope:** the first-run pages before the hub (`onboarding-start/first-run*`), the Program tab's
  editor, Direction D's main screens, any compiler selection-policy change other than #340's mapping (§6.5),
  and Generate in a Worker itself (#353, a parallel track this plan depends on).

## 1. What is true today

- **Hub.** `renderEntryHub` (`app.js:15247`) puts the three goal cards on the hub itself, so a Recommend
  starts with its goal already answered. A Custom door follows, then a "your own program" disclosure with
  Build, Paste and Import.
- **Recommend asks six screens**, then the result editor (`ROUTE_STEPS.recommend`, `program-entry.js:75`):
  `desired_result`, `background` (lifting experience; the goal carried from the hub), `schedule` (days and
  minutes on one screen), `environment` (five kinds), `abilities` (seven yes/no/not sure), `priorities` (up to
  two muscles, priority movements, avoided exercises) and `result`.
- **Custom** adds `exercise_preferences` (must-have exercises) and `custom_shape` (split choice) and lets the
  lifter de-emphasize and ignore muscles.
- **Asked but ignored.** `priorityMovements` is validated and stored but `programRequestFromAnswers` never
  reads it. `answers.environment.equipment` and `.capabilities` are validated against a coarse vocabulary the
  adapter never reads, and `app.js` calls `ProgramEntryAdapter.defaultEnvironment`, which does not exist
  (Plan 068, "inert scaffolding").
- **Hardcoded request fields** (`program-entry-adapter.js`, `programRequestFromAnswers`):
  `movementConfirmations: {}`, `periodization: "static"`, `cycles: 7`, `deloadCycles: []`, and
  `gymProfile.equipmentIds` from one of four catalog flags (`other` maps to `localGym`). The catalog also
  carries a `warehouseGym` flag that nothing maps.
- **Experience.** `EXPERIENCE` maps `first` and `under_6m` to `beginner`, `6_to_24m` to `intermediate` and
  `over_24m` to `advanced`. The compiler only distinguishes `beginner`: one set fewer per slot and RIR 1
  higher (`program-compiler.js:755`, `:810`). **Intermediate and advanced produce identical programs.**
- **Deload.** With a deload cycle the compiler halves each slot's sets, rounding up, and raises RIR by 2,
  capped at 4 (`program-compiler.js:811-813`). The review editor's set-count edit keeps "one set fewer" in a
  deload cycle (`program-review.js:270-298`). The two rules agree for 1–3 sets, which is every generated slot
  (measured: 135 one-set, 633 two-set and 1,872 three-set slots over 120 programs), and diverge once a lifter
  edits a slot to 4 or more sets (6 sets: compiler 3, editor 5).
- **Execution mode.** A movement that records reps per side and whose catalog laterality is Asymmetrical,
  both, or missing (133 movements) is never generated without `request.executionContexts`
  (`program-compiler.js:402`, `:461`). The review editor's catalog search leaves `executionMode: null` on such
  a pick (`program-review.js:86`).
- **Bodyweight.** Every logged session carries a bodyweight field. The first session's field is prefilled
  from the last logged bodyweight (`app.js:2827`, `lastBodyweight` at `:5413`), which is empty on a new
  device, so a bodyweight movement's first session has no bodyweight load unless the lifter types one.
- **Units.** `settings.unit` (`kg` | `lb`, `app.js:1535`) is the only unit setting. Nothing stores a height unit.
- **Generation runs on the main thread.** After #352's fail-fast fix a conflict returns in 10–150 ms. A
  satisfiable request takes 44–267 ms median on the devbox, depending on the preset (§4.1), and Everything is
  the heaviest: 447 ms worst case. #353 moves it into a Worker.

## 2. Owners

| Behaviour | Owner |
| --- | --- |
| Route steps, answer schema and normalization (Basics, presets, equipment adjustment, block, deload, confirmations), activation readiness, legacy-draft migration | `program-entry.js` |
| Answers → request: preset flags, equipment groups by UUID, block, deload, confirmations, emphasis | `program-entry-adapter.js` |
| Confirmation-offer report (additive, outside the definition); #340's versioned mapping if approved | `program-compiler.js` |
| Execution-mode answer and the deload rule inside the editor; the block-row sheet; inline offers | `program-review.js` (its existing intents) |
| B's question screens, the hub, the building moment, the conflict path, profile commit at activation, the Privacy page lines | `app.js` |
| The lifter's profile record (durable) | `durable-state.js` through `app.js`'s state writer, if OD-4 is approved |
| Funnel events and enums | `telemetry.js`, as Plan 071 defines them |
| Strings | `i18n-en.json`, `i18n-pt.json` → `i18n.js` |
| Styles | `styles.css`, existing tokens only; motion through `motion-layer.js` |

## 3. Every B screen

After the hub, B's Recommend flow is a section map, 14 questions, the building moment and the result: 17
screens to Activate, against 8 today. The owner accepted the count (ADR 0020). Copy is the prototype's
(`prototype/strings.js`) unless a row says "changed". Changed copy is proposed and listed in OD-3.

The header is B's: a back control, the eyebrow "Seção N de 3 · Básico" over a segmented rule, and the leave
control. Each screen has one primary button (**Continuar** / **Continue**) pinned at the bottom.

### 3.1 Hub and section map

| Step id | Screen | PT | EN | Default | Skip | Feeds |
| --- | --- | --- | --- | --- | --- | --- |
| `entry` (kept) | Hub | **Criar um treino.** Escolha como começar seu primeiro treino. Cards: *Recomendar um treino* (Responda algumas perguntas. O Taurifer escolhe exercícios, séries e repetições.) · *Montar um treino* (Você digita cada exercício e define cada meta.) · *Importar um treino* (Um arquivo do Taurifer ou um treino colado de qualquer lugar.) Note: Recebeu um link de configuração? Abra o link e o treino aparece aqui. | **Create a program.** Choose how to start your first program. *Recommend a program* (Answer a few questions. Taurifer chooses the exercises, sets and reps.) · *Build a program* (You type every exercise and set every target.) · *Import a program* (A Taurifer file, or a program pasted from anywhere.) Note: Got a setup link? Open the link and the program appears here. | Nothing chosen | n/a | The route |
| `intro` (new) | Section map | **Vamos montar seu treino.** São três partes curtas. Você pode pular o que não quiser responder. 1 Básico (Sobre você e o seu histórico de treino.) 2 Academia e equipamento (Onde você treina e o que tem lá.) 3 Programa (Objetivo, agenda e o que priorizar.) CTA *Começar pelo básico* | **Let's build your program.** Three short parts. You can skip anything you'd rather not answer. 1 Basics · 2 Gym and equipment · 3 Program. CTA *Start with the basics* | n/a | n/a | Nothing |

The existing hub's active-program notice, resume card and legacy banner stay, restyled. The goal cards and
the Custom door go (OD-9). The help disclosure goes; the link note replaces it.

### 3.2 Basics

The four answers the engine doesn't read (sex, birth date, height, cardio) get a purpose, a privacy note and
a skip in §5. Every Basics screen except lifting experience has **Pular** / **Skip** under the primary button.

| Step id | Screen | PT question and options | EN question and options | Default | Skip | Feeds |
| --- | --- | --- | --- | --- | --- | --- |
| `sex` (new) | Choice cards | Qual é o seu sexo? Feminino · Masculino · Prefiro não informar | What is your sex? Female · Male · Prefer not to say | None selected; Continue disabled until a choice | Pular → unset | Profile only (§5) |
| `birth_date` (new) | Three-column wheel | Qual é a sua data de nascimento? | What is your date of birth? | Wheel rests on a neutral date (prototype 14 May 1993); nothing stored until Continue | Pular → unset | Profile only |
| `height` (new) | Unit toggle (Centímetros / Pés e polegadas) over a wheel | Qual é a sua altura? | What is your height? | 174 cm, unit cm (ft-in when `settings.unit` is lb) | Pular → unset | Profile only |
| `weight` (new) | Unit toggle (Quilos / Libras) over a momentum ruler | Qual é o seu peso? Note: *Usado para calcular a carga dos exercícios com o peso do corpo.* | What is your weight? Note: *Used to work out the load of bodyweight exercises.* | 80.5 kg on the ruler, unit from `settings.unit` | Pular → unset | First-session bodyweight; `settings.unit` (§5) |
| `background` (kept, OD-2) | Choice cards with bars glyphs | Qual é a sua experiência com musculação? Nenhuma (Ainda não treino) · Iniciante · Intermediário · Avançado, with the band lines from OD-2 | What is your experience with lifting? None (Not lifting yet) · Beginner · Intermediate · Advanced | None selected | **Required**, no skip | `structuredExperience` → `experience` |
| `cardio_experience` (new) | Choice cards | Qual é a sua experiência com cárdio? Nenhuma (Não faço cárdio hoje) · Iniciante · Intermediário · Avançado | What is your experience with cardio? None (No cardio right now) · Beginner · Intermediate · Advanced | None selected | Pular → unset | Profile only |

### 3.3 Gym and equipment

| Step id | Screen | PT | EN | Default | Skip | Feeds |
| --- | --- | --- | --- | --- | --- | --- |
| `environment` (kept) | Six choice cards | **Onde você treina?** Escolha um local. Depois você ajusta o equipamento. Tudo (Uma academia com todos os equipamentos) · Academia comercial · Academia de força · Academia de bairro · Garagem · Casa, each with the prototype's line | **Where do you train?** Choose a place. You can adjust the equipment next. Everything · Commercial gym · Strength gym · Local gym · Garage · Home | None selected | **Required** | `environment.kind` → preset (§4.1) |
| `equipment` (new) | Thirteen-row checklist, reset link | **Ajuste seu equipamento.** Os itens marcados vêm de {local}. Marque o que você tem e desmarque o que não tem. Link: *Usar o equipamento comum deste local* | **Adjust your equipment.** Ticked items come from {place}. Tick what you have and untick what you don't. Link: *Use the usual equipment for this place* | The preset's groups ticked | Continue with nothing changed = the preset, byte-identical | `environment.adjust` → `gymProfile.equipmentIds` (§4.2) |

### 3.4 Program

| Step id | Screen | PT | EN | Default | Skip | Feeds |
| --- | --- | --- | --- | --- | --- | --- |
| `desired_result` (kept) | Three choice cards | **Qual é o seu objetivo?** Ganho de massa (Mais volume para hipertrofia) · Força (Exercícios principais mais pesados, com volume complementar) · Os dois (Ganhe massa sem deixar os compostos pesados) | **What is your goal?** Muscle growth · Strength · Both | None selected | **Required** | `goal` |
| `days_per_week` (new; was half of `schedule`) | Five compact cards and a split fact | **Quantos dias por semana você pode treinar?** 2–6 dias. Fact: *Com 4 dias, o treino alterna superior e inferior.* (one per count) | **How many days a week can you train?** Fact: *With 4 days, the program alternates upper and lower.* | None selected | **Required** | `daysPerWeek`; `split` stays the authored one |
| `session_length` (new; other half of `schedule`) | Six compact cards | **Quanto tempo dura uma sessão típica?** Até 20 … Até 150 min. *O Taurifer encaixa o trabalho essencial nesse tempo.* | **How long is a typical session?** Up to 20 … Up to 150 min. *Taurifer fits the essential work into that time.* | 60 preselected | Continue = 60 | `timeCeilingMinutes` |
| `muscle_priorities` (new; replaces `priorities`) | Twelve rows, each a Reduzir · Normal · Priorizar segmented control | **Algum músculo merece mais atenção?** Opcional. Deixe em normal o que não quiser mudar. Limit: *Você pode priorizar ou reduzir até 5 músculos.* | **Should any muscle get more attention?** Optional. Leave anything you don't want to change at normal. | All Normal | Pular → all Normal | `emphasisMuscleIds`, `deprioritizedMuscleIds` (≤5 each) |
| `deload` (new) | One switch card, tagged *Recomendado* | **Quer terminar o bloco com uma semana mais leve?** Deload: *A última semana do bloco tem menos séries, para você recuperar antes do próximo.* | **End the block with a lighter week?** Deload: *The block's last week has fewer sets, so you recover before the next one.* | **On** (OD-6) | No skip; Continue keeps the switch as shown | `deloadCycles` = `[cycles]` when on, `[]` when off |
| `abilities` (kept) | Seven rows of Sim · Não · Não sei | **Você já faz estes exercícios?** Responda o que souber. Não sei é uma resposta válida. | **Do you already do these exercises?** Answer what you know. Not sure is a valid answer. | All Não sei (`null`) | Pular → all `null` | `competencyAnswers` (`pullups10` per OD-11) |

### 3.5 Building, conflict and result

| Step id | Screen | PT | EN | Behaviour |
| --- | --- | --- | --- | --- |
| `building` (new) | Mark, four-line checklist, thin bar | **Montando seu treino.** Escolhendo exercícios para o seu equipamento · Encaixando as séries em {m} minutos · Definindo repetições e RIR de cada série · Marcando a semana de deload (or *Conferindo o bloco* with deload off). Link *Ver o treino agora* | **Building your program.** Choosing exercises for your equipment · Fitting the sets into {m} minutes · Setting reps and RIR for each set · Marking the deload week (or *Checking the block*). Link *Show the program now* | §8 |
| `result` (kept) | The Plan 070 editor | Header *Próximo ciclo do programa*; block row *{w} semanas · {padrão} · deload na semana {w}* with **Alterar** | *Upcoming program cycle*; *{w} weeks · {pattern} · deload in week {w}* with **Change** | §6 |
| `activation_conflict` (kept) | Today's conflict review | unchanged | unchanged | unchanged |
| (state of `result`) | Equipment conflict | **Não foi possível montar o treino.** Sem esse equipamento, nenhum exercício do catálogo treina: {funções}. Marque algo que treine, ou escolha outro local. *Nada foi salvo.* Button *Voltar ao equipamento* | **The program could not be built.** Without this equipment, nothing in the catalog can train: {jobs}. Tick something that can, or choose another place. *Nothing was saved.* Button *Back to equipment* | §4.3 |

**Leave.** The leave control opens B's native dialog: *Sair da configuração do treino?* Suas respostas ficam
salvas neste dispositivo. Você pode continuar depois. *Continuar configurando* · *Sair* (EN: *Leave program
setup?* … *Keep setting up* · *Leave*). It replaces the current cancel confirmation's copy; the setup draft is
kept exactly as today, so a later visit resumes.

## 4. Gym and equipment

### 4.1 Six presets

| B card | `environment.kind` | Catalog flag | Equipment items | Programs built (90-request grid) | Distinct exercises | Median / max ms (devbox, main thread) |
| --- | --- | --- | --- | --- | --- | --- |
| Tudo / Everything | `everything` (new) | every `equipment` object | 297 | 90/90 | 53 | 267 / 447 |
| Academia comercial | `commercial_gym` | `commercialGym` | 89 | 90/90 | 45 | 95 / 178 |
| Academia de força / Strength gym | `warehouse_gym` (new) | `warehouseGym` | 43 | 90/90 | 36 | 62 / 124 |
| Academia de bairro / Local gym | `basic_gym` | `localGym` | 48 | 90/90 | 36 | 63 / 176 |
| Garagem / Garage | `full_home` | `garageGym` | 26 | 90/90 | 35 | 49 / 105 |
| Casa / Home | `limited_home` | `homeGym` | 22 | 90/90 | 32 | 44 / 124 |

Grid: 3 goals × 2–6 days × 40/60/90 min × 2 seeds, intermediate, abilities unanswered, on `32ecc21c`.

- Existing tokens keep their meaning, so a stored draft keeps its request. Everything and Strength gym are
  new tokens. Everything picks only 26 of the 53 exercises Commercial picks, so it is a real choice, not an
  alias. Strength gym overlaps Local in 24 of 36.
- `other` has no card in B. A stored `other` normalizes to `basic_gym`, which maps to the same `localGym`
  flag, so its request is byte-identical.
- Labels: the prototype calls `warehouseGym` "Academia de força / Strength gym" (OD-7).

### 4.2 Customize: add and remove

Plan 068 slice A, placed on its own step as ADR 0020 settles:

- **Thirteen groups** (Plan 068's table, unchanged): barbell, rack, bench, dumbbells, kettlebells, pull-up
  bar, dip bars, cable, Smith, EZ bar, leg press or hack, bands, suspension or rings. Each maps to catalog
  equipment **UUIDs**, listing both members of every plural/singular pair. A group starts ticked when the
  preset holds any of its members. Equipment outside the groups follows the preset.
- **Answer:** `answers.environment.adjust = {add: [token…], remove: [token…]}`, sorted, disjoint, unknown
  tokens dropped. Changing `environment.kind` clears it. The reset link clears it.
- **Request:** `equipmentIds = (preset ∪ members(add)) − members(remove)`, sorted. An absent or empty `adjust`
  returns exactly today's set.
- **Effect** (Plan 068's measurement): 11–61 % of slots change per group. Equipment unlocks none of the 140
  gated movements.
- **Retire the inert scaffolding** (Plan 068 OD-12): `KNOWN_EQUIPMENT`, `KNOWN_CAPABILITIES`, the
  `defaultEnvironment` calls, the dead `environmentEquipment` pick handler and the unused `entry.env_correct.*`
  / `entry.equip.*` strings. A stored draft that still holds `equipment`/`capabilities` resumes; the
  normalizer drops them.

### 4.3 The conflict path

Removing the pull-up bar or bands from Home leaves vertical pull with no candidate. Since #352 the compiler
reports that in 10–150 ms, so the conflict can ship. The building step hands the compiler's
`no_eligible_exercise` conflict to the result step, which shows B's conflict copy with the job names
localized (the editor's existing `entry.review.job.*` vocabulary). **Voltar ao equipamento** returns to the
equipment step with the adjustment intact. Nothing activates and nothing is silently re-added. A conflict
that isn't an equipment conflict (a time ceiling, for example) shows B's generic line and returns to the
step that caused it.

## 5. The Basics: purpose, privacy and skip

The owner keeps all six. The plan's job is to make each one honest: say what it does, keep it local, and let
the lifter skip it.

**Privacy rules for every Basics answer.**

- Held in the setup draft (`repforge_program_setup_draft_v1`) while onboarding runs, like every other answer.
- At activation, written to a local profile record (OD-4). Never into the `ProgramDefinition`, the generator
  request, a setup link (the eight-setting allowlist is unchanged) or a state proposal.
- **Never sent as telemetry, not even bucketed.** Per Plan 071's rule, sex, birth date or age, height, weight
  and cardio experience have no property in the closed schema; lifting experience is the one exception, as an
  existing bucketed engine input. The leakage suite asserts that no Basics value appears in any payload.
- Included in a backup file and in the one-hour install transfer, because both are the lifter's own copy of
  their data. Shown in Settings with a clear action (OD-4).
- The Privacy page gains one line naming these fields and where they live.

**Per answer.**

| Answer | Engine today | Proposed purpose | Note under the question (PT / EN) | Optional |
| --- | --- | --- | --- | --- |
| Sex | Not read. No compiler or progression rule depends on it. | **None today.** Stored so the lifter can see and clear it. No feature reads it until the owner approves one. | Fica só neste dispositivo. Não muda o seu treino. / Stays on this device. It doesn't change your program. | Yes, plus *Prefiro não informar* |
| Birth date | Not read. | **None today.** Same handling as sex. | Same as sex | Yes |
| Height | Not read. | **None today.** The unit toggle is display only. | Same as sex | Yes |
| Weight | Not read by the compiler. The app reads a session's bodyweight for bodyweight movements' load. | **First-session bodyweight.** Prefills the bodyweight field of each session until one is logged, so a pull-up or dip counts the lifter's bodyweight from session one. Its unit toggle sets `settings.unit` (kg or lb), which every load in the app follows. | Fica só neste dispositivo. Usado para calcular a carga dos exercícios com o peso do corpo. / Stays on this device. Used to work out the load of bodyweight exercises. | Yes; skipped leaves the field empty, as today |
| Lifting experience | `experience` | Unchanged. Required, because the engine reads it. | No note | **No** |
| Cardio experience | Not read. The engine has no cardio. | **None today.** Same handling as sex. | Same as sex | Yes |

**Changed copy.** B's note reads *Fica só neste dispositivo e nunca é enviado. Ainda não muda o seu treino.*
Two words are not accurate. "Nunca é enviado" is false for a backup file or an install transfer, which the
lifter starts. "Ainda" promises a use nobody has approved. The proposal above drops both (OD-3). If the owner
later approves a purpose (for example a strength-standards comparison in Progress, which would need sex,
age and bodyweight), the note changes in the same PR as that feature.

## 6. Program inputs on the result

The result screen is Plan 070's editor. This plan adds four things to it.

### 6.1 The block row: length, rep pattern, deload

Plan 070 shows the block row as a fact. **Alterar** opens B's bottom sheet: a length stepper (4–12 weeks,
default 7), the four rep patterns as choice cards with their hints (Plan 068 slice B copy), and the deload
switch. **Aplicar** rebuilds the program with the same seed.

- `answers.block = {cycles, periodization}` and `answers.deload` (boolean), each with its own validator in
  `normalizeAnswers`' allowlist. The adapter reads them in place of the literals: `cycles` 4–12 else 7,
  `periodization` one of `PERIODIZATIONS` else `static`, `deloadCycles` = `[cycles]` when deload is on.
- Length and pattern change no selection (Plan 068: identical exercise IDs across patterns and across 3/7/12
  cycles), only `prescriptionsByCycle`.
- **Rebuild asks first.** With adjustments in the edit log, B's *Refazer o treino?* dialog runs before the
  rebuild, as Plan 070 already does for the answer chips. Confirming discards the log.

### 6.2 Deload

- Deload sits in the last week of the block. The compiler halves each slot's sets (rounded up) and adds 2
  RIR, capped at 4. Generated slots have 1–3 sets, so a generated deload week has one set fewer on 3-set
  slots and the same count on 1- and 2-set slots.
- **One rule.** The editor follows the compiler (`ceil(n/2)`), not "one set fewer", so a lifter who sets 6
  sets sees a 3-set deload week, which is what a regenerated program would also produce. The sheet's note
  becomes *Na semana de deload: cerca de metade das séries e RIR 2 acima.* / *In the deload week: about half
  the sets and RIR 2 higher.* (OD-6).
- No app surface marks a deload week today. Activating with deload on means week 7 arrives with fewer sets
  and no explanation. The deload slice adds one line to Today and Focus during a deload cycle:
  *Semana de deload: menos séries para recuperar.* / *Deload week: fewer sets so you recover.* (OD-6).

### 6.3 Movement confirmations inline

Plan 068 slice C, in B's editor rows:

- The compiler gains an additive `result.confirmationOffers` report (outside `value`): at most one offer per
  slot, only for a better-ranked candidate blocked solely by unanswered prerequisites, never after a "no".
  `GENERATOR_VERSION` doesn't move.
- The adapter verifies each offer by regenerating with that one confirmation and the same seed and keeps it
  only if the offered movement lands in that slot (34 of 38 did in Plan 068's sample). It records the other
  slots the confirmation moves. Verification runs once per fresh result, in the Worker once #353 lands.
- Under the row: *Pode ser **{exercício}** se você já faz com boa técnica.* **Sim, trocar** / *Could be
  **{exercise}** if you already do it with good form.* **Yes, swap it in**. Tapping writes
  `answers.movementConfirmations` and rebuilds with the same seed. The row is marked *Confirmado por você*
  with **Desfazer**, and a polite status names every row that changed.
- A confirmation rebuilds the program, so with adjustments present it asks first, like the block row.
- `movementConfirmations` is an answers key on every route but only Recommend produces it, and it isn't in
  `SHARED_GENERATOR_KEYS`.

### 6.4 Execution mode (Plan 069 D13)

Plan 069 D13 gives Generate the execution-mode question. Measured on `32ecc21c`: setting every one of the 133
ambiguous per-side movements to unilateral changes **one slot in 15 of 120** sampled programs (always *Machine
upper torso rotation* for obliques in a commercial gym); bilateral adds seven other one-off picks. That
doesn't earn a screen.

**Proposal:** Generate asks nothing up front. The exercise sheet asks when it needs to: a slot whose movement
records reps per side and has `executionMode: null` (a catalog pick of an ambiguous movement) shows *Como você
faz este exercício?* **Os dois lados juntos** · **Um lado de cada vez** / *How do you do this exercise?*
**Both sides together** · **One side at a time**, the same values and copy Plan 069 S4 uses in Build. The
answer is an editor intent that sets `slot.executionMode`. Until it is answered, the row reads *Precisa de
ajuste* and the slot stays configuration-required, as Plan 069 S1 defines (OD-8).

### 6.5 #340: "10 strict pull-ups" unlocks nothing

`pullups10` maps to no prerequisite. Mapping it to *Weighted vertical pulls preconditions* (three movements;
the weighted overhand pull-up was picked in 340 of 480 sampled programs once confirmed) changes generator
output for an existing request, so it needs a new `GENERATOR_VERSION`. The setup-link decoder refuses a
mismatched version and can't run the old engine, so every existing "g" link would become unsupported.

**Proposal:** a versioned policy switch. The compiler supports `067.1` and `067.2`; the only difference is
this one mapping, which `067.2` applies. New programs use `067.2`. `shared-setup.js` regenerates a "g" link
with the version it carries and still verifies the identical definition, so old links keep working. The
alternative is a plain bump that breaks old links, or removing the question, which departs from B (OD-11).

## 7. The other routes

| Route | B's change | What stays |
| --- | --- | --- |
| **Build** | First screen restyled: *Montar um treino.* Dê um nome e escolha quantos dias de treino vazios criar. Fields *Nome do treino*, *Dias de treino*; CTA *Abrir editor*. | `build_setup` → `editor`, `program-editor.js`, everything after |
| **Import** | One door on the hub. Its first screen offers *Escolher arquivo* (Um arquivo do Taurifer de outro dispositivo) and *Colar um treino* (Texto de uma planilha, de um app ou de um assistente). | `import_source`, the file review, the free-form hand-off and its six exits (ADR 0014), `preview` |
| **Received setup link** | Gate restyled: *Começar este treino.* {Treino da Ana · 3 dias por semana}. Este link traz um treino e seus ajustes. Nenhum histórico vem junto. Nada muda até você tocar em Usar este treino. CTA *Ver o treino*; secondary *Criar um treino do zero*. After the gate the program opens in B's editor with the source *Treino compartilhado* (OD-10). | The first-run gate rules (ADR 0007): nothing persists until *Usar este treino*, never applied over an onboarded program or any history; the 3,072-character limit; `shared_review` |
| **Custom** | No hub door (OD-9). | `custom` stays a valid route for one release so a saved Custom draft resumes and finishes; then its steps are removed |

## 8. The building moment

B shows about one second of pacing: four checklist lines and a thin bar, skippable with *Ver o treino agora*.
With #353, generation is asynchronous, so the step is defined by two clocks, not one:

- The step starts the request when it mounts and plays the checklist at 260 ms a line.
- It moves to `result` when **both** the checklist has finished (or the lifter tapped skip) **and** the
  request has settled. If the request is still running after the checklist, the bar holds and the
  *Montando…* hairline appears (`motion-hairline`), as in the prototype.
- Each request carries a key (the answers fingerprint plus seed). A result whose key no longer matches (the
  lifter went back and changed an answer) is dropped. Back from `building` cancels nothing durable.
- A conflict settles to the conflict state of `result` (§4.3), never to an empty editor.
- Under reduced motion every line is drawn done, and the step moves on when the request settles.
- Offer verification (§6.3) runs after the main result settles and never delays the move to `result`; offers
  appear when verified.
- Until #353 merges, the same step runs over the synchronous call, so the slice doesn't wait on it; the
  hairline simply never shows.
- `building` is a step in `ROUTE_STEPS`, so the funnel sees drop-off during generation (§10).

## 9. What is removed

- **Question screens:** `schedule` (split into two), `priorities` (replaced by `muscle_priorities`), the
  avoided-exercise section and its pain path, the priority-movements section, the hub goal cards, the Custom
  door, the hub help disclosure and the "your own program" disclosure. Their ids stay in the telemetry enum.
- **Result leftovers kept by Plan 070 §6:** the answer chips, *Por que este treino*, *O que foi ajustado*,
  the constraints list and the alternative split. B's section flow replaces them: the lifter changes an answer
  by going back, and the block row covers length and pattern (Plan 070 §11, question 3).
- **Answers that nothing reads:** `priorityMovements` (validated, stored, never in the request), the coarse
  `environment.equipment`/`capabilities`. A stored draft that holds them resumes and they are dropped.
- **What is lost on purpose:** a route-level way to avoid an exercise or ignore a muscle before generation.
  B's editor removes or swaps any exercise after it. `excludedExerciseIds` and `excludedMuscleIds` stay in the
  request schema for Custom drafts that resume (OD-9).
- **Open Ledger PRs #309 and #313** restyle the screens this plan removes, under a direction ADR 0020
  superseded. Propose closing both with a link here (OD-13).
- **PR #345** closes with a link here once this plan merges.

## 10. Telemetry, aligned with Plan 071

Plan 071 is being written in parallel and defines the funnel scheme. This plan follows it as approved by the
owner on 11 October 2026:

- **Route ids** are `ProgramEntry` `ROUTES`. No route is added; `custom` keeps its id.
- **Step ids** are the `ROUTE_STEPS` names plus `entry` and `activation_conflict`. An id names what the step
  asks: restyling or rewording keeps it, a materially different question gets a new snake_case id, and a
  removed step keeps its id in the enum. This plan's ids follow that rule: kept are `entry`,
  `desired_result`, `background` (if OD-2 keeps the engine's tiers), `environment`, `abilities`, `result` and
  `activation_conflict`. New are `intro`, `sex`, `birth_date`, `height`, `weight`, `cardio_experience`,
  `equipment`, `days_per_week`, `session_length`, `muscle_priorities`, `deload` and `building`. Retired but
  kept in the enum are `schedule`, `priorities`, `exercise_preferences` and `custom_shape`.
- **Requirement:** every B screen moves through `ProgramEntry.advance`/`back` and `entrySetState`. No screen
  keeps its own step state, so `onboarding_step_viewed`, `onboarding_step_completed` and
  `onboarding_step_back` fire for B's screens without extra wiring. Each PR that adds a step adds it to
  `ROUTE_STEPS` and the telemetry `step` enum together; Plan 071's drift test enforces it.
- **Answers:** closed-enum engine answers may ride on the completed event as Plan 071 allows: preset, whether
  equipment was adjusted (`preset` / `added` / `removed` / `added_removed`), deload on or off, block length
  bucket and pattern, confirmations and offers shown in buckets. This supersedes Plan 068's
  `generator_inputs_applied` proposal. **The Basics are never sent** (§5).
- **Editor:** `program_review_edit` with `kind` from `program-review.js` `EDIT_KINDS`, undo and restore, and a
  bucketed edit count at activation, as Plan 071 defines. The execution-mode intent adds one `kind` if
  OD-8 is approved.
- **Generation timing:** start and settle events keyed to one request, so the building moment is measurable
  with or without the Worker.
- **Time to first set** (ADR 0020 consequence): derived in analysis from `entry` viewed to the first
  `set_saved`. No new event.

If Plan 071's final scheme differs, the later of the two PRs to merge reconciles the ids.

## 11. Delivery

### 11.1 Catalog states

Under `onboarding-recommend` unless noted, each with a manifest entry, light/dark and EN/PT per the catalog's
variants, and `tools/ui-role-inventory.json` rows under owner `plan-072`:

| State | Slice | Scenario |
| --- | --- | --- |
| `onboarding-start/hub` (recaptured), `hub-existing` (recaptured) | S2 | B's hub; with an active program |
| `intro` | S2 | Section map |
| `sex`, `birth-date`, `height`, `height-ftin`, `weight`, `weight-lb`, `lifting-experience`, `cardio-experience` | S2 | Each Basics screen at rest; the unit variants with the other unit |
| `environment` (recaptured), `equipment`, `equipment-adjusted` | S2 | Six presets; Home with bench added and bands removed |
| `desired-result` (recaptured), `days-per-week`, `session-length`, `muscle-priorities`, `muscle-priorities-limit`, `deload` | S2 | Program section; priorities at the 5-muscle limit |
| `abilities` (recaptured) | S2 | Restyled |
| `building`, `building-pending` | S3 | Mid-checklist; checklist done with the hairline (forced slow request) |
| `result-equipment-conflict` | S3 | Home minus pull-up bar and bands |
| `result-block-sheet` | S4 | 10 weeks, undulating, deload on |
| `result-confirm-offer`, `result-confirmed` | S4 | Commercial gym, abilities skipped, pinned draft id |
| `review-sheet-execution-mode` | S4 | A catalog pick of an ambiguous per-side movement |
| `onboarding-recovery/cancel-confirm` (recaptured) | S2 | B's leave dialog |
| `onboarding-build/setup`, `onboarding-import/source`, `onboarding-shared/gate`, `onboarding-shared/preview` (recaptured) | S5 | Restyled routes; shared program in the editor |
| `today/deload-week` | S4 | Today in a deload cycle |

**Removed with their scenarios:** `onboarding-start/hub-own-open`, `hub-help`;
`onboarding-recommend/schedule`, `priorities`, `avoidance-pain`, `chip-editor-open`, `result-corrected`,
`result-avoided`; every `onboarding-custom/*` state once Custom's steps go. None of the new states joins the
fixed Plan 064 list in `tools/check-rules-only.mjs`.

### 11.2 Controls and accessibility

- **Wheels and the ruler** are the riskiest controls. Each is a `role="spinbutton"` (or one per wheel column)
  with `aria-valuenow`/`aria-valuetext`, arrow and Page keys, and a tap-to-type fallback, so VoiceOver,
  TalkBack and a keyboard can set every value. Scroll-snap is the pointer path only.
- Choice cards follow audit O2. Segmented controls are radio groups. The deload switch is `role="switch"`.
- Pages push and pop with `navPush` through `motion-layer.js` and register edge-swipe back; sheets use the
  existing sheet path. The interaction-runtime audit gets rows for the wheel, the ruler and the building
  checklist. Reduced motion draws everything at rest.

### 11.3 Slices and PRs

Each slice is one PR, opened as a draft and stopped at owner review. Each proof is written first and must
fail for the stated reason. Browser runs on the devbox use `flock /tmp/taurifer-browser.lock`. Each PR bumps
`?v=`/`CACHE` relative to `main` when it opens and again after its final rebase (`AGENTS.md`). The PRs share
`app.js`, `program-entry.js` and `i18n-*.json`, so they merge one at a time in this order.

| PR | Slice | Outcome | Proofs (fail first) |
| --- | --- | --- | --- |
| 1 | **S1 Inputs and contract**, no new screen | Answer schema for Basics, six presets, `adjust`, `block`, `deload`, `movementConfirmations`, 12 muscles at ≤5 each; adapter mapping; the compiler's offer report; retired scaffolding; legacy-draft normalization (`other`, `equipment`, `capabilities`, `priorityMovements`, `preview`) | **P072-S1-ID:** for every legacy answer set, the request is byte-identical to `32ecc21c` (adapter contract in `test/program-entry-contracts.mjs`; corpus of 4 kinds × 3 goals × 5 days × 2 seeds). **P072-S1-SET:** set algebra over 6 presets × 13 groups, every mapped UUID is `type: "equipment"`. **P072-S1-DRAFT:** a stored draft holding each retired field resumes (`test/program-entry.mjs`). **P068-C1/C2** carried over: every verified offer swaps in alone; `value` hashes unchanged (`test/program-compiler-plan067.mjs`). |
| 2 | **S2 B's question screens** | Hub, intro, Basics, gym, equipment, program screens, deload, abilities restyle; new `ROUTE_STEPS`; profile record and Settings row (OD-4); Privacy line; removals in §9; step ids in the telemetry enum | **P072-S2-FLOW:** `test/generate-program-browser.mjs` walks hub → Activate in PT, answering every screen, and the activated request carries each answer; a second pass skips every optional screen and gets the default request. **P072-S2-BASICS:** weight 72.5 kg prefills the first session's bodyweight; lb in the toggle sets `settings.unit`; no Basics value appears in a telemetry payload (`test/telemetry-leakage.mjs`), a setup link or the `ProgramDefinition`. **P072-S2-RESUME:** reload on each screen resumes there. **P072-S2-FUNNEL:** each step emits viewed/completed with its id (Plan 071's suite). Catalog states. |
| 3 | **S3 Building and conflict** | §8 and §4.3; async when #353 has merged, sync otherwise | **P072-S3-BUILD:** a forced slow request shows the hairline and moves on only after it settles; skip during the checklist waits for the request; a stale key is dropped after going back. **P072-S3-CONFLICT:** Home minus bar and bands shows the conflict in under 1 s, *Voltar ao equipamento* keeps the adjustment, nothing activates, reload restores the state. |
| 4 | **S4 Result inputs** | Block-row sheet, deload rule unified, Today/Focus deload line, inline offers, execution-mode question | **P072-S4-BLOCK:** 10 weeks undulating, deload on: the activated program has `cycles: 10`, `deloadCycles: [10]`, undulating offsets, and Today reads week 1 of 10; with edits present the rebuild asks first. **P072-S4-DELOAD:** a slot edited to 6 sets has 3 in the deload cycle (`test/program-review.mjs`), and Today shows the deload line in that cycle. **P068-C3** carried over (offer, swap, Undo, reload). **P072-S4-EXEC:** a catalog pick of an ambiguous per-side movement asks the mode, and the activated slot carries it. |
| 5 | **S5 Other routes and cleanup** | Build, Import, shared gate restyle; shared program in the editor (OD-10); Custom door gone, Custom steps removed after one release; `plans/README.md` and backlog rows | **P072-S5-SHARED:** a received link shows the gate, then the editor with *Treino compartilhado*; nothing persists before *Usar este treino*; the activated definition equals the received one when unedited (`test/shared-setup-flow.mjs`). Import and Build journeys stay green unchanged. |
| 6 | **#340** (per OD-11) | Versioned `pullups10` mapping | **P072-340:** Yes to `pullups10` with every other answer null changes the program under `067.2`; a baseline-era "g" link fixture regenerates its identical definition under `067.1` (`test/shared-setup-unit.mjs`, `test/shared-setup-flow.mjs`). |

S1 has no visible change and can merge first. S2 is the large one. S3 rebases onto #353 if it has merged.
#340 can land at any point after S1.

## 12. Risks

1. **Seventeen screens.** B more than doubles the step count. Mitigation: every optional screen has a skip,
   defaults reproduce today's request, and Plan 071's funnel measures per-step drop-off and time to first set,
   which is the evidence ADR 0020 decision 3 asks for.
2. **The Basics feel intrusive.** Sex, birth date and height are asked before anything about training.
   Mitigation: the honest note, *Prefiro não informar*, a skip on each, and nothing sent.
3. **Profile storage is a durable-schema change** (OD-4). It touches backup, install transfer and
   destination-eligibility checks. Read `docs/agents/implementation-evidence.md` before S2 and prove
   eligibility after normal boot and reload, as `AGENTS.md` requires for new device data.
4. **Everything is the heaviest preset** (447 ms worst case on the devbox, roughly 2–3 s at phone throttling
   on a cold first call). S3 shows the hairline; #353 removes the block.
5. **Wheels and the ruler** fail assistive technology if built as scroll containers only (§11.2).
6. **Deload with no in-app cue** would confuse week 7. S4 adds the line (OD-6).
7. **Concurrent work.** Plan 071 (telemetry enums), #353 (async generation) and the reliability track touch
   `app.js` and the revisions. Rebase serially; never combine.
8. **Old "g" links** break if #340 ships as a plain bump (OD-11).
9. **Free/Pro.** Length, pattern, deload and confirmations are Plan 067 Generate inputs, so Free (Plan 068
   OD-6). None of them is the Gated "advanced first-program generation".

## 13. Owner decisions

Each has a recommendation. Plan 068's decisions are folded in where B now settles them.

1. **OD-1 Plan 068 decisions B settles.** *Recommend:* adopt as written. 068 OD-1 is settled by ADR 0020
   (equipment step, block row, inline offers). Adopt 068 OD-2 (all presets get add and remove), OD-3 (the
   thirteen groups), OD-4 (allow the removal and show the conflict; now fast after #352), OD-5 (4–12 weeks,
   default 7), OD-6 (Free), OD-7 (one verified offer per slot, never after a "no", no cap) and OD-12 (retire
   the inert scaffolding in S1). 068 OD-8, OD-9, OD-10 and OD-11 are replaced by OD-12, §11.3, OD-14 and
   OD-11 below.
2. **OD-2 Experience bands.** B shows MacroFactor's bands (under 1 year, 1–4, 4+); the engine's tiers are
   under 6 months, 6–24 months, over 24 months, and only beginner changes the program. *Recommend:* keep B's
   four labels with the engine's thresholds: *Nenhuma (Ainda não treino)*, *Iniciante (Menos de 6 meses)*,
   *Intermediário (De 6 meses a 2 anos)*, *Avançado (Mais de 2 anos)*. Stored values, drafts, telemetry and
   the step id `background` stay. *Alternative:* MacroFactor's bands, which moves 6–12-month lifters into
   the beginner dose and needs a new step id.
3. **OD-3 Basics note copy.** *Recommend:* *Fica só neste dispositivo. Não muda o seu treino.* (and the weight
   line for weight), dropping "e nunca é enviado" and "Ainda" (§5). *Alternative:* B's copy as written.
4. **OD-4 Where the Basics live after activation.** *Recommend:* a local profile record in durable state,
   shown in Settings → Dados e privacidade with *Apagar*, included in backups and install transfer, never in
   links or telemetry. *Alternative:* keep them only in the setup draft and discard them at activation (only
   weight survives, as the first session's bodyweight).
5. **OD-5 Birth date precision.** *Recommend:* B's full-date wheel, stored as answered, since it is local and
   clearable. *Alternative:* store only the year.
6. **OD-6 Deload.** *Recommend:* default **on**, marked Recommended, in the last week; the editor follows the
   compiler's halving rule with the changed sheet note; S4 adds the Today and Focus deload line.
   *Alternative:* default off, or keep the editor's one-set-fewer rule (the two then disagree from 4 sets up).
7. **OD-7 Preset names.** *Recommend:* B's names, with `warehouseGym` as *Academia de força* / *Strength
   gym* and Everything as *Tudo* / *Everything*; a stored `other` becomes Local gym.
8. **OD-8 Execution mode (Plan 069 D13).** *Recommend:* no Generate screen (one slot in 15 of 120 programs);
   the exercise sheet asks when a per-side movement has no mode, with Plan 069 S4's values and copy.
   *Alternative:* a Generate question screen, or an abilities-style row.
9. **OD-9 Custom route and pre-generation exclusions.** *Recommend:* remove the Custom door; a saved Custom
   draft still resumes for one release; avoided exercises, ignored muscles, must-have exercises and the
   split choice go, because B's editor removes, swaps and adds after generation and each day count has one
   split. *Alternative:* keep Custom as a fourth hub card outside B.
10. **OD-10 Shared programs in the editor.** *Recommend:* after the gate, a received program opens in B's
    editor with the source *Treino compartilhado*; Restore returns to the received program. *Alternative:*
    keep today's shared preview.
11. **OD-11 #340.** *Recommend:* map `pullups10` to *Weighted vertical pulls preconditions* behind a versioned
    switch (`067.1` and `067.2`) so existing "g" links keep regenerating. *Alternative:* a plain bump that
    makes existing "g" links unsupported, or remove the question.
12. **OD-12 Telemetry.** *Recommend:* follow Plan 071's scheme as §10 describes; the closed-enum answers ride
    on the completed event; drop Plan 068's `generator_inputs_applied`; the Basics are never sent.
13. **OD-13 Close #309 and #313.** *Recommend:* close both with a link to ADR 0020 and this plan.
14. **OD-14 Backlog placement.** *Recommend:* inside the Now row "Construct the post-058 pre-059 alpha
    candidate", as the onboarding part of the unified redesign, before Plan 059 freezes the candidate.
15. **OD-15 PR order.** *Recommend:* S1 → S2 → S3 → S4 → S5, six PRs with #340 independent after S1, each
    stopping at owner review.

## 14. Completion of this planning PR

This PR adds this file and one row in `plans/README.md`. It verifies through the prose-only CI path. No
application test is claimed. The measurements in §1, §4.1 and §6.4 come from the exported `generateProgram`
over `assets/exercise-catalog.json` at `32ecc21c`; the scripts are in the PR description. The owner's answers
to §13 are recorded in this PR before S1 starts.
