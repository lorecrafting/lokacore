// Cartridge artifact loader (05 §11, §20; CAR-05, CAR-07): artifact bytes and the installed
// kernel/app → the decoded cartridge and its hash, or the one diagnostic of the first failing
// stage. Stage order, codes, paths and data: protocol/cartridge.schema.json DiagnosticCode.
import { decode, encode, hash, type Json } from './canonical.ts';
import {
  ARTIFACT_MAX_BYTES,
  CAPABILITY_OWNERS,
  type CompiledCartridge,
  type Diagnostic,
} from './contracts.gen.ts';
import {
  diag,
  isObj,
  nodes,
  parts,
  refStage,
  step,
  type Data,
  type Obj,
} from './cartridge_refs.ts';
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
  for (const map of ['facts', 'policies', 'actions', 'rooms', 'npcs', 'items', 'recipes']) {
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

// The lock equals requires.capabilities, every command is owned, and every command, policy op,
// definition kind (room, detail, NPC, item, variant, recipe) and recipe step (by the event it
// produces: fact_changed for fact.assign, custom_event for event.emit) the cartridge uses has
// its owner in the lock.
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
  const use = (kind: 'command' | 'policy' | 'definition' | 'event', name: string, path: string) => {
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
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj)) {
    const at = `.cartridge.recipes${step(ref)}`;
    use('definition', 'recipe', at);
    r.outcomes.success.sequence.forEach((s: Obj, i: number) =>
      use('event', STEP_EVENT[s.op], `${at}.outcomes.success.sequence[${i}].op`),
    );
  }
  return out;
}

const STEP_EVENT: Readonly<Record<string, string>> = {
  'fact.assign': 'fact_changed',
  'event.emit': 'custom_event',
};

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
