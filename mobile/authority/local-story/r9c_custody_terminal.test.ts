// E2 families 1-2 on the frozen synthetic cartridge (r9c_interactions) through the real local
// authority and rollback-journal SQLite: every committed intermediate is closed and reopened by
// the real loader before the next command; the belfry snapshot forks by file copy; the Ring path
// replays exactly; a genuinely failed final COMMIT applies nothing. Standing integration scenario
// (E2 brief acceptance 4-5): the breaks are killed by the focused authority tests linked below,
// except the Continue-replay break named in family 2's header, which only this file catches.
// Expected values come from the cartridge files and r9c_interactions_ids.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  gameView,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef } from '../../../kernel/ts/src/contracts.gen.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { sqliteHost } from './__tests__/elapsed-host.test.ts';

const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const ids: Record<string, string> = read('protocol/fixtures/r9c_interactions_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh, content_hash: pin.sha256 }] as const;
const ref = (kind: string, k: string) =>
  ({ cartridge_id: 'r9c_interactions', cartridge_version: '0.0.1', kind, key: k }) as DefinitionRef;
const item = (k: string) => ids[`item/${k}`]!;
const npc = (k: string) => ids[`npc/${k}`]!;
const bell = ids['detail/belfry/bell']!;

type Invocation = {
  invocation_id: string;
  actor_id: string;
  action_key: string;
  target_ids: string[];
  input: object;
};
let sent = 0; // invocation ids stay unique across every save in this file

// One save at `path`, reopened by the real loader after every command it sends.
function save(path: string) {
  let made = 0;
  const newId = () => `aaaaaaaa-0000-4000-8000-${String(++made).padStart(12, '0')}`;
  let p!: ReturnType<typeof sqliteHost>;
  let story!: Extract<ReturnType<typeof openStory>, { kind: 'open' }>;
  const open = () => {
    p = sqliteHost(path);
    p.host.newId = newId;
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open');
    story = s as typeof story;
  };
  open();
  const world = () => story.world();
  const rows = () =>
    p.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all();
  const reports = () => p.sql.prepare('SELECT count(*) AS n FROM report').get()!.n;
  const reopen = () => {
    const before = hash(world().state as never);
    p.sql.close();
    open();
    assert.equal(hash(world().state as never), before, 'cold reopen changes the committed state');
  };
  const send = (invocation: Invocation, expected = 'accepted', replay = false) => {
    const before = rows();
    const rng = world().state.rng;
    const r = story.invoke(invocation);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind !== 'saved') throw new Error('unsaved');
    assert.equal(r.replay, replay);
    const d = r.decision as any;
    assert.equal(d.kind === 'rejected' ? d.error.code : d.kind, expected, JSON.stringify(d));
    if (d.kind === 'rejected' || replay) assert.deepEqual(rows(), before);
    // No family 1-2 command authors a draw.
    assert.deepEqual(world().state.rng, rng);
    reopen();
    return d;
  };
  const attempt = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `cccccccc-2222-4222-8222-${String(++sent).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const run = (action_key: string, target_ids?: string[], input?: object, expected?: string) =>
    send(attempt(action_key, target_ids, input), expected);
  const view = () => gameView(world());
  return {
    path,
    view,
    reports,
    reopen,
    send,
    attempt,
    run,
    get sql() {
      return p.sql;
    },
    get fault() {
      return p.fault;
    },
    get story() {
      return story;
    },
    move: (...directions: string[]) =>
      directions.forEach((direction) => run('move', [], { direction })),
    choose: (choice_id: string, answer?: string) =>
      run('choose', [], {
        continuation_id: view().choice!.continuation_id,
        choice_id,
        ...(answer && { answer }),
      }),
    shown: () => attempt('continue', [], { scene: view().scene!.scene, line: view().scene!.index }),
    fact: (name: string) => value(world(), fresh.character, ref('fact', name)),
    holder: (id: string) => world().state.containers[id as never],
    pennies: () => view().resources!.find((r) => r.resource.key === 'pennies')!.current,
    offered: (action_key: string) =>
      view().notices?.some((d) =>
        d.actions?.some((a) => a.action_key === action_key && a.available),
      ) ?? false,
  };
}

// Breaks (shared): partial lesson or payment on a failed write (practical_skills.test.ts:146);
// a committed custody, exchange, door or knowledge row the loader rejects or alters on reopen
// (infirmary.test.ts:19/:108, barriers and d10 suites; the mechanics lesson on committed intermediates).
test('family 1 commits and reopens every custody, trade, door and knowledge step', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = save(join(dir, 'family1.db'));
  const body = fresh.body;
  a.run('choose_ancestry', [], { ancestry: 'fen_born' });
  assert.deepEqual(a.run('read', [ids['detail/ferry_landing/notice']!]).narration, [
    { key: 'readable.notice' },
  ]);
  a.move('north', 'west');
  a.run('peg_haggle', [npc('peg')]);
  a.choose('learn');
  assert.equal(a.pennies(), 18);
  assert.equal(a.view().skills?.find((s) => s.skill.key === 'haggle')?.acquired, true);
  a.run('buy', [npc('peg'), item('satchel')], { quoted_price: 5 }, 'invalid_state');
  a.run('buy', [npc('peg'), item('satchel')], { quoted_price: 4 });
  assert.equal(a.pennies(), 14);
  assert.equal(a.holder(item('satchel')), body);
  a.move('east', 'north');
  assert.equal(a.run('where', [npc('peg')]).location.room_id, ids['room/chandler']);
  const four = ['apple_02', 'apple_01', 'apple_03', 'fox_drawing'];
  for (const k of four) a.run('take', [item(k)]);
  for (const k of four) a.run('put', [item(k), item('satchel')]);
  assert.deepEqual(
    four.map((k) => a.holder(item(k))),
    four.map(() => item('satchel')),
  );
  a.move('south', 'south', 'south', 'south', 'west');
  for (const k of ['01', '02', '03', '04']) a.run('take', [item(`fenwort_${k}`)]);
  a.run('put', [item('fenwort_01'), item('satchel')], {}, 'invalid_state');
  a.move('east', 'north', 'north', 'north', 'north', 'north', 'north');
  a.run('close', [], { direction: 'north' });
  a.run('move', [], { direction: 'north' }, 'exit_closed');
  assert.deepEqual(a.run('knock', [], { direction: 'north' }).narration, [
    { key: 'knock.chapel.answered' },
  ]);
  assert.equal(a.view().exits.find((e) => e.direction === 'north')!.door!.state, 'closed');
  a.run('open', [], { direction: 'north' });
  a.move('north');
  a.run('a_wick_offer', [npc('wick')]);
  a.choose('accept');
  a.run('b_wick_turn_in', [npc('wick')]);
  a.choose('exchange');
  // Lowest held herbs and Wick's lowest bandages by EntityId (protocol.md B5).
  assert.deepEqual(
    ['fenwort_04', 'fenwort_02', 'fenwort_03', 'bandage_10', 'bandage_01', 'bandage_09'].map((k) =>
      a.holder(item(k)),
    ),
    [npc('wick'), npc('wick'), npc('wick'), body, body, body],
  );
  assert.deepEqual([a.fact('infirmary_contribution'), a.fact('priory_fen_axis')], [1, -1]);
  a.sql.close();
});

// The legal v042 route to the belfry (e1_paths.ts search, childReturn rescued, bell).
function belfry(path: string) {
  const a = save(path);
  a.run('choose_ancestry', [], { ancestry: 'fen_born' });
  a.run('elspeth', [npc('elspeth')]);
  a.choose('accept');
  a.move('north', 'north');
  a.run('take', [item('fox_drawing')]);
  a.move('south', 'south');
  a.run('a_elspeth_report', [npc('elspeth')]);
  a.choose('report');
  a.move('south', 'south');
  a.run('study_tracks', [ids['detail/reed_bank/tracks']!]);
  a.move('south', 'south');
  a.run('a_vesper_meeting', [npc('vesper')]);
  a.choose('meet_wren');
  a.run('b_vesper_riddle', [npc('vesper')]);
  a.choose('answer', 'LANTERN');
  a.run('a_wren_escort', [npc('wren')]);
  a.choose('rescue');
  a.move('north', 'north', 'north', 'north');
  a.run('a_elspeth_rescue', [npc('elspeth')]);
  a.choose('rescued');
  a.move('north', 'north', 'north', 'north', 'north');
  a.run('a_aldric_offer', [npc('aldric')]);
  a.choose('accept');
  a.move('up', 'up');
  return a;
}

const MEMORY = [
  'memory_village_ending',
  'memory_fox_fate',
  'memory_chapter_1_guild_tilt',
  'story_point_prologue_completed',
];

// Breaks (shared): one terminal overwriting the other (missing_child_bell.test.ts:136/:297); the
// report or ending written before the final line (finale.test.ts:13, story_points.test.ts:283);
// memory adopted before a failed COMMIT (faults.test.ts:207, bell_receipts.test.ts:9); a replay
// starting a second scene or report (bell_receipts.test.ts:304).
// Breaks (only guard; review of PR 314, mutant M4): a replayed exact Continue that skips its stored
// receipt (local-story/invocation.ts:57) and is decided again instead of returning that receipt.
test('family 2 forks one belfry save into Ring and Silence, each acknowledged once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-r9c-s2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const snapshot = belfry(join(dir, 'belfry.db'));
  assert.deepEqual(
    [
      snapshot.fact('village_child_status'),
      snapshot.fact('chapel_allegiance'),
      snapshot.fact('chapel_bell_rung'),
    ],
    ['rescued', 'unknown', false],
  );
  const quest = (a: ReturnType<typeof save>, k: string) =>
    a.view().journal.find((q) => q.quest.key === k)?.state;
  assert.deepEqual(
    [quest(snapshot, 'missing_child'), quest(snapshot, 'bell_of_ashmere')],
    ['resolved', 'active'],
  );
  assert.deepEqual([snapshot.offered('ring_bell'), snapshot.offered('silence_bell')], [true, true]);
  snapshot.sql.close();
  const bytes = readFileSync(snapshot.path);
  const forks = (
    [
      [
        'ring',
        'ring_bell',
        'silence_bell',
        'prior',
        true,
        'bell_rung',
        3,
        ['rescued', 'stilled', 'prior', 'rescued_prior'],
      ],
      [
        'silence',
        'silence_bell',
        'ring_bell',
        'fox',
        false,
        'bell_silenced',
        2,
        ['rescued', 'free', 'fox', 'rescued_fox'],
      ],
    ] as const
  ).map(([name, act, other, allegiance, rung, scene, lines, memory]) => {
    const path = join(dir, `${name}.db`);
    copyFileSync(snapshot.path, path);
    assert.deepEqual(readFileSync(path), bytes);
    const a = save(path);
    const terminal = a.attempt(act, [bell]);
    a.send(terminal);
    assert.deepEqual([a.fact('chapel_allegiance'), a.fact('chapel_bell_rung')], [allegiance, rung]);
    assert.equal(quest(a, 'bell_of_ashmere'), 'resolved');
    for (let line = 1; line <= lines; line++) {
      assert.deepEqual([a.view().scene?.scene.key, a.view().scene?.index], [scene, line]);
      a.send(a.shown());
    }
    assert.equal(a.view().scene, undefined);
    assert.equal(a.offered(other), false);
    a.run(other, [bell], {}, 'invalid_state');
    a.move('down', 'down', 'south', 'south', 'south');
    assert.deepEqual(
      MEMORY.map(a.fact),
      MEMORY.map(() => 'unreached'),
    );
    const begin = a.attempt(`begin_epilogue_rescued_${allegiance}`, [
      ids['detail/village_green/market_cross']!,
    ]);
    a.send(begin);
    for (const line of [1, 2]) {
      assert.deepEqual([a.view().scene?.index, a.reports()], [line, 0]);
      a.send(a.shown());
    }
    assert.deepEqual([a.view().scene?.index, a.reports()], [3, 0]);
    return { a, terminal, begin, memory, other, last: a.shown() };
  });

  // Silence: a genuinely failed final COMMIT applies nothing; the retry applies once.
  const s = forks[1]!;
  s.a.sql.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
  );
  s.a.fault.kind = 'failed';
  s.a.fault.armed = true;
  assert.equal(s.a.story.invoke(s.last).kind, 'pending'); // COMMIT failed: outcome fenced
  s.a.fault.reads = false;
  assert.deepEqual([MEMORY.map(s.a.fact), s.a.reports()], [MEMORY.map(() => 'unreached'), 0]);
  s.a.reopen();
  assert.equal(s.a.view().scene?.index, 3);
  s.a.send(s.last);

  const r = forks[0]!;
  r.a.send(r.last);
  for (const { a, memory } of forks)
    assert.deepEqual([MEMORY.map(a.fact), a.reports(), a.view().scene], [memory, 1, undefined]);

  // Ring: the exact terminal, Begin and final Continue replay their receipts with no second effect;
  // a fresh Continue for the consumed line and the other terminal refuse.
  for (const invocation of [r.terminal, r.begin, r.last]) r.a.send(invocation, 'accepted', true);
  r.a.send(
    { ...r.last, invocation_id: r.a.attempt('continue').invocation_id },
    'unsupported_capability',
  );
  r.a.run(r.other, [bell], {}, 'invalid_state');
  assert.deepEqual(
    [MEMORY.map(r.a.fact), r.a.reports(), r.a.view().scene],
    [r.memory, 1, undefined],
  );
  for (const { a } of forks) a.sql.close();
});
