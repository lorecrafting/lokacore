// A modal scene's `.cut` pages and their page ops (docs/design/scene-structure-rulings.md §1, §5),
// split from Scene.tsx to stay under the file size limit.
import { ArrowDown, ArrowUp, Merge, Plus, Split, Trash2, type LucideIcon } from 'lucide-react';
import { blocks, cut, type Op } from '../../../../../kernel/ts/play/scene_structure.ts';
import { type SceneSource } from './SceneSource.ts';
import { Button } from '../../components/ui/button.tsx';


/** A modal scene's `.cut` pages (docs/design/scene-structure-rulings.md §1, §5): each line as written,
 * a page's item buttons on its first line and Split on each later one; `---` has none. */
export function Pages({ source, steps }: { source: SceneSource; steps: boolean }) {
  const { file } = source;
  if (!file) return null; // no cut beside this scene
  const lines = file.bytes.split('\n');
  const act = (Icon: LucideIcon, name: string, op: Op) => (
    <Act key={name} Icon={Icon} name={name} op={op} source={source} steps={steps} />
  );
  let page = 0;
  return (
    <ol className="grid gap-1 font-mono" aria-label="pages">
      {blocks(lines).flatMap(([first, last]) => {
        const p = lines[first].trim() === '---' ? 0 : ++page;
        return lines.slice(first, last + 1).map((text, k) => {
          const n = first + k + 1;
          const buttons = !p
            ? null
            : k > 0
              ? act(Split, `Split page ${p} at line ${n}`, { split: n })
              : [
                  act(Plus, `Add after page ${p}`, { add: { after: n, kind: 'page' } }),
                  act(ArrowUp, `Move up page ${p}`, { move: n, by: -1 }),
                  act(ArrowDown, `Move down page ${p}`, { move: n, by: 1 }),
                  act(Merge, `Join page ${p}`, { join: n }),
                  act(Trash2, `Remove page ${p}`, { remove: n }),
                ];
          return (
            <li key={n} className="group flex min-w-0 items-center gap-2">
              <span className="w-6 shrink-0 text-right text-muted-foreground">{n}</span>
              <span className="min-w-0 flex-1 truncate whitespace-pre">{text}</span>
              <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                {buttons}
              </span>
            </li>
          );
        });
      })}
    </ol>
  );
}

/** A page op's item button (chrome §7), disabled with the route's own refusal (scene_structure.ts)
 * in its tooltip; the wrapper carries the tooltip, as a disabled button takes no pointer. */
function Act({
  Icon,
  name,
  op,
  source,
  steps,
}: {
  Icon: LucideIcon;
  name: string;
  op: Op;
  source: SceneSource;
  steps: boolean;
}) {
  const file = source.file!;
  const answer = cut(file.bytes, op, steps);
  const refused = 'refused' in answer ? answer.refused : undefined;
  const send = { file: source.rel, was: file.sha256, op, carry: [] };
  return (
    <span title={refused ? `${name}: ${refused}` : name}>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={name}
        disabled={!!refused}
        onClick={() => void source.post('restructure', send)}
      >
        <Icon className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
      </Button>
    </span>
  );
}
