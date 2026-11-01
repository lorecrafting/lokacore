// size: allow 750, every branching rule's pins beside the one play harness
// loka-vduxr.10 on the compiled persuade sampler: per-choice conditions, links between dialogues,
// a check's two ways on, the hand-off, narrate steps, int fact thresholds and narration variants.
import { decide } from '../src/mechanics/dialogue/rule.ts';
import { allocator } from '../src/runtime/decision.ts';
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
import { validate } from '../src/foundation/validate.ts';
import { hydrate } from '../src/runtime/created.ts';
import { spokenBy } from '../src/mechanics/dialogue/selection.ts';
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
  const canonical = encode(c as Parameters<typeof encode>[0]);
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
    const r = step(w, command as unknown as Parameters<typeof step>[1], n);
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
  // a reload holds only what the save holds: the state, as JSON
  const reload = () => {
    w = hydrate(w, JSON.parse(JSON.stringify(w.state)), true)!;
  };
  return { send, talk, opened, choose, ids, view, reload, world: () => w };
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

// Breaks: the hub opening an empty row when the answer spends every option; or a card with nothing
// shown (the world moved past an open row) drawn empty, which GameView forbids.
test('nothing left ends the talk, and a stale row still draws its options, each refused', () => {
  const once = (key: string) => plain({ policy: is(key, false), steps: [set(key)] });
  const g = play(content({ a: once('flag'), z: once('flag') }));
  g.opened();
  const before = g.world();
  const done = g.choose('a');
  assert.deepEqual(ops(done).includes('choice.open'), false);
  assert.equal(g.view(), undefined);

  const view = gameView({
    ...before,
    state: { ...before.state, facts: g.world().state.facts },
  } as World);
  assert.deepEqual(validate('GameView', view), []);
  assert.deepEqual(
    view.choice!.choices.map((o: any) => [o.choice_id, o.available, o.reason?.code]),
    [
      ['a', false, 'invalid_state'],
      ['z', false, 'invalid_state'],
    ],
  );
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
  only.opened(); // falls through the failed root to what it leads to
  assert.deepEqual(only.ids(), ['x']);
});

// Breaks: a looped pair leaves no way in, a later key of the cycle entered, or the walk back
// from the child reopening at the wrong dialogue.
test('a then cycle with a tie enters at its first key and its members hand on to each other', () => {
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

// Breaks: a hostile speaker drawn into talk a talk to them would refuse (row G11).
test('a hand-off to a hostile speaker ends the talk after the reply', () => {
  const g = play(
    content({ ask: plain({ then: 'captain_talk' }) }, { captain_talk: { x: plain() } }, (c) => {
      captain('gate_room')(c);
      c.npcs[`${P}:npc/captain`].disposition = {
        hostile: { op: 'all', items: [] },
        engage: 'npc.guard.short',
      };
    }),
  );
  g.opened();
  assert.deepEqual(ops(g.choose('ask')).includes('choice.open'), false);
  assert.equal(g.view(), undefined);
});

// Breaks: a narrate step refused or dropped; its line before the reply; two lines reversed.
test('a narrate step adds its line after the reply', () => {
  const steps = [
    { op: 'narrate', text: FAILED },
    { op: 'narrate', text: LABEL },
  ];
  const g = play(content({ a: plain({ steps }) }));
  g.opened();
  const d = g.choose('a');
  assert.deepEqual(
    d.narration.map((n: any) => n.key),
    [SAID, FAILED, LABEL],
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

// The sampler with a token the guard holds, given by `take` and leading to `next`.
const token = { role: 'item', item: ref('item', 'token') };
const hasToken = { op: 'has_item', item: ref('item', 'token') };
const gives = (next: object) =>
  content(
    { take: plain({ receive: { item: 'token', from: 'guard' }, then: 'next' }) },
    { next },
    (c: any) => {
      const persuade = c.dialogues[`${P}:dialogue/guard`];
      c.items = {
        [`${P}:item/token`]: {
          key: 'token',
          keywords: ['token'],
          name: LABEL,
          room_line: LABEL,
          description: LABEL,
          location: { in: 'npc', npc: ref('npc', 'guard') },
        },
      };
      persuade.roles.token = token;
    },
  );

// Breaks: a then read against the facts alone, not the world the decision leaves, so the item just
// received is missing: the follow-up silently ends, or its refusing option draws an all-refused
// card. Also: choice_opened placed anywhere but right after the answer's last event.
test('a then reads the item its own answer just moved', () => {
  const g = play(gives({ n: plain({ policy: hasToken }) }));
  g.opened();
  const w = g.world();
  const command = {
    id: 'ffffffff-9999-4999-8999-00000000aaaa',
    world_context_id: w.context,
    payload: {
      type: 'choose',
      actor_id: w.character,
      continuation_id: g.view().continuation_id,
      choice_id: 'take',
    },
  } as unknown as Parameters<typeof decide>[1];
  // The rule's own positions: composition renumbers them (proposal.ts), so step alone cannot see them.
  const d = decide(w, command, allocator(w, command));
  g.choose('take');
  assert.deepEqual(g.ids(), ['n']);
  assert.deepEqual(events(d), [
    [1, 'item_acquired'],
    [2, 'choice_resolved'],
    [3, 'choice_opened'],
  ]);
  const not = play(gives({ n: plain({ policy: { op: 'not', item: hasToken } }) }));
  not.opened();
  not.choose('take');
  assert.equal(not.view(), undefined);
});

// Breaks: then_failed read against the pre-decision world, so the skill the failed check just
// practised is missing and the follow-up silently ends.
test('a then_failed reads the practice its own failure just gave', () => {
  const skill = ref('skill', 'intimidate');
  const practised = { op: 'skill_compare', skill, at_least: 1 };
  const talk = (policy: object) =>
    play(
      content(
        {
          c: {
            ...plain(),
            check: { key: 'intimidate_guard', kind: 'opposed', skill, rating: 99, failure: FAILED },
            then_failed: 'lost',
          },
        },
        { lost: { l: plain({ policy }) } },
      ),
    );
  const g = talk(practised);
  g.opened();
  g.choose('c');
  assert.deepEqual(g.ids(), ['l']);
  const not = talk({ op: 'not', item: practised });
  not.opened();
  not.choose('c');
  assert.equal(not.view(), undefined);
});

// Breaks: Talk opens a loop at its first key by sort, so the leaf sorted before the hub opens and
// the hub never plays.
test('Talk opens a loop with no way in at its member leading to the most dialogues', () => {
  const g = play(
    content(
      { to_leaf: plain({ then: 'a_leaf' }), to_detail: plain({ then: 'detail' }) },
      { a_leaf: { bye: plain({ then: 'end' }) }, detail: { back: plain({ then: 'guard' }) } },
    ),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['to_detail', 'to_leaf']);
});

// Each row breaks one part of the rule: `end` or a repeated target counted as a link, a tie going
// to the last key, or a wider loop downstream of the entry offered as a second entry.
test('Talk picks one member of a loop by distinct links, then key', () => {
  const to = (...keys: string[]) =>
    Object.fromEntries(keys.map((k, i) => [`c${i}_${k}`, plain({ then: k })]));
  const rows: [string, object, Record<string, object>, string[]][] = [
    ['end is no link', to('z_other'), { z_other: to('end', 'guard') }, ['c0_z_other']],
    ['a repeat is no link', to('z_other'), { z_other: to('guard', 'guard') }, ['c0_z_other']],
    [
      'a link to itself is no link',
      to('a_x', 'z_y'),
      { a_x: to('a_x', 'guard'), z_y: to('end') },
      ['c0_a_x', 'c1_z_y'],
    ],
    ['a tie goes to the first key', to('a_other'), { a_other: to('guard') }, ['c0_guard']],
    [
      'a loop downstream is no entry',
      to('a_up', 'b_low'),
      {
        a_up: to('guard'),
        b_low: to('c_x', 'd_x', 'e_x'),
        c_x: to('b_low'),
        d_x: to('end'),
        e_x: to('end'),
      },
      ['c0_a_up', 'c1_b_low'],
    ],
  ];
  for (const [name, choices, more, opens] of rows) {
    const g = play(content(choices, more));
    g.opened();
    assert.deepEqual(g.ids(), opens, name);
  }
});

// Breaks: the marker only beats inference for its own speaker's chain: another speaker's root leading
// to the marked hub hides it, so Talk to that speaker finds nothing.
test('entry: true opens a hub another speaker leads to', () => {
  const g = play(
    content({ on: plain() }, { z_intro: { go: plain({ then: 'guard' }) } }, (c) => {
      c.dialogues[`${P}:dialogue/guard`].entry = true;
      c.dialogues[`${P}:dialogue/z_intro`].npc = ref('npc', 'other');
      c.npcs[`${P}:npc/other`] = { ...structuredClone(c.npcs[`${P}:npc/guard`]), key: 'other' };
    }),
  );
  g.opened();
  assert.deepEqual(g.ids(), ['on']);
});

// Breaks: a failed intro refuses Talk for good, the offer or the rule stops at it, the walk leaves the
// speaker or ignores link order, a keyword failure falls through, a failed marker gives up, or failed
// dialogues that lead to each other never finish.
test('Talk falls through a failed entry to what it leads to, in link order', () => {
  const met = is('flag', false);
  const intro = { go: plain({ then: 'hub', steps: [set('flag')] }) };
  const hub = { ask: plain({ then: 'hub' }), bye: plain({ then: 'end' }) };
  const shape = (extra: object) =>
    content(intro, { hub }, (c) =>
      Object.assign(c.dialogues[`${P}:dialogue/guard`], { policy: met, ...extra }),
    );
  for (const extra of [{}, { entry: true }]) {
    const g = play(shape(extra));
    g.opened();
    assert.deepEqual(g.ids(), ['go']);
    assert.equal(g.choose('go').kind, 'accepted');
    assert.deepEqual(g.ids(), ['ask', 'bye']);
    g.choose('bye');
    g.reload();
    const npc = gameView(g.world()).entities!.find(
      (e) => e.id === g.world().entityIds[`${P}:npc/guard`],
    );
    assert.equal(npc!.actions!.find((a: any) => a.action_key === 'guard')?.available, true);
    g.opened();
    assert.deepEqual(g.ids(), ['ask', 'bye']);
  }
  const closed = { policy: is('flag', true) };
  const links = { x: plain({ then: 'z_b' }), y: plain({ then: 'a_c' }) };
  const nowhere = play(
    content(intro, { hub: { ask: { ...plain(), policy: is('flag', true) } } }, (c) =>
      Object.assign(c.dialogues[`${P}:dialogue/guard`], closed),
    ),
  );
  assert.equal(nowhere.talk().kind, 'rejected');
  const circle = play(
    content(
      links,
      { z_b: { b: plain({ then: 'guard' }) }, a_c: { c: plain({ then: 'guard' }) } },
      (c) => {
        for (const k of ['guard', 'z_b', 'a_c'])
          Object.assign(c.dialogues[`${P}:dialogue/${k}`], closed);
      },
    ),
  );
  assert.equal(circle.talk().kind, 'rejected');
});

// Breaks: the marker loses to the first key or to a dialogue nothing leads to, or a failed marker
// falls back to the speaker's other dialogue.
test('entry: true opens the marked dialogue over inference and refuses when nothing opens', () => {
  const mark = (edit: object) => (c: any) =>
    Object.assign(c.dialogues[`${P}:dialogue/guard`], edit);
  const back = { to: plain({ then: 'guard' }) };
  const hub = content({ on: plain({ then: 'a_x' }) }, { a_x: back }, mark({ entry: true }));
  const tie = play(hub);
  tie.opened();
  assert.deepEqual(tie.ids(), ['on']);
  const leaf = { a_leaf: { bye: plain() }, a_x: back };
  const over = play(content({ on: plain({ then: 'a_x' }) }, leaf, mark({ entry: true })));
  over.opened();
  assert.deepEqual(over.ids(), ['on']);
  const shut = mark({ entry: true, policy: is('flag', true) });
  assert.equal(
    play(content({ on: plain() }, { a_leaf: { bye: plain() } }, shut)).talk().kind,
    'rejected',
  );
});

// Breaks: a fall-through passes a check, a payment or a failed choice policy for free, follows
// then_failed or another speaker's link, or the compile warning and Talk disagree (the same file
// runs through content_dialogue_links_test.exs).
test('a failed default Talk opens only what a free choice leads to: the shared cases', () => {
  const file = new URL('../../../test/fixtures/dialogue_entry_cases.json', import.meta.url);
  const gates: Record<string, object> = {
    check: checked({}),
    payment: { payment: { from: 'guard', resource: ref('resource', 'pennies'), amount: 1 } },
    policy: { policy: is('flag', true) },
  };
  for (const { name, dialogues, opens } of JSON.parse(readFileSync(file, 'utf8'))) {
    const g = play(
      content({}, {}, (c) => {
        const model = c.dialogues[`${P}:dialogue/guard`];
        delete c.dialogues[`${P}:dialogue/guard`];
        c.npcs[`${P}:npc/other`] = { ...structuredClone(c.npcs[`${P}:npc/guard`]), key: 'other' };
        for (const { key, npc, choices, entry, closed } of dialogues) {
          const made = Object.entries<any>(choices).map(([id, { gate, ...rest }]) => [
            id,
            { ...plain(), ...gates[gate], ...rest },
          ]);
          c.dialogues[`${P}:dialogue/${key}`] = {
            ...structuredClone(model),
            key,
            npc: ref('npc', npc),
            choices: Object.fromEntries(made),
            ...(entry && { entry }),
            ...(closed && { policy: is('flag', true) }),
          };
        }
      }),
    );
    const guard = g.world().entityIds[`${P}:npc/guard`]!;
    const offers = gameView(g.world()).entities!.find((e) => e.id === guard)!.actions ?? [];
    assert.equal(
      offers.some((a: any) => a.available),
      opens !== null,
      name,
    );
    assert.equal(g.talk().kind, opens === null ? 'rejected' : 'accepted', name);
    assert.equal(spokenBy(g.world(), g.world().character, guard)?.key, opens ?? undefined, name);
  }
});

// Breaks: a keyword dialogue falls through on the word, or a Talk that selects one dialogue goes
// elsewhere when that dialogue fails.
test('a say and a named Talk do not fall through', () => {
  const shut = (extra: object) =>
    play(
      content({ go: plain({ then: 'hub' }) }, { hub: { ask: plain() } }, (c) =>
        Object.assign(c.dialogues[`${P}:dialogue/guard`], { policy: is('flag', true) }, extra),
      ),
    );
  const said = shut({ keyword: 'w' });
  const guard = said.world().entityIds[`${P}:npc/guard`];
  assert.equal(
    spokenBy(said.world(), said.world().character, guard, { n: 0 }, undefined, 'w'),
    undefined,
  );
  const named = shut({ name: LABEL });
  const offer = gameView(named.world())
    .entities!.find((e) => e.id === guard)!
    .actions!.find((a: any) => a.action_key === 'guard');
  assert.equal(offer?.available, false);
  assert.equal(
    named.send({ type: 'talk', target_id: guard, dialogue: ref('dialogue', 'guard') }).kind,
    'rejected',
  );
});
