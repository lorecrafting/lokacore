// The Combat page's title: who opened the fight (book-ui.md, Live combat response; loka-kgd.207).
import { fillSlots } from '../../packages/game-view/line_words.ts';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { LABEL } from './labels.ts';

type Foe = { name: string; words?: { bare: string; article?: string } };
type Say = (key: string) => string;

// A foe as its projected name, definite with name words ("the goblin"); a proper name stays bare.
export const named = (o: Foe, text: Say) =>
  o.words ? `${o.words.article ? `${LABEL.the} ` : ''}${text(o.words.bare)}` : text(o.name);

// "You attack {target}!" or "{attacker} attacks you!" in the cartridge's words; none when the
// opening receipt is unknown (a replaced world) or its NPC is no longer a foe here. Never guessed.
export function combatTitle(c: NonNullable<GameView['combat']>, text: Say, opener: Game['opener']) {
  const by = opener?.(c.encounter_id);
  const foes = c.active_opponents ?? [{ ...c, id: c.opponent_id }];
  const foe = by && foes.find((o) => o.id === by.npc_id);
  if (!foe) return undefined;
  const [key, slot] = by.player
    ? ['combat.title_you_attack', 'target']
    : ['combat.title_attacks_you', 'attacker'];
  return fillSlots(text(key), { [slot]: named(foe, text) }, String);
}
