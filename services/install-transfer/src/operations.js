import { base64UrlDecode } from "./crypto.js";
import { euStub } from "./namespaces.js";

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
  return {
    configurationReady,
    operationalHealth,
    // Static environment labels are only one input. A fresh lease from the
    // owner-controlled health object is also required before a create can be
    // admitted; this value deliberately remains false in the sync helper.
    createsEnabled: false,
    killSwitch,
  };
}

export function createsAreEnabled(env) {
  return serviceHealth(env).createsEnabled;
}

export async function operationalServiceHealth(env, { now = Date.now() } = {}) {
  const staticHealth = serviceHealth(env);
  let evidence = null;
  try {
    if (env.TRANSFER_HEALTH) {
      evidence = await euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: env.TRANSFER_LOCAL_TEST_EU === "true" }).snapshot({ now });
    }
  } catch {
    evidence = null;
  }
  const leaseHealthy = evidence?.leaseFresh === true;
  const deletionHealthy = evidence?.deletionHealthy === true;
  const billingHealthy = evidence?.billingHealthy === true;
  const operationalHealth = staticHealth.operationalHealth && leaseHealthy && deletionHealthy && billingHealthy;
  const staticCreatesEnabled = staticHealth.configurationReady
    && staticHealth.operationalHealth
    && env.TRANSFER_CREATES_ENABLED === "true"
    && !staticHealth.killSwitch;
  return {
    ...staticHealth,
    operationalHealth,
    leaseHealthy,
    deletionHealthy,
    billingHealthy,
    createsEnabled: staticCreatesEnabled && evidence?.createsEnabled === true,
  };
}
