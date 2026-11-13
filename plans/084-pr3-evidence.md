# Plan 084 PR 3 acceptance evidence

- Scope: §7 row 3, the existing successful-save finish/finding slot only.
- Source: main `28a39d51d1a7ae226f6b1f16f04b58afc61ca95c`.
- Authority: `buildSavedProfile`, `profile@084.2`, consumes the actual finish receipt's `prevLog` and committed `rows`. No durable field, standing rule, or finding awards credit.
- Consumer: the existing summary, Overview and per-lift reader.
- First complete slice: actual DraftV2 save, durable publication, summary SVG paint, Overview and reader, return to the same summary.

All browser assertions below live in `test/profile-finish-browser.mjs`, composed into the existing `test/profile-browser.mjs` owner. Focused command:

```sh
REPFORGE_PROFILE_FINISH_ONLY=1 flock /tmp/taurifer-browser.lock node tools/run-tests.mjs full-browser --suite-id test-profile-browser-mjs
```

| ID | Observable result | Producer / assertion | Deliberate failure | Evidence |
|---|---|---|---|---|
| F1 | First Solid adds 8 stage units and real date credit to the painted arc | Durable save, `solid` case, projection delta and SVG paints | Missing finish ring | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F2 | First valid check adds 8 plus real date credit | Draft `startMaxSet` then finish, `checked` case | Missing finish ring | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F3 | Agreeing checks attain a stage; finding adds no duplicate credit | `calibrated` case, finding and exact delta | Missing finish ring | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F4 | Date-only save adds .75; same-date unchanged evidence adds zero | `date` and `unchanged` cases | Missing finish ring | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F5 | Cancelled confirmation and total durable write failure add nothing | `solid` case, production storage adapter refuses both writes | Missing finish integration remains red independently | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F6 | Overview agrees, reader returns through Overview to the same finish without replay | Every successful case, real navigation | Missing finish link | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F7 | One monotonic bounded fill, immediate final state with reduced motion | Painted `stroke-dasharray`, `reduced` case | Missing finish ring | Focused finish proof, 91 passed; full profile owner, 197 passed before the backdated extension |
| F8 | EN/PT, dark, 320, text200 and reduced-motion frame fidelity | Catalog finish states, prototype finish columns | CI frame differences | Pending CI renders and owner fidelity review |

The first red commit is `32230cccc`: 8 passed / 6 failed, all six successful
saves missing the finish ring. The motion owner was separately red,
112 passed / 2 failed, for the missing `profileFill` vocabulary. It is now
114 passed. `test/i18n.mjs` passes all 40 assertions; `test/ci.mjs` passes
all 70 metadata assertions after bootstrapping the 24 new catalog PNGs.

A backdated production save originally omitted already-known later sessions from
the finish reading. The focused backdated proof was red with 9 passed / 3 failed
(`REPFORGE_PROFILE_FINISH_CASE=backdated`): the arc and returned finish disagreed
with Overview. The new focused finish run passes all 91 assertions. Both snapshots now use one captured current date, retaining all
known saved history. The saved rows keep their chosen past date.

Copy is owner-approved with the edits below. Fidelity review remains an owner gate before merge. CI and ci-full on the final head remain coordinator gates. This worker does not merge or watch CI.

## Catalog review boundary

The 24 new PNGs under `session/profile-finish-{solid,checked,agreeing}__*` are
local bootstrap placeholders only. They were captured narrowly under the browser
lock. Existing frames are untouched and must come from CI. Before merge, replace
these placeholders from CI, or list the pixel-equivalent CI-verified frames after
zero-tolerance comparison, then review all of them at full size.

The new states are scrolled to the profile slot, retaining #736's share cards
above and its Share/Done footer. The prototype omitted those cards and had a
Done-only footer. Real canonical lift names, truthful history totals and ordinary
body typography follow the shipped finish screen. These differences await the owner's fidelity decision; the copy table below is approved. The first-check fixture has the prototype's 157→168 arithmetic. The agreeing
fixture is 141→152: its other three lifts have one valid check each, so this is
the first producer-released effort-reading finding. Giving those other lifts
three agreeing checks to force 157 would already release that global finding
before this save. Solid uses its actual shorter history, 138.5→149.5. Each case
still adds exactly four lift dates and one 8-unit stage.

All 24 bootstrap frames were reviewed at native size across the catalog matrix. The 320/text200 reader return path also passed 15 focused assertions. CI replacement/verification and owner approval remain pending.

The unchanged-save regression was red first: 12 passed / 1 failed, because a change paragraph still rendered.

## Approved finish copy

Owner-approved, including the Solid/date wording below. The unchanged key is removed; a save that adds no evidence renders no change line and retains its ring and navigation. Singular date copy keeps `{n}` for placeholder parity.

| Key | EN | PT |
|---|---|---|
| `profile.finish.solid` | Solid: your saved sets now back your targets. | Bem fundamentada: suas séries salvas já sustentam suas metas. |
| `profile.finish.checked` | First test set saved: guessed {guess}, did {did}. | Primeira série-teste salva: estimou {guess}, fez {did}. |
| `profile.finish.agreeing` | Test set {n} saved: guessed {guess}, did {did}. Your checks agree. | Série-teste {n} salva: estimou {guess}, fez {did}. Suas séries-teste concordam. |
| `profile.finish.dates` | {n} lifts gained a saved date. | {n} exercícios ganharam uma data salva. |
| `profile.finish.dates_one` | {n} lift gained a saved date. | {n} exercício ganhou uma data salva. |
| `profile.finish.stages` | {n} stages added to your profile. | {n} etapas acrescentadas ao seu perfil. |
| `profile.finish.stages_one` | {n} stage added to your profile. | {n} etapa acrescentada ao seu perfil. |
| `profile.finish.depth` | This save adds evidence to your saved dates. | Esta sessão salva acrescenta evidências às suas datas salvas. |
| `profile.finish.open` | See your profile | Ver seu perfil |
| `profile.finish.reader` | See this lift's stages | Ver as etapas deste exercício |

After the approved copy edits and removal of the unchanged line, the focused finish suite passes 92 assertions. `build-i18n --check` confirms 3287 keys per language. The 24 bootstrap PNGs remain untouched for CI replacement/verification and prototype review.
