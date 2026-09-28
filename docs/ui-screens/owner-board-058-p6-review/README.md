# Plan 058 representative P6 visual board

- **Source base SHA:** 9ebab797829feaa4a84a35e604f6757aa9fd76c2
- **P6 production diff SHA-256:** 764aa6acd6fd03869ea37f8b0920ec2d9b5b05af2174328e9edfef6716c5d3b0 (app.js, index.html, styles.css; exact method and base are in `capture-manifest.json`)
- **Production capture source SHA:** `f5939f6d5e695d6982ec12f1cd1eddc64a2ac838`; the registered Today 200% scenario change and later CSS-only P6 cleanup are separately recorded in `capture-manifest.json`.
- **Generated:** 2026-09-28
- **Capture:** production scenarios from `tools/capture-ui-screens.mjs`; 57 representative frames from 23 selected screens. The registered Today-ready EN/PT-BR 200% states scroll the first exercise row into view, verify full 32px names, set values and dock clearance, then capture. All 57 passed catalog capture contracts.

**Board size:** 57 raw production PNGs across 12 surface groups. Screenshots are unmodified captures.

## Review lens

Please assess Taurifer identity, hierarchy, density, semantic consistency, action hierarchy, card/elevation restraint, selected and disabled treatment, outcome semantics, and responsive/localized coherence.

The selection covers first-run and program entry, Today, Focus and rest, Summary, Progress, History, Program, Share, Settings and guides, the exercise library, and install transfer. It includes light and dark themes, 320px and 390px phones, PT-BR, 200% text and PT-BR at 200%, plus empty, success, disabled, warning, invalid, and outcome states.

The approved P5 board remains preserved at [owner-board-058-p5](../owner-board-058-p5/). This P6 board differs perceptually in 43 of the 56 frames comparable with P5; 9 exceed the catalog comparator's material thresholds. The added Today EN 200% frame has no matching P5 frame. See `comparison-report.json` for per-frame metrics. The larger differences are concentrated in type-scale/reflow states. Both Today 200% locale frames now show the complete exercise name and prescribed values above the floating dock. The exhaustive 866-frame catalog regeneration remains P7 work.

## Frames

### Landing and first run

<table>
<tr><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-en.png"><img src="screens/onboarding-start/first-run__phone-390-light-en.png" width="230" alt="onboarding-start/first-run, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-dark-en.png"><img src="screens/onboarding-start/first-run__phone-390-dark-en.png" width="230" alt="onboarding-start/first-run, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-pt.png"><img src="screens/onboarding-start/first-run__phone-390-light-pt.png" width="230" alt="onboarding-start/first-run, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/onboarding-start/first-run__phone-320-light-en.png"><img src="screens/onboarding-start/first-run__phone-320-light-en.png" width="230" alt="onboarding-start/first-run, 320px · light · EN · standard text"></a><br><sub>320px · light · EN · standard text</sub></td><td align="center"><a href="screens/onboarding-start/first-run__phone-390-light-en-text200.png"><img src="screens/onboarding-start/first-run__phone-390-light-en-text200.png" width="230" alt="onboarding-start/first-run, 390px · light · EN · 200% text"></a><br><sub>390px · light · EN · 200% text</sub></td><td></td></tr>
</table>

### Program entry

<table>
<tr><td align="center"><a href="screens/onboarding-start/hub__phone-390-light-en.png"><img src="screens/onboarding-start/hub__phone-390-light-en.png" width="230" alt="onboarding-start/hub, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/onboarding-start/hub__phone-390-dark-en.png"><img src="screens/onboarding-start/hub__phone-390-dark-en.png" width="230" alt="onboarding-start/hub, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/onboarding-start/hub__phone-390-light-pt.png"><img src="screens/onboarding-start/hub__phone-390-light-pt.png" width="230" alt="onboarding-start/hub, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td></tr>
</table>

### Today

<table>
<tr><td align="center"><a href="screens/today/no-program__phone-390-light-en.png"><img src="screens/today/no-program__phone-390-light-en.png" width="230" alt="today/no-program, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/today/ready__phone-390-light-en.png"><img src="screens/today/ready__phone-390-light-en.png" width="230" alt="today/ready, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/today/ready__phone-390-dark-en.png"><img src="screens/today/ready__phone-390-dark-en.png" width="230" alt="today/ready, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/today/ready__phone-390-light-en-text200.png"><img src="screens/today/ready__phone-390-light-en-text200.png" width="230" alt="today/ready, 390px · light · EN · 200% text; exercise rows visible"></a><br><sub>390px · light · EN · 200% text</sub></td><td align="center"><a href="screens/today/ready__phone-390-light-pt-text200.png"><img src="screens/today/ready__phone-390-light-pt-text200.png" width="230" alt="today/ready, 390px · light · PT-BR · 200% text; exercise rows visible"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td></td></tr>
</table>

### Focus and rest timer

<table>
<tr><td align="center"><a href="screens/workout/focus__phone-390-light-en.png"><img src="screens/workout/focus__phone-390-light-en.png" width="230" alt="workout/focus, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/workout/focus__phone-390-dark-en.png"><img src="screens/workout/focus__phone-390-dark-en.png" width="230" alt="workout/focus, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/workout/focus__phone-320-light-en.png"><img src="screens/workout/focus__phone-320-light-en.png" width="230" alt="workout/focus, 320px · light · EN · standard text"></a><br><sub>320px · light · EN · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/workout/focus__phone-390-light-pt-text200.png"><img src="screens/workout/focus__phone-390-light-pt-text200.png" width="230" alt="workout/focus, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td align="center"><a href="screens/workout/rest-timer__phone-390-dark-en.png"><img src="screens/workout/rest-timer__phone-390-dark-en.png" width="230" alt="workout/rest-timer, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/workout/rest-timer__phone-390-light-pt-text200.png"><img src="screens/workout/rest-timer__phone-390-light-pt-text200.png" width="230" alt="workout/rest-timer, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td></tr>
</table>

### Session summary and outcome

<table>
<tr><td align="center"><a href="screens/session/summary__phone-390-light-en.png"><img src="screens/session/summary__phone-390-light-en.png" width="230" alt="session/summary, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/session/summary__phone-390-dark-en.png"><img src="screens/session/summary__phone-390-dark-en.png" width="230" alt="session/summary, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/session/summary-declined__phone-390-light-en.png"><img src="screens/session/summary-declined__phone-390-light-en.png" width="230" alt="session/summary-declined, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/session/summary-declined__phone-390-light-pt-text200.png"><img src="screens/session/summary-declined__phone-390-light-pt-text200.png" width="230" alt="session/summary-declined, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td></td><td></td></tr>
</table>

### Progress

<table>
<tr><td align="center"><a href="screens/progress/overview-action__phone-390-light-en.png"><img src="screens/progress/overview-action__phone-390-light-en.png" width="230" alt="progress/overview-action, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/progress/overview-action__phone-390-dark-en.png"><img src="screens/progress/overview-action__phone-390-dark-en.png" width="230" alt="progress/overview-action, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/progress/recovery-preview__phone-390-light-en.png"><img src="screens/progress/recovery-preview__phone-390-light-en.png" width="230" alt="progress/recovery-preview, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/progress/recovery-preview__phone-320-light-en.png"><img src="screens/progress/recovery-preview__phone-320-light-en.png" width="230" alt="progress/recovery-preview, 320px · light · EN · standard text"></a><br><sub>320px · light · EN · standard text</sub></td><td align="center"><a href="screens/progress/recovery-preview__phone-390-light-pt-text200.png"><img src="screens/progress/recovery-preview__phone-390-light-pt-text200.png" width="230" alt="progress/recovery-preview, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td></td></tr>
</table>

### History

<table>
<tr><td align="center"><a href="screens/history/list__phone-390-light-en.png"><img src="screens/history/list__phone-390-light-en.png" width="230" alt="history/list, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/history/list__phone-390-dark-en.png"><img src="screens/history/list__phone-390-dark-en.png" width="230" alt="history/list, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/history/list__phone-390-light-pt.png"><img src="screens/history/list__phone-390-light-pt.png" width="230" alt="history/list, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/history/edit-invalid__phone-390-light-en.png"><img src="screens/history/edit-invalid__phone-390-light-en.png" width="230" alt="history/edit-invalid, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/history/edit-invalid__phone-390-light-pt-text200.png"><img src="screens/history/edit-invalid__phone-390-light-pt-text200.png" width="230" alt="history/edit-invalid, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td></td></tr>
</table>

### Program

<table>
<tr><td align="center"><a href="screens/program/overview__phone-390-light-en.png"><img src="screens/program/overview__phone-390-light-en.png" width="230" alt="program/overview, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/program/overview__phone-390-dark-en.png"><img src="screens/program/overview__phone-390-dark-en.png" width="230" alt="program/overview, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/program/progression-editor__phone-390-light-en.png"><img src="screens/program/progression-editor__phone-390-light-en.png" width="230" alt="program/progression-editor, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/program/progression-editor__phone-390-light-pt.png"><img src="screens/program/progression-editor__phone-390-light-pt.png" width="230" alt="program/progression-editor, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td><td align="center"><a href="screens/program/exercise-picker__phone-390-light-en.png"><img src="screens/program/exercise-picker__phone-390-light-en.png" width="230" alt="program/exercise-picker, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td></td></tr>
</table>

### Share

<table>
<tr><td align="center"><a href="screens/program/share-ready__phone-390-light-en.png"><img src="screens/program/share-ready__phone-390-light-en.png" width="230" alt="program/share-ready, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/program/share-ready__phone-390-dark-en.png"><img src="screens/program/share-ready__phone-390-dark-en.png" width="230" alt="program/share-ready, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/program/share-ready__phone-390-light-pt-text200.png"><img src="screens/program/share-ready__phone-390-light-pt-text200.png" width="230" alt="program/share-ready, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td></tr>
<tr><td align="center"><a href="screens/program/share-one-blocker__phone-390-light-en.png"><img src="screens/program/share-one-blocker__phone-390-light-en.png" width="230" alt="program/share-one-blocker, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/program/share-one-blocker__phone-390-light-pt-text200.png"><img src="screens/program/share-one-blocker__phone-390-light-pt-text200.png" width="230" alt="program/share-one-blocker, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td><td></td></tr>
</table>

### Settings and guides

<table>
<tr><td align="center"><a href="screens/settings/main__phone-390-light-en.png"><img src="screens/settings/main__phone-390-light-en.png" width="230" alt="settings/main, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/settings/main__phone-390-dark-en.png"><img src="screens/settings/main__phone-390-dark-en.png" width="230" alt="settings/main, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/settings/main__phone-390-light-pt.png"><img src="screens/settings/main__phone-390-light-pt.png" width="230" alt="settings/main, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/settings/guides-replay__phone-390-light-en.png"><img src="screens/settings/guides-replay__phone-390-light-en.png" width="230" alt="settings/guides-replay, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/settings/guides-replay__phone-390-light-pt.png"><img src="screens/settings/guides-replay__phone-390-light-pt.png" width="230" alt="settings/guides-replay, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td><td align="center"><a href="screens/settings/privacy-disclosure__phone-390-light-pt-text200.png"><img src="screens/settings/privacy-disclosure__phone-390-light-pt-text200.png" width="230" alt="settings/privacy-disclosure, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td></tr>
</table>

### Exercise library

<table>
<tr><td align="center"><a href="screens/library/list__phone-390-light-en.png"><img src="screens/library/list__phone-390-light-en.png" width="230" alt="library/list, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/library/list__phone-390-dark-en.png"><img src="screens/library/list__phone-390-dark-en.png" width="230" alt="library/list, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/library/list__phone-390-light-pt.png"><img src="screens/library/list__phone-390-light-pt.png" width="230" alt="library/list, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td></tr>
<tr><td align="center"><a href="screens/library/exercise-detail__phone-390-light-en.png"><img src="screens/library/exercise-detail__phone-390-light-en.png" width="230" alt="library/exercise-detail, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/library/exercise-detail__phone-390-light-pt.png"><img src="screens/library/exercise-detail__phone-390-light-pt.png" width="230" alt="library/exercise-detail, 390px · light · PT-BR · standard text"></a><br><sub>390px · light · PT-BR · standard text</sub></td><td></td></tr>
</table>

### Install and transfer

<table>
<tr><td align="center"><a href="screens/install/transfer-ready__phone-390-light-en.png"><img src="screens/install/transfer-ready__phone-390-light-en.png" width="230" alt="install/transfer-ready, 390px · light · EN · standard text"></a><br><sub>390px · light · EN · standard text</sub></td><td align="center"><a href="screens/install/transfer-ready__phone-390-dark-en.png"><img src="screens/install/transfer-ready__phone-390-dark-en.png" width="230" alt="install/transfer-ready, 390px · dark · EN · standard text"></a><br><sub>390px · dark · EN · standard text</sub></td><td align="center"><a href="screens/install/transfer-ready__phone-390-light-pt-text200.png"><img src="screens/install/transfer-ready__phone-390-light-pt-text200.png" width="230" alt="install/transfer-ready, 390px · light · PT-BR · 200% text"></a><br><sub>390px · light · PT-BR · 200% text</sub></td></tr>
</table>

---

Pedro's recorded approval applies to the P5 board at [owner-board-058-p5](../owner-board-058-p5/), which establishes the intended Taurifer visual direction and authorizes P6. This P6 board is refreshed representative evidence, not a separate owner approval. It contains 57 unmodified production captures from the source and registered scenario SHAs recorded in `capture-manifest.json`; the additional frame is Today-ready EN at 200% text. The two Today 200% captures verify complete exercise names and values above the floating dock. P6 corrections preserve the approved hierarchy and system direction; no renewed owner review is requested for these reflow/clearance fixes.
