const CHAT_COLUMNS = 'id, workspace_id, telegram_chat_id, role, title, chat_type, username, protected_content, rights_confirmed, active, last_checked_at, created_at';
const ITEM_COLUMNS = `i.id, i.source_id, i.telegram_chat_id, i.telegram_message_id, i.media_type, i.text, i.file_id, i.media_group_id, i.status, i.skip_reason,
  i.posted_at, i.received_at, i.published_chat_id, i.published_message_id, i.published_at, i.last_error,
  c.title AS source_title, c.username AS source_username, d.title AS destination_title`;
const ITEM_FROM = `FROM content_items i
  LEFT JOIN chats c ON c.id = i.source_id
  LEFT JOIN chats d ON d.workspace_id = i.workspace_id AND d.telegram_chat_id = i.published_chat_id AND d.role = 'destination'`;
const ACTIONABLE = "('received', 'failed')";
const DELETABLE = "('received', 'failed', 'cancelled')";
const ACTIVE_BOT_STATUSES = "('creator', 'administrator', 'member', 'restricted')";
const STATUSES = new Set(['received', 'in_review', 'scheduled', 'publishing', 'published', 'cancelled', 'skipped', 'failed']);

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
        ? db.prepare(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE i.workspace_id = ? AND i.status = ? ORDER BY i.received_at DESC, i.id DESC LIMIT ?`).bind(workspaceId, status, safeLimit)
        : db.prepare(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE i.workspace_id = ? ORDER BY i.received_at DESC, i.id DESC LIMIT ?`).bind(workspaceId, safeLimit);
      const { results } = await statement.all();
      return results ?? [];
    },

    async upsertDiscoveredChat({ workspaceId = 'default', telegramChatId, title, type, username, botStatus, canPost, updatedAt }) {
      await db
        .prepare(
          `INSERT INTO discovered_chats (workspace_id, telegram_chat_id, title, chat_type, username, bot_status, can_post, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (workspace_id, telegram_chat_id) DO UPDATE SET
             title = excluded.title, chat_type = excluded.chat_type, username = excluded.username,
             bot_status = excluded.bot_status, can_post = excluded.can_post, updated_at = excluded.updated_at`,
        )
        .bind(workspaceId, telegramChatId, title, type, username ?? null, botStatus, canPost === null || canPost === undefined ? null : canPost ? 1 : 0, updatedAt)
        .run();
    },

    /** Chats the bot currently belongs to, with the roles already registered for each. */
    async listDiscoveredChats(workspaceId = 'default') {
      const { results } = await db
        .prepare(
          `SELECT d.telegram_chat_id, d.title, d.chat_type, d.username, d.bot_status, d.can_post, d.updated_at,
                  (SELECT GROUP_CONCAT(role) FROM chats c WHERE c.workspace_id = d.workspace_id AND c.telegram_chat_id = d.telegram_chat_id AND c.active = 1) AS registered_roles
           FROM discovered_chats d
           WHERE d.workspace_id = ? AND d.bot_status IN ${ACTIVE_BOT_STATUSES}
           ORDER BY d.updated_at DESC`,
        )
        .bind(workspaceId)
        .all();
      return results ?? [];
    },

    async summary(workspaceId = 'default') {
      const content = await db
        .prepare('SELECT status, COUNT(*) AS n FROM content_items WHERE workspace_id = ? GROUP BY status')
        .bind(workspaceId)
        .all();
      const chats = await db
        .prepare('SELECT role, COUNT(*) AS n FROM chats WHERE workspace_id = ? AND active = 1 GROUP BY role')
        .bind(workspaceId)
        .all();
      const toMap = (rows, key) => Object.fromEntries((rows.results ?? []).map((row) => [row[key], Number(row.n)]));
      return { content: toMap(content, 'status'), chats: toMap(chats, 'role') };
    },

    async getContentItem(id, workspaceId = 'default') {
      return db.prepare(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE i.workspace_id = ? AND i.id = ?`).bind(workspaceId, id).first();
    },

    /** The item plus its album siblings (same source and media_group_id), oldest message first. */
    async getItemWithGroup(item, workspaceId = 'default') {
      if (!item.media_group_id) return [item];
      const { results } = await db
        .prepare(`SELECT ${ITEM_COLUMNS} ${ITEM_FROM} WHERE i.workspace_id = ? AND i.telegram_chat_id = ? AND i.media_group_id = ? ORDER BY i.telegram_message_id`)
        .bind(workspaceId, item.telegram_chat_id, item.media_group_id)
        .all();
      return results ?? [item];
    },

    /** Atomically moves actionable items to `publishing`; returns only the ids this call claimed. */
    async claimForPublish(ids, at, workspaceId = 'default') {
      if (ids.length === 0) return [];
      const marks = ids.map(() => '?').join(', ');
      const { results } = await db
        .prepare(`UPDATE content_items SET status = 'publishing', last_error = NULL, updated_at = ? WHERE workspace_id = ? AND id IN (${marks}) AND status IN ${ACTIONABLE} RETURNING id`)
        .bind(at, workspaceId, ...ids)
        .all();
      return (results ?? []).map((row) => row.id);
    },

    async markPublished(ids, { chatId, messageId, at }, workspaceId = 'default') {
      if (ids.length === 0) return;
      const marks = ids.map(() => '?').join(', ');
      await db
        .prepare(`UPDATE content_items SET status = 'published', published_chat_id = ?, published_message_id = ?, published_at = ?, last_error = NULL, updated_at = ? WHERE workspace_id = ? AND id IN (${marks}) AND status = 'publishing'`)
        .bind(chatId, messageId, at, at, workspaceId, ...ids)
        .run();
    },

    async markFailed(ids, error, at, workspaceId = 'default') {
      if (ids.length === 0) return;
      const marks = ids.map(() => '?').join(', ');
      await db
        .prepare(`UPDATE content_items SET status = 'failed', last_error = ?, updated_at = ? WHERE workspace_id = ? AND id IN (${marks}) AND status = 'publishing'`)
        .bind(String(error).slice(0, 500), at, workspaceId, ...ids)
        .run();
    },

    /** from -> to for the given ids; returns how many rows changed. */
    async transition(ids, from, to, at, workspaceId = 'default') {
      if (ids.length === 0) return 0;
      const marks = ids.map(() => '?').join(', ');
      const fromMarks = from.map(() => '?').join(', ');
      const result = await db
        .prepare(`UPDATE content_items SET status = ?, updated_at = ? WHERE workspace_id = ? AND id IN (${marks}) AND status IN (${fromMarks})`)
        .bind(to, at, workspaceId, ...ids, ...from)
        .run();
      return result?.meta?.changes ?? 0;
    },

    /** Deletes only rows that are still waiting, failed or cancelled; returns how many were removed. */
    async deleteQueued(ids, workspaceId = 'default') {
      if (ids.length === 0) return 0;
      const marks = ids.map(() => '?').join(', ');
      const result = await db
        .prepare(`DELETE FROM content_items WHERE workspace_id = ? AND id IN (${marks}) AND status IN ${DELETABLE}`)
        .bind(workspaceId, ...ids)
        .run();
      return result?.meta?.changes ?? 0;
    },

    async getActiveDestination(telegramChatId, workspaceId = 'default') {
      return db
        .prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE workspace_id = ? AND telegram_chat_id = ? AND role = 'destination' AND active = 1`)
        .bind(workspaceId, telegramChatId)
        .first();
    },

    async listActiveDestinations(workspaceId = 'default') {
      const { results } = await db
        .prepare(`SELECT ${CHAT_COLUMNS} FROM chats WHERE workspace_id = ? AND role = 'destination' AND active = 1 ORDER BY title`)
        .bind(workspaceId)
        .all();
      return results ?? [];
    },
  };
}
