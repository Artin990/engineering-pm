import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectMembers, workspaceMembers, profiles } from "@/lib/db/schema";
import { getOptionalSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    // 1. یافتن پروژه بر اساس کلید
    const [project] = await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        workspaceId: projects.workspaceId,
      })
      .from(projects)
      .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    // ۲. اعضای این پروژه
    const currentProjectMembers = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.createdAt,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        githubLogin: profiles.githubLogin,
      })
      .from(projectMembers)
      .innerJoin(profiles, eq(projectMembers.userId, profiles.id))
      .where(eq(projectMembers.projectId, project.id))
      .orderBy(desc(projectMembers.createdAt));

    // ۳. اعضای کل سازمان (ورک‌اسپیس) جهت انتخاب و انتساب سلکتیو
    const allOrgMembers = await db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        displayName: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        githubLogin: profiles.githubLogin,
      })
      .from(workspaceMembers)
      .innerJoin(profiles, eq(workspaceMembers.userId, profiles.id))
      .where(eq(workspaceMembers.workspaceId, project.workspaceId))
      .orderBy(desc(workspaceMembers.joinedAt));

    const assignedUserIds = new Set(currentProjectMembers.map((m) => m.userId));

    const mappedOrgMembers = allOrgMembers.map((om) => ({
      id: om.userId,
      userId: om.userId,
      displayName: om.displayName || om.email?.split("@")[0] || "عضو سازمان",
      email: om.email || "",
      avatarUrl: om.avatarUrl,
      githubLogin: om.githubLogin,
      orgRole: om.role,
      isAssignedToProject: assignedUserIds.has(om.userId),
    }));

    return NextResponse.json({
      project,
      projectMembers: currentProjectMembers.map((m) => ({
        id: m.userId,
        memberRecordId: m.id,
        userId: m.userId,
        displayName: m.displayName || m.email?.split("@")[0] || "عضو تیم",
        email: m.email || "",
        avatarUrl: m.avatarUrl,
        githubLogin: m.githubLogin,
        role: m.role,
        joinedAt: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("fa-IR") : "امروز",
      })),
      orgMembers: mappedOrgMembers,
    });
  } catch (err: unknown) {
    console.error("[get-project-members-error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در دریافت اعضا" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    const session = await getOptionalSession();
    const userEmail = session?.user?.email;
    const isAdmin = isUserAdminEmail(userEmail);

    // ۱. یافتن پروژه
    const [project] = await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        workspaceId: projects.workspaceId,
      })
      .from(projects)
      .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    const body = await request.json();

    // پشتیبانی از افزودن تک‌عضو یا چندین عضو همزمان (Batch assignment)
    const userIdsToAdd: string[] = Array.isArray(body.userIds)
      ? body.userIds
      : body.userId
      ? [body.userId]
      : [];

    const rawRole = String(body.role || "contributor").toLowerCase();
    const dbRole: "lead" | "contributor" | "viewer" =
      rawRole === "admin" || rawRole === "lead"
        ? "lead"
        : rawRole === "intern" || rawRole === "viewer"
        ? "viewer"
        : "contributor";

    // ۲. افزودن اعضای موجود با userId
    for (const uId of userIdsToAdd) {
      if (!uId) continue;
      await db
        .insert(projectMembers)
        .values({
          projectId: project.id,
          userId: uId,
          role: dbRole,
        })
        .onConflictDoUpdate({
          target: [projectMembers.projectId, projectMembers.userId],
          set: { role: dbRole, updatedAt: new Date() },
        });
    }

    // ۳. اگر عضو جدیدی با ایمیل/نام دعوت شده که هنوز در profiles نیست
    if (userIdsToAdd.length === 0 && (body.email || body.displayName)) {
      let targetUserId: string | null = null;
      if (body.email) {
        const [existingProf] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.email, body.email.trim()))
          .limit(1);
        if (existingProf) targetUserId = existingProf.id;
      }

      if (!targetUserId) {
        const newId = `m-${Date.now()}`;
        const [createdProf] = await db
          .insert(profiles)
          .values({
            id: newId,
            displayName: body.displayName || body.email?.split("@")[0] || "کاربر جدید",
            email: body.email || null,
            githubLogin: body.githubLogin || null,
          })
          .returning();

        if (createdProf) {
          targetUserId = createdProf.id;
          // عضویت در ورک‌اسپیس
          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: project.workspaceId,
              userId: createdProf.id,
              role: "member",
            })
            .onConflictDoNothing();
        }
      }

      if (targetUserId) {
        await db
          .insert(projectMembers)
          .values({
            projectId: project.id,
            userId: targetUserId,
            role: dbRole,
          })
          .onConflictDoUpdate({
            target: [projectMembers.projectId, projectMembers.userId],
            set: { role: dbRole, updatedAt: new Date() },
          });
      }
    }

    // ۴. ارسال پیام Realtime در کانال‌های سراسری و پروژه
    try {
      const supabase = createClient();
      supabase.channel("radarcheck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: { projectKey: normKey, action: "members_updated" },
      });
      supabase.channel(`radarcheck_project_${normKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, message: "اعضا با موفقیت به پروژه افزوده شدند." });
  } catch (err: unknown) {
    console.error("[post-project-members-error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در افزودن عضو به پروژه" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, project.id),
          eq(projectMembers.userId, userId)
        )
      );

    // ارسال پیام Realtime
    try {
      const supabase = createClient();
      supabase.channel("radarcheck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: { projectKey: normKey, action: "member_removed", userId },
      });
      supabase.channel(`radarcheck_project_${normKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, message: "عضو با موفقیت از پروژه حذف گردید." });
  } catch (err: unknown) {
    console.error("[delete-project-members-error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در حذف عضو از پروژه" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    const body = await request.json();
    const { userId, role, githubLogin } = body;

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    if (role) {
      const rawRole = String(role).toLowerCase();
      const dbRole: "lead" | "contributor" | "viewer" =
        rawRole === "admin" || rawRole === "lead"
          ? "lead"
          : rawRole === "intern" || rawRole === "viewer"
          ? "viewer"
          : "contributor";

      await db
        .update(projectMembers)
        .set({ role: dbRole, updatedAt: new Date() })
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, userId)
          )
        );
    }

    if (typeof githubLogin === "string") {
      await db
        .update(profiles)
        .set({ githubLogin: githubLogin.trim() || null, updatedAt: new Date() })
        .where(eq(profiles.id, userId));
    }

    try {
      const supabase = createClient();
      supabase.channel(`radarcheck_project_${normKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ویرایش نقش عضو" },
      { status: 500 }
    );
  }
}
