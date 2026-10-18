/** User-initiated browser file IO. The caller owns content validation and UI feedback. */
export function createFiles({ document, navigator, URL, Blob, File }) {
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

  async function readText(file) {
    return file.text();
  }
  return Object.freeze({ download, shareOrDownload, readText });
}
