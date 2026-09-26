# CloneGRAM API (Cloudflare Worker)

One Worker serves both the panel (`../site`, as static assets) and the API, on the same origin. Phase 1 receives posts from registered Telegram sources through the official Bot API and stores eligible ones in a content queue. Protected content is recorded as skipped without its text or media reference. Nothing is published yet.

## Run the tests

```bash
cd worker
node --test        # Node 22+, no install needed
```

## Deploy (recommended: GitHub Actions)

See [`ops/github-workflows/README.md`](../ops/github-workflows/README.md): move `deploy.yml` into `.github/workflows/`, add four repository secrets, run **Actions > Deploy**. The workflow finds or creates the D1 database, applies migrations, deploys, sets secrets (generating a fresh webhook secret) and points the Telegram webhook at the new URL. The panel URL appears in the run summary.

## Manual deploy

1. Create a bot with @BotFather and keep its token private.
2. `npx wrangler@4 login`
3. `npx wrangler@4 d1 create clonegram` and paste the returned id into `wrangler.toml` (`database_id`).
4. `npm run db:migrate:remote`
5. `npx wrangler@4 deploy` and note the `*.workers.dev` URL (`$API`).
6. Set secrets: `npx wrangler@4 secret put TELEGRAM_BOT_TOKEN`, `... TELEGRAM_WEBHOOK_SECRET` (letters, digits, `_`, `-`), `... ADMIN_API_TOKEN` (24+ random chars).
7. Register the webhook:

```bash
curl -X POST "$API/api/telegram/webhook" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d "{\"url\":\"$API/telegram/webhook\"}"
```

## Connect chats

Easiest path: open the panel, add the bot as an administrator to a channel in Telegram, and the channel appears under **Bağlantılar > Botun eklendiği sohbetler** (the Worker records `my_chat_member` updates). Register it as a source (you confirm republishing rights) or as a destination (the bot needs post rights).

The same through the API:

```bash
curl -X POST "$API/api/chats" -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"chatId":"@your_source","role":"source","rightsConfirmed":true}'
curl -X POST "$API/api/chats" -H "Authorization: Bearer $ADMIN_API_TOKEN" -H 'content-type: application/json' \
  -d '{"chatId":"@your_destination","role":"destination"}'
```

A `422 chat_not_eligible` response lists the reasons, for example `bot_not_admin`, `bot_cannot_post`, `source_content_protected`, `bot_cannot_read_group_messages`.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness |
| POST | `/telegram/webhook` | Telegram secret header | Update intake (`channel_post`, `message`, `my_chat_member`) |
| GET | `/api/status` | bearer | Bot username, webhook state, last Telegram delivery error |
| GET | `/api/summary` | bearer | Queue and connection counts |
| GET | `/api/discovered` | bearer | Chats the bot was added to, with any registered roles |
| GET | `/api/chats` | bearer | Registered chats |
| POST | `/api/chats` | bearer | Register a source or destination after permission checks |
| GET | `/api/content?status=&limit=` | bearer | Content queue with source title (`received`, `skipped`, ...) |
| POST | `/api/telegram/webhook` | bearer | Point Telegram at this Worker |

The bearer admin token is a Phase 1 stopgap; Phase 5 replaces it with real accounts. The panel keeps it in `sessionStorage` only.

## Boundaries

Bot API only; the bot sees posts made after it joined. No protected-content extraction, scraping, user-account automation or cold messaging. See the root `CLAUDE.md`.
