// Toolbox row FD7 on the compiled ask sampler: gate -north- square. The smith, the miller and the
// guard stand in the square; entering it teaches mill and moon. The smith answers mill (granting
// smugglers) and, at trust 1 (her talk's help), smugglers; the guard answers moon and turns
// hostile once asked about smugglers; the miller has no ask.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { DefinitionRef, EntityId } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { knownTopics } from '../src/mechanics/topics/shared.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ask-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ask_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const P = 'ask_sampler@0.0.1:';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ask_sampler', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const id = (w: World, key: string) => w.entityIds[`${P}npc/${key}`] as EntityId;
const topics = (w: World) => knownTopics(w, w.character).map((t) => t.topic.key);

let n = 0;
function play(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-7777-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
const accepted = (w: World, p: object) => {
  const r = play(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return (r as typeof r & { decision: { kind: 'accepted' } }).world;
};
// A fresh game, walked into the square.
const square = (c: Cartridge = content) =>
  accepted(newWorld(c, ctx('7e1f0c2a-5d3b-4c8e-9a6f-00000000000a'), [1, 2, 3, 4]), {
    type: 'move',
    direction: 'north',
  });
const ask = (w: World, npc: string, topic: string) =>
  play(w, { type: 'ask', target_id: id(w, npc), topic: ref('topic', topic) });
const answer = (w: World, npc: string, topic: string) => {
  const r = ask(w, npc, topic);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const d = r.decision as Extract<typeof r.decision, { kind: 'accepted' }>;
  assert.equal(d.outcome, 'asked');
  return { w: r.world, text: d.narration?.[0]?.key, events: d.events.map((e) => e.payload) };
};
const refused = (w: World, npc: string, topic: string) =>
  (ask(w, npc, topic).decision as { error?: { code: string } }).error?.code;
const offer = (w: World, npc: string) =>
  gameView(w)
    .entities?.find((e) => e.id === id(w, npc))
    ?.actions?.find((a) => a.action_key === 'ask');

// Breaks: ask offered on an NPC with no ask, or the answer matched by anything but its topic
// (smith.mill read for moon), its grant dropped or written when no answer holds, or answered flipped.
test('ask lists on NPCs with an ask; the matching answer grants its topic, else unknown', () => {
  const w = square();
  assert.deepEqual(topics(w), ['mill', 'moon']);
  assert.deepEqual(
    ['smith', 'guard', 'miller'].map((k) => offer(w, k)?.available),
    [true, true, undefined],
  );
  const mill = answer(w, 'smith', 'mill');
  assert.equal(mill.text, 'smith.mill');
  assert.deepEqual(
    mill.events.map((e) => e.type),
    ['asked', 'fact_changed'],
  );
  assert.deepEqual(mill.events[0], {
    type: 'asked',
    entity_id: id(w, 'smith'),
    topic: ref('topic', 'mill'),
    answered: true,
  });
  assert.deepEqual(topics(mill.w), ['mill', 'moon', 'smugglers']);
  const moon = answer(w, 'smith', 'moon');
  assert.deepEqual(
    [moon.text, moon.events],
    [
      'smith.unknown',
      [{ type: 'asked', entity_id: id(w, 'smith'), topic: ref('topic', 'moon'), answered: false }],
    ],
  );
  assert.equal(answer(w, 'guard', 'moon').text, 'guard.moon');
});

// Breaks: the Book's ask invocation (the GameView action on the NPC, the topic as input) resolved
// without its NPC (TARGETS in commands/invocation.ts lacks ask), so every ask from the view is
// refused unsupported_capability; step-level tests send ready Commands and never see it.
test("the smith's offered ask, invoked as the Book does, is admitted and answers", () => {
  const w = square();
  const i = identify('ask-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key: offer(w, 'smith')!.action_key,
    target_ids: [id(w, 'smith')],
    input: { topic: ref('topic', 'mill') },
  } as never);
  const command = resolve(w, i as never);
  assert.ok('payload' in command, JSON.stringify(command));
  const r = play(w, command.payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.equal((r.decision as { narration?: { key: string }[] }).narration?.[0]?.key, 'smith.mill');
});

// Breaks: an unknown topic asked (the known-topic check dropped), an answer's when ignored or
// read without the NPC as target (the smith's trust is a pair fact), or a later answer on the same
// topic picked over the first that holds (find read as findLast).
test('a topic the actor does not know is refused; the first answer whose when holds is given', () => {
  assert.equal(refused(square(), 'smith', 'smugglers'), 'invalid_state');
  // The smith told about mill (trust 0), then helped in her talk (trust 1).
  const told = (c: Cartridge) => {
    const w = answer(square(c), 'smith', 'mill').w;
    let t = accepted(w, { type: 'talk', target_id: id(w, 'smith') });
    t = accepted(t, {
      type: 'choose',
      continuation_id: gameView(t).choice!.continuation_id,
      choice_id: 'help',
    });
    assert.equal(value(t, t.character, ref('fact', 'trust'), id(t, 'smith')), 1);
    return [w, t] as const;
  };
  const [w, t] = told(content);
  assert.equal(answer(w, 'smith', 'smugglers').text, 'smith.unknown');
  const s = answer(t, 'smith', 'smugglers');
  assert.deepEqual([s.text, s.events.length], ['smith.smugglers', 1]);
  // A fallback smugglers answer authored after the trust-gated one.
  const fallback = reload(content, (c) =>
    c.npcs[`${P}npc/smith`].ask.answers.push({
      topic: ref('topic', 'smugglers'),
      text: 'smith.mill',
    }),
  );
  assert.ok(fallback.ok);
  const [f0, f1] = told(fallback.cartridge as Cartridge);
  assert.deepEqual(
    [answer(f1, 'smith', 'smugglers').text, answer(f0, 'smith', 'smugglers').text],
    ['smith.smugglers', 'smith.mill'],
  );
});

// Breaks: an NPC without ask, in another room or not an NPC admitted, the asked reaction's
// npc/topic/answered filters ignored, its subject not the asked NPC (a pair fact step with no
// named NPC then writes nothing), a hostile NPC still answering, or ask admitted (or offered)
// during a pending conversation.
test('the miller cannot be asked; the guard turns hostile on smugglers; a conversation blocks ask', () => {
  const w = answer(square(), 'smith', 'mill').w;
  assert.equal(refused(w, 'miller', 'mill'), 'invalid_target');
  const gate = newWorld(content, ctx('7e1f0c2a-5d3b-4c8e-9a6f-00000000000a'), [1, 2, 3, 4]);
  assert.equal(refused(gate, 'smith', 'mill'), 'not_present');
  const room = {
    type: 'ask',
    target_id: w.entityIds[`${P}room/square`],
    topic: ref('topic', 'mill'),
  };
  assert.equal((play(w, room).decision as { error?: { code: string } }).error?.code, 'not_found');
  const wanted = (npc: string, topic: string) =>
    value(answer(w, npc, topic).w, w.character, ref('fact', 'wanted'));
  assert.deepEqual([wanted('smith', 'smugglers'), wanted('guard', 'moon')], [false, false]);
  const g = answer(w, 'guard', 'smugglers');
  assert.equal(g.text, 'guard.unknown');
  assert.equal(value(g.w, g.w.character, ref('fact', 'wanted')), true);
  assert.equal(refused(g.w, 'guard', 'moon'), 'invalid_state');
  assert.deepEqual(offer(g.w, 'guard'), {
    ...offer(w, 'guard'),
    available: false,
    reason: { code: 'invalid_state' },
  });
  const strict = reload(
    content,
    (c) => (c.reactions[`${P}reaction/guard_smugglers`].on.answered = true),
  );
  assert.ok(strict.ok);
  const unanswered = answer(
    answer(square(strict.cartridge as Cartridge), 'smith', 'mill').w,
    'guard',
    'smugglers',
  );
  assert.equal(value(unanswered.w, unanswered.w.character, ref('fact', 'wanted')), false);
  // The asked reaction's subject is the asked NPC: trust (a pair fact) set toward the guard.
  const toward = reload(content, (c) =>
    c.reactions[`${P}reaction/guard_smugglers`].steps.push({
      op: 'fact.assign',
      fact: ref('fact', 'trust'),
      value: 1,
    }),
  );
  assert.ok(toward.ok);
  const tw = answer(
    answer(square(toward.cartridge as Cartridge), 'smith', 'mill').w,
    'guard',
    'smugglers',
  ).w;
  assert.deepEqual(
    ['guard', 'smith'].map((k) => value(tw, tw.character, ref('fact', 'trust'), id(tw, k))),
    [1, 0],
  );
  const t = accepted(w, { type: 'talk', target_id: id(w, 'smith') });
  assert.equal(offer(t, 'smith'), undefined);
  assert.equal(refused(t, 'smith', 'mill'), 'unsupported_capability'); // speech verbs leave the set
});
