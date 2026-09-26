import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migrationsDir = new URL('../../migrations/', import.meta.url);
const schema = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n');

/** In-memory stand-in for a Cloudflare D1 binding, backed by node:sqlite and every real migration in order. */
export function createTestD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return {
    prepare(query) {
      const statement = db.prepare(query);
      let params = [];
      const api = {
        bind(...values) {
          params = values;
          return api;
        },
        async run() {
          const result = statement.run(...params);
          return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
        async first() {
          const row = statement.get(...params);
          return row ? { ...row } : null;
        },
        async all() {
          return { success: true, results: statement.all(...params).map((row) => ({ ...row })) };
        },
      };
      return api;
    },
  };
}
