"use server";

import { eq, or, ilike, sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers, projects, projectMembers, projectInvitations } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

export interface SyncUserProfileInput {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  inviteCode?: string | null;
  nationalId?: string | null;
  isCeo?: boolean;
}


function generateRandomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RADAR-${randomPart}`;
}

/**
 * همگام‌سازی اطلاعات کاربر در جدول profiles و اتصال به سازمان صرفاً در صورت داشتن کد دعوت
 */
export async function syncUserProfile(input: SyncUserProfileInput) {
  try {
    const displayName = input.name?.trim() || input.email.split("@")[0] || "کاربر RadarCheck";
    const isAdmin = isUserAdminEmail(input.email);
    const verificationStatus = isAdmin ? "verified" : (input.isCeo ? "pending" : "verified");

    // ۱. ذخیره/بروزرسانی پروفایل در جدول profiles
    await db
      .insert(profiles)
      .values({
        id: input.id,
        email: input.email,
        displayName: displayName,
        avatarUrl: input.avatarUrl ?? null,
        githubLogin: input.githubLogin ?? null,
        nationalId: input.nationalId ?? null,
        verificationStatus: verificationStatus,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: input.email,
          displayName: displayName,
          avatarUrl: input.avatarUrl ?? null,
          githubLogin: input.githubLogin ?? null,
          nationalId: input.nationalId ?? null,
          verificationStatus: verificationStatus,
          updatedAt: new Date(),
        },
      });

    // ۲. اگر کاربر مدیرعامل / ادمین است:
    if (isAdmin) {
      let [adminWs] = await db
        .select()
        .from(workspaces)
        .where(
          or(
            eq(workspaces.ownerId, input.id),
            ilike(workspaces.name, "%RadarCheck%")
          )
        )
        .limit(1);

      if (!adminWs) {
        const freshCode = generateRandomInviteCode();
        const [created] = await db
          .insert(workspaces)
          .values({
            name: "سازمان مهندسی RadarCheck",
            slug: `radarcheck-org-${input.id.slice(0, 6)}`,
            ownerId: input.id,
            inviteCode: freshCode,
          })
          .returning();
        adminWs = created;
      } else if (!adminWs.inviteCode) {
        const freshCode = generateRandomInviteCode();
        await db
          .update(workspaces)
          .set({ inviteCode: freshCode, updatedAt: new Date() })
          .where(eq(workspaces.id, adminWs.id));
      }

      if (adminWs) {
        await db
          .insert(workspaceMembers)
          .values({
            workspaceId: adminWs.id,
            userId: input.id,
            role: "owner",
          })
          .onConflictDoUpdate({
            target: [workspaceMembers.workspaceId, workspaceMembers.userId],
            set: { role: "owner", updatedAt: new Date() },
          });
      }
      return { ok: true, error: null };
    }

    // ۳. اگر کاربر عادی است و با کد دعوت ثبت‌نام کرده است:
    if (input.inviteCode && input.inviteCode.trim()) {
      const cleanCode = input.inviteCode.trim().toUpperCase();
      const [targetWs] = await db
        .select()
        .from(workspaces)
        .where(
          or(
            ilike(workspaces.inviteCode, cleanCode),
            sql`UPPER(${workspaces.inviteCode}) = ${cleanCode}`
          )
        )
        .limit(1);

      if (targetWs) {
        // بررسی اکید اعتبار ۱۰ دقیقه‌ای (۶۰۰ ثانیه)
        const lastUpdate = targetWs.updatedAt ? new Date(targetWs.updatedAt).getTime() : 0;
        const elapsedSec = Math.floor((Date.now() - lastUpdate) / 1000);

        if (elapsedSec < 600) {
          // ثبت در لیست اعضای سازمان مدیرعامل
          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: targetWs.id,
              userId: input.id,
              role: "member",
            })
            .onConflictDoUpdate({
              target: [workspaceMembers.workspaceId, workspaceMembers.userId],
              set: { role: "member", updatedAt: new Date() },
            });

          return { ok: true, error: null };
        } else {
          // کد بیش از ۱۰ دقیقه گذشته و منقضی شده است
          return {
            ok: false,
            error: "کد زیرمجموعه‌گیری وارد شده منقضی شده است (اعتبار کد ۱۰ دقیقه است). لطفاً کد جدید را از مدیرعامل دریافت نمایید.",
          };
        }
      } else {
        return {
          ok: false,
          error: "کد زیرمجموعه‌گیری وارد شده نامعتبر است.",
        };
      }
    }

    // ۴. کاربر عادی بدون کد دعوت: ایجاد فضای کاری شخصی جداگانه (به سازمان مدیرعامل اضافه نمی‌شود)
    const [existingMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, input.id))
      .limit(1);

    if (!existingMember) {
      const cleanSlug = `ws-${input.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
      const [personalWs] = await db
        .insert(workspaces)
        .values({
          name: `فضای شخصی ${displayName}`,
          slug: cleanSlug,
          ownerId: input.id,
        })
        .returning();

      if (personalWs) {
        await db.insert(workspaceMembers).values({
          workspaceId: personalWs.id,
          userId: input.id,
          role: "owner",
        });
      }
    }

    // ۵. بررسی و انتساب خودکار پروژه‌هایی که این ایمیل قبلاً به آن‌ها دعوت شده است
    try {

      const cleanEmail = input.email.trim().toLowerCase();
      const pendingInvites = await db
        .select({
          id: projectInvitations.id,
          projectId: projectInvitations.projectId,
          role: projectInvitations.role,
        })
        .from(projectInvitations)
        .where(
          and(
            ilike(projectInvitations.email, cleanEmail),
            isNull(projectInvitations.acceptedAt)
          )
        );

      for (const inv of pendingInvites) {
        const [proj] = await db
          .select({ workspaceId: projects.workspaceId })
          .from(projects)
          .where(eq(projects.id, inv.projectId))
          .limit(1);

        if (proj) {
          await db
            .insert(projectMembers)
            .values({
              projectId: inv.projectId,
              userId: input.id,
              role: inv.role,
            })
            .onConflictDoUpdate({
              target: [projectMembers.projectId, projectMembers.userId],
              set: { role: inv.role, updatedAt: new Date() },
            });

          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: proj.workspaceId,
              userId: input.id,
              role: "member",
            })
            .onConflictDoNothing();

          await db
            .update(projectInvitations)
            .set({ acceptedAt: new Date(), status: "accepted" })
            .where(eq(projectInvitations.id, inv.id));
        }
      }
    } catch (claimErr) {
      console.warn("[auto-claim-pending-invitations-warn]", claimErr);
    }

    return { ok: true, error: null };

  } catch (err: unknown) {
    console.error("[syncUserProfile] Error syncing user:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطای همگام‌سازی پروفایل" };
  }
}

/**
 * دریافت سشن و پروفایل کاربر فعال از سرور
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // خواندن پروفایل از دیتابیس
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    return {
      user,
      profile: profile || {
        id: user.id,
        displayName:
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "کاربر RadarCheck",
        email: user.email || "",
        avatarUrl: user.user_metadata?.avatar_url || null,
        githubLogin: user.user_metadata?.user_name || null,
      },
    };
  } catch (err) {
    console.error("[getCurrentUser] Error:", err);
    return null;
  }
}

/**
 * حذف کاربر از سامانه
 */
export async function deleteUserAccountAction(targetUserId?: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "کاربر احراز هویت نشده است." };
    }

    const userIdToDelete = targetUserId || user.id;
    const isSelfDelete = userIdToDelete === user.id;

    const { error: rpcError } = await supabase.rpc("delete_user_account", {
      target_user_id: userIdToDelete,
    });

    if (rpcError) {
      try {
        await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userIdToDelete));
        await db.delete(profiles).where(eq(profiles.id, userIdToDelete));
      } catch {
        // ignore
      }
    }

    if (isSelfDelete) {
      await supabase.auth.signOut();
    }

    return { ok: true, error: null };
  } catch (err: unknown) {
    console.error("[deleteUserAccountAction] Error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطا در حذف حساب کاربری" };
  }
}

/**
 * تایید یا رد کد ملی مدیرعامل توسط پلتفرم / ادمین
 */
export async function verifyNationalIdAction(userId: string, approve: boolean = true) {
  try {
    const session = await getCurrentUser();
    const email = session?.user?.email || session?.profile?.email || "";
    if (!session || !isUserAdminEmail(email)) {
      return { ok: false, error: "تنها مدیران ارشد مجاز به تایید مدارک هویتی هستند." };
    }

    const status = approve ? "verified" : "rejected";
    await db
      .update(profiles)
      .set({
        verificationStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));

    return { ok: true, status };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "خطای تایید مدارک" };
  }
}

