# Plan 058 representative P7 visual board

- **Board capture source SHA:** e5bca41c5cb017c3cd161e8a880237a3c94a5de7
- **Current merge-candidate production source SHA:** 0eec72030c7df79fbd90825d4453cdd2e0e8a486 — the post-P7 install-title accessibility correction refreshes exactly one selected frame (`install/transfer-ready` PT-BR 200%) and leaves the other 64 unchanged.
- **Generated:** 2026-09-29 from the complete P7 catalog.
- **Catalog:** 148 screens / 915 registered frames; semantic snapshot ea8535acc3540c911c4dfbb434656614f5523c79d4b6cb4e870e2ca6a831fdaa.
- **Board:** 65 production frames across 30 screens. Every board PNG remains byte-for-byte identical to its final-catalog source; no screenshot was hand-edited.
- **Owner approval:** Pedro approved the P5 board at source SHA `dd70f11ad0e6a4bca8a491c7f37b3296d83c3166` as the intended visual direction.
- **Full-catalog delta:** against the 898-frame P6 baseline, 625 common frames are byte-identical and 273 are byte-changed; 17 frames are added and none removed. At the current merge-candidate source, 8 comparisons exceed generic historical-baseline thresholds: the 2 reviewed Today/ready 200% framing changes plus 6 intentional install-transfer 200% title-reflow frames. All have explicit dispositions in the inventory. The earlier immutable e5 same-source recapture remains historical evidence: 906/915 frames were byte-identical and 9 differed, all within thresholds with exact semantics.
- **P5 comparison:** 56 comparable frames, 9 representative frames without a P5 match (seven existing P7 additions plus two paused-timer variants); 49 are within thresholds and 7 exceedances are reviewed. The added exceedance is the intentional PT-BR 200% install-title accessibility reflow. See [comparison-report.json](comparison-report.json).
- **Exact frame delta:** [catalog-change-inventory.json](catalog-change-inventory.json).

## Review lens

Assess Taurifer identity, hierarchy, density, semantic consistency, action hierarchy, card/elevation restraint, selected and disabled treatment, outcome semantics, and responsive/localized coherence. This selection is representative; P7 records every frame-level delta. Coverage includes EN/PT-BR, light/dark, 320/390/430 px phones, normal/200% text, reduced motion, and registered install/transfer states. Service-worker/cache behavior is separately covered by upgrade/offline evidence. Desktop is outside the mobile-only catalog.

The final install-title correction reflows ten registered install screenshots at enlarged text. One selected board frame (`install/transfer-ready` PT-BR 200%) is refreshed to match production; the other 64 board frames remain unchanged. The refreshed frame preserves the same sheet hierarchy/actions and differs only because enlarged localized copy now wraps instead of clipping. The program-entry threshold exceedances preserve the approved title, four-route order, featured action, and action hierarchy. The PT-BR 200% Today, Progress, and privacy frames show corrected reflow with content and actions reachable. The final Today/ready PT-BR 200% frame places the full exercise row above the persistent dock; the two-row dock and four actions retain their approved hierarchy. The two added paused-timer frames show the required boundary in dark mode and the PT-BR 200% layout with all timer actions visible. The P5 approval remains the visual-direction decision; no renewed approval was needed.

## Landing and program entry

<table>
<tr><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-en.png"><img src="screens/onboarding-start/first-run__phone-390-light-en.png" width="230" alt="onboarding-start/first-run, 390 px · light · EN"></a><br><sub>onboarding-start/first-run · 390 px · light · EN</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-dark-en.png"><img src="screens/onboarding-start/first-run__phone-390-dark-en.png" width="230" alt="onboarding-start/first-run, 390 px · dark · EN"></a><br><sub>onboarding-start/first-run · 390 px · dark · EN</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-pt.png"><img src="screens/onboarding-start/first-run__phone-390-light-pt.png" width="230" alt="onboarding-start/first-run, 390 px · light · PT-BR"></a><br><sub>onboarding-start/first-run · 390 px · light · PT-BR</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/onboarding-start/first-run__phone-320-light-en.png"><img src="screens/onboarding-start/first-run__phone-320-light-en.png" width="230" alt="onboarding-start/first-run, 320 px · light · EN"></a><br><sub>onboarding-start/first-run · 320 px · light · EN</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-en-text200.png"><img src="screens/onboarding-start/first-run__phone-390-light-en-text200.png" width="230" alt="onboarding-start/first-run, 390 px · light · EN · 200% text"></a><br><sub>onboarding-start/first-run · 390 px · light · EN · 200% text</sub></td><td align="center"><a href="screens/onboarding-start/hub__phone-390-light-en.png"><img src="screens/onboarding-start/hub__phone-390-light-en.png" width="230" alt="onboarding-start/hub, 390 px · light · EN"></a><br><sub>onboarding-start/hub · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/onboarding-start/hub__phone-390-dark-en.png"><img src="screens/onboarding-start/hub__phone-390-dark-en.png" width="230" alt="onboarding-start/hub, 390 px · dark · EN"></a><br><sub>onboarding-start/hub · 390 px · dark · EN</sub></td><td align="center"><a href="screens/onboarding-start/hub__phone-390-light-pt.png"><img src="screens/onboarding-start/hub__phone-390-light-pt.png" width="230" alt="onboarding-start/hub, 390 px · light · PT-BR"></a><br><sub>onboarding-start/hub · 390 px · light · PT-BR</sub></td></tr>
</table>

## Build editor

<table>
<tr><td align="center"><a href="screens/onboarding-build/editor-empty__phone-390-light-en-text200.png"><img src="screens/onboarding-build/editor-empty__phone-390-light-en-text200.png" width="230" alt="onboarding-build/editor-empty, 390 px · light · EN · 200% text"></a><br><sub>onboarding-build/editor-empty · 390 px · light · EN · 200% text</sub></td><td align="center"><a href="screens/onboarding-build/editor-ready__phone-390-light-pt-text200.png"><img src="screens/onboarding-build/editor-ready__phone-390-light-pt-text200.png" width="230" alt="onboarding-build/editor-ready, 390 px · light · PT-BR · 200% text"></a><br><sub>onboarding-build/editor-ready · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Today

<table>
<tr><td align="center"><a href="screens/today/no-program__phone-390-light-en.png"><img src="screens/today/no-program__phone-390-light-en.png" width="230" alt="today/no-program, 390 px · light · EN"></a><br><sub>today/no-program · 390 px · light · EN</sub></td><td align="center"><a href="screens/today/ready__phone-390-light-en.png"><img src="screens/today/ready__phone-390-light-en.png" width="230" alt="today/ready, 390 px · light · EN"></a><br><sub>today/ready · 390 px · light · EN</sub></td><td align="center"><a href="screens/today/ready__phone-390-dark-en.png"><img src="screens/today/ready__phone-390-dark-en.png" width="230" alt="today/ready, 390 px · dark · EN"></a><br><sub>today/ready · 390 px · dark · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/today/ready__phone-390-light-en-text200.png"><img src="screens/today/ready__phone-390-light-en-text200.png" width="230" alt="today/ready, 390 px · light · EN · 200% text"></a><br><sub>today/ready · 390 px · light · EN · 200% text</sub></td><td align="center"><a href="screens/today/ready__phone-390-light-pt-text200.png"><img src="screens/today/ready__phone-390-light-pt-text200.png" width="230" alt="today/ready, 390 px · light · PT-BR · 200% text"></a><br><sub>today/ready · 390 px · light · PT-BR · 200% text</sub></td><td align="center"><a href="screens/today/rest-bar__phone-390-light-pt-text200.png"><img src="screens/today/rest-bar__phone-390-light-pt-text200.png" width="230" alt="today/rest-bar, 390 px · light · PT-BR · 200% text"></a><br><sub>today/rest-bar · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Focus and rest

<table>
<tr><td align="center"><a href="screens/workout/focus__phone-390-light-en.png"><img src="screens/workout/focus__phone-390-light-en.png" width="230" alt="workout/focus, 390 px · light · EN"></a><br><sub>workout/focus · 390 px · light · EN</sub></td><td align="center"><a href="screens/workout/focus__phone-390-dark-en.png"><img src="screens/workout/focus__phone-390-dark-en.png" width="230" alt="workout/focus, 390 px · dark · EN"></a><br><sub>workout/focus · 390 px · dark · EN</sub></td><td align="center"><a href="screens/workout/focus__phone-320-light-en.png"><img src="screens/workout/focus__phone-320-light-en.png" width="230" alt="workout/focus, 320 px · light · EN"></a><br><sub>workout/focus · 320 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/workout/focus__phone-390-light-pt-text200.png"><img src="screens/workout/focus__phone-390-light-pt-text200.png" width="230" alt="workout/focus, 390 px · light · PT-BR · 200% text"></a><br><sub>workout/focus · 390 px · light · PT-BR · 200% text</sub></td><td align="center"><a href="screens/workout/rest-timer__phone-390-dark-en.png"><img src="screens/workout/rest-timer__phone-390-dark-en.png" width="230" alt="workout/rest-timer, 390 px · dark · EN"></a><br><sub>workout/rest-timer · 390 px · dark · EN</sub></td><td align="center"><a href="screens/workout/rest-timer__phone-390-light-pt-text200.png"><img src="screens/workout/rest-timer__phone-390-light-pt-text200.png" width="230" alt="workout/rest-timer, 390 px · light · PT-BR · 200% text"></a><br><sub>workout/rest-timer · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/workout/rest-timer-paused__phone-390-dark-en.png"><img src="screens/workout/rest-timer-paused__phone-390-dark-en.png" width="230" alt="workout/rest-timer-paused, 390 px · dark · EN"></a><br><sub>workout/rest-timer-paused · 390 px · dark · EN</sub></td><td align="center"><a href="screens/workout/rest-timer-paused__phone-390-light-pt-text200.png"><img src="screens/workout/rest-timer-paused__phone-390-light-pt-text200.png" width="230" alt="workout/rest-timer-paused, 390 px · light · PT-BR · 200% text"></a><br><sub>workout/rest-timer-paused · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/workout/focus-glossary__phone-390-light-pt-text200.png"><img src="screens/workout/focus-glossary__phone-390-light-pt-text200.png" width="230" alt="workout/focus-glossary, 390 px · light · PT-BR · 200% text"></a><br><sub>workout/focus-glossary · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Summary and outcomes

<table>
<tr><td align="center"><a href="screens/session/summary__phone-390-light-en.png"><img src="screens/session/summary__phone-390-light-en.png" width="230" alt="session/summary, 390 px · light · EN"></a><br><sub>session/summary · 390 px · light · EN</sub></td><td align="center"><a href="screens/session/summary__phone-390-dark-en.png"><img src="screens/session/summary__phone-390-dark-en.png" width="230" alt="session/summary, 390 px · dark · EN"></a><br><sub>session/summary · 390 px · dark · EN</sub></td><td align="center"><a href="screens/session/summary-declined__phone-390-light-en.png"><img src="screens/session/summary-declined__phone-390-light-en.png" width="230" alt="session/summary-declined, 390 px · light · EN"></a><br><sub>session/summary-declined · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/session/summary-declined__phone-390-light-pt-text200.png"><img src="screens/session/summary-declined__phone-390-light-pt-text200.png" width="230" alt="session/summary-declined, 390 px · light · PT-BR · 200% text"></a><br><sub>session/summary-declined · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Progress

<table>
<tr><td align="center"><a href="screens/progress/overview-action__phone-390-light-en.png"><img src="screens/progress/overview-action__phone-390-light-en.png" width="230" alt="progress/overview-action, 390 px · light · EN"></a><br><sub>progress/overview-action · 390 px · light · EN</sub></td><td align="center"><a href="screens/progress/overview-action__phone-390-dark-en.png"><img src="screens/progress/overview-action__phone-390-dark-en.png" width="230" alt="progress/overview-action, 390 px · dark · EN"></a><br><sub>progress/overview-action · 390 px · dark · EN</sub></td><td align="center"><a href="screens/progress/recovery-preview__phone-390-light-en.png"><img src="screens/progress/recovery-preview__phone-390-light-en.png" width="230" alt="progress/recovery-preview, 390 px · light · EN"></a><br><sub>progress/recovery-preview · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/progress/recovery-preview__phone-320-light-en.png"><img src="screens/progress/recovery-preview__phone-320-light-en.png" width="230" alt="progress/recovery-preview, 320 px · light · EN"></a><br><sub>progress/recovery-preview · 320 px · light · EN</sub></td><td align="center"><a href="screens/progress/recovery-preview__phone-390-light-pt-text200.png"><img src="screens/progress/recovery-preview__phone-390-light-pt-text200.png" width="230" alt="progress/recovery-preview, 390 px · light · PT-BR · 200% text"></a><br><sub>progress/recovery-preview · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## History

<table>
<tr><td align="center"><a href="screens/history/list__phone-390-light-en.png"><img src="screens/history/list__phone-390-light-en.png" width="230" alt="history/list, 390 px · light · EN"></a><br><sub>history/list · 390 px · light · EN</sub></td><td align="center"><a href="screens/history/list__phone-390-dark-en.png"><img src="screens/history/list__phone-390-dark-en.png" width="230" alt="history/list, 390 px · dark · EN"></a><br><sub>history/list · 390 px · dark · EN</sub></td><td align="center"><a href="screens/history/list__phone-390-light-pt.png"><img src="screens/history/list__phone-390-light-pt.png" width="230" alt="history/list, 390 px · light · PT-BR"></a><br><sub>history/list · 390 px · light · PT-BR</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/history/edit-invalid__phone-390-light-en.png"><img src="screens/history/edit-invalid__phone-390-light-en.png" width="230" alt="history/edit-invalid, 390 px · light · EN"></a><br><sub>history/edit-invalid · 390 px · light · EN</sub></td><td align="center"><a href="screens/history/edit-invalid__phone-390-light-pt-text200.png"><img src="screens/history/edit-invalid__phone-390-light-pt-text200.png" width="230" alt="history/edit-invalid, 390 px · light · PT-BR · 200% text"></a><br><sub>history/edit-invalid · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Program and Share

<table>
<tr><td align="center"><a href="screens/program/overview__phone-390-light-en.png"><img src="screens/program/overview__phone-390-light-en.png" width="230" alt="program/overview, 390 px · light · EN"></a><br><sub>program/overview · 390 px · light · EN</sub></td><td align="center"><a href="screens/program/overview__phone-390-dark-en.png"><img src="screens/program/overview__phone-390-dark-en.png" width="230" alt="program/overview, 390 px · dark · EN"></a><br><sub>program/overview · 390 px · dark · EN</sub></td><td align="center"><a href="screens/program/progression-editor__phone-390-light-en.png"><img src="screens/program/progression-editor__phone-390-light-en.png" width="230" alt="program/progression-editor, 390 px · light · EN"></a><br><sub>program/progression-editor · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/program/progression-editor__phone-390-light-pt.png"><img src="screens/program/progression-editor__phone-390-light-pt.png" width="230" alt="program/progression-editor, 390 px · light · PT-BR"></a><br><sub>program/progression-editor · 390 px · light · PT-BR</sub></td><td align="center"><a href="screens/program/exercise-picker__phone-390-light-en.png"><img src="screens/program/exercise-picker__phone-390-light-en.png" width="230" alt="program/exercise-picker, 390 px · light · EN"></a><br><sub>program/exercise-picker · 390 px · light · EN</sub></td><td align="center"><a href="screens/program/share-ready__phone-390-light-en.png"><img src="screens/program/share-ready__phone-390-light-en.png" width="230" alt="program/share-ready, 390 px · light · EN"></a><br><sub>program/share-ready · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/program/share-ready__phone-390-dark-en.png"><img src="screens/program/share-ready__phone-390-dark-en.png" width="230" alt="program/share-ready, 390 px · dark · EN"></a><br><sub>program/share-ready · 390 px · dark · EN</sub></td><td align="center"><a href="screens/program/share-ready__phone-390-light-pt-text200.png"><img src="screens/program/share-ready__phone-390-light-pt-text200.png" width="230" alt="program/share-ready, 390 px · light · PT-BR · 200% text"></a><br><sub>program/share-ready · 390 px · light · PT-BR · 200% text</sub></td><td align="center"><a href="screens/program/share-one-blocker__phone-390-light-en.png"><img src="screens/program/share-one-blocker__phone-390-light-en.png" width="230" alt="program/share-one-blocker, 390 px · light · EN"></a><br><sub>program/share-one-blocker · 390 px · light · EN</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/program/share-one-blocker__phone-390-light-pt-text200.png"><img src="screens/program/share-one-blocker__phone-390-light-pt-text200.png" width="230" alt="program/share-one-blocker, 390 px · light · PT-BR · 200% text"></a><br><sub>program/share-one-blocker · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Settings and help

<table>
<tr><td align="center"><a href="screens/settings/main__phone-390-light-en.png"><img src="screens/settings/main__phone-390-light-en.png" width="230" alt="settings/main, 390 px · light · EN"></a><br><sub>settings/main · 390 px · light · EN</sub></td><td align="center"><a href="screens/settings/main__phone-390-dark-en.png"><img src="screens/settings/main__phone-390-dark-en.png" width="230" alt="settings/main, 390 px · dark · EN"></a><br><sub>settings/main · 390 px · dark · EN</sub></td><td align="center"><a href="screens/settings/main__phone-390-light-pt.png"><img src="screens/settings/main__phone-390-light-pt.png" width="230" alt="settings/main, 390 px · light · PT-BR"></a><br><sub>settings/main · 390 px · light · PT-BR</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/settings/guides-replay__phone-390-light-en.png"><img src="screens/settings/guides-replay__phone-390-light-en.png" width="230" alt="settings/guides-replay, 390 px · light · EN"></a><br><sub>settings/guides-replay · 390 px · light · EN</sub></td><td align="center"><a href="screens/settings/guides-replay__phone-390-light-pt.png"><img src="screens/settings/guides-replay__phone-390-light-pt.png" width="230" alt="settings/guides-replay, 390 px · light · PT-BR"></a><br><sub>settings/guides-replay · 390 px · light · PT-BR</sub></td><td align="center"><a href="screens/settings/privacy-disclosure__phone-390-light-pt-text200.png"><img src="screens/settings/privacy-disclosure__phone-390-light-pt-text200.png" width="230" alt="settings/privacy-disclosure, 390 px · light · PT-BR · 200% text"></a><br><sub>settings/privacy-disclosure · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Exercise library

<table>
<tr><td align="center"><a href="screens/library/list__phone-390-light-en.png"><img src="screens/library/list__phone-390-light-en.png" width="230" alt="library/list, 390 px · light · EN"></a><br><sub>library/list · 390 px · light · EN</sub></td><td align="center"><a href="screens/library/list__phone-390-dark-en.png"><img src="screens/library/list__phone-390-dark-en.png" width="230" alt="library/list, 390 px · dark · EN"></a><br><sub>library/list · 390 px · dark · EN</sub></td><td align="center"><a href="screens/library/list__phone-390-light-pt.png"><img src="screens/library/list__phone-390-light-pt.png" width="230" alt="library/list, 390 px · light · PT-BR"></a><br><sub>library/list · 390 px · light · PT-BR</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/library/exercise-detail__phone-390-light-en.png"><img src="screens/library/exercise-detail__phone-390-light-en.png" width="230" alt="library/exercise-detail, 390 px · light · EN"></a><br><sub>library/exercise-detail · 390 px · light · EN</sub></td><td align="center"><a href="screens/library/exercise-detail__phone-390-light-pt.png"><img src="screens/library/exercise-detail__phone-390-light-pt.png" width="230" alt="library/exercise-detail, 390 px · light · PT-BR"></a><br><sub>library/exercise-detail · 390 px · light · PT-BR</sub></td><td align="center"><a href="screens/library/list-selected__phone-390-light-pt-text200.png"><img src="screens/library/list-selected__phone-390-light-pt-text200.png" width="230" alt="library/list-selected, 390 px · light · PT-BR · 200% text"></a><br><sub>library/list-selected · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

<table>
<tr><td align="center"><a href="screens/library/exercise-detail-glossary__phone-390-light-pt-text200.png"><img src="screens/library/exercise-detail-glossary__phone-390-light-pt-text200.png" width="230" alt="library/exercise-detail-glossary, 390 px · light · PT-BR · 200% text"></a><br><sub>library/exercise-detail-glossary · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Install and transfer

<table>
<tr><td align="center"><a href="screens/install/transfer-ready__phone-390-light-en.png"><img src="screens/install/transfer-ready__phone-390-light-en.png" width="230" alt="install/transfer-ready, 390 px · light · EN"></a><br><sub>install/transfer-ready · 390 px · light · EN</sub></td><td align="center"><a href="screens/install/transfer-ready__phone-390-dark-en.png"><img src="screens/install/transfer-ready__phone-390-dark-en.png" width="230" alt="install/transfer-ready, 390 px · dark · EN"></a><br><sub>install/transfer-ready · 390 px · dark · EN</sub></td><td align="center"><a href="screens/install/transfer-ready__phone-390-light-pt-text200.png"><img src="screens/install/transfer-ready__phone-390-light-pt-text200.png" width="230" alt="install/transfer-ready, 390 px · light · PT-BR · 200% text"></a><br><sub>install/transfer-ready · 390 px · light · PT-BR · 200% text</sub></td></tr>
</table>

## Evidence files

- [capture-manifest.json](capture-manifest.json): source SHA, approval provenance, frame selection, and PNG hashes.
- [catalog-change-inventory.json](catalog-change-inventory.json): all byte-changed catalog frames and pixel metrics.
- [comparison-report.json](comparison-report.json): P5 comparison metrics and dispositions.
