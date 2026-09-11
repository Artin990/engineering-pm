/**
 * Dynamic data fixtures for Flowdeck.
 * All arrays default to empty arrays so only real database / user-created data is shown.
 */

import type {
  Project,
  Issue,
  Member,
  Milestone,
  Cycle,
  PullRequest,
  Commit,
  ActivityEvent,
  Risk,
} from "@/components/features/types";

/* ── Clean Dynamic State (Empty by default) ─────────────────────────────────── */

export const members: Member[] = [];
export const issues: Issue[] = [];
export const milestones: Milestone[] = [];
export const cycles: Cycle[] = [];
export const pullRequests: PullRequest[] = [];
export const commits: Commit[] = [];
export const activityEvents: ActivityEvent[] = [];
export const risks: Risk[] = [];

export const MOCK_PROJECTS: Project[] = [];
export const MOCK_MEMBERS: Member[] = members;
export const MOCK_ISSUES: Issue[] = issues;
export const MOCK_CYCLES: Cycle[] = cycles;
export const MOCK_MILESTONES: Milestone[] = milestones;
export const MOCK_PULL_REQUESTS: PullRequest[] = pullRequests;
export const MOCK_COMMITS: Commit[] = commits;
export const MOCK_ACTIVITY: ActivityEvent[] = activityEvents;
export const MOCK_ACTIVITIES: ActivityEvent[] = activityEvents;
export const MOCK_RISKS: Risk[] = risks;

/* ── Project Scoped Query Helpers ────────────────────────────── */

export function getProjectByKey(key: string): Project | undefined {
  const found = MOCK_PROJECTS.find((p) => p.key.toUpperCase() === key.toUpperCase());
  if (found) return found;
  return {
    id: `p-${key.toLowerCase()}`,
    key: key.toUpperCase(),
    name: `پروژه ${key.toUpperCase()}`,
    description: "پروژه فعال در Flowdeck",
    status: "active",
    progress: 0,
    health: "on_track",
    healthReason: "بدون ریسک شناسایی‌شده",
    targetDate: null,
    counts: {
      done: 0,
      inProgress: 0,
      todo: 0,
      backlog: 0,
      blocked: 0,
      inReview: 0,
      cancelled: 0,
    },
    openPrs: 0,
    mergedPrs: 0,
    owner: {
      id: "admin-1",
      displayName: "آرتین امیری",
      avatarUrl: null,
    },
    teamName: "تیم مهندسی",
  };
}

export function getActiveCycleByProject(_projectKey: string): Cycle | undefined {
  return cycles[0];
}

export function getBurndownData(_projectKey?: string) {
  return [];
}

export function getIssuesByProject(_projectKey: string): Issue[] {
  return issues;
}

export function getMilestonesByProject(_projectKey: string): Milestone[] {
  return milestones;
}

export function getCyclesByProject(_projectKey: string): Cycle[] {
  return cycles;
}

export function getPullRequestsByProject(_projectKey: string): PullRequest[] {
  return pullRequests;
}

export function getCommitsByProject(_projectKey: string): Commit[] {
  return commits;
}

export function getActivityByProject(_projectKey: string): ActivityEvent[] {
  return activityEvents;
}

export function getRisksByProject(_projectKey: string): Risk[] {
  return risks;
}

export function getMembersByProject(_projectKey: string): Member[] {
  return members;
}
