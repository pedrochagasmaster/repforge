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
    /* Round 2: round-2/app.html loads round-2/candidates/<id>.{js,css}. */
    2: {
      doc: "round-2/app.html",
      candidates: {
        d: { name: "D · Cinco portas, uma revisão", thesis: { en: "The synthesis spec built as written: five honest doors up front, the required answers in five grouped sections, and one review that is the result, where every answer is corrected in place with a true statement of what changed.", pt: "A especificação de síntese construída como escrita: cinco portas honestas logo no início, as respostas obrigatórias em cinco seções agrupadas e uma revisão que é o resultado, onde cada resposta é corrigida no lugar com uma frase verdadeira sobre o que mudou." }, axis: "Control · every open item takes the spec's default · up-front chooser · no product decision" },
        e: { name: "E · Uma pergunta por vez", thesis: { en: "Start is a conversation, not a menu: Taurifer asks one thing at a time and builds the program, and every other way to get a program stays one explicit, named, reversible step away from the question you are on and from the program you are looking at.", pt: "Começar é uma conversa, não um menu: o Taurifer pergunta uma coisa de cada vez e monta o programa, e todas as outras formas de ter um programa ficam a um passo explícito, nomeado e reversível da pergunta em que você está e do programa que você está vendo." }, axis: "Deferred route choice · one question per screen · the review is the hub, edited inline · requires a product decision (PD-1)" },
        f: { name: "F · A primeira pergunta", thesis: { en: "Choosing a route should cost nothing extra, so the chooser opens on Recommend's first question (answering it is choosing Recommend), and every screen after that keeps the program in view: answers as chips, each corrected in a bottom sheet and followed by a before/after count.", pt: "Escolher um caminho não deve custar nada a mais: o seletor abre na primeira pergunta da recomendação (responder já é escolher Recomendar), e cada tela depois disso mantém o programa à vista: respostas como chips, cada uma corrigida numa folha inferior e seguida de uma contagem de antes e depois." }, axis: "Cheaper up-front chooser without a product decision · hybrid grouping · chips and before/after counts · Build as the third import door" },
      },
    },
    /* Round 3: one synthesis candidate, acceptance-checked, not judged (Q626). */
    3: {
      doc: "round-3/app.html",
      candidates: {
        g: { name: "G · Síntese", thesis: { en: "The synthesis both Round 2 judges converged on: D's structure, F's first-question chooser and before/after count, E's inline editing, with every defect the judges found fixed and checked.", pt: "A síntese em que os dois juízes da Rodada 2 convergiram: a estrutura de D, o seletor de primeira pergunta e a contagem antes/depois de F, a edição no lugar de E, com cada defeito encontrado pelos juízes corrigido e verificado." }, axis: "Owner decisions Q622–Q637 · no product decision · acceptance checks K-1–K-32, no judges" },
      },
    },
    /* Round 4: five bold directions, each in its own visual world, built to
       finish quality on the core journey only (core: the states below). The
       owner picks what advances; reviews assist. */
    4: {
      doc: "round-4/app.html",
      core: ["landing", "route-choice", "hub-existing", "rec-goal", "rec-background", "rec-schedule", "rec-environment", "rec-priorities", "rec-result", "rec-env-correction", "rec-result-corrected", "activate", "replace-confirm", "activation-conflict", "cancel-confirm", "activated-today", "ff-empty", "ff-reply", "ff-gaps", "import-review", "import-preview"],
      candidates: {
        h: { name: "H · Concreto", thesis: { en: "Onboarding is a sequence of concrete poems: each screen is one typographic composition on a six-column grid, one monumental lowercase word states the decision, the answers are words placed in the composition, and the choice floods its cell with a single vermilion field.", pt: "O onboarding é uma sequência de poemas concretos: cada tela é uma composição tipográfica numa grade de seis colunas, uma palavra monumental em minúsculas diz a decisão, as respostas são palavras na composição e a escolha inunda a célula com um único campo vermelhão." }, axis: "Typographic poster world (Jost, black rules, one vermilion) · no product decision · Rafael 18 taps" },
        i: { name: "I · Ficha", thesis: { en: "Setup is filling in your own gym training card: every answer is written onto the card in your pen, the review is the completed card, and activation date-stamps it and hands it to Today.", pt: "Configurar é preencher a sua própria ficha de treino: cada resposta é escrita no cartão com a sua caneta, a revisão é a ficha completa, e ativar carimba a data e entrega a ficha ao Hoje." }, axis: "Paper-form world (coloured cardstock, BIC-blue pen, red stamp) · no product decision · Rafael 13 taps" },
        j: { name: "J · Conversa", thesis: { en: "Setup is a chat you already know how to use: Taurifer asks, you answer with a quick reply, your program arrives as a message, and you correct it by replying to the line you want changed. No typing indicator, no first person, no free-text reading.", pt: "Configurar é uma conversa que você já sabe usar: o Taurifer pergunta, você responde com um toque, o programa chega como mensagem, e você corrige respondendo à linha que quer mudar. Sem “digitando”, sem primeira pessoa, sem leitura de texto livre." }, axis: "Messaging world (bubbles, quick replies, reply-to-correct) · reopens PD-1 (no chooser; paste and file doors in the thread) · Rafael 11 taps" },
        k: { name: "K · Linhas", thesis: { en: "Setup is a trip on a metro network: the five ways in are five coloured lines on one map, each step is a station, the cost of a route is counted in stations, and every line ends at the same terminal: your program, then Today.", pt: "Configurar é uma viagem de metrô: as cinco formas de começar são cinco linhas coloridas num mapa, cada passo é uma estação, o custo de um caminho se conta em estações, e toda linha termina no mesmo terminal: o seu programa, depois o Hoje." }, axis: "Wayfinding world (São Paulo Metrô signage, line colours carry routes) · no product decision · Rafael 14 taps" },
        l: { name: "L · Pino", thesis: { en: "The program exists before the questions: Recommend opens on a real program built from labelled defaults, every answer is a selector pin the lifter moves while the program recompiles under their thumb, and activation stays locked until every pin was set by the lifter.", pt: "O programa existe antes das perguntas: a recomendação abre num programa real montado com padrões identificados, cada resposta é um pino que o praticante move enquanto o programa se refaz sob o dedo, e ativar fica travado até todos os pinos serem escolhidos por ele." }, axis: "Weight-stack world (powder-coat plates, selector pin, stencil) · reopens PD-4 (a program before answers) · Rafael 10 taps" },
      },
    },
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
  /* A round may declare the states it was built for (Round 4: core only). */
  function visibleCps() { const core = (ROUNDS[state.round] || ROUNDS[1]).core; return core ? CHECKPOINTS.filter((c) => core.includes(c.id)) : CHECKPOINTS; }
  function fill() {
    const round = ROUNDS[state.round] || ROUNDS[1];
    const cands = $("#cands"); cands.innerHTML = `<option value="all">All side by side</option>` + Object.entries(round.candidates).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join("");
    cands.value = state.cands;
    const scs = new Set(visibleCps().map((c) => c.scenario));
    if (!scs.has(state.scenario)) state.scenario = visibleCps()[0]?.scenario || state.scenario;
    const sc = $("#scenario"); sc.innerHTML = Object.entries(SCENARIOS).filter(([n]) => scs.has(n)).map(([n, l]) => `<option value="${n}">${n}. ${l}</option>`).join(""); sc.value = state.scenario;
    const cps = visibleCps().filter((c) => c.scenario === state.scenario);
    if (!cps.some((c) => c.id === state.cp)) state.cp = cps[0]?.id || state.cp;
    const cp = $("#cp"); cp.innerHTML = cps.map((c) => `<option value="${c.id}">${c.id}</option>`).join(""); cp.value = state.cp;
    for (const k of ["round", "lang", "theme", "vw", "text", "motion"]) $("#" + k).value = state[k];
    const desc = CHECKPOINTS.find((c) => c.id === state.cp);
    $("#cpDesc").textContent = desc ? `${desc.id} — ${desc.label} · seed: ${desc.seed}` : "";
    $("#theses").innerHTML = Object.entries(round.candidates).map(([id, c]) => `<div class="thesis"><h3>${c.name}</h3><p>${c.thesis[state.lang === "pt" ? "pt" : "en"]}</p><p class="axis">${c.axis}</p></div>`).join("");
    $("#roundLabel").textContent = "Round " + state.round;
    summary();
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
    if (k === "scenario") state.cp = visibleCps().find((c) => c.scenario === state.scenario)?.id || state.cp;
    if (k === "round") await loadContract();
    render();
  });
  /* Collapsible controls: the bar folds to a one-line summary (and the
     header and state description hide) so the phones get the room.
     Remembered per browser; storage may be unavailable. */
  const COLLAPSE_KEY = "tournamentHarnessControlsCollapsed";
  function setCollapsed(on) {
    $("#ctl").classList.toggle("is-collapsed", on); document.body.classList.toggle("is-compact", on);
    const b = $("#ctlToggle"); b.setAttribute("aria-expanded", String(!on)); b.textContent = on ? "Show controls" : "Hide controls";
    try { localStorage.setItem(COLLAPSE_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  function summary() {
    const round = ROUNDS[state.round] || ROUNDS[1];
    const cands = state.cands === "all" ? Object.values(round.candidates).map((c) => c.name.split(" · ")[0]).join(", ") : (round.candidates[state.cands]?.name || state.cands);
    $("#ctlSummary").textContent = `Round ${state.round} · ${cands} · ${state.cp} · ${state.lang === "pt" ? "PT-BR" : "EN"} · ${state.theme} · ${state.vw} px · ${state.text}%${state.motion === "reduced" ? " · reduced motion" : ""}`;
  }
  $("#ctlToggle").addEventListener("click", () => setCollapsed(!$("#ctl").classList.contains("is-collapsed")));
  try { if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true); } catch (e) { /* ignore */ }
  function step(delta) { const L = visibleCps(); const i = L.findIndex((c) => c.id === state.cp); const n = L[(i + delta + L.length) % L.length]; state.cp = n.id; state.scenario = n.scenario; render(); }
  $("#prev").onclick = () => step(-1); $("#next").onclick = () => step(1);
  /* A link that names a state but no scenario opens on that state. */
  loadContract().then(() => { if (params.get("cp") && !params.get("s")) { const c = CHECKPOINTS.find((x) => x.id === params.get("cp")); if (c) state.scenario = c.scenario; } render(); });
})();
