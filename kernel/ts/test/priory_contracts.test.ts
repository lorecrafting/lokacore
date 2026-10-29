import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { value } from '../src/mechanics/fact.ts';
import { chest, codex } from './codex_fixture.ts';

const { prefix, ref } = codex;
const ledger = `${prefix}:item/mill_ledger`;

// Break: malformed readable metadata or non-Boolean knowledge is accepted.
// Topic and readable reference checks are the compiler's (content_priory_test.exs, content_refusals_test.exs).
test('item writing, topic refs, text and unique player Boolean mappings fail closed', () => {
  assert.ok(codex.load().ok);
  for (const mutate of [
    (c: any) =>
      (c.facts[`${prefix}:fact/topic_mill_known`].value_type = {
        type: 'int',
        minimum: 0,
        maximum: 1,
        default: 0,
      }),
    (c: any) => (c.manifest.requires.kernel_api.at_least = '1.23'),
  ])
    assert.equal(codex.load(mutate).ok, false, String(mutate));
  for (const invalid of [
    null,
    [],
    {},
    { label: 'actions.read_book' },
    { text: 'readable.page' },
    { label: '', text: 'readable.page' },
    { label: 'actions.read_book', text: '' },
    { label: 'actions.read_book', text: 'readable.page', extra: true },
    { label: 'actions.read_book', text: 'readable.page', topic: null },
    { label: 'Actions.read_book', text: 'readable.page' },
    { label: 'actions.read_book', text: 'Readable.page' },
    { label: 123, text: 'readable.page' },
    { label: 'actions.read_book', text: 123 },
  ])
    assert.ok(validate('ItemReadable', invalid).length, JSON.stringify(invalid));
});

// Break: a loaded Read alias loses its command/target binding or rejects an open held child.
test('loaded consult alias projects the Read command and resolves the exact nested book invocation', () => {
  const base = codex.genesis((c) => {
    c.actions[`${prefix}:action/consult`] = {
      key: 'consult',
      command: 'read',
      label: 'actions.read_book',
      accessibility: 'actions.read_book',
      target: { kind: 'entity', scopes: ['inventory'] },
      input: [],
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
      priority: 1,
    };
    chest()(c);
    c.items[ledger].location = { in: 'item', item: ref('item', 'chest') };
  });
  const box = base.entityIds[`${prefix}:item/chest`],
    book = base.entityIds[ledger];
  const w = {
    ...base,
    state: { ...base.state, containers: { ...base.state.containers, [box]: base.body } },
  };
  const offer = gameView(w)
    .inventory.find((e) => e.id === box)!
    .contents!.find((e) => e.id === book)!
    .actions.find((a) => a.action_key === 'consult');
  assert.ok(offer?.available);
  assert.equal(offer.command, 'read');
  assert.deepEqual(offer.target_ids, [book]);
  const id = identify('alias', w.character, {
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key: 'consult',
    target_ids: offer.target_ids,
    input: {},
  });
  assert.equal(id.kind, 'identified');
  if (id.kind !== 'identified') return;
  const command = resolve(w, id);
  assert.deepEqual((command as any).payload, {
    type: 'read',
    actor_id: w.character,
    target_id: book,
  });
  const d = step(w, command as never, 1, 'consult' as never).decision;
  assert.equal(d.kind, 'accepted');
  if (d.kind === 'accepted') assert.deepEqual(d.narration, [{ key: 'readable.mill_ledger' }]);
});

let n = 0;
const act = (w: World, payload: object) => {
  n += 1;
  const id = `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
};
const walk = (w: World, ...dirs: string[]) =>
  dirs.reduce((at, direction) => act(at, { type: 'move', direction }).world, w);
const readBook = (w: World, k: string) => {
  const id = w.entityIds[`${prefix}:item/${k}`];
  return act(act(w, { type: 'take', item_id: id }).world, { type: 'read', target_id: id });
};
const knows = (w: World, topic: string) =>
  value(w, w.character, ref('fact', `topic_${topic}_known`));

// Break (topics/shared.ts grant): Read of a topic already known, by an earlier Read or by a
// recipe grant, assigns its fact again instead of leaving the world unchanged.
test('reading a book whose topic is already known writes nothing, after a Read or a recipe grant', () => {
  const noted = readBook(walk(codex.genesis(), 'south'), 'carters_note');
  assert.equal(knows(noted.world, 'missing_cart'), true);
  const note = noted.world.entityIds[`${prefix}:item/carters_note`];
  const reread = act(noted.world, { type: 'read', target_id: note }).decision;
  assert.equal(reread.kind, 'accepted');
  if (reread.kind === 'accepted') assert.deepEqual(reread.delta.ops, []);
  const study = walk(noted.world, 'north', 'west');
  const desk = Object.keys(study.details).find((id) => study.details[id].key === 'desk');
  const tracked = act(study, { type: 'perform', action: 'follow_tracks', target_id: desk }).world;
  assert.equal(knows(tracked, 'mill'), true);
  const ledgerRead = readBook(tracked, 'mill_ledger').decision;
  assert.equal(ledgerRead.kind, 'accepted');
  if (ledgerRead.kind === 'accepted') {
    assert.deepEqual(ledgerRead.narration, [{ key: 'readable.mill_ledger' }]);
    assert.deepEqual(ledgerRead.delta.ops, []);
  }
});
