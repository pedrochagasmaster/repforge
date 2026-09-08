import { base64UrlDecode } from "./crypto.js";

const HEALTHY = "healthy";
const REQUIRED_HEALTH_FLAGS = Object.freeze([
  "TRANSFER_ALARM_HEALTH",
  "TRANSFER_WATCHDOG_HEALTH",
  "TRANSFER_LOG_HEALTH",
  "TRANSFER_KEY_HEALTH",
  "TRANSFER_DELETION_HEALTH",
]);

function hasKey(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return base64UrlDecode(value).length >= 32;
  } catch {
    return false;
  }
}

function hasOrigin(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const origin = new URL(value);
    return origin.origin === value && (origin.protocol === "https:" || origin.hostname === "localhost");
  } catch {
    return false;
  }
}

export function serviceHealth(env) {
  const configurationReady = Boolean(
    hasKey(env.TRANSFER_ROUTING_KEY_B64)
      && hasKey(env.TRANSFER_TOKEN_MAC_KEY_B64)
      && hasKey(env.TRANSFER_DIGEST_KEY_B64)
      && hasKey(env.TRANSFER_RATE_PEPPER_B64)
      && typeof env.TRANSFER_TOKEN_MAC_KEY_ID === "string"
      && /^[A-Za-z0-9_-]{1,16}$/u.test(env.TRANSFER_TOKEN_MAC_KEY_ID)
      && hasOrigin(env.TRANSFER_ALLOWED_ORIGIN),
  );
  const operationalHealth = REQUIRED_HEALTH_FLAGS.every((name) => env[name] === HEALTHY);
  const killSwitch = env.TRANSFER_KILL_SWITCH === "true";
  const createsEnabled = configurationReady
    && operationalHealth
    && env.TRANSFER_CREATES_ENABLED === "true"
    && !killSwitch;
  return {
    configurationReady,
    operationalHealth,
    createsEnabled,
    killSwitch,
  };
}

export function createsAreEnabled(env) {
  return serviceHealth(env).createsEnabled;
}
