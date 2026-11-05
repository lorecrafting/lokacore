// The Combat page's title: who opened the fight (book-ui.md, Live combat response; loka-kgd.207).
import { fillSlots } from '../../packages/game-view/line_words.ts';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import type { Logs } from './logs.ts';

type Say = (key: string) => string;

// "You attack {target}!" or "{attacker} attacks you!" in the cartridge's words; none when the
// opening receipt is unknown (a replaced world), its NPC is no longer a foe here, or the cartridge
// or its foe has no words for the key or the foe's name (the Book's text answers a missing key with the
// key, the session's with undefined). Never guessed: the page then reads Combat.
export function combatTitle(c: NonNullable<GameView['combat']>, text: Say, opener: Game['opener']) {
  const by = opener?.(c.encounter_id);
  const foes = c.active_opponents ?? [{ ...c, id: c.opponent_id }];
  const foe = by && foes.find((o) => o.id === by.npc_id);
  if (!foe) return undefined;
  const [key, slot] = by.player
    ? ['combat.title_you_attack', 'target']
    : ['combat.title_attacks_you', 'attacker'];
  // The foe's short name, as the engage line binds it ("You attack a goblin!", loka-kgd.202).
  const [said, name] = [key, foe.name].map((k) => text(k) !== k && text(k));
  return said && name ? fillSlots(said, { [slot]: name }, String) : undefined;
}

// The encounter's title, kept while its opener cannot be read (a save in flight, the opener fallen)
// and on the closed page; a new encounter starts afresh. Once said, the receipts are not read again.
export function keptTitle(s: Logs, c: GameView['combat'], text: Say, opener: Game['opener']) {
  if (!c || (s.title?.id === c.encounter_id && s.title?.said)) return s.title?.said;
  const said = combatTitle(c, text, opener);
  if (said || s.title?.id !== c.encounter_id) s.title = { id: c.encounter_id, said };
  return s.title?.said;
}
