/* Review harness controls. The candidate documents run in iframes so the
   text-scale, theme and locale of the page under review never touch the
   harness chrome, and so several candidates can be compared side by side on
   the exact same checkpoint. */
(function () {
  const ROUNDS = {
    1: {
      doc: "app.html",
      candidates: {
        a: { name: "A · Uma pergunta", thesis: { en: "Never make a new lifter choose a method: ask the three questions that change the program, show the program immediately, and offer every other route as a refinement of what they are looking at.", pt: "Nunca faça um iniciante escolher um método: pergunte as três coisas que mudam o programa, mostre o programa na hora e ofereça as outras rotas como ajustes do que está na tela." }, axis: "Progressive questioning · deferred route choice · result is the review · requires a product decision (routes merged into one guided path)" },
        b: { name: "B · Cinco portas honestas", thesis: { en: "Keep the five jobs and make choosing one cheap: every door states its cost and its outcome, questions stay grouped by consequence, and the result leads with the program itself rather than with reasons.", pt: "Mantenha os cinco caminhos e torne a escolha barata: cada porta diz o que custa e o que entrega, as perguntas ficam agrupadas por consequência, e o resultado começa pelo programa, não pelos motivos." }, axis: "Up-front route choice with transparent cost · configure-then-preview · implementable without product-policy changes" },
        c: { name: "C · Programa primeiro", thesis: { en: "Show a real, trainable program before asking anything, and let the lifter correct the facts it was built from directly on the program until it is theirs.", pt: "Mostre um programa real e treinável antes de perguntar qualquer coisa, e deixe o praticante corrigir os fatos que o geraram diretamente no programa até ele ser dele." }, axis: "Immediate preview · preview-and-edit · facts as editable chips · requires a product decision (default answers before the user answers)" },
      },
    },
    /* Round 2: the generator registers d, e, f here (name, thesis, axis).
       round-2/app.html loads round-2/candidates/<id>.{js,css} on demand. */
    2: { doc: "round-2/app.html", candidates: {} },
  };
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  let CHECKPOINTS = [], SCENARIOS = {};
  const state = {
    round: params.get("round") || "1", cands: params.get("cands") || "all", scenario: params.get("s") || "1", cp: params.get("cp") || "landing",
    lang: params.get("lang") || "pt", theme: params.get("theme") || "light", vw: params.get("vw") || "390", text: params.get("text") || "100", motion: params.get("motion") || "normal",
  };
  async function loadContract() {
    // The checkpoint list lives in runtime.js; read it through a throwaway frame
    // so the harness never carries a second copy of the contract.
    return new Promise((resolve) => {
      const round = ROUNDS[state.round] || ROUNDS[1];
      const f = document.createElement("iframe"); f.style.display = "none"; f.src = round.doc + "?c=" + (Object.keys(round.candidates)[0] || "") + "&cp=none";
      f.onload = () => { try { CHECKPOINTS = f.contentWindow.TF.CHECKPOINTS; SCENARIOS = f.contentWindow.TF.SCENARIOS; } catch (e) { CHECKPOINTS = []; } f.remove(); resolve(); };
      document.body.appendChild(f);
    });
  }
  function fill() {
    const round = ROUNDS[state.round] || ROUNDS[1];
    const cands = $("#cands"); cands.innerHTML = `<option value="all">All side by side</option>` + Object.entries(round.candidates).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join("");
    cands.value = state.cands;
    const sc = $("#scenario"); sc.innerHTML = Object.entries(SCENARIOS).map(([n, l]) => `<option value="${n}">${n}. ${l}</option>`).join(""); sc.value = state.scenario;
    const cps = CHECKPOINTS.filter((c) => c.scenario === state.scenario);
    if (!cps.some((c) => c.id === state.cp)) state.cp = cps[0]?.id || state.cp;
    const cp = $("#cp"); cp.innerHTML = cps.map((c) => `<option value="${c.id}">${c.id}</option>`).join(""); cp.value = state.cp;
    for (const k of ["round", "lang", "theme", "vw", "text", "motion"]) $("#" + k).value = state[k];
    const desc = CHECKPOINTS.find((c) => c.id === state.cp);
    $("#cpDesc").textContent = desc ? `${desc.id} — ${desc.label} · seed: ${desc.seed}` : "";
    $("#theses").innerHTML = Object.entries(round.candidates).map(([id, c]) => `<div class="thesis"><h3>${c.name}</h3><p>${c.thesis[state.lang === "pt" ? "pt" : "en"]}</p><p class="axis">${c.axis}</p></div>`).join("");
    $("#roundLabel").textContent = "Round " + state.round;
  }
  function render() {
    fill();
    const round = ROUNDS[state.round] || ROUNDS[1];
    const ids = state.cands === "all" ? Object.keys(round.candidates) : [state.cands];
    const h = state.vw === "320" ? 568 : state.vw === "430" ? 932 : 844;
    $("#frames").innerHTML = ids.map((id) => {
      const src = `${round.doc}?c=${id}&cp=${encodeURIComponent(state.cp)}&lang=${state.lang}&theme=${state.theme}&text=${state.text}&motion=${state.motion}`;
      return `<div class="frame"><div class="frame__label"><b>${round.candidates[id].name}</b><a href="${src}" target="_blank" rel="noopener">open ↗</a></div><div class="frame__phone"><iframe title="${round.candidates[id].name} — ${state.cp}" src="${src}" width="${state.vw}" height="${h}"></iframe></div></div>`;
    }).join("");
    const url = new URL(location.href); for (const [k, v] of Object.entries({ round: state.round, cands: state.cands, s: state.scenario, cp: state.cp, lang: state.lang, theme: state.theme, vw: state.vw, text: state.text, motion: state.motion })) url.searchParams.set(k, v);
    history.replaceState(null, "", url);
  }
  for (const k of ["round", "cands", "scenario", "cp", "lang", "theme", "vw", "text", "motion"]) $("#" + k).addEventListener("change", async (e) => {
    state[k] = e.target.value;
    if (k === "scenario") state.cp = CHECKPOINTS.find((c) => c.scenario === state.scenario)?.id || state.cp;
    if (k === "round") await loadContract();
    render();
  });
  function step(delta) { const i = CHECKPOINTS.findIndex((c) => c.id === state.cp); const n = CHECKPOINTS[(i + delta + CHECKPOINTS.length) % CHECKPOINTS.length]; state.cp = n.id; state.scenario = n.scenario; render(); }
  $("#prev").onclick = () => step(-1); $("#next").onclick = () => step(1);
  loadContract().then(render);
})();
