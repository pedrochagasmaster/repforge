(function (root) {
  const TYPES = ["timer", "session", "unfinished", "missed"];

  function adapter() {
    try { return (typeof globalThis !== "undefined" && globalThis.__repforgeNotifyAdapter) || null; }
    catch { return null; }
  }

  function canUse() {
    const a = adapter();
    if (a && typeof a.canUse === "function") return !!a.canUse();
    return typeof Notification !== "undefined";
  }

  function permission() {
    const a = adapter();
    if (a && typeof a.permission === "function") {
      const p = a.permission();
      return p || "unsupported";
    }
    if (!canUse()) return "unsupported";
    return Notification.permission;
  }

  async function request() {
    const a = adapter();
    if (a && typeof a.request === "function") {
      try { return await a.request(); }
      catch { return permission(); }
    }
    if (!canUse()) return "unsupported";
    try { return await Notification.requestPermission(); }
    catch { return permission(); }
  }

  function enabledFor(settings, type) {
    const n = settings && settings.notify;
    if (!n || !n.enabled) return false;
    if (!TYPES.includes(type)) return false;
    return n[type] !== false;
  }

  // IMPORTANT: never await navigator.serviceWorker.ready here — it NEVER
  // settles when registration failed (app.js registers with .catch(()=>{})),
  // which would hang fireOS forever and make the fallback dead code.
  // getRegistration() resolves undefined when there is no registration.
  async function swRegistration() {
    try {
      if (!("serviceWorker" in navigator)) return null;
      return (await navigator.serviceWorker.getRegistration()) || null;
    } catch { return null; }
  }

  async function fireOS({ title, body, tag, url }) {
    if (!canUse() || Notification.permission !== "granted") return false;
    const opts = {
      body: body || "",
      tag: tag || "repforge",
      renotify: true,
      data: { url: url || "./index.html" },
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png"
    };
    const reg = await swRegistration();
    if (reg && reg.showNotification) {
      try {
        await reg.showNotification(title || "RepForge", opts);
        return true;
      } catch (e) { console.warn("showNotification failed", e); }
    }
    try {
      new Notification(title || "RepForge", opts);
      return true;
    } catch (e) {
      console.warn("Notification constructor failed", e);
      return false;
    }
  }

  async function closeTag(tag) {
    try {
      const reg = await swRegistration();
      if (!reg || !reg.getNotifications) return;
      const list = await reg.getNotifications({ tag });
      list.forEach(n => n.close());
    } catch {}
  }

  const api = { canUse, permission, request, enabledFor, fireOS, closeTag, TYPES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeNotify = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
