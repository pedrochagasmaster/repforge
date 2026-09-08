// All transfer Durable Objects are created through the EU subnamespace. The
// provider permits global edge ingress, but the object and its SQLite state
// must remain in the approved EU jurisdiction.
export function euNamespace(namespace) {
  if (!namespace || typeof namespace.jurisdiction !== "function") {
    throw new Error("EU Durable Object namespace unavailable");
  }
  try {
    return namespace.jurisdiction("eu");
  } catch (error) {
    // The current local workerd used by @cloudflare/vitest-plugin exposes the
    // namespace API but deliberately does not implement jurisdiction routing.
    // Keep local SQLite proof runnable while making every deployed provider
    // failure fail closed; staging must exercise a real EU subnamespace.
    if (error instanceof Error && error.message === "Jurisdiction restrictions are not implemented in workerd.") {
      return namespace;
    }
    throw error;
  }
}

export function euStub(namespace, name) {
  return euNamespace(namespace).getByName(name);
}
