import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, sql, or, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, workspaces, workspaceMembers } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    const isAdmin = isUserAdminEmail(userEmail);

    let targetWorkspaceId: string | null = null;

    if (isAdmin) {
      // یافتن ورک‌اسپیس اصلی مدیرعامل
      const [adminWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(
          or(
            userId ? eq(workspaces.ownerId, userId) : sql`false`,
            ilike(workspaces.name, "%RadarCheck%")
          )
        )
        .limit(1);

      if (adminWs) {
        targetWorkspaceId = adminWs.id;
      }
    } else if (userId) {
      // یافتن ورک‌اسپیس کاربر عادی
      const [userWs] = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, userId))
        .limit(1);

      if (userWs) {
        targetWorkspaceId = userWs.workspaceId;
      }
    }

    interface MemberRow {
      id: string;
      displayName: string;
      email: string | null;
      avatarUrl?: string | null;
      githubLogin?: string | null;
      createdAt?: Date | null;
      role?: string | null;
      joinedAt?: Date | null;
    }

    let membersList: MemberRow[] = [];

    if (targetWorkspaceId) {
      membersList = await db
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
        .where(eq(workspaceMembers.workspaceId, targetWorkspaceId))
        .orderBy(desc(workspaceMembers.joinedAt));
    }

    if (!membersList || membersList.length === 0) {
      const allProfs = await db
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

      membersList = allProfs.map((p) => ({
        id: p.id,
        displayName: p.displayName || p.email?.split("@")[0] || "کاربر سازمان",
        email: p.email,
        avatarUrl: p.avatarUrl,
        githubLogin: p.githubLogin,
        createdAt: p.createdAt,
        role: "member" as const,
        joinedAt: p.createdAt,
      }));
    }

    const uniqueMembers = Array.from(
      new Map(membersList.map((m) => [m.id, m])).values()
    );

    return NextResponse.json({ data: uniqueMembers });
  } catch (err) {
    console.warn("[members-api-error]", err);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    const isAdmin = isUserAdminEmail(userEmail);

    if (!isAdmin) {
      return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
    }

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

    // اتصال به ورک‌اسپیس ادمین
    const [adminWs] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        or(
          userId ? eq(workspaces.ownerId, userId) : sql`false`,
          ilike(workspaces.name, "%RadarCheck%")
        )
      )
      .limit(1);

    if (adminWs && created) {
      await db
        .insert(workspaceMembers)
        .values({
          workspaceId: adminWs.id,
          userId: created.id,
          role: (body.role as "admin" | "member" | "owner") || "member",
        })
        .onConflictDoNothing();
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

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در حذف عضو" },
      { status: 500 }
    );
  }
}
