/** Recognize only a canonical service-worker CACHE revision token change. */
const CACHE_DECLARATION = /\bconst CACHE = "repforge-v([1-9]\d*)";/g;

function normalizedCacheDeclaration(source) {
  const declarations = [...source.matchAll(CACHE_DECLARATION)];
  if (declarations.length !== 1) return null;
  const [declaration] = declarations;
  const normalized = source.slice(0, declaration.index) +
    declaration[0].replace(declaration[1], "REVISION") +
    source.slice(declaration.index + declaration[0].length);
  return { revision: declaration[1], normalized };
}

export function isCacheRevisionOnlyServiceWorkerChange(before, after) {
  if (typeof before !== "string" || typeof after !== "string" || before === after) return false;
  const previous = normalizedCacheDeclaration(before);
  const current = normalizedCacheDeclaration(after);
  return Boolean(previous && current && BigInt(current.revision) > BigInt(previous.revision) &&
    previous.normalized === current.normalized);
}
