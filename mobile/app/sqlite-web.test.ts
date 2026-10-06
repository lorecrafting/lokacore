import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { SQLiteDatabase } from 'expo-sqlite';
import { webDb } from './sqlite-web.ts';

// Breaks: Web bulk reads overflow, or SELECT paging loses bindings, row order or tail rows.
test('Web reads preserve bound ordered rows beyond the bulk response capacity', (t) => {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec('CREATE TABLE item (id INTEGER PRIMARY KEY, value TEXT)');
  const text = 'x'.repeat(4_000);
  const insert = sql.prepare('INSERT INTO item VALUES (?, ?)');
  insert.run(1, null);
  for (let id = 2; id <= 300; id++) insert.run(id, text);
  const native = {
    getAllSync(query: string, ...params: (string | number | null)[]) {
      const rows = sql
        .prepare(query)
        .all(...params)
        .map((row) => ({ ...row }));
      // Controlled stand-in for the external Web bridge's fixed response buffer.
      if (Buffer.byteLength(JSON.stringify(rows)) > 1_048_572)
        throw new Error('Sync operation timeout');
      return rows;
    },
  };
  const db = webDb(native as unknown as SQLiteDatabase);
  const rows = db.getAllSync<{ id: number; content: string }>(
    'SELECT id,value AS content FROM item WHERE id > ? AND id <= ? ORDER BY id DESC',
    1,
    300,
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    Array.from({ length: 299 }, (_, i) => 300 - i),
  );
  assert.ok(rows.every((row) => row.content === text));
  assert.deepEqual(db.getAllSync('SELECT id,value FROM item WHERE id = ?', 1), [
    { id: 1, value: null },
  ]);
  assert.deepEqual(db.getAllSync('SELECT id,value FROM item WHERE id = ?', 301), []);
  sql.exec('PRAGMA user_version = 7');
  assert.deepEqual(db.getAllSync('PRAGMA user_version'), [{ user_version: 7 }]);
});
