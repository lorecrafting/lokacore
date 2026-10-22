import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { codex, DESK_NOTE, notices, PLAQUE } from './codex_fixture.ts';

// Breaks: terminal Read loses its target_id or fails to resolve detail aliases.
test('terminal read resolves authored aliases and narrates both room details', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-readable-play-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const pin = codex.bundle(notices);
  const artifact = join(dir, 'codex.json'),
    script = join(dir, 'script.txt');
  writeFileSync(artifact, `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`);
  writeFileSync(script, 'read hall plaque\nread plaque\nwest\nread desk\nread\n');
  const result = spawnSync('node', [ROOT + 'kernel/ts/play/main.ts', artifact, script], {
    encoding: 'utf8',
    env: { ...process.env, LOKA_OBS_DIR: dir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split(PLAQUE).length - 1, 2);
  assert.ok(result.stdout.includes(DESK_NOTE));
  assert.ok(result.stdout.includes('Read what?'));
});
