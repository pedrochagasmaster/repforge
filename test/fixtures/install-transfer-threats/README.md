# Install-transfer threat fixtures

These fixtures are the independent Wave A P1b oracle for Plan 053. They pin the
ADR 0013 boundary rows, measurement units, parser timing, hostile inputs, and
redaction obligations before the browser or service validators exist. The
fixtures intentionally do not import or execute a production transfer module.

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
they are not credentials or clone data. Future parity tests must inspect the
actual service/browser validators and adapters, assert stable error codes, and
never print these canaries. Until those validators and the loading interface
are pinned, parity is explicitly planned rather than reported as passing.

The proposed dependency-free `install-transfer-contract.js` interface is:

```text
RepForgeInstallTransferContract = {
  LIMITS,
  ERROR_CODES,
  canonicalJson(value),
  measureUtf8Bytes(input),
  measureChars(string),
  parseBoundedJson(rawBytes, endpoint),
  validateEnvelope(value),
  validateRequest(value, endpoint),
  validateClaimId(value),
  redactDiagnostic(value, channel)
}
```

`measureUtf8Bytes` accepts a string, `Uint8Array`, or `ArrayBuffer` with
explicit type checks and never stringifies byte input. `measureChars` accepts a
string only. `parseBoundedJson` accepts `Uint8Array` or `ArrayBuffer` only,
checks byte length before fatal UTF-8 decoding and bounded parsing, and returns
either `{ok: true, value}` or `{ok: false, code}`. Failure objects contain only
the fixed code; they never include values, paths, payloads, input, messages, or
details.

The browser receives it as the classic global
`RepForgeInstallTransferContract`; the service consumes the same object through
CommonJS. The coordinator has pinned the exact return/error shapes and the
`durableState.log` traversal rule; production parity remains pending until the
module exists.
