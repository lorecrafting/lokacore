// The typed contract controls shared with Elixir (bell_contracts_test.exs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

// Breaks: generated TS contracts disagree with Elixir about the typed forms.
test('bell contract controls match the shared fixtures', () => {
  for (const c of read('protocol/fixtures/bell_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});
