import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import {
  listProjectIssues,
  getIssueById,
  updateIssue,
} from "@/lib/db/queries";

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
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectRole(projectId, "viewer");
    const issues = await listProjectIssues(projectId);
    return NextResponse.json({ data: issues });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
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
