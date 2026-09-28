/* Shared tournament runtime. Every candidate runs on this; none may bypass it.
 *
 * What is REAL product logic here (vendored verbatim from the PR #256 head):
 *   - RepForgeProgramEntry: state, validation, resume/rules-drift, activation
 *     readiness and candidate activation issues.
 *   - RepForgeProgramEntryAdapter + RepForgeProgramCompiler + EXERCISE_LIBRARY:
 *     every generated program, browse card, split choice and explanation.
 *   - RepForgeSharedSetup: decoding and validating setup links, including the
 *     invalid-link path.
 * What is PORTED (copied logic, trimmed to the harness):
 *   - import row classification (foldSearch / affinity / containment /
 *     shortlist ordering, IMPORT_PROBABLE_MIN 0.35, limit 3);
 *   - free-form reply reading (complete / gaps / unreadable), gap validation,
 *     assembly; the prompt is the reviewed i18n string.
 * What is SIMULATED (clearly not production code):
 *   - the device store (active program, revision, setup draft) and the
 *     activation transaction, so every candidate faces the same replacement,
 *     conflict, resume and rules-drift conditions;
 *   - the setup-draft API (saveDraft / loadDraft / clearDraft): a draft kept
 *     from the cancel dialog lives in memory for the document's lifetime and
 *     is read back through the real Entry.resumeSetupDraft;
 *   - the Today boundary screen after activation.
 * COPY OVERRIDES (harness only, production follow-up PD-5): OVERRIDES below
 * replace a small set of production catalog strings that break the brand
 * rules at the baseline (synthesis spec §5.3, H-7). Every candidate gets them
 * through makeT; candidate copy may still override a key.
 */
(function () {
  "use strict";
  const F = window.__tournamentFixtures;
  const Entry = window.RepForgeProgramEntry;
  const Adapter = window.RepForgeProgramEntryAdapter;
  const Compiler = window.RepForgeProgramCompiler;
  const SharedSetup = window.RepForgeSharedSetup;
  const LIB = window.RepForgeExercises && window.RepForgeExercises.library;
  if (!F || !Entry || !Adapter || !Compiler || !SharedSetup || !LIB) throw new Error("tournament runtime: vendored modules missing");
  const services = Adapter.createProductionServices({ Compiler, catalogue: LIB });
  const BUILT_IN_IDS = LIB.map((e) => e.id);
  const byId = new Map(LIB.map((e) => [e.id, e]));
  /* Absolute URLs for shared assets, so a document at any depth (app.html,
     round-2/app.html) resolves the same files. HARNESS_BASE is this
     directory (docs/design/onboarding-tournament/). */
  const HARNESS_BASE = (() => { try { return new URL(".", document.currentScript.src).href; } catch { return new URL(".", location.href).href; } })();
  const asset = (path) => new URL(path, HARNESS_BASE).href;

  /* ---------- text ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  /* H-7: shared copy override layer (synthesis spec §5.3). Production catalog
     strings that break the brand rules at the baseline, replaced for every
     candidate. Where the spec keeps the production EN, only PT is listed. */
  const OVERRIDES = {
    pt: {
      "entry.result.why_goal": "Objetivo: {goal}.",
      "entry.freeform.gap_error": "Informe valores válidos nos campos destacados.",
      "entry.freeform.privacy": "O texto colado fica só nesta aba e só para esta importação. Ele nunca entra no histórico, nas exportações nem na telemetria, e o Taurifer o descarta quando o fluxo termina.",
      "entry.freeform.not_imported_notice": "Não importado: {items}. O Taurifer registra séries de trabalho e repetições.",
      "entry.freeform.lede": "Cole do jeito que estiver: mensagem do treinador, suas notas, uma planilha ou outro lugar. O Taurifer monta um comando para o ChatGPT ou o Claude, que devolve o programa no formato do app.",
      "entry.build_setup.name_placeholder": "Meu programa",
      "entry.priorities.avoid_reason": "Por que evitar {exercise}?",
      "entry.rules_changed.body_rebuild": "O Taurifer mudou a forma de montar programas desde que você salvou este. Monte de novo para usar as regras atuais.",
    },
    en: {
      "entry.result.why_goal": "Goal: {goal}.",
      "entry.freeform.gap_error": "Please enter valid numbers for the highlighted fields.",
    },
  };
  function makeT(lang, copy) {
    const dict = Object.assign({}, F.i18n[lang] || F.i18n.en, OVERRIDES[lang] || {}, copy || {});
    const t = (key, params, fallback) => {
      let s = dict[key];
      if (s === undefined) s = (F.i18n.en || {})[key];
      if (s === undefined) s = fallback !== undefined ? fallback : key;
      if (params) s = String(s).replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
      return s;
    };
    t.has = (key) => dict[key] !== undefined;
    t.lang = lang;
    return t;
  }
  const tp = (t, n, word) => t(`plural.${word}.${n === 1 ? "one" : "other"}`, undefined, word);
  const nf = (lang, n) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US").format(n);

  /* ---------- library ---------- */
  const libraryEntry = (id) => byId.get(id) || null;
  const libraryName = (e, lang) => (lang === "pt" ? e.namePt || e.name : e.name);
  const searchText = (e) => fold(`${e.name} ${e.namePt || ""} ${e.primary || ""} ${e.secondary || ""}`);
  function searchLibrary(query, lang, { exclude = new Set(), limit = 8, all = false } = {}) {
    const q = fold(query || "").trim();
    const words = q.split(/\s+/).filter(Boolean);
    const pool = LIB.filter((e) => !exclude.has(e.id));
    if (!words.length) return all ? pool.slice(0, limit) : [];
    return pool.filter((e) => { const hay = searchText(e); return words.every((w) => hay.includes(w)); })
      .sort((a, b) => (a.rank ?? 50) - (b.rank ?? 50) || libraryName(a, lang).localeCompare(libraryName(b, lang)))
      .slice(0, limit);
  }
  const mediaFor = (e) => (e && typeof e.media === "string" && e.media ? asset("../../../" + e.media) : null);
  /* H-5: every muscle token, compiled (snake_case) or library (display), maps
     to catalog copy; comma-joined values are split first. */
  const MUSCLE_KEYS = new Map(Object.keys(F.i18n.en).filter((k) => k.startsWith("muscle.") || k.startsWith("entry.muscle.")).map((k) => [fold(k.replace(/^(entry\.)?muscle\./, "")).replace(/[^a-z]/g, ""), k]));
  const muscleKey = (token) => MUSCLE_KEYS.get(fold(token).replace(/[^a-z]/g, "")) || null;
  function muscleLabels(t, raw) {
    return String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((token) => { const k = muscleKey(token); return k ? t(k) : token; });
  }

  /* ---------- day names ---------- */
  const DEFAULT_DAY = /^Day (\d+)$/i;
  function dayName(t, day, structure, index) {
    const days = structure?.days;
    const entry = (Array.isArray(days) ? days.find((d) => d.dayId === (day?.dayId || day?.label) || d.label === (day?.label || day?.dayId)) : null) || day || {};
    if (typeof entry.nameOverride === "string" && entry.nameOverride.trim()) return entry.nameOverride;
    if (typeof entry.displayNameKey === "string" && t.has(entry.displayNameKey)) return t(entry.displayNameKey);
    const value = String(entry.label ?? day?.label ?? `Day ${(index ?? 0) + 1}`);
    const m = DEFAULT_DAY.exec(value.trim());
    return m ? t("program.default.day", { n: +m[1] }) : value;
  }

  /* ---------- answers / compile ---------- */
  const env = (kind) => Adapter.defaultEnvironment(kind);
  function normalizeAnswers(a) {
    const out = { ...a };
    if (out.environmentKind && !out.environment) out.environment = env(out.environmentKind);
    delete out.environmentKind;
    for (const k of ["primaryMuscles", "priorityMovements", "exerciseConstraints", "mustHaveExercises", "deEmphasizedMuscles", "ignoredMuscles"]) if (!Array.isArray(out[k])) out[k] = [];
    return out;
  }
  const versions = () => services.currentVersions();
  function compile(mode, answers) {
    let compiled;
    try { compiled = services.compile({ mode, answers: normalizeAnswers(answers), versions: versions() }); }
    catch (error) { return { ok: false, code: "compile_threw", error: String(error && error.message || error) }; }
    if (!compiled.ok) return compiled;
    const c = compiled.candidate || {};
    return {
      ok: true,
      fingerprint: compiled.fingerprint, name: compiled.name, namePt: compiled.namePt,
      selected: compiled.selected, candidates: compiled.candidates,
      alternative: c.alternative || null,
      preview: c.draft || compiled.preview, explanation: compiled.explanation, telemetry: compiled.telemetry,
      compilerContext: compiled.compilerContext,
    };
  }
  const splitChoices = (answers) => services.splitChoices(normalizeAnswers(answers));
  const browseCards = (answers) => services.browseCatalogue(normalizeAnswers(answers));
  const buildEmpty = (answers) => services.buildEmptyProgram(answers);
  function previewFacts(preview) {
    const program = Array.isArray(preview?.program) ? preview.program : [];
    const est = (preview?.days || []).map((d) => +d.estimateMinutes || 0).filter(Boolean);
    return { exercises: program.length, sets: program.reduce((s, e) => s + (+e.sets || 0), 0), minMinutes: est.length ? Math.min(...est) : null, maxMinutes: est.length ? Math.max(...est) : null };
  }
  function durationLabel(t, preview) {
    const f = previewFacts(preview);
    if (!f.minMinutes) return "";
    return f.minMinutes === f.maxMinutes ? t("entry.preview.minutes", { n: f.minMinutes }) : t("entry.result.duration", { min: f.minMinutes, max: f.maxMinutes });
  }
  function progressionLabel(t, preview) {
    const ids = [...new Set((preview?.program || []).map((e) => e.progression?.strategy?.id).filter(Boolean))];
    return ids.map((id) => t(`program.progression.strategy.${id}`, undefined, id)).join(" · ") || t("entry.result.progression_default");
  }
  function progressionIssue(preview) {
    return (Array.isArray(preview?.progressionIncompatibilities) && preview.progressionIncompatibilities.length > 0) || (preview?.program || []).some((e) => e?.progressionIncompatibility);
  }
  function progressionCopyKey(preview) {
    if (progressionIssue(preview)) return "entry.preview.progression_incompatible";
    let manual = false, unsupported = false;
    for (const e of preview?.program || []) {
      const s = e?.progression?.strategy;
      if (s?.id === "manual") { manual = true; if (s.params?.unsupportedImport) unsupported = true; continue; }
      const legacy = typeof e?.progressionType === "string" ? e.progressionType.trim() : "";
      if (legacy && legacy !== "double_progression") unsupported = true;
    }
    return unsupported ? "entry.preview.progression_manual_unsupported" : manual ? "entry.preview.progression_manual" : "entry.preview.progression_body";
  }
  const equipmentLabel = (t, envValue) => [...new Set((envValue?.equipment || []))].map((k) => t(`entry.equip.${k}`, undefined, k)).join(", ");

  /* ---------- JSON hygiene (H-1) ---------- */
  /* Drops undefined fields and non-finite numbers so a result passes
     Entry.setResult's inspectJson, exactly as a JSON round trip through the
     production setup-draft store would. Arrays keep their length (undefined
     entries become null, as JSON.stringify does). */
  function jsonClean(value) {
    if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined;
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (Array.isArray(value)) return value.map((v) => { const c = jsonClean(v); return c === undefined ? null : c; });
    const out = {};
    for (const [k, v] of Object.entries(value)) { const c = jsonClean(v); if (c !== undefined) out[k] = c; }
    return out;
  }

  /* ---------- change statements by identity (C-5) ---------- */
  /* Identity of an exercise = its library id (or folded name for a row that
     is not linked to the library). Multiset difference, so a duplicated
     movement counts twice. n = max(added, removed) capped at the new total,
     so n <= total always; n = 0 means no exercise changed. */
  const exerciseIdentity = (e) => (e && e.libraryId ? `lib:${e.libraryId}` : `name:${fold(e?.name || "")}`);
  function identityDiff(before, after) {
    const list = (p) => (Array.isArray(p?.program) ? p.program : Array.isArray(p) ? p : []);
    const count = (arr) => { const m = new Map(); for (const e of arr) { const k = exerciseIdentity(e); m.set(k, (m.get(k) || 0) + 1); } return m; };
    const a = count(list(before)), b = count(list(after));
    let added = 0, removed = 0;
    for (const [k, n] of b) added += Math.max(0, n - (a.get(k) || 0));
    for (const [k, n] of a) removed += Math.max(0, n - (b.get(k) || 0));
    const total = list(after).length;
    return { added, removed, n: Math.min(total, Math.max(added, removed)), total };
  }

  /* ---------- import matching (ported from app.js @ PR #256 head) ---------- */
  const MATCH_STOPWORDS = new Set(["com", "sem", "para", "por", "dos", "das", "nos", "nas", "que", "seu", "sua", "pes", "the", "and", "for", "with", "your", "from", "into"]);
  const MATCH_EQUIPMENT = new Set(["barra", "halteres", "haltere", "maquina", "polia", "cabo", "smith", "banco", "cadeira", "mesa", "corda", "anilha", "barbell", "dumbbell", "machine", "cable", "bar", "bench", "rope", "plate"]);
  const MATCH_EQUIPMENT_TOKENS = { barbell: ["barra", "barbell"], dumbbell: ["halteres", "haltere", "dumbbell"], machine: ["maquina", "machine"], cable: ["cabo", "polia", "cable"], smith: ["smith"], bodyweight: ["corpo", "bodyweight"] };
  const matchTokens = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !MATCH_STOPWORDS.has(w));
  const weight = (w) => (MATCH_EQUIPMENT.has(w) ? 0.25 : 1);
  const wsum = (list) => list.reduce((s, w) => s + weight(w), 0);
  function affinity(a, b) { const wa = matchTokens(a), wb = new Set(matchTokens(b)); if (!wa.length || !wb.size) return 0; const hits = wsum(wa.filter((w) => wb.has(w))); const denom = Math.max(wsum(wa), wsum([...wb])); return denom ? hits / denom : 0; }
  function containment(input, name) { const wb = matchTokens(name); if (!wb.length) return false; const wa = new Set(matchTokens(input)); return wb.every((w) => wa.has(w)); }
  function equipmentAgrees(input, e) { const wa = new Set(matchTokens(input)); return (e.equipment || []).some((k) => (MATCH_EQUIPMENT_TOKENS[k] || [k]).some((tok) => wa.has(tok))); }
  function rankCandidates(name, limit = 3) {
    const scored = [];
    LIB.forEach((e, i) => {
      const names = [e.name, e.namePt || "", ...(e.aliases || [])];
      const score = names.reduce((b, n) => Math.max(b, affinity(name, n)), 0);
      const contained = names.some((n) => containment(name, n));
      if (!contained && score < 0.35) return;
      scored.push({ entry: e, score, contained, equipment: equipmentAgrees(name, e), rank: Number.isFinite(e.rank) ? e.rank : 50, order: i });
    });
    scored.sort((a, b) => (b.contained ? 1 : 0) - (a.contained ? 1 : 0) || b.score - a.score || (b.equipment ? 1 : 0) - (a.equipment ? 1 : 0) || a.rank - b.rank || a.order - b.order);
    return scored.slice(0, limit);
  }
  function classifyRow(raw) {
    const name = String(raw.name ?? "").trim();
    if (raw.libraryId && byId.has(raw.libraryId)) return { status: "exact", match: byId.get(raw.libraryId), shortlist: [] };
    const folded = fold(name);
    if (!folded) return { status: "unmatched", match: null, shortlist: [] };
    const exact = LIB.find((e) => fold(e.name) === folded); if (exact) return { status: "exact", match: exact, shortlist: [] };
    const alias = LIB.find((e) => fold(e.namePt || "") === folded); if (alias) return { status: "alias", match: alias, shortlist: [] };
    const curated = LIB.find((e) => (e.aliases || []).some((a) => fold(a) === folded)); if (curated) return { status: "alias", match: curated, shortlist: [] };
    const ranked = rankCandidates(name);
    if (!ranked.length) return { status: "unmatched", match: null, shortlist: [] };
    return { status: "probable", match: ranked[0].entry, shortlist: ranked.map((r) => r.entry) };
  }
  function buildImportDraft(source, fileName, sourceType) {
    const rows = (source.exercises || []).map((raw, i) => {
      const { status, match, shortlist } = classifyRow(raw);
      const settled = status === "exact" || status === "alias";
      return { key: `imp${i}`, raw: { ...raw }, status, match, shortlist, decision: settled ? "link" : "raw", reviewed: settled, expanded: false };
    });
    return { fileName: String(fileName || ""), sourceType: sourceType || "file", meta: source.meta || null, notImported: source.notImported || [], originalText: source.originalText || "", rows };
  }
  const importCounts = (d) => ({ linked: d.rows.filter((r) => r.decision === "link").length, review: d.rows.filter((r) => !r.reviewed).length, custom: d.rows.filter((r) => r.decision === "custom").length, total: d.rows.length });
  /* H-1: JSON-clean. A raw (unlinked) row has no libraryId/primary/secondary,
     and those keys are now absent instead of undefined; min/max come from
     min/max or repLow/repHigh. Entry.setResult accepts the result. */
  function importPreview(draft, t) {
    const program = draft.rows.map((r, i) => {
      const base = { id: r.raw.id || `imp_${i}`, day: r.raw.day, order: r.raw.order || i + 1, name: r.raw.name, sets: r.raw.sets, min: r.raw.min ?? r.raw.repLow, max: r.raw.max ?? r.raw.repHigh, notes: "", progression: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: { authored: true } }, modifiers: [] } };
      if (r.decision === "link" && r.match) Object.assign(base, { name: r.match.name, libraryId: r.match.id, primary: r.match.primary, secondary: r.match.secondary });
      if (r.decision === "custom" && r.createdCustom) base.customId = r.createdCustom.id;
      return jsonClean(base);
    });
    const labels = [...new Set(program.map((e) => e.day))];
    const days = labels.map((label) => ({ dayId: label, label, exercises: program.filter((e) => e.day === label).map((e) => jsonClean({ id: e.id, name: e.name, libraryId: e.libraryId, sets: e.sets, min: e.min, max: e.max })) }));
    return jsonClean({ source: draft.sourceType === "freeform" ? "freeform" : "import", name: draft.meta?.name || t("untitled_program"), frequency: labels.length, program, days, programStructure: { schemaVersion: 1, days: labels.map((label, i) => ({ dayId: label, label, order: i + 1 })) }, limitations: [], reductions: [], primaryMuscles: [] });
  }
  /* The result object for the import route (file or paste door). */
  function importResult(draft, t) {
    const preview = importPreview(draft, t);
    return { fingerprint: `import:${preview.source}:${preview.program.length}`, name: preview.name, selected: { id: preview.source, source: preview.source }, preview };
  }

  /* ---------- free-form reply (ported) ---------- */
  const NOT_IMPORTED = ["rest_times", "rir_rpe", "tempo", "supersets", "warmups", "cardio", "progression_rules", "deload", "other_notes"];
  function parseSets(v) { if (typeof v !== "string" && typeof v !== "number") return null; const s = String(v).trim(); if (!/^\d+$/.test(s)) return null; const n = parseInt(s, 10); return n >= 1 && n <= 100 ? n : null; }
  function parseReps(v) {
    if (typeof v !== "string" && typeof v !== "number") return null; const s = String(v).trim();
    const r = s.match(/^(\d+)\s*(?:[-–—/]|to)\s*(\d+)$/i); if (r) { const min = +r[1], max = +r[2]; return min >= 1 && min <= 1000 && max >= min && max <= 1000 ? { min, max } : null; }
    const m = s.match(/^(\d+)$/); if (m) { const n = +m[1]; return n >= 1 && n <= 1000 ? { min: n, max: n } : null; }
    return null;
  }
  function jsonCandidates(text) {
    const out = []; const fence = /```(?:json)?\s*([\s\S]*?)```/gi; let m;
    while ((m = fence.exec(text))) out.push(m[1].trim());
    const first = text.indexOf("{"), last = text.lastIndexOf("}");
    if (first >= 0 && last > first) out.push(text.slice(first, last + 1));
    return out;
  }
  function readEnvelope(candidate) {
    let raw; try { raw = JSON.parse(candidate); } catch { return null; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const exercises = Array.isArray(raw.exercises) ? raw.exercises : Array.isArray(raw.program) ? raw.program : null;
    if (!exercises || !exercises.length) return null;
    const rows = []; const orders = new Map(); const gaps = [];
    for (let i = 0; i < exercises.length; i++) {
      const row = exercises[i]; if (!row || typeof row !== "object") return null;
      const day = typeof row.day === "string" ? row.day.trim() : ""; const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!day || !name) return null;
      const order = (orders.get(day) || 0) + 1; orders.set(day, order);
      const r = { day, name, order };
      if (row.sets !== undefined && row.sets !== null) { if (!Number.isInteger(row.sets) || row.sets < 1 || row.sets > 100) return null; r.sets = row.sets; } else gaps.push({ key: `${i}::sets`, index: i, day, name, field: "sets" });
      const min = row.min ?? row.repLow, max = row.max ?? row.repHigh;
      if (min !== undefined && max !== undefined) { if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 1000) return null; r.min = min; r.max = max; } else gaps.push({ key: `${i}::reps`, index: i, day, name, field: "reps" });
      rows.push(r);
    }
    const notImported = Array.isArray(raw.notImported) ? raw.notImported.filter((c) => NOT_IMPORTED.includes(c)) : [];
    return { envelope: raw, exercises: rows, gaps, notImported, meta: raw.meta && typeof raw.meta === "object" ? raw.meta : null };
  }
  function parseFreeformReply(text) {
    const raw = String(text || ""); if (!raw.trim()) return { status: "unreadable", reason: "no_json" };
    const cands = jsonCandidates(raw); if (!cands.length && raw.trim().startsWith("{")) cands.push(raw.trim());
    let sawJson = false;
    for (const c of cands) {
      let parsed = null; try { parsed = JSON.parse(c); sawJson = true; } catch { continue; }
      const env2 = readEnvelope(c);
      if (env2) return env2.gaps.length ? Object.assign(env2, { status: "gaps" }) : Object.assign(env2, { status: "complete" });
      if (parsed) return { status: "unreadable", reason: "invalid_rows" };
    }
    return { status: "unreadable", reason: sawJson ? "invalid_rows" : "no_json" };
  }
  function assembleGaps(gapResult, answers) {
    const errors = new Set();
    for (const g of gapResult.gaps) { const v = answers[g.key]; if (g.field === "sets" ? parseSets(v) === null : parseReps(v) === null) errors.add(g.key); }
    if (errors.size) return { ok: false, errors };
    const exercises = gapResult.exercises.map((row, i) => {
      const copy = { ...row };
      if (copy.sets === undefined) copy.sets = parseSets(answers[`${i}::sets`]);
      if (copy.min === undefined || copy.max === undefined) { const r = parseReps(answers[`${i}::reps`]); copy.min = r.min; copy.max = r.max; }
      return copy;
    });
    return { ok: true, source: { meta: gapResult.meta, exercises, notImported: gapResult.notImported } };
  }
  const freeformPrompt = (t, program) => t("entry.freeform.prompt", { program });
  const FREEFORM_MAX_CHARS = 12000;

  /* ---------- shared setup (real codec) ---------- */
  async function decodeShared(fragment) {
    if (!fragment) return { ok: false, code: "missing" };
    let decoded;
    try { decoded = await SharedSetup.decode(fragment, { builtInIds: BUILT_IN_IDS }); } catch (e) { return { ok: false, code: "decode_threw" }; }
    if (!decoded?.ok) return { ok: false, code: decoded?.code || "invalid" };
    const checked = SharedSetup.validate(decoded.value, { builtInIds: BUILT_IN_IDS });
    if (!checked?.ok) return { ok: false, code: checked?.code || "invalid", issues: checked?.issues };
    return { ok: true, payload: checked.value };
  }
  function sharedErrorKey(code) {
    if (code === "too-large" || code === "too_large") return "setup.shared.too_large";
    if (code === "unsupported-version" || code === "unsupported") return "setup.shared.unsupported";
    if (String(code).includes("compression")) return "setup.shared.browser_unsupported";
    return "setup.shared.invalid";
  }
  function sharedPreview(payload) {
    const meta = payload.program.meta; const settings = payload.settings;
    const time = Compiler.RULES?.time; const rest = Number(settings?.restSec);
    const program = payload.program.exercises.map((e, i) => {
      const entry = byId.get(e.libraryId);
      return { id: `shared_${i}`, day: e.day, order: e.order, name: e.displayName || (entry ? entry.name : e.name), libraryId: e.libraryId, sets: e.sets, min: e.min, max: e.max, primary: entry?.primary, secondary: entry?.secondary, notes: e.notes || "", progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: { workingSets: e.sets, repMin: e.min, repMax: e.max, targetRirMin: 1, targetRirMax: 3 } }, modifiers: [] } };
    });
    const labels = [...new Set(program.map((e) => e.day))];
    const days = labels.map((label) => {
      const exercises = program.filter((e) => e.day === label);
      let est = null;
      if (time && Number.isFinite(rest)) { let sub = 0; for (const ex of exercises) sub += ex.sets * time.workingSetSeconds + Math.max(0, ex.sets - 1) * rest; est = Math.ceil((sub + Math.max(time.bufferMinimumSeconds, Math.ceil(sub * time.bufferPercent / 100))) / 60); }
      return { dayId: label, label, exercises: exercises.map((e) => ({ id: e.id, name: e.name, libraryId: e.libraryId, sets: e.sets, min: e.min, max: e.max })), ...(est ? { estimateMinutes: est } : {}) };
    });
    return jsonClean({ source: "shared", name: meta.name, frequency: meta.daysPerWeek, program, days, programStructure: { schemaVersion: 1, days: labels.map((l, i) => ({ dayId: l, label: l, order: i + 1 })) }, sharedMeta: { goal: meta.goal, experience: meta.experience, daysPerWeek: meta.daysPerWeek, splitType: meta.splitType, equipment: meta.equipment, priorityMuscles: meta.priorityMuscles, sessionLength: meta.sessionLength, mesocycleLengthWeeks: meta.mesocycleLengthWeeks }, sharedSettings: settings, limitations: [], reductions: [], primaryMuscles: [] });
  }
  /* The result object for the shared route (after Start). */
  function sharedResult(payload) {
    const preview = sharedPreview(payload);
    return { fingerprint: "shared", name: preview.name, selected: { id: "shared", source: "shared" }, preview };
  }

  /* ---------- fixture answer sets (same for every candidate) ---------- */
  function fixtureAnswers(name) {
    const u = F.users[name]?.answers; if (!u) throw new Error(`unknown fixture user ${name}`);
    const out = { ...u, environment: env(u.environmentKind) }; delete out.environmentKind;
    return JSON.parse(JSON.stringify(out));
  }

  /* ---------- device store (simulated) ---------- */
  const device = { active: null, revision: 0, draft: null, draftUi: null, draftSavedAt: null, sessions: 0, landingSeen: false, sharedFragment: null, uiPrefs: { importSourceMode: "file" } };
  function seedExisting() {
    const p = F.users.existing.program;
    const labels = [...new Set(p.exercises.map((e) => e.day))];
    device.active = { name: p.name, namePt: null, program: p.exercises.map((e, i) => ({ ...e, id: `act_${i}` })), programStructure: { days: labels.map((l, i) => ({ dayId: l, label: l, order: i + 1 })) }, daysPerWeek: p.daysPerWeek };
    device.revision = 1; device.sessions = p.sessions; device.landingSeen = true;
  }
  /* Seeds: fresh | existing | interrupted | rules-drift | shared | shared-invalid.
     "interrupted" and "rules-drift" write the shared recovery drafts into
     device.draft so resume reads them through the same draft API. */
  function seedDevice(seed) {
    device.active = null; device.revision = 0; device.draft = null; device.draftUi = null; device.draftSavedAt = null; device.sessions = 0; device.landingSeen = false; device.sharedFragment = null;
    if (!seed || seed === "fresh") return;
    if (seed === "existing") seedExisting();
    if (seed === "interrupted") { device.draft = seeds.interruptedDraft(); device.draftSavedAt = device.draft.state.updatedAt; device.landingSeen = true; }
    if (seed === "rules-drift") { device.draft = seeds.rulesDriftDraft(); device.draftSavedAt = device.draft.state.updatedAt; device.landingSeen = true; }
  }
  /* Recovery drafts shared by every candidate (resume / rules-changed). */
  const seeds = {
    interruptedDraft() {
      const a = fixtureAnswers("rafael");
      const answers = { desiredResult: a.desiredResult, structuredExperience: a.structuredExperience, recentConsistency: a.recentConsistency, daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, preferredRestSeconds: a.preferredRestSeconds, environment: a.environment };
      const when = new Date(Date.now() - 86400000).toISOString();
      const state = entryState({ route: "recommend", answers, step: "priorities", draftId: "11111111-1111-4111-8111-111111111111", now: when });
      return { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "harness", state: { ...state, updatedAt: when } };
    },
    rulesDriftDraft() {
      const a = fixtureAnswers("rafael");
      const state = entryState({ route: "recommend", answers: { desiredResult: a.desiredResult }, step: "desired_result", draftId: "22222222-2222-4222-8222-222222222222", versions: { ...versions(), rules: "old-rules" } });
      return { schemaVersion: 1, draftId: state.draftId, revision: 1, ownerId: "harness", state };
    },
  };
  const hasActiveProgram = () => !!device.active;
  const liveRevision = () => device.revision;
  const uid = () => "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

  /* A pure ProgramEntry state for the route, so readiness/activation checks are
     the production checks. Candidates keep their own screen state on top. */
  function entryState({ route, answers = {}, result = null, step, activeProgramRevisionAtStart, versions: v, draftId, now }) {
    let s = Entry.createState({ draftId: draftId || uid(), activeProgramRevisionAtStart: activeProgramRevisionAtStart ?? liveRevision(), now: now || new Date().toISOString(), versions: v || versions() });
    if (route) s = Entry.selectRoute(s, route);
    if (Object.keys(answers).length) s = Entry.setAnswers(s, normalizeAnswers(answers));
    if (result) s = Entry.setResult(s, result);
    if (step) s = { ...s, step };
    return s;
  }
  function readiness(state, { pinnedVersionsExecutable = false } = {}) {
    return Entry.activationReadiness(state, { liveActiveProgramRevision: liveRevision(), currentVersions: versions(), pinnedVersionsExecutable });
  }
  function activationIssues(state) { try { return Entry.candidateActivationIssues(state); } catch (e) { return ["state_invalid"]; } }
  /* Accepts a setup-draft envelope ({ schemaVersion, draftId, revision,
     ownerId, state }) or a bare entry state. */
  function resumeStatus(draft) {
    const input = draft && typeof draft === "object" && draft.state && Object.prototype.hasOwnProperty.call(draft, "revision") ? draft.state : draft;
    const r = Entry.resumeSetupDraft(input, { currentVersions: versions(), liveActiveProgramRevision: liveRevision(), pinnedVersionsExecutable: false });
    return r.ok ? r.value : { status: "corrupt" };
  }
  /* H-9: simulated setup-draft API. saveDraft takes a production-shaped entry
     state (TF.entryState or Entry.* output); the envelope is validated by the
     real Entry.normalizeSetupDraftEnvelope before it is stored, so a draft
     the product could not persist is refused here too. `ui` is an optional,
     JSON-clean, harness-only blob for view state the entry state does not
     carry (for example a build model or import row decisions); it is
     returned unchanged by loadDraft. Nothing survives a reload. */
  function saveDraft(state, { ui = null, now } = {}) {
    let s;
    try { s = Entry.updateTimestamp(state, now || new Date(Math.max(Date.now(), Date.parse(state?.updatedAt || 0) || 0)).toISOString()); }
    catch (e) { return { ok: false, code: "state_invalid", error: String(e && e.message || e) }; }
    const envelope = { schemaVersion: 1, draftId: s.draftId || uid(), revision: (device.draft?.revision || 0) + 1, ownerId: "harness", state: { ...s, draftId: s.draftId || device.draft?.draftId } };
    if (!envelope.state.draftId) envelope.state.draftId = envelope.draftId;
    const checked = Entry.normalizeSetupDraftEnvelope(envelope);
    if (!checked.ok) return { ok: false, code: "draft_invalid", issues: checked.issues };
    device.draft = checked.value.envelope; device.draftUi = ui == null ? null : jsonClean(ui); device.draftSavedAt = envelope.state.updatedAt;
    return { ok: true, draft: device.draft };
  }
  /* Reads the kept draft back through the real resume rules. Returns null
     when nothing is kept; otherwise { status: resumable | rules_changed |
     activation_conflict | corrupt, state, ui, savedAt, route, step }. */
  function loadDraft() {
    if (!device.draft) return null;
    const r = resumeStatus(device.draft);
    return { ...r, ui: device.draftUi, savedAt: device.draftSavedAt || r.state?.updatedAt || null, route: r.state?.route || null, step: r.state?.step || null };
  }
  function clearDraft() { device.draft = null; device.draftUi = null; device.draftSavedAt = null; }
  /* Simulated activation transaction. Runs the real readiness checks first.
     H-5: stores both names so Today renders the localized one. */
  function activate(state, { pinnedVersionsExecutable = false } = {}) {
    const ready = readiness(state, { pinnedVersionsExecutable });
    if (!ready.ok) return { ok: false, ...ready };
    const preview = state.result.preview;
    device.active = { name: state.result.name || state.answers.programName || "", namePt: state.result.namePt || null, program: preview.program.map((e) => JSON.parse(JSON.stringify(e))), programStructure: JSON.parse(JSON.stringify(preview.programStructure || {})), daysPerWeek: preview.frequency || (preview.days || []).length, route: state.route };
    device.revision += 1; clearDraft(); device.landingSeen = true;
    return { ok: true, revision: device.revision };
  }
  /* The active program's name in the document language. */
  const activeName = (lang) => { const a = device.active; if (!a) return ""; return (lang === "pt" && a.namePt) || a.name || ""; };
  /* A result's name in the document language (compiled results carry namePt). */
  const resultName = (result, lang) => (result ? ((lang === "pt" && result.namePt) || result.name || "") : "");

  /* ---------- Today boundary (shared, minimal) ---------- */
  function renderToday(t, lang) {
    const a = device.active; if (!a) return "";
    const days = (a.programStructure?.days || []).map((d, i) => ({ ...d, exercises: a.program.filter((e) => e.day === d.label || e.dayId === d.dayId) }));
    const first = days[0] || { label: "Day 1", exercises: [] };
    const date = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { weekday: "long", month: "long", day: "numeric" });
    const muscles = [...new Set(first.exercises.flatMap((e) => muscleLabels(t, e.primary)))].slice(0, 3).join(" · ");
    return `<div class="today" data-checkpoint="activated-today">
      <div class="today__head"><div><h1 class="t-title">${esc(t("nav.log"))}</h1><p class="t-caption">${esc(date)}</p></div><span class="icon-mask icon-mask--gear" aria-hidden="true"></span></div>
      <div class="today__prog"><p class="t-subtitle" data-today-program>${esc(activeName(lang))}</p><p class="t-caption">${esc(t("today.week_of", { n: 1, total: 6 }))}</p><div class="today__week" aria-hidden="true">${Array.from({ length: a.daysPerWeek || days.length }, () => "<span></span>").join("")}</div><p class="t-caption">${esc(t("today.sessions_done", { done: 0, planned: a.daysPerWeek || days.length }))}</p></div>
      <p class="t-label">${esc(t("today.session_label"))}</p>
      <div class="today__session"><h2 class="t-section">${esc(dayName(t, first, a.programStructure, 0))}</h2><p class="t-small t-soft">${esc(muscles)}${muscles ? " · " : ""}${esc(t("today.exercise_count", { n: first.exercises.length }))}</p>
      <div class="card" style="margin-top:10px"><div class="day__list" style="border-top:0">${first.exercises.map((e) => `<div class="ex"><span class="ex__name">${esc(lang === "pt" && e.libraryId && byId.get(e.libraryId) ? byId.get(e.libraryId).namePt : e.name)}</span><span class="ex__rx">${e.sets} × ${e.min}–${e.max}</span></div>`).join("")}</div></div></div>
      <button type="button" class="btn btn--primary">${esc(t("today.start"))}</button>
      <nav class="dock" aria-label="${esc(t("nav.aria"))}"><button type="button" class="is-active"><span class="icon-mask icon-mask--cal" aria-hidden="true"></span>${esc(t("nav.log"))}</button><button type="button"><span class="icon-mask icon-mask--trend" aria-hidden="true"></span>${esc(t("nav.stats"))}</button><button type="button"><span class="icon-mask icon-mask--clock" aria-hidden="true"></span>${esc(t("nav.history"))}</button><button type="button"><span class="icon-mask icon-mask--sheet" aria-hidden="true"></span>${esc(t("nav.program"))}</button></nav>
    </div>`;
  }

  /* ---------- checkpoints: the shared comparison contract ---------- */
  const CHECKPOINTS = [
    ["1", "landing", "Brand-new user, first open", "fresh"],
    ["2", "route-choice", "The place where a user chooses (or is spared) a route", "fresh"],
    ["2", "route-help", "What an uncertain user gets when they do not know which route fits", "fresh"],
    ["3", "rec-goal", "Recommend: desired result", "fresh"],
    ["3", "rec-background", "Recommend: training background (experience + recent consistency)", "fresh"],
    ["3", "rec-schedule", "Recommend: days, session ceiling, rest", "fresh"],
    ["3", "rec-environment", "Recommend: where you train", "fresh"],
    ["3", "rec-priorities", "Recommend: priorities and constraints", "fresh"],
    ["3", "rec-result", "Recommend: result for Rafael (3 days, muscle growth, commercial gym)", "fresh"],
    ["4", "rec-env-correction", "Environment corrected (limited home + dumbbells + band + safe pull)", "fresh"],
    ["4", "rec-result-corrected", "Result after the correction, showing its consequences (limitations/adjustments)", "fresh"],
    ["5", "rec-avoid-pain", "Barbell bench press avoided for pain, with the safety note", "fresh"],
    ["5", "rec-result-avoided", "Result honouring the pain constraint", "fresh"],
    ["6", "browse-filters", "Browse: schedule/environment context", "fresh"],
    ["6", "browse-list", "Browse: catalogue for 4 days / 60 min / commercial gym", "fresh"],
    ["6", "browse-preview", "Browse: review of Muscle + Strength · 4 days", "fresh"],
    ["7", "custom-priorities", "Custom: per-muscle emphasis", "fresh"],
    ["7", "custom-exercises", "Custom: include bench press, avoid barbell curl (dislike)", "fresh"],
    ["7", "custom-shape", "Custom: weekly structure choice (sole structure for these answers)", "fresh"],
    ["7", "custom-result", "Custom: generated program and review", "fresh"],
    ["8", "build-setup", "Build: name and day count", "fresh"],
    ["8", "build-empty", "Build: empty days, activation blocked", "fresh"],
    ["8", "build-partial", "Build: one day filled, activation blocked with reason", "fresh"],
    ["8", "build-ready", "Build: complete draft, activation enabled", "fresh"],
    ["9", "ff-empty", "Paste door: empty", "fresh"],
    ["9", "ff-filled", "Paste door: program pasted", "fresh"],
    ["9", "ff-handoff", "Paste door: hand-off to ChatGPT/Claude", "fresh"],
    ["9", "ff-reply", "Paste door: paste the reply", "fresh"],
    ["9", "ff-gaps", "Paste door: gaps detected (reps for Cable flyes, sets for Lat pulldown)", "fresh"],
    ["9", "ff-gaps-invalid", "Paste door: gaps submitted empty / invalid", "fresh"],
    ["9", "ff-unreadable", "Paste door: unreadable reply", "fresh"],
    ["9", "import-source", "File door: choose a file", "fresh"],
    ["9", "import-review", "Import review: exact, likely (with shortlist) and unmatched rows", "fresh"],
    ["9", "import-preview", "Import: review before activation (manual progression)", "fresh"],
    ["10", "shared-gate", "Shared link: gate before anything persists", "shared"],
    ["10", "shared-preview", "Shared link: review after Start", "shared"],
    ["11", "shared-invalid", "Invalid shared link", "shared-invalid"],
    ["12", "hub-existing", "Entry with an active program (replacement consequences visible)", "existing"],
    ["12", "replace-confirm", "Explicit archive-and-replace confirmation", "existing"],
    ["12", "activation-conflict", "Active program changed in another tab", "existing"],
    ["13", "resume", "Interrupted onboarding: resume or start over", "interrupted"],
    ["13", "rules-changed", "Draft compiled under older rules; rebuild required", "rules-drift"],
    ["13", "cancel-confirm", "Leaving setup mid-way: keep or discard the draft", "fresh"],
    ["14", "activate", "Final review with the activation action", "fresh"],
    ["14", "activated-today", "Today, immediately after activation", "fresh"],
  ].map(([scenario, id, label, seed]) => ({ scenario, id, label, seed }));
  const SCENARIOS = { 1: "Brand-new user, first open", 2: "Uncertain which route", 3: "Recommend through result", 4: "Recommendation needs a correction", 5: "Exercise avoidance (pain)", 6: "Browse path", 7: "Custom path", 8: "Build your own", 9: "Freeform / import", 10: "Shared program gate and preview", 11: "Invalid shared link", 12: "Existing program / replacement", 13: "Interrupted onboarding / recovery", 14: "Activation and hand-off" };

  window.TF = Object.freeze({
    F, Entry, Adapter, Compiler, SharedSetup, LIB, services, byId, BUILT_IN_IDS, HARNESS_BASE, asset,
    esc, fold, makeT, tp, nf, OVERRIDES,
    libraryEntry, libraryName, searchLibrary, mediaFor, dayName, muscleKey, muscleLabels,
    env, normalizeAnswers, versions, compile, splitChoices, browseCards, buildEmpty, fixtureAnswers,
    previewFacts, durationLabel, progressionLabel, progressionIssue, progressionCopyKey, equipmentLabel,
    jsonClean, exerciseIdentity, identityDiff,
    classifyRow, buildImportDraft, importCounts, importPreview, importResult,
    parseSets, parseReps, parseFreeformReply, assembleGaps, freeformPrompt, FREEFORM_MAX_CHARS, NOT_IMPORTED,
    decodeShared, sharedErrorKey, sharedPreview, sharedResult,
    device, seedDevice, seedExisting, seeds, hasActiveProgram, liveRevision, uid,
    entryState, readiness, activationIssues, resumeStatus, saveDraft, loadDraft, clearDraft, activate, activeName, resultName,
    renderToday, CHECKPOINTS, SCENARIOS,
  });
})();
