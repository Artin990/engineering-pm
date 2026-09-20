import { describe, it, expect } from "vitest";
import { isValidIranianNationalId, formatNationalId } from "@/lib/validators/national-id";
import { openApiSpec } from "@/lib/swagger";

describe("US1 - Iranian National ID Validator", () => {
  it("should validate correct national IDs with valid check digits", () => {
    // Standard valid Iranian National IDs
    expect(isValidIranianNationalId("0010350810")).toBe(true);
    expect(isValidIranianNationalId("0082764042")).toBe(true);
    expect(isValidIranianNationalId("0077519396")).toBe(true);
  });

  it("should convert Persian & Arabic digits correctly", () => {
    expect(isValidIranianNationalId("۰۰۱۰۳۵۰۸۱۰")).toBe(true);
    expect(isValidIranianNationalId("٠٠٨٢٧٦٤٠٤۲")).toBe(true);
  });

  it("should reject repeating digits even if length is 10", () => {
    expect(isValidIranianNationalId("0000000000")).toBe(false);
    expect(isValidIranianNationalId("1111111111")).toBe(false);
    expect(isValidIranianNationalId("2222222222")).toBe(false);
  });

  it("should reject invalid length or non-numeric characters", () => {
    expect(isValidIranianNationalId("")).toBe(false);
    expect(isValidIranianNationalId("123")).toBe(false);
    expect(isValidIranianNationalId("001035081")).toBe(false);
    expect(isValidIranianNationalId("001035081100")).toBe(false);
    expect(isValidIranianNationalId("001035081A")).toBe(false);
  });

  it("should reject wrong checksum", () => {
    // One digit modified from valid "0010350811"
    expect(isValidIranianNationalId("0010350812")).toBe(false);
    expect(isValidIranianNationalId("0010350819")).toBe(false);
  });

  it("should format national ID properly with hyphens", () => {
    expect(formatNationalId("0010350811")).toBe("001-035081-1");
  });
});

describe("Swagger / OpenAPI 3.0 Documentation", () => {
  it("should have valid OpenAPI 3.0 spec headers", () => {
    expect(openApiSpec.openapi).toBe("3.0.3");
    expect(openApiSpec.info.title).toContain("RadarCheck");
  });

  it("should contain all required Spec-Kit endpoints", () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toContain("/api/v1/auth/verify-national-id");
    expect(paths).toContain("/api/v1/projects");
    expect(paths).toContain("/api/v1/projects/{key}/archive");
    expect(paths).toContain("/api/v1/projects/{key}/members");
    expect(paths).toContain("/api/v1/workspaces");
  });
});
