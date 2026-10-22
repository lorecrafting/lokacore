import assert from 'node:assert/strict';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../../kernel/ts/src/index.ts';
import { bundleOf, trainingBundle } from '../../../../kernel/ts/test/training_fixture.ts';

/** The training sampler after `change`, with the teacher's entity id in a fresh world. */
export function trainingPin(change: (c: any) => void) {
  const c = JSON.parse(trainingBundle().canonical);
  change(c);
  const at = (kind: string, key: string) => `${c.manifest.id}@${c.manifest.version}:${kind}/${key}`;
  const pin = bundleOf(c);
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const teacher = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  ).entityIds[at('npc', 'teacher')];
  return { pin, teacher };
}
