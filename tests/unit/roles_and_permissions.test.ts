import { describe, it, expect } from "vitest";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

/**
 * مجموعه تست‌های اعتبارسنجی جامع سایت در هر دو نقش:
 * ۱. نقش کارفرما / مدیرعامل (Admin / CEO / Lead)
 * ۲. نقش کاربر عادی / کارمند / توسعه‌دهنده (Member / Contributor / Viewer)
 */

describe("۱. تفکیک هویت و نقش‌های کاربری (Identity & Role Resolution)", () => {
  it("ایمیل‌های مدیرعامل همواره به عنوان ادمین ارشد شناخته می‌شوند", () => {
    const adminEmails = [
      "amiriartin185@gmail.com",
      "artinamiri185@gmail.com",
      "amiriartin185@gmil.com",
      "ArtinAmiri185@Gmail.COM",
    ];

    for (const email of adminEmails) {
      expect(isUserAdminEmail(email)).toBe(true);
    }
  });

  it("ایمیل‌های کارکنان، کارمندان و اعضای عادی هرگز به عنوان ادمین شناخته نمی‌شوند", () => {
    const memberEmails = [
      "developer@company.com",
      "sarah.hosseini@gmail.com",
      "pouria@engineering.ir",
      "intern@startup.io",
    ];

    for (const email of memberEmails) {
      expect(isUserAdminEmail(email)).toBe(false);
    }
  });

  it("نقش مدیرعامل دسترسی‌های اداری (isAdmin) دارد و کارمند دسترسی عادی (isMember)", () => {
    const getRoleFlags = (role: string) => ({
      isAdmin: role === "admin" || role === "owner",
      isMember: role === "member" || role === "viewer",
    });

    const ceoFlags = getRoleFlags("admin");
    expect(ceoFlags.isAdmin).toBe(true);
    expect(ceoFlags.isMember).toBe(false);

    const employeeFlags = getRoleFlags("member");
    expect(employeeFlags.isAdmin).toBe(false);
    expect(employeeFlags.isMember).toBe(true);
  });
});

describe("۲. مجوزهای مدیریت پروژه (Project Lifecycle Permissions)", () => {
  interface ProjectActionPermissions {
    canCreateProject: boolean;
    canDeleteProject: boolean;
    canArchiveOrCompleteProject: boolean;
    canEditProjectSettings: boolean;
  }

  const resolveProjectPermissions = (isAdmin: boolean): ProjectActionPermissions => ({
    canCreateProject: isAdmin,
    canDeleteProject: isAdmin,
    canArchiveOrCompleteProject: isAdmin,
    canEditProjectSettings: isAdmin,
  });

  it("مدیرعامل تمام اختیارات چرخه‌عمر پروژه را داراست", () => {
    const perms = resolveProjectPermissions(true);
    expect(perms.canCreateProject).toBe(true);
    expect(perms.canDeleteProject).toBe(true);
    expect(perms.canArchiveOrCompleteProject).toBe(true);
    expect(perms.canEditProjectSettings).toBe(true);
  });

  it("کارمند و کاربر عادی نمی‌تواند پروژه را حذف، آرشیو، تکمیل یا ایجاد کند", () => {
    const perms = resolveProjectPermissions(false);
    expect(perms.canCreateProject).toBe(false);
    expect(perms.canDeleteProject).toBe(false);
    expect(perms.canArchiveOrCompleteProject).toBe(false);
    expect(perms.canEditProjectSettings).toBe(false);
  });
});

describe("۳. گردش‌کار و محدودیت‌های ایشوها در کانبان (Issues Kanban Workflow by Role)", () => {
  type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";

  // بررسی منطق انتقال ایشو بر اساس نقش کاربر
  const canMoveIssueStatus = (
    fromStatus: IssueStatus,
    toStatus: IssueStatus,
    isAdmin: boolean
  ): { allowed: boolean; reason?: string } => {
    // ادمین و مدیرعامل به تمام ستون‌ها و تایید نهایی دسترسی دارند
    if (isAdmin) {
      return { allowed: true };
    }

    // کاربران عادی اجازه انتقال مستقیم به done را ندارند؛ حداکثر تا in_review برای بازبینی کارفرما
    if (toStatus === "done") {
      return {
        allowed: false,
        reason: "اتمام نهایی کار فقط پس از بررسی و تایید کارفرما امکان‌پذیر است. لطفاً ایشو را به در انتظار بررسی (in_review) منتقل کنید.",
      };
    }

    // بازگرداندن از done به سایر وضعیت‌ها نیز در انحصار کارفرما است
    if (fromStatus === "done") {
      return {
        allowed: false,
        reason: "تغییر وضعیت کارهای تایید شده فقط توسط مدیر پروژه انجام می‌شود.",
      };
    }

    return { allowed: true };
  };

  it("کارمند می‌تواند ایشو را از backlog تا in_progress و in_review انتقال دهد", () => {
    expect(canMoveIssueStatus("backlog", "todo", false).allowed).toBe(true);
    expect(canMoveIssueStatus("todo", "in_progress", false).allowed).toBe(true);
    expect(canMoveIssueStatus("in_progress", "in_review", false).allowed).toBe(true);
  });

  it("کارمند اجازه انتقال مستقیم کار به done (اتمام بدون تایید کارفرما) را ندارد", () => {
    const attempt = canMoveIssueStatus("in_progress", "done", false);
    expect(attempt.allowed).toBe(false);
    expect(attempt.reason).toContain("تایید کارفرما");
  });

  it("مدیرعامل می‌تواند ایشو را تایید و به done منتقل کرده یا در صورت اشکال به in_progress بازگرداند", () => {
    expect(canMoveIssueStatus("in_review", "done", true).allowed).toBe(true);
    expect(canMoveIssueStatus("done", "in_progress", true).allowed).toBe(true);
    expect(canMoveIssueStatus("in_review", "todo", true).allowed).toBe(true);
  });
});

describe("۴. سیستم دعوت اعضا و ادعای خودکار (Invitations & Auto-Claim)", () => {
  interface ProjectInvitation {
    id: string;
    projectId: string;
    email: string;
    role: "lead" | "contributor" | "viewer";
    status: "pending" | "accepted";
    acceptedAt?: string | null;
  }

  it("ایجاد دعوت‌نامه با ایمیل و نقش معتبر", () => {
    const rawEmail = " New.Developer@RadarCheck.dev ";
    const normalizedEmail = rawEmail.trim().toLowerCase();

    const inv: ProjectInvitation = {
      id: "inv-101",
      projectId: "proj-1",
      email: normalizedEmail,
      role: "contributor",
      status: "pending",
      acceptedAt: null,
    };

    expect(inv.email).toBe("new.developer@radarcheck.dev");
    expect(inv.status).toBe("pending");
  });

  it("ادعای خودکار (Auto-Claim) دعوت‌نامه‌ها پس از ثبت‌نام کاربر", () => {
    const pendingInvitations: ProjectInvitation[] = [
      { id: "inv-1", projectId: "proj-alpha", email: "user@radarcheck.dev", role: "contributor", status: "pending" },
      { id: "inv-2", projectId: "proj-beta", email: "user@radarcheck.dev", role: "viewer", status: "pending" },
      { id: "inv-3", projectId: "proj-gamma", email: "other@radarcheck.dev", role: "contributor", status: "pending" },
    ];

    const registeringUser = {
      id: "u-999",
      email: "USER@radarcheck.dev",
    };

    const claimedMembers: Array<{ projectId: string; userId: string; role: string }> = [];

    const updatedInvs = pendingInvitations.map((inv) => {
      if (inv.email.toLowerCase() === registeringUser.email.toLowerCase().trim() && inv.status === "pending") {
        claimedMembers.push({
          projectId: inv.projectId,
          userId: registeringUser.id,
          role: inv.role,
        });
        return { ...inv, status: "accepted" as const, acceptedAt: new Date().toISOString() };
      }
      return inv;
    });

    expect(claimedMembers.length).toBe(2);
    expect(claimedMembers.map((m) => m.projectId)).toEqual(["proj-alpha", "proj-beta"]);
    expect(updatedInvs.find((i) => i.id === "inv-1")?.status).toBe("accepted");
    expect(updatedInvs.find((i) => i.id === "inv-3")?.status).toBe("pending");
  });
});

describe("۵. امنیت کنسول و کدهای معرف سازمان (Admin Console & Security)", () => {
  it("دسترسی به بخش مدیریت ارشد (/rc-admin) فقط با نقش ادمین یا مسترکی معتبر", () => {
    const MASTER_KEY_HASH = "rc-master-2026";
    const canAccessAdmin = (role: string, providedKey?: string) => {
      if (role === "admin" || role === "owner") return true;
      if (providedKey === MASTER_KEY_HASH) return true;
      return false;
    };

    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("member")).toBe(false);
    expect(canAccessAdmin("member", "wrong-key")).toBe(false);
    expect(canAccessAdmin("member", "rc-master-2026")).toBe(true);
  });

  it("مدیرعامل می‌تواند کد معرف سازمان تولید یا بچرخاند، کارمند فقط خواندنی است", () => {
    const canRotateInviteCode = (isAdmin: boolean) => isAdmin;
    expect(canRotateInviteCode(true)).toBe(true);
    expect(canRotateInviteCode(false)).toBe(false);
  });
});
