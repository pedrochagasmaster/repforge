import { describe, expect, it } from "vitest";
import {
  TRANSPORT_ERROR_CODES,
  TransportError,
  assertJsonRequest,
  decodeJsonSyntax,
  readBoundedRequestBytes,
} from "../src/transport.js";

function request(body, headers = {}) {
  return new Request("https://transfer.example/v1/transfers", {
    method: "POST",
    body,
    headers,
  });
}

describe("bounded raw request transport", () => {
  it("checks content type and content encoding without exposing request data", () => {
    expect(() => assertJsonRequest(request("{}", { "Content-Type": "application/json" }))).not.toThrow();
    expect(() => assertJsonRequest(request("{}", { "Content-Type": "application/json; charset=utf-8" }))).not.toThrow();
    expect(() => assertJsonRequest(request("{}", { "Content-Type": "text/plain" }))).toThrowError(
      new TransportError(TRANSPORT_ERROR_CODES.INVALID_CONTENT_TYPE),
    );
    expect(() => assertJsonRequest(request("{}", { "Content-Type": "application/json", "Content-Encoding": "gzip" }))).toThrowError(
      new TransportError(TRANSPORT_ERROR_CODES.INVALID_ENCODING),
    );
  });

  it("rejects a declared oversized body before reading it and catches chunked overflow", async () => {
    const oversized = new Request("https://transfer.example", {
      method: "POST",
      body: "{}",
      headers: { "Content-Length": "11" },
    });
    await expect(readBoundedRequestBytes(oversized, 10)).rejects.toMatchObject({ code: TRANSPORT_ERROR_CODES.BODY_TOO_LARGE });

    const chunked = request(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([123, 125, 0]));
        controller.close();
      },
    }), { "Content-Type": "application/json" });
    await expect(readBoundedRequestBytes(chunked, 2)).rejects.toMatchObject({ code: TRANSPORT_ERROR_CODES.BODY_TOO_LARGE });
  });

  it("decodes fatal UTF-8 and JSON syntax after the byte gate", () => {
    expect(decodeJsonSyntax(Uint8Array.from([123, 125]))).toEqual({});
    expect(() => decodeJsonSyntax(Uint8Array.from([123, 34, 107, 34, 58, 194, 125]))).toThrowError(
      new TransportError(TRANSPORT_ERROR_CODES.INVALID_UTF8),
    );
    expect(() => decodeJsonSyntax(new TextEncoder().encode('{"kind":'))).toThrowError(
      new TransportError(TRANSPORT_ERROR_CODES.INVALID_JSON),
    );
  });
});
