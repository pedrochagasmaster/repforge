/** Runs inside the catalog's Chromium page. No screenshot or token name is an oracle. */
export function measureRenderedRoles(requests) {
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
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !node.closest("[inert]");
  };
  const background = (node) => {
    const chain = [];
    for (let current = node; current; current = current.parentElement) chain.push(current);
    let result = [255, 255, 255, 1];
    for (const current of chain.reverse()) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== "none" || style.backdropFilter !== "none") return { unsupported: `image or backdrop at ${current.id ? `#${current.id}` : current.tagName.toLowerCase()}` };
      if (+style.opacity < 1) return { unsupported: `opacity at ${current.id ? `#${current.id}` : current.tagName.toLowerCase()}` };
      const bg = color(style.backgroundColor);
      if (!bg) return { unsupported: `background ${style.backgroundColor}` };
      result = composite(bg, result);
    }
    return { rgb: result };
  };
  return requests.flatMap(({ selector, kind }) => {
    const nodes = [...document.querySelectorAll(selector)].filter(visible);
    if (!nodes.length) return [{ selector, kind, status: "missing" }];
    return nodes.map((node) => {
      const style = getComputedStyle(node);
      if (kind === "disabled-control" && (node.disabled || node.getAttribute("aria-disabled") === "true")) return { selector, kind, status: "exempt" };
      const inside = background(node);
      if (inside.unsupported) return { selector, kind, status: "unsupported", reason: inside.unsupported };
      let foreground = null;
      let adjacent = inside.rgb;
      let threshold = 3;
      if (kind === "text" || kind === "disabled-reason") {
        foreground = color(style.color);
        const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700;
        threshold = kind === "disabled-reason" ? 4.5 : large ? 3 : 4.5;
      } else if (kind === "icon") {
        foreground = color(style.backgroundColor);
        if (!foreground || foreground[3] === 0) foreground = color(style.color);
        const outside = background(node.parentElement || document.documentElement);
        if (outside.unsupported) return { selector, kind, status: "unsupported", reason: outside.unsupported };
        adjacent = outside.rgb;
      } else if (kind === "boundary") {
        if (parseFloat(style.borderTopWidth) <= 0) return { selector, kind, status: "unsupported", reason: "no rendered required border" };
        foreground = color(style.borderTopColor);
      } else if (kind === "focus") {
        if (parseFloat(style.outlineWidth) <= 0 || style.outlineStyle === "none") return { selector, kind, status: "unsupported", reason: "no rendered focus outline" };
        if (parseFloat(style.outlineWidth) < 2) return { selector, kind, status: "fail", reason: "focus outline thinner than the 2px reference area" };
        foreground = color(style.outlineColor);
      } else return { selector, kind, status: "unsupported", reason: `unknown contrast kind ${kind}` };
      if (!foreground) return { selector, kind, status: "unsupported", reason: "unresolved foreground" };
      const ink = composite(foreground, adjacent);
      let measured = ratio(ink, adjacent);
      if (kind === "boundary" || kind === "focus") {
        const outside = background(node.parentElement || document.documentElement);
        if (outside.unsupported) return { selector, kind, status: "unsupported", reason: outside.unsupported };
        measured = Math.min(measured, ratio(composite(foreground, outside.rgb), outside.rgb));
      }
      return { selector, kind, status: measured >= threshold ? "pass" : "fail", ratio: Math.round(measured * 100) / 100, threshold,
        foreground: style.color, background: inside.rgb.slice(0, 3), size: style.fontSize, weight: style.fontWeight };
    });
  });
}
