import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, issues, cycles, milestones, projectMembers, profiles } from "@/lib/db/schema";
import { serverProjectStateCache } from "@/lib/project-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    // Try reading fresh state from DB
    try {
      const [proj] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
        .limit(1);

      if (proj) {
        const cached = serverProjectStateCache.get(normKey);
        // Fetch authoritative issues from DB table `issues` joined with `profiles` for assignees
        const dbIssues = await db
          .select({
            id: issues.id,
            key: issues.key,
            title: issues.title,
            description: issues.description,
            status: issues.status,
            priority: issues.priority,
            type: issues.type,
            estimate: issues.estimate,
            dueDate: issues.dueDate,
            cycleId: issues.cycleId,
            milestoneId: issues.milestoneId,
            assigneeId: issues.assigneeId,
            createdAt: issues.createdAt,
            updatedAt: issues.updatedAt,
            assigneeName: profiles.displayName,
            assigneeEmail: profiles.email,
            assigneeAvatar: profiles.avatarUrl,
            assigneeGithub: profiles.githubLogin,
          })
          .from(issues)
          .leftJoin(profiles, eq(issues.assigneeId, profiles.id))
          .where(and(eq(issues.projectId, proj.id), isNull(issues.deletedAt)))
          .orderBy(desc(issues.createdAt));

        const mappedDbIssues = dbIssues.map((iss) => ({
          id: iss.id,
          key: iss.key,
          title: iss.title,
          description: iss.description || undefined,
          status: iss.status,
          priority: iss.priority,
          type: iss.type,
          estimate: iss.estimate || 1,
          dueDate: iss.dueDate || undefined,
          cycleId: iss.cycleId || undefined,
          milestoneId: iss.milestoneId || undefined,
          assignee: iss.assigneeId
            ? {
                id: iss.assigneeId,
                displayName: iss.assigneeName || iss.assigneeEmail?.split("@")[0] || "عضو تیم",
                email: iss.assigneeEmail || "",
                avatarUrl: iss.assigneeAvatar || null,
                githubLogin: iss.assigneeGithub || null,
                role: "member" as const,
                status: "active" as const,
                joinedAt: "امروز",
              }
            : null,
          labels: [
            {
              id: `lbl-${iss.type}`,
              name: iss.type === "bug" ? "باگ" : iss.type === "feature" ? "ویژگی" : "وظیفه",
              color: iss.type === "bug" ? "#ef4444" : iss.type === "feature" ? "#3b82f6" : "#8b5cf6",
            },
          ],
          createdAt: iss.createdAt ? iss.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: iss.updatedAt ? iss.updatedAt.toISOString() : new Date().toISOString(),
          prCount: 0,
          prOpenCount: 0,
        }));

        // Merge DB issues with in-memory cached issues
        const issueMap = new Map<string, typeof mappedDbIssues[number]>();
        mappedDbIssues.forEach((i) => issueMap.set(i.id, i));
        if (cached && Array.isArray(cached.issues)) {
          (cached.issues as typeof mappedDbIssues).forEach((i) => {
            if (i && i.id) issueMap.set(i.id, i);
          });
        }
        const projIssues = Array.from(issueMap.values());

        const projCycles = cached && Array.isArray(cached.cycles) && cached.cycles.length > 0
          ? cached.cycles
          : await db
              .select()
              .from(cycles)
              .where(and(eq(cycles.projectId, proj.id), isNull(cycles.deletedAt)));

        const projMilestones = cached && Array.isArray(cached.milestones) && cached.milestones.length > 0
          ? cached.milestones
          : await db
              .select()
              .from(milestones)
              .where(and(eq(milestones.projectId, proj.id), isNull(milestones.deletedAt)));

        // Always fetch authoritative members directly from Supabase project_members
        const projMembers = await db
          .select({
            id: projectMembers.id,
            userId: projectMembers.userId,
            role: projectMembers.role,
            displayName: profiles.displayName,
            email: profiles.email,
            githubLogin: profiles.githubLogin,
          })
          .from(projectMembers)
          .leftJoin(profiles, eq(projectMembers.userId, profiles.id))
          .where(eq(projectMembers.projectId, proj.id));

        const mappedMembers = projMembers.map((pm) => ({
          id: pm.userId || pm.id,
          displayName: pm.displayName || pm.email?.split("@")[0] || "عضو تیم",
          email: pm.email || "",
          githubLogin: pm.githubLogin || null,
          role: pm.role || "member",
          status: "active",
          joinedAt: "امروز",
        }));

        const freshState = {
          project: cached?.project || proj,
          issues: projIssues,
          cycles: projCycles,
          milestones: projMilestones,
          members: mappedMembers,
          activities: cached?.activities || [],
          isDeleted: false,
          lastUpdated: Date.now(),
        };

        serverProjectStateCache.set(normKey, freshState);
        return NextResponse.json({ data: freshState, timestamp: freshState.lastUpdated });
      }
    } catch {
      // Fallback to cache if DB temporarily unavailable
    }

    const cached = serverProjectStateCache.get(normKey);
    if (cached) {
      return NextResponse.json({
        data: cached,
        timestamp: cached.lastUpdated,
      });
    }

    return NextResponse.json({
      data: null,
      message: "No server sync state recorded yet.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();
    const body = await request.json();

    const current = serverProjectStateCache.get(normKey) || {
      project: {},
      issues: [],
      cycles: [],
      milestones: [],
      members: [],
      activities: [],
      isDeleted: false,
      lastUpdated: Date.now(),
    };

    const updatedState = {
      ...current,
      ...(body.project ? { project: body.project } : {}),
      ...(Array.isArray(body.issues) ? { issues: body.issues } : {}),
      ...(Array.isArray(body.cycles) ? { cycles: body.cycles } : {}),
      ...(Array.isArray(body.milestones) ? { milestones: body.milestones } : {}),
      ...(Array.isArray(body.members) ? { members: body.members } : {}),
      ...(Array.isArray(body.activities) ? { activities: body.activities } : {}),
      ...(typeof body.isDeleted === "boolean" ? { isDeleted: body.isDeleted } : {}),
      lastUpdated: Date.now(),
    };

    serverProjectStateCache.set(normKey, updatedState);

    // Persist members to DB table `project_members` if project exists in DB
    if (Array.isArray(body.members) && body.members.length > 0) {
      try {
        const [proj] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
          .limit(1);

        if (proj) {
          for (const m of body.members) {
            if (!m) continue;
            try {
              let targetUserId: string | null = null;
              if (m.id && typeof m.id === "string" && !m.id.startsWith("mem-")) {
                targetUserId = m.id;
              } else if (m.email) {
                const [prof] = await db
                  .select({ id: profiles.id })
                  .from(profiles)
                  .where(eq(profiles.email, m.email))
                  .limit(1);
                if (prof) targetUserId = prof.id;
              }

              if (targetUserId) {
                const rawRole = String(m.role || "contributor").toLowerCase();
                const dbRole =
                  rawRole === "admin" || rawRole === "lead"
                    ? ("lead" as const)
                    : rawRole === "intern" || rawRole === "viewer"
                    ? ("viewer" as const)
                    : ("contributor" as const);

                await db
                  .insert(projectMembers)
                  .values({
                    projectId: proj.id,
                    userId: targetUserId,
                    role: dbRole,
                  })
                  .onConflictDoUpdate({
                    target: [projectMembers.projectId, projectMembers.userId],
                    set: { role: dbRole, updatedAt: new Date() },
                  });
              }
            } catch {
              // Ignore single member insert note
            }
          }
        }
      } catch {
        // Ignore DB update note
      }
    }

    // Persist issues to DB table `issues` if project exists in DB
    if (Array.isArray(body.issues) && body.issues.length > 0) {
      try {
        const [proj] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
          .limit(1);

        if (proj) {
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const validStatuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"] as const;
          const validPriorities = ["urgent", "high", "medium", "low", "none"] as const;
          const validTypes = ["task", "bug", "feature", "improvement", "chore", "research"] as const;

          for (const iss of body.issues) {
            if (!iss || !iss.title) continue;
            try {
              const issueId = iss.id && UUID_REGEX.test(iss.id) ? iss.id : crypto.randomUUID();
              const status = validStatuses.includes(iss.status) ? iss.status : "todo";
              const priority = validPriorities.includes(iss.priority) ? iss.priority : "medium";
              const type = validTypes.includes(iss.type) ? iss.type : "feature";

              let targetAssigneeId: string | null = null;
              if (iss.assignee?.id && UUID_REGEX.test(iss.assignee.id)) {
                targetAssigneeId = iss.assignee.id;
              } else if (iss.assignee?.email) {
                const [prof] = await db
                  .select({ id: profiles.id })
                  .from(profiles)
                  .where(eq(profiles.email, iss.assignee.email.toLowerCase()))
                  .limit(1);
                if (prof) targetAssigneeId = prof.id;
              }

              await db
                .insert(issues)
                .values({
                  id: issueId,
                  projectId: proj.id,
                  key: iss.key || `${normKey}-1`,
                  title: String(iss.title).slice(0, 500),
                  description: iss.description ? String(iss.description).slice(0, 10000) : null,
                  status,
                  priority,
                  type,
                  estimate: Number(iss.estimate) || 1,
                  dueDate: iss.dueDate ? String(iss.dueDate).slice(0, 10) : null,
                  assigneeId: targetAssigneeId,
                  cycleId: iss.cycleId && UUID_REGEX.test(iss.cycleId) ? iss.cycleId : null,
                  milestoneId: iss.milestoneId && UUID_REGEX.test(iss.milestoneId) ? iss.milestoneId : null,
                })
                .onConflictDoUpdate({
                  target: [issues.id],
                  set: {
                    title: String(iss.title).slice(0, 500),
                    description: iss.description ? String(iss.description).slice(0, 10000) : null,
                    status,
                    priority,
                    type,
                    estimate: Number(iss.estimate) || 1,
                    dueDate: iss.dueDate ? String(iss.dueDate).slice(0, 10) : null,
                    assigneeId: targetAssigneeId,
                    cycleId: iss.cycleId && UUID_REGEX.test(iss.cycleId) ? iss.cycleId : null,
                    milestoneId: iss.milestoneId && UUID_REGEX.test(iss.milestoneId) ? iss.milestoneId : null,
                    updatedAt: new Date(),
                  },
                });
            } catch (singleIssueErr) {
              console.warn("[sync] issue insert/update error:", singleIssueErr);
            }
          }
        }
      } catch (issueSyncErr) {
        console.warn("[sync] batch issues sync error:", issueSyncErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedState,
      timestamp: updatedState.lastUpdated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync post error" },
      { status: 500 }
    );
  }
}
