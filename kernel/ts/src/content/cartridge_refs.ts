import { water } from './cartridge_water.ts';
import { topics } from './cartridge_topics.ts';
import { pools } from './cartridge_pools.ts';
import { replenish } from './cartridge_replenish.ts';
import { trails } from './cartridge_trails.ts';
import { fuel } from './cartridge_fuel.ts';
import { skills } from './cartridge_skills.ts';
import { exchanges } from './cartridge_exchange.ts';
import { commerce } from './cartridge_commerce.ts';
import { combat } from './cartridge_combat.ts';
import { death } from './cartridge_death.ts';
import { derived } from './cartridge_derived.ts';
import { levelling } from './cartridge_levelling.ts';
import { cases } from './cartridge_schedules.ts';
import { dispositions } from './cartridge_standing.ts';
// The loader's reference stage and the definition walks it shares with the lock stage
// (content/cartridge.ts; protocol/cartridge.schema.json DiagnosticCode). References, text keys,
// reachability and containment are the compiler's (lib/loka/content); the families below remain.
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
import { dialogues } from './cartridge_dialogues.ts';
import { quests, questPolicies } from './cartridge_quests.ts';
import { reactions } from './cartridge_reactions.ts';
import { recipes } from './cartridge_recipes.ts';
import { theft } from './cartridge_theft.ts';
import { mounts } from './cartridge_mounts.ts';
import { answerRoots, asks } from './cartridge_asks.ts';
import { cueParts } from './cartridge_senses.ts';
import { lockRoots } from './cartridge_locks.ts';

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

// An item's or NPC's text variant lists (TextVariants; toolbox row W6).
export const ENTITY_VARIANTS = ['short_variants', 'room_line_variants', 'description_variants'];

// Definition parts with their registry kind and diagnostic path.
// size: allow 41, one add per definition map
export function parts(c: Obj): [string, Obj, string][] {
  const out: [string, Obj, string][] = [];
  const add = (kind: string, d: Obj, at: string, fields = ['variants']) => {
    out.push([kind, d, at]);
    if (d.tags) out.push(['tags', d.tags, `${at}.tags`]);
    if (d.harvest?.tool) out.push(['tags', d.harvest.tool, `${at}.harvest.tool`]); // row 19
    if (kind === 'detail')
      for (const field of ['readable', 'notice_board'])
        if (d[field]) out.push(['readable', d[field], `${at}.${field}`]);
    for (const field of fields)
      (d[field] ?? []).forEach((v: Obj, i: number) =>
        out.push(['variant', v, `${at}.${field}[${i}]`]),
      );
  };
  for (const [ref, r] of Object.entries((c.rooms ?? {}) as Obj)) {
    add('room', r, `.cartridge.rooms${step(ref)}`);
    for (const k of ['dark_description', 'dark'])
      if (r[k]) out.push(['darkness', {}, `.cartridge.rooms${step(ref)}.${k}`]);
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj))
      add('detail', d, `.cartridge.rooms${step(ref)}.details${step(key)}`);
  }
  for (const [ref, n] of Object.entries((c.npcs ?? {}) as Obj)) {
    add('npc', n, `.cartridge.npcs${step(ref)}`, ENTITY_VARIANTS);
    if (n.shop) out.push(['shop', n.shop, `.cartridge.npcs${step(ref)}.shop`]);
    if (n.daily_schedule)
      out.push(['schedule', n.daily_schedule, `.cartridge.npcs${step(ref)}.daily_schedule`]);
  }
  for (const [ref, i] of Object.entries((c.items ?? {}) as Obj)) {
    if (i.edible) out.push(['edible', i.edible, `.cartridge.items${step(ref)}.edible`]);
    if (i.readable) out.push(['readable', i.readable, `.cartridge.items${step(ref)}.readable`]);
    if (i.fuel) out.push(['fuel', i.fuel, `.cartridge.items${step(ref)}.fuel`]);
    add('item', i, `.cartridge.items${step(ref)}`, ENTITY_VARIANTS);
    if (i.slot) out.push(['slot', i.slot, `.cartridge.items${step(ref)}.slot`]);
  }
  for (const [ref, b] of Object.entries((c.barriers ?? {}) as Obj))
    add('barrier', b, `.cartridge.barriers${step(ref)}`);
  for (const [ref, b] of Object.entries((c.blueprints ?? {}) as Obj))
    add('blueprint', b, `.cartridge.blueprints${step(ref)}`);
  if (c.calendar) out.push(['calendar', c.calendar, '.cartridge.calendar']);
  return [...out, ...cueParts(c), ...identityParts(c)];
}

function identityParts(c: Obj, at = '.cartridge.world.identity.name_variants') {
  const vs: Obj[] = c.world?.identity?.name_variants ?? []; // rows W15, FD9
  return vs.map((v, i) => ['variant', v, `${at}[${i}]`] as [string, Obj, string]);
}

/** Each population plan gate's located root (row W12). */
const gateRoots = (c: Obj): [Obj, string][] =>
  Object.entries((c.populations ?? {}) as Obj).flatMap(([ref, p]) =>
    (['birth_when', 'wander_when'] as const).flatMap((k): [Obj, string][] =>
      p[k] ? [[p[k].root, `.cartridge.populations${step(ref)}.${k}.root`]] : [],
    ),
  );

// Policy nodes with diagnostic paths, across every definition that declares a condition.
/** Each node of one policy tree with its path. */
export const walk = (p: Obj, at: string): [Obj, string][] => [
  [p, at],
  ...(p.op === 'not' ? walk(p.item, `${at}.item`) : []),
  ...(p.items ?? []).flatMap((x: Obj, i: number) => walk(x, `${at}.items[${i}]`)),
];

export function nodes(c: Obj): [Obj, string][] {
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
      k === 'variant' || (k === 'cue' && v.when) ? walk(v.when.root, `${at}.when.root`) : [],
    ),
    ...[...questPolicies(c), ...dispositions(c), ...answerRoots(c)].flatMap(([p, at]) =>
      walk(p, at),
    ),
    ...cases(c).flatMap(([k, at]) => (k.when ? walk(k.when.root, `${at}.when.root`) : [])),
    ...Object.entries((c.reactions ?? {}) as Obj).flatMap(([ref, r]) =>
      r.when ? walk(r.when.root, `.cartridge.reactions${step(ref)}.when.root`) : [],
    ),
    ...Object.entries((c.skills ?? {}) as Obj).flatMap(([ref, s]) =>
      ['qualification', 'prerequisite'].flatMap((f) =>
        s[f] ? walk(s[f].root, `.cartridge.skills${step(ref)}.${f}.root`) : [],
      ),
    ),
    ...Object.entries((c.dialogues ?? {}) as Obj).flatMap(([ref, d]) =>
      walk(d.policy.root, `.cartridge.dialogues${step(ref)}.policy.root`),
    ),
    ...lockRoots(c).flatMap(([p, at]) => walk(p, at)),
    ...gateRoots(c).flatMap(([p, at]) => walk(p, at)),
    ...Object.entries((c.barriers ?? {}) as Obj).flatMap(([ref, b]) =>
      b.opens_when
        ? walk(b.opens_when.root, `.cartridge.barriers${step(ref)}.opens_when.root`)
        : [],
    ),
  ];
}

// Shared reference, fact-type and text-catalog checks append diagnostics to `out`.
export type Checks = ReturnType<typeof checkers>;

export function checkers(c: Obj, out: Diagnostic[]) {
  const { id, version } = c.manifest;
  const named = (r: Obj, kind: string, path: string) => {
    const target = refString(r as DefinitionRef);
    const ok = r.cartridge_id === id && r.cartridge_version === version && r.kind === kind;
    const section = kind === 'status' ? 'statuses' : kind === 'replenish' ? kind : `${kind}s`;
    if (!(ok && Object.hasOwn(c[section] ?? {}, target)))
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

// The v2 family checks batch C1 has not yet removed; each gets the shared checkers.
export function refStage(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const check = checkers(c, out);
  const { named } = check;
  if (c.format !== 'loka-cartridge-v2') return out;
  // -- B2
  out.push(...trails(c, check));
  out.push(...theft(c, named));
  out.push(...mounts(c, named));
  out.push(...asks(c, check));
  // -- C1
  out.push(...exchanges(c, check));
  out.push(...recipes(c, check));
  out.push(...reactions(c, check));
  // -- C2
  out.push(...quests(c, check));
  out.push(...dialogues(c, check));
  // -- D1
  out.push(...fuel(c, check));
  out.push(...replenish(c, check));
  out.push(...water(c, check));
  out.push(...pools(c, named));
  // -- D2
  out.push(...skills(c, check));
  out.push(...topics(c, check));
  out.push(...death(c, check));
  out.push(...combat(c, named));
  out.push(...commerce(c));
  out.push(...derived(c, check));
  out.push(...levelling(c, check));
  return out;
}
