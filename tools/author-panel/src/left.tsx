// The shell's left column: the Hierarchy (every definition by kind, the current room marked, the
// selection shared) and the map slot under it, its Map | Story segment (E3a and S2 fill them).
import { MapPin, Play } from 'lucide-react';
import type { Story } from './author.ts';
import { Button } from './components/ui/button.tsx';
import type { SetLayout } from './columns.tsx';
import { fromRef, type Layout, type Selection } from './shell.ts';

type Pick = (s: Selection) => void;

function Row({
  ref_,
  picked,
  here,
  pick,
  play,
}: {
  ref_: string;
  picked: boolean;
  here: boolean;
  pick: Pick;
  play?: (room: string) => void;
}) {
  const s = fromRef(ref_)!;
  return (
    <li className={`flex items-center rounded-sm ${picked ? 'bg-accent' : ''}`}>
      <button
        type="button"
        aria-pressed={picked}
        className="flex flex-1 items-center gap-1.5 truncate px-2 py-0.5 text-left"
        onClick={() => pick(s)}
      >
        {s.key}
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
      {[...kinds].map(([kind, nodes]) => (
        <section key={kind}>
          <h3 className="px-2 text-xs text-muted-foreground">{kind}</h3>
          <ul>
            {nodes.map((n) => (
              <Row
                key={n.ref}
                ref_={n.ref}
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

/** The map slot: Map | Story, both placeholders until E3a and S2; Story counts GET /story. */
export function MapSlot({ layout, set, story }: { layout: Layout; set: SetLayout; story?: Story }) {
  const views = ['map', 'story'] as const;
  const todo = story && Object.values(story.todo).flat().length;
  const unreached = story && Object.values(story.report.unreachable).flat().length;
  return (
    <section className="h-48 shrink-0 border-t p-2" aria-label="Map slot">
      <div
        role="radiogroup"
        aria-label="Map or Story"
        className="mb-2 inline-flex rounded-md border"
      >
        {views.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={layout.map === v}
            className={`px-2 text-xs capitalize ${layout.map === v ? 'bg-accent' : ''}`}
            onClick={() => set((l) => ({ ...l, map: v }))}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground">
        {layout.map === 'map'
          ? 'The area map comes with E3a.'
          : story
            ? `${story.graph.nodes.length} definitions · ${story.graph.edges.length} links · ${todo} ~ · ${unreached} unreached`
            : 'Waiting for the watcher.'}
      </p>
    </section>
  );
}
