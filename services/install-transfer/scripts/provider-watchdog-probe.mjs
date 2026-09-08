import { readFile } from "node:fs/promises";
import { parseProviderHealthObservation } from "../src/observation.js";

const receiptPath = requiredReceiptPath();
const value = await readJson(receiptPath);
const parsed = parseProviderHealthObservation(value, {
  allowTestFixture: process.env.TRANSFER_ALLOW_TEST_OBSERVATION === "true",
});
process.stdout.write(`${JSON.stringify(parsed)}\n`);

function requiredReceiptPath() {
  const value = process.env.TRANSFER_WATCHDOG_RECEIPT_FILE;
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error("TRANSFER_WATCHDOG_RECEIPT_FILE is required");
  }
  return value;
}

async function readJson(path) {
  let text;
  try { text = await readFile(path, "utf8"); } catch { throw new Error("watchdog receipt is unavailable"); }
  if (text.length > 16_384) throw new Error("watchdog receipt is too large");
  try { return JSON.parse(text); } catch { throw new Error("watchdog receipt is invalid JSON"); }
}
