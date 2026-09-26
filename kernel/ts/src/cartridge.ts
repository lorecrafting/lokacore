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
import { fromUtf8 } from './sha256.ts';
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

// Each room, detail and description variant (v2), with its kind (registry definitions) and path.
function parts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (kind: string, d: Obj, at: string) => {
    out.push([kind, d, at]);
    (d.variants ?? []).forEach((v: Obj, i: number) =>
      out.push(['variant', v, `${at}.variants[${i}]`]),
    );
  };
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add('room', r, `.cartridge.rooms${step(ref)}`);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add('detail', d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  return out;
}

// Each node, with its path, of every action's, named policy's and variant's condition.
function nodes(c: Obj): [Obj, string][] {
  const walk = (p: Obj, at: string): [Obj, string][] => [
    [p, at],
    ...(p.op === 'not' ? walk(p.item, `${at}.item`) : []),
    ...(p.items ?? []).flatMap((x: Obj, i: number) => walk(x, `${at}.items[${i}]`)),
  ];
  return [
    ...Object.entries(c.actions as Obj).flatMap(([ref, a]) =>
      walk(a.policy.root, `.cartridge.actions${step(ref)}.policy.root`),
    ),
    ...Object.entries(c.policies as Obj).flatMap(([ref, p]) =>
      walk(p.root, `.cartridge.policies${step(ref)}.root`),
    ),
    ...parts(c).flatMap(([k, v, at]) =>
      k === 'variant' ? walk(v.when.root, `${at}.when.root`) : [],
    ),
  ];
}

// The lock equals requires.capabilities, every command is owned, and every command, policy op
// and definition kind (room, detail, variant) the cartridge uses has its owner in the lock.
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
  for (const [ref, a] of Object.entries(c.actions as Obj))
    use('command', a.command, `.cartridge.actions${step(ref)}.command`);
  for (const [n, at] of nodes(c)) use('policy', n.op, `${at}.op`);
  for (const [kind, , at] of parts(c)) use('definition', kind, at);
  return out;
}

// v2: the entry and every exit name a room of this cartridge, every text key a room, a detail,
// a variant or an action uses has a catalog entry, every fact_compare names a fact of this
// cartridge (the kernel reads it), and every detail's first alias is its own and typable.
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
    for (const [dir, exit] of Object.entries(r.exits as Obj))
      room(exit.to, `${at}.exits.${dir}.to`);
    const details: Obj = r.details ?? {};
    for (const [key, d] of Object.entries(details)) {
      const others = Object.entries(details).flatMap(([k, o]) => (k === key ? [] : o.aliases));
      const [first, ...words] = d.aliases[0].split('_');
      const typable = ![first, ...words].includes('') && !['at', 'the', 'a', 'an'].includes(first);
      if (!typable || others.includes(d.aliases[0]))
        out.push(diag('UNREACHABLE_DETAIL', `${at}.details.${key}`));
    }
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  for (const [kind, d, at] of parts(c))
    text(d, kind === 'room' ? ['title', 'description'] : ['description'], at);
  for (const [n, at] of nodes(c))
    if (n.op === 'fact_compare' && !Object.hasOwn(c.facts, refString(n.fact)))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.fact`, { target: refString(n.fact) }));
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
  // One private world: a fact is read at its one scope, player or instance (fact.ts).
  for (const [ref, f] of Object.entries(c.facts as Obj))
    if (new Set(f.scopes).size !== 1 || !['player', 'instance'].includes(f.scopes[0]))
      out.push(diag('FACT_SCOPE_UNSUPPORTED', `.cartridge.facts${step(ref)}.scopes`));
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
