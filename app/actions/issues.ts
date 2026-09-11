"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createProjectSchema,
  updateProjectSchema,
  type UpdateProjectFields,
  createIssueSchema,
  updateIssueSchema,
  createIssueDependencySchema,
  addCommentSchema,
  updateCommentSchema,
  addIssueAssigneeSchema,
  removeIssueAssigneeSchema,
  createLabelSchema,
} from "@/lib/validators";
import {
  createProject,
  updateProject,
  archiveProject,
  getProjectById,
  getIssueById,
  createIssue,
  updateIssue,
  archiveIssue,
  addIssueAssignee,
  removeIssueAssignee,
  addIssueDependency,
  listIssueDependencies,
  addIssueComment,
  listIssueComments,
  updateComment as updateCommentQuery,
  softDeleteComment,
  createLabel,
  setIssueLabels,
} from "@/lib/db/queries";
import { requireWorkspaceRole, requireProjectRole } from "@/lib/auth/rbac";
import { getSession, AuthError } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { resolveMentions } from "@/lib/activity/mentions";
import { notify } from "@/lib/notifications";
import { db } from "@/lib/db";
import { issueComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ActionResult } from "./errors";
import { toActionError } from "./errors";

// ============ Projects ============

export async function createProjectAction(input: unknown): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    const data = createProjectSchema.parse(input);

    // idempotency: اگر client قبلاً همین uuid را ساخته، همان را برمی‌گردانیم
    if (data.id) {
      const existing = await getProjectById(data.id);
      if (existing) return { ok: true, data: { id: existing.id, key: existing.key } };
    }

    await requireWorkspaceRole(data.workspaceId, "member");

    const session = await getSession();
    const project = await createProject(data.workspaceId, session.profileId, data);

    await logActivity({
      workspaceId: data.workspaceId,
      projectId: project.id,
      actorId: session.profileId,
      kind: "internal",
      verb: "created",
      entityType: "project",
      entityId: project.id,
      metadata: { name: project.name, key: project.key },
    });

    revalidatePath("/projects");
    return { ok: true, data: { id: project.id, key: project.key } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { projectId, ...updates } = updateProjectSchema.parse(input);
    await requireProjectRole(projectId, "lead");

    const project = await updateProject(projectId, updates as UpdateProjectFields);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    await logActivity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      verb: "updated",
      kind: "internal",
      entityType: "project",
      entityId: project.id,
      metadata: updates as Record<string, unknown>,
    });

    revalidatePath("/projects");
    return { ok: true, data: { id: project.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(input);
    await requireProjectRole(projectId, "lead");

    const project = await getProjectById(projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    await archiveProject(projectId);

    await logActivity({
      workspaceId: project.workspaceId,
      projectId,
      verb: "archived",
      kind: "internal",
      entityType: "project",
      entityId: projectId,
    });

    revalidatePath("/projects");
    return { ok: true, data: { id: projectId } };
  } catch (err) {
    return toActionError(err);
  }
}

const ADMIN_EMAILS_LIST = [
  "amiriartin185@gmil.com",
  "amiriartin185@gmail.com",
  "artinamiri185@gmail.com",
];

export async function deleteProjectAction(projectKeyOrId: string): Promise<ActionResult<{ success: boolean; key?: string }>> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { ok: false, error: "کاربر احراز هویت نشده است." };
    }

    const userEmail = user.email?.trim().toLowerCase() || "";
    const isAdmin = ADMIN_EMAILS_LIST.some((adm) => adm.toLowerCase() === userEmail);

    if (!isAdmin) {
      return { ok: false, error: "دسترسی غیرمجاز: تنها مدیرعامل و ادمین ارشد مجاز به حذف کامل پروژه هستند." };
    }

    const cleanTarget = (projectKeyOrId || "").trim();
    if (!cleanTarget) {
      return { ok: false, error: "شناسه یا کلید پروژه نامعتبر است." };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanTarget);

    // First attempt: Supabase RPC
    const { error: rpcErr } = await supabase.rpc("delete_project_by_key_or_id", {
      p_project_key: isUuid ? null : cleanTarget.toUpperCase(),
      p_project_id: isUuid ? cleanTarget : null,
    });

    if (rpcErr) {
      console.warn("[deleteProjectAction] RPC notice, falling back to Drizzle delete:", rpcErr);
    }

    // Fallback/Direct cleanup in Drizzle
    const { deleteProjectPermanently } = await import("@/lib/db/queries");
    await deleteProjectPermanently(cleanTarget);

    revalidatePath("/projects");
    return { ok: true, data: { success: true, key: cleanTarget } };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Issues ============

export async function createIssueAction(input: unknown): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    const data = createIssueSchema.parse(input);

    // idempotency: اگر کلاینت همین id را قبلاً ساخته، همان رکورد برمی‌گردد
    if (data.id) {
      const dup = await getIssueById(data.id);
      if (dup) return { ok: true, data: { id: dup.id, key: dup.key } };
    }

    const project = await getProjectById(data.projectId);
    if (!project) throw new AuthError("پروژه یافت نشد.", 404);

    await requireProjectRole(data.projectId, "contributor");
    const session = await getSession();

    const issue = await createIssue(data.projectId, project.key, session.profileId, data);

    await logActivity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      actorId: session.profileId,
      kind: "internal",
      verb: "created",
      entityType: "issue",
      entityId: issue.id,
      metadata: { key: issue.key, title: issue.title },
    });

    if (data.assigneeId && data.assigneeId !== session.profileId) {
      await notify({
        userId: data.assigneeId,
        type: "assigned",
        title: `تسک ${issue.key} به شما منتور شد`,
        body: issue.title,
        link: `/projects/${project.key}/issues/${issue.id}`,
        aggregateKey: issue.id,
      });
    }

    revalidatePath(`/projects/${project.key}/issues`);
    return { ok: true, data: { id: issue.id, key: issue.key } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateIssueAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { issueId, ...updates } = z
      .object({ issueId: z.string().uuid() })
      .extend(updateIssueSchema.shape)
      .parse(input);

    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");
    const session = await getSession();

    const issue = await updateIssue(issueId, updates);
    if (!issue) throw new AuthError("ایشو یافت نشد.", 404);

    await logActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      actorId: session.profileId,
      kind: "internal",
      verb: updates.status ? "status_changed" : "updated",
      entityType: "issue",
      entityId: issue.id,
      metadata: { key: issue.key, changes: updates },
    });

    revalidatePath(`/projects/${existing.projectKey}/issues`);
    return { ok: true, data: { id: issue.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveIssueAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { issueId } = z.object({ issueId: z.string().uuid() }).parse(input);
    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");

    await archiveIssue(issueId);

    await logActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      verb: "archived",
      kind: "internal",
      entityType: "issue",
      entityId: issueId,
    });

    revalidatePath(`/projects/${existing.projectKey}/issues`);
    return { ok: true, data: { id: issueId } };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Assignees ============

export async function addIssueAssigneeAction(input: unknown): Promise<ActionResult> {
  try {
    const { issueId, userId } = addIssueAssigneeSchema.parse(input);
    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");

    await addIssueAssignee(issueId, userId);

    await logActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      verb: "assigned",
      kind: "internal",
      entityType: "issue",
      entityId: issueId,
      metadata: { assigneeId: userId },
    });

    await notify({
      userId,
      type: "assigned",
      title: "تسک جدیدی به شما منتور شد",
      link: `/projects/${existing.projectKey}/issues/${issueId}`,
      aggregateKey: issueId,
    });

    revalidatePath(`/projects/${existing.projectKey}/issues`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeIssueAssigneeAction(input: unknown): Promise<ActionResult> {
  try {
    const { issueId, userId } = removeIssueAssigneeSchema.parse(input);
    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");

    await removeIssueAssignee(issueId, userId);
    revalidatePath(`/projects/${existing.projectKey}/issues`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Dependencies ============

export async function addIssueDependencyAction(input: unknown): Promise<ActionResult> {
  try {
    const { issueId, dependsOnId } = createIssueDependencySchema.parse(input);
    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");

    // بررسی دایره وابستگی: A→B و B→A ممنوع
    const deps = await listIssueDependencies(dependsOnId);
    if (deps.some((d) => d.dependsOnId === issueId)) {
      throw new AuthError("وابستگی دایره‌ای مجاز نیست.", 400);
    }

    await addIssueDependency(issueId, dependsOnId);

    await logActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      verb: "dependency_added",
      kind: "internal",
      entityType: "issue",
      entityId: issueId,
      metadata: { dependsOnId },
    });

    revalidatePath(`/projects/${existing.projectKey}/issues`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Comments ============

export async function addCommentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { issueId, body } = addCommentSchema.parse(input);
    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");
    const session = await getSession();

    const comment = await addIssueComment(issueId, session.profileId, body);

    await logActivity({
      workspaceId: existing.workspaceId,
      projectId: existing.projectId,
      actorId: session.profileId,
      kind: "internal",
      verb: "commented",
      entityType: "comment",
      entityId: comment.id,
      metadata: { issueId, issueKey: existing.issueKey },
    });

    // منشن‌ها → اعلان (ضداسپم: aggregation بر اساس issueId)
    const mentioned = await resolveMentions(body, existing.workspaceId, session.profileId);
    for (const userId of mentioned) {
      await notify({
        userId,
        type: "mentioned",
        title: `شما در ${existing.issueKey} منشن شدید`,
        body,
        link: `/projects/${existing.projectKey}/issues/${issueId}`,
        aggregateKey: issueId,
      });
    }

    revalidatePath(`/projects/${existing.projectKey}/issues/${issueId}`);
    return { ok: true, data: { id: comment.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateCommentAction(input: unknown): Promise<ActionResult> {
  try {
    const { commentId, body } = updateCommentSchema.parse(input);
    const session = await getSession();

    const issueId = await getIssueIdByComment(commentId);
    if (!issueId) throw new AuthError("کامنت یافت نشد.", 404);

    const comments = await listIssueComments(issueId);
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) throw new AuthError("کامنت یافت نشد.", 404);
    if (comment.authorId !== session.profileId) {
      throw new AuthError("فقط نویسنده می‌تواند کامنت را ویرایش کند.", 403);
    }

    await updateCommentQuery(commentId, body);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  try {
    const { commentId } = z.object({ commentId: z.string().uuid() }).parse(input);
    const session = await getSession();
    const issueId = await getIssueIdByComment(commentId);
    if (!issueId) throw new AuthError("کامنت یافت نشد.", 404);

    const existing = await getProjectForIssue(issueId);
    const { role } = await requireProjectRole(existing.projectId, "contributor");

    // نویسنده کامنت یا lead پروژه حق حذف دارد
    if (role !== "lead") {
      const comments = await listIssueComments(issueId);
      const comment = comments.find((c) => c.id === commentId);
      if (!comment || comment.authorId !== session.profileId) {
        throw new AuthError("فقط نویسنده یا lead پروژه می‌تواند کامنت را حذف کند.", 403);
      }
    }

    await softDeleteComment(commentId);
    revalidatePath(`/projects/${existing.projectKey}/issues/${issueId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Labels ============

export async function createLabelAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createLabelSchema.parse(input);
    await requireProjectRole(data.projectId, "contributor");

    const label = await createLabel(data.projectId, data.name, data.color);
    if (!label) throw new AuthError("لیبل تکراری است.", 409);

    return { ok: true, data: { id: label.id } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setIssueLabelsAction(input: unknown): Promise<ActionResult> {
  try {
    const { issueId, labelIds } = z
      .object({ issueId: z.string().uuid(), labelIds: z.array(z.string().uuid()) })
      .parse(input);

    const existing = await getProjectForIssue(issueId);
    await requireProjectRole(existing.projectId, "contributor");

    await setIssueLabels(issueId, labelIds);
    revalidatePath(`/projects/${existing.projectKey}/issues/${issueId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return toActionError(err);
  }
}

// ============ Helpers ============

async function getProjectForIssue(issueId: string) {
  const { getIssueById } = await import("@/lib/db/queries");
  const issue = await getIssueById(issueId);
  if (!issue) throw new AuthError("ایشو یافت نشد.", 404);

  const project = await getProjectById(issue.projectId);
  if (!project) throw new AuthError("پروژه یافت نشد.", 404);

  return {
    projectId: project.id,
    projectKey: project.key,
    workspaceId: project.workspaceId,
    issueKey: issue.key,
  };
}

async function getIssueIdByComment(commentId: string): Promise<string | null> {
  const [row] = await db
    .select({ issueId: issueComments.issueId })
    .from(issueComments)
    .where(eq(issueComments.id, commentId))
    .limit(1);
  return row?.issueId ?? null;
}
