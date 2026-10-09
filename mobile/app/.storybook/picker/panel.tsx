// The Polish panel (design input section 2): session pill and Close batch, the conversation, the
// composer. Theme roles only (styles.ts), no raw colour.
import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'storybook/internal/components';
import { useAddonState } from 'storybook/manager-api';
import { ADDON_ID, type Feed, type Status } from './events.ts';
import { Activity, LogLine, OwnerItem, PmCard, chipText, working } from './items.tsx';
import { escape, event, initial, pin, send, type State } from './state.ts';
import { Area, Chip, Column, Composer, Dot, Header, List, Muted, Negative } from './styles.ts';

type Close = { button: React.ReactNode; confirm: boolean; setConfirm: (v: boolean) => void };

const Session = ({ feed, close }: { feed: Feed; close: Close }) => {
  const n = feed.picks.filter((p) => !p.type).length;
  return (
    <Header>
      <span>
        <Dot tone={feed.session ? 'positive' : 'grey'} />
        {feed.session ?? 'No session · picks go to Beads'}
      </span>
      {feed.session &&
        (close.confirm ? (
          <span>
            Close batch · {n} items?{' '}
            <Button size="small" onClick={() => (close.setConfirm(false), void event('close'))}>
              Close
            </Button>{' '}
            <Button size="small" variant="ghost" onClick={() => close.setConfirm(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          close.button
        ))}
    </Header>
  );
};

// Newest at the bottom; autoscroll only while already at the bottom. A PM suggestion stays until
// the owner answers it (Close or Keep going), also after a reload.
const Conversation = ({ feed, close }: { feed: Feed; close: Close }) => {
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  });
  const answered = Math.max(0, ...feed.picks.filter((p) => p.type).map((p) => p.time));
  // PM log lines stay; a suggest-close card goes once answered.
  const cards = feed.status.filter(
    (s): s is Extract<Status, { type: string }> =>
      'type' in s && (s.type === 'log' || s.time > answered),
  );
  const rows = [...feed.picks.filter((p) => !p.type), ...cards].sort((a, b) => a.time - b.time);
  return (
    <List
      ref={list}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      }}
    >
      {!rows.length && (
        <Muted style={{ textAlign: 'center', padding: 24 }}>
          Press P or Pick, then click anything in the story. Shift-click adds elements. Type a feel
          request without picking.
        </Muted>
      )}
      {rows.map((r) =>
        r.type === 'log' ? (
          <LogLine key={`log-${r.time}`} text={r.text} />
        ) : r.type === 'suggest-close' ? (
          <PmCard key={`card-${r.time}`} reason={r.reason} close={close.button} />
        ) : (
          <OwnerItem key={r.id} p={r} feed={feed} />
        ),
      )}
    </List>
  );
};

const Pending = ({ pending }: Pick<State, 'pending'>) => (
  <div>
    {pending.map((e) => (
      <Chip key={e.key} onClick={() => pin({ element: e, add: true })} title="Remove">
        {chipText(e)} ×
      </Chip>
    ))}
  </div>
);
const Hint = ({ failed }: { failed: string | null }) =>
  failed ? (
    <Negative>not sent: {failed}</Negative>
  ) : (
    <Muted style={{ fontSize: 11 }}>↩ send · ⇧↩ newline · esc clear · ⇧click adds an element</Muted>
  );

// The text and pins stay until the queue answered 200 (a failed send shows why).
const Compose = ({ pending, focus }: Pick<State, 'pending' | 'focus'>) => {
  const [text, setText] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focus) area.current?.focus(); // on a pick, not on mount
  }, [focus]);
  const submit = async () => {
    if (!text.trim() && !pending.length) return;
    const why = await send(text, pending);
    setFailed(why);
    if (!why) setText('');
  };
  return (
    <Composer>
      <Pending pending={pending} />
      <Area
        ref={area}
        rows={Math.min(8, Math.max(3, text.split('\n').length))}
        value={text}
        placeholder="What should change?"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return; // IME: Enter picks the candidate
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            setText('');
            if (!text || pending.length) escape(); // text alone: only the text goes
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Hint failed={failed} />
        <Button size="small" variant="solid" onClick={() => void submit()}>
          Send
        </Button>
      </div>
    </Composer>
  );
};

export const Panel = () => {
  const [{ pending, feed, denied, focus }] = useAddonState<State>(ADDON_ID, initial);
  const [confirm, setConfirm] = useState(false);
  if (!feed)
    return (
      <Muted style={{ padding: 10 }}>
        {denied
          ? 'Picks are accepted from this computer only (loopback).'
          : 'No dev server: the picker needs `storybook dev`.'}
      </Muted>
    );
  // One Close batch: the header's and the PM card's open the same inline confirm; none without a
  // session (nothing to close).
  const button = feed.session && (
    <Button
      size="small"
      variant="outline"
      disabled={working(feed) > 0}
      onClick={() => setConfirm(true)}
    >
      Close batch
    </Button>
  );
  const close = { button, confirm, setConfirm };
  return (
    <Column>
      <Session feed={feed} close={close} />
      <Conversation feed={feed} close={close} />
      {working(feed) > 0 && <Activity feed={feed} />}
      <Compose pending={pending} focus={focus} />
    </Column>
  );
};
