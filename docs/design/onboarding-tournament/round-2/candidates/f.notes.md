# F · A primeira pergunta — notes

Files: `round-2/candidates/f.js`, `f.css`, this file. Not committed.

## Thesis

Choosing a route should cost nothing extra. The chooser opens on Recommend's
first question, so answering it *is* choosing Recommend. Every screen after
that keeps the program in view: the answers are chips on the review, each
corrected in a bottom sheet and followed by a before/after count.

## Axis

Route-choice cost inside the chooser (O-4, no product decision), combined with
a program-centred review: hybrid grouping (O-1), chips (O-3), a before/after
count (O-5), a third import door (O-11), the proof above the landing actions
(O-8), a quiet decline on the shared gate (O-7) and resume on both landing and
chooser (O-10).

**F depends on no product decision** (`policy.productDecisions = []`). Minutes
and rest are asked and required. No program is shown before the answers.

## Allocation followed (brief, column F) and how each item was resolved

| Item | Resolution in F |
| --- | --- |
| Route choice | Up-front five-job chooser (P054 AD kept). Its featured Recommend block, with an accent outline, *is* the question "O que você quer deste programa?": three goal rows. One tap starts Recommend and records `desiredResult`. Custom and Browse are flat drill-in rows with a factual line (section count / "1 tela de filtros, depois uma lista"). Build, Paste and File sit in the "Usar meu próprio programa" disclosure. Helper "Não sabe qual escolher?": one question with five statements. Picking one shows "Comece por: {route}." with a factual why and a "Começar por aqui" button, so it can end at any of the five jobs (K-19 passes for all five). |
| O-1 | Hybrid. Recommend = 4 sections: (1) goal + experience + consistency, (2) days + minutes + rest, (3) environment + correction disclosure, (4) priorities/avoid (optional). Custom = 6 sections (the same first three, then muscles, exercises, structure). The counter denominator is fixed per route. When the goal came from the chooser, section 1 shows it as a carried answer with "Alterar" instead of repeating the three cards. `entry().step` is `desired_result` until the goal is set, then `background`. |
| O-2 | Before the result. Labelled optional once in the lede; "Sem prioridade especial" is a selected chip by default. There are up to 2 muscles, up to 2 movement patterns, and the shared proactive avoid search with a required reason and the production pain note. The primary reads "Ver meu programa". |
| O-3 | Chips. Under the name and facts line there is a compact wrap of short answer chips ("Ganho de massa", "3 dias", "Até 60 min", "Descanso de 2 min", "Academia comercial", "Sem prioridade", "Evita …"). Each chip's accessible name gives the question and the value ("Alterar dias por semana: 3 dias"). The chips are short enough that the first day still starts in the first viewport at 390×844 (K-22 clean). |
| O-5 | Before/after count. A block under the facts line: the identity sentence (`x.change.*`, `data-change-statement/changed/total`), then "Antes: 18 exercícios / 49 séries → Agora: 15 / 42". On a first result with avoided exercises it compares "Sem evitar" and "Evitando", so it truthfully says "Nenhum exercício mudou." It appears after every sheet apply, every Restore/Remove of a constraint, and after Edit before using. The accent is only its left rule. |
| O-6 | Chooser only. The review offers no route switches. Back returns to the last section with answers intact. |
| O-7 | The gate shows the received program's name, day caption, each day with its exercise count (read from the payload, nothing stored), what arrives, "Nada é salvo até você começar", one accent Start (`#firstRunSharedStart`) and a quiet "Agora não". "Agora não" drops the in-memory payload and shows the generic landing. Nothing is written. |
| O-8 | Headline, lede (program, logged set and next target in one sentence), then the vendored Today capture cropped to its top, then the two actions. Both actions are inside the first viewport at 390×844 (K-23 passes). |
| O-9 | A bottom sheet per section (goal, background, schedule, environment, priorities; Custom adds muscles, exercises and structure). It has a fixed head with "Fechar", a scrolling body and a fixed footer holding "Atualizar programa", so the confirm is always visible (K-14 passes at 320/200%). Focus goes to the sheet title and returns to the opening chip. The environment sheet opens with the correction disclosure expanded, so the correction takes 6 taps, which is the bound. |
| O-10 | Both. After "Guardar rascunho e sair" on first run, the landing shows a resume card (route · section · date) above the proof. The chooser shows the same card, or the shared rules-changed notice. "Começar de novo" asks first ("Descartar a configuração guardada?"). |
| O-11 | Third door. The import route opens on three stacked doors: Colar de qualquer lugar, Importar um arquivo, Escrever do zero. The current door is marked with a check and hidden "(aberta)" text. The third door explicitly starts Build ("Abre Montar um programa, com dias vazios"). "Ver todas as formas de começar" reaches the chooser. |
| Minutes and rest | Asked and required; nothing preselected (K-18 passes with all 7 probes). |

Other composition choices: Browse asks days, minutes and environment on one
filter screen ("1 tela de filtros"). The catalogue is a flat list with facts
first, and the other schedules sit under a disclosure with the mismatch
stated. The pinned region holds the primary only, at every size. Its disabled
reason sits beside it at normal text and moves into the flow at 200% text or
at 320 px. While a modal is open over the review, the pinned action is hidden,
because the dialog repeats it.

## Deviations from the spec

- **Browse context on one screen.** The spec says "two-question context". F
  asks both questions (schedule and environment) on one screen. The entry step
  reported is `schedule` until days and minutes are set, then `environment`.
- **Headline sizes at 200% text** drop to the section-title role (and to the
  subtitle role at ≤340 px), and the pinned primary uses control size without
  the arrow glyph. Without this, long Portuguese words ("personalizado",
  "configuração") overflow at 320/200%. Both roles are existing type roles; no
  new sizes.
- **Exercise rows at 200%** stack name above prescription (F CSS on the shared
  `TS.programDays` markup), so names wrap between words instead of mid-word.

## Harness defects found

- `api.t` in the journey api is built from production + `TS.COPY` only, so a
  journey cannot match a candidate's own `f.*` label through `api.t`. F's
  journeys use the candidate's own `t`. No harness change is needed; this
  could be documented in `JOURNEYS.md` §3.
- Shared `TS.programDays` rows (`.ex__name` with `overflow-wrap:anywhere` next
  to a `flex:none` prescription) split exercise names mid-word at 320/200%
  ("Agacha|mento"). K-12 does not catch it because exercise names are
  deliberately exempt. Minimal shared fix: at 200% let `.ex` wrap and give
  `.ex__name` `flex-basis:100%`. F does this in its own CSS; it gives F no
  checking advantage.
- The full-page acceptance screenshots render sticky footers at the first
  viewport's bottom, so they appear mid-page. This is a capture artifact, not
  a candidate defect.

## Final verification

Command: `node docs/design/onboarding-tournament/tools/verify.mjs --round 2 --candidates f --out <scratchpad>/verify-f` (all 8 cells, all journeys), run on 2026-09-29 against http://127.0.0.1:8123/. Pasted from `summary.md`:

| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented |
|---|---|---|---|---|---|---|---|---|
| f | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |

Checkpoint audit: hard failures: none. Warnings: none (no 44 px, clipping, K-20 or K-22 warnings).

All 122 journey runs pass (61 journeys × cells 1 and 6).

### K-24 tap counts (reported, not thresholds)

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 13 | 13 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |
