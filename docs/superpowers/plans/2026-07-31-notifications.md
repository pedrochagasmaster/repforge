# Notifications (local-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-less rest-timer, overdue-session, unfinished-session, and missed-day notifications to the RepForge PWA, with Settings toggles and honest platform degradation.

**Architecture:** Two focused scripts — `schedule.js` (pure overdue-day / usual-hour inference) and `notify.js` (Notification + service-worker `showNotification` wrapper) — loaded before `app.js`. `app.js` wires timer/draft/banner/settings/deep-link. `sw.js` handles `notificationclick`. No push server; GitHub Pages hosting remains valid.

**Tech Stack:** Vanilla JS (no build), existing IndexedDB/`localStorage`, Notifications API, Service Worker, Node + Playwright tests (`test/`), static `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-07-31-notifications-design.md`

## Global Constraints

- Local-only: no backend, no Web Push, no VAPID, no third-party notification SaaS.
- No new package manager / bundler / linter at repo root; do not add dependencies outside `test/` if already present.
- New scripts must be plain classic scripts (or dual-export IIFEs) — the app does not use ES modules in the browser.
- Domain language: **session**, **training day** / program day label, **log row** — not “workout reminder” as a domain term in code comments beyond casual UI copy.
- “Today’s session” = program day with the longest time since last completed session — **not** weekday inference, **not** “next after last” rotation.
- Empty log → no today’s/missed banner (need ≥1 logged session).
- Unfinished idle = **15 minutes** after last committed set (fixed).
- Rest timer OS notify is **best-effort**; never fire a late OS notification for a long-expired timer on resume.
- Settings: master `notify.enabled` + `timer` / `session` / `unfinished` / `missed`.
- Bump `sw.js` `CACHE` version when shell assets change.
- After editing cached assets, hard-reload / unregister SW when manually verifying.
- Syntax gate: `node --check` on every touched `.js` file.
- Do not estimate calendar time; keep commits small and present-tense.

---

## Locked product decisions (from design)

1. **Surfaces:** rest-timer done; today’s session on first open; unfinished session at 15 min idle; missed day after usual training hour.
2. **Platforms:** installed Android + iOS PWAs (best-effort). No backend.
3. **“6am”:** not a wake-up — today’s session is first open; missed day escalates later using median session `created` hour.
4. **Inference:** `mostOverdueDay` — program day whose last log `date` is farthest in the past; never-logged days beat logged; tie-break = program day order. Independent of weekday and rotation order.
5. **Rest timer:** OS notification when backgrounded/locked + in-app done/vibrate when foregrounded.
6. **Controls:** master toggle + four per-type toggles.
7. **Modules:** Approach 1 — `schedule.js` + `notify.js`.

### Out of scope

Web Push, Notification Triggers, backup reminders, block-end reminders, streaks/PRs, explicit weekly schedule UI, audio chimes beyond `navigator.vibrate`, changing rest auto-start behavior beyond notify-on-done.

---

## File map

| File | Responsibility |
|------|----------------|
| Create `schedule.js` | Pure: `mostOverdueDay`, `usualHour`, `hasLoggedOn`. Dual-export for Node tests. |
| Create `notify.js` | Browser: permission, `enabledFor`, `fireOS`, tag helpers. |
| Create `test/schedule.mjs` | Node unit tests for `schedule.js`. |
| Modify `app.js` | Settings normalize; rest-done notify; unfinished timer; session/missed banner; `?goto=`; draft `__lastCommitAt`. |
| Modify `index.html` | Script tags; Notifications settings card; `#sessionBanner` host. |
| Modify `styles.css` | Banner + settings notify block styles (match existing tokens). |
| Modify `sw.js` | `notificationclick`; cache bump; include new JS in `ASSETS`. |
| Create `test/notifications.mjs` | Playwright focused checks (banner, toggles, goto, unfinished reopen). |
| Modify design spec | Status → implemented when done (last task). |

---

### Task 1: `schedule.js` + Node unit tests

**Files:**
- Create: `schedule.js`
- Create: `test/schedule.mjs`

**Interfaces:**
- Produces: `RepForgeSchedule.mostOverdueDay(log, programDays, todayYmd)`, `usualHour(log)`, `hasLoggedOn(log, ymd)`
- Consumes: nothing (pure)

- [ ] **Step 1: Write the failing Node tests**

Create `test/schedule.mjs`:

```js
#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const S = require(join(__dirname, "..", "schedule.js"));

let passed = 0, failed = 0;
function assert(cond, name, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}

function row(day, date, created = `${date}T06:00:00`) {
  return { session: `${date}_${day}_x`, date, day, name: "X", set: 1, load: 50, reps: 8, rir: 1, created };
}

assert(S.mostOverdueDay([], ["Day 1", "Day 2"], "2026-07-31") === null, "empty log → null");

{
  const log = [row("Day 1", "2026-07-28")];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 2", "never-logged wins by program order", JSON.stringify(r));
}

{
  const log = [
    row("Day 1", "2026-07-20"),
    row("Day 2", "2026-07-29"),
    row("Day 3", "2026-07-25"),
  ];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 1" && r.daysSince === 11, "most overdue by date gap", JSON.stringify(r));
}

{
  const log = [
    row("Day 1", "2026-07-30"),
    row("Day 2", "2026-07-28"),
    row("Day 3", "2026-07-10"),
  ];
  const r = S.mostOverdueDay(log, ["Day 1", "Day 2", "Day 3"], "2026-07-31");
  assert(r?.day === "Day 3", "not next-in-rotation; oldest completion wins", JSON.stringify(r));
}

assert(S.hasLoggedOn([row("Day 1", "2026-07-31")], "2026-07-31") === true, "hasLoggedOn true");
assert(S.hasLoggedOn([row("Day 1", "2026-07-30")], "2026-07-31") === false, "hasLoggedOn false");

{
  const log = [
    row("Day 1", "2026-07-20", "2026-07-20T06:00:00"),
    row("Day 2", "2026-07-21", "2026-07-21T06:00:00"),
    row("Day 1", "2026-07-22", "2026-07-22T18:00:00"),
  ];
  assert(S.usualHour(log) === 6, "usualHour median", String(S.usualHour(log)));
}
assert(S.usualHour([row("Day 1", "2026-07-20")]) === null, "usualHour needs ≥2 sessions");

console.log(`\nschedule tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run tests — expect fail (module missing)**

Run: `node test/schedule.mjs`  
Expected: crash / cannot find `schedule.js` (or empty exports).

- [ ] **Step 3: Implement `schedule.js`**

```js
(function (root) {
  function ymdToUTC(ymd) {
    const [y, m, d] = String(ymd).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function daysBetween(aYmd, bYmd) {
    return Math.round((ymdToUTC(bYmd) - ymdToUTC(aYmd)) / 86400000);
  }

  function lastDateForDay(log, dayLabel) {
    let best = null;
    for (const r of log || []) {
      if (r.day !== dayLabel || !r.date) continue;
      if (!best || String(r.date) > String(best)) best = r.date;
    }
    return best;
  }

  function mostOverdueDay(log, programDays, todayYmd) {
    const days = Array.isArray(programDays) ? programDays : [];
    if (!days.length || !Array.isArray(log) || !log.length || !todayYmd) return null;

    let best = null;
    for (const day of days) {
      const lastDate = lastDateForDay(log, day);
      const daysSince = lastDate == null ? Number.POSITIVE_INFINITY : daysBetween(lastDate, todayYmd);
      const cand = { day, lastDate, daysSince: lastDate == null ? null : daysSince };
      if (!best) { best = cand; continue; }
      const a = best.daysSince == null ? Number.POSITIVE_INFINITY : best.daysSince;
      const b = cand.daysSince == null ? Number.POSITIVE_INFINITY : cand.daysSince;
      if (b > a) best = cand;
      // tie → keep earlier program order (first wins)
    }
    return best;
  }

  function hasLoggedOn(log, ymd) {
    return (log || []).some(r => r.date === ymd);
  }

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

  const api = { mostOverdueDay, usualHour, hasLoggedOn, daysBetween, lastDateForDay };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSchedule = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 4: Run tests — expect pass**

Run: `node test/schedule.mjs`  
Expected: all ✓, exit 0.

- [ ] **Step 5: Syntax check + commit**

```bash
node --check schedule.js
git add schedule.js test/schedule.mjs
git commit -m "Add schedule.js overdue-day inference with unit tests"
```

---

### Task 2: `notify.js` wrapper

**Files:**
- Create: `notify.js`

**Interfaces:**
- Consumes: browser `Notification`, `navigator.serviceWorker`
- Produces: `RepForgeNotify.canUse`, `permission`, `request`, `enabledFor`, `fireOS`, `closeTag`

- [ ] **Step 1: Implement `notify.js`**

```js
(function (root) {
  const TYPES = ["timer", "session", "unfinished", "missed"];

  function canUse() {
    return typeof Notification !== "undefined";
  }

  function permission() {
    if (!canUse()) return "unsupported";
    return Notification.permission;
  }

  async function request() {
    if (!canUse()) return "unsupported";
    try { return await Notification.requestPermission(); }
    catch { return permission(); }
  }

  function enabledFor(settings, type) {
    const n = settings && settings.notify;
    if (!n || !n.enabled) return false;
    if (!TYPES.includes(type)) return false;
    return n[type] !== false;
  }

  // IMPORTANT: never await navigator.serviceWorker.ready here — it NEVER
  // settles when registration failed (app.js registers with .catch(()=>{})),
  // which would hang fireOS forever and make the fallback dead code.
  // getRegistration() resolves undefined when there is no registration.
  async function swRegistration() {
    try {
      if (!("serviceWorker" in navigator)) return null;
      return (await navigator.serviceWorker.getRegistration()) || null;
    } catch { return null; }
  }

  async function fireOS({ title, body, tag, url }) {
    if (!canUse() || Notification.permission !== "granted") return false;
    const opts = {
      body: body || "",
      tag: tag || "repforge",
      renotify: true,
      data: { url: url || "./index.html" },
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png"
    };
    const reg = await swRegistration();
    if (reg && reg.showNotification) {
      try {
        await reg.showNotification(title || "RepForge", opts);
        return true;
      } catch (e) { console.warn("showNotification failed", e); }
    }
    try {
      new Notification(title || "RepForge", opts);
      return true;
    } catch (e) {
      console.warn("Notification constructor failed", e);
      return false;
    }
  }

  async function closeTag(tag) {
    try {
      const reg = await swRegistration();
      if (!reg || !reg.getNotifications) return;
      const list = await reg.getNotifications({ tag });
      list.forEach(n => n.close());
    } catch {}
  }

  const api = { canUse, permission, request, enabledFor, fireOS, closeTag, TYPES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeNotify = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 2: Syntax check**

Run: `node --check notify.js`  
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add notify.js
git commit -m "Add notify.js OS notification wrapper"
```

---

### Task 3: Settings schema + Notifications UI card

**Files:**
- Modify: `app.js` (`DEFAULTS`, `normalizeSettings`, `renderSettings`, `commitSettings`)
- Modify: `index.html` (Notifications card + script tags + banner host)
- Modify: `styles.css` (minimal banner/settings styles)

**Interfaces:**
- Consumes: `RepForgeNotify.request`, `RepForgeNotify.permission`
- Produces: `state.settings.notify` shape persisted with the rest of settings

- [ ] **Step 1: Extend defaults and normalize**

In `DEFAULTS` add:

```js
notify:{enabled:false,timer:true,session:true,unfinished:true,missed:true}
```

Add helper near `normalizeSettings`:

```js
function normalizeNotify(n){
  return{
    enabled:!!(n&&n.enabled),
    timer:n?.timer!==false,
    session:n?.session!==false,
    unfinished:n?.unfinished!==false,
    missed:n?.missed!==false
  };
}
```

Include `notify:normalizeNotify(s?.notify)` in `normalizeSettings` return object.

- [ ] **Step 2: Wire script tags and Settings markup**

In `index.html`, before `app.js`:

```html
<script src="schedule.js"></script>
<script src="notify.js"></script>
<script src="app.js"></script>
```

Inside `#log` (after section head / before workout list), add:

```html
<div id="sessionBanner" class="sessionbanner hidden" role="status"></div>
```

In `#settings`, after the Progression card (before Guide & install), add:

```html
<div class="card">
  <p class="cardtitle">Notifications</p>
  <p class="lede">Local reminders on this device. Best with RepForge installed to the home screen. Background delivery is best-effort — iOS may suspend timers when the app is closed.</p>
  <label class="field field--check"><input type="checkbox" id="notifyEnabled"> Enable notifications</label>
  <div id="notifyTypes" class="notifytypes">
    <label class="field field--check"><input type="checkbox" id="notifyTimer"> Rest timer done</label>
    <label class="field field--check"><input type="checkbox" id="notifySession"> Today's session (on open)</label>
    <label class="field field--check"><input type="checkbox" id="notifyUnfinished"> Unfinished session (15 min idle)</label>
    <label class="field field--check"><input type="checkbox" id="notifyMissed"> Missed day (after usual training hour)</label>
  </div>
  <p class="lede" id="notifyPermStatus"></p>
</div>
```

- [ ] **Step 3: Render + commit settings**

In `renderSettings`, sync checkboxes from `state.settings.notify` and set `#notifyPermStatus` text from `RepForgeNotify.permission()` (e.g. `OS permission: granted|denied|default|unsupported`). Disable `#notifyTypes` inputs when master is off.

In `commitSettings`, read the five checkboxes into `notify:normalizeNotify({...})`. When master flips from off→on, call `RepForgeNotify.request()` **synchronously within the change-event handler, before any other `await`** — iOS only honors permission requests made inside a user gesture. Re-render the status line when the promise settles. If the user denies OS permission, keep `notify.enabled` as the user set it (in-app banners still work); never flip the master toggle off on denial.

Bind `onchange` on the five inputs like `voiceInputEnabled`.

Add CSS matching existing tokens (do not invent a purple theme):

```css
.sessionbanner{margin:0 0 .75rem;padding:.75rem 1rem;border:1px solid var(--line, #2a3140);border-radius:8px;background:var(--panel, #151a22);cursor:pointer}
.sessionbanner.hidden{display:none}
.sessionbanner.is-missed{border-color:var(--accent, #c4a35a)}
.sessionbanner__title{font-weight:700;margin:0 0 .25rem}
.sessionbanner__body{margin:0;opacity:.85;font-size:.9rem}
.notifytypes{display:grid;gap:.35rem;margin:.5rem 0}
#unfinishedBanner{margin:0 0 .75rem;padding:.75rem 1rem;border:1px solid var(--line, #2a3140);border-radius:8px}
#unfinishedBanner.hidden{display:none}
```

(Prefer existing CSS variables already in `styles.css` over the fallbacks above.)

- [ ] **Step 4: Manual/syntax verify + commit**

```bash
node --check app.js
# Open Settings → Notifications card visible; toggle persists after reload
git add app.js index.html styles.css
git commit -m "Add notification settings schema and Settings UI"
```

---

### Task 4: Rest timer done — in-app + OS

**Files:**
- Modify: `app.js` (`tickRest`, `startRest`, `stopRest`)

**Interfaces:**
- Consumes: `RepForgeNotify.enabledFor`, `fireOS`, `closeTag`
- Produces: one-shot rest-done signal per countdown

- [ ] **Step 1: Track whether this countdown already notified**

Near `restEnd` / `restTick`:

```js
let restNotified=false;
```

In `startRest`, set `restNotified=false` and call `RepForgeNotify.closeTag("repforge-rest")`. In `stopRest`, also call `RepForgeNotify.closeTag("repforge-rest")` so a manually stopped timer clears any already-shown notification.

- [ ] **Step 2: Fire on zero in `tickRest`**

Replace the `left<=0` branch so it:

1. Sets bar to `0:00` + `is-done`, clears interval (existing).
2. If `restNotified` already true, return after UI update.
3. Set `restNotified=true`.
4. If `!RepForgeNotify.enabledFor(state.settings,"timer")` return.
5. If `document.visibilityState==="visible"` → `navigator.vibrate?.([200,100,200])`.
6. Else → `RepForgeNotify.fireOS({ title:"RepForge", body:"Rest done — next set.", tag:"repforge-rest", url:"./index.html" })`.

On `visibilitychange` to visible: if `restEnd` and `Date.now()>=restEnd` and bar exists, ensure `is-done` UI; **do not** call `fireOS` for a late expiry. Register **one** `visibilitychange` listener shared with Task 5's `updateSessionBanner()` call — a single handler doing both, not two listeners.

- [ ] **Step 3: Smoke + commit**

```bash
node --check app.js
# Manual: enable notifications + grant permission; start rest; background tab; confirm OS notification on Chromium when possible
git add app.js
git commit -m "Notify when rest timer completes in background"
```

---

### Task 5: Session banner — today’s overdue day + missed-day escalation

**Files:**
- Modify: `app.js`
- Modify: `index.html` (banner host already added in Task 3)

**Interfaces:**
- Consumes: `RepForgeSchedule.mostOverdueDay`, `hasLoggedOn`, `usualHour`; `RepForgeNotify.enabledFor` / settings flags
- Produces: `#sessionBanner` first-open + missed variants; `repforge_notify_v1` dismissal bookkeeping

- [ ] **Step 1: Notify meta helpers**

```js
const NOTIFY_META="repforge_notify_v1";
function loadNotifyMeta(){
  try{return JSON.parse(localStorage.getItem(NOTIFY_META)||"{}")||{}}catch{return{}}
}
function saveNotifyMeta(m){localStorage.setItem(NOTIFY_META,JSON.stringify(m))}
```

- [ ] **Step 2: `updateSessionBanner()`**

```js
function updateSessionBanner(){
  const el=$("#sessionBanner"); if(!el) return;
  const n=state.settings.notify;
  const hide=()=>{el.className="sessionbanner hidden"; el.innerHTML=""; el.onclick=null};
  if(!n||!n.enabled) return hide();
  if(RepForgeSchedule.hasLoggedOn(state.log, today())) return hide();
  if(!state.log.length) return hide();

  const due=RepForgeSchedule.mostOverdueDay(state.log, days(), today());
  if(!due) return hide();

  const meta=loadNotifyMeta();
  const hour=new Date().getHours();
  const usual=RepForgeSchedule.usualHour(state.log);
  const missedOk=!!n.missed && usual!=null && hour>=usual;
  const sessionOk=!!n.session;

  if(!missedOk && !sessionOk) return hide();
  if(!missedOk && meta.sessionBannerDate===today() && meta.sessionBannerDismissed) return hide();
  if(missedOk && meta.missedBannerDate===today() && meta.missedBannerDismissed) return hide();

  const isMissed=missedOk;
  const title=isMissed
    ? `You usually train around ${usual}:00`
    : `Today: ${due.day}`;
  const body=isMissed
    ? `${due.day} is due — tap to start`
    : `Tap to open ${due.day}`;

  function dismissForToday(){
    const m=loadNotifyMeta();
    if(isMissed){m.missedBannerDate=today(); m.missedBannerDismissed=true}
    else{m.sessionBannerDate=today(); m.sessionBannerDismissed=true}
    saveNotifyMeta(m);
    hide();
  }

  el.className=`sessionbanner${isMissed?" is-missed":""}`;
  el.innerHTML=`<button type="button" class="sessionbanner__close" aria-label="Dismiss for today">✕</button>`+
    `<p class="sessionbanner__title">${esc(title)}</p><p class="sessionbanner__body">${esc(body)}</p>`;
  el.querySelector(".sessionbanner__close").onclick=e=>{e.stopPropagation();dismissForToday()};
  el.onclick=()=>{
    day=due.day;
    dismissForToday();
    renderTabs(); renderWorkout();
    toast(`${due.day} ready.`);
  };
}
```

Semantics (this resolves the spec's "show once" wording): the banner
**persists until acted on** — either tapped (navigates to the day) or
dismissed via ✕ — and each variant reappears **at most once per calendar
day** after dismissal. Add `.sessionbanner__close` styles (absolute top-right,
small tap target ≥ 40px) next to the Task 3 CSS.

Call `updateSessionBanner()` from `renderWorkout` (end) and from **one shared**
`visibilitychange` handler (the same one Task 4 uses for the rest-timer done
state — register a single listener that does both; do not add two listeners).

- [ ] **Step 3: Verify + commit**

Seed log with Day 1 recent / Day 2 old → banner shows Day 2 on open.

```bash
node --check app.js
git add app.js styles.css
git commit -m "Show overdue training-day banner on open and after usual hour"
```

---

### Task 6: Unfinished session — 15 min idle + reopen fallback

**Files:**
- Modify: `app.js` (set-commit handler, `saveDraft`, `saveWorkout`, `clearDraft`, `init`)
- Modify: `index.html` (add `#unfinishedBanner` near session banner)

**Interfaces:**
- Consumes: `RepForgeNotify.enabledFor`, `fireOS`, `closeTag`; `loadNotifyMeta`/`saveNotifyMeta` from Task 5 (Task 5 must land first)
- Produces: `draft.__lastCommitAt` (carried by `saveDraft`); module `lastCommitAt`; single 15‑min timeout; `repforge_notify_v1.unfinishedPromptedFor`; `#unfinishedBanner` + `document.body.dataset.unfinishedPrompt`

- [ ] **Step 1: Markup**

```html
<div id="unfinishedBanner" class="hidden" role="status" hidden>
  <p class="sessionbanner__title">Unfinished session</p>
  <p class="sessionbanner__body">You have unsaved sets. Finish on Log, then Save workout.</p>
  <button type="button" id="unfinishedDismiss" class="btn btn--steel">Dismiss</button>
</div>
```

- [ ] **Step 2: Arm / clear helpers**

**CRITICAL — draft rebuild trap:** `saveDraft()` (`app.js`) rebuilds the draft
object from scratch (`const d={}`) on **every input event**. Any field written
into the draft elsewhere is wiped by the next keystroke. Therefore
`__lastCommitAt` MUST live in a module-level variable that `saveDraft` writes
back on every call, and MUST only be **updated** in the set-commit handler.
Never write `Date.now()` inside `saveDraft` itself — that would reset the idle
clock on every keystroke and break "15 minutes after the last *committed set*".

```js
let unfinishedTimer=null;
let lastCommitAt=0;             // module-level; hydrated from draft at boot
const UNFINISHED_MS=15*60*1000;

function clearUnfinishedWatch(){
  if(unfinishedTimer){clearTimeout(unfinishedTimer); unfinishedTimer=null}
  if(window.RepForgeNotify) RepForgeNotify.closeTag("repforge-unfinished");
}

function armUnfinishedWatch(delayMs=UNFINISHED_MS){
  clearUnfinishedWatch();
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  unfinishedTimer=setTimeout(onUnfinishedIdle, Math.max(0,delayMs));
}

// Single-reminder guarantee: remember which commit timestamp we already
// prompted for (in repforge_notify_v1), so reopening the app or receiving
// the OS notification does not produce repeat prompts for the same session.
function unfinishedAlreadyPrompted(){
  return loadNotifyMeta().unfinishedPromptedFor===lastCommitAt;
}
function markUnfinishedPrompted(){
  const m=loadNotifyMeta(); m.unfinishedPromptedFor=lastCommitAt; saveNotifyMeta(m);
}

function showUnfinishedPrompt(){
  markUnfinishedPrompted();
  document.body.dataset.unfinishedPrompt="1";
  const el=$("#unfinishedBanner");
  if(!el) return;
  el.classList.remove("hidden");
  el.hidden=false;
  const d=$("#unfinishedDismiss");
  if(d) d.onclick=()=>{ el.classList.add("hidden"); el.hidden=true; };
}

function onUnfinishedIdle(){
  unfinishedTimer=null;
  const draft=loadDraft();
  if(!(draft.__done||[]).length) return;
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  if(unfinishedAlreadyPrompted()) return;
  if(document.visibilityState==="visible") showUnfinishedPrompt();
  else{
    markUnfinishedPrompted();
    RepForgeNotify.fireOS({
      title:"RepForge",
      body:"Still training? Finish or save your session.",
      tag:"repforge-unfinished",
      url:"./index.html"
    });
  }
}
```

Wiring:

1. In the save-set click handler (`bindWorkout`, where `committed.add(key)` then
   `startRest()` runs): set `lastCommitAt=Date.now()` **before** `saveDraft()`,
   then `armUnfinishedWatch()`.
2. In `saveDraft`, after `d.__done=[...committed];...` add the carry-over:

```js
if(lastCommitAt&&committed.size)d.__lastCommitAt=lastCommitAt;
```

3. On `saveWorkout` success and in `clearDraft`: `clearUnfinishedWatch()`;
   `lastCommitAt=0`; hide `#unfinishedBanner`; `delete document.body.dataset.unfinishedPrompt`.

- [ ] **Step 3: Reopen fallback in `init` after first render**

```js
function maybeUnfinishedOnOpen(){
  const draft=loadDraft();
  lastCommitAt=+draft.__lastCommitAt||0;   // hydrate module state from draft
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  const done=(draft.__done||[]).length;
  if(!done||!lastCommitAt) return;
  if(unfinishedAlreadyPrompted()) return;  // single reminder per session
  const elapsed=Date.now()-lastCommitAt;
  if(elapsed>=UNFINISHED_MS) showUnfinishedPrompt();
  else armUnfinishedWatch(UNFINISHED_MS-elapsed);
}
```

- [ ] **Step 4: Commit**

```bash
node --check app.js
git add app.js index.html styles.css
git commit -m "Remind after 15 minutes of idle unfinished session"
```

---

### Task 7: Service worker click + deep link `?goto=`

**Files:**
- Modify: `sw.js`
- Modify: `app.js` (`boot`/`init`)

**Interfaces:**
- Consumes: notification `data.url`
- Produces: day selection from `goto` query

- [ ] **Step 1: Bump cache + assets + click handler in `sw.js`**

Increment `CACHE` (e.g. `repforge-v20` → `repforge-v21`). Add `./schedule.js` and `./notify.js` to `ASSETS`.

Append:

```js
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        await c.focus();
        if ("navigate" in c) try { await c.navigate(url); } catch {}
        return;
      }
    }
    await clients.openWindow(url);
  })());
});
```

- [ ] **Step 2: Consume `goto` in `app.js`**

```js
function applyGotoParam(){
  try{
    const u=new URL(location.href);
    const g=u.searchParams.get("goto");
    if(g && days().includes(g)) day=g;
    if(u.searchParams.has("goto")){
      u.searchParams.delete("goto");
      history.replaceState({}, "", u.pathname+u.search+u.hash);
    }
  }catch{}
}
```

Call after program/days are known and before first `render()`.

- [ ] **Step 3: Commit**

```bash
node --check sw.js app.js
git add sw.js app.js
git commit -m "Handle notification clicks and ?goto= deep links"
```

---

### Task 8: Playwright focused notification checks

**Files:**
- Create: `test/notifications.mjs`

**Interfaces:**
- Consumes: running server at `REPFORGE_URL`; seeded storage; DOM banners

- [ ] **Step 1: Write `test/notifications.mjs`**

Mirror `test/recover-gate.mjs` harness (`clearState`, `persistState`, `waitForApp`). Use `context.grantPermissions(["notifications"], { origin: BASE })` so the granted code path is exercised (headless otherwise auto-denies). Cases:

1. **Settings persist** — enable master + disable `missed`, reload, assert checkbox state.
2. **Overdue banner (soft variant)** — seed program Days 1–3; log **exactly one** session (Day 1, recent). One session means `usualHour` returns `null`, which deterministically forces the soft variant regardless of wall-clock hour. Open app with notifications enabled; assert `#sessionBanner` visible, no `is-missed` class, and `page.evaluate(() => RepForgeSchedule.mostOverdueDay(...))` matches the banner day.
3. **Missed variant (escalated)** — seed **two+** sessions whose `created` timestamps are at **00:00 local time** (build with `new Date(y,m,d,0,0).toISOString()` in the page, not a hard-coded Z string), so `usualHour` = 0 ≤ any current hour → escalation always on. Assert `#sessionBanner.is-missed`.
4. **Banner dismissal** — click `.sessionbanner__close`; assert banner hidden; reload; assert it stays hidden for the day (meta `repforge_notify_v1`).
5. **`?goto=Day 2`** — open `BASE+"?goto="+encodeURIComponent("Day 2")`; assert selected day tab `aria-selected="true"` and that `location.search` no longer contains `goto`.
6. **Unfinished reopen** — inject draft with `__done` and `__lastCommitAt: Date.now()-16*60*1000`; enable unfinished; reload; assert `document.body.dataset.unfinishedPrompt === "1"` and `#unfinishedBanner` visible.
7. **Unfinished single-reminder** — after case 6, reload again without changing the draft; assert the prompt does **not** reappear (`unfinishedPromptedFor` matches).

- [ ] **Step 2: Run**

```bash
python3 -m http.server 8000
# other terminal:
cd test && node notifications.mjs
node ../test/schedule.mjs   # or from repo root: node test/schedule.mjs
```

Expected: all ✓, exit 0.

- [ ] **Step 3: Commit**

```bash
git add test/notifications.mjs app.js
git commit -m "Add Playwright checks for notification surfaces"
```

---

### Task 9: Spec status + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-31-notifications-design.md`

- [ ] **Step 1: Full gate**

```bash
node --check schedule.js notify.js app.js sw.js
node test/schedule.mjs
# server: python3 -m http.server 8000 (repo root, leave running)
cd test && node notifications.mjs
node simulation.mjs   # full existing regression suite — new Log-tab markup must not break it
```

Expected: all exit 0, simulation reports `FAILED: 0`. If `simulation.mjs` fails on selectors that assume the previous Log-tab structure, fix the markup or update the selector — do not skip the suite.

- [ ] **Step 2: Mark spec implemented**

Update the design doc status line to Implemented and point at the branch/PR.

- [ ] **Step 3: Final commit**

```bash
git add docs/superpowers/specs/2026-07-31-notifications-design.md
git commit -m "Mark notifications design implemented"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Rest timer OS + in-app | Task 4 |
| Today’s session first-open banner | Task 5 |
| Infer by longest-since-completed (not weekday) | Task 1 + 5 |
| Unfinished 15 min + cancel on save + reopen fallback | Task 6 |
| Missed day after usual hour | Task 5 |
| Master + 4 toggles | Task 3 |
| Backend-less / no Web Push | Global + all tasks |
| `schedule.js` + `notify.js` split | Tasks 1–2 |
| SW notificationclick + deep link | Task 7 |
| Empty log → no banner | Task 1 + 5 |
| Tests | Tasks 1, 8, 9 |
| Honest iOS/best-effort copy | Task 3 Settings lede |

## Tags / keys reference

| Kind | Value |
|------|--------|
| OS tag rest | `repforge-rest` |
| OS tag unfinished | `repforge-unfinished` |
| Draft field | `__lastCommitAt` (ms number; carried by `saveDraft` from module `lastCommitAt`) |
| Meta key | `repforge_notify_v1` — `{sessionBannerDate, sessionBannerDismissed, missedBannerDate, missedBannerDismissed, unfinishedPromptedFor}` |
| Settings | `state.settings.notify.{enabled,timer,session,unfinished,missed}` |
| Deep link | `?goto=<program day label>` |

## Known edges (accepted, documented)

- **Tie-break order is `days()` order** — the label-sorted list (`localeCompare` numeric), not template order. For default `Day N` labels these coincide; renamed labels sort alphabetically.
- **Renamed day labels orphan their history**: a renamed day has no log rows under the new label, so it counts as never-logged (= most overdue) until first logged under the new name.
- **Background timers are best-effort**: a frozen/locked tab (especially iOS) may never run the tick that fires the rest/unfinished OS notification; the reopen fallback and in-app done state are the safety net.
- **`usualHour` lags schedule changes** (median over all history). Acceptable for v1.
