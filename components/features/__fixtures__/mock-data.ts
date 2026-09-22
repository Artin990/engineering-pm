/**
 * Dynamic data fixtures for FlowDeck.
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
  const cleanKey = key.toUpperCase();
  const found = MOCK_PROJECTS.find((p) => p.key.toUpperCase() === cleanKey);
  if (found) return found;

  // Check localStorage if available in browser
  if (typeof window !== "undefined") {
    try {
      // 1. Check individual project store
      const savedStore = localStorage.getItem(`flowdeck_project_store_${cleanKey}`);
      if (savedStore) {
        const parsed = JSON.parse(savedStore);
        if (parsed?.project?.name) {
          return parsed.project;
        }
      }
      // 2. Check general projects list
      const savedList = localStorage.getItem("flowdeck_projects_list");
      if (savedList) {
        const parsedList: Project[] = JSON.parse(savedList);
        const match = parsedList.find((p) => p.key.toUpperCase() === cleanKey);
        if (match) return match;
      }
    } catch {
      // ignore
    }
  }

  return {
    id: `p-${cleanKey.toLowerCase()}`,
    key: cleanKey,
    name: `پروژه ${cleanKey}`,
    description: "پروژه فعال در FlowDeck",
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
    owner: null,
    teamName: "تیم مهندسی",
  };
}

export function getActiveCycleByProject(_projectKey?: string): Cycle | undefined {
  void _projectKey;
  return cycles[0];
}

export function getBurndownData(_projectKey?: string) {
  void _projectKey;
  return [];
}

export function getIssuesByProject(_projectKey?: string): Issue[] {
  void _projectKey;
  return issues;
}

export function getMilestonesByProject(_projectKey?: string): Milestone[] {
  void _projectKey;
  return milestones;
}

export function getCyclesByProject(_projectKey?: string): Cycle[] {
  void _projectKey;
  return cycles;
}

export function getPullRequestsByProject(_projectKey?: string): PullRequest[] {
  void _projectKey;
  return pullRequests;
}

export function getCommitsByProject(_projectKey?: string): Commit[] {
  void _projectKey;
  return commits;
}

export function getActivityByProject(_projectKey?: string): ActivityEvent[] {
  void _projectKey;
  return activityEvents;
}

export function getRisksByProject(_projectKey?: string): Risk[] {
  void _projectKey;
  return risks;
}

export function getMembersByProject(_projectKey?: string): Member[] {
  void _projectKey;
  return members;
}
