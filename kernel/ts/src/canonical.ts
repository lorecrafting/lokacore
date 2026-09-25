// Strict JSON parser, canonical encoder and hash for the portable profile
// (docs/spec/conformance/numeric-profile.md). Both directions are linear: literal runs are
// copied with one slice and output is joined once. Objects are null-prototype so keys such
// as "__proto__" stay ordinary data.
import { KernelError } from './error.ts';
import { sha256Hex, utf8 } from './sha256.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const SAFE = 9007199254740991;
/** Deepest container nesting the profile allows; one more is invalid_json / invalid_canonical. */
export const MAX_DEPTH = 128;

const invalid = (): never => {
  throw new KernelError('invalid_json');
};

const isSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdfff;
const isHigh = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff;
const NON_ASCII = /[^\u0000-\u007f]/;

/**
 * Parses JSON text. Rejects duplicate or non-ASCII keys, fractions, exponents, NaN and
 * Infinity, integers outside the safe range, lone surrogates, nesting deeper than
 * MAX_DEPTH and trailing data. `-0` parses as 0. Throws KernelError('invalid_json').
 */
export function decode(text: string): Json {
  if (typeof text !== 'string') invalid();
  const p: Parser = { s: text, i: 0 };
  const v = value(p, 0);
  ws(p);
  if (p.i !== text.length) invalid();
  return v;
}

// Cursor over the text.
type Parser = { s: string; i: number };

function ws(p: Parser): void {
  for (let c = p.s[p.i]; c === ' ' || c === '\t' || c === '\n' || c === '\r'; c = p.s[++p.i]);
}

// `depth` counts the containers already open around the value.
function value(p: Parser, depth: number): Json {
  ws(p);
  const c = p.s[p.i];
  if ((c === '{' || c === '[') && depth === MAX_DEPTH) invalid();
  if (c === '{') return object(p, depth + 1);
  if (c === '[') return array(p, depth + 1);
  if (c === '"') return string(p);
  for (const [word, v] of LITERALS) {
    if (p.s.startsWith(word, p.i)) {
      p.i += word.length;
      return v;
    }
  }
  return number(p);
}

// Both containers: `{` or `[` at p.i, then members until `close`.
function members(p: Parser, close: string, member: () => void): void {
  p.i++;
  ws(p);
  if (p.s[p.i] === close) {
    p.i++;
    return;
  }
  for (;;) {
    member();
    ws(p);
    const c = p.s[p.i++];
    if (c === close) return;
    if (c !== ',') invalid();
  }
}

function object(p: Parser, depth: number): Json {
  const o: { [key: string]: Json } = Object.create(null);
  members(p, '}', () => {
    ws(p);
    if (p.s[p.i] !== '"') invalid();
    const k = string(p); // duplicates are detected after escape decoding
    if (NON_ASCII.test(k) || Object.hasOwn(o, k)) invalid();
    ws(p);
    if (p.s[p.i++] !== ':') invalid();
    o[k] = value(p, depth);
  });
  return o;
}

function array(p: Parser, depth: number): Json {
  const a: Json[] = [];
  members(p, ']', () => a.push(value(p, depth)));
  return a;
}

// Literal runs are copied with one slice at the next escape or the closing quote.
function string(p: Parser): string {
  const parts: string[] = [];
  let run = ++p.i;
  for (;;) {
    const c = p.s.charCodeAt(p.i);
    if (c === 0x22) break;
    if (!(c >= 0x20)) invalid(); // controls, and NaN past the end
    if (c === 0x5c) {
      parts.push(p.s.slice(run, p.i), escape(p));
      run = p.i;
    } else if (isSurrogate(c)) {
      if (!isHigh(c) || !isLow(p.s.charCodeAt(p.i + 1))) invalid();
      p.i += 2;
    } else p.i++;
  }
  parts.push(p.s.slice(run, p.i++));
  return parts.join('');
}

const ESCAPES: { [e: string]: string } = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

// `\` at p.i; returns the decoded character(s) and leaves p.i after the escape.
function escape(p: Parser): string {
  const e = p.s[p.i + 1];
  p.i += 2;
  if (e !== 'u') return Object.hasOwn(ESCAPES, e) ? ESCAPES[e] : invalid();
  const hi = hex4(p);
  if (isHigh(hi) && p.s.startsWith('\\u', p.i)) {
    p.i += 2;
    const lo = hex4(p);
    return isLow(lo) ? String.fromCharCode(hi, lo) : invalid();
  }
  return isSurrogate(hi) ? invalid() : String.fromCharCode(hi);
}

function hex4(p: Parser): number {
  const h = p.s.slice(p.i, (p.i += 4));
  return /^[0-9a-fA-F]{4}$/.test(h) ? parseInt(h, 16) : invalid();
}

// A fraction or exponent is left as trailing data, which every caller rejects. Above
// 2^53 - 1 the double may round, but only to a value that is still out of range.
function number(p: Parser): number {
  const start = p.i;
  if (p.s[p.i] === '-') p.i++;
  if (p.s[p.i] === '0') p.i++;
  else if (p.s[p.i] >= '1' && p.s[p.i] <= '9') while (p.s[p.i] >= '0' && p.s[p.i] <= '9') p.i++;
  else invalid();
  const n = Number(p.s.slice(start, p.i));
  return Math.abs(n) <= SAFE ? n + 0 : invalid(); // -0 becomes 0
}

const LITERALS: [string, Json][] = [
  ['true', true],
  ['false', false],
  ['null', null],
];

/** Canonical text: sorted keys, no whitespace. Throws KernelError('invalid_canonical') outside the profile. */
export function encode(value: Json): string {
  const out: string[] = [];
  write(value, out, 0);
  return out.join('');
}

/** Lowercase hex SHA-256 of the canonical encoding's UTF-8 bytes. */
export function hash(value: Json): string {
  return sha256Hex(utf8(encode(value)));
}

const notCanonical = (): never => {
  throw new KernelError('invalid_canonical');
};

function write(v: Json, out: string[], depth: number): void {
  if (v === null || v === true || v === false) out.push(String(v));
  else if (typeof v === 'number') {
    if (!Number.isInteger(v) || Math.abs(v) > SAFE) notCanonical();
    out.push(String(v + 0));
  } else if (typeof v === 'string') quote(v, out);
  else if (typeof v !== 'object' || depth === MAX_DEPTH) notCanonical();
  else if (Array.isArray(v)) {
    out.push('[');
    for (let n = 0; n < v.length; n++) {
      if (n) out.push(',');
      write(v[n], out, depth + 1);
    }
    out.push(']');
  } else {
    // ASCII keys only, so the default UTF-16 sort is ordinal order.
    const keys = Object.keys(v).sort();
    out.push('{');
    for (let n = 0; n < keys.length; n++) {
      if (NON_ASCII.test(keys[n])) notCanonical();
      if (n) out.push(',');
      quote(keys[n], out);
      out.push(':');
      write(v[keys[n]], out, depth + 1);
    }
    out.push('}');
  }
}

const SHORT: { [c: number]: string } = {
  0x22: '\\"',
  0x5c: '\\\\',
  0x08: '\\b',
  0x09: '\\t',
  0x0a: '\\n',
  0x0c: '\\f',
  0x0d: '\\r',
};

function quote(s: string, out: string[]): void {
  out.push('"');
  let run = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x22 || c === 0x5c) {
      out.push(s.slice(run, i), SHORT[c] ?? '\\u00' + c.toString(16).padStart(2, '0'));
      run = i + 1;
    } else if (isSurrogate(c)) {
      if (!isHigh(c) || !isLow(s.charCodeAt(i + 1))) notCanonical();
      i++;
    }
  }
  out.push(s.slice(run), '"');
}
