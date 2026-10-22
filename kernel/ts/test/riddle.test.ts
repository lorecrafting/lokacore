// dialogue@1 riddles over the riddle fragment (riddle_fixture.ts): every expected value below is
// authored there (bank T I D E, answer tide, wrong_limit 3, roles sphinx and bram).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { World } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { entity, genesis, load, prefix, ref, runner } from './riddle_fixture.ts';

// An unbounded riddle: no wrong_limit and no quest, so the answer is offered at once.
const unbounded = (c: any) => {
  const d = c.dialogues['scene_sampler@0.0.1:dialogue/riddle'];
  delete d.riddle.wrong_limit;
  delete d.quest;
};
const solved = (w: World) => value(w, w.character, ref('fact', 'riddle_solved'));

// Breaks: a malformed answer counts, a wrong answer is not counted, the limit does not close the
// sitting (or closes the quest), or a new sitting keeps the old count or spends time.
test('only bank-valid wrong answers count and the third closes only the sitting with immediate reset', () => {
  const r = runner();
  r.start();
  const opened = r.view().choice!.continuation_id,
    clock = r.view().time;
  for (const answer of [undefined, 'tttt', 'TÍDE', '']) {
    r.choose('answer', answer, 'invalid_state');
    assert.deepEqual(r.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
  }
  for (const [i, answer] of ['edit', 'diet', 'tied'].entries()) {
    assert.deepEqual(r.view().choice!.riddle!.attempts, { count: i, limit: 3 });
    r.choose('answer', answer);
  }
  assert.equal(r.view().choice, undefined);
  assert.equal(r.view().journal.find((q) => q.quest.key === 'lantern')!.state, 'active');
  r.talk('sphinx');
  assert.notEqual(r.view().choice!.continuation_id, opened);
  assert.deepEqual(r.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
  assert.equal(r.view().time, clock);
});

// Breaks: comparison/assignment is missing, wrong answers consume the continuation, or banks allow
// excess tiles.
test('wrong answer retries the same bound row; malformed banks refuse; correct answer is once-only', () => {
  const r = runner(genesis(unbounded));
  r.start();
  const before = r.view().choice!;
  assert.deepEqual(before.riddle, { choice_id: 'answer', bank: ['T', 'I', 'D', 'E'] });
  for (const answer of [undefined, 'TT', 'TIDES', 'Z']) {
    const state = r.world().state;
    r.choose('answer', answer, 'invalid_state');
    assert.deepEqual(r.world().state, state);
  }
  const wrong = r.choose('answer', 'EDIT');
  assert.ok(wrong.kind === 'accepted');
  assert.equal(wrong.outcome, 'riddle_wrong');
  assert.deepEqual(wrong.events, []);
  assert.deepEqual(wrong.delta.ops, []);
  assert.equal(wrong.narration?.[0].key, 'narration.riddle.wrong');
  assert.deepEqual(r.view().choice, before);
  assert.equal(solved(r.world()), false);
  const correct = r.choose('answer', 'TiDe');
  assert.ok(correct.kind === 'accepted');
  assert.equal(correct.outcome, 'answer');
  assert.equal(correct.events.filter((e) => e.payload.type === 'choice_resolved').length, 1);
  assert.equal(solved(r.world()), true);
  assert.equal(r.view().choice, undefined);
  r.run(
    {
      type: 'choose',
      continuation_id: before.continuation_id,
      choice_id: 'answer',
      answer: 'tide',
    },
    'invalid_state',
  );
});

// Breaks: Choose rebinds by blueprint, ignores one role, or accepts dead/departed bound participants.
test('either original participant leaving or dying disables Choose while Close stays available', () => {
  for (const role of ['sphinx', 'bram'])
    for (const failure of ['departed', 'dead', 'substitute']) {
      const r = runner(genesis(unbounded));
      r.start();
      const w = r.world(),
        id = entity(w, 'npc', role),
        here = w.state.containers[w.body]!,
        other = w.roomIds['scene_sampler@0.0.1:room/village_green']!;
      const resource = key({ kind: 'resource', resource: ref('resource', 'hp'), entity_id: id });
      const hp = { minimum: 0, maximum: 10, start: 10, gain: 0 };
      if (failure === 'dead')
        r.set({
          ...w,
          entities: { ...w.entities, [id]: { ...w.entities[id], hp } },
          entityResourceSpecs: { ...w.entityResourceSpecs, [resource]: hp },
          state: {
            ...w.state,
            resources: { ...w.state.resources, [resource]: { value: 0, at: w.state.clock } },
          },
        } as World);
      else {
        const substitute = 'dddddddd-0000-4000-8000-000000000001';
        r.set({
          ...w,
          entities: {
            ...w.entities,
            ...(failure === 'substitute' && { [substitute]: w.entities[id] }),
          },
          state: {
            ...w.state,
            containers: {
              ...w.state.containers,
              [id]: other,
              ...(failure === 'substitute' && { [substitute]: here }),
            },
          },
        });
      }
      const choice = r.view().choice!;
      assert.equal(choice.closable, true, `${role} ${failure}`);
      assert.deepEqual(choice.choices[0], {
        choice_id: 'answer',
        label: 'dialogue.riddle.answer',
        available: false,
        reason: { code: 'not_present' },
      });
      r.choose('answer', 'tide', 'not_present');
      r.run({ type: 'close_choice', continuation_id: choice.continuation_id });
      assert.equal(solved(r.world()), false);
    }
});

// Breaks (loka-x6t.5 save re-check): a reopening hub answer that directly assigns a bounded riddle's
// answer fact (riddle-save proves it by one receipt) loads, so repeating it turns the save corrupt;
// or the check flags an unbounded riddle's fact or any other fact.
test('a reopening dialogue rejects a direct assignment of a bounded riddle answer fact', () => {
  const at = `.cartridge.dialogues["${prefix}:dialogue/chat"].choices.ask.sequence[0].op`;
  for (const [fact, bounded, code] of [
    ['riddle_solved', true, 'OUTCOME_MISMATCH'],
    ['riddle_solved', false, undefined],
    ['bell_heard', true, undefined],
  ] as const) {
    const loaded = load((c) => {
      if (!bounded) unbounded(c);
      // No quest, no riddle, two choices: Bram's chat reopens after each answer.
      c.dialogues[`${prefix}:dialogue/chat`] = {
        key: 'chat',
        npc: ref('npc', 'bram'),
        prompt: 'dialogue.bram.prompt',
        policy: c.dialogues[`${prefix}:dialogue/bram`].policy,
        roles: { bram: { role: 'npc', npc: ref('npc', 'bram') } },
        choices: {
          ask: {
            label: 'dialogue.bram.carry',
            narration: 'narration.bram.carry',
            sequence: [{ op: 'fact.assign', fact: ref('fact', fact), value: true }],
          },
          bye: { label: 'dialogue.bram.leave', narration: 'narration.bram.leave' },
        },
      };
    });
    assert.deepEqual(
      loaded.ok ? undefined : [loaded.diagnostic.code, loaded.diagnostic.path],
      code && [code, at],
      `${fact} ${bounded}`,
    );
  }
});
