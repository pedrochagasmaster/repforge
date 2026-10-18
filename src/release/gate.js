/** Release startup is deliberately separate from application/storage imports. */
/** @typedef {{postMessage(message: unknown, transfer: Transferable[]): void}} Controller */
/**
 * An absent controller is a network-only first visit, not a failed installation.
 * A historical controller without the handshake must never start a new writer.
 * @param {Controller | null | undefined} controller
 * @param {string} releaseId
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function controllerMatches(controller, releaseId, timeoutMs = 1500) {
  if (!controller) return Promise.resolve(true);
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (/** @type {boolean} */ match) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(match);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.port1.onmessage = event => finish(event.data?.type === 'taurifer-release' && event.data.id === releaseId);
    try { controller.postMessage({type: 'taurifer-release-query'}, [channel.port2]); }
    catch { finish(false); }
  });
}
/**
 * Caller owns recovery presentation and registration; registration rejection must
 * not stop an uncontrolled exact graph. No imported app code runs before this.
 * @param {{controller?: Controller | null, releaseId: string, load: () => Promise<void>}} options
 * @returns {Promise<'started' | 'update-required'>}
 */
export async function startRelease({controller, releaseId, load}) {
  if (!await controllerMatches(controller, releaseId)) return 'update-required';
  await load();
  return 'started';
}
