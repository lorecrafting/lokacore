import type { EntityId, NoticeBoardView } from '../contracts.gen.ts';
import type { World } from '../runtime/decision.ts';
import * as description_variant from '../mechanics/description_variant/rule.ts';

export function noticeViews(world: World, here: EntityId) {
  const boards = noticeBoards(world, here);
  const grouped = new Set(boards.flatMap((board) => board.notices.map((notice) => notice.id)));
  const notices = Object.entries(world.details).flatMap(([id, detail]) =>
    detail.room === here && detail.readable && !grouped.has(id as EntityId)
      ? [
          {
            id: id as EntityId,
            title: detail.readable.title ?? detail.readable.label,
            description: description_variant.describe(world, world.character, detail),
          },
        ]
      : [],
  );
  return {
    ...(boards.length > 0 && { notice_boards: boards }),
    ...(notices.length > 0 && { notices }),
  };
}

// Membership is compiler/loader-validated; the current room has at most 64 details.
function noticeBoards(world: World, here: EntityId): NoticeBoardView[] {
  const details = Object.entries(world.details).filter(([, detail]) => detail.room === here);
  const ids = new Map(details.map(([id, detail]) => [detail.key, id as EntityId]));
  return details.flatMap(([id, detail]) => {
    const board = detail.notice_board;
    if (!board) return [];
    return [
      {
        id: id as EntityId,
        title: board.title,
        description: description_variant.describe(world, world.character, detail),
        notices: board.notices.map((notice) => ({
          id: ids.get(notice.detail)!,
          title: notice.title,
          description: description_variant.describe(
            world,
            world.character,
            world.details[ids.get(notice.detail)!],
          ),
        })),
      },
    ];
  });
}
