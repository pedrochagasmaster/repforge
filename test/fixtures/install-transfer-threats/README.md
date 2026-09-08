# Install-transfer threat fixtures

These fixtures are the independent Wave A P1b oracle for Plan 053. They pin the
ADR 0013 boundary rows, measurement units, parser timing, hostile inputs, and
redaction obligations. The fixture files remain independent of the production
module; `test/install-transfer-limits.mjs` runs the module separately against
these expectations.

`boundary-matrix.json` repeats every ADR 0013 payload/rate row with an explicit
measurement. Request and envelope limits count UTF-8 bytes with
`TextEncoder().encode(string).byteLength`, or the `byteLength` of an explicit
`Uint8Array`/`ArrayBuffer`; byte inputs are never coerced through `String()`.
Character limits count Unicode scalar values after rejecting lone UTF-16
surrogates, without normalization; this avoids the `String.length` trap for
astral characters. Depth starts at zero for the root and must be rejected while
parsing when the stack reaches 65.

All applicable bounds are conjunctive. The generic array limit applies to every
array, including `durableState.log`; its 10,000-item bound accepts the gate and
rejects 10,001 with `array-too-large`. The named 200,000-row log bound is a
redundant semantic upper bound and creates no exception or segmentation rule.
Nested arrays and rows never inherit a waiver from a named collection.

The exact body-size probes at 2,000,000 and 4,096 bytes are size-gate cases
only; they do not claim that their deliberately synthetic JSON is a valid
envelope or endpoint request.

`hostile-inputs.json` contains exact-limit/over-limit probes, malformed JSON,
unknown required/optional versions, duplicate JSON keys, an escaped lone
surrogate, and prototype-pollution keys. `redaction-cases.json` uses inert fixture canaries;
they are not credentials or clone data. The focused test asserts stable error
codes and never prints these canaries. It proves parity between the CommonJS
consumer and an isolated classic-browser global loaded from the same source;
the real service consumer remains a P2 boundary.

The dependency-free `install-transfer-contract.js` interface is:

```text
RepForgeInstallTransferContract = {
  LIMITS,
  ERROR_CODES,
  ENDPOINTS,
  canonicalJson(value),
  measureUtf8Bytes(input),
  measureChars(string),
  parseBoundedJson(rawBytes, endpoint),
  validateEnvelope(value),
  validateEnvelopeIntegrity(value, crypto),
  validateRequest(value, endpoint),
  validateClaimId(value),
  redactDiagnostic(value, channel)
}
```

`ENDPOINTS` is closed to these URL pathnames:

```text
create: "/v1/transfers"
claims: "/v1/transfers/claims"
commit: "/v1/transfers/claims/commit"
status: "/v1/transfers/status"
envelope: "/envelope"
```

`/envelope` is a local parser selector with the 2,000,000-byte envelope bound;
it is not a remote service endpoint. The other four selectors use their exact
ADR 0013 body limits. Unknown endpoint names fail closed.

`measureUtf8Bytes` accepts a string, `Uint8Array`, or `ArrayBuffer` with
explicit type checks and never stringifies byte input. `measureChars` accepts a
string only. `parseBoundedJson` accepts `Uint8Array` or `ArrayBuffer` only,
checks byte length before fatal UTF-8 decoding and bounded parsing, and returns
either `{ok: true, value}` or `{ok: false, code}`. Failure objects contain only
the fixed code; they never include values, paths, payloads, input, messages, or
details. Every exported validator uses those exact result shapes. The
`validateEnvelopeIntegrity` result is asynchronous: it validates the envelope
structure first, then hashes the canonical JSON preimage formed by removing
only `integrity.canonicalPayloadHash` and compares the lowercase SHA-256
digest. It does not normalize domain state or accept a wire
`logicalStateDigest` field. A missing or unusable WebCrypto implementation
returns a fixed error code.

`redactDiagnostic` accepts a closed channel enum and emits only the fixed,
allowlisted diagnostic fields for that channel. It never forwards arbitrary
messages or request data. It reads only own data properties, rejects accessors,
requires strict millisecond UTC timestamps for status expiry, and emits exactly
`{"state":"unavailable"}` for an unavailable response.

The envelope keeps the producer's normalized logical shapes. `durableState`
requires `settings` and `programMeta` objects plus `program`, `log`,
`programHistory`, and `customExercises` arrays of record objects; additive
logical fields remain available under the shared bounds. `uiPreferences` is a
full normalized object: `{}` and an absent `theme` are valid, while `theme` is
checked when present. DraftV2 checks its required nested containers and
exercise/set identity coverage after removing writer, revision, and durable
revision metadata. The program-entry section accepts the normalized schema-1
state and its normalized result/preview shape without replacing the app's full
domain validators. Provider session IDs and transfer sidecars are excluded by
name and path; ordinary logical session identity and colliding logical keys
remain valid.

The browser receives it as the classic global
`RepForgeInstallTransferContract`; Node and the future service consume the same
object through CommonJS. The coordinator has pinned the exact return/error
shapes and the `durableState.log` traversal rule. The focused test derives a
DraftV2 logical section, a programming-entry candidate, and a programming
context through the real `workout-draft.js` and `program-entry.js` producers,
then validates the complete P1a-shaped envelope through both the CommonJS and
isolated classic-browser consumers. Service parity is a P2 consumer proof and
is not claimed by this pure test.
