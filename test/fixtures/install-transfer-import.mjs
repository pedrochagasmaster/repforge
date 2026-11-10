// Real client claim and credential binding, followed by the production import hook.
export async function importInto(page, envelope, { retainCredentials = false } = {}) {
  const segment = Buffer.alloc(32, 7).toString("base64url");
  const cookie = { token: `v1.k1.${segment}.${segment}.${segment}`, expiresAt: "2099-01-01T00:00:00.000Z" };
  return page.evaluate(async ({ value, token, expiresAt, inboundKey, retainCredentials: keepCredentials }) => {
    const transfer = window.RepForgeInstallTransfer;
    const contract = window.RepForgeInstallTransferContract;
    const credentials = transfer?.createCredentialVault?.({ crypto: window.crypto, indexedDB: window.indexedDB });
    const cookieValues = new Map();
    const cookieDocument = {
      get cookie() { return [...cookieValues].map(([name, cookieValue]) => `${name}=${cookieValue}`).join("; "); },
      set cookie(serialized) {
        const [pair, ...attributes] = String(serialized).split(";");
        const separator = pair.indexOf("=");
        if (separator < 0) return;
        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1).trim();
        const maxAge = attributes.find((attribute) => /^\s*Max-Age=/i.test(attribute));
        if (maxAge && /Max-Age=0(?:\s|$)/i.test(maxAge)) cookieValues.delete(name);
        else cookieValues.set(name, cookieValue);
      },
    };
    const cookieLocation = { href: `${location.origin}/index.html`, origin: location.origin, pathname: "/index.html" };
    const inbound = {
      async read() {
        const raw = localStorage.getItem(inboundKey);
        try { return raw === null ? null : JSON.parse(raw); } catch { return { invalid: true, raw }; }
      },
      async write(marker) { localStorage.setItem(inboundKey, JSON.stringify(marker)); },
      async clear() { localStorage.removeItem(inboundKey); },
    };
    const operationLock = {
      withLock(name, work) {
        if (navigator.locks?.request) return navigator.locks.request(name, work);
        return work();
      },
    };
    const cleanupCredentials = async (marker) => {
      if (keepCredentials) return;
      await inbound.clear();
      try { await credentials?.forget?.("standalone-inbound", marker?.sealedCredentials); } catch {}
    };
    const transport = {
      async request({ path }) {
        if (path !== "/v1/transfers/claims") throw new Error(`unexpected-test-transfer-request:${path}`);
        return {
          status: 200,
          bytes: new TextEncoder().encode(JSON.stringify({ envelope: value, expiresAt })),
        };
      },
    };
    if (!transfer || !contract || !credentials ||
      !transfer.writeTransferCookie({ token, expiresAt }, { document: cookieDocument, location: cookieLocation })) {
      return { ok: false, code: "test-claim-setup-failed" };
    }
    const client = transfer.createClient({
      contract,
      crypto: window.crypto,
      transport,
      context: "standalone",
      document: cookieDocument,
      location: cookieLocation,
      storage: { inbound, credentials, operationLock },
    });
    const claimed = await client.claim();
    if (!claimed?.ok || claimed.state !== "validating") {
      await cleanupCredentials(await inbound.read());
      return { ok: false, code: claimed?.code || "test-claim-failed", claim: claimed };
    }
    const marker = await inbound.read();
    let pair;
    try { pair = await credentials.unseal("standalone-inbound", marker?.sealedCredentials); }
    catch {
      await cleanupCredentials(marker);
      return { ok: false, code: "test-claim-credential-unavailable" };
    }
    if (typeof pair?.claimId !== "string") {
      await cleanupCredentials(marker);
      return { ok: false, code: "test-claim-id-unavailable" };
    }
    const digestBytes = new Uint8Array(await window.crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(pair.claimId)));
    const claimIdDigest = [...digestBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const result = await window.__repforgeInstallTransferImport(value, {
      claimId: pair.claimId,
      claimIdDigest,
      credentials,
    });
    await cleanupCredentials(marker);
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
    await window.__repforgeOnboarding?.flushDraft?.();
    return result ?? null;
  }, { value: envelope, token: cookie.token, expiresAt: cookie.expiresAt, inboundKey: "repforge_transfer_inbound_v1",
    retainCredentials });
}

