// The editor's edit model (docs/rnd/gui-editor-design-2026-11-04.md §11): path ops on a parsed
// source file, the ops that undo them, and the kind schema's verdict on the result. Pure and
// browser-safe: write.ts applies ops for `POST /change`, the author panel's cards build them.
import Ajv2020 from 'ajv/dist/2020.js';

export type Step = string | number;
/** `{path, value}` sets, `{path, delete: true}` removes; an array index may be one past its end. */
export type Op = { path: Step[]; value?: unknown; delete?: boolean };
type Box = Record<Step, unknown>;

export class Refused extends Error {}
const OWN = new Set<unknown>(['__proto__', 'constructor', 'prototype']); // never a field to set
const no = (why: string): never => {
  throw new Refused(why);
};

/** The object or array an op changes and the step into it; refuses a path that cannot be one. */
function parent(doc: unknown, op: Op): [Box, Step] {
  const path = op?.path;
  const step = (s: unknown) => ['string', 'number'].includes(typeof s) && !OWN.has(s);
  if (!Array.isArray(path) || !path.length || !path.every(step))
    no(`a path is a non-empty array of field names and indexes: ${JSON.stringify(path)}`);
  let at = doc as Box;
  for (const s of path.slice(0, -1)) {
    if (typeof at !== 'object' || at === null) break;
    at = at[s] as Box;
  }
  if (typeof at !== 'object' || at === null)
    no(`a path through a non-object: ${JSON.stringify(path)}`);
  const last = path.at(-1)!;
  // an array step is an index in it, or one past its end to append a value
  const end = Array.isArray(at) && at.length - (op.delete === true ? 1 : 0);
  if (end !== false && !(Number.isInteger(last) && (last as number) >= 0 && last <= end))
    no(`not an index of the array: ${last}`);
  if (op.delete !== true && op.value === undefined) no('an op sets a value or deletes');
  return [at, last];
}

/** Applies one op to `doc` in place. */
export function apply(doc: unknown, op: Op) {
  const [at, last] = parent(doc, op);
  if (op.delete !== true) at[last] = op.value;
  else if (Array.isArray(at)) at.splice(last as number, 1);
  else delete at[last];
}

/** Applies `ops` to `doc` in place, in order, and answers the ops that put it back byte for byte. */
export function change(doc: unknown, ops: Op[]): Op[] {
  const back = ops.map((op) => {
    const [at, last] = parent(doc, op);
    const up = op.path.slice(0, -1);
    const keep = (k: Step): Op => ({ path: [...up, k], value: structuredClone(at[k]) });
    const had = Object.hasOwn(at, last);
    let undo: Op[];
    if (op.delete !== true) undo = [had ? keep(last) : { path: op.path, delete: true }];
    else if (!had) undo = [];
    // an array closes up: every element from the index on is set back, the last one appended
    else if (Array.isArray(at)) undo = at.slice(last as number).map((_, i) => keep(+last + i));
    else {
      // a key re-set lands last, so the keys after it come off and go back on in order
      const keys = Object.keys(at);
      const after = keys.slice(keys.indexOf(String(last)) + 1);
      undo = [
        ...after.map((k) => ({ path: [...up, k], delete: true })),
        keep(last),
        ...after.map(keep),
      ];
    }
    apply(doc, op);
    return undo;
  });
  return back.reverse().flat();
}

/**
 * A checker over `schemas/source` (file name to schema, defs.schema.json included): a kind's file
 * after an edit to the errors, `instancePath message` each, `[]` when it is valid.
 */
export function validator(schemas: Record<string, object>) {
  const ajv = new Ajv2020({ allErrors: true });
  for (const [name, schema] of Object.entries(schemas)) ajv.addSchema(schema, name);
  return (kind: string, doc: unknown): string[] => {
    const valid = ajv.getSchema(`${kind}.schema.json`) ?? no(`no source schema for ${kind}`);
    return valid(doc) ? [] : valid.errors!.map((e) => `${e.instancePath} ${e.message}`);
  };
}
