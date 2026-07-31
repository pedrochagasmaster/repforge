# Notifications (local-only) — design

> **Status**: Spec approved for planning (2026-07-31). Not implemented.
> **Build plan**: `docs/superpowers/plans/2026-07-31-notifications.md`
> **Scope**: Local OS + in-app notifications for rest timer, overdue session, unfinished session, missed day. No backend.
> **Evidence base**: Live rest timer (`startRest`/`tickRest`/`#restBar`), draft key `repforge_draft_v1`, cache-only `sw.js`, settings via `DEFAULTS`/`normalizeSettings`.

## Problem

RepForge’s session loop loses people between sets and between sessions:

1. Rest timer is in-app only (`setInterval`). Screen lock / app switch often means the lifter never sees “0:00”.
2. Training days are labels (`Day 1`, `Day 2`), not weekdays. Lifters need a clear “do this today” signal without a calendar.
3. Drafts can sit with committed sets after someone leaves the gym and forgets **Save workout**.
4. Flexible schedules mean a day can sit overdue without any weekday “missed Monday” signal.

Persona feedback already called out background rest-timer notifications and optional local reminders (backup hygiene is out of scope for this spec).

## Goal

Ship four notification surfaces, backend-less, working on installed Android **and** iOS PWAs as far as the platform allows, with honest graceful degradation:

| # | Surface | Trigger | Delivery |
|---|---------|---------|----------|
| 1 | Rest timer done | Countdown hits zero | Foreground: in-app done state + vibrate. Background/locked: OS notification (best-effort). |
| 2 | Today’s session | First open of the calendar day | In-app Log banner naming the inferred overdue program day. Tap selects that day. |
| 3 | Unfinished session | 15 minutes after last completed (committed) set, session still unsaved | Foreground: in-app prompt. Background: OS notification. Reopen fallback if the timer was frozen. |
| 4 | Missed day | Open / visibility after usual training hour, nothing logged today, overdue day exists | Escalate the session banner to overdue tone. |

## Locked decisions

- **Platforms**: both mobile (installed PWA preferred). Desktop not a target.
- **Backend**: none. GitHub Pages–compatible static hosting stays valid. No Web Push server.
- **“6am”**: not a real wake-up. Today’s-session is **first open of the day**. Missed-day escalates **later**, after a usual training hour inferred from history.
- **Today’s session definition**: the program day whose **last completed session is farthest in the past** — independent of weekday and of rotational “next after last” order.
- **Rest timer**: option C — OS when backgrounded/locked + in-app when foregrounded.
- **Unfinished**: fixed single reminder at 15 minutes after last committed set; cancel on save / clear draft.
- **Missed day**: later-in-day escalation after global usual hour (median of session `created` hours).
- **Settings**: master Notifications toggle + four per-type toggles.
- **Architecture**: Approach 1 — `schedule.js` (pure inference) + `notify.js` (OS wrapper); `app.js` wires lifecycle.

## Non-goals

- Web Push / any server, subscription store, or VAPID keys.
- Notification Triggers / TimestampTrigger (not cross-platform).
- Backup/export reminders, block-end reminders, streaks, PR celebrations, deload coaching pushes.
- Explicit weekly schedule UI.
- Audio chimes beyond optional `navigator.vibrate`.
- Changing rest-timer defaults or auto-start-on-save behavior beyond firing a notification when done.

## Architecture

```
index.html
  ├── schedule.js   → globalThis.RepForgeSchedule  (pure; Node-testable)
  ├── notify.js     → globalThis.RepForgeNotify    (browser Notification + SW showNotification)
  ├── app.js        → wires timer / draft / banner / settings / deep link
  └── sw.js         → cache shell + notificationclick → open ?goto=<day>
```

Training data stays in IndexedDB/`localStorage` (`repforge_v1`, `repforge_draft_v1`). Prompt bookkeeping uses a small sibling key `repforge_notify_v1` (dismissals, last-shown dates) so the training blob stays clean.

### `RepForgeSchedule` (pure)

- `mostOverdueDay(log, programDays, todayYmd)` → `{ day, lastDate, daysSince } | null`
  - For each label in `programDays`, find the latest log `date` among rows with that `day`.
  - Pick the largest gap `todayYmd − lastDate`. Never-logged days beat any logged day (treat as infinite overdue).
  - Tie-break: program day order as given in `programDays`.
  - Empty log **or** empty `programDays` → `null` (no banner until there is history to compare; see empty-log rule below).
  - Empty log but we still want a default? **No** — stay hidden until ≥1 logged session exists. Never-logged *siblings* of a partial history still win.
- `usualHour(log)` → median local hour (0–23) of unique sessions’ `created` timestamps, or `null` if fewer than 2 sessions.
- `hasLoggedOn(log, ymd)` → boolean.

### `RepForgeNotify` (browser)

- `canUse()` — `typeof Notification !== "undefined"` and service worker available when needed.
- `permission()` / `request()` — `request()` only from a user gesture (master toggle on).
- `enabledFor(settings, type)` — `settings.notify.enabled && settings.notify[type]`.
- `fireOS({ title, body, tag, url })` — `navigator.serviceWorker.ready` then `reg.showNotification(...)`. Catch failures; never throw into the session loop.
- Types: `"timer" | "session" | "unfinished" | "missed"`.

### Settings shape

```js
notify: {
  enabled: false,   // master; turning on calls notify.request()
  timer: true,
  session: true,
  unfinished: true,
  missed: true
}
```

Added to `DEFAULTS` + `normalizeSettings`. In-app banners honor toggles even when OS permission is `denied`. OS delivery additionally requires `granted`.

## Behavior detail

### Rest timer done

When `tickRest` crosses ≤0 (once per countdown):

1. Keep existing `#restBar.is-done` UI.
2. If document is visible and timer notify enabled → `navigator.vibrate?.([200,100,200])` (no-op where unsupported).
3. If document is hidden and timer notify enabled and permission granted → `fireOS` with tag `repforge-rest`, body “Rest done — next set.”, url `./index.html` (or current path).
4. Starting a new rest cancels/replaces any prior rest notification (same tag).
5. **Honest limit**: frozen/suspended tabs (especially iOS) may not run `setInterval`. On return to foreground, if `restEnd` is past, show done state; do **not** fire a late OS notification for a long-expired timer.

### Today’s session (first open)

On `init` / first Log render of a calendar day:

1. If `!notify.enabled || !notify.session` → skip.
2. If `hasLoggedOn(log, today)` → skip.
3. If `mostOverdueDay(...)` is `null` → skip.
4. If `repforge_notify_v1.sessionBannerDate === today` and dismissed → skip (or show once then remember; dismiss sets the flag).
5. Render `#sessionBanner` above the workout: “Today: {day} — tap to start”. Tap sets `day`, `renderTabs`+`renderWorkout`, dismisses for today.

In-app only — no OS notification for this surface.

### Unfinished session

- On each successful set commit (`committed.add` path that currently calls `startRest`), record `draft.__lastCommitAt = Date.now()` and (re)arm a 15-minute `setTimeout`.
- On `saveWorkout` success / `clearDraft` → clear timeout; clear any unfinished OS notification tag; clear `__lastCommitAt`.
- On timeout: if draft still has committed sets and no save → foreground in-app prompt (“Finish your session?” with Save / Dismiss); if hidden → `fireOS` tag `repforge-unfinished`.
- **Reopen fallback**: on `init`, if draft has `__done.length > 0`, `__lastCommitAt` is >15 min ago, and unfinished toggle on → show the in-app prompt (covers frozen timers).

### Missed day

On `init` and `visibilitychange` → visible:

1. Requires `notify.enabled && notify.missed`.
2. `!hasLoggedOn(log, today)`.
3. `mostOverdueDay` non-null.
4. `usualHour(log)` non-null and `localHour >= usualHour` (if `usualHour` is null, do not escalate — stay on the softer first-open card only).
5. Escalate banner copy/tone: “You usually train around {hour} — {day} is due”. Tap → select day.

Independent toggle from `session` (first-open soft card). If both would apply, show the **missed** (escalated) variant once.

### Deep link

- OS notifications carry `data: { url: "./index.html?goto=" + encodeURIComponent(day) }` (or unfinished → Log without day change).
- `sw.js` `notificationclick`: `clients.openWindow` / `focus` + navigate to `data.url`.
- `app.js` boot: read `goto` query, if it matches a program day → set `day`, strip query via `history.replaceState`.

## Empty / thin history

| History | Today’s / missed banner |
|---------|-------------------------|
| No log rows | Hidden |
| One session on Day 1, program has Day 1–3 | Day 2 or Day 3 (never-logged) wins by program order among never-logged |
| All days logged recently | Most overdue by calendar gap |

## Platform honesty (copy)

Settings lede must state: notifications work best with RepForge installed to the home screen; background delivery is best-effort and may not fire when the OS suspends the app (especially iOS).

## Testing

- Node unit tests for `schedule.js` pure functions (`test/schedule.mjs`).
- Playwright checks in `test/simulation.mjs` or a focused `test/notifications.mjs`: settings persist, session banner from seeded overdue history, unfinished reopen prompt, `?goto=` selects day.
- Manual: grant permission in a real browser and confirm rest-timer OS notification while tab is backgrounded (Android Chromium preferred for reliability).

## Out of scope follow-ups

- Optional future Web Push sidecar (separate hosting) without moving training data off-device.
- Backup reminder (persona request) as its own plan.
- Flexible schedule / missed-day *queue* UI beyond the banner.
