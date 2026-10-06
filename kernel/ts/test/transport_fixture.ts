// Real authored source is compiled independently of provisional release fixtures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
const scratch = mkdtempSync(join(tmpdir(), 'loka-transport-source-'));
let source: any;
try {
  execFileSync(
    'mix',
    ['loka.compile', 'cartridges/ashmere_missing_child', join(scratch, 'artifact.json')],
    { cwd: fileURLToPath(new URL('../../../', import.meta.url)), stdio: 'pipe' },
  );
  source = JSON.parse(readFileSync(join(scratch, 'artifact.json'), 'utf8')).cartridge;
} finally {
  rmSync(scratch, { recursive: true });
}
export const prefix = `${source.manifest.id}@${source.manifest.version}`;
export const ref = (kind: string, key: string): DefinitionRef => ({
  cartridge_id: source.manifest.id,
  cartridge_version: source.manifest.version,
  kind: kind as never,
  key: key as never,
});
export function bundle(change: (c: any) => void = () => {}) {
  const c = structuredClone(source);
  c.entry = ref('room', 'boathouse');
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/pennies`].start = 3;
  change(c);
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function fresh(change: (c: any) => void = () => {}) {
  const b = bundle(change),
    loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
}
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];
export const endpoint = (w: World, route: string) =>
  Object.entries(w.details).find(
    ([, d]) => d.transport?.route.key === route,
  )![0] as keyof World['details'];
export const pennies = (w: World) =>
  [w.body, entity(w, 'npc', 'sedge')].map(
    (id) =>
      w.state.resources![
        key({ kind: 'resource', entity_id: id, resource: ref('resource', 'pennies') })
      ].value,
  );
