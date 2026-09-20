import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isUserAdminEmail } from "@/lib/auth/admin-check";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/projects/[key]/archive
 * Archives a completed project after sign-off by CEO/Manager (US7).
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
    try {
      const body = await request.json();
      if (typeof body.successRate === "number") {
        successRate = body.successRate;
      }
    } catch {
      // Body is optional
    }

    const [updated] = await db
      .update(projects)
      .set({
        status: "archived",
        archivedAt: new Date(),
        approvedBy: session.profileId,
        successRate: successRate,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning();

    return NextResponse.json({
      ok: true,
      data: updated,
      message: "پروژه با موفقیت تایید و به بورد بایگانی منتقل گردید.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "خطای سرور در بایگانی پروژه";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
