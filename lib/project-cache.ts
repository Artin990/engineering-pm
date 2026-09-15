// Shared Server In-Memory Cache for real-time project synchronization

export interface ProjectStateCacheItem {
  project: unknown;
  issues: unknown[];
  cycles: unknown[];
  milestones: unknown[];
  members: unknown[];
  activities: unknown[];
  isDeleted?: boolean;
  lastUpdated: number;
}

const globalForCache = globalThis as unknown as {
  serverProjectStateCache?: Map<string, ProjectStateCacheItem>;
};

export const serverProjectStateCache =
  globalForCache.serverProjectStateCache ?? new Map<string, ProjectStateCacheItem>();

if (process.env.NODE_ENV !== "production") {
  globalForCache.serverProjectStateCache = serverProjectStateCache;
}

export function invalidateProjectSyncCache(key: string) {
  const normKey = (key || "PM").toUpperCase();
  serverProjectStateCache.delete(normKey);
}
