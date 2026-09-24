/* Review page controller: direction, screen, language, theme, width and
   view toggles, plus the few live interactions inside the phones. */
(function () {
  "use strict";
  const T = window.TX;
  const DIRS = { a: window.DIR_A, b: window.DIR_B, c: window.DIR_C };
  const SCREENS = [
    ["today", "Today"], ["workout", "Workout"], ["why", "Why this weight"], ["rest", "Rest timer"],
    ["summary", "Summary"], ["summary2", "Summary, no PRs"], ["progress", "Progress"], ["chart", "Exercise chart"],
    ["history", "History"], ["session", "History session"], ["program", "Program"],
  ];
  const HEIGHT = { 360: 780, 390: 844, 430: 932 };

  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const U = window.UI = {
    dir: "a", screen: "today", lang: "pt", theme: systemDark ? "dark" : "light", w: 390, view: "one",
    load: 102.5, reps: 7, rir: 1, field: "load", rest: 84, restTotal: 120, running: true, pt: null, day: 0,
  };

  function store(k, v) { try { localStorage.setItem("taurifer-directions:" + k, v); } catch (e) { /* storage unavailable */ } }
  function recall(k) { try { return localStorage.getItem("taurifer-directions:" + k); } catch (e) { return null; } }
  for (const k of ["lang", "theme", "view"]) { const v = recall(k); if (v) U[k] = v; }
  const w = +recall("w"); if (HEIGHT[w]) U.w = w;

  function readHash() {
    const h = (location.hash || "").slice(1).split("-");
    if (DIRS[h[0]]) U.dir = h[0];
    const scr = h.slice(1).join("-");
    if (scr && SCREENS.some(([id]) => id === scr)) { U.screen = scr; U.view = "one"; }
  }
  readHash();

  const $ = (id) => document.getElementById(id);
  const baseScreen = (s) => (s === "workout2" ? "rest" : s);

  function resetFor(screen) {
    U.field = "load"; U.load = 102.5; U.rir = 1;
    U.reps = 7;
    if (screen === "rest") { U.rest = 84; U.running = true; }
    if (screen !== "chart") U.pt = null;
  }

  function phoneHTML(dirKey, screen) {
    const D = DIRS[dirKey];
    const fn = D.screens[screen] || D.screens[baseScreen(screen)] || D.screens.workout;
    T.state.lang = U.lang;
    const out = fn(U);
    return { html: `${window.KIT.statusBar()}<div class="scr">${out.body}</div>${out.over || ""}<div class="home-ind"></div>`, cls: out.cls || "" };
  }

  function device(dirKey, screen, scale, id) {
    const h = HEIGHT[U.w];
    const p = phoneHTML(dirKey, screen);
    return `<div class="dev" style="width:${((U.w + 22) * scale).toFixed(1)}px;height:${((h + 22) * scale).toFixed(1)}px">
      <div class="device" style="transform:scale(${scale})"><div class="ph d${dirKey} ${p.cls}" data-theme="${U.theme}" data-phone="${id}" data-screen="${screen}" lang="${U.lang === "pt" ? "pt-BR" : "en"}" style="width:${U.w}px;height:${h}px">${p.html}</div></div>
    </div>`;
  }

  function fitScale(single) {
    const stage = $("stage");
    const avail = stage.clientWidth || window.innerWidth - 32;
    const full = U.w + 22;
    if (!single) return Math.min(0.62, Math.max(0.42, (avail - 16) / full));
    if (window.innerWidth < 760) return Math.max(0.62, Math.min(1, avail / full));
    const bar = $("bar").offsetHeight;
    return Math.max(0.62, Math.min(1, (window.innerHeight - bar - 48) / (HEIGHT[U.w] + 22)));
  }

  function renderChrome() {
    $("dirs").innerHTML = Object.values(DIRS).map((d, i) => `<button class="rv-dir" role="tab" aria-selected="${d.key === U.dir}" data-dir="${d.key}"><b>${String.fromCharCode(65 + i)}. ${d.name}</b><span>${d.en}</span></button>`).join("");
    $("screens").innerHTML = SCREENS.map(([id, label], i) => `<button class="rv-scr" role="tab" aria-selected="${U.view === "one" && baseScreen(U.screen) === id}" data-screen="${id}"><i>${String(i + 1).padStart(2, "0")}</i>${label}</button>`).join("");
    $("screens").hidden = U.view === "all";
    for (const b of document.querySelectorAll("#lang button")) b.setAttribute("aria-pressed", b.dataset.lang === U.lang);
    for (const b of document.querySelectorAll("#theme button")) b.setAttribute("aria-pressed", b.dataset.themeSet === U.theme);
    for (const b of document.querySelectorAll("#width button")) b.setAttribute("aria-pressed", +b.dataset.w === U.w);
    for (const b of document.querySelectorAll("#view button")) b.setAttribute("aria-pressed", b.dataset.view === U.view);
  }
  const ideaHTML = (D) => `<div class="rv-idea"><h2>${D.name}<span>${D.en}</span></h2><p>${D.idea}</p></div>`;

  function render() {
    renderChrome();
    const D = DIRS[U.dir];
    if (U.view === "one") {
      const s = baseScreen(U.screen), idx = SCREENS.findIndex(([id]) => id === s);
      $("stage").innerHTML = `<div class="rv-one">${device(U.dir, U.screen, fitScale(true), "main")}
        <div class="rv-note">${ideaHTML(D)}<div class="rv-note__scr"><h3>${String(idx + 1).padStart(2, "0")} ${SCREENS[idx][1]}</h3><p>${D.notes[s]}</p>
        <div class="rv-pager"><button data-step="-1">Previous</button><button data-step="1">Next</button></div></div></div></div>`;
    } else {
      const sc = fitScale(false);
      $("stage").innerHTML = `<div class="rv-all-head">${ideaHTML(D)}</div>` + SCREENS.map(([id, label]) => `<figure class="rv-cell">${device(U.dir, id, sc, id)}<figcaption><b>${label}</b>${D.notes[id]}</figcaption></figure>`).join("");
    }
    history.replaceState(null, "", "#" + U.dir + "-" + baseScreen(U.screen));
  }

  // Re-render one phone in place, keeping its scroll position.
  function refresh(ph) {
    const screen = ph.dataset.screen;
    const scr = ph.querySelector(".scr"), top = scr ? scr.scrollTop : 0;
    const p = phoneHTML(U.dir, screen);
    ph.className = `ph d${U.dir} ${p.cls}`;
    ph.innerHTML = p.html;
    const n = ph.querySelector(".scr"); if (n) n.scrollTop = top;
  }

  function go(screen, ph) {
    resetFor(screen);
    if (U.view === "one") { U.screen = screen; render(); }
    else if (ph) { ph.dataset.screen = screen; refresh(ph); }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button,[data-go],[data-pt],[data-field]");
    if (!t) return;
    const ph = t.closest(".ph");
    if (t.dataset.dir) { U.dir = t.dataset.dir; resetFor(U.screen); return render(); }
    if (t.dataset.screen && !ph) { U.screen = t.dataset.screen; U.view = "one"; resetFor(U.screen); return render(); }
    if (t.dataset.lang) { U.lang = t.dataset.lang; store("lang", U.lang); return render(); }
    if (t.dataset.themeSet) { U.theme = t.dataset.themeSet; store("theme", U.theme); return render(); }
    if (t.dataset.w) { U.w = +t.dataset.w; store("w", U.w); return render(); }
    if (t.dataset.view) { U.view = t.dataset.view; store("view", U.view); return render(); }
    if (t.dataset.step) return step(+t.dataset.step);
    if (!ph) return;
    if (t.dataset.go) return go(t.dataset.go, ph);
    if (t.dataset.pt != null) { U.pt = +t.dataset.pt; return refresh(ph); }
    if (t.dataset.day != null) { U.day = +t.dataset.day; return refresh(ph); }
    if (t.dataset.f) U.field = t.dataset.f;
    if (t.dataset.field) { U.field = t.dataset.field; return refresh(ph); }
    const a = t.dataset.act;
    if (!a) return;
    const f = U.field;
    if (a === "inc" || a === "dec") {
      const d = a === "inc" ? 1 : -1;
      if (f === "load") U.load = Math.max(0, Math.round((U.load + d * 2.5) * 10) / 10);
      else if (f === "reps") U.reps = Math.max(0, U.reps + d);
      else U.rir = Math.min(10, Math.max(0, U.rir + d));
    }
    if (a === "rest-30") U.rest = Math.max(0, U.rest - 30);
    if (a === "rest+30") U.rest += 30;
    if (a === "rest-pause") U.running = !U.running;
    if (a === "rest-skip") U.rest = 0;
    refresh(ph);
  });

  // SVG hit targets on the thumb-direction chart.
  document.addEventListener("pointerdown", (e) => {
    const r = e.target.closest && e.target.closest("[data-pt]");
    if (r && r.tagName === "rect") { U.pt = +r.getAttribute("data-pt"); refresh(r.closest(".ph")); }
  });

  function step(d) {
    const i = SCREENS.findIndex(([id]) => id === baseScreen(U.screen));
    U.screen = SCREENS[(i + d + SCREENS.length) % SCREENS.length][0];
    resetFor(U.screen);
    render();
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea")) return;
    if (e.key === "ArrowRight" && U.view === "one") step(1);
    else if (e.key === "ArrowLeft" && U.view === "one") step(-1);
    else if (["1", "2", "3"].includes(e.key)) { U.dir = "abc"[+e.key - 1]; render(); }
  });

  setInterval(() => {
    if (!U.running) return;
    const live = document.querySelectorAll('.ph[data-screen="rest"],.ph[data-screen="workout2"]');
    if (!live.length) return;
    if (U.rest > 0) { U.rest -= 1; live.forEach(refresh); }
  }, 1000);

  window.addEventListener("hashchange", () => { readHash(); resetFor(U.screen); render(); });

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 120); });
  resetFor(U.screen);
  render();
})();
