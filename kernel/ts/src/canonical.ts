// Strict JSON parser, canonical encoder and hash for the portable profile
// (docs/spec/conformance/numeric-profile.md). Both directions are linear: literal runs are
// copied with one slice and output is joined once. Objects are null-prototype so keys such
// as "__proto__" stay ordinary data.
import { KernelError } from './error.ts';
import { sha256Hex, utf8 } from './sha256.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const SAFE = 9007199254740991;

const invalid = (): never => {
  throw new KernelError('invalid_json');
};

const isSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdfff;
const isHigh = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff;
const NON_ASCII = /[^\u0000-\u007f]/;

/**
 * Parses JSON text. Rejects duplicate or non-ASCII keys, fractions, exponents, NaN and
 * Infinity, integers outside the safe range, lone surrogates and trailing data. `-0`
 * parses as 0. Throws KernelError('invalid_json').
 */
export function decode(text: string): Json {
  let i = 0;
  const ws = (): void => {
    while (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r') i++;
  };
  const hex4 = (): number => {
    const h = text.slice(i, i + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(h)) invalid();
    i += 4;
    return parseInt(h, 16);
  };
  const string = (): string => {
    i++;
    const parts: string[] = [];
    let run = i;
    for (;;) {
      const c = text.charCodeAt(i);
      if (c === 0x22) break;
      if (!(c >= 0x20)) invalid(); // controls, and NaN past the end
      if (c === 0x5c) {
        parts.push(text.slice(run, i));
        const e = text[i + 1];
        i += 2;
        if (e === '"' || e === '\\' || e === '/') parts.push(e);
        else if (e === 'b') parts.push('\b');
        else if (e === 'f') parts.push('\f');
        else if (e === 'n') parts.push('\n');
        else if (e === 'r') parts.push('\r');
        else if (e === 't') parts.push('\t');
        else if (e === 'u') {
          const hi = hex4();
          if (isHigh(hi) && text[i] === '\\' && text[i + 1] === 'u') {
            i += 2;
            const lo = hex4();
            if (!isLow(lo)) invalid();
            parts.push(String.fromCharCode(hi, lo));
          } else if (isSurrogate(hi)) invalid();
          else parts.push(String.fromCharCode(hi));
        } else invalid();
        run = i;
      } else if (isSurrogate(c)) {
        if (!isHigh(c) || !isLow(text.charCodeAt(i + 1))) invalid();
        i += 2;
      } else i++;
    }
    parts.push(text.slice(run, i));
    i++;
    return parts.join('');
  };
  const number = (): number => {
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else if (text[i] >= '1' && text[i] <= '9') while (text[i] >= '0' && text[i] <= '9') i++;
    else invalid();
    // A fraction or exponent is left as trailing data, which every caller rejects. Above
    // 2^53 - 1 the double may round, but only to a value that is still out of range.
    const n = Number(text.slice(start, i));
    if (Math.abs(n) > SAFE) invalid();
    return n + 0; // -0 becomes 0
  };
  const value = (): Json => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const o: { [key: string]: Json } = Object.create(null);
      ws();
      if (text[i] === '}') {
        i++;
        return o;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') invalid();
        const k = string();
        if (NON_ASCII.test(k) || Object.hasOwn(o, k)) invalid();
        ws();
        if (text[i] !== ':') invalid();
        i++;
        o[k] = value();
        ws();
        if (text[i++] === '}') return o;
        if (text[i - 1] !== ',') invalid();
      }
    }
    if (c === '[') {
      i++;
      const a: Json[] = [];
      ws();
      if (text[i] === ']') {
        i++;
        return a;
      }
      for (;;) {
        a.push(value());
        ws();
        if (text[i++] === ']') return a;
        if (text[i - 1] !== ',') invalid();
      }
    }
    if (c === '"') return string();
    for (const [word, v] of LITERALS) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return v;
      }
    }
    return number();
  };
  try {
    const v = value();
    ws();
    if (i !== text.length) invalid();
    return v;
  } catch (e) {
    if (e instanceof RangeError) invalid(); // stack exhaustion on absurd nesting
    throw e;
  }
}

const LITERALS: [string, Json][] = [
  ['true', true],
  ['false', false],
  ['null', null],
];

/** Canonical text: sorted keys, no whitespace. Throws KernelError('invalid_canonical') outside the profile. */
export function encode(value: Json): string {
  const out: string[] = [];
  write(value, out);
  return out.join('');
}

/** Lowercase hex SHA-256 of the canonical encoding's UTF-8 bytes. */
export function hash(value: Json): string {
  return sha256Hex(utf8(encode(value)));
}

const notCanonical = (): never => {
  throw new KernelError('invalid_canonical');
};

function write(v: Json, out: string[]): void {
  if (v === null || v === true || v === false) out.push(String(v));
  else if (typeof v === 'number') {
    if (!Number.isInteger(v) || Math.abs(v) > SAFE) notCanonical();
    out.push(String(v + 0));
  } else if (typeof v === 'string') quote(v, out);
  else if (Array.isArray(v)) {
    out.push('[');
    v.forEach((x, n) => {
      if (n) out.push(',');
      write(x, out);
    });
    out.push(']');
  } else if (typeof v === 'object') {
    // ASCII keys only, so the default UTF-16 sort is ordinal order.
    const keys = Object.keys(v).sort();
    out.push('{');
    keys.forEach((k, n) => {
      if (NON_ASCII.test(k)) notCanonical();
      if (n) out.push(',');
      quote(k, out);
      out.push(':');
      write(v[k], out);
    });
    out.push('}');
  } else notCanonical();
}

const SHORT: { [c: number]: string } = { 0x22: '\\"', 0x5c: '\\\\', 0x08: '\\b', 0x09: '\\t', 0x0a: '\\n', 0x0c: '\\f', 0x0d: '\\r' };

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
