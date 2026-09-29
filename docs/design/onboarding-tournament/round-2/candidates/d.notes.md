# D · Cinco portas, uma revisão (Round 2 control)

Files: `round-2/candidates/d.js`, `d.css`, this note. Nothing else was edited
and nothing was committed.

## Thesis and axis

- **Thesis.** The synthesis spec built as written: five honest doors up
  front, the required answers in B's five grouped sections, and one review
  that is the result, where every answer is corrected in place with a true
  statement of what changed.
- **Axis.** Control. Every open item (spec §9) takes the spec's stated D
  default. D depends on no product decision (`policy.productDecisions = []`):
  minutes and rest are asked and required (no PD-2 / PD-3), Start opens the
  five-job chooser (no PD-1), and no program appears before the lifter
  answers (no PD-4).

## Allocation followed (generator brief, column D)

| Open item | D |
| --- | --- |
| Route choice | Up-front five-job chooser from `#firstRunCreate` |
| O-1 grouping | B's five sections (goal · background · schedule · environment · priorities), counter "Seção n de 5" |
| O-2 priorities/avoid | Before the result, labelled "Opcional" once, visible "Pular esta seção" |
| O-3 facts on the review | "Montado com" list of editable facts after the weekly structure |
| O-5 change statement | Status line under the facts line (`x.change.*`) |
| O-6 routes from the review | Chooser only, plus Back |
| O-7 shared-gate decline | Start only |
| O-8 landing | Default: headline, lede, both actions, then the vendored capture |
| O-9 answer editing | Bottom sheet with its own "Atualizar programa" |
| O-10 resume card | Chooser |
| O-11 Build from import | Quiet link "Prefiro escrever do zero" |

## Open items and how D resolved them

- **O-1.** `ROUTE_STEPS` unchanged. Recommend 5 sections, Custom 7, Browse 2
  (days + minutes, then environment; no rest question). Section counter
  (`entry.step`, `aria-live="polite"`) and a task segbar
  (`data-progress-dimension="task"`, `data-progress-scope="entry-route-step"`).
  B's answer rail sits under the counter: each earlier answer is a chip that
  jumps back to that section with answers intact.
- **O-2.** Priorities: "Sem prioridade especial" is the default state, up to
  two muscles (the rest disable at two, with a caption saying why), movement
  priorities, and the proactive avoid search (`TS.avoidSection`). Choosing
  an exercise disables "Mostrar meu programa" until a reason is chosen
  (`aria-describedby="pendingAvoidNote"`); pain shows the production
  `entry.priorities.pain_note`. "Pular esta seção" clears this section's
  choices and shows the program.
- **O-3.** First viewport of the review: provenance/title eyebrow
  ("Programa recomendado", "Seu programa personalizado", or the source for
  other routes), the program name (`feature-title`), one facts line (days,
  duration range, exercises, working sets, Mono) and the start of the
  weekly structure (first day open). "Montado com" follows the weekly
  structure: one row per section (5 for Recommend, 7 for Custom), each with
  its value and an "Alterar" button whose accessible name names the fact.
  Then full reasons (`TS.reasons`, unfiltered) with the determinism line,
  "O que o Taurifer ajustou" when the engine reports limitations or
  reductions, "Suas restrições" with "Restaurar" for each avoided exercise,
  the close alternative only when `compile().alternative` is non-null, then
  "Editar antes de usar" and "Começar de novo" (confirmed) in the flow.
- **O-4.** Chooser grouped like the baseline (O Taurifer monta o programa ·
  Escolha um programa pronto · Traga ou monte o seu). Recommend is the
  featured door (accent outline, entry tint). Every door states "Você faz"
  (section counts from `ROUTE_STEPS` via `x.cost.*`, or the concrete action)
  and "Você recebe"; Recommend ("O Taurifer escolhe a estrutura") and Custom
  ("Você escolhe ênfase e exercícios. O Taurifer escreve o programa.") have
  different outcome lines. Build, paste door and file door sit in the
  "Usar meu próprio programa" disclosure. Helper "Não sabe qual escolher?":
  two questions at most; "Não, preciso de um" → Recomendação / Personalizado
  / Explorar; "Sim, já tenho" → Importar (paste door) / Montar. Ends at all
  five jobs. No minutes, no popularity.
- **O-5.** `data-change-statement` status line under the facts line after
  every recompile: answer changed from a sheet, constraint restored, edits
  from "Editar antes de usar", answers changed after walking back, and the
  first result that carries avoidances (stated against the same answers
  without them, so "Restrições aplicadas. Nenhum exercício mudou." for the
  bench-press case). Counts by identity (`TF.identityDiff`), `x.change.*`
  verbatim with a short context sentence before it.
- **O-6.** No route switching from the review; Back returns to the last
  section, catalogue, import review or gate.
- **O-7.** One `#firstRunSharedStart`, captioned with `setup.shared.cap_many`
  (`aria-describedby`), plus what arrives and that nothing is saved.
- **O-8.** Brand row (mark, wordmark, Privacidade), production headline and
  lede, `#firstRunCreate` (accent fill) and `#firstRunImport` (bordered),
  the vendored Today capture with its alt text, the privacy line.
- **O-9.** Sheet = header (title, "Fechar"), scrolling body, fixed footer
  holding "Atualizar programa", so the confirm is always visible (K-14). The
  environment sheet opens with the correction disclosure expanded (6 taps
  for the correction). Focus returns to the fact's "Alterar" after apply or
  close; Escape closes.
- **O-10.** Resume card at the top of the chooser naming route, step and
  date ("Recomendação · Prioridades e restrições · salvo em 28 de setembro"),
  "Retomar configuração" returns to that exact step with answers intact;
  "Começar de novo" asks before discarding (whole-draft discard, C-7). The
  rules-changed notice (Rebuild) sits in the same place.
- **O-11.** On the import route: mode switch (paste ↔ file, quiet) and the
  quiet link "Prefiro escrever do zero" (explicit switch to Build).
- **O-12.** Not used; D asks everything.

## Deviations from the spec (and interpretations)

1. **"Montado com" after the first day.** Read as "after the weekly
   structure, whose first day is open and the others collapsed", not
   between Day 1 and Day 2, so the weekly structure is never split.
2. **Continue is enabled on required sections.** D follows the production
   validation pattern: tapping Continue with a missing answer shows
   "Falta uma resposta" (focused, `role="alert"`) and marks each missing
   group; nothing advances and no result exists (K-18 accepts an enabled
   control that does not move). Continue is disabled, with its reason
   linked, only while an avoided exercise lacks a reason (K-9).
3. **200% text layout.** Headings step down one size (no heading word can
   overflow at 320 px), the primary button loses its arrow and side padding,
   the answer rail is hidden (Back still preserves answers), day numbers are
   hidden, and the 3+2 numeric grid becomes 2+2+1 at 200% because "minutos"
   cannot fit a third of a 320 px row at 24 px. At 100% it is 3+2 in every
   width. Only the primary is ever pinned; reasons and statuses move into
   the flow when compact (L-1).
4. **Change-statement context.** A context sentence precedes the settled
   `x.change.*` text ("Resposta alterada. 3 dos 21 exercícios mudaram.").
   The first Custom result also states the effect of its avoidance.
5. **Copy D owns.** Headings for gap repair (`d.ff.gaps_*`) and the resume
   line (`d.resume.at`) replace production strings that are European
   Portuguese (`entry.freeform.gaps_title`, `entry.resume.detail`).

## Harness defects found

1. **EU-PT left in shared widgets (not covered by H-7).** Inside the shared
   paste door, gap repair and resume copy: `entry.freeform.gaps_title`
   ("Completar detalhes em falta"), `entry.freeform.review` /
   `gaps_submit` ("Rever o programa"), `entry.freeform.unreadable_body`
   ("Pode editar…"), `entry.freeform.copy` ("Copiar o pedido"),
   `entry.resume.detail` ("guardado a"), `entry.rules_changed.body_keep`
   ("A Taurifer… pode mantê-lo"), `entry.catalogue.review_aria` ("Rever").
   K-15's word list does not catch them. D did not override production keys
   inside shared widgets (that would make D's version of a shared state
   different); it only uses its own `d.*` strings where it composes the
   heading. Minimal fix: add PT entries for these keys to `OVERRIDES` in
   `runtime.js` (PD-5 production follow-up).
2. **K-22 false negative on adjacent spans.** `audit-page.js` `k22()` finds
   the facts line through `el.textContent` with `\b18\b` / `\b49\b`; a facts
   line built from adjacent `<span>`s with no whitespace text between them
   reads "minutos18 exercícios49", which has no word boundary, so the
   warning fires although the line is in view. D inserts a space between
   spans (no advantage: same markup, same text). Minimal fix: match on
   `innerText`, or join child text nodes with spaces before the regex.
3. **Observations, no fix needed.** `TS.choice` always renders
   `.choice__mark`; L-4 forbids a radio mark in numeric cells, so each
   candidate hides it in its CSS. The shared `.btn--primary` (48 px side
   padding, subtitle size, arrow) overflows long PT labels at 320 px / 200%
   unless a candidate overrides it.

## Verification

Command: `node docs/design/onboarding-tournament/tools/verify.mjs --round 2
--candidates d --out <scratchpad>/verify-d` (full run: 45 checkpoints × 8
cells, all journeys in cells 1 and 6). From `summary.md`:

| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented |
|---|---|---|---|---|---|---|---|---|
| d | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |

Checkpoint audit hard failures: none. Warnings: none.

K-24 tap counts (reported, not thresholds):

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 15 | 15 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |

Manual craft pass (own screenshots, PT light 390, EN dark 390, PT light
320 and 390 at 200%): fixed facts-line separators and wrapping, equipment
casing in the environment fact, a duplicated route/eyebrow label on the
review and the Build editor, the helper link's accent (now ink, SM-5),
exercise rows and fact rows that split words at 200%, and the first option
of Priorities and of the sole Custom structure falling under the pinned
region at 390×844 / 200% (A-2); measured afterwards, every section's first
option ends above the pinned region.
