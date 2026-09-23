# Plan 017: The "usual training hour" is computed on a 24-hour circle, so late-night lifters get a sensible missed-session reminder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- schedule.js test/schedule.mjs`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

`RepForgeSchedule.usualHour(log)` estimates when the lifter usually trains, and the missed-session banner uses it. It takes a *linear* median of the hour of day. Hours wrap around midnight, so a lifter who trains at 23:00 and 01:00 gets a "usual hour" of **12** (noon), which is the opposite of the truth. The banner then fires at the wrong time of day for exactly the users with unusual schedules. A circular mean fixes it. For clustered daytime hours it agrees with the current median, including the existing test fixture.

## Current state

`schedule.js` (61 lines; UMD: `module.exports` in Node, `RepForgeSchedule` in the browser):

```js
  function usualHour(log) {
    const seen = new Set();
    const hours = [];
    for (const r of log || []) {
      if (!r.session || seen.has(r.session)) continue;
      seen.add(r.session);
      const t = Date.parse(r.created);
      if (!Number.isFinite(t)) continue;
      hours.push(new Date(t).getHours());
    }
    if (hours.length < 2) return null;
    hours.sort((a, b) => a - b);
    const mid = Math.floor(hours.length / 2);
    return hours.length % 2 ? hours[mid] : Math.round((hours[mid - 1] + hours[mid]) / 2);
  }
```

Consumer (`app.js:5429-5432`):

```js
  const hour=new Date().getHours();
  const usual=RepForgeSchedule.usualHour(state.log);
  const missedOk=!!n.missed && usual!=null && hour>=usual;
```

and the title interpolates `{hour:usual}`.

Existing test (`test/schedule.mjs:50-59`, pure Node, fast lane). Its `row(day, date, created)` helper builds log rows:

```js
  const log = [ row("Day 1","2026-07-20","2026-07-20T06:00:00"), row("Day 2","2026-07-21","2026-07-21T06:00:00"), row("Day 1","2026-07-22","2026-07-22T18:00:00") ];
  assert(S.usualHour(log) === 6, "usualHour median", String(S.usualHour(log)));
  …
assert(S.usualHour([row("Day 1", "2026-07-20")]) === null, "usualHour needs ≥2 sessions");
```

Note: `row` may give each call a distinct `session`. Check the helper at the top of `test/schedule.mjs` before writing cases. Also note that `new Date(t).getHours()` uses the runner's time zone. The fixtures have no `Z`, so they parse as local time, which keeps the hours stable.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit | `node test/schedule.mjs` | `schedule tests: N passed, 0 failed` |
| Syntax | `node --check schedule.js` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |
| Banner (browser) | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)`, then `node tools/run-tests.mjs workout --suite notifications` | exit 0 |

## Scope

**In scope:** `schedule.js` (`usualHour` only); `test/schedule.mjs`; the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs` (`schedule.js` is precached).
**Out of scope:** the `hour>=usual` comparison in `app.js`. Its behavior after midnight is a separate product question (see maintenance notes). Also out of scope: time-zone handling and `mostOverdueDay`.

## Git workflow

Branch `advisor/017-usual-hour`; commits `test(schedule): cover usual hour across midnight`, `fix(schedule): compute the usual hour on a 24-hour circle`, and `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Failing tests

Add to `test/schedule.mjs`, using the file's `row` and `assert` helpers and distinct sessions:
- `[23:00, 01:00]` → `usualHour === 0`
- `[22:00, 23:00, 00:00]` → `23`
- `[06:00, 06:00, 18:00]` (the existing case) → still `6`
- `[08:00, 20:00]` (diametrically opposite, no meaningful mean) → falls back to the current linear-median result, `14`

**Verify**: `node test/schedule.mjs` → the first two new cases fail.

### Step 2: Implement

After collecting `hours` (keep the `< 2 → null` guard):

```js
    let x = 0, y = 0;
    for (const h of hours) { const a = h / 24 * 2 * Math.PI; x += Math.cos(a); y += Math.sin(a); }
    if (Math.hypot(x, y) / hours.length < 0.2) {
      hours.sort((a, b) => a - b);
      const mid = Math.floor(hours.length / 2);
      return hours.length % 2 ? hours[mid] : Math.round((hours[mid - 1] + hours[mid]) / 2);
    }
    const angle = Math.atan2(y, x);
    return ((Math.round((angle < 0 ? angle + 2 * Math.PI : angle) / (2 * Math.PI) * 24) % 24) + 24) % 24;
```

The 0.2 resultant-length threshold means "the hours are too spread out to have a meaningful centre". In that case the function keeps today's behavior.

**Verify**: `node --check schedule.js` → exit 0. `node test/schedule.mjs` → 0 failed.

### Step 3: Cache ritual and banner suite

Bump NN → NN+1 (read NN via `grep -o 'repforge-v[0-9]*' sw.js`) in `sw.js` (`CACHE` and every `?v=NN`), `index.html`, and `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs workout --suite notifications` → exit 0. If that suite name does not exist, find the banner suite with `grep -ln "session_banner\|usualHour" test/*.mjs` and run it.

## Test plan

Four cases in `test/schedule.mjs`: wrap-around pair, wrap-around triple, existing daytime case, and the spread-out fallback.

## Done criteria

- [ ] `node test/schedule.mjs` reports 0 failed, with the 4 new or confirmed assertions
- [ ] `grep -c "Math.atan2" schedule.js` → `1`
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- Existing notification or banner suites assert a specific `usual` value that changes.
- `usualHour` has other callers (`grep -rn "usualHour" --include=*.js .`) with different expectations.

## Maintenance notes

- With a circular mean, `usual` can now be 0–2 for night lifters, and `hour>=usual` then fires for almost the whole day. That condition predates this plan. A proper "time since usual hour" window is a product decision; raise it with the owner rather than folding it in here.
