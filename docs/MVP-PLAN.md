# CloneGRAM MVP implementation plan

Scope source: [ClickUp product brief](https://app.clickup.com/1100360000017605/docs/z8rp3eu565-518). Current progress: static, local-only dashboard preview in `site/`. Do not treat sample content or status counts as production data.

## Phase 0 · Foundation and review

- [x] Create simple Turkish dashboard preview with Overview, Content Queue, Campaigns, Connections, and Settings sections.
- [x] Establish brand palette: vivid cyan-blue, near-black ink, warm white; use an original mark rather than Telegram’s official plane.
- [x] Add project-level Frontend Design and Superpowers plugin configuration, Context7 MCP configuration, and `CLAUDE.md` product boundaries.
- [x] Prepare Cloudflare Pages static-output configuration.
- [ ] Review prototype with product owner and confirm the first backend slice.
- **Acceptance:** Static preview opens without secrets; it clearly labels demo-only data and has no live send/connect calls.

## Phase 1 · Telegram connection and source intake

- [ ] Create bot connection setup that keeps bot tokens in server-side secrets only.
- [ ] Validate source membership/access and destination-channel posting permission before enabling a flow.
- [ ] Receive webhook updates, verify Telegram webhook secret, deduplicate by update/message ID, and persist minimal metadata.
- [ ] Detect protected/restricted content before file operations; skip it without alternate extraction attempts.
- **Acceptance:** Only accessible, unprotected, rights-cleared new posts enter the queue; repeated webhook delivery cannot create duplicates.

## Phase 2 · Content review and transforms

- [ ] Build content queue with photo/video/text preview, original source link, rights confirmation, and clear status.
- [ ] Add editable caption and fixed appended text.
- [ ] Add opt-in image/video watermark controls, placement/size/opacity and output preview.
- [ ] Require human approval before first publication; record who approved and what changed.
- **Acceptance:** Editor shows the final output before publish; transform does not hide source attribution or bypass platform protection; unsupported media fails visibly and safely.

## Phase 3 · Publication automation

- [ ] Add destination selection, one-off schedule and per-source processing profile.
- [ ] Build durable job queue with idempotency, pause/cancel, bounded retries, 429 `retry_after` handling, and dead-letter status.
- [ ] Keep media bytes in object storage; pass references, not videos, through edge queues.
- [ ] Add audit trail and tenant-scoped access checks on every operation.
- **Acceptance:** Restart/retry cannot double-publish; all queued/sent/failed/skipped states are visible; rate-limit retries wait as directed.

## Phase 4 · Opt-in marketing campaigns

- [ ] Record explicit same-bot subscription consent, timestamp/source, active/unsubscribed/blocked status and suppression reason.
- [ ] Implement `/start` onboarding and `/stop`/unsubscribe handling.
- [ ] Add campaign composer with text/media/buttons, variable preview, segment selection, test send, schedule/cancel.
- [ ] Recheck active consent and suppression immediately before every delivery; throttle conservatively and obey Telegram errors.
- [ ] Report attempted, accepted, failed, blocked, unsubscribed and trackable link-click outcomes; do not fabricate open/view rates.
- **Acceptance:** No scraped/cold audience can enter a send; opted-out/blocked contacts are excluded at dispatch; errors and delivery outcomes are auditable.

## Phase 5 · SaaS, hosting and beta readiness

- [ ] Implement authentication, tenant isolation, owner/editor roles, quotas and retention controls.
- [ ] Connect Supabase Postgres/Auth and Cloudflare R2 with least privilege and private buckets.
- [ ] Add separate worker/container for FFmpeg/heavy media tasks; keep Workers for short webhook/API operations.
- [ ] Connect repository to Cloudflare Pages, configure preview and production environments, add runtime secrets out-of-band.
- [ ] Run security, accessibility, mobile, integration, privacy, and recovery tests before inviting users.
- **Acceptance:** Production build has no secrets in Git or client bundle; backups/retention and error alerting work; end-to-end test confirms permission and consent guards.

## Constraints

- No protected-content bypass, scraping, unauthorized copying, unsolicited cold DMs, user-account MTProto automation, proxy/account rotation, or ban evasion.
- Treat Telegram API data under current Telegram API/Bot Platform terms. Never train/fine-tune AI on Telegram content.
- Browser preview is a design aid only. The live application needs a secure backend before real channels, users, or media are connected.

## Free prototype hosting

Cloudflare Pages can serve the static preview on a `pages.dev` subdomain at no charge within current free-tier limits. A domain is optional until purchased. No Cloudflare account is connected in this work session, so no live deployment has been made. Free hosting is for prototype use only; production jobs, persistent workers, media processing, and uptime need a separately reviewed plan.

## Reference sources

- Telegram [API terms](https://core.telegram.org/api/terms)
- Telegram [content protection](https://core.telegram.org/api/content-protection)
- Telegram [Bots FAQ](https://core.telegram.org/bots/faq)
- Telegram [Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase pricing](https://supabase.com/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)