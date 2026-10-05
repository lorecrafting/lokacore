import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

// Breaks: terminal Read loses its target_id or fails to resolve detail aliases.
test('terminal read resolves authored aliases and narrates both chapter details', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-readable-play-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const pin = read('protocol/fixtures/missing_child_v002_hash.json');
  const artifact = join(dir, 'chapter.json'),
    script = join(dir, 'script.txt');
  writeFileSync(artifact, `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`);
  writeFileSync(script, 'read landing notice\nread notice\nnorth\neast\nread board\nread\n');
  const result = spawnSync('node', [ROOT + 'kernel/ts/play/main.ts', artifact, script], {
    encoding: 'utf8',
    env: { ...process.env, LOKA_OBS_DIR: dir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.split('Keep the landing clear. Tie boats to the mooring post.').length - 1,
    2,
  );
  assert.ok(result.stdout.includes('Lost a tin whistle? Ask at the Drowned Lantern.'));
  assert.ok(result.stdout.includes('Read what?'));
});
