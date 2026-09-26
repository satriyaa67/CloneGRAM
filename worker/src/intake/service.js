import { normalizeUpdate } from './normalize.js';

/**
 * Stores eligible posts from registered, rights-confirmed sources.
 * Protected messages are recorded as skipped WITHOUT their text or file reference.
 * Idempotent: the (chat, message) unique key makes Telegram webhook retries harmless.
 */
export async function processUpdate(update, { store, now = () => new Date(), workspaceId = 'default' }) {
  const post = normalizeUpdate(update);
  if (post.kind === 'invalid') return { status: 'invalid', reason: post.reason };
  if (post.kind === 'ignored') return { status: 'ignored', reason: post.reason };

  const source = await store.getActiveSource(post.chatId, workspaceId);
  if (!source) return { status: 'ignored', reason: 'unregistered_source' };

  const isProtected = post.protectedContent || source.protected_content === 1;
  const item = {
    workspaceId,
    sourceId: source.id,
    telegramChatId: post.chatId,
    telegramMessageId: post.messageId,
    mediaType: post.mediaType,
    text: isProtected ? null : post.text,
    fileId: isProtected ? null : post.fileId,
    mediaGroupId: post.mediaGroupId,
    status: isProtected ? 'skipped' : 'received',
    skipReason: isProtected ? 'protected_content' : null,
    postedAt: new Date(post.date * 1000).toISOString(),
    receivedAt: now().toISOString(),
  };
  const inserted = await store.insertContentItem(item);
  return inserted ? { status: item.status, reason: item.skipReason ?? undefined } : { status: 'duplicate' };
}
