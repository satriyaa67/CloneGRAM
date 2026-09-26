const CHAT_COLUMNS = 'id, workspace_id, telegram_chat_id, role, title, chat_type, username, protected_content, rights_confirmed, active, last_checked_at, created_at';
const ITEM_COLUMNS = 'id, source_id, telegram_chat_id, telegram_message_id, media_type, text, file_id, media_group_id, status, skip_reason, posted_at, received_at';
const STATUSES = new Set(['received', 'in_review', 'scheduled', 'published', 'skipped', 'failed']);

/** Storage adapter over a Cloudflare D1 binding (prepare/bind/run/first/all). */
export function createD1Store(db) {
  async function getChat(workspaceId, telegramChatId, role) {
    return db
      .prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE workspace_id = ? AND telegram_chat_id = ? AND role = ?`)
      .bind(workspaceId, telegramChatId, role)
      .first();
  }

  return {
    getChat,

    async upsertChat({ workspaceId = 'default', telegramChatId, role, title, type, username, protectedContent, rightsConfirmed, checkedAt }) {
      await db
        .prepare(
          `INSERT INTO chats (workspace_id, telegram_chat_id, role, title, chat_type, username, protected_content, rights_confirmed, active, last_checked_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT (workspace_id, telegram_chat_id, role) DO UPDATE SET
             title = excluded.title, chat_type = excluded.chat_type, username = excluded.username,
             protected_content = excluded.protected_content, rights_confirmed = excluded.rights_confirmed,
             active = 1, last_checked_at = excluded.last_checked_at`,
        )
        .bind(workspaceId, telegramChatId, role, title, type, username ?? null, protectedContent ? 1 : 0, rightsConfirmed ? 1 : 0, checkedAt, checkedAt)
        .run();
      return getChat(workspaceId, telegramChatId, role);
    },

    async getActiveSource(telegramChatId, workspaceId = 'default') {
      return db
        .prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE workspace_id = ? AND telegram_chat_id = ? AND role = 'source' AND active = 1 AND rights_confirmed = 1`)
        .bind(workspaceId, telegramChatId)
        .first();
    },

    async listChats(workspaceId = 'default') {
      const { results } = await db
        .prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE workspace_id = ? ORDER BY role, title`)
        .bind(workspaceId)
        .all();
      return results ?? [];
    },

    async insertContentItem(item) {
      const result = await db
        .prepare(
          `INSERT INTO content_items (workspace_id, source_id, telegram_chat_id, telegram_message_id, media_type, text, file_id, media_group_id, status, skip_reason, posted_at, received_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (workspace_id, telegram_chat_id, telegram_message_id) DO NOTHING`,
        )
        .bind(
          item.workspaceId ?? 'default', item.sourceId, item.telegramChatId, item.telegramMessageId, item.mediaType,
          item.text ?? null, item.fileId ?? null, item.mediaGroupId ?? null, item.status, item.skipReason ?? null,
          item.postedAt, item.receivedAt,
        )
        .run();
      return (result?.meta?.changes ?? 0) > 0;
    },

    async listContentItems({ workspaceId = 'default', status, limit = 50 } = {}) {
      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
      if (status !== undefined && !STATUSES.has(status)) throw new RangeError(`Unknown status: ${status}`);
      const statement = status
        ? db.prepare(`SELECT ${ITEM_COLUMNS} FROM content_items WHERE workspace_id = ? AND status = ? ORDER BY received_at DESC, id DESC LIMIT ?`).bind(workspaceId, status, safeLimit)
        : db.prepare(`SELECT ${ITEM_COLUMNS} FROM content_items WHERE workspace_id = ? ORDER BY received_at DESC, id DESC LIMIT ?`).bind(workspaceId, safeLimit);
      const { results } = await statement.all();
      return results ?? [];
    },
  };
}
