/* Disposable fixtures. No app boot, engine, telemetry or persistence. */
const query = new URLSearchParams(location.search);
let variant = query.get('variant') || 'A';
const lang = query.get('lang') || 'pt';
const theme = query.get('theme') || 'light';
const screen = query.get('screen') || 'today';
const stage = query.get('stage') || 'mid';
const pt = lang === 'pt';
const words = (en, br) => pt ? br : en;
const fixtures = {
  fresh: { earned: 0, sources: 0, findings: 0, tests: 0 },
  mid: { earned: 2, sources: 6, findings: 4, tests: 1 },
  full: { earned: 4, sources: 18, findings: 7, tests: 4 },
};
const state = screen === 'finish' ? fixtures.mid : fixtures[stage];
const title = words('Training foundation', 'Base do treino');
const names = [words('Machine chest press', 'Supino na máquina'), words('Cable row', 'Remada no cabo'), 'Leg press', words('Lat pulldown', 'Puxada alta')];
const directionNames = { A: words('Evidence ring', 'Anel de evidências'), B: words('Coverage rail', 'Cobertura por exercício'), C: words('History in use', 'Histórico em uso') };
document.documentElement.lang = pt ? 'pt-BR' : 'en';
document.documentElement.dataset.theme = theme;
document.body.classList.toggle('capture', query.has('capture'));
const sourceText = n => words(`${n} sessions informing your targets`, `${n} sessões na base das suas metas`);
const coverageText = n => words(`${n} of 4 lifts have informed a target`, `${n} de 4 exercícios já embasaram uma meta`);
const meaning = words('Saved work. A basis formed. A later target put to use.', 'Séries salvas. Uma base formada. Uma meta usada depois.');
function href(nextScreen, nextStage = stage) {
  const q = new URLSearchParams(location.search);
  q.set('variant', variant); q.set('screen', nextScreen); q.set('stage', nextStage);
  return `?${q}`;
}
function ring(n, large = false) {
  return `<svg class="ring${large ? ' large' : ''}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="23 2"/><circle class="filled" cx="32" cy="32" r="27" pathLength="100" data-earned="${n}"/><text x="32" y="37" text-anchor="middle" class="ring-number">${n}/4</text></svg>`;
}
function rail(n) {
  return `<div class="coverage" aria-hidden="true">${[0,1,2,3].map(i => `<span data-segment="${i}" class="${i < n ? 'done' : ''}"></span>`).join('')}</div>`;
}
function ticks(n) {
  return `<div class="ticks" aria-hidden="true">${Array.from({length: Math.min(n, 12)}, () => '<i></i>').join('')}</div>`;
}
function gauge(n, sessions, compact = false) {
  if (variant === 'A') {
    return `<div class="foundation-reading">${ring(n, !compact)}<div><p class="foundation-heading">${title}</p>${compact ? '' : `<p class="hint">${coverageText(n)}</p><p class="foundation-label">${sourceText(sessions)}</p>`}</div></div>`;
  }
  if (variant === 'B') {
    return `<p class="foundation-heading">${title}</p>${rail(n)}<div class="foundation-reading"><p class="big">${n}/4</p><p class="foundation-label">${words('lifts with a basis used in a target', 'exercícios com uma base usada numa meta')}</p></div>`;
  }
  return `<p class="foundation-heading">${title}</p><div class="history-use"><strong class="source-number">${sessions}</strong><p>${words('sessions informing<br>your targets', 'sessões na base<br>das suas metas')}</p></div>${ticks(sessions)}`;
}
function status() { return '<div class="statusbar" aria-hidden="true"><span>9:41</span><span>▰ ▰ ▰</span></div>'; }
function dock(active) {
  const routes = [['today', words('Today','Hoje'),'log'],['overview',words('Progress','Progresso'),'stats'],['history',words('History','Histórico'),'history'],['program',words('Program','Treino'),'program']];
  return `<nav class="dock" aria-label="${words('Main navigation','Navegação principal')}">${routes.map(([id,label,icon]) => `<a ${id === active ? 'class="active" aria-current="page"' : ''} href="${href(id === 'today' ? 'today' : 'overview')}"><span class="nav__icon" data-i="${icon}" aria-hidden="true"></span>${label}</a>`).join('')}</nav>`;
}
function head(text, right = '') {
  return `<header class="pagehead"><div class="pagehead__titles"><h1>${text}</h1>${screen === 'today' ? `<p class="page-date">${words('Wednesday, November 11','Quarta-feira, 11 de novembro')}</p>` : ''}</div>${right}</header>`;
}
function today() {
  const right = variant === 'A' ? `<a class="ring-link" href="${href('overview')}" aria-label="${title}. ${coverageText(state.earned)}. ${words('Open evidence','Abrir evidências')}">${ring(state.earned)}<span class="foundation-label">${title}</span></a>` : '<span class="gear" aria-hidden="true"><span class="icon-mask icon-mask--gear"></span></span>';
  const reading = variant === 'A' ? `<p class="scope-note">${coverageText(state.earned)}</p>` : `<a href="${href('overview')}" class="foundation foundation--inline">${gauge(state.earned, state.sources, true)}</a>`;
  const need = stage === 'fresh' ? words('Your first saved sets give Taurifer a place to start.', 'Suas primeiras séries salvas dão uma base ao Taurifer.') : stage === 'full' ? words('Your history has informed every lift.', 'Seu histórico já embasou todos os exercícios.') : words('Next: more comparable sets on leg press.', 'A seguir: mais séries comparáveis no leg press.');
  return `${status()}<main>${head(words('Today','Hoje'),right)}<p class="eyebrow">${words('Your program','Seu treino')}</p><p class="program-name">${words('Full body','Corpo inteiro')}</p><p class="meta">${words('Day A · 4 exercises · 12 sets','Dia A · 4 exercícios · 12 séries')}</p>${reading}<p class="hint">${need}</p><section class="today-training"><h2>${words('This session','Esta sessão')}</h2>${names.map((name,i) => `<div class="rxrow"><div class="rxrow__name">${name}<span class="rxrow__sub">3 × ${i === 2 ? '10–12' : '8–10'}</span></div><span class="rxrow__load">${stage === 'fresh' ? '—' : [40,35,100,40][i]} kg</span><span class="rxrow__target">${stage === 'fresh' ? '—' : [10,10,12,10][i]} ${words('reps','reps')}</span></div>`).join('')}<button class="btn btn--cta" data-open-finish>${words('Start session','Começar sessão')}</button></section><p class="scope-note">${words('Prototype · synthetic saved evidence', 'Protótipo · evidências salvas fictícias')}</p></main>${dock('today')}`;
}
function profileRows() {
  return `<ul class="profile-lifts">${(variant === 'B' ? names.slice(0,2) : names).map((name,i) => {
    const solid = stage === 'full' || (stage !== 'fresh' && i < 2);
    const standing = solid ? words('Solid','Bem fundamentada') : stage === 'fresh' || i === 3 ? words('First time on this lift','Primeira vez neste exercício') : words('Still learning this lift','Ainda conhecendo este exercício');
    const evidence = solid ? words('12 sets over 4 sessions', '12 séries em 4 sessões') : stage === 'fresh' || i === 3 ? words('No comparable sets yet','Ainda sem séries comparáveis') : words('4 sets over 2 sessions','4 séries em 2 sessões');
    return `<li class="profile-lift"><h3 class="profile-lift__name">${name}<span class="profile-state">${standing}</span></h3><p>${evidence}</p></li>`;
  }).join('')}</ul>`;
}
function chainTable() {
  return `<table class="chain-table"><caption class="visually-hidden">${meaning}</caption><thead><tr><th>${words('Exercise','Exercício')}</th><th>${words('Load','Carga')}</th><th>${words('Basis','Base')}</th><th>${words('Used','Usada')}</th></tr></thead><tbody>${names.map((name,i) => `<tr><td>${name}</td>${[stage === 'full' || (stage !== 'fresh' && i < 3), stage === 'full' || (stage !== 'fresh' && i < 2), stage === 'full' || (stage !== 'fresh' && i < 2)].map(done => `<td class="${done ? 'has' : ''}">${done ? words('Yes','Sim') : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function finding(finish = false) {
  return `<section class="profile-finding"><p class="eyebrow">${finish ? words('New today','Novidade de hoje') : words('Latest finding','Última descoberta')}</p><time datetime="2026-11-11">11 ${words('Nov','nov')}</time><p>${words('Your first test set: you guessed 11 on cable row and did 14.', 'Sua primeira série-teste: você estimou 11 na remada no cabo e fez 14.')}</p><p class="hint">${words('2 more test sets on cable row before anything changes.', 'Mais 2 séries-teste na remada no cabo antes de algo mudar.')}</p></section>`;
}
function overview() {
  const explanation = variant === 'A' ? `<p class="hint">${words('Your history has informed these lifts.', 'Seu histórico já embasou estes exercícios.')}</p>` : variant === 'B' ? chainTable() : `<div class="source-line"><span>04 ${words('Nov','nov')}</span><span>${words('Row sets → today’s target','Séries de remada → meta de hoje')}</span></div><p class="scope-note">${coverageText(state.earned)}</p>`;
  return `${status()}<main class="overview-main">${head(words('Progress','Progresso'))}<div class="tabrow" aria-label="${words('Progress sections','Seções de progresso')}"><span>${words('Overview','Visão geral')}</span><span>${words('Strength','Força')}</span><span>${words('Review','Revisão')}</span><span>${words('Volume','Volume')}</span></div><h2>${words('What Taurifer knows about you','O que o Taurifer sabe sobre você')}</h2><div class="foundation-detail" data-direction="${variant}">${gauge(state.earned,state.sources)}${explanation}<p class="scope-note rest-note">${words('Earned evidence stays through rest.', 'O que já foi aprendido permanece nas pausas.')}</p></div><div class="profile-preview">${profileRows()}</div>${stage === 'fresh' ? `<p class="hint">${words('Findings appear when your saved record supports them.','As descobertas aparecem quando seu histórico dá base para elas.')}</p>` : finding()}${query.get('return') === 'finish' ? `<a class="text-link" href="${href('finish')}">${words('Back to session summary','Voltar ao resumo da sessão')}</a>` : ''}</main>${dock('overview')}`;
}
function finish() {
  const open = new URL(href('overview','mid'),location.href); open.searchParams.set('return','finish');
  return `${status()}<main class="finish-main"><p class="eyebrow">${words('Session saved','Sessão salva')}</p><h1 class="sum-hero">${words('Day A','Dia A')}</h1><p class="meta">${words('Full body · November 11','Corpo inteiro · 11 de novembro')}</p><div class="totals"><div><b>12</b><small>${words('sets','séries')}</small></div><div><b>4</b><small>${words('exercises','exercícios')}</small></div><div><b>42 min</b><small>${words('duration','duração')}</small></div></div><section class="finish-proof"><div class="foundation-detail">${gauge(1,5)}</div><p><b>${words('Cable row now has a basis put to use.', 'A remada no cabo agora tem uma base usada numa meta.')}</b></p><p class="hint">${words('From 1 to 2 of 4 lifts. Your November 4 sets informed today’s 35 kg target.', 'De 1 para 2 de 4 exercícios. Suas séries de 4 de novembro embasaram a meta de 35 kg de hoje.')}</p><a class="text-link" href="${open.pathname}${open.search}">${words('See the saved evidence','Ver as evidências salvas')}</a></section>${finding(true)}<section class="finish-lift"><h3>${names[1]}</h3><p><strong>35 kg × 10 · 10 · 9</strong></p><p class="hint">${words('vs last time: maintained','vs última sessão: manteve')}</p></section></main><footer class="finish-actions"><a class="btn btn--cta" href="${href('today','mid')}">${words('Done','Concluir')}</a></footer>`;
}
function paint() {
  document.querySelector('#phone').innerHTML = screen === 'overview' ? overview() : screen === 'finish' ? finish() : today();
  requestAnimationFrame(() => document.querySelectorAll('.filled').forEach(el => { el.style.strokeDasharray = `${Number(el.dataset.earned)*25} 100`; }));
  document.querySelector('[data-open-finish]')?.addEventListener('click', () => { location.href = href('finish','mid'); });
}
function completeSavedChange() {
  document.querySelectorAll('.filled').forEach(el => { el.style.strokeDasharray = '50 100'; });
  document.querySelectorAll('.ring-number').forEach(el => { el.textContent = '2/4'; });
  const segment = document.querySelector('[data-segment="1"]');
  if (segment) { segment.classList.add('done'); document.querySelector('.big').textContent = '2/4'; }
  const source = document.querySelector('.source-number');
  if (source) { source.textContent = '6'; document.querySelector('.ticks').insertAdjacentHTML('beforeend','<i></i>'); }
  const label = document.querySelector('.foundation-reading .hint');
  if (label) label.textContent = coverageText(2);
  const sources = variant === 'A' ? document.querySelector('.foundation-reading .foundation-label') : null;
  if (sources) sources.textContent = sourceText(6);
  document.querySelector('#phone').dataset.saved = 'after';
}
window.replaySavedChange = () => {
  paint();
  document.querySelector('#phone').dataset.saved = 'before';
  requestAnimationFrame(() => requestAnimationFrame(completeSavedChange));
};
paint();
if (screen === 'finish' && query.get('freeze') !== 'before') requestAnimationFrame(() => requestAnimationFrame(completeSavedChange));
for (const key of ['screen','stage','lang','theme']) {
  document.getElementById(key).value = {screen,stage,lang,theme}[key];
  document.getElementById(key).onchange = event => { const q = new URLSearchParams(location.search); q.set(key,event.target.value); location.search = q; };
}
function cycle(delta) { const q = new URLSearchParams(location.search); q.set('variant',['A','B','C'][(['A','B','C'].indexOf(variant)+delta+3)%3]); location.search = q; }
document.getElementById('previous').onclick = () => cycle(-1);
document.getElementById('next').onclick = () => cycle(1);
document.getElementById('direction').textContent = `${variant} · ${directionNames[variant]}`;
document.getElementById('replay').disabled = screen !== 'finish';
document.getElementById('replay').onclick = window.replaySavedChange;
document.getElementById('fixture').textContent = `DISPOSABLE / ${screen === 'finish' ? 'earned 1→2 / sources 5→6' : `earned ${state.earned}/4 / sources ${state.sources} / findings ${state.findings} / tests ${state.tests}`} / no storage, telemetry or app runtime`;
document.addEventListener('keydown', event => { if (['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return; if (event.key === 'ArrowLeft') cycle(-1); if (event.key === 'ArrowRight') cycle(1); });
