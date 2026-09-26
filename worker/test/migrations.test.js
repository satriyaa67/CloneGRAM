import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const sql = (name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

test('0003 keeps existing queue rows and allows the new statuses', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql('0001_init.sql'));
  db.exec(sql('0002_discovered_chats.sql'));
  db.exec(`INSERT INTO chats (telegram_chat_id, role, title, chat_type, last_checked_at, created_at) VALUES (-1001, 'source', 'S', 'channel', 't', 't');
           INSERT INTO content_items (source_id, telegram_chat_id, telegram_message_id, media_type, text, status, posted_at, received_at)
           VALUES (1, -1001, 10, 'text', 'Merhaba', 'received', 't', 't'), (1, -1001, 11, 'text', NULL, 'skipped', 't', 't');`);
  db.exec(sql('0003_publish_and_cancel.sql'));
  const rows = db.prepare('SELECT id, text, status, published_chat_id FROM content_items ORDER BY id').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [
    { id: 1, text: 'Merhaba', status: 'received', published_chat_id: null },
    { id: 2, text: null, status: 'skipped', published_chat_id: null },
  ]);
  db.exec("UPDATE content_items SET status = 'cancelled' WHERE id = 1");
  assert.throws(() => db.exec("UPDATE content_items SET status = 'bogus' WHERE id = 1"));
  db.exec("INSERT INTO content_items (source_id, telegram_chat_id, telegram_message_id, media_type, status, posted_at, received_at) VALUES (1, -1001, 12, 'text', 'received', 't', 't')");
  assert.equal(db.prepare('SELECT MAX(id) AS m FROM content_items').get().m, 3, 'autoincrement continues');
});
