// Cartridge artifact loader (05 §11, §20; CAR-05, CAR-07): integrity, generated shape, hash, map
// keys, lock and installed host; the first failing stage's first diagnostic, or the cartridge.
import { scopedFacts } from './cartridge_scoped_facts.ts';
import { decode, encode, hash, type Json } from '../foundation/canonical.ts';
import {
  ARTIFACT_MAX_BYTES,
  CAPABILITY_OWNERS,
  type CompiledCartridge,
  type Diagnostic,
} from '../contracts.gen.ts';
import { diag, isObj, refStage, step, type Data, type Obj } from './cartridge_refs.ts';
import { fromUtf8 } from '../foundation/sha256.ts';
import { cmp, validate } from '../foundation/validate.ts';
import { schedules } from './cartridge_schedules.ts';
import { standing } from './cartridge_standing.ts';
import { transports } from './cartridge_transports.ts';
import { services } from './cartridge_services.ts';
import { food } from './cartridge_food.ts';
import { bleed } from './cartridge_bleed.ts';
import { status } from './cartridge_status.ts';
import { liquids } from './cartridge_liquids.ts';
import { population } from './cartridge_population.ts';
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
    () => lockStage(c),
    () => declarations(c),
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

// Loader-only lock checks (no compiler twin; B2 kept them for a PM ruling): every action's
// command is owned and none is run_job (authority-internal, 04 §1; checked as an unowned name),
// and the owners of every action command and resource definition are in the lock.
function lockStage(c: Obj): Diagnostic[] {
  const locked: Obj = c.lock.capabilities;
  const out = lockDiagnostics(locked, c.manifest.requires.capabilities);
  const use = (kind: 'command' | 'definition', name: string, path: string) => {
    const owners = CAPABILITY_OWNERS[kind];
    if (!Object.hasOwn(owners, name)) return void out.push(diag('UNKNOWN_COMMAND', path));
    const [owner] = owners[name].split('@');
    if (!Object.hasOwn(locked, owner))
      out.push(diag('UNDECLARED_CAPABILITY', path, { capability: owner }, [owners[name]]));
  };
  for (const [ref, { command: k }] of Object.entries(c.actions as Obj))
    use('command', k === 'run_job' ? '' : k, `.cartridge.actions${step(ref)}.command`);
  for (const ref of Object.keys((c.resources ?? {}) as Obj))
    use('definition', 'resource', `.cartridge.resources${step(ref)}`);
  return out;
}

// Lock/manifest mismatches and the engine fact dependency of position and scene.
function lockDiagnostics(locked: Obj, required: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const key of new Set([...Object.keys(locked), ...Object.keys(required)])) {
    if (locked[key] === required[key]) continue;
    const data: Data = { capability: key };
    if (Object.hasOwn(required, key)) data.required = required[key];
    if (Object.hasOwn(locked, key)) data.locked = locked[key];
    out.push(diag('LOCK_MANIFEST_MISMATCH', `.cartridge.lock.capabilities${step(key)}`, data));
  }
  for (const capability of ['position', 'scene'])
    if (Object.hasOwn(locked, capability) && locked.fact !== 1)
      out.push(
        diag(
          'UNDECLARED_CAPABILITY',
          `.cartridge.lock.capabilities.${capability}`,
          {
            capability: 'fact',
          },
          ['fact@1'],
        ),
      );
  return out;
}

function declarations(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [...refStage(c)];
  // -- B2
  out.push(...schedules(c));
  // -- D1
  out.push(...liquids(c));
  out.push(...food(c));
  out.push(...bleed(c));
  out.push(...status(c));
  out.push(...population(c));
  out.push(...transports(c));
  // -- D2
  out.push(...services(c));
  out.push(...scopedFacts(c));
  out.push(...standing(c));
  return out;
}
