import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, INSTALLED, newWorld, gameView, step } from '../src/index.ts';
import { encode, hash } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { key } from '../src/foundation/compose.ts';
import { bundle, ref, ids, fresh } from './priory_fixture.ts';

// Break: malformed readable metadata or undeclared, wrong-kind, non-Boolean/shared knowledge is accepted.
test('item writing, topic refs, text and unique player Boolean mappings fail closed', () => {
  for (const mutate of [
    (c: any) => {
      c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].readable.topic = ref(
        'topic',
        'missing',
      );
    },
    (c: any) => {
      c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].readable.topic = ref(
        'fact',
        'topic_ward_known',
      );
    },
    (c: any) => {
      c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].readable.text = 'missing';
    },
    (c: any) => {
      c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].readable.label = 'missing';
    },
    (c: any) => {
      delete c.items['ashmere_missing_child@0.0.27:item/ward_of_the_fen'].mass_grams;
    },
    (c: any) => {
      c.facts['ashmere_missing_child@0.0.27:fact/topic_bell_known'].scopes = ['instance'];
    },
    (c: any) => {
      c.facts['ashmere_missing_child@0.0.27:fact/topic_bell_known'].value_type = {
        type: 'int',
        minimum: 0,
        maximum: 1,
        default: 0,
      };
    },
    (c: any) => {
      c.topics['ashmere_missing_child@0.0.27:topic/bell'].fact = ref('fact', 'topic_ward_known');
    },
    (c: any) => {
      c.manifest.requires.kernel_api.at_least = '1.23';
    },
    (c: any) => {
      delete c.manifest.requires.capabilities.readable;
      delete c.lock.capabilities.readable;
    },
  ]) {
    const c = structuredClone(bundle.value);
    mutate(c);
    const result = loadCartridge(
      new TextEncoder().encode(encode({ cartridge: c, content_hash: hash(c) })),
      INSTALLED,
    );
    assert.equal(result.ok, false);
  }
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
  const c = structuredClone(bundle.value);
  c.actions['ashmere_missing_child@0.0.27:action/consult'] = {
    key: 'consult',
    command: 'read',
    label: 'actions.read_book',
    accessibility: 'actions.read_book',
    target: { kind: 'entity', scopes: ['inventory'] },
    input: [],
    policy: { policy_version: 1, root: { op: 'all', items: [] } },
    priority: 1,
  };
  const loaded = loadCartridge(
    new TextEncoder().encode(encode({ cartridge: c, content_hash: hash(c) })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const base = newWorld(loaded.cartridge as never, fresh().context, [1, 2, 3, 4]),
    box = ids['item/storage_chest'],
    book = ids['item/ward_of_the_fen'];
  const entity = base.entities[box];
  assert.equal(entity.kind, 'item');
  if (entity.kind !== 'item') return;
  const w = {
    ...base,
    state: {
      ...base.state,
      containers: { ...base.state.containers, [box]: base.body, [book]: box },
      barriers: { [key({ kind: 'barrier', barrier: entity.barrier! })]: 'open' },
    },
  } as any;
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
  if (d.kind === 'accepted') assert.deepEqual(d.narration, [{ key: 'readable.ward_of_the_fen' }]);
});
