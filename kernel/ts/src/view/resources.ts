import type { BandTable, Key, ResourceView } from '../contracts.gen.ts';
import { refString, type World } from '../runtime/decision.ts';
import { level, resourceRef, resourceSpec } from '../mechanics/resource.ts';
import { cmp } from '../foundation/validate.ts';

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
export function resources(world: World): ResourceView[] {
  return Object.values(world.resourceSpecs)
    .filter(
      (s) =>
        !Object.values(world.cartridge.services ?? {}).some(
          (service) => service.benefit.kind === 'meal' && service.benefit.stock.key === s.key,
        ),
    )
    .map(({ key: k, bands }) => {
      const resource = resourceRef(world, k);
      const { minimum, maximum } = resourceSpec(world, world.body, resource);
      const current = level(world, world.body, resource)!;
      const { key: band, tone } = (bands ?? world.cartridge.world?.bands ?? BANDS).find(
        (b) => 100 * (current - minimum) >= b.at_percent * (maximum - minimum),
      )!;
      return { resource, current, maximum, band, tone };
    })
    .sort((a, b) => cmp(refString(a.resource), refString(b.resource)));
}
