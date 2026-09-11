import { NextResponse, type NextRequest } from "next/server";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, issues, cycles, milestones, projectMembers } from "@/lib/db/schema";
import { getProjectByKey } from "@/lib/db/queries/project";
import { getSession } from "@/lib/auth/session";

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

        const initialState = {
          project: proj,
          issues: projIssues,
          cycles: projCycles,
          milestones: projMilestones,
          members: [],
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
