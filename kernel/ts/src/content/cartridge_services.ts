import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { checkers, diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function services(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [],
    check = checkers(c, out);
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  const repairs = Object.values((c.services ?? {}) as Obj).some((s) => s.benefit.kind === 'repair');
  if (
    (Object.keys(c.services ?? {}).length && (major < 1 || (major === 1 && minor < 23))) ||
    (repairs && apiCmp(c.manifest.requires.kernel_api.at_least, '1.69') < 0)
  )
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
  return out;
}

function definition(c: Obj, s: Obj, ref: string, check: Checks, out: Diagnostic[]) {
  const at = `.cartridge.services${step(ref)}`;
  if (c.lock.capabilities.service !== 1)
    out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'service' }, ['service@1']));
  check.text(s, ['label', 'narration'], at);
  const kind = s.benefit.kind;
  const reasons = {
    payment: 'service.unaffordable',
    headroom:
      { entitlement: 'service.already_paid', repair: 'service.full_durability' }[kind as string] ??
      'service.full_mv',
    ...(kind === 'repair'
      ? { target: 'service.nothing_to_repair' }
      : kind !== 'entitlement' && { stock: 'service.sold_out' }),
  };
  check.text(reasons, Object.keys(reasons), at);
  const npc = get(c, check, s.provider, 'npc', `${at}.provider`);
  const currency = get(c, check, s.currency, 'resource', `${at}.currency`);
  const action = Object.values(c.actions as Obj).find((a) => a.key === s.action);
  if (!action || action.command !== 'use_service') bad(out, `${at}.action`);
  if (!finite(currency) || npc?.resource_starts?.[s.currency.key] === undefined)
    bad(out, `${at}.currency`);
  if (!npc?.services?.some((r: Obj) => refString(r as never) === ref)) bad(out, `${at}.provider`);
  const b = s.benefit;
  if (b.kind === 'entitlement') {
    const fact = get(c, check, b.fact, 'fact', `${at}.benefit.fact`);
    if (
      fact &&
      (fact.value_type.type !== 'bool' ||
        fact.value_type.default !== false ||
        !same(fact.scopes, ['player']))
    )
      bad(out, `${at}.benefit.fact`);
  } else if (b.kind === 'repair') {
    // Toolbox row 21: a repair restores a fact some weapon's durability names.
    get(c, check, b.fact, 'fact', `${at}.benefit.fact`);
    const items = Object.values((c.items ?? {}) as Obj);
    if (!items.some((i) => i.weapon?.durability && same(i.weapon.durability.fact, b.fact)))
      bad(out, `${at}.benefit.fact`);
  } else {
    const recovery = get(c, check, b.recovery, 'resource', `${at}.benefit.recovery`);
    if (recovery && recovery.key !== 'mv') bad(out, `${at}.benefit.recovery`);
    stock(c, s, npc, at, check, out);
  }
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
const finite = (r: Obj | undefined): r is Obj => !!r && r.gain === 0 && !r.regen;
const bad = (out: Diagnostic[], at: string) =>
  out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
function get(c: Obj, check: Checks, r: Obj, kind: string, at: string): Obj | undefined {
  check.named(r, kind, at);
  return c[`${kind}s`]?.[refString(r as never)];
}
