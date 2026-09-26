// The loader's reference stage and the definition walks it shares with the lock stage
// (cartridge.ts; protocol/cartridge.schema.json DiagnosticCode): v2 references, text keys,
// detail reachability, and where items and NPCs start (containment, 03 §23; 04 §5.3).
import { encode } from './canonical.ts';
import {
  CAPABILITY_OWNERS,
  type DefinitionRef,
  type Diagnostic,
  type DiagnosticCode,
  type TextKey,
} from './contracts.gen.ts';
import { refString } from './decision.ts';

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

// Each room, detail, NPC, item and description variant (v2; an item's room-line variants), with
// its kind (registry definitions) and path.
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
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    add('npc', n, `.cartridge.npcs${step(ref)}`);
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    add('item', i, `.cartridge.items${step(ref)}`, 'room_line_variants');
  return out;
}

// Each node, with its path, of every action's, named policy's, recipe's and variant's condition.
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
  ];
}

const TEXT: Readonly<Record<string, string[]>> = {
  room: ['title', 'description'],
  npc: ['short', 'room_line', 'description'],
  item: ['short', 'room_line', 'description'],
};

// Every fact_compare names a fact and every has_item an item of this cartridge (the kernel reads
// them; any format, since v1 action policies are evaluated too), and no time_of_day window is
// empty (EMPTY_TIME_WINDOW). v2: the entry and every exit
// name a room of this cartridge, every text key a room, a detail, an NPC, an item, a variant, an
// action or a recipe uses has a catalog entry, every detail's first alias is its own and
// typable, items and NPCs start where containment allows, and recipes and rooms' action
// contributions name what exists (recipes).
export function refStage(c: Obj): Diagnostic[] {
  const { id, version } = c.manifest;
  const out: Diagnostic[] = [];
  // A DefinitionRef naming a definition of `kind` in this cartridge's map of that kind.
  const named = (r: Obj, kind: string, path: string) => {
    const target = refString(r as DefinitionRef);
    const ok = r.cartridge_id === id && r.cartridge_version === version && r.kind === kind;
    if (!(ok && Object.hasOwn(c[`${kind}s`] ?? {}, target)))
      out.push(diag('UNRESOLVED_REFERENCE', path, { target }));
  };
  for (const [n, at] of nodes(c)) {
    if (n.op === 'fact_compare') named(n.fact, 'fact', `${at}.fact`);
    if (n.op === 'has_item') named(n.item, 'item', `${at}.item`);
    if (n.op === 'time_of_day' && n.from === n.to) out.push(diag('EMPTY_TIME_WINDOW', at));
  }
  if (c.format !== 'loka-cartridge-v2') return out;
  const text = (def: Obj, fields: string[], at: string) => {
    for (const field of fields)
      if (def[field] !== undefined && !Object.hasOwn(c.text, def[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`, { target: def[field] }));
  };
  named(c.entry, 'room', '.cartridge.entry');
  for (const [ref, r] of Object.entries(c.rooms as Obj)) {
    const at = `.cartridge.rooms${step(ref)}`;
    for (const [dir, exit] of Object.entries(r.exits as Obj))
      named(exit.to, 'room', `${at}.exits.${dir}.to`);
    out.push(...unreachable(r.details ?? {}, at));
  }
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj))
    named(n.room, 'room', `.cartridge.npcs${step(ref)}.room`);
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    const { in: k } = i.location;
    named(i.location[k], k, `.cartridge.items${step(ref)}.location.${k}`);
  }
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  for (const [kind, d, at] of parts(c)) text(d, TEXT[kind] ?? ['description'], at);
  out.push(...recipes(c, named, text), ...holders(c)); // recipes' named and text push to out too
  return out;
}

type Named = (r: Obj, kind: string, path: string) => void;
type Texts = (def: Obj, fields: string[], at: string) => void;

// Each recipe's key is no action's and no registered command's (DUPLICATE_DEFINITION: one key is
// one ActionSet identity), its target names a room of this cartridge and a detail of that room,
// it has a failure outcome exactly when it has a check (OUTCOME_MISMATCH), each outcome's
// fact.assign names a fact of it, and its label and narrations have catalog entries; each key of
// a room's action contribution names an engine verb (a registered command), an action or a
// recipe of this cartridge (UNRESOLVED_REFERENCE, data {target}: the detail or action key).
function recipes(c: Obj, named: Named, text: Texts): Diagnostic[] {
  const out: Diagnostic[] = [];
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...Object.values(c.actions as Obj).map((a) => a.key),
  ]);
  for (const [ref, r] of Object.entries((c.recipes ?? {}) as Obj)) {
    const at = `.cartridge.recipes${step(ref)}`;
    if (taken.has(r.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    const { room, detail } = r.target;
    const there = c.rooms[refString(room)]; // this cartridge's room, as named() requires
    if (!there) named(room, 'room', `${at}.target.room`);
    else if (!Object.hasOwn(there.details ?? {}, detail))
      out.push(diag('UNRESOLVED_REFERENCE', `${at}.target.detail`, { target: detail }));
    if (!r.check !== !r.outcomes.failure) out.push(diag('OUTCOME_MISMATCH', `${at}.outcomes`));
    for (const [name, o] of Object.entries(r.outcomes as Obj)) {
      const path = `${at}.outcomes.${name}`;
      o.sequence.forEach((s: Obj, i: number) => {
        if (s.op === 'fact.assign') named(s.fact, 'fact', `${path}.sequence[${i}].fact`);
      });
      text(o.narration, ['actor', 'observers'], `${path}.narration`);
    }
    text(r, ['label'], at);
  }
  return [...out, ...contributions(c)];
}

// Each key of a room's action contribution names a registered command, an action or a recipe.
function contributions(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const defs: Obj[] = [...Object.values(c.actions as Obj), ...Object.values(c.recipes ?? {})];
  const keys = new Set([...Object.keys(CAPABILITY_OWNERS.command), ...defs.map((d) => d.key)]);
  for (const [ref, r] of Object.entries(c.rooms as Obj))
    (r.actions ?? []).forEach((a: Obj, i: number) =>
      a.actions.forEach((k: string, j: number) => {
        if (!keys.has(k))
          out.push(
            diag(
              'UNRESOLVED_REFERENCE',
              `.cartridge.rooms${step(ref)}.actions[${i}].actions[${j}]`,
              { target: k },
            ),
          );
      }),
    );
  return out;
}

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
