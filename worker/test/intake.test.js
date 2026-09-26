import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { processUpdate } from '../src/intake/service.js';
import { createD1Store } from '../src/storage/d1.js';
import { createTestD1 } from './helpers/d1.js';
import { channelPost, membershipUpdate } from './helpers/fixtures.js';

let store;
const now = () => new Date('2026-09-26T10:00:00Z');

beforeEach(async () => {
  store = createD1Store(createTestD1());
  await store.upsertChat({ telegramChatId: -1001, role: 'source', title: 'Studio', type: 'channel', protectedContent: false, rightsConfirmed: true, checkedAt: now().toISOString() });
});

test('stores posts from a registered source', async () => {
  const result = await processUpdate(channelPost(), { store, now });
  assert.equal(result.status, 'received');
  const [item] = await store.listContentItems();
  assert.equal(item.text, 'Merhaba');
  assert.equal(item.status, 'received');
  assert.equal(item.posted_at, new Date(1790400000 * 1000).toISOString());
});

test('webhook retries are idempotent', async () => {
  await processUpdate(channelPost(), { store, now });
  const again = await processUpdate(channelPost({ updateId: 2 }), { store, now });
  assert.equal(again.status, 'duplicate');
  assert.equal((await store.listContentItems()).length, 1);
});

test('protected messages are skipped without content or file reference', async () => {
  const update = channelPost({ extra: { text: undefined, caption: 'gizli', video: { file_id: 'vid' }, has_protected_content: true } });
  const result = await processUpdate(update, { store, now });
  assert.deepEqual(result, { status: 'skipped', reason: 'protected_content' });
  const [item] = await store.listContentItems({ status: 'skipped' });
  assert.equal(item.text, null);
  assert.equal(item.file_id, null);
  assert.equal(item.skip_reason, 'protected_content');
});

test('sources flagged as protected skip everything', async () => {
  await store.upsertChat({ telegramChatId: -3003, role: 'source', title: 'Kilitli', type: 'channel', protectedContent: true, rightsConfirmed: true, checkedAt: now().toISOString() });
  const result = await processUpdate(channelPost({ chatId: -3003 }), { store, now });
  assert.equal(result.status, 'skipped');
});

test('ignores unregistered or unconfirmed sources', async () => {
  assert.equal((await processUpdate(channelPost({ chatId: -7777 }), { store, now })).reason, 'unregistered_source');
  await store.upsertChat({ telegramChatId: -4004, role: 'source', title: 'Onaysız', type: 'channel', protectedContent: false, rightsConfirmed: false, checkedAt: now().toISOString() });
  assert.equal((await processUpdate(channelPost({ chatId: -4004 }), { store, now })).reason, 'unregistered_source');
  assert.equal((await store.listContentItems()).length, 0);
});

test('a destination registration does not make a chat a source', async () => {
  await store.upsertChat({ telegramChatId: -5005, role: 'destination', title: 'Hedef', type: 'channel', protectedContent: false, rightsConfirmed: false, checkedAt: now().toISOString() });
  assert.equal((await processUpdate(channelPost({ chatId: -5005 }), { store, now })).reason, 'unregistered_source');
});

test('listContentItems validates status and clamps limit', async () => {
  await assert.rejects(store.listContentItems({ status: 'hacked' }), RangeError);
  for (let i = 0; i < 3; i++) await processUpdate(channelPost({ updateId: i, messageId: 100 + i }), { store, now });
  assert.equal((await store.listContentItems({ limit: 2 })).length, 2);
  assert.equal((await store.listContentItems({ limit: 'abc' })).length, 3);
});

test('membership updates never create queue items', async () => {
  const result = await processUpdate(membershipUpdate(), { store, now });
  assert.equal(result.status, 'membership_recorded');
  assert.equal((await store.listContentItems()).length, 0);
  const [chat] = await store.listDiscoveredChats();
  assert.equal(chat.title, 'Studio Notes');
});

test('re-adding a bot updates the discovered chat instead of duplicating it', async () => {
  await processUpdate(membershipUpdate({ status: 'member' }), { store, now });
  await processUpdate(membershipUpdate({ updateId: 51, status: 'administrator', title: 'Yeni ad' }), { store, now });
  const chats = await store.listDiscoveredChats();
  assert.equal(chats.length, 1);
  assert.equal(chats[0].title, 'Yeni ad');
  assert.equal(chats[0].bot_status, 'administrator');
});
