import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc, or, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectMembers, workspaceMembers, profiles, workspaces, projectInvitations } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import { invalidateProjectSyncCache } from "@/lib/project-cache";
import { getOptionalSession, AuthError } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { getProjectRole } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

async function verifyCanManageMembers(projectDbId: string) {
  const session = await getOptionalSession();
  if (!session) {
    throw new AuthError("احراز هویت الزامی است.", 401);
  }
  const userEmail = session.user.email?.toLowerCase() || "";
  const isAdmin = isUserAdminEmail(userEmail);
  if (isAdmin) return session;

  const role = await getProjectRole(session.profileId, projectDbId);
  if (role !== "lead") {
    throw new AuthError("دسترسی غیرمجاز: تنها مدیرعامل یا لید پروژه مجاز به مدیریت اعضا هستند.", 403);
  }
  return session;
}

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
        or(
          eq(projects.key, normKey),
          ilike(projects.key, rawKey)
        )
      )
      .limit(1);

    if (project) {
      await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, project.id));
    } else {
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

    // ۲. دریافت اعضای تخصیص‌یافته به این پروژه با LEFT JOIN برای جلوگیری از حذف رکوردها
    let currentProjectMembers: {
      id: string;
      userId: string;
      role: "lead" | "contributor" | "viewer";
      joinedAt: Date | null;
      displayName: string | null;
      email: string | null;
      avatarUrl: string | null;
      githubLogin: string | null;
    }[] = [];

    // دریافت دعوت‌نامه‌های در انتظار این پروژه
    let currentInvitations: {
      id: string;
      email: string;
      role: "lead" | "contributor" | "viewer";
      createdAt: Date | null;
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
        .leftJoin(profiles, eq(projectMembers.userId, profiles.id))
        .where(eq(projectMembers.projectId, projectId))
        .orderBy(desc(projectMembers.createdAt));

      try {
        currentInvitations = await db
          .select({
            id: projectInvitations.id,
            email: projectInvitations.email,
            role: projectInvitations.role,
            createdAt: projectInvitations.createdAt,
          })
          .from(projectInvitations)
          .where(
            and(
              eq(projectInvitations.projectId, projectId),
              isNull(projectInvitations.acceptedAt)
            )
          )
          .orderBy(desc(projectInvitations.createdAt));
      } catch (invErr) {
        console.warn("[get-invitations-warn]", invErr);
      }
    }

    const assignedUserIds = new Set(currentProjectMembers.map((m) => m.userId));
    const assignedEmails = new Set(
      currentProjectMembers.map((m) => m.email?.toLowerCase().trim()).filter(Boolean) as string[]
    );
    const pendingEmails = new Set(
      currentInvitations.map((inv) => inv.email.toLowerCase().trim())
    );
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
      const normEmail = p.email ? p.email.toLowerCase().trim() : "";
      const isAssigned =
        assignedUserIds.has(p.id) ||
        (normEmail ? assignedEmails.has(normEmail) : false) ||
        (normEmail ? pendingEmails.has(normEmail) : false);

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

    // ادغام اعضای قطعی و دعوت‌نامه‌های ایمیلی
    const membersOutput = [
      ...currentProjectMembers.map((m) => ({
        id: m.userId,
        memberRecordId: m.id,
        userId: m.userId,
        displayName: m.displayName || m.email?.split("@")[0] || "عضو تیم",
        email: m.email || "",
        avatarUrl: m.avatarUrl,
        githubLogin: m.githubLogin,
        role: m.role,
        isPendingInvite: false,
        status: "active" as const,
        joinedAt: m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("fa-IR") : "امروز",
      })),
      ...currentInvitations
        .filter((inv) => !assignedEmails.has(inv.email.toLowerCase().trim()))
        .map((inv) => ({
          id: `inv-${inv.id}`,
          memberRecordId: inv.id,
          userId: `inv-${inv.id}`,
          displayName: inv.email.split("@")[0] || "کاربر دعوت‌شده",
          email: inv.email,
          avatarUrl: null,
          githubLogin: null,
          role: inv.role,
          isPendingInvite: true,
          status: "pending" as const,
          joinedAt: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("fa-IR") : "امروز",
        })),
    ];

    return NextResponse.json({
      project: project || { id: `p-${normKey}`, key: normKey, name: normKey },
      projectMembers: membersOutput,
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
        or(
          eq(projects.key, normKey),
          ilike(projects.key, rawKey)
        )
      )
      .limit(1);

    if (project) {
      await db.update(projects).set({ deletedAt: null }).where(eq(projects.id, project.id));
    } else {
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

    await verifyCanManageMembers(project.id);

    const body = await request.json();

    const rawUserIds = Array.isArray(body.userIds)
      ? body.userIds
      : body.userId
      ? [body.userId]
      : body.id
      ? [body.id]
      : [];

    const userIdsToAdd: string[] = rawUserIds.filter(Boolean);

    const rawRole = String(body.role || "contributor").toLowerCase();
    const dbRole: "lead" | "contributor" | "viewer" =
      rawRole === "admin" || rawRole === "lead"
        ? "lead"
        : rawRole === "intern" || rawRole === "viewer"
        ? "viewer"
        : "contributor";

    // ۲. افزودن اعضای انتخاب شده به دیتابیس با تطابق هوشمند و امن
    for (const uId of userIdsToAdd) {
      if (!uId) continue;
      const cleanTarget = String(uId).trim();
      const targetEmail = (body.email ? String(body.email).trim().toLowerCase() : "") || (cleanTarget.includes("@") ? cleanTarget.toLowerCase() : "");

      try {
        let existingProf: { id: string; email: string | null } | undefined;

        // جستجوی امن بر اساس UUID فقط در صورتی که ساختار UUID صحیح باشد
        if (isValidUuid(cleanTarget)) {
          const [byUuid] = await db
            .select({ id: profiles.id, email: profiles.email })
            .from(profiles)
            .where(eq(profiles.id, cleanTarget))
            .limit(1);
          existingProf = byUuid;
        }

        // اگر پیدا نشد و ایمیل موجود است، جستجو بر اساس ایمیل
        if (!existingProf && targetEmail) {
          const [byEmail] = await db
            .select({ id: profiles.id, email: profiles.email })
            .from(profiles)
            .where(ilike(profiles.email, targetEmail))
            .limit(1);
          existingProf = byEmail;
        }

        if (existingProf) {
          // کاربر در profiles ثبت شده است -> درج قطعی در projectMembers و workspaceMembers
          await db
            .insert(projectMembers)
            .values({
              projectId: project.id,
              userId: existingProf.id,
              role: dbRole,
            })
            .onConflictDoUpdate({
              target: [projectMembers.projectId, projectMembers.userId],
              set: { role: dbRole, updatedAt: new Date() },
            });

          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: project.workspaceId,
              userId: existingProf.id,
              role: dbRole === "lead" ? "owner" : "member",
            })
            .onConflictDoNothing();

          // در صورت وجود دعوت قبلی برای این کاربر، علامت زدن به عنوان پذیرفته‌شده
          if (existingProf.email) {
            await db
              .update(projectInvitations)
              .set({ acceptedAt: new Date(), status: "accepted" })
              .where(
                and(
                  eq(projectInvitations.projectId, project.id),
                  ilike(projectInvitations.email, existingProf.email.trim().toLowerCase())
                )
              );
          }
        } else if (targetEmail) {
          // کاربر هنوز حساب نساخته است -> درج یا بروزرسانی امن در projectInvitations
          const [existingInv] = await db
            .select({ id: projectInvitations.id })
            .from(projectInvitations)
            .where(
              and(
                eq(projectInvitations.projectId, project.id),
                ilike(projectInvitations.email, targetEmail)
              )
            )
            .limit(1);

          if (existingInv) {
            await db
              .update(projectInvitations)
              .set({ role: dbRole, status: "pending" })
              .where(eq(projectInvitations.id, existingInv.id));
          } else {
            await db
              .insert(projectInvitations)
              .values({
                projectId: project.id,
                email: targetEmail,
                role: dbRole,
                status: "pending",
              });
          }
        }
      } catch (err) {
        console.warn("[projectMembers insert error for " + uId + "]:", err);
      }
    }

    // ۳. اگر عضو جدیدی از طریق مودال با ایمیل دستی اضافه شده باشد
    if (userIdsToAdd.length === 0 && (body.email || body.displayName)) {
      const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : null;

      if (cleanEmail) {
        const [existingProf] = await db
          .select({ id: profiles.id, email: profiles.email })
          .from(profiles)
          .where(ilike(profiles.email, cleanEmail))
          .limit(1);

        if (existingProf) {
          await db
            .insert(projectMembers)
            .values({
              projectId: project.id,
              userId: existingProf.id,
              role: dbRole,
            })
            .onConflictDoUpdate({
              target: [projectMembers.projectId, projectMembers.userId],
              set: { role: dbRole, updatedAt: new Date() },
            });

          await db
            .insert(workspaceMembers)
            .values({
              workspaceId: project.workspaceId,
              userId: existingProf.id,
              role: dbRole === "lead" ? "owner" : "member",
            })
            .onConflictDoNothing();

          await db
            .update(projectInvitations)
            .set({ acceptedAt: new Date(), status: "accepted" })
            .where(
              and(
                eq(projectInvitations.projectId, project.id),
                ilike(projectInvitations.email, cleanEmail)
              )
            );
        } else {
          // ثبت یا بروزرسانی دعوت‌نامه معتبر در دیتابیس
          const [existingInv] = await db
            .select({ id: projectInvitations.id })
            .from(projectInvitations)
            .where(
              and(
                eq(projectInvitations.projectId, project.id),
                ilike(projectInvitations.email, cleanEmail)
              )
            )
            .limit(1);

          if (existingInv) {
            await db
              .update(projectInvitations)
              .set({ role: dbRole, status: "pending" })
              .where(eq(projectInvitations.id, existingInv.id));
          } else {
            await db
              .insert(projectInvitations)
              .values({
                projectId: project.id,
                email: cleanEmail,
                role: dbRole,
                status: "pending",
              });
          }
        }
      }
    }

    // ۴. Realtime Broadcast & Cache Invalidation
    invalidateProjectSyncCache(normKey);
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
      supabase.channel(`radarcheck_project_${normKey}_members_ui`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, message: "اعضا با موفقیت به پروژه اضافه شدند." });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
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
    const rawUserId = searchParams.get("userId") || searchParams.get("id");

    if (!rawUserId) {
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

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    await verifyCanManageMembers(project.id);

    // بررسی آیا دعوت‌نامه است
      if (rawUserId.startsWith("inv-")) {
        const invId = rawUserId.replace("inv-", "");
        if (isValidUuid(invId)) {
          await db
            .delete(projectInvitations)
            .where(
              and(
                eq(projectInvitations.projectId, project.id),
                eq(projectInvitations.id, invId)
              )
            );
        }
      } else if (rawUserId.includes("@")) {
        // حذف با ایمیل
        await db
          .delete(projectInvitations)
          .where(
            and(
              eq(projectInvitations.projectId, project.id),
              ilike(projectInvitations.email, rawUserId.trim().toLowerCase())
            )
          );
      } else if (isValidUuid(rawUserId)) {
        // حذف عضو دیتابیس
        await db
          .delete(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, project.id),
              eq(projectMembers.userId, rawUserId)
            )
          );

        // همچنین اگر دعوت‌نامه‌ای با این شناسه بود
        await db
          .delete(projectInvitations)
          .where(
            and(
              eq(projectInvitations.projectId, project.id),
              eq(projectInvitations.id, rawUserId)
            )
          );
      }

    invalidateProjectSyncCache(normKey);

    try {
      const supabase = createClient();
      supabase.channel("radarcheck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: { projectKey: normKey, action: "member_removed", userId: rawUserId },
      });
      supabase.channel(`radarcheck_project_${normKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
      supabase.channel(`radarcheck_project_${normKey}_members_ui`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: normKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, message: "عضو با موفقیت از پروژه خارج گردید." });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
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

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    await verifyCanManageMembers(project.id);

    if (role) {
      const rawRole = String(role).toLowerCase();
      const dbRole: "lead" | "contributor" | "viewer" =
        rawRole === "admin" || rawRole === "lead"
          ? "lead"
          : rawRole === "intern" || rawRole === "viewer"
          ? "viewer"
          : "contributor";

      if (String(userId).startsWith("inv-")) {
        const invId = String(userId).replace("inv-", "");
        if (isValidUuid(invId)) {
          await db
            .update(projectInvitations)
            .set({ role: dbRole })
            .where(
              and(
                eq(projectInvitations.projectId, project.id),
                eq(projectInvitations.id, invId)
              )
            );
        }
      } else if (isValidUuid(userId)) {
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
    }

    if (isValidUuid(userId) && typeof githubLogin === "string") {
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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "خطا در ویرایش عضو" },
      { status: 500 }
    );
  }
}

