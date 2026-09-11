"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type {
  Project,
  Issue,
  Member,
  Milestone,
  Cycle,
} from "@/components/features/types";
import { getProjectByKey } from "@/components/features/__fixtures__/mock-data";

interface ProjectStoreState {
  project: Project;
  issues: Issue[];
  cycles: Cycle[];
  milestones: Milestone[];
  members: Member[];
}

interface ProjectStoreContextValue {
  project: Project;
  issues: Issue[];
  cycles: Cycle[];
  milestones: Milestone[];
  members: Member[];
  addIssue: (issue: Issue) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  deleteIssue: (id: string) => void;
  addCycle: (cycle: Cycle) => void;
  updateCycle: (id: string, updates: Partial<Cycle>) => void;
  deleteCycle: (id: string) => void;
  addMilestone: (milestone: Milestone) => void;
  updateMilestone: (id: string, updates: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  addMember: (member: Member) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  updateProject: (updates: Partial<Project>) => void;
}

const ProjectStoreContext = createContext<ProjectStoreContextValue | undefined>(undefined);

const DEFAULT_MEMBERS: Member[] = [
  {
    id: "artin-1",
    displayName: "آرتین امیری",
    githubLogin: "artin-amiri",
    email: "artinamiri185@gmail.com",
    role: "admin",
    status: "active",
    joinedAt: "۱۴۰۳/۰۱/۱۵",
  },
];

export function ProjectStoreProvider({
  projectKey,
  children,
}: {
  projectKey: string;
  children: React.ReactNode;
}) {
  const normalizedKey = (projectKey || "PM").toUpperCase();
  const storageKey = `flowdeck_project_store_${normalizedKey}`;

  const [state, setState] = useState<ProjectStoreState>(() => {
    return {
      project: getProjectByKey(normalizedKey)!,
      issues: [],
      cycles: [],
      milestones: [],
      members: DEFAULT_MEMBERS,
    };
  });

  // Load from localStorage on mount or key change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setState((prev) => ({
            ...prev,
            project: { ...prev.project, ...(parsed.project || {}) },
            issues: Array.isArray(parsed.issues) ? parsed.issues : prev.issues,
            cycles: Array.isArray(parsed.cycles) ? parsed.cycles : prev.cycles,
            milestones: Array.isArray(parsed.milestones) ? parsed.milestones : prev.milestones,
            members: Array.isArray(parsed.members) && parsed.members.length > 0 ? parsed.members : DEFAULT_MEMBERS,
          }));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Save to localStorage when state changes
  const saveState = useCallback(
    (newState: ProjectStoreState) => {
      setState(newState);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch {
        // Storage quota or disabled
      }
    },
    [storageKey]
  );

  // Recalculate progress, cycles, milestones & counts
  const computedState = useMemo(() => {
    const validIssues = state.issues.filter((i) => i.status !== "cancelled");
    const totalPoints = validIssues.reduce((s, i) => s + (i.estimate || 1), 0);

    const weightOf = (s: string) =>
      s === "done" ? 1 : s === "in_review" ? 0.8 : s === "in_progress" ? 0.4 : 0;

    const earnedPoints = validIssues.reduce(
      (s, i) => s + (i.estimate || 1) * weightOf(i.status),
      0
    );

    const overallProgress = totalPoints > 0 ? earnedPoints / totalPoints : 0;

    // Counts
    const counts = {
      todo: validIssues.filter((i) => i.status === "todo").length,
      inProgress: validIssues.filter((i) => i.status === "in_progress").length,
      inReview: validIssues.filter((i) => i.status === "in_review").length,
      blocked: validIssues.filter((i) => i.status === "blocked").length,
      done: validIssues.filter((i) => i.status === "done").length,
      backlog: validIssues.filter((i) => i.status === "backlog").length,
      cancelled: state.issues.filter((i) => i.status === "cancelled").length,
    };

    // Cycles with calculated progress
    const cyclesWithProgress = state.cycles.map((c) => {
      const cycleIssues = validIssues.filter((i) => i.cycleId === c.id);
      const cycleTotal = cycleIssues.reduce((s, i) => s + (i.estimate || 1), 0);
      const cycleDone = cycleIssues
        .filter((i) => i.status === "done")
        .reduce((s, i) => s + (i.estimate || 1), 0);
      const prog = cycleTotal > 0 ? cycleDone / cycleTotal : c.progress || 0;
      return {
        ...c,
        totalEstimate: cycleTotal,
        doneEstimate: cycleDone,
        progress: prog,
      };
    });

    // Milestones with calculated status/progress
    const milestonesWithProgress = state.milestones.map((m) => {
      const mIssues = validIssues.filter((i) => i.milestoneId === m.id);
      const mTotal = mIssues.length;
      const mDone = mIssues.filter((i) => i.status === "done").length;
      return {
        ...m,
        status: (mTotal > 0 && mDone === mTotal ? "completed" : m.status) as Milestone["status"],
      };
    });

    const updatedProject: Project = {
      ...state.project,
      progress: overallProgress,
      counts,
      health: counts.blocked > 0 ? "at_risk" : "on_track",
      healthReason: counts.blocked > 0 ? `${counts.blocked} ایشوی بلاک‌شده وجود دارد` : "بدون ریسک شناسایی‌شده",
    };

    return {
      project: updatedProject,
      issues: state.issues,
      cycles: cyclesWithProgress,
      milestones: milestonesWithProgress,
      members: state.members,
    };
  }, [state]);

  // Sync updated project state to general flowdeck_projects_list
  useEffect(() => {
    try {
      const listSaved = localStorage.getItem("flowdeck_projects_list");
      const list: Project[] = listSaved ? JSON.parse(listSaved) : [];
      const idx = list.findIndex((p) => p.key === computedState.project.key);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...computedState.project };
        localStorage.setItem("flowdeck_projects_list", JSON.stringify(list));
      } else if (list.length > 0) {
        list.unshift(computedState.project);
        localStorage.setItem("flowdeck_projects_list", JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }, [computedState.project]);

  // Actions
  const addIssue = useCallback(
    (issue: Issue) => {
      const nextState: ProjectStoreState = {
        ...state,
        issues: [issue, ...state.issues],
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateIssue = useCallback(
    (id: string, updates: Partial<Issue>) => {
      const nextState: ProjectStoreState = {
        ...state,
        issues: state.issues.map((i) => (i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i)),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const deleteIssue = useCallback(
    (id: string) => {
      const nextState: ProjectStoreState = {
        ...state,
        issues: state.issues.filter((i) => i.id !== id),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const addCycle = useCallback(
    (cycle: Cycle) => {
      const nextState: ProjectStoreState = {
        ...state,
        cycles: [cycle, ...state.cycles],
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateCycle = useCallback(
    (id: string, updates: Partial<Cycle>) => {
      const nextState: ProjectStoreState = {
        ...state,
        cycles: state.cycles.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const deleteCycle = useCallback(
    (id: string) => {
      const nextState: ProjectStoreState = {
        ...state,
        cycles: state.cycles.filter((c) => c.id !== id),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const addMilestone = useCallback(
    (milestone: Milestone) => {
      const nextState: ProjectStoreState = {
        ...state,
        milestones: [...state.milestones, milestone],
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateMilestone = useCallback(
    (id: string, updates: Partial<Milestone>) => {
      const nextState: ProjectStoreState = {
        ...state,
        milestones: state.milestones.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const deleteMilestone = useCallback(
    (id: string) => {
      const nextState: ProjectStoreState = {
        ...state,
        milestones: state.milestones.filter((m) => m.id !== id),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const addMember = useCallback(
    (member: Member) => {
      const nextState: ProjectStoreState = {
        ...state,
        members: [...state.members, member],
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Member>) => {
      const nextState: ProjectStoreState = {
        ...state,
        members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const deleteMember = useCallback(
    (id: string) => {
      const nextState: ProjectStoreState = {
        ...state,
        members: state.members.filter((m) => m.id !== id),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateProject = useCallback(
    (updates: Partial<Project>) => {
      const nextState: ProjectStoreState = {
        ...state,
        project: { ...state.project, ...updates },
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  return (
    <ProjectStoreContext.Provider
      value={{
        ...computedState,
        addIssue,
        updateIssue,
        deleteIssue,
        addCycle,
        updateCycle,
        deleteCycle,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        addMember,
        updateMember,
        deleteMember,
        updateProject,
      }}
    >
      {children}
    </ProjectStoreContext.Provider>
  );
}

export function useProjectStore() {
  const context = useContext(ProjectStoreContext);
  if (!context) {
    const fallbackProject = getProjectByKey("PM")!;
    return {
      project: fallbackProject,
      issues: [],
      cycles: [],
      milestones: [],
      members: DEFAULT_MEMBERS,
      addIssue: () => {},
      updateIssue: () => {},
      deleteIssue: () => {},
      addCycle: () => {},
      updateCycle: () => {},
      deleteCycle: () => {},
      addMilestone: () => {},
      updateMilestone: () => {},
      deleteMilestone: () => {},
      addMember: () => {},
      updateMember: () => {},
      deleteMember: () => {},
      updateProject: () => {},
    };
  }
  return context;
}
