// Local detail identity, captured buttons and page continuity over saved dream truth.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import type { Page } from './model.ts';
export const dreamOwner = (id: string) => `dream:${id}`;
export const dreamAt = (view: GameView, id: string) =>
  view.notices?.find((n) => n.id === id)?.dream;

export function dreamPages(stack: Page[], before: GameView, after: GameView): Page[] | undefined {
  const closed = stack.findIndex((p) => p.kind === 'dream' && !dreamAt(after, p.id)?.available);
  if (closed >= 0) return stack.slice(0, closed);
  const started = after.notices?.find(
    (n) => n.dream?.available && n.dream.index === 1 && !dreamAt(before, n.id),
  );
  if (!started) return;
  const parent = stack.findIndex((p) => p.kind === 'notice' && p.id === started.id);
  return parent >= 0
    ? [...stack.slice(0, parent + 1), { kind: 'dream', id: started.id }]
    : [
        { kind: 'notice', id: started.id },
        { kind: 'dream', id: started.id },
      ];
}

export function dreamButtons(
  view: GameView,
  label: (k: string) => string,
): Omit<Button, 'token'>[] {
  return (view.notices ?? []).flatMap((n) => {
    const d = n.dream;
    if (!d?.available) return [];
    const current = d.action?.available
      ? [
          {
            label: d.index === d.count ? 'Acknowledge' : label(d.action.label),
            action_key: d.action.action_key,
            command: d.action.command,
            detail_id: dreamOwner(n.id),
            target_ids: [],
            input: { scene: d.scene, line: d.index },
          },
        ]
      : [];
    const choices = (d.choice?.choices ?? [])
      .filter((c) => c.available)
      .map((c) => ({
        label: label(c.label),
        action_key: c.action_key!,
        command: 'choose',
        detail_id: dreamOwner(n.id),
        target_ids: [],
        input: {
          continuation_id: d.choice!.continuation_id,
          choice_id: c.choice_id,
          dream: c.dream,
        },
      }));
    return [...current, ...choices];
  });
}
