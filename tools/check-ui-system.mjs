#!/usr/bin/env node
/** Live Plan 058 role inventory. Existing CSS literals are debt until P6. */
import { measureRenderedRoles, renderedRoleProblems } from "./ui-system-rendered.mjs";

export function inspectRoleCoverage({ key, components, exceptions, progressCandidateSelectors, allowProgressDebt = false }) {
  const progressSelectors = [...new Set([...progressCandidateSelectors, "progress", "[role='progressbar']"])];
  const visible = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    for (let current = node; current; current = current.parentElement) {
      if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
    }
    return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden"
      && !node.matches(".visually-hidden") && !node.closest("[inert],.visually-hidden");
  };
  const interactive = "button,input:not([type='hidden']),select,textarea,a[href],summary,[role='button'],[role='tab'],[role='radio'],[role='checkbox'],[role='switch'],[role='slider']";
  const candidate = new Set([...document.querySelectorAll(interactive)].filter(visible));
  for (const item of components) for (const node of document.querySelectorAll(item.selector)) if (visible(node)) candidate.add(node);
  for (const item of exceptions) for (const node of document.querySelectorAll(item.selector)) if (visible(node)) candidate.add(node);
  const castsOutwardShadow = (shadow) => {
    if (shadow === "none") return false;
    const layers = []; let part = "", depth = 0;
    for (const char of shadow) {
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (char === "," && depth === 0) { layers.push(part); part = ""; }
      else part += char;
    }
    layers.push(part);
    return layers.some((layer) => {
      if (/\binset\b/.test(layer)) return false;
      const lengths = layer.replace(/rgba?\([^)]*\)/g, "").match(/-?\d+(?:\.\d+)?px/g) || [];
      // A zero-offset, zero-blur spread is a focus/validation ring, not a
      // raised layer. This distinction keeps real nested shadows detectable.
      return lengths.length < 3 || lengths.slice(0, 3).some((length) => parseFloat(length) !== 0);
    });
  };
  for (const selector of progressSelectors) for (const node of document.querySelectorAll(selector)) if (visible(node)) candidate.add(node);
  for (const node of document.querySelectorAll("[role='dialog'],dialog[open],.sheet-scrim")) if (visible(node)) candidate.add(node);
  for (const node of document.querySelectorAll("body *")) {
    const shadow = getComputedStyle(node).boxShadow;
    if (shadow !== "none" && visible(node)) candidate.add(node);
  }
  const problems = [], observed = [], matched = new Set(), matchedExceptions = new Set();
  const label = (node) => node.id ? `#${node.id}` : node.classList.length ? `${node.tagName.toLowerCase()}.${[...node.classList].slice(0, 2).join(".")}` : node.tagName.toLowerCase();
  for (const node of candidate) {
    const matches = components.filter((item) => node.matches(item.selector));
    const exception = exceptions.find((item) => node.matches(item.selector));
    if (exception) {
      matchedExceptions.add(exception.selector);
      if (!exception.catalogStates.includes(key)) problems.push(`${key}: ${label(node)} uses exception ${exception.selector} outside its catalog states`);
    }
    if (matches.length !== 1) {
      if (matches.length === 0 && exception) continue;
      problems.push(`${key}: ${label(node)} ${matches.length ? `ambiguous roles ${matches.map((item) => item.selector).join(" | ")}` : "has no inventory role"}`);
      continue;
    }
    const item = matches[0];
    matched.add(item.id);
    if (!item.catalogStates.includes(key)) problems.push(`${key}: ${label(node)} used outside ${item.selector}'s catalog states`);
    const actionRole = node.getAttribute("data-action-role");
    const expectedControl = { expansion: "disclosure", navigation: "quiet-navigation", removal: "destructive", replacement: "secondary" }[actionRole];
    if (expectedControl && item.roles.control !== expectedControl) {
      problems.push(`${key}: ${label(node)} ${actionRole} action is ${item.roles.control || "unassigned"}, expected ${expectedControl}`);
    }
    const actualStates = [
      ["disabled", node.matches(":disabled,[aria-disabled='true'],.is-disabled")],
      ["selected", node.matches("[aria-selected='true'],[aria-checked='true'],.is-selected,.is-active")],
      ["expanded", node.matches("[aria-expanded='true']")],
      ["validation-error", node.matches("[aria-invalid='true']")],
      ["loading", node.matches("[aria-busy='true'],.is-loading")],
    ];
    for (const [state, present] of actualStates) {
      if (present && item.roles.control && !item.states.includes(state)) problems.push(`${key}: ${label(node)} uses unowned ${state} state`);
    }
    const shadow = getComputedStyle(node).boxShadow;
    const outwardShadow = castsOutwardShadow(shadow);
    const elevation = Array.isArray(item.roles.elevation) ? item.roles.elevation : [item.roles.elevation];
    if (outwardShadow && !elevation.some((role) => ["selected", "floating", "modal", "persistent-action"].includes(role)) && !exception) {
      problems.push(`${key}: ${label(node)} casts an outward shadow without an elevation role`);
    }
    if (outwardShadow) {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const parentShadow = getComputedStyle(parent).boxShadow;
        if (!castsOutwardShadow(parentShadow)) continue;
        const trueOverlay = elevation.some((role) => role === "modal" || role === "floating") && ["fixed", "absolute"].includes(getComputedStyle(node).position);
        if (!elevation.includes("selected") && !trueOverlay && !exception) problems.push(`${key}: ${label(node)} creates nested elevation inside ${label(parent)}`);
        break;
      }
    }
    if (progressSelectors.some((selector) => node.matches(selector)) && !exception) {
      const dimension = node.getAttribute("data-progress-dimension");
      const scope = node.getAttribute("data-progress-scope");
      const allowed = Array.isArray(item.roles.progress) ? item.roles.progress : [item.roles.progress];
      if (!dimension || !scope || !allowed.includes(dimension) || item.progressScopes?.[scope] !== dimension) {
        const issue = `${key}: ${label(node)} progress needs declared dimension/scope; expected ${Object.entries(item.progressScopes || {}).map(([name, value]) => `${value}/${name}`).join("|")}, got ${dimension || "none"}/${scope || "none"}`;
        if (!allowProgressDebt) problems.push(issue);
      }
    }
    observed.push({ selector: item.selector, role: item.roles, label: label(node) });
  }
  for (const item of components) {
    if (!item.catalogStates.includes(key)) continue;
    try { document.querySelector(item.selector); } catch { problems.push(`${key}: invalid selector ${item.selector}`); }
  }
  return { key, problems, observed, matched: [...matched], matchedExceptions: [...matchedExceptions] };
}

export async function auditFocusRoles(page, { key, components, pixels }) {
  const targets = await page.evaluate((items) => {
    const visible = (node) => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      for (let current = node; current; current = current.parentElement) {
        if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
      }
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
        && !node.closest("[inert],.visually-hidden");
    };
    const uniqueSelector = (node) => {
      const parts = [];
      for (let current = node; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentElement) {
        if (current.id) {
          const idSelector = `#${CSS.escape(current.id)}`;
          if (document.querySelectorAll(idSelector).length === 1) { parts.unshift(idSelector); break; }
        }
        if (!current.parentElement) { parts.unshift(current.localName); break; }
        const siblings = [...current.parentElement?.children || []].filter((item) => item.localName === current.localName);
        parts.unshift(`${current.localName}:nth-of-type(${siblings.indexOf(current) + 1})`);
      }
      return parts.join(" > ");
    };
    const result = new Map();
    for (const item of items) {
      if (!item.roles?.control || !item.states?.includes("focus-visible")) continue;
      let nodes;
      try { nodes = [...document.querySelectorAll(item.selector)]; } catch { continue; }
      for (const node of nodes) {
        if (!visible(node) || node.matches(":disabled,[aria-disabled='true'],.is-disabled")) continue;
        const selector = uniqueSelector(node);
        result.set(selector, { selector, owner: item.selector, label: node.id ? `#${node.id}` : node.localName });
      }
    }
    return [...result.values()];
  }, components);
  const problems = [];
  const measurements = { total: 0, pass: 0, fail: 0, unsupported: 0, missing: 0, exempt: 0 };
  if (!targets.length) return { problems, measurements };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const resolvedTargets = await Promise.all(targets.map(async (target) => ({
      target,
      ...await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: target.selector }),
    })));
    const focusTargets = [];
    for (const { target, nodeId } of resolvedTargets) {
      if (!nodeId) {
        const missing = [{ selector: `${target.owner}:${target.label}`, kind: "focus", status: "missing" }];
        measurements.missing += 1;
        measurements.total += 1;
        problems.push(...renderedRoleProblems(`${key} [focus-visible]`, missing));
      } else {
        focusTargets.push({ target, nodeId });
      }
    }
    if (focusTargets.length) {
      // Forcing :focus-visible stands for a keyboard user. In the app any key press clears a quiet hand-off
      // (app.js workoutInputModality: focus moved after a tap draws no ring until a key is used), so the
      // emulation clears it too rather than measuring a state no keyboard user can reach.
      await page.evaluate(() => document.querySelectorAll("[data-quiet-focus]").forEach((el) => el.removeAttribute("data-quiet-focus")));
      await Promise.all(focusTargets.map(({ nodeId }) => session.send("CSS.forcePseudoState", {
        nodeId, forcedPseudoClasses: ["focus-visible"],
      })));
      let rendered;
      try {
        rendered = await page.evaluate(measureRenderedRoles, {
          requests: focusTargets.map(({ target }) => ({ selector: target.selector, kind: "focus" })), pixels,
        });
      } finally {
        await Promise.allSettled(focusTargets.map(({ nodeId }) => session.send("CSS.forcePseudoState", {
          nodeId, forcedPseudoClasses: [],
        })));
      }
      for (const item of rendered) measurements[item.status] = (measurements[item.status] || 0) + 1;
      measurements.total += rendered.length;
      problems.push(...renderedRoleProblems(`${key} [focus-visible]`, rendered));
    }
  } finally {
    await session.detach();
  }
  return { problems, measurements };
}
