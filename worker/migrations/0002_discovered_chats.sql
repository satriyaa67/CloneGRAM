-- Chats the bot was added to (from my_chat_member updates), so operators can register them without looking up numeric ids.
CREATE TABLE IF NOT EXISTS discovered_chats (
  workspace_id TEXT NOT NULL DEFAULT 'default',
  telegram_chat_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  username TEXT,
  bot_status TEXT NOT NULL,
  can_post INTEGER,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, telegram_chat_id)
);
