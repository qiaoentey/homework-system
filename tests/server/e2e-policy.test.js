import { describe, expect, it } from "vitest";
import {
  EXTERNAL_MUTATION_ACKNOWLEDGEMENT,
  assertExternalMutationSafety,
  isReadOnlyHttpMethod,
  selectE2ETestMatch,
} from "../e2e/policy.js";

describe("external E2E safety policy", () => {
  it("selects only the read-only smoke suite for a plain external base URL", () => {
    expect(selectE2ETestMatch({
      externalBaseUrl: "https://daycare.example.test",
      mutationOptIn: undefined,
    })).toEqual(["**/smoke.spec.js"]);
    expect(() => assertExternalMutationSafety({
      externalBaseUrl: "https://daycare.example.test",
      mutationOptIn: undefined,
    })).toThrow(/refusing external mutation suite/i);
  });

  it("requires the exact danger acknowledgement before external mutation tests", () => {
    expect(selectE2ETestMatch({
      externalBaseUrl: "https://staging.example.test",
      mutationOptIn: "true",
    })).toEqual(["**/smoke.spec.js"]);

    expect(selectE2ETestMatch({
      externalBaseUrl: "https://staging.example.test",
      mutationOptIn: EXTERNAL_MUTATION_ACKNOWLEDGEMENT,
    })).toEqual(["**/daycare.spec.js"]);
    expect(() => assertExternalMutationSafety({
      externalBaseUrl: "https://staging.example.test",
      mutationOptIn: EXTERNAL_MUTATION_ACKNOWLEDGEMENT,
    })).not.toThrow();
  });

  it("keeps the full mutation suite enabled for the isolated local harness", () => {
    expect(selectE2ETestMatch({
      externalBaseUrl: undefined,
      mutationOptIn: undefined,
    })).toEqual(["**/daycare.spec.js"]);
    expect(() => assertExternalMutationSafety({
      externalBaseUrl: undefined,
      mutationOptIn: undefined,
    })).not.toThrow();
  });

  it("allows only methods that cannot mutate the external service", () => {
    expect(["GET", "HEAD", "OPTIONS"].map(isReadOnlyHttpMethod)).toEqual([
      true,
      true,
      true,
    ]);
    expect(["POST", "PUT", "PATCH", "DELETE"].map(isReadOnlyHttpMethod)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
