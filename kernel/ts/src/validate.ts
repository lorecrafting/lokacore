// Validates JSON values against the generated contracts (spec 04 §12). Twin of
// lib/loka/core/contracts.ex: same schema subset, same JSON-pointer paths, same codes.
// Values must come from canonical.ts `decode` (the frozen numeric profile), which rejects
// floats, exponents, duplicate keys and lone surrogates; JSON.parse loses that information.
import { DEFS, type ErrorCode } from './contracts.gen.ts';

export interface ContractError {
  path: string;
  code: ErrorCode;
}

interface Schema {
  [keyword: string]: unknown;
  properties?: Record<string, Schema>;
  oneOf?: Schema[];
}

type Value = unknown;
type Obj = Record<string, Value>;

type Defs = Record<string, Schema>;

const isObj = (v: Value): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const err = (path: string, code: ErrorCode): ContractError[] => [{ path, code }];
const check = (ok: boolean, path: string, code: ErrorCode) => (ok ? [] : err(path, code));
const child = (path: string, key: string | number) =>
  `${path}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
const codePoints = (s: string) => [...s].length;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const types: Record<string, (v: Value) => boolean> = {
  object: isObj,
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  integer: (v) => Number.isSafeInteger(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
};

/**
 * Every error sorted by path then code; empty when `value` satisfies `contract`. `defs`
 * defaults to the protocol/ contracts.
 */
export function validate(contract: string, value: Value, defs = DEFS as Defs): ContractError[] {
  const found = Object.hasOwn(defs, contract) ? errors(defs[contract], value, '', defs) : err('', 'unknown_contract');
  return found.sort((a, b) => cmp(a.path, b.path) || cmp(a.code, b.code));
}

function errors(s: Schema, v: Value, path: string, defs: Defs): ContractError[] {
  if (typeof s.type === 'string' && !types[s.type](v)) return err(path, 'invalid_type');
  if (s.oneOf && !isObj(v)) return err(path, 'invalid_type');
  return Object.entries(s).flatMap(([k, arg]) => keyword(k, arg, v, path, defs));
}

// Each case sees a value that `errors` already type-checked.
function keyword(k: string, arg: any, v: any, path: string, defs: Defs): ContractError[] {
  switch (k) {
    case '$ref': return errors(defs[arg], v, path, defs);
    case 'enum': return check(arg.some((e: Value) => e === v), path, 'not_in_enum');
    case 'const': return check(arg === v, path, 'const_mismatch');
    case 'minimum': return check(v >= arg, path, 'below_minimum');
    case 'maximum': return check(v <= arg, path, 'above_maximum');
    case 'minLength': return check(codePoints(v) >= arg, path, 'too_short');
    case 'maxLength': return check(codePoints(v) <= arg, path, 'too_long');
    case 'minItems': return check(v.length >= arg, path, 'too_few_items');
    case 'maxItems': return check(v.length <= arg, path, 'too_many_items');
    // ponytail: recompiles the pattern on every call; cache per contract if it shows up in profiles.
    case 'pattern': return check(new RegExp(arg, 'u').test(v), path, 'pattern_mismatch');
    case 'items': return (v as Value[]).flatMap((x, i) => errors(arg, x, child(path, i), defs));
    // additionalProperties is always false (the subset), so undeclared keys are errors here.
    case 'properties':
      return Object.keys(v).flatMap((key) =>
        Object.hasOwn(arg, key) ? errors(arg[key], v[key], child(path, key), defs) : err(child(path, key), 'unknown_property'),
      );
    case 'required':
      return (arg as string[]).flatMap((key) => (Object.hasOwn(v, key) ? [] : err(child(path, key), 'missing_property')));
    case 'oneOf': return oneOf(arg, v, path, defs);
    default: return [];
  }
}

function oneOf(branches: Schema[], v: Obj, path: string, defs: Defs): ContractError[] {
  const first = branches[0].properties!;
  const d = Object.keys(first).find((key) => 'const' in first[key])!;
  if (!Object.hasOwn(v, d)) return err(child(path, d), 'missing_property');
  const branch = branches.find((b) => b.properties![d].const === v[d]);
  return branch ? errors(branch, v, path, defs) : err(child(path, d), 'unknown_variant');
}
