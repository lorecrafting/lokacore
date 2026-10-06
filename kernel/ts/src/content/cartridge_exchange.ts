// Compiler twin: finite authored stock, exact equal-count exchange and bounded contribution.
import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
type Patch = { room: string; items: DefinitionRef[] };

export function exchanges(c: Obj, checks: Checks): Diagnostic[] {
  const out: Diagnostic[] = [],
    patches: Patch[] = [];
  for (const [room, r] of Object.entries(c.rooms as Obj))
    for (const [key, d] of Object.entries((r.details ?? {}) as Obj)) {
      if (!d.harvest) continue;
      const at = `.cartridge.rooms${step(room)}.details${step(key)}.harvest`;
      out.push(
        ...api(c, at),
        ...stock(c, checks, d.harvest.items, { ...c.entry, key: r.key }, `${at}.items`),
      );
      checks.text(d.harvest, ['title', 'label', 'narration'], at);
      patches.push({ room, items: d.harvest.items });
    }
  for (const [ref, q] of Object.entries((c.quests ?? {}) as Obj))
    out.push(...quest(c, checks, patches, q, `.cartridge.quests${step(ref)}`));
  for (const [ref, d] of Object.entries((c.dialogues ?? {}) as Obj))
    for (const [key, o] of Object.entries(d.choices as Obj)) {
      if (!o.exchange) continue;
      const q = d.quest && c.quests?.[refString(d.quest)];
      if (
        !q?.exchange ||
        !same(d.npc, q.exchange.npc) ||
        ['accept', 'receive', 'hand_over', 'payment', 'sequence', 'escort'].some((k) =>
          Object.hasOwn(o, k),
        )
      )
        out.push(
          diag('OUTCOME_MISMATCH', `.cartridge.dialogues${step(ref)}.choices${step(key)}.exchange`),
        );
    }
  return out;
}

function api(c: Obj, at: string): Diagnostic[] {
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  return major < 1 || (major === 1 && minor < 17) ? [diag('KERNEL_API_RANGE_INVALID', at)] : [];
}

function stock(
  c: Obj,
  { named }: Checks,
  refs: DefinitionRef[],
  holder: DefinitionRef,
  at: string,
): Diagnostic[] {
  const out: Diagnostic[] =
    new Set(refs.map(refString)).size !== refs.length ? [diag('DUPLICATE_DEFINITION', at)] : [];
  refs.forEach((ref, i) => {
    named(ref, 'item', `${at}[${i}]`);
    const item = c.items?.[refString(ref)];
    if (
      item &&
      (!same(item.location[holder.kind], holder) ||
        item.location.in !== holder.kind ||
        !Number.isSafeInteger(item.mass_grams) ||
        item.mass_grams <= 0)
    )
      out.push(diag('OUTCOME_MISMATCH', `${at}[${i}]`));
  });
  return out;
}

function quest(c: Obj, checks: Checks, patches: Patch[], q: Obj, path: string): Diagnostic[] {
  if (!q.exchange) return q.repeatable ? [diag('OUTCOME_MISMATCH', `${path}.repeatable`)] : [];
  const x = q.exchange,
    at = `${path}.exchange`,
    out = api(c, at);
  for (const [field, kind] of [
    ['npc', 'npc'],
    ['contribution', 'fact'],
    ['faction', 'fact'],
  ])
    checks.named(x[field], kind, `${at}.${field}`);
  const patch = patches.find((p) => same(p.items, x.outgoing)),
    room = patch && c.rooms[patch.room];
  out.push(
    ...(room
      ? stock(c, checks, x.outgoing, { ...c.entry, key: room.key }, `${at}.outgoing`)
      : [diag('OUTCOME_MISMATCH', `${at}.outgoing`)]),
  );
  out.push(...stock(c, checks, x.incoming, x.npc, `${at}.incoming`));
  const all = [...x.outgoing, ...x.incoming].map(refString);
  if (new Set(all).size !== all.length) out.push(diag('DUPLICATE_DEFINITION', at));
  if (!tuning(c, q)) out.push(diag('OUTCOME_MISMATCH', at));
  return out;
}

function tuning(c: Obj, q: Obj): boolean {
  const x = q.exchange,
    ct = c.facts[refString(x.contribution)],
    ft = c.facts[refString(x.faction)];
  return !!(
    q.repeatable &&
    !q.deadline &&
    !q.offer &&
    q.objective.evidence === 'current_state' &&
    x.quantity <= x.outgoing.length &&
    x.outgoing.length === x.incoming.length &&
    same(ct?.scopes, ['player']) &&
    ct?.value_type.type === 'int' &&
    ct.value_type.minimum === 0 &&
    ct.value_type.default === 0 &&
    Number.isSafeInteger(ct.value_type.maximum) &&
    x.increment <= ct.value_type.maximum &&
    same(ft?.scopes, ['player']) &&
    ft?.value_type.type === 'int' &&
    Number.isSafeInteger(ft.value_type.minimum) &&
    Number.isSafeInteger(ft.value_type.maximum) &&
    ft.value_type.minimum <= 0 &&
    ft.value_type.maximum >= ct.value_type.maximum &&
    !same(x.contribution, x.faction)
  );
}
