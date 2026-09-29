# Acceptance — round 2

Generated 2026-09-29T05:44:20.623Z against `http://127.0.0.1:8123/docs/design/onboarding-tournament/round-2/app.html` by `tools/verify.mjs --round 2`.

Cells (§12.1): 1 pt/light/390/100 · 2 en/dark/390/100 · 3 pt/light/320/100 · 4 pt/light/390/200 · 5 en/light/430/100/reduced · 6 pt/light/320/200 · 7 pt/light/430/100 · 8 en/dark/320/200/reduced.
Journeys (§12.2) run in cells 1 and 6. Every hard check is a failure; warnings are listed separately.

| Candidate | Declared product decisions | Checkpoint cells | Cells without hard failures | Cells with warnings | Journey runs | Journeys passed | Journeys failed (hard) | Not implemented |
|---|---|---|---|---|---|---|---|---|
| d | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |
| e | PD-1 | 360 | 360 | 0 | 122 | 122 | 0 | 0 |
| f | none | 360 | 360 | 0 | 122 | 122 | 0 | 0 |

## d

### Checkpoint audit: hard failures

None.

### Checkpoint audit: warnings

None.


### Journeys

| Journey | Check | Start | Cell 1 (pt/light/390/100) | Cell 6 (pt/light/320/200) | Taps |
|---|---|---|---|---|---|
| activate.recommend | K-1 K-24 | landing | pass | pass | 15 / 15 |
| activate.custom | K-1 | route-choice | pass | pass | 23 / 23 |
| activate.browse | K-1 | route-choice | pass | pass | 8 / 8 |
| activate.build | K-1 | route-choice | pass | pass | 21 / 21 |
| activate.import-file | K-1 | import-source | pass | pass | 7 / 7 |
| activate.import-paste | K-1 | ff-empty | pass | pass | 14 / 14 |
| activate.shared | K-1 | shared-gate | pass | pass | 2 / 2 |
| edit.roundtrip | K-2 | rec-result | pass | pass | 3 / 3 |
| edit.remove-two.editor | K-3 | rec-result | pass | pass | 4 / 4 |
| edit.remove-two.review | K-3 | rec-result | pass | pass | 5 / 5 |
| build.gating | K-4 | build-setup | pass | pass | 13 / 13 |
| cancel @rec-goal | K-5 | rec-goal | pass | pass | 1 / 1 |
| cancel @rec-background | K-5 | rec-background | pass | pass | 1 / 1 |
| cancel @rec-schedule | K-5 | rec-schedule | pass | pass | 1 / 1 |
| cancel @rec-environment | K-5 | rec-environment | pass | pass | 1 / 1 |
| cancel @rec-priorities | K-5 | rec-priorities | pass | pass | 1 / 1 |
| cancel @rec-result | K-5 | rec-result | pass | pass | 1 / 1 |
| cancel @custom-priorities | K-5 | custom-priorities | pass | pass | 1 / 1 |
| cancel @custom-exercises | K-5 | custom-exercises | pass | pass | 1 / 1 |
| cancel @custom-shape | K-5 | custom-shape | pass | pass | 1 / 1 |
| cancel @custom-result | K-5 | custom-result | pass | pass | 1 / 1 |
| cancel @browse-filters | K-5 | browse-filters | pass | pass | 1 / 1 |
| cancel @browse-list | K-5 | browse-list | pass | pass | 1 / 1 |
| cancel @browse-preview | K-5 | browse-preview | pass | pass | 1 / 1 |
| cancel @build-setup | K-5 | build-setup | pass | pass | 1 / 1 |
| cancel @build-empty | K-5 | build-empty | pass | pass | 1 / 1 |
| cancel @build-ready | K-5 | build-ready | pass | pass | 1 / 1 |
| cancel @ff-empty | K-5 | ff-empty | pass | pass | 1 / 1 |
| cancel @ff-reply | K-5 | ff-reply | pass | pass | 1 / 1 |
| cancel @ff-gaps | K-5 | ff-gaps | pass | pass | 1 / 1 |
| cancel @ff-unreadable | K-5 | ff-unreadable | pass | pass | 1 / 1 |
| cancel @import-source | K-5 | import-source | pass | pass | 1 / 1 |
| cancel @import-review | K-5 | import-review | pass | pass | 1 / 1 |
| cancel @import-preview | K-5 | import-preview | pass | pass | 1 / 1 |
| cancel @shared-preview | K-5 | shared-preview | pass | pass | 1 / 1 |
| cancel.keep-resume | K-5 | rec-schedule | pass | pass | 5 / 5 |
| back.recommend | K-6 | rec-result | pass | pass | 1 / 1 |
| back.custom | K-6 | custom-result | pass | pass | 1 / 1 |
| back.browse | K-6 | browse-preview | pass | pass | 1 / 1 |
| back.import | K-6 | import-review | pass | pass | 6 / 6 |
| back.shared | K-6 | shared-preview | pass | pass | 1 / 1 |
| destroy.review-start-over | K-7 | rec-result | pass | pass | 2 / 2 |
| destroy.paste-restart | K-7 | ff-reply | pass | pass | 2 / 2 |
| destroy.discard-draft | K-7 | rec-schedule | pass | pass | 2 / 2 |
| existing.back | K-8 | hub-existing | pass | pass | 1 / 1 |
| existing.cancel-keep | K-8 | hub-existing | pass | pass | 4 / 4 |
| existing.cancel-discard | K-8 | hub-existing | pass | pass | 4 / 4 |
| existing.replace-cancel | K-8 | replace-confirm | pass | pass | 1 / 1 |
| existing.conflict | K-8 | activation-conflict | pass | pass | 2 / 2 |
| avoid.pain | K-9 | rec-priorities | pass | pass | 5 / 5 |
| overlays | K-14 | rec-result | pass | pass | 10 / 10 |
| change.days | K-17 | rec-result | pass | pass | 3 / 3 |
| correct.environment | K-17 K-24 | rec-result | pass | pass | 6 / 6 |
| avoid.from-review | K-17 K-24 | rec-result | pass | pass | 5 / 5 |
| recommend.required | K-18 | rec-goal | pass | pass | 12 / 12 |
| chooser.doors | K-19 | route-choice | pass | pass | 11 / 11 |
| help.recommend | K-19 | route-choice | pass | pass | 4 / 4 |
| help.custom | K-19 | route-choice | pass | pass | 4 / 4 |
| help.browse | K-19 | route-choice | pass | pass | 4 / 4 |
| help.build | K-19 | route-choice | pass | pass | 4 / 4 |
| help.import | K-19 | route-choice | pass | pass | 4 / 4 |

### K-24 tap counts (reported, not thresholds)

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 15 | 15 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |

## e

### Checkpoint audit: hard failures

None.

### Checkpoint audit: warnings

None.


### Journeys

| Journey | Check | Start | Cell 1 (pt/light/390/100) | Cell 6 (pt/light/320/200) | Taps |
|---|---|---|---|---|---|
| activate.recommend | K-1 K-24 | landing | pass | pass | 16 / 16 |
| activate.custom | K-1 | route-choice | pass | pass | 26 / 26 |
| activate.browse | K-1 | route-choice | pass | pass | 9 / 9 |
| activate.build | K-1 | route-choice | pass | pass | 20 / 20 |
| activate.import-file | K-1 | import-source | pass | pass | 7 / 7 |
| activate.import-paste | K-1 | ff-empty | pass | pass | 14 / 14 |
| activate.shared | K-1 | shared-gate | pass | pass | 2 / 2 |
| edit.roundtrip | K-2 | rec-result | pass | pass | 3 / 3 |
| edit.remove-two.editor | K-3 | rec-result | pass | pass | 4 / 4 |
| edit.remove-two.review | K-3 | rec-result | pass | pass | 5 / 5 |
| build.gating | K-4 | build-setup | pass | pass | 13 / 13 |
| cancel @rec-goal | K-5 | rec-goal | pass | pass | 1 / 1 |
| cancel @rec-background | K-5 | rec-background | pass | pass | 1 / 1 |
| cancel @rec-schedule | K-5 | rec-schedule | pass | pass | 1 / 1 |
| cancel @rec-environment | K-5 | rec-environment | pass | pass | 1 / 1 |
| cancel @rec-priorities | K-5 | rec-priorities | pass | pass | 1 / 1 |
| cancel @rec-result | K-5 | rec-result | pass | pass | 1 / 1 |
| cancel @custom-priorities | K-5 | custom-priorities | pass | pass | 1 / 1 |
| cancel @custom-exercises | K-5 | custom-exercises | pass | pass | 1 / 1 |
| cancel @custom-shape | K-5 | custom-shape | pass | pass | 1 / 1 |
| cancel @custom-result | K-5 | custom-result | pass | pass | 1 / 1 |
| cancel @browse-filters | K-5 | browse-filters | pass | pass | 1 / 1 |
| cancel @browse-list | K-5 | browse-list | pass | pass | 1 / 1 |
| cancel @browse-preview | K-5 | browse-preview | pass | pass | 1 / 1 |
| cancel @build-setup | K-5 | build-setup | pass | pass | 1 / 1 |
| cancel @build-empty | K-5 | build-empty | pass | pass | 1 / 1 |
| cancel @build-ready | K-5 | build-ready | pass | pass | 1 / 1 |
| cancel @ff-empty | K-5 | ff-empty | pass | pass | 1 / 1 |
| cancel @ff-reply | K-5 | ff-reply | pass | pass | 1 / 1 |
| cancel @ff-gaps | K-5 | ff-gaps | pass | pass | 1 / 1 |
| cancel @ff-unreadable | K-5 | ff-unreadable | pass | pass | 1 / 1 |
| cancel @import-source | K-5 | import-source | pass | pass | 1 / 1 |
| cancel @import-review | K-5 | import-review | pass | pass | 1 / 1 |
| cancel @import-preview | K-5 | import-preview | pass | pass | 1 / 1 |
| cancel @shared-preview | K-5 | shared-preview | pass | pass | 1 / 1 |
| cancel.keep-resume | K-5 | rec-schedule | pass | pass | 4 / 4 |
| back.recommend | K-6 | rec-result | pass | pass | 1 / 1 |
| back.custom | K-6 | custom-result | pass | pass | 1 / 1 |
| back.browse | K-6 | browse-preview | pass | pass | 1 / 1 |
| back.import | K-6 | import-review | pass | pass | 6 / 6 |
| back.shared | K-6 | shared-preview | pass | pass | 1 / 1 |
| destroy.review-start-over | K-7 | rec-result | pass | pass | 2 / 2 |
| destroy.paste-restart | K-7 | ff-reply | pass | pass | 2 / 2 |
| destroy.discard-draft | K-7 | rec-schedule | pass | pass | 2 / 2 |
| existing.back | K-8 | hub-existing | pass | pass | 1 / 1 |
| existing.cancel-keep | K-8 | hub-existing | pass | pass | 4 / 4 |
| existing.cancel-discard | K-8 | hub-existing | pass | pass | 4 / 4 |
| existing.replace-cancel | K-8 | replace-confirm | pass | pass | 1 / 1 |
| existing.conflict | K-8 | activation-conflict | pass | pass | 2 / 2 |
| avoid.pain | K-9 | rec-priorities | pass | pass | 7 / 7 |
| overlays | K-14 | rec-result | pass | pass | 18 / 18 |
| change.days | K-17 | rec-result | pass | pass | 3 / 3 |
| correct.environment | K-17 K-24 | rec-result | pass | pass | 6 / 6 |
| avoid.from-review | K-17 K-24 | rec-result | pass | pass | 5 / 5 |
| recommend.required | K-18 | rec-goal | pass | pass | 14 / 14 |
| chooser.doors | K-19 | route-choice | pass | pass | 8 / 8 |
| help.recommend | K-19 | route-choice | pass | pass | 3 / 3 |
| help.custom | K-19 | route-choice | pass | pass | 3 / 3 |
| help.browse | K-19 | route-choice | pass | pass | 3 / 3 |
| help.build | K-19 | route-choice | pass | pass | 3 / 3 |
| help.import | K-19 | route-choice | pass | pass | 3 / 3 |

### K-24 tap counts (reported, not thresholds)

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 16 | 16 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |

## f

### Checkpoint audit: hard failures

None.

### Checkpoint audit: warnings

None.


### Journeys

| Journey | Check | Start | Cell 1 (pt/light/390/100) | Cell 6 (pt/light/320/200) | Taps |
|---|---|---|---|---|---|
| activate.recommend | K-1 K-24 | landing | pass | pass | 13 / 13 |
| activate.custom | K-1 | route-choice | pass | pass | 22 / 22 |
| activate.browse | K-1 | route-choice | pass | pass | 7 / 7 |
| activate.build | K-1 | route-choice | pass | pass | 21 / 21 |
| activate.import-file | K-1 | import-source | pass | pass | 7 / 7 |
| activate.import-paste | K-1 | ff-empty | pass | pass | 14 / 14 |
| activate.shared | K-1 | shared-gate | pass | pass | 2 / 2 |
| edit.roundtrip | K-2 | rec-result | pass | pass | 3 / 3 |
| edit.remove-two.editor | K-3 | rec-result | pass | pass | 4 / 4 |
| edit.remove-two.review | K-3 | rec-result | pass | pass | 5 / 5 |
| build.gating | K-4 | build-setup | pass | pass | 13 / 13 |
| cancel @rec-goal | K-5 | rec-goal | pass | pass | 1 / 1 |
| cancel @rec-background | K-5 | rec-background | pass | pass | 1 / 1 |
| cancel @rec-schedule | K-5 | rec-schedule | pass | pass | 1 / 1 |
| cancel @rec-environment | K-5 | rec-environment | pass | pass | 1 / 1 |
| cancel @rec-priorities | K-5 | rec-priorities | pass | pass | 1 / 1 |
| cancel @rec-result | K-5 | rec-result | pass | pass | 1 / 1 |
| cancel @custom-priorities | K-5 | custom-priorities | pass | pass | 1 / 1 |
| cancel @custom-exercises | K-5 | custom-exercises | pass | pass | 1 / 1 |
| cancel @custom-shape | K-5 | custom-shape | pass | pass | 1 / 1 |
| cancel @custom-result | K-5 | custom-result | pass | pass | 1 / 1 |
| cancel @browse-filters | K-5 | browse-filters | pass | pass | 1 / 1 |
| cancel @browse-list | K-5 | browse-list | pass | pass | 1 / 1 |
| cancel @browse-preview | K-5 | browse-preview | pass | pass | 1 / 1 |
| cancel @build-setup | K-5 | build-setup | pass | pass | 1 / 1 |
| cancel @build-empty | K-5 | build-empty | pass | pass | 1 / 1 |
| cancel @build-ready | K-5 | build-ready | pass | pass | 1 / 1 |
| cancel @ff-empty | K-5 | ff-empty | pass | pass | 1 / 1 |
| cancel @ff-reply | K-5 | ff-reply | pass | pass | 1 / 1 |
| cancel @ff-gaps | K-5 | ff-gaps | pass | pass | 1 / 1 |
| cancel @ff-unreadable | K-5 | ff-unreadable | pass | pass | 1 / 1 |
| cancel @import-source | K-5 | import-source | pass | pass | 1 / 1 |
| cancel @import-review | K-5 | import-review | pass | pass | 1 / 1 |
| cancel @import-preview | K-5 | import-preview | pass | pass | 1 / 1 |
| cancel @shared-preview | K-5 | shared-preview | pass | pass | 1 / 1 |
| cancel.keep-resume | K-5 | rec-schedule | pass | pass | 4 / 4 |
| back.recommend | K-6 | rec-result | pass | pass | 1 / 1 |
| back.custom | K-6 | custom-result | pass | pass | 1 / 1 |
| back.browse | K-6 | browse-preview | pass | pass | 1 / 1 |
| back.import | K-6 | import-review | pass | pass | 6 / 6 |
| back.shared | K-6 | shared-preview | pass | pass | 1 / 1 |
| destroy.review-start-over | K-7 | rec-result | pass | pass | 2 / 2 |
| destroy.paste-restart | K-7 | ff-reply | pass | pass | 2 / 2 |
| destroy.discard-draft | K-7 | rec-schedule | pass | pass | 2 / 2 |
| existing.back | K-8 | hub-existing | pass | pass | 1 / 1 |
| existing.cancel-keep | K-8 | hub-existing | pass | pass | 3 / 3 |
| existing.cancel-discard | K-8 | hub-existing | pass | pass | 3 / 3 |
| existing.replace-cancel | K-8 | replace-confirm | pass | pass | 1 / 1 |
| existing.conflict | K-8 | activation-conflict | pass | pass | 2 / 2 |
| avoid.pain | K-9 | rec-priorities | pass | pass | 5 / 5 |
| overlays | K-14 | rec-result | pass | pass | 10 / 10 |
| change.days | K-17 | rec-result | pass | pass | 3 / 3 |
| correct.environment | K-17 K-24 | rec-result | pass | pass | 6 / 6 |
| avoid.from-review | K-17 K-24 | rec-result | pass | pass | 5 / 5 |
| recommend.required | K-18 | rec-goal | pass | pass | 11 / 11 |
| chooser.doors | K-19 | route-choice | pass | pass | 11 / 11 |
| help.recommend | K-19 | route-choice | pass | pass | 3 / 3 |
| help.custom | K-19 | route-choice | pass | pass | 3 / 3 |
| help.browse | K-19 | route-choice | pass | pass | 3 / 3 |
| help.build | K-19 | route-choice | pass | pass | 3 / 3 |
| help.import | K-19 | route-choice | pass | pass | 3 / 3 |

### K-24 tap counts (reported, not thresholds)

| Task | Cell 1 | Cell 6 |
|---|---|---|
| Rafael, landing → Today (Recommend) | 13 | 13 |
| Correction from the review → recompiled review (hard bound 6 taps) | 6 | 6 |
| Avoid bench press from the review → recompiled review | 5 | 5 |
