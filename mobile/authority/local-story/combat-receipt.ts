import type { DomainEvent } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { Accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Story } from './save.ts';
import type { Db } from './store.ts';

/** The first line of the room reached (loka-glj8), the flight's run-in or the death's waking: a
 * fight's page keeps the lines before it. Only a fight's receipt carries it; a death off the
 * fight (a bleed) keeps every line in the room log. */
export const arrival = (s: Story, lines: NonNullable<Accepted['narration']>) => {
  const woke = s.world.cartridge.world?.death?.narration?.woke;
  const at = lines.findIndex((l) => l.key === 'combat.ran_in' || l.key === woke);
  return at > 0 ? { arrival: at } : {};
};

export function defenseEvidence(events: readonly DomainEvent[]) {
  if (!Array.isArray(events) || events.some((e) => typeof e?.payload?.type !== 'string'))
    throw new SyntaxError('malformed JSON: invalid committed event evidence');
  for (const e of events) {
    const p = e.payload;
    if (
      p.type === 'attack_result' &&
      'prevented_by' in p &&
      (validate('EventPayload', p).length || p.hit !== false || p.loss !== 0)
    )
      throw new SyntaxError('malformed JSON: inconsistent defense evidence');
  }
}

export function combatReceipts(db: Db, scope: string) {
  for (const r of db.getAllSync<{ response: string }>(
    "SELECT response FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted' AND json_extract(response,'$.events') IS NOT NULL",
    scope,
  ))
    defenseEvidence(JSON.parse(r.response).events);
}
