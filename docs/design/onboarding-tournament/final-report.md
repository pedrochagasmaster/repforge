# Onboarding design tournament: final report

The tournament stops after Round 2. Both Round 2 judges found that none of
the three candidates ships as frozen. They agree on which parts to combine.
They name different bases, but the parts they list converge on one design.
Once that synthesis is built, both say the remaining differences are taste
and one product-policy question. That is the stop condition the brief set,
so this report surfaces the decision instead of running Round 3.

Nothing here changes production. Every artifact lives under
`docs/design/onboarding-tournament/`.

**Later rounds.** The owner then closed the open decisions (Q622–Q637) and
had the synthesis built as one candidate, G (Round 3), checked by acceptance
only. After seeing G, the owner asked for bolder exploration: Round 4, five
directions in their own visual worlds. §13 covers both rounds. §10–12 list
their files, the review page and the commits.

## 1. Baseline

- **Visual and behavioural baseline:** PR #256, branch
  `ui-overhaul/058-system-convergence`, live head
  `f61ce44b05b1b6717abb4ef00b2395204e9c9636` (resolved at the start; `main`
  was not used).
- **Real engine in the harness:** `program-compiler.js`, `program-entry.js`,
  `program-entry-adapter.js`, `exercises.js` and `shared-setup.js`, copied
  verbatim from that head (`vendor/README.md`). Import matching and
  free-form parsing are ported from `app.js`. The device store and the
  activation transaction are simulated.

## 2. Round 1 candidates

| Id | Name | Thesis | Product decisions |
| --- | --- | --- | --- |
| A | Uma pergunta | Never make a new lifter choose a method: ask the questions that change the program, show it at once, and offer every other route as a refinement. | Routes merged behind one path; minutes and rest assumed |
| B | Cinco portas honestas | Keep the five jobs and make choosing one cheap: every door states its cost and outcome, questions are grouped by consequence, and the result leads with the program. | None |
| C | Programa primeiro | Show a real, trainable program before asking anything, and let the lifter correct the facts it was built from on the program itself. | Default answers compiled before the lifter answers |

All three passed 225 of 225 hard checks. Frozen at `31a37b9`
(`round-1/manifest.md`).

## 3. Judges and isolation

| Round | Judge | Isolation |
| --- | --- | --- |
| 1 | Alpha | Fresh agent, parallel with Bravo, identical brief, no access to the other's notes; wrote only its own report |
| 1 | Bravo | Same |
| 2 | Charlie | Fresh agent, parallel with Delta; barred from `round-1/judges/` and `round-2/judges/`; wrote only its own report; drove the phones in Playwright |
| 2 | Delta | Same, with a skeptical accessibility brief (320 px, 200% text, EN dark, keyboard) |

The Round 1 synthesizer and the three Round 2 generators were also fresh
agents. The generators never saw the Round 1 judge reports. Each round's
reports were committed together only after both judges finished.

## 4. Judge disagreements

**Round 1** (`round-1/synthesis-spec.md` §11.3)

- Alpha recommended B as the base with A's result-as-review. Bravo
  recommended A's direction with B's grafts and asked for owner sign-off.
  The synthesizer found the evidence supported B: A's tap lead came mostly
  from assuming minutes and rest, which Plan 048 #7 forbids.
- Both rejected C on verified defects.

**Round 2**

| Topic | Charlie | Delta | What the evidence says |
| --- | --- | --- | --- |
| Base of the synthesis | F | D | Both lists name the same parts: F's chooser and change count, D's review and import behaviour, E's correction feedback. The base label is not a design difference. |
| Answer editing at 200% text | Sheets are fine | Sheets fail at 320/200 | Delta is right. The orchestrator measured the priorities sheet at 320 px and 200%: 223 px visible for 1,626 px of content in D, 199 px for 1,398 px in F. |
| Landing | F best | D narrowly | Taste (open item O-8). |
| Helper position | Not raised | D's top position is reachable at 320/200; F's is at the bottom | Delta's measurement stands (usability). |

Each judge found defects the other missed. None of those findings conflict,
and the orchestrator confirmed every one in the source:

| Defect | Found by | Source |
| --- | --- | --- |
| E and F wipe the pasted text, AI reply and gap answers on any import-mode tap, including the active one | Charlie | `e.js:784`, `f.js:834` (D keeps the session, `d.js:709`) |
| F's third import door is dead and shows `entry.route.undefined` | Charlie | `f.js:645` has no `data-route`; `f.js:799` reads it |
| E's resume card exists only on a landing production shows once | Both | `e.js:642-652` |
| F's cancel and replacement dialogs never take keyboard focus | Delta | `f.js:810` renders with no focus target (D focuses the title, `d.js:673`) |
| D's "Pular esta seção" silently discards a pain avoidance | Delta | `d.js:256-259` |
| D shows the change statement and new name off-screen after a correction | Both | focus returns to the opener, `d.js:636` |
| All three drop keyboard focus to the page after every answer | Delta | every `pick` re-renders without restoring focus |
| F's Custom review shows no program in its first viewport (L-3) | Both | chips push the first day below the pinned bar |

## 5. Synthesis decisions (Round 1 to Round 2)

The spec (`round-1/synthesis-spec.md`, commit `3ebac2a`) settled the base on
B's information architecture and `ROUTE_STEPS`. It grafted A's "the result
is the review", with answers edited in place, and C's idea of stating what
a rebuild changed, recomputed by exercise identity. It fixed 15 shared
harness defects (H-1 to H-15). It left twelve items open (O-1 to O-12) and
five for the owner (PD-1 to PD-5). The Round 2 generator brief allocated
each open item across D, E and F so the three would diverge.

## 6. Round 2 candidates

| Id | Name | Thesis | Product decisions |
| --- | --- | --- | --- |
| D | Cinco portas, uma revisão (control) | The spec as written: five honest doors, five grouped sections, one review that is the result, corrected in place with a true change statement. | None |
| E | Uma pergunta por vez | Start is a conversation, not a menu: one question at a time, with every other route one explicit, reversible step away. | PD-1 |
| F | A primeira pergunta | Choosing a route should cost nothing extra: the chooser opens on Recommend's first question, and the review keeps the program in view with chips and a before/after count. | None |

Frozen at `0af5848` (artifact `2396890`). The acceptance run
(`round-2/acceptance/summary.md`) passed for all three: 360 of 360 checkpoint
cells and 122 of 122 journeys each, with no warnings.

| Taps to activate | D | E | F |
| --- | --- | --- | --- |
| Rafael, landing to Today | 15 | 16 | 13 |
| Custom | 23 | 26 | 22 |
| Browse | 8 | 9 | 7 |

## 7. Final verdict

No Round 2 candidate should ship as frozen. D is the only one with no
correctness defect, and it is the safe fallback, but its correction feedback
is invisible to a sighted lifter. E is the weakest: it needs PD-1, it is the
slowest, it wipes paste work, and existing users cannot reach its resume
card. F has the cheapest path and the best change statement, but ships a
dead door, a data-loss control and inaccessible dialogs.

The judges now disagree only on the base label and on matters of taste.
That meets the stop condition, so the tournament stops here.

## 8. Recommended synthesis

Build on D's architecture: `ROUTE_STEPS` unchanged, and no product decision.

1. **Chooser, from F.** The featured Recommend block is the goal question,
   so one tap chooses Recommend and answers the goal (Rafael: 13 taps). Keep
   D's helper at the top of the chooser and D's "Você faz / Você recebe"
   lines on the other doors.
2. **Review, from D.** The program comes first on every route, including
   Custom (L-3).
3. **Change statement, from F and E.** Use F's before/after count, which is
   the only form that shows a set reduction the identity count hides (49 to
   36 sets at 45 minutes). After an apply, move focus and scroll to it, as E
   does, so it is visible at 320 px and 200% text.
4. **Answer editing, from E.** Edit inline, at least at 200% text and below
   360 px, where sheets leave about 200 px to work in. Sheets may stay at
   100% text.
5. **Import, dialogs and conflict, from D.** Never reset the paste session on
   a mode switch. Focus every dialog's title. Focus the conflict alert. Keep
   the accent off navigation links.
6. **Resume.** Put the card on the chooser (D), optionally also on the
   landing for a first-run lifter (F). Never put it on the landing alone.
7. **Fixes.** Show "Pular esta seção" only while the section is empty.
   Restore focus to the chosen option after each answer. Use "salvar", not
   "guardar", everywhere.

## 9. Unresolved product decisions

- **PD-1, deferred route choice.** Both judges say it is not needed: F's
  first-question chooser gets E's saving with no policy change, at fewer
  taps. The owner decides whether to close PD-1 or still test it.
- **PD-2 and PD-3, assumed session length and rest.** No Round 2 candidate
  used them; all three ask. Recommend closing both as "keep asking"
  (Plan 048 #7).
- **PD-4, an illustrative program before any answer.** Unused. Recommend
  closing it.
- **PD-5, production catalog fixes.** The harness overrides European
  Portuguese and brand-rule strings that are still in PR #256's catalog.
  These need a production change to `i18n-pt.json`: the §5.3 strings, the
  eight shared-widget strings added in Round 2, the cancel dialog's
  "Guardar rascunho e sair", and the rules-drift button "Recompilar", which
  contradicts its own body copy.
- **Taste calls left to the owner:**
  - answers on the review as chips or as a list;
  - the landing proof above or below the two actions (the owner's visual
    gate applies);
  - a quiet "Agora não" on the shared-link gate;
  - Build from import as a third door or a quiet link;
  - one question per screen or grouped sections.
- **Product obligations the owner should know:**
  - An "Agora não" decline must restore the pre-link language (ADR 0007).
  - A resume card on the landing only works if the landing-once rule
    changes (Plan 054).

## 10. Paths

| What | Path |
| --- | --- |
| Harness and contract | `docs/design/onboarding-tournament/` (`README.md`, `index.html`, `runtime.js`, `candidates/shared-screens.js`) |
| Round 1 candidates, manifest, acceptance | `candidates/{a,b,c}.*`, `round-1/manifest.md`, `round-1/acceptance/` |
| Round 1 judge reports | `round-1/judges/judge-alpha.md`, `round-1/judges/judge-bravo.md` |
| Synthesis spec | `round-1/synthesis-spec.md` |
| Round 2 brief, interface, candidates | `round-2/generator-brief.md`, `round-2/JOURNEYS.md`, `round-2/candidates/{d,e,f}.*` |
| Round 2 manifest and acceptance | `round-2/manifest.md`, `round-2/acceptance/summary.md`, `results.json` |
| Round 2 judge brief and reports | `round-2/judge-brief.md`, `round-2/judges/judge-charlie.md`, `round-2/judges/judge-delta.md` |
| Round 3 candidate, manifest, acceptance | `round-3/candidates/g.*`, `round-3/manifest.md`, `round-3/acceptance-checks.md`, `round-3/acceptance/summary.md` |
| Round 4 brief and production finding | `round-4/brief.md`, `round-4/production-findings.md` |
| Round 4 candidates and worlds | `round-4/candidates/{h,i,j,k,l}.{js,css,notes.md,world.md}`, page `round-4/app.html`, fonts `round-4/fonts/`, own Today captures `round-4/assets/{h,i}/` |
| Round 4 direction contracts | `.impeccable/surfaces/arding-tournament-round-4-candidates-<id>-js-*.md` |
| Round 4 manifest | `round-4/manifest.md` (freeze commit, acceptance, taps, review process) |
| Acceptance tool | `tools/verify.mjs` (self-tests `tools/audit-selftest.mjs`, `tools/harness-selftest.mjs`; `--round 4` runs the core states and journeys only) |

## 11. Review URL

https://claude.ai/artifact/Q8YjdRmRknQtz7H4fMh6Kw. It shows every round on
the same data: set Round to 1, 2, 3 or 4, then choose scenario, state,
language, theme, width, text size and motion. Round 4 lists only its 21 core
states. `index.html?round=4&cands=all&cp=rec-result` puts all five Round 4
directions side by side. The link is private until it is shared.

The published page has not yet been updated with Round 4. This session had
no tool that can republish it. Locally, `index.html?round=4&cands=all&cp=rec-result`
renders all five with no console errors.

## 12. Branch, commits and PR

- Branch `ccr-15c50ac8-pki40i`, draft PR #279.
- Key commits:

| Commit | What |
| --- | --- |
| `31a37b9`, `9cf45d1` | Round 1 artifact and freeze |
| `6d7ca27` | Round 1 judge reports |
| `3ebac2a` | Synthesis spec |
| `af79658` | Shared harness fixes and Round 2 acceptance tooling |
| `5839977` | Round 2 generator allocation |
| `2396890`, `0af5848` | Round 2 candidates and freeze |
| `841b519` | Round 2 judge reports |
| `d89c31d` | This report (stop after Round 2) |
| `108bacb` | Owner decisions Q622–Q637 |
| `13718e3` | Round 3 acceptance checks K-25–K-32 |
| `6724648` | Round 3 (G) freeze |
| `2ab74ce` | Round 4 brief, font tool, core acceptance mode, K-18 relaxation for PD-4 |
| `793e274` | Production finding PF-1 |
| `b4efd7b` | K-23 accepts a candidate's own Today capture |
| `d4d7b2e` | Round 4 registered in the review page |
| `e519d68`, `2e24110`, `1dbf357`, `099c433`, `0c0d15c` | Round 4 finish: H complete, L rebuilt, J complete, I fixes, I complete |
| `b7753d9` | Verifier clips over-tall evidence shots; Round 4 freeze (acceptance run at this commit); the manifest and this section follow it |

## 13. Rounds 3 and 4

### Round 3

The owner closed PD-1 to PD-4 and the taste calls in Q622–Q637
(`docs/product-grilling-decision-register.md`). The synthesis in §8 was
built as one candidate, G · Síntese, and checked by acceptance only, with
no judges (Q626). G passed 360 of 360 checkpoint cells, 122 of 122 journeys
and 61 of 61 interaction checks. Rafael reaches Today in 13 taps
(`round-3/manifest.md`). G is today's onboarding, polished and fixed.

### Round 4

After seeing G, the owner found it too timid and asked for five
deliberately different ideas of onboarding. Each has its own committed
visual world and is built to finish quality on the core journey only (21
states, 12 journeys). A direction may reopen a closed product decision if it
says so openly. The owner picks what advances. G stays in the harness as the
conventional arm.

| Id | Name | Thesis | Taps to Today | Reopens |
| --- | --- | --- | --- | --- |
| H | Concreto | Each screen is a concrete-poetry composition (Jost, black rules, one vermilion field). | 18 | None |
| I | Ficha | Filling in your own gym training card: print, BIC-blue pen, a red "ATIVO" date stamp, coloured cardstock. | 13 | None |
| J | Conversa | Setup as a message thread: quick replies; correct the program by replying to a line. | 11 | PD-1 (Q622): no chooser |
| K | Linhas | São Paulo metro wayfinding: routes are lines, steps are stations, one terminal. | 14 | None |
| L | Pino | The program exists before the questions; each answer is a pin on a weight stack; activation stays locked until every pin is set. | 10 | PD-4 (Q624): a program before any answer |

Process: one builder per direction, then a fresh `impeccable-finish-reviewer`
review, one fix batch and a verdict pass. L was rebuilt after its first
review and reviewed again. The freeze run at `b7753d9` is in progress (H complete, zero
failures); every builder's last run passed 168/168 cells and 30/30 journeys. Details, the acceptance table and the optional polish left
undone are in `round-4/manifest.md`.

Two harness changes came out of the round. K-23 now accepts a candidate's
own Today capture marked `data-proof-own` with its own alt of 40 or more
characters (`b4efd7b`), because the production alt describes a different
week. K-18 lets a PD-4 direction show a program before the answers, as long
as activation stays impossible until every answer is the lifter's own.

One production finding (PF-1, `round-4/production-findings.md`): the growth
3-day Day 1 is named "Lower body hypertrophy" but contains upper-body work.
This is engine and catalog truth, and no candidate changes it. It needs its
own production PR.

**Open for the owner:** which direction, or which parts, advance. Advancing J
or L also means reopening Q622 or Q624. Q636's path (a passing onboarding
candidate becomes a plan before Plan 059) is unchanged until the owner
decides.
