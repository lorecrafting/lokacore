// A driver tick that only moved the clock joins the newest receipt (save.md, Durable elapsed
// sessions): the long span must be what the many short ones were, through every fault.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { replay as replayCoverage } from '../../../kernel/ts/play/coverage.ts';
import { replayRecords } from '../../../kernel/ts/play/replay.ts';
import { newWorld } from '../../../kernel/ts/src/index.ts';
import { cartridgeOf, CONTEXT, SEED } from './session.ts';
import { compiled } from './__tests__/compiled.ts';
import { coalesced } from './delivery.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedBundle, elapsedHost } from './__tests__/elapsed-host.test.ts';

const START = 64800; // elapsedBundle's calendar start
const south = { action_key: 'move', target_ids: [], input: { direction: 'south' } } as never;
type Host = ReturnType<typeof elapsedHost>;

const tick = (a: Host, ms = 250) => {
  a.clock.wall += ms;
  a.clock.mono += ms;
  let status = a.game.pulse();
  while (status.kind === 'catching_up') status = a.game.pulse('drain');
  return status.kind;
};
const rows = (sql: DatabaseSync) =>
  (
    sql.prepare('SELECT command, response FROM receipt ORDER BY rowid').all() as {
      command: string;
      response: string;
    }[]
  ).map((r) => [r.command, r.response]);
const spans = (sql: DatabaseSync) =>
  rows(sql).map(([command]) => {
    const { type, from, until } = JSON.parse(command!).payload;
    return type === 'elapsed' ? [from, until] : type;
  });
/** Every world row: all a tick may change but the clock's own bookkeeping and the receipt log. */
function world(sql: DatabaseSync) {
  const names = sql
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
        AND name NOT IN ('receipt', 'trace', 'elapsed', 'meta') AND name NOT LIKE 'sqlite_%'`,
    )
    .all() as { name: string }[];
  return names.map(({ name }) => [
    name,
    sql
      .prepare(`SELECT * FROM "${name}"`)
      .all()
      .map(({ revision: _, ...row }) => row),
  ]);
}
const save = (t: TestContext) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-coalesce-'));
  t.after(() => rmSync(dir, { recursive: true }));
  return join(dir, 'save.db');
};
const traced = (sql: DatabaseSync) =>
  (sql.prepare('SELECT record FROM trace ORDER BY rowid').all() as { record: string }[]).map(
    (r) => JSON.parse(r.record).data,
  );

// The child of the kill test: `kill <save> <n> before|after` ticks three times, then SIGKILLs
// itself at the fourth tick's n-th COMMIT (1: the receipt, 2: its trace entry).
if (process.argv[2] === 'kill') {
  const [path, n, when] = process.argv.slice(3) as [string, string, string];
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, elapsedBundle());
  for (let i = 0; i < 3; i++) tick(a);
  const exec = a.db.execSync.bind(a.db);
  let commits = 0;
  a.db.execSync = (q: string) => {
    const die = q === 'COMMIT' && ++commits === Number(n);
    if (die && when === 'before') process.kill(process.pid, 'SIGKILL');
    exec(q);
    if (die) process.kill(process.pid, 'SIGKILL');
  };
  tick(a);
  process.exit(1); // not killed: the parent sees no SIGKILL
}

// Breaks: a merged span the rules would not decide (a wrong id, digest or op), lost time, a row per
// tick, an idle trace that burns the cap, or a head that differs from one long tick's, RNG included.
test('twenty idle ticks are one receipt, byte for byte the one long tick writes', (t) => {
  const [p, q] = [save(t), save(t)],
    bundle = elapsedBundle();
  const a = elapsedHost(p, { wall: 10000, mono: 0 }, bundle);
  const b = elapsedHost(q, { wall: 10000, mono: 0 }, bundle);
  for (let i = 0; i < 20; i++) assert.equal(tick(a), 'ready');
  assert.equal(tick(b, 5000), 'ready');
  assert.deepEqual(spans(a.sql), [[START, START + 250]]);
  assert.deepEqual(rows(a.sql), rows(b.sql));
  assert.deepEqual(world(a.sql), world(b.sql));
  assert.equal(traced(a.sql).length, 2); // the run header and the one entry
  assert.equal(traced(a.sql)[1].command.payload.until, START + 250);
  a.sql.close();
  b.sql.close();
  coldReopen(p, bundle);
});

// Breaks: a due job folded into a span, so its time or its line is lost; the driver's rows must
// carry what one long catch-up carries.
test('a showcase idle minute keeps every job the long span has, at its time', (t) => {
  const [p, q] = [save(t), save(t)],
    bundle = compiled('cartridges/toolbox_showcase');
  const a = elapsedHost(p, { wall: 10000, mono: 0 }, bundle);
  const b = elapsedHost(q, { wall: 10000, mono: 0 }, bundle);
  for (let i = 0; i < 400; i++) assert.equal(tick(a), 'ready');
  assert.equal(tick(b, 100000), 'ready');
  // Only the span's start and so its id differ: the short tick reaching a due job starts there.
  const eventful = (sql: DatabaseSync) =>
    rows(sql)
      .map(([, response]) => JSON.parse(response!))
      .filter((d) => d.delta.ops.length > 1)
      .map((d) => [
        d.delta.ops.slice(1),
        d.delta.ops[0].to,
        d.events.map(({ correlation_id: _, ...event }: { correlation_id: string }) => event),
        d.rng,
      ]);
  assert.equal(eventful(a.sql).length, 1);
  assert.deepEqual(eventful(a.sql), eventful(b.sql));
  assert.deepEqual(world(a.sql), world(b.sql));
  a.sql.close();
  b.sql.close();
  coldReopen(p, bundle);
});

// Breaks: a span merged across a command (the command's time moves), or a phone trace with the
// resulting revision gap no longer replaying byte for byte (`loka play --replay`, `coverage.ts`).
test('a command splits the idle spans, and the phone trace replays byte for byte', (t) => {
  const path = save(t),
    bundle = compiled('cartridges/toolbox_showcase');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  tick(a);
  tick(a);
  assert.equal(a.game.invoke(south).kind, 'saved');
  tick(a);
  tick(a);
  const shape = spans(a.sql);
  assert.deepEqual(shape, [shape[0], 'move', [shape[0]![1], shape[2]![1]]]);
  const trace = `${path}.jsonl`;
  writeFileSync(
    trace,
    (a.sql.prepare('SELECT record FROM trace ORDER BY rowid').all() as { record: string }[])
      .map((r) => `${r.record}\n`)
      .join(''),
  );
  a.sql.close();
  coldReopen(path, bundle);
  const main = fileURLToPath(new URL('../../../kernel/ts/play/main.ts', import.meta.url));
  const artifact = `${path}.json`;
  writeFileSync(artifact, `{"cartridge":${bundle.canonical},"content_hash":"${bundle.sha256}"}`);
  const replay = spawnSync(process.execPath, [main, artifact, '--replay', trace], {
    encoding: 'utf8',
  });
  assert.equal(replay.status, 0, replay.stdout + replay.stderr);
  assert.match(replay.stdout, /replay: 3 commands identical/);
  replayCoverage(cartridgeOf(bundle), replayRecords(trace, bundle.sha256) as never); // throws on a differing line
});

// Breaks: a failed COMMIT deletes the prior receipt or adopts the merge; a lost acknowledgement
// looks up the tick's own id, misses the merged row and answers that nothing was saved.
test('failed and lost COMMITs on a merging tick keep lawful receipts', (t) => {
  const path = save(t),
    bundle = elapsedBundle();
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  tick(a);
  a.fault.kind = 'failed';
  a.fault.armed = true;
  assert.notEqual(tick(a), 'ready');
  assert.deepEqual(spans(a.sql), [[START, START + 12]]);
  a.sql.close();
  const b = elapsedHost(path, { wall: 10500, mono: 500 }, bundle);
  assert.equal(tick(b), 'ready');
  assert.deepEqual(spans(b.sql), [
    [START, START + 12],
    [START + 12, START + 37],
  ]);
  b.fault.kind = 'lost';
  b.fault.armed = true;
  assert.equal(tick(b), 'pending');
  assert.deepEqual(spans(b.sql), [
    [START, START + 12],
    [START + 12, START + 50],
  ]);
  b.sql.close();
  const c = elapsedHost(path, { wall: 11000, mono: 0 }, bundle);
  assert.equal(tick(c), 'ready');
  assert.deepEqual(spans(c.sql), [
    [START, START + 12],
    [START + 12, START + 50],
    [START + 50, START + 62],
  ]);
  c.sql.close();
  coldReopen(path, bundle);
});

// Breaks: a tick merged into a span it does not continue: time, RNG or identity would be rewritten.
const IDLE: [string, (c: any, idle: any) => void][] = [
  ['another run', (c) => (c.payload.run_id = 'other')],
  ['a span ending elsewhere', (c) => (c.payload.until -= 1)],
  ['another context', (c) => (c.world_context_id = 'other')],
  ['another RNG', (_, idle) => (idle.rng = 'other')],
];
for (const [name, forge] of IDLE)
  test(`a tick does not extend ${name}`, () => {
    const prior = {
      id: 'p',
      world_context_id: 'w',
      payload: { type: 'elapsed', run_id: 'r', from: 0, until: 10 },
    };
    const tick = { ...prior, id: 't', payload: { ...prior.payload, from: 10, until: 20 } };
    const d = {
      kind: 'accepted',
      outcome: 'elapsed',
      delta: { ops: [{ op: 'time.advance', from: 10, to: 20 }] },
      events: [],
      effects: [],
      rng: { counter: 1 },
    };
    const idle = { command: prior, rng: '{"counter":1}' };
    assert.equal(
      (coalesced(idle as never, tick as never, d as never)?.command.payload as any).from,
      0,
    );
    forge(prior, idle);
    assert.equal(coalesced(idle as never, tick as never, d as never), undefined);
  });

// Breaks: a driver tick swallowing a trusted story.elapsed receipt, whose retry must still replay.
test('a trusted elapsed receipt is not absorbed by the next, and its retry replays', (t) => {
  const bundle = elapsedBundle();
  const a = elapsedHost(save(t), { wall: 10000, mono: 0 }, bundle);
  const fresh = newWorld(cartridgeOf(bundle), CONTEXT as never, SEED as never);
  const story = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  if (story.kind !== 'open') throw new Error(story.kind);
  const first = { expected_run_id: story.runId(), from: START, until: START + 10 };
  assert.equal(story.elapsed(first).kind, 'saved');
  assert.equal(story.elapsed({ ...first, from: START + 10, until: START + 20 }).kind, 'saved');
  const again = story.elapsed(first);
  assert.equal(again.kind === 'saved' && again.replay, true);
  a.sql.close();
});

// Breaks: a death at any write of a merging tick loses the save, doubles the span, or leaves an
// orphan trace entry for a receipt that was replaced; reopen offers Start over on a lawful save.
for (const n of [1, 2])
  for (const when of ['before', 'after'])
    test(`SIGKILL ${when} COMMIT ${n} of a merging tick reopens with lawful rows`, (t) => {
      const path = save(t),
        bundle = elapsedBundle();
      const args = [fileURLToPath(import.meta.url), 'kill', path, String(n), when];
      const child = spawnSync(process.execPath, args);
      assert.equal(child.signal, 'SIGKILL', String(child.stderr));
      const a = elapsedHost(path, { wall: 11000, mono: 0 }, bundle);
      assert.equal(tick(a), 'ready'); // 1250 ms in all at 50 per 1000 ms: 62 units
      const cut = n === 1 && when === 'before' ? START + 37 : START + 50; // what the child had saved
      const lawful = [
        [START, cut],
        [cut, START + 62],
      ];
      assert.deepEqual(spans(a.sql), lawful);
      const entries = traced(a.sql).slice(1);
      assert.deepEqual(
        entries.map((e) => [e.command.payload.from, e.command.payload.until]),
        lawful,
      );
      a.sql.close();
      coldReopen(path, bundle);
    });
