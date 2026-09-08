import { describe, expect, it } from "vitest";
import { euNamespace } from "../src/namespaces.js";

describe("EU Durable Object namespace boundary", () => {
  it("does not silently fall back when the provider jurisdiction is unavailable", () => {
    const providerError = new Error("provider jurisdiction unavailable");
    const namespace = {
      jurisdiction() {
        throw providerError;
      },
    };
    expect(() => euNamespace(namespace)).toThrow(providerError);
  });

  it("permits only the explicit local workerd test adapter", () => {
    const namespace = {
      jurisdiction() {
        throw new Error("Jurisdiction restrictions are not implemented in workerd.");
      },
    };
    expect(() => euNamespace(namespace)).toThrow(/not implemented/iu);
    expect(euNamespace(namespace, { allowLocalFallback: true })).toBe(namespace);
  });
});
