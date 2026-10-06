import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';

/** Finite authored route, original passive leader and reserved trust ownership. */
export function patrol(c: Obj, q: Obj, at: string, checks: Checks): Diagnostic[] {
  const p = q.patrol;
  if (!p)
    return q.objective.evidence === 'patrol' ? [diag('OUTCOME_MISMATCH', `${at}.objective`)] : [];
  return [...routeChecks(c, p, at, checks), ...ownership(c, q, p, at), ...conflicts(c, q, p)];
}

function routeChecks(c: Obj, p: Obj, at: string, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bad = (field: string) => out.push(diag('OUTCOME_MISMATCH', `${at}.patrol.${field}`));
  checks.named(p.npc, 'npc', `${at}.patrol.npc`);
  checks.named(p.trust_fact, 'fact', `${at}.patrol.trust_fact`);
  checks.text(p, ['narration'], `${at}.patrol`);
  for (const [i, room] of p.route.entries()) checks.named(room, 'room', `${at}.patrol.route[${i}]`);
  for (const [i, room] of p.checkpoints.entries())
    checks.named(room, 'room', `${at}.patrol.checkpoints[${i}]`);
  const route = p.route.map(refString);
  const points = p.checkpoints.map(refString);
  if (p.initial_cursor >= route.length) bad('initial_cursor');
  if (
    new Set(points).size !== points.length ||
    points.some((r: string) => !route.includes(r)) ||
    p.required > points.length
  )
    bad('checkpoints');
  for (const [i, room] of route.entries()) {
    const next = route[(i + 1) % route.length];
    if (
      room === next ||
      (c.rooms[room] &&
        !Object.values(c.rooms[room].exits).some((e: any) => refString(e.to) === next))
    )
      bad(`route[${i}]`);
  }
  return out;
}

function ownership(c: Obj, q: Obj, p: Obj, at: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const bad = (field: string) => out.push(diag('OUTCOME_MISMATCH', `${at}.patrol.${field}`));
  const route = p.route.map(refString);
  const npc = c.npcs[refString(p.npc)];
  if (
    npc &&
    (npc.hp || npc.attack || npc.daily_schedule || refString(npc.room) !== route[p.initial_cursor])
  )
    bad('npc');
  const trust = c.facts[refString(p.trust_fact)];
  if (
    trust &&
    (trust.value_type.type !== 'bool' ||
      trust.value_type.default !== false ||
      JSON.stringify(trust.scopes) !== '["player"]')
  )
    bad('trust_fact');
  if (q.objective.evidence !== 'patrol' || q.offer || q.repeatable || q.deadline || q.exchange)
    bad('quest');
  for (const capability of ['patrol', 'movement', 'quest', 'dialogue', 'fact', 'death'])
    if (c.lock.capabilities[capability] !== 1)
      out.push(diag('UNDECLARED_CAPABILITY', `${at}.patrol`, { capability }, [`${capability}@1`]));
  for (const other of Object.values(c.quests ?? {}) as Obj[])
    if (
      other !== q &&
      other.patrol &&
      (refString(other.patrol.npc) === refString(p.npc) ||
        refString(other.patrol.trust_fact) === refString(p.trust_fact))
    )
      bad('npc');
  return out;
}

function conflicts(c: Obj, q: Obj, p: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [key, d] of Object.entries(c.dialogues ?? {}) as [string, Obj][])
    for (const [choice, o] of Object.entries(d.choices) as [string, Obj][]) {
      if (
        o.accept &&
        refString(o.accept) === refString({ ...p.npc, kind: 'quest', key: q.key }) &&
        o.patrol?.transition !== 'start'
      )
        out.push(
          diag(
            'OUTCOME_MISMATCH',
            `.cartridge.dialogues${step(key)}.choices${step(choice)}.accept`,
          ),
        );
      if (o.escort && refString(d.roles[o.escort.npc]?.npc ?? {}) === refString(p.npc))
        out.push(
          diag(
            'OUTCOME_MISMATCH',
            `.cartridge.dialogues${step(key)}.choices${step(choice)}.escort`,
          ),
        );
    }
  return out;
}

export function patrolChoice(o: Obj, d: Obj, at: string, c: Obj, checks: Checks): Diagnostic[] {
  const p = o.patrol;
  if (!p) return [];
  checks.named(p.quest, 'quest', `${at}.patrol.quest`);
  const q = c.quests[refString(p.quest)];
  const role = d.roles[p.npc];
  return q?.patrol &&
    role?.role === 'npc' &&
    refString(role.npc) === refString(q.patrol.npc) &&
    !d.quest &&
    (p.transition === 'start' ? refString(o.accept ?? {}) === refString(p.quest) : !o.accept) &&
    !o.escort &&
    !o.sequence &&
    !o.payment &&
    !o.lesson_payment &&
    !o.receive &&
    !o.hand_over
    ? []
    : [diag('OUTCOME_MISMATCH', `${at}.patrol`)];
}
