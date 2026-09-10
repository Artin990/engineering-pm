/**
 * Link a GitHub repo to an internal project.
 * POST /api/github/repos/link  { repoId: number, projectId: string | null }
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectRole, requireWorkspaceRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubInstallations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getRepoByGithubRepoId, linkRepoToProject } from "@/lib/github/queries";

const LinkSchema = z.object({
  repoId: z.number().int().positive(),
  projectId: z.string().uuid().nullable(),
});

async function getWorkspaceIdForRepo(installationDbId: string): Promise<string | null> {
  const [inst] = await db
    .select({ workspaceId: githubInstallations.workspaceId })
    .from(githubInstallations)
    .where(eq(githubInstallations.id, installationDbId))
    .limit(1);
  return inst?.workspaceId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
    }

    const parsed = LinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "bad request" },
        { status: 400 }
      );
    }

    const repo = await getRepoByGithubRepoId(parsed.data.repoId);
    if (!repo) {
      return NextResponse.json({ error: "repo not found" }, { status: 404 });
    }

    if (parsed.data.projectId) {
      // Linking → must manage the target project
      await requireProjectRole(parsed.data.projectId, "lead");
    } else {
      // Unlinking → must manage the workspace that owns the installation
      const workspaceId = await getWorkspaceIdForRepo(repo.installationId);
      if (!workspaceId) {
        return NextResponse.json({ error: "installation not found" }, { status: 404 });
      }
      await requireWorkspaceRole(workspaceId, "admin");
    }

    const updated = await linkRepoToProject(repo.id, parsed.data.projectId);
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[github/repos/link]", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
