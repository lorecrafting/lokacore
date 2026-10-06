import assert from 'node:assert/strict';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import { read } from './read.ts';
export const bundle = read('protocol/fixtures/missing_child_v027_hash.json');
export const ids = read('protocol/fixtures/missing_child_v027_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const cartridge = loaded.cartridge as Cartridge;
export const fresh = () =>
  newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
export const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_missing_child', cartridge_version: '0.0.27', kind, key }) as any;
