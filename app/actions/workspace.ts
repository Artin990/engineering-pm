"use server";

import { z } from "zod";
import {
  createWorkspaceSchema,
  inviteWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
} from "@/lib/validators";
import {
  createWorkspace,
  upsertWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  createTeam,
  addTeamMember,
  removeTeamMember,
} from "@/lib/db/queries";
import { requireWorkspaceRole, getWorkspaceRole } from "@/lib/auth/rbac";
import { getSession, AuthError } from "@/lib/auth/session";
import type { ActionResult } from "./errors";
import { toActionError } from "./errors";

export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const data = createWorkspaceSchema.parse(input);
    await getSession(); // باید لاگین باشد

    const ws = await createWorkspace((await getSession()).profileId, data);
    return { ok: true, data: { id: ws.id, slug: ws.slug } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function inviteWorkspaceMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const data = inviteWorkspaceMemberSchema.parse(input);
    await requireWorkspaceRole(data.workspaceId, "admin"); // فقط admin/owner

    await upsertWorkspaceMember(data);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateWorkspaceMemberRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const data = updateWorkspaceMemberRoleSchema.parse(input);
    await requireWorkspaceRole(data.workspaceId, "admin");

    const targetRole = await getWorkspaceRole(data.userId, data.workspaceId);
    // جلوگیری از تغییر نقش owner توسط غیر-owner
    if (targetRole === "owner") {
      await requireWorkspaceRole(data.workspaceId, "owner");
    }

    await updateWorkspaceMemberRole(data.workspaceId, data.userId, data.role);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeWorkspaceMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const { workspaceId, userId } = z
      .object({ workspaceId: z.string().uuid(), userId: z.string().uuid() })
      .parse(input);
    await requireWorkspaceRole(workspaceId, "admin");

    const targetRole = await getWorkspaceRole(userId, workspaceId);
    if (targetRole === "owner") {
      throw new AuthError("owner قابل حذف نیست.", 403);
    }

    await removeWorkspaceMember(workspaceId, userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Teams ============

export async function createTeamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = z
      .object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1, "نام تیم الزامی است").max(255),
        description: z.string().max(5000).nullish(),
        leadId: z.string().uuid().nullish(),
      })
      .parse(input);
    await requireWorkspaceRole(data.workspaceId, "admin");

    const team = await createTeam(
      data.workspaceId,
      data.name,
      data.description ?? null,
      data.leadId ?? null
    );
    return { ok: true, data: { id: team.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addTeamMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        teamId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input);
    await requireWorkspaceRole(parsed.workspaceId, "admin");

    await addTeamMember(parsed.teamId, parsed.userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeTeamMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        teamId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input);
    await requireWorkspaceRole(parsed.workspaceId, "admin");

    await removeTeamMember(parsed.teamId, parsed.userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
