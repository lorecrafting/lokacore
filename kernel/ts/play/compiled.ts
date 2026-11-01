// A cartridge source compiled to a temp dir, never next to the source: what every writer's tool reads.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

/** The compiled artifact as the app's {canonical, sha256}, or the compiler's words. */
export function compiled(source: string): { canonical: string; sha256: string } | string {
  const tmp = mkdtempSync(join(tmpdir(), 'loka-check-'));
  try {
    const artifact = join(tmp, 'artifact.json');
    const run = spawnSync(
      'mise',
      ['exec', '--', 'mix', 'loka.compile', source, artifact, '--allow-placeholders'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, // as play/author.ts
    );
    if (run.status !== 0) return `${run.stderr || run.error?.message || 'compile failed'}`.trim();
    const parts = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(
      readFileSync(artifact, 'utf8'),
    );
    return parts ? { canonical: parts[1]!, sha256: parts[2]! } : 'not in canonical artifact form';
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The bytes `loadCartridge` reads, from the {canonical, sha256} form (session.ts cartridgeOf). */
export const artifactBytes = ({ canonical, sha256 }: { canonical: string; sha256: string }) =>
  Buffer.from(`{"cartridge":${canonical},"content_hash":"${sha256}"}`);
