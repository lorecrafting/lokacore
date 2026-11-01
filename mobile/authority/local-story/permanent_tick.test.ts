// size: allow 590, every fold case shares the one compiled needs fixture and save harness
// Toolbox row W8 ticking permanent status rows through real SQLite (loka-rn3b, loka-sgqk): the needs
// sampler's needs made permanent keep an active row with a tick and job but no end across a month of
// catch-up and a cold reopen (docs/system/save.md, Status recovery), and saturated ticks fold
// (docs/system/mechanics.md, W8 Catch-up). Times are seconds after the move east that applies them.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { checkpoint, coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { folds } from '../../../kernel/ts/src/mechanics/status/job.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-permanent-tick-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-permanent-tick-saves-'));
const file = join(scratch, 'artifact.json');
let artifact: any;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/needs_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}

const HOUR = 3600;
const MONTH = 30 * 24 * HOUR;
const ID = (kind: string, key: string) => `needs_sampler@0.0.1:${kind}/${key}`;
const REF = (kind: string, key: string) => ({
  cartridge_id: 'needs_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
type Authored = {
  statuses: Record<string, any>;
  resources: Record<string, any>;
  reactions: Record<string, any>;
  facts: Record<string, any>;
};

/** The needs sampler with hungry (and, unless the patch restores it, thirsty) made permanent. */
function fixture(patch?: (c: Authored, status: (key: string) => any) => void) {
  const compiled = structuredClone(artifact);
  const authored: Authored = compiled.cartridge;
  const status = (key: string) => authored.statuses[ID('status', key)];
  for (const key of ['hungry', 'thirsty']) {
    status(key).duration = 'permanent';
    delete status(key).narration.expired;
  }
  patch?.(authored, status);
  const canonical = encode(compiled.cartridge);
  const bundle = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ ...compiled, content_hash: bundle.sha256 })),
    INSTALLED,
  );
  if (!loaded.ok) throw new Error(JSON.stringify(loaded));
  const initial = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  return { bundle, initial, releases: [{ fresh: initial, content_hash: bundle.sha256 }] as const };
}

let saveNumber = 0;

/** A save on disk that has moved east at time 0, so both needs are applied. */
function begin(t: TestContext, f: ReturnType<typeof fixture> = fixture()) {
  const path = join(saves, `${++saveNumber}.db`);
  const clock = { wall: 10000, mono: 0 };
  const s = {
    path,
    f,
    p: elapsedHost(path, clock, f.bundle),
    story: undefined as never as Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
  };
  const open = () => {
    const story = openStory(s.p.db, f.releases, s.p.host);
    if (story.kind !== 'open') throw new Error(story.kind);
    s.story = story;
  };
  const reopen = () => {
    s.p.sql.close();
    s.p = elapsedHost(path, { ...s.p.clock }, f.bundle);
    open();
  };
  t.after(() => s.p.sql.close());
  open();
  const moved = s.story.invoke({
    invocation_id: 'dddddddd-6666-4666-8666-000000000001',
    actor_id: f.initial.character,
    action_key: 'move',
    target_ids: [],
    input: { direction: 'east' },
  });
  assert.equal(moved.kind, 'saved');
  assert.equal(s.story.world().state.clock, 0);
  return { ...s, reopen, s };
}
type Save = ReturnType<typeof begin>;

/** Real catch-up: wall time passes (50 world units a second), then ClockDriver drains to `until`. */
function drive({ s }: Save, until: number) {
  const ms = (until - Number(checkpoint(s.p.sql).target)) * 20;
  s.p.clock.wall += ms;
  s.p.clock.mono += ms;
  const run = s.story.runId();
  let status = s.story.pulse('resume', run);
  while (status.kind === 'catching_up') status = s.story.pulse('drain', run);
  assert.equal(status.kind, 'ready');
  assert.equal(s.story.world().state.clock, until);
}

const direct = ({ s }: Save, from: number, until: number) =>
  s.story.elapsed({ expected_run_id: s.story.runId(), from, until });

/** Job-by-job play: one elapsed command per tick, so at most one tick can run in each. */
function stepwise(save: Save, every: number, until: number) {
  let from = 0;
  for (let due = every; due <= until; due += every) {
    assert.equal(direct(save, from, due).kind, 'saved');
    from = due;
  }
  assert.equal(direct(save, from, until).kind, 'saved');
}

const receipts = ({ s }: Save) =>
  JSON.stringify(s.p.sql.prepare('SELECT * FROM receipt ORDER BY revision').all());
const elapsedReceipts = ({ s }: Save) =>
  (s.p.sql.prepare('SELECT command, response FROM receipt ORDER BY revision').all() as any[])
    .map((r) => ({ until: JSON.parse(r.command).payload.until, ...JSON.parse(r.response) }))
    .filter((r) => r.until !== undefined);
const events = (save: Save, type: string) =>
  elapsedReceipts(save).flatMap((r) => r.events.filter((e: any) => e.payload.type === type));
const pool = ({ s }: Save, key: string) =>
  gameView(s.story.world()).resources!.find((r: any) => r.resource.key === key)!.current;
const nextTicks = ({ s }: Save) =>
  Object.fromEntries(
    gameView(s.story.world()).conditions!.map((c: any) => [c.label, c.next_tick_at]),
  );
const jobRows = ({ s }: Save) => {
  const rows = Object.values(s.story.world().state.jobs ?? {}) as { job: { kind: string } }[];
  return {
    status: rows.filter((r) => r.job.kind === 'status').length,
    calendar: rows.filter((r) => r.job.kind === 'calendar').length,
  };
};

/** Hunger starts empty; a second status adds to it every 5000 (the A7 hand trace). */
const fed = (c: Authored, status: (key: string) => any) => {
  c.statuses[ID('status', 'fed')] = {
    ...status('hungry'),
    key: 'fed',
    per_tick: 1,
    tick_every: 5000,
  };
  c.resources[ID('resource', 'hunger')].start = 0;
  c.reactions[ID('reaction', 'track_enter')].steps.push({
    op: 'status.apply',
    status: REF('status', 'fed'),
  });
};

/** The month's end state: A4. */
function assertMonth(save: Save) {
  assert.equal(pool(save, 'hunger'), 0);
  assert.equal(pool(save, 'thirst'), 0);
  assert.equal(pool(save, 'hp'), 10);
  assert.deepEqual(nextTicks(save), {
    'condition.hungry': MONTH + HOUR,
    'condition.thirsty': MONTH + HOUR,
  });
}

// Breaks: load or recovery refuses or rewrites an active status row with a tick and job but no
// ends_at, boundary still stops at a saturated job (720 steps, hence unbounded rows), or a fold
// drops a pool change or its one event.
test('a month of catch-up takes 11 steps, then survives a cold reopen', (t) => {
  const save = begin(t);
  const before = jobRows(save);
  drive(save, MONTH + 1);
  const hours = Array.from({ length: 10 }, (_, k) => (k + 1) * HOUR);
  assert.deepEqual(
    elapsedReceipts(save).map((r) => r.until),
    [...hours, MONTH + 1],
  );
  const after = jobRows(save);
  assert.deepEqual(
    { status: after.status - before.status, calendar: after.calendar - before.calendar },
    { status: 22, calendar: 11 },
  );
  assert.equal(events(save, 'status_ticked').length, 22);
  assert.equal(events(save, 'clock_hour').length, 11);
  const told = (key: string) =>
    elapsedReceipts(save).flatMap((r) =>
      (r.narration ?? []).filter((l: any) => l.key === key).map(() => r.until),
    );
  for (const need of ['hungry', 'thirsty']) assert.deepEqual(told(`narration.${need}.tick`), hours);
  save.reopen();
  assertMonth(save);
  coldReopen(save.s.path, save.f.bundle);
});

// Breaks: a floor(...) + 1 count that is off by one, in either direction, at a tick boundary.
test('a fold ends on the first tick past the target', (t) => {
  for (const [until, ticks, next] of [
    [36000, 20, 39600],
    [36001, 20, 39600],
    [39600, 22, 43200],
  ] as const) {
    const save = begin(t);
    drive(save, until);
    assert.equal(pool(save, 'hunger'), 0);
    assert.equal(pool(save, 'thirst'), 0);
    assert.equal(events(save, 'status_ticked').length, ticks);
    assert.deepEqual(nextTicks(save), { 'condition.hungry': next, 'condition.thirsty': next });
  }
});

// Breaks: the fold takes a tick that still changes a pool (a pool write lost). The queue reaches
// the job in a direct advance too; ten moving ticks must each take 1.
test('with nothing saturated, every tick runs in one advance', (t) => {
  const save = begin(t);
  assert.equal(direct(save, 0, 36000).kind, 'saved');
  assert.equal(pool(save, 'hunger'), 0);
  assert.deepEqual(nextTicks(save), { 'condition.hungry': 39600, 'condition.thirsty': 39600 });
});

// Breaks: an off-by-one in the jump or a pool write in the fold, against job-by-job play.
test('48 hours through the driver ends where job-by-job play ends', (t) => {
  const driven = begin(t);
  const walked = begin(t);
  const until = 48 * HOUR + 1;
  drive(driven, until);
  stepwise(walked, HOUR, until);
  const state = ({ s }: Save) => {
    const w = s.story.world();
    return {
      clock: w.state.clock,
      rng: w.state.rng,
      view: gameView(w).resources,
      ticks: nextTicks({ s } as Save),
    };
  };
  assert.deepEqual(state(driven), state(walked));
  assert.equal(pool(driven, 'hunger'), 0);
  assert.equal(pool(driven, 'thirst'), 0);
  assert.deepEqual(nextTicks(driven), {
    'condition.hungry': 176400,
    'condition.thirsty': 176400,
  });
});

// Breaks: the kernel jumps past another job, or the host stops only for non-status jobs. Hand trace:
// -1 at each hour, +1 at each 5000: 3600:0 5000:1 7200:0 10000:1 10800:0 14400:0 15000:1 18000:0 20000:1.
test('a saturated tick does not fold past another moving job', (t) => {
  const driven = begin(t, fixture(fed));
  drive(driven, 20000);
  assert.equal(pool(driven, 'hunger'), 1);
  const advanced = begin(t, fixture(fed));
  assert.equal(direct(advanced, 0, 20000).kind, 'saved');
  assert.equal(pool(advanced, 'hunger'), 1);
});

// Breaks: a horizon at the other job's due time, not before it, swallows the tick due with it.
// hungry is saturated at 0 from 3600, and thirsty moves at 7200 only: hungry ticks at 3600 and 7200.
test('a tick due exactly at another job runs', (t) => {
  const tie = () =>
    fixture((c, status) => {
      c.resources[ID('resource', 'hunger')].start = 0;
      status('thirsty').tick_every = 7200;
    });
  for (const [until, hungry] of [
    [7199, { ticks: 1, next: 7200 }],
    [7200, { ticks: 2, next: 10800 }],
    [7201, { ticks: 2, next: 10800 }],
  ] as const) {
    const save = begin(t, tie());
    drive(save, until);
    const ticked = events(save, 'status_ticked').filter(
      (e: any) => e.payload.status.key === 'hungry',
    );
    assert.equal(ticked.length, hungry.ticks);
    assert.equal(nextTicks(save)['condition.hungry'], hungry.next);
    assert.equal(pool(save, 'thirst'), until < 7200 ? 10 : 9);
  }
});

// Breaks: a job due at this very tick does not limit the fold, in one direct advance. thirsty raises the
// floored hunger by 5 at 72000; hunger's tick there (ties run by job id, here hunger first) leaves 0, so
// 5; the ticks at 75600, 79200 and 82800 leave 2. A fold past 72000 leaves 5.
test('a raise due at the same time as a floored tick stops the fold', (t) => {
  const save = begin(
    t,
    fixture((c, status) => {
      Object.assign(status('thirsty'), {
        resource: REF('resource', 'hunger'),
        per_tick: 5,
        tick_every: 72000,
      });
    }),
  );
  assert.equal(direct(save, 0, 82801).kind, 'saved');
  assert.equal(pool(save, 'hunger'), 2);
});

// Breaks: the fold jumps a queued sub-step that has not run yet, whose row is already complete. fed's
// 14400 sub-step sorts after hungry's tick at the same time; job.ts's skip took it for one that ran.
// Literals from the pre-fold direct advance (fold off): a jump leaves 3 and 9.
for (const [until, hunger] of [
  [28801, 1],
  [72001, 1],
]) {
  test(`a fold does not jump a raise's queued sub-step (to ${until})`, (t) => {
    const save = begin(
      t,
      fixture((c, status) => {
        fed(c, status);
        status('fed').tick_every = 7200;
        status('thirsty').tick_every = 1e7;
      }),
    );
    assert.equal(direct(save, 0, until).kind, 'saved');
    assert.equal(pool(save, 'hunger'), hunger);
  });
}

// Breaks: a later job lifts the horizon an earlier one set. Same raises as above; fed also ticks at
// 80000 on thirst. A fold past 72000 misses 75600 and 79200 and leaves 4.
test('a second job due later does not lift the fold past the first', (t) => {
  const save = begin(
    t,
    fixture((c, status) => {
      fed(c, status);
      Object.assign(status('fed'), {
        resource: REF('resource', 'thirst'),
        per_tick: -1,
        tick_every: 80000,
      });
      Object.assign(status('thirsty'), {
        resource: REF('resource', 'hunger'),
        per_tick: 5,
        tick_every: 72000,
      });
    }),
  );
  assert.equal(direct(save, 0, 82801).kind, 'saved');
  assert.equal(pool(save, 'hunger'), 2);
});

// Breaks: a horizon short of the second before the job. thirsty moves at 7201, so hungry's tick at 7200
// folds with the one at 3600: one event, next 10800.
test('a tick one second before another job folds', (t) => {
  const save = begin(
    t,
    fixture((c, status) => {
      c.resources[ID('resource', 'hunger')].start = 0;
      status('thirsty').tick_every = 7201;
    }),
  );
  assert.equal(direct(save, 0, 8000).kind, 'saved');
  const ticked = events(save, 'status_ticked').filter(
    (e: any) => e.payload.status.key === 'hungry',
  );
  assert.equal(ticked.length, 1);
  assert.equal(nextTicks(save)['condition.hungry'], 10800);
});

// Breaks: each clause of the predicate, on forms no compiled cartridge reaches or no play path shows
// apart. hungry on a floored hunger folds; each change below takes one clause away.
test('the fold predicate refuses each clause alone', (t) => {
  const world = begin(
    t,
    fixture((c) => {
      c.resources[ID('resource', 'hunger')].start = 0;
    }),
  ).s.story.world() as any;
  const hunger = key(REF('resource', 'hunger') as never);
  const [at, row] = Object.entries<any>(world.state.statuses).find(
    ([, r]) => world.state.jobs[r.job_id]?.job.key === 'hungry',
  )!;
  const job = world.state.jobs[row.job_id];
  const holder = (body_id: string) => ({
    ...world,
    state: {
      ...world.state,
      statuses: { [JSON.stringify({ ...JSON.parse(at), body_id })]: row },
    },
  });
  const spec = (patch: object) => ({
    ...world,
    resourceSpecs: {
      ...world.resourceSpecs,
      [hunger]: { ...world.resourceSpecs[hunger], ...patch },
    },
  });
  const heard = (status?: object) => ({
    ...world,
    cartridge: {
      ...world.cartridge,
      reactions: { hear: { on: { event: 'status_ticked', status } } },
    },
  });
  const item = Object.entries<any>(world.entities).find(([, e]) => e.kind === 'item')![0];
  const { [hunger]: _, ...undeclared } = world.resourceSpecs;
  const body = JSON.parse(at).body_id;
  const unreadable = {
    ...world,
    entityResourceSpecs: {
      [key({ kind: 'resource', resource: REF('resource', 'hunger'), entity_id: body } as never)]:
        world.resourceSpecs[hunger],
    },
  };
  for (const [name, w, expected] of [
    ['as it stands', world, true],
    ['on an item', holder(item), false],
    ['on a room', holder(Object.keys(world.rooms)[0]!), false],
    ['undeclared pool', { ...world, resourceSpecs: undeclared }, false],
    ['unreadable pool', unreadable, false],
    ['gain', spec({ gain: 1 }), false],
    ['regen', spec({ regen: { amount: 1, every: 60 } }), false],
    ['listener on it', heard(REF('status', 'hungry')), false],
    ['listener on any status', heard(), false],
    ['listener on another status', heard(REF('status', 'thirsty')), true],
  ] as const)
    assert.equal(folds(w, row.job_id, job), expected, name);
});

// Breaks: clause 5 removed; a fold would swallow a listener's firings.
test('a status_ticked listener keeps every tick', (t) => {
  const listened = fixture((c, status) => {
    // thirsty's hourly tick would stop the fold anyway while its pool moves.
    status('thirsty').tick_every = 10 * MONTH;
    c.facts[ID('fact', 'ticks')] = {
      key: 'ticks',
      version: 1,
      meaning: 'hungry ticks heard',
      scopes: ['player'],
      value_type: { type: 'int', default: 0, minimum: 0, maximum: 100000 },
    };
    c.reactions[ID('reaction', 'hear')] = {
      key: 'hear',
      on: { event: 'status_ticked', status: REF('status', 'hungry') },
      steps: [{ op: 'fact.adjust', fact: REF('fact', 'ticks'), amount: 1 }],
    };
  });
  const save = begin(t, listened);
  drive(save, 48 * HOUR);
  assert.equal(
    value(save.s.story.world(), listened.initial.character, REF('fact', 'ticks') as never),
    48,
  );
});

// Breaks: clause 1 allows timed rows. Both pools start empty; hungry is permanent, thirsty keeps its
// day, so every hour stops until it expires at 86400; then hungry folds.
test('a timed status never folds and still ends with its day', (t) => {
  const save = begin(
    t,
    fixture((c, status) => {
      c.statuses[ID('status', 'thirsty')] = structuredClone(
        artifact.cartridge.statuses[ID('status', 'thirsty')],
      );
      c.resources[ID('resource', 'hunger')].start = 0;
      c.resources[ID('resource', 'thirst')].start = 0;
    }),
  );
  drive(save, 90000);
  const hours = Array.from({ length: 24 }, (_, k) => (k + 1) * HOUR);
  assert.deepEqual(
    elapsedReceipts(save).map((r) => r.until),
    [...hours, 90000],
  );
  assert.deepEqual(nextTicks(save), { 'condition.hungry': 93600 });
});

// Breaks: clause 4 removed. mv regenerates 18 an hour, 0.3 a minute; a tick every minute still finds it
// at 0 (a change of 0), so a fold would skip the -100s and leave it regrown; job by job the tick at 10800 leaves 0.
test('a tick on a regenerating pool never folds', (t) => {
  const drained = () =>
    fixture((c, status) => {
      Object.assign(status('hungry'), {
        resource: REF('resource', 'mv'),
        per_tick: -100,
        tick_every: 60,
      });
      // Its hourly tick would stop the fold anyway.
      status('thirsty').tick_every = 10 * MONTH;
    });
  const driven = begin(t, drained());
  const walked = begin(t, drained());
  drive(driven, 10801);
  stepwise(walked, 60, 10801);
  assert.equal(pool(driven, 'mv'), 0);
  assert.equal(pool(walked, 'mv'), 0);
});

// Breaks: a fold or jump past the fatal point: hp 10, -1 an hour, minimum 0, dies at the tenth.
test('a fatal tick in catch-up lands at its own time, not the target', (t) => {
  const save = begin(
    t,
    fixture((c, status) => {
      c.resources[ID('resource', 'hp')].minimum = 0;
      Object.assign(status('hungry'), { resource: REF('resource', 'hp') });
    }),
  );
  drive(save, MONTH + 1);
  const died = elapsedReceipts(save).filter((r) =>
    r.events.some((e: any) => e.payload.type === 'entity_died'),
  );
  assert.equal(died[0].until, 36000);
});

for (const kind of ['full', 'failed', 'lost'] as const) {
  // Breaks: a folded step that half-commits, or that reconciles to something other than A4.
  test(`the folded step, on a ${kind} COMMIT, is fenced and recovers to the month`, (t) => {
    const save = begin(t);
    assert.equal(direct(save, 0, 36000).kind, 'saved');
    const { s } = save;
    const before = receipts(save);
    if (kind === 'full') {
      const pages = (s.p.sql.prepare('PRAGMA page_count').get() as any).page_count;
      s.p.sql.exec(`PRAGMA max_page_count=${pages}`);
      assert.throws(() => direct(save, 36000, MONTH + 1), { errcode: 13 });
      assert.equal(receipts(save), before);
      s.p.sql.exec('PRAGMA max_page_count=1073741823');
    } else {
      if (kind === 'failed')
        s.p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      s.p.fault.kind = kind;
      s.p.fault.armed = true;
      assert.equal(direct(save, 36000, MONTH + 1).kind, 'pending');
      assert.equal(s.story.world().state.clock, 36000);
      s.p.fault.reads = false;
      save.reopen();
    }
    if (kind !== 'lost') {
      assert.equal(s.story.world().state.clock, 36000);
      assert.equal(direct(save, 36000, MONTH + 1).kind, 'saved');
    }
    assert.equal(elapsedReceipts(save).filter((r) => r.until === MONTH + 1).length, 1);
    assertMonth(save);
  });
}

// Breaks: replaying the folded step re-runs it rather than answering from its receipt.
test('replaying the folded step answers from its receipt, byte for byte', (t) => {
  const save = begin(t);
  assert.equal(direct(save, 0, 36000).kind, 'saved');
  const first = direct(save, 36000, MONTH + 1);
  assert.equal(first.kind, 'saved');
  const before = receipts(save);
  const again = direct(save, 36000, MONTH + 1);
  assert.equal(again.kind, 'saved');
  assert.equal((again as { replay?: boolean }).replay, true);
  const answer = ({ replay: _, ...rest }: any) => encode(rest);
  assert.equal(answer(again), answer(first));
  assert.equal(receipts(save), before);
  assertMonth(save);
});

test.after(() => rmSync(saves, { recursive: true, force: true }));
