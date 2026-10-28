// Captured provider offers retain their exact target, quote and action alias.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import { cap } from './words.ts';
type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;

export function transportButtons(v: GameView, text: Say): Press[] {
  return (v.notices ?? []).flatMap((n) =>
    n.transport?.action.available
      ? [
          {
            label: `${text(n.transport.label)} — ${n.transport.charge === 0 ? 'free' : `${n.transport.charge}p`}${n.transport.waived ? ' (corpse recovery)' : ''}`,
            action_key: n.transport.action.action_key,
            command: n.transport.action.command,
            detail_id: n.id,
            target_ids: [...(n.transport.action.target_ids ?? [])],
            input: { route: n.transport.route, quoted_fare: n.transport.fare },
          },
        ]
      : [],
  );
}

type Offer = NonNullable<GameView['entities'][number]['services']>[number];

/** A service offer's price note: a bank fee (row 25), or the MV a meal or drink restores. */
export function priceNote({ benefit: b, price }: Offer): string {
  if (b.kind === 'deposit' || b.kind === 'withdraw') return `fee ${price}p`;
  const mv = b.kind === 'meal' || b.kind === 'drink' ? `; up to +${b.amount} MV, capped` : '';
  return `${price}p${mv}`;
}

/** A priced offer's label with its note; a price-0 barter's authored label names its inputs. */
export const offerLabel = (s: Offer, text: Say, note = (n: string) => ` — ${n}`) =>
  s.price ? `${text(s.label)}${note(priceNote(s))}` : text(s.label);

export function serviceButtons(v: GameView, text: Say): Press[] {
  return v.entities.flatMap((e) =>
    (e.services ?? [])
      .filter((s) => s.action.available)
      .map((s) => ({
        label: offerLabel(s, text),
        action_key: s.action.action_key,
        command: s.action.command,
        detail_id: e.id,
        target_ids: [...(s.action.target_ids ?? [])],
        input: { service: s.service, quoted_price: s.price },
      })),
  );
}

export function shopButtons(v: GameView, text: Say): Press[] {
  return v.entities.flatMap((e) =>
    (e.shop ?? []).flatMap((o) =>
      (['buy', 'sell'] as const)
        .filter((verb) => o[verb].available)
        .map((verb) => ({
          label: `${cap(verb)} ${text(o.name)} — ${o[verb].price}p`,
          action_key: verb,
          target_ids: [e.id, o.item_id],
          input: { quoted_price: o[verb].price },
        })),
    ),
  );
}

export function corpseButtons(v: GameView, text: Say): Press[] {
  return (v.corpse_recovery ?? []).map((c) => ({
    label: `Recover belongings from ${text(c.room_title)}: ${c.roots.map((r) => text(r.name)).join(', ')}`,
    action_key: 'recover_corpse',
    target_ids: [c.corpse_id],
    input: {},
    place: true,
  }));
}

// A claim's or cancel's commission key; another service has none.
const follows = (s: Offer) =>
  s.benefit.kind === 'claim' || s.benefit.kind === 'cancel' ? s.benefit.service.key : undefined;

// Refusals the kernel gives only past its open-order check (mechanics/service/shared.ts `open`,
// `pay`); hp, combat, policy or binding refuse before it, so they say nothing of an order.
const ORDER_OPEN = new Set([
  'service.not_ready',
  'service.ready',
  'service.no_output',
  'service.unaffordable',
]);

/**
 * An NPC page's services (owner pick mvlrlvappy4w): while an order is open (its claim or cancel
 * available, or refused for a reason in ORDER_OPEN) its commission hides and its claim and cancel
 * are `order`, drawn under Your order; with no order open they are hidden.
 */
export function serviceOrder(offers: readonly Offer[]) {
  const open = new Set(
    offers
      .filter((s) => s.action.available || ORDER_OPEN.has(s.action.reason?.message?.key ?? ''))
      .map(follows)
      .filter(Boolean),
  );
  return {
    plain: offers.filter((s) => !follows(s) && !open.has(s.service.key)),
    order: offers.filter((s) => open.has(follows(s))),
  };
}

// A talk offer's label ends `.talk` (kernel dialogue/selection.ts `action.talk`, hello_sampler's
// `actions.talk`, patrol's `watch.talk`).
// ponytail: GameView drops the talk command, so a talk with another label stays its own card;
// project `command: 'talk'` (view/action_lists.ts commanded) if that matters.
const talky = (label: string) => label.endsWith('.talk');

/** The NPC page's one Talk card, the first available talk offer, and the person's other buttons. */
export function talkOf(
  npc: { actions: readonly { action_key: string; label: string }[] },
  buttons: Button[],
) {
  const keys = new Set(npc.actions.filter((a) => talky(a.label)).map((a) => a.action_key));
  return {
    talk: buttons.find((b) => keys.has(b.action_key)),
    rest: buttons.filter((b) => !keys.has(b.action_key)),
  };
}
