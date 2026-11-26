// Capture the trainer-loop candidates across the review matrix: light and dark, 390 and 320 wide, EN and PT,
// normal and 200% text. Each frame opens a real catalog state of the app through the screen catalog's own harness
// (test/fixtures/catalog-state.mjs) and applies one state from states.mjs on top.
//
//   REPFORGE_URL=http://127.0.0.1:<port>/ node docs/design/trainer-loop-app/capture.mjs [--only id,id] [--out dir]
//
// Serve the repository root first (python3 -m http.server 0 --bind 127.0.0.1). Frames go to --out (a temporary
// directory by default); one WebP contact sheet per state is written to ./sheets/. Mock data only: the links and QR
// codes point at no record.
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { STATES } from "./states.mjs";
import { NEW, EXISTING, DEMO } from "./strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const { chromium } = createRequire(join(root, "test/package.json"))("playwright");
const QR = createRequire(join(root, "services/trainer-relay/package.json"))("qrcode");
const { openCatalogState, inPool } = await import(join(root, "test/fixtures/catalog-state.mjs"));
if (!process.env.REPFORGE_URL) throw new Error("REPFORGE_URL must name a server rooted at this repository");

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const only = arg("--only")?.split(",");
const out = arg("--out") || await mkdtemp(join(tmpdir(), "trainer-loop-app-"));
await mkdir(out, { recursive: true });

const i18n = { en: JSON.parse(await readFile(join(root, "i18n-en.json"), "utf8")), pt: JSON.parse(await readFile(join(root, "i18n-pt.json"), "utf8")) };
const translator = (lang) => (key, vars = {}) => {
  const pair = NEW[key];
  let text = pair ? pair[lang === "pt" ? 1 : 0] : EXISTING.includes(key) ? i18n[lang][key] : null;
  if (text == null) throw new Error(`no string ${key}`);
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
};
const demo = (lang) => (key) => DEMO[key][lang === "pt" ? 1 : 0];

// Sample links of the measured length (90 characters for the app, 97 for the trainer site); no such record exists.
const id = "Qm9vdHN0cmFwRGVtb0lk".padEnd(22, "A"), key = "ZGVtby1rZXktbm90LXJlYWwtbm90LWEtcmVjb3JkLXh5".slice(0, 43);
const qrFor = async (origin) => QR.toString(`${origin}/#r=${id}.${key}`, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#ffffff" } });
const qr = await qrFor("https://taurifer.com"), qrStudio = await qrFor("https://studio.taurifer.com");
const css = await readFile(join(here, "mock.css"), "utf8");

/** Runs inside the app page: apply one state's spec to the real DOM. */
function render(spec) {
  const fr = document.querySelector("#firstRun");
  if (spec.kind === "gate") {
    const head = document.querySelector("#firstRunHeadline");
    head.textContent = spec.headline;
    const lede = document.querySelector("#firstRunLede");
    if (spec.lede != null) { lede.textContent = spec.lede; lede.classList.remove("hidden"); }
    const card = document.querySelector("#firstRunSharedCard");
    const error = document.querySelector("#firstRunSharedError");
    if (spec.card) { card.innerHTML = spec.card; card.classList.remove("hidden"); }
    if (spec.error != null) { error.textContent = spec.error; error.classList.remove("hidden"); }
    if (spec.busy) {
      document.querySelector("#firstRunSharedBusy")?.classList.remove("hidden");
      const go = document.querySelector("#firstRunSharedStart");
      if (go) { go.disabled = true; go.setAttribute("aria-busy", "true"); }
    }
    if (spec.primary) {
      const actions = document.querySelector("#firstRunStandardProgram");
      actions.insertAdjacentHTML("afterbegin", spec.primary);
    }
    fr.scrollTop = 0;
    return;
  }
  if (spec.kind === "card") {
    const week = document.querySelector("#todayWeekCard");
    const card = week.cloneNode(false);
    card.removeAttribute("id"); card.setAttribute("aria-label", "");
    card.innerHTML = spec.html;
    week.before(card);
    return;
  }
  // Sheets reuse the app's Share setup sheet, so band, scroller and action bar are the production component.
  for (const open of document.querySelectorAll(".sheet.is-open,.sheet-scrim.is-open")) { open.classList.remove("is-open"); open.classList.add("hidden"); open.hidden = true; }
  const sheet = document.querySelector("#shareSetupSheet"), scrim = document.querySelector("#shareSetupScrim");
  sheet.querySelector("#shareSetupTitle").textContent = spec.title;
  const sub = sheet.querySelector("#shareSetupFor");
  if (spec.sub !== null) sub.textContent = spec.sub || "";
  sub.classList.toggle("hidden", !sub.textContent);
  sheet.querySelector(".sheet__body").innerHTML = spec.body;
  const foot = sheet.querySelector(".sheet__foot");
  foot.innerHTML = (spec.note ? `<p class="tl-caption tl-foot-note">${spec.note.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</p>` : "") + spec.foot;
  document.documentElement.classList.toggle("tl-large", document.documentElement.style.fontSize === "200%");
  foot.classList.toggle("tl-foot-stack", !!spec.stack);
  for (const el of [sheet, scrim]) { el.hidden = false; el.classList.remove("hidden"); el.classList.add("is-open"); }
  sheet.style.transition = "none";
}

const variants = [];
for (const width of [390, 320]) for (const text of ["normal", "text200"]) for (const lang of ["en", "pt"]) for (const theme of ["light", "dark"]) variants.push({ width, text, lang, theme });
const states = STATES.filter((s) => !only || only.includes(s.id));
const jobs = states.flatMap((state) => variants.map((v) => ({ state, ...v })));
const cells = [];
const browser = await chromium.launch();
try {
  await inPool(jobs, 3, async (job) => {
    const t = translator(job.lang), d = demo(job.lang);
    const probe = job.state.build(t, d, { qr, qrStudio, program: "" });
    const opened = await openCatalogState(browser, probe.base, job.width, job.lang, job.text, { theme: job.theme });
    try {
      const { page } = opened;
      await page.addStyleTag({ content: css });
      const program = await page.evaluate(() => document.querySelector("#todayProgram b, #todayProgram strong, .today-prog__name")?.textContent?.trim()
        || document.querySelector("#shareSetupFor")?.textContent?.trim() || "");
      const spec = job.state.build(t, d, { qr, qrStudio, program: program || d("program") });
      await page.evaluate(render, spec);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(120);
      const file = join(out, `${job.state.id}__${job.width}-${job.theme}-${job.lang}-${job.text}.png`);
      await page.screenshot({ path: file });
      cells.push({ state: job.state.id, title: job.state.title, slice: job.state.slice, width: job.width, theme: job.theme, lang: job.lang, text: job.text, file });
    } finally { await opened.context.close(); }
  });
} finally { await browser.close(); }
await writeFile(join(out, "cells.json"), JSON.stringify(cells, null, 1));
execFileSync("python3", [join(here, "contact-sheets.py"), join(out, "cells.json"), join(here, "sheets")], { stdio: "inherit" });
console.log(`${cells.length} frames in ${out}`);
