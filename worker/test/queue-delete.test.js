import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createD1Store } from '../src/storage/d1.js';
import { createTestD1 } from './helpers/d1.js';
import { channelPost, fakeTelegram } from './helpers/fixtures.js';
import { TelegramApiError } from '../src/telegram/client.js';

const env = { TELEGRAM_WEBHOOK_SECRET: 'hook_secret-1', ADMIN_API_TOKEN: 'admin-token' };
let store, telegram, app;
const admin = (path, init = {}) => new Request(`https://api.test${path}`, { ...init, headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' } });
const hook = (body) => new Request('https://api.test/telegram/webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': env.TELEGRAM_WEBHOOK_SECRET }, body: JSON.stringify(body) });
const post = (path, body) => app(admin(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }));
const items = async (q = '') => (await (await app(admin(`/api/content${q}`))).json()).items;
const album = (updateId, messageId) => channelPost({ updateId, messageId, extra: { text: undefined, photo: [{ file_id: `f${messageId}` }], media_group_id: 'alb' } });

beforeEach(async () => {
  store = createD1Store(createTestD1());
  telegram = fakeTelegram({
    chats: { [-1001]: { id: -1001, type: 'channel', title: 'Studio Notes' }, [-9009]: { id: -9009, type: 'channel', title: 'Yayın' } },
    members: { [-1001]: { status: 'administrator' }, [-9009]: { status: 'administrator', can_post_messages: true } },
  });
  app = createApp({ env, store, telegram: () => telegram });
  await post('/api/chats', { chatId: -1001, role: 'source', rightsConfirmed: true });
  await post('/api/chats', { chatId: -9009, role: 'destination' });
});

test('a waiting post is deleted permanently and leaves the summary', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  const res = await post(`/api/content/${item.id}/delete`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, deleted: 1 });
  assert.equal((await items()).length, 0);
  const summary = await (await app(admin('/api/summary'))).json();
  assert.deepEqual(summary.content, {});
  assert.equal(telegram.calls.some(([m]) => m.startsWith('copy')), false, 'deleting never touches Telegram');
});

test('deleting one album photo removes the whole album and reports the count', async () => {
  await app(hook(album(1, 20)));
  await app(hook(album(2, 21)));
  await app(hook(channelPost({ updateId: 3, messageId: 22 })));
  const albumRow = (await items()).find((i) => i.media_group_id === 'alb');
  const res = await post(`/api/content/${albumRow.id}/delete`);
  assert.deepEqual(await res.json(), { ok: true, deleted: 2 });
  const left = await items();
  assert.equal(left.length, 1);
  assert.equal(left[0].telegram_message_id, 22);
});

test('cancelled and failed posts can be deleted; DELETE method works too', async () => {
  await app(hook(channelPost({ updateId: 1, messageId: 1 })));
  await app(hook(channelPost({ updateId: 2, messageId: 2 })));
  const [b, a] = await items();
  await post(`/api/content/${a.id}/cancel`);
  telegram.copyMessage = async () => { throw new TelegramApiError('copyMessage', 400, 'Bad Request: chat not found'); };
  await post(`/api/content/${b.id}/publish`);
  assert.equal((await items('?status=failed')).length, 1);

  assert.equal((await post(`/api/content/${a.id}/delete`)).status, 200);
  const del = await app(admin(`/api/content/${b.id}`, { method: 'DELETE' }));
  assert.equal(del.status, 200);
  assert.equal((await del.json()).deleted, 1);
  assert.equal((await items()).length, 0);
});

test('published, protected and in-flight posts cannot be deleted', async () => {
  await app(hook(channelPost({ updateId: 1, messageId: 1 })));
  await app(hook(channelPost({ updateId: 2, messageId: 2, extra: { has_protected_content: true } })));
  await app(hook(channelPost({ updateId: 3, messageId: 3 })));
  const list = await items();
  const published = list.find((i) => i.telegram_message_id === 1);
  const skipped = list.find((i) => i.status === 'skipped');
  const inflight = list.find((i) => i.telegram_message_id === 3);
  await post(`/api/content/${published.id}/publish`);
  await store.claimForPublish([inflight.id], new Date().toISOString());

  for (const row of [published, skipped, inflight]) {
    const res = await post(`/api/content/${row.id}/delete`);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'item_not_deletable');
  }
  assert.equal((await items()).length, 3, 'nothing was removed');
  assert.equal((await post('/api/content/9999/delete')).status, 404);
});

test('an album with a sibling being published is left untouched', async () => {
  await app(hook(album(1, 30)));
  await app(hook(album(2, 31)));
  const [x, y] = await items();
  await store.claimForPublish([y.id], new Date().toISOString());
  const res = await post(`/api/content/${x.id}/delete`);
  assert.equal(res.status, 409);
  assert.equal((await items()).length, 2);
});

test('storage delete re-checks status (race with a publish that just started)', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  await store.claimForPublish([item.id], new Date().toISOString());
  assert.equal(await store.deleteQueued([item.id]), 0);
  assert.equal((await items()).length, 1);
});

test('delete requires the admin token', async () => {
  assert.equal((await app(new Request('https://api.test/api/content/1/delete', { method: 'POST' }))).status, 401);
  assert.equal((await app(new Request('https://api.test/api/content/1', { method: 'DELETE', headers: { authorization: 'Bearer wrong' } }))).status, 401);
});
