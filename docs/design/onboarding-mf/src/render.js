// Static mockup renderer for the three onboarding candidates.
// Board view: open a candidate's index.html. Capture view:
//   index.html?screen=<id>&lang=pt|en&theme=light|dark
(function () {
  const CAND = document.documentElement.dataset.cand; // a | b | c
  const q = new URLSearchParams(location.search);
  const ASSET = "../../../../";
  const ic = window.icon;
  const esc = (s) => String(s);

  function strings(lang) {
    const pt = window.STRINGS.pt;
    if (lang !== "en") return pt;
    const en = window.STRINGS.en;
    const out = { ...pt, ...en };
    for (const k of Object.keys(en)) if (typeof en[k] === "object" && !Array.isArray(en[k]) && typeof pt[k] === "object") out[k] = { ...pt[k], ...en[k] };
    return out;
  }

  // ---------- shared pieces ----------
  const statusBar = () => `<div class="sb"><span>9:41</span><span class="sb-r">●●● ▮</span></div>`;

  function header(t, s) {
    if (!s.section) return "";
    const title = t.sections[s.section];
    const pct = Math.round((s.pos / s.of) * 100);
    if (CAND === "a") {
      return `<header class="hd"><span class="hd-back">${ic("chevL", 26)}</span><span class="hd-title">${title}</span><span class="hd-gap"></span></header>
        <div class="rule"><i style="width:${pct}%"></i></div>`;
    }
    const segs = Array.from({ length: s.sectionCount }, (_, i) =>
      `<i class="${i < s.sectionIndex ? "done" : i === s.sectionIndex ? "on" : ""}">${i === s.sectionIndex ? `<b style="width:${pct}%"></b>` : ""}</i>`).join("");
    return `<header class="hd"><span class="hd-back">${ic("chevL", 20)} ${t.back}</span><span class="hd-cancel">${t.cancel}</span></header>
      <div class="eyebrow"><span class="eb-sec">${title}</span><span class="eb-dot">·</span><span class="eb-step">${t.sectionOf(s.sectionIndex + 1, s.sectionCount)}</span></div>
      <div class="segrule">${segs}</div>`;
  }

  const title = (qq, sub) => `<h1 class="q">${qq}</h1>${sub ? `<p class="lede">${sub}</p>` : ""}`;

  function options(opts, icons, sel, extra = {}) {
    return `<div class="opts ${extra.compact ? "compact" : ""}">${opts.map((o, i) => `
      <div class="opt ${i === sel ? "sel" : ""}">
        ${icons && icons[i] ? `<span class="opt-ic">${ic(icons[i], CAND === "a" ? 28 : 24)}</span>` : ""}
        <span class="opt-tx"><span class="opt-l">${o[0]}</span>${o[1] && !extra.noSub ? `<span class="opt-s">${o[1]}</span>` : ""}</span>
        <span class="radio"></span>
      </div>`).join("")}</div>`;
  }

  const segmented = (labels, sel, cls = "") =>
    `<div class="seg ${cls}">${labels.map((l, i) => `<span class="${i === sel ? "on" : ""}">${l}</span>`).join("")}</div>`;

  function wheel(cols) {
    return `<div class="wheel">${cols.map((col) => `<div class="wcol">${col.values.map((v, i) =>
      `<span class="wv d${Math.abs(i - col.sel)}">${v}</span>`).join("")}</div>`).join("")}<div class="wband"></div></div>`;
  }

  function ruler(value, unit) {
    let ticks = "";
    for (let i = -14; i <= 14; i++) {
      const major = (i + 5) % 10 === 0;
      const label = major ? `<em>${Math.round(80.5 + i / 10)}</em>` : "";
      ticks += `<span class="tk ${major ? "mj" : ""}" style="left:${50 + i * 3.4}%">${label}</span>`;
    }
    return `<div class="ruler"><div class="rv"><b>${value}</b> ${unit}</div><div class="rt">${ticks}<span class="rneedle"></span></div></div>`;
  }

  const note = (text, cls = "") => `<p class="note ${cls}">${ic("lock", 16)}<span>${text}</span></p>`;

  function footer(t, cta, opts = {}) {
    return `<div class="spacer"></div><footer class="ft">${opts.skip ? `<span class="skip">${opts.skip}</span>` : ""}
      <button class="cta ${opts.disabled ? "dis" : ""}">${cta}${CAND === "a" ? "" : ` <span class="arr">→</span>`}</button></footer>`;
  }

  // ---------- question bodies ----------
  const B = {
    hub(t) {
      const h = t.hub;
      return `<div class="brand"><img src="${ASSET}assets/brand/mark.png" alt=""><span>Taurifer</span></div>
        ${title(h.title, h.lede)}
        ${options([h.generate, h.build, h.import], ["wand", "pencil", "file"], 0)}
        <p class="hint">${ic("link", 16)} ${h.linkNote}</p>${footer(t, h.cta)}`;
    },
    intro(t) {
      const s = t.intro;
      return `<div class="brand"><img src="${ASSET}assets/brand/mark.png" alt=""><span>Taurifer</span></div>
        ${title(s.title, s.sub)}
        <ol class="vstep">${s.steps.map((st, i) => `<li class="${i === 0 ? "on" : ""}"><span class="vs-n">${i + 1}</span><span><b>${st[0]}</b>${i === 0 ? `<span>${st[1]}</span>` : ""}</span></li>`).join("")}</ol>
        ${footer(t, s.cta)}`;
    },
    sex: (t) => `${title(t.sex.q)}${options(t.sex.opts, ["female", "male", "none"], 1)}${note(t.localOnly + " " + t.notUsedYet)}${footer(t, t.next, { skip: t.skip })}`,
    birth: (t) => `${title(t.birth.q)}<div class="pick">${wheel([
      { values: ["12", "13", "14", "15", "16"], sel: 2 },
      { values: t.birth.months, sel: 2 },
      { values: ["1991", "1992", "1993", "1994", "1995"], sel: 2 }])}</div>${note(t.localOnly + " " + t.notUsedYet)}${footer(t, t.next, { skip: t.skip })}`,
    height: (t) => `${title(t.height.q)}${segmented(t.height.units, 0, "unit")}<div class="pick">${wheel([{ values: ["172 cm", "173 cm", "174 cm", "175 cm", "176 cm"], sel: 2 }])}</div>${note(t.localOnly + " " + t.notUsedYet)}${footer(t, t.next, { skip: t.skip })}`,
    weight: (t) => `${title(t.weight.q)}${segmented(t.weight.units, 0, "unit")}<div class="pick">${ruler(t.weight.value, t.weight.unit)}</div>${note(t.localOnly + " " + t.weight.note, "used")}${footer(t, t.next, { skip: t.skip })}`,
    lifting: (t) => `${title(t.lifting.q)}${options(t.lifting.opts, ["bars0", "bars1", "bars2", "bars3"], 2)}${footer(t, t.next)}`,
    cardio: (t) => `${title(t.cardio.q)}${options(t.cardio.opts, ["bars0", "bars1", "bars2", "bars3"], 1)}${note(t.localOnly + " " + t.notUsedYet)}${footer(t, t.next, { skip: t.skip })}`,
    gym: (t) => `${title(t.gym.q, t.gym.sub)}${options(t.gym.opts, ["everything", "commercial", "warehouse", "local", "garage", "home"], 1)}${footer(t, t.next)}`,
    equipment(t, opts = {}) {
      const e = t.equipment;
      const off = opts.off || [8];
      return `${title(e.q, e.sub)}<div class="checks">${e.groups.map((g, i) => `<label class="ck ${off.includes(i) ? "" : "on"}"><span class="box">${off.includes(i) ? "" : ic("check", 16)}</span><span>${g}</span></label>`).join("")}</div>
        <p class="link">${e.reset}</p>${footer(t, t.next)}`;
    },
    goal: (t) => `${title(t.goal.q)}${options(t.goal.opts, ["muscle", "dumbbell", "balance"], 0)}${footer(t, t.next)}`,
    days: (t) => `${title(t.days.q)}${options([2, 3, 4, 5, 6].map((n) => [t.days.unit(n)]), null, 2, { compact: true })}<p class="fact">${t.days.splitFact}</p>${footer(t, t.next)}`,
    minutes: (t) => `${title(t.minutes.q, t.minutes.sub)}${options([20, 40, 60, 90, 120, 150].map((n) => [t.minutes.unit(n)]), null, 2, { compact: true })}${footer(t, t.next)}`,
    priorities(t) {
      const p = t.priorities;
      const st = [2, 1, 1, 2, 1, 1, 1, 1, 1, 0];
      return `${title(p.q, p.sub)}<div class="prio">${p.muscles.map((m, i) => `<div class="prow"><span>${m}</span>${segmented(p.states, st[i], "mini")}</div>`).join("")}</div>${footer(t, t.next, { skip: t.skipSection })}`;
    },
    deload: (t) => `${title(t.deload.q)}<div class="tcard"><div class="tc-top">${ic("lighter", 30)}<span class="tog on"><i></i></span></div><b>${t.deload.title}</b><p>${t.deload.body}</p><span class="tag">${t.deload.rec}</span></div>${footer(t, t.next)}`,
    competency(t) {
      const c = t.competency;
      const ans = [0, 1, 0, 0, 2, 2, 1];
      return `${title(c.q, c.sub)}<div class="comp">${c.items.map((it, i) => `<div class="crow"><span class="cq">${it}</span>${segmented(c.answers, ans[i], "tri")}</div>`).join("")}</div>${footer(t, t.next)}`;
    },
    building(t) {
      const b = t.building;
      return `<div class="build">${CAND === "a" ? `<div class="orbit"><i></i><i></i><i></i></div>` : `<div class="bmark"><img src="${ASSET}assets/brand/mark.png" alt=""></div>`}
        <h1 class="q c">${b.title}</h1>
        <ul class="bsteps">${b.steps.map((s, i) => `<li class="${i < 2 ? "done" : i === 2 ? "now" : ""}"><span class="bi">${i < 2 ? ic("check", 16) : ""}</span>${s}</li>`).join("")}</ul>
        <div class="bbar"><i style="width:68%"></i></div></div><div class="spacer"></div><p class="skip">${b.skip}</p>`;
    },
    result(t) {
      const r = t.result;
      const day = window.PROGRAM[0];
      const mus = (m) => (r.muscles ? r.muscles[m] || m : m.charAt(0) + m.slice(1).toLowerCase());
      const tabs = window.PROGRAM.map((d, i) => `<span class="${i === 0 ? "on" : ""}">${r.dayNames[d.name]}</span>`).join("");
      const rows = day.slots.map((s, i) => {
        const label = r.muscles ? s.pt : s.en;
        const initials = label.split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        const thumb = s.media ? `<img src="${ASSET}${s.media}" alt="">` : `<span class="mono">${initials}</span>`;
        const sets = s.sets.map((x, j) => `<li><span class="sn">${j + 1}</span><span class="sr">${r.reps(x[0], x[1], x[3])}</span><span class="rir r${x[2]}">${CAND === "a" ? x[2] : `${r.rir} ${x[2]}`}</span></li>`).join("");
        const offer = i === 0 ? `<div class="offer"><p>${r.offer(r.offerName)}</p><button class="ghost">${r.offerBtn}</button></div>` : "";
        return `<article class="ex"><div class="thumb">${thumb}</div><div class="exb"><h3>${label}</h3><ul class="sets">${sets}</ul><div class="chips">${s.m.map((m) => `<span>${mus(m)}</span>`).join("")}</div>${offer}</div></article>`;
      }).join("");
      const top = CAND === "a"
        ? `<h1 class="q">${r.header}</h1>`
        : `<p class="kicker">${r.header}</p><h1 class="q">${r.name}</h1><div class="facts">${r.facts.map((f) => `<span><b>${f[0]}</b>${f[1]}</span>`).join("")}</div>
           <div class="blockrow"><span>${r.block}</span><span class="link">${r.change}</span></div>`;
      return `${top}<nav class="tabs">${tabs}</nav><div class="dayhd"><b>${r.count(day.slots.length)}</b><span>${r.time(day.est)}</span></div>${rows}${footer(t, r.activate)}`;
    },
    conflict(t) {
      const c = t.conflict;
      return `${title(t.equipment.q)}<div class="alert">${ic("warn", 22)}<div><b>${c.title}</b><p>${c.body}</p><p class="muted">${c.removed}. ${c.nothing}</p></div></div>
        <div class="checks">${["Halteres", "Kettlebells", "Barra fixa", "Elásticos"].map((g) => `<label class="ck ${/Barra fixa|Elásticos/.test(g) ? "" : "on"}"><span class="box">${/Barra fixa|Elásticos/.test(g) ? "" : ic("check", 16)}</span><span>${g}</span></label>`).join("")}</div>
        ${footer(t, c.back)}`;
    },
    build: (t) => `${title(t.build.title, t.build.lede)}<label class="field"><span>${t.build.name}</span><input value="" placeholder="${t.build.placeholder}"></label>
      <p class="flabel">${t.build.days}</p>${segmented(["1", "2", "3", "4", "5", "6", "7"], 3, "nums")}${footer(t, t.build.cta)}`,
    import: (t) => `${title(t.import.title, t.import.lede)}${options([t.import.file, t.import.paste], ["file", "clip"], -1)}${footer(t, t.import.cta, { disabled: true })}`,
    shared: (t) => `<div class="brand"><img src="${ASSET}assets/brand/mark.png" alt=""><span>Taurifer</span></div>${title(t.shared.title)}
      <div class="sharedcard"><b>${t.shared.cap}</b><p>${t.shared.body}</p></div>${footer(t, t.shared.cta, { skip: t.shared.alt })}`,

    // ---------- candidate C composites ----------
    about(t) {
      const rows = [
        [t.lang === "en" ? "Sex" : "Sexo", segmented(t.lang === "en" ? ["Female", "Male", "Rather not"] : ["Fem.", "Masc.", "Não informar"], 1, "mini")],
        [t.lang === "en" ? "Birth date" : "Nascimento", `<span class="val">14/06/1993 ${ic("chevR", 16)}</span>`],
        [t.lang === "en" ? "Height" : "Altura", `<span class="val">174 cm ${ic("chevR", 16)}</span>`],
        [t.lang === "en" ? "Weight" : "Peso", `<span class="val">80,5 kg ${ic("chevR", 16)}</span>`],
      ];
      return `${title("Sobre você", "Tudo é opcional. " + t.localOnly)}<div class="form">${rows.map((r, i) => `<div class="frow"><span class="fl">${r[0]}${i < 3 ? `<em>${t.notUsedYet}</em>` : `<em class="used">${t.weight.note}</em>`}</span>${r[1]}</div>`).join("")}</div>
        <div class="sheetpeek"><div class="pick">${wheel([{ values: ["79,5", "80,0", "80,5", "81,0", "81,5"], sel: 2 }, { values: ["", "", "kg", "lb", ""], sel: 2 }])}</div></div>${footer(t, t.next, { skip: t.skipSection })}`;
    },
    experience(t) {
      return `${title("Seu histórico de treino")}<p class="flabel">${t.lifting.q}</p>${options(t.lifting.opts, null, 2, { compact: true })}
        <p class="flabel">${t.cardio.q} <em>${t.notUsedYet}</em></p>${segmented(t.cardio.opts.map((o) => o[0]), 1, "wrap")}${footer(t, t.next)}`;
    },
    gymAll(t) {
      const e = t.equipment;
      const short = t.gym.opts.map((o) => [o[0]]);
      return `${title(t.gym.q)}${options(short, ["everything", "commercial", "warehouse", "local", "garage", "home"], 1, { compact: true, noSub: true })}
        <div class="disc open"><div class="disc-h"><b>Equipamento</b><span>${e.summary(12, 13)} ${ic("chevD", 16)}</span></div>
        <div class="chipsel">${e.groups.map((g, i) => `<span class="${i === 8 ? "" : "on"}">${i === 8 ? "" : ic("check", 14)}${g}</span>`).join("")}</div></div>${footer(t, t.next)}`;
    },
    programAll(t) {
      return `${title("Seu programa")}<p class="flabel">${t.goal.q}</p>${options(t.goal.opts, ["muscle", "dumbbell", "balance"], 0, { compact: true, noSub: true })}
        <p class="flabel">${t.days.q}</p>${segmented(["2", "3", "4", "5", "6"], 2, "nums")}<p class="fact">${t.days.splitFact}</p>
        <p class="flabel">${t.minutes.q}</p>${segmented(["20", "40", "60", "90", "120", "150"], 2, "nums")}${footer(t, t.next)}`;
    },
    focus(t) {
      const p = t.priorities;
      const st = [2, 1, 1, 2, 1, 1, 1, 1, 1, 0];
      return `${title("O que priorizar", p.sub)}<div class="mchips">${p.muscles.map((m, i) => `<span class="s${st[i]}">${st[i] === 2 ? "↑ " : st[i] === 0 ? "↓ " : ""}${m}</span>`).join("")}</div>
        <p class="hint">Toque uma vez para priorizar e duas para reduzir.</p>
        <div class="trow"><span><b>${t.deload.title}</b><span>${t.deload.body}</span><em class="tag">${t.deload.rec}</em></span><span class="tog on"><i></i></span></div>${footer(t, t.next, { skip: t.skipSection })}`;
    },
  };

  // ---------- flows ----------
  const S = (id, section, pos, of, sectionIndex, sectionCount, body, extra = {}) => ({ id, section, pos, of, sectionIndex, sectionCount, body, ...extra });
  const longFlow = (n) => [
    S("hub", null, 0, 1, 0, n, "hub"),
    S("intro", null, 0, 1, 0, n, "intro"),
    S("sex", "basics", 1, 6, 0, n, "sex"),
    S("birth", "basics", 2, 6, 0, n, "birth"),
    S("height", "basics", 3, 6, 0, n, "height"),
    S("weight", "basics", 4, 6, 0, n, "weight"),
    S("lifting", "basics", 5, 6, 0, n, "lifting"),
    S("cardio", "basics", 6, 6, 0, n, "cardio"),
    S("gym", "gym", 1, 2, 1, n, "gym"),
    S("equipment", "gym", 2, 2, 1, n, "equipment", { en: true }),
    S("goal", "program", 1, 6, 2, n, "goal"),
    S("days", "program", 2, 6, 2, n, "days"),
    S("minutes", "program", 3, 6, 2, n, "minutes"),
    S("priorities", "program", 4, 6, 2, n, "priorities"),
    S("deload", "program", 5, 6, 2, n, "deload"),
    S("competency", "program", 6, 6, 2, n, "competency", { en: true }),
    S("building", null, 0, 1, 3, n, "building", { en: true }),
    S("result", "result", 1, 1, 3, n, "result", { en: true, tall: true }),
    S("conflict", "result", 1, 1, 3, n, "conflict"),
    S("route-build", null, 0, 1, 0, n, "build"),
    S("route-import", null, 0, 1, 0, n, "import"),
    S("route-shared", null, 0, 1, 0, n, "shared"),
  ];
  const FLOWS = {
    a: longFlow(4),
    b: longFlow(4),
    c: [
      S("hub", null, 0, 1, 0, 3, "hub"),
      S("about", "basics", 1, 2, 0, 3, "about"),
      S("experience", "basics", 2, 2, 0, 3, "experience"),
      S("gym", "gym", 1, 1, 1, 3, "gymAll", { en: false }),
      S("program", "program", 1, 3, 2, 3, "programAll", { en: true }),
      S("focus", "program", 2, 3, 2, 3, "focus"),
      S("competency", "program", 3, 3, 2, 3, "competency", { en: true }),
      S("building", null, 0, 1, 2, 3, "building"),
      S("result", "result", 1, 1, 2, 3, "result", { en: true, tall: true }),
      S("conflict", "gym", 1, 1, 1, 3, "conflict"),
    ],
  };
  window.FLOWS = FLOWS;

  function renderScreen(s, lang, theme) {
    const t = { ...strings(lang), lang };
    const body = B[s.body](t);
    return `<div class="phone ${s.tall ? "tall" : ""}" data-theme="${theme}" data-cand="${CAND}">${statusBar()}${header(t, s)}<main class="body">${body}</main></div>`;
  }

  // ---------- page ----------
  const screenId = q.get("screen");
  const lang = q.get("lang") || "pt";
  const theme = q.get("theme") || "light";
  if (screenId) {
    document.body.classList.add("capture");
    const s = FLOWS[CAND].find((x) => x.id === screenId);
    document.body.innerHTML = renderScreen(s, lang, theme);
  } else {
    const ann = window.ANNOTATIONS || {};
    document.body.innerHTML = `<div class="board"><h1>${document.title}</h1><p class="bl">${window.BOARD_LEDE || ""}</p>
      ${FLOWS[CAND].map((s, i) => `<section class="bs"><div class="bs-ph">${renderScreen(s, lang, theme)}</div>
        <aside class="bs-an"><b>${i + 1}. ${s.id}</b>${ann[s.id] ? `<p>${ann[s.id]}</p>` : ""}</aside></section>`).join("")}</div>`;
  }
})();
