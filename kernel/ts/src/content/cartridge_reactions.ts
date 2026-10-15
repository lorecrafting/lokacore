// The loader's reaction checks (reaction@1; reaction.schema.json ReactionRule; 06 §14: referenced
// facts and targets are compile-validated), twin of lib/loka/content/reactions.ex: what each
// reaction uses, for the lock stage (content/cartridge.ts): its own kind, its trigger's event and each
// consequence's event; its trigger's filters and its consequences name local definitions,
// with typed fact values and restricted quest activation. Its `when` is walked
// with every other policy (content/cartridge_refs.ts nodes).
import { refString } from '../runtime/decision.ts';
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

// Each trigger filter that names a definition (W1), with that definition's kind; sorted, as the
// compiler (lib/loka/content/reactions.ex) reports them.
const NAMED: Record<string, string> = {
  attacker: 'npc',
  barrier: 'barrier',
  fact: 'fact',
  item: 'item',
  kind: 'liquid',
  npc: 'npc',
  quest: 'quest',
  room: 'room',
  scene: 'scene',
  status: 'status',
  story_point: 'story_point',
  target: 'npc',
  victim: 'npc',
};

// The kernel_api minor each consequence op needs (major 1).
const FLOORS: Record<string, number> = {
  'quest.activate': 8,
  'quest.resolve': 12,
  'quest.fail': 12,
  'population.suppress': 35,
  'status.cure': 53, // status reader 3 (row G3)
  'barrier.set': 56, // row W22 (loka-kgd.96)
  'item.move': 77, // row 41 (decay)
  'population.spawn': 84, // row 37a (phased world events)
};

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.reactions ?? {}) as Obj).map(([ref, r]) => [
    r,
    `.cartridge.reactions${step(ref)}`,
  ]);

/** Each owner reference of each reaction: [registry field, name, path]. */
export const uses = (c: Obj) =>
  each(c).flatMap(([r, at]) => [
    ['definition', 'reaction', at],
    ['event', r.on.event, `${at}.on.event`],
    ...r.apply.flatMap((s: Obj, i: number) =>
      [
        'population.suppress',
        'experience.grant',
        'status.cure',
        'item.move',
        'population.spawn',
      ].includes(s.op)
        ? []
        : [
            [
              'event',
              s.op === 'quest.activate'
                ? 'quest_activated'
                : s.op === 'quest.resolve'
                  ? 'quest_resolved'
                  : s.op === 'barrier.set'
                    ? 'barrier_changed'
                    : 'fact_changed',
              `${at}.apply[${i}].op`,
            ],
          ],
    ),
  ]) as ['definition' | 'event', string, string][];

// The kernel_api minor a reaction needs: the highest of its trigger's and its steps' rows.
const apiFloor = (r: Obj): number =>
  Math.max(
    r.on.event === 'quest_resolved' ? 8 : 0,
    r.on.event === 'spoken' ? 48 : r.on.npc ? 47 : 0, // speech (G9), the entrant filter (W3)
    r.on.target ? 87 : r.on.attacker ? 58 : 0, // loka-kgd.79, row 39
    r.on.event === 'status_applied' ? 53 : 0, // status reader 2 (row G3)
    // co_present: row W21; its tag: row W22
    ...r.apply.map((s: Obj) => (s.tag ? 56 : s.co_present ? 50 : (FLOORS[s.op] ?? 0))),
  );

// size: allow 47, typed suppression and status references stay in one ordered check
export function reactions(c: Obj, { named, typedValue }: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  for (const [r, at] of each(c)) {
    const floor = apiFloor(r);
    if (floor && (major < 1 || (major === 1 && minor < floor)))
      out.push(
        diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'),
      );
    for (const [field, kind] of Object.entries(NAMED))
      if (r.on[field]) named(r.on[field], kind, `${at}.on.${field}`);
    // A spawn template has no instance to enter (row W3), attack (loka-kgd.79) or be hit (row 39).
    for (const f of ['npc', 'attacker', 'target'])
      if (r.on[f] && c.npcs?.[refString(r.on[f])]?.spawn_template)
        out.push(diag('SCHEMA_VIOLATION', `${at}.on.${f}`, { error: 'invalid_value' }));
    r.apply.forEach((s: Obj, i: number) => {
      if (s.op === 'quest.activate') {
        named(s.quest, 'quest', `${at}.apply[${i}].quest`);
        // loka-kgd.150.2: only a trigger whose subject resolves to a character activates.
        if (!['quest_resolved', 'rested', 'entity_entered_room'].includes(r.on.event))
          out.push(diag('OUTCOME_MISMATCH', `${at}.apply[${i}].op`));
      } else if (s.op === 'quest.resolve' || s.op === 'quest.fail') {
        named(s.quest, 'quest', `${at}.apply[${i}].quest`); // any trigger, per holder
      } else if (s.op === 'population.suppress') {
        named(s.plan, 'population', `${at}.apply[${i}].plan`);
        if (r.on.fact) typedValue(r.on.fact, true, `${at}.on.fact`);
        if (!c.populations?.[refString(s.plan)]?.pack)
          out.push(diag('SCHEMA_VIOLATION', `${at}.apply[${i}].plan`));
        if (r.on.event !== 'fact_changed')
          out.push(diag('OUTCOME_MISMATCH', `${at}.apply[${i}].op`));
      } else if (s.op === 'barrier.set') {
        out.push(...barrierSet(c, s, r.on.room, `${at}.apply[${i}]`, named));
      } else if (s.op === 'item.move' || s.op === 'population.spawn') {
        const [f, kind] = s.op === 'item.move' ? ['room', 'room'] : ['plan', 'population']; // rows 41, 37a
        named(s[f], kind, `${at}.apply[${i}].${f}`);
      } else if (!['status.apply', 'status.cure', 'experience.grant'].includes(s.op)) {
        // status steps, experience.grant, fact.adjust's int: with their declarations (cartridge_standing.ts).
        named(s.fact, 'fact', `${at}.apply[${i}].fact`);
        if (s.op !== 'fact.adjust') typedValue(s.fact, s.value, `${at}.apply[${i}].value`);
        for (const f of ['npc', 'item']) if (s[f]) named(s[f], f, `${at}.apply[${i}].${f}`);
        if (s.with) named(s.with, 'npc', `${at}.apply[${i}].with`); // row FD4
      }
    });
  }
  return out;
}

// Row W22 (loka-kgd.96): a named barrier resolves; to locked needs a key_item on the named barrier,
// or on every barrier carrying the tag, else no key could ever unlock it (BARRIER_UNREACHABLE_KEY).
function barrierSet(
  c: Obj,
  s: Obj,
  room: DefinitionRef | undefined,
  at: string,
  named: Checks['named'],
): Diagnostic[] {
  if (s.barrier) named(s.barrier, 'barrier', `${at}.barrier`);
  // A tag reaches only barriers on exits (setBarrier), never a container's lid, and only the event
  // room's: the trigger's room filter fixes it, else any room may be it (loka-kgd.103).
  const rooms = room ? [c.rooms?.[refString(room)]] : Object.values((c.rooms ?? {}) as Obj);
  const exits = rooms.flatMap((r) => Object.values((r?.exits ?? {}) as Obj));
  const hit = s.barrier
    ? [c.barriers?.[refString(s.barrier)]]
    : exits
        .map((e) => e.barrier && c.barriers?.[refString(e.barrier)])
        .filter((b) => b?.tags?.includes(s.tag));
  return s.to === 'locked' && hit.some((b) => b && !b.key_item)
    ? [diag('BARRIER_UNREACHABLE_KEY', `${at}.to`)]
    : [];
}
