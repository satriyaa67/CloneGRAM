import { json, fail, readJson } from './lib/http.js';
import { safeEqual, bearerToken } from './lib/security.js';
import { processUpdate } from './intake/service.js';
import { checkChatAccess } from './telegram/permissions.js';
import { TelegramApiError, TelegramRateLimitError } from './telegram/client.js';
import { publishItem, changeQueueState, deleteQueueItem, PublishError } from './publish/service.js';

const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const ALLOWED_UPDATES = ['channel_post', 'message', 'my_chat_member'];
const encoder = new TextEncoder();

/**
 * Telegram webhook secret derived from ADMIN_API_TOKEN (SHA-256, hex).
 * Every Worker version computes the same value, so a deploy can never leave Telegram
 * holding a secret the running version does not know. A per-deploy random secret did
 * exactly that (Telegram was registered by one version, deliveries hit another) and
 * every update came back "401 Unauthorized".
 */
export async function deriveWebhookSecret(adminToken) {
  if (typeof adminToken !== 'string' || adminToken.length === 0) return null;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`clonegram-webhook:${adminToken}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds the request handler. Dependencies are injected so every route is testable:
 *   env:       { ADMIN_API_TOKEN, TELEGRAM_WEBHOOK_SECRET (legacy, still accepted), ALLOWED_ORIGIN }
 *   store:     storage adapter (see storage/d1.js)
 *   telegram:  () => Bot API client (lazy, so routes that don't need it work without a token)
 */
export function createApp({ env, store, telegram, now = () => new Date() }) {
  let derivedSecret;
  const stableSecret = () => (derivedSecret ??= deriveWebhookSecret(env.ADMIN_API_TOKEN));

  /** Secrets Telegram may present: the stable derived one, plus the legacy per-deploy secret if set. */
  async function acceptedWebhookSecrets() {
    return [await stableSecret(), env.TELEGRAM_WEBHOOK_SECRET].filter((s) => typeof s === 'string' && s.length > 0);
  }

  return async function handle(request) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true, service: 'clonegram-api' }, 200, cors);
      }
      if (url.pathname === '/telegram/webhook' && request.method === 'POST') {
        return await telegramWebhook(request);
      }
      if (url.pathname.startsWith('/api/')) {
        const denied = authorizeAdmin(request, env);
        if (denied) return withHeaders(denied, cors);
        return withHeaders(await adminRoute(request, url), cors);
      }
      return fail(404, 'not_found', {}, cors);
    } catch (error) {
      if (error instanceof PublishError) {
        return fail(error.status, error.code, error.extra, cors);
      }
      if (error instanceof TelegramRateLimitError) {
        return fail(503, 'telegram_rate_limited', { retryAfter: error.retryAfter }, { ...cors, 'retry-after': String(error.retryAfter) });
      }
      if (error instanceof TelegramApiError) {
        return fail(502, 'telegram_error', { method: error.method, description: error.description }, cors);
      }
      console.error('Unhandled error', error);
      return fail(500, 'internal_error', {}, cors);
    }
  };

  async function telegramWebhook(request) {
    const accepted = await acceptedWebhookSecrets();
    if (accepted.length === 0) return fail(503, 'webhook_not_configured');
    const presented = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!accepted.some((secret) => safeEqual(presented, secret))) {
      return fail(401, 'invalid_webhook_secret');
    }
    const update = await readJson(request);
    if (update === undefined) return fail(400, 'invalid_json');
    // Errors propagate as 500 so Telegram retries; inserts are idempotent.
    const result = await processUpdate(update, { store, now });
    return json({ ok: true, result: result.status });
  }

  async function adminRoute(request, url) {
    const { pathname } = url;
    const method = request.method;

    if (pathname === '/api/status' && method === 'GET') {
      return status();
    }
    if (pathname === '/api/summary' && method === 'GET') {
      return json({ ok: true, ...(await store.summary()) });
    }
    if (pathname === '/api/discovered' && method === 'GET') {
      return json({ ok: true, chats: await store.listDiscoveredChats() });
    }
    if (pathname === '/api/chats' && method === 'GET') {
      return json({ ok: true, chats: await store.listChats() });
    }
    if (pathname === '/api/chats' && method === 'POST') {
      return registerChat(await readJson(request));
    }
    if (pathname === '/api/content' && method === 'GET') {
      const status = url.searchParams.get('status') ?? undefined;
      try {
        const items = await store.listContentItems({ status, limit: url.searchParams.get('limit') ?? 50 });
        return json({ ok: true, items });
      } catch (error) {
        if (error instanceof RangeError) return fail(400, 'invalid_status');
        throw error;
      }
    }
    if (pathname === '/api/telegram/webhook' && method === 'POST') {
      return configureWebhook(await readJson(request));
    }
    const itemAction = pathname.match(/^\/api\/content\/(\d+)\/(publish|cancel|restore|delete)$/);
    if (itemAction && method === 'POST') {
      const id = Number(itemAction[1]);
      if (itemAction[2] === 'publish') {
        const body = (await readJson(request)) ?? {};
        const result = await publishItem({ store, telegram, id, destinationChatId: body.destinationChatId, now });
        return json({ ok: true, ...result });
      }
      if (itemAction[2] === 'delete') {
        return json({ ok: true, ...(await deleteQueueItem({ store, id })) });
      }
      return json({ ok: true, ...(await changeQueueState({ store, id, action: itemAction[2], now })) });
    }
    const itemDelete = pathname.match(/^\/api\/content\/(\d+)$/);
    if (itemDelete && method === 'DELETE') {
      return json({ ok: true, ...(await deleteQueueItem({ store, id: Number(itemDelete[1]) })) });
    }
    const testPost = pathname.match(/^\/api\/chats\/(-?\d+)\/test$/);
    if (testPost && method === 'POST') {
      return sendTestPost(Number(testPost[1]));
    }
    return fail(404, 'not_found');
  }

  async function status() {
    const client = telegram();
    const [me, info] = await Promise.all([client.getMe(), client.getWebhookInfo()]);
    return json({
      ok: true,
      bot: { username: me.username ?? null, canReadAllGroupMessages: me.can_read_all_group_messages === true },
      webhook: {
        active: typeof info.url === 'string' && info.url.length > 0,
        pendingUpdates: info.pending_update_count ?? 0,
        lastError: info.last_error_message ?? null,
        lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
      },
    });
  }

  async function sendTestPost(telegramChatId) {
    const destination = await store.getActiveDestination(telegramChatId);
    if (!destination) return fail(404, 'destination_not_found');
    const message = await telegram().sendMessage(
      destination.telegram_chat_id,
      'CloneGRAM bağlantı testi ✅ Bot bu kanala gönderi yapabiliyor. Bu mesajı silebilirsin.',
      { disable_notification: true },
    );
    return json({ ok: true, messageId: message?.message_id ?? null });
  }

  async function registerChat(body) {
    if (!body || typeof body !== 'object') return fail(400, 'invalid_json');
    const { chatId, role, rightsConfirmed } = body;
    if (!isChatReference(chatId)) return fail(400, 'invalid_chat_id');
    if (role !== 'source' && role !== 'destination') return fail(400, 'invalid_role');
    if (role === 'source' && rightsConfirmed !== true) return fail(400, 'rights_confirmation_required');

    const access = await checkChatAccess(telegram(), chatId, role);
    if (!access.ok) return fail(422, 'chat_not_eligible', { reasons: access.reasons, chat: access.chat });

    const chat = await store.upsertChat({
      telegramChatId: access.chat.telegramChatId,
      role,
      title: access.chat.title,
      type: access.chat.type,
      username: access.chat.username,
      protectedContent: access.chat.protectedContent,
      rightsConfirmed: role === 'source' ? true : false,
      checkedAt: now().toISOString(),
    });
    return json({ ok: true, chat }, 201);
  }

  async function configureWebhook(body) {
    const secret = (await stableSecret()) ?? env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || !WEBHOOK_SECRET_PATTERN.test(secret)) return fail(503, 'webhook_secret_invalid_or_missing');
    let target;
    try {
      target = new URL(body?.url);
    } catch {
      return fail(400, 'invalid_url');
    }
    if (target.protocol !== 'https:') return fail(400, 'https_required');
    if (target.pathname !== '/telegram/webhook') return fail(400, 'webhook_path_must_be_/telegram/webhook');
    // Pending updates are kept on purpose: posts Telegram could not deliver are retried with the new secret.
    await telegram().setWebhook({ url: target.toString(), secret_token: secret, allowed_updates: ALLOWED_UPDATES });
    return json({ ok: true, url: target.toString(), allowedUpdates: ALLOWED_UPDATES });
  }
}

function authorizeAdmin(request, env) {
  if (!env.ADMIN_API_TOKEN) return fail(503, 'admin_api_not_configured');
  if (!safeEqual(bearerToken(request) ?? '', env.ADMIN_API_TOKEN)) return fail(401, 'unauthorized');
  return null;
}

function isChatReference(value) {
  return (Number.isSafeInteger(value) && value !== 0) || (typeof value === 'string' && /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(value));
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600',
    vary: 'origin',
  };
}

function withHeaders(response, headers) {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
