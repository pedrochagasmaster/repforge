const JSON_MEDIA_TYPE = "application/json";

export const TRANSPORT_ERROR_CODES = Object.freeze({
  BODY_TOO_LARGE: "body-too-large",
  INVALID_CONTENT_TYPE: "invalid-content-type",
  INVALID_ENCODING: "invalid-content-encoding",
  INVALID_UTF8: "invalid-utf8",
  INVALID_JSON: "invalid-json",
});

export class TransportError extends Error {
  constructor(code) {
    super(code);
    this.name = "TransportError";
    this.code = code;
  }
}

function assertByteLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new TypeError("maxBytes must be a non-negative safe integer");
}

function contentLength(request) {
  const header = request.headers.get("Content-Length");
  if (header === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(header)) throw new TransportError(TRANSPORT_ERROR_CODES.BODY_TOO_LARGE);
  const length = Number(header);
  if (!Number.isSafeInteger(length)) throw new TransportError(TRANSPORT_ERROR_CODES.BODY_TOO_LARGE);
  return length;
}

export function assertJsonRequest(request) {
  const contentType = request.headers.get("Content-Type");
  if (typeof contentType !== "string") throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_CONTENT_TYPE);
  const [mediaType, ...parameters] = contentType.split(";").map((part) => part.trim());
  if (mediaType.toLowerCase() !== JSON_MEDIA_TYPE) throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_CONTENT_TYPE);
  for (const parameter of parameters) {
    if (!/^charset=utf-8$/iu.test(parameter)) throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_CONTENT_TYPE);
  }
  const contentEncoding = request.headers.get("Content-Encoding");
  if (contentEncoding !== null && contentEncoding.toLowerCase() !== "identity") {
    throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_ENCODING);
  }
}

export async function readBoundedRequestBytes(request, maxBytes) {
  assertByteLimit(maxBytes);
  const declaredLength = contentLength(request);
  if (declaredLength !== null && declaredLength > maxBytes) throw new TransportError(TRANSPORT_ERROR_CODES.BODY_TOO_LARGE);
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  let total = 0;
  const bytes = new Uint8Array(declaredLength === null ? maxBytes : declaredLength);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new TypeError("request body chunks must be Uint8Array");
      if (value.byteLength === 0) continue;
      if (total > maxBytes - value.byteLength || total > bytes.byteLength - value.byteLength) {
        throw new TransportError(TRANSPORT_ERROR_CODES.BODY_TOO_LARGE);
      }
      bytes.set(value, total);
      total += value.byteLength;
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // The fixed transport error is the only observable failure.
    }
    throw error;
  }
  if (declaredLength !== null && declaredLength !== total) throw new TransportError(TRANSPORT_ERROR_CODES.BODY_TOO_LARGE);
  return total === bytes.byteLength ? bytes : bytes.slice(0, total);
}

export function decodeJsonSyntax(rawBytes) {
  if (!(rawBytes instanceof Uint8Array)) throw new TypeError("rawBytes must be a Uint8Array");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_UTF8);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new TransportError(TRANSPORT_ERROR_CODES.INVALID_JSON);
  }
}
