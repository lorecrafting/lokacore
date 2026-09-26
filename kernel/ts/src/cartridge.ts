// Cartridge artifact loader (05 §11, §20; CAR-05, CAR-07): artifact bytes and the installed
// kernel/app → the decoded cartridge and its hash, or the one diagnostic of the first failing
// stage. Stage order, codes, paths and data: protocol/cartridge.schema.json DiagnosticCode.
import { decode, encode, hash, type Json } from './canonical.ts';
import {
  ARTIFACT_MAX_BYTES,
  CAPABILITY_OWNERS,
  type DefinitionRef,
  type CompiledCartridge,
  type Diagnostic,
  type DiagnosticCode,
  type TextKey,
} from './contracts.gen.ts';
import { refString } from './decision.ts';
import { utf8 } from './sha256.ts';
import { cmp, validate } from './validate.ts';

/** What the installed kernel and app implement (05 §3, §6); the host supplies it. */
export interface Installed {
  kernel_api: string;
  capabilities: Readonly<Record<string, readonly number[]>>;
  content_schema: number;
  rule_ir: number;
  client_features: readonly string[];
}

export type LoadResult =
  { ok: true; cartridge: CompiledCartridge; hash: string } | { ok: false; diagnostic: Diagnostic };

type Data = Record<string, string | number>;
type Obj = { [key: string]: any };

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const diag = (
  code: DiagnosticCode,
  path: string,
  data: Data = {},
  suggested: string[] = [],
): Diagnostic => ({
  severity: 'error',
  code,
  path,
  message_key: `diagnostics.${code.toLowerCase()}` as TextKey,
  data,
  suggested_capabilities: suggested,
});

// A member step in the loader path grammar (DiagnosticCode, Diagnostic.path).
const step = (name: string) => (/^[a-z0-9_]+$/.test(name) ? `.${name}` : `[${encode(name)}]`);

// The first diagnostic in list order: path, then code (UTF-8 byte order), then the whole.
const first = (ds: Diagnostic[]): Diagnostic =>
  ds.sort(
    (a, b) =>
      cmp(a.path, b.path) ||
      cmp(a.code, b.code) ||
      cmp(encode(a as unknown as Json), encode(b as unknown as Json)),
  )[0];

export function loadCartridge(bytes: Uint8Array, installed: Installed): LoadResult {
  if (bytes.length > ARTIFACT_MAX_BYTES)
    return fail([
      diag('ARTIFACT_TOO_LARGE', '', { bytes: bytes.length, maximum: ARTIFACT_MAX_BYTES }),
    ]);
  let doc: Json;
  try {
    doc = decode(fromUtf8(bytes));
  } catch {
    return fail([diag('INVALID_JSON', '')]);
  }
  const c = isObj(doc) ? (doc as Obj).cartridge : undefined;
  if (!isObj(c) || !['loka-cartridge-v1', 'loka-cartridge-v2'].includes(c.format))
    return fail([diag('UNKNOWN_FORMAT', '.cartridge.format')]);
  const computed = hash(c);
  const stages = [
    () => schemaStage(doc),
    () =>
      computed === (doc as Obj).content_hash
        ? []
        : [
            diag('CONTENT_HASH_MISMATCH', '.content_hash', {
              declared: (doc as Obj).content_hash,
              computed,
            }),
          ],
    () => keyStage(c),
    () => lockStage(c),
    () => refStage(c),
    () => installedStage(c, installed),
  ];
  for (const stage of stages) {
    const ds = stage();
    if (ds.length) return fail(ds);
  }
  return { ok: true, cartridge: c as CompiledCartridge, hash: computed };
}

const fail = (ds: Diagnostic[]): LoadResult => ({ ok: false, diagnostic: first(ds) });

// UTF-8 → string, strict by round trip: a malformed, overlong, truncated or surrogate
// encoding re-encodes to different bytes (a lone low surrogate re-encodes identically, and
// the canonical decoder rejects it). Throws on a code point above U+10FFFF.
// ponytail: one string per character; decode in chunks if 4 MiB artifacts load slowly on Hermes.
function fromUtf8(b: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < b.length;) {
    const lead = b[i++];
    const n = lead < 0x80 ? 0 : lead < 0xe0 ? 1 : lead < 0xf0 ? 2 : 3;
    let cp = n ? lead & (0x3f >> n) : lead;
    for (let k = 0; k < n; k++) cp = (cp << 6) | (b[i++] & 0x3f);
    parts.push(String.fromCodePoint(cp));
  }
  const s = parts.join('');
  const again = utf8(s);
  if (again.length !== b.length || again.some((x, i) => x !== b[i])) throw new RangeError();
  return s;
}

// JSON-pointer path from the validator → loader path, walking `doc` to tell index from name.
function loaderPath(doc: Json, pointer: string): string {
  let v: any = doc;
  let out = '';
  for (const raw of pointer.split('/').slice(1)) {
    const seg = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    out += Array.isArray(v) ? `[${seg}]` : step(seg);
    v = isObj(v) || Array.isArray(v) ? (v as Obj)[seg] : undefined;
  }
  return out;
}

const schemaStage = (doc: Json) =>
  validate('CartridgeArtifact', doc).map(({ path, code }) =>
    code === 'unknown_property'
      ? diag('UNKNOWN_FIELD', loaderPath(doc, path))
      : diag('SCHEMA_VIOLATION', loaderPath(doc, path), { error: code }),
  );

// Each map key's cartridge_id, cartridge_version and key against the manifest and definition.
// The schema's propertyNames pattern already holds the key's shape and kind.
function keyStage(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const map of ['facts', 'policies', 'actions', 'rooms']) {
    for (const [ref, def] of Object.entries((c[map] ?? {}) as Obj)) {
      const [, id, version, key] = ref.match(/^(.*)@(.*):[a-z]+\/(.*)$/)!;
      const expected: [string, string, unknown][] = [
        ['cartridge_id', id, c.manifest.id],
        ['cartridge_version', version, c.manifest.version],
      ];
      if (map !== 'policies') expected.push(['key', key, def.key]);
      for (const [field, declared, want] of expected)
        if (declared !== want)
          out.push(
            diag('ARTIFACT_DEFINITION_KEY_MISMATCH', `.cartridge.${map}${step(ref)}`, {
              field,
              declared,
              expected: want as string,
            }),
          );
    }
  }
  return out;
}

// The lock equals requires.capabilities, every command is owned, and every command and policy
// op a definition uses has its owning capability's key in the lock.
function lockStage(c: Obj): Diagnostic[] {
  const locked: Obj = c.lock.capabilities;
  const required: Obj = c.manifest.requires.capabilities;
  const out: Diagnostic[] = [];
  for (const key of new Set([...Object.keys(locked), ...Object.keys(required)])) {
    if (locked[key] === required[key]) continue;
    const data: Data = { capability: key };
    if (Object.hasOwn(required, key)) data.required = required[key];
    if (Object.hasOwn(locked, key)) data.locked = locked[key];
    out.push(diag('LOCK_MANIFEST_MISMATCH', `.cartridge.lock.capabilities${step(key)}`, data));
  }
  const use = (kind: 'command' | 'policy' | 'definition', name: string, path: string) => {
    const owners = CAPABILITY_OWNERS[kind];
    // The schema closes policy ops, so only a command can be unowned.
    if (!Object.hasOwn(owners, name)) return void out.push(diag('UNKNOWN_COMMAND', path));
    const [owner] = owners[name].split('@');
    if (!Object.hasOwn(locked, owner))
      out.push(diag('UNDECLARED_CAPABILITY', path, { capability: owner }, [owners[name]]));
  };
  const walk = (p: Obj, path: string) => {
    use('policy', p.op, `${path}.op`);
    if (p.op === 'not') walk(p.item, `${path}.item`); // has_item.item is a DefinitionRef
    (p.items ?? []).forEach((x: Obj, i: number) => walk(x, `${path}.items[${i}]`));
  };
  for (const [ref, a] of Object.entries(c.actions as Obj)) {
    const path = `.cartridge.actions${step(ref)}`;
    use('command', a.command, `${path}.command`);
    walk(a.policy.root, `${path}.policy.root`);
  }
  for (const [ref, p] of Object.entries(c.policies as Obj))
    walk(p.root, `.cartridge.policies${step(ref)}.root`);
  for (const ref of Object.keys(c.rooms ?? {}))
    use('definition', 'room', `.cartridge.rooms${step(ref)}`);
  return out;
}

// v2: the entry and every exit name a room of this cartridge, and every text key a room or an
// action uses has a catalog entry.
function refStage(c: Obj): Diagnostic[] {
  if (c.format !== 'loka-cartridge-v2') return [];
  const { id, version } = c.manifest;
  const out: Diagnostic[] = [];
  const text = (def: Obj, fields: string[], at: string) => {
    for (const field of fields)
      if (!Object.hasOwn(c.text, def[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`, { target: def[field] }));
  };
  const room = (r: Obj, path: string) => {
    const target = refString(r as DefinitionRef);
    const ok = r.cartridge_id === id && r.cartridge_version === version && r.kind === 'room';
    if (!(ok && Object.hasOwn(c.rooms, target)))
      out.push(diag('UNRESOLVED_REFERENCE', path, { target }));
  };
  room(c.entry, '.cartridge.entry');
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    text(r, ['title', 'description'], at);
    for (const [dir, exit] of Object.entries(r.exits as Obj))
      room(exit.to, `${at}.exits.${dir}.to`);
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  return out;
}

// MAJOR.MINOR as digit strings without leading zeros: longer is larger, then lexical.
function apiCmp(a: string, b: string): number {
  const [x, y] = [a.split('.'), b.split('.')];
  for (let i = 0; i < 2; i++) {
    const d = x[i].length - y[i].length || (x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0);
    if (d) return d;
  }
  return 0;
}

function installedStage(c: Obj, installed: Installed): Diagnostic[] {
  const req = c.manifest.requires;
  const out: Diagnostic[] = [];
  for (const [key, v] of Object.entries(c.lock.capabilities as Record<string, number>))
    if (!(Object.hasOwn(installed.capabilities, key) && installed.capabilities[key].includes(v)))
      out.push(
        diag('CAPABILITY_NOT_INSTALLED', `.cartridge.lock.capabilities${step(key)}`, {
          capability: `${key}@${v}`,
        }),
      );
  const api = installed.kernel_api;
  if (apiCmp(api, req.kernel_api.at_least) < 0 || apiCmp(api, req.kernel_api.below) >= 0)
    out.push(
      diag('KERNEL_API_UNSUPPORTED', '.cartridge.manifest.requires.kernel_api', { installed: api }),
    );
  for (const field of ['content_schema', 'rule_ir'] as const)
    if (req[field] !== installed[field])
      out.push(
        diag('PINNED_VERSION_UNSUPPORTED', `.cartridge.manifest.requires.${field}`, {
          field,
          declared: req[field],
          supported: installed[field],
        }),
      );
  (req.client_features as string[]).forEach((feature, i) => {
    if (!installed.client_features.includes(feature))
      out.push(
        diag('CLIENT_FEATURE_UNSUPPORTED', `.cartridge.manifest.requires.client_features[${i}]`, {
          feature,
        }),
      );
  });
  return out;
}
