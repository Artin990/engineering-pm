"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import type {
  Project,
  Issue,
  Member,
  Milestone,
  Cycle,
  ActivityEvent,
} from "@/components/features/types";
import { getProjectByKey } from "@/components/features/__fixtures__/mock-data";
import { createClient } from "@/lib/supabase/client";

interface ProjectStoreState {
  project: Project;
  issues: Issue[];
  cycles: Cycle[];
  milestones: Milestone[];
  members: Member[];
  activities: ActivityEvent[];
}

interface ProjectStoreContextValue {
  project: Project;
  issues: Issue[];
  cycles: Cycle[];
  milestones: Milestone[];
  members: Member[];
  activities: ActivityEvent[];
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
  addActivity: (activity: Omit<ActivityEvent, "id" | "createdAt">) => void;
}

const ProjectStoreContext = createContext<ProjectStoreContextValue | undefined>(undefined);

const DEFAULT_MEMBERS: Member[] = [];

export function ProjectStoreProvider({
  projectKey,
  children,
}: {
  projectKey: string;
  children: React.ReactNode;
}) {
  const normalizedKey = (projectKey || "PM").toUpperCase();
  const storageKey = `radarcheck_project_store_${normalizedKey}`;

  const [state, setState] = useState<ProjectStoreState>(() => {
    return {
      project: getProjectByKey(normalizedKey)!,
      issues: [],
      cycles: [],
      milestones: [],
      members: DEFAULT_MEMBERS,
      activities: [],
    };
  });

  // Push updates to server for instant cross-device and live peer sync
  const pushToServer = useCallback(
    async (nextState: Partial<ProjectStoreState> & { isDeleted?: boolean }) => {
      try {
        await fetch(`/api/v1/projects/${normalizedKey}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextState),
        });

        const supabase = createClient();
        const channel = supabase.channel(`radarcheck_project_${normalizedKey}`);
        channel.send({
          type: "broadcast",
          event: "project_updated",
          payload: { key: normalizedKey, timestamp: Date.now() },
        });
      } catch {
        // ignore network error
      }
    },
    [normalizedKey]
  );

  const lastSyncTimestampRef = useRef<number>(0);

  // Load from localStorage & sync live with Server and Supabase Realtime Channel
  useEffect(() => {
    let mounted = true;

    // 1. Initial load from localStorage
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
            members: Array.isArray(parsed.members) ? parsed.members : [],
            activities: Array.isArray(parsed.activities) ? parsed.activities : [],
          }));
        }
      }
    } catch {
      // ignore
    }

    // 2. Fetch live state from Server
    async function syncFromServer() {
      try {
        const res = await fetch(`/api/v1/projects/${normalizedKey}/sync`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && mounted) {
            if (json.data.isDeleted) {
              if (typeof window !== "undefined") {
                window.location.href = `/projects?deleted=${encodeURIComponent(normalizedKey)}`;
              }
              return;
            }

            const incomingTime = Number(json.timestamp) || 0;
            if (incomingTime && incomingTime <= lastSyncTimestampRef.current) {
              return; // Data has not changed on server, skip re-render
            }
            if (incomingTime) {
              lastSyncTimestampRef.current = incomingTime;
            }

            setState((prev) => {
              let serverIssues = prev.issues;
              if (Array.isArray(json.data.issues)) {
                if (json.data.issues.length > 0) {
                  const issueMap = new Map<string, Issue>();
                  (json.data.issues as Issue[]).forEach((i) => {
                    if (i && i.id) issueMap.set(i.id, i);
                  });
                  prev.issues.forEach((i) => {
                    if (i && i.id && !issueMap.has(i.id)) issueMap.set(i.id, i);
                  });
                  serverIssues = Array.from(issueMap.values());
                } else if (prev.issues.length === 0) {
                  serverIssues = [];
                }
              }
              const serverCycles = Array.isArray(json.data.cycles) && json.data.cycles.length > 0 ? json.data.cycles : prev.cycles;
              const serverMilestones = Array.isArray(json.data.milestones) && json.data.milestones.length > 0 ? json.data.milestones : prev.milestones;
              const serverMembers = Array.isArray(json.data.members) && json.data.members.length > 0 ? json.data.members : prev.members;
              const serverActivities = Array.isArray(json.data.activities) && json.data.activities.length > 0 ? json.data.activities : prev.activities;
              const serverProject = json.data.project && Object.keys(json.data.project).length > 0 ? { ...prev.project, ...json.data.project } : prev.project;

              const merged = {
                project: serverProject,
                issues: serverIssues,
                cycles: serverCycles,
                milestones: serverMilestones,
                members: serverMembers,
                activities: serverActivities,
              };

              try {
                localStorage.setItem(storageKey, JSON.stringify(merged));
              } catch {
                // ignore
              }

              return merged;
            });
          }
        }
      } catch {
        // ignore
      }
    }

    syncFromServer();
    const pollInterval = setInterval(syncFromServer, 3000);

    // 3. Supabase Realtime Channel
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`radarcheck_project_${normalizedKey}`)
        .on("broadcast", { event: "project_updated" }, () => {
          if (mounted) syncFromServer();
        })
        .subscribe();

      return () => {
        mounted = false;
        clearInterval(pollInterval);
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {
        mounted = false;
        clearInterval(pollInterval);
      };
    }
  }, [normalizedKey, storageKey]);

  // Save to localStorage & push live to server
  const saveState = useCallback(
    (newState: ProjectStoreState) => {
      setState(newState);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      } catch {
        // Storage quota or disabled
      }
      pushToServer(newState);
    },
    [storageKey, pushToServer]
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

  // Sync updated project state to general radarcheck_projects_list
  useEffect(() => {
    try {
      const listSaved = localStorage.getItem("radarcheck_projects_list");
      const list: Project[] = listSaved ? JSON.parse(listSaved) : [];
      const idx = list.findIndex((p) => p.key === computedState.project.key);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...computedState.project };
        localStorage.setItem("radarcheck_projects_list", JSON.stringify(list));
      } else if (list.length > 0) {
        list.unshift(computedState.project);
        localStorage.setItem("radarcheck_projects_list", JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }, [computedState.project]);

  // Actions
  const addActivity = useCallback(
    (act: Omit<ActivityEvent, "id" | "createdAt">) => {
      const newEvent: ActivityEvent = {
        ...act,
        id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        activities: [newEvent, ...(state.activities || [])].slice(0, 100),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const addIssue = useCallback(
    (issue: Issue) => {
      const newAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        kind: "internal",
        verb: "created",
        entityType: "issue",
        title: `ایجاد ایشو ${issue.key}: ${issue.title}`,
        actor: issue.assignee || null,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        issues: [issue, ...state.issues],
        activities: [newAct, ...(state.activities || [])].slice(0, 100),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const updateIssue = useCallback(
    (id: string, updates: Partial<Issue>) => {
      const existing = state.issues.find((i) => i.id === id);
      let newAct: ActivityEvent | null = null;
      if (existing && updates.status && updates.status !== existing.status) {
        newAct = {
          id: `act-${Date.now()}`,
          kind: "internal",
          verb: updates.status === "done" ? "merged" : "updated",
          entityType: "issue",
          title: `تغییر وضعیت ${existing.key} به «${updates.status}»`,
          actor: existing.assignee || null,
          createdAt: new Date().toISOString(),
        };
      }
      const nextState: ProjectStoreState = {
        ...state,
        issues: state.issues.map((i) => (i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i)),
        activities: newAct ? [newAct, ...(state.activities || [])].slice(0, 100) : state.activities || [],
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const deleteIssue = useCallback(
    (id: string) => {
      const existing = state.issues.find((i) => i.id === id);
      const newAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        kind: "internal",
        verb: "closed",
        entityType: "issue",
        title: `حذف ایشو ${existing?.key || id}`,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        issues: state.issues.filter((i) => i.id !== id),
        activities: [newAct, ...(state.activities || [])].slice(0, 100),
      };
      saveState(nextState);
    },
    [state, saveState]
  );

  const addCycle = useCallback(
    (cycle: Cycle) => {
      const newAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        kind: "internal",
        verb: "opened",
        entityType: "cycle",
        title: `ایجاد سایکل کاری «${cycle.name}»`,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        cycles: [cycle, ...state.cycles],
        activities: [newAct, ...(state.activities || [])].slice(0, 100),
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
      const newAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        kind: "internal",
        verb: "created",
        entityType: "milestone",
        title: `ایجاد مایلستون «${milestone.title}»`,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        milestones: [...state.milestones, milestone],
        activities: [newAct, ...(state.activities || [])].slice(0, 100),
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
      const newAct: ActivityEvent = {
        id: `act-${Date.now()}`,
        kind: "internal",
        verb: "assigned",
        entityType: "member",
        title: `عضویت ${member.displayName} در تیم پروژه`,
        actor: member,
        createdAt: new Date().toISOString(),
      };
      const nextState: ProjectStoreState = {
        ...state,
        members: [...state.members, member],
        activities: [newAct, ...(state.activities || [])].slice(0, 100),
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
        activities: state.activities || [],
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
        addActivity,
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
      activities: [],
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
      addActivity: () => {},
    };
  }
  return context;
}

export function removeProjectFromLocalStorage(projectKey: string) {
  if (typeof window === "undefined") return;
  const normKey = (projectKey || "").toUpperCase();
  try {
    localStorage.removeItem(`radarcheck_project_store_${normKey}`);
    localStorage.removeItem(`radarcheck_project_store_${normKey}`);

    const keys = ["radarcheck_projects_list", "radarcheck_projects_list"];
    for (const k of keys) {
      const saved = localStorage.getItem(k);
      if (saved) {
        const list: Project[] = JSON.parse(saved);
        if (Array.isArray(list)) {
          const filtered = list.filter(
            (p) => p.key?.toUpperCase() !== normKey && p.id !== projectKey
          );
          localStorage.setItem(k, JSON.stringify(filtered));
        }
      }
    }

    // Broadcast server-side & realtime deletion
    fetch(`/api/v1/projects/${normKey}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeleted: true }),
    }).catch(() => {});

    try {
      const supabase = createClient();
      supabase.channel(`radarcheck_project_${normKey}`).send({
        type: "broadcast",
        event: "project_updated",
        payload: { isDeleted: true },
      });
      supabase.channel("radarcheck_projects_global").send({
        type: "broadcast",
        event: "projects_list_changed",
        payload: { deletedKey: normKey },
      });
    } catch {
      // ignore
    }
  } catch (err) {
    console.warn("[removeProjectFromLocalStorage] Error:", err);
  }
}
