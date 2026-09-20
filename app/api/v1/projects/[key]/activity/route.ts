import { NextResponse, type NextRequest } from "next/server";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { getProjectActivityFeed } from "@/lib/activity";
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
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
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
