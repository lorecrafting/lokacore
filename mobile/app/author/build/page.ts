// Build's hooks on the author preview's page (docs/rnd/in-game-builder-mode-2026-11-19.md decision
// 5, slice 6.4): the author routes' fetch, the Book's palette as the --loka-<role> variables ink()
// reads (build.ts), the `~` counts the panel shows, a double-click outside Build opening a line's
// field, and the walk keys. panel.tsx starts it only in the author preview.
import { pagePaper, paletteNear, shortcut, step, textField, walk } from '../prose_rules.ts';
import { opens, walkable } from './field.tsx';

export async function api(path: string, sent?: object): Promise<[number, any]> {
  const init = sent && { method: 'POST', body: JSON.stringify(sent) };
  const r = await fetch(`/__author${path}`, init);
  return [r.status, await r.json().catch(() => null)];
}
let tell: (sent: object) => void = () => {};
let counted = '';
let frame = 0; // one reapply a frame: a Book fade rewrites its style every frame
const later = () => (frame ||= requestAnimationFrame(() => ((frame = 0), reapply())));
const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(later);
const typing = (t: EventTarget | null) => t instanceof HTMLElement && textField(t);
const focused = () => document.activeElement as HTMLElement;

function reapply() {
  const book = document.querySelector('[data-testid="loka-book"]') ?? document.body;
  for (const [role, ink] of Object.entries(paletteNear(pagePaper(book))))
    document.documentElement.style.setProperty(`--loka-${role}`, ink);
  const todo = walkable(true);
  const counts = JSON.stringify({ here: todo.length, at: todo.indexOf(focused()) + 1 });
  if (counts !== counted) tell({ todoHere: JSON.parse((counted = counts)) });
}
function onKey(e: KeyboardEvent) {
  const asks = shortcut(e); // the panel's, though the Book has the focus
  if (asks) return void (e.preventDefault(), tell({ shortcut: asks }));
  const asked = walk(e, typing(e.target));
  if (!asked) return;
  const list = walkable(asked[0]);
  const next = list[step(list.length, list.indexOf(focused()), asked[1])];
  next?.focus(); // Enter or Space on it opens its field (field.tsx `keyed`)
  next?.scrollIntoView({ block: 'nearest' });
}
const onDouble = (e: MouseEvent) => {
  if (typing(e.target) || matchMedia('(pointer: coarse)').matches) return; // a word picked in a field
  for (let el = e.target as Element | null; el && el !== document.body; el = el.parentElement)
    if (opens(el.textContent ?? '')) return;
};
const on = (): [EventTarget, string, EventListener][] => [
  [document, 'dblclick', onDouble as EventListener], // read at start(): a node import has no document
  [document, 'keydown', onKey as EventListener],
  [document, 'focusin', later], // a walk or a click moves the counts' `at`
];
/** Tells the counts again (a panel that just said hello missed them). */
export function recount() {
  counted = '';
  reapply();
}
/** Starts the page hooks; `given` posts to the panel. The returned function stops them. */
export function start(given: (sent: object) => void) {
  tell = given;
  for (const [target, name, run] of on()) target.addEventListener(name, run, true);
  observer?.observe(document.body, {
    ...{ childList: true, subtree: true, characterData: true },
    attributeFilter: ['style', 'class'], // the Book turning to night repaints, adding no node
  });
  reapply();
  return () => {
    for (const [target, name, run] of on()) target.removeEventListener(name, run, true);
    observer?.disconnect();
    cancelAnimationFrame(frame); // a frame already asked for would tell the panel after the stop
    frame = 0;
  };
}
