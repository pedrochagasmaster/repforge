#!/usr/bin/env node
/**
 * DESIGN.md value gate: the design record may not drift from the live tokens.
 *
 * MECHANISM (one, on purpose). Every scalar in the front-matter blocks
 * `colors`, `colors-dark`, `typography`, `elevation`, `rounded` and `spacing`
 * ends in a trailing YAML comment that names the CSS custom property it
 * records:
 *
 *     paper: "#F4F2EF"      # token: --bg
 *     fontSize: "1.5rem"    # token: --font-size-section-title
 *
 * The check reads `styles.css`, resolves that token (following `var(--x)`
 * chains, including `rgba(var(--x-rgb), a)`), and fails unless the value written
 * in DESIGN.md equals the resolved value after normalisation (case, spaces,
 * quotes and leading zeros). `colors` resolve against the light `:root` block;
 * `colors-dark` resolve against `:root[data-theme="dark"]` laid over it (so a
 * token the dark block does not redeclare keeps its light value, as in the
 * browser). A scalar with no `# token:` comment, a token that is not declared in
 * `styles.css`, or a key whose dark entry names a different token than its
 * light entry is an error. `components` may only reference those blocks with
 * `{path.to.value}`, or carry a `# token:` comment on a literal.
 *
 * Two further guards keep the prose honest. Every `#RRGGBB` literal in the body
 * must be the value of some colour token in either theme, and every backticked
 * `--name` must be a custom property `styles.css` declares. The eight canonical
 * section headings must appear in order.
 *
 * The default run checks the real files, then proves the gate can fail: it seeds
 * eight wrong copies of DESIGN.md in memory and exits non-zero if any of them
 * passes. `--no-self-test` skips that second half; `--file` and `--css` point at
 * other inputs (the self-test uses them too).
 *
 *   node tools/check-design-md.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN_BLOCKS = ["colors", "colors-dark", "typography", "elevation", "rounded", "spacing"];
const COMPONENT_PROPS = new Set(["backgroundColor", "textColor", "typography", "rounded", "padding", "size", "height", "width"]);
const SECTIONS = ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Shapes", "Components", "Do's and Don'ts"];

/* ---------------------------------------------------------------- styles.css */

/** Strip comments, then read the body of the first block that opens with `selector{`. */
function blockBody(css, selector) {
  const open = css.indexOf(`${selector}{`);
  if (open < 0) throw new Error(`styles.css has no ${selector} block`);
  let depth = 0;
  for (let index = open + selector.length; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + selector.length + 1, index);
    }
  }
  throw new Error(`styles.css ${selector} block does not close`);
}

/** Custom-property declarations of one block body, honouring quotes and parentheses. */
function declarations(body) {
  const found = new Map();
  let index = 0;
  while (index < body.length) {
    const start = body.indexOf("--", index);
    if (start < 0) break;
    const colon = body.indexOf(":", start);
    const name = body.slice(start, colon).trim();
    if (!/^--[a-z0-9-]+$/i.test(name)) { index = start + 2; continue; }
    let depth = 0;
    let quote = null;
    let end = colon + 1;
    for (; end < body.length; end += 1) {
      const char = body[end];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      else if (char === ";" && depth === 0) break;
    }
    found.set(name, body.slice(colon + 1, end).trim());
    index = end + 1;
  }
  return found;
}

export function loadTokens(cssText) {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const light = declarations(blockBody(css, ":root"));
  const darkOnly = declarations(blockBody(css, ':root[data-theme="dark"]'));
  return { light, dark: new Map([...light, ...darkOnly]) };
}

export function resolveToken(tokens, name, theme, trail = []) {
  if (trail.includes(name)) throw new Error(`token cycle: ${[...trail, name].join(" -> ")}`);
  const raw = tokens[theme].get(name);
  if (raw === undefined) throw new Error(`${name} is not declared in styles.css`);
  return raw.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)/gi, (_, inner) => resolveToken(tokens, inner, theme, [...trail, name]));
}

export function normalise(value) {
  return String(value)
    .trim()
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/(^|[^0-9])0\.(?=\d)/g, "$1.")
    .replace(/^0(px|rem)$/, "0")
    .toLowerCase();
}

/* --------------------------------------------------------- DESIGN.md parsing */

export function splitDesign(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("DESIGN.md has no YAML front matter");
  return { frontMatter: match[1], body: match[2] };
}

/** Split `value   # token: --x` into the value text and the token name. A `#` inside quotes is not a comment. */
function splitComment(rest) {
  let quote = null;
  for (let index = 0; index < rest.length; index += 1) {
    const char = rest[index];
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === "#" && (index === 0 || /\s/.test(rest[index - 1]))) {
      const token = /^#\s*token:\s*(--[a-z0-9-]+)\s*$/i.exec(rest.slice(index));
      return { value: rest.slice(0, index).trim(), token: token ? token[1] : null, comment: rest.slice(index) };
    }
  }
  return { value: rest.trim(), token: null, comment: "" };
}

/** The front-matter subset this file uses: nested maps of scalars, two-space indentation. */
export function parseFrontMatter(source) {
  const root = {};
  const stack = [{ indent: -1, node: root }];
  source.split("\n").forEach((line, number) => {
    if (!line.trim() || /^\s*#/.test(line)) return;
    const match = /^(\s*)([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(line);
    if (!match) throw new Error(`front matter line ${number + 1} is not "key: value": ${line}`);
    const indent = match[1].length;
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).node;
    const rest = match[3];
    if (rest === undefined || rest === "") {
      parent[match[2]] = {};
      stack.push({ indent, node: parent[match[2]] });
    } else {
      const { value, token } = splitComment(rest);
      parent[match[2]] = { value: value.replace(/^"(.*)"$/, "$1"), token, line: number + 1 };
    }
  });
  return root;
}

const isScalar = (node) => node && typeof node.value === "string";

function* scalars(node, path = []) {
  for (const [key, child] of Object.entries(node)) {
    if (isScalar(child)) yield { path: [...path, key], scalar: child };
    else yield* scalars(child, [...path, key]);
  }
}

/* --------------------------------------------------------------------- check */

export function checkDesign(designText, cssText) {
  const errors = [];
  const tokens = loadTokens(cssText);
  const { frontMatter, body } = splitDesign(designText);
  const data = parseFrontMatter(frontMatter);
  for (const field of ["name", "description"]) {
    if (!isScalar(data[field]) || !data[field].value) errors.push(`front matter has no ${field}`);
  }

  const compare = (label, scalar, theme) => {
    if (!scalar.token) { errors.push(`${label}: no "# token: --name" comment (line ${scalar.line})`); return; }
    let live;
    try { live = resolveToken(tokens, scalar.token, theme); } catch (error) { errors.push(`${label}: ${error.message}`); return; }
    if (normalise(scalar.value) !== normalise(live)) {
      errors.push(`${label}: DESIGN.md says ${scalar.value}, ${scalar.token} is ${live} (${theme})`);
    }
  };

  const defined = new Set();
  for (const block of TOKEN_BLOCKS) {
    if (!data[block] || isScalar(data[block])) { errors.push(`front matter has no ${block} block`); continue; }
    for (const { path, scalar } of scalars(data[block], [block])) {
      for (let length = 1; length <= path.length; length += 1) defined.add(path.slice(0, length).join("."));
      compare(path.join("."), scalar, block === "colors-dark" ? "dark" : "light");
    }
  }
  for (const [key, dark] of Object.entries(data["colors-dark"] || {})) {
    const light = data.colors?.[key];
    if (!light) errors.push(`colors-dark.${key} has no colors.${key}`);
    else if (isScalar(dark) && dark.token !== light.token) errors.push(`colors-dark.${key} names ${dark.token} but colors.${key} names ${light.token}`);
  }

  if (data.components && !isScalar(data.components)) {
    for (const [name, props] of Object.entries(data.components)) {
      for (const [prop, scalar] of Object.entries(props)) {
        const label = `components.${name}.${prop}`;
        if (!isScalar(scalar)) { errors.push(`${label} is not a scalar`); continue; }
        if (!COMPONENT_PROPS.has(prop)) errors.push(`${label}: ${prop} is not a component property`);
        const reference = /^\{([a-z0-9.-]+)\}$/i.exec(scalar.value);
        if (reference) {
          if (!defined.has(reference[1])) errors.push(`${label}: ${scalar.value} does not name a front-matter value`);
        } else if (scalar.value !== "transparent") compare(label, scalar, "light");
      }
    }
  }

  const known = new Set();
  for (const theme of ["light", "dark"]) {
    for (const name of tokens[theme].keys()) {
      try {
        const value = resolveToken(tokens, name, theme);
        if (/^#[0-9a-f]{6}$/i.test(value)) known.add(value.toLowerCase());
      } catch { /* a non-colour token that does not resolve is not a colour */ }
    }
  }
  for (const hex of new Set(body.match(/#[0-9A-Fa-f]{6}\b/g) || [])) {
    if (!known.has(hex.toLowerCase())) errors.push(`body: ${hex} is not the value of any colour token`);
  }
  const declared = new Set([...tokens.light.keys(), ...tokens.dark.keys()]);
  for (const name of new Set(Array.from(body.matchAll(/`(--[a-z0-9-]+)`/gi), (m) => m[1]))) {
    if (!declared.has(name)) errors.push(`body: \`${name}\` is not declared in styles.css`);
  }

  let from = 0;
  for (const heading of SECTIONS) {
    const at = body.indexOf(`\n## ${heading}\n`, from);
    if (at < 0) { errors.push(`body: section "## ${heading}" is missing or out of order`); break; }
    from = at + 1;
  }
  return errors;
}

/* ----------------------------------------------------------------- self-test */

/** Eight seeded faults. Each edit must change the text, and each must make the gate fail. */
export function seededFaults(designText) {
  const edit = (label, pattern, replacement) => ({ label, text: designText.replace(pattern, replacement), pattern });
  return [
    edit("a wrong light colour", /(paper: )"#[0-9A-Fa-f]{6}"/, '$1"#F5F2EF"'),
    edit("a wrong dark colour", /(colors-dark:[\s\S]*?paper: )"#[0-9A-Fa-f]{6}"/, '$1"#151310"'),
    edit("a wrong font size", /(section-title:[\s\S]*?fontSize: )"[^"]+"/, '$1"1.4rem"'),
    edit("a wrong radius", /(control: )"8px"/, '$1"9px"'),
    edit("a wrong spacing step", /(gutter: )"16px"/, '$1"15px"'),
    edit("a missing token comment", /(card: "\d+px")\s+# token: --space-14/, "$1"),
    edit("a token that does not exist", /# token: --space-26/, "# token: --space-27"),
    edit("a stale hex in the prose", /\n## Colors\n/, "\n## Colors\n\nThe page is #F3F2EF.\n"),
  ];
}

function selfTest(designText, cssText) {
  const failures = [];
  for (const fault of seededFaults(designText)) {
    if (fault.text === designText) { failures.push(`self-test cannot seed "${fault.label}": its anchor is gone`); continue; }
    if (checkDesign(fault.text, cssText).length === 0) failures.push(`self-test: ${fault.label} passed the gate`);
  }
  return failures;
}

/* ----------------------------------------------------------------------- CLI */

function option(name, fallback) {
  const at = process.argv.indexOf(name);
  return at >= 0 ? resolve(process.argv[at + 1]) : fallback;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const designPath = option("--file", join(ROOT, "DESIGN.md"));
  const cssPath = option("--css", join(ROOT, "styles.css"));
  const designText = readFileSync(designPath, "utf8");
  const cssText = readFileSync(cssPath, "utf8");
  const problems = checkDesign(designText, cssText);
  if (!process.argv.includes("--no-self-test")) problems.push(...selfTest(designText, cssText));
  if (problems.length) {
    console.error(`DESIGN.md does not match the live tokens (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const tokenCount = [...scalars(parseFrontMatter(splitDesign(designText).frontMatter))].filter(({ scalar }) => scalar.token).length;
  console.log(`DESIGN.md matches styles.css: ${tokenCount} front-matter values checked against live tokens; ${seededFaults(designText).length} seeded faults rejected.`);
}
