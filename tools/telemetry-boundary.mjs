/** Source-level ownership guard used by the production gate and seeded proofs.
 * Runtime privacy is independently asserted at the real SDK request boundary. */
export function inspectTelemetryBoundary({app,telemetry,adapter,producers}) {
  const errors=[];
  if(/\bRepForgeTelemetry\b|\bRepForgePostHog\b/.test(app))errors.push('operational global telemetry owner');
  if(/(?:window|globalThis|browser)(?:\.posthog\b|\[\s*["']posthog["']\s*\])/.test(producers)||/(?:window|globalThis|browser)(?:\.posthog\b|\[\s*["']posthog["']\s*\])/.test(telemetry))errors.push('SDK access outside the platform adapter');
  if(!/\bcreateTelemetry\(\)/.test(app)||!/\bTelemetry\.capture\(event,properties\)/.test(app)||!/createPostHog\(\{browser:window,telemetry:Telemetry,config:/.test(app))errors.push('native consent/transport composition missing');
  if(!/browser\.posthog/.test(adapter))errors.push('optional SDK adapter missing');
  if(/\.capture\([^\n]*telemetry_schema_version/.test(producers))errors.push('producer builds transport envelope');
  return errors;
}
