import { NextResponse } from "next/server";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { getIssueDetail } from "@/lib/db/queries/issue-detail";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, or, ilike } from "drizzle-orm";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProjectId(keyOrId: string): Promise<string> {
  if (UUID_REGEX.test(keyOrId)) return keyOrId;
  const [proj] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(or(eq(projects.key, keyOrId.toUpperCase()), ilike(projects.key, keyOrId)))
    .limit(1);
  return proj?.id || keyOrId;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string; issueId: string }> }
) {
  try {
    const { key, issueId } = await params;
    const projectId = await resolveProjectId(key);
    await requireProjectRole(projectId, "viewer");

    const detail = await getIssueDetail(issueId);
    if (!detail || detail.issue.projectId !== projectId) {
      return NextResponse.json({ error: "ایشو یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ data: detail });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api-issue-detail]", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
