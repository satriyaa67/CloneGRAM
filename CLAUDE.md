# CloneGRAM project rules

## Product and design
- Keep the interface calm, distinctive, professional, and deliberately simple. Primary navigation is Overview, Content Queue, Campaigns, Connections, Settings. Progressive disclosure beats adding more dashboard cards.
- Preserve the brand palette from the supplied mark: vivid Telegram-like cyan-blue, near-black ink, and warm white. Use the wordmark `CloneGRAM`; use the project's original circular loop mark in `site/assets/clonegram-mark.svg`, not Telegram's official icon. Do not reuse the supplied slogan “DON'T FORWARD. CLONE.” Use neutral copy such as “Source. Refine. Publish.”
- For frontend work, apply the Frontend Design skill. Use accessible semantics, visible keyboard focus, responsive mobile navigation, reduced-motion support, and truthful loading/error/empty states.
- Panel code (`site/`) stays framework-free: no inline scripts or styles (strict CSP in `site/_headers`), render user and Telegram text with `textContent` only.

## Research and workflow
- Use Context7 for current framework/library/API documentation before implementation; the project MCP config is `.mcp.json`.
- Use Superpowers for non-trivial features: clarify requirements, produce/review the design, write a bite-sized implementation plan, then implement with tests and review. Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. Do not skip testing to move faster.
- Keep features modular and small. Do not build speculative abstractions or a cluttered all-in-one panel.
- API tests: `cd worker && node --test` (Node 22+, zero dependencies; `node:sqlite` runs the real D1 migrations).

## Telegram safety and product boundaries
- Use the official Bot API for the planned MVP. No MTProto user-account automation, scraping, content-protection bypass, download/forward restriction circumvention, proxy/account rotation, ban evasion, or unsolicited cold DMs.
- Import/process only accessible, unprotected content that the tenant has the right to republish. If Telegram reports protected/restricted content, stop and mark the item skipped; never try another route to extract it. Skipped items must not keep text or file references.
- Marketing campaigns require explicit, revocable opt-in to the same bot. Respect `/stop`, block status, suppression records, rate limits, and Telegram retry-after responses at dispatch time.
- Never claim open/view metrics unavailable through the Bot API. Do not train or tune AI on Telegram content.
- Keep tokens and credentials server-side in secret storage. Never commit real bot tokens, API keys, user sessions, or personal data.

## Architecture
- Tenant isolation, idempotent webhook processing, explicit job states, retry/backoff, audit trail, and least-privilege scopes are required for backend work.
- One Cloudflare Worker (`worker/`) serves the panel from `site/` as static assets and handles `/api/*`, `/telegram/webhook` and `/health` on the same origin. Cloudflare D1 is the prototype data store behind `worker/src/storage/d1.js` (keep all SQL there so a Postgres adapter can replace it). New schema changes go in a new numbered file in `worker/migrations/`. R2 will store media bytes. Keep heavy media processing in a separate worker/container; do not buffer media through a Worker.
- Deploys go through `.github/workflows/deploy.yml` (template in `ops/github-workflows/`). Deploy only after checking production configuration, secrets, quotas, legal/platform requirements, and a real end-to-end test.
