import type { BandTable, EntityId, Key, ResourceView, StatusDefinition } from '../contracts.gen.ts';
import { refString, type World } from '../runtime/decision.ts';
import { level, resourceRef, resourceSpec } from '../mechanics/resource.ts';
import { cmp } from '../foundation/validate.ts';
import { activeStatuses } from '../mechanics/status/shared.ts';

// The engine default condition bands of 04 §15 (amendments 2026-10-01, 2026-10-02), highest
// cut first, with their tones; a pool's own bands, else the cartridge's world.bands, replace it.
const BANDS: BandTable = (
  [
    [100, 'perfect_health', 'normal'],
    [90, 'slightly_scratched', 'normal'],
    [80, 'few_bruises', 'normal'],
    [70, 'some_cuts', 'warning'],
    [60, 'several_wounds', 'warning'],
    [50, 'many_nasty_wounds', 'warning'],
    [40, 'bleeding_freely', 'warning'],
    [30, 'covered_in_blood', 'danger'],
    [20, 'leaking_guts', 'danger'],
    [10, 'almost_dead', 'danger'],
    [0, 'dying', 'danger'],
  ] as const
).map(([at_percent, key, tone]) => ({ at_percent, key: key as Key, tone }));

// The body's resources at the clock (mechanics/resource.ts level), in DefinitionRefString order, each with
// the first band of its table whose cut p reaches, compared in integers (p measured from the
// minimum; maximum = minimum gives the top row; 32-bit ResourceInts keep every product exact).
export function resources(world: World, body: EntityId | undefined): ResourceView[] {
  if (!body) return [];
  return Object.values(world.resourceSpecs)
    .filter(
      (s) =>
        !Object.values(world.cartridge.services ?? {}).some(
          (service) => service.benefit.kind === 'meal' && service.benefit.stock.key === s.key,
        ),
    )
    .map(({ key: k, bands }) => {
      const resource = resourceRef(world, k);
      const { minimum, maximum } = resourceSpec(world, body, resource);
      const current = level(world, body, resource)!;
      const { key: band, tone } = (bands ?? world.cartridge.world?.bands ?? BANDS).find(
        (b) => 100 * (current - minimum) >= b.at_percent * (maximum - minimum),
      )!;
      return { resource, current, maximum, band, tone };
    })
    .sort((a, b) => cmp(refString(a.resource), refString(b.resource)));
}

// Active statuses on the body (toolbox rows 1, W8), absent when none; kind is the icon polarity
// (loka-x6t.64), never the modifier amounts.
export function conditionViews(world: World, body: EntityId | undefined) {
  if (!body) return {};
  const conditions = activeStatuses(world, body).map(({ spec, row }) => ({
    label: spec.label,
    ...(row.job_id && {
      ends_at: row.ends_at,
      duration: spec.duration as number, // the ring denominator (loka-x6t.65)
      next_tick_at: row.next_tick_at,
    }), // none: row W8
    resource: spec.resource.key as Key,
    ...(spec.per_tick !== undefined && { per_tick: spec.per_tick }),
    tick_every: spec.tick_every,
    ...(polarity(spec) && { kind: polarity(spec) }),
  }));
  return conditions.length > 0 ? { conditions } : {};
}

// The authored kind, else debuff on any harm, buff on any gain, none for a status with no effect.
function polarity(s: StatusDefinition): 'buff' | 'debuff' | undefined {
  if (s.kind) return s.kind;
  const tick = s.per_tick ?? 0;
  const amounts = [
    ...(s.modifies ?? []).map((m) => m.modifier),
    ...Object.values(s.resistances ?? {}),
  ];
  const cost = s.movement?.cost_percent ?? 100;
  const { sight, hearing } = s.perception ?? {};
  if (tick < 0 || amounts.some((n) => n < 0) || s.fear || s.blocks || s.allows) return 'debuff';
  if (sight === 'blind' || hearing === 'deaf' || cost > 100) return 'debuff';
  const gain = tick > 0 || amounts.some((n) => n > 0) || sight || cost < 100;
  return gain || s.movement?.passes || s.concealment ? 'buff' : undefined;
}
