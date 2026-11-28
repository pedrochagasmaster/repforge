/* QR codes for relay links (Plan 086 slice 2). Pure, no DOM: byte mode, error correction M,
 * versions 1–40, the lowest version that fits, the mask with the lowest penalty (ISO/IEC 18004).
 * `toSvg` draws black modules on white with a quiet zone, because cameras read dark on light in
 * either theme. test/qr-code-unit.mjs decodes every output with jsQR. */
(function qrCode(root) {
  "use strict";

  // Error correction M only. Per version: codewords of EC per block, then the number of blocks.
  const EC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const FORMAT_BITS_M = 0; // M is 00 in the format information.

  function rawModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const align = Math.floor(version / 7) + 2;
      result -= (25 * align - 10) * align - 55;
      if (version >= 7) result -= 36;
    }
    return result;
  }
  const dataCodewords = (version) => Math.floor(rawModules(version) / 8) - EC_PER_BLOCK[version] * BLOCKS[version];

  // GF(256) with the QR polynomial 0x11D.
  function multiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
  }
  function divisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let rootValue = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = multiply(result[j], rootValue);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootValue = multiply(rootValue, 0x02);
    }
    return result;
  }
  function remainder(data, div) {
    const result = new Array(div.length).fill(0);
    for (const byte of data) {
      const factor = byte ^ result.shift();
      result.push(0);
      div.forEach((coefficient, i) => { result[i] ^= multiply(coefficient, factor); });
    }
    return result;
  }

  function utf8(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function encodeData(bytes, version) {
    const bits = [];
    const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, version <= 9 ? 8 : 16);
    for (const byte of bytes) push(byte, 8);
    const capacity = dataCodewords(version) * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    return codewords;
  }

  function interleave(data, version) {
    const blockCount = BLOCKS[version], ecLength = EC_PER_BLOCK[version];
    const raw = Math.floor(rawModules(version) / 8);
    const shortCount = blockCount - (raw % blockCount);
    const shortLength = Math.floor(raw / blockCount);
    const div = divisor(ecLength);
    const blocks = [];
    for (let i = 0, k = 0; i < blockCount; i++) {
      const length = shortLength - ecLength + (i < shortCount ? 0 : 1);
      const block = data.slice(k, k + length);
      k += length;
      const ec = remainder(block, div);
      if (i < shortCount) block.push(0);
      blocks.push(block.concat(ec));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortLength - ecLength || j >= shortCount) result.push(block[i]);
      });
    }
    return result;
  }

  function alignmentPositions(version) {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const result = [6];
    for (let position = version * 4 + 10; result.length < count; position -= step) result.splice(1, 0, position);
    return result;
  }

  function build(version, codewords, mask) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, distance !== 2 && distance !== 4);
      }
    }
    const positions = alignmentPositions(version);
    positions.forEach((ay, i) => positions.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    drawFormat(modules, fixed, size, mask, set);
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((bits >>> i) & 1) === 1;
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, dark); set(b, a, dark);
      }
    }

    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (fixed[y][x] || i >= codewords.length * 8) continue;
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!fixed[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
    }
    return modules;
  }

  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  }

  function drawFormat(modules, fixed, size, mask, set) {
    const data = (FORMAT_BITS_M << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  }

  function penalty(modules) {
    const size = modules.length;
    let result = 0;
    const runs = (line) => {
      let score = 0, run = 1;
      for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      const text = line.map((dark) => (dark ? "1" : "0")).join("");
      for (const pattern of ["10111010000", "00001011101"]) {
        for (let at = text.indexOf(pattern); at >= 0; at = text.indexOf(pattern, at + 1)) score += 40;
      }
      return score;
    };
    let dark = 0;
    for (let y = 0; y < size; y++) {
      result += runs(modules[y]);
      result += runs(modules.map((row) => row[y]));
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
        }
      }
    }
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  }

  /** { version, size, modules } for `text` (UTF-8 bytes) at error correction M. */
  function encode(text) {
    if (typeof text !== "string") throw new TypeError("QR text must be a string");
    const bytes = utf8(text);
    let version = 1;
    for (; version <= 40; version++) {
      const header = 4 + (version <= 9 ? 8 : 16);
      if (header + bytes.length * 8 <= dataCodewords(version) * 8) break;
    }
    if (version > 40) throw new RangeError("text too long for a QR code");
    const codewords = interleave(encodeData(bytes, version), version);
    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const modules = build(version, codewords, mask);
      const score = penalty(modules);
      if (score < bestScore) { best = modules; bestScore = score; }
    }
    return { version, size: best.length, modules: best };
  }

  /** An SVG string: one path of dark modules on a white square with a four-module quiet zone. */
  function toSvg(text, { label = "" } = {}) {
    const { size, modules } = encode(text);
    const quiet = 4, full = size + quiet * 2;
    let path = "";
    modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
    const escape = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"${label ? ` role="img" aria-label="${escape(label)}"` : ' aria-hidden="true"'}>`
      + `<rect width="${full}" height="${full}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  const api = Object.freeze({ encode, toSvg });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeQrCode = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
