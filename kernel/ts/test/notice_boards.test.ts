import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, gameView, step, type World } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import type { Command } from '../src/contracts.gen.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/missing_child_v004_hash.json');
const prefix = 'ashmere_missing_child@0.0.4:room/';
const load = (change: (c: any) => void = () => {}) => {
  const c = structuredClone(pin.value);
  change(c);
  const canonical = encode(c),
    content_hash = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    INSTALLED,
  );
};
const fresh = () => {
  const result = load();
  assert.ok(result.ok);
  assert.ok(result.cartridge.format === 'loka-cartridge-v2');
  return newWorld(result.cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
};
const whistle = 'e368b8b9-c4a5-8d0e-82a0-da17e2d59fe2',
  cellar = '15349791-fa65-81f7-b378-bb8212b808d2';
const turn = (w: World, payload: object) =>
  step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as Command,
    1,
  ).world;
const inn = () =>
  turn(turn(fresh(), { type: 'move', direction: 'north' }), { type: 'move', direction: 'east' });

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
      (d: any) => (d.rumor_board.notice_board.notices[0].detail = 'notice'),
      '.notices[0].detail',
      'notice',
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
        (d.rumor_board.readable = { label: 'actions.read_notice', text: 'readable.notice' }),
      '',
      undefined,
    ],
  ] as const) {
    const result = load((c) => change(c.rooms[prefix + 'drowned_lantern'].details));
    assert.ok(!result.ok, name);
    assert.equal(result.diagnostic.code, 'UNRESOLVED_REFERENCE', name);
    assert.equal(
      result.diagnostic.path,
      `.cartridge.rooms["${prefix}drowned_lantern"].details.rumor_board.notice_board${suffix}`,
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
  const initial = fresh();
  assert.deepEqual(gameView(initial).notices, [
    {
      id: '251e7a71-b5ad-8d22-858b-533e52cc5415',
      title: 'detail.notice.title',
      description: 'detail.notice.description',
    },
  ]);
  assert.equal(gameView(initial).notice_boards, undefined);
  const w = inn();
  assert.deepEqual(gameView(w).notice_boards, [
    {
      id: 'd7e286c7-c344-8eef-8aa6-94a781d448bd',
      title: 'detail.rumor_board.title',
      description: 'detail.rumor_board.description',
      notices: [
        {
          id: whistle,
          title: 'detail.lost_whistle.title',
          description: 'detail.lost_whistle.description',
        },
        {
          id: cellar,
          title: 'detail.cellar_help.title',
          description: 'detail.cellar_help.description',
        },
      ],
    },
  ]);
  assert.equal(gameView(w).notices, undefined);
  const board = 'd7e286c7-c344-8eef-8aa6-94a781d448bd';
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
