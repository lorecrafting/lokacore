// speech@1 (toolbox row G9; mechanics.md social verbs): say, whisper or shout one word. Each NPC
// that hears it gets one spoken event; a say or whisper of a speaker's keyword opens that dialogue.
import { accepted, bodyOf, event, rejected, type Rule } from '../../runtime/decision.ts';
import { opening } from '../dialogue/behavior.ts';
import { pending } from '../dialogue/shared.ts';
import { answer, authored, folded, hearers, npcsIn } from './shared.ts';

export const decide: Rule<'speech'> = (world, command, mint, steps = { n: 0 }) => {
  const p = command.payload;
  const word = folded(p.word);
  const body = bodyOf(world, p.actor_id);
  const room = body && world.state.containers[body];
  if (!word || !room || pending(world, p.actor_id)) return rejected('invalid_state');
  const known = p.type === 'whisper' && world.knownEntities[p.target_id]?.kind === 'npc';
  if (p.type === 'whisper' && !npcsIn(world, [room]).includes(p.target_id))
    return rejected(known ? 'not_present' : 'not_found');
  const heard = hearers(world, p, room, steps);
  // A shout opens no conversation; a say or whisper the first keyed dialogue that answers.
  const d = p.type === 'shout' ? undefined : answer(world, p.actor_id, heard, word, steps);
  const opened = d && opening(world, command, mint, d, steps);
  const said = { loudness: p.type, ...(authored(world, word) && { word }) };
  const events = heard.map((entity_id, i) =>
    event(world, command, mint, i + (opened ? 2 : 1), { type: 'spoken', entity_id, ...said }),
  );
  return opened
    ? accepted(world, 'choice_opened', [opened[0]], [opened[1], ...events])
    : accepted(world, 'spoken', [], events);
};
