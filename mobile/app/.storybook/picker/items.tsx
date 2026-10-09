// Conversation rows of the Polish panel (design input section 2): an owner item with its status,
// a PM suggest-close card.
import React, { useState } from 'react';
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

// A chip pins its element again for a follow-up (no outline in the preview: the node may be gone;
// the old crop path rides along). The thumbnail toggles the full crop.
export const OwnerItem = ({ p, feed }: { p: Pick; feed: Feed }) => {
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
        <Muted as="span">
          {[p.story?.title, p.palette, p.viewport?.name].filter(Boolean).join(' · ')}
        </Muted>
      </div>
      {open && <img alt="crop" src={shotUrl(open)} style={{ width: '100%' }} />}
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
