/* Share cards (finish-share PR 2; owner decisions, 2026-11-05): the image Share sends is drawn here, on a canvas,
   on the device. No server, no upload and no DOM screenshot. The app builds a plain card model (app.js
   shareCardModel); this module only draws it.

   Two cards, each in Story 9:16 (1080×1920) and Square 1:1 (1080×1080):
   - record: the session's heaviest record (or, with none, its most-improved lift) as a poster, then every lift;
   - stats: the finish screen's four numbers, then every lift.
   Every card lists every lift with its sets and marks records and improvements, and its foot carries the mark,
   "Taurifer" and "taurifer.com". Big figures are Plex Sans with tabular numerals; set lines are Plex Mono. */
(function (root) {
  "use strict";

  // The cards are pictures that leave the app, so they keep one palette in both themes. The poster ground is the
  // app's deeper accent: white on it clears AA for small text (the brighter accent measured 3.99:1).
  const PALETTE = {
    orange: { bg: "#B8410E", ink: "#FFFFFF", soft: "#FFFFFF", rule: "rgba(255,255,255,.4)", accent: "#FFFFFF", positive: "#FFFFFF", up: "#FFFFFF" },
    dark: { bg: "#141310", ink: "#F2EFE9", soft: "#ADA79D", rule: "#3A3630", accent: "#F2703B", positive: "#6FBF73", up: "#F2703B" },
    light: { bg: "#F4F2EF", ink: "#1B1A17", soft: "#6A665F", rule: "#D9D5CD", accent: "#B8410E", positive: "#2F7D33", up: "#B8410E" },
  };
  const SANS = '"Plex Sans", system-ui, sans-serif';
  const MONO = '"Plex Mono", ui-monospace, monospace';
  const SITE = "taurifer.com";
  const SIZES = Object.freeze({ story: [1080, 1920], square: [1080, 1080] });
  const KINDS = Object.freeze({ record: ["orange", "dark"], stats: ["dark", "light"] });

  /** Every face the cards use, loaded before the first paint: a canvas draws with whatever font is ready and never
   *  repaints, so an unloaded face would bake the fallback into the image. */
  function ready(doc = root.document) {
    const faces = [`400 40px ${SANS}`, `500 40px ${SANS}`, `600 40px ${SANS}`, `700 40px ${SANS}`, `400 40px ${MONO}`, `500 40px ${MONO}`];
    return Promise.all(faces.map((face) => doc.fonts.load(face, "0123456789,. kg×·Aaçãé"))).then(() => true, () => false);
  }

  const font = (ctx, weight, size, family = SANS) => { ctx.font = `${weight} ${size}px ${family}`; if ("fontVariantNumeric" in ctx) ctx.fontVariantNumeric = "tabular-nums"; };
  const width = (ctx, value, weight, size, family = SANS) => { font(ctx, weight, size, family); return ctx.measureText(String(value)).width; };
  function text(ctx, value, x, y, { weight = 400, size = 40, family = SANS, color = "#000", align = "left", tracking = 0 } = {}) {
    font(ctx, weight, size, family);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(String(value), x, y);
    const w = ctx.measureText(String(value)).width;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return w;
  }
  /** The largest size, up to `size`, at which a line fits: a long name gets smaller, never clipped. */
  function fit(ctx, value, weight, size, max, family = SANS, floor = 14) {
    let s = size;
    while (s > floor && width(ctx, value, weight, s, family) > max) s -= 2;
    return s;
  }
  function hline(ctx, x1, x2, y, color) { ctx.fillStyle = color; ctx.fillRect(x1, y, x2 - x1, 2); }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function check(ctx, x, y, s, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.17; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.36, y + s * 0.84); ctx.lineTo(x + s, y + s * 0.12); ctx.stroke(); ctx.restore();
  }
  function arrowUp(ctx, x, y, s, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * 0.15; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x + s / 2, y + s); ctx.lineTo(x + s / 2, y); ctx.moveTo(x + s * 0.12, y + s * 0.38);
    ctx.lineTo(x + s / 2, y); ctx.lineTo(x + s * 0.88, y + s * 0.38); ctx.stroke(); ctx.restore();
  }
  /** The foot of every card: the mark, the name and the site (owner decision 3). */
  function brand(ctx, x, y, size, p, mark) {
    const m = size * 1.3, gap = size * 0.45;
    let left = x;
    if (mark) { ctx.save(); roundRect(ctx, left, y - m * 0.82, m, m, m * 0.22); ctx.clip(); ctx.drawImage(mark, left, y - m * 0.82, m, m); ctx.restore(); }
    left += m + gap;
    const nameW = text(ctx, "Taurifer", left, y, { weight: 600, size, color: p.ink });
    text(ctx, SITE, left + nameW + gap * 1.4, y, { size: size * 0.9, color: p.soft });
  }

  /** Every lift: in Stories, the name at the full width and the sets with the mark under it; on squares, a table with
   *  one name size and one set column. Rows grow into the space they have and shrink when there are more lifts. */
  function liftList(ctx, card, p, { x, right, top, bottom, story }) {
    const lifts = card.lifts, n = Math.max(1, lifts.length), compact = !story;
    const ideal = compact ? 62 : 116;
    const row = Math.min(ideal * (compact ? 1.35 : 1.55), (bottom - top) / n), scale = Math.min(1.2, Math.max(0.6, row / ideal));
    let nameSize = Math.round((compact ? 30 : 40) * scale), setSize = Math.round((compact ? 26 : 31) * scale);
    const markW = (mark, size) => mark ? width(ctx, mark.text, 500, size + 2, MONO) + size * 1.25 : 0;
    let setsX = x;
    if (compact) {
      for (;;) {
        const nameW = Math.max(...lifts.map((l) => width(ctx, l.name, 500, nameSize)));
        const setsW = Math.max(...lifts.map((l) => width(ctx, l.sets, 400, setSize, MONO)));
        const mW = Math.max(0, ...lifts.map((l) => markW(l.mark, setSize)));
        if (nameW + 28 + setsW + 28 + mW <= right - x || nameSize <= 14) { setsX = x + Math.min(nameW, right - x - setsW - mW - 56) + 28; break; }
        nameSize -= 1; setSize = Math.max(13, setSize - 1);
      }
    }
    const commonName = compact ? nameSize : Math.min(...lifts.map((l) => fit(ctx, l.name, 500, nameSize, right - x, SANS, 20)));
    let y = top + (compact ? (row + nameSize * 0.7) / 2 : nameSize);
    let drawn = 0;
    for (const lift of lifts) {
      if (compact) {
        text(ctx, lift.name, x, y, { weight: 500, size: fit(ctx, lift.name, 500, nameSize, setsX - x - 20, SANS, 12), color: p.ink });
        text(ctx, lift.sets, setsX, y, { size: setSize, family: MONO, color: p.soft });
      } else {
        text(ctx, lift.name, x, y, { weight: 500, size: commonName, color: p.ink });
        text(ctx, lift.sets, x, y + setSize * 1.45, { size: setSize, family: MONO, color: p.soft });
      }
      if (lift.mark) {
        const my = compact ? y : y + setSize * 1.45, color = lift.mark.kind === "record" ? p.positive : p.up;
        const mw = width(ctx, lift.mark.text, 500, setSize + 2, MONO);
        if (lift.mark.kind === "record") check(ctx, right - mw - setSize * 1.15, my - setSize * 0.8, setSize * 0.85, color);
        else arrowUp(ctx, right - mw - setSize * 1.1, my - setSize * 0.86, setSize * 0.82, color);
        text(ctx, lift.mark.text, right, my, { weight: 500, size: setSize + 2, family: MONO, color, align: "right" });
      }
      drawn++;
      y += row;
    }
    return drawn;
  }

  /* ---- The record poster ---- */
  function drawRecord(ctx, w, h, card, o) {
    const story = h > w, p = PALETTE[o.style], lead = card.lead;
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
    const pad = story ? 96 : 80, right = w - pad;
    const figure = o.style === "dark" ? p.accent : p.ink;
    let y = story ? 190 : 120;
    ctx.fillStyle = o.style === "dark" ? p.accent : p.ink; ctx.fillRect(pad, y - (story ? 74 : 56), story ? 110 : 84, story ? 9 : 7);
    text(ctx, lead.kicker.toUpperCase(), pad, y, { weight: 700, size: story ? 34 : 26, color: p.ink, tracking: 6 });
    text(ctx, card.dayDate, right, y, { weight: 500, size: story ? 34 : 26, color: p.soft, align: "right" });
    y += story ? 96 : 68;
    text(ctx, lead.name, pad, y, { weight: 600, size: fit(ctx, lead.name, 600, story ? 64 : 46, right - pad), color: p.ink });
    const big = lead.load;
    const bigSize = fit(ctx, big, 600, story ? 300 : 190, right - pad);
    y += story ? 300 : 196;
    text(ctx, big, pad - (story ? 8 : 5), y, { weight: 600, size: bigSize, color: figure, tracking: story ? -10 : -6 });
    y += story ? 92 : 64;
    const uw = text(ctx, lead.unitReps, pad, y, { weight: 500, size: story ? 54 : 38, family: MONO, color: p.ink });
    if (lead.over) {
      // The record's margin beside the reps, or on its own line when the language makes it too long to fit.
      const gap = story ? 36 : 26, as = story ? 38 : 28, ds = story ? 38 : 28;
      let ax = pad + uw + gap;
      if (ax + as + 14 + width(ctx, lead.over, 500, ds) > right) { ax = pad; y += story ? 62 : 44; }
      arrowUp(ctx, ax, y - as * 0.95, as, p.ink);
      text(ctx, lead.over, ax + as + (story ? 14 : 10), y, { weight: 500, size: fit(ctx, lead.over, 500, ds, right - ax - as - 14), color: p.ink });
    }
    y += story ? 76 : 50;
    hline(ctx, pad, right, y, p.rule);
    y += story ? 40 : 30;
    const foot = story ? h - 120 : h - 70;
    const lifts = liftList(ctx, card, p, { x: pad, right, top: y, bottom: foot - (story ? 90 : 56), story });
    brand(ctx, pad, foot, story ? 36 : 28, p, o.mark);
    return { lifts, brand: true };
  }

  /* ---- The stats card ---- */
  function drawStats(ctx, w, h, card, o) {
    const story = h > w, p = PALETTE[o.style];
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
    const pad = story ? 96 : 80, right = w - pad, colW = (right - pad) / 2;
    let y = story ? 190 : 118;
    text(ctx, card.day, pad, y, { weight: 600, size: fit(ctx, card.day, 600, story ? 72 : 48, right - pad), color: p.ink });
    y += story ? 58 : 44;
    text(ctx, card.dateLine, pad, y, { size: fit(ctx, card.dateLine, 400, story ? 32 : 26, right - pad), color: p.soft });
    y += story ? 110 : 76;
    const rowH = story ? 262 : 196, valSize = story ? 136 : 96, labSize = story ? 27 : 22;
    card.tiles.slice(0, 4).forEach((tile, i) => {
      const x = pad + (i % 2) * colW, ty = y + Math.floor(i / 2) * rowH, cw = colW - 28;
      const lab = tile.label.toUpperCase();
      // The label is tracked, so its measured width leaves room for the 2px between letters.
      text(ctx, lab, x, ty, { weight: 600, size: fit(ctx, lab, 600, labSize, cw - 2 * lab.length, SANS, 14), color: p.soft, tracking: 2 });
      const unitW = tile.unit ? width(ctx, ` ${tile.unit}`, 500, valSize * 0.34) + 8 : 0;
      const vs = fit(ctx, tile.text, 600, valSize, cw - unitW);
      const vw = text(ctx, tile.text, x - 4, ty + vs + 8, { weight: 600, size: vs, color: tile.accent ? p.accent : p.ink, tracking: -3 });
      if (tile.unit) text(ctx, tile.unit, x + vw + 10, ty + vs + 8, { weight: 500, size: Math.round(valSize * 0.34), color: p.soft });
    });
    y += rowH * Math.ceil(Math.min(4, card.tiles.length) / 2) - (story ? 40 : 34);
    hline(ctx, pad, right, y, p.rule);
    y += story ? 40 : 28;
    const foot = story ? h - 120 : h - 70;
    const lifts = liftList(ctx, card, p, { x: pad, right, top: y, bottom: foot - (story ? 90 : 52), story });
    brand(ctx, pad, foot, story ? 36 : 28, p, o.mark);
    return { lifts, brand: true };
  }

  /** Paints one card into a new canvas. Returns the canvas and what it drew, so a proof can read it back. */
  function render(card, { kind, size, style, mark = null, doc = root.document } = {}) {
    if (!SIZES[size] || !KINDS[kind]?.includes(style) || (kind === "record" && !card.lead)) return null;
    const [w, h] = SIZES[size];
    const canvas = doc.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const drawn = (kind === "record" ? drawRecord : drawStats)(canvas.getContext("2d"), w, h, card, { style, mark });
    return { canvas, drawn };
  }
  /** The PNG that is shared or saved. */
  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  root.TauriferShareCards = Object.freeze({ ready, render, toBlob, SIZES, KINDS, PALETTE });
})(typeof window !== "undefined" ? window : globalThis);
