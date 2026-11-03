import { describe, expect, it } from "vitest";
import { isDataExportEnabled } from "@/lib/env";

describe("DATA_EXPORT_ENABLED", () => {
  it("is off by default", () => {
    expect(isDataExportEnabled(undefined)).toBe(false);
    expect(isDataExportEnabled("")).toBe(false);
    expect(isDataExportEnabled("false")).toBe(false);
  });

  it("only accepts an explicit true or 1", () => {
    expect(isDataExportEnabled("true")).toBe(true);
    expect(isDataExportEnabled(" TRUE ")).toBe(true);
    expect(isDataExportEnabled("1")).toBe(true);
    expect(isDataExportEnabled("yes")).toBe(false);
    expect(isDataExportEnabled("on")).toBe(false);
  });
});
