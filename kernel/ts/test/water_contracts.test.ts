import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { read } from './read.ts';
const fixture = read('protocol/fixtures/water_contracts.json');
// Breaks: typed water state loses required actor/body/generation/deadline fields or accepts malformed corpse selectors.
test('water contracts reject malformed bindings, bounds and closed corpse selection', () => {
  for (const c of fixture.cases) {
    const b = fixture.bases[c.base],
      v = structuredClone(b.value_fixture ? read(b.value_fixture).value : b.value);
    let at = v;
    if (c.path) {
      for (const field of c.path.slice(0, -1)) at = at[field];
      const last = c.path.at(-1);
      if (c.omit) delete at[last];
      else at[last] = c.value;
    }
    assert.equal(validate(b.contract, v).length === 0, c.valid, c.name);
    if (b.variant) {
      const schema = (DEFS[b.contract as keyof typeof DEFS] as any).oneOf.find(
        (s: any) => s.properties[b.variant.field]?.const === b.variant.value,
      );
      const defs = { ...DEFS, WaterVariant: schema } as Defs;
      assert.equal(validate('WaterVariant', v, defs).length === 0, c.valid, c.name);
    }
  }
});
