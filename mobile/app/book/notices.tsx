import { DreamResume } from './DreamPage.tsx';
// Local notice routes consume only GameView metadata and its exact current action offers.
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain, why, type Page as Route } from './model.ts';
import { ActionCard, Cards } from './actions.tsx';
import { EntityLine, LogLines } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import type { Button, presenter } from './presenter.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';
import { LABEL } from './labels.ts';

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

function noticeOffer(view: GameView, id: string) {
  const offers = view.actions.filter(
    (a) =>
      a.target.kind === 'entity' &&
      a.target.scopes.includes('inspectable_details') &&
      !a.input.length &&
      a.target_ids?.length === 1 &&
      a.target_ids[0] === id,
  );
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

function NoticeLink(p: Props & { notice: Notice }) {
  const { notice, screen } = p;
  const title = screen.text(notice.title),
    b = control(screen, notice.id);
  const offer = noticeOffer(screen.view, notice.id);
  if (notice.bed || notice.transport || notice.remaining !== undefined)
    return (
      <EntityLine
        name={title}
        rest={notice.remaining === undefined ? undefined : ` (${notice.remaining})`}
        onPress={() => p.open({ kind: 'notice', id: notice.id })}
      />
    );
  return b ? (
    <EntityLine
      name={title}
      onPress={() => {
        p.open({ kind: 'notice', id: notice.id });
        p.press(b, notice.id);
      }}
    />
  ) : (
    <ActionCard
      label={title}
      reason={offer && !offer.available ? why(offer, screen.text) : undefined}
    />
  );
}

export function NoticeEntries(p: Props) {
  const { notice_boards: boards = [], notices = [] } = p.screen.view;
  if (!boards.length && !notices.length) return null;
  return (
    <View>
      {boards.map((board) => (
        <EntityLine
          key={board.id}
          name={p.screen.text(board.title)}
          onPress={() => p.open({ kind: 'board', id: board.id })}
        />
      ))}
      {notices.map((notice) => (
        <NoticeLink key={notice.id} {...p} notice={notice} />
      ))}
    </View>
  );
}

// A ferry notice's fare, or its waiver.
const fare = (c: Palette, t: NonNullable<Notice['transport']>) => (
  <Text style={note(c)}>
    {t.waived
      ? 'Free passage to recover your belongings on the isle.'
      : `Fare: ${t.charge === 0 ? 'free' : `${t.charge}p`}.`}
  </Text>
);

export function NoticePage(
  p: Props & { page: Extract<Route, { id: string }>; world: () => void; back: () => void },
) {
  const c = usePalette();
  const board =
    p.page.kind === 'board'
      ? p.screen.view.notice_boards?.find((b) => b.id === p.page.id)
      : undefined;
  const detail = board ?? noticesOf(p.screen.view).find((n) => n.id === p.page.id);
  if (!detail) return null;
  const description = plain(p.screen.text(detail.description));
  return (
    <Page title={p.screen.text(detail.title)} foot={foot(p, !!board, detail.id)}>
      <Text style={prose(c)}>{description}</Text>
      {'remaining' in detail && <Text style={note(c)}>Remaining: {detail.remaining}</Text>}
      {/* A read whose text is the description (the well) adds nothing the page does not show. */}
      <LogLines
        lines={p.screen
          .detail(detail.id)
          .filter((line) => typeof line !== 'string' || plain(line) !== description)}
      />
      {'transport' in detail && detail.transport && fare(c, detail.transport)}
      {!!board?.notices.length && (
        <View>
          {board.notices.map((n) => (
            <NoticeLink key={n.id} {...p} notice={n} />
          ))}
        </View>
      )}
      <Cards>
        {('actions' in detail ? (detail.actions ?? []) : []).map((o) =>
          offerControl(p, detail.id, o),
        )}
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
