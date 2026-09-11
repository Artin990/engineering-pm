import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/role-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    const isAdmin = isUserAdminEmail(userEmail);

    // برای مدیرعامل و ادمین کل: بازگرداندن کلیه اعضای ثبت‌نام شده در سامانه با جوین مشخصات
    if (isAdmin || !userId) {
      const allOrgProfiles = await db
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
          githubLogin: profiles.githubLogin,
          createdAt: profiles.createdAt,
          role: sql<string>`COALESCE(${workspaceMembers.role}, 'member')`,
          joinedAt: sql<string>`COALESCE(${workspaceMembers.joinedAt}, ${profiles.createdAt})`,
        })
        .from(profiles)
        .leftJoin(workspaceMembers, eq(profiles.id, workspaceMembers.userId))
        .orderBy(desc(profiles.createdAt));

      // حذف ردیف‌های تکراری بر اساس شناسه پروفایل
      const uniqueProfiles = Array.from(
        new Map(allOrgProfiles.map((p) => [p.id, p])).values()
      );

      return NextResponse.json({ data: uniqueProfiles });
    }

    // برای کاربر عادی: بازگرداندن اعضای همان سازمان
    const [userWs] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);

    if (userWs) {
      const orgMembers = await db
        .select({
          id: profiles.id,
          displayName: profiles.displayName,
          email: profiles.email,
          avatarUrl: profiles.avatarUrl,
          githubLogin: profiles.githubLogin,
          createdAt: profiles.createdAt,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        })
        .from(workspaceMembers)
        .innerJoin(profiles, eq(workspaceMembers.userId, profiles.id))
        .where(eq(workspaceMembers.workspaceId, userWs.workspaceId))
        .orderBy(desc(workspaceMembers.joinedAt));

      if (orgMembers.length > 0) {
        return NextResponse.json({ data: orgMembers });
      }
    }

    // بازگشت تمام پروفایل‌ها در صورت نبود دسته‌بندی خاص
    const fallbackProfiles = await db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        githubLogin: profiles.githubLogin,
        createdAt: profiles.createdAt,
        role: sql<string>`'member'`,
        joinedAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    return NextResponse.json({ data: fallbackProfiles });
  } catch (err) {
    console.warn("[members-api-error]", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const body = await request.json();

    if (!body.displayName && !body.email) {
      return NextResponse.json({ error: "نام یا ایمیل الزامی است." }, { status: 400 });
    }

    const newId = body.id || `m-${Date.now()}`;
    const [created] = await db
      .insert(profiles)
      .values({
        id: newId,
        displayName: body.displayName || body.name || body.email?.split("@")[0] || "عضو جدید",
        email: body.email,
        avatarUrl: body.avatarUrl || null,
        githubLogin: body.githubLogin || null,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          displayName: body.displayName || body.name,
          email: body.email,
          githubLogin: body.githubLogin || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("[create-member-error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ایجاد عضو" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    if (!session?.user?.id || !isUserAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");
    if (!memberId) {
      return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, memberId));
    await db.delete(profiles).where(eq(profiles.id, memberId));

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در حذف عضو" },
      { status: 500 }
    );
  }
}
