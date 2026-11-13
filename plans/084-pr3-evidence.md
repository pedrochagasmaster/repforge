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
| F1 | First Solid adds 8 stage units and real date credit to the painted arc | Durable save, `solid` case, projection delta and SVG paints | Missing finish ring | Pending |
| F2 | First valid check adds 8 plus real date credit | Draft `startMaxSet` then finish, `checked` case | Missing finish ring | Pending |
| F3 | Agreeing checks attain a stage; finding adds no duplicate credit | `calibrated` case, finding and exact delta | Missing finish ring | Pending |
| F4 | Date-only save adds .75; same-date unchanged evidence adds zero | `date` and `unchanged` cases | Missing finish ring | Pending |
| F5 | Cancelled confirmation and total durable write failure add nothing | `solid` case, production storage adapter refuses both writes | Missing finish integration remains red independently | Pending |
| F6 | Overview agrees, reader returns through Overview to the same finish without replay | Every successful case, real navigation | Missing finish link | Pending |
| F7 | One monotonic bounded fill, immediate final state with reduced motion | Painted `stroke-dasharray`, `reduced` case | Missing finish ring | Pending |
| F8 | EN/PT, dark, 320, text200 and reduced-motion frame fidelity | Catalog finish states, prototype finish columns | CI frame differences | Pending CI renders and owner fidelity review |

Copy approval and fidelity review remain owner gates before merge. CI and ci-full on the final head remain coordinator gates. This worker does not merge or watch CI.
