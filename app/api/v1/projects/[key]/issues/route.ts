import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectRole } from "@/lib/auth/rbac";
import { AuthError } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import {
  listProjectIssues,
  getIssueById,
  updateIssue,
  createIssue,
} from "@/lib/db/queries";
import { invalidateProjectSyncCache } from "@/lib/project-cache";

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

function errJson(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "ورودی نامعتبر" },
      { status: 400 }
    );
  }
  console.error("[api-error]", err);
  return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
    await requireProjectRole(projectId, "viewer");
    const issues = await listProjectIssues(projectId);
    return NextResponse.json({ data: issues });
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
    const { role } = await requireProjectRole(projectId, "contributor");

    const body = await request.json();
    const { issueId, status } = z
      .object({
        issueId: z.string().uuid(),
        status: z.enum([
          "backlog",
          "todo",
          "in_progress",
          "in_review",
          "blocked",
          "done",
          "cancelled",
        ]),
      })
      .parse(body);

    const issue = await getIssueById(issueId);
    if (!issue || issue.projectId !== projectId) {
      throw new AuthError("ایشو در این پروژه یافت نشد.", 404);
    }

    // Role check: Normal contributors (members) cannot move to done/cancelled
    const isEmployerOrLead = role === "lead";
    if (!isEmployerOrLead && (status === "done" || status === "cancelled")) {
      throw new AuthError(
        "تأیید نهایی و بستن تسک‌ها فقط در صلاحیت کارفرما است. لطفاً تسک را در وضعیت «در بازبینی» قرار دهید.",
        403
      );
    }

    // Role check: Normal contributors cannot modify an issue that is already in_review, done, or cancelled
    if (!isEmployerOrLead && (issue.status === "in_review" || issue.status === "done" || issue.status === "cancelled")) {
      throw new AuthError(
        "این تسک در مرحله بازبینی کارفرما قرار دارد و تعیین تکلیف مجدد آن فقط توسط کارفرما امکان‌پذیر است.",
        403
      );
    }

    const updated = await updateIssue(issueId, { status });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const projectId = await resolveProjectId(key);
    const session = await requireProjectRole(projectId, "contributor");

    const body = await request.json();
    const createSchema = z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1, "عنوان الزامی است").max(500),
      description: z.string().max(10000).optional(),
      status: z.enum([
        "backlog",
        "todo",
        "in_progress",
        "in_review",
        "blocked",
        "done",
        "cancelled",
      ]).default("todo"),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("medium"),
      type: z.enum(["task", "bug", "feature", "improvement", "chore", "research"]).default("feature"),
      estimate: z.number().int().min(0).default(1),
      dueDate: z.string().optional(),
      milestoneId: z.string().uuid().optional(),
      cycleId: z.string().uuid().optional(),
      assigneeId: z.string().uuid().optional(),
    });

    const validated = createSchema.parse(body);

    const [proj] = await db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!proj) throw new AuthError("پروژه یافت نشد.", 404);

    const issue = await createIssue(
      proj.id,
      proj.key,
      session.userId,
      {
        id: validated.id,
        projectId: proj.id,
        title: validated.title,
        description: validated.description,
        status: validated.status,
        priority: validated.priority,
        type: validated.type,
        estimate: validated.estimate,
        dueDate: validated.dueDate,
        milestoneId: validated.milestoneId,
        cycleId: validated.cycleId,
        assigneeId: validated.assigneeId,
      }
    );

    invalidateProjectSyncCache(proj.key);

    return NextResponse.json({ data: issue }, { status: 201 });
  } catch (err) {
    return errJson(err);
  }
}
