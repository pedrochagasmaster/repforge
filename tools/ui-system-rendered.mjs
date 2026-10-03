/** These functions are serialized into Chromium, so each measurement owns its helpers. */
export async function measureRenderedRoles(input) {
  const color = (raw) => {
    const match = raw.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/);
    return match ? [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]] : null;
  };
  const composite = (front, back) => front.map((channel, index) => index < 3 ? Math.round(channel * front[3] + back[index] * (1 - front[3])) : 1);
  const linear = (v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const ratio = (a, b) => {
    const luminance = (rgb) => 0.2126 * linear(rgb[0] / 255) + 0.7152 * linear(rgb[1] / 255) + 0.0722 * linear(rgb[2] / 255);
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const tokenProbe = document.createElement("span");
  tokenProbe.style.color = "var(--boundary-decorative)";
  document.documentElement.append(tokenProbe);
  const decorativeBoundary = color(getComputedStyle(tokenProbe).color);
  tokenProbe.remove();
  const isDecorativeBoundary = (raw) => {
    const edge = color(raw);
    return !!edge && !!decorativeBoundary && edge.every((channel, index) => Math.abs(channel - decorativeBoundary[index]) < 1);
  };
  let pixels = null;
  if (!Array.isArray(input) && input.pixels) {
    const image = new Image();
    image.src = `data:image/png;base64,${input.pixels}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    pixels = { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
  }
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    for (let current = node; current; current = current.parentElement) {
      if (Number.parseFloat(getComputedStyle(current).opacity) === 0) return false;
    }
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
      && !node.closest("[inert],.visually-hidden");
  };
  const background = (node) => {
    const chain = [];
    for (let current = node; current; current = current.parentElement) chain.push(current);
    let result = [255, 255, 255, 1];
    for (const current of chain.reverse()) {
      const style = getComputedStyle(current);
      const selectIndicatorOnly = current.matches("select");
      if (style.backgroundImage !== "none" && !selectIndicatorOnly || style.backdropFilter !== "none") {
        return { unsupported: `image or backdrop at ${current.id ? `#${current.id}` : current.tagName.toLowerCase()}` };
      }
      if (+style.opacity < 1) return { unsupported: `opacity at ${current.id ? `#${current.id}` : current.tagName.toLowerCase()}` };
      const bg = color(style.backgroundColor);
      if (!bg) return { unsupported: `background ${style.backgroundColor}` };
      result = composite(bg, result);
    }
    return { rgb: result };
  };
  const sample = (rect, exclusions = []) => {
    if (!pixels || !rect || rect.width < 4 || rect.height < 4) return null;
    const left = Math.max(0, Math.ceil(rect.left + 2));
    const top = Math.max(0, Math.ceil(rect.top + 2));
    const right = Math.min(pixels.width - 1, Math.floor(rect.right - 2));
    const bottom = Math.min(pixels.height - 1, Math.floor(rect.bottom - 2));
    const step = Math.max(2, Math.floor(Math.max(right - left, bottom - top) / 24));
    const channels = [[], [], []];
    for (let y = top; y <= bottom; y += step) for (let x = left; x <= right; x += step) {
      if (exclusions.some((box) => x >= box.left - 1 && x <= box.right + 1 && y >= box.top - 1 && y <= box.bottom + 1)) continue;
      const offset = (y * pixels.width + x) * 4;
      if (pixels.data[offset + 3] < 240) continue;
      for (let channel = 0; channel < 3; channel++) channels[channel].push(pixels.data[offset + channel]);
    }
    if (channels.some((values) => values.length < 4)) return null;
    return channels.map((values) => {
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    });
  };
  const localSurface = (node) => {
    const own = getComputedStyle(node);
    const ownBackground = color(own.backgroundColor);
    if (ownBackground?.[3] > 0) {
      const rect = node.getBoundingClientRect();
      const children = [...node.children].map((child) => child.getBoundingClientRect());
      const result = sample(rect, children);
      if (result) return { rgb: [...result, 1] };
    }
    for (let current = node.parentElement; current && current !== document.documentElement; current = current.parentElement) {
      const rect = current.getBoundingClientRect();
      const exclusions = [...current.children].map((child) => child.getBoundingClientRect());
      const result = sample(rect, exclusions);
      if (result) return { rgb: [...result, 1] };
    }
    return null;
  };
  const elementSurface = (node) => {
    const rect = node.getBoundingClientRect();
    const children = [...node.children].map((child) => child.getBoundingClientRect());
    const result = sample(rect, children);
    return result ? { rgb: [...result, 1] } : null;
  };
  /* A control in a fixed layer that paints nothing of its own (the landing's sticky
     dock) floats over whatever scrolls beneath it, and that band is not in its DOM
     ancestry: walking the ancestors' backgrounds would measure against the document
     behind the layer instead of the colour the lifter sees around the control. */
  const floatsOverUnrelatedGround = (node) => {
    for (let current = node; current && current !== document.documentElement; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current !== node && (color(style.backgroundColor)?.[3] ?? 0) > 0) return false;
      if (style.position === "fixed") return true;
    }
    return false;
  };
  /* The rendered ground in a thin band just outside an outline: the median of points
     on the rectangle 3px beyond the outline's outer edge. */
  const outlineGround = (node, style) => {
    if (!pixels) return null;
    const rect = node.getBoundingClientRect();
    const reach = Math.max(0, parseFloat(style.outlineOffset) || 0) + (parseFloat(style.outlineWidth) || 0) + 3;
    const left = rect.left - reach, right = rect.right + reach, top = rect.top - reach, bottom = rect.bottom + reach;
    const points = [];
    for (let x = left; x <= right; x += 4) points.push([x, top], [x, bottom]);
    for (let y = top; y <= bottom; y += 4) points.push([left, y], [right, y]);
    // The screenshot is in device pixels; the rectangle is in CSS pixels.
    const scale = pixels.width / (window.innerWidth || pixels.width);
    const channels = [[], [], []];
    for (const [px, py] of points) {
      const x = Math.round(px * scale), y = Math.round(py * scale);
      if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
      const offset = (y * pixels.width + x) * 4;
      if (pixels.data[offset + 3] < 240) continue;
      for (let channel = 0; channel < 3; channel++) channels[channel].push(pixels.data[offset + channel]);
    }
    if (channels.some((values) => values.length < 8)) return null;
    return { rgb: [...channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]), 1] };
  };
  const adjacentSurface = (node) => {
    for (let current = node.parentElement; current && current !== document.documentElement; current = current.parentElement) {
      const rect = current.getBoundingClientRect();
      const exclusions = [...current.children].map((child) => child.getBoundingClientRect());
      const result = sample(rect, exclusions);
      if (result) return { rgb: [...result, 1] };
    }
    return null;
  };
  const label = (node) => {
    if (node.id) return `#${node.id}`;
    const classes = [...(node.classList || [])].slice(0, 2).join(".");
    return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
  };
  const measure = (node, selector, kind) => {
    if (!visible(node)) return { selector, kind, status: "missing" };
    if (kind === "disabled-control" && node.matches(":disabled,[aria-disabled='true']")) return { selector, kind, status: "exempt" };
    const style = getComputedStyle(node);
    let inside = background(node);
    if (inside.unsupported && pixels) {
      const offset = parseFloat(style.outlineOffset) || 0;
      inside = (kind === "boundary" && node.namespaceURI === "http://www.w3.org/2000/svg"
        ? adjacentSurface(node) || elementSurface(node)
        : kind === "boundary" || kind === "focus" && offset < 0 ? elementSurface(node) : localSurface(node)) || inside;
    }
    if (inside.unsupported) return { selector, kind, status: "unsupported", reason: inside.unsupported };
    let foreground = null;
    let adjacent = inside.rgb;
    let threshold = 3;
    if (kind === "text" || kind === "disabled-reason") {
      foreground = color(style.color);
      const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700;
      threshold = kind === "disabled-reason" ? 4.5 : large ? 3 : 4.5;
    } else if (kind === "icon") {
      if (node.namespaceURI === "http://www.w3.org/2000/svg") {
        foreground = color(style.fill);
        if (!foreground || foreground[3] === 0) foreground = color(style.stroke);
      }
      if (!foreground || foreground[3] === 0) foreground = color(style.backgroundColor);
      if (!foreground || foreground[3] === 0) foreground = color(style.color);
      let outside = background(node.parentElement || document.documentElement);
      if (outside.unsupported && pixels) outside = adjacentSurface(node) || outside;
      if (outside.unsupported) return { selector, kind, status: "unsupported", reason: outside.unsupported };
      adjacent = outside.rgb;
    } else if (kind === "boundary") {
      const svgStroke = node.namespaceURI === "http://www.w3.org/2000/svg" && style.stroke !== "none"
        && parseFloat(style.strokeWidth) > 0 ? color(style.stroke) : null;
      if (svgStroke && svgStroke[3] > 0) {
        let surface = inside;
        if (surface.unsupported && pixels) surface = adjacentSurface(node) || surface;
        if (surface.unsupported) return { selector, kind, status: "unsupported", reason: surface.unsupported };
        const elementOpacity = Number.parseFloat(style.opacity);
        const strokeOpacity = Number.parseFloat(style.strokeOpacity);
        const alpha = svgStroke[3] * (Number.isFinite(elementOpacity) ? elementOpacity : 1)
          * (Number.isFinite(strokeOpacity) ? strokeOpacity : 1);
        const edge = composite([...svgStroke.slice(0, 3), alpha], surface.rgb);
        const measured = ratio(edge, surface.rgb);
        return { selector, kind, status: measured >= 3 ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
          threshold: 3, foreground: style.stroke, background: surface.rgb.slice(0, 3) };
      }
      const sides = ["Top", "Right", "Bottom", "Left"].filter((side) =>
        parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none"
        && (color(style[`border${side}Color`])?.[3] || 0) > 0
        && !isDecorativeBoundary(style[`border${side}Color`]));
      let outside = background(node.parentElement || document.documentElement);
      if (outside.unsupported && pixels) outside = adjacentSurface(node) || outside;
      if (outside.unsupported) return { selector, kind, status: "unsupported", reason: outside.unsupported };
      if (sides.length) {
        const values = sides.map((side) => {
          const edge = color(style[`border${side}Color`]);
          return edge ? Math.min(ratio(composite(edge, inside.rgb), inside.rgb), ratio(composite(edge, outside.rgb), outside.rgb)) : 0;
        });
        const measured = Math.min(...values);
        return { selector, kind, status: measured >= 3 ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
          threshold: 3, foreground: sides.map((side) => `${side.toLowerCase()}:${style[`border${side}Color`]}`).join(", "),
          background: inside.rgb.slice(0, 3) };
      }
      const fill = color(style.backgroundColor);
      if (!fill || fill[3] === 0) {
        if (pixels) {
          const local = elementSurface(node);
          const outside = adjacentSurface(node);
          if (local && outside) {
            const measured = ratio(local.rgb, outside.rgb);
            return { selector, kind, status: measured >= 3 ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
              threshold: 3, foreground: `rgb(${local.rgb.slice(0, 3).join(", ")})`, background: outside.rgb.slice(0, 3) };
          }
        }
        return { selector, kind, status: "unsupported", reason: "no rendered required border or fill" };
      }
      const measured = ratio(composite(fill, outside.rgb), outside.rgb);
      return { selector, kind, status: measured >= 3 ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
        threshold: 3, foreground: style.backgroundColor, background: outside.rgb.slice(0, 3) };
    } else if (kind === "focus") {
      if (parseFloat(style.outlineWidth) <= 0 || style.outlineStyle === "none") return { selector, kind, status: "unsupported", reason: "no rendered focus outline" };
      if (parseFloat(style.outlineWidth) < 2) return { selector, kind, status: "fail", reason: "focus outline thinner than the 2px reference area" };
      foreground = color(style.outlineColor);
    } else return { selector, kind, status: "unsupported", reason: `unknown contrast kind ${kind}` };
    if (!foreground) return { selector, kind, status: "unsupported", reason: "unresolved foreground" };
    const ink = composite(foreground, adjacent);
    let measured = ratio(ink, adjacent);
    let measuredBackground = inside.rgb;
    if (kind === "focus") {
      let outside = background(node.parentElement || document.documentElement);
      if ((parseFloat(style.outlineOffset) || 0) >= 0 && floatsOverUnrelatedGround(node)) outside = outlineGround(node, style) || outside;
      if (outside.unsupported && pixels) {
        const offset = parseFloat(style.outlineOffset) || 0;
        outside = (offset < 0 ? elementSurface(node) : adjacentSurface(node)) || outside;
      }
      if (outside.unsupported) return { selector, kind, status: "unsupported", reason: outside.unsupported };
      // The frozen focus recipe uses a 2px outline with an outside offset, so
      // the page surface is the adjacent rendered colour around that outline.
      measured = ratio(composite(foreground, outside.rgb), outside.rgb);
      measuredBackground = outside.rgb;
    }
    return { selector, kind, status: measured >= threshold ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
      threshold, foreground: style.color, background: measuredBackground.slice(0, 3), size: style.fontSize, weight: style.fontWeight };
  };
  const measurePseudoMark = (node, selector, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    const foreground = color(style.backgroundColor);
    if (style.content === "none" || style.display === "none" || !foreground || foreground[3] === 0) {
      return { selector, kind: "state-mark", status: "unsupported", reason: "selected state mark has no rendered fill" };
    }
    let surface = background(node);
    if (surface.unsupported && pixels) surface = localSurface(node) || surface;
    if (surface.unsupported) return { selector, kind: "state-mark", status: "unsupported", reason: surface.unsupported };
    const opacity = Number.parseFloat(style.opacity);
    const ink = composite([...foreground.slice(0, 3), foreground[3] * (Number.isFinite(opacity) ? opacity : 1)], surface.rgb);
    const measured = ratio(ink, surface.rgb);
    return { selector, kind: "state-mark", status: measured >= 3 ? "pass" : "fail", ratio: Math.round(measured * 100) / 100,
      threshold: 3, foreground: style.backgroundColor, background: surface.rgb.slice(0, 3) };
  };
  const measurePseudoBoundary = (node, selector, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    if (style.content === "none" || style.display === "none") {
      return { selector, kind: "boundary", status: "unsupported", reason: "required boundary mark is not rendered" };
    }
    let surface = background(node);
    if (surface.unsupported && pixels) surface = localSurface(node) || surface;
    if (surface.unsupported) return { selector, kind: "boundary", status: "unsupported", reason: surface.unsupported };
    const opacity = Number.parseFloat(style.opacity);
    const alpha = Number.isFinite(opacity) ? opacity : 1;
    const fill = color(style.backgroundColor);
    const inside = fill && fill[3] > 0
      ? composite([...fill.slice(0, 3), fill[3] * alpha], surface.rgb)
      : surface.rgb;
    const sides = ["Top", "Right", "Bottom", "Left"].filter((side) =>
      parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none"
      && (color(style[`border${side}Color`])?.[3] || 0) > 0
      && !isDecorativeBoundary(style[`border${side}Color`]));
    if (sides.length) {
      const measured = Math.min(...sides.flatMap((side) => {
        const border = color(style[`border${side}Color`]);
        const edge = border ? composite([...border.slice(0, 3), border[3] * alpha], surface.rgb) : surface.rgb;
        return [ratio(edge, surface.rgb)];
      }));
      return { selector, kind: "boundary", status: measured >= 3 ? "pass" : "fail",
        ratio: Math.round(measured * 100) / 100, threshold: 3,
        foreground: sides.map((side) => `${side.toLowerCase()}:${style[`border${side}Color`]}`).join(", "),
        background: surface.rgb.slice(0, 3) };
    }
    if (fill && fill[3] > 0) {
      const measured = ratio(inside, surface.rgb);
      return { selector, kind: "boundary", status: measured >= 3 ? "pass" : "fail",
        ratio: Math.round(measured * 100) / 100, threshold: 3,
        foreground: style.backgroundColor, background: surface.rgb.slice(0, 3) };
    }
    return { selector, kind: "boundary", status: "unsupported", reason: "required pseudo boundary has no rendered edge or fill" };
  };

  const requests = Array.isArray(input) ? input : input.requests;
  if (Array.isArray(requests)) {
    return requests.flatMap(({ selector, kind }) => {
      let nodes;
      try { nodes = [...document.querySelectorAll(selector)].filter(visible); }
      catch { return [{ selector, kind, status: "unsupported", reason: "invalid selector" }]; }
      if (!nodes.length) return [{ selector, kind, status: "missing" }];
      return nodes.map((node) => measure(node, selector, kind));
    });
  }

  const { components } = input;
  const results = [];
  const disabledDescriptions = new Set();
  const measuredSelectionGroups = new Set();
  for (const control of document.querySelectorAll(":disabled,[aria-disabled='true']")) {
    for (const id of (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)) disabledDescriptions.add(id);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const node = text.parentElement;
    if (!text.nodeValue.trim() || !node || !visible(node) || node.closest(":disabled,[aria-disabled='true']")) continue;
    const kind = node.id && disabledDescriptions.has(node.id) ? "disabled-reason" : "text";
    results.push(measure(node, `${kind}:${label(node)}`, kind));
  }
  for (const item of components) {
    let nodes;
    try { nodes = [...document.querySelectorAll(item.selector)].filter(visible); }
    catch { results.push({ selector: item.selector, kind: "inventory", status: "unsupported", reason: "invalid selector" }); continue; }
    for (const node of nodes) {
      const disabled = node.matches(":disabled,[aria-disabled='true']");
      const selected = node.matches("[aria-selected='true'],[aria-checked='true'],[aria-pressed='true'],[aria-current]:not([aria-current='false']),.is-selected,.is-active,.active");
      const invalid = node.matches("[aria-invalid='true']");
      if (!disabled && item.roles?.boundary === "required") {
        const style = getComputedStyle(node);
        const hasEdge = ["Top", "Right", "Bottom", "Left"].some((side) =>
          parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none"
          && (color(style[`border${side}Color`])?.[3] || 0) > 0);
        const hasFill = (color(style.backgroundColor)?.[3] || 0) > 0;
        const pseudoBoundary = !hasEdge && !hasFill ? ["::before", "::after"].find((candidate) => {
          const pseudoStyle = getComputedStyle(node, candidate);
          const pseudoOpacity = Number.parseFloat(pseudoStyle.opacity);
          if (pseudoStyle.content === "none" || pseudoStyle.content === "normal" || pseudoStyle.display === "none"
            || (Number.isFinite(pseudoOpacity) && pseudoOpacity <= 0)) return false;
          const pseudoFill = color(pseudoStyle.backgroundColor);
          const pseudoHasFill = (pseudoFill?.[3] || 0) > 0;
          const pseudoHasEdge = ["Top", "Right", "Bottom", "Left"].some((side) =>
            parseFloat(pseudoStyle[`border${side}Width`]) > 0 && pseudoStyle[`border${side}Style`] !== "none"
            && (color(pseudoStyle[`border${side}Color`])?.[3] || 0) > 0
            && !isDecorativeBoundary(pseudoStyle[`border${side}Color`]));
          return pseudoHasEdge || pseudoHasFill;
        }) : null;
        const groupedSelection = item.roles?.control === "selection" && node.matches(".radio-card")
          ? node.closest(".onb__opts.onb__list,.onb__opts.onb__seg") : null;
        if (groupedSelection) {
          if (!measuredSelectionGroups.has(groupedSelection)) {
            results.push(measure(groupedSelection, `${item.selector}:${label(groupedSelection)}`, "boundary"));
            measuredSelectionGroups.add(groupedSelection);
          }
          const mark = [...node.querySelectorAll(".radio-card__mark")].find(visible);
          if (mark) results.push(measure(mark, `${item.selector}:${label(mark)}`, "boundary"));
          if (groupedSelection.matches(".onb__opts.onb__seg") && (hasEdge || hasFill)) {
            results.push(measure(node, `${item.selector}:${label(node)}`, "boundary"));
          }
        } else {
          const requiredNow = item.roles?.progress || item.roles?.control === "field"
            || selected || invalid || hasEdge || hasFill || Boolean(pseudoBoundary);
          if (requiredNow && (hasEdge || hasFill || !item.roles?.progress)) {
            if (item.roles?.boundary === "required" && !hasEdge && !hasFill) {
              results.push(pseudoBoundary
                ? measurePseudoBoundary(node, `${item.selector}:${label(node)}${pseudoBoundary}`, pseudoBoundary)
                : measure(node, `${item.selector}:${label(node)}`, "boundary"));
            } else results.push(measure(node, `${item.selector}:${label(node)}`, "boundary"));
          } else if (requiredNow && item.roles?.progress) {
          const marks = [...node.querySelectorAll("*")].filter((child) => {
            if (!visible(child)) return false;
            const childStyle = getComputedStyle(child);
            return (color(childStyle.backgroundColor)?.[3] || 0) > 0 || ["Top", "Right", "Bottom", "Left"].some((side) =>
              parseFloat(childStyle[`border${side}Width`]) > 0 && (color(childStyle[`border${side}Color`])?.[3] || 0) > 0);
          });
          if (marks.length) for (const mark of marks) results.push(measure(mark, `${item.selector}:${label(mark)}`, "boundary"));
          else results.push({ selector: `${item.selector}:${label(node)}`, kind: "boundary", status: "unsupported", reason: "required progress marks are missing" });
          } else if (requiredNow) {
            results.push(measure(node, `${item.selector}:${label(node)}`, "boundary"));
          }
          if (item.roles?.control === "selection" && node.matches(".radio-card")) {
            const mark = [...node.querySelectorAll(".radio-card__mark")].find(visible);
            if (mark) results.push(measure(mark, `${item.selector}:${label(mark)}`, "boundary"));
          }
        }
      }
      if (!disabled && (selected || invalid) && !node.matches(".toggle")) {
        const marker = ["::before", "::after"].find((pseudo) => {
          const style = getComputedStyle(node, pseudo), fill = color(style.backgroundColor);
          return style.content !== "none" && style.display !== "none" && (fill?.[3] || 0) > 0;
        });
        if (marker) results.push(measurePseudoMark(node, `${item.selector}:${label(node)}${marker}`, marker));
        else if (item.roles?.boundary !== "required") results.push(measure(node, `${item.selector}:${label(node)}`, "boundary"));
      }
      // One primary label size: the contract's `control` role (R7 V-17, owner decision #295 comment 5965828337), whichever
      // surface draws it. The featured entry card is a card, not a label, and has its own recipe.
      if (!disabled && item.roles?.control === "primary" && item.variant !== "featured-entry-action") {
        const labelSize = Number.parseFloat(getComputedStyle(node).fontSize);
        const sizeProbe = document.createElement("span");
        sizeProbe.style.cssText = "position:absolute;visibility:hidden;font-size:var(--font-size-control)";
        document.body.append(sizeProbe);
        const controlSize = Number.parseFloat(getComputedStyle(sizeProbe).fontSize);
        sizeProbe.remove();
        results.push({ selector: `${item.selector}:${label(node)}`, kind: "primary-label-size", status: labelSize === controlSize ? "pass" : "fail",
          reason: labelSize === controlSize ? undefined : `${labelSize}px, the control role is ${controlSize}px` });
        // The trailing arrow is a mark on the button's own ground and holds the 3:1 mark contrast (R7 V-01).
        const arrow = getComputedStyle(node, "::after");
        if (arrow.content !== "none" && arrow.content !== "normal" && arrow.display !== "none" && (color(arrow.backgroundColor)?.[3] || 0) > 0) {
          results.push(measurePseudoMark(node, `${item.selector}:${label(node)}::after`, "::after"));
        }
      }
      if (!disabled && item.roles?.control === "selection" && node.matches(".toggle")) {
        const track = getComputedStyle(node, "::before"), knob = getComputedStyle(node, "::after");
        const trackColor = color(track.backgroundColor), knobColor = color(knob.backgroundColor);
        let surface = background(node.parentElement || document.documentElement);
        if (surface.unsupported && pixels) surface = adjacentSurface(node) || surface;
        if (track.content === "none" || !trackColor || !knobColor || surface.unsupported) {
          results.push({ selector: `${item.selector}:${label(node)}`, kind: "state-mark", status: "unsupported", reason: "switch track or knob surface is unresolved" });
        } else {
          const trackAlpha = trackColor[3] * (parseFloat(track.opacity) || 1);
          const renderedTrack = composite([...trackColor.slice(0, 3), trackAlpha], surface.rgb);
          const trackRatio = ratio(renderedTrack, surface.rgb);
          const knobAlpha = knobColor[3] * (parseFloat(knob.opacity) || 1);
          const renderedKnob = composite([...knobColor.slice(0, 3), knobAlpha], renderedTrack);
          const knobRatio = ratio(renderedKnob, renderedTrack);
          results.push({ selector: `${item.selector}:${label(node)}::before`, kind: "boundary",
            status: trackRatio >= 3 ? "pass" : "fail", ratio: Math.round(trackRatio * 100) / 100, threshold: 3,
            foreground: track.backgroundColor, background: surface.rgb.slice(0, 3) });
          results.push({ selector: `${item.selector}:${label(node)}::after`, kind: "state-mark",
            status: knobRatio >= 3 ? "pass" : "fail", ratio: Math.round(knobRatio * 100) / 100, threshold: 3,
            foreground: knob.backgroundColor, background: renderedTrack.slice(0, 3) });
        }
      }
      if (!disabled && item.facets?.includes("icon-only") && !node.matches(".toggle")) {
        const icons = [...node.querySelectorAll("svg,[role='img'],[data-icon],.icon-mask")].filter(visible);
        if (!icons.length) {
          const glyph = node.textContent.trim();
          const timer = item.selector === "#woRest" ? [...node.querySelectorAll(".wo-rest__time")].find((child) => visible(child) && child.textContent.trim()) : null;
          if (/^[\p{S}\p{P}\p{M}\s]+$/u.test(glyph) && glyph) {
            results.push(measure(node, `${item.selector}:${label(node)}`, "icon"));
          } else if (timer) {
            results.push(measure(timer, `${item.selector}:${label(timer)}`, "text"));
          } else results.push({ selector: `${item.selector}:${label(node)}`, kind: "icon", status: "unsupported", reason: "icon-only control has no rendered icon" });
        }
        else for (const icon of icons) results.push(measure(icon, `${item.selector}:${label(icon)}`, "icon"));
      }
      if (!disabled && item.variant === "navigation-dock") {
        const icons = [...node.querySelectorAll(".nav__icon")].filter(visible);
        if (icons.length !== 1) results.push({ selector: `${item.selector}:${label(node)}`, kind: "icon", status: "unsupported", reason: "navigation item needs one rendered icon" });
        else for (const icon of icons) results.push(measure(icon, `${item.selector}:${label(icon)}`, "icon"));
      }
      if (!disabled && node.matches("select") && getComputedStyle(node).backgroundImage !== "none") {
        const style = getComputedStyle(node);
        const colors = [];
        for (const [raw] of style.backgroundImage.matchAll(/rgba?\([^)]*\)|(?:%23|#)([\da-f]{6})/gi)) {
          if (/^rgba?\(/i.test(raw)) {
            const parsed = color(raw);
            if (parsed?.[3] > 0) colors.push(parsed);
          } else {
            const hex = raw.replace(/^%23/i, "#");
            colors.push([1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(1));
          }
        }
        const field = color(style.backgroundColor);
        let surface = field?.[3] === 1 ? { rgb: field } : background(node.parentElement || document.documentElement);
        if (surface.unsupported && pixels) surface = localSurface(node) || surface;
        if (!colors.length || surface.unsupported) {
          results.push({ selector: `${item.selector}:${label(node)}`, kind: "icon", status: "unsupported", reason: "select indicator foreground or surface is unresolved" });
        } else {
          const measured = Math.min(...colors.map((foreground) => ratio(composite(foreground, surface.rgb), surface.rgb)));
          results.push({ selector: `${item.selector}:${label(node)}`, kind: "icon", status: measured >= 3 ? "pass" : "fail",
            ratio: Math.round(measured * 100) / 100, threshold: 3, foreground: style.backgroundImage, background: surface.rgb.slice(0, 3) });
        }
      }
    }
  }
  for (const node of document.querySelectorAll("[role='img'][aria-label],[aria-invalid='true']")) {
    if (!visible(node) || node.matches(":disabled,[aria-disabled='true']")) continue;
    if (node.matches("[role='img'][aria-label]")) results.push(measure(node, `meaningful-icon:${label(node)}`, "icon"));
    else results.push(measure(node, `error-boundary:${label(node)}`, "boundary"));
  }
  return results;
}

/** Convert every unresolved or failed rendered measurement into a blocking audit finding. */
export function renderedRoleProblems(key, measurements) {
  return measurements.filter((item) => !["pass", "exempt"].includes(item.status)).map((item) =>
    `${key}: rendered ${item.kind} ${item.selector} ${item.status}${item.ratio === undefined ? "" : ` ${item.ratio}:1 < ${item.threshold}:1`}${item.reason ? ` (${item.reason})` : ""}`);
}

/**
 * A heading is read whole. A line clamp that actually cuts a heading short (the text is taller than the box that
 * shows it) hides part of a name the lifter needs, so the audit fails it; a clamp that only reserves room for a
 * longer title than this one is not a defect. Serialized into Chromium, so it owns its helpers; the findings go
 * through `renderedRoleProblems` like every other rendered measurement.
 */
export function measureClampedHeadings() {
  const label = (node) => node.id ? `#${node.id}` : `${node.tagName.toLowerCase()}${node.className && typeof node.className === "string" ? `.${node.className.trim().split(/\s+/)[0]}` : ""}`;
  const results = [];
  for (const node of document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']")) {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden" || node.closest("[inert],.visually-hidden")) continue;
    const clamp = style.webkitLineClamp;
    if (!clamp || clamp === "none") continue;
    const cut = node.scrollHeight > node.clientHeight + 1;
    results.push({ selector: `${label(node)}:${(node.textContent || "").trim().slice(0, 40)}`, kind: "heading-clamp", status: cut ? "fail" : "pass",
      reason: cut ? `-webkit-line-clamp ${clamp} cuts the heading short (${node.scrollHeight}px of text in ${node.clientHeight}px)` : undefined });
  }
  return results;
}
