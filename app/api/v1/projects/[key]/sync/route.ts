import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, issues, cycles, milestones, projectMembers, profiles } from "@/lib/db/schema";

// Server In-Memory Cache for ultra-fast real-time synchronization between clients
const serverProjectStateCache = new Map<string, {
  project: unknown;
  issues: unknown[];
  cycles: unknown[];
  milestones: unknown[];
  members: unknown[];
  activities: unknown[];
  isDeleted?: boolean;
  lastUpdated: number;
}>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const normKey = (key || "PM").toUpperCase();

    const cached = serverProjectStateCache.get(normKey);
    if (cached) {
      return NextResponse.json({
        data: cached,
        timestamp: cached.lastUpdated,
      });
    }

    // Try reading from DB
    try {
      const [proj] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.key, normKey), isNull(projects.deletedAt)))
        .limit(1);

      if (proj) {
        const projIssues = await db
          .select()
          .from(issues)
          .where(eq(issues.projectId, proj.id))
          .orderBy(desc(issues.createdAt));

        const projCycles = await db
          .select()
          .from(cycles)
          .where(and(eq(cycles.projectId, proj.id), isNull(cycles.deletedAt)));

        const projMilestones = await db
          .select()
          .from(milestones)
          .where(and(eq(milestones.projectId, proj.id), isNull(milestones.deletedAt)));

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

        const initialState = {
          project: proj,
          issues: projIssues,
          cycles: projCycles,
          milestones: projMilestones,
          members: mappedMembers,
          activities: [],
          isDeleted: false,
          lastUpdated: Date.now(),
        };

        serverProjectStateCache.set(normKey, initialState);
        return NextResponse.json({ data: initialState, timestamp: initialState.lastUpdated });
      }
    } catch {
      // DB not ready or using fixture fallback
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
                  .onConflictDoNothing();
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
