// A skill's change between two views: the one answer for its line and its sound (level-rush rulings).
import type { GameView } from '../../packages/game-view/session.ts';

type SkillView = NonNullable<GameView['skills']>[number];

/**
 * What one reply says of each skill, at most once a skill (book-ui.md, Skill tree details): the one
 * answer for its line (received.ts skillEvents) and its cue. `key` is the authored line, if any.
 */
export const skillChanges = (was: GameView, now: GameView) =>
  (now.skills ?? []).flatMap((n) => {
    const w = was.skills?.find((k) => k.skill.key === n.skill.key && k.skill.kind === n.skill.kind);
    return skillChange(w, n);
  });

const skillChange = (w: SkillView | undefined, n: SkillView) => {
  const cue = (name: 'skill_learned' | 'skill_up', key?: string) => [{ name, skill: n, key }];
  if (n.acquired && !w?.acquired) return cue('skill_learned', n.learned ?? n.rank?.reached);
  if (!w || (n.level ?? 0) <= (w.level ?? 0)) return [];
  return w.acquired || n.rank?.reached ? cue('skill_up', n.rank?.reached) : [];
};
