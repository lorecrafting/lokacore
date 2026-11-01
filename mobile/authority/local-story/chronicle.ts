// The Chronicle, every accepted receipt's lines, read back from receipts.
import { units } from '../../../kernel/ts/src/mechanics/calendar.ts';
import type { Accepted } from '../../../kernel/ts/src/runtime/decision.ts';
import type { ChronicleEntry, NarrationRecord } from '../../packages/game-view/session.ts';
import { combatLines, type NarrationRow } from './narration.ts';
import { scope, type Story } from './save.ts';

/**
 * The Chronicle (mechanics.md, Chronicle): every accepted receipt's lines in revision order, with
 * its day (from the clock after it) and whether it reached a story point. Nothing stored. Only the
 * lines and their combat routing: the latest receipt's detail, cue and pickup checks read today's
 * world and would refuse an old receipt.
 * ponytail: every response is parsed once per Journal open; a json_extract prefilter is the upgrade
 * if a long save makes it slow.
 */
export function chronicle(s: Story): ChronicleEntry[] {
  if (s.db.isInTransactionSync()) return []; // its rows may be uncommitted (03 §15)
  const { day } = units(s.world.cartridge);
  let clock = s.fresh.state.clock;
  const entries: ChronicleEntry[] = [];
  for (const r of s.db.getAllSync<NarrationRow>(
    'SELECT revision, command_id, command, response FROM receipt WHERE scope = ? ORDER BY revision',
    scope(s),
  )) {
    const d = JSON.parse(r.response) as Accepted;
    if (d.kind !== 'accepted') continue;
    for (const op of d.delta.ops) if (op.op === 'time.advance') clock = op.to;
    const lines = d.narration ?? [];
    const combat_lines = combatLines(s, d, lines);
    // Only receipts with a World line: combat-only ones belong to the combat log.
    if (lines.length > combat_lines.length)
      entries.push({
        day: Math.floor(clock / day) + 1,
        record: {
          command_id: r.command_id,
          lines,
          ...(combat_lines.length && { combat_lines }),
        } as NarrationRecord,
        milestone: d.events.some((e) => e.payload.type === 'story_point_reached'),
      });
  }
  return entries;
}
