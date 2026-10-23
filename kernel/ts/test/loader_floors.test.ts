// Twin of test/loka/loader_floors_test.exs; both read protocol/fixtures/loader_floors.json
// (Beads loka-xroj). That test also checks every schema floor has a case.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';

type Case = {
  floor: string;
  below: string;
  source: string;
  edits?: [string, string[], unknown][];
  without?: [string, string[], unknown][];
  loader: [string, string];
};
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { cases } = JSON.parse(
  readFileSync(join(root, 'protocol/fixtures/loader_floors.json'), 'utf8'),
) as { cases: Case[] };

const set = (o: any, path: string[], value: unknown) => {
  for (const k of path.slice(0, -1)) o = o[k];
  if (value === null) delete o[path.at(-1)!];
  else o[path.at(-1)!] = value;
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
    // A counter-edited case (Beads loka-59uu) also gets a directory with its own feature removed,
    // compiled just below its floor.
    const write = (dir: string, c: Case, edits: [string, string[], unknown][], at: string) => {
      cpSync(join(root, c.source), dir, { recursive: true });
      for (const [file, path, value] of [
        ...edits,
        ['cartridge.json', ['requires', 'kernel_api', 'at_least'], at] as const,
      ]) {
        // An empty key path writes the whole (possibly new) file, or with null deletes it.
        if (!path.length && value === null) {
          rmSync(join(dir, file));
          continue;
        }
        const json = path.length ? JSON.parse(readFileSync(join(dir, file), 'utf8')) : value;
        if (path.length) set(json, path as string[], value);
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), JSON.stringify(json));
      }
    };
    for (const [n, c] of cases.entries()) {
      write(join(scratch, String(n)), c, c.edits ?? [], c.floor);
      if (c.without) write(join(scratch, `${n}w`), c, [...(c.edits ?? []), ...c.without], c.below);
    }
    // One BEAM compiles every case (as longwait_property.test.ts does); a refused case fails the match.
    const script = `for d <- File.ls!(${JSON.stringify(scratch)}) do
      dir = Path.join(${JSON.stringify(scratch)}, d)
      {:ok, b, _} = Loka.Content.compile(dir)
      File.write!(dir <> ".json", b)
    end`;
    execFileSync('mix', ['run', '--no-start', '-e', script], { cwd: root, stdio: 'pipe' });
    for (const [n, c] of cases.entries()) {
      const dir = join(scratch, String(n));
      const { cartridge } = JSON.parse(readFileSync(`${dir}.json`, 'utf8'));
      assert.equal(load(cartridge), 'loaded', `${c.source} at ${c.floor}`);
      cartridge.manifest.requires.kernel_api.at_least = c.below;
      assert.deepEqual(load(cartridge), c.loader, `${c.source} at ${c.below}`);
      if (c.without) {
        const counter = JSON.parse(readFileSync(join(scratch, `${n}w.json`), 'utf8')).cartridge;
        assert.equal(load(counter), 'loaded', `${c.source} without its feature at ${c.below}`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true });
  }
});
