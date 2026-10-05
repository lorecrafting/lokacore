// Local notice routes consume only GameView metadata and its exact current action offers.
import { Text } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain, why, type Page } from './model.ts';
import { Leave, Sheet, Tap, note, prose } from './pages.tsx';
import type { Button, presenter } from './presenter.ts';
import { paper } from './paper.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Notice = NonNullable<GameView['notices']>[number];
type Props = {
  screen: Screen;
  open: (page: Page) => void;
  press: (b: Button, id?: string) => void;
};

const noticesOf = (view: GameView) => [
  ...(view.notices ?? []),
  ...(view.notice_boards ?? []).flatMap((board) => board.notices),
];

export function restoredNoticePages(screen: Screen): Page[] {
  if (screen.view.combat || screen.view.scene) return [];
  const board = screen.view.notice_boards?.find((b) =>
    b.notices.some((n) => screen.detail(n.id).length > 0),
  );
  const notice = (board?.notices ?? screen.view.notices)?.find(
    (n) => screen.detail(n.id).length > 0,
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
  return offers.find((a) => a.available) ?? offers[0];
}

function control(screen: Screen, id: string) {
  const offer = noticeOffer(screen.view, id);
  return offer?.available
    ? screen.buttons.find(
        (b) =>
          b.action_key === offer.action_key && b.target_ids.length === 1 && b.target_ids[0] === id,
      )
    : undefined;
}

function NoticeLink(p: Props & { notice: Notice }) {
  const { notice, screen } = p;
  const title = screen.text(notice.title),
    b = control(screen, notice.id);
  const offer = noticeOffer(screen.view, notice.id);
  return b ? (
    <Tap
      label={title}
      onPress={() => {
        p.open({ kind: 'notice', id: notice.id });
        p.press(b, notice.id);
      }}
    >
      <Text style={{ ...prose, color: paper.accent }}>{title}</Text>
    </Tap>
  ) : (
    <Text style={note}>
      {title}
      {offer && !offer.available ? `: ${why(offer, screen.text)}` : ''}
    </Text>
  );
}

export function NoticeEntries(p: Props) {
  return (
    <>
      {(p.screen.view.notice_boards ?? []).map((board) => (
        <Tap
          key={board.id}
          label={p.screen.text(board.title)}
          onPress={() => p.open({ kind: 'board', id: board.id })}
        >
          <Text style={{ ...prose, color: paper.accent }}>{p.screen.text(board.title)}</Text>
        </Tap>
      ))}
      {(p.screen.view.notices ?? []).map((notice) => (
        <NoticeLink key={notice.id} {...p} notice={notice} />
      ))}
    </>
  );
}

// size: allow 45, ordered description/history/Notice options share one detail page
export function NoticePage(p: Props & { page: Extract<Page, { id: string }>; world: () => void }) {
  const board =
    p.page.kind === 'board'
      ? p.screen.view.notice_boards?.find((b) => b.id === p.page.id)
      : undefined;
  const detail = board ?? noticesOf(p.screen.view).find((n) => n.id === p.page.id);
  if (!detail) return null;
  const standalone = p.screen.view.notices?.some((n) => n.id === detail.id);
  return (
    <Sheet title={p.screen.text(detail.title)}>
      <Text style={prose}>{plain(p.screen.text(detail.description))}</Text>
      {p.screen.detail(detail.id).map((line, i) => (
        <Text key={i} style={prose}>
          {typeof line === 'string' ? line : line.text}
        </Text>
      ))}
      {board &&
        board.notices.map((notice) => <NoticeLink key={notice.id} {...p} notice={notice} />)}
      {!board &&
        ('actions' in detail ? (detail.actions ?? []) : []).map((offer) => {
          const button = p.screen.buttons.find(
            (b) => b.detail_id === detail.id && b.action_key === offer.action_key,
          );
          return button ? (
            <Tap
              key={offer.action_key}
              label={button.label}
              onPress={() => p.press(button, detail.id)}
            >
              <Text style={{ ...prose, color: paper.accent }}>{button.label}</Text>
            </Tap>
          ) : !offer.available ? (
            <Text key={offer.action_key} style={note}>
              {p.screen.text(offer.label)}: {why(offer, p.screen.text)}
            </Text>
          ) : null;
        })}
      {standalone && <Leave leave={p.world} />}
    </Sheet>
  );
}
