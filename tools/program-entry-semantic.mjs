#!/usr/bin/env node
/**
 * Collect and compare the user-visible semantics of a program-entry capture.
 * The collector runs in the production page; the validators run in Node.
 */

export const SEMANTIC_SCHEMA_VERSION = 1;
const GENERATED_ID = "<generated-id>";
const SEMANTIC_FIELDS = [
  "tag", "role", "text", "name", "label", "labelledBy", "describedBy",
  "aria-checked", "aria-current", "aria-expanded", "aria-live", "aria-selected",
  "aria-atomic", "aria-disabled", "tabindex", "disabled", "checked", "selected",
  "value", "type",
];

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeProgramIds(value) {
  if (Array.isArray(value)) return value.map(normalizeProgramIds);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "id" && typeof child === "string" ? GENERATED_ID : normalizeProgramIds(child),
  ]));
}

/**
 * Normalize technical IDs in the visible raw-program editor value. The
 * editor's IDs identify local exercise rows; names, library provenance, and
 * every other user-visible program field remain part of the evidence.
 */
export function normalizeSemanticValue(value) {
  const text = normalizeWhitespace(value);
  try {
    return normalizeWhitespace(JSON.stringify(normalizeProgramIds(JSON.parse(text))));
  } catch {
    return text;
  }
}

export function collectProgramEntrySemantics() {
  const excluded = new Set(["toast", "restAnnounce", "announcementHost"]);
  const generatedId = "<generated-id>";
  const normalise = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const normalizeProgramIdsInPage = (value) => {
    if (Array.isArray(value)) return value.map(normalizeProgramIdsInPage);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      key === "id" && typeof child === "string" ? generatedId : normalizeProgramIdsInPage(child),
    ]));
  };
  const normalizeProgramJsonInPage = (value) => {
    const text = normalise(value);
    try {
      return normalise(JSON.stringify(normalizeProgramIdsInPage(JSON.parse(text))));
    } catch {
      return text;
    }
  };
  const isVisible = (element) => {
    if (!(element instanceof Element) || element.hidden) return false;
    if (excluded.has(element.id) || element.closest("#toast, #restAnnounce, #announcementHost, .visually-hidden, [aria-hidden=\"true\"]")) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const root = [document.querySelector("#onboarding"), document.querySelector("#program")].find(isVisible);
  if (!root) return [];
  const text = (element) => normalise(element.textContent);
  const referencedText = (element, attribute) => normalise((element.getAttribute(attribute) || "").split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent || "").join(" "));
  const labelText = (element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return "";
    return normalise([...element.labels || []].map((label) => label.textContent).join(" "));
  };
  const rows = [];
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (!isVisible(element)) continue;
    const tag = element.tagName.toLowerCase();
    const role = normalise(element.getAttribute("role"));
    const ariaLabel = normalise(element.getAttribute("aria-label"));
    const labelledBy = referencedText(element, "aria-labelledby");
    const describedBy = referencedText(element, "aria-describedby");
    const directText = normalise([...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.nodeValue).join(" "));
    const control = /^(a|button|input|select|summary|textarea)$/.test(tag) || !!role;
    const record = { tag };
    if (role) record.role = role;
    if (directText) record.text = directText;
    if (control) {
      const name = ariaLabel || labelledBy || labelText(element) || text(element);
      if (name) record.name = name;
    }
    if (ariaLabel) record.label = ariaLabel;
    if (labelledBy) record.labelledBy = labelledBy;
    if (describedBy) record.describedBy = describedBy;
    for (const attribute of ["aria-checked", "aria-current", "aria-expanded", "aria-live", "aria-selected"]) {
      if (element.hasAttribute(attribute)) record[attribute] = normalise(element.getAttribute(attribute));
    }
    if (element.hasAttribute("aria-atomic")) record["aria-atomic"] = normalise(element.getAttribute("aria-atomic"));
    if (element.hasAttribute("aria-disabled")) record["aria-disabled"] = normalise(element.getAttribute("aria-disabled"));
    if (element.hasAttribute("tabindex")) record.tabindex = normalise(element.getAttribute("tabindex"));
    if ("disabled" in element && element.disabled) record.disabled = true;
    if ("checked" in element && element.checked) record.checked = true;
    if ("selected" in element && element.selected) record.selected = true;
    if (/^(input|option|select|textarea)$/.test(tag) && "value" in element && normalise(element.value)) {
      record.value = element.id === "programJson" ? normalizeProgramJsonInPage(element.value) : normalise(element.value);
    }
    if (element.hasAttribute("type")) record.type = normalise(element.getAttribute("type"));
    if (Object.keys(record).length > 1) rows.push(record);
  }
  return rows;
}

export function semanticCaptureKey(capture) {
  return ["state", "locale", "theme", "viewport", "text", "motion"].map((key) => capture[key] || "").join("|");
}

export function buildSemanticArtifact(captures) {
  return { schemaVersion: SEMANTIC_SCHEMA_VERSION, captures: captures.map((capture) => ({
    ...capture.capture,
    semantic: capture.semantic,
  })) };
}

export function validateSemanticArtifact(artifact, expectedCaptures) {
  if (!artifact || artifact.schemaVersion !== SEMANTIC_SCHEMA_VERSION || !Array.isArray(artifact.captures)) {
    return { ok: false, reasons: ["semantic evidence has an invalid schema"] };
  }
  const expected = new Set(expectedCaptures.map(semanticCaptureKey));
  const seen = new Set();
  const reasons = [];
  for (const capture of artifact.captures) {
    const key = semanticCaptureKey(capture);
    if (seen.has(key)) reasons.push(`duplicate semantic capture ${key}`);
    seen.add(key);
    if (!Array.isArray(capture.semantic) || !capture.semantic.length) reasons.push(`semantic capture ${key} has no entries`);
  }
  for (const key of expected) if (!seen.has(key)) reasons.push(`missing semantic capture ${key}`);
  for (const key of seen) if (!expected.has(key)) reasons.push(`unexpected semantic capture ${key}`);
  return { ok: reasons.length === 0, reasons };
}

export function compareSemanticArtifacts(first, second) {
  const firstJson = JSON.stringify(first);
  const secondJson = JSON.stringify(second);
  if (firstJson === secondJson) return { ok: true, reasons: [] };
  const firstCaptures = new Map((first?.captures || []).map((capture) => [semanticCaptureKey(capture), capture]));
  const secondCaptures = new Map((second?.captures || []).map((capture) => [semanticCaptureKey(capture), capture]));
  const reasons = [];
  for (const key of new Set([...firstCaptures.keys(), ...secondCaptures.keys()])) {
    if (!firstCaptures.has(key)) reasons.push(`semantic capture added: ${key}`);
    else if (!secondCaptures.has(key)) reasons.push(`semantic capture removed: ${key}`);
    else if (JSON.stringify(firstCaptures.get(key)) !== JSON.stringify(secondCaptures.get(key))) {
      const firstSemantic = firstCaptures.get(key)?.semantic || [];
      const secondSemantic = secondCaptures.get(key)?.semantic || [];
      const details = [];
      if (firstSemantic.length !== secondSemantic.length) {
        details.push(`semantic entry count expected ${firstSemantic.length} actual ${secondSemantic.length}`);
      }
      for (let index = 0; index < Math.max(firstSemantic.length, secondSemantic.length) && details.length < 3; index++) {
        const firstRecord = firstSemantic[index] || {};
        const secondRecord = secondSemantic[index] || {};
        for (const field of SEMANTIC_FIELDS) {
          if (Object.is(firstRecord[field], secondRecord[field])) continue;
          const format = (value) => {
            if (value === undefined) return "<missing>";
            const raw = typeof value === "string" ? value : JSON.stringify(value);
            const clipped = raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
            return JSON.stringify(clipped);
          };
          details.push(`semantic[${index}].${field} expected ${format(firstRecord[field])} actual ${format(secondRecord[field])}`);
          if (details.length >= 3) break;
        }
      }
      reasons.push(`semantic text/state changed: ${key}${details.length ? `; ${details.join("; ")}` : ""}`);
    }
  }
  return { ok: false, reasons: reasons.length ? reasons : ["semantic evidence changed"] };
}

export function compareSemanticBuffers(firstBuffer, secondBuffer) {
  try {
    const first = JSON.parse(firstBuffer.toString("utf8"));
    const second = JSON.parse(secondBuffer.toString("utf8"));
    return compareSemanticArtifacts(first, second);
  } catch (error) {
    return { ok: false, reasons: [`invalid semantic evidence: ${error.message}`] };
  }
}
