import type { Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, type Checks, type Obj } from './cartridge_refs.ts';

/** Loader twin of Loka.Content.Expedition; no route values live in the kernel. */
export function expedition(c: Obj, q: Obj, at: string, checks: Checks): Diagnostic[] {
  const e = q.expedition;
  if (!e)
    return q.objective.evidence === 'expedition'
      ? [diag('OUTCOME_MISMATCH', `${at}.objective`)]
      : [];
  const out: Diagnostic[] = [];
  const bad = (field: string) => out.push(diag('OUTCOME_MISMATCH', `${at}.expedition.${field}`));
  references(e, at, checks);
  route(c, e, at, checks, bad);
  declarations(c, q, bad);
  for (const capability of [
    'expedition',
    'movement',
    'quest',
    'fact',
    'combat',
    'death',
    'population',
  ])
    if (c.lock.capabilities[capability] !== 1)
      out.push(
        diag('UNDECLARED_CAPABILITY', `${at}.expedition`, { capability }, [`${capability}@1`]),
      );
  for (const name of Object.keys(e.narration))
    checks.text(e.narration, [name], `${at}.expedition.narration`);
  return out;
}

function references(e: Obj, at: string, checks: Checks) {
  for (const [field, kind] of [
    ['start_room', 'room'],
    ['shelter_room', 'room'],
    ['survived_fact', 'fact'],
    ['faction', 'fact'],
    ['hound_population', 'population'],
  ] as const)
    checks.named(e[field], kind, `${at}.expedition.${field}`);
  e.footprint.forEach((r: Obj, i: number) =>
    checks.named(r, 'room', `${at}.expedition.footprint[${i}]`),
  );
}

function route(c: Obj, e: Obj, at: string, checks: Checks, bad: (field: string) => void) {
  e.route.forEach((edge: Obj, i: number) => {
    checks.named(edge.from, 'room', `${at}.expedition.route[${i}].from`);
    checks.named(edge.to, 'room', `${at}.expedition.route[${i}].to`);
    const from = c.rooms[refString(edge.from)];
    const exit = from?.exits[edge.direction];
    // A route over a hidden face (toolbox row 11) would show it in the quest journal.
    if (from && (refString(exit?.to ?? {}) !== refString(edge.to) || exit.hidden_until))
      bad(`route[${i}]`);
    if (
      i === 0
        ? refString(edge.from) !== refString(e.start_room)
        : refString(edge.from) !== refString(e.route[i - 1].to)
    )
      bad(`route[${i}]`);
    if (
      ![edge.from, edge.to].every((r) =>
        e.footprint.some((f: any) => refString(f) === refString(r)),
      )
    )
      bad(`route[${i}]`);
  });
  if (
    e.route.length < 3 ||
    refString(e.route[2]?.to) !== refString(e.shelter_room) ||
    new Set(e.footprint.map(refString)).size !== e.footprint.length ||
    !e.footprint.some((r: any) => refString(r) === refString(e.start_room))
  )
    bad('route');
}

function declarations(c: Obj, q: Obj, bad: (field: string) => void) {
  const e = q.expedition;
  for (const [detail, room] of [
    [e.start_detail, e.start_room],
    [e.shelter_detail, e.shelter_room],
  ])
    if (c.rooms[refString(room)] && !c.rooms[refString(room)].details?.[detail])
      bad('start_detail');
  const survived = c.facts[refString(e.survived_fact)];
  if (
    survived &&
    (survived.value_type.type !== 'bool' ||
      survived.value_type.default !== false ||
      JSON.stringify(survived.scopes) !== '["player"]')
  )
    bad('survived_fact');
  const faction = c.facts[refString(e.faction)];
  if (
    faction &&
    (faction.value_type.type !== 'int' || JSON.stringify(faction.scopes) !== '["player"]')
  )
    bad('faction');
  const hounds = c.populations[refString(e.hound_population)];
  if (hounds && !hounds.pack) bad('hound_population');
  if (
    q.objective.evidence !== 'expedition' ||
    q.offer ||
    q.repeatable ||
    q.deadline ||
    q.exchange ||
    q.patrol
  )
    bad('quest');
}
