# Hard rules for agent sessions

These are the standing owner rules for every agent session on this repository:
the coordinator that dispatches and merges, and the worker sessions ("fronts")
it launches. `AGENTS.md` links here and wins on any conflict. Briefs, skills
and memory link to this file and do not restate it. Rules 1–13 keep the
numbers that briefs and history already cite.

## Workspace

1. **Never touch the owner's checkout.** Work in your own fresh worktree off
   `origin/main` (or your existing branch), created from the machine's shared
   base clone. Never edit another session's worktree unless that session has
   handed it over (it says so, or reports it is blocked and asks the
   coordinator to finish). Link the test dependencies from the base clone and
   remove the link before committing. The concrete paths for a shared machine
   live in its environment notes, outside this repository.
2. **Test first.** Each behaviour change starts with a proof that fails for the
   stated reason, at the highest realistic boundary. Then the fix, then the
   proof passing. No arbitrary sleeps and no longer timeouts as a fix. Never
   weaken a still-valid assertion. `page.waitForFunction` takes no
   promise-returning predicate; use the helpers in `test/browser.mjs`
   (`test/ci.mjs` enforces this).
3. **Never reset, clean, stash or check out over uncommitted work.** Commit
   work in progress locally. Push only coherent, focused-test-green commits.
4. **index.html:** `tools/local-preview.mjs` snapshots and restores it around
   browser runs and can inject `posthog-config.js?v=local`. Edit it from
   `git show HEAD:index.html` and stage it with `git hash-object -w` plus
   `git update-index --cacheinfo`. After committing, check that
   `git show HEAD:index.html` has no `posthog-config` tag and that every
   versioned script is precached in `sw.js`.
5. **Revisions** follow `AGENTS.md`: a changed query-versioned script or
   stylesheet (including `i18n.js`, `styles.css` and `motion-polish.css`) gets a
   new `?v=` and its exact `sw.js` precache URL, which `test/asset-revisions.mjs`
   enforces against main; a shipped asset change bumps
   `CACHE` (`transitionAssets` in `test/exercise-library.mjs`). Parallel PRs
   share one revision line. Take the number `node tools/next-revision.mjs
   --pr <n>` prints, which sits above main and every other open PR's claim, or
   the number the coordinator assigns. Check it again at the final rebase.
   When resolving a rebase conflict, resolve only the revision lines by hand,
   never take a whole side of a file, and diff the result against the
   pre-rebase head before pushing.
6. **A new visible UI state** needs a catalog state (`tools/ui-screens/`), a
   `docs/ui-screens/manifest.json` entry and role-inventory entries in
   `tools/ui-role-inventory.json`. Never add it to the fixed Plan 064 list in
   `tools/check-rules-only.mjs`.
7. **Telemetry** has a closed schema (`telemetry.js`). Onboarding steps move
   through `ProgramEntry.advance/back` and `entrySetState`, and a new step id
   goes into `ROUTE_STEPS` and the telemetry `step` enum in the same PR. A step
   that asks a closed engine answer adds its `STEP_ANSWERS` line. The Basics
   (sex, birth date or age, height, weight, cardio experience) are never sent
   in any form. No free text, names or exact measurements.
8. **Privacy:** the Basics live only in the local profile (Settings, with a
   delete action). They are in backups and the install transfer, and never in
   setup links or telemetry.
9. **No model names** in commits, PR titles or bodies, code, comments or docs.
10. **A defect outside the packet is filed as an issue.** The packet does not
    widen.

## Verification

11. **Local testing is minimal** (owner, 2026-10-21). Locally, run only the
    single suite you are changing, to see its proof go red and then green.
    Multi-suite runs, `packet`/`all` lanes, UI-system or catalog sweeps,
    simulations, benchmarks and "verify everything" passes go to CI. The shared
    2-CPU devbox is an environment that cannot complete `packet` usefully in
    the sense of `AGENTS.md`. Recapture catalog frames only for the states your
    change affects, or fetch CI's frames with `tools/fetch-ci-captures.mjs`.
12. **Watch your own CI** (owner, 2026-10-23). After every push, start a
    background watch on your run and react to red at once. `ci-full` runs in the
    same workflow run after `ci`; check both, and never dispatch it by hand. Never sit idle
    on unwatched CI.
13. **A flake is a defect** (owner, 2026-10-23). A test that fails and then
    passes on the diagnostic replay is fixed in the same PR at its source:
    settle on real events and states, nothing time-based. Prove the fix with a
    10× loop of the single affected suite, or say in the PR why the loop was
    skipped (a deterministic cause, or a loop the devbox cannot finish).
    Never re-run to get green. One re-run is allowed only for an
    infrastructure failure where no test result exists, with the evidence in
    the PR.

## Shared machine

14. **Own processes only.** Kill only PIDs you started; never `pkill` by
    pattern. Stop every server, tunnel and browser you started when your work
    ends, and remove only your own worktrees and branches.
15. **One browser at a time.** On a shared machine, hold its machine-wide
    browser lock (`flock <lock>`) around every command that launches Chromium
    (run-tests, capture-ui-screens, check-ui-system). At most one browser-running helper agent per session.
16. **Parallelism is the owner's call.** Run only the number of fronts the
    owner has currently approved (the coordinator's queue records it). Under
    quota pressure or overnight, run one at a time. Check free disk before
    starting capture-heavy work.

## Merging and production

17. **Fronts never merge.** The coordinator merges under the owner's standing
    authority (2026-10-11) when all of these hold: `ci` and `ci-full` green on
    the final head, `mergeStateStatus` CLEAN, `baseRefName` is `main` (or the
    intended stack base), the diff matches the packet scope, the revisions sit
    above main, and the review verdict is ACCEPT. Use
    `gh pr merge <n> --merge --match-head-commit <sha>`. Product, design and
    copy decisions still go to the owner.
18. **Install-transfer Workers ship before the merge.** They bundle the
    validators in `program-entry.js`, `program-compiler.js` and
    `workout-draft.js`. A PR that changes a validator, the draft or profile
    shape, or `services/install-transfer/` is redeployed from its exact green
    head through `services/install-transfer/RUNBOOK.md` before it merges: one
    Worker at a time, on odd minutes, with the preflight probes and a fresh
    health status checked. Never deploy work in progress, and never print
    credentials.
19. **Visible UI changes pass the fidelity gate** before merge: production
    side by side with the approved prototype or mock, across the frame matrix
    in `.claude/skills/taurifer-fidelity-gate/SKILL.md`. Every visible
    difference is fixed or approved by the owner. New user-facing strings
    merge only as the owner approved them, in EN and PT.
