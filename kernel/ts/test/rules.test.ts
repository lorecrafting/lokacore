import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pickKind, start } from '../play/card.ts';
import { offered } from '../play/rules.ts';

const defs = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../schemas/source/defs.schema.json'), 'utf8'),
).$defs;
const step = (op: string) =>
  defs.Step.anyOf.findIndex(
    (b: { properties: { op: { const: string } } }) => b.properties.op.const === op,
  );

// Break: a switch drops a field both branches declare alike but describe differently (npc.move's
// `room` into item.move's; docs/system/cartridge.md keeps it).
test('a step switch keeps a field whose schema differs only in its description', () => {
  const moved = start(defs.Step.anyOf, step('item.move'), {
    op: 'npc.move',
    npc: 'ada',
    room: 'cellar',
  });
  assert.deepEqual(moved, { op: 'item.move', room: 'cellar' });
});

// Break: a trigger's filter picks from no kind (an empty list), so no real id can be chosen.
test("a trigger's filters pick the kind the compiler resolves them to", () => {
  assert.equal(pickKind(['on', 'victim']), 'npc');
  assert.equal(pickKind(['on', 'witness']), 'npc');
  assert.equal(pickKind(['on', 'kind']), 'liquid');
});

// Break: a reaction is offered an op it can never compile (`damage`), an action loses one it can,
// or a file whose steps the compiler does not gate (or a policy op) loses branches.
test('the steps picker offers only the ops its file compiles', () => {
  const at = (op: string) => defs.Step.anyOf[step(op)];
  assert.equal(offered(at('damage'), 'reactions'), false);
  assert.equal(offered(at('damage'), 'actions'), true);
  assert.equal(offered(at('meal'), 'dialogues'), false);
  assert.equal(offered(at('narrate'), 'dialogues'), true);
  assert.equal(offered(defs.Policy.anyOf[0], 'reactions'), true);
  assert.equal(offered(at('damage'), 'rooms'), true);
});
