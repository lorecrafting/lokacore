// Conversation rows of the Polish panel (design input section 2): an owner item with its status,
// a PM suggest-close card, a PM log line, the activity line.
import React, { useEffect, useState } from 'react';
import { Button } from 'storybook/internal/components';
import { ROUTE, type Feed, type Pick, type Picked, type Status } from './events.ts';
import { event, pin } from './state.ts';
import { Badge, Card, Chip, Dot, Mono, Muted, Owner, type Tone } from './styles.ts';

type Item = Extract<Status, { state: string }> | undefined;
export const latest = (feed: Feed, id: string): Item =>
  feed.status.filter((s): s is NonNullable<Item> => 'id' in s && s.id === id).at(-1);
export const working = (feed: Feed | null) =>
  feed ? feed.picks.filter((p) => !p.type && latest(feed, p.id)?.state === 'working').length : 0;
const shotUrl = (shot: string) => `${ROUTE}/${shot.replace(/^\.polish\//, '')}`;
export const chipText = (e: Picked) =>
  `${e.chain.join(' › ') || 'element'} · ${e.box.w}×${e.box.h}`;

const StatusRow = ({ item, session }: { item: Item; session: boolean }) => {
  const [tone, word]: [Tone, string] = !item
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
      <Dot tone={tone} />
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

// The before crop and, once done, the after shot (bin/polish_status.sh); ?t= refetches a redone one.
const Shots = ({ shot, at, done }: { shot: string; at: string; done: Item }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    <img alt="before" src={shotUrl(shot)} style={{ minWidth: 0, flex: 1 }} />
    {done?.state === 'done' && (
      <img
        key={done.time} // a new shot remounts an image its 404 hid
        alt="after"
        src={`${ROUTE}/shots/${at}-after.png?t=${done.time}`}
        style={{ minWidth: 0, flex: 1 }}
        onError={(ev) => (ev.currentTarget.style.display = 'none')}
      />
    )}
  </div>
);

// A chip pins its element again for a follow-up (no outline in the preview: the node may be gone;
// the old crop path rides along). The thumbnail toggles the full crop.
export const OwnerItem = ({ p, feed }: { p: Pick; feed: Feed }) => {
  const [open, setOpen] = useState<number | null>(null);
  const shot = open === null ? null : p.elements?.[open]?.shot;
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
                onClick={(ev) => (ev.stopPropagation(), setOpen(open === i ? null : i))}
              />
            )}
            {chipText(e)}
          </Chip>
        ))}
        <Muted as="span">
          {[p.story?.title, p.palette, p.viewport?.name].filter(Boolean).join(' · ')}
        </Muted>
      </div>
      {shot && <Shots shot={shot} at={`${p.id}-${open}`} done={latest(feed, p.id)} />}
      <div style={{ fontSize: 14, margin: '4px 0' }}>{p.note}</div>
      <StatusRow item={latest(feed, p.id)} session={!!feed.session} />
    </Owner>
  );
};

export const PmCard = ({ reason, close }: { reason: string; close: React.ReactNode }) => (
  <Card warn>
    <Muted style={{ fontVariant: 'small-caps' }}>PM</Muted>
    <div>suggest closing: {reason}</div>
    <div style={{ marginTop: 6 }}>
      {close}{' '}
      <Button size="small" variant="ghost" onClick={() => void event('keep-going')}>
        Keep going
      </Button>
    </div>
  </Card>
);

// A PM progress line (bin/polish_status.sh log), muted like Claude Code's ⏺ lines.
export const LogLine = ({ text }: { text: string }) => (
  <Muted style={{ padding: '0 10px 8px' }}>⏺ {text}</Muted>
);

// Shown only while a pick works: a cycling glyph, the count, the newest working line's model and
// its age.
const glyphs = '·✢✳✶✻✽';
export const Activity = ({ feed }: { feed: Feed }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 120);
    return () => clearInterval(t);
  }, []);
  const n = working(feed);
  const last = feed.picks
    .map((p) => latest(feed, p.id))
    .filter((s) => s?.state === 'working')
    .sort((a, b) => a!.time - b!.time)
    .at(-1);
  if (!last) return null;
  const s = Math.max(0, Math.round((Date.now() - last.time) / 1000));
  const age = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  return (
    <Muted style={{ padding: '4px 10px' }}>
      <Mono>{glyphs[tick % glyphs.length]}</Mono>{' '}
      {[`Working on ${n} pick${n > 1 ? 's' : ''}`, last.model, age].filter(Boolean).join(' · ')}
    </Muted>
  );
};
