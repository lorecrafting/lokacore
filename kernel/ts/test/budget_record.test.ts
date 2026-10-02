// evaluation.budget_exceeded from loka play's decide (play/run.ts; 04 §5.4; ADR-075 §7): the
// green known answer (protocol/fixtures/cartridge_green_hash.json) with its move overridden by
// an action whose policy is `all` of 32769 true time_window leaves, so a move faults
// budget_exceeded at admission's query_steps. Expected records are hand-written literals.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { encode } from '../src/canonical.ts';
import { validate } from '../src/validate.ts';
import { INSTALLED, newWorld } from '../src/world.ts';
import { line } from '../play/obs.ts';
import { decide } from '../play/run.ts';
import { read } from './read.ts';

const G = 'ashmere_green@0.0.1';
const CID = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const HASH = 'fe17f082e3f22187e008b34491af5ed1b053fdc4615058ce47011ee0180d84f2';
const KERNEL = `loka-kernel@${'0123456789'.repeat(4)}`;
const OBS = (process.env.LOKA_OBS_DIR = mkdtempSync(join(tmpdir(), 'loka-obs-'))); // this run's
after(() => rmSync(OBS, { recursive: true, force: true }));

const world = (): World => {
  const c = structuredClone(read('protocol/fixtures/cartridge_green_hash.json').value);
  c.manifest.requires.capabilities.policy = c.lock.capabilities.policy = 1;
  const TRUE = { op: 'time_window', from: 0, to: 12 }; // true at 06:00
  c.actions[`${G}:action/move`] = {
    key: 'move',
    label: 'room.belfry.title', // any key of the catalog
    accessibility: 'room.belfry.title',
    target: { kind: 'none' },
    command: 'move',
    priority: 0,
    input: ['direction'],
    policy: { policy_version: 1, root: { op: 'all', items: Array(32769).fill(TRUE) } },
  };
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'];
  return newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);
};

// Breaks: no record of a budget fault, one with the wrong ids (not the run's plus the command and
// the revision it was decided against) or limit, a second one from a replay (measured false), or
// a producer whose invalid record is written instead of failing the run.
const run = () => {
  const w = world();
  const run_id = randomUUID(); // this test's own file
  const ids = { content_hash: HASH, kernel_version: KERNEL, seed: [1, 2, 3, 4], run_id };
  const r = { ids, world: w, ordinal: 0, revision: 3 };
  const move = { type: 'move', direction: 'north', actor_id: w.character };
  const command = { id: CID, world_context_id: w.context, payload: move } as Command;
  return { r, ids, command, path: `${OBS}/diagnostics/${run_id}.jsonl` };
};

test('a budget fault in a run is one valid diagnostics record of its limit', () => {
  const { r, ids, command, path } = run();
  assert.equal(decide(r, command, false).decision.kind, 'fault');
  assert.equal(existsSync(path), false);
  decide(r, command);
  const record = {
    format: 'loka-obs-v1',
    event: 'evaluation.budget_exceeded',
    store: 'diagnostics',
    ids: { ...ids, command_id: CID, revision: 3 },
    data: { limit: 'query_steps' },
  };
  assert.deepEqual(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l)),
    [record],
  );
  assert.deepEqual(validate('ObservationRecord', record), []);
  for (const data of [{ limit: 'steps' }, { limit: 'query_steps', rule: 'r' }])
    assert.throws(() => line({ ...record, data }), /invalid observation record/);
});

// Breaks (04 §5.4: observation failure cannot change the fault or the retry outcome): a failed
// diagnostics write thrown out of decide, which would end the simulator's playback. Red control:
// without decide's catch this test throws. The record's file is a directory, so the write fails.
test('a failed diagnostics write leaves the budget fault, and the run goes on', () => {
  const { r, command, path } = run();
  mkdirSync(path, { recursive: true });
  for (let i = 0; i < 2; i++) assert.equal(decide(r, command).decision.kind, 'fault');
});
