/* Taurifer native-feel prototype: the native layer.
   Prototype code, not production. One file so each demo can load it with a relative URL.
   Every spring is one of the app's named settings (interaction-runtime-audit.md, The motion vocabulary),
   plus one proposed addition, pressRelease, which only the CSS release curve uses. */
(function () {
  "use strict";
  const N = (window.NF = {});
  const html = document.documentElement;

  /* ---------- Prototype preferences (shared by index, app and lab) ---------- */
  const PREF_KEY = "nf-prefs-v1";
  const DEFAULTS = { theme: "light", text: "100", motion: "full", tip: "anchored", swipe: "auto", wheel: "on", lang: "en", dayUndo: "on", dockLabels: "cap" };
  N.prefs = Object.assign({}, DEFAULTS, safeJSON(localStorage.getItem(PREF_KEY)));
  function safeJSON(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
  N.setPref = (k, v) => { N.prefs[k] = v; localStorage.setItem(PREF_KEY, JSON.stringify(N.prefs)); N.applyPrefs(); document.dispatchEvent(new CustomEvent("nf:prefs", { detail: { k, v } })); };
  N.applyPrefs = () => {
    const p = N.prefs;
    const dark = p.theme === "dark" || (p.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    html.dataset.theme = dark ? "dark" : "light";
    html.classList.toggle("t200", p.text === "200");
    html.classList.toggle("rm", p.motion === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches);
    html.classList.toggle("dock-labels-hidden", p.dockLabels === "hide");
    html.lang = p.lang === "pt" ? "pt-BR" : "en";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#141310" : "#F4F2EF";
  };
  N.applyPrefs();
  N.rm = () => html.classList.contains("rm");
  N.standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  /* ---------- Springs: physics, not durations ---------- */
  N.SPRINGS = {
    gestureSettle: { k: 600, c: 40 }, // a surface the thumb released, returning to rest (ζ≈0.82)
    gestureExit: { k: 700, c: 53 },   // a surface leaving because the gesture asked it to (ζ≈1.0)
    navPush: { k: 700, c: 53 },       // a page pushed by a tap or carried off by a committed swipe
    layoutShift: { k: 600, c: 48 },   // an indicator or a row travelling with no gesture behind it
    pressRelease: { k: 900, c: 42 },  // PROPOSED: a pressed control returning to rest (ζ≈0.7)
  };

  class Spring {
    constructor(value, onUpdate) { this.x = value; this.v = 0; this.onUpdate = onUpdate; this.raf = 0; this._res = null; }
    get running() { return !!this.raf; }
    set(x) { this.stop(); this.x = x; this.v = 0; this.onUpdate(x); }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; const r = this._res; this._res = null; r && r(false); }
    to(target, cfg = N.SPRINGS.gestureSettle, velocity) {
      // Starts from the live value and keeps the live velocity unless the caller hands one over.
      if (this.raf) cancelAnimationFrame(this.raf);
      const prev = this._res; this._res = null; prev && prev(false);
      if (velocity != null) this.v = velocity;
      this.target = target;
      if (N.rm()) { this.x = target; this.v = 0; this.onUpdate(target); this.raf = 0; return Promise.resolve(true); }
      return new Promise((res) => {
        this._res = res;
        let last = performance.now();
        const step = (t) => {
          const dt = Math.min((t - last) / 1000, 1 / 30); last = t;
          const n = 4, h = dt / n;
          for (let i = 0; i < n; i++) { const a = -cfg.k * (this.x - target) - cfg.c * this.v; this.v += a * h; this.x += this.v * h; }
          if (Math.abs(this.x - target) < 0.4 && Math.abs(this.v) < 12) {
            this.x = target; this.v = 0; this.onUpdate(this.x); this.raf = 0; const r = this._res; this._res = null; r && r(true); return;
          }
          this.onUpdate(this.x);
          this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
      });
    }
  }
  N.Spring = Spring;

  // Apple's exponential projection (Designing Fluid Interfaces), the app's decelerationRate 0.998.
  N.project = (v, d = 0.998) => (v / 1000) * d / (1 - d);
  N.rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  N.clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // A CSS linear() curve sampled from a spring, so the press release is a spring without a JS loop.
  N.linearSpring = ({ k, c }, ms = 420) => {
    let x = 0, v = 0; const pts = []; const h = 1 / 240;
    for (let t = 0, i = 0; t <= ms / 1000; t += h, i++) {
      if (i % 6 === 0) pts.push(+x.toFixed(4));
      const a = -k * (x - 1) - c * v; v += a * h; x += v * h;
    }
    pts.push(1);
    return `linear(${pts.join(",")})`;
  };
  html.style.setProperty("--ease-press-release", N.linearSpring(N.SPRINGS.pressRelease));
  html.style.setProperty("--ease-settle", N.linearSpring(N.SPRINGS.gestureSettle, 520));

  /* ---------- Velocity tracking ---------- */
  class Tracker {
    constructor() { this.s = []; }
    add(x, y) { const t = performance.now(); this.s.push({ x, y, t }); while (this.s.length > 2 && t - this.s[0].t > 100) this.s.shift(); }
    velocity() {
      const s = this.s; if (s.length < 2) return { x: 0, y: 0 };
      const a = s[0], b = s[s.length - 1];
      if (performance.now() - b.t > 100) return { x: 0, y: 0 }; // the thumb stopped before letting go
      const dt = Math.max(b.t - a.t, 8) / 1000;
      return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
    }
  }

  /* ---------- One gesture recogniser (touch first, mouse for desktop review) ----------
     decide(dx, dy, target) runs once the pointer has moved past the 10px lock and returns true to claim.
     A claimed touch calls preventDefault so the scroller does not also move; an unclaimed one belongs to
     the browser. touchcancel never commits. */
  N.gesture = (el, h) => {
    let st = null;
    const LOCK = 10;
    const start = (x, y, target, kind) => {
      if (h.filter && !h.filter(target, x, y)) return;
      st = { x0: x, y0: y, claimed: false, decided: false, target, tr: new Tracker(), kind };
      st.tr.add(x, y);
      h.down && h.down(x, y, target);
    };
    const move = (x, y, e) => {
      if (!st) return;
      const dx = x - st.x0, dy = y - st.y0;
      st.tr.add(x, y);
      if (!st.decided) {
        if (h.early && e.cancelable && h.early(dx, dy, st.target)) e.preventDefault();
        if (Math.hypot(dx, dy) < LOCK) return;
        st.decided = true; st.claimed = !!h.decide(dx, dy, st.target);
        if (!st.claimed) { st = null; return; }
        h.start && h.start(dx, dy, st.target);
      }
      if (st.claimed) { if (e.cancelable) e.preventDefault(); h.move(dx, dy); }
    };
    const end = (cancelled) => {
      if (!st) return;
      const s = st; st = null;
      if (!s.claimed) { h.up && h.up(); return; }
      if (cancelled) { h.cancel ? h.cancel() : h.end(0, 0, true); return; }
      const v = s.tr.velocity(); h.end(v.x, v.y, false);
    };
    el.addEventListener("touchstart", (e) => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target, "touch"); else end(true); }, { passive: true });
    el.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY, e); }, { passive: false });
    el.addEventListener("touchend", () => end(false));
    el.addEventListener("touchcancel", () => end(true));
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.sourceCapabilities?.firesTouchEvents) return;
      start(e.clientX, e.clientY, e.target, "mouse");
      const mm = (ev) => move(ev.clientX, ev.clientY, ev);
      const mu = () => { removeEventListener("mousemove", mm); removeEventListener("mouseup", mu); end(false); };
      addEventListener("mousemove", mm); addEventListener("mouseup", mu);
    });
    return { get active() { return !!(st && st.claimed); } };
  };

  /* ---------- Press feedback ----------
     Highlight on touch-down. Controls inside a scroller wait 60ms (iOS's delaysContentTouches, shortened)
     so a scroll that starts on a row does not flash it. Sliding off the control by more than 10px removes the
     highlight, sliding back restores it, and a release outside does nothing (the native click does not fire).
     The release is the pressRelease spring as a CSS linear() curve. */
  (function press() {
    let cur = null;
    const SLOP = 10;
    const inside = (el, x, y) => { const r = el.getBoundingClientRect(); return x > r.left - SLOP && x < r.right + SLOP && y > r.top - SLOP && y < r.bottom + SLOP; };
    const clear = () => { if (!cur) return; clearTimeout(cur.timer); cur.el.classList.remove("is-pressed"); cur = null; };
    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest("[data-press]");
      if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
      clear();
      cur = { el, x: e.clientX, y: e.clientY, id: e.pointerId };
      const scroller = el.closest("[data-scroll]");
      if (scroller && e.pointerType === "touch" && !el.hasAttribute("data-press-instant")) cur.timer = setTimeout(() => cur && cur.el.classList.add("is-pressed"), 60);
      else el.classList.add("is-pressed");
    }, true);
    document.addEventListener("pointermove", (e) => {
      if (!cur || e.pointerId !== cur.id) return;
      const scroller = cur.el.closest("[data-scroll]");
      if (scroller && Math.abs(e.clientY - cur.y) > SLOP) { clear(); return; } // it was a scroll
      cur.el.classList.toggle("is-pressed", inside(cur.el, e.clientX, e.clientY));
    }, true);
    ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, (e) => { if (cur && e.pointerId === cur.id) clear(); }, true));
    document.addEventListener("scroll", clear, true);
    // Keyboard: Space and Enter show the same pressed state.
    document.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && e.target.matches?.("[data-press]")) e.target.classList.add("is-pressed"); });
    document.addEventListener("keyup", (e) => { if (e.target.matches?.("[data-press]")) e.target.classList.remove("is-pressed"); });
  })();

  /* ---------- Focus management for modal layers ---------- */
  const modalStack = [];
  N.pushModal = (layer, opener) => {
    const root = document.getElementById("app") || document.body.firstElementChild;
    modalStack.push({ layer, opener, prevInert: [] });
    document.querySelectorAll("[data-modal-root], #app").forEach((el) => { if (!layer.contains(el) && el !== layer) { el.inert = true; } });
    modalStack.slice(0, -1).forEach((m) => (m.layer.inert = true));
  };
  N.popModal = (layer) => {
    const i = modalStack.findIndex((m) => m.layer === layer); if (i < 0) return;
    const [m] = modalStack.splice(i, 1);
    const top = modalStack[modalStack.length - 1];
    if (top) top.layer.inert = false;
    else document.querySelectorAll("[data-modal-root], #app").forEach((el) => (el.inert = false));
    if (m.opener && document.contains(m.opener)) m.opener.focus({ preventScroll: true });
  };
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    top.layer.dispatchEvent(new CustomEvent("nf:escape"));
  });

  /* ---------- Sheets with detents ----------
     detents: any of "fit" (content height), "medium" (half), "large" (full minus the top inset).
     The sheet follows the thumb 1:1, rubber-bands past its largest detent, projects the release
     with the exponential projection and snaps to the nearest detent or dismisses. The body scrolls
     at the large detent; a downward drag that starts with the body at its top moves the sheet. */
  N.sheet = (opts) => {
    const { title, body, detents = ["medium", "large"], initial, onClose, onDismissAttempt, opener, labelledBy, className = "", header, pushBack = false, scroller } = opts;
    const layer = document.createElement("div");
    layer.className = "nf-layer";
    layer.setAttribute("data-modal-root", "");
    layer.innerHTML = `<div class="nf-scrim"></div><section class="nf-sheet ${className}" role="dialog" aria-modal="true" tabindex="-1"><div class="nf-grabber" aria-hidden="true"></div><div class="nf-sheet__head"></div><div class="nf-sheet__body" data-scroll></div></section>`;
    const scrim = layer.firstElementChild, sheet = layer.lastElementChild;
    let head = sheet.querySelector(".nf-sheet__head");
    const bodyEl = sheet.querySelector(".nf-sheet__body");
    if (header) { head.replaceWith(header); head = header; } else head.remove();
    if (typeof body === "string") bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
    if (labelledBy) sheet.setAttribute("aria-labelledby", labelledBy); else if (title) sheet.setAttribute("aria-label", title);
    document.body.append(layer);
    const app = document.getElementById("app");
    const H = () => window.visualViewport ? visualViewport.height : innerHeight;
    const topInset = () => Math.max(10, parseFloat(getComputedStyle(html).getPropertyValue("--sat")) || 0) + 10;
    const sheetH = () => H() - topInset();
    sheet.style.height = sheetH() + "px";
    const offsetFor = (d) => {
      const sh = sheetH();
      if (d === "large") return 0;
      if (d === "medium") return Math.round(sh - Math.min(sh, H() * 0.52));
      if (d === "fit") { bodyEl.style.flex = "none"; const need = (head.isConnected ? head.offsetHeight : 0) + bodyEl.scrollHeight + 14; bodyEl.style.flex = ""; return Math.max(0, sh - need); }
      return sh;
    };
    let detent = initial || detents[0];
    const stops = () => detents.map((d) => ({ d, y: offsetFor(d) }));
    const closedY = () => sheetH() + 30;
    const spring = new Spring(closedY(), (y) => paint(y));
    function paint(y) {
      sheet.style.transform = `translate3d(0,${y}px,0)`;
      const smallest = Math.max(...stops().map((s) => s.y));
      const p = N.clamp(1 - (y - Math.min(smallest, sheetH() * 0.6)) / (closedY() - Math.min(smallest, sheetH() * 0.6)), 0, 1);
      scrim.style.opacity = p;
      if (pushBack && app) {
        const large = 1 - N.clamp(y / Math.max(1, offsetFor("medium") || sheetH() * 0.5), 0, 1);
        const s = 1 - 0.06 * large * p;
        app.style.transform = large > 0.001 ? `scale(${s}) translateY(${8 * large}px)` : "";
        app.style.borderRadius = large > 0.001 ? `${14 * large}px` : "";
        app.style.overflow = large > 0.001 ? "hidden" : "";
      }
      bodyEl.classList.toggle("is-scrollable", y <= 1 && detents.includes("large") || !detents.includes("large") && detents.length === 1);
    }
    let closing = false;
    const api = {
      el: sheet, layer, body: bodyEl,
      get detent() { return detent; },
      snap(d, v) { detent = d; return spring.to(offsetFor(d), N.SPRINGS.gestureSettle, v); },
      close(v, reason) {
        if (closing) return Promise.resolve();
        closing = true;
        sheet.classList.add("is-closing");
        const done = () => { layer.remove(); if (pushBack && app) { app.style.transform = ""; app.style.borderRadius = ""; app.style.overflow = ""; } N.popModal(layer); onClose && onClose(reason); };
        if (N.rm()) { layer.classList.add("rm-out"); setTimeout(done, 180); return Promise.resolve(); }
        return spring.to(closedY(), N.SPRINGS.gestureExit, v || 0).then(done);
      },
      reopen() { closing = false; sheet.classList.remove("is-closing"); },
    };
    const tryDismiss = (v) => {
      if (onDismissAttempt && onDismissAttempt() === false) { api.snap(detent, v); return; }
      api.close(v, "swipe");
    };
    scrim.addEventListener("click", () => tryDismiss(0));
    layer.addEventListener("nf:escape", () => tryDismiss(0));
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => api.close(0, "button")));

    const scrollerEl = () => (scroller && scroller()) || bodyEl;
    let y0 = 0;
    N.gesture(sheet, {
      filter: (t) => !t.closest("[data-no-sheet-drag]"),
      early: (dx, dy, t) => { const sc = scrollerEl(); return sc.contains(t) && sc.scrollTop <= 0 && dy > 0 && Math.abs(dy) > Math.abs(dx); },
      decide(dx, dy, t) {
        if (Math.abs(dx) > Math.abs(dy)) return false;
        const sc = scrollerEl();
        if (sc.contains(t) && bodyEl.classList.contains("is-scrollable")) {
          if (dy < 0 || sc.scrollTop > 0) return false; // the content scrolls
        }
        return true;
      },
      start() { y0 = spring.x; spring.stop(); sheet.classList.add("is-dragging"); },
      move(dx, dy) {
        let y = y0 + dy;
        const top = Math.min(...stops().map((s) => s.y));
        if (y < top) y = top - N.rubberband(top - y, H());
        if (onDismissAttempt && y > offsetFor(detent)) { const base = offsetFor(detent); y = base + N.rubberband(y - base, H() * 0.6); }
        spring.set(y);
      },
      end(vx, vy, cancelled) {
        sheet.classList.remove("is-dragging");
        if (cancelled) { api.snap(detent, 0); return; }
        const projected = spring.x + N.project(vy);
        const cands = stops().concat([{ d: "__close", y: closedY() }]);
        let best = cands[0];
        for (const c of cands) if (Math.abs(c.y - projected) < Math.abs(best.y - projected)) best = c;
        // A flick down past the smallest detent dismisses even if the projection falls short.
        if (vy > 1100 && spring.x > Math.max(...stops().map((s) => s.y)) - 20) best = { d: "__close" };
        if (best.d === "__close") tryDismiss(vy); else api.snap(best.d, vy);
      },
      cancel() { sheet.classList.remove("is-dragging"); api.snap(detent, 0); },
    });

    N.pushModal(layer, opener || document.activeElement);
    paint(closedY());
    requestAnimationFrame(() => {
      if (N.rm()) { layer.classList.add("rm-in"); spring.set(offsetFor(detent)); }
      else spring.to(offsetFor(detent), N.SPRINGS.navPush, 0);
      const focusTarget = sheet.querySelector("[data-autofocus]") || sheet.querySelector("h2,h3") || sheet;
      if (focusTarget.matches("h2,h3")) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    });
    window.visualViewport && visualViewport.addEventListener("resize", () => { if (!closing) { sheet.style.height = sheetH() + "px"; spring.set(offsetFor(detent)); } });
    return api;
  };

  /* ---------- Action sheet ---------- */
  N.actionSheet = ({ title, message, actions, cancelLabel = "Cancel", opener }) => new Promise((resolve) => {
    const layer = document.createElement("div");
    layer.className = "nf-layer nf-layer--action";
    layer.setAttribute("data-modal-root", "");
    const id = "as" + Math.random().toString(36).slice(2, 7);
    layer.innerHTML = `<div class="nf-scrim"></div><div class="nf-action" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="nf-action__group">${title || message ? `<div class="nf-action__head" id="${id}">${title ? `<p class="nf-action__title">${title}</p>` : ""}${message ? `<p class="nf-action__msg">${message}</p>` : ""}</div>` : `<span id="${id}" class="sr-only">${cancelLabel}</span>`}
      ${actions.map((a, i) => `<button class="nf-action__btn ${a.destructive ? "is-destructive" : ""}" data-press data-press-instant data-i="${i}">${a.label}</button>`).join("")}</div>
      <button class="nf-action__btn nf-action__cancel" data-press data-press-instant data-i="-1">${cancelLabel}</button></div>`;
    document.body.append(layer);
    const panel = layer.querySelector(".nf-action"), scrim = layer.firstElementChild;
    const s = new Spring(1, (p) => { panel.style.transform = `translate3d(0,${p * (panel.offsetHeight + 40)}px,0)`; scrim.style.opacity = 1 - p; });
    s.set(1);
    N.pushModal(layer, opener || document.activeElement);
    const finish = (i) => {
      if (layer.dataset.done) return; layer.dataset.done = 1;
      const out = () => { layer.remove(); N.popModal(layer); resolve(i >= 0 ? actions[i].value ?? i : null); };
      if (N.rm()) { layer.classList.add("rm-out"); setTimeout(out, 160); } else s.to(1, N.SPRINGS.gestureExit, 0).then(out);
    };
    layer.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) finish(+b.dataset.i); else if (e.target === scrim) finish(-1); });
    layer.addEventListener("nf:escape", () => finish(-1));
    requestAnimationFrame(() => { if (N.rm()) { layer.classList.add("rm-in"); s.set(0); } else s.to(0, N.SPRINGS.navPush, 0); layer.querySelector(".nf-action__btn").focus({ preventScroll: true }); });
  });

  /* ---------- Context menu (long press) and pull-down menu (tap) ----------
     Long press: 450ms without moving 10px lifts a copy of the row over a blurred page and opens the menu by it.
     While the finger is still down it can slide onto an item and release to choose, as on iOS. */
  N.menu = ({ anchor, items, lift = false, point }) => new Promise((resolve) => {
    const layer = document.createElement("div");
    layer.className = "nf-layer nf-layer--menu" + (lift ? " is-lift" : "");
    layer.setAttribute("data-modal-root", "");
    const r = anchor.getBoundingClientRect();
    let ghost = null;
    if (lift) {
      ghost = anchor.cloneNode(true);
      ghost.classList.add("nf-ghost"); ghost.removeAttribute("id"); ghost.setAttribute("aria-hidden", "true"); ghost.inert = true;
      Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    }
    layer.innerHTML = `<div class="nf-menu-backdrop"></div><div class="nf-menu" role="menu">${items.map((it, i) => it.sep ? `<div class="nf-menu__sep" role="separator"></div>` : `<button role="menuitem" class="nf-menu__item ${it.destructive ? "is-destructive" : ""}" data-press data-press-instant data-i="${i}" ${it.checked != null ? `aria-checked="${!!it.checked}" role="menuitemradio"` : ""}><span>${it.label}</span>${it.checked ? '<span class="icon-mask icon-mask--check nf-ic" aria-hidden="true"></span>' : it.icon ? `<span class="icon-mask ${it.icon} nf-ic" aria-hidden="true"></span>` : ""}</button>`).join("")}</div>`;
    if (ghost) layer.insertBefore(ghost, layer.children[1]);
    document.body.append(layer);
    const menu = layer.querySelector(".nf-menu");
    const mh = menu.offsetHeight, mw = menu.offsetWidth, vh = innerHeight, vw = innerWidth;
    const below = r.bottom + 8 + mh < vh - 20;
    let top = below ? r.bottom + 8 : r.top - 8 - mh;
    if (top < 20) { top = 20; }
    let left = point ? point.x - mw / 2 : (r.left + mw > vw - 12 ? r.right - mw : r.left);
    left = N.clamp(left, 12, vw - mw - 12);
    if (lift) left = N.clamp(r.left + 8, 12, vw - mw - 12);
    if (!lift && anchor.closest(".nf-navbar,.navbar")) left = N.clamp(r.right - mw, 12, vw - mw - 12);
    Object.assign(menu.style, { top: top + "px", left: left + "px", transformOrigin: `${N.clamp(r.left + r.width / 2 - left, 0, mw)}px ${below ? 0 : mh}px` });
    N.pushModal(layer, anchor);
    const s = new Spring(0, (p) => {
      menu.style.transform = `scale(${0.6 + 0.4 * p})`; menu.style.opacity = Math.min(1, p * 1.6);
      layer.firstElementChild.style.opacity = Math.min(1, p);
      if (ghost) ghost.style.transform = `scale(${1 + 0.03 * p})`;
    });
    s.set(0);
    requestAnimationFrame(() => { if (N.rm()) s.set(1); else s.to(1, N.SPRINGS.gestureSettle, 0); menu.querySelector("[role^=menuitem]")?.focus({ preventScroll: true }); });
    const close = (i) => {
      if (layer.dataset.done) return; layer.dataset.done = 1;
      const out = () => { layer.remove(); N.popModal(layer); resolve(i != null && i >= 0 ? (items[i].value ?? i) : null); };
      if (N.rm()) out(); else s.to(0, N.SPRINGS.gestureExit, 0).then(out);
    };
    layer.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) close(+b.dataset.i); else close(null); });
    layer.addEventListener("nf:escape", () => close(null));
    menu.addEventListener("keydown", (e) => {
      const btns = [...menu.querySelectorAll("[role^=menuitem]")]; const i = btns.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    });
    // Slide-to-select while the long-press finger is still down.
    layer._slide = (x, y, up) => {
      const el = document.elementFromPoint(x, y)?.closest?.(".nf-menu__item");
      menu.querySelectorAll(".nf-menu__item").forEach((b) => b.classList.toggle("is-pressed", b === el && !up));
      if (up && el) close(+el.dataset.i);
    };
    N._activeMenuLayer = layer;
  });

  N.longPress = (el, handler, { delay = 450 } = {}) => {
    let t = 0, x0 = 0, y0 = 0, fired = false;
    el.addEventListener("touchstart", (e) => {
      fired = false; const p = e.touches[0]; x0 = p.clientX; y0 = p.clientY;
      t = setTimeout(() => { fired = true; el.classList.remove("is-pressed"); handler({ x: x0, y: y0 }); }, delay);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const p = e.touches[0];
      if (!fired) { if (Math.hypot(p.clientX - x0, p.clientY - y0) > 10) clearTimeout(t); return; }
      if (e.cancelable) e.preventDefault();
      N._activeMenuLayer?._slide?.(p.clientX, p.clientY, false);
    }, { passive: false });
    el.addEventListener("touchend", (e) => {
      clearTimeout(t);
      if (fired) { e.preventDefault(); const p = e.changedTouches[0]; if (Math.hypot(p.clientX - x0, p.clientY - y0) > 10) N._activeMenuLayer?._slide?.(p.clientX, p.clientY, true); }
    });
    el.addEventListener("touchcancel", () => clearTimeout(t));
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!fired) handler({ x: e.clientX, y: e.clientY }); });
    el.addEventListener("click", (e) => { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); fired = false; } }, true);
    el.addEventListener("keydown", (e) => { if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") { e.preventDefault(); const r = el.getBoundingClientRect(); handler({ x: r.left + r.width / 2, y: r.bottom }); } });
  };

  /* ---------- Toast ---------- */
  N.toast = (msg, { action, onAction, ms = 4000 } = {}) => {
    document.querySelector(".nf-toast")?.remove();
    const t = document.createElement("div");
    t.className = "nf-toast"; t.setAttribute("role", "status");
    t.innerHTML = `<span>${msg}</span>${action ? `<button data-press data-press-instant class="nf-toast__act">${action}</button>` : ""}`;
    (document.getElementById("app") || document.body).append(t);
    const s = new Spring(1, (p) => { t.style.transform = `translate3d(-50%,${p * 24}px,0)`; t.style.opacity = 1 - p; });
    s.set(1); requestAnimationFrame(() => s.to(0, N.SPRINGS.gestureSettle, 0));
    let timer = setTimeout(() => out(), ms);
    const out = () => { clearTimeout(timer); s.to(1, N.SPRINGS.gestureExit, 0).then(() => t.remove()); };
    t.querySelector("button")?.addEventListener("click", () => { onAction && onAction(); out(); });
    return out;
  };

  /* ---------- Native-style controls ---------- */
  // Switch: a button[role=switch]. The thumb follows a drag and snaps; a tap toggles.
  N.mountSwitches = (root = document) => root.querySelectorAll(".nf-switch:not([data-m])").forEach((sw) => {
    sw.dataset.m = 1;
    sw.addEventListener("click", () => { const on = sw.getAttribute("aria-checked") !== "true"; sw.setAttribute("aria-checked", on); sw.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: on })); });
  });

  // Segmented control: role=radiogroup, a sliding thumb on the layoutShift spring, arrow keys move the choice.
  N.mountSegmented = (root = document) => root.querySelectorAll(".nf-seg:not([data-m])").forEach((seg) => {
    seg.dataset.m = 1;
    const thumb = document.createElement("span"); thumb.className = "nf-seg__thumb"; thumb.setAttribute("aria-hidden", "true"); seg.prepend(thumb);
    const opts = () => [...seg.querySelectorAll("[role=radio]")];
    const sx = new Spring(0, (x) => (thumb.style.transform = `translateX(${x}px)`));
    const place = (animate) => {
      const sel = opts().find((o) => o.getAttribute("aria-checked") === "true") || opts()[0];
      thumb.style.width = sel.offsetWidth + "px";
      const x = sel.offsetLeft - 2;
      animate ? sx.to(x, N.SPRINGS.layoutShift) : sx.set(x);
    };
    const choose = (o, focus) => {
      opts().forEach((b) => { b.setAttribute("aria-checked", b === o); b.tabIndex = b === o ? 0 : -1; });
      place(true); if (focus) o.focus();
      seg.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: o.dataset.value }));
    };
    opts().forEach((o) => { o.tabIndex = o.getAttribute("aria-checked") === "true" ? 0 : -1; o.addEventListener("click", () => choose(o)); });
    seg.addEventListener("keydown", (e) => {
      const os = opts(), i = os.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); choose(os[(i + 1) % os.length], true); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); choose(os[(i - 1 + os.length) % os.length], true); }
    });
    // Drag the thumb across segments, as UISegmentedControl allows.
    let dragging = false;
    seg.addEventListener("pointerdown", (e) => { const o = e.target.closest("[role=radio]"); dragging = o && o.getAttribute("aria-checked") === "true"; if (dragging) seg.classList.add("is-thumb-pressed"); });
    seg.addEventListener("pointermove", (e) => {
      if (!dragging) return; const o = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[role=radio]");
      if (o && seg.contains(o) && o.getAttribute("aria-checked") !== "true") choose(o);
    });
    addEventListener("pointerup", () => { dragging = false; seg.classList.remove("is-thumb-pressed"); });
    new ResizeObserver(() => place(false)).observe(seg);
    requestAnimationFrame(() => place(false));
  });

  // Stepper: − value +, press and hold repeats (after 400ms, then every 90ms, speeding up), like UIStepper.
  N.mountSteppers = (root = document) => root.querySelectorAll(".nf-stepper:not([data-m])").forEach((st) => {
    st.dataset.m = 1;
    const out = st.querySelector("output");
    const min = +st.dataset.min, max = +st.dataset.max, step = +st.dataset.step;
    const fmt = st.dataset.format === "time" ? (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : (v) => (st.dataset.decimals ? v.toFixed(+st.dataset.decimals) : String(v));
    let v = +st.dataset.value;
    const render = () => { out.textContent = fmt(v) + (st.dataset.unit ? " " + st.dataset.unit : ""); st.querySelector("[data-d='-1']").disabled = v <= min; st.querySelector("[data-d='1']").disabled = v >= max; st.dataset.value = v; };
    const bump = (d) => { const nv = N.clamp(Math.round((v + d * step) * 1000) / 1000, min, max); if (nv === v) return false; v = nv; render(); out.classList.remove("is-tick"); void out.offsetWidth; out.classList.add("is-tick"); st.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: v })); return true; };
    st.querySelectorAll("button").forEach((b) => {
      let t = 0, iv = 0, repeated = false;
      const stop = () => { clearTimeout(t); clearInterval(iv); };
      b.addEventListener("pointerdown", () => {
        repeated = false; stop();
        t = setTimeout(() => { let n = 0; iv = setInterval(() => { repeated = true; if (!bump(+b.dataset.d)) stop(); if (++n === 12) { clearInterval(iv); iv = setInterval(() => bump(+b.dataset.d) || stop(), 45); } }, 90); }, 400);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
      b.addEventListener("click", () => { if (!repeated) bump(+b.dataset.d); repeated = false; });
    });
    render();
  });

  // Wheel picker: a native scroll-snap column, so the momentum is the platform's own. Items tilt by distance
  // from the centre. role=spinbutton with arrow keys for keyboards and VoiceOver's adjustable rotor.
  N.wheel = ({ values, value, format = String, label, onChange }) => {
    const col = document.createElement("div");
    col.className = "nf-wheel";
    col.setAttribute("role", "spinbutton"); col.tabIndex = 0;
    col.setAttribute("aria-label", label);
    col.innerHTML = `<div class="nf-wheel__band" aria-hidden="true"></div><div class="nf-wheel__scroll" data-scroll aria-hidden="true"><div class="nf-wheel__pad"></div>${values.map((v) => `<div class="nf-wheel__item">${format(v)}</div>`).join("")}<div class="nf-wheel__pad"></div></div>`;
    const sc = col.querySelector(".nf-wheel__scroll"), items = [...col.querySelectorAll(".nf-wheel__item")];
    let idx = Math.max(0, values.indexOf(value)), raf = 0;
    const itemH = () => items[0].offsetHeight;
    const paint = () => {
      raf = 0; const c = sc.scrollTop / itemH();
      items.forEach((it, i) => { const d = i - c; if (Math.abs(d) > 4) { it.style.visibility = "hidden"; return; } it.style.visibility = ""; it.style.transform = `rotateX(${-d * 18}deg) translateZ(0)`; it.style.opacity = String(1 - Math.min(Math.abs(d) * 0.22, 0.8)); });
      const ni = N.clamp(Math.round(c), 0, values.length - 1);
      if (ni !== idx) { idx = ni; col.setAttribute("aria-valuenow", values[idx]); col.setAttribute("aria-valuetext", format(values[idx])); onChange && onChange(values[idx]); }
    };
    sc.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    items.forEach((it, i) => it.addEventListener("click", () => sc.scrollTo({ top: i * itemH(), behavior: N.rm() ? "auto" : "smooth" })));
    col.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0; if (!d) return; e.preventDefault();
      sc.scrollTo({ top: N.clamp(idx + d, 0, values.length - 1) * itemH(), behavior: "auto" });
    });
    col.setAttribute("aria-valuenow", values[idx]); col.setAttribute("aria-valuetext", format(values[idx]));
    col.mount = () => { sc.scrollTop = idx * itemH(); paint(); };
    col.get = () => values[idx];
    return col;
  };

  /* ---------- Safe area and keyboard ---------- */
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
  document.addEventListener("DOMContentLoaded", () => {
    document.body.append(probe);
    html.style.setProperty("--sat", probe.offsetHeight + "px");
    N.mountSwitches(); N.mountSegmented(); N.mountSteppers();
  });
  if (window.visualViewport) {
    const kb = () => { const k = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop); html.style.setProperty("--kb", k + "px"); html.style.setProperty("--vvh", visualViewport.height + "px"); };
    visualViewport.addEventListener("resize", kb); visualViewport.addEventListener("scroll", kb); kb();
  }
})();
