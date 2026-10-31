import { DreamResume } from './DreamPage.tsx';
// Local notice routes consume only GameView metadata and its exact current action offers.
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { LINK, plain, why, type Page as Route } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import type { Button, presenter } from './presenter.ts';
import { note, prose, usePalette, useType, type Palette, type Type } from './palette.ts';
import { LABEL } from './labels.ts';
import type { DetailLine } from './logs.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Notice = NonNullable<GameView['notices']>[number];
type Offer = NonNullable<Notice['actions']>[number];
type Props = {
  screen: Screen;
  open: (page: Route) => void;
  press: (b: Button, id?: string) => void;
};

const noticesOf = (view: GameView) => [
  ...(view.notices ?? []),
  ...(view.notice_boards ?? []).flatMap((board) => board.notices),
];

export function restoredNoticePages(screen: Screen): Route[] {
  if (screen.view.combat || screen.view.scene) return [];
  const board = screen.view.notice_boards?.find((b) =>
    b.notices.some((n) => screen.detail(n.id).length > 0),
  );
  const notice = (board?.notices ?? screen.view.notices)?.find(
    (n) => !n.bed && screen.detail(n.id).length > 0,
  );
  return notice
    ? [
        ...(board ? [{ kind: 'board' as const, id: board.id }] : []),
        { kind: 'notice', id: notice.id },
      ]
    : [];
}

// A readable's captured Read: the world offer aimed at the detail alone.
const reads = (view: GameView, id: string) =>
  view.actions.filter(
    (a) =>
      a.target.kind === 'entity' &&
      a.target.scopes.includes('inspectable_details') &&
      !a.input.length &&
      a.target_ids?.length === 1 &&
      a.target_ids[0] === id,
  );

function noticeOffer(view: GameView, id: string) {
  const offers = reads(view, id);
  const contextual = offers.length
    ? offers
    : (view.notices?.find((n) => n.id === id)?.actions ?? []);
  return contextual.find((a) => a.available) ?? contextual[0];
}

function control(screen: Screen, id: string) {
  const offer = noticeOffer(screen.view, id);
  return offer?.available
    ? screen.buttons.find(
        (b) =>
          b.action_key === offer.action_key &&
          (b.detail_id === id || (b.target_ids.length === 1 && b.target_ids[0] === id)),
      )
    : undefined;
}

const read = (p: Props, id: string, b: Button) => () => {
  p.open({ kind: 'notice', id });
  p.press(b, id);
};

// The notices and boards the room description links, by key (book-ui.md, Room page anatomy): the
// only way to them. A readable's link opens its page and reads; any other, or a refused Read, opens its page only.
export function proseLinks(p: Props): Map<string, () => void> {
  const targets = [...p.screen.text(p.screen.view.place.description.key).matchAll(LINK)].map(
    (m) => m[2],
  );
  const boards = (p.screen.view.notice_boards ?? []).flatMap((b) =>
    targets.includes(b.key) ? [[b.key, () => p.open({ kind: 'board', id: b.id })] as const] : [],
  );
  return new Map([
    ...boards,
    ...(p.screen.view.notices ?? []).flatMap((n) => {
      if (!targets.includes(n.key)) return [];
      const b = reads(p.screen.view, n.id).length ? control(p.screen, n.id) : undefined;
      return [[n.key, b ? read(p, n.id, b) : () => p.open({ kind: 'notice', id: n.id })] as const];
    }),
  ]);
}

// A board's notice: it reads when its Read is offered, else it opens its page.
function NoticeLink(p: Props & { notice: Notice }) {
  const { notice, screen } = p;
  const b = control(screen, notice.id);
  return (
    <EntityLine
      name={screen.text(notice.title)}
      onPress={b ? read(p, notice.id, b) : () => p.open({ kind: 'notice', id: notice.id })}
    />
  );
}

// A ferry notice's fare, or its waiver.
const fare = (c: Palette, t: Type, f: NonNullable<Notice['transport']>) => (
  <Text style={note(c, t)}>
    {f.waived
      ? 'Free passage to recover your belongings on the isle.'
      : `Fare: ${f.charge === 0 ? 'free' : `${f.charge}p`}.`}
  </Text>
);

// A read whose text is the description (the well) adds nothing the page does not show.
const fresh = (description: string) => (line: DetailLine) =>
  typeof line !== 'string' || plain(line) !== description;

// The notice's fresh reads.
const history = (screen: Screen, id: string, description: string) =>
  screen.detail(id).filter(fresh(description));

/**
 * A notice or board detail in the detail-page order (book-ui.md, Notice board details).
 * - Use: a notice route.
 * - Rules: a read whose text is the description adds nothing; equal read lines all show.
 * - States: notice with Read; dream available; dream finished.
 * - Story: NoticePage.stories.tsx
 */
export function NoticePage(
  p: Props & { page: Extract<Route, { id: string }>; world: () => void; back: () => void },
) {
  const c = usePalette();
  const t = useType();
  const board =
    p.page.kind === 'board'
      ? p.screen.view.notice_boards?.find((b) => b.id === p.page.id)
      : undefined;
  const detail = board ?? noticesOf(p.screen.view).find((n) => n.id === p.page.id);
  if (!detail) return null;
  const description = plain(p.screen.text(detail.description));
  return (
    <Page title={p.screen.text(detail.title)} foot={foot(p, !!board, detail.id)}>
      <Text style={prose(c, t)}>{description}</Text>
      {'remaining' in detail && <Text style={note(c, t)}>Remaining: {detail.remaining}</Text>}
      <LogLines lines={history(p.screen, detail.id, description)} of={p.screen.detail(detail.id)} />
      {'transport' in detail && detail.transport && fare(c, t, detail.transport)}
      {!!board?.notices.length && (
        <View>
          {board.notices.map((n) => (
            <NoticeLink key={n.id} {...p} notice={n} />
          ))}
        </View>
      )}
      <Cards>
        {[
          // A refused Read says why here: the link only opens the page (interaction-patterns.md).
          ...reads(p.screen.view, detail.id).filter((o) => !o.available),
          ...('actions' in detail ? (detail.actions ?? []) : []),
        ].map((o) => offerControl(p, detail.id, o))}
      </Cards>
      {'dream' in detail && <DreamResume detail={detail} open={p.open} />}
    </Page>
  );
}

// A board returns to World, a standalone notice leaves to it, a board's notice returns to its board.
function foot(p: Props & { world: () => void; back: () => void }, board: boolean, id: string) {
  if (board) return <Control label={LABEL.backToWorld} onPress={p.world} />;
  if (p.screen.view.notices?.some((n) => n.id === id))
    return <Control label={LABEL.leave} onPress={p.world} />;
  return <Control label={LABEL.backToBoard} onPress={p.back} />;
}

// A notice's offered action: its live button, or why it is unavailable.
function offerControl(p: Props, id: string, offer: Offer) {
  const button = p.screen.buttons.find(
    (b) =>
      b.detail_id === id &&
      b.action_key === offer.action_key &&
      JSON.stringify(b.target_ids) === JSON.stringify(offer.target_ids ?? []),
  );
  return button ? (
    <ActionCard
      key={`${offer.action_key}:${offer.target_ids?.join(':')}`}
      b={button}
      press={(b) => p.press(b, id)}
    />
  ) : !offer.available ? (
    <ActionCard
      key={`${offer.action_key}:${offer.target_ids?.join(':')}`}
      label={p.screen.label(offer.label)}
      reason={why(offer, p.screen.text)}
    />
  ) : null;
}
