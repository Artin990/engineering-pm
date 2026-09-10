import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspaceRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { listWorkspaceProjects } from "@/lib/db/queries";

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
      return NextResponse.json({ error: "workspaceId لازم است" }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, "viewer");
    const projects = await listWorkspaceProjects(workspaceId);
    return NextResponse.json({ data: projects });
  } catch (err) {
    return errJson(err);
  }
}
