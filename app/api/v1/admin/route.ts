import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { projects, profiles, workspaces, issues } from "@/lib/db/schema";
import { eq, desc, isNull, count } from "drizzle-orm";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { getSession } from "@/lib/auth/session";
import { serverProjectStateCache } from "@/lib/project-cache";

export const dynamic = "force-dynamic";

const MASTER_PASSKEY = "RC-SUPERADMIN-2026";

async function isAuthorizedAdmin(request: NextRequest): Promise<boolean> {
  // 1. Check Passkey header
  const authHeader = request.headers.get("x-rc-admin-key") || request.nextUrl.searchParams.get("key");
  if (authHeader === MASTER_PASSKEY) {
    return true;
  }

  // 2. Check Cookie / Session
  try {
    const session = await getSession();
    if (session?.profileId) {
      const [prof] = await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, session.profileId))
        .limit(1);

      if (prof?.email && isUserAdminEmail(prof.email)) {
        return true;
      }
    }
  } catch {
    // Session check error
  }

  const roleCookie = request.cookies.get("flowdeck_active_role")?.value;
  const emailCookie = request.cookies.get("flowdeck_user_email")?.value;
  if (emailCookie && isUserAdminEmail(decodeURIComponent(emailCookie))) {
    return true;
  }
  if (roleCookie === "admin") {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز به پنل سوپرادمین RadarCheck." },
        { status: 403 }
      );
    }

    const t0 = Date.now();

    // 1. Fetch Workspaces
    const allWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        inviteCode: workspaces.inviteCode,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .where(isNull(workspaces.deletedAt))
      .orderBy(desc(workspaces.createdAt));

    // 2. Fetch Projects
    const allProjects = await db
      .select({
        id: projects.id,
        workspaceId: projects.workspaceId,
        key: projects.key,
        name: projects.name,
        status: projects.status,
        health: projects.health,
        archivedAt: projects.archivedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(desc(projects.createdAt));

    // 3. Fetch Profiles & Users
    const allProfiles = await db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        nationalId: profiles.nationalId,
        verificationStatus: profiles.verificationStatus,
        githubLogin: profiles.githubLogin,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));

    // 4. Fetch Issues metrics
    const [issueStats] = await db
      .select({
        total: count(issues.id),
      })
      .from(issues)
      .where(isNull(issues.deletedAt));

    const dbLatencyMs = Date.now() - t0;

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          totalWorkspaces: allWorkspaces.length,
          totalProjects: allProjects.length,
          totalUsers: allProfiles.length,
          totalIssues: Number(issueStats?.total) || 0,
          pendingCeoCount: allProfiles.filter((p) => p.nationalId && p.verificationStatus === "pending").length,
          dbLatencyMs,
          serverTimestamp: new Date().toISOString(),
        },
        workspaces: allWorkspaces,
        projects: allProjects,
        users: allProfiles,
      },
    });
  } catch (err) {
    console.error("[rc-admin api error]", err);
    return NextResponse.json(
      { error: "خطا در بارگذاری داده‌های سوپر ادمین" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json(
        { error: "دسترسی غیرمجاز" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    switch (action) {
      case "verify-ceo": {
        const { userId, status } = body;
        if (!userId) {
          return NextResponse.json({ error: "شناسه کاربر الزامی است" }, { status: 400 });
        }
        await db
          .update(profiles)
          .set({ verificationStatus: status || "verified", updatedAt: new Date() })
          .where(eq(profiles.id, userId));
        return NextResponse.json({ success: true, message: "وضعیت احراز هویت با موفقیت به‌روزرسانی شد." });
      }

      case "purge-cache": {
        serverProjectStateCache.clear();
        return NextResponse.json({ success: true, message: "حافظه کش سرور با موفقیت پاکسازی شد." });
      }

      case "toggle-project-archive": {
        const { projectId, archive } = body;
        if (!projectId) return NextResponse.json({ error: "شناسه پروژه الزامی است" }, { status: 400 });

        await db
          .update(projects)
          .set({
            archivedAt: archive ? new Date() : null,
            status: archive ? "archived" : "active",
            updatedAt: new Date(),
          })
          .where(eq(projects.id, projectId));

        return NextResponse.json({ success: true, message: `پروژه ${archive ? "بایگانی" : "فعال"} شد.` });
      }

      default:
        return NextResponse.json({ error: "عملیات ناشناخته" }, { status: 400 });
    }
  } catch (err) {
    console.error("[rc-admin action error]", err);
    return NextResponse.json(
      { error: "خطا در اجرای عملیات سوپرادمین" },
      { status: 500 }
    );
  }
}
