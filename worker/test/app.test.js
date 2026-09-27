import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, deriveWebhookSecret } from '../src/app.js';
import { createD1Store } from '../src/storage/d1.js';
import { createTestD1 } from './helpers/d1.js';
import { channelPost, fakeTelegram, membershipUpdate } from './helpers/fixtures.js';
import { TelegramRateLimitError } from '../src/telegram/client.js';

const env = { TELEGRAM_WEBHOOK_SECRET: 'hook_secret-1', ADMIN_API_TOKEN: 'admin-token', ALLOWED_ORIGIN: 'https://clonegram.pages.dev' };
const now = () => new Date('2026-09-26T10:00:00Z');
let store, telegram, app;

const admin = (path, init = {}) => new Request(`https://api.test${path}`, { ...init, headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json', ...(init.headers ?? {}) } });
const hook = (body, secret = env.TELEGRAM_WEBHOOK_SECRET) => new Request('https://api.test/telegram/webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => {
  store = createD1Store(createTestD1());
  telegram = fakeTelegram({
    chats: { [-1001]: { id: -1001, type: 'channel', title: 'Studio Notes', username: 'studio_notes' }, [-9009]: { id: -9009, type: 'channel', title: 'Yayın' } },
    members: { [-1001]: { status: 'administrator' }, [-9009]: { status: 'administrator', can_post_messages: true } },
  });
  app = createApp({ env, store, telegram: () => telegram, now });
});

test('health is public and leaks no configuration', async () => {
  const response = await app(new Request('https://api.test/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'clonegram-api' });
});

test('webhook rejects a wrong or missing secret', async () => {
  assert.equal((await app(hook(channelPost(), 'nope'))).status, 401);
  assert.equal((await app(hook(channelPost(), ''))).status, 401);
  const unconfigured = createApp({ env: { ...env, TELEGRAM_WEBHOOK_SECRET: '', ADMIN_API_TOKEN: '' }, store, telegram: () => telegram });
  assert.equal((await unconfigured(hook(channelPost()))).status, 503);
});

test('webhook rejects invalid JSON', async () => {
  assert.equal((await app(hook('{not json'))).status, 400);
});

test('end to end: register source, receive post, list queue', async () => {
  const registered = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: '@studio_notes', role: 'source', rightsConfirmed: true }) }));
  assert.equal(registered.status, 201);
  const { chat } = await registered.json();
  assert.equal(chat.telegram_chat_id, -1001);
  assert.equal(chat.rights_confirmed, 1);

  const received = await app(hook(channelPost()));
  assert.equal(received.status, 200);
  assert.deepEqual(await received.json(), { ok: true, result: 'received' });

  const queue = await (await app(admin('/api/content?status=received'))).json();
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].text, 'Merhaba');
});

test('source registration requires explicit rights confirmation', async () => {
  const response = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'source' }) }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'rights_confirmation_required');
  assert.equal(telegram.calls.length, 0);
});

test('ineligible chats are refused with reasons', async () => {
  const response = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'destination' }) }));
  assert.equal(response.status, 422);
  assert.deepEqual((await response.json()).reasons, ['bot_cannot_post']);
});

test('destination registration works for postable channels', async () => {
  const response = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -9009, role: 'destination' }) }));
  assert.equal(response.status, 201);
  const chats = (await (await app(admin('/api/chats'))).json()).chats;
  assert.equal(chats.length, 1);
  assert.equal(chats[0].role, 'destination');
});

test('admin API requires the bearer token', async () => {
  assert.equal((await app(new Request('https://api.test/api/chats'))).status, 401);
  assert.equal((await app(new Request('https://api.test/api/chats', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
  const unconfigured = createApp({ env: { ...env, ADMIN_API_TOKEN: undefined }, store, telegram: () => telegram });
  assert.equal((await unconfigured(admin('/api/chats'))).status, 503);
});

test('input validation on chat registration and queue filters', async () => {
  const bad = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: 'not a chat', role: 'source', rightsConfirmed: true }) }));
  assert.equal(bad.status, 400);
  const badRole = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'owner' }) }));
  assert.equal((await badRole.json()).error, 'invalid_role');
  assert.equal((await app(admin('/api/content?status=drop'))).status, 400);
});

test('webhook setup enforces https, path and registers the stable secret', async () => {
  assert.equal((await app(admin('/api/telegram/webhook', { method: 'POST', body: JSON.stringify({ url: 'http://api.test/telegram/webhook' }) }))).status, 400);
  assert.equal((await app(admin('/api/telegram/webhook', { method: 'POST', body: JSON.stringify({ url: 'https://api.test/other' }) }))).status, 400);
  const ok = await app(admin('/api/telegram/webhook', { method: 'POST', body: JSON.stringify({ url: 'https://api.test/telegram/webhook' }) }));
  assert.equal(ok.status, 200);
  const [, options] = telegram.calls.find(([name]) => name === 'setWebhook');
  assert.equal(options.secret_token, await deriveWebhookSecret(env.ADMIN_API_TOKEN));
  assert.notEqual(options.secret_token, env.ADMIN_API_TOKEN, 'the admin token itself is never sent to Telegram');
  assert.deepEqual(options.allowed_updates, ['channel_post', 'message', 'my_chat_member']);
  assert.equal(options.drop_pending_updates, undefined, 'undelivered posts are kept for retry');
});

test('Telegram rate limits become 503 with Retry-After', async () => {
  telegram.getMe = async () => { throw new TelegramRateLimitError('getMe', 12, 'Too Many Requests'); };
  const response = await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -9009, role: 'destination' }) }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '12');
});

test('CORS only for the configured dashboard origin', async () => {
  const allowed = await app(new Request('https://api.test/api/chats', { method: 'OPTIONS', headers: { origin: env.ALLOWED_ORIGIN } }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), env.ALLOWED_ORIGIN);
  const other = await app(new Request('https://api.test/health', { headers: { origin: 'https://evil.test' } }));
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('unknown routes return 404', async () => {
  assert.equal((await app(new Request('https://api.test/nope'))).status, 404);
  assert.equal((await app(admin('/api/nope'))).status, 404);
});

test('status reports bot and webhook health without secrets', async () => {
  telegram.webhookInfo = { url: 'https://api.test/telegram/webhook', pending_update_count: 3, last_error_date: 1790400000, last_error_message: 'Wrong response from the webhook: 500' };
  const body = await (await app(admin('/api/status'))).json();
  assert.deepEqual(body, {
    ok: true,
    bot: { username: 'clonegram_bot', canReadAllGroupMessages: false },
    webhook: { active: true, pendingUpdates: 3, lastError: 'Wrong response from the webhook: 500', lastErrorAt: new Date(1790400000 * 1000).toISOString() },
  });
  telegram.webhookInfo = { url: '', pending_update_count: 0 };
  assert.equal((await (await app(admin('/api/status'))).json()).webhook.active, false);
});

test('bot membership updates appear as discovered chats with registered roles', async () => {
  assert.equal((await (await app(hook(membershipUpdate()))).json()).result, 'membership_recorded');
  await app(hook(membershipUpdate({ updateId: 51, chatId: -9009, title: 'Yayın', username: undefined, canPost: true })));
  await app(hook(membershipUpdate({ updateId: 52, chatId: -7007, title: 'Eski', status: 'left' })));
  await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'source', rightsConfirmed: true }) }));

  const { chats } = await (await app(admin('/api/discovered'))).json();
  assert.equal(chats.length, 2, 'left chats are hidden');
  const studio = chats.find((c) => c.telegram_chat_id === -1001);
  const yayin = chats.find((c) => c.telegram_chat_id === -9009);
  assert.equal(studio.registered_roles, 'source');
  assert.equal(yayin.registered_roles, null);
  assert.equal(yayin.can_post, 1);
});

test('summary counts queue statuses and registered chats', async () => {
  await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'source', rightsConfirmed: true }) }));
  await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -9009, role: 'destination' }) }));
  await app(hook(channelPost({ messageId: 1 })));
  await app(hook(channelPost({ updateId: 2, messageId: 2 })));
  await app(hook(channelPost({ updateId: 3, messageId: 3, extra: { has_protected_content: true } })));
  const body = await (await app(admin('/api/summary'))).json();
  assert.deepEqual(body, { ok: true, content: { received: 2, skipped: 1 }, chats: { source: 1, destination: 1 } });
});

test('queue items include the source title', async () => {
  await app(admin('/api/chats', { method: 'POST', body: JSON.stringify({ chatId: -1001, role: 'source', rightsConfirmed: true }) }));
  await app(hook(channelPost()));
  const [item] = (await (await app(admin('/api/content'))).json()).items;
  assert.equal(item.source_title, 'Studio Notes');
  assert.equal(item.source_username, 'studio_notes');
});

test('JSON responses carry nosniff', async () => {
  assert.equal((await app(new Request('https://api.test/health'))).headers.get('x-content-type-options'), 'nosniff');
});
