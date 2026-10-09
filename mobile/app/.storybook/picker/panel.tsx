// The Polish panel (design input section 2): session pill and Close batch, the conversation (owner
// items with their status, PM cards), the composer. Theme roles only, no raw colour.
import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'storybook/internal/components';
import { useAddonState } from 'storybook/manager-api';
import { keyframes, styled } from 'storybook/theming';
import { ADDON_ID, ROUTE, type Feed, type Pick, type Picked, type Status } from './events.ts';
import { clear, event, initial, pin, send, type State } from './state.ts';

type Item = Extract<Status, { state: string }> | undefined;
const latest = (feed: Feed, id: string): Item =>
  feed.status.filter((s): s is NonNullable<Item> => 'id' in s && s.id === id).at(-1);
export const working = (feed: Feed | null) =>
  feed ? feed.picks.filter((p) => !p.type && latest(feed, p.id)?.state === 'working').length : 0;
const shotUrl = (shot: string) => `${ROUTE}/${shot.replace(/^\.polish\//, '')}`;
const chipText = (e: Picked) => `${e.chain.join(' › ') || 'element'} · ${e.box.w}×${e.box.h}`;

const pulse = keyframes({ '50%': { opacity: 0.3 } });
const Column = styled.div({ display: 'flex', flexDirection: 'column', height: '100%' });
const Header = styled.div(({ theme }) => ({
  position: 'sticky',
  top: 0,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '0 10px',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  fontSize: 12,
  flexShrink: 0,
}));
const Dot = styled.span<{ tone: 'grey' | 'green' | 'pulse' | 'positive' | 'warning' | 'negative' }>(
  ({ theme, tone }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    border: `1px solid ${theme.textMutedColor}`,
    ...(tone === 'green' && {
      background: theme.color.positive,
      borderColor: theme.color.positive,
    }),
    ...(tone === 'pulse' && {
      background: theme.color.secondary,
      borderColor: theme.color.secondary,
      animation: `${pulse} 1s infinite`,
    }),
    ...(tone === 'positive' && {
      background: theme.color.positive,
      borderColor: theme.color.positive,
    }),
    ...(tone === 'warning' && {
      background: theme.color.warning,
      borderColor: theme.color.warning,
    }),
    ...(tone === 'negative' && {
      background: theme.color.negative,
      borderColor: theme.color.negative,
    }),
  }),
);
const List = styled.div({ flex: 1, overflowY: 'auto', padding: '8px 0' });
const Owner = styled.div(({ theme }) => ({
  borderLeft: `3px solid ${theme.color.secondary}`,
  padding: '8px 10px',
  margin: '0 0 8px',
}));
const Muted = styled.div(({ theme }) => ({ color: theme.textMutedColor, fontSize: 12 }));
const Chip = styled.button(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  margin: '0 6px 4px 0',
  padding: '1px 6px',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 3,
  background: 'transparent',
  color: 'inherit',
  fontFamily: theme.typography.fonts.mono,
  fontSize: 12,
  cursor: 'pointer',
}));
const Badge = styled.span(({ theme }) => ({
  border: `1px solid ${theme.textMutedColor}`,
  borderRadius: 2,
  padding: '0 4px',
  fontSize: 10,
  textTransform: 'uppercase',
}));
const Mono = styled.span(({ theme }) => ({ fontFamily: theme.typography.fonts.mono }));
const Card = styled.div<{ warn?: boolean }>(({ theme, warn }) => ({
  margin: '0 10px 8px',
  padding: 8,
  border: `1px solid ${warn ? theme.color.warning : theme.appBorderColor}`,
  borderRadius: 4,
}));
const Composer = styled.div(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  padding: 10,
  borderTop: `1px solid ${theme.appBorderColor}`,
  background: theme.background.app,
  flexShrink: 0,
}));
const Area = styled.textarea(({ theme }) => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: 6,
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: 4,
  background: theme.input.background,
  color: theme.input.color,
  font: 'inherit',
  fontSize: 14,
  resize: 'none',
}));

const StatusRow = ({ item, session }: { item: Item; session: boolean }) => {
  const [tone, word] = !item
    ? ['grey', session ? 'received' : 'queued for Beads']
    : item.state === 'working'
      ? ['pulse', 'working']
      : item.state === 'done'
        ? ['positive', 'done']
        : item.state === 'moved'
          ? ['warning', `Beads ${item.beads ?? ''}`]
          : ['negative', 'stopped'];
  return (
    <Muted>
      <Dot tone={tone as 'grey'} />
      {word}
      {item?.model && (
        <>
          {' '}
          · <Badge>{item.model}</Badge>
        </>
      )}
      {item?.summary && <> · {item.summary}</>}
      {item?.sha && (
        <>
          {' '}
          · <Mono>{item.sha.slice(0, 7)}</Mono>
        </>
      )}
    </Muted>
  );
};

const OwnerItem = ({ p, feed }: { p: Pick; feed: Feed }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Owner data-pick={p.id}>
      <div>
        {p.elements?.map((e, i) => (
          <Chip
            key={i}
            title="Pin again for a follow-up"
            onClick={() => pin({ element: { ...e, key: `${p.id}:${i}` }, add: true })}
          >
            {e.shot && (
              <img
                alt=""
                src={shotUrl(e.shot)}
                width={24}
                height={24}
                style={{ objectFit: 'cover' }}
                onClick={(ev) => (ev.stopPropagation(), setOpen(open === e.shot ? null : e.shot!))}
              />
            )}
            {chipText(e)}
          </Chip>
        ))}
        <Muted as="span">{p.story?.title}</Muted>
      </div>
      {open && <img alt="crop" src={shotUrl(open)} style={{ width: '100%' }} />}
      <div style={{ fontSize: 14, margin: '4px 0' }}>{p.note}</div>
      <StatusRow item={latest(feed, p.id)} session={!!feed.session} />
    </Owner>
  );
};

export const Panel = () => {
  const [{ pending, feed, focus }] = useAddonState<State>(ADDON_ID, initial);
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    if (focus) area.current?.focus(); // on a pick, not on mount
  }, [focus]);
  useEffect(() => {
    if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  });
  if (!feed)
    return <Muted style={{ padding: 10 }}>No dev server: the picker needs `storybook dev`.</Muted>;
  const busy = working(feed) > 0;
  const items = feed.picks.filter((p) => !p.type);
  // A PM suggestion stays until the owner answers it (Close or Keep going), also after a reload.
  const answered = Math.max(0, ...feed.picks.filter((p) => p.type).map((p) => p.time));
  const cards = feed.status.filter(
    (s): s is Extract<Status, { type: string }> => 'type' in s && s.time > answered,
  );
  const rows = [...items, ...cards].sort((a, b) => a.time - b.time);
  const submit = () => {
    if (!text.trim() && !pending.length) return;
    void send(text, pending);
    setText('');
  };
  const closeButton = (
    <Button size="small" variant="outline" disabled={busy} onClick={() => setConfirm(true)}>
      Close batch
    </Button>
  );
  return (
    <Column>
      <Header>
        <span>
          <Dot tone={feed.session ? 'green' : 'grey'} />
          {feed.session ?? 'No session · picks go to Beads'}
        </span>
        {feed.session &&
          (confirm ? (
            <span>
              Close batch · {items.length} items?{' '}
              <Button size="small" onClick={() => (setConfirm(false), void event('close'))}>
                Close
              </Button>{' '}
              <Button size="small" variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            closeButton
          ))}
      </Header>
      <List
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
        }}
      >
        {!rows.length && (
          <Muted style={{ textAlign: 'center', padding: 24 }}>
            Press P or Pick, then click anything in the story. Shift-click adds elements. Type a
            feel request without picking.
          </Muted>
        )}
        {rows.map((r) =>
          'reason' in r ? (
            <Card key={r.time} warn>
              <Muted style={{ fontVariant: 'small-caps' }}>PM</Muted>
              <div>suggest closing: {r.reason}</div>
              <div style={{ marginTop: 6 }}>
                {closeButton}{' '}
                <Button size="small" variant="ghost" onClick={() => void event('keep-going')}>
                  Keep going
                </Button>
              </div>
            </Card>
          ) : (
            <OwnerItem key={r.id} p={r} feed={feed} />
          ),
        )}
      </List>
      <Composer>
        <div>
          {pending.map((e) => (
            <Chip key={e.key} onClick={() => pin({ element: e, add: true })} title="Remove">
              {chipText(e)} ×
            </Chip>
          ))}
        </div>
        <Area
          ref={area}
          rows={Math.min(8, Math.max(3, text.split('\n').length))}
          value={text}
          placeholder="What should change?"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            else if (e.key === 'Escape') (setText(''), clear());
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Muted style={{ fontSize: 11 }}>⌘↩ send · esc clear · ⇧click adds an element</Muted>
          <Button size="small" variant="solid" onClick={submit}>
            Send
          </Button>
        </div>
      </Composer>
    </Column>
  );
};
