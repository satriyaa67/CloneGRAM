# GitHub Actions templates

The automation account that commits to this repo lacks GitHub's `workflow` permission, so these files cannot be placed in `.github/workflows/` automatically.

To enable them, a maintainer copies both files into `.github/workflows/` (GitHub web UI: **Add file > Create new file**, name it `.github/workflows/ci.yml`, paste, commit; repeat for `deploy-pages.yml`).

- `ci.yml` runs the API test suite on every push to `main` and every pull request.
- `deploy-pages.yml` publishes `site/` to Cloudflare Pages when `site/` changes. It skips cleanly until the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist (Settings > Secrets and variables > Actions).
