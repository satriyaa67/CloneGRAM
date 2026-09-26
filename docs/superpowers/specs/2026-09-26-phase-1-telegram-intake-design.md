# Phase 1 design: Telegram connection and source intake

Status: approved for implementation by product owner ("proceed in a planned way", 2026-09-26).
Scope source: [MVP plan](../../MVP-PLAN.md), Phase 1.

## Goal

Receive new posts from Telegram channels/groups that the tenant registered as sources, and put eligible posts into a content queue, while refusing anything the platform marks as protected. Nothing is published yet (Phase 3).

## Decisions

1. **Official Bot API only.** A bot added to the source chat receives `channel_post` / `message` updates by webhook. No MTProto user sessions. The bot only sees posts made after it joined; history import is out of scope.
2. **Cloudflare Worker + D1 for the prototype.** D1 runs next to the Worker, needs no connection pooling, and does not pause on inactivity like a free Supabase project. All SQL sits behind `storage/d1.js`, so moving to Postgres later means writing one adapter, not touching business logic.
3. **Plain JavaScript (ES modules), zero runtime dependencies.** Tests use Node's built-in runner and `node:sqlite` executing the real migration, so CI needs no package install.
4. **Rights confirmation is mandatory for sources.** Registering a source requires `rightsConfirmed: true` from the operator; the permission check additionally refuses protected chats.
5. **Protected content is recorded, never copied.** A message with `has_protected_content` (or from a chat flagged protected) is stored as `skipped / protected_content` with **no text and no file reference**, so it can never flow into later phases.
6. **Idempotency by natural key.** `(workspace_id, telegram_chat_id, telegram_message_id)` is unique; Telegram webhook retries and duplicate deliveries insert nothing. Unexpected errors return HTTP 500 so Telegram retries safely.
7. **Single workspace for now.** Every row carries `workspace_id` (default `'default'`) so multi-tenancy in Phase 5 needs no destructive migration.

## Components

| Module | Responsibility |
| --- | --- |
| `src/app.js` | Routing, auth, CORS, error mapping (429 to 503 + Retry-After). |
| `src/telegram/client.js` | Bot API calls; token never appears in errors. |
| `src/telegram/permissions.js` | Eligibility rules for `source` and `destination` roles. |
| `src/intake/normalize.js` | Update to minimal post shape; picks largest photo; no downloads. |
| `src/intake/service.js` | Source lookup, protection handling, idempotent insert. |
| `src/storage/d1.js` | All SQL. |

## Eligibility rules

- **Source:** not a private chat; bot is present; chat not content-protected; for groups the bot is admin or has privacy mode disabled (`can_read_all_group_messages`).
- **Destination:** not a private chat; channels need the bot as admin with `can_post_messages`; groups need the bot present and allowed to send.

## API surface

- `GET /health` public, reveals nothing about configuration.
- `POST /telegram/webhook` requires `X-Telegram-Bot-Api-Secret-Token` (constant-time compare).
- `/api/*` requires `Authorization: Bearer <ADMIN_API_TOKEN>` until real user auth exists (Phase 5): `GET/POST /api/chats`, `GET /api/content?status=&limit=`, `POST /api/telegram/webhook` (registers the webhook with the secret; https and `/telegram/webhook` path enforced).

## Out of scope

Publishing, media download/transforms, scheduling, campaigns, user accounts, dashboard wiring.

## Risks

- The admin bearer token is a stopgap; it must be long, random, and rotated when users arrive.
- Bot API does not expose past posts; operators must add the bot before expecting content.
- Free-tier limits apply to Workers and D1; this is a prototype setup, not a production guarantee.
