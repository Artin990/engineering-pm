import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireWorkspaceRole } from "@/lib/auth/rbac";
import { AuthError, getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { listWorkspaceProjects, createProject } from "@/lib/db/queries";

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
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      // Return all projects visible to current user
      const session = await getSession();
      const allProjects = await db
        .select()
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, session.profileId));
      
      const wsId = allProjects[0]?.workspaces?.id;
      if (wsId) {
        const projects = await listWorkspaceProjects(wsId);
        return NextResponse.json({ data: projects });
      }
      return NextResponse.json({ data: [] });
    }
    await requireWorkspaceRole(workspaceId, "viewer");
    const projects = await listWorkspaceProjects(workspaceId);
    return NextResponse.json({ data: projects });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    let workspaceId = body.workspaceId;

    if (!workspaceId) {
      const [firstWs] = await db
        .select({ id: workspaces.id })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, session.profileId))
        .limit(1);

      if (firstWs) {
        workspaceId = firstWs.id;
      } else {
        const [newWs] = await db
          .insert(workspaces)
          .values({
            name: "ورک‌اسپیس من",
            slug: `ws-${Date.now()}`,
            ownerId: session.profileId,
          })
          .returning();
        workspaceId = newWs.id;
        await db.insert(workspaceMembers).values({
          workspaceId: newWs.id,
          userId: session.profileId,
          role: "owner",
        });
      }
    }

    const project = await createProject(workspaceId, session.profileId, {
      workspaceId,
      name: body.name,
      key: body.key,
      description: body.description,
      targetDate: body.targetDate,
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    return errJson(err);
  }
}

