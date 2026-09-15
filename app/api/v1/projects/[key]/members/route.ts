import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc, or, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectMembers, workspaceMembers, profiles, workspaces } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const rawKey = key || "PM";
    const normKey = rawKey.toUpperCase();

    // 1. یافتن یا اطمینان از وجود پروژه در دیتابیس
    let [project] = await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        workspaceId: projects.workspaceId,
      })
      .from(projects)
      .where(
        and(
          or(
            eq(projects.key, normKey),
            ilike(projects.key, rawKey)
          ),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) {
      // ایجاد پروژه در صورت نبودن در DB
      const [firstWs] = await db
        .select({ id: workspaces.id, ownerId: workspaces.ownerId })
        .from(workspaces)
        .limit(1);

      if (firstWs) {
        const [created] = await db
          .insert(projects)
          .values({
            key: normKey,
            name: normKey === "PM" ? "مدیریت پروژه RadarCheck" : `پروژه ${normKey}`,
            workspaceId: firstWs.id,
            ownerId: firstWs.ownerId,
          })
          .onConflictDoNothing()
          .returning();
        project = created;
      }
    }

    const projectId = project?.id;

    // ۲. دریافت اعضای تخصیص‌یافته به این پروژه
    let currentProjectMembers: {
      id: string;
      userId: string;
      role: "lead" | "contributor" | "viewer";
      joinedAt: Date | null;
      displayName: string;
      email: string | null;
      avatarUrl: string | null;
      githubLogin: string | null;
    }[] = [];

    if (projectId) {
      currentProjectMembers = await db
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
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(desc(projectMembers.createdAt));
    }

    const assignedUserIds = new Set(currentProjectMembers.map((m) => m.userId));
    const projectMemberRoles = new Map(currentProjectMembers.map((m) => [m.userId, m.role]));

    // ۳. دریافت کلیه اعضای ثبت‌نام شده در سامانه/سازمان جهت پیشنهاد هوشمند
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

    const mappedOrgMembers = allProfiles.map((p) => {
      const isAssigned = assignedUserIds.has(p.id);
      const assignedRole = projectMemberRoles.get(p.id) || "contributor";

      return {
        id: p.id,
        userId: p.id,
        displayName: p.displayName || p.email?.split("@")[0] || "کاربر سازمان",
        email: p.email || "",
        avatarUrl: p.avatarUrl,
        githubLogin: p.githubLogin,
        isAssignedToProject: isAssigned,
        projectRole: assignedRole,
      };
    });

    return NextResponse.json({
      project: project || { id: `p-${normKey}`, key: normKey, name: normKey },
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
    const rawKey = key || "PM";
    const normKey = rawKey.toUpperCase();

    // ۱. یافتن یا ایجاد پروژه
    let [project] = await db
      .select({
        id: projects.id,
        key: projects.key,
        workspaceId: projects.workspaceId,
      })
      .from(projects)
      .where(
        and(
          or(
            eq(projects.key, normKey),
            ilike(projects.key, rawKey)
          ),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) {
      const [firstWs] = await db.select({ id: workspaces.id, ownerId: workspaces.ownerId }).from(workspaces).limit(1);
      if (firstWs) {
        const [created] = await db
          .insert(projects)
          .values({
            key: normKey,
            name: normKey === "PM" ? "مدیریت پروژه RadarCheck" : `پروژه ${normKey}`,
            workspaceId: firstWs.id,
            ownerId: firstWs.ownerId,
          })
          .onConflictDoNothing()
          .returning();
        project = created;
      }
    }

    if (!project) {
      return NextResponse.json({ error: "خطا در ایجاد یا یافتن پروژه" }, { status: 500 });
    }

    const body = await request.json();

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

    // ۲. افزودن اعضای انتخاب شده به دیتابیس
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

    // ۳. اگر عضو جدیدی با ایمیل دستی اضافه شده باشد
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

    // ۴. Realtime Broadcast
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

    return NextResponse.json({ ok: true, message: "اعضا با موفقیت به پروژه اضافه شدند." });
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
    const rawKey = key || "PM";
    const normKey = rawKey.toUpperCase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          or(
            eq(projects.key, normKey),
            ilike(projects.key, rawKey)
          ),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (project) {
      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, project.id),
            eq(projectMembers.userId, userId)
          )
        );
    }

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

    return NextResponse.json({ ok: true, message: "عضو با موفقیت از پروژه خارج گردید." });
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
    const rawKey = key || "PM";
    const normKey = rawKey.toUpperCase();

    const body = await request.json();
    const { userId, role, githubLogin } = body;

    if (!userId) {
      return NextResponse.json({ error: "شناسه کاربر الزامی است." }, { status: 400 });
    }

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          or(
            eq(projects.key, normKey),
            ilike(projects.key, rawKey)
          ),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (project && role) {
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
      { error: err instanceof Error ? err.message : "خطا در ویرایش عضو" },
      { status: 500 }
    );
  }
}
