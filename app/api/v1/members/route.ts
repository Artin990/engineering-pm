import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/role-context";

export async function GET() {
  try {
    const session = await getSession();
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    const isAdmin = isUserAdminEmail(userEmail);

    if (userId && isAdmin) {
      // برای مدیرعامل: اعضای ورک‌اسپیس مدیرعامل یا کلیه پروفایل‌ها
      const [adminWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.ownerId, userId))
        .limit(1);

      if (adminWs) {
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
          .where(eq(workspaceMembers.workspaceId, adminWs.id))
          .orderBy(desc(workspaceMembers.joinedAt));

        if (orgMembers.length > 0) {
          return NextResponse.json({ data: orgMembers });
        }
      }
    } else if (userId) {
      // برای کاربر عادی: اعضای همان سازمانی که کاربر در آن عضو است
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
    }

    // بازگشت تمام پروفایل‌ها در صورت عدم تفکیک
    const allProfiles = await db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        githubLogin: profiles.githubLogin,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    return NextResponse.json({ data: allProfiles });
  } catch (err) {
    console.warn("[members-api-error]", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
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

    // اگر مدیرعامل است، به ورک‌اسپیس او نیز متصل شود
    if (session?.user?.id && isUserAdminEmail(session.user.email)) {
      const [adminWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.ownerId, session.user.id))
        .limit(1);

      if (adminWs && created) {
        await db
          .insert(workspaceMembers)
          .values({
            workspaceId: adminWs.id,
            userId: created.id,
            role: "member",
          })
          .onConflictDoNothing();
      }
    }

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
    const session = await getSession();
    if (!session?.user?.id || !isUserAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");
    if (!memberId) {
      return NextResponse.json({ error: "شناسه عضو الزامی است." }, { status: 400 });
    }

    const [adminWs] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (adminWs) {
      await db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, adminWs.id),
            eq(workspaceMembers.userId, memberId)
          )
        );
    } else {
      await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, memberId));
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در حذف عضو" },
      { status: 500 }
    );
  }
}
