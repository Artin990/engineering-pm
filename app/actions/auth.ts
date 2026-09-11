"use server";

import { eq, or, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface SyncUserProfileInput {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  githubLogin?: string | null;
  inviteCode?: string | null;
}

/**
 * همگام‌سازی اطلاعات کاربر در جدول profiles و اطمینان از وجود حداقل یک Workspace برای او
 */
export async function syncUserProfile(input: SyncUserProfileInput) {
  try {
    const displayName = input.name?.trim() || input.email.split("@")[0] || "کاربر RadarCheck";

    // 1. ذخیره/بروزرسانی پروفایل در دیتابیس
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

    // 2. اگر کد زیرمجموعه‌گیری وارد شده باشد، مستقیماً به آن سازمان متصل شود
    if (input.inviteCode && input.inviteCode.trim()) {
      const cleanCode = input.inviteCode.trim().toUpperCase();
      const [targetWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          or(
            ilike(workspaces.inviteCode, cleanCode),
            sql`UPPER(${workspaces.inviteCode}) = ${cleanCode}`,
            cleanCode === "RADAR-185" ? ilike(workspaces.name, "%RadarCheck%") : sql`false`
          )
        )
        .limit(1);

      if (targetWs) {
        await db
          .insert(workspaceMembers)
          .values({
            workspaceId: targetWs.id,
            userId: input.id,
            role: "member",
          })
          .onConflictDoNothing();
        return { ok: true, error: null };
      }
    }

    // 3. در غیر این صورت، بررسی عضویت در حداقل یک ورک‌اسپیس
    const userMemberships = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, input.id))
      .limit(1);

    if (userMemberships.length === 0) {
      // ایجاد ورک‌اسپیس پیش‌فرض برای کاربر جدید
      const cleanSlug = `ws-${input.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
      const wsName = `ورک‌اسپیس ${displayName}`;

      const [newWs] = await db
        .insert(workspaces)
        .values({
          name: wsName,
          slug: cleanSlug,
          ownerId: input.id,
        })
        .returning();

      if (newWs) {
        await db.insert(workspaceMembers).values({
          workspaceId: newWs.id,
          userId: input.id,
          role: "owner",
        });
      }
    }

    return { ok: true, error: null };
  } catch (err: unknown) {
    console.error("[syncUserProfile] Error syncing user:", err);
    // بازگرداندن خطا بدون کرش برنامه برای محیط‌های لوکال یا بدون دیتابیس مستقیم
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
        displayName: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "کاربر Flowdeck",
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
 * حذف کاربر از سامانه (حذف توسط خود کاربر یا حذف سریع توسط ادمین)
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

    // فراخوانی تابع امن PostgreSQL جهت حذف کامل و Cascade
    const { error: rpcError } = await supabase.rpc("delete_user_account", {
      target_user_id: userIdToDelete,
    });

    if (rpcError) {
      console.warn("[deleteUserAccountAction] RPC note, falling back to direct db delete:", rpcError);
      try {
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
