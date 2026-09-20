import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import {
  listProjectIssues,
  getIssueById,
  updateIssue,
} from "@/lib/db/queries";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
    await requireProjectRole(projectId, "viewer");
    const issues = await listProjectIssues(projectId);
    return NextResponse.json({ data: issues });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
    await requireProjectRole(projectId, "contributor");

    const body = await request.json();
    const { issueId, status } = z
      .object({
        issueId: z.string().uuid(),
        status: z.enum([
          "backlog",
          "todo",
          "in_progress",
          "in_review",
          "blocked",
          "done",
          "cancelled",
        ]),
      })
      .parse(body);

    const issue = await getIssueById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AuthError("ایشو در این پروژه یافت نشد.", 404);
    }

    const updated = await updateIssue(issueId, { status });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return errJson(err);
  }
}
