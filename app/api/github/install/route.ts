/**
 * GitHub install callback — binds a GitHub App installation to the user's workspace.
 *
 * Flow:
 * 1. User clicks "Install GitHub App" on the github page → GitHub → app install screen
 * 2. GitHub redirects here: /api/github/install?installation_id=..&setup_action=..&state=<workspaceId>
 * 3. We upsert the installation row (workspaceId from state=workspaceId)
 * 4. Sync repos for the installation, then redirect to the projects page.
 */
import { NextResponse, type NextRequest } from "next/server";

import { upsertInstallation } from "@/lib/github/queries";
import { syncInstallationRepos } from "@/lib/github/sync";
import { getInstallationOctokit } from "@/lib/github/token";

export const dynamic = "force-dynamic";

interface InstallationPayload {
  account?: { login?: string; type?: string };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const workspaceId = url.searchParams.get("state");

  if (!workspaceId || !Number.isFinite(installationId) || installationId <= 0) {
    return NextResponse.json(
      { error: "missing installation_id or state (workspace)" },
      { status: 400 }
    );
  }

  // Fetch account info from GitHub via the new installation
  let accountLogin = String(installationId);
  let accountType = "User";
  try {
    const octokit = await getInstallationOctokit(installationId);
    const { data } = await octokit.rest.apps.getInstallation({
      installation_id: installationId,
    });
    const installation = data as unknown as InstallationPayload;
    accountLogin = installation.account?.login ?? String(installationId);
    accountType = installation.account?.type ?? "User";
  } catch (err) {
    console.error("[github-install] failed to fetch installation", err);
    return NextResponse.json(
      { error: "could not verify installation with GitHub" },
      { status: 502 }
    );
  }

  await upsertInstallation({
    workspaceId,
    installationId,
    accountLogin,
    accountType,
  });

  // Initial repo sync — best-effort, don't block the redirect
  try {
    await syncInstallationRepos(installationId);
  } catch (err) {
    console.error("[github-install] initial sync failed", err);
  }

  return NextResponse.redirect(new URL("/projects", url.origin));
}
