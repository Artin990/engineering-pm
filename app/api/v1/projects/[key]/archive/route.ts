import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { db } from "@/lib/db";
import { projects, profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/client";
import { invalidateProjectSyncCache } from "@/lib/project-cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/projects/[key]/archive
 * Archives or restores a completed project by CEO / Employer (US7).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getSession();
    const resolvedParams = await params;
    const projectKey = resolvedParams.key.toUpperCase();

    // Find the project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.key, projectKey))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    const userEmail = session.user.email?.toLowerCase() || "";
    const isOwner = project.ownerId === session.profileId;
    const isAdmin = isUserAdminEmail(userEmail);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "تنها مدیرعامل یا کارفرما مجاز به تایید نهایی و بایگانی پروژه است." },
        { status: 403 }
      );
    }

    let successRate = 100;
    let action = "archive";

    try {
      const body = await request.json();
      if (typeof body.successRate === "number") {
        successRate = body.successRate;
      }
      if (body.action === "unarchive" || body.action === "restore" || body.status === "active") {
        action = "unarchive";
      }
    } catch {
      // Body is optional
    }

    const isRestore = action === "unarchive";

    let approverId: string | null = null;
    if (!isRestore && session.profileId) {
      try {
        const [existingProf] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.id, session.profileId))
          .limit(1);
        if (existingProf) {
          approverId = existingProf.id;
        } else if (project.ownerId) {
          approverId = project.ownerId;
        }
      } catch {
        approverId = project.ownerId || null;
      }
    }

    const [updated] = await db
      .update(projects)
      .set({
        status: isRestore ? "active" : "completed",
        archivedAt: isRestore ? null : new Date(),
        approvedBy: isRestore ? null : approverId,
        successRate: isRestore ? null : successRate,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    invalidateProjectSyncCache(projectKey);

    try {
      const supabase = createClient();
      supabase.channel("flowdeck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: {
          projectKey,
          action: isRestore ? "project_restored" : "project_completed",
          status: updated.status,
        },
      });
      supabase.channel(`flowdeck_project_${projectKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { key: projectKey, timestamp: Date.now() },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      data: updated,
      message: isRestore
        ? "پروژه با موفقیت به فهرست پروژه‌های فعال بازگردانده شد."
        : "پروژه با موفقیت تایید و به بخش تکمیل‌شده‌ها منتقل گردید.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطای سرور در بایگانی پروژه";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/projects/[key]/archive
 * Restores an archived project back to active.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getSession();
    const resolvedParams = await params;
    const projectKey = resolvedParams.key.toUpperCase();

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.key, projectKey))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "پروژه یافت نشد." }, { status: 404 });
    }

    const userEmail = session.user.email?.toLowerCase() || "";
    const isOwner = project.ownerId === session.profileId;
    const isAdmin = isUserAdminEmail(userEmail);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "تنها مدیرعامل مجاز به بازگردانی پروژه است." },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(projects)
      .set({
        status: "active",
        archivedAt: null,
        approvedBy: null,
        successRate: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    invalidateProjectSyncCache(projectKey);

    try {
      const supabase = createClient();
      supabase.channel("flowdeck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: { projectKey, action: "project_restored" },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      data: updated,
      message: "پروژه با موفقیت به پروژه‌های فعال بازگردانده شد.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطای سرور در بازگردانی پروژه";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

