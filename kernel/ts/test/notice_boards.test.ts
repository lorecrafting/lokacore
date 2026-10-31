import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import type { Command } from '../src/contracts.gen.ts';
import { read } from './read.ts';
import { genesis } from './search_fixture.ts';

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

// Breaks: projection exposes notice bodies, wrong sibling IDs or keys (a board's key on its
// children), remote boards or base descriptions
// after policies select variants; Read aliases/unavailable offers must stay canonical.
test('board projection keeps bounded identities and selected descriptions separate from Read eligibility', () => {
  const initial = genesis();
  assert.deepEqual(gameView(initial).notices, [
    {
      id: detail(initial, 'mooring_post'),
      key: 'mooring_post',
      title: 'detail.mooring_post',
      description: 'detail.mooring_post',
      actions: ['lantern', 'oar'].map((k) => ({
        action_key: k,
        available: true,
        input: [],
        label: `quest.${k}.accept`,
        target: { kind: 'none' },
      })),
    },
    {
      id: detail(initial, 'tracks'),
      key: 'tracks',
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
      key: 'rumor_board',
      title: 'detail.rumor_board.title',
      description: 'detail.rumor_board.description',
      notices: [
        {
          id: whistle,
          key: 'lost_whistle',
          title: 'detail.lost_whistle.title',
          description: 'detail.lost_whistle.description',
        },
        {
          id: detail(w, 'cellar_help'),
          key: 'cellar_help',
          title: 'detail.cellar_help.title',
          description: 'detail.cellar_help.description',
        },
      ],
    },
  ]);
  assert.equal(gameView(w).notices, undefined);
  assert.deepEqual(validate('GameView', gameView(initial)), []);
  assert.deepEqual(validate('GameView', gameView(w)), []);
  const changed = {
    ...w,
    details: {
      ...w.details,
      [board]: {
        ...w.details[board],
        variants: [
          {
            when: { op: 'time_window', from: 0, to: 23 },
            description: 'alternate.board' as never,
          },
        ],
      },
      [whistle]: {
        ...w.details[whistle],
        variants: [
          {
            when: { op: 'time_window', from: 0, to: 23 },
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
