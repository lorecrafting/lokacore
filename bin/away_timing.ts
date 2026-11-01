// One absence on the showcase at a given away cap: open, drain, reopen, with times and size.
// usage: mise exec -- node bin/away_timing.ts <away_cap_hours>   (close other work first)
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compiled } from '../mobile/authority/local-story/__tests__/compiled.ts';
import {
  elapsedHost,
  receipts,
} from '../mobile/authority/local-story/__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-away-'));
const dir = join(scratch, 'cartridge');
cpSync('cartridges/toolbox_showcase', dir, { recursive: true });
const file = join(dir, 'cartridge.json');
const cartridge = JSON.parse(readFileSync(file, 'utf8'));
cartridge.time_policy.away_cap_hours = Number(process.argv[2]);
writeFileSync(file, JSON.stringify(cartridge));
const bundle = compiled(dir);
const path = join(scratch, 'save.db');

const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
const moved = a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'south' } });
if (moved.kind !== 'saved') throw new Error(moved.kind);
const before = receipts(a.sql);
a.sql.close();

const YEAR = 365 * 86400 * 1000;
let t0 = performance.now();
const b = elapsedHost(path, { wall: 10000 + YEAR, mono: 0 }, bundle);
const open = performance.now() - t0;
t0 = performance.now();
let status = b.game.pulse('resume');
while (status.kind === 'catching_up') status = b.game.pulse('drain');
const drain = performance.now() - t0;
const after = receipts(b.sql);
b.sql.close();
t0 = performance.now();
elapsedHost(path, { wall: 10000 + YEAR, mono: 0 }, bundle).sql.close();
const cold = performance.now() - t0;

console.log(
  JSON.stringify({
    status: status.kind,
    open_s: open / 1000,
    catch_up_s: drain / 1000,
    absence_s: (open + drain) / 1000,
    turns: after - before,
    cold_open_after_s: cold / 1000,
    bytes: statSync(path).size,
  }),
);
rmSync(scratch, { recursive: true });
process.exit(0); // the test file imported above must not run its tests here
