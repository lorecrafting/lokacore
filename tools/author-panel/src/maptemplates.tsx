// The map's template chips (editor-map-and-story-rulings.md, Left to E3b): the abstract NPCs and
// items, each dragged onto a room to make its child there (`bin/loka new --extends`).
import { useEffect, useState } from 'react';
import { templates, type Story, type Template } from './author.ts';
import type { MapRoom } from './map.ts';
import { freeKey } from './mapedit.ts';
import { edit } from './mapwire.ts';

export const DRAGGED = 'text/x-loka-template';
/** A template chip's drag: the template, and every template key (no compiled node holds them). */
type Dragged = Template & { templates: string[] };
/** The abstract NPCs and items as chips (`~` label); a drag onto a room makes a child there. */
export function Templates({ story }: { story: Story }) {
  const [all, set] = useState<Template[]>([]);
  useEffect(() => {
    let live = true; // a slower answer to an older story never overwrites a newer list
    templates().then(
      (t) => live && set(t),
      () => live && set([]),
    );
    return () => void (live = false);
  }, [story]);
  if (!all.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t px-2 py-1 text-xs">
      <span className="text-muted-foreground">~</span>
      {all.map((t) => (
        <span
          key={`${t.dir}/${t.key}`}
          className="cursor-grab rounded-sm border px-1 font-mono"
          draggable
          onDragStart={(e) => {
            const dragged: Dragged = { ...t, templates: all.map((o) => o.key) };
            e.dataTransfer.setData(DRAGGED, JSON.stringify(dragged));
          }}
        >
          {t.key}
        </span>
      ))}
    </div>
  );
}

/** A template chip dropped on `room`: its child there, keyed `<template>_<n>`. */
export function dropped(t: Dragged, room: MapRoom, story: Story) {
  // ponytail: a key only an uncompiled file holds is the starter's to refuse (told on the footer)
  const key = freeKey(t, story.graph.nodes, t.templates);
  void edit((ed) => ed.made(room, t.dir, key, t.key));
}
