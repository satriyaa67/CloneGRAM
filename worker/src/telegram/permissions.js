const PRESENT = new Set(['creator', 'administrator', 'member', 'restricted']);
const ADMIN = new Set(['creator', 'administrator']);
const GROUP_TYPES = new Set(['group', 'supergroup']);

/**
 * Verifies that the bot can legitimately use a chat in the given role.
 * - source: bot is present, chat is not content-protected, and (for groups) the bot can read messages.
 * - destination: bot may post there (channel admin with can_post_messages, or group member allowed to send).
 */
export async function checkChatAccess(client, chatId, role) {
  if (role !== 'source' && role !== 'destination') throw new Error(`Unknown chat role: ${role}`);
  const me = await client.getMe();
  const chat = await client.getChat(chatId);
  const member = await client.getChatMember(chat.id, me.id);
  const reasons = [];
  const info = {
    telegramChatId: chat.id,
    title: chat.title ?? chat.username ?? String(chat.id),
    type: chat.type,
    username: chat.username ?? null,
    protectedContent: chat.has_protected_content === true,
  };

  if (chat.type === 'private') {
    reasons.push('private_chats_not_supported');
    return { ok: false, reasons, chat: info };
  }
  const present = PRESENT.has(member.status) && !(member.status === 'restricted' && member.is_member === false);

  if (role === 'source') {
    if (!present) reasons.push('bot_not_member');
    if (info.protectedContent) reasons.push('source_content_protected');
    if (GROUP_TYPES.has(chat.type) && !ADMIN.has(member.status) && me.can_read_all_group_messages !== true) {
      reasons.push('bot_cannot_read_group_messages');
    }
  } else if (chat.type === 'channel') {
    if (!ADMIN.has(member.status)) reasons.push('bot_not_admin');
    else if (member.status === 'administrator' && member.can_post_messages !== true) reasons.push('bot_cannot_post');
  } else {
    if (!present) reasons.push('bot_not_member');
    else if (member.status === 'restricted' && member.can_send_messages === false) reasons.push('bot_cannot_post');
  }
  return { ok: reasons.length === 0, reasons, chat: info };
}
