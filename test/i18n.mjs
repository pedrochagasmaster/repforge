#!/usr/bin/env node
/**
 * EN/PT dictionary, DOM, and JavaScript key parity (Plan 041 Step 9).
 * Run: node test/i18n.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import vm from "vm";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };

function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

function placeholders(s) {
  return [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

function findDuplicateKeys(src, filename) {
  const dups = [];
  function parseValue(i, stack) {
    while (i < src.length && /\s/.test(src[i])) i++;
    const c = src[i];
    if (c === "{") return parseObject(i, stack);
    if (c === "[") return parseArray(i, stack);
    if (c === '"') return skipString(i);
    if (c === "t" && src.slice(i, i + 4) === "true") return i + 4;
    if (c === "f" && src.slice(i, i + 5) === "false") return i + 5;
    if (c === "n" && src.slice(i, i + 4) === "null") return i + 4;
    if (c === "-" || (c >= "0" && c <= "9")) {
      i++;
      while (i < src.length && /[0-9.eE+-]/.test(src[i])) i++;
      return i;
    }
    throw new Error(`${filename}: unexpected token at ${i}: ${src.slice(i, i + 20)}`);
  }
  function skipString(i) {
    i++;
    while (i < src.length) {
      if (src[i] === "\\") {
        i += 2;
        continue;
      }
      if (src[i] === '"') return i + 1;
      i++;
    }
    throw new Error(`${filename}: unterminated string`);
  }
  function parseObject(i, stack) {
    const seen = new Set();
    i++;
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === "}") return i + 1;
      if (src[i] !== '"') throw new Error(`${filename}: expected key at ${i}`);
      const start = i + 1;
      i = skipString(i);
      const key = JSON.parse(src.slice(start - 1, i));
      const path = [...stack, key].join(".");
      if (seen.has(key)) dups.push(`${filename}: duplicate key ${path}`);
      seen.add(key);
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== ":") throw new Error(`${filename}: expected ':' after ${path}`);
      i = parseValue(i + 1, [...stack, key]);
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] === "}") return i + 1;
    }
    throw new Error(`${filename}: unterminated object`);
  }
  function parseArray(i, stack) {
    i++;
    let idx = 0;
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === "]") return i + 1;
      i = parseValue(i, [...stack, String(idx++)]);
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] === "]") return i + 1;
    }
    throw new Error(`${filename}: unterminated array`);
  }
  parseValue(0, []);
  return dups;
}

function loadRuntimeDicts() {
  const code = readFileSync(join(ROOT, "i18n.js"), "utf8");
  const sandbox = {
    document: {
      documentElement: {},
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
    },
    module: { exports: {} },
    exports: {},
    console,
  };
  vm.runInNewContext(code, sandbox);
  const api = sandbox.RepForgeI18n || sandbox.module.exports;
  if (!api?.STRINGS) throw new Error("could not extract runtime dictionaries from i18n.js");
  return { en: { ...api.STRINGS.en }, pt: { ...api.STRINGS.pt }, api };
}

function htmlI18nKeys(html) {
  const keys = new Set();
  for (const attr of ["data-i18n", "data-i18n-aria", "data-i18n-placeholder", "data-i18n-title"]) {
    const re = new RegExp(`${attr}="([^"]+)"`, "g");
    let m;
    while ((m = re.exec(html))) keys.add(m[1]);
  }
  return keys;
}

function extractJsKeys(src) {
  const literals = new Set();
  const dyn = [];
  const litRe = /\bt\(\s*(["'])((?:\\.|(?!\1).)*)\1\s*[,)]/g;
  let m;
  while ((m = litRe.exec(src))) literals.add(m[2].replace(/\\"/g, '"').replace(/\\'/g, "'"));
  const ternRe = /\bt\(\s*[^)"']{0,80}?(["'])([a-zA-Z][\w.]+)\1\s*:\s*(["'])([a-zA-Z][\w.]+)\3/g;
  while ((m = ternRe.exec(src))) {
    literals.add(m[2]);
    literals.add(m[4]);
  }
  const tplRe = /\bt\(\s*(`[^`]+`)/g;
  while ((m = tplRe.exec(src))) dyn.push(m[1]);
  const concatRe = /\bt\(\s*(["'])([^"'`]+)\1\s*\+/g;
  while ((m = concatRe.exec(src))) dyn.push(`"${m[2]}"+`);
  const tpRe = /\btp\(\s*[^,]+,\s*(["'])([^"']+)\1/g;
  const plurals = new Set();
  while ((m = tpRe.exec(src))) plurals.add(m[2]);
  return { literals, dyn, plurals };
}

const DYNAMIC_FAMILIES = [
  { test: (s) => s.includes("tour.${tourStep}.title") || s.includes('"tour."'), keys: (en) => Object.keys(en).filter((k) => /^tour\.\d+\.title$/.test(k)) },
  { test: (s) => s.includes("tour.${tourStep}.body"), keys: (en) => Object.keys(en).filter((k) => /^tour\.\d+\.body$/.test(k)) },
  { test: (s) => s.includes("onb.title.${onbStep}"), keys: (en) => Object.keys(en).filter((k) => /^onb\.title\.\d+$/.test(k)) },
  { test: (s) => s.includes("glossary.term.${"), keys: (en) => Object.keys(en).filter((k) => k.startsWith("glossary.term.")) },
  { test: (s) => s.includes("glossary.${termKey}") || s.includes("glossary.${"), keys: (en) => Object.keys(en).filter((k) => k.startsWith("glossary.") && !k.startsWith("glossary.term.")) },
  { test: (s) => s.includes("block_rec.${"), keys: (en) => Object.keys(en).filter((k) => /^block_rec\.[^.]+\.(line|why)$/.test(k)) },
  { test: (s) => s.includes("review.summary.adherence.${"), keys: (en) => Object.keys(en).filter((k) => k.startsWith("review.summary.adherence.")) },
  { test: (s) => s.includes("rec.block.${"), keys: (en) => Object.keys(en).filter((k) => k.startsWith("rec.block.")) },
  { test: (s) => s.includes('"why.rule."'), keys: () => ["why.rule.top", "why.rule.cap_top", "why.rule.cap_top2", "why.rule.below_range", "why.rule.stalled", "why.rule.recover", "why.rule.push_reps", "why.rule.hold"] },
  { test: (s) => s.includes("focus.cue.${"), keys: (en) => Object.keys(en).filter((k) => k.startsWith("focus.cue.")) },
  { test: (s) => s.includes('"settings.lang."'), keys: () => ["settings.lang.en", "settings.lang.pt"] },
  { test: (s) => s.includes('"settings.appearance."'), keys: () => ["settings.appearance.system", "settings.appearance.light", "settings.appearance.dark"] },
  { test: (s) => s.includes('"month_short."'), keys: () => range(0, 11).map((i) => `month_short.${i}`) },
  { test: (s) => s.includes('"month."'), keys: () => range(0, 11).map((i) => `month.${i}`) },
  { test: (s) => s.includes('"weekday."'), keys: () => range(0, 6).map((i) => `weekday.${i}`) },
  { test: (s) => s.includes('"effort.hint."'), keys: () => ["effort.hint.easy", "effort.hint.hard", "effort.hint.max"] },
  { test: (s) => s.includes('"effort."') && !s.includes("hint"), keys: () => ["effort.easy", "effort.hard", "effort.max"] },
  { test: (s) => s.includes('"onb.goal."'), keys: (en) => Object.keys(en).filter((k) => /^onb\.goal\.[^.]+\.label$/.test(k)) },
  { test: (s) => s.includes('"split."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("split.")) },
  { test: (s) => s.includes('"equipment."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("equipment.")) },
  { test: (s) => s.includes('"muscle."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("muscle.")) },
  { test: (s) => s.includes('"seed.ex."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("seed.ex.")) },
  { test: (s) => s.includes('"seed.note."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("seed.note.")) },
  { test: (s) => s.includes('"picker.equipment."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("picker.equipment.")) },
  { test: (s) => s.includes('"picker.group."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("picker.group.")) },
  { test: (s) => s.includes('"picker.tab_head."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("picker.tab_head.")) },
  { test: (s) => s.includes('"picker.tab."'), keys: (en) => Object.keys(en).filter((k) => k.startsWith("picker.tab.")) },
  { test: (s) => s.includes("program.progression.strategy.${"), keys: () => [
    "program.progression.strategy.range", "program.progression.strategy.rep_goal",
    "program.progression.strategy.anchor_backoff", "program.progression.strategy.manual",
    "program.progression.strategy.unsupported",
  ] },
];

async function runBrowserParity(en, pt) {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { timeout: 10000, base: BASE });
  await page.waitForFunction(() => typeof window.RepForgeI18n === "object", { timeout: 10000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });

  const missing = await page.evaluate(async () => {
    const seen = [];
    const orig = window.RepForgeI18n.t.bind(window.RepForgeI18n);
    window.RepForgeI18n.t = (key, vars) => {
      const dict = window.RepForgeI18n.STRINGS[window.RepForgeI18n.getLang()] || {};
      if (dict[key] == null) seen.push({ lang: window.RepForgeI18n.getLang(), key });
      return orig(key, vars);
    };
    const visit = () => {
      for (const view of ["log", "stats", "history", "program"]) {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
        document.querySelector(`nav button[data-view="${view}"]`)?.click();
      }
      window.__repforgeShowSettings?.();
      window.startTour?.("replay");
      for (let i = 0; i < 11; i++) document.querySelector("#tourNext")?.click();
      window.closeTour?.();
    };
    window.RepForgeI18n.setLang("en");
    window.RepForgeI18n.applyDom();
    visit();
    window.RepForgeI18n.setLang("pt");
    window.RepForgeI18n.applyDom();
    visit();
    return seen;
  });
  await browser.close();
  return missing;
}

async function main() {
  console.log("\ni18n parity");
  const enSrc = readFileSync(join(ROOT, "i18n-en.json"), "utf8");
  const ptSrc = readFileSync(join(ROOT, "i18n-pt.json"), "utf8");
  const enDups = findDuplicateKeys(enSrc, "i18n-en.json");
  const ptDups = findDuplicateKeys(ptSrc, "i18n-pt.json");
  assert(!enDups.length, "EN JSON has no duplicate keys", enDups.join("; "));
  assert(!ptDups.length, "PT JSON has no duplicate keys", ptDups.join("; "));

  const en = JSON.parse(enSrc);
  const pt = JSON.parse(ptSrc);
  const runtime = loadRuntimeDicts();

  const enKeys = Object.keys(en).sort();
  const ptKeys = Object.keys(pt).sort();
  const missingPt = enKeys.filter((k) => !(k in pt));
  const missingEn = ptKeys.filter((k) => !(k in en));
  assert(!missingPt.length && !missingEn.length, "EN/PT JSON key sets match", `pt missing ${missingPt.slice(0, 8)} en missing ${missingEn.slice(0, 8)}`);

  const enRtMiss = enKeys.filter((k) => runtime.en[k] !== en[k]);
  const ptRtMiss = ptKeys.filter((k) => runtime.pt[k] !== pt[k]);
  assert(!enRtMiss.length, "EN JSON matches EN runtime dictionary", enRtMiss.slice(0, 8).join(", "));
  assert(!ptRtMiss.length, "PT JSON matches PT runtime dictionary", ptRtMiss.slice(0, 8).join(", "));
  assert(Object.keys(runtime.en).length === enKeys.length, "EN runtime has the same key count as EN JSON", `${Object.keys(runtime.en).length} vs ${enKeys.length}`);
  assert(Object.keys(runtime.pt).length === ptKeys.length, "PT runtime has the same key count as PT JSON", `${Object.keys(runtime.pt).length} vs ${ptKeys.length}`);

  const privacyCopy = {
    en: {
      "meta.description": "Taurifer keeps workout logs, drafts, and history on this device. Setup links share a program and selected settings.",
      "tour.0.body": "Workout logs, drafts, and history stay on this device. Taurifer never uploads them. Setup links share a program, its configuration, eight selected settings, and the app language. They never include workout history. Choose <b>Next</b> to see each part of the app, or <b>Skip tour</b> to close this guide.",
      "program.share_setup_body": "The link shares this program, its configuration, eight selected settings, and the app language. It does not include workout history. For iOS installation, a temporary cookie stores the compressed proposal. The static host receives that cookie with matching index.html requests for up to seven days. Compression and encoding do not encrypt the proposal.",
    },
    pt: {
      "meta.description": "O Taurifer mantém seus treinos, rascunhos e histórico neste dispositivo. Links de configuração compartilham um programa e ajustes selecionados.",
      "tour.0.body": "Seus treinos, rascunhos e histórico ficam neste dispositivo. O Taurifer nunca os envia. Links de configuração compartilham um programa, sua configuração, oito ajustes selecionados e o idioma do app. Eles nunca incluem o histórico de treinos. Toque em <b>Próximo</b> para conhecer cada parte do app ou em <b>Pular tour</b> para fechar este guia.",
      "program.share_setup_body": "O link compartilha este programa, sua configuração, oito ajustes selecionados e o idioma do app. Ele não inclui o histórico de treinos. Para instalar no iOS, um cookie temporário armazena a proposta comprimida. O host estático recebe esse cookie com as requisições correspondentes de index.html por até sete dias. A compressão e a codificação não criptografam a proposta.",
    },
  };
  for (const lang of ["en", "pt"]) {
    const mismatches = Object.entries(privacyCopy[lang])
      .filter(([key, value]) => runtime[lang][key] !== value)
      .map(([key]) => key);
    assert(!mismatches.length, `${lang.toUpperCase()} generated catalog has the setup-link privacy disclosure`, mismatches.join(", "));
  }

  const phBad = enKeys.filter((k) => placeholders(en[k]).join(",") !== placeholders(pt[k]).join(","));
  assert(!phBad.length, "EN/PT placeholder names match for every key", phBad.slice(0, 8).join(", "));

  const canonicalEthos = {
    en: "Challenge after challenge.\nDay after day.\nEvery time you go beyond\nwhat you thought possible,\nthe effort shapes you.\n\nIt becomes part of\nwho you are.\nAnd you become who you needed to be.\n\nStrength, then, is yours —\nnot because it was given to you,\nbut because you built it.",
    pt: "Desafio após desafio.\nDia após dia.\nToda vez que você vai além\ndo que julgava possível,\no esforço molda você.\n\nEle passa a fazer parte\nde quem você é.\nE você se torna quem precisou ser.\n\nA força, então, é sua —\nnão porque lhe foi dada,\nmas porque você a construiu.",
  };
  const punctuationPattern = /[—“”‘’]/u;
  for (const [lang, dict] of Object.entries({ en, pt })) {
    assert(
      dict["setup.ethos.body"] === canonicalEthos[lang],
      `${lang.toUpperCase()} setup ethos poem remains canonical`
    );
    const punctuationMisses = Object.entries(dict)
      .filter(([key, value]) => key !== "setup.ethos.body" && punctuationPattern.test(value))
      .map(([key]) => key);
    assert(
      !punctuationMisses.length,
      `${lang.toUpperCase()} app copy avoids em dashes and curly quotes outside the fixed ethos poem`,
      punctuationMisses.slice(0, 8).join(", ")
    );
    const unfinishedToasts = Object.entries(dict)
      .filter(([key, value]) => key.startsWith("toast.") && !/[.!?…]$/u.test(value))
      .map(([key]) => key);
    assert(
      !unfinishedToasts.length,
      `${lang.toUpperCase()} toasts end with punctuation`,
      unfinishedToasts.slice(0, 8).join(", ")
    );
  }

  const aiVocabulary =
    /\b(?:additionally|crucial|delve|enduring|enhance|fostering|garner|interplay|intricate|landscape|pivotal|showcase|tapestry|testament|underscore|vibrant|utilize|leverage|facilitate|serves as|stands as|boasts)\b/iu;
  const aiVocabularyMisses = Object.entries(en)
    .filter(([, value]) => aiVocabulary.test(value))
    .map(([key]) => key);
  assert(
    !aiVocabularyMisses.length,
    "EN app copy avoids flagged filler vocabulary",
    aiVocabularyMisses.slice(0, 8).join(", ")
  );

  const todayTabKeys = ["history.empty.sessions", "exercise.session_history.lede"];
  for (const [lang, dict] of Object.entries({ en, pt })) {
    const staleTabNames = todayTabKeys.filter((key) => !dict[key].includes(dict["nav.log"]));
    assert(
      !staleTabNames.length,
      `${lang.toUpperCase()} guidance names the current Today tab`,
      staleTabNames.join(", ")
    );
  }

  const colonCrutchKeys = [
    "log.prev",
    "log.substitute.label",
    "session_banner.today.title",
    "settings.notifications.permission",
    "settings.storage.last_backup",
    "settings.storage.last_backup_never",
    "delta.preview",
    "toast.workout_pr",
    "toast.command_applied",
  ];
  for (const [lang, dict] of Object.entries({ en, pt })) {
    const colonCrutches = colonCrutchKeys.filter((key) => dict[key].includes(":"));
    assert(
      !colonCrutches.length,
      `${lang.toUpperCase()} audited labels do not use colon crutches`,
      colonCrutches.join(", ")
    );
  }
  assert(
    !/\bhot\b/iu.test(en["top.gauge.hot"]) && !/\bquente\b/iu.test(pt["top.gauge.hot"]),
    "Readiness gauge uses a concrete label in both languages"
  );

  const exerciseTemplatePromptKeys = [
    "confirm.remove_exercise",
    "confirm.remove_exercise_discard_draft",
    "confirm.delete_day",
    "confirm.delete_day_discard_draft",
    "confirm.import_program_replace",
  ];
  const enTerminologyMisses = exerciseTemplatePromptKeys.filter((k) => !/\bexercise templates?\b/i.test(en[k]));
  const ptTerminologyMisses = exerciseTemplatePromptKeys.filter((k) => !/\bmodelos? de exercício\b/i.test(pt[k]));
  assert(!enTerminologyMisses.length, "Destructive EN program prompts use exercise-template terminology", enTerminologyMisses.join(", "));
  assert(!ptTerminologyMisses.length, "Destructive PT program prompts use exercise-template terminology", ptTerminologyMisses.join(", "));
  assert(
    !/\bprogram template\b/i.test(en["confirm.replace_program_template"]) &&
      !/\bmodelo de programa\b/i.test(pt["confirm.replace_program_template"]),
    "Whole-program replacement prompts call the object a program"
  );

  const ptCopy = Object.values(pt).join("\n").toLowerCase();
  const awkwardPtPhrases = ["esforço conhecido", "data de calendário real", "depósito deste navegador"];
  const retainedPtCalques = awkwardPtPhrases.filter((phrase) => ptCopy.includes(phrase));
  assert(!retainedPtCalques.length, "PT copy avoids audited literal calques", retainedPtCalques.join(", "));

  // Placeholder tokens carry English names on purpose ({delta}); the prose around them does not.
  const englishInPt = /\b(?:stats|logs?|performance|deltas?|split|offline|aparelhos?)\b/iu;
  const englishPtKeys = Object.entries(pt)
    .filter(([, value]) => englishInPt.test(value.replace(/\{\w+\}/g, " ")))
    .map(([key]) => key);
  assert(
    !englishPtKeys.length,
    "PT copy uses Portuguese words for progress, history, equipment and variation",
    englishPtKeys.slice(0, 8).join(", ")
  );

  const ptProgressTabKeys = ["stats.aria", "stats.title", "program.planned_volume.lede"];
  const ptStaleProgressNames = ptProgressTabKeys.filter((key) => !pt[key].includes(pt["nav.stats"]));
  assert(
    !ptStaleProgressNames.length,
    "PT guidance names the current Progress tab",
    ptStaleProgressNames.join(", ")
  );

  const controlReferences = [
    ["log.unfinished.body", "log.finish"],
    ["tour.8.body", "program.end_block"],
  ];
  for (const [lang, dict] of Object.entries({ en, pt })) {
    const staleControls = controlReferences
      .filter(([bodyKey, controlKey]) => !dict[bodyKey].includes(dict[controlKey]))
      .map(([bodyKey, controlKey]) => `${bodyKey} → ${controlKey}`);
    assert(
      !staleControls.length,
      `${lang.toUpperCase()} guidance names the control it points at`,
      staleControls.join(", ")
    );
  }

  const ptPluralAgreementKeys = [
    "delta.count.improved",
    "delta.count.flat",
    "delta.count.regressed",
    "review.lifts_summary",
    "review.summary.lifts",
    "review.summary.lifts_flat",
    "stats.this_week.improved",
    "stats.this_week.stable",
    "toast.workout_forged",
  ];
  const ptPluralVerbs = /\b\w+(?:aram|eram|iram|ãos)\b|\b(?:estáveis|travados|registradas)\b/iu;
  const ptAgreementMisses = ptPluralAgreementKeys.filter((key) => ptPluralVerbs.test(pt[key]));
  assert(
    !ptAgreementMisses.length,
    "PT counted phrases read correctly when the count is one",
    ptAgreementMisses.join(", ")
  );

  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const domKeys = htmlI18nKeys(html);
  const missingDom = [...domKeys].filter((k) => !(k in en) || !(k in pt));
  assert(!missingDom.length, "Every index.html i18n attribute exists in both languages", missingDom.join(", "));

  const jsFiles = ["app.js", "notify.js", "schedule.js"].map((f) => ({ f, src: readFileSync(join(ROOT, f), "utf8") }));
  const needed = new Set();
  const unmatched = [];
  for (const { f, src } of jsFiles) {
    const { literals, dyn, plurals } = extractJsKeys(src);
    for (const k of literals) needed.add(k);
    for (const word of plurals) {
      needed.add(`plural.${word}.one`);
      needed.add(`plural.${word}.other`);
    }
    for (const expr of dyn) {
      const fam = DYNAMIC_FAMILIES.filter((family) => family.test(expr));
      if (!fam.length) unmatched.push(`${f}: ${expr}`);
      for (const family of fam) for (const k of family.keys(en)) needed.add(k);
    }
  }
  assert(!unmatched.length, "Every dynamic t() expression has an enumerated family", unmatched.join(" | "));
  const missingJs = [...needed].filter((k) => !(k in en) || !(k in pt));
  assert(!missingJs.length, "Every JS t()/tp() family key exists in both languages", missingJs.slice(0, 12).join(", "));

  let browserMissing = [];
  try {
    browserMissing = await runBrowserParity(en, pt);
  } catch (err) {
    assert(false, "Browser i18n walk completed", String(err));
  }
  assert(
    !browserMissing.length,
    "Populated EN/PT views never render a raw or fallback key",
    browserMissing
      .slice(0, 8)
      .map((x) => `${x.lang}:${x.key}`)
      .join(", ")
  );

  console.log(`\ni18n: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("i18n.mjs crashed:", err);
    process.exit(2);
  });
}
