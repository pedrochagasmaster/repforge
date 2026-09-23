# Plan 011: CI runs the i18n generator's drift check, and the check names what drifted

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- tools/build-i18n.mjs test/suites.mjs docs/ci.md`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

`i18n.js` is generated from `i18n-en.json`, `i18n-pt.json`, **and `tools/i18n-runtime.js`** by `node tools/build-i18n.mjs`. `AGENTS.md` says "`--check` fails when the three files drift", but **no CI job runs it**: it is absent from `test/suites.mjs`, the single CI inventory. `test/i18n.mjs` does compare the JSON catalogs with the runtime dictionaries, so string drift is caught. An edit to `tools/i18n-runtime.js` (the `t()`/`setLang` runtime) without regenerating is **not** caught, and neither is a hand-edit to the runtime part of `i18n.js`. When `--check` does fail locally, it prints only "i18n.js is stale" with no indication of what differs.

## Current state

`tools/build-i18n.mjs` (43 lines):

```js
const out = [
  "// Taurifer i18n — English / Portuguese UI strings.",
  "// Generated from i18n-en.json + i18n-pt.json + tools/i18n-runtime.js; edit those and regenerate.",
  render("EN", en),
  render("PT", pt),
  runtime,
  "",
].join("\n");

if (process.argv.includes("--check")) {
  if (out !== src) {
    console.error("i18n.js is stale — run: node tools/build-i18n.mjs");
    process.exit(1);
  }
  console.log(`i18n.js matches the catalogs (${Object.keys(en).length} keys)`);
  process.exit(0);
}
```

`render(name,obj)` emits `const EN = {` / `const PT = {`, then one line per key in the form `  "key": "value",`, then `};`. `ROOT` is fixed to the repo root.

The exemplar for good `--check` output is `tools/build-vendor-runtimes.mjs:80-116`. It collects a `problems[]` array, prints each as `  ✗ <file>: <what>`, then prints one remediation line and exits 1.

`test/suites.mjs` registers generator checks in the fast lane like this: `s("tools/build-program-family-fixtures.mjs", ["--check"]),` (line 93) and `s("tools/move-draft-store-owner.mjs", ["--check"]),` (line 23). `docs/ci.md` states command counts ("The inventory currently contains N commands: fast (M), …").

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Check | `node tools/build-i18n.mjs --check` | `i18n.js matches the catalogs (N keys)`, exit 0 |
| Inventory | `node tools/run-tests.mjs --check` | exit 0 |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |

## Scope

**In scope:** `tools/build-i18n.mjs`, `test/suites.mjs`, `docs/ci.md`.
**Out of scope:** `i18n.js` (generated; must be byte-identical before and after), the JSON catalogs, `tools/i18n-runtime.js`, and `test/i18n.mjs`.

## Git workflow

Branch `advisor/011-i18n-check`; commits `feat(tools): name drifted keys in build-i18n --check` and `ci: run the i18n generator drift check in the fast lane`. Do not push.

## Steps

### Step 1: Diagnostic output

In the `--check` branch, when `out !== src`, compute the problems before exiting. Split both texts into lines and walk them while tracking the current section: `EN` after the line `const EN = {`, `PT` after `const PT = {`, and `runtime` after the PT block's closing `};`. For each section, compare the multiset of lines:
- A key line (`/^  ("(?:[^"\\]|\\.)*"):/`) that exists in `out` but differs or is missing in `src` → `  ✗ i18n.js <SECTION>: key <key> differs from the catalog`.
- A key present in `src` but not in `out` → `  ✗ i18n.js <SECTION>: key <key> is not in the catalog`.
- Any differing non-key line in the runtime section → one line: `  ✗ i18n.js runtime: differs from tools/i18n-runtime.js (first difference at i18n.js line <n>)`.

Print at most 20 problems, then `  … and <k> more` if applicable, then the existing remediation line. Keep the exit code at 1. Use only `node:` built-ins.

**Verify**: `node tools/build-i18n.mjs --check` → still exit 0 on the clean tree. Then run the three negative controls below **on a scratch copy** so that tracked files are never modified: `cp -r` the four inputs (`i18n.js`, `i18n-en.json`, `i18n-pt.json`, `tools/i18n-runtime.js`) into a temp dir mirroring the layout, together with a copy of `tools/build-i18n.mjs`, and run the copied tool there (its `ROOT` resolves relative to its own location):
1. Change one EN value in the scratch `i18n-en.json` → the output names that key under EN.
2. Add a character to the scratch `tools/i18n-runtime.js` → the output reports the runtime line.
3. Delete one PT key line from the scratch `i18n.js` → the output names that key under PT.

Remove the temp dir afterwards.

### Step 2: Put it in CI

Add `s("tools/build-i18n.mjs", ["--check"]),` to the `fast:` list in `test/suites.mjs`, next to the other generator checks, and bump the fast and total counts in `docs/ci.md`.

**Verify**: `node tools/run-tests.mjs --check` → exit 0. `node tools/run-tests.mjs fast` → exit 0. `git diff --stat -- i18n.js` → empty.

## Test plan

The negative controls in Step 1 (scratch copies) and the fast lane now running the check. No new test file is needed.

## Done criteria

- [ ] `grep -c 'build-i18n.mjs", \["--check"\]' test/suites.mjs` → `1`
- [ ] `node tools/run-tests.mjs fast` exits 0
- [ ] The three negative-control outputs are pasted into the report
- [ ] `i18n.js` is unchanged; only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- `node tools/build-i18n.mjs --check` fails on the clean tree before your change. Real drift exists; report it rather than regenerating.
- The runner's `--check` requires something other than a `test/suites.mjs` entry to add a tool command.

## Maintenance notes

- If the generator output format changes (for example, one file per language, see plan 021), update the section tracking in the diagnostic.
