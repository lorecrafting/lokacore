// Validates JSON values against the generated contracts (spec 04 §12). Twin of
// lib/loka/core/contracts.ex: same schema subset, same JSON-pointer paths, same codes.
// Values must come from canonical.ts `decode` (the frozen numeric profile), which rejects
// floats, exponents, duplicate keys and lone surrogates (JSON.parse loses that information)
// and nesting over 128, which bounds recursion through a recursive $ref.
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
// Code-point order, which is Elixir's UTF-8 byte order; `<` compares UTF-16 code units.
function cmp(a: string, b: string): number {
  const [x, y] = [[...a], [...b]];
  for (let i = 0; i < Math.min(x.length, y.length); i++)
    if (x[i] !== y[i]) return x[i].codePointAt(0)! - y[i].codePointAt(0)!;
  return x.length - y.length;
}

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
  const found = Object.hasOwn(defs, contract)
    ? errors(defs[contract], value, '', defs)
    : err('', 'unknown_contract');
  return found.sort((a, b) => cmp(a.path, b.path) || cmp(a.code, b.code));
}

function errors(s: Schema, v: Value, path: string, defs: Defs): ContractError[] {
  if (typeof s.type === 'string' && !types[s.type](v)) return err(path, 'invalid_type');
  if (s.oneOf && !isObj(v)) return err(path, 'invalid_type');
  return Object.entries(s).flatMap(([k, arg]) => keyword(k, arg, v, path, defs));
}

// Keywords that test the value against their argument: [holds, code]. Each sees a value that
// `errors` already type-checked.
const tests: Record<string, [(v: any, arg: any) => boolean, ErrorCode]> = {
  enum: [(v, arg) => arg.some((e: Value) => e === v), 'not_in_enum'],
  const: [(v, arg) => arg === v, 'const_mismatch'],
  minimum: [(v, arg) => v >= arg, 'below_minimum'],
  maximum: [(v, arg) => v <= arg, 'above_maximum'],
  minLength: [(v, arg) => codePoints(v) >= arg, 'too_short'],
  maxLength: [(v, arg) => codePoints(v) <= arg, 'too_long'],
  minItems: [(v, arg) => v.length >= arg, 'too_few_items'],
  maxItems: [(v, arg) => v.length <= arg, 'too_many_items'],
  maxProperties: [(v, arg) => Object.keys(v).length <= arg, 'too_many_properties'],
  // ponytail: recompiles the pattern on every call; cache per contract if it shows up in profiles.
  pattern: [(v, arg) => new RegExp(arg, 'u').test(v), 'pattern_mismatch'],
};

function keyword(k: string, arg: any, v: any, path: string, defs: Defs): ContractError[] {
  if (Object.hasOwn(tests, k)) return check(tests[k][0](v, arg), path, tests[k][1]);
  switch (k) {
    case '$ref':
      return errors(defs[arg], v, path, defs);
    case 'items':
      return (v as Value[]).flatMap((x, i) => errors(arg, x, child(path, i), defs));
    // declared properties imply additionalProperties false (the subset): undeclared keys are errors.
    case 'properties':
      return Object.keys(v).flatMap((key) =>
        Object.hasOwn(arg, key)
          ? errors(arg[key], v[key], child(path, key), defs)
          : err(child(path, key), 'unknown_property'),
      );
    // A map's keys and values (the subset's map form of an object).
    case 'propertyNames':
      return Object.keys(v).flatMap((key) =>
        check(tests.pattern[0](key, arg.pattern), child(path, key), 'pattern_mismatch'),
      );
    case 'additionalProperties':
      return arg === false
        ? []
        : Object.keys(v).flatMap((key) => errors(arg, v[key], child(path, key), defs));
    case 'required':
      return (arg as string[]).flatMap((key) =>
        Object.hasOwn(v, key) ? [] : err(child(path, key), 'missing_property'),
      );
    case 'oneOf':
      return oneOf(arg, v, path, defs);
    default:
      return [];
  }
}

function oneOf(branches: Schema[], v: Obj, path: string, defs: Defs): ContractError[] {
  const first = branches[0].properties!;
  const d = Object.keys(first).find((key) => 'const' in first[key])!;
  if (!Object.hasOwn(v, d)) return err(child(path, d), 'missing_property');
  const branch = branches.find((b) => b.properties![d].const === v[d]);
  return branch ? errors(branch, v, path, defs) : err(child(path, d), 'unknown_variant');
}
