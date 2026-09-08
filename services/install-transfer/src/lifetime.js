export const LIVE_WINDOW_MS = 60 * 60 * 1000;
export const TOMBSTONE_MARGIN_MS = 15 * 60 * 1000;

export const TRANSFER_STATES = Object.freeze({
  AVAILABLE: "available",
  CLAIMING: "claiming",
  DELETED: "deleted",
  EXPIRED: "expired",
  CLAIMED_EXPIRED: "claimed-expired",
});

const terminalStates = new Set([
  TRANSFER_STATES.DELETED,
  TRANSFER_STATES.EXPIRED,
  TRANSFER_STATES.CLAIMED_EXPIRED,
]);

export function expiryForCreate(serverNow, requestedExpiry = serverNow + LIVE_WINDOW_MS) {
  if (!Number.isSafeInteger(serverNow) || !Number.isSafeInteger(requestedExpiry)) throw new TypeError("expiry values must be safe integers");
  if (requestedExpiry < serverNow) throw new RangeError("expiry cannot be in the past");
  return Math.min(requestedExpiry, serverNow + LIVE_WINDOW_MS);
}

export function tombstoneUntil(expiresAt) {
  if (!Number.isSafeInteger(expiresAt)) throw new TypeError("expiresAt must be a safe integer");
  return expiresAt + TOMBSTONE_MARGIN_MS;
}

export function isTerminal(state) {
  return terminalStates.has(state);
}

export function expiresState(state) {
  if (state === TRANSFER_STATES.AVAILABLE) return TRANSFER_STATES.EXPIRED;
  if (state === TRANSFER_STATES.CLAIMING) return TRANSFER_STATES.CLAIMED_EXPIRED;
  if (isTerminal(state)) return state;
  throw new TypeError(`unknown transfer state: ${state}`);
}

export function transitionForTime(record, serverNow) {
  if (!record || !Number.isSafeInteger(serverNow)) throw new TypeError("record and serverNow are required");
  if (isTerminal(record.state) || serverNow < record.expiresAt) return null;
  return expiresState(record.state);
}

export function nextAlarmAt(record, serverNow) {
  if (!record) return null;
  const deadlines = [];
  if (!isTerminal(record.state)) deadlines.push(record.expiresAt);
  if (isTerminal(record.state) && Number.isSafeInteger(record.tombstoneUntil)) deadlines.push(record.tombstoneUntil);
  if (deadlines.length === 0) return null;
  return Math.max(serverNow, Math.min(...deadlines));
}

export function canClaim(record, serverNow) {
  return Boolean(record && record.state === TRANSFER_STATES.AVAILABLE && serverNow < record.expiresAt);
}

export function canCommit(record, serverNow) {
  return Boolean(record && record.state === TRANSFER_STATES.CLAIMING && serverNow < record.expiresAt);
}
