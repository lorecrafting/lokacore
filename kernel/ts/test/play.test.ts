// `loka play` end to end on Node (R5 S1; ADR-075 §3-§7). Runs the real CLI on the rooms
// known-answer artifact; expected places and rejections are hand-written; every record the
// run writes is validated against ObservationRecord, and the §4 relationships the schema
// cannot express are checked here.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { validate } from '../src/validate.ts';
import { line, ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const dir = mkdtempSync(join(tmpdir(), 'r5s1-play-'));
const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const artifact = join(dir, 'rooms.json');
writeFileSync(artifact, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);
const main = `${ROOT}kernel/ts/play/main.ts`;

function play(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync('node', [main, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}
const records = (rel: string) =>
  readFileSync(ROOT + rel, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const hashes = (out: string) => [...out.matchAll(/\[state ([0-9a-f]{64})/g)].map((m) => m[1]);

const script = join(dir, 'walk.txt');
writeFileSync(script, 'l\nn\ngo sideways\nnorth\ndance\nconstructor\ngo south\nw\nquit\nnorth\n');
const first = play([artifact, script]);
const transcript = first.out.match(/transcript: (\S+)/)![1];
const trace = records(transcript);

// Breaks: a word mapped to the wrong command, a move to the wrong room, a lost rejection, or
// input after quit still read.
test('a scripted walk prints the rooms and rejections a player expects', () => {
  assert.equal(first.status, 0, first.err);
  const rooms = [...first.out.matchAll(/^(Ferry Landing|Well Lane|Boathouse)$/gm)].map((m) => m[1]);
  assert.deepEqual(rooms, [
    'Ferry Landing',
    'Ferry Landing',
    'Well Lane',
    'Ferry Landing',
    'Boathouse',
  ]);
  assert.match(first.out, /> go sideways\nThat isn't a direction\.\n/);
  assert.match(first.out, /> north\nYou can't go that way\.\n/);
  assert.match(first.out, /> dance\nI don't understand that\.\n/);
  assert.match(first.out, /> constructor\nI don't understand that\.\n/); // not a prototype key
  assert.equal(hashes(first.out).length, 6); // six commands; dance and quit are not commands
});

// Breaks: a record that fails its contract, a gap or repeat in ordinals, an entry of another
// run, a command id that is not the entry's, a revision that does not follow commits, or a
// decision paired with a commit outcome ADR-075 §4 forbids.
test('every record validates and the game_trace keeps the ADR-075 §4 relationships', () => {
  const operations = records(transcript.replace('game_trace', 'operations'));
  for (const r of [...trace, ...operations]) assert.deepEqual(validate('ObservationRecord', r), []);
  const [head, ...entries] = trace;
  assert.equal(head.event, 'trace.run');
  assert.deepEqual(head.data, {
    initial_state: { state: 'fresh' },
    fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
  });
  assert.equal(head.ids.content_hash, kat.sha256);
  const kinds = entries.map((e) => [e.data.decision.kind, e.data.decision.error?.code ?? null]);
  assert.deepEqual(kinds, [
    ['accepted', null],
    ['accepted', null],
    ['rejected', 'invalid_target'],
    ['rejected', 'not_found'],
    ['accepted', null],
    ['accepted', null],
  ]);
  assert.deepEqual(
    entries.map((e) => [
      e.data.ordinal,
      e.ids.revision,
      e.data.commit.state,
      e.data.commit.revision ?? null,
    ]),
    [
      [1, 0, 'committed', 1],
      [2, 1, 'committed', 2],
      [3, 2, 'unavailable', null],
      [4, 2, 'unavailable', null],
      [5, 2, 'committed', 3],
      [6, 3, 'committed', 4],
    ],
  );
  for (const e of entries) {
    const { command_id, revision, ...shared } = e.ids;
    assert.deepEqual(shared, head.ids);
    assert.equal(e.data.command.id, command_id);
  }
  assert.deepEqual(
    operations.map((o) => [o.ids.command_id, o.ids.host, o.data.state]),
    entries.map((e) => [e.ids.command_id, 'node', 'observed']),
  );
  assert.throws(() => line({ ...head, ids: { ...head.ids, host: 'node' } }), /invalid observation/);
});

// Breaks: anything nondeterministic in a decision or a record (a clock, a fresh id, map order).
test('replaying the transcript twice reproduces its records and state hashes byte for byte', () => {
  const ops = () => records(transcript.replace('game_trace', 'operations')).length;
  const before = ops();
  for (let i = 0; i < 2; i++) {
    const again = play([artifact, '--replay', ROOT + transcript]);
    assert.equal(again.status, 0, again.err);
    assert.match(again.out, /replay: 7 records identical/);
    assert.deepEqual(hashes(again.out), hashes(first.out));
  }
  assert.equal(ops(), before); // a replay's latency would repeat the run's ids
  const tampered = join(dir, 'tampered.jsonl');
  const lines = readFileSync(ROOT + transcript, 'utf8').replace(
    '"direction":"north"',
    '"direction":"west"',
  );
  writeFileSync(tampered, lines);
  assert.equal(play([artifact, '--replay', tampered]).status, 1);
});

// ADR-075 §6: a home path in Diagnostic.path and a device serial in Diagnostic.data never
// reach the diagnostics store. Breaks: redaction skipped, or it breaks the record's contract.
test('loader diagnostics are written with home paths and the device serial redacted', () => {
  const home = `/Users/alice/${'secret'}`;
  const serial = 'r58m12abcde';
  const bad = (cartridge: any) => {
    const text = JSON.stringify(sortKeys(cartridge));
    const hash = createHash('sha256').update(text).digest('hex');
    const path = join(dir, `${hash}.json`);
    writeFileSync(path, `{"cartridge":${text},"content_hash":"${hash}"}`);
    return path;
  };
  const withHome = { ...kat.value, [home]: 1 };
  const withSerial = structuredClone(kat.value);
  withSerial.manifest.requires.client_features = [serial];
  for (const path of [bad(withHome), bad(withSerial)]) {
    const r = play([path], { ANDROID_SERIAL: serial });
    assert.equal(r.status, 1);
    const rel = r.err.match(/diagnostic: (\S+)/)![1];
    const text = readFileSync(ROOT + rel, 'utf8');
    assert.ok(!text.includes('/Users/alice') && !text.includes(serial), text);
    assert.ok(!r.err.includes('/Users/alice') && !r.err.includes(serial), r.err);
    const [record] = records(rel);
    assert.deepEqual(validate('ObservationRecord', record), []);
    assert.match(record.data.path + JSON.stringify(record.data.data), /<redacted>/);
  }
});

// Breaks: HEAD reported for a tree with uncommitted changes (ADR-075 §3).
test('kernel_version names the commit, with -dirty for an unclean tree', () => {
  const git = (...a: string[]) =>
    execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim();
  const probe = `${ROOT}kernel/ts/r5s1-dirty-probe`;
  writeFileSync(probe, '');
  try {
    const r = play([artifact, script]);
    const rel = r.out.match(/transcript: (\S+)/)![1];
    assert.equal(
      records(rel)[0].ids.kernel_version,
      `loka-kernel@${git('rev-parse', 'HEAD')}-dirty`,
    );
  } finally {
    rmSync(probe);
  }
});

function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys(v[k])]),
    );
  return v;
}
