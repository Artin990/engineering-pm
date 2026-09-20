import { eq, and, isNull, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import type { CreateProjectInput, UpdateProjectFields } from "@/lib/validators";

// ---------- Project CRUD ----------

export async function getProjectById(projectId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getProjectByKey(workspaceId: string, key: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.key, key),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function listWorkspaceProjects(workspaceId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));
}

export async function createProject(workspaceId: string, ownerId: string, input: CreateProjectInput) {
  const id = input.id ?? randomUUID();
  const [project] = await db
    .insert(projects)
    .values({
      id,
      workspaceId,
      ownerId,
      key: input.key.toUpperCase(),
      name: input.name,
      description: input.description ?? null,
      targetDate: input.targetDate ?? null,
      teamId: input.teamId ?? null,
      githubRepo: input.githubRepo ?? null,
    })
    .returning();

  // ۱. سازنده پروژه (مدیرعامل) به عنوان lead اضافه می‌شود
  await db.insert(projectMembers).values({
    projectId: project.id,
    userId: ownerId,
    role: "lead",
  });

  return project;
}

export async function updateProject(projectId: string, input: UpdateProjectFields) {
  const values: Record<string, unknown> = {};
  if (input.name !== undefined) values.name = input.name;
  if (input.description !== undefined) values.description = input.description;
  if (input.status !== undefined) values.status = input.status;
  if (input.health !== undefined) values.health = input.health;
  if (input.targetDate !== undefined) values.targetDate = input.targetDate;
  if (input.teamId !== undefined) values.teamId = input.teamId;

  if (Object.keys(values).length === 0) return await getProjectById(projectId);

  const [updated] = await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .returning();
  return updated ?? null;
}

export async function archiveProject(projectId: string, approvedBy?: string, successRate: number = 100) {
  const [archived] = await db
    .update(projects)
    .set({
      status: "archived",
      archivedAt: new Date(),
      approvedBy: approvedBy || null,
      successRate: successRate,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();
  return archived ?? null;
}

export async function deleteProjectPermanently(projectIdOrKey: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectIdOrKey);

  const [project] = isUuid
    ? await db.select().from(projects).where(eq(projects.id, projectIdOrKey)).limit(1)
    : await db.select().from(projects).where(eq(projects.key, projectIdOrKey.toUpperCase())).limit(1);

  if (!project) return null;

  const projectId = project.id;

  try {
    // Delete cascading references
    await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
  } catch (err) {
    console.error("[deleteProjectPermanently] Error:", err);
  }

  return project;
}

// ---------- Project Members ----------

export async function listProjectMembers(projectId: string) {
  return db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: "lead" | "contributor" | "viewer" = "contributor"
) {
  const [member] = await db
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { role },
    })
    .returning();
  return member;
}

export async function removeProjectMember(projectId: string, userId: string) {
  await db
    .delete(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))
    );
}
