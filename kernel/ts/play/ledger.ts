// `node kernel/ts/play/ledger.ts <artifact>` (docs/system/cartridge.md#economy-and-ecology-ledger-balance-tool-1):
// loads a `mix loka.compile` artifact and prints where its coins and items come from and go, and
// what lives and regrows, as one canonical JSON document. A report for authors, not a check.
import { readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { type Obj } from '../src/content/cartridge_refs.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { refString } from '../src/runtime/decision.ts';
import { contentGraph } from './reach.ts';

type Row = Obj & { site: string; ref: string; choice?: string; item?: string };

// the graph paths each money site names its currency at, by the enclosing definition's kind
const PAID: [string, RegExp][] = [
  ['npc', /^\.shop\.resource$/],
  ['service', /^\.currency$/],
  ['transport', /^\.currency$/],
  ['dialogue', /^\.choices\.[a-z0-9_]+\.(lesson_)?payment\.resource$/],
];
const LISTS = {
  coin_faucets: ['payment', 'shop_sell'],
  coin_sinks: ['lesson', 'service', 'shop_buy', 'transport'],
  item_faucets: ['drop', 'receive'],
  item_sinks: ['edible', 'hand_over'],
};

// '\0' sorts before every key character, so a shorter field orders first
const by =
  <T>(key: (x: T) => (string | undefined)[]) =>
  (a: T, b: T) => {
    const [ka, kb] = [key(a).join('\0'), key(b).join('\0')];
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
const defs = (c: Obj, section: string) => Object.entries((c[section] ?? {}) as Obj);

/** The static economy and ecology ledger (cartridge.md "Economy and ecology ledger"). */
export function ledger(c: Obj) {
  const rows = [...npcRows(c), ...routeRows(c), ...choiceRows(c), ...edibleRows(c)].sort(
    by((r) => [r.site, r.ref, r.choice, r.item]),
  );
  const list = (sites: string[]) => rows.filter((r) => sites.includes(r.site));
  const coins = list([...LISTS.coin_faucets, ...LISTS.coin_sinks]);
  const currencies = [...new Set(coins.map((r) => r.resource as string))].sort();
  return {
    currencies: currencies.map((ref) => currency(c, ref)),
    coins: {
      faucets: list(LISTS.coin_faucets),
      sinks: list(LISTS.coin_sinks),
      unclassified: unclassified(c, currencies),
    },
    items: { faucets: list(LISTS.item_faucets), sinks: list(LISTS.item_sinks) },
    ecology: { populations: populations(c), seams: seams(c) },
  };
}

function currency(c: Obj, resource: string) {
  const spec = c.resources[resource];
  const purses = Object.fromEntries(
    defs(c, 'npcs')
      .filter(([, n]) => n.resource_starts?.[spec.key] !== undefined)
      .map(([ref, n]) => [ref, n.resource_starts[spec.key] as number]),
  );
  const supply = Object.values(purses).reduce((sum, v) => sum + v, spec.start);
  return { resource, player_start: spec.start, maximum: spec.maximum, purses, supply };
}

function npcRows(c: Obj): Row[] {
  return defs(c, 'npcs').flatMap(([ref, n]) => [
    ...(n.shop?.offers ?? []).flatMap((o: Obj) => {
      const at = { ref, item: refString(o.item), resource: refString(n.shop.resource) };
      const discount = n.shop.buy_discount && { buy_discount: n.shop.buy_discount };
      return [
        { site: 'shop_buy', ...at, amount: o.buy, ...discount },
        { site: 'shop_sell', ...at, amount: o.sell },
      ];
    }),
    ...(n.drops ?? []).map((d: Obj) => ({
      site: 'drop',
      ref,
      item: refString(d.item),
      chance: d.chance,
    })),
  ]);
}

function routeRows(c: Obj): Row[] {
  const row = (
    site: string,
    ref: string,
    npc: DefinitionRef,
    currency: DefinitionRef,
    amount: number,
  ) => ({
    site,
    ref,
    npc: refString(npc),
    resource: refString(currency),
    amount,
  });
  return [
    ...defs(c, 'services').map(([ref, s]) => {
      const stock =
        s.benefit.stock && c.npcs[refString(s.provider)].resource_starts?.[s.benefit.stock.key];
      return {
        ...row('service', ref, s.provider, s.currency, s.price),
        ...(stock !== undefined && { stock }),
      };
    }),
    ...defs(c, 'transports').map(([ref, t]) =>
      row('transport', ref, t.recipient, t.currency, t.fare),
    ),
  ];
}

function choiceRows(c: Obj): Row[] {
  return defs(c, 'dialogues').flatMap(([ref, d]) =>
    Object.entries(d.choices as Obj).flatMap(([choice, o]): Row[] => {
      const role = (name: string, kind: 'npc' | 'item') => refString(d.roles[name][kind]);
      const pay = (site: string, p: Obj, npc: string) => ({
        site,
        ref,
        choice,
        npc: role(npc, 'npc'),
        resource: refString(p.resource),
        amount: p.amount,
      });
      const give = (site: string, item: string, npc: string) => ({
        site,
        ref,
        choice,
        item: role(item, 'item'),
        npc: role(npc, 'npc'),
      });
      const through = o.availability?.through;
      return [
        ...(o.lesson_payment ? [pay('lesson', o.lesson_payment, o.lesson_payment.to)] : []),
        ...(o.payment
          ? [
              {
                ...pay('payment', o.payment, o.payment.from),
                ...(through !== undefined && { through }),
              },
            ]
          : []),
        ...(o.receive ? [give('receive', o.receive.item, o.receive.from)] : []),
        ...(o.hand_over ? [give('hand_over', o.hand_over.item, o.hand_over.to)] : []),
      ];
    }),
  );
}

function edibleRows(c: Obj): Row[] {
  return defs(c, 'items')
    .filter(([, i]) => i.edible)
    .map(([ref, i]) => ({
      site: 'edible',
      ref,
      resource: refString(i.edible.resource),
      amount: i.edible.amount,
    }));
}

// graph edges to a currency at a path no money site above reads it from
function unclassified(c: Obj, currencies: string[]) {
  const { nodes, edges } = contentGraph(c);
  const kind = new Map(nodes.map((n) => [n.ref, n.kind]));
  const paid = (from: string, path: string) =>
    PAID.some(([k, re]) => kind.get(from) === k && re.test(path));
  return edges
    .filter((e) => currencies.includes(e.to) && !paid(e.from, e.path))
    .map((e) => ({ from: e.from, path: e.path, resource: e.to }))
    .sort(by((e) => [e.from, e.path]));
}

function populations(c: Obj) {
  return defs(c, 'populations')
    .map(([ref, p]) => {
      const b = c.population_bundles[refString(p.bundle)];
      return {
        ref,
        home: refString(p.home),
        area: p.area.map(refString),
        cap: p.cap,
        day_target: p.day_target,
        night_target: p.night_target,
        replacement_delay: p.replacement_delay,
        npc: refString(b.npc),
        ...(b.item && { item: refString(b.item) }),
        corpse: refString(b.corpse),
      };
    })
    .sort(by((p) => [p.ref]));
}

function seams(c: Obj) {
  return defs(c, 'rooms')
    .flatMap(([room, r]) =>
      Object.entries((r.details ?? {}) as Obj)
        .filter(([, d]) => d.harvest)
        .map(([detail, { harvest: h }]) => ({
          room,
          detail,
          items: h.items.length,
          ...(h.tool && { tool: h.tool.tag }),
          ...(h.careful && { careful: h.careful.count }),
        })),
    )
    .sort(by((s) => [s.room, s.detail]));
}

if (import.meta.main) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file || rest.length) {
    console.error('usage: node kernel/ts/play/ledger.ts <artifact>');
    process.exit(2);
  }
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.diagnostic));
    process.exit(1);
  }
  console.log(encode(ledger(loaded.cartridge as unknown as Obj) as unknown as Json));
}
