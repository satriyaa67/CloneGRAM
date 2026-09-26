# Phase 1 implementation plan: Telegram intake

Design: [phase 1 design](../specs/2026-09-26-phase-1-telegram-intake-design.md). Branch: `feature/phase-1-telegram-intake`.

Global constraints: Node 22, zero runtime dependencies, every behavior test-first (red, green, refactor), no secrets in the repo, Bot API only.

- [x] **Task 1: Schema.** `worker/migrations/0001_init.sql` with `chats` and `content_items`, unique natural keys, status check constraint. Verified through `test/helpers/d1.js`, which executes the real migration on `node:sqlite`.
- [x] **Task 2: Security helpers.** Constant-time `safeEqual`, `bearerToken`. Tests: equal/unequal/length mismatch/empty.
- [x] **Task 3: Bot API client.** JSON POST per method, 429 to `TelegramRateLimitError(retryAfter)`, token-free error messages.
- [x] **Task 4: Permission checks.** Source and destination rules from the design; private chats always refused.
- [x] **Task 5: Normalization.** Text, photo (largest size), video, albums, protection flag; ignore private/service/unsupported updates.
- [x] **Task 6: Intake service.** Registered and rights-confirmed sources only; protected items stored as skipped without payload; idempotent insert.
- [x] **Task 7: HTTP app.** Webhook secret, admin bearer auth, chat registration with rights confirmation, queue listing with validation, webhook setup, CORS for the dashboard origin, 429 mapping.
- [x] **Mutation check.** Disabling the protection rule or the rights-confirmation rule turns the suite red (verified locally).
- [ ] **Task 8: Enable CI.** Templates live in `ops/github-workflows/`; the automation account lacks GitHub's `workflow` permission, so a maintainer must copy them into `.github/workflows/`.
- [ ] **Task 9: Live smoke test.** Needs a Cloudflare account, a D1 database id and a bot token (see `worker/README.md`). Register one source and one destination, post in the source, confirm the item in `GET /api/content`.

Result: 38 tests passing locally on Node 22.
