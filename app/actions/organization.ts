"use server";

import { eq, and, sql, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isUserAdminEmail } from "@/lib/role-context";

export interface OrgInfoResult {
  ok: boolean;
  workspaceId?: string;
  workspaceName?: string;
  inviteCode?: string;
  isOwner?: boolean;
  ownerName?: string;
  ownerEmail?: string;
  membersCount?: number;
  error?: string;
}

/**
 * دریافت مشخصات سازمان و کد دعوت کاربر فعال
 */
export async function getOrganizationInfo(): Promise<OrgInfoResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "کاربر وارد نشده است." };
    }

    const isAdmin = isUserAdminEmail(user.email);

    // 1. اگر کاربر ادمین است، ورک‌اسپیس خود را بیابد یا بسازد
    if (isAdmin) {
      let [adminWs] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerId, user.id))
        .limit(1);

      const defaultAdminCode = "RADAR-185";

      if (!adminWs) {
        // ایجاد ورک‌اسپیس مدیرعامل
        const [createdWs] = await db
          .insert(workspaces)
          .values({
            name: "سازمان مهندسی RadarCheck",
            slug: `radarcheck-org-${user.id.slice(0, 6)}`,
            ownerId: user.id,
            inviteCode: defaultAdminCode,
          })
          .returning();
        adminWs = createdWs;

        if (adminWs) {
          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: adminWs.id,
              userId: user.id,
              role: "owner",
            })
            .onConflictDoNothing();
        }
      } else if (!adminWs.inviteCode) {
        const [updatedWs] = await db
          .update(workspaces)
          .set({ inviteCode: defaultAdminCode, updatedAt: new Date() })
          .where(eq(workspaces.id, adminWs.id))
          .returning();
        adminWs = updatedWs;
      }

      // تعداد اعضا
      const memberRows = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, adminWs.id));

      return {
        ok: true,
        workspaceId: adminWs.id,
        workspaceName: adminWs.name,
        inviteCode: adminWs.inviteCode || defaultAdminCode,
        isOwner: true,
        ownerName: user.user_metadata?.name || user.email?.split("@")[0] || "مدیرعامل",
        ownerEmail: user.email,
        membersCount: Math.max(memberRows.length, 1),
      };
    }

    // 2. کاربر عادی: بررسی عضویت در ورک‌اسپیس
    const [membership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        wsName: workspaces.name,
        wsInviteCode: workspaces.inviteCode,
        ownerId: workspaces.ownerId,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, user.id))
      .limit(1);

    if (membership) {
      // دریافت مشخصات مدیرعامل ورک‌اسپیس
      let ownerName = "مدیرعامل سازمان";
      let ownerEmail = "";
      if (membership.ownerId) {
        const [ownerProfile] = await db
          .select({ displayName: profiles.displayName, email: profiles.email })
          .from(profiles)
          .where(eq(profiles.id, membership.ownerId))
          .limit(1);
        if (ownerProfile) {
          ownerName = ownerProfile.displayName;
          ownerEmail = ownerProfile.email || "";
        }
      }

      const memberRows = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, membership.workspaceId));

      return {
        ok: true,
        workspaceId: membership.workspaceId,
        workspaceName: membership.wsName,
        inviteCode: membership.wsInviteCode || undefined,
        isOwner: false,
        ownerName,
        ownerEmail,
        membersCount: memberRows.length,
      };
    }

    return {
      ok: true,
      isOwner: false,
      workspaceName: "بدون مجموعه",
      membersCount: 1,
    };
  } catch (err: unknown) {
    console.error("[getOrganizationInfo] Error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطا در دریافت اطلاعات سازمان" };
  }
}

/**
 * پیوستن کاربر به سازمان با کد زیرمجموعه‌گیری
 */
export async function joinOrganizationByCode(
  rawInviteCode: string
): Promise<{ ok: boolean; workspaceName?: string; ownerName?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "لطفاً ابتدا وارد حساب کاربری خود شوید." };
    }

    const cleanCode = rawInviteCode.trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, error: "کد زیرمجموعه‌گیری نمی‌تواند خالی باشد." };
    }

    // 1. یافتن ورک‌اسپیس با کد دعوت
    const [targetWs] = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
        inviteCode: workspaces.inviteCode,
      })
      .from(workspaces)
      .where(
        or(
          ilike(workspaces.inviteCode, cleanCode),
          sql`UPPER(${workspaces.inviteCode}) = ${cleanCode}`,
          // پشتیبانی از کدهای استاندارد مانند RADAR-185
          cleanCode === "RADAR-185" ? ilike(workspaces.name, "%RadarCheck%") : sql`false`
        )
      )
      .limit(1);

    if (!targetWs) {
      return {
        ok: false,
        error: `کد زیرمجموعه‌گیری «${cleanCode}» نامعتبر است یا سازمانی با این کد یافت نشد.`,
      };
    }

    // 2. پاک‌سازی عضویت‌های قبلی کاربر عادی در سایر ورک‌اسپیس‌ها
    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, user.id),
          sql`${workspaceMembers.workspaceId} != ${targetWs.id}`
        )
      );

    // 3. ثبت عضویت جدید در ورک‌اسپیس مقصد
    await db
      .insert(workspaceMembers)
      .values({
        workspaceId: targetWs.id,
        userId: user.id,
        role: "member",
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role: "member", updatedAt: new Date() },
      });

    // 4. دریافت نام مدیرعامل
    let ownerName = "مدیرعامل سازمان";
    if (targetWs.ownerId) {
      const [ownerProf] = await db
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, targetWs.ownerId))
        .limit(1);
      if (ownerProf?.displayName) ownerName = ownerProf.displayName;
    }

    return {
      ok: true,
      workspaceName: targetWs.name,
      ownerName,
    };
  } catch (err: unknown) {
    console.error("[joinOrganizationByCode] Error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطا در پیوستن به سازمان" };
  }
}

/**
 * خروج کاربر عادی از سازمان فعلی
 */
export async function leaveCurrentOrgAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "کاربر وارد نشده است." };
    }

    if (isUserAdminEmail(user.email)) {
      return { ok: false, error: "مدیرعامل نمی‌تواند از سازمان خود خارج شود." };
    }

    // حذف عضویت در ورک‌اسپیس‌های دیگر
    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, user.id));

    // ایجاد یک ورک‌اسپیس شخصی برای اینکه کاربر بدون سازمان نماند
    const cleanSlug = `ws-${user.id.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
    const [personalWs] = await db
      .insert(workspaces)
      .values({
        name: `فضای شخصی ${user.user_metadata?.name || user.email?.split("@")[0] || ""}`,
        slug: cleanSlug,
        ownerId: user.id,
      })
      .returning();

    if (personalWs) {
      await db.insert(workspaceMembers).values({
        workspaceId: personalWs.id,
        userId: user.id,
        role: "owner",
      });
    }

    return { ok: true };
  } catch (err: unknown) {
    console.error("[leaveCurrentOrgAction] Error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطا در خروج از سازمان" };
  }
}

/**
 * حذف عضو از سازمان توسط مدیرعامل (Kick)
 */
export async function removeOrgMemberAction(
  targetUserId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "کاربر احراز هویت نشده است." };
    }

    if (!isUserAdminEmail(user.email)) {
      return { ok: false, error: "تنها مدیرعامل مجاز به حذف اعضا از سازمان است." };
    }

    // یافتن ورک‌اسپیس مدیرعامل
    const [adminWs] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.id))
      .limit(1);

    if (adminWs) {
      await db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, adminWs.id),
            eq(workspaceMembers.userId, targetUserId)
          )
        );
    } else {
      // fallback delete any membership for this target user
      await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, targetUserId));
    }

    return { ok: true };
  } catch (err: unknown) {
    console.error("[removeOrgMemberAction] Error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "خطا در حذف عضو از سازمان" };
  }
}
