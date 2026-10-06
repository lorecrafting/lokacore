import assert from 'node:assert/strict';
import { test } from 'node:test';
import { read } from './read.ts';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';

const fixture = read('protocol/fixtures/liquid_contracts.json');

// Breaks: liquid wire contracts lose required fields, numeric bounds, closed shapes or discriminators.
test('liquid wire boundaries match independent literal errors and valid controls', () => {
  for (const c of fixture.cases) {
    const base = fixture.bases[c.base];
    const value = Object.hasOwn(c, 'replace') ? c.replace : { ...base.value, ...c.set };
    if (c.omit) delete value[c.omit];
    assert.deepEqual(validate(base.contract, value), c.errors, c.name);
    if (base.variant) {
      const { field, value: discriminator } = base.variant;
      const schema = (DEFS[base.contract as keyof typeof DEFS] as any).oneOf.find(
        (branch: any) => branch.properties[field]?.const === discriminator,
      );
      assert.ok(schema, c.name);
      // Check the actual branch as well: the union itself also requires its discriminator.
      const defs = { ...DEFS, LiquidVariant: schema } as Defs;
      assert.deepEqual(
        validate('LiquidVariant', value, defs),
        c.variant_errors ?? c.errors,
        c.name,
      );
    }
  }
});
