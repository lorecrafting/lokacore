// Current candidate: independent Python literal bytes/IDs checked against source compilation and allocation.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact } from '../../../kernel/ts/play/obs.ts';
import { INSTALLED, loadCartridge, newWorld } from '../../../kernel/ts/src/index.ts';
const read = (name) => JSON.parse(readFileSync(`protocol/fixtures/${name}.json`, 'utf8'));
const pin = read('missing_child_v028_hash'), answers = read('missing_child_v028_ids');
const dir = mkdtempSync(join(tmpdir(), 'loka-b9-pins-'));
try {
  const path = join(dir, 'artifact.json');
  const compiled = spawnSync('mise', ['exec', '--', 'mix', 'loka.compile', 'cartridges/ashmere_missing_child', path], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, 'source compilation');
  const bytes = readFileSync(path, 'utf8');
  assert.equal(bytes, `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`);
  const loaded = loadCartridge(new TextEncoder().encode(bytes), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const w = newWorld(loaded.cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', [1, 2, 3, 4]);
  const prefix = 'ashmere_missing_child@0.0.28';
  for (const [label, expected] of Object.entries(answers)) {
    const [kind, name, detail] = label.split('/');
    const actual = kind === 'character' ? w.character : kind === 'body' ? w.body :
      kind === 'room' ? w.roomIds[`${prefix}:room/${name}`] :
      kind === 'detail' ? Object.entries(w.details).find(([, d]) => d.key === detail && d.room === w.roomIds[`${prefix}:room/${name}`])?.[0] :
      kind === 'slot' ? w.slots[name] :
      kind === 'job' ? Object.entries(w.state.jobs ?? {}).find(([, j]) => j.job.key === name)?.[0] : w.entityIds[`${prefix}:${kind}/${name}`];
    assert.equal(actual, expected, label);
  }
  assert.equal(Object.keys(answers).length, 127);
  console.log(redact(`Integrated successor v028/API1.25: ${pin.sha256}; complete compiler bytes and all 127 independent initial IDs match.`));
  console.log('Published D5/D2 predecessor 4bcb2eaf; B9 publication null.');
} finally { rmSync(dir, { recursive: true }); }
