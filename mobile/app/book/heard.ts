import type { GameView } from '../../packages/game-view/session.ts';
import type { Logs } from './logs.ts';

// What the live region reads (loka-x6t.43, book-ui.md Announcements): the room log's lines new
// since the last screen, never history or another log; `key` changes per batch, so a repeated
// line is read again, and a quiet line merged into the last one is read in full each time.
export type Said = { log: number; place: string; key: number; text: string };
export function heard(s: Logs, view: GameView, was: Said | undefined, cut?: number): Said {
  const now = { log: s.log.length, place: view.place.id };
  was ??= { ...now, key: 0, text: '' };
  // A room change empties its log first (resetLogs), so all of it is new.
  const fresh = [
    ...(s.merged ?? []),
    ...s.log.slice(now.place === was.place ? was.log : 0, cut),
  ].map((l) =>
    typeof l === 'string'
      ? l
      : 'reason' in l
        ? `${l.reason}, ${l.text}`
        : 'plain' in l
          ? l.plain
          : l.text,
  );
  s.merged = undefined;
  return fresh.length ? { ...now, key: was.key + 1, text: fresh.join(' ') } : { ...was, ...now };
}
