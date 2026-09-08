# Install-transfer threat fixtures

These fixtures are the independent Wave A P1b oracle for Plan 053. They pin the
ADR 0013 boundary rows, measurement units, parser timing, hostile inputs, and
redaction obligations before the browser or service validators exist. The
fixtures intentionally do not import or execute a production transfer module.

`boundary-matrix.json` repeats every ADR 0013 payload/rate row with an explicit
measurement. Request and envelope limits count UTF-8 bytes with
`TextEncoder().encode(raw).byteLength`. Character limits count Unicode scalar
values with `Array.from(value).length`, without normalization; this avoids the
UTF-16 `String.length` trap for astral characters. Depth starts at zero for the
root and must be rejected while parsing when the stack reaches 65.

The generic array limit and the named `durableState.log` limit are both retained
as written. Because the current envelope represents `log` as one JSON array,
the fixture marks a 10,001–200,000 row log as unresolved until the coordinator
pins whether the named collection is an explicit semantic exception or whether
the representation must be segmented. Nested arrays and rows never inherit a
waiver from a named collection.

`hostile-inputs.json` contains exact-limit/over-limit probes, malformed JSON,
unknown required versions, an unresolved unknown-optional-section case, and
prototype-pollution keys. `redaction-cases.json` uses inert fixture canaries;
they are not credentials or clone data. Future parity tests must inspect the
actual service/browser validators and adapters, assert stable error codes, and
never print these canaries. Until those validators and the loading interface
are pinned, parity is explicitly planned rather than reported as passing.

The proposed dependency-free `install-transfer-contract.js` interface is:

```text
RepForgeInstallTransferContract = {
  LIMITS,
  ERROR_CODES,
  measureUtf8Bytes(raw),
  measureChars(value),
  parseBoundedJson(raw, endpoint),
  validateEnvelope(value),
  validateRequest(value, endpoint),
  validateClaimId(value),
  redactDiagnostic(value, channel)
}
```

The browser receives it as the classic global
`RepForgeInstallTransferContract`; the service consumes the same object through
CommonJS. The coordinator must pin the exact return/error shapes and the
`durableState.log` traversal rule before the module or parity assertions land.
