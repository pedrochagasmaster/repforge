/** Best-effort diagnostics, enabled only for an explicit trace/diagnostic run. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let browserNumber = 0;
export function instrumentBrowser(browser, directory) {
  const prefix = `browser-${++browserNumber}`;
  const contexts = new Map();
  let contextNumber = 0;
  const attach = async (context) => {
    if (contexts.has(context)) return;
    const dir = join(directory, prefix, `context-${++contextNumber}`);
    mkdirSync(dir, { recursive: true });
    const events = [];
    const record = (type, text) => {
      if (events.length < 200) events.push({ type, text: String(text).slice(0, 2000) });
    };
    const pageListener = (page) => {
      page.on("console", (message) => { if (["error", "warning"].includes(message.type())) record(message.type(), message.text()); });
      page.on("pageerror", (error) => record("pageerror", error.message));
    };
    context.on("page", pageListener);
    for (const page of context.pages()) pageListener(page);
    let tracing = false, completed = false;
    try { await context.tracing.start({ screenshots: true, snapshots: true, sources: false }); tracing = true; }
    catch (error) { record("artifact-error", error.message); }
    const save = async () => {
      if (completed) return;
      completed = true;
      let index = 0;
      for (const page of context.pages()) {
        try { await page.screenshot({ path: join(dir, `page-${++index}.png`), timeout: 2000 }); }
        catch (error) { record("artifact-error", error.message); }
      }
      if (tracing) {
        try { await context.tracing.stop({ path: join(dir, "trace.zip") }); }
        catch (error) { record("artifact-error", error.message); }
      }
      writeFileSync(join(dir, "events.json"), JSON.stringify(events, null, 2) + "\n");
      contexts.delete(context);
    };
    contexts.set(context, save);
    const close = context.close.bind(context);
    context.close = async (...args) => {
      try { await save(); } catch (error) { console.warn(`Browser diagnostics: ${error.message}`); }
      return close(...args);
    };
    context.once("close", () => contexts.delete(context));
  };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await attach(context);
    return context;
  };
  // Playwright's convenience newPage creates its context internally.
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    await attach(page.context());
    return page;
  };
  const close = browser.close.bind(browser);
  browser.close = async (...args) => {
    for (const save of contexts.values()) {
      try { await save(); } catch (error) { console.warn(`Browser diagnostics: ${error.message}`); }
    }
    return close(...args);
  };
  return browser;
}
