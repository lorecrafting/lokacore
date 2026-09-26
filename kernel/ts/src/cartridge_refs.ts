// The loader's reference stage and the definition walks it shares with the lock stage
// (cartridge.ts; protocol/cartridge.schema.json DiagnosticCode): v2 references, text keys,
// detail reachability, and where items and NPCs start (containment, 03 §23; 04 §5.3).
import { encode } from './canonical.ts';
import type { DefinitionRef, Diagnostic, DiagnosticCode, TextKey } from './contracts.gen.ts';
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

// Each node, with its path, of every action's, named policy's and variant's condition.
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

// v2: the entry and every exit name a room of this cartridge, every text key a room, a detail,
// an NPC, an item, a variant or an action uses has a catalog entry, every fact_compare names a
// fact and every has_item an item of this cartridge (the kernel reads them), every detail's
// first alias is its own and typable, and items and NPCs start where containment allows.
export function refStage(c: Obj): Diagnostic[] {
  if (c.format !== 'loka-cartridge-v2') return [];
  const { id, version } = c.manifest;
  const out: Diagnostic[] = [];
  const text = (def: Obj, fields: string[], at: string) => {
    for (const field of fields)
      if (!Object.hasOwn(c.text, def[field]))
        out.push(diag('UNRESOLVED_REFERENCE', `${at}.${field}`, { target: def[field] }));
  };
  // A DefinitionRef naming a definition of `kind` in this cartridge's map of that kind.
  const named = (r: Obj, kind: string, path: string) => {
    const target = refString(r as DefinitionRef);
    const ok = r.cartridge_id === id && r.cartridge_version === version && r.kind === kind;
    if (!(ok && Object.hasOwn(c[`${kind}s`] ?? {}, target)))
      out.push(diag('UNRESOLVED_REFERENCE', path, { target }));
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
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj))
    named(
      i.location[i.location.in],
      i.location.in,
      `.cartridge.items${step(ref)}.location.${i.location.in}`,
    );
  for (const [ref, a] of Object.entries(c.actions as Obj))
    text(a, ['label', 'accessibility'], `.cartridge.actions${step(ref)}`);
  for (const [kind, d, at] of parts(c)) text(d, TEXT[kind] ?? ['description'], at);
  for (const [n, at] of nodes(c)) {
    if (n.op === 'fact_compare') named(n.fact, 'fact', `${at}.fact`);
    if (n.op === 'has_item') named(n.item, 'item', `${at}.item`);
  }
  return [...out, ...holders(c)];
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
