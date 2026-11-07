// The map's template chips (editor-map-and-story-rulings.md, Left to E3b): the abstract NPCs and
// items, each dragged onto a room to make its child there (`bin/loka new --extends`).
import { useEffect, useState } from 'react';
import { templates, type Story, type Template } from './author.ts';
import type { MapRoom } from './map.ts';
import { childKey } from './mapedit.ts';
import { edit, shown } from './mapwire.ts';

export const DRAGGED = 'text/x-loka-template';
/** A template chip's drag: the template, and every template key (no compiled node holds them). */
type Dragged = Template & { templates: string[] };
/** The abstract NPCs and items as chips (`~` label); a drag onto a room makes a child there, and a
 * press (Enter for the keyboard) one in the selected `room` (editor-chrome-rulings.md: every control by Tab). */
export function Templates({ story, room }: { story: Story; room?: MapRoom }) {
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
      <span aria-hidden className="text-muted-foreground">~</span>
      {all.map((t) => {
        const dragged: Dragged = { ...t, templates: all.map((o) => o.key) };
        return (
          <button
            type="button"
            key={`${t.dir}/${t.key}`}
            className="cursor-grab rounded-sm border px-1 font-mono"
            draggable
            onDragStart={(e) => e.dataTransfer.setData(DRAGGED, JSON.stringify(dragged))}
            onClick={() => (room ? dropped(dragged, room, story) : shown.tell('Select a room on the map first'))}
          >
            {t.key}
          </button>
        );
      })}
    </div>
  );
}

/** A template chip dropped on `room`: its child there, keyed `<template>_<n>`. */
export function dropped(t: Dragged, room: MapRoom, story: Story) {
  // ponytail: a key only an uncompiled file holds is the starter's to refuse (told on the footer)
  const key = childKey(t.dir, t.key, story.graph.nodes, t.templates);
  void edit((ed) => ed.made(room, t.dir, key, t.key));
}
