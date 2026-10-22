// Deer fixture: the frozen shoo_sampler KAT (three sight populations and one scavenging crow).
import assert from 'node:assert/strict';
import { newWorld, type Cartridge } from '../src/index.ts';
import { fragment } from './fragment.ts';

export const shoo = fragment('protocol/fixtures/shoo_sampler_hash.json');
export const bundle = shoo.bundle();
const loaded = shoo.load();
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;
export const fresh = (seed: readonly number[] = [1, 2, 3, 4]) =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
export const ref = (kind: string, name: string) => `${shoo.prefix}:${kind}/${name}`;
