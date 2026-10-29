// Cartridge artifact loader (05 §11, §20; CAR-05, CAR-07): integrity, generated shape, hash, map
// keys, lock and installed host; the first failing stage's first diagnostic, or the cartridge.
import { decode, encode, hash, type Json } from '../foundation/canonical.ts';
import { ARTIFACT_MAX_BYTES, type CompiledCartridge, type Diagnostic } from '../contracts.gen.ts';
import { diag, isObj, step, type Data, type Obj } from './cartridge_refs.ts';
import { fromUtf8 } from '../foundation/sha256.ts';
import { cmp, validate } from '../foundation/validate.ts';
import { installedStage, type Installed } from './cartridge_installed.ts';
export type { Installed } from './cartridge_installed.ts';

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
    () => lockDiagnostics(c.lock.capabilities, c.manifest.requires.capabilities),
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
const DEFINITION_MAPS = [
  'facts',
  'policies',
  'actions',
  'rooms',
  'npcs',
  'items',
  'recipes',
  'resources',
  'attributes',
  'barriers',
  'quests',
  'reactions',
  'dialogues',
  'story_points',
  'scenes',
  'skills',
  'topics',
  'liquids',
  'services',
  'transports',
  'bleeds',
  'statuses',
  'replenish',
  'blueprints',
];
function keyStage(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const map of DEFINITION_MAPS) {
    for (const [ref, def] of Object.entries((c[map] ?? {}) as Obj)) {
      const [, id, version, key] = ref.match(/^(.*)@(.*):[a-z_]+\/(.*)$/)!;
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

// Lock/manifest mismatches.
function lockDiagnostics(locked: Obj, required: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const key of new Set([...Object.keys(locked), ...Object.keys(required)])) {
    if (locked[key] === required[key]) continue;
    const data: Data = { capability: key };
    if (Object.hasOwn(required, key)) data.required = required[key];
    if (Object.hasOwn(locked, key)) data.locked = locked[key];
    out.push(diag('LOCK_MANIFEST_MISMATCH', `.cartridge.lock.capabilities${step(key)}`, data));
  }
  return out;
}
