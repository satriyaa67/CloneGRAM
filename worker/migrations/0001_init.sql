-- CloneGRAM Phase 1 schema: registered Telegram chats and the content intake queue.
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  telegram_chat_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('source', 'destination')),
  title TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  username TEXT,
  protected_content INTEGER NOT NULL DEFAULT 0,
  rights_confirmed INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, telegram_chat_id, role)
);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  source_id INTEGER NOT NULL REFERENCES chats(id),
  telegram_chat_id INTEGER NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  text TEXT,
  file_id TEXT,
  media_group_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'in_review', 'scheduled', 'published', 'skipped', 'failed')),
  skip_reason TEXT,
  posted_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE (workspace_id, telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items (workspace_id, status, received_at DESC);
