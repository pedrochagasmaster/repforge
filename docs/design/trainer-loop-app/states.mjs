// The candidate screens. Each state opens a real catalog state of the app (the same scenario the screen catalog
// draws) and replaces only the content this plan adds, using the app's own components: the first-run band and its
// shared card, the Share setup sheet (band, scrolling body, glass action bar, steel and CTA buttons), the Today week
// card, fields and text links. `render` in capture.mjs applies the spec inside the page.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const icon = (name) => `<span class="icon-mask icon-mask--${name}" aria-hidden="true"></span>`;
const steel = (label, extra = "") => `<button type="button" class="btn btn--steel ${extra}">${esc(label)}</button>`;
const cta = (label, extra = "") => `<button type="button" class="btn btn--cta btn--noarrow ${extra}">${esc(label)}</button>`;
const caption = (text, center = false) => `<p class="tl-caption${center ? " tl-caption--center" : ""}">${esc(text)}</p>`;
const field = (label, value, { area = false, placeholder = "" } = {}) => `<label class="field tl-field">${esc(label)}${area
  ? `<textarea rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
  : `<input type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`}</label>`;
const linkLine = (origin) => `<p class="share-setup__link" tabindex="0">${esc(origin)}/#r=Qm9vdHN0cmFwRGVtb0lk.ZGVtby1rZXktbm90LXJlYWwtbm90LWEtcmVjb3JkLXh5</p>`;
const list = (items, cls, ic) => `<ul class="tl-list ${cls}">${items.map((s) => `<li>${icon(ic)}<span>${esc(s)}</span></li>`).join("")}</ul>`;
const quote = (label, text) => `<div><p class="tl-quote-label">${esc(label)}</p><p class="tl-quote">${esc(text)}</p></div>`;

const firstRunCta = (title, cap = "") => `<button type="button" class="firstrun__cta"><span class="firstrun-row__text"><span class="firstrun-row__title">${esc(title)}</span>${cap ? `<span class="firstrun-row__cap">${esc(cap)}</span>` : ""}</span><span class="firstrun-row__go" aria-hidden="true"></span></button>`;

function gateError(t, kind, primary) {
  return {
    kind: "gate", base: "onboarding-shared/invalid",
    headline: t(`relay.open.${kind}.title`), lede: t(`relay.open.${kind}.sub`), error: t(`relay.open.${kind}.hint`),
    primary: primary ? firstRunCta(primary) : "", keepStandard: true,
  };
}

function updateError(t, d, kind, action) {
  return {
    kind: "sheet", base: "today/ready", title: t("relay.update.title"), sub: "",
    body: `<p class="tl-strong">${esc(t(`relay.open.${kind}.title`))}</p>${caption(t(`relay.open.${kind}.sub`))}${caption(t(`relay.open.${kind}.hint`))}`,
    foot: action ? cta(action) : steel(t("dialog.close")), stack: true,
  };
}

export const STATES = [
  // ---- Slice 2: sharing through the relay -------------------------------------------------------------------
  { id: "share-who", slice: 2, title: "Share · who it's from (optional)", build: (t, d) => ({
    kind: "sheet", base: "program/share-ready", title: t("program.share_setup_title"), sub: null,
    body: `<p class="share-setup__scope">${esc(t("relay.share.scope"))}</p>${caption(t("relay.share.who_lede"))}
      ${field(t("relay.share.name_label"), d("trainer"))}
      ${field(t("relay.share.registration_label"), "", { placeholder: t("relay.share.registration_placeholder") })}
      ${field(t("relay.share.message_label"), d("message"), { area: true })}`,
    note: t("relay.share.attribution_note"), foot: cta(t("relay.share.create")), stack: true,
  }) },
  { id: "share-preparing", slice: 2, title: "Share · creating the encrypted link", build: (t) => ({
    kind: "sheet", base: "program/share-ready", title: t("program.share_setup_title"), sub: null,
    body: `<p class="share-setup__scope">${esc(t("relay.share.scope"))}</p><p class="tl-busy tl-caption" role="status">${esc(t("relay.share.preparing"))}</p>`,
    foot: `<button type="button" class="btn btn--steel" disabled>${esc(t("program.share_setup_copy"))}</button><button type="button" class="btn btn--cta btn--noarrow" disabled>${esc(t("program.share_setup_share"))}</button>`,
  }) },
  { id: "share-ready", slice: 2, title: "Share · QR code and link", build: (t, d, x) => ({
    kind: "sheet", base: "program/share-ready", title: t("program.share_setup_title"), sub: null,
    body: `<p class="share-setup__scope">${esc(t("relay.share.scope"))}</p>
      <div class="tl-qr" role="img" aria-label="${esc(t("relay.share.qr_aria"))}">${x.qr}</div>
      ${caption(t("relay.share.qr_hint"), true)}
      ${caption(t("relay.share.expiry", { date: d("expires") }))}
      ${linkLine("https://taurifer.com")}`,
    foot: steel(t("program.share_setup_copy")) + cta(t("program.share_setup_share")),
  }) },
  { id: "share-unavailable-link", slice: 2, title: "Share · relay down, program fits a setup link", build: (t) => ({
    kind: "sheet", base: "program/share-ready", title: t("program.share_setup_title"), sub: null,
    body: `<p class="tl-warn" role="status">${esc(t("relay.share.unavailable_fits"))}</p>${linkLine("https://taurifer.com/index.html#setup=v4.H4sIAAAAAAAAA")}
      <button type="button" class="text-link">${esc(t("relay.retry"))}</button>`,
    foot: steel(t("program.share_setup_copy")) + cta(t("program.share_setup_share")),
  }) },
  { id: "share-unavailable-file", slice: 2, title: "Share · relay down, program too large for a link", build: (t) => ({
    kind: "sheet", base: "program/share-ready", title: t("program.share_setup_title"), sub: null,
    body: `<p class="tl-warn" role="status">${esc(t("relay.share.unavailable_file"))}</p><button type="button" class="text-link">${esc(t("relay.retry"))}</button>`,
    foot: steel(t("program.share_setup_file")),
  }) },

  // ---- Slice 2: the first-run gate ---------------------------------------------------------------------------
  { id: "gate-trainer", slice: 2, title: "Gate · program from a trainer (new client)", build: (t, d) => ({
    kind: "gate", base: "onboarding-shared/gate", headline: t("setup.shared.title"),
    card: `<p class="firstrun__shared-card-name">${esc(d("programDays"))}</p>
      <p class="tl-from">${esc(t("relay.gate.from", { name: "\u0000" })).replace("\u0000", `<b>${esc(d("trainer"))}</b>`)}<span>${esc(d("registration"))}</span></p>
      <p class="tl-quote-label">${esc(t("relay.message_from", { name: d("trainer").split(" ")[0] }))}</p><p class="tl-quote">${esc(d("message"))}</p>
      <p class="firstrun__shared-card-body">${esc(t("relay.gate.body", { name: d("trainer").split(" ")[0] }))}</p>`,
  }) },
  { id: "gate-opening", slice: 2, title: "Gate · opening the link (needs a connection once)", build: (t) => ({
    kind: "gate", base: "onboarding-shared/gate", headline: t("setup.shared.title"),
    card: `<p class="firstrun__shared-card-name">${esc(t("relay.gate.opening"))}</p><p class="firstrun__shared-card-body">${esc(t("relay.gate.opening_note"))}</p>`,
    busy: true,
  }) },
  { id: "gate-unavailable", slice: 2, title: "Gate · relay unavailable", build: (t) => gateError(t, "unavailable", t("relay.retry")) },
  { id: "gate-expired", slice: 2, title: "Gate · link expired", build: (t) => gateError(t, "expired") },
  { id: "gate-newer", slice: 2, title: "Gate · link from a newer version", build: (t) => gateError(t, "newer", t("relay.open.reload")) },
  { id: "gate-incomplete", slice: 2, title: "Gate · link incomplete or wrong key", build: (t) => gateError(t, "incomplete") },

  // ---- Slice 3: program update for an existing client ----------------------------------------------------------
  ...[["update", "today/ready", "relay.update.history"], ["update-draft", "today/in-progress", "relay.update.history_draft"]].map(([id, base, note]) => ({
    id, slice: 3, title: id === "update" ? "Update · what changed, use or keep" : "Update · with a workout in progress", build: (t, d, x) => ({
      kind: "sheet", base, title: t("relay.update.title"), sub: t("relay.update.sub", { name: d("trainer").split(" ")[0], program: x.program, date: d("sentDate") }),
      body: `<p class="tl-strong">${esc(t("relay.update.count.other", { n: 3 }))}</p>
        <div class="tl-diff">
          <div class="tl-diff__row"><p class="tl-diff__day">${esc(d("day"))}</p><p class="tl-diff__name">${esc(d("e_new"))}</p><span class="tl-diff__tag">${esc(t("relay.update.tag.swapped"))}</span><p class="tl-diff__was"><s>${esc(d("e_old"))}</s></p><p class="tl-diff__now">3 × 8–12 · 15 kg</p></div>
          <div class="tl-diff__row"><p class="tl-diff__day">${esc(d("day"))}</p><p class="tl-diff__name">${esc(d("e_bench"))}</p><span class="tl-diff__tag">${esc(t("relay.update.tag.changed"))}</span><p class="tl-diff__was"><s>3 × 4–8 · 80 kg</s></p><p class="tl-diff__now">4 × 4–8 · 82.5 kg</p></div>
          <div class="tl-diff__row"><p class="tl-diff__day">${esc(d("day"))}</p><p class="tl-diff__name">${esc(d("e_curl"))}</p><span class="tl-diff__tag">${esc(t("relay.update.tag.removed"))}</span></div>
        </div>
        ${quote(t("relay.message_from", { name: d("trainer").split(" ")[0] }), d("updMessage"))}
        <button type="button" class="text-link">${esc(t("relay.update.see_all"))}</button>`,
      note: t(note), foot: cta(t("relay.update.use")) + steel(t("relay.update.keep")), stack: true,
    }),
  })),
  { id: "update-unavailable", slice: 3, title: "Update · relay unavailable", build: (t, d) => updateError(t, d, "unavailable", t("relay.retry")) },
  { id: "update-expired", slice: 3, title: "Update · link expired", build: (t, d) => updateError(t, d, "expired") },
  { id: "update-newer", slice: 3, title: "Update · link from a newer version", build: (t, d) => updateError(t, d, "newer", t("relay.open.reload")) },

  // ---- Slice 4: send my training -------------------------------------------------------------------------------
  { id: "send-entry", slice: 4, title: "Send · the Today card", build: (t, d) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "card", base: "today/ready",
      html: `<p class="section-label">${esc(t("relay.send.card_label", { name: d("trainer") }))}</p><p>${esc(t("relay.send.card_body.other", { n: 10, name: first }))}</p>
        <div class="week-card__actions"><button type="button" class="text-link">${esc(t("relay.send.card_action", { name: first }))}</button><button type="button" class="text-link">${esc(t("relay.send.card_dismiss"))}</button></div>` };
  } },
  { id: "send-sheet", slice: 4, title: "Send · what goes and what stays", build: (t, d, x) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "sheet", base: "today/ready", title: t("relay.send.card_action", { name: first }), sub: t("relay.send.sub", { program: x.program, date: d("since") }),
      body: `<p class="section-label tl-label">${esc(t("relay.send.goes"))}</p>${list([t("relay.send.go_sessions", { n: 10, date: d("since") }), t("relay.send.go_program")], "", "check")}
        <p class="section-label tl-label">${esc(t("relay.send.stays"))}</p>${list([t("relay.send.stay_history"), t("relay.send.stay_sent"), t("relay.send.stay_personal")], "tl-list--stays", "minus")}
        ${field(t("relay.share.message_label"), "", { area: true })}`,
      note: t("relay.send.disclosure"), foot: cta(t("relay.send.send")), stack: true };
  } },
  { id: "send-ready", slice: 4, title: "Send · link ready to hand over", build: (t, d, x) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "sheet", base: "today/ready", title: t("relay.send.ready_title", { name: first }), sub: t("relay.send.sub", { program: x.program, date: d("since") }),
      body: `<div class="tl-qr" role="img" aria-label="${esc(t("relay.share.qr_aria"))}">${x.qrStudio}</div>${caption(t("relay.send.ready_body", { name: first, date: d("expires") }))}${linkLine("https://studio.taurifer.com")}`,
      foot: steel(t("program.share_setup_copy")) + cta(t("program.share_setup_share")) };
  } },
  { id: "send-too-many", slice: 4, title: "Send · more than 120 sessions", build: (t, d, x) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "sheet", base: "today/ready", title: t("relay.send.card_action", { name: first }), sub: t("relay.send.sub_first", { program: x.program }),
      body: `<p class="tl-warn" role="status">${esc(t("relay.send.too_many", { n: 134 }))}</p>${caption(t("relay.send.too_many_rest", { m: 14 }))}
        <p class="section-label tl-label">${esc(t("relay.send.stays"))}</p>${list([t("relay.send.stay_history"), t("relay.send.stay_personal")], "tl-list--stays", "minus")}`,
      note: t("relay.send.disclosure"), foot: cta(t("relay.send.too_many_action")), stack: true };
  } },
  { id: "send-unavailable", slice: 4, title: "Send · relay unavailable", build: (t, d, x) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "sheet", base: "today/ready", title: t("relay.send.card_action", { name: first }), sub: t("relay.send.sub", { program: x.program, date: d("since") }),
      body: `<p class="tl-warn" role="status">${esc(t("relay.send.unavailable"))}</p>${caption(t("relay.send.unavailable_hint"))}`,
      foot: cta(t("relay.retry")), stack: true };
  } },
  { id: "send-nothing", slice: 4, title: "Send · nothing new since the last send", build: (t, d, x) => {
    const first = d("trainer").split(" ")[0];
    return { kind: "sheet", base: "today/ready", title: t("relay.send.card_action", { name: first }), sub: x.program,
      body: `<p class="tl-strong">${esc(t("relay.send.nothing", { date: d("lastSent") }))}</p>${caption(t("relay.send.nothing_hint"))}`,
      foot: steel(t("dialog.close")), stack: true };
  } },
];
