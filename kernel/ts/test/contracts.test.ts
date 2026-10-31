// Every case of every protocol/fixtures/*_contracts.json fixture runs here against the portable
// validator: a literal error list, or valid/invalid, for the value and for its oneOf branch.
// Bespoke tests follow, one block per former file.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { compose } from '../src/foundation/compose.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { f } from './light_fixture.ts';
import { read } from './read.ts';

const DIR = 'protocol/fixtures';
// container_contracts.json names no contract; cartridge_items.test.ts validates it as ItemDefinition.
const files = readdirSync(new URL(`../../../${DIR}`, import.meta.url)).filter(
  (name) => name.endsWith('_contracts.json') && name !== 'container_contracts.json',
);
const VARIANT = 'TestVariant';
assert.ok(!(VARIANT in DEFS));

// A base value edited by the case: `replace` swaps it, `path` sets or omits one nested field
// (an empty path swaps the whole value), otherwise `set` merges and `omit` names a top field.
function build(b: any, c: any) {
  if (Object.hasOwn(c, 'replace')) return c.replace;
  let v = structuredClone(b.value_fixture ? read(b.value_fixture).value : b.value);
  if (c.path?.length) {
    let at = v;
    for (const k of c.path.slice(0, -1)) at = at[k];
    if (c.omit) delete at[c.path.at(-1)];
    else at[c.path.at(-1)] = c.value;
  } else if (c.path) v = c.value;
  else {
    Object.assign(v, c.set);
    if (c.omit) delete v[c.omit];
  }
  return v;
}

function runCase(fx: any, c: any, msg: string) {
  const b = c.base === undefined ? undefined : fx.bases[c.base];
  assert.ok(c.base === undefined || b, `${msg}: unknown base ${c.base}`);
  const value = b ? build(b, c) : c.value;
  const verdict = (errors: unknown[]) =>
    Object.hasOwn(c, 'errors') ? errors : errors.length === 0;
  assert.deepEqual(verdict(validate(b?.contract ?? c.contract, value)), c.errors ?? c.valid, msg);
  if (!b?.variant) return;
  const { field, value: tag } = b.variant;
  const branch = (DEFS[b.contract as keyof typeof DEFS] as any).oneOf.find(
    (s: any) => s.properties[field]?.const === tag,
  );
  assert.ok(branch, msg);
  // The branch itself as well: the union also requires its discriminator.
  const defs = { ...DEFS, [VARIANT]: branch } as Defs;
  assert.deepEqual(
    verdict(validate(VARIANT, value, defs)),
    c.variant_errors ?? c.errors ?? c.valid,
    msg,
  );
}

for (const file of files)
  test(`${file}: every case`, () => {
    const fx = read(`${DIR}/${file}`);
    const rows = Array.isArray(fx) ? fx : (fx.contracts ?? fx.cases);
    assert.ok(rows?.length, `${file} has no case table`);
    for (const c of rows) runCase(fx, c, `${file} ${c.id ?? c.name}`);
  });

// From wisp_contracts.
// Break: actor/source/quest/count preconditions of a bounded attempt weaken.
test('wisp attempts compose to their literal answers', () => {
  for (const c of read('protocol/fixtures/wisp_attempts.json'))
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.name);
});

// From status_composition.
{
  // Breaks: generic admission accepts an active status row, a transition or a condition view
  // missing one owned field, an inactive row carrying a live field, a condition kind outside
  // buff and debuff, or a condition duration of 0 or without its end (or an end without it).
  test('status rows, transitions and condition views require their complete shape', () => {
    const op = read('protocol/fixtures/status_composition.json').cases[0].ops[0];
    assert.deepEqual(validate('DeltaOp', op), []);
    // A permanent row (row W8) has no timing at all, or only its tick (loka-rn3b); an end needs a tick.
    assert.deepEqual(validate('StatusRow', { active: true, generation: 1 }), []);
    const { ends_at: _, ...ticking } = op.value;
    assert.deepEqual(validate('StatusRow', ticking), []);
    for (const field of ['generation', 'next_tick_at', 'job_id']) {
      const value = { ...op.value };
      delete value[field];
      // ends_at and the other tick field each require it (dependentRequired), so it is missed twice.
      const missing = { path: '/' + field, code: 'missing_property' };
      assert.deepEqual(
        validate('StatusRow', value),
        field === 'generation' ? [missing] : [missing, missing],
      );
    }
    for (const field of ['body_id', 'status', 'expected', 'value']) {
      const partial = { ...op };
      delete partial[field];
      assert.deepEqual(validate('DeltaOp', partial), [
        { path: '/' + field, code: 'missing_property' },
      ]);
    }
    assert.deepEqual(
      validate('StatusRow', { active: false, generation: 1, job_id: op.value.job_id }),
      [{ path: '/job_id', code: 'unknown_property' }],
    );
    const view = {
      label: 'condition.poisoned',
      ends_at: 400,
      duration: 300,
      next_tick_at: 160,
      resource: 'hp',
      per_tick: -1,
      tick_every: 60,
      kind: 'debuff',
    };
    assert.deepEqual(validate('ConditionView', view), []);
    assert.deepEqual(validate('ConditionView', { ...view, kind: 'buff' }), []);
    assert.deepEqual(validate('ConditionView', { ...view, kind: 'neutral' }), [
      { path: '/kind', code: 'not_in_enum' },
    ]);
    // per_tick is absent for a status that never ticks (row 2c), ends_at, duration and next_tick_at
    // for a permanent one (row W8); kind (loka-x6t.64) is optional. duration and ends_at come
    // together (loka-x6t.65).
    const { ends_at, duration, ...permanent } = view;
    assert.deepEqual(validate('ConditionView', permanent), []);
    assert.deepEqual(validate('ConditionView', { ...permanent, ends_at }), [
      { path: '/duration', code: 'missing_property' },
    ]);
    assert.deepEqual(validate('ConditionView', { ...permanent, duration }), [
      { path: '/ends_at', code: 'missing_property' },
    ]);
    const optional = ['per_tick', 'ends_at', 'duration', 'next_tick_at', 'kind'];
    for (const field of Object.keys(view).filter((f) => !optional.includes(f))) {
      const partial: Record<string, unknown> = { ...view };
      delete partial[field];
      assert.deepEqual(validate('ConditionView', partial), [
        { path: '/' + field, code: 'missing_property' },
      ]);
    }
    assert.deepEqual(validate('ConditionView', { ...view, tick_every: 0 }), [
      { path: '/tick_every', code: 'below_minimum' },
    ]);
    assert.deepEqual(validate('ConditionView', { ...view, duration: 1 }), []);
    assert.deepEqual(validate('ConditionView', { ...view, duration: 0 }), [
      { path: '/duration', code: 'below_minimum' },
    ]);
  });

  // Breaks: a compiled status definition missing one field, or with a zero duration or cadence,
  // loads (the compiler's own checks are not the contract).
  test('a status definition requires every field and positive times', () => {
    const def = {
      key: 'poison',
      duration: 300,
      tick_every: 60,
      resource: {
        cartridge_id: 'status_sampler',
        cartridge_version: '0.0.1',
        kind: 'resource',
        key: 'hp',
      },
      per_tick: -1,
      name: 'condition.poisoned',
      narration: {
        applied: 'narration.poison.applied',
        tick: 'narration.poison.tick',
        expired: 'narration.poison.expired',
      },
    };
    assert.deepEqual(validate('StatusDefinition', def), []);
    // per_tick may be omitted with modifies (row 2c); the compiler and loader require it otherwise.
    for (const field of Object.keys(def).filter((f) => f !== 'per_tick')) {
      const partial: Record<string, unknown> = { ...def };
      delete partial[field];
      assert.deepEqual(validate('StatusDefinition', partial), [
        { path: '/' + field, code: 'missing_property' },
      ]);
    }
    for (const field of ['duration', 'tick_every'])
      assert.deepEqual(validate('StatusDefinition', { ...def, [field]: 0 }), [
        { path: '/' + field, code: 'below_minimum' },
      ]);
    // Row W8: the one word a duration may be.
    assert.deepEqual(validate('StatusDefinition', { ...def, duration: 'permanent' }), []);
    assert.deepEqual(validate('StatusDefinition', { ...def, duration: 'forever' }), [
      { path: '/duration', code: 'const_mismatch' },
    ]);
  });
}
