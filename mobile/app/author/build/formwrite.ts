// The generic form's state and writes (form.tsx draws): the file at its read hash, the blocks open,
// each typed draft, and each gesture's `/change` ops (mapedit.ts `change`).
import type { ReactNode } from 'react';
import type { Blocked } from '../../../../kernel/ts/play/allowed.ts';
import type { Defs } from '../../../../kernel/ts/play/generic.ts';
import { reveal } from './reveal.ts';
import { known } from './room.tsx';
import { ed, run } from './roomedit.tsx';

export type Obj = Record<string, unknown>;
export type Step = string | number;
export type Write = Parameters<typeof ed.change>[number];
export type Ops = Write[2]; // mutate-skip: a type, erased at run time
/** Add mechanic…'s fields the cartridge takes, and those it refuses with any turn-on write (`turnOn`). */
export type Mechanics = { allowed: string[]; blocked: (Blocked & { on?: Write })[] };
/** The file drawn and the hash it was read at, its schema's `$defs`, the definitions entered so far,
 * a root field's least value and the root fields a block draws instead (combat.tsx, schedule.tsx). */
export type At = {
  file: string;
  was: string;
  defs: Defs;
  seen: string[];
  seed?: (f: string) => unknown;
  mech?: Mechanics;
  claim?: (f: string) => Block | undefined;
  gate?: (ops: Ops) => string | undefined; // a write's refusal before it is sent (generic.tsx)
  pair?: (ops: Ops) => Ops; // a write with the ops it brings along (generic.tsx: an action's check and failure)
  kind?: string; // the file's dir, which the Rules block offers branches by (rules.tsx)
};
export const opened = new Set<string>(); // the folded blocks and Add… menus open, by file and path
export const drafts = new Map<string, string>(); // each typed field, as typed
export const id = (at: At, path: Step[]) => `${at.file}:${JSON.stringify(path)}`;
export const toggle = (key: string) => (
  opened.has(key) ? opened.delete(key) : opened.add(key),
  known.redraw()
);
export const set = (at: At, path: Step[], value: unknown) =>
  value === undefined
    ? (reveal(id(at, path), true), known.redraw())
    : send(at, ops(path, value), () => reveal(id(at, path), false));
/** `o` with the ops it brings along (`At.pair`). */
export const own = (at: At, o: Ops) => at.pair?.(o) ?? o;
/** One `/change` of `o` to the file, unless the gate refuses it: then the refusal shows, nothing sent. */
export const send = (at: At, o: Ops, then = () => {}) => {
  const w = own(at, o);
  void run(async () => at.gate?.(w) ?? ed.change([at.file, at.was, w]).then(then));
};
/** A write at `path`; at the root (a picked branch, a whole list) one op per top-level field. */
export const ops = (path: Step[], value: unknown) =>
  path.length
    ? [{ path, value }]
    : Array.isArray(value)
      ? value.map((v, i) => ({ path: [i], value: v }))
      : Object.entries(value as Obj).map(([k, v]) => ({ path: [k], value: v }));
export const drop = (at: At, path: Step[], value: unknown) =>
  value === undefined // only revealed: nothing on disk to delete
    ? (reveal(id(at, path), false), known.redraw())
    : send(at, [{ path, delete: true }]);
/** A root field's block: its name, Remove when it may go, and its value (form.tsx `block`). */
export type Block = (
  at: At,
  path: Step[],
  node: Obj | undefined,
  value: unknown,
  removable: boolean,
) => ReactNode;
