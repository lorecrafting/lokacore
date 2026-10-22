import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import type { Command } from '../src/contracts.gen.ts';
import { read } from './read.ts';
import { genesis, load, prefix } from './search_fixture.ts';

const green = `${prefix}:room/village_green`;
const detail = (w: World, key: string) =>
  Object.keys(w.details).find((id) => w.details[id].key === key)!;
const inn = () => {
  const w = genesis();
  return step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      world_context_id: w.context,
      payload: { actor_id: w.character, type: 'move', direction: 'north' },
    } as Command,
    1,
  ).world;
};

// Breaks: the portable wire/source validator admits missing or unbounded board metadata.
test('notice metadata uses the shared valid and invalid schema controls', () => {
  for (const c of read('protocol/fixtures/notice_board_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Breaks: loader trusts cross-room/self/board/duplicate references or missing title catalog keys.
test('loader rejects invalid board membership, title references and readable ownership', () => {
  for (const [name, change, suffix, target] of [
    [
      'remote',
      (d: any) => (d.rumor_board.notice_board.notices[0].detail = 'tracks'),
      '.notices[0].detail',
      'tracks',
    ],
    [
      'self',
      (d: any) => (d.rumor_board.notice_board.notices[0].detail = 'rumor_board'),
      '.notices[0].detail',
      'rumor_board',
    ],
    ['ordinary', (d: any) => delete d.lost_whistle.readable, '.notices[0].detail', 'lost_whistle'],
    [
      'duplicate',
      (d: any) => (d.rumor_board.notice_board.notices[1].detail = 'lost_whistle'),
      '.notices[1].detail',
      'lost_whistle',
    ],
    [
      'title',
      (d: any) => (d.rumor_board.notice_board.title = 'missing.title'),
      '.title',
      'missing.title',
    ],
    [
      'child title',
      (d: any) => (d.rumor_board.notice_board.notices[1].title = 'missing.title'),
      '.notices[1].title',
      'missing.title',
    ],
    [
      'board readable',
      (d: any) =>
        (d.rumor_board.readable = { label: 'actions.read_tracks', text: 'readable.tracks' }),
      '',
      undefined,
    ],
  ] as const) {
    const result = load((c) => change(c.rooms[green].details));
    assert.ok(!result.ok, name);
    assert.equal(result.diagnostic.code, 'UNRESOLVED_REFERENCE', name);
    assert.equal(
      result.diagnostic.path,
      `.cartridge.rooms["${green}"].details.rumor_board.notice_board${suffix}`,
      name,
    );
    assert.deepEqual(result.diagnostic.data, target === undefined ? {} : { target }, name);
  }
  const result = load((c) => {
    delete c.lock.capabilities.readable;
    delete c.manifest.requires.capabilities.readable;
    for (const r of Object.values(c.rooms) as any[])
      for (const d of Object.values(r.details ?? {}) as any[]) delete d.readable;
  });
  assert.ok(!result.ok);
  assert.equal(result.diagnostic.code, 'UNDECLARED_CAPABILITY');
});

// Breaks: projection exposes notice bodies, wrong sibling IDs, remote boards or base descriptions
// after policies select variants; Read aliases/unavailable offers must stay canonical.
test('board projection keeps bounded identities and selected descriptions separate from Read eligibility', () => {
  const initial = genesis();
  assert.deepEqual(gameView(initial).notices, [
    {
      id: detail(initial, 'tracks'),
      title: 'detail.tracks.title',
      description: 'detail.tracks.description',
    },
  ]);
  assert.equal(gameView(initial).notice_boards, undefined);
  const w = inn(),
    board = detail(w, 'rumor_board'),
    whistle = detail(w, 'lost_whistle');
  assert.deepEqual(gameView(w).notice_boards, [
    {
      id: board,
      title: 'detail.rumor_board.title',
      description: 'detail.rumor_board.description',
      notices: [
        {
          id: whistle,
          title: 'detail.lost_whistle.title',
          description: 'detail.lost_whistle.description',
        },
        {
          id: detail(w, 'cellar_help'),
          title: 'detail.cellar_help.title',
          description: 'detail.cellar_help.description',
        },
      ],
    },
  ]);
  assert.equal(gameView(w).notices, undefined);
  const changed = {
    ...w,
    details: {
      ...w.details,
      [board]: {
        ...w.details[board],
        variants: [
          {
            when: { policy_version: 1, root: { op: 'time_window', from: 0, to: 23 } },
            description: 'alternate.board' as never,
          },
        ],
      },
      [whistle]: {
        ...w.details[whistle],
        variants: [
          {
            when: { policy_version: 1, root: { op: 'time_window', from: 0, to: 23 } },
            description: 'alternate.notice' as never,
          },
        ],
      },
    },
  } as World;
  const view = gameView(changed);
  assert.equal(view.notice_boards![0].description, 'alternate.board');
  assert.equal(view.notice_boards![0].notices[0].description, 'alternate.notice');
  const blocked = {
    ...w,
    rooms: {
      ...w.rooms,
      [w.state.containers[w.body]]: {
        ...w.rooms[w.state.containers[w.body]],
        actions: [{ op: 'subtract', actions: ['read'] }],
      },
    },
  } as World;
  assert.deepEqual(gameView(blocked).notice_boards, gameView(w).notice_boards);
  assert.ok(!gameView(blocked).actions.some((a) => a.target_ids?.includes(whistle as never)));
});
