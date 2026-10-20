/** Device notification capability. Construction performs no permission request or storage IO. */
/** @typedef {{canUse?:()=>boolean,permission?:()=>string,request?:()=>Promise<string>}} NotificationAdapter */
/** @param {{Notification?:typeof globalThis.Notification|null,navigator?:{serviceWorker?:Pick<ServiceWorkerContainer,'getRegistration'>},adapter?:NotificationAdapter|null,console?:Pick<Console,'warn'>}} options */
export function createNotifications({ Notification = null, navigator = {}, adapter = null, console = { warn() {} } } = {}) {
  const TYPES = ["timer", "session", "unfinished", "missed"];

  function canUse() {
    const a = adapter;
    if (a && typeof a.canUse === "function") return !!a.canUse();
    return typeof Notification === "function";
  }

  function permission() {
    const a = adapter;
    if (a && typeof a.permission === "function") {
      const p = a.permission();
      return p || "unsupported";
    }
    if (!canUse()) return "unsupported";
    return /** @type {typeof globalThis.Notification} */(Notification).permission;
  }

  async function request() {
    const a = adapter;
    if (a && typeof a.request === "function") {
      try { return await a.request(); }
      catch { return permission(); }
    }
    if (!canUse()) return "unsupported";
    try { return await /** @type {typeof globalThis.Notification} */(Notification).requestPermission(); }
    catch { return permission(); }
  }

  /** @param {{notify?:{enabled?:unknown,[key:string]:unknown}}|null|undefined} settings @param {string} type */
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
      return (await navigator.serviceWorker?.getRegistration()) || null;
    } catch { return null; }
  }

  /** @param {{title?:string,body?:string,tag?:string,url?:string}} notification */
  async function fireOS({ title, body, tag, url }) {
    if (!canUse() || permission() !== "granted") return false;
    const opts = {
      body: body || "",
      tag: tag || "repforge",
      renotify: true,
      data: { url: url || "./" },
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png"
    };
    const reg = await swRegistration();
    if (reg && reg.showNotification) {
      try {
        await reg.showNotification(title || "Taurifer", opts);
        return true;
      } catch (e) { console.warn("showNotification failed", e); }
    }
    try {
      new (/** @type {typeof globalThis.Notification} */(Notification))(title || "Taurifer", opts);
      return true;
    } catch (e) {
      console.warn("Notification constructor failed", e);
      return false;
    }
  }

  /** @param {string} tag */
  async function closeTag(tag) {
    try {
      const reg = await swRegistration();
      if (!reg || !reg.getNotifications) return;
      const list = await reg.getNotifications({ tag });
      list.forEach(n => n.close());
    } catch {}
  }

  return Object.freeze({ canUse, permission, request, enabledFor, fireOS, closeTag, TYPES: Object.freeze(TYPES) });
}
