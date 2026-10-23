/* The "after" prototype: Today → Focus → summary, Settings, the Program editor sheet and the dock,
   on the native layer in native.js. Representative data; no storage beyond the prototype's own prefs. */
(function () {
  "use strict";
  const N = window.NF;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (str) => { const t = document.createElement("template"); t.innerHTML = str.trim(); return t.content.firstElementChild; };
  const app = $("#app");
  const W = () => app.clientWidth;

  const UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V5M5 11l7-7 7 7"/></svg>';
  const HOLD = '<span class="icon-mask" style="width:14px;height:14px;-webkit-mask-image:var(--verdict-hold);mask-image:var(--verdict-hold)" aria-hidden="true"></span>';
  const MORE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  const TIMER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>';
  const GRIP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>';
  const closeBtn = (label = "Close") => `<button class="closebtn" data-press data-close aria-label="${label}"><span><i class="icon-mask icon-mask--close"></i></span></button>`;
  const fmtKg = (v) => (Math.round(v * 10) / 10).toString();
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

  /* ---------------- Data ---------------- */
  const DAYS = [
    { n: 1, name: "Glutes · Chest · Hamstrings", count: 5 },
    { n: 2, name: "Hamstrings · Biceps · Front delts", count: 5 },
    { n: 3, name: "Quads · Chest · Lats", count: 5 },
    { n: 4, name: "Day 2 · mixed", count: 6, sub: "Hamstrings · Glutes · Triceps" },
  ];
  const EX = [
    { id: "squat", name: "Barbell back squat", pt: "Agachamento livre com barra", v: "up", kg: 102.5, target: 105, reps: 6, sets: 3, tg: "3 × 6", last: "Last 100 × 8, 8, 8", prev: [[102.5, 7, 1], [102.5, 6, 1], [102.5, 6, 1]] },
    { id: "bench", name: "Barbell bench press", pt: "Supino reto com barra", v: "hold", kg: 80, target: 80, reps: 6, sets: 3, tg: "3 × 6", last: "Last 80 × 7, 6, 6", prev: [[80, 7, 1], [80, 6, 1], [80, 6, 2]] },
    { id: "curl", name: "Seated leg curl", pt: "Mesa flexora sentada", v: "up", kg: 45, target: 45, reps: 9, sets: 2, tg: "2 × 9", last: "Last 42.5 × 12, 12", prev: [[42.5, 12, 1], [42.5, 12, 1]] },
    { id: "row", name: "Cable seated row", pt: "Remada sentada no cabo", v: "hold", kg: 55, target: 55, reps: 10, sets: 3, tg: "3 × 10", last: "Last 55 × 11, 10, 10", prev: [[55, 11, 1], [55, 10, 1], [55, 10, 2]] },
    { id: "lat", name: "Dumbbell lateral raise", pt: "Elevação lateral com halteres", v: "hold", kg: 10, target: 10, reps: 12, sets: 2, tg: "2 × 12", last: "Last 10 × 12, 11", prev: [[10, 12, 1], [10, 11, 1]] },
  ];
  const T = {
    en: { load: "Load", loadkg: "Load, kg", reps: "Reps", rir: "RIR", log: (n) => `Log set ${n}`, rest: "Rest", of: (t) => `of ${t}`, restDone: "Rest done", next: (n, l, r) => `Set ${n}: go up to ${l} kg, aim for ${r} reps`, set: "Set", kg: "kg", why: "Why this weight?", up: (l) => `Go up to ${l} kg`, aim: (r) => `aim for ${r} reps`, nextRow: (n) => `Next: <b>${n}</b>`, tipT: "Log your first set", tipB: "Enter the work you completed, then save the set. Taurifer keeps the next target ready.", skip: "Skip", last: (k, r, i) => `last ${k} × ${r} · RIR ${i}` },
    pt: { load: "Carga", loadkg: "Carga, kg", reps: "Reps", rir: "RIR", log: (n) => `Registrar série ${n}`, rest: "Descanso", of: (t) => `de ${t}`, restDone: "Descanso concluído", next: (n, l, r) => `Série ${n}: subir para ${l} kg, buscar ${r} reps`, set: "Série", kg: "kg", why: "Por quê?", up: (l) => `Subir para ${l} kg`, aim: (r) => `buscar ${r} reps`, nextRow: (n) => `Próximo: <b>${n}</b>`, tipT: "Registre sua primeira série", tipB: "Informe o trabalho concluído e salve a série. O Taurifer mantém a próxima meta pronta.", skip: "Pular", last: (k, r, i) => `antes ${k.toString().replace(".", ",")} × ${r} · RIR ${i}` },
  };
  const tr = () => T[N.prefs.lang === "pt" ? "pt" : "en"];
  const state = { day: 1, skipped: new Set(), workout: null, restSeconds: 120 };

  /* ---------------- History integration ----------------
     Each push adds a history entry so Safari's own back (button or edge swipe) pops the stack.
     A pop we started calls history.back() and ignores its popstate. A popstate we did not start is
     the browser's: right after a touch at the left edge it is Safari's swipe, which has already
     animated, so the page pops without a second animation. */
  let ignorePops = 0, lastEdgeTouch = -1e9;
  addEventListener("touchstart", (e) => { if (e.touches[0].clientX < 30) lastEdgeTouch = performance.now(); }, { passive: true, capture: true });
  addEventListener("popstate", () => {
    if (ignorePops > 0) { ignorePops--; return; }
    const st = stacks[activeTab];
    if (st.pages.length > 1) st.pop({ animated: performance.now() - lastEdgeTouch > 900, fromBrowser: true });
  });

  /* ---------------- Navigation stack ---------------- */
  const dock = $("#dock");
  const dockSpring = new N.Spring(0, (y) => { dock.style.transform = y ? `translate3d(0,${y}px,0)` : ""; dock.style.visibility = y > 150 ? "hidden" : ""; });

  class Stack {
    constructor(host) { this.host = host; this.pages = []; this.x = new N.Spring(0, (x) => this.paint(x)); this.anim = null; }
    get top() { return this.pages[this.pages.length - 1]; }
    get under() { return this.pages[this.pages.length - 2]; }
    paint(x) {
      const top = this.top, under = this.under; if (!top || !under) return;
      const w = W(), p = N.clamp(x / w, 0, 1);
      top.el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
      under.el.style.transform = p < 1 ? `translate3d(${-(1 - p) * w * 0.3}px,0,0)` : "";
      under.dim.style.opacity = 0.1 * (1 - p);
      if (top.hideDock && !under.hideDock) dockSpring.set((1 - p) * 140);
    }
    mount(page) {
      page.dim = h('<div class="page__dim" aria-hidden="true"></div>');
      page.el.append(page.dim);
      this.host.append(page.el);
      wirePage(page, this);
    }
    root(page) { this.mount(page); this.pages = [page]; }
    push(page) {
      const under = this.top;
      this.mount(page);
      this.pages.push(page);
      history.pushState({ nf: this.pages.length }, "");
      under.el.inert = true; under.el.classList.add("is-under");
      page.el.classList.add("is-moving");
      if (N.rm()) {
        this.x.set(0); this.finishPush(page);
        page.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "linear" });
        return;
      }
      this.x.set(W());
      this.x.to(0, N.SPRINGS.navPush, 0).then((done) => done && this.finishPush(page));
      page.onPush && page.onPush();
    }
    finishPush(page) {
      page.el.classList.remove("is-moving");
      const under = this.under; if (under) { under.el.style.transform = ""; under.dim.style.opacity = 0; under.el.style.visibility = "hidden"; }
      if (page.hideDock) dockSpring.set(140);
      const t = page.el.querySelector("[data-autofocus]") || page.el.querySelector("h1,h2");
      if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
    }
    beginInteractive() { const u = this.under; if (u) u.el.style.visibility = ""; this.top.el.classList.add("is-moving"); this.x.stop(); }
    pop({ animated = true, velocity = 0, fromBrowser = false } = {}) {
      if (this.pages.length < 2) return Promise.resolve();
      const top = this.top, under = this.under;
      under.el.style.visibility = "";
      if (!fromBrowser) { ignorePops++; history.back(); }
      top.el.classList.add("is-moving");
      top.el.inert = true;
      const finish = () => {
        top.onLeave && top.onLeave();
        this.pages.pop(); top.el.remove();
        under.el.inert = false; under.el.classList.remove("is-under"); under.el.style.transform = ""; under.dim.style.opacity = 0;
        if (top.hideDock && !under.hideDock) dockSpring.to(0, N.SPRINGS.navPush, 0);
        under.onReturn && under.onReturn();
        const back = under.el.querySelector("[data-return-focus]") || under.el.querySelector("h1");
        if (back) { back.tabIndex = back.tabIndex < 0 ? -1 : back.tabIndex; back.focus({ preventScroll: true }); }
      };
      if (!animated || N.rm()) {
        if (animated && N.rm()) top.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "linear" }).finished.then(finish);
        else finish();
        return Promise.resolve();
      }
      return this.x.to(W(), N.SPRINGS.navPush, velocity).then((done) => { if (done) finish(); });
    }
    popToRoot() { const n = this.pages.length - 2; for (let i = 0; i < n; i++) { const p = this.pages.splice(1, 1)[0]; p.el.remove(); ignorePops++; history.back(); } return this.pop(); }
  }

  // Large titles collapse into the bar; the bar's material appears only while content is under it.
  function wirePage(page, stack) {
    const sc = page.el.querySelector(".page__scroll"), bar = page.el.querySelector(".navbar"), lt = page.el.querySelector(".largetitle h1");
    if (sc && bar) {
      const on = () => {
        const y = sc.scrollTop;
        bar.classList.toggle("is-scrolled", y > 2);
        if (lt) {
          const r = lt.getBoundingClientRect(), b = bar.getBoundingClientRect();
          bar.classList.toggle("show-title", r.bottom < b.bottom + 2);
          lt.style.transform = y < 0 ? `scale(${Math.min(1.12, 1 - y / 900)})` : "";
        }
      };
      sc.addEventListener("scroll", on, { passive: true });
      requestAnimationFrame(on);
    }
    page.el.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => stack.pop()));
    // Interactive back: follows the finger, can be cancelled, projects the release.
    if (page.swipe !== false && stack.pages.length >= 1) {
      let startX = 0;
      N.gesture(page.el, {
        filter: (t, x) => { startX = x; return stack.top === page && stack.pages.length > 1 && !t.closest("[data-hscroll],.nf-seg,input"); },
        decide(dx, dy) {
          if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * 1.2) return false;
          const mode = N.prefs.swipe === "auto" ? (N.standalone() ? "edge" : "full") : N.prefs.swipe;
          return mode === "full" || startX <= 24;
        },
        start() { stack.beginInteractive(); this.x0 = stack.x.x; },
        move(dx) { stack.x.set(N.clamp((this.x0 || 0) + dx, 0, W())); },
        end(vx) {
          const projected = stack.x.x + N.project(vx);
          if (projected > W() / 2 && vx > -200) stack.pop({ velocity: vx });
          else stack.x.to(0, N.SPRINGS.gestureSettle, vx).then((d) => d && stack.finishPush(page));
        },
        cancel() { stack.x.to(0, N.SPRINGS.gestureSettle, 0).then((d) => d && stack.finishPush(page)); },
      });
    }
  }

  const pageShell = ({ id, title, back, trail = "", large = true, cls = "", lead = "", body = "", sub = "" }) => h(`
    <div class="page ${cls}" data-page="${id}">
      <header class="navbar"><div class="navbar__bg"></div><div class="navbar__row">
        <div class="navbar__lead">${back ? `<button class="backbtn" data-press data-back aria-label="Back to ${back}"><i class="chevron chevron--back"></i><span>${back}</span></button>` : lead}</div>
        <div class="navbar__title" aria-hidden="${large}">${title}</div>
        <div class="navbar__trail">${trail}</div></div></header>
      <div class="page__scroll" data-scroll><div class="page__inner">
        ${large ? `<div class="largetitle"><h1 class="t-title">${title}</h1>${sub}</div>` : ""}
        ${body}
      </div></div>
    </div>`);

  /* ---------------- Today ---------------- */
  function exRowHtml(e) {
    const sk = state.skipped.has(e.id);
    return `<button class="exrow" data-press data-ex="${e.id}" aria-haspopup="menu" aria-describedby="exhint" ${sk ? 'style="opacity:.45"' : ""}>
      <span class="vm ${e.v === "up" ? "up" : ""}" aria-label="${e.v === "up" ? "Go up" : "Hold"}">${e.v === "up" ? UP : HOLD}</span>
      <span><span class="nm">${e.name}</span><span class="last">${sk ? "Skipped today" : e.last}</span></span>
      <span class="kg">${fmtKg(e.kg)}</span><span class="tg">${e.tg}</span></button>`;
  }
  function todayPage() {
    const d = DAYS[state.day - 1];
    const page = { hideDock: false, swipe: false };
    page.el = pageShell({
      id: "today", title: "Today",
      trail: `<button class="iconbtn gear" data-press data-settings aria-label="Settings" data-return-focus><i class="icon-mask icon-mask--gear"></i></button>`,
      sub: `<p class="today-sub">Monday, August 31</p>`,
      body: `
        <div class="prog"><div><b>Full body</b><span class="t-cap">Week 4 of 6</span></div></div>
        <div class="weeks" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>
        <div class="dayhead"><h2 class="t-section" id="dayTitle">Day ${d.n}</h2>
          <button class="daycard-pill" data-press data-daypick aria-haspopup="dialog">Change day <i class="chevron"></i></button></div>
        <p class="verdicts"><span class="up">${UP} 2 go up</span><span>${HOLD} 3 hold</span></p>
        <div class="ledger-head t-label" aria-hidden="true"><span>Exercise</span><span>kg</span><span style="text-align:right">Target</span></div>
        <div class="exlist">${EX.map(exRowHtml).join("")}</div>
        <p class="sr-only" id="exhint">Touch and hold for actions</p>
        <div style="height:90px"></div>`,
    });
    const cta = h(`<div class="cta-wrap"><button class="btn btn--primary" data-press data-press-instant data-start>Start workout <i class="arrow"></i></button></div>`);
    page.el.append(cta);
    const wire = () => {
      page.el.querySelectorAll(".exrow").forEach((row) => {
        const e = EX.find((x) => x.id === row.dataset.ex);
        const open = () => exMenu(row, e);
        N.longPress(row, open);
        row.addEventListener("click", () => openWhy(e, row));
      });
    };
    wire();
    page.refresh = () => { page.el.querySelector(".exlist").innerHTML = EX.map(exRowHtml).join(""); page.el.querySelector("#dayTitle").textContent = `Day ${state.day}`; wire(); };
    page.el.querySelector("[data-settings]").addEventListener("click", () => stacks.today.push(settingsPage()));
    page.el.querySelector("[data-daypick]").addEventListener("click", (ev) => openDayPicker(ev.currentTarget, page));
    cta.querySelector("[data-start]").addEventListener("click", () => stacks.today.push(focusPage()));
    return page;
  }

  async function exMenu(row, e) {
    const skipped = state.skipped.has(e.id);
    const v = await N.menu({ anchor: row, lift: true, items: [
      { label: "Why this weight", value: "why", icon: "icon-mask--target" },
      { label: "Swap exercise", value: "swap", icon: "icon-mask--reset" },
      { label: "Exercise details", value: "details", icon: "icon-mask--dumbbell" },
      { sep: true },
      skipped ? { label: "Restore", value: "restore", icon: "icon-mask--reset" } : { label: "Skip today", value: "skip", destructive: true, icon: "icon-mask--close" },
    ] });
    if (v === "why") openWhy(e, row);
    if (v === "swap") N.toast("Prototype: opens the swap list");
    if (v === "details") N.toast("Prototype: opens the exercise page");
    if (v === "skip" || v === "restore") { v === "skip" ? state.skipped.add(e.id) : state.skipped.delete(e.id); stacks.today.pages[0].refresh(); }
  }

  function openWhy(e, opener) {
    const id = "why" + Math.random().toString(36).slice(2, 6);
    N.sheet({
      opener, labelledBy: id, detents: ["medium", "large"],
      header: h(`<div class="nf-sheet__head nf-sheet__head--left" style="display:grid"><h2 id="${id}">Why this weight</h2><span class="trail">${closeBtn()}</span></div>`),
      body: `<p class="t-sub" style="margin:4px 0 6px">${e.v === "up" ? `Go up to ${e.target} kg` : `Hold ${e.target} kg`}</p>
        <p class="soft" style="margin:0 0 16px">Representative copy. Last session you did ${e.prev.map((p) => p[1]).join(", ")} reps at ${e.prev[0][0]} kg with RIR ${e.prev[0][2]}. ${e.v === "up" ? "The first set beat the top of the range, so the next load goes up one step." : "The sets landed inside the range, so the load holds."}</p>
        <div class="list surface-li">${e.prev.map((p, i) => `<div class="li"><span>Set ${i + 1}</span><span class="val mono">${p[0]} × ${p[1]} · RIR ${p[2]}</span></div>`).join("")}</div>
        <p class="t-cap" style="margin:16px 0">Drag the sheet up for the full history. It opens at the medium detent; a flick down dismisses it from either detent.</p>
        ${Array.from({ length: 6 }, (_, i) => `<div class="li" style="background:var(--surface)"><span>Week ${3 - Math.floor(i / 2)} · Day ${(i % 2) + 1}</span><span class="val mono">${e.prev[0][0] - 2.5 * Math.floor(i / 2)} × ${e.reps + (i % 3)}</span></div>`).join("")}`,
    });
  }

  function openDayPicker(opener, todayP) {
    const id = "dp" + Math.random().toString(36).slice(2, 6);
    const sheet = N.sheet({
      opener, labelledBy: id, detents: ["fit"],
      header: h(`<div class="nf-sheet__head nf-sheet__head--left" style="display:grid"><h2 id="${id}">Choose another day</h2><span class="trail">${closeBtn()}</span></div>`),
      body: `<p class="sheet-lede">Pick which day of your program to train today.</p>
        <div class="daylist" role="radiogroup" aria-labelledby="${id}">${DAYS.map((d) => `<button class="dayopt" role="radio" aria-checked="${d.n === state.day}" data-press data-day="${d.n}">
          <span class="n">${d.n}</span><span><b>${d.name}</b><small>${d.sub ? d.sub + " · " : ""}${d.count} exercises${d.n === 1 ? " · Today" : ""}</small></span><i class="icon-mask icon-mask--check ck" aria-hidden="true"></i></button>`).join("")}</div>`,
    });
    sheet.body.querySelectorAll(".dayopt").forEach((b) => b.addEventListener("click", () => {
      const prev = state.day, n = +b.dataset.day;
      sheet.body.querySelectorAll(".dayopt").forEach((x) => x.setAttribute("aria-checked", x === b));
      if (n === prev) { setTimeout(() => sheet.close(0, "same"), 200); return; }
      // The choice commits on tap. The check lands, then the sheet leaves; the change is undoable.
      setTimeout(() => {
        sheet.close(0, "chosen");
        state.day = n; todayP.refresh();
        if (N.prefs.dayUndo === "on") N.toast(`Training Day ${n} today`, { action: "Undo", onAction: () => { state.day = prev; todayP.refresh(); } });
      }, 220);
    }));
  }

  /* ---------------- Settings ---------------- */
  const seg = (label, key, opts, cur) => `<div class="nf-seg" role="radiogroup" aria-label="${label}" data-pref="${key}">${opts.map(([v, l]) => `<button role="radio" aria-checked="${v === cur}" data-value="${v}" data-press>${l}</button>`).join("")}</div>`;
  function settingsPage() {
    const p = N.prefs;
    const page = { hideDock: false };
    page.el = pageShell({
      id: "settings", title: "Settings", back: "Today",
      body: `
      <section class="group"><h2 class="group__cap t-label">Training behavior</h2><div class="list">
        <div class="li"><span>Units</span>${seg("Units", "units", [["kg", "kg"], ["lb", "lb"]], "kg")}</div>
        <div class="li"><span id="restLb">Rest timer</span><span class="nf-stepper" data-min="0" data-max="600" data-step="15" data-value="${state.restSeconds}" data-format="time" aria-labelledby="restLb"><output aria-live="polite"></output><span class="nf-stepper__btns"><button data-press data-d="-1" aria-label="Shorter rest"><i class="icon-mask icon-mask--minus"></i></button><button data-press data-d="1" aria-label="Longer rest"><i class="icon-mask icon-mask--plus"></i></button></span></span></div>
        <button class="li row-press" data-press data-push="prog"><span>Progression controls<span class="sub">Recommended defaults active</span></span><span class="val"><i class="chevron"></i></span></button>
      </div></section>
      <section class="group"><h2 class="group__cap t-label">App experience</h2><div class="list">
        <div class="li li--stack"><span>Appearance</span>${seg("Appearance", "theme", [["system", "System"], ["light", "Light"], ["dark", "Dark"]], p.theme)}</div>
        <button class="li row-press" data-press data-lang aria-haspopup="menu"><span>Language</span><span class="val"><span data-langval>${p.lang === "pt" ? "Português" : "English"}</span><i class="icon-mask icon-mask--chev-down" style="width:16px;height:16px"></i></span></button>
        <div class="li"><span id="voiceLb">Enable voice input</span><button class="nf-switch" role="switch" aria-checked="false" aria-labelledby="voiceLb" data-press></button></div>
        <div class="li"><span id="notifLb">Rest timer done</span><button class="nf-switch" role="switch" aria-checked="true" aria-labelledby="notifLb" data-press></button></div>
      </div><p class="group__foot">Your browser controls whether voice input is available. When you enable it, the workout ⋯ menu shows Voice input. Your browser provider may process what you say.</p></section>
      <section class="group"><h2 class="group__cap t-label">Prototype only · not app copy</h2><div class="list">
        <div class="li li--stack"><span>Text size</span>${seg("Text size", "text", [["100", "100%"], ["200", "200%"]], p.text)}</div>
        <div class="li li--stack"><span>Motion</span>${seg("Motion", "motion", [["full", "Full"], ["reduced", "Reduced"]], p.motion)}</div>
        <div class="li li--stack"><span>Focus tip</span>${seg("Focus tip", "tip", [["anchored", "Anchored"], ["inline", "Inline"], ["centred", "Centred"]], p.tip)}</div>
        <div class="li li--stack"><span>Back swipe</span>${seg("Back swipe", "swipe", [["auto", "Auto"], ["edge", "Edge"], ["full", "Full width"]], p.swipe)}</div>
        <div class="li li--stack"><span>Load entry</span>${seg("Load entry", "wheel", [["on", "Wheel"], ["off", "Keyboard"]], p.wheel)}</div>
        <div class="li li--stack"><span>Dock at 200%</span>${seg("Dock at 200%", "dockLabels", [["cap", "Capped labels"], ["hide", "Icons only"]], p.dockLabels)}</div>
        <button class="li row-press" data-press data-resettips><span>Show the Focus tip again</span></button>
        <a class="li row-press" data-press href="index.html" style="text-decoration:none"><span>All prototypes and before/after</span><i class="chevron"></i></a>
      </div><p class="group__foot">Standalone: ${N.standalone() ? "yes (Home Screen app)" : "no (Safari tab)"}. Back swipe Auto uses the edge in the Home Screen app and full width in a Safari tab.</p></section>`,
    });
    N.mountSegmented(page.el); N.mountSwitches(page.el); N.mountSteppers(page.el);
    page.el.querySelectorAll(".nf-seg[data-pref]").forEach((s) => s.addEventListener("change", (e) => { if (s.dataset.pref !== "units") N.setPref(s.dataset.pref, e.detail); }));
    page.el.querySelector(".nf-stepper").addEventListener("change", (e) => (state.restSeconds = e.detail));
    page.el.querySelector("[data-push=prog]").addEventListener("click", () => stacks[activeTab].push(progressionPage()));
    page.el.querySelector("[data-resettips]").addEventListener("click", () => { sessionStorage.removeItem("nf-tip-seen"); N.toast("The tip shows on the next Focus"); });
    const lang = page.el.querySelector("[data-lang]");
    lang.addEventListener("click", async () => {
      const v = await N.menu({ anchor: lang, items: [{ label: "English", value: "en", checked: N.prefs.lang !== "pt" }, { label: "Português", value: "pt", checked: N.prefs.lang === "pt" }] });
      if (v) { N.setPref("lang", v); lang.querySelector("[data-langval]").textContent = v === "pt" ? "Português" : "English"; }
    });
    return page;
  }
  function progressionPage() {
    const page = {};
    page.el = pageShell({
      id: "prog", title: "Progression controls", back: "Settings",
      body: `<section class="group"><div class="list">
        <div class="li"><span id="pc1">Recommended defaults</span><button class="nf-switch" role="switch" aria-checked="true" aria-labelledby="pc1" data-press></button></div>
        <div class="li"><span id="pc2">Smallest load change</span><span class="nf-stepper" data-min="0.5" data-max="10" data-step="0.5" data-value="2.5" data-decimals="1" data-unit="kg" aria-labelledby="pc2"><output aria-live="polite"></output><span class="nf-stepper__btns"><button data-press data-d="-1" aria-label="Smaller step"><i class="icon-mask icon-mask--minus"></i></button><button data-press data-d="1" aria-label="Larger step"><i class="icon-mask icon-mask--plus"></i></button></span></span></div>
        <div class="li"><span id="pc3">Deload week</span><button class="nf-switch" role="switch" aria-checked="false" aria-labelledby="pc3" data-press></button></div>
      </div><p class="group__foot">A second pushed page, to try the interactive back swipe twice in a row. Hold − or + to repeat.</p></section>
      <div style="height:900px"></div>`,
    });
    N.mountSwitches(page.el); N.mountSteppers(page.el);
    return page;
  }

  /* ---------------- Focus ---------------- */
  function focusPage() {
    const w = state.workout || (state.workout = { ex: 0, sets: EX.map((e) => Array.from({ length: e.sets }, () => ({ done: false }))), field: "load", fields: null, rest: null });
    const page = { hideDock: true, swipe: false };
    let fresh = -1, tipEl = null, tick = 0;
    const cur = () => EX[w.ex];
    const openIdx = () => w.sets[w.ex].findIndex((s) => !s.done);
    const resetFields = () => { const e = cur(); w.fields = { load: e.target, reps: e.reps, rir: 1 }; };
    if (!w.fields) resetFields();
    page.el = h(`<div class="page page--nodock focus" data-page="focus">
      <header class="navbar"><div class="navbar__bg"></div><div class="navbar__row">
        <div class="navbar__lead"><button class="iconbtn" data-press data-back aria-label="Back to Today"><i class="chevron chevron--back"></i></button></div>
        <div class="navbar__title" data-fx-title></div>
        <div class="navbar__trail"><button class="timerpill" data-press data-timer aria-label="Rest timer">${TIMER}<span data-pill>2:00</span></button><button class="iconbtn" data-press data-more aria-label="Workout actions" aria-haspopup="dialog">${MORE}</button></div>
      </div></header>
      <div class="page__scroll" data-scroll><div class="page__inner" data-content></div></div>
      <div class="shelf" data-shelf><div class="shelf__inner" data-shelfin></div></div>
    </div>`);
    const content = page.el.querySelector("[data-content]"), shelf = page.el.querySelector("[data-shelf]"), shelfIn = page.el.querySelector("[data-shelfin]");
    const L = () => tr();

    function renderContent() {
      const e = cur(), t = L(), oi = openIdx();
      page.el.querySelector("[data-fx-title]").textContent = N.prefs.lang === "pt" ? e.pt : e.name;
      content.innerHTML = `
        <div class="segbar" aria-hidden="true">${EX.map((_, i) => `<i class="${i === w.ex ? "on" : ""}"></i>`).join("")}</div>
        <p class="fx-meta">${e.sets} × 4–8 reps · RIR 1 · Adaptive</p>
        <h2 class="t-feature fx-name" data-autofocus>${N.prefs.lang === "pt" ? e.pt : e.name}</h2>
        <div data-slot></div>
        <div class="fledger" role="table" aria-label="Sets">
          <div class="fledger__head t-label" role="row"><span role="columnheader">${t.set}</span><span role="columnheader" style="text-align:right">${t.kg}</span><span role="columnheader" style="text-align:right">${t.reps}</span><span role="columnheader" style="text-align:right">${t.rir}</span></div>
          ${w.sets[w.ex].map((s, i) => `<div class="fl ${s.done ? "is-done" : ""} ${i === oi ? "is-open" : ""} ${i === fresh ? "is-fresh" : ""}" role="row">
            <span role="cell">${s.done ? '<i class="icon-mask icon-mask--check ck" style="width:16px;height:16px" aria-label="Logged"></i> ' : ""}${i + 1}</span>
            <span role="cell" class="r">${s.done ? s.kg : i === oi ? fmtKg(w.fields.load) : fmtKg(e.target)}</span>
            <span role="cell" class="r">${s.done ? s.reps : i === oi ? w.fields.reps : e.reps}</span>
            <span role="cell" class="r">${s.done ? s.rir : i === oi ? w.fields.rir : 1}</span>
            ${s.done ? "" : `<span class="prev" role="cell">${t.last(e.prev[i]?.[0] ?? e.kg, e.prev[i]?.[1] ?? e.reps, e.prev[i]?.[2] ?? 1)}</span>`}
          </div>`).join("")}
        </div>
        ${w.ex < EX.length - 1 ? `<button class="nextrow" data-press data-next><span>${t.nextRow(N.prefs.lang === "pt" ? EX[w.ex + 1].pt : EX[w.ex + 1].name)}</span><i class="chevron"></i></button>` : ""}`;
      fresh = -1;
      renderSlot();
      content.querySelector("[data-next]")?.addEventListener("click", () => gotoEx(w.ex + 1));
    }
    function renderSlot() {
      const slot = content.querySelector("[data-slot]"), e = cur(), t = L();
      if (!slot) return;
      if (w.rest) {
        const left = Math.max(0, w.rest.end - Date.now()) / 1000, done = left <= 0;
        slot.innerHTML = `<div class="rest" role="timer" aria-live="off">
          ${done ? `<span class="rest__lb" style="color:var(--ink)">${t.restDone}</span>` : `<span class="rest__lb">${t.rest}</span><span class="rest__clock">${fmtTime(Math.ceil(left))}</span><span class="rest__of">${t.of(fmtTime(w.rest.total))}</span>`}
          <span class="rest__bar" aria-hidden="true"><i style="transform:scaleX(${done ? 0 : left / w.rest.total})"></i></span>
          <span class="rest__next">${openIdx() >= 0 ? t.next(openIdx() + 1, e.target, e.reps) : ""}</span></div>`;
      } else {
        slot.innerHTML = `<div class="fx-cue">${e.v === "up" ? `<span class="up">${UP}</span>` : HOLD}<span><b>${e.v === "up" ? t.up(e.target) : (N.prefs.lang === "pt" ? `Manter ${e.target} kg` : `Hold ${e.target} kg`)}</b><small>${t.aim(e.reps)}</small></span></div>
          <button class="linkbtn" data-press data-why>${t.why}</button>`;
        slot.querySelector("[data-why]").addEventListener("click", (ev) => openWhy(e, ev.currentTarget));
      }
      const pill = page.el.querySelector("[data-pill]");
      pill.textContent = w.rest ? fmtTime(Math.max(0, Math.ceil((w.rest.end - Date.now()) / 1000))) : fmtTime(state.restSeconds);
    }
    function renderShelf() {
      const t = L(), oi = openIdx(), f = w.fields;
      const showTip = !sessionStorage.getItem("nf-tip-seen") && w.sets.every((x) => x.every((s) => !s.done));
      const resting = w.rest && w.rest.end > Date.now() && !w.padsBack;
      shelfIn.innerHTML = `
        ${showTip && N.prefs.tip === "inline" ? `<div class="tip-inline" role="note"><p><b>${t.tipT}.</b> ${t.tipB}</p>${closeBtn("Dismiss tip").replace("data-close", "data-tipx")}</div>` : ""}
        <div class="fields" role="group" aria-label="Set ${oi + 1}">
          ${[["load", t.loadkg, fmtKg(f.load)], ["reps", t.reps, f.reps], ["rir", t.rir, f.rir]].map(([k, l, v]) => `<button class="field" data-press data-field="${k}" aria-pressed="${w.field === k}" aria-label="${l} ${v}${w.field === k ? (N.prefs.wheel === "on" ? ", tap again for the picker" : ", tap again to type") : ""}"><small>${l}</small><b>${v}</b></button>`).join("")}
        </div>
        ${resting ? `<div class="pads pads--rest"><button class="pad" data-press data-rest="-30">−30 s</button><button class="pad" data-press data-rest="30">+30 s</button><button class="pad" data-press data-rest="skip">${t.skip}</button></div>`
          : `<div class="pads"><button class="pad" data-press data-pad="-1">${padLabel(-1)}</button><button class="pad" data-press data-pad="1">${padLabel(1)}</button></div>`}
        ${oi >= 0 ? `<button class="btn btn--primary" data-press data-press-instant data-log>${t.log(oi + 1)}</button>`
          : w.ex < EX.length - 1 ? `<button class="btn btn--primary" data-press data-press-instant data-nextex>Next exercise <i class="arrow"></i></button>`
          : `<button class="btn btn--primary" data-press data-press-instant data-finish>Finish workout</button>`}`;
      shelfIn.querySelectorAll("[data-field]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.field;
        if (w.field === k) { N.prefs.wheel === "on" ? openWheel(k, b) : typeInto(k, b); return; }
        w.field = k; w.padsBack = true; renderShelf();
        shelfIn.querySelector(`[data-field=${k}]`).focus({ preventScroll: true });
      }));
      shelfIn.querySelectorAll("[data-pad]").forEach((b) => holdRepeat(b, () => bump(+b.dataset.pad)));
      shelfIn.querySelectorAll("[data-rest]").forEach((b) => b.addEventListener("click", () => {
        const v = b.dataset.rest;
        if (v === "skip") w.rest.end = Date.now(); else { w.rest.end += +v * 1000; w.rest.total = Math.max(15, w.rest.total + (+v)); }
        renderSlot(); if (v === "skip") renderShelf();
      }));
      shelfIn.querySelector("[data-log]")?.addEventListener("click", logSet);
      shelfIn.querySelector("[data-nextex]")?.addEventListener("click", () => gotoEx(w.ex + 1));
      shelfIn.querySelector("[data-finish]")?.addEventListener("click", finishWorkout);
      shelfIn.querySelector("[data-tipx]")?.addEventListener("click", dismissTip);
      requestAnimationFrame(() => {
        page.el.style.setProperty("--shelf-h", shelf.offsetHeight + 16 + "px");
        placeTip(showTip);
        // Keep the open set in view above the shelf, whatever the text size.
        const open = content.querySelector(".fl.is-open");
        if (open) { const sc = page.el.querySelector(".page__scroll"), r = open.getBoundingClientRect(), limit = shelf.getBoundingClientRect().top - 8; if (r.bottom > limit) sc.scrollBy({ top: r.bottom - limit, behavior: N.rm() ? "auto" : "smooth" }); }
      });
    }
    const padLabel = (d) => w.field === "load" ? `${d < 0 ? "−" : "+"} 2.5 kg` : `${d < 0 ? "−" : "+"} 1`;
    function bump(d) {
      const f = w.fields;
      if (w.field === "load") f.load = Math.max(0, f.load + d * 2.5);
      if (w.field === "reps") f.reps = N.clamp(f.reps + d, 0, 50);
      if (w.field === "rir") f.rir = N.clamp(f.rir + d, 0, 5);
      const b = shelfIn.querySelector(`[data-field=${w.field}] b`); if (b) b.textContent = w.field === "load" ? fmtKg(f.load) : f[w.field];
      const row = content.querySelector(".fl.is-open"); if (row) { const c = row.querySelectorAll("[role=cell]"); c[1].textContent = fmtKg(f.load); c[2].textContent = f.reps; c[3].textContent = f.rir; }
    }
    function holdRepeat(b, fn) {
      let t = 0, iv = 0, rep = false;
      const stop = () => { clearTimeout(t); clearInterval(iv); };
      b.addEventListener("pointerdown", () => { rep = false; stop(); t = setTimeout(() => { iv = setInterval(() => { rep = true; fn(); }, 110); }, 420); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
      b.addEventListener("click", () => { if (!rep) fn(); rep = false; });
    }
    function logSet() {
      const oi = openIdx(); if (oi < 0) return;
      const f = w.fields;
      Object.assign(w.sets[w.ex][oi], { done: true, kg: fmtKg(f.load), reps: f.reps, rir: f.rir });
      fresh = oi;
      sessionStorage.setItem("nf-tip-seen", "1"); removeTip();
      w.rest = { end: Date.now() + state.restSeconds * 1000, total: state.restSeconds }; w.padsBack = false;
      renderContent(); renderShelf();
    }
    function gotoEx(i) {
      const dir = i > w.ex ? 1 : -1;
      w.ex = i; w.rest = null; w.field = "load"; resetFields();
      renderContent(); renderShelf();
      page.el.querySelector(".page__scroll").scrollTop = 0;
      if (!N.rm()) { const s = new N.Spring(dir * 60, (x) => { content.style.transform = x ? `translate3d(${x}px,0,0)` : ""; content.style.opacity = String(1 - Math.abs(x) / 90); }); s.set(dir * 60); s.to(0, N.SPRINGS.layoutShift, 0); }
      content.querySelector("[data-autofocus]")?.focus({ preventScroll: true });
    }
    function openWheel(k, opener) {
      const t = L(), f = w.fields;
      const labels = { load: t.loadkg, reps: t.reps, rir: t.rir };
      const id = "wh" + Math.random().toString(36).slice(2, 6);
      const values = k === "load" ? Array.from({ length: 121 }, (_, i) => i * 2.5) : k === "reps" ? Array.from({ length: 31 }, (_, i) => i) : [0, 1, 2, 3, 4, 5];
      const wheel = N.wheel({ values, value: f[k], format: k === "load" ? fmtKg : String, label: labels[k], onChange: (v) => { f[k] = v; const b = shelfIn.querySelector(`[data-field=${k}] b`); if (b) b.textContent = k === "load" ? fmtKg(v) : v; const row = content.querySelector(".fl.is-open"); if (row) { const c = row.querySelectorAll("[role=cell]"); c[1].textContent = fmtKg(f.load); c[2].textContent = f.reps; c[3].textContent = f.rir; } } });
      wheel.setAttribute("data-no-sheet-drag", "");
      const wrap = h(`<div><div class="wheels one"></div></div>`); wrap.firstElementChild.append(wheel);
      const sh = N.sheet({ opener, labelledBy: id, detents: ["fit"],
        header: h(`<div class="nf-sheet__head nf-sheet__head--left" style="display:grid"><h2 id="${id}">${labels[k]}</h2><span class="trail"><button class="navbar__action" data-press data-close>Done</button></span></div>`),
        body: wrap, onClose: () => renderShelf() });
      requestAnimationFrame(() => { wheel.mount(); wheel.focus({ preventScroll: true }); });
      return sh;
    }
    function typeInto(k, b) {
      const inp = h(`<input class="field" inputmode="${k === "load" ? "decimal" : "numeric"}" aria-label="${b.querySelector("small").textContent}" value="${b.querySelector("b").textContent}" style="font-family:var(--font-training-data);font-size:max(16px,var(--font-size-metric));color:var(--ink);border:0;width:100%">`);
      b.replaceWith(inp); inp.focus(); inp.select();
      const commit = () => { const v = parseFloat(inp.value.replace(",", ".")); if (!isNaN(v)) w.fields[k] = v; renderShelf(); renderContent(); };
      inp.addEventListener("blur", commit); inp.addEventListener("keydown", (e) => e.key === "Enter" && inp.blur());
    }

    // Tips: anchored to the shelf (non-blocking), inline in the shelf, or the current centred dialog.
    function placeTip(show) {
      if (show && tipEl && tipEl.dataset.kind === N.prefs.tip) { if (tipEl.dataset.kind === "anchored") tipEl.style.bottom = shelf.offsetHeight + 14 + "px"; return; }
      removeTip(true);
      if (!show) return;
      const t = L();
      if (N.prefs.tip === "anchored") {
        tipEl = h(`<div class="tip-anchor" role="note" aria-label="Tip"><p><b>${t.tipT}</b>${t.tipB}</p>${closeBtn("Dismiss tip").replace("data-close", "data-tipx")}</div>`);
        tipEl.dataset.kind = "anchored";
        tipEl.style.bottom = shelf.offsetHeight + 14 + "px";
        page.el.append(tipEl);
        tipEl.querySelector("[data-tipx]").addEventListener("click", dismissTip);
        if (!N.rm()) { const s = new N.Spring(0, (p) => { tipEl.style.opacity = p; tipEl.style.transform = `translateY(${(1 - p) * 8}px) scale(${0.96 + 0.04 * p})`; }); s.set(0); setTimeout(() => s.to(1, N.SPRINGS.gestureSettle, 0), 350); }
      } else if (N.prefs.tip === "centred") {
        const id = "tipd";
        tipEl = h(`<div class="nf-layer" data-modal-root><div class="nf-scrim" style="opacity:1"></div><div class="tip-dialog" role="dialog" aria-modal="true" aria-labelledby="${id}"><h2 class="t-section" id="${id}">${t.tipT}</h2><p>${t.tipB}</p><button class="btn btn--primary" data-press data-press-instant data-tipx>Got it</button></div></div>`);
        tipEl.dataset.kind = "centred";
        document.body.append(tipEl); N.pushModal(tipEl, shelf.querySelector("[data-log]"));
        tipEl.querySelector("[data-tipx]").addEventListener("click", dismissTip);
        tipEl.addEventListener("nf:escape", dismissTip);
        tipEl.querySelector("[data-tipx]").focus();
      }
    }
    function removeTip(silent) {
      if (!tipEl) return;
      const el = tipEl; tipEl = null;
      if (el.matches(".nf-layer")) N.popModal(el);
      if (silent || N.rm()) { el.remove(); return; }
      el.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(6px) scale(.97)" }], { duration: 140, easing: "ease-in" }).finished.then(() => el.remove());
    }
    function dismissTip() { sessionStorage.setItem("nf-tip-seen", "1"); removeTip(); renderShelf(); }

    async function more(ev) {
      const v = await N.actionSheet({ opener: ev.currentTarget, actions: [
        { label: "Finish workout", value: "finish" },
        { label: "Reorder exercises", value: "reorder" },
        { label: "End without saving", value: "abandon", destructive: true },
      ] });
      if (v === "finish") finishWorkout();
      if (v === "reorder") N.toast("Prototype: opens the session map");
      if (v === "abandon") {
        const c = await N.actionSheet({ message: "Nothing from this session is saved. Logged sets are discarded and your program stays as it is.", actions: [{ label: "End without saving", value: "yes", destructive: true }], cancelLabel: "Keep training" });
        if (c === "yes") { state.workout = null; stacks.today.pop(); }
      }
    }
    function finishWorkout() { openSummary(() => { state.workout = null; stacks.today.pop({ animated: false }); }); }

    page.el.querySelector("[data-more]").addEventListener("click", more);
    page.el.querySelector("[data-timer]").addEventListener("click", (e) => N.toast("Prototype: opens the rest presets"));
    page.onLeave = () => { clearInterval(tick); removeTip(true); };
    const onPrefs = () => { renderContent(); renderShelf(); };
    document.addEventListener("nf:prefs", onPrefs);
    const leave = page.onLeave; page.onLeave = () => { leave(); document.removeEventListener("nf:prefs", onPrefs); };
    tick = setInterval(() => {
      if (!w.rest) return;
      const was = w.rest.done; w.rest.done = w.rest.end <= Date.now();
      renderSlot(); if (w.rest.done && !was) renderShelf();
    }, 250);
    renderContent(); renderShelf();
    return page;
  }

  /* ---------------- Summary: a full-screen cover, one exit ---------------- */
  function openSummary(afterOpen) {
    const id = "sumT";
    const cover = h(`<div class="cover" data-modal-root role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="page" style="position:absolute">
        <header class="navbar"><div class="navbar__bg"></div><div class="navbar__row"><div class="navbar__lead"></div><div class="navbar__title" aria-hidden="true">Day ${state.day}</div><div class="navbar__trail"></div></div></header>
        <div class="page__scroll" data-scroll><div class="page__inner">
          <div class="largetitle"><p class="t-cap" style="margin:0 0 4px">Session saved</p><h1 class="t-title" id="${id}">Day ${state.day}</h1><p class="today-sub">Monday, August 31, week 4</p></div>
          <div class="stats"><div><b>13</b><span class="t-cap">sets logged</span></div><div><b>6,453</b><span class="t-cap">kg moved</span></div><div><b>5</b><span class="t-cap">lifts</span></div></div>
          <h2 class="t-sub gut" style="margin:24px 0 4px">Outcome and next target</h2>
          <div class="gut">${EX.map((e, i) => `<div class="outrow"><header><span>${e.name}</span><span class="soft">${["= Maintained", "↑ Improved", "= Maintained", "↓ Declined", "= Maintained"][i]}</span></header>
            <span class="t-cap mono">${e.prev.map((p) => `${p[0]} kg × ${p[1]}`).slice(0, 1).join("")}, …</span>${i < 3 ? `<div class="pr">✓ PR +2.5 kg over your best</div>` : ""}<div class="nx">Next: ${e.target} kg × ${e.reps}</div></div>`).join("")}</div>
        </div></div>
      </div>
      <div class="cover__foot"><button class="btn btn--secondary" data-press data-see>See the session</button><button class="btn btn--primary" data-press data-press-instant data-done>Done</button></div>
    </div>`);
    document.body.append(cover);
    const fakeStack = { pages: [], top: null, pop() {} };
    wirePage({ el: cover.querySelector(".page"), swipe: false }, fakeStack);
    N.pushModal(cover, null);
    const H = innerHeight;
    const s = new N.Spring(H, (y) => (cover.style.transform = y ? `translate3d(0,${y}px,0)` : ""));
    s.set(H);
    const shown = () => { afterOpen && afterOpen(); cover.querySelector("h1").tabIndex = -1; cover.querySelector("h1").focus({ preventScroll: true }); };
    if (N.rm()) { s.set(0); cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 }); shown(); } else s.to(0, N.SPRINGS.navPush, 0).then(shown);
    cover.querySelector("[data-see]").addEventListener("click", () => N.toast("Prototype: opens the session in History"));
    cover.querySelector("[data-done]").addEventListener("click", () => {
      const out = () => { cover.remove(); N.popModal(cover); N.toast("Workout saved. 13 sets logged."); };
      if (N.rm()) { cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).finished.then(out); } else s.to(H, N.SPRINGS.gestureExit, 0).then(out);
    });
  }

  /* ---------------- Progress, History, Program ---------------- */
  function progressPage() {
    const page = { swipe: false };
    page.el = pageShell({ id: "progress", title: "Progress", body: `
      <div class="gut" style="margin-top:12px" data-hscroll>${seg("Progress view", "pview", [["o", "Overview"], ["l", "Lifts"], ["r", "Review"]], "o")}</div>
      <section class="group"><h2 class="group__cap t-label">Strength trend</h2><div class="list">${EX.concat(EX).map((e, i) => `<button class="li row-press" data-press><span>${e.name}<span class="sub">${i % 3 === 0 ? "Improved" : "Maintained"} · 6 weeks</span></span><span class="val mono">${(e.kg * (1 + (i % 4) / 40)).toFixed(1)} kg <i class="chevron"></i></span></button>`).join("")}</div></section>
      <p class="hint">Tap Progress in the dock to scroll back to the top.</p>` });
    N.mountSegmented(page.el);
    return page;
  }
  function historyPage() {
    const page = { swipe: false };
    const sessions = Array.from({ length: 14 }, (_, i) => ({ d: `Day ${(i % 4) + 1}`, date: `Aug ${30 - i * 2}`, sets: 12 + (i % 3) }));
    page.el = pageShell({ id: "history", title: "History", body: `
      ${[0, 1, 2].map((wk) => `<section class="group"><h2 class="group__cap t-label">Week ${4 - wk} · 4 of 4</h2><div class="list">${sessions.slice(wk * 4, wk * 4 + 4).map((s) => `<button class="li row-press" data-press data-session="${s.d}|${s.date}"><span>${s.d}<span class="sub">${s.date} · ${s.sets} sets</span></span><i class="chevron"></i></button>`).join("")}</div></section>`).join("")}` });
    page.el.querySelectorAll("[data-session]").forEach((b) => b.addEventListener("click", () => stacks.history.push(sessionPage(...b.dataset.session.split("|")))));
    return page;
  }
  function sessionPage(d, date) {
    const page = {};
    page.el = pageShell({ id: "session", title: d, back: "History", sub: `<p class="today-sub">${date}</p>`, body: EX.map((e) => `<section class="group"><h2 class="group__cap" style="font-size:var(--font-size-body);font-weight:600;margin-bottom:6px">${e.name}</h2><div class="list">${e.prev.map((p, i) => `<div class="li"><span class="soft">Set ${i + 1}</span><span class="mono">${p[0]} × ${p[1]} · RIR ${p[2]}</span></div>`).join("")}</div></section>`).join("") });
    return page;
  }
  function programPage() {
    const page = { swipe: false };
    page.el = pageShell({ id: "program", title: "Program", trail: `<button class="navbar__action" data-press data-edit aria-haspopup="dialog">Edit</button>`, sub: `<p class="today-sub">Full body · Week 4 of 6</p>`, body: DAYS.slice(0, 3).map((d) => `<section class="group"><h2 class="group__cap t-label">Day ${d.n} · ${d.name}</h2><div class="list">${EX.map((e) => `<div class="li"><span>${e.name}</span><span class="val mono">${e.tg}</span></div>`).join("")}</div></section>`).join("") });
    page.el.querySelector("[data-edit]").addEventListener("click", (e) => openEditor(e.currentTarget));
    return page;
  }

  /* ---------------- Program editor sheet: Cancel + Done, inner navigation, guarded dismiss ---------------- */
  function openEditor(opener) {
    let dirty = false;
    const nav = h(`<div class="sheet-nav"></div>`);
    const pages = [];
    const ns = new N.Spring(0, (x) => {
      const top = pages[pages.length - 1], under = pages[pages.length - 2]; if (!top || !under) return;
      top.style.transform = x ? `translate3d(${x}px,0,0)` : ""; under.style.transform = `translate3d(${-(1 - x / nav.clientWidth) * nav.clientWidth * 0.3}px,0,0)`;
    });
    const askDiscard = async (anchor) => {
      const v = await N.actionSheet({ opener: anchor, actions: [{ label: "Discard changes", value: "discard", destructive: true }], cancelLabel: "Keep editing" });
      if (v === "discard") sheet.close(0, "discard");
    };
    const headRow = (lead, title, trail, id) => `<div class="nf-sheet__head" style="position:sticky;top:0;z-index:2;background:var(--surface);margin:0 calc(-1 * var(--gut));padding:0 8px"><span class="lead">${lead}</span><h2 ${id ? `id="${id}"` : ""}>${title}</h2><span class="trail">${trail}</span></div>`;
    const root = h(`<div class="sheet-page" data-scroll>
      ${headRow(`<button class="navbar__action" data-press data-cancel style="font-weight:400">Cancel</button>`, "Edit program", `<button class="navbar__action" data-press data-done>Done</button>`, "edT")}
      ${DAYS.slice(0, 3).map((d) => `<section class="ed-day"><h3 class="t-label" style="margin:0 0 6px">Day ${d.n}</h3>${EX.map((e) => `<button class="ed-ex" data-press data-edex="${e.id}" aria-haspopup="menu"><span class="grip" aria-hidden="true">${GRIP}</span><span>${e.name}</span><span class="meta">${e.tg}</span><i class="chevron"></i></button>`).join("")}</section>`).join("")}
      <p class="t-cap" style="margin:18px 0 0">Tap an exercise to drill in. Touch and hold for quick actions. Drag the sheet down: with changes, it asks before discarding.</p>
    </div>`);
    nav.append(root); pages.push(root);
    const sheet = N.sheet({
      opener, labelledBy: "edT", detents: ["large"], pushBack: true, body: nav, className: "nf-sheet--editor",
      scroller: () => pages[pages.length - 1],
      onDismissAttempt: () => { if (!dirty) return true; askDiscard(opener); return false; },
    });
    sheet.body.style.padding = "0"; sheet.body.classList.add("is-scrollable"); sheet.body.style.overflow = "hidden";
    root.querySelector("[data-cancel]").addEventListener("click", (e) => (dirty ? askDiscard(e.currentTarget) : sheet.close(0, "cancel")));
    root.querySelector("[data-done]").addEventListener("click", () => { sheet.close(0, "done"); if (dirty) N.toast("Program saved."); });
    root.querySelectorAll("[data-edex]").forEach((b) => {
      const e = EX.find((x) => x.id === b.dataset.edex);
      b.addEventListener("click", () => pushEx(e));
      N.longPress(b, async () => {
        const v = await N.menu({ anchor: b, lift: true, items: [{ label: "Move up", value: "up" }, { label: "Move down", value: "down" }, { label: "Move to another day", value: "day" }, { sep: true }, { label: "Remove exercise", value: "rm", destructive: true }] });
        if (!v) return;
        dirty = true;
        if (v === "up" && b.previousElementSibling?.matches(".ed-ex")) flipSwap(b, b.previousElementSibling, true);
        if (v === "down" && b.nextElementSibling?.matches(".ed-ex")) flipSwap(b, b.nextElementSibling, false);
        if (v === "rm") { b.animate([{ opacity: 1 }, { opacity: 0, transform: "translateX(-20px)" }], { duration: N.rm() ? 1 : 180 }).finished.then(() => b.remove()); }
        if (v === "day") N.toast("Prototype: the Day menu is on the exercise page");
      });
    });
    function flipSwap(a, b, aboveB) {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      aboveB ? b.before(a) : b.after(a);
      if (N.rm()) return;
      [[a, ra], [b, rb]].forEach(([el, r]) => { const dy = r.top - el.getBoundingClientRect().top; const s = new N.Spring(dy, (y) => (el.style.transform = y ? `translateY(${y}px)` : "")); s.set(dy); s.to(0, N.SPRINGS.layoutShift, 0); });
    }
    function pushEx(e) {
      let day = 1;
      const alts = ["45° leg press", "Dumbbell Bulgarian split squat", "Hack squat"];
      const pg = h(`<div class="sheet-page" data-scroll>
        ${headRow(`<button class="backbtn" data-press data-sback aria-label="Back to Edit program"><i class="chevron chevron--back"></i><span>Edit program</span></button>`, e.name, "")}
        <div class="list surface-li" style="margin-top:12px">
          <div class="li"><span id="slc">Smallest load change<span class="sub">Suggested loads move in steps of this size.</span></span><span class="nf-stepper" data-min="0.5" data-max="10" data-step="0.5" data-value="2.5" data-decimals="1" data-unit="kg" aria-labelledby="slc"><output aria-live="polite"></output><span class="nf-stepper__btns"><button data-press data-d="-1" aria-label="Smaller step"><i class="icon-mask icon-mask--minus"></i></button><button data-press data-d="1" aria-label="Larger step"><i class="icon-mask icon-mask--plus"></i></button></span></span></div>
          <button class="li row-press" data-press data-swap><span>Swap exercise</span><i class="chevron"></i></button>
          <button class="li row-press" data-press data-day aria-haspopup="menu"><span>Day</span><span class="val"><span data-dayv>Day 1</span><i class="icon-mask icon-mask--chev-down" style="width:16px;height:16px"></i></span></button>
        </div>
        <section style="margin-top:22px"><h3 class="t-label" style="margin:0 0 4px">In-session alternates</h3><p class="t-cap" style="margin:0 0 8px">If the equipment is taken, the mid-workout swap lists these first. Touch and hold to reorder or remove.</p>
          <div data-alts>${alts.map((a, i) => `<button class="alt" data-press data-alt aria-haspopup="menu"><span class="n">${i + 1}</span><span>${a}</span><span style="margin-left:auto" class="iconbtn" aria-hidden="true">${MORE}</span></button>`).join("")}</div>
          <button class="li row-press" data-press style="color:var(--accent-deep);background:var(--surface)"><span>+ Add alternate</span></button>
        </section>
      </div>`);
      nav.append(pg); pages.push(pg);
      N.mountSteppers(pg);
      pg.querySelector(".nf-stepper").addEventListener("change", () => (dirty = true));
      pg.querySelector("[data-swap]").addEventListener("click", () => N.toast("Prototype: opens the exercise picker"));
      const dayBtn = pg.querySelector("[data-day]");
      dayBtn.addEventListener("click", async () => {
        const v = await N.menu({ anchor: dayBtn, items: [1, 2, 3].map((n) => ({ label: `Day ${n}`, value: n, checked: n === day })) });
        if (v && v !== day) { day = v; dirty = true; pg.querySelector("[data-dayv]").textContent = `Day ${v}`; }
      });
      const renum = () => pg.querySelectorAll("[data-alt] .n").forEach((n, i) => (n.textContent = i + 1));
      pg.querySelectorAll("[data-alt]").forEach((row) => {
        const menu = async () => {
          const v = await N.menu({ anchor: row, lift: true, items: [{ label: "Move up", value: "up" }, { label: "Move down", value: "down" }, { sep: true }, { label: "Remove", value: "rm", destructive: true }] });
          if (!v) return; dirty = true;
          if (v === "up" && row.previousElementSibling) flipSwap(row, row.previousElementSibling, true);
          if (v === "down" && row.nextElementSibling) flipSwap(row, row.nextElementSibling, false);
          if (v === "rm") row.remove();
          renum();
        };
        N.longPress(row, menu); row.addEventListener("click", menu);
      });
      const back = () => { ns.to(nav.clientWidth, N.SPRINGS.navPush, 0).then(() => { pg.remove(); pages.pop(); root.style.transform = ""; }); if (N.rm()) { pg.remove(); pages.pop(); root.style.transform = ""; } };
      pg.querySelector("[data-sback]").addEventListener("click", back);
      // Interactive back inside the sheet, from anywhere on the page (a sheet has no browser edge to share).
      N.gesture(pg, {
        filter: (t) => !t.closest(".nf-stepper"),
        decide: (dx, dy) => dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2,
        start() { ns.stop(); },
        move(dx) { ns.set(N.clamp(dx, 0, nav.clientWidth)); },
        end(vx) { if (ns.x + N.project(vx) > nav.clientWidth / 2) { ns.to(nav.clientWidth, N.SPRINGS.navPush, vx).then(() => { pg.remove(); pages.pop(); root.style.transform = ""; }); } else ns.to(0, N.SPRINGS.gestureSettle, vx); },
      });
      ns.set(nav.clientWidth); ns.to(0, N.SPRINGS.navPush, 0);
      pg.querySelector("h2").tabIndex = -1; pg.querySelector("h2").focus({ preventScroll: true });
    }
  }

  /* ---------------- Tabs and the dock ---------------- */
  const TABS = ["today", "progress", "history", "program"];
  const stacks = {};
  let activeTab = "today";
  const tabsHost = $(".tabs");
  TABS.forEach((t) => {
    const sec = h(`<section class="tab" data-tab="${t}" ${t === "today" ? "" : "hidden"} role="tabpanel"><div class="stack"></div></section>`);
    tabsHost.append(sec);
    stacks[t] = new Stack(sec.firstElementChild);
  });
  stacks.today.root(todayPage());
  stacks.progress.root(progressPage());
  stacks.history.root(historyPage());
  stacks.program.root(programPage());

  const lens = $(".dock__lens");
  const lensX = new N.Spring(0, (x) => (lens.style.transform = `translateX(${x}px)`));
  const placeLens = (animate) => {
    const b = dock.querySelector(`[data-tab="${activeTab}"]`);
    lens.style.width = b.offsetWidth + "px";
    const x = b.offsetLeft - 5;
    animate ? lensX.to(x, N.SPRINGS.layoutShift) : lensX.set(x);
  };
  function selectTab(t) {
    if (t === activeTab) {
      const st = stacks[t];
      if (st.pages.length > 1) { st.popToRoot(); return; }
      const sc = st.top.el.querySelector(".page__scroll");
      sc.scrollTo({ top: 0, behavior: N.rm() ? "auto" : "smooth" });
      return;
    }
    activeTab = t;
    document.querySelectorAll(".tab").forEach((s) => { const on = s.dataset.tab === t; s.hidden = !on; s.inert = !on; });
    dock.querySelectorAll("button").forEach((b) => (b.dataset.tab === t ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    placeLens(true);
  }
  dock.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
  // Large-content viewer: at 200% text, touch and hold a tab to see its name large; slide to another and lift to switch.
  let lcv = null, lcvTimer = 0;
  dock.addEventListener("touchstart", (e) => {
    if (!document.documentElement.classList.contains("t200")) return;
    const t = e.touches[0];
    lcvTimer = setTimeout(() => { showLcv(t.clientX, t.clientY); }, 450);
  }, { passive: true });
  dock.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (lcv) { e.preventDefault(); showLcv(t.clientX, t.clientY); } else clearTimeout(lcvTimer); }, { passive: false });
  dock.addEventListener("touchend", (e) => { clearTimeout(lcvTimer); if (lcv) { e.preventDefault(); const tab = lcv.dataset.tab; lcv.remove(); lcv = null; selectTab(tab); } });
  function showLcv(x, y) {
    const b = document.elementFromPoint(x, y)?.closest?.(".dock button") || dock.querySelector(`[data-tab="${activeTab}"]`);
    if (!lcv) { lcv = h(`<div class="lcv" aria-hidden="true"></div>`); document.body.append(lcv); }
    lcv.dataset.tab = b.dataset.tab;
    lcv.innerHTML = b.querySelector(".dock__ic").outerHTML + `<b>${b.querySelector(".dock__lb").textContent}</b>`;
  }
  new ResizeObserver(() => placeLens(false)).observe(dock);
  history.replaceState({ nf: 1 }, "");

  // Deep links from the before/after table: app.html#focus, #settings, #editor, #daypicker, #summary.
  const route = location.hash.slice(1);
  requestAnimationFrame(() => {
    if (route === "focus") stacks.today.push(focusPage());
    if (route === "settings") stacks.today.push(settingsPage());
    if (route === "daypicker") openDayPicker($("[data-daypick]"), stacks.today.pages[0]);
    if (route === "editor") { selectTab("program"); openEditor($("[data-edit]")); }
    if (route === "summary") openSummary();
    if (route === "dock") N.toast("Tap a tab twice: it scrolls to the top or pops to the root");
  });
})();
