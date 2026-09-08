import { routeFromToken, routeNameForIdempotencyKey } from "./routing.js";
import { TransferDurableObject } from "./transfer-do.js";

export { TransferDurableObject };
export { routeFromToken, routeNameForIdempotencyKey };

const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: noStoreHeaders });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "install-transfer-foundation" });
    }

    // The shared envelope parser and transport CORS contract are intentionally
    // integrated only after the corrected client/service module is accepted.
    if (url.pathname.startsWith("/v1/transfers")) return json({ state: "unavailable" }, 503);
    return json({ state: "unavailable" }, 404);
  },
};
