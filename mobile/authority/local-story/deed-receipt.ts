import type { Command } from '../../../kernel/ts/src/contracts.gen.ts';
import type { Accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import type { NarrationRecord } from '../../packages/game-view/session.ts';
import type { NarrationRow } from './narration.ts';

// What the receipt's events say the press did (book-ui.md, Lever and latch; Impact). A lever is a
// completed action whose outcome emits the authored `lever` event, as weather's phases are authored names.
// A lever or latch is a press's, never what reopen shows again. A round's miss comes on the clock: the
// presenter acts on a new receipt only; a lineless miss still keeps its record (narration.ts).
export function deedOf(
  d: Accepted,
  r: NarrationRow,
  body: string | undefined,
  press: boolean,
): Pick<NarrationRecord, 'lever' | 'opened' | 'missed'> | undefined {
  const has = (type: string) => d.events.some((e) => e.payload.type === type);
  const lever =
    press &&
    d.events.some((e) => e.payload.type === 'custom_event' && e.payload.event.key === 'lever');
  // A door verb's own barrier, not one a reaction or schedule moved in this receipt: events name no writer.
  const door = () => DOOR_VERBS.has((JSON.parse(r.command) as Command).payload?.type);
  const opened = press && (has('action_completed') || (has('barrier_changed') && door()));
  const swung = (hit: boolean) =>
    d.events.some(
      (e) =>
        e.payload.type === 'attack_result' &&
        e.payload.hit === hit &&
        e.payload.attacker_id === body,
    );
  // The player's own swings alone: another fighter's blow leaves the miss audible (book-ui.md, Fight music).
  const missed = swung(false) && !swung(true);
  if (!lever && !opened && !missed) return undefined;
  return { ...(lever && { lever }), ...(opened && { opened }), ...(missed && { missed }) };
}

const DOOR_VERBS = new Set(['open', 'unlock']); // the verbs that can show an exit
