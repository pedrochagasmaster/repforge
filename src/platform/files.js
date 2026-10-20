/** User-initiated browser file IO. The caller owns content validation and UI feedback. */
/** @param {{document:Document,navigator:Pick<Navigator,'canShare'|'share'|'clipboard'>,URL:typeof URL,Blob:typeof Blob,File:typeof File}} capabilities */
export function createFiles({ document, navigator, URL, Blob, File }) {
  /** @param {string} text @param {string} name @param {string} type */
  function download(text, name, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  }

  // Preserve the existing native-share fallback, including cancelled shares.
  /** @param {string} text @param {string} name @param {string} type @param {string} title */
  async function shareOrDownload(text, name, type, title = "Taurifer backup") {
    try {
      if (navigator.canShare) {
        const file = new File([text], name, { type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title });
          return;
        }
      }
    } catch {}
    download(text, name, type);
  }

  /** @param {Pick<File,'text'>} file */
  async function readText(file) {
    return file.text();
  }
  /** Clipboard success is a fact; the caller owns feedback and lifetime.
   * @param {string} text */
  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const textarea=document.createElement('textarea');
    try {
      textarea.value=text; textarea.setAttribute('readonly','');
      textarea.style.cssText='position:fixed;top:0;left:0;opacity:0';
      document.body.append(textarea); textarea.select();
      return document.execCommand('copy');
    } catch { return false; } finally { textarea.remove(); }
  }
  return Object.freeze({ download, shareOrDownload, readText, copyText });
}
