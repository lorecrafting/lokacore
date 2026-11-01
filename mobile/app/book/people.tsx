// The room's people and items as sentences, and who just came or is going (book-ui.md, Page life).
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { COUNT } from './labels.ts';
import { InkText } from './fade.ts';
import { cap } from './model.ts';
import { nameLink } from './lines.tsx';
import { prose, usePalette, useType } from './palette.ts';
import { useDry, useFading } from './press.ts';
import { motion } from './tokens.ts';
import { subject } from './words.ts';

type Person = GameView['entities'][number];
const has = (group: Person[], id: string) => group.some((e) => e.id === id);

// ponytail: a plural link goes by its first member's id; one of several leaving fades or not by that.
// Who came into or is going from the room since the last draw. A change of room says nothing.
function usePeople(view: GameView) {
  const npcs = view.entities.filter((e) => e.kind === 'npc');
  const seen = useRef({
    place: view.place.id,
    npcs,
    group: npcs,
    came: new Set<string>(),
    going: [] as Person[],
  });
  const [, redraw] = useState(0);
  const s = seen.current;
  const stayed = s.place === view.place.id;
  if (!stayed) s.came = new Set();
  for (const n of npcs) if (stayed && !has(s.npcs, n.id)) s.came.add(n.id);
  const lost = stayed ? s.npcs.filter((e) => !has(npcs, e.id)) : [];
  s.going = (stayed ? [...s.going, ...lost] : []).filter((e) => !has(npcs, e.id));
  const group = [...npcs];
  // A leaver keeps its place in the sentence until the paragraph closes up.
  for (const e of s.going)
    group.splice(
      s.group.findIndex((o) => o.id === e.id),
      0,
      e,
    );
  Object.assign(s, { place: view.place.id, npcs, group });
  const fading = s.going.length;
  useEffect(() => {
    if (!fading) return;
    const close = setTimeout(() => {
      s.going = [];
      s.group = s.npcs;
      redraw((n) => n + 1);
    }, motion.fade.duration);
    return () => clearTimeout(close);
  }, [fading]); // eslint-disable-line
  return { group, came: s.came, going: new Set(s.going.map((e) => e.id)) };
}

/**
 * The room's people, then items; no headings, an empty group omitted (book-ui.md, Room page
 * anatomy).
 * - Use: RoomPage only.
 * - Rules: an arrival dries in; a leaver fades over `motion.fade`, taking no touch, then closes.
 *   Each group is one sentence, "Aldous, Bess, the carpenter, chandler, and cook are here."
 *   ("A and B are here.", "A crow is here.", "Two crows are here."): serial comma, the first word
 *   capitalised, each name its own link named "<name>, open"; articles, commas and "and" are plain
 *   text. A name with words shows its bare name; an article is shared by a run of different names
 *   that take it.
 * - Story: RoomPage.stories.tsx
 */
export function Here(p: {
  view: GameView;
  text: (key: string) => string;
  open: (id: string) => void;
}) {
  const npcs = usePeople(p.view);
  const items = p.view.entities.filter((e) => e.kind !== 'npc');
  return [
    npcs.group.length > 0 && <Present key="npcs" {...npcs} text={p.text} open={p.open} />,
    items.length > 0 && <Present key="items" group={items} text={p.text} open={p.open} />,
  ];
}

// One group as one sentence of inline name links (owner, mvl9864n2qi8, mvl9q99wzm29). With name
// words (loka-6qi): the bare name, its article written when it differs from the previous link's or
// the name ends in the previous link's last word (a name without one breaks the run), and
// same-name entities with a plural as one. With a carrier: "<Carrier> carries <links>." or, with
// verb wears, "<Carrier> wears <links>." (the NPC's Look page, InsidePage), first link lowercase.
const noun = (n?: string) => n?.split(' ').pop(); // 'cowering goblin' and 'goblin' end alike
type Group = {
  group: GameView['entities'];
  text: (key: string) => string;
  open: (id: string) => void;
  carrier?: string;
  verb?: 'carries' | 'wears';
  came?: Set<string>;
  going?: Set<string>;
};
const Arrived = ({ children }: { children: ReactNode }) => (
  <InkText style={useDry()}>{children}</InkText>
);
const Going = ({ children }: { children: ReactNode }) => (
  <InkText style={useFading(true)}>{children}</InkText>
);
// An empty group draws no sentence (a seen NPC always has worn, often []).
export const carries = (p: Group & { carrier: string }) => p.group.length > 0 && <Present {...p} />;
function Stayed(p: { fresh?: boolean; children: ReactNode }) {
  return p.fresh ? <Arrived>{p.children}</Arrived> : <>{p.children}</>;
}

// size: allow 45, one sentence with its links, joins and article rules
function Present(p: Group) {
  const [c, t] = [usePalette(), useType()];
  type Link = { id: string; name: string; article?: string; many?: true };
  const links = p.group.flatMap((e): Link[] => {
    const { bare, article, plural } = e.words ?? {};
    const kind = (o: (typeof p.group)[number]) => o.words?.plural && p.text(o.words.plural); // eggs keyed egg_01..06
    const same = plural ? p.group.filter((o) => kind(o) === kind(e)) : [e];
    if (same[0] !== e) return []; // a later member of a collapsed group
    const n = same.length;
    if (n > 1) return [{ id: e.id, name: `${COUNT[n - 2] ?? n} ${p.text(plural!)}`, many: true }];
    return [{ id: e.id, name: p.text(bare ?? e.name), article }];
  });
  return (
    <Text style={prose(c, t)}>
      {p.carrier && `${p.carrier} ${p.verb ?? 'carries'} `}
      {links.map((l, i) => {
        const prev = links[i - 1];
        const article =
          (l.article !== prev?.article || noun(l.name) === noun(prev?.name)) && l.article;
        const first = (s: string) => (i === 0 && !p.carrier ? cap(s) : s);
        const said = article ? l.name : first(l.name);
        const word = article && `${first(article)} `;
        return (
          <Fragment key={l.id}>
            {i > 0 && (i < links.length - 1 ? ', ' : links.length > 2 ? ', and ' : ' and ')}
            {p.going?.has(l.id) ? (
              <Going>
                {word}
                {said}
              </Going>
            ) : (
              <Stayed fresh={p.came?.has(l.id)}>
                {word}
                {nameLink(said, () => p.open(l.id))}
              </Stayed>
            )}
          </Fragment>
        );
      })}
      {!p.carrier && subject(links.at(-1)?.name ?? '').endsWith(',') && ','}
      {p.carrier ? '.' : links.length > 1 || links[0]?.many ? ' are here.' : ' is here.'}
    </Text>
  );
}
