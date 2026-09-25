// `loka play <artifact> [script]` and `loka play <artifact> --replay <transcript>`: a
// single-player, MUD-style terminal over the TypeScript kernel on Node (owner decisions
// 2026-09-25, R5 setup and R5 plan). Each session writes its transcript, the game_trace
// (ADR-075 §4: the header plus the Commands by ordinal is the complete replay input);
// --replay re-decides those Commands and requires byte-identical records.
import { randomUUID, getRandomValues } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { decode, encode, hash, type Json } from '../src/canonical.ts';
import type { Command, CommandPayload } from '../src/contracts.gen.ts';
import { commandId } from '../src/id_source.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge, type World } from '../src/index.ts';
import { sha256Hex } from '../src/sha256.ts';
import { validate } from '../src/validate.ts';
import { append, kernelVersion, line, redact } from './obs.ts';
import { parse, room, type Parsed } from './text.ts';
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
  const r = start(randomUUID(), randomUUID(), seed());
  const rel = append('game_trace', r.ids.run_id, header(r));
  process.stdout.write(room(cartridge, r.world));
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
    if (parsed) append('game_trace', r.ids.run_id, turn(r, command(r, parsed)));
    else if (text.trim()) process.stdout.write("I don't understand that.\n");
    if (tty) input.prompt();
  }
  input.close();
  process.stdout.write(`transcript: ${rel}\n`);
}

const start = (run_id: string, context: string, s: number[]): Run => ({
  ids: { content_hash, kernel_version, seed: s, run_id },
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
      initial_state: { state: 'fresh' },
      fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
    },
  });

const command = (r: Run, parsed: Exclude<Parsed, 'quit' | null>): Command =>
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
  const shown = decision.kind === 'accepted' ? room(cartridge, r.world) : `${reason(decision)}\n`;
  const micros = latency.data.value;
  process.stdout.write(`${shown}[state ${hash(r.world.state as never)}  step ${micros} µs]\n`);
  return line(trace);
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

// Re-decides the transcript's Commands from its header and prints each state hash; exits 1
// unless every regenerated record is byte-identical to the transcript's.
function replay(path: string | undefined) {
  if (!path) fail('usage: loka play <artifact> --replay <transcript>');
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const records = lines.map((l) => decode(l) as { event: string; ids: any; data: any });
  records.forEach((rec, i) => {
    if (validate('ObservationRecord', rec).length)
      fail(`${path}:${i + 1}: not an ObservationRecord`);
  });
  const [head, ...entries] = records;
  if (head?.event !== 'trace.run' || entries.some((e) => e.event !== 'trace.command'))
    fail(`${path}: not a game_trace (one trace.run, then trace.command entries)`);
  if (head.ids.content_hash !== content_hash) fail(`${path}: a transcript of another cartridge`);
  const context = entries[0]?.data.command.world_context_id ?? randomUUID();
  const r = start(head.ids.run_id, context, head.ids.seed);
  const out = [header(r), ...entries.map((e) => turn(r, e.data.command, false))];
  const differs = out.findIndex((l, i) => l !== `${lines[i]}\n`);
  if (differs >= 0) fail(`replay differs at ${path}:${differs + 1}`);
  process.stdout.write(`replay: ${out.length} records identical\n`);
}

if (flag === '--replay') replay(transcript);
else await session(flag);
