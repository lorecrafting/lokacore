// `node kernel/ts/play/power.ts <artifact>` (docs/system/cartridge.md#content-reports): loads a
// `mix loka.compile` artifact and prints its derived-stat power curve by level and its item sheet as
// one canonical JSON document. A report for authors, not a check: nothing reads its output.
import { readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import type { DerivedStat, ItemAffect } from '../src/contracts.gen.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { saturate } from '../src/foundation/int.ts';
import { derived } from '../src/mechanics/attributes/shared.ts';
import { refString } from '../src/runtime/decision.ts';

type Values = Record<string, number>; // attribute DefinitionRefString -> value
type Table = { name: string; stat: DerivedStat; final: (bonus: number) => Json };

// The engine's bonus at these values: given its own `read`, derived never touches World or actor.
const bonus = (stat: DerivedStat, values: Values) =>
  derived(undefined as never, undefined as never, stat, (a) => values[refString(a)]);

// The authored derived tables whose base exists, each with its clamp (mechanics.md derived stats).
function tables(c: Obj): Table[] {
  const w = c.world ?? {};
  const attack = w.combat?.player_attack;
  const carry = w.carry?.max_grams;
  const hp = c.resources?.[`${c.manifest.id}@${c.manifest.version}:resource/hp`];
  const finals: [string, unknown, (b: number) => Json][] = [
    ['hit_chance', attack, (b) => Math.min(100, Math.max(0, saturate(attack.chance + b)))],
    [
      'damage',
      attack,
      (b) => [attack.damage_min, attack.damage_max].map((d) => Math.max(0, saturate(d + b))),
    ],
    ['carry_grams', carry, (b) => Math.max(0, saturate(carry + b))],
    ['hp_max', hp, (b) => Math.max(hp.minimum, saturate(hp.maximum + b))],
  ];
  return finals
    .filter(([name, base]) => w.derived?.[name] && base !== undefined)
    .map(([name, , final]) => ({ name, stat: w.derived[name], final }));
}

const starts = (c: Obj): Values =>
  Object.fromEntries(Object.entries((c.attributes ?? {}) as Obj).map(([r, a]) => [r, a.start]));

/** Per level, each table's final value with no point spent and with every point on its best term. */
export function powerCurve(c: Obj) {
  const levelling = c.world?.levelling;
  const base = starts(c);
  const ts = tables(c);
  return Array.from({ length: levelling ? levelling.thresholds.length + 1 : 1 }, (_, i) => {
    const points = saturate((levelling?.points_per_level ?? 0) * i);
    const level: Obj = { level: i + 1 };
    for (const { name, stat, final } of ts) {
      const focused = Math.max(
        ...stat.terms.map(({ attribute }) => {
          const r = refString(attribute);
          return bonus(stat, { ...base, [r]: saturate(base[r] + points) });
        }),
      );
      level[name] = { none: final(bonus(stat, base)), focused: final(focused) };
    }
    return level;
  });
}

/** Every item with a slot: its affects and what wearing it alone adds to each table's bonus. */
export function itemSheet(c: Obj) {
  const base = starts(c);
  const ts = tables(c);
  return Object.entries((c.items ?? {}) as Obj)
    .filter(([, i]) => i.slot)
    .map(([ref, i]) => {
      const affects: ItemAffect[] = i.affects ?? [];
      // attributes@1 order: each attribute's modifiers summed and saturated, then added to the start
      const sums: Values = {};
      for (const a of affects)
        sums[refString(a.attribute)] = (sums[refString(a.attribute)] ?? 0) + a.modifier;
      const worn = { ...base };
      for (const [r, sum] of Object.entries(sums)) worn[r] = saturate(base[r] + saturate(sum));
      const delta = Object.fromEntries(
        ts.map(({ name, stat }) => [name, bonus(stat, worn) - bonus(stat, base)]),
      );
      return {
        ref,
        slot: i.slot as string,
        affects,
        affect_total: affects.reduce((s, a) => s + a.modifier, 0),
        delta,
        ...(i.mass_grams !== undefined && { mass_grams: i.mass_grams }),
        ...(i.tags && { tags: i.tags }),
      };
    })
    .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.ref < b.ref ? -1 : 1));
}

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || rest.length) {
    console.error('usage: node kernel/ts/play/power.ts <artifact>');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  const c = loaded.cartridge as unknown as Obj;
  console.log(encode({ levels: powerCurve(c), items: itemSheet(c) } as unknown as Json));
}
