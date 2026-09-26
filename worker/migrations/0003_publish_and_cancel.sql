-- Adds manual publishing and cancellation to the content queue.
-- SQLite cannot alter a CHECK constraint, so content_items is rebuilt (nothing references it).
CREATE TABLE content_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  source_id INTEGER NOT NULL REFERENCES chats(id),
  telegram_chat_id INTEGER NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  text TEXT,
  file_id TEXT,
  media_group_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'in_review', 'scheduled', 'publishing', 'published', 'cancelled', 'skipped', 'failed')),
  skip_reason TEXT,
  posted_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  published_chat_id INTEGER,
  published_message_id INTEGER,
  published_at TEXT,
  last_error TEXT,
  updated_at TEXT,
  UNIQUE (workspace_id, telegram_chat_id, telegram_message_id)
);

INSERT INTO content_items_new (id, workspace_id, source_id, telegram_chat_id, telegram_message_id, media_type, text, file_id, media_group_id, status, skip_reason, posted_at, received_at)
SELECT id, workspace_id, source_id, telegram_chat_id, telegram_message_id, media_type, text, file_id, media_group_id, status, skip_reason, posted_at, received_at FROM content_items;

DROP TABLE content_items;
ALTER TABLE content_items_new RENAME TO content_items;

CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items (workspace_id, status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_group ON content_items (workspace_id, telegram_chat_id, media_group_id);
