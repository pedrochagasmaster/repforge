// Every relay Durable Object is created in the EU jurisdiction (ADR 0026: the
// same EU storage boundary as install transfer). Local workerd does not
// implement jurisdictions; only an explicit local-test flag falls back.
export function euStub(namespace, name, { allowLocalFallback = false } = {}) {
  if (!namespace || typeof namespace.jurisdiction !== "function") throw new Error("EU Durable Object namespace unavailable");
  let scoped;
  try {
    scoped = namespace.jurisdiction("eu");
  } catch (error) {
    if (!(allowLocalFallback && error instanceof Error && /Jurisdiction restrictions are not implemented/u.test(error.message))) throw error;
    scoped = namespace;
  }
  return scoped.get(scoped.idFromName(name));
}
