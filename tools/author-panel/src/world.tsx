// The toolbar's world picker: GET/POST /world (kernel/ts/play/write.ts). The watcher restarts on
// the chosen world, so the panel waits for /world to name it, then reloads with no selection and
// no start checkpoint (both belong to the world left).
import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ask } from './author.ts';
import type { SetLayout } from './columns.tsx';
import { Button } from './components/ui/button.tsx';
import { START } from './shell.ts';

type Worlds = { current: string; worlds: { name: string; title: string }[] };
type Go = (sent: { name: string; new?: boolean; from?: string }) => void;
const worlds = () => fetch('/__author/world').then((r) => r.json() as Promise<Worlds>);

/** Reloads once the restarted watcher names `name`; false if it has not within a minute. */
async function opens(name: string): Promise<void | false> {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if ((await worlds().catch(() => undefined))?.current === name) return location.reload();
  }
  return false;
}

export function World({ set }: { set: SetLayout }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<Worlds>();
  const [said, setSaid] = useState('');
  useEffect(() => void worlds().then(setAll, () => {}), [open]);
  const go: Go = async (sent) => {
    const { ok, told } = await ask('world', sent).catch(() => ({ ok: false, told: 'no answer' }));
    if (!ok) return setSaid(String(told));
    set((l) => ({ ...l, selection: undefined }));
    localStorage.removeItem(START);
    setSaid('switching…');
    if (!(await opens(sent.name))) setSaid(`${sent.name} did not open: see the watcher's terminal`);
  };
  const title = all?.worlds.find((w) => w.name === all.current)?.title ?? all?.current;
  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Button
        size="xs"
        variant="ghost"
        aria-expanded={open}
        title="World"
        onClick={() => setOpen(!open)}
      >
        <Globe aria-hidden />
        {title}
      </Button>
      {open && all ? (
        <div
          role="dialog"
          aria-label="Worlds"
          className="absolute top-7 left-0 z-50 w-64 rounded-md border bg-card p-1 text-sm shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
        >
          <List all={all} go={go} />
          <New all={all} go={go} />
          {said ? <p className="px-2 py-1 text-xs text-muted-foreground">{said}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function List({ all, go }: { all: Worlds; go: Go }) {
  return (
    <ul className="max-h-[50vh] overflow-auto">
      {all.worlds.map((w) => (
        <li key={w.name}>
          <button
            type="button"
            aria-current={w.name === all.current}
            className="flex h-7 w-full items-center gap-2 rounded px-2 text-left hover:bg-accent aria-[current=true]:font-semibold"
            onClick={() => w.name !== all.current && go({ name: w.name })}
          >
            <span className="truncate">{w.title}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">{w.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A folder name and blank or a copy of a listed world; the server checks both again. */
function New({ all, go }: { all: Worlds; go: Go }) {
  const create = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const from = String(form.get('from'));
    go({ name: String(form.get('name')), new: true, ...(from && { from }) });
  };
  return (
    <form className="mt-1 flex flex-col gap-1 border-t p-1" onSubmit={create}>
      <input
        name="name"
        required
        pattern="[a-z][a-z0-9_]{0,63}"
        aria-label="New world folder"
        placeholder="new_world"
        className="h-7 rounded border bg-background px-2 font-mono text-xs"
      />
      <select
        name="from"
        aria-label="Start from"
        className="h-7 rounded border bg-background px-1 text-xs"
      >
        <option value="">blank</option>
        {all.worlds.map((w) => (
          <option key={w.name} value={w.name}>
            copy of {w.title}
          </option>
        ))}
      </select>
      <Button size="xs" type="submit">
        New world
      </Button>
    </form>
  );
}
