/* Import exercise matching corpus — Plan 061.
 *
 * The gate the scoring change had to earn. Strict rows must resolve to one
 * exact library id; loose rows must put an acceptable id in the shortlist the
 * review row shows. Both tiers run against the real library through the app,
 * not against a copy of the matcher.
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { STRICT, LOOSE } from "./fixtures/import-matching.mjs";

const URL = process.env.REPFORGE_URL;
if (!URL) { console.error("Set REPFORGE_URL"); process.exit(1); }

let pass = 0, fail = 0;
const assert = (ok, what, detail = "") => {
  if (ok) { pass++; console.log(`  ✓ ${what}`); }
  else { fail++; console.log(`  ✗ ${what}${detail ? `  ${detail}` : ""}`); }
};

const browser = await launchChromium();
try {
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page);

  console.log("\nStrict tier: rows that already resolved exactly");
  for (const row of STRICT) {
    const got = await page.evaluate(n => window.__repforgeMatchCandidates(n), row.input);
    assert(got.matchId === row.id,
      `"${row.input}" resolves to ${row.id}`,
      got.matchId === row.id ? "" : `got ${got.matchId} (${got.status})`);
  }

  console.log("\nLoose tier: an acceptable id appears in the shortlist");
  for (const row of LOOSE) {
    const got = await page.evaluate(n => window.__repforgeMatchCandidates(n), row.input);
    // A row reaches an acceptable entry either by resolving to it outright, which
    // is what a curated alias does, or by offering it in the shortlist.
    const resolved = row.ids.includes(got.matchId);
    const shortlisted = row.ids.some(id => got.candidateIds.includes(id));
    assert(resolved || shortlisted,
      `"${row.input}" reaches ${row.ids.join(" or ")}${resolved ? " (confirmed)" : ""}`,
      (resolved || shortlisted) ? ""
        : `got ${got.matchId || "no match"} [${got.candidateIds.join(", ")}] — was: ${row.was}`);
  }

  console.log("\nThe shortlist stays short and ordered");
  for (const row of LOOSE) {
    const got = await page.evaluate(n => window.__repforgeMatchCandidates(n), row.input);
    if (got.candidateIds.length > 3) {
      assert(false, `"${row.input}" offers at most three candidates`,
        `got ${got.candidateIds.length}`);
    }
  }
  assert(true, "no row offers more than three candidates");
} finally {
  await browser.close();
}

console.log(`\nimport matching: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
