/**
 * A loopback static host with the production custom domain's rules (#304).
 *
 * The production host answers `/index.html` with `308 Location: /` (the static
 * host's pretty-URL rule), and its install-transfer service answers the
 * origin-root `/v1/` routes. The ordinary preview serves `index.html` directly,
 * so a fault that crosses that redirect is not reachable from it.
 *
 * `/v1/` requests are recorded (method, path, Cookie header) and answered as a
 * transfer the service does not know.
 */
import { createServer } from "node:http";
import { statSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const statSafe = (file) => { try { return statSync(file); } catch { return null; } };
const mimeType = (extension) => ({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2",
}[extension] || "application/octet-stream");

export async function startRedirectHost() {
  const serviceRequests = [];
  const server = createServer((request, response) => {
    const [pathname, search = ""] = decodeURIComponent(request.url || "/").split("?");
    const headers = (type) => ({ "content-type": type, "cache-control": "no-store" });
    if (pathname.startsWith("/v1/")) {
      serviceRequests.push({ method: request.method, pathname, cookie: request.headers.cookie ?? null });
      request.resume();
      response.writeHead(404, headers("application/json"));
      response.end(JSON.stringify({ state: "unavailable" }));
      return;
    }
    // The production host's rule: the document lives at the directory URL.
    if (pathname === "/index.html") {
      response.writeHead(308, { location: `/${search ? `?${search}` : ""}`, "cache-control": "no-store" });
      response.end();
      return;
    }
    const file = normalize(join(ROOT, pathname === "/" ? "index.html" : pathname.slice(1)));
    if (relative(ROOT, file).startsWith("..") || !statSafe(file)?.isFile()) {
      response.writeHead(404, headers("text/plain")); response.end("Not found"); return;
    }
    response.writeHead(200, headers(mimeType(extname(file))));
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}/`,
    serviceRequests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
