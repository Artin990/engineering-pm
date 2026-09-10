# GitHub App Setup

This project uses a **GitHub App** (not OAuth, not PAT) to integrate with GitHub.

## 1. Create the GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
2. Set:
   - **GitHub App name**: `aion-engineering-pm` (or anything; remember the **slug** for `GITHUB_APP_SLUG`)
   - **Homepage URL**: your app URL (e.g. `https://your-app.vercel.app`)
   - **Webhook URL**: `https://your-app.vercel.app/api/webhooks/github`
   - **Webhook secret**: generate a random string (min 20 chars) → `GITHUB_WEBHOOK_SECRET`
3. Permissions (repository):
   - **Contents**: Read-only
   - **Issues**: Read-only
   - **Metadata**: Read-only (mandatory)
   - **Pull requests**: Read-only
4. Events (subscribe to):
   - `Installation`
   - `Installation repositories`
   - `Push`
   - `Pull request`
   - `Pull request review`
   - `Issue comment` (optional — enables task-completion auto-scoring in future waves)
5. **Where can this GitHub App be installed?**: Any account (for testing) or your org
6. Create the app, then:
   - Copy the **App ID** → `GITHUB_APP_ID`
   - Generate a **private key** (`.pem`) → paste contents into `GITHUB_APP_PRIVATE_KEY`
     (newlines as real `\n` in `.env.local`, or literal `\n` — both are handled)
   - Note the **slug** (from the app's public URL `github.com/apps/<slug>`) → `GITHUB_APP_SLUG`

## 2. Environment variables

```bash
# GitHub App (server-side, required)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_APP_SLUG=<your-app-slug>

# Cron (required for Vercel scheduled sync)
CRON_SECRET=<random-32-char-string>

# GitHub OAuth for user identity linking (optional)
# Found in GitHub App settings → General → Client secrets
GITHUB_CLIENT_ID=<your-app-client-id>
GITHUB_CLIENT_SECRET=<your-app-client-secret>
```

Add `CRON_SECRET` as a `Authorization: Bearer <CRON_SECRET>` header for Vercel cron
(Vercel injects `CRON_SECRET` automatically — set the same value in project settings).

> **User identity linking (optional):** to map GitHub authors to internal profiles
> (github_commits.authorId / authorId in PRs), users click
> «اتصال حساب GitHub» in the sidebar. This uses the App's OAuth client;
> `profiles.githubLogin` is set from `GET /user`. Token exchange + /user lookup
> (oauth/callback) is implemented but **untested against a live GitHub App**.

## 3. Local webhook testing (Smee)

```bash
npx smee --url https://smee.io/new --path /api/webhooks/github --port 3000
```

Point the GitHub App's **Webhook URL** to the Smee URL, then run the fixture script:

```bash
node scripts/send-webhook.mjs push fixtures/github/push-open-branch.json --secret $GITHUB_WEBHOOK_SECRET
```

## 4. Production (Vercel)

- Deploy → webhooks arrive at `/api/webhooks/github`
- Cron (`vercel.json`) hits `/api/cron/sync` every 15 minutes with `Authorization: Bearer $CRON_SECRET`

## 5. Checklist

- [ ] App created with correct permissions
- [ ] Webhook secret set + verified (first delivery shows 202 in GitHub → Recent Deliveries)
- [ ] `installation` + `push` + `pull_request` events subscribed
- [ ] `GITHUB_APP_SLUG` matches the app URL (used for the "Install" button)
- [ ] First `push` creates rows in `github_commits` / `github_branches`
