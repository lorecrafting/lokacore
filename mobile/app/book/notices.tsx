import { DreamResume } from './DreamPage.tsx';
// Local notice routes consume only GameView metadata and its exact current action offers.
import { Text } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain, why, type Page } from './model.ts';
import { Leave, Sheet, Tap } from './pages.tsx';
import type { Button, presenter } from './presenter.ts';
import { note, prose, usePalette, type Palette } from './palette.ts';

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Notice = NonNullable<GameView['notices']>[number];
type Offer = NonNullable<Notice['actions']>[number];
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
  const c = usePalette();
  const { notice, screen } = p;
  const title = screen.text(notice.title),
    b = control(screen, notice.id);
  const offer = noticeOffer(screen.view, notice.id);
  if (notice.bed || notice.transport || notice.remaining !== undefined)
    return (
      <Tap label={title} onPress={() => p.open({ kind: 'notice', id: notice.id })}>
        <Text style={{ ...prose(c), color: c.action }}>
          {title}
          {notice.remaining === undefined ? '' : ` (${notice.remaining})`}
        </Text>
      </Tap>
    );
  return b ? (
    <Tap
      label={title}
      onPress={() => {
        p.open({ kind: 'notice', id: notice.id });
        p.press(b, notice.id);
      }}
    >
      <Text style={{ ...prose(c), color: c.action }}>{title}</Text>
    </Tap>
  ) : (
    <Text style={note(c)}>
      {title}
      {offer && !offer.available ? `: ${why(offer, screen.text)}` : ''}
    </Text>
  );
}

export function NoticeEntries(p: Props) {
  const c = usePalette();
  return (
    <>
      {(p.screen.view.notice_boards ?? []).map((board) => (
        <Tap
          key={board.id}
          label={p.screen.text(board.title)}
          onPress={() => p.open({ kind: 'board', id: board.id })}
        >
          <Text style={{ ...prose(c), color: c.action }}>{p.screen.text(board.title)}</Text>
        </Tap>
      ))}
      {(p.screen.view.notices ?? []).map((notice) => (
        <NoticeLink key={notice.id} {...p} notice={notice} />
      ))}
    </>
  );
}

export function NoticePage(p: Props & { page: Extract<Page, { id: string }>; world: () => void }) {
  const c = usePalette();
  const board =
    p.page.kind === 'board'
      ? p.screen.view.notice_boards?.find((b) => b.id === p.page.id)
      : undefined;
  const detail = board ?? noticesOf(p.screen.view).find((n) => n.id === p.page.id);
  if (!detail) return null;
  const description = plain(p.screen.text(detail.description));
  return (
    <Sheet title={p.screen.text(detail.title)}>
      <Text style={prose(c)}>{description}</Text>
      {'remaining' in detail && <Text style={note(c)}>Remaining: {detail.remaining}</Text>}
      {/* A read whose text is the description (the well) adds nothing the page does not show. */}
      {p.screen
        .detail(detail.id)
        .filter((line) => line !== description)
        .map((line, i) => (
          <Text key={i} style={prose(c)}>
            {typeof line === 'string' ? line : line.text}
          </Text>
        ))}
      {'transport' in detail && detail.transport && (
        <Text style={note(c)}>
          {detail.transport.waived
            ? 'Free passage to recover your belongings on the isle.'
            : `Fare: ${detail.transport.charge === 0 ? 'free' : `${detail.transport.charge}p`}.`}
        </Text>
      )}
      {board &&
        board.notices.map((notice) => <NoticeLink key={notice.id} {...p} notice={notice} />)}
      {!board &&
        ('actions' in detail ? (detail.actions ?? []) : []).map((offer) =>
          offerControl(c, p, detail.id, offer),
        )}
      {'dream' in detail && <DreamResume detail={detail} open={p.open} />}
      {p.screen.view.notices?.some((n) => n.id === detail.id) && <Leave leave={p.world} />}
    </Sheet>
  );
}

// A notice's offered action: its live button, or why it is unavailable.
function offerControl(c: Palette, p: Props, id: string, offer: Offer) {
  const button = p.screen.buttons.find(
    (b) =>
      b.detail_id === id &&
      b.action_key === offer.action_key &&
      JSON.stringify(b.target_ids) === JSON.stringify(offer.target_ids ?? []),
  );
  return button ? (
    <Tap
      key={`${offer.action_key}:${offer.target_ids?.join(':')}`}
      label={button.label}
      onPress={() => p.press(button, id)}
    >
      <Text style={{ ...prose(c), color: c.action }}>{button.label}</Text>
    </Tap>
  ) : !offer.available ? (
    <Text key={`${offer.action_key}:${offer.target_ids?.join(':')}`} style={note(c)}>
      {p.screen.label(offer.label)}: {why(offer, p.screen.text)}
    </Text>
  ) : null;
}
