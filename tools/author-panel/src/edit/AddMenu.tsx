// The card's "Add…" menu (docs/rnd/gui-editor-design-2026-11-04.md §3): the registry's fields this
// definition lacks, and the ones the cartridge refuses, greyed with the capability to declare.
import { Button } from '../components/ui/button.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu.tsx';
import type { Blocked } from '../../../../kernel/ts/play/allowed.ts';

/** The registry's fields this definition lacks, each with its schema description: choosing one reveals its empty
 * field. A refused one still shows, greyed with why (loka-wfrgk.94): an option missing with no reason reads as a
 * missing feature, not a world setting to turn on. */
export function AddMenu({ fields: menu, reveal, about = () => undefined, blocked = [] }: {
  fields: string[];
  reveal: (f: string) => void;
  about?: (f: string) => string | undefined;
  blocked?: Blocked[];
}) {
  if (!menu.length && !blocked.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="xs" variant="outline" aria-label="Add a field" className="justify-self-start">
          Add…
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-80">
        {[
          ...menu.map((f) => ({ name: f, note: about(f), onSelect: () => reveal(f) })),
          ...blocked.map((b) => ({ name: b.field, note: why(b) })),
        ].map((row) => (
          <Row key={row.name} {...row} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One menu row: the field and its note (a description, or why the cartridge refuses it). */
const Row = ({ name, note, onSelect }: { name: string; note?: string; onSelect?: () => void }) => (
  <DropdownMenuItem textValue={name} disabled={!onSelect} onSelect={onSelect} className="grid gap-0 text-xs">
    <span>{name}</span>
    {note ? <span className="text-muted-foreground">{note}</span> : null}
  </DropdownMenuItem>
);

/** Why the cartridge will not take the field: the capabilities to declare, else the field a need wants. */
const why = (b: Blocked) =>
  b.caps.length ? `needs ${b.caps.join(' + ')} in cartridge.json` : 'needs another field first';

/** The file, the compile state (held, compiling, stale) and Undo of the last change. */