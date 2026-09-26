# GitHub Actions templates

The automation account that commits to this repo lacks GitHub's `workflow` permission, so these files cannot be placed in `.github/workflows/` automatically. A maintainer moves them once:

1. Open the file on GitHub, click the pencil (Edit), and change its path from `ops/github-workflows/ci.yml` to `.github/workflows/ci.yml`. Commit to `main`.
2. Repeat for `deploy.yml` (path `.github/workflows/deploy.yml`).

- `ci.yml` runs the API test suite on every push to `main` and every pull request.
- `deploy.yml` tests, then deploys the Worker, the panel (`site/`) and the D1 database to Cloudflare's free tier. It runs on demand (Actions > Deploy > Run workflow) and on pushes to `main` that touch `worker/` or `site/`.

## Secrets the deploy needs

Settings > Secrets and variables > Actions > New repository secret:

| Name | Where it comes from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare > My Profile > API Tokens > Create Token > "Edit Cloudflare Workers" template, then add the permission Account > D1 > Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard, Workers & Pages overview (right column) |
| `TELEGRAM_BOT_TOKEN` | @BotFather > /newbot |
| `ADMIN_API_TOKEN` | Any random string of 24+ characters; you sign in to the panel with it |

The webhook secret is generated on every deploy; you never handle it. Open Workers & Pages once in the Cloudflare dashboard before the first run so a `workers.dev` subdomain exists.
