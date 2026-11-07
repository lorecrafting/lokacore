// The web App's save name and open, run with controlled platform modules and real SQLite files.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { INSTALLED, KERNEL_ID, localSession } from '../authority/local-story/session.ts';
import { webDb } from './sqlite-web.ts';

const ts = require_('typescript');
function require_(name: string) {
  return createRequire(import.meta.url)(name);
}
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../protocol/fixtures/${name}`, import.meta.url), 'utf8'));
const js = ts.transpileModule(readFileSync(new URL('App.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

/** One page load of the web App on `chapter`; the files it opened by name, and its session. */
async function load(dir: string, chapter: unknown, dev: boolean, opened: string[]) {
  const file = (name: string) => {
    const sql = new DatabaseSync(join(dir, name));
    return {
      execSync: (s: string) => void sql.exec(s),
      runSync: (s: string, ...p: any[]) => sql.prepare(s).run(...p),
      getFirstSync: (s: string, ...p: any[]) => sql.prepare(s).get(...p) ?? null,
      getAllSync: (s: string, ...p: any[]) => sql.prepare(s).all(...p),
      isInTransactionSync: () => sql.isTransaction,
      closeSync: () => sql.close(),
    };
  };
  let effect: (() => void) | undefined;
  const modules: Record<string, unknown> = {
    react: {
      useState: (v: unknown) => [typeof v === 'function' ? v() : v, () => {}],
      useRef: (v: unknown) => ({ current: v }),
      useEffect: (f: () => void) => void (effect ??= f), // the first is the web open
    },
    'react/jsx-runtime': { jsx: () => null },
    'react-native': { Platform: { OS: 'web' }, AppState: {}, Alert: {}, PixelRatio: {} },
    'expo-crypto': { randomUUID, getRandomValues: (a: Uint8Array) => crypto.getRandomValues(a) },
    'expo-font': { useFonts: () => [true] },
    'expo-sqlite': {
      openDatabaseAsync: async (name: string) => (opened.push(name), file(name)),
      openDatabaseSync: () => assert.fail('the web save opens once, asynchronously'),
      deleteDatabaseSync: () => assert.fail('a save file was deleted'),
    },
    'expo-sqlite/kv-store': {},
    '../authority/local-story/session': { INSTALLED, KERNEL_ID, localSession },
    './sqlite-web.ts': { webDb },
    './clock-tick': {},
    './book/Book.tsx': {},
    './book/model.ts': { hint: () => ({}) },
    './book/reading.ts': { readingSize: () => ({}), effectStores: () => ({}) },
    './book/labels.ts': { LABEL: {} },
    './SaveError': {},
    './author/panel.tsx': {
      devClock: false,
      bootPlace: () => assert.fail('only the dev clock replays a place'),
      played: (g: unknown) => g,
      useAuthorPanel() {},
    },
  };
  const globals: { loka_web_opening?: Promise<ReturnType<typeof localSession>> } = {},
    exports: any = {};
  runInNewContext(js, {
    exports,
    globalThis: globals,
    performance,
    process: { env: dev ? { EXPO_PUBLIC_LOKA_DEV_CARTRIDGE: '1' } : {} },
    __DEV__: dev,
    require: (name: string) =>
      name.endsWith('.json') ? chapter : name.endsWith('.ttf') ? 1 : modules[name],
  });
  exports.default();
  effect!();
  return globals.loka_web_opening!;
}

// Breaks: the dev save is named by the edited cartridge's hash again (the browser's six-file save
// pool fills within four edits, loka-wfrgk.58), a dev save pinned to another edit stays refused, or
// the release save stops refusing another build's pin (save.md: a pin mismatch is refused).
test('an edit reopens the one dev save started over; the release save keeps refusing', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-dev-save-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const [before, after] = [
    fixture('cartridge_dusk_hash.json'),
    fixture('toolbox_showcase_hash.json'),
  ];
  for (const dev of [true, false]) {
    const opened: string[] = [];
    const first = await load(dir, before, dev, opened);
    assert.ok(first.game(), JSON.stringify(first.failed()));
    const edited = await load(dir, after, dev, opened);
    assert.equal(opened[0], opened[1]);
    if (dev) {
      assert.equal(edited.failed(), undefined);
      assert.ok(edited.game());
    } else assert.equal(edited.failed()?.kind, 'pinned_release_missing');
  }
});
