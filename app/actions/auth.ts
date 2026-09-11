"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface SyncUserProfileInput {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  githubLogin?: string | null;
}

/**
 * همگام‌سازی اطلاعات کاربر در جدول profiles و اطمینان از وجود حداقل یک Workspace برای او
 */
export async function syncUserProfile(input: SyncUserProfileInput) {
  try {
    const displayName = input.name?.trim() || input.email.split("@")[0] || "کاربر Flowdeck";

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

    // 2. بررسی عضویت در حداقل یک ورک‌اسپیس
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
