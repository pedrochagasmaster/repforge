(function (root) {
  const STRINGS = { en: EN, pt: PT };
  const missingRequests = new Set();
  let lang = "en";

  function detectLang() {
    try {
      const l = (navigator.language || navigator.userLanguage || "").toLowerCase();
      return l.startsWith("pt") ? "pt" : "en";
    } catch { return "en"; }
  }

  function normalizeLang(v) {
    return v === "pt" || v === "en" ? v : null;
  }

  function setLang(next) {
    const n = normalizeLang(next) || "en";
    lang = n;
    try { document.documentElement.lang = n === "pt" ? "pt-BR" : "en"; } catch {}
    return lang;
  }

  function getLang() { return lang; }

  function t(key, vars) {
    const dict = STRINGS[lang] || STRINGS.en;
    let s = dict[key];
    if (s == null) s = STRINGS.en[key];
    if (s == null) {
      if (typeof key === "string") missingRequests.add(key);
      s = key;
    }
    if (vars && typeof vars === "object") {
      s = String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : "{" + k + "}"));
    }
    return s;
  }

  function tp(n, word) {
    const form = +n === 1 ? "one" : "other";
    return t("plural." + word + "." + form);
  }

  function speechLang() {
    return lang === "pt" ? "pt-BR" : "en-US";
  }

  function applyDom() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const val = t(key);
      if (el.hasAttribute("data-i18n-html")) { el.innerHTML = val; return; }
      const textTarget = el.querySelector(":scope > [data-i18n-text]");
      if (textTarget) { textTarget.textContent = val; return; }
      // Prefer updating the first non-empty text node so inputs/icons survive.
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim()) {
          // Preserve leading/trailing whitespace structure lightly
          const lead = node.textContent.match(/^\s*/)?.[0] || "";
          const trail = node.textContent.match(/\s*$/)?.[0] || "";
          node.textContent = lead + val + trail;
          return;
        }
      }
      if (!el.children.length) el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("meta.description"));
  }

  const api = { STRINGS, detectLang, normalizeLang, setLang, getLang, t, tp, speechLang, applyDom };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.RepForgeI18n = api;
    root.__repforgeI18nMissingRequests = Object.freeze({
      consume() {
        const keys = [...missingRequests];
        missingRequests.clear();
        return keys;
      },
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
