import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { checkers, diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';
import { foreignRefs } from './cartridge_position.ts';

export function services(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [],
    check = checkers(c, out);
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  const all = Object.values((c.services ?? {}) as Obj);
  const floor = all.some(barters)
    ? 101
    : all.some((s) => banks(s.benefit))
      ? 83
      : all.some(timed)
        ? 80
        : all.some((s) => s.benefit.escrow)
          ? 79
          : 23;
  if (all.length && (major < 1 || (major === 1 && minor < floor)))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, s] of Object.entries((c.services ?? {}) as Obj))
    definition(c, s, ref, check, out);
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj)) {
    const at = `.cartridge.npcs${step(ref)}.services`;
    const keys = (npc.services ?? []).map((r: Obj) => refString(r as never));
    if (new Set(keys).size !== keys.length) bad(out, at);
    for (const r of npc.services ?? []) {
      const s = get(c, check, r, 'service', at);
      if (s && refString(s.provider) !== ref) bad(out, at);
    }
  }
  beds(c, check, out);
  owned(c, out);
  return out;
}

// Toolbox row 20b: a timed order's fact belongs to its commission alone; another entitlement
// setting it would open an order with no inputs and no job (Built rooms S3: or a build commission).
function owned(c: Obj, out: Diagnostic[]) {
  const entries = Object.entries((c.services ?? {}) as Obj),
    fact = (s: Obj) => commission(s.benefit) && refString(s.benefit.fact);
  const owner = new Map(
    entries.filter(([, s]) => s.benefit.escrow?.ready_after).map(([r, s]) => [fact(s), r]),
  );
  for (const [ref, s] of entries)
    if (fact(s) && owner.has(fact(s)) && owner.get(fact(s)) !== ref)
      bad(out, `.cartridge.services${step(ref)}.benefit.fact`);
}

function definition(c: Obj, s: Obj, ref: string, check: Checks, out: Diagnostic[]) {
  const at = `.cartridge.services${step(ref)}`;
  if (c.lock.capabilities.service !== 1)
    out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'service' }, ['service@1']));
  check.text(s, ['label', 'narration'], at);
  const reasons = refusals(s.benefit);
  check.text(reasons, Object.keys(reasons), at);
  const npc = get(c, check, s.provider, 'npc', `${at}.provider`);
  const currency = get(c, check, s.currency, 'resource', `${at}.currency`);
  const action = Object.values(c.actions as Obj).find((a) => a.key === s.action);
  if (!action || action.command !== 'use_service') bad(out, `${at}.action`);
  if (!finite(currency) || npc?.resource_starts?.[s.currency.key] === undefined)
    bad(out, `${at}.currency`);
  if (!npc?.services?.some((r: Obj) => refString(r as never) === ref)) bad(out, `${at}.provider`);
  const b = s.benefit;
  // Row kgd.70: only an escrowed entitlement may be free (a barter); any other benefit is paid.
  if (s.price === 0 && !(b.kind === 'entitlement' && b.escrow)) bad(out, `${at}.price`);
  if (commission(b)) {
    const fact = get(c, check, b.fact, 'fact', `${at}.benefit.fact`);
    if (
      fact &&
      (fact.value_type.type !== 'bool' ||
        fact.value_type.default !== false ||
        !same(fact.scopes, ['player']))
    )
      bad(out, `${at}.benefit.fact`);
    if (b.escrow) escrow(c, b.escrow, `${at}.benefit.escrow`, check, out);
    if (b.kind === 'build') build(c, b, at, check, out);
  } else if (b.kind in sited) sited[b.kind as keyof typeof sited](c, b, at, check, out);
  else if (banks(b)) bank(c, s, at, check, out);
  else if (ordered(b)) order(c, b, at, check, out);
  else {
    const recovery = get(c, check, b.recovery, 'resource', `${at}.benefit.recovery`);
    if (recovery && recovery.key !== 'mv') bad(out, `${at}.benefit.recovery`);
    stock(c, s, npc, at, check, out);
  }
}

// Only a timed order (20b) settles, a claim one with an output (Built rooms S3: a build raises its
// room); a barter (row kgd.70) hands its output over and leaves no order open.
function order(c: Obj, b: Obj, at: string, check: Checks, out: Diagnostic[]) {
  const commission = get(c, check, b.service, 'service', `${at}.benefit.service`);
  const e = commission?.benefit.escrow;
  if (commission && !(e?.ready_after && (b.kind === 'cancel' || e.output)))
    bad(out, `${at}.benefit.service`);
}

const sited = { repair, build, mend, raze };

// The refusal texts a service needs, by benefit.
function refusals(b: Obj) {
  const kind = b.kind;
  if (banks(b)) return { payment: 'service.unaffordable', funds: 'service.no_funds' };
  if (kind === 'build')
    return {
      payment: 'service.unaffordable',
      site: 'service.site_taken',
      full: 'service.construction_full',
      ...(b.escrow && { headroom: 'service.order_open', inputs: 'service.missing_inputs' }),
    };
  if (kind === 'mend' || kind === 'raze')
    return {
      payment: 'service.unaffordable',
      target: `service.nothing_to_${kind}`,
      ...(kind === 'raze' && { occupied: 'service.occupied' }),
      ...(b.escrow && { inputs: 'service.missing_inputs' }),
    };
  if (ordered(b))
    return {
      payment: 'service.unaffordable',
      order: 'service.no_order',
      ...(kind === 'claim'
        ? { wait: 'service.not_ready', output: 'service.no_output' }
        : { ready: 'service.ready' }),
    };
  return {
    payment: 'service.unaffordable',
    headroom: b.escrow
      ? 'service.order_open'
      : ({ entitlement: 'service.already_paid', repair: 'service.full_durability' }[
          kind as string
        ] ?? 'service.full_mv'),
    ...(kind === 'repair'
      ? { target: 'service.nothing_to_repair' }
      : kind !== 'entitlement' && { stock: 'service.sold_out' }),
    ...(b.escrow && { inputs: 'service.missing_inputs' }),
    ...(b.escrow?.output && { output: 'service.no_output' }),
  };
}

// Toolbox row 20a: distinct items held to a room; no shop offer (commerce save reconciles offer
// custody by receipt and would refuse a service transfer of one).
function escrow(c: Obj, e: Obj, at: string, check: Checks, out: Diagnostic[]) {
  const keys = e.items.map((r: Obj) => refString(r as never));
  const offered = Object.values((c.npcs ?? {}) as Obj).flatMap((n) =>
    (n.shop?.offers ?? []).map((o: Obj) => refString(o.item)),
  );
  keys.forEach((k: string, i: number) => {
    get(c, check, e.items[i], 'item', `${at}.items[${i}]`);
    if (offered.includes(k)) bad(out, `${at}.items[${i}]`);
  });
  if (new Set(keys).size !== keys.length) out.push(diag('DUPLICATE_DEFINITION', `${at}.items`));
  get(c, check, e.custody, 'room', `${at}.custody`);
  if (e.quantity > keys.length) bad(out, `${at}.quantity`);
  // Toolbox row 20b: the finished output already lies in custody.
  const output = e.output && get(c, check, e.output, 'item', `${at}.output`);
  if (output && (output.location.in !== 'room' || !same(output.location.room, e.custody)))
    bad(out, `${at}.output`);
  if (e.ready_after && !Object.hasOwn(c.lock.capabilities, 'schedule'))
    out.push(
      diag('UNDECLARED_CAPABILITY', `${at}.ready_after`, { capability: 'schedule' }, [
        'schedule@1',
      ]),
    );
}

// Toolbox row 25: the account is a bounded int player fact from 0 that no other engine writer
// owns, the vault an NPC holding the currency, both able to hold `amount`, and every service on one
// account names one vault and one currency.
function bank(c: Obj, s: Obj, at: string, check: Checks, out: Diagnostic[]) {
  const b = s.benefit,
    fact = get(c, check, b.account, 'fact', `${at}.benefit.account`),
    t = fact?.value_type,
    pool = c.resources?.[refString(s.currency)];
  if (
    fact &&
    (t.type !== 'int' ||
      t.minimum !== 0 ||
      !Number.isSafeInteger(t.maximum) ||
      t.default !== 0 ||
      !same(fact.scopes, ['player']) ||
      foreignRefs(c).includes(refString(b.account)))
  )
    bad(out, `${at}.benefit.account`);
  if (
    (fact && t.maximum - t.minimum < b.amount) ||
    (pool && pool.maximum - pool.minimum < b.amount)
  )
    bad(out, `${at}.benefit.amount`);
  const vault = get(c, check, b.vault, 'npc', `${at}.benefit.vault`);
  const clash = Object.values(c.services as Obj).some(
    (o) =>
      banks(o.benefit) &&
      same(o.benefit.account, b.account) &&
      !same([o.benefit.vault, o.currency], [b.vault, s.currency]),
  );
  if (vault && (vault.resource_starts?.[s.currency.key] === undefined || clash))
    bad(out, `${at}.benefit.vault`);
}

// Toolbox row 21: a repair restores a fact some weapon's durability names.
function repair(c: Obj, b: Obj, at: string, check: Checks, out: Diagnostic[]) {
  get(c, check, b.fact, 'fact', `${at}.benefit.fact`);
  const items = Object.values((c.items ?? {}) as Obj);
  if (!items.some((i) => i.weapon?.durability && same(i.weapon.durability.fact, b.fact)))
    bad(out, `${at}.benefit.fact`);
}

// Built rooms S2: the site is a room whose site lists both the direction and the blueprint.
function build(c: Obj, b: Obj, at: string, check: Checks, out: Diagnostic[]) {
  const blueprint = get(c, check, b.blueprint, 'blueprint', `${at}.benefit.blueprint`);
  const room = get(c, check, b.site, 'room', `${at}.benefit.site`);
  if (!room) return;
  if (blueprint && !room.site?.blueprints.some((r: Obj) => same(r, b.blueprint)))
    bad(out, `${at}.benefit.blueprint`);
  if (!room.site?.directions.includes(b.direction)) bad(out, `${at}.benefit.direction`);
}

// Built rooms S4: the site lists the direction and some blueprint with a ruin to cure.
function mend(c: Obj, b: Obj, at: string, check: Checks, out: Diagnostic[]) {
  if (b.escrow) escrow(c, b.escrow, `${at}.benefit.escrow`, check, out);
  const room = get(c, check, b.site, 'room', `${at}.benefit.site`);
  if (!room) return;
  if (!room.site?.directions.includes(b.direction)) bad(out, `${at}.benefit.direction`);
  if (!room.site?.blueprints.some((r: Obj) => c.blueprints?.[refString(r as never)]?.ruin))
    bad(out, `${at}.benefit.site`);
}

// Built rooms S5: the site lists the direction (and so some blueprint to raze).
function raze(c: Obj, b: Obj, at: string, check: Checks, out: Diagnostic[]) {
  const room = get(c, check, b.site, 'room', `${at}.benefit.site`);
  if (room && !room.site?.directions.includes(b.direction)) bad(out, `${at}.benefit.direction`);
}

function stock(c: Obj, s: Obj, npc: Obj | undefined, at: string, check: Checks, out: Diagnostic[]) {
  const b = s.benefit;
  if (b.kind === 'meal') {
    const spec = get(c, check, b.stock, 'resource', `${at}.benefit.stock`);
    if (
      !finite(spec) ||
      npc?.resource_starts?.[b.stock.key] === undefined ||
      same(b.stock, s.currency) ||
      spec.maximum - spec.minimum < b.debit
    )
      bad(out, `${at}.benefit.stock`);
  } else {
    const item = get(c, check, b.vessel, 'item', `${at}.benefit.vessel`),
      liquid = get(c, check, b.liquid, 'liquid', `${at}.benefit.liquid`);
    if (
      !item?.vessel ||
      item.location.in !== 'npc' ||
      !same(item.location.npc, s.provider) ||
      !same(item.vessel.initial.kind, b.liquid) ||
      liquid?.drink_amount > item.vessel.capacity ||
      item.vessel.initial.quantity < liquid?.drink_amount
    )
      bad(out, `${at}.benefit.vessel`);
  }
}

function beds(c: Obj, check: Checks, out: Diagnostic[]) {
  for (const [ref, room] of Object.entries((c.rooms ?? {}) as Obj))
    for (const [key, d] of Object.entries((room.details ?? {}) as Obj))
      if (d.bed) {
        const at = `.cartridge.rooms${step(ref)}.details${step(key)}.bed`;
        const f = get(c, check, d.bed.entitlement, 'fact', `${at}.entitlement`);
        check.text(d.bed, ['title'], at);
        if (f && (f.value_type.type !== 'bool' || !same(f.scopes, ['player'])))
          bad(out, `${at}.entitlement`);
        if (c.lock.capabilities.position !== 1 || c.lock.capabilities.service !== 1) bad(out, at);
      }
}
const commission = (b: Obj) => b.kind === 'entitlement' || (b.kind === 'build' && !!b.fact),
  ordered = (b: Obj) => b.kind === 'claim' || b.kind === 'cancel';
const banks = (b: Obj) => b.kind === 'deposit' || b.kind === 'withdraw';
// Row kgd.70 (API 1.101): a free service, or an output handed over at once (no ready_after).
const barters = (s: Obj) =>
  s.price === 0 || (s.benefit.escrow?.output !== undefined && !s.benefit.escrow.ready_after);
const timed = (s: Obj) => ordered(s.benefit) || s.benefit.escrow?.ready_after !== undefined;
const finite = (r: Obj | undefined): r is Obj => !!r && r.gain === 0 && !r.regen;
const bad = (out: Diagnostic[], at: string) =>
  out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
function get(c: Obj, check: Checks, r: Obj, kind: string, at: string): Obj | undefined {
  check.named(r, kind, at);
  return c[`${kind}s`]?.[refString(r as never)];
}
