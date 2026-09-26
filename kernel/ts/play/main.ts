// `loka play <artifact> [script]` and `loka play <artifact> --replay <transcript>`: a
// single-player, MUD-style terminal over the TypeScript kernel on Node (owner decisions
// 2026-09-25, R5 setup and R5 plan). Each session writes its transcript, the game_trace
// (ADR-075 §4: the header plus the Commands by ordinal is the complete replay input);
// --replay re-decides those Commands and requires a byte-identical transcript file.
import { randomUUID, getRandomValues } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { decode, encode, hash, type Json } from '../src/canonical.ts';
import type { Command, CommandPayload, EntityId } from '../src/contracts.gen.ts';
import { commandId } from '../src/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { sha256Hex } from '../src/sha256.ts';
import { validate } from '../src/validate.ts';
import { resolve } from '../src/target.ts';
import { append, kernelVersion, line, lookupWords, redact } from './obs.ts';
import { detail, parse, room, which, type Parsed } from './text.ts';
import { decide, type Run } from './run.ts';

const [artifact, flag, transcript] = process.argv.slice(2);
if (!artifact) fail('usage: loka play <artifact> [script | --replay <transcript>]');
const kernel_version = kernelVersion();
const bytes = readFileSync(artifact);
const loaded = loadCartridge(bytes, INSTALLED);
if (!loaded.ok) {
  const ids = { kernel_version, input_digest: sha256Hex(bytes) };
  const record = redact({
    format: 'loka-obs-v1',
    event: 'content.diagnostic',
    store: 'diagnostics',
    ids,
    data: loaded.diagnostic,
  } as unknown as Json);
  const rel = append('diagnostics', ids.input_digest, line(record), 'w'); // one load, one record
  fail(`cannot load ${artifact}: ${encode((record as { data: Json }).data)}\ndiagnostic: ${rel}`);
}
const { hash: content_hash } = loaded;
const cartridge = loaded.cartridge as Cartridge;
if (cartridge.format !== 'loka-cartridge-v2')
  fail('this cartridge has no rooms (loka-cartridge-v1)');

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function seed(): number[] {
  const words = [...getRandomValues(new Uint32Array(4))];
  return words.some((w) => w) ? words : [1, 0, 0, 0];
}

async function session(script: string | undefined) {
  const tty = !script && process.stdin.isTTY;
  const r = start(randomUUID(), randomUUID(), seed(), kernel_version);
  const rel = append('game_trace', r.ids.run_id, header(r));
  shown(r);
  const input = createInterface({
    input: script ? createReadStream(script) : process.stdin,
    output: tty ? process.stdout : undefined,
    prompt: '> ',
  });
  if (tty) input.prompt();
  for await (const text of input) {
    if (!tty) process.stdout.write(`> ${text}\n`);
    const parsed = parse(text);
    if (parsed === 'quit') break;
    if (typeof parsed === 'string') process.stdout.write(`${parsed}\n`);
    else if (parsed && 'lookup' in parsed) lookup(r, parsed.lookup);
    else if (parsed) append('game_trace', r.ids.run_id, turn(r, command(r, parsed)));
    if (tty) input.prompt();
  }
  input.close();
  process.stdout.write(`transcript: ${rel}\n`);
}

const start = (run_id: string, context: string, s: number[], version: string): Run => ({
  ids: { content_hash, kernel_version: version, seed: s, run_id },
  world: newWorld(cartridge, context as World['context'], s),
  ordinal: 0,
  revision: 0,
});

const header = (r: Run) =>
  line({
    format: 'loka-obs-v1',
    event: 'trace.run',
    store: 'game_trace',
    ids: r.ids,
    data: {
      world_context_id: r.world.context,
      initial_state: { state: 'fresh' },
      fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
    },
  });

// The room on arrival and the initial state hash.
const shown = (r: Run) =>
  process.stdout.write(`${room(cartridge, r.world)}[state ${hash(r.world.state as never)}]\n`);

const command = (
  r: Run,
  parsed:
    Exclude<Parsed, string | null | { lookup: string }> | { type: 'look'; target_id: EntityId },
): Command =>
  ({
    id: commandId(r.ids.run_id, randomUUID()),
    world_context_id: r.world.context,
    payload: { ...parsed, actor_id: r.world.character } as CommandPayload,
  }) as Command;

// Decides one command, prints what the player sees, the state hash and the step time, and
// returns its game_trace line; the latency metric goes to operations.
function turn(r: Run, cmd: Command, measured = true): string {
  const { trace, latency, decision } = decide(r, cmd);
  if (measured) append('operations', r.ids.run_id, line(latency)); // a replay's ids repeat the run's
  const target = 'target_id' in cmd.payload ? cmd.payload.target_id : undefined;
  const shown =
    decision.kind !== 'accepted'
      ? `${reason(decision)}\n`
      : target
        ? detail(cartridge, r.world, target)
        : room(cartridge, r.world);
  const micros = latency.data.value;
  process.stdout.write(`${shown}[state ${hash(r.world.state as never)}  step ${micros} µs]\n`);
  return line(trace);
}

// Resolves the player's words in the current room (target.ts; 04 §17): unique becomes a look
// Command at the resolved id; none and ambiguous build no Command and write one
// target.unresolved record to diagnostics (owner request, R5 S2) with the words redacted.
function lookup(r: Run, words: string) {
  const res = resolve(r.world, words);
  if (res.kind === 'unique') {
    const cmd = command(r, { type: 'look', target_id: res.target_id });
    return void append('game_trace', r.ids.run_id, turn(r, cmd));
  }
  const none = res.kind === 'none';
  process.stdout.write(none ? "You don't see that here.\n" : which(r.world, res.candidate_ids));
  const { key } = r.world.rooms[r.world.state.containers[r.world.body]];
  const { id, version } = cartridge.manifest;
  const data = {
    room: { cartridge_id: id, cartridge_version: version, kind: 'room', key },
    outcome: res.kind,
    candidates: none ? 0 : res.candidate_ids.length,
    words: lookupWords(words),
    after_ordinal: r.ordinal,
  };
  const record = { format: 'loka-obs-v1', event: 'target.unresolved', store: 'diagnostics' };
  append('diagnostics', r.ids.run_id, line({ ...record, ids: r.ids, data }));
}

function reason(d: { kind: string; error?: { code: string }; code?: string }): string {
  const code = d.error?.code ?? d.code;
  const words: Record<string, string> = {
    not_found: "You can't go that way.",
    invalid_target: "That isn't a direction.",
    unsupported_capability: "You can't do that here.",
  };
  return words[code!] ?? `(${d.kind}: ${code})`;
}

// Re-decides the transcript's Commands from its header (run, seed, world, and the recorded
// kernel_version, which is reported, not compared: ADR-075 §4) and prints each state hash;
// exits 1 unless the regenerated transcript is the file, byte for byte.
function replay(path: string | undefined) {
  if (!path) fail('usage: loka play <artifact> --replay <transcript>');
  const file = readFileSync(path, 'utf8');
  const records = file
    .split('\n')
    .slice(0, -1)
    .map((l, i) => {
      try {
        const rec = decode(l) as { event: string; ids: any; data: any };
        if (!validate('ObservationRecord', rec).length) return rec;
      } catch {}
      return fail(`${path}:${i + 1}: not an ObservationRecord line`);
    });
  const [head, ...entries] = records;
  if (head?.event !== 'trace.run' || entries.some((e) => e.event !== 'trace.command'))
    fail(`${path}: not a game_trace (one trace.run, then trace.command entries)`);
  if (head.ids.content_hash !== content_hash) fail(`${path}: a transcript of another cartridge`);
  const { run_id, seed, kernel_version: recorded } = head.ids;
  const r = start(run_id, head.data.world_context_id, seed, recorded);
  if (recorded !== kernel_version)
    process.stdout.write(`recorded by ${recorded}\nreplayed on ${kernel_version}\n`);
  shown(r);
  const out = header(r) + entries.map((e) => turn(r, e.data.command, false)).join('');
  if (out !== file) fail(`replay differs from ${path}`);
  process.stdout.write(`replay: ${entries.length} commands identical\n`);
}

if (flag === '--replay') replay(transcript);
else await session(flag);
