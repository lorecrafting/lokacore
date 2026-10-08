// Run: mise exec -- node kernel/ts/test/e1.ts <artifact.json> <new-output-dir> [sequences]
// Replay: same command with a retained repro.json as the third argument.
// Exit 0: reproduced failure; 1: failed/refused; 2: required certification evidence pending.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, platform, release } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { encode } from '../src/foundation/canonical.ts';
import { GENERATOR, KERNEL, simulate } from './sim.ts';
import { admitCandidate, type applicability, CANDIDATE, POLICY_HASH, sha256 } from './e1_policy.ts';
import { reproduce, retainFailure } from './e1_repro.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (path: string) => readFileSync(join(ROOT, path));
const git = (...args: string[]) => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('cannot inspect source identity');
  return r.stdout.trim();
};

// Every local module e1_cases.ts runs; e1.test.ts checks the import graph against it.
export const CHECK_FILES = [
  'e1.ts',
  'e1_policy.ts',
  'e1_repro.ts',
  'sim.ts',
  'read.ts',
  'e1_case_host.ts',
  'e1_obligations.ts',
  'e1_knowledge_effects.ts',
  'e1_identity.ts',
  'e1_creatures.ts',
  'e1_world_witness.ts',
  'e1_debt.ts',
  'e1_paths.ts',
  'e1_routes.ts',
  'e1_dialogue_circuit.ts',
  'e1_optional_quests.ts',
  'e1_watch_rounds.ts',
  'e1_wisp_herbs.ts',
  'e1_maud.ts',
  'e1_services.ts',
  'e1_night_marsh.ts',
  'e1_epilogue_talks.ts',
  'e1_rejoin.ts',
  'e1_world.ts',
  'e1_items.ts',
  'e1_faults.ts',
  'e1_refusals.ts',
  'e1_cases.ts',
  'e1_dispositions.json',
];

export function source() {
  if (git('status', '--porcelain', '--untracked-files=normal'))
    throw new Error('dirty source tree: source receipt requires a clean commit');
  return {
    source_sha: git('rev-parse', 'HEAD'),
    check_hash: sha256(CHECK_FILES.map((f) => sha256(read(`kernel/ts/test/${f}`))).join('\n')),
    policy_hash: POLICY_HASH,
  };
}

// Evidence never carries a checkout, scratch path or host/device identifier.
export function redact(value: string) {
  return value
    .replace(/\/(?:Users|home|private|tmp|var)\/[^\s"'<>]+/g, '[local-path]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]')
    .replace(/\b[0-9A-F]{8}-[0-9A-F]{16}\b/g, '[device-id]');
}
type Receipt = {
  command: string[];
  exit_status: number | null;
  status: string;
  evidence: string;
  sha256: string;
};
function run(out: string, name: string, args: string[]): Receipt {
  const r = spawnSync('mise', ['exec', '--', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MIX_ENV: 'test', TEST_REPORTER: 'dot' },
  });
  const output = redact(`${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`);
  writeFileSync(join(out, name), output, { flag: 'wx' });
  return {
    command: ['mise', 'exec', '--', ...args.map(redact)],
    exit_status: r.status,
    status: r.status === 0 ? 'pass' : 'fail',
    evidence: name,
    sha256: sha256(output),
  };
}

export function host() {
  if (process.version !== 'v24.21.0') throw new Error('E1 requires pinned Node 24.21.0');
  const sql = new DatabaseSync(':memory:');
  try {
    const sqlite = sql.prepare('SELECT sqlite_version() AS version').get()!.version;
    return {
      kind: 'Node real SQLite',
      platform: platform(),
      arch: arch(),
      os_release: release(),
      node: process.version,
      sqlite,
    };
  } finally {
    sql.close();
  }
}

function simulations(
  loaded: ReturnType<typeof admitCandidate>,
  count: number,
  identity: ReturnType<typeof source>,
  out: string,
) {
  const rows: string[] = [];
  for (let seed = 1; seed <= count; seed++) {
    const outcome = simulate(seed, KERNEL, [loaded]);
    if (outcome.failure) {
      const repro = retainFailure(outcome, identity);
      writeFileSync(join(out, 'repro.json'), `${JSON.stringify(repro)}\n`, { flag: 'wx' });
      return {
        status: 'fail',
        generator: GENERATOR,
        seed,
        failed_invariant: outcome.failure,
        repro: 'repro.json',
        repro_sha256: sha256(readFileSync(join(out, 'repro.json'))),
      };
    }
    rows.push(`${seed} ${outcome.digest} ${outcome.commands.length}`);
  }
  const text = `${rows.join('\n')}\n`;
  writeFileSync(join(out, 'sim.log'), text, { flag: 'wx' });
  return {
    status: count >= 10_000 ? 'pass' : 'pending',
    generator: GENERATOR,
    sequences: count,
    first_seed: 1,
    evidence: 'sim.log',
    sha256: sha256(text),
  };
}

function certify(bytes: Uint8Array, output: string, count: number) {
  const loaded = admitCandidate(bytes);
  const policy = loaded.policy;
  const identity = source();
  const hostIdentity = host();
  if (existsSync(output)) throw new Error('output directory exists; preserve prior evidence');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'candidate.json'), loaded.artifact, { flag: 'wx' });
  const receipts = checks(output);
  const compiled = join(output, 'compiled.json');
  let sourceMatches = false;
  try {
    sourceMatches = admitCandidate(readFileSync(compiled)).artifact === loaded.artifact;
  } catch {
    /* Compile log and failed source row retain refusal without dropping the report. */
  }
  const sim =
    receipts.every((r) => r.exit_status === 0) && sourceMatches
      ? simulations(loaded, count, identity, output)
      : { status: 'pending', reason: 'prerequisite check failed' };
  const failed =
    !sourceMatches || receipts.some((r) => r.exit_status !== 0) || sim.status === 'fail';
  if (git('rev-parse', 'HEAD') !== identity.source_sha || git('diff', '--name-only', 'HEAD'))
    throw new Error('source changed during E1 checks; receipt refused');
  const report = reportOf(
    loaded,
    identity,
    hostIdentity,
    policy,
    receipts,
    sim,
    sourceMatches,
    failed,
  );
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx',
  });
  const sums = [
    'candidate.json',
    'report.json',
    ...receipts.map((r) => r.evidence),
    ...['compiled.json', 'sim.log', 'repro.json'].filter((f) => existsSync(join(output, f))),
  ];
  writeFileSync(
    join(output, 'SHA256SUMS'),
    sums.map((f) => `${sha256(readFileSync(join(output, f)))}  ${f}\n`).join(''),
    { flag: 'wx' },
  );
  const verified = spawnSync('shasum', ['-a', '256', '-c', 'SHA256SUMS'], {
    cwd: output,
    encoding: 'utf8',
  });
  writeFileSync(join(output, 'SHA256SUMS.verify'), redact(`${verified.stdout}${verified.stderr}`), {
    flag: 'wx',
  });
  if (verified.status !== 0) throw new Error('retained evidence hash verification failed');
  process.stdout.write(
    `E1 ${failed ? 'fail' : 'pending'}: report.json; full certification requires content coverage and independent review\n`,
  );
  return failed ? 1 : 2;
}

function checks(out: string) {
  return [
    run(out, 'toolchain.log', [
      'elixir',
      '-e',
      'otp = File.read!(Path.join([to_string(:code.root_dir()), "releases", to_string(:erlang.system_info(:otp_release)), "OTP_VERSION"])) |> String.trim(); IO.puts("Elixir #{System.version()} / OTP #{otp}"); if System.version() != "1.20.4" or otp != "28.4", do: System.halt(1)',
    ]),
    run(out, 'compile.log', [
      'mix',
      'loka.compile',
      'cartridges/ashmere_missing_child',
      join(out, 'compiled.json'),
    ]),
    run(out, 'foundation-compiler.log', [
      'mix',
      'test',
      'test/loka/core',
      'test/loka/content_missing_child_test.exs',
    ]),
    run(out, 'kernel.log', [
      'node',
      '--test',
      '--test-reporter=dot',
      'kernel/ts/test/**/*.test.ts',
    ]),
    run(out, 'sqlite.log', [
      'node',
      '--test',
      '--test-reporter=dot',
      'mobile/authority/local-story/*.test.ts',
    ]),
  ];
}

function reportOf(
  loaded: ReturnType<typeof admitCandidate>,
  identity: ReturnType<typeof source>,
  hostIdentity: ReturnType<typeof host>,
  policy: ReturnType<typeof applicability>,
  receipts: Receipt[],
  sim: object,
  sourceMatches: boolean,
  failed: boolean,
) {
  return {
    format: 'loka-e1-report-v1',
    status: failed ? 'fail' : 'pending',
    certification_verdict: null,
    candidate: {
      ...CANDIDATE,
      artifact_sha256: sha256(loaded.artifact),
      lock_sha256: sha256(encode(loaded.cartridge.lock as never)),
    },
    ...identity,
    protocol_tree: git('rev-parse', 'HEAD:protocol'),
    schema_sha256: sha256(read('protocol/cartridge.schema.json')),
    toolchain_sha256: sha256(read('mise.toml')),
    host: hostIdentity,
    deployment: { status: 'not_applicable', reason: 'bundled private Story candidate' },
    source_artifact: { status: sourceMatches ? 'pass' : 'fail' },
    receipts,
    simulation: sim,
    applicability: policy,
    pending: [
      {
        gate: 'PATH_COVERAGE',
        reason:
          'controlled candidate receipts must bind every inventoried command, outcome, choice, consequence and beat; suite success alone does not prove coverage',
      },
      {
        gate: 'INDEPENDENT_REVIEW',
        reason: 'PM assigns fresh review after final published A-D plus fixes candidate',
      },
      { gate: 'BROWSER_HUMAN', reason: 'E2/E3 interaction and complete-content browser receipts' },
      {
        gate: 'NATIVE',
        reason: 'mobile pause; Node does not prove ARM/Hermes or native lifecycle',
      },
    ],
  };
}

function main() {
  const [artifact, output, mode = '10000'] = process.argv.slice(2);
  if (!artifact || !output)
    throw new Error('usage: e1.ts artifact.json new-output-dir [sequences|repro.json]');
  const bytes = readFileSync(artifact);
  if (!/^\d+$/.test(mode)) {
    const observed = reproduce(JSON.parse(readFileSync(mode, 'utf8')), bytes, source());
    process.stdout.write(`reproduced invariant: ${observed.id}\n`);
    return 0;
  }
  const count = Number(mode);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('invalid sequence count');
  return certify(bytes, resolve(output), count);
}
if (import.meta.main) {
  try {
    process.exitCode = main();
  } catch (e) {
    process.stderr.write(`${redact(String(e))}\n`);
    process.exitCode = 1;
  }
}
