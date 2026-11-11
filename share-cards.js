/* Share cards (share templates, owner decisions 2026-11-11): the image Share sends is drawn here, on a canvas, on the
   device. No server, no upload and no DOM screenshot. The app builds a plain card model (app.js shareCardModel); this
   module only draws it.

   Six templates, one idea each, in Story 9:16 (1080×1920) and Square 1:1 (1080×1080):
     hero     — one big number: a record, the most improved lift, or for someone starting out, the workouts done;
     progress — one lift's line over its sessions, with the gain;
     stats    — four numbers (records, time, exercises, sets, the week; never volume, never a zero);
     badge    — the lead on its own chip, a sticker that reads on any photo;
     sticker  — a transparent line and numbers row for layering in a Story;
     summary  — the day, three numbers and every lift.
   Grounds: photo | dark | orange | clear (a transparent PNG). Contrast is automatic: over a photo the renderer measures
   the photo under the type and darkens only what that needs (shade), or, with the shade off, picks dark or white ink
   from it. The photo is only a drawing source: it is painted into the card and nothing keeps it.
   The lifter's editor adjusts a card with `offset` (canvas pixels) and `scale`; the canvas reports where its content
   landed (`hit`) so the editor can follow it. Every card is signed with the mark and taurifer.com. */
(function (root) {
  "use strict";
  const SANS = '"Plex Sans", system-ui, sans-serif';
  const SIZES = Object.freeze({ story: [1080, 1920], square: [1080, 1080] });
  const TEMPLATES = Object.freeze(["hero", "progress", "stats", "badge", "sticker", "summary"]);
  const GROUNDS = Object.freeze(["photo", "dark", "orange", "clear"]);
  /** The grounds each template offers: the full-bleed cards never go clear; the stickers never go flat orange. */
  const OFFERS = Object.freeze({ hero: ["photo", "dark", "orange"], progress: ["photo", "dark", "orange"], stats: ["photo", "dark", "orange"], badge: ["photo", "dark", "clear"], sticker: ["photo", "dark", "clear"], summary: ["photo", "dark", "orange"] });
  const ORANGE = "#B8410E";

  const INK = {
    dark: { ink: "#F4F1EC", soft: "rgba(244,241,236,.74)", accent: "#F2703B", shadow: null },
    orange: { ink: "#FFFFFF", soft: "rgba(255,255,255,.8)", accent: "#FFFFFF", shadow: null },
    light: { ink: "#FFFFFF", soft: "rgba(255,255,255,.9)", accent: "#FFB386", shadow: "rgba(0,0,0,.5)" },
    darkInk: { ink: "#17150F", soft: "rgba(23,21,15,.72)", accent: ORANGE, shadow: "rgba(255,255,255,.28)" },
  };

  function ready(doc = root.document) {
    const faces = [400, 500, 600, 700].map((w) => `${w} 40px ${SANS}`);
    return Promise.all(faces.map((f) => doc.fonts.load(f, "0123456789,. kg×·Aaçãéê"))).then(() => true, () => false);
  }

  /* ---- type ---- */
  function font(ctx, weight, size) { ctx.font = `${weight} ${size}px ${SANS}`; if ("fontVariantNumeric" in ctx) ctx.fontVariantNumeric = "tabular-nums"; }
  function width(ctx, s, weight, size, tracking = 0) { font(ctx, weight, size); return ctx.measureText(String(s)).width + tracking * String(s).length; }
  function text(ctx, s, x, y, { weight = 500, size = 40, color = "#fff", align = "left", tracking = 0, ink = null } = {}) {
    font(ctx, weight, size);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(String(s)).width;
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.save();
    if (ink?.shadow) { ctx.shadowColor = ink.shadow; ctx.shadowBlur = Math.max(10, size * 0.28); ctx.shadowOffsetY = Math.max(1, size * 0.03); }
    ctx.fillStyle = color;
    for (let i = 0; i < (ink?.halo || 1); i++) ctx.fillText(String(s), left, y);
    ctx.restore();
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    return w;
  }
  function fit(ctx, s, weight, size, max, floor = 16, tracking = 0) {
    let z = size;
    while (z > floor && width(ctx, s, weight, z, tracking) > max) z -= 2;
    return z;
  }
  function ellipsize(ctx, s, weight, size, max) {
    if (width(ctx, s, weight, size) <= max) return s;
    let t = String(s);
    while (t.length > 1 && width(ctx, t + "…", weight, size) > max) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  /** The kicker: an accent dot and a tracked caps line. */
  function kicker(ctx, s, x, y, size, ink, align = "left") {
    const t = s.toUpperCase(), tr = size * 0.1, r = size * 0.27, gap = size * 0.5;
    const w = width(ctx, t, 600, size, tr) + r * 2 + gap;
    const left = align === "center" ? x - w / 2 : x;
    dot(ctx, left + r, y - size * 0.36, r, ink.accent);
    text(ctx, t, left + r * 2 + gap, y, { weight: 600, size, color: ink.ink, tracking: tr, ink });
  }

  /* ---- the mark as a single-colour glyph ---- */
  const glyphs = new Map();
  function glyph(mark, color, doc) {
    if (!mark) return null;
    const key = color;
    if (glyphs.has(key)) return glyphs.get(key);
    const c = doc.createElement("canvas"); c.width = mark.width; c.height = mark.height;
    const g = c.getContext("2d"); g.drawImage(mark, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    const [r, gg, b] = color.match(/\w\w/g).map((h) => parseInt(h, 16));
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      const a = Math.max(0, Math.min(1, (0.82 - lum) / 0.35)) * (px[i + 3] / 255);
      px[i] = r; px[i + 1] = gg; px[i + 2] = b; px[i + 3] = Math.round(a * 255);
    }
    g.putImageData(d, 0, 0);
    glyphs.set(key, c);
    return c;
  }
  /** The signature on every card (owner, 2026-11-11): the mark and taurifer.com, quiet, sized to stay legible as a
   *  thumbnail. */
  const SITE = "taurifer.com";
  function signature(ctx, x, y, size, ink, o, align = "left") {
    size *= 1.18;
    const m = size * 1.5, gap = size * 0.32, color = ink.ink;
    const nameW = width(ctx, SITE, 600, size);
    const total = m + gap + nameW;
    const left = align === "center" ? x - total / 2 : x;
    const hex = color.startsWith("#") ? color : "#FFFFFF";
    const gl = glyph(o.mark, hex, o.doc);
    if (gl) {
      ctx.save(); ctx.globalAlpha = 0.92;
      if (ink.shadow) { ctx.shadowColor = ink.shadow; ctx.shadowBlur = 12; }
      for (let i = 0; i < (ink.halo || 1); i++) ctx.drawImage(gl, left, y - m * 0.78, m, m);
      ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 0.92;
    text(ctx, SITE, left + m + gap, y, { weight: 600, size, color, ink, tracking: 0.2 });
    ctx.restore();
    return total;
  }

  /* ---- grounds and automatic contrast ---- */
  function cover(ctx, img, w, h) {
    const r = Math.max(w / img.width, h / img.height), pw = img.width * r, ph = img.height * r;
    ctx.drawImage(img, (w - pw) / 2, (h - ph) / 2, pw, ph);
  }
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  /** The photo under a block: the 95th-percentile relative luminance and how busy it is. */
  function measure(img, w, h, rect, doc) {
    const c = doc.createElement("canvas"); c.width = 72; c.height = Math.max(8, Math.round(72 * rect.h / rect.w));
    const g = c.getContext("2d");
    const r = Math.max(w / img.width, h / img.height), ox = (w - img.width * r) / 2, oy = (h - img.height * r) / 2;
    g.drawImage(img, (rect.x - ox) / r, (rect.y - oy) / r, rect.w / r, rect.h / r, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data, L = [];
    for (let i = 0; i < px.length; i += 4) L.push(0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]));
    const sorted = [...L].sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)];
    let edge = 0;
    for (let y = 0; y < c.height; y++) for (let x = 1; x < c.width; x++) edge += Math.abs(L[y * c.width + x] - L[y * c.width + x - 1]);
    return { p95, mean: L.reduce((a, b) => a + b, 0) / L.length, busy: edge / (c.width * c.height) };
  }
  /** The scrim a block needs so white type over its brightest 5% clears 4.5:1 (shadows add a margin). */
  function scrimAlpha(m) {
    const target = 1.05 / 4.5 - 0.05;
    const need = m.p95 <= target ? 0 : 1 - target / m.p95;
    return Math.min(0.82, Math.max(0.3, need + 0.06 + Math.min(0.22, m.busy * 4)));
  }
  const clampRect = (r, w, h) => {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    return { ...r, x, y, w: Math.max(8, Math.min(w, r.x + r.w) - x), h: Math.max(8, Math.min(h, r.y + r.h) - y) };
  };
  /** Paints the ground. `block` is the region the type occupies and `from` is where it sits (bottom | all). */
  function ground(ctx, w, h, o, block) {
    if (o.ground === "dark") { ctx.fillStyle = "#141310"; ctx.fillRect(0, 0, w, h); return INK.dark; }
    if (o.ground === "orange") { ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, w, h); return INK.orange; }
    if (o.ground === "clear") {
      // A transparent sticker lands on a background the app never sees, so it is white with its own soft halo.
      return { ...INK.light, shadow: "rgba(0,0,0,.6)", halo: 2 };
    }
    if (o.photo) cover(ctx, o.photo, w, h);
    else {
      const g = ctx.createLinearGradient(0, 0, w * 0.5, h);
      g.addColorStop(0, "#5E4B3C"); g.addColorStop(0.5, "#2B231D"); g.addColorStop(1, "#0F0D0B");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (block && o.photo && o.shade === false) {
      // No shade: the type itself adapts. Dark ink over a bright patch, white over a dark one, each with a soft halo.
      const m = measure(o.photo, w, h, clampRect(block, w, h), o.doc);
      const halo = m.busy > 0.02 ? 3 : 2;
      return m.mean > 0.36 ? { ...INK.darkInk, shadow: "rgba(255,255,255,.55)", halo } : { ...INK.light, shadow: "rgba(0,0,0,.65)", halo };
    }
    if (block && o.photo) {
      const a = Math.min(0.84, scrimAlpha(measure(o.photo, w, h, clampRect(block, w, h), o.doc)) + (block.dense ? 0.14 : 0)), fade = Math.min(block.y, h * 0.22);
      const top = block.y - fade;
      const g = ctx.createLinearGradient(0, top, 0, h);
      const s = (y) => Math.max(0, Math.min(1, (y - top) / (h - top)));
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(s(block.y), `rgba(0,0,0,${(a * 0.82).toFixed(3)})`);
      g.addColorStop(s(block.y + block.h * 0.3), `rgba(0,0,0,${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, a + 0.06).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(0, top, w, h - top);
    }
    return INK.light;
  }

  /* ---- shared pieces ---- */
  const SEP = "  ·  ";
  /** Whether the lead's support (strong · accent) needs two lines at this size. */
  const twoLines = (ctx, L, size, max) => width(ctx, L.strong, 600, size) + width(ctx, SEP, 500, size) + width(ctx, L.accent, 600, size) > max;
  /** The lead's support: the strong part, then the accent part; one line when it fits, else the accent goes under. */
  function support(ctx, L, x, y, right, size, ink, accentColor, lineGap, two) {
    if (!two) {
      const rw = text(ctx, L.strong, x, y, { weight: 600, size, color: ink.ink, ink });
      const sw = text(ctx, SEP, x + rw, y, { weight: 500, size, color: ink.soft, ink });
      text(ctx, L.accent, x + rw + sw, y, { weight: 600, size, color: accentColor, ink });
      return;
    }
    text(ctx, L.strong, x, y - lineGap, { weight: 600, size: fit(ctx, L.strong, 600, size, right - x, 18), color: ink.ink, ink });
    text(ctx, L.accent, x, y, { weight: 600, size: fit(ctx, L.accent, 600, size, right - x, 18), color: accentColor, ink });
  }
  /** The big figure with its unit beside it, on one baseline. */
  function figure(ctx, value, unit, x, y, size, max, color, ink) {
    const us = Math.round(size * 0.3), uw = unit ? width(ctx, " " + unit, 600, us) + 20 : 0;
    const fs = fit(ctx, value, 600, size, max - uw, 80, -size * 0.035);
    const fw = text(ctx, value, x - fs * 0.03, y, { weight: 600, size: fs, color, tracking: -fs * 0.035, ink });
    if (unit) text(ctx, unit, x + fw + fs * 0.05, y, { weight: 600, size: us, color: ink.ink, ink });
  }
  const tint = (hex, a) => { const [r, g, b] = hex.match(/\w\w/g).map((v) => parseInt(v, 16)); return `rgba(${r},${g},${b},${a})`; };
  /** A lift's line: honest straight segments, a soft area under it and the latest point in the accent. No axes. */
  function plot(ctx, pts, x, y, w, h, ink, { stroke, dot, area = false }) {
    // The floor sits below the lowest point, so a short run reads as a climb rather than a corner-to-corner diagonal.
    const hi = Math.max(...pts), lo = Math.min(...pts), max = hi, min = lo - Math.max(hi - lo, 1) * 0.6, span = max - min;
    const P = pts.map((v, i) => [x + (pts.length === 1 ? w : (i * w) / (pts.length - 1)), y + h - ((v - min) / span) * h]);
    if (area) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, tint(ink.ink, 0.14)); g.addColorStop(1, tint(ink.ink, 0));
      ctx.beginPath(); ctx.moveTo(P[0][0], y + h); P.forEach(([px, py]) => ctx.lineTo(px, py)); ctx.lineTo(P[P.length - 1][0], y + h); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.save();
    if (ink.shadow) { ctx.shadowColor = ink.shadow; ctx.shadowBlur = stroke * 2.2; }
    ctx.strokeStyle = ink.ink; ctx.lineWidth = stroke; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    for (let i = 0; i < (ink.halo || 1); i++) ctx.stroke();
    // Few points: each session is a visible step.
    if (pts.length <= 6) P.slice(0, -1).forEach(([px, py]) => { ctx.fillStyle = ink.ink; ctx.beginPath(); ctx.arc(px, py, stroke * 0.95, 0, Math.PI * 2); ctx.fill(); });
    const [lx, ly] = P[P.length - 1];
    ctx.fillStyle = ink.ink; ctx.beginPath(); ctx.arc(lx, ly, dot + stroke * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = ink.accent === "#FFFFFF" ? "#B8410E" : ink.accent; ctx.beginPath(); ctx.arc(lx, ly, dot, 0, Math.PI * 2); ctx.fill();
  }
  /** Where a full-bleed block sits: bottom-anchored over a photo, centred on a flat ground, then moved by the user's drag
   *  (o.offset.y). It stays between the top safe area and the signature row. Returns the vertical shift. */
  function place(o, h, story, top, bottom) {
    const safeTop = story ? 250 : 80, sig = story ? h - 250 : h - 76, floor = sig - (story ? 100 : 64);
    let base = 0;
    if (o.ground !== "photo" && o.ground !== "clear") base = -Math.max(0, top - ((safeTop + sig) / 2 - (bottom - top) / 2 + h * 0.02));
    const ty = Math.max(safeTop - top, Math.min(Math.max(0, floor - bottom), base + (o.offset?.y || 0)));
    o.eff = { x: 0, y: ty - base };
    return ty;
  }
  /** Scales what follows around an anchor (the editor's size control). */
  function zoomAt(ctx, sc, ax, ay) { if (sc !== 1) { ctx.translate(ax, ay); ctx.scale(sc, sc); ctx.translate(-ax, -ay); } }
  // Size ranges the editor offers: full-bleed text is fitted to the card's width, so it grows less than a sticker.
  const BLOCK_RANGE = [0.75, 1.1], STICKER_RANGE = [0.6, 1.3], ROW_RANGE = [0.6, 1.1];
  function meta(ctx, card, right, y, size, ink) { text(ctx, `${card.day} · ${card.date}`, right, y, { weight: 500, size, color: ink.soft, align: "right", ink }); }

  /* ---- hero: one number (a record, or for someone starting out, the workouts they have done) ---- */
  function drawHero(ctx, w, h, card, o) {
    const story = h > w, pad = story ? 96 : 80, right = w - pad, L = card.lead;
    const S = story ? { sig: h - 250, over: 150, fig: 330, figGap: 80, name: 66, nameGap: 60, kick: 36, kickGap: 96, ls: 48, lg: 64 }
      : { sig: h - 76, over: 108, fig: 236, figGap: 60, name: 50, nameGap: 44, kick: 26, kickGap: 74, ls: 34, lg: 46 };
    const two = twoLines(ctx, L, S.ls, right - pad);
    const overY = S.sig - S.over, figY = overY - S.figGap - (two ? S.lg : 0), figTop = figY - S.fig * 0.72;
    const nameY = figTop - S.nameGap, kickY = nameY - S.name - S.kickGap * 0.35;
    const sc = o.scale || 1, b0 = overY + S.ls * 0.3, t0 = b0 - (b0 - (kickY - S.kick * 2)) * sc;
    const ty = place(o, h, story, t0 + S.kick, b0), top = t0 + ty;
    const ink = ground(ctx, w, h, o, { x: 0, y: top, w, h: h - top });
    ctx.save(); ctx.translate(0, ty); zoomAt(ctx, sc, pad, b0);
    kicker(ctx, L.kicker, pad, kickY, S.kick, ink);
    text(ctx, L.title, pad, nameY, { weight: 600, size: fit(ctx, L.title, 600, S.name, right - pad, 28), color: ink.ink, ink });
    figure(ctx, L.figure, L.unit, pad, figY, S.fig, right - pad, o.ground === "dark" ? ink.accent : ink.ink, ink);
    support(ctx, L, pad, overY, right, S.ls, ink, o.ground === "orange" ? ink.ink : ink.accent, S.lg, two);
    ctx.restore();
    signature(ctx, pad, S.sig, story ? 34 : 26, ink, o);
    meta(ctx, card, right, S.sig, story ? 32 : 24, ink);
    return { x: 0, y: top, w, h: b0 + ty - top, axis: "y", range: BLOCK_RANGE };
  }

  /* ---- progress: one lift's line ---- */
  function drawProgress(ctx, w, h, card, o) {
    const story = h > w, pad = story ? 96 : 80, right = w - pad, G = card.progress;
    const S = story ? { sig: h - 250, over: 150, fig: 250, figGap: 76, name: 62, nameGap: 56, kick: 36, kickGap: 96, ls: 48, top: 330, chartGap: 120, chartMax: 520 }
      : { sig: h - 76, over: 104, fig: 168, figGap: 52, name: 46, nameGap: 40, kick: 26, kickGap: 72, ls: 34, top: 96, chartGap: 64, chartMax: 250 };
    const overY = S.sig - S.over, figY = overY - S.figGap, figTop = figY - S.fig * 0.72;
    const nameY = figTop - S.nameGap, kickY = nameY - S.name - S.kickGap * 0.35;
    const chartBottom = kickY - S.kick - S.chartGap, chartH = Math.min(S.chartMax, chartBottom - S.top), chartTop = chartBottom - chartH;
    const ink = ground(ctx, w, h, o, { x: 0, y: chartTop - 40, w, h: h - chartTop + 40 });
    plot(ctx, G.points, pad + 8, chartTop, right - pad - 40, chartH, ink, { stroke: story ? 13 : 10, dot: story ? 18 : 14 });
    kicker(ctx, G.kicker, pad, kickY, S.kick, ink);
    text(ctx, G.name, pad, nameY, { weight: 600, size: fit(ctx, G.name, 600, S.name, right - pad, 28), color: ink.ink, ink });
    figure(ctx, G.delta, G.unit, pad, figY, S.fig, right - pad, o.ground === "dark" ? ink.accent : ink.ink, ink);
    const L = { strong: `${G.from} → ${G.to} kg`, accent: G.span };
    support(ctx, L, pad, overY, right, S.ls, ink, o.ground === "orange" ? ink.ink : ink.accent, 0, false);
    signature(ctx, pad, S.sig, story ? 34 : 26, ink, o);
    meta(ctx, card, right, S.sig, story ? 32 : 24, ink);
    return null;
  }

  /* ---- stats: four numbers ---- */
  function statCell(ctx, st, x, y, labSize, valSize, maxW, ink, align = "left") {
    const lab = st.label.toUpperCase(), tr = labSize * 0.08;
    text(ctx, lab, x, y, { weight: 600, size: fit(ctx, lab, 600, labSize, maxW, 12, tr), color: ink.soft, tracking: tr, align, ink });
    const us = Math.round(valSize * 0.42), uw = st.unit ? width(ctx, st.unit, 600, us) + valSize * 0.1 : 0;
    const vs = fit(ctx, st.value, 600, valSize, maxW - uw, 24, -valSize * 0.02);
    const vw = width(ctx, st.value, 600, vs, -vs * 0.02), tot = vw + uw;
    const left = align === "center" ? x - tot / 2 : x;
    const vy = y + vs * 0.86 + labSize * 0.6;
    text(ctx, st.value, left, vy, { weight: 600, size: vs, color: st.accent ? ink.accent : ink.ink, tracking: -vs * 0.02, ink });
    if (st.unit) text(ctx, st.unit, left + vw + valSize * 0.1, vy, { weight: 600, size: us, color: ink.soft, ink });
  }
  function drawStats(ctx, w, h, card, o) {
    const story = h > w, pad = story ? 96 : 80, colW = (w - pad * 2) / 2;
    const S = story ? { sig: h - 250, step: 268, lab: 34, val: 124, kick: 38, kickGap: 130 }
      : { sig: h - 76, step: 192, lab: 26, val: 92, kick: 28, kickGap: 94 };
    const row2 = S.sig - 120 - S.val * 0.86 - S.lab * 0.6 - (story ? 20 : 4), row1 = row2 - S.step, kickY = row1 - S.kickGap;
    const sc = o.scale || 1, b0 = row2 + S.val, t0 = b0 - (b0 - (kickY - S.kick * 2)) * sc;
    const ty = place(o, h, story, t0 + S.kick, b0), top = t0 + ty;
    const ink = ground(ctx, w, h, o, { x: 0, y: top, w, h: h - top });
    ctx.save(); ctx.translate(0, ty); zoomAt(ctx, sc, pad, b0);
    kicker(ctx, `${card.day} · ${card.date}`, pad, kickY, S.kick, ink);
    card.stats.forEach((st, i) => statCell(ctx, st, pad + (i % 2) * colW, i < 2 ? row1 : row2, S.lab, S.val, colW - 32, ink));
    ctx.restore();
    signature(ctx, pad, S.sig, story ? 34 : 26, ink, o);
    return { x: 0, y: top, w, h: b0 + ty - top, axis: "y", range: BLOCK_RANGE };
  }

  /* ---- badge: the lead on its own chip ---- */
  function drawBadge(ctx, w, h, card, o) {
    const story = h > w, k = (story ? 1 : 0.84) * (o.scale || 1), L = card.lead;
    const cw = Math.round(780 * k), padIn = 64 * k, x0 = (w - cw) / 2, inner = cw - padIn * 2;
    const S = { kick: 30 * k, name: 52 * k, fig: 220 * k, line: 40 * k, sig: 30 * k, lg: 54 * k };
    const two = twoLines(ctx, L, S.line, inner);
    const ch = Math.round(padIn + S.kick + 58 * k + S.name + 34 * k + S.fig * 0.74 + 54 * k + S.line + (two ? S.lg : 0) + 74 * k + S.sig + padIn - 8 * k);
    const m0 = story ? 130 : 40, ox = o.offset?.x || 0, oy = o.offset?.y || 0;
    const cy0 = Math.round((h - ch) / 2 + (story ? 40 : 0));
    const xa = Math.max(40, Math.min(w - cw - 40, x0 + ox)), cy = Math.round(Math.max(m0, Math.min(h - ch - m0, cy0 + oy)));
    o.eff = { x: xa - x0, y: cy - cy0 };
    // On an orange ground the chip turns dark, so it never vanishes into its own colour.
    const chipFill = o.ground === "orange" ? "#141310" : ORANGE;
    if (o.ground !== "clear") ground(ctx, w, h, o, null);
    if (o.ground === "photo" && o.photo && o.shade !== false) { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, 0, w, h); }
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.32)"; ctx.shadowBlur = 60 * k; ctx.shadowOffsetY = 18 * k;
    roundRect(ctx, xa, cy, cw, ch, 56 * k); ctx.fillStyle = chipFill; ctx.fill();
    ctx.restore();
    const ink = { ink: "#FFFFFF", soft: "rgba(255,255,255,.8)", accent: "#FFFFFF", shadow: null };
    const x = xa + padIn, right = xa + cw - padIn;
    let y = cy + padIn + S.kick * 0.75;
    kicker(ctx, L.kicker, x, y, S.kick, { ...ink, accent: o.ground === "orange" ? "#F2703B" : "#FFFFFF" });
    y += 58 * k + S.name * 0.75;
    const ns = fit(ctx, L.title, 600, S.name, right - x, 30 * k);
    text(ctx, ellipsize(ctx, L.title, 600, ns, right - x), x, y, { weight: 600, size: ns, color: ink.ink });
    y += 34 * k + S.fig * 0.74;
    figure(ctx, L.figure, L.unit, x, y, S.fig, right - x, ink.ink, ink);
    y += 54 * k + S.line * 0.75 + (two ? S.lg : 0);
    support(ctx, L, x, y, right, S.line, ink, ink.soft, S.lg, two);
    y += 74 * k + S.sig * 0.75;
    signature(ctx, x, y, S.sig, ink, o);
    meta(ctx, card, right, y, S.sig * 0.92, ink);
    return { x: xa, y: cy, w: cw, h: ch, axis: "xy", range: STICKER_RANGE };
  }

  /* ---- sticker: a transparent line and numbers row ---- */
  function drawSticker(ctx, w, h, card, o) {
    const story = h > w, k = (story ? 1.3 : 1.02) * (o.scale || 1);
    const stats = card.row;
    const lab = 30 * k, val = 104 * k, gap = 84 * k, lineH = 120 * k, lineGap = 64 * k, capGap = 60 * k;
    const cols = stats.map((st) => {
      const vw = width(ctx, st.value, 600, val, -val * 0.02) + (st.unit ? width(ctx, st.unit, 600, Math.round(val * 0.36)) + val * 0.1 : 0);
      return Math.max(vw, width(ctx, st.label.toUpperCase(), 600, lab, lab * 0.14));
    });
    const total = cols.reduce((a, b) => a + b, 0) + gap * (cols.length - 1);
    const G = card.progress, lined = !!G;
    const blockH = (lined ? capGap + lineH + lineGap : 0) + lab + val + 110 * k, my = blockH / 2 + (story ? 130 : 30);
    const cx = Math.max(total / 2 + 60, Math.min(w - total / 2 - 60, w / 2 + (o.offset?.x || 0)));
    const cyBase = story ? h * 0.58 : h * 0.52, cy = Math.max(my, Math.min(h - my, cyBase + (o.offset?.y || 0)));
    o.eff = { x: cx - w / 2, y: cy - cyBase };
    const block = { x: cx - total / 2 - 40, y: cy - blockH / 2 - 20, w: total + 80, h: blockH + 40 };
    const ink = ground(ctx, w, h, o, o.ground === "dark" ? null : block);
    // The line names what it climbs: the lift and its gain, in the label voice. Without a line the row stands alone.
    let top0 = cy - blockH / 2;
    if (lined) {
      const cap = `${G.name} ${G.delta} ${G.unit}`.toUpperCase();
      text(ctx, cap, cx, top0 + lab, { weight: 600, size: fit(ctx, cap, 600, lab, total, 14, lab * 0.1), color: ink.ink, tracking: lab * 0.1, align: "center", ink });
      top0 += capGap;
      plot(ctx, G.points, cx - total * 0.35, top0, total * 0.7, lineH, ink, { stroke: 9 * k, dot: 13 * k });
      top0 += lineH + lineGap;
    }
    let x = cx - total / 2;
    const top = top0 + lab;
    stats.forEach((st, i) => { statCell(ctx, st, x + cols[i] / 2, top, lab, val, cols[i] + 4, ink, "center"); x += cols[i] + gap; });
    signature(ctx, cx, top + val * 0.86 + lab * 0.6 + 104 * k, 30 * k, ink, o, "center");
    return { x: block.x, y: block.y - 20 * k, w: block.w, h: block.h + 70 * k, axis: "xy", range: ROW_RANGE };
  }

  /* ---- summary: the day, three numbers, every lift ---- */
  /** Splits a name into at most two lines that fit `max`; the second is shortened only if it must be. */
  function wrap(ctx, s, weight, size, max) {
    if (width(ctx, s, weight, size) <= max) return [s];
    const words = String(s).split(" ");
    let a = "";
    while (words.length && width(ctx, (a ? a + " " : "") + words[0], weight, size) <= max) a = (a ? a + " " : "") + words.shift();
    if (!a) return [ellipsize(ctx, s, weight, size, max)];
    return [a, ellipsize(ctx, words.join(" "), weight, size, max)];
  }
  function drawSummary(ctx, w, h, card, o) {
    const story = h > w, pad = story ? 96 : 80, right = w - pad, max = story ? 6 : 4;
    const S = story ? { sig: h - 250, row: 100, name: 46, stLab: 32, stVal: 76, title: 88, kick: 36 }
      : { sig: h - 76, row: 66, name: 33, stLab: 23, stVal: 54, title: 60, kick: 25 };
    const lifts = card.lifts.slice(0, card.lifts.length > max ? max - 1 : max), more = card.lifts.length - lifts.length;
    // One value column for every row, so a long name never runs into a number; long names take a second line.
    const col = Math.max(...lifts.map((l) => width(ctx, l.best, 500, S.name) + (l.record ? width(ctx, "PR", 700, S.name * 0.62, 2) + S.name * 0.5 : 0)));
    const nameMax = right - pad - col - S.name * 1.2, lh = S.name * 1.18;
    const rows = lifts.map((l) => ({ l, lines: wrap(ctx, l.name, 500, S.name, nameMax) }));
    const heights = rows.map((r) => S.row + (r.lines.length - 1) * lh);
    const listH = heights.reduce((a, b) => a + b, 0) - S.row + (more ? S.row : 0);
    const lastRow = S.sig - (story ? 130 : 92), firstRow = lastRow - listH;
    const statLabY = firstRow - S.row - S.stVal * 0.86 - S.stLab * 0.6 - (story ? 24 : 6);
    const titleY = statLabY - S.stLab - (story ? 74 : 50), kickY = titleY - S.title - (story ? 22 : 12);
    const sc = o.scale || 1, b0 = lastRow + S.name * 0.3, t0 = b0 - (b0 - (kickY - S.kick * 2)) * sc;
    const ty = place(o, h, story, t0 + S.kick, b0), top = t0 + ty;
    const ink = ground(ctx, w, h, o, { x: 0, y: top, w, h: h - top, dense: true });
    ctx.save(); ctx.translate(0, ty); zoomAt(ctx, sc, pad, b0);
    kicker(ctx, card.date, pad, kickY, S.kick, ink);
    text(ctx, card.day, pad, titleY, { weight: 600, size: fit(ctx, card.day, 600, S.title, right - pad, 30), color: ink.ink, ink });
    const colW = (right - pad) / 3;
    card.stats.slice(0, 3).forEach((st, i) => statCell(ctx, st, pad + i * colW, statLabY, S.stLab, S.stVal, colW - 24, ink));
    let y = firstRow;
    rows.forEach(({ l, lines }, i) => {
      const bw = width(ctx, l.best, 500, S.name);
      lines.forEach((t, j) => text(ctx, t, pad, y + j * lh, { weight: 500, size: S.name, color: ink.ink, ink }));
      const vy = y + (lines.length - 1) * lh;
      text(ctx, l.best, right, vy, { weight: 500, size: S.name, color: l.record ? ink.accent : ink.soft, align: "right", ink });
      if (l.record) text(ctx, "PR", right - bw - S.name * 0.4, vy - S.name * 0.06, { weight: 700, size: S.name * 0.62, color: ink.accent, align: "right", tracking: 2, ink });
      y += heights[i];
    });
    if (more) text(ctx, card.more(more), pad, y, { weight: 500, size: S.name * 0.86, color: ink.soft, ink });
    ctx.restore();
    signature(ctx, pad, S.sig, story ? 34 : 26, ink, o);
    return { x: 0, y: top, w, h: b0 + ty - top, axis: "y", range: BLOCK_RANGE };
  }

  const DRAW = { hero: drawHero, progress: drawProgress, stats: drawStats, badge: drawBadge, sticker: drawSticker, summary: drawSummary };
  /** Paints one card into a new canvas and returns it with what it drew, so a proof can read it back. `shade` (photo
   *  only) darkens behind the type; off, the ink adapts to the photo instead. `offset` (canvas pixels) and `scale` come
   *  from the editor. `drawn.hit` is the movable region, its axis, its size range and where it landed, or null when the
   *  template's layout is fixed. Null for a template the card cannot fill (Progress without a line). */
  function render(card, { template, size, ground: g = "photo", photo = null, mark = null, shade = true, offset = null, scale = 1, doc = root.document } = {}) {
    if (!SIZES[size] || !DRAW[template] || !OFFERS[template].includes(g) || (template === "progress" && !card.progress)) return null;
    const [w, h] = SIZES[size];
    const canvas = doc.createElement("canvas"); canvas.width = w; canvas.height = h;
    const o = { ground: g, photo: g === "photo" ? photo : null, mark, shade, offset, scale, doc };
    const hit = DRAW[template](canvas.getContext("2d"), w, h, card, o) || null;
    // Where the content actually landed after clamping, so a drag past an edge never leaves a dead zone on the way back.
    if (hit) hit.offset = o.eff || { x: 0, y: 0 };
    return { canvas, drawn: { template, size, ground: g, photo: !!o.photo, shade: g === "photo" ? shade !== false : null, hit } };
  }
  /** The PNG that is shared or saved. */
  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  root.TauriferShareCards = Object.freeze({ ready, render, toBlob, SIZES, TEMPLATES, GROUNDS, OFFERS });
})(typeof window !== "undefined" ? window : globalThis);
