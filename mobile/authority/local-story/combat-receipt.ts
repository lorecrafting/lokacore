import type { DomainEvent } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { Accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Opener } from '../../packages/game-view/session.ts';
import { scope, type Story } from './save.ts';
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

const openers = new WeakMap<Story, Map<string, Opener>>(); // the Combat page asks each render

// The receipt whose encounter.open op opened this encounter (book-ui.md, Live combat response). Attack, cast and
// perform are the player's commands that open one (combat engage, a spell's fight-back); any other
// (a move into a hostile, a run job, an expedition) is the NPC's. None after a replaced world.
export function opener(s: Story, encounter_id: string): Opener | undefined {
  const known = openers.get(s) ?? openers.set(s, new Map()).get(s)!;
  const id = `${scope(s)} ${encounter_id}`; // a new game is a new lineage, its ids minted afresh
  if (known.has(id)) return known.get(id); // an opening receipt never changes
  if (s.db.isInTransactionSync()) return undefined; // its rows may be uncommitted
  const r = s.db.getFirstSync<{ type: string; npc_id: string }>(
    `SELECT json_extract(command, '$.payload.type') AS type, json_extract(o.value, '$.npc_id') AS npc_id
     FROM receipt, json_each(response, '$.delta.ops') o
     WHERE scope = ? AND instr(response, ?) AND json_extract(o.value, '$.op') = 'encounter.open'
       AND json_extract(o.value, '$.encounter_id') = ?`,
    scope(s),
    encounter_id,
    encounter_id,
  );
  const found = r
    ? { npc_id: r.npc_id, player: ['attack', 'cast', 'perform'].includes(r.type) }
    : undefined;
  if (found) known.set(id, found); // an unknown one is asked again (a later commit may hold it)
  return found;
}
