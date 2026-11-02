// loka-vduxr.11: a save left by a reaction that closes or edits a talk reopens through openGame (the
// app's launch path), and the next command runs. docs/lessons/storage.md, the reopen principle.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bundle, entity, genesis, prefix } from './riddle-fixture.ts';
import {
  adding,
  flag,
  LABEL,
  line,
  reopened,
  SAID,
  talkTo,
  withToken,
  withWorld,
} from './branching-play.ts';
import { coldReopen, elapsedHost } from './elapsed-host.test.ts';

const twoChoices = { a: line, b: line };
const rule = (event: string, steps: object[] = [{ op: 'end_talk' }]) =>
  adding({ 'reactions/cut.json': { on: { event }, steps } }, {}, { reaction: 1 });

// Breaks: riddle-save refuses a choice_opened reaction's second op or a choice_opened that closes
// its own row, so the next launch is save_corrupt for good.
test('a save reopens after choice_opened closes or edits the talk it opened', () => {
  reopened(
    withToken({ guard: talkTo(twoChoices) }, {}, rule('choice_opened')),
    (g) => assert.equal(g.at(), undefined),
    (next) => next.talk(),
  );
  reopened(
    withToken({ guard: talkTo(twoChoices) }, {}, rule('choice_opened', [flag(true)])),
    (g) => assert.ok(g.at()),
    (next) => next.choose('a'),
  );
});

// Breaks: end_talk on these events faults or leaves the talk open, or its save does not reopen.
test('a save reopens after end_talk on each other act a talk can take', () => {
  const branched = talkTo({
    a: {
      ...line,
      check: { key: 'c', kind: 'opposed', attribute: 'cha', npc: 'guard', failure: SAID },
      then: 'won',
      then_failed: 'lost',
    },
    b: line,
  });
  const check = {
    guard: branched,
    won: talkTo(twoChoices),
    lost: talkTo(twoChoices),
  };
  const rows: [string, object, (src: string) => void][] = [
    ['choice_resolved', { guard: talkTo(twoChoices) }, () => {}],
    ['check_passed', check, () => {}],
    [
      'check_failed',
      check,
      adding({
        'npcs/guard.json': {
          keywords: ['guard'],
          name: 'npc.guard.short',
          room_line: 'npc.guard.room',
          description: 'npc.guard.description',
          room: 'gate_room',
          attributes: [{ attribute: 'cha', value: 99 }],
        },
      }),
    ],
    [
      'story_point_reached',
      { guard: talkTo({ a: { ...line, story_point: 'met/a', once: true }, b: line }) },
      () => {},
    ],
  ];
  for (const [event, dialogues, edit] of rows) {
    const c = withToken(dialogues as never, {}, (src) => {
      rule(event)(src);
      edit(src);
    });
    reopened(c, (g) => {
      const d = g.choose('a');
      assert.ok(
        d.events.some((e: { payload: { type: string } }) => e.payload.type === event),
        event,
      );
      assert.equal(g.at(), undefined, event);
    });
  }
});

function riddle(
  event: string,
  play: (p: { open: () => void; coil: () => void; miss: () => void }) => void,
  change: (c: any) => void = () => {},
) {
  const b = bundle((c) => {
    c.lock.capabilities.reaction = 1;
    c.manifest.requires.capabilities.reaction = 1;
    (c.reactions ??= {})[`${prefix}:reaction/cut`] = {
      key: 'cut',
      on: { event },
      steps: [{ op: 'end_talk' }],
    };
    change(c);
  });
  const dir = mkdtempSync(join(tmpdir(), 'loka-end-talk-'));
  const path = join(dir, 'save.db');
  try {
    const a = elapsedHost(path, { wall: 10000, mono: 0 }, b);
    const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
      const r = a.game.invoke({ action_key, target_ids, input } as never);
      assert.equal(r.kind === 'saved' && r.decision.kind, 'accepted', JSON.stringify(r));
    };
    const sphinx = entity(genesis(), 'npc', 'sphinx');
    const open = () => ok('riddle', [sphinx]);
    ok('lantern');
    ok('take', [entity(genesis(), 'item', 'lantern')]);
    const initial = genesis();
    const post = Object.keys(initial.details!).find(
      (id) => initial.details![id]!.key === 'mooring_post',
    )!;
    play({
      open,
      coil: () => ok('coil_rope', [post]),
      miss: () =>
        ok('choose', [], {
          choice_id: 'answer',
          continuation_id: a.game.view().view.choice!.continuation_id,
          answer: 'tied',
        }),
    });
    assert.equal(a.game.view().view.choice, undefined);
    a.sql.close();
    coldReopen(path, b);
    // The next command after the reopen.
    const again = elapsedHost(path, { wall: 10000, mono: 0 }, b);
    const s = (again.game.view().view as any).scene;
    const r = again.game.invoke({
      action_key: s ? 'continue' : 'riddle',
      target_ids: s ? [] : [sphinx],
      input: s ? { scene: s.scene, line: s.index } : {},
    } as never);
    assert.equal(r.kind === 'saved' && r.decision.kind, 'accepted', JSON.stringify(r));
    again.sql.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Breaks: riddle-save refuses a riddle row some other act closed, with or without wrong tries on it.
test('a save reopens after a reaction closes a bounded riddle', () => {
  riddle('choice_opened', ({ open }) => open());
  riddle('action_completed', ({ open, miss, coil }) => {
    open();
    miss();
    coil();
  });
});

// Breaks: riddle-save requires `attempts` on a closed riddle row, as it may on one with a limit, so
// a reaction closing an unbounded riddle leaves a save that is save_corrupt on the next launch.
test('a save reopens after a reaction closes an unbounded riddle', () => {
  riddle(
    'action_completed',
    ({ open, coil }) => {
      open();
      coil();
    },
    (c) => delete c.dialogues[`${prefix}:dialogue/riddle`].riddle.wrong_limit,
  );
});

// Breaks: a fight stops refusing `choose` or `perform`, so end_talk fires on a player mid-round; a
// talk left open through a fight does not reopen; or `cast`, kept in a fight, stops closing the
// talk or leaves a save that does not reopen and play on.
test('in a fight only `cast` can fire end_talk; the talk open or closed survives the save', () => {
  const fighter = {
    keywords: ['guard'],
    name: LABEL,
    room_line: LABEL,
    description: LABEL,
    room: 'green',
    hp: { minimum: 0, maximum: 99, start: 99, gain: 0 },
    attack: { chance: 0, damage_min: 1, damage_max: 1 },
  };
  const c = withWorld({ guard: talkTo(twoChoices) }, {}, (src) => {
    const room = JSON.parse(readFileSync(join(src, 'rooms/green.json'), 'utf8'));
    room.details = { post: { aliases: ['post'], description: LABEL } };
    adding(
      {
        'npcs/guard.json': fighter,
        'rooms/green.json': room,
        'reactions/cut.json': { on: { event: 'choice_resolved' }, steps: [{ op: 'end_talk' }] },
        'reactions/cut_act.json': {
          on: { event: 'action_completed' },
          steps: [{ op: 'end_talk' }],
        },
        'actions/hex.json': {
          name: LABEL,
          aliases: ['hex'],
          target: { kind: 'spell', word: 'hex', learned: 'hex_known' },
          priority: 0,
          outcomes: { success: { steps: [flag(true)], narration: { actor: SAID } } },
        },
        'actions/tie.json': {
          name: LABEL,
          aliases: ['tie'],
          target: { kind: 'detail', room: 'green', detail: 'post' },
          priority: 10,
          outcomes: { success: { steps: [flag(true)], narration: { actor: SAID } } },
        },
      },
      {
        hex_known: {
          version: 1,
          value_type: { type: 'bool', default: true },
          scopes: ['player'],
          meaning: 'x',
        },
        gate_open: {
          version: 1,
          value_type: { type: 'bool', default: false },
          scopes: ['instance'],
          meaning: 'x',
        },
      },
      { reaction: 1, scripted_action: 1, inspectable_detail: 1 },
    )(src);
  });
  reopened(c, (g) => {
    const row = g.at()!;
    const w = () => g.story.world();
    const guard = g.fresh.entityIds['persuade_sampler@0.0.1:npc/guard']!;
    const post = Object.keys(w().details!).find((id) => w().details![id]!.key === 'post')!;
    g.go('attack', {}, [guard]);
    const n = 'aaaaaaaa-1414-4414-8414-00000000009';
    const refused = (action_key: string, target_ids: string[], input: object, i: number) => {
      const r = g.story.invoke({
        invocation_id: `${n}${i}`,
        actor_id: g.fresh.character,
        action_key,
        target_ids,
        input,
      });
      assert.equal(r.kind === 'saved' && (r.decision as any).error?.code, 'unsupported_capability');
    };
    refused('choose', [], { choice_id: 'a', continuation_id: row[0] }, 1);
    refused('tie', [post], {}, 2);
    assert.equal(g.at()![0], row[0]);
  });
  reopened(
    c,
    (g) => {
      g.go('attack', {}, [g.fresh.entityIds['persuade_sampler@0.0.1:npc/guard']!]);
      assert.ok(g.at());
      g.go('cast', { word: 'hex' });
      assert.equal(g.at(), undefined);
    },
    (next) => next.go('cast', { word: 'hex' }),
  );
});
