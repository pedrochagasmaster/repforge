import {createSummaryMarkup} from "../session-summary.js";

/** Completion presentation lifetime. Done/See/Escape dispatch explicit controller
 * actions; this module cannot finish a workout or choose the application route.
 * shell is the modal owner, with openModal/closeModal/activeModal contracts.
 */
export function createSessionSummary({ window, shell, copy, format, motion = null, onDone, onSeeSession }) {
  const document = window.document;
  const markup = createSummaryMarkup({ copy, format });
  const $ = selector => document.querySelector(selector);
  let current = null, ramp = null;

  function stopRamp() {
    if (!ramp) return;
    window.cancelAnimationFrame(ramp.raf);
    window.clearTimeout(ramp.land);
    ramp = null;
  }
  function rampStats(root) {
    stopRamp();
    const cells = [...(root?.querySelectorAll("[data-ramp]") || [])];
    if (!cells.length) return;
    const reduced = motion?.reducedMotion?.() ?? !!window.matchMedia?.("(prefers-reduced-motion:reduce)")?.matches;
    if (reduced || document.hidden) return;
    const targets = cells.map(el => ({ el, to: +el.dataset.ramp || 0, compact: el.dataset.kfmt === "1" }));
    const paint = progress => {
      for (const { el, to, compact } of targets)
        el.textContent = compact ? format.compact(to * progress) : format.number(Math.round(to * progress));
    };
    const run = { raf: 0, land: 0 };
    ramp = run;
    const finish = () => {
      if (ramp !== run) return;
      window.cancelAnimationFrame(run.raf);
      window.clearTimeout(run.land);
      ramp = null;
      paint(1);
    };
    paint(0);
    // rAF pauses in a background tab; the timer guarantees final displayed totals.
    run.land = window.setTimeout(finish, 1000);
    const start = window.performance.now();
    const step = now => {
      if (ramp !== run) return;
      const progress = Math.min(1, Math.max(0, (now - start) / 600));
      if (progress >= 1) return finish();
      paint(1 - Math.pow(1 - progress, 3));
      run.raf = window.requestAnimationFrame(step);
    };
    run.raf = window.requestAnimationFrame(step);
  }
  function render(model) {
    const body = $("#sessionSummaryBody");
    if (!body) return;
    stopRamp();
    body.innerHTML = markup.html(model);
    const done = $("#sumDone");
    if (done) done.onclick = () => onDone();
    const more = $("#sumMuscles");
    if (more) more.onclick = () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", open ? "true" : "false");
      more.textContent = copy.t(open ? "summary.muscles_fewer" : "summary.muscles_all", { n: more.dataset.total });
      $("#sessionSummary").querySelectorAll("[data-muscle-extra]").forEach(row => row.classList.toggle("hidden", !open));
    };
    const see = $("#sumSee");
    if (see) see.onclick = () => onSeeSession(model.session);
  }
  function open(model) {
    const element = $("#sessionSummary");
    if (!element) return false;
    current = model;
    render(model);
    if (!shell.openModal(element, { initialFocus: () => $("#sumTitle"), onEscape: () => onDone() })) {
      current = null;
      return false;
    }
    rampStats(element.querySelector(".sum-stats"));
    element.scrollTop = 0;
    return true;
  }
  function close() {
    current = null;
    stopRamp();
    const element = $("#sessionSummary");
    if (element && shell.activeModal?.el === element) return shell.closeModal(element);
    return Promise.resolve(false);
  }
  function clear() {
    close();
    $("#sessionSummaryBody")?.replaceChildren();
  }
  return Object.freeze({ open, close, clear, render, stopRamp, current: () => current, dispose: clear });
}
