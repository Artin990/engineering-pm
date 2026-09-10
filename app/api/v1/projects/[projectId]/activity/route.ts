import { NextResponse, type NextRequest } from "next/server";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { getProjectActivityFeed } from "@/lib/activity";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectRole(projectId, "viewer");

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Number(searchParams.get("limit")) || 20;

    const rows = await getProjectActivityFeed(projectId, { limit, cursor });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1]?.createdAt?.toISOString() ?? null : null;

    return NextResponse.json({ data, nextCursor });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api-error]", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
