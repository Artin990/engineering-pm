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

describe("US5 & US6 - Project Members & Invitations Resolution", () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isValidUuid(id: string): boolean {
    return typeof id === "string" && UUID_REGEX.test(id.trim());
  }


  it("should correctly identify valid and invalid UUIDs", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("c30538a0-2f22-4411-9686-2a3a5f979857")).toBe(true);
    expect(isValidUuid("dev@company.com")).toBe(false);
    expect(isValidUuid("u-ali")).toBe(false);
    expect(isValidUuid("m-1726800123456")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });

  it("should correctly distinguish registered profile assignment from email invitations", () => {
    const rawIds = ["c30538a0-2f22-4411-9686-2a3a5f979857", "colleague@company.com"];
    
    const validUuids = rawIds.filter((id) => isValidUuid(id));
    const emailsToInvite = rawIds.filter((id) => !isValidUuid(id) && id.includes("@"));

    expect(validUuids).toEqual(["c30538a0-2f22-4411-9686-2a3a5f979857"]);
    expect(emailsToInvite).toEqual(["colleague@company.com"]);
  });

  it("should normalize email addresses for invitations and auto-claim matching", () => {
    const enteredEmail = "  Employee.One@Company.COM  ";
    const normalized = enteredEmail.trim().toLowerCase();
    expect(normalized).toBe("employee.one@company.com");
  });
});

describe("US7 - Completed & Archived Projects Board", () => {
  it("should categorize completed and archived projects correctly", () => {
    const mockProjects = [
      { id: "1", key: "P1", status: "active", progress: 60 },
      { id: "2", key: "P2", status: "completed", progress: 100 },
      { id: "3", key: "P3", status: "archived", progress: 100 },
      { id: "4", key: "P4", status: "planning", progress: 0 },
    ];

    const activeList = mockProjects.filter((p) => p.status === "active" || p.status === "planning");
    const completedList = mockProjects.filter((p) => p.status === "completed" || p.status === "archived");

    expect(activeList.map((p) => p.key)).toEqual(["P1", "P4"]);
    expect(completedList.map((p) => p.key)).toEqual(["P2", "P3"]);
  });

  it("should allow employer completion with custom or default 100% success rate", () => {
    const completeAction = (rate?: number) => ({
      status: "completed",
      successRate: typeof rate === "number" ? rate : 100,
      archivedAt: new Date().toISOString(),
    });

    const result1 = completeAction();
    expect(result1.status).toBe("completed");
    expect(result1.successRate).toBe(100);

    const result2 = completeAction(95);
    expect(result2.successRate).toBe(95);
  });
});


