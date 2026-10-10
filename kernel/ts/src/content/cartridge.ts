// Cartridge artifact loader (05 §11, §20; CAR-05, CAR-07): artifact bytes and the installed
// kernel/app → the decoded cartridge and its hash, or the one diagnostic of the first failing
import { scopedFacts } from './cartridge_scoped_facts.ts';
import { decode, encode, hash, type Json } from '../foundation/canonical.ts';
import {
  ARTIFACT_MAX_BYTES,
  CAPABILITY_OWNERS,
  type CompiledCartridge,
  type Diagnostic,
} from '../contracts.gen.ts';
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
import { uses as dialogueUses } from './cartridge_dialogues.ts';
import { tipUses as tips } from './cartridge_recipes.ts';
import { scenes } from './cartridge_scenes.ts';
import { uses } from './cartridge_reactions.ts';
import { fromUtf8 } from '../foundation/sha256.ts';
import { cmp, validate } from '../foundation/validate.ts';
import { calendarStage } from './cartridge_calendar.ts';
import { variety } from './cartridge_variety.ts';
import { exposure } from './cartridge_exposure.ts';
import { variants } from './cartridge_variants.ts';
import { transports } from './cartridge_transports.ts';
import { services } from './cartridge_services.ts';
import { food } from './cartridge_food.ts';
import { bleed } from './cartridge_bleed.ts';
import { status } from './cartridge_status.ts';
import { liquids } from './cartridge_liquids.ts';
import { population } from './cartridge_population.ts';

import { apiCmp, installedStage, type Installed } from './cartridge_installed.ts';
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
    () => timeStage(c),
    () => calendarStage(c),
    () => lockStage(c),
    () => scenes(c),
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

// Elapsed releases expose only authority time; legacy releases retain Wait and durations.
function timeStage(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (c.manifest.time_policy) {
    if (!Object.hasOwn(c.lock.capabilities, 'schedule'))
      out.push(
        diag(
          'UNDECLARED_CAPABILITY',
          '.cartridge.manifest.time_policy',
          { capability: 'schedule' },
          ['schedule@1'],
        ),
      );
    if (apiCmp(c.manifest.requires.kernel_api.at_least, '1.1') < 0)
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    if (a.command === 'elapsed' || (a.command === 'wait' && c.manifest.time_policy))
      out.push(diag('UNKNOWN_COMMAND', `.cartridge.actions${step(ref)}.command`));
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj))
    if (c.manifest.time_policy && r.duration)
      out.push(diag('INVALID_TIME_POLICY', `.cartridge.recipes${step(ref)}.duration`));
  return out;
}

// The lock equals requires.capabilities (mismatched), every action's command is owned and none is
// run_job (authority-internal, 04 §1; checked as an unowned name), and every command, policy op,
// definition kind (room, detail, NPC, item, variant, NPC daily schedule, calendar,
// recipe, resource, attribute, barrier), recipe check (by the events it produces, check@1's), recipe step
// of any outcome (by the event it produces: fact_changed for fact.assign, custom_event for
// event.emit; a resource.adjust, like a cost, through the resource it names), quest (by its
// quest_activated), daily schedule (also by the run_job that runs it, schedule@1's), reaction
// (also by its trigger's event and each fact.assign's fact_changed), dialogue (also by each
// fact.assign's fact_changed) and story point (by its story_point_reached) the cartridge uses has
// its owner in the lock.
function lockStage(c: Obj): Diagnostic[] {
  const locked: Obj = c.lock.capabilities;
  const out = lockDiagnostics(locked, c.manifest.requires.capabilities);
  const use = (kind: 'command' | 'policy' | 'definition' | 'event', name: string, path: string) => {
    const owners = CAPABILITY_OWNERS[kind];
    // The schema closes policy ops, so only a command can be unowned.
    if (!Object.hasOwn(owners, name)) return void out.push(diag('UNKNOWN_COMMAND', path));
    const [owner] = owners[name].split('@');
    if (!Object.hasOwn(locked, owner))
      out.push(diag('UNDECLARED_CAPABILITY', path, { capability: owner }, [owners[name]]));
  };
  for (const [ref, a] of Object.entries(c.actions as Obj))
    use(
      'command',
      a.command === 'run_job' ? '' : a.command,
      `.cartridge.actions${step(ref)}.command`,
    );
  for (const [n, at] of nodes(c)) use('policy', n.op, `${at}.op`);
  for (const [kind, , at] of parts(c)) {
    use('definition', kind, at);
    if (kind === 'schedule') use('command', 'run_job', at);
  }
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj)) {
    const at = `.cartridge.recipes${step(ref)}`;
    use('definition', 'recipe', at);
    if (r.check) use('event', 'check_passed', `${at}.check`);
    for (const [name, o] of Object.entries(r.outcomes as Obj))
      o.sequence.forEach((s: Obj, i: number) => {
        if (s.op !== 'resource.adjust')
          use('event', STEP_EVENT[s.op], `${at}.outcomes.${name}.sequence[${i}].op`);
      });
  }
  for (const kind of ['resource', 'attribute', 'scene', 'skill', 'topic'])
    for (const ref of Object.keys((c[`${kind}s`] ?? {}) as Obj))
      use('definition', kind, `.cartridge.${kind}s${step(ref)}`);
  for (const ref of Object.keys((c.quests ?? {}) as Obj))
    use('event', 'quest_activated', `.cartridge.quests${step(ref)}`);
  for (const [kind, name, at] of [...uses(c), ...dialogueUses(c), ...tips(c)]) use(kind, name, at);
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

const STEP_EVENT: Readonly<Record<string, string>> = {
  'fact.assign': 'fact_changed',
  'event.emit': 'custom_event',
};

function declarations(c: Obj): Diagnostic[] {
  return [
    ...refStage(c),
    ...liquids(c),
    ...services(c),
    ...food(c),
    ...bleed(c),
    ...status(c),
    ...population(c),
    ...transports(c),
    ...variety(c),
    ...exposure(c),
    ...variants(c),
    ...scopedFacts(c),
  ];
}
