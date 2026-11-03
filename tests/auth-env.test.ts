import { describe, expect, it } from "vitest";
import {
  AUTH_SECRET_PLACEHOLDER,
  authSecretProblem,
  DEVELOPMENT_SECRET_MIN_LENGTH,
  PRODUCTION_SECRET_MIN_LENGTH,
} from "@/lib/env";

describe("AUTH_SECRET validation", () => {
  it("rejects a missing secret in every environment", () => {
    expect(authSecretProblem(undefined, "production")).toMatch(/未配置/);
    expect(authSecretProblem("   ", "development")).toMatch(/未配置/);
  });

  it("rejects the .env.example placeholder in production only", () => {
    expect(authSecretProblem(AUTH_SECRET_PLACEHOLDER, "production")).toMatch(/示例值/);
    expect(authSecretProblem(AUTH_SECRET_PLACEHOLDER, "development")).toBeNull();
  });

  it("requires 32 characters in production", () => {
    const shortButLongEnoughForDev = "a".repeat(DEVELOPMENT_SECRET_MIN_LENGTH);
    expect(authSecretProblem(shortButLongEnoughForDev, "production")).toMatch(/太短/);
    expect(authSecretProblem(shortButLongEnoughForDev, "development")).toBeNull();
    expect(
      authSecretProblem("a".repeat(PRODUCTION_SECRET_MIN_LENGTH), "production"),
    ).toBeNull();
  });

  it("accepts a strong production secret", () => {
    expect(authSecretProblem("x".repeat(64), "production")).toBeNull();
  });
});
