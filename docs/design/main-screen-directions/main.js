/* Review page controller: direction, screen, language, theme, width and
   view toggles, plus the live interactions inside the phones. */
(function () {
  "use strict";
  const T = window.TX;
  const DIRS = {};
  for (const d of [window.DIR_A, window.DIR_B, window.DIR_C, window.DIR_D, window.DIR_E, window.DIR_F, window.DIR_G]) if (d) DIRS[d.key] = d;
  const KEYS = Object.keys(DIRS);
  const SCREENS = [
    ["today", "Today"], ["workout", "Workout"], ["why", "Why this weight"], ["rest", "Rest timer"], ["why-set2", "Why, set 2", true],
    ["summary", "Summary"], ["summary2", "Summary, no PRs"], ["progress", "Progress"], ["chart", "Exercise chart"],
    ["history", "History"], ["session", "History session"], ["program", "Program"],
    ["today-mixed", "Today, mixed day", true], ["why-repgoal", "Why, rep goal", true], ["why-anchor", "Why, anchor", true],
    ["why-manual", "Why, manual", true], ["summary-first", "Summary, first session", true],
  ];
  // Screens A, B and C did not draw fall back to their base screen, labelled.
  const FALLBACK = { "why-set2": "rest", "today-mixed": "today", "why-repgoal": "why", "why-anchor": "why", "why-manual": "why", "summary-first": "summary" };
  // Screens reached only by tapping, named after the review screen they belong to.
  const PARENT = { workout2: "rest", "workout-mixed": "today-mixed" };
  const HEIGHT = { 360: 780, 390: 844, 430: 932 };

  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const U = window.UI = {
    dir: "d", screen: "today", lang: "pt", theme: systemDark ? "dark" : "light", w: 390, view: "one",
    load: 102.5, reps: 7, rir: 1, field: "load", rest: 84, restTotal: 120, running: true, pt: null, day: 0,
  };
  // D-family phones keep their own shelf and view state; the rest clock is shared.
  const UD = window.UID = { load: 102.5, reps: 7, rir: 1, field: "reps", editing: false, correct: null, shelfMode: null, calcOpen: false, sheet: null, musclesAll: false, metric: "top", scope: "block", pt: null, lift: "sq" };
  Object.defineProperties(UD, {
    rest: { get: () => U.rest }, restTotal: { get: () => U.restTotal }, running: { get: () => U.running },
  });

  function store(k, v) { try { localStorage.setItem("taurifer-directions:" + k, v); } catch (e) { /* storage unavailable */ } }
  function recall(k) { try { return localStorage.getItem("taurifer-directions:" + k); } catch (e) { return null; } }
  for (const k of ["lang", "theme", "view"]) { const v = recall(k); if (v) U[k] = v; }
  if (!["one", "all", "compare"].includes(U.view)) U.view = "one";
  const w = +recall("w"); if (HEIGHT[w]) U.w = w;

  const isScreen = (id) => SCREENS.some(([s]) => s === id);
  function readHash() {
    const h = (location.hash || "").slice(1).split("-");
    if (DIRS[h[0]]) U.dir = h[0];
    const scr = h.slice(1).join("-");
    if (scr && isScreen(scr)) { U.screen = scr; if (U.view === "all") U.view = "one"; }
  }
  readHash();

  const $ = (id) => document.getElementById(id);
  const baseScreen = (s) => PARENT[s] || s;
  const stateFor = (key) => (DIRS[key] && DIRS[key].family ? UD : U);
  const family = () => DIRS.d || Object.values(DIRS).find((d) => d.family);

  function resetFor(screen) {
    U.field = "load"; U.load = 102.5; U.rir = 1; U.reps = 7;
    if (screen === "rest" || screen === "why-set2") { U.rest = 84; U.running = true; }
    if (screen !== "chart") U.pt = null;
    Object.assign(UD, { field: "reps", editing: false, correct: null, shelfMode: null, calcOpen: false, sheet: null, musclesAll: false, open: null });
    if (screen !== "chart") { UD.pt = null; UD.lift = "sq"; UD.metric = "top"; UD.scope = "block"; }
    const fam = family();
    if (fam && fam.seed) Object.assign(UD, fam.seed(screen));
  }

  function resolve(dirKey, screen) {
    const D = DIRS[dirKey];
    if (D.screens[screen]) return { fn: D.screens[screen], drawn: true };
    const fb = FALLBACK[screen];
    if (fb && D.screens[fb]) return { fn: D.screens[fb], drawn: false, as: fb };
    return { fn: D.screens.workout, drawn: false, as: "workout" };
  }

  function phoneHTML(dirKey, screen) {
    const r = resolve(dirKey, screen);
    T.state.lang = U.lang;
    const out = r.fn(stateFor(dirKey));
    return { html: `${window.KIT.statusBar()}<div class="scr">${out.body}</div>${out.over || ""}<div class="home-ind"></div>`, cls: out.cls || "", drawn: r.drawn, as: r.as };
  }

  function device(dirKey, screen, scale, id) {
    const h = HEIGHT[U.w];
    const p = phoneHTML(dirKey, screen);
    const fam = DIRS[dirKey].family ? " dx" : "";
    return `<div class="dev" style="width:${((U.w + 22) * scale).toFixed(1)}px;height:${((h + 22) * scale).toFixed(1)}px">
      <div class="device" style="transform:scale(${scale})"><div class="ph d${dirKey}${fam} ${p.cls}" data-theme="${U.theme}" data-dir="${dirKey}" data-phone="${id}" data-screen="${screen}" data-drawn="${p.drawn}" lang="${U.lang === "pt" ? "pt-BR" : "en"}" style="width:${U.w}px;height:${h}px">${p.html}</div></div>
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

  const letter = (key) => String.fromCharCode(65 + KEYS.indexOf(key));
  const screenLabel = (id) => (SCREENS.find(([s]) => s === id) || [id, id])[1];
  const noteFor = (D, screen) => D.notes[screen] || D.notes[baseScreen(screen)] || "";
  const notDrawn = (D, screen) => `<p class="rv-nd">Not drawn in ${D.name}. Showing its ${screenLabel(FALLBACK[screen] || "workout")} screen.</p>`;

  function renderChrome() {
    $("dirs").innerHTML = KEYS.map((k) => { const d = DIRS[k]; return `<button class="rv-dir${d.family ? " is-new" : ""}" role="tab" aria-selected="${d.key === U.dir}" data-dir="${d.key}"><b>${letter(k)}. ${d.name}</b><span>${d.en}</span></button>`; }).join("");
    $("screens").innerHTML = SCREENS.map(([id, label, extra], i) => `<button class="rv-scr${extra ? " is-extra" : ""}" role="tab" aria-selected="${U.view !== "all" && baseScreen(U.screen) === id}" data-screen="${id}"><i>${String(i + 1).padStart(2, "0")}</i>${label}</button>`).join("");
    $("screens").hidden = U.view === "all";
    for (const b of document.querySelectorAll("#lang button")) b.setAttribute("aria-pressed", b.dataset.lang === U.lang);
    for (const b of document.querySelectorAll("#theme button")) b.setAttribute("aria-pressed", b.dataset.themeSet === U.theme);
    for (const b of document.querySelectorAll("#width button")) b.setAttribute("aria-pressed", +b.dataset.w === U.w);
    for (const b of document.querySelectorAll("#view button")) b.setAttribute("aria-pressed", b.dataset.view === U.view);
  }
  const ideaHTML = (D) => `<div class="rv-idea"><h2>${letter(D.key)}. ${D.name}<span>${D.en}</span></h2><p>${D.idea}</p></div>`;

  function render() {
    renderChrome();
    const D = DIRS[U.dir];
    const s = baseScreen(U.screen), idx = SCREENS.findIndex(([id]) => id === s);
    if (U.view === "one") {
      const drawn = resolve(U.dir, s).drawn;
      $("stage").innerHTML = `<div class="rv-one">${device(U.dir, U.screen, fitScale(true), "main")}
        <div class="rv-note">${ideaHTML(D)}<div class="rv-note__scr"><h3>${String(idx + 1).padStart(2, "0")} ${SCREENS[idx][1]}</h3>${drawn ? "" : notDrawn(D, s)}<p>${noteFor(D, U.screen)}</p>
        <div class="rv-pager"><button data-step="-1">Previous</button><button data-step="1">Next</button></div></div></div></div>`;
    } else if (U.view === "compare") {
      const sc = fitScale(false);
      $("stage").innerHTML = `<div class="rv-all-head"><div class="rv-idea"><h2>${String(idx + 1).padStart(2, "0")} ${SCREENS[idx][1]}<span>Every direction on the same screen</span></h2></div></div>` +
        KEYS.map((k) => { const d = DIRS[k], drawn = resolve(k, s).drawn; return `<figure class="rv-cell${drawn ? "" : " is-nd"}">${device(k, U.screen, sc, "cmp-" + k)}<figcaption><b>${letter(k)}. ${d.name}</b>${drawn ? noteFor(d, s) : "Not drawn in this direction."}</figcaption></figure>`; }).join("");
    } else {
      const sc = fitScale(false);
      const list = SCREENS.filter(([, , extra]) => !extra || D.family);
      $("stage").innerHTML = `<div class="rv-all-head">${ideaHTML(D)}</div>` + list.map(([id, label]) => `<figure class="rv-cell">${device(U.dir, id, sc, id)}<figcaption><b>${label}</b>${noteFor(D, id)}</figcaption></figure>`).join("");
    }
    history.replaceState(null, "", "#" + U.dir + "-" + s);
  }

  // Re-render one phone in place, keeping its scroll positions.
  function refresh(ph) {
    const screen = ph.dataset.screen, key = ph.dataset.dir;
    const scr = ph.querySelector(".scr"), top = scr ? scr.scrollTop : 0;
    const sb = ph.querySelector(".x-sheet__body"), stop = sb ? sb.scrollTop : 0;
    const p = phoneHTML(key, screen);
    ph.className = `ph d${key}${DIRS[key].family ? " dx" : ""} ${p.cls}`;
    ph.innerHTML = p.html;
    const n = ph.querySelector(".scr"); if (n) n.scrollTop = top;
    const nb = ph.querySelector(".x-sheet__body"); if (nb) nb.scrollTop = stop;
  }

  function go(screen, ph, after) {
    resetFor(screen);
    if (after) after();
    if (U.view === "one" && isScreen(baseScreen(screen))) { U.screen = screen; render(); }
    else if (ph) { ph.dataset.screen = screen; refresh(ph); }
  }

  const parseNum = (v) => { const x = parseFloat(String(v).replace(",", ".")); return Number.isFinite(x) ? x : 0; };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button,[data-go],[data-pt],[data-field]");
    if (!t) return;
    const ph = t.closest(".ph");
    if (t.dataset.dir && !ph) { U.dir = t.dataset.dir; resetFor(U.screen); return render(); }
    if (t.dataset.screen && !ph) { U.screen = t.dataset.screen; if (U.view === "all") U.view = "one"; resetFor(U.screen); return render(); }
    if (t.dataset.lang) { U.lang = t.dataset.lang; store("lang", U.lang); return render(); }
    if (t.dataset.themeSet) { U.theme = t.dataset.themeSet; store("theme", U.theme); return render(); }
    if (t.dataset.w) { U.w = +t.dataset.w; store("w", U.w); return render(); }
    if (t.dataset.view) { U.view = t.dataset.view; store("view", U.view); return render(); }
    if (t.dataset.step) return step(+t.dataset.step);
    if (!ph) return;
    const S = stateFor(ph.dataset.dir);
    const fam = S === UD;
    if (t.dataset.log && fam && S.correct != null) {
      const f = family();
      S.correct = null; Object.assign(S, f && f.seed ? f.seed(ph.dataset.screen) : {}); S.field = "reps"; S.editing = false; S.shelfMode = null;
      return refresh(ph);
    }
    if (t.dataset.go) return go(t.dataset.go, ph, t.dataset.lift ? () => { UD.lift = t.dataset.lift; } : null);
    if (t.dataset.sheet != null) { S.sheet = t.dataset.sheet || null; return refresh(ph); }
    if (t.dataset.open != null) { S.open = S.open === t.dataset.open ? "" : t.dataset.open; return refresh(ph); }
    if (t.dataset.toggle) { if (t.dataset.toggle === "calc") S.calcOpen = !S.calcOpen; if (t.dataset.toggle === "muscles") S.musclesAll = !S.musclesAll; return refresh(ph); }
    if (t.dataset.scope) { S.scope = t.dataset.scope; S.pt = null; return refresh(ph); }
    if (t.dataset.metric) { S.metric = t.dataset.metric; return refresh(ph); }
    if (t.dataset.edit != null) { S.correct = +t.dataset.edit; S.load = 102.5; S.reps = 7; S.rir = 1; S.field = "reps"; S.editing = false; S.shelfMode = "pads"; return refresh(ph); }
    if (t.dataset.pt != null) { S.pt = +t.dataset.pt; return refresh(ph); }
    if (t.dataset.day != null) { U.day = +t.dataset.day; return refresh(ph); }
    if (t.dataset.f) U.field = t.dataset.f;
    if (t.dataset.field) {
      if (fam) {
        if (S.field === t.dataset.field && !S.editing) S.editing = true;
        else { S.field = t.dataset.field; S.editing = false; }
        S.shelfMode = "pads";
        refresh(ph);
        const inp = ph.querySelector("[data-input]"); if (inp) { inp.focus(); inp.select(); }
        return;
      }
      U.field = t.dataset.field; return refresh(ph);
    }
    const a = t.dataset.act;
    if (!a) return;
    const f = S.field;
    if (a === "inc" || a === "dec") {
      const d = a === "inc" ? 1 : -1;
      if (f === "load") S.load = Math.max(0, Math.round((S.load + d * 2.5) * 10) / 10);
      else if (f === "reps") S.reps = Math.max(0, S.reps + d);
      else S.rir = Math.min(10, Math.max(0, S.rir + d));
      if (fam) S.editing = false;
    }
    if (a === "rest-30") U.rest = Math.max(0, U.rest - 30);
    if (a === "rest+30") U.rest += 30;
    if (a === "rest-pause") U.running = !U.running;
    if (a === "rest-skip") U.rest = 0;
    refresh(ph);
  });

  document.addEventListener("input", (e) => {
    const inp = e.target.closest && e.target.closest("[data-input]");
    if (!inp) return;
    UD[inp.dataset.input] = inp.dataset.input === "load" ? parseNum(inp.value) : Math.round(parseNum(inp.value));
  });
  document.addEventListener("keydown", (e) => {
    const inp = e.target.closest && e.target.closest("[data-input]");
    if (inp && e.key === "Enter") { UD.editing = false; refresh(inp.closest(".ph")); }
  });

  // Chart taps. A/B/C draw per-point rects; D-family plots snap to the nearest session.
  document.addEventListener("pointerdown", (e) => {
    const r = e.target.closest && e.target.closest("[data-pt]");
    if (r && r.tagName === "rect") { U.pt = +r.getAttribute("data-pt"); refresh(r.closest(".ph")); return; }
    const c = e.target.closest && e.target.closest("[data-chart]");
    if (!c) return;
    const box = c.getBoundingClientRect();
    const fx = ((e.clientX - box.left) / box.width) * 100;
    const xs = c.dataset.chart.split(",").map(Number);
    let best = 0;
    xs.forEach((v, i) => { if (Math.abs(v - fx) < Math.abs(xs[best] - fx)) best = i; });
    UD.pt = best; refresh(c.closest(".ph"));
  });

  function step(d) {
    const i = SCREENS.findIndex(([id]) => id === baseScreen(U.screen));
    U.screen = SCREENS[(i + d + SCREENS.length) % SCREENS.length][0];
    resetFor(U.screen);
    render();
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea")) return;
    if (e.key === "ArrowRight" && U.view !== "all") step(1);
    else if (e.key === "ArrowLeft" && U.view !== "all") step(-1);
    else if (/^[1-9]$/.test(e.key) && KEYS[+e.key - 1]) { U.dir = KEYS[+e.key - 1]; resetFor(U.screen); render(); }
  });

  setInterval(() => {
    if (!U.running) return;
    const live = document.querySelectorAll('.ph[data-screen="rest"],.ph[data-screen="workout2"]');
    if (!live.length || U.rest <= 0) return;
    U.rest -= 1;
    live.forEach((ph) => { if (!ph.querySelector("input:focus")) refresh(ph); });
  }, 1000);

  window.addEventListener("hashchange", () => { readHash(); resetFor(U.screen); render(); });

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 120); });
  resetFor(U.screen);
  render();
})();
