/* In-page acceptance audit for Round 2 (injected by tools/verify.mjs).
 * window.__audit.run({ checkpoint, lang, vw, text, motion }) returns
 * { hard: [...], warn: [...], data } for the rendered document. Every check
 * is generic: it reads the DOM and the shared runtime (TF), never a
 * candidate's internals. Check ids follow the synthesis spec §12.2.
 */
(function () {
  "use strict";
  const IGNORE_CLOSEST = ".visually-hidden";
  const rectOf = (el) => el.getBoundingClientRect();
  function visible(el, { allowVisuallyHidden = false } = {}) {
    if (!el || !el.isConnected) return false;
    if (!allowVisuallyHidden && el.closest(IGNORE_CLOSEST)) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (allowVisuallyHidden && el.closest(IGNORE_CLOSEST)) return true;
    const r = rectOf(el); return r.width > 0 && r.height > 0;
  }
  const SKIP_TEXT = "script,style,textarea,input,select,pre,code,[data-user-text],noscript,template";
  function textNodes(root = document.body, { allowVisuallyHidden = false } = {}) {
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const p = n.parentElement; if (!p || p.closest(SKIP_TEXT)) continue; if (!visible(p, { allowVisuallyHidden })) continue; out.push(n); }
    return out;
  }
  function accessibleStrings() {
    const out = [];
    for (const el of document.querySelectorAll("[aria-label],[title],img[alt],[placeholder],[aria-description]")) {
      if (el.closest("[data-user-text]")) continue;
      if (!visible(el, { allowVisuallyHidden: true })) continue;
      for (const a of ["aria-label", "title", "alt", "placeholder", "aria-description"]) { const v = el.getAttribute(a); if (v && v.trim()) out.push({ el, attr: a, text: v.trim() }); }
    }
    return out;
  }
  const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
  const short = (s, n = 60) => String(s).replace(/\s+/g, " ").trim().slice(0, n);
  const MODAL = "[role=dialog],[role=alertdialog],[aria-modal=true],.dialog,.sheet,.sheet-scrim,.toast,.dock,[data-privacy-stub]";

  /* K-11: persistent-action regions. Explicit [data-persistent-action] or a
     visible bottom-anchored fixed/sticky element holding a control, outside
     any modal surface, not nested in another region. */
  function persistentRegions() {
    const cands = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(MODAL)) continue;
      const cs = getComputedStyle(el);
      const explicit = el.hasAttribute("data-persistent-action");
      const pinned = (cs.position === "fixed" || cs.position === "sticky") && cs.bottom !== "auto";
      if (!explicit && !pinned) continue;
      if (!visible(el)) continue;
      if (!el.querySelector("button,a[href],[role=button],input,select")) continue;
      cands.push(el);
    }
    return cands.filter((el) => !cands.some((o) => o !== el && o.contains(el)));
  }
  const pinnedTop = () => { const tops = persistentRegions().map((r) => rectOf(r).top).filter((t) => t > 0 && t < innerHeight); return tops.length ? Math.min(...tops) : innerHeight; };

  /* Lines a range occupies (distinct line boxes). */
  function lineCount(range) {
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) return 0;
    rects.sort((a, b) => a.top - b.top);
    let lines = 1, top = rects[0].top, h = rects[0].height;
    for (const r of rects.slice(1)) if (r.top - top > Math.max(2, h * 0.5)) { lines++; top = r.top; h = r.height; }
    return lines;
  }

  /* K-12: no word inside a control or heading renders across two lines, and
     no control label overflows its box (H-12 makes labels overflow instead
     of breaking; this is where that overflow is caught). */
  const WORD_SCOPES = "button,[role=button],[role=radio],[role=checkbox],[role=option],[role=tab],[role=switch],a.btn,summary,.choice__title,.chip,.btn,h1,h2,h3,h4,[role=heading]";
  function k12() {
    const out = [];
    const scopes = [...document.querySelectorAll(WORD_SCOPES)].filter((el) => visible(el));
    const seen = new Set();
    for (const scope of scopes) {
      for (const tn of textNodes(scope)) {
        if (seen.has(tn)) continue; seen.add(tn);
        const s = tn.nodeValue; const re = /[^\s \-–—\/·]+/g; let m;
        while ((m = re.exec(s))) {
          if (m[0].length < 2) continue;
          const r = document.createRange(); r.setStart(tn, m.index); r.setEnd(tn, m.index + m[0].length);
          if (lineCount(r) > 1) out.push(`word split across lines: "${m[0]}" in ${describe(scope)} "${short(scope.textContent, 40)}"`);
        }
      }
    }
    for (const el of document.querySelectorAll(".btn,button,.choice__title,.chip,[role=radio],[role=checkbox]")) {
      if (!visible(el) || el.closest(".dock")) continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) out.push(`control label overflows its box: ${describe(el)} "${short(el.textContent, 40)}" (${el.scrollWidth}>${el.clientWidth})`);
    }
    return [...new Set(out)];
  }
  /* K-13: numeric option values on one line. */
  function k13() {
    const out = [];
    for (const tn of textNodes()) {
      const v = tn.nodeValue.trim(); if (!/^\d{1,3}\+?$/.test(v)) continue;
      const host = tn.parentElement.closest("button,[role=radio],[role=option],[role=checkbox],.choice,.chip,label"); if (!host) continue;
      const r = document.createRange(); r.selectNodeContents(tn);
      if (lineCount(r) > 1) out.push(`numeric option "${v}" renders on ${lineCount(r)} lines in ${describe(host)}`);
    }
    return out;
  }
  /* K-10: raw engine codes in visible text or accessible names. */
  const CODE_RES = [/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/, /\b[a-z][a-z0-9_]*:[a-z0-9][a-z0-9_.-]*/];
  function k10() {
    const out = [];
    const test = (s, where) => { for (const re of CODE_RES) { const m = re.exec(s); if (m && !/^https?:/.test(m[0])) { out.push(`raw code "${m[0]}" in ${where}: "${short(s)}"`); return; } } };
    for (const tn of textNodes(document.body, { allowVisuallyHidden: true })) test(tn.nodeValue, "text");
    for (const a of accessibleStrings()) test(a.text, `${a.attr} of ${describe(a.el)}`);
    return [...new Set(out)].slice(0, 12);
  }
  /* Library names are data, not copy: removed before the word checks. */
  const LIB_NAMES = () => { const names = []; for (const e of TF.LIB) { if (e.namePt) names.push(e.namePt); if (e.name) names.push(e.name); } return names.sort((a, b) => b.length - a.length); };
  let libNames = null;
  const stripLib = (s) => { libNames = libNames || LIB_NAMES(); let o = s; for (const n of libNames) if (o.includes(n)) o = o.split(n).join(" "); return o; };
  /* Production catalog strings that legitimately contain a watched word are
     exempt (e.g. entry.background.consistency.most "Completei a maioria…",
     entry.cap.safe_pull "Puxada vertical segura"); only added copy is judged. */
  function catalogExemptions(lang, re) {
    const vals = Object.values(TF.F.i18n[lang] || {}).concat(Object.values(TF.OVERRIDES[lang] || {})).filter((v) => typeof v === "string" && re.test(v));
    return vals.map((v) => new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\w+\\\}/g, ".*?"), "g"));
  }
  function visibleCopy() {
    const parts = textNodes(document.body, { allowVisuallyHidden: true }).map((n) => n.nodeValue);
    for (const a of accessibleStrings()) parts.push(a.text);
    return parts.join("\n");
  }
  /* K-15: PT only. */
  /* Whole words with Unicode letter boundaries (\b does not treat "ê" or
     "ç" as letters). */
  const words = (list, flags = "iu") => new RegExp(`(?<!\\p{L})(?:${list.join("|")})(?!\\p{L})`, flags);
  const K15 = words(["aparelhos?", "stats", "log", "performance", "delta", "split", "offline", "Introduza", "assinalad[oa]s?", "regista", "separador", "Porquê", "aplicação", "folha de cálculo", "em falta", "por isso"]);
  /* Case-sensitive: "O meu" and the EU-PT imperative "Rever" as a label. */
  const K15_CASE = /(?<!\p{L})(?:O meu|Rever)(?!\p{L})/u;
  function k15(lang) {
    const out = [];
    if (lang === "pt") {
      let s = stripLib(visibleCopy());
      for (const re of catalogExemptions("pt", K15)) s = s.replace(re, " ");
      for (const g of [new RegExp(K15.source, "giu"), new RegExp(K15_CASE.source, "gu")]) { let m; while ((m = g.exec(s))) out.push(`banned or EU-PT word "${m[0]}": "${short(s.slice(Math.max(0, m.index - 30), m.index + 30))}"`); }
      for (const el of document.querySelectorAll("button,a,[role=button],[aria-label]")) {
        if (!visible(el, { allowVisuallyHidden: true })) continue;
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
        if (/^(Close|OK)$/.test(name)) out.push(`English fallback label "${name}" on ${describe(el)}`);
      }
    }
    return [...new Set(out)];
  }
  /* K-16: unmeasured claims. */
  const K16 = words(["maioria", "most people", "seguros?", "seguras?", "safe"]);
  const DOOR_MINUTES = /\b(?:cerca de|about|aprox\w*|~)?\s*\d+\s*(?:[–-]|a|to)?\s*\d*\s*(?:min\b|minutos?\b|minutes?\b)/i;
  function k16(lang, checkpoint) {
    const out = [];
    let s = stripLib(visibleCopy());
    for (const re of catalogExemptions(lang, K16)) s = s.replace(re, " ");
    const g = new RegExp(K16.source, "giu"); let m; while ((m = g.exec(s))) out.push(`unmeasured claim "${m[0]}": "${short(s.slice(Math.max(0, m.index - 30), m.index + 30))}"`);
    if (["route-choice", "route-help", "hub-existing"].includes(checkpoint)) {
      const dm = DOOR_MINUTES.exec(visibleCopy()); if (dm) out.push(`minutes on the route chooser: "${short(dm[0])}"`);
    }
    return [...new Set(out)];
  }
  /* K-21: reduced motion is one decision. */
  const secs = (v) => String(v || "0s").split(",").map((x) => { x = x.trim(); return x.endsWith("ms") ? parseFloat(x) / 1000 : parseFloat(x) || 0; });
  function k21() {
    const out = [];
    for (const el of document.querySelectorAll("*")) {
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === "none" || cs.content === "normal")) continue;
        const a = cs.animationName !== "none" && secs(cs.animationDuration).some((x) => x > 0);
        const t = secs(cs.transitionDuration).some((x) => x > 0);
        if (a || t) { out.push(`${describe(el)}${pseudo || ""} ${a ? "animation " + cs.animationDuration : ""}${t ? " transition " + cs.transitionDuration : ""}`); if (out.length > 8) return out; }
      }
    }
    for (const an of document.getAnimations ? document.getAnimations() : []) { const d = an.effect?.getComputedTiming?.().duration; if (d > 0 && an.playState === "running") out.push(`running animation ${an.animationName || an.id || ""} ${d}ms`); }
    return out;
  }
  /* K-22 (warning): the recommend result's first viewport. */
  function k22(lang) {
    const out = [];
    const t = TF.makeT(lang, TS.COPY[lang]);
    const r = TF.compile("recommend", TF.fixtureAnswers("rafael")); if (!r.ok) return ["could not compile Rafael"];
    const facts = TF.previewFacts(r.preview);
    const limit = pinnedTop();
    const inView = (el) => { const b = rectOf(el); return b.top >= 0 && b.bottom <= limit + 1; };
    const nodes = textNodes();
    const hasText = (needle) => nodes.some((n) => n.nodeValue.includes(needle) && inView(n.parentElement));
    const name = TF.resultName(r, lang); if (!hasText(name)) out.push(`program name "${name}" not in the first viewport above the pinned region`);
    const dayName = TF.dayName(t, r.preview.days[0], r.preview.programStructure, 0); if (!hasText(dayName)) out.push(`first day "${dayName}" not in the first viewport`);
    /* innerText, not textContent: adjacent inline spans ("minutos</span><span>18")
       must read as separate words, or \b never matches (D generator report). */
    const rendered = (el) => el.innerText || el.textContent || "";
    const factEl = [...document.querySelectorAll("body *")].find((el) => visible(el) && inView(el) && rendered(el).length < 240 && new RegExp(`\\b${facts.exercises}\\b`).test(rendered(el)) && new RegExp(`\\b${facts.sets}\\b`).test(rendered(el)));
    if (!factEl) out.push(`facts line (${facts.exercises} exercises, ${facts.sets} sets) not in the first viewport`);
    return out;
  }
  /* K-23 (static half; the Privacy click is performed by verify.mjs). */
  function k23(lang) {
    const out = [];
    const t = TF.makeT(lang, TS.COPY[lang]);
    const limit = pinnedTop();
    for (const id of ["firstRunCreate", "firstRunImport"]) { const el = document.getElementById(id); if (!el || !visible(el)) out.push(`#${id} missing`); else if (rectOf(el).bottom > Math.min(innerHeight, limit) + 1 || rectOf(el).top < 0) out.push(`#${id} outside the first viewport (bottom ${Math.round(rectOf(el).bottom)} of ${innerHeight})`); }
    const alt = t("landing.shot.today_ready.alt");
    const img = [...document.images].find((i) => i.getAttribute("alt") === alt && /today-ready-/.test(i.src));
    if (!img) out.push("landing proof image with landing.shot.today_ready.alt missing"); else if (!img.complete || !img.naturalWidth) out.push("landing proof image did not load");
    const p = document.querySelector("[data-privacy-open]"); if (!p || !visible(p)) out.push("Privacy control ([data-privacy-open]) missing");
    return out;
  }
  function basic() {
    const errs = [...(window.__tournamentErrors || [])];
    const overflow = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = rectOf(el); if (!(r.width > 0 && r.right > innerWidth + 1)) continue;
      if (el.closest(IGNORE_CLOSEST)) continue;
      let p = el.parentElement, scroller = false; while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll") { scroller = true; break; } p = p.parentElement; }
      if (!scroller) { overflow.push(`${describe(el)} right ${Math.round(r.right)}`); if (overflow.length > 3) break; }
    }
    const small = [];
    for (const el of document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button]")) {
      if (!visible(el)) continue;
      const r = rectOf(el); if (r.height < 43.5 || r.width < 43.5) small.push(`${describe(el)}[${short(el.textContent || el.getAttribute("aria-label") || "", 24)}] ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    /* H-14: .visually-hidden (and its descendants) is excluded. */
    const clipped = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,span,button,label,li,strong,b")) {
      if (el.closest(IGNORE_CLOSEST)) continue;
      if (el.children.length && el.textContent.trim().length > 60) continue;
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && cs.textOverflow !== "ellipsis") clipped.push(`${el.tagName.toLowerCase()} "${short(el.textContent, 30)}"`);
    }
    return { errs, overflow, small: small.slice(0, 12), clipped: clipped.slice(0, 6) };
  }
  /* K-31 (Q634): no raw catalog key, `undefined`, `NaN` or `[object Object]`
     in visible text or accessible names. A dotted lowercase token with at
     least two dots (entry.route.undefined, x.change.many) is a key. */
  const RAW_KEY = /(?<![\w./:@-])[a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,}(?![\w/])/;
  const RAW_VALUE = /\bundefined\b|\bNaN\b|\[object Object\]/;
  function k31() {
    const out = [];
    const all = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const par = n.parentElement; if (!par || par.closest("script,style,noscript,template") || !n.nodeValue.trim()) continue; if (!visible(par, { allowVisuallyHidden: true })) continue; all.push({ text: n.nodeValue, where: describe(par), user: !!par.closest("[data-user-text]") }); }
    for (const a of accessibleStrings()) all.push({ text: a.text, where: `${describe(a.el)}@${a.attr}`, user: false });
    for (const x of all) {
      const m = (!x.user && x.text.match(RAW_KEY)) || x.text.match(RAW_VALUE);
      if (m) { out.push(`raw text "${m[0]}" in ${x.where}: "${short(x.text, 60)}"`); if (out.length > 4) break; }
    }
    return out;
  }
  /* K-32 (Q634, L-3): on every review, the first day's name and its first
     exercise are in the first viewport, above the pinned region. The
     program comes from the candidate's entry() contract. */
  const REVIEWS = new Set(["rec-result", "rec-result-corrected", "rec-result-avoided", "custom-result", "browse-preview", "import-preview", "shared-preview"]);
  function k32(lang) {
    const out = [];
    const cand = (window.__tournamentCandidates || {})[window.__tq && window.__tq.candidate];
    let e = null; try { e = cand && cand.entry && cand.entry(); } catch (err) { return [`entry() threw: ${short(err, 80)}`]; }
    const p = e && e.result && e.result.preview; if (!p || !(p.days || []).length) return ["no reviewed program in entry()"];
    const t = TF.makeT(lang, TS.COPY[lang]);
    const day = p.days[0]; const dayName = TF.dayName(t, day, p.programStructure, 0);
    const ex = (day.exercises || [])[0]; const exName = ex ? TS.exName(ex, lang) : "";
    const limit = pinnedTop();
    const nodes = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const par = n.parentElement; if (par && n.nodeValue.trim() && !par.closest(MODAL) && visible(par)) nodes.push(n); }
    const inView = (needle) => nodes.some((x) => x.nodeValue.includes(needle) && (() => { const r = rectOf(x.parentElement); return r.top >= 0 && r.bottom <= limit + 1; })());
    if (!inView(dayName)) out.push(`first day "${dayName}" is not in the first viewport above the pinned region`);
    if (exName && !inView(exName)) out.push(`first exercise "${exName}" is not in the first viewport above the pinned region`);
    return out;
  }
  function run({ checkpoint, lang, vw, text, motion }) {
    const hard = [], warn = [], data = {};
    const b = basic();
    for (const e of b.errs) hard.push(`runtime error: ${short(e, 200)}`);
    if (!document.querySelector(`[data-checkpoint="${checkpoint}"]`)) hard.push("checkpoint marker missing");
    if (b.overflow.length) hard.push(`horizontal overflow: ${b.overflow.join("; ")}`);
    if (b.small.length) warn.push(`targets under 44px: ${b.small.join("; ")}`);
    if (b.clipped.length) warn.push(`clipped text: ${b.clipped.join("; ")}`);
    for (const p of k10()) hard.push(`K-10 ${p}`);
    const regions = persistentRegions();
    data.regions = regions.map((r) => ({ el: describe(r), height: Math.round(rectOf(r).height), share: +(rectOf(r).height / innerHeight).toFixed(3) }));
    if (regions.length > 1) hard.push(`K-11 ${regions.length} persistent-action regions: ${data.regions.map((r) => r.el).join(", ")}`);
    for (const r of data.regions) if (r.share > 0.33) hard.push(`K-11 persistent-action region ${r.el} is ${Math.round(r.share * 100)}% of the viewport (${r.height}px of ${innerHeight}px)`);
    for (const p of k12()) hard.push(`K-12 ${p}`);
    for (const p of k13()) hard.push(`K-13 ${p}`);
    for (const p of k15(lang)) hard.push(`K-15 ${p}`);
    for (const p of k16(lang, checkpoint)) hard.push(`K-16 ${p}`);
    if (motion === "reduced") for (const p of k21()) hard.push(`K-21 ${p}`);
    if (checkpoint === "rec-result" && vw === 390 && text === "100") for (const p of k22(lang)) warn.push(`K-22 ${p}`);
    for (const p of k31()) hard.push(`K-31 ${p}`);
    if (REVIEWS.has(checkpoint) && vw === 390 && text === "100") for (const p of k32(lang)) hard.push(`K-32 ${p}`);
    if (checkpoint === "landing" && vw === 390 && text === "100") { data.k23 = true; for (const p of k23(lang)) hard.push(`K-23 ${p}`); }
    data.title = document.querySelector("h1")?.textContent?.trim() || "";
    return { hard, warn, data };
  }
  window.__audit = { run, visible, textNodes, persistentRegions, pinnedTop, lineCount, describe, k31 };
})();
