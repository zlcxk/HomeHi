import { describe, expect, it } from "vitest";
import { passwordSchema, utf8ByteLength } from "@/lib/validation";

function errorOf(value: string): string | undefined {
  const result = passwordSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("password policy", () => {
  it("requires at least 8 characters", () => {
    expect(errorOf("short")).toMatch(/至少 8 位/);
    expect(errorOf("longenough")).toBeUndefined();
  });

  it("rejects passwords longer than bcrypt's 72-byte limit", () => {
    expect(utf8ByteLength("家".repeat(24))).toBe(72);
    expect(errorOf("家".repeat(24))).toBeUndefined();
    expect(errorOf("家".repeat(25))).toMatch(/72 字节/);
    expect(errorOf("a".repeat(73))).toMatch(/72 字节/);
  });

  it("rejects a small list of very common passwords", () => {
    expect(errorOf("password123")).toMatch(/过于常见/);
    expect(errorOf("PASSWORD123")).toMatch(/过于常见/);
  });

  it("accepts a normal passphrase", () => {
    expect(errorOf("home hi 2026!")).toBeUndefined();
  });
});
