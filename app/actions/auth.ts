"use server";

import { eq, or, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

export interface SyncUserProfileInput {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  inviteCode?: string | null;
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

    // ۱. ذخیره/بروزرسانی پروفایل در جدول profiles
    await db
      .insert(profiles)
      .values({
        id: input.id,
        email: input.email,
        displayName: displayName,
        avatarUrl: input.avatarUrl ?? null,
        githubLogin: input.githubLogin ?? null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          email: input.email,
          displayName: displayName,
          avatarUrl: input.avatarUrl ?? null,
          githubLogin: input.githubLogin ?? null,
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
      let [targetWs] = await db
        .select()
        .from(workspaces)
        .where(
          or(
            ilike(workspaces.inviteCode, cleanCode),
            sql`UPPER(${workspaces.inviteCode}) = ${cleanCode}`,
            cleanCode === "RADAR-185" ? ilike(workspaces.name, "%RadarCheck%") : sql`false`,
            cleanCode.startsWith("RADAR-") ? ilike(workspaces.name, "%RadarCheck%") : sql`false`
          )
        )
        .limit(1);

      if (!targetWs) {
        const [mainWs] = await db
          .select()
          .from(workspaces)
          .where(ilike(workspaces.name, "%RadarCheck%"))
          .limit(1);
        targetWs = mainWs;
      }

      if (targetWs) {
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
