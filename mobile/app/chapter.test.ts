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
import { checkpoint, elapsedHost } from '../authority/local-story/__tests__/elapsed-host.test.ts';
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

// Breaks: the app bundles Lantern again or opens/deletes the Lantern file for the chapter,
// including Start over. Saved pins/title and untouched old save bytes are the assertions.
test('the app opens and replaces only its chapter save, preserving existing Lantern and sampler saves', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-app-chapter-'));
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
  const samplerPath = join(dir, 'loka-ashmere-sampler.db');
  const old = new DatabaseSync(samplerPath);
  openGame(
    adapt(old),
    JSON.parse(
      readFileSync(
        new URL('../../protocol/fixtures/containers_cartridge_sampler_hash.json', import.meta.url),
        'utf8',
      ),
    ),
    {
      kernel_version: `loka-kernel@${'0'.repeat(40)}`,
      newId: randomUUID,
      time: { wall: () => 10000, monotonic: () => 0 },
    },
  );
  old.close();
  const checksum = () =>
    [lanternPath, samplerPath].map((path) =>
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    );
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
    'react-native': { Platform: { OS: 'ios' } },
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
    const view = globals.loka_session!.game()!.view().view;
    assert.equal(view.chapter?.title, 'chapter.missing_child');
    assert.equal(
      globals.loka_session!.game()!.text('chapter.missing_child'),
      'The Missing Child — in progress',
    );
    assert.deepEqual(
      view.entities.map((e) => [e.kind, e.name]),
      [['npc', 'npc.elspeth.short']],
    );
    assert.deepEqual(view.journal, []);
    const pin = () => {
      const database = new DatabaseSync(join(dir, 'loka-ashmere-missing-child.db'), {
        readOnly: true,
      });
      try {
        return JSON.parse(database.prepare('SELECT pin FROM save').get()!.pin as string);
      } finally {
        database.close();
      }
    };
    assert.equal(pin().cartridge_id, 'ashmere_missing_child');
    assert.equal(
      pin().content_hash,
      '44b73946e32dad97e8e6386b22a91c353298cf6c70455b7c15fda69c1f0c195f',
    );
    assert.equal(globals.loka_session!.startOver(), undefined);
    assert.equal(pin().cartridge_id, 'ashmere_missing_child');
    assert.deepEqual(checksum(), before);
  } finally {
    connections.at(-1)?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// Breaks: the new chapter silently opens an old exact pin or deletes it before explicit Start over.
test('the 0.0.9 chapter save is refused intact until explicit Start over', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-chapter-pin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'chapter.db');
  const prior = JSON.parse(
    readFileSync(
      new URL('../../protocol/fixtures/missing_child_v009_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const current = JSON.parse(
    readFileSync(
      new URL('../../protocol/fixtures/missing_child_v015_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const host = {
    kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    newId: randomUUID,
    time: { wall: () => 10000, monotonic: () => 0 },
  };
  const old = new DatabaseSync(path);
  openGame(adapt(old), prior, host);
  old.close();
  const before = createHash('sha256').update(readFileSync(path)).digest('hex');
  const sql = new DatabaseSync(path);
  let removed = false;
  try {
    const session = localSession(
      () => adapt(sql),
      () => {
        removed = true;
      },
      current,
      host,
    );
    assert.equal(session.game(), undefined);
    assert.equal(session.failed()?.kind, 'pinned_release_missing');
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), before);
    assert.equal(removed, false);
    assert.equal(session.startOver(), undefined);
    assert.ok(session.game());
    assert.equal(
      JSON.parse(sql.prepare('SELECT pin FROM save').get()!.pin as string).content_hash,
      current.sha256,
    );
    assert.equal(removed, false);
  } finally {
    sql.close();
  }
});

// The actual App module receives controlled platform clocks/events and real rollback-journal SQLite.
// Native scheduling is controlled input; assertions concern confirmed worlds/checkpoints, not calls.
function appHost() {
  const chapter = JSON.parse(
    readFileSync(
      new URL('../../protocol/fixtures/missing_child_v015_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const state: any[] = [],
    effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  const queued: (() => void)[] = [],
    timers = new Map<number, { due: number; f: () => void }>();
  const listeners = new Set<(state: string) => void>();
  let slot = 0,
    timerId = 0,
    timerTime = 0,
    appState = 'active';
  const useState = (initial: any) => {
    const i = slot++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (v: any) => {
        state[i] = typeof v === 'function' ? v(state[i]) : v;
      },
    ];
  };
  const modules: Record<string, unknown> = {
    react: {
      useState,
      useRef: (v: any) => useState(() => ({ current: v }))[0],
      useEffect: (f: () => () => void, deps: unknown[]) => {
        const i = slot++,
          old = effects.get(i);
        if (
          old &&
          deps.length === old.deps.length &&
          deps.every((d, j) => Object.is(d, old.deps[j]))
        )
          return;
        queued.push(() => {
          old?.cleanup?.();
          effects.set(i, { deps, cleanup: f() });
        });
      },
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': {
      Alert: {},
      Platform: { OS: 'ios' },
      AppState: {
        get currentState() {
          return appState;
        },
        addEventListener: (_: string, f: (state: string) => void) => {
          listeners.add(f);
          return { remove: () => listeners.delete(f) };
        },
      },
    },
    'expo-crypto': { randomUUID },
    'expo-font': { useFonts: () => [true] },
    'expo-sqlite': {
      openDatabaseSync: () => ({ ...a.db, closeSync: () => a.sql.close() }),
      deleteDatabaseSync: () => {},
    },
    'expo-sqlite/kv-store': {},
    '../authority/local-story/session': { localSession, KERNEL_ID: 'loka-kernel' },
    './book/Book.tsx': { default: 'Book' },
    './book/model.ts': { hint: () => ({}) },
    './SaveError': {},
  };
  const globals: { loka_session?: ReturnType<typeof localSession> } = {},
    exports: any = {};
  const compiled = ts.transpileModule(readFileSync(new URL('App.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    globalThis: globals,
    process: { env: { EXPO_PUBLIC_KERNEL_COMMIT: '0'.repeat(40) } },
    __DEV__: false,
    Date: { now: () => a.clock.wall },
    performance: { now: () => a.clock.mono },
    setTimeout: (f: () => void, delay: number) => {
      const id = ++timerId;
      timers.set(id, { due: timerTime + delay, f });
      return id;
    },
    clearTimeout: (id: number) => timers.delete(id),
    require: (name: string) =>
      name.endsWith('.json') ? chapter : name.endsWith('.ttf') ? 1 : modules[name],
  });
  let book: any;
  const draw = () => {
    slot = 0;
    book = exports.default();
    for (const e of queued.splice(0)) e();
    return book;
  };
  const unmount = () => {
    for (const e of effects.values()) e.cleanup?.();
    effects.clear();
  };
  draw();
  return {
    ...a,
    get game() {
      return globals.loka_session!.game()!;
    },
    get shell() {
      return book.props.shell;
    },
    draw,
    unmount,
    change: (next: string) => {
      appState = next;
      for (const f of listeners) f(next);
    },
    callback: () => [...timers.values()][0]?.f,
    next: () => {
      const task = [...timers].sort((x, y) => x[1].due - y[1].due)[0];
      if (!task) return;
      timers.delete(task[0]);
      timerTime = task[1].due;
      task[1].f();
    },
    startOver: () => {
      book.props.startOver();
      draw();
    },
    close: () => {
      unmount();
      a.sql.close();
    },
  };
}

// Breaks: App uses latency/Mono for resume, credits inactive time twice, or fails to pause fractions.
test('actual App pause and resume preserve 9ms plus 11ms as exactly one logical unit', () => {
  const h = appHost();
  try {
    h.next();
    h.clock.wall = 10009;
    h.clock.mono = 9;
    h.change('background');
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10009, remainder: 450, target: 64800 });
    h.clock.wall = 10020;
    h.change('background');
    h.change('active');
    assert.equal(h.game.view().view.time, 64801);
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10020, remainder: 0, target: 64801 });
    h.change('active');
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10020, remainder: 0, target: 64801 });
  } finally {
    h.close();
  }
});

// Breaks: pending storage keeps an autonomous retry alive, or confirmed recovery never re-arms App.
test('actual App stops unknown storage wakeups and resumes after confirmed user recovery', () => {
  const h = appHost();
  try {
    h.next();
    h.clock.wall = 10001;
    h.clock.mono = 1;
    h.fault.kind = 'lost';
    h.fault.armed = true;
    h.next();
    h.fault.reads = false;
    h.clock.wall = 10021;
    h.clock.mono = 21;
    for (let n = 0; n < 3; n++) h.next();
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10001, remainder: 50, target: 64800 });
    h.fault.reads = true;
    h.change('background');
    h.clock.wall = 11021;
    h.change('active');
    h.fault.reads = false;
    h.clock.wall = 12021;
    for (let n = 0; n < 3; n++) h.next();
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10001, remainder: 50, target: 64800 });
    assert.equal(h.game.view().view.time, 64800);
    const reply = h.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} });
    assert.equal(reply.kind, 'saved');
    assert.equal(h.game.view().view.time, 64901);
    h.shell.recovered(true); // The real Shell callback injected into Book, after confirmed retry.
    h.clock.wall = 12041;
    h.clock.mono = 41;
    h.next();
    assert.equal(h.game.view().view.time, 64902);
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 12041, remainder: 50, target: 64902 });
    h.fault.armed = true;
    h.clock.wall = 12042;
    h.clock.mono = 42;
    assert.equal(
      h.game.invoke({ action_key: 'look' as never, target_ids: [], input: {} }).kind,
      'pending',
    );
    const held = h.game.pendingInvocation();
    h.shell.recovered(false); // A user attempt blocks a wakeup that App had already queued.
    h.fault.reads = false;
    h.clock.wall = 12062;
    h.clock.mono = 62;
    for (let n = 0; n < 3; n++) h.next();
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 12042, remainder: 100, target: 64902 });
    assert.equal(h.game.pendingInvocation(), held);
  } finally {
    h.close();
  }
});

// Breaks: a stale callback remains authoritative after effect cleanup/remount or Start over.
test('old App wakeups cannot mutate the same remounted Game or a replacement save', () => {
  const h = appHost();
  try {
    const departed = h.callback()!;
    h.unmount();
    h.draw();
    h.clock.wall = 10020;
    h.clock.mono = 20;
    departed();
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10000, remainder: 0, target: 64800 });
    const oldRun = h.sql.prepare('SELECT run_id FROM save').get()!.run_id;
    const oldWake = h.callback()!;
    h.startOver();
    const newRun = h.sql.prepare('SELECT run_id FROM save').get()!.run_id;
    assert.notEqual(newRun, oldRun);
    h.clock.wall = 11020;
    h.clock.mono = 1020;
    oldWake();
    assert.equal(h.game.view().view.time, 64800);
    assert.deepEqual(checkpoint(h.sql), { wall_ms: 10020, remainder: 0, target: 64800 });
    assert.equal(h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 0);
  } finally {
    h.close();
  }
});
