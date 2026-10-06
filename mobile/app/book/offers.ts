// Captured provider offers retain their exact target, quote and action alias.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import { cap } from './model.ts';
type Say = (key: string) => string;
type Press = Omit<Button, 'token'>;

export function serviceButtons(v: GameView, text: Say): Press[] {
  return v.entities.flatMap((e) =>
    (e.services ?? [])
      .filter((s) => s.action.available)
      .map((s) => ({
        label: `${text(s.label)} — ${s.price}p${s.benefit.kind === 'entitlement' ? '' : `; up to +${s.benefit.amount} MV, capped`}`,
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
