"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  createCycleSchema,
  updateCycleSchema,
  createModuleSchema,
  upsertProjectMemberSchema,
} from "@/lib/validators";
import {
  getProjectById,
  createMilestoneInDb,
  updateMilestoneInDb,
  createModuleInDb,
  createCycleInDb,
  updateCycleInDb,
  addProjectMember,
  removeProjectMember,
} from "@/lib/db/queries";
import { requireProjectRole } from "@/lib/auth/rbac";
import { getSession, AuthError } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "./errors";
import { toActionError } from "./errors";

// ============ Milestones ============

export async function createMilestoneAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createMilestoneSchema.parse(input);
    await requireProjectRole(data.projectId, "contributor");
    const session = await getSession();

    const project = await getProjectById(data.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    const ms = await createMilestoneInDb(data.projectId, {
      title: data.title,
      description: data.description ?? null,
      targetDate: data.targetDate ?? null,
      order: data.order,
    });

    await logActivity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      actorId: session.profileId,
      kind: "internal",
      verb: "created",
      entityType: "milestone",
      entityId: ms.id,
      metadata: { title: ms.title },
    });

    revalidatePath(`/projects/${project.key}/milestones`);
    return { ok: true, data: { id: ms.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateMilestoneAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { milestoneId, ...updates } = updateMilestoneSchema.parse(input);

    const { db } = await import("@/lib/db");
    const { milestones } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [ms] = await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
    if (!ms) throw new AuthError("مایلستون یافت نشد.", 404);

    const project = await getProjectById(ms.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);
    await requireProjectRole(project.id, "contributor");

    const values: Record<string, unknown> = {};
    if (updates.title !== undefined) values.title = updates.title;
    if (updates.description !== undefined) values.description = updates.description;
    if (updates.status !== undefined) values.status = updates.status;
    if (updates.targetDate !== undefined) values.targetDate = updates.targetDate;
    if (updates.order !== undefined) values.order = updates.order;

    await updateMilestoneInDb(milestoneId, values);
    revalidatePath(`/projects/${project.key}/milestones`);
    return { ok: true, data: { id: milestoneId } };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Cycles ============

export async function createCycleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createCycleSchema.parse(input);
    await requireProjectRole(data.projectId, "contributor");
    const session = await getSession();

    const project = await getProjectById(data.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    const cycle = await createCycleInDb(data.projectId, {
      name: data.name,
      goal: data.goal ?? null,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    await logActivity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      actorId: session.profileId,
      kind: "internal",
      verb: "created",
      entityType: "cycle",
      entityId: cycle.id,
      metadata: { name: cycle.name },
    });

    revalidatePath(`/projects/${project.key}/cycles`);
    return { ok: true, data: { id: cycle.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCycleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { cycleId, ...updates } = updateCycleSchema.parse(input);

    const { db } = await import("@/lib/db");
    const { cycles } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) throw new AuthError("سایکل یافت نشد.", 404);

    const project = await getProjectById(cycle.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);
    await requireProjectRole(project.id, "contributor");

    const values: Record<string, unknown> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.goal !== undefined) values.goal = updates.goal;
    if (updates.startDate !== undefined) values.startDate = updates.startDate;
    if (updates.endDate !== undefined) values.endDate = updates.endDate;
    if (updates.status !== undefined) {
      values.status = updates.status;
      if (updates.status === "active") {
        await logActivity({
          workspaceId: project.workspaceId,
          projectId: project.id,
          kind: "internal",
          verb: "cycle_started",
          entityType: "cycle",
          entityId: cycleId,
        });
      }
      if (updates.status === "completed") {
        await logActivity({
          workspaceId: project.workspaceId,
          projectId: project.id,
          kind: "internal",
          verb: "cycle_completed",
          entityType: "cycle",
          entityId: cycleId,
        });
      }
    }

    await updateCycleInDb(cycleId, values);
    revalidatePath(`/projects/${project.key}/cycles`);
    return { ok: true, data: { id: cycleId } };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Modules ============

export async function createModuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createModuleSchema.parse(input);
    await requireProjectRole(data.projectId, "contributor");

    const mod = await createModuleInDb(data.projectId, data.name, data.description ?? null);
    return { ok: true, data: { id: mod.id } };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Project Members ============

export async function upsertProjectMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const data = upsertProjectMemberSchema.parse(input);
    await requireProjectRole(data.projectId, "lead");

    const project = await getProjectById(data.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    await addProjectMember(data.projectId, data.userId, data.role);
    revalidatePath(`/projects/${project.key}/settings`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeProjectMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const { projectId, userId } = z
      .object({ projectId: z.string().uuid(), userId: z.string().uuid() })
      .parse(input);
    await requireProjectRole(projectId, "lead");

    const project = await getProjectById(projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    await removeProjectMember(projectId, userId);
    revalidatePath(`/projects/${project.key}/settings`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}
