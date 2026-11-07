// The shell's left column: the Hierarchy (every definition by kind, the current room marked, the
// selection shared) and the map slot under it, its Map | Story segment (E3a and S2 fill them).
import { useState } from 'react';
import { MapPin, Play, Plus } from 'lucide-react';
import { definitionOf } from '../../../kernel/ts/play/card.ts';
import { AreaMap, type MapProps } from './areamap.tsx';
import type { Change, Story, useDiagnostics } from './author.ts';
import { Button } from './components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover.tsx';
import { useCartridge } from './edit/Generic.tsx';
import { Refusal } from './edit/templates.tsx';
import type { SetLayout } from './columns.tsx';
import { COMMANDS, fromRef, GROUPS, missing, named, newCommand, STARTER, WORLD, type Layout, type Selection } from './shell.ts';
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

let lines: Promise<Record<string, string>> | undefined;
/** Each starter's plain line: the first sentence of its source definition's schema description. */
const described = () =>
  (lines ??= fetch('/__author/schema/rooms')
    .then((r) => r.json())
    .then(({ $defs }) =>
      Object.fromEntries(
        GROUPS.flatMap(([, kinds]) => kinds).map((k) => {
          const text = String($defs[definitionOf($defs, k, {})]?.description ?? '');
          return [k, text.split(/(?<=\.)\s/)[0]];
        }),
      ),
    )
    .catch(() => ((lines = undefined), {})));

// off: the capability a kind needs that cartridge.json lacks (shell.ts missing); its + is disabled.
type Make = { make: (kind: string) => void; label: (kind: string) => string; off: (kind: string) => string | undefined };
/** The + beside World: every starter, grouped, each with its plain line; runs the palette's New. */
function NewMenu({ make, label, off }: Make) {
  const [said, setSaid] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const show = (on: boolean) => {
    setOpen(on);
    if (on) void described().then(setSaid);
  };
  return (
    <Popover open={open} onOpenChange={show}>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="outline" aria-label="New">
          <Plus />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto p-1 text-xs">
        {GROUPS.map(([group, kinds]) => (
          <section key={group}>
            <h4 className="px-2 pt-1.5 text-muted-foreground">{group}</h4>
            {kinds.map((k) => (
              <Button
                key={k}
                variant="ghost"
                size="xs"
                className="h-auto w-full flex-col items-start gap-0 py-1"
                aria-label={label(k)}
                disabled={!!off(k)}
                onClick={() => (setOpen(false), make(k))}
              >
                {k}
                <span className="w-full truncate text-left font-normal text-muted-foreground" title={said[k]}>
                  {off(k) ? `Needs the ${off(k)} capability in cartridge.json` : said[k]}
                </span>
              </Button>
            ))}
          </section>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** A kind's header; its + makes that kind's starter, if it has one. */
const Header = ({ kind, make, label, off }: Make & { kind: string }) => (
  <h3 className="flex items-center px-2 text-xs text-muted-foreground">
    {kind}
    {STARTER[kind] ? (
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto"
        aria-label={label(STARTER[kind])}
        disabled={!!off(STARTER[kind])}
        title={off(STARTER[kind]) && `Needs the ${off(STARTER[kind])} capability in cartridge.json`}
        onClick={() => make(STARTER[kind])}
      >
        <Plus />
      </Button>
    ) : null}
  </h3>
);

type HierarchyProps = {
  story?: Story;
  picked?: string;
  here?: string;
  pick: Pick;
  play: (room: string) => void;
  make: (kind: string) => void;
  diag: ReturnType<typeof useDiagnostics>;
};

/** Every definition of the last good compile, grouped by kind; a + makes a new one (`make`). */
export function Hierarchy({ story, picked, here, pick, play, make, diag }: HierarchyProps) {
  const caps = useCartridge(diag)?.requires?.capabilities ?? {}; // nothing gated is offered while it loads
  if (!story) return <p className="p-3 text-muted-foreground">Waiting for the watcher.</p>;
  const sel = picked ? fromRef(picked) : undefined;
  const label = (k: string) => COMMANDS.find((c) => c.id === newCommand(k, sel))!.label; // New item here, in a room
  const off = (k: string) => missing(k, caps);
  const kinds = new Map<string, Story['graph']['nodes']>();
  for (const n of story.graph.nodes) kinds.set(n.kind, [...(kinds.get(n.kind) ?? []), n]);
  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center">
        <WorldButton pick={pick} />
        <NewMenu make={make} label={label} off={off} />
      </div>
      {[...kinds].map(([kind, nodes]) => (
        <section key={kind}>
          <Header kind={kind} make={make} label={label} off={off} />
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
