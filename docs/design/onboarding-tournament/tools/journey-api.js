/* In-page journey API (injected by tools/verify.mjs after the document is
 * ready). The contract is round-2/JOURNEYS.md. A candidate's journey
 * receives `api`; every user action goes through api.tap / api.type, which
 * ask the Node side to perform a real Playwright click or fill on the
 * element (actionability, scrolling and hit-testing included). Each action
 * is counted and traced. Programmatic (untrusted) clicks are detected and
 * fail the journey. Checks live in tools/journey-checks.js.
 */
(function () {
  "use strict";
  const A = window.__audit;
  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const vis = (el) => A.visible(el);
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  let untrusted = 0;
  document.addEventListener("click", (e) => { if (!e.isTrusted) untrusted++; }, true);
  let targetSeq = 0;

  function resolve(target, { all = false } = {}) {
    let list;
    if (target instanceof Element) list = [target];
    else if (typeof target === "string") list = [...document.querySelectorAll(target)];
    else if (target && typeof target === "object") {
      const scope = target.within ? (typeof target.within === "string" ? document.querySelector(target.within) : target.within) : document;
      const sel = target.selector || "button,a[href],[role=button],[role=radio],[role=checkbox],[role=option],summary,label,input,textarea";
      list = scope ? [...scope.querySelectorAll(sel)] : [];
      if (target.text !== undefined) { const want = norm(target.text).toLowerCase(); list = list.filter((el) => { const hay = norm(el.getAttribute("aria-label") || el.textContent).toLowerCase(); return target.exact ? hay === want : hay.includes(want); }); }
    } else list = [];
    list = list.filter(vis);
    return all ? list : list;
  }
  function digest() {
    const q = (s) => [...document.querySelectorAll(s)].filter(vis);
    const textOf = (ids) => (ids || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean).map((el) => norm(el.textContent)).join(" ");
    return {
      checkpoints: q("[data-checkpoint]").map((e) => e.dataset.checkpoint),
      steps: q("[data-entry-step]").map((e) => e.dataset.entryStep),
      dialogs: q("[role=dialog],[role=alertdialog]").map((e) => ({ checkpoint: e.dataset.checkpoint || null, confirm: e.dataset.confirm || null, privacy: e.hasAttribute("data-privacy-stub"), text: norm(e.textContent).slice(0, 400) })),
      activate: q("[data-activate]").map((e) => ({ disabled: e.disabled || e.getAttribute("aria-disabled") === "true", label: norm(e.textContent), reason: textOf(e.getAttribute("aria-describedby")) })),
      advance: q("[data-advance]").map((e) => ({ disabled: e.disabled || e.getAttribute("aria-disabled") === "true", label: norm(e.textContent), reason: textOf(e.getAttribute("aria-describedby")) })),
      change: q("[data-change-statement]").map((e) => ({ n: Number(e.dataset.changed), total: Number(e.dataset.total), text: norm(e.textContent) })),
      /* K-28: where the first change statement sits in the viewport. */
      changeView: (() => { const e = q("[data-change-statement]")[0]; if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(A.pinnedTop()), vh: innerHeight }; })(),
      improws: [...document.querySelectorAll("[data-imp-row]")].map((r) => ({ key: r.dataset.impRow, name: norm(r.querySelector(".improw__name")?.textContent), badge: norm(r.querySelector(".impbadge")?.textContent), open: r.classList.contains("is-open") })),
      today: norm(document.querySelector("[data-today-program]")?.textContent || ""),
      landing: !!(document.querySelector("#firstRunCreate") && vis(document.querySelector("#firstRunCreate"))) || q('[data-checkpoint="landing"]').length > 0,
      text: norm(A.textNodes().map((n) => n.nodeValue).join(" ")).slice(0, 8000),
      scrollY: Math.round(scrollY),
    };
  }
  const settle = (ms = 60) => new Promise((r) => requestAnimationFrame(() => setTimeout(r, ms)));

  window.__journeyRun = async function (id, params, opts) {
    const cand = (window.__tournamentCandidates || {})[window.__tq.candidate];
    const run = { id, params: params || {}, status: "ok", taps: 0, probes: 0, trace: [], snapshots: {}, marks: {}, overlays: [], notOffered: [], problems: [], returned: null };
    if (!cand) return { ...run, status: "error", problems: ["candidate not loaded"] };
    const fn = cand.journeys && cand.journeys[id];
    if (typeof fn !== "function") return { ...run, status: "not-implemented" };
    if (typeof cand.entry !== "function") run.problems.push("candidate does not export entry()");
    const entry = () => { try { return clone(cand.entry ? cand.entry() : null); } catch (e) { return { error: String(e) }; } };
    const lang = window.__tq.lang;
    const act = async (kind, target, extra) => {
      const els = resolve(target);
      if (els.length === 0) throw new Error(`${kind}: no visible element for ${typeof target === "string" ? target : JSON.stringify(target instanceof Element ? A.describe(target) : target)}`);
      if (els.length > 1 && !(extra && extra.first)) throw new Error(`${kind}: ${els.length} visible elements match ${typeof target === "string" ? target : JSON.stringify(target instanceof Element ? "element" : target)}; be specific or pass {first:true}`);
      const el = els[0]; const n = ++targetSeq; el.setAttribute("data-journey-target", String(n));
      const res = await window.__journeyAct({ kind, n, value: extra && extra.value });
      if (el.isConnected) el.removeAttribute("data-journey-target");
      if (!res || !res.ok) throw new Error(`${kind} failed on ${A.describe(el)} "${norm(el.textContent).slice(0, 40)}": ${res && res.error}`);
      await settle();
      return el;
    };
    const record = (kind, label, el) => { const d = digest(); run.trace.push({ n: run.taps, kind, label: label || (el ? norm(el.getAttribute("aria-label") || el.textContent).slice(0, 50) : ""), checkpoints: d.checkpoints, steps: d.steps, dialogs: d.dialogs.length }); };
    const api = {
      lang, cell: opts || {}, journey: id, params: run.params,
      t: TF.makeT(lang, TS.COPY[lang]),
      async tap(target, o = {}) { const el = await act("tap", target, o); run.taps++; record("tap", o.label, el); return el; },
      async type(target, text, o = {}) { const el = await act("fill", target, { ...o, value: String(text) }); run.taps++; record("type", o.label, el); return el; },
      find(target) { return resolve(target)[0] || null; },
      findAll(target) { return resolve(target, { all: true }); },
      async waitFor(target, { timeout = 4000 } = {}) { const t0 = Date.now(); for (;;) { const ok = typeof target === "function" ? target() : resolve(target).length > 0; if (ok) return true; if (Date.now() - t0 > timeout) throw new Error(`waitFor timed out: ${typeof target === "function" ? "condition" : JSON.stringify(target)}`); await settle(50); } },
      snapshot(label, extra) { run.snapshots[label] = { taps: run.taps, entry: entry(), dom: digest(), device: clone({ active: TF.device.active, revision: TF.device.revision, draft: TF.device.draft }), extra: clone(extra) }; },
      mark(label) { run.marks[label] = { taps: run.taps, trace: run.trace.length }; },
      async probe(label) {
        const before = entry(); const d = digest();
        const adv = resolve("[data-advance]")[0];
        let blocked, how;
        if (!adv) { blocked = false; how = "no [data-advance] visible"; }
        else if (adv.disabled || adv.getAttribute("aria-disabled") === "true") { blocked = true; how = "advance disabled"; }
        else {
          const n = ++targetSeq; adv.setAttribute("data-journey-target", String(n));
          const r = await window.__journeyAct({ kind: "tap", n }); run.probes++; await settle();
          const after = entry(); const d2 = digest();
          blocked = !!r.ok && JSON.stringify(d2.steps) === JSON.stringify(d.steps) && (after?.step === before?.step) && !after?.result;
          how = blocked ? "advance tapped, step unchanged" : `advance moved from ${before?.step} to ${after?.step}`;
        }
        run.snapshots[label] = { taps: run.taps, entry: before, dom: d, probe: { blocked, how } };
      },
      async checkOverlay(target, label) {
        const el = resolve(target)[0];
        const rec = { label, ok: false, detail: "" };
        if (!el) { rec.detail = "confirm control not visible"; run.overlays.push(rec); return rec; }
        const r = el.getBoundingClientRect(); const modal = !!el.closest("[role=dialog],[role=alertdialog],[aria-modal=true]");
        const limit = modal ? innerHeight : A.pinnedTop();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = cy >= 0 && cy <= innerHeight ? document.elementFromPoint(cx, cy) : null;
        const inView = r.top >= 0 && r.bottom <= limit + 1;
        const onTop = !!hit && (hit === el || el.contains(hit));
        rec.ok = inView && onTop; rec.detail = `top ${Math.round(r.top)} bottom ${Math.round(r.bottom)} limit ${Math.round(limit)} viewport ${innerHeight} ${onTop ? "on top" : "covered"}`;
        /* K-29 (Q634): a modal editor's scrolling body keeps at least half
           the viewport. Inline editors scroll with the page and pass. */
        const dlg = el.closest("[role=dialog],[role=alertdialog],[aria-modal=true]");
        if (dlg) {
          const scrollers = [dlg, ...dlg.querySelectorAll("*")].filter((x) => { const oy = getComputedStyle(x).overflowY; return (oy === "auto" || oy === "scroll") && x.scrollHeight > x.clientHeight + 1; });
          const h = scrollers.length ? Math.min(...scrollers.map((x) => x.getBoundingClientRect().height)) : null;
          rec.scroller = h == null ? null : Math.round(h);
          if (h != null && h < innerHeight * 0.5) { rec.ok = false; rec.k29 = true; rec.detail += `; K-29 scrolling body ${Math.round(h)}px of ${innerHeight}px viewport`; }
        }
        run.overlays.push(rec); return rec;
      },
      notOffered(what, why = "") { run.notOffered.push({ what, why }); },
      fail(message) { run.problems.push(`journey: ${message}`); },
      settle,
    };
    run.snapshots.__start = { taps: 0, entry: entry(), dom: digest(), device: clone({ active: TF.device.active, revision: TF.device.revision, draft: TF.device.draft }) };
    try {
      run.returned = clone(await Promise.race([fn(api), new Promise((_, rej) => setTimeout(() => rej(new Error("journey timed out after 60 s")), 60000))]));
    } catch (e) { run.status = "error"; run.problems.push(`journey threw: ${String(e && e.message || e).slice(0, 300)}`); }
    await settle(120);
    run.final = { entry: entry(), dom: digest(), device: clone({ active: TF.device.active, revision: TF.device.revision, draft: TF.device.draft }) };
    run.untrustedClicks = untrusted;
    if (untrusted) run.problems.push(`${untrusted} programmatic click(s) outside the api (actions must go through api.tap/api.type)`);
    if (window.__tournamentErrors && window.__tournamentErrors.length) run.problems.push(...window.__tournamentErrors.map((e) => `runtime error: ${String(e).slice(0, 200)}`));
    if (run.status === "ok") {
      const check = (window.__journeyChecks || {})[id];
      if (!check) run.problems.push(`no verifier check for journey ${id}`);
      else { try { run.problems.push(...(check(run, { lang, policy: cand.policy || {}, cell: opts || {} }) || [])); } catch (e) { run.problems.push(`check threw: ${String(e && e.stack || e).slice(0, 300)}`); } }
    }
    if (run.problems.length && run.status === "ok") run.status = "fail";
    delete run.snapshots.__start?.dom?.text;
    return run;
  };
})();
