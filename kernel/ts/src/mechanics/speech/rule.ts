// speech@1 (toolbox row G9; mechanics.md social verbs): say, whisper or shout one word. Each NPC
// that hears it gets one spoken event; a say or whisper of a speaker's keyword opens that dialogue.
import { accepted, bodyOf, event, rejected, type Rule } from '../../runtime/decision.ts';
import { opening } from '../dialogue/behavior.ts';
import { pending } from '../dialogue/shared.ts';
import { around } from '../senses.ts';
import { answer, authored, folded, npcsIn } from './shared.ts';

export const decide: Rule<'speech'> = (world, command, mint, steps = { n: 0 }) => {
  const p = command.payload;
  const word = folded(p.word);
  const body = bodyOf(world, p.actor_id);
  const room = body && world.state.containers[body];
  if (!word || !room || pending(world, p.actor_id)) return rejected('invalid_state');
  const here = npcsIn(world, [room]);
  if (p.type === 'whisper' && !here.includes(p.target_id)) return rejected('not_present');
  const hearers =
    p.type === 'whisper'
      ? [p.target_id]
      : p.type === 'shout'
        ? npcsIn(world, [...around(world, p.actor_id, room, steps, 1).keys()])
        : here;
  // A shout opens no conversation; a say opens the first hearer's keyed dialogue.
  const d = p.type === 'shout' ? undefined : answer(world, p.actor_id, hearers, word, steps);
  const opened = d && opening(world, command, mint, d, steps);
  const heard = { loudness: p.type, ...(authored(world, word) && { word }) };
  const events = hearers.map((entity_id, i) =>
    event(world, command, mint, i + (opened ? 2 : 1), { type: 'spoken', entity_id, ...heard }),
  );
  return opened
    ? accepted(world, 'choice_opened', [opened[0]], [opened[1], ...events])
    : accepted(world, 'spoken', [], events);
};
