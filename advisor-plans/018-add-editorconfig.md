# Plan 018: A root `.editorconfig` keeps editors and agents on the repo's existing whitespace conventions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `ls -a | grep -c editorconfig` → `0` (if a `.editorconfig` now exists, STOP).

## Status

- **Priority**: P3 (low value; the tree is already clean)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: **Rejected** by owner decision Q608 (§7 Rejected). Do not execute.

## Why this matters

The repo has no lint, formatter, or package manager at the root, by design (`AGENTS.md`: "no application build/lint/test tooling"). Its only whitespace backstop is `git diff --check` in the plan verification baseline. At `ff9991cf` the code is clean: no tabs, no CRLF, and no trailing whitespace in any tracked `.js`/`.mjs`/`.css`/`.html`/`.json`, except one line in `test/focus-only-parity.mjs`. Many humans and agents edit a ~1 MB `app.js` with different editor defaults. A plain-text `.editorconfig` is the cheapest way to keep it that way. It needs no dependency, which fits the no-tooling rule. Several Markdown documents deliberately contain trailing spaces (hard line breaks), so Markdown must be exempt from trimming.

## Current state

- No `.editorconfig` anywhere.
- Observed conventions: 2-space indentation (`sw.js`, `tools/*.mjs`, test files); `app.js` is dense with little indentation; LF endings; a final newline everywhere; UTF-8.
- Markdown files with intentional trailing spaces include `docs/business-product-thesis.md` (27 lines) and `docs/plan-047-owner-approved-design.md` (51 lines).
- Generated and vendored files that must never be reformatted: `i18n.js`, `exercises.js`, `vendor/**`, `docs/ui-screens/**`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Whitespace | `git diff --check` | no output |
| Fast lane | `node tools/run-tests.mjs fast` | exit 0 |
| Inventory | `node tools/run-tests.mjs --check` | exit 0 (it scans unignored files; confirm a new dotfile is not treated as a test) |

## Scope

**In scope:** `.editorconfig` (create).
**Out of scope:** reformatting any existing file, including the one trailing space in `test/focus-only-parity.mjs`. Changing existing files would create churn in files other people are editing.

## Git workflow

Branch `advisor/018-editorconfig`; commit `chore: add editorconfig matching existing whitespace`. Do not push.

## Steps

### Step 1: Create `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[{i18n.js,exercises.js,vendor/**,docs/ui-screens/**}]
indent_style = unset
indent_size = unset
trim_trailing_whitespace = unset
insert_final_newline = unset
```

**Verify**: `git diff --check` → no output. `node tools/run-tests.mjs --check` → exit 0. `node tools/run-tests.mjs fast` → exit 0.

## Test plan

None beyond the checks above. The file is inert for tools that ignore it.

## Done criteria

- [ ] `.editorconfig` exists with the content above
- [ ] `git status` shows only `.editorconfig`
- [ ] The fast lane is green; the `advisor-plans/README.md` row is updated

## STOP conditions

- `node tools/run-tests.mjs --check` flags the new file.
- The owner prefers not to add it. Mark REJECTED.

## Maintenance notes

- If a formatter is ever adopted, it must read these settings rather than contradict them.
