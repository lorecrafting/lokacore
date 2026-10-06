import type { DomainEvent } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { Db } from './store.ts';

export function defenseEvidence(events: readonly DomainEvent[]) {
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
