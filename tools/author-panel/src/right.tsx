// The shell's right column: the inspector (the selection's summary, then the generic card that edits
// its `.json` source) over the console (the change feed, you or outside, and the last compile's diagnostics).
import { editable, worldFile } from '../../../kernel/ts/play/card.ts';
import type { Change, Story, useDiagnostics } from './author.ts';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card.tsx';
import { World } from './edit/cards/World.tsx';
import { Generic } from './edit/Generic.tsx';
import { Action } from './edit/cards/Action.tsx';
import { Dialogue } from './edit/cards/Dialogue.tsx';
import { Entity } from './edit/cards/Entity.tsx';
import { Quest } from './edit/cards/Quest.tsx';
import { Reaction } from './edit/cards/Reaction.tsx';
import { Room } from './edit/cards/Room.tsx';
import { ModalScene, SceneText } from './edit/cards/Scene.tsx';
import { scened } from '../../../kernel/ts/play/scene_lines.ts';
import { fileOf, places, type Selection } from './shell.ts';

type Props = {
  sel?: Selection;
  story?: Story;
  diag: ReturnType<typeof useDiagnostics>;
  edit: (key: string) => void;
  offer: (add: string[]) => void;
  pick?: (s: Selection) => void;
};

/** The selection's summary: its kind, ref, `~`, diagnostics and links, from GET /story; then its card. */
export function Inspector({ sel, story, diag, edit, offer, pick }: Props) {
  if (!sel)
    return (
      <p className="p-3 text-muted-foreground">
        Select a definition in the hierarchy or a line in the Book.
      </p>
    );
  const ref = places(sel, story?.graph.nodes ?? []).inspector?.ref;
  const rel = fileOf(sel, ref, story?.files);
  const { hidden, unlinkable, files } = story ?? {};
  const nodes = story?.graph.nodes ?? [];
  const context = { kind: sel.kind, key: sel.key, nodes, edit, hidden, unlinkable, files, open: pick };
  const count = (rows?: Record<string, unknown[]>) => (ref && rows?.[ref]?.length) || 0;
  const unreached =
    !!ref && Object.values(story!.report.unreachable).some((refs) => refs.includes(ref));
  return (
    // a tall card scrolls itself, not the page; relative, or its absolute sr-only labels escape (loka-wfrgk.44)
    <Card className="relative m-2 min-h-0 gap-2 overflow-y-auto py-3" aria-label="Inspector">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">{sel.key}</CardTitle>
        <p className="text-xs text-muted-foreground">{sel.kind}</p>
      </CardHeader>
      <CardContent className="px-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          <dt className="text-muted-foreground">ref</dt>
          <dd className="truncate font-mono">{ref ?? 'not in the last good compile'}</dd>
          <dt className="text-muted-foreground">~</dt>
          <dd className={count(story?.todo) ? 'text-warning' : ''}>{count(story?.todo)}</dd>
          <dt className="text-muted-foreground">diagnostics</dt>
          <dd className={count(story?.diagnostics) ? 'text-destructive' : ''}>
            {count(story?.diagnostics)}
          </dd>
          {unreached ? <dd className="col-span-2 text-warning">unreached from the start</dd> : null}
        </dl>
      </CardContent>
      {editable(rel) || scened(rel) ? <Editor rel={rel!} {...{ context, diag, offer }} /> : null}
    </Card>
  );
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Each write to a source file, newest first: the editor's uncoloured, one from outside marked by an `outside` bar and word (rulings §3). */
export function Feed({ changes }: { changes: Change[] }) {
  if (!changes.length)
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">No change since this page opened.</p>
    );
  return (
    <ul className="px-3 py-2 font-mono text-xs" aria-label="Change feed">
      {changes.map((c) => (
        <li
          key={`${c.seen}${c.file}${c.sha256}`}
          className={`border-l-2 pl-1 ${c.by === 'outside' ? 'border-outside' : 'border-transparent'}`}
        >
          {clock(c.seen)}{' '}
          {c.by === 'outside' ? (
            <span className="font-semibold text-outside">outside</span>
          ) : (
            <span className="text-muted-foreground">you</span>
          )}{' '}
          {c.file}
        </li>
      ))}
    </ul>
  );
}

/** The definition's card: a hand-built one where the registry names it, else the generic one. */
function Editor({ rel, offer, ...props }: Parameters<typeof Room>[0]) {
  return /(^|\/)rooms\/[^/]+\.json$/.test(rel) ? (
    <Room key={rel} rel={rel} offer={offer} {...props} />
  ) : /(^|\/)(npcs|items)\/[^/]+\.json$/.test(rel) ? (
    <Entity key={rel} rel={rel} {...props} />
  ) : /(^|\/)actions\/[^/]+\.json$/.test(rel) ? (
    <Action key={rel} rel={rel} {...props} />
  ) : /(^|\/)reactions\/[^/]+\.json$/.test(rel) ? (
    <Reaction key={rel} rel={rel} {...props} />
  ) : /(^|\/)quests\/[^/]+\.json$/.test(rel) ? (
    <Quest key={rel} rel={rel} {...props} />
  ) : scened(rel) ? (
    <SceneText key={rel} rel={rel} {...props} />
  ) : /(^|\/)scenes\/[^/]+\.json$/.test(rel) ? (
    <ModalScene key={rel} rel={rel} {...props} />
  ) : /(^|\/)dialogues\/[^/]+\.json$/.test(rel) ? (
    <Dialogue key={rel} rel={rel} {...props} />
  ) : worldFile(rel) ? ( // mutate-skip: draw; the choice is worldFile, pinned in card.test.ts
    <World key={rel} rel={rel} {...props} />
  ) : (
    <Generic key={rel} rel={rel} {...props} />
  );
}
