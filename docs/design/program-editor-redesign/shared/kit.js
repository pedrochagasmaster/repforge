// Program editor redesign: drawing kit shared by the three candidates.
// Static review frames only. ?lang=pt|en and ?theme=light|dark pick the variant.
// t(pt, en) draws a string that already ships (the key is noted beside it).
// n(pt, en) draws a NEW string: it is recorded in window.__newStrings so the
// README can list every string that needs owner approval.
(function () {
  const q = new URLSearchParams(location.search);
  const lang = q.get("lang") === "en" ? "en" : "pt";
  const theme = q.get("theme") === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  const seen = new Map();
  window.__newStrings = [];
  window.__existing = [];
  const t = (pt, en) => { window.__existing.push({ pt, en }); return lang === "pt" ? pt : en; };
  const n = (pt, en) => {
    const key = pt + "|" + en;
    if (!seen.has(key)) { seen.set(key, true); window.__newStrings.push({ pt, en }); }
    return lang === "pt" ? pt : en;
  };
  const img = id => `../../../../assets/exercises/${id}.webp`;
  // Values in Mono, words in Sans: "4–6" is training data, "reps" is language.
  const v = s => `<span class="num">${s}</span>`;
  const reps = (a, b) => `<span class="nowrap">${v(`${a}–${b}`)}&nbsp;reps</span>`;

  const EX = [
    { id: "bench", art: "pr_bb", pt: "Supino reto com barra", en: "Barbell bench press", sets: 3, min: 4, max: 6, rir: [2, 1, 1], rest: 180, musclesPt: "Peito · Tríceps", musclesEn: "Chest · Triceps", step: "2,5" },
    { id: "row", art: "rw_bb", pt: "Remada curvada com barra", en: "Bent-over barbell row", sets: 3, min: 7, max: 9, rir: [2, 1, 1], rest: 150, musclesPt: "Costas · Bíceps", musclesEn: "Back · Biceps" },
    { id: "ohp", art: "sp_bb", pt: "Desenvolvimento militar com barra", en: "Barbell overhead press", sets: 3, min: 4, max: 6, rir: [2, 2, 1], rest: 180, musclesPt: "Ombros · Tríceps", musclesEn: "Shoulders · Triceps" },
    { id: "pull", art: "pupn_bw", pt: "Barra fixa com carga pegada neutra", en: "Neutral grip weighted pull-up", sets: 3, min: 7, max: 9, rir: [2, 1, 1], rest: 150, musclesPt: "Costas · Bíceps", musclesEn: "Back · Biceps" },
    { id: "lat", art: "lr_db", pt: "Elevação lateral sentado com halteres", en: "Seated dumbbell lateral raise", sets: 3, min: 12, max: 15, rir: [1, 1, 0], rest: 90, musclesPt: "Ombros", musclesEn: "Shoulders" },
  ];
  const DAYS = [
    { pt: "Superior @ Academia", en: "Upper @ Commercial Gym", n: 5, min: 58 },
    { pt: "Inferior @ Academia", en: "Lower @ Commercial Gym", n: 5, min: 54 },
    { pt: "Superior B", en: "Upper B", n: 6, min: 61 },
    { pt: "Inferior B", en: "Lower B", n: 4, min: 47 },
  ];
  const exName = e => t(e.pt, e.en);
  const status = () => `<div class="status"><span>9:41</span><i><span style="font-size:13px">▮▮▮</span><b></b></i></div>`;

  function render(screens) {
    const only = q.get("only");
    document.body.innerHTML = screens
      .filter(s => !only || s.id === only)
      .map(s => `<section class="phone" id="${s.id}" data-title="${s.title || ""}">${status()}${s.html()}</section>`)
      .join("");
    document.body.dataset.ready = "true";
  }
  window.Kit = { lang, theme, t, n, v, reps, img, EX, DAYS, exName, render };
})();
