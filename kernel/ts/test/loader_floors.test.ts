// Twin of test/loka/loader_floors_test.exs; both read protocol/fixtures/loader_floors.json
// (Beads loka-xroj). That test also checks every schema floor has a case.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';

type Case = {
  floor: string;
  below: string;
  source: string;
  edits?: [string, (string | number)[], unknown][];
  loader: [string, string];
};
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { cases } = JSON.parse(
  readFileSync(join(root, 'protocol/fixtures/loader_floors.json'), 'utf8'),
) as { cases: Case[] };

const set = (o: any, path: (string | number)[], value: unknown) => {
  for (const k of path.slice(0, -1)) o = o[k];
  o[path.at(-1)!] = value;
};
const load = (cartridge: unknown) => {
  const canonical = encode(cartridge as never);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};

// Breaks: a loader floor check dropped, moved to another floor or reporting another code or path
// (each case compiled at its floor loads; the same artifact at below is refused).
test('each fixture floor: the loader accepts the floor and refuses just below it', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'loka-loader-floors-'));
  try {
    for (const [n, c] of cases.entries()) {
      const dir = join(scratch, String(n));
      cpSync(join(root, c.source), dir, { recursive: true });
      for (const [file, path, value] of [
        ...(c.edits ?? []),
        ['cartridge.json', ['requires', 'kernel_api', 'at_least'], c.floor] as const,
      ]) {
        const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        set(json, path as (string | number)[], value);
        writeFileSync(join(dir, file), JSON.stringify(json));
      }
      execFileSync('mix', ['loka.compile', dir, `${dir}.json`], {
        cwd: root,
        stdio: 'pipe',
      });
      const { cartridge } = JSON.parse(readFileSync(`${dir}.json`, 'utf8'));
      assert.equal(load(cartridge), 'loaded', `${c.source} at ${c.floor}`);
      cartridge.manifest.requires.kernel_api.at_least = c.below;
      assert.deepEqual(load(cartridge), c.loader, `${c.source} at ${c.below}`);
    }
  } finally {
    rmSync(scratch, { recursive: true });
  }
});
