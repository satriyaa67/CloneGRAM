# CloneGRAM API (Cloudflare Worker)

Phase 1: receives posts from registered Telegram sources through the official Bot API and stores eligible ones in a content queue. Protected content is recorded as skipped without its text or media reference. Nothing is published yet.

## Run the tests

```bash
cd worker
node --test        # Node 22+, no install needed
```

## First-time setup

1. Create a bot with @BotFather and keep its token private.
2. `npx wrangler@4 login`
3. `npx wrangler@4 d1 create clonegram` and paste the returned `database_id` into `wrangler.toml`.
4. `npm run db:migrate:remote` (or `npx wrangler@4 d1 migrations apply clonegram --remote`).
5. Set secrets (you will be prompted for each value):
   - `npx wrangler@4 secret put TELEGRAM_BOT_TOKEN`
   - `npx wrangler@4 secret put TELEGRAM_WEBHOOK_SECRET` (letters, digits, `_`, `-`; up to 256 chars)
   - `npx wrangler@4 secret put ADMIN_API_TOKEN` (long random string)
6. `npx wrangler@4 deploy` and note the `*.workers.dev` URL.
7. Register the webhook:

```bash
curl -X POST "$API/api/telegram/webhook" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d "{\"url\":\"$API/telegram/webhook\"}"
```

## Connect chats

Add the bot to the source channel (and as admin with post rights to your destination channel), then:

```bash
# source: you confirm you have the right to republish its content
curl -X POST "$API/api/chats" -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"chatId":"@your_source","role":"source","rightsConfirmed":true}'

# destination
curl -X POST "$API/api/chats" -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"chatId":"@your_destination","role":"destination"}'

# queue
curl "$API/api/content?status=received" -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

A `422 chat_not_eligible` response lists the reasons, for example `bot_not_admin`, `bot_cannot_post`, `source_content_protected`, `bot_cannot_read_group_messages`.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness |
| POST | `/telegram/webhook` | Telegram secret header | Update intake |
| GET | `/api/chats` | bearer | Registered chats |
| POST | `/api/chats` | bearer | Register a source or destination after permission checks |
| GET | `/api/content?status=&limit=` | bearer | Content queue (`received`, `skipped`, ...) |
| POST | `/api/telegram/webhook` | bearer | Point Telegram at this Worker |

## Boundaries

Bot API only; the bot sees posts made after it joined. No protected-content extraction, scraping, user-account automation or cold messaging. See the root `CLAUDE.md`.
