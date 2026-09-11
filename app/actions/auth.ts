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

/**
 * همگام‌سازی اطلاعات کاربر در جدول profiles و اتصال تضمینی به سازمان مدیرعامل
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

    // ۲. یافتن سازمان اصلی کارفرما/مدیرعامل
    let [mainOrgWs] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        or(
          ilike(workspaces.name, "%RadarCheck%"),
          ilike(workspaces.name, "%سازمان%")
        )
      )
      .limit(1);

    if (!mainOrgWs) {
      const [firstWs] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
      mainOrgWs = firstWs;
    }

    // اگر کد زیرمجموعه‌گیری وارد شده بود، سازمان متناظر را بیاب
    if (input.inviteCode && input.inviteCode.trim()) {
      const cleanCode = input.inviteCode.trim().toUpperCase();
      const [customWs] = await db
        .select({ id: workspaces.id })
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

      if (customWs) {
        mainOrgWs = customWs;
      }
    }

    // ۳. اتصال کاربر به سازمان مدیرعامل
    if (mainOrgWs) {
      await db
        .insert(workspaceMembers)
        .values({
          workspaceId: mainOrgWs.id,
          userId: input.id,
          role: isAdmin ? "owner" : "member",
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.userId],
          set: {
            role: isAdmin ? "owner" : "member",
            updatedAt: new Date(),
          },
        });
    } else {
      // ایجاد اولین ورک‌اسپیس در صورت خالی بودن دیتابیس
      const cleanSlug = `ws-${input.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
      const [newWs] = await db
        .insert(workspaces)
        .values({
          name: isAdmin ? "سازمان مهندسی RadarCheck" : `ورک‌اسپیس ${displayName}`,
          slug: cleanSlug,
          ownerId: input.id,
          inviteCode: isAdmin ? "RADAR-185" : undefined,
        })
        .returning();

      if (newWs) {
        await db.insert(workspaceMembers).values({
          workspaceId: newWs.id,
          userId: input.id,
          role: isAdmin ? "owner" : "member",
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
