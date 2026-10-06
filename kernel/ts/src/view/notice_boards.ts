import { visible } from '../mechanics/light/shared.ts';
import { selected } from '../mechanics/containment/stock.ts';
import type { AdvertisedAction, EntityId, NoticeBoardView } from '../contracts.gen.ts';
import type { Steps, World } from '../runtime/decision.ts';
import * as description_variant from '../mechanics/description_variant/rule.ts';

export function noticeViews(
  world: World,
  here: EntityId,
  actions: (id: string) => AdvertisedAction[],
  steps: Steps = { n: 0 },
) {
  const boards = noticeBoards(world, here, actions, steps);
  const grouped = new Set(boards.flatMap((board) => board.notices.map((notice) => notice.id)));
  const notices = Object.entries(world.details).flatMap(([id, detail]) =>
    detail.room === here &&
    visible(world, world.character, id, steps) &&
    (detail.readable || detail.harvest) &&
    !grouped.has(id as EntityId)
      ? [
          {
            id: id as EntityId,
            title: detail.harvest?.title ?? detail.readable!.title ?? detail.readable!.label,
            ...(detail.harvest && {
              remaining: (() => {
                const ids = selected(
                  world,
                  detail.harvest.items,
                  here,
                  detail.harvest.items.length,
                  { n: 0 },
                );
                return typeof ids === 'string' ? 0 : ids.length;
              })(),
            }),
            description: description_variant.describe(world, world.character, detail, steps),
            ...offered(actions(id)),
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
function noticeBoards(
  world: World,
  here: EntityId,
  actions: (id: string) => AdvertisedAction[],
  steps: Steps = { n: 0 },
): NoticeBoardView[] {
  const details = Object.entries(world.details).filter(
    ([id, detail]) => detail.room === here && visible(world, world.character, id, steps),
  );
  const ids = new Map(details.map(([id, detail]) => [detail.key, id as EntityId]));
  return details.flatMap(([id, detail]) => {
    const board = detail.notice_board;
    if (!board) return [];
    return [
      {
        id: id as EntityId,
        title: board.title,
        description: description_variant.describe(world, world.character, detail, steps),
        notices: board.notices.map((notice) => ({
          id: ids.get(notice.detail)!,
          ...offered(actions(ids.get(notice.detail)!)),
          title: notice.title,
          description: description_variant.describe(
            world,
            world.character,
            world.details[ids.get(notice.detail)!],
            steps,
          ),
        })),
      },
    ];
  });
}

const offered = (actions: AdvertisedAction[]) => (actions.length ? { actions } : {});
