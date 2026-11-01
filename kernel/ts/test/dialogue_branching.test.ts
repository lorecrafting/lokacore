// loka-vduxr.10 on the compiled persuade sampler: per-choice conditions, links between dialogues,
// a check's two ways on, the hand-off, narrate steps, int fact thresholds and narration variants.
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
import { encode } from '../src/foundation/canonical.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-branching-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/persuade_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const P = 'persuade_sampler@0.0.1';
const base = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'persuade_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const LABEL = 'dialogue.guard.persuade';
const SAID = 'narration.guard.persuade';
const FAILED = 'narration.guard.persuade_failed';
const plain = (extra: object = {}) => ({ label: LABEL, narration: SAID, ...extra });
const set = (key: string, value: unknown = true) => ({
  op: 'fact.assign',
  fact: ref('fact', key),
  value,
});
const is = (key: string, equals: unknown) => ({
  op: 'fact_compare',
  fact: ref('fact', key),
  equals,
});

// The sampler with `choices` on the guard, `more` further dialogues of the guard, and bool facts
// `flag` and `other`; `edit` then changes anything else.
function content(choices: object, more: Record<string, object> = {}, edit = (_: any) => {}) {
  const c = structuredClone(base);
  const guard = c.dialogues[`${P}:dialogue/guard`];
  guard.choices = choices;
  for (const [key, opts] of Object.entries(more))
    c.dialogues[`${P}:dialogue/${key}`] = { ...structuredClone(guard), key, choices: opts };
  for (const key of ['flag', 'other'])
    c.facts[`${P}:fact/${key}`] = { ...c.facts[`${P}:fact/gate_open`], key };
  edit(c);
  return c;
}

function play(c: unknown) {
  const canonical = encode(c as never);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  let w: World = newWorld(
    loaded.cartridge as Cartridge,
    ctx('4c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1e'),
    [1, 2, 3, 4],
  );
  let n = 0;
  const send = (payload: object) => {
    n += 1;
    const command = {
      id: `ffffffff-9999-4999-8999-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    };
    const r = step(w, command as never, n);
    w = r.world;
    return r.decision as any;
  };
  const view = () => gameView(w).choice as any;
  const talk = (npc = 'guard') => send({ type: 'talk', target_id: w.entityIds[`${P}:npc/${npc}`] });
  const opened = () => {
    const d = talk();
    assert.equal(d.kind, 'accepted', JSON.stringify(d));
    return view().continuation_id as string;
  };
  const choose = (choice_id: string) =>
    send({ type: 'choose', continuation_id: view().continuation_id, choice_id });
  const ids = () => view()?.choices.map((o: any) => o.choice_id);
  return { send, talk, opened, choose, ids, view, world: () => w };
}
const ops = (d: any) => d.delta.ops.map((o: any) => o.op);
const events = (d: any) => d.events.map((e: any) => [e.position, e.payload.type]);
const opens = (d: any) => d.delta.ops.find((o: any) => o.op === 'choice.open');

// Breaks: a false choice policy still drawn, or drawn out but still admitted from a stale card.
test('a choice whose policy fails is not drawn and is refused; one that holds is both', () => {
  const g = play(
    content({
      hidden: plain({ policy: is('flag', true) }),
      shown: plain({ policy: is('flag', false) }),
    }),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['shown']);
  assert.deepEqual(g.choose('hidden'), { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(g.choose('shown').kind, 'accepted');
});

// Breaks: talk opens the first dialogue by key though all its options are hidden.
test('talk passes over a dialogue whose options are all hidden', () => {
  const g = play(
    content({ shown: plain() }, { aardvark: { hidden: plain({ policy: is('flag', true) }) } }),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['shown']);
  assert.deepEqual(g.view().prompt?.key ?? g.view().prompt, 'dialogue.guard.prompt');
});

// Breaks: the hub reads the world before the answer's facts, so a spent option is redrawn or a
// conversation with nothing left reopens; or the reopened row narrows its full choice_ids.
test('the hub reads the answer facts: spent options leave, nothing left ends the talk', () => {
  const once = (key: string) => plain({ policy: is(key, false), steps: [set(key)] });
  const left = play(content({ a: once('flag'), z: plain() }));
  left.opened();
  const d = left.choose('a');
  assert.deepEqual(events(d), [
    [1, 'fact_changed'],
    [2, 'choice_resolved'],
    [3, 'choice_opened'],
  ]);
  assert.deepEqual(opens(d).choice_ids, ['a', 'z']);
  assert.deepEqual(left.ids(), ['z']);

  const last = play(content({ a: once('flag') }));
  last.opened();
  const done = last.choose('a');
  assert.deepEqual(ops(done).includes('choice.open'), false);
  assert.equal(last.view(), undefined);
});

// Breaks: then ignored; the child row carrying the parent's source or beat; events out of order.
test('then opens the named dialogue in the same delta, resolved before opened', () => {
  const g = play(content({ ask: plain({ then: 'child' }) }, { child: { x: plain(), y: plain() } }));
  const first = g.opened();
  const d = g.choose('ask');
  assert.deepEqual(events(d), [
    [1, 'choice_resolved'],
    [2, 'choice_opened'],
  ]);
  assert.deepEqual(ops(d), ['choice.resolve', 'choice.open']);
  const open = opens(d);
  assert.deepEqual([open.beat, open.source.key, open.choice_ids], ['child', 'child', ['x', 'y']]);
  assert.notEqual(g.view().continuation_id, first);
  assert.deepEqual(g.ids(), ['x', 'y']);
});

// Breaks: a then target offered by talk, reopening itself, or then: end read as a dialogue key.
test('a then target is not talked to and never reopens itself; then: end ends the talk', () => {
  const g = play(
    content(
      { ask: plain({ then: 'aardvark' }), bye: plain({ then: 'end' }) },
      {
        aardvark: { x: plain(), y: plain() },
      },
    ),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['ask', 'bye']);
  g.choose('ask');
  assert.deepEqual(g.ids(), ['x', 'y']);
  const x = g.choose('x');
  assert.equal(ops(x).includes('choice.open'), false);
  assert.equal(g.view(), undefined);
  g.opened();
  const bye = g.choose('bye');
  assert.deepEqual(ops(bye), ['choice.resolve']);
  assert.equal(g.view(), undefined);

  const only = play(
    content({ ask: plain({ then: 'child' }) }, { child: { x: plain() } }, (c) => {
      c.dialogues[`${P}:dialogue/guard`].policy = is('flag', true);
    }),
  );
  assert.deepEqual(only.talk(), { kind: 'rejected', error: { code: 'invalid_state' } });
});

// Breaks: a looped pair leaves no way in, a later key of the cycle entered, or the walk back
// from the child reopening at the wrong dialogue.
test('a then cycle enters at its first key and its members hand on to each other', () => {
  const g = play(
    content({ out: plain({ then: 'zzz' }) }, { zzz: { ret: plain({ then: 'guard' }) } }),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['out']);
  g.choose('out');
  assert.deepEqual(g.ids(), ['ret']);
  g.choose('ret');
  assert.deepEqual(g.ids(), ['out']);
  // alpha sorts first but a source (zeta) leads into its cycle: the source is the way in.
  const s = play(
    content(
      { into: plain({ then: 'alpha' }) },
      { alpha: { a: plain({ then: 'beta' }) }, beta: { b: plain({ then: 'alpha' }) } },
      (c) => {
        c.dialogues[`${P}:dialogue/zeta`] = c.dialogues[`${P}:dialogue/guard`];
        c.dialogues[`${P}:dialogue/zeta`].key = 'zeta';
        delete c.dialogues[`${P}:dialogue/guard`];
      },
    ),
  );
  s.opened();
  assert.deepEqual(s.ids(), ['into']);
});

// Breaks: the child's only option hidden still opens an empty conversation.
test('a then whose target shows nothing ends the talk', () => {
  const g = play(
    content(
      { ask: plain({ then: 'child' }) },
      { child: { x: plain({ policy: is('flag', true) }) } },
    ),
  );
  g.opened();
  assert.equal(ops(g.choose('ask')).includes('choice.open'), false);
  assert.equal(g.view(), undefined);
});

// Breaks: the target's own policy unread: a row every option of which is refused as invalid_state.
test('a then whose target policy fails ends the talk', () => {
  const g = play(
    content(
      { ask: plain({ then: 'child' }) },
      { child: { x: plain() } },
      (c) => (c.dialogues[`${P}:dialogue/child`].policy = is('flag', true)),
    ),
  );
  g.opened();
  assert.equal(ops(g.choose('ask')).includes('choice.open'), false);
  assert.equal(g.view(), undefined);
});

// Breaks: the target read before the answer's facts: a then target opening on what the answer set.
test('then reads the target against the answer facts', () => {
  const g = play(
    content(
      { ask: plain({ then: 'child', steps: [set('flag')] }) },
      { child: { x: plain({ policy: is('flag', true) }) } },
    ),
  );
  g.opened();
  g.choose('ask');
  assert.deepEqual(g.ids(), ['x']);
});

const checked = (extra: object) => ({
  ...plain(),
  check: {
    key: 'talk_round',
    kind: 'opposed',
    attribute: ref('attribute', 'cha'),
    npc: ref('npc', 'guard'),
    failure: FAILED,
  },
  ...extra,
});
const guardAt = (cha: number) => (c: any) => {
  c.npcs[`${P}:npc/guard`].attributes[0].value = cha;
};
const branches = { won: { w: plain() }, lost: { l: plain() } };

// Breaks: a checked choice's then ignored on a pass (the old refusal or the close path).
test('a passed check with then leads to the then target', () => {
  const g = play(
    content({ c: checked({ then: 'won', then_failed: 'lost' }) }, branches, guardAt(5)),
  );
  g.opened();
  const d = g.choose('c');
  assert.deepEqual(events(d), [
    [1, 'check_passed'],
    [2, 'choice_resolved'],
    [3, 'choice_opened'],
  ]);
  assert.deepEqual(g.ids(), ['w']);
});

// Breaks: a failed check drops then_failed, or takes the pass's then, or loses the failure line.
test('a failed check keeps its line and leads to then_failed; without it the talk ends', () => {
  const g = play(
    content({ c: checked({ then: 'won', then_failed: 'lost' }) }, branches, guardAt(7)),
  );
  g.opened();
  const d = g.choose('c');
  assert.equal(d.outcome, 'check_failed');
  assert.deepEqual(events(d).at(-1), [2, 'choice_opened']);
  assert.deepEqual(ops(d), ['choice.close', 'choice.open']);
  assert.equal(d.narration[0].key, FAILED);
  assert.deepEqual(g.ids(), ['l']);

  const bare = play(content({ c: checked({ then: 'won' }) }, branches, guardAt(7)));
  bare.opened();
  assert.deepEqual(ops(bare.choose('c')), ['choice.close']);
  assert.equal(bare.view(), undefined);
});

const captain = (room: string) => (c: any) => {
  c.rooms[`${P}:room/far`] = { ...c.rooms[`${P}:room/gate_room`], key: 'far' };
  c.npcs[`${P}:npc/captain`] = {
    ...c.npcs[`${P}:npc/guard`],
    key: 'captain',
    room: ref('room', room),
  };
  const talkTo = c.dialogues[`${P}:dialogue/captain_talk`];
  talkTo.npc = ref('npc', 'captain');
  talkTo.roles = { captain: { role: 'npc', npc: ref('npc', 'captain') } };
};
const handOff = (room: string) =>
  play(
    content(
      { ask: plain({ then: 'captain_talk' }) },
      { captain_talk: { x: plain() } },
      captain(room),
    ),
  );

// Breaks: the new row bound to the old speaker: the hand-off speaks with the wrong person.
test('then hands the talk to another speaker, bound on the new row', () => {
  const g = handOff('gate_room');
  g.opened();
  const open = opens(g.choose('ask'));
  const w = g.world();
  assert.deepEqual(open.roles, [{ role: 'captain', entity_id: w.entityIds[`${P}:npc/captain`] }]);
  assert.equal(g.choose('x').kind, 'accepted');
});

// Breaks: a hand-off to a speaker elsewhere leaving a dead card: the farewell ends it.
test('a hand-off to a speaker elsewhere ends the talk after the reply', () => {
  const g = handOff('far');
  g.opened();
  // Farewell closes the row in the same proposal, in the writer group that opened it.
  assert.deepEqual(ops(g.choose('ask')).slice(-2), ['choice.open', 'choice.close']);
  assert.equal(g.view(), undefined);
});

// Breaks: a narrate step refused or dropped; its line before the choice's reply.
test('a narrate step adds its line after the reply', () => {
  const g = play(content({ a: plain({ steps: [{ op: 'narrate', text: FAILED }] }) }));
  g.opened();
  const d = g.choose('a');
  assert.deepEqual(
    d.narration.map((n: any) => n.key),
    [SAID, FAILED],
  );
});

// Breaks: at_least compared with > or with the default ignored.
test('fact_at_least holds at the threshold and not one below', () => {
  const at = (at_least: number) => ({
    policy: { op: 'fact_at_least', fact: ref('fact', 'score'), at_least },
  });
  const g = play(
    content({ two: plain(at(2)), three: plain(at(3)) }, {}, (c) => {
      c.facts[`${P}:fact/score`] = {
        ...c.facts[`${P}:fact/gate_open`],
        key: 'score',
        value_type: { type: 'int', default: 2 },
      };
    }),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['two']);
});

// Breaks: a variant's when read wrongly, the last holding variant winning, or no fallback.
test('the first narration variant that holds is the reply; else the narration', () => {
  const variants = (flag: boolean) =>
    play(
      content({
        a: plain({
          narration_variants: [
            { when: is('other', true), description: 'never' },
            { when: is('flag', flag), description: FAILED },
            { when: is('flag', flag), description: LABEL },
          ],
        }),
      }),
    );
  const first = variants(false);
  first.opened();
  assert.deepEqual(
    first.choose('a').narration.map((n: any) => n.key),
    [FAILED],
  );
  const none = variants(true);
  none.opened();
  assert.deepEqual(
    none.choose('a').narration.map((n: any) => n.key),
    [SAID],
  );
});
