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
    webhookInfo: { url: 'https://api.test/telegram/webhook', pending_update_count: 0 },
    nextMessageId: 500,
    async sendMessage(chatId, text, options) { calls.push(['sendMessage', chatId, text, options]); return { message_id: this.nextMessageId++ }; },
    async copyMessage(chatId, fromChatId, messageId) { calls.push(['copyMessage', chatId, fromChatId, messageId]); return { message_id: this.nextMessageId++ }; },
    async copyMessages(chatId, fromChatId, messageIds) { calls.push(['copyMessages', chatId, fromChatId, messageIds]); return messageIds.map(() => ({ message_id: this.nextMessageId++ })); },
    async getWebhookInfo() { calls.push(['getWebhookInfo']); return this.webhookInfo; },
  };
}

export function membershipUpdate({ updateId = 50, chatId = -1001, title = 'Studio Notes', type = 'channel', username = 'studio_notes', status = 'administrator', canPost } = {}) {
  const member = { status, user: { id: BOT.id, is_bot: true } };
  if (canPost !== undefined) member.can_post_messages = canPost;
  return {
    update_id: updateId,
    my_chat_member: { chat: { id: chatId, type, title, username }, from: { id: 1 }, date: 1790400000, old_chat_member: { status: 'left' }, new_chat_member: member },
  };
}
