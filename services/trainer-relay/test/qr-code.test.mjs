// The app's own QR encoder (qr-code.js, Plan 086 slice 2): every code it draws must read back exactly.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import jsQR from "jsqr";

const require = createRequire(import.meta.url);
const Qr = require("../../../qr-code.js");

function read(text, scale = 4) {
  const { size, modules } = Qr.encode(text);
  const quiet = 4, full = (size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(full * full * 4).fill(255);
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const at = (((y + quiet) * scale + dy) * full + (x + quiet) * scale + dx) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
    }
  }));
  return jsQR(pixels, full, full, { inversionAttempts: "dontInvert" })?.data ?? null;
}

const link = (origin) => `${origin}/#r=${randomBytes(16).toString("base64url")}.${randomBytes(32).toString("base64url")}`;

test("relay links of the measured lengths read back exactly, at version 6 or below", () => {
  for (let i = 0; i < 40; i++) {
    for (const origin of ["https://taurifer.com", "https://studio.taurifer.com", "http://127.0.0.1:41234"]) {
      const text = link(origin);
      assert.equal(read(text), text);
      assert.ok(Qr.encode(text).version <= 6, `version ${Qr.encode(text).version} for ${text.length} characters`);
    }
  }
});

test("every version and every mask the encoder picks reads back", () => {
  const seen = new Set();
  for (let length = 1; length <= 1200; length += length < 60 ? 1 : 37) {
    const text = randomBytes(length).toString("base64url").slice(0, length);
    const { version } = Qr.encode(text);
    seen.add(version);
    assert.equal(read(text, version > 20 ? 2 : 3), text, `length ${length}, version ${version}`);
  }
  assert.ok(seen.size >= 20, `covered ${seen.size} versions`);
  assert.equal(read("Olá, Taurifer · ação"), "Olá, Taurifer · ação", "UTF-8 bytes read back");
});

test("the SVG is black on white with a quiet zone, and too-long text is refused", () => {
  const svg = Qr.toSvg("https://taurifer.com/#r=x", { label: 'QR "code"' });
  assert.match(svg, /^<svg [^>]*viewBox="0 0 (\d+) \1"/);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fff"\/><path d="M4 4h1v1h-1z/);
  assert.match(svg, /aria-label="QR &quot;code&quot;"/);
  assert.throws(() => Qr.encode("x".repeat(3000)), RangeError);
});
