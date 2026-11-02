// The rule explainer's policy report as sentences for the author panel
// (docs/system/cartridge.md#author-preview). The record below names every policy leaf, so a new
// leaf does not compile until it has its sentence.
import type { Policy } from '../src/contracts.gen.ts';

type Leaf = Exclude<Policy, { op: 'all' | 'any' | 'not' }>;
type Verdict = boolean | 'depends'; // depends: on a target the question has not chosen yet
type Annotated = Policy & { holds?: Verdict };
export type Row = { text: string; ok: Verdict; depth: number };

const ON = { lunar: 'moon', weather: 'weather', season: 'season', tide: 'tide' } as const;
const WORDS: { [O in Leaf['op']]: (p: Extract<Leaf, { op: O }>) => string } = {
  target_present: () => 'the target is here',
  has_item: (p) => `item ${p.item.key} is held`,
  quest_state: (p) => `quest ${p.quest.key} is ${p.state}`,
  fact_compare: (p: Extract<Leaf, { op: 'fact_compare' }> & { now?: unknown }) =>
    p.now === undefined
      ? `fact ${p.fact.key} on the target needs ${JSON.stringify(p.equals)}`
      : `fact ${p.fact.key} is ${p.now === null ? 'unset' : JSON.stringify(p.now)}; needs ${JSON.stringify(p.equals)}`,
  fact_at_least: (p) => `fact ${p.fact.key} is at least ${p.at_least}`,
  time_window: (p) => `the time of day is from ${p.from} to ${p.to}`,
  barrier_state: (p) => `barrier ${p.barrier.key} is ${p.equals}`,
  stat_compare: (p) => `attribute ${p.attribute.key} is at least ${p.at_least}`,
  level_compare: (p) => `level is at least ${p.at_least}`,
  resource_compare: (p) =>
    `pool ${p.resource.key} is at least ${p.at_least_percent === undefined ? p.at_least : `${p.at_least_percent}%`}`,
  escort_state: (p) => `escort ${p.quest.key} is ${p.state}`,
  light_off: () => 'the light is off',
  has_tag: (p) =>
    `${p.item ? `item ${p.item.key}` : p.barrier ? `barrier ${p.barrier.key}` : p.room ? `room ${p.room.key}` : `the ${p.subject}`} has tag ${p.tag}`,
  sky: (p) => {
    const on = (['lunar', 'weather', 'season', 'tide'] as const).find((k) => p[k] !== undefined)!;
    return `the ${ON[on]} is ${p[on]}`;
  },
  wearing: (p) => `something tagged ${p.tag} is worn`,
  visited_count: (p) => `room ${p.room.key} was visited at least ${p.at_least} times`,
  skill_compare: (p) => `skill ${p.skill.key} is at least ${p.at_least}`,
  population_count: (p) => `population ${p.plan.key} has at least ${p.at_least} alive`,
  status_active: (p) => `status ${p.status.key} is on the ${p.subject}`,
  item_present: (p) => `an item tagged ${p.tag} is here`,
  npc_present: (p) => `npc ${p.npc.key} is here`,
  cue_perceived: (p) => `the ${p.sense} of npc ${p.npc.key} is perceived`,
  time_since: (p) => `at least ${p.at_least} has passed since fact ${p.fact.key}`,
};

// One tree's rows, parents before children, each branch's verdict from its leaves. A `not` adds no
// row: it folds into what it covers (De Morgan), so a met `not` reads green all the way down.
function rows(p: Annotated, depth: number, negated = false): { ok: Verdict; rows: Row[] } {
  if (p.op === 'not') return rows(p.item, depth, !negated);
  if (p.op === 'all' || p.op === 'any') {
    const all = (p.op === 'all') !== negated;
    const kids = p.items.map((x) => rows(x, depth + 1, negated));
    const has = (v: Verdict) => kids.some((k) => k.ok === v);
    const ok: Verdict = has(!all)
      ? !all // one leaf settles it, whatever the target
      : has('depends')
        ? 'depends'
        : all;
    return {
      ok,
      rows: [
        { text: all ? 'all of these' : 'any one of these', ok, depth },
        ...kids.flatMap((k) => k.rows),
      ],
    };
  }
  const ok = p.holds === 'depends' ? p.holds : (p.holds === true) !== negated;
  // a negated yes/no fact needs the other answer; any other negated leaf says so first
  const flip = negated && p.op === 'fact_compare' && typeof p.equals === 'boolean';
  const said = (WORDS[p.op as Leaf['op']] as (p: Policy) => string)(
    flip ? { ...p, equals: !p.equals } : p,
  );
  return { ok, rows: [{ text: negated && !flip ? `not: ${said}` : said, ok, depth }] };
}

/** The asked definition's policy as sentences; no policy holds without saying anything more. */
export function sentences(asked: { policy?: unknown } | undefined): Row[] {
  if (!asked?.policy) return [{ text: 'It has no conditions.', ok: true, depth: 0 }];
  return rows(asked.policy as Annotated, 0).rows;
}
