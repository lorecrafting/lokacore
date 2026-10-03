// The loader's reference stage and the definition walks it shares with the lock stage
// (cartridge.ts; protocol/cartridge.schema.json DiagnosticCode): v2 references, text keys,
// detail reachability, and where items and NPCs start (containment, 03 §23; 04 §5.3).
import { encode } from './canonical.ts';
import {
  type DefinitionRef,
  type Diagnostic,
  type DiagnosticCode,
  type FactValue,
  type TextKey,
} from './contracts.gen.ts';
import { refString } from './decision.ts';
import { typed } from './fact.ts';
import { barriers } from './cartridge_barriers.ts';
import { links } from './cartridge_links.ts';
import { dialogues } from './cartridge_dialogues.ts';
import { quests } from './cartridge_quests.ts';
import { reactions } from './cartridge_reactions.ts';
import { recipes } from './cartridge_recipes.ts';

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

// Each room, detail, NPC, NPC daily schedule, item, barrier, description variant (v2; an item's
// room-line variants) and the calendar, with its kind (registry definitions) and path.
export function parts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (kind: string, d: Obj, at: string, field = 'variants') => {
    out.push([kind, d, at]);
    (d[field] ?? []).forEach((v: Obj, i: number) =>
      out.push(['variant', v, `${at}.${field}[${i}]`]),
    );
  };
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add('room', r, `.cartridge.rooms${step(ref)}`);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add('detail', d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj)) {
    add('npc', n, `.cartridge.npcs${step(ref)}`);
    if (n.daily_schedule)
      out.push(['schedule', n.daily_schedule, `.cartridge.npcs${step(ref)}.daily_schedule`]);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    add('item', i, `.cartridge.items${step(ref)}`, 'room_line_variants');
  for (const [ref, b] of Object.entries((c.barriers ?? {}) as Obj))
    add('barrier', b, `.cartridge.barriers${step(ref)}`);
  if (c.calendar) out.push(['calendar', c.calendar, '.cartridge.calendar']);
  return out;
}

// Each node, with its path, of every action's, named policy's, recipe's, variant's, quest offer's,
// current_state objective's, reaction's and dialogue's condition.
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
    ...Object.entries((c.quests ?? {}) as Obj).flatMap(([ref, q]) =>
      ['offer', 'objective']
        .filter((f) => q[f]?.policy)
        .flatMap((f) => walk(q[f].policy.root, `.cartridge.quests${step(ref)}.${f}.policy.root`)),
    ),
    ...Object.entries((c.reactions ?? {}) as Obj).flatMap(([ref, r]) =>
      r.when ? walk(r.when.root, `.cartridge.reactions${step(ref)}.when.root`) : [],
    ),
    ...Object.entries((c.dialogues ?? {}) as Obj).flatMap(([ref, d]) =>
      walk(d.policy.root, `.cartridge.dialogues${step(ref)}.policy.root`),
    ),
  ];
}

const TEXT: Readonly<Record<string, string[]>> = {
  room: ['title', 'description'],
  npc: ['short', 'room_line', 'description'],
  item: ['short', 'room_line', 'description'],
  barrier: ['short'],
};

// The reference checks refStage and recipes share, each pushing its diagnostic to `out`: named,
// a DefinitionRef naming a definition of `kind` in this cartridge's map of that kind; typedValue,
// a value of this cartridge's fact that is not of its type (FACT_TYPE_MISMATCH, the FactType
// check adopt uses; the fact's own absence is named's); text, a text key without a catalog entry.
export function checkers(c: Obj, out: Diagnostic[]) {
  const { id, version } = c.manifest;
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

// Every fact_compare names a fact of this cartridge with a value of its type, every has_item
// an item of it, every barrier_state a barrier of it, every quest_state a quest of it, every
// stat_compare an attribute and every resource_compare a resource of it (the kernel reads them; any format, since v1 action policies are evaluated too),
// and no time_window is empty (EMPTY_TIME_WINDOW). v2: the entry, every exit and every room an
// NPC starts in or names in its daily schedule name a room of this cartridge, an exit's barrier
// a barrier of it, which each exit of its destination back to its room names too
// (BARRIER_MISMATCH), a barrier's key_item an item of it, every text key a room, a detail, an
// NPC, an item, a barrier, a variant, an action or a recipe uses has a catalog entry, every
// touch link names what it may (cartridge_links.ts), every detail's first alias is its own and
// typable, items and NPCs start where containment allows, recipes and rooms' action
// contributions name what exists (recipes), quests, reactions and dialogues are coherent
// (cartridge_quests.ts, cartridge_reactions.ts, cartridge_dialogues.ts), each resource's
// bounds hold its start (RESOURCE_SPEC_INVALID), each band table is well formed (bands) and the
// world's move cost names a resource of this cartridge.
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
    if (n.op === 'quest_state') named(n.quest, 'quest', `${at}.quest`);
    if (n.op === 'stat_compare') named(n.attribute, 'attribute', `${at}.attribute`);
    if (n.op === 'resource_compare') named(n.resource, 'resource', `${at}.resource`);
    if (n.op === 'time_window' && n.from === n.to) out.push(diag('EMPTY_TIME_WINDOW', at));
  }
  if (c.format !== 'loka-cartridge-v2') return out;
  named(c.entry, 'room', '.cartridge.entry');
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    for (const [dir, exit] of Object.entries(r.exits as Obj))
      named(exit.to, 'room', `${at}.exits.${dir}.to`);
    out.push(...unreachable(r.details ?? {}, at));
  }
  for (const [r, at] of npcRooms(c)) named(r, 'room', at);
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    const { in: k } = i.location;
    named(i.location[k], k, `.cartridge.items${step(ref)}.location.${k}`);
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  for (const [kind, d, at] of parts(c)) text(d, TEXT[kind] ?? ['description'], at);
  // checkers push to out too
  out.push(...recipes(c, check), ...holders(c), ...barriers(c, check.named), ...links(c));
  out.push(...quests(c, check), ...reactions(c, check), ...dialogues(c, check));
  out.push(...pools(c, named));
  return out;
}

// Each resource's bounds hold its start (RESOURCE_SPEC_INVALID), each band table (a pool's,
// the world's) is well formed (bands), and the world's move cost names a resource of this
// cartridge.
function pools(c: Obj, named: ReturnType<typeof checkers>['named']): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [ref, s] of Object.entries((c.resources ?? {}) as Obj)) {
    const at = `.cartridge.resources${step(ref)}`;
    if (!(s.minimum <= s.start && s.start <= s.maximum))
      out.push(diag('RESOURCE_SPEC_INVALID', at));
    if (s.bands) out.push(...bands(c, s.bands, `${at}.bands`));
  }
  if (c.world?.bands) out.push(...bands(c, c.world.bands, '.cartridge.world.bands'));
  const cost = c.world?.movement?.cost;
  if (cost) named(cost.resource, 'resource', '.cartridge.world.movement.cost.resource');
  return out;
}

// A condition band table (resource.schema.json BandTable) at `at`: cuts strictly descending to a
// last 0 and keys unique (RESOURCE_SPEC_INVALID at the table), each key's band.<key> text in the
// catalog (UNRESOLVED_REFERENCE at the key).
function bands(c: Obj, table: Obj[], at: string): Diagnostic[] {
  const sorted = table.every((b, i) => i === 0 || b.at_percent < table[i - 1].at_percent);
  const unique = new Set(table.map((b) => b.key)).size === table.length;
  const out =
    sorted && unique && table.at(-1)!.at_percent === 0 ? [] : [diag('RESOURCE_SPEC_INVALID', at)];
  table.forEach(({ key }, i) => {
    if (!Object.hasOwn(c.text, `band.${key}`))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}[${i}].key`, { target: `band.${key}` }));
  });
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

// UNREACHABLE_DETAIL for each detail of the room at `at` whose first alias another detail has
// or no lookup produces.
function unreachable(details: Obj, at: string): Diagnostic[] {
  return Object.entries(details).flatMap(([key, d]) => {
    const others = Object.entries(details).flatMap(([k, o]) => (k === key ? [] : o.aliases));
    const [first, ...words] = d.aliases[0].split('_');
    const typable = ![first, ...words].includes('') && !['at', 'the', 'a', 'an'].includes(first);
    return !typable || others.includes(d.aliases[0])
      ? [diag('UNREACHABLE_DETAIL', `${at}.details.${key}`)]
      : [];
  });
}

// Items and NPCs start in containers that form no cycle (CONTAINMENT_CYCLE, at each item on
// one) and hold at most their capacity (CAPACITY_EXCEEDED).
function holders(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const items: Obj = c.items ?? {};
  const inside = (i?: Obj) => (i?.location.in === 'item' ? refString(i.location.item) : undefined);
  const held: Record<string, number> = {};
  for (const [ref, i] of Object.entries(items)) {
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
