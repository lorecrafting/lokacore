import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-deer-source-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ashmere_missing_child', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const compiled = JSON.parse(new TextDecoder().decode(artifact));
export const bundle = { canonical: encode(compiled.cartridge), sha256: compiled.content_hash };
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;
export const fresh = (seed: readonly number[] = [1, 2, 3, 4]) =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
export const ref = (kind: string, name: string) =>
  `${content.manifest.id}@${content.manifest.version}:${kind}/${name}`;
