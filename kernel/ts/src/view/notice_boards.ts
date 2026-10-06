import { transportOffer } from './transports.ts';
import { dreamView } from './dreams.ts';
import { value } from '../mechanics/fact.ts';
import { resolved, refusal } from '../commands/actions.ts';
import { positionOf } from '../mechanics/position/shared.ts';
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
    (detail.readable || detail.harvest || detail.perception || detail.bed || detail.transport) &&
    !grouped.has(id as EntityId)
      ? [
          {
            id: id as EntityId,
            title: detailTitle(detail),
            ...harvestRemaining(world, detail, here),
            description: description_variant.describe(world, world.character, detail, steps),
            ...bedView(world, detail, steps),
            ...transportActions(world, id as EntityId, detail, actions, steps),
          },
        ]
      : [],
  );
  return {
    ...(boards.length > 0 && { notice_boards: boards }),
    ...(notices.length > 0 && { notices }),
  };
}

function harvestRemaining(world: World, detail: World['details'][string], here: EntityId) {
  if (!detail.harvest) return {};
  const ids = selected(world, detail.harvest.items, here, detail.harvest.items.length, { n: 0 });
  return { remaining: typeof ids === 'string' ? 0 : ids.length };
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

function transportActions(
  world: World,
  id: EntityId,
  detail: World['details'][string],
  actions: (id: string) => AdvertisedAction[],
  steps: Steps,
) {
  const transport = transportOffer(world, id, steps);
  return transport
    ? { transport, actions: [transport.action] }
    : offered(detail.bed ? bedActions(world, detail, steps) : actions(id));
}

const offered = (actions: AdvertisedAction[]) => (actions.length ? { actions } : {});

const detailTitle = (detail: World['details'][string]) =>
  detail.transport?.title ??
  detail.bed?.title ??
  detail.harvest?.title ??
  detail.perception?.title ??
  detail.readable!.title ??
  detail.readable!.label;

function bedActions(
  world: World,
  detail: World['details'][string],
  steps: Steps,
): AdvertisedAction[] {
  if (!detail.bed || value(world, world.character, detail.bed.entitlement) !== true) return [];
  const p = { type: 'rest', actor_id: world.character } as const;
  return Object.values(resolved(world, world.character))
    .filter((a) => a.command === 'rest')
    .map((a) => {
      const code =
        refusal(world, p, steps, a.key) ??
        (positionOf(world, world.character) === 'resting' ? ('invalid_state' as const) : undefined);
      const offer = {
        action_key: a.key,
        command: a.command,
        label: a.label,
        target: a.target,
        input: a.input,
        target_ids: [],
      };
      return typeof code === 'string'
        ? { ...offer, available: false, reason: { code } }
        : { ...offer, available: true };
    });
}

function bedView(world: World, detail: World['details'][string], steps: Steps) {
  if (!detail.bed) return {};
  const dream = dreamView(world, detail, steps);
  return { bed: true as const, ...(dream && { dream }) };
}
