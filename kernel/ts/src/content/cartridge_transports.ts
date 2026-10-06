import { same } from '../foundation/compose.ts';
import { refString } from '../runtime/decision.ts';
import { checkers, diag, step, type Checks, type Obj } from './cartridge_refs.ts';
import type { Diagnostic } from '../contracts.gen.ts';

export function transports(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [],
    check = checkers(c, out),
    routes = c.transports ?? {};
  const [major, minor] = c.manifest.requires.kernel_api.at_least.split('.').map(Number);
  if (Object.keys(routes).length && (major < 1 || (major === 1 && minor < 24)))
    out.push(diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'));
  for (const [ref, t] of Object.entries(routes as Obj)) definition(c, t, ref, check, out);
  for (const [ref, room] of Object.entries((c.rooms ?? {}) as Obj))
    for (const [key, d] of Object.entries((room.details ?? {}) as Obj))
      if (d.transport) {
        const at = `.cartridge.rooms${step(ref)}.details${step(key)}.transport`;
        check.text(d.transport, ['title'], at);
        check.named(d.transport.route, 'transport', `${at}.route`);
        const route = routes[refString(d.transport.route)];
        if (!route || refString(route.room) !== ref || route.detail !== key) bad(out, at);
      }
  return out;
}

function definition(c: Obj, t: Obj, ref: string, check: Checks, out: Diagnostic[]) {
  const at = `.cartridge.transports${step(ref)}`;
  check.text(t, ['label', 'narration'], at);
  check.text({ reason: 'transport.unaffordable' }, ['reason'], at);
  for (const [field, kind] of Object.entries({
    room: 'room',
    destination: 'room',
    reverse: 'transport',
    recipient: 'npc',
    currency: 'resource',
  }))
    check.named(t[field], kind, `${at}.${field}`);
  t.recovery_rooms.forEach((r: Obj, i: number) =>
    check.named(r, 'room', `${at}.recovery_rooms[${i}]`),
  );
  const room = c.rooms[refString(t.room)],
    back = c.transports?.[refString(t.reverse)],
    npc = c.npcs?.[refString(t.recipient)],
    currency = c.resources?.[refString(t.currency)],
    detail = room?.details?.[t.detail],
    action = Object.values(c.actions as Obj).find((a) => a.key === t.action);
  if (c.lock.capabilities.transport !== 1 || !paired(t, back, ref)) bad(out, at);
  if (!detail?.transport || refString(detail.transport.route) !== ref) bad(out, `${at}.detail`);
  if (
    !currency ||
    currency.gain !== 0 ||
    currency.regen ||
    npc?.resource_starts?.[t.currency.key] === undefined
  )
    bad(out, `${at}.currency`);
  if (!transportAction(action)) bad(out, `${at}.action`);
  if (Object.values((room?.exits ?? {}) as Obj).some((e) => same(e.to, t.destination)))
    bad(out, `${at}.destination`);
  if (
    new Set(t.recovery_rooms.map(refString)).size !== t.recovery_rooms.length ||
    t.recovery_rooms.some((r: Obj) => same(r, t.room))
  )
    bad(out, `${at}.recovery_rooms`);
}
function paired(t: Obj, back: Obj | undefined, ref: string) {
  return (
    !!back &&
    !same(t.room, t.destination) &&
    same(back.room, t.destination) &&
    same(back.destination, t.room) &&
    refString(back.reverse) === ref &&
    same(back.recipient, t.recipient) &&
    same(back.currency, t.currency)
  );
}
function transportAction(a: Obj | undefined) {
  return (
    !!a &&
    a.command === 'use_transport' &&
    same(a.target, { kind: 'entity', scopes: ['inspectable_details'] }) &&
    same(a.input, ['route', 'quoted_fare'])
  );
}
const bad = (out: Diagnostic[], path: string) =>
  out.push(diag('SCHEMA_VIOLATION', path, { error: 'invalid_value' }));
