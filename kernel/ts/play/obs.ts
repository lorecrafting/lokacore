// Observation records for `loka play` (ADR-075): the kernel version, validated canonical
// JSON lines, the store files under tmp/obs/, and redaction of diagnostics (§6).
import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, hostname, tmpdir, userInfo } from 'node:os';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { KERNEL_ID } from '../src/index.ts';
import { normalize } from '../src/commands/target.ts';
import { validate } from '../src/foundation/validate.ts';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** KERNEL_ID@<commit>, with -dirty when the tree has uncommitted changes (never HEAD then). */
export function kernelVersion(): string {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();
  const dirty = git('status', '--porcelain') !== '';
  return `${KERNEL_ID}@${git('rev-parse', 'HEAD')}${dirty ? '-dirty' : ''}`;
}

/** The record as one canonical JSON line; a record that is not an ObservationRecord throws. */
export function line(record: unknown): string {
  const errors = validate('ObservationRecord', record);
  if (errors.length) throw new Error(`invalid observation record: ${JSON.stringify(errors)}`);
  return `${encode(record as Json)}\n`;
}

/**
 * Appends lines to <obs>/<store>/<name>.jsonl, or replaces the file with flag 'w'; returns its
 * path relative to the repository. <obs> is LOKA_OBS_DIR when set (a test's own directory), else
 * tmp/obs.
 */
export function append(store: string, name: string, text: string, flag = 'a'): string {
  const dir = `${process.env.LOKA_OBS_DIR ?? `${ROOT}tmp/obs`}/${store}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.jsonl`, text, { flag });
  return relative(ROOT, `${dir}/${name}.jsonl`);
}

// Host identifiers no record may carry (AGENTS.md; ADR-075 §6), longest first so a path is
// replaced before its prefix. ponytail: a device serial is caught only when the host names it
// (ANDROID_SERIAL); add the iOS and adb sources when a device host runs this.
const secrets = [
  ROOT.replace(/\/$/, ''),
  process.cwd(),
  homedir(),
  tmpdir(),
  realpathSync(tmpdir()),
  hostname(),
  userInfo().username,
  process.env.ANDROID_SERIAL ?? '',
]
  .filter((s) => s.length > 3)
  .sort((a, b) => b.length - a.length);
const HOME_PATH = /\/(Users|home|private\/var|var\/folders)\/[^\s"\]]*/g;

/** Every string in the value with host paths and identifiers replaced by <redacted>. */
export function redact<T extends Json>(value: T): T {
  if (typeof value === 'string') {
    const s = secrets.reduce((acc, x) => acc.replaceAll(x, '<redacted>'), value as string);
    return s.replace(HOME_PATH, '<redacted>') as T;
  }
  if (Array.isArray(value)) return value.map(redact) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)])) as T;
  return value;
}

/**
 * A lookup's normalized words for a target.unresolved record, at most 16: each a word of
 * lowercase letters and digits (at most 32), or redacted when it holds a host identifier (in
 * any case) or anything else (ADR-075 §6, as amended in R5 S2). Redacted before the record is
 * built, never recorded as an empty string.
 */
export function lookupWords(text: string) {
  // Every letters-and-digits piece of a host identifier (user name, hostname labels, serial):
  // a word can hold only those, and a path's pieces (`home`, `users`) are ordinary words.
  const pieces = [hostname(), userInfo().username, process.env.ANDROID_SERIAL ?? '']
    .flatMap((x) => x.toLowerCase().split(/[^a-z0-9]+/))
    .filter((x) => x.length > 3);
  const hidden = (w: string) => pieces.some((x) => w.includes(x));
  return normalize(text)
    .slice(0, 16)
    .map((word) =>
      /^[a-z0-9]{1,32}$/.test(word) && !hidden(word)
        ? { kind: 'word', word }
        : { kind: 'redacted' },
    );
}
