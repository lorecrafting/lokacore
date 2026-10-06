import { topics } from './cartridge_topics.ts';
import { pools } from './cartridge_pools.ts';
import { fuel } from './cartridge_fuel.ts';
import { skills } from './cartridge_skills.ts';
import { exchanges } from './cartridge_exchange.ts';
import { commerce } from './cartridge_commerce.ts';
import { noticeBoards } from './cartridge_boards.ts';
import { combat } from './cartridge_combat.ts';
import { death } from './cartridge_death.ts';
// The loader's reference stage and the definition walks it shares with the lock stage
// (content/cartridge.ts; protocol/cartridge.schema.json DiagnosticCode): v2 references, text keys,
// detail reachability, and where items and NPCs start (containment, 03 §23; 04 §5.3).
import { encode } from '../foundation/canonical.ts';
import {
  type DefinitionRef,
  type Diagnostic,
  type DiagnosticCode,
  type FactValue,
  type TextKey,
} from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { typed } from '../mechanics/fact.ts';
import { barriers } from './cartridge_barriers.ts';
import { links, unreachable } from './cartridge_links.ts';
import { dialogues } from './cartridge_dialogues.ts';
import { quests, questPolicies, featureApi } from './cartridge_quests.ts';
import { reactions } from './cartridge_reactions.ts';
import { recipes } from './cartridge_recipes.ts';
import { reserved } from './cartridge_position.ts';

export type Data = Record<string, string | number>;
export type Obj = { [key: string]: any };

export const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const diag = (
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
export const step = (name: string) =>
  /^[a-z0-9_]+$/.test(name) ? `.${name}` : `[${encode(name)}]`;

// Definition parts with their registry kind and diagnostic path.
export function parts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (kind: string, d: Obj, at: string, field = 'variants') => {
    out.push([kind, d, at]);
    if (kind === 'detail')
      for (const field of ['readable', 'notice_board'])
        if (d[field]) out.push(['readable', d[field], `${at}.${field}`]);
    (d[field] ?? []).forEach((v: Obj, i: number) =>
      out.push(['variant', v, `${at}.${field}[${i}]`]),
    );
  };
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add('room', r, `.cartridge.rooms${step(ref)}`);
    if (r.dark_description)
      out.push(['darkness', {}, `.cartridge.rooms${step(ref)}.dark_description`]);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add('detail', d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj)) {
    add('npc', n, `.cartridge.npcs${step(ref)}`);
    if (n.shop) out.push(['shop', n.shop, `.cartridge.npcs${step(ref)}.shop`]);
    if (n.daily_schedule)
      out.push(['schedule', n.daily_schedule, `.cartridge.npcs${step(ref)}.daily_schedule`]);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    if (i.readable) out.push(['readable', i.readable, `.cartridge.items${step(ref)}.readable`]);
    if (i.fuel) out.push(['fuel', i.fuel, `.cartridge.items${step(ref)}.fuel`]);
    add('item', i, `.cartridge.items${step(ref)}`, 'room_line_variants');
    if (i.slot) out.push(['slot', i.slot, `.cartridge.items${step(ref)}.slot`]);
  }
  for (const [ref, b] of Object.entries((c.barriers ?? {}) as Obj))
    add('barrier', b, `.cartridge.barriers${step(ref)}`);
  if (c.calendar) out.push(['calendar', c.calendar, '.cartridge.calendar']);
  return out;
}

// Policy nodes with diagnostic paths, across every definition that declares a condition.
export function nodes(c: Obj): [Obj, string][] {
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
    ...Object.entries((c.recipes ?? {}) as Obj).flatMap(([ref, r]) =>
      walk(r.policy.root, `.cartridge.recipes${step(ref)}.policy.root`),
    ),
    ...parts(c).flatMap(([k, v, at]) =>
      k === 'variant' ? walk(v.when.root, `${at}.when.root`) : [],
    ),
    ...questPolicies(c).flatMap(([p, at]) => walk(p, at)),
    ...Object.entries((c.reactions ?? {}) as Obj).flatMap(([ref, r]) =>
      r.when ? walk(r.when.root, `.cartridge.reactions${step(ref)}.when.root`) : [],
    ),
    ...Object.entries((c.skills ?? {}) as Obj).flatMap(([ref, s]) =>
      walk(s.qualification.root, `.cartridge.skills${step(ref)}.qualification.root`),
    ),
    ...Object.entries((c.dialogues ?? {}) as Obj).flatMap(([ref, d]) =>
      walk(d.policy.root, `.cartridge.dialogues${step(ref)}.policy.root`),
    ),
  ];
}

const TEXT: Readonly<Record<string, string[]>> = {
  room: ['title', 'description', 'dark_description'],
  npc: ['short', 'room_line', 'description'],
  item: ['short', 'room_line', 'description'],
  barrier: ['short'],
  readable: ['label', 'text', 'title'],
};

// Shared reference, fact-type and text-catalog checks append diagnostics to `out`.
export type Checks = ReturnType<typeof checkers>;

export function checkers(c: Obj, out: Diagnostic[]) {
  const { id, version } = c.manifest;
  for (const [ref, fact] of Object.entries(c.facts as Obj))
    if (!typed(fact.value_type.default, fact.value_type))
      out.push(diag('FACT_DEFAULT_INVALID', `.cartridge.facts${step(ref)}.value_type.default`));
  const named = (r: Obj, kind: string, path: string) => {
    const target = refString(r as DefinitionRef);
    const ok = r.cartridge_id === id && r.cartridge_version === version && r.kind === kind;
    if (!(ok && Object.hasOwn(c[`${kind}s`] ?? {}, target)))
      out.push(diag('UNRESOLVED_REFERENCE', path, { target }));
  };
  const typedValue = (fact: Obj, v: FactValue, path: string) => {
    const spec = c.facts[refString(fact as DefinitionRef)];
    if (spec && !typed(v, spec.value_type)) out.push(diag('FACT_TYPE_MISMATCH', path));
  };
  const text = (def: Obj, fields: string[], at: string) => {
    for (const field of fields)
      if (def[field] !== undefined && !Object.hasOwn(c.text, def[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`, { target: def[field] }));
  };
  return { named, typedValue, text };
}

// In both formats, validate fact defaults and policy references, typed comparisons and windows.
// In v2 also validate entry, exits, NPC and item locations, text and touch links, barriers,
// action contributions, quests, reactions, dialogues, resource bounds and movement cost.
// size: allow 60, reference checks retain the existing ordered stage plus carrying opt-in checks
export function refStage(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const check = checkers(c, out);
  const { named, typedValue, text } = check;
  for (const [n, at] of nodes(c)) {
    if (n.op === 'fact_compare') {
      named(n.fact, 'fact', `${at}.fact`);
      typedValue(n.fact, n.equals, `${at}.equals`);
    }
    if (n.op === 'has_item') named(n.item, 'item', `${at}.item`);
    if (n.op === 'barrier_state') named(n.barrier, 'barrier', `${at}.barrier`);
    if (n.op === 'quest_state' || n.op === 'escort_state') named(n.quest, 'quest', `${at}.quest`);
    if (n.op === 'stat_compare') named(n.attribute, 'attribute', `${at}.attribute`);
    if (n.op === 'resource_compare') named(n.resource, 'resource', `${at}.resource`);
    if (n.op === 'time_window' && n.from === n.to) out.push(diag('EMPTY_TIME_WINDOW', at));
  }
  out.push(...reserved(c), ...featureApi(c));
  if (c.format !== 'loka-cartridge-v2') return out;
  out.push(...exchanges(c, check), ...fuel(c, check));
  named(c.entry, 'room', '.cartridge.entry');
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    for (const [dir, exit] of Object.entries(r.exits as Obj))
      named(exit.to, 'room', `${at}.exits.${dir}.to`);
    out.push(...unreachable(r.details ?? {}, at), ...noticeBoards(r.details ?? {}, at, text));
  }
  for (const [r, at] of npcRooms(c)) named(r, 'room', at);
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    const { in: k } = i.location;
    if (k !== 'template') named(i.location[k], k, `.cartridge.items${step(ref)}.location.${k}`);
    if (c.world?.carry !== undefined && !Object.hasOwn(i, 'mass_grams'))
      out.push(
        diag('SCHEMA_VIOLATION', `.cartridge.items${step(ref)}.mass_grams`, {
          error: 'missing_property',
        }),
      );
  }
  if (c.world?.carry !== undefined) {
    if (c.lock.capabilities.containment !== 1)
      out.push(
        diag('UNDECLARED_CAPABILITY', '.cartridge.world.carry', { capability: 'containment' }, [
          'containment@1',
        ]),
      );
    const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
    if (major < 1 || (major === 1 && minor < 3))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  for (const [kind, d, at] of parts(c)) text(d, TEXT[kind] ?? ['description'], at);
  out.push(...skills(c, check), ...topics(c, check));
  // checkers push to out too
  out.push(...recipes(c, check), ...holders(c), ...barriers(c, check.named), ...links(c));
  out.push(...quests(c, check), ...reactions(c, check), ...dialogues(c, check));
  out.push(...pools(c, named), ...death(c, named), ...combat(c, named), ...commerce(c));
  return out;
}

// Each room an NPC names, with its path: where it starts and each room of its daily schedule.
const npcRooms = (c: Obj): [Obj, string][] =>
  Object.entries((c.npcs ?? {}) as Obj).flatMap(([ref, n]) => [
    [n.room, `.cartridge.npcs${step(ref)}.room`],
    ...Object.entries((n.daily_schedule ?? {}) as Obj).map(([h, r]): [Obj, string] => [
      r,
      `.cartridge.npcs${step(ref)}.daily_schedule${step(h)}`,
    ]),
  ]);
// Items and NPCs start in containers that form no cycle (CONTAINMENT_CYCLE, at each item on
// one) and hold at most their capacity (CAPACITY_EXCEEDED).
function holders(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const items: Obj = c.items ?? {};
  const inside = (i?: Obj) => (i?.location.in === 'item' ? refString(i.location.item) : undefined);
  const held: Record<string, number> = {};
  for (const [ref, i] of Object.entries(items)) {
    const path = `.cartridge.items${step(ref)}`;
    if (i.container !== true)
      for (const field of ['capacity', 'barrier'])
        if (i[field] !== undefined)
          out.push(diag('SCHEMA_VIOLATION', `${path}.${field}`, { error: 'invalid_value' }));
    const holder = items[inside(i) ?? ''];
    if (holder && holder.container !== true)
      out.push(diag('SCHEMA_VIOLATION', `${path}.location.item`, { error: 'invalid_value' }));
    if (i.location.in === 'template') continue;
    const at = refString(i.location[i.location.in]);
    held[at] = (held[at] ?? 0) + 1;
    let up = inside(i);
    for (let n = 0; up !== undefined && up !== ref && n < Object.keys(items).length; n++)
      up = inside(items[up]);
    if (up === ref)
      out.push(diag('CONTAINMENT_CYCLE', `.cartridge.items${step(ref)}.location.item`));
  }
  for (const map of ['npcs', 'items'])
    for (const [ref, h] of Object.entries((c[map] ?? {}) as Obj))
      if (h.capacity !== undefined && (held[ref] ?? 0) > h.capacity)
        out.push(
          diag('CAPACITY_EXCEEDED', `.cartridge.${map}${step(ref)}.capacity`, {
            capacity: h.capacity,
            held: held[ref],
          }),
        );
  return out;
}
