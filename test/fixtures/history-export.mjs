/**
 * The saved tonnage of each session, as History's CSV export carries it.
 *
 * History's session page says what a session was, never how much it weighed
 * (owner rule, 2026-11 History hill-climb), so suites that prove a session's
 * physical tonnage read it from the export: the working rows of each session
 * whose tonnage is known, summed. A session with no known tonnage reads null.
 */
import { readFileSync } from "node:fs";

export function csvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

export async function exportedSessionTonnage(page, sessions) {
  await page.locator('nav button[data-view="history"]').click();
  await page.waitForSelector("#history.view.active #historyExportBtn", { timeout: 10000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#historyExportBtn").click()]);
  const [head = [], ...body] = csvRows(readFileSync(await download.path(), "utf8"));
  const column = Object.fromEntries(head.map((name, index) => [name, index]));
  const wanted = new Set(sessions.map(String));
  const moved = Object.fromEntries([...wanted].map((session) => [session, null]));
  for (const row of body) {
    const session = row[column.session];
    if (!wanted.has(session) || row[column.is_warmup] === "1" || row[column.tonnage] === "") continue;
    moved[session] = (moved[session] ?? 0) + Number(row[column.tonnage]);
  }
  for (const session of Object.keys(moved)) if (moved[session] != null) moved[session] = Math.round(moved[session] * 100) / 100;
  return moved;
}
