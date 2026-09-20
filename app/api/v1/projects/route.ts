import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { desc, isNull, eq, and, ilike } from "drizzle-orm";
import { AuthError, getSession, getOptionalSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, projects, profiles, projectMembers } from "@/lib/db/schema";
import { listWorkspaceProjects, createProject } from "@/lib/db/queries/project";

function errJson(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "ورودی نامعتبر" },
      { status: 400 }
    );
  }
  console.error("[api-error]", err);
  const errMsg = err instanceof Error ? err.message : "خطای سرور";
  return NextResponse.json({ error: errMsg }, { status: 500 });
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getOptionalSession();
    const userEmail = session?.user?.email ? session.user.email.trim().toLowerCase() : "";
    const userId = session?.profileId || session?.user?.id;
    const isAdmin = isUserAdminEmail(userEmail);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (workspaceId) {
      try {
        const projectList = await listWorkspaceProjects(workspaceId);
        return NextResponse.json({ data: projectList });
      } catch (dbErr) {
        console.warn("[db-query-warn]", dbErr);
        return NextResponse.json({ data: [] });
      }
    }

    // ۱. اگر کاربر مدیرعامل / ادمین است: کلیه پروژه‌های شرکت برای او نمایش داده می‌شود
    if (isAdmin || !session) {
      try {
        const allProjects = await db
          .select()
          .from(projects)
          .where(isNull(projects.deletedAt))
          .orderBy(desc(projects.createdAt));

        return NextResponse.json({ data: allProjects });
      } catch (dbErr) {
        console.warn("[db-list-warn]", dbErr);
        return NextResponse.json({ data: [] });
      }
    }

    // ۲. اگر کاربر عادی / عضو زیرمجموعه است:
    // تمام پروژه‌هایی که مستقیماً به کاربر اختصاص یافته‌اند بر اساس id یا email
    try {
      const candidateUserIds = new Set<string>();
      if (userId) candidateUserIds.add(userId);

      if (userEmail) {
        const profRows = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(ilike(profiles.email, userEmail));

        for (const prof of profRows) {
          if (prof.id) candidateUserIds.add(prof.id);
        }
      }

      const assignedList: (typeof projects.$inferSelect)[] = [];
      for (const cId of Array.from(candidateUserIds)) {
        const rows = await db
          .select({
            id: projects.id,
            workspaceId: projects.workspaceId,
            key: projects.key,
            name: projects.name,
            description: projects.description,
            status: projects.status,
            health: projects.health,
            targetDate: projects.targetDate,
            githubRepo: projects.githubRepo,
            ownerId: projects.ownerId,
            teamId: projects.teamId,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
            deletedAt: projects.deletedAt,
            archivedAt: projects.archivedAt,
            approvedBy: projects.approvedBy,
            successRate: projects.successRate,
          })
          .from(projectMembers)
          .innerJoin(projects, eq(projectMembers.projectId, projects.id))
          .where(and(eq(projectMembers.userId, cId), isNull(projects.deletedAt)))
          .orderBy(desc(projects.createdAt));

        assignedList.push(...rows);
      }

      const unique = Array.from(new Map(assignedList.map((p) => [p.id, p])).values());
      return NextResponse.json({ data: unique });
    } catch (memErr) {
      console.warn("[assigned-projects-err]", memErr);
      return NextResponse.json({ data: [] });
    }
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();

    if (!body.name || !body.key) {
      return NextResponse.json(
        { error: "نام و کلید پروژه الزامی است." },
        { status: 400 }
      );
    }

    const cleanKey = String(body.key).trim().toUpperCase();

    // 1. اطمینان از وجود پروفایل کاربر در دیتابیس (جلوگیری از خطای FK)
    try {
      await db
        .insert(profiles)
        .values({
          id: session.profileId,
          displayName: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "کاربر",
          email: session.user.email,
        })
        .onConflictDoNothing();
    } catch (pErr) {
      console.warn("[profile-upsert-warn]", pErr);
    }

    // 2. مشخص کردن یا ایجاد ورک‌اسپیس
    let workspaceId = body.workspaceId;
    if (!workspaceId) {
      try {
        const [ownerWs] = await db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.ownerId, session.profileId))
          .limit(1);

        if (ownerWs) {
          workspaceId = ownerWs.id;
        } else {
          const [firstWs] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
          if (firstWs) {
            workspaceId = firstWs.id;
          } else {
            const [newWs] = await db
              .insert(workspaces)
              .values({
                name: "سازمان مهندسی RadarCheck",
                slug: `radarcheck-ws-${Date.now()}`,
                ownerId: session.profileId,
              })
              .returning();
            workspaceId = newWs.id;

            await db
              .insert(workspaceMembers)
              .values({
                workspaceId: newWs.id,
                userId: session.profileId,
                role: "owner",
              })
              .onConflictDoNothing();
          }
        }
      } catch (wsErr) {
        console.warn("[workspace-resolve-warn]", wsErr);
      }
    }

    // 3. ثبت پروژه در دیتابیس
    try {
      const cleanRepo = body.githubRepo ? String(body.githubRepo).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") : null;
      const project = await createProject(workspaceId, session.profileId, {
        workspaceId,
        name: body.name.trim(),
        key: cleanKey,
        description: body.description?.trim() || null,
        targetDate: body.targetDate || null,
        githubRepo: cleanRepo,
      });

      // افزودن سازنده به عنوان Lead پروژه
      try {
        await db
          .insert(projectMembers)
          .values({
            projectId: project.id,
            userId: session.profileId,
            role: "lead",
          })
          .onConflictDoNothing();
      } catch {
        // ignore
      }

      return NextResponse.json({ data: project }, { status: 201 });
    } catch (createErr) {
      console.warn("[project-insert-warn]", createErr);
      const cleanRepo = body.githubRepo ? String(body.githubRepo).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") : null;
      const [existingPrj] = await db
        .select()
        .from(projects)
        .where(eq(projects.key, cleanKey))
        .limit(1);

      if (existingPrj) {
        return NextResponse.json({ data: existingPrj }, { status: 200 });
      }

      const [directCreated] = await db
        .insert(projects)
        .values({
          workspaceId,
          ownerId: session.profileId,
          key: cleanKey,
          name: body.name.trim(),
          description: body.description?.trim() || null,
          targetDate: body.targetDate || null,
          githubRepo: cleanRepo,
        })
        .returning();

      if (directCreated) {
        try {
          await db
            .insert(projectMembers)
            .values({
              projectId: directCreated.id,
              userId: session.profileId,
              role: "lead",
            })
            .onConflictDoNothing();
        } catch {
          // ignore
        }
      }

      return NextResponse.json({ data: directCreated }, { status: 201 });
    }
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    const adminEmails = [
      "amiriartin185@gmil.com",
      "amiriartin185@gmail.com",
      "artinamiri185@gmail.com",
    ];

    const userEmail = session.user.email?.toLowerCase() || "";
    if (!adminEmails.includes(userEmail)) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز: تنها مدیرعامل و ادمین ارشد مجاز به حذف پروژه هستند." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("key") || searchParams.get("id");

    if (!target) {
      return NextResponse.json({ error: "شناسه یا کلید پروژه مشخص نشده است." }, { status: 400 });
    }

    const { deleteProjectPermanently } = await import("@/lib/db/queries/project");
    await deleteProjectPermanently(target);

    return NextResponse.json({ ok: true, deleted: target });
  } catch (err) {
    return errJson(err);
  }
}
