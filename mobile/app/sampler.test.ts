// Execute the app shell with native APIs replaced by controlled Node equivalents.
// This checks the real App -> localSession -> SQLite path, without rendering a phone UI.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { localSession, openGame } from '../authority/local-story/session.ts';
import type { Db } from '../authority/local-story/store.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const adapt = (sql: DatabaseSync): Db => ({
  execSync: (s) => void sql.exec(s),
  runSync: (s, ...p) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    (sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});

// Breaks: the app bundles Lantern again or opens/deletes the Lantern file for the sampler,
// including Start over. Actual saved pins and untouched Lantern bytes are the assertions.
test('the app opens and replaces only its sampler save, preserving an existing Lantern save', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-app-sampler-'));
  const lanternPath = join(dir, 'loka-lantern.db');
  const sql = new DatabaseSync(lanternPath);
  openGame(
    adapt(sql),
    JSON.parse(
      readFileSync(
        new URL('../../protocol/fixtures/cartridge_lantern_hash.json', import.meta.url),
        'utf8',
      ),
    ),
    {
      kernel_version: `loka-kernel@${'0'.repeat(40)}`,
      newId: randomUUID,
    },
  );
  sql.close();
  const checksum = () => createHash('sha256').update(readFileSync(lanternPath)).digest('hex');
  const before = checksum();
  const connections: DatabaseSync[] = [];
  let id = 0;
  const native = {
    openDatabaseSync: (name: string) => {
      const connection = new DatabaseSync(join(dir, name));
      connections.push(connection);
      return { ...adapt(connection), closeSync: () => connection.close() };
    },
    deleteDatabaseSync: (name: string) => rmSync(join(dir, name)),
  };
  const modules: Record<string, unknown> = {
    react: {},
    'react-native': {},
    'expo-crypto': {
      randomUUID: () => `aaaaaaaa-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    },
    'expo-font': {},
    'expo-sqlite': native,
    'expo-sqlite/kv-store': {},
    '../authority/local-story/session': { localSession, KERNEL_ID: 'loka-kernel' },
    './book/Book.tsx': {},
    './book/model.ts': { hint: () => ({}) },
    './SaveError': {},
  };
  const globals: { loka_session?: ReturnType<typeof localSession> } = {};
  const compiled = ts.transpileModule(readFileSync(new URL('App.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  try {
    runInNewContext(compiled, {
      exports: {},
      require: (name: string) => {
        if (name.endsWith('.json'))
          return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
        if (name.endsWith('.ttf')) return 1;
        assert.ok(Object.hasOwn(modules, name), name);
        return modules[name];
      },
      globalThis: globals,
      process: { env: { EXPO_PUBLIC_KERNEL_COMMIT: '0'.repeat(40) } },
      __DEV__: false,
      performance,
    });
    assert.ok(globals.loka_session!.game());
    const pin = () => {
      const database = new DatabaseSync(join(dir, 'loka-ashmere-sampler.db'), { readOnly: true });
      try {
        return JSON.parse(database.prepare('SELECT pin FROM save').get()!.pin as string);
      } finally {
        database.close();
      }
    };
    assert.equal(pin().cartridge_id, 'ashmere_sampler');
    assert.equal(
      pin().content_hash,
      '813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa',
    );
    assert.equal(globals.loka_session!.startOver(), undefined);
    assert.equal(pin().cartridge_id, 'ashmere_sampler');
    assert.equal(checksum(), before);
  } finally {
    connections.at(-1)?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
