import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkChatAccess } from '../src/telegram/permissions.js';
import { fakeTelegram, BOT } from './helpers/fixtures.js';

const channel = (extra = {}) => ({ id: -1001, type: 'channel', title: 'Kaynak', ...extra });

test('accepts an unprotected source channel the bot belongs to', async () => {
  const client = fakeTelegram({ chats: { [-1001]: channel() }, members: { [-1001]: { status: 'administrator' } } });
  const result = await checkChatAccess(client, -1001, 'source');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.ok, true);
});

test('rejects protected sources and missing membership', async () => {
  const client = fakeTelegram({ chats: { [-1001]: channel({ has_protected_content: true }) }, members: {} });
  const result = await checkChatAccess(client, -1001, 'source');
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons.sort(), ['bot_not_member', 'source_content_protected']);
});

test('requires group read access for group sources', async () => {
  const group = { id: -2002, type: 'supergroup', title: 'Grup' };
  const client = fakeTelegram({ chats: { [-2002]: group }, members: { [-2002]: { status: 'member' } } });
  assert.deepEqual((await checkChatAccess(client, -2002, 'source')).reasons, ['bot_cannot_read_group_messages']);
  const reader = fakeTelegram({ me: { ...BOT, can_read_all_group_messages: true }, chats: { [-2002]: group }, members: { [-2002]: { status: 'member' } } });
  assert.equal((await checkChatAccess(reader, -2002, 'source')).ok, true);
});

test('destination channel needs admin with can_post_messages', async () => {
  const noPost = fakeTelegram({ chats: { [-1001]: channel() }, members: { [-1001]: { status: 'administrator', can_post_messages: false } } });
  assert.deepEqual((await checkChatAccess(noPost, -1001, 'destination')).reasons, ['bot_cannot_post']);
  const member = fakeTelegram({ chats: { [-1001]: channel() }, members: { [-1001]: { status: 'member' } } });
  assert.deepEqual((await checkChatAccess(member, -1001, 'destination')).reasons, ['bot_not_admin']);
  const ok = fakeTelegram({ chats: { [-1001]: channel() }, members: { [-1001]: { status: 'administrator', can_post_messages: true } } });
  assert.equal((await checkChatAccess(ok, -1001, 'destination')).ok, true);
});

test('never accepts private chats', async () => {
  const client = fakeTelegram({ chats: { 42: { id: 42, type: 'private', username: 'someone' } }, members: { 42: { status: 'member' } } });
  assert.deepEqual((await checkChatAccess(client, 42, 'destination')).reasons, ['private_chats_not_supported']);
});
