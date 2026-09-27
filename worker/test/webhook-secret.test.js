import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, deriveWebhookSecret } from '../src/app.js';
import { createD1Store } from '../src/storage/d1.js';
import { createTestD1 } from './helpers/d1.js';
import { channelPost, fakeTelegram } from './helpers/fixtures.js';

const ADMIN = 'admin-token-that-is-long-enough';
const chats = { [-1001]: { id: -1001, type: 'channel', title: 'Studio Notes' } };
const members = { [-1001]: { status: 'administrator' } };
const admin = (path, body) => new Request(`https://api.test${path}`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const hook = (secret, body = channelPost()) => new Request('https://api.test/telegram/webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(body) });

test('derived secret is stable, Telegram-safe and never the admin token', async () => {
  const a = await deriveWebhookSecret(ADMIN);
  assert.equal(a, await deriveWebhookSecret(ADMIN));
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, ADMIN);
  assert.notEqual(a, await deriveWebhookSecret(`${ADMIN}x`));
  assert.equal(await deriveWebhookSecret(''), null);
  assert.equal(await deriveWebhookSecret(undefined), null);
});

test('regression: a webhook registered by one deploy is accepted by the next (no 401 after rotation)', async () => {
  const store = createD1Store(createTestD1());
  const telegram = fakeTelegram({ chats, members });
  // Old Worker version registers the webhook; its per-deploy random secret is "old-random".
  const oldVersion = createApp({ env: { ADMIN_API_TOKEN: ADMIN, TELEGRAM_WEBHOOK_SECRET: 'old-random' }, store, telegram: () => telegram });
  assert.equal((await oldVersion(admin('/api/chats', { chatId: -1001, role: 'source', rightsConfirmed: true }))).status, 201);
  assert.equal((await oldVersion(admin('/api/telegram/webhook', { url: 'https://api.test/telegram/webhook' }))).status, 200);
  const [, { secret_token: registered }] = telegram.calls.find(([m]) => m === 'setWebhook');

  // The deploy rotates the random secret; the new version must still accept what Telegram holds.
  const newVersion = createApp({ env: { ADMIN_API_TOKEN: ADMIN, TELEGRAM_WEBHOOK_SECRET: 'new-random' }, store, telegram: () => telegram });
  const delivered = await newVersion(hook(registered));
  assert.equal(delivered.status, 200);
  assert.deepEqual(await delivered.json(), { ok: true, result: 'received' });
});

test('legacy per-deploy secret keeps working, unknown secrets are still refused', async () => {
  const store = createD1Store(createTestD1());
  const app = createApp({ env: { ADMIN_API_TOKEN: ADMIN, TELEGRAM_WEBHOOK_SECRET: 'legacy-secret' }, store, telegram: () => fakeTelegram({ chats, members }) });
  assert.equal((await app(hook('legacy-secret', { update_id: 7 }))).status, 200);
  assert.equal((await app(hook(await deriveWebhookSecret(ADMIN), { update_id: 8 }))).status, 200);
  assert.equal((await app(hook('guess', { update_id: 9 }))).status, 401);
  assert.equal((await app(hook(ADMIN, { update_id: 10 }))).status, 401, 'the raw admin token is not a webhook secret');
});

test('works without the legacy secret at all (only ADMIN_API_TOKEN set)', async () => {
  const store = createD1Store(createTestD1());
  const telegram = fakeTelegram({ chats, members });
  const app = createApp({ env: { ADMIN_API_TOKEN: ADMIN }, store, telegram: () => telegram });
  assert.equal((await app(admin('/api/telegram/webhook', { url: 'https://api.test/telegram/webhook' }))).status, 200);
  const [, { secret_token }] = telegram.calls.find(([m]) => m === 'setWebhook');
  assert.equal((await app(hook(secret_token, { update_id: 11 }))).status, 200);
});
