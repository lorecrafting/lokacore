import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KERNEL_ID } from '../src/index.ts';

test('kernel loads under Node type stripping', () => {
  assert.equal(KERNEL_ID, 'loka-kernel');
});
