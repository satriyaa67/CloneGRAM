const MEDIA_TYPES = ['photo', 'video', 'animation', 'document', 'audio', 'voice', 'video_note', 'sticker'];

/** Turns a raw Telegram Update into a small, storage-ready shape. Never downloads anything. */
export function normalizeUpdate(update) {
  if (!update || typeof update !== 'object' || !Number.isInteger(update.update_id)) {
    return { kind: 'invalid', reason: 'missing_update_id' };
  }
  const updateId = update.update_id;
  if (update.my_chat_member) return normalizeMembership(updateId, update.my_chat_member);
  const message = update.channel_post ?? update.message;
  if (!message) {
    const type = Object.keys(update).find((key) => key !== 'update_id') ?? 'empty';
    return { kind: 'ignored', updateId, reason: `unsupported_update:${type}` };
  }
  const chat = message.chat ?? {};
  if (chat.type === 'private') return { kind: 'ignored', updateId, reason: 'private_chat' };

  const mediaType = MEDIA_TYPES.find((type) => message[type] !== undefined) ?? (typeof message.text === 'string' ? 'text' : null);
  if (!mediaType) return { kind: 'ignored', updateId, reason: 'unsupported_message' };

  return {
    kind: 'post',
    updateId,
    chatId: chat.id,
    chatType: chat.type,
    messageId: message.message_id,
    date: message.date,
    mediaType,
    text: message.text ?? message.caption ?? null,
    fileId: fileIdOf(message, mediaType),
    mediaGroupId: message.media_group_id ?? null,
    protectedContent: message.has_protected_content === true,
  };
}

function fileIdOf(message, mediaType) {
  if (mediaType === 'text') return null;
  if (mediaType === 'photo') {
    const sizes = message.photo;
    return Array.isArray(sizes) && sizes.length > 0 ? sizes[sizes.length - 1].file_id ?? null : null;
  }
  return message[mediaType]?.file_id ?? null;
}

function normalizeMembership(updateId, change) {
  const chat = change.chat ?? {};
  if (!Number.isSafeInteger(chat.id) || chat.type === 'private') return { kind: 'ignored', updateId, reason: 'private_chat' };
  const member = change.new_chat_member ?? {};
  return {
    kind: 'membership',
    updateId,
    chatId: chat.id,
    chatType: chat.type,
    title: chat.title ?? chat.username ?? String(chat.id),
    username: chat.username ?? null,
    botStatus: typeof member.status === 'string' ? member.status : 'unknown',
    canPost: typeof member.can_post_messages === 'boolean' ? member.can_post_messages : null,
  };
}
