import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  workspaces,
  workspaceMembers,
  teams,
  teamMembers,
} from "@/lib/db/schema";
import type { CreateWorkspaceInput, InviteWorkspaceMemberInput } from "@/lib/validators";

// ---------- Workspaces ----------

export async function listUserWorkspaces(userId: string) {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logoUrl: workspaces.logoUrl,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(eq(workspaceMembers.userId, userId), isNull(workspaces.deletedAt))
    )
    .orderBy(desc(workspaces.createdAt));
}

export async function getWorkspaceBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getWorkspaceById(workspaceId: string) {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function createWorkspace(ownerId: string, input: CreateWorkspaceInput) {
  const [ws] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl ?? null,
      ownerId,
    })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId: ownerId,
    role: "owner",
  });

  return ws;
}

// ---------- Workspace Members ----------

export async function listWorkspaceMembers(workspaceId: string) {
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function upsertWorkspaceMember(input: InviteWorkspaceMemberInput) {
  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
    })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role: input.role },
    })
    .returning();
  return member;
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer"
) {
  const [updated] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .returning();
  return updated ?? null;
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );
}

// ---------- Teams ----------

export async function listTeams(workspaceId: string) {
  return db
    .select()
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), isNull(teams.deletedAt)));
}

export async function createTeam(workspaceId: string, name: string, description?: string | null, leadId?: string | null) {
  const [team] = await db
    .insert(teams)
    .values({
      workspaceId,
      name,
      description: description ?? null,
      leadId: leadId ?? null,
    })
    .returning();
  return team;
}

export async function addTeamMember(teamId: string, userId: string) {
  await db
    .insert(teamMembers)
    .values({ teamId, userId })
    .onConflictDoNothing();
}

export async function removeTeamMember(teamId: string, userId: string) {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
}
