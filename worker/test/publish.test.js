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

beforeEach(async () => {
  store = createD1Store(createTestD1());
  telegram = fakeTelegram({
    chats: { [-1001]: { id: -1001, type: 'channel', title: 'Studio Notes' }, [-9009]: { id: -9009, type: 'channel', title: 'Yayın' }, [-9010]: { id: -9010, type: 'channel', title: 'Yedek' } },
    members: { [-1001]: { status: 'administrator' }, [-9009]: { status: 'administrator', can_post_messages: true }, [-9010]: { status: 'administrator', can_post_messages: true } },
  });
  app = createApp({ env, store, telegram: () => telegram });
  await post('/api/chats', { chatId: -1001, role: 'source', rightsConfirmed: true });
  await post('/api/chats', { chatId: -9009, role: 'destination' });
});

test('publishes a queued post to the only destination and records it', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  const res = await post(`/api/content/${item.id}/publish`);
  assert.equal(res.status, 200);
  const copy = telegram.calls.find(([m]) => m === 'copyMessage');
  assert.deepEqual(copy, ['copyMessage', -9009, -1001, 10]);
  const [after] = await items();
  assert.equal(after.status, 'published');
  assert.equal(after.published_chat_id, -9009);
  assert.equal(after.destination_title, 'Yayın');
});

test('a published item cannot be published twice', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  await post(`/api/content/${item.id}/publish`);
  const again = await post(`/api/content/${item.id}/publish`);
  assert.equal(again.status, 409);
  assert.equal(telegram.calls.filter(([m]) => m === 'copyMessage').length, 1);
});

test('albums are published together with copyMessages in message order', async () => {
  await app(hook(channelPost({ updateId: 1, messageId: 21, extra: { text: undefined, photo: [{ file_id: 'b' }], media_group_id: 'alb' } })));
  await app(hook(channelPost({ updateId: 2, messageId: 20, extra: { text: undefined, caption: 'Albüm', photo: [{ file_id: 'a' }], media_group_id: 'alb' } })));
  const list = await items();
  await post(`/api/content/${list[0].id}/publish`);
  assert.deepEqual(telegram.calls.find(([m]) => m === 'copyMessages'), ['copyMessages', -9009, -1001, [20, 21]]);
  assert.ok((await items()).every((i) => i.status === 'published'));
});

test('protected items are refused without calling Telegram', async () => {
  await app(hook(channelPost({ extra: { has_protected_content: true } })));
  const [item] = await items();
  const res = await post(`/api/content/${item.id}/publish`);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'item_protected');
  assert.equal(telegram.calls.some(([m]) => m.startsWith('copy')), false);
});

test('with several destinations the caller must choose one', async () => {
  await post('/api/chats', { chatId: -9010, role: 'destination' });
  await app(hook(channelPost()));
  const [item] = await items();
  const res = await post(`/api/content/${item.id}/publish`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'destination_required');
  assert.equal(body.destinations.length, 2);
  assert.equal((await post(`/api/content/${item.id}/publish`, { destinationChatId: -9010 })).status, 200);
  assert.equal((await post(`/api/content/${item.id}/publish`, { destinationChatId: -1001 })).status, 409);
});

test('an unregistered destination is rejected', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  assert.equal((await post(`/api/content/${item.id}/publish`, { destinationChatId: -4242 })).status, 404);
});

test('Telegram failures mark the item failed and it can be retried', async () => {
  await app(hook(channelPost()));
  const [item] = await items();
  const original = telegram.copyMessage;
  telegram.copyMessage = async () => { throw new TelegramApiError('copyMessage', 400, 'Bad Request: need administrator rights in the channel chat'); };
  const res = await post(`/api/content/${item.id}/publish`);
  assert.equal(res.status, 502);
  let [after] = await items();
  assert.equal(after.status, 'failed');
  assert.match(after.last_error, /administrator rights/);
  telegram.copyMessage = original;
  assert.equal((await post(`/api/content/${item.id}/publish`)).status, 200);
  [after] = await items();
  assert.equal(after.status, 'published');
  assert.equal(after.last_error, null);
});

test('cancel removes a waiting post (whole album) and restore brings it back', async () => {
  await app(hook(channelPost({ updateId: 1, messageId: 30, extra: { text: undefined, photo: [{ file_id: 'a' }], media_group_id: 'g' } })));
  await app(hook(channelPost({ updateId: 2, messageId: 31, extra: { text: undefined, photo: [{ file_id: 'b' }], media_group_id: 'g' } })));
  const [first] = await items();
  const res = await post(`/api/content/${first.id}/cancel`);
  assert.deepEqual(await res.json(), { ok: true, changed: 2, status: 'cancelled' });
  assert.equal((await items('?status=cancelled')).length, 2);
  assert.equal((await post(`/api/content/${first.id}/publish`)).status, 409, 'cancelled items cannot be published');
  assert.equal((await post(`/api/content/${first.id}/cancel`)).status, 409);
  await post(`/api/content/${first.id}/restore`);
  assert.equal((await items('?status=received')).length, 2);
});

test('published or protected items cannot be cancelled', async () => {
  await app(hook(channelPost({ updateId: 1, messageId: 1 })));
  await app(hook(channelPost({ updateId: 2, messageId: 2, extra: { has_protected_content: true } })));
  const list = await items();
  const received = list.find((i) => i.status === 'received');
  const skipped = list.find((i) => i.status === 'skipped');
  await post(`/api/content/${received.id}/publish`);
  assert.equal((await post(`/api/content/${received.id}/cancel`)).status, 409);
  assert.equal((await post(`/api/content/${skipped.id}/cancel`)).status, 409);
  assert.equal((await post('/api/content/9999/cancel')).status, 404);
});

test('test post goes silently to a registered destination only', async () => {
  const ok = await post('/api/chats/-9009/test');
  assert.equal(ok.status, 200);
  const [, chatId, text, options] = telegram.calls.find(([m]) => m === 'sendMessage');
  assert.equal(chatId, -9009);
  assert.match(text, /CloneGRAM/);
  assert.equal(options.disable_notification, true);
  assert.equal((await post('/api/chats/-1001/test')).status, 404, 'sources are not test targets');
});

test('item actions require the admin token', async () => {
  const res = await app(new Request('https://api.test/api/content/1/publish', { method: 'POST' }));
  assert.equal(res.status, 401);
});
