import { TelegramApiError } from '../telegram/client.js';

const ACTIONABLE = new Set(['received', 'failed']);

export class PublishError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Human-triggered publish of one queue item (and its album siblings) to a registered destination.
 * Uses copyMessage/copyMessages, so Telegram itself refuses protected content; we never try another route.
 * Claiming rows before calling Telegram makes double clicks and retries unable to double-publish.
 */
export async function publishItem({ store, telegram, id, destinationChatId, now = () => new Date() }) {
  const item = await store.getContentItem(id);
  if (!item) throw new PublishError(404, 'item_not_found');
  if (item.status === 'skipped') throw new PublishError(409, 'item_protected');
  if (!ACTIONABLE.has(item.status)) throw new PublishError(409, 'item_not_publishable', { status: item.status });

  const source = await store.getActiveSource(item.telegram_chat_id);
  if (!source) throw new PublishError(409, 'source_not_active');

  const destination = await pickDestination(store, destinationChatId);
  const group = (await store.getItemWithGroup(item)).filter((row) => ACTIONABLE.has(row.status));
  const at = now().toISOString();
  const claimed = new Set(await store.claimForPublish(group.map((row) => row.id), at));
  const batch = group.filter((row) => claimed.has(row.id));
  if (batch.length === 0) throw new PublishError(409, 'already_in_progress');

  const messageIds = batch.map((row) => row.telegram_message_id).sort((a, b) => a - b);
  const ids = batch.map((row) => row.id);
  try {
    const client = telegram();
    const result = messageIds.length === 1
      ? [await client.copyMessage(destination.telegram_chat_id, item.telegram_chat_id, messageIds[0])]
      : await client.copyMessages(destination.telegram_chat_id, item.telegram_chat_id, messageIds);
    const firstMessageId = result?.[0]?.message_id ?? null;
    await store.markPublished(ids, { chatId: destination.telegram_chat_id, messageId: firstMessageId, at: now().toISOString() });
    return { ids, destination: { chatId: destination.telegram_chat_id, title: destination.title }, messageId: firstMessageId };
  } catch (error) {
    const description = error instanceof TelegramApiError ? error.description : 'unexpected_error';
    await store.markFailed(ids, description, now().toISOString());
    throw error;
  }
}

async function pickDestination(store, destinationChatId) {
  if (destinationChatId !== undefined && destinationChatId !== null) {
    if (!Number.isSafeInteger(destinationChatId)) throw new PublishError(400, 'invalid_destination');
    const destination = await store.getActiveDestination(destinationChatId);
    if (!destination) throw new PublishError(404, 'destination_not_found');
    return destination;
  }
  const destinations = await store.listActiveDestinations();
  if (destinations.length === 0) throw new PublishError(409, 'no_destination');
  if (destinations.length > 1) throw new PublishError(400, 'destination_required', { destinations: destinations.map((d) => ({ chatId: d.telegram_chat_id, title: d.title })) });
  return destinations[0];
}

/** Cancels a waiting item (and its album); `restore` puts cancelled items back in the queue. */
export async function changeQueueState({ store, id, action, now = () => new Date() }) {
  const item = await store.getContentItem(id);
  if (!item) throw new PublishError(404, 'item_not_found');
  const [from, to] = action === 'cancel' ? [['received', 'failed'], 'cancelled'] : [['cancelled'], 'received'];
  if (!from.includes(item.status)) throw new PublishError(409, action === 'cancel' ? 'item_not_cancellable' : 'item_not_restorable', { status: item.status });
  const group = await store.getItemWithGroup(item);
  const changed = await store.transition(group.map((row) => row.id), from, to, now().toISOString());
  return { changed, status: to };
}
