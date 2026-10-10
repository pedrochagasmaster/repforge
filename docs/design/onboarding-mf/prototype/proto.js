/* Working onboarding prototype for candidates A, B and C.
   app.html?c=a|b|c&lang=pt|en&theme=light|dark[&rm=1][&reset=1][#shared]
   Motion comes from the app's own motion-layer.js (RepForgeMotion) on the
   vendored Motion runtime; the program comes from the real engine in a worker. */
(function () {
  "use strict";
  const P = new URLSearchParams(location.search);
  const CAND = ["a", "b", "c"].includes(P.get("c")) ? P.get("c") : "b";
  const LANG = P.get("lang") === "en" ? "en" : "pt";
  const T = window.STRINGS[LANG];
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const THEME = P.get("theme") || (CAND === "a" ? "dark" : prefersDark ? "dark" : "light");
  const M = window.RepForgeMotion;
  const RM = P.get("rm") === "1" || M.reducedMotion();
  const V = M.vocabulary;
  const ROOT = "../../../../";
  const LIB = Object.fromEntries((window.RepForgeExercises?.library || []).map((e) => [e.id, e]));
  const ic = window.icon;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const fmt = (n, d = 1) => n.toFixed(d).replace(".", T.decimal);

  // ---------- engine ----------
  const worker = new Worker("engine-worker.js?v=3");
  let seq = 0;
  const pending = new Map();
  worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
  const ask = (msg) => new Promise((res) => { const id = ++seq; pending.set(id, res); worker.postMessage({ ...msg, id }); });

  // ---------- state ----------
  const KEY = `onbmf:${CAND}:${LANG}`;
  const COMPETENCY = ["pullups5", "pullups10", "bodyweightDips10", "pushups15", "benchPress10", "inclineBarbell10", "overheadPress10"];
  const GYMS = ["everything", "commercial", "warehouse", "local", "garage", "home"];
  const GROUP_KEYS = Object.keys(T.equipment.groups);
  const MUSCLES = Object.keys(T.priorities.muscles);
  const GOALS = ["muscle_growth", "strength", "balanced"];
  const EXPERIENCE = ["first", "under_6m", "6_to_24m", "over_24m"];
  const fresh = () => ({
    stack: ["hub"], hub: null, shared: false,
    a: {
      sex: null, birth: null, height: null, weight: null, heightUnit: "cm", weightUnit: "kg",
      lifting: null, cardio: null, gym: null, equipAdd: [], equipRemove: [],
      goal: null, days: null, minutes: 60, emphasis: [], deemphasis: [], deload: true,
      competency: {}, weeks: 7, pattern: "static", confirmations: {},
    },
    build: { name: "", days: 3 }, importPick: null, edits: [], editsKey: null,
  });
  let S;
  try { S = P.get("reset") === "1" ? null : JSON.parse(sessionStorage.getItem(KEY)); } catch { S = null; }
  if (!S) S = fresh();
  if (!Array.isArray(S.edits)) S.edits = [];
  if (location.hash === "#shared" && S.stack[0] !== "shared") { S = fresh(); S.stack = ["shared"]; }
  const save = () => sessionStorage.setItem(KEY, JSON.stringify(S));
  const A = () => S.a;
  const groups = {}; // preset -> {group: bool}
  let result = null, resultKey = null, resultPlayed = false, building = null;
  const ui = { tab: 0, discOpen: false };

  // ---------- flows ----------
  const FLOW = CAND === "c"
    ? ["about", "experience", "gym", "program", "focus", "competency", "building", "result", "handoff"]
    : ["intro", "sex", "birth", "height", "weight", "lifting", "cardio", "gym", "equipment", "goal", "days", "minutes", "priorities", "deload", "competency", "building", "result", "handoff"];
  const SECTION = { sex: "basics", birth: "basics", height: "basics", weight: "basics", lifting: "basics", cardio: "basics", about: "basics", experience: "basics", gym: "gym", equipment: "gym", goal: "program", days: "program", minutes: "program", priorities: "program", deload: "program", competency: "program", program: "program", focus: "program", result: "result" };
  const SECTIONS = ["basics", "gym", "program", "result"];
  const MODE = { hub: "none", shared: "none", building: "none", handoff: "none", intro: "bare", build: "bare", import: "bare", "end-build": "bare", "end-import": "bare" };
  const nextOf = (id) => FLOW[FLOW.indexOf(id) + 1];

  // ---------- shell ----------
  const app = document.createElement("div");
  app.className = "app";
  app.dataset.cand = CAND;
  app.dataset.theme = THEME;
  if (RM) app.classList.add("rm");
  app.innerHTML = `<header class="hdr" hidden></header><div class="stage"></div><div class="srlive" aria-live="polite"></div>`;
  document.body.appendChild(app);
  document.body.dataset.theme = THEME;
  document.documentElement.lang = LANG === "pt" ? "pt-BR" : "en";
  const framed = () => innerWidth > 520;
  const syncFrame = () => document.body.classList.toggle("framed", framed());
  syncFrame(); addEventListener("resize", syncFrame);
  const stage = $(".stage", app), hdr = $(".hdr", app), live = $(".srlive", app);
  const announce = (t) => { live.textContent = ""; setTimeout(() => { live.textContent = t; }, 30); };

  // ---------- pieces ----------
  const cur = () => S.stack[S.stack.length - 1];
  function option(group, val, label, sub, iconName, sel, extra = "") {
    return `<button class="opt ${sel ? "sel" : ""}" role="radio" aria-checked="${sel}" data-pick="${group}" data-val="${val}" ${extra}>
      ${iconName ? `<span class="opt-ic">${ic(iconName, CAND === "a" ? 28 : 24)}</span>` : ""}
      <span class="opt-tx"><span class="opt-l">${label}</span>${sub ? `<span class="opt-s">${sub}</span>` : ""}</span><span class="radio"></span></button>`;
  }
  const options = (group, list, selected, icons, cls = "") =>
    `<div class="opts ${cls}" role="radiogroup">${list.map((o, i) => option(group, i, o[0], o[1], icons && icons[i], selected === i)).join("")}</div>`;
  function seg(group, labels, sel, cls = "") {
    return `<div class="seg ${cls}" role="radiogroup" data-seg="${group}" style="--n:${labels.length};--i:${sel ?? -1}">${CAND === "a" ? `<i class="segthumb" ${sel == null || sel < 0 ? "hidden" : ""}></i>` : ""}${labels.map((l, i) =>
      `<button role="radio" aria-checked="${i === sel}" class="${i === sel ? "on" : ""}" data-segval="${i}">${l}</button>`).join("")}</div>`;
  }
  const title = (q, sub) => `<h1 class="q">${q}</h1>${sub ? `<p class="lede">${sub}</p>` : ""}`;
  const note = (text, cls = "") => `<p class="note ${cls}">${ic("lock", 16)}<span>${text}</span></p>`;
  const brand = () => `<div class="brand"><img src="${ROOT}assets/brand/mark.png" alt=""><span>Taurifer</span></div>`;
  function footer({ cta = T.next, skip = null, act = "next", disabled = false, hint = true } = {}) {
    return `<footer class="ft">${skip ? `<button class="skip" data-act="skip">${skip}</button>` : ""}
      ${hint ? `<p class="need" ${disabled ? "" : "hidden"}>${T.required}</p>` : ""}
      <button class="cta" data-act="${act}" ${disabled ? "disabled" : ""}><span>${cta}</span>${CAND === "a" ? "" : `<span class="arr">→</span>`}</button></footer>`;
  }
  const page = (body, foot = "") => `<div class="scroll"><div class="content">${body}</div></div>${foot}`;

  // ---------- pickers ----------
  const ITEM = 44;
  function wheelCol(name, values, sel, cls = "") {
    return `<div class="wcol ${cls}" data-wheel="${name}" tabindex="0"><div class="wpad"></div>${values.map((v, i) => `<div class="wv" data-i="${i}">${v}</div>`).join("")}<div class="wpad"></div></div>`;
  }
  function mountWheel(col, sel, onChange) {
    const items = $$(".wv", col);
    const paint = () => {
      const center = col.scrollTop / ITEM;
      items.forEach((it, i) => {
        const d = i - center, ad = Math.min(Math.abs(d), 3);
        it.style.opacity = String(Math.max(0.12, 1 - ad * 0.36));
        it.style.transform = RM ? "" : `perspective(400px) rotateX(${Math.max(-60, Math.min(60, -d * 18))}deg)`;
        it.classList.toggle("on", Math.round(center) === i);
      });
    };
    col.scrollTop = sel * ITEM;
    paint();
    let timer = 0, last = sel;
    const settle = () => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(col.scrollTop / ITEM)));
      if (i !== last) { last = i; onChange(i); }
    };
    col.addEventListener("scroll", () => { requestAnimationFrame(paint); clearTimeout(timer); timer = setTimeout(settle, 110); }, { passive: true });
    col.addEventListener("click", (e) => { const it = e.target.closest(".wv"); if (it) col.scrollTo({ top: +it.dataset.i * ITEM, behavior: RM ? "auto" : "smooth" }); });
    col.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const i = Math.round(col.scrollTop / ITEM) + (e.key === "ArrowDown" ? 1 : -1);
      col.scrollTo({ top: Math.max(0, i) * ITEM, behavior: RM ? "auto" : "smooth" });
    });
  }
  const STEP_PX = 10;
  function rulerHtml(min, max, step) {
    const n = Math.round((max - min) / step);
    const labels = [];
    for (let i = 0; i <= n; i += 10) labels.push(`<em style="left:${i * STEP_PX}px">${Math.round(min + i * step)}</em>`);
    return `<div class="ruler"><div class="rv"><b data-rv></b> <span data-ru></span></div><div class="rscroll" tabindex="0"><div class="rtrack" style="width:${n * STEP_PX}px">${labels.join("")}</div></div><span class="rneedle"></span></div>`;
  }
  function mountRuler(el, min, max, step, value, unit, onChange) {
    const sc = $(".rscroll", el), out = $("[data-rv]", el);
    $("[data-ru]", el).textContent = unit;
    const pad = sc.clientWidth / 2;
    $(".rtrack", el).style.margin = `0 ${pad}px`;
    const val = () => Math.max(min, Math.min(max, min + Math.round(sc.scrollLeft / STEP_PX) * step));
    sc.scrollLeft = ((value - min) / step) * STEP_PX;
    const show = () => { out.textContent = fmt(val(), step < 1 ? 1 : 0); };
    show();
    let timer = 0;
    sc.addEventListener("scroll", () => {
      requestAnimationFrame(show);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const target = Math.round(sc.scrollLeft / STEP_PX) * STEP_PX;
        if (Math.abs(target - sc.scrollLeft) > 0.5) sc.scrollTo({ left: target, behavior: RM ? "auto" : "smooth" });
        onChange(val());
      }, 120);
    }, { passive: true });
    sc.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      sc.scrollBy({ left: e.key === "ArrowRight" ? STEP_PX : -STEP_PX });
    });
  }

  // Value helpers for the Basics pickers.
  const defaults = { birth: { d: 14, m: 5, y: 1993 }, cm: 174, kg: 80.5 };
  const daysIn = (m, y) => new Date(y, m + 1, 0).getDate();
  const cmToFtIn = (cm) => { const t = Math.round(cm / 2.54); return { ft: Math.floor(t / 12), inch: t % 12 }; };
  const birthText = (b) => b ? (LANG === "pt" ? `${String(b.d).padStart(2, "0")}/${String(b.m + 1).padStart(2, "0")}/${b.y}` : `${T.birth.months[b.m].slice(0, 3)} ${b.d}, ${b.y}`) : T.unset;
  const heightText = (h) => { if (!h) return T.unset; if (A().heightUnit === "cm") return `${h} cm`; const f = cmToFtIn(h); return `${f.ft}′ ${f.inch}″`; };
  const weightText = (w) => w ? (A().weightUnit === "kg" ? `${fmt(w)} kg` : `${fmt(w * 2.20462)} lb`) : T.unset;

  function birthPicker() {
    const b = A().birth || defaults.birth;
    const years = Array.from({ length: 81 }, (_, i) => 1940 + i);
    return `<div class="wheels" data-birth>${wheelCol("d", Array.from({ length: daysIn(b.m, b.y) }, (_, i) => i + 1), b.d - 1, "narrow")}${wheelCol("m", T.birth.months, b.m, "wide")}${wheelCol("y", years, b.y - 1940)}<div class="wband"></div></div>`;
  }
  function mountBirth(root, commit) {
    const box = $("[data-birth]", root);
    if (!box) return;
    const b = { ...(A().birth || defaults.birth) };
    const rebuildDays = () => {
      const max = daysIn(b.m, b.y);
      if (b.d > max) b.d = max;
      const old = $("[data-wheel=d]", box);
      old.outerHTML = wheelCol("d", Array.from({ length: max }, (_, i) => i + 1), b.d - 1, "narrow");
      mountWheel($("[data-wheel=d]", box), b.d - 1, (i) => { b.d = i + 1; commit(b); });
    };
    mountWheel($("[data-wheel=d]", box), b.d - 1, (i) => { b.d = i + 1; commit(b); });
    mountWheel($("[data-wheel=m]", box), b.m, (i) => { b.m = i; rebuildDays(); commit(b); });
    mountWheel($("[data-wheel=y]", box), b.y - 1940, (i) => { b.y = 1940 + i; rebuildDays(); commit(b); });
    commit(b);
  }
  function heightPicker() {
    const cm = A().height || defaults.cm;
    const wheels = A().heightUnit === "cm"
      ? `<div class="wheels" data-height>${wheelCol("cm", Array.from({ length: 101 }, (_, i) => `${120 + i} cm`), cm - 120)}<div class="wband"></div></div>`
      : (() => { const f = cmToFtIn(cm); return `<div class="wheels" data-height>${wheelCol("ft", [3, 4, 5, 6, 7].map((n) => `${n} ft`), f.ft - 3)}${wheelCol("in", Array.from({ length: 12 }, (_, i) => `${i} in`), f.inch)}<div class="wband"></div></div>`; })();
    return `${seg("hunit", T.height.units, A().heightUnit === "cm" ? 0 : 1, "unit")}<div class="pick">${wheels}</div>`;
  }
  function mountHeight(root, commit) {
    const box = $("[data-height]", root);
    if (!box) return;
    let cm = A().height || defaults.cm;
    if (A().heightUnit === "cm") mountWheel($("[data-wheel=cm]", box), cm - 120, (i) => { cm = 120 + i; commit(cm); });
    else {
      const f = cmToFtIn(cm);
      const set = () => { cm = Math.round((f.ft * 12 + f.inch) * 2.54); commit(cm); };
      mountWheel($("[data-wheel=ft]", box), f.ft - 3, (i) => { f.ft = 3 + i; set(); });
      mountWheel($("[data-wheel=in]", box), f.inch, (i) => { f.inch = i; set(); });
    }
    commit(cm);
  }
  function weightPicker() {
    const kgUnit = A().weightUnit === "kg";
    return `${seg("wunit", T.weight.units, kgUnit ? 0 : 1, "unit")}<div class="pick" data-weight>${kgUnit ? rulerHtml(30, 200, 0.1) : rulerHtml(66, 440, 0.2)}</div>`;
  }
  function mountWeight(root, commit) {
    const box = $("[data-weight]", root);
    if (!box) return;
    const kg = A().weight || defaults.kg;
    if (A().weightUnit === "kg") mountRuler(box, 30, 200, 0.1, kg, "kg", (v) => commit(v));
    else mountRuler(box, 66, 440, 0.2, Math.round(kg * 2.20462 * 5) / 5, "lb", (v) => commit(v / 2.20462));
    commit(kg);
  }

  // ---------- steps ----------
  const STEPS = {
    hub: {
      render: () => page(`${brand()}${title(T.hub.title, T.hub.lede)}${options("hub", T.hub.opts, S.hub, ["wand", "pencil", "file"])}<p class="hint">${ic("link", 16)}<span>${T.hub.linkNote}</span></p>`, footer({ disabled: S.hub == null })),
      ok: () => S.hub != null,
      next: () => go(S.hub === 0 ? FLOW[0] : S.hub === 1 ? "build" : "import"),
    },
    intro: {
      render: () => page(`${brand()}${title(T.intro.title, T.intro.sub)}<ol class="vstep">${T.intro.steps.map((s, i) => `<li class="${i === 0 ? "on" : ""}"><span class="vs-n">${i + 1}</span><span><b>${s[0]}</b><span>${s[1]}</span></span></li>`).join("")}</ol>`, footer({ cta: T.intro.cta, hint: false })),
      ok: () => true,
    },
    sex: {
      render: () => page(`${title(T.sex.q)}${options("sex", T.sex.opts, A().sex, ["female", "male", "none"])}${note(`${T.localOnly} ${T.notUsedYet}`)}`, footer({ skip: T.skip, disabled: A().sex == null })),
      ok: () => A().sex != null, skip: () => { A().sex = null; },
    },
    birth: {
      render: () => page(`${title(T.birth.q)}<div class="pick">${birthPicker()}</div>${note(`${T.localOnly} ${T.notUsedYet}`)}`, footer({ skip: T.skip, hint: false })),
      mount: (el) => mountBirth(el, (b) => { STEPS.birth.draft = b; }),
      ok: () => true, commit: () => { A().birth = STEPS.birth.draft; }, skip: () => { A().birth = null; },
    },
    height: {
      render: () => page(`${title(T.height.q)}${heightPicker()}${note(`${T.localOnly} ${T.notUsedYet}`)}`, footer({ skip: T.skip, hint: false })),
      mount: (el) => mountHeight(el, (cm) => { STEPS.height.draft = cm; }),
      ok: () => true, commit: () => { A().height = STEPS.height.draft; }, skip: () => { A().height = null; },
    },
    weight: {
      render: () => page(`${title(T.weight.q)}${weightPicker()}${note(`${T.localOnly} ${T.weight.note}`)}`, footer({ skip: T.skip, hint: false })),
      mount: (el) => mountWeight(el, (kg) => { STEPS.weight.draft = Math.round(kg * 10) / 10; }),
      ok: () => true, commit: () => { A().weight = STEPS.weight.draft; }, skip: () => { A().weight = null; },
    },
    lifting: {
      render: () => page(`${title(T.lifting.q)}${options("lifting", T.lifting.opts, A().lifting, ["bars0", "bars1", "bars2", "bars3"])}`, footer({ disabled: A().lifting == null })),
      ok: () => A().lifting != null,
    },
    cardio: {
      render: () => page(`${title(T.cardio.q)}${options("cardio", T.cardio.opts, A().cardio, ["bars0", "bars1", "bars2", "bars3"])}${note(`${T.localOnly} ${T.notUsedYet}`)}`, footer({ skip: T.skip, disabled: A().cardio == null })),
      ok: () => A().cardio != null, skip: () => { A().cardio = null; },
    },
    gym: {
      render: () => CAND === "c"
        ? page(`${title(T.gym.q)}${options("gym", T.gym.opts.map((o) => [o[0]]), GYMS.indexOf(A().gym), ["everything", "commercial", "warehouse", "local", "garage", "home"], "compact")}<div class="disc ${ui.discOpen ? "open" : ""}" ${A().gym ? "" : "hidden"}><button class="disc-h" data-act="disc" aria-expanded="${ui.discOpen}"><b>${T.equipment.title}</b><span data-eqsum></span>${ic("chevD", 16, "chev")}</button><div class="disc-slot"><div class="disc-body">${equipList("chips")}</div></div></div>`, footer({ disabled: !A().gym }))
        : page(`${title(T.gym.q, T.gym.sub)}${options("gym", T.gym.opts, GYMS.indexOf(A().gym), ["everything", "commercial", "warehouse", "local", "garage", "home"])}`, footer({ disabled: !A().gym })),
      mount: (el) => { if (CAND === "c") { paintEquip(el); } },
      ok: () => !!A().gym,
    },
    equipment: {
      render: () => page(`${title(T.equipment.q, T.equipment.sub(T.gym.opts[GYMS.indexOf(A().gym)]?.[0] || ""))}${equipList("rows")}<button class="link" data-act="eqreset">${T.equipment.reset}</button>`, footer({ hint: false })),
      mount: (el) => paintEquip(el),
      ok: () => true,
    },
    goal: {
      render: () => page(`${title(T.goal.q)}${options("goal", T.goal.opts, A().goal, ["muscle", "dumbbell", "balance"])}`, footer({ disabled: A().goal == null })),
      ok: () => A().goal != null,
    },
    days: {
      render: () => page(`${title(T.days.q)}${options("days", [2, 3, 4, 5, 6].map((n) => [T.days.unit(n)]), A().days == null ? null : A().days - 2, null, "compact")}<p class="fact" data-split>${A().days ? T.days.split[A().days] : ""}</p>`, footer({ disabled: A().days == null })),
      ok: () => A().days != null,
    },
    minutes: {
      render: () => page(`${title(T.minutes.q, T.minutes.sub)}${options("minutes", [20, 40, 60, 90, 120, 150].map((n) => [T.minutes.unit(n)]), [20, 40, 60, 90, 120, 150].indexOf(A().minutes), null, "compact")}`, footer({ hint: false })),
      ok: () => true,
    },
    priorities: {
      render: () => page(`${title(T.priorities.q, T.priorities.sub)}<div class="prio">${MUSCLES.map((m) => `<div class="prow"><span>${T.priorities.muscles[m]}</span>${seg("prio:" + m, T.priorities.states, prioState(m), "mini")}</div>`).join("")}</div><p class="limit" hidden>${T.priorities.limit}</p>`, footer({ skip: T.skipSection, hint: false })),
      ok: () => true, skip: () => { A().emphasis = []; A().deemphasis = []; },
    },
    deload: {
      render: () => page(`${title(T.deload.q)}<div class="tcard"><div class="tc-top">${ic("lighter", 30)}${toggle("deload", A().deload)}</div><b>${T.deload.title}</b><p>${T.deload.body}</p><span class="tag">${T.deload.rec}</span></div>`, footer({ hint: false })),
      ok: () => true,
    },
    competency: {
      render: () => page(`${title(T.competency.q, T.competency.sub)}<div class="comp">${COMPETENCY.map((k) => `<div class="crow"><span class="cq">${T.competency.items[k]}</span>${seg("comp:" + k, T.competency.answers, compState(k), "tri")}</div>`).join("")}</div>`, footer({ hint: false })),
      ok: () => true,
    },
    // C composites
    about: {
      render: () => page(`${title(T.about.title, T.about.sub)}<div class="form">
        <div class="frow"><span class="fl">${T.sex.label}<em>${T.notUsedYet}</em></span>${seg("sexc", T.sex.short, A().sex, "mini")}</div>
        <button class="frow" data-sheet="birth"><span class="fl">${T.birth.label}<em>${T.notUsedYet}</em></span><span class="val">${birthText(A().birth)} ${ic("chevR", 16)}</span></button>
        <button class="frow" data-sheet="height"><span class="fl">${T.height.label}<em>${T.notUsedYet}</em></span><span class="val">${heightText(A().height)} ${ic("chevR", 16)}</span></button>
        <button class="frow" data-sheet="weight"><span class="fl">${T.weight.label}<em class="used">${T.weight.note}</em></span><span class="val">${weightText(A().weight)} ${ic("chevR", 16)}</span></button></div>`,
        footer({ skip: T.skipSection, hint: false })),
      ok: () => true, skip: () => { Object.assign(A(), { sex: null, birth: null, height: null, weight: null }); },
    },
    experience: {
      render: () => page(`${title(T.history)}<p class="flabel">${T.lifting.q}</p>${options("lifting", T.lifting.opts, A().lifting, null, "compact")}<p class="flabel">${T.cardio.q}<em>${T.notUsedYet}</em></p>${seg("cardioc", T.cardio.opts.map((o) => o[0]), A().cardio, "wrap")}`, footer({ disabled: A().lifting == null })),
      ok: () => A().lifting != null,
    },
    program: {
      render: () => page(`${title(T.programTitle)}<p class="flabel">${T.goal.q}</p>${options("goal", T.goal.opts.map((o) => [o[0]]), A().goal, ["muscle", "dumbbell", "balance"], "compact")}
        <p class="flabel">${T.days.q}</p>${seg("daysc", ["2", "3", "4", "5", "6"], A().days == null ? null : A().days - 2, "nums")}<p class="fact" data-split>${A().days ? T.days.split[A().days] : ""}</p>
        <p class="flabel">${T.minutes.q}</p>${seg("minc", ["20", "40", "60", "90", "120", "150"], [20, 40, 60, 90, 120, 150].indexOf(A().minutes), "nums")}`, footer({ disabled: A().goal == null || A().days == null })),
      ok: () => A().goal != null && A().days != null,
    },
    focus: {
      render: () => page(`${title(T.priorities.focusTitle, T.priorities.sub)}<div class="mchips">${MUSCLES.map((m) => chip(m)).join("")}</div><p class="hint">${T.priorities.chipHint}</p><p class="limit" hidden>${T.priorities.limit}</p>
        <div class="trow"><span><b>${T.deload.title}</b><span>${T.deload.body}</span><em class="tag">${T.deload.rec}</em></span>${toggle("deload", A().deload)}</div>`, footer({ skip: T.skipSection, hint: false })),
      ok: () => true, skip: () => { A().emphasis = []; A().deemphasis = []; },
    },
    building: { render: () => buildingHtml(), mount: (el) => runBuilding(el) },
    result: { render: () => resultHtml(), mount: (el) => mountResult(el) },
    handoff: {
      render: () => {
        const theme = THEME === "dark" ? "dark-en" : LANG === "pt" ? "light-pt" : "light-en";
        return `<div class="scroll handoff"><img src="${ROOT}docs/ui-screens/screens/today/ready__phone-390-${theme}.png" alt=""><div class="toast">${LANG === "pt" ? "Treino ativado." : "Program activated."}</div><div class="proto-note"><p>${T.handoff.caption}</p><button data-act="restart">${T.handoff.restart}</button></div></div>`;
      },
    },
    build: {
      render: () => page(`${title(T.build.title, T.build.lede)}<label class="field"><span>${T.build.name}</span><input data-input="bname" value="${S.build.name}" placeholder="${T.build.placeholder}" autocomplete="off"></label><p class="flabel">${T.build.days}</p>${seg("bdays", ["1", "2", "3", "4", "5", "6", "7"], S.build.days - 1, "nums")}`, footer({ cta: T.build.cta, hint: false })),
      ok: () => true, next: () => go("end-build"),
    },
    import: {
      render: () => page(`${title(T.import.title, T.import.lede)}${options("importPick", T.import.opts, S.importPick, ["file", "clip"])}`, footer({ disabled: S.importPick == null })),
      ok: () => S.importPick != null, next: () => go("end-import"),
    },
    "end-build": { render: () => endCard(T.build.end) },
    "end-import": { render: () => endCard(T.import.end) },
    shared: {
      render: () => page(`${brand()}${title(T.shared.title)}<div class="sharedcard"><b>${T.shared.cap}</b><p>${T.shared.body}</p></div>`, footer({ cta: T.shared.cta, skip: T.shared.alt, hint: false })),
      ok: () => true,
      next: () => { S.shared = true; Object.assign(A(), { goal: 1, lifting: 2, days: 3, gym: "local", minutes: 60 }); go("building"); },
      skip: () => { S.shared = false; },
      skipTo: "hub",
    },
  };
  const endCard = (text) => page(`<div class="endcard">${ic("pencil", 28)}<p>${text}</p></div>`, `<footer class="ft"><button class="cta ghostcta" data-act="back"><span>${T.endCard.back}</span></button></footer>`);
  const toggle = (name, on) => `<button class="tog ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-toggle="${name}"><i></i></button>`;
  const prioState = (m) => A().emphasis.includes(m) ? 2 : A().deemphasis.includes(m) ? 0 : 1;
  const compState = (k) => A().competency[k] === true ? 0 : A().competency[k] === false ? 1 : A().competency[k] === null ? 2 : null;
  const chip = (m) => { const s = prioState(m); return `<button class="mchip s${s}" data-chip="${m}" aria-pressed="${s !== 1}">${s === 2 ? "↑ " : s === 0 ? "↓ " : ""}${T.priorities.muscles[m]}</button>`; };

  // Equipment groups
  function ticked(g) {
    const base = groups[A().gym]?.[g];
    if (A().equipAdd.includes(g)) return true;
    if (A().equipRemove.includes(g)) return false;
    return !!base;
  }
  function equipList(kind) {
    if (kind === "chips") return `<div class="chipsel">${GROUP_KEYS.map((g) => `<button class="eqchip" data-equip="${g}" role="checkbox"><span class="box">${ic("check", 14)}</span>${T.equipment.groups[g]}</button>`).join("")}</div><button class="link" data-act="eqreset">${T.equipment.reset}</button>`;
    return `<div class="checks">${GROUP_KEYS.map((g) => `<button class="ck" data-equip="${g}" role="checkbox"><span class="box">${ic("check", 16)}</span><span>${T.equipment.groups[g]}</span></button>`).join("")}</div>`;
  }
  async function paintEquip(el) {
    if (!A().gym) return;
    if (!groups[A().gym]) groups[A().gym] = (await ask({ type: "groups", preset: A().gym })).groups;
    let n = 0;
    $$("[data-equip]", el).forEach((b) => { const on = ticked(b.dataset.equip); n += on; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const sum = $("[data-eqsum]", el);
    if (sum) sum.textContent = T.equipment.summary(n, GROUP_KEYS.length);
  }
  function toggleEquip(g) {
    const a = A(), base = !!groups[a.gym]?.[g];
    const on = !ticked(g);
    a.equipAdd = a.equipAdd.filter((x) => x !== g);
    a.equipRemove = a.equipRemove.filter((x) => x !== g);
    if (on && !base) a.equipAdd.push(g);
    if (!on && base) a.equipRemove.push(g);
  }

  // ---------- building ----------
  function answersForEngine() {
    const a = A();
    const competency = {};
    for (const k of COMPETENCY) competency[k] = typeof a.competency[k] === "boolean" ? a.competency[k] : null;
    return {
      goal: GOALS[a.goal ?? 0], experience: EXPERIENCE[a.lifting ?? 2], days: a.days || 3, minutes: a.minutes || 60,
      gym: a.gym || "commercial", equipAdd: a.equipAdd, equipRemove: a.equipRemove,
      emphasis: a.emphasis, deemphasis: a.deemphasis, deload: a.deload, competency,
      weeks: a.weeks, pattern: a.pattern, confirmations: a.confirmations,
    };
  }
  const keyOf = (x) => JSON.stringify(x);
  function generate() {
    const ans = answersForEngine();
    const k = keyOf(ans);
    if (result && resultKey === k) return Promise.resolve(result);
    if (building && building.key === k) return building.promise;
    const promise = ask({ type: "generate", answers: ans }).then(async (m) => {
      result = m.result; resultKey = k; resultPlayed = false; building = null; edited = null;
      await replayEdits();
      return result;
    });
    building = { key: k, promise };
    return promise;
  }
  function buildingHtml() {
    const steps = T.building.steps.map((s, i) => (typeof s === "function" ? s(A().minutes || 60) : i === 3 && !A().deload ? T.building.noDeload : s));
    return `<div class="scroll"><div class="content build">${CAND === "a" ? `<div class="orbit"><i></i><i></i><i></i><b></b></div>` : `<div class="bmark"><img src="${ROOT}assets/brand/mark.png" alt=""></div>`}
      <h1 class="q c">${T.building.title}</h1><ul class="bsteps">${steps.map((s) => `<li><span class="bi">${ic("check", 14)}</span><span>${s}</span></li>`).join("")}</ul><div class="bbar"><i></i></div><p class="bwait motion-hairline" hidden><span>${T.building.pending}</span></p></div></div>
      <footer class="ft"><button class="skip" data-act="buildskip">${T.building.skip}</button></footer>`;
  }
  function runBuilding(el) {
    const done = generate();
    const lis = $$(".bsteps li", el), bar = $(".bbar i", el);
    let leave = false;
    const finish = () => { if (leave) return; leave = true; done.then(() => { if (cur() === "building") go("result", { replace: true }); }); };
    el._skip = finish;
    if (RM) {
      lis.forEach((li) => li.classList.add("done")); bar.style.transform = "scaleX(1)";
      const w = $(".bwait", el); w.hidden = false; w.classList.add("is-pending");
      done.then(finish); return;
    }
    const STEP = 260;
    lis.forEach((li, i) => {
      setTimeout(() => li.classList.add("now"), i * STEP);
      setTimeout(() => { li.classList.remove("now"); li.classList.add("done"); }, (i + 1) * STEP);
    });
    requestAnimationFrame(() => { bar.style.transition = `transform ${lis.length * STEP}ms linear`; bar.style.transform = "scaleX(1)"; });
    setTimeout(() => {
      let settled = false;
      done.then(() => { settled = true; finish(); });
      setTimeout(() => { if (!settled) { const w = $(".bwait", el); if (w) { w.hidden = false; w.classList.add("is-pending"); } } }, 400);
    }, lis.length * STEP + 140);
  }

  // ---------- result: review and adjust ----------
  // The result screen is the program editor: the recommendation is drawn as a
  // ledger, every row opens one exercise sheet, and each change is an edit on
  // the canonical definition in the worker, validated and timed by the engine.
  const exName = (id) => { const e = LIB[id]; return e ? (LANG === "pt" ? e.namePt || e.name : e.name) : id; };
  const muscleName = (m) => (T.result.muscles ? T.result.muscles[m] || m : m.charAt(0) + m.slice(1).toLowerCase());
  const E = T.edit, ES = T.edit.sheet;
  let edited = null;
  let searchIds = null;
  const days = () => edited?.days || result.days;
  const changeCount = () => edited?.changes?.count || 0;
  function dayName(n) {
    const words = T.result.dayWords;
    const key = Object.keys(words).sort((x, y) => y.length - x.length).find((k) => n.startsWith(k));
    return key ? words[key] + n.slice(key.length) : n;
  }
  const shownDay = (i) => { const d = days()[i]; return d.name === result.days[i]?.name ? dayName(d.name) : d.name; };
  const roleLabel = (role) => role === "manual" ? ES.role.manual : ES.role[Object.keys(ES.role).find((k) => (role || "").endsWith(k))] || "";
  const jobLabel = (purpose) => { const k = Object.keys(ES.job).sort((a, b) => b.length - a.length).find((j) => (purpose || "").endsWith(j)); return k ? ES.job[k] : ""; };
  const thumbHtml = (id, size = "") => {
    const e = LIB[id], label = exName(id);
    const initials = label.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
    return `<div class="thumb ${size}" style="${e?.mediaBg ? `background:${e.mediaBg}` : ""}">${e?.media ? `<img src="${ROOT}${e.media}" alt="">` : `<span class="mono">${initials}</span>`}</div>`;
  };
  const findSlot = (slotId) => { for (const [di, d] of days().entries()) { const j = d.slots.findIndex((s) => s.slotId === slotId); if (j >= 0) return { di, j, d, s: d.slots[j] }; } return null; };
  const blockers = () => {
    if (edited && !edited.valid) return E.invalid;
    return days().some((d) => d.kind === "training" && !d.slots.length) ? E.incomplete : null;
  };

  function resultHtml() {
    const r = result;
    if (!r || !r.ok) {
      const jobs = (r?.conflicts || []).map((c) => c.job?.[LANG === "pt" ? 1 : 0]).filter(Boolean);
      return page(`${title(T.conflict.title)}<div class="alert">${ic("warn", 22)}<div><p>${jobs.length ? T.conflict.body([...new Set(jobs)].join(", ")) : T.conflict.generic}</p><p class="muted">${T.conflict.nothing}</p></div></div>`, footer({ cta: T.conflict.back, act: "toequip", hint: false }));
    }
    const ds = days();
    const train = ds.filter((d) => d.kind === "training");
    const mins = train.filter((d) => d.slots.length).map((d) => d.minutes);
    if (!mins.length) mins.push(0);
    const exCount = train.reduce((n, d) => n + d.slots.length, 0);
    const name = A().programName || (S.shared ? T.shared.name : T.result.name(train.length));
    const block = T.result.block(A().weeks, T.block.short[A().pattern], A().deload);
    const n = changeCount();
    const changes = n
      ? `<div class="changes bi-item" role="status"><span class="ch-n"><i class="dot"></i>${E.changes(n)}</span><button class="link" data-act="undo-edit">${E.undo}</button><button class="link" data-act="restore" aria-label="${E.restore}">${E.restoreShort}</button></div>`
      : `<p class="taphint bi-item">${E.tapHint}</p>`;
    const titleBtn = `<button class="titlebtn" data-act="rename-program" aria-label="${E.renameProgram}: ${name}"><span>${name}</span>${ic("pencil", 18, "pen")}</button>`;
    const top = CAND === "a"
      ? `<h1 class="q bi-item">${S.shared ? titleBtn : T.result.header}</h1>${changes}`
      : `<p class="kicker bi-item">${S.shared ? E.sharedSource : E.source}</p><h1 class="q bi-item">${titleBtn}</h1>
         <div class="facts bi-item">${T.result.facts(train.length, Math.min(...mins), Math.max(...mins), exCount, A().weeks).map((f) => `<span><b>${f[0]}</b>${f[1]}</span>`).join("")}</div>
         <div class="blockrow bi-item"><span>${block}</span><button class="link" data-act="block">${T.result.change}</button></div>${changes}`;
    if (ui.tab >= ds.length) ui.tab = 0;
    const tabs = `<div class="tabs bi-item" role="tablist">${ds.map((d, i) => `<button role="tab" aria-selected="${i === ui.tab}" class="${i === ui.tab ? "on" : ""}" data-tab="${i}">${shownDay(i)}${d.kind === "training" && !d.slots.length ? ` <i class="warnpip" aria-hidden="true"></i>` : ""}</button>`).join("")}<i class="tabind"></i></div>`;
    const block2 = CAND === "a" ? `<div class="blockrow"><span>${block}</span><button class="link" data-act="block">${T.result.change}</button></div>` : "";
    const blocked = blockers();
    const ft = ui.reorder != null
      ? `<footer class="ft"><button class="cta" data-act="reorder-done"><span>${E.reorderDone}</span></button></footer>`
      : `<footer class="ft"><p class="need" ${blocked ? "" : "hidden"}>${blocked || ""}</p><button class="cta" data-act="activate" ${blocked ? "disabled" : ""}><span>${T.result.activate}</span>${CAND === "a" ? "" : `<span class="arr">→</span>`}</button></footer>`;
    return page(`${top}${tabs}<div class="daypanel" data-panel>${dayHtml(ui.tab)}</div>${block2}`, ft);
  }

  function dayHtml(i) {
    const d = days()[i];
    if (d.kind !== "training") return `<div class="restday bi-item">${ic("clock", 26)}<b>${T.result.rest}</b><p>${T.result.restBody}</p></div>`;
    const over = d.minutes > (A().minutes || 60);
    const head = `<div class="dayhd bi-item"><div class="dh-l"><button class="dayname" data-act="rename-day" aria-label="${E.dayMenu.rename}: ${shownDay(i)}">${shownDay(i)}${ic("pencil", 15, "pen")}</button>
      <span class="dh-meta">${T.result.count(d.slots.length)} · <span class="dh-min">${T.result.time(d.minutes)}</span></span>${over ? `<span class="dh-over">${E.over(A().minutes || 60)}</span>` : ""}</div>
      ${ui.reorder == null ? `<button class="daymore" data-act="day-menu" aria-label="${E.dayMore}">${ic("more", 22)}</button>` : ""}</div>`;
    if (ui.reorder === i) {
      return `${head}<p class="hint">${E.reorderHint}</p><ol class="rolist" data-rolist>${d.slots.map((s, j) => `<li class="ro" data-slot="${s.slotId}">
        <span class="handle" data-handle aria-hidden="true">${ic("grip", 20)}</span><span class="ro-n">${exName(s.id)}</span>
        <button class="ro-b" data-move="${j}:-1" aria-label="${E.moveUp}: ${exName(s.id)}" ${j === 0 ? "disabled" : ""}>${ic("chevU", 18)}</button>
        <button class="ro-b" data-move="${j}:1" aria-label="${E.moveDown}: ${exName(s.id)}" ${j === d.slots.length - 1 ? "disabled" : ""}>${ic("chevD", 18)}</button></li>`).join("")}</ol>`;
    }
    const ch = edited?.changes?.slots || {};
    const rows = d.slots.map((s) => {
      const sets = s.sets.map((x, k) => `<li><span class="sn">${k + 1}</span><span class="sr">${T.result.reps(x.min, x.max, x.side, x.secs)}</span><span class="rir r${x.rir}">${CAND === "a" ? x.rir : `${T.result.rir} ${x.rir}`}</span></li>`).join("");
      const offer = result.offers.find((o) => o.day === i && o.from === s.id && !(edited?.confirmed || []).includes(o.to));
      const mark = (edited?.confirmed || []).includes(s.id) ? E.confirmed : ch[s.slotId] === "added" ? E.added : ch[s.slotId] ? E.edited : "";
      const extra = offer ? `<div class="offer"><p>${T.result.offer(exName(offer.to))}</p><button class="ghost" data-offer="${s.slotId}">${T.result.offerBtn}</button></div>` : "";
      return `<article class="ex bi-item ${mark ? "is-changed" : ""}" data-slot="${s.slotId}" tabindex="0" role="button" aria-label="${exName(s.id)}">${thumbHtml(s.id)}<div class="exb">
        <h3>${exName(s.id)}</h3>${mark ? `<span class="mark"><i class="dot"></i>${mark}</span>` : ""}<ul class="sets">${sets}</ul>
        <div class="chips">${s.muscles.map((m) => `<span>${muscleName(m)}</span>`).join("")}</div>${extra}</div><span class="rowchev">${ic("chevR", 18)}</span></article>`;
    }).join("");
    const empty = d.slots.length ? "" : `<p class="emptyday">${ic("warn", 18)}<span>${E.emptyDay}</span></p>`;
    return `${head}${empty}${rows}<button class="addrow bi-item" data-act="add-ex">${ic("plus", 18)}<span>${E.addExercise}</span></button>`;
  }

  function placeIndicator(el, animate) {
    const tabsEl = $(".tabs", el), on = $(".tabs .on", el), ind = $(".tabind", el);
    if (!on || !ind) return;
    const from = ind.getBoundingClientRect();
    ind.style.left = `${on.offsetLeft}px`;
    ind.style.width = `${on.offsetWidth}px`;
    if (animate && from.width) M.animateIndicator(ind, from);
    const target = on.offsetLeft - (tabsEl.clientWidth - on.offsetWidth) / 2;
    tabsEl.scrollTo({ left: target, behavior: animate && !RM ? "smooth" : "auto" });
  }
  function setTab(el, i, dir) {
    if (!result?.ok || i < 0 || i >= days().length || i === ui.tab || ui.reorder != null) return;
    const prev = ui.tab;
    ui.tab = i;
    $$(".tabs [data-tab]", el).forEach((b) => { const on = +b.dataset.tab === i; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    placeIndicator(el, true);
    const panel = $("[data-panel]", el);
    const html = dayHtml(i);
    if (CAND === "a" && !RM) {
      // MacroFactor's day pager slides; Taurifer's tab panels switch at once (N3).
      const sign = (dir ?? (i > prev ? 1 : -1));
      const w = panel.offsetWidth;
      window.Motion.animate(panel, { x: [0, -sign * w * 0.25], opacity: [1, 0] }, { duration: 0.12 }).then(() => {
        panel.innerHTML = html;
        window.Motion.animate(panel, { x: [sign * w * 0.25, 0], opacity: [0, 1] }, { ...V.navPush });
      });
    } else panel.innerHTML = html;
  }
  function mountResult(el) {
    if (!result?.ok) return;
    requestAnimationFrame(() => placeIndicator(el, false));
    if (!resultPlayed && !RM) {
      $(".content", el).classList.add("motion-build");
      $$(".bi-item", el).forEach((n, i) => { n.classList.add("motion-build-item"); n.style.setProperty("--build-i", Math.min(i, 14)); });
      setTimeout(() => { $(".content", el)?.classList.remove("motion-build"); }, 1400);
    }
    resultPlayed = true;
    const panel = $("[data-panel]", el);
    let sx = 0, sy = 0, tracking = false;
    panel.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-handle]")) return; sx = e.clientX; sy = e.clientY; tracking = true; });
    panel.addEventListener("pointerup", (e) => {
      if (!tracking) return; tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { panel.dataset.swiped = "1"; setTab(el, ui.tab + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); setTimeout(() => { delete panel.dataset.swiped; }, 50); }
    });
    panel.addEventListener("pointercancel", () => { tracking = false; });
    if (ui.reorder != null) mountDrag(el);
    panel.addEventListener("keydown", (e) => { const row = e.target.closest("article[data-slot]"); if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); exerciseSheet(row.dataset.slot); } });
  }

  // Paint the page again at rest, keeping scroll, tab and focus; rows that moved glide.
  function repaintResult({ flip = false, focus = null } = {}) {
    const el = $(".page.current", stage);
    if (!el || el.dataset.step !== "result") return;
    const sc = $(".scroll", el), top = sc?.scrollTop || 0;
    const before = flip ? Object.fromEntries($$("[data-slot]", el).map((n) => [n.dataset.slot, n.getBoundingClientRect().top])) : null;
    el.innerHTML = resultHtml();
    mountResult(el);
    bindScrollShadow(el);
    $(".scroll", el).scrollTop = top;
    if (before && !RM) $$("[data-slot]", el).forEach((n) => {
      const was = before[n.dataset.slot];
      if (was == null) return;
      const dy = was - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) window.Motion.animate(n, { y: [dy, 0] }, { ...V.layoutShift });
    });
    const f = focus && $(focus, el);
    if (f) f.focus({ preventScroll: true });
  }
  async function applyEdit(op, { toast = null, flip = false, focus = null } = {}) {
    const snap = (await ask({ type: "edit", edit: op })).result;
    S.edits.push(op); S.editsKey = resultKey; save();
    edited = snap;
    repaintResult({ flip, focus });
    paintOpenSheets();
    if (toast) showToast(toast, true); else announce(E.changes(snap.changes.count));
    return snap;
  }
  async function undoEdit() {
    if (!S.edits.length) return;
    edited = (await ask({ type: "undo" })).result;
    S.edits.pop(); save();
    repaintResult({ flip: true });
    paintOpenSheets();
    showToast(E.toastUndone, false);
  }
  function restoreAll() {
    confirmDialog(E.restoreTitle, E.restoreBody(changeCount()), E.restoreGo, E.keep, async () => {
      edited = (await ask({ type: "restore" })).result;
      S.edits = []; delete A().programName; save();
      repaintResult({ flip: true });
      showToast(E.toastRestored, false);
    });
  }
  // A reload rebuilds the same recommendation; the saved edits replay onto it.
  async function replayEdits() {
    if (!Array.isArray(S.edits)) S.edits = [];
    if (!result?.ok || !S.edits.length || S.editsKey !== resultKey) { if (S.edits.length && S.editsKey !== resultKey) { S.edits = []; save(); } return; }
    for (const op of S.edits) edited = (await ask({ type: "edit", edit: op })).result;
  }

  // ---------- toasts ----------
  let toastTimer = 0;
  function showToast(text, undoable) {
    $(".toastbar", app)?.remove();
    const t = document.createElement("div");
    t.className = "toastbar";
    t.setAttribute("role", "status");
    t.innerHTML = `<span>${text}</span>${undoable ? `<button data-toastundo>${E.undo}</button>` : ""}`;
    app.appendChild(t);
    if (!RM) window.Motion.animate(t, { y: [16, 0], opacity: [0, 1] }, { ...V.revealIn });
    t.addEventListener("click", (e) => { if (e.target.closest("[data-toastundo]")) { t.remove(); undoEdit(); } });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (RM) return t.remove(); window.Motion.animate(t, { opacity: 0 }, { ...V.revealOut }).then(() => t.remove()); }, 4200);
  }

  // ---------- exercise sheet ----------
  const openSheets = new Set();
  function paintOpenSheets() { openSheets.forEach((fn) => fn()); }
  async function exerciseSheet(slotId) {
    let at = findSlot(slotId);
    if (!at) return;
    let subs = (await ask({ type: "subs", slotId })).ids;
    let subsFor = at.s.id, showAll = false;
    let sheetEl = null;
    const paint = async () => {
      at = findSlot(slotId);
      if (!at) { close(false); return; }
      if (at.s.id !== subsFor) { subs = (await ask({ type: "subs", slotId })).ids; subsFor = at.s.id; }
      const s = at.s, d = at.d, orig = result.days[at.di]?.minutes ?? d.minutes;
      const reps = s.sets[0] || {};
      const list = (showAll ? subs : subs.slice(0, 3)).filter((id) => id !== s.id);
      const alts = s.alternates || [];
      const altSugg = subs.filter((id) => !alts.includes(id) && id !== s.id).slice(0, 4);
      const otherDays = days().map((x, i) => [x, i]).filter(([x, i]) => x.kind === "training" && i !== at.di);
      const restOpts = [60, 90, 120, 150, 180, 240];
      sheetEl.querySelector("[data-exsheet]").innerHTML = `
        <div class="xs-head">${thumbHtml(s.id, "lg")}<div><h2>${exName(s.id)}</h2><p class="xs-role">${[roleLabel(s.role), jobLabel(s.purpose)].filter(Boolean).join(" · ")}</p>
          <div class="chips">${s.muscles.map((m) => `<span>${muscleName(m)}</span>`).join("")}</div></div></div>
        <section class="xs-sec"><h3 class="xs-k">${ES.sets}</h3>
          <div class="ledger"><div class="lg-h"><span>${ES.setCol}</span><span>${ES.repsCol}</span><span>${ES.rirCol}</span></div>
          ${s.sets.map((x, k) => `<div class="lg-r"><span class="sn">${k + 1}</span><span class="lg-reps">${T.result.reps(x.min, x.max, x.side, x.secs)}</span>
            <span class="mini-step"><button data-rir="${k}:-1" aria-label="${ES.rirCol} −" ${x.rir <= 0 ? "disabled" : ""}>−</button><b>${x.rir}</b><button data-rir="${k}:1" aria-label="${ES.rirCol} +" ${x.rir >= 4 ? "disabled" : ""}>+</button></span></div>`).join("")}</div>
          <div class="xs-ctl"><span class="xs-l">${ES.sets}</span><span class="step"><button data-xs="sets:-1" aria-label="${ES.fewer}" ${s.sets.length <= 1 ? "disabled" : ""}>−</button><b>${ES.nSets(s.sets.length)}</b><button data-xs="sets:1" aria-label="${ES.more}" ${s.sets.length >= 8 ? "disabled" : ""}>+</button></span></div>
          <div class="xs-ctl"><span class="xs-l">${ES.range}</span><span class="range">
            <span class="step sm"><button data-xs="min:-1" aria-label="min −" ${reps.min <= 1 ? "disabled" : ""}>−</button><b>${reps.min}</b><button data-xs="min:1" aria-label="min +" ${reps.min >= reps.max ? "disabled" : ""}>+</button></span><span class="dash">–</span>
            <span class="step sm"><button data-xs="max:-1" aria-label="max −" ${reps.max <= reps.min ? "disabled" : ""}>−</button><b>${reps.max}</b><button data-xs="max:1" aria-label="max +" ${reps.max >= 30 ? "disabled" : ""}>+</button></span></span></div>
          <div class="xs-ctl col"><span class="xs-l">${ES.rest}</span>${seg("xsrest", restOpts.map((v) => `${v} s`), restOpts.indexOf(s.rest), "nums rest")}</div>
          <p class="xs-time">${ES.dayTime(orig, d.minutes)}${d.minutes > (A().minutes || 60) ? ` · <span class="dh-over">${E.over(A().minutes || 60)}</span>` : ""}</p>
          ${A().deload ? `<p class="xs-note">${ES.deloadNote}</p>` : ""}
        </section>
        <section class="xs-sec"><h3 class="xs-k">${ES.swap}</h3><p class="xs-lede">${ES.swapLede}</p>
          <ul class="sublist">${list.map((id) => `<li>${thumbHtml(id, "sm")}<span>${exName(id)}</span><button class="ghost" data-swap="${id}">${ES.swapBtn}</button></li>`).join("")}</ul>
          <div class="xs-links">${!showAll && subs.length > 3 ? `<button class="link" data-xsact="more">${ES.showMore(subs.length - 3)}</button>` : ""}<button class="link" data-xsact="search">${ic("search", 16)} ${ES.search}</button></div>
        </section>
        <section class="xs-sec"><h3 class="xs-k">${ES.alts}</h3><p class="xs-lede">${ES.altsLede}</p>
          ${alts.length ? `<ol class="altlist">${alts.map((id, k) => `<li><span class="alt-n">${k + 1}</span><span>${exName(id)}</span>
            <button class="ro-b" data-alt="${id}:-1" aria-label="${E.moveUp}" ${k === 0 ? "disabled" : ""}>${ic("chevU", 16)}</button><button class="ro-b" data-alt="${id}:1" aria-label="${E.moveDown}" ${k === alts.length - 1 ? "disabled" : ""}>${ic("chevD", 16)}</button>
            <button class="ro-b" data-altrm="${id}" aria-label="${E.undo}">${ic("x", 16)}</button></li>`).join("")}</ol>` : `<p class="xs-empty">${ES.altsNone}</p>`}
          ${alts.length < 5 ? `<p class="xs-k2">${ES.altsAdd}</p><div class="altadd">${altSugg.map((id) => `<button class="chipbtn" data-altadd="${id}">${ic("plus", 14)}${exName(id)}</button>`).join("")}</div>` : `<p class="xs-empty">${ES.altsFull}</p>`}
        </section>
        <section class="xs-sec"><h3 class="xs-k">${ES.move}</h3><div class="altadd">${otherDays.map(([x, i]) => `<button class="chipbtn" data-moveto="${i}">${shownDay(i)}</button>`).join("")}</div>
          <button class="danger" data-xsact="remove">${ES.remove}</button></section>
        <div class="ft sheetft"><button class="cta" data-sheetact="done"><span>${ES.done}</span></button></div>`;
    };
    const close = openSheet(`<div data-exsheet></div>`, (sh) => {
      sheetEl = sh;
      sh.classList.add("tall");
      sh.addEventListener("click", async (e) => {
        const t = e.target;
        const cur = findSlot(slotId);
        if (!cur) return;
        const b = (sel) => t.closest(sel);
        if (b("[data-rir]")) { const [k, dir] = b("[data-rir]").dataset.rir.split(":").map(Number); return applyEdit({ op: "rir", slotId, set: k, rir: cur.s.sets[k].rir + dir }); }
        if (b("[data-xs]")) {
          const [k, dir] = b("[data-xs]").dataset.xs.split(":"); const n = +dir;
          if (k === "sets") return applyEdit({ op: "sets", slotId, n: cur.s.sets.length + n });
          return applyEdit({ op: "reps", slotId, dMin: k === "min" ? n : 0, dMax: k === "max" ? n : 0 });
        }
        if (b("[data-seg=xsrest] [data-segval]")) return applyEdit({ op: "rest", slotId, sec: [60, 90, 120, 150, 180, 240][+b("[data-segval]").dataset.segval] });
        if (b("[data-swap]")) { const id = b("[data-swap]").dataset.swap; return applyEdit({ op: "swap", slotId, exerciseId: id }, { toast: E.toastSwapped(exName(id)) }); }
        if (b("[data-altadd]")) return applyEdit({ op: "alt-add", slotId, exerciseId: b("[data-altadd]").dataset.altadd });
        if (b("[data-altrm]")) return applyEdit({ op: "alt-remove", slotId, exerciseId: b("[data-altrm]").dataset.altrm });
        if (b("[data-alt]")) { const [id, dir] = b("[data-alt]").dataset.alt.split(":"); return applyEdit({ op: "alt-move", slotId, exerciseId: id, dir: +dir }); }
        if (b("[data-moveto]")) { const to = +b("[data-moveto]").dataset.moveto; close(false); return applyEdit({ op: "move", slotId, toDay: to }, { toast: E.toastMoved(shownDay(to)), flip: true }); }
        const act = b("[data-xsact]")?.dataset.xsact;
        if (act === "more") { showAll = true; paint(); }
        if (act === "search") searchSheet({ mode: "replace", slotId });
        if (act === "remove") { const nm = exName(cur.s.id); close(false); applyEdit({ op: "remove", slotId }, { toast: E.toastRemoved(nm), flip: true }); }
      });
    }, null, () => openSheets.delete(paint));
    openSheets.add(paint);
    await paint();
  }

  // ---------- catalog search ----------
  const fold = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  async function searchSheet({ mode, slotId = null, day = null }) {
    if (!searchIds) searchIds = new Set((await ask({ type: "searchable" })).ids);
    const titleText = mode === "add" ? E.search.addTitle(shownDay(day)) : E.search.replaceTitle;
    const close = openSheet(`<h2>${titleText}</h2><label class="searchbox">${ic("search", 18)}<input type="search" data-q placeholder="${E.search.placeholder}" autocomplete="off" enterkeyhint="search"></label>
      <p class="xs-lede">${E.search.hint}</p><ul class="sublist results" data-results></ul>`, (sh) => {
      sh.classList.add("tall");
      const input = $("[data-q]", sh), out = $("[data-results]", sh);
      const run = () => {
        const q = fold(input.value.trim());
        const pool = (window.RepForgeExercises?.library || []).filter((e) => searchIds.has(e.id));
        const hits = pool.map((e) => {
          const hay = [e.namePt, e.name, ...(e.aliases || [])].map(fold);
          const score = !q ? 0 : hay.some((h) => h.startsWith(q)) ? 2 : hay.some((h) => h.includes(q)) ? 1 : -1;
          return [e, score];
        }).filter(([, sc]) => sc >= 0).sort((a, b) => b[1] - a[1] || (b[0].searchBoostValue || 0) - (a[0].searchBoostValue || 0)).slice(0, 30);
        out.innerHTML = hits.length ? hits.map(([e]) => `<li>${thumbHtml(e.id, "sm")}<span>${exName(e.id)}</span><button class="ghost" data-pickex="${e.id}">${mode === "add" ? E.addExercise.split(" ")[0] : ES.swapBtn}</button></li>`).join("") : `<li class="xs-empty">${E.search.empty}</li>`;
      };
      input.addEventListener("input", run);
      run();
      setTimeout(() => input.focus(), RM ? 0 : 250);
      sh.addEventListener("click", (e) => {
        const id = e.target.closest("[data-pickex]")?.dataset.pickex;
        if (!id) return;
        close(false);
        if (mode === "add") return applyEdit({ op: "add", day, exerciseId: id }, { toast: E.toastAdded(exName(id)), flip: true });
        applyEdit({ op: "swap", slotId, exerciseId: id }, { toast: E.toastSwapped(exName(id)) });
      });
    });
  }

  // ---------- day actions, rename, reorder ----------
  function dayMenu() {
    const i = ui.tab;
    const close = openSheet(`<h2>${shownDay(i)}</h2><div class="menu">
      <button data-dm="rename">${ic("pencil", 20)}<span>${E.dayMenu.rename}</span></button>
      <button data-dm="reorder" ${days()[i].slots.length < 2 ? "disabled" : ""}>${ic("grip", 20)}<span>${E.dayMenu.reorder}</span></button>
      <button data-dm="add">${ic("plus", 20)}<span>${E.dayMenu.add}</span></button></div>`, (sh) => {
      sh.addEventListener("click", (e) => {
        const a = e.target.closest("[data-dm]")?.dataset.dm;
        if (!a) return;
        close(false);
        if (a === "rename") renameSheet("day");
        if (a === "reorder") { ui.reorder = i; repaintResult(); }
        if (a === "add") searchSheet({ mode: "add", day: i });
      });
    });
  }
  function renameSheet(kind) {
    const i = ui.tab;
    const value = kind === "day" ? shownDay(i) : (A().programName || (S.shared ? T.shared.name : T.result.name(days().filter((d) => d.kind === "training").length)));
    openSheet(`<h2>${kind === "day" ? E.dayMenu.rename : E.renameProgram}</h2><label class="field"><span>${kind === "day" ? E.dayName : E.programName}</span><input data-rn maxlength="40" value="${value.replace(/"/g, "&quot;")}" enterkeyhint="done"></label>
      <div class="ft sheetft"><button class="cta" data-sheetact="done"><span>${E.save}</span></button></div>`, (sh) => {
      const input = $("[data-rn]", sh);
      setTimeout(() => { input.focus(); input.select(); }, RM ? 0 : 250);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") $("[data-sheetact=done]", sh).click(); });
    }, (sh) => {
      const v = $("[data-rn]", sh).value.trim();
      if (!v || v === value) return;
      if (kind === "day") applyEdit({ op: "rename-day", day: i, name: v });
      else { A().programName = v; save(); repaintResult(); }
    });
  }
  function mountDrag(el) {
    const list = $("[data-rolist]", el);
    if (!list) return;
    list.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest("[data-handle]");
      if (!handle) return;
      e.preventDefault();
      const row = handle.closest(".ro"), rows = $$(".ro", list), from = rows.indexOf(row);
      const h = row.offsetHeight, y0 = e.clientY;
      let to = from;
      row.classList.add("lifted");
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dy = ev.clientY - y0;
        row.style.transform = `translateY(${dy}px)`;
        to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
        rows.forEach((r, k) => { if (r === row) return; const shift = from < to && k > from && k <= to ? -h : from > to && k < from && k >= to ? h : 0; r.style.transform = shift ? `translateY(${shift}px)` : ""; });
      };
      const up = () => {
        handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
        rows.forEach((r) => { r.style.transform = ""; }); row.classList.remove("lifted");
        if (to !== from) applyEdit({ op: "reorder", day: ui.tab, from, to }, { flip: true });
      };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
  }
  function confirmDialog(titleText, body, go, stay, onGo) {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.innerHTML = `<h2>${titleText}</h2><p>${body}</p><div class="dlg-a"><button class="cta" value="go">${go}</button><button class="skip" value="stay">${stay}</button></div>`;
    app.appendChild(d);
    d.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) d.close(b.value); else if (e.target === d) d.close("stay"); });
    d.addEventListener("close", () => { d.remove(); if (d.returnValue === "go") onGo(); });
    d.showModal();
  }
  async function regenerateInPlace(focusSel, message) {
    edited = null; S.edits = []; save();
    await generate();
    resultPlayed = true;
    repaintResult({ focus: focusSel });
    if (message) announce(message);
  }

  // ---------- sheets & dialogs ----------
  function openSheet(html, mount, onDone, onClose) {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    app.appendChild(scrim);
    const sheet = $(".sheet", scrim);
    mount?.(sheet);
    const h = sheet.offsetHeight;
    let closing = false;
    if (!RM) {
      window.Motion.animate(scrim, { opacity: [0, 1] }, { ...V.revealIn });
      window.Motion.animate(sheet, { y: [h, 0] }, { ...V.navPush });
    }
    const close = (commit) => {
      if (closing) return; closing = true;
      if (commit) onDone?.(sheet);
      onClose?.();
      const end = () => scrim.remove();
      if (RM) return end();
      window.Motion.animate(scrim, { opacity: 0 }, { ...V.revealOut });
      window.Motion.animate(sheet, { y: sheet.offsetHeight }, { ...V.revealOut }).then(end);
    };
    scrim.addEventListener("click", (e) => { if (e.target === scrim) close(false); const a = e.target.closest("[data-sheetact]"); if (a) close(a.dataset.sheetact === "done"); });
    // Drag down to dismiss, released on the gestureSettle spring.
    const grab = $(".grab", sheet);
    let y0 = null, dy = 0, t0 = 0;
    grab.addEventListener("pointerdown", (e) => { y0 = e.clientY; t0 = performance.now(); grab.setPointerCapture(e.pointerId); });
    grab.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const release = (e, cancelled) => {
      if (y0 == null) return;
      const v = dy / Math.max(1, performance.now() - t0);
      y0 = null;
      if (!cancelled && (dy > 90 || v > 0.6)) { close(false); return; }
      window.Motion.animate(sheet, { y: [dy, 0] }, { ...V.gestureSettle }).then(() => { sheet.style.transform = ""; });
      dy = 0;
    };
    grab.addEventListener("pointerup", (e) => release(e, false));
    grab.addEventListener("pointercancel", (e) => release(e, true));
    return close;
  }
  function confirmLeave() {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.innerHTML = `<h2>${T.leave.title}</h2><p>${T.leave.body}</p><div class="dlg-a"><button class="cta" value="stay">${T.leave.stay}</button><button class="skip" value="go">${T.leave.go}</button></div>`;
    app.appendChild(d);
    d.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) d.close(b.value); else if (e.target === d) d.close("stay"); });
    d.addEventListener("close", () => {
      d.remove();
      if (d.returnValue === "go") { S.stack = ["hub"]; save(); transition("back"); }
    });
    d.showModal();
  }
  function blockSheet() {
    let weeks = A().weeks, pattern = A().pattern;
    const pats = Object.keys(T.block.patterns);
    const html = `<h2>${T.block.title}</h2><p class="flabel">${T.block.length}</p>
      <div class="stepper"><button data-st="-1" aria-label="−">−</button><b data-weeks>${T.block.weeks(weeks)}</b><button data-st="1" aria-label="+">+</button></div><p class="hint">${T.block.hint}</p>
      <p class="flabel">${T.block.pattern}</p><div class="opts compact" role="radiogroup">${pats.map((p) => option("pattern", p, T.block.patterns[p][0], T.block.patterns[p][1], null, p === pattern)).join("")}</div>
      <div class="ft"><button class="cta" data-sheetact="done"><span>${T.block.apply}</span></button></div>`;
    openSheet(html, (sh) => {
      sh.addEventListener("click", (e) => {
        const st = e.target.closest("[data-st]");
        if (st) { weeks = Math.max(4, Math.min(12, weeks + +st.dataset.st)); $("[data-weeks]", sh).textContent = T.block.weeks(weeks); }
        const o = e.target.closest("[data-pick=pattern]");
        if (o) { pattern = o.dataset.val; $$("[data-pick=pattern]", sh).forEach((b) => { const on = b === o; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); }); }
      });
    }, () => {
      if (weeks === A().weeks && pattern === A().pattern) return;
      const apply = () => { A().weeks = weeks; A().pattern = pattern; save(); regenerateInPlace(null, T.result.block(weeks, T.block.short[pattern], A().deload)); };
      if (changeCount()) confirmDialog(E.blockConfirm.title, E.blockConfirm.body(changeCount()), E.blockConfirm.go, E.blockConfirm.keep, apply);
      else apply();
    });
  }
  function pickerSheet(kind) {
    const html = `<h2>${T[kind].q}</h2>${kind === "birth" ? `<div class="pick">${birthPicker()}</div>` : kind === "height" ? heightPicker() : weightPicker()}
      <div class="ft row"><button class="skip" data-sheetact="clear">${T.skip}</button><button class="cta" data-sheetact="done"><span>${T.about.done}</span></button></div>`;
    let draft = null;
    const mountAll = (sh) => {
      if (kind === "birth") mountBirth(sh, (b) => { draft = b; });
      if (kind === "height") mountHeight(sh, (v) => { draft = v; });
      if (kind === "weight") mountWeight(sh, (v) => { draft = Math.round(v * 10) / 10; });
    };
    const close = openSheet(html, (sh) => {
      mountAll(sh);
      sh.addEventListener("click", (e) => {
        const b = e.target.closest("[data-segval]");
        if (!b) return;
        const g = b.parentElement.dataset.seg;
        if (g === "hunit") A().heightUnit = +b.dataset.segval ? "ftin" : "cm";
        if (g === "wunit") A().weightUnit = +b.dataset.segval ? "lb" : "kg";
        if (kind === "height" && draft) A().height = draft;
        if (kind === "weight" && draft) A().weight = draft;
        const fresh = document.createElement("div");
        fresh.innerHTML = kind === "height" ? heightPicker() : weightPicker();
        $(".seg", sh).replaceWith($(".seg", fresh));
        $(".pick", sh).replaceWith($(".pick", fresh));
        mountAll(sh);
      });
      sh.addEventListener("click", (e) => { if (e.target.closest("[data-sheetact=clear]")) { A()[kind] = null; save(); refresh(); } });
    }, () => { A()[kind] = draft; save(); refresh(); });
    return close;
  }

  // ---------- navigation ----------
  function go(id, { replace = false } = {}) {
    if (replace) { S.stack[S.stack.length - 1] = id; history.replaceState({ d: S.stack.length }, ""); }
    else { S.stack.push(id); history.pushState({ d: S.stack.length }, ""); }
    save();
    transition("forward");
  }
  function back() { if (S.stack.length > 1) history.back(); }
  let suppressPop = 0;
  addEventListener("popstate", () => {
    if (suppressPop) { suppressPop = 0; return; }
    if (S.stack.length <= 1) return;
    S.stack.pop();
    if (cur() === "building") S.stack.pop();
    save();
    transition("back");
  });
  function backTo(id) {
    const i = S.stack.lastIndexOf(id);
    if (i < 0) return back();
    const n = S.stack.length - 1 - i;
    S.stack = S.stack.slice(0, i + 1);
    save();
    history.go(-n);
    suppressPop = n;
    transition("back");
  }

  function header(id) {
    const mode = MODE[id] || "section";
    if (mode === "none") { hdr.hidden = true; return; }
    hdr.hidden = false;
    const sec = SECTION[id];
    const ids = FLOW.filter((x) => SECTION[x] === sec);
    const pos = ids.indexOf(id) + 1, of = ids.length;
    const pct = sec ? Math.round((pos / of) * 100) : 0;
    const si = SECTIONS.indexOf(sec);
    hdr.dataset.mode = mode;
    if (!hdr.firstChild || hdr.dataset.cand !== CAND) {
      hdr.dataset.cand = CAND;
      hdr.innerHTML = CAND === "a"
        ? `<div class="hd"><button class="hd-back" data-act="back" aria-label="${T.back}">${ic("chevL", 26)}</button><span class="hd-title"></span><span class="hd-gap"></span></div><div class="rule"><i></i></div>`
        : `<div class="hd"><button class="hd-back" data-act="back">${ic("chevL", 20)}<span>${T.back}</span></button><button class="hd-cancel" data-act="cancel">${T.cancel}</button></div><div class="eyebrow"><span class="eb-sec"></span><span class="eb-dot">·</span><span class="eb-step"></span></div><div class="segrule">${SECTIONS.map(() => `<i><b></b></i>`).join("")}</div>`;
    }
    if (CAND === "a") {
      $(".hd-title", hdr).textContent = sec ? T.sections[sec] : "";
      $(".rule", hdr).hidden = !sec;
      $(".rule i", hdr).style.width = `${pct}%`;
    } else {
      $(".eyebrow", hdr).hidden = !sec;
      $(".segrule", hdr).hidden = !sec;
      if (sec) {
        $(".eb-sec", hdr).textContent = T.sections[sec];
        $(".eb-step", hdr).textContent = T.sectionOf(si + 1, SECTIONS.length);
        $$(".segrule i", hdr).forEach((seg, i) => { seg.className = i < si ? "done" : i === si ? "on" : ""; $("b", seg).style.width = i < si ? "100%" : i === si ? `${pct}%` : "0%"; });
      }
    }
  }

  function bindScrollShadow(el) {
    const sc = $(".scroll", el), ft = $(".ft", el);
    if (!sc || !ft) return;
    const upd = () => ft.classList.toggle("raised", sc.scrollHeight - sc.scrollTop - sc.clientHeight > 2);
    sc.addEventListener("scroll", upd, { passive: true });
    requestAnimationFrame(upd);
  }

  function transition(dir) {
    const id = cur();
    const step = STEPS[id];
    const el = document.createElement("section");
    el.className = "page";
    el.dataset.step = id;
    el.innerHTML = step.render();
    header(id);
    const old = $(".page.current", stage);
    $$(".page:not(.current)", stage).forEach((p) => p.remove());
    if (!old || RM) {
      stage.replaceChildren(el);
      el.classList.add("current");
      enter(el, id);
      return;
    }
    old.classList.remove("current");
    old.inert = true;
    el.classList.add("current");
    if (dir === "forward") {
      stage.appendChild(el);
      enter(el, id);
      if (CAND === "a") window.Motion.animate(old, { x: [0, -old.offsetWidth * 0.3] }, { ...V.navPush });
      M.animatePush(el, { direction: "in" }).then(() => old.remove());
    } else {
      stage.insertBefore(el, old);
      enter(el, id);
      if (CAND === "a") window.Motion.animate(el, { x: [-el.offsetWidth * 0.3, 0] }, { ...V.navPush });
      M.animatePush(old, { direction: "out" }).then(() => old.remove());
    }
  }
  function enter(el, id) {
    STEPS[id].mount?.(el);
    bindScrollShadow(el);
    const h = $("h1", el);
    if (h) { h.tabIndex = -1; if (S.stack.length > 1) h.focus({ preventScroll: true }); }
  }
  function refresh() {
    const el = $(".page.current", stage);
    if (!el) return;
    const sc = $(".scroll", el)?.scrollTop || 0;
    el.innerHTML = STEPS[cur()].render();
    enter(el, cur());
    if ($(".scroll", el)) $(".scroll", el).scrollTop = sc;
  }
  function syncNext(el) {
    const step = STEPS[cur()];
    const btn = $(".cta[data-act=next]", el);
    if (!btn || !step.ok) return;
    const ok = step.ok();
    btn.disabled = !ok;
    const need = $(".need", el);
    if (need) need.hidden = ok;
  }

  // ---------- events ----------
  stage.addEventListener("click", (e) => {
    const el = e.target.closest(".page");
    if (!el || !el.classList.contains("current")) return;
    const t = e.target;
    const pick = t.closest("[data-pick]");
    if (pick && !pick.closest(".sheet")) {
      const g = pick.dataset.pick, v = pick.dataset.val;
      $$(`[data-pick="${g}"]`, el).forEach((b) => { const on = b === pick; b.classList.toggle("sel", on); b.setAttribute("aria-checked", on); });
      if (g === "hub") S.hub = +v;
      else if (g === "importPick") S.importPick = +v;
      else if (g === "gym") {
        const next = GYMS[+v];
        if (A().gym !== next) { A().gym = next; A().equipAdd = []; A().equipRemove = []; }
        if (CAND === "c") {
          const disc = $(".disc", el);
          if (disc.hidden) M.animateSlot(disc.parentElement, () => { disc.hidden = false; });
          paintEquip(el);
        }
      } else if (g === "days") { A().days = +v + 2; const f = $("[data-split]", el); if (f) f.textContent = T.days.split[A().days]; }
      else if (g === "minutes") A().minutes = [20, 40, 60, 90, 120, 150][+v];
      else A()[g] = +v;
      save(); syncNext(el);
      return;
    }
    const sb = t.closest("[data-segval]");
    if (sb) {
      const box = sb.parentElement, g = box.dataset.seg, i = +sb.dataset.segval;
      const setSeg = (val) => { $$("[data-segval]", box).forEach((b) => { const on = +b.dataset.segval === val; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }); box.style.setProperty("--i", val); const th = $(".segthumb", box); if (th) th.hidden = val < 0; };
      if (g.startsWith("prio:")) {
        const m = g.slice(5);
        const a = A();
        const em = a.emphasis.filter((x) => x !== m), de = a.deemphasis.filter((x) => x !== m);
        if (i === 2) em.push(m);
        if (i === 0) de.push(m);
        if (em.length > 5 || de.length > 5) { $(".limit", el).hidden = false; return; }
        $(".limit", el).hidden = true;
        a.emphasis = em; a.deemphasis = de;
        setSeg(i);
      } else if (g.startsWith("comp:")) {
        const k = g.slice(5);
        A().competency[k] = i === 0 ? true : i === 1 ? false : null;
        setSeg(i);
      } else if (g === "hunit" || g === "wunit") {
        if (g === "hunit") { if (STEPS.height.draft) A().height = STEPS.height.draft; A().heightUnit = i ? "ftin" : "cm"; }
        else { if (STEPS.weight.draft) A().weight = STEPS.weight.draft; A().weightUnit = i ? "lb" : "kg"; }
        save(); refresh(); return;
      } else if (g === "sexc") { A().sex = A().sex === i ? null : i; setSeg(A().sex ?? -1); }
      else if (g === "cardioc") { A().cardio = A().cardio === i ? null : i; setSeg(A().cardio ?? -1); }
      else if (g === "daysc") { A().days = i + 2; setSeg(i); const f = $("[data-split]", el); if (f) f.textContent = T.days.split[A().days]; }
      else if (g === "minc") { A().minutes = [20, 40, 60, 90, 120, 150][i]; setSeg(i); }
      else if (g === "bdays") { S.build.days = i + 1; setSeg(i); }
      save(); syncNext(el);
      return;
    }
    const tg = t.closest("[data-toggle]");
    if (tg) { A().deload = !A().deload; tg.classList.toggle("on", A().deload); tg.setAttribute("aria-checked", A().deload); save(); return; }
    const eq = t.closest("[data-equip]");
    if (eq) { toggleEquip(eq.dataset.equip); save(); paintEquip(el); return; }
    const ch = t.closest("[data-chip]");
    if (ch) {
      const m = ch.dataset.chip, a = A(), s = prioState(m);
      const em = a.emphasis.filter((x) => x !== m), de = a.deemphasis.filter((x) => x !== m);
      if (s === 1) em.push(m); else if (s === 2) de.push(m);
      if (em.length > 5 || de.length > 5) { $(".limit", el).hidden = false; return; }
      $(".limit", el).hidden = true;
      a.emphasis = em; a.deemphasis = de; save();
      ch.outerHTML = chip(m);
      return;
    }
    const sh = t.closest("[data-sheet]");
    if (sh) { pickerSheet(sh.dataset.sheet); return; }
    const tab = t.closest("[data-tab]");
    if (tab) { setTab(el, +tab.dataset.tab); return; }
    const off = t.closest("[data-offer]");
    if (off) {
      const at = findSlot(off.dataset.offer);
      const o = result.offers.find((x) => x.day === at.di && x.from === at.s.id);
      off.disabled = true; off.textContent = T.result.swapping;
      applyEdit({ op: "swap", slotId: at.s.slotId, exerciseId: o.to, confirm: o.prerequisites }, { toast: E.toastSwapped(exName(o.to)) });
      return;
    }
    const mv = t.closest("[data-move]");
    if (mv) { const [j, dir] = mv.dataset.move.split(":").map(Number); applyEdit({ op: "reorder", day: ui.tab, from: j, to: j + dir }, { flip: true, focus: `[data-slot="${days()[ui.tab].slots[j].slotId}"] [data-move="${j + dir}:${dir}"]` }); return; }
    const row = t.closest("article[data-slot]");
    if (row && !t.closest("button") && !t.closest("[data-panel]")?.dataset.swiped) { exerciseSheet(row.dataset.slot); return; }
    const act = t.closest("[data-act]")?.dataset.act;
    if (!act) return;
    const step = STEPS[cur()];
    if (act === "next") {
      if (step.ok && !step.ok()) return;
      step.commit?.();
      save();
      if (step.next) return step.next();
      const n = nextOf(cur());
      if (n === "building" && result && resultKey === keyOf(answersForEngine())) { resultPlayed = true; return go("result"); }
      return go(n);
    }
    if (act === "skip") {
      step.skip?.();
      save();
      if (step.skipTo) { S.stack = [step.skipTo]; save(); return transition("forward"); }
      return go(nextOf(cur()));
    }
    if (act === "back") return back();
    if (act === "eqreset") { A().equipAdd = []; A().equipRemove = []; save(); paintEquip(el); return; }
    if (act === "disc") {
      ui.discOpen = !ui.discOpen;
      const disc = $(".disc", el), slot = $(".disc-slot", el);
      M.animateSlot(slot, () => { disc.classList.toggle("open", ui.discOpen); $(".disc-h", el).setAttribute("aria-expanded", ui.discOpen); });
      return;
    }
    if (act === "buildskip") { el._skip?.(); return; }
    if (act === "block") return blockSheet();
    if (act === "undo-edit") return undoEdit();
    if (act === "restore") return restoreAll();
    if (act === "rename-program") return renameSheet("program");
    if (act === "rename-day") return renameSheet("day");
    if (act === "day-menu") return dayMenu();
    if (act === "add-ex") return searchSheet({ mode: "add", day: ui.tab });
    if (act === "reorder-done") { ui.reorder = null; return repaintResult(); }
    if (act === "toequip") { ui.discOpen = true; return backTo(CAND === "c" ? "gym" : "equipment"); }
    if (act === "activate") return go("handoff");
    if (act === "restart") { sessionStorage.removeItem(KEY); location.href = location.pathname + location.search.replace(/&?reset=1/, ""); }
  });
  hdr.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") back();
    if (act === "cancel") confirmLeave();
  });
  stage.addEventListener("input", (e) => { if (e.target.dataset.input === "bname") { S.build.name = e.target.value; save(); } });

  // ---------- boot ----------
  const jump = P.get("step");
  if (jump && (FLOW.includes(jump) || STEPS[jump])) {
    S = fresh();
    S.stack = FLOW.includes(jump) ? ["hub", ...FLOW.slice(0, FLOW.indexOf(jump) + 1)].filter((x) => x !== "building") : ["hub", jump];
    S.hub = 0;
    if (P.get("demo") === "1") {
      Object.assign(S.a, { sex: 1, birth: { d: 14, m: 5, y: 1993 }, height: 174, weight: 80.5, lifting: 2, cardio: 1, gym: "commercial", equipRemove: ["smith"], goal: 0, days: 4, minutes: 60, emphasis: ["chest"], competency: { pullups5: true, pullups10: false, benchPress10: null } });
    }
  }
  save();
  // Deep-link and reset parameters apply once; a reload resumes the saved session.
  const clean = new URLSearchParams(location.search);
  ["step", "demo", "reset"].forEach((k) => clean.delete(k));
  history.replaceState({ d: 1 }, "", `${location.pathname}?${clean}${location.hash}`);
  for (let i = 1; i < S.stack.length; i++) history.pushState({ d: i + 1 }, "");
  if (cur() === "result" || cur() === "building") { if (cur() === "result") S.stack[S.stack.length - 1] = "building"; }
  transition("forward");
  ask({ type: "groups", preset: "commercial" }).then((m) => { groups.commercial = m.groups; });
})();
