import { NextResponse } from "next/server";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { getIssueDetail } from "@/lib/db/queries/issue-detail";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; issueId: string }> }
) {
  try {
    const { projectId, issueId } = await params;
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
