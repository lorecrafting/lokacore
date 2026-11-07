// The shell's left column: the Hierarchy (every definition by kind, the current room marked, the
// selection shared) and the map slot under it, its Map | Story segment (E3a and S2 fill them).
import { MapPin, Play } from 'lucide-react';
import { AreaMap, type MapProps } from './areamap.tsx';
import type { Change, Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import { Refusal } from './edit/templates.tsx';
import type { SetLayout } from './columns.tsx';
import { fromRef, named, WORLD, type Layout, type Selection } from './shell.ts';
import { FlowView } from './flow.tsx';
import { StoryList } from './storylist.tsx';

type Pick = (s: Selection) => void;

type RowProps = {
  ref_: string;
  name?: string;
  picked: boolean;
  here: boolean;
  pick: Pick;
  play?: (room: string) => void;
};

function Row({ ref_, name, picked, here, pick, play }: RowProps) {
  const s = fromRef(ref_)!;
  return (
    <li className={`flex items-center rounded-sm ${picked ? 'bg-accent' : ''}`}>
      <button
        type="button"
        aria-pressed={picked}
        className="flex flex-1 items-center gap-1.5 truncate px-2 py-0.5 text-left"
        onClick={() => pick(s)}
      >
        {named(s.key, name)}
        {here ? <MapPin className="text-primary" aria-label="the Book is here" /> : null}
      </button>
      {play ? (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Play from here"
          aria-label={`Play from ${s.key}`}
          onClick={() => play(s.key)}
        >
          <Play />
        </Button>
      ) : null}
    </li>
  );
}

/** Opens the World card (cartridge.json, resources, attributes), from the Hierarchy and the Project tab. */
export const WorldButton = ({ pick }: { pick: Pick }) => (
  <Button size="xs" variant="outline" className="mx-2" onClick={() => pick(WORLD)}>
    World
  </Button>
);

/** Every definition of the last good compile, grouped by kind. */
export function Hierarchy({
  story,
  picked,
  here,
  pick,
  play,
}: {
  story?: Story;
  picked?: string;
  here?: string;
  pick: Pick;
  play: (room: string) => void;
}) {
  if (!story) return <p className="p-3 text-muted-foreground">Waiting for the watcher.</p>;
  const kinds = new Map<string, Story['graph']['nodes']>();
  for (const n of story.graph.nodes) kinds.set(n.kind, [...(kinds.get(n.kind) ?? []), n]);
  return (
    <div className="space-y-2 p-2">
      <WorldButton pick={pick} />
      {[...kinds].map(([kind, nodes]) => (
        <section key={kind}>
          <h3 className="px-2 text-xs text-muted-foreground">{kind}</h3>
          <ul>
            {nodes.map((n) => (
              <Row
                key={n.ref}
                ref_={n.ref}
                name={story.names[n.ref]}
                picked={n.ref === picked}
                here={n.ref === here}
                pick={pick}
                play={kind === 'room' ? play : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The map slot: Map | Story (the area map, or the Story list and Trace), both drawn from GET /story. */
export function MapSlot({
  layout,
  set,
  story,
  refused,
  changes,
  ...m
}: { layout: Layout; set: SetLayout; story?: Story; refused?: string; changes: Change[] } & Omit<MapProps, 'story' | 'segment'>) {
  const segment = <Segment layout={layout} set={set} />;
  return (
    <section
      className="flex max-h-[calc(100%-2rem)] shrink-0 flex-col"
      style={{ height: layout.slot }}
      aria-label="Map slot"
    >
      {refused ? (
        <div className="p-2">
          {segment}
          <div className="mt-2">
            <Refusal>{refused}</Refusal>
          </div>
        </div>
      ) : layout.map === 'map' && story ? (
        <AreaMap story={story} segment={segment} {...m} />
      ) : layout.map === 'flow' && story ? (
        <FlowView story={story} layout={layout} set={set} segment={segment} pick={m.pick} open={m.open} changes={changes} />
      ) : story ? (
        <StoryList story={story} layout={layout} set={set} segment={segment} pick={m.pick} open={m.open} />
      ) : (
        <div className="p-2">
          {segment}
          <p className="mt-2 text-muted-foreground">Waiting for the watcher.</p>
        </div>
      )}
    </section>
  );
}

/** The Map | Story | Flow segment (Esc in the map returns here). */
function Segment({ layout, set }: { layout: Layout; set: SetLayout }) {
  const views = ['map', 'story', 'flow'] as const;
  return (
    <div role="radiogroup" aria-label="Map, Story or Flow" className="inline-flex rounded-md border">
      {views.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={layout.map === v}
          className={`px-1 text-xs capitalize ${layout.map === v ? 'bg-accent' : ''}`}
          onClick={() => set((l) => ({ ...l, map: v }))}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
