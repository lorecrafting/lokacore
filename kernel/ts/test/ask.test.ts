// Toolbox row FD7 on the compiled ask sampler: gate -north- square. The smith, the miller and the
// guard stand in the square; entering it teaches mill and moon. The smith answers mill (granting
// smugglers) and, at trust 1 (her talk's help), smugglers; the guard answers moon and turns
// hostile once asked about smugglers; the miller has no ask.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

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

// The sampler changed by `change`, loaded again.
function reload(change: (c: Obj) => void) {
  const c = structuredClone(content) as unknown as Obj;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}

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
  accepted(newWorld(c, '7e1f0c2a-5d3b-4c8e-9a6f-00000000000a' as never, [1, 2, 3, 4]), {
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

// Breaks: an unknown topic asked (the known-topic check dropped), or an answer's when ignored
// or read without the NPC as target (the smith's trust is a pair fact).
test('a topic the actor does not know is refused; an answer holds only when its when does', () => {
  assert.equal(refused(square(), 'smith', 'smugglers'), 'invalid_state');
  const w = answer(square(), 'smith', 'mill').w;
  assert.equal(answer(w, 'smith', 'smugglers').text, 'smith.unknown');
  let t = accepted(w, { type: 'talk', target_id: id(w, 'smith') });
  t = accepted(t, {
    type: 'choose',
    continuation_id: gameView(t).choice!.continuation_id,
    choice_id: 'help',
  });
  assert.equal(value(t, t.character, ref('fact', 'trust'), id(t, 'smith')), 1);
  const s = answer(t, 'smith', 'smugglers');
  assert.deepEqual([s.text, s.events.length], ['smith.smugglers', 1]);
});

// Breaks: an NPC without ask admitted, the asked reaction's npc/topic/answered filters ignored, a hostile
// NPC still answering, or ask admitted (or offered) during a pending conversation.
test('the miller cannot be asked; the guard turns hostile on smugglers; a conversation blocks ask', () => {
  const w = answer(square(), 'smith', 'mill').w;
  assert.equal(refused(w, 'miller', 'mill'), 'invalid_target');
  assert.equal(value(answer(w, 'smith', 'smugglers').w, w.character, ref('fact', 'wanted')), false);
  const g = answer(w, 'guard', 'smugglers');
  assert.equal(g.text, 'guard.unknown');
  assert.equal(value(g.w, g.w.character, ref('fact', 'wanted')), true);
  assert.equal(refused(g.w, 'guard', 'moon'), 'invalid_state');
  assert.deepEqual(offer(g.w, 'guard'), {
    ...offer(w, 'guard'),
    available: false,
    reason: { code: 'invalid_state' },
  });
  const strict = reload((c) => (c.reactions[`${P}reaction/guard_smugglers`].on.answered = true));
  assert.ok(strict.ok);
  const unanswered = answer(
    answer(square(strict.cartridge as Cartridge), 'smith', 'mill').w,
    'guard',
    'smugglers',
  );
  assert.equal(value(unanswered.w, unanswered.w.character, ref('fact', 'wanted')), false);
  const t = accepted(w, { type: 'talk', target_id: id(w, 'smith') });
  assert.equal(offer(t, 'smith'), undefined);
  assert.equal(refused(t, 'smith', 'mill'), 'unsupported_capability'); // speech verbs leave the set
});

// Breaks: the loader trusting an ask's topic, its owning capability, the 1.96 floor, or an asked
// trigger's topic.
test('the loader refuses an unknown answer topic, ask without speech@1, 1.95 and a bad trigger topic', () => {
  const smith = `${P}npc/smith`;
  const refusal = (change: (c: Obj) => void) => {
    const r = reload(change);
    assert.ok(!r.ok);
    return [r.diagnostic.code, r.diagnostic.path?.split('.').at(-1)];
  };
  const nope = ref('topic', 'nope');
  assert.deepEqual(
    refusal((c) => (c.npcs[smith].ask.answers[0].topic = nope)),
    ['UNRESOLVED_REFERENCE', 'topic'],
  );
  assert.deepEqual(
    refusal((c) => {
      delete c.lock.capabilities.speech;
      delete c.manifest.requires.capabilities.speech;
      delete c.reactions[`${P}reaction/guard_smugglers`]; // its asked trigger needs speech@1 too
    }),
    ['UNDECLARED_CAPABILITY', 'ask'],
  );
  // Each floor alone: the asks' (no asked trigger left), then the asked trigger's (no ask left).
  for (const drop of [
    (c: Obj) => delete c.reactions[`${P}reaction/guard_smugglers`],
    (c: Obj) => Object.values(c.npcs as Record<string, Obj>).forEach((n) => void delete n.ask),
  ])
    assert.deepEqual(
      refusal((c) => {
        c.manifest.requires.kernel_api.at_least = '1.95';
        drop(c);
      }),
      ['KERNEL_API_RANGE_INVALID', 'at_least'],
    );
  assert.deepEqual(
    refusal((c) => (c.reactions[`${P}reaction/guard_smugglers`].on.topic = nope)),
    ['UNRESOLVED_REFERENCE', 'topic'],
  );
});
