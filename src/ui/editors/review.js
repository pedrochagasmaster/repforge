/** @typedef {import("./review-contracts.js").ProgramDefinition} ProgramDefinition */
/** @typedef {import("./review-contracts.js").ProgramDay} ProgramDay */
/** @typedef {import("./review-contracts.js").ProgramSlot} ProgramSlot */
/** @typedef {import("./review-contracts.js").ProgramSet} ProgramSet */
/** @typedef {import("./review-contracts.js").ReviewContext} ReviewContext */
/** @typedef {import("./review-contracts.js").ReviewEdit} ReviewEdit */
/** @typedef {import("./review-contracts.js").ReviewRead} ReviewRead */
/** @typedef {import("./review-contracts.js").ReviewAdapter} ReviewAdapter */
/** @typedef {import("./review-contracts.js").ReviewReceipt} ReviewReceipt */
/** @typedef {import("./review-contracts.js").ReviewSheet} ReviewSheet */
/** @typedef {import("./review-contracts.js").ReviewDrag} ReviewDrag */
/** @typedef {import("./review-contracts.js").ReviewSwipe} ReviewSwipe */
/** Mounted recommendation review. Authoring owns edit/replay policy; the host
 * owns the private setup session and commits. This instance owns DOM lifetime. */
import {review} from '../../training/authoring.js';
const {JOB_KEYS,REST_PRESETS,MIN_SETS,MAX_SETS,MAX_REPS,MAX_RIR,MAX_DAY_NAME,EDIT_KINDS,
  locateSlot:findSlot,slotsOf,repKey,recoveredBlock,catalogMetrics,needsExecutionMode,duplicateDayName,applyEdit,replay,changes}=review;
const EDIT_KIND_SET=new Set(EDIT_KINDS);
/** @template T @param {T[]} list */
const unique=list=>[...new Set(list)];
/** @param {{window:Window & typeof globalThis,motion?:Pick<ReturnType<typeof import("../../platform/motion.js").createMotion>,"animateExerciseReorder">|null}} options */
export function createProgramReview({window,motion=null}){
  const {Element,CSS}=window;
  const setTimeout=window.setTimeout.bind(window),clearTimeout=window.clearTimeout.bind(window);
  const ROLE_KEYS = Object.freeze(["PrimaryCompound", "SecondaryCompound", "Accessory"]);
  const SUGGESTED_SUBSTITUTIONS = 3;
  const MAX_SUBSTITUTIONS = 12;
  const ALTERNATE_SUGGESTIONS = 4;
  const TOAST_MS = 4200;

  /** @param {ReviewContext} ctx @param {ProgramDay} day */
  function minutesOf(ctx, day) {
    const seconds = ctx.compiler.estimateDaySeconds(day, undefined, ctx.catalog);
    return seconds > 0 ? Math.ceil(seconds / 60) : 0;
  }

  /** @param {HTMLElement} host @param {ReviewAdapter} adapter */
  function mountProgramReview(host, adapter) {
    const doc = host.ownerDocument;
    const view = adapter.view || {};
    const esc = adapter.esc;
    const t = adapter.t;
    // Figures in Plex Mono, words in the language font (R7 V-18).
    const nums = adapter.nums || esc;
    /** @type {Promise<boolean|void>} */
    let queue = Promise.resolve();
    /** @type {ReviewSheet|null} */
    let sheet = null;
    /** @type {HTMLElement|null} */
    let toastEl = null;let toastTimer = 0;
    let disposed = false;
    /** @type {Map<string,string[]>} */
    const subsCache = new Map();
    /** @type {Set<string>|null} */
    let repsOnly = null;

    const read = () => adapter.read();
    /** @param {string} message */
    const announce=message=>{if(!disposed)adapter.announce(message)};
    const activeTab=()=>view.tab??0;
    /** @param {ProgramDefinition} definition */
    const trainingIndex = (definition) => Math.max(0, definition.days.findIndex((day) => day.kind === "training"));
    /** @param {ProgramDefinition} definition @param {ProgramDay} day */
    const dayName = (definition, day) => adapter.dayName(day, definition);
    /** @param {ReviewRead} state */
    const editorContext = (state) => ({ ...state.ctx, dayName: /** @param {ProgramDay} day @param {ProgramDefinition} definition */ (day, definition) => dayName(definition, day) });
    /** @param {ProgramSet|null|undefined} set */
    const range = (set) => {const key=repKey(set?.targets),value=key?set?.targets?.[key]:null;return value&&typeof value==='object'?value:null};
    /** @param {ProgramSet} set */
    const repsText = (set) => {
      const value = range(set);
      if (!value) return "";
      const key = set.targets.repsPerSide ? "entry.review.reps_side" : "entry.review.reps";
      return t(key, { min: value.min, max: value.max });
    };
    /** @param {string} role */
    const roleLabel = (role) => {
      if (role === "manual") return t("entry.review.role.manual");
      const key = ROLE_KEYS.find((item) => String(role || "").endsWith(item));
      return key ? t(`entry.review.role.${key}`) : "";
    };
    /** @param {string} purposeId */
    const jobLabel = (purposeId) => {
      const key = JOB_KEYS.find((item) => String(purposeId || "").endsWith(item));
      return key ? t(`entry.review.job.${key}`) : "";
    };
    /** @param {ProgramSlot} slot */
    const muscles = (slot) => unique((slot.musclePurposeIds || []).map(adapter.muscleName).filter(Boolean)).slice(0, 4);
    /** @param {ProgramSlot} slot */
    const chips = (slot) => `<span class="review__chips">${muscles(slot).map((name) => `<span class="review__chip">${esc(name)}</span>`).join("")}</span>`;
    /** @param {string} name */
    const icon = (name) => `<span class="icon-mask icon-mask--${name} icon-mask--sm" aria-hidden="true"></span>`;

    /** @param {ProgramDefinition} definition @param {string} slotId */
    function substitutions(definition, slotId) {
      const at = findSlot(definition, slotId);
      if (!at) return [];
      const key = `${slotId}|${at.slot.exerciseId}|${JSON.stringify(definition.days.map((day) => (day.slots || []).map((slot) => slot.exerciseId)))}`;
      if (!subsCache.has(key)) {
        const ctx = read().ctx;
        subsCache.clear();
        subsCache.set(key, (ctx.compiler.findSubstitutions(definition, slotId, {}, ctx.catalog) || [])
          .map((item) => item.exerciseId).filter((id) => id !== at.slot.exerciseId).slice(0, MAX_SUBSTITUTIONS));
      }
      return subsCache.get(key)||[];
    }
    /* What the catalog picker may offer: movements that record reps. */
    /** @param {string} id */
    function recordsReps(id) {
      if (!repsOnly) {
        const ctx = read().ctx;
        repsOnly = new Set((ctx.catalog.exercises || []).filter((exercise) => catalogMetrics(ctx, exercise)).map((exercise) => exercise.id));
      }
      return repsOnly.has(id);
    }

    // ----- painting -----
    /** @param {ProgramDefinition} definition */
    function factsHtml(definition) {
      const training = definition.days.filter((day) => day.kind === "training");
      const ctx = read().ctx;
      const mins = training.filter((day) => (day.slots || []).length).map((day) => minutesOf(ctx, day));
      const exercises = training.reduce((n, day) => n + (day.slots || []).length, 0);
      const minutes = mins.length ? (Math.min(...mins) === Math.max(...mins) ? `${mins[0]}` : `${Math.min(...mins)}–${Math.max(...mins)}`) : "0";
      const cells = [
        [String(training.length), t(training.length === 1 ? "entry.facts.day_one" : "entry.facts.days")],
        [minutes, t("entry.facts.minutes")],
        [String(exercises), adapter.exerciseWord(exercises)],
        [String(definition.cycles), t(definition.cycles === 1 ? "entry.review.facts.week_one" : "entry.review.facts.weeks")],
      ];
      return `<p class="visually-hidden">${esc(cells.map(([value, unit]) => `${value} ${unit}`).join(" · "))}</p>` +
        `<div class="entry__strip review__facts" aria-hidden="true">${cells.map(([value, unit]) =>
          `<div class="entry__strip-cell"><span class="entry__strip-value">${esc(value)}</span><span class="entry__strip-unit">${esc(unit)}</span></div>`).join("")}</div>`;
    }
    /** @param {ProgramDefinition} definition */
    function regularCycles(definition) {
      return recoveredBlock(definition) ? definition.cycles - (definition.deloadCycles || []).length : definition.cycles;
    }
    /** @param {ProgramDefinition} definition */
    function blockHtml(definition) {
      const pattern = slotsOf(definition)[0]?.prescriptionsByCycle?.[0]?.sets?.[0]?.provenance?.periodization || "static";
      const deload = (definition.deloadCycles || [])[0];
      const regular = regularCycles(definition);
      const parts = [t(recoveredBlock(definition) ? "entry.review.block.regular_weeks"
        : definition.cycles === 1 ? "entry.review.block.week_one" : "entry.review.block.weeks", { n: regular }),
        t(`entry.review.block.pattern.${pattern}`)];
      if (deload) parts.push(t(recoveredBlock(definition) ? "entry.review.block.additional_deload" : "entry.review.block.deload", { n: deload }));
      // A host without changeBlock (a received shared program) keeps its block as received.
      const change = typeof adapter.changeBlock === "function"
        ? `<button type="button" class="text-link" data-review-block-edit>${esc(t("entry.review.block.change"))}</button>` : "";
      return `<div class="review__blockrow"><p class="review__block">${esc(parts.join(" · "))}</p>${change}</div>`;
    }
    /** @param {number} count */
    function changesHtml(count) {
      if (!count) return `<p class="review__hint">${esc(t("entry.review.tap_hint"))}</p>`;
      return `<div class="review__changes" data-review-changes role="status">` +
        `<span class="review__count" data-review-count><span class="review__dot" aria-hidden="true"></span>${esc(t(count === 1 ? "entry.review.changes_one" : "entry.review.changes", { n: count }))}</span>` +
        `<button type="button" class="text-link" data-review-undo>${esc(t("entry.review.undo"))}</button>` +
        `<button type="button" class="text-link" data-review-restore aria-label="${esc(t("entry.review.restore_aria"))}" aria-haspopup="dialog">${esc(t("entry.review.restore"))}</button></div>`;
    }
    /** @param {ProgramDefinition} definition */
    function tabsHtml(definition) {
      return `<div class="review__tabs" role="tablist" aria-label="${esc(t("entry.review.days"))}">${definition.days.map((day, index) => {
        const on = index === view.tab;
        const empty = day.kind === "training" && !(day.slots || []).length;
        const label = day.kind === "training" ? dayName(definition, day) : t("entry.review.rest_tab");
        return `<button type="button" role="tab" id="reviewTab${index}" class="review__tab${on ? " is-on" : ""}" data-review-tab="${index}" aria-selected="${on}" aria-controls="reviewPanel" tabindex="${on ? 0 : -1}">` +
          `${esc(label)}${empty ? `<span class="review__pip" aria-label="${esc(t("entry.review.empty_pip"))}"></span>` : ""}</button>`;
      }).join("")}</div>`;
    }
    // A slot the lifter renamed keeps that name (a received shared program, say);
    // a swap drops displayName, so the new movement reads its own name.
    /** @param {ProgramSlot} slot */
    function slotName(slot) {
      return typeof slot.displayName === "string" && slot.displayName.trim() ? slot.displayName : adapter.exerciseName(slot.exerciseId);
    }
    /** @param {ProgramDefinition} definition @param {ProgramSlot} slot @param {Record<string,string>} marks */
    function rowHtml(definition, slot, marks) {
      const state = read();
      const name = slotName(slot);
      const modeNeeded = needsExecutionMode(slot);
      const confirmed = Array.isArray(state.answers?.movementConfirmations?.[slot.exerciseId]) &&
        state.answers.movementConfirmations[slot.exerciseId].length > 0;
      const mark = confirmed ? t("entry.review.confirmed")
        : marks[slot.id] === "added" ? t("entry.review.mark.added") : marks[slot.id] ? t("entry.review.mark.edited") : "";
      const sets = slot.prescriptionsByCycle[0]?.sets || [];
      const rowLabel = modeNeeded ? `${name} · ${t("entry.review.execution_mode.cue")}` : name;
      const row = `<article class="review__row${mark ? " is-changed" : ""}" data-review-slot="${esc(slot.id)}" data-id="${esc(slot.id)}" role="button" tabindex="0" aria-label="${esc(rowLabel)}">` +
        adapter.tile(slot.exerciseId, "md") +
        `<div class="review__rowbody"><h3 class="review__name">${esc(name)}</h3>` +
        (mark ? `<span class="review__mark" data-review-mark><span class="review__dot" aria-hidden="true"></span>${esc(mark)}</span>` : "") +
        (modeNeeded ? `<p class="review__hint" data-review-execution-cue>${esc(t("entry.review.execution_mode.cue"))}</p>` : "") +
        `<ol class="review__sets">${sets.map((set, index) => `<li><span class="review__setn num">${index + 1}</span><span class="review__reps">${nums(repsText(set))}</span>` +
          (Number.isFinite(set.rir) ? `<span class="review__rir">${nums(t("entry.review.rir", { n: set.rir }))}</span>` : "") + `</li>`).join("")}</ol>` +
        chips(slot) + `</div>${icon("chev-right")}</article>`;
      if (confirmed) return row + `<div class="review__offer review__offer--confirmed" data-review-confirmed="${esc(slot.exerciseId)}">` +
        `<button type="button" class="text-link" data-review-confirmation-undo="${esc(slot.exerciseId)}">${esc(t("entry.review.undo"))}</button></div>`;
      const offer = (state.offers || []).find(item => item.slotId === slot.id);
      if (!offer) return row;
      const offeredName = adapter.exerciseName(offer.offeredExerciseId);
      const sentence = t("entry.review.confirm_offer", { exercise: "__EXERCISE__" });
      const [before, after] = sentence.split("__EXERCISE__");
      return row + `<div class="review__offer" data-review-confirm-offer="${esc(slot.id)}" data-review-offer-exercise-id="${esc(offer.offeredExerciseId)}">` +
        `<p>${esc(before)}<strong>${esc(offeredName)}</strong>${esc(after)}</p>` +
        `<button type="button" class="btn btn--steel" data-review-confirm-offer-action="${esc(slot.id)}">${esc(t("entry.review.confirm_offer_action"))}</button></div>`;
    }
    /** @param {ProgramDefinition} definition @param {Record<string,string>} marks */
    function dayHtml(definition, marks) {
      const day = definition.days[activeTab()];
      if (!day) return "";
      if (day.kind !== "training") {
        return `<div class="review__rest">${icon("clock")}<p class="review__rest-title">${esc(t("entry.review.rest_title"))}</p><p>${esc(t("entry.review.rest_body"))}</p></div>`;
      }
      const ctx = read().ctx, limit = read().sessionMinutes;
      const minutes = minutesOf(ctx, day), slots = day.slots || [];
      const over = limit && minutes > limit;
      const name = dayName(definition, day);
      const head = `<div class="review__dayhead"><div class="review__dayid">` +
        `<button type="button" class="review__dayname" data-review-day-name aria-label="${esc(t("entry.review.rename_day_aria", { day: name }))}">${esc(name)}${icon("pencil")}</button>` +
        `<p class="review__daymeta" data-review-day-minutes>${nums(`${adapter.exerciseCount(slots.length)} · ${t("entry.review.about_minutes", { n: minutes })}`)}</p>` +
        (over ? `<p class="review__over">${esc(t("entry.review.over", { n: limit }))}</p>` : "") + `</div>` +
        (view.reorder == null ? `<button type="button" class="review__more" data-review-day-menu aria-label="${esc(t("entry.review.day_menu_aria", { day: name }))}" aria-haspopup="dialog">${icon("overflow")}</button>` : "") +
        `</div>`;
      if (view.reorder === activeTab()) {
        return head + `<p class="review__hint">${esc(t("entry.review.reorder_hint"))}</p><ol class="review__reorder" data-review-reorder>` +
          slots.map((slot, index) => {
            const label = slotName(slot);
            return `<li class="review__ro" data-id="${esc(slot.id)}"><span class="review__handle" data-review-handle="${esc(slot.id)}" aria-hidden="true">${icon("grip")}</span>` +
              `<span class="review__ro-name">${esc(label)}</span>` +
              `<button type="button" class="review__ro-btn" data-review-reorder-move="${esc(slot.id)}:-1" aria-label="${esc(t("entry.review.move_up", { name: label }))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-reorder-move="${esc(slot.id)}:1" aria-label="${esc(t("entry.review.move_down", { name: label }))}"${index === slots.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button></li>`;
          }).join("") + `</ol><button type="button" class="btn btn--cta btn--noarrow review__reorder-done" data-review-reorder-done>${esc(t("entry.review.reorder_done"))}</button>`;
      }
      const empty = slots.length ? "" : `<p class="review__empty" data-review-empty role="alert">${icon("alert")}<span>${esc(t("entry.review.empty_day"))}</span></p>`;
      return head + empty + slots.map((slot) => rowHtml(definition, slot, marks)).join("") +
        `<button type="button" class="review__add" data-review-add>${icon("plus")}<span>${esc(t("entry.review.add"))}</span></button>`;
    }

    /** @param {{before?:Map<string,DOMRect>|null,focus?:string|null}} [options] */
    function paint({ before = null, focus = null } = {}) {
      if (disposed) return;
      const state = read();
      const definition = state.definition;
      if (view.tab == null || view.tab >= definition.days.length) view.tab = trainingIndex(definition);
      const count = changes(state.baseline, definition).count;
      const marks = changes(state.baseline, definition).slots;
      const name = state.name;
      host.innerHTML = `<div class="review" data-review>` +
        `<p class="entry__eyebrow review__kicker">${esc(t("entry.review.source"))}</p>` +
        `<h2 class="onb__q review__title" id="entryHeading" tabindex="-1"><button type="button" class="review__titlebtn" data-review-title aria-label="${esc(t("entry.review.rename_program_aria", { name }))}">` +
        `<span>${esc(name)}</span>${icon("pencil")}</button></h2>` +
        factsHtml(definition) + blockHtml(definition) + changesHtml(count) + tabsHtml(definition) +
        `<div class="review__panel" id="reviewPanel" role="tabpanel" aria-labelledby="reviewTab${view.tab}" data-review-panel>${dayHtml(definition, marks)}</div></div>`;
      placeIndicator(false);
      if (before) motion?.animateExerciseReorder?.([.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll("[data-id]"))], before);
      const target = focus && host.querySelector(focus);
      if (target instanceof window.HTMLElement) target.focus({ preventScroll: true });
      adapter.changed?.();
    }
    function measure() {
      return new Map([.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll("[data-id]"))].map((row) => [row.dataset.id||'', row.getBoundingClientRect()]));
    }
    /* The shown day's tab is scrolled into the middle of the row. Its selected
       boundary is its own, like every tab row (no travelling indicator). */
    /** @param {boolean} animate */
    function placeIndicator(animate) {
      const bar = /** @type {HTMLElement|null} */ (host.querySelector(".review__tabs")), on = /** @type {HTMLElement|null} */ (host.querySelector(".review__tab.is-on"));
      if (!bar || !on) return;
      const left = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
      bar.scrollTo?.({ left, behavior: animate && !adapter.reducedMotion() ? "smooth" : "auto" });
    }
    /** @param {number} index */
    function setTab(index) {
      const definition = read().definition;
      if (index < 0 || index >= definition.days.length || index === view.tab || view.reorder != null) return;
      view.tab = index;
      const marks = changes(read().baseline, definition).slots;
      /** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll("[data-review-tab]")).forEach((tab) => {
        const on = Number(tab.dataset.reviewTab) === index;
        tab.classList.toggle("is-on", on);
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      const panel = /** @type {HTMLElement|null} */ (host.querySelector("[data-review-panel]"));
      if(!panel)return;
      panel.setAttribute("aria-labelledby", `reviewTab${index}`);
      panel.innerHTML = dayHtml(definition, marks);
      placeIndicator(true);
    }

    // ----- edits -----
    /* Edits run one at a time, each on the document the previous one left.
       While any is in flight the host says so, for assistive tech and tests. */
    let inFlight = 0;
    /** @param {()=>Promise<boolean>} task */
    function run(task) {
      if(disposed)return Promise.resolve(false);
      inFlight++;
      host.setAttribute("aria-busy", "true");
      const settle = () => { if (--inFlight === 0&&!disposed) host.removeAttribute("aria-busy"); };
      const execute=()=>disposed?false:task();
      queue = queue.then(execute, execute).finally(settle);
      return queue;
    }
    /* What the lifter did, for the host's measurement: an action and the edit
       kind, never the edit's content. */
    /** @param {string} action @param {unknown} [kind] */
    function observe(action, kind) {
      if(disposed)return;
      try { adapter.observe?.(typeof kind==='string' && EDIT_KIND_SET.has(kind) ? { action, kind } : { action }); } catch {}
    }
    /** @param {ReviewEdit} edit @param {{toast?:string|null,flip?:boolean,close?:boolean}} [options] */
    function apply(edit, { toast = null, flip = false, close = false } = {}) {
      return run(async () => {
        if (disposed) return false;
        const state = read();
        const result = applyEdit(state.definition, edit, { ...editorContext(state), ordinal: state.edits.length + 1 });
        if (!result.ok) { observe("refused", edit.kind); announce(t("entry.review.refused")); return false; }
        const before = flip ? measure() : null;
        if (close) await closeSheet();
        if(disposed)return false;
        const saved = await adapter.commit({ definition: result.definition, edits: [...state.edits, edit], name: state.name });
        if(disposed)return saved?.ok===true;
        if (!saved?.ok) { observe("save_failed", edit.kind); announce(t("entry.review.save_failed")); paint(); paintSheet(); return false; }
        observe("edit", edit.kind);
        paint({ before });
        paintSheet();
        const count = changes(read().baseline, read().definition).count;
        if (toast) showToast(toast);
        else announce(t(count === 1 ? "entry.review.changes_one" : "entry.review.changes", { n: count }));
        return true;
      });
    }
    function undo() {
      return run(async () => {
        const state = read();
        if (!state.edits.length) return false;
        const edits = state.edits.slice(0, -1);
        const replayed = replay(state.baseline, edits, editorContext(state));
        if (!replayed.ok) return false;
        const before = measure();
        const saved = await adapter.commit({ definition: replayed.definition, edits, name: state.name });
        if(disposed)return saved?.ok===true;
        if (!saved?.ok) { observe("save_failed", state.edits[state.edits.length - 1]?.kind); announce(t("entry.review.save_failed")); return false; }
        observe("undo", state.edits[state.edits.length - 1]?.kind);
        hideToast();
        paint({ before });
        paintSheet();
        announce(t("entry.review.toast.undone"));
        return true;
      });
    }
    async function restore() {
      const state = read();
      const count = changes(state.baseline, state.definition).count;
      const confirmed = await adapter.confirm({
        title: t("entry.review.restore_title"),
        body: t(count === 1 ? "entry.review.restore_body_one" : "entry.review.restore_body", { n: count }),
        go: t("entry.review.restore_go"), keep: t("entry.review.keep"),
      });
      if (!confirmed) return false;
      return run(async () => {
        const current = read();
        const saved = await adapter.commit({ definition: current.baseline, edits: [], name: null });
        if(disposed)return saved?.ok===true;
        if (!saved?.ok) { observe("save_failed"); announce(t("entry.review.save_failed")); return false; }
        observe("restore");
        view.reorder = null;
        paint({ focus: "[data-review-title]" });
        announce(t("entry.review.toast.restored"));
        return true;
      });
    }

    // ----- toast -----
    /** @param {string} text */
    function showToast(text) {
      if(disposed)return;
      hideToast();
      toastEl = doc.createElement("div");
      toastEl.className = "review-toast";
      toastEl.setAttribute("role", "status");
      toastEl.innerHTML = `<span class="review-toast__text">${esc(text)}</span><button type="button" class="review-toast__undo" data-review-toast-undo>${esc(t("entry.review.undo"))}</button>`;
      /** @type {HTMLElement|null} */ (toastEl.querySelector("[data-review-toast-undo]"))?.addEventListener("click", () => { hideToast(); undo(); });
      doc.body.append(toastEl);
      toastTimer = setTimeout(hideToast, TOAST_MS);
    }
    function hideToast() {
      clearTimeout(toastTimer);
      toastEl?.remove();
      toastEl = null;
    }

    // ----- sheets -----
    /** @param {string} slotId */
    function exerciseSheet(slotId) {
      sheet = { kind: "exercise", slotId, showAll: false };
      openSheet();
    }
    function openSheet() {
      if(disposed)return;
      const parts = adapter.sheet();
      paintSheet();
      adapter.openSheet({ onClose: () => { sheet = null; } });
      if (sheet?.kind === "rename") {
        const input = /** @type {HTMLInputElement|null} */ (parts.body.querySelector("#reviewRenameInput"));
        input?.focus();
        input?.select();
      }
    }
    async function closeSheet() {
      if (!sheet) return;
      sheet = null;
      await adapter.closeSheet();
    }
    function paintSheet() {
      if (!sheet || disposed) return;
      const parts = adapter.sheet();
      const state = read(), definition = state.definition;
      if (sheet.kind === "block") {
        const currentSheet=sheet;
        const patterns = ["static", "linear", "reverse_linear", "undulating"];
        parts.title.textContent = t("entry.review.block.sheet.title");
        parts.body.innerHTML =
          `<section class="review-sheet__sec review-block__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.block.sheet.length"))}</h3>` +
          (sheet.fixedCycles
            ? `<p class="num" data-review-block-weeks>${esc(t("entry.review.block.regular_weeks", { n: sheet.cycles }))}</p>`
            : `<div class="review-step review-block__stepper"><button type="button" data-review-block-step="-1" aria-label="−"${sheet.cycles <= 4 ? " disabled" : ""}>−</button>` +
              `<b class="num" data-review-block-weeks>${esc(t(sheet.cycles === 1 ? "entry.review.block.week_one" : "entry.review.block.weeks", { n: sheet.cycles }))}</b>` +
              `<button type="button" data-review-block-step="1" aria-label="+"${sheet.cycles >= 12 ? " disabled" : ""}>+</button></div>`) +
          `<p class="review-sheet__lede">${esc(t(sheet.fixedCycles ? "entry.review.block.sheet.fixed_length_hint" : "entry.review.block.sheet.length_hint"))}</p></section>` +
          `<section class="review-sheet__sec review-block__sec"><h3 class="sheetgroup__head" id="reviewBlockPatternLab">${esc(t("entry.review.block.sheet.pattern"))}</h3>` +
          `<div class="review-block__patterns" role="radiogroup" aria-labelledby="reviewBlockPatternLab">${patterns.map((pattern) => {
            const selected = pattern === currentSheet.periodization;
            return `<button type="button" class="radio-card${selected ? " is-selected" : ""}" role="radio" aria-checked="${selected}" tabindex="${selected ? 0 : -1}" data-review-block-pattern="${pattern}">` +
              `<span class="radio-card__body"><span class="radio-card__title">${esc(t(`entry.review.block.card.${pattern}.title`))}</span>` +
              `<span class="radio-card__cap">${esc(t(`entry.review.block.card.${pattern}.hint`))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`;
          }).join("")}</div></section>` +
          `<div class="review-block__deload"><span class="review-block__copy"><strong>${esc(t(sheet.fixedCycles ? "entry.deload.card" : "entry.review.block.manual_deload_card"))}</strong><span>${esc(t(sheet.fixedCycles ? "entry.deload.body" : "entry.review.block.manual_deload_body"))}</span></span>` +
          `<button type="button" class="toggle" role="switch" aria-label="${esc(t(sheet.fixedCycles ? "entry.deload.card" : "entry.review.block.manual_deload_card"))}" aria-checked="${sheet.deload}" data-review-block-deload></button></div>`;
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-review-block-apply>${esc(t("entry.review.block.apply"))}</button>`;
      } else if (sheet.kind === "exercise") {
        const at = findSlot(definition, sheet.slotId);
        if (!at) { closeSheet(); return; }
        const slot = at.slot, sets = slot.prescriptionsByCycle[0].sets, first = range(sets[0]);
        const base = (state.baseline.days.find((day) => day.id === at.day.id));
        const was = base ? minutesOf(state.ctx, base) : minutesOf(state.ctx, at.day);
        const now = minutesOf(state.ctx, at.day);
        const deload = (definition.deloadCycles || []).length > 0;
        const subs = substitutions(definition, slot.id);
        const shown = sheet.showAll ? subs : subs.slice(0, SUGGESTED_SUBSTITUTIONS);
        const alternates = slot.alternates || [];
        const max = state.ctx.compiler.MAX_SLOT_ALTERNATES || 5;
        const suggestions = subs.filter((id) => !alternates.includes(id)).slice(0, ALTERNATE_SUGGESTIONS);
        const others = definition.days.filter((day) => day.kind === "training" && day.id !== at.day.id);
        const rest = sets[0]?.restSeconds;
        const modeNeeded = needsExecutionMode(slot);
        const name = slotName(slot);
        parts.title.textContent = name;
        parts.body.innerHTML =
          `<div class="review-sheet__head">${adapter.tile(slot.exerciseId, "lg")}<div><p class="review-sheet__role">${esc([roleLabel(slot.role), jobLabel(slot.purposeId)].filter(Boolean).join(" · "))}</p>${chips(slot)}</div></div>` +
          (modeNeeded ? `<section class="review-sheet__sec"><h3 class="sheetgroup__head" id="reviewExecutionModeQuestion" data-review-execution-question>${esc(t("entry.review.execution_mode.question"))}</h3>` +
            `<div class="review-block__patterns" role="group" aria-labelledby="reviewExecutionModeQuestion">` +
            [["bilateral", "entry.review.execution_mode.bilateral"], ["unilateral", "entry.review.execution_mode.unilateral"]].map(([mode, key]) =>
              `<button type="button" class="radio-card" data-review-execution-mode="${mode}"><span class="radio-card__body"><span class="radio-card__title">${esc(t(key))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`).join("") +
            `</div></section>` : "") +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.sets"))}</h3>` +
          `<div class="review-sheet__ledger" role="table" aria-label="${esc(t("entry.review.sheet.sets"))}"><div class="review-sheet__lh" role="row"><span role="columnheader">${esc(t("entry.review.sheet.set_col"))}</span><span role="columnheader">${esc(t("entry.review.sheet.reps_col"))}</span><span role="columnheader">${esc(t("entry.review.sheet.rir_col"))}</span></div>` +
          sets.map((set, index) => `<div class="review-sheet__lr" role="row"><span class="review__setn num" role="cell">${index + 1}</span><span role="cell">${nums(repsText(set))}</span>` +
            `<span class="review-step review-step--sm" role="cell"><button type="button" data-review-rir="${index + 1}:-1" aria-label="${esc(t("entry.review.sheet.rir_down", { n: index + 1 }))}"${!((set.rir??0) > 0) ? " disabled" : ""}>−</button><b class="num">${esc(String(set.rir ?? "–"))}</b>` +
            `<button type="button" data-review-rir="${index + 1}:1" aria-label="${esc(t("entry.review.sheet.rir_up", { n: index + 1 }))}"${!((set.rir??0) < MAX_RIR) ? " disabled" : ""}>+</button></span></div>`).join("") + `</div>` +
          `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(t("entry.review.sheet.sets"))}</span><span class="review-step"><button type="button" data-review-sets="-1" aria-label="${esc(t("entry.review.sheet.fewer"))}"${sets.length <= MIN_SETS ? " disabled" : ""}>−</button>` +
          `<b class="num">${esc(t(sets.length === 1 ? "entry.review.sheet.n_sets_one" : "entry.review.sheet.n_sets", { n: sets.length }))}</b><button type="button" data-review-sets="1" aria-label="${esc(t("entry.review.sheet.more"))}"${sets.length >= MAX_SETS ? " disabled" : ""}>+</button></span></div>` +
          (first ? `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(t("entry.review.sheet.range"))}</span><span class="review-sheet__range">` +
            `<span class="review-step review-step--sm"><button type="button" data-review-min="-1" aria-label="${esc(t("entry.review.sheet.min_down"))}"${first.min <= 1 ? " disabled" : ""}>−</button><b class="num">${first.min}</b><button type="button" data-review-min="1" aria-label="${esc(t("entry.review.sheet.min_up"))}"${first.min >= first.max ? " disabled" : ""}>+</button></span>` +
            `<span aria-hidden="true">–</span><span class="review-step review-step--sm"><button type="button" data-review-max="-1" aria-label="${esc(t("entry.review.sheet.max_down"))}"${first.max <= first.min ? " disabled" : ""}>−</button><b class="num">${first.max}</b><button type="button" data-review-max="1" aria-label="${esc(t("entry.review.sheet.max_up"))}"${first.max >= MAX_REPS ? " disabled" : ""}>+</button></span></span></div>` : "") +
          `<div class="review-sheet__ctl review-sheet__ctl--col"><span class="review-sheet__lab" id="reviewRestLab">${esc(t("entry.review.sheet.rest"))}</span><div class="review-seg" role="radiogroup" aria-labelledby="reviewRestLab">` +
          REST_PRESETS.map((seconds) => `<button type="button" role="radio" class="review-seg__opt num${seconds === rest ? " is-on" : ""}" aria-checked="${seconds === rest}" data-review-rest="${seconds}">${esc(t("entry.review.sheet.seconds", { n: seconds }))}</button>`).join("") + `</div></div>` +
          `<p class="review-sheet__time" data-review-day-time>${nums(was === now ? t("entry.review.sheet.day_time", { n: now }) : t("entry.review.sheet.day_time_change", { from: was, to: now }))}` +
          `${state.sessionMinutes && now > state.sessionMinutes ? ` · ${nums(t("entry.review.over", { n: state.sessionMinutes }))}` : ""}</p>` +
          (deload ? `<p class="review-sheet__note">${esc(t("entry.review.sheet.deload_note"))}</p>` : "") + `</section>` +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.swap"))}</h3>` +
          (subs.length ? `<p class="review-sheet__lede">${esc(t("entry.review.sheet.swap_lede"))}</p><ul class="review-sheet__list">${shown.map((id) =>
            `<li>${adapter.tile(id, "sm")}<span>${esc(adapter.exerciseName(id))}</span><button type="button" class="btn btn--steel review-sheet__swap-btn" data-review-swap="${esc(id)}">${esc(t("entry.review.sheet.swap_btn"))}</button></li>`).join("")}</ul>` : "") +
          `<div class="review-sheet__links">${!sheet.showAll && subs.length > SUGGESTED_SUBSTITUTIONS ? `<button type="button" class="text-link" data-review-more-subs>${esc(t("entry.review.sheet.show_more", { n: subs.length - SUGGESTED_SUBSTITUTIONS }))}</button>` : ""}` +
          `<button type="button" class="text-link" data-review-search>${icon("search")}${esc(t("entry.review.sheet.search"))}</button></div></section>` +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.alts"))}</h3><p class="review-sheet__lede">${esc(t("entry.review.sheet.alts_lede"))}</p>` +
          (alternates.length ? `<ol class="review-sheet__alts">${alternates.map((id, index) => {
            const label = adapter.exerciseName(id);
            return `<li><span class="review__setn">${index + 1}</span><span class="review-sheet__alt-name">${esc(label)}</span>` +
              `<button type="button" class="review__ro-btn" data-review-alt-move="${esc(id)}:-1" aria-label="${esc(t("entry.review.move_up", { name: label }))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-alt-move="${esc(id)}:1" aria-label="${esc(t("entry.review.move_down", { name: label }))}"${index === alternates.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-alt-remove="${esc(id)}" aria-label="${esc(t("entry.review.sheet.alt_remove", { name: label }))}">${icon("close")}</button></li>`;
          }).join("")}</ol>` : `<p class="review-sheet__empty">${esc(t("entry.review.sheet.alts_none"))}</p>`) +
          (alternates.length < max ? (suggestions.length ? `<p class="review-sheet__sub">${esc(t("entry.review.sheet.alts_add"))}</p><div class="review-sheet__chips">${suggestions.map((id) =>
            `<button type="button" class="review-chipbtn" data-review-alt-add="${esc(id)}">${icon("plus")}${esc(adapter.exerciseName(id))}</button>`).join("")}</div>` : "")
            : `<p class="review-sheet__empty">${esc(t("entry.review.sheet.alts_full", { n: max }))}</p>`) + `</section>` +
          (others.length ? `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.move"))}</h3><div class="review-sheet__chips">${others.map((day) =>
            `<button type="button" class="review-chipbtn" data-review-move-to="${esc(day.id)}">${esc(dayName(definition, day))}</button>`).join("")}</div></section>` : "") +
          `<section class="review-sheet__sec"><button type="button" class="btn btn--steel btn--destructive" data-review-remove>${esc(t("entry.review.sheet.remove"))}</button></section>`;
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-review-done>${esc(t("entry.review.sheet.done"))}</button>`;
      } else if (sheet.kind === "day") {
        const day = definition.days[activeTab()];
        parts.title.textContent = dayName(definition, day);
        parts.body.innerHTML = `<div class="review-sheet__menu">` +
          `<button type="button" class="exactions__act" data-review-day-action="rename">${icon("pencil")}<span>${esc(t("entry.review.day_menu.rename"))}</span></button>` +
          `<button type="button" class="exactions__act" data-review-day-action="reorder"${(day.slots || []).length < 2 ? " disabled" : ""}>${icon("grip")}<span>${esc(t("entry.review.day_menu.reorder"))}</span></button>` +
          `<button type="button" class="exactions__act" data-review-day-action="add">${icon("plus")}<span>${esc(t("entry.review.day_menu.add"))}</span></button></div>`;
        parts.foot.innerHTML = "";
      } else if (sheet.kind === "rename") {
        const isDay = sheet.target === "day";
        const value = isDay ? dayName(definition, definition.days[activeTab()]) : state.name;
        const inputValue = sheet.inputValue ?? value;
        const errorAttrs = sheet.error ? ' aria-invalid="true" aria-describedby="reviewRenameError"' : "";
        parts.title.textContent = t(isDay ? "entry.review.day_menu.rename" : "entry.review.rename_program");
        parts.body.innerHTML = `<label class="field review-sheet__field"><span class="field__lab">${esc(t(isDay ? "entry.review.day_name" : "entry.review.program_name"))}</span>` +
          `<input class="input" id="reviewRenameInput" maxlength="${isDay ? MAX_DAY_NAME : 60}" value="${esc(inputValue)}"${errorAttrs} enterkeyhint="done" autocomplete="off"></label>` +
          (sheet.error ? `<p class="program-editor__field-error" id="reviewRenameError" role="alert">${esc(sheet.error)}</p>` : "");
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-review-rename-save>${esc(t("entry.review.save"))}</button>`;
      }
    }

    /** @param {string} mode @param {string|null} [slotId] */
    async function pick(mode, slotId = null) {
      const state = read(), definition = state.definition;
      const at = slotId ? findSlot(definition, slotId) : null;
      const used = new Set(slotsOf(definition).filter((slot) => slot.role !== "manual" && slot.id !== slotId).map((slot) => slot.exerciseId));
      if (at) used.add(at.slot.exerciseId);
      await closeSheet();
      if(disposed)return;
      const choice = await adapter.pickExercise({
        mode, day: definition.days[activeTab()], exercise: at?.slot || null,
        accept: (candidate) => recordsReps(candidate) && (mode !== "replace" || !used.has(candidate)),
      });
      const id=choice;
      if(disposed)return;
      if (!id) return;
      if (mode === "add") {
        const day = definition.days[activeTab()];
        apply({ kind: "add", dayId: day.id, exerciseId: id }, { toast: t("entry.review.toast.added", { name: adapter.exerciseName(id) }), flip: true });
      } else {
        apply({ kind: "swap", slotId, exerciseId: id }, { toast: t("entry.review.toast.swapped", { name: adapter.exerciseName(id) }) });
      }
    }

    /** @param {MouseEvent} event */
    function onSheetClick(event) {
      if (!sheet) return;
      const target = event.target instanceof Element ? event.target : null;
      /** @param {string} selector */
      const hit = (selector) => {const element=target?.closest(selector);return element instanceof window.HTMLElement?element:null};
      const state = read();
      if (hit("[data-review-done]")) { closeSheet(); return; }
      if (sheet.kind === "block") {
        /** @type {HTMLElement|null|undefined} */
        let button;
        if ((button = hit("[data-review-block-step]"))) {
          if (sheet.fixedCycles) return;
          sheet.cycles = Math.max(4, Math.min(12, sheet.cycles + Number(button.dataset.reviewBlockStep)));
          const body = adapter.sheet().body;
          const weeks=body.querySelector("[data-review-block-weeks]");if(weeks)weeks.textContent=t("entry.review.block.weeks",{n:sheet.cycles});
          const stepDown=body.querySelector('[data-review-block-step="-1"]');if(stepDown instanceof window.HTMLButtonElement)stepDown.disabled=sheet.cycles <= 4;
          const stepUp=body.querySelector('[data-review-block-step="1"]');if(stepUp instanceof window.HTMLButtonElement)stepUp.disabled=sheet.cycles >= 12;
        } else if ((button = hit("[data-review-block-pattern]"))) {
          sheet.periodization = button.dataset.reviewBlockPattern||'static';
          /** @type {NodeListOf<HTMLElement>} */ (adapter.sheet().body.querySelectorAll("[data-review-block-pattern]")).forEach((option) => {
            const selected = option === button;
            option.classList.toggle("is-selected", selected);
            option.setAttribute("aria-checked", String(selected));
            option.tabIndex = selected ? 0 : -1;
          });
        } else if (hit("[data-review-block-deload]")) {
          sheet.deload = !sheet.deload;
          /** @type {HTMLElement|null} */ (adapter.sheet().body.querySelector("[data-review-block-deload]"))?.setAttribute("aria-checked", String(sheet.deload));
        } else if (hit("[data-review-block-apply]")) {
          const next = { block: { cycles: sheet.cycles, periodization: sheet.periodization }, deload: sheet.deload };
          const definition = state.definition, answers = state.answers || {};
          const current = {
            cycles: recoveredBlock(definition) ? 7 : typeof answers.block?.cycles==='number'&&Number.isInteger(answers.block.cycles) ? answers.block.cycles : definition.cycles,
            periodization: answers.block?.periodization || slotsOf(definition)[0]?.prescriptionsByCycle?.[0]?.sets?.[0]?.provenance?.periodization || "static",
            deload: typeof answers.deload === "boolean" ? answers.deload : recoveredBlock(definition)
              ? (definition.deloadCycles || []).length > 0 : (definition.deloadCycles || []).includes(definition.cycles),
          };
          if (next.block.cycles === current.cycles && next.block.periodization === current.periodization && next.deload === current.deload) {
            closeSheet();
            return;
          }
          closeSheet().then(async () => {
            if(disposed)return;
            const outcome = await adapter.changeBlock?.(next);
            if (outcome?.ok || outcome?.cancelled || outcome?.superseded) return;
            announce(outcome?.message || t("entry.review.save_failed"));
          });
        }
        return;
      }
      if (sheet.kind === "rename") {
        if (hit("[data-review-rename-save]")) saveRename();
        return;
      }
      if (sheet.kind === "day") {
        const action = hit("[data-review-day-action]")?.dataset.reviewDayAction;
        if (action === "rename") { sheet = { kind: "rename", target: "day" }; paintSheet(); const input = /** @type {HTMLInputElement|null} */ (adapter.sheet().body.querySelector("#reviewRenameInput")); input?.focus(); input?.select(); }
        if (action === "reorder") { closeSheet().then(() => { view.reorder = view.tab; paint({ focus: "[data-review-reorder-move]:not([disabled])" }); }); }
        if (action === "add") pick("add");
        return;
      }
      const at = findSlot(state.definition, sheet.slotId);
      if (!at) return;
      const slot = at.slot, sets = slot.prescriptionsByCycle[0].sets, first = range(sets[0]);
      /** @type {HTMLElement|null|undefined} */
        let button;
      if ((button = hit("[data-review-execution-mode]"))) {
        apply({ kind: "execution_mode", slotId: slot.id, executionMode: button.dataset.reviewExecutionMode });
      } else if ((button = hit("[data-review-sets]"))) apply({ kind: "sets", slotId: slot.id, count: sets.length + Number(button.dataset.reviewSets) });
      else if ((button = hit("[data-review-rir]"))) {
        const [setIndex, dir] = (button.dataset.reviewRir||'').split(":").map(Number);
        apply({ kind: "rir", slotId: slot.id, setIndex, rir: (sets[setIndex - 1].rir ?? 2) + dir });
      } else if ((button = hit("[data-review-min]"))&&first) apply({ kind: "rep_range", slotId: slot.id, min: first.min + Number(button.dataset.reviewMin), max: first.max });
      else if ((button = hit("[data-review-max]"))&&first) apply({ kind: "rep_range", slotId: slot.id, min: first.min, max: first.max + Number(button.dataset.reviewMax) });
      else if ((button = hit("[data-review-rest]"))) {
        const seconds = Number(button.dataset.reviewRest);
        if (seconds !== sets[0].restSeconds) apply({ kind: "rest", slotId: slot.id, seconds });
      } else if ((button = hit("[data-review-swap]"))) {
        const id = button.dataset.reviewSwap||'';
        apply({ kind: "swap", slotId: slot.id, exerciseId: id }, { toast: t("entry.review.toast.swapped", { name: adapter.exerciseName(id) }) });
      } else if (hit("[data-review-more-subs]")) { sheet.showAll = true; paintSheet(); }
      else if (hit("[data-review-search]")) pick("replace", slot.id);
      else if ((button = hit("[data-review-alt-add]"))) apply({ kind: "alternates", slotId: slot.id, alternates: [...(slot.alternates || []), button.dataset.reviewAltAdd] });
      else if ((button = hit("[data-review-alt-remove]"))) apply({ kind: "alternates", slotId: slot.id, alternates: (slot.alternates || []).filter((id) => id !== button?.dataset.reviewAltRemove) });
      else if ((button = hit("[data-review-alt-move]"))) {
        const [id, dir] = (button.dataset.reviewAltMove||'').split(":");
        const list = [...(slot.alternates || [])], from = list.indexOf(id), to = from + Number(dir);
        if (from < 0 || to < 0 || to >= list.length) return;
        [list[from], list[to]] = [list[to], list[from]];
        apply({ kind: "alternates", slotId: slot.id, alternates: list });
      } else if ((button = hit("[data-review-move-to]"))) {
        const day = state.definition.days.find((item) => item.id === button?.dataset.reviewMoveTo);if(!day)return;
        apply({ kind: "move", slotId: slot.id, toDayId: day.id }, { toast: t("entry.review.toast.moved", { day: dayName(state.definition, day) }), flip: true, close: true });
      } else if (hit("[data-review-remove]")) {
        apply({ kind: "remove", slotId: slot.id }, { toast: t("entry.review.toast.removed", { name: adapter.exerciseName(slot.exerciseId) }), flip: true, close: true });
      }
    }
    /** @param {KeyboardEvent} event */
    function onSheetKey(event) {
      if (sheet?.kind === "rename" && event.key === "Enter" && event.target instanceof window.HTMLInputElement && event.target.id === "reviewRenameInput") { event.preventDefault(); saveRename(); }
      if (sheet?.kind === "block" && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key) &&
        event.target instanceof Element && event.target.closest("[data-review-block-pattern]")) {
        event.preventDefault();
        const options = [.../** @type {NodeListOf<HTMLElement>} */ (adapter.sheet().body.querySelectorAll("[data-review-block-pattern]"))];
        const target=event.target instanceof window.HTMLElement?event.target.closest("[data-review-block-pattern]"):null;
        const index = options.findIndex(option=>option===target);
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const next = options[(index + step + options.length) % options.length];
        next.click();
        next.focus();
      }
    }
    /** @param {Event} event */
    function onSheetInput(event) {
      const input = event.target;
      if(!(input instanceof window.HTMLInputElement))return;
      if (sheet?.kind !== "rename" || input?.id !== "reviewRenameInput") return;
      sheet.inputValue = input.value;
      if (!sheet.error) return;
      sheet.error = null;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      /** @type {HTMLElement|null} */ (adapter.sheet().body.querySelector("#reviewRenameError"))?.remove();
    }
    async function saveRename() {
      if(sheet?.kind!=='rename')return;
      const input = /** @type {HTMLInputElement|null} */ (adapter.sheet().body.querySelector("#reviewRenameInput"));
      const value = String(input?.value || "").trim();
      const state = read(), target = sheet.target;
      if (target === "day") {
        const day = state.definition.days[activeTab()];
        if (!value || value === dayName(state.definition, day) || value === String(day?.name || "").trim()) {
          await closeSheet();
          return;
        }
        if (duplicateDayName(state.definition, day, value, editorContext(state))) {
          const caret = input?.selectionStart ?? value.length;
          sheet.inputValue = value;
          sheet.error = t("toast.day_name_exists");
          paintSheet();
          const next = /** @type {HTMLInputElement|null} */ (adapter.sheet().body.querySelector("#reviewRenameInput"));
          next?.focus({ preventScroll: true });
          next?.setSelectionRange?.(caret, caret);
          return;
        }
        await closeSheet();
        apply({ kind: "day_name", dayId: day.id, name: value });
      } else {
        await closeSheet();
        if (!value || value === state.name) return;
        run(async () => {
          const current = read();
          const saved = await adapter.commit({ definition: current.definition, edits: current.edits, name: value });
          if (saved?.ok) { observe("rename_program"); paint({ focus: "[data-review-title]" }); }
          return !!saved?.ok;
        });
      }
    }

    // ----- the page -----
    /** @param {MouseEvent} event */
    function onClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      /** @param {string} selector */
      const hit = (selector) => {const element=target?.closest(selector);return element instanceof window.HTMLElement?element:null};
      /** @type {HTMLElement|null|undefined} */
      let el;
      if ((el = hit("[data-review-tab]"))) { setTab(Number(el.dataset.reviewTab)); return; }
      if ((el = hit("[data-review-confirm-offer-action]"))) {
        const action=el;
        const offer = read().offers?.find(item => item.slotId === action.dataset.reviewConfirmOfferAction);
        if (!offer) return;
        el.setAttribute('disabled','');
        run(async () => {
          const outcome = await adapter.confirmOffer?.(offer);
          if (outcome?.ok || outcome?.superseded) return true;
          if (!outcome?.cancelled) announce(outcome?.message || t("entry.review.save_failed"));
          if (action.isConnected) action.removeAttribute('disabled');
          return false;
        });
        return;
      }
      if ((el = hit("[data-review-confirmation-undo]"))) {
        const action=el;
        el.setAttribute('disabled','');
        run(async () => {
          const outcome = await adapter.undoConfirmation?.(action.dataset.reviewConfirmationUndo||'');
          if (outcome?.ok || outcome?.superseded) return true;
          if (!outcome?.cancelled) announce(outcome?.message || t("entry.review.save_failed"));
          if (action.isConnected) action.removeAttribute('disabled');
          return false;
        });
        return;
      }
      if (hit("[data-review-undo]")) { undo(); return; }
      if (hit("[data-review-restore]")) { restore(); return; }
      if (hit("[data-review-title]")) { sheet = { kind: "rename", target: "program" }; openSheet(); return; }
      if (hit("[data-review-block-edit]") && typeof adapter.changeBlock === "function") {
        const state = read(), definition = state.definition, answers = state.answers || {};
        sheet = {
          kind: "block",
          fixedCycles: recoveredBlock(definition),
          cycles: recoveredBlock(definition) ? 7 : typeof answers.block?.cycles==='number'&&Number.isInteger(answers.block.cycles) ? answers.block.cycles : definition.cycles,
          periodization: answers.block?.periodization || slotsOf(definition)[0]?.prescriptionsByCycle?.[0]?.sets?.[0]?.provenance?.periodization || "static",
          deload: typeof answers.deload === "boolean" ? answers.deload : recoveredBlock(definition)
              ? (definition.deloadCycles || []).length > 0 : (definition.deloadCycles || []).includes(definition.cycles),
        };
        openSheet();
        return;
      }
      if (hit("[data-review-day-name]")) { sheet = { kind: "rename", target: "day" }; openSheet(); return; }
      if (hit("[data-review-day-menu]")) { sheet = { kind: "day" }; openSheet(); return; }
      if (hit("[data-review-add]")) { pick("add"); return; }
      if (hit("[data-review-reorder-done]")) { view.reorder = null; paint({ focus: "[data-review-day-menu]" }); return; }
      if ((el = hit("[data-review-reorder-move]"))) {
        const [slotId, dir] = (el.dataset.reviewReorderMove||'').split(":");
        reorderBy(slotId, Number(dir));
        return;
      }
      if ((el = hit("[data-review-slot]"))) exerciseSheet(el.dataset.reviewSlot||'');
    }
    /** @param {string} slotId @param {number} dir */
    function reorderBy(slotId, dir) {
      const day = read().definition.days[activeTab()];
      const ids = day.slots.map((slot) => slot.id), from = ids.indexOf(slotId), to = from + dir;
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ...ids.splice(from, 1));
      apply({ kind: "reorder", dayId: day.id, slotIds: ids }, { flip: true }).then(() => {
        /** @type {HTMLElement|null} */ (host.querySelector(`[data-review-reorder-move="${CSS.escape(slotId)}:${dir}"]:not([disabled])`))?.focus({ preventScroll: true })
          || /** @type {HTMLElement|null} */ (host.querySelector(`[data-review-reorder-move="${CSS.escape(slotId)}:${-dir}"]`))?.focus({ preventScroll: true });
      });
    }
    /** @param {KeyboardEvent} event */
    function onKey(event) {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest?.("[data-review-slot]");
      if (row && target === row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); exerciseSheet(row.getAttribute('data-review-slot')||''); return; }
      const tab = target?.closest?.("[data-review-tab]");
      if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        const next = activeTab() + (event.key === "ArrowRight" ? 1 : -1);
        setTab(next);
        /** @type {HTMLElement|null} */ (host.querySelector(`[data-review-tab="${view.tab}"]`))?.focus();
      }
    }
    /* The handle drag of the prototype: the row follows the pointer, the rows it
       passes make room, and the drop is one reorder edit. The arrows are the
       accessible path to the same edit. */
    /** @type {ReviewDrag|null} */
    let drag = null;
    /** @param {PointerEvent} event */
    function onPointerDown(event) {
      const handle = event.target instanceof Element ? event.target.closest("[data-review-handle]") : null;
      if (!(handle instanceof window.HTMLElement)) return;
      event.preventDefault();
      const list = /** @type {HTMLElement|null} */ (host.querySelector("[data-review-reorder]"));
      if(!list)return;
      const rows = [.../** @type {NodeListOf<HTMLElement>} */ (list.querySelectorAll(".review__ro"))];
      const row = handle.closest(".review__ro");if(!(row instanceof window.HTMLElement))return;
      drag = { id: event.pointerId, row, rows, from: rows.indexOf(row), to: rows.indexOf(row), y0: event.clientY, h: row.offsetHeight };
      row.classList.add("is-lifted");
      handle.setPointerCapture?.(event.pointerId);
    }
    /** @param {PointerEvent} event */
    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const current=drag;
      const dy = event.clientY - current.y0;
      drag.row.style.transform = `translate3d(0,${dy}px,0)`;
      drag.to = Math.max(0, Math.min(drag.rows.length - 1, drag.from + Math.round(dy / drag.h)));
      current.rows.forEach((row, index) => {
        if (row === current.row) return;
        const shift = current.from < current.to && index > current.from && index <= current.to ? -current.h
          : current.from > current.to && index < current.from && index >= current.to ? current.h : 0;
        row.style.transform = shift ? `translate3d(0,${shift}px,0)` : "";
      });
    }
    /** @param {PointerEvent} event */
    function onPointerUp(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const { rows, row, from, to } = drag;
      drag = null;
      rows.forEach((item) => { item.style.transform = ""; });
      row.classList.remove("is-lifted");
      if (event.type === "pointercancel" || to === from) return;
      const day = read().definition.days[activeTab()];
      const ids = day.slots.map((slot) => slot.id);
      ids.splice(to, 0, ...ids.splice(from, 1));
      apply({ kind: "reorder", dayId: day.id, slotIds: ids }, { flip: true });
    }
    /* A horizontal swipe on the day moves between days, as in the prototype. */
    /** @type {ReviewSwipe|null} */
    let swipe = null;
    /** @param {PointerEvent} event */
    function onPanelDown(event) {
      if (!(event.target instanceof Element) || event.target.closest("[data-review-handle]") || !event.target.closest("[data-review-panel]")) return;
      swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
    /** @param {PointerEvent} event */
    function onPanelUp(event) {
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        adapter.swallowClick?.();
        setTab(activeTab() + (dx < 0 ? 1 : -1));
      }
    }

    const sheetParts = adapter.sheet();
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("pointerdown", onPanelDown);
    host.addEventListener("pointerup", onPanelUp);
    sheetParts.el.addEventListener("click", onSheetClick);
    sheetParts.el.addEventListener("keydown", onSheetKey);
    sheetParts.el.addEventListener("input", onSheetInput);
    paint();

    return {
      refresh: () => { subsCache.clear(); paint(); paintSheet(); },
      dispose() {
        disposed = true;
        host.removeAttribute("aria-busy");
        hideToast();
        host.removeEventListener("click", onClick);
        host.removeEventListener("keydown", onKey);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerUp);
        host.removeEventListener("pointerdown", onPanelDown);
        host.removeEventListener("pointerup", onPanelUp);
        sheetParts.el.removeEventListener("click", onSheetClick);
        sheetParts.el.removeEventListener("keydown", onSheetKey);
        sheetParts.el.removeEventListener("input", onSheetInput);
        if (sheet) { sheet = null; adapter.closeSheet(); }
      },
    };
  }

return Object.freeze({mountProgramReview});
}
