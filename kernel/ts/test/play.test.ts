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
import { encode } from '../src/canonical.ts';
import { validate } from '../src/validate.ts';
import { line, ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const dir = mkdtempSync(join(tmpdir(), 'r5s1-play-'));
const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const artifact = join(dir, 'rooms.json');
writeFileSync(artifact, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);
const main = `${ROOT}kernel/ts/play/main.ts`;
const NIL = '00000000-0000-0000-0000-000000000000';
const OTHER_WORLD = '11111111-2222-4333-8444-555555555555'; // a world this run never minted

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
  // The initial state and five commands; go sideways, dance and quit are not commands.
  assert.equal(hashes(first.out).length, 6);
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
    world_context_id: entries[0].data.command.world_context_id,
    initial_state: { state: 'fresh' },
    fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
  });
  assert.equal(head.ids.content_hash, kat.sha256);
  const kinds = entries.map((e) => [e.data.decision.kind, e.data.decision.error?.code ?? null]);
  assert.deepEqual(kinds, [
    ['accepted', null],
    ['accepted', null],
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
      [4, 2, 'committed', 3],
      [5, 3, 'committed', 4],
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
    assert.match(again.out, /replay: 5 commands identical/);
    assert.deepEqual(hashes(again.out), hashes(first.out));
  }
  assert.equal(ops(), before); // a replay's latency would repeat the run's ids
  const original = readFileSync(ROOT + transcript, 'utf8');
  const lines = original.split('\n');
  // Entry 2 (north) with only its Command changed, re-encoded canonically (Astra A3, A6).
  const second = (f: (c: any) => void) => {
    const rec = JSON.parse(lines[2]);
    f(rec.data.command);
    return [lines[0], lines[1], encode(rec), ...lines.slice(3)].join('\n');
  };
  const variants: [string, string, RegExp][] = [
    ['another decision', original.replace('"direction":"north"', '"direction":"west"'), /./],
    ['a blank line', original.replace('\n', '\n\n'), /not an ObservationRecord line/],
    ['no final newline', original.slice(0, -1), /replay differs/],
    ['another world', second((c) => (c.world_context_id = OTHER_WORLD)), /can't go that way/],
    ['the nil CommandId', second((c) => (c.id = NIL)), /permission_denied/],
  ];
  for (const [name, text, why] of variants) {
    const path = join(dir, 'tampered.jsonl');
    writeFileSync(path, text);
    const r = play([artifact, '--replay', path]);
    assert.equal(r.status, 1, name);
    assert.match(r.out + r.err, why, name);
  }
});

// R1-3, R2-2: replay builds the world from the header, not from the first command. The
// expected initial state hash is Python's: body (ordinal 1) in ferry_landing (ordinal 3, the
// second room ref) of OTHER_WORLD, seed [1, 0, 0, 0] (numeric profile, Initial world ids).
test('a header in another world replays from that world', () => {
  const lines = readFileSync(ROOT + transcript, 'utf8').split('\n');
  const head = JSON.parse(lines[0]);
  head.data.world_context_id = OTHER_WORLD;
  head.ids.seed = [1, 0, 0, 0];
  const path = join(dir, 'other-world.jsonl');
  writeFileSync(path, [encode(head), ...lines.slice(1)].join('\n'));
  const r = play([artifact, '--replay', path]);
  assert.equal(r.status, 1);
  assert.equal(
    hashes(r.out)[0],
    '3e67bf938148221ad31d8bd31db992b17a7e1341061c64fcd051ce863ee27ad3',
  );
});

// A4: the header alone reconstructs the initial world. Breaks: the world context re-minted.
test('a header-only transcript replays to the same initial world', () => {
  const empty = join(dir, 'empty.txt');
  writeFileSync(empty, '');
  const run = play([artifact, empty]);
  const rel = run.out.match(/transcript: (\S+)/)![1];
  const again = play([artifact, '--replay', ROOT + rel]);
  assert.equal(again.status, 0, again.err);
  assert.match(again.out, /replay: 0 commands identical/);
  assert.deepEqual(hashes(again.out), hashes(run.out));
  assert.equal(hashes(run.out).length, 1);
});

// F1: replay across a source change. Breaks: kernel_version compared, so no fix can be proven.
test('a transcript recorded by another kernel version replays and names both versions', () => {
  const original = readFileSync(ROOT + transcript, 'utf8');
  const recorded = JSON.parse(original.split('\n')[0]).ids.kernel_version;
  const older = `loka-kernel@${'0'.repeat(40)}`;
  const path = join(dir, 'older.jsonl');
  writeFileSync(path, original.replaceAll(recorded, older));
  const again = play([artifact, '--replay', path]);
  assert.equal(again.status, 0, again.err);
  assert.match(again.out, new RegExp(`recorded by ${older}\nreplayed on loka-kernel@`));
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

// A5: player text that names a device serial reaches no record. Breaks: `go <word>` becomes a
// move Command again, whose direction the trace keeps.
test('go <serial> on a valid cartridge leaves the serial in no record', () => {
  const serial = 'r58m12abcde';
  const path = join(dir, 'serial.txt');
  writeFileSync(path, `go ${serial}\nlook\n`);
  const r = play([artifact, path], { ANDROID_SERIAL: serial });
  assert.match(r.out, new RegExp(`> go ${serial}\nThat isn't a direction\.\n`));
  const rel = r.out.match(/transcript: (\S+)/)![1];
  for (const store of ['game_trace', 'operations']) {
    const text = readFileSync(ROOT + rel.replace('game_trace', store), 'utf8');
    assert.ok(!text.includes(serial), store);
  }
  assert.equal(records(rel).length, 2); // the header and look
});

// ADR-075 §3: input_digest is SHA-256 of the artifact file's bytes. Breaks: another input
// digested (the canonical cartridge, the path). The answer is Python's.
test('a failed load records the input_digest known answer', () => {
  const { artifact: text, sha256 } = read('protocol/fixtures/input_digest.json');
  const path = join(dir, 'bad.json');
  writeFileSync(path, text);
  const r = play([path]);
  assert.equal(r.status, 1);
  const [record] = records(r.err.match(/diagnostic: (\S+)/)![1]);
  assert.equal(record.ids.input_digest, sha256);
  assert.equal(record.data.code, 'UNKNOWN_FORMAT');
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
