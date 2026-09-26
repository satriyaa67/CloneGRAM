# CloneGRAM MVP implementation plan

Scope source: [ClickUp product brief](https://app.clickup.com/1100360000017605/docs/z8rp3eu565-518). Current progress: Phase 1 is ready to go live. One Cloudflare Worker serves the panel (`site/`) and the intake API (`worker/`); a GitHub Actions workflow deploys both. Sample data only appears in the panel's explicit demo mode.

## Phase 0 · Foundation and review

- [x] Create simple Turkish dashboard preview with Overview, Content Queue, Campaigns, Connections, and Settings sections.
- [x] Establish brand palette: vivid cyan-blue, near-black ink, warm white; use an original mark rather than Telegram’s official plane.
- [x] Add project-level Frontend Design and Superpowers plugin configuration, Context7 MCP configuration, and `CLAUDE.md` product boundaries.
- [x] Prepare free hosting configuration (Pages first; replaced in Phase 1 by a single Worker serving panel and API).
- [x] Review prototype with product owner and confirm the first backend slice (2026-09-26: proceed with Phase 1).
- **Acceptance:** Static preview opens without secrets; it clearly labels demo-only data and has no live send/connect calls.

## Phase 1 · Telegram connection and source intake

Design: [spec](superpowers/specs/2026-09-26-phase-1-telegram-intake-design.md) · Plan: [tasks](superpowers/plans/2026-09-26-phase-1-telegram-intake.md) · Guide: [`worker/README.md`](../worker/README.md)

- [x] Create bot connection setup that keeps bot tokens in server-side secrets only.
- [x] Validate source membership/access and destination-channel posting permission before enabling a flow.
- [x] Receive webhook updates, verify Telegram webhook secret, deduplicate by chat/message ID, and persist minimal metadata.
- [x] Detect protected/restricted content before file operations; skip it without alternate extraction attempts.
- [x] Record chats the bot is added to (`my_chat_member`) so the panel can register them in one click.
- [x] Live panel: sign-in gate (admin token, session-only), overview with setup checklist, queue with filters, connections, settings with webhook health; demo mode kept for offline review.
- [x] Single-Worker deploy workflow (`ops/github-workflows/deploy.yml`): tests, D1 find-or-create, migrations, deploy, secrets, webhook.
- [x] Move `ci.yml` and `deploy.yml` into `.github/workflows/` (done by the product owner).
- [x] Add repository secrets and run the first deploy.
- [x] Live smoke test by the product owner: bot added to a source and a destination, a new source post appears in the queue.
- **Acceptance:** Only accessible, unprotected, rights-cleared new posts enter the queue; repeated webhook delivery cannot create duplicates. Covered by 46 automated tests plus a scripted panel walkthrough against the real app.

## Phase 1.1 · Owner feedback after the live test (2026-09-26)

Spec: [phase 1.1](superpowers/specs/2026-09-26-phase-1-1-publish-cancel-theme.md)

- [x] Manual publish: "Hedefe gönder" copies a queued post (albums together, via `copyMessage`/`copyMessages`) to a registered destination; destination chooser when there are several. Claim-before-send prevents double posts; failures are shown in Turkish with "Tekrar dene".
- [x] Cancel / restore queued posts (whole album at once).
- [x] "Test mesajı gönder" on destinations (silent) to verify posting rights.
- [x] Light / dark / system theme in Settings; transparent CloneGRAM watermark behind the panel in both themes.
- **Why:** Phase 1 only collected posts, so nothing reached the destination. Automatic publishing stays in Phase 3.

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

- [ ] Implement authentication, tenant isolation, owner/editor roles, quotas and retention controls (replaces the Phase 1 admin bearer token).
- [ ] Confirm the data store (D1 now; Postgres adapter if scale or features demand it) and connect Cloudflare R2 with least privilege and private buckets.
- [ ] Add separate worker/container for FFmpeg/heavy media tasks; keep Workers for short webhook/API operations.
- [ ] Add a preview environment and a custom domain once purchased; keep runtime secrets out-of-band.
- [ ] Run security, accessibility, mobile, integration, privacy, and recovery tests before inviting users.
- **Acceptance:** Production build has no secrets in Git or client bundle; backups/retention and error alerting work; end-to-end test confirms permission and consent guards.

## Phase 6 · Power features from the competitor review

Research: [`docs/COMPETITOR-ANALYSIS.md`](COMPETITOR-ANALYSIS.md). Principle: nothing new in the main navigation. Every feature lives in one per-source **Kurallar** drawer with four collapsed groups (Filtre, Düzenle, Zamanlama, Yayın seçenekleri), all off by default, each with a one-line preview of its effect.

- [ ] Filters: media type, keyword allow/block list, drop posts with links or given hashtags.
- [ ] Text rules: find and replace (links, @handles), remove lines containing a keyword, strip links/mentions, header template (footer comes in Phase 2).
- [ ] Automatic mode per source: publish without review, with delay, spacing (one post every N minutes) and active hours.
- [ ] Duplicate guard: skip a post already published from any source.
- [ ] Mirror edits: when the source edits a post, update our copy (Bot API delivers edits; deletions are not delivered to bots, so no delete mirroring).
- [ ] One source to several destinations, each with its own rules.
- [ ] Publish options: silent, pin, protect content in our channel, disable link preview, own URL buttons, drop original buttons.
- [ ] Content calendar: planned and published posts on one list/calendar, bulk reschedule; optional auto-delete after N hours (ad posts).
- [ ] Presets: save a rule set and apply it to several sources; export/import settings as a backup.
- [ ] Alerts: the bot DMs the owner on failures or when a source stops sending.
- [ ] Optional AI rewrite / translation (off by default, clearly labelled, no training on Telegram data, provider terms reviewed first).
- **Not copied from competitors (outside our boundaries):** userbot/MTProto sessions, private or closed sources, protected-content copying, "click to reveal" bypass, removing other channels' watermarks, "uniqueness" tricks to dodge copyright complaints, auto-joining chats.
- **Acceptance:** A new user can still connect a source and publish without opening the Kurallar drawer; every rule shows a before/after preview; rules never touch protected content.

## Constraints

- No protected-content bypass, scraping, unauthorized copying, unsolicited cold DMs, user-account MTProto automation, proxy/account rotation, or ban evasion.
- Treat Telegram API data under current Telegram API/Bot Platform terms. Never train/fine-tune AI on Telegram content.
- The admin bearer token is a single-operator stopgap; do not invite other users before Phase 5 auth.

## Free prototype hosting

One Cloudflare Worker (static assets + API) and D1 run on the free tier within its limits; a domain is optional until purchased. D1 was chosen over free Supabase because free Supabase projects pause when idle, which would break webhooks. Free hosting is for prototype use only; production jobs, media processing, and uptime need a separately reviewed plan.

## Reference sources

- Telegram [API terms](https://core.telegram.org/api/terms)
- Telegram [content protection](https://core.telegram.org/api/content-protection)
- Telegram [Bots FAQ](https://core.telegram.org/bots/faq)
- Telegram [Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
