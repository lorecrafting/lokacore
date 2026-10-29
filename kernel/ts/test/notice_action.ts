// The offer `key` from the room detail page that carries it: a scripted action aimed at a detail is its
// NoticeView's card, never in view.actions (loka-x6t.120).
import type { GameView } from '../src/contracts.gen.ts';

export const noticeAction = (view: GameView, key: string) =>
  view.notices?.flatMap((n) => n.actions ?? []).find((a) => a.action_key === key);
