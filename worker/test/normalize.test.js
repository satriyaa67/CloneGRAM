import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpdate } from '../src/intake/normalize.js';
import { channelPost } from './helpers/fixtures.js';

test('normalizes a text channel post', () => {
  const post = normalizeUpdate(channelPost());
  assert.equal(post.kind, 'post');
  assert.equal(post.mediaType, 'text');
  assert.equal(post.text, 'Merhaba');
  assert.equal(post.fileId, null);
  assert.equal(post.protectedContent, false);
});

test('picks the largest photo and keeps the caption', () => {
  const update = channelPost({ extra: { text: undefined, caption: 'Kare', photo: [{ file_id: 'small' }, { file_id: 'large' }] } });
  const post = normalizeUpdate(update);
  assert.equal(post.mediaType, 'photo');
  assert.equal(post.fileId, 'large');
  assert.equal(post.text, 'Kare');
});

test('reads video file references and album ids', () => {
  const post = normalizeUpdate(channelPost({ extra: { text: undefined, video: { file_id: 'vid' }, media_group_id: 'album1' } }));
  assert.equal(post.mediaType, 'video');
  assert.equal(post.fileId, 'vid');
  assert.equal(post.mediaGroupId, 'album1');
});

test('flags protected messages', () => {
  const post = normalizeUpdate(channelPost({ extra: { has_protected_content: true } }));
  assert.equal(post.protectedContent, true);
});

test('ignores unsupported, private and service updates', () => {
  assert.equal(normalizeUpdate({ update_id: 5, callback_query: {} }).reason, 'unsupported_update:callback_query');
  assert.equal(normalizeUpdate({ update_id: 6, message: { message_id: 1, date: 1, chat: { id: 7, type: 'private' }, text: 'hi' } }).reason, 'private_chat');
  assert.equal(normalizeUpdate({ update_id: 7, message: { message_id: 1, date: 1, chat: { id: -5, type: 'supergroup' }, new_chat_members: [] } }).reason, 'unsupported_message');
  assert.equal(normalizeUpdate({}).kind, 'invalid');
});
