---
name: taurifer-rebump
description: "Rebase a Taurifer PR onto a moved main and re-bump its CACHE and script revisions without losing code: take the next free revision from tools/next-revision.mjs, resolve only the revision lines by hand, re-stage index.html from a blob, and diff against the pre-rebase head. Use when a PR goes DIRTY after another merge, or a coordinator says 'rebase and re-bump'."
disable-model-invocation: true
---

# Taurifer rebase and re-bump

This is the procedure for hard rules 4 and 5 in `docs/agents/hard-rules.md`. Parallel PRs collide on the same revision lines in `index.html` and `sw.js` after almost every merge. Two failures recur: a revision that ties with another open PR, and real code lost while resolving a conflict. #605 lost button markup when a front took main's side, and a landing PR silently lost its dark-panel code.

## 1. Record the starting point

```bash
git fetch origin main
OLD=$(git rev-parse HEAD)
```

## 2. Pick the revision

```bash
node tools/next-revision.mjs --pr <your PR number>
```

It prints main's revision, every open PR's claim, any collisions, and `next`. Use `next` for every revision line your PR bumps, unless the coordinator assigned a number or a merge order. `AGENTS.md` and `transitionAssets` in `test/exercise-library.mjs` decide which scripts need a new `?v=` and when `CACHE` moves. Each listed script's `index.html` URL, its exact `sw.js` precache URL and the test's expected revision move together.

## 3. Rebase or merge main

Keep whichever the branch already uses; a stacked PR keeps its base. On conflict:

- **Revision lines:** resolve by hand to the number from step 2.
- **Everything else:** resolve hunk by hand, keeping both sides' intent.
- **Never** run `git checkout --ours/--theirs` on a whole file, and never take a side of `index.html`.

Edit `index.html` from `git show HEAD:index.html` and stage it with `git hash-object -w` plus `git update-index --cacheinfo`. Then check that `git show HEAD:index.html` has no `posthog-config` tag.

## 4. Prove nothing was lost

```bash
git range-diff origin/main $OLD HEAD
```

Apart from the revision lines and anything main changed underneath you, each commit's diff must be the same as before. A hunk that disappeared means the conflict resolution dropped it. Restore it before pushing.

## 5. Push and report

- Locally, run only the one suite that owns the conflicted area, if any (rule 11). CI does the rest.
- Push your own branch with `--force-with-lease`.
- Tell the coordinator the new head SHA, the revision you took, and "range-diff clean apart from revision lines". If catalog frames changed only because of the new main, say so, so the reviewer does not judge them again.
- Then follow `ci-watch-and-flakes`.
