/**
 * GitHub Integration — Aion CLI (Wave 2).
 * Re-exports all GitHub service modules.
 */
export {
  GITHUB_APP_ID,
  GITHUB_WEBHOOK_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_APP_SLUG,
  CRON_SECRET,
  getGitHubAppPrivateKey,
  isGithubConfigured,
  missingGithubEnvVars,
} from "./config";

export {
  createAppJwt,
  getInstallationAccessToken,
  getInstallationOctokit,
  getAppOctokit,
  clearInstallationToken,
} from "./token";

export { verifyWebhookSignature, safeCompare } from "./signature";
export { extractIssueKeys, extractIssueKeysFromBranch, firstIssueKey } from "./keys";
export { resolveAuthorId } from "./author";

export {
  syncRepos,
  syncInstallationRepos,
  syncRepo,
  syncPrsForRepo,
  syncBranchesForRepo,
  getInstallUrl,
  handleUninstall,
  backfillMissedEvents,
  withRetry,
} from "./sync";

export {
  autoLinkIssuePr,
  autoLinkBranch,
  suggestStatusForPr,
  suggestStatusFromEvent,
  listSuggestions,
  acceptSuggestion,
  rejectSuggestion,
} from "./links";

export {
  getInstallationByGithubId,
  getInstallationsByWorkspace,
  upsertInstallation,
  deleteInstallationByGithubId,
  listReposByWorkspace,
  listReposByInstallation,
  getRepoByGithubRepoId,
  getRepoById,
  upsertRepo,
  linkRepoToProject,
  upsertBranch,
  deleteBranch,
  insertCommitIgnore,
  commitExists,
  listCommitsByRepo,
  getPrByRepoAndNumber,
  getPrById,
  upsertPr,
  listPrsByRepo,
  insertReviewIgnore,
  reviewExists,
  insertLinkIfNew,
  getLinksByIssue,
  getPendingSuggestionsForProject,
  updateSuggestionState,
  getIssueByKey,
  getIssueById,
  updateIssueStatus,
  insertEventIfNew,
  markEventProcessed,
  markEventFailed,
  getPendingEvents,
  getFailedEvents,
  insertActivity,
  createNotification,
  notificationExistsByDedupe,
  getWorkspaceIdForInstallation,
  getProjectIdsForWorkspace,
} from "./queries";
