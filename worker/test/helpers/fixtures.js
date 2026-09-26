export const BOT = { id: 999, is_bot: true, username: 'clonegram_bot', can_read_all_group_messages: false };

export function channelPost({ updateId = 1, chatId = -1001, messageId = 10, extra = {} } = {}) {
  return {
    update_id: updateId,
    channel_post: { message_id: messageId, date: 1790400000, chat: { id: chatId, type: 'channel', title: 'Studio Notes' }, text: 'Merhaba', ...extra },
  };
}

/** Fake Bot API client: chats keyed by id, members keyed by chat id. */
export function fakeTelegram({ me = BOT, chats = {}, members = {}, calls = [] } = {}) {
  return {
    calls,
    async getMe() { calls.push(['getMe']); return me; },
    async getChat(chatId) {
      calls.push(['getChat', chatId]);
      const chat = typeof chatId === 'string' && chatId.startsWith('@')
        ? Object.values(chats).find((c) => `@${c.username}` === chatId)
        : chats[chatId];
      if (!chat) throw Object.assign(new Error('chat not found'), { name: 'NotFound' });
      return chat;
    },
    async getChatMember(chatId, userId) { calls.push(['getChatMember', chatId, userId]); return members[chatId] ?? { status: 'left' }; },
    async setWebhook(options) { calls.push(['setWebhook', options]); return true; },
  };
}
