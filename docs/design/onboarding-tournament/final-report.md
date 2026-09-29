# Onboarding design tournament: final report

The tournament stops after Round 2. Both Round 2 judges found that none of
the three candidates ships as frozen. They agree on which parts to combine.
They name different bases, but the parts they list converge on one design.
Once that synthesis is built, both say the remaining differences are taste
and one product-policy question. That is the stop condition the brief set,
so this report surfaces the decision instead of running Round 3.

Nothing here changes production. Every artifact lives under
`docs/design/onboarding-tournament/`.

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
| Acceptance tool | `tools/verify.mjs` (self-tests `tools/audit-selftest.mjs`, `tools/harness-selftest.mjs`) |

## 11. Review URL

https://claude.ai/artifact/Q8YjdRmRknQtz7H4fMh6Kw. It shows both rounds on the
same data: set Round to 1 or 2, then choose scenario, state, language,
theme, width, text size and motion. The link is private until it is
shared.

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
