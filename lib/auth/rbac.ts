import { eq, and, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  workspaceMembers,
  projectMembers,
  projects,
  type workspaceRoleEnum,
  type projectRoleEnum,
} from "@/lib/db/schema";
import { AuthError, getSession } from "./session";

export type WorkspaceRole = typeof workspaceRoleEnum.enumValues[number];
export type ProjectRole = typeof projectRoleEnum.enumValues[number];

// ترتیب سلسله‌مراتبی نقش‌ها (بزرگ‌تر = دسترسی بیشتر)
const WORKSPACE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

const PROJECT_RANK: Record<ProjectRole, number> = {
  lead: 3,
  contributor: 2,
  viewer: 1,
};

function rankAtLeast(
  actual: number,
  required: number,
  scope: string
): void {
  if (actual < required) {
    throw new AuthError(`دسترسی کافی در ${scope} ندارید.`, 403);
  }
}

/** نقش کاربر در workspace — null یعنی عضو نیست. */
export async function getWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return row?.role ?? null;
}

/** نقش کاربر در project — null یعنی عضو نیست. */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const [row] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  return row?.role ?? null;
}

/** بررسی عضویت workspace — اگر نیست 403 می‌اندازد. */
export async function requireWorkspaceRole(
  workspaceId: string,
  minRole: WorkspaceRole = "viewer"
): Promise<{ userId: string; role: WorkspaceRole }> {
  const { profileId: userId } = await getSession();
  const role = await getWorkspaceRole(userId, workspaceId);

  if (!role) {
    throw new AuthError("عضو این workspace نیستید.", 403);
  }

  rankAtLeast(WORKSPACE_RANK[role], WORKSPACE_RANK[minRole], "workspace");
  return { userId, role };
}

/**
 * بررسی عضویت project — اول مستقیم، بعد از طریق workspace.
 * اگر project در workspaceی باشد که کاربر admin/owner آن است، دسترسی دارد.
 */
export async function requireProjectRole(
  projectId: string,
  minRole: ProjectRole = "viewer"
): Promise<{ userId: string; role: ProjectRole }> {
  const { profileId: userId } = await getSession();

  const direct = await getProjectRole(userId, projectId);
  if (direct) {
    rankAtLeast(PROJECT_RANK[direct], PROJECT_RANK[minRole], "project");
    return { userId, role: direct };
  }

  // عضویت غیرمستقیم: owner/admin بودن در workspace پروژه
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) {
    throw new AuthError("پروژه یافت نشد.", 404);
  }

  const wsRole = await getWorkspaceRole(userId, project.workspaceId);
  if (wsRole === "owner" || wsRole === "admin") {
    return { userId, role: "lead" }; // معادل lead — بیشترین دسترسی لازم
  }

  throw new AuthError("عضو این project نیستید.", 403);
}

/** بررسی دسترسی بر اساس key پروژه (راحتی برای route های [key]). */
export async function requireProjectKeyRole(
  workspaceId: string,
  projectKey: string,
  minRole: ProjectRole = "viewer"
) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.key, projectKey.toUpperCase()),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!project) {
    throw new AuthError(`پروژه‌ای با کلید ${projectKey} یافت نشد.`, 404);
  }

  return requireProjectRole(project.id, minRole);
}
