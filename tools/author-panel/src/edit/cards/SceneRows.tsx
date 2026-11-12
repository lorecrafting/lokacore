// A scene row's item buttons (docs/design/scene-structure-rulings.md §5): Add with a menu of the
// kinds the block takes, Move up, Move down, Remove, and the Alt keys that mirror them. Each button's
// refusal is the route's own, from scene_structure.ts, so the card never sends what would be refused.
import { ArrowDown, ArrowUp, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { offers, rows, scene, type Op } from '../../../../../kernel/ts/play/scene_structure.ts';
import { Button } from '../../components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu.tsx';

export type Rower = (op: Op) => void;

/** Alt-Up/Alt-Down move a row and Alt-Enter opens Add, from the row itself or a button, never from
 * inside a field: there Alt and the arrows keep their platform text meaning (rulings §5). */
export function lineKey(e: React.KeyboardEvent, n: number, op: Rower) {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || !e.altKey) return;
  const at = (o: Op) => (e.preventDefault(), op(o));
  if (e.key === 'ArrowUp') at({ move: n, by: -1 });
  else if (e.key === 'ArrowDown') at({ move: n, by: 1 });
  else if (e.key === 'Enter') {
    e.preventDefault();
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-add]')?.focus();
    document.querySelector<HTMLElement>(`[data-add="${n}"]`)?.click();
  }
}

/** A row's item buttons (chrome §7, rulings §5): Add (a menu of the kinds the block takes), Move up,
 * Move down, Remove. A button that cannot act is disabled with the route's own refusal in its
 * tooltip; the wrapper carries the tooltip, as a disabled button takes no pointer. */
export function RowMenu({ n, rs, op }: { n: number; rs: ReturnType<typeof rows>; op: Rower }) {
  const at = n - 1;
  const say = (o: Op) => {
    const a = scene(rs.map((r) => r.text).join('\n'), o);
    return 'refused' in a ? a.refused : undefined;
  };
  const kinds = at >= 0 && at < rs.length ? offers(rs, at) : [];
  return (
    <>
      {kinds.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Add after line ${n}`} data-add={n}>
              <Plus className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-80">
            {kinds.map((kind) => {
              const why = say({ add: { after: n, kind } });
              return (
                <DropdownMenuItem
                  key={kind}
                  textValue={kind}
                  disabled={!!why}
                  onSelect={() => !why && op({ add: { after: n, kind } })}
                  className="grid gap-0 text-xs"
                >
                  <span>{kind === 'speaker' ? 'speaker line' : kind === 'words' ? 'words line' : kind}</span>
                  {why ? <span className="text-muted-foreground">{why}</span> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {Acts(n, say, op)}
    </>
  );
}

/** Move up, Move down and Remove: one disabled by its own refusal, never by guesswork. */
function Acts(n: number, say: (o: Op) => string | undefined, op: Rower) {
  const buttons: [LucideIcon, string, Op][] = [
    [ArrowUp, `Move up line ${n}`, { move: n, by: -1 }],
    [ArrowDown, `Move down line ${n}`, { move: n, by: 1 }],
    [Trash2, `Remove line ${n}`, { remove: n }],
  ];
  return buttons.map(([Icon, name, o]) => {
    const why = say(o);
    return (
      <span key={name} title={why ? `${name}: ${why}` : name}>
        <Button type="button" size="icon-xs" variant="ghost" aria-label={name} disabled={!!why} onClick={() => op(o)}>
          <Icon className="size-4" strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
        </Button>
      </span>
    );
  });
}

